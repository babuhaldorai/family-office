import React, { useState, useMemo } from 'react';
import { inr } from '../../utils/chaayaService';
import { EditableRateCell, EditablePayCell } from './InlineEditCells';

// Per-session rate confirmation and worker/agent payment entry — split out
// from Log Harvest so each tab stays focused (intake vs. money). Rate and
// payment edits here save straight onto the harvest row, same as before.
export default function RatePaymentsTab({
  harvest, harvestFilter, setHarvestFilter, harvestWeeks,
  advances, pendingRateSessions, onUpdateRate, onUpdateWorkerPay, onUpdateAgentPay, onPayWorkerNetOfAdvance, onPayWorkerFull,
}) {
  const [fField,  setFField]  = useState('all');
  const [fAgent,  setFAgent]  = useState('all');
  const [fWorker, setFWorker] = useState('all');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');

  const rows = useMemo(() => {
    return [...harvest]
      .filter(e => fField  === 'all' || e.field  === fField)
      .filter(e => fAgent  === 'all' || e.agent  === fAgent)
      .filter(e => fWorker === 'all' || e.worker === fWorker)
      .filter(e => !fFrom  || (e.date||'') >= fFrom)
      .filter(e => !fTo    || (e.date||'') <= fTo)
      .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }, [harvest, fField, fAgent, fWorker, fFrom, fTo]);

  // Pending advance as of each session's own date — an advance borrowed
  // AFTER a session shouldn't retroactively reduce that session's payout.
  const advanceAsOf = (worker, date) => (advances||[])
    .filter(a => a.worker === worker && !a.deducted && (a.date||'') <= (date||''))
    .reduce((s,a) => s + (a.amount||0), 0);

  const hasFilter = fField!=='all' || fAgent!=='all' || fWorker!=='all' || fFrom || fTo;
  const clearFilters = () => { setFField('all'); setFAgent('all'); setFWorker('all'); setFFrom(''); setFTo(''); };

  return (
    <div>
      {pendingRateSessions > 0 && (
        <div style={{
          display:'flex',alignItems:'flex-start',gap:10,
          background:'rgba(224,146,74,0.1)',border:'1px solid rgba(224,146,74,0.3)',
          borderRadius:8,padding:'10px 14px',marginBottom:16,
        }}>
          <span style={{fontSize:18}}>⏳</span>
          <div style={{fontSize:'0.85rem',color:'var(--text)'}}>
            <strong>{pendingRateSessions} session{pendingRateSessions!==1?'s':''} used an estimated rate.</strong>
            <div style={{marginTop:3,color:'var(--muted)',fontSize:'0.8rem',lineHeight:1.6}}>
              Once the agent confirms the final rate, type it into the <strong style={{color:'var(--text)'}}>Rate</strong> column
              below — revenue and payment figures update automatically.
            </div>
          </div>
        </div>
      )}

      <div className="ch-card" style={{padding:0}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,color:'var(--text)',marginRight:8,alignSelf:'center'}}>Rate &amp; Payments</div>

          {harvestFilter!==undefined && (
            <div>
              <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>WEEK</div>
              <select className="ch-input" style={{minWidth:180}} value={harvestFilter} onChange={e=>setHarvestFilter(e.target.value)}>
                <option value="all">All Weeks</option>
                {(harvestWeeks||[]).map(w=>typeof w==='object'?<option key={w.value} value={w.value}>{w.label}</option>:<option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          )}

          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>FIELD</div>
            <select className="ch-input" style={{minWidth:130}} value={fField} onChange={e=>setFField(e.target.value)}>
              <option value="all">All Fields</option>
              {[...new Set(harvest.map(e=>e.field).filter(Boolean))].sort().map(f=><option key={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>AGENT</div>
            <select className="ch-input" style={{minWidth:130}} value={fAgent} onChange={e=>setFAgent(e.target.value)}>
              <option value="all">All Agents</option>
              {[...new Set(harvest.map(e=>e.agent).filter(Boolean))].sort().map(a=><option key={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:3}}>WORKER</div>
            <select className="ch-input" style={{minWidth:130}} value={fWorker} onChange={e=>setFWorker(e.target.value)}>
              <option value="all">All Workers</option>
              {[...new Set(harvest.map(e=>e.worker).filter(Boolean))].sort().map(w=><option key={w}>{w}</option>)}
            </select>
          </div>

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
            {rows.length} entries
          </div>
        </div>

        <div style={{overflowX:'auto'}}>
          <table className="ch-table ch-ratepay-table">
            <thead>
              <tr>
                <th>Date</th><th>Worker</th><th>Agent</th><th>Total Kg</th>
                <th>Worker pay</th><th>Advance</th><th>Worker Payment</th>
                <th>Rate</th><th>Agent rev</th><th>Agent Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.length===0&&(
                <tr><td colSpan={10} style={{textAlign:'center',padding:40,color:'var(--muted)'}}>
                  No matching entries.
                </td></tr>
              )}
              {rows.map(e=>{
                const advance = advanceAsOf(e.worker, e.date);
                return (
                  <tr key={e.id}>
                    <td>{e.date}</td><td>{e.worker}</td><td>{e.agent}</td>
                    <td>{(e.tNet||0).toFixed(1)}</td>
                    <td style={{color:'var(--success)'}}>{inr(e.workerPay||0)}</td>
                    <td>{advance>0 ? <span className="ch-badge ch-badge-gold" title="Pending advance as of this session's date">−{inr(advance)}</span> : <span style={{color:'var(--muted)'}}>—</span>}</td>
                    <td><EditablePayCell id={e.id} paidAmount={e.workerPayAmount} paidDate={e.workerPayDate} total={e.workerPay} onUpdate={onUpdateWorkerPay} advance={advance} onMarkPaidWithAdvance={()=>onPayWorkerNetOfAdvance(e.id)} onMarkPaidFull={()=>onPayWorkerFull(e.id)}/></td>
                    <td><EditableRateCell id={e.id} rate={e.rate} rateStatus={e.rateStatus} onUpdateRate={onUpdateRate}/></td>
                    <td style={{fontFamily:'var(--font-mono)'}}>₹{(e.agentRev||0).toFixed(1)}</td>
                    <td><EditablePayCell id={e.id} paidAmount={e.agentPayAmount} paidDate={e.agentPayDate} total={e.agentRev} onUpdate={onUpdateAgentPay}/></td>
                  </tr>
                );
              })}
              {rows.length>0&&(
                <tr style={{background:'var(--surface2)',fontWeight:600}}>
                  <td colSpan={3} style={{textAlign:'right',color:'var(--muted)'}}>Totals</td>
                  <td>{rows.reduce((s,e)=>s+(e.tNet||0),0).toFixed(1)} kg</td>
                  <td style={{color:'var(--success)'}}>{inr(rows.reduce((s,e)=>s+(e.workerPay||0),0))}</td>
                  <td></td>
                  <td style={{color:'var(--success)'}}>{inr(rows.reduce((s,e)=>s+(e.workerPayAmount||0),0))}</td>
                  <td></td>
                  <td style={{fontFamily:'var(--font-mono)'}}>₹{rows.reduce((s,e)=>s+(e.agentRev||0),0).toFixed(1)}</td>
                  <td style={{color:'var(--success)'}}>{inr(rows.reduce((s,e)=>s+(e.agentPayAmount||0),0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{marginTop:8,fontSize:'0.72rem',color:'var(--muted)',display:'flex',alignItems:'center',gap:5}}>
        <span>💸</span> Advance shows what was pending as of that session's date. The primary pay button nets it against the amount owed; the small link below it pays the full amount and leaves the advance for later.
      </div>
    </div>
  );
}
