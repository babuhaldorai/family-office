// Checks firestore.rules for each role against the local emulator.
// Needs: npm i firebase-tools @firebase/rules-unit-testing firebase, then from the repo root
//   firebase emulators:exec --only firestore --project demo-fo "node scripts/rules-emulator-test.js"
// with the Firestore emulator on port 8085.
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-fo', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const r of ['admin', 'manager', 'entry', 'viewer']) await setDoc(doc(db, 'users', r), { role: r, email: r + '@x.com' });
    await setDoc(doc(db, 'fo_entries', 'e1'), { amount: 10 });
    await setDoc(doc(db, 'fo_deliveries', 'd1'), { date: '2026-01-01' });
    await setDoc(doc(db, 'fo_history', 'h1'), { at: 'x' });
    await setDoc(doc(db, 'tea_harvest', 'old1'), { tNet: 1 });
  });
  const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
  let n = 0; const ok = async (p, m) => { await assertSucceeds(p); n++; console.log('allowed ', m); };
  const no = async (p, m) => { await assertFails(p); n++; console.log('refused ', m); };
  // strangers
  await no(getDoc(doc(db(null), 'fo_deliveries', 'd1')), 'not signed in: read harvest');
  await no(getDoc(doc(db('stranger'), 'fo_deliveries', 'd1')), 'signed in but not approved: read harvest');
  await no(setDoc(doc(db('stranger'), 'fo_deliveries', 'x'), { a: 1 }), 'signed in but not approved: write harvest');
  // viewer
  await ok(getDoc(doc(db('viewer'), 'fo_entries', 'e1')), 'viewer: read payment');
  await no(setDoc(doc(db('viewer'), 'fo_entries', 'x'), { a: 1 }), 'viewer: write payment');
  await no(setDoc(doc(db('viewer'), 'fo_deliveries', 'x'), { a: 1 }), 'viewer: write harvest');
  await no(setDoc(doc(db('viewer'), 'fo_history', 'x'), { a: 1 }), 'viewer: write history');
  // data entry
  await ok(getDoc(doc(db('entry'), 'fo_deliveries', 'd1')), 'data entry: read harvest');
  await ok(setDoc(doc(db('entry'), 'fo_deliveries', 'd2'), { date: '2026-01-02' }), 'data entry: add harvest');
  await ok(setDoc(doc(db('entry'), 'fo_work', 'w1'), { date: '2026-01-02' }), 'data entry: add field work');
  await ok(setDoc(doc(db('entry'), 'fo_notes', 'n1'), { text: 'x' }), 'data entry: add note');
  await no(getDoc(doc(db('entry'), 'fo_entries', 'e1')), 'data entry: read payment');
  await no(getDocs(collection(db('entry'), 'fo_entries')), 'data entry: list payments');
  await no(setDoc(doc(db('entry'), 'fo_entries', 'x'), { a: 1 }), 'data entry: write payment');
  await no(getDoc(doc(db('entry'), 'fo_tenancies', 't')), 'data entry: read tenancy');
  await no(getDoc(doc(db('entry'), 'fo_history', 'h1')), 'data entry: read history');
  await no(setDoc(doc(db('entry'), 'fo_people', 'p'), { a: 1 }), 'data entry: change a worker');
  await no(getDoc(doc(db('entry'), 'tea_harvest', 'old1')), 'data entry: read the old app');
  { const d = db('entry'); const b = writeBatch(d); b.set(doc(d, 'fo_deliveries', 'd3'), { a: 1 }); b.set(doc(d, 'fo_history', 'h3'), { a: 1 }); b.set(doc(d, 'fo_rain', '2026-01-02'), { mm: 1 });
    await ok(b.commit(), 'data entry: harvest + rain + history in one batch'); }
  { const d = db('entry'); const b = writeBatch(d); b.set(doc(d, 'fo_deliveries', 'd4'), { a: 1 }); b.set(doc(d, 'fo_entries', 'sneak'), { a: 1 });
    await no(b.commit(), 'data entry: batch that also writes a payment'); }
  // manager
  await ok(setDoc(doc(db('manager'), 'fo_entries', 'e2'), { amount: 5 }), 'manager: add payment');
  await ok(updateDoc(doc(db('manager'), 'fo_entries', 'e2'), { deleted: true }), 'manager: move payment to recycle bin');
  await no(deleteDoc(doc(db('manager'), 'fo_entries', 'e2')), 'manager: destroy payment');
  await ok(setDoc(doc(db('manager'), 'fo_settings', 'backup'), { at: 'x' }), 'manager: record a backup');
  await ok(getDoc(doc(db('manager'), 'tea_harvest', 'old1')), 'manager: read the old app');
  await no(setDoc(doc(db('manager'), 'tea_harvest', 'old1'), { tNet: 2 }), 'manager: change the old app');
  await no(setDoc(doc(db('manager'), 'users', 'viewer'), { role: 'admin' }), 'manager: change someone\'s access');
  await no(updateDoc(doc(db('manager'), 'users', 'manager'), { role: 'admin' }), 'manager: make self an owner');
  // AI settings: only the Owner decides; server-kept records cannot be written from a browser
  await ok(setDoc(doc(db('admin'), 'fo_settings', 'ai'), { enabled: true, users: ['admin'] }), 'owner: switch AI on and choose users');
  await no(setDoc(doc(db('manager'), 'fo_settings', 'ai'), { enabled: true, users: ['manager'] }), 'manager: give self AI access');
  await ok(getDoc(doc(db('manager'), 'fo_settings', 'ai')), 'manager: see whether AI is on');
  await no(setDoc(doc(db('manager'), 'fo_settings', 'aiUsage'), { count: 0 }), 'manager: reset the daily AI count');
  await no(setDoc(doc(db('admin'), 'fo_settings', 'aiUsage'), { count: 0 }), 'owner: reset the daily AI count from a browser');
  await no(setDoc(doc(db('admin'), 'fo_settings', 'aiLatest'), { text: 'x' }), 'owner: forge an AI summary');
  await no(setDoc(doc(db('manager'), 'fo_settings', 'reminderState'), { sent: {} }), 'manager: alter the reminder record');
  await ok(setDoc(doc(db('manager'), 'fo_settings', 'app'), { handlers: ['Me'] }), 'manager: ordinary settings');
  // history is append-only for everyone
  await ok(setDoc(doc(db('admin'), 'fo_history', 'h9'), { a: 1 }), 'owner: add history');
  await no(updateDoc(doc(db('admin'), 'fo_history', 'h1'), { at: 'y' }), 'owner: alter history');
  await no(deleteDoc(doc(db('admin'), 'fo_history', 'h1')), 'owner: delete history');
  // owner
  await ok(deleteDoc(doc(db('admin'), 'fo_entries', 'e2')), 'owner: destroy from the bin');
  await ok(setDoc(doc(db('admin'), 'users', 'viewer'), { role: 'manager' }, { merge: true }), 'owner: change access');
  await no(setDoc(doc(db('admin'), 'something_else', 'x'), { a: 1 }), 'owner: unknown collection');
  console.log(`RULES OK: ${n} checks`);
  await env.cleanup();
})().catch((e) => { console.log('FAILED', e.message); process.exit(1); });
