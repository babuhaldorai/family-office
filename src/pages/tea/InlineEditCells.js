import React, { useState, useEffect } from 'react';
import { todayStr } from '../../utils/chaayaService';

// Rate is edited directly here — no need to open the harvest entry form.
// Saves on blur or Enter; agent revenue recalculates automatically server-side.
export function EditableRateCell({id,rate,rateStatus,onUpdateRate}){
  const [val,setVal]=useState(rate||'');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{ setVal(rate||''); },[rate,id]);
  const commit=async()=>{
    const num=parseFloat(val)||0;
    if(num===(rate||0))return;
    setSaving(true);
    try{ await onUpdateRate(id,num); } finally { setSaving(false); }
  };
  return(
    <div className="ch-inline-pay-cell">
      <span style={{color:'var(--muted)'}}>₹</span>
      <input
        type="number" step="0.1" min="0"
        value={val}
        disabled={!onUpdateRate||saving}
        onChange={ev=>setVal(ev.target.value)}
        onBlur={commit}
        onKeyDown={ev=>{ if(ev.key==='Enter') ev.target.blur(); }}
        className="ch-inline-input ch-inline-input-amt"
      />
      <span style={{color:'var(--muted)'}}>/kg</span>
      {rateStatus==='placeholder'&&<span className="ch-badge ch-badge-gold">⏳ est.</span>}
      {rateStatus==='no-rate'&&<span className="ch-badge ch-badge-gold" style={{opacity:.7}}>no rate</span>}
    </div>
  );
}

// Worker/Agent payment — edited directly here, same pattern as Rate. Typing
// an amount and/or date saves immediately onto this harvest row. The ✓ button
// is a one-click shortcut for the common case of paying the whole session
// amount today; once paid, it becomes an ↺ undo button.
export function EditablePayCell({id,paidAmount,paidDate,total,onUpdate,advance,onMarkPaidWithAdvance,onMarkPaidFull}){
  const [amt,setAmt]=useState(paidAmount||'');
  const [date,setDate]=useState(paidDate||'');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{ setAmt(paidAmount||''); setDate(paidDate||''); },[paidAmount,paidDate,id]);

  const safeTotal = total||0;
  const safeAdvance = advance||0;
  const status = !amt||parseFloat(amt)<=0 ? 'pending' : parseFloat(amt)>=safeTotal-0.5 ? 'paid' : 'partial';

  const commitAmt=async()=>{
    const num=parseFloat(amt)||0;
    if(num===(paidAmount||0))return;
    setSaving(true);
    try{
      const useDate=date||todayStr();
      if(num>0&&!date)setDate(useDate);
      await onUpdate(id,num,num>0?useDate:date);
    } finally { setSaving(false); }
  };
  const commitDate=async(d)=>{
    setDate(d);
    await onUpdate(id,parseFloat(amt)||0,d);
  };
  const markPaid=async(netAdvance)=>{
    setSaving(true);
    try{
      if(netAdvance && safeAdvance>0 && onMarkPaidWithAdvance){
        await onMarkPaidWithAdvance();
      } else if(onMarkPaidFull){
        await onMarkPaidFull();
      } else {
        const d=todayStr();
        setAmt(safeTotal); setDate(d);
        await onUpdate(id,safeTotal,d);
      }
    } finally { setSaving(false); }
  };
  const undoPay=async()=>{
    if(!window.confirm('Undo this payment? It will be marked unpaid again.'))return;
    setAmt(''); setDate('');
    setSaving(true);
    try{ await onUpdate(id,0,null); } finally { setSaving(false); }
  };

  const cashIfNetted = Math.max(0, safeTotal-Math.min(safeAdvance,safeTotal));

  const statusColor = status==='paid' ? 'var(--success)' : status==='partial' ? 'var(--accent)' : 'var(--text)';

  return(
    <div className="ch-inline-pay-cell">
      <span style={{color:'var(--muted)'}}>₹</span>
      <input
        type="number" step="1" min="0"
        value={amt}
        disabled={!onUpdate||saving}
        onChange={ev=>setAmt(ev.target.value)}
        onBlur={commitAmt}
        onKeyDown={ev=>{ if(ev.key==='Enter') ev.target.blur(); }}
        placeholder="0"
        className="ch-inline-input ch-inline-input-amt"
        style={{color:statusColor,fontWeight:status!=='pending'?700:400,borderColor:status==='paid'?'var(--success)':status==='partial'?'var(--accent)':undefined}}
      />
      <input
        type="date" value={date} disabled={!onUpdate||saving}
        onChange={ev=>commitDate(ev.target.value)}
        className="ch-inline-input ch-inline-input-date"
        style={{color:statusColor,borderColor:status==='paid'?'var(--success)':status==='partial'?'var(--accent)':undefined}}
      />
      {onUpdate && status==='pending' && safeAdvance>0 && (
        <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:'flex-start'}}>
          <button onClick={()=>markPaid(true)} disabled={saving||safeTotal<=0} className="ch-inline-tick"
            title={`Pays ₹${cashIfNetted.toFixed(0)} cash and clears ₹${Math.min(safeAdvance,safeTotal).toFixed(0)} off the advance`}>
            Pay ₹{cashIfNetted.toFixed(0)} (after advance)
          </button>
          <button onClick={()=>markPaid(false)} disabled={saving||safeTotal<=0}
            style={{background:'none',border:'none',padding:0,fontSize:10,color:'var(--muted)',textDecoration:'underline',cursor:'pointer',whiteSpace:'nowrap'}}
            title="Pay the full session amount — advance stays pending, handle it separately">
            or pay full ₹{safeTotal.toFixed(0)} instead
          </button>
        </div>
      )}
      {onUpdate && status==='pending' && safeAdvance<=0 && (
        <button onClick={()=>markPaid(false)} disabled={saving||safeTotal<=0} className="ch-inline-tick" title="Mark full amount paid today">
          Paid
        </button>
      )}
      {onUpdate && status!=='pending' && (
        <button onClick={undoPay} disabled={saving} title="Undo this payment" className="ch-inline-tick ch-inline-undo">↺</button>
      )}
    </div>
  );
}
