// Stores one backup file in a private GitHub repository.
//
// The browser cannot hold a GitHub key safely, so it sends the backup here and
// this function (which has the key as a Netlify environment variable) commits
// it. Before doing anything it checks that the caller is a signed-in Owner or
// Manager: it asks Firestore for the caller's own user record using the
// caller's sign-in token. Firestore itself validates that token, so a made-up
// token gets nothing.
//
// Netlify environment variables needed:
//   GITHUB_BACKUP_TOKEN   a fine-grained token with "Contents: read and write"
//                         on the backup repository only
//   GITHUB_BACKUP_REPO    owner/name of the private repository
//   GITHUB_BACKUP_BRANCH  optional, defaults to the repository's default branch
//   REACT_APP_FIREBASE_PROJECT_ID  already set for the site build

const { putBackup } = require('../lib/github');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function uidFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.user_id || payload.sub || null;
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const project = process.env.REACT_APP_FIREBASE_PROJECT_ID;
  if (!project) return json(500, { error: 'The Firebase project id is not set on the site.' });

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const uid = idToken ? uidFromToken(idToken) : null;
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return json(401, { error: 'Not signed in.' });

  // Who is calling? Firestore checks the token and only returns the caller's own record.
  let role = null;
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}`, {
      headers: { Authorization: 'Bearer ' + idToken },
    });
    if (!res.ok) return json(403, { error: 'Your sign-in could not be confirmed.' });
    const doc = await res.json();
    role = doc.fields && doc.fields.role ? doc.fields.role.stringValue : null;
  } catch (e) { return json(502, { error: 'Could not confirm who is signed in.' }); }
  if (role !== 'admin' && role !== 'manager') return json(403, { error: 'Only an Owner or Manager can back up.' });

  let name, content;
  try { ({ name, content } = JSON.parse(event.body || '{}')); } catch (e) { return json(400, { error: 'Bad request.' }); }
  if (!/^[a-z-]+-\d{4}-\d{2}-\d{2}-\d{6}\.json$/.test(name || '')) return json(400, { error: 'Bad file name.' });
  if (typeof content !== 'string' || content.length < 2 || content.length > 5.5 * 1024 * 1024) return json(400, { error: 'The backup is empty or too large for this route.' });
  try {
    const parsed = JSON.parse(content);
    if (parsed.app !== 'family-office' || !parsed.collections) return json(400, { error: 'That is not a backup.' });
  } catch (e) { return json(400, { error: 'That is not a backup.' }); }

  // backups/2026/11/fo-2026-11-13-183000.json — a new file every time, never overwritten
  try { return json(200, { ok: true, path: await putBackup(name, content) }); }
  catch (e) { return json(e.status || 502, { error: e.message }); }
};
