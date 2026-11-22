// Photos kept with a harvest (slips) or a payment (receipts). A record holds a
// list `photos: [{ path, at, by }]`; records saved before that hold one
// `slipPath` or `photoPath`, which is read as the first photo with no time.
import { dayIST, fmtDate } from './util';

export function photosOf(rec) {
  const list = (rec?.photos || []).filter((p) => p && p.path);
  const legacy = rec?.slipPath || rec?.photoPath;
  if (legacy && !list.some((p) => p.path === legacy)) list.unshift({ path: legacy, at: '' });
  return list;
}

// "📷 22 Nov" or "📷 3 · last 22 Nov" for lists; '' when there is no photo.
export function photoBadge(rec) {
  const list = photosOf(rec);
  if (!list.length) return '';
  const last = list.map((p) => p.at).filter(Boolean).sort().pop();
  const when = last ? fmtDate(dayIST(last), { year: false }) : '';
  return list.length === 1 ? `📷 ${when || 'photo'}` : `📷 ${list.length}${when ? ' · last ' + when : ''}`;
}

// what is saved: the list, or nothing at all when it is empty
export const photosToSave = (list) => {
  const clean = (list || []).filter((p) => p && p.path).map((p) => ({ path: p.path, at: p.at || '', by: p.by || '' }));
  return clean.length ? clean : undefined;
};
