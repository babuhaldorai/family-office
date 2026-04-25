export const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

export const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export const pct = (num, denom) =>
  denom === 0 ? '—' : `${((num / denom) * 100).toFixed(1)}%`;

// Build monthly P&L buckets from flat transaction arrays
// transactions: [{ month, type:'income'|'expense', amount, category }]
export function buildMonthlyPL(transactions) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: MONTHS[i],
    income: 0,
    expense: 0,
    net: 0,
  }));
  for (const t of transactions) {
    const m = months[t.month - 1];
    if (!m) continue;
    if (t.type === 'income')  m.income  += Number(t.amount);
    else                      m.expense += Number(t.amount);
  }
  months.forEach(m => { m.net = m.income - m.expense; });
  return months;
}

export function buildCategoryBreakdown(transactions) {
  const map = {};
  for (const t of transactions) {
    const key = `${t.type}::${t.category || 'Uncategorised'}`;
    map[key] = (map[key] || 0) + Number(t.amount);
  }
  return Object.entries(map).map(([k, v]) => {
    const [type, category] = k.split('::');
    return { type, category, amount: v };
  });
}

export function buildYOY(txByYear) {
  // txByYear: { 2023: [...], 2024: [...] }
  return Object.entries(txByYear)
    .sort(([a], [b]) => a - b)
    .map(([year, txs]) => {
      const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return { year: Number(year), income, expense, net: income - expense };
    });
}

export function consolidate(teaTx, rentalTx) {
  const all = [
    ...teaTx.map(t => ({ ...t, segment: 'Tea' })),
    ...rentalTx.map(t => ({ ...t, segment: 'Rentals' })),
  ];
  return all;
}
