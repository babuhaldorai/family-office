// Photos of harvest slips: shrink on the device, read the numbers through the
// server function, and keep the photo in the storage bucket.
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app, { auth } from '../../firebase';
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

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(new Error('This photo could not be read.'));
  r.readAsDataURL(blob);
});

export async function readSlip(blob) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch('/.netlify/functions/read-slip', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ image: await toBase64(blob), mediaType: 'image/jpeg' }),
  });
  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch (e) { /* not JSON: the function is missing or timed out */ }
  if (!res.ok) throw new Error(body.error || (res.status === 404 ? 'Reading slips is not installed on this site yet.' : `Reading the slip failed (${res.status}). It may have taken too long; try again.`));
  return body.slip;
}

export async function keepPhoto(blob, date) {
  const path = `slips/${(date || 'undated').slice(0, 7)}/${date || 'undated'}-${uid()}.jpg`;
  await uploadBytes(ref(getStorage(app), path), blob, { contentType: 'image/jpeg' });
  return path;
}

export const photoUrl = (path) => getDownloadURL(ref(getStorage(app), path));
