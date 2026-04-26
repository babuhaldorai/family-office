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

export function workerUnpaidWages(workerName, harvest, advances, settlements) {
  const totalEarned = harvest.filter(e => e.worker === workerName).reduce((s, e) => s + (e.workerPay || 0), 0);
  const pendingAdv  = advances.filter(a => a.worker === workerName && !a.deducted).reduce((s, a) => s + (a.amount || 0), 0);
  const paid        = settlements.filter(s => s.worker === workerName).reduce((s, x) => s + (x.netPaid || 0), 0);
  return Math.max(0, totalEarned - pendingAdv - paid);
}

export function agentPendingBreakdown(harvest, agentPayments) {
  const harvestAgents  = [...new Set(harvest.map(h => h.agent).filter(Boolean))];
  const paymentAgents  = [...new Set(agentPayments.map(p => p.agent).filter(Boolean))];
  const allAgents = [...new Set([...harvestAgents, ...paymentAgents])];
  return allAgents.map(a => {
    const hEntries = harvest.filter(e => e.agent === a);
    const earned   = hEntries.reduce((s, e) => s + (e.agentRev || 0), 0);
    const totalKg  = hEntries.reduce((s, e) => s + (e.tNet || 0), 0);
    const sessions = hEntries.length;
    const received = agentPayments.filter(p => p.agent === a).reduce((s, p) => s + (p.amount || 0), 0);
    const avgRate  = totalKg > 0 ? earned / totalKg : 0;
    return { agent: a, earned, received, pending: Math.max(0, earned - received), totalKg, sessions, avgRate };
  }).filter(x => x.earned > 0 || x.received > 0);
}
