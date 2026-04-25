import React, { useMemo } from 'react';
import { inr, kgFmt, periodLabel, getFieldAcres } from '../../utils/chaayaService';
import { C, AGENT_COLORS } from './chaayaStyles';
import PeriodBar from './PeriodBar';

export default function DashboardTab({ dashH, dashPeriod, setDashPeriod, fields, agentList, maintenance, pendingRateSessions }) {
  const tRev    = dashH.reduce((s, e) => s + (e.agentRev  || 0), 0);
  const tKg     = dashH.reduce((s, e) => s + (e.tNet      || 0), 0);
  const tWater  = dashH.reduce((s, e) => s + (e.tWaterDed || 0), 0);
  const tBag    = dashH.reduce((s, e) => s + (e.tBagDed   || 0), 0);
  const tWages  = dashH.reduce((s, e) => s + (e.workerPay || 0), 0);
  const avgRate = dashH.length ? dashH.reduce((s, e) => s + (e.rate || 0), 0) / dashH.length : 40;
  const pLabel  = periodLabel(dashPeriod);
  const fieldNames = fields.map(f => f.name);

  // Maintenance costs filtered to same period
  const tMaint = (maintenance || [])
    .filter(m => m.date >= (dashPeriod.from || '2000-01-01') && m.date <= (dashPeriod.to || '2099-12-31'))
    .reduce((s, m) => s + (m.cost || 0), 0);

  const tExpenses = tWages + tMaint;
  const tNet      = tRev - tExpenses;

  // Expense breakdown by maintenance task
  const maintByTask = useMemo(() => {
    const filtered = (maintenance || []).filter(
      m => m.date >= (dashPeriod.from || '2000-01-01') && m.date <= (dashPeriod.to || '2099-12-31')
    );
    const map = {};
    filtered.forEach(m => {
      const k = m.task || 'Other';
      map[k] = (map[k] || 0) + (m.cost || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [maintenance, dashPeriod]);

  return (
    <div>
      <PeriodBar period={dashPeriod} onChange={setDashPeriod} />

      {/* Pending rate banner */}
      {pendingRateSessions > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'rgba(224,146,74,0.1)',
          border: '1px solid rgba(224,146,74,0.3)',
          borderRadius: 'var(--radius)', padding: '11px 14px',
          marginBottom: 18, fontSize: '0.82rem', color: 'var(--warn)',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⏳</span>
          <span>
            <strong>{pendingRateSessions} harvest session{pendingRateSessions !== 1 ? 's' : ''} used an estimated rate.</strong>
            {' '}Revenue figures may change once the agent confirms the final rate.
            Go to <strong>Market Rates</strong>, enter the confirmed rate, then re-save those sessions in <strong>Log Harvest</strong>.
          </span>
        </div>
      )}

      {/* KPI row */}
      <div className="ch-kpi-grid">
        <div className="ch-kpi green">
          <div className="ch-kpi-label">Revenue</div>
          <div className="ch-kpi-value">{inr(tRev)}</div>
          <div className="ch-kpi-sub up">{pLabel}</div>
        </div>
        <div className="ch-kpi rust">
          <div className="ch-kpi-label">Total Expenses</div>
          <div className="ch-kpi-value">{inr(tExpenses)}</div>
          <div className="ch-kpi-sub down">Wages + Maintenance</div>
        </div>
        <div className="ch-kpi gold">
          <div className="ch-kpi-label">Net Profit</div>
          <div className="ch-kpi-value" style={{ color: tNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>{inr(tNet)}</div>
          <div className={`ch-kpi-sub ${tNet >= 0 ? 'up' : 'down'}`}>
            {tRev > 0 ? ((tNet / tRev) * 100).toFixed(1) + '% margin' : '—'}
          </div>
        </div>
        <div className="ch-kpi earth">
          <div className="ch-kpi-label">Net Kg Sold</div>
          <div className="ch-kpi-value">{tKg.toFixed(1)} kg</div>
          <div className="ch-kpi-sub">{dashH.length} sessions</div>
        </div>
      </div>

      {/* Field cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        {fieldNames.map(name => {
          const fh    = dashH.filter(e => e.field === name);
          const fKg   = fh.reduce((s, e) => s + (e.tNet || 0), 0);
          const fRev  = fh.reduce((s, e) => s + (e.agentRev || 0), 0);
          const acres = getFieldAcres(fields, name);
          return (
            <div key={name} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{acres} acres</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                {[['Net Kg', kgFmt(fKg)], ['kg/Acre', fKg > 0 ? (fKg / acres).toFixed(1) : '—'], ['Rev/Acre', fKg > 0 ? inr(fRev / acres) : '—']].map(([l, v]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{v}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="ch-grid-2">
        {/* Expense breakdown */}
        <div className="ch-card">
          <div className="ch-card-title">Expense Breakdown</div>
          <div className="ch-card-sub">{pLabel}</div>

          {/* Worker wages bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: 'var(--muted)' }}>Worker Wages</span>
              <span style={{ color: 'var(--danger)' }}>{inr(tWages)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${tExpenses > 0 ? (tWages / tExpenses) * 100 : 0}%`, background: 'var(--danger)', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {tExpenses > 0 ? ((tWages / tExpenses) * 100).toFixed(1) : 0}% of total expenses
            </div>
          </div>

          {/* Maintenance by task */}
          {maintByTask.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Maintenance — {inr(tMaint)} total
              </div>
              {maintByTask.map(([task, cost]) => (
                <div key={task} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text)' }}>{task}</span>
                    <span style={{ color: 'var(--warn)' }}>{inr(cost)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${tMaint > 0 ? (cost / tMaint) * 100 : 0}%`, background: 'var(--warn)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </>
          )}

          {maintByTask.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>No maintenance costs this period.</div>
          )}

          {/* Total */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span>Total Expenses</span>
            <span style={{ color: 'var(--danger)' }}>{inr(tExpenses)}</span>
          </div>
        </div>

        {/* Deduction leakage */}
        <div className="ch-card">
          <div className="ch-card-title">Deduction Leakage by Agent</div>
          <div className="ch-card-sub">Revenue lost to water & bag deductions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'rgba(224,92,92,.07)', borderRadius: 8, padding: 11 }}>
              <div style={{ fontSize: 10.5, color: 'var(--danger)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px' }}>Water Ded.</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--danger)', marginTop: 3 }}>{tWater.toFixed(1)} kg</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{inr(tWater * avgRate)} est. lost</div>
            </div>
            <div style={{ background: 'rgba(201,168,76,.07)', borderRadius: 8, padding: 11 }}>
              <div style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px' }}>Bag Ded.</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent)', marginTop: 3 }}>{tBag.toFixed(1)} kg</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{inr(tBag * avgRate)} est. lost</div>
            </div>
          </div>
          {agentList.map((a, i) => {
            const lost = dashH.filter(e => e.agent === a).reduce((s, e) => s + ((e.tWaterDed + e.tBagDed) * (e.rate || 0)), 0);
            const maxL = Math.max(...agentList.map(ag => dashH.filter(e => e.agent === ag).reduce((s, e) => s + ((e.tWaterDed + e.tBagDed) * (e.rate || 0)), 0)), 1);
            return (
              <div key={a} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text)' }}>{a}</span>
                  <span style={{ fontWeight: 500, color: AGENT_COLORS[i % AGENT_COLORS.length] }}>{inr(lost)}</span>
                </div>
                <div style={{ height: 7, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(lost / maxL * 100)}%`, background: AGENT_COLORS[i % AGENT_COLORS.length], borderRadius: 4 }} />
                </div>
              </div>
            );
          })}

          {/* P&L summary */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12 }}>
            {[
              ['Revenue', inr(tRev), 'var(--success)'],
              ['Expenses', inr(tExpenses), 'var(--danger)'],
              ['Net Profit', inr(tNet), tNet >= 0 ? 'var(--success)' : 'var(--danger)'],
            ].map(([l, v, color]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{l}</span>
                <span style={{ fontWeight: 600, color }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
