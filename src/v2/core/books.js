// The books: every total in the app is derived here, from the raw records,
// in one pass. Screens never add things up themselves, so two pages cannot
// disagree. No Firebase, no React — plain data in, plain data out.
import {
  r2, num, sum, inRange, byDateAsc, byDateDesc, groupBy, monthKey, monthsFrom,
  addDays, daysBetween, fmtMonth, fmtDate, addMonths,
} from './util';

export const COLLECTIONS = [
  'people', 'fields', 'properties', 'tenancies', 'deliveries', 'work', 'stock',
  'equipment', 'leases', 'entries', 'rain', 'notes', 'settings',
];

export const DEFAULT_KG_RATE = 6;
export const DEFAULT_HANDLERS = ['Me', 'Ragu', 'Mom'];
export const MODES = [['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank transfer'], ['cheque', 'Cheque']];
export const MODE_LABEL = Object.fromEntries(MODES);
export const DIFF_REASONS = [
  ['round', 'Rounded off'],
  ['later', 'Settle next time'],
  ['gift', 'Gift or help'],
  ['agreed', 'Agreed amount'],
  ['mistake', 'Mistake'],
];
export const DIFF_LABEL = Object.fromEntries(DIFF_REASONS);
export const WORK_TYPES = [
  ['manure', 'Manuring'], ['weeding', 'Weeding'], ['pest', 'Pest control'],
  ['pruning', 'Pruning'], ['other', 'Other field work'],
];
export const WORK_LABEL = Object.fromEntries(WORK_TYPES);

// What each kind of money entry means for cash and for profit.
//   pnl: income | expense | capital (equipment) | advance (to a worker) |
//        deposit (money held that must be returned) | none
export const KINDS = {
  tea_sale:              { dir: 'in',  pnl: 'income',  cat: 'Tea sales', biz: 'tea' },
  lease_rent:            { dir: 'in',  pnl: 'income',  cat: 'Field lease', biz: 'tea' },
  rent:                  { dir: 'in',  pnl: 'income',  cat: 'Rent', biz: 'rental' },
  misc_in:               { dir: 'in',  pnl: 'income',  cat: 'Other income' },
  wages:                 { dir: 'out', pnl: 'expense', cat: 'Worker wages', biz: 'tea' },
  stock:                 { dir: 'out', pnl: 'expense', cat: 'Manure and materials', biz: 'tea' },
  work:                  { dir: 'out', pnl: 'expense', cat: 'Field work', biz: 'tea' },
  misc:                  { dir: 'out', pnl: 'expense', cat: 'Other expenses' },
  equipment_run:         { dir: 'out', pnl: 'expense', cat: 'Equipment fuel and repairs', biz: 'tea' },
  rental_expense:        { dir: 'out', pnl: 'expense', cat: 'Rental property expenses', biz: 'rental' },
  home_expense:          { dir: 'out', pnl: 'expense', cat: 'Home expenses', biz: 'home' },
  equipment:             { dir: 'out', pnl: 'capital', cat: 'Equipment bought', biz: 'tea' },
  advance:               { dir: 'out', pnl: 'advance', cat: 'Advance to worker', biz: 'tea' },
  advance_recovery:      { dir: 'out', pnl: 'none',    cat: 'Advance taken back', biz: 'tea' },
  lease_deposit:         { dir: 'in',  pnl: 'deposit', cat: 'Field lease deposit', biz: 'tea' },
  lease_deposit_return:  { dir: 'out', pnl: 'deposit', cat: 'Field lease deposit returned', biz: 'tea' },
  tenant_advance:        { dir: 'in',  pnl: 'deposit', cat: 'Tenant advance', biz: 'rental' },
  tenant_advance_return: { dir: 'out', pnl: 'deposit', cat: 'Tenant advance returned', biz: 'rental' },
};

const live = (arr) => (arr || []).filter((x) => x && !x.deleted);
const TOL = 0.011;

// A difference that is not "settle next time" is closed: the full expected
// amount counts as settled even though a different amount changed hands.
// Kg x rate rarely comes to a whole rupee but people pay in whole rupees, so a
// difference of less than one rupee is rounding: it settles on its own and
// never builds up into a balance.
const isRounding = (e) => e.expected != null && Math.abs(num(e.amount) - num(e.expected)) < 1;
export const isClosedDiff = (e) => e.expected != null && (isRounding(e) || (!!e.diffReason && e.diffReason !== 'later'));
export const settledCash = (e) => (isClosedDiff(e) ? num(e.expected) : num(e.amount));
export const entryDiff = (e) => (e.expected == null || isRounding(e) ? 0 : r2(num(e.amount) - num(e.expected)));

export const kgRateFor = (person) =>
  person && person.payBasis === 'day' ? 0 : num(person?.kgRate ?? DEFAULT_KG_RATE);

// ── One delivery (a harvest day to one agent from one field) ────────────────
// Bags are weighed individually; the agent's deduction is one figure for the
// whole delivery. Net kg is shared between workers by the weight each picked,
// and per-kg wages are paid on that net share.
export function computeDelivery(d, personById = new Map()) {
  const bags = (d.bags || []).map((b) => ({ kg: num(b.kg), workerId: b.workerId || '' })).filter((b) => b.kg > 0);
  const gross = sum(bags, (b) => b.kg);
  const bagDed = num(d.bagDed);
  const waterDed = num(d.waterDed);
  const ded = r2(bagDed + waterDed);
  const net = r2(Math.max(0, gross - ded));

  const grossBy = new Map();
  bags.forEach((b) => grossBy.set(b.workerId, r2((grossBy.get(b.workerId) || 0) + b.kg)));
  const ids = [...grossBy.keys()];
  const rows = new Map();
  let allocated = 0;
  ids.forEach((id, i) => {
    const g = grossBy.get(id);
    const exact = gross > 0 ? (net * g) / gross : 0;
    // the last share takes the remainder, so the shares always add up to net
    const netKg = i === ids.length - 1 ? r2(net - allocated) : r2(exact);
    allocated = r2(allocated + netKg);
    const rate = d.kgRates && d.kgRates[id] != null ? num(d.kgRates[id]) : kgRateFor(personById.get(id));
    const override = d.wageOverride && d.wageOverride[id] != null ? num(d.wageOverride[id]) : null;
    const kgWage = override != null ? override : Math.round(exact * rate);
    rows.set(id, { workerId: id, grossKg: g, netKg, kgRate: rate, kgWage, dayWage: 0, days: 0 });
  });
  (d.dayWork || []).forEach((w) => {
    const id = w.workerId || '';
    const amt = r2(num(w.days) * num(w.dayRate));
    if (!rows.has(id)) rows.set(id, { workerId: id, grossKg: 0, netKg: 0, kgRate: 0, kgWage: 0, dayWage: 0, days: 0 });
    const row = rows.get(id);
    row.dayWage = r2(row.dayWage + amt);
    row.days = r2(row.days + num(w.days));
  });
  const workers = [...rows.values()].map((w) => ({ ...w, wage: r2(w.kgWage + w.dayWage) }));
  const hasRate = d.rate !== null && d.rate !== undefined && d.rate !== '' && num(d.rate) > 0;
  const rate = hasRate ? num(d.rate) : null;
  return {
    bags, gross, bagDed, waterDed, ded, net,
    waterPct: gross > 0 ? r2((waterDed / gross) * 100) : 0,
    dedPct: gross > 0 ? r2((ded / gross) * 100) : 0,
    overDeducted: ded > gross + TOL,
    workers,
    wages: sum(workers, (w) => w.wage),
    rate,
    value: rate != null ? r2(net * rate) : null,
  };
}

export function workCost(w, stockById = new Map()) {
  let labour = 0;
  if (w.labourMode === 'bag') labour = num(w.bags) * num(w.rate);
  else if (w.labourMode === 'fixed') labour = num(w.fixedAmount);
  else labour = (num(w.people) || (num(w.days) || num(w.rate) ? 1 : 0)) * num(w.days) * num(w.rate);
  const items = (w.items || []).map((it) => {
    const st = it.stockId ? stockById.get(it.stockId) : null;
    const qty = num(it.qty);
    const unit = st ? st.unitCost : num(it.unitCost);
    return { ...it, qty, fromStock: !!st, value: r2(qty * unit), direct: st ? 0 : r2(qty * num(it.unitCost)) };
  });
  const direct = sum(items, (it) => it.direct);
  const stockValue = sum(items.filter((it) => it.fromStock), (it) => it.value);
  const computed = r2(labour + direct);
  return {
    labour: r2(labour), items, direct, stockValue,
    // what has to be paid for this work now (stock was paid for when bought)
    cost: w.costOverride != null ? num(w.costOverride) : computed,
    // full cost of the work to the field, including manure taken from stock
    fieldCost: r2((w.costOverride != null ? num(w.costOverride) : computed) + stockValue),
    bagsApplied: sum(items.filter((it) => it.fromStock || w.type === 'manure'), (it) => it.qty),
  };
}

// ── The whole set of books ──────────────────────────────────────────────────
export function buildBooks(raw, today) {
  const people = live(raw.people);
  const fields = live(raw.fields);
  const properties = live(raw.properties);
  const rawEntries = live(raw.entries);
  const personById = new Map(people.map((p) => [p.id, p]));
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const nameOf = (id) => personById.get(id)?.name || '';
  const fieldName = (id) => fieldById.get(id)?.name || '';
  const propName = (id) => propertyById.get(id)?.name || '';

  const settings = (raw.settings || []).find((s) => s.id === 'app') || {};
  const handlers = settings.handlers && settings.handlers.length ? settings.handlers : DEFAULT_HANDLERS;
  const rainByDate = new Map(live(raw.rain).map((r) => [r.date || r.id, r]));

  // ── stock (manure and material bought in bulk) ───────────────────────────
  const stockBase = live(raw.stock).map((s) => {
    const bags = num(s.bags);
    const cost = s.costOverride != null ? num(s.costOverride) : r2(bags * num(s.costPerBag) + num(s.transport));
    return { ...s, bags, cost, unitCost: bags > 0 ? cost / bags : 0 };
  });
  const stockById = new Map(stockBase.map((s) => [s.id, s]));

  // ── deliveries ───────────────────────────────────────────────────────────
  const deliveries = live(raw.deliveries).map((d) => ({
    ...d, ...computeDelivery(d, personById),
    fieldName: fieldName(d.fieldId), agentName: nameOf(d.agentId),
    rainMm: d.rainMm != null && d.rainMm !== '' ? num(d.rainMm) : (rainByDate.get(d.date)?.mm ?? null),
  })).sort(byDateAsc);
  const deliveryById = new Map(deliveries.map((d) => [d.id, d]));

  // ── work ─────────────────────────────────────────────────────────────────
  const work = live(raw.work).map((w) => ({
    ...w, ...workCost(w, stockById), fieldName: fieldName(w.fieldId), typeLabel: WORK_LABEL[w.type] || 'Field work',
  })).sort(byDateAsc);
  const workById = new Map(work.map((w) => [w.id, w]));

  const usedByStock = new Map();
  work.forEach((w) => w.items.forEach((it) => {
    if (it.stockId) usedByStock.set(it.stockId, r2((usedByStock.get(it.stockId) || 0) + it.qty));
  }));

  const equipmentBase = live(raw.equipment).map((q) => ({
    ...q, cost: num(q.cost), lifeYears: Math.max(1, num(q.lifeYears) || 5),
  }));
  const equipmentById = new Map(equipmentBase.map((q) => [q.id, q]));
  const leasesBase = live(raw.leases);
  const leaseById = new Map(leasesBase.map((l) => [l.id, l]));
  const tenanciesBase = live(raw.tenancies);
  const tenancyById = new Map(tenanciesBase.map((t) => [t.id, t]));

  // ── entries (the money ledger) ───────────────────────────────────────────
  const entryFor = (e) => {
    const k = e.kind;
    if (k === 'tea_sale') {
      const ds = (e.deliveryIds || []).map((id) => deliveryById.get(id)).filter(Boolean);
      const kgs = sum(ds, (d) => d.net);
      return ds.length ? `Tea · ${kgs.toFixed(1)} kg${e.rate ? ` at ₹${num(e.rate).toFixed(2)}` : ''}` : 'Tea payment';
    }
    if (k === 'wages') return 'Wages' + (num(e.advanceRecovered) > 0 ? ` · ₹${num(e.advanceRecovered).toLocaleString('en-IN')} advance taken back` : '');
    if (k === 'advance') return 'Advance given';
    if (k === 'advance_recovery') return 'Advance taken back';
    if (k === 'rent') {
      const t = tenancyById.get(e.tenancyId);
      const ms = (e.months || []).map((m) => fmtMonth(m)).join(', ');
      return `Rent${ms ? ' · ' + ms : ''}${t ? ' · ' + propName(t.propertyId) : e.propertyId ? ' · ' + propName(e.propertyId) : ''}`;
    }
    if (k === 'work') { const w = workById.get(e.workId); return w ? `${w.typeLabel} · ${w.fieldName || 'no field'}` : 'Field work'; }
    if (k === 'stock') { const s = stockById.get(e.stockId); return s ? `${s.name || 'Manure'} · ${s.bags} bags` : 'Manure bought'; }
    if (k === 'equipment') { const q = equipmentById.get(e.equipmentId); return q ? `${q.name} bought` : 'Equipment bought'; }
    if (k === 'equipment_run') { const q = equipmentById.get(e.equipmentId); return `${e.category || 'Running cost'}${q ? ' · ' + q.name : ''}`; }
    if (k === 'lease_rent' || k === 'lease_deposit' || k === 'lease_deposit_return') {
      const l = leaseById.get(e.leaseId);
      return `${KINDS[k].cat}${l ? ' · ' + fieldName(l.fieldId) : ''}`;
    }
    if (k === 'tenant_advance' || k === 'tenant_advance_return') {
      const t = tenancyById.get(e.tenancyId);
      return `${KINDS[k].cat}${t ? ' · ' + propName(t.propertyId) : ''}`;
    }
    if (k === 'home_expense' || k === 'rental_expense') return `${e.category || KINDS[k].cat}${e.propertyId ? ' · ' + propName(e.propertyId) : ''}`;
    return e.category || (KINDS[k] ? KINDS[k].cat : 'Entry');
  };
  const partyLabel = (e) => {
    if (e.partyId && personById.has(e.partyId)) return nameOf(e.partyId);
    if (e.partyName) return e.partyName;
    if (e.leaseId && leaseById.has(e.leaseId)) return leaseById.get(e.leaseId).lessee || 'Lessee';
    if (e.kind === 'work') return workById.get(e.workId)?.typeLabel || 'Field work';
    return KINDS[e.kind]?.cat || '';
  };
  const entries = rawEntries.map((e) => {
    const meta = KINDS[e.kind] || { dir: e.dir || 'out', pnl: 'none', cat: 'Entry' };
    const amount = num(e.amount);
    const w = e.workId ? workById.get(e.workId) : null;
    let cat = meta.cat;
    if (e.kind === 'work' && w) cat = w.typeLabel;
    if (e.kind === 'misc' && e.category) cat = e.category;
    if (e.kind === 'home_expense' && e.category) cat = 'Home: ' + e.category;
    if (e.kind === 'rental_expense' && e.category) cat = 'Rental: ' + e.category;
    const fieldId = e.fieldId || w?.fieldId || (e.leaseId ? leaseById.get(e.leaseId)?.fieldId : '') || '';
    return {
      ...e, amount, meta, dir: meta.dir, cat,
      business: e.business || meta.biz || 'tea',
      signed: meta.dir === 'in' ? amount : -amount,
      party: partyLabel(e), forText: entryFor(e),
      diff: entryDiff(e), oneTime: !!(e.oneTime || w?.oneTime), fieldId,
      pnlAmount: meta.pnl === 'expense' ? r2(amount + (e.kind === 'wages' ? num(e.advanceRecovered) : 0)) : amount,
    };
  }).sort(byDateDesc);
  const entriesBy = (f) => entries.filter(f);

  // ── agents ───────────────────────────────────────────────────────────────
  const saleByDelivery = new Map();
  const doubleSold = [];
  entries.filter((e) => e.kind === 'tea_sale').forEach((e) => (e.deliveryIds || []).forEach((id) => {
    if (saleByDelivery.has(id)) doubleSold.push(id);
    saleByDelivery.set(id, e);
  }));
  const agents = people.filter((p) => p.kind === 'agent').map((a) => {
    const ds = deliveries.filter((d) => d.agentId === a.id);
    const sales = entriesBy((e) => e.kind === 'tea_sale' && e.partyId === a.id);
    const rated = ds.filter((d) => d.value != null);
    const owed = sum(rated, (d) => d.value);
    const settled = sum(sales, settledCash);
    const received = sum(sales, (e) => e.amount);
    // payments not tied to particular deliveries pay off the oldest ones first
    let pool = r2(settled - sum(sales.filter((e) => (e.deliveryIds || []).length), settledCash));
    const status = new Map();
    const payDays = [];
    ds.forEach((d) => {
      if (d.value == null) { status.set(d.id, 'norate'); return; }
      const sale = saleByDelivery.get(d.id);
      if (sale) { status.set(d.id, 'paid'); payDays.push(daysBetween(d.date, sale.date)); return; }
      if (pool >= d.value - 0.5) { status.set(d.id, 'paid'); pool = r2(pool - d.value); }
      else if (pool > 0.5) { status.set(d.id, 'part'); pool = 0; }
      else status.set(d.id, 'due');
    });
    // rate history: runs of consecutive deliveries at the same rate, on this agent's own dates
    const periods = [];
    ds.forEach((d) => {
      const last = periods[periods.length - 1];
      if (last && last.rate === d.rate) { last.to = d.date; last.kg = r2(last.kg + d.net); last.count += 1; }
      else periods.push({ rate: d.rate, from: d.date, to: d.date, kg: d.net, count: 1 });
    });
    const unrated = ds.filter((d) => d.value == null);
    const gross = sum(ds, (d) => d.gross);
    return {
      ...a, deliveries: ds, sales, status,
      netKg: sum(ds, (d) => d.net), ratedKg: sum(rated, (d) => d.net), grossKg: gross,
      owed, settled, received, balance: r2(owed - settled),
      unrated, unratedKg: sum(unrated, (d) => d.net),
      avgRate: sum(rated, (d) => d.net) > 0 ? r2(owed / sum(rated, (d) => d.net)) : 0,
      dedPct: gross > 0 ? r2((sum(ds, (d) => d.ded) / gross) * 100) : 0,
      waterPct: gross > 0 ? r2((sum(ds, (d) => d.waterDed) / gross) * 100) : 0,
      daysToPay: payDays.length ? Math.round(payDays.reduce((s, x) => s + x, 0) / payDays.length) : null,
      ratePeriods: periods.reverse(),
    };
  });
  const agentById = new Map(agents.map((a) => [a.id, a]));
  deliveries.forEach((d) => { d.agentStatus = agentById.get(d.agentId)?.status.get(d.id) || (d.value == null ? 'norate' : 'due'); });

  // ── workers ──────────────────────────────────────────────────────────────
  const workerRows = [];
  deliveries.forEach((d) => d.workers.forEach((w) => workerRows.push({ ...w, deliveryId: d.id, date: d.date, fieldId: d.fieldId, fieldName: d.fieldName })));
  const rowsByWorker = groupBy(workerRows, (r) => r.workerId);
  const workers = people.filter((p) => p.kind === 'worker').map((p) => {
    const rows = (rowsByWorker.get(p.id) || []).slice().sort(byDateAsc);
    const pay = entriesBy((e) => e.kind === 'wages' && e.partyId === p.id);
    const adv = entriesBy((e) => e.kind === 'advance' && e.partyId === p.id);
    const advMark = entriesBy((e) => e.kind === 'advance_recovery' && e.partyId === p.id);
    const earned = sum(rows, (r) => r.wage);
    const settled = sum(pay, (e) => settledCash(e) + num(e.advanceRecovered));
    const advanceGiven = sum(adv, (e) => e.amount);
    const advanceRecovered = r2(sum(pay, (e) => num(e.advanceRecovered)) + sum(advMark, (e) => num(e.advanceRecovered)));
    // which harvest days are still unpaid: payments cover the oldest days first
    let pool = settled;
    const unpaid = [];
    rows.forEach((r) => {
      const take = Math.min(pool, r.wage);
      pool = r2(pool - take);
      if (r.wage - take > TOL) unpaid.push({ ...r, remaining: r2(r.wage - take) });
    });
    const lastPay = pay.length ? pay.map((e) => e.date).sort().pop() : null;
    const lastWork = rows.length ? rows[rows.length - 1].date : null;
    return {
      ...p, rows, pay, advances: adv,
      days: new Set(rows.map((r) => r.date)).size,
      netKg: sum(rows, (r) => r.netKg),
      earned, settled, paidCash: sum(pay, (e) => e.amount),
      due: r2(earned - settled),
      advanceGiven, advanceRecovered, advanceBalance: r2(advanceGiven - advanceRecovered),
      extraPaid: sum(pay.filter((e) => isClosedDiff(e) && e.diff > 0), (e) => e.diff),
      unpaid, unpaidDays: new Set(unpaid.map((r) => r.date)).size, unpaidKg: sum(unpaid, (r) => r.netKg),
      lastPay, lastWork,
    };
  });

  // ── bills that may still be unpaid: field work, stock, equipment ─────────
  const paidFor = (key, id) => sum(entriesBy((e) => e[key] === id && (e.kind === 'work' || e.kind === 'stock' || e.kind === 'equipment')), settledCash);
  work.forEach((w) => { w.paid = paidFor('workId', w.id); w.due = r2(w.cost - w.paid); });
  const stock = stockBase.map((s) => {
    const used = usedByStock.get(s.id) || 0;
    const paid = paidFor('stockId', s.id);
    return { ...s, used, left: r2(s.bags - used), paid, due: r2(s.cost - paid), vendorName: nameOf(s.vendorId) || s.vendor || '' };
  }).sort(byDateDesc);
  const equipment = equipmentBase.map((q) => {
    const paid = paidFor('equipmentId', q.id);
    const running = sum(entriesBy((e) => e.kind === 'equipment_run' && e.equipmentId === q.id), (e) => e.amount);
    return { ...q, paid, due: r2(q.cost - paid), running, perYear: r2(q.cost / q.lifeYears) };
  }).sort(byDateDesc);

  // ── tenancies ────────────────────────────────────────────────────────────
  const rentOn = (t, mk) => {
    const rents = (t.rents || []).filter((r) => r.from).slice().sort((a, b) => a.from.localeCompare(b.from));
    let amt = rents.length ? num(rents[0].amount) : 0;
    rents.forEach((r) => { if (monthKey(r.from) <= mk) amt = num(r.amount); });
    return amt;
  };
  const tenancies = tenanciesBase.map((t) => {
    const dueDay = Math.min(28, Math.max(1, num(t.dueDay) || 1));
    const rentEntries = entriesBy((e) => e.kind === 'rent' && e.tenancyId === t.id).slice().sort(byDateAsc);
    const startMk = monthKey(t.start || today);
    const lastMk = monthKey(t.end && t.end < today ? t.end : today);
    const months = (startMk <= lastMk ? monthsFrom(startMk, lastMk) : []).map((mk) => {
      const dueDate = `${mk}-${String(dueDay).padStart(2, '0')}`;
      return { mk, rent: rentOn(t, mk), dueDate, isDue: dueDate <= today, paid: 0, paidOn: null };
    });
    const byMk = new Map(months.map((m) => [m.mk, m]));
    let pool = 0;
    rentEntries.forEach((e) => {
      const ms = (e.months || []).filter((m) => byMk.has(m));
      const amt = settledCash(e);
      if (!ms.length) { pool = r2(pool + amt); return; }
      const total = sum(ms, (m) => byMk.get(m).rent) || ms.length;
      ms.forEach((m) => {
        const row = byMk.get(m);
        row.paid = r2(row.paid + (amt * (row.rent || 1)) / total);
        row.paidOn = e.date;
      });
    });
    months.forEach((m) => {
      if (pool > TOL && m.paid < m.rent - TOL) { const take = Math.min(pool, m.rent - m.paid); m.paid = r2(m.paid + take); pool = r2(pool - take); }
      m.status = m.paid >= m.rent - 0.5 ? (m.paidOn && daysBetween(m.dueDate, m.paidOn) > 5 ? 'late' : 'paid') : m.paid > 0.5 ? 'part' : m.isDue ? 'due' : 'notyet';
    });
    const dueMonths = months.filter((m) => m.isDue);
    const rents = (t.rents || []).filter((r) => r.from).slice().sort((a, b) => a.from.localeCompare(b.from))
      .map((r, i, arr) => ({ ...r, amount: num(r.amount), pct: i > 0 && num(arr[i - 1].amount) > 0 ? r2(((num(r.amount) - num(arr[i - 1].amount)) / num(arr[i - 1].amount)) * 100) : null }));
    const advIn = sum(entriesBy((e) => e.kind === 'tenant_advance' && e.tenancyId === t.id), (e) => e.amount);
    const advOut = sum(entriesBy((e) => e.kind === 'tenant_advance_return' && e.tenancyId === t.id), (e) => e.amount);
    const expected = sum(dueMonths, (m) => m.rent);
    const settled = r2(sum(months, (m) => m.paid) + pool);
    return {
      ...t, dueDay, months, rents, rentEntries,
      tenantName: nameOf(t.tenantId), propertyName: propName(t.propertyId),
      currentRent: rentOn(t, monthKey(today)),
      lastChange: rents.length ? rents[rents.length - 1].from : t.start,
      unpaidMonths: dueMonths.filter((m) => m.status === 'due' || m.status === 'part'),
      balance: sum(dueMonths, (m) => Math.max(0, r2(m.rent - m.paid))), expected, settled,
      advanceHeld: r2(advIn - advOut), advanceRecorded: advIn > 0,
      isActive: t.active !== false && (!t.end || t.end >= today),
    };
  });

  // ── field leases ─────────────────────────────────────────────────────────
  const leases = leasesBase.map((l) => {
    const es = entriesBy((e) => e.leaseId === l.id);
    const received = sum(es.filter((e) => e.kind === 'lease_rent' || e.kind === 'lease_deposit'), (e) => e.amount);
    const returned = sum(es.filter((e) => e.kind === 'lease_deposit_return'), (e) => e.amount);
    const status = l.end < today ? 'ended' : l.start > today ? 'upcoming' : 'active';
    return {
      ...l, amount: num(l.amount), fieldName: fieldName(l.fieldId), status, received, returned,
      toReturn: l.kind === 'deposit' ? r2(received - returned) : 0,
      toReceive: r2(num(l.amount) - received),
      daysLeft: daysBetween(today, l.end),
    };
  }).sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  const activeLeaseOn = (fieldId, date) => leases.find((l) => l.fieldId === fieldId && l.start <= date && l.end >= date);

  // ── reports ──────────────────────────────────────────────────────────────
  const matchBiz = (x, business) => !business || business === 'all' || x === business;

  function pnl(period, { business } = {}) {
    const es = entriesBy((e) => inRange(e.date, period) && matchBiz(e.business, business));
    const income = new Map();
    const expense = new Map();
    const oneTime = new Map();
    let cashIn = 0, cashOut = 0, capitalBought = 0, advancesOut = 0, depositsIn = 0, depositsOut = 0, advRecovered = 0;
    const add = (m, k, v) => m.set(k, r2((m.get(k) || 0) + v));
    es.forEach((e) => {
      if (e.dir === 'in') cashIn += e.amount; else cashOut += e.amount;
      const p = e.meta.pnl;
      if (p === 'income') add(income, e.cat, e.amount);
      else if (p === 'expense') {
        add(e.oneTime ? oneTime : expense, e.cat, e.pnlAmount);
        if (e.kind === 'wages') advRecovered += num(e.advanceRecovered);
      } else if (p === 'capital') capitalBought += e.amount;
      else if (p === 'advance') advancesOut += e.amount;
      else if (p === 'deposit') { if (e.dir === 'in') depositsIn += e.amount; else depositsOut += e.amount; }
    });
    // equipment is spread over its life instead of hitting the month it was bought
    let equipShare = 0;
    if (matchBiz('tea', business)) {
      const to = period.to < today ? period.to : today;
      equipment.forEach((q) => {
        if (!q.date) return;
        const start = q.date > period.from ? q.date : period.from;
        const lifeEnd = addDays(addMonths(q.date, q.lifeYears * 12), -1);
        const end = to < lifeEnd ? to : lifeEnd;
        const days = daysBetween(start, end) + 1;
        if (days > 0) equipShare += (q.cost / (q.lifeYears * 365)) * days;
      });
    }
    const incomeTotal = sum([...income.values()]);
    const regular = sum([...expense.values()]);
    const oneTimeTotal = sum([...oneTime.values()]);
    equipShare = r2(equipShare);
    const profit = r2(incomeTotal - regular - oneTimeTotal - equipShare);
    const cashNet = r2(cashIn - cashOut);
    const bridge = r2(profit + equipShare - capitalBought + advRecovered - advancesOut + depositsIn - depositsOut);
    return {
      income, expense, oneTime, incomeTotal, regular, oneTimeTotal, equipShare, profit,
      cashIn: r2(cashIn), cashOut: r2(cashOut), cashNet,
      capitalBought: r2(capitalBought), advancesOut: r2(advancesOut), advRecovered: r2(advRecovered),
      depositsIn: r2(depositsIn), depositsOut: r2(depositsOut),
      bridgeOk: Math.abs(bridge - cashNet) < TOL, count: es.length,
    };
  }

  function monthly(period, { business } = {}) {
    const es = entriesBy((e) => inRange(e.date, period) && matchBiz(e.business, business));
    const m = new Map();
    es.forEach((e) => {
      const k = monthKey(e.date);
      if (!m.has(k)) m.set(k, { mk: k, in: 0, out: 0 });
      const row = m.get(k);
      if (e.dir === 'in') row.in = r2(row.in + e.amount); else row.out = r2(row.out + e.amount);
    });
    return [...m.values()].sort((a, b) => a.mk.localeCompare(b.mk));
  }

  // Fields are judged on what the leaf was worth on the day it was delivered
  // and what the work cost on the day it was done — not on when money moved.
  function byField(period) {
    const rows = new Map();
    const get = (id) => {
      const key = id || '';
      if (!rows.has(key)) {
        const f = fieldById.get(key);
        rows.set(key, { fieldId: key, name: f ? f.name : 'No field', acres: num(f?.acres), netKg: 0, grossKg: 0, unratedKg: 0, income: 0, wages: 0, work: 0, misc: 0, lease: 0, deliveries: 0 });
      }
      return rows.get(key);
    };
    fields.forEach((f) => get(f.id));
    deliveries.filter((d) => inRange(d.date, period)).forEach((d) => {
      const r = get(d.fieldId);
      r.netKg = r2(r.netKg + d.net); r.grossKg = r2(r.grossKg + d.gross); r.deliveries += 1;
      if (d.value == null) r.unratedKg = r2(r.unratedKg + d.net); else r.income = r2(r.income + d.value);
      r.wages = r2(r.wages + d.wages);
    });
    work.filter((w) => inRange(w.date, period)).forEach((w) => { const r = get(w.fieldId); r.work = r2(r.work + w.fieldCost); });
    entriesBy((e) => inRange(e.date, period) && e.kind === 'misc' && e.business === 'tea').forEach((e) => { const r = get(e.fieldId); r.misc = r2(r.misc + e.amount); });
    entriesBy((e) => inRange(e.date, period) && e.kind === 'lease_rent').forEach((e) => { const r = get(e.fieldId); r.lease = r2(r.lease + e.amount); });
    return [...rows.values()].filter((r) => r.fieldId || r.netKg || r.work || r.misc || r.lease).map((r) => {
      const costs = r2(r.wages + r.work + r.misc);
      const profit = r2(r.income + r.lease - costs);
      return { ...r, costs, profit, kgPerAcre: r.acres > 0 ? r2(r.netKg / r.acres) : null, profitPerKg: r.netKg > 0 ? r2((r.income - costs) / r.netKg) : null };
    });
  }

  function byAgent(period) {
    return agents.map((a) => {
      const ds = a.deliveries.filter((d) => inRange(d.date, period));
      const rated = ds.filter((d) => d.value != null);
      const gross = sum(ds, (d) => d.gross);
      const ratedKg = sum(rated, (d) => d.net);
      return {
        id: a.id, name: a.name, deliveries: ds.length, netKg: sum(ds, (d) => d.net), ratedKg,
        unratedKg: sum(ds.filter((d) => d.value == null), (d) => d.net),
        value: sum(rated, (d) => d.value), avgRate: ratedKg > 0 ? r2(sum(rated, (d) => d.value) / ratedKg) : null,
        dedPct: gross > 0 ? r2((sum(ds, (d) => d.ded) / gross) * 100) : null,
        waterPct: gross > 0 ? r2((sum(ds, (d) => d.waterDed) / gross) * 100) : null,
        daysToPay: a.daysToPay, balance: a.balance,
      };
    });
  }

  function byWorker(period) {
    return workers.map((w) => {
      const rows = w.rows.filter((r) => inRange(r.date, period));
      const pay = w.pay.filter((e) => inRange(e.date, period));
      return {
        id: w.id, name: w.name, days: new Set(rows.map((r) => r.date)).size,
        netKg: sum(rows, (r) => r.netKg), earned: sum(rows, (r) => r.wage),
        paid: sum(pay, (e) => e.amount), due: w.due, advanceBalance: w.advanceBalance,
        extraPaid: sum(pay.filter((e) => isClosedDiff(e) && e.diff > 0), (e) => e.diff),
      };
    }).filter((w) => w.days || w.paid || w.due || w.advanceBalance);
  }

  function byHandler(period) {
    const m = new Map();
    entriesBy((e) => inRange(e.date, period) && e.amount > 0).forEach((e) => {
      const k = e.by || 'Not recorded';
      if (!m.has(k)) m.set(k, { name: k, cash: 0, upi: 0, bank: 0, cheque: 0, other: 0, in: 0, out: 0 });
      const r = m.get(k);
      const mode = MODE_LABEL[e.mode] ? e.mode : 'other';
      r[mode] = r2(r[mode] + e.amount);
      if (e.dir === 'in') r.in = r2(r.in + e.amount); else r.out = r2(r.out + e.amount);
    });
    return [...m.values()];
  }

  // The tea account for a period: kg and money, agents against workers.
  function teaAccount(period) {
    const ds = deliveries.filter((d) => inRange(d.date, period));
    const weighed = sum(ds, (d) => d.gross);
    const bagDed = sum(ds, (d) => d.bagDed);
    const waterDed = sum(ds, (d) => d.waterDed);
    const netAgent = sum(ds, (d) => d.net);
    const netWorkers = sum(ds, (d) => sum(d.workers, (w) => w.netKg));
    const rated = ds.filter((d) => d.value != null);
    const sales = entriesBy((e) => e.kind === 'tea_sale' && inRange(e.date, period));
    const pay = entriesBy((e) => e.kind === 'wages' && inRange(e.date, period));
    const earned = sum(ds, (d) => d.wages);
    return {
      deliveries: ds, weighed, bagDed, waterDed, deducted: r2(bagDed + waterDed), netAgent, netWorkers,
      kgOk: Math.abs(netAgent - netWorkers) < TOL && Math.abs(weighed - bagDed - waterDed - netAgent) < TOL,
      agentValue: sum(rated, (d) => d.value), unratedKg: sum(ds.filter((d) => d.value == null), (d) => d.net),
      sales, received: sum(sales, (e) => e.amount),
      earned, pay, paid: sum(pay, (e) => e.amount), advRecovered: sum(pay, (e) => num(e.advanceRecovered)),
      diffs: [...sales, ...pay].filter((e) => Math.abs(e.diff) > 0.005),
    };
  }

  // ── what needs attention (Home) ──────────────────────────────────────────
  const attention = [];
  agents.forEach((a) => {
    if (a.unratedKg > 0) attention.push({ id: 'rate-' + a.id, type: 'agent', partyId: a.id, title: `${a.name} has not paid yet`, sub: `${a.unrated.length} ${a.unrated.length === 1 ? 'delivery' : 'deliveries'} · ${a.unratedKg.toFixed(1)} kg · rate not known`, tag: 'Record payment', sort: 1 });
    else if (a.balance > 0.5) attention.push({ id: 'owe-' + a.id, type: 'agent', partyId: a.id, title: `${a.name} owes us`, sub: 'For leaf already delivered', amount: a.balance, sort: 2 });
  });
  const wagesDue = workers.filter((w) => w.due > 0.5);
  if (wagesDue.length) attention.push({ id: 'wages', type: 'workers', title: 'Wages due', sub: `${wagesDue.length} ${wagesDue.length === 1 ? 'worker' : 'workers'}`, amount: sum(wagesDue, (w) => w.due), sort: 3 });
  tenancies.filter((t) => t.isActive).forEach((t) => {
    if (t.unpaidMonths.length) attention.push({ id: 'rent-' + t.id, type: 'tenancy', tenancyId: t.id, partyId: t.tenantId, title: 'Rent not received', sub: `${t.propertyName} · ${t.unpaidMonths.map((m) => fmtMonth(m.mk, { year: false })).join(', ')}`, amount: sum(t.unpaidMonths, (m) => r2(m.rent - m.paid)), sort: 4 });
    if (t.end && daysBetween(today, t.end) >= 0 && daysBetween(today, t.end) <= 30) attention.push({ id: 'tend-' + t.id, type: 'property', propertyId: t.propertyId, title: `Rental agreement ending in ${daysBetween(today, t.end)} days`, sub: `${t.propertyName} · ${t.tenantName}`, tag: 'View', sort: 6 });
  });
  leases.forEach((l) => {
    if (l.status === 'active' && l.daysLeft <= 30) attention.push({ id: 'lease-' + l.id, type: 'field', fieldId: l.fieldId, title: `Lease ending in ${l.daysLeft} days`, sub: `${l.fieldName}${l.toReturn > 0 ? ' · return deposit ' + l.toReturn.toLocaleString('en-IN') : ''}`, tag: 'View', sort: 5 });
    if (l.status === 'ended' && l.toReturn > 0.5) attention.push({ id: 'ret-' + l.id, type: 'field', fieldId: l.fieldId, title: 'Lease deposit to return', sub: `${l.fieldName} · ${l.lessee || ''} · ended ${fmtDate(l.end)}`, amount: l.toReturn, sort: 5 });
  });
  const bills = [
    ...work.filter((w) => w.due > 0.5).map((w) => ({ id: 'w-' + w.id, kind: 'work', refId: w.id, label: `${w.typeLabel} · ${w.fieldName || 'no field'}`, date: w.date, due: w.due })),
    ...stock.filter((s) => s.due > 0.5).map((s) => ({ id: 's-' + s.id, kind: 'stock', refId: s.id, label: `${s.name || 'Manure'} · ${s.bags} bags`, date: s.date, due: s.due })),
    ...equipment.filter((q) => q.due > 0.5).map((q) => ({ id: 'q-' + q.id, kind: 'equipment', refId: q.id, label: q.name, date: q.date, due: q.due })),
  ];
  if (bills.length) attention.push({ id: 'bills', type: 'bills', title: 'Bills not paid yet', sub: `${bills.length} · field work, manure or equipment`, amount: sum(bills, (b) => b.due), sort: 7 });
  attention.sort((a, b) => a.sort - b.sort);

  // ── self-checks ──────────────────────────────────────────────────────────
  const allPeriod = { from: '0000-01-01', to: '9999-12-31' };
  const P = pnl(allPeriod);
  const F = byField(allPeriod);
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: ok ? '' : detail });
  const totalNet = sum(deliveries, (d) => d.net);
  const totalWorkerNet = sum(workerRows, (r) => r.netKg);
  check('Net kg sold equals net kg workers are paid for', Math.abs(totalNet - totalWorkerNet) < TOL, `Sold ${totalNet} kg, workers ${totalWorkerNet} kg`);
  const over = deliveries.filter((d) => d.overDeducted);
  check('No delivery has more deducted than was weighed', over.length === 0, `${over.length} delivery: ${over.map((d) => fmtDate(d.date)).join(', ')}`);
  const totalValue = sum(deliveries.filter((d) => d.value != null), (d) => d.value);
  const noAgent = deliveries.filter((d) => !agentById.has(d.agentId));
  check('Every delivery belongs to an agent', noAgent.length === 0, `${noAgent.length} delivery without an agent`);
  check('Money due from agents equals the value of rated deliveries', noAgent.length > 0 || Math.abs(sum(agents, (a) => a.owed) - totalValue) < TOL, `Agents ${sum(agents, (a) => a.owed)}, deliveries ${totalValue}`);
  check('Field totals add up to the overall kg', Math.abs(sum(F, (f) => f.netKg) - totalNet) < TOL, `Fields ${sum(F, (f) => f.netKg)} kg, total ${totalNet} kg`);
  check('Field income adds up to the value of rated deliveries', Math.abs(sum(F, (f) => f.income) - totalValue) < TOL, `Fields ${sum(F, (f) => f.income)}, total ${totalValue}`);
  const earnedAll = sum(workerRows, (r) => r.wage);
  const noWorker = workerRows.filter((r) => !personById.has(r.workerId));
  check('Every bag is picked by a known worker', noWorker.length === 0, `${noWorker.length} bag group without a worker`);
  check('Wages earned equal the wages worked out on each delivery', noWorker.length > 0 || Math.abs(sum(workers, (w) => w.earned) - earnedAll) < TOL, `Workers ${sum(workers, (w) => w.earned)}, deliveries ${earnedAll}`);
  check('Profit and cash agree once equipment, advances and deposits are counted', P.bridgeOk, `Cash ${P.cashNet}`);
  check('No delivery is paid for twice', doubleSold.length === 0, `${doubleSold.length} delivery in more than one agent payment`);
  const dangling = entries.filter((e) =>
    (e.partyId && !personById.has(e.partyId)) ||
    (e.deliveryIds || []).some((id) => !deliveryById.has(id)) ||
    (e.workId && !workById.has(e.workId)) || (e.stockId && !stockById.has(e.stockId)) ||
    (e.equipmentId && !equipmentById.has(e.equipmentId)) || (e.leaseId && !leaseById.has(e.leaseId)) ||
    (e.tenancyId && !tenancyById.has(e.tenancyId)));
  check('Every payment points to things that still exist', dangling.length === 0, `${dangling.length} payment linked to something deleted`);
  const overUsed = stock.filter((s) => s.left < -TOL);
  check('No more manure applied than was bought', overUsed.length === 0, `${overUsed.map((s) => s.name).join(', ')}`);
  const badEntries = entries.filter((e) => !KINDS[e.kind] || !(e.amount >= 0) || !e.date);
  check('Every payment has a date, an amount and a type', badEntries.length === 0, `${badEntries.length} incomplete payment`);

  return {
    today, settings, handlers,
    people, fields, properties, personById, fieldById, propertyById, nameOf, fieldName, propName,
    deliveries, deliveryById, work, workById, stock, stockById, equipment, equipmentById,
    agents, agentById, workers, workerById: new Map(workers.map((w) => [w.id, w])),
    tenancies, tenancyById: new Map(tenancies.map((t) => [t.id, t])), leases, leaseById: new Map(leases.map((l) => [l.id, l])),
    activeLeaseOn, entries, entryById: new Map(entries.map((e) => [e.id, e])),
    rainByDate, notes: live(raw.notes), bills, attention,
    pnl, monthly, byField, byAgent, byWorker, byHandler, teaAccount,
    checks, ok: checks.every((c) => c.ok),
    totals: { netKg: totalNet, value: totalValue, wages: earnedAll, entries: entries.length },
  };
}
