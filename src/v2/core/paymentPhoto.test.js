import { buildBooks } from './books';
import { sampleData, SAMPLE_TODAY } from './sample';
import { paymentOps } from '../data/actions';

// An optional photo kept with a payment: saved with it, kept on edit, and
// removed when cleared. It never changes any amount.
describe('photo kept with a payment', () => {
  const raw = sampleData();
  const b = buildBooks(raw, SAMPLE_TODAY);
  const worker = b.workers.find((w) => w.active !== false);
  const base = { kind: 'advance', partyId: worker.id, date: SAMPLE_TODAY, amount: '500', mode: 'cash', by: 'Ragu' };

  test('is saved when given, and left out when not', () => {
    const withPhoto = paymentOps({ ...base, photoPath: 'payments/2026-11/x.jpg' }, b);
    expect(withPhoto.error).toBeUndefined();
    expect(withPhoto.ops[0].data.photoPath).toBe('payments/2026-11/x.jpg');
    const without = paymentOps(base, b);
    expect('photoPath' in without.ops[0].data).toBe(false);
  });

  test('does not change the books', () => {
    const add = (ops) => ({ ...raw, entries: [...raw.entries, ops[0].data] });
    const a = buildBooks(add(paymentOps({ ...base, id: 'p1', photoPath: 'payments/2026-11/x.jpg' }, b).ops), SAMPLE_TODAY);
    const c = buildBooks(add(paymentOps({ ...base, id: 'p1' }, b).ops), SAMPLE_TODAY);
    expect(a.workerById.get(worker.id).advanceBalance).toBe(c.workerById.get(worker.id).advanceBalance);
    expect(a.entryById.get('p1').photoPath).toBe('payments/2026-11/x.jpg');
  });
});
