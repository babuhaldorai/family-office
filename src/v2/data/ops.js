// What one change does to one record. Shared by the cloud store and the
// in-memory one so both behave identically.
//   { col, id, data }          replace the record
//   { col, id, patch }         change some fields
//   { col, id, remove: true }  move to the recycle bin (nothing is destroyed)
//   { col, id, restore: true } bring back from the recycle bin
//   { col, id, purge: true }   destroy for good (owner only, from the bin)
export function applyOp(op, before, { by, at }) {
  if (op.purge) return { after: null, action: 'purge' };
  if (op.remove) return { after: { ...(before || { id: op.id }), deleted: true, deletedAt: at, deletedBy: by }, action: 'delete' };
  if (op.restore) {
    const { deleted, deletedAt, deletedBy, ...rest } = before || { id: op.id };
    return { after: { ...rest, updatedAt: at, updatedBy: by }, action: 'restore' };
  }
  const base = op.patch ? { ...(before || { id: op.id }), ...op.patch } : { ...op.data };
  const after = { ...base, id: op.id, createdAt: before?.createdAt || base.createdAt || at, updatedAt: at, updatedBy: by };
  if (op.patch && before?.deleted) { after.deleted = true; }
  // Once a record brought in from the old app is changed here, it is no longer
  // refreshed by a later import (which would overwrite the change).
  if (!op.importing && (after.imported || before?.imported)) { after.imported = false; after.wasImported = true; }
  return { after, action: before && !before.deleted ? 'update' : before ? 'restore' : 'create' };
}

// Firestore refuses `undefined`; drop it (and private fields) before writing.
export function forCloud(v) {
  if (Array.isArray(v)) return v.map(forCloud);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).forEach((k) => { if (v[k] !== undefined && !k.startsWith('_')) out[k] = forCloud(v[k]); });
    return out;
  }
  return v;
}
