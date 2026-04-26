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

export function injectChaayaStyles() {}
.ch-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; }
.ch-kpi.green::before  { background: var(--success); }
.ch-kpi.gold::before   { background: var(--accent); }
.ch-kpi.rust::before   { background: var(--danger); }
.ch-kpi.earth::before  { background: var(--warn); }
.ch-kpi.blue::before   { background: var(--rental); }
.ch-kpi-label { font-size:0.7rem; font-weight:600; color:var(--muted); letter-spacing:.1em; text-transform:uppercase; margin-bottom:6px; }
.ch-kpi-value { font-family:var(--font-display); font-size:1.45rem; font-weight:600; color:var(--text); line-height:1; }
.ch-kpi-sub   { font-size:0.75rem; margin-top:4px; color:var(--muted); }
.ch-kpi-sub.up   { color: var(--success); }
.ch-kpi-sub.down { color: var(--danger); }

/* Tabs — match global .tabs style */
.ch-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.ch-tab {
  padding: 10px 16px;
  border-radius: 0;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted);
  transition: all .15s;
  white-space: nowrap;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: none;
  font-family: var(--font-body);
}
.ch-tab:hover  { color: var(--text); }
.ch-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* Cards — match global .card */
.ch-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 18px;
}
.ch-card-title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 14px;
}
.ch-card-sub { font-size:0.78rem; color:var(--muted); margin-top:-10px; margin-bottom:14px; }

/* Table — match global table styles */
.ch-table { width:100%; border-collapse:collapse; font-size:0.875rem; }
.ch-table th {
  padding: 10px 12px;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .08em;
  border-bottom: 1px solid var(--border2);
  white-space: nowrap;
}
.ch-table td { padding:11px 12px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle; }
.ch-table tr:last-child td { border-bottom:none; }
.ch-table tbody tr:hover td { background: var(--surface2); }

/* Forms — match global inputs */
.ch-form-group { display:flex; flex-direction:column; gap:5px; margin-bottom:16px; }
.ch-form-group label { font-size:0.78rem; font-weight:500; color:var(--muted); }
.ch-input {
  padding: 9px 12px;
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--text);
  background: var(--surface2);
  outline: none;
  transition: border-color .15s;
  width: 100%;
}
.ch-input:focus { border-color: var(--accent); }
.ch-input:disabled { opacity:.4; cursor:not-allowed; }
.ch-input option { background: var(--surface2); }

/* Grids */
.ch-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.ch-grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
.ch-grid-4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:16px; }

/* Buttons — match global .btn */
.ch-btn {
  padding: 8px 16px;
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all .15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ch-btn-primary { background: var(--accent); color: #0f1117; }
.ch-btn-primary:hover { background: var(--accent2); }
.ch-btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.ch-btn-secondary { background: transparent; color: var(--muted); border: 1px solid var(--border2); }
.ch-btn-secondary:hover { color: var(--text); background: var(--surface2); }
.ch-btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
.ch-btn-danger:hover { background: rgba(224,92,92,.1); }
.ch-btn-edit { background: rgba(74,111,165,.15); color: var(--rental-light); border: none; }
.ch-btn-edit:hover { background: rgba(74,111,165,.25); }
.ch-btn-sm  { padding:5px 10px; font-size:0.78rem; border-radius:6px; }
.ch-btn-xs  { padding:2px 6px;  font-size:0.7rem;  border-radius:4px; }

/* Badges — match global .badge */
.ch-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:20px; font-size:0.7rem; font-weight:600; letter-spacing:.04em; }
.ch-badge-green  { background:rgba(76,175,128,.15); color:var(--success); }
.ch-badge-gold   { background:rgba(201,168,76,.15);  color:var(--accent); }
.ch-badge-rust   { background:rgba(224,92,92,.15);   color:var(--danger); }
.ch-badge-earth  { background:rgba(224,146,74,.15);  color:var(--warn); }
.ch-badge-muted  { background:var(--surface2); color:var(--muted); }
.ch-badge-blue   { background:rgba(74,111,165,.2); color:var(--rental-light); }

/* Bag builder */
.ch-bag-builder { border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; margin-bottom:14px; }
.ch-bag-header {
  background: var(--surface2);
  padding: 9px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}
.ch-bag-col-labels {
  display: grid;
  grid-template-columns: 34px 1fr 1fr 1fr 60px 80px 32px;
  gap: 7px;
  padding: 8px 14px 0;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .05em;
  text-align: center;
}
.ch-bag-list {
  padding: 8px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 280px;
  overflow-y: auto;
}
.ch-bag-row { display:grid; grid-template-columns:34px 1fr 1fr 1fr 60px 80px 32px; gap:7px; align-items:center; }
.ch-bag-num {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  text-align: center;
  background: var(--surface);
  border-radius: 6px;
  padding: 7px 0;
  border: 1px solid var(--border);
}
.ch-bag-net {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--success);
  font-weight: 500;
  text-align: center;
  padding: 7px 4px;
  background: rgba(76,175,128,.08);
  border-radius: 6px;
}
.ch-bag-footer {
  background: var(--surface2);
  padding: 9px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Calc preview box */
.ch-calc-box {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 2;
}

/* Rate banner */
.ch-rate-banner {
  background: rgba(74,124,89,.1);
  border: 1px solid rgba(74,124,89,.25);
  border-radius: var(--radius);
  padding: 10px 14px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
}
.ch-rate-banner.no-rate { background:rgba(224,92,92,.07); border-color:rgba(224,92,92,.25); }

/* Period filter bar */
.ch-period-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 10px 14px;
  margin-bottom: 18px;
}
.ch-period-btn {
  padding: 5px 13px;
  border-radius: var(--radius);
  border: 1px solid var(--border2);
  background: transparent;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: all .15s;
}
.ch-period-btn:hover  { background: var(--surface2); color: var(--text); }
.ch-period-btn.active { background: var(--accent); color: #0f1117; border-color: var(--accent); }

/* Entity cards */
.ch-entity-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
}
.ch-entity-avatar {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: rgba(74,124,89,.2);
  border: 1px solid rgba(74,124,89,.3);
  color: var(--tea-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 600;
  flex-shrink: 0;
}
.ch-entity-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:18px; }

/* Settlement rows */
.ch-settle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.875rem;
}
.ch-settle-row:last-child { border-bottom: none; }
.ch-total-row {
  background: var(--surface2);
  border-radius: var(--radius);
  padding: 9px 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

/* Pending panel */
.ch-pending-panel {
  background: rgba(74,124,89,.07);
  border: 1px solid rgba(74,124,89,.2);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  margin-bottom: 16px;
}

/* Alert boxes */
.ch-alert-info {
  background: rgba(74,124,89,.08);
  border: 1px solid rgba(74,124,89,.2);
  color: var(--tea-light);
  border-radius: var(--radius);
  padding: 11px 15px;
  font-size: 0.85rem;
  margin-bottom: 12px;
}
.ch-alert-warn {
  background: rgba(224,146,74,.08);
  border: 1px solid rgba(224,146,74,.2);
  color: var(--warn);
  border-radius: var(--radius);
  padding: 11px 15px;
  font-size: 0.85rem;
  margin-bottom: 12px;
}

/* Modal overlay — match global .modal-overlay */
.ch-modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.65);
  z-index: 600;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.ch-modal-overlay.open { display: flex; }
.ch-modal {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--radius-lg);
  padding: 24px 28px;
  width: 560px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow);
}
.ch-modal-title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 18px;
}
.ch-modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* Responsive */
@media(max-width:1100px) {
  .ch-kpi-grid { grid-template-columns:repeat(2,1fr); }
  .ch-entity-grid { grid-template-columns:repeat(2,1fr); }
  .ch-grid-4 { grid-template-columns:1fr 1fr; }
}
@media(max-width:768px) {
  .ch-kpi-grid,.ch-grid-2,.ch-grid-3,.ch-grid-4,.ch-entity-grid { grid-template-columns:1fr; }
  .ch-bag-col-labels,.ch-bag-row { grid-template-columns:28px 1fr 1fr 1fr 50px 60px 24px; }
}
  `;
  document.head.appendChild(el);
}

export function currentWeekLabel() {
  const now = new Date(), day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return mon.toISOString().slice(0, 10) + ' → ' + sun.toISOString().slice(0, 10);
}
