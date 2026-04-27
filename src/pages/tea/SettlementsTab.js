import React,{useState} from 'react';
import { useMobile } from '../../hooks/useMobile';
import {inr,agentPendingBreakdown} from '../../utils/chaayaService';
import {C} from './chaayaStyles';

export default function SettlementsTab({
  isAdmin,harvest,settlements,advances,agentPayments,workerList,
  onWorkerPay,onAgentPay,onDeleteSettlement,onDeleteAgentPayment,
}){
  const isMobile = useMobile();
  const [stab,setStab]=useState('workers');
  const [settleView,setSettleView]=useState('week');
  const agentBreakdown=agentPendingBreakdown(harvest,agentPayments);
  const totalPending=agentBreakdown.reduce((s,x)=>s+x.pending,0);
  const allAgents=[...new Set([...harvest.map(h=>h.agent),...agentPayments.map(p=>p.agent)].filter(Boolean))];

  return(
    <div>
      <div className="ch-tabs">
        {[['workers','Worker Wages'],['agents','Agent Payments']].map(([k,l])=>(
          <button key={k} className={`ch-tab ${stab===k?'active':''}`} onClick={()=>setStab(k)}>{l}</button>
        ))}
      </div>

      {stab==='workers'&&(
        <div>
          <div className="ch-pending-panel">
            <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:4}}>Agent Revenue Pending</div>
            <div style={{fontSize:26,fontWeight:600,color:'var(--text)'}}>{inr(totalPending)}</div>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>
              {inr(agentBreakdown.reduce((s,x)=>s+x.earned,0))} earned − {inr(agentBreakdown.reduce((s,x)=>s+x.received,0))} received
            </div>
          </div>

          {/* Per-agent bars */}
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
            {agentBreakdown.map(x=>{
              const maxE=Math.max(...agentBreakdown.map(a=>a.earned),1);
              return(
                <div key={x.agent} style={{border:'1px solid var(--border)',borderRadius:8,padding:12,background:'var(--surface)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <span style={{fontWeight:600,color:'var(--text)'}}>{x.agent}</span>
                    <span style={{fontWeight:500,color:x.pending>0?C.rust:C.leaf}}>{x.pending>0?`${inr(x.pending)} owed`:'Fully paid'}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:isMobile?12:16,marginBottom:10}}>
                    {[['Total Net',`${x.totalKg.toFixed(1)} kg`],['Sessions',x.sessions],['Avg Rate',`₹${x.avgRate.toFixed(2)}`]].map(([l,v])=>(
                      <div key={l} style={{textAlign:'center',padding:6,background:'var(--surface2)',borderRadius:4}}>
                        <div style={{fontWeight:500,color:'var(--text)',fontSize:12}}>{v}</div>
                        <div style={{color:'var(--muted)',fontSize:10}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                    <span style={{minWidth:60,color:'var(--muted)'}}>Revenue:</span>
                    <div style={{flex:1,height:8,background:'var(--surface2)',borderRadius:4,position:'relative',overflow:'hidden'}}>
                      <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${Math.round(x.earned/maxE*100)}%`,background:'var(--tea-light)',borderRadius:4}}/>
                      <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${Math.round(x.received/maxE*100)}%`,background:'var(--success)',borderRadius:4}}/>
                    </div>
                    <span style={{minWidth:120,textAlign:'right',fontSize:11,color:'var(--muted)'}}>{inr(x.earned)} earned · {inr(x.received)} rcvd</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Worker cards */}
          <div className="ch-grid-2">
            {workerList.map(w=>{
              const totalEarned=harvest.filter(e=>e.worker===w).reduce((s,e)=>s+(e.workerPay||0),0);
              const pendingAdv=advances.filter(a=>a.worker===w&&!a.deducted).reduce((s,a)=>s+(a.amount||0),0);
              const paid=settlements.filter(s=>s.worker===w).reduce((s,x)=>s+(x.netPaid||0),0);
              const outstanding=Math.max(0,totalEarned-pendingAdv-paid);
              return(
                <div key={w} className="ch-card">
                  <div className="ch-card-title">{w}</div>
                  {[['Total Harvest Wages',inr(totalEarned),C.leaf],['Pending Advances',`−${inr(pendingAdv)}`,C.rust],['Previously Settled',`−${inr(paid)}`,C.muted]].map(([l,v,c])=>(
                    <div key={l} className="ch-settle-row">
                      <div style={{color:'var(--muted)'}}>{l}</div>
                      <div style={{fontSize:13,color:c}}>{v}</div>
                    </div>
                  ))}
                  <div className="ch-total-row">
                    <span style={{fontSize:12.5,fontWeight:500,color:'var(--muted)'}}>Outstanding Now</span>
                    <span style={{fontSize:15,fontWeight:500,color:outstanding>0?C.leaf:C.faint}}>{inr(outstanding)}</span>
                  </div>
                  {isAdmin&&(
                    <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
                      <button className="ch-btn ch-btn-primary ch-btn-sm" onClick={()=>onWorkerPay(w,outstanding,false)} disabled={outstanding<=0}>Pay Worker</button>
                      <button className="ch-btn ch-btn-secondary ch-btn-sm" onClick={()=>onWorkerPay(w,outstanding,true)} disabled={outstanding<=0} title="Pay before agent has paid you">Pay Now (Float)</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {settlements.length>0&&(
            <div className="ch-card" style={{padding:0}}>
              <div style={{padding:'14px 20px 0',fontSize:16,fontWeight:600,color:'var(--text)'}}>Settlement History</div>
              <table className="ch-table">
                <thead><tr><th>Date</th><th>Worker</th><th>Amount</th><th>Notes</th>{isAdmin&&<th></th>}</tr></thead>
                <tbody>
                  {settlements.map(s=>(
                    <tr key={s.id}>
                      <td>{s.date}</td><td>{s.worker}</td>
                      <td style={{color:'var(--success)'}}>{inr(s.netPaid)}</td>
                      <td style={{color:'var(--muted)',fontSize:12}}>{s.notes||'—'}</td>
                      {isAdmin&&<td><button className="ch-btn ch-btn-danger ch-btn-xs" onClick={()=>onDeleteSettlement(s.id)}>✕</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {stab==='agents'&&(
        <div>
          {isAdmin&&<div style={{marginBottom:18}}><button className="ch-btn ch-btn-primary" onClick={onAgentPay}>+ Record Agent Payment</button></div>}
          <div className="ch-tabs" style={{marginBottom:16}}>
            {[['week','By Agent'],['ytd','YTD'],['yoy','Year-on-Year']].map(([k,l])=>(
              <button key={k} className={`ch-tab ${settleView===k?'active':''}`} onClick={()=>setSettleView(k)}>{l}</button>
            ))}
          </div>
          {settleView==='week'&&<AgentWeekView agentBreakdown={agentBreakdown} agentPayments={agentPayments} isAdmin={isAdmin} onDelete={onDeleteAgentPayment}/>}
          {settleView==='ytd'&&<AgentYTDView harvest={harvest} agentList={allAgents}/>}
          {settleView==='yoy'&&<AgentYOYView harvest={harvest} agentList={[...new Set(harvest.map(h=>h.agent).filter(Boolean))]}/>}
        </div>
      )}
    </div>
  );
}

function AgentWeekView({agentBreakdown,agentPayments,isAdmin,onDelete}){
  return(
    <div>
      {agentBreakdown.map(x=>(
        <div key={x.agent} className="ch-card" style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:16,fontWeight:600,color:'var(--text)'}}>{x.agent}</div>
            <span style={{color:x.pending>0?C.rust:C.leaf,fontWeight:500}}>{x.pending>0?`${inr(x.pending)} pending`:'✓ Fully paid'}</span>
          </div>
          {[['Total earned',inr(x.earned)],['Received',inr(x.received)],['Pending',inr(x.pending)]].map(([l,v])=>(
            <div key={l} className="ch-settle-row"><span style={{color:'var(--muted)'}}>{l}</span><span style={{}}>{v}</span></div>
          ))}
        </div>
      ))}
      {agentPayments.length>0&&(
        <div className="ch-card" style={{padding:0}}>
          <div style={{padding:'14px 20px 0',fontSize:16,fontWeight:600,color:'var(--text)'}}>Payment History</div>
          <table className="ch-table">
            <thead><tr><th>Date</th><th>Agent</th><th>Amount</th><th>Method</th><th>Notes</th>{isAdmin&&<th></th>}</tr></thead>
            <tbody>
              {agentPayments.map(p=>(
                <tr key={p.id}>
                  <td>{p.date}</td><td>{p.agent}</td>
                  <td style={{color:'var(--success)'}}>{inr(p.amount)}</td>
                  <td><span className="ch-badge ch-badge-blue">{p.method||'Cash'}</span></td>
                  <td style={{color:'var(--muted)',fontSize:12}}>{p.notes||'—'}</td>
                  {isAdmin&&<td><button className="ch-btn ch-btn-danger ch-btn-xs" onClick={()=>onDelete(p.id)}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgentYTDView({harvest,agentList}){
  const y=new Date().getFullYear();
  const ytdH=harvest.filter(e=>(e.year||new Date(e.date||'').getFullYear())===y);
  return(
    <div className="ch-card" style={{padding:0}}>
      <div style={{padding:'14px 20px 0',fontSize:16,fontWeight:600,color:'var(--text)'}}>YTD Agent Summary — {y}</div>
      <div style={{overflowX:'auto'}}>
        <table className="ch-table">
          <thead><tr><th>Agent</th><th>Sessions</th><th>Gross Kg</th><th>Total Ded.</th><th>Net Kg</th><th>Avg Rate</th><th>Revenue</th><th>Rev Lost</th></tr></thead>
          <tbody>
            {agentList.map(a=>{
              const ah=ytdH.filter(e=>e.agent===a);
              const gKg=ah.reduce((s,e)=>s+(e.tGross||0),0);
              const ded=ah.reduce((s,e)=>s+(e.tBagDed||0)+(e.tWaterDed||0),0);
              const nKg=ah.reduce((s,e)=>s+(e.tNet||0),0);
              const rev=ah.reduce((s,e)=>s+(e.agentRev||0),0);
              const avgR=ah.length?ah.reduce((s,e)=>s+(e.rate||0),0)/ah.length:0;
              return(
                <tr key={a}>
                  <td style={{fontWeight:600}}>{a}</td><td>{ah.length}</td>
                  <td>{gKg.toFixed(1)}</td><td style={{color:'var(--danger)'}}>{ded.toFixed(2)}</td>
                  <td>{nKg.toFixed(2)}</td><td style={{}}>₹{avgR.toFixed(2)}</td>
                  <td style={{fontWeight:600,color:'var(--success)'}}>{inr(rev)}</td>
                  <td style={{color:'var(--danger)'}}>{inr(ded*avgR)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgentYOYView({harvest,agentList}){
  const years=[...new Set(harvest.map(e=>e.year||new Date(e.date||'').getFullYear()).filter(Boolean))].sort();
  if(years.length<2) return <div className="ch-alert-info">ℹ️ YoY comparison requires data across at least 2 years.</div>;
  return(
    <div className="ch-card" style={{padding:0}}>
      <div style={{padding:'14px 20px 0',fontSize:16,fontWeight:600,color:'var(--text)'}}>Year-on-Year Agent Revenue</div>
      <div style={{overflowX:'auto'}}>
        <table className="ch-table">
          <thead>
            <tr><th>Agent</th>{years.map(y=><React.Fragment key={y}><th>{y} Revenue</th><th>{y} Net Kg</th></React.Fragment>)}<th>Trend</th></tr>
          </thead>
          <tbody>
            {agentList.map(a=>{
              const yd=years.map(y=>{const ah=harvest.filter(e=>e.agent===a&&(e.year||new Date(e.date||'').getFullYear())===y);return{rev:ah.reduce((s,e)=>s+(e.agentRev||0),0),kg:ah.reduce((s,e)=>s+(e.tNet||0),0)};});
              const trend=yd.length>=2&&yd[yd.length-2].rev>0?((yd[yd.length-1].rev-yd[yd.length-2].rev)/yd[yd.length-2].rev*100):0;
              return(
                <tr key={a}>
                  <td style={{fontWeight:600}}>{a}</td>
                  {yd.map((d,i)=><React.Fragment key={i}><td>{inr(d.rev)}</td><td>{d.kg.toFixed(0)} kg</td></React.Fragment>)}
                  <td style={{color:trend>=0?C.leaf:C.rust,fontWeight:500}}>{trend>=0?'↑':'↓'} {Math.abs(trend).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
