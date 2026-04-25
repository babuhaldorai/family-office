import React, { useEffect, useState, useMemo } from 'react';
import { rentalService } from '../utils/firestoreService';
import { homeExpenseService } from '../utils/homeService';
import { fmt, MONTHS } from '../utils/finance';
import {
  harvestChaayaService, ratesChaayaService,
  teaExpenseService as teaExpSvc, teaPaymentService as teaPaySvc,
  teaToTransactions,
} from '../utils/chaayaService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

const CURRENT    = new Date().getFullYear();
const LOAD_YEARS = [CURRENT - 2, CURRENT - 1, CURRENT];
const COLORS     = ['var(--muted)', 'var(--rental)', 'var(--accent)'];

// Sum tea revenue/expense from Chaaya harvest collection for a given year
async function loadTeaForYear(year) {
  const [harvSnap, ratesSnap, maintSnap] = await Promise.all([
    harvestChaayaService.getAllByYear ? harvestChaayaService.getAllByYear(year) : Promise.resolve([]),
    ratesChaayaService.getAll ? ratesChaayaService.getAll() : Promise.resolve([]),
    Promise.resolve([]),
  ]);
  const income  = harvSnap.reduce((s, h) => s + (h.agentRev  || 0), 0);
  const expense = harvSnap.reduce((s, h) => s + (h.workerPay || 0), 0);
  return { income, expense };
}

export default function YOYPage() {
  const [data, setData]     = useState({});
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all(
      LOAD_YEARS.map(async y => {
        const [rentTx, homeExp, harvest] = await Promise.all([
          rentalService.getTransactions(y),
          homeExpenseService.getByYear(y),
          // Load from tea_harvest collection directly
          (async () => {
            try {
              const { getDocs, query, collection, where } = await import('firebase/firestore');
              const { db } = await import('../firebase');
              const snap = await getDocs(query(collection(db, 'tea_harvest'), where('year', '==', y)));
              return snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch { return []; }
          })(),
        ]);

        const rentIncome  = rentTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const rentExpense = rentTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const teaIncome   = harvest.reduce((s, h) => s + (h.agentRev   || 0), 0);
        const teaExpense  = harvest.reduce((s, h) => s + (h.workerPay  || 0), 0);
        const homeTotal   = homeExp.reduce((s, e) => s + Number(e.amount || 0), 0);

        return [y, { rentIncome, rentExpense, teaIncome, teaExpense, homeTotal }];
      })
    ).then(entries => {
      setData(Object.fromEntries(entries));
      setLoading(false);
    });
  }, []);

  // Consolidated rows per year
  const yoyRows = useMemo(() => LOAD_YEARS.map(y => {
    const d = data[y] || {};
    let income = 0, expense = 0;
    if (segment === 'all' || segment === 'tea')    { income += d.teaIncome || 0;  expense += d.teaExpense || 0; }
    if (segment === 'all' || segment === 'rental') { income += d.rentIncome || 0; expense += d.rentExpense || 0; }
    if (segment === 'all' || segment === 'homes')  { expense += d.homeTotal || 0; }
    return { year: y, income, expense, net: income - expense };
  }), [data, segment]);

  // Monthly chart per year
  const monthlyChart = useMemo(() => MONTHS.map((label, i) => {
    const row = { name: label };
    LOAD_YEARS.forEach(y => {
      // We don't have monthly breakdown in YOY — show annual / 12 as approximation
      const d = data[y] || {};
      let inc = 0, exp = 0;
      if (segment === 'all' || segment === 'tea')    { inc += (d.teaIncome || 0) / 12;  exp += (d.teaExpense || 0) / 12; }
      if (segment === 'all' || segment === 'rental') { inc += (d.rentIncome || 0) / 12; exp += (d.rentExpense || 0) / 12; }
      if (segment === 'all' || segment === 'homes')  { exp += (d.homeTotal || 0) / 12; }
      row[`${y} Revenue`] = Math.round(inc);
      row[`${y} Net`]     = Math.round(inc - exp);
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
          {[['all', 'All'], ['tea', 'Tea'], ['rental', 'Rentals'], ['homes', 'Homes']].map(([k, v]) => (
            <button key={k} className={`btn btn-sm ${segment === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSegment(k)}>{v}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {/* Annual KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          {yoyRows.map((row, idx) => {
            const prev = idx > 0 ? yoyRows[idx - 1] : null;
            const d    = prev ? delta(row.net, prev.net) : null;
            return (
              <div key={row.year} className="card" style={{ borderTop: `3px solid ${COLORS[idx]}` }}>
                <div className="stat-label" style={{ color: COLORS[idx] }}>{row.year}</div>
                <div className="stat-value" style={{ marginTop: 8, color: row.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(row.net)}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: '0.8rem' }}>
                  <span className="income-text">↑ {fmt(row.income)}</span>
                  <span className="expense-text">↓ {fmt(row.expense)}</span>
                </div>
                {d && (
                  <div className={`stat-delta ${d.up ? 'up' : 'down'}`} style={{ marginTop: 8 }}>
                    {d.up ? '▲' : '▼'} {Math.abs(d.pct)}% net vs {row.year - 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Revenue trend */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Monthly Revenue — YOY Comparison</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12 }}>
            Shown as annual total ÷ 12 (monthly breakdown not available for all segments)
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyChart}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
              {LOAD_YEARS.map((y, i) => (
                <Line key={y} type="monotone" dataKey={`${y} Revenue`} stroke={COLORS[i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Net P&L bars */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Annual Net Surplus — YOY</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yoyRows.map(r => ({ year: String(r.year), Net: r.net, Revenue: r.income, Expenses: r.expense }))}>
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
              <Bar dataKey="Revenue"  fill="var(--success)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Expenses" fill="var(--danger)"  radius={[3, 3, 0, 0]} />
              <Bar dataKey="Net"      fill="var(--accent)"  radius={[3, 3, 0, 0]} />
            </BarChart>
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
                {[
                  { label: 'Total Revenue',  key: 'income',  cls: 'income-text' },
                  { label: 'Total Expenses', key: 'expense', cls: 'expense-text' },
                  { label: 'Net Surplus',    key: 'net',     cls: 'net-text' },
                ].map(row => {
                  const last = yoyRows[yoyRows.length - 1];
                  const prev = yoyRows[yoyRows.length - 2];
                  const d    = prev ? delta(last[row.key], prev[row.key]) : null;
                  return (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 500 }}>{row.label}</td>
                      {yoyRows.map(r => (
                        <td key={r.year} className={`amount-cell ${row.cls}`} style={{ textAlign: 'right' }}>{fmt(r[row.key])}</td>
                      ))}
                      <td style={{ textAlign: 'right' }}>
                        {d ? (
                          <span style={{ color: d.up ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                            {d.up ? '▲' : '▼'} {Math.abs(d.pct)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {/* Home renovation row */}
                <tr>
                  <td style={{ fontWeight: 500, color: 'var(--warn)' }}>🏡 Home Maintenance</td>
                  {LOAD_YEARS.map(y => (
                    <td key={y} className="amount-cell expense-text" style={{ textAlign: 'right' }}>
                      {fmt(data[y]?.homeTotal || 0)}
                    </td>
                  ))}
                  <td></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500, color: 'var(--muted)' }}>Net Margin</td>
                  {yoyRows.map(r => (
                    <td key={r.year} style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {r.income > 0 ? `${((r.net / r.income) * 100).toFixed(1)}%` : '—'}
                    </td>
                  ))}
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
