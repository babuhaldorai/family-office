import React, { useEffect, useState } from 'react';
import { propertyService, tenantService } from '../utils/firestoreService';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Home, X } from 'lucide-react';
import { fmt } from '../utils/finance';

const EMPTY = { name:'', address:'', type:'Residential', monthlyRent:'', description:'' };

function PropertyModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if(open) setForm(initial ? {...EMPTY,...initial} : EMPTY); }, [open, initial]);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const save = async () => { setSaving(true); try { await onSave(form); onClose(); } finally { setSaving(false); } };
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{initial?'Edit':'Add'} Property</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div className="form-group"><label>Property Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Green View Apt 2B"/></div>
          <div className="form-group"><label>Address</label><textarea value={form.address} onChange={e=>set('address',e.target.value)} rows={2}/></div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e=>set('type',e.target.value)}>
                {['Residential','Commercial','Industrial','Agricultural','Other'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Expected Monthly Rent (₹)</label><input type="number" value={form.monthlyRent} onChange={e=>set('monthlyRent',e.target.value)}/></div>
          </div>
          <div className="form-group"><label>Notes</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2}/></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.name}>{saving?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  const { isAdmin } = useAuth();
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants]       = useState([]);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState(null);

  const load = async () => {
    const [p, t] = await Promise.all([propertyService.getAll(), tenantService.getAll()]);
    setProperties(p);
    setTenants(t);
  };
  useEffect(() => { load(); }, []);

  const activeTenantForProperty = (pid) =>
    tenants.find(t => t.propertyId === pid && t.status === 'active');

  const handleSave = async (data) => {
    if (editing) await propertyService.update(editing.id, data);
    else         await propertyService.add(data);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this property? This will not delete related transactions.')) return;
    await propertyService.delete(id);
    load();
  };

  const totalExpectedRent = properties.reduce((s,p) => s + Number(p.monthlyRent||0), 0);
  const occupiedCount = properties.filter(p => activeTenantForProperty(p.id)).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏠 Properties</h1>
          <p className="page-subtitle">Manage your rental portfolio</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus size={15}/> Add Property
          </button>
        )}
      </div>

      <div className="page-body">
        <div className="stat-grid" style={{ marginBottom:24 }}>
          <div className="stat-card rental"><div className="stat-label">Total Properties</div><div className="stat-value">{properties.length}</div></div>
          <div className="stat-card income"><div className="stat-label">Occupied</div><div className="stat-value income-text">{occupiedCount}</div></div>
          <div className="stat-card expense"><div className="stat-label">Vacant</div><div className="stat-value expense-text">{properties.length - occupiedCount}</div></div>
          <div className="stat-card net"><div className="stat-label">Expected Monthly Rent</div><div className="stat-value">{fmt(totalExpectedRent)}</div></div>
        </div>

        {properties.length === 0 ? (
          <div className="empty-state"><div className="icon"><Home size={40}/></div><p>No properties yet. Add your first property.</p></div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
            {properties.map(p => {
              const tenant = activeTenantForProperty(p.id);
              return (
                <div key={p.id} className="card segment-rental" style={{ padding:'18px 20px' }}>
                  <div className="flex-center justify-between mb-2">
                    <div style={{ fontWeight:600, fontSize:'0.95rem' }}>{p.name}</div>
                    <span className={`badge ${tenant?'badge-active':'badge-vacant'}`}>{tenant?'Occupied':'Vacant'}</span>
                  </div>
                  <div style={{ fontSize:'0.8rem', color:'var(--muted)', marginBottom:12 }}>{p.address}</div>
                  <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                    <div><div className="stat-label">Type</div><div style={{ fontSize:'0.85rem' }}>{p.type}</div></div>
                    <div><div className="stat-label">Rent/mo</div><div className="amount-cell" style={{ fontSize:'0.85rem' }}>{fmt(p.monthlyRent)}</div></div>
                    {tenant && <div><div className="stat-label">Tenant</div><div style={{ fontSize:'0.85rem' }}>{tenant.name}</div></div>}
                  </div>
                  {isAdmin && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(p); setModalOpen(true); }}><Pencil size={12}/> Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PropertyModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} initial={editing} />
    </div>
  );
}
