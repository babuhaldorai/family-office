// Writes an AI summary of the business. Runs as a background job (it can take
// a minute), so the screen does not wait on this request: the result is saved
// to the database and appears on the screen when ready.
//
// Who may run it is decided here, not in the browser:
//   - the Owner must have switched AI on (fo_settings/ai, which only the Owner can change)
//   - the caller must be on the Owner's list
//   - at most AI_DAILY_LIMIT summaries a day for everyone together
// The model is given a summary built here from the database (never text sent
// by the browser), with no names of workers, tenants or agents.
//
// Netlify environment variables: ANTHROPIC_API_KEY, and the Firebase service
// account used by reminders. AI_MODEL is optional (defaults to claude-opus-5-5).
const sdk = require('@anthropic-ai/sdk');
const { serviceAccount, accessToken, firestore, loadAll } = require('../lib/google');
const { buildBooks, COLLECTIONS } = require('../../src/v2/core/books');
const { aiAccess, aiPrompt, AI_SYSTEM, AI_DAILY_LIMIT } = require('../../src/v2/core/ai');
const { todayIST } = require('../../src/v2/core/util');

const Anthropic = sdk.default || sdk;

function uidFromToken(token) {
  try { const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); return p.user_id || p.sub || null; } catch (e) { return null; }
}

async function run(event) {
  const project = process.env.REACT_APP_FIREBASE_PROJECT_ID;
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const uid = idToken ? uidFromToken(idToken) : null;
  if (!project || !uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return;
  let requestId = '';
  try { requestId = String(JSON.parse(event.body || '{}').requestId || '').slice(0, 40); } catch (e) { /* ignore */ }
  if (!/^[a-z0-9]{6,40}$/.test(requestId)) return;

  // Who is calling? Firestore checks the token and only returns the caller's own record.
  const who = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}`, { headers: { Authorization: 'Bearer ' + idToken } });
  if (!who.ok) return;
  const me = await who.json();
  const role = me.fields && me.fields.role ? me.fields.role.stringValue : '';
  const name = (me.fields && ((me.fields.displayName && me.fields.displayName.stringValue) || (me.fields.email && me.fields.email.stringValue))) || 'someone';
  if (!['admin', 'manager', 'viewer'].includes(role)) return; // Data entry does not see money

  const sa = serviceAccount();
  const db = firestore(sa.project || project, await accessToken(sa));
  const raw = await loadAll(db, COLLECTIONS);
  const today = todayIST();
  const doc = (id) => raw.settings.find((s) => s.id === id) || null;
  const report = (patch) => db.set('fo_settings', 'aiLatest', { id: 'aiLatest', requestId, by: name, at: new Date().toISOString(), date: today, ...patch });

  const access = aiAccess(doc('ai'), doc('aiUsage'), uid, today);
  if (!access.ok) { await report({ status: 'error', error: access.why }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { await report({ status: 'error', error: 'ANTHROPIC_API_KEY is not set on the Netlify site, or the site was not redeployed after adding it.' }); return; }

  // count it before asking, so two people pressing at once cannot both get the last one
  const used = access.used + 1;
  await db.set('fo_settings', 'aiUsage', { id: 'aiUsage', date: today, count: used, lastBy: name, lastAt: new Date().toISOString() });
  const giveBack = () => db.set('fo_settings', 'aiUsage', { id: 'aiUsage', date: today, count: used - 1 });
  await report({ status: 'working' });

  const books = buildBooks(raw, today);
  if (!books.deliveries.length && !books.entries.length) { await giveBack(); await report({ status: 'error', error: 'There is nothing entered yet for a summary to be about.' }); return; }
  const model = process.env.AI_MODEL || 'claude-opus-5-5';
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model,
      max_tokens: 6000,
      // if the model declines a request, the API retries it on a fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: AI_SYSTEM,
      messages: [{ role: 'user', content: aiPrompt(books) }],
    });
    if (response.stop_reason === 'refusal') { await giveBack(); await report({ status: 'error', error: 'The AI service declined to write this summary.' }); return; }
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) { await giveBack(); await report({ status: 'error', error: 'The AI service returned nothing. Try again.' }); return; }
    await report({
      status: 'done', text, model: response.model || model, cutOff: response.stop_reason === 'max_tokens',
      tokensIn: response.usage ? response.usage.input_tokens : null, tokensOut: response.usage ? response.usage.output_tokens : null,
      usedToday: used, limit: AI_DAILY_LIMIT,
    });
  } catch (error) {
    await giveBack();
    let why = 'The AI service could not be reached. Try again later.';
    if (error instanceof Anthropic.AuthenticationError) why = 'The ANTHROPIC_API_KEY on the site is not valid.';
    else if (error instanceof Anthropic.PermissionDeniedError) why = 'The AI account is not allowed to use this model, or has no credit.';
    else if (error instanceof Anthropic.RateLimitError) why = 'The AI service is busy or the account limit is reached. Try again in a few minutes.';
    else if (error instanceof Anthropic.BadRequestError) why = 'The AI service did not accept the request: ' + String(error.message).slice(0, 200);
    else if (error instanceof Anthropic.APIError) why = `The AI service failed (${error.status}). Try again later.`;
    await report({ status: 'error', error: why });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };
  try { await run(event); } catch (e) { console.error('ai summary failed:', e.message); }
  return { statusCode: 202, body: '' };
};
exports.run = run;
