import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  harvestChaayaService, ratesChaayaService, settlementService,
  agentPaymentService, advanceService, maintenanceService, weatherService,
  workersChaayaService, agentsChaayaService, fieldsChaayaService,
  calcBagWaterPct, getRateForAgentDate, enrichHarvestWithPaymentStatus, lastKnownRate, consumeWorkerAdvance,
  periodBounds, getFilteredHarvest, weekLabel, todayStr,
} from '../utils/chaayaService';
import { useAuth } from '../context/AuthContext';
import {addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc} from 'firebase/firestore';
import { db } from '../firebase';
import { TABS, currentWeekLabel } from './tea/chaayaStyles';
import DashboardTab from './tea/DashboardTab';
import HarvestHub from './tea/HarvestHub';
import { AdvancesTab, MaintenanceTab, WeatherTab } from './tea/OperationsTabs';
import { AnalyticsTab, AgentAnalyticsTab } from './tea/AnalyticsTabs';
import PeopleTab, { EntityModal } from './tea/PeopleTab';
import { WorkerSettleModal, AgentPayModal } from './tea/SettleModals';
import LeaseTab from './tea/LeaseTab';
import TeaYOY from './tea/TeaYOY';


export default function TeaPage() {
  const { isAdmin, user: authUser } = useAuth();
  const userEmail = authUser?.email || 'unknown';
  const writeAudit = async (action, col, summary) => {
    try {
      await addDoc(collection(db, 'audit_log'), {
        action, collection: col,
        summary: summary || '',
        userEmail: userEmail || 'unknown',
        timestamp: serverTimestamp(),
      });
    } catch(e) {
      console.error('[Audit fail]', e.code, e.message);
    }
  };

  // ── Referential integrity checks before deletes ──────────────────────────
  const checkBeforeDelete = async (type, id, record) => {
    switch(type) {

      case 'market_rate': {
        const rate = record;
        // Rate uses startDate/endDate (not fromDate/toDate)
        const from = rate.startDate || rate.fromDate || '2000-01-01';
        const to   = rate.endDate   || rate.toDate;
        const used = harvest.filter(h =>
          (h.agent === rate.agent || h.agentName === rate.agent) &&
          h.date >= from &&
          (!to || h.date <= to)
        );
        if (used.length > 0) {
          alert(`❌ Cannot delete this rate — it is used by ${used.length} harvest session(s) for agent "${rate.agent}" between ${from} and ${to||'now'}.

Delete those harvest sessions first.`);
          return false;
        }
        return true;
      }

      case 'field': {
        // Cannot delete if field has harvest or maintenance
        const usedH = harvest.filter(h => h.field === record.name);
        const usedM = maintenance.filter(m => m.field === record.name);
        const usedL = leases.filter(l => l.field === record.name);
        if (usedH.length + usedM.length + usedL.length > 0) {
          alert(`❌ Cannot delete field "${record.name}" — it has ${usedH.length} harvest session(s), ${usedM.length} maintenance record(s), and ${usedL.length} lease(s).

Delete those records first.`);
          return false;
        }
        return true;
      }

      case 'worker': {
        // Cannot delete if worker has harvest sessions or settlements
        const usedH = harvest.filter(h => h.worker === record.name);
        const usedS = settlements.filter(s => s.worker === record.name);
        const usedA = advances.filter(a => a.worker === record.name);
        if (usedH.length + usedS.length + usedA.length > 0) {
          alert(`❌ Cannot delete worker "${record.name}" — they have ${usedH.length} harvest session(s), ${usedS.length} settlement(s), and ${usedA.length} advance(s).

Delete those records first.`);
          return false;
        }
        return true;
      }

      case 'agent': {
        // Cannot delete if agent has harvest sessions or payments
        const usedH = harvest.filter(h => h.agent === record.name);
        const usedP = agentPayments.filter(p => p.agent === record.name);
        if (usedH.length + usedP.length > 0) {
          alert(`❌ Cannot delete agent "${record.name}" — they have ${usedH.length} harvest session(s) and ${usedP.length} payment(s).

Delete those records first.`);
          return false;
        }
        return true;
      }

      case 'lease': {
        // Cannot delete active lease if within lease period
        const today2 = new Date().toISOString().slice(0,10);
        if (record.startDate <= today2 && record.endDate >= today2) {
          const confirmed = window.confirm(`⚠️ This lease is currently ACTIVE (${record.startDate} to ${record.endDate}).

Deleting it will allow transactions on this field again. Are you sure?`);
          return confirmed;
        }
        return true;
      }

      default:
        return true;
    }
  };

  const [tab, setTab] = useState('dashboard');
  const [harvestSubTab, setHarvestSubTab] = useState('log');

  const [harvest, setHarvest]         = useState([]);
  const [rates, setRates]             = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [agentPayments, setAgentPayments] = useState([]);
  const [advances, setAdvances]       = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [weather, setWeather]         = useState([]);
  const [leases,  setLeases]          = useState([]);

  // Load leases directly from Firestore
  useEffect(() => {
    getDocs(collection(db, 'tea_field_leases'))
      .then(snap => setLeases(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setLeases([]));
  }, []);

  // Fields on lease for a GIVEN date (not just today)
  // Used to block harvest/maintenance only when the entry date is within the lease term
  const today = new Date().toISOString().slice(0, 10);
  const getActiveLeaseForFieldDate = (field, date) =>
    leases.find(l => l.field === field && l.startDate <= date && l.endDate >= date);
  // For the warning indicator (uses today)
  const leasedFields = new Set(
    leases.filter(l => l.startDate <= today && l.endDate >= today).map(l => l.field)
  );
  const [workers, setWorkers]         = useState([]);
  const [agents, setAgents]           = useState([]);
  const [fields, setFields]           = useState([]);

  const initP = () => { const b = periodBounds('this_month'); return { preset: 'this_month', ...b }; };
  const [dashPeriod, setDashPeriod] = useState(initP);
  const [anaPeriod,  setAnaPeriod]  = useState(initP);
  const [agtPeriod,  setAgtPeriod]  = useState(initP);

  const [bags, setBags]               = useState([]);
  const [deductMode, setDeductMode]   = useState('perbag');
  const [hDate, setHDate]             = useState(todayStr());
  const [hWorker, setHWorker]         = useState('');
  const [hField, setHField]           = useState('');
  const [hAgent, setHAgent]           = useState('');
  const [editingHarvestId, setEditingHarvestId] = useState(null);
  const [harvestFilter, setHarvestFilter]       = useState('all');
  const [savingHarvest, setSavingHarvest]       = useState(false);

  const [entityModal, setEntityModal]       = useState({ open: false, type: null, editing: null });
  const [workerSettleModal, setWorkerSettleModal] = useState({ open: false, worker: null, amount: 0, isFloat: false });
  const [editSettlement, setEditSettlement] = useState(null);
  const [agentPayModal, setAgentPayModal]   = useState({ open: false, agent: null });
  const [editAgentPayment, setEditAgentPayment] = useState(null);

  useEffect(() => {
    const subs = [
      harvestChaayaService.subscribe(setHarvest),
      ratesChaayaService.subscribe(setRates),
      settlementService.subscribe(setSettlements),
      agentPaymentService.subscribe(setAgentPayments),
      advanceService.subscribe(setAdvances),
      maintenanceService.subscribe(setMaintenance),
      weatherService.subscribe(setWeather),
      // leases loaded via useEffect below
      workersChaayaService.subscribe(setWorkers),
      agentsChaayaService.subscribe(setAgents),
      fieldsChaayaService.subscribe(setFields),
    ];
    return () => subs.forEach(u => u && u());
  }, []);

  const workerList = useMemo(() => {
    const a = workers.filter(w => w.status !== 'inactive').map(w => w.name).sort();
    return a;
  }, [workers]);
  const agentList = useMemo(() => {
    const a = agents.filter(a => a.status !== 'inactive').map(a => a.name).sort();
    return a;
  }, [agents]);
  const fieldList = useMemo(() => {
    const a = fields.map(f => f.name).sort();
    return a;
  }, [fields]);

  useEffect(() => { if (!hWorker && workerList[0]) setHWorker(workerList[0]); }, [workerList]); // eslint-disable-line
  useEffect(() => { if (!hAgent  && agentList[0])  setHAgent(agentList[0]);  }, [agentList]);  // eslint-disable-line
  useEffect(() => { if (!hField  && fieldList[0])  setHField(fieldList[0]);  }, [fieldList]);  // eslint-disable-line

  // ── Pending rate sessions count (⏳ estimated rate) ──────────────────────
  const pendingRateSessions = useMemo(
    () => harvest.filter(h => h.rateStatus === 'placeholder').length,
    [harvest]
  );

  const saveHarvest = async () => {
    if (!hDate)         return alert('❌ Please select a date.');
    if (!hField)        return alert('❌ Please select a field.');
    if (!hWorker)       return alert('❌ Please select a worker.');
    if (!hAgent)        return alert('❌ Please select an agent.');
    if (!bags.length)   return alert('❌ Add at least one bag.');
    const totalGross = bags.reduce((s,b)=>s+(b.gross||0),0);
    if (totalGross <= 0) return alert('❌ Total gross weight must be greater than 0.');
    const rateRec = getRateForAgentDate(rates, hAgent, hDate);
    let rate, rateStatus;
    if (rateRec) {
      rate = rateRec.rate;
      rateStatus = rateRec.isPlaceholder ? 'placeholder' : 'confirmed';
    } else {
      const fallback = lastKnownRate(harvest, hAgent);
      rate = fallback || 0;
      rateStatus = fallback ? 'placeholder' : 'no-rate';
    }
    const tGross     = bags.reduce((s, b) => s + (b.gross || 0), 0);
    // Deductions are stored as session totals on bag[0] only
    const tBagDed    = bags.length > 0 ? (bags[0].bagWt   || 0) : 0;
    const tWaterDed  = bags.length > 0 ? (bags[0].waterKg || 0) : 0;
    const tNet       = parseFloat((tGross - tBagDed - tWaterDed).toFixed(2));
    const avgWaterPct = tGross > 0 ? (tWaterDed / tGross * 100) : 0;
    const data = {
      date: hDate, worker: hWorker, field: hField, agent: hAgent,
      bags: bags.length, tGross, tBagDed, tWaterDed, tNet, avgWaterPct,
      bagDetails: bags.map(b => ({ ...b, waterPct: calcBagWaterPct(b) })),
      workerPay: Math.round(tNet * 6), agentRev: parseFloat((tNet * rate).toFixed(1)), rate, rateStatus,
      weekStr: weekLabel(hDate), year: new Date(hDate).getFullYear(),
      month: new Date(hDate).getMonth() + 1,
    };
    setSavingHarvest(true);
    let saved = false;
    const auditAction = editingHarvestId ? 'update' : 'create';
    try {
      if (editingHarvestId) {
        await harvestChaayaService.update(editingHarvestId, data);
      } else {
        await harvestChaayaService.add(data);
      }
      saved = true;
      setBags([]); setEditingHarvestId(null);
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { setSavingHarvest(false); }
    // Fire audit log after save completes - outside try/catch so it never blocks
    if (saved) writeAudit(auditAction,'tea_harvest',`${auditAction==='update'?'Updated':'Added'} harvest: ${data.field} on ${data.date}, net ${Number(data.tNet||0).toFixed(2)}kg`);
  };

  // Reset all harvest rows behind one aggregated "Harvest Log" payment-log
  // entry back to unpaid — same effect as the per-row Undo, just triggered
  // from the Worker/Agent Payments log view for convenience.
  const resetWorkerPaymentsForDate = async (worker, date) => {
    const rows = harvest.filter(h => h.worker === worker && h.workerPayDate === date && h.workerPayAmount > 0);
    if (!window.confirm(`Undo worker payment for ${worker} on ${date}? ${rows.length} session${rows.length!==1?'s':''} will show as unpaid again.`)) return;
    try {
      await Promise.all(rows.map(r => harvestChaayaService.update(r.id, { workerPayAmount: 0, workerPayDate: null })));
      writeAudit('update', 'tea_harvest', `Reset worker payment for ${worker} on ${date} (${rows.length} session${rows.length!==1?'s':''})`);
    } catch (e) { alert('Failed to reset: ' + e.message); }
  };
  const resetAgentPaymentsForDate = async (agent, date) => {
    const rows = harvest.filter(h => h.agent === agent && h.agentPayDate === date && h.agentPayAmount > 0);
    if (!window.confirm(`Undo agent payment for ${agent} on ${date}? ${rows.length} session${rows.length!==1?'s':''} will show as unpaid again.`)) return;
    try {
      await Promise.all(rows.map(r => harvestChaayaService.update(r.id, { agentPayAmount: 0, agentPayDate: null })));
      writeAudit('update', 'tea_harvest', `Reset agent payment for ${agent} on ${date} (${rows.length} session${rows.length!==1?'s':''})`);
    } catch (e) { alert('Failed to reset: ' + e.message); }
  };
  const deleteSettlementRecord = async (id) => {
    if (!window.confirm('Delete this bulk payment record? The sessions it covered (that don\'t have their own inline payment) will show as unpaid again.')) return;
    try { await settlementService.delete(id); writeAudit('delete', 'tea_settlements', `Deleted settlement ${id}`); }
    catch (e) { alert('Failed to delete: ' + e.message); }
  };
  const deleteAgentPaymentRecord = async (id) => {
    if (!window.confirm('Delete this bulk payment record? The sessions it covered (that don\'t have their own inline payment) will show as unpaid again.')) return;
    try { await agentPaymentService.delete(id); writeAudit('delete', 'tea_agent_payments', `Deleted agent payment ${id}`); }
    catch (e) { alert('Failed to delete: ' + e.message); }
  };

  const clearForm = () => { setBags([]); setEditingHarvestId(null); setHDate(todayStr()); };

  // Inline rate edit from the Harvest Log table — recalculates agent revenue
  // and rate status automatically, without touching the rest of the entry.
  const updateHarvestRate = async (id, newRate) => {
    const entry = harvest.find(h => h.id === id);
    if (!entry) return;
    const rate = Math.max(0, parseFloat(newRate) || 0);
    const agentRev = parseFloat(((entry.tNet || 0) * rate).toFixed(1));
    const rateStatus = rate > 0 ? 'confirmed' : 'no-rate';
    try {
      await harvestChaayaService.update(id, { rate, agentRev, rateStatus });
      writeAudit('update', 'tea_harvest', `Updated rate for ${entry.agent} on ${entry.date} to ₹${rate}/kg`);
    } catch (e) { alert('Failed to update rate: ' + e.message); }
  };

  // Inline worker/agent payment edit from the Harvest Log table — writes
  // straight onto that harvest row (amount + date), independent of any
  // lump-sum settlement recorded in the Worker/Agent Payments tabs.
  const updateHarvestWorkerPay = async (id, amount, date) => {
    const entry = harvest.find(h => h.id === id);
    if (!entry) return;
    const amt = Math.max(0, parseFloat(amount) || 0);
    try {
      await harvestChaayaService.update(id, { workerPayAmount: amt, workerPayDate: amt > 0 ? (date || todayStr()) : null });
      writeAudit('update', 'tea_harvest', `Updated worker payment for ${entry.worker} on ${entry.date} to ₹${amt}`);
    } catch (e) { alert('Failed to update worker payment: ' + e.message); }
  };
  const updateHarvestAgentPay = async (id, amount, date) => {
    const entry = harvest.find(h => h.id === id);
    if (!entry) return;
    const amt = Math.max(0, parseFloat(amount) || 0);
    try {
      await harvestChaayaService.update(id, { agentPayAmount: amt, agentPayDate: amt > 0 ? (date || todayStr()) : null });
      writeAudit('update', 'tea_harvest', `Updated agent payment for ${entry.agent} on ${entry.date} to ₹${amt}`);
    } catch (e) { alert('Failed to update agent payment: ' + e.message); }
  };

  // Marks a harvest row's worker pay fully settled (workerPayAmount = full
  // session earning, so the row shows Paid), and simultaneously nets that
  // amount against the worker's pending advances — so what actually gets
  // physically handed to the worker is the balance after the advance, while
  // the row itself is correctly accounted as settled either way. Only
  // advances borrowed on or before this session's date count — an advance
  // taken later shouldn't retroactively reduce an earlier session's payout.
  const payWorkerRowNetOfAdvance = async (id) => {
    const entry = harvest.find(h => h.id === id);
    if (!entry) return;
    const sessionAmount = entry.workerPay || 0;
    const pendingAdv = advances
      .filter(a => a.worker === entry.worker && !a.deducted && (a.date || '') <= (entry.date || ''))
      .reduce((s, a) => s + (a.amount || 0), 0);
    const advanceApplied = Math.min(pendingAdv, sessionAmount);
    const cash = parseFloat((sessionAmount - advanceApplied).toFixed(2));
    const d = todayStr();
    try {
      await harvestChaayaService.update(id, { workerPayAmount: sessionAmount, workerPayDate: d });
      if (advanceApplied > 0) await consumeWorkerAdvance(advances.filter(a => (a.date || '') <= (entry.date || '')), entry.worker, advanceApplied);
      writeAudit('update', 'tea_harvest',
        advanceApplied > 0
          ? `Paid ${entry.worker} on ${entry.date}: ₹${cash} cash + ₹${advanceApplied} netted from advance`
          : `Paid ${entry.worker} on ${entry.date}: ₹${cash} cash`);
    } catch (e) { alert('Failed to record payment: ' + e.message); }
  };

  // Plain "mark paid" — pays the full session amount in cash, without
  // netting any advance. Useful when you want to settle the advance
  // separately (e.g. deduct it from a different session).
  const payWorkerRowFull = async (id) => {
    const entry = harvest.find(h => h.id === id);
    if (!entry) return;
    const sessionAmount = entry.workerPay || 0;
    const d = todayStr();
    try {
      await harvestChaayaService.update(id, { workerPayAmount: sessionAmount, workerPayDate: d });
      writeAudit('update', 'tea_harvest', `Paid ${entry.worker} on ${entry.date}: ₹${sessionAmount} cash (no advance netted)`);
    } catch (e) { alert('Failed to record payment: ' + e.message); }
  };

  const editHarvestEntry = useCallback((entry) => {
    setEditingHarvestId(entry.id);
    setHDate(entry.date || todayStr());
    setHWorker(entry.worker  || workerList[0]);
    setHField(entry.field    || fieldList[0]);
    setHAgent(entry.agent    || agentList[0]);
    setBags(entry.bagDetails?.length
      ? entry.bagDetails
      : [{ gross: entry.tGross || 0, bagWt: entry.tBagDed || 0, waterKg: entry.tWaterDed || 0 }]);
    setTab('harvest');
    setHarvestSubTab('log');
  }, [workerList, fieldList, agentList]);

  const saveEntity = async (form) => {
    if (!form.name || !form.name.trim()) return alert(`❌ Please enter a name for this ${entityModal.type}.`);
    const { type, editing } = entityModal;
    const svc = type === 'worker' ? workersChaayaService : type === 'agent' ? agentsChaayaService : fieldsChaayaService;
    if (editing) { await svc.update(editing.id, form); writeAudit('update', type==='worker'?'workers':type==='agent'?'agents':'fields', `Updated ${type}: ${form.name||editing.id}`); }
    else         { await svc.add(form); writeAudit('create', type==='worker'?'workers':type==='agent'?'agents':'fields', `Added ${type}: ${form.name||''}`); }
    setEntityModal({ open: false, type: null, editing: null });
  };
  const deleteEntity = async (type, id) => {
    if (!window.confirm('Delete this record?')) return;
    const entityList = type==='worker'?workers:type==='agent'?agents:fields;
    const record = entityList.find(e=>e.id===id);
    const svc = type === 'worker' ? workersChaayaService : type === 'agent' ? agentsChaayaService : fieldsChaayaService;
    const ok = await checkBeforeDelete(type, id, record||{name:id});
    if (!ok) return;
    await svc.delete(id); writeAudit('delete', type==='worker'?'workers':type==='agent'?'agents':'fields', `Deleted ${type}: ${record?.name||id}`);
  };

  const saveWorkerSettlement = async (worker, amount, notes, isFloat, date) => {
    if (!worker)           return alert('❌ Please select a worker.');
    if (!amount || amount <= 0) return alert('❌ Please enter a valid amount.');
    const d = date || todayStr();
    await settlementService.add({ worker, netPaid: amount, date: d, notes, paidBeforeAgent: isFloat });
    writeAudit('create','tea_settlements',`Settlement: ${worker} paid ${amount} on ${d}`);
    setWorkerSettleModal({ open: false, worker: null, amount: 0, isFloat: false });
  };

  const saveAgentPayment = async (agent, amount, date, method, notes) => {
    if (!agent)            return alert('❌ Please select an agent.');
    if (!amount || amount <= 0) return alert('❌ Please enter a valid amount.');
    if (!date)             return alert('❌ Please select a date.');
    if (!amount) return alert('Enter amount');
    await agentPaymentService.add({ agent, amount, date, method, notes });
    writeAudit('create','tea_agent_payments',`Agent payment: ${agent} ${amount} on ${date}`);
    setAgentPayModal({ open: false, agent: null });
  };

  const dashH         = useMemo(() => getFilteredHarvest(harvest, dashPeriod),  [harvest, dashPeriod]);
  const anaH          = useMemo(() => getFilteredHarvest(harvest, anaPeriod),   [harvest, anaPeriod]);
  const agtH          = useMemo(() => getFilteredHarvest(harvest, agtPeriod),   [harvest, agtPeriod]);
  const harvestWeeks = useMemo(() => {
    const seen = new Set();
    const result = [];
    [...harvest].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(h => {
      const wk = h.weekStr || weekLabel(h.date);
      if (!wk || seen.has(wk)) return;
      seen.add(wk);
      // Calculate Mon-Sun dates for this week
      const d = new Date(h.date), day = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate() - (day===0?6:day-1));
      const sun = new Date(mon); sun.setDate(mon.getDate()+6);
      const f = dt => dt.toISOString().slice(0,10);
      result.push({ value: wk, label: `${wk}  (${f(mon)} → ${f(sun)})` });
    });
    return result;
  }, [harvest]);
  const harvestWithPay = useMemo(
    () => enrichHarvestWithPaymentStatus(harvest, settlements, agentPayments),
    [harvest, settlements, agentPayments]
  );
  const filteredHarvestWithPay = useMemo(
    () => harvestFilter === 'all' ? harvestWithPay : harvestWithPay.filter(e => (e.weekStr || weekLabel(e.date)) === harvestFilter),
    [harvestWithPay, harvestFilter]
  );

  return (
    <div className="ch-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🍃 Tea Plantation</h1>
          <p className="page-subtitle">Week: {currentWeekLabel()} · {harvest.length} sessions total</p>
        </div>
        {isAdmin && (
          <button className="ch-btn ch-btn-primary" onClick={() => { setTab('harvest'); setHarvestSubTab('log'); }}>+ Log Harvest</button>
        )}
      </div>

      <div className="page-content-inner">
        <div className="ch-tabs">
          {[...TABS, { key: 'lease', label: '🔑 Field Leases' }, { key: 'yoy', label: '📈 YOY' }].map(t => (
            <button key={t.key} className={`ch-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              {/* Show dot on harvest tab if pending rate sessions exist */}
              {t.key === 'harvest' && pendingRateSessions > 0 && (
                <span style={{ marginLeft: 5, background: 'var(--warn)', borderRadius: '50%', width: 7, height: 7, display: 'inline-block', verticalAlign: 'middle' }} />
              )}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <DashboardTab
            dashH={dashH} dashPeriod={dashPeriod} setDashPeriod={setDashPeriod}
            allHarvest={harvest}
            fields={fields} agentList={agentList}
            maintenance={maintenance} leases={leases}
            settlements={settlements} advances={advances}
            pendingRateSessions={pendingRateSessions}
          />
        )}
        {tab === 'harvest' && (
          <HarvestHub
            subTab={harvestSubTab} setSubTab={setHarvestSubTab}
            leasedFields={leasedFields}
            isAdmin={isAdmin} bags={bags} setBags={setBags}
            deductMode={deductMode} setDeductMode={setDeductMode}
            hDate={hDate} setHDate={setHDate}
            hWorker={hWorker} setHWorker={setHWorker}
            hField={hField} setHField={setHField}
            hAgent={hAgent} setHAgent={setHAgent}
            workerList={workerList} agentList={agentList} fieldList={fieldList}
            rates={rates} editingHarvestId={editingHarvestId}
            saveHarvest={saveHarvest} savingHarvest={savingHarvest}
            clearForm={clearForm}
            filteredHarvest={filteredHarvestWithPay} harvestFilter={harvestFilter}
            setHarvestFilter={setHarvestFilter} harvestWeeks={harvestWeeks}
            editHarvestEntry={editHarvestEntry}
            deleteHarvestEntry={async id => { if (window.confirm('Delete?')) { await harvestChaayaService.delete(id); writeAudit('delete','tea_harvest',`Deleted harvest ${id}`); } }}
            pendingRateSessions={pendingRateSessions}
            onUpdateRate={updateHarvestRate}
            onUpdateWorkerPay={updateHarvestWorkerPay}
            onUpdateAgentPay={updateHarvestAgentPay}
            onPayWorkerNetOfAdvance={payWorkerRowNetOfAdvance}
            onPayWorkerFull={payWorkerRowFull}
            harvest={harvest} settlements={settlements} advances={advances} agentPayments={agentPayments} maintenance={maintenance}
            onDeleteSettlement={deleteSettlementRecord}
            onDeleteAgentPayment={deleteAgentPaymentRecord}
            onResetWorkerLog={resetWorkerPaymentsForDate}
            onResetAgentLog={resetAgentPaymentsForDate}
          />
        )}
        {tab === 'advances' && (
          <AdvancesTab
            isAdmin={isAdmin} advances={advances} workerList={workerList}
            onSave={async data => { await advanceService.add(data); writeAudit('create','tea_advances',`Added advance: ${data.worker||data.agent||''} ${data.amount}`); }}
            onMarkDeducted={async id => { await advanceService.update(id,{deducted:true}); writeAudit('update','tea_advances',`Marked advance ${id} as deducted`); }}
            onDelete={async id => { if (window.confirm('Delete?')) { await advanceService.delete(id); writeAudit('delete','tea_advances',`Deleted advance ${id}`); } }}
          />
        )}
        {tab === 'maintenance' && (
          <MaintenanceTab
            isAdmin={isAdmin} maintenance={maintenance}
            workerList={workerList} fieldList={fieldList}
            onSave={async data => {
              if (!data.date)   return alert('❌ Please select a date.');
              if (!data.field)  return alert('❌ Please select a field.');
              if (!data.task)   return alert('❌ Please select a task.');
              if (!data.worker) return alert('❌ Please select a worker.');
              if (data.task !== 'Fertilizing' && (!data.rate || Number(data.rate) <= 0)) return alert('❌ Please enter a valid rate.');
              const mDate = data.date || today;
              const activeLease = getActiveLeaseForFieldDate(data.field, mDate);
              if(activeLease){alert(`❌ Cannot log maintenance on ${mDate} — ${data.field} is on lease from ${activeLease.startDate} to ${activeLease.endDate}.`);return;}
              await maintenanceService.add(data);
              writeAudit('create','tea_maintenance',`Added ${data.task} on ${data.field} - ${data.date}`);
            }}
            onDelete={id => { if (window.confirm('Delete?')) maintenanceService.delete(id).then(()=>writeAudit('delete','tea_maintenance',`Deleted maintenance record ${id}`)); }}
          />
        )}
        {tab === 'analytics' && (
          <AnalyticsTab
            anaH={anaH} anaPeriod={anaPeriod} setAnaPeriod={setAnaPeriod}
            fieldList={fieldList} fields={fields}
            maintenance={maintenance}
            leases={leases}
          />
        )}
        {tab === 'agent_analytics' && (
          <AgentAnalyticsTab
            agtH={agtH} agtPeriod={agtPeriod} setAgtPeriod={setAgtPeriod}
            agentList={agentList}
          />
        )}
        {tab === 'people' && (
          <PeopleTab
            isAdmin={isAdmin} workers={workers} agents={agents}
            fields={fields} harvest={harvest}
            onEdit={(type, entity) => setEntityModal({ open: true, type, editing: entity })}
            onAdd={type => setEntityModal({ open: true, type, editing: null })}
            onDelete={deleteEntity}
          />
        )}
        {tab === 'lease' && (
          <LeaseTab
            isAdmin={isAdmin}
            leases={leases}
            fieldList={fieldList}
            onSave={async (data, editId) => {
              if (!data.field)     return alert('❌ Please select a field.');
              if (!data.lessee)    return alert('❌ Please enter the lessee name.');
              if (!data.startDate) return alert('❌ Please enter a start date.');
              if (!data.endDate)   return alert('❌ Please enter an end date.');
              if (!data.amount || Number(data.amount) <= 0) return alert('❌ Please enter a valid payment amount.');
              if (data.startDate >= data.endDate) return alert('❌ End date must be after start date.');
              // Fix 6: Block if field has harvest/maintenance in the lease period
              if (!editId) {
                
                const hSnap = await getDocs(collection(db, 'tea_harvest'));
                const conflict = hSnap.docs.map(d => d.data()).find(h =>
                  h.field === data.field && h.date >= data.startDate && h.date <= data.endDate
                );
                if (conflict) {
                  alert(`❌ Cannot create lease — ${data.field} has a harvest entry on ${conflict.date} which falls within the proposed lease period (${data.startDate} to ${data.endDate}). Remove that transaction first.`);
                  return;
                }
              }
              const payload = {
                ...data,
                amount: Number(data.amount) || 0,
                year: data.startDate ? new Date(data.startDate).getFullYear() : new Date().getFullYear(),
                month: data.startDate ? new Date(data.startDate).getMonth() + 1 : new Date().getMonth() + 1,
              };
              if (editId) {
                await updateDoc(doc(db, 'tea_field_leases', editId), payload);
                writeAudit('update','tea_field_leases',`Updated lease: ${payload.field} lessee ${payload.lessee}`);
              }
              else {
                await addDoc(collection(db, 'tea_field_leases'), { ...payload, createdAt: serverTimestamp() });
                writeAudit('create','tea_field_leases',`Added lease: ${payload.field} to ${payload.lessee} from ${payload.startDate}`);
              }
              // Reload
              getDocs(collection(db, 'tea_field_leases'))
                .then(snap => setLeases(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            }}
            onDelete={async id => {
              const lease = leases.find(l=>l.id===id);
              const ok = await checkBeforeDelete('lease', id, lease||{});
              if (!ok) return;
              await deleteDoc(doc(db, 'tea_field_leases', id));
              getDocs(collection(db, 'tea_field_leases'))
                .then(snap => setLeases(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            }}
          />
        )}
        {tab === 'yoy' && <TeaYOY />}
        {tab === 'weather' && (
          <WeatherTab
            isAdmin={isAdmin} weather={weather}
            onSave={async data => { await weatherService.add(data); writeAudit('create','tea_weather',`Added weather: ${data.date} ${data.condition||''}`); }}
            onDelete={async id => { if (window.confirm('Delete?')) { await weatherService.delete(id); writeAudit('delete','tea_weather',`Deleted weather ${id}`); } }}
          />
        )}
      </div>

      <EntityModal
        open={entityModal.open} type={entityModal.type} editing={entityModal.editing}
        onClose={() => setEntityModal({ open: false, type: null, editing: null })}
        onSave={saveEntity}
      />
      <WorkerSettleModal
        open={workerSettleModal.open} worker={workerSettleModal.worker}
        defaultAmount={workerSettleModal.amount} isFloat={workerSettleModal.isFloat}
        editSettlement={editSettlement}
        harvest={harvest} settlements={settlements} advances={advances}
        onClose={() => { setWorkerSettleModal({ open: false, worker: null, amount: 0, isFloat: false }); setEditSettlement(null); }}
        onUpdate={async (id, data) => {
          await updateDoc(doc(db, 'tea_settlements', id), data);
          writeAudit('update','tea_settlements',`Updated settlement ${id}: ₹${data.netPaid}`);
          setWorkerSettleModal({ open: false, worker: null, amount: 0, isFloat: false });
          setEditSettlement(null);
        }}
        onSave={saveWorkerSettlement}
      />
      <AgentPayModal
        open={agentPayModal.open} defaultAgent={agentPayModal.agent}
        editPayment={editAgentPayment} agentList={agentList} harvest={harvest}
        agentPayments={agentPayments}
        onClose={() => { setAgentPayModal({ open: false, agent: null }); setEditAgentPayment(null); }}
        onSave={saveAgentPayment}
      />
    </div>
  );
}
