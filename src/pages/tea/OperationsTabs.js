import React,{useState} from 'react';
import {inr,todayStr,agentRateLog,costPerKgBreakdown,periodBounds,periodLabel,getFilteredHarvest,inventoryWithRemaining} from '../../utils/chaayaService';
import PeriodBar from './PeriodBar';


const MAINT_TASKS=['Pruning','Cleaning','Weeding','Fertilizing','Pest Control','Irrigation','Harvesting Equipment','Other'];
const FERT_TYPES=['Urea','Ammonia','Mix (Urea+Ammonia)','Magnesium','Potassium','DAP','Other'];
let itemSeq=0;
const newItem=()=>({id:`it${Date.now()}_${itemSeq++}`,source:'direct',purchaseId:'',type:FERT_TYPES[0],customType:'',bags:'',rate:''});

// Shared editor for both Fertilizer bags and Equipment units. Each row can
// either be a direct one-off entry (type/name + bags + rate typed in), or
// drawn from an existing bulk Inventory purchase — in which case the rate is
// locked to that purchase's unit cost and "bags" becomes "units used from
// this purchase", so the same bulk buy can be split across many fields over
// time without re-entering its cost each time.
function ItemsEditor({items,onChange,category,presetTypes,inventoryOptions}){
  const update=(id,key,val)=>onChange(items.map(it=>it.id===id?{...it,[key]:val}:it));
  const add=()=>onChange([...items,newItem()]);
  const remove=(id)=>onChange(items.length>1?items.filter(it=>it.id!==id):items);
  const pickPurchase=(id,purchaseId)=>{
    const p=inventoryOptions.find(x=>x.id===purchaseId);
    onChange(items.map(it=>it.id===id?{...it,source:'inventory',purchaseId,type:p?p.itemName:'',customType:'',rate:p?String(p.unitCost):it.rate}:it));
  };
  const setDirect=(id)=>onChange(items.map(it=>it.id===id?{...it,source:'direct',purchaseId:''}:it));

  return(
    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:10}}>
      {items.map(it=>{
        const rowCost=(parseInt(it.bags)||0)*(parseFloat(it.rate)||0);
        const chosenPurchase = it.source==='inventory' ? inventoryOptions.find(p=>p.id===it.purchaseId) : null;
        const overStock = chosenPurchase && (parseInt(it.bags)||0) > chosenPurchase.remaining;
        return(
          <div key={it.id} style={{padding:'10px 12px',background:'var(--surface)',borderRadius:'var(--radius)',border:overStock?'1px solid var(--danger)':'1px solid var(--border)'}}>
            <div style={{display:'flex',gap:6,marginBottom:8}}>
              <button className={`ch-btn ch-btn-sm ${it.source==='direct'?'ch-btn-primary':'ch-btn-ghost'}`} onClick={()=>setDirect(it.id)}>New / Direct</button>
              <button className={`ch-btn ch-btn-sm ${it.source==='inventory'?'ch-btn-primary':'ch-btn-ghost'}`} onClick={()=>{if(inventoryOptions.length)pickPurchase(it.id,inventoryOptions[0].id);}} disabled={inventoryOptions.length===0} title={inventoryOptions.length===0?`No ${category} purchases with stock left`:''}>From Inventory</button>
            </div>

            {it.source==='inventory' ? (
              <div style={{display:'grid',gridTemplateColumns:'1.4fr 0.8fr auto',gap:10,alignItems:'end'}}>
                <div className="ch-form-group" style={{marginBottom:0}}><label>Purchase</label>
                  <select className="ch-input" value={it.purchaseId} onChange={e=>pickPurchase(it.id,e.target.value)}>
                    {inventoryOptions.map(p=><option key={p.id} value={p.id}>{p.itemName} — {p.remaining} left @ ₹{p.unitCost}/unit</option>)}
                  </select>
                </div>
                <div className="ch-form-group" style={{marginBottom:0}}><label>Units used</label>
                  <input className="ch-input" type="number" min="0" value={it.bags} onChange={e=>update(it.id,'bags',e.target.value)} placeholder="0" style={overStock?{borderColor:'var(--danger)'}:undefined}/>
                </div>
                <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>remove(it.id)} disabled={items.length===1}>✕</button>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:presetTypes?(it.type==='Other'?'1.2fr 1.2fr 0.8fr 1fr auto':'1.2fr 0.8fr 1fr auto'):'1.4fr 0.8fr 1fr auto',gap:10,alignItems:'end'}}>
                {presetTypes ? (
                  <div className="ch-form-group" style={{marginBottom:0}}><label>Type</label>
                    <select className="ch-input" value={it.type} onChange={e=>update(it.id,'type',e.target.value)}>
                      {presetTypes.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="ch-form-group" style={{marginBottom:0}}><label>Item Name</label>
                    <input className="ch-input" value={it.type} onChange={e=>update(it.id,'type',e.target.value)} placeholder="e.g. Pruning Shears"/>
                  </div>
                )}
                {presetTypes&&it.type==='Other'&&(
                  <div className="ch-form-group" style={{marginBottom:0}}><label>Custom Name</label>
                    <input className="ch-input" value={it.customType} onChange={e=>update(it.id,'customType',e.target.value)} placeholder="e.g. Zinc Sulphate"/>
                  </div>
                )}
                <div className="ch-form-group" style={{marginBottom:0}}><label>{category==='Fertilizer'?'Bags':'Units'}</label>
                  <input className="ch-input" type="number" min="0" value={it.bags} onChange={e=>update(it.id,'bags',e.target.value)} placeholder="0"/>
                </div>
                <div className="ch-form-group" style={{marginBottom:0}}><label>Rate per Unit (₹)</label>
                  <input className="ch-input" type="number" step="0.01" value={it.rate} onChange={e=>update(it.id,'rate',e.target.value)} placeholder="0"/>
                </div>
                <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>remove(it.id)} disabled={items.length===1}>✕</button>
              </div>
            )}
            {rowCost>0&&<div style={{marginTop:6,fontSize:'0.78rem',color:'var(--accent)',fontWeight:600}}>{inr(rowCost)}</div>}
            {overStock&&<div style={{marginTop:4,fontSize:'0.74rem',color:'var(--danger)'}}>⚠ Only {chosenPurchase.remaining} left in this purchase — you're allocating more than what's in stock.</div>}
          </div>
        );
      })}
      <button className="ch-btn ch-btn-secondary ch-btn-sm" onClick={add} style={{alignSelf:'flex-start'}}>+ Add {category==='Fertilizer'?'Fertilizer Type':'Equipment Item'}</button>
    </div>
  );
}

const itemsTotals=(items)=>{
  const clean=items.map(it=>({
    type: (it.type==='Other'?(it.customType||'Other').trim():it.type)||'Item',
    bags: parseInt(it.bags)||0,
    rate: parseFloat(it.rate)||0,
    purchaseId: it.purchaseId||null,
  })).filter(it=>it.bags>0||it.rate>0);
  const totalBags=clean.reduce((s,it)=>s+it.bags,0);
  const bagCost=clean.reduce((s,it)=>s+it.bags*it.rate,0);
  // Items drawn from inventory were already paid for when the bulk purchase
  // was logged — counting their cost again here would double-count that
  // spend. Only "direct" (not from inventory) items count as new cost now.
  const directBagCost=clean.filter(it=>!it.purchaseId).reduce((s,it)=>s+it.bags*it.rate,0);
  const inventoryBagCost=bagCost-directBagCost;
  return {items:clean,totalBags,bagCost,directBagCost,inventoryBagCost};
};

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
export function MaintenanceTab({isAdmin,maintenance,workerList,fieldList,inventory=[],onSave,onDelete,onSavePurchase,onDeletePurchase}){
  const fields=fieldList;
  const workers=workerList;
  const [form,setForm]=useState({date:todayStr(),field:fields[0]||'',task:MAINT_TASKS[0],worker:workers[0]||'',days:'1',rate:'',notes:'',fertItems:[newItem()],equipItems:[newItem()]});
  const [showInventory,setShowInventory]=useState(false);
  const [pForm,setPForm]=useState({date:todayStr(),category:'Fertilizer',itemName:'',totalUnits:'',unitCost:'',notes:''});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const setP=(k,v)=>setPForm(f=>({...f,[k]:v}));

  const inventoryWithStock = inventoryWithRemaining(inventory, maintenance);
  const fertPurchases = inventoryWithStock.filter(p=>p.category==='Fertilizer'&&p.remaining>0);
  const equipPurchases = inventoryWithStock.filter(p=>p.category==='Equipment'&&p.remaining>0);

  const savePurchase=async()=>{
    if(!pForm.itemName)return alert('Enter an item name');
    const totalUnits=parseFloat(pForm.totalUnits)||0, unitCost=parseFloat(pForm.unitCost)||0;
    if(totalUnits<=0)return alert('Enter total units purchased');
    try{
      await onSavePurchase({...pForm,totalUnits,unitCost,totalCost:totalUnits*unitCost});
      setPForm(f=>({...f,itemName:'',totalUnits:'',unitCost:'',notes:''}));
    }catch(e){
      alert('❌ Failed to save purchase: '+e.message);
    }
  };

  const save=async()=>{
    const rate=parseFloat(form.rate)||0,days=parseFloat(form.days)||1;
    let cost=rate*days;
    let itemData={};
    if(form.task==='Fertilizing'){
      const {items,totalBags,bagCost,directBagCost}=itemsTotals(form.fertItems);
      const labourCost=rate*days;
      cost=directBagCost+labourCost; // inventory-sourced bag cost already counted at purchase time
      itemData={fertItems:items,totalBags,bagCost,directBagCost,labourCost,fertCost:cost};
    } else if(form.task==='Harvesting Equipment'){
      const {items,totalBags,bagCost,directBagCost}=itemsTotals(form.equipItems);
      const labourCost=rate*days;
      cost=directBagCost+labourCost;
      itemData={equipItems:items,totalBags,bagCost,directBagCost,labourCost};
    }
    const d2=form.date?new Date(form.date):new Date();
    await onSave({
      ...form,...itemData,days,rate,cost,
      year:d2.getFullYear(),
      month:d2.getMonth()+1,
    });
    setForm(f=>({...f,rate:'',notes:'',fertItems:[newItem()],equipItems:[newItem()]}));
  };
  const total=maintenance.reduce((s,e)=>s+(e.cost||0),0);
  const inventoryTotal=inventory.reduce((s,p)=>s+(p.totalCost||0),0);
  const grandTotal=total+inventoryTotal;
  return(
    <div>
      {isAdmin&&(
        <div className="ch-card" style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>setShowInventory(v=>!v)}>
            <div className="ch-card-title" style={{margin:0}}>📦 Inventory / Bulk Purchases</div>
            <span style={{fontSize:12,color:'var(--muted)'}}>{showInventory?'▲ Hide':'▼ Show'}</span>
          </div>
          <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:4}}>
            Log a fertilizer or equipment purchase once, then draw from it across different fields over time below.
          </div>
          {inventory.length>0&&(
            <div style={{marginTop:8,fontSize:13}}>
              Total spent on purchases so far: <strong style={{color:'var(--accent)'}}>{inr(inventoryTotal)}</strong>
              <span style={{color:'var(--muted)'}}> — counted immediately below (and in Market Rates cost-per-kg), even before it's used on a field.</span>
            </div>
          )}
          {showInventory&&(
            <div style={{marginTop:12}}>
              <div className="ch-grid-4" style={{marginBottom:10}}>
                <div className="ch-form-group"><label>Date</label><input className="ch-input" type="date" value={pForm.date} onChange={e=>setP('date',e.target.value)}/></div>
                <div className="ch-form-group"><label>Category</label>
                  <select className="ch-input" value={pForm.category} onChange={e=>setP('category',e.target.value)}>
                    <option>Fertilizer</option><option>Equipment</option>
                  </select></div>
                <div className="ch-form-group"><label>Item Name</label><input className="ch-input" value={pForm.itemName} onChange={e=>setP('itemName',e.target.value)} placeholder="e.g. DAP or Sprayer"/></div>
                <div className="ch-form-group"><label>Notes</label><input className="ch-input" value={pForm.notes} onChange={e=>setP('notes',e.target.value)}/></div>
              </div>
              <div className="ch-grid-3" style={{marginBottom:10}}>
                <div className="ch-form-group"><label>Total Units Bought</label><input className="ch-input" type="number" min="0" value={pForm.totalUnits} onChange={e=>setP('totalUnits',e.target.value)} placeholder="0"/></div>
                <div className="ch-form-group"><label>Cost per Unit (₹)</label><input className="ch-input" type="number" step="0.01" value={pForm.unitCost} onChange={e=>setP('unitCost',e.target.value)} placeholder="0"/></div>
                <div className="ch-form-group"><label>Total Cost</label><div style={{padding:'8px 0',fontWeight:600,color:'var(--accent)'}}>{inr((parseFloat(pForm.totalUnits)||0)*(parseFloat(pForm.unitCost)||0))}</div></div>
              </div>
              <button className="ch-btn ch-btn-primary ch-btn-sm" onClick={savePurchase}>+ Log Purchase</button>

              {inventoryWithStock.length>0&&(
                <table className="ch-table" style={{marginTop:14}}>
                  <thead><tr><th>Date</th><th>Category</th><th>Item</th><th>Total</th><th>Used</th><th>Remaining</th><th>Unit Cost</th>{isAdmin&&<th></th>}</tr></thead>
                  <tbody>
                    {inventoryWithStock.map(p=>(
                      <tr key={p.id}>
                        <td>{p.date}</td>
                        <td><span className="ch-badge ch-badge-earth">{p.category}</span></td>
                        <td>{p.itemName}</td>
                        <td>{p.totalUnits}</td>
                        <td>{p.allocated}</td>
                        <td style={{color:p.remaining>0?'var(--success)':'var(--muted)',fontWeight:600}}>{p.remaining}</td>
                        <td style={{fontFamily:'var(--font-mono)'}}>₹{p.unitCost}</td>
                        {isAdmin&&<td><button className="ch-btn ch-btn-danger ch-btn-xs" onClick={()=>onDeletePurchase(p.id)} disabled={p.allocated>0} title={p.allocated>0?'Already partially used — cannot delete':'Delete purchase'}>✕</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
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
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:10}}>Labour is logged separately as worker days above. Pick "From Inventory" to draw from a bulk purchase already logged above.</div>
              <ItemsEditor items={form.fertItems} onChange={items=>set('fertItems',items)} category="Fertilizer" presetTypes={FERT_TYPES} inventoryOptions={fertPurchases}/>
            {(()=>{const {totalBags,directBagCost,inventoryBagCost}=itemsTotals(form.fertItems);return(
              <div style={{marginTop:2,padding:'10px 12px',background:'var(--surface)',borderRadius:'var(--radius)',fontSize:13,display:'flex',gap:20,flexWrap:'wrap'}}>
                <span>Total bags: <strong>{totalBags}</strong></span>
                <span>New bag cost: <strong style={{color:'var(--warn)'}}>{inr(directBagCost)}</strong></span>
                {inventoryBagCost>0&&<span>From stock (already paid): <strong style={{color:'var(--muted)'}}>{inr(inventoryBagCost)}</strong></span>}
                {(form.days&&form.rate)&&<span>Labour: <strong style={{color:'var(--warn)'}}>{inr((parseFloat(form.days)||0)*(parseFloat(form.rate)||0))}</strong></span>}
                {(form.days&&form.rate)&&<span>Session total (new cost): <strong style={{color:'var(--accent)'}}>{inr(directBagCost+(parseFloat(form.days)||0)*(parseFloat(form.rate)||0))}</strong></span>}
              </div>
            );})()}
            </div>
          )}
          {/* Equipment details — shown only for Harvesting Equipment task */}
          {form.task==='Harvesting Equipment'&&(
            <div style={{marginTop:12,padding:'12px 14px',background:'var(--surface2)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
              <div style={{fontWeight:600,fontSize:'0.85rem',marginBottom:4,color:'var(--text)'}}>🔧 Equipment</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:10}}>Labour is logged separately as worker days above. Pick "From Inventory" to draw from equipment already purchased in bulk.</div>
              <ItemsEditor items={form.equipItems} onChange={items=>set('equipItems',items)} category="Equipment" presetTypes={null} inventoryOptions={equipPurchases}/>
            {(()=>{const {totalBags,directBagCost,inventoryBagCost}=itemsTotals(form.equipItems);return(
              <div style={{marginTop:2,padding:'10px 12px',background:'var(--surface)',borderRadius:'var(--radius)',fontSize:13,display:'flex',gap:20,flexWrap:'wrap'}}>
                <span>Total units: <strong>{totalBags}</strong></span>
                <span>New item cost: <strong style={{color:'var(--warn)'}}>{inr(directBagCost)}</strong></span>
                {inventoryBagCost>0&&<span>From stock (already paid): <strong style={{color:'var(--muted)'}}>{inr(inventoryBagCost)}</strong></span>}
                {(form.days&&form.rate)&&<span>Labour: <strong style={{color:'var(--warn)'}}>{inr((parseFloat(form.days)||0)*(parseFloat(form.rate)||0))}</strong></span>}
                {(form.days&&form.rate)&&<span>Session total (new cost): <strong style={{color:'var(--accent)'}}>{inr(directBagCost+(parseFloat(form.days)||0)*(parseFloat(form.rate)||0))}</strong></span>}
              </div>
            );})()}
            </div>
          )}
          {(form.task==='Fertilizing'||form.task==='Harvesting Equipment')&&form.rate&&form.days&&(()=>{const {directBagCost}=itemsTotals(form.task==='Fertilizing'?form.fertItems:form.equipItems);return(
            <div style={{fontSize:13,color:'var(--text)',marginBottom:10,padding:'6px 10px',background:'var(--surface2)',borderRadius:'var(--radius)'}}>
              Labour: <strong>{inr((parseFloat(form.rate)||0)*(parseFloat(form.days)||1))}</strong>
              {' · '}Total (new cost, items+labour): <strong style={{color:'var(--accent)'}}>{inr(directBagCost+(parseFloat(form.rate)||0)*(parseFloat(form.days)||1))}</strong>
            </div>
          );})()}
          {form.task!=='Fertilizing'&&form.task!=='Harvesting Equipment'&&form.rate&&form.days&&<div style={{fontSize:13,color:'var(--text)',marginBottom:10}}>Cost: <strong>{inr((parseFloat(form.rate)||0)*(parseFloat(form.days)||1))}</strong></div>}
          <button className="ch-btn ch-btn-primary" onClick={save}>Save</button>
        </div>
      )}
      <div className="ch-card" style={{padding:0}}>
        <table className="ch-table">
          <thead><tr><th>Date</th><th>Field</th><th>Task</th><th>Worker</th><th>Days / Units</th><th>Details</th><th>Cost</th>{isAdmin&&<th></th>}</tr></thead>
          <tbody>
            {maintenance.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>No maintenance logs yet.</td></tr>}
            {[...maintenance].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>{
              const items = e.task==='Fertilizing' ? e.fertItems : e.task==='Harvesting Equipment' ? e.equipItems : null;
              return(
              <tr key={e.id}>
                <td>{e.date}</td><td>{e.field}</td>
                <td><span className="ch-badge ch-badge-earth">{e.task}</span></td>
                <td style={{fontSize:'0.8rem'}}>{e.worker}</td>
                <td style={{fontSize:'0.82rem'}}>
                  {items
                    ? <span>{e.totalBags||0}{e.task==='Fertilizing'?' bags':' units'}</span>
                    : <span>{e.days}d</span>}
                </td>
                <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>
                  {items&&items.length>0
                    ? <span style={{display:'flex',flexDirection:'column',gap:2}}>
                        <span>{items.map(it=>`${it.type}:${it.bags}×${inr(it.rate||0)}${it.purchaseId?' (stock)':''}`).join(' ')}</span>
                        {e.labourCost>0&&<span style={{color:'var(--muted)'}}>Labour: {inr(e.labourCost)} ({e.days}d @ {inr(e.rate)}/d)</span>}
                      </span>
                    : e.task==='Fertilizing'&&e.totalBags>0
                    ? <span style={{display:'flex',flexDirection:'column',gap:2}}>
                        <span>{e.urea>0?`U:${e.urea}×${inr(e.ureaRate||0)} `:''}{e.ammonia>0?`A:${e.ammonia}×${inr(e.ammoniaRate||0)} `:''}{e.mixed>0?`Mix:${e.mixed}×${inr(e.mixedRate||0)}`:''}</span>
                        {e.labourCost>0&&<span style={{color:'var(--muted)'}}>Labour: {inr(e.labourCost)} ({e.days}d @ {inr(e.rate)}/d)</span>}
                      </span>
                    : <span>{e.notes||'—'}</span>}
                </td>
                <td style={{fontFamily:'var(--font-mono)'}}>{inr(e.cost)}</td>
                {isAdmin&&<td><button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>onDelete(e.id)}>✕</button></td>}
              </tr>
            );})}
            {maintenance.length>0&&<tr style={{background:'var(--surface2)',fontWeight:600}}><td colSpan={6} style={{textAlign:'right',color:'var(--muted)'}}>Maintenance Log Total (labour + direct materials)</td><td style={{fontFamily:'var(--font-mono)'}}>{inr(total)}</td>{isAdmin&&<td/>}</tr>}
            {inventoryTotal>0&&<tr style={{background:'var(--surface2)'}}><td colSpan={6} style={{textAlign:'right',color:'var(--muted)'}}>+ Inventory Purchases (not yet in a field entry)</td><td style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{inr(inventoryTotal)}</td>{isAdmin&&<td/>}</tr>}
            {(maintenance.length>0||inventoryTotal>0)&&<tr style={{background:'var(--surface2)',fontWeight:700,borderTop:'2px solid var(--border)'}}><td colSpan={6} style={{textAlign:'right',color:'var(--text)'}}>Grand Total</td><td style={{fontFamily:'var(--font-mono)',color:'var(--accent)'}}>{inr(grandTotal)}</td>{isAdmin&&<td/>}</tr>}
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
export function RatesTab({harvest,maintenance=[],inventory=[]}){
  const [period, setPeriod] = useState({ preset: 'all', ...periodBounds('all') });
  const filteredHarvest = getFilteredHarvest(harvest, period);
  const filteredMaintenance = maintenance.filter(m => m.date && m.date >= (period.from||'2000-01-01') && m.date <= (period.to||'2099-12-31'));
  const filteredInventory = inventory.filter(p => p.date && p.date >= (period.from||'2000-01-01') && p.date <= (period.to||'2099-12-31'));

  const rows = agentRateLog(filteredHarvest);
  const cpk = costPerKgBreakdown(filteredHarvest, filteredMaintenance, filteredInventory);
  const waterfall = [
    ['Avg Rate (revenue)', cpk.avgRate, 'var(--success)', false],
    ['− Bag/Water Deduction Loss', cpk.deductionLossPerKg, 'var(--danger)', true],
    ['− Worker Payment', cpk.workerPerKg, 'var(--danger)', true],
    ['− Field Maintenance', cpk.maintenancePerKg, 'var(--danger)', true],
  ];
  return(
    <div>
      <div style={{marginBottom:16}}>
        <PeriodBar period={period} onChange={setPeriod}/>
      </div>

      <div className="ch-alert-info" style={{marginBottom:16}}>
        ℹ️ This is a read-only log. Rates are entered directly on each harvest row — open a session in{' '}
        <strong>Log Harvest</strong> and edit its <strong>Rate</strong> field. This log updates automatically.
      </div>

      {cpk.totalNetKg>0 && (
        <div className="ch-card" style={{marginBottom:16}}>
          <div className="ch-card-title">Per-Kg Cost Breakdown</div>
          <div style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>
            Based on {cpk.totalNetKg.toFixed(0)} kg net harvested ({periodLabel(period)}, all agents) at an average rate of ₹{cpk.avgRate.toFixed(2)}/kg.
          </div>
          {waterfall.map(([label,val,color,isDeduction])=>(
            <div key={label} className="ch-settle-row">
              <span style={{color:'var(--muted)'}}>{label}</span>
              <span style={{fontFamily:'var(--font-mono)',fontWeight:600,color}}>{isDeduction?'−':''}₹{val.toFixed(2)}/kg</span>
            </div>
          ))}
          <div className="ch-total-row">
            <span style={{fontSize:13,fontWeight:600,color:'var(--muted)'}}>Net Margin per kg</span>
            <span style={{fontSize:17,fontWeight:700,color:cpk.netMarginPerKg>=0?'var(--success)':'var(--danger)'}}>₹{cpk.netMarginPerKg.toFixed(2)}/kg</span>
          </div>
        </div>
      )}

      {cpk.taskBreakdown.length>0 && (
        <div className="ch-card" style={{padding:0,marginBottom:16}}>
          <div style={{padding:'14px 20px 0',fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,color:'var(--text)'}}>Maintenance Cost by Task</div>
          <div style={{padding:'4px 20px 0',fontSize:12,color:'var(--muted)'}}>Total maintenance: ₹{cpk.totalMaintenance.toFixed(0)} → ₹{cpk.maintenancePerKg.toFixed(2)}/kg overall</div>
          <table className="ch-table">
            <thead><tr><th>Task</th><th>Total Cost</th><th>₹/kg</th></tr></thead>
            <tbody>
              {cpk.taskBreakdown.map(t=>(
                <tr key={t.task}>
                  <td>{t.task}</td>
                  <td style={{fontFamily:'var(--font-mono)'}}>₹{t.cost.toFixed(0)}</td>
                  <td style={{fontFamily:'var(--font-mono)',fontWeight:600,color:'var(--danger)'}}>₹{t.perKg.toFixed(2)}/kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ch-card" style={{padding:0}}>
        <div style={{padding:'14px 20px 0',fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,color:'var(--text)'}}>Rate History (from Harvest Log)</div>
        <table className="ch-table">
          <thead><tr><th>Agent</th><th>Rate (₹/kg)</th><th>From</th><th>To</th><th>Sessions</th><th>Net kg</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>No rates recorded on any harvest session yet.</td></tr>}
            {rows.map(r=>(
              <tr key={r.agent+'|'+r.rate+'|'+r.from}>
                <td>{r.agent}</td>
                <td style={{fontFamily:'var(--font-mono)',fontWeight:600}}>₹{r.rate}/kg</td>
                <td>{r.from}</td><td>{r.to}</td>
                <td>{r.sessions}</td>
                <td>{r.netKg.toFixed(1)}</td>
                <td>{r.confirmed
                  ? <span className="ch-badge ch-badge-green">Confirmed</span>
                  : <span className="ch-badge ch-badge-gold" style={{opacity:.7}}>Estimated</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
