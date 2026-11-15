import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { buildBooks } from '../core/books';
import { todayIST } from '../core/util';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

export const ROLES = [
  ['admin', 'Owner', 'Everything, including users, backup and restore'],
  ['manager', 'Manager', 'Enter and change all records and payments'],
  ['entry', 'Data entry', 'Log harvests, field work and notes. Cannot see money totals'],
  ['viewer', 'Viewer', 'Look only'],
];
export const ROLE_LABEL = Object.fromEntries(ROLES.map(([k, l]) => [k, l]));

export function DataProvider({ store, user, role, demo, fixedToday, children }) {
  const [raw, setRaw] = useState(null);
  const [meta, setMeta] = useState({ loaded: false, pending: 0, failed: [] });
  const [today, setToday] = useState(fixedToday || todayIST());
  const [toast, setToast] = useState(null);

  useEffect(() => store.subscribe((s, m) => { setRaw(s); setMeta(m); }), [store]);
  useEffect(() => {
    if (fixedToday) return undefined;
    const t = setInterval(() => setToday(todayIST()), 60000);
    return () => clearInterval(t);
  }, [fixedToday]);
  const say = useCallback((text, err = false) => setToast({ text, err, k: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.err ? 9000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const on = (e) => say(`Could not save: ${e.detail?.code || e.detail?.message || 'unknown error'}. Check your access and try again.`, true);
    window.addEventListener('v2-error', on);
    return () => window.removeEventListener('v2-error', on);
  }, [say]);

  const books = useMemo(() => (raw ? buildBooks(raw, today) : null), [raw, today]);
  const can = useMemo(() => ({
    write: role === 'admin' || role === 'manager',
    harvest: role === 'admin' || role === 'manager' || role === 'entry',
    money: role !== 'entry',
    admin: role === 'admin',
  }), [role]);

  // Save the result of an action: shows the problem if there is one, otherwise
  // saves all its changes together.
  const run = useCallback((res, okText, opts) => {
    if (!res) return false;
    if (res.error) { say(res.error, true); return false; }
    if (res.ops && res.ops.length) store.commit(res.ops, opts);
    if (okText) say(okText);
    return true;
  }, [store, say]);

  const value = useMemo(() => ({ raw, books, meta, today, user, role, can, demo, store, run, say }),
    [raw, books, meta, today, user, role, can, demo, store, run, say]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && <button type="button" key={toast.k} className={'v2-toast' + (toast.err ? ' err' : '')} role={toast.err ? 'alert' : 'status'} onClick={() => setToast(null)}>{toast.text}</button>}
    </Ctx.Provider>
  );
}
