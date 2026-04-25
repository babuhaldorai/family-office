/**
 * useTeaFinancials(year)
 * Reads from Chaaya tea collections and returns flat income/expense
 * records compatible with the Family Office P&L engine.
 */
import { useState, useEffect } from 'react';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../firebase';

const col = (name) => collection(db, name);
const snap2arr = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));

export function useTeaFinancials(year) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [harvestSnap, maintSnap] = await Promise.all([
          getDocs(query(col('tea_harvest'), where('year', '==', year))),
          getDocs(query(col('tea_maintenance'), where('year', '==', year))),
        ]);
        const harvest  = snap2arr(harvestSnap);
        const maintain = snap2arr(maintSnap);
        if (cancelled) return;

        const txs = [];

        // Income: agent revenue per harvest session
        harvest.forEach(h => {
          const rev = h.agentRev || 0;
          const m   = h.month || (h.date ? new Date(h.date).getMonth() + 1 : null);
          const y   = h.year  || (h.date ? new Date(h.date).getFullYear()  : year);
          if (rev > 0 && m) txs.push({ date: h.date, type: 'income', category: 'Tea Sales', amount: rev, month: m, year: y, segment: 'Tea', rateStatus: h.rateStatus || 'confirmed' });
        });

        // Expense: worker wages per harvest session
        harvest.forEach(h => {
          const wages = h.workerPay || 0;
          const m     = h.month || (h.date ? new Date(h.date).getMonth() + 1 : null);
          const y     = h.year  || (h.date ? new Date(h.date).getFullYear()  : year);
          if (wages > 0 && m) txs.push({ date: h.date, type: 'expense', category: 'Labour', amount: wages, month: m, year: y, segment: 'Tea' });
        });

        // Expense: maintenance costs
        maintain.forEach(m => {
          const cost = m.cost || 0;
          const mo   = m.month || (m.date ? new Date(m.date).getMonth() + 1 : null);
          const y    = m.year  || (m.date ? new Date(m.date).getFullYear()  : year);
          if (cost > 0 && mo) txs.push({ date: m.date, type: 'expense', category: m.task || 'Maintenance', amount: cost, month: mo, year: y, segment: 'Tea' });
        });

        setTransactions(txs);
      } catch (e) {
        console.error('useTeaFinancials error:', e);
        setTransactions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [year]);

  return { transactions, loading };
}

/**
 * useTeaDashboard()
 * Current-week KPIs for the main Dashboard widget.
 */
export function useTeaDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [harvestSnap, ratesSnap, maintSnap] = await Promise.all([
          getDocs(col('tea_harvest')),
          getDocs(col('tea_market_rates')),
          getDocs(col('tea_maintenance')),
        ]);
        const harvest     = snap2arr(harvestSnap);
        const maintenance = snap2arr(maintSnap);

        // Current week bounds
        const now  = new Date(), day = now.getDay();
        const mon  = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
        const monS = mon.toISOString().slice(0, 10);
        const sunS = sun.toISOString().slice(0, 10);

        const cwH       = harvest.filter(h => h.date >= monS && h.date <= sunS);
        const cwKg      = cwH.reduce((s, h) => s + (h.tNet     || 0), 0);
        const cwRevenue = cwH.reduce((s, h) => s + (h.agentRev || 0), 0);
        const cwWages   = cwH.reduce((s, h) => s + (h.workerPay|| 0), 0);

        const totalRevenue  = harvest.reduce((s, h)     => s + (h.agentRev  || 0), 0);
        const totalWages    = harvest.reduce((s, h)     => s + (h.workerPay || 0), 0);
        const totalMaint    = maintenance.reduce((s, m) => s + (m.cost      || 0), 0);
        const pendingRateUpdate = harvest.some(h => h.rateStatus === 'placeholder');

        setData({
          cwKg, cwRevenue, cwWages,
          totalIncome:  totalRevenue,
          totalExpense: totalWages + totalMaint,
          totalWages,
          totalMaint,
          pendingRateUpdate,
        });
      } catch (e) {
        console.error('useTeaDashboard error:', e);
      }
    }
    load();
  }, []);

  return data;
}
