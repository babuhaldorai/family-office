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
//   GITHUB_BACKUP_BRANCH  optional, defaults to main
//   REACT_APP_FIREBASE_PROJECT_ID  already set for the site build

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function uidFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.user_id || payload.sub || null;
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const { GITHUB_BACKUP_TOKEN: ghToken, GITHUB_BACKUP_REPO: repo, REACT_APP_FIREBASE_PROJECT_ID: project } = process.env;
  const branch = process.env.GITHUB_BACKUP_BRANCH || 'main';
  if (!ghToken || !repo) return json(501, { error: 'GitHub backup is not set up yet (GITHUB_BACKUP_TOKEN and GITHUB_BACKUP_REPO are missing on the site).' });
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
  const [, y, m] = name.match(/-(\d{4})-(\d{2})-\d{2}-\d{6}\.json$/);
  const path = `backups/${y}/${m}/${name}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + ghToken, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'backup-function', 'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: `Backup ${name}`, branch, content: Buffer.from(content, 'utf8').toString('base64') }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return json(502, { error: `GitHub refused the backup (${res.status}${detail.message ? ': ' + detail.message : ''}).` });
    }
    return json(200, { ok: true, path });
  } catch (e) { return json(502, { error: 'Could not reach GitHub.' }); }
};
