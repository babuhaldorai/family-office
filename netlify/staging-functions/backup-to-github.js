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
  // no branch given = the repository's own default branch (main or master), which also works on an empty repository
  const branch = process.env.GITHUB_BACKUP_BRANCH || '';
  const cleanRepo = String(repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  if (!ghToken || !repo) {
    const missing = [!ghToken && 'GITHUB_BACKUP_TOKEN', !repo && 'GITHUB_BACKUP_REPO'].filter(Boolean).join(' and ');
    return json(501, { error: `${missing} ${missing.includes(" and ") ? "are" : "is"} not set on the Netlify site, or the site was not redeployed after adding it.` });
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(cleanRepo)) return json(500, { error: 'GITHUB_BACKUP_REPO must look like owner/name, for example babuhaldorai/family-office-backups.' });
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
  const gh = (url, init = {}) => fetch(url, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + ghToken.trim(), Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'backup-function', 'Content-Type': 'application/json',
    },
  });
  try {
    const body = { message: `Backup ${name}`, content: Buffer.from(content, 'utf8').toString('base64') };
    if (branch) body.branch = branch;
    const res = await gh(`https://api.github.com/repos/${cleanRepo}/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) });
    if (res.ok) return json(200, { ok: true, path });
    const detail = await res.json().catch(() => ({}));
    // say what is actually wrong, in words that point at the fix
    let why = `GitHub answered ${res.status}${detail.message ? ': ' + detail.message : ''}.`;
    if (res.status === 401) why = 'GitHub did not accept the token. It may be mistyped or expired. Make a new one and update GITHUB_BACKUP_TOKEN.';
    else if (res.status === 403) why = `The token is not allowed to write to ${cleanRepo}. A fine-grained token needs this repository selected and "Contents: Read and write".`;
    else if (res.status === 404) {
      const look = await gh(`https://api.github.com/repos/${cleanRepo}`).catch(() => null);
      why = look && look.ok
        ? `The token can see ${cleanRepo} but cannot write to it. Give it "Contents: Read and write"${branch ? `, and check the branch "${branch}" exists` : ''}.`
        : `GitHub cannot find ${cleanRepo} with this token. Check the name in GITHUB_BACKUP_REPO, and that the token has this repository selected.`;
    } else if (res.status === 409 || res.status === 422) why = `GitHub would not create the file (${detail.message || res.status}).${branch ? ` Check the branch "${branch}" exists.` : ''}`;
    return json(502, { error: why });
  } catch (e) { return json(502, { error: 'Could not reach GitHub.' }); }
};
