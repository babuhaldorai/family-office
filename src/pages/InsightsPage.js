import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { getDocs, collection } from 'firebase/firestore';
import {
  harvestChaayaService, maintenanceService, inventoryService,
  advanceService, settlementService, agentPaymentService, workersChaayaService,
} from '../utils/chaayaService';
import { propertyService } from '../utils/firestoreService';
import { teaInsights } from '../utils/teaInsights';
import { rentalInsights } from '../utils/rentalInsights';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

const SEV_COLOR = { high: 'var(--danger, #d9534f)', medium: 'var(--warn, #e0924a)', low: 'var(--muted, #888)' };

function FlagList({ flags }) {
  if (!flags.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>No notable flags right now — nothing stands out from your recent data.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {flags.map((f, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--surface2)', border: `1px solid ${SEV_COLOR[f.severity]}33`,
        }}>
          <AlertTriangle size={16} style={{ color: SEV_COLOR[f.severity], flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: SEV_COLOR[f.severity], textTransform: 'uppercase', letterSpacing: '.04em' }}>{f.area}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text)', marginTop: 2 }}>{f.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ForecastCard({ label, prefix='', suffix='', forecast }) {
  if (!forecast) return (
    <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
      Not enough monthly history yet to forecast {label.toLowerCase()} (need at least 3 months).
    </div>
  );
  const val = forecast.forecasts[0];
  const trendUp = forecast.slope >= 0;
  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Next Month Forecast — {label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{prefix}{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}{suffix}</span>
        {trendUp ? <TrendingUp size={16} color="var(--success, #4caf80)" /> : <TrendingDown size={16} color="var(--danger, #d9534f)" />}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Based on trend + recent average — a simple projection, not a guarantee.</div>
    </div>
  );
}

export default function InsightsPage() {
  const [harvest, setHarvest] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [agentPayments, setAgentPayments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const subs = [
      harvestChaayaService.subscribe(setHarvest),
      maintenanceService.subscribe(setMaintenance),
      inventoryService.subscribe(setInventory),
      advanceService.subscribe(setAdvances),
      settlementService.subscribe(setSettlements),
      agentPaymentService.subscribe(setAgentPayments),
      workersChaayaService.subscribe(setWorkers),
    ];
    (async () => {
      const [props, txSnap] = await Promise.all([
        propertyService.getAll(),
        getDocs(collection(db, 'rental_transactions')),
      ]);
      setProperties(props);
      setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoaded(true);
    })();
    return () => subs.forEach(u => u && u());
  }, []);

  const workerList = useMemo(() => workers.filter(w => w.status !== 'inactive').map(w => w.name).sort(), [workers]);

  const tea = useMemo(
    () => teaInsights(harvest, maintenance, inventory, advances, settlements, agentPayments, workerList),
    [harvest, maintenance, inventory, advances, settlements, agentPayments, workerList]
  );
  const rental = useMemo(() => rentalInsights(transactions, properties), [transactions, properties]);

  const allFlags = [...tea.flags.map(f => ({ ...f, business: 'Tea' })), ...rental.flags.map(f => ({ ...f, business: 'Rentals' }))]
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]));

  const askAI = async () => {
    setAiLoading(true);
    setAiError('');
    setAiText('');
    const summary = {
      tea: {
        flags: tea.flags,
        marginPerKgLast6Months: tea.marginSeries.slice(-6),
        harvestKgLast6Months: tea.kgSeries.slice(-6),
        maintenanceCostLast6Months: tea.maintSeries.slice(-6),
        nextMonthHarvestKgForecast: tea.kgForecast?.forecasts?.[0] ?? null,
      },
      rentals: {
        flags: rental.flags,
        netIncomeLast6Months: rental.netSeries.slice(-6),
        propertyPerformance: rental.propStats,
        nextMonthNetIncomeForecast: rental.netForecast?.forecasts?.[0] ?? null,
      },
    };
    try {
      const resp = await fetch('/.netlify/functions/get-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Request failed');
      setAiText(data.text || 'No response text returned.');
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Insights</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 20 }}>
        Flags and forecasts computed directly from your own data — no training required, updates automatically as you log more.
      </p>

      {/* AI recommendations panel */}
      <div className="ch-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent)" />
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>AI Recommendations</span>
          </div>
          <button className="ch-btn ch-btn-primary ch-btn-sm" onClick={askAI} disabled={aiLoading}>
            {aiLoading ? 'Thinking…' : '✨ Get Recommendations'}
          </button>
        </div>
        {aiError && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)' }}>
            {aiError}
            {aiError.includes('ANTHROPIC_API_KEY') && (
              <div style={{ marginTop: 4, color: 'var(--muted)' }}>
                This needs a one-time setup: get an API key from console.anthropic.com, then add it as <code>ANTHROPIC_API_KEY</code> under
                Netlify → Site configuration → Environment variables, and redeploy.
              </div>
            )}
          </div>
        )}
        {aiText && (
          <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {aiText}
          </div>
        )}
        {!aiText && !aiError && !aiLoading && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
            Sends the flags and forecasts below (not raw records) to Claude for a plain-English summary and next steps.
          </div>
        )}
      </div>

      {/* Tea section */}
      <div className="ch-card" style={{ marginBottom: 20 }}>
        <div className="ch-card-title">🌿 Tea Plantation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <ForecastCard label="Harvest Volume" suffix=" kg" forecast={tea.kgForecast} />
        </div>
        <FlagList flags={tea.flags} />
      </div>

      {/* Rentals section */}
      <div className="ch-card" style={{ marginBottom: 20 }}>
        <div className="ch-card-title">🏠 Rental Homes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <ForecastCard label="Net Income" prefix="₹" forecast={rental.netForecast} />
        </div>
        <FlagList flags={rental.flags} />
      </div>

      {allFlags.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 20 }}>
          Everything looks steady across both businesses right now.
        </div>
      )}
    </div>
  );
}
