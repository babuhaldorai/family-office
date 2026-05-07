import React,{useState} from 'react';
import {inr,todayStr} from '../../utils/chaayaService';


const MAINT_TASKS=['Pruning','Cleaning','Weeding','Fertilizing','Pest Control','Irrigation','Harvesting Equipment','Other'];

// ── ADVANCES TAB ──────────────────────────────────────────────────────────────
export function AdvancesTab({isAdmin,advances,workerList,onSave,onMarkDeducted,onDelete}){
  const [form,setForm]=useState({worker:workerList[0]||'',date:todayStr(),amount:'',notes:''});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    if(!form.amount)return alert('Enter amount');
    await onSave({worker:form.worker,date:form.date,amount:parseFloat(form.amount),notes:form.notes,deducted:false});
    setForm(f=>({...f,amount:'',notes:''}));
  };
  const pending=advances.filter(a=>!a.deducted);
  const workers=workerList;
  return(
    <div>
      {isAdmin&&(
        <div className="ch-card">
          <div className="ch-card-title">Record Advance</div>
          <div className="ch-grid-4">
            <div className="ch-form-group"><label>Worker</label>
              <select className="ch-input" value={form.worker} onChange={e=>set('worker',e.target.value)}>
                {workers.map(w=><option key={w}>{w}</option>)}
              </select></div>
            <div className="ch-form-group"><label>Date</label>
              <input className="ch-input" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
            <div className="ch-form-group"><label>Amount (₹)</label>
              <input className="ch-input" type="number" step="0.01" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0"/></div>
            <div className="ch-form-group"><label>Notes</label>
              <input className="ch-input" value={form.notes} onChange={e=>set('notes',e.target.value)}/></div>
          </div>
          <button className="ch-btn ch-btn-primary" style={{marginTop:12}} onClick={save}>Save Advance</button>
        </div>
      )}
      {workers.length>0&&(
        <div className="ch-grid-2" style={{marginBottom:18}}>
          {workers.map(w=>{
            const total=pending.filter(a=>a.worker===w).reduce((s,a)=>s+(a.amount||0),0);
            return(
              <div key={w} style={{background:'rgba(201,168,76,.07)',border:'1px solid rgba(201,148,26,.2)',borderRadius:8,padding:11}}>
                <div style={{fontSize:11.5,color:'var(--accent)',fontWeight:500}}>{w}</div>
                <div style={{fontSize:20,fontWeight:600,color:'var(--warn)',marginTop:2}}>{inr(total)}</div>
                <div style={{fontSize:11.5,color:'var(--muted)'}}>{total>0?'Pending deduction':'Clear'}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="ch-card" style={{padding:0}}>
        <table className="ch-table">
          <thead><tr><th>Date</th><th>Worker</th><th>Amount</th><th>Notes</th><th>Status</th>{isAdmin&&<th></th>}</tr></thead>
          <tbody>
            {advances.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>No advances logged yet.</td></tr>}
            {advances.map(a=>(
              <tr key={a.id}>
                <td>{a.date}</td><td>{a.worker}</td>
                <td style={{fontFamily:'var(--font-mono)'}}>{inr(a.amount)}</td>
                <td style={{color:'var(--muted)',fontSize:12}}>{a.notes||'—'}</td>
                <td>{a.deducted?<span className="ch-badge ch-badge-green">Deducted</span>:<span className="ch-badge ch-badge-gold">Pending</span>}</td>
                {isAdmin&&(
                  <td style={{display:'flex',gap:5}}>
                    {!a.deducted&&<button className="ch-btn ch-btn-secondary ch-btn-sm" onClick={()=>onMarkDeducted(a.id)}>Mark Deducted</button>}
                    <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>onDelete(a.id)}>✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── MAINTENANCE TAB ───────────────────────────────────────────────────────────
export function MaintenanceTab({isAdmin,maintenance,workerList,fieldList,onSave,onDelete}){
  const fields=fieldList;
  const workers=workerList;
  const [form,setForm]=useState({date:todayStr(),field:fields[0]||'',task:MAINT_TASKS[0],worker:workers[0]||'',days:'1',rate:'',notes:'',urea:'',ureaRate:'',ammonia:'',ammoniaRate:'',mixed:'',mixedRate:''});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    const rate=parseFloat(form.rate)||0,days=parseFloat(form.days)||1;
    let cost=rate*days;
    let fertData={};
    if(form.task==='Fertilizing'){
      const urea=parseInt(form.urea)||0, ureaRate=parseFloat(form.ureaRate)||0;
      const ammonia=parseInt(form.ammonia)||0, ammoniaRate=parseFloat(form.ammoniaRate)||0;
      const mixed=parseInt(form.mixed)||0, mixedRate=parseFloat(form.mixedRate)||0;
      const totalBags=urea+ammonia+mixed;
      const bagCost=(urea*ureaRate)+(ammonia*ammoniaRate)+(mixed*mixedRate);
      const labourCost=rate*days; // days × rate from the main form
      cost=bagCost+labourCost; // total = bags + labour
      fertData={urea,ureaRate,ammonia,ammoniaRate,mixed,mixedRate,totalBags,bagCost,labourCost,fertCost:cost};
    }
    const d2=form.date?new Date(form.date):new Date();
    await onSave({
      ...form,...fertData,days,rate,cost,
      year:d2.getFullYear(),
      month:d2.getMonth()+1,
    });
    setForm(f=>({...f,rate:'',notes:'',urea:'',ureaRate:'',ammonia:'',ammoniaRate:'',mixed:'',mixedRate:''}));
  };
  const total=maintenance.reduce((s,e)=>s+(e.cost||0),0);
  return(
    <div>
      {isAdmin&&(
        <div className="ch-card">
          <div className="ch-card-title">Log Maintenance</div>
          <div className="ch-grid-4" style={{marginBottom:12}}>
            <div className="ch-form-group"><label>Date</label><input className="ch-input" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
            <div className="ch-form-group"><label>Field</label>
              <select className="ch-input" value={form.field} onChange={e=>set('field',e.target.value)}>
                {fields.map(f=><option key={f}>{f}</option>)}
              </select></div>
            <div className="ch-form-group"><label>Task</label>
              <select className="ch-input" value={form.task} onChange={e=>set('task',e.target.value)}>
                {MAINT_TASKS.map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div className="ch-form-group"><label>Worker</label>
              <select className="ch-input" value={form.worker} onChange={e=>set('worker',e.target.value)}>
                {workers.map(w=><option key={w}>{w}</option>)}
              </select></div>
          </div>
          <div className="ch-grid-3">
            <div className="ch-form-group"><label>Days</label><input className="ch-input" type="number" step="0.5" value={form.days} onChange={e=>set('days',e.target.value)}/></div>
            <div className="ch-form-group"><label>Rate per Day (₹)</label><input className="ch-input" type="number" step="0.01" value={form.rate} onChange={e=>set('rate',e.target.value)}/></div>
            <div className="ch-form-group"><label>Notes</label><input className="ch-input" value={form.notes} onChange={e=>set('notes',e.target.value)}/></div>
          </div>
          {/* Fertilizer details — shown only for Fertilizing task */}
          {form.task==='Fertilizing'&&(
            <div style={{marginTop:12,padding:'12px 14px',background:'var(--surface2)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
              <div style={{fontWeight:600,fontSize:'0.85rem',marginBottom:4,color:'var(--text)'}}>🌿 Fertilizer Bags</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:10}}>Labour is logged separately as worker days above.</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:10}}>
                <div style={{padding:'10px 12px',background:'var(--surface)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                  <div style={{fontWeight:600,fontSize:'0.82rem',marginBottom:8,color:'var(--tea-light)'}}>Urea</div>
                  <div className="ch-form-group" style={{marginBottom:8}}><label>Bags</label><input className="ch-input" type="number" min="0" value={form.urea} onChange={e=>set('urea',e.target.value)} placeholder="0"/></div>
                  <div className="ch-form-group"><label>Rate per Bag (₹)</label><input className="ch-input" type="number" step="0.01" value={form.ureaRate} onChange={e=>set('ureaRate',e.target.value)} placeholder="0"/></div>
                  {(form.urea||form.ureaRate)&&<div style={{marginTop:6,fontSize:'0.78rem',color:'var(--accent)',fontWeight:600}}>{inr((parseInt(form.urea)||0)*(parseFloat(form.ureaRate)||0))}</div>}
                </div>
                <div style={{padding:'10px 12px',background:'var(--surface)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                  <div style={{fontWeight:600,fontSize:'0.82rem',marginBottom:8,color:'var(--rental-light)'}}>Ammonia</div>
                  <div className="ch-form-group" style={{marginBottom:8}}><label>Bags</label><input className="ch-input" type="number" min="0" value={form.ammonia} onChange={e=>set('ammonia',e.target.value)} placeholder="0"/></div>
                  <div className="ch-form-group"><label>Rate per Bag (₹)</label><input className="ch-input" type="number" step="0.01" value={form.ammoniaRate} onChange={e=>set('ammoniaRate',e.target.value)} placeholder="0"/></div>
                  {(form.ammonia||form.ammoniaRate)&&<div style={{marginTop:6,fontSize:'0.78rem',color:'var(--accent)',fontWeight:600}}>{inr((parseInt(form.ammonia)||0)*(parseFloat(form.ammoniaRate)||0))}</div>}
                </div>
                <div style={{padding:'10px 12px',background:'var(--surface)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                  <div style={{fontWeight:600,fontSize:'0.82rem',marginBottom:8,color:'var(--warn)'}}>Mix (Urea+Ammonia)</div>
                  <div className="ch-form-group" style={{marginBottom:8}}><label>Bags</label><input className="ch-input" type="number" min="0" value={form.mixed} onChange={e=>set('mixed',e.target.value)} placeholder="0"/></div>
                  <div className="ch-form-group"><label>Rate per Bag (₹)</label><input className="ch-input" type="number" step="0.01" value={form.mixedRate} onChange={e=>set('mixedRate',e.target.value)} placeholder="0"/></div>
                  {(form.mixed||form.mixedRate)&&<div style={{marginTop:6,fontSize:'0.78rem',color:'var(--accent)',fontWeight:600}}>{inr((parseInt(form.mixed)||0)*(parseFloat(form.mixedRate)||0))}</div>}
                </div>
              </div>
            {/* Summary of fertilizer session total */}
            <div style={{marginTop:10,padding:'10px 12px',background:'var(--surface)',borderRadius:'var(--radius)',fontSize:13,display:'flex',gap:20,flexWrap:'wrap'}}>
              <span>Total bags: <strong>{(parseInt(form.urea)||0)+(parseInt(form.ammonia)||0)+(parseInt(form.mixed)||0)}</strong></span>
              <span>Bag cost: <strong style={{color:'var(--warn)'}}>{inr((parseInt(form.urea)||0)*(parseFloat(form.ureaRate)||0)+(parseInt(form.ammonia)||0)*(parseFloat(form.ammoniaRate)||0)+(parseInt(form.mixed)||0)*(parseFloat(form.mixedRate)||0))}</strong></span>
              {(form.days&&form.rate)&&<span>Labour: <strong style={{color:'var(--warn)'}}>{inr((parseFloat(form.days)||0)*(parseFloat(form.rate)||0))}</strong></span>}
              {(form.days&&form.rate)&&<span>Session total: <strong style={{color:'var(--accent)'}}>{inr((parseInt(form.urea)||0)*(parseFloat(form.ureaRate)||0)+(parseInt(form.ammonia)||0)*(parseFloat(form.ammoniaRate)||0)+(parseInt(form.mixed)||0)*(parseFloat(form.mixedRate)||0)+(parseFloat(form.days)||0)*(parseFloat(form.rate)||0))}</strong></span>}
            </div>
            </div>
          )}
          {form.task==='Fertilizing'&&form.rate&&form.days&&(
            <div style={{fontSize:13,color:'var(--text)',marginBottom:10,padding:'6px 10px',background:'var(--surface2)',borderRadius:'var(--radius)'}}>
              Labour: <strong>{inr((parseFloat(form.rate)||0)*(parseFloat(form.days)||1))}</strong>
              {' · '}Total (bags+labour): <strong style={{color:'var(--accent)'}}>{inr(
                (parseInt(form.urea)||0)*(parseFloat(form.ureaRate)||0)+
                (parseInt(form.ammonia)||0)*(parseFloat(form.ammoniaRate)||0)+
                (parseInt(form.mixed)||0)*(parseFloat(form.mixedRate)||0)+
                (parseFloat(form.rate)||0)*(parseFloat(form.days)||1)
              )}</strong>
            </div>
          )}
          {form.task!=='Fertilizing'&&form.rate&&form.days&&<div style={{fontSize:13,color:'var(--text)',marginBottom:10}}>Cost: <strong>{inr((parseFloat(form.rate)||0)*(parseFloat(form.days)||1))}</strong></div>}
          <button className="ch-btn ch-btn-primary" onClick={save}>Save</button>
        </div>
      )}
      <div className="ch-card" style={{padding:0}}>
        <table className="ch-table">
          <thead><tr><th>Date</th><th>Field</th><th>Task</th><th>Worker</th><th>Days / Bags</th><th>Details</th><th>Cost</th>{isAdmin&&<th></th>}</tr></thead>
          <tbody>
            {maintenance.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>No maintenance logs yet.</td></tr>}
            {[...maintenance].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>(
              <tr key={e.id}>
                <td>{e.date}</td><td>{e.field}</td>
                <td><span className="ch-badge ch-badge-earth">{e.task}</span></td>
                <td style={{fontSize:'0.8rem'}}>{e.worker}</td>
                <td style={{fontSize:'0.82rem'}}>
                  {e.task==='Fertilizing'
                    ? <span>{e.totalBags||0} bags</span>
                    : <span>{e.days}d</span>}
                </td>
                <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>
                  {e.task==='Fertilizing'&&e.totalBags>0
                    ? <span style={{display:'flex',flexDirection:'column',gap:2}}>
                        <span>{e.urea>0?`U:${e.urea}×${inr(e.ureaRate||0)} `:''}{e.ammonia>0?`A:${e.ammonia}×${inr(e.ammoniaRate||0)} `:''}{e.mixed>0?`Mix:${e.mixed}×${inr(e.mixedRate||0)}`:''}</span>
                        {e.labourCost>0&&<span style={{color:'var(--muted)'}}>Labour: {inr(e.labourCost)} ({e.days}d @ {inr(e.rate)}/d)</span>}
                      </span>
                    : <span>{e.notes||'—'}</span>}
                </td>
                <td style={{fontFamily:'var(--font-mono)'}}>{inr(e.cost)}</td>
                {isAdmin&&<td><button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>onDelete(e.id)}>✕</button></td>}
              </tr>
            ))}
            {maintenance.length>0&&<tr style={{background:'var(--surface2)',fontWeight:600}}><td colSpan={6} style={{textAlign:'right',color:'var(--muted)'}}>Total</td><td style={{fontFamily:'var(--font-mono)'}}>{inr(total)}</td>{isAdmin&&<td/>}</tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── WEATHER TAB ───────────────────────────────────────────────────────────────
export function WeatherTab({isAdmin,weather,onSave,onDelete}){
  const [form,setForm]=useState({date:todayStr(),rainfall:'',temp:''});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    if(!form.date)return alert('Select a date');
    await onSave({date:form.date,rainfall:parseFloat(form.rainfall)||0,temp:parseFloat(form.temp)||0});
    setForm(f=>({...f,rainfall:'',temp:''}));
  };
  return(
    <div>
      {isAdmin&&(
        <div className="ch-card">
          <div className="ch-card-title">Log Weather Data</div>
          <div className="ch-grid-3">
            <div className="ch-form-group"><label>Date</label><input className="ch-input" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
            <div className="ch-form-group"><label>Rainfall (mm)</label><input className="ch-input" type="number" step="0.1" value={form.rainfall} onChange={e=>set('rainfall',e.target.value)} placeholder="0.0"/></div>
            <div className="ch-form-group"><label>Max Temp (°C)</label><input className="ch-input" type="number" value={form.temp} onChange={e=>set('temp',e.target.value)} placeholder="30"/></div>
          </div>
          <button className="ch-btn ch-btn-primary" style={{marginTop:12}} onClick={save}>Save Weather</button>
        </div>
      )}
      <div className="ch-card" style={{padding:0}}>
        <table className="ch-table">
          <thead><tr><th>Date</th><th>Rainfall (mm)</th><th>Max Temp (°C)</th>{isAdmin&&<th></th>}</tr></thead>
          <tbody>
            {weather.length===0&&<tr><td colSpan={4} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>No weather data yet.</td></tr>}
            {weather.map(w=>(
              <tr key={w.id}>
                <td>{w.date}</td><td>{w.rainfall||0} mm</td><td>{w.temp||0}°C</td>
                {isAdmin&&<td><button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>onDelete(w.id)}>✕</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── RATES TAB ─────────────────────────────────────────────────────────────────
export function RatesTab({isAdmin,rates,agentList,onSave,onUpdate,onDelete}){
  const agents=agentList;
  const emptyForm = {agent:agents[0]||'',rate:'',startDate:todayStr(),endDate:'',notes:''};
  const [form,setForm]=useState(emptyForm);
  const [editId,setEditId]=useState(null); // null = adding new, id = editing existing
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const startEdit=(r)=>{
    setEditId(r.id);
    setForm({agent:r.agent,rate:String(r.rate),startDate:r.startDate||'',endDate:r.endDate||'',notes:r.notes||''});
  };
  const cancelEdit=()=>{ setEditId(null); setForm(emptyForm); };

  const save=async()=>{
    if(!form.rate) return alert('Enter a rate');
    if(!form.startDate) return alert('Enter a from date');
    const data={agent:form.agent,rate:parseFloat(form.rate),startDate:form.startDate,endDate:form.endDate||null,notes:form.notes};
    if(editId){
      await onUpdate(editId,data);
      setEditId(null);
    } else {
      await onSave(data);
    }
    setForm(emptyForm);
  };

  const today=todayStr();
  const active=rates.filter(r=>r.startDate<=today&&(!r.endDate||r.endDate>=today));
  return(
    <div>
      {isAdmin&&(
        <div className="ch-grid-2" style={{marginBottom:18}}>
          <div className="ch-card">
            <div className="ch-card-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>{editId ? 'Edit Rate' : 'Set New Rate'}</span>
              {editId && <button className="ch-btn ch-btn-ghost ch-btn-sm" onClick={cancelEdit}>Cancel</button>}
            </div>
            <div className="ch-form-group"><label>Agent</label>
              <select className="ch-input" value={form.agent} onChange={e=>set('agent',e.target.value)}>
                {agents.map(a=><option key={a}>{a}</option>)}
              </select></div>
            <div className="ch-grid-2">
              <div className="ch-form-group"><label>Rate (₹/kg)</label><input className="ch-input" type="number" step="0.01" value={form.rate} onChange={e=>set('rate',e.target.value)} placeholder="e.g. 42.00"/></div>
              <div className="ch-form-group"><label>Notes</label><input className="ch-input" value={form.notes} onChange={e=>set('notes',e.target.value)}/></div>
            </div>
            <div className="ch-grid-2">
              <div className="ch-form-group"><label>From (Saturday)</label><input className="ch-input" type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)}/></div>
              <div className="ch-form-group"><label>To (Friday, optional)</label><input className="ch-input" type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)}/></div>
            </div>
            <button className="ch-btn ch-btn-primary" style={{marginTop:12}} onClick={save}>
              {editId ? 'Update Rate' : 'Save Rate'}
            </button>
          </div>
          <div className="ch-card">
            <div className="ch-card-title">Active Rates — Today</div>
            {active.length===0?<div style={{color:'var(--muted)',fontSize:13}}>No active rates for today.</div>:
              active.map(r=>(
                <div key={r.id} style={{background:'rgba(61,107,61,.06)',border:'1px solid rgba(61,107,61,.15)',borderRadius:8,padding:'10px 13px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div><div style={{fontWeight:500,color:'var(--text)'}}>{r.agent}</div><div style={{fontSize:11.5,color:'var(--muted)'}}>{r.startDate} → {r.endDate||'ongoing'}</div></div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:17,fontWeight:500,color:'var(--success)'}}>₹{r.rate}/kg</div>
                </div>
              ))}
          </div>
        </div>
      )}
      <div className="ch-card" style={{padding:0}}>
        <div style={{padding:'14px 20px 0',fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,color:'var(--text)'}}>Rate History</div>
        <table className="ch-table">
          <thead><tr><th>Agent</th><th>Rate (₹/kg)</th><th>From</th><th>To</th><th>Notes</th>{isAdmin&&<th></th>}</tr></thead>
          <tbody>
            {rates.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>No rates saved yet.</td></tr>}
            {rates.map(r=>(
              <tr key={r.id} style={{background:editId===r.id?'rgba(201,168,76,0.06)':''}}>
                <td>{r.agent}</td>
                <td style={{fontFamily:'var(--font-mono)',fontWeight:600}}>₹{r.rate}/kg</td>
                <td>{r.startDate}</td><td>{r.endDate||'ongoing'}</td>
                <td style={{color:'var(--muted)',fontSize:12}}>{r.notes||'—'}</td>
                {isAdmin&&<td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="ch-btn ch-btn-edit ch-btn-sm" onClick={()=>startEdit(r)}>Edit</button>
                    <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>onDelete(r.id)}>✕</button>
                  </div>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
