// TeaYOY.js — Year-over-Year comparison for Tea Plantation
// Imported and rendered as a tab inside TeaPage
import React, { useEffect, useState, useMemo } from 'react';
import { inr } from '../../utils/chaayaService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

const CUR   = new Date().getFullYear();
const YEARS = [CUR - 2, CUR - 1, CUR];
const COLORS = ['var(--muted)', 'var(--rental-light)', 'var(--accent)'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function loadTeaYear(year) {
  try {
    const { getDocs, query, collection, where } = await import('firebase/firestore');
    const { db } = await import('../../firebase');
    const [hSnap, mSnap] = await Promise.all([
      getDocs(query(collection(db, 'tea_harvest'), where('year', '==', year))),
      getDocs(query(collection(db, 'tea_maintenance'), where('year', '==', year))),
    ]);
    const harvest  = hSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const maintain = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const income  = harvest.reduce((s, h) => s + (h.agentRev  || 0), 0);
    const wages   = harvest.reduce((s, h) => s + (h.workerPay || 0), 0);
    const maint   = maintain.reduce((s, m) => s + (m.cost     || 0), 0);
    const expense = wages + maint;
    const totalKg = harvest.reduce((s, h) => s + (h.tNet      || 0), 0);
    const sessions = harvest.length;

    // Monthly breakdown
    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
    harvest.forEach(h => {
      const m = h.month || (h.date ? new Date(h.date).getMonth() + 1 : null);
      if (m) { monthly[m-1].income += h.agentRev || 0; monthly[m-1].expense += h.workerPay || 0; }
    });
    maintain.forEach(m => {
      const mo = m.month || (m.date ? new Date(m.date).getMonth() + 1 : null);
      if (mo) monthly[mo-1].expense += m.cost || 0;
    });

    return { year, income, expense, net: income - expense, wages, maint, totalKg, sessions, monthly };
  } catch (e) {
    console.error('TeaYOY load error:', e);
    return { year, income: 0, expense: 0, net: 0, wages: 0, maint: 0, totalKg: 0, sessions: 0, monthly: Array.from({ length: 12 }, (_, i) => ({ month: i+1, income: 0, expense: 0 })) };
  }
}

export default function TeaYOY() {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all(YEARS.map(loadTeaYear)).then(results => {
      setData(results);
      setLoading(false);
    });
  }, []);

  const delta = (curr, prev) => {
    if (!prev || prev === 0) return null;
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 };
  };

  // Monthly chart data
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
                  { l: 'Revenue',  v: inr(d.income),  cls: 'income-text' },
                  { l: 'Expenses', v: inr(d.expense), cls: 'expense-text' },
                  { l: 'Net',      v: inr(d.net),     cls: d.net >= 0 ? 'income-text' : 'expense-text' },
                ].map(s => (
                  <div key={s.l}>
                    <div className="stat-label">{s.l}</div>
                    <div className={`amount-cell ${s.cls}`} style={{ fontSize: '0.9rem' }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>{d.sessions} sessions · {d.totalKg.toFixed(0)} kg</span>
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
            <Tooltip formatter={(v, n) => [inr(v), n]} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
            <Bar dataKey="Revenue"  fill="var(--success)" radius={[3,3,0,0]} />
            <Bar dataKey="Expenses" fill="var(--danger)"  radius={[3,3,0,0]} />
            <Bar dataKey="Net"      fill="var(--accent)"  radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly revenue trend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Monthly Revenue — Year-over-Year</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyChart}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [inr(v), n]} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
            {data.map((d, i) => (
              <Line key={d.year} type="monotone" dataKey={`${d.year} Revenue`} stroke={COLORS[i]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px 0', fontSize: '1rem', fontWeight: 600 }}>Annual Summary Table</div>
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
                { label: 'Revenue',        key: 'income',   cls: 'income-text' },
                { label: 'Worker Wages',   key: 'wages',    cls: 'expense-text' },
                { label: 'Maintenance',    key: 'maint',    cls: 'expense-text' },
                { label: 'Total Expenses', key: 'expense',  cls: 'expense-text' },
                { label: 'Net Profit',     key: 'net',      cls: 'net-text' },
                { label: 'Total Net Kg',   key: 'totalKg',  cls: '', isFmt: false },
                { label: 'Sessions',       key: 'sessions', cls: '', isFmt: false },
              ].map(row => {
                const last = data[data.length - 1];
                const prev = data[data.length - 2];
                const d    = prev ? delta(last?.[row.key], prev?.[row.key]) : null;
                return (
                  <tr key={row.label}>
                    <td style={{ fontWeight: 500 }}>{row.label}</td>
                    {data.map(yr => (
                      <td key={yr.year} className={row.cls} style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                        {row.isFmt === false
                          ? (row.key === 'totalKg' ? yr[row.key].toFixed(1) + ' kg' : yr[row.key])
                          : inr(yr[row.key])}
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
    </div>
  );
}
