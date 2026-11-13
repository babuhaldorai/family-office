// Backup and restore, as plain data. A backup is one JSON object holding every
// record (including ones in the recycle bin). Restoring makes the app equal to
// the backup: records in the backup are written back, and records created
// after it go to the recycle bin rather than being destroyed.
import { COLLECTIONS, buildBooks } from './books';
import { stableStringify, checksum, sum, toCSV, fmtDate } from './util';
import { MODE_LABEL, DIFF_LABEL } from './books';

export const BACKUP_APP = 'family-office';
export const BACKUP_VERSION = 2;

// fields that change on every write and say nothing about the content
const strip = (doc) => { const { _pending, ...rest } = doc; return rest; };
// the record of the last backup must not itself count as a change
const isBackupMarker = (col, doc) => col === 'settings' && doc.id === 'backup';

const sorted = (raw, { forFingerprint = false } = {}) => {
  const out = {};
  COLLECTIONS.forEach((c) => {
    out[c] = (raw[c] || [])
      .filter((d) => d && d.id && !(forFingerprint && isBackupMarker(c, d)))
      .map(strip)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  });
  return out;
};

// Same data -> same fingerprint. Used to skip the backup when nothing changed.
export const fingerprint = (raw) => checksum(stableStringify(sorted(raw, { forFingerprint: true })));

export function makeBackup(raw, { by = '', at = new Date().toISOString() } = {}) {
  const collections = sorted(raw);
  return {
    app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: at, exportedBy: by,
    fingerprint: fingerprint(raw),
    counts: Object.fromEntries(COLLECTIONS.map((c) => [c, collections[c].length])),
    collections,
  };
}

export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return 'This file is not a backup.';
  if (obj.app !== BACKUP_APP || obj.version !== BACKUP_VERSION) return 'This file is not a backup made by this version of the app.';
  if (!obj.collections || typeof obj.collections !== 'object') return 'The backup has no data in it.';
  for (const c of Object.keys(obj.collections)) {
    if (!Array.isArray(obj.collections[c])) return `The backup is damaged (${c}).`;
    if (obj.collections[c].some((d) => !d || !d.id)) return `The backup is damaged (a record in ${c} has no id).`;
  }
  if (obj.fingerprint && obj.fingerprint !== fingerprint(obj.collections)) return 'The backup file was changed after it was made, so it cannot be trusted.';
  return null;
}

const summary = (raw, today) => {
  const b = buildBooks(raw, today);
  const p = b.pnl({ from: '0000-01-01', to: '9999-12-31' });
  return {
    netKg: b.totals.netKg, deliveries: b.deliveries.length, entries: b.entries.length,
    moneyIn: p.cashIn, moneyOut: p.cashOut, checksOk: b.ok,
    failing: b.checks.filter((c) => !c.ok).map((c) => c.name),
  };
};

// What restoring `backup` over `current` would do. `only` limits it to some collections.
export function planRestore(current, backup, today, { only = null } = {}) {
  const cols = COLLECTIONS.filter((c) => !only || only.includes(c));
  const ops = [];
  const perCollection = [];
  const after = {};
  COLLECTIONS.forEach((c) => { after[c] = (current[c] || []).map(strip); });
  cols.forEach((c) => {
    const now = new Map((current[c] || []).map((d) => [d.id, strip(d)]));
    const then = new Map((backup.collections[c] || []).map((d) => [d.id, d]));
    let add = 0, change = 0, remove = 0, same = 0;
    then.forEach((doc, id) => {
      if (isBackupMarker(c, doc)) return;
      if (!now.has(id)) { add += 1; ops.push({ col: c, id, data: doc, why: 'restore' }); }
      else if (stableStringify(now.get(id)) !== stableStringify(doc)) { change += 1; ops.push({ col: c, id, data: doc, why: 'restore' }); }
      else same += 1;
    });
    now.forEach((doc, id) => {
      if (then.has(id) || isBackupMarker(c, doc)) return;
      if (doc.deleted) { same += 1; return; }
      remove += 1;
      ops.push({ col: c, id, remove: true, why: 'restore' });
    });
    perCollection.push({ col: c, add, change, remove, same });
    const merged = new Map(now);
    then.forEach((doc, id) => { if (!isBackupMarker(c, doc)) merged.set(id, doc); });
    now.forEach((doc, id) => { if (!then.has(id) && !isBackupMarker(c, doc)) merged.set(id, { ...doc, deleted: true }); });
    after[c] = [...merged.values()];
  });
  return {
    ops, perCollection,
    totalChanges: sum(perCollection, (r) => r.add + r.change + r.remove),
    before: summary(current, today), after: summary(after, today),
  };
}

// ── Spreadsheet downloads (CSV opens directly in Excel) ─────────────────────
export function entriesCSV(books, entries) {
  const head = ['Date', 'With', 'For', 'Money in', 'Money out', 'How', 'Handled by', 'Expected', 'Difference', 'Reason', 'Comment', 'Business', 'Type'];
  const rows = entries.map((e) => [
    fmtDate(e.date), e.party, e.forText, e.dir === 'in' ? e.amount : '', e.dir === 'out' ? e.amount : '',
    MODE_LABEL[e.mode] || '', e.by || '', e.expected ?? '', e.diff || '', DIFF_LABEL[e.diffReason] || '',
    [e.diffComment, e.note].filter(Boolean).join(' · '), e.business, e.cat,
  ]);
  return toCSV([head, ...rows]);
}

export function deliveriesCSV(books, deliveries) {
  const head = ['Date', 'Field', 'Agent', 'Bags', 'Weighed kg', 'Deducted for bags', 'Deducted for water', 'Net kg', 'Rate', 'From agent', 'Wages', 'Rain mm', 'Workers', 'Status'];
  const rows = deliveries.map((d) => [
    fmtDate(d.date), d.fieldName, d.agentName, d.bags.length, d.gross, d.bagDed, d.waterDed, d.net,
    d.rate ?? '', d.value ?? '', d.wages, d.rainMm ?? '',
    d.workers.map((w) => `${books.nameOf(w.workerId)} ${w.netKg}kg ${w.wage}`).join('; '), d.agentStatus,
  ]);
  return toCSV([head, ...rows]);
}
