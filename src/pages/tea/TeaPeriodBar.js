import React from 'react';
import {periodBounds} from '../../utils/chaayaService';
import {PERIOD_OPTS} from './chaayaStyles';

export default function PeriodBar({period,onChange}){
  return(
    <div className="ch-period-bar">
      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
        {PERIOD_OPTS.map(o=>(
          <button key={o.key} className={`ch-period-btn ${period.preset===o.key?'active':''}`}
            onClick={()=>{const b=periodBounds(o.key);onChange({preset:o.key,...b});}}>
            {o.label}
          </button>
        ))}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto',flexWrap:'wrap'}}>
        <input type="date" className="ch-input" style={{width:130,padding:'5px 9px',fontSize:12}}
          value={period.from||''} onChange={e=>onChange({...period,preset:'custom',from:e.target.value})}/>
        <span style={{color:'#9a9a8c',fontSize:12}}>to</span>
        <input type="date" className="ch-input" style={{width:130,padding:'5px 9px',fontSize:12}}
          value={period.to||''} onChange={e=>onChange({...period,preset:'custom',to:e.target.value})}/>
      </div>
    </div>
  );
}
