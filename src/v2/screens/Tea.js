import React, { useMemo, useState } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Money, Tabs, Table, Select, Muted, Btn, Field, Text, Num, DateField, PayHow, Check, go, href, download, useForm } from '../ui/kit';
import { usePeriod, PeriodPicker } from '../ui/Period';
import { inr, inRange, sum, fmtDate, num, r2, daysBetween } from '../core/util';
import { DIFF_LABEL } from '../core/books';
import { deliveriesCSV } from '../core/backup';
import { equipmentOps, removeWithPayments } from '../data/actions';
import { useDelete } from '../data/useDelete';

const STATUS = { paid: ['g', 'Agent paid'], part: ['', 'Part paid'], due: ['', 'Agent to pay'], norate: ['', 'Rate not known'] };
const TABS = [['harvest', 'Harvest'], ['account', 'Tea account'], ['fields', 'Fields'], ['people', 'People'], ['equipment', 'Equipment']];

export default function Tea({ tab = 'harvest' }) {
  const { can } = useData();
  const tabs = can.money ? TABS : TABS.filter(([k]) => k === 'harvest' || k === 'fields');
  return (
    <Page title="Tea" right={can.harvest && <a className="v2-btn sm" href={href('/harvest')}>+ Harvest day</a>}>
      <Tabs tabs={tabs} value={tab} onChange={(t) => go('/tea/' + t)} />
      {tab === 'harvest' && <HarvestLog />}
      {tab === 'account' && can.money && <Account />}
      {tab === 'fields' && <Fields />}
      {tab === 'people' && can.money && <People />}
      {tab === 'equipment' && can.money && <Equipment />}
    </Page>
  );
}

function HarvestLog() {
  const { books, today, can } = useData();
  const del = useDelete();
  const ps = usePeriod(today, 'month');
  const [fieldId, setField] = useState('');
  const [agentId, setAgent] = useState('');
  const [workerId, setWorker] = useState('');
  const rows = useMemo(() => books.deliveries.filter((d) => inRange(d.date, ps.period) && (!fieldId || d.fieldId === fieldId) && (!agentId || d.agentId === agentId) && (!workerId || d.workers.some((w) => w.workerId === workerId))).slice().reverse(), [books, ps.period, fieldId, agentId, workerId]);
  const rated = rows.filter((d) => d.value != null);
  const unratedKg = sum(rows.filter((d) => d.value == null), (d) => d.net);
  const head = can.money
    ? ['Date', 'Field', 'Agent', { label: 'Weighed', r: 1 }, { label: 'Deducted', r: 1 }, { label: 'Net kg', r: 1 }, { label: 'Rate', r: 1 }, { label: 'From agent', r: 1 }, { label: 'Wages', r: 1 }, 'Status']
    : ['Date', 'Field', 'Agent', { label: 'Weighed', r: 1 }, { label: 'Deducted', r: 1 }, { label: 'Net kg', r: 1 }, 'Picked by'];
  return (
    <>
      <PeriodPicker state={ps} />
      <div className="v2-cols">
        <Select aria-label="Field" value={fieldId} onChange={setField} options={books.fields.map((f) => [f.id, f.name])} placeholder="All fields" />
        <Select aria-label="Agent" value={agentId} onChange={setAgent} options={books.agents.map((a) => [a.id, a.name])} placeholder="All agents" />
        <Select aria-label="Worker" value={workerId} onChange={setWorker} options={books.workers.map((w) => [w.id, w.name])} placeholder="All workers" />
      </div>
      <Card title="Harvest log · tap a row to edit it" right={rows.length > 0 && <button type="button" className="v2-link" onClick={() => download(`harvest-${ps.period.from}-to-${ps.period.to}.csv`, deliveriesCSV(books, rows))}>Download</button>}>
        <Table
          head={head} empty="No harvest in this period."
          onRow={can.harvest ? (r) => go('/harvest/' + r.key) : undefined}
          onDelete={can.harvest ? (r) => del.delivery(r.key) : undefined}
          rows={rows.map((d) => ({
            key: d.id,
            cells: can.money ? [
              fmtDate(d.date, { year: false, dow: true }), d.fieldName, d.agentName, d.gross.toFixed(1), d.ded.toFixed(1), d.net.toFixed(1),
              d.rate != null ? d.rate.toFixed(2) : '', d.value != null ? inr(d.value) : '', inr(d.wages),
              <Tag kind={STATUS[d.agentStatus][0]}>{STATUS[d.agentStatus][1]}</Tag>,
            ] : [fmtDate(d.date, { year: false, dow: true }), d.fieldName, d.agentName, d.gross.toFixed(1), d.ded.toFixed(1), d.net.toFixed(1), d.workers.map((w) => books.nameOf(w.workerId)).join(', ')],
          }))}
          foot={can.money
            ? ['Total', `${rows.length} days`, '', sum(rows, (d) => d.gross).toFixed(1), sum(rows, (d) => d.ded).toFixed(1), sum(rows, (d) => d.net).toFixed(1), '', inr(sum(rated, (d) => d.value)), inr(sum(rows, (d) => d.wages)), '']
            : ['Total', `${rows.length} days`, '', sum(rows, (d) => d.gross).toFixed(1), sum(rows, (d) => d.ded).toFixed(1), sum(rows, (d) => d.net).toFixed(1), '']}
        />
        {can.money && unratedKg > 0 && <Muted>{unratedKg.toFixed(1)} kg is waiting for a rate, so it is not in the money total yet.</Muted>}
      </Card>
    </>
  );
}

function Account() {
  const { books, today } = useData();
  const ps = usePeriod(today, 'month');
  const t = useMemo(() => books.teaAccount(ps.period), [books, ps.period]);
  const settled = r2(t.paid + t.advRecovered);
  return (
    <>
      <PeriodPicker state={ps} presets={['week', 'month', 'lastMonth', 'year', 'all', 'custom']} />
      <div className="v2-two">
        <Card title="Kg" right={<Tag kind={t.kgOk ? 'g' : 'r'}>{t.kgOk ? 'Matches' : 'Does not match'}</Tag>}>
          <Row left="Weighed" right={`${t.weighed.toFixed(1)} kg`} />
          <Row left={`Deducted (bags ${t.bagDed.toFixed(1)} + water ${t.waterDed.toFixed(1)}${t.otherDed ? ` + other ${t.otherDed.toFixed(1)}` : ''})`} right={`−${t.deducted.toFixed(1)} kg`} />
          <Row left={<strong>Net kg the agents pay for</strong>} right={<strong>{t.netAgent.toFixed(1)} kg</strong>} />
          <Row left={<strong>Net kg the workers are paid for</strong>} right={<strong>{t.netWorkers.toFixed(1)} kg</strong>} />
        </Card>
        <Card title="From agents, for leaf delivered in this period">
          <Row left={`Value at confirmed rates · ${(t.netAgent - t.unratedKg).toFixed(1)} kg`} right={<Money v={t.agentValue} />} />
          {t.unratedKg > 0 && <Row left="Waiting for a rate" right={`${t.unratedKg.toFixed(1)} kg`} />}
          <Row left="Received in this period" right={<Money v={t.received} />} />
          {books.agents.filter((a) => Math.abs(a.balance) > 0.5).map((a) => <Row key={a.id} to={href('/pay', { type: 'agent', party: a.id })} left={`${a.name} ${a.balance > 0 ? 'still owes, in total' : 'has overpaid, in total'}`} right={<Tag><Money v={Math.abs(a.balance)} /></Tag>} />)}
        </Card>
        <Card title="To workers, for harvests in this period">
          <Row left={`Wages earned · ${t.netWorkers.toFixed(1)} kg`} right={<Money v={t.earned} />} />
          <Row left="Paid in this period" right={<Money v={t.paid} />} />
          {t.advRecovered > 0 && <Row left="Taken back from advances" right={<Money v={t.advRecovered} />} />}
          <Row left="Paid plus advances taken back" right={<Money v={settled} />} />
          {books.workers.filter((w) => Math.abs(w.due) > 0.5).map((w) => <Row key={w.id} to={href('/pay', { type: 'worker', party: w.id })} left={`${w.name} ${w.due > 0 ? 'is still owed, in total' : 'has been paid ahead, in total'}`} right={<Tag><Money v={Math.abs(w.due)} /></Tag>} />)}
        </Card>
        <Card title="Differences in this period, and why">
          {t.diffs.length === 0 && <Muted>Every payment in this period matched what was expected.</Muted>}
          {t.diffs.map((e) => (
            <Row key={e.id} top to={href('/pay', { entry: e.id })} left={<><strong>{e.party}</strong> · {fmtDate(e.date, { year: false })}</>}
              sub={`${DIFF_LABEL[e.diffReason] || 'No reason given'}${e.diffComment ? ' · ' + e.diffComment : ''}`}
              right={<Tag>{inr(Math.abs(e.diff))} {e.diff > 0 ? 'extra' : 'short'}</Tag>} />
          ))}
        </Card>
      </div>
      <Card title="Rate history, each agent's own dates">
        {books.agents.map((a) => (
          <div key={a.id}>
            <strong>{a.name}</strong>
            {a.ratePeriods.slice(0, 8).map((p, i) => (
              <Row key={i} left={`${p.from === p.to ? fmtDate(p.to) : fmtDate(p.from, { year: false }) + ' – ' + fmtDate(p.to)} · ${p.kg.toFixed(1)} kg`} right={p.rate != null ? `₹${p.rate.toFixed(2)}` : <span className="v2-muted">not paid yet</span>} />
            ))}
            {a.ratePeriods.length === 0 && <Muted>No deliveries yet.</Muted>}
            {a.ratePeriods.length > 8 && <Muted>{a.ratePeriods.length - 8} earlier periods are in Reports → Agents.</Muted>}
          </div>
        ))}
      </Card>
    </>
  );
}

function Fields() {
  const { books, today, can } = useData();
  const del = useDelete();
  return (
    <>
      <div className="v2-two">
        {books.fields.map((f) => {
          const lease = books.activeLeaseOn(f.id, today);
          const lastH = books.deliveries.filter((d) => d.fieldId === f.id).pop();
          return (
            <Card key={f.id} title={f.name} right={lease ? <Tag>Leased to {lease.lessee || 'someone'}</Tag> : null}>
              <Row left={`${f.acres || '?'} acres`} right={lastH ? `Last harvest ${fmtDate(lastH.date, { year: false })}` : 'No harvest yet'} />
              <div className="v2-cols">
                <a className="v2-btn sec" href={href('/field/' + f.id)}>Plan and history</a>
                {can.harvest && !lease && <a className="v2-btn sec" href={href('/field/' + f.id + '/work', { add: 1 })}>+ Field work</a>}
              </div>
            </Card>
          );
        })}
      </div>
      {books.fields.length === 0 && <Card><Muted>No fields yet.</Muted><a className="v2-btn" href={href('/settings/lists')}>Add a field</a></Card>}
      {can.money && (
        <Card title="Manure in stock" right={can.write && <a href={href('/stock')}>+ New purchase</a>}>
          {books.stock.length === 0 && <Muted>No manure purchases logged.</Muted>}
          {books.stock.map((s) => (
            <Row key={s.id} top to={can.write ? href('/stock/' + s.id) : undefined} onDelete={can.write ? () => del.bill('stock', s.id, `the purchase of ${s.name}`) : undefined} deleteLabel={`Delete the purchase of ${s.name}`} left={<><strong>{s.name}</strong> · bought {fmtDate(s.date)}</>}
              sub={`${s.bags} bags · ${inr(s.cost)}${num(s.transport) ? ` incl. ${inr(s.transport)} transport` : ''} · ${s.used} applied`}
              right={<Tag kind={s.left > 0 ? 'g' : 'n'}>{s.left} left</Tag>} />
          ))}
        </Card>
      )}
    </>
  );
}

function People() {
  const { books, today } = useData();
  return (
    <div className="v2-two">
      <Card title="Workers">
        {books.workers.filter((w) => w.active !== false || Math.abs(w.due) > 0.5 || w.advanceBalance > 0.5).map((w) => (
          <Row key={w.id} top to={href('/pay', { type: 'worker', party: w.id })}
            left={<strong>{w.name}</strong>}
            sub={[
              w.due > 0.5 ? `${w.unpaidDays} unpaid ${w.unpaidDays === 1 ? 'day' : 'days'} · ${w.unpaidKg.toFixed(1)} kg` : 'Paid up',
              w.advanceBalance > 0.5 ? `advance owed ${inr(w.advanceBalance)}` : '',
              w.lastWork ? `last worked ${fmtDate(w.lastWork, { year: false })}` : '',
            ].filter(Boolean).join(' · ')}
            right={w.due > 0.5 ? <Tag><Money v={w.due} /> due</Tag> : w.due < -0.5 ? <Tag kind="n">{inr(-w.due)} ahead</Tag> : <Tag kind="g">Paid</Tag>} />
        ))}
        {books.workers.length === 0 && <Muted>No workers yet.</Muted>}
        <Row left={<strong>Total wages due</strong>} right={<strong><Money v={sum(books.workers.filter((w) => w.due > 0), (w) => w.due)} /></strong>} />
        <Row left="Total advances outstanding" right={<Money v={sum(books.workers, (w) => w.advanceBalance)} />} />
      </Card>
      <Card title="Agents">
        {books.agents.map((a) => (
          <Row key={a.id} top to={href('/pay', { type: 'agent', party: a.id })}
            left={<strong>{a.name}</strong>}
            sub={[
              a.unratedKg > 0 ? `${a.unratedKg.toFixed(1)} kg waiting for a rate` : '',
              a.avgRate ? `average ₹${a.avgRate.toFixed(2)} per kg` : '',
              a.daysToPay != null ? `pays in about ${a.daysToPay} days` : '',
              a.unrated.length ? `oldest unpaid ${daysBetween(a.unrated[0].date, today)} days ago` : '',
            ].filter(Boolean).join(' · ')}
            right={a.unratedKg > 0 ? <Tag>Record payment</Tag> : a.balance > 0.5 ? <Tag><Money v={a.balance} /> owed</Tag> : <Tag kind="g">Paid</Tag>} />
        ))}
        {books.agents.length === 0 && <Muted>No agents yet.</Muted>}
      </Card>
      <a className="v2-btn sec" href={href('/settings/lists')}>Add or change workers and agents</a>
    </div>
  );
}

function Equipment() {
  const { books, today, can, run } = useData();
  const [open, setOpen] = useState(null);
  const blank = { name: '', date: today, cost: '', lifeYears: '5', note: '', pay: { paid: true, mode: 'bank', by: books.handlers[0], date: today } };
  const [f, set, setAll] = useForm(blank);
  const edit = (q) => { const p = books.entryById.get('pay-' + q.id); setAll({ id: q.id, name: q.name, date: q.date, cost: String(q.cost), lifeYears: String(q.lifeYears), note: q.note || '', pay: { paid: !!p || q.due < 0.5, mode: p?.mode || 'bank', by: p?.by || books.handlers[0], date: p?.date || q.date } }); setOpen('form'); };
  const save = () => { if (run(equipmentOps(f, books), 'Equipment saved')) { setOpen(null); setAll(blank); } };
  // is the machine paying for itself: picking cost per kg with and without it
  const machineKg = sum(books.deliveries.filter((d) => d.machine), (d) => d.net);
  const handRows = books.deliveries.filter((d) => !d.machine);
  const machRows = books.deliveries.filter((d) => d.machine);
  const handCost = sum(handRows, (d) => d.net) > 0 ? sum(handRows, (d) => d.wages) / sum(handRows, (d) => d.net) : null;
  const running = sum(books.equipment, (q) => q.running);
  const machCost = machineKg > 0 ? (sum(machRows, (d) => d.wages) + running) / machineKg : null;
  return (
    <>
      {books.equipment.map((q) => (
        <Card key={q.id} title={q.name} right={can.write && <button type="button" className="v2-link" onClick={() => edit(q)}>Edit</button>}>
          <Row left={`Bought ${fmtDate(q.date)}`} right={<span className="v2-big">{inr(q.cost)}</span>} />
          <Row left="Expected to last" right={`${q.lifeYears} years`} />
          <Row top left="Counted in profit as" sub="Spread over its life, not all in the month it was bought" right={<strong>{inr(q.perYear)} a year</strong>} />
          <Row left="Fuel, repairs and service so far" right={<Money v={q.running} />} />
          {q.due > 0.5 && <Row to={href('/pay', { type: 'bill', bill: 'q-' + q.id })} left="Not paid yet" right={<Tag><Money v={q.due} /></Tag>} />}
          {can.write && <a className="v2-link" href={href('/pay', { type: 'other', kind: 'equipment_run' })}>+ Add fuel, repair or service</a>}
        </Card>
      ))}
      {books.equipment.length === 0 && open !== 'form' && <Card><Muted>No equipment logged. Machines and tools that last several years go here; small items like bags stay as ordinary expenses.</Muted></Card>}
      {books.equipment.length > 0 && (
        <Card title="Is the machine paying for itself?">
          {machineKg > 0 && handCost != null ? (<>
            <Row left="Leaf cut with the machine" right={`${machineKg.toFixed(1)} kg`} />
            <Row left="Picking cost per kg by hand" right={`₹${handCost.toFixed(2)}`} />
            <Row top left="Picking cost per kg with the machine" sub="Wages, fuel and repairs" right={`₹${machCost.toFixed(2)}`} />
            <Row left={<strong>Saved so far</strong>} right={<strong><Money v={Math.round((handCost - machCost) * machineKg)} /></strong>} />
            {handCost > machCost && <Muted>At this rate it pays back {inr(sum(books.equipment, (q) => q.cost))} after about {Math.ceil(sum(books.equipment, (q) => q.cost) / ((handCost - machCost) * (machineKg / Math.max(1, daysBetween(machRows[0].date, today) / 30.44))))} months of use.</Muted>}
          </>) : <Muted>Tick "Cut with the machine" (under More) on harvest days when it is used. Once there are harvests with and without it, this shows the picking cost per kg both ways and how long the machine takes to pay for itself.</Muted>}
        </Card>
      )}
      {can.write && open !== 'form' && <Btn onClick={() => { setAll(blank); setOpen('form'); }}>+ Add equipment bought</Btn>}
      {open === 'form' && (
        <Card title={f.id ? 'Edit equipment' : 'Equipment bought'} hi>
          <Field label="What was bought"><Text value={f.name} onChange={(v) => set('name', v)} placeholder="Tea cutting machine" /></Field>
          <div className="v2-cols">
            <DateField label="Bought on" value={f.date} onChange={(v) => set('date', v)} />
            <Field label="Price (₹)"><Num value={f.cost} onChange={(v) => set('cost', v)} /></Field>
            <Field label="Years it should last"><Num value={f.lifeYears} onChange={(v) => set('lifeYears', v)} /></Field>
          </div>
          <Field label="Note"><Text value={f.note} onChange={(v) => set('note', v)} /></Field>
          <Check checked={f.pay.paid} onChange={(v) => set('pay', (p) => ({ ...p, paid: v }))}>Already paid</Check>
          {f.pay.paid && <PayHow value={f.pay} onChange={(v) => set('pay', (p) => ({ ...p, ...v }))} handlers={books.handlers} />}
          <div className="v2-cols"><Btn onClick={save}>Save</Btn><Btn kind="sec" onClick={() => setOpen(null)}>Cancel</Btn></div>
          {f.id && <Btn kind="danger" onClick={() => { if (window.confirm('Move this equipment and its purchase payment to the recycle bin?') && run(removeWithPayments('equipment', f.id, books), 'Moved to the recycle bin')) setOpen(null); }}>Delete</Btn>}
        </Card>
      )}
    </>
  );
}
