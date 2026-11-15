import { buildReminders, reminderRecipients } from './reminders';
import { sampleData, SAMPLE_TODAY } from './sample';

const withReminders = (data, reminders) => ({ ...data, settings: data.settings.map((s) => (s.id === 'app' ? { ...s, reminders } : s)) });
const q = { id: 'q1', kind: 'todo', text: 'How was the lease amount received?', assignee: 'Ragu', by: 'Me', about: 'Lease of Lower field', date: '2026-11-20', done: false };

describe('email reminders', () => {
  const base = sampleData();
  const data = withReminders({ ...base, notes: [...base.notes, q] }, {
    recipients: [
      { email: 'me@example.com', person: 'Me', rent: true, items: 'mine', attention: true, everyDays: 3 },
      { email: 'ragu@example.com', person: 'Ragu', rent: false, items: 'mine', attention: false, everyDays: 1 },
      { email: 'not-an-email', person: 'Mom' },
    ],
  });

  test('each person gets one email with their own mix', () => {
    const r = buildReminders(data, SAMPLE_TODAY, {}, 'https://example.app');
    expect(r.emails.map((e) => e.to[0])).toEqual(['me@example.com', 'ragu@example.com']);
    const [me, ragu] = r.emails;
    expect(me.subject).toMatch(/^Rent not logged: Shop 2 \(₹12,000\) and \d+ more$/);
    expect(me.text).toMatch(/Shop 2 \(Anand\): Nov 2026 — ₹12,000, due since 5 Nov 2026/);
    expect(me.text).toMatch(/ALSO NEEDS ATTENTION/);
    expect(me.text).not.toMatch(/How was the lease amount received/); // that one is for Ragu
    expect(me.text).toMatch(/2 people worked in Upper field/);          // not addressed to anyone, so everyone sees it
    expect(ragu.text).toMatch(/ACTION ITEMS FOR RAGU/);
    expect(ragu.text).toMatch(/How was the lease amount received\? \(Lease of Lower field\) — from Me/);
    expect(ragu.text).not.toMatch(/RENT NOT LOGGED/);
    expect(ragu.html).not.toMatch(/<script/);
    expect(r.state.sent).toEqual({ 'me@example.com': SAMPLE_TODAY, 'ragu@example.com': SAMPLE_TODAY });
  });

  test('each person is reminded again only after their own number of days', () => {
    const state = { sent: { 'me@example.com': '2026-11-21', 'ragu@example.com': '2026-11-21' } };
    expect(buildReminders(data, '2026-11-22', state).emails.map((e) => e.to[0])).toEqual(['ragu@example.com']);
    expect(buildReminders(data, '2026-11-24', state).emails.map((e) => e.to[0])).toEqual(['me@example.com', 'ragu@example.com']);
  });

  test('it stops by itself once the rent is logged and the item is done', () => {
    const done = {
      ...data,
      entries: [...data.entries, { id: 'nov', kind: 'rent', tenancyId: 'tn1', partyId: 't1', months: ['2026-11'], date: '2026-11-22', amount: 12000, expected: 12000 }],
      notes: data.notes.map((n) => ({ ...n, done: true })),
    };
    const r = buildReminders(done, '2026-11-25', {});
    expect(r.emails.map((e) => e.to[0])).toEqual(['me@example.com']); // still has other things needing attention
    expect(r.emails[0].text).not.toMatch(/RENT NOT LOGGED/);
    expect(r.skipped).toEqual([{ email: 'ragu@example.com', why: 'Nothing to tell them today.' }]);
  });

  test('no address means nothing is sent; the older plain list of addresses still works', () => {
    expect(buildReminders(sampleData(), SAMPLE_TODAY).note).toMatch(/No email address/);
    const old = reminderRecipients({ reminders: { emails: ['a@b.co'], rent: { on: true, everyDays: 2 }, questions: { on: true } } });
    expect(old).toEqual([{ email: 'a@b.co', person: '', rent: true, items: 'all', attention: false, everyDays: 2 }]);
  });
});
