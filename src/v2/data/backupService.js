// Where backups go. Two independent places: the Firebase storage bucket and a
// private GitHub repository (through a small server function that holds the
// GitHub key). Either can fail without stopping the other, and the result of
// each is recorded so Settings can show it.
import { getStorage, ref, uploadString, listAll, getBytes } from 'firebase/storage';
import app, { auth } from '../../firebase';
import { makeBackup, fingerprint } from '../core/backup';

const FOLDER = 'backups';
const storage = () => getStorage(app);

async function toBucket(name, json) {
  await uploadString(ref(storage(), `${FOLDER}/${name}`), json, 'raw', { contentType: 'application/json' });
}

async function toGitHub(name, json) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch('/.netlify/functions/backup-to-github', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ name, content: json }),
  });
  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch (e) { /* not JSON: the function is not deployed */ }
  if (!res.ok) {
    throw new Error(body.error || (res.status === 404
      ? 'The backup function is not on the site. In Netlify, check that Functions lists "backup-to-github" and redeploy.'
      : `The backup function failed (${res.status}). Check the function log in Netlify.`));
  }
  return body;
}

const short = (e) => String(e?.code || e?.message || e).replace('storage/', '').slice(0, 300);

// Makes a backup and sends it to both places. Returns what happened to each.
export async function runBackup(raw, { by, today, prefix = 'fo' }) {
  const at = new Date().toISOString();
  const backup = makeBackup(raw, { by, at });
  const json = JSON.stringify(backup);
  // one file per backup, never overwritten: date plus the time it was made
  const name = `${prefix}-${today}-${at.slice(11, 19).replace(/:/g, '')}.json`;
  const [bucket, github] = await Promise.all([
    toBucket(name, json).then(() => 'ok', short),
    toGitHub(name, json).then(() => 'ok', short),
  ]);
  return { marker: { id: 'backup', at, date: today, fingerprint: backup.fingerprint, bucket, github, by, size: json.length, name }, backup, json };
}

export const needsBackup = (raw, marker) => !marker || marker.fingerprint !== fingerprint(raw);

export async function listBucketBackups() {
  const res = await listAll(ref(storage(), FOLDER));
  return res.items.map((i) => i.name).filter((n) => n.endsWith('.json')).sort().reverse();
}

export async function readBucketBackup(name) {
  const bytes = await getBytes(ref(storage(), `${FOLDER}/${name}`));
  return JSON.parse(new TextDecoder().decode(bytes));
}
