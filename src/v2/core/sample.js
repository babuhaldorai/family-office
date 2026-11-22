// Made-up data for trying the app without touching real records, and for the
// automated tests. Deterministic: the same call always gives the same data.
import { r2, addDays, daysBetween, monthKey, monthsFrom } from './util';
import { computeDelivery } from './books';

export const SAMPLE_TODAY = '2026-11-21';

function prng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleData(today = SAMPLE_TODAY) {
  const rnd = prng(42);
  const people = [
    { id: 'w1', kind: 'worker', name: 'Lakshmi', payBasis: 'kg', kgRate: 6, active: true },
    { id: 'w2', kind: 'worker', name: 'Selvi', payBasis: 'kg', kgRate: 6, active: true },
    { id: 'w3', kind: 'worker', name: 'Murugan', payBasis: 'kg', kgRate: 6, active: true },
    { id: 'a1', kind: 'agent', name: 'Agent A', active: true },
    { id: 'a2', kind: 'agent', name: 'Agent B', active: true },
    { id: 't1', kind: 'tenant', name: 'Anand', active: true },
    { id: 't2', kind: 'tenant', name: 'Priya', active: true },
    { id: 'v1', kind: 'vendor', name: 'Sri Agro', active: true },
  ];
  const personById = new Map(people.map((p) => [p.id, p]));
  const fields = [
    { id: 'f1', name: 'Upper field', acres: 2, place: 'Coonoor', lat: 11.35, lon: 76.8, schedule: { manureMonths: 6, weedWeeks: 8, pruneYears: 4 } },
    { id: 'f2', name: 'Road field', acres: 3, place: 'Coonoor', lat: 11.35, lon: 76.8, schedule: { manureMonths: 6, weedWeeks: 8, pruneYears: 4 } },
    { id: 'f3', name: 'Lower field', acres: 1.5, place: 'Coonoor', lat: 11.35, lon: 76.8 },
  ];
  const properties = [
    { id: 'p1', kind: 'rental', name: 'Shop 2', address: 'Main road' },
    { id: 'p2', kind: 'rental', name: 'House 1', address: 'Temple street' },
    { id: 'p3', kind: 'home', name: 'Family home', address: '' },
  ];
  const tenancies = [
    { id: 'tn1', propertyId: 'p1', tenantId: 't1', start: '2025-04-01', end: '2027-03-31', dueDay: 5, rents: [{ from: '2025-04-01', amount: 11000 }, { from: '2026-04-01', amount: 12000 }], active: true },
    { id: 'tn2', propertyId: 'p2', tenantId: 't2', start: '2024-09-01', end: '', dueDay: 1, rents: [{ from: '2024-09-01', amount: 9000 }], active: true },
  ];

  const deliveries = [];
  const entries = [];
  let n = 0;
  const E = (e) => entries.push({ id: 'e' + (++n), mode: 'cash', by: 'Me', ...e, expected: e.expected ?? e.amount });

  // ── a year of harvests, before the week shown on screen ──────────────────
  const workers = ['w1', 'w2', 'w3'];
  const season = (d) => [0.7, 0.75, 0.9, 1.1, 1.2, 1.15, 1.05, 1.0, 1.1, 1.15, 1.0, 0.8][Number(d.slice(5, 7)) - 1];
  let d = '2025-09-01', i = 0;
  while (d <= '2026-11-06') {
    const fieldId = i % 2 === 0 ? 'f1' : 'f2';
    const agentId = i % 3 === 2 ? 'a2' : 'a1';
    const yieldF = (fieldId === 'f1' ? 1.05 : 0.9) * season(d);
    const bagCount = 2 + (rnd() > 0.5 ? 1 : 0);
    const bags = [];
    for (let k = 0; k < bagCount; k++) bags.push({ kg: r2(Math.round((42 + rnd() * 14) * yieldF * 2) / 2), workerId: workers[(i + k) % 3] });
    const gross = bags.reduce((s, b) => s + b.kg, 0);
    const waterPct = agentId === 'a2' ? 0.04 + rnd() * 0.02 : 0.025 + rnd() * 0.015;
    const week = Math.floor(daysBetween('2025-09-01', d) / 7);
    const base = 23 + ((week * 7) % 5) * 0.5;
    deliveries.push({
      id: 'h' + i, date: d, fieldId, agentId, bags, bagDed: r2(bagCount * 1.5), waterDed: r2(Math.round(gross * waterPct * 2) / 2),
      rate: agentId === 'a1' ? base : base - 1, rainMm: null, _week: week,
    });
    d = addDays(d, i % 2 === 0 ? 3 : 4); i += 1;
  }
  // agents paid per week; workers paid every Saturday
  const byKey = (list, f) => { const m = new Map(); list.forEach((x) => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
  byKey(deliveries, (x) => x.agentId + '|' + x._week).forEach((ds, key) => {
    const agentId = key.split('|')[0];
    const lastDate = ds[ds.length - 1].date;
    const expected = r2(ds.reduce((s, x) => s + computeDelivery(x, personById).value, 0));
    E({ kind: 'tea_sale', partyId: agentId, date: addDays(lastDate, agentId === 'a1' ? 7 : 16), amount: Math.round(expected), expected, deliveryIds: ds.map((x) => x.id), rate: ds[0].rate, mode: agentId === 'a1' ? 'upi' : 'bank', by: 'Me' });
  });
  byKey(deliveries, (x) => x._week).forEach((ds) => {
    const earned = new Map();
    ds.forEach((x) => computeDelivery(x, personById).workers.forEach((w) => earned.set(w.workerId, (earned.get(w.workerId) || 0) + w.wage)));
    const payDate = addDays(ds[ds.length - 1].date, 1);
    earned.forEach((amt, workerId) => E({ kind: 'wages', partyId: workerId, date: payDate, amount: r2(amt), mode: 'cash', by: 'Ragu' }));
  });
  deliveries.forEach((x) => { delete x._week; });

  // ── the week of 9–15 Nov 2026 ────────────────────────────────────────────
  deliveries.push(
    { id: 'd1', date: '2026-11-09', fieldId: 'f1', agentId: 'a1', bags: [{ kg: 50, workerId: 'w1' }, { kg: 40, workerId: 'w1' }, { kg: 50, workerId: 'w2' }], bagDed: 3.5, waterDed: 4, rate: 24.5, rateBy: 'sale-nov' },
    { id: 'd2', date: '2026-11-10', fieldId: 'f2', agentId: 'a2', bags: [{ kg: 64, workerId: 'w3' }, { kg: 64, workerId: 'w2' }], bagDed: 3, waterDed: 3, rate: null,
      photos: [{ path: 'slips/2026-11/sample-front.jpg', at: '2026-11-10T12:30:00.000Z', by: 'Ragu' }, { path: 'slips/2026-11/sample-back.jpg', at: '2026-11-11T04:00:00.000Z', by: 'Ragu' }] },
    { id: 'd3', date: '2026-11-11', fieldId: 'f2', agentId: 'a1', bags: [{ kg: 49, workerId: 'w3' }, { kg: 49, workerId: 'w1' }, { kg: 49, workerId: 'w3' }], bagDed: 3.5, waterDed: 4, rate: 24.5, rateBy: 'sale-nov' },
    { id: 'd4', date: '2026-11-12', fieldId: 'f1', agentId: 'a2', bags: [{ kg: 50, workerId: 'w2' }, { kg: 50, workerId: 'w1' }, { kg: 50, workerId: 'w3' }], bagDed: 3, waterDed: 4, rate: null },
    { id: 'd5', date: '2026-11-13', fieldId: 'f1', agentId: 'a1', bags: [{ kg: 50, workerId: 'w1' }, { kg: 50, workerId: 'w1' }, { kg: 50, workerId: 'w2' }], bagDed: 5, waterDed: 5, rate: 24.5, rateBy: 'sale-nov', rainMm: 12 },
  );
  entries.push({ id: 'sale-nov', kind: 'tea_sale', partyId: 'a1', date: '2026-11-20', amount: 10000, expected: 10094, diffReason: 'later', diffComment: 'Agent will add ₹94 to the next payment', deliveryIds: ['d1', 'd3', 'd5'], rate: 24.5, mode: 'upi', by: 'Me' });
  const weekEarned = (wid) => deliveries.filter((x) => ['d1', 'd2', 'd3', 'd4', 'd5'].includes(x.id))
    .reduce((s, x) => s + (computeDelivery(x, personById).workers.find((w) => w.workerId === wid)?.wage || 0), 0);
  E({ kind: 'advance', partyId: 'w1', date: '2026-10-20', amount: 3000, mode: 'cash', by: 'Ragu', note: 'For school fees' });
  E({ kind: 'advance', partyId: 'w3', date: '2026-09-10', amount: 8500, mode: 'cash', by: 'Me' });
  const w1due = weekEarned('w1');
  entries.push({ id: 'pay-w1', kind: 'wages', partyId: 'w1', date: '2026-11-13', advanceRecovered: 500, expected: w1due - 500, amount: w1due - 500 + 90, diffReason: 'gift', diffComment: 'Gave extra for Deepavali, not to be taken back', mode: 'cash', by: 'Ragu' });
  E({ kind: 'wages', partyId: 'w2', date: '2026-11-13', amount: weekEarned('w2'), mode: 'cash', by: 'Ragu' });

  // ── manure, field work, equipment ────────────────────────────────────────
  const stock = [
    { id: 's0', date: '2026-04-20', name: 'Urea', bags: 15, costPerBag: 1100, transport: 500, vendorId: 'v1' },
    { id: 's1', date: '2026-10-30', name: 'NPK mix', bags: 20, costPerBag: 1400, transport: 800, vendorId: 'v1' },
  ];
  E({ kind: 'stock', stockId: 's0', partyId: 'v1', date: '2026-04-20', amount: 17000, mode: 'upi', by: 'Ragu' });
  E({ kind: 'stock', stockId: 's1', partyId: 'v1', date: '2026-10-30', amount: 28800, mode: 'upi', by: 'Ragu' });
  const work = [
    { id: 'k1', date: '2023-07-05', fieldId: 'f1', type: 'pruning', labourMode: 'fixed', fixedAmount: 6000, items: [] },
    { id: 'k2', date: '2023-07-12', fieldId: 'f2', type: 'pruning', labourMode: 'fixed', fixedAmount: 8500, items: [] },
    { id: 'k3', date: '2025-09-12', fieldId: 'f2', type: 'manure', labourMode: 'bag', bags: 10, rate: 200, items: [{ name: 'Urea', qty: 10, unitCost: 1050 }] },
    { id: 'k4', date: '2026-05-02', fieldId: 'f1', type: 'manure', labourMode: 'bag', bags: 15, rate: 200, items: [{ name: 'Urea', qty: 15, stockId: 's0' }] },
    { id: 'k5', date: '2026-08-10', fieldId: 'f2', type: 'other', oneTime: true, labourMode: 'fixed', fixedAmount: 18000, items: [], comment: 'Fencing along the road' },
    { id: 'k6', date: '2026-09-18', fieldId: 'f1', type: 'weeding', labourMode: 'day', people: 3, days: 1, rate: 450, items: [] },
    { id: 'k7', date: '2026-09-25', fieldId: 'f2', type: 'weeding', labourMode: 'day', people: 4, days: 1, rate: 450, items: [] },
    { id: 'k8', date: '2026-11-02', fieldId: 'f1', type: 'manure', labourMode: 'bag', bags: 8, rate: 200, items: [{ name: 'NPK mix', qty: 8, stockId: 's1' }] },
    { id: 'k9', date: '2026-11-10', fieldId: 'f1', type: 'pest', labourMode: 'day', people: 2, days: 1, rate: 450, items: [{ name: 'Pesticide (litres)', qty: 2, unitCost: 640 }, { name: 'Sprayer hire', qty: 1, unitCost: 200 }], comment: 'Red spider mite on the lower rows' },
  ];
  const cost = { k1: 6000, k2: 8500, k3: 12500, k4: 3000, k5: 18000, k6: 1350, k7: 1800, k8: 1600, k9: 2380 };
  work.forEach((w) => E({ kind: 'work', workId: w.id, date: w.date, amount: cost[w.id], mode: 'cash', by: w.id === 'k9' ? 'Mom' : 'Ragu' }));
  const equipment = [{ id: 'q1', name: 'Tea cutting machine', date: '2026-08-04', cost: 38000, lifeYears: 5 }];
  E({ kind: 'equipment', equipmentId: 'q1', date: '2026-08-04', amount: 38000, mode: 'bank', by: 'Me' });
  E({ kind: 'equipment_run', equipmentId: 'q1', category: 'Fuel', date: '2026-09-15', amount: 2400, mode: 'cash', by: 'Ragu' });
  E({ kind: 'equipment_run', equipmentId: 'q1', category: 'Blade change', date: '2026-10-12', amount: 1100, mode: 'cash', by: 'Ragu' });
  E({ kind: 'misc', business: 'tea', category: 'Transport', fieldId: 'f1', date: '2026-11-13', amount: 150, mode: 'cash', by: 'Ragu', note: 'Auto to the agent' });

  // ── field lease ──────────────────────────────────────────────────────────
  const leases = [{ id: 'l1', fieldId: 'f3', lessee: 'Kumar', phone: '', start: '2025-12-08', end: '2026-12-07', kind: 'deposit', amount: 300000, note: 'Lessee handles manure and labour. Applied NPK in March.' }];
  E({ kind: 'lease_deposit', leaseId: 'l1', partyName: 'Kumar', date: '2025-12-08', amount: 300000, mode: 'bank', by: 'Me' });

  // ── rentals and home ─────────────────────────────────────────────────────
  E({ kind: 'tenant_advance', partyId: 't1', tenancyId: 'tn1', date: '2025-04-01', amount: 50000, mode: 'bank', by: 'Me' });
  monthsFrom('2025-04', monthKey(today)).forEach((mk) => {
    if (mk === '2026-11') return; // November not received yet
    const rent = mk >= '2026-04' ? 12000 : 11000;
    E({ kind: 'rent', partyId: 't1', tenancyId: 'tn1', propertyId: 'p1', months: [mk], date: mk === '2026-10' ? '2026-11-08' : mk + '-04', amount: rent, mode: 'upi', by: 'Me' });
  });
  monthsFrom('2024-09', monthKey(today)).forEach((mk) => E({ kind: 'rent', partyId: 't2', tenancyId: 'tn2', propertyId: 'p2', months: [mk], date: mk + '-02', amount: 9000, mode: 'bank', by: 'Mom' }));
  E({ kind: 'rental_expense', propertyId: 'p1', category: 'Painting', date: '2026-07-14', amount: 8500, mode: 'cash', by: 'Mom' });
  E({ kind: 'rental_expense', propertyId: 'p1', category: 'Plumbing', date: '2026-09-02', amount: 1200, mode: 'upi', by: 'Me' });
  E({ kind: 'home_expense', propertyId: 'p3', category: 'Roofing', date: '2025-12-02', amount: 22000, mode: 'bank', by: 'Me' });
  E({ kind: 'home_expense', propertyId: 'p3', category: 'Electrical', date: '2026-06-11', amount: 4200, mode: 'cash', by: 'Mom' });
  E({ kind: 'home_expense', propertyId: 'p3', category: 'Painting', date: '2026-10-05', amount: 15000, mode: 'upi', by: 'Me' });

  // ── rain ─────────────────────────────────────────────────────────────────
  const rain = [];
  for (let k = 420; k >= 0; k--) {
    const date = addDays(today, -k);
    const m = Number(date.slice(5, 7));
    const wet = [0.1, 0.1, 0.15, 0.3, 0.4, 0.6, 0.7, 0.6, 0.5, 0.6, 0.5, 0.2][m - 1];
    const mm = rnd() < wet ? Math.round(rnd() * 28 + 1) : 0;
    rain.push({ id: date, date, mm, source: 'sample' });
  }
  const r13 = rain.find((x) => x.date === '2026-11-13'); if (r13) r13.mm = 12;

  const notes = [{ id: 'n1', kind: 'todo', text: '2 people worked in Upper field on Thursday, log the weeding', date: '2026-11-19', done: false }];
  const settings = [{ id: 'app', handlers: ['Me', 'Ragu', 'Mom'], interestPct: 7 }];

  return { people, fields, properties, tenancies, deliveries, work, stock, equipment, leases, entries, rain, notes, settings };
}
