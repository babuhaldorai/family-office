import { mapOldData } from './migrate';
import { buildBooks } from './books';
import { makeBackup, fingerprint, validateBackup, planRestore } from './backup';
import { sampleData, SAMPLE_TODAY } from './sample';

const old = {
  workers: [{ id: 'w1', name: 'Lakshmi', status: 'active' }, { id: 'w2', name: 'Kannan', payBasis: 'daily', dailyRate: 500 }],
  agents: [{ id: 'a1', name: 'Ravi Traders' }],
  fields: [{ id: 'f1', name: 'Top', area: '2.5' }],
  tea_harvest: [
    { id: 'h1', date: '2026-01-05', worker: 'Lakshmi', field: 'Top', agent: 'Ravi Traders', bags: 2, tGross: 100, tBagDed: 2, tWaterDed: 3, tNet: 95,
      bagDetails: [{ gross: 60 }, { gross: 40 }], payBasis: 'kg', workerPay: 570, rate: 22, rateStatus: 'confirmed', agentRev: 2090,
      workerPayAmount: 570, workerPayDate: '2026-01-06', agentPayAmount: 2090, agentPayDate: '2026-01-12' },
    { id: 'h2', date: '2026-01-07', worker: 'Lakshmi', field: 'Top', agent: 'Ravi Traders', bags: 1, tGross: 50, tBagDed: 1, tWaterDed: 1, tNet: 48,
      bagDetails: [{ gross: 50 }], workerPay: 288, rate: 22, rateStatus: 'placeholder', agentRev: 1056 },
    { id: 'h3', date: '2026-01-08', worker: 'Kannan', field: 'Top', agent: 'Ravi Traders', bags: 1, tGross: 30, tBagDed: 0, tWaterDed: 0, tNet: 30,
      bagDetails: [{ gross: 30 }], payBasis: 'daily', workDays: 1, dayRate: 500, workerPay: 500, rate: 23, rateStatus: 'confirmed', agentRev: 690 },
    { id: 'h4', date: '2026-01-09', worker: 'Someone New', field: 'Bottom', agent: 'Ravi Traders', bags: 1, tGross: 20, tBagDed: 0, tWaterDed: 0, tNet: 20, workerPay: 120, rate: 0, rateStatus: 'no-rate', agentRev: 0 },
  ],
  tea_settlements: [{ id: 's1', worker: 'Kannan', netPaid: 500, date: '2026-01-10', notes: 'Week 2' }],
  tea_agent_payments: [{ id: 'p1', agent: 'Ravi Traders', amount: 690, date: '2026-01-15', method: 'UPI' }],
  tea_advances: [{ id: 'ad1', worker: 'Lakshmi', date: '2026-01-02', amount: 1000, deducted: false }, { id: 'ad2', worker: 'Lakshmi', date: '2025-12-01', amount: 400, deducted: true }],
  tea_inventory: [{ id: 'i1', date: '2026-01-03', category: 'Fertilizer', itemName: 'DAP', totalUnits: 10, unitCost: 1200, totalCost: 12000 }],
  tea_maintenance: [
    { id: 'm1', date: '2026-01-04', field: 'Top', task: 'Fertilizing', days: 1, rate: 600, cost: 600, fertItems: [{ type: 'DAP', bags: 4, rate: 1200, purchaseId: 'i1' }] },
    { id: 'm2', date: '2026-01-06', field: 'Top', task: 'Weeding', days: 2, rate: 450, cost: 900, worker: 'Kannan' },
  ],
  tea_weather: [{ id: 'x', date: '2026-01-05', rainfall: 14, temp: 22 }],
  tea_field_leases: [{ id: 'l1', field: 'Bottom', lessee: 'Kumar', startDate: '2025-06-01', endDate: '2026-05-31', amount: 100000 }],
  properties: [{ id: 'pr1', name: 'Shop', monthlyRent: 8000 }],
  tenants: [{ id: 't1', name: 'Anand', propertyId: 'pr1', leaseStart: '2025-01-01', leaseEnd: '2026-12-31', monthlyRent: 8000, deposit: 20000, status: 'active' }],
  rental_transactions: [
    { id: 'r1', date: '2026-01-03', type: 'income', category: 'Rent', amount: 8000, propertyId: 'pr1' },
    { id: 'r2', date: '2026-01-20', type: 'expense', category: 'Repairs', amount: 1500, propertyId: 'pr1', description: 'Shutter' },
  ],
  home_properties: [{ id: 'hp1', name: 'House' }],
  home_expenses: [{ id: 'he1', date: '2026-01-11', propertyId: 'hp1', category: 'Plumbing', amount: 2200, contractor: 'Mani' }],
};

describe('importing the old app', () => {
  const { data, report } = mapOldData(old, '2026-02-01');
  const b = buildBooks(data, '2026-02-01');

  test('every total matches the old app', () => {
    expect(report.rows.filter((r) => !r.ok)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test('the imported books pass their own checks', () => {
    expect(b.checks.filter((c) => !c.ok)).toEqual([]);
  });

  test('an estimated rate is not treated as money owed', () => {
    const h2 = b.deliveryById.get('old-harvest-h2');
    expect(h2.value).toBeNull();
    expect(h2.estRate).toBe(22);
    expect(b.deliveryById.get('old-harvest-h1').value).toBe(2090);
  });

  test('workers, agents and fields named only in harvests are still created', () => {
    expect(b.people.some((p) => p.name === 'Someone New' && p.kind === 'worker')).toBe(true);
    expect(b.fields.some((f) => f.name === 'Bottom')).toBe(true);
  });

  test('daily-wage sessions keep their wage and pay nothing per kg', () => {
    const w = b.deliveryById.get('old-harvest-h3').workers[0];
    expect(w.kgWage).toBe(0);
    expect(w.wage).toBe(500);
  });

  test('advances: outstanding ones stay outstanding, deducted ones are closed', () => {
    const w = b.workers.find((x) => x.name === 'Lakshmi');
    expect(w.advanceBalance).toBe(1000);
    expect(w.advanceGiven).toBe(1400);
  });

  test('manure used from inventory is linked to the purchase', () => {
    expect(b.stock[0].used).toBe(4);
    expect(b.stock[0].left).toBe(6);
  });

  test('running the import twice gives the same documents', () => {
    const again = mapOldData(old, '2026-02-01').data;
    expect(fingerprint(again)).toBe(fingerprint(data));
  });

  test('the old records are not modified', () => {
    const snapshot = JSON.stringify(old);
    mapOldData(old, '2026-02-01');
    expect(JSON.stringify(old)).toBe(snapshot);
  });
});

describe('backup and restore', () => {
  const data = sampleData();

  test('the fingerprint ignores order and changes when a figure changes', () => {
    const shuffled = { ...data, entries: [...data.entries].reverse() };
    expect(fingerprint(shuffled)).toBe(fingerprint(data));
    const edited = { ...data, entries: data.entries.map((e, i) => (i === 0 ? { ...e, amount: e.amount + 1 } : e)) };
    expect(fingerprint(edited)).not.toBe(fingerprint(data));
  });

  test('recording that a backup happened does not count as a change', () => {
    const marked = { ...data, settings: [...data.settings, { id: 'backup', at: 'now', fingerprint: 'x' }] };
    expect(fingerprint(marked)).toBe(fingerprint(data));
  });

  test('a backup survives being saved as text and read back', () => {
    const b = JSON.parse(JSON.stringify(makeBackup(data, { by: 'test' })));
    expect(validateBackup(b)).toBeNull();
    expect(planRestore(data, b, SAMPLE_TODAY).totalChanges).toBe(0);
  });

  test('a file that was altered after the backup is refused', () => {
    const b = JSON.parse(JSON.stringify(makeBackup(data)));
    b.collections.entries[0].amount += 1000;
    expect(validateBackup(b)).toMatch(/changed after/);
    expect(validateBackup({ hello: 1 })).toMatch(/not a backup/);
  });

  test('restore puts changed and deleted records back, and bins records added later', () => {
    const b = makeBackup(data);
    const later = {
      ...data,
      entries: data.entries.filter((e) => e.id !== 'sale-nov').map((e) => (e.id === 'pay-w1' ? { ...e, amount: 1 } : e)),
      deliveries: [...data.deliveries, { id: 'new1', date: '2026-11-20', fieldId: 'f1', agentId: 'a1', bags: [{ kg: 10, workerId: 'w1' }], bagDed: 0, waterDed: 0 }],
    };
    const plan = planRestore(later, b, SAMPLE_TODAY);
    const row = (c) => plan.perCollection.find((r) => r.col === c);
    expect(row('entries')).toMatchObject({ add: 1, change: 1, remove: 0 });
    expect(row('deliveries')).toMatchObject({ add: 0, change: 0, remove: 1 });
    expect(plan.after.netKg).toBe(buildBooks(data, SAMPLE_TODAY).totals.netKg);
    expect(plan.after.checksOk).toBe(true);
    const only = planRestore(later, b, SAMPLE_TODAY, { only: ['entries'] });
    expect(only.perCollection.map((r) => r.col)).toEqual(['entries']);
  });
});
