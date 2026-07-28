import { monthlySeries, momChange, findOutliers, forecastNext } from './insightsEngine';
import { costPerKgBreakdown, workerWageSummary, agentPendingBreakdown } from './chaayaService';

// Builds a monthly cost-per-kg series so trend/forecast logic can work off
// it, reusing the same math as the Market Rates breakdown but bucketed by
// month instead of a single period.
function monthlyCostPerKg(harvest, maintenance, inventory) {
  const months = new Set();
  harvest.forEach(h => h.date && months.add(h.date.slice(0, 7)));
  return [...months].sort().map(mk => {
    const hMonth = harvest.filter(h => h.date && h.date.slice(0, 7) === mk);
    const mMonth = maintenance.filter(m => m.date && m.date.slice(0, 7) === mk);
    const iMonth = inventory.filter(p => p.date && p.date.slice(0, 7) === mk);
    const cpk = costPerKgBreakdown(hMonth, mMonth, iMonth);
    return { month: mk, total: cpk.netMarginPerKg };
  });
}

export function teaInsights(harvest, maintenance, inventory, advances, settlements, agentPayments, workerList) {
  const flags = [];

  // 1. Cost-per-kg (margin) trend
  const marginSeries = monthlyCostPerKg(harvest, maintenance, inventory);
  const marginChange = momChange(marginSeries);
  if (marginChange) {
    const dir = marginChange.pctChange >= 0 ? 'improved' : 'dropped';
    flags.push({
      severity: Math.abs(marginChange.pctChange) >= 15 ? 'high' : 'medium',
      area: 'Margin',
      text: `Net margin per kg ${dir} ${Math.abs(marginChange.pctChange).toFixed(0)}% in ${marginChange.latestMonth} (₹${marginChange.latest.toFixed(2)}/kg) vs ${marginChange.prevMonth} (₹${marginChange.prev.toFixed(2)}/kg).`,
    });
  }

  // 2. Agent rate outliers — is one agent paying noticeably less/more per kg?
  const agentTotals = {};
  harvest.forEach(h => {
    if (!h.agent || !h.rate) return;
    if (!agentTotals[h.agent]) agentTotals[h.agent] = { kg: 0, rev: 0 };
    agentTotals[h.agent].kg += h.tNet || 0;
    agentTotals[h.agent].rev += h.agentRev || 0;
  });
  const agentAvgRates = Object.entries(agentTotals)
    .filter(([, v]) => v.kg > 0)
    .map(([agent, v]) => ({ agent, avgRate: v.rev / v.kg }));
  findOutliers(agentAvgRates, x => x.avgRate, x => x.agent, 1.2).forEach(o => {
    flags.push({
      severity: Math.abs(o.deviation) >= 2 ? 'high' : 'medium',
      area: 'Agent Rate',
      text: `${o.label}'s average rate (₹${o.value.toFixed(2)}/kg) is ${o.deviation > 0 ? 'notably higher' : 'notably lower'} than your other agents — worth a quick check.`,
    });
  });

  // 3. Worker payment backlog
  const workerBacklog = (workerList || [])
    .map(w => ({ worker: w, outstanding: workerWageSummary(w, harvest, advances, settlements).outstanding }))
    .filter(w => w.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
  if (workerBacklog.length > 0) {
    const top = workerBacklog[0];
    flags.push({
      severity: top.outstanding > 5000 ? 'high' : 'low',
      area: 'Worker Payments',
      text: `${workerBacklog.length} worker${workerBacklog.length!==1?'s have':' has'} unpaid wages — largest is ${top.worker} at ₹${top.outstanding.toFixed(0)}.`,
    });
  }

  // 4. Agent payment backlog
  const agentBreakdown = agentPendingBreakdown(harvest, agentPayments).filter(a => a.pending > 0.5);
  if (agentBreakdown.length > 0) {
    const totalPending = agentBreakdown.reduce((s, a) => s + a.pending, 0);
    flags.push({
      severity: totalPending > 10000 ? 'high' : 'low',
      area: 'Agent Payments',
      text: `₹${totalPending.toFixed(0)} pending across ${agentBreakdown.length} agent${agentBreakdown.length!==1?'s':''}.`,
    });
  }

  // 5. Maintenance cost spike (incl. inventory purchases)
  const maintCombined = [
    ...maintenance.map(m => ({ date: m.date, cost: m.cost || 0 })),
    ...inventory.map(p => ({ date: p.date, cost: p.totalCost || 0 })),
  ];
  const maintSeries = monthlySeries(maintCombined, 'date', 'cost');
  const maintChange = momChange(maintSeries);
  if (maintChange && maintChange.pctChange >= 25) {
    flags.push({
      severity: maintChange.pctChange >= 50 ? 'high' : 'medium',
      area: 'Maintenance Cost',
      text: `Maintenance & purchases jumped ${maintChange.pctChange.toFixed(0)}% in ${maintChange.latestMonth} (₹${maintChange.latest.toFixed(0)}) vs ${maintChange.prevMonth} (₹${maintChange.prev.toFixed(0)}).`,
    });
  }

  // 6. Advance buildup
  const pendingAdvTotal = advances.filter(a => !a.deducted).reduce((s, a) => s + (a.amount || 0), 0);
  if (pendingAdvTotal > 0) {
    flags.push({
      severity: pendingAdvTotal > 10000 ? 'medium' : 'low',
      area: 'Worker Advances',
      text: `₹${pendingAdvTotal.toFixed(0)} in worker advances still pending deduction.`,
    });
  }

  // 7. Harvest volume forecast (net kg per month)
  const kgSeries = monthlySeries(harvest, 'date', 'tNet');
  const kgForecast = forecastNext(kgSeries, 1);

  return { flags, marginSeries, kgSeries, kgForecast, maintSeries };
}
