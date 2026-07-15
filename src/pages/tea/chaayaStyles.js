// Tea section — constants and helpers.
// All CSS is in src/styles/global.css (injected at build time, no runtime injection needed).

export const TABS = [
  { key: 'dashboard',       label: '⌂ Dashboard' },
  { key: 'harvest',         label: '❧ Harvest Log' },
  { key: 'advances',        label: '⇄ Advances' },
  { key: 'maintenance',     label: '⚙ Maintenance' },
  { key: 'analytics',       label: '◎ Analytics' },
  { key: 'agent_analytics', label: '⚖ Agent Analytics' },
  { key: 'people',          label: '◉ People & Fields' },
  { key: 'weather',         label: '☁ Weather' },
];

// Sub-tabs inside the consolidated "Harvest Log" tab.
export const HARVEST_SUBTABS = [
  { key: 'log',     label: 'Log Harvest' },
  { key: 'ratepay', label: 'Rate & Payments' },
  { key: 'rates',   label: 'Market Rates' },
  { key: 'worker',  label: 'Worker Payments' },
  { key: 'agent',   label: 'Agent Payments' },
];

export const PERIOD_OPTS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd',        label: 'YTD' },
  { key: 'last_year',  label: 'Last Year' },
  { key: 'all',        label: 'All Time' },
];

export const C = {
  forest: 'var(--tea)',
  canopy: 'var(--tea-light)',
  leaf:   'var(--success)',
  mist:   'var(--text)',
  parch:  'var(--surface2)',
  cream:  'var(--surface)',
  sand:   'var(--surface2)',
  earth:  'var(--warn)',
  rust:   'var(--danger)',
  gold:   'var(--accent)',
  ink:    'var(--text)',
  muted:  'var(--muted)',
  faint:  'var(--muted)',
  line:   'var(--border)',
};

export const AGENT_COLORS = [
  'var(--danger)',
  'var(--accent)',
  'var(--tea-light)',
  'var(--rental-light)',
  '#a78bfa',
];

// No-op — styles are in global.css
export function injectChaayaStyles() {}

export function currentWeekLabel() {
  const now = new Date(), day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return mon.toISOString().slice(0, 10) + ' → ' + sun.toISOString().slice(0, 10);
}
