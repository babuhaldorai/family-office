// Manure: buying several types at once, mixing them, and applying the bags
// to one or more fields in a day.
import React, { useMemo } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Field, Num, Text, Select, DateField, Btn, Check, Muted, PayHow, back, useForm, href } from '../ui/kit';
import { purchaseOps, mixOps, applyOps, removeWithPayments } from '../data/actions';
import { inr, num, r2, sum, fmtDate } from '../core/util';

const noEdit = (title, backTo) => <Page title={title} backTo={backTo}><Card><Muted>You can look but not change.</Muted></Card></Page>;
const payOf = (books, id, fallbackDate) => {
  const p = books.entryById.get('pay-' + id);
  return { paid: !!p, mode: p?.mode || 'cash', by: p?.by || books.handlers[0], date: p?.date || fallbackDate, to: p?.partyName || '' };
};

// ── Buying ──────────────────────────────────────────────────────────────────
export function PurchaseForm({ id }) {
  const { books, today, can, run } = useData();
  const first = id ? books.stock.find((s) => s.id === id && s.kind !== 'mix') : null;
  const groupId = first ? first.groupId || first.id : null;
  const lines0 = first ? books.stock.filter((s) => s.kind !== 'mix' && (s.groupId ? s.groupId === groupId : s.id === first.id)) : [];
  const [f, set] = useForm(() => first ? {
    groupId, date: first.date, vendor: first.vendor || first.vendorName || '', vendorId: first.vendorId || '', note: first.note || '',
    transport: String(r2(sum(lines0, (l) => num(l.transport))) || ''),
    lines: lines0.map((l) => ({ id: l.id, name: l.name, bags: String(l.bags), costPerBag: String(l.costPerBag ?? '') })),
    pay: { ...payOf(books, groupId, first.date), paid: !!books.entryById.get('pay-' + groupId) || sum(lines0, (l) => l.due) < 0.5 },
  } : { date: today, vendor: '', vendorId: '', note: '', transport: '', lines: [{ name: '', bags: '', costPerBag: '' }], pay: { paid: true, mode: 'cash', by: books.handlers[0], date: today } });
  const setLine = (i, patch) => set('lines', (l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const totalBags = sum(f.lines, (l) => num(l.bags));
  const goods = sum(f.lines, (l) => num(l.bags) * num(l.costPerBag));
  const total = r2(goods + num(f.transport));
  const known = [...new Set(books.stock.filter((s) => s.kind !== 'mix').map((s) => s.name))];
  if (!can.write) return noEdit('Manure purchase', '/tea/fields');
  if (id && !first) return <Page title="Manure purchase" backTo="/tea/fields"><Card><Muted>This purchase is not there any more.</Muted></Card></Page>;
  const save = () => { if (run(purchaseOps({ ...f, pay: { ...f.pay, date: f.pay.date || f.date } }, books), 'Purchase saved')) back('/tea/fields'); };
  return (
    <Page title={first ? 'Edit manure purchase' : 'Manure bought'} narrow backTo="/tea/fields">
      <Card>
        <div className="v2-cols"><DateField label="Bought on" value={f.date} onChange={(v) => { set('date', v); set('pay', (p) => ({ ...p, date: v })); }} /><Field label="Shop"><Text value={f.vendor} onChange={(v) => set('vendor', v)} /></Field></div>
      </Card>
      <Card title="What was bought">
        <datalist id="manure-types">{known.map((k) => <option key={k} value={k} />)}</datalist>
        {f.lines.map((l, i) => (
          <div key={i} className="v2-stack" style={{ gap: 6, borderTop: i ? '1px solid var(--line2)' : 0, paddingTop: i ? 8 : 0 }}>
            <div className="v2-cols" style={{ alignItems: 'flex-end' }}>
              <Field label="Type"><input className="v2-inp" list="manure-types" aria-label={`Line ${i + 1} type`} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="NPK, Urea, Dolomite…" /></Field>
              {f.lines.length > 1 && <button type="button" className="v2-x" style={{ flex: 'none' }} aria-label={`Remove line ${i + 1}`} onClick={() => set('lines', (x) => x.filter((_, j) => j !== i))}>×</button>}
            </div>
            <div className="v2-cols">
              <Field label="Bags"><Num aria-label={`Line ${i + 1} bags`} value={l.bags} onChange={(v) => setLine(i, { bags: v })} /></Field>
              <Field label="₹ per bag"><Num aria-label={`Line ${i + 1} price per bag`} value={l.costPerBag} onChange={(v) => setLine(i, { costPerBag: v })} /></Field>
            </div>
            {num(l.bags) > 0 && <Muted>{inr(num(l.bags) * num(l.costPerBag))}{num(f.transport) && totalBags ? ` + ${inr((num(f.transport) * num(l.bags)) / totalBags)} transport = ${inr(num(l.costPerBag) + num(f.transport) / totalBags)} a bag delivered` : ''}</Muted>}
          </div>
        ))}
        <button type="button" className="v2-link" onClick={() => set('lines', (x) => [...x, { name: '', bags: '', costPerBag: '' }])}>+ Another type</button>
      </Card>
      <Card>
        <Field label="Vehicle rent or transport for the whole load (₹)" hint="Shared between the types by number of bags."><Num value={f.transport} onChange={(v) => set('transport', v)} placeholder="0" /></Field>
        <Row left={`${totalBags} bags · ${inr(goods)} + ${inr(num(f.transport))} transport`} right={<span className="v2-big">{inr(total)}</span>} />
        <Check checked={f.pay.paid} onChange={(v) => set('pay', (p) => ({ ...p, paid: v }))}>Already paid</Check>
        {f.pay.paid && <PayHow value={f.pay} onChange={(v) => set('pay', (p) => ({ ...p, ...v }))} handlers={books.handlers} />}
      </Card>
      <Field label="Note"><Text value={f.note} onChange={(v) => set('note', v)} /></Field>
      <Btn block onClick={save}>Save purchase</Btn>
      {first && <Btn kind="danger" block onClick={() => { if (window.confirm('Move this purchase (all its lines) and its payment to the recycle bin?') && run(removeWithPayments('stock', first.id, books), 'Moved to the recycle bin')) back('/tea/fields'); }}>Delete</Btn>}
    </Page>
  );
}

// ── Mixing ──────────────────────────────────────────────────────────────────
export function MixForm({ id }) {
  const { books, today, can, run } = useData();
  const old = id ? books.stock.find((s) => s.id === id && s.kind === 'mix') : null;
  const [f, set] = useForm(() => old ? {
    id: old.id, date: old.date, name: old.name, bags: String(old.bags), note: old.note || '', inputs: old.inputs.map((it) => ({ stockId: it.stockId, qty: String(it.qty) })),
  } : { date: today, name: '', bags: '', note: '', inputs: [{ stockId: '', qty: '' }, { stockId: '', qty: '' }] });
  const raw = books.stock.filter((s) => s.kind !== 'mix' && (s.left > 0 || f.inputs.some((it) => it.stockId === s.id)));
  const setIn = (i, patch) => set('inputs', (l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const used = f.inputs.filter((it) => it.stockId && num(it.qty) > 0);
  const inBags = sum(used, (it) => num(it.qty));
  const value = sum(used, (it) => num(it.qty) * (books.stockById.get(it.stockId)?.unitCost || 0));
  const smallest = used.length ? Math.min(...used.map((it) => num(it.qty))) : 0;
  if (!can.write) return noEdit('Mix', '/tea/fields');
  if (id && !old) return <Page title="Mix" backTo="/tea/fields"><Card><Muted>This mix is not there any more.</Muted></Card></Page>;
  const save = () => { if (run(mixOps(f, books), 'Mix saved')) back('/tea/fields'); };
  return (
    <Page title={old ? 'Edit mix' : 'Mix manure'} narrow backTo="/tea/fields">
      <Muted>When types are mixed and filled back into bags, log it here. The mixed bags can then be applied to fields like any other manure, and each field is charged for what was in them.</Muted>
      <Card>
        <DateField label="Mixed on" value={f.date} onChange={(v) => set('date', v)} />
      </Card>
      <Card title="What went in">
        {raw.length === 0 && <Muted>No bought manure is left. <a href={href('/stock')}>Log a purchase first</a>.</Muted>}
        {f.inputs.map((it, i) => (
          <div key={i} className="v2-cols" style={{ alignItems: 'flex-end' }}>
            <Field label="From"><Select aria-label={`Mix line ${i + 1} from`} value={it.stockId} onChange={(v) => setIn(i, { stockId: v })} options={raw.map((s) => [s.id, `${s.name} · ${fmtDate(s.date, { year: false })} · ${s.left} left`])} placeholder="Choose" /></Field>
            <Field label="Bags" style={{ flex: '0 1 90px' }}><Num aria-label={`Mix line ${i + 1} bags`} value={it.qty} onChange={(v) => setIn(i, { qty: v })} /></Field>
            {f.inputs.length > 1 && <button type="button" className="v2-x" style={{ flex: 'none' }} aria-label={`Remove mix line ${i + 1}`} onClick={() => set('inputs', (l) => l.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
        <button type="button" className="v2-link" onClick={() => set('inputs', (l) => [...l, { stockId: '', qty: '' }])}>+ Another type</button>
        {used.length > 1 && (
          <Row left="Mix ratio" right={<strong>{used.map((it) => `${books.stockById.get(it.stockId)?.name} ${smallest ? r2(num(it.qty) / smallest) : ''}`).join(' : ')}</strong>} />
        )}
        {used.length > 0 && <Muted>{used.map((it) => `${books.stockById.get(it.stockId)?.name} ${Math.round((num(it.qty) / inBags) * 100)}%`).join(' · ')}</Muted>}
      </Card>
      <Card>
        <Field label="Filled back into how many bags?" hint={inBags ? `${inBags} bags went in.` : undefined}><Num big value={f.bags} onChange={(v) => set('bags', v)} placeholder={inBags ? String(inBags) : '0'} /></Field>
        {num(f.bags) > 0 && <Row left="Value of each mixed bag" right={<strong>{inr(value / num(f.bags))}</strong>} />}
        <Field label="Name (optional)"><Text value={f.name} onChange={(v) => set('name', v)} placeholder="Mix of …" /></Field>
        <Field label="Note"><Text value={f.note} onChange={(v) => set('note', v)} /></Field>
      </Card>
      <Btn block onClick={save}>Save mix</Btn>
      {old && <Btn kind="danger" block onClick={() => { if (old.used > 0) { run({ error: `${old.used} bags of this mix are applied to fields. Remove those first.` }); return; } if (window.confirm('Delete this mix? The bags go back to what was bought.')) { run({ ops: [{ col: 'stock', id: old.id, remove: true }] }, 'Moved to the recycle bin'); back('/tea/fields'); } }}>Delete</Btn>}
    </Page>
  );
}

// ── Applying, to one or more fields in a day ────────────────────────────────
export function ApplyForm({ groupId, query }) {
  const { books, today, can, run } = useData();
  const before = useMemo(() => (groupId ? books.work.filter((w) => w.groupId === groupId) : []), [groupId, books]);
  const usable = (extra = []) => books.stock.filter((s) => s.left > 0 || extra.includes(s.id));
  const firstStock = usable()[0];
  const [f, set] = useForm(() => before.length ? {
    groupId, date: before[0].date, rate: String(before[0].rate || ''), comment: before[0].comment || '',
    lines: before.map((w) => ({ id: w.id, fieldId: w.fieldId, stockId: w.items[0]?.stockId || '', bags: String(w.bags || w.bagsApplied || '') })),
    pay: payOf(books, groupId, before[0].date),
  } : {
    date: today, rate: String(books.work.filter((w) => w.type === 'manure' && w.labourMode === 'bag' && num(w.rate) > 0).slice(-1)[0]?.rate || ''), comment: '',
    lines: [{ fieldId: query.field || '', stockId: firstStock?.id || '', bags: '' }],
    pay: { paid: true, mode: 'cash', by: books.handlers[0], date: today, to: '' },
  });
  const fields = books.fields.filter((x) => !books.activeLeaseOn(x.id, f.date) || f.lines.some((l) => l.fieldId === x.id));
  const stockOpts = usable(f.lines.map((l) => l.stockId));
  const setLine = (i, patch) => set('lines', (l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const bags = sum(f.lines, (l) => num(l.bags));
  const labour = r2(bags * num(f.rate));
  const manureValue = sum(f.lines, (l) => num(l.bags) * (books.stockById.get(l.stockId)?.unitCost || 0));
  const left = useMemo(() => {
    const m = new Map();
    f.lines.forEach((l) => { if (!l.stockId) return; const st = books.stock.find((s) => s.id === l.stockId); const had = sum(before.flatMap((w) => w.items.filter((it) => it.stockId === l.stockId)), (it) => it.qty); m.set(l.stockId, r2((st ? st.left : 0) + had - sum(f.lines.filter((x) => x.stockId === l.stockId), (x) => num(x.bags)))); });
    return m;
  }, [f.lines, books, before]);
  if (!can.harvest) return noEdit('Apply manure', '/tea/fields');
  if (groupId && !before.length) return <Page title="Apply manure" backTo="/tea/fields"><Card><Muted>This application is not there any more.</Muted></Card></Page>;
  const save = () => { if (run(applyOps({ ...f, pay: can.money ? { ...f.pay, date: f.pay.date || f.date } : null }, books), 'Saved')) back('/tea/fields'); };
  return (
    <Page title={before.length ? 'Edit manure applied' : 'Apply manure'} narrow backTo="/tea/fields">
      <Card>
        <div className="v2-cols">
          <DateField label="Applied on" value={f.date} onChange={(v) => { set('date', v); set('pay', (p) => ({ ...p, date: v })); }} />
          <Field label="₹ per bag to apply"><Num value={f.rate} onChange={(v) => set('rate', v)} placeholder="200" /></Field>
        </div>
      </Card>
      <Card title="Where it went">
        {stockOpts.length === 0 && <Muted>No manure is in stock. <a href={href('/stock')}>Log a purchase</a> or <a href={href('/mix')}>a mix</a> first.</Muted>}
        {f.lines.map((l, i) => (
          <div key={i} className="v2-stack" style={{ gap: 6, borderTop: i ? '1px solid var(--line2)' : 0, paddingTop: i ? 8 : 0 }}>
            <div className="v2-cols" style={{ alignItems: 'flex-end' }}>
              <Field label="Field"><Select aria-label={`Line ${i + 1} field`} value={l.fieldId} onChange={(v) => setLine(i, { fieldId: v })} options={fields.map((x) => [x.id, x.name])} placeholder="Choose" /></Field>
              <Field label="Bags" style={{ flex: '0 1 90px' }}><Num aria-label={`Line ${i + 1} bags applied`} value={l.bags} onChange={(v) => setLine(i, { bags: v })} /></Field>
              {f.lines.length > 1 && <button type="button" className="v2-x" style={{ flex: 'none' }} aria-label={`Remove line ${i + 1}`} onClick={() => set('lines', (x) => x.filter((_, j) => j !== i))}>×</button>}
            </div>
            <Select aria-label={`Line ${i + 1} manure`} value={l.stockId} onChange={(v) => setLine(i, { stockId: v })} options={stockOpts.map((s) => [s.id, `${s.kind === 'mix' ? 'Mix: ' : ''}${s.name} · ${s.left} left`])} placeholder="Which manure or mix?" />
            {l.stockId && left.get(l.stockId) < 0 && <div className="v2-tag r" style={{ whiteSpace: 'normal' }}>That is {-left.get(l.stockId)} bags more than are left.</div>}
          </div>
        ))}
        <button type="button" className="v2-link" onClick={() => set('lines', (x) => [...x, { fieldId: '', stockId: x[x.length - 1]?.stockId || '', bags: '' }])}>+ Another field</button>
      </Card>
      <Card>
        <Row left={`${bags} bags × ${inr(num(f.rate))} to apply`} right={<span className="v2-big">{inr(labour)}</span>} />
        {can.money && manureValue > 0 && <Row left="Plus manure from stock, already paid" right={inr(manureValue)} />}
        {can.money && (<>
          <Check checked={f.pay.paid} onChange={(v) => set('pay', (p) => ({ ...p, paid: v }))}>Applying already paid</Check>
          {f.pay.paid && <PayHow value={f.pay} onChange={(v) => set('pay', (p) => ({ ...p, ...v }))} handlers={books.handlers} />}
          {f.pay.paid && <Field label="Paid to (optional)"><Text value={f.pay.to} onChange={(v) => set('pay', (p) => ({ ...p, to: v }))} placeholder="Names of the workers" /></Field>}
        </>)}
      </Card>
      <Field label="Comment"><Text value={f.comment} onChange={(v) => set('comment', v)} /></Field>
      <Btn block onClick={save}>Save</Btn>
      {before.length > 0 && <Btn kind="danger" block onClick={() => { if (window.confirm(`Delete this day's manuring on ${before.length} ${before.length === 1 ? 'field' : 'fields'}, and its payment?`) && run(removeWithPayments('work', before[0].id, books), 'Moved to the recycle bin')) back('/tea/fields'); }}>Delete</Btn>}
    </Page>
  );
}
