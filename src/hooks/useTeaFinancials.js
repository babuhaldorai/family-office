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

export function useTeaFinancials(year, { includeMaintenance = true } = {}) {
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

        // Fetch maintenance only when requested (Overview fetches it separately to avoid duplication)
        let maintain = [];
        if (includeMaintenance) {
          try {
            const all = await getDocs(col('tea_maintenance'));
            maintain = snap2arr(all);
          } catch { maintain = []; }
        }

        // Fetch leases for this specific year only
        let leaseRecs = [];
        try {
          const ls = await getDocs(col('tea_field_leases'));
          leaseRecs = snap2arr(ls).filter(l => {
            const ly = l.year ? Number(l.year)
                     : l.startDate ? new Date(l.startDate).getFullYear()
                     : year;
            return ly === year;
          });
        } catch { leaseRecs = []; }

        if (cancelled) return;

        const txs = [];

        // Income: field lease payments
        leaseRecs.forEach(l => {
          const amt = l.amount || 0;
          if (amt <= 0) return;
          txs.push({
            date: l.startDate, type: 'income', category: 'Field Lease',
            amount: amt, month: parseMonth(l), year: parseYear(l, year),
            segment: 'Tea',
          });
        });

        // Income: agent revenue
        harvest.forEach(h => {
          const rev = h.agentRev || 0;
          if (rev <= 0) return;
          txs.push({
            id: `income-${h.id}`,  // unique per harvest session
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
            id: `labour-${h.id}`,  // unique per harvest session
            date: h.date, type: 'expense', category: 'Labour',
            amount: wages, month: parseMonth(h), year: parseYear(h, year),
            segment: 'Tea',
          });
        });

        // Expense: maintenance tasks — include all records
        maintain.forEach(m => {
          const cost = m.cost || 0;
          if (cost <= 0) return;
          const mo = parseMonth(m);
          const yr = parseYear(m, year); // actual year of the record
          const date = m.date || `${yr}-${String(mo).padStart(2,'0')}-15`;
          txs.push({
            id: `maint-${m.id}`,  // unique per maintenance record
            date, type: 'expense',
            category: m.task || 'Maintenance',
            amount: cost, month: mo, year: yr,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  return { transactions, loading };
}

export function useTeaDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [harvestSnap, maintSnap, leaseSnap, settlementSnap] = await Promise.all([
          getDocs(col('tea_harvest')),
          getDocs(col('tea_maintenance')),
          getDocs(col('tea_field_leases')),
          getDocs(col('tea_settlements')),
        ]);
        const harvest     = snap2arr(harvestSnap);
        const maintenance = snap2arr(maintSnap);
        const leaseRecs   = snap2arr(leaseSnap);
        const settles     = snap2arr(settlementSnap);

        const now  = new Date(), day = now.getDay();
        const mon  = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
        const monS = mon.toISOString().slice(0, 10);
        const sunS = sun.toISOString().slice(0, 10);

        const cwH       = harvest.filter(h => h.date >= monS && h.date <= sunS);
        const cwKg      = cwH.reduce((s, h) => s + (h.tNet      || 0), 0);
        const cwRevenue = cwH.reduce((s, h) => s + (h.agentRev  || 0), 0);

        const harvestRevenue = harvest.reduce((s, h) => s + (h.agentRev || 0), 0);
        const leaseRevenue   = leaseRecs.reduce((s, l) => s + (Number(l.amount)  || 0), 0);
        const totalRevenue   = harvestRevenue + leaseRevenue;
        const totalWages   = harvest.reduce((s, h)     => s + (h.workerPay || 0), 0);
        const totalSettled   = settles.reduce((s, st)    => s + (Number(st.netPaid)|| 0), 0);
        const unpaidWages    = Math.max(0, totalWages - totalSettled);
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
          totalSettled,
          unpaidWages,
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
