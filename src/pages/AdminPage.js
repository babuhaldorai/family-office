import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const COLLECTIONS = [
  'tea_harvest','tea_maintenance','tea_market_rates','tea_settlements',
  'tea_agent_payments','tea_advances','tea_weather','tea_field_leases',
  'workers','agents','fields',
  'properties','tenants','leases','rental_transactions',
  'home_properties','home_expenses',
  'users',
];

export default function AdminPage() {
  const { user } = useAuth();
  const [auditLogs, setAuditLogs]   = useState([]);
  const [users, setUsers]           = useState([]);
  const [pending, setPending]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [backing, setBacking]       = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [tab, setTab]               = useState('audit');

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db,'audit_log'), orderBy('timestamp','desc'), limit(200))).catch(()=>({docs:[]})),
      getDocs(collection(db,'users')).catch(()=>({docs:[]})),
      getDocs(collection(db,'pending_logins')).catch(()=>({docs:[]})),
    ]).then(([aSnap, uSnap, pSnap]) => {
      setAuditLogs(aSnap.docs.map(d=>({id:d.id,...d.data()})));
      setUsers(uSnap.docs.map(d=>({id:d.id,...d.data()})));
      setPending(pSnap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  }, []);

  // ── Backup: export all collections to JSON ────────────────────────────────
  const runBackup = async () => {
    setBacking(true);
    setBackupStatus('Reading collections...');
    try {
      const backup = {
        exportedAt: new Date().toISOString(),
        exportedBy: user?.email || 'unknown',
        collections: {},
      };

      for (const col of COLLECTIONS) {
        setBackupStatus(`Exporting ${col}...`);
        try {
          const snap = await getDocs(collection(db, col));
          backup.collections[col] = snap.docs.map(d => {
            const data = d.data();
            // Convert Firestore timestamps to ISO strings
            Object.keys(data).forEach(k => {
              if (data[k]?.toDate) data[k] = data[k].toDate().toISOString();
            });
            return { id: d.id, ...data };
          });
        } catch(e) {
          backup.collections[col] = { error: e.message };
        }
      }

      // Download as JSON file
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `family-office-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const totalDocs = Object.values(backup.collections).reduce((s,v) => s + (Array.isArray(v) ? v.length : 0), 0);
      setBackupStatus(`✅ Backup complete — ${totalDocs} records exported`);
    } catch(e) {
      setBackupStatus(`❌ Backup failed: ${e.message}`);
    } finally {
      setBacking(false);
    }
  };

  const TABS = [
    { key:'backup', label:'💾 Backup' },
    { key:'audit',  label:'📋 Audit Log' },
    { key:'users',  label:'👥 Users' },
  ];

  return (
    <div className="page-body">
      <div className="page-header">
        <h1 className="page-title">⚙ Admin</h1>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{marginBottom:20}}>
        {TABS.map(t=>(
          <button key={t.key} className={`tab${tab===t.key?' active':''}`} onClick={()=>setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Backup Tab ── */}
      {tab==='backup' && (
        <div>
          <div className="card" style={{marginBottom:20}}>
            <div className="section-title" style={{marginBottom:8}}>💾 Data Backup</div>
            <p style={{color:'var(--muted)',fontSize:'0.85rem',marginBottom:16,lineHeight:1.6}}>
              Exports all your data as a single JSON file you can save locally.
              Run this regularly — <strong>weekly recommended</strong> for production data.
              The file can be used to restore data if needed.
            </p>

            <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
              <button
                onClick={runBackup}
                disabled={backing}
                style={{padding:'10px 24px',borderRadius:8,border:'none',cursor:backing?'wait':'pointer',
                  background:'var(--accent)',color:'#000',fontWeight:700,fontSize:'0.9rem',
                  opacity:backing?0.7:1}}>
                {backing ? '⏳ Exporting...' : '⬇ Download Backup Now'}
              </button>
              {backupStatus && (
                <span style={{fontSize:'0.85rem',color:backupStatus.startsWith('✅')?'var(--success)':backupStatus.startsWith('❌')?'var(--danger)':'var(--muted)'}}>
                  {backupStatus}
                </span>
              )}
            </div>

            {backing && (
              <div style={{marginTop:12,height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:'60%',background:'var(--accent)',borderRadius:2,animation:'pulse 1s infinite'}}/>
              </div>
            )}
          </div>

          <div className="card" style={{marginBottom:20}}>
            <div className="section-title" style={{marginBottom:8}}>📋 What gets backed up</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {COLLECTIONS.filter(c=>c!=='users').map(col=>(
                <div key={col} style={{fontSize:'0.78rem',color:'var(--muted)',padding:'4px 8px',
                  background:'var(--surface2)',borderRadius:6,fontFamily:'var(--font-mono)'}}>
                  {col}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{background:'rgba(76,175,128,0.06)',borderColor:'rgba(76,175,128,0.3)'}}>
            <div className="section-title" style={{marginBottom:8,color:'var(--success)'}}>💡 Backup Best Practices</div>
            <ul style={{color:'var(--muted)',fontSize:'0.83rem',lineHeight:2,paddingLeft:20,margin:0}}>
              <li>Download a backup <strong>before</strong> entering large amounts of data</li>
              <li>Download a backup <strong>after</strong> completing a month's data entry</li>
              <li>Store backups in <strong>Google Drive or iCloud</strong> for safety</li>
              <li>Keep at least <strong>3 months</strong> of backup files</li>
              <li>The JSON file can be imported back if data is ever lost</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Audit Log Tab ── */}
      {tab==='audit' && (
        <div className="card" style={{padding:0}}>
          <div style={{padding:'14px 20px 0',fontWeight:600,fontSize:'1rem',display:'flex',justifyContent:'space-between'}}>
            <span>📋 Audit Log</span>
            <span style={{fontSize:'0.75rem',color:'var(--muted)',fontWeight:400}}>Last 200 actions · Immutable</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th><th>User</th><th>Action</th><th>Collection</th><th>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} style={{textAlign:'center',padding:30}}>Loading…</td></tr>}
                {!loading && auditLogs.length===0 && (
                  <tr><td colSpan={5} style={{textAlign:'center',padding:30,color:'var(--muted)'}}>No audit logs yet.</td></tr>
                )}
                {auditLogs.map(log=>(
                  <tr key={log.id}>
                    <td style={{whiteSpace:'nowrap',fontSize:'0.78rem',color:'var(--muted)'}}>
                      {log.timestamp?.toDate?.()?.toLocaleString('en-IN') || log.timestamp || '—'}
                    </td>
                    <td style={{fontSize:'0.8rem'}}>{log.userEmail||'—'}</td>
                    <td>
                      <span style={{padding:'2px 7px',borderRadius:4,fontSize:'0.72rem',fontWeight:600,
                        background:log.action==='delete'?'rgba(184,74,46,0.15)':log.action==='update'?'rgba(201,148,26,0.15)':'rgba(76,175,128,0.15)',
                        color:log.action==='delete'?'var(--danger)':log.action==='update'?'var(--accent)':'var(--success)'}}>
                        {(log.action||'').toUpperCase()}
                      </span>
                    </td>
                    <td style={{fontSize:'0.78rem',fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{log.collection}</td>
                    <td style={{fontSize:'0.78rem',color:'var(--muted)',maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {log.summary||'—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Users Tab ── */}
      {tab==='users' && (
        <div>
          {pending.length>0 && (
            <div className="card" style={{marginBottom:16,border:'1px solid var(--warn)'}}>
              <div className="section-title" style={{marginBottom:8,color:'var(--warn)'}}>⏳ Pending Login Requests</div>
              <table style={{width:'100%'}}>
                <thead><tr><th>Email</th><th>Requested</th></tr></thead>
                <tbody>
                  {pending.map(p=>(
                    <tr key={p.id}>
                      <td>{p.email}</td>
                      <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>
                        {p.requestedAt?.toDate?.()?.toLocaleString('en-IN')||'—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="card" style={{padding:0}}>
            <div style={{padding:'14px 20px 0',fontWeight:600,fontSize:'1rem'}}>👥 Authorised Users</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>UID</th></tr></thead>
                <tbody>
                  {users.map(u=>(
                    <tr key={u.id}>
                      <td>{u.email||u.id}</td>
                      <td>{u.displayName||'—'}</td>
                      <td>
                        <span style={{padding:'2px 8px',borderRadius:4,fontSize:'0.78rem',fontWeight:600,
                          background:u.role==='admin'?'rgba(76,175,128,0.15)':'rgba(100,100,100,0.15)',
                          color:u.role==='admin'?'var(--success)':'var(--muted)'}}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{fontSize:'0.72rem',color:'var(--muted)',fontFamily:'var(--font-mono)'}}>{u.id}</td>
                    </tr>
                  ))}
                  {users.length===0&&<tr><td colSpan={4} style={{textAlign:'center',padding:20,color:'var(--muted)'}}>No users</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
