// Planning ahead, from your own records only: which field to harvest next,
// how much to expect, how many workers, and how much manure to have ready.
// Every figure is a typical value from recent history, and says so.
import { r2, num, sum, addDays, daysBetween, fmtDate, inr, fyBounds } from './util';
import { fieldPlan, doBetter, forecastNextMonth, beforeAfter } from './insights';

const median = (xs) => { const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

// One row per harvest day on a field
function harvestDays(books, fieldId) {
  const by = new Map();
  books.deliveries.filter((d) => d.fieldId === fieldId).forEach((d) => {
    if (!by.has(d.date)) by.set(d.date, { date: d.date, kg: 0, pickers: new Set() });
    const row = by.get(d.date);
    row.kg = r2(row.kg + d.net);
    d.workers.forEach((w) => { if (w.grossKg > 0) row.pickers.add(w.workerId); });
  });
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function nextHarvests(books) {
  const today = books.today;
  return books.fields.map((f) => {
    const lease = books.activeLeaseOn(f.id, today);
    const days = harvestDays(books, f.id);
    if (lease) return { fieldId: f.id, name: f.name, leased: lease.lessee || 'someone' };
    if (days.length < 3) return { fieldId: f.id, name: f.name, tooFew: days.length, last: days.length ? days[days.length - 1].date : null };
    const recent = days.slice(-9);
    const gaps = recent.slice(1).map((d, i) => daysBetween(recent[i].date, d.date));
    const gap = Math.max(1, Math.round(median(gaps)));
    const last = days[days.length - 1].date;
    const due = addDays(last, gap);
    const kgTypical = median(recent.slice(-6).map((d) => d.kg));
    // growth since the last round: longer than usual since the last harvest means more leaf, within reason
    const waited = daysBetween(last, today);
    const factor = Math.min(1.5, Math.max(0.6, waited / gap));
    const perPicker = median(recent.slice(-6).filter((d) => d.pickers.size).map((d) => d.kg / d.pickers.size));
    const expected = kgTypical * (waited >= gap ? factor : 1);
    return {
      fieldId: f.id, name: f.name, last, gap, due, overdueBy: daysBetween(due, today), waited,
      kgLow: Math.round(expected * 0.85), kgHigh: Math.round(expected * 1.15), kgTypical: Math.round(kgTypical),
      workers: perPicker ? Math.max(1, Math.ceil(expected / perPicker)) : null, perPicker: perPicker ? Math.round(perPicker) : null,
      rounds: recent.length,
    };
  }).sort((a, b) => (b.overdueBy ?? -999) - (a.overdueBy ?? -999));
}

export function manureNeeds(books) {
  const today = books.today;
  const rows = books.fields.filter((f) => !books.activeLeaseOn(f.id, today)).map((f) => {
    const mine = books.work.filter((w) => w.fieldId === f.id && w.type === 'manure' && !w.byLessee && w.bagsApplied > 0);
    const item = fieldPlan(books, f.id).items.find((i) => i.type === 'manure');
    const bagsTypical = mine.length ? Math.round(median(mine.slice(-3).map((w) => w.bagsApplied))) : null;
    // what was used, and how the yield moved afterwards, per type
    const types = new Map();
    mine.forEach((w) => {
      const ba = beforeAfter(books, w);
      w.items.forEach((it) => {
        const name = (it.stockId ? books.stockById.get(it.stockId)?.name : it.name) || 'Manure';
        if (!types.has(name)) types.set(name, { name, times: 0, bags: 0, changes: [] });
        const t = types.get(name);
        t.times += 1; t.bags = r2(t.bags + it.qty);
        if (ba && ba.pct != null) t.changes.push(ba.pct);
      });
    });
    return {
      fieldId: f.id, name: f.name, acres: num(f.acres), status: item.status, tag: item.tag, last: item.last, due: item.due || null,
      bags: bagsTypical, perAcre: bagsTypical && num(f.acres) ? r2(bagsTypical / num(f.acres)) : null,
      types: [...types.values()].map((t) => ({ ...t, avgChange: t.changes.length ? Math.round(t.changes.reduce((s, x) => s + x, 0) / t.changes.length) : null })),
    };
  });
  const soon = rows.filter((r) => r.status === 'now' || r.status === 'soon');
  const need = sum(soon, (r) => r.bags || 0);
  const inStock = sum(books.stock, (s) => Math.max(0, s.left));
  const lastPrice = books.stock.length ? books.stock[0].unitCost : null;
  return { rows, soon, need, inStock, toBuy: Math.max(0, r2(need - inStock)), cost: lastPrice ? Math.round(Math.max(0, need - inStock) * lastPrice) : null, lastPrice };
}

export function pendingWork(books) {
  const today = books.today;
  const out = books.attention.map((a) => ({ what: a.title, detail: a.sub, amount: a.amount ?? null }));
  books.fields.forEach((f) => {
    if (books.activeLeaseOn(f.id, today)) return;
    fieldPlan(books, f.id).items.filter((i) => i.status === 'now' || i.status === 'soon').forEach((i) => out.push({ what: `${i.label} on ${f.name}`, detail: i.tag, amount: i.estCost }));
  });
  books.notes.filter((n) => n.kind === 'todo' && !n.done).forEach((n) => out.push({ what: n.text, detail: n.assignee ? `For ${n.assignee}` : 'Note', amount: null }));
  return out;
}

// A plain-text picture of the business, with no names of workers or tenants,
// to paste into any AI assistant for a second opinion.
export function summaryForAI(books) {
  const today = books.today;
  const fy = fyBounds(today);
  const p = books.pnl({ from: fy.from, to: today });
  const prev = books.pnl({ from: addDays(fy.from, -365), to: addDays(today, -365) });
  const L = [];
  const money = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${inr(v)}`);
  L.push(`Family business summary as of ${fmtDate(today)} (India; financial year from ${fmtDate(fy.from)}). Amounts in Indian rupees.`, '');
  L.push('THIS YEAR SO FAR', `Income ${inr(p.incomeTotal)}, regular costs ${inr(p.regular)}, one-time costs ${inr(p.oneTimeTotal)}, profit ${inr(p.profit)}.`,
    `Same period last year: income ${inr(prev.incomeTotal)}, regular costs ${inr(prev.regular)}, profit ${inr(prev.profit)}.`, 'Income by type:', ...money(p.income), 'Costs by type:', ...money(p.expense), '');
  L.push('TEA FIELDS (this year, valued on the harvest date)');
  books.byField({ from: fy.from, to: today }).forEach((f) => L.push(`  ${f.name}${f.acres ? `, ${f.acres} acres` : ''}: ${f.netKg.toFixed(0)} kg${f.kgPerAcre != null ? ` (${f.kgPerAcre.toFixed(0)} kg/acre)` : ''}, tea value ${inr(f.income)}, wages ${inr(f.wages)}, manure and field work ${inr(f.work)}, left ${inr(f.profit)}${f.unratedKg ? `, ${f.unratedKg.toFixed(0)} kg not yet priced` : ''}`));
  L.push('', 'AGENTS (this year)');
  books.byAgent({ from: fy.from, to: today }).forEach((a, i) => L.push(`  Agent ${i + 1}: ${a.netKg.toFixed(0)} kg, average rate ${a.avgRate != null ? '₹' + a.avgRate.toFixed(2) : 'not known'}, deducts ${a.dedPct != null ? a.dedPct.toFixed(1) + '%' : '?'} of weight (water ${a.waterPct != null ? a.waterPct.toFixed(1) + '%' : '?'}), pays in ${a.daysToPay ?? '?'} days`));
  L.push('', 'NEXT HARVEST, FROM PAST ROUNDS');
  nextHarvests(books).forEach((h) => L.push(h.leased ? `  ${h.name}: leased out` : h.tooFew != null ? `  ${h.name}: too few harvests logged to estimate` : `  ${h.name}: last harvested ${fmtDate(h.last)}, usually every ${h.gap} days, expect ${h.kgLow}–${h.kgHigh} kg, about ${h.workers ?? '?'} pickers`));
  const m = manureNeeds(books);
  L.push('', 'MANURING');
  m.rows.forEach((r) => L.push(`  ${r.name}: ${r.last ? 'last manured ' + fmtDate(r.last) : 'no manuring logged'}, ${r.tag}${r.bags ? `, usually ${r.bags} bags` : ''}${r.types.length ? '; used ' + r.types.map((t) => `${t.name} ×${t.times}${t.avgChange != null ? ` (yield ${t.avgChange > 0 ? '+' : ''}${t.avgChange}% after)` : ''}`).join(', ') : ''}`));
  L.push(`  Bags in stock: ${m.inStock}. Needed soon: ${m.need}.`);
  L.push('', 'RENTALS');
  books.tenancies.filter((t) => t.isActive).forEach((t, i) => L.push(`  Property ${i + 1}: rent ${inr(t.currentRent)} a month, unchanged for ${t.lastChange ? Math.round(daysBetween(t.lastChange, today) / 30.44) : '?'} months, ${t.unpaidMonths.length} month(s) unpaid`));
  const f = forecastNextMonth(books);
  if (f) L.push('', `ESTIMATE FOR NEXT MONTH: ${f.kgLow}–${f.kgHigh} kg.`);
  const tips = doBetter(books);
  if (tips.length) L.push('', 'WHAT THE APP ALREADY FLAGS', ...tips.map((t) => `  ${t.title}. ${t.detail}`));
  L.push('', 'QUESTIONS', '1. What is going well and what is not?', '2. Where am I losing money, and what would you change first?',
    '3. Are there alternatives I am not considering (agents, timing of harvest, leasing a field, pay method, fertilizer choice)?',
    '4. What should I check before deciding on manuring this season? What type would you consider for tea at this stage and why, and what would a soil test tell me?',
    '5. Which of my recent decisions look questionable from these numbers?');
  return L.join('\n');
}
