import React from 'react';
import {calcBagNet,calcBagWaterPct,getRateForAgentDate,inr} from '../../utils/chaayaService'; // eslint-disable-line
import {C} from './chaayaStyles';

const WORKER_RATE=6;

export default function BagBuilder({bags,onChange,deductMode,onDeductModeChange,agentName,dateStr,rates}){
  const addBag=()=>onChange([...bags,{gross:0,bagWt:0,waterKg:0}]);
  const removeBag=i=>onChange(bags.filter((_,idx)=>idx!==i));
  const updateBag=(i,field,val)=>onChange(bags.map((b,idx)=>idx===i?{...b,[field]:parseFloat(val)||0}:b));

  const totals=bags.reduce((acc,b)=>({
    gross:acc.gross+(b.gross||0),bag:acc.bag+(b.bagWt||0),
    water:acc.water+(b.waterKg||0),net:acc.net+calcBagNet(b),
  }),{gross:0,bag:0,water:0,net:0});

  const rateRec=getRateForAgentDate(rates,agentName,dateStr);
  const rate=rateRec?rateRec.rate:0;

  return(
    <div>
      {/* Rate banner */}
      <div className={`ch-rate-banner${!rateRec?' no-rate':''}`}>
        <span style={{color:'var(--muted)'}}>Active rate — {agentName||'select agent'}</span>
        <span style={{fontFamily:'var(--font-mono)',fontWeight:500,fontSize:15,color:rateRec?C.leaf:C.rust}}>
          {rateRec?`₹${rate}/kg${rateRec.isPlaceholder?' ⏳ est.':''}`:'No rate found — set one in Market Rates'}
        </span>
      </div>

      {/* Deduct mode toggle */}
      <div style={{display:'flex',gap:0,background:'var(--surface2)',borderRadius:8,padding:3,width:'fit-content',marginBottom:12}}>
        {[['perbag','Per Bag'],['total','Total Session']].map(([m,l])=>(
          <div key={m} onClick={()=>onDeductModeChange(m)}
            style={{padding:'5px 13px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500,
              color:deductMode===m?C.forest:C.muted,background:deductMode===m?'#fff':'transparent',
              boxShadow:deductMode===m?'0 2px 6px rgba(0,0,0,.1)':'none',transition:'all .15s'}}>
            {l}
          </div>
        ))}
      </div>

      {/* Bag list */}
      <div className="ch-bag-builder">
        <div className="ch-bag-header">
          <span style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>
            {bags.length===0?'No bags':`${bags.length} bag${bags.length!==1?'s':''}`}
          </span>
          <button className="ch-btn ch-btn-primary ch-btn-sm" onClick={addBag}>+ Add Bag</button>
        </div>
        <div className="ch-bag-col-labels">
          <div>#</div><div>Gross kg</div><div>Bag wt</div><div>Water kg</div><div>Water%</div><div>Net kg</div><div></div>
        </div>
        <div className="ch-bag-list">
          {bags.length===0&&<div style={{textAlign:'center',padding:18,color:'var(--muted)',fontSize:12.5}}>Click "+ Add Bag" to start.</div>}
          {bags.map((b,i)=>{
            const net=calcBagNet(b),pct=calcBagWaterPct(b),perbag=deductMode==='perbag';
            return(
              <div className="ch-bag-row" key={i}>
                <div className="ch-bag-num">B{i+1}</div>
                <input className="ch-input" type="number" placeholder="0.0" value={b.gross||''} min="0" step="0.1"
                  onChange={e=>updateBag(i,'gross',e.target.value)}
                  style={{padding:'6px 8px',fontFamily:'var(--font-mono)',fontSize:12.5}}/>
                <input className="ch-input" type="number" placeholder="0.0" value={b.bagWt||''} min="0" step="0.01"
                  onChange={e=>updateBag(i,'bagWt',e.target.value)} disabled={!perbag}
                  style={{padding:'6px 8px',fontFamily:'var(--font-mono)',fontSize:12.5,opacity:perbag?1:.35}}/>
                <input className="ch-input" type="number" placeholder="kg" value={b.waterKg||''} min="0" step="0.01"
                  onChange={e=>updateBag(i,'waterKg',e.target.value)} disabled={!perbag}
                  style={{padding:'6px 8px',fontFamily:'var(--font-mono)',fontSize:12.5,opacity:perbag?1:.35}}/>
                <div style={{fontSize:11,color:'var(--danger)',textAlign:'center',padding:'7px 2px'}}>{pct.toFixed(1)}%</div>
                <div className="ch-bag-net">{net>0?net.toFixed(2):'-'}</div>
                <button onClick={()=>removeBag(i)}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:18,lineHeight:1}}>×</button>
              </div>
            );
          })}
        </div>
        {bags.length>0&&(
          <div className="ch-bag-footer">
            <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)'}}>
              {bags.length} bags · Gross: <strong style={{color:'var(--text)'}}>{totals.gross.toFixed(1)}kg</strong>
              {' '}· Bag: <strong style={{color:'var(--text)'}}>-{totals.bag.toFixed(2)}kg</strong>
              {' '}· Water: <strong style={{color:'var(--text)'}}>-{totals.water.toFixed(2)}kg</strong>
              {' '}· <strong>Net: {totals.net.toFixed(2)}kg</strong>
            </span>
          </div>
        )}
      </div>

      {deductMode==='total'&&(
        <div className="ch-grid-2" style={{marginBottom:12}}>
          <div className="ch-form-group"><label>Total Bag Ded. (kg)</label><input className="ch-input" type="number" step="0.01" placeholder="0.0" id="total-bag-ded"/></div>
          <div className="ch-form-group"><label>Total Water Ded. (kg)</label><input className="ch-input" type="number" step="0.01" placeholder="0.0" id="total-water-ded"/></div>
        </div>
      )}

      {/* Calc preview */}
      {bags.length>0&&(
        <div className="ch-calc-box">
          <div>Total gross = <strong style={{color:'var(--text)'}}>{totals.gross.toFixed(2)} kg</strong> ({bags.length} bags)</div>
          <div>Bag deductions = <span style={{color:'var(--danger)'}}>−{totals.bag.toFixed(2)} kg</span></div>
          <div>Water deductions = <span style={{color:'var(--danger)'}}>−{totals.water.toFixed(2)} kg (avg {totals.gross>0?(totals.water/totals.gross*100).toFixed(1):0}%)</span></div>
          <div>Net payable = <strong style={{color:'var(--text)'}}>{totals.net.toFixed(2)} kg</strong></div>
          <div>Worker pay = <strong style={{color:'var(--text)'}}>{inr(totals.net*WORKER_RATE)}</strong> (@ ₹{WORKER_RATE}/kg)</div>
          <div style={{borderTop:`1px solid ${C.line}`,marginTop:5,paddingTop:5}}>
            {rate>0
              ?<span style={{color:'var(--success)',fontSize:13,fontWeight:500}}>
                  Agent revenue = {inr(totals.net*rate)} @ ₹{rate}/kg{rateRec?.isPlaceholder?' (estimated)':''}
                </span>
              :<span style={{color:'var(--danger)'}}>⚠ No rate found — agent revenue will be ₹0</span>}
          </div>
        </div>
      )}
    </div>
  );
}
