import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { fmt } from '../../utils/finance';

export default function TransactionTable({ transactions, onEdit, onDelete, isAdmin, showProperty, properties = [] }) {
  const propName = (id) => properties.find(p => p.id === id)?.name || '—';

  if (!transactions.length) {
    return (
      <div className="empty-state">
        <div className="icon">📋</div>
        <p>No transactions yet. Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            {showProperty && <th>Property</th>}
            <th>Description</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
              <td>
                <span className={`badge badge-${t.type}`}>
                  {t.type === 'income' ? '↑ Income' : '↓ Expense'}
                </span>
              </td>
              <td>{t.category}</td>
              {showProperty && <td>{propName(t.propertyId)}</td>}
              <td className="text-muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.description || '—'}
              </td>
              <td className={`amount-cell ${t.type === 'income' ? 'income-text' : 'expense-text'}`} style={{ textAlign: 'right' }}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </td>
              {isAdmin && (
                <td>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(t)}><Pencil size={12} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(t.id)}><Trash2 size={12} /></button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
