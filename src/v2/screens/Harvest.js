import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Field, Num, Text, Select, DateField, Btn, Check, Muted, Chips, go, back, useForm } from '../ui/kit';
import { computeDelivery, kgRateFor, MODES, agentForField } from '../core/books';
import { deliveryOps, removeDeliveryOps } from '../data/actions';
import { rainRecord } from '../data/weather';
import { inr, num, sum, addDays, fmtDate, r2 } from '../core/util';

// The form is laid out like the paper slip: one block per worker with their
// bag weights and, right underneath, the deduction for that worker.
const blankGroup = (workerId = '') => ({ workerId, bags: [''], dWater: '', dBags: '', dOther: '', dNote: '' });
const str = (n) => (n ? String(r2(n)) : '');
// kg deducted for one worker: water + bags + anything else
const gDed = (g) => r2(num(g.dWater) + num(g.dBags) + num(g.dOther));

function groupsFrom(existing) {
  const order = [];
  const by = new Map();
  existing.bags.forEach((b) => { if (!by.has(b.workerId)) { by.set(b.workerId, []); order.push(b.workerId); } by.get(b.workerId).push(String(b.kg)); });
  const own = existing.dedByWorker ? existing.dedBy : null;
  return order.map((wid) => {
    const base = { workerId: wid, bags: by.get(wid), dWater: '', dBags: '', dOther: '', dNote: '' };
    const det = existing.dedDetail && existing.dedDetail[wid];
    if (det) return { ...base, dWater: str(det.water), dBags: str(det.bags), dOther: str(det.other), dNote: det.note || '' };
    // one worker: the delivery's own split is that worker's split
    if (order.length === 1) return { ...base, dWater: str(existing.waterDed), dBags: str(existing.bagDed), dOther: str(existing.otherDed), dNote: existing.dedNote || '' };
    // saved before the split existed: only the worker's total is known, so
    // water is taken in the delivery's own proportion and the rest shown as bags
    if (own) { const water = existing.ded > 0 ? r2((num(own[wid]) * existing.waterDed) / existing.ded) : 0; return { ...base, dWater: str(water), dBags: str(num(own[wid]) - water) }; }
    return base;
  });
}

export default function Harvest({ id, query }) {
  const { books, today, can, run, say, demo } = useData();
  const existing = id ? books.deliveryById.get(id) : null;
  const workers = books.people.filter((p) => p.kind === 'worker' && (p.active !== false || (existing && existing.workers.some((w) => w.workerId === p.id))));
  const agents = books.people.filter((p) => p.kind === 'agent' && (p.active !== false || existing?.agentId === p.id));
  const fields = books.fields;
  const last = books.deliveries[books.deliveries.length - 1];
  // new harvests start the way the last one was entered
  const lastPerWorker = !last || last.dedByWorker || last.workers.filter((w) => w.grossKg > 0).length <= 1;

  const [f, set, setAll] = useForm(() => existing ? {
    id: existing.id, date: existing.date, fieldId: existing.fieldId, agentId: existing.agentId,
    groups: groupsFrom(existing),
    dedMode: existing.dedByWorker || existing.workers.filter((w) => w.grossKg > 0).length <= 1 ? 'worker' : 'whole',
    bagDed: existing.bagDed ? String(existing.bagDed) : '', waterDed: existing.waterDed ? String(existing.waterDed) : '',
    otherDed: existing.otherDed ? String(existing.otherDed) : '', dedNote: existing.dedNote || '',
    rainMm: existing.rainMm != null ? String(existing.rainMm) : '', rainSource: 'entered',
    rate: existing.rate != null ? String(existing.rate) : '', dayWork: (existing.dayWork || []).map((w) => ({ ...w, days: String(w.days), dayRate: String(w.dayRate) })),
    machine: !!existing.machine, note: existing.note || '', slipPath: existing.slipPath || '',
    extras: books.entries.filter((e) => e.deliveryId === existing.id && e.kind === 'misc').map((e) => ({ id: e.id, category: e.category, amount: String(e.amount), mode: e.mode, by: e.by })),
  } : {
    date: query.date || today, fieldId: last?.fieldId || fields[0]?.id || '',
    agentId: agentForField(books.fieldById.get(last?.fieldId || fields[0]?.id), query.date || today) || last?.agentId || agents[0]?.id || '',
    groups: [blankGroup(workers[0]?.id)], dedMode: lastPerWorker ? 'worker' : 'whole', bagDed: '', waterDed: '', otherDed: '', dedNote: '',
    rainMm: '', rainSource: '', rate: '', dayWork: [], machine: false, note: '', slipPath: '', extras: [],
  });
  const [more, setMore] = useState(!!(existing && (existing.rate != null || existing.note || existing.machine)));
  // the field's usual agent is filled in until the agent is chosen by hand
  const [agentTouched, setAgentTouched] = useState(!!existing);
  const usualAgent = agentForField(books.fieldById.get(f.fieldId), f.date);
  useEffect(() => { if (!agentTouched && usualAgent && usualAgent !== f.agentId) set('agentId', usualAgent); }, [usualAgent, agentTouched]); // eslint-disable-line react-hooks/exhaustive-deps
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  const refs = useRef({});
  const focusNext = useRef(null);
  useEffect(() => { if (focusNext.current) { refs.current[focusNext.current]?.focus(); focusNext.current = null; } });

  // rain: use what is already recorded for the day, else ask the weather record
  const field = books.fieldById.get(f.fieldId);
  const stored = books.rainByDate.get(f.date);
  const [rainNote, setRainNote] = useState('');
  useEffect(() => {
    if (f.rainSource === 'typed' || (existing && f.date === existing.date && existing.rainMm != null)) return undefined;
    if (stored && stored.mm != null) { set('rainMm', String(stored.mm)); set('rainSource', stored.source || 'entered'); setRainNote('Rain already recorded for this day.'); return undefined; }
    set('rainMm', ''); setRainNote('');
    if (!field || field.lat == null || field.lat === '' || !f.date || f.date > today) return undefined;
    let dead = false;
    rainRecord(field.lat, field.lon, addDays(f.date, -6), f.date, today).then((days) => {
      if (dead) return;
      const day = days.find((d) => d.date === f.date);
      if (!day) return;
      set('rainMm', String(day.mm)); set('rainSource', 'weather record');
      setRainNote(`Filled in from the weather record for ${field.place || field.name}. The 7 days to this date: ${Math.round(sum(days, (d) => d.mm))} mm. Change it if it is wrong.`);
    }).catch(() => { if (!dead) setRainNote('Could not reach the weather record. Type the rain if you know it.'); });
    return () => { dead = true; };
  }, [f.date, f.fieldId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── what the form means, in the shape the books use ──────────────────────
  const shaped = useMemo(() => {
    const bags = f.groups.flatMap((g) => g.bags.filter((kg) => num(kg) > 0).map((kg) => ({ kg: num(kg), workerId: g.workerId })));
    const pickers = [...new Set(f.groups.filter((g) => g.bags.some((kg) => num(kg) > 0)).map((g) => g.workerId))];
    if (f.dedMode === 'whole') return { bags, pickers, bagDed: num(f.bagDed), waterDed: num(f.waterDed), otherDed: num(f.otherDed), dedNote: num(f.otherDed) > 0 ? f.dedNote : '', dedBy: null, dedDetail: null };
    const own = {};
    const detail = {};
    const live = f.groups.filter((g) => g.workerId && g.bags.some((kg) => num(kg) > 0));
    live.forEach((g) => {
      own[g.workerId] = r2((own[g.workerId] || 0) + gDed(g));
      const d = detail[g.workerId] || { water: 0, bags: 0, other: 0, note: '' };
      detail[g.workerId] = { water: r2(d.water + num(g.dWater)), bags: r2(d.bags + num(g.dBags)), other: r2(d.other + num(g.dOther)), note: [d.note, num(g.dOther) > 0 ? g.dNote : ''].filter(Boolean).join('; ') };
    });
    const notes = live.filter((g) => num(g.dOther) > 0 && g.dNote).map((g) => `${books.nameOf(g.workerId)}: ${g.dNote}`).join('; ');
    return {
      bags, pickers, bagDed: r2(live.reduce((t, g) => t + num(g.dBags), 0)), waterDed: r2(live.reduce((t, g) => t + num(g.dWater), 0)),
      otherDed: r2(live.reduce((t, g) => t + num(g.dOther), 0)), dedNote: notes, dedBy: pickers.length > 1 ? own : null, dedDetail: detail,
    };
  }, [f.groups, f.dedMode, f.bagDed, f.waterDed, f.otherDed, f.dedNote, books]);

  const preview = useMemo(() => {
    const dayWork = f.dayWork.filter((w) => w.workerId && num(w.days) > 0);
    const kgRates = {};
    shaped.pickers.forEach((wid) => { if (wid) kgRates[wid] = dayWork.some((w) => w.workerId === wid) ? 0 : existing?.kgRates?.[wid] ?? kgRateFor(books.personById.get(wid)); });
    return computeDelivery({ bags: shaped.bags, bagDed: shaped.bagDed, waterDed: shaped.waterDed, otherDed: shaped.otherDed, dedBy: shaped.dedBy, rate: f.rate, kgRates, dayWork }, books.personById);
  }, [shaped, f.dayWork, f.rate, books, existing]);
  const wageOf = (wid) => preview.workers.find((w) => w.workerId === wid);

  const setGroup = (gi, patch) => set('groups', (gs) => gs.map((g, j) => (j === gi ? { ...g, ...(typeof patch === 'function' ? patch(g) : patch) } : g)));
  const setBag = (gi, bi, v) => setGroup(gi, (g) => ({ bags: g.bags.map((x, j) => (j === bi ? v : x)) }));
  const addBag = (gi) => { focusNext.current = `${gi}-${f.groups[gi].bags.length}`; setGroup(gi, (g) => ({ bags: [...g.bags, ''] })); };
  const onKey = (e, gi, bi) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (bi < f.groups[gi].bags.length - 1) refs.current[`${gi}-${bi + 1}`]?.focus(); else addBag(gi);
  };
  const addWorker = () => {
    const used = new Set(f.groups.map((g) => g.workerId));
    const next = workers.find((w) => !used.has(w.id));
    focusNext.current = `${f.groups.length}-0`;
    set('groups', (gs) => [...gs, blankGroup(next ? next.id : '')]);
  };

  // ── photo of the slip, kept for reference only ───────────────────────────
  const onPhoto = async (file) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const svc = await import('../data/slipService');
      const path = await svc.keepPhoto(await svc.shrink(file), f.date);
      set('slipPath', path);
      say(existing ? 'Photo attached. Press Save changes to keep it.' : 'Photo attached');
    } catch (e) { const svc = await import('../data/slipService'); say('The photo could not be stored: ' + svc.photoError(e), true); }
    setPhotoBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const viewPhoto = async () => {
    try { const svc = await import('../data/slipService'); window.open(await svc.photoUrl(f.slipPath), '_blank', 'noopener'); }
    catch (e) { say('The photo could not be opened: ' + (e.code || e.message), true); }
  };

  const lease = f.fieldId && f.date ? books.activeLeaseOn(f.fieldId, f.date) : null;
  const linked = existing ? books.entries.find((e) => e.kind === 'tea_sale' && (e.deliveryIds || []).includes(existing.id)) : null;
  const perWorker = f.dedMode === 'worker';
  // a worker block with bags but no deduction typed, in per-worker mode: easy to forget
  const missingDed = perWorker && f.groups.filter((g) => g.bags.some((kg) => num(kg) > 0) && g.dWater === '' && g.dBags === '' && g.dOther === '');

  const save = () => {
    if (f.groups.some((g) => g.bags.some((kg) => num(kg) > 0) && !g.workerId)) { say('Choose who picked each set of bags.', true); return; }
    if (missingDed && missingDed.length && !window.confirm(`No deduction is entered for ${missingDed.map((g) => books.nameOf(g.workerId) || 'a worker').join(' and ')}.\n\nSave with no deduction?`)) return;
    const noNote = perWorker ? f.groups.find((g) => num(g.dOther) > 0 && !g.dNote.trim()) : (num(f.otherDed) > 0 && !f.dedNote.trim());
    if (noNote) { say('Say what the "other" deduction was for.', true); return; }
    const res = deliveryOps({ ...f, bags: shaped.bags, bagDed: shaped.bagDed, waterDed: shaped.waterDed, otherDed: shaped.otherDed, dedNote: shaped.dedNote, dedBy: shaped.dedBy, dedDetail: shaped.dedDetail }, books);
    if (res.warn && !window.confirm(res.warn + '\n\nSave anyway?')) return;
    if (run(res, existing ? 'Harvest updated' : 'Harvest saved')) { if (existing) back('/tea'); else go('/tea'); }
  };
  const remove = () => {
    if (!window.confirm('Move this harvest to the recycle bin?')) return;
    if (run(removeDeliveryOps(existing.id, books), 'Moved to the recycle bin')) back('/tea');
  };

  if (!can.harvest) return <Page title="Harvest day" backTo="/"><Card><Muted>You can look at harvests but not change them.</Muted></Card></Page>;
  if (id && !existing) return <Page title="Harvest day" backTo="/tea"><Card><Muted>This harvest is not there any more. It may be in the recycle bin.</Muted></Card></Page>;
  if (!fields.length || !agents.length || !workers.length) {
    return (<Page title="Harvest day" backTo="/" narrow><Card><div>Before the first harvest, add at least one field, one worker and one agent.</div><a className="v2-btn" href="#/settings/lists">Add them now</a></Card></Page>);
  }

  return (
    <Page title={existing ? 'Edit harvest' : 'Harvest day'} narrow backTo="/tea">
      <div className="v2-cols">
        <DateField value={f.date} onChange={(v) => set('date', v)} max={today} />
        <Field label="Rain that day (mm)"><Num value={f.rainMm} onChange={(v) => { set('rainMm', v); set('rainSource', 'typed'); }} placeholder="0" /></Field>
      </div>
      {rainNote && <Muted>{rainNote}</Muted>}
      <div className="v2-cols">
        <Field label="Field"><Select value={f.fieldId} onChange={(v) => set('fieldId', v)} options={fields.map((x) => [x.id, x.name])} /></Field>
        <Field label="Agent" hint={usualAgent && usualAgent === f.agentId ? 'Usual agent for this field' : undefined}><Select value={f.agentId} onChange={(v) => { setAgentTouched(true); set('agentId', v); }} options={agents.map((x) => [x.id, x.name])} /></Field>
      </div>
      {lease && <div className="v2-tag r" style={{ whiteSpace: 'normal' }}>This field is leased to {lease.lessee || 'someone'} until {fmtDate(lease.end)}. A harvest cannot be logged on it for this date.</div>}

      <div className="v2-flab">Deduction on this slip</div>
      <Chips label="How the deduction is written" options={[['worker', 'For each worker'], ['whole', 'One for the whole delivery']]} value={f.dedMode}
        onChange={(v) => {
          // carry what is already typed across, so switching does not lose it
          if (v === 'whole' && f.dedMode === 'worker') setAll((x) => ({ ...x, dedMode: v, bagDed: str(shaped.bagDed), waterDed: str(shaped.waterDed), otherDed: str(shaped.otherDed), dedNote: shaped.dedNote }));
          else set('dedMode', v);
        }} />

      {f.groups.map((g, gi) => {
        const weighed = r2(g.bags.reduce((t, kg) => t + num(kg), 0));
        const count = g.bags.filter((kg) => num(kg) > 0).length;
        const w = wageOf(g.workerId);
        const firstOfWorker = f.groups.findIndex((x) => x.workerId === g.workerId) === gi;
        return (
          <Card key={gi} title={`Worker ${gi + 1}`} right={f.groups.length > 1 ? <button type="button" className="v2-link" aria-label={`Remove worker ${gi + 1}`} onClick={() => set('groups', (gs) => gs.filter((_, j) => j !== gi))}>Remove</button> : null}>
            <Select aria-label={`Worker ${gi + 1} name`} value={g.workerId} onChange={(v) => setGroup(gi, { workerId: v })} options={workers.map((x) => [x.id, x.name])} placeholder="Who picked these?" />
            <div className="v2-flab">Bag weights (kg). Press Enter for the next bag.</div>
            <div className="v2-bags">
              {g.bags.map((kg, bi) => (
                <input key={bi} className="v2-inp" type="text" inputMode="decimal" enterKeyHint="next" autoComplete="off" placeholder={String(bi + 1)}
                  aria-label={`Worker ${gi + 1} bag ${bi + 1} kg`} value={kg} ref={(el) => { refs.current[`${gi}-${bi}`] = el; }}
                  onKeyDown={(e) => onKey(e, gi, bi)} onChange={(e) => setBag(gi, bi, e.target.value.replace(/[^0-9.]/g, ''))}
                  onBlur={() => { if (kg === '' && g.bags.length > 1 && bi < g.bags.length - 1) setGroup(gi, (x) => ({ bags: x.bags.filter((_, j) => j !== bi) })); }} />
              ))}
              <button type="button" className="v2-btn sec sm" onClick={() => addBag(gi)}>+ Bag</button>
            </div>
            <Row left={`${count} ${count === 1 ? 'bag' : 'bags'} weighed`} right={<strong>{weighed.toFixed(1)} kg</strong>} />
            {perWorker && (
              <div className="v2-stack" style={{ gap: 6, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
                <strong>Deducted for this worker (kg)</strong>
                <div className="v2-ded3">
                  <Field label="Water"><Num aria-label={`Worker ${gi + 1} deducted for water`} value={g.dWater} onChange={(v) => setGroup(gi, { dWater: v })} placeholder="0" /></Field>
                  <Field label="Bags"><Num aria-label={`Worker ${gi + 1} deducted for bags`} value={g.dBags} onChange={(v) => setGroup(gi, { dBags: v })} placeholder="0" /></Field>
                  <Field label="Other"><Num aria-label={`Worker ${gi + 1} deducted for other`} value={g.dOther} onChange={(v) => setGroup(gi, { dOther: v })} placeholder="0" /></Field>
                </div>
                {num(g.dOther) > 0 && <Field label="What was the other deduction for?"><Text aria-label={`Worker ${gi + 1} other deduction comment`} value={g.dNote} onChange={(v) => setGroup(gi, { dNote: v })} placeholder="Stalks, coarse leaf, short weight…" /></Field>}
              </div>
            )}
            {perWorker && <Row left={`${weighed.toFixed(1)} − ${gDed(g).toFixed(1)}`} right={<span className="v2-big">{r2(Math.max(0, weighed - gDed(g))).toFixed(1)} kg</span>} />}
            {can.money && w && firstOfWorker && count > 0 && (
              <Row left={`Wages${w.kgRate ? ` · ${w.netKg.toFixed(1)} kg × ₹${w.kgRate}` : ''}${w.dayWage ? ` · ${w.days} day` : ''}`} right={<strong>{inr(w.wage)}</strong>} />
            )}
          </Card>
        );
      })}
      <Btn kind="sec" onClick={addWorker}>+ Add another worker</Btn>

      <Card title={perWorker ? 'Total for this delivery' : 'Agent deduction, once for the whole delivery'}>
        {!perWorker && (
          <div className="v2-cols">
            <Field label="For water (kg)"><Num value={f.waterDed} onChange={(v) => set('waterDed', v)} placeholder="0" /></Field>
            <Field label="For bags (kg)"><Num value={f.bagDed} onChange={(v) => set('bagDed', v)} placeholder="0" /></Field>
            <Field label="For other (kg)"><Num value={f.otherDed} onChange={(v) => set('otherDed', v)} placeholder="0" /></Field>
          </div>
        )}
        {!perWorker && num(f.otherDed) > 0 && <Field label="What was the other deduction for?"><Text value={f.dedNote} onChange={(v) => set('dedNote', v)} placeholder="Stalks, coarse leaf, short weight…" /></Field>}
        <Row left={`${preview.gross.toFixed(1)} weighed − ${preview.ded.toFixed(1)} deducted`} right={<span className="v2-big">{preview.net.toFixed(1)} kg</span>} />
        {preview.ded > 0 && <Muted>Deducted: water {preview.waterDed.toFixed(1)} + bags {preview.bagDed.toFixed(1)}{preview.otherDed ? ` + other ${preview.otherDed.toFixed(1)}` : ''} kg{shaped.dedNote ? ` (${shaped.dedNote})` : ''}</Muted>}
        {!perWorker && shaped.pickers.length > 1 && <Muted>The deduction is shared between the workers by the weight each picked.</Muted>}
        {preview.waterDed > 0 && <Muted>Water deduction is {preview.waterPct.toFixed(1)}% of the weight</Muted>}
        {preview.overDeducted && <div className="v2-tag r">The deduction is more than the weight of the bags.</div>}
        {can.money && shaped.pickers.length > 1 && <Row left={<strong>Wages for this delivery</strong>} right={<strong>{inr(preview.wages)}</strong>} />}
      </Card>

      {can.money && (
        <Card>
          {f.dayWork.map((w, i) => (
            <div className="v2-cols" key={i} style={{ alignItems: 'flex-end' }}>
              <Field label="On daily wage"><Select value={w.workerId} onChange={(v) => set('dayWork', (l) => l.map((x, j) => (j === i ? { ...x, workerId: v, dayRate: x.dayRate || String(books.personById.get(v)?.dayRate || '') } : x)))} options={workers.map((x) => [x.id, x.name])} placeholder="Who?" /></Field>
              <Field label="Days"><Num value={w.days} onChange={(v) => set('dayWork', (l) => l.map((x, j) => (j === i ? { ...x, days: v } : x)))} /></Field>
              <Field label="₹ per day"><Num value={w.dayRate} onChange={(v) => set('dayWork', (l) => l.map((x, j) => (j === i ? { ...x, dayRate: v } : x)))} /></Field>
              <button type="button" className="v2-x" style={{ flex: 'none' }} aria-label="Remove daily wage" onClick={() => set('dayWork', (l) => l.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="v2-link" onClick={() => set('dayWork', (l) => [...l, { workerId: '', days: '1', dayRate: '' }])}>Someone on daily wage today?</button>
          {f.dayWork.length > 0 && <Muted>A worker on daily wage is paid the day's wage instead of per kg for this harvest.</Muted>}
          <Row top left={<strong>Agent rate</strong>} sub={linked ? `Set by the payment on ${fmtDate(linked.date)}` : 'Entered when the agent pays. The amount due stays blank until then.'}
            right={preview.rate != null ? <Tag kind="g">₹{preview.rate.toFixed(2)} · {inr(preview.value)}</Tag> : <Tag>Not known yet</Tag>} />
          <div className="v2-row top">
            <span><strong>Other expense today</strong><div className="v2-muted">Transport, tea, bags…</div></span>
            <button type="button" className="v2-link" onClick={() => set('extras', (l) => [...l, { category: 'Transport', amount: '', mode: 'cash', by: books.handlers[0] }])}>+ Add</button>
          </div>
          {f.extras.map((x, i) => (
            <div key={i} className="v2-stack" style={{ gap: 8, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
              <div className="v2-cols" style={{ alignItems: 'flex-end' }}>
                <Field label="What for"><Text value={x.category} onChange={(v) => set('extras', (l) => l.map((y, j) => (j === i ? { ...y, category: v } : y)))} /></Field>
                <Field label="Amount (₹)"><Num value={x.amount} onChange={(v) => set('extras', (l) => l.map((y, j) => (j === i ? { ...y, amount: v } : y)))} /></Field>
                <button type="button" className="v2-x" style={{ flex: 'none' }} aria-label="Remove expense" onClick={() => set('extras', (l) => l.filter((_, j) => j !== i))}>×</button>
              </div>
              <Chips small label="How" options={MODES} value={x.mode} onChange={(v) => set('extras', (l) => l.map((y, j) => (j === i ? { ...y, mode: v } : y)))} />
              <Chips small label="Who paid" options={books.handlers} value={x.by} onChange={(v) => set('extras', (l) => l.map((y, j) => (j === i ? { ...y, by: v } : y)))} />
            </div>
          ))}
        </Card>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} aria-label="Photo of the slip" onChange={(e) => onPhoto(e.target.files[0])} />
      <Card title="Photo of the slip, kept for reference">
        {f.slipPath ? <Row left="A photo is attached" right={<button type="button" className="v2-link" onClick={viewPhoto}>View</button>} /> : <Muted>Optional. The photo is stored with this harvest so you can check the paper later. Nothing is read from it.</Muted>}
        <Btn kind="sec" disabled={photoBusy} onClick={() => (demo ? say('Photos cannot be stored on sample data.', true) : fileRef.current.click())}>{photoBusy ? 'Storing the photo…' : f.slipPath ? 'Replace the photo' : 'Take or choose a photo'}</Btn>
      </Card>

      {!more && <button type="button" className="v2-link" onClick={() => setMore(true)}>More: note, cut with machine{can.money ? ', rate already known' : ''}</button>}
      {more && (
        <Card title="More">
          <Check checked={f.machine} onChange={(v) => set('machine', v)}>Cut with the machine</Check>
          {can.money && !linked && <Field label="Rate, only if the agent has already told you (₹ per kg)"><Num value={f.rate} onChange={(v) => set('rate', v)} placeholder="Leave empty if not known" /></Field>}
          <Field label="Note"><Text value={f.note} onChange={(v) => set('note', v)} /></Field>
        </Card>
      )}

      <Btn block onClick={save} disabled={!!lease}>{existing ? 'Save changes' : 'Save harvest'}</Btn>
      {existing && <Btn kind="danger" block onClick={remove}>Delete this harvest</Btn>}
      {existing && <Muted>{existing.updatedAt ? `Last changed ${fmtDate(String(existing.updatedAt).slice(0, 10))}${existing.updatedBy ? ' by ' + existing.updatedBy : ''}. ` : ''}Earlier versions are kept in Settings → History of changes.</Muted>}
      {!existing && <button type="button" className="v2-link" onClick={() => { setAll((x) => ({ ...x, groups: [blankGroup(workers[0]?.id)], bagDed: '', waterDed: '', otherDed: '', dedNote: '' })); say('Cleared'); }}>Clear the bags</button>}
    </Page>
  );
}
