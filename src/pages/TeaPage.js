import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useMobile } from '../hooks/useMobile';
import {
  harvestChaayaService, ratesChaayaService, settlementService,
  agentPaymentService, advanceService, maintenanceService, weatherService,
  workersChaayaService, agentsChaayaService, fieldsChaayaService,
  calcBagNet, calcBagWaterPct, getRateForAgentDate,
  periodBounds, getFilteredHarvest, weekLabel, todayStr, workerUnpaidWages,
} from '../utils/chaayaService';
import { useAuth } from '../context/AuthContext';
import { TABS, currentWeekLabel } from './tea/chaayaStyles';
import DashboardTab from './tea/DashboardTab';
import HarvestTab from './tea/HarvestTab';
import SettlementsTab from './tea/SettlementsTab';
import { AdvancesTab, MaintenanceTab, WeatherTab, RatesTab } from './tea/OperationsTabs';
import { AnalyticsTab, AgentAnalyticsTab } from './tea/AnalyticsTabs';
import PeopleTab, { EntityModal } from './tea/PeopleTab';
import { WorkerSettleModal, AgentPayModal } from './tea/SettleModals';
import TeaYOY from './tea/TeaYOY';

export default function TeaPage() {
  const { isAdmin } = useAuth();
  const isMobile = useMobile();
  const [tab, setTab] = useState('dashboard');

  const [harvest, setHarvest]         = useState([]);
  const [rates, setRates]             = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [agentPayments, setAgentPayments] = useState([]);
  const [advances, setAdvances]       = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [weather, setWeather]         = useState([]);
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
  const [agentPayModal, setAgentPayModal]   = useState(false);

  useEffect(() => {
    const subs = [
      harvestChaayaService.subscribe(setHarvest),
      ratesChaayaService.subscribe(setRates),
      settlementService.subscribe(setSettlements),
      agentPaymentService.subscribe(setAgentPayments),
      advanceService.subscribe(setAdvances),
      maintenanceService.subscribe(setMaintenance),
      weatherService.subscribe(setWeather),
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
    if (!bags.length) return alert('Add at least one bag.');
    const rateRec = getRateForAgentDate(rates, hAgent, hDate);
    if (!rateRec) { if (!window.confirm('No market rate found. Save with ₹0 agent revenue?')) return; }
    const rate       = rateRec ? rateRec.rate : 0;
    const rateStatus = !rateRec ? 'no-rate' : rateRec.isPlaceholder ? 'placeholder' : 'confirmed';
    const tGross     = bags.reduce((s, b) => s + (b.gross || 0), 0);
    const tBagDed    = bags.reduce((s, b) => s + (b.bagWt  || 0), 0);
    const tWaterDed  = bags.reduce((s, b) => s + (b.waterKg|| 0), 0);
    const tNet       = bags.reduce((s, b) => s + calcBagNet(b), 0);
    const avgWaterPct = tGross > 0 ? (tWaterDed / tGross * 100) : 0;
    const data = {
      date: hDate, worker: hWorker, field: hField, agent: hAgent,
      bags: bags.length, tGross, tBagDed, tWaterDed, tNet, avgWaterPct,
      bagDetails: bags.map(b => ({ ...b, waterPct: calcBagWaterPct(b) })),
      workerPay: tNet * 6, agentRev: tNet * rate, rate, rateStatus,
      weekStr: weekLabel(hDate), year: new Date(hDate).getFullYear(),
      month: new Date(hDate).getMonth() + 1,
    };
    setSavingHarvest(true);
    try {
      if (editingHarvestId) await harvestChaayaService.update(editingHarvestId, data);
      else                  await harvestChaayaService.add(data);
      setBags([]); setEditingHarvestId(null);
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { setSavingHarvest(false); }
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
  }, [workerList, fieldList, agentList]);

  const saveEntity = async (form) => {
    const { type, editing } = entityModal;
    const svc = type === 'worker' ? workersChaayaService : type === 'agent' ? agentsChaayaService : fieldsChaayaService;
    if (editing) await svc.update(editing.id, form);
    else         await svc.add(form);
    setEntityModal({ open: false, type: null, editing: null });
  };
  const deleteEntity = async (type, id) => {
    if (!window.confirm('Delete this record?')) return;
    const svc = type === 'worker' ? workersChaayaService : type === 'agent' ? agentsChaayaService : fieldsChaayaService;
    await svc.delete(id);
  };

  const saveWorkerSettlement = async (worker, amount, notes, isFloat) => {
    const eligible = workerUnpaidWages(worker, harvest, advances, settlements);
    const min = eligible * 0.9, max = eligible * 1.1;
    if (amount < min || amount > max) {
      alert(`Amount outside ±10% range.\nEligible: ₹${eligible.toFixed(2)}\nAllowed: ₹${min.toFixed(2)} – ₹${max.toFixed(2)}`);
      return;
    }
    await settlementService.add({ worker, netPaid: amount, date: todayStr(), notes, paidBeforeAgent: isFloat });
    setWorkerSettleModal({ open: false, worker: null, amount: 0, isFloat: false });
  };

  const saveAgentPayment = async (agent, amount, date, method, notes) => {
    if (!amount) return alert('Enter amount');
    await agentPaymentService.add({ agent, amount, date, method, notes });
    setAgentPayModal(false);
  };

  const dashH         = useMemo(() => getFilteredHarvest(harvest, dashPeriod),  [harvest, dashPeriod]);
  const anaH          = useMemo(() => getFilteredHarvest(harvest, anaPeriod),   [harvest, anaPeriod]);
  const agtH          = useMemo(() => getFilteredHarvest(harvest, agtPeriod),   [harvest, agtPeriod]);
  const harvestWeeks  = useMemo(() => [...new Set(harvest.map(e => e.weekStr || weekLabel(e.date)).filter(Boolean))].sort().reverse(), [harvest]);
  const filteredHarvest = useMemo(() => harvestFilter === 'all' ? harvest : harvest.filter(e => (e.weekStr || weekLabel(e.date)) === harvestFilter), [harvest, harvestFilter]);

  return (
    <div className="ch-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🍃 Tea Plantation</h1>
          <p className="page-subtitle">Week: {currentWeekLabel()} · {harvest.length} sessions total</p>
        </div>
        {isAdmin && (
          <button className="ch-btn ch-btn-primary" onClick={() => setTab('harvest')}>+ Log Harvest</button>
        )}
      </div>

      <div style={{padding:isMobile?'0 12px 80px':'0 32px 32px'}}>
        <div className="ch-tabs">
          {[...TABS, { key: 'yoy', label: '📈 YOY' }].map(t => (
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
            fields={fields} agentList={agentList}
            maintenance={maintenance}
            pendingRateSessions={pendingRateSessions}
          />
        )}
        {tab === 'harvest' && (
          <HarvestTab
            isAdmin={isAdmin} bags={bags} setBags={setBags}
            deductMode={deductMode} setDeductMode={setDeductMode}
            hDate={hDate} setHDate={setHDate}
            hWorker={hWorker} setHWorker={setHWorker}
            hField={hField} setHField={setHField}
            hAgent={hAgent} setHAgent={setHAgent}
            workerList={workerList} agentList={agentList} fieldList={fieldList}
            rates={rates} editingHarvestId={editingHarvestId}
            saveHarvest={saveHarvest} savingHarvest={savingHarvest}
            clearForm={() => { setBags([]); setEditingHarvestId(null); setHDate(todayStr()); }}
            filteredHarvest={filteredHarvest} harvestFilter={harvestFilter}
            setHarvestFilter={setHarvestFilter} harvestWeeks={harvestWeeks}
            editHarvestEntry={editHarvestEntry}
            deleteHarvestEntry={id => { if (window.confirm('Delete?')) harvestChaayaService.delete(id); }}
            pendingRateSessions={pendingRateSessions}
          />
        )}
        {tab === 'settlements' && (
          <SettlementsTab
            isAdmin={isAdmin} harvest={harvest} settlements={settlements}
            advances={advances} agentPayments={agentPayments} workerList={workerList}
            onWorkerPay={(w, amt, isFloat) => setWorkerSettleModal({ open: true, worker: w, amount: amt, isFloat })}
            onAgentPay={() => setAgentPayModal(true)}
            onDeleteSettlement={id => { if (window.confirm('Delete?')) settlementService.delete(id); }}
            onDeleteAgentPayment={id => { if (window.confirm('Delete?')) agentPaymentService.delete(id); }}
          />
        )}
        {tab === 'advances' && (
          <AdvancesTab
            isAdmin={isAdmin} advances={advances} workerList={workerList}
            onSave={data => advanceService.add(data)}
            onMarkDeducted={id => advanceService.update(id, { deducted: true })}
            onDelete={id => { if (window.confirm('Delete?')) advanceService.delete(id); }}
          />
        )}
        {tab === 'maintenance' && (
          <MaintenanceTab
            isAdmin={isAdmin} maintenance={maintenance}
            workerList={workerList} fieldList={fieldList}
            onSave={data => maintenanceService.add(data)}
            onDelete={id => { if (window.confirm('Delete?')) maintenanceService.delete(id); }}
          />
        )}
        {tab === 'rates' && (
          <RatesTab
            isAdmin={isAdmin} rates={rates} agentList={agentList}
            onSave={data => ratesChaayaService.add(data)}
            onDelete={id => { if (window.confirm('Delete?')) ratesChaayaService.delete(id); }}
          />
        )}
        {tab === 'analytics' && (
          <AnalyticsTab
            anaH={anaH} anaPeriod={anaPeriod} setAnaPeriod={setAnaPeriod}
            fieldList={fieldList} fields={fields}
            maintenance={maintenance}
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
        {tab === 'yoy' && <TeaYOY />}
        {tab === 'weather' && (
          <WeatherTab
            isAdmin={isAdmin} weather={weather}
            onSave={data => weatherService.add(data)}
            onDelete={id => { if (window.confirm('Delete?')) weatherService.delete(id); }}
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
        harvest={harvest} settlements={settlements} advances={advances}
        onClose={() => setWorkerSettleModal({ open: false, worker: null, amount: 0, isFloat: false })}
        onSave={saveWorkerSettlement}
      />
      <AgentPayModal
        open={agentPayModal} agentList={agentList} harvest={harvest}
        agentPayments={agentPayments}
        onClose={() => setAgentPayModal(false)}
        onSave={saveAgentPayment}
      />
    </div>
  );
}
