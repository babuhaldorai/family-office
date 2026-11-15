// Works out today's reminder and sends it. Shared by the daily scheduled job
// and by the "send a test email" button.
const { serviceAccount, accessToken, firestore } = require('./google');
const { buildReminder } = require('../../src/v2/core/reminders');
const { todayIST } = require('../../src/v2/core/util');

async function sendEmail({ to, subject, text, html }) {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!key || !from) throw new Error(`${[!key && 'BREVO_API_KEY', !from && 'REMINDER_FROM_EMAIL'].filter(Boolean).join(' and ')} not set on the Netlify site, or the site was not redeployed after adding it.`);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': key.trim(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { email: from.trim(), name: process.env.REMINDER_FROM_NAME || 'Family Office' }, to: to.map((email) => ({ email })), subject, textContent: text, htmlContent: html }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const hint = res.status === 401 ? ' The Brevo key is wrong.' : /sender/i.test(j.message || '') ? ' The "from" address must be a sender you verified in Brevo.' : '';
    throw new Error(`The email service refused the message (${res.status}${j.message ? ': ' + j.message : ''}).${hint}`);
  }
}

// force: send now even if a reminder already went out within the chosen number of days
async function runReminders({ force = false, dryRun = false } = {}) {
  const sa = serviceAccount();
  const project = sa.project || process.env.REACT_APP_FIREBASE_PROJECT_ID;
  if (!project) throw new Error('The Firebase project id is not set on the site.');
  const db = firestore(project, await accessToken(sa));
  const [tenancies, people, properties, settings, notes, rent, advIn, advOut] = await Promise.all([
    db.list('fo_tenancies'), db.list('fo_people'), db.list('fo_properties'), db.list('fo_settings'), db.list('fo_notes'),
    db.where('fo_entries', 'kind', 'rent'), db.where('fo_entries', 'kind', 'tenant_advance'), db.where('fo_entries', 'kind', 'tenant_advance_return'),
  ]);
  const raw = { tenancies, people, properties, settings, notes, entries: [...rent, ...advIn, ...advOut] };
  const state = settings.find((s) => s.id === 'reminderState') || {};
  const today = todayIST();
  const r = buildReminder(raw, today, force ? {} : state, process.env.URL || '');
  if (r.skip) return { sent: false, why: r.skip };
  if (dryRun) return { sent: false, why: 'Check only: an email would be sent.', to: r.to, subject: r.subject };
  await sendEmail(r);
  await db.set('fo_settings', 'reminderState', { ...state, ...r.state, id: 'reminderState', lastSentAt: new Date().toISOString(), lastSubject: r.subject, lastTo: r.to.join(', ') });
  return { sent: true, to: r.to, subject: r.subject, counts: r.counts };
}

module.exports = { runReminders };
