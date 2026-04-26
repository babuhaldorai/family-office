import { useState, useEffect } from 'react';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../firebase';

const col = (name) => collection(db, name);
const snap2arr = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));

function parseMonth(record) {
  if (record.month) return Number(record.month);
  if (record.date)  return new Date(record.date).getMonth() + 1;
  return 1; // fallback to Jan — still show the record
}

function parseYear(record, fallback) {
  if (record.year) return Number(record.year);
  if (record.date) return new Date(record.date).getFullYear();
  return fallback;
}

export function useTeaFinancials(year) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Fetch harvest for the year
        const harvestSnap = await getDocs(
          query(col('tea_harvest'), where('year', '==', year))
        );
        const harvest = snap2arr(harvestSnap);

        // Fetch maintenance — try with year filter first, fall back to all
        // (old records may not have year field)
        let maintain = [];
        try {
          const ms = await getDocs(
            query(col('tea_maintenance'), where('year', '==', year))
          );
          maintain = snap2arr(ms);
          // If nothing came back, fetch all and filter by date
          if (maintain.length === 0) {
            const all = await getDocs(col('tea_maintenance'));
            maintain = snap2arr(all).filter(m => {
              const y = parseYear(m, year);
              return y === year;
            });
          }
        } catch {
          const all = await getDocs(col('tea_maintenance'));
          maintain = snap2arr(all).filter(m => parseYear(m, year) === year);
        }

        if (cancelled) return;

        const txs = [];

        // Income: agent revenue
        harvest.forEach(h => {
          const rev = h.agentRev || 0;
          if (rev <= 0) return;
          txs.push({
            date: h.date, type: 'income', category: 'Tea Sales',
            amount: rev, month: parseMonth(h), year: parseYear(h, year),
            segment: 'Tea', rateStatus: h.rateStatus || 'confirmed',
          });
        });

        // Expense: worker wages
        harvest.forEach(h => {
          const wages = h.workerPay || 0;
          if (wages <= 0) return;
          txs.push({
            date: h.date, type: 'expense', category: 'Labour',
            amount: wages, month: parseMonth(h), year: parseYear(h, year),
            segment: 'Tea',
          });
        });

        // Expense: maintenance tasks — always include, even without month
        maintain.forEach(m => {
          const cost = m.cost || 0;
          if (cost <= 0) return;
          txs.push({
            date: m.date, type: 'expense',
            category: m.task || 'Maintenance',  // Pruning, Weeding, etc.
            amount: cost, month: parseMonth(m), year: parseYear(m, year),
            segment: 'Tea',
          });
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

export function useTeaDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [harvestSnap, maintSnap] = await Promise.all([
          getDocs(col('tea_harvest')),
          getDocs(col('tea_maintenance')),
        ]);
        const harvest     = snap2arr(harvestSnap);
        const maintenance = snap2arr(maintSnap);

        const now  = new Date(), day = now.getDay();
        const mon  = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
        const monS = mon.toISOString().slice(0, 10);
        const sunS = sun.toISOString().slice(0, 10);

        const cwH       = harvest.filter(h => h.date >= monS && h.date <= sunS);
        const cwKg      = cwH.reduce((s, h) => s + (h.tNet      || 0), 0);
        const cwRevenue = cwH.reduce((s, h) => s + (h.agentRev  || 0), 0);

        const totalRevenue = harvest.reduce((s, h)     => s + (h.agentRev  || 0), 0);
        const totalWages   = harvest.reduce((s, h)     => s + (h.workerPay || 0), 0);
        const totalMaint   = maintenance.reduce((s, m) => s + (m.cost      || 0), 0);

        // Per-task breakdown for dashboard
        const maintByTask = maintenance.reduce((acc, m) => {
          const k = m.task || 'Maintenance';
          acc[k] = (acc[k] || 0) + (m.cost || 0);
          return acc;
        }, {});

        setData({
          cwKg, cwRevenue,
          totalIncome:   totalRevenue,
          totalExpense:  totalWages + totalMaint,
          totalWages,
          totalMaint,
          maintByTask,
          pendingRateUpdate: harvest.some(h => h.rateStatus === 'placeholder'),
        });
      } catch (e) {
        console.error('useTeaDashboard error:', e);
      }
    }
    load();
  }, []);

  return data;
}
