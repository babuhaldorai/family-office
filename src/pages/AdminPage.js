import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';

const COLLECTIONS = [
  'tea_harvest','tea_maintenance','tea_field_leases','tea_settlements',
  'tea_agent_payments','tea_advances','tea_market_rates',
  'rental_transactions','home_expenses',
];

export default function AdminPage() {
  const { user } = useAuth();
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [users, setUsers]         = useState([]);
  const [pendingLogins, setPending] = useState([]);

  useEffect(() => {
    // Load audit logs
    getDocs(query(collection(db, 'audit_log'), orderBy('timestamp', 'desc'), limit(200)))
      .then(s => setAuditLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setAuditLogs([]));

    // Load users
    getDocs(collection(db, 'users'))
      .then(s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setUsers([]));

    // Load pending logins
    getDocs(collection(db, 'pending_logins'))
      .then(s => { setPending(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="page-body">
      <div className="page-header">
        <h1 className="page-title">⚙ Admin</h1>
      </div>

      {/* Users */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>👥 Users</div>
        <table className="table-wrap" style={{ width: '100%' }}>
          <thead><tr>
            <th>Email</th><th>Role</th><th>UID</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.email || u.id}</td>
                <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600,
                  background: u.role === 'admin' ? 'rgba(76,175,128,0.15)' : 'rgba(100,100,100,0.15)',
                  color: u.role === 'admin' ? 'var(--success)' : 'var(--muted)' }}>{u.role}</span></td>
                <td style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{u.id}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No users</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pending logins */}
      {pendingLogins.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid var(--warn)' }}>
          <div className="section-title" style={{ marginBottom: 12, color: 'var(--warn)' }}>⏳ Pending Login Requests</div>
          <table style={{ width: '100%' }}>
            <thead><tr><th>Email</th><th>Requested</th></tr></thead>
            <tbody>
              {pendingLogins.map(p => (
                <tr key={p.id}>
                  <td>{p.email}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    {p.requestedAt?.toDate?.()?.toLocaleString() || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Log */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px 0', fontWeight: 600, fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>📋 Audit Log</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 400 }}>Last 200 actions</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th><th>User</th><th>Action</th><th>Collection</th><th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
              {!loading && auditLogs.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                  No audit logs yet. Logs are created when users add/edit/delete records.
                </td></tr>
              )}
              {auditLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--muted)' }}>
                    {log.timestamp?.toDate?.()?.toLocaleString() || '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{log.userEmail || log.userId || '—'}</td>
                  <td>
                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                      background: log.action === 'delete' ? 'rgba(184,74,46,0.15)' :
                                  log.action === 'update' ? 'rgba(201,148,26,0.15)' : 'rgba(76,175,128,0.15)',
                      color: log.action === 'delete' ? 'var(--danger)' :
                             log.action === 'update' ? 'var(--accent)' : 'var(--success)' }}>
                      {log.action?.toUpperCase() || 'ACTION'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{log.collection}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.summary || log.docId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
