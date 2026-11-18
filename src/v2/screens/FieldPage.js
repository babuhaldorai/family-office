import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Money, Tabs, Field, Num, Text, Area, Select, DateField, Btn, Check, Muted, Chips, PayHow, BarRow, Ask, askOp, go, href, useForm } from '../ui/kit';
import { usePeriod, PeriodPicker } from '../ui/Period';
import { WORK_TYPES, workCost } from '../core/books';
import { fieldPlan, yearAhead, leaseAdvice, beforeAfter, scheduleOf } from '../core/insights';
import { workOps, leaseOps, removeWithPayments } from '../data/actions';
import { useDelete } from '../data/useDelete';
import { rainForecast } from '../data/weather';
import { inr, num, sum, fmtDate, uid } from '../core/util';

const TABS = [['plan', 'Plan'], ['work', 'Work done'], ['money', 'Money'], ['lease', 'Lease']];
const TAG = { now: '', soon: '', ok: 'g', watch: 'n', unknown: 'n' };

export default function FieldPage({ id, tab = 'plan', query }) {
  const { books, today, can } = useData();
  const field = books.fieldById.get(id);
  if (!field) return <Page title="Field" backTo="/tea/fields"><Card><Muted>This field is not there any more.</Muted></Card></Page>;
  const lease = books.activeLeaseOn(id, today);
  const tabs = can.money ? TABS : TABS.filter(([k]) => k === 'plan' || k === 'work');
  return (
    <Page title={`${field.name}${field.acres ? ' · ' + field.acres + ' acres' : ''}`} backTo="/tea/fields" sub={lease ? `Leased to ${lease.lessee || 'someone'} until ${fmtDate(lease.end)}` : undefined}>
      <Tabs tabs={tabs} value={tab} onChange={(t) => go(`/field/${id}/${t}`)} />
      {tab === 'plan' && <Plan field={field} />}
      {tab === 'work' && <Work field={field} startAdding={query.add} editId={query.edit} />}
      {tab === 'money' && can.money && <FieldMoney field={field} />}
      {tab === 'lease' && can.money && <Lease field={field} />}
    </Page>
  );
}

function Plan({ field }) {
  const { books, today, can, run } = useData();
  const [forecast, setForecast] = useState(null);
  useEffect(() => {
    if (field.lat == null || field.lat === '') return undefined;
    let dead = false;
    rainForecast(field.lat, field.lon, today).then((d) => { if (!dead) setForecast(d); }).catch(() => {});
    return () => { dead = true; };
  }, [field.lat, field.lon, today]);
  const plan = useMemo(() => fieldPlan(books, field.id, forecast), [books, field.id, forecast]);
  const ahead = useMemo(() => yearAhead(books), [books]);
  const sch = scheduleOf(field);
  const setSch = (k, v) => run({ ops: [{ col: 'fields', id: field.id, patch: { schedule: { ...sch, [k]: num(v) } } }] });
  const leased = books.activeLeaseOn(field.id, today);
  return (
    <>
      {leased && <Card><Muted>This field is leased out, so the plan below is only for reference. The lessee looks after it.</Muted></Card>}
      {plan.items.map((it) => (
        <Card key={it.type} title={it.label} right={<Tag kind={it.hold ? 'r' : TAG[it.status]}>{it.hold ? 'Wait for the rain to pass' : it.tag}</Tag>}>
          <div>{it.reasons.join(' ')}</div>
          <div className="v2-row">
            <Muted>{it.estCost ? `About ${inr(it.estCost)} going by the last times` : 'No cost history yet'}</Muted>
            {can.harvest && !leased && (it.status === 'now' || it.status === 'soon' || it.status === 'unknown') && <a className="v2-btn sec sm" href={it.type === 'manure' ? href('/apply', { field: field.id }) : href(`/field/${field.id}/work`, { add: it.type })}>Log it</a>}
          </div>
        </Card>
      ))}
      {forecast && <Muted>Rain expected in the next 7 days: {Math.round(sum(forecast, (d) => d.mm))} mm.</Muted>}
      {(field.lat == null || field.lat === '') && <Muted>Set this field's location in <a href={href('/settings/lists')}>Settings</a> to get rain warnings before manuring.</Muted>}
      <Card title="Your schedule for this field, change any time">
        <label className="v2-row"><span>Manure every</span><span style={{ width: 150 }}><Select disabled={!can.write} value={String(sch.manureMonths)} onChange={(v) => setSch('manureMonths', v)} options={[3, 4, 6, 8, 12].map((n) => [String(n), `${n} months`])} /></span></label>
        <label className="v2-row"><span>Weed every</span><span style={{ width: 150 }}><Select disabled={!can.write} value={String(sch.weedWeeks)} onChange={(v) => setSch('weedWeeks', v)} options={[4, 6, 8, 10, 12, 16].map((n) => [String(n), `${n} weeks`])} /></span></label>
        <label className="v2-row"><span>Pest control every</span><span style={{ width: 150 }}><Select disabled={!can.write} value={String(sch.pestWeeks)} onChange={(v) => setSch('pestWeeks', v)} options={[['0', 'Only when needed'], ...[4, 8, 12, 26].map((n) => [String(n), `${n} weeks`])]} /></span></label>
        <label className="v2-row"><span>Prune every</span><span style={{ width: 150 }}><Select disabled={!can.write} value={String(sch.pruneYears)} onChange={(v) => setSch('pruneYears', v)} options={[3, 4, 5, 6].map((n) => [String(n), `${n} years`])} /></span></label>
        <label className="v2-row"><span>Hold manuring when rain in 3 days is above</span><span style={{ width: 150 }}><Select disabled={!can.write} value={String(sch.rainLimitMm)} onChange={(v) => setSch('rainLimitMm', v)} options={[20, 30, 40, 60].map((n) => [String(n), `${n} mm`])} /></span></label>
        <Muted>These starting figures are placeholders. Set them to what you and your tea adviser actually follow.</Muted>
      </Card>
      <Card title="How the app decides">
        <Muted>It uses the schedule above, how long ago each job was last logged on this field, whether this field's yield is falling compared with the same weeks last year{plan.trendPct != null ? ` (now ${plan.trendPct > 0 ? '+' : ''}${Math.round(plan.trendPct)}%)` : ''}, and the rain forecast for the field's location. It does not replace advice from your local tea adviser.</Muted>
      </Card>
      {can.money && (
        <Card title="The year ahead, all fields">
          {ahead.length === 0 && <Muted>Nothing is scheduled yet. Log when each job was last done and it will appear here.</Muted>}
          {ahead.slice(0, 12).map((r, i) => <Row key={i} to={href('/field/' + r.fieldId)} left={`${r.overdue ? 'Overdue' : fmtDate(r.date)} · ${r.field} · ${r.label}`} right={r.cost ? <Money v={r.cost} /> : <span className="v2-muted">cost not known</span>} />)}
          {ahead.some((r) => r.cost) && <Row left={<strong>Cash needed for the listed work</strong>} right={<strong><Money v={sum(ahead.slice(0, 12), (r) => r.cost || 0)} /></strong>} />}
        </Card>
      )}
    </>
  );
}

function Work({ field, startAdding, editId }) {
  const { books, today, can } = useData();
  const del = useDelete();
  const [editing, setEditing] = useState(editId || (startAdding ? 'new' : null));
  const list = books.work.filter((w) => w.fieldId === field.id).slice().reverse();
  const preset = WORK_TYPES.some(([k]) => k === startAdding) ? startAdding : null;
  if (editing) return <WorkForm field={field} id={editing === 'new' ? null : editing} presetType={preset} onDone={() => { setEditing(null); if (startAdding || editId) go(`/field/${field.id}/work`); }} />;
  const year = today.slice(0, 4);
  return (
    <>
      {can.harvest && <Btn onClick={() => setEditing('new')}>+ Field work</Btn>}
      <Card title="Work done on this field · tap to edit">
        {list.length === 0 && <Muted>Nothing logged yet.</Muted>}
        {list.map((w) => {
          const ba = w.type === 'manure' ? beforeAfter(books, w) : null;
          return (
            <div key={w.id} className="v2-line" style={{ padding: '6px 0' }}>
              <Row top onClick={can.harvest ? () => setEditing(w.id) : undefined}
                onDelete={can.harvest ? () => del.bill('work', w.id, `this ${w.typeLabel.toLowerCase()} of ${fmtDate(w.date)}`) : undefined} deleteLabel={`Delete ${w.typeLabel} of ${fmtDate(w.date)}`}
                left={<><strong>{w.typeLabel}</strong> · {fmtDate(w.date)}{w.oneTime ? ' · one-time' : ''}</>}
                sub={[w.byLessee ? 'done by the lessee' : '', w.bagsApplied ? `${w.bagsApplied} bags` : '', w.byLessee ? w.items.map((it) => it.name).filter(Boolean).join(', ') : '', w.comment, w.due > 0.5 ? 'not paid yet' : ''].filter(Boolean).join(' · ')}
                right={w.byLessee ? <Tag kind="n">No cost to you</Tag> : can.money ? <Money v={w.fieldCost} /> : null} />
              {ba && ba.pct != null && (
                <div style={{ padding: '4px 0 8px' }}>
                  <div className="v2-flab">Did it help? Kg per acre each week</div>
                  <BarRow label="8 weeks before" value={ba.before.perAcreWeek} max={Math.max(ba.before.perAcreWeek, ba.after.perAcreWeek)} text={`${ba.before.perAcreWeek.toFixed(0)} kg`} kind="grey" />
                  <BarRow label={`${ba.weeksAfter} weeks after`} value={ba.after.perAcreWeek} max={Math.max(ba.before.perAcreWeek, ba.after.perAcreWeek)} text={`${ba.after.perAcreWeek.toFixed(0)} kg`} />
                  <Muted>Change in yield: <strong>{ba.pct > 0 ? '+' : ''}{Math.round(ba.pct)}%</strong>{ba.rainBefore != null && ba.rainAfter != null ? `. Rain per week went from ${Math.round(ba.rainBefore)} mm to ${Math.round(ba.rainAfter)} mm, so part of the change may be the weather.` : '.'}</Muted>
                </div>
              )}
              {ba && ba.pct == null && <Muted>Before and after yield appears once there are a few weeks of harvests on both sides.</Muted>}
            </div>
          );
        })}
        {can.money && list.length > 0 && <Row left={<strong>Spent on this field in {year}</strong>} right={<strong><Money v={sum(list.filter((w) => w.date.startsWith(year)), (w) => w.fieldCost)} /></strong>} />}
      </Card>
    </>
  );
}

export function WorkForm({ field, id, presetType, onDone }) {
  const { books: bk, today: td } = useData();
  const existing0 = bk.workById.get(id);
  const leasedNow = !!bk.activeLeaseOn(field.id, td);
  if (existing0 && existing0.groupId) {
    return (
      <Card title="Part of a day's manuring" hi>
        <Muted>This was entered with the manure applied on {fmtDate(existing0.date)}, which may cover other fields too. Open that to change it.</Muted>
        <a className="v2-btn" href={href('/apply/' + existing0.groupId)}>Open the day's manuring</a>
        <Btn kind="sec" onClick={onDone}>Back</Btn>
      </Card>
    );
  }
  if (presetType === 'manure' && !id && !leasedNow) return <ManureChoice field={field} onDone={onDone} />;
  return <WorkFormInner field={field} id={id} presetType={presetType} onDone={onDone} />;
}

function ManureChoice({ field, onDone }) {
  return (
    <Card title="Manuring" hi>
      <Muted>Log manure that was applied on one or more fields in a day, from what you bought or mixed.</Muted>
      <a className="v2-btn" href={href('/apply', { field: field.id })}>Apply manure from stock</a>
      <Muted>If the lessee did it at their own cost, use the field work form instead.</Muted>
      <Btn kind="sec" onClick={onDone}>Back</Btn>
    </Card>
  );
}

function WorkFormInner({ field, id, presetType, onDone }) {
  const { books, today, can, run } = useData();
  const existing = id ? books.workById.get(id) : null;
  const pay0 = existing ? books.entryById.get('pay-' + existing.id) : null;
  const [f, set] = useForm(() => existing ? {
    id: existing.id, date: existing.date, fieldId: existing.fieldId, type: existing.type, oneTime: !!existing.oneTime,
    labourMode: existing.labourMode || 'day', people: String(existing.people || ''), days: String(existing.days || ''), rate: String(existing.rate || ''),
    bags: String(existing.bags || ''), fixedAmount: String(existing.fixedAmount || ''),
    items: (existing.items || []).map((it) => ({ ...it, qty: String(it.qty), unitCost: it.unitCost != null ? String(it.unitCost) : '' })),
    byLessee: !!existing.byLessee, comment: existing.comment || '', pay: { paid: !!pay0 || existing.due < 0.5, mode: pay0?.mode || 'cash', by: pay0?.by || books.handlers[0], date: pay0?.date || existing.date },
  } : {
    date: today, fieldId: field.id, type: presetType || 'weeding', oneTime: false, labourMode: presetType === 'manure' ? 'bag' : 'day',
    people: '', days: '1', rate: '', bags: '', fixedAmount: '', items: [], comment: '', pay: { paid: true, mode: 'cash', by: books.handlers[0], date: today },
    byLessee: !!books.activeLeaseOn(field.id, today),
  });
  const stockLeft = books.stock.filter((s) => s.left > 0 || f.items.some((it) => it.stockId === s.id));
  const stockBags = sum(f.items.filter((it) => it.stockId), (it) => num(it.qty));
  // "bags applied" follows the bags taken from stock until it is typed over
  const bagsApplied = f.labourMode === 'bag' && f.bags === '' ? stockBags : f.bags;
  const cost = useMemo(() => workCost({ ...f, bags: bagsApplied, items: f.items.map((it) => ({ ...it, qty: num(it.qty), unitCost: num(it.unitCost) })) }, books.stockById), [f, bagsApplied, books.stockById]);
  const setItem = (i, patch) => set('items', (l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const lease = books.activeLeaseOn(f.fieldId, f.date);
  const save = () => {
    // Data entry cannot record payments: the work is saved as an unpaid bill for the owner to settle
    const form = { ...f, bags: bagsApplied, pay: can.money ? { ...f.pay, date: f.pay.date || f.date } : (existing ? { paid: !!pay0 } : null) };
    if (run(workOps(form, books), existing ? 'Field work updated' : 'Field work saved')) onDone();
  };
  const overridden = existing && existing.costOverride != null;
  return (
    <>
      <Card title={existing ? 'Edit field work' : 'Field work'} hi>
        <div className="v2-cols">
          <Field label="Field"><Select value={f.fieldId} onChange={(v) => set('fieldId', v)} options={books.fields.map((x) => [x.id, x.name])} /></Field>
          <DateField value={f.date} onChange={(v) => { set('date', v); set('pay', (p) => ({ ...p, date: v })); }} />
        </div>
        {(lease || f.byLessee) && (
          <Check checked={f.byLessee} onChange={(v) => set('byLessee', v)}><strong>Done and paid for by the lessee{lease?.lessee ? ` (${lease.lessee})` : ''}</strong><div className="v2-muted">Kept as a record of what was done to the field. No cost is entered and nothing is added to your expenses.</div></Check>
        )}
        <div className="v2-flab">What was done?</div>
        <Chips label="What was done" options={WORK_TYPES} value={f.type} onChange={(v) => { set('type', v); if (v === 'manure' && !existing) set('labourMode', 'bag'); }} />
        <Check checked={f.oneTime} onChange={(v) => set('oneTime', v)}><strong>One-time work, not routine</strong><div className="v2-muted">Fencing, a new path, land clearing. Shown separately in reports and kept out of the regular cost per kg.</div></Check>
      </Card>
      {!f.byLessee && <Card title="Labour">
        <Chips label="How labour is paid" options={[['day', 'Per day'], ['bag', 'Per bag'], ['fixed', 'Fixed amount']]} value={f.labourMode} onChange={(v) => set('labourMode', v)} />
        {f.labourMode === 'day' && <div className="v2-cols"><Field label="People"><Num value={f.people} onChange={(v) => set('people', v)} /></Field><Field label="Days"><Num value={f.days} onChange={(v) => set('days', v)} /></Field><Field label="₹ per day"><Num value={f.rate} onChange={(v) => set('rate', v)} /></Field></div>}
        {f.labourMode === 'bag' && <div className="v2-cols"><Field label="Bags applied"><Num value={f.bags === '' && stockBags ? String(stockBags) : f.bags} onChange={(v) => set('bags', v)} /></Field><Field label="₹ per bag to apply"><Num value={f.rate} onChange={(v) => set('rate', v)} placeholder="200" /></Field></div>}
        {f.labourMode === 'fixed' && <Field label="Amount agreed (₹)"><Num value={f.fixedAmount} onChange={(v) => set('fixedAmount', v)} /></Field>}
        {can.money && <Row left="Labour" right={<strong>{inr(cost.labour)}</strong>} />}
      </Card>}
      <Card title={f.byLessee ? 'What they used, if you know' : f.type === 'manure' ? 'Manure used' : 'Material and hire charges'}>
        {f.items.map((it, i) => (
          <div key={i} className="v2-cols" style={{ alignItems: 'flex-end' }}>
            {!f.byLessee && <Field label="From"><Select value={it.stockId || ''} onChange={(v) => setItem(i, { stockId: v || undefined, name: v ? books.stockById.get(v)?.name : it.name })} options={stockLeft.map((s) => [s.id, `Stock: ${s.name} · ${s.left} left`])} placeholder="Bought for this job" /></Field>}
            {(f.byLessee || !it.stockId) && <Field label="What"><Text value={it.name} onChange={(v) => setItem(i, { name: v })} placeholder="Pesticide, sprayer hire…" /></Field>}
            <Field label={!f.byLessee && it.stockId ? 'Bags' : f.type === 'manure' ? 'Bags' : 'Quantity'}><Num value={it.qty} onChange={(v) => setItem(i, { qty: v })} /></Field>
            {!f.byLessee && !it.stockId && <Field label="₹ each"><Num value={it.unitCost} onChange={(v) => setItem(i, { unitCost: v })} /></Field>}
            <button type="button" className="v2-x" style={{ flex: 'none' }} aria-label="Remove" onClick={() => set('items', (l) => l.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="v2-link" onClick={() => set('items', (l) => [...l, { stockId: !f.byLessee && f.type === 'manure' && stockLeft[0] ? stockLeft[0].id : undefined, name: !f.byLessee && f.type === 'manure' && stockLeft[0] ? stockLeft[0].name : '', qty: '', unitCost: '' }])}>+ Add {f.type === 'manure' ? 'manure' : 'material or hire charge'}</button>
        {f.type === 'manure' && !f.byLessee && <Muted>Manure taken from stock was paid for when it was bought, so only the applying is paid now. Its cost still counts against this field.{stockLeft.length === 0 ? ' No stock is left: ' : ' '}<a href={href('/stock')}>Log a new purchase</a>.</Muted>}
      </Card>
      {can.money && !f.byLessee && (
        <Card>
          <Row left={<strong>To pay for this work</strong>} right={<span className="v2-big">{inr(overridden ? existing.cost : cost.cost)}</span>} />
          {cost.stockValue > 0 && <Row left="Plus manure from stock, already paid" right={<Money v={cost.stockValue} />} />}
          {overridden && <Muted>This cost came from the old app as a single figure. Saving the form replaces it with the figures above ({inr(cost.cost)}).</Muted>}
          <Check checked={f.pay.paid} onChange={(v) => set('pay', (p) => ({ ...p, paid: v }))}>Already paid</Check>
          {f.pay.paid && <PayHow value={f.pay} onChange={(v) => set('pay', (p) => ({ ...p, ...v }))} handlers={books.handlers} />}
          {!f.pay.paid && <Muted>It will show on Home under "Bills not paid yet".</Muted>}
        </Card>
      )}
      <Field label="Comment"><Area value={f.comment} onChange={(v) => set('comment', v)} /></Field>
      <div className="v2-cols"><Btn onClick={save}>{existing ? 'Save changes' : 'Save field work'}</Btn><Btn kind="sec" onClick={onDone}>Cancel</Btn></div>
      {existing && <Btn kind="danger" onClick={() => { if (window.confirm('Move this work and its payment to the recycle bin?') && run(removeWithPayments('work', existing.id, books), 'Moved to the recycle bin')) onDone(); }}>Delete</Btn>}
    </>
  );
}

function FieldMoney({ field }) {
  const { books, today } = useData();
  const ps = usePeriod(today, 'year');
  const r = useMemo(() => books.byField(ps.period).find((x) => x.fieldId === field.id), [books, ps.period, field.id]);
  if (!r) return <Card><Muted>Nothing yet.</Muted></Card>;
  return (
    <>
      <PeriodPicker state={ps} presets={['month', 'year', 'lastYear', 'all', 'custom']} />
      <Card title="What this field made, by harvest date">
        <Row left={`Tea sold · ${(r.netKg - r.unratedKg).toFixed(1)} kg at confirmed rates`} right={<Money v={r.income} />} />
        {r.unratedKg > 0 && <Row left="Waiting for a rate, not counted yet" right={`${r.unratedKg.toFixed(1)} kg`} />}
        {r.lease > 0 && <Row left="Lease rent received" right={<Money v={r.lease} />} />}
        <Row left="Worker wages" right={<Money v={-r.wages} />} />
        <Row left="Manure and field work" right={<Money v={-r.work} />} />
        <Row left="Other expenses" right={<Money v={-r.misc} />} />
        <Row left={<strong>Left from this field</strong>} right={<span className={'v2-big ' + (r.profit >= 0 ? 'v2-green' : 'v2-red')}>{inr(r.profit)}</span>} />
        <Row left="Kg per acre" right={r.kgPerAcre != null ? r.kgPerAcre.toFixed(0) : '—'} />
        <Row left="Left per kg" right={r.profitPerKg != null ? inr(r.profitPerKg) : '—'} />
        <Muted>Counted on the day the leaf was delivered and the work was done, whenever the money actually moved. That is why it can differ from money in and out for the same dates.</Muted>
      </Card>
    </>
  );
}

function Lease({ field }) {
  const { books, can } = useData();
  const leases = books.leases.filter((l) => l.fieldId === field.id);
  const [editing, setEditing] = useState(null);
  const [interest, setInterest] = useState(String(books.settings.interestPct || 7));
  const [offer, setOffer] = useState('');
  const adv = useMemo(() => leaseAdvice(books, field.id, num(interest) || 7), [books, field.id, interest]);
  if (editing) return <LeaseForm field={field} id={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  const tryOffer = num(offer) > 0 ? adv.enough && { rent: adv.compare(offer, 'rent'), deposit: adv.compare(offer, 'deposit') } : null;
  return (
    <>
      <Card title="Leases on this field">
        {leases.length === 0 && <Muted>This field has never been leased out.</Muted>}
        {leases.map((l) => (
          <Row key={l.id} top onClick={can.write ? () => setEditing(l.id) : undefined}
            left={<><strong>{l.lessee || 'Lessee'}</strong> · {fmtDate(l.start)} to {fmtDate(l.end)}</>}
            sub={`${l.kind === 'deposit' ? 'Deposit, returned at the end' : 'Rent, not returned'} · ${inr(l.amount)}${l.toReturn > 0 ? ` · ${inr(l.toReturn)} to give back` : ''}${l.toReceive > 0.5 ? ` · ${inr(l.toReceive)} not received yet` : ''}${l.note ? ' · ' + l.note : ''}`}
            right={<Tag kind={l.status === 'active' ? 'g' : 'n'}>{l.status === 'active' ? `${l.daysLeft} days left` : l.status === 'upcoming' ? 'Not started' : 'Ended'}</Tag>} />
        ))}
        {can.write && <Btn kind="sec" onClick={() => setEditing('new')}>+ Lease this field</Btn>}
      </Card>

      <Card title="Lease or keep? What this field is worth">
        {!adv.enough && <Muted>{adv.reason} The advice needs harvests and expenses logged against this field.</Muted>}
        {adv.enough && (<>
          <Row left={`Tea sold in the last 12 months · ${adv.last12.netKg.toFixed(0)} kg`} right={<Money v={adv.last12.income} />} />
          <Row left="Wages, manure, field work and other costs" right={<Money v={-adv.last12.costs} />} />
          <Row left={<strong>Profit when you run it yourself{adv.scaled ? ', scaled to a year' : ''}</strong>} right={<span className="v2-big">{inr(adv.yearProfit)}</span>} />
          {adv.scaled && <Muted>Only {adv.monthsOfData} months of data so far, so this is scaled up to 12 months. Treat it as rough until a full year is logged.</Muted>}
          {adv.unratedKg > 0 && <Muted>{adv.unratedKg.toFixed(0)} kg is still waiting for a rate and is not counted, so the real profit is higher.</Muted>}
          <Row left="Likely profit next year if you keep it" right={`${inr(adv.low)} – ${inr(adv.high)}`} />
        </>)}
      </Card>
      {adv.enough && (
        <>
          <Card title="Suggested price for a 1 year lease, rent not returned" hi>
            <div className="v2-huge">{inr(adv.suggested)}</div>
            <Row left="Do not go below" right={<strong>{inr(adv.floor)}</strong>} />
            <Muted>Below {inr(adv.floor)} you are likely to earn more by running the field yourself. The suggested price adds a margin on top of the best year you could expect.</Muted>
          </Card>
          <Card title="Try an offer">
            <div className="v2-cols">
              <Field label="Offer (₹)"><Num value={offer} onChange={setOffer} placeholder={String(adv.suggested)} /></Field>
              <Field label="Interest you can earn on a deposit (%)"><Num value={interest} onChange={setInterest} /></Field>
            </div>
            {tryOffer && (<>
              <Row top left="As rent, not returned" sub="You keep all of it" right={<><strong>{inr(tryOffer.rent.gain)}</strong> <Tag kind={tryOffer.rent.vsKeeping >= 0 ? 'g' : ''}>{inr(tryOffer.rent.vsKeeping, { sign: true })}</Tag></>} />
              <Row top left="As a deposit, returned at the end" sub="You only earn the interest while you hold it" right={<><strong>{inr(tryOffer.deposit.gain)}</strong> <Tag kind={tryOffer.deposit.vsKeeping >= 0 ? 'g' : ''}>{inr(tryOffer.deposit.vsKeeping, { sign: true })}</Tag></>} />
              <Muted>The coloured figure is the difference against keeping the field ({inr(adv.yearProfit)} a year).</Muted>
            </>)}
            <Row left="Returned deposit that would match keeping it" right={<strong>about {inr(adv.depositToMatch)}</strong>} />
          </Card>
          <Card title="Also think about">
            <Muted>Leasing means no work, no wages to pay in advance and no risk from the rate or the rain. But if the lessee skips manuring, the yield can drop for a year after you get the field back.</Muted>
          </Card>
        </>
      )}
    </>
  );
}

function LeaseForm({ field, id, onDone }) {
  const { books, today, run, user } = useData();
  const [ask, setAsk] = useState(null);
  const existing = id ? books.leaseById.get(id) : null;
  const pay0 = existing ? books.entryById.get('pay-' + existing.id) : null;
  const [f, set] = useForm(() => existing ? {
    id: existing.id, fieldId: existing.fieldId, lessee: existing.lessee || '', phone: existing.phone || '', start: existing.start, end: existing.end, kind: existing.kind, amount: String(existing.amount), note: existing.note || '',
    pay: { paid: !!pay0 || existing.received > 0, mode: pay0?.mode || 'bank', by: pay0?.by || books.handlers[0], date: pay0?.date || existing.start },
  } : { fieldId: field.id, lessee: '', phone: '', start: today, end: '', kind: '', amount: '', note: '', pay: { paid: true, mode: 'bank', by: books.handlers[0], date: today } });
  const link = `/field/${field.id}/lease`;
  const save = () => {
    const res = leaseOps({ ...f, pay: { ...f.pay, date: f.pay.date || f.start } }, books);
    if (!res.error) res.ops.push(...askOp(ask, { id: uid(), link, about: `Lease of ${field.name}${f.lessee ? ' to ' + f.lessee : ''}`, by: user?.displayName || user?.email || '', date: today }));
    if (run(res, ask?.who ? `Lease saved and ${ask.who} asked` : 'Lease saved')) onDone();
  };
  return (
    <>
      <Card title={existing ? 'Edit lease' : 'Lease this field'} hi>
        <div className="v2-cols"><Field label="Leased to"><Text value={f.lessee} onChange={(v) => set('lessee', v)} /></Field><Field label="Phone"><Text value={f.phone} onChange={(v) => set('phone', v)} inputMode="tel" /></Field></div>
        <div className="v2-cols"><DateField label="From" value={f.start} onChange={(v) => set('start', v)} /><DateField label="Until" value={f.end} onChange={(v) => set('end', v)} /></div>
      </Card>
      <Card title="What kind of lease?">
        <label className={'v2-opt' + (f.kind === 'rent' ? ' on' : '')}><input type="radio" name="kind" checked={f.kind === 'rent'} onChange={() => set('kind', 'rent')} /><span><strong>Rent, not returned</strong><div className="v2-muted">Example: ₹1 lakh for 1 year. Counted as income.</div></span></label>
        <label className={'v2-opt' + (f.kind === 'deposit' ? ' on' : '')}><input type="radio" name="kind" checked={f.kind === 'deposit'} onChange={() => set('kind', 'deposit')} /><span><strong>Deposit, returned at the end</strong><div className="v2-muted">Example: ₹3 lakh for 1 year. Not income. Shown as money you must give back.</div></span></label>
      </Card>
      <Card>
        <Field label="Amount agreed (₹)"><Num big value={f.amount} onChange={(v) => set('amount', v)} /></Field>
        <Check checked={f.pay.paid} onChange={(v) => set('pay', (p) => ({ ...p, paid: v }))}>Already received</Check>
        {f.pay.paid && <PayHow value={f.pay} onChange={(v) => set('pay', (p) => ({ ...p, ...v }))} handlers={books.handlers} verb="received" />}
      </Card>
      <Field label="Notes (fertilizer the lessee uses, conditions, anything agreed)"><Area value={f.note} onChange={(v) => set('note', v)} /></Field>
      {books.notes.filter((n) => n.kind === 'todo' && !n.done && n.link === link).map((n) => (
        <Card key={n.id} title={`Question for ${n.assignee || 'someone'}`}>
          <div>{n.text}</div>
          <Muted>Asked by {n.by || 'someone'} on {fmtDate(n.date)}.</Muted>
          <Btn kind="sec" onClick={() => run({ ops: [{ col: 'notes', id: n.id, patch: { done: true } }] }, 'Marked as answered')}>Mark as answered</Btn>
        </Card>
      ))}
      <Ask value={ask} onChange={setAsk} handlers={books.handlers} suggestion={!f.pay.mode || !f.pay.by ? 'How was the lease amount received, and who received it?' : ''} />
      <Muted>No harvest can be logged on this field while it is leased. Home reminds you 30 days before the lease ends.</Muted>
      <div className="v2-cols"><Btn onClick={save}>Save lease</Btn><Btn kind="sec" onClick={onDone}>Cancel</Btn></div>
      {existing && <Btn kind="danger" onClick={() => { if (window.confirm('Move this lease and the payments recorded for it to the recycle bin?') && run(removeWithPayments('leases', existing.id, books), 'Moved to the recycle bin')) onDone(); }}>Delete</Btn>}
    </>
  );
}
