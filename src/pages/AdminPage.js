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
  const [importing, setImporting]   = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importFile, setImportFile]   = useState(null);
  const [selectedCols, setSelectedCols]       = useState({});
  const [selectedExportCols, setSelectedExportCols] = useState(
    () => Object.fromEntries(COLLECTIONS.map(c => [c, true]))
  );
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

  // ── Import: restore from JSON backup ─────────────────────────────────────
  const loadImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportStatus('');
    setImportPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.collections) throw new Error('Invalid backup file format');
        const summary = Object.entries(data.collections).map(([col, docs]) => ({
          col, count: Array.isArray(docs) ? docs.length : 0
        }));
        setImportPreview({ exportedAt: data.exportedAt, exportedBy: data.exportedBy, summary, raw: data });
        // Pre-select all non-empty collections except users
        const sel = {};
        summary.forEach(r => { if (r.count > 0 && r.col !== 'users') sel[r.col] = true; });
        setSelectedCols(sel);
      } catch(err) {
        setImportStatus(`❌ Invalid file: ${err.message}`);
        setImportFile(null);
      }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (!importPreview) return;
    const confirmed = window.confirm(
      `⚠️ IMPORT WARNING\n\n` +
      `This will ADD all records from the backup file.\n` +
      `It will NOT delete existing data first.\n\n` +
      `Backup date: ${importPreview.exportedAt}\n` +
      `Total records: ${importPreview.summary.reduce((s,r)=>s+r.count,0)}\n\n` +
      `To do a clean restore:\n` +
      `1. Delete collections manually in Firebase Console\n` +
      `2. Then run this import\n\n` +
      `Continue with import?`
    );
    if (!confirmed) return;

    setImporting(true);
    setImportStatus('Starting import...');

    const { addDoc, collection: col } = await import('firebase/firestore');
    const { db: fdb } = await import('../firebase');

    let totalImported = 0;
    let totalErrors = 0;

    for (const [colName, docs] of Object.entries(importPreview.raw.collections)) {
      if (colName === 'users') continue; // Never import users
      if (!selectedCols[colName]) {
        console.log(`Skipping ${colName} (not selected)`);
        continue;
      }
      if (!Array.isArray(docs)) continue;
      setImportStatus(`Importing ${colName} (${docs.length} records)...`);

      for (const doc of docs) {
        try {
          const { id, ...data } = doc;
          // Remove the original id - Firestore will assign a new one
          // Convert ISO strings back to plain strings (Firestore will store as strings)
          await addDoc(col(fdb, colName), {
            ...data,
            _importedFrom: id,
            _importedAt: new Date().toISOString(),
          });
          totalImported++;
        } catch(e) {
          totalErrors++;
          console.error(`Import error in ${colName}:`, e.message);
        }
      }
    }

    setImportStatus(`✅ Import complete — ${totalImported} records imported, ${totalErrors} errors`);
    setImporting(false);
    setImportPreview(null);
    setImportFile(null);
  };

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

      const colsToExport = COLLECTIONS.filter(c => selectedExportCols[c]);
      for (const col of colsToExport) {
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

            {/* Collection selector for export */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:8}}>Select collections to export:</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8}}>
                {COLLECTIONS.map(col=>(
                  <label key={col} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',
                    background:selectedExportCols[col]?'rgba(201,168,76,0.12)':'var(--surface2)',
                    borderRadius:6,fontSize:'0.75rem',cursor:'pointer',
                    border:`1px solid ${selectedExportCols[col]?'var(--accent)':'var(--border)'}`}}>
                    <input type="checkbox" checked={!!selectedExportCols[col]}
                      onChange={e=>setSelectedExportCols(s=>({...s,[col]:e.target.checked}))}
                      style={{width:14,height:14,flexShrink:0,accentColor:'var(--accent)'}}/>
                    <span style={{color:'var(--muted)',fontFamily:'var(--font-mono)'}}>{col}</span>
                  </label>
                ))}
              </div>
              <div style={{display:'flex',gap:10,marginBottom:6}}>
                <button onClick={()=>setSelectedExportCols(Object.fromEntries(COLLECTIONS.map(c=>[c,true])))}
                  style={{fontSize:'0.75rem',padding:'3px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface2)',color:'var(--text)',cursor:'pointer'}}>
                  Select All
                </button>
                <button onClick={()=>setSelectedExportCols({})}
                  style={{fontSize:'0.75rem',padding:'3px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface2)',color:'var(--text)',cursor:'pointer'}}>
                  Deselect All
                </button>
                <span style={{fontSize:'0.75rem',color:'var(--muted)',alignSelf:'center'}}>
                  {Object.values(selectedExportCols).filter(Boolean).length} of {COLLECTIONS.length} selected
                </span>
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
              <button
                onClick={runBackup}
                disabled={backing || Object.values(selectedExportCols).filter(Boolean).length === 0}
                style={{padding:'10px 24px',borderRadius:8,border:'none',cursor:backing?'wait':'pointer',
                  background:'var(--accent)',color:'#000',fontWeight:700,fontSize:'0.9rem',
                  opacity:(backing||Object.values(selectedExportCols).filter(Boolean).length===0)?0.5:1}}>
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

          {/* Import Section */}
          <div className="card" style={{marginBottom:20, border:'1px solid var(--border)'}}>
            <div className="section-title" style={{marginBottom:8}}>📤 Restore from Backup</div>
            <p style={{color:'var(--muted)',fontSize:'0.83rem',marginBottom:16,lineHeight:1.6}}>
              Select a previously exported <code>.json</code> backup file to restore data.
              <strong style={{color:'var(--warn)'}}> This adds records — it does not delete existing data first.</strong>
              For a clean restore, delete the relevant collections in Firebase Console first.
            </p>

            <div style={{marginBottom:12}}>
              <input type="file" accept=".json" id="importFileInput" onChange={loadImportFile}
                style={{display:'none'}}/>
              <label htmlFor="importFileInput"
                style={{display:'inline-block',padding:'10px 24px',borderRadius:8,cursor:'pointer',
                  background:'var(--accent)',color:'#000',fontWeight:700,fontSize:'0.9rem',
                  userSelect:'none'}}>
                📂 Choose Backup File
              </label>
              {importFile && (
                <span style={{marginLeft:12,fontSize:'0.82rem',color:'var(--muted)'}}>
                  {importFile.name}
                </span>
              )}
            </div>

            {importPreview && (
              <div style={{marginBottom:12,padding:'12px 14px',background:'var(--surface2)',borderRadius:'var(--radius)',fontSize:'0.82rem'}}>
                <div style={{fontWeight:600,marginBottom:8}}>
                  📦 Backup from {new Date(importPreview.exportedAt).toLocaleString('en-IN')} by {importPreview.exportedBy}
                </div>
                <div style={{fontSize:'0.78rem',color:'var(--warn)',marginBottom:8}}>
                  ✅ Check only the collections you deleted and want to restore:
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:10}}>
                  {importPreview.summary.filter(r=>r.count>0&&r.col!=='users').map(r=>(
                    <label key={r.col} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',
                      background:selectedCols[r.col]?'rgba(201,168,76,0.12)':'var(--surface)',
                      borderRadius:6,fontSize:'0.75rem',cursor:'pointer',
                      border:`1px solid ${selectedCols[r.col]?'var(--accent)':'var(--border)'}`}}>
                      <input type="checkbox" checked={!!selectedCols[r.col]}
                        onChange={e=>setSelectedCols(s=>({...s,[r.col]:e.target.checked}))}
                        style={{width:14,height:14,flexShrink:0,accentColor:'var(--accent)'}}/>
                      <span style={{color:'var(--muted)',fontFamily:'var(--font-mono)',flex:1}}>{r.col}</span>
                      <span style={{color:'var(--text)',fontWeight:600}}>{r.count}</span>
                    </label>
                  ))}
                </div>
                <div style={{display:'flex',gap:12,marginBottom:6}}>
                  <button onClick={()=>setSelectedCols(s=>Object.fromEntries(Object.keys(s).map(k=>[k,true])))}
                    style={{fontSize:'0.75rem',padding:'3px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface2)',color:'var(--text)',cursor:'pointer'}}>
                    Select All
                  </button>
                  <button onClick={()=>setSelectedCols({})}
                    style={{fontSize:'0.75rem',padding:'3px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface2)',color:'var(--text)',cursor:'pointer'}}>
                    Deselect All
                  </button>
                </div>
                <div style={{fontWeight:600,fontSize:'0.85rem'}}>
                  Selected: {Object.values(selectedCols).filter(Boolean).length} collections ·{' '}
                  {importPreview.summary.filter(r=>selectedCols[r.col]).reduce((s,r)=>s+r.count,0)} records
                </div>
              </div>
            )}

            {importPreview && (
              <button onClick={runImport} disabled={importing}
                style={{padding:'10px 24px',borderRadius:8,border:'none',cursor:importing?'wait':'pointer',
                  background:'var(--accent)',color:'#000',fontWeight:700,fontSize:'0.9rem',
                  opacity:importing?0.7:1}}>
                {importing ? '⏳ Importing...' : '⬆ Restore This Backup'}
              </button>
            )}

            {importStatus && (
              <div style={{marginTop:10,fontSize:'0.83rem',
                color:importStatus.startsWith('✅')?'var(--success)':importStatus.startsWith('❌')?'var(--danger)':'var(--muted)'}}>
                {importStatus}
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
