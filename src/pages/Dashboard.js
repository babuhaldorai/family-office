import React, { useEffect, useState } from 'react';
import { rentalService } from '../utils/firestoreService';
import { homeExpenseService } from '../utils/homeService';
import { buildMonthlyPL, MONTHS } from '../utils/finance';
import { useTeaFinancials, useTeaDashboard } from '../hooks/useTeaFinancials';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Leaf, Home, AlertTriangle, Wrench } from 'lucide-react';

const YEAR = new Date().getFullYear();

function fmt(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n || 0);
}

// Build home expense monthly buckets for the chart
function buildHomeMonthly(homeExp) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, expense: 0 }));
  homeExp.forEach(e => {
    const m = e.month || (e.date ? new Date(e.date).getMonth() + 1 : null);
    if (m && months[m - 1]) months[m - 1].expense += Number(e.amount || 0);
  });
  return months;
}

export default function Dashboard() {
  const [rentTx, setRentTx]             = useState([]);
  const [homeExp, setHomeExp]           = useState([]);
  const [rentLoading, setRentLoading]   = useState(true);
  const [homeLoading, setHomeLoading]   = useState(true);
  const { transactions: teaTx, loading: teaLoading } = useTeaFinancials(YEAR);
  const teaDash = useTeaDashboard();

  useEffect(() => {
    rentalService.getTransactions(YEAR)
      .then(r => setRentTx(r))
      .finally(() => setRentLoading(false));
    homeExpenseService.getByYear(YEAR)
      .then(e => setHomeExp(e))
      .finally(() => setHomeLoading(false));
  }, []);

  const sum = (txs, type) =>
    txs.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

  const teaIncome   = sum(teaTx, 'income');
  const teaExpense  = sum(teaTx, 'expense');
  const rentIncome  = sum(rentTx, 'income');
  const rentExpense = sum(rentTx, 'expense');
  const homeTotal   = homeExp.reduce((s, e) => s + Number(e.amount || 0), 0);

  const totalIncome  = teaIncome + rentIncome;
  const totalExpense = teaExpense + rentExpense + homeTotal;
  const netProfit    = totalIncome - totalExpense;

  // Monthly chart — include home expenses in the Expenses bar
  const homeMonthly = buildHomeMonthly(homeExp);
  const teaRentMonthly = buildMonthlyPL([...teaTx, ...rentTx]);
  const chartData = teaRentMonthly.map((m, i) => ({
    month: m.label,
    Income: m.income,
    Expenses: m.expense + homeMonthly[i].expense,
    'Net P&L': m.income - (m.expense + homeMonthly[i].expense),
  }));

  const currentMonth = new Date().getMonth();
  const thisMonthNet = chartData[currentMonth]['Net P&L'];
  const loading = teaLoading || rentLoading || homeLoading;

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Consolidated overview for {YEAR}</p>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      <div className="page-body">

        {/* Pending rate banner */}
        {teaDash?.pendingRateUpdate && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(224,146,74,0.1)', border: '1px solid rgba(224,146,74,0.35)',
            borderRadius: 'var(--radius)', padding: '11px 16px',
            marginBottom: 20, fontSize: '0.85rem', color: 'var(--warn)',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Tea revenue is estimated.</strong> Some harvest sessions used an estimated (⏳) rate.
              Update in Tea → Market Rates and re-save those sessions to confirm the figures.
            </span>
          </div>
        )}

        {/* KPI strip */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card income">
            <div className="stat-label">Total Revenue {YEAR}</div>
            <div className="stat-value">{fmt(totalIncome)}</div>
            <div className="stat-sub">Tea + Rentals</div>
          </div>
          <div className="stat-card expense">
            <div className="stat-label">Total Expenses {YEAR}</div>
            <div className="stat-value">{fmt(totalExpense)}</div>
            <div className="stat-sub">All segments incl. homes</div>
          </div>
          <div className="stat-card net">
            <div className="stat-label">Net Surplus {YEAR}</div>
            <div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {fmt(netProfit)}
            </div>
            <div className={`stat-delta ${netProfit >= 0 ? 'up' : 'down'}`}>
              {netProfit >= 0 ? '▲' : '▼'} {totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0}% margin
            </div>
          </div>
          <div className="stat-card" style={{ borderTop: '3px solid var(--muted)' }}>
            <div className="stat-label">{MONTHS[currentMonth]} Net</div>
            <div className="stat-value" style={{ color: thisMonthNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {fmt(thisMonthNet)}
            </div>
            <div className="stat-sub">This month P&L</div>
          </div>
        </div>

        {/* Segment cards — 3 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Tea Plantation */}
          <div className="card segment-tea">
            <div className="flex-center justify-between mb-2">
              <div className="section-title" style={{ marginBottom: 0 }}>
                <Leaf size={16} style={{ display: 'inline', marginRight: 6, color: 'var(--tea-light)' }} />
                Tea Plantation
              </div>
              <span className="badge badge-tea">YTD</span>
            </div>
            {teaDash && (
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 10 }}>
                This week: <strong style={{ color: 'var(--tea-light)' }}>{teaDash.cwKg.toFixed(1)} kg</strong>
                {teaDash.cwRevenue > 0 && <> · {fmt(teaDash.cwRevenue)} est.</>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Revenue',  val: teaIncome,             cls: 'income-text' },
                { label: 'Expenses', val: teaExpense,             cls: 'expense-text' },
                { label: 'Net',      val: teaIncome - teaExpense, cls: teaIncome - teaExpense >= 0 ? 'income-text' : 'expense-text' },
              ].map(s => (
                <div key={s.label}>
                  <div className="stat-label">{s.label}</div>
                  <div className={`amount-cell ${s.cls}`} style={{ fontSize: '0.95rem' }}>{fmt(s.val)}</div>
                </div>
              ))}
            </div>
            {teaDash && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: 12 }}>
                <span>Labour: <span style={{ color: 'var(--danger)' }}>{fmt(teaDash.totalWages)}</span></span>
                <span>Maint: <span style={{ color: 'var(--danger)' }}>{fmt(teaDash.totalMaint)}</span></span>
              </div>
            )}
          </div>

          {/* Rental Homes */}
          <div className="card segment-rental">
            <div className="flex-center justify-between mb-2">
              <div className="section-title" style={{ marginBottom: 0 }}>
                <Home size={16} style={{ display: 'inline', marginRight: 6, color: 'var(--rental-light)' }} />
                Rental Homes
              </div>
              <span className="badge badge-rental">YTD</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
              {[
                { label: 'Revenue',  val: rentIncome,              cls: 'income-text' },
                { label: 'Expenses', val: rentExpense,              cls: 'expense-text' },
                { label: 'Net',      val: rentIncome - rentExpense, cls: rentIncome - rentExpense >= 0 ? 'income-text' : 'expense-text' },
              ].map(s => (
                <div key={s.label}>
                  <div className="stat-label">{s.label}</div>
                  <div className={`amount-cell ${s.cls}`} style={{ fontSize: '0.95rem' }}>{fmt(s.val)}</div>
                </div>
              ))}
            </div>
            {/* Expense breakdown by category */}
            {rentExpense > 0 && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)' }}>
                {Object.entries(
                  rentTx.filter(t => t.type === 'expense').reduce((acc, t) => {
                    acc[t.category || 'Other'] = (acc[t.category || 'Other'] || 0) + Number(t.amount);
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, amt]) => (
                  <span key={cat} style={{ marginRight: 10 }}>
                    {cat}: <span style={{ color: 'var(--danger)' }}>{fmt(amt)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Home Maintenance */}
          <div className="card" style={{ borderLeft: '3px solid var(--warn)' }}>
            <div className="flex-center justify-between mb-2">
              <div className="section-title" style={{ marginBottom: 0 }}>
                <Wrench size={16} style={{ display: 'inline', marginRight: 6, color: 'var(--warn)' }} />
                Home Maintenance
              </div>
              <span className="badge badge-vacant">YTD</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                <div>
                  <div className="stat-label">Total Spent</div>
                  <div className="amount-cell expense-text" style={{ fontSize: '0.95rem' }}>{fmt(homeTotal)}</div>
                </div>
                <div>
                  <div className="stat-label">Entries</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{homeExp.length}</div>
                </div>
              </div>
              {homeTotal > 0 && totalIncome > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 8 }}>
                  As % of income: <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{((homeTotal / totalIncome) * 100).toFixed(1)}%</span>
                  {' · '}Funded from surplus
                </div>
              )}
              {/* Breakdown by category */}
              {homeExp.length > 0 && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {Object.entries(
                    homeExp.reduce((acc, e) => {
                      acc[e.category || 'Other'] = (acc[e.category || 'Other'] || 0) + Number(e.amount || 0);
                      return acc;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, amt]) => (
                    <span key={cat} style={{ marginRight: 10 }}>
                      {cat}: <span style={{ color: 'var(--danger)' }}>{fmt(amt)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Monthly chart */}
        <div className="card">
          <div className="section-title">Monthly Performance — {YEAR}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 14 }}>
            Expenses include Tea labour & maintenance, Rental costs, and Home maintenance
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, n) => [fmt(v), n]}
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--muted)', fontSize: '0.8rem' }}
              />
              <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--muted)' }} />
              <Bar dataKey="Income"   fill="var(--success)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Expenses" fill="var(--danger)"  radius={[3, 3, 0, 0]} />
              <Bar dataKey="Net P&L"  fill="var(--accent)"  radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
