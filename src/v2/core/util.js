// Small helpers shared by everything in v2. No Firebase, no React.

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const sum = (arr, f = (x) => x) => r2((arr || []).reduce((s, x) => s + (Number(f(x)) || 0), 0));

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// ── Money ────────────────────────────────────────────────────────────────────
// Indian grouping. Paise are shown only when the amount is not a whole rupee.
export function inr(n, { sign = false } = {}) {
  const v = r2(n);
  const abs = Math.abs(v);
  const whole = Math.abs(abs - Math.round(abs)) < 0.005;
  const s = abs.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  const prefix = v < 0 ? '−' : sign && v > 0 ? '+' : '';
  return `${prefix}₹${s}`;
}

export const kg = (n, d = 1) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

// ── Dates ────────────────────────────────────────────────────────────────────
// All business dates are plain 'YYYY-MM-DD' strings in India time, whatever
// country the person entering them is in.
export function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parts = (d) => String(d || '').slice(0, 10).split('-').map(Number);
const toUTC = (d) => { const [y, m, dd] = parts(d); return Date.UTC(y, (m || 1) - 1, dd || 1); };
const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);

export const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !Number.isNaN(toUTC(d));

// '2026-11-13' -> '13 Nov 2026'. Never ambiguous between India and the US.
export function fmtDate(d, { year = true, dow = false } = {}) {
  if (!isDate(d)) return '';
  const [y, m, dd] = parts(d);
  const w = dow ? DOW[new Date(toUTC(d)).getUTCDay()] + ' ' : '';
  return `${w}${dd} ${MON[m - 1]}${year ? ' ' + y : ''}`;
}

export const addDays = (d, n) => fromUTC(toUTC(d) + n * 86400000);
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const monthKey = (d) => String(d || '').slice(0, 7);
export const fmtMonth = (mk, { year = true } = {}) => {
  const [y, m] = String(mk).split('-').map(Number);
  return `${MON[(m || 1) - 1]}${year ? ' ' + y : ''}`;
};
export function addMonths(d, n) {
  const [y, m, dd] = parts(d);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(dd, last));
  return t.toISOString().slice(0, 10);
}
export function monthsFrom(startMk, endMk) {
  const out = [];
  let cur = startMk + '-01';
  const end = endMk + '-01';
  let guard = 0;
  while (cur <= end && guard++ < 600) { out.push(monthKey(cur)); cur = addMonths(cur, 1); }
  return out;
}

// Indian financial year (Apr–Mar) containing the date.
export function fyBounds(d) {
  const [y, m] = parts(d);
  const start = m >= 4 ? y : y - 1;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31`, label: `Apr ${start} – Mar ${start + 1}` };
}

export function periodFor(preset, today) {
  const mk = monthKey(today);
  switch (preset) {
    case 'month': return { from: mk + '-01', to: addDays(addMonths(mk + '-01', 1), -1), label: fmtMonth(mk) };
    case 'lastMonth': {
      const p = monthKey(addMonths(mk + '-01', -1));
      return { from: p + '-01', to: addDays(mk + '-01', -1), label: fmtMonth(p) };
    }
    case 'year': return fyBounds(today);
    case 'lastYear': return fyBounds(addMonths(fyBounds(today).from, -6));
    case 'all': default: return { from: '2000-01-01', to: '2099-12-31', label: 'All time' };
  }
}

export const inRange = (d, p) => !!d && d >= p.from && d <= p.to;

export const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || String(b.id).localeCompare(String(a.id));
export const byDateAsc = (a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id).localeCompare(String(b.id));

export const groupBy = (arr, f) => {
  const m = new Map();
  (arr || []).forEach((x) => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return m;
};

// Deterministic JSON (sorted keys) so the same data always gives the same text.
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined)
    .map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

// Small non-cryptographic checksum (FNV-1a) used to tell "data changed" from "no change".
export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0') + '-' + str.length;
}

export function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
