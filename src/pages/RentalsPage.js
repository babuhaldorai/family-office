import RentalYOY from './RentalYOY';
import React, { useEffect, useState, useMemo } from 'react';
import { propertyService, tenantService, rentalService } from '../utils/firestoreService';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X, Home } from 'lucide-react';
import { fmt } from '../utils/finance';

const YEAR  = new Date().getFullYear();
const YEARS = [YEAR - 2, YEAR - 1, YEAR];

// ── Generic modal shell ───────────────────────────────────────────────────────
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
  const empty = { name: '', address: '', type: 'Residential', monthlyRent: '', description: '' };
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
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Property' : 'Add Property'}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="form-group"><label>Property Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Green View Apt 2B" /></div>
      <div className="form-group"><label>Address</label><textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} /></div>
      <div className="form-row">
        <div className="form-group"><label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            {['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Other'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Expected Rent / Month (₹)</label>
          <input type="number" value={form.monthlyRent} onChange={e => set('monthlyRent', e.target.value)} />
        </div>
      </div>
      <div className="form-group"><label>Notes</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
    </Modal>
  );
}

// ── Tenant modal ──────────────────────────────────────────────────────────────
function TenantModal({ open, onClose, onSave, initial, properties }) {
  const empty = { name: '', email: '', phone: '', propertyId: '', leaseStart: '', leaseEnd: '', monthlyRent: '', deposit: '', status: 'active', notes: '' };
  const [form, setForm]   = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initial ? { ...empty, ...initial } : { ...empty, propertyId: properties[0]?.id || '' }); }, [open]); // eslint-disable-line
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.name) return alert('Enter tenant name');
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Tenant' : 'Add Tenant'}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="form-row">
        <div className="form-group"><label>Full Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="form-group"><label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="notice">Notice Period</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Property</label>
        <select value={form.propertyId} onChange={e => set('propertyId', e.target.value)}>
          <option value="">Select property…</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Lease Start</label><input type="date" value={form.leaseStart} onChange={e => set('leaseStart', e.target.value)} /></div>
        <div className="form-group"><label>Lease End</label><input type="date" value={form.leaseEnd} onChange={e => set('leaseEnd', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Monthly Rent (₹)</label><input type="number" value={form.monthlyRent} onChange={e => set('monthlyRent', e.target.value)} /></div>
        <div className="form-group"><label>Security Deposit (₹)</label><input type="number" value={form.deposit} onChange={e => set('deposit', e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
    </Modal>
  );
}

// ── Transaction modal ─────────────────────────────────────────────────────────
const INCOME_CATS  = ['Rent', 'Security Deposit', 'Late Fee', 'Other'];
const EXPENSE_CATS = ['Maintenance', 'Repair', 'Property Tax', 'Insurance', 'Water/Electricity', 'Management Fee', 'Legal', 'Other'];

function TransactionModal({ open, onClose, onSave, initial, properties }) {
  const empty = { date: new Date().toISOString().slice(0, 10), type: 'income', category: '', amount: '', propertyId: '', description: '' };
  const [form, setForm]   = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initial ? { ...empty, ...initial } : empty); }, [open]); // eslint-disable-line
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const save = async () => {
    if (!form.amount || !form.category) return alert('Fill amount and category');
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Transaction' : 'Add Transaction'}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="form-row">
        <div className="form-group"><label>Type</label>
          <select value={form.type} onChange={e => { set('type', e.target.value); set('category', ''); }}>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">Select…</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Amount (₹)</label>
          <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>
      </div>
      <div className="form-group"><label>Property</label>
        <select value={form.propertyId} onChange={e => set('propertyId', e.target.value)}>
          <option value="">All / General</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
    </Modal>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function Bar({ value, max, color = 'var(--rental-light)' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginTop: 5 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s' }} />
    </div>
  );
}

// ── Main RentalsPage ──────────────────────────────────────────────────────────
export default function RentalsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab]             = useState('overview');
  const [period, setPeriod]         = useState('all');
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [year, setYear]             = useState(YEAR);
  const [propFilter, setPropFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [loading, setLoading]       = useState(true);

  // Modals
  const [propModal,  setPropModal]  = useState({ open: false, initial: null });
  const [tenantModal, setTenantModal] = useState({ open: false, initial: null });
  const [txModal,    setTxModal]    = useState({ open: false, initial: null });

  const load = async () => {
    setLoading(true);
    const [p, t, tx] = await Promise.all([
      propertyService.getAll(),
      tenantService.getAll(),
      rentalService.getTransactions(year),
    ]);
    setProperties(p); setTenants(t); setTransactions(tx);
    setLoading(false);
  };
  useEffect(() => { load(); }, [year]); // eslint-disable-line

  // Lookups
  const propName = id => properties.find(p => p.id === id)?.name || '—';
  const activeTenantFor = pid => tenants.find(t => t.propertyId === pid && t.status === 'active');

  // Summaries
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const occupied = properties.filter(p => activeTenantFor(p.id)).length;
  const expectedRent = properties.reduce((s, p) => s + Number(p.monthlyRent || 0), 0);

  // Per-property income for overview
  const propStats = useMemo(() => properties.map(p => {
    const pTx      = transactions.filter(t => t.propertyId === p.id);
    const pIncome  = pTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const pExpense = pTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const tenant   = activeTenantFor(p.id);
    const daysLeft = p.monthlyRent && tenant?.leaseEnd
      ? Math.ceil((new Date(tenant.leaseEnd) - new Date()) / 86400000)
      : null;
    return { ...p, pIncome, pExpense, tenant, daysLeft };
  }), [properties, transactions, tenants]);

  // Period filter for overview
  const periodBounds = useMemo(() => {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const fmt2 = d => d.toISOString().slice(0, 10);
    switch (period) {
      case 'this_month': return { from: fmt2(new Date(y, m, 1)),     to: fmt2(new Date(y, m + 1, 0)) };
      case 'last_month': return { from: fmt2(new Date(y, m - 1, 1)), to: fmt2(new Date(y, m, 0))     };
      case 'ytd':        return { from: `${y}-01-01`,                to: fmt2(now)                   };
      case 'last_year':  return { from: `${y-1}-01-01`,              to: `${y-1}-12-31`              };
      default:           return { from: '2000-01-01',                to: '2099-12-31'                };
    }
  }, [period]);

  const periodLabel = useMemo(() => {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    switch (period) {
      case 'this_month': return new Date(y, m, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      case 'last_month': return new Date(y, m-1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      case 'ytd':        return `Jan – ${now.toLocaleString('en-IN', { month: 'short' })} ${y} (YTD)`;
      case 'last_year':  return `${y - 1} (full year)`;
      default:           return 'All Time';
    }
  }, [period]);

  // How many months does the current period span? Used for expected rent scaling
  const periodMonths = useMemo(() => {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    switch (period) {
      case 'this_month': return 1;
      case 'last_month': return 1;
      case 'ytd':        return m + 1; // Jan=1, Feb=2, etc.
      case 'last_year':  return 12;
      default:           return 12;    // All time — use 12 as baseline
    }
  }, [period]);

  // Period-filtered income/expense for property cards
  const periodTx = useMemo(() => transactions.filter(t =>
    (!t.date || (t.date >= periodBounds.from && t.date <= periodBounds.to))
  ), [transactions, periodBounds]);

  const periodPropStats = useMemo(() => properties.map(p => {
    const pTx     = periodTx.filter(t => t.propertyId === p.id);
    const pIncome = pTx.filter(t => t.type === 'income').reduce((s, t)  => s + Number(t.amount), 0);
    const pExpense= pTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const tenant  = activeTenantFor(p.id);
    const daysLeft= tenant?.leaseEnd ? Math.ceil((new Date(tenant.leaseEnd) - new Date()) / 86400000) : null;
    return { ...p, pIncome, pExpense, tenant, daysLeft };
  }), [properties, periodTx]);

  const periodIncome  = periodTx.filter(t => t.type === 'income').reduce((s, t)  => s + Number(t.amount), 0);
  const periodExpense = periodTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  // Filtered transactions
  const filteredTx = useMemo(() => {
    let t = transactions;
    if (propFilter) t = t.filter(x => x.propertyId === propFilter);
    return t;
  }, [transactions, propFilter]);

  // Filtered tenants
  const filteredTenants = useMemo(() => {
    if (tenantFilter === 'all') return tenants;
    return tenants.filter(t => t.status === tenantFilter);
  }, [tenants, tenantFilter]);

  const daysUntilExpiry = end => {
    if (!end) return null;
    return Math.ceil((new Date(end) - new Date()) / 86400000);
  };

  const handleSaveProp = async d => {
    if (propModal.initial) await propertyService.update(propModal.initial.id, d);
    else await propertyService.add(d);
    load();
  };
  const handleSaveTenant = async d => {
    if (tenantModal.initial) await tenantService.update(tenantModal.initial.id, d);
    else await tenantService.add(d);
    load();
  };
  const handleSaveTx = async d => {
    if (txModal.initial) await rentalService.update(txModal.initial.id, d);
    else await rentalService.add(d);
    load();
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title"><Home size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--rental-light)' }} />Rental Homes</h1>
          <p className="page-subtitle">{properties.length} properties · {occupied} occupied · {properties.length - occupied} vacant</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            {tab === 'properties'   && <button className="btn btn-primary" onClick={() => setPropModal({ open: true, initial: null })}><Plus size={14} /> Add Property</button>}
            {tab === 'tenants'      && <button className="btn btn-primary" onClick={() => setTenantModal({ open: true, initial: null })}><Plus size={14} /> Add Tenant</button>}
            {tab === 'transactions' && <button className="btn btn-primary" onClick={() => setTxModal({ open: true, initial: null })}><Plus size={14} /> Add Transaction</button>}
          </div>
        )}
      </div>

      <div className="page-body">

        {/* Period filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px' }}>
          {[['all','All Time'],['this_month','This Month'],['last_month','Last Month'],['ytd','YTD'],['last_year','Last Year']].map(([k,l]) => (
            <button key={k} style={{ padding: '5px 13px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', background: period === k ? 'var(--accent)' : 'transparent', color: period === k ? '#0f1117' : 'var(--muted)', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all .15s' }}
              onClick={() => setPeriod(k)}>{l}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>{periodLabel}</span>
        </div>

        {/* KPI strip */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card income">
            <div className="stat-label">Rent Income — {periodLabel}</div>
            <div className="stat-value income-text">{fmt(periodIncome)}</div>
            <div className="stat-sub">{periodTx.filter(t => t.type === 'income').length} entries</div>
          </div>
          <div className="stat-card expense">
            <div className="stat-label">Expenses — {periodLabel}</div>
            <div className="stat-value expense-text">{fmt(periodExpense)}</div>
          </div>
          <div className="stat-card net">
            <div className="stat-label">Net — {periodLabel}</div>
            <div className="stat-value" style={{ color: periodIncome - periodExpense >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(periodIncome - periodExpense)}</div>
          </div>
          <div className="stat-card rental">
            <div className="stat-label">Expected Monthly</div>
            <div className="stat-value">{fmt(expectedRent)}</div>
            <div className="stat-sub">{occupied}/{properties.length} occupied</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            ['overview',     '⌂ Overview'],
            ['properties',   '🏠 Properties'],
            ['tenants',      '👥 Tenants'],
            ['transactions', '₹ Transactions'],
            ['yoy',          '📈 YOY'],
          ].map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab === 'overview' && (
          <div>
            {/* Property cards */}
            {propStats.length === 0 ? (
              <div className="empty-state"><p>No properties yet. Add your first property.</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, marginBottom: 24 }}>
                {periodPropStats.map(p => (
                  <div key={p.id} className="card segment-rental">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</div>
                        {p.address && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{p.address}</div>}
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{p.type}</div>
                      </div>
                      <span className={`badge ${p.tenant ? 'badge-active' : 'badge-vacant'}`}>
                        {p.tenant ? 'Occupied' : 'Vacant'}
                      </span>
                    </div>
                    {p.tenant && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 10, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6 }}>
                        <strong style={{ color: 'var(--text)' }}>{p.tenant.name}</strong>
                        {p.tenant.leaseEnd && (
                          <span style={{ marginLeft: 8, color: p.daysLeft !== null && p.daysLeft < 30 ? 'var(--warn)' : 'var(--muted)' }}>
                            · Lease ends {p.tenant.leaseEnd}
                            {p.daysLeft !== null && ` (${p.daysLeft < 0 ? `${Math.abs(p.daysLeft)}d overdue` : `${p.daysLeft}d`})`}
                          </span>
                        )}
                      </div>
                    )}
                    {[
                      ['Expected Rent', fmt(Number(p.monthlyRent) || 0) + '/mo · ' + fmt(Number(p.monthlyRent) * periodMonths) + ' ' + (periodMonths === 1 ? 'this mo' : periodMonths < 12 ? `${periodMonths}mo` : 'annual')],
                      ['Income', fmt(p.pIncome),  'income-text'],
                      ['Expenses', fmt(p.pExpense), 'expense-text'],
                      ['Net',             fmt(p.pIncome - p.pExpense), p.pIncome - p.pExpense >= 0 ? 'income-text' : 'expense-text'],
                    ].map(([l, v, cls]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
                        <span style={{ color: 'var(--muted)' }}>{l}</span>
                        <span className={cls || ''} style={{ fontWeight: 500, fontFamily: cls ? 'var(--font-mono)' : 'inherit' }}>{v}</span>
                      </div>
                    ))}
                    {/* Income vs expected bar — scaled to selected period */}
                    {p.monthlyRent > 0 && (() => {
                      const expected = Number(p.monthlyRent) * periodMonths;
                      const pct = expected > 0 ? Math.min((p.pIncome / expected) * 100, 100) : 0;
                      const collected = expected > 0 ? ((p.pIncome / expected) * 100).toFixed(0) : 0;
                      return (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 2 }}>
                            <span>Collected vs expected <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>({periodLabel})</span></span>
                            <span style={{ color: pct >= 90 ? 'var(--success)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)', fontWeight: 600 }}>
                              {fmt(p.pIncome)} / {fmt(expected)} ({collected}%)
                            </span>
                          </div>
                          <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? 'var(--success)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)', borderRadius: 3, transition: 'width .4s' }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}

            {/* Income vs expense summary */}
            {properties.length > 0 && (
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '14px 20px 0', fontSize: '1rem', fontWeight: 600 }}>
                  Property Summary — {year}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Property</th><th>Status</th><th>Tenant</th><th>Expected</th><th style={{ textAlign: 'right' }}>Income</th><th style={{ textAlign: 'right' }}>Expenses</th><th style={{ textAlign: 'right' }}>Net</th></tr></thead>
                    <tbody>
                      {periodPropStats.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td><span className={`badge ${p.tenant ? 'badge-active' : 'badge-vacant'}`}>{p.tenant ? 'Occupied' : 'Vacant'}</span></td>
                          <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{p.tenant?.name || '—'}</td>
                          <td style={{ fontSize: '0.82rem' }}>{fmt(p.monthlyRent || 0)}/mo</td>
                          <td className="amount-cell income-text"  style={{ textAlign: 'right' }}>{fmt(p.pIncome)}</td>
                          <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(p.pExpense)}</td>
                          <td className="amount-cell" style={{ textAlign: 'right', color: p.pIncome - p.pExpense >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                            {fmt(p.pIncome - p.pExpense)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                        <td colSpan={4} style={{ textAlign: 'right', color: 'var(--muted)', fontSize: '0.78rem' }}>TOTAL</td>
                        <td className="amount-cell income-text"  style={{ textAlign: 'right' }}>{fmt(income)}</td>
                        <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(expense)}</td>
                        <td className="amount-cell" style={{ textAlign: 'right', color: income - expense >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(income - expense)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PROPERTIES ══ */}
        {tab === 'properties' && (
          <div>
            {isAdmin && <div style={{ marginBottom: 16 }}><button className="btn btn-primary" onClick={() => setPropModal({ open: true, initial: null })}><Plus size={14} /> Add Property</button></div>}
            {properties.length === 0 ? (
              <div className="empty-state"><p>No properties yet.</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
                {periodPropStats.map(p => (
                  <div key={p.id} className="card segment-rental">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{p.address}</div>
                      </div>
                      <span className={`badge ${p.tenant ? 'badge-active' : 'badge-vacant'}`}>{p.tenant ? 'Occupied' : 'Vacant'}</span>
                    </div>
                    {[['Type', p.type], ['Monthly Rent', fmt(p.monthlyRent || 0)], ['Current Tenant', p.tenant?.name || '—'], ['Notes', p.description || '—']].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
                        <span style={{ color: 'var(--muted)' }}>{l}</span>
                        <span style={{ fontWeight: 500, maxWidth: 160, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                      </div>
                    ))}
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPropModal({ open: true, initial: p })}><Pencil size={12} /> Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={async () => { if (window.confirm(`Delete "${p.name}"?`)) { await propertyService.delete(p.id); load(); } }}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TENANTS ══ */}
        {tab === 'tenants' && (
          <div>
            {isAdmin && <div style={{ marginBottom: 16 }}><button className="btn btn-primary" onClick={() => setTenantModal({ open: true, initial: null })}><Plus size={14} /> Add Tenant</button></div>}

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {[['all', 'All'], ['active', 'Active'], ['notice', 'Notice'], ['ended', 'Ended']].map(([k, l]) => (
                <button key={k} className={`btn btn-sm ${tenantFilter === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTenantFilter(k)}>
                  {l} ({(k === 'all' ? tenants : tenants.filter(t => t.status === k)).length})
                </button>
              ))}
            </div>

            {/* Summary cards */}
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card income"><div className="stat-label">Active</div><div className="stat-value income-text">{tenants.filter(t => t.status === 'active').length}</div></div>
              <div className="stat-card expense"><div className="stat-label">Notice</div><div className="stat-value">{tenants.filter(t => t.status === 'notice').length}</div></div>
              <div className="stat-card"><div className="stat-label">All Records</div><div className="stat-value">{tenants.length}</div></div>
              <div className="stat-card net">
                <div className="stat-label">Monthly Rent (Active)</div>
                <div className="stat-value">{fmt(tenants.filter(t => t.status === 'active').reduce((s, t) => s + Number(t.monthlyRent || 0), 0))}</div>
              </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Tenant</th><th>Property</th><th>Lease Period</th><th>Monthly Rent</th><th>Deposit</th><th>Status</th><th>Expires In</th>{isAdmin && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {filteredTenants.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>No tenants found.</td></tr>}
                    {filteredTenants.map(t => {
                      const days = daysUntilExpiry(t.leaseEnd);
                      return (
                        <tr key={t.id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{t.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t.email}</div>
                          </td>
                          <td>{propName(t.propertyId)}</td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {t.leaseStart && <span>{t.leaseStart}</span>}
                            {t.leaseStart && t.leaseEnd && <span style={{ color: 'var(--muted)' }}> → </span>}
                            {t.leaseEnd && <span>{t.leaseEnd}</span>}
                          </td>
                          <td className="amount-cell">{fmt(t.monthlyRent)}</td>
                          <td className="amount-cell">{fmt(t.deposit)}</td>
                          <td>
                            <span className={`badge ${t.status === 'active' ? 'badge-active' : t.status === 'notice' ? 'badge-expense' : 'badge-ended'}`}>
                              {t.status}
                            </span>
                          </td>
                          <td>
                            {days !== null ? (
                              <span style={{ fontSize: '0.82rem', color: days < 0 ? 'var(--danger)' : days < 30 ? 'var(--warn)' : 'var(--muted)' }}>
                                {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                              </span>
                            ) : '—'}
                          </td>
                          {isAdmin && (
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setTenantModal({ open: true, initial: t })}><Pencil size={12} /></button>
                                <button className="btn btn-danger btn-sm" onClick={async () => { if (window.confirm('Delete?')) { await tenantService.delete(t.id); load(); } }}><Trash2 size={12} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ TRANSACTIONS ══ */}
        {tab === 'transactions' && (
          <div>
            {isAdmin && <div style={{ marginBottom: 16 }}><button className="btn btn-primary" onClick={() => setTxModal({ open: true, initial: null })}><Plus size={14} /> Add Transaction</button></div>}

            {/* Year + property filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="year-selector">
                {YEARS.map(y => <button key={y} className={year === y ? 'active' : ''} onClick={() => setYear(y)}>{y}</button>)}
              </div>
              <select style={{ maxWidth: 220 }} value={propFilter} onChange={e => setPropFilter(e.target.value)}>
                <option value="">All properties</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* KPIs for filtered view */}
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card income"><div className="stat-label">Income</div><div className="stat-value income-text">{fmt(filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0))}</div></div>
              <div className="stat-card expense"><div className="stat-label">Expenses</div><div className="stat-value expense-text">{fmt(filteredTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0))}</div></div>
              <div className="stat-card net"><div className="stat-label">Net</div>
                <div className="stat-value" style={{ color: filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) - filteredTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {fmt(filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) - filteredTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0))}
                </div>
              </div>
              <div className="stat-card"><div className="stat-label">Entries</div><div className="stat-value">{filteredTx.length}</div></div>
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Type</th><th>Category</th><th>Property</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th>{isAdmin && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {filteredTx.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No transactions yet.</td></tr>}
                    {filteredTx.map(t => (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                        <td><span className={`badge badge-${t.type}`}>{t.type === 'income' ? '↑ Income' : '↓ Expense'}</span></td>
                        <td>{t.category}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{propName(t.propertyId)}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '—'}</td>
                        <td className={`amount-cell ${t.type === 'income' ? 'income-text' : 'expense-text'}`} style={{ textAlign: 'right', fontWeight: 600 }}>
                          {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                        </td>
                        {isAdmin && (
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setTxModal({ open: true, initial: t })}><Pencil size={12} /></button>
                              <button className="btn btn-danger btn-sm" onClick={async () => { if (window.confirm('Delete?')) { await rentalService.delete(t.id); load(); } }}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredTx.length > 0 && (
                      <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                        <td colSpan={5} style={{ textAlign: 'right', color: 'var(--muted)', fontSize: '0.78rem' }}>TOTAL</td>
                        <td className="amount-cell income-text" style={{ textAlign: 'right' }}>
                          {fmt(filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0))}
                        </td>
                        {isAdmin && <td />}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* YOY */}
        {tab === 'yoy' && (
          <RentalYOY />
        )}
      </div>

      {/* Modals */}
      <PropertyModal   open={propModal.open}   initial={propModal.initial}   onClose={() => setPropModal({ open: false, initial: null })}   onSave={handleSaveProp} />
      <TenantModal     open={tenantModal.open} initial={tenantModal.initial} onClose={() => setTenantModal({ open: false, initial: null })} onSave={handleSaveTenant} properties={properties} />
      <TransactionModal open={txModal.open}    initial={txModal.initial}     onClose={() => setTxModal({ open: false, initial: null })}     onSave={handleSaveTx}    properties={properties} />
    </div>
  );
}
