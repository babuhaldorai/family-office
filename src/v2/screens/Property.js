import React, { useMemo, useState } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Money, Field, Num, Text, DateField, Btn, Muted, Check, href, useForm } from '../ui/kit';
import { usePeriod, PeriodPicker } from '../ui/Period';
import { removeWithPayments, usageOf } from '../data/actions';
import { useDelete } from '../data/useDelete';
import { inr, num, sum, fmtDate, fmtMonth, inRange, uid, daysBetween, periodFor } from '../core/util';

const MONTH_TAG = { paid: ['g', 'Paid'], late: ['g', 'Paid late'], part: ['', 'Part paid'], due: ['', 'Not yet'], notyet: ['n', 'Not due'] };

export function Properties({ kind }) {
  const { books, today, can, run } = useData();
  const [name, setName] = useState('');
  const list = books.properties.filter((p) => p.kind === kind);
  const year = periodFor('year', today);
  const add = () => {
    if (!name.trim()) return;
    run({ ops: [{ col: 'properties', id: uid(), data: { kind, name: name.trim() } }] }, 'Added');
    setName('');
  };
  return (
    <Page title={kind === 'rental' ? 'Rentals' : 'Homes'} sub={kind === 'rental' ? 'Properties you rent out' : 'Your own houses and what you spend on them'}>
      <div className="v2-two">
        {list.map((p) => {
          const t = books.tenancies.find((x) => x.propertyId === p.id && x.isActive);
          const spent = sum(books.entries.filter((e) => e.propertyId === p.id && e.dir === 'out' && e.meta.pnl === 'expense' && inRange(e.date, year)), (e) => e.amount);
          return (
            <Card key={p.id} title={p.name} right={kind === 'rental' ? (t ? (t.unpaidMonths.length ? <Tag>{inr(t.balance)} due</Tag> : <Tag kind="g">Rent up to date</Tag>) : <Tag kind="n">No tenant</Tag>) : null}>
              {kind === 'rental' && t && <Row left={`${t.tenantName} · ${inr(t.currentRent)} a month`} right={t.end ? `until ${fmtDate(t.end)}` : ''} />}
              <Row left={`Spent this year (${year.label})`} right={<Money v={spent} />} />
              <a className="v2-btn sec" href={href('/property/' + p.id)}>Open</a>
            </Card>
          );
        })}
      </div>
      {list.length === 0 && <Card><Muted>Nothing here yet.</Muted></Card>}
      {can.write && (
        <Card title={kind === 'rental' ? 'Add a rental property' : 'Add a home'}>
          <div style={{ display: 'flex', gap: 8 }}><Text value={name} onChange={setName} placeholder={kind === 'rental' ? 'Shop 2, House 1…' : 'Family home…'} aria-label="Name" /><Btn kind="sec" onClick={add}>Add</Btn></div>
        </Card>
      )}
    </Page>
  );
}

export function Property({ id }) {
  const { books, today, can, run } = useData();
  const del = useDelete();
  const p = books.propertyById.get(id);
  const ps = usePeriod(today, 'year');
  const [allMonths, setAllMonths] = useState(false);
  const [editing, setEditing] = useState(null);
  const tenancies = books.tenancies.filter((t) => t.propertyId === id);
  const t = tenancies.find((x) => x.isActive) || null;
  const spending = useMemo(() => books.entries.filter((e) => e.propertyId === id && e.meta.pnl === 'expense' && inRange(e.date, ps.period)), [books, id, ps.period]);
  if (!p) return <Page title="Property" backTo="/rentals"><Card><Muted>This property is not there any more.</Muted></Card></Page>;
  const rental = p.kind === 'rental';
  if (editing) return <Page title={p.name} narrow backTo={'/property/' + id}><TenancyForm property={p} id={editing === 'new' ? null : editing} onDone={() => setEditing(null)} /></Page>;
  const tenant = t ? books.personById.get(t.tenantId) : null;
  const phone = String(tenant?.phone || '').replace(/\D/g, '');
  const reminder = t && t.unpaidMonths.length
    ? `Hello ${t.tenantName}, this is a reminder that the rent for ${p.name} for ${t.unpaidMonths.map((m) => fmtMonth(m.mk)).join(', ')} (${inr(t.balance)}) is due. Thank you.` : '';
  const byCat = new Map();
  spending.forEach((e) => byCat.set(e.category || e.cat, (byCat.get(e.category || e.cat) || 0) + e.amount));
  const sinceChange = t && t.lastChange ? Math.round(daysBetween(t.lastChange, today) / 30.44) : null;
  const rename = () => {
    const name = window.prompt('Name of the property', p.name);
    if (name && name.trim()) run({ ops: [{ col: 'properties', id, patch: { name: name.trim() } }] }, 'Renamed');
  };
  const remove = () => {
    if (usageOf('properties', id, books) > 0) return run({ error: 'This property has tenants or payments recorded against it, so it cannot be deleted.' });
    if (window.confirm('Move this property to the recycle bin?')) run({ ops: [{ col: 'properties', id, remove: true }] }, 'Moved to the recycle bin');
    return null;
  };
  return (
    <Page title={p.name} sub={rental ? (t ? t.tenantName : 'No tenant at the moment') : 'Home'} backTo={rental ? '/rentals' : '/homes'}
      right={can.write && <button type="button" className="v2-link" onClick={rename}>Rename</button>}>
      {rental && t && (
        <div className="v2-two">
          <Card title="Rent" right={<span className="v2-muted">Due on day {t.dueDay} of the month</span>}>
            <Row left={<span className="v2-big">{inr(t.currentRent)} a month</span>} right={t.rents.length > 1 && t.rents[t.rents.length - 1].pct != null ? <Tag kind="g">{t.rents[t.rents.length - 1].pct > 0 ? '+' : ''}{Math.round(t.rents[t.rents.length - 1].pct)}% from {fmtDate(t.rents[t.rents.length - 1].from)}</Tag> : null} />
            {t.rents.slice().reverse().slice(1).map((r, i) => <Row key={i} left={`Was ${inr(r.amount)} from ${fmtDate(r.from)}`} right={r.pct != null ? `${r.pct > 0 ? '+' : ''}${Math.round(r.pct)}%` : ''} />)}
            {sinceChange != null && <Row left="Rent unchanged for" right={<strong>{sinceChange} months</strong>} />}
            <Row top left="Advance held, to return when they leave" sub={!t.advanceRecorded ? 'None recorded. Use Record a payment → Tenant → Advance received.' : undefined} right={<strong>{inr(t.advanceHeld)}</strong>} />
            <Row left="Agreement" right={`${fmtDate(t.start) || '?'} to ${t.end ? fmtDate(t.end) : 'open'}`} />
            {t.note && <Muted>{t.note}</Muted>}
            {can.write && <button type="button" className="v2-link" onClick={() => setEditing(t.id)}>Change tenant terms or raise the rent</button>}
          </Card>
          <Card title={allMonths || t.months.length <= 12 ? 'Rent received, every month' : 'Rent received, last 12 months'}>
            <div className="v2-months">
              {(allMonths ? t.months : t.months.slice(-12)).map((m) => (
                <div key={m.mk} className="v2-month"><strong>{fmtMonth(m.mk, { year: allMonths || t.months.length > 12 ? m.mk.slice(0, 4) !== today.slice(0, 4) : false })}</strong><Tag kind={MONTH_TAG[m.status][0]}>{MONTH_TAG[m.status][1]}</Tag></div>
              ))}
            </div>
            {t.months.length > 12 && <button type="button" className="v2-link" onClick={() => setAllMonths((x) => !x)}>{allMonths ? 'Show the last 12 months' : `Show all ${t.months.length} months`}</button>}
            {t.startProblem && <Muted>{t.startProblem === 'missing' ? 'No move-in date is saved' : t.startProblem === 'future' ? `The move-in date (${fmtDate(t.start)}) is after today` : `Rent was recorded before the move-in date (${fmtDate(t.start)})`}. Months with rent recorded are still shown. Use "Change tenant terms" below to correct the date.</Muted>}
            {t.balance > 0.5 && <Row left={<strong>Rent due</strong>} right={<Tag><Money v={t.balance} /></Tag>} />}
            {can.write && <a className="v2-btn" href={href('/pay', { type: 'tenant', tenancy: t.id })}>Record rent received</a>}
            {reminder && <a className="v2-btn sec" target="_blank" rel="noreferrer" href={`https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(reminder)}`}>Remind on WhatsApp</a>}
            {reminder && !phone && <Muted>No phone number saved for {t.tenantName}; WhatsApp will ask you to pick the contact.</Muted>}
          </Card>
        </div>
      )}
      {rental && !t && can.write && <Card><Muted>No current tenant.</Muted><Btn onClick={() => setEditing('new')}>+ Add a tenant</Btn></Card>}
      {rental && tenancies.filter((x) => !x.isActive).length > 0 && (
        <Card title="Earlier tenants">
          {tenancies.filter((x) => !x.isActive).map((x) => <Row key={x.id} onClick={can.write ? () => setEditing(x.id) : undefined} left={x.tenantName} right={`${fmtDate(x.start)} to ${fmtDate(x.end)}`} />)}
        </Card>
      )}
      {rental && t && can.write && <button type="button" className="v2-link" onClick={() => setEditing('new')}>A new tenant has moved in</button>}

      <PeriodPicker state={ps} presets={['month', 'year', 'lastYear', 'all', 'custom']} />
      <Card title="Spent on this property" right={can.write && <a href={href('/pay', { type: 'other', kind: rental ? 'rental_expense' : 'home_expense', property: id })}>+ Add expense</a>}>
        {spending.length === 0 && <Muted>Nothing spent in this period.</Muted>}
        {spending.map((e) => <Row key={e.id} top to={can.write ? href('/pay', { entry: e.id }) : undefined} onDelete={can.write ? () => del.entry(e.id) : undefined} deleteLabel="Delete this expense" left={<><strong>{e.category || e.cat}</strong> · {fmtDate(e.date)}</>} sub={[e.mode && e.mode.toUpperCase() === 'UPI' ? 'UPI' : e.mode ? e.mode[0].toUpperCase() + e.mode.slice(1) : '', e.by, e.note].filter(Boolean).join(' · ')} right={<Money v={e.amount} />} />)}
        {spending.length > 0 && <Row left={<strong>Total</strong>} right={<strong><Money v={sum(spending, (e) => e.amount)} /></strong>} />}
      </Card>
      {byCat.size > 1 && (
        <Card title="By type">
          {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => <Row key={c} left={c} right={<Money v={v} />} />)}
        </Card>
      )}
      {rental && (
        <Card title="This property in the period">
          <Row left="Rent received" right={<Money v={sum(books.entries.filter((e) => e.propertyId === id && e.kind === 'rent' && inRange(e.date, ps.period)), (e) => e.amount)} />} />
          <Row left="Spent" right={<Money v={-sum(spending, (e) => e.amount)} />} />
        </Card>
      )}
      {can.admin && <button type="button" className="v2-link" onClick={remove}>Delete this property</button>}
    </Page>
  );
}

function TenancyForm({ property, id, onDone }) {
  const { books, today, run } = useData();
  const existing = id ? books.tenancyById.get(id) : null;
  const tenant = existing ? books.personById.get(existing.tenantId) : null;
  const [f, set] = useForm(() => existing ? {
    id: existing.id, tenantId: existing.tenantId, name: tenant?.name || '', phone: tenant?.phone || '', start: existing.start || '', end: existing.end || '', dueDay: String(existing.dueDay || 1),
    rents: existing.rents.map((r) => ({ from: r.from, amount: String(r.amount) })), active: existing.active !== false, note: existing.note || '',
  } : { name: '', phone: '', start: today, end: '', dueDay: '5', rents: [{ from: today, amount: '' }], active: true, note: '' });
  const setRent = (i, patch) => set('rents', (l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () => {
    if (!f.name.trim()) return run({ error: "Enter the tenant's name." });
    if (!f.start) return run({ error: 'Enter the date the tenant moved in.' });
    const rents = f.rents.filter((r) => r.from && num(r.amount) > 0).map((r) => ({ from: r.from, amount: num(r.amount) })).sort((a, b) => a.from.localeCompare(b.from));
    if (!rents.length) return run({ error: 'Enter the monthly rent.' });
    const tenantId = f.tenantId || uid();
    const tid = f.id || uid();
    const ops = [
      { col: 'people', id: tenantId, data: { ...(tenant || {}), id: tenantId, kind: 'tenant', name: f.name.trim(), phone: f.phone || '', active: true } },
      { col: 'tenancies', id: tid, data: { propertyId: property.id, tenantId, start: f.start, end: f.end || '', dueDay: Math.min(28, Math.max(1, num(f.dueDay) || 1)), rents, active: f.active, note: f.note || '', createdAt: existing?.createdAt, imported: existing?.imported } },
    ];
    // a new tenant moving in ends the previous tenancy on this property
    if (!existing) books.tenancies.filter((t) => t.propertyId === property.id && t.isActive).forEach((t) => ops.push({ col: 'tenancies', id: t.id, patch: { active: false, end: t.end && t.end < f.start ? t.end : f.start } }));
    if (run({ ops }, 'Tenant saved')) onDone();
    return null;
  };
  return (
    <>
      <Card title={existing ? 'Tenant terms' : 'New tenant'} hi>
        <div className="v2-cols"><Field label="Tenant's name"><Text value={f.name} onChange={(v) => set('name', v)} /></Field><Field label="Phone (for WhatsApp reminders)"><Text value={f.phone} onChange={(v) => set('phone', v)} inputMode="tel" /></Field></div>
        <div className="v2-cols"><DateField label="Moved in / agreement from" value={f.start} onChange={(v) => set('start', v)} /><DateField label="Agreement ends (optional)" value={f.end} onChange={(v) => set('end', v)} /></div>
        <Field label="Rent is due on this day of the month"><Num value={f.dueDay} onChange={(v) => set('dueDay', v)} /></Field>
      </Card>
      <Card title="Rent, and every increase">
        {f.rents.map((r, i) => (
          <div key={i} className="v2-cols" style={{ alignItems: 'flex-start' }}>
            <DateField label={i === 0 ? 'From' : 'Increased from'} value={r.from} onChange={(v) => setRent(i, { from: v })} />
            <Field label="₹ a month"><Num value={r.amount} onChange={(v) => setRent(i, { amount: v })} /></Field>
            {f.rents.length > 1 && <button type="button" className="v2-x" style={{ flex: 'none', marginTop: 22 }} aria-label="Remove this rent" onClick={() => set('rents', (l) => l.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
        <button type="button" className="v2-link" onClick={() => set('rents', (l) => [...l, { from: today, amount: '' }])}>+ Rent increase</button>
        <Muted>Each month is charged at the rent in force that month, so past months keep the old rent.</Muted>
      </Card>
      <Check checked={f.active} onChange={(v) => set('active', v)}>This tenant is still here</Check>
      <Field label="Notes on the terms"><Text value={f.note} onChange={(v) => set('note', v)} /></Field>
      <div className="v2-cols"><Btn onClick={save}>Save</Btn><Btn kind="sec" onClick={onDone}>Cancel</Btn></div>
      {existing && <Btn kind="danger" onClick={() => { if (window.confirm('Move this tenancy and every payment recorded for it to the recycle bin?') && run(removeWithPayments('tenancies', existing.id, books), 'Moved to the recycle bin')) onDone(); }}>Delete this tenancy</Btn>}
    </>
  );
}
