import { buildBooks } from './books';
import { sampleData, SAMPLE_TODAY } from './sample';
import { purchaseOps, mixOps, applyOps, removeWithPayments } from '../data/actions';
import { manureBuyPlan, ideasForHome, dayAccounting, workerDays } from './planner';

// apply the changes an action returns to plain data, the way the stores do
function apply(raw, ops) {
  const out = { ...raw };
  ops.forEach((op) => {
    const list = [...(out[op.col] || [])];
    const i = list.findIndex((d) => d.id === op.id);
    const before = i >= 0 ? list[i] : null;
    const after = op.remove ? { ...before, deleted: true } : op.patch ? { ...before, ...op.patch } : { ...op.data };
    if (i >= 0) list[i] = after; else list.push(after);
    out[op.col] = list;
  });
  return out;
}

describe('buying, mixing and applying manure', () => {
  let raw = sampleData();
  let b = buildBooks(raw, SAMPLE_TODAY);
  const pay = { paid: true, mode: 'cash', by: 'Ragu' };

  test('one purchase of several types shares one transport charge and one payment', () => {
    const res = purchaseOps({ date: '2026-11-18', vendor: 'Sri Agro', transport: '900', pay,
      lines: [{ name: 'NPK', bags: '10', costPerBag: '1400' }, { name: 'Dolomite', bags: '5', costPerBag: '300' }, { name: 'Neem cake', bags: '3', costPerBag: '900' }] }, b);
    expect(res.error).toBeUndefined();
    expect(res.cost).toBe(14000 + 1500 + 2700 + 900);
    raw = apply(raw, res.ops); b = buildBooks(raw, SAMPLE_TODAY);
    const lines = b.stock.filter((s) => s.groupId === res.id);
    expect(lines.map((s) => s.transport)).toEqual(expect.arrayContaining([500, 250, 150]));
    expect(lines.every((s) => s.due === 0)).toBe(true);
    expect(b.entries.filter((e) => e.kind === 'stock' && e.stockIds).length).toBe(1);
    expect(b.ok).toBe(true);
  });

  test('a mix takes bags from what was bought and is costed from it', () => {
    const npk = b.stock.find((s) => s.name === 'NPK'); const dolo = b.stock.find((s) => s.name === 'Dolomite');
    const res = mixOps({ date: '2026-11-19', inputs: [{ stockId: npk.id, qty: '6' }, { stockId: dolo.id, qty: '3' }], bags: '10' }, b);
    expect(res.error).toBeUndefined();
    raw = apply(raw, res.ops); b = buildBooks(raw, SAMPLE_TODAY);
    const mix = b.stockById.get(res.id);
    expect(mix.name).toBe('Mix of NPK + Dolomite');
    expect(mix.cost).toBe(6 * 1450 + 3 * 350);
    expect(mix.unitCost).toBe(975);
    expect(b.stock.find((s) => s.name === 'NPK').left).toBe(4);
    expect(b.compositionOf(res.id)).toEqual({ NPK: 6 / 9, Dolomite: 3 / 9 });
    expect(mixOps({ date: '2026-11-19', inputs: [{ stockId: npk.id, qty: '9' }], bags: '9' }, b).error).toMatch(/Only 4 bags of NPK/);
    expect(b.ok).toBe(true);
  });

  test('one day\'s applying across two fields: one payment, each field charged its share', () => {
    const mix = b.stock.find((s) => s.kind === 'mix');
    const res = applyOps({ date: '2026-11-20', rate: '200', pay, lines: [{ fieldId: 'f1', stockId: mix.id, bags: '6' }, { fieldId: 'f2', stockId: mix.id, bags: '4' }] }, b);
    expect(res.labour).toBe(2000);
    raw = apply(raw, res.ops); b = buildBooks(raw, SAMPLE_TODAY);
    const ws = b.work.filter((w) => w.groupId === res.id).sort((x, y) => y.fieldName.localeCompare(x.fieldName));
    expect(ws.map((w) => [w.fieldName, w.cost, w.fieldCost, w.due])).toEqual([['Upper field', 1200, 1200 + 6 * 975, 0], ['Road field', 800, 800 + 4 * 975, 0]]);
    expect(b.stock.find((s) => s.id === mix.id).left).toBe(0);
    expect(applyOps({ date: '2026-11-20', rate: '200', lines: [{ fieldId: 'f1', stockId: mix.id, bags: '1' }] }, b).error).toMatch(/Only 0 bags/);
    expect(b.ok).toBe(true);
    // deleting one field of the day removes the whole day, with its payment
    const rm = removeWithPayments('work', ws[0].id, b);
    expect(rm.groupSize).toBe(2);
    expect(rm.alsoRemoved).toBe(1);
    expect(buildBooks(apply(raw, rm.ops), SAMPLE_TODAY).ok).toBe(true);
  });

  test('bags to buy come from each field\'s own rate, size and yield, split by the last mix used', () => {
    const plan = manureBuyPlan(buildBooks(sampleData(), SAMPLE_TODAY));
    const road = plan.due.find((d) => d.fieldId === 'f2');
    expect(road.bags).toBeGreaterThan(0);
    expect(road.own).toBe(true);
    expect(Object.values(road.comp).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(plan.types.length).toBeGreaterThan(0);
    plan.types.forEach((t) => expect(t.toBuy).toBe(Math.max(0, Math.ceil(t.need - t.have))));
  });
});

describe('Home ideas, every day accounted for, and a worker\'s earnings', () => {
  const b = buildBooks(sampleData(), SAMPLE_TODAY);
  test('there are several ideas to rotate through', () => { expect(ideasForHome(b).length).toBeGreaterThan(3); });
  test('every day in the period is harvested, marked no harvest, or listed as missing', () => {
    const raw = sampleData();
    raw.notes.push({ id: 'nh', kind: 'noharvest', date: '2026-11-14' });
    const a = dayAccounting(buildBooks(raw, SAMPLE_TODAY), { from: '2026-11-09', to: '2026-11-21' });
    expect(a.harvested).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    expect(a.none).toEqual(['2026-11-14']);
    expect(a.missing.length).toBe(13 - 6);
  });
  test('a worker\'s days in a range add up to what the books say they earned', () => {
    const d = workerDays(b, 'w1', { from: '2026-11-09', to: '2026-11-15' });
    expect(d.days.length).toBe(4);
    expect(d.earned).toBe(b.byWorker({ from: '2026-11-09', to: '2026-11-15' }).find((x) => x.id === 'w1').earned);
  });
});
