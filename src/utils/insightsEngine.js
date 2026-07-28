// ─── INSIGHTS ENGINE ────────────────────────────────────────────────────────
// Rule-based statistics (trends, outliers, simple forecasts) computed purely
// from the app's own historical data — no training data or ML model needed.
// These are the building blocks for both the on-screen flags/forecasts and
// the summary handed to the AI recommendations feature.

export function monthKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7); // 'YYYY-MM'
}

// Groups records by month, summing a numeric field. Returns chronological
// [{month:'YYYY-MM', total}] — only months with at least one record.
export function monthlySeries(records, dateField, amountField) {
  const map = {};
  records.forEach(r => {
    const mk = monthKey(r[dateField]);
    if (!mk) return;
    map[mk] = (map[mk] || 0) + (Number(r[amountField]) || 0);
  });
  return Object.entries(map)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// % change of the latest month vs the one before it. null if fewer than 2
// months of data exist yet.
export function momChange(series) {
  if (series.length < 2) return null;
  const latest = series[series.length - 1].total;
  const prev = series[series.length - 2].total;
  if (prev === 0) return null;
  return { latestMonth: series[series.length - 1].month, prevMonth: series[series.length - 2].month, latest, prev, pctChange: ((latest - prev) / Math.abs(prev)) * 100 };
}

function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

// Flags entries whose value deviates more than `threshold` standard
// deviations from the mean of the group — e.g. one agent's rate sitting far
// outside the norm of all agents, or one month's cost spiking vs the rest.
export function findOutliers(items, valueFn, labelFn, threshold = 1.5) {
  const values = items.map(valueFn);
  if (values.length < 3) return []; // not enough data to call anything an outlier
  const m = mean(values);
  const sd = stdDev(values);
  if (sd === 0) return [];
  return items
    .map((it, i) => ({ label: labelFn(it), value: values[i], deviation: (values[i] - m) / sd }))
    .filter(x => Math.abs(x.deviation) >= threshold)
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}

// Simple linear-trend forecast for the next `periods` months, based on a
// monthly series. Uses ordinary least-squares on (index, total) — enough
// signal for a small business's month-to-month trend without needing a
// real ML model. Returns null if there's too little history to trust.
export function forecastNext(series, periods = 1) {
  if (series.length < 3) return null;
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map(s => s.total);
  const xMean = mean(xs), yMean = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  const recentAvg = mean(ys.slice(-3)); // blend trend with recent average, avoids wild extrapolation
  const forecasts = [];
  for (let p = 1; p <= periods; p++) {
    const trendVal = intercept + slope * (n - 1 + p);
    const blended = (trendVal + recentAvg) / 2;
    forecasts.push(Math.max(0, blended));
  }
  return { slope, recentAvg, forecasts };
}
