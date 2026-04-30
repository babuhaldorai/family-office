/**
 * LeaseTab.js
 * Manages tea field leases — track which fields are on lease,
 * lease period, lump-sum payment (added to revenue), and lessee details.
 * Collection: tea_field_leases
 */
import React, { useState } from 'react';
import { inr } from '../../utils/chaayaService';
import { todayStr } from '../../utils/chaayaService';

const STATUS_COLORS = {
  active:   'var(--success)',
  upcoming: 'var(--warn)',
  expired:  'var(--muted)',
};

function statusOf(lease) {
  const today = new Date().toISOString().slice(0, 10);
  if (lease.endDate < today)   return 'expired';
  if (lease.startDate > today) return 'upcoming';
  return 'active';
}

function daysLeft(lease) {
  const diff = Math.ceil((new Date(lease.endDate) - new Date()) / 86400000);
  return diff;
}

export default function LeaseTab({ isAdmin, leases, fieldList, onSave, onDelete }) {
  const emptyForm = {
    field: fieldList[0] || '',
    lessee: '', phone: '', address: '',
    startDate: todayStr(),
    endDate: '',
    amount: '',       // lump sum paid
    notes: '',
  };
  const [form, setForm]   = useState(emptyForm);
  const [editing, setEditing] = useState(null); // lease id being edited
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.field || !form.lessee || !form.startDate || !form.endDate || !form.amount)
      return alert('Fill in field, lessee, start/end dates, and payment amount');
    if (form.startDate >= form.endDate)
      return alert('End date must be after start date');
    const d = new Date(form.startDate);
    await onSave({ ...form, amount: parseFloat(form.amount) || 0, year: d.getFullYear(), month: d.getMonth() + 1 }, editing);
    setForm(emptyForm);
    setEditing(null);
  };

  const startEdit = (lease) => {
    setForm({ ...emptyForm, ...lease });
    setEditing(lease.id);
  };

  const cancel = () => { setForm(emptyForm); setEditing(null); };

  // Summary stats
  const activeLeases   = leases.filter(l => statusOf(l) === 'active');
  const totalRevenue   = leases.reduce((s, l) => s + (l.amount || 0), 0);
  const activeRevenue  = activeLeases.reduce((s, l) => s + (l.amount || 0), 0);
  const activeFields   = new Set(activeLeases.map(l => l.field));

  return (
    <div>
      {/* Summary KPIs */}
      <div className="ch-kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Active Leases',    val: activeLeases.length,       fmt: v => v,      color: 'var(--success)' },
          { label: 'Fields on Lease',  val: activeFields.size,         fmt: v => v,      color: 'var(--warn)' },
          { label: 'Active Revenue',   val: activeRevenue,             fmt: inr,         color: 'var(--success)' },
          { label: 'Total All-Time',   val: totalRevenue,              fmt: inr,         color: 'var(--muted)' },
        ].map(k => (
          <div key={k.label} className="ch-kpi">
            <div className="ch-kpi-label">{k.label}</div>
            <div className="ch-kpi-value" style={{ color: k.color }}>{k.fmt(k.val)}</div>
          </div>
        ))}
      </div>

      {/* Active lease field indicators */}
      {activeFields.size > 0 && (
        <div className="ch-card" style={{ marginBottom: 16, background: 'rgba(76,175,128,0.06)', borderColor: 'rgba(76,175,128,0.3)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>🔒 Fields Currently on Lease — No Operations Should Be Logged</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[...activeFields].map(f => {
              const lease = activeLeases.find(l => l.field === f);
              const days  = lease ? daysLeft(lease) : 0;
              return (
                <div key={f} style={{ padding: '6px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', fontSize: '0.82rem', border: '1px solid var(--success)' }}>
                  <strong style={{ color: 'var(--success)' }}>{f}</strong>
                  <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                    {days > 0 ? `${days}d left` : 'expires today'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {isAdmin && (
        <div className="ch-card" style={{ marginBottom: 16 }}>
          <div className="ch-card-title">{editing ? '✏️ Edit Lease' : '+ New Field Lease'}</div>

          <div className="ch-grid-4" style={{ marginBottom: 12 }}>
            <div className="ch-form-group">
              <label>Field *</label>
              <select className="ch-input" value={form.field} onChange={e => set('field', e.target.value)}>
                {fieldList.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="ch-form-group">
              <label>Lessee Name *</label>
              <input className="ch-input" value={form.lessee} onChange={e => set('lessee', e.target.value)} placeholder="Full name" />
            </div>
            <div className="ch-form-group">
              <label>Phone</label>
              <input className="ch-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 ..." />
            </div>
            <div className="ch-form-group">
              <label>Lump Sum Payment (₹) *</label>
              <input className="ch-input" type="number" step="100" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="ch-grid-4" style={{ marginBottom: 12 }}>
            <div className="ch-form-group">
              <label>Lease Start *</label>
              <input className="ch-input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="ch-form-group">
              <label>Lease End *</label>
              <input className="ch-input" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
            <div className="ch-form-group">
              <label>Address</label>
              <input className="ch-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Lessee address" />
            </div>
            <div className="ch-form-group">
              <label>Notes</label>
              <input className="ch-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any terms / conditions" />
            </div>
          </div>

          {/* Lease duration preview */}
          {form.startDate && form.endDate && form.startDate < form.endDate && (
            <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', display: 'flex', gap: 20 }}>
              <span>Duration: <strong>{Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000)} days</strong></span>
              {form.amount && <span>Payment: <strong style={{ color: 'var(--success)' }}>{inr(parseFloat(form.amount) || 0)}</strong></span>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ch-btn ch-btn-primary" onClick={save}>{editing ? 'Update Lease' : 'Save Lease'}</button>
            {editing && <button className="ch-btn" onClick={cancel}>Cancel</button>}
          </div>
        </div>
      )}

      {/* Leases table */}
      <div className="ch-card" style={{ padding: 0 }}>
        <table className="ch-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Lessee</th>
              <th>Start</th>
              <th>End</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Days Left</th>
              <th style={{ textAlign: 'right' }}>Payment</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {leases.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                No field leases recorded yet.
              </td></tr>
            )}
            {[...leases].sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||'')).map(l => {
              const status = statusOf(l);
              const days   = daysLeft(l);
              const dur    = l.startDate && l.endDate
                ? Math.ceil((new Date(l.endDate) - new Date(l.startDate)) / 86400000)
                : '—';
              return (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.field}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{l.lessee}</div>
                    {l.phone && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{l.phone}</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.startDate}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.endDate}</td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{dur} days</td>
                  <td>
                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] }}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: days < 0 ? 'var(--danger)' : days < 30 ? 'var(--warn)' : 'var(--muted)' }}>
                    {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--success)' }}>
                    {inr(l.amount || 0)}
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="ch-btn ch-btn-sm" onClick={() => startEdit(l)}>✏️</button>
                        <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={() => { if (window.confirm(`Delete lease for ${l.field}?`)) onDelete(l.id); }}>✕</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {leases.length > 0 && (
              <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                <td colSpan={7} style={{ textAlign: 'right', color: 'var(--muted)', fontSize: '0.78rem' }}>TOTAL REVENUE</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{inr(totalRevenue)}</td>
                {isAdmin && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
