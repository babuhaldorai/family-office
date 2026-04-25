// RentalYOY.js — Year-over-Year comparison for Rental Homes
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

const CUR   = new Date().getFullYear();
const YEARS = [CUR - 2, CUR - 1, CUR];
const COLORS = ['var(--muted)', 'var(--tea-light)', 'var(--accent)'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}

async function loadRentalYear(year) {
  try {
    // db and firestore imported statically at top
    const snap = await getDocs(query(collection(db, 'rental_transactions'), where('year', '==', year)));
    const txs  = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const income  = txs.filter(t => t.type === 'income').reduce((s, t)  => s + Number(t.amount), 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    // Category breakdown
    const incCats  = {};
    const expCats  = {};
    txs.filter(t => t.type === 'income').forEach(t  => { incCats[t.category  || 'Other'] = (incCats[t.category  || 'Other'] || 0) + Number(t.amount); });
    txs.filter(t => t.type === 'expense').forEach(t => { expCats[t.category || 'Other'] = (expCats[t.category || 'Other'] || 0) + Number(t.amount); });

    // Monthly
    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i+1, income: 0, expense: 0 }));
    txs.forEach(t => {
      const m = t.month || (t.date ? new Date(t.date).getMonth() + 1 : null);
      if (m) {
        if (t.type === 'income')  monthly[m-1].income  += Number(t.amount);
        else                      monthly[m-1].expense += Number(t.amount);
      }
    });

    return { year, income, expense, net: income - expense, incCats, expCats, monthly, count: txs.length };
  } catch (e) {
    console.error('RentalYOY load error:', e);
    return { year, income: 0, expense: 0, net: 0, incCats: {}, expCats: {}, monthly: Array.from({ length: 12 }, (_, i) => ({ month: i+1, income: 0, expense: 0 })), count: 0 };
  }
}

export default function RentalYOY() {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all(YEARS.map(loadRentalYear)).then(results => {
      setData(results); setLoading(false);
    });
  }, []);

  const delta = (curr, prev) => {
    if (!prev || prev === 0) return null;
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 };
  };

  const monthlyChart = useMemo(() => MONTHS.map((label, i) => {
    const row = { name: label };
    data.forEach(d => {
      row[`${d.year} Revenue`] = Math.round(d.monthly[i].income);
      row[`${d.year} Net`]     = Math.round(d.monthly[i].income - d.monthly[i].expense);
    });
    return row;
  }), [data]);

  const annualChart = data.map(d => ({
    year: String(d.year), Revenue: Math.round(d.income), Expenses: Math.round(d.expense), Net: Math.round(d.net),
  }));

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading YOY data…</div>;

  return (
    <div>
      {/* Annual KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {data.map((d, idx) => {
          const prev = idx > 0 ? data[idx - 1] : null;
          const di   = prev ? delta(d.income, prev.income) : null;
          const dn   = prev ? delta(d.net,    prev.net)    : null;
          return (
            <div key={d.year} className="card" style={{ borderTop: `3px solid ${COLORS[idx]}` }}>
              <div className="stat-label" style={{ color: COLORS[idx] }}>{d.year}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                {[
                  { l: 'Revenue',  v: fmt(d.income),  cls: 'income-text' },
                  { l: 'Expenses', v: fmt(d.expense), cls: 'expense-text' },
                  { l: 'Net',      v: fmt(d.net),     cls: d.net >= 0 ? 'income-text' : 'expense-text' },
                ].map(s => (
                  <div key={s.l}>
                    <div className="stat-label">{s.l}</div>
                    <div className={`amount-cell ${s.cls}`} style={{ fontSize: '0.9rem' }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: 10 }}>
                <span>{d.count} entries</span>
                {di && <span style={{ color: di.up ? 'var(--success)' : 'var(--danger)' }}>{di.up ? '▲' : '▼'} {di.pct}% revenue</span>}
                {dn && <span style={{ color: dn.up ? 'var(--success)' : 'var(--danger)' }}>{dn.up ? '▲' : '▼'} {dn.pct}% net</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Annual bar chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Annual Revenue vs Expenses</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={annualChart}>
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
            <Bar dataKey="Revenue"  fill="var(--success)" radius={[3,3,0,0]} />
            <Bar dataKey="Expenses" fill="var(--danger)"  radius={[3,3,0,0]} />
            <Bar dataKey="Net"      fill="var(--accent)"  radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly trend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Monthly Revenue — Year-over-Year</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyChart}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
            {data.map((d, i) => (
              <Line key={d.year} type="monotone" dataKey={`${d.year} Revenue`} stroke={COLORS[i]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px 0', fontSize: '1rem', fontWeight: 600 }}>Annual Summary</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {data.map(d => <th key={d.year} style={{ textAlign: 'right' }}>{d.year}</th>)}
                <th style={{ textAlign: 'right' }}>YOY Change</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Total Revenue',  key: 'income',  cls: 'income-text' },
                { label: 'Total Expenses', key: 'expense', cls: 'expense-text' },
                { label: 'Net Income',     key: 'net',     cls: 'net-text' },
                { label: 'Transactions',   key: 'count',   cls: '', raw: true },
                { label: 'Net Margin',     key: 'margin',  cls: '', computed: d => d.income > 0 ? ((d.net / d.income) * 100).toFixed(1) + '%' : '—' },
              ].map(row => {
                const last = data[data.length - 1];
                const prev = data[data.length - 2];
                const d    = (!row.computed && !row.raw && prev) ? delta(last?.[row.key], prev?.[row.key]) : null;
                return (
                  <tr key={row.label}>
                    <td style={{ fontWeight: 500 }}>{row.label}</td>
                    {data.map(yr => (
                      <td key={yr.year} className={row.cls} style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                        {row.computed ? row.computed(yr) : row.raw ? yr[row.key] : fmt(yr[row.key])}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right' }}>
                      {d ? <span style={{ color: d.up ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{d.up ? '▲' : '▼'} {d.pct}%</span> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense category breakdown across years */}
      {data.some(d => Object.keys(d.expCats).length > 0) && (
        <div className="card" style={{ padding: 0, marginTop: 20 }}>
          <div style={{ padding: '14px 20px 0', fontSize: '1rem', fontWeight: 600 }}>Expense Categories by Year</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Category</th>{data.map(d => <th key={d.year} style={{ textAlign: 'right' }}>{d.year}</th>)}</tr>
              </thead>
              <tbody>
                {[...new Set(data.flatMap(d => Object.keys(d.expCats)))].map(cat => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    {data.map(d => (
                      <td key={d.year} className="amount-cell expense-text" style={{ textAlign: 'right' }}>
                        {d.expCats[cat] ? fmt(d.expCats[cat]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
