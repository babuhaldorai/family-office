// Commits one backup file to the private GitHub repository. Used by the
// "Back up now" button and by the nightly job.
async function putBackup(name, content) {
  const ghToken = process.env.GITHUB_BACKUP_TOKEN;
  const repo = process.env.GITHUB_BACKUP_REPO;
  // no branch given = the repository's own default branch, which also works on an empty repository
  const branch = process.env.GITHUB_BACKUP_BRANCH || '';
  if (!ghToken || !repo) {
    const missing = [!ghToken && 'GITHUB_BACKUP_TOKEN', !repo && 'GITHUB_BACKUP_REPO'].filter(Boolean).join(' and ');
    const e = new Error(`${missing} ${missing.includes(' and ') ? 'are' : 'is'} not set on the Netlify site, or the site was not redeployed after adding it.`);
    e.status = 501; throw e;
  }
  const cleanRepo = String(repo).trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(cleanRepo)) throw new Error('GITHUB_BACKUP_REPO must look like owner/name, for example babuhaldorai/family-office-backups.');
  const m = String(name).match(/-(\d{4})-(\d{2})-\d{2}-\d{6}\.json$/);
  if (!m) throw new Error('Bad file name.');
  const path = `backups/${m[1]}/${m[2]}/${name}`;
  const gh = (url, init = {}) => fetch(url, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + ghToken.trim(), Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'backup-function', 'Content-Type': 'application/json',
    },
  });
  const body = { message: `Backup ${name}`, content: Buffer.from(content, 'utf8').toString('base64') };
  if (branch) body.branch = branch;
  let res;
  try { res = await gh(`https://api.github.com/repos/${cleanRepo}/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) }); }
  catch (e) { throw new Error('Could not reach GitHub.'); }
  if (res.ok) return path;
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
  throw new Error(why);
}

module.exports = { putBackup };
