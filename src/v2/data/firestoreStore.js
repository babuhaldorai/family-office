// The cloud store. Every collection is listened to live, so a change made on
// one phone appears on the others. Writes are queued by Firestore when there
// is no signal and sent when it returns.
import {
  collection, doc, onSnapshot, writeBatch, getDocs, query, orderBy, limit, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLECTIONS } from '../core/books';
import { OLD_COLLECTIONS } from '../core/migrate';
import { uid } from '../core/util';
import { applyOp, forCloud } from './ops';

export const PREFIX = 'fo_';
const HISTORY = PREFIX + 'history';
const plain = (data) => {
  const out = { ...data };
  Object.keys(out).forEach((k) => { if (out[k] && typeof out[k].toDate === 'function') out[k] = out[k].toDate().toISOString(); });
  return out;
};

export function createFirestoreStore({ by, onError }) {
  const state = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  const loaded = new Set();
  const failed = new Map();
  const pendingBy = new Map();
  const listeners = new Set();
  const meta = () => ({
    loaded: loaded.size + failed.size >= COLLECTIONS.length,
    pending: [...pendingBy.values()].reduce((s, n) => s + n, 0),
    failed: [...failed.entries()],
  });
  const emit = () => listeners.forEach((cb) => cb({ ...state }, meta()));
  let unsubs = null;
  const start = () => {
    unsubs = COLLECTIONS.map((c) => onSnapshot(
      collection(db, PREFIX + c), { includeMetadataChanges: true },
      (snap) => {
        state[c] = snap.docs.map((d) => ({ ...plain(d.data()), id: d.id }));
        pendingBy.set(c, snap.docs.filter((d) => d.metadata.hasPendingWrites).length);
        loaded.add(c); failed.delete(c);
        emit();
      },
      (err) => { failed.set(c, err.code || err.message); emit(); if (onError) onError(err, c); },
    ));
  };

  return {
    kind: 'cloud',
    subscribe(cb) {
      listeners.add(cb);
      if (!unsubs) start(); else cb({ ...state }, meta());
      return () => { listeners.delete(cb); if (!listeners.size && unsubs) { unsubs.forEach((u) => u()); unsubs = null; loaded.clear(); } };
    },
    // Not awaited by the screens: offline, the promise only settles once the
    // phone is back online, but the change is already visible locally.
    commit(ops, { why = '', keepHistory = true } = {}) {
      const at = new Date().toISOString();
      const chunks = [];
      for (let i = 0; i < ops.length; i += 200) chunks.push(ops.slice(i, i + 200));
      const jobs = chunks.map((chunk) => {
        const batch = writeBatch(db);
        chunk.forEach((op) => {
          const before = state[op.col].find((d) => d.id === op.id) || null;
          const { after, action } = applyOp(op, before, { by, at });
          const ref = doc(db, PREFIX + op.col, op.id);
          if (action === 'purge') batch.delete(ref); else batch.set(ref, forCloud(after));
          if (keepHistory) {
            batch.set(doc(db, HISTORY, uid()), forCloud({
              col: op.col, docId: op.id, action, before, after: action === 'purge' ? null : after, by, at, why: op.why || why,
            }));
          }
        });
        return batch.commit();
      });
      if (!keepHistory) jobs.push(setDoc(doc(db, HISTORY, uid()), { col: '*', docId: '', action: why || 'bulk', count: ops.length, by, at, why }));
      const all = Promise.all(jobs);
      all.catch((err) => { if (onError) onError(err, 'save'); });
      return all;
    },
    async loadHistory(max = 300) {
      const snap = await getDocs(query(collection(db, HISTORY), orderBy('at', 'desc'), limit(max)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    // The old app's collections, read once, never written.
    async loadOld() {
      const out = {};
      const errors = [];
      await Promise.all(OLD_COLLECTIONS.map(async (c) => {
        try { const snap = await getDocs(collection(db, c)); out[c] = snap.docs.map((d) => ({ ...plain(d.data()), id: d.id })); }
        catch (e) { out[c] = []; errors.push(`${c}: ${e.code || e.message}`); }
      }));
      out._errors = errors;
      return out;
    },
    async listUsers() {
      const [u, p] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'pending_logins')).catch(() => ({ docs: [] }))]);
      return { users: u.docs.map((d) => ({ id: d.id, ...d.data() })), pending: p.docs.map((d) => ({ id: d.id, ...d.data() })) };
    },
    async setUser(id, data) { await setDoc(doc(db, 'users', id), data, { merge: true }); },
    async removeUser(id) { await deleteDoc(doc(db, 'users', id)); },
    async removePending(id) { await deleteDoc(doc(db, 'pending_logins', id)); },
  };
}
