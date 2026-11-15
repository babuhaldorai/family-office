// The "Send a test email now" button under Settings → Reminders. Owner only.
// It runs exactly what the daily job runs, and says plainly what is missing.
const { runReminders } = require('../lib/run-reminders');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function uidFromToken(token) {
  try { const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); return p.user_id || p.sub || null; } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const project = process.env.REACT_APP_FIREBASE_PROJECT_ID;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const uid = idToken ? uidFromToken(idToken) : null;
  if (!project || !uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return json(401, { error: 'Not signed in.' });
  try {
    // Firestore checks the token and only returns the caller's own record
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}`, { headers: { Authorization: 'Bearer ' + idToken } });
    if (!res.ok) return json(403, { error: 'Your sign-in could not be confirmed.' });
    const doc = await res.json();
    if (!doc.fields || !doc.fields.role || doc.fields.role.stringValue !== 'admin') return json(403, { error: 'Only the Owner can send a test reminder.' });
  } catch (e) { return json(502, { error: 'Could not confirm who is signed in.' }); }
  try {
    return json(200, await runReminders({ force: true }));
  } catch (e) { return json(200, { sent: false, error: e.message }); }
};
