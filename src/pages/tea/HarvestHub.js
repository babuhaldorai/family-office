import React, { useState } from 'react';
import { HARVEST_SUBTABS } from './chaayaStyles';
import HarvestTab from './HarvestTab';
import RatePaymentsTab from './RatePaymentsTab';
import { RatesTab } from './OperationsTabs';
import SettlementsTab from './SettlementsTab';

// Consolidates Log Harvest, Rate & Payments, Market Rates, Worker Payments,
// and Agent Payments into a single "Harvest Log" tab with its own
// sub-navigation. Advances is intentionally kept out of this hub as its own
// top-level tab.
//
// All data entry (intake in Log Harvest; rate/worker payment/agent payment
// in Rate & Payments) happens directly on each harvest row. Market Rates,
// Worker Payments, and Agent Payments are all fully read-only — they're
// aggregated logs derived from the harvest rows, not places to enter data.
export default function HarvestHub({
  // shared
  isAdmin, pendingRateSessions,
  // harvest tab props
  leasedFields, bags, setBags, deductMode, setDeductMode,
  hDate, setHDate, hWorker, setHWorker, hField, setHField, hAgent, setHAgent,
  workerList, agentList, fieldList, rates, editingHarvestId,
  saveHarvest, savingHarvest, clearForm,
  filteredHarvest, harvestFilter, setHarvestFilter, harvestWeeks,
  editHarvestEntry, deleteHarvestEntry, onUpdateRate, onUpdateWorkerPay, onUpdateAgentPay, onPayWorkerNetOfAdvance, onPayWorkerFull,
  onDeleteSettlement, onDeleteAgentPayment, onResetWorkerLog, onResetAgentLog,
  // settlements (worker + agent) props
  harvest, settlements, advances, agentPayments, maintenance,
  // sub-tab control (optional — defaults to internal state)
  subTab, setSubTab,
}) {
  const [internalSub, setInternalSub] = useState('log');
  const sub = subTab || internalSub;
  const goSub = setSubTab || setInternalSub;

  return (
    <div>
      <div className="ch-tabs" style={{ marginBottom: 18 }}>
        {HARVEST_SUBTABS.map(t => (
          <button
            key={t.key}
            className={`ch-tab ${sub === t.key ? 'active' : ''}`}
            onClick={() => goSub(t.key)}
          >
            {t.label}
            {t.key === 'ratepay' && pendingRateSessions > 0 && (
              <span style={{
                marginLeft: 5, background: 'var(--warn)', borderRadius: '50%',
                width: 7, height: 7, display: 'inline-block', verticalAlign: 'middle',
              }} />
            )}
          </button>
        ))}
      </div>

      {sub === 'log' && (
        <HarvestTab
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
          filteredHarvest={filteredHarvest} harvestFilter={harvestFilter}
          setHarvestFilter={setHarvestFilter} harvestWeeks={harvestWeeks}
          editHarvestEntry={editHarvestEntry}
          deleteHarvestEntry={deleteHarvestEntry}
          pendingRateSessions={pendingRateSessions}
          onGoToRatePayments={() => goSub('ratepay')}
        />
      )}

      {sub === 'ratepay' && (
        <RatePaymentsTab
          harvest={filteredHarvest}
          harvestFilter={harvestFilter} setHarvestFilter={setHarvestFilter} harvestWeeks={harvestWeeks}
          advances={advances}
          pendingRateSessions={pendingRateSessions}
          onUpdateRate={onUpdateRate}
          onUpdateWorkerPay={onUpdateWorkerPay}
          onUpdateAgentPay={onUpdateAgentPay}
          onPayWorkerNetOfAdvance={onPayWorkerNetOfAdvance}
          onPayWorkerFull={onPayWorkerFull}
        />
      )}

      {sub === 'rates' && <RatesTab harvest={harvest} maintenance={maintenance} />}

      {sub === 'worker' && (
        <SettlementsTab
          forceView="workers"
          harvest={harvest} settlements={settlements}
          advances={advances} agentPayments={agentPayments} workerList={workerList}
          onDeleteSettlement={onDeleteSettlement}
          onResetWorkerLog={onResetWorkerLog}
        />
      )}

      {sub === 'agent' && (
        <SettlementsTab
          forceView="agents"
          harvest={harvest} settlements={settlements}
          advances={advances} agentPayments={agentPayments} workerList={workerList}
          onDeleteAgentPayment={onDeleteAgentPayment}
          onResetAgentLog={onResetAgentLog}
        />
      )}
    </div>
  );
}
