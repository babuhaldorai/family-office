import React, { useEffect, useMemo, useState } from 'react';
import { useData, ROLES, ROLE_LABEL } from '../data/DataContext';
import { Page, Card, Row, Tag, Field, Num, Text, Select, Btn, Check, Muted, Chips, Table, href, download, useForm } from '../ui/kit';
import { COLLECTIONS } from '../core/books';
import { makeBackup, validateBackup, planRestore, entriesCSV, deliveriesCSV } from '../core/backup';
import { mapOldData } from '../core/migrate';
import { usageOf } from '../data/actions';
import { findPlace } from '../data/weather';
import { inr, num, uid, fmtDate, addDays } from '../core/util';

const SECTIONS = [
  ['lists', 'Fields, workers and agents', 'Names, pay rates, field size and location', 'write'],
  ['users', 'Who can use the app', 'Owner, Manager, Data entry, Viewer', 'admin'],
  ['backup', 'Backup and restore', 'Automatic copies, restore, download everything', 'write'],
  ['checks', 'Totals check', 'Kg and money agree on every page', 'money'],
  ['history', 'History of changes', 'Who changed what, and the old value', 'money'],
  ['bin', 'Recycle bin', 'Deleted entries, kept for 90 days', 'write'],
  ['import', 'Bring in data from the old app', 'Copy the old records into the new screens', 'admin'],
  ['reminders', 'Reminders', 'What Home reminds you about', 'write'],
];
const NAMES = { people: 'person', fields: 'field', properties: 'property', tenancies: 'tenancy', deliveries: 'harvest', work: 'field work', stock: 'manure purchase', equipment: 'equipment', leases: 'lease', entries: 'payment', rain: 'rain record', notes: 'note', settings: 'setting' };

export default function Settings({ section, onLogout, onClassic }) {
  const { can, user, role, meta, books, demo } = useData();
  const Body = { lists: Lists, users: Users, backup: Backup, checks: Checks, history: History, bin: Bin, import: ImportOld, reminders: Reminders }[section];
  const allowed = (need) => can[need];
  if (Body) {
    const s = SECTIONS.find((x) => x[0] === section);
    return <Page title={s[1]} backTo="/settings">{allowed(s[3]) ? <Body /> : <Card><Muted>This is not available for your access level.</Muted></Card>}</Page>;
  }
  return (
    <Page title="Settings" backTo="/">
      <Card>
        {SECTIONS.filter((s) => allowed(s[3])).map(([key, title, sub]) => (
          <Row key={key} top to={href('/settings/' + key)} left={<strong>{title}</strong>} sub={sub}
            right={key === 'checks' ? <Tag kind={books.ok ? 'g' : 'r'}>{books.ok ? 'All agree' : 'Needs a look'}</Tag> : <span className="v2-muted">Open</span>} />
        ))}
      </Card>
      <Card title="This device">
        <Row left="Signed in as" right={demo ? 'Sample data' : user?.email || ''} />
        <Row left="Access" right={ROLE_LABEL[role] || role} />
        <Row left="Entries waiting to sync" right={<Tag kind={meta.pending ? '' : 'g'}>{meta.pending || 0}</Tag>} />
        {onClassic && <button type="button" className="v2-link" onClick={onClassic}>Open the old app (to compare figures)</button>}
        {onLogout && <Btn kind="sec" onClick={onLogout}>Sign out</Btn>}
      </Card>
    </Page>
  );
}

// ── Lists ───────────────────────────────────────────────────────────────────
function Lists() {
  const { books, can, run } = useData();
  const [kind, setKind] = useState('worker');
  const [editing, setEditing] = useState(null);
  const [handlers, setHandlers] = useState(books.handlers.join(', '));
  const people = books.people.filter((p) => p.kind === kind);
  if (editing && editing.col === 'people') return <PersonForm kind={kind} id={editing.id} onDone={() => setEditing(null)} />;
  if (editing && editing.col === 'fields') return <FieldForm id={editing.id} onDone={() => setEditing(null)} />;
  return (
    <>
      <Chips label="List" options={[['worker', 'Workers'], ['agent', 'Agents'], ['vendor', 'Shops'], ['field', 'Fields'], ['handler', 'Who handles money']]} value={kind} onChange={setKind} />
      {kind !== 'field' && kind !== 'handler' && (
        <Card title="Tap a name to change it">
          {people.length === 0 && <Muted>None yet.</Muted>}
          {people.map((p) => (
            <Row key={p.id} top onClick={can.write ? () => setEditing({ col: 'people', id: p.id }) : undefined} left={<strong>{p.name}</strong>}
              sub={[p.kind === 'worker' ? (p.payBasis === 'day' ? `Daily wage ${p.dayRate ? inr(p.dayRate) : ''}` : `₹${p.kgRate ?? 6} per kg`) : '', p.phone].filter(Boolean).join(' · ')}
              right={p.active === false ? <Tag kind="n">Not active</Tag> : null} />
          ))}
          {can.write && <Btn kind="sec" onClick={() => setEditing({ col: 'people', id: null })}>+ Add</Btn>}
        </Card>
      )}
      {kind === 'field' && (
        <Card title="Tap a field to change it">
          {books.fields.length === 0 && <Muted>None yet.</Muted>}
          {books.fields.map((f) => <Row key={f.id} top onClick={can.write ? () => setEditing({ col: 'fields', id: f.id }) : undefined} left={<strong>{f.name}</strong>} sub={`${f.acres || '?'} acres · ${f.place || (f.lat != null && f.lat !== '' ? 'location set' : 'no location, so no automatic rain')}`} />)}
          {can.write && <Btn kind="sec" onClick={() => setEditing({ col: 'fields', id: null })}>+ Add a field</Btn>}
        </Card>
      )}
      {kind === 'handler' && (
        <Card title="People who pay or receive money">
          <Field label="Names, separated by commas" hint="These are the choices under “Who handled it?” on every payment."><Text value={handlers} onChange={setHandlers} disabled={!can.write} /></Field>
          {can.write && <Btn kind="sec" onClick={() => { const list = handlers.split(',').map((s) => s.trim()).filter(Boolean); if (!list.length) return run({ error: 'Enter at least one name.' }); return run({ ops: [{ col: 'settings', id: 'app', data: { ...books.settings, id: 'app', handlers: list } }] }, 'Saved'); }}>Save</Btn>}
        </Card>
      )}
    </>
  );
}

function PersonForm({ kind, id, onDone }) {
  const { books, run } = useData();
  const p = id ? books.personById.get(id) : null;
  const [f, set] = useForm(() => p ? { ...p, kgRate: String(p.kgRate ?? 6), dayRate: String(p.dayRate || ''), advanceStep: String(p.advanceStep || '') } : { kind, name: '', phone: '', payBasis: 'kg', kgRate: '6', dayRate: '', advanceStep: '', active: true });
  const used = p ? usageOf('people', p.id, books) : 0;
  const save = () => {
    if (!f.name.trim()) return run({ error: 'Enter the name.' });
    if (books.people.some((x) => x.kind === kind && x.id !== id && x.name.trim().toLowerCase() === f.name.trim().toLowerCase())) return run({ error: 'There is already someone with that name.' });
    const doc = { ...f, id: id || uid(), name: f.name.trim(), kgRate: num(f.kgRate), dayRate: num(f.dayRate) || '', advanceStep: num(f.advanceStep) || '', active: f.active !== false };
    if (run({ ops: [{ col: 'people', id: doc.id, data: doc }] }, 'Saved')) onDone();
    return null;
  };
  return (
    <>
      <Card title={p ? 'Change' : 'Add'} hi>
        <div className="v2-cols"><Field label="Name"><Text value={f.name} onChange={(v) => set('name', v)} /></Field><Field label="Phone"><Text value={f.phone} onChange={(v) => set('phone', v)} inputMode="tel" /></Field></div>
        {kind === 'worker' && (<>
          <div className="v2-flab">Usually paid</div>
          <Chips label="Usually paid" options={[['kg', 'Per kg picked'], ['day', 'Daily wage']]} value={f.payBasis || 'kg'} onChange={(v) => set('payBasis', v)} />
          <div className="v2-cols">
            {f.payBasis !== 'day' && <Field label="₹ per kg (on net kg)"><Num value={f.kgRate} onChange={(v) => set('kgRate', v)} /></Field>}
            {f.payBasis === 'day' && <Field label="₹ per day"><Num value={f.dayRate} onChange={(v) => set('dayRate', v)} /></Field>}
            <Field label="Advance to take back from each payment (₹)"><Num value={f.advanceStep} onChange={(v) => set('advanceStep', v)} placeholder="0" /></Field>
          </div>
          <Muted>A new rate applies to harvests saved from now on. Past harvests keep the rate they were saved with.</Muted>
        </>)}
        <Check checked={f.active !== false} onChange={(v) => set('active', v)}>Active (shown in the lists when entering)</Check>
      </Card>
      <div className="v2-cols"><Btn onClick={save}>Save</Btn><Btn kind="sec" onClick={onDone}>Cancel</Btn></div>
      {p && (used > 0
        ? <Muted>{p.name} is used in {used} records, so cannot be deleted. Untick “Active” instead.</Muted>
        : <Btn kind="danger" onClick={() => { if (window.confirm('Move to the recycle bin?') && run({ ops: [{ col: 'people', id: p.id, remove: true }] }, 'Moved to the recycle bin')) onDone(); }}>Delete</Btn>)}
    </>
  );
}

function FieldForm({ id, onDone }) {
  const { books, run } = useData();
  const x = id ? books.fieldById.get(id) : null;
  const [f, set] = useForm(() => x ? { ...x, acres: String(x.acres || '') } : { name: '', acres: '', place: '', lat: '', lon: '' });
  const [q, setQ] = useState(x?.place || '');
  const [found, setFound] = useState(null);
  const used = x ? usageOf('fields', x.id, books) : 0;
  const search = async () => {
    setFound('…');
    try { setFound(await findPlace(q)); } catch (e) { setFound([]); }
  };
  const save = () => {
    if (!f.name.trim()) return run({ error: 'Enter the name of the field.' });
    const doc = { ...f, id: id || uid(), name: f.name.trim(), acres: num(f.acres) || '' };
    if (run({ ops: [{ col: 'fields', id: doc.id, data: doc }] }, 'Saved')) onDone();
    return null;
  };
  return (
    <>
      <Card title={x ? 'Change field' : 'Add a field'} hi>
        <div className="v2-cols"><Field label="Name"><Text value={f.name} onChange={(v) => set('name', v)} /></Field><Field label="Size in acres"><Num value={f.acres} onChange={(v) => set('acres', v)} /></Field></div>
      </Card>
      <Card title="Location, for automatic rain">
        <Muted>{f.lat !== '' && f.lat != null ? `Set to ${f.place || 'a location'} (${Number(f.lat).toFixed(2)}, ${Number(f.lon).toFixed(2)}).` : 'Not set. Search for the nearest village or town.'}</Muted>
        <div style={{ display: 'flex', gap: 8 }}><Text value={q} onChange={setQ} placeholder="Village or town" aria-label="Village or town" onKeyDown={(e) => { if (e.key === 'Enter') search(); }} /><Btn kind="sec" onClick={search}>Search</Btn></div>
        {found === '…' && <Muted>Searching…</Muted>}
        {Array.isArray(found) && found.length === 0 && <Muted>Nothing found. Try a bigger town nearby, or check the connection.</Muted>}
        {Array.isArray(found) && found.map((r, i) => <Row key={i} onClick={() => { set('place', r.label); set('lat', r.lat); set('lon', r.lon); setFound(null); }} left={r.label} right={<Tag kind="g">Use</Tag>} />)}
      </Card>
      <div className="v2-cols"><Btn onClick={save}>Save</Btn><Btn kind="sec" onClick={onDone}>Cancel</Btn></div>
      {x && (used > 0
        ? <Muted>{x.name} has {used} harvests, work records or leases, so it cannot be deleted.</Muted>
        : <Btn kind="danger" onClick={() => { if (window.confirm('Move to the recycle bin?') && run({ ops: [{ col: 'fields', id: x.id, remove: true }] }, 'Moved to the recycle bin')) onDone(); }}>Delete</Btn>)}
    </>
  );
}

// ── Users ───────────────────────────────────────────────────────────────────
function Users() {
  const { store, user, say } = useData();
  const [data, setData] = useState(null);
  const load = () => store.listUsers().then(setData).catch((e) => { setData({ users: [], pending: [] }); say('Could not read the list of users: ' + (e.code || e.message), true); });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Card><Muted>Loading…</Muted></Card>;
  const setRole = async (u, role) => { await store.setUser(u.id, { role }); say('Access changed'); load(); };
  const approve = async (p, role) => {
    await store.setUser(p.id, { email: p.email || '', displayName: p.displayName || p.email || '', role, createdAt: new Date().toISOString(), addedBy: user?.email || '' });
    await store.removePending(p.id); say('Access given'); load();
  };
  const owners = data.users.filter((u) => u.role === 'admin').length;
  return (
    <>
      <Card title="Waiting for access">
        {data.pending.length === 0 && <Muted>Nobody is waiting. To add someone, ask them to open the app and sign in with Google once; they will then appear here for you to approve.</Muted>}
        {data.pending.map((p) => (
          <div key={p.id} className="v2-line" style={{ padding: '8px 0' }}>
            <strong>{p.displayName || p.email}</strong><Muted>{p.email} · tried {fmtDate(String(p.attemptedAt || '').slice(0, 10))}</Muted>
            <div className="v2-chips" style={{ marginTop: 6 }}>
              {ROLES.map(([k, l]) => <button key={k} type="button" className="v2-chip sm" onClick={() => approve(p, k)}>Allow as {l}</button>)}
              <button type="button" className="v2-chip sm" onClick={async () => { await store.removePending(p.id); load(); }}>Refuse</button>
            </div>
          </div>
        ))}
      </Card>
      <Card title="People with access">
        {data.users.map((u) => (
          <div key={u.id} className="v2-row top">
            <span><strong>{u.displayName || u.email}</strong><div className="v2-muted">{u.email}</div></span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none' }}>
              <span style={{ width: 130 }}><Select aria-label={'Access for ' + (u.displayName || u.email)} value={u.role || 'viewer'} disabled={u.role === 'admin' && owners <= 1} onChange={(v) => setRole(u, v)} options={ROLES.map(([k, l]) => [k, l])} /></span>
              {u.id !== user?.uid && <button type="button" className="v2-x" aria-label={'Remove ' + (u.displayName || u.email)} onClick={async () => { if (window.confirm(`Remove ${u.displayName || u.email}? They will no longer be able to open the app.`)) { await store.removeUser(u.id); load(); } }}>×</button>}
            </span>
          </div>
        ))}
      </Card>
      <Card title="What each level can do">
        {ROLES.map(([k, l, d]) => <Row key={k} top left={<strong>{l}</strong>} sub={d} />)}
        <Muted>The limits are enforced in the database, not only hidden on screen. Data entry is the exception to know about: the database lets that level read harvest and people records, which it needs to log a harvest.</Muted>
      </Card>
    </>
  );
}

// ── Backup and restore ──────────────────────────────────────────────────────
function Backup() {
  const { raw, books, store, user, today, can, say, demo } = useData();
  const marker = (raw.settings || []).find((s) => s.id === 'backup');
  const [busy, setBusy] = useState('');
  const [bucketList, setBucketList] = useState(null);
  const [plan, setPlan] = useState(null);
  const svc = () => import('../data/backupService');
  const by = user?.email || 'unknown';

  const backupNow = async () => {
    setBusy('Backing up…');
    try {
      if (demo) { download(`family-office-${today}.json`, JSON.stringify(makeBackup(raw, { by })), 'application/json'); say('Downloaded to this device'); return; }
      const { runBackup } = await svc();
      const res = await runBackup(raw, { by, today });
      store.commit([{ col: 'settings', id: 'backup', data: res.marker }], { keepHistory: false, why: 'backup' });
      say(res.marker.bucket === 'ok' || res.marker.github === 'ok' ? 'Backup made' : 'Backup could not be stored online. Download a copy to this device.', !(res.marker.bucket === 'ok' || res.marker.github === 'ok'));
    } catch (e) { say('Backup failed: ' + (e.message || e), true); } finally { setBusy(''); }
  };
  const toDevice = () => download(`family-office-${today}.json`, JSON.stringify(makeBackup(raw, { by })), 'application/json');
  const preview = (backup, label) => {
    const err = validateBackup(backup);
    if (err) return say(err, true);
    return setPlan({ label, backup, plan: planRestore(raw, backup, today), only: null });
  };
  const fromFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { preview(JSON.parse(r.result), file.name); } catch (e) { say('This file could not be read as a backup.', true); } };
    r.readAsText(file);
  };
  const loadBucket = async () => { setBusy('Looking…'); try { const { listBucketBackups } = await svc(); setBucketList(await listBucketBackups()); } catch (e) { say('Could not list the online backups: ' + (e.code || e.message), true); setBucketList([]); } finally { setBusy(''); } };
  const fromBucket = async (name) => { setBusy('Reading…'); try { const { readBucketBackup } = await svc(); preview(await readBucketBackup(name), name); } catch (e) { say('Could not read that backup: ' + (e.code || e.message), true); } finally { setBusy(''); } };
  const setOnly = (c, on) => setPlan((p) => { const cur = p.only || COLLECTIONS.filter((x) => p.plan.perCollection.some((r) => r.col === x)); const only = on ? [...cur, c] : cur.filter((x) => x !== c); return { ...p, only, plan: planRestore(raw, p.backup, today, { only }) }; });
  const restore = async () => {
    if (!window.confirm(`Restore from ${plan.label}?\n\n${plan.plan.totalChanges} records will change. A copy of the data as it is now is downloaded to this device first.`)) return;
    toDevice();
    try { if (!demo) { const { runBackup } = await svc(); await runBackup(raw, { by, today, prefix: 'pre-restore' }); } } catch (e) { /* the device copy above is the safety net */ }
    store.commit(plan.plan.ops.map(({ why, ...op }) => op), { keepHistory: false, why: `restore from ${plan.label}` });
    say('Restored. Check the totals below.');
    setPlan(null);
  };
  const status = (v) => (v === 'ok' ? <Tag kind="g">Saved</Tag> : v ? <Tag kind="r">Failed</Tag> : <Tag kind="n">Not yet</Tag>);

  if (plan) {
    const p = plan.plan;
    const picked = plan.only || p.perCollection.map((r) => r.col);
    return (
      <>
        <Card title={`What restoring ${plan.label} would do`} hi>
          <Muted>Made {fmtDate(String(plan.backup.exportedAt).slice(0, 10))} by {plan.backup.exportedBy || 'unknown'}. Untick a line to leave that part as it is now.</Muted>
          <Table head={['', 'Part', { label: 'Put back', r: 1 }, { label: 'Changed back', r: 1 }, { label: 'Moved to bin', r: 1 }, { label: 'Same', r: 1 }]}
            rows={COLLECTIONS.map((c) => { const r = p.perCollection.find((x) => x.col === c); return { key: c, cells: [<input type="checkbox" aria-label={'Restore ' + NAMES[c]} checked={picked.includes(c)} onChange={(e) => setOnly(c, e.target.checked)} />, NAMES[c], r ? r.add : '', r ? r.change : '', r ? r.remove : '', r ? r.same : ''] }; })} />
          <Row left="Net kg, now → after" right={`${p.before.netKg.toFixed(1)} → ${p.after.netKg.toFixed(1)}`} />
          <Row left="Money in, now → after" right={`${inr(p.before.moneyIn)} → ${inr(p.after.moneyIn)}`} />
          <Row left="Money out, now → after" right={`${inr(p.before.moneyOut)} → ${inr(p.after.moneyOut)}`} />
          <Row left="Totals check after restoring" right={<Tag kind={p.after.checksOk ? 'g' : 'r'}>{p.after.checksOk ? 'All agree' : 'Would not agree'}</Tag>} />
          {!p.after.checksOk && <Muted>Would fail: {p.after.failing.join('; ')}. This usually means only part of the backup is ticked.</Muted>}
          <Muted>Records made after the backup are moved to the recycle bin, not destroyed.</Muted>
        </Card>
        <div className="v2-cols">{can.admin && <Btn onClick={restore} disabled={!p.totalChanges}>{p.totalChanges ? `Restore ${p.totalChanges} records` : 'Nothing to restore'}</Btn>}<Btn kind="sec" onClick={() => setPlan(null)}>Cancel</Btn></div>
        {!can.admin && <Muted>Only the Owner can restore.</Muted>}
      </>
    );
  }
  return (
    <>
      <Card title="Automatic backup">
        <Row top left={<strong>Last backup</strong>} sub={marker ? `By ${marker.by || 'unknown'} · ${Math.round((marker.size || 0) / 1024)} KB` : 'None yet'} right={marker ? fmtDate(marker.date) : <Tag>Never</Tag>} />
        <Row left="Firebase storage bucket" right={status(marker?.bucket)} />
        {marker && marker.bucket && marker.bucket !== 'ok' && <Muted>Bucket: {marker.bucket}</Muted>}
        <Row left="Private GitHub repository" right={status(marker?.github)} />
        {marker && marker.github && marker.github !== 'ok' && <Muted>GitHub: {marker.github}</Muted>}
        <Muted>A backup is made automatically when an Owner or Manager opens the app and something has changed since the last one. On days with no change, nothing is saved.</Muted>
        <div className="v2-cols"><Btn onClick={backupNow} disabled={!!busy}>{busy || 'Back up now'}</Btn><Btn kind="sec" onClick={toDevice}>Download a copy to this device</Btn></div>
      </Card>
      <Card title="Restore">
        <Muted>Choose a backup, look at what it would change, then decide. Nothing changes until you confirm.</Muted>
        {!demo && <Btn kind="sec" onClick={loadBucket} disabled={!!busy}>Show online backups</Btn>}
        {bucketList && bucketList.length === 0 && <Muted>No online backups found.</Muted>}
        {bucketList && bucketList.slice(0, 40).map((n) => <Row key={n} onClick={() => fromBucket(n)} left={n} right={<Tag kind="g">Look</Tag>} />)}
        <Field label="Or restore from a file on this device"><input className="v2-inp" type="file" accept="application/json,.json" onChange={(e) => fromFile(e.target.files[0])} /></Field>
      </Card>
      <Card title="Download for Excel">
        <div className="v2-cols">
          <Btn kind="sec" onClick={() => download(`all-payments-${today}.csv`, entriesCSV(books, books.entries))}>Every payment</Btn>
          <Btn kind="sec" onClick={() => download(`all-harvests-${today}.csv`, deliveriesCSV(books, books.deliveries))}>Every harvest</Btn>
        </div>
      </Card>
    </>
  );
}

// ── Totals check ────────────────────────────────────────────────────────────
function Checks() {
  const { books } = useData();
  return (
    <>
      <Card title="Run after every change" right={<Tag kind={books.ok ? 'g' : 'r'}>{books.ok ? 'All agree' : 'Needs a look'}</Tag>}>
        {books.checks.map((c) => <Row key={c.name} top left={c.name} sub={c.ok ? undefined : c.detail} right={<Tag kind={c.ok ? 'g' : 'r'}>{c.ok ? 'OK' : 'Check'}</Tag>} />)}
      </Card>
      <Card title="How the app keeps figures in step">
        <Muted>Each harvest and payment is stored once. Every total on every page is worked out from those records by the same calculation, so two pages cannot show different answers. This list is that calculation checking itself.</Muted>
        <Row left="Harvests" right={books.deliveries.length} /><Row left="Payments" right={books.entries.length} /><Row left="Net kg, all time" right={books.totals.netKg.toFixed(1)} />
      </Card>
    </>
  );
}

// ── History ─────────────────────────────────────────────────────────────────
const brief = (col, d) => {
  if (!d) return '';
  if (col === 'entries') return `${d.kind} ${d.date || ''} ${inr(d.amount)}`;
  if (col === 'deliveries') return `harvest ${d.date || ''} ${(d.bags || []).reduce((s, b) => s + num(b.kg), 0)} kg`;
  return d.name || d.text || d.date || d.id;
};
function changed(before, after) {
  if (!before || !after) return [];
  const skip = new Set(['updatedAt', 'updatedBy', 'createdAt', 'id']);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !skip.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => `${k}: ${JSON.stringify(before[k] ?? null)} → ${JSON.stringify(after[k] ?? null)}`);
}
function History() {
  const { store, can, run, say } = useData();
  const [rows, setRows] = useState(null);
  useEffect(() => { store.loadHistory().then(setRows).catch((e) => { setRows([]); say('Could not read the history: ' + (e.code || e.message), true); }); }, [store, say]);
  if (!rows) return <Card><Muted>Loading…</Muted></Card>;
  const ACTION = { create: 'Added', update: 'Changed', delete: 'Deleted', restore: 'Brought back', purge: 'Destroyed' };
  return (
    <Card title="Latest 300 changes, newest first">
      {rows.length === 0 && <Muted>No changes recorded yet.</Muted>}
      {rows.map((h) => (
        <div key={h.id} className="v2-line" style={{ padding: '8px 0' }}>
          <div className="v2-row top" style={{ minHeight: 0 }}>
            <span><strong>{ACTION[h.action] || h.action}</strong> {h.col === '*' ? `${h.count} records (${h.why})` : `${NAMES[h.col] || h.col}: ${brief(h.col, h.after || h.before)}`}<div className="v2-muted">{String(h.at).slice(0, 16).replace('T', ' ')} UTC · {h.by}</div></span>
            {can.write && h.action === 'update' && h.before && <button type="button" className="v2-link" onClick={() => { if (window.confirm('Put this record back to how it was before this change?')) run({ ops: [{ col: h.col, id: h.docId, data: h.before }] }, 'Put back'); }}>Undo</button>}
          </div>
          {h.action === 'update' && changed(h.before, h.after).slice(0, 6).map((line, i) => <div key={i} className="v2-muted" style={{ wordBreak: 'break-word' }}>{line}</div>)}
        </div>
      ))}
    </Card>
  );
}

// ── Recycle bin ─────────────────────────────────────────────────────────────
function Bin() {
  const { raw, today, can, run } = useData();
  const items = useMemo(() => COLLECTIONS.flatMap((c) => (raw[c] || []).filter((d) => d.deleted).map((d) => ({ col: c, d }))).sort((a, b) => String(b.d.deletedAt).localeCompare(String(a.d.deletedAt))), [raw]);
  const old = items.filter((x) => String(x.d.deletedAt || '').slice(0, 10) < addDays(today, -90));
  return (
    <>
      <Card title="Deleted records">
        {items.length === 0 && <Muted>The recycle bin is empty.</Muted>}
        {items.map(({ col, d }) => (
          <div key={col + d.id} className="v2-row top">
            <span><strong>{NAMES[col]}</strong>: {brief(col, d)}<div className="v2-muted">Deleted {fmtDate(String(d.deletedAt || '').slice(0, 10))} by {d.deletedBy || 'unknown'}</div></span>
            <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
              <Tag kind="g" onClick={() => run({ ops: [{ col, id: d.id, restore: true }] }, 'Brought back')}>Bring back</Tag>
              {can.admin && <Tag kind="r" onClick={() => { if (window.confirm('Destroy this record for good? This cannot be undone.')) run({ ops: [{ col, id: d.id, purge: true }] }, 'Destroyed'); }}>Destroy</Tag>}
            </span>
          </div>
        ))}
      </Card>
      {can.admin && old.length > 0 && <Btn kind="danger" onClick={() => { if (window.confirm(`Destroy ${old.length} records deleted more than 90 days ago? This cannot be undone.`)) run({ ops: old.map(({ col, d }) => ({ col, id: d.id, purge: true })) }, 'Destroyed'); }}>Empty records older than 90 days ({old.length})</Btn>}
      <Muted>Bringing back a payment or harvest also brings back its effect on every total. After bringing something back, look at Settings → Totals check.</Muted>
    </>
  );
}

// ── Import from the old app ─────────────────────────────────────────────────
function ImportOld() {
  const { raw, store, today, say, demo } = useData();
  const [state, setState] = useState({ step: 'start' });
  const read = async () => {
    setState({ step: 'reading' });
    try {
      const old = await store.loadOld();
      const errors = old._errors || [];
      const total = Object.keys(old).filter((k) => k !== '_errors').reduce((s, k) => s + old[k].length, 0);
      if (!total) return setState({ step: 'start', note: errors.length ? `Could not read the old records: ${errors[0]}` : 'No records were found in the old app.' });
      const res = mapOldData(old, today);
      const existing = COLLECTIONS.reduce((s, c) => s + (raw[c] || []).filter((d) => d.imported).length, 0);
      return setState({ step: 'preview', res, total, errors, existing });
    } catch (e) { return setState({ step: 'start', note: 'Could not read the old records: ' + (e.code || e.message) }); }
  };
  const apply = () => {
    const { res } = state;
    const ops = [];
    COLLECTIONS.forEach((c) => res.data[c].forEach((d) => {
      const now = (raw[c] || []).find((x) => x.id === d.id);
      // never overwrite something already changed in the new app
      if (now && (now.imported !== true || now.deleted)) return;
      ops.push({ col: c, id: d.id, data: d, importing: true });
    }));
    if (!window.confirm(`Copy ${ops.length} records into the new app?\n\nThe old app's records are not changed.`)) return;
    store.commit(ops, { keepHistory: false, why: 'import from the old app' });
    say(`${ops.length} records copied`);
    setState({ step: 'done', count: ops.length });
  };
  if (demo) return <Card><Muted>This is sample data, so there is no old app to import from.</Muted></Card>;
  if (state.step === 'preview') {
    const { res } = state;
    return (
      <>
        <Card title="Old totals against the copy" right={<Tag kind={res.report.ok ? 'g' : 'r'}>{res.report.ok ? 'All match' : 'Some differ'}</Tag>} hi>
          <Table head={['Figure', { label: 'Old app', r: 1 }, { label: 'New app', r: 1 }, '']}
            rows={res.report.rows.map((r) => ({ key: r.label, cells: [r.label, r.unit === '₹' ? inr(r.old) : `${r.old.toLocaleString('en-IN')} ${r.unit}`, r.unit === '₹' ? inr(r.new) : `${r.new.toLocaleString('en-IN')} ${r.unit}`, <Tag kind={r.ok ? 'g' : 'r'}>{r.ok ? 'Same' : 'Differs'}</Tag>] }))} />
          <Muted>{state.total} old records read. Nothing has been copied yet.</Muted>
        </Card>
        <Card title="What will be created">
          {Object.entries(res.report.counts).map(([c, n]) => <Row key={c} left={NAMES[c]} right={n} />)}
        </Card>
        <Card title="Things to know">
          {[...res.report.warnings, ...state.errors.map((e) => 'Could not read ' + e)].map((w, i) => <Muted key={i}>• {w}</Muted>)}
          {res.report.checks.filter((c) => !c.ok).map((c) => <Muted key={c.name}>• Totals check that will need a look afterwards: {c.name} ({c.detail})</Muted>)}
          {state.existing > 0 && <Muted>• {state.existing} records were imported before. Running it again refreshes them from the old app, except any you have since changed in the new app.</Muted>}
        </Card>
        <div className="v2-cols"><Btn onClick={apply}>Copy into the new app</Btn><Btn kind="sec" onClick={() => setState({ step: 'start' })}>Cancel</Btn></div>
      </>
    );
  }
  return (
    <>
      <Card title="Copy the old app's records">
        <Muted>This reads everything from the old app (harvests, payments, advances, maintenance, inventory, leases, rentals, home expenses), shows the old totals next to what the new app makes of them, and copies only when you confirm. The old records are never changed, so the old app keeps working and can be compared at any time.</Muted>
        {state.note && <div className="v2-tag r" style={{ whiteSpace: 'normal' }}>{state.note}</div>}
        {state.step === 'done' && <div className="v2-tag g" style={{ whiteSpace: 'normal' }}>{state.count} records copied. Open Totals check, then compare a few figures with the old app.</div>}
        <Btn onClick={read} disabled={state.step === 'reading'}>{state.step === 'reading' ? 'Reading the old app…' : 'Read the old app and compare'}</Btn>
        {state.step === 'done' && <a className="v2-btn sec" href={href('/settings/checks')}>Open Totals check</a>}
      </Card>
    </>
  );
}

// ── Reminders ───────────────────────────────────────────────────────────────
function Reminders() {
  const { books, run } = useData();
  const s = books.settings;
  const save = (patch) => run({ ops: [{ col: 'settings', id: 'app', data: { ...s, id: 'app', handlers: books.handlers, ...patch } }] }, 'Saved');
  return (
    <>
      <Card title="On the Home screen">
        <Check checked={s.remindHarvest !== false} onChange={(v) => save({ remindHarvest: v })}>Remind me when no harvest was entered for one of the last 3 days</Check>
        <Muted>Rent not received, agents who have not paid, wages due, unpaid bills and leases ending within 30 days always show under “Needs attention”.</Muted>
      </Card>
      <Card title="By email">
        <Muted>Email reminders are not switched on yet. They need a mail-sending account and a scheduled server job, which are the next piece to set up. Until then, reminders appear on Home only.</Muted>
      </Card>
    </>
  );
}
