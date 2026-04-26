import React from 'react';
import {inr} from '../../utils/chaayaService';

import BagBuilder from './BagBuilder';

export default function HarvestTab({
  isAdmin,bags,setBags,deductMode,setDeductMode,
  hDate,setHDate,hWorker,setHWorker,hField,setHField,hAgent,setHAgent,
  workerList,agentList,fieldList,rates,editingHarvestId,
  saveHarvest,savingHarvest,clearForm,
  filteredHarvest,harvestFilter,setHarvestFilter,harvestWeeks,
  editHarvestEntry,deleteHarvestEntry,pendingRateSessions,
}){
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
              Once the agent confirms the final rate, go to <strong style={{color:'var(--text)'}}>◇ Market Rates</strong> and
              add the confirmed rate with the correct date range. Then edit each ⏳ session above and re-save —
              revenue figures will update automatically. This banner clears when all sessions show a confirmed rate.
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

      <div className="ch-card" style={{padding:0}}>
        <div style={{padding:'14px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,color:'var(--text)'}}>Harvest Log</div>
          <select className="ch-input" style={{width:180}} value={harvestFilter} onChange={e=>setHarvestFilter(e.target.value)}>
            <option value="all">All Entries</option>
            {harvestWeeks.map(w=><option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="ch-table">
            <thead>
              <tr>
                <th>Date</th><th>Worker</th><th>Field</th><th>Agent</th><th>Bags</th>
                <th>Gross</th><th>Bag ded</th><th>Water ded</th><th>Net kg</th>
                <th>Worker pay</th><th>Rate</th><th>Agent rev</th>
                {isAdmin&&<th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredHarvest.length===0&&(
                <tr><td colSpan={13} style={{textAlign:'center',padding:40,color:'var(--muted)'}}>
                  No harvest sessions yet.
                </td></tr>
              )}
              {filteredHarvest.map(e=>(
                <tr key={e.id}>
                  <td>{e.date}</td><td>{e.worker}</td>
                  <td><span className="ch-badge ch-badge-green">{e.field}</span></td>
                  <td>{e.agent}</td>
                  <td><span className="ch-badge ch-badge-blue">{e.bags} bags</span></td>
                  <td>{(e.tGross||0).toFixed(1)}</td>
                  <td style={{color:'var(--accent)'}}>−{(e.tBagDed||0).toFixed(2)}</td>
                  <td style={{color:'var(--danger)'}}>−{(e.tWaterDed||0).toFixed(2)} <span style={{fontSize:10,opacity:.6}}>({(e.avgWaterPct||0).toFixed(1)}%)</span></td>
                  <td style={{fontWeight:700}}>{(e.tNet||0).toFixed(2)}</td>
                  <td style={{color:'var(--success)'}}>{inr(e.workerPay||0)}</td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>
                    ₹{e.rate||0}/kg
                    {e.rateStatus==='placeholder'&&<span style={{background:'rgba(201,148,26,.15)',color:'var(--accent)',borderRadius:4,padding:'1px 5px',fontSize:10,marginLeft:4}}>⏳ est.</span>}
                    {e.rateStatus==='no-rate'&&<span style={{background:'rgba(184,74,46,.12)',color:'var(--danger)',borderRadius:4,padding:'1px 5px',fontSize:10,marginLeft:4}}>no rate</span>}
                  </td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{inr(e.agentRev||0)}</td>
                  {isAdmin&&(
                    <td>
                      <div style={{display:'flex',gap:5}}>
                        <button className="ch-btn ch-btn-edit ch-btn-sm" onClick={()=>editHarvestEntry(e)}>Edit</button>
                        <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>deleteHarvestEntry(e.id)}>✕</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredHarvest.length>0&&(
                <tr style={{background:'var(--surface2)',fontWeight:600}}>
                  <td colSpan={8} style={{textAlign:'right',color:'var(--muted)'}}>Totals</td>
                  <td>{filteredHarvest.reduce((s,e)=>s+(e.tNet||0),0).toFixed(2)} kg</td>
                  <td style={{color:'var(--success)'}}>{inr(filteredHarvest.reduce((s,e)=>s+(e.workerPay||0),0))}</td>
                  <td></td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{inr(filteredHarvest.reduce((s,e)=>s+(e.agentRev||0),0))}</td>
                  {isAdmin&&<td></td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
