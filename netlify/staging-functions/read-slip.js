// Reads a photo of a hand-written harvest slip and returns the numbers on it.
//
// The slip is columns of bag weights with a total, a deduction, a net figure
// and often "net x rate = amount" under each column. The function only
// transcribes; the app shows the result next to the photo for the person to
// check before anything is saved.
//
// Netlify environment variables:
//   ANTHROPIC_API_KEY              required
//   SLIP_MODEL                     optional, defaults to claude-opus-5-5
//   REACT_APP_FIREBASE_PROJECT_ID  already set for the site build
const sdk = require('@anthropic-ai/sdk');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const Anthropic = sdk.default || sdk;
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const Slip = z.object({
  readable: z.boolean().describe('false if this is not a harvest slip or the numbers cannot be read'),
  date: z.string().describe('The date written on the slip as YYYY-MM-DD, or an empty string if there is none. Slips are written day/month/year.'),
  columns: z.array(z.object({
    heading: z.string().describe('The heading written above the column, exactly as written (may be Tamil), or an empty string'),
    weights: z.array(z.number()).describe('Each bag weight in the column, top to bottom, above the first ruled line'),
    writtenTotal: z.number().nullable().describe('The total written under the weights, or null'),
    deduction: z.number().nullable().describe('The number subtracted from the total, or null'),
    writtenNet: z.number().nullable().describe('The net weight written after the deduction, or null'),
    ratePerKg: z.number().nullable().describe('The multiplier written next to the net weight (rupees per kg), or null'),
    writtenAmount: z.number().nullable().describe('The final rupee amount written for the column, or null'),
  })),
  notes: z.string().describe('Anything uncertain: digits that could be read two ways, crossed-out figures, sums that do not add up. Empty string if nothing.'),
});

const PROMPT = `This is a photo of a hand-written slip from a tea plantation in India recording leaf harvested on one day.

Typical layout: a date at the top (day/month/year), then one or more columns. Each column may have a heading (a person or place, often in Tamil), then a list of bag weights in kg, a ruled line, the total, a smaller number that is deducted from the total (for the bags or for water), the net weight, and sometimes "net x rate" with the rupee amount underneath.

Transcribe what is written. Do not correct the arithmetic: if a written total does not match the weights, report both as written and mention it in notes. If a digit could be read two ways, give your best reading and say so in notes. If the photo is not such a slip or cannot be read, set readable to false.`;

function uidFromToken(token) {
  try { const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); return p.user_id || p.sub || null; } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const project = process.env.REACT_APP_FIREBASE_PROJECT_ID;
  if (!process.env.ANTHROPIC_API_KEY) return json(501, { error: 'Reading slips is not set up yet (ANTHROPIC_API_KEY is missing on the site).' });
  if (!project) return json(500, { error: 'The Firebase project id is not set on the site.' });

  // only people who may log a harvest
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const uid = idToken ? uidFromToken(idToken) : null;
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return json(401, { error: 'Not signed in.' });
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}`, { headers: { Authorization: 'Bearer ' + idToken } });
    if (!res.ok) return json(403, { error: 'Your sign-in could not be confirmed.' });
    const doc = await res.json();
    const role = doc.fields && doc.fields.role ? doc.fields.role.stringValue : null;
    if (!['admin', 'manager', 'entry'].includes(role)) return json(403, { error: 'Your access level cannot log harvests.' });
  } catch (e) { return json(502, { error: 'Could not confirm who is signed in.' }); }

  let image, mediaType;
  try { ({ image, mediaType } = JSON.parse(event.body || '{}')); } catch (e) { return json(400, { error: 'Bad request.' }); }
  if (typeof image !== 'string' || image.length < 1000 || image.length > 5 * 1024 * 1024) return json(400, { error: 'The photo is missing or too large.' });
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) return json(400, { error: 'The photo must be a JPEG, PNG or WebP.' });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: process.env.SLIP_MODEL || 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low', format: zodOutputFormat(Slip) },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
    if (response.stop_reason === 'refusal') return json(422, { error: 'The photo could not be processed.' });
    if (!response.parsed_output) return json(502, { error: 'The slip could not be read. Try a sharper photo.' });
    return json(200, { slip: response.parsed_output });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json(502, { error: 'The ANTHROPIC_API_KEY on the site is not valid.' });
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: 'Too many photos at once. Try again in a minute.' });
    if (error instanceof Anthropic.BadRequestError) return json(400, { error: 'The photo was not accepted: ' + String(error.message).slice(0, 160) });
    if (error instanceof Anthropic.APIError) return json(502, { error: `Reading failed (${error.status}).` });
    return json(502, { error: 'Reading failed. Check the connection and try again.' });
  }
};
