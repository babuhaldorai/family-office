import { useMobile } from '../hooks/useMobile';
import React, { useEffect, useState, useMemo } from 'react';
import HomeYOY from './HomeYOY';
import { homePropertyService, homeExpenseService, HOME_CATEGORIES } from '../utils/homeService';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { fmt } from '../utils/finance';

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
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
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
  const empty = { date: new Date().toISOString().slice(0,10), propertyId: '', category: HOME_CATEGORIES[0], amount: '', contractor: '', description: '' };
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

// ── Period filter bar ─────────────────────────────────────────────────────────
const PERIOD_OPTS = [
  { key:'this_month', label:'This Month' },
  { key:'last_month', label:'Last Month' },
  { key:'ytd',        label:'YTD'        },
  { key:'last_year',  label:'Last Year'  },
  { key:'all',        label:'All Time'   },
];

function PeriodBar({ period, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'10px 14px', marginBottom:20 }}>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        {PERIOD_OPTS.map(o => (
          <button key={o.key}
            style={{ padding:'5px 13px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background:period.preset===o.key?'var(--accent)':'transparent', color:period.preset===o.key?'#0f1117':'var(--muted)', fontSize:'0.8rem', fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .15s' }}
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
export default function HomesPage() {
  const isMobile = useMobile();
  const { isAdmin } = useAuth();
  const [properties, setProperties] = useState([]);
  const [expenses, setExpenses]     = useState([]);
  const [tab, setTab]               = useState('overview');
  const [periodKey, setPeriodKey]   = useState('ytd');
  const [propFilter, setPropFilter] = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [propModal, setPropModal]   = useState({ open:false, initial:null });
  const [expModal,  setExpModal]    = useState({ open:false, initial:null });
  const [loading, setLoading]       = useState(true);

  const load = async () => {
    setLoading(true);
    const [p, e] = await Promise.all([homePropertyService.getAll(), homeExpenseService.getAll()]);
    setProperties(p); setExpenses(e); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Period bounds
  const period = useMemo(() => {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const f2  = d => d.toISOString().slice(0,10);
    const bounds = {
      this_month: { from:f2(new Date(y,m,1)),   to:f2(new Date(y,m+1,0))  },
      last_month: { from:f2(new Date(y,m-1,1)), to:f2(new Date(y,m,0))    },
      ytd:        { from:`${y}-01-01`,            to:f2(now)                },
      last_year:  { from:`${y-1}-01-01`,          to:`${y-1}-12-31`         },
      all:        { from:'2000-01-01',             to:'2099-12-31'           },
    };
    const labels = {
      this_month: new Date(y,m,1).toLocaleString('en-IN',{month:'long',year:'numeric'}),
      last_month: new Date(y,m-1,1).toLocaleString('en-IN',{month:'long',year:'numeric'}),
      ytd:        `Jan – ${now.toLocaleString('en-IN',{month:'short'})} ${y} (YTD)`,
      last_year:  `${y-1} (full year)`,
      all:        'All Time',
    };
    return { preset:periodKey, ...bounds[periodKey], label:labels[periodKey] };
  }, [periodKey]);

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
  const filtTotal   = filteredExp.reduce((s,e) => s+Number(e.amount||0), 0);
  const allTime     = expenses.reduce((s,e) => s+Number(e.amount||0), 0);

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

  const handleSaveProp = async d => { if(propModal.initial) await homePropertyService.update(propModal.initial.id,d); else await homePropertyService.add(d); load(); };
  const handleSaveExp  = async d => { if(expModal.initial) await homeExpenseService.update(expModal.initial.id,d); else await homeExpenseService.add(d); load(); };
  const deleteProp     = async id => { if(!window.confirm('Delete this home?')) return; await homePropertyService.delete(id); load(); };
  const deleteExp      = async id => { if(!window.confirm('Delete this expense?')) return; await homeExpenseService.delete(id); load(); };

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
            <PeriodBar period={period} onChange={setPeriodKey} />

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

            {/* Category breakdown */}
            {catBreakdown.length > 0 && (
              <div className="card">
                <div className="section-title">By Category — {period.label}</div>
                {catBreakdown.map(([cat,amt]) => (
                  <div key={cat} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', marginBottom:4 }}>
                      <span style={{ fontWeight:500 }}>{cat}</span>
                      <span style={{ color:'var(--danger)' }}>{fmt(amt)} <span style={{ color:'var(--muted)', fontWeight:400 }}>({periodTotal>0?((amt/periodTotal)*100).toFixed(1):0}%)</span></span>
                    </div>
                    <div style={{ height:5, background:'var(--surface2)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${periodTotal>0?(amt/periodTotal)*100:0}%`, background:'var(--warn)', borderRadius:3 }} />
                    </div>
                  </div>
                ))}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:'0.875rem' }}>
                  <span>Total</span><span style={{ color:'var(--danger)' }}>{fmt(periodTotal)}</span>
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
            {isAdmin && <div style={{ marginBottom:16 }}><button className="btn btn-primary" onClick={()=>setExpModal({open:true,initial:null})}><Plus size={14}/> Log Expense</button></div>}

            <PeriodBar period={period} onChange={setPeriodKey} />

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
                    <tr><th>Date</th><th>Home</th><th>Category</th><th>Contractor</th><th>Description</th><th style={{ textAlign:'right' }}>Amount</th>{isAdmin&&<th></th>}</tr>
                  </thead>
                  <tbody>
                    {filteredExp.length===0&&<tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>No expenses for this period.</td></tr>}
                    {filteredExp.map(e=>(
                      <tr key={e.id}>
                        <td style={{ whiteSpace:'nowrap' }}>{e.date}</td>
                        <td style={{ fontWeight:500 }}>{propName(e.propertyId)}</td>
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
                        <td colSpan={5} style={{ textAlign:'right', color:'var(--muted)', fontSize:'0.78rem' }}>TOTAL</td>
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
            <PeriodBar period={period} onChange={setPeriodKey} />
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
