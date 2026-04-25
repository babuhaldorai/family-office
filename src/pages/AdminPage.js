import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Trash2, Pencil, X, Shield, Eye, UserPlus, RefreshCw } from 'lucide-react';

// ── Add / Edit user modal ────────────────────────────────────────────────────
function UserModal({ open, onClose, onSave, initial }) {
  const empty = { uid: '', email: '', displayName: '', role: 'viewer' };
  const [form, setForm]   = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({ uid: initial.uid || initial.id || '', email: initial.email || '', displayName: initial.displayName || '', role: initial.role || 'viewer' });
      } else {
        setForm(empty);
      }
      setError('');
    }
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.email) { setError('Email is required.'); return; }
    if (!initial && !form.uid) { setError('UID is required. Ask the user to attempt login first, then copy their UID from the Pending list above.'); return; }
    setError(''); setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e) { setError(e.message || 'Error saving.'); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Edit User' : 'Add Approved User'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {!initial && (
            <div style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--accent)' }}>How to add a user:</strong><br />
              1. Ask them to visit the app and click "Continue with Google"<br />
              2. They'll see "Access not granted" — that's expected<br />
              3. Their UID will appear in the <strong>Pending Attempts</strong> table below<br />
              4. Copy it here, fill in their details, and save
            </div>
          )}
          {!initial && (
            <div className="form-group">
              <label>Firebase UID <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input value={form.uid} onChange={e => set('uid', e.target.value)} placeholder="Paste UID from Pending list…" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
            </div>
          )}
          <div className="form-group">
            <label>Google Email <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="member@gmail.com" readOnly={!!initial} style={initial ? { opacity: 0.6 } : {}} />
          </div>
          <div className="form-group">
            <label>Display Name</label>
            <input value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Family Member Name" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="admin">Admin — full access + user management</option>
              <option value="viewer">Viewer — read-only access</option>
            </select>
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 4 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Grant Access'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main AdminPage ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user: currentUser, setUserProfile, updateUserProfile } = useAuth();
  const [users, setUsers]       = useState([]);
  const [pending, setPending]   = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [loading, setLoading]     = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [uSnap, pSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'pending_logins')).catch(() => ({ docs: [] })),
    ]);
    setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPending(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (form) => {
    if (editing && !editing._fromPending) {
      // Editing existing approved user
      await updateUserProfile(editing.id, { displayName: form.displayName, role: form.role });
    } else {
      // New user (or granting access from pending)
      const uid = editing?._fromPending ? editing.uid : form.uid;
      await setUserProfile(uid, {
        email:       form.email,
        displayName: form.displayName || form.email,
        role:        form.role,
      });
      // Remove from pending if present
      try { await deleteDoc(doc(db, 'pending_logins', uid)); } catch {}
    }
    loadData();
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser.uid) { alert("You can't remove yourself."); return; }
    if (!window.confirm(`Remove ${u.displayName || u.email} from the portal? They will lose access immediately.`)) return;
    await deleteDoc(doc(db, 'users', u.id));
    loadData();
  };

  const handleDismissPending = async (uid) => {
    await deleteDoc(doc(db, 'pending_logins', uid));
    loadData();
  };

  const handleGrantFromPending = (p) => {
    setEditing(null);
    // Pre-fill the modal with pending data
    setEditing({ _fromPending: true, uid: p.id, email: p.email, displayName: p.displayName || '', role: 'viewer' });
    setModalOpen(true);
  };

  const admins  = users.filter(u => u.role === 'admin');
  const viewers = users.filter(u => u.role === 'viewer');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ User Management</h1>
          <p className="page-subtitle">Control who can access the Family Office portal</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={loadData}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <UserPlus size={15} /> Add User
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card net"><div className="stat-label">Total Users</div><div className="stat-value">{users.length} <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/ 10</span></div></div>
          <div className="stat-card"><div className="stat-label">Admins</div><div className="stat-value">{admins.length}</div></div>
          <div className="stat-card"><div className="stat-label">Viewers</div><div className="stat-value">{viewers.length}</div></div>
          <div className="stat-card" style={{ borderTop: pending.length > 0 ? '3px solid var(--warn)' : '3px solid var(--border2)' }}>
            <div className="stat-label">Pending Access</div>
            <div className="stat-value" style={{ color: pending.length > 0 ? 'var(--warn)' : 'var(--text)' }}>{pending.length}</div>
          </div>
        </div>

        {/* Pending login attempts */}
        {pending.length > 0 && (
          <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(224,146,74,0.3)', background: 'rgba(224,146,74,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--warn)', fontSize: '0.95rem' }}>⚠ Pending Access Requests</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
                  These Google accounts tried to sign in but are not yet approved.
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>UID</th><th>Email</th><th>Name (from Google)</th><th>Attempted</th><th></th></tr>
                </thead>
                <tbody>
                  {pending.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.id}</td>
                      <td>{p.email}</td>
                      <td>{p.displayName || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{p.attemptedAt ? new Date(p.attemptedAt).toLocaleString('en-IN') : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handleGrantFromPending(p)}>
                            Grant Access
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDismissPending(p.id)}>
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>User</th><th>Email</th><th>Role</th><th>Last Seen</th><th>Added</th><th></th></tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                      No users yet. Add yourself first using the "Add User" button — you'll need your UID from Firebase Console → Authentication.
                    </td></tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border2)' }} />
                          ) : (
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: u.role === 'admin' ? 'rgba(201,168,76,0.15)' : 'var(--surface2)',
                              border: `1px solid ${u.role === 'admin' ? 'rgba(201,168,76,0.3)' : 'var(--border2)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', fontWeight: 600,
                              color: u.role === 'admin' ? 'var(--accent)' : 'var(--muted)',
                              flexShrink: 0,
                            }}>
                              {(u.displayName || u.email || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{u.displayName || '—'}</div>
                            {u.id === currentUser.uid && <div style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>You</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{u.email}</td>
                      <td>
                        <span className={`badge badge-${u.role}`}>
                          {u.role === 'admin'
                            ? <><Shield size={10} style={{ display: 'inline', marginRight: 3 }} /> Admin</>
                            : <><Eye size={10} style={{ display: 'inline', marginRight: 3 }} /> Viewer</>}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        {u.lastSeen ? new Date(u.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(u); setModalOpen(true); }}>
                            <Pencil size={12} /> Edit
                          </button>
                          {u.id !== currentUser.uid && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="card" style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--accent)' }}>How access works:</strong><br />
            ① Users click "Continue with Google" — they sign in with their Google account.<br />
            ② If they're not in the approved list, they see "Access not granted" and their details appear in <strong>Pending Access Requests</strong> above.<br />
            ③ You click <strong>Grant Access</strong>, confirm their details, set their role, and save.<br />
            ④ They refresh the page and are in. No passwords, no invites — just Google.
          </div>
        </div>
      </div>

      <UserModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing?._fromPending ? editing : editing}
      />
    </div>
  );
}
