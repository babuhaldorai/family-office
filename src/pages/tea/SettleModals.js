import React,{useState,useEffect} from 'react';
import {inr,todayStr,workerUnpaidWages,agentPendingBreakdown} from '../../utils/chaayaService';
import {C} from './chaayaStyles';
import ChModal from './ChModal';

export function WorkerSettleModal({open,worker,defaultAmount,isFloat,harvest,settlements,advances,onClose,onSave}){
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(todayStr());
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(open){setAmount(defaultAmount?defaultAmount.toFixed(2):'');setDate(todayStr());setNotes(isFloat?'Paid before agent collection':'');}
  },[open,defaultAmount,isFloat]);
  if(!open||!worker)return null;
  const eligible=workerUnpaidWages(worker,harvest,advances,settlements);
  const amt=parseFloat(amount)||0;
  const min=eligible*0.9,max=eligible*1.1;
  const outOfRange=amt>0&&(amt<min||amt>max);
  const wH=harvest.filter(e=>e.worker===worker);
  const totalKg=wH.reduce((s,e)=>s+(e.tNet||0),0);
  const save=async()=>{setSaving(true);try{await onSave(worker,amt,notes,isFloat);}finally{setSaving(false);}};
  return(
    <ChModal open={open} onClose={onClose}
      title={isFloat?`Pay ${worker} (Float)`:`Settle Payment — ${worker}`}
      footer={<><button className="ch-btn ch-btn-secondary" onClick={onClose}>Cancel</button><button className="ch-btn ch-btn-primary" onClick={save} disabled={saving||outOfRange||!amt}>{saving?'Saving…':'Save Payment'}</button></>}>
      <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:12,marginBottom:12,fontSize:13}}>
        <strong>{worker} Harvest Summary</strong><br/>
        Total Net Kg: <strong>{totalKg.toFixed(1)} kg</strong> from {wH.length} sessions<br/>
        Total wages earned: <strong>{inr(wH.reduce((s,e)=>s+(e.workerPay||0),0))}</strong><br/>
        <span style={{color:'var(--success)'}}>Eligible for settlement: <strong>{inr(eligible)}</strong></span><br/>
        <span style={{color:'var(--muted)',fontSize:11}}>Allowed range (±10%): {inr(min)} – {inr(max)}</span>
      </div>
      <div className="ch-grid-2">
        <div className="ch-form-group"><label>Date</label><input className="ch-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="ch-form-group"><label>Amount (₹)</label><input className="ch-input" type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
      </div>
      {outOfRange&&<div style={{color:'var(--danger)',fontSize:12,marginBottom:12}}>⚠ Amount outside ±10% range. Eligible: {inr(eligible)} · Allowed: {inr(min)} – {inr(max)}</div>}
      <div className="ch-form-group"><label>Notes</label><input className="ch-input" value={notes} onChange={e=>setNotes(e.target.value)}/></div>
    </ChModal>
  );
}

export function AgentPayModal({open,agentList,harvest,agentPayments,onClose,onSave}){
  const agents=agentList;
  const [agent,setAgent]=useState(agents[0]||'');
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(todayStr());
  const [method,setMethod]=useState('Cash');
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(open){setAgent(agents[0]||'');setAmount('');setDate(todayStr());setNotes('');}
  },[open]); // eslint-disable-line
  const breakdown=agentPendingBreakdown(harvest,agentPayments);
  const bd=breakdown.find(x=>x.agent===agent);
  const save=async()=>{setSaving(true);try{await onSave(agent,parseFloat(amount)||0,date,method,notes);}finally{setSaving(false);}};
  return(
    <ChModal open={open} onClose={onClose} title="Record Agent Payment Received"
      footer={<><button className="ch-btn ch-btn-secondary" onClick={onClose}>Cancel</button><button className="ch-btn ch-btn-primary" onClick={save} disabled={saving||!amount}>{saving?'Saving…':'Save Payment'}</button></>}>
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
