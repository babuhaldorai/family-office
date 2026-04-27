import React, { useEffect, useState, useMemo } from 'react';
import { useMobile } from '../hooks/useMobile';
import { propertyService, tenantService, rentalService } from '../utils/firestoreService';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { fmt } from '../utils/finance';
import RentalYOY from './RentalYOY';

const YEAR  = new Date().getFullYear();
const YEARS = [YEAR - 2, YEAR - 1, YEAR];

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, footer }) {
  const isMobile = useMobile(); // eslint-disable-line no-unused-vars
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
  const [form, setForm] = useState(empty);
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
      <div className="form-group"><label>Property Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
      <div className="form-group"><label>Address</label><textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} /></div>
      <div className="form-row">
        <div className="form-group"><label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            {['Residential','Commercial','Industrial','Agricultural','Other'].map(t => <option key={t}>{t}</option>)}
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
  const [form, setForm] = useState(empty);
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
            <option value="active">Active</option><option value="notice">Notice Period</option><option value="ended">Ended</option>
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
const INCOME_CATS  = ['Rent','Security Deposit','Late Fee','Other'];
const EXPENSE_CATS = ['Maintenance','Repair','Property Tax','Insurance','Water/Electricity','Management Fee','Legal','Other'];

function TransactionModal({ open, onClose, onSave, initial, properties }) {
  const empty = { date: new Date().toISOString().slice(0,10), type: 'income', category: '', amount: '', propertyId: '', description: '' };
  const [form, setForm] = useState(empty);
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
            <option value="income">Income</option><option value="expense">Expense</option>
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

// ── Period filter bar (same as Tea) ───────────────────────────────────────────
const PERIOD_OPTS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd',        label: 'YTD'        },
  { key: 'last_year',  label: 'Last Year'  },
  { key: 'all',        label: 'All Time'   },
];

function PeriodBar({ period, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'10px 14px', marginBottom:20 }}>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        {PERIOD_OPTS.map(o => (
          <button key={o.key}
            style={{ padding:'5px 13px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background: period.preset===o.key?'var(--accent)':'transparent', color: period.preset===o.key?'#0f1117':'var(--muted)', fontFamily:'var(--font-body)', fontSize:'0.8rem', fontWeight:500, cursor:'pointer', transition:'all .15s' }}
            onClick={() => onChange(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
      <span style={{ marginLeft:'auto', fontSize:'0.78rem', color:'var(--muted)', fontStyle:'italic' }}>{period.label}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RentalsPage() {
  const isMobile = useMobile(); // eslint-disable-line no-unused-vars
  const { isAdmin } = useAuth();
  const [tab, setTab]           = useState('overview');
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txYear, setTxYear]     = useState(YEAR);
  const [propFilter, setPropFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [loading, setLoading]   = useState(true);
  const [periodKey, setPeriodKey] = useState('ytd');

  const [propModal,   setPropModal]   = useState({ open: false, initial: null });
  const [tenantModal, setTenantModal] = useState({ open: false, initial: null });
  const [txModal,     setTxModal]     = useState({ open: false, initial: null });

  const load = async () => {
    setLoading(true);
    const [p, t, tx] = await Promise.all([
      propertyService.getAll(),
      tenantService.getAll(),
      rentalService.getTransactions(txYear),
    ]);
    setProperties(p); setTenants(t); setTransactions(tx);
    setLoading(false);
  };
  useEffect(() => { load(); }, [txYear]); // eslint-disable-line

  // Period bounds
  const period = useMemo(() => {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const f2  = d => d.toISOString().slice(0,10);
    const bounds = {
      this_month: { from: f2(new Date(y,m,1)),   to: f2(new Date(y,m+1,0)) },
      last_month: { from: f2(new Date(y,m-1,1)), to: f2(new Date(y,m,0))   },
      ytd:        { from: `${y}-01-01`,           to: f2(now)               },
      last_year:  { from: `${y-1}-01-01`,         to: `${y-1}-12-31`        },
      all:        { from: '2000-01-01',            to: '2099-12-31'          },
    };
    const labels = {
      this_month: new Date(y,m,1).toLocaleString('en-IN',{month:'long',year:'numeric'}),
      last_month: new Date(y,m-1,1).toLocaleString('en-IN',{month:'long',year:'numeric'}),
      ytd:        `Jan – ${now.toLocaleString('en-IN',{month:'short'})} ${y} (YTD)`,
      last_year:  `${y-1} (full year)`,
      all:        'All Time',
    };
    return { preset: periodKey, ...bounds[periodKey], label: labels[periodKey] };
  }, [periodKey]);

  // How many months in period (for expected rent scaling)
  const periodMonths = useMemo(() => {
    const now = new Date(), m = now.getMonth();
    return { this_month:1, last_month:1, ytd:m+1, last_year:12, all:12 }[periodKey] || 12;
  }, [periodKey]);

  const activeTenantFor = pid => tenants.find(t => t.propertyId === pid && t.status === 'active');

  // Period-filtered transactions
  const periodTx = useMemo(() =>
    transactions.filter(t => !t.date || (t.date >= period.from && t.date <= period.to))
  , [transactions, period]);

  const periodIncome  = periodTx.filter(t => t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const periodExpense = periodTx.filter(t => t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  // Per-property stats for selected period
  const propStats = useMemo(() => properties.map(p => {
    const pTx      = periodTx.filter(t => t.propertyId === p.id);
    const pIncome  = pTx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const pExpense = pTx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    const tenant   = activeTenantFor(p.id);
    const daysLeft = tenant?.leaseEnd ? Math.ceil((new Date(tenant.leaseEnd)-new Date())/86400000) : null;
    const expected = Number(p.monthlyRent||0) * periodMonths;
    const collectedPct = expected > 0 ? Math.min((pIncome/expected)*100,100) : 0;
    return { ...p, pIncome, pExpense, tenant, daysLeft, expected, collectedPct };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [properties, periodTx, periodMonths, tenants]);

  const occupied     = properties.filter(p => activeTenantFor(p.id)).length;
  const expectedRent = properties.reduce((s,p)=>s+Number(p.monthlyRent||0),0);

  // Filtered transactions tab
  const filteredTx = useMemo(() => {
    let t = transactions;
    if (propFilter) t = t.filter(x => x.propertyId === propFilter);
    return t;
  }, [transactions, propFilter]);

  // Filtered tenants
  const filteredTenants = useMemo(() =>
    tenantFilter==='all' ? tenants : tenants.filter(t=>t.status===tenantFilter)
  , [tenants, tenantFilter]);

  const handleSaveProp   = async d => { if(propModal.initial) await propertyService.update(propModal.initial.id,d); else await propertyService.add(d); load(); };
  const handleSaveTenant = async d => { if(tenantModal.initial) await tenantService.update(tenantModal.initial.id,d); else await tenantService.add(d); load(); };
  const handleSaveTx     = async d => { if(txModal.initial) await rentalService.update(txModal.initial.id,d); else await rentalService.add(d); load(); };

  const TABS = [
    { key:'overview',     label:'⌂ Overview'      },
    { key:'properties',   label:'🏠 Properties'   },
    { key:'tenants',      label:'👥 Tenants'       },
    { key:'transactions', label:'₹ Transactions'  },
    { key:'yoy',          label:'📈 YOY'           },
  ];

  if (loading) return <div style={{ padding:40, color:'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      {/* Header — no tab-specific add button, moved inside tabs */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🏠 Rental Homes</h1>
          <p className="page-subtitle">{properties.length} properties · {occupied} occupied · {properties.length-occupied} vacant</p>
        </div>
      </div>

      <div className="page-content-inner">

        {/* ── TABS (top, like Tea Plantation) ── */}
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.key} className={`tab ${tab===t.key?'active':''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab==='overview' && (
          <div>
            {/* Period filter */}
            <PeriodBar period={period} onChange={setPeriodKey} />

            {/* KPI strip */}
            <div className="stat-grid" style={{ marginBottom:24 }}>
              <div className="stat-card income">
                <div className="stat-label">Income — {period.label}</div>
                <div className="stat-value income-text">{fmt(periodIncome)}</div>
                <div className="stat-sub">{periodTx.filter(t=>t.type==='income').length} entries</div>
              </div>
              <div className="stat-card expense">
                <div className="stat-label">Expenses — {period.label}</div>
                <div className="stat-value expense-text">{fmt(periodExpense)}</div>
              </div>
              <div className="stat-card net">
                <div className="stat-label">Net — {period.label}</div>
                <div className="stat-value" style={{ color:periodIncome-periodExpense>=0?'var(--success)':'var(--danger)' }}>{fmt(periodIncome-periodExpense)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Expected Monthly</div>
                <div className="stat-value">{fmt(expectedRent)}</div>
                <div className="stat-sub">{occupied}/{properties.length} occupied</div>
              </div>
            </div>

            {/* Property cards */}
            {propStats.length===0
              ? <div className="empty-state"><p>No properties yet. Add one in the Properties tab.</p></div>
              : <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(280px,1fr))',gap:isMobile?12:16,marginBottom:24}}>
                  {propStats.map(p => (
                    <div key={p.id} className="card segment-rental">
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{p.name}</div>
                          {p.address && <div style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:2 }}>{p.address}</div>}
                        </div>
                        <span className={`badge ${p.tenant?'badge-active':'badge-vacant'}`}>{p.tenant?'Occupied':'Vacant'}</span>
                      </div>

                      {p.tenant && (
                        <div style={{ fontSize:'0.78rem', color:'var(--muted)', marginBottom:10, padding:'6px 10px', background:'var(--surface2)', borderRadius:6 }}>
                          <strong style={{ color:'var(--text)' }}>{p.tenant.name}</strong>
                          {p.tenant.leaseEnd && (
                            <span style={{ marginLeft:8, color: p.daysLeft!==null&&p.daysLeft<30?'var(--warn)':'var(--muted)' }}>
                              · Expires {p.tenant.leaseEnd}
                              {p.daysLeft!==null && ` (${p.daysLeft<0?`${Math.abs(p.daysLeft)}d overdue`:`${p.daysLeft}d`})`}
                            </span>
                          )}
                        </div>
                      )}

                      {[
                        ['Expected', `${fmt(Number(p.monthlyRent)||0)}/mo`, null],
                        ['Collected', fmt(p.pIncome), 'income-text'],
                        ['Expenses',  fmt(p.pExpense), 'expense-text'],
                        ['Net',       fmt(p.pIncome-p.pExpense), p.pIncome-p.pExpense>=0?'income-text':'expense-text'],
                      ].map(([l,v,cls])=>(
                        <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:'0.83rem' }}>
                          <span style={{ color:'var(--muted)' }}>{l}</span>
                          <span className={cls||''} style={{ fontWeight:500 }}>{v}</span>
                        </div>
                      ))}

                      {/* Collected vs expected bar */}
                      {Number(p.monthlyRent)>0 && (
                        <div style={{ marginTop:10 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--muted)', marginBottom:3 }}>
                            <span>Collected vs expected <span style={{ fontStyle:'italic' }}>({period.label})</span></span>
                            <span style={{ color: p.collectedPct>=90?'var(--success)':p.collectedPct>=50?'var(--warn)':'var(--danger)', fontWeight:600 }}>
                              {p.collectedPct.toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ height:5, background:'var(--surface2)', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${p.collectedPct}%`, background:p.collectedPct>=90?'var(--success)':p.collectedPct>=50?'var(--warn)':'var(--danger)', borderRadius:3, transition:'width .4s' }} />
                          </div>
                          <div style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:2 }}>
                            {fmt(p.pIncome)} of {fmt(p.expected)} expected
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
            }

            {/* Summary table */}
            {propStats.length>0 && (
              <div className="card" style={{ padding:0 }}>
                <div style={{ padding:'14px 20px 0', fontWeight:600, fontSize:'1rem' }}>Property Summary — {period.label}</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Property</th><th>Status</th><th>Tenant</th><th>Expected</th><th style={{ textAlign:'right' }}>Collected</th><th style={{ textAlign:'right' }}>Expenses</th><th style={{ textAlign:'right' }}>Net</th></tr>
                    </thead>
                    <tbody>
                      {propStats.map(p=>(
                        <tr key={p.id}>
                          <td style={{ fontWeight:600 }}>{p.name}</td>
                          <td><span className={`badge ${p.tenant?'badge-active':'badge-vacant'}`}>{p.tenant?'Occupied':'Vacant'}</span></td>
                          <td style={{ color:'var(--muted)', fontSize:'0.82rem' }}>{p.tenant?.name||'—'}</td>
                          <td style={{ fontSize:'0.82rem' }}>{fmt(Number(p.monthlyRent)||0)}/mo</td>
                          <td className="amount-cell income-text"  style={{ textAlign:'right' }}>{fmt(p.pIncome)}</td>
                          <td className="amount-cell expense-text" style={{ textAlign:'right' }}>{fmt(p.pExpense)}</td>
                          <td className="amount-cell" style={{ textAlign:'right', color:p.pIncome-p.pExpense>=0?'var(--success)':'var(--danger)', fontWeight:600 }}>{fmt(p.pIncome-p.pExpense)}</td>
                        </tr>
                      ))}
                      <tr style={{ background:'var(--surface2)', fontWeight:700 }}>
                        <td colSpan={4} style={{ textAlign:'right', color:'var(--muted)', fontSize:'0.78rem' }}>TOTAL</td>
                        <td className="amount-cell income-text"  style={{ textAlign:'right' }}>{fmt(periodIncome)}</td>
                        <td className="amount-cell expense-text" style={{ textAlign:'right' }}>{fmt(periodExpense)}</td>
                        <td className="amount-cell" style={{ textAlign:'right', color:periodIncome-periodExpense>=0?'var(--success)':'var(--danger)' }}>{fmt(periodIncome-periodExpense)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PROPERTIES ══ */}
        {tab==='properties' && (
          <div>
            {isAdmin && <div style={{ marginBottom:16 }}><button className="btn btn-primary" onClick={()=>setPropModal({open:true,initial:null})}><Plus size={14}/> Add Property</button></div>}
            {properties.length===0
              ? <div className="empty-state"><p>No properties yet.</p></div>
              : <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(280px,1fr))',gap:isMobile?12:16}}>
                  {properties.map(p=>{
                    const tenant=activeTenantFor(p.id);
                    return(
                      <div key={p.id} className="card segment-rental">
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                          <div>
                            <div style={{ fontWeight:700, fontSize:'1rem' }}>{p.name}</div>
                            <div style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:2 }}>{p.address}</div>
                          </div>
                          <span className={`badge ${tenant?'badge-active':'badge-vacant'}`}>{tenant?'Occupied':'Vacant'}</span>
                        </div>
                        {[['Type',p.type],['Monthly Rent',fmt(Number(p.monthlyRent)||0)],['Current Tenant',tenant?.name||'—'],['Notes',p.description||'—']].map(([l,v])=>(
                          <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:'0.83rem' }}>
                            <span style={{ color:'var(--muted)' }}>{l}</span>
                            <span style={{ fontWeight:500, maxWidth:160, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
                          </div>
                        ))}
                        {isAdmin && (
                          <div style={{ display:'flex', gap:6, marginTop:12 }}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setPropModal({open:true,initial:p})}><Pencil size={12}/> Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={async()=>{ if(window.confirm(`Delete "${p.name}"?`)){await propertyService.delete(p.id);load();}}}><Trash2 size={12}/></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}

        {/* ══ TENANTS ══ */}
        {tab==='tenants' && (
          <div>
            {isAdmin && <div style={{ marginBottom:16 }}><button className="btn btn-primary" onClick={()=>setTenantModal({open:true,initial:null})}><Plus size={14}/> Add Tenant</button></div>}
            <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
              {[['all','All'],['active','Active'],['notice','Notice'],['ended','Ended']].map(([k,l])=>(
                <button key={k} className={`btn btn-sm ${tenantFilter===k?'btn-primary':'btn-ghost'}`} onClick={()=>setTenantFilter(k)}>
                  {l} ({(k==='all'?tenants:tenants.filter(t=>t.status===k)).length})
                </button>
              ))}
            </div>
            <div className="stat-grid" style={{ marginBottom:20 }}>
              <div className="stat-card income"><div className="stat-label">Active</div><div className="stat-value">{tenants.filter(t=>t.status==='active').length}</div></div>
              <div className="stat-card"><div className="stat-label">Notice Period</div><div className="stat-value">{tenants.filter(t=>t.status==='notice').length}</div></div>
              <div className="stat-card"><div className="stat-label">Total Records</div><div className="stat-value">{tenants.length}</div></div>
              <div className="stat-card net"><div className="stat-label">Active Monthly Rent</div><div className="stat-value">{fmt(tenants.filter(t=>t.status==='active').reduce((s,t)=>s+Number(t.monthlyRent||0),0))}</div></div>
            </div>
            <div className="card" style={{ padding:0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Tenant</th><th>Property</th><th>Lease Period</th><th>Monthly Rent</th><th>Deposit</th><th>Status</th><th>Days Left</th>{isAdmin&&<th></th>}</tr></thead>
                  <tbody>
                    {filteredTenants.length===0 && <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>No tenants found.</td></tr>}
                    {filteredTenants.map(t=>{
                      const days = t.leaseEnd ? Math.ceil((new Date(t.leaseEnd)-new Date())/86400000) : null;
                      const propName = properties.find(p=>p.id===t.propertyId)?.name||'—';
                      return(
                        <tr key={t.id}>
                          <td><div style={{ fontWeight:500 }}>{t.name}</div><div style={{ fontSize:'0.75rem', color:'var(--muted)' }}>{t.email}</div></td>
                          <td>{propName}</td>
                          <td style={{ fontSize:'0.82rem' }}>{t.leaseStart} {t.leaseStart&&t.leaseEnd&&'→'} {t.leaseEnd}</td>
                          <td className="amount-cell">{fmt(t.monthlyRent)}</td>
                          <td className="amount-cell">{fmt(t.deposit)}</td>
                          <td><span className={`badge ${t.status==='active'?'badge-active':t.status==='notice'?'badge-expense':'badge-ended'}`}>{t.status}</span></td>
                          <td><span style={{ fontSize:'0.82rem', color:days===null?'var(--muted)':days<0?'var(--danger)':days<30?'var(--warn)':'var(--muted)' }}>{days===null?'—':days<0?`${Math.abs(days)}d overdue`:`${days}d`}</span></td>
                          {isAdmin&&<td><div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setTenantModal({open:true,initial:t})}><Pencil size={12}/></button>
                            <button className="btn btn-danger btn-sm" onClick={async()=>{ if(window.confirm('Delete?')){await tenantService.delete(t.id);load();}}}><Trash2 size={12}/></button>
                          </div></td>}
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
        {tab==='transactions' && (
          <div>
            {isAdmin && <div style={{ marginBottom:16 }}><button className="btn btn-primary" onClick={()=>setTxModal({open:true,initial:null})}><Plus size={14}/> Add Transaction</button></div>}
            <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
              <div className="year-selector">
                {YEARS.map(y=><button key={y} className={txYear===y?'active':''} onClick={()=>setTxYear(y)}>{y}</button>)}
              </div>
              <select style={{ maxWidth:220 }} value={propFilter} onChange={e=>setPropFilter(e.target.value)}>
                <option value="">All properties</option>
                {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {/* KPIs for filtered view */}
            {(() => {
              const inc = filteredTx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
              const exp = filteredTx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
              return(
                <div className="stat-grid" style={{ marginBottom:20 }}>
                  <div className="stat-card income"><div className="stat-label">Income</div><div className="stat-value income-text">{fmt(inc)}</div></div>
                  <div className="stat-card expense"><div className="stat-label">Expenses</div><div className="stat-value expense-text">{fmt(exp)}</div></div>
                  <div className="stat-card net"><div className="stat-label">Net</div><div className="stat-value" style={{ color:inc-exp>=0?'var(--success)':'var(--danger)' }}>{fmt(inc-exp)}</div></div>
                  <div className="stat-card"><div className="stat-label">Entries</div><div className="stat-value">{filteredTx.length}</div></div>
                </div>
              );
            })()}
            <div className="card" style={{ padding:0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Property</th><th>Description</th><th style={{ textAlign:'right' }}>Amount</th>{isAdmin&&<th></th>}</tr></thead>
                  <tbody>
                    {filteredTx.length===0&&<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>No transactions yet.</td></tr>}
                    {filteredTx.map(t=>{
                      const propName=properties.find(p=>p.id===t.propertyId)?.name||'—';
                      return(
                        <tr key={t.id}>
                          <td style={{ whiteSpace:'nowrap' }}>{t.date}</td>
                          <td><span className={`badge ${t.type==='income'?'badge-income':'badge-expense'}`}>{t.type==='income'?'↑ Income':'↓ Expense'}</span></td>
                          <td>{t.category}</td>
                          <td style={{ fontSize:'0.82rem', color:'var(--muted)' }}>{propName}</td>
                          <td style={{ fontSize:'0.82rem', color:'var(--muted)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description||'—'}</td>
                          <td className={`amount-cell ${t.type==='income'?'income-text':'expense-text'}`} style={{ textAlign:'right', fontWeight:600 }}>
                            {t.type==='income'?'+':'-'}{fmt(t.amount)}
                          </td>
                          {isAdmin&&<td><div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setTxModal({open:true,initial:t})}><Pencil size={12}/></button>
                            <button className="btn btn-danger btn-sm" onClick={async()=>{ if(window.confirm('Delete?')){await rentalService.delete(t.id);load();}}}><Trash2 size={12}/></button>
                          </div></td>}
                        </tr>
                      );
                    })}
                    {filteredTx.length>0&&(
                      <tr style={{ background:'var(--surface2)', fontWeight:700 }}>
                        <td colSpan={5} style={{ textAlign:'right', color:'var(--muted)', fontSize:'0.78rem' }}>TOTAL</td>
                        <td className="amount-cell income-text" style={{ textAlign:'right' }}>{fmt(filteredTx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0))}</td>
                        {isAdmin&&<td/>}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ YOY ══ */}
        {tab==='yoy' && <RentalYOY />}

      </div>

      {/* Modals */}
      <PropertyModal    open={propModal.open}   initial={propModal.initial}   onClose={()=>setPropModal({open:false,initial:null})}   onSave={handleSaveProp} />
      <TenantModal      open={tenantModal.open} initial={tenantModal.initial} onClose={()=>setTenantModal({open:false,initial:null})} onSave={handleSaveTenant} properties={properties} />
      <TransactionModal open={txModal.open}     initial={txModal.initial}     onClose={()=>setTxModal({open:false,initial:null})}     onSave={handleSaveTx}    properties={properties} />
    </div>
  );
}
