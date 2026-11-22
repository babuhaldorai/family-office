// Photos of harvest slips and payment receipts: shrunk on the device and kept in the storage bucket
// for reference. Nothing is read from the photo and nothing leaves Firebase.
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from '../../firebase';
import { uid } from '../core/util';

// Phone photos are several MB; 1600 px on the long side is plenty to read
// handwriting and keeps each photo to a few hundred KB.
export async function shrink(file, max = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('This photo could not be opened.');
  return blob;
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('No answer from the photo store after a minute. Check the internet connection and try again.')), ms))]);
const upload = async (path, blob) => { await withTimeout(uploadBytes(ref(getStorage(app), path), blob, { contentType: 'image/jpeg' }), 60000); return path; };

// folder: 'slips' for harvest slips, 'payments' for payment receipts.
// If the bucket's rules do not yet allow 'payments/' (storage.rules is published
// by hand), the photo is kept with the slip photos instead, so it is never lost.
export async function keepPhoto(blob, date, folder = 'slips') {
  const name = `${(date || 'undated').slice(0, 7)}/${date || 'undated'}-${uid()}.jpg`;
  if (folder === 'slips') return upload(`slips/${name}`, blob);
  try { return await upload(`${folder}/${name}`, blob); } catch (e) {
    if (e.code !== 'storage/unauthorized') throw e;
    return upload(`slips/${name.replace('/', '/' + folder + '-')}`, blob);
  }
}

export const photoError = (e) => (e.code === 'storage/unauthorized'
  ? 'The photo store refused it (storage/unauthorized). The storage rules in Firebase need publishing: Firebase console → Storage → Rules → paste storage.rules → Publish.'
  : e.code === 'storage/unknown' || e.code === 'storage/bucket-not-found' || e.code === 'storage/project-not-found'
    ? `The photo store is not set up (${e.code}). In the Firebase console, open Storage and press "Get started".`
    : e.code || e.message || 'unknown error');

export const photoUrl = (path) => getDownloadURL(ref(getStorage(app), path));
