import React,{useState,useEffect} from 'react';
import {inr} from '../../utils/chaayaService';
import {C} from './chaayaStyles';
import ChModal from './ChModal';

function EntityRow({label,value}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,borderBottom:'1px solid rgba(216,208,188,.4)',padding:'4px 0'}}>
      <span style={{color:'var(--muted)'}}>{label}</span>
      <span style={{fontWeight:500,color:'var(--text)'}}>{value||'—'}</span>
    </div>
  );
}

export default function PeopleTab({isAdmin,workers,agents,fields,harvest,onEdit,onAdd,onDelete}){
  const [ptab,setPtab]=useState('workers');
  return(
    <div>
      <div className="ch-tabs">
        {[['workers','Workers'],['agents','Agents'],['fields','Fields']].map(([k,l])=>(
          <button key={k} className={`ch-tab ${ptab===k?'active':''}`} onClick={()=>setPtab(k)}>{l}</button>
        ))}
      </div>

      {ptab==='workers'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:17,fontWeight:600,color:'var(--text)'}}>Workers</div>
            {isAdmin&&<button className="ch-btn ch-btn-primary ch-btn-sm" onClick={()=>onAdd('worker')}>+ Add Worker</button>}
          </div>
          {workers.length===0?<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>No workers yet.</div>:(
            <div className="ch-entity-grid">
              {workers.map(w=>(
                <div key={w.id} className="ch-entity-card">
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <div className="ch-entity-avatar">{w.name?.charAt(0)||'?'}</div>
                    <div>
                      <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{w.name}</div>
                      <div style={{fontSize:12,color:'var(--muted)'}}>
                        {w.empType==='permanent'?'Permanent':'Temporary'} · <span style={{color:w.status==='inactive'?C.faint:C.leaf}}>{w.status||'active'}</span>
                      </div>
                    </div>
                  </div>
                  <EntityRow label="Phone" value={w.phone}/>
                  <EntityRow label="Payment" value={w.payment}/>
                  <EntityRow label="Start Date" value={w.startDate}/>
                  <EntityRow label="End Date" value={w.endDate}/>
                  {isAdmin&&(
                    <div style={{display:'flex',gap:6,marginTop:12}}>
                      <button className="ch-btn ch-btn-edit ch-btn-sm" onClick={()=>onEdit('worker',w)}>Edit</button>
                      <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>onDelete('worker',w.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ptab==='agents'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:17,fontWeight:600,color:'var(--text)'}}>Agents</div>
            {isAdmin&&<button className="ch-btn ch-btn-primary ch-btn-sm" onClick={()=>onAdd('agent')}>+ Add Agent</button>}
          </div>
          {agents.length===0?<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>No agents yet.</div>:(
            <div className="ch-entity-grid">
              {agents.map(a=>(
                <div key={a.id} className="ch-entity-card">
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <div className="ch-entity-avatar" style={{background:C.earth}}>{a.name?.charAt(0)||'?'}</div>
                    <div>
                      <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{a.name}</div>
                      <div style={{fontSize:12,color:'var(--muted)'}}>
                        {a.empType==='permanent'?'Permanent':'Temporary'} · <span style={{color:a.status==='inactive'?C.faint:C.leaf}}>{a.status||'active'}</span>
                      </div>
                    </div>
                  </div>
                  <EntityRow label="Phone" value={a.phone}/>
                  <EntityRow label="Payment" value={a.payment}/>
                  <EntityRow label="Start Date" value={a.startDate}/>
                  <EntityRow label="End Date" value={a.endDate}/>
                  {isAdmin&&(
                    <div style={{display:'flex',gap:6,marginTop:12}}>
                      <button className="ch-btn ch-btn-edit ch-btn-sm" onClick={()=>onEdit('agent',a)}>Edit</button>
                      <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>onDelete('agent',a.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ptab==='fields'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:17,fontWeight:600,color:'var(--text)'}}>Fields</div>
            {isAdmin&&<button className="ch-btn ch-btn-primary ch-btn-sm" onClick={()=>onAdd('field')}>+ Add Field</button>}
          </div>
          {fields.length===0?<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>No fields yet.</div>:(
            <div className="ch-entity-grid">
              {fields.map(f=>{
                const fh=harvest.filter(e=>e.field===f.name);
                const fKg=fh.reduce((s,e)=>s+(e.tNet||0),0);
                const fRev=fh.reduce((s,e)=>s+(e.agentRev||0),0);
                const acres=parseFloat(f.area)||1;
                return(
                  <div key={f.id} className="ch-entity-card">
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                      <div className="ch-entity-avatar" style={{background:'var(--success)'}}>🌿</div>
                      <div>
                        <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{f.name}</div>
                        <div style={{fontSize:12,color:'var(--muted)'}}>{f.area} acres{f.notes?` · ${f.notes}`:''}</div>
                      </div>
                    </div>
                    <EntityRow label="Total Net Kg" value={`${fKg.toFixed(1)} kg`}/>
                    <EntityRow label="Yield / Acre" value={fKg>0?`${(fKg/acres).toFixed(1)} kg`:'—'}/>
                    <EntityRow label="Revenue / Acre" value={fKg>0?inr(fRev/acres):'—'}/>
                    {isAdmin&&(
                      <div style={{display:'flex',gap:6,marginTop:12}}>
                        <button className="ch-btn ch-btn-edit ch-btn-sm" onClick={()=>onEdit('field',f)}>Edit</button>
                        <button className="ch-btn ch-btn-danger ch-btn-sm" onClick={()=>onDelete('field',f.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Entity Modal ──────────────────────────────────────────────────────────────
export function EntityModal({open,type,editing,onClose,onSave}){
  const isWA=type==='worker'||type==='agent';
  const emptyWA={name:'',phone:'',payment:'',empType:'temporary',status:'active',startDate:'',endDate:''};
  const emptyF={name:'',area:'',notes:''};
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(open)setForm(editing?{...(isWA?emptyWA:emptyF),...editing}:(isWA?emptyWA:emptyF));},[open,type,editing]); // eslint-disable-line
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    if(!form.name)return alert('Enter a name');
    setSaving(true); try{await onSave(form);}finally{setSaving(false);}
  };
  return(
    <ChModal open={open} onClose={onClose} title={`${editing?'Edit':'Add'} ${type?type.charAt(0).toUpperCase()+type.slice(1):''}`}
      footer={<><button className="ch-btn ch-btn-secondary" onClick={onClose}>Cancel</button><button className="ch-btn ch-btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save'}</button></>}>
      {type==='field'?(
        <>
          <div className="ch-form-group"><label>Field Name *</label><input className="ch-input" value={form.name||''} onChange={e=>set('name',e.target.value)}/></div>
          <div className="ch-grid-2">
            <div className="ch-form-group"><label>Area (Acres)</label><input className="ch-input" type="number" step="0.01" value={form.area||''} onChange={e=>set('area',e.target.value)}/></div>
            <div className="ch-form-group"><label>Notes</label><input className="ch-input" value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
          </div>
        </>
      ):(
        <>
          <div className="ch-grid-2">
            <div className="ch-form-group"><label>Name *</label><input className="ch-input" value={form.name||''} onChange={e=>set('name',e.target.value)}/></div>
            <div className="ch-form-group"><label>Phone</label><input className="ch-input" value={form.phone||''} onChange={e=>set('phone',e.target.value)}/></div>
          </div>
          <div className="ch-grid-2">
            <div className="ch-form-group"><label>Employment Type</label>
              <select className="ch-input" value={form.empType||'temporary'} onChange={e=>set('empType',e.target.value)}>
                <option value="permanent">Permanent</option><option value="temporary">Temporary</option>
              </select></div>
            <div className="ch-form-group"><label>Status</label>
              <select className="ch-input" value={form.status||'active'} onChange={e=>set('status',e.target.value)}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select></div>
          </div>
          <div className="ch-form-group"><label>Payment Terms</label><input className="ch-input" value={form.payment||''} onChange={e=>set('payment',e.target.value)} placeholder="e.g. Weekly, ₹6/kg"/></div>
          <div className="ch-grid-2">
            <div className="ch-form-group"><label>Start Date</label><input className="ch-input" type="date" value={form.startDate||''} onChange={e=>set('startDate',e.target.value)}/></div>
            <div className="ch-form-group"><label>End Date</label><input className="ch-input" type="date" value={form.endDate||''} onChange={e=>set('endDate',e.target.value)}/></div>
          </div>
        </>
      )}
    </ChModal>
  );
}
