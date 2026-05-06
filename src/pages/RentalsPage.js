import { db } from '../firebase';
import { getDocs, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState, useMemo } from 'react';
import { useMobile } from '../hooks/useMobile';
import { propertyService, tenantService, rentalService } from '../utils/firestoreService';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { fmt } from '../utils/finance';
import PeriodBar, { calcBounds } from '../components/PeriodBar';
import RentalYOY from './RentalYOY';


// ── Modal ─────────────────────────────────────────────────────────────────────
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
  const empty = { date: new Date().toISOString().slice(0,10), type: 'income', category: '', costType: 'Material', persons: '', ratePerPerson: '', days: '1', amount: '', propertyId: '', description: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initial ? { ...empty, ...initial } : empty); }, [open]); // eslint-disable-line
  const set = (k, v) => setForm(f => {
    const u = { ...f, [k]: v };
    if (['persons','ratePerPerson','days'].includes(k) && u.costType==='Labour' && u.type==='expense') {
      const amt = (Number(u.persons)||0) * (Number(u.ratePerPerson)||0) * (Number(u.days)||1);
      if (amt > 0) u.amount = String(amt);
    }
    return u;
  });
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
      {form.type==='expense' && (
        <div className="form-group">
          <label>Cost Type</label>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            {['Labour','Material'].map(t=>(
              <button key={t} type="button" onClick={()=>set('costType',t)}
                style={{flex:1,padding:'9px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:'0.88rem',
                  border:`2px solid ${form.costType===t?'var(--accent)':'var(--border)'}`,
                  background:form.costType===t?'rgba(201,168,76,0.15)':'var(--surface2)',
                  color:form.costType===t?'var(--accent)':'var(--muted)'}}>
                {t==='Labour'?'👷 Labour':'🧱 Material'}
              </button>
            ))}
          </div>
        </div>
      )}
      {form.type==='expense' && form.costType==='Labour' && (
        <div style={{padding:'12px 14px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)',marginBottom:8}}>
          <div style={{fontWeight:600,fontSize:'0.82rem',marginBottom:10}}>👷 Labour Details (auto-calculates amount)</div>
          <div className="form-row">
            <div className="form-group"><label># Persons</label>
              <input type="number" min="1" value={form.persons} onChange={e=>set('persons',e.target.value)} placeholder="e.g. 3"/>
            </div>
            <div className="form-group"><label>Rate / Person / Day (₹)</label>
              <input type="number" step="0.01" value={form.ratePerPerson} onChange={e=>set('ratePerPerson',e.target.value)} placeholder="e.g. 500"/>
            </div>
            <div className="form-group"><label>Days</label>
              <input type="number" min="0.5" step="0.5" value={form.days} onChange={e=>set('days',e.target.value)} placeholder="1"/>
            </div>
          </div>
          {form.persons && form.ratePerPerson && (
            <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>
              {form.persons} × ₹{form.ratePerPerson}/day × {form.days||1}d =
              <strong style={{color:'var(--accent)',marginLeft:4}}>
                ₹{((Number(form.persons)||0)*(Number(form.ratePerPerson)||0)*(Number(form.days)||1)).toFixed(0)}
              </strong>
              <span style={{marginLeft:6,fontSize:'0.72rem'}}>(auto-filled in Amount)</span>
            </div>
          )}
        </div>
      )}
      <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
    </Modal>
  );
}

// ── Period filter bar (same as Tea) ───────────────────────────────────────────


// ── Main page ─────────────────────────────────────────────────────────────────

export default function RentalsPage() {
  const { isAdmin, user: authUser } = useAuth();
  const userEmail = authUser?.email || 'unknown';
  const writeAudit = (action, col, summary) => {
    addDoc(collection(db, 'audit_log'), {
      action, collection: col,
      summary: summary || '',
      userEmail,
      timestamp: serverTimestamp(),
    }).catch(e => console.error('[Audit fail]', e.code, e.message));
  };
  const [tab, setTab]           = useState('overview');
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txPeriod, setTxPeriod] = useState({ preset:'ytd', ...calcBounds('ytd') });
  const [propFilter, setPropFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [loading, setLoading]   = useState(true);
  const [dashPeriod, setDashPeriod] = useState({ preset:'ytd', ...calcBounds('ytd') });

  const [propModal,   setPropModal]   = useState({ open: false, initial: null });
  const [tenantModal, setTenantModal] = useState({ open: false, initial: null });
  const [txModal,     setTxModal]     = useState({ open: false, initial: null });

  // Inline quick-add transaction form state
  const txEmpty = { date: new Date().toISOString().slice(0,10), type: 'income', category: '', costType: 'Material', persons: '', ratePerPerson: '', days: '1', amount: '', propertyId: '', description: '' };
  const [txForm, setTxForm] = useState(txEmpty);
  const setTF = (k, v) => setTxForm(f => {
    const u = { ...f, [k]: v };
    if (['persons','ratePerPerson','days'].includes(k) && u.costType==='Labour' && u.type==='expense') {
      const amt = (Number(u.persons)||0) * (Number(u.ratePerPerson)||0) * (Number(u.days)||1);
      if (amt > 0) u.amount = String(amt);
    }
    return u;
  });
  const saveTxInline = async () => {
    if (!txForm.date)     return alert('Select a date.');
    if (!txForm.amount || Number(txForm.amount)<=0) return alert('Enter a valid amount.');
    if (!txForm.category) return alert('Select a category.');
    if (!txForm.propertyId) return alert('Select a property.');
    await rentalService.add({ ...txForm, createdAt: serverTimestamp() });
    const pn = properties.find(p=>p.id===txForm.propertyId)?.name||'';
    writeAudit('create','rental_transactions',`Added ${txForm.type} ₹${txForm.amount} — ${pn}`);
    setTxForm({ ...txEmpty, propertyId: txForm.propertyId });
    load();
  };

  const load = async () => {
    setLoading(true);
    const [p, t, txSnap] = await Promise.all([
      propertyService.getAll(),
      tenantService.getAll(),
      getDocs(collection(db, 'rental_transactions')),
    ]);
    // Load ALL transactions, filter in JS for correct period/year filtering
    const allTx = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setProperties(p); setTenants(t); setTransactions(allTx);
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  // Period bounds
  const period = dashPeriod;

  // How many months in period (for expected rent scaling)
  const periodMonths = useMemo(() => {
    const now = new Date(), m = now.getMonth();
    return { this_month:1, last_month:1, ytd:m+1, last_year:12, all:12 }[dashPeriod.preset] || 12;
  }, [dashPeriod]);

  const activeTenantFor = pid => tenants.find(t => t.propertyId === pid && t.status === 'active');

  // Period-filtered transactions
  const periodTx = useMemo(() =>
    transactions.filter(t => {
      // Date-based filter for dashboard period
      if (!t.date) return true;
      return t.date >= period.from && t.date <= period.to;
    })
  , [transactions, period]);

  // Separate year filter for the transactions log tab
  const logTx = useMemo(() =>
    transactions.filter(t => {
      if (!t.date) return true;
      return t.date >= (txPeriod.from||'2000-01-01') && t.date <= (txPeriod.to||'2099-12-31');
    })
  , [transactions, txPeriod]);

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

  // Filtered transactions tab (uses logTx which is already year-filtered)
  const filteredTx = useMemo(() => {
    let result = logTx;
    if (propFilter) result = result.filter(t => t.propertyId === propFilter);
    return result;
  }, [logTx, propFilter]);

  // Filtered tenants
  const filteredTenants = useMemo(() =>
    tenantFilter==='all' ? tenants : tenants.filter(t=>t.status===tenantFilter)
  , [tenants, tenantFilter]);

  const isMobile = useMobile();
  const checkBeforeDelete = (type, id) => {
    if (type === 'property') {
      const txCount = transactions.filter(t => t.propertyId === id).length;
      const tCount  = tenants.filter(t => t.propertyId === id).length;
      if (txCount + tCount > 0) {
        alert(`❌ Cannot delete — this property has ${txCount} transaction(s) and ${tCount} tenant(s). Delete those first.`);
        return false;
      }
    }
    if (type === 'tenant') {
      const txCount = transactions.filter(t => t.tenantId === id).length;
      if (txCount > 0) {
        alert(`❌ Cannot delete — this tenant has ${txCount} transaction(s). Delete those first.`);
        return false;
      }
    }
    return true;
  };

  const handleSaveProp   = async d => { if(propModal.initial){ await propertyService.update(propModal.initial.id,d); writeAudit('update','properties',`Updated property: ${d.name}`); }else{ await propertyService.add(d); writeAudit('create','properties',`Added property: ${d.name}`); } load(); };
  const handleSaveTenant = async d => { if(tenantModal.initial){ await tenantService.update(tenantModal.initial.id,d); writeAudit('update','tenants',`Updated tenant: ${d.name}`); }else{ await tenantService.add(d); writeAudit('create','tenants',`Added tenant: ${d.name}`); } load(); };
  const handleSaveTx = async d => {
    if (!d.date)       { alert('Please enter a date');        return; }
    if (!d.type)       { alert('Please select income/expense'); return; }
    if (!d.amount || Number(d.amount) <= 0) { alert('Please enter a valid amount'); return; }
    if (!d.propertyId) { alert('Please select a property');   return; }
    if (txModal.initial) {
      await rentalService.update(txModal.initial.id, d);
      writeAudit('update','rental_transactions',`Updated ${d.type}: ${d.amount} for property on ${d.date}`);
    } else {
      await rentalService.add(d);
      writeAudit('create','rental_transactions',`Added ${d.type}: ${d.amount} for property on ${d.date}`);
    }
    load();
  };

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
            <PeriodBar period={dashPeriod} onChange={setDashPeriod} />

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

            {/* Labour vs Material breakdown */}
            {(() => {
              const labour   = periodTx.filter(t=>t.type==='expense'&&t.costType==='Labour');
              const material = periodTx.filter(t=>t.type==='expense'&&(t.costType==='Material'||!t.costType));
              const labourAmt   = labour.reduce((s,t)=>s+Number(t.amount),0);
              const materialAmt = material.reduce((s,t)=>s+Number(t.amount),0);
              const personDays  = labour.reduce((s,t)=>s+(Number(t.persons||0)*Number(t.days||1)),0);
              if (labourAmt===0 && materialAmt===0) return null;
              return (
                <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:16,marginBottom:24}}>
                  <div className="card" style={{borderTop:'3px solid #5e88c8'}}>
                    <div style={{fontWeight:700,fontSize:'0.85rem',color:'#5e88c8',marginBottom:8}}>👷 Labour Cost</div>
                    <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--danger)'}}>{fmt(labourAmt)}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:4}}>{labour.length} entries · {personDays.toFixed(1)} person-days</div>
                    {labour.slice(0,3).map((e,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'0.74rem',marginTop:6,color:'var(--muted)'}}>
                        <span>{e.date} · {e.persons||1}p × {e.days||1}d</span>
                        <span style={{color:'var(--danger)'}}>{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="card" style={{borderTop:'3px solid var(--accent)'}}>
                    <div style={{fontWeight:700,fontSize:'0.85rem',color:'var(--accent)',marginBottom:8}}>🧱 Material Cost</div>
                    <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--danger)'}}>{fmt(materialAmt)}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:4}}>{material.length} entries</div>
                    {material.slice(0,3).map((e,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'0.74rem',marginTop:6,color:'var(--muted)'}}>
                        <span>{e.date} · {e.category}</span>
                        <span style={{color:'var(--danger)'}}>{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
                            <button className="btn btn-danger btn-sm" onClick={async()=>{ if(!checkBeforeDelete('property',p.id)) return; if(window.confirm(`Delete "${p.name}"?`)){await propertyService.delete(p.id); writeAudit('delete','properties',`Deleted property: ${p.name}`); load();}}}><Trash2 size={12}/></button>
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
                            <button className="btn btn-danger btn-sm" onClick={async()=>{ if(!checkBeforeDelete('tenant',t.id)) return; if(window.confirm('Delete?')){await tenantService.delete(t.id); writeAudit('delete','tenants',`Deleted tenant: ${t.name||t.id}`); load();}}}><Trash2 size={12}/></button>
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
            {/* ── Inline quick-add form ── */}
            <div className="card" style={{marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:'0.95rem',marginBottom:12}}>+ Log Transaction</div>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                {['income','expense'].map(t=>(
                  <button key={t} type="button" onClick={()=>setTF('type',t)}
                    style={{flex:1,padding:'8px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:'0.85rem',
                      border:`2px solid ${txForm.type===t?(t==='income'?'var(--success)':'var(--danger)'):'var(--border)'}`,
                      background:txForm.type===t?(t==='income'?'rgba(76,175,128,0.12)':'rgba(184,74,46,0.12)'):'var(--surface2)',
                      color:txForm.type===t?(t==='income'?'var(--success)':'var(--danger)'):'var(--muted)'}}>
                    {t==='income'?'↑ Income':'↓ Expense'}
                  </button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                <div className="form-group" style={{margin:0}}>
                  <label>Date</label>
                  <input type="date" value={txForm.date} onChange={e=>setTF('date',e.target.value)}/>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Property</label>
                  <select value={txForm.propertyId} onChange={e=>setTF('propertyId',e.target.value)}>
                    <option value="">Select…</option>
                    {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Category</label>
                  <select value={txForm.category} onChange={e=>setTF('category',e.target.value)}>
                    <option value="">Select…</option>
                    {(txForm.type==='income'?INCOME_CATS:EXPENSE_CATS).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {txForm.type==='expense' && (
                <div style={{marginBottom:10}}>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    {['Labour','Material'].map(t=>(
                      <button key={t} type="button" onClick={()=>setTF('costType',t)}
                        style={{flex:1,padding:'7px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:'0.82rem',
                          border:`2px solid ${txForm.costType===t?'var(--accent)':'var(--border)'}`,
                          background:txForm.costType===t?'rgba(201,168,76,0.15)':'var(--surface2)',
                          color:txForm.costType===t?'var(--accent)':'var(--muted)'}}>
                        {t==='Labour'?'👷 Labour':'🧱 Material'}
                      </button>
                    ))}
                  </div>
                  {txForm.costType==='Labour' && (
                    <div style={{padding:'10px 12px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)',marginBottom:6}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:6}}>
                        <div className="form-group" style={{margin:0}}>
                          <label># Persons</label>
                          <input type="number" min="1" value={txForm.persons} onChange={e=>setTF('persons',e.target.value)} placeholder="e.g. 3"/>
                        </div>
                        <div className="form-group" style={{margin:0}}>
                          <label>Rate / Person / Day (₹)</label>
                          <input type="number" value={txForm.ratePerPerson} onChange={e=>setTF('ratePerPerson',e.target.value)} placeholder="e.g. 500"/>
                        </div>
                        <div className="form-group" style={{margin:0}}>
                          <label>Days</label>
                          <input type="number" min="0.5" step="0.5" value={txForm.days} onChange={e=>setTF('days',e.target.value)} placeholder="1"/>
                        </div>
                      </div>
                      {txForm.persons && txForm.ratePerPerson && (
                        <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>
                          {txForm.persons} × ₹{txForm.ratePerPerson}/day × {txForm.days||1}d =
                          <strong style={{color:'var(--accent)',marginLeft:4}}>
                            ₹{((Number(txForm.persons)||0)*(Number(txForm.ratePerPerson)||0)*(Number(txForm.days)||1)).toFixed(0)}
                          </strong>
                          <span style={{marginLeft:6,fontSize:'0.72rem'}}>(auto-fills Amount)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr',gap:10,marginBottom:10}}>
                <div className="form-group" style={{margin:0}}>
                  <label>Description (optional)</label>
                  <input value={txForm.description} onChange={e=>setTF('description',e.target.value)} placeholder="Notes…"/>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Amount (₹) *</label>
                  <input type="number" step="0.01" min="0" value={txForm.amount} onChange={e=>setTF('amount',e.target.value)} placeholder="0"/>
                </div>
              </div>
              <button className="btn btn-primary" onClick={saveTxInline}>💾 Save Transaction</button>
            </div>
            {/* ── Transactions filter ── */}
            <div style={{marginBottom:16}}>
              <PeriodBar period={txPeriod} onChange={setTxPeriod} />
            </div>
            <div style={{marginBottom:16}}>
              <select value={propFilter} onChange={e=>setPropFilter(e.target.value)}
                style={{padding:'5px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface2)',color:'var(--text)',fontSize:'0.82rem'}}>
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
                    {[...filteredTx].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(t=>{
                      const propName=properties.find(p=>p.id===t.propertyId)?.name||'—';
                      return(
                        <tr key={t.id}>
                          <td style={{ whiteSpace:'nowrap' }}>{t.date}</td>
                          <td>
                            <span className={`badge ${t.type==='income'?'badge-income':'badge-expense'}`}>{t.type==='income'?'↑ Income':'↓ Expense'}</span>
                            {t.type==='expense' && (
                              <span style={{marginLeft:4,padding:'1px 6px',borderRadius:4,fontSize:'0.7rem',fontWeight:600,
                                background:t.costType==='Labour'?'rgba(94,136,200,0.15)':'rgba(201,168,76,0.15)',
                                color:t.costType==='Labour'?'#5e88c8':'var(--accent)'}}>
                                {t.costType==='Labour'?'👷':'🧱'} {t.costType||'Material'}
                              </span>
                            )}
                            {t.costType==='Labour' && t.persons && (
                              <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:2}}>
                                {t.persons}p × ₹{t.ratePerPerson}/d × {t.days||1}d
                              </div>
                            )}
                          </td>
                          <td>{t.category}</td>
                          <td style={{ fontSize:'0.82rem', color:'var(--muted)' }}>{propName}</td>
                          <td style={{ fontSize:'0.82rem', color:'var(--muted)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description||'—'}</td>
                          <td className={`amount-cell ${t.type==='income'?'income-text':'expense-text'}`} style={{ textAlign:'right', fontWeight:600 }}>
                            {t.type==='income'?'+':'-'}{fmt(t.amount)}
                          </td>
                          {isAdmin&&<td><div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setTxModal({open:true,initial:t})}><Pencil size={12}/></button>
                            <button className="btn btn-danger btn-sm" onClick={async()=>{ if(window.confirm('Delete?')){await rentalService.delete(t.id); writeAudit('delete','rental_transactions',`Deleted transaction ${t.id}`); load();}}}><Trash2 size={12}/></button>
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
