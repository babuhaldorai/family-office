import { monthlySeries, momChange, findOutliers, forecastNext } from './insightsEngine';

export function rentalInsights(transactions, properties) {
  const flags = [];
  const income = transactions.filter(t => t.type === 'income');
  const expense = transactions.filter(t => t.type === 'expense');

  // 1. Net income trend
  const incomeSeries = monthlySeries(income, 'date', 'amount');
  const expenseSeries = monthlySeries(expense, 'date', 'amount');
  const months = [...new Set([...incomeSeries.map(s=>s.month), ...expenseSeries.map(s=>s.month)])].sort();
  const netSeries = months.map(m => ({
    month: m,
    total: (incomeSeries.find(s=>s.month===m)?.total||0) - (expenseSeries.find(s=>s.month===m)?.total||0),
  }));
  const netChange = momChange(netSeries);
  if (netChange) {
    const dir = netChange.pctChange >= 0 ? 'improved' : 'declined';
    flags.push({
      severity: Math.abs(netChange.pctChange) >= 25 ? 'high' : 'medium',
      area: 'Net Income',
      text: `Net rental income ${dir} ${Math.abs(netChange.pctChange).toFixed(0)}% in ${netChange.latestMonth} (₹${netChange.latest.toFixed(0)}) vs ${netChange.prevMonth} (₹${netChange.prev.toFixed(0)}).`,
    });
  }

  // 2. Expense category spike — this month vs each category's own historical average
  const expenseByCategory = {};
  expense.forEach(t => {
    const cat = t.category || 'Other';
    if (!expenseByCategory[cat]) expenseByCategory[cat] = [];
    expenseByCategory[cat].push(t);
  });
  const latestMonth = months[months.length - 1];
  Object.entries(expenseByCategory).forEach(([cat, txs]) => {
    const series = monthlySeries(txs, 'date', 'amount');
    if (series.length < 3) return;
    const latest = series.find(s => s.month === latestMonth);
    if (!latest) return;
    const priorAvg = series.filter(s => s.month !== latestMonth).reduce((s,x)=>s+x.total,0) / Math.max(1, series.length - 1);
    if (priorAvg > 0 && latest.total > priorAvg * 1.4) {
      flags.push({
        severity: latest.total > priorAvg * 2 ? 'high' : 'medium',
        area: 'Expense Category',
        text: `${cat} expenses this month (₹${latest.total.toFixed(0)}) are well above the usual average (₹${priorAvg.toFixed(0)}).`,
      });
    }
  });

  // 3. Property profitability ranking
  const propStats = (properties || []).map(p => {
    const pIncome = income.filter(t => t.propertyId === p.id).reduce((s,t)=>s+(t.amount||0),0);
    const pExpense = expense.filter(t => t.propertyId === p.id).reduce((s,t)=>s+(t.amount||0),0);
    return { name: p.name, net: pIncome - pExpense, income: pIncome, expense: pExpense };
  }).filter(p => p.income > 0 || p.expense > 0);
  findOutliers(propStats, x => x.net, x => x.name, 1.2).forEach(o => {
    if (o.deviation < 0) {
      flags.push({
        severity: 'medium',
        area: 'Property Performance',
        text: `${o.label} is underperforming your other properties (net ₹${o.value.toFixed(0)}) — worth reviewing its expenses or rent.`,
      });
    }
  });

  // 4. Net income forecast
  const netForecast = forecastNext(netSeries, 1);

  return { flags, incomeSeries, expenseSeries, netSeries, netForecast, propStats };
}
