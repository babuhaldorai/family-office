// Photos of harvest slips: shrunk on the device and kept in the storage bucket
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

export async function keepPhoto(blob, date) {
  const path = `slips/${(date || 'undated').slice(0, 7)}/${date || 'undated'}-${uid()}.jpg`;
  await uploadBytes(ref(getStorage(app), path), blob, { contentType: 'image/jpeg' });
  return path;
}

export const photoUrl = (path) => getDownloadURL(ref(getStorage(app), path));
