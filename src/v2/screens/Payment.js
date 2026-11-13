// One form for every payment, in or out. The middle part changes with who the
// payment is with; the bottom (amount, difference, how, who, when) is always
// the same.
import React, { useMemo } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Field, Num, Text, Select, Btn, Check, Muted, Chips, PayHow, back, go, useForm, href } from '../ui/kit';
import { DIFF_REASONS, KINDS, settledCash } from '../core/books';
import { paymentOps, removeEntryOps } from '../data/actions';
import { inr, num, r2, sum, fmtDate, fmtMonth, monthKey, addMonths } from '../core/util';

const TYPES = [['agent', 'Agent'], ['worker', 'Worker'], ['tenant', 'Tenant'], ['bill', 'Unpaid bill'], ['other', 'Something else']];
const OTHER_KINDS = [
  ['misc', 'Other tea expense'], ['home_expense', 'Home expense'], ['rental_expense', 'Rental property expense'],
  ['equipment_run', 'Equipment fuel or repair'], ['misc_in', 'Other income'], ['lease_deposit_return', 'Field lease deposit returned'],
];
const typeOfKind = (k) => (k === 'tea_sale' ? 'agent' : k === 'wages' || k === 'advance' ? 'worker'
  : k === 'rent' || k === 'tenant_advance' || k === 'tenant_advance_return' ? 'tenant'
    : k === 'work' || k === 'stock' || k === 'equipment' ? 'bill' : 'other');

export default function Payment({ query }) {
  const { books, today, can, run } = useData();
  const existing = query.entry ? books.entryById.get(query.entry) : null;
  const firstTenancy = books.tenancies.find((t) => t.isActive);

  const [f, set, setAll] = useForm(() => {
    if (existing) {
      return {
        ...existing, type: typeOfKind(existing.kind), amount: String(existing.amount), touched: true,
        rate: existing.rate != null ? String(existing.rate) : '', advanceRecovered: existing.advanceRecovered ? String(existing.advanceRecovered) : '',
        deliveryIds: existing.deliveryIds || [], months: existing.months || [], billId: existing.workId ? 'w-' + existing.workId : existing.stockId ? 's-' + existing.stockId : existing.equipmentId ? 'q-' + existing.equipmentId : '',
        diffReason: existing.diffReason || '', diffComment: existing.diffComment || '', note: existing.note || '',
      };
    }
    const type = query.type || 'agent';
    const tenancyId = query.tenancy || firstTenancy?.id || '';
    return {
      type, kind: query.kind || (type === 'agent' ? 'tea_sale' : type === 'worker' ? 'wages' : type === 'tenant' ? 'rent' : type === 'other' ? 'misc' : ''),
      partyId: query.party || '', tenancyId, date: today, amount: '', touched: false, rate: '', advanceRecovered: null,
      deliveryIds: null, months: null, billId: query.bill || '', mode: 'cash', by: books.handlers[0] || '',
      diffReason: '', diffComment: '', note: '', category: '', fieldId: '', propertyId: query.property || '', equipmentId: '', leaseId: '', business: 'tea', oneTime: false,
    };
  });

  const agents = books.agents.filter((a) => a.active !== false || a.id === f.partyId);
  const workers = books.workers.filter((w) => w.active !== false || w.id === f.partyId || w.due > 0.5);
  const agent = f.type === 'agent' ? books.agentById.get(f.partyId) || (f.partyId ? null : agents.find((a) => a.unratedKg > 0) || agents[0]) : null;
  const worker = f.type === 'worker' ? books.workerById.get(f.partyId) || (f.partyId ? null : workers.find((w) => w.due > 0.5) || workers[0]) : null;
  const tenancy = f.type === 'tenant' ? books.tenancyById.get(f.tenancyId) : null;
  const partyId = f.type === 'agent' ? agent?.id || '' : f.type === 'worker' ? worker?.id || '' : f.type === 'tenant' ? tenancy?.tenantId || '' : f.partyId || '';

  // ── agent: which deliveries, and the rate ────────────────────────────────
  const openDeliveries = useMemo(() => {
    if (!agent) return [];
    const mine = new Set(existing?.deliveryIds || []);
    return agent.deliveries.filter((d) => mine.has(d.id) || d.agentStatus === 'norate' || ((d.agentStatus === 'due' || d.agentStatus === 'part') && !books.entries.some((e) => e.kind === 'tea_sale' && e.id !== existing?.id && (e.deliveryIds || []).includes(d.id))));
  }, [agent, existing, books]);
  const picked = f.deliveryIds || openDeliveries.filter((d) => d.agentStatus === 'norate').map((d) => d.id);
  const pickedRows = openDeliveries.filter((d) => picked.includes(d.id));
  const pickedKg = sum(pickedRows, (d) => d.net);
  const sameRate = pickedRows.length && pickedRows.every((d) => d.rate != null && d.rate === pickedRows[0].rate) ? pickedRows[0].rate : null;
  const rate = f.rate !== '' ? num(f.rate) : sameRate || 0;

  // ── worker ───────────────────────────────────────────────────────────────
  const mineSettled = existing && existing.kind === 'wages' && existing.partyId === worker?.id ? settledCash(existing) + num(existing.advanceRecovered) : 0;
  const wageDue = worker ? r2(worker.due + mineSettled) : 0;
  const advOwed = worker ? r2(worker.advanceBalance + (existing?.kind === 'wages' && existing.partyId === worker.id ? num(existing.advanceRecovered) : 0)) : 0;
  const advDefault = worker ? Math.max(0, Math.min(num(worker.advanceStep) || 0, advOwed, wageDue)) : 0;
  const advRec = f.kind === 'wages' ? (f.advanceRecovered === null ? advDefault : num(f.advanceRecovered)) : 0;

  // ── tenant ───────────────────────────────────────────────────────────────
  const monthChoices = useMemo(() => {
    if (!tenancy) return [];
    const mine = new Set(existing?.months || []);
    const open = tenancy.months.filter((m) => mine.has(m.mk) || m.status === 'due' || m.status === 'part' || m.status === 'notyet');
    const next = monthKey(addMonths(monthKey(today) + '-01', 1));
    if (!open.some((m) => m.mk === next) && (!tenancy.end || monthKey(tenancy.end) >= next)) open.push({ mk: next, rent: tenancy.currentRent, paid: 0, status: 'notyet' });
    return open;
  }, [tenancy, existing, today]);
  const months = f.months || (tenancy && tenancy.unpaidMonths.length ? [tenancy.unpaidMonths[0].mk] : monthChoices.slice(0, 1).map((m) => m.mk));
  const rentDue = sum(monthChoices.filter((m) => months.includes(m.mk)), (m) => Math.max(0, m.rent - (existing?.months?.includes(m.mk) ? 0 : m.paid)));

  // ── bill ─────────────────────────────────────────────────────────────────
  const bills = useMemo(() => {
    const list = books.bills.slice();
    if (existing && f.billId && !list.some((b) => b.id === f.billId)) {
      const ref = existing.workId ? books.workById.get(existing.workId) : existing.stockId ? books.stockById.get(existing.stockId) : books.equipmentById.get(existing.equipmentId);
      list.push({ id: f.billId, kind: existing.kind, refId: existing.workId || existing.stockId || existing.equipmentId, label: existing.forText, date: ref?.date, due: 0 });
    }
    return list;
  }, [books, existing, f.billId]);
  const bill = bills.find((b) => b.id === f.billId) || null;

  const kind = f.type === 'agent' ? 'tea_sale' : f.type === 'bill' ? bill?.kind || '' : f.kind;
  const meta = KINDS[kind] || { dir: 'out' };
  const expected = kind === 'tea_sale' ? (pickedRows.length ? r2(pickedKg * rate) : null)
    : kind === 'wages' ? r2(wageDue - advRec)
      : kind === 'rent' ? rentDue
        : f.type === 'bill' && bill ? r2(bill.due + (existing ? settledCash(existing) : 0)) : null;
  const amountText = f.touched ? f.amount : expected != null && expected > 0 ? String(Math.round(expected)) : '';
  const amount = num(amountText);
  const diff = expected != null && amountText !== '' ? r2(amount - expected) : 0;
  const differs = Math.abs(diff) >= 1;
  const verb = meta.dir === 'in' ? 'received' : 'paid';

  const save = () => {
    const form = {
      ...f, id: existing?.id, kind, partyId, amount, expected: expected == null ? amount : expected,
      deliveryIds: kind === 'tea_sale' ? picked : undefined, rate: kind === 'tea_sale' ? rate : undefined,
      advanceRecovered: kind === 'wages' ? advRec : undefined, months: kind === 'rent' ? months : undefined,
      tenancyId: f.type === 'tenant' ? f.tenancyId : undefined, propertyId: f.type === 'tenant' ? tenancy?.propertyId : f.propertyId,
      workId: bill?.kind === 'work' ? bill.refId : undefined, stockId: bill?.kind === 'stock' ? bill.refId : undefined,
      equipmentId: bill?.kind === 'equipment' ? bill.refId : kind === 'equipment_run' ? f.equipmentId : undefined,
      leaseId: kind === 'lease_deposit_return' ? f.leaseId : undefined,
      partyName: kind === 'lease_deposit_return' ? books.leaseById.get(f.leaseId)?.lessee : f.partyName,
      business: kind === 'misc' ? 'tea' : kind === 'misc_in' ? f.business : undefined,
      fieldId: kind === 'misc' ? f.fieldId : undefined, oneTime: kind === 'misc' ? f.oneTime : undefined,
    };
    if (f.type === 'tenant' && !f.tenancyId) return run({ error: 'Choose the tenant.' });
    if (kind === 'rent' && !months.length) return run({ error: 'Tick the month this rent is for.' });
    if (f.type === 'bill' && !bill) return run({ error: 'Choose the bill.' });
    if ((kind === 'home_expense' || kind === 'rental_expense') && !f.propertyId) return run({ error: 'Choose the property.' });
    if (kind === 'lease_deposit_return' && !f.leaseId) return run({ error: 'Choose the lease.' });
    if (run(paymentOps(form, books), existing ? 'Payment updated' : 'Payment saved')) { if (existing) back('/reports/entries'); else go('/reports/entries'); }
    return null;
  };
  const remove = () => {
    if (!window.confirm('Move this payment to the recycle bin?' + (existing.kind === 'tea_sale' && (existing.deliveryIds || []).length ? '\n\nIts deliveries will go back to "rate not known".' : ''))) return;
    if (run(removeEntryOps(existing.id, books), 'Moved to the recycle bin')) back('/reports/entries');
  };
  const reset = (patch) => setAll((x) => ({ ...x, amount: '', touched: false, deliveryIds: null, months: null, advanceRecovered: null, rate: '', diffReason: '', diffComment: '', ...patch }));

  if (!can.write) return <Page title="Payment" backTo="/"><Card><Muted>You can look at payments but not change them.</Muted></Card></Page>;
  if (query.entry && !existing) return <Page title="Payment" backTo="/reports/entries"><Card><Muted>This payment is not there any more. It may be in the recycle bin.</Muted></Card></Page>;

  return (
    <Page title={existing ? 'Edit payment' : 'Record a payment'} narrow backTo="/">
      {!existing && (<>
        <div className="v2-flab">Who is it with?</div>
        <Chips label="Who is it with" options={TYPES} value={f.type} onChange={(v) => reset({ type: v, partyId: '', billId: '', kind: v === 'agent' ? 'tea_sale' : v === 'worker' ? 'wages' : v === 'tenant' ? 'rent' : v === 'other' ? 'misc' : '' })} />
      </>)}

      {f.type === 'agent' && (<>
        <Field label="Agent"><Select value={agent?.id || ''} onChange={(v) => reset({ partyId: v })} options={agents.map((a) => [a.id, a.name + (a.unratedKg > 0 ? ` · ${a.unratedKg.toFixed(1)} kg not paid` : a.balance > 0.5 ? ` · owes ${inr(a.balance)}` : '')])} placeholder={agents.length ? undefined : 'No agents yet'} /></Field>
        {agent && (
          <Card title="Which deliveries is this payment for?">
            {openDeliveries.length === 0 && <Muted>No unpaid deliveries for {agent.name}. You can still record money received; it will reduce what {agent.name} owes.</Muted>}
            {openDeliveries.map((d) => (
              <label key={d.id} className="v2-row" style={{ cursor: 'pointer' }}>
                <span className="v2-check" style={{ minHeight: 0 }}>
                  <input type="checkbox" checked={picked.includes(d.id)} onChange={(e) => set('deliveryIds', e.target.checked ? [...picked, d.id] : picked.filter((x) => x !== d.id))} />
                  <span>{fmtDate(d.date, { dow: true, year: false })} · {d.fieldName}{d.rate != null && d.rateBy !== existing?.id ? ` · ₹${d.rate}` : ''}</span>
                </span>
                <span className="v2-num">{d.net.toFixed(1)} kg</span>
              </label>
            ))}
            {pickedRows.length > 0 && (<>
              <Row left={<strong>Net kg being paid for</strong>} right={<strong>{pickedKg.toFixed(1)} kg</strong>} />
              <Field label="Rate the agent is paying (₹ per kg)"><Num big value={f.rate !== '' ? f.rate : sameRate != null ? String(sameRate) : ''} onChange={(v) => set('rate', v)} placeholder="0.00" /></Field>
              {rate > 0 && <Row left={`${pickedKg.toFixed(1)} kg × ₹${rate.toFixed(2)} should be`} right={<span className="v2-big">{inr(expected)}</span>} />}
              <Muted>Saving puts this rate on the ticked deliveries everywhere, for {agent.name} from {fmtDate(pickedRows[0].date, { year: false })} to {fmtDate(pickedRows[pickedRows.length - 1].date, { year: false })}.</Muted>
            </>)}
          </Card>
        )}
      </>)}

      {f.type === 'worker' && (<>
        <Field label="Worker"><Select value={worker?.id || ''} onChange={(v) => reset({ partyId: v })} options={workers.map((w) => [w.id, w.name + (w.due > 0.5 ? ` · ${inr(w.due)} due` : '')])} placeholder={workers.length ? undefined : 'No workers yet'} /></Field>
        {!existing && <Chips label="Kind of payment" options={[['wages', 'Pay wages'], ['advance', 'Give an advance']]} value={f.kind} onChange={(v) => reset({ kind: v })} />}
        {worker && kind === 'wages' && (
          <Card title={worker.lastPay ? `Since the last payment on ${fmtDate(worker.lastPay)}` : 'Wages'}>
            <Row left={`Earned and not yet paid${worker.unpaid.length ? ` · ${worker.unpaidDays} ${worker.unpaidDays === 1 ? 'day' : 'days'} · ${worker.unpaidKg.toFixed(1)} kg` : ''}`} right={<strong>{inr(wageDue)}</strong>} />
            {advOwed > 0 && (
              <div className="v2-row">
                <span>Advance to take back now<div className="v2-muted">Still owes {inr(advOwed)}</div></span>
                <span style={{ width: 110 }}><Num value={f.advanceRecovered === null ? String(advDefault || '') : f.advanceRecovered} onChange={(v) => set('advanceRecovered', v)} aria-label="Advance to take back now" placeholder="0" /></span>
              </div>
            )}
            <Row left={<strong>To pay</strong>} right={<span className="v2-big">{inr(expected)}</span>} />
            {wageDue < -0.5 && <Muted>{worker.name} has already been paid {inr(-wageDue)} more than earned. It will come off the next wages.</Muted>}
          </Card>
        )}
        {worker && kind === 'advance' && <Card><Muted>{worker.name} currently owes {inr(worker.advanceBalance)} in advances. An advance is not a cost: it comes back when you take it out of later wages.</Muted></Card>}
      </>)}

      {f.type === 'tenant' && (<>
        <Field label="Tenant"><Select value={f.tenancyId} onChange={(v) => reset({ tenancyId: v })} options={books.tenancies.filter((t) => t.isActive || t.id === f.tenancyId).map((t) => [t.id, `${t.tenantName} · ${t.propertyName}`])} placeholder="Choose" /></Field>
        {!existing && <Chips label="Kind of payment" options={[['rent', 'Rent'], ['tenant_advance', 'Advance received'], ['tenant_advance_return', 'Advance returned']]} value={f.kind} onChange={(v) => reset({ kind: v })} />}
        {tenancy && kind === 'rent' && (
          <Card title="Which months?">
            {monthChoices.map((m) => (
              <label key={m.mk} className="v2-row" style={{ cursor: 'pointer' }}>
                <span className="v2-check" style={{ minHeight: 0 }}><input type="checkbox" checked={months.includes(m.mk)} onChange={(e) => set('months', e.target.checked ? [...months, m.mk].sort() : months.filter((x) => x !== m.mk))} /><span>{fmtMonth(m.mk)}{m.status === 'part' ? ` · ${inr(m.paid)} already paid` : ''}</span></span>
                <span className="v2-num">{inr(m.rent)}</span>
              </label>
            ))}
            <Row left={<strong>Rent for these months</strong>} right={<span className="v2-big">{inr(rentDue)}</span>} />
          </Card>
        )}
        {tenancy && kind !== 'rent' && <Card><Muted>Advance held for {tenancy.tenantName}: {inr(tenancy.advanceHeld)}. It is money you must give back, so it is not counted as income.</Muted></Card>}
      </>)}

      {f.type === 'bill' && (
        <Card title="Which bill?">
          {bills.length === 0 && <Muted>No unpaid bills. Field work, manure and equipment are normally marked as paid when you enter them.</Muted>}
          {bills.map((b) => (
            <label key={b.id} className={'v2-opt' + (f.billId === b.id ? ' on' : '')}>
              <input type="radio" name="bill" checked={f.billId === b.id} onChange={() => reset({ billId: b.id })} />
              <span style={{ flex: 1 }}><strong>{b.label}</strong><div className="v2-muted">{fmtDate(b.date)}</div></span>
              <span className="v2-num">{inr(b.due)}</span>
            </label>
          ))}
        </Card>
      )}

      {f.type === 'other' && (<>
        {!existing && <Field label="What is it?"><Select value={f.kind} onChange={(v) => reset({ kind: v })} options={OTHER_KINDS} /></Field>}
        <Card>
          {(kind === 'home_expense' || kind === 'rental_expense') && <Field label="Property"><Select value={f.propertyId} onChange={(v) => set('propertyId', v)} options={books.properties.filter((p) => p.kind === (kind === 'home_expense' ? 'home' : 'rental')).map((p) => [p.id, p.name])} placeholder="Choose" /></Field>}
          {kind === 'equipment_run' && <Field label="Equipment"><Select value={f.equipmentId} onChange={(v) => set('equipmentId', v)} options={books.equipment.map((q) => [q.id, q.name])} placeholder="Choose" /></Field>}
          {kind === 'lease_deposit_return' && <Field label="Lease"><Select value={f.leaseId} onChange={(v) => set('leaseId', v)} options={books.leases.filter((l) => l.kind === 'deposit').map((l) => [l.id, `${l.fieldName} · ${l.lessee} · ${inr(l.toReturn)} to return`])} placeholder="Choose" /></Field>}
          {kind === 'misc_in' && <Field label="Belongs to"><Select value={f.business} onChange={(v) => set('business', v)} options={[['tea', 'Tea'], ['rental', 'Rentals'], ['home', 'Home']]} /></Field>}
          {kind !== 'lease_deposit_return' && <Field label="What for" hint={kind === 'home_expense' ? 'For example: Plumbing, Painting, Electrical' : kind === 'misc' ? 'For example: Transport, Bags, Tools' : undefined}><Text value={f.category} onChange={(v) => set('category', v)} /></Field>}
          {kind === 'misc' && <Field label="Field, if it was for one"><Select value={f.fieldId} onChange={(v) => set('fieldId', v)} options={books.fields.map((x) => [x.id, x.name])} placeholder="Not for one field" /></Field>}
          {kind === 'misc' && <Check checked={f.oneTime} onChange={(v) => set('oneTime', v)}>One-time cost, not routine</Check>}
          {(kind === 'misc' || kind === 'misc_in') && <Field label="Paid to / received from (optional)"><Text value={f.partyName} onChange={(v) => set('partyName', v)} /></Field>}
        </Card>
      </>)}

      <Card>
        <Field label={`Amount actually ${verb} (₹)`}><Num big value={amountText} onChange={(v) => { set('amount', v); set('touched', true); }} placeholder="0" /></Field>
        {expected != null && amountText !== '' && differs && (<>
          <Row left="Difference" right={<Tag>{inr(Math.abs(diff))} {diff > 0 ? (meta.dir === 'in' ? 'extra' : 'paid extra') : 'short'}</Tag>} />
          <div className="v2-flab">Why is it different?</div>
          <Chips label="Reason for the difference" options={DIFF_REASONS} value={f.diffReason} onChange={(v) => set('diffReason', v)} />
          {f.diffReason === 'later' && <Muted>{diff < 0 ? `The ${inr(-diff)} stays owed` : `The extra ${inr(diff)} is carried forward`} and is settled with the next payment.</Muted>}
          {f.diffReason && f.diffReason !== 'later' && <Muted>This closes the difference. Nothing is carried forward.</Muted>}
          <Field label="Comment on the difference"><Text value={f.diffComment} onChange={(v) => set('diffComment', v)} /></Field>
        </>)}
      </Card>

      <Card>
        <PayHow value={{ mode: f.mode, by: f.by, date: f.date }} onChange={(v) => setAll((x) => ({ ...x, ...v }))} handlers={books.handlers} verb={verb} />
        <Field label="Note (optional)"><Text value={f.note} onChange={(v) => set('note', v)} /></Field>
      </Card>

      <Btn block onClick={save}>{existing ? 'Save changes' : 'Save payment'}</Btn>
      {existing && <Btn kind="danger" block onClick={remove}>Delete this payment</Btn>}
      {existing && <Muted>{existing.imported || existing.wasImported ? 'Brought in from the old app. ' : ''}{existing.updatedAt ? `Last changed ${fmtDate(String(existing.updatedAt).slice(0, 10))}${existing.updatedBy ? ' by ' + existing.updatedBy : ''}. ` : ''}Earlier versions are kept in <a href={href('/settings/history')}>History of changes</a>.</Muted>}
    </Page>
  );
}
