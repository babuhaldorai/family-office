import React, { useEffect, useState, useMemo } from 'react';
import { rentalService } from '../utils/firestoreService';
import { homeExpenseService } from '../utils/homeService';
import { buildMonthlyPL, buildCategoryBreakdown, fmt } from '../utils/finance';
import { useTeaFinancials } from '../hooks/useTeaFinancials';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const YEAR  = new Date().getFullYear();
const YEARS = [YEAR - 2, YEAR - 1, YEAR];

// Convert home expenses into flat expense transactions for P&L engine
function homeToTx(homeExp) {
  return homeExp.map(e => ({
    type: 'expense',
    category: e.category || 'Home Maintenance',
    amount: e.amount,
    month: e.month || (e.date ? new Date(e.date).getMonth() + 1 : 1),
    year: e.year || YEAR,
  }));
}

export default function ReportsPage() {
  const [rentTx,  setRentTx]   = useState([]);
  const [homeExp, setHomeExp]  = useState([]);
  const [year,    setYear]     = useState(YEAR);
  const [tab,     setTab]      = useState('pl');
  const [rentLoading,  setRentLoading]  = useState(true);
  const [homeLoading,  setHomeLoading]  = useState(true);
  const { transactions: teaTx, loading: teaLoading } = useTeaFinancials(year);

  useEffect(() => {
    setRentLoading(true); setHomeLoading(true);
    rentalService.getTransactions(year).then(r => setRentTx(r)).finally(() => setRentLoading(false));
    homeExpenseService.getByYear(year).then(e => setHomeExp(e)).finally(() => setHomeLoading(false));
  }, [year]);

  const loading = teaLoading || rentLoading || homeLoading;

  const all = useMemo(() => [
    ...teaTx,
    ...rentTx,
    ...homeToTx(homeExp),
  ], [teaTx, rentTx, homeExp]);

  const monthly     = useMemo(() => buildMonthlyPL(all),            [all]);
  const teaMonthly  = useMemo(() => buildMonthlyPL(teaTx),          [teaTx]);
  const rentMonthly = useMemo(() => buildMonthlyPL(rentTx),         [rentTx]);
  const homeTx      = useMemo(() => homeToTx(homeExp),              [homeExp]);
  const homeMonthly = useMemo(() => buildMonthlyPL(homeTx),         [homeTx]);
  const categories  = useMemo(() => buildCategoryBreakdown(all),    [all]);

  const totalIncome  = monthly.reduce((s, m) => s + m.income,  0);
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);
  const netProfit    = totalIncome - totalExpense;
  const homeTotal    = homeExp.reduce((s, e) => s + Number(e.amount || 0), 0);

  const incomeCategories  = categories.filter(c => c.type === 'income').sort((a, b) => b.amount - a.amount);
  const expenseCategories = categories.filter(c => c.type === 'expense').sort((a, b) => b.amount - a.amount);

  const chartData = monthly.map(m => ({ name: m.label, Income: m.income, Expenses: m.expense, Net: m.net }));

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Reports</h1>
          <p className="page-subtitle">P&L and operating statements — all segments</p>
        </div>
        <div className="year-selector">
          {YEARS.map(y => <button key={y} className={year === y ? 'active' : ''} onClick={() => setYear(y)}>{y}</button>)}
        </div>
      </div>

      <div className="page-body">
        <div className="tabs">
          {[['pl', 'P & L Statement'], ['operating', 'Operating Statement'], ['segment', 'By Segment']].map(([k, v]) => (
            <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{v}</button>
          ))}
        </div>

        {/* ── P&L ── */}
        {tab === 'pl' && (
          <div>
            <div className="stat-grid" style={{ marginBottom: 24 }}>
              <div className="stat-card income"><div className="stat-label">Total Revenue</div><div className="stat-value income-text">{fmt(totalIncome)}</div></div>
              <div className="stat-card expense"><div className="stat-label">Total Expenses</div><div className="stat-value expense-text">{fmt(totalExpense)}</div></div>
              <div className="stat-card net"><div className="stat-label">Net Surplus</div>
                <div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(netProfit)}</div>
              </div>
              <div className="stat-card"><div className="stat-label">Net Margin</div>
                <div className="stat-value">{totalIncome > 0 ? `${((netProfit / totalIncome) * 100).toFixed(1)}%` : '—'}</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div className="section-title">Monthly Revenue vs Expenses</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8 }} />
                  <Bar dataKey="Income"   fill="var(--success)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expenses" fill="var(--danger)"  radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 0, marginBottom: 24 }}>
              <div style={{ padding: '16px 20px 0', fontSize: '1rem', fontWeight: 600 }}>Monthly P&L — {year}</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Expenses</th><th style={{ textAlign: 'right' }}>Net Surplus</th><th style={{ textAlign: 'right' }}>Margin</th></tr></thead>
                  <tbody>
                    {monthly.map(m => (
                      <tr key={m.month}>
                        <td style={{ fontWeight: 500 }}>{m.label}</td>
                        <td className="amount-cell income-text"  style={{ textAlign: 'right' }}>{fmt(m.income)}</td>
                        <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(m.expense)}</td>
                        <td className="amount-cell" style={{ textAlign: 'right', color: m.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(m.net)}</td>
                        <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--muted)' }}>{m.income > 0 ? `${((m.net / m.income) * 100).toFixed(1)}%` : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid var(--border2)', fontWeight: 600 }}>
                      <td>TOTAL</td>
                      <td className="amount-cell income-text"  style={{ textAlign: 'right' }}>{fmt(totalIncome)}</td>
                      <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(totalExpense)}</td>
                      <td className="amount-cell" style={{ textAlign: 'right', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(netProfit)}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--muted)' }}>{totalIncome > 0 ? `${((netProfit / totalIncome) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Operating Statement ── */}
        {tab === 'operating' && (
          <div className="grid-2">
            <div className="card">
              <div className="section-title income-text">Revenue Breakdown</div>
              <table style={{ width: '100%' }}>
                <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
                <tbody>
                  {incomeCategories.map(c => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td className="amount-cell income-text" style={{ textAlign: 'right' }}>{fmt(c.amount)}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--muted)' }}>{totalIncome > 0 ? `${((c.amount / totalIncome) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                  {incomeCategories.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--muted)', padding: 16 }}>No income data.</td></tr>}
                  <tr style={{ borderTop: '1px solid var(--border2)', fontWeight: 600 }}>
                    <td>Total Revenue</td>
                    <td className="amount-cell income-text" style={{ textAlign: 'right' }}>{fmt(totalIncome)}</td>
                    <td style={{ textAlign: 'right' }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="section-title expense-text">Expense Breakdown</div>
              <table style={{ width: '100%' }}>
                <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>% of Rev</th></tr></thead>
                <tbody>
                  {expenseCategories.map(c => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(c.amount)}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--muted)' }}>{totalIncome > 0 ? `${((c.amount / totalIncome) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                  {expenseCategories.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--muted)', padding: 16 }}>No expense data.</td></tr>}
                  <tr style={{ borderTop: '1px solid var(--border2)', fontWeight: 600 }}>
                    <td>Total Expenses</td>
                    <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(totalExpense)}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--muted)' }}>{totalIncome > 0 ? `${((totalExpense / totalIncome) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                  <tr style={{ fontWeight: 700 }}>
                    <td style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>Net Surplus</td>
                    <td className="amount-cell" style={{ textAlign: 'right', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(netProfit)}</td>
                    <td style={{ textAlign: 'right', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{totalIncome > 0 ? `${((netProfit / totalIncome) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── By Segment ── */}
        {tab === 'segment' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* Tea */}
              <div className="card segment-tea">
                <div className="section-title">🍃 Tea Plantation</div>
                <table style={{ width: '100%' }}>
                  <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Expenses</th><th style={{ textAlign: 'right' }}>Net</th></tr></thead>
                  <tbody>
                    {teaMonthly.map(m => (
                      <tr key={m.month}>
                        <td>{m.label}</td>
                        <td className="amount-cell income-text"  style={{ textAlign: 'right' }}>{fmt(m.income)}</td>
                        <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(m.expense)}</td>
                        <td className="amount-cell" style={{ textAlign: 'right', color: m.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(m.net)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid var(--border2)', fontWeight: 600 }}>
                      <td>Total</td>
                      <td className="amount-cell income-text"  style={{ textAlign: 'right' }}>{fmt(teaMonthly.reduce((s, m) => s + m.income, 0))}</td>
                      <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(teaMonthly.reduce((s, m) => s + m.expense, 0))}</td>
                      <td className="amount-cell" style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmt(teaMonthly.reduce((s, m) => s + m.net, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Rentals */}
              <div className="card segment-rental">
                <div className="section-title">🏠 Rental Homes</div>
                <table style={{ width: '100%' }}>
                  <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Expenses</th><th style={{ textAlign: 'right' }}>Net</th></tr></thead>
                  <tbody>
                    {rentMonthly.map(m => (
                      <tr key={m.month}>
                        <td>{m.label}</td>
                        <td className="amount-cell income-text"  style={{ textAlign: 'right' }}>{fmt(m.income)}</td>
                        <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(m.expense)}</td>
                        <td className="amount-cell" style={{ textAlign: 'right', color: m.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(m.net)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid var(--border2)', fontWeight: 600 }}>
                      <td>Total</td>
                      <td className="amount-cell income-text"  style={{ textAlign: 'right' }}>{fmt(rentMonthly.reduce((s, m) => s + m.income, 0))}</td>
                      <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(rentMonthly.reduce((s, m) => s + m.expense, 0))}</td>
                      <td className="amount-cell" style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmt(rentMonthly.reduce((s, m) => s + m.net, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Home Maintenance */}
            <div className="card" style={{ borderLeft: '3px solid var(--warn)' }}>
              <div className="section-title">🏡 Home Maintenance & Maintenance</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 14 }}>
                Expense-only segment — funded from income surplus. Total {year}: <strong style={{ color: 'var(--danger)' }}>{fmt(homeTotal)}</strong>
              </div>
              <table style={{ width: '100%' }}>
                <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Expenses</th></tr></thead>
                <tbody>
                  {homeMonthly.map(m => (
                    <tr key={m.month}>
                      <td>{m.label}</td>
                      <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{m.expense > 0 ? fmt(m.expense) : '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid var(--border2)', fontWeight: 600 }}>
                    <td>Total</td>
                    <td className="amount-cell expense-text" style={{ textAlign: 'right' }}>{fmt(homeTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
