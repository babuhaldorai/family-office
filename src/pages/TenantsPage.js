import React, { useEffect, useState } from 'react';
import { tenantService, propertyService } from '../utils/firestoreService';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { fmt } from '../utils/finance';

function TenantModal({ open, onClose, onSave, initial, properties }) {
  const empty = { name:'', email:'', phone:'', propertyId:'', leaseStart:'', leaseEnd:'', monthlyRent:'', deposit:'', status:'active', notes:'' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if(open) setForm(initial?{...empty,...initial}:empty); }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = async () => {
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <span className="modal-title">{initial?'Edit':'Add'} Tenant</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>Full Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="John Doe"/></div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e=>set('status',e.target.value)}>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
                <option value="notice">Notice Period</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e=>set('phone',e.target.value)}/></div>
          </div>
          <div className="form-group">
            <label>Property</label>
            <select value={form.propertyId} onChange={e=>set('propertyId',e.target.value)}>
              <option value="">Select property…</option>
              {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Lease Start</label><input type="date" value={form.leaseStart} onChange={e=>set('leaseStart',e.target.value)}/></div>
            <div className="form-group"><label>Lease End</label><input type="date" value={form.leaseEnd} onChange={e=>set('leaseEnd',e.target.value)}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Monthly Rent (₹)</label><input type="number" value={form.monthlyRent} onChange={e=>set('monthlyRent',e.target.value)}/></div>
            <div className="form-group"><label>Security Deposit (₹)</label><input type="number" value={form.deposit} onChange={e=>set('deposit',e.target.value)}/></div>
          </div>
          <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2}/></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.name}>{saving?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const { isAdmin } = useAuth();
  const [tenants, setTenants]       = useState([]);
  const [properties, setProperties] = useState([]);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [filter, setFilter]         = useState('all');

  const load = async () => {
    const [t, p] = await Promise.all([tenantService.getAll(), propertyService.getAll()]);
    setTenants(t); setProperties(p);
  };
  useEffect(() => { load(); }, []);

  const propName = (id) => properties.find(p=>p.id===id)?.name || '—';

  const filtered = filter === 'all' ? tenants : tenants.filter(t=>t.status===filter);

  const handleSave = async (data) => {
    if (editing) await tenantService.update(editing.id, data);
    else         await tenantService.add(data);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this tenant record?')) return;
    await tenantService.delete(id);
    load();
  };

  const daysUntilExpiry = (endDate) => {
    if (!endDate) return null;
    const diff = new Date(endDate) - new Date();
    return Math.ceil(diff / 86400000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Tenants</h1>
          <p className="page-subtitle">Leases & tenant directory</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={()=>{setEditing(null);setModalOpen(true);}}>
            <Plus size={15}/> Add Tenant
          </button>
        )}
      </div>

      <div className="page-body">
        <div className="stat-grid" style={{ marginBottom:20 }}>
          <div className="stat-card income"><div className="stat-label">Active</div><div className="stat-value income-text">{tenants.filter(t=>t.status==='active').length}</div></div>
          <div className="stat-card expense"><div className="stat-label">Notice</div><div className="stat-value">{tenants.filter(t=>t.status==='notice').length}</div></div>
          <div className="stat-card"><div className="stat-label">Total Records</div><div className="stat-value">{tenants.length}</div></div>
          <div className="stat-card net">
            <div className="stat-label">Monthly Rent (Active)</div>
            <div className="stat-value">{fmt(tenants.filter(t=>t.status==='active').reduce((s,t)=>s+Number(t.monthlyRent||0),0))}</div>
          </div>
        </div>

        <div className="tabs">
          {['all','active','notice','ended'].map(f=>(
            <button key={f} className={`tab ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)} {f==='all'?`(${tenants.length})`:`(${tenants.filter(t=>t.status===f).length})`}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tenant</th><th>Property</th><th>Lease Period</th>
                  <th>Monthly Rent</th><th>Deposit</th><th>Status</th><th>Expires In</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>No tenants found.</td></tr>
                )}
                {filtered.map(t => {
                  const days = daysUntilExpiry(t.leaseEnd);
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight:500 }}>{t.name}</div>
                        <div style={{ fontSize:'0.75rem', color:'var(--muted)' }}>{t.email}</div>
                      </td>
                      <td>{propName(t.propertyId)}</td>
                      <td style={{ fontSize:'0.82rem' }}>
                        {t.leaseStart && <span>{t.leaseStart}</span>}
                        {t.leaseStart && t.leaseEnd && <span className="text-muted"> → </span>}
                        {t.leaseEnd && <span>{t.leaseEnd}</span>}
                      </td>
                      <td className="amount-cell">{fmt(t.monthlyRent)}</td>
                      <td className="amount-cell">{fmt(t.deposit)}</td>
                      <td><span className={`badge badge-${t.status==='active'?'active':t.status==='notice'?'expense':'ended'}`}>{t.status}</span></td>
                      <td>
                        {days !== null ? (
                          <span style={{ fontSize:'0.82rem', color: days < 30 ? 'var(--warn)' : days < 0 ? 'var(--danger)' : 'var(--muted)' }}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                          </span>
                        ) : '—'}
                      </td>
                      {isAdmin && (
                        <td>
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>{setEditing(t);setModalOpen(true);}}><Pencil size={12}/></button>
                            <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(t.id)}><Trash2 size={12}/></button>
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

      <TenantModal open={modalOpen} onClose={()=>setModalOpen(false)} onSave={handleSave} initial={editing} properties={properties}/>
    </div>
  );
}
