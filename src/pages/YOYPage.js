import { db } from '../firebase';
import { getDocs, query, collection, where } from 'firebase/firestore';
import React, { useEffect, useState, useMemo } from 'react';
import { rentalService } from '../utils/firestoreService';
import { homeExpenseService } from '../utils/homeService';
import { fmt, MONTHS } from '../utils/finance';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

const CURRENT    = new Date().getFullYear();
const LOAD_YEARS = [CURRENT - 2, CURRENT - 1, CURRENT];
const COLORS     = ['var(--muted)', 'var(--rental-light)', 'var(--accent)'];

// Custom tooltip showing segment breakdown on hover
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 16px', fontSize: 12.5, minWidth: 180, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
          <span style={{ color: p.color || 'var(--muted)' }}>{p.dataKey}</span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmt(p.value)}</span>
        </div>
      ))}
      {/* Segment breakdown if available */}
      {payload[0]?.payload?.teaRevenue !== undefined && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4 }}>Breakdown:</div>
          {payload[0].payload.teaRevenue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--tea-light)', fontSize: 11.5 }}>
              <span>🍃 Tea</span><span>{fmt(payload[0].payload.teaRevenue)}</span>
            </div>
          )}
          {payload[0].payload.rentRevenue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--rental-light)', fontSize: 11.5 }}>
              <span>🏠 Rentals</span><span>{fmt(payload[0].payload.rentRevenue)}</span>
            </div>
          )}
          {payload[0].payload.homeExp > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--warn)', fontSize: 11.5 }}>
              <span>🔧 Home Maint.</span><span>-{fmt(payload[0].payload.homeExp)}</span>
            </div>
          )}
          {payload[0].payload.teaExp > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--danger)', fontSize: 11.5 }}>
              <span>Labour+Maint.</span><span>-{fmt(payload[0].payload.teaExp)}</span>
            </div>
          )}
          {payload[0].payload.rentExp > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--danger)', fontSize: 11.5 }}>
              <span>Rental costs</span><span>-{fmt(payload[0].payload.rentExp)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function YOYPage() {
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all(
      LOAD_YEARS.map(async y => {
        const [rentTx, homeExp, harvest, maintenance] = await Promise.all([
          rentalService.getTransactions(y),
          homeExpenseService.getByYear(y),
          getDocs(query(collection(db, 'tea_harvest'), where('year', '==', y)))
            .then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => []),
          getDocs(query(collection(db, 'tea_maintenance'), where('year', '==', y)))
            .then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => []),
        ]);

        const rentIncome  = rentTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const rentExpense = rentTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const teaIncome   = harvest.reduce((s, h) => s + (h.agentRev  || 0), 0);
        const teaWages    = harvest.reduce((s, h) => s + (h.workerPay || 0), 0);
        const teaMaint    = maintenance.reduce((s, m) => s + (m.cost  || 0), 0);
        const teaExpense  = teaWages + teaMaint;
        const homeTotal   = homeExp.reduce((s, e) => s + Number(e.amount || 0), 0);

        // Monthly breakdown — real data per month
        const monthly = Array.from({ length: 12 }, (_, i) => ({
          teaInc: 0, teaExp: 0, rentInc: 0, rentExp: 0, homeExp: 0,
        }));
        harvest.forEach(h => {
          const m = (h.month || 1) - 1;
          if (m >= 0 && m < 12) { monthly[m].teaInc += h.agentRev || 0; monthly[m].teaExp += h.workerPay || 0; }
        });
        maintenance.forEach(m => {
          const mo = (m.month || 1) - 1;
          if (mo >= 0 && mo < 12) monthly[mo].teaExp += m.cost || 0;
        });
        rentTx.forEach(t => {
          const m = (t.month || 1) - 1;
          if (m >= 0 && m < 12) {
            if (t.type === 'income')  monthly[m].rentInc += Number(t.amount);
            else                      monthly[m].rentExp += Number(t.amount);
          }
        });
        homeExp.forEach(e => {
          const m = (e.month || 1) - 1;
          if (m >= 0 && m < 12) monthly[m].homeExp += Number(e.amount || 0);
        });

        return [y, { rentIncome, rentExpense, teaIncome, teaExpense, teaWages, teaMaint, homeTotal, monthly }];
      })
    ).then(entries => {
      setData(Object.fromEntries(entries));
      setLoading(false);
    });
  }, []);

  const yoyRows = useMemo(() => LOAD_YEARS.map(y => {
    const d = data[y] || {};
    let income = 0, expense = 0;
    if (segment === 'all' || segment === 'tea')    { income += d.teaIncome || 0;  expense += d.teaExpense || 0; }
    if (segment === 'all' || segment === 'rental') { income += d.rentIncome || 0; expense += d.rentExpense || 0; }
    if (segment === 'all' || segment === 'homes')  { expense += d.homeTotal || 0; }
    return { year: y, income, expense, net: income - expense };
  }), [data, segment]);

  // Real monthly chart — actual data per month, not /12
  const monthlyChart = useMemo(() => MONTHS.map((label, i) => {
    const row = { name: label };
    LOAD_YEARS.forEach(y => {
      const d  = data[y] || {};
      const mo = d.monthly?.[i] || {};
      let inc = 0, exp = 0;
      let teaRevenue = 0, rentRevenue = 0, teaExp = 0, rentExp = 0, homeExpAmt = 0;
      if (segment === 'all' || segment === 'tea') {
        teaRevenue = mo.teaInc || 0; teaExp = mo.teaExp || 0;
        inc += teaRevenue; exp += teaExp;
      }
      if (segment === 'all' || segment === 'rental') {
        rentRevenue = mo.rentInc || 0; rentExp = mo.rentExp || 0;
        inc += rentRevenue; exp += rentExp;
      }
      if (segment === 'all' || segment === 'homes') {
        homeExpAmt = mo.homeExp || 0; exp += homeExpAmt;
      }
      row[`${y} Revenue`] = Math.round(inc);
      row[`${y} Net`]     = Math.round(inc - exp);
      // Store breakdown for tooltip (only for latest year to keep tooltip clean)
      if (y === CURRENT) {
        row.teaRevenue = teaRevenue;
        row.rentRevenue = rentRevenue;
        row.homeExp = homeExpAmt;
        row.teaExp = teaExp;
        row.rentExp = rentExp;
      }
    });
    return row;
  }), [data, segment]);

  const delta = (curr, prev) => {
    if (!prev || prev === 0) return null;
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { pct: pct.toFixed(1), up: pct >= 0 };
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Year-over-Year</h1>
          <p className="page-subtitle">Compare {LOAD_YEARS.join(', ')} performance</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all','All'],['tea','Tea'],['rental','Rentals'],['homes','Homes']].map(([k,v]) => (
            <button key={k} className={`btn btn-sm ${segment===k?'btn-primary':'btn-ghost'}`} onClick={() => setSegment(k)}>{v}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {/* Annual KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          {yoyRows.map((row, idx) => {
            const prev = idx > 0 ? yoyRows[idx - 1] : null;
            const d    = prev ? delta(row.net, prev.net) : null;
            const di   = prev ? delta(row.income, prev.income) : null;
            return (
              <div key={row.year} className="card" style={{ borderTop: `3px solid ${COLORS[idx]}` }}>
                <div className="stat-label" style={{ color: COLORS[idx] }}>{row.year}</div>
                <div className="stat-value" style={{ marginTop: 8, color: row.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(row.net)}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: '0.8rem' }}>
                  <span className="income-text">↑ {fmt(row.income)}</span>
                  <span className="expense-text">↓ {fmt(row.expense)}</span>
                </div>
                {(d || di) && (
                  <div style={{ marginTop: 8, fontSize: '0.78rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {di && <span style={{ color: di.up ? 'var(--success)' : 'var(--danger)' }}>{di.up?'▲':'▼'} {Math.abs(di.pct)}% revenue</span>}
                    {d  && <span style={{ color: d.up  ? 'var(--success)' : 'var(--danger)' }}>{d.up?'▲':'▼'} {Math.abs(d.pct)}% net</span>}
                  </div>
                )}
                {/* Segment breakdown */}
                {segment === 'all' && data[row.year] && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--tea-light)' }}>🍃 Tea</span><span>{fmt((data[row.year].teaIncome||0) - (data[row.year].teaExpense||0))}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--rental-light)' }}>🏠 Rentals</span><span>{fmt((data[row.year].rentIncome||0) - (data[row.year].rentExpense||0))}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--warn)' }}>🔧 Homes</span><span style={{ color: 'var(--danger)' }}>-{fmt(data[row.year].homeTotal||0)}</span></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Monthly Revenue — REAL data per month with breakdown on hover */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Monthly Revenue — YOY Comparison</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12 }}>
            Actual revenue per month · Hover bars for segment breakdown
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyChart} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.78rem', color: 'var(--muted)' }} />
              {LOAD_YEARS.map((y, i) => (
                <Bar key={y} dataKey={`${y} Revenue`} fill={COLORS[i]} radius={[3,3,0,0]} opacity={i === LOAD_YEARS.length - 1 ? 1 : 0.6} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Net P&L — REAL data */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Monthly Net Surplus — YOY Comparison</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyChart}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
              {LOAD_YEARS.map((y, i) => (
                <Line key={y} type="monotone" dataKey={`${y} Net`} stroke={COLORS[i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Annual summary table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px 0', fontSize: '1rem', fontWeight: 600 }}>Annual Summary</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  {LOAD_YEARS.map(y => <th key={y} style={{ textAlign: 'right' }}>{y}</th>)}
                  <th style={{ textAlign: 'right' }}>YOY Change</th>
                </tr>
              </thead>
              <tbody>
                {/* Tea rows */}
                {(segment === 'all' || segment === 'tea') && <>
                  <tr style={{ background: 'rgba(74,124,89,0.05)' }}>
                    <td colSpan={5} style={{ fontWeight: 600, color: 'var(--tea-light)', fontSize: '0.78rem', paddingTop: 10 }}>🍃 Tea Plantation</td>
                  </tr>
                  {[
                    { label: 'Revenue', key: 'teaIncome', cls: 'income-text' },
                    { label: 'Labour', key: 'teaWages', cls: 'expense-text' },
                    { label: 'Maintenance', key: 'teaMaint', cls: 'expense-text' },
                  ].map(row => {
                    const d = data[LOAD_YEARS[LOAD_YEARS.length-1]]?.[row.key];
                    const p = data[LOAD_YEARS[LOAD_YEARS.length-2]]?.[row.key];
                    const dl = p ? delta(d, p) : null;
                    return (
                      <tr key={row.label}>
                        <td style={{ paddingLeft: 20, color: 'var(--muted)' }}>{row.label}</td>
                        {LOAD_YEARS.map(y => <td key={y} className={`amount-cell ${row.cls}`} style={{ textAlign: 'right' }}>{fmt(data[y]?.[row.key] || 0)}</td>)}
                        <td style={{ textAlign: 'right' }}>{dl ? <span style={{ color: dl.up?'var(--success)':'var(--danger)', fontWeight:600 }}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span> : '—'}</td>
                      </tr>
                    );
                  })}
                </>}
                {/* Rental rows */}
                {(segment === 'all' || segment === 'rental') && <>
                  <tr style={{ background: 'rgba(74,111,165,0.05)' }}>
                    <td colSpan={5} style={{ fontWeight: 600, color: 'var(--rental-light)', fontSize: '0.78rem', paddingTop: 10 }}>🏠 Rental Homes</td>
                  </tr>
                  {[
                    { label: 'Revenue',  key: 'rentIncome',  cls: 'income-text' },
                    { label: 'Expenses', key: 'rentExpense', cls: 'expense-text' },
                  ].map(row => {
                    const d = data[LOAD_YEARS[LOAD_YEARS.length-1]]?.[row.key];
                    const p = data[LOAD_YEARS[LOAD_YEARS.length-2]]?.[row.key];
                    const dl = p ? delta(d, p) : null;
                    return (
                      <tr key={row.label}>
                        <td style={{ paddingLeft: 20, color: 'var(--muted)' }}>{row.label}</td>
                        {LOAD_YEARS.map(y => <td key={y} className={`amount-cell ${row.cls}`} style={{ textAlign: 'right' }}>{fmt(data[y]?.[row.key] || 0)}</td>)}
                        <td style={{ textAlign: 'right' }}>{dl ? <span style={{ color: dl.up?'var(--success)':'var(--danger)', fontWeight:600 }}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span> : '—'}</td>
                      </tr>
                    );
                  })}
                </>}
                {/* Home Maintenance */}
                {(segment === 'all' || segment === 'homes') && <>
                  <tr style={{ background: 'rgba(224,146,74,0.05)' }}>
                    <td colSpan={5} style={{ fontWeight: 600, color: 'var(--warn)', fontSize: '0.78rem', paddingTop: 10 }}>🔧 Home Maintenance</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: 20, color: 'var(--muted)' }}>Total Spent</td>
                    {LOAD_YEARS.map(y => <td key={y} className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(data[y]?.homeTotal || 0)}</td>)}
                    <td style={{ textAlign: 'right' }}>{(() => { const d = data[LOAD_YEARS[LOAD_YEARS.length-1]]?.homeTotal; const p = data[LOAD_YEARS[LOAD_YEARS.length-2]]?.homeTotal; const dl = p ? delta(d,p) : null; return dl ? <span style={{ color: dl.up?'var(--danger)':'var(--success)', fontWeight:600 }}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span> : '—'; })()}</td>
                  </tr>
                </>}
                {/* Totals */}
                <tr style={{ borderTop: '2px solid var(--border2)', fontWeight: 700 }}>
                  <td>Total Revenue</td>
                  {yoyRows.map(r => <td key={r.year} className="amount-cell income-text" style={{ textAlign: 'right' }}>{fmt(r.income)}</td>)}
                  <td style={{ textAlign: 'right' }}>{(() => { const dl = yoyRows.length>1?delta(yoyRows[yoyRows.length-1].income,yoyRows[yoyRows.length-2].income):null; return dl?<span style={{ color: dl.up?'var(--success)':'var(--danger)', fontWeight:600 }}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—'; })()}</td>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td>Total Expenses</td>
                  {yoyRows.map(r => <td key={r.year} className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(r.expense)}</td>)}
                  <td></td>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ color: 'var(--accent)' }}>Net Surplus</td>
                  {yoyRows.map(r => <td key={r.year} className="amount-cell" style={{ textAlign: 'right', color: r.net>=0?'var(--success)':'var(--danger)' }}>{fmt(r.net)}</td>)}
                  <td style={{ textAlign: 'right' }}>{(() => { const dl = yoyRows.length>1?delta(yoyRows[yoyRows.length-1].net,yoyRows[yoyRows.length-2].net):null; return dl?<span style={{ color: dl.up?'var(--success)':'var(--danger)', fontWeight:600 }}>{dl.up?'▲':'▼'} {Math.abs(dl.pct)}%</span>:'—'; })()}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--muted)', fontWeight: 500 }}>Net Margin</td>
                  {yoyRows.map(r => <td key={r.year} style={{ textAlign: 'right', color: 'var(--muted)', fontSize: '0.85rem' }}>{r.income>0?`${((r.net/r.income)*100).toFixed(1)}%`:'—'}</td>)}
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
