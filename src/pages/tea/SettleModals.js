import React,{useState,useEffect} from 'react';
import {inr,todayStr,workerUnpaidWages,agentPendingBreakdown} from '../../utils/chaayaService';
import {C} from './chaayaStyles';
import ChModal from './ChModal';

export function WorkerSettleModal({open,worker,defaultAmount,isFloat,harvest,settlements,advances,onClose,onSave,editSettlement,onUpdate}){
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(todayStr());
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(open){
      if(editSettlement){
        setAmount(String(editSettlement.netPaid||''));
        setDate(editSettlement.date||todayStr());
        setNotes(editSettlement.notes||'');
      } else {
        setAmount(defaultAmount?defaultAmount.toFixed(2):'');
        setDate(todayStr());
        setNotes(isFloat?'Paid before agent collection':'');
      }
    }
  },[open,defaultAmount,isFloat,editSettlement]);
  if(!open||!worker)return null;
  const eligible = workerUnpaidWages(worker,harvest,advances,settlements);
  const totalPaid = settlements.filter(s=>s.worker===worker).reduce((s,e)=>s+(e.amount||0),0);
  const amt = parseFloat(amount)||0;
  const wH  = harvest.filter(e=>e.worker===worker);
  const totalEarned = wH.reduce((s,e)=>s+(e.workerPay||0),0);
  const totalKg     = wH.reduce((s,e)=>s+(e.tNet||0),0);
  const remaining   = Math.max(0, eligible);
  const isOverpay   = amt > remaining + 0.01;
  const save=async()=>{
    setSaving(true);
    try{
      if(editSettlement&&onUpdate){
        await onUpdate(editSettlement.id,{netPaid:amt,date,notes});
      } else {
        await onSave(worker,amt,notes,isFloat,date);
      }
    }finally{setSaving(false);}
  };
  return(
    <ChModal open={open} onClose={onClose}
      title={editSettlement?`Edit Payment — ${worker}`:isFloat?`Pay ${worker} (Float / Installment)`:`Pay ${worker}`}
      footer={<><button className="ch-btn ch-btn-secondary" onClick={onClose}>Cancel</button><button className="ch-btn ch-btn-primary" onClick={save} disabled={saving||!amt}>{saving?'Saving…':editSettlement?'Update Payment':'Save Payment'}</button></>}>
      {/* Summary */}
      <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:12,marginBottom:12,fontSize:13}}>
        <strong>{worker}</strong> — {wH.length} sessions · {totalKg.toFixed(1)} kg net<br/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:8}}>
          <div><div style={{color:'var(--muted)',fontSize:11,marginBottom:2}}>TOTAL EARNED</div><strong>{inr(totalEarned)}</strong></div>
          <div><div style={{color:'var(--muted)',fontSize:11,marginBottom:2}}>PAID SO FAR</div><strong style={{color:'var(--success)'}}>{inr(totalPaid)}</strong>
            {settlements.filter(s=>s.worker===worker).length>0&&(
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{settlements.filter(s=>s.worker===worker).length} payment(s)</div>
            )}
          </div>
          <div><div style={{color:'var(--muted)',fontSize:11,marginBottom:2}}>STILL OWED</div><strong style={{color:remaining>0?'var(--danger)':'var(--success)'}}>{inr(remaining)}</strong></div>
        </div>
      </div>
      {remaining === 0 && (
        <div style={{background:'rgba(76,175,128,0.1)',border:'1px solid var(--success)',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:12,color:'var(--success)'}}>
          ✓ {worker} is fully paid. You can still record an additional installment if needed.
        </div>
      )}
      {isOverpay && (
        <div style={{background:'rgba(224,92,92,0.1)',border:'1px solid var(--danger)',borderRadius:6,padding:'8px 12px',marginBottom:8,fontSize:12,color:'var(--danger)'}}>
          ⚠ This payment exceeds the unpaid balance of {inr(remaining)}.
        </div>
      )}
      <div className="ch-grid-2">
        <div className="ch-form-group"><label>Date</label><input className="ch-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="ch-form-group"><label>Amount (₹)</label><input className="ch-input" type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`Unpaid: ${inr(remaining)}`}/></div>
      </div>
      <div className="ch-form-group"><label>Notes (e.g. "Installment 1 of 3")</label><input className="ch-input" value={notes} onChange={e=>setNotes(e.target.value)}/></div>
    </ChModal>
  );
}

export function AgentPayModal({open,agentList,harvest,agentPayments,onClose,onSave,editPayment,onUpdate}){
  const agents=agentList;
  const [agent,setAgent]=useState(agents[0]||'');
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(todayStr());
  const [method,setMethod]=useState('Cash');
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(open){
      if(editPayment){
        setAgent(editPayment.agent||agents[0]||'');
        setAmount(String(editPayment.amount||''));
        setDate(editPayment.date||todayStr());
        setMethod(editPayment.method||'Cash');
        setNotes(editPayment.notes||'');
      } else {
        setAgent(agents[0]||'');setAmount('');setDate(todayStr());setMethod('Cash');setNotes('');
      }
    }
  },[open,editPayment]); // eslint-disable-line
  const breakdown=agentPendingBreakdown(harvest,agentPayments);
  const bd=breakdown.find(x=>x.agent===agent);
  const save=async()=>{
    setSaving(true);
    try{
      if(editPayment&&onUpdate){
        await onUpdate(editPayment.id,{agent,amount:parseFloat(amount)||0,date,method,notes});
      } else {
        await onSave(agent,parseFloat(amount)||0,date,method,notes);
      }
    }finally{setSaving(false);}
  };
  return(
    <ChModal open={open} onClose={onClose} title={editPayment?"Edit Agent Payment":"Record Agent Payment Received"}
      footer={<><button className="ch-btn ch-btn-secondary" onClick={onClose}>Cancel</button><button className="ch-btn ch-btn-primary" onClick={save} disabled={saving||!amount}>{saving?'Saving…':editPayment?'Update Payment':'Save Payment'}</button></>}>
      <div className="ch-alert-info">ℹ️ Record the amount the agent has paid you. This reduces the "Agent Revenue Pending" balance.</div>
      <div className="ch-grid-2">
        <div className="ch-form-group"><label>Agent</label>
          <select className="ch-input" value={agent} onChange={e=>setAgent(e.target.value)}>
            {agents.map(a=><option key={a}>{a}</option>)}
          </select></div>
        <div className="ch-form-group"><label>Date Received</label>
          <input className="ch-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="ch-form-group"><label>Amount Received (₹)</label>
          <input className="ch-input" type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div>
        <div className="ch-form-group"><label>Payment Method</label>
          <select className="ch-input" value={method} onChange={e=>setMethod(e.target.value)}>
            {['Cash','Bank Transfer','UPI','Cheque'].map(m=><option key={m}>{m}</option>)}
          </select></div>
      </div>
      {bd&&(
        <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:12,marginBottom:12,fontSize:13}}>
          <strong>{agent}</strong> — Earned: {inr(bd.earned)} · Received: {inr(bd.received)} · <span style={{color:bd.pending>0?C.rust:C.leaf}}>Pending: {inr(bd.pending)}</span>
        </div>
      )}
      <div className="ch-form-group"><label>Notes (optional)</label>
        <input className="ch-input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Reference number, week, etc."/></div>
    </ChModal>
  );
}
