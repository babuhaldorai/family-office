import { buildBooks } from './books';

// Every rent payment shows under a month on its house, even when the move-in
// date is missing, after today, or later than the payments.
const T = '2026-11-20';
const books = (start, extra = []) => buildBooks({
  properties: [{ id: 'p', kind: 'rental', name: 'House' }], people: [{ id: 'tn', kind: 'tenant', name: 'A' }],
  tenancies: [{ id: 't', propertyId: 'p', tenantId: 'tn', start, rents: [{ from: '2000-01-01', amount: 10000 }] }],
  entries: [
    { id: 'e1', kind: 'rent', tenancyId: 't', partyId: 'tn', propertyId: 'p', months: ['2026-08'], date: '2026-08-03', amount: 10000, expected: 10000 },
    { id: 'e2', kind: 'rent', propertyId: 'p', business: 'rental', date: '2026-09-04', amount: 10000, expected: 10000 },
    ...extra],
}, T);
const grid = (b) => b.tenancies[0].months.map((m) => `${m.mk}:${m.status}`);

describe('rent months on a house', () => {
  test('move-in date after today: past payments still listed, nothing owed, date flagged', () => {
    const b = books('2026-12-01');
    expect(grid(b)).toEqual(['2026-08:paid', '2026-09:paid']);
    expect(b.tenancies[0].balance).toBe(0);
    expect(b.attention.some((a) => a.title === 'Check the move-in date' && /after today/.test(a.sub))).toBe(true);
  });
  test('no move-in date: payments listed with this month, date flagged', () => {
    const b = books('');
    expect(grid(b)).toEqual(['2026-08:paid', '2026-09:paid', '2026-11:due']);
    expect(b.tenancies[0].startProblem).toBe('missing');
  });
  test('a date not written as yyyy-mm-dd is treated as missing instead of breaking the app', () => {
    expect(books('01/06/2025').tenancies[0].startProblem).toBe('missing');
  });
  test('normal move-in date: every month from move-in, a payment without a tenant counts for its own month', () => {
    const b = books('2026-06-01');
    expect(grid(b)).toEqual(['2026-06:due', '2026-07:due', '2026-08:paid', '2026-09:paid', '2026-10:due', '2026-11:due']);
    expect(b.tenancies[0].startProblem).toBe('');
  });
  test('rent recorded before the move-in date is listed and flagged', () => {
    const b = books('2026-09-01');
    expect(grid(b)).toEqual(['2026-08:paid', '2026-09:paid', '2026-10:due', '2026-11:due']);
    expect(b.tenancies[0].startProblem).toBe('after-payments');
  });
});
