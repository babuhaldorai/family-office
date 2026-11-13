/**
 * @jest-environment node
 */
// Runs the cloud store against the local Firestore emulator, with the real
// security rules, signed in as an Owner. Skipped unless FIRESTORE_EMU=1:
//   firebase emulators:exec --only firestore "FIRESTORE_EMU=1 CI=true npx react-scripts test --watchAll=false emu"
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore';

const on = process.env.FIRESTORE_EMU === '1';
const PROJECT = 'demo-fo';
const HOST = '127.0.0.1';
const PORT = 8085;

jest.mock('../../firebase', () => {
  const holder = {};
  return { get db() { return holder.db; }, __set: (d) => { holder.db = d; } };
});

// the emulator accepts "Bearer owner" as an administrator, which bypasses the rules for seeding
const seedUser = (uid, role) => new Promise((resolve, reject) => {
  const body = JSON.stringify({ fields: { role: { stringValue: role } } });
  const req = require('http').request({
    host: HOST, port: PORT, method: 'PATCH', path: `/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`,
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => { res.resume(); res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error('seed ' + res.statusCode)))); });
  req.on('error', reject); req.end(body);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(on ? describe : describe.skip)('cloud store on the emulator', () => {
  let db, store, state, meta, stop;
  beforeAll(async () => {
    await seedUser('owner1', 'admin');
    db = getFirestore(initializeApp({ projectId: PROJECT, apiKey: 'x' }, 'emu-' + Date.now()));
    connectFirestoreEmulator(db, HOST, PORT, { mockUserToken: { user_id: 'owner1' } });
    require('../../firebase').__set(db);
    const { createFirestoreStore } = require('./firestoreStore');
    store = createFirestoreStore({ by: 'owner@x.com', onError: (e) => { throw e; } });
    stop = store.subscribe((s, m) => { state = s; meta = m; });
    for (let i = 0; i < 50 && !(meta && meta.loaded); i++) await wait(100);
  }, 30000);
  afterAll(async () => { if (stop) stop(); if (db) await terminate(db); });

  const find = (col, id) => state[col].find((d) => d.id === id);

  test('loads every collection with no permission failures', () => {
    expect(meta.loaded).toBe(true);
    expect(meta.failed).toEqual([]);
  });

  test('save, change, recycle bin, bring back, destroy — with history at each step', async () => {
    await store.commit([{ col: 'entries', id: 't1', data: { id: 't1', kind: 'misc', amount: 100, date: '2026-01-01', note: undefined, nested: { a: undefined, b: 1 } } }]);
    await wait(200);
    expect(find('entries', 't1')).toMatchObject({ amount: 100, updatedBy: 'owner@x.com', nested: { b: 1 } });
    expect(find('entries', 't1').createdAt).toBeTruthy();
    const created = find('entries', 't1').createdAt;

    await store.commit([{ col: 'entries', id: 't1', patch: { amount: 150 } }]);
    await wait(200);
    expect(find('entries', 't1')).toMatchObject({ amount: 150, kind: 'misc', createdAt: created });

    await store.commit([{ col: 'entries', id: 't1', remove: true }]);
    await wait(200);
    expect(find('entries', 't1')).toMatchObject({ deleted: true, amount: 150, deletedBy: 'owner@x.com' });

    await store.commit([{ col: 'entries', id: 't1', restore: true }]);
    await wait(200);
    expect(find('entries', 't1').deleted).toBeUndefined();
    expect(find('entries', 't1').amount).toBe(150);

    await store.commit([{ col: 'entries', id: 't1', purge: true }]);
    await wait(200);
    expect(find('entries', 't1')).toBeUndefined();

    const h = (await store.loadHistory()).filter((x) => x.docId === 't1');
    expect(h.map((x) => x.action)).toEqual(['purge', 'restore', 'delete', 'update', 'create']);
    const upd = h.find((x) => x.action === 'update');
    expect(upd.before.amount).toBe(100);
    expect(upd.after.amount).toBe(150);
  }, 30000);

  test('a payment and the rate it sets are saved together or not at all', async () => {
    await store.commit([{ col: 'deliveries', id: 'dA', data: { id: 'dA', date: '2026-01-02', rate: null } }]);
    await store.commit([
      { col: 'entries', id: 'sale1', data: { id: 'sale1', kind: 'tea_sale', amount: 10, date: '2026-01-05', deliveryIds: ['dA'], rate: 24 } },
      { col: 'deliveries', id: 'dA', patch: { rate: 24, rateBy: 'sale1' } },
    ]);
    await wait(200);
    expect(find('deliveries', 'dA')).toMatchObject({ rate: 24, rateBy: 'sale1', date: '2026-01-02' });
    expect(find('entries', 'sale1').rate).toBe(24);
  }, 30000);

  test('a large import (more than one batch) all arrives, with one history line', async () => {
    const ops = Array.from({ length: 450 }, (_, i) => ({ col: 'rain', id: `2025-${String(i).padStart(4, '0')}`, data: { id: `2025-${String(i).padStart(4, '0')}`, mm: i, imported: true }, importing: true }));
    await store.commit(ops, { keepHistory: false, why: 'import test' });
    for (let i = 0; i < 50 && state.rain.length < 450; i++) await wait(100);
    expect(state.rain.length).toBe(450);
    expect(state.rain.every((d) => d.imported === true)).toBe(true);
    const h = await store.loadHistory();
    expect(h.filter((x) => x.col === '*' && x.why === 'import test')).toHaveLength(1);
    // editing an imported record marks it so a later import will not overwrite it
    await store.commit([{ col: 'rain', id: '2025-0001', patch: { mm: 99 } }]);
    await wait(200);
    expect(find('rain', '2025-0001')).toMatchObject({ mm: 99, imported: false, wasImported: true });
  }, 60000);
});
