/**
 * teaService.js — Chaaya Plantation Manager
 * Firestore service layer matching the Chaaya app collections exactly.
 *
 * Collections (matching firebase-config.js):
 *   harvest          — per-session harvest entries (multi-bag)
 *   advances         — worker advance payments
 *   maintenance      — field maintenance logs
 *   market_rates     — per-agent weekly market rates
 *   weather_data     — rainfall / temperature logs
 *   settlements      — worker pay settlements
 *   agent_payments   — agent revenue payments received
 *   workers          — worker master data
 *   agents           — agent master data
 *   fields           — field master data
 */

import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, Timestamp, where
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Collection names (match Chaaya firebase-config.js) ─────────────────────
export const COLS = {
  harvest:       'harvest',
  advances:      'advances',
  maintenance:   'maintenance',
  rates:         'market_rates',
  weather:       'weather_data',
  settlements:   'settlements',
  agentPayments: 'agent_payments',
  workers:       'workers',
  agents:        'agents',
  fields:        'fields',
};

const col   = (name) => collection(db, name);
const snap  = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
const now   = ()     => Timestamp.now();

// ─── Money formatter ─────────────────────────────────────────────────────────
export const inr = (v) =>
  '₹' + Math.round(+v || 0).toLocaleString('en-IN');

export const inrExact = (v) =>
  '₹' + (+v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Bag maths (fixed ₹6/kg worker rate as per Chaaya) ──────────────────────
export const WORKER_RATE = 6; // ₹ per kg — fixed

export function calcBagNet(bag) {
  return Math.max(0, (+bag.gross || 0) - (+bag.bagWt || 0) - (+bag.waterKg || 0));
}

export function calcBagWaterPct(bag) {
  return bag.gross > 0 ? ((+bag.waterKg || 0) / +bag.gross) * 100 : 0;
}

export function getSessionTotals(bags, deductMode, totalBag, totalWaterKg) {
  const tGross = bags.reduce((s, b) => s + (+b.gross || 0), 0);
  let tBagDed, tWaterDed, tNet;
  if (deductMode === 'perbag') {
    tBagDed   = bags.reduce((s, b) => s + (+b.bagWt || 0), 0);
    tWaterDed = bags.reduce((s, b) => s + (+b.waterKg || 0), 0);
    tNet      = bags.reduce((s, b) => s + calcBagNet(b), 0);
  } else {
    tBagDed   = +totalBag   || 0;
    tWaterDed = +totalWaterKg || 0;
    tNet      = Math.max(0, tGross - tBagDed - tWaterDed);
  }
  const avgWaterPct = tGross > 0 ? (tWaterDed / tGross) * 100 : 0;
  return { tGross, tBagDed, tWaterDed, tNet, avgWaterPct };
}

// Find applicable market rate for a given agent + date
export function getRateForAgentDate(rates, agentName, dateStr) {
  if (!dateStr || !agentName) return null;
  const agentRates = rates
    .filter(r => r.agent === agentName)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  // 1. Exact period match
  const exact = agentRates.filter(r => r.startDate <= dateStr && (!r.endDate || r.endDate >= dateStr));
  if (exact.length) return { ...exact[0], isPlaceholder: false };
  // 2. Most recent prior rate
  const prior = agentRates.filter(r => r.startDate < dateStr);
  if (prior.length) return { ...prior[0], isPlaceholder: true };
  // 3. Any rate
  if (agentRates.length) return { ...agentRates[0], isPlaceholder: true };
  return null;
}

// ─── HARVEST ─────────────────────────────────────────────────────────────────
export const harvestService = {
  async getAll() {
    const s = await getDocs(query(col(COLS.harvest), orderBy('createdAt', 'desc')));
    return snap(s);
  },
  async getByYear(year) {
    const s = await getDocs(query(col(COLS.harvest), where('year', '==', year), orderBy('createdAt', 'desc')));
    return snap(s);
  },
  async add(data) {
    return addDoc(col(COLS.harvest), { ...data, createdAt: now() });
  },
  async update(id, data) {
    return updateDoc(doc(db, COLS.harvest, id), { ...data, updatedAt: now() });
  },
  async delete(id) {
    return deleteDoc(doc(db, COLS.harvest, id));
  },
};

// ─── ADVANCES ────────────────────────────────────────────────────────────────
export const advanceService = {
  async getAll() {
    const s = await getDocs(query(col(COLS.advances), orderBy('createdAt', 'desc')));
    return snap(s);
  },
  async add(data)        { return addDoc(col(COLS.advances), { ...data, createdAt: now() }); },
  async update(id, data) { return updateDoc(doc(db, COLS.advances, id), data); },
  async delete(id)       { return deleteDoc(doc(db, COLS.advances, id)); },
  async markDeducted(id) { return updateDoc(doc(db, COLS.advances, id), { deducted: true }); },
};

// ─── MAINTENANCE ─────────────────────────────────────────────────────────────
export const maintenanceService = {
  async getAll() {
    const s = await getDocs(query(col(COLS.maintenance), orderBy('createdAt', 'desc')));
    return snap(s);
  },
  async add(data)  { return addDoc(col(COLS.maintenance), { ...data, createdAt: now() }); },
  async delete(id) { return deleteDoc(doc(db, COLS.maintenance, id)); },
};

// ─── MARKET RATES ────────────────────────────────────────────────────────────
export const rateService = {
  async getAll() {
    const s = await getDocs(query(col(COLS.rates), orderBy('startDate', 'desc')));
    return snap(s);
  },
  async add(data)        { return addDoc(col(COLS.rates), { ...data, createdAt: now() }); },
  async delete(id)       { return deleteDoc(doc(db, COLS.rates, id)); },
  async update(id, data) { return updateDoc(doc(db, COLS.rates, id), data); },
};

// ─── WEATHER ─────────────────────────────────────────────────────────────────
export const weatherService = {
  async getAll() {
    const s = await getDocs(query(col(COLS.weather), orderBy('date', 'desc')));
    return snap(s);
  },
  async add(data)  { return addDoc(col(COLS.weather), { ...data, createdAt: now() }); },
  async delete(id) { return deleteDoc(doc(db, COLS.weather, id)); },
};

// ─── SETTLEMENTS (worker) ────────────────────────────────────────────────────
export const settlementService = {
  async getAll() {
    const s = await getDocs(query(col(COLS.settlements), orderBy('createdAt', 'desc')));
    return snap(s);
  },
  async add(data)        { return addDoc(col(COLS.settlements), { ...data, createdAt: now() }); },
  async update(id, data) { return updateDoc(doc(db, COLS.settlements, id), { ...data, updatedAt: now() }); },
  async delete(id)       { return deleteDoc(doc(db, COLS.settlements, id)); },
};

// ─── AGENT PAYMENTS ──────────────────────────────────────────────────────────
export const agentPaymentService = {
  async getAll() {
    const s = await getDocs(query(col(COLS.agentPayments), orderBy('createdAt', 'desc')));
    return snap(s);
  },
  async add(data)        { return addDoc(col(COLS.agentPayments), { ...data, createdAt: now() }); },
  async update(id, data) { return updateDoc(doc(db, COLS.agentPayments, id), { ...data, updatedAt: now() }); },
  async delete(id)       { return deleteDoc(doc(db, COLS.agentPayments, id)); },
};

// ─── WORKERS ─────────────────────────────────────────────────────────────────
export const workerService = {
  async getAll() {
    const s = await getDocs(col(COLS.workers));
    return snap(s);
  },
  async add(data)        { return addDoc(col(COLS.workers), { ...data, createdAt: now() }); },
  async update(id, data) { return updateDoc(doc(db, COLS.workers, id), { ...data, updatedAt: now() }); },
  async delete(id)       { return deleteDoc(doc(db, COLS.workers, id)); },
};

// ─── AGENTS ──────────────────────────────────────────────────────────────────
export const agentService = {
  async getAll() {
    const s = await getDocs(col(COLS.agents));
    return snap(s);
  },
  async add(data)        { return addDoc(col(COLS.agents), { ...data, createdAt: now() }); },
  async update(id, data) { return updateDoc(doc(db, COLS.agents, id), { ...data, updatedAt: now() }); },
  async delete(id)       { return deleteDoc(doc(db, COLS.agents, id)); },
};

// ─── FIELDS ──────────────────────────────────────────────────────────────────
export const fieldService = {
  async getAll() {
    const s = await getDocs(col(COLS.fields));
    return snap(s);
  },
  async add(data)        { return addDoc(col(COLS.fields), { ...data, createdAt: now() }); },
  async update(id, data) { return updateDoc(doc(db, COLS.fields, id), { ...data, updatedAt: now() }); },
  async delete(id)       { return deleteDoc(doc(db, COLS.fields, id)); },
};

// ─── Finance helpers (used by Family Office P&L integration) ─────────────────

// Convert Chaaya harvest data into flat income/expense transactions for P&L engine
export function teaToTransactions(harvests, advances, maintenance, settlements, agentPayments, year) {
  const txs = [];
  const y = Number(year);

  // INCOME: use agent payments received (actual cash in)
  const agentPmts = agentPayments.filter(p => new Date(p.date).getFullYear() === y);
  if (agentPmts.length > 0) {
    agentPmts.forEach(p => {
      const d = new Date(p.date);
      txs.push({ date: p.date, type: 'income', category: 'Tea Sales', amount: p.amount, month: d.getMonth() + 1, year: y });
    });
  } else {
    // Fall back to accrued harvest revenue
    harvests.filter(h => h.year === y).forEach(h => {
      const d = new Date(h.date);
      txs.push({ date: h.date, type: 'income', category: 'Tea Sales', amount: h.agentRev || 0, month: d.getMonth() + 1, year: y });
    });
  }

  // EXPENSES: worker settlements paid
  const workerPmts = settlements.filter(s => new Date(s.date).getFullYear() === y);
  if (workerPmts.length > 0) {
    workerPmts.forEach(s => {
      const d = new Date(s.date);
      txs.push({ date: s.date, type: 'expense', category: 'Labour', amount: s.netPaid || 0, month: d.getMonth() + 1, year: y });
    });
  } else {
    // Fall back to accrued worker pay
    harvests.filter(h => h.year === y).forEach(h => {
      const d = new Date(h.date);
      txs.push({ date: h.date, type: 'expense', category: 'Labour', amount: h.workerPay || 0, month: d.getMonth() + 1, year: y });
    });
  }

  // EXPENSES: maintenance costs
  maintenance.filter(m => new Date(m.date).getFullYear() === y).forEach(m => {
    const d = new Date(m.date);
    txs.push({ date: m.date, type: 'expense', category: m.task || 'Maintenance', amount: m.cost || 0, month: d.getMonth() + 1, year: y });
  });

  // EXPENSES: advances (non-deducted = net cash out)
  advances.filter(a => !a.deducted && new Date(a.date).getFullYear() === y).forEach(a => {
    const d = new Date(a.date);
    txs.push({ date: a.date, type: 'expense', category: 'Advances', amount: a.amount || 0, month: d.getMonth() + 1, year: y });
  });

  return txs;
}
