// All colours reference the global CSS variables so Tea pages
// automatically match the dark theme of the rest of the app.

export const TABS = [
  { key: 'dashboard',       label: '⌂ Dashboard' },
  { key: 'harvest',         label: '❧ Log Harvest' },
  { key: 'settlements',     label: '₹ Settlements' },
  { key: 'advances',        label: '⇄ Advances' },
  { key: 'maintenance',     label: '⚙ Maintenance' },
  { key: 'rates',           label: '◇ Market Rates' },
  { key: 'analytics',       label: '◎ Analytics' },
  { key: 'agent_analytics', label: '⚖ Agent Analytics' },
  { key: 'people',          label: '◉ People & Fields' },
  { key: 'weather',         label: '☁ Weather' },
];

export const PERIOD_OPTS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd',        label: 'YTD' },
  { key: 'last_year',  label: 'Last Year' },
  { key: 'all',        label: 'All Time' },
];

// Colour shortcuts that map to global vars (used inline in JS)
export const C = {
  forest:  'var(--tea)',
  canopy:  'var(--tea-light)',
  leaf:    'var(--success)',
  mist:    'var(--text)',
  parch:   'var(--surface2)',
  cream:   'var(--surface)',
  sand:    'var(--surface2)',
  earth:   'var(--warn)',
  rust:    'var(--danger)',
  gold:    'var(--accent)',
  ink:     'var(--text)',
  muted:   'var(--muted)',
  faint:   'var(--muted)',
  line:    'var(--border)',
};

export const AGENT_COLORS = [
  'var(--danger)',
  'var(--accent)',
  'var(--tea-light)',
  'var(--rental-light)',
  '#a78bfa',
];

let injected = false;
export function injectChaayaStyles() { /* styles now in global.css */ }
export function currentWeekLabel() {
  const now = new Date(), day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return mon.toISOString().slice(0, 10) + ' → ' + sun.toISOString().slice(0, 10);
}
