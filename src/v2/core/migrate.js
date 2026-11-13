// Copies the old app's records into the new structure. Pure: old data in,
// new documents + a comparison report out. Nothing is written here, and the
// old collections are never modified. Document ids are derived from the old
// ids, so running the import again updates the same documents instead of
// creating duplicates.
import { r2, num, sum, monthKey } from './util';
import { buildBooks, COLLECTIONS } from './books';

export const OLD_COLLECTIONS = [
  'workers', 'agents', 'fields', 'tea_harvest', 'tea_settlements', 'tea_agent_payments',
  'tea_advances', 'tea_maintenance', 'tea_inventory', 'tea_weather', 'tea_field_leases',
  'properties', 'tenants', 'rental_transactions', 'home_properties', 'home_expenses',
];

const day = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v.toDate) return v.toDate().toISOString().slice(0, 10);
  if (v.seconds) return new Date(v.seconds * 1000).toISOString().slice(0, 10);
  return '';
};
const slug = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const MODE = { cash: 'cash', upi: 'upi', 'bank transfer': 'bank', bank: 'bank', cheque: 'cheque' };
const WORK_TYPE = { Pruning: 'pruning', Weeding: 'weeding', Fertilizing: 'manure', 'Pest Control': 'pest' };
const imp = { imported: true };

export function mapOldData(old, today) {
  const src = (k) => (old[k] || []).filter(Boolean);
  const out = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  const warnings = [];

  // ── people and fields (the old app links by name) ────────────────────────
  const idByName = { worker: new Map(), agent: new Map(), field: new Map() };
  const person = (kind, name, extra = {}) => {
    const key = String(name || '').trim();
    if (!key) return '';
    if (idByName[kind].has(key)) return idByName[kind].get(key);
    const id = `old-${kind}-${slug(key)}`;
    idByName[kind].set(key, id);
    out.people.push({ id, kind, name: key, active: true, ...imp, ...extra });
    return id;
  };
  src('workers').forEach((w) => {
    const id = `old-worker-${w.id}`;
    idByName.worker.set(String(w.name || '').trim(), id);
    out.people.push({
      id, kind: 'worker', name: String(w.name || '').trim(), phone: w.phone || '', active: w.status !== 'inactive',
      payBasis: w.payBasis === 'daily' ? 'day' : 'kg', kgRate: 6, dayRate: num(w.dailyRate) || '', ...imp,
    });
  });
  src('agents').forEach((a) => {
    const id = `old-agent-${a.id}`;
    idByName.agent.set(String(a.name || '').trim(), id);
    out.people.push({ id, kind: 'agent', name: String(a.name || '').trim(), phone: a.phone || '', active: a.status !== 'inactive', ...imp });
  });
  const field = (name) => {
    const key = String(name || '').trim();
    if (!key) return '';
    if (idByName.field.has(key)) return idByName.field.get(key);
    const id = `old-field-${slug(key)}`;
    idByName.field.set(key, id);
    out.fields.push({ id, name: key, acres: '', ...imp });
    return id;
  };
  src('fields').forEach((f) => {
    const id = `old-field-${f.id}`;
    idByName.field.set(String(f.name || '').trim(), id);
    out.fields.push({ id, name: String(f.name || '').trim(), acres: num(f.area) || '', note: f.notes || '', ...imp });
  });

  // ── harvest sessions -> deliveries ───────────────────────────────────────
  const workerPayGroups = new Map();
  const agentPayGroups = new Map();
  let netMismatch = 0;
  src('tea_harvest').forEach((h) => {
    const id = `old-harvest-${h.id}`;
    const workerId = person('worker', h.worker);
    const agentId = person('agent', h.agent);
    const details = Array.isArray(h.bagDetails) && h.bagDetails.length ? h.bagDetails : [{ gross: h.tGross }];
    const bags = details.map((b) => ({ kg: num(b.gross), workerId })).filter((b) => b.kg > 0);
    const gross = sum(bags, (b) => b.kg);
    let bagDed = num(h.tBagDed), waterDed = num(h.tWaterDed);
    if (h.tNet != null && Math.abs(gross - bagDed - waterDed - num(h.tNet)) > 0.011) {
      // keep the old net kg exactly: put the unexplained difference into the bag deduction
      netMismatch += 1;
      bagDed = r2(gross - waterDed - num(h.tNet));
    }
    const daily = h.payBasis === 'daily';
    const confirmed = num(h.rate) > 0 && (h.rateStatus === 'confirmed' || !h.rateStatus || num(h.agentPayAmount) > 0);
    out.deliveries.push({
      id, date: day(h.date), fieldId: field(h.field), agentId, bags, bagDed, waterDed,
      rate: confirmed ? num(h.rate) : null,
      estRate: !confirmed && num(h.rate) > 0 ? num(h.rate) : null,
      kgRates: { [workerId]: daily ? 0 : 6 },
      wageOverride: !daily && h.workerPay != null ? { [workerId]: num(h.workerPay) } : undefined,
      dayWork: daily ? [{ workerId, days: num(h.workDays), dayRate: num(h.dayRate) }] : [],
      ...imp,
    });
    if (num(h.workerPayAmount) > 0) {
      const d = day(h.workerPayDate) || day(h.date);
      const key = workerId + '|' + d;
      if (!workerPayGroups.has(key)) workerPayGroups.set(key, { partyId: workerId, date: d, amount: 0 });
      workerPayGroups.get(key).amount = r2(workerPayGroups.get(key).amount + num(h.workerPayAmount));
    }
    if (num(h.agentPayAmount) > 0) {
      const d = day(h.agentPayDate) || day(h.date);
      const key = agentId + '|' + d;
      if (!agentPayGroups.has(key)) agentPayGroups.set(key, { partyId: agentId, date: d, amount: 0, expected: 0, deliveryIds: [], rates: new Set() });
      const g = agentPayGroups.get(key);
      g.amount = r2(g.amount + num(h.agentPayAmount));
      g.expected = r2(g.expected + r2(num(h.tNet) * num(h.rate)));
      g.deliveryIds.push(id);
      g.rates.add(num(h.rate));
    }
  });
  if (netMismatch) warnings.push(`${netMismatch} harvest record(s) had a net kg that did not equal weighed minus deductions. The old net kg was kept.`);

  // ── payments ─────────────────────────────────────────────────────────────
  const entry = (e) => out.entries.push({ mode: '', by: '', ...imp, ...e });
  [...workerPayGroups.values()].forEach((g) => entry({
    id: `old-wpay-${g.partyId}-${g.date}`, kind: 'wages', partyId: g.partyId, date: g.date, amount: g.amount, expected: g.amount,
    note: 'From the old harvest log',
  }));
  src('tea_settlements').forEach((s) => entry({
    id: `old-settle-${s.id}`, kind: 'wages', partyId: person('worker', s.worker), date: day(s.date), amount: num(s.netPaid), expected: num(s.netPaid),
    note: s.notes || 'Bulk payment in the old app',
  }));
  [...agentPayGroups.values()].forEach((g) => {
    const short = g.expected - g.amount > 0.5;
    const over = g.amount - g.expected > 0.5;
    entry({
      id: `old-apay-${g.partyId}-${g.date}`, kind: 'tea_sale', partyId: g.partyId, date: g.date, amount: g.amount,
      expected: short || over ? g.expected : g.amount, diffReason: short || over ? 'later' : undefined,
      deliveryIds: g.deliveryIds, rate: g.rates.size === 1 ? [...g.rates][0] : undefined,
      note: 'From the old harvest log',
    });
  });
  src('tea_agent_payments').forEach((p) => entry({
    id: `old-agentpay-${p.id}`, kind: 'tea_sale', partyId: person('agent', p.agent), date: day(p.date), amount: num(p.amount), expected: num(p.amount),
    mode: MODE[String(p.method || '').toLowerCase()] || '', note: p.notes || 'Bulk payment in the old app',
  }));
  src('tea_advances').forEach((a) => {
    const partyId = person('worker', a.worker);
    entry({ id: `old-adv-${a.id}`, kind: 'advance', partyId, date: day(a.date), amount: num(a.amount), note: a.notes || '' });
    if (a.deducted) entry({ id: `old-advback-${a.id}`, kind: 'advance_recovery', partyId, date: day(a.date), amount: 0, advanceRecovered: num(a.amount), note: 'Marked as deducted in the old app' });
  });

  // ── inventory -> stock, maintenance -> work ──────────────────────────────
  src('tea_inventory').forEach((p) => {
    const id = `old-inv-${p.id}`;
    out.stock.push({ id, date: day(p.date), name: p.itemName || 'Item', category: p.category || 'Fertilizer', bags: num(p.totalUnits), costPerBag: num(p.unitCost), transport: 0, costOverride: num(p.totalCost), note: p.notes || '', ...imp });
    if (num(p.totalCost) > 0) entry({ id: `old-invpay-${p.id}`, kind: 'stock', stockId: id, date: day(p.date), amount: num(p.totalCost), expected: num(p.totalCost) });
  });
  const stockIds = new Set(out.stock.map((s) => s.id));
  src('tea_maintenance').forEach((m) => {
    const id = `old-maint-${m.id}`;
    const date = day(m.date) || (m.year ? `${m.year}-${String(m.month || 1).padStart(2, '0')}-15` : '');
    const type = WORK_TYPE[m.task] || 'other';
    const rawItems = m.fertItems || m.equipItems || [];
    const items = rawItems.map((it) => {
      const stockId = it.purchaseId && stockIds.has(`old-inv-${it.purchaseId}`) ? `old-inv-${it.purchaseId}` : undefined;
      return { name: it.type || 'Item', qty: num(it.bags ?? it.units), unitCost: num(it.rate), stockId };
    }).filter((it) => it.qty > 0);
    out.work.push({
      id, date, fieldId: field(m.field), type, labourMode: 'day', people: 1, days: num(m.days), rate: num(m.rate),
      items, costOverride: num(m.cost),
      comment: [type === 'other' && m.task ? m.task : '', m.notes || '', m.worker ? `Worker: ${m.worker}` : ''].filter(Boolean).join(' · '),
      ...imp,
    });
    if (num(m.cost) > 0) entry({ id: `old-maintpay-${m.id}`, kind: 'work', workId: id, date, amount: num(m.cost), expected: num(m.cost) });
  });

  src('tea_weather').forEach((w) => {
    const d = day(w.date);
    if (d) out.rain.push({ id: d, date: d, mm: num(w.rainfall), temp: num(w.temp) || null, source: 'old app', ...imp });
  });

  src('tea_field_leases').forEach((l) => {
    const id = `old-lease-${l.id}`;
    out.leases.push({ id, fieldId: field(l.field), lessee: l.lessee || '', phone: l.phone || '', start: day(l.startDate), end: day(l.endDate), kind: 'rent', amount: num(l.amount), note: [l.notes, l.address].filter(Boolean).join(' · '), ...imp });
    if (num(l.amount) > 0) entry({ id: `old-leasepay-${l.id}`, kind: 'lease_rent', leaseId: id, partyName: l.lessee || 'Lessee', date: day(l.startDate), amount: num(l.amount), expected: num(l.amount) });
  });

  // ── rentals ──────────────────────────────────────────────────────────────
  src('properties').forEach((p) => out.properties.push({ id: `old-prop-${p.id}`, kind: 'rental', name: p.name || 'Property', address: p.address || '', note: [p.type, p.description].filter(Boolean).join(' · '), ...imp }));
  const propIds = new Set(out.properties.map((p) => p.id));
  const tenancyByProp = new Map();
  src('tenants').forEach((t) => {
    const tenantId = `old-tenant-${t.id}`;
    out.people.push({ id: tenantId, kind: 'tenant', name: t.name || 'Tenant', phone: t.phone || '', email: t.email || '', active: t.status !== 'inactive', ...imp });
    const propertyId = propIds.has(`old-prop-${t.propertyId}`) ? `old-prop-${t.propertyId}` : '';
    const id = `old-tenancy-${t.id}`;
    const start = day(t.leaseStart);
    out.tenancies.push({
      id, propertyId, tenantId, start, end: day(t.leaseEnd), dueDay: 1,
      rents: [{ from: start || '2000-01-01', amount: num(t.monthlyRent) }],
      active: t.status !== 'inactive' && t.status !== 'ended', note: t.notes || '', ...imp,
    });
    if (propertyId) { if (!tenancyByProp.has(propertyId)) tenancyByProp.set(propertyId, []); tenancyByProp.get(propertyId).push({ id, tenantId, start, end: day(t.leaseEnd), active: t.status !== 'inactive' }); }
    if (num(t.deposit) > 0 && start) entry({ id: `old-deposit-${t.id}`, kind: 'tenant_advance', partyId: tenantId, tenancyId: id, date: start, amount: num(t.deposit), expected: num(t.deposit), note: 'Security deposit from the old app' });
  });
  const tenancyFor = (propertyId, date) => {
    const list = tenancyByProp.get(propertyId) || [];
    return list.find((t) => (!t.start || t.start <= date) && (!t.end || t.end >= date)) || list.find((t) => t.active) || list[0] || null;
  };
  src('rental_transactions').forEach((x) => {
    const date = day(x.date);
    const propertyId = propIds.has(`old-prop-${x.propertyId}`) ? `old-prop-${x.propertyId}` : '';
    const note = x.description || '';
    if (x.type === 'income') {
      const isRent = /rent/i.test(x.category || '') || !x.category;
      const t = isRent && propertyId ? tenancyFor(propertyId, date) : null;
      if (t) entry({ id: `old-rtx-${x.id}`, kind: 'rent', partyId: t.tenantId, tenancyId: t.id, propertyId, months: [monthKey(date)], date, amount: num(x.amount), expected: num(x.amount), note });
      else entry({ id: `old-rtx-${x.id}`, kind: isRent ? 'rent' : 'misc_in', business: 'rental', propertyId, category: x.category || 'Rent', date, amount: num(x.amount), expected: num(x.amount), note });
    } else {
      entry({ id: `old-rtx-${x.id}`, kind: 'rental_expense', propertyId, category: x.category || 'Other', date, amount: num(x.amount), expected: num(x.amount), note });
    }
  });

  // ── homes ────────────────────────────────────────────────────────────────
  src('home_properties').forEach((p) => out.properties.push({ id: `old-home-${p.id}`, kind: 'home', name: p.name || 'Home', address: p.address || '', note: p.description || p.notes || '', ...imp }));
  const homeIds = new Set(out.properties.filter((p) => p.kind === 'home').map((p) => p.id));
  src('home_expenses').forEach((x) => entry({
    id: `old-hexp-${x.id}`, kind: 'home_expense', propertyId: homeIds.has(`old-home-${x.propertyId}`) ? `old-home-${x.propertyId}` : '',
    category: x.category || 'Other', date: day(x.date), amount: num(x.amount), expected: num(x.amount),
    note: [x.description, x.contractor ? `Contractor: ${x.contractor}` : ''].filter(Boolean).join(' · '),
  }));

  const undated = out.entries.filter((e) => !e.date).length + out.deliveries.filter((d) => !d.date).length;
  if (undated) warnings.push(`${undated} record(s) have no date in the old app. They are imported but will fail the "has a date" check until you fix them.`);
  warnings.push('Old payments do not say how they were paid or who handled them, so those two fields are blank on imported payments.');
  warnings.push('In the old app a worker payment "net of advance" was recorded as the full wage. Imported worker payments therefore show the settled amount, which can be more than the cash handed over.');

  // ── compare old totals with what the new books make of the copy ──────────
  const books = buildBooks(out, today);
  const h = src('tea_harvest');
  const rows = [];
  const cmp = (label, oldV, newV, tol = 0.5, unit = '₹') => rows.push({ label, old: r2(oldV), new: r2(newV), unit, ok: Math.abs(oldV - newV) <= tol });
  const all = { from: '0000-01-01', to: '9999-12-31' };
  const P = books.pnl(all);
  cmp('Harvest records', h.length, books.deliveries.length, 0, '');
  cmp('Net kg', sum(h, (x) => num(x.tNet)), books.totals.netKg, 0.05, 'kg');
  cmp('Weighed kg', sum(h, (x) => num(x.tGross)), sum(books.deliveries, (d) => d.gross), 0.05, 'kg');
  const confirmedOld = h.filter((x) => num(x.rate) > 0 && (x.rateStatus === 'confirmed' || !x.rateStatus || num(x.agentPayAmount) > 0));
  cmp('Tea revenue at confirmed rates', sum(confirmedOld, (x) => num(x.agentRev)), books.totals.value, Math.max(1, confirmedOld.length * 0.06));
  cmp('Worker wages earned', sum(h, (x) => num(x.workerPay)), books.totals.wages, 0.5);
  cmp('Paid to workers', sum(h, (x) => num(x.workerPayAmount)) + sum(src('tea_settlements'), (x) => num(x.netPaid)), sum(books.workers, (w) => w.paidCash), 0.5);
  cmp('Received from agents', sum(h, (x) => num(x.agentPayAmount)) + sum(src('tea_agent_payments'), (x) => num(x.amount)), sum(books.agents, (a) => a.received), 0.5);
  cmp('Advances still outstanding', sum(src('tea_advances').filter((a) => !a.deducted), (a) => num(a.amount)), sum(books.workers, (w) => w.advanceBalance), 0.5);
  cmp('Field maintenance cost', sum(src('tea_maintenance'), (x) => num(x.cost)), sum(books.work, (w) => w.cost), 0.5);
  cmp('Inventory purchases', sum(src('tea_inventory'), (x) => num(x.totalCost)), sum(books.stock, (s) => s.cost), 0.5);
  cmp('Field lease income', sum(src('tea_field_leases'), (x) => num(x.amount)), P.income.get('Field lease') || 0, 0.5);
  const rt = src('rental_transactions');
  cmp('Rental income', sum(rt.filter((x) => x.type === 'income'), (x) => num(x.amount)), (P.income.get('Rent') || 0) + (P.income.get('Other income') || 0), 0.5);
  cmp('Rental expenses', sum(rt.filter((x) => x.type !== 'income'), (x) => num(x.amount)), sum(books.entries.filter((e) => e.kind === 'rental_expense'), (e) => e.amount), 0.5);
  cmp('Home expenses', sum(src('home_expenses'), (x) => num(x.amount)), sum(books.entries.filter((e) => e.kind === 'home_expense'), (e) => e.amount), 0.5);

  const counts = Object.fromEntries(COLLECTIONS.map((c) => [c, out[c].length]).filter(([, n]) => n > 0));
  return { data: out, report: { rows, ok: rows.every((r) => r.ok), counts, warnings, checks: books.checks } };
}
