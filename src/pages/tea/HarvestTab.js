import React, { useState, useMemo } from 'react';
import BagBuilder from './BagBuilder';

export default function HarvestTab({
  isAdmin,leasedFields=new Set(),bags,setBags,deductMode,setDeductMode,
  hDate,setHDate,hWorker,setHWorker,hField,setHField,hAgent,setHAgent,
  workerList,agentList,fieldList,rates,editingHarvestId,
  saveHarvest,savingHarvest,clearForm,
  filteredHarvest,harvestFilter,setHarvestFilter,harvestWeeks,
  editHarvestEntry,deleteHarvestEntry,pendingRateSessions,onGoToRatePayments,
}){
  const [fField,  setFField]  = useState('all');
  const [fAgent,  setFAgent]  = useState('all');
  const [fWorker, setFWorker] = useState('all');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');

  const displayed = useMemo(() => {
    return [...filteredHarvest]
      .filter(e => fField  === 'all' || e.field  === fField)
      .filter(e => fAgent  === 'all' || e.agent  === fAgent)
      .filter(e => fWorker === 'all' || e.worker === fWorker)
      .filter(e => !fFrom  || (e.date||'') >= fFrom)
      .filter(e => !fTo    || (e.date||'') <= fTo)
      .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }, [filteredHarvest, fField, fAgent, fWorker, fFrom, fTo]);

  const clearFilters = () => { setFField('all'); setFAgent('all'); setFWorker('all'); setFFrom(''); setFTo(''); };
  const hasFilter = fField!=='all'||fAgent!=='all'||fWorker!=='all'||fFrom||fTo;

  return(
    <div>
      {/* Pending rate banner — shown until all sessions have confirmed rates */}
      {pendingRateSessions > 0 && (
        <div style={{
          display:'flex',alignItems:'flex-start',gap:10,
          background:'rgba(224,146,74,0.1)',
          border:'1px solid rgba(224,146,74,0.3)',
          borderRadius:'var(--radius)',padding:'11px 14px',
          marginBottom:18,fontSize:'0.83rem',color:'var(--warn)',
        }}>
          <span style={{fontSize:16,flexShrink:0,marginTop:1}}>⏳</span>
          <div>
            <strong>{pendingRateSessions} session{pendingRateSessions!==1?'s':''} used an estimated rate.</strong>
            <div style={{marginTop:3,color:'var(--muted)',fontSize:'0.8rem',lineHeight:1.6}}>
              Once the agent confirms the final rate, go to{' '}
              {onGoToRatePayments ? (
                <button
                  onClick={onGoToRatePayments}
                  style={{background:'none',border:'none',padding:0,color:'var(--text)',fontWeight:600,textDecoration:'underline',cursor:'pointer',font:'inherit'}}
                >
                  Rate &amp; Payments
                </button>
              ) : (
                <strong style={{color:'var(--text)'}}>Rate &amp; Payments</strong>
              )}{' '}
              and type it in — revenue and payment figures update automatically. This banner clears when all sessions show a confirmed rate.
            </div>
          </div>
        </div>
      )}

      {isAdmin&&(
        <div className="ch-card">
          <div className="ch-card-title">{editingHarvestId?'Edit Harvest Session':'New Harvest Session'}</div>
          <div className="ch-grid-4" style={{marginBottom:14}}>
            <div className="ch-form-group"><label>Date</label>
              <input className="ch-input" type="date" value={hDate} onChange={e=>setHDate(e.target.value)}/></div>
            <div className="ch-form-group"><label>Worker</label>
              <select className="ch-input" value={hWorker} onChange={e=>setHWorker(e.target.value)}>
                {workerList.map(w=><option key={w}>{w}</option>)}
              </select></div>
            <div className="ch-form-group"><label>Field</label>
              {leasedFields.has(hField) && (
                <div style={{marginTop:4,padding:'4px 8px',background:'rgba(224,92,92,0.15)',border:'1px solid var(--danger)',borderRadius:6,fontSize:'0.75rem',color:'var(--danger)',fontWeight:600}}>
                  🔒 This field is on lease — harvest cannot be logged
                </div>
              )}
              <select className="ch-input" value={hField} onChange={e=>setHField(e.target.value)}>
                {fieldList.map(f=><option key={f}>{f}</option>)}
              </select></div>
            <div className="ch-form-group"><label>Agent</label>
              <select className="ch-input" value={hAgent} onChange={e=>setHAgent(e.target.value)}>
                {agentList.map(a=><option key={a}>{a}</option>)}
              </select></div>
          </div>
          <BagBuilder bags={bags} onChange={setBags} deductMode={deductMode} onDeductModeChange={setDeductMode}
            agentName={hAgent} dateStr={hDate} rates={rates}/>
          <div style={{display:'flex',gap:10,marginTop:14}}>
            <button className="ch-btn ch-btn-primary" onClick={saveHarvest} disabled={savingHarvest||!bags.length}>
              {savingHarvest?(editingHarvestId?'Updating…':'Saving…'):(editingHarvestId?'Update Harvest':'Save Harvest')}
            </button>
            {editingHarvestId&&<button className="ch-btn ch-btn-secondary" onClick={clearForm}>Cancel Edit</button>}
          </div>
        </div>
      )}

      {/* ── Harvest Log with filters ── */}
      <div className="ch-card" style={{padding:0}}>
        {/* Filter bar */}
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,color:'var(--text)',marginRight:8,alignSelf:'center'}}>Harvest Log</div>

          {/* Week filter */}
          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>WEEK</div>
            <select className="ch-input" style={{minWidth:180}} value={harvestFilter} onChange={e=>setHarvestFilter(e.target.value)}>
              <option value="all">All Weeks</option>
              {harvestWeeks.map(w=>typeof w==='object'?<option key={w.value} value={w.value}>{w.label}</option>:<option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          {/* Field filter */}
          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>FIELD</div>
            <select className="ch-input" style={{minWidth:130}} value={fField} onChange={e=>setFField(e.target.value)}>
              <option value="all">All Fields</option>
              {[...new Set(filteredHarvest.map(e=>e.field).filter(Boolean))].sort().map(f=><option key={f}>{f}</option>)}
            </select>
          </div>

          {/* Agent filter */}
          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>AGENT</div>
            <select className="ch-input" style={{minWidth:130}} value={fAgent} onChange={e=>setFAgent(e.target.value)}>
              <option value="all">All Agents</option>
              {[...new Set(filteredHarvest.map(e=>e.agent).filter(Boolean))].sort().map(a=><option key={a}>{a}</option>)}
            </select>
          </div>

          {/* Worker filter */}
          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>WORKER</div>
            <select className="ch-input" style={{minWidth:130}} value={fWorker} onChange={e=>setFWorker(e.target.value)}>
              <option value="all">All Workers</option>
              {[...new Set(filteredHarvest.map(e=>e.worker).filter(Boolean))].sort().map(w=><option key={w}>{w}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>FROM</div>
            <input className="ch-input" type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)} style={{minWidth:130}}/>
          </div>
          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>TO</div>
            <input className="ch-input" type="date" value={fTo} onChange={e=>setFTo(e.target.value)} style={{minWidth:130}}/>
          </div>

          {hasFilter && (
            <button className="ch-btn ch-btn-ghost ch-btn-sm" onClick={clearFilters} style={{alignSelf:'flex-end'}}>
              ✕ Clear
            </button>
          )}

          <div style={{marginLeft:'auto',alignSelf:'center',fontSize:'0.8rem',color:'var(--muted)'}}>
            {displayed.length} of {filteredHarvest.length} entries
          </div>
        </div>

        {/* ── Section 1: Intake — what came in from the field ── */}
        <div style={{padding:'16px 20px 4px',fontFamily:'var(--font-display)',fontSize:15,fontWeight:600,color:'var(--text)'}}>🌿 Intake</div>
        <div style={{overflowX:'auto'}}>
          <table className="ch-table ch-harvest-table">
            <thead>
              <tr>
                <th>Date</th><th>Worker</th><th>Field</th><th>Agent</th><th>Bags</th>
                <th>Gross</th><th>Bag ded</th><th>Water ded</th><th>Net kg</th>
                {isAdmin&&<th className="ch-sticky-actions-th"></th>}
              </tr>
            </thead>
            <tbody>
              {displayed.length===0&&(
                <tr><td colSpan={9+(isAdmin?1:0)} style={{textAlign:'center',padding:40,color:'var(--muted)'}}>
                  No matching entries.
                </td></tr>
              )}
              {displayed.map(e=>(
                <tr key={e.id}>
                  <td>{e.date}</td><td>{e.worker}</td>
                  <td><span className="ch-badge ch-badge-green">{e.field}</span></td>
                  <td>{e.agent}</td>
                  <td><span className="ch-badge ch-badge-blue">{e.bags} bags</span></td>
                  <td>{(e.tGross||0).toFixed(1)}</td>
                  <td style={{color:'var(--accent)'}}>−{(e.tBagDed||0).toFixed(2)}</td>
                  <td style={{color:'var(--danger)'}}>−{(e.tWaterDed||0).toFixed(2)} ({(e.avgWaterPct||0).toFixed(1)}%)</td>
                  <td style={{fontWeight:700}}>{(e.tNet||0).toFixed(2)}</td>
                  {isAdmin&&(
                    <td className="ch-sticky-actions-td">
                      <div style={{display:'flex',gap:5}}>
                        <button className="ch-btn ch-btn-edit ch-btn-sm" onClick={()=>editHarvestEntry(e)}>Edit</button>
                        <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>deleteHarvestEntry(e.id)}>✕</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {displayed.length>0&&(
                <tr style={{background:'var(--surface2)',fontWeight:600}}>
                  <td colSpan={8} style={{textAlign:'right',color:'var(--muted)'}}>Totals</td>
                  <td>{displayed.reduce((s,e)=>s+(e.tNet||0),0).toFixed(2)} kg</td>
                  {isAdmin&&<td className="ch-sticky-actions-td"></td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
