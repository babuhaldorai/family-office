import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const TEA_CATEGORIES = {
  income: ['Tea Sales', 'Green Leaf Sales', 'By-product Sales', 'Subsidy / Grant', 'Other'],
  expense: ['Labour', 'Fertiliser', 'Pesticide', 'Fuel', 'Machinery', 'Transport', 'Processing', 'Admin', 'Tax', 'Other'],
};

const RENTAL_CATEGORIES = {
  income: ['Rent', 'Security Deposit', 'Late Fee', 'Other'],
  expense: ['Maintenance', 'Repair', 'Property Tax', 'Insurance', 'Water/Electricity', 'Management Fee', 'Legal', 'Other'],
};

export default function TransactionModal({ open, onClose, onSave, initial, segment, properties = [] }) {
  const cats = segment === 'tea' ? TEA_CATEGORIES : RENTAL_CATEGORIES;
  const empty = {
    date: new Date().toISOString().slice(0, 10),
    type: 'income',
    category: '',
    amount: '',
    description: '',
    propertyId: '',
  };

  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? { ...empty, ...initial } : empty);
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.date || !form.amount || !form.category) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Edit' : 'Add'} Transaction</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => { set('type', e.target.value); set('category', ''); }}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select…</option>
                {(cats[form.type] || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {segment === 'rental' && properties.length > 0 && (
            <div className="form-group">
              <label>Property</label>
              <select value={form.propertyId} onChange={e => set('propertyId', e.target.value)}>
                <option value="">All / General</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Description / Notes</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Optional…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.amount || !form.category}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
