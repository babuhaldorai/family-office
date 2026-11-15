// What the daily reminder emails should say, worked out from the same books
// the app uses. Pure: data in, emails out. The sending is done elsewhere.
//
// Each person on the list gets ONE email with everything for them: rent not
// logged, action items addressed to them, and (if chosen) the other things
// that need attention.
import { buildBooks } from './books';
import { daysBetween, fmtDate, fmtMonth, inr, sum } from './util';

const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());
export const blankRecipient = (email) => ({ email, person: '', rent: true, items: 'mine', attention: false, everyDays: 1 });

// The saved list, including the older shape (a plain list of addresses).
export function reminderRecipients(settings) {
  const r = (settings && settings.reminders) || {};
  let list = Array.isArray(r.recipients) ? r.recipients : null;
  if (!list) {
    list = (r.emails || []).map((email) => ({
      ...blankRecipient(email), rent: !r.rent || r.rent.on !== false, items: r.questions && r.questions.on === false ? 'none' : 'all',
      everyDays: (r.rent && r.rent.everyDays) || 1,
    }));
  }
  return list.filter((x) => x && isEmail(x.email)).map((x) => ({ ...blankRecipient(x.email.trim()), ...x, email: x.email.trim(), everyDays: Math.max(1, Number(x.everyDays) || 1) }));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// state.sent: { [email]: the India date that person was last emailed }
export function buildReminders(raw, today, state = {}, siteUrl = '') {
  const settings = (raw.settings || []).find((s) => s.id === 'app') || {};
  const recipients = reminderRecipients(settings);
  if (!recipients.length) return { emails: [], skipped: [], state, note: 'No email address is set under Settings → Reminders.' };
  const books = buildBooks(raw, today);

  const rent = books.tenancies.filter((t) => t.isActive && t.unpaidMonths.length).map((t) => ({
    property: t.propertyName, tenant: t.tenantName, months: t.unpaidMonths.map((m) => fmtMonth(m.mk)), amount: t.balance, since: t.unpaidMonths[0].dueDate,
  }));
  const todos = books.notes.filter((n) => n.kind === 'todo' && !n.done).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const other = books.attention.filter((a) => a.type !== 'tenancy');

  const sent = { ...(state.sent || {}) };
  const emails = [];
  const skipped = [];
  recipients.forEach((r) => {
    const mine = r.items === 'none' ? [] : todos.filter((n) => (r.items === 'all' ? true : !n.assignee || (r.person && n.assignee === r.person)));
    const sections = [];
    if (r.rent && rent.length) {
      sections.push({
        title: 'Rent not logged yet',
        lines: rent.map((x) => `${x.property} (${x.tenant}): ${x.months.join(', ')} — ${inr(x.amount)}, due since ${fmtDate(x.since)}`),
        foot: `Total ${inr(sum(rent, (x) => x.amount))}. These reminders stop on their own once the rent is recorded in the app.`,
      });
    }
    if (mine.length) {
      sections.push({
        title: r.items === 'all' ? 'Action items' : `Action items for ${r.person || 'you'}`,
        lines: mine.map((n) => `${n.assignee && r.items === 'all' ? `For ${n.assignee}: ` : ''}${n.text}${n.about ? ` (${n.about})` : ''}${n.by ? ` — from ${n.by}` : ''}, ${fmtDate(n.date)}`),
        foot: 'Mark an item done in the app and it stops appearing here.',
      });
    }
    if (r.attention && other.length) {
      sections.push({
        title: 'Also needs attention',
        lines: other.map((a) => `${a.title}: ${a.sub}${a.amount != null ? ` — ${inr(a.amount)}` : ''}`),
      });
    }
    if (!sections.length) { skipped.push({ email: r.email, why: 'Nothing to tell them today.' }); return; }
    const last = sent[r.email];
    if (last && daysBetween(last, today) < r.everyDays) { skipped.push({ email: r.email, why: `Already emailed on ${fmtDate(last)}; next one is due ${r.everyDays} day${r.everyDays === 1 ? '' : 's'} after that.` }); return; }

    const text = [];
    const html = [];
    sections.forEach((s) => {
      text.push(s.title.toUpperCase(), '', ...s.lines.map((l) => '- ' + l), '');
      html.push(`<h3 style="margin:16px 0 8px">${esc(s.title)}</h3><ul style="margin:0 0 8px;padding-left:20px">${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`);
      if (s.foot) { text.push(s.foot, ''); html.push(`<p style="margin:0 0 8px;color:#55605A">${esc(s.foot)}</p>`); }
    });
    if (siteUrl) { text.push(`Open the app: ${siteUrl}`); html.push(`<p><a href="${esc(siteUrl)}">Open the app</a></p>`); }
    const hasRent = r.rent && rent.length > 0;
    const count = sections.reduce((n, s) => n + s.lines.length, 0);
    emails.push({
      to: [r.email],
      subject: hasRent ? `Rent not logged: ${rent.map((x) => x.property).join(', ')} (${inr(sum(rent, (x) => x.amount))})${count > rent.length ? ` and ${count - rent.length} more` : ''}`
        : `${count} thing${count === 1 ? '' : 's'} to do in Family Office`,
      text: text.join('\n'),
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1A211C">${html.join('')}</div>`,
      counts: { rent: hasRent ? rent.length : 0, items: mine.length, attention: r.attention ? other.length : 0 },
    });
    sent[r.email] = today;
  });
  return { emails, skipped, state: { ...state, sent } };
}
