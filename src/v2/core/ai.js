// The AI summary: who may ask for one, how many a day, and what the model is
// asked. Pure functions shared by the screen and the server job. The server
// decides; the screen only mirrors the decision so it can explain it.
import { summaryForAI } from './planner';

export const AI_DAILY_LIMIT = 2;

// config: the fo_settings/ai record, which only the Owner can change
// usage:  the fo_settings/aiUsage record, which only the server changes
export function aiAccess(config, usage, uid, today) {
  if (!config || !config.enabled) return { ok: false, why: 'AI summaries are switched off. The Owner can switch them on in Settings → AI summaries.' };
  if (!uid || !(config.users || []).includes(uid)) return { ok: false, why: 'AI summaries are not switched on for you. The Owner chooses who can use them in Settings → AI summaries.' };
  const used = usage && usage.date === today ? Number(usage.count) || 0 : 0;
  const left = Math.max(0, AI_DAILY_LIMIT - used);
  if (!left) return { ok: false, left: 0, used, why: `Today's ${AI_DAILY_LIMIT} AI summaries have been used. The count resets at midnight India time.` };
  return { ok: true, left, used };
}

export const AI_SYSTEM = `You advise the owner of a small family business in India: a few tea fields whose leaf is hand-picked and sold to agents, some rental properties, and their own homes. You are given a summary of their own records. The owner is not an accountant and reads on a phone.

Write a short report in plain language with exactly these headings, each on its own line:
What is going well
What needs attention
Where money is being lost
Ideas to consider
Decisions to double-check
This week

Rules:
- Use the actual figures given, in rupees and kg. Do not invent numbers, prices or facts that are not in the summary.
- Be specific to this business. No general business advice.
- Under each heading give 2 to 4 short points, most important first. "This week" is at most 3 concrete actions.
- If the records are too thin to judge something, say so in one line rather than guessing.
- On fertilizer: you may say what their own history suggests and what to ask an adviser, but say clearly that the right type and dose needs a soil test. Do not prescribe a product or dose.
- Plain text only. Start each point with "- ". No tables, no bold, no preamble, no closing remarks.`;

export const aiPrompt = (books) => summaryForAI(books).split('\nQUESTIONS\n')[0].trim();
