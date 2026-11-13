// Advice worked out from the books: where to do better, when to manure and
// maintain, what a field lease is worth, and simple forecasts. Rule-based and
// explainable — every item says what it is based on.
import { r2, num, sum, addDays, addMonths, daysBetween, inRange, monthKey, fmtDate, fyBounds } from './util';
import { WORK_LABEL } from './books';

const DEFAULT_SCHEDULE = { manureMonths: 6, weedWeeks: 8, pruneYears: 4, pestWeeks: 0, rainLimitMm: 40 };
export const scheduleOf = (field) => ({ ...DEFAULT_SCHEDULE, ...(field?.schedule || {}) });

const windowOf = (today, days) => ({ from: addDays(today, -days + 1), to: today });

// kg per acre per week for one field over a window
export function yieldRate(books, fieldId, from, to) {
  const f = books.fieldById.get(fieldId);
  const acres = num(f?.acres) || 1;
  const kgs = sum(books.deliveries.filter((d) => d.fieldId === fieldId && d.date >= from && d.date <= to), (d) => d.net);
  const weeks = Math.max(1, (daysBetween(from, to) + 1) / 7);
  return { kg: kgs, perAcreWeek: r2(kgs / acres / weeks), weeks };
}

export function rainPerWeek(books, from, to) {
  let total = 0, days = 0;
  books.rainByDate.forEach((r, date) => { if (date >= from && date <= to && r.mm != null) { total += num(r.mm); days += 1; } });
  const weeks = Math.max(1, (daysBetween(from, to) + 1) / 7);
  return days ? r2(total / weeks) : null;
}

// Yield before and after a piece of work (normally manuring) on a field.
export function beforeAfter(books, w, weeks = 8) {
  const today = books.today;
  const before = yieldRate(books, w.fieldId, addDays(w.date, -weeks * 7), addDays(w.date, -1));
  const afterEnd = addDays(w.date, weeks * 7) < today ? addDays(w.date, weeks * 7) : today;
  if (afterEnd <= w.date) return null;
  const after = yieldRate(books, w.fieldId, addDays(w.date, 1), afterEnd);
  const weeksAfter = Math.round((daysBetween(w.date, afterEnd)) / 7);
  if (!before.kg || !after.kg || weeksAfter < 2) return { before, after, weeksAfter, pct: null };
  return {
    before, after, weeksAfter,
    pct: before.perAcreWeek > 0 ? r2(((after.perAcreWeek - before.perAcreWeek) / before.perAcreWeek) * 100) : null,
    rainBefore: rainPerWeek(books, addDays(w.date, -weeks * 7), addDays(w.date, -1)),
    rainAfter: rainPerWeek(books, addDays(w.date, 1), afterEnd),
  };
}

// ── When to manure and maintain ─────────────────────────────────────────────
export function fieldPlan(books, fieldId, forecast = null) {
  const today = books.today;
  const field = books.fieldById.get(fieldId);
  const sch = scheduleOf(field);
  const mine = books.work.filter((w) => w.fieldId === fieldId);
  const lastOf = (type) => mine.filter((w) => w.type === type).map((w) => w.date).sort().pop() || null;
  const avgCost = (type) => {
    const ws = mine.filter((w) => w.type === type).slice(-2);
    return ws.length ? Math.round(sum(ws, (w) => w.fieldCost) / ws.length) : null;
  };
  const recent = yieldRate(books, fieldId, addDays(today, -55), today);
  const lastYear = yieldRate(books, fieldId, addDays(addMonths(today, -12), -55), addMonths(today, -12));
  const trendPct = lastYear.kg > 0 && recent.kg > 0 ? r2(((recent.perAcreWeek - lastYear.perAcreWeek) / lastYear.perAcreWeek) * 100) : null;
  const rain3 = forecast ? sum(forecast.filter((d) => d.date > today && d.date <= addDays(today, 3)), (d) => d.mm) : null;
  const rain7 = forecast ? sum(forecast.filter((d) => d.date > today && d.date <= addDays(today, 7)), (d) => d.mm) : null;

  const item = (type, intervalDays, intervalText) => {
    const last = lastOf(type);
    const out = { type, label: WORK_LABEL[type], last, intervalText, estCost: avgCost(type), reasons: [] };
    if (!intervalDays) {
      out.status = 'watch'; out.tag = 'No schedule';
      out.reasons.push(last ? `Last done ${fmtDate(last)}.` : 'No record yet.');
      return out;
    }
    if (!last) {
      out.status = 'unknown'; out.tag = 'No record yet';
      out.reasons.push(`Nothing logged for this field. Log the last time it was done and the plan starts from there.`);
      return out;
    }
    const due = addDays(last, intervalDays);
    const left = daysBetween(today, due);
    out.due = due;
    out.reasons.push(`Last done ${fmtDate(last)}. Your schedule is every ${intervalText}.`);
    if (left < 0) { out.status = 'now'; out.tag = `Overdue by ${-left} days`; }
    else if (left <= 14) { out.status = 'soon'; out.tag = left === 0 ? 'Due today' : `Due in ${left} days`; }
    else { out.status = 'ok'; out.tag = 'Not due'; out.reasons.push(`Next around ${fmtDate(due)}.`); }
    return out;
  };

  const manure = item('manure', Math.round(sch.manureMonths * 30.44), `${sch.manureMonths} months`);
  if (trendPct != null && trendPct <= -10) {
    manure.reasons.push(`Yield is ${Math.abs(Math.round(trendPct))}% lower than the same weeks last year.`);
    if (manure.status === 'ok') { manure.status = 'soon'; manure.tag = 'Consider earlier'; }
  }
  if (rain3 != null && (manure.status === 'now' || manure.status === 'soon')) {
    if (rain3 > sch.rainLimitMm) { manure.reasons.push(`Heavy rain expected (${Math.round(rain3)} mm in 3 days). Wait until it passes so the manure is not washed away.`); manure.hold = true; }
    else if (rain7 != null && rain7 >= 5) manure.reasons.push(`Light rain expected this week (${Math.round(rain7)} mm). Good conditions: moist soil without washing away.`);
    else manure.reasons.push('No rain expected this week. Manure works best on moist soil, so apply after a shower if you can.');
  }
  const items = [
    manure,
    item('weeding', sch.weedWeeks * 7, `${sch.weedWeeks} weeks`),
    item('pest', sch.pestWeeks * 7, `${sch.pestWeeks} weeks`),
    item('pruning', Math.round(sch.pruneYears * 365.25), `${sch.pruneYears} years`),
  ];
  return { field, schedule: sch, items, trendPct, recent, lastYear };
}

// Work coming up across all fields in the next 12 months, with likely cost.
export function yearAhead(books) {
  const today = books.today;
  const end = addMonths(today, 12);
  const rows = [];
  books.fields.forEach((f) => {
    if (books.activeLeaseOn(f.id, today)) return;
    fieldPlan(books, f.id).items.forEach((it) => {
      if (!it.due) return;
      const date = it.due < today ? today : it.due;
      if (date <= end) rows.push({ date, fieldId: f.id, field: f.name, label: it.label, cost: it.estCost, overdue: it.due < today });
    });
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Lease or keep? ──────────────────────────────────────────────────────────
function fieldProfit(books, fieldId, from, to) {
  const row = books.byField({ from, to }).find((r) => r.fieldId === fieldId);
  if (!row) return null;
  return { ...row, ownProfit: r2(row.income - row.costs) };
}

export function leaseAdvice(books, fieldId, interestPct = 7) {
  const today = books.today;
  const first = books.deliveries.find((d) => d.fieldId === fieldId)?.date;
  const last12 = fieldProfit(books, fieldId, addDays(addMonths(today, -12), 1), today);
  if (!first || !last12 || last12.netKg <= 0) return { enough: false, reason: 'No harvest has been logged for this field in the last 12 months.' };
  const monthsOfData = Math.min(12, Math.max(1, Math.round(daysBetween(first, today) / 30.44)));
  // scale a short history up to a year, and say so
  const yearProfit = r2(last12.ownProfit * (12 / monthsOfData));
  const prev = fieldProfit(books, fieldId, addDays(addMonths(today, -24), 1), addMonths(today, -12));
  const hasPrev = prev && prev.netKg > 0 && daysBetween(first, today) > 540;
  let low = yearProfit * 0.9, high = yearProfit * 1.1;
  if (hasPrev) { low = Math.min(yearProfit, prev.ownProfit) * 0.95; high = Math.max(yearProfit, prev.ownProfit) * 1.05; }
  const round5k = (v) => Math.ceil(v / 5000) * 5000;
  const floor = Math.max(0, Math.round(high / 1000) * 1000);
  const suggested = Math.max(floor, round5k(high * 1.08));
  const rate = Math.max(0.1, num(interestPct)) / 100;
  return {
    enough: true, monthsOfData, scaled: monthsOfData < 12, last12, yearProfit,
    low: Math.round(low), high: Math.round(high), floor, suggested,
    unratedKg: last12.unratedKg,
    compare: (offer, kind = 'rent') => {
      const gain = kind === 'deposit' ? r2(num(offer) * rate) : num(offer);
      return { gain, vsKeeping: r2(gain - yearProfit) };
    },
    depositToMatch: Math.round(yearProfit / rate),
  };
}

// ── Forecast ────────────────────────────────────────────────────────────────
export function forecastNextMonth(books) {
  const today = books.today;
  const nextMk = monthKey(addMonths(monthKey(today) + '-01', 1));
  const kgIn = (from, to) => sum(books.deliveries.filter((d) => d.date >= from && d.date <= to), (d) => d.net);
  const sameMonthLastYear = (() => {
    const from = addMonths(nextMk + '-01', -12);
    return kgIn(from, addDays(addMonths(from, 1), -1));
  })();
  const recent = kgIn(addDays(today, -59), today);
  const recentLastYear = kgIn(addDays(addMonths(today, -12), -59), addMonths(today, -12));
  let kgs = null, basis = '';
  if (sameMonthLastYear > 0 && recentLastYear > 0 && recent > 0) {
    const trend = Math.min(1.5, Math.max(0.5, recent / recentLastYear));
    kgs = sameMonthLastYear * trend;
    basis = 'the same month last year, adjusted for how this year is running';
  } else if (recent > 0) {
    kgs = (recent / 60) * 30;
    basis = 'the last 60 days (no data yet for the same month last year)';
  }
  if (kgs == null) return null;
  const y = books.pnl({ from: addDays(today, -179), to: today }, { business: 'tea' });
  const kg180 = kgIn(addDays(today, -179), today);
  const marginPerKg = kg180 > 0 ? (y.incomeTotal - y.regular) / kg180 : 0;
  return {
    month: nextMk, basis,
    kgLow: Math.round(kgs * 0.88), kgHigh: Math.round(kgs * 1.12),
    profitLow: Math.round(kgs * 0.88 * marginPerKg), profitHigh: Math.round(kgs * 1.12 * marginPerKg),
  };
}

// ── Where to do better ──────────────────────────────────────────────────────
export function doBetter(books) {
  const today = books.today;
  const out = [];
  const add = (x) => out.push({ value: null, ...x });
  const half = windowOf(today, 182);
  const scale = 2; // 182 days -> a year

  // 1. An agent who deducts more for water / bags than another
  const ag = books.byAgent(half).filter((a) => a.deliveries >= 4 && a.dedPct != null);
  if (ag.length >= 2) {
    const sorted = ag.slice().sort((a, b) => a.dedPct - b.dedPct);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    const gap = r2(worst.dedPct - best.dedPct);
    if (gap >= 1) {
      const grossKg = worst.netKg / (1 - worst.dedPct / 100);
      const rate = worst.avgRate || best.avgRate || 0;
      add({
        area: 'tea', title: `${worst.name} deducts more weight`,
        detail: `Over the last 6 months ${worst.name} deducted ${worst.dedPct.toFixed(1)}% of the weight and ${best.name} ${best.dedPct.toFixed(1)}%.`,
        action: `Ask ${worst.name} about it, or send more leaf to ${best.name}.`,
        value: rate ? Math.round((gap / 100) * grossKg * rate * scale) : null, link: { tab: 'agents' },
      });
    }
  }
  // 2. An agent who pays a better rate
  const rated = ag.filter((a) => a.avgRate);
  if (rated.length >= 2) {
    const sorted = rated.slice().sort((a, b) => b.avgRate - a.avgRate);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    const gap = r2(best.avgRate - worst.avgRate);
    if (gap >= 0.5) add({
      area: 'tea', title: `${best.name} pays a better rate`,
      detail: `Over 6 months ${best.name} paid ₹${gap.toFixed(2)} more per kg than ${worst.name}` + (best.daysToPay != null && worst.daysToPay != null ? `, and paid in ${best.daysToPay} days against ${worst.daysToPay}.` : '.'),
      action: `Move about a third of ${worst.name}'s leaf to ${best.name}.`,
      value: Math.round(gap * worst.netKg * 0.33 * scale), link: { tab: 'agents' },
    });
  }
  // 3. A field that is falling behind the best one
  const q = windowOf(today, 91);
  const fr = books.fields.filter((f) => num(f.acres) > 0 && !books.activeLeaseOn(f.id, today))
    .map((f) => ({ f, y: yieldRate(books, f.id, q.from, q.to) })).filter((x) => x.y.kg > 0);
  if (fr.length >= 2) {
    const best = fr.slice().sort((a, b) => b.y.perAcreWeek - a.y.perAcreWeek)[0];
    const avgRate = (() => { const a = books.byAgent(half); const kgs = sum(a, (x) => x.ratedKg); return kgs > 0 ? sum(a, (x) => x.value) / kgs : 0; })();
    fr.forEach(({ f, y }) => {
      if (f.id === best.f.id || y.perAcreWeek > best.y.perAcreWeek * 0.75) return;
      const lastManure = books.work.filter((w) => w.fieldId === f.id && w.type === 'manure').map((w) => w.date).sort().pop();
      const months = lastManure ? Math.round(daysBetween(lastManure, today) / 30.44) : null;
      add({
        area: 'tea', title: `${f.name} is falling behind`,
        detail: `${y.perAcreWeek.toFixed(0)} kg per acre each week against ${best.y.perAcreWeek.toFixed(0)} on ${best.f.name}.` + (months != null ? ` Last manured ${months} months ago.` : ' No manuring logged.'),
        action: 'Manure it this season, or see whether leasing it would earn more.',
        // closing half the gap, at the average rate
        value: avgRate ? Math.round((best.y.perAcreWeek - y.perAcreWeek) * 0.5 * num(f.acres) * 52 * avgRate) : null,
        link: { field: f.id },
      });
    });
  }
  // 4. Rent that has not changed for a long time
  const increases = books.tenancies.flatMap((t) => t.rents.filter((r) => r.pct != null && r.pct > 0).map((r) => r.pct));
  const usual = increases.length ? r2(increases.reduce((s, x) => s + x, 0) / increases.length) : null;
  books.tenancies.filter((t) => t.isActive && t.currentRent > 0).forEach((t) => {
    const since = t.lastChange || t.start;
    if (!since) return;
    const months = Math.round(daysBetween(since, today) / 30.44);
    if (months >= 18) add({
      area: 'rental', title: `${t.propertyName} rent has not changed in ${months} months`,
      detail: usual ? `Your other rent increases have averaged ${usual.toFixed(0)}%.` : `The rent has been ${t.currentRent.toLocaleString('en-IN')} since ${fmtDate(since)}.`,
      action: 'Raise it at the next renewal.',
      value: usual ? Math.round(t.currentRent * 12 * (usual / 100)) : null, link: { property: t.propertyId },
    });
  });
  // 5. Picking on a daily wage costs more per kg than paying per kg
  const ds = books.deliveries.filter((d) => inRange(d.date, half));
  const dayRows = ds.flatMap((d) => d.workers.filter((w) => w.dayWage > 0 && w.netKg > 0));
  const kgRows = ds.flatMap((d) => d.workers.filter((w) => w.kgWage > 0 && w.netKg > 0 && !w.dayWage));
  if (dayRows.length >= 3 && kgRows.length >= 3) {
    const dayCost = sum(dayRows, (w) => w.wage) / sum(dayRows, (w) => w.netKg);
    const kgCost = sum(kgRows, (w) => w.wage) / sum(kgRows, (w) => w.netKg);
    if (dayCost > kgCost * 1.15) add({
      area: 'tea', title: 'Daily wage days cost more per kg',
      detail: `On daily wage days picking cost ₹${dayCost.toFixed(2)} per kg. On per-kg days it is ₹${kgCost.toFixed(2)}.`,
      action: 'Keep daily wage for field work, and pay picking per kg.',
      value: Math.round((dayCost - kgCost) * sum(dayRows, (w) => w.netKg) * scale), link: { tab: 'workers' },
    });
  }
  // 6. Spending that is growing fast compared with the same period last year
  const fy = fyBounds(today);
  const cur = { from: fy.from, to: today };
  const prev = { from: addMonths(fy.from, -12), to: addMonths(today, -12) };
  const a = books.pnl(cur), b = books.pnl(prev);
  a.expense.forEach((amt, cat) => {
    const was = b.expense.get(cat) || 0;
    if (was >= 2000 && amt > was * 1.25) add({
      area: 'all', title: `${cat} is up ${Math.round(((amt - was) / was) * 100)}%`,
      detail: `₹${Math.round(amt).toLocaleString('en-IN')} so far this year against ₹${Math.round(was).toLocaleString('en-IN')} by this time last year.`,
      action: 'Open the entries and check prices and quantities.',
      value: null, tag: 'check', link: { entries: { cat } },
    });
  });
  // 7. Advances that are building up
  const adv = books.workers.filter((w) => w.advanceBalance > 0.5);
  if (adv.length) {
    const idle = adv.filter((w) => !w.lastWork || daysBetween(w.lastWork, today) > 35);
    add({
      area: 'tea', title: 'Advances are outstanding',
      detail: `${adv.length} ${adv.length === 1 ? 'worker owes' : 'workers owe'} advances` + (idle.length ? `, and ${idle.map((w) => w.name).join(', ')} ${idle.length === 1 ? 'has' : 'have'} not worked for over 5 weeks.` : '.'),
      action: 'Take a fixed amount back from each payment.',
      value: null, tag: `₹${Math.round(sum(adv, (w) => w.advanceBalance)).toLocaleString('en-IN')} out`, link: { tab: 'workers' },
    });
  }
  // 8. Agents who are slow to pay
  books.agents.filter((x) => x.daysToPay != null && x.daysToPay >= 14 && x.balance > 0.5).forEach((x) => add({
    area: 'tea', title: `${x.name} is slow to pay`,
    detail: `On average ${x.daysToPay} days after delivery, and ₹${Math.round(x.balance).toLocaleString('en-IN')} is still to come. You pay the workers before that.`,
    action: 'Ask for payment within a week of the last delivery.', value: null, tag: 'cash tied up', link: { tab: 'agents' },
  }));

  return out.sort((x, y) => (y.value || 0) - (x.value || 0));
}

// Spending compared with the same period a year earlier, largest growth first.
export function spendingGrowth(books, period) {
  const prev = { from: addMonths(period.from, -12), to: addMonths(period.to, -12) };
  const a = books.pnl(period), b = books.pnl(prev);
  const cats = new Set([...a.expense.keys(), ...b.expense.keys()]);
  return [...cats].map((cat) => {
    const now = a.expense.get(cat) || 0, was = b.expense.get(cat) || 0;
    return { cat, now, was, pct: was > 0 ? r2(((now - was) / was) * 100) : null };
  }).sort((x, y) => (y.now - y.was) - (x.now - x.was));
}
