import { buildReminder } from './reminders';
import { sampleData, SAMPLE_TODAY } from './sample';

const withEmails = (data, reminders) => ({ ...data, settings: data.settings.map((s) => (s.id === 'app' ? { ...s, reminders } : s)) });

describe('email reminders', () => {
  const data = withEmails(sampleData(), { emails: ['me@example.com', 'not-an-email'], rent: { on: true, everyDays: 3 } });

  test('unpaid rent is sent, naming the property, the month and the amount', () => {
    const r = buildReminder(data, SAMPLE_TODAY, {}, 'https://example.app');
    expect(r.to).toEqual(['me@example.com']);
    expect(r.subject).toBe('Rent not logged: Shop 2 (₹12,000)');
    expect(r.text).toMatch(/Shop 2 \(Anand\): Nov 2026 — ₹12,000, due since 5 Nov 2026/);
    expect(r.text).not.toMatch(/House 1/); // paid up
    expect(r.state.rentLast).toBe(SAMPLE_TODAY);
  });

  test('it keeps going every chosen number of days until the rent is logged', () => {
    expect(buildReminder(data, '2026-11-23', { rentLast: '2026-11-21' }).skip).toMatch(/already reminded/);
    expect(buildReminder(data, '2026-11-24', { rentLast: '2026-11-21' }).subject).toMatch(/Rent not logged/);
    const paid = { ...data, entries: [...data.entries, { id: 'nov', kind: 'rent', tenancyId: 'tn1', partyId: 't1', months: ['2026-11'], date: '2026-11-22', amount: 12000, expected: 12000 }] };
    expect(buildReminder(paid, '2026-11-24', { rentLast: '2026-11-21' }).skip).toMatch(/No rent is unpaid/);
  });

  test('nothing is sent without an email address, or when rent reminders are off', () => {
    expect(buildReminder(sampleData(), SAMPLE_TODAY).skip).toMatch(/No email address/);
    const off = withEmails(sampleData(), { emails: ['me@example.com'], rent: { on: false }, questions: { on: false } });
    expect(buildReminder(off, SAMPLE_TODAY).skip).toBeTruthy();
  });

  test('open questions for someone are included', () => {
    const q = { ...data, notes: [...data.notes, { id: 'q1', kind: 'todo', text: 'How was the lease amount received?', assignee: 'Ragu', by: 'Me', about: 'Lease of Lower field', date: '2026-11-20', done: false }] };
    const r = buildReminder(q, SAMPLE_TODAY);
    expect(r.text).toMatch(/For Ragu: How was the lease amount received\? \(Lease of Lower field\) — asked by Me/);
    expect(r.html).not.toMatch(/<script/);
  });
});
