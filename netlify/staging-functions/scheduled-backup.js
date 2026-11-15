// Runs every night (see netlify.toml). Makes a backup only if something has
// changed since the last one, and stores it in two places: the Firebase
// storage bucket and the private GitHub repository.
//
// Uses the same Firebase service account as the reminders
// (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) and the GitHub backup settings.
const { serviceAccount, accessToken, firestore, loadAll, uploadToBucket } = require('../lib/google');
const { putBackup } = require('../lib/github');
const { makeBackup } = require('../../src/v2/core/backup');
const { COLLECTIONS } = require('../../src/v2/core/books');
const { todayIST } = require('../../src/v2/core/util');

async function runBackup() {
  const sa = serviceAccount();
  const project = sa.project || process.env.REACT_APP_FIREBASE_PROJECT_ID;
  const token = await accessToken(sa);
  const db = firestore(project, token);
  const raw = await loadAll(db, COLLECTIONS);
  const total = COLLECTIONS.reduce((n, c) => n + raw[c].length, 0);
  if (!total) return { made: false, why: 'There is no data yet.' };
  const at = new Date().toISOString();
  const backup = makeBackup(raw, { by: 'automatic', at });
  const marker = raw.settings.find((s) => s.id === 'backup') || {};
  // "changed" is judged against the last backup this job made, in this job's own reading of the data
  if (marker.autoFingerprint === backup.fingerprint && (marker.bucket === 'ok' || marker.github === 'ok')) return { made: false, why: 'Nothing has changed since the last backup.' };

  const text = JSON.stringify(backup);
  const name = `fo-${todayIST()}-${at.slice(11, 19).replace(/:/g, '')}.json`;
  const bucket = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;
  const [inBucket, inGitHub] = await Promise.all([
    bucket ? uploadToBucket(token, bucket, `backups/${name}`, text).then(() => 'ok', (e) => e.message) : Promise.resolve('REACT_APP_FIREBASE_STORAGE_BUCKET is not set.'),
    putBackup(name, text).then(() => 'ok', (e) => e.message),
  ]);
  await db.set('fo_settings', 'backup', {
    id: 'backup', at, date: todayIST(), fingerprint: backup.fingerprint, autoFingerprint: inBucket === 'ok' || inGitHub === 'ok' ? backup.fingerprint : (marker.autoFingerprint || ''),
    bucket: inBucket, github: inGitHub, by: 'automatic (nightly)', size: text.length, name,
  });
  return { made: true, name, bucket: inBucket, github: inGitHub, records: total };
}

exports.handler = async () => {
  try {
    const result = await runBackup();
    console.log('backup:', JSON.stringify(result));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    console.error('backup failed:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
exports.runBackup = runBackup;
