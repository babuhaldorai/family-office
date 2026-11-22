import { buildBooks } from './books';
import { sampleData, SAMPLE_TODAY } from './sample';
import { paymentOps, deliveryOps } from '../data/actions';
import { photosOf, photoBadge } from './photos';
import { harvestTodoOps } from './todos';
import { fmtMomentIST } from './util';

const raw = sampleData();
const b = buildBooks(raw, SAMPLE_TODAY);
const worker = b.workers.find((w) => w.active !== false);
const pay = { kind: 'advance', partyId: worker.id, date: SAMPLE_TODAY, amount: '500', mode: 'cash', by: 'Ragu' };
const two = [{ path: 'payments/2026-11/a.jpg', at: '2026-11-20T10:10:00.000Z', by: 'Ragu' }, { path: 'payments/2026-11/b.jpg', at: '2026-11-22T09:40:00.000Z', by: 'Mom' }];

describe('photos on payments and harvests', () => {
  test('a payment keeps several photos, each with when and who', () => {
    const res = paymentOps({ ...pay, photos: two }, b);
    expect(res.error).toBeUndefined();
    expect(res.ops[0].data.photos).toEqual(two);
    expect('photos' in paymentOps({ ...pay, photos: [] }, b).ops[0].data).toBe(false);
  });
  test('a photo saved the old way is read as the first photo, and kept when the entry is saved again', () => {
    const old = { id: 'p-old', ...pay, amount: 500, expected: 500, photoPath: 'payments/2026-11/old.jpg' };
    expect(photosOf(old)).toEqual([{ path: 'payments/2026-11/old.jpg', at: '' }]);
    const bk = buildBooks({ ...raw, entries: [...raw.entries, old] }, SAMPLE_TODAY);
    const res = paymentOps({ ...pay, id: 'p-old' }, bk);
    expect(res.ops[0].data.photos.map((p) => p.path)).toEqual(['payments/2026-11/old.jpg']);
    expect('photoPath' in res.ops[0].data).toBe(false);
  });
  test('the list badge shows how many and the India date of the last one', () => {
    expect(photoBadge({})).toBe('');
    expect(photoBadge({ photos: [two[0]] })).toBe('📷 20 Nov');
    expect(photoBadge({ photos: two })).toBe('📷 2 · last 22 Nov');
    expect(photoBadge({ slipPath: 'slips/x.jpg' })).toBe('📷 photo');
    // 22 Nov 09:40 UTC is 3:10 pm in India; 20:00 UTC on the 21st is already the 22nd there
    expect(fmtMomentIST('2026-11-22T09:40:00.000Z')).toBe('22 Nov 2026, 3:10 pm');
    expect(photoBadge({ photos: [{ path: 'x', at: '2026-11-21T20:00:00.000Z' }] })).toBe('📷 22 Nov');
  });
  test('a harvest keeps several slip photos', () => {
    const d = b.deliveries[b.deliveries.length - 1];
    const form = { id: d.id, date: d.date, fieldId: d.fieldId, agentId: d.agentId, bags: d.bags.map((x) => ({ kg: x.kg, workerId: x.workerId })), bagDed: d.bagDed, waterDed: d.waterDed, otherDed: d.otherDed, dayWork: d.dayWork, photos: two };
    const res = deliveryOps(form, b);
    expect(res.error).toBeUndefined();
    expect(res.ops[0].data.photos).toEqual(two);
  });
});

describe('to-dos from a harvest', () => {
  const ctx = { deliveryId: 'd9', fieldId: 'f1', fieldName: 'Road field', date: '2026-11-21', nameOf: (id) => ({ w1: 'Lakshmi' }[id] || ''), by: 'Owner', today: '2026-11-22', newId: (() => { let n = 0; return () => `n${++n}`; })() };
  test('each to-do becomes a note for the chosen person, naming the field, day and worker, linked to the harvest', () => {
    const ops = harvestTodoOps([{ text: ' Check the deduction ', who: 'Ragu', workerId: 'w1' }, { text: 'Buy bags', who: 'Owner', workerId: '' }, { text: '  ', who: 'Mom' }], ctx);
    expect(ops).toHaveLength(2);
    expect(ops[0].data).toMatchObject({ kind: 'todo', text: 'Check the deduction', assignee: 'Ragu', about: 'Harvest · Road field · Sat 21 Nov · Lakshmi', link: '/harvest/d9', fieldId: 'f1', workerId: 'w1', done: false, date: '2026-11-22' });
    expect(ops[1].data.about).toBe('Harvest · Road field · Sat 21 Nov');
  });
});
