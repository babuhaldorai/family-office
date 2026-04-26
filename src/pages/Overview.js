/**
 * Overview.js
 * Merges Dashboard, Reports, and YOY into a single page with 3 top-level tabs.
 * Replaces the separate Dashboard, ReportsPage, and YOYPage routes.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { rentalService } from '../utils/firestoreService';
import { homeExpenseService } from '../utils/homeService';
import { buildMonthlyPL, buildCategoryBreakdown, fmt, MONTHS } from '../utils/finance';
import { useTeaFinancials, useTeaDashboard } from '../hooks/useTeaFinancials';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

const YEAR       = new Date().getFullYear();
const YEARS      = [YEAR - 2, YEAR - 1, YEAR];
const LOAD_YEARS = YEARS;
const YOY_COLORS = ['var(--muted)', 'var(--rental-light)', 'var(--accent)'];

function homeToTx(homeExp) {
  return homeExp.map(e => ({
    type: 'expense', category: e.category || 'Home Maintenance',
    amount: e.amount,
    month: e.month || (e.date ? new Date(e.date).getMonth() + 1 : 1),
    year: e.year || YEAR,
  }));
}

// ── Period filter ─────────────────────────────────────────────────────────────
const PERIOD_OPTS = [
  { key:'this_month', label:'This Month' },
  { key:'last_month', label:'Last Month' },
  { key:'ytd',        label:'YTD'        },
  { key:'last_year',  label:'Last Year'  },
  { key:'all',        label:'All Time'   },
];

function usePeriod(key) {
  return useMemo(() => {
    const now=new Date(), y=now.getFullYear(), m=now.getMonth();
    const f2=d=>d.toISOString().slice(0,10);
    const bounds={
      this_month:{from:f2(new Date(y,m,1)),   to:f2(new Date(y,m+1,0))},
      last_month:{from:f2(new Date(y,m-1,1)), to:f2(new Date(y,m,0))},
      ytd:       {from:`${y}-01-01`,            to:f2(now)},
      last_year: {from:`${y-1}-01-01`,          to:`${y-1}-12-31`},
      all:       {from:'2000-01-01',             to:'2099-12-31'},
    };
    const labels={
      this_month:new Date(y,m,1).toLocaleString('en-IN',{month:'long',year:'numeric'}),
      last_month:new Date(y,m-1,1).toLocaleString('en-IN',{month:'long',year:'numeric'}),
      ytd:`Jan – ${now.toLocaleString('en-IN',{month:'short'})} ${y} (YTD)`,
      last_year:`${y-1} (full year)`,
      all:'All Time',
    };
    return {preset:key,...bounds[key],label:labels[key]};
  },[key]);
}

function PeriodBar({periodKey,onChange}) {
  const period=usePeriod(periodKey);
  return(
    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'10px 14px',marginBottom:20}}>
      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
        {PERIOD_OPTS.map(o=>(
          <button key={o.key}
            style={{padding:'5px 13px',borderRadius:'var(--radius)',border:'1px solid var(--border2)',background:periodKey===o.key?'var(--accent)':'transparent',color:periodKey===o.key?'#0f1117':'var(--muted)',fontSize:'0.8rem',fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .15s'}}
            onClick={()=>onChange(o.key)}>{o.label}</button>
        ))}
      </div>
      <span style={{marginLeft:'auto',fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic'}}>{period.label}</span>
    </div>
  );
}



export default function Overview() {
  const [mainTab, setMainTab]     = useState('dashboard');
  const [periodKey, setPeriodKey] = useState('ytd');

  // Dashboard data
  const [rentTx,  setRentTx]   = useState([]);
  const [homeExp, setHomeExp]  = useState([]);
  const [rentLoading, setRentL] = useState(true);
  const [homeLoading, setHomeL] = useState(true);
  const {transactions:teaTx, loading:teaLoading} = useTeaFinancials(YEAR);
  const teaDash = useTeaDashboard();

  // Reports data (year-specific)
  const [rYear,  setRYear]      = useState(YEAR);
  const [rRentTx,  setRRentTx]  = useState([]);
  const [rHomeExp, setRHomeExp] = useState([]);
  const [rRentL,  setRRentL]    = useState(true);
  const [rHomeL,  setRHomeL]    = useState(true);
  const [rTab,    setRTab]       = useState('pl');
  const {transactions:rTeaTx, loading:rTeaL} = useTeaFinancials(rYear);

  // YOY data
  const [yoyData,    setYoyData]    = useState({});
  const [yoyLoading, setYoyLoading] = useState(true);
  const [yoySegment, setYoySegment] = useState('all');

  useEffect(()=>{
    rentalService.getTransactions(YEAR).then(r=>setRentTx(r)).finally(()=>setRentL(false));
    homeExpenseService.getByYear(YEAR).then(e=>setHomeExp(e)).finally(()=>setHomeL(false));
  },[]);

  useEffect(()=>{
    setRRentL(true); setRHomeL(true);
    rentalService.getTransactions(rYear).then(r=>setRRentTx(r)).finally(()=>setRRentL(false));
    homeExpenseService.getByYear(rYear).then(e=>setRHomeExp(e)).finally(()=>setRHomeL(false));
  },[rYear]);

  useEffect(()=>{
    if(mainTab!=='yoy') return;
    setYoyLoading(true);

    // Helper: fetch maintenance with year-filter fallback (old records may not have year field)
    async function fetchMaintenance(y) {
      const parseY = m => m.year ? Number(m.year) : (m.date ? new Date(m.date).getFullYear() : y);
      try {
        const snap = await getDocs(query(collection(db,'tea_maintenance'),where('year','==',y)));
        const rows = snap.docs.map(d=>({id:d.id,...d.data()}));
        if(rows.length>0) return rows;
        // fallback: fetch all, filter by date-derived year
        const all = await getDocs(collection(db,'tea_maintenance'));
        return all.docs.map(d=>({id:d.id,...d.data()})).filter(m=>parseY(m)===y);
      } catch {
        return [];
      }
    }

    Promise.all(LOAD_YEARS.map(async y=>{
      const [rTx,hExp,harvest,maintenance]=await Promise.all([
        rentalService.getTransactions(y),
        homeExpenseService.getByYear(y),
        getDocs(query(collection(db,'tea_harvest'),where('year','==',y))).then(s=>s.docs.map(d=>({id:d.id,...d.data()}))).catch(()=>[]),
        fetchMaintenance(y),
      ]);
      const rentIncome=rTx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
      const rentExpense=rTx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
      const teaIncome=harvest.reduce((s,h)=>s+(h.agentRev||0),0);
      const teaWages=harvest.reduce((s,h)=>s+(h.workerPay||0),0);
      const teaMaint=maintenance.reduce((s,m)=>s+(m.cost||0),0);
      const teaExpense=teaWages+teaMaint;
      const homeTotal=hExp.reduce((s,e)=>s+Number(e.amount||0),0);
      const monthly=Array.from({length:12},()=>({teaInc:0,teaExp:0,rentInc:0,rentExp:0,homeExp:0}));
      harvest.forEach(h=>{const m=(h.month||1)-1;if(m>=0&&m<12){monthly[m].teaInc+=h.agentRev||0;monthly[m].teaExp+=h.workerPay||0;}});
      maintenance.forEach(m=>{const mo=(m.month||1)-1;if(mo>=0&&mo<12)monthly[mo].teaExp+=m.cost||0;});
      rTx.forEach(t=>{const m=(t.month||1)-1;if(m>=0&&m<12){if(t.type==='income')monthly[m].rentInc+=Number(t.amount);else monthly[m].rentExp+=Number(t.amount);}});
      hExp.forEach(e=>{const m=(e.month||1)-1;if(m>=0&&m<12)monthly[m].homeExp+=Number(e.amount||0);});
      // Per-task maintenance breakdown
      const maintTasks={};
      maintenance.forEach(m=>{
        const k=m.task||'Maintenance';
        maintTasks[k]=(maintTasks[k]||0)+(m.cost||0);
      });
      return[y,{rentIncome,rentExpense,teaIncome,teaExpense,teaWages,teaMaint,maintTasks,homeTotal,monthly}];
    })).then(entries=>{setYoyData(Object.fromEntries(entries));setYoyLoading(false);});
  },[mainTab]);

  // ── Dashboard calcs ──
  const period=usePeriod(periodKey);
  const filterTx=(txs,p)=>txs.filter(t=>!t.date||(t.date>=p.from&&t.date<=p.to));
  const filterEx=(exps,p)=>exps.filter(e=>!e.date||(e.date>=p.from&&e.date<=p.to));
  const sum=(txs,type)=>txs.filter(t=>t.type===type).reduce((s,t)=>s+Number(t.amount),0);

  const pTea=useMemo(()=>filterTx(teaTx,period),[teaTx,period]);
  const pRent=useMemo(()=>filterTx(rentTx,period),[rentTx,period]);
  const pHome=useMemo(()=>filterEx(homeExp,period),[homeExp,period]);

  const teaInc=sum(pTea,'income'), teaExp=sum(pTea,'expense');
  const rentInc=sum(pRent,'income'), rentExp=sum(pRent,'expense');
  const homeTotal=pHome.reduce((s,e)=>s+Number(e.amount||0),0);
  const totalInc=teaInc+rentInc, totalExp=teaExp+rentExp+homeTotal, net=totalInc-totalExp;

  // Full-year chart
  const homeMonthly=useMemo(()=>{const m=Array.from({length:12},()=>0);homeExp.forEach(e=>{const mo=(e.month||1)-1;if(mo>=0&&mo<12)m[mo]+=Number(e.amount||0);});return m;},[homeExp]);
  const chartData=buildMonthlyPL([...teaTx,...rentTx]).map((m,i)=>({month:m.label,Income:m.income,Expenses:m.expense+homeMonthly[i],'Net P&L':m.income-(m.expense+homeMonthly[i])}));

  const dashLoading=teaLoading||rentLoading||homeLoading;

  // ── Reports calcs ──
  const rAll=useMemo(()=>[...rTeaTx,...rRentTx,...homeToTx(rHomeExp)],[rTeaTx,rRentTx,rHomeExp]);
  const rMonthly=useMemo(()=>buildMonthlyPL(rAll),[rAll]);
  const rTeaM=useMemo(()=>buildMonthlyPL(rTeaTx),[rTeaTx]);
  const rRentM=useMemo(()=>buildMonthlyPL(rRentTx),[rRentTx]);
  const rHomeM=useMemo(()=>buildMonthlyPL(homeToTx(rHomeExp)),[rHomeExp]);
  const rTotalInc=rMonthly.reduce((s,m)=>s+m.income,0);
  const rTotalExp=rMonthly.reduce((s,m)=>s+m.expense,0);
  const rNet=rTotalInc-rTotalExp;
  const rHomeTotal=rHomeExp.reduce((s,e)=>s+Number(e.amount||0),0);
  const rChartData=rMonthly.map(m=>({name:m.label,Income:m.income,Expenses:m.expense,Net:m.net}));

  // Segment-aware category breakdowns for Reports
  // Income: Tea Sales + Rental income categories
  const rIncDetailed=useMemo(()=>{
    const rows=[];
    // Tea income
    const teaSales=rTeaTx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    if(teaSales>0) rows.push({category:'Tea Sales',segment:'🍃 Tea',amount:teaSales,type:'income'});
    // Rental income by category
    const map={};
    rRentTx.filter(t=>t.type==='income').forEach(t=>{map[t.category||'Rent']=(map[t.category||'Rent']||0)+Number(t.amount);});
    Object.entries(map).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>rows.push({category:cat,segment:'🏠 Rentals',amount:amt,type:'income'}));
    return rows;
  },[rTeaTx,rRentTx]);

  // Expense: Tea Labour + Tea Maintenance tasks + Rental expense cats + Home cats
  const rExpDetailed=useMemo(()=>{
    const rows=[];
    // Tea: Labour
    const labour=rTeaTx.filter(t=>t.type==='expense'&&t.category==='Labour').reduce((s,t)=>s+Number(t.amount),0);
    if(labour>0) rows.push({category:'Labour',segment:'🍃 Tea',amount:labour,type:'expense'});
    // Tea: Maintenance tasks (everything except Labour)
    const maintMap={};
    rTeaTx.filter(t=>t.type==='expense'&&t.category!=='Labour').forEach(t=>{maintMap[t.category||'Maintenance']=(maintMap[t.category||'Maintenance']||0)+Number(t.amount);});
    Object.entries(maintMap).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>rows.push({category:cat,segment:'🍃 Tea',amount:amt,type:'expense'}));
    // Rental expenses
    const rentMap={};
    rRentTx.filter(t=>t.type==='expense').forEach(t=>{rentMap[t.category||'Other']=(rentMap[t.category||'Other']||0)+Number(t.amount);});
    Object.entries(rentMap).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>rows.push({category:cat,segment:'🏠 Rentals',amount:amt,type:'expense'}));
    // Home maintenance
    const homeMap={};
    rHomeExp.forEach(e=>{homeMap[e.category||'Other']=(homeMap[e.category||'Other']||0)+Number(e.amount||0);});
    Object.entries(homeMap).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>rows.push({category:cat,segment:'🔧 Home',amount:amt,type:'expense'}));
    return rows;
  },[rTeaTx,rRentTx,rHomeExp]);
  const rLoading=rTeaL||rRentL||rHomeL;

  // ── YOY calcs ──
  const yoyRows=useMemo(()=>LOAD_YEARS.map(y=>{
    const d=yoyData[y]||{};
    let income=0,expense=0;
    if(yoySegment==='all'||yoySegment==='tea'){income+=d.teaIncome||0;expense+=d.teaExpense||0;}
    if(yoySegment==='all'||yoySegment==='rental'){income+=d.rentIncome||0;expense+=d.rentExpense||0;}
    if(yoySegment==='all'||yoySegment==='homes'){expense+=d.homeTotal||0;}
    return{year:y,income,expense,net:income-expense};
  }),[yoyData,yoySegment]);

  const yoyMonthly=useMemo(()=>MONTHS.map((label,i)=>{
    const row={name:label};
    LOAD_YEARS.forEach(y=>{
      const d=yoyData[y]||{},mo=d.monthly?.[i]||{};
      let inc=0,exp=0,teaRevenue=0,rentRevenue=0,homeExpAmt=0;
      if(yoySegment==='all'||yoySegment==='tea'){teaRevenue=mo.teaInc||0;inc+=teaRevenue;exp+=mo.teaExp||0;}
      if(yoySegment==='all'||yoySegment==='rental'){rentRevenue=mo.rentInc||0;inc+=rentRevenue;exp+=mo.rentExp||0;}
      if(yoySegment==='all'||yoySegment==='homes'){homeExpAmt=mo.homeExp||0;exp+=homeExpAmt;}
      row[`${y} Revenue`]=Math.round(inc);
      row[`${y} Net`]=Math.round(inc-exp);

    });
    return row;
  }),[yoyData,yoySegment]);

  const delta=(curr,prev)=>{if(!prev||prev===0)return null;const pct=((curr-prev)/Math.abs(prev))*100;return{pct:pct.toFixed(1),up:pct>=0};};

  return(
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Dashboard · Reports · Year-over-Year</p>
        </div>
        <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>
          {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
        </div>
      </div>

      <div className="page-content-inner">

        {/* ── TOP TABS ── */}
        <div className="tabs">
          {[['dashboard','⌂ Dashboard'],['reports','📊 Reports'],['yoy','📈 YOY Comparison']].map(([k,l])=>(
            <button key={k} className={`tab ${mainTab===k?'active':''}`} onClick={()=>setMainTab(k)}>{l}</button>
          ))}
        </div>

        {/* ══════════════════ DASHBOARD ══════════════════ */}
        {mainTab==='dashboard'&&(
          <div>
            <PeriodBar periodKey={periodKey} onChange={setPeriodKey}/>
            {dashLoading&&<div style={{padding:40,color:'var(--muted)'}}>Loading…</div>}
            {!dashLoading&&(()=>{
              // Derived expense breakdown for Tea
              const teaLabour = pTea.filter(t=>t.type==='expense'&&t.category==='Labour').reduce((s,t)=>s+Number(t.amount),0);
              // Rental expense categories
              const rentExpCats = Object.entries(
                pRent.filter(t=>t.type==='expense').reduce((acc,t)=>{acc[t.category||'Other']=(acc[t.category||'Other']||0)+Number(t.amount);return acc;},{})
              ).sort((a,b)=>b[1]-a[1]);
              // Home expense categories
              const homeCats = Object.entries(
                pHome.reduce((acc,e)=>{acc[e.category||'Other']=(acc[e.category||'Other']||0)+Number(e.amount||0);return acc;},{})
              ).sort((a,b)=>b[1]-a[1]);

              return(
                <>
                  {teaDash?.pendingRateUpdate&&(
                    <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(224,146,74,0.1)',border:'1px solid rgba(224,146,74,0.35)',borderRadius:'var(--radius)',padding:'11px 16px',marginBottom:20,fontSize:'0.85rem',color:'var(--warn)'}}>
                      <AlertTriangle size={16} style={{flexShrink:0}}/>
                      <span><strong>Tea revenue is estimated.</strong> Some harvest sessions used an estimated (⏳) rate. Update in Tea → Market Rates.</span>
                    </div>
                  )}

                  {/* Top KPI strip */}
                  <div className="stat-grid" style={{marginBottom:24}}>
                    <div className="stat-card income">
                      <div className="stat-label">Total Revenue</div>
                      <div className="stat-value">{fmt(totalInc)}</div>
                      <div style={{marginTop:8,fontSize:'0.75rem',display:'flex',flexDirection:'column',gap:3}}>
                        <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--tea-light)'}}>🍃 Tea</span><span style={{color:'var(--text)'}}>{fmt(teaInc)}</span></div>
                        <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--rental-light)'}}>🏠 Rentals</span><span style={{color:'var(--text)'}}>{fmt(rentInc)}</span></div>
                      </div>
                    </div>
                    <div className="stat-card expense">
                      <div className="stat-label">Total Expenses</div>
                      <div className="stat-value">{fmt(totalExp)}</div>
                      <div style={{marginTop:8,fontSize:'0.75rem',display:'flex',flexDirection:'column',gap:3}}>
                        {teaLabour>0&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--tea-light)'}}>Labour</span><span style={{color:'var(--danger)'}}>{fmt(teaLabour)}</span></div>}
                        {Object.entries(pTea.filter(t=>t.type==='expense'&&t.category!=='Labour').reduce((acc,t)=>{acc[t.category||'Maint']=(acc[t.category||'Maint']||0)+Number(t.amount);return acc;},{})).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                          <div key={cat} style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--tea-light)'}}>{cat}</span><span style={{color:'var(--danger)'}}>{fmt(amt)}</span></div>
                        ))}
                        {rentExp>0&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--rental-light)'}}>Rentals</span><span style={{color:'var(--danger)'}}>{fmt(rentExp)}</span></div>}
                        {homeTotal>0&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--warn)'}}>Home</span><span style={{color:'var(--danger)'}}>{fmt(homeTotal)}</span></div>}
                      </div>
                    </div>
                    <div className="stat-card net">
                      <div className="stat-label">Net Surplus</div>
                      <div className="stat-value" style={{color:net>=0?'var(--success)':'var(--danger)'}}>{fmt(net)}</div>
                      <div className={`stat-delta ${net>=0?'up':'down'}`} style={{marginTop:4}}>{net>=0?'▲':'▼'} {totalInc>0?((net/totalInc)*100).toFixed(1):0}% margin</div>
                      <div style={{marginTop:8,fontSize:'0.75rem',display:'flex',flexDirection:'column',gap:3}}>
                        <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Tea net</span><span style={{color:teaInc-teaExp>=0?'var(--success)':'var(--danger)'}}>{fmt(teaInc-teaExp)}</span></div>
                        <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Rental net</span><span style={{color:rentInc-rentExp>=0?'var(--success)':'var(--danger)'}}>{fmt(rentInc-rentExp)}</span></div>
                      </div>
                    </div>
                    <div className="stat-card" style={{borderTop:'3px solid var(--warn)'}}>
                      <div className="stat-label">Home Maintenance</div>
                      <div className="stat-value expense-text">{fmt(homeTotal)}</div>
                      <div style={{marginTop:8,fontSize:'0.75rem',display:'flex',flexDirection:'column',gap:3}}>
                        {homeCats.slice(0,3).map(([cat,amt])=>(
                          <div key={cat} style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:90}}>{cat}</span><span style={{color:'var(--danger)'}}>{fmt(amt)}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Segment detail cards */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:24}}>

                    {/* Tea Plantation */}
                    <div className="card segment-tea">
                      <div style={{fontWeight:700,marginBottom:4}}>🍃 Tea Plantation</div>
                      {teaDash&&<div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:10}}>Week: <strong style={{color:'var(--tea-light)'}}>{teaDash.cwKg.toFixed(1)} kg</strong></div>}
                      {/* Revenue / Expenses / Net row */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:12}}>
                        {[{l:'Revenue',v:teaInc,c:'income-text'},{l:'Expenses',v:teaExp,c:'expense-text'},{l:'Net',v:teaInc-teaExp,c:teaInc-teaExp>=0?'income-text':'expense-text'}].map(s=>(
                          <div key={s.l}><div className="stat-label">{s.l}</div><div className={`amount-cell ${s.c}`} style={{fontSize:'0.85rem'}}>{fmt(s.v)}</div></div>
                        ))}
                      </div>
                      {/* Expense breakdown */}
                      <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
                        <div style={{fontSize:'0.68rem',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Expense Breakdown</div>
                        {/* Labour */}
                        {teaLabour>0&&(
                          <div style={{marginBottom:6}}>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',marginBottom:2}}>
                              <span style={{color:'var(--muted)'}}>Labour</span><span style={{color:'var(--danger)'}}>{fmt(teaLabour)}</span>
                            </div>
                            <div style={{height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${teaExp>0?(teaLabour/teaExp)*100:0}%`,background:'var(--danger)',borderRadius:2}}/>
                            </div>
                          </div>
                        )}
                        {/* Each maintenance task */}
                        {Object.entries(
                          pTea.filter(t=>t.type==='expense'&&t.category!=='Labour')
                            .reduce((acc,t)=>{acc[t.category||'Maintenance']=(acc[t.category||'Maintenance']||0)+Number(t.amount);return acc;},{})
                        ).sort((a,b)=>b[1]-a[1]).map(([task,amt])=>(
                          <div key={task} style={{marginBottom:6}}>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',marginBottom:2}}>
                              <span style={{color:'var(--muted)'}}>{task}</span><span style={{color:'var(--danger)'}}>{fmt(amt)}</span>
                            </div>
                            <div style={{height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${teaExp>0?(amt/teaExp)*100:0}%`,background:'var(--warn)',borderRadius:2}}/>
                            </div>
                          </div>
                        ))}
                        {teaInc>0&&<div style={{marginTop:8,fontSize:'0.72rem',color:'var(--muted)'}}>Margin: <strong style={{color:teaInc-teaExp>=0?'var(--success)':'var(--danger)'}}>{(((teaInc-teaExp)/teaInc)*100).toFixed(1)}%</strong></div>}
                      </div>
                    </div>

                    {/* Rental Homes */}
                    <div className="card segment-rental">
                      <div style={{fontWeight:700,marginBottom:12}}>🏠 Rental Homes</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:12}}>
                        {[{l:'Revenue',v:rentInc,c:'income-text'},{l:'Expenses',v:rentExp,c:'expense-text'},{l:'Net',v:rentInc-rentExp,c:rentInc-rentExp>=0?'income-text':'expense-text'}].map(s=>(
                          <div key={s.l}><div className="stat-label">{s.l}</div><div className={`amount-cell ${s.c}`} style={{fontSize:'0.85rem'}}>{fmt(s.v)}</div></div>
                        ))}
                      </div>
                      {/* Expense categories */}
                      {rentExp>0&&(
                        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
                          <div style={{fontSize:'0.68rem',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Expense Breakdown</div>
                          {rentExpCats.slice(0,4).map(([cat,amt])=>(
                            <div key={cat} style={{marginBottom:6}}>
                              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',marginBottom:2}}>
                                <span style={{color:'var(--muted)'}}>{cat}</span><span style={{color:'var(--danger)'}}>{fmt(amt)}</span>
                              </div>
                              <div style={{height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${rentExp>0?(amt/rentExp)*100:0}%`,background:'var(--danger)',borderRadius:2}}/>
                              </div>
                            </div>
                          ))}
                          {rentInc>0&&<div style={{marginTop:8,fontSize:'0.72rem',color:'var(--muted)'}}>Margin: <strong style={{color:rentInc-rentExp>=0?'var(--success)':'var(--danger)'}}>{(((rentInc-rentExp)/rentInc)*100).toFixed(1)}%</strong></div>}
                        </div>
                      )}
                    </div>

                    {/* Home Maintenance */}
                    <div className="card" style={{borderLeft:'3px solid var(--warn)'}}>
                      <div style={{fontWeight:700,marginBottom:8}}>🔧 Home Maintenance</div>
                      <div><div className="stat-label">Total Spent</div><div className="amount-cell expense-text" style={{fontSize:'1.2rem',fontWeight:700}}>{fmt(homeTotal)}</div></div>
                      <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:4,marginBottom:10}}>{pHome.length} entries · {period.label}</div>
                      {homeTotal>0&&(
                        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
                          <div style={{fontSize:'0.68rem',fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>By Category</div>
                          {homeCats.slice(0,5).map(([cat,amt])=>(
                            <div key={cat} style={{marginBottom:6}}>
                              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',marginBottom:2}}>
                                <span style={{color:'var(--muted)'}}>{cat}</span><span style={{color:'var(--danger)'}}>{fmt(amt)}</span>
                              </div>
                              <div style={{height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${homeTotal>0?(amt/homeTotal)*100:0}%`,background:'var(--warn)',borderRadius:2}}/>
                              </div>
                            </div>
                          ))}
                          {homeTotal>0&&totalInc>0&&<div style={{marginTop:8,fontSize:'0.72rem',color:'var(--muted)'}}>% of income: <strong style={{color:'var(--warn)'}}>{((homeTotal/totalInc)*100).toFixed(1)}%</strong></div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Consolidated summary table */}
                  <div className="card" style={{padding:0,marginBottom:24}}>
                    <div style={{padding:'16px 20px 0',fontWeight:700,fontSize:'1rem'}}>Full Breakdown Summary — {period.label}</div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>Category</th><th>Segment</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>% of Revenue</th></tr>
                        </thead>
                        <tbody>
                          {/* Income rows */}
                          <tr style={{background:'rgba(76,175,128,0.05)'}}><td colSpan={4} style={{fontWeight:600,color:'var(--success)',fontSize:'0.78rem',paddingTop:10}}>INCOME</td></tr>
                          <tr><td style={{paddingLeft:16}}>Tea Sales</td><td style={{color:'var(--tea-light)',fontSize:'0.82rem'}}>🍃 Tea</td><td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(teaInc)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>{totalInc>0?((teaInc/totalInc)*100).toFixed(1):0}%</td></tr>
                          <tr><td style={{paddingLeft:16}}>Rental Income</td><td style={{color:'var(--rental-light)',fontSize:'0.82rem'}}>🏠 Rentals</td><td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(rentInc)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>{totalInc>0?((rentInc/totalInc)*100).toFixed(1):0}%</td></tr>
                          <tr style={{fontWeight:600,borderTop:'1px solid var(--border2)'}}><td>Total Income</td><td></td><td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(totalInc)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>100%</td></tr>
                          {/* Expense rows */}
                          <tr style={{background:'rgba(224,92,92,0.05)'}}><td colSpan={4} style={{fontWeight:600,color:'var(--danger)',fontSize:'0.78rem',paddingTop:10}}>EXPENSES</td></tr>
                          {teaLabour>0&&<tr><td style={{paddingLeft:16}}>Labour</td><td style={{color:'var(--tea-light)',fontSize:'0.82rem'}}>🍃 Tea</td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(teaLabour)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>{totalInc>0?((teaLabour/totalInc)*100).toFixed(1):0}%</td></tr>}
                          {Object.entries(pTea.filter(t=>t.type==='expense'&&t.category!=='Labour').reduce((acc,t)=>{acc[t.category||'Maintenance']=(acc[t.category||'Maintenance']||0)+Number(t.amount);return acc;},{})).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                            <tr key={cat}><td style={{paddingLeft:16}}>{cat}</td><td style={{color:'var(--tea-light)',fontSize:'0.82rem'}}>🍃 Tea</td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(amt)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>{totalInc>0?((amt/totalInc)*100).toFixed(1):0}%</td></tr>
                          ))}
                          {rentExpCats.map(([cat,amt])=>(
                            <tr key={cat}><td style={{paddingLeft:16}}>{cat}</td><td style={{color:'var(--rental-light)',fontSize:'0.82rem'}}>🏠 Rentals</td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(amt)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>{totalInc>0?((amt/totalInc)*100).toFixed(1):0}%</td></tr>
                          ))}
                          {homeCats.map(([cat,amt])=>(
                            <tr key={cat}><td style={{paddingLeft:16}}>{cat}</td><td style={{color:'var(--warn)',fontSize:'0.82rem'}}>🔧 Home</td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(amt)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>{totalInc>0?((amt/totalInc)*100).toFixed(1):0}%</td></tr>
                          ))}
                          <tr style={{fontWeight:600,borderTop:'1px solid var(--border2)'}}><td>Total Expenses</td><td></td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(totalExp)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>{totalInc>0?((totalExp/totalInc)*100).toFixed(1):0}%</td></tr>
                          {/* Net */}
                          <tr style={{fontWeight:700,borderTop:'2px solid var(--border2)',background:'var(--surface2)'}}><td>Net Surplus</td><td></td><td className="amount-cell" style={{textAlign:'right',color:net>=0?'var(--success)':'var(--danger)'}}>{fmt(net)}</td><td style={{textAlign:'right',color:net>=0?'var(--success)':'var(--danger)',fontWeight:700}}>{totalInc>0?((net/totalInc)*100).toFixed(1):0}%</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Monthly chart */}
                  <div className="card">
                    <div className="section-title">Monthly Performance — {YEAR}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:14}}>Full year · All segments</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData} margin={{top:4,right:16,left:0,bottom:0}}>
                        <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
                        <YAxis tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
                        <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:8}} labelStyle={{color:'var(--muted)',fontSize:'0.8rem'}}/>
                        <Legend wrapperStyle={{fontSize:'0.8rem',color:'var(--muted)'}}/>
                        <Bar dataKey="Income"   fill="var(--success)" radius={[3,3,0,0]}/>
                        <Bar dataKey="Expenses" fill="var(--danger)"  radius={[3,3,0,0]}/>
                        <Bar dataKey="Net P&L"  fill="var(--accent)"  radius={[3,3,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ══════════════════ REPORTS ══════════════════ */}
        {mainTab==='reports'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div className="year-selector">
                {YEARS.map(y=><button key={y} className={rYear===y?'active':''} onClick={()=>setRYear(y)}>{y}</button>)}
              </div>
            </div>
            {rLoading&&<div style={{padding:40,color:'var(--muted)'}}>Loading…</div>}
            {!rLoading&&<>
              <div className="tabs" style={{marginBottom:24}}>
                {[['pl','P & L Statement'],['operating','Operating Statement'],['segment','By Segment']].map(([k,v])=>(
                  <button key={k} className={`tab ${rTab===k?'active':''}`} onClick={()=>setRTab(k)}>{v}</button>
                ))}
              </div>
              {rTab==='pl'&&(
                <div>
                  <div className="stat-grid" style={{marginBottom:24}}>
                    <div className="stat-card income"><div className="stat-label">Total Revenue</div><div className="stat-value income-text">{fmt(rTotalInc)}</div></div>
                    <div className="stat-card expense"><div className="stat-label">Total Expenses</div><div className="stat-value expense-text">{fmt(rTotalExp)}</div></div>
                    <div className="stat-card net"><div className="stat-label">Net Surplus</div><div className="stat-value" style={{color:rNet>=0?'var(--success)':'var(--danger)'}}>{fmt(rNet)}</div></div>
                    <div className="stat-card"><div className="stat-label">Net Margin</div><div className="stat-value">{rTotalInc>0?`${((rNet/rTotalInc)*100).toFixed(1)}%`:'—'}</div></div>
                  </div>
                  <div className="card" style={{marginBottom:24}}>
                    <div className="section-title">Monthly Revenue vs Expenses — {rYear}</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={rChartData}>
                        <XAxis dataKey="name" tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
                        <YAxis tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
                        <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:8}}/>
                        <Bar dataKey="Income" fill="var(--success)" radius={[3,3,0,0]}/>
                        <Bar dataKey="Expenses" fill="var(--danger)" radius={[3,3,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid-2" style={{marginBottom:24}}>
                    {/* Revenue breakdown */}
                    <div className="card" style={{padding:0}}>
                      <div style={{padding:'16px 20px 8px',fontWeight:600,fontSize:'0.95rem',color:'var(--success)'}}>Revenue Breakdown</div>
                      <table>
                        <thead><tr><th>Category</th><th>Segment</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>%</th></tr></thead>
                        <tbody>
                          {rIncDetailed.map(r=>(
                            <tr key={r.category+r.segment}>
                              <td style={{fontWeight:500}}>{r.category}</td>
                              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{r.segment}</td>
                              <td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(r.amount)}</td>
                              <td style={{textAlign:'right',fontSize:'0.82rem',color:'var(--muted)'}}>{rTotalInc>0?((r.amount/rTotalInc)*100).toFixed(1):0}%</td>
                            </tr>
                          ))}
                          <tr style={{borderTop:'1px solid var(--border2)',fontWeight:600}}>
                            <td colSpan={2}>Total Revenue</td>
                            <td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(rTotalInc)}</td>
                            <td style={{textAlign:'right',fontSize:'0.82rem',color:'var(--muted)'}}>100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {/* Expense breakdown */}
                    <div className="card" style={{padding:0}}>
                      <div style={{padding:'16px 20px 8px',fontWeight:600,fontSize:'0.95rem',color:'var(--danger)'}}>Expense Breakdown</div>
                      <table>
                        <thead><tr><th>Category</th><th>Segment</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>% of Rev</th></tr></thead>
                        <tbody>
                          {rExpDetailed.map(r=>(
                            <tr key={r.category+r.segment}>
                              <td style={{fontWeight:500}}>{r.category}</td>
                              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{r.segment}</td>
                              <td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(r.amount)}</td>
                              <td style={{textAlign:'right',fontSize:'0.82rem',color:'var(--muted)'}}>{rTotalInc>0?((r.amount/rTotalInc)*100).toFixed(1):0}%</td>
                            </tr>
                          ))}
                          <tr style={{borderTop:'1px solid var(--border2)',fontWeight:600}}>
                            <td colSpan={2}>Total Expenses</td>
                            <td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(rTotalExp)}</td>
                            <td style={{textAlign:'right',fontSize:'0.82rem',color:'var(--muted)'}}>{rTotalInc>0?((rTotalExp/rTotalInc)*100).toFixed(1):0}%</td>
                          </tr>
                          <tr style={{fontWeight:700,background:'var(--surface2)'}}>
                            <td colSpan={2} style={{color:rNet>=0?'var(--success)':'var(--danger)'}}>Net Surplus</td>
                            <td className="amount-cell" style={{textAlign:'right',color:rNet>=0?'var(--success)':'var(--danger)'}}>{fmt(rNet)}</td>
                            <td style={{textAlign:'right',color:rNet>=0?'var(--success)':'var(--danger)'}}>{rTotalInc>0?((rNet/rTotalInc)*100).toFixed(1):0}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="card" style={{padding:0}}>
                    <div style={{padding:'16px 20px 0',fontSize:'1rem',fontWeight:600}}>Monthly P&L — {rYear}</div>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Month</th><th style={{textAlign:'right'}}>Revenue</th><th style={{textAlign:'right'}}>Expenses</th><th style={{textAlign:'right'}}>Net</th><th style={{textAlign:'right'}}>Margin</th></tr></thead>
                        <tbody>
                          {rMonthly.map(m=>(
                            <tr key={m.month}>
                              <td style={{fontWeight:500}}>{m.label}</td>
                              <td className="amount-cell income-text"  style={{textAlign:'right'}}>{fmt(m.income)}</td>
                              <td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(m.expense)}</td>
                              <td className="amount-cell" style={{textAlign:'right',color:m.net>=0?'var(--success)':'var(--danger)'}}>{fmt(m.net)}</td>
                              <td style={{textAlign:'right',fontSize:'0.82rem',color:'var(--muted)'}}>{m.income>0?`${((m.net/m.income)*100).toFixed(1)}%`:'—'}</td>
                            </tr>
                          ))}
                          <tr style={{borderTop:'2px solid var(--border2)',fontWeight:600}}>
                            <td>TOTAL</td>
                            <td className="amount-cell income-text"  style={{textAlign:'right'}}>{fmt(rTotalInc)}</td>
                            <td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(rTotalExp)}</td>
                            <td className="amount-cell" style={{textAlign:'right',color:rNet>=0?'var(--success)':'var(--danger)'}}>{fmt(rNet)}</td>
                            <td style={{textAlign:'right',fontSize:'0.82rem',color:'var(--muted)'}}>{rTotalInc>0?`${((rNet/rTotalInc)*100).toFixed(1)}%`:'—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {rTab==='operating'&&(
                <div className="grid-2">
                  <div className="card">
                    <div className="section-title income-text">Revenue Breakdown</div>
                    <table style={{width:'100%'}}>
                      <thead><tr><th>Category</th><th>Segment</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>%</th></tr></thead>
                      <tbody>
                        {rIncDetailed.map(r=>(
                          <tr key={r.category+r.segment}>
                            <td style={{fontWeight:500}}>{r.category}</td>
                            <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{r.segment}</td>
                            <td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(r.amount)}</td>
                            <td style={{textAlign:'right',fontSize:'0.82rem',color:'var(--muted)'}}>{rTotalInc>0?((r.amount/rTotalInc)*100).toFixed(1):0}%</td>
                          </tr>
                        ))}
                        {rIncDetailed.length===0&&<tr><td colSpan={4} style={{color:'var(--muted)',padding:16}}>No income data.</td></tr>}
                        <tr style={{borderTop:'1px solid var(--border2)',fontWeight:600}}><td colSpan={2}>Total Revenue</td><td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(rTotalInc)}</td><td style={{textAlign:'right'}}>100%</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="card">
                    <div className="section-title expense-text">Expense Breakdown</div>
                    <table style={{width:'100%'}}>
                      <thead><tr><th>Category</th><th>Segment</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>% of Rev</th></tr></thead>
                      <tbody>
                        {rExpDetailed.map(r=>(
                          <tr key={r.category+r.segment}>
                            <td style={{fontWeight:500}}>{r.category}</td>
                            <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{r.segment}</td>
                            <td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(r.amount)}</td>
                            <td style={{textAlign:'right',fontSize:'0.82rem',color:'var(--muted)'}}>{rTotalInc>0?((r.amount/rTotalInc)*100).toFixed(1):0}%</td>
                          </tr>
                        ))}
                        {rExpDetailed.length===0&&<tr><td colSpan={4} style={{color:'var(--muted)',padding:16}}>No expense data.</td></tr>}
                        <tr style={{borderTop:'1px solid var(--border2)',fontWeight:600}}><td colSpan={2}>Total Expenses</td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(rTotalExp)}</td><td style={{textAlign:'right',color:'var(--muted)',fontSize:'0.82rem'}}>{rTotalInc>0?((rTotalExp/rTotalInc)*100).toFixed(1):0}%</td></tr>
                        <tr style={{fontWeight:700}}><td colSpan={2} style={{color:rNet>=0?'var(--success)':'var(--danger)'}}>Net Surplus</td><td className="amount-cell" style={{textAlign:'right',color:rNet>=0?'var(--success)':'var(--danger)'}}>{fmt(rNet)}</td><td style={{textAlign:'right',color:rNet>=0?'var(--success)':'var(--danger)'}}>{rTotalInc>0?((rNet/rTotalInc)*100).toFixed(1):0}%</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {rTab==='segment'&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                  <div className="card segment-tea" style={{padding:0}}>
                    <div style={{padding:'14px 16px 0',fontWeight:700}}>🍃 Tea Plantation</div>
                    <table>
                      <thead><tr><th>Month</th><th style={{textAlign:'right'}}>Rev</th><th style={{textAlign:'right'}}>Exp</th><th style={{textAlign:'right'}}>Net</th></tr></thead>
                      <tbody>
                        {rTeaM.map(m=><tr key={m.month}><td style={{fontSize:'0.8rem'}}>{m.label}</td><td className="amount-cell income-text" style={{textAlign:'right',fontSize:'0.8rem'}}>{m.income>0?fmt(m.income):'—'}</td><td className="amount-cell expense-text" style={{textAlign:'right',fontSize:'0.8rem'}}>{m.expense>0?fmt(m.expense):'—'}</td><td className="amount-cell" style={{textAlign:'right',fontSize:'0.8rem',color:m.net>=0?'var(--success)':'var(--danger)'}}>{fmt(m.net)}</td></tr>)}
                        <tr style={{borderTop:'1px solid var(--border2)',fontWeight:600}}><td>Total</td><td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(rTeaM.reduce((s,m)=>s+m.income,0))}</td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(rTeaM.reduce((s,m)=>s+m.expense,0))}</td><td className="amount-cell" style={{textAlign:'right',color:'var(--accent)'}}>{fmt(rTeaM.reduce((s,m)=>s+m.net,0))}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="card segment-rental" style={{padding:0}}>
                    <div style={{padding:'14px 16px 0',fontWeight:700}}>🏠 Rental Homes</div>
                    <table>
                      <thead><tr><th>Month</th><th style={{textAlign:'right'}}>Rev</th><th style={{textAlign:'right'}}>Exp</th><th style={{textAlign:'right'}}>Net</th></tr></thead>
                      <tbody>
                        {rRentM.map(m=><tr key={m.month}><td style={{fontSize:'0.8rem'}}>{m.label}</td><td className="amount-cell income-text" style={{textAlign:'right',fontSize:'0.8rem'}}>{m.income>0?fmt(m.income):'—'}</td><td className="amount-cell expense-text" style={{textAlign:'right',fontSize:'0.8rem'}}>{m.expense>0?fmt(m.expense):'—'}</td><td className="amount-cell" style={{textAlign:'right',fontSize:'0.8rem',color:m.net>=0?'var(--success)':'var(--danger)'}}>{fmt(m.net)}</td></tr>)}
                        <tr style={{borderTop:'1px solid var(--border2)',fontWeight:600}}><td>Total</td><td className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(rRentM.reduce((s,m)=>s+m.income,0))}</td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(rRentM.reduce((s,m)=>s+m.expense,0))}</td><td className="amount-cell" style={{textAlign:'right',color:'var(--accent)'}}>{fmt(rRentM.reduce((s,m)=>s+m.net,0))}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="card" style={{borderLeft:'3px solid var(--warn)',padding:0}}>
                    <div style={{padding:'14px 16px 4px',fontWeight:700}}>🔧 Home Maintenance</div>
                    <div style={{padding:'0 16px 10px',fontSize:'0.75rem',color:'var(--muted)'}}>Expense-only · Total: <strong style={{color:'var(--danger)'}}>{fmt(rHomeTotal)}</strong></div>
                    <table>
                      <thead><tr><th>Month</th><th style={{textAlign:'right'}}>Expenses</th></tr></thead>
                      <tbody>
                        {rHomeM.map(m=><tr key={m.month}><td style={{fontSize:'0.8rem'}}>{m.label}</td><td className="amount-cell expense-text" style={{textAlign:'right',fontSize:'0.8rem'}}>{m.expense>0?fmt(m.expense):'—'}</td></tr>)}
                        <tr style={{borderTop:'1px solid var(--border2)',fontWeight:600}}><td>Total</td><td className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(rHomeTotal)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>}
          </div>
        )}

        {/* ══════════════════ YOY ══════════════════ */}
        {mainTab==='yoy'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
              <div style={{fontSize:'0.85rem',color:'var(--muted)'}}>Comparing {LOAD_YEARS.join(', ')}</div>
              <div style={{display:'flex',gap:6}}>
                {[['all','All'],['tea','Tea'],['rental','Rentals'],['homes','Homes']].map(([k,v])=>(
                  <button key={k} className={`btn btn-sm ${yoySegment===k?'btn-primary':'btn-ghost'}`} onClick={()=>setYoySegment(k)}>{v}</button>
                ))}
              </div>
            </div>
            {yoyLoading&&<div style={{padding:40,color:'var(--muted)'}}>Loading YOY data…</div>}
            {!yoyLoading&&<>
              {/* Annual KPI cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
                {yoyRows.map((row,idx)=>{
                  const prev=idx>0?yoyRows[idx-1]:null;
                  const di=prev?delta(row.income,prev.income):null;
                  const dn=prev?delta(row.net,prev.net):null;
                  return(
                    <div key={row.year} className="card" style={{borderTop:`3px solid ${YOY_COLORS[idx]}`}}>
                      <div className="stat-label" style={{color:YOY_COLORS[idx]}}>{row.year}</div>
                      <div className="stat-value" style={{marginTop:8,color:row.net>=0?'var(--success)':'var(--danger)'}}>{fmt(row.net)}</div>
                      <div style={{marginTop:8,display:'flex',gap:16,fontSize:'0.8rem'}}>
                        <span className="income-text">↑ {fmt(row.income)}</span>
                        <span className="expense-text">↓ {fmt(row.expense)}</span>
                      </div>
                      {(di||dn)&&<div style={{marginTop:8,fontSize:'0.78rem',display:'flex',gap:12,flexWrap:'wrap'}}>
                        {di&&<span style={{color:di.up?'var(--success)':'var(--danger)'}}>{di.up?'▲':'▼'} {Math.abs(di.pct)}% rev</span>}
                        {dn&&<span style={{color:dn.up?'var(--success)':'var(--danger)'}}>{dn.up?'▲':'▼'} {Math.abs(dn.pct)}% net</span>}
                      </div>}
                      {yoySegment==='all'&&yoyData[row.year]&&(
                        <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid var(--border)',fontSize:'0.75rem',display:'flex',flexDirection:'column',gap:3}}>
                          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--tea-light)'}}>🍃 Tea</span><span>{fmt((yoyData[row.year].teaIncome||0)-(yoyData[row.year].teaExpense||0))}</span></div>
                          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--rental-light)'}}>🏠 Rentals</span><span>{fmt((yoyData[row.year].rentIncome||0)-(yoyData[row.year].rentExpense||0))}</span></div>
                          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--warn)'}}>🔧 Homes</span><span style={{color:'var(--danger)'}}>-{fmt(yoyData[row.year].homeTotal||0)}</span></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Monthly Revenue chart */}
              <div className="card" style={{marginBottom:20}}>
                <div className="section-title">Monthly Revenue — YOY Comparison</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={yoyMonthly} barCategoryGap="25%">
                    <XAxis dataKey="name" tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:8}} labelStyle={{color:'var(--muted)',fontSize:'0.8rem'}}/>
                    <Legend wrapperStyle={{fontSize:'0.78rem',color:'var(--muted)'}}/>
                    {LOAD_YEARS.map((y,i)=><Bar key={y} dataKey={`${y} Revenue`} fill={YOY_COLORS[i]} radius={[3,3,0,0]} opacity={i===LOAD_YEARS.length-1?1:0.6}/>)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Monthly Net line */}
              <div className="card" style={{marginBottom:20}}>
                <div className="section-title">Monthly Net Surplus — YOY</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={yoyMonthly}>
                    <XAxis dataKey="name" tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{background:'var(--surface2)',border:'1px solid var(--border2)',borderRadius:8}} labelStyle={{color:'var(--muted)',fontSize:'0.8rem'}}/>
                    <Legend wrapperStyle={{fontSize:'0.78rem'}}/>
                    {LOAD_YEARS.map((y,i)=><Line key={y} type="monotone" dataKey={`${y} Net`} stroke={YOY_COLORS[i]} strokeWidth={2} dot={false}/>)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Summary table */}
              <div className="card" style={{padding:0}}>
                <div style={{padding:'16px 20px 0',fontWeight:600,fontSize:'1rem'}}>Annual Summary</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Metric</th>{LOAD_YEARS.map(y=><th key={y} style={{textAlign:'right'}}>{y}</th>)}<th style={{textAlign:'right'}}>YOY Change</th></tr></thead>
                    <tbody>
                      {(yoySegment==='all'||yoySegment==='tea')&&<>
                        <tr style={{background:'rgba(74,124,89,0.05)'}}><td colSpan={5} style={{fontWeight:600,color:'var(--tea-light)',fontSize:'0.78rem',paddingTop:10}}>🍃 Tea Plantation</td></tr>
                        {/* Revenue */}
                        {(()=>{
                          const last=yoyData[LOAD_YEARS[LOAD_YEARS.length-1]]?.teaIncome;
                          const prev=yoyData[LOAD_YEARS[LOAD_YEARS.length-2]]?.teaIncome;
                          const dl=prev?delta(last,prev):null;
                          return<tr><td style={{paddingLeft:20,color:'var(--muted)'}}>Revenue</td>{LOAD_YEARS.map(y=><td key={y} className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(yoyData[y]?.teaIncome||0)}</td>)}<td style={{textAlign:'right'}}>{dl?<span style={{color:dl.up?'var(--success)':'var(--danger)',fontWeight:600}}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—'}</td></tr>;
                        })()}
                        {/* Wages */}
                        {(()=>{
                          const last=yoyData[LOAD_YEARS[LOAD_YEARS.length-1]]?.teaWages;
                          const prev=yoyData[LOAD_YEARS[LOAD_YEARS.length-2]]?.teaWages;
                          const dl=prev?delta(last,prev):null;
                          return<tr><td style={{paddingLeft:20,color:'var(--muted)'}}>Labour (Wages)</td>{LOAD_YEARS.map(y=><td key={y} className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(yoyData[y]?.teaWages||0)}</td>)}<td style={{textAlign:'right'}}>{dl?<span style={{color:dl.up?'var(--success)':'var(--danger)',fontWeight:600}}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—'}</td></tr>;
                        })()}
                        {/* Each maintenance task across years */}
                        {[...new Set(LOAD_YEARS.flatMap(y=>Object.keys(yoyData[y]?.maintTasks||{})))].map(task=>{
                          const last=yoyData[LOAD_YEARS[LOAD_YEARS.length-1]]?.maintTasks?.[task]||0;
                          const prev=yoyData[LOAD_YEARS[LOAD_YEARS.length-2]]?.maintTasks?.[task]||0;
                          const dl=prev?delta(last,prev):null;
                          return<tr key={task}><td style={{paddingLeft:20,color:'var(--muted)'}}>{task}</td>{LOAD_YEARS.map(y=><td key={y} className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(yoyData[y]?.maintTasks?.[task]||0)}</td>)}<td style={{textAlign:'right'}}>{dl?<span style={{color:dl.up?'var(--success)':'var(--danger)',fontWeight:600}}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—'}</td></tr>;
                        })}
                      </>}
                      {(yoySegment==='all'||yoySegment==='rental')&&<>
                        <tr style={{background:'rgba(74,111,165,0.05)'}}><td colSpan={5} style={{fontWeight:600,color:'var(--rental-light)',fontSize:'0.78rem',paddingTop:10}}>🏠 Rental Homes</td></tr>
                        {[{l:'Revenue',k:'rentIncome',c:'income-text'},{l:'Expenses',k:'rentExpense',c:'expense-text'}].map(row=>{
                          const last=yoyData[LOAD_YEARS[LOAD_YEARS.length-1]]?.[row.k];
                          const prev=yoyData[LOAD_YEARS[LOAD_YEARS.length-2]]?.[row.k];
                          const dl=prev?delta(last,prev):null;
                          return<tr key={row.l}><td style={{paddingLeft:20,color:'var(--muted)'}}>{row.l}</td>{LOAD_YEARS.map(y=><td key={y} className={`amount-cell ${row.c}`} style={{textAlign:'right'}}>{fmt(yoyData[y]?.[row.k]||0)}</td>)}<td style={{textAlign:'right'}}>{dl?<span style={{color:dl.up?'var(--success)':'var(--danger)',fontWeight:600}}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—'}</td></tr>;
                        })}
                      </>}
                      {(yoySegment==='all'||yoySegment==='homes')&&<>
                        <tr style={{background:'rgba(224,146,74,0.05)'}}><td colSpan={5} style={{fontWeight:600,color:'var(--warn)',fontSize:'0.78rem',paddingTop:10}}>🔧 Home Maintenance</td></tr>
                        <tr><td style={{paddingLeft:20,color:'var(--muted)'}}>Total Spent</td>{LOAD_YEARS.map(y=><td key={y} className="amount-cell expense-text" style={{textAlign:'right'}}>{fmt(yoyData[y]?.homeTotal||0)}</td>)}<td style={{textAlign:'right'}}>{(()=>{const last=yoyData[LOAD_YEARS[LOAD_YEARS.length-1]]?.homeTotal,prev=yoyData[LOAD_YEARS[LOAD_YEARS.length-2]]?.homeTotal,dl=prev?delta(last,prev):null;return dl?<span style={{color:dl.up?'var(--danger)':'var(--success)',fontWeight:600}}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—';})()}</td></tr>
                      </>}
                      <tr style={{borderTop:'2px solid var(--border2)',fontWeight:700}}>
                        <td>Total Revenue</td>{yoyRows.map(r=><td key={r.year} className="amount-cell income-text" style={{textAlign:'right'}}>{fmt(r.income)}</td>)}<td style={{textAlign:'right'}}>{(()=>{const dl=yoyRows.length>1?delta(yoyRows[yoyRows.length-1].income,yoyRows[yoyRows.length-2].income):null;return dl?<span style={{color:dl.up?'var(--success)':'var(--danger)',fontWeight:600}}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—';})()}</td>
                      </tr>
                      <tr style={{fontWeight:700}}><td>Net Surplus</td>{yoyRows.map(r=><td key={r.year} className="amount-cell" style={{textAlign:'right',color:r.net>=0?'var(--success)':'var(--danger)'}}>{fmt(r.net)}</td>)}<td style={{textAlign:'right'}}>{(()=>{const dl=yoyRows.length>1?delta(yoyRows[yoyRows.length-1].net,yoyRows[yoyRows.length-2].net):null;return dl?<span style={{color:dl.up?'var(--success)':'var(--danger)',fontWeight:600}}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—';})()}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>}
          </div>
        )}
      </div>
    </div>
  );
}
