// What the daily reminder email should say, worked out from the same books
// the app uses. Pure: data in, email text out. The sending is done elsewhere.
import { buildBooks } from './books';
import { daysBetween, fmtDate, fmtMonth, inr, sum } from './util';

export const REMINDER_DEFAULTS = { emails: [], rent: { on: true, everyDays: 1 }, questions: { on: true } };
export const reminderSettings = (settings) => {
  const r = (settings && settings.reminders) || {};
  return {
    emails: (r.emails || []).map((e) => String(e).trim()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
    rent: { ...REMINDER_DEFAULTS.rent, ...(r.rent || {}) },
    questions: { ...REMINDER_DEFAULTS.questions, ...(r.questions || {}) },
  };
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Returns null when there is nothing to send today.
//   state.rentLast: the India date the rent reminder last went out
export function buildReminder(raw, today, state = {}, siteUrl = '') {
  const settings = (raw.settings || []).find((s) => s.id === 'app') || {};
  const cfg = reminderSettings(settings);
  if (!cfg.emails.length) return { skip: 'No email address is set under Settings → Reminders.' };
  const books = buildBooks(raw, today);

  const rent = books.tenancies.filter((t) => t.isActive && t.unpaidMonths.length).map((t) => ({
    property: t.propertyName, tenant: t.tenantName, months: t.unpaidMonths.map((m) => fmtMonth(m.mk)),
    amount: t.balance, since: t.unpaidMonths[0].dueDate,
  }));
  const everyDays = Math.max(1, Number(cfg.rent.everyDays) || 1);
  const rentDue = cfg.rent.on && rent.length > 0 && (!state.rentLast || daysBetween(state.rentLast, today) >= everyDays);

  const questions = cfg.questions.on ? books.notes.filter((n) => n.kind === 'todo' && !n.done && n.assignee) : [];
  // open questions ride along with a rent reminder; on their own they go out once a week
  const questionsDue = questions.length > 0 && (rentDue || !state.questionsLast || daysBetween(state.questionsLast, today) >= 7);
  if (!rentDue && !questionsDue) {
    return { skip: rent.length || questions.length ? 'Nothing is due to be sent today (already reminded within the chosen number of days).' : 'No rent is unpaid and no questions are open.' };
  }

  const lines = [];
  const html = [];
  if (rentDue) {
    lines.push('RENT NOT LOGGED YET', '');
    html.push('<h3 style="margin:0 0 8px">Rent not logged yet</h3><ul style="margin:0 0 16px;padding-left:20px">');
    rent.forEach((r) => {
      const line = `${r.property} (${r.tenant}): ${r.months.join(', ')} — ${inr(r.amount)}, due since ${fmtDate(r.since)}`;
      lines.push('- ' + line);
      html.push(`<li>${esc(line)}</li>`);
    });
    html.push('</ul>');
    lines.push('', `Total: ${inr(sum(rent, (r) => r.amount))}`, 'Once the rent is recorded in the app, these reminders stop on their own.', '');
    html.push(`<p><strong>Total: ${esc(inr(sum(rent, (r) => r.amount)))}</strong><br>Once the rent is recorded in the app, these reminders stop on their own.</p>`);
  }
  if (questionsDue) {
    lines.push('QUESTIONS WAITING FOR AN ANSWER', '');
    html.push('<h3 style="margin:16px 0 8px">Questions waiting for an answer</h3><ul style="margin:0 0 16px;padding-left:20px">');
    questions.forEach((n) => {
      const line = `For ${n.assignee}: ${n.text}${n.about ? ` (${n.about})` : ''}${n.by ? ` — asked by ${n.by}` : ''}`;
      lines.push('- ' + line);
      html.push(`<li>${esc(line)}</li>`);
    });
    html.push('</ul>');
    lines.push('');
  }
  if (siteUrl) { lines.push(`Open the app: ${siteUrl}`); html.push(`<p><a href="${esc(siteUrl)}">Open the app</a></p>`); }
  const subject = rentDue
    ? `Rent not logged: ${rent.map((r) => r.property).join(', ')} (${inr(sum(rent, (r) => r.amount))})`
    : `${questions.length} question${questions.length === 1 ? '' : 's'} waiting in Family Office`;
  return {
    to: cfg.emails, subject, text: lines.join('\n'), html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1A211C">${html.join('')}</div>`,
    state: { ...state, ...(rentDue ? { rentLast: today } : {}), ...(questionsDue ? { questionsLast: today } : {}) },
    counts: { rent: rentDue ? rent.length : 0, questions: questionsDue ? questions.length : 0 },
  };
}
