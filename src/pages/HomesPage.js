import { useMobile } from '../hooks/useMobile';
import { db } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState, useMemo } from 'react';
import HomeYOY from './HomeYOY';
import { homePropertyService, homeExpenseService, HOME_CATEGORIES } from '../utils/homeService';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { fmt } from '../utils/finance';
import PeriodBar, { calcBounds } from '../components/PeriodBar';

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
  const empty = { name: '', address: '', notes: '' };
  const [form, setForm]   = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initial ? { ...empty, ...initial } : empty); }, [open]); // eslint-disable-line
  const set = (k, v) => setForm(f => {
    const updated = { ...f, [k]: v };
    // Auto-calc labour amount
    if (['persons','ratePerPerson','days'].includes(k) && updated.costType === 'Labour') {
      const amt = (Number(updated.persons)||0) * (Number(updated.ratePerPerson)||0) * (Number(updated.days)||1);
      updated.amount = amt > 0 ? String(amt) : updated.amount;
    }
    return updated;
  });
  const save = async () => {
    if (!form.name) return alert('Enter property name');
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Home' : 'Add Home'}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
      <div className="form-group"><label>Home Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ooty House, Chennai Flat" /></div>
      <div className="form-group"><label>Address</label><textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} /></div>
      <div className="form-group"><label>Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
    </Modal>
  );
}

// ── Expense modal ─────────────────────────────────────────────────────────────
function ExpenseModal({ open, onClose, onSave, initial, properties }) {
  const empty = { date: new Date().toISOString().slice(0,10), propertyId: '', category: HOME_CATEGORIES[0], costType: 'Material', persons: '', ratePerPerson: '', days: '1', amount: '', contractor: '', description: '' };
  const [form, setForm]   = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initial ? { ...empty, ...initial } : { ...empty, propertyId: properties[0]?.id || '' }); }, [open]); // eslint-disable-line
  const set = (k, v) => setForm(f => {
    const updated = { ...f, [k]: v };
    // Auto-calc labour amount
    if (['persons','ratePerPerson','days'].includes(k) && updated.costType === 'Labour') {
      const amt = (Number(updated.persons)||0) * (Number(updated.ratePerPerson)||0) * (Number(updated.days)||1);
      updated.amount = amt > 0 ? String(amt) : updated.amount;
    }
    return updated;
  });
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
      <div className="form-group">
        <label>Cost Type *</label>
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
      {form.costType==='Labour' && (
        <div style={{padding:'12px 14px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)',marginBottom:8}}>
          <div style={{fontSize:'0.8rem',fontWeight:600,color:'var(--text)',marginBottom:10}}>👷 Labour Details</div>
          <div className="form-row">
            <div className="form-group">
              <label># Persons</label>
              <input type="number" min="1" value={form.persons} onChange={e=>set('persons',e.target.value)} placeholder="e.g. 3"/>
            </div>
            <div className="form-group">
              <label>Rate / Person / Day (₹)</label>
              <input type="number" step="0.01" value={form.ratePerPerson} onChange={e=>set('ratePerPerson',e.target.value)} placeholder="e.g. 500"/>
            </div>
            <div className="form-group">
              <label>Days</label>
              <input type="number" min="1" step="0.5" value={form.days} onChange={e=>set('days',e.target.value)} placeholder="1"/>
            </div>
          </div>
          {form.persons && form.ratePerPerson && (
            <div style={{fontSize:'0.82rem',color:'var(--muted)',marginTop:4}}>
              {form.persons} persons × ₹{form.ratePerPerson}/day × {form.days||1} day(s) =
              <strong style={{color:'var(--accent)',marginLeft:4}}>
                ₹{((Number(form.persons)||0)*(Number(form.ratePerPerson)||0)*(Number(form.days)||1)).toFixed(0)}
              </strong>
              <span style={{fontSize:'0.75rem',color:'var(--muted)',marginLeft:6}}>(auto-filled in Amount below)</span>
            </div>
          )}
        </div>
      )}
      <div className="form-group"><label>Contractor / Vendor</label><input value={form.contractor} onChange={e => set('contractor', e.target.value)} placeholder="Who did the work" /></div>
      <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
    </Modal>
  );
}

// ── Period filter bar ─────────────────────────────────────────────────────────


// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomesPage() {
  const isMobile = useMobile();
  const { isAdmin, user: authUser } = useAuth();
  const [period, setPeriod] = useState({ preset:'ytd', ...calcBounds('ytd') });
  const userEmail = authUser?.email || 'unknown';
  const writeAudit = (action, col, summary) => {
    addDoc(collection(db, 'audit_log'), {
      action, collection: col,
      summary: summary || '',
      userEmail,
      timestamp: serverTimestamp(),
    }).catch(e => console.error('[Audit fail]', e.code, e.message));
  };
  const [properties, setProperties] = useState([]);
  const [expenses, setExpenses]     = useState([]);
  const [tab, setTab]               = useState('overview');
  const [propFilter, setPropFilter] = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [propModal, setPropModal]   = useState({ open:false, initial:null });
  const [expModal,  setExpModal]    = useState({ open:false, initial:null });

  // Inline quick-add expense form
  const expEmpty = { date: new Date().toISOString().slice(0,10), propertyId: '', category: HOME_CATEGORIES[0], costType: 'Material', persons: '', ratePerPerson: '', days: '1', amount: '', contractor: '', description: '' };
  const [expForm, setExpForm] = useState(expEmpty);
  const setEF = (k, v) => setExpForm(f => {
    const u = { ...f, [k]: v };
    if (['persons','ratePerPerson','days'].includes(k) && u.costType === 'Labour') {
      const amt = (Number(u.persons)||0) * (Number(u.ratePerPerson)||0) * (Number(u.days)||1);
      if (amt > 0) u.amount = String(amt);
    }
    return u;
  });
  const saveExpInline = async () => {
    if (!expForm.propertyId) return alert('Select a home.');
    if (!expForm.amount || Number(expForm.amount) <= 0) return alert('Enter a valid amount.');
    await handleSaveExp(expForm);
    setExpForm({ ...expEmpty, propertyId: expForm.propertyId });
  };
  const [loading, setLoading]       = useState(true);

  const load = async () => {
    setLoading(true);
    const [p, e] = await Promise.all([homePropertyService.getAll(), homeExpenseService.getAll()]);
    setProperties(p); setExpenses(e); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Period bounds

  const checkBeforeDelete = (type, id) => {
    if (type === 'property') {
      const expCount = expenses.filter(e => e.propertyId === id).length;
      if (expCount > 0) {
        alert(`❌ Cannot delete — this home has ${expCount} expense record(s). Delete those first.`);
        return false;
      }
    }
    return true;
  };

  const propName = id => properties.find(p => p.id === id)?.name || '—';

  // Period-filtered expenses
  const periodExp = useMemo(() =>
    expenses.filter(e => e.date && e.date >= period.from && e.date <= period.to)
  , [expenses, period]);

  // Filtered for log tab
  const filteredExp = useMemo(() => {
    let e = periodExp;
    if (propFilter) e = e.filter(x => x.propertyId === propFilter);
    if (catFilter)  e = e.filter(x => x.category   === catFilter);
    return e;
  }, [periodExp, propFilter, catFilter]);

  const periodTotal = periodExp.reduce((s,e) => s+Number(e.amount||0), 0);
  const filtTotal      = filteredExp.reduce((s,e) => s+Number(e.amount||0), 0);
  const allTime        = expenses.reduce((s,e) => s+Number(e.amount||0), 0);
  const labourEntries  = filteredExp.filter(e => e.costType === 'Labour');
  const labourExp      = labourEntries.reduce((s,e) => s+Number(e.amount||0), 0);
  const materialExp    = filteredExp.filter(e => e.costType !== 'Labour').reduce((s,e) => s+Number(e.amount||0), 0);
  const totalPersonDays = labourEntries.reduce((s,e) => s+(Number(e.persons||0)*Number(e.days||1)), 0);

  // Per-property stats for selected period
  const propStats = useMemo(() => properties.map(p => {
    const pe = periodExp.filter(e => e.propertyId === p.id);
    return {
      ...p,
      periodTotal: pe.reduce((s,e)=>s+Number(e.amount||0),0),
      allTime:     expenses.filter(e=>e.propertyId===p.id).reduce((s,e)=>s+Number(e.amount||0),0),
      count:       pe.length,
    };
  }).sort((a,b) => b.periodTotal - a.periodTotal), [properties, periodExp, expenses]);

  // Category breakdown for selected period
  const catBreakdown = useMemo(() => {
    const map = {};
    filteredExp.forEach(e => { const k=e.category||'Other'; map[k]=(map[k]||0)+Number(e.amount||0); });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  }, [filteredExp]);



  const handleSaveProp = async d => {
    if (propModal.initial) { await homePropertyService.update(propModal.initial.id,d); writeAudit('update','home_properties',`Updated home: ${d.name}`); }
    else { await homePropertyService.add(d); writeAudit('create','home_properties',`Added home: ${d.name}`); }
    load();
  };
  const handleSaveExp = async d => {
    if (expModal.initial) {
      await homeExpenseService.update(expModal.initial.id, d);
      writeAudit('update','home_expenses',`Updated ${d.category}: ₹${d.amount} on ${d.date}`);
    } else {
      await homeExpenseService.add(d);
      writeAudit('create','home_expenses',`Added ${d.category}: ₹${d.amount} on ${d.date}`);
    }
    load();
  };
  const deleteProp = async id => { if(!checkBeforeDelete('property',id)) return; if(!window.confirm('Delete this home?')) return; await homePropertyService.delete(id); writeAudit('delete','home_properties',`Deleted home ${id}`); load(); };
  const deleteExp = async id => {
    if (!window.confirm('Delete this expense?')) return;
    await homeExpenseService.delete(id);
    writeAudit('delete','home_expenses',`Deleted expense ${id}`);
    load();
  };

  const TABS = [
    { key:'overview',  label:'⌂ Overview'    },
    { key:'homes',     label:'🏠 Homes'       },
    { key:'expenses',  label:'₹ Expenses'    },
    { key:'breakdown', label:'◎ By Category' },
    { key:'yoy',       label:'📈 YOY'         },
  ];

  if (loading) return <div style={{ padding:40, color:'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🔧 Home Maintenance</h1>
          <p className="page-subtitle">{properties.length} homes · {fmt(allTime)} total spent all-time</p>
        </div>
      </div>

      <div className="page-content-inner">

        {/* Tabs at top */}
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.key} className={`tab ${tab===t.key?'active':''}`} onClick={()=>setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab==='overview' && (
          <div>
            <PeriodBar period={period} onChange={setPeriod} />

            {/* KPI strip */}
            <div className="stat-grid" style={{ marginBottom:24 }}>
              <div className="stat-card expense">
                <div className="stat-label">Total Spent — {period.label}</div>
                <div className="stat-value expense-text">{fmt(periodTotal)}</div>
                <div className="stat-sub">{periodExp.length} entries</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Homes Tracked</div>
                <div className="stat-value">{properties.length}</div>
                <div className="stat-sub">Across all properties</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Largest Spender</div>
                <div className="stat-value" style={{ fontSize:'1.1rem' }}>{propStats[0]?.name||'—'}</div>
                <div className="stat-sub expense-text">{propStats[0]?fmt(propStats[0].periodTotal):'—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">All-Time Total</div>
                <div className="stat-value">{fmt(allTime)}</div>
                <div className="stat-sub">All years combined</div>
              </div>
            </div>

            {/* Property cards */}
            {propStats.length === 0
              ? <div className="empty-state"><p>No homes yet. Add one in the Homes tab.</p></div>
              : <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(280px,1fr))',gap:isMobile?12:16,marginBottom:24}}>
                  {propStats.map(p => {
                    const maxT = Math.max(...propStats.map(x=>x.periodTotal), 1);
                    return (
                      <div key={p.id} className="card" style={{ borderLeft:'3px solid var(--warn)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                          <div>
                            <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{p.name}</div>
                            {p.address && <div style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:2 }}>{p.address}</div>}
                          </div>
                          {isAdmin && (
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setPropModal({open:true,initial:p})}><Pencil size={11}/></button>
                              <button className="btn btn-danger btn-sm" onClick={()=>deleteProp(p.id)}><Trash2 size={11}/></button>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--danger)', marginBottom:4 }}>{fmt(p.periodTotal)}</div>
                        <div style={{ fontSize:'0.75rem', color:'var(--muted)', marginBottom:8 }}>
                          {period.label} · {p.count} entries · All-time: {fmt(p.allTime)}
                        </div>
                        <div style={{ height:5, background:'var(--surface2)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${maxT>0?(p.periodTotal/maxT)*100:0}%`, background:'var(--warn)', borderRadius:3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
            }

            {/* Category breakdown with Labour/Material split */}
            {catBreakdown.length > 0 && (
              <div className="card" style={{marginBottom:16}}>
                <div className="section-title">By Category — {period.label}</div>
                {catBreakdown.map(([cat, amt]) => {
                  const catExp    = filteredExp.filter(e => (e.category||'Other') === cat);
                  const catLabourEntries = catExp.filter(e => e.costType==='Labour');
                  const catLabour = catLabourEntries.reduce((s,e)=>s+Number(e.amount||0),0);
                  const catMat    = catExp.filter(e => e.costType!=='Labour').reduce((s,e)=>s+Number(e.amount||0),0);
                  const catPDs    = catLabourEntries.reduce((s,e)=>s+(Number(e.persons||0)*Number(e.days||1)),0);
                  const avgRate   = catPDs > 0 ? catLabour / catPDs : 0;
                  return (
                    <div key={cat} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--border)'}}>
                      {/* Category header */}
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.88rem',marginBottom:6}}>
                        <span style={{fontWeight:600}}>{cat}</span>
                        <span style={{color:'var(--danger)',fontWeight:600}}>
                          {fmt(amt)}
                          <span style={{color:'var(--muted)',fontWeight:400,marginLeft:6}}>
                            ({periodTotal>0?((amt/periodTotal)*100).toFixed(1):0}%)
                          </span>
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{height:5,background:'var(--surface2)',borderRadius:3,overflow:'hidden',marginBottom:8}}>
                        <div style={{height:'100%',width:`${periodTotal>0?(amt/periodTotal)*100:0}%`,background:'var(--warn)',borderRadius:3}}/>
                      </div>
                      {/* Labour / Material sub-breakdown */}
                      {(catLabour > 0 || catMat > 0) && (
                        <div style={{display:'flex',gap:8}}>
                          {catLabour > 0 && (
                            <div style={{flex:1,padding:'6px 10px',background:'rgba(94,136,200,0.08)',borderRadius:6,border:'1px solid rgba(94,136,200,0.2)'}}>
                              <div style={{fontSize:'0.72rem',color:'#5e88c8',fontWeight:600,marginBottom:2}}>👷 Labour</div>
                              <div style={{fontSize:'0.88rem',fontWeight:700,color:'var(--danger)'}}>{fmt(catLabour)}</div>
                              {catPDs > 0 && <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:2}}>{catPDs.toFixed(1)} person-days</div>}
                              {avgRate > 0 && <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:1}}>Avg ₹{avgRate.toFixed(0)}/person-day</div>}
                            </div>
                          )}
                          {catMat > 0 && (
                            <div style={{flex:1,padding:'6px 10px',background:'rgba(201,168,76,0.08)',borderRadius:6,border:'1px solid rgba(201,168,76,0.2)'}}>
                              <div style={{fontSize:'0.72rem',color:'var(--accent)',fontWeight:600,marginBottom:2}}>🧱 Materials</div>
                              <div style={{fontSize:'0.88rem',fontWeight:700,color:'var(--danger)'}}>{fmt(catMat)}</div>
                              <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:2}}>{catExp.filter(e=>e.costType!=='Labour').length} entries</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:'0.875rem',paddingTop:4}}>
                  <span>Total</span><span style={{color:'var(--danger)'}}>{fmt(periodTotal)}</span>
                </div>
              </div>
            )}

            {/* Labour vs Material summary tiles — bottom */}
            {(labourExp>0||materialExp>0) && (
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:16}}>
                <div className="card" style={{borderTop:'3px solid #5e88c8'}}>
                  <div style={{fontWeight:700,fontSize:'0.85rem',color:'#5e88c8',marginBottom:8}}>👷 Labour Total</div>
                  <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--danger)'}}>{fmt(labourExp)}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:4}}>{labourEntries.length} entries · {totalPersonDays.toFixed(1)} person-days</div>
                  {labourEntries.slice(0,3).map((e,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'0.74rem',marginTop:6,color:'var(--muted)'}}>
                      <span>{e.date} · {e.persons||1}p × {e.days||1}d</span>
                      <span style={{color:'var(--danger)'}}>{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="card" style={{borderTop:'3px solid var(--accent)'}}>
                  <div style={{fontWeight:700,fontSize:'0.85rem',color:'var(--accent)',marginBottom:8}}>🧱 Materials Total</div>
                  <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--danger)'}}>{fmt(materialExp)}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:4}}>{filteredExp.filter(e=>e.costType!=='Labour').length} entries</div>
                  {filteredExp.filter(e=>e.costType!=='Labour').slice(0,3).map((e,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'0.74rem',marginTop:6,color:'var(--muted)'}}>
                      <span>{e.date} · {e.category}</span>
                      <span style={{color:'var(--danger)'}}>{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ HOMES ══ */}
        {tab==='homes' && (
          <div>
            {isAdmin && <div style={{ marginBottom:16 }}><button className="btn btn-primary" onClick={()=>setPropModal({open:true,initial:null})}><Plus size={14}/> Add Home</button></div>}
            {properties.length===0
              ? <div className="empty-state"><p>No homes added yet.</p></div>
              : <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(280px,1fr))',gap:isMobile?12:16}}>
                  {properties.map(p => {
                    const aT = expenses.filter(e=>e.propertyId===p.id).reduce((s,e)=>s+Number(e.amount||0),0);
                    return (
                      <div key={p.id} className="card" style={{ borderLeft:'3px solid var(--warn)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                          <div>
                            <div style={{ fontWeight:700, fontSize:'1rem' }}>{p.name}</div>
                            {p.address && <div style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:2 }}>{p.address}</div>}
                            {p.notes   && <div style={{ fontSize:'0.75rem', color:'var(--muted)'                }}>{p.notes}</div>}
                          </div>
                          {isAdmin && (
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setPropModal({open:true,initial:p})}><Pencil size={12}/> Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={()=>deleteProp(p.id)}><Trash2 size={12}/></button>
                            </div>
                          )}
                        </div>
                        {[
                          ['All-time spent', fmt(aT)],
                          ['Total entries',  expenses.filter(e=>e.propertyId===p.id).length],
                        ].map(([l,v])=>(
                          <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:'0.83rem' }}>
                            <span style={{ color:'var(--muted)' }}>{l}</span>
                            <span style={{ fontWeight:600 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}

        {/* ══ EXPENSES ══ */}
        {tab==='expenses' && (
          <div>
            {/* Inline quick-add form */}
            <div className="card" style={{marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:'0.95rem',marginBottom:12}}>+ Log Expense</div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                <div className="form-group" style={{margin:0}}>
                  <label>Date</label>
                  <input type="date" value={expForm.date} onChange={e=>setEF('date',e.target.value)}/>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Home</label>
                  <select value={expForm.propertyId} onChange={e=>setEF('propertyId',e.target.value)}>
                    <option value="">Select…</option>
                    {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Category</label>
                  <select value={expForm.category} onChange={e=>setEF('category',e.target.value)}>
                    {HOME_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{display:'flex',gap:8,marginBottom:8}}>
                  {['Labour','Material'].map(t=>(
                    <button key={t} type="button" onClick={()=>setEF('costType',t)}
                      style={{flex:1,padding:'7px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:'0.82rem',
                        border:`2px solid ${expForm.costType===t?'var(--accent)':'var(--border)'}`,
                        background:expForm.costType===t?'rgba(201,168,76,0.15)':'var(--surface2)',
                        color:expForm.costType===t?'var(--accent)':'var(--muted)'}}>
                      {t==='Labour'?'👷 Labour':'🧱 Material'}
                    </button>
                  ))}
                </div>
                {expForm.costType==='Labour' && (
                  <div style={{padding:'10px 12px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)',marginBottom:6}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:6}}>
                      <div className="form-group" style={{margin:0}}>
                        <label># Persons</label>
                        <input type="number" min="1" value={expForm.persons} onChange={e=>setEF('persons',e.target.value)} placeholder="e.g. 3"/>
                      </div>
                      <div className="form-group" style={{margin:0}}>
                        <label>Rate / Person / Day (₹)</label>
                        <input type="number" value={expForm.ratePerPerson} onChange={e=>setEF('ratePerPerson',e.target.value)} placeholder="e.g. 500"/>
                      </div>
                      <div className="form-group" style={{margin:0}}>
                        <label>Days</label>
                        <input type="number" min="0.5" step="0.5" value={expForm.days} onChange={e=>setEF('days',e.target.value)} placeholder="1"/>
                      </div>
                    </div>
                    {expForm.persons && expForm.ratePerPerson && (
                      <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>
                        {expForm.persons} × ₹{expForm.ratePerPerson}/day × {expForm.days||1}d =
                        <strong style={{color:'var(--accent)',marginLeft:4}}>
                          ₹{((Number(expForm.persons)||0)*(Number(expForm.ratePerPerson)||0)*(Number(expForm.days)||1)).toFixed(0)}
                        </strong>
                        <span style={{marginLeft:6,fontSize:'0.72rem'}}>(auto-fills Amount)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr',gap:10,marginBottom:10}}>
                <div className="form-group" style={{margin:0}}>
                  <label>Contractor / Notes (optional)</label>
                  <input value={expForm.contractor} onChange={e=>setEF('contractor',e.target.value)} placeholder="Who did the work…"/>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Amount (₹) *</label>
                  <input type="number" step="0.01" min="0" value={expForm.amount} onChange={e=>setEF('amount',e.target.value)} placeholder="0"/>
                </div>
              </div>
              <button className="btn btn-primary" onClick={saveExpInline}>💾 Save Expense</button>
            </div>

            <PeriodBar period={period} onChange={setPeriod} />

            {/* Filters */}
            <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
              <select style={{ maxWidth:220 }} value={propFilter} onChange={e=>setPropFilter(e.target.value)}>
                <option value="">All homes</option>
                {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select style={{ maxWidth:200 }} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
                <option value="">All categories</option>
                {HOME_CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>

            {/* KPI */}
            <div className="stat-grid" style={{ marginBottom:20 }}>
              <div className="stat-card expense"><div className="stat-label">Total ({period.label})</div><div className="stat-value expense-text">{fmt(filtTotal)}</div></div>
              <div className="stat-card"><div className="stat-label">Entries</div><div className="stat-value">{filteredExp.length}</div></div>
              <div className="stat-card"><div className="stat-label">All-Time</div><div className="stat-value">{fmt(allTime)}</div></div>
              <div className="stat-card"><div className="stat-label">Homes</div><div className="stat-value">{properties.length}</div></div>
            </div>

            <div className="card" style={{ padding:0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Home</th><th>Type</th><th>Category</th><th>Contractor</th><th>Description</th><th style={{ textAlign:'right' }}>Amount</th>{isAdmin&&<th></th>}</tr>
                  </thead>
                  <tbody>
                    {filteredExp.length===0&&<tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>No expenses for this period.</td></tr>}
                    {[...filteredExp].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>(
                      <tr key={e.id}>
                        <td style={{ whiteSpace:'nowrap' }}>{e.date}</td>
                        <td style={{ fontWeight:500 }}>{propName(e.propertyId)}</td>
                        <td>
                          <span style={{padding:'2px 8px',borderRadius:4,fontSize:'0.72rem',fontWeight:600,
                            background:e.costType==='Labour'?'rgba(94,136,200,0.15)':'rgba(201,168,76,0.15)',
                            color:e.costType==='Labour'?'#5e88c8':'var(--accent)'}}>
                            {e.costType==='Labour'?'👷 Labour':'🧱 Material'}
                          </span>
                        </td>
                        <td><span className="badge badge-vacant">{e.category}</span></td>
                        <td style={{ color:'var(--muted)', fontSize:'0.82rem' }}>{e.contractor||'—'}</td>
                        <td style={{ color:'var(--muted)', fontSize:'0.82rem', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description||'—'}</td>
                        <td className="amount-cell expense-text" style={{ textAlign:'right', fontWeight:600 }}>{fmt(e.amount)}</td>
                        {isAdmin&&<td>
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setExpModal({open:true,initial:e})}><Pencil size={12}/></button>
                            <button className="btn btn-danger btn-sm" onClick={()=>deleteExp(e.id)}><Trash2 size={12}/></button>
                          </div>
                        </td>}
                      </tr>
                    ))}
                    {filteredExp.length>0&&(
                      <tr style={{ background:'var(--surface2)', fontWeight:700 }}>
                        <td colSpan={6} style={{ textAlign:'right', color:'var(--muted)', fontSize:'0.78rem' }}>TOTAL</td>
                        <td className="amount-cell expense-text" style={{ textAlign:'right' }}>{fmt(filtTotal)}</td>
                        {isAdmin&&<td/>}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ BY CATEGORY ══ */}
        {tab==='breakdown' && (
          <div>
            <PeriodBar period={period} onChange={setPeriod} />
            <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
              <select style={{ maxWidth:220 }} value={propFilter} onChange={e=>setPropFilter(e.target.value)}>
                <option value="">All homes</option>
                {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="card">
                <div className="section-title">By Category — {period.label}</div>
                {catBreakdown.length===0&&<div style={{ color:'var(--muted)', fontSize:'0.85rem' }}>No data for this period.</div>}
                {catBreakdown.map(([cat,amt])=>(
                  <div key={cat} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', marginBottom:4 }}>
                      <span style={{ fontWeight:500 }}>{cat}</span>
                      <span style={{ color:'var(--danger)' }}>{fmt(amt)}</span>
                    </div>
                    <div style={{ height:5, background:'var(--surface2)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${filtTotal>0?(amt/filtTotal)*100:0}%`, background:'var(--warn)', borderRadius:3 }} />
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:2 }}>
                      {filtTotal>0?((amt/filtTotal)*100).toFixed(1):0}% of total
                    </div>
                  </div>
                ))}
                {catBreakdown.length>0&&(
                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:'0.875rem' }}>
                    <span>Total</span><span style={{ color:'var(--danger)' }}>{fmt(filtTotal)}</span>
                  </div>
                )}
              </div>
              <div className="card" style={{ padding:0 }}>
                <div style={{ padding:'16px 20px 0', fontWeight:600, fontSize:'1rem' }}>By Home — {period.label}</div>
                <table>
                  <thead><tr><th>Home</th><th>Entries</th><th style={{ textAlign:'right' }}>Period</th><th style={{ textAlign:'right' }}>All-Time</th></tr></thead>
                  <tbody>
                    {propStats.map(p=>(
                      <tr key={p.id}>
                        <td style={{ fontWeight:500 }}>{p.name}</td>
                        <td style={{ color:'var(--muted)' }}>{p.count}</td>
                        <td className="amount-cell expense-text" style={{ textAlign:'right' }}>{fmt(p.periodTotal)}</td>
                        <td className="amount-cell" style={{ textAlign:'right', color:'var(--muted)' }}>{fmt(p.allTime)}</td>
                      </tr>
                    ))}
                    <tr style={{ background:'var(--surface2)', fontWeight:700 }}>
                      <td>Total</td><td></td>
                      <td className="amount-cell expense-text" style={{ textAlign:'right' }}>{fmt(periodTotal)}</td>
                      <td className="amount-cell" style={{ textAlign:'right', color:'var(--muted)' }}>{fmt(allTime)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab==='yoy' && <HomeYOY />}
      </div>

      <PropertyModal open={propModal.open} initial={propModal.initial} onClose={()=>setPropModal({open:false,initial:null})} onSave={handleSaveProp} />
      <ExpenseModal  open={expModal.open}  initial={expModal.initial}  onClose={()=>setExpModal({open:false,initial:null})}  onSave={handleSaveExp} properties={properties} />
    </div>
  );
}
