import { buildBooks, computeDelivery, workCost, settledCash, agentForField } from './books';
import { sampleData, SAMPLE_TODAY } from './sample';
import { todayIST, inr, fmtDate, addMonths, periodFor, sum, r2, parseLatLon } from './util';
import { doBetter, fieldPlan, leaseAdvice, forecastNextMonth, yearAhead, beforeAfter } from './insights';

const ALL = { from: '0000-01-01', to: '9999-12-31' };
const WEEK = { from: '2026-11-09', to: '2026-11-15' };
const people = new Map([['L', { id: 'L', kgRate: 6 }], ['S', { id: 'S', kgRate: 6 }]]);

describe('one delivery', () => {
  test('three 50 kg bags with one 10 kg deduction give 140 kg net, shared by weight picked', () => {
    const d = computeDelivery({ bags: [{ kg: 50, workerId: 'L' }, { kg: 50, workerId: 'L' }, { kg: 50, workerId: 'S' }], bagDed: 5, waterDed: 5 }, people);
    expect(d.gross).toBe(150);
    expect(d.ded).toBe(10);
    expect(d.net).toBe(140);
    const L = d.workers.find((w) => w.workerId === 'L');
    const S = d.workers.find((w) => w.workerId === 'S');
    expect(L.netKg).toBe(93.33);
    expect(S.netKg).toBe(46.67);
    expect(L.wage).toBe(560);
    expect(S.wage).toBe(280);
    expect(d.wages).toBe(840);
    expect(d.waterPct).toBe(3.33);
    expect(d.value).toBeNull();
  });

  test('worker shares always add up to the net kg', () => {
    for (let i = 1; i <= 40; i++) {
      const bags = [{ kg: 37.5 + i * 0.3, workerId: 'L' }, { kg: 41.2 + i * 0.7, workerId: 'S' }, { kg: 29.9, workerId: 'X' }];
      const d = computeDelivery({ bags, bagDed: 1.7 + i * 0.1, waterDed: 2.3 }, people);
      expect(r2(sum(d.workers, (w) => w.netKg))).toBe(d.net);
    }
  });

  test('a slip with its own deduction per worker is followed exactly', () => {
    // 13 Nov slip: 191 kg less 7 = 184 x 6 = 1,104 and 164 kg less 6 = 158 x 6 = 948
    const col1 = [25, 28, 28, 22, 27, 32, 29].map((kg) => ({ kg, workerId: 'L' }));
    const col2 = [24, 25, 23, 17, 26, 23, 26].map((kg) => ({ kg, workerId: 'S' }));
    const d = computeDelivery({ bags: [...col1, ...col2], bagDed: 13, waterDed: 0, dedBy: { L: 7, S: 6 } }, people);
    expect(d.gross).toBe(355);
    expect(d.net).toBe(342);
    expect(d.dedByWorker).toBe(true);
    expect(d.workers.map((w) => [w.grossKg, w.netKg, w.wage])).toEqual([[191, 184, 1104], [164, 158, 948]]);
    // per-worker figures that do not add up to the total are ignored, not half-applied
    const bad = computeDelivery({ bags: [...col1, ...col2], bagDed: 13, waterDed: 0, dedBy: { L: 7, S: 2 } }, people);
    expect(bad.dedByWorker).toBe(false);
    expect(r2(sum(bad.workers, (w) => w.netKg))).toBe(342);
    // uneven per-worker deductions give a different split from sharing by weight
    const uneven = computeDelivery({ bags: [{ kg: 100, workerId: 'L' }, { kg: 100, workerId: 'S' }], bagDed: 10, waterDed: 0, dedBy: { L: 8, S: 2 } }, people);
    expect(uneven.workers.map((w) => w.netKg)).toEqual([92, 98]);
  });

  test('a deduction can be for bags, water and something else', () => {
    const d = computeDelivery({ bags: [{ kg: 100, workerId: 'L' }], bagDed: 2, waterDed: 3, otherDed: 1.5 }, people);
    expect(d.ded).toBe(6.5);
    expect(d.net).toBe(93.5);
    expect(d.waterPct).toBe(3);
  });

  test('the usual agent for a field follows its dated list', () => {
    const f = { agentLinks: [{ agentId: 'a1', from: '2026-01-01', to: '2026-06-30' }, { agentId: 'a2', from: '2026-07-01' }] };
    expect(agentForField(f, '2026-03-10')).toBe('a1');
    expect(agentForField(f, '2026-06-30')).toBe('a1');
    expect(agentForField(f, '2026-07-01')).toBe('a2');
    expect(agentForField(f, '2025-12-31')).toBe('');
    expect(agentForField({}, '2026-01-01')).toBe('');
  });

  test('rate turns into an amount due only once it is known', () => {
    const base = { bags: [{ kg: 100, workerId: 'L' }], bagDed: 2, waterDed: 3 };
    expect(computeDelivery({ ...base, rate: '' }, people).value).toBeNull();
    expect(computeDelivery({ ...base, rate: 24.5 }, people).value).toBe(2327.5);
  });

  test('daily wage is added on top of, or instead of, per-kg pay', () => {
    const d = computeDelivery({ bags: [{ kg: 60, workerId: 'L' }], bagDed: 0, waterDed: 0, kgRates: { L: 0 }, dayWork: [{ workerId: 'L', days: 1, dayRate: 450 }] }, people);
    expect(d.workers[0].wage).toBe(450);
  });

  test('deducting more than was weighed is flagged, never negative', () => {
    const d = computeDelivery({ bags: [{ kg: 5, workerId: 'L' }], bagDed: 4, waterDed: 4 }, people);
    expect(d.net).toBe(0);
    expect(d.overDeducted).toBe(true);
  });
});

describe('field work cost', () => {
  test('per-bag charge, direct material and manure taken from stock', () => {
    const stock = new Map([['s1', { id: 's1', unitCost: 1440 }]]);
    const c = workCost({ labourMode: 'bag', bags: 8, rate: 200, items: [{ qty: 8, stockId: 's1' }] }, stock);
    expect(c.cost).toBe(1600);          // what is paid now
    expect(c.fieldCost).toBe(13120);    // what the field really cost, with the manure
    const p = workCost({ labourMode: 'day', people: 2, days: 1, rate: 450, items: [{ qty: 2, unitCost: 640 }, { qty: 1, unitCost: 200 }] });
    expect(p.cost).toBe(2380);
  });
});

describe('work done by a lessee', () => {
  test('is recorded with no cost, and still counts as the last time the field was manured', () => {
    const c = workCost({ byLessee: true, type: 'manure', labourMode: 'bag', bags: 10, rate: 200, items: [{ name: 'NPK', qty: 10, unitCost: 1400 }] });
    expect(c.cost).toBe(0);
    expect(c.fieldCost).toBe(0);
    expect(c.bagsApplied).toBe(10);
    const data = sampleData();
    const before = buildBooks(data, SAMPLE_TODAY);
    const withLessee = buildBooks({ ...data, work: [...data.work, { id: 'lz', date: '2026-10-01', fieldId: 'f3', type: 'manure', byLessee: true, items: [{ name: 'NPK', qty: 10 }] }] }, SAMPLE_TODAY);
    expect(withLessee.ok).toBe(true);
    expect(withLessee.bills.length).toBe(before.bills.length);
    expect(withLessee.pnl({ from: '0000-01-01', to: '9999-12-31' }).profit).toBe(before.pnl({ from: '0000-01-01', to: '9999-12-31' }).profit);
    expect(withLessee.byField({ from: '0000-01-01', to: '9999-12-31' }).find((f) => f.fieldId === 'f3').work).toBe(0);
    expect(fieldPlan(withLessee, 'f3').items.find((i) => i.type === 'manure').last).toBe('2026-10-01');
  });
});

describe('the sample books', () => {
  const data = sampleData();
  const b = buildBooks(data, SAMPLE_TODAY);

  test('every self-check passes', () => {
    expect(b.checks.filter((c) => !c.ok)).toEqual([]);
    expect(b.ok).toBe(true);
  });

  test('week of 9–15 Nov: kg agree between agents and workers', () => {
    const t = b.teaAccount(WEEK);
    expect(t.weighed).toBe(715);
    expect(t.deducted).toBe(38);
    expect(t.netAgent).toBe(677);
    expect(t.netWorkers).toBe(677);
    expect(t.kgOk).toBe(true);
    expect(t.agentValue).toBe(10094);
    expect(t.unratedKg).toBe(265);
  });

  test('agent paid ₹94 short "settle next time": the ₹94 stays owed', () => {
    const a = b.agentById.get('a1');
    expect(a.balance).toBe(94);
    expect(a.unratedKg).toBe(0);
    expect(b.agentById.get('a2').unratedKg).toBe(265);
    expect(b.deliveryById.get('d5').agentStatus).toBe('paid');
    expect(b.deliveryById.get('d2').agentStatus).toBe('norate');
  });

  test('the same shortfall marked "rounded off" is closed and nothing stays owed', () => {
    const d2 = { ...data, entries: data.entries.map((e) => (e.id === 'sale-nov' ? { ...e, diffReason: 'round' } : e)) };
    expect(buildBooks(d2, SAMPLE_TODAY).agentById.get('a1').balance).toBe(0);
  });

  test('worker paid ₹90 extra as a gift: wages settled, gift not carried, advance reduced', () => {
    const w = b.workerById.get('w1');
    expect(w.due).toBe(0);
    expect(w.extraPaid).toBe(90);
    expect(w.advanceBalance).toBe(2500);
    const pay = data.entries.find((e) => e.id === 'pay-w1');
    expect(settledCash(pay)).toBe(pay.expected);
  });

  test('the same ₹90 marked "settle next time" becomes a credit against future wages', () => {
    const d2 = { ...data, entries: data.entries.map((e) => (e.id === 'pay-w1' ? { ...e, diffReason: 'later' } : e)) };
    expect(buildBooks(d2, SAMPLE_TODAY).workerById.get('w1').due).toBe(-90);
  });

  test('paying in whole rupees never builds up a paise balance', () => {
    const d2 = { ...data, entries: data.entries.filter((e) => e.id !== 'sale-nov'), deliveries: data.deliveries.filter((d) => !['d1', 'd3', 'd5'].includes(d.id)) };
    const a = buildBooks(d2, SAMPLE_TODAY).agentById.get('a1');
    expect(a.sales.some((e) => e.amount !== e.expected)).toBe(true); // paise were rounded on some payments
    expect(a.balance).toBe(0);
  });

  test('an unpaid worker shows as wages due, with the unpaid days listed', () => {
    const w = b.workerById.get('w3');
    expect(w.due).toBeGreaterThan(0);
    expect(r2(sum(w.unpaid, (r) => r.remaining))).toBe(w.due);
    expect(b.attention.find((x) => x.id === 'wages').amount).toBe(w.due);
  });

  test('profit and cash reconcile for any period', () => {
    [ALL, WEEK, periodFor('year', SAMPLE_TODAY), periodFor('lastYear', SAMPLE_TODAY), periodFor('month', SAMPLE_TODAY), { from: '2026-08-01', to: '2026-08-31' }].forEach((p) => {
      ['all', 'tea', 'rental', 'home'].forEach((business) => {
        const x = b.pnl(p, { business });
        expect(x.bridgeOk).toBe(true);
        expect(x.cashNet).toBe(r2(x.cashIn - x.cashOut));
      });
    });
  });

  test('money in and out equal the sum of the entries, and the monthly split adds up', () => {
    const p = b.pnl(ALL);
    expect(p.cashIn).toBe(sum(b.entries.filter((e) => e.dir === 'in'), (e) => e.amount));
    expect(p.cashOut).toBe(sum(b.entries.filter((e) => e.dir === 'out'), (e) => e.amount));
    const m = b.monthly(ALL);
    expect(sum(m, (x) => x.in)).toBe(p.cashIn);
    expect(sum(m, (x) => x.out)).toBe(p.cashOut);
    const h = b.byHandler(ALL);
    expect(sum(h, (x) => x.in)).toBe(p.cashIn);
    expect(sum(h, (x) => x.out)).toBe(p.cashOut);
  });

  test('a deposit lease is not income; equipment is spread over its life', () => {
    const p = b.pnl(ALL);
    expect(p.income.get('Field lease')).toBeUndefined();
    expect(p.depositsIn).toBe(350000);
    expect(b.leases[0].toReturn).toBe(300000);
    expect(p.capitalBought).toBe(38000);
    expect(p.equipShare).toBeGreaterThan(2000);
    expect(p.equipShare).toBeLessThan(2500); // about 110 days of a 5 year life
  });

  test('one-time work is kept apart from regular costs', () => {
    const p = b.pnl(ALL);
    expect(p.oneTimeTotal).toBe(18000);
    expect(p.expense.get('Other field work')).toBeUndefined();
  });

  test('field totals equal the overall totals', () => {
    const f = b.byField(ALL);
    expect(sum(f, (x) => x.netKg)).toBe(b.totals.netKg);
    expect(sum(f, (x) => x.income)).toBe(b.totals.value);
    expect(sum(f, (x) => x.wages)).toBe(b.totals.wages);
    expect(sum(b.byAgent(ALL), (x) => x.netKg)).toBe(b.totals.netKg);
    expect(sum(b.byWorker(ALL), (x) => x.earned)).toBe(b.totals.wages);
  });

  test('rent: November is unpaid, October was paid late, advance is held', () => {
    const t = b.tenancyById.get('tn1');
    expect(t.currentRent).toBe(12000);
    expect(t.unpaidMonths.map((m) => m.mk)).toEqual(['2026-11']);
    expect(t.months.find((m) => m.mk === '2026-10').status).toBe('late');
    expect(t.balance).toBe(12000);
    expect(t.advanceHeld).toBe(50000);
    expect(t.rents[1].pct).toBe(9.09);
    expect(b.tenancyById.get('tn2').unpaidMonths).toEqual([]);
  });

  test('manure stock: bought, applied and left', () => {
    const s = b.stockById.get('s1');
    expect(s.cost).toBe(28800);
    expect(b.stock.find((x) => x.id === 's1').used).toBe(8);
    expect(b.stock.find((x) => x.id === 's1').left).toBe(12);
  });

  test('records in the recycle bin are left out of every total', () => {
    const d2 = { ...data, deliveries: data.deliveries.map((d) => (d.id === 'd2' || d.id === 'd4' ? { ...d, deleted: true } : d)) };
    const b2 = buildBooks(d2, SAMPLE_TODAY);
    expect(b2.teaAccount(WEEK).netAgent).toBe(412);
    expect(b2.ok).toBe(true);
  });

  test('a payment pointing at a deleted delivery is caught by the checks', () => {
    const d2 = { ...data, deliveries: data.deliveries.map((d) => (d.id === 'd1' ? { ...d, deleted: true } : d)) };
    const b2 = buildBooks(d2, SAMPLE_TODAY);
    expect(b2.ok).toBe(false);
    expect(b2.checks.find((c) => !c.ok).name).toMatch(/still exist/);
  });

  test('advice runs on the sample and gives sensible numbers', () => {
    const tips = doBetter(b);
    expect(tips.length).toBeGreaterThan(2);
    expect(tips.some((t) => /deducts more/.test(t.title))).toBe(true);
    expect(tips.some((t) => /House 1 rent has not changed/.test(t.title))).toBe(true);
    const plan = fieldPlan(b, 'f2');
    expect(plan.items.find((i) => i.type === 'manure').status).toBe('now');
    expect(plan.items.find((i) => i.type === 'pruning').status).toBe('ok');
    expect(yearAhead(b).length).toBeGreaterThan(0);
    const adv = leaseAdvice(b, 'f1', 7);
    expect(adv.enough).toBe(true);
    expect(adv.suggested).toBeGreaterThanOrEqual(adv.floor);
    expect(adv.compare(300000, 'deposit').gain).toBe(21000);
    expect(leaseAdvice(b, 'f3').enough).toBe(false);
    const f = forecastNextMonth(b);
    expect(f.kgLow).toBeLessThan(f.kgHigh);
    const ba = beforeAfter(b, b.workById.get('k4'));
    expect(ba.before.kg).toBeGreaterThan(0);
    expect(ba.after.kg).toBeGreaterThan(0);
  });
});

describe('field location', () => {
  test('coordinates are read from what people paste from Google Maps', () => {
    expect(parseLatLon('11.4102, 76.6950')).toEqual({ lat: 11.4102, lon: 76.695 });
    expect(parseLatLon('https://www.google.com/maps/place/Coonoor/@11.3530,76.7959,14z/data=!3m1')).toEqual({ lat: 11.353, lon: 76.7959 });
    expect(parseLatLon('https://www.google.com/maps/place/X/@11.30,76.70,17z/data=!4m5!3m4!8m2!3d11.3412!4d76.7821')).toEqual({ lat: 11.3412, lon: 76.7821 });
    expect(parseLatLon('https://maps.google.com/?q=11.35,76.79')).toEqual({ lat: 11.35, lon: 76.79 });
    expect(parseLatLon('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
    expect(parseLatLon('Coonoor')).toBeNull();
    expect(parseLatLon('999, 999')).toBeNull();
  });
});

describe('dates and money', () => {
  test('"today" is the India date, whatever country the device is in', () => {
    expect(todayIST(new Date('2026-11-13T18:29:00Z'))).toBe('2026-11-13'); // 23:59 in India
    expect(todayIST(new Date('2026-11-13T18:30:00Z'))).toBe('2026-11-14'); // midnight in India
    expect(todayIST(new Date('2026-11-14T03:00:00Z'))).toBe('2026-11-14'); // evening of the 13th in the US
  });
  test('dates are written so they cannot be misread', () => {
    expect(fmtDate('2026-12-11')).toBe('11 Dec 2026');
    expect(fmtDate('2026-11-13', { dow: true, year: false })).toBe('Fri 13 Nov');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
  test('rupees use Indian grouping and show paise only when needed', () => {
    expect(inr(1234567)).toBe('₹12,34,567');
    expect(inr(3246.25)).toBe('₹3,246.25');
    expect(inr(-94)).toBe('−₹94');
  });
});
