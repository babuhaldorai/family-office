import React, { useEffect, useState, useMemo } from 'react';
import { useMobile } from '../hooks/useMobile';
import { homeExpenseService } from '../utils/homeService';
import { fmt } from '../utils/finance';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

const CUR    = new Date().getFullYear();
const YEARS  = [CUR - 2, CUR - 1, CUR];
const COLORS = ['var(--muted)', 'var(--rental-light)', 'var(--accent)'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function HomeYOY() {
  const isMobile  = useMobile();
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all(YEARS.map(async y => {
      const expenses = await homeExpenseService.getByYear(y);
      const total    = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const count    = expenses.length;

      // Per-category breakdown
      const cats = {};
      expenses.forEach(e => {
        const k = e.category || 'Other';
        cats[k] = (cats[k] || 0) + Number(e.amount || 0);
      });

      // Monthly breakdown
      const monthly = Array.from({ length: 12 }, () => 0);
      expenses.forEach(e => {
        const m = (e.month || (e.date ? new Date(e.date).getMonth() + 1 : 1)) - 1;
        if (m >= 0 && m < 12) monthly[m] += Number(e.amount || 0);
      });

      return [y, { total, count, cats, monthly }];
    })).then(entries => {
      setData(Object.fromEntries(entries));
      setLoading(false);
    });
  }, []);

  const delta = (curr, prev) => {
    if (!prev || prev === 0) return null;
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 };
  };

  const monthlyChart = useMemo(() => MONTHS.map((label, i) => {
    const row = { name: label };
    YEARS.forEach(y => { row[String(y)] = Math.round(data[y]?.monthly?.[i] || 0); });
    return row;
  }), [data]);

  const annualChart = YEARS.map(y => ({
    year: String(y), Expenses: Math.round(data[y]?.total || 0),
  }));

  // All category keys across all years
  const allCats = [...new Set(YEARS.flatMap(y => Object.keys(data[y]?.cats || {})))];

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading…</div>;

  return (
    <div>
      {/* Annual KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr', gap:isMobile?12:16, marginBottom:24 }}>
        {YEARS.map((y, idx) => {
          const d    = data[y] || {};
          const prev = idx > 0 ? data[YEARS[idx - 1]] : null;
          const dl   = prev ? delta(d.total, prev.total) : null;
          return (
            <div key={y} className="card" style={{ borderTop: `3px solid ${COLORS[idx]}` }}>
              <div className="stat-label" style={{ color: COLORS[idx] }}>{y}</div>
              <div className="stat-value expense-text" style={{ marginTop: 8 }}>{fmt(d.total || 0)}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 6 }}>
                {d.count || 0} expense entries
              </div>
              {dl && (
                <div style={{ marginTop: 8, fontSize: '0.78rem', color: dl.up ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                  {dl.up ? '▲' : '▼'} {dl.pct}% vs {y - 1}
                </div>
              )}
              {/* Top categories */}
              {Object.keys(d.cats || {}).length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {Object.entries(d.cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, amt]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>{cat}</span>
                      <span style={{ color: 'var(--danger)' }}>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Annual bar chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Annual Spend — YOY</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={annualChart}>
            <XAxis dataKey="year" tick={{ fontSize:12, fill:'var(--muted)' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize:11, fill:'var(--muted)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8 }} />
            <Bar dataKey="Expenses" fill="var(--warn)" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly trend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Monthly Spend — YOY Comparison</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyChart}>
            <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--muted)' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize:11, fill:'var(--muted)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8 }} />
            <Legend wrapperStyle={{ fontSize:'0.78rem' }} />
            {YEARS.map((y, i) => (
              <Line key={y} type="monotone" dataKey={String(y)} stroke={COLORS[i]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding:'14px 20px 0', fontWeight:600, fontSize:'1rem' }}>Annual Summary</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {YEARS.map(y => <th key={y} style={{ textAlign:'right' }}>{y}</th>)}
                <th style={{ textAlign:'right' }}>YOY Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight:500 }}>Total Spent</td>
                {YEARS.map(y => <td key={y} className="amount-cell expense-text" style={{ textAlign:'right' }}>{fmt(data[y]?.total || 0)}</td>)}
                <td style={{ textAlign:'right' }}>{(() => {
                  const last = data[YEARS[YEARS.length-1]]?.total;
                  const prev = data[YEARS[YEARS.length-2]]?.total;
                  const dl = prev ? delta(last, prev) : null;
                  return dl ? <span style={{ color:dl.up?'var(--danger)':'var(--success)', fontWeight:600 }}>{dl.up?'▲':'▼'} {dl.pct}%</span> : '—';
                })()}</td>
              </tr>
              <tr>
                <td style={{ color:'var(--muted)' }}>Entries</td>
                {YEARS.map(y => <td key={y} style={{ textAlign:'right', color:'var(--muted)' }}>{data[y]?.count || 0}</td>)}
                <td></td>
              </tr>
              {/* Per category rows */}
              {allCats.map(cat => (
                <tr key={cat}>
                  <td style={{ paddingLeft:16, color:'var(--muted)' }}>{cat}</td>
                  {YEARS.map(y => (
                    <td key={y} className="amount-cell expense-text" style={{ textAlign:'right' }}>
                      {data[y]?.cats?.[cat] ? fmt(data[y].cats[cat]) : '—'}
                    </td>
                  ))}
                  <td style={{ textAlign:'right' }}>{(() => {
                    const last = data[YEARS[YEARS.length-1]]?.cats?.[cat];
                    const prev = data[YEARS[YEARS.length-2]]?.cats?.[cat];
                    const dl = prev ? delta(last, prev) : null;
                    return dl ? <span style={{ color:dl.up?'var(--danger)':'var(--success)', fontWeight:600 }}>{dl.up?'▲':'▼'} {dl.pct}%</span> : '—';
                  })()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
