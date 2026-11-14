import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Field, Num, Text, Select, DateField, Btn, Check, Muted, Chips, go, back, useForm } from '../ui/kit';
import { computeDelivery, kgRateFor, MODES, agentForField } from '../core/books';
import { deliveryOps, removeDeliveryOps } from '../data/actions';
import { rainRecord } from '../data/weather';
import { inr, num, sum, addDays, fmtDate, r2, isDate } from '../core/util';

export default function Harvest({ id, query }) {
  const { books, today, can, run, say, demo } = useData();
  const existing = id ? books.deliveryById.get(id) : null;
  const workers = books.people.filter((p) => p.kind === 'worker' && (p.active !== false || (existing && existing.workers.some((w) => w.workerId === p.id))));
  const agents = books.people.filter((p) => p.kind === 'agent' && (p.active !== false || existing?.agentId === p.id));
  const fields = books.fields;
  const last = books.deliveries[books.deliveries.length - 1];

  const [f, set, setAll] = useForm(() => existing ? {
    id: existing.id, date: existing.date, fieldId: existing.fieldId, agentId: existing.agentId,
    bags: existing.bags.map((b) => ({ kg: String(b.kg), workerId: b.workerId })),
    bagDed: existing.bagDed ? String(existing.bagDed) : '', waterDed: existing.waterDed ? String(existing.waterDed) : '',
    rainMm: existing.rainMm != null ? String(existing.rainMm) : '', rainSource: 'entered',
    rate: existing.rate != null ? String(existing.rate) : '', dayWork: (existing.dayWork || []).map((w) => ({ ...w, days: String(w.days), dayRate: String(w.dayRate) })),
    machine: !!existing.machine, note: existing.note || '', slipPath: existing.slipPath || '',
    dedBy: existing.dedByWorker ? Object.fromEntries(Object.entries(existing.dedBy).map(([k, v]) => [k, String(v)])) : null,
    extras: books.entries.filter((e) => e.deliveryId === existing.id && e.kind === 'misc').map((e) => ({ id: e.id, category: e.category, amount: String(e.amount), mode: e.mode, by: e.by })),
  } : {
    date: query.date || today, fieldId: last?.fieldId || fields[0]?.id || '',
    agentId: agentForField(books.fieldById.get(last?.fieldId || fields[0]?.id), query.date || today) || last?.agentId || agents[0]?.id || '', dedBy: null, slipPath: '',
    bags: [{ kg: '', workerId: workers[0]?.id || '' }], bagDed: '', waterDed: '', rainMm: '', rainSource: '',
    rate: '', dayWork: [], machine: false, note: '', extras: [],
  });
  const [more, setMore] = useState(!!(existing && (existing.rate != null || existing.note || existing.machine)));
  // the field's usual agent is filled in until the agent is chosen by hand
  const [agentTouched, setAgentTouched] = useState(!!existing);
  const usualAgent = agentForField(books.fieldById.get(f.fieldId), f.date);
  useEffect(() => { if (!agentTouched && usualAgent && usualAgent !== f.agentId) set('agentId', usualAgent); }, [usualAgent, agentTouched]); // eslint-disable-line react-hooks/exhaustive-deps
  const [slip, setSlip] = useState(null); // { busy } | { error } | { data, who: [] }
  const fileRef = useRef(null);
  const refs = useRef([]);
  const focusBag = useRef(null);
  useEffect(() => { if (focusBag.current != null) { refs.current[focusBag.current]?.focus(); focusBag.current = null; } }, [f.bags.length]);

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

  const preview = useMemo(() => {
    const dayWork = f.dayWork.filter((w) => w.workerId && num(w.days) > 0);
    const kgRates = {};
    f.bags.forEach((b) => { if (b.workerId) kgRates[b.workerId] = dayWork.some((w) => w.workerId === b.workerId) ? 0 : existing?.kgRates?.[b.workerId] ?? kgRateFor(books.personById.get(b.workerId)); });
    return computeDelivery({ ...f, kgRates, dayWork, dedBy: f.dedBy ? Object.fromEntries(Object.entries(f.dedBy).map(([k, v]) => [k, num(v)])) : null }, books.personById);
  }, [f, books, existing]);

  const setBag = (i, k, v) => set('bags', (bags) => bags.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  const addBag = () => { focusBag.current = f.bags.length; set('bags', (bags) => [...bags, { kg: '', workerId: bags[bags.length - 1]?.workerId || workers[0]?.id || '' }]); };
  const onKey = (e, i) => { if (e.key === 'Enter') { e.preventDefault(); if (i < f.bags.length - 1) refs.current[i + 1]?.focus(); else addBag(); } };
  const pickers = [...new Set(f.bags.map((b) => b.workerId).filter(Boolean))];
  const setOwnDed = (wid, v) => {
    const next = { ...(f.dedBy || {}), [wid]: v };
    set('dedBy', next);
    // the total follows the per-worker figures; water stays as typed
    const total = pickers.reduce((t, w) => t + num(next[w]), 0);
    set('bagDed', String(r2(Math.max(0, total - num(f.waterDed)))));
  };

  // ── photo of the slip ────────────────────────────────────────────────────
  const onPhoto = async (file) => {
    if (!file) return;
    setSlip({ busy: 'Reading the slip…' });
    try {
      const svc = await import('../data/slipService');
      const blob = await svc.shrink(file);
      const [data, path] = await Promise.all([
        svc.readSlip(blob),
        svc.keepPhoto(blob, f.date).catch(() => ''), // reading still works if the photo cannot be stored
      ]);
      if (path) set('slipPath', path);
      if (!data || !data.readable || !data.columns.length) { setSlip({ error: 'The numbers on this photo could not be read. Try a sharper, straight-on photo, or type them in.' + (data?.notes ? ' ' + data.notes : '') }); return; }
      // match a column heading to a worker's name where it is obvious, else leave it to be chosen
      const who = data.columns.map((c, i) => workers.find((w) => c.heading && w.name.toLowerCase() === c.heading.trim().toLowerCase())?.id || (data.columns.length === 1 ? f.bags[0]?.workerId || '' : workers[i]?.id || ''));
      setSlip({ data, who, kept: !!path });
    } catch (e) { setSlip({ error: e.message || 'Reading the slip failed.' }); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const applySlip = () => {
    const { data, who } = slip;
    if (who.some((w) => !w)) { say('Choose who each column belongs to.', true); return; }
    const bags = data.columns.flatMap((c, i) => c.weights.filter((kg) => kg > 0).map((kg) => ({ kg: String(kg), workerId: who[i] })));
    const total = data.columns.reduce((t, c) => t + num(c.deduction), 0);
    const perWorker = {};
    data.columns.forEach((c, i) => { perWorker[who[i]] = r2((perWorker[who[i]] || 0) + num(c.deduction)); });
    const distinct = new Set(who).size;
    setAll((x) => ({
      ...x, bags, bagDed: total ? String(r2(total)) : '', waterDed: '',
      dedBy: distinct > 1 && total > 0 ? Object.fromEntries(Object.entries(perWorker).map(([k, v]) => [k, String(v)])) : null,
      date: isDate(data.date) && data.date <= today ? data.date : x.date,
    }));
    setSlip(null);
    say('Filled in from the slip. Check it, then save.');
  };
  const viewPhoto = async () => {
    try { const svc = await import('../data/slipService'); window.open(await svc.photoUrl(f.slipPath), '_blank', 'noopener'); }
    catch (e) { say('The photo could not be opened: ' + (e.code || e.message), true); }
  };

  const lease = f.fieldId && f.date ? books.activeLeaseOn(f.fieldId, f.date) : null;
  const linked = existing ? books.entries.find((e) => e.kind === 'tea_sale' && (e.deliveryIds || []).includes(existing.id)) : null;

  const save = () => {
    const res = deliveryOps({ ...f, dedBy: pickers.length > 1 && f.dedBy ? f.dedBy : null }, books);
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

      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} aria-label="Photo of the slip" onChange={(e) => onPhoto(e.target.files[0])} />
      <div className="v2-cols">
        <Btn kind="sec" disabled={!!slip?.busy} onClick={() => (demo ? say('Reading a photo is not available on sample data.', true) : fileRef.current.click())}>{slip?.busy || (f.slipPath ? 'Take another photo of the slip' : 'Fill in from a photo of the slip')}</Btn>
        {f.slipPath && <Btn kind="sec" onClick={viewPhoto}>View the slip photo</Btn>}
      </div>
      {slip?.error && <div className="v2-tag r" style={{ whiteSpace: 'normal' }}>{slip.error}</div>}
      {slip?.data && (
        <Card title="Read from the photo. Check against the slip" hi>
          {slip.data.date && <Muted>Date on the slip: {isDate(slip.data.date) ? fmtDate(slip.data.date, { dow: true }) : slip.data.date}</Muted>}
          {slip.data.columns.map((c, i) => {
            const added = r2(c.weights.reduce((t, x) => t + x, 0));
            const net = r2(added - num(c.deduction));
            const sumOff = c.writtenTotal != null && Math.abs(c.writtenTotal - added) > 0.01;
            const netOff = c.writtenNet != null && Math.abs(c.writtenNet - net) > 0.01;
            return (
              <div key={i} className="v2-line" style={{ padding: '8px 0' }}>
                <div className="v2-cols" style={{ alignItems: 'flex-end' }}>
                  <Field label={`Column ${i + 1}${c.heading ? ' · "' + c.heading + '"' : ''} was picked by`}>
                    <Select value={slip.who[i]} onChange={(v) => setSlip((x) => ({ ...x, who: x.who.map((w, j) => (j === i ? v : w)) }))} options={workers.map((w) => [w.id, w.name])} placeholder="Who?" />
                  </Field>
                </div>
                <div style={{ marginTop: 6 }}>{c.weights.length} bags: {c.weights.join(', ')}</div>
                <Muted>Adds up to {added} kg{c.writtenTotal != null ? `, slip says ${c.writtenTotal}` : ''} · less {num(c.deduction)} = {net} kg{c.writtenNet != null ? `, slip says ${c.writtenNet}` : ''}{c.ratePerKg ? ` · × ₹${c.ratePerKg} = ${inr(net * c.ratePerKg)}${c.writtenAmount != null ? `, slip says ${inr(c.writtenAmount)}` : ''}` : ''}</Muted>
                {(sumOff || netOff) && <div className="v2-tag" style={{ whiteSpace: 'normal', marginTop: 4 }}>The slip's own figures do not add up here. Check the bag weights against the paper.</div>}
              </div>
            );
          })}
          {slip.data.notes && <Muted>Reader's note: {slip.data.notes}</Muted>}
          {!slip.kept && <Muted>The photo could not be stored, but the numbers were read.</Muted>}
          <div className="v2-cols"><Btn onClick={applySlip}>Use these numbers</Btn><Btn kind="sec" onClick={() => setSlip(null)}>Ignore</Btn></div>
          <Muted>This replaces the bags and deduction entered below. Nothing is saved until you press Save.</Muted>
        </Card>
      )}

      <Card title="Bags weighed" right={<span className="v2-muted">kg · picked by</span>}>
        {f.bags.map((b, i) => (
          <div className="v2-bagrow" key={i}>
            <span>Bag {i + 1}</span>
            <input className="v2-inp" type="text" inputMode="decimal" aria-label={`Bag ${i + 1} weight in kg`} placeholder="0.0" value={b.kg}
              ref={(el) => { refs.current[i] = el; }} onKeyDown={(e) => onKey(e, i)}
              onChange={(e) => setBag(i, 'kg', e.target.value.replace(/[^0-9.]/g, ''))} />
            <Select aria-label={`Bag ${i + 1} picked by`} value={b.workerId} onChange={(v) => setBag(i, 'workerId', v)} options={workers.map((w) => [w.id, w.name])} placeholder="Who?" />
            <button type="button" className="v2-x" aria-label={`Remove bag ${i + 1}`} onClick={() => set('bags', (bags) => (bags.length > 1 ? bags.filter((_, j) => j !== i) : bags))}>×</button>
          </div>
        ))}
        <Btn kind="sec" onClick={addBag}>+ Add bag</Btn>
      </Card>

      <Card title="Agent deduction, once for the whole delivery">
        <div className="v2-cols">
          <Field label="For bags (kg)"><Num value={f.bagDed} onChange={(v) => set('bagDed', v)} placeholder="0" /></Field>
          <Field label="For water (kg)"><Num value={f.waterDed} onChange={(v) => set('waterDed', v)} placeholder="0" /></Field>
        </div>
        <Row left={`${preview.gross.toFixed(1)} weighed − ${preview.ded.toFixed(1)} deducted`} right={<span className="v2-big">{preview.net.toFixed(1)} kg</span>} />
        {preview.waterDed > 0 && <Muted>Water deduction is {preview.waterPct.toFixed(1)}% of the weight</Muted>}
        {preview.overDeducted && <div className="v2-tag r">The deduction is more than the weight of the bags.</div>}
      </Card>

      {can.money && (
        <Card title="Worker wages, on net kg">
          {preview.workers.filter((w) => w.workerId).map((w) => (
            <Row key={w.workerId} left={`${books.nameOf(w.workerId)} · ${w.netKg.toFixed(1)} kg${w.kgRate ? ` × ₹${w.kgRate}` : ''}${w.dayWage ? ` · ${w.days} day` : ''}`} right={<strong>{inr(w.wage)}</strong>} />
          ))}
          {!preview.workers.some((w) => w.workerId) && <Muted>Enter a bag to see the wages.</Muted>}
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
          {pickers.length > 1 && !f.dedBy && <button type="button" className="v2-link" onClick={() => set('dedBy', Object.fromEntries(pickers.map((w) => [w, ''])))}>The slip gives a deduction for each worker</button>}
          {pickers.length > 1 && f.dedBy && (
            <div className="v2-stack" style={{ gap: 6, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
              <div className="v2-flab">Deduction for each worker (kg)</div>
              <div className="v2-cols">
                {pickers.map((w) => <Field key={w} label={books.nameOf(w)}><Num value={f.dedBy[w] ?? ''} onChange={(v) => setOwnDed(w, v)} placeholder="0" /></Field>)}
              </div>
              {!preview.dedByWorker && <Muted>These must add up to the total deduction ({preview.ded.toFixed(1)} kg) before they are used.</Muted>}
              <button type="button" className="v2-link" onClick={() => set('dedBy', null)}>Share the deduction by weight picked instead</button>
            </div>
          )}
        </Card>
      )}

      {can.money && (
        <Card>
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
      {!existing && <button type="button" className="v2-link" onClick={() => { setAll((x) => ({ ...x, bags: [{ kg: '', workerId: workers[0]?.id || '' }], bagDed: '', waterDed: '' })); say('Cleared'); }}>Clear the bags</button>}
    </Page>
  );
}
