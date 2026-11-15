// Reads and writes Firestore from the server with a Firebase service account,
// using plain HTTPS so no extra library is needed.
const crypto = require('crypto');

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try { const j = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); return { email: j.client_email, key: j.private_key, project: j.project_id }; }
    catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole key file.'); }
  }
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('The Firebase service account is not set on the site (FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY).');
  return { email, key, project: process.env.REACT_APP_FIREBASE_PROJECT_ID };
}

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 })}`;
  let signature;
  try { signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.key, 'base64url'); }
  catch (e) { throw new Error('The Firebase private key could not be used. Check FIREBASE_PRIVATE_KEY was pasted complete, including the BEGIN and END lines.'); }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${signature}`,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`Google did not accept the service account (${j.error_description || j.error || res.status}).`);
  return j.access_token;
}

// Firestore's wire format <-> plain values
function decode(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
}
const decodeFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, decode(v)]));
const docOf = (d) => ({ ...decodeFields(d.fields), id: d.name.split('/').pop() });
function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
}

function firestore(project, token) {
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const fail = async (res, what) => { const j = await res.json().catch(() => ({})); throw new Error(`Could not ${what} (${res.status}${j.error && j.error.message ? ': ' + j.error.message : ''}).`); };
  return {
    async list(col) {
      const out = [];
      let pageToken = '';
      do {
        const res = await fetch(`${base}/${col}?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`, { headers });
        if (!res.ok) await fail(res, `read ${col}`);
        const j = await res.json();
        (j.documents || []).forEach((d) => out.push(docOf(d)));
        pageToken = j.nextPageToken || '';
      } while (pageToken);
      return out;
    },
    async where(col, field, value) {
      const res = await fetch(`${base}:runQuery`, {
        method: 'POST', headers,
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encode(value) } } } }),
      });
      if (!res.ok) await fail(res, `read ${col}`);
      return (await res.json()).filter((r) => r.document).map((r) => docOf(r.document));
    },
    async set(col, id, data) {
      const res = await fetch(`${base}/${col}/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ fields: encode(data).mapValue.fields }) });
      if (!res.ok) await fail(res, `write ${col}/${id}`);
    },
  };
}

module.exports = { serviceAccount, accessToken, firestore, decodeFields, encode };
