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

// How many bags of each type to buy for the fields due for manuring.
//   bags for a field = its usual bags per acre (its own last applications, or
//   the average of the other fields) × acres, adjusted for how much the field
//   yields compared with the others (more leaf taken off, more to put back),
//   within ±20%. Split by type using the mix last applied to that field.
export function manureBuyPlan(books) {
  const today = books.today;
  const fields = books.fields.filter((f) => !books.activeLeaseOn(f.id, today));
  const year = { from: addDays(today, -364), to: today };
  const rows = books.byField(year);
  const kpa = (id) => rows.find((r) => r.fieldId === id)?.kgPerAcre || null;
  const yields = fields.map((f) => kpa(f.id)).filter((x) => x);
  const avgYield = yields.length ? yields.reduce((t, x) => t + x, 0) / yields.length : null;
  const apps = (fid) => books.work.filter((w) => w.fieldId === fid && w.type === 'manure' && !w.byLessee && w.bagsApplied > 0);
  const perAcre = (f) => { const a = num(f.acres); const ws = apps(f.id).slice(-3); return a > 0 && ws.length ? median(ws.map((w) => w.bagsApplied / a)) : null; };
  const allRates = fields.map(perAcre).filter((x) => x);
  const fallbackRate = allRates.length ? median(allRates) : null;
  const compOfWork = (w) => {
    const out = {};
    w.items.forEach((it) => {
      const comp = it.stockId ? books.compositionOf(it.stockId) : { [it.name || 'Manure']: 1 };
      Object.entries(comp).forEach(([k, v]) => { out[k] = (out[k] || 0) + v * it.qty; });
    });
    const t = Object.values(out).reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v / t]));
  };
  const lastAny = books.work.filter((w) => w.type === 'manure' && !w.byLessee && w.items.length).slice(-1)[0];
  const due = [];
  fields.forEach((f) => {
    const item = fieldPlan(books, f.id).items.find((i) => i.type === 'manure');
    if (item.status !== 'now' && item.status !== 'soon' && item.status !== 'unknown') return;
    const rate = perAcre(f) || fallbackRate;
    const acres = num(f.acres);
    if (!rate || !acres) { due.push({ fieldId: f.id, name: f.name, tag: item.tag, bags: null, why: !acres ? 'Field size not set' : 'No manuring logged yet to go by' }); return; }
    const adj = avgYield && kpa(f.id) ? Math.min(1.2, Math.max(0.8, kpa(f.id) / avgYield)) : 1;
    const bags = Math.ceil(rate * acres * adj);
    const last = apps(f.id).slice(-1)[0] || lastAny;
    due.push({
      fieldId: f.id, name: f.name, tag: item.tag, bags, rate: r2(rate), own: !!perAcre(f), adj: r2(adj),
      comp: last ? compOfWork(last) : {}, compFrom: last ? (last.fieldId === f.id ? 'its last manuring' : `the last manuring on ${last.fieldName}`) : null,
    });
  });
  // by type: needed, in stock (bought and not yet mixed or applied, plus what is in mixes still in bags)
  const byType = new Map();
  const add = (name, key, v) => { if (!byType.has(name)) byType.set(name, { name, need: 0, have: 0, price: null }); byType.get(name)[key] = r2(byType.get(name)[key] + v); };
  due.forEach((d) => { if (d.bags) Object.entries(d.comp).forEach(([k, v]) => add(k, 'need', d.bags * v)); });
  books.stock.filter((st) => st.left > 0).forEach((st) => Object.entries(books.compositionOf(st.id)).forEach(([k, v]) => add(k, 'have', st.left * v)));
  books.stock.filter((st) => st.kind !== 'mix').slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((st) => { const t = byType.get(st.name); if (t && t.price == null) t.price = st.unitCost; });
  const types = [...byType.values()].filter((t) => t.need > 0).map((t) => ({ ...t, need: Math.ceil(t.need), toBuy: Math.max(0, Math.ceil(t.need - t.have)) }))
    .map((t) => ({ ...t, cost: t.price != null ? Math.round(t.toBuy * t.price) : null }));
  return { due, types, unsplit: sum(due.filter((d) => d.bags && !Object.keys(d.comp).length), (d) => d.bags), total: sum(due, (d) => d.bags || 0), cost: sum(types, (t) => t.cost || 0) };
}

// One idea a day for the Home screen. Rotates through what the books show,
// so it changes daily without repeating until the list runs out.
export function ideasForHome(books) {
  const out = doBetter(books).map((t) => ({ title: t.title, text: `${t.detail} ${t.action}`, value: t.value, link: t.link }));
  nextHarvests(books).filter((h) => h.overdueBy != null && h.overdueBy >= 3).forEach((h) => out.push({ title: `${h.name} is ${h.overdueBy} days past its usual round`, text: `Leaf left too long gets coarse and agents deduct more. Expect ${h.kgLow}–${h.kgHigh} kg with about ${h.workers ?? '?'} pickers.`, link: { field: h.fieldId } }));
  const buy = manureBuyPlan(books);
  if (buy.types.some((t) => t.toBuy > 0)) out.push({ title: 'Buy manure before the fields need it', text: `About ${buy.types.filter((t) => t.toBuy > 0).map((t) => `${t.toBuy} bags of ${t.name}`).join(', ')} for the fields due now. Buying several types in one trip shares one transport charge.`, link: { tab: 'plan' } });
  books.leases.filter((l) => l.status === 'active' && l.daysLeft <= 60).forEach((l) => out.push({ title: `${l.fieldName}'s lease ends in ${l.daysLeft} days`, text: 'Decide now whether to lease it again or take it back: the Lease tab on the field compares the two with your own figures.', link: { field: l.fieldId } }));
  books.agents.filter((a) => a.unratedKg > 0 && a.unrated.length && daysBetween(a.unrated[0].date, books.today) > 14).forEach((a) => out.push({ title: `${a.name} has not paid for ${a.unratedKg.toFixed(0)} kg`, text: `The oldest unpaid delivery is ${daysBetween(a.unrated[0].date, books.today)} days old. Ask for the rate and the payment.`, link: { tab: 'agents' } }));
  return out;
}

// Every day in a period: harvested, marked "no harvest", or not accounted for.
export function dayAccounting(books, period) {
  const harvested = new Set(books.deliveries.map((d) => d.date));
  const none = new Map(books.notes.filter((n) => n.kind === 'noharvest').map((n) => [n.date, n]));
  const first = books.deliveries.length ? books.deliveries[0].date : null;
  const from = first && first > period.from ? first : period.from;
  const to = period.to < books.today ? period.to : books.today;
  const days = { harvested: [], none: [], missing: [] };
  if (!first || from > to || daysBetween(from, to) > 800) return { ...days, from, to };
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (harvested.has(d)) days.harvested.push(d); else if (none.has(d)) days.none.push(d); else days.missing.push(d);
  }
  return { ...days, from, to, noneNotes: none };
}

// What one worker earned, day by day, in a period
export function workerDays(books, workerId, period) {
  const w = books.workerById.get(workerId);
  if (!w) return null;
  const by = new Map();
  w.rows.filter((r) => r.date >= period.from && r.date <= period.to).forEach((r) => {
    if (!by.has(r.date)) by.set(r.date, { date: r.date, kg: 0, wage: 0, fields: new Set(), daily: 0 });
    const d = by.get(r.date);
    d.kg = r2(d.kg + r.netKg); d.wage = r2(d.wage + r.wage); d.fields.add(r.fieldName); d.daily = r2(d.daily + r.dayWage);
  });
  const days = [...by.values()].map((d) => ({ ...d, fields: [...d.fields].join(', ') })).sort((a, b) => b.date.localeCompare(a.date));
  const pay = w.pay.filter((e) => e.date >= period.from && e.date <= period.to);
  const adv = w.advances.filter((e) => e.date >= period.from && e.date <= period.to);
  return { w, days, earned: sum(days, (d) => d.wage), kg: sum(days, (d) => d.kg), paid: sum(pay, (e) => e.amount), recovered: sum(pay, (e) => num(e.advanceRecovered)), pay, adv, advGiven: sum(adv, (e) => e.amount) };
}
