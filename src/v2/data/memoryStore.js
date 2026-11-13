// An in-memory store with the same behaviour as the cloud one. Used for the
// "sample data" mode and for tests: nothing is saved anywhere.
import { COLLECTIONS } from '../core/books';
import { applyOp } from './ops';

export function createMemoryStore(initial = {}, { by = 'demo' } = {}) {
  const state = Object.fromEntries(COLLECTIONS.map((c) => [c, (initial[c] || []).map((d) => ({ ...d }))]));
  const history = [];
  const listeners = new Set();
  const emit = () => listeners.forEach((cb) => cb({ ...state }, { loaded: true, pending: 0 }));
  return {
    kind: 'memory',
    subscribe(cb) { listeners.add(cb); cb({ ...state }, { loaded: true, pending: 0 }); return () => listeners.delete(cb); },
    async commit(ops, { why = '', keepHistory = true } = {}) {
      const at = new Date().toISOString();
      ops.forEach((op) => {
        const list = state[op.col];
        const i = list.findIndex((d) => d.id === op.id);
        const before = i >= 0 ? list[i] : null;
        const { after, action } = applyOp(op, before, { by, at });
        if (action === 'purge') { if (i >= 0) list.splice(i, 1); }
        else if (i >= 0) list[i] = after; else list.push(after);
        state[op.col] = [...list];
        if (keepHistory) history.unshift({ id: 'h' + history.length, col: op.col, docId: op.id, action, before, after: action === 'purge' ? null : after, by, at, why: op.why || why });
      });
      if (!keepHistory) history.unshift({ id: 'h' + history.length, col: '*', docId: '', action: why || 'bulk', count: ops.length, by, at, why });
      emit();
    },
    async loadHistory() { return history.slice(0, 300); },
    async loadOld() { return {}; },
    async listUsers() { return { users: [{ id: 'demo', email: 'you@example.com', displayName: 'You', role: 'admin' }], pending: [] }; },
    async setUser() {}, async removeUser() {}, async removePending() {},
  };
}
