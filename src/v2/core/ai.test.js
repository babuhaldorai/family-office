import { aiAccess, aiPrompt, AI_DAILY_LIMIT } from './ai';
import { buildBooks } from './books';
import { sampleData, SAMPLE_TODAY } from './sample';
import { makeBackup, planRestore } from './backup';

describe('AI summaries', () => {
  const on = { enabled: true, users: ['u1', 'u2'] };
  test('off means off for everyone, including the owner', () => {
    expect(aiAccess({ enabled: false, users: ['owner'] }, null, 'owner', '2026-11-15').ok).toBe(false);
    expect(aiAccess(null, null, 'owner', '2026-11-15').why).toMatch(/switched off/);
  });
  test('on means only the people the owner chose', () => {
    expect(aiAccess(on, null, 'u1', '2026-11-15')).toEqual({ ok: true, left: AI_DAILY_LIMIT, used: 0 });
    expect(aiAccess(on, null, 'u3', '2026-11-15').why).toMatch(/not switched on for you/);
  });
  test('two a day for everyone together, starting again the next day', () => {
    expect(aiAccess(on, { date: '2026-11-15', count: 1 }, 'u1', '2026-11-15').left).toBe(1);
    expect(aiAccess(on, { date: '2026-11-15', count: 2 }, 'u2', '2026-11-15').ok).toBe(false);
    expect(aiAccess(on, { date: '2026-11-15', count: 2 }, 'u2', '2026-11-16').left).toBe(2);
  });
  test('what is sent to the model has figures but no names of people', () => {
    const p = aiPrompt(buildBooks(sampleData(), SAMPLE_TODAY));
    expect(p).toMatch(/TEA FIELDS/);
    expect(p).not.toMatch(/QUESTIONS/);
    ['Lakshmi', 'Selvi', 'Murugan', 'Anand', 'Priya', 'Kumar'].forEach((n) => expect(p.includes(n)).toBe(false));
  });
  test('a restore never writes the AI settings or the server-kept records', () => {
    const data = sampleData();
    const staging = { ...data, settings: [...data.settings, { id: 'ai', enabled: true, users: ['stagingUser'] }, { id: 'aiUsage', date: 'x', count: 2 }, { id: 'aiLatest', text: 'old' }, { id: 'reminderState', sent: {} }] };
    const plan = planRestore({}, makeBackup(staging), SAMPLE_TODAY);
    const ids = plan.ops.filter((o) => o.col === 'settings').map((o) => o.id);
    expect(ids).toEqual(['app']);
  });
});
