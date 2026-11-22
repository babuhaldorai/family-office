// Photos kept with a harvest (slips) or a payment (receipts). A record holds a
// list `photos: [{ path, at, by }]`; records saved before that hold one
// `slipPath` or `photoPath`, which is read as the first photo with no time.

export function photosOf(rec) {
  const list = (rec?.photos || []).filter((p) => p && p.path);
  const legacy = rec?.slipPath || rec?.photoPath;
  if (legacy && !list.some((p) => p.path === legacy)) list.unshift({ path: legacy, at: '' });
  return list;
}

// Lists show only a camera when an entry has a photo; the dates are on the entry itself.
export const photoBadge = (rec) => (photosOf(rec).length ? '📷' : '');

// what is saved: the list, or nothing at all when it is empty
export const photosToSave = (list) => {
  const clean = (list || []).filter((p) => p && p.path).map((p) => ({ path: p.path, at: p.at || '', by: p.by || '' }));
  return clean.length ? clean : undefined;
};
