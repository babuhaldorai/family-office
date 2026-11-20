// Turns a filled-in form into the list of record changes to save. Pure: the
// same form and books always give the same changes, and one user action is
// always saved as one all-or-nothing batch (for example an agent payment and
// the rate it puts on its deliveries).
import { r2, num, uid, sum } from '../core/util';
import { kgRateFor, workCost } from '../core/books';

const clean = (o) => {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') {
    const out = {};
    Object.keys(o).forEach((k) => { if (o[k] !== undefined && !k.startsWith('_')) out[k] = clean(o[k]); });
    return out;
  }
  return o;
};
const set = (col, id, data) => ({ col, id, data: clean({ ...data, id }) });
const del = (col, id) => ({ col, id, remove: true });
const payId = (id) => `pay-${id}`;

// ── Harvest day ─────────────────────────────────────────────────────────────
export function deliveryOps(form, books) {
  const id = form.id || uid();
  const bags = (form.bags || []).map((b) => ({ kg: num(b.kg), workerId: b.workerId || '' })).filter((b) => b.kg > 0);
  if (!form.date) return { error: 'Choose the date.' };
  if (!form.fieldId) return { error: 'Choose the field.' };
  if (!form.agentId) return { error: 'Choose the agent.' };
  if (!bags.length) return { error: 'Enter the weight of at least one bag.' };
  if (bags.some((b) => !b.workerId)) return { error: 'Choose who picked each bag.' };
  const gross = bags.reduce((s, b) => s + b.kg, 0);
  const dedTotal = num(form.bagDed) + num(form.waterDed) + num(form.otherDed);
  if (dedTotal > gross) return { error: 'The deduction is more than the weight of the bags.' };
  const lease = books.activeLeaseOn(form.fieldId, form.date);
  if (lease) return { error: `${books.fieldName(form.fieldId)} is leased to ${lease.lessee || 'someone'} on that date, so no harvest can be logged on it.` };

  const existing = form.id ? books.deliveryById.get(form.id) : null;
  const dayWork = (form.dayWork || []).filter((w) => w.workerId && num(w.days) > 0).map((w) => ({ workerId: w.workerId, days: num(w.days), dayRate: num(w.dayRate) }));
  // freeze today's per-kg rate on the delivery, so a later change to a worker's
  // rate does not rewrite the wages of past harvests
  const kgRates = {};
  [...new Set(bags.map((b) => b.workerId))].forEach((wid) => {
    const dayPaid = dayWork.some((w) => w.workerId === wid && form.dayOnly !== false);
    kgRates[wid] = dayPaid ? 0 : existing?.kgRates?.[wid] ?? kgRateFor(books.personById.get(wid));
  });
  // optional: the slip's own deduction for each worker
  let dedBy;
  if (form.dedBy) {
    const wids = [...new Set(bags.map((b) => b.workerId))];
    dedBy = {};
    wids.forEach((wid) => { dedBy[wid] = num(form.dedBy[wid]); });
    const total = wids.reduce((s, wid) => s + dedBy[wid], 0);
    if (Math.abs(total - dedTotal) > 0.011) return { error: `The deductions per worker add up to ${r2(total)} kg but the total deduction is ${r2(dedTotal)} kg.` };
    const tooMuch = wids.find((wid) => dedBy[wid] > bags.filter((b) => b.workerId === wid).reduce((s, b) => s + b.kg, 0));
    if (tooMuch) return { error: `${books.nameOf(tooMuch)}'s deduction is more than the weight they picked.` };
  }
  const linkedSale = existing ? books.entries.find((e) => e.kind === 'tea_sale' && (e.deliveryIds || []).includes(id)) : null;
  const rateGiven = form.rate !== '' && form.rate != null && num(form.rate) > 0;
  const doc = {
    date: form.date, fieldId: form.fieldId, agentId: form.agentId, bags,
    bagDed: num(form.bagDed), waterDed: num(form.waterDed), otherDed: num(form.otherDed) || 0,
    dedDetail: form.dedDetail || undefined, dedNote: form.dedNote || '',
    rainMm: form.rainMm === '' || form.rainMm == null ? null : num(form.rainMm),
    rate: rateGiven ? num(form.rate) : null,
    rateBy: rateGiven && existing && existing.rate === num(form.rate) ? existing.rateBy || null : null,
    kgRates, dayWork, machine: !!form.machine, note: form.note || '',
    dedBy, slipPath: form.slipPath || existing?.slipPath || undefined,
    createdAt: existing?.createdAt,
  };
  const ops = [set('deliveries', id, doc)];
  if (doc.rainMm != null) ops.push(set('rain', form.date, { date: form.date, mm: doc.rainMm, source: form.rainSource || 'entered' }));
  // other expenses of the day (transport, tea, bags…)
  const keep = new Set();
  (form.extras || []).filter((x) => num(x.amount) > 0).forEach((x) => {
    const eid = x.id || uid();
    keep.add(eid);
    ops.push(set('entries', eid, {
      kind: 'misc', business: 'tea', category: x.category || 'Other harvest expense', date: form.date, amount: num(x.amount), expected: num(x.amount),
      mode: x.mode || 'cash', by: x.by || '', fieldId: form.fieldId, deliveryId: id, note: x.note || '',
    }));
  });
  books.entries.filter((e) => e.deliveryId === id && e.kind === 'misc' && !keep.has(e.id)).forEach((e) => ops.push(del('entries', e.id)));
  const warn = linkedSale && existing && (Math.abs(existing.net - (gross - doc.bagDed - doc.waterDed - doc.otherDed)) > 0.005)
    ? `This delivery is already in ${books.nameOf(linkedSale.partyId)}'s payment of ${linkedSale.date}. The kg changed, so that payment will now show a difference.` : null;
  return { ops, id, warn };
}

export function removeDeliveryOps(id, books) {
  const sale = books.entries.find((e) => e.kind === 'tea_sale' && (e.deliveryIds || []).includes(id));
  if (sale) return { error: `This delivery is part of ${books.nameOf(sale.partyId)}'s payment on ${sale.date}. Open that payment and untick the delivery first.` };
  const ops = [del('deliveries', id)];
  books.entries.filter((e) => e.deliveryId === id).forEach((e) => ops.push(del('entries', e.id)));
  return { ops };
}

// ── Any payment ─────────────────────────────────────────────────────────────
export function paymentOps(form, books) {
  const id = form.id || uid();
  const amount = num(form.amount);
  if (!form.kind) return { error: 'Choose what the payment is for.' };
  if (!form.date) return { error: 'Choose the date.' };
  if (!(amount >= 0) || (amount === 0 && !num(form.advanceRecovered))) return { error: 'Enter the amount.' };
  const expected = form.expected === '' || form.expected == null ? amount : r2(num(form.expected));
  const differs = Math.abs(amount - expected) >= 1;
  if (differs && !form.diffReason) return { error: 'The amount is different from what was expected. Choose why.' };
  const existing = form.id ? books.entryById.get(form.id) : null;
  const doc = {
    kind: form.kind, date: form.date, amount, expected,
    diffReason: differs ? form.diffReason : null, diffComment: differs ? form.diffComment || '' : '',
    mode: form.mode || '', by: form.by || '', note: form.note || '',
    partyId: form.partyId || '', partyName: form.partyName || '',
    business: form.business || undefined, category: form.category || undefined,
    fieldId: form.fieldId || undefined, propertyId: form.propertyId || undefined,
    deliveryIds: form.kind === 'tea_sale' ? form.deliveryIds || [] : undefined,
    rate: form.kind === 'tea_sale' && num(form.rate) > 0 ? num(form.rate) : undefined,
    advanceRecovered: form.kind === 'wages' ? num(form.advanceRecovered) : undefined,
    tenancyId: form.tenancyId || undefined, months: form.kind === 'rent' ? form.months || [] : undefined,
    workId: form.workId || undefined, stockId: form.stockId || undefined, equipmentId: form.equipmentId || undefined,
    leaseId: form.leaseId || undefined, deliveryId: form.deliveryId || undefined, oneTime: form.oneTime || undefined,
    photoPath: form.photoPath || undefined,
    imported: existing?.imported, createdAt: existing?.createdAt,
  };
  if ((doc.kind === 'tea_sale' || doc.kind === 'wages' || doc.kind === 'advance') && !doc.partyId) return { error: 'Choose the person.' };
  if (doc.kind === 'wages') {
    const w = books.workerById.get(doc.partyId);
    const already = existing ? num(existing.advanceRecovered) : 0;
    if (w && doc.advanceRecovered > w.advanceBalance + already + 0.005) return { error: `${w.name} only owes ${r2(w.advanceBalance + already)} in advances.` };
  }
  const ops = [set('entries', id, doc)];
  if (doc.kind === 'tea_sale') {
    const now = new Set(doc.deliveryIds);
    if (now.size && !doc.rate) return { error: 'Enter the rate the agent is paying.' };
    const taken = doc.deliveryIds.find((did) => books.entries.some((e) => e.id !== id && e.kind === 'tea_sale' && (e.deliveryIds || []).includes(did)));
    if (taken) return { error: 'One of these deliveries is already covered by another payment.' };
    doc.deliveryIds.forEach((did) => {
      const d = books.deliveryById.get(did);
      if (d && (d.rate !== doc.rate || d.rateBy !== id)) ops.push({ col: 'deliveries', id: did, patch: { rate: doc.rate, rateBy: id } });
    });
    // deliveries unticked from this payment go back to "rate not known"
    (existing?.deliveryIds || []).filter((did) => !now.has(did)).forEach((did) => {
      const d = books.deliveryById.get(did);
      if (d && d.rateBy === id) ops.push({ col: 'deliveries', id: did, patch: { rate: null, rateBy: null } });
    });
  }
  return { ops, id };
}

export function removeEntryOps(id, books) {
  const e = books.entryById.get(id);
  if (!e) return { ops: [] };
  const ops = [del('entries', id)];
  if (e.kind === 'tea_sale') (e.deliveryIds || []).forEach((did) => {
    const d = books.deliveryById.get(did);
    if (d && d.rateBy === id) ops.push({ col: 'deliveries', id: did, patch: { rate: null, rateBy: null } });
  });
  return { ops };
}

// A bill (field work, manure purchase, equipment, lease) and its payment are
// saved together. The payment's id is derived from the bill's, so editing the
// bill keeps the two in step instead of creating a second payment.
function withPayment(ops, books, id, pay, entry) {
  const existing = books.entryById.get(payId(id));
  if (pay && pay.paid && num(entry.amount) > 0) {
    ops.push(set('entries', payId(id), {
      ...entry, expected: num(entry.amount), mode: pay.mode || existing?.mode || '', by: pay.by || existing?.by || '',
      date: pay.date || entry.date, createdAt: existing?.createdAt,
    }));
  } else if (existing) ops.push(del('entries', payId(id)));
}

export function workOps(form, books) {
  const id = form.id || uid();
  if (!form.date) return { error: 'Choose the date.' };
  if (!form.fieldId) return { error: 'Choose the field.' };
  const byLessee = !!form.byLessee;
  const items = (form.items || []).filter((it) => num(it.qty) > 0 && (it.stockId || it.name))
    .map((it) => (byLessee
      ? { name: it.name || '', qty: num(it.qty) } // the lessee's own material: no cost, and never our stock
      : { name: it.name || '', qty: num(it.qty), unitCost: it.stockId ? undefined : num(it.unitCost), stockId: it.stockId || undefined }));
  for (const it of items) {
    if (!it.stockId) continue;
    const s = books.stock.find((x) => x.id === it.stockId);
    const before = form.id ? (books.workById.get(form.id)?.items || []).filter((x) => x.stockId === it.stockId).reduce((a, x) => a + x.qty, 0) : 0;
    if (s && it.qty > s.left + before + 0.005) return { error: `Only ${r2(s.left + before)} bags of ${s.name} are left.` };
  }
  const existing = form.id ? books.workById.get(form.id) : null;
  const doc = {
    date: form.date, fieldId: form.fieldId, type: form.type || 'other', oneTime: !!form.oneTime,
    labourMode: form.labourMode || 'day', people: num(form.people), days: num(form.days), rate: num(form.rate),
    bags: num(form.bags), fixedAmount: num(form.fixedAmount), items, comment: form.comment || '', createdAt: existing?.createdAt,
    byLessee: byLessee || undefined,
  };
  const cost = workCost(doc, books.stockById).cost;
  const ops = [set('work', id, doc)];
  if (!existing?.groupId) withPayment(ops, books, id, byLessee ? null : form.pay, { kind: 'work', workId: id, date: form.date, amount: cost });
  else doc.groupId = existing.groupId;
  return { ops, id, cost };
}

export function stockOps(form, books) {
  const id = form.id || uid();
  if (!form.date) return { error: 'Choose the date.' };
  if (!form.name) return { error: 'Enter the type of manure.' };
  if (!(num(form.bags) > 0)) return { error: 'Enter the number of bags.' };
  const existing = books.stock.find((s) => s.id === id);
  if (existing && num(form.bags) < existing.used) return { error: `${existing.used} bags of this purchase are already applied to fields.` };
  const doc = { date: form.date, name: form.name, bags: num(form.bags), costPerBag: num(form.costPerBag), transport: num(form.transport), vendorId: form.vendorId || '', vendor: form.vendor || '', note: form.note || '', createdAt: existing?.createdAt };
  const cost = r2(doc.bags * doc.costPerBag + doc.transport);
  const ops = [set('stock', id, doc)];
  withPayment(ops, books, id, form.pay, { kind: 'stock', stockId: id, partyId: doc.vendorId, partyName: doc.vendor, date: form.date, amount: cost });
  return { ops, id, cost };
}

// ── Manure: buying several types at once ────────────────────────────────────
// One purchase = one line per type, sharing one transport charge (split by
// bags) and one payment.
export function purchaseOps(form, books) {
  const groupId = form.groupId || uid();
  if (!form.date) return { error: 'Choose the date.' };
  const lines = (form.lines || []).filter((l) => (l.name || '').trim() || num(l.bags) > 0);
  if (!lines.length) return { error: 'Enter at least one type of manure.' };
  if (lines.some((l) => !(l.name || '').trim())) return { error: 'Enter the type of manure on every line.' };
  if (lines.some((l) => !(num(l.bags) > 0))) return { error: 'Enter the number of bags on every line.' };
  const totalBags = lines.reduce((t, l) => t + num(l.bags), 0);
  const transport = num(form.transport);
  const before = books.stock.filter((x) => x.kind !== 'mix' && (x.groupId === groupId || x.id === groupId));
  const tooFew = lines.find((l) => { const old = before.find((x) => x.id === l.id); return old && num(l.bags) < old.used; });
  if (tooFew) { const old = before.find((x) => x.id === tooFew.id); return { error: `${old.used} bags of ${old.name} are already used, so it cannot be fewer than that.` }; }
  const keep = new Set();
  const ops = [];
  let given = 0;
  lines.forEach((l, i) => {
    const id = l.id || uid();
    keep.add(id);
    const old = before.find((x) => x.id === id);
    // the last line takes the remainder, so the shares add up to the whole transport charge
    const share = i === lines.length - 1 ? r2(transport - given) : r2((transport * num(l.bags)) / totalBags);
    given = r2(given + share);
    ops.push(set('stock', id, {
      date: form.date, groupId, name: l.name.trim(), bags: num(l.bags), costPerBag: num(l.costPerBag), transport: share,
      vendorId: form.vendorId || '', vendor: form.vendor || '', note: form.note || '', createdAt: old?.createdAt,
    }));
  });
  for (const old of before) {
    if (keep.has(old.id)) continue;
    if (old.used > 0) return { error: `${old.used} bags of ${old.name} are already used, so that line cannot be removed.` };
    ops.push(del('stock', old.id));
  }
  const total = r2(lines.reduce((t, l) => t + num(l.bags) * num(l.costPerBag), 0) + transport);
  // old single-line purchases kept their payment under their own id; replace it
  books.entries.filter((e) => e.kind === 'stock' && before.some((x) => x.id === e.stockId) && e.id !== payId(groupId)).forEach((e) => ops.push(del('entries', e.id)));
  const existing = books.entryById.get(payId(groupId));
  if (form.pay && form.pay.paid && total > 0) {
    ops.push(set('entries', payId(groupId), {
      kind: 'stock', stockIds: [...keep], partyId: form.vendorId || '', partyName: form.vendor || '', date: form.pay.date || form.date,
      amount: total, expected: total, mode: form.pay.mode || '', by: form.pay.by || '', createdAt: existing?.createdAt,
    }));
  } else if (existing) ops.push(del('entries', payId(groupId)));
  return { ops, id: groupId, cost: total };
}

// ── Manure: mixing types together and filling the mix back into bags ────────
export function mixOps(form, books) {
  const id = form.id || uid();
  if (!form.date) return { error: 'Choose the date.' };
  const inputs = (form.inputs || []).filter((it) => it.stockId && num(it.qty) > 0).map((it) => ({ stockId: it.stockId, qty: num(it.qty) }));
  if (inputs.length < 1) return { error: 'Choose what went into the mix, and how many bags of each.' };
  if (new Set(inputs.map((it) => it.stockId)).size !== inputs.length) return { error: 'The same purchase is listed twice. Put its bags on one line.' };
  if (!(num(form.bags) > 0)) return { error: 'Enter how many bags the mix was filled into.' };
  const old = books.stock.find((x) => x.id === id && x.kind === 'mix');
  if (old && num(form.bags) < old.used) return { error: `${old.used} bags of this mix are already applied.` };
  for (const it of inputs) {
    const st = books.stock.find((x) => x.id === it.stockId);
    if (!st || st.kind === 'mix') return { error: 'A mix can only be made from manure that was bought.' };
    const already = old ? (old.inputs.find((x) => x.stockId === it.stockId)?.qty || 0) : 0;
    if (it.qty > st.left + already + 0.005) return { error: `Only ${r2(st.left + already)} bags of ${st.name} are left.` };
  }
  const name = (form.name || '').trim() || 'Mix of ' + inputs.map((it) => books.stockById.get(it.stockId)?.name).join(' + ');
  return { ops: [set('stock', id, { kind: 'mix', date: form.date, name, inputs, bags: num(form.bags), note: form.note || '', createdAt: old?.createdAt })], id };
}

// ── Manure: one day's application, possibly to several fields ───────────────
// Saves one work record per line (so each field keeps its own history) and
// one payment for the day's applying.
export function applyOps(form, books) {
  const groupId = form.groupId || uid();
  if (!form.date) return { error: 'Choose the date.' };
  const lines = (form.lines || []).filter((l) => l.fieldId || l.stockId || num(l.bags) > 0);
  if (!lines.length) return { error: 'Add at least one field.' };
  if (lines.some((l) => !l.fieldId)) return { error: 'Choose the field on every line.' };
  if (lines.some((l) => !l.stockId)) return { error: 'Choose which manure or mix went on every line.' };
  if (lines.some((l) => !(num(l.bags) > 0))) return { error: 'Enter the bags applied on every line.' };
  const before = books.work.filter((w) => w.groupId === groupId);
  // bags available = what is left now, plus what this application already took
  const need = new Map();
  lines.forEach((l) => need.set(l.stockId, (need.get(l.stockId) || 0) + num(l.bags)));
  for (const [sid, qty] of need) {
    const st = books.stock.find((x) => x.id === sid);
    const had = sum(before.flatMap((w) => w.items.filter((it) => it.stockId === sid)), (it) => it.qty);
    if (!st || qty > st.left + had + 0.005) return { error: `Only ${r2((st ? st.left : 0) + had)} bags of ${st ? st.name : 'that manure'} are left.` };
  }
  const rate = num(form.rate);
  const ops = [];
  const keep = new Set();
  lines.forEach((l) => {
    const id = l.id || uid();
    keep.add(id);
    const old = books.workById.get(id);
    ops.push(set('work', id, {
      date: form.date, fieldId: l.fieldId, type: 'manure', groupId, labourMode: 'bag', bags: num(l.bags), rate,
      items: [{ name: books.stockById.get(l.stockId)?.name || 'Manure', qty: num(l.bags), stockId: l.stockId }],
      comment: form.comment || '', createdAt: old?.createdAt,
    }));
  });
  before.filter((w) => !keep.has(w.id)).forEach((w) => ops.push(del('work', w.id)));
  const labour = r2(lines.reduce((t, l) => t + num(l.bags), 0) * rate);
  const existing = books.entryById.get(payId(groupId));
  if (form.pay && form.pay.paid && labour > 0) {
    ops.push(set('entries', payId(groupId), {
      kind: 'work', workIds: [...keep], date: form.pay.date || form.date, amount: labour, expected: labour,
      mode: form.pay.mode || '', by: form.pay.by || '', partyName: form.pay.to || '', createdAt: existing?.createdAt,
    }));
  } else if (existing) ops.push(del('entries', payId(groupId)));
  return { ops, id: groupId, labour };
}

export function equipmentOps(form, books) {
  const id = form.id || uid();
  if (!form.name) return { error: 'Enter what was bought.' };
  if (!form.date) return { error: 'Choose the date.' };
  if (!(num(form.cost) > 0)) return { error: 'Enter the price.' };
  const existing = books.equipmentById.get(id);
  const ops = [set('equipment', id, { name: form.name, date: form.date, cost: num(form.cost), lifeYears: Math.max(1, num(form.lifeYears) || 5), note: form.note || '', createdAt: existing?.createdAt })];
  withPayment(ops, books, id, form.pay, { kind: 'equipment', equipmentId: id, date: form.date, amount: num(form.cost) });
  return { ops, id };
}

export function leaseOps(form, books) {
  const id = form.id || uid();
  if (!form.fieldId) return { error: 'Choose the field.' };
  if (!form.start || !form.end) return { error: 'Enter the start and end dates.' };
  if (form.end <= form.start) return { error: 'The end date must be after the start date.' };
  if (!form.kind) return { error: 'Choose what kind of lease it is.' };
  const clash = books.leases.find((l) => l.id !== id && l.fieldId === form.fieldId && l.start <= form.end && l.end >= form.start);
  if (clash) return { error: `This field is already leased to ${clash.lessee || 'someone'} for part of that time.` };
  const existing = books.leaseById.get(id);
  const ops = [set('leases', id, { fieldId: form.fieldId, lessee: form.lessee || '', phone: form.phone || '', start: form.start, end: form.end, kind: form.kind, amount: num(form.amount), note: form.note || '', createdAt: existing?.createdAt })];
  withPayment(ops, books, id, form.pay, { kind: form.kind === 'deposit' ? 'lease_deposit' : 'lease_rent', leaseId: id, partyName: form.lessee || 'Lessee', date: form.start, amount: num(form.amount) });
  return { ops, id };
}

// Removing a bill also removes the payments recorded against it, in one batch.
export function removeWithPayments(col, id, books) {
  const key = { work: 'workId', stock: 'stockId', equipment: 'equipmentId', leases: 'leaseId', tenancies: 'tenancyId' }[col];
  // a line of a purchase, or a field in a day's application, goes with the rest of its group
  const rec = col === 'stock' ? books.stock.find((x) => x.id === id) : col === 'work' ? books.workById.get(id) : null;
  const group = rec && rec.groupId ? (col === 'stock' ? books.stock.filter((x) => x.groupId === rec.groupId && x.kind !== 'mix') : books.work.filter((w) => w.groupId === rec.groupId)) : rec ? [rec] : [{ id }];
  if (col === 'stock') {
    const usedOne = group.find((x) => x.used > 0);
    if (usedOne) return { error: `${usedOne.used} bags of ${usedOne.name} are used in a mix or on a field. Remove those first.` };
  }
  const ids = new Set(group.map((x) => x.id));
  const ops = group.map((x) => del(col, x.id));
  const arrKey = col === 'stock' ? 'stockIds' : col === 'work' ? 'workIds' : null;
  if (key) books.entries.filter((e) => ids.has(e[key]) || (arrKey && (e[arrKey] || []).some((x) => ids.has(x)))).forEach((e) => ops.push(del('entries', e.id)));
  return { ops, alsoRemoved: ops.length - group.length, groupSize: group.length };
}

// People, fields and properties that are used by other records cannot be
// removed (their history would point at nothing); they are marked inactive.
export function usageOf(col, id, books) {
  if (col === 'people') {
    return books.deliveries.filter((d) => d.agentId === id || d.bags.some((b) => b.workerId === id) || (d.dayWork || []).some((w) => w.workerId === id)).length
      + books.entries.filter((e) => e.partyId === id).length + books.tenancies.filter((t) => t.tenantId === id).length;
  }
  if (col === 'fields') return books.deliveries.filter((d) => d.fieldId === id).length + books.work.filter((w) => w.fieldId === id).length + books.leases.filter((l) => l.fieldId === id).length;
  if (col === 'properties') return books.tenancies.filter((t) => t.propertyId === id).length + books.entries.filter((e) => e.propertyId === id).length;
  return 0;
}

export const simpleSave = (col, doc) => [set(col, doc.id || uid(), doc)];
