import React, { useMemo } from 'react';
import { inr, agentStats, periodLabel, getFieldAcres } from '../../utils/chaayaService';

import PeriodBar from './PeriodBar';

// ── ANALYTICS TAB ─────────────────────────────────────────────────────────────
export function AnalyticsTab({ anaH, anaPeriod, setAnaPeriod, fieldList, fields, maintenance }) {
  const tRev    = anaH.reduce((s, e) => s + (e.agentRev  || 0), 0);
  const tWages  = anaH.reduce((s, e) => s + (e.workerPay || 0), 0);

  // Maintenance filtered to same period
  const periodMaint = useMemo(() => (maintenance || []).filter(
    m => m.date >= (anaPeriod.from || '2000-01-01') && m.date <= (anaPeriod.to || '2099-12-31')
  ), [maintenance, anaPeriod]);
  const tMaint = periodMaint.reduce((s, m) => s + (m.cost || 0), 0);
  const tExp   = tWages + tMaint;
  const tNet   = tRev - tExp;

  const fieldStats = useMemo(() => fieldList.map(name => {
    const fh    = anaH.filter(e => e.field === name);
    const kg    = fh.reduce((s, e) => s + (e.tNet    || 0), 0);
    const rev   = fh.reduce((s, e) => s + (e.agentRev|| 0), 0);
    const wages = fh.reduce((s, e) => s + (e.workerPay||0), 0);
    const fMaint = periodMaint.filter(m => m.field === name).reduce((s, m) => s + (m.cost || 0), 0);
    const acres = getFieldAcres(fields, name);
    return { name, kg, rev, wages, maint: fMaint, exp: wages + fMaint, acres, rpa: acres > 0 ? rev / acres : 0, net: rev - wages - fMaint };
  }).sort((a, b) => b.rpa - a.rpa), [anaH, fieldList, fields, periodMaint]);

  const maxRpa    = Math.max(...fieldStats.map(x => x.rpa), 1);
  const bestField = fieldStats[0];

  // Maintenance by task
  const maintByTask = useMemo(() => {
    const map = {};
    periodMaint.forEach(m => { const k = m.task || 'Other'; map[k] = (map[k] || 0) + (m.cost || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [periodMaint]);

  return (
    <div>
      <PeriodBar period={anaPeriod} onChange={setAnaPeriod} />

      {/* KPIs */}
      <div className="ch-kpi-grid">
        <div className="ch-kpi green">
          <div className="ch-kpi-label">Total Revenue</div>
          <div className="ch-kpi-value">{inr(tRev)}</div>
          <div className="ch-kpi-sub up">{periodLabel(anaPeriod)}</div>
        </div>
        <div className="ch-kpi rust">
          <div className="ch-kpi-label">Total Expenses</div>
          <div className="ch-kpi-value">{inr(tExp)}</div>
          <div className="ch-kpi-sub down">Wages + Maintenance</div>
        </div>
        <div className="ch-kpi gold">
          <div className="ch-kpi-label">Net Profit</div>
          <div className="ch-kpi-value" style={{ color: tNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>{inr(tNet)}</div>
          <div className={`ch-kpi-sub ${tNet >= 0 ? 'up' : 'down'}`}>{tRev > 0 ? ((tNet / tRev) * 100).toFixed(1) + '% margin' : '—'}</div>
        </div>
        <div className="ch-kpi earth">
          <div className="ch-kpi-label">Best Field (Rev/Acre)</div>
          <div className="ch-kpi-value" style={{ fontSize: 16 }}>{bestField?.name || '—'}</div>
          <div className="ch-kpi-sub up">{bestField ? inr(bestField.rpa) + '/acre' : ''}</div>
        </div>
      </div>

      <div className="ch-grid-2">
        {/* Revenue/acre by field */}
        <div className="ch-card">
          <div className="ch-card-title">Revenue per Acre by Field</div>
          {fieldStats.map(f => (
            <div key={f.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.name}</span>
                <span style={{ color: 'var(--success)' }}>{inr(f.rpa)}/acre</span>
              </div>
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${maxRpa > 0 ? f.rpa / maxRpa * 100 : 0}%`, background: 'var(--tea-light)', borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {f.acres} acres · {f.kg.toFixed(1)} kg · net {inr(f.net)}
              </div>
            </div>
          ))}
          {bestField && (
            <div className="ch-alert-info" style={{ marginTop: 14 }}>
              💡 <strong>Best:</strong> {bestField.name} at {inr(bestField.rpa)}/acre
            </div>
          )}
        </div>

        {/* Expense breakdown */}
        <div className="ch-card">
          <div className="ch-card-title">Expense Breakdown</div>
          <div className="ch-card-sub">{periodLabel(anaPeriod)}</div>

          {/* Wages */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: 'var(--muted)' }}>Worker Wages</span>
              <span style={{ color: 'var(--danger)' }}>{inr(tWages)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${tExp > 0 ? (tWages / tExp) * 100 : 0}%`, background: 'var(--danger)', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {tExp > 0 ? ((tWages / tExp) * 100).toFixed(1) : 0}% of total
            </div>
          </div>

          {/* Maintenance tasks */}
          {maintByTask.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Maintenance — {inr(tMaint)}
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
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>No maintenance costs this period.</div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10 }}>
            {[
              ['Total Wages',       inr(tWages), 'var(--danger)'],
              ['Total Maintenance', inr(tMaint), 'var(--warn)'],
              ['Total Expenses',    inr(tExp),   'var(--danger)'],
              ['Net Profit',        inr(tNet),   tNet >= 0 ? 'var(--success)' : 'var(--danger)'],
            ].map(([l, v, color]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: l !== 'Net Profit' ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: 'var(--muted)' }}>{l}</span>
                <span style={{ fontWeight: l === 'Net Profit' || l === 'Total Expenses' ? 700 : 500, color }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Field P&L table */}
      <div className="ch-card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
          Field P&L Summary
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ch-table">
            <thead>
              <tr>
                <th>Field</th><th>Acres</th><th>Net kg</th><th>Revenue</th>
                <th>Wages</th><th>Maintenance</th><th>Total Exp</th>
                <th>Net Profit</th><th>Rev/Acre</th><th>Net/Acre</th>
              </tr>
            </thead>
            <tbody>
              {fieldStats.map(f => (
                <tr key={f.name}>
                  <td style={{ fontWeight: 600 }}>{f.name}</td>
                  <td>{f.acres}</td>
                  <td>{f.kg.toFixed(1)}</td>
                  <td style={{ color: 'var(--success)' }}>{inr(f.rev)}</td>
                  <td style={{ color: 'var(--danger)' }}>{inr(f.wages)}</td>
                  <td style={{ color: 'var(--warn)' }}>{inr(f.maint)}</td>
                  <td style={{ color: 'var(--danger)' }}>{inr(f.exp)}</td>
                  <td style={{ fontWeight: 600, color: f.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{inr(f.net)}</td>
                  <td style={{ color: 'var(--tea-light)' }}>{inr(f.rpa)}</td>
                  <td style={{ color: f.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {f.acres > 0 ? inr(f.net / f.acres) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── AGENT ANALYTICS TAB ───────────────────────────────────────────────────────
export function AgentAnalyticsTab({ agtH, agtPeriod, setAgtPeriod, agentList }) {
  const stats        = agentList.map(a => { const s = agentStats(a, agtH); return { ...s, rateLost: Math.max(0, s.avgPostedRate - s.effectiveRate) }; });
  const sortedByDed  = [...stats].sort((a, b) => b.totalDedPct - a.totalDedPct);
  const rankColors   = ['var(--danger)', 'var(--warn)', 'var(--success)'];
  const rankLabels   = ['High deductor', 'Mid range', 'Best overall'];

  return (
    <div>
      <PeriodBar period={agtPeriod} onChange={setAgtPeriod} />
      <div className="ch-entity-grid" style={{ marginBottom: 18 }}>
        {stats.map(s => {
          const ri    = sortedByDed.findIndex(x => x.agent === s.agent);
          const color = rankColors[Math.min(ri, 2)];
          const label = rankLabels[Math.min(ri, 2)];
          return (
            <div key={s.agent} className="ch-entity-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{s.agent}</div>
                <span style={{ background: `${color}20`, color, padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600 }}>{label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                {periodLabel(agtPeriod)} · {s.sessions} session{s.sessions !== 1 ? 's' : ''}
              </div>
              {[
                ['Gross Kg',       s.grossKg.toFixed(1),                                                        null],
                ['Avg Rate',       s.avgPostedRate > 0 ? `₹${s.avgPostedRate.toFixed(2)}/kg` : '—',            null],
                ['Water ded.',     `${s.waterKg.toFixed(1)}kg · ${s.waterPct.toFixed(1)}%`,                    s.waterPct > 7 ? 'var(--danger)' : s.waterPct > 5 ? 'var(--warn)' : 'var(--success)'],
                ['Bag ded.',       `${s.bagKg.toFixed(1)}kg · ${s.bagPct.toFixed(1)}%`,                        s.bagPct > 4.5 ? 'var(--danger)' : s.bagPct > 3.5 ? 'var(--warn)' : 'var(--success)'],
                ['Revenue lost',   inr(s.revLost),                                                              s.revLost > 4000 ? 'var(--danger)' : s.revLost > 2000 ? 'var(--warn)' : 'var(--success)'],
                ['Net revenue',    inr(s.netRev),                                                               null],
                ['Effective rate', s.effectiveRate > 0 ? `₹${s.effectiveRate.toFixed(2)}/kg` : '—',            s.effectiveRate < 35 ? 'var(--danger)' : s.effectiveRate < 38 ? 'var(--warn)' : 'var(--success)'],
                ['Rate lost (₹/kg)', s.avgPostedRate > 0 && s.effectiveRate > 0 ? `₹${(s.avgPostedRate - s.effectiveRate).toFixed(2)}/kg` : '—', s.avgPostedRate - s.effectiveRate > 3 ? 'var(--danger)' : s.avgPostedRate - s.effectiveRate > 1.5 ? 'var(--warn)' : 'var(--success)'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--muted)' }}>{l}</span>
                  <span style={{ fontWeight: 500, color: c || 'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {stats.length > 1 && (
        <div className="ch-card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            Agent Comparison
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ch-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Metric</th>
                  {agentList.map(a => <th key={a} style={{ textAlign: 'right' }}>{a}</th>)}
                  <th style={{ textAlign: 'right' }}>Best</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Sessions',       key: 'sessions',      fmt: v => v,                             bestMax: true },
                  { label: 'Avg Rate ₹/kg',  key: 'avgPostedRate', fmt: v => v > 0 ? `₹${v.toFixed(2)}` : '—', bestMax: true },
                  { label: 'Water ded %',    key: 'waterPct',      fmt: v => `${v.toFixed(1)}%`,            bestMax: false },
                  { label: 'Bag ded %',      key: 'bagPct',        fmt: v => `${v.toFixed(1)}%`,            bestMax: false },
                  { label: 'Revenue lost',   key: 'revLost',       fmt: v => inr(v),                        bestMax: false },
                  { label: 'Effective rate', key: 'effectiveRate', fmt: v => v > 0 ? `₹${v.toFixed(2)}/kg` : '—', bestMax: true },
                  { label: 'Rate lost (₹/kg)', key: 'rateLost', fmt: v => v > 0 ? `₹${v.toFixed(2)}/kg` : '—', bestMax: false },
                ].map(row => {
                  const vals      = stats.map(s => s[row.key]);
                  const best      = row.bestMax ? Math.max(...vals) : Math.min(...vals);
                  const worst     = row.bestMax ? Math.min(...vals) : Math.max(...vals);
                  const bestAgent = stats.find(s => s[row.key] === best)?.agent || '—';
                  const fmtFn     = row.fmt || (v => v);
                  return (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 500 }}>{row.label}</td>
                      {stats.map(s => {
                        const isBest  = s[row.key] === best  && best > 0;
                        const isWorst = s[row.key] === worst && stats.length > 1;
                        return (
                          <td key={s.agent} style={{ textAlign: 'right', color: isBest ? 'var(--success)' : isWorst ? 'var(--danger)' : 'var(--text)', fontWeight: isBest ? 600 : 400 }}>
                            {fmtFn(s[row.key])}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{bestAgent}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
