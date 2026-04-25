import React from 'react';
import {X} from 'lucide-react';
import {C} from './chaayaStyles';

export default function ChModal({open,onClose,title,children,footer,wide}){
  if(!open) return null;
  return(
    <div className="ch-modal-overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="ch-modal" style={wide?{width:720}:{}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
          <div className="ch-modal-title" style={{margin:0}}>{title}</div>
          <button style={{background:'none',border:'none',cursor:'pointer',color:C.faint,fontSize:18}} onClick={onClose}><X size={18}/></button>
        </div>
        {children}
        {footer&&<div className="ch-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
