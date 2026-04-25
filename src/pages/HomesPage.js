import React, { useEffect, useState, useMemo } from 'react';
import {
  homePropertyService, homeExpenseService, HOME_CATEGORIES,
} from '../utils/homeService';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X, Home } from 'lucide-react';
import { fmt } from '../utils/finance';

// ── Small modal ───────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Property modal ────────────────────────────────────────────────────────────
function PropertyModal({ open, onClose, onSave, initial }) {
  const empty = { name: '', address: '', notes: '' };
  const [form, setForm]   = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initial ? { ...empty, ...initial } : empty); }, [open]); // eslint-disable-line
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.name) return alert('Enter property name');
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Home' : 'Add Home'}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="form-group"><label>Property Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ooty House, Chennai Flat" /></div>
      <div className="form-group"><label>Address</label><textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} /></div>
      <div className="form-group"><label>Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
    </Modal>
  );
}

// ── Expense modal ─────────────────────────────────────────────────────────────
function ExpenseModal({ open, onClose, onSave, initial, properties }) {
  const empty = {
    date: new Date().toISOString().slice(0, 10),
    propertyId: '', category: HOME_CATEGORIES[0],
    amount: '', contractor: '', description: '',
  };
  const [form, setForm]   = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initial ? { ...empty, ...initial } : { ...empty, propertyId: properties[0]?.id || '' }); }, [open]); // eslint-disable-line
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.amount || !form.propertyId) return alert('Select a property and enter an amount');
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Expense' : 'Log Expense'}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="form-row">
        <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
        <div className="form-group"><label>Property *</label>
          <select value={form.propertyId} onChange={e => set('propertyId', e.target.value)}>
            <option value="">Select…</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {HOME_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Amount (₹) *</label><input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Contractor / Vendor</label><input value={form.contractor} onChange={e => set('contractor', e.target.value)} placeholder="Who did the work" /></div>
      <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const YEAR = new Date().getFullYear();
const YEARS = [YEAR - 2, YEAR - 1, YEAR];

export default function HomesPage() {
  const { isAdmin } = useAuth();
  const [properties, setProperties] = useState([]);
  const [expenses, setExpenses]     = useState([]);
  const [year, setYear]             = useState(YEAR);
  const [propFilter, setPropFilter] = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [tab, setTab]               = useState('expenses');
  const [propModal, setPropModal]   = useState({ open: false, initial: null });
  const [expModal, setExpModal]     = useState({ open: false, initial: null });
  const [loading, setLoading]       = useState(true);

  const load = async () => {
    setLoading(true);
    const [p, e] = await Promise.all([
      homePropertyService.getAll(),
      homeExpenseService.getAll(),
    ]);
    setProperties(p);
    setExpenses(e);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const propName = id => properties.find(p => p.id === id)?.name || '—';

  // Filter expenses
  const filtered = useMemo(() => {
    let e = expenses.filter(x => x.year === year || !x.year);
    if (propFilter) e = e.filter(x => x.propertyId === propFilter);
    if (catFilter)  e = e.filter(x => x.category  === catFilter);
    return e;
  }, [expenses, year, propFilter, catFilter]);

  // Stats
  const totalAll  = expenses.filter(x => x.year === year).reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalFilt = filtered.reduce((s, x) => s + Number(x.amount || 0), 0);

  // Per-property totals
  const propTotals = useMemo(() => properties.map(p => ({
    ...p,
    total:   expenses.filter(e => e.propertyId === p.id && e.year === year).reduce((s, e) => s + Number(e.amount || 0), 0),
    allTime: expenses.filter(e => e.propertyId === p.id).reduce((s, e) => s + Number(e.amount || 0), 0),
    count:   expenses.filter(e => e.propertyId === p.id && e.year === year).length,
  })).sort((a, b) => b.total - a.total), [properties, expenses, year]);

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = {};
    filtered.forEach(e => { const k = e.category || 'Other'; map[k] = (map[k] || 0) + Number(e.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const handleSaveProp = async (data) => {
    if (propModal.initial) await homePropertyService.update(propModal.initial.id, data);
    else                   await homePropertyService.add(data);
    load();
  };
  const handleSaveExp = async (data) => {
    if (expModal.initial) await homeExpenseService.update(expModal.initial.id, data);
    else                  await homeExpenseService.add(data);
    load();
  };
  const deleteProp = async (id) => {
    if (!window.confirm('Delete this property? Expenses will remain.')) return;
    await homePropertyService.delete(id); load();
  };
  const deleteExp = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await homeExpenseService.delete(id); load();
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏠 Home Maintenance & Maintenance</h1>
          <p className="page-subtitle">Track renovation and maintenance costs across all homes</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setPropModal({ open: true, initial: null })}>
              <Plus size={14} /> Add Home
            </button>
            <button className="btn btn-primary" onClick={() => setExpModal({ open: true, initial: null })}>
              <Plus size={14} /> Log Expense
            </button>
          </div>
        )}
      </div>

      <div className="page-body">

        {/* KPIs */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card expense">
            <div className="stat-label">Total Spent {year}</div>
            <div className="stat-value expense-text">{fmt(totalAll)}</div>
            <div className="stat-sub">All homes combined</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Homes Tracked</div>
            <div className="stat-value">{properties.length}</div>
            <div className="stat-sub">{expenses.filter(e => e.year === year).length} expense entries this year</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Largest Spend {year}</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>
              {propTotals[0]?.name || '—'}
            </div>
            <div className="stat-sub expense-text">{propTotals[0] ? fmt(propTotals[0].total) : '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">All-Time Total</div>
            <div className="stat-value">{fmt(expenses.reduce((s, e) => s + Number(e.amount || 0), 0))}</div>
            <div className="stat-sub">Across all years</div>
          </div>
        </div>

        {/* Per-property cards */}
        {properties.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 16, marginBottom: 24 }}>
            {propTotals.map(p => {
              const maxT = Math.max(...propTotals.map(x => x.total), 1);
              return (
                <div key={p.id} className="card" style={{ borderLeft: '3px solid var(--warn)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.name}</div>
                      {p.address && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{p.address}</div>}
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPropModal({ open: true, initial: p })}><Pencil size={11} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteProp(p.id)}><Trash2 size={11} /></button>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>
                    {fmt(p.total)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 8 }}>
                    {year} · {p.count} entries · All-time: {fmt(p.allTime)}
                  </div>
                  <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(p.total / maxT) * 100}%`, background: 'var(--warn)', borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${tab === 'expenses' ? 'active' : ''}`} onClick={() => setTab('expenses')}>Expense Log</button>
          <button className={`tab ${tab === 'breakdown' ? 'active' : ''}`} onClick={() => setTab('breakdown')}>By Category</button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="year-selector">
            {YEARS.map(y => <button key={y} className={year === y ? 'active' : ''} onClick={() => setYear(y)}>{y}</button>)}
          </div>
          <select style={{ maxWidth: 200 }} value={propFilter} onChange={e => setPropFilter(e.target.value)}>
            <option value="">All properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select style={{ maxWidth: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {HOME_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {tab === 'expenses' && (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Property</th><th>Category</th>
                    <th>Contractor</th><th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    {isAdmin && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                      No expenses recorded yet. Click "Log Expense" to start.
                    </td></tr>
                  )}
                  {filtered.map(e => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                      <td style={{ fontWeight: 500 }}>{propName(e.propertyId)}</td>
                      <td><span className="badge badge-vacant">{e.category}</span></td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{e.contractor || '—'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.82rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description || '—'}
                      </td>
                      <td className="amount-cell expense-text" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {fmt(e.amount)}
                      </td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setExpModal({ open: true, initial: e })}><Pencil size={12} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteExp(e.id)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length > 0 && (
                    <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                      <td colSpan={5} style={{ textAlign: 'right', color: 'var(--muted)', fontSize: '0.78rem' }}>TOTAL</td>
                      <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(totalFilt)}</td>
                      {isAdmin && <td />}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'breakdown' && (
          <div className="grid-2">
            {/* Category breakdown */}
            <div className="card">
              <div className="section-title">By Category — {year}</div>
              {catBreakdown.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No data for selected filters.</div>}
              {catBreakdown.map(([cat, amt]) => (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{cat}</span>
                    <span style={{ color: 'var(--danger)' }}>{fmt(amt)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${totalFilt > 0 ? (amt / totalFilt) * 100 : 0}%`, background: 'var(--warn)', borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
                    {totalFilt > 0 ? ((amt / totalFilt) * 100).toFixed(1) : 0}% of total
                  </div>
                </div>
              ))}
              {catBreakdown.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.875rem' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--danger)' }}>{fmt(totalFilt)}</span>
                </div>
              )}
            </div>

            {/* Per-property table */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '16px 20px 0', fontSize: '1rem', fontWeight: 600 }}>
                By Property — {year}
              </div>
              <table>
                <thead>
                  <tr><th>Property</th><th>Entries</th><th style={{ textAlign: 'right' }}>{year}</th><th style={{ textAlign: 'right' }}>All-Time</th></tr>
                </thead>
                <tbody>
                  {propTotals.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td style={{ color: 'var(--muted)' }}>{p.count}</td>
                      <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(p.total)}</td>
                      <td className="amount-cell" style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt(p.allTime)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                    <td>Total</td><td></td>
                    <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(totalAll)}</td>
                    <td className="amount-cell" style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt(expenses.reduce((s, e) => s + Number(e.amount || 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <PropertyModal
        open={propModal.open} initial={propModal.initial}
        onClose={() => setPropModal({ open: false, initial: null })}
        onSave={handleSaveProp}
      />
      <ExpenseModal
        open={expModal.open} initial={expModal.initial}
        onClose={() => setExpModal({ open: false, initial: null })}
        onSave={handleSaveExp}
        properties={properties}
      />
    </div>
  );
}
