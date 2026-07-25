/**
 * chaayaService.js
 * Firestore service for the full Chaaya Tea Plantation app.
 * Collections mirror the index.html data model exactly.
 *
 * Collections:
 *   tea_harvest        — harvest sessions (bag-builder data)
 *   tea_market_rates   — per-agent date-range rates
 *   tea_settlements    — worker wage settlements
 *   tea_agent_payments — agent payments received
 *   tea_advances       — worker advances
 *   tea_maintenance    — field maintenance tasks
 *   tea_weather        — weather log
 *   workers            — worker master data
 *   agents             — agent master data
 *   fields             — field master data
 */

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const col = (name) => collection(db, name);
const snap2arr = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));

// ─── helpers ─────────────────────────────────────────────────────────────────
export const inr = v => '₹' + Math.round(v || 0).toLocaleString('en-IN');
export const kgFmt = v => parseFloat(v || 0).toFixed(1) + ' kg';

export function weekLabel(d) {
  const dt = d ? new Date(d) : new Date();
  const jan1 = new Date(dt.getFullYear(), 0, 1);
  const w = Math.ceil(((dt - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `W${w}-${dt.getFullYear()}`;
}

export function todayStr() { return new Date().toISOString().split('T')[0]; }

export function calcBagNet(b) {
  return Math.max(0, (b.gross || 0) - (b.bagWt || 0) - (b.waterKg || 0));
}

export function calcBagWaterPct(b) {
  return b.gross > 0 ? ((b.waterKg || 0) / b.gross * 100) : 0;
}

// Get applicable rate for agent on a date — falls back to most recent prior rate
export function getRateForAgentDate(rates, agentName, dateStr) {
  if (!dateStr || !agentName) return null;
  const agentRates = rates
    .filter(r => r.agent === agentName)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const exact = agentRates.filter(r => r.startDate <= dateStr && (!r.endDate || r.endDate >= dateStr));
  if (exact.length) return { ...exact[0], isPlaceholder: false };
  const prior = agentRates.filter(r => r.startDate < dateStr);
  if (prior.length) return { ...prior[0], isPlaceholder: true };
  if (agentRates.length) return { ...agentRates[0], isPlaceholder: true };
  return null;
}

// ─── HARVEST ─────────────────────────────────────────────────────────────────
export const harvestChaayaService = {
  subscribe(cb) {
    return onSnapshot(
      query(col('tea_harvest'), orderBy('createdAt', 'desc')),
      s => cb(snap2arr(s)),
      e => console.error('harvest error:', e)
    );
  },
  async add(data) {
    return addDoc(col('tea_harvest'), { ...data, createdAt: serverTimestamp() });
  },
  async update(id, data) {
    return updateDoc(doc(db, 'tea_harvest', id), { ...data, updatedAt: serverTimestamp() });
  },
  async delete(id) { return deleteDoc(doc(db, 'tea_harvest', id)); },
};

// ─── MARKET RATES ─────────────────────────────────────────────────────────────
export const ratesChaayaService = {
  subscribe(cb) {
    return onSnapshot(
      query(col('tea_market_rates'), orderBy('startDate', 'desc')),
      s => cb(snap2arr(s)),
      e => console.error('rates error:', e)
    );
  },
  async add(data) { return addDoc(col('tea_market_rates'), { ...data, createdAt: serverTimestamp() }); },
  async delete(id) { return deleteDoc(doc(db, 'tea_market_rates', id)); },
};

// ─── SETTLEMENTS ──────────────────────────────────────────────────────────────
export const settlementService = {
  subscribe(cb) {
    return onSnapshot(
      query(col('tea_settlements'), orderBy('createdAt', 'desc')),
      s => cb(snap2arr(s)),
      e => console.error('settlements error:', e)
    );
  },
  async add(data) { return addDoc(col('tea_settlements'), { ...data, createdAt: serverTimestamp() }); },
  async delete(id) { return deleteDoc(doc(db, 'tea_settlements', id)); },
};

// ─── AGENT PAYMENTS ───────────────────────────────────────────────────────────
export const agentPaymentService = {
  subscribe(cb) {
    return onSnapshot(
      query(col('tea_agent_payments'), orderBy('createdAt', 'desc')),
      s => cb(snap2arr(s)),
      e => console.error('agentPayments error:', e)
    );
  },
  async add(data) { return addDoc(col('tea_agent_payments'), { ...data, createdAt: serverTimestamp() }); },
  async delete(id) { return deleteDoc(doc(db, 'tea_agent_payments', id)); },
};

// ─── ADVANCES ─────────────────────────────────────────────────────────────────
export const advanceService = {
  subscribe(cb) {
    return onSnapshot(
      query(col('tea_advances'), orderBy('createdAt', 'desc')),
      s => cb(snap2arr(s)),
      e => console.error('advances error:', e)
    );
  },
  async add(data) { return addDoc(col('tea_advances'), { ...data, createdAt: serverTimestamp() }); },
  async update(id, data) { return updateDoc(doc(db, 'tea_advances', id), data); },
  async delete(id) { return deleteDoc(doc(db, 'tea_advances', id)); },
};

// ─── MAINTENANCE ──────────────────────────────────────────────────────────────
export const maintenanceService = {
  subscribe(cb) {
    return onSnapshot(
      query(col('tea_maintenance'), orderBy('createdAt', 'desc')),
      s => cb(snap2arr(s)),
      e => console.error('maintenance error:', e)
    );
  },
  async add(data) { return addDoc(col('tea_maintenance'), { ...data, createdAt: serverTimestamp() }); },
  async delete(id) { return deleteDoc(doc(db, 'tea_maintenance', id)); },
};

// ─── INVENTORY (bulk fertilizer/equipment purchases) ──────────────────────────
// A purchase is bought once (e.g. 50 bags of DAP, or 5 sprayers) and then
// used up gradually across different fields over time via Maintenance
// entries that reference it — inventoryWithRemaining() tracks how much of
// each purchase is left unallocated.
export const inventoryService = {
  subscribe(cb) {
    return onSnapshot(
      query(col('tea_inventory'), orderBy('createdAt', 'desc')),
      s => cb(snap2arr(s)),
      e => console.error('inventory error:', e)
    );
  },
  async add(data) { return addDoc(col('tea_inventory'), { ...data, createdAt: serverTimestamp() }); },
  async update(id, data) { return updateDoc(doc(db, 'tea_inventory', id), data); },
  async delete(id) { return deleteDoc(doc(db, 'tea_inventory', id)); },
};

export function inventoryWithRemaining(inventory, maintenance) {
  return inventory.map(p => {
    let allocated = 0;
    maintenance.forEach(m => {
      (m.fertItems || []).forEach(it => { if (it.purchaseId === p.id) allocated += (it.bags || 0); });
      (m.equipItems || []).forEach(it => { if (it.purchaseId === p.id) allocated += (it.units || 0); });
    });
    return { ...p, allocated, remaining: Math.max(0, (p.totalUnits || 0) - allocated) };
  });
}

// ─── WEATHER ─────────────────────────────────────────────────────────────────
export const weatherService = {
  subscribe(cb) {
    return onSnapshot(
      query(col('tea_weather'), orderBy('date', 'desc')),
      s => cb(snap2arr(s)),
      e => console.error('weather error:', e)
    );
  },
  async add(data) { return addDoc(col('tea_weather'), { ...data, createdAt: serverTimestamp() }); },
  async delete(id) { return deleteDoc(doc(db, 'tea_weather', id)); },
};

// ─── WORKERS ─────────────────────────────────────────────────────────────────
export const workersChaayaService = {
  subscribe(cb) {
    return onSnapshot(col('workers'), s => cb(snap2arr(s)), e => console.error('workers error:', e));
  },
  async add(data) { return addDoc(col('workers'), { ...data, createdAt: serverTimestamp() }); },
  async update(id, data) { return updateDoc(doc(db, 'workers', id), data); },
  async delete(id) { return deleteDoc(doc(db, 'workers', id)); },
};

// ─── AGENTS ──────────────────────────────────────────────────────────────────
export const agentsChaayaService = {
  subscribe(cb) {
    return onSnapshot(col('agents'), s => cb(snap2arr(s)), e => console.error('agents error:', e));
  },
  async add(data) { return addDoc(col('agents'), { ...data, createdAt: serverTimestamp() }); },
  async update(id, data) { return updateDoc(doc(db, 'agents', id), data); },
  async delete(id) { return deleteDoc(doc(db, 'agents', id)); },
};

// ─── FIELDS ──────────────────────────────────────────────────────────────────
export const fieldsChaayaService = {
  subscribe(cb) {
    return onSnapshot(col('fields'), s => cb(snap2arr(s)), e => console.error('fields error:', e));
  },
  async add(data) { return addDoc(col('fields'), { ...data, createdAt: serverTimestamp() }); },
  async update(id, data) { return updateDoc(doc(db, 'fields', id), data); },
  async delete(id) { return deleteDoc(doc(db, 'fields', id)); },
};

// ─── FINANCE HELPERS ──────────────────────────────────────────────────────────
export function periodBounds(preset) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const fmt = d => d.toISOString().split('T')[0];
  switch (preset) {
    case 'this_month': return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case 'last_month': return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
    case 'ytd':        return { from: `${y}-01-01`, to: fmt(now) };
    case 'last_year':  return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'all':        return { from: '2000-01-01', to: '2099-12-31' };
    default:           return { from: '2000-01-01', to: '2099-12-31' };
  }
}

export function periodLabel(ps) {
  const now = new Date(), y = now.getFullYear();
  const mn = d => d.toLocaleString('en-IN', { month: 'short' });
  switch (ps.preset) {
    case 'this_month': return `${new Date(y, now.getMonth(), 1).toLocaleString('en-IN', { month: 'long' })} ${y}`;
    case 'last_month': { const d = new Date(y, now.getMonth() - 1, 1); return `${d.toLocaleString('en-IN', { month: 'long' })} ${d.getFullYear()}`; }
    case 'ytd':        return `Jan – ${mn(now)} ${y} (YTD)`;
    case 'last_year':  return `${y - 1} (full year)`;
    case 'all':        return 'All Time';
    case 'custom':     return `${ps.from || '?'} → ${ps.to || '?'}`;
    default:           return '';
  }
}

export function getFilteredHarvest(harvest, ps) {
  const from = ps.from || '2000-01-01', to = ps.to || '2099-12-31';
  return harvest.filter(e => e.date && e.date >= from && e.date <= to);
}

export function getFieldAcres(fields, name) {
  const f = fields.find(f => f.name === name);
  return f ? parseFloat(f.area) || 1 : 1;
}

export function agentStats(agent, harvestData) {
  const h = harvestData.filter(e => e.agent === agent);
  const grossKg = h.reduce((s, e) => s + (e.tGross || 0), 0);
  const waterKg = h.reduce((s, e) => s + (e.tWaterDed || 0), 0);
  const bagKg   = h.reduce((s, e) => s + (e.tBagDed || 0), 0);
  const netKg   = h.reduce((s, e) => s + (e.tNet || 0), 0);
  const netRev  = h.reduce((s, e) => s + (e.agentRev || 0), 0);
  const avgPostedRate = h.length ? h.reduce((s, e) => s + (e.rate || 0), 0) / h.length : 0;
  const revLost = (waterKg + bagKg) * avgPostedRate;
  const effectiveRate = grossKg > 0 ? netRev / grossKg : 0;
  return {
    agent, grossKg, waterKg, bagKg, netKg, netRev,
    avgPostedRate, revLost, effectiveRate, sessions: h.length,
    waterPct: grossKg > 0 ? waterKg / grossKg * 100 : 0,
    bagPct:   grossKg > 0 ? bagKg   / grossKg * 100 : 0,
    totalDedPct: grossKg > 0 ? (waterKg + bagKg) / grossKg * 100 : 0,
  };
}

export function workerWageSummary(workerName, harvest, advances, settlements) {
  const enriched = enrichHarvestWithPaymentStatus(harvest, settlements, []);
  const rows = enriched.filter(e => e.worker === workerName);
  const totalEarned = rows.reduce((s, e) => s + (e.workerPay || 0), 0);
  const paid        = rows.reduce((s, e) => s + (e.workerPayAmount || 0), 0);
  const pendingAdv  = advances.filter(a => a.worker === workerName && !a.deducted).reduce((s, a) => s + (a.amount || 0), 0);
  const outstanding = Math.max(0, totalEarned - pendingAdv - paid);
  return { totalEarned, pendingAdv, paid, outstanding };
}

export function workerUnpaidWages(workerName, harvest, advances, settlements) {
  return workerWageSummary(workerName, harvest, advances, settlements).outstanding;
}

export function agentPendingBreakdown(harvest, agentPayments) {
  const enriched = enrichHarvestWithPaymentStatus(harvest, [], agentPayments);
  const harvestAgents  = [...new Set(harvest.map(h => h.agent).filter(Boolean))];
  const paymentAgents  = [...new Set(agentPayments.map(p => p.agent).filter(Boolean))];
  const allAgents = [...new Set([...harvestAgents, ...paymentAgents])];
  return allAgents.map(a => {
    const hEntries = enriched.filter(e => e.agent === a);
    const earned   = hEntries.reduce((s, e) => s + (e.agentRev || 0), 0);
    const totalKg  = hEntries.reduce((s, e) => s + (e.tNet || 0), 0);
    const sessions = hEntries.length;
    const received = hEntries.reduce((s, e) => s + (e.agentPayAmount || 0), 0);
    const avgRate  = totalKg > 0 ? earned / totalKg : 0;
    return { agent: a, earned, received, pending: Math.max(0, earned - received), totalKg, sessions, avgRate };
  }).filter(x => x.earned > 0 || x.received > 0);
}

// One row per (worker, date) — aggregates inline per-row payments recorded
// directly in Harvest Log into a single transaction entry, since several
// harvest sessions paid on the same day are really one payment event.
export function workerPaymentLog(harvest) {
  const map = {};
  harvest.forEach(h => {
    if (!h.worker || !(h.workerPayAmount > 0) || !h.workerPayDate) return;
    const key = h.worker + '|' + h.workerPayDate;
    if (!map[key]) map[key] = { worker: h.worker, date: h.workerPayDate, amount: 0, sessions: 0 };
    map[key].amount += h.workerPayAmount;
    map[key].sessions += 1;
  });
  return Object.values(map).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function agentPaymentLog(harvest) {
  const map = {};
  harvest.forEach(h => {
    if (!h.agent || !(h.agentPayAmount > 0) || !h.agentPayDate) return;
    const key = h.agent + '|' + h.agentPayDate;
    if (!map[key]) map[key] = { agent: h.agent, date: h.agentPayDate, amount: 0, sessions: 0 };
    map[key].amount += h.agentPayAmount;
    map[key].sessions += 1;
  });
  return Object.values(map).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// Applies `amount` toward a worker's pending (undeducted) advances, oldest
// first. Fully-consumed advances are marked deducted; a partially-consumed
// advance has its remaining amount reduced and stays pending.
export async function consumeWorkerAdvance(advances, worker, amount) {
  let remaining = amount;
  const pending = advances
    .filter(a => a.worker === worker && !a.deducted)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (const a of pending) {
    if (remaining <= 0.01) break;
    if ((a.amount || 0) <= remaining + 0.01) {
      await advanceService.update(a.id, { deducted: true });
      remaining -= (a.amount || 0);
    } else {
      await advanceService.update(a.id, { amount: parseFloat(((a.amount || 0) - remaining).toFixed(2)) });
      remaining = 0;
    }
  }
}

// Strictly explicit version — used for display in Rate & Payments. Unlike
// enrichHarvestWithPaymentStatus, this NEVER pulls in a FIFO-allocated guess
// from a legacy bulk payment; a row only shows an amount if it was actually
// entered on that specific row. (The FIFO-aware version above is still used
// internally by the Worker/Agent Payments summary tabs, so old bulk payments
// still correctly reduce the aggregate outstanding total — they just don't
// silently attribute themselves to individual rows anymore.)
export function explicitPaymentStatus(harvest) {
  return harvest.map(h => {
    const workerPayAmount = h.workerPayAmount || 0;
    const agentPayAmount  = h.agentPayAmount  || 0;
    const workerPayStatus = !h.workerPay ? 'n/a' : workerPayAmount >= h.workerPay - 0.5 ? 'paid' : workerPayAmount > 0 ? 'partial' : 'pending';
    const agentPayStatus  = !h.agentRev  ? 'n/a' : agentPayAmount  >= h.agentRev - 0.5  ? 'paid' : agentPayAmount  > 0 ? 'partial' : 'pending';
    return {
      ...h,
      workerPayAmount, workerPayDate: h.workerPayDate || null, workerPayStatus,
      agentPayAmount,  agentPayDate:  h.agentPayDate  || null, agentPayStatus,
    };
  });
}

export function lastKnownRate(harvest, agent) {
  if (!agent) return null;
  const rows = harvest
    .filter(h => h.agent === agent && h.rate > 0)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? rows[0].rate : null;
}

// Cost-per-kg breakdown: how much of the per-kg revenue is consumed by
// bag/water deduction loss, worker wages, and field maintenance — both in
// aggregate and broken down by individual maintenance task (fertilizer,
// pruning, etc.) — leaving the actual net margin per kg harvested.
export function costPerKgBreakdown(harvest, maintenance) {
  const totalNetKg     = harvest.reduce((s,h)=>s+(h.tNet||0),0);
  const totalGrossKg   = harvest.reduce((s,h)=>s+(h.tGross||0),0);
  const totalBagDed    = harvest.reduce((s,h)=>s+(h.tBagDed||0),0);
  const totalWaterDed  = harvest.reduce((s,h)=>s+(h.tWaterDed||0),0);
  const totalDeductedKg = totalBagDed + totalWaterDed;
  const totalAgentRev  = harvest.reduce((s,h)=>s+(h.agentRev||0),0);
  const totalWorkerPay = harvest.reduce((s,h)=>s+(h.workerPay||0),0);
  const avgRate = totalNetKg > 0 ? totalAgentRev / totalNetKg : 0;

  // Value of the weight lost to bag/water deductions, at the average rate —
  // revenue that was never counted because it was deducted before "net"
  // weight was calculated, expressed per net kg actually sold.
  const deductionLossValue = totalDeductedKg * avgRate;
  const deductionLossPerKg = totalNetKg > 0 ? deductionLossValue / totalNetKg : 0;

  const workerPerKg = totalNetKg > 0 ? totalWorkerPay / totalNetKg : 0;

  const totalMaintenance = maintenance.reduce((s,m)=>s+(m.cost||0),0);
  const maintenancePerKg = totalNetKg > 0 ? totalMaintenance / totalNetKg : 0;

  const byTask = {};
  maintenance.forEach(m => { const t = m.task || 'Other'; byTask[t] = (byTask[t]||0) + (m.cost||0); });
  const taskBreakdown = Object.entries(byTask)
    .map(([task,cost]) => ({ task, cost, perKg: totalNetKg > 0 ? cost/totalNetKg : 0 }))
    .sort((a,b) => b.cost - a.cost);

  const netMarginPerKg = avgRate - deductionLossPerKg - workerPerKg - maintenancePerKg;

  return {
    totalNetKg, totalGrossKg, totalDeductedKg, avgRate,
    deductionLossValue, deductionLossPerKg,
    totalWorkerPay, workerPerKg,
    totalMaintenance, maintenancePerKg, taskBreakdown,
    netMarginPerKg,
  };
}

export function agentRateLog(harvest) {
  const map = {};
  harvest.forEach(h => {
    if (!h.agent || !h.rate) return;
    const key = h.agent + '|' + h.rate;
    if (!map[key]) map[key] = { agent: h.agent, rate: h.rate, from: h.date, to: h.date, sessions: 0, netKg: 0, confirmed: h.rateStatus === 'confirmed' };
    map[key].sessions += 1;
    map[key].netKg += h.tNet || 0;
    if (!map[key].from || h.date < map[key].from) map[key].from = h.date;
    if (!map[key].to   || h.date > map[key].to)   map[key].to   = h.date;
    if (h.rateStatus === 'confirmed') map[key].confirmed = true;
  });
  return Object.values(map).sort((a, b) => (b.to || '').localeCompare(a.to || '') || (a.agent || '').localeCompare(b.agent || ''));
}

// Payment status per harvest row (auto-derived, nothing extra to store) ──
// Settlements/agent payments are recorded as lump sums (e.g. one payment
// covering several harvest sessions). This allocates each lump payment
// against the underlying sessions oldest-first (FIFO) so every harvest row
// can show its own paid amount / status / the date it was covered.
function fifoAllocate(rows, payments, rowAmountField, paymentAmountField, paymentDateField) {
  const sortedRows = [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const sortedPayments = [...payments]
    .filter(p => (p[paymentAmountField] || 0) > 0)
    .sort((a, b) => (a[paymentDateField] || '').localeCompare(b[paymentDateField] || ''));

  let payIdx = 0, remaining = 0, currentDate = null;
  const result = {};
  for (const row of sortedRows) {
    let need = row[rowAmountField] || 0;
    let paid = 0, lastDate = null;
    while (need > 0.01) {
      if (remaining <= 0.01) {
        if (payIdx >= sortedPayments.length) break;
        remaining = sortedPayments[payIdx][paymentAmountField] || 0;
        currentDate = sortedPayments[payIdx][paymentDateField] || null;
        payIdx++;
      }
      const take = Math.min(need, remaining);
      paid += take; remaining -= take; need -= take;
      lastDate = currentDate;
    }
    const total = row[rowAmountField] || 0;
    const status = total <= 0 ? 'n/a' : paid >= total - 0.01 ? 'paid' : paid > 0 ? 'partial' : 'pending';
    result[row.id] = { paidAmount: paid, status, date: lastDate };
  }
  return result;
}

// Groups rows/payments by a key (worker or agent name) before allocating,
// so payments only settle sessions for the same person.
function fifoAllocateGrouped(rows, payments, groupField, rowAmountField, paymentGroupField, paymentAmountField, paymentDateField) {
  const groups = [...new Set(rows.map(r => r[groupField]).filter(Boolean))];
  let out = {};
  groups.forEach(g => {
    const gRows = rows.filter(r => r[groupField] === g);
    const gPayments = payments.filter(p => p[paymentGroupField] === g);
    out = { ...out, ...fifoAllocate(gRows, gPayments, rowAmountField, paymentAmountField, paymentDateField) };
  });
  return out;
}

// Returns harvest array with workerPay*/agentPay* status fields merged in.
// If a row has been edited directly (workerPayAmount / agentPayAmount set
// explicitly, e.g. via the inline cell in Log Harvest), that value wins.
// Otherwise it falls back to the FIFO allocation of lump-sum settlements /
// agent payments, so bulk "pay the whole week at once" recording still works.
export function enrichHarvestWithPaymentStatus(harvest, settlements, agentPayments) {
  // Rows with an explicit inline override must NOT consume any of the legacy
  // bulk-payment pool — otherwise that money gets "spent" on a row whose
  // answer we discard anyway, leaving less for the rows that actually rely
  // on FIFO allocation and throwing off everyone else's totals.
  const workerFifoRows = harvest.filter(h => h.workerPayAmount == null);
  const agentFifoRows  = harvest.filter(h => h.agentPayAmount  == null);
  const workerAlloc = fifoAllocateGrouped(workerFifoRows, settlements, 'worker', 'workerPay', 'worker', 'netPaid', 'date');
  const agentAlloc   = fifoAllocateGrouped(agentFifoRows, agentPayments, 'agent', 'agentRev', 'agent', 'amount', 'date');
  return harvest.map(h => {
    const hasOwnWorker = h.workerPayAmount != null;
    const hasOwnAgent  = h.agentPayAmount  != null;
    const wLegacy = workerAlloc[h.id] || {};
    const aLegacy = agentAlloc[h.id]  || {};
    const workerPayAmount = hasOwnWorker ? h.workerPayAmount : (wLegacy.paidAmount || 0);
    const agentPayAmount  = hasOwnAgent  ? h.agentPayAmount  : (aLegacy.paidAmount || 0);
    const workerPayDate   = hasOwnWorker ? (h.workerPayDate || null) : (wLegacy.date || null);
    const agentPayDate    = hasOwnAgent  ? (h.agentPayDate  || null) : (aLegacy.date || null);
    const workerPayStatus = !h.workerPay ? 'n/a' : workerPayAmount >= h.workerPay - 0.5 ? 'paid' : workerPayAmount > 0 ? 'partial' : 'pending';
    const agentPayStatus  = !h.agentRev  ? 'n/a' : agentPayAmount  >= h.agentRev - 0.5  ? 'paid' : agentPayAmount  > 0 ? 'partial' : 'pending';
    return { ...h, workerPayAmount, workerPayDate, workerPayStatus, agentPayAmount, agentPayDate, agentPayStatus };
  });
}

// Tea Field Leases
export const leaseService = {
  subscribe(cb) {
    return onSnapshot(collection(db, 'tea_field_leases'), snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },
  async add(data) {
    return addDoc(collection(db, 'tea_field_leases'), { ...data, createdAt: serverTimestamp() });
  },
  async update(id, data) {
    return updateDoc(doc(db, 'tea_field_leases', id), data);
  },
  async delete(id) {
    return deleteDoc(doc(db, 'tea_field_leases', id));
  },
};
