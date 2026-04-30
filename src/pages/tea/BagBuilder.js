import React from 'react';
import {calcBagNet,calcBagWaterPct,getRateForAgentDate,inr} from '../../utils/chaayaService';

const WORKER_RATE = 6;

export default function BagBuilder({bags, onChange, agentName, dateStr, rates}) {
  // Always total-session mode (per-bag disabled per requirement)
  const addBag    = () => onChange([...bags, {gross: 0, bagWt: 0, waterKg: 0}]);
  const removeBag = i  => onChange(bags.filter((_, idx) => idx !== i));
  const updateBag = (i, field, val) =>
    onChange(bags.map((b, idx) => idx === i ? {...b, [field]: parseFloat(val) || 0} : b));

  const totals = bags.reduce((acc, b) => ({
    gross: acc.gross + (b.gross  || 0),
    bag:   acc.bag   + (b.bagWt  || 0),
    water: acc.water + (b.waterKg|| 0),
    net:   acc.net   + calcBagNet(b),
  }), {gross: 0, bag: 0, water: 0, net: 0});

  const rateRec = getRateForAgentDate(rates, agentName, dateStr);
  const rate    = rateRec ? rateRec.rate : 0;
  const workerPay = Math.round(totals.net * WORKER_RATE);
  const agentRev  = Math.round(totals.net * rate);

  return (
    <div>
      {/* Rate banner */}
      <div className={`ch-rate-banner${!rateRec ? ' no-rate' : ''}`}>
        <span style={{color: 'var(--muted)'}}>Active rate — {agentName || 'select agent'}</span>
        <span style={{fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 15,
          color: rateRec ? 'var(--success)' : 'var(--danger)'}}>
          {rateRec ? `₹${rate}/kg${rateRec.isPlaceholder ? ' ⏳ est.' : ''}` : 'No rate found — set one in Market Rates'}
        </span>
      </div>

      {/* Bag list — per-bag fields disabled, totals only */}
      <div className="ch-bag-builder">
        <div className="ch-bag-header">
          <span style={{fontSize: 13, fontWeight: 500, color: 'var(--text)'}}>
            {bags.length === 0 ? 'No bags' : `${bags.length} bag${bags.length !== 1 ? 's' : ''}`}
          </span>
          <button className="ch-btn ch-btn-primary ch-btn-sm" onClick={addBag}>+ Add Bag</button>
        </div>

        {/* Column headers */}
        <div className="ch-bag-col-labels">
          <div>#</div>
          <div>Gross kg</div>
          <div style={{opacity: 0.4}}>Bag wt (disabled)</div>
          <div style={{opacity: 0.4}}>Water kg (disabled)</div>
          <div>Net kg</div>
          <div></div>
        </div>

        <div className="ch-bag-list">
          {bags.length === 0 && (
            <div style={{textAlign: 'center', padding: 18, color: 'var(--muted)', fontSize: 12.5}}>
              Click "+ Add Bag" to start.
            </div>
          )}
          {bags.map((b, i) => {
            const net = calcBagNet(b);
            return (
              <div className="ch-bag-row" key={i}>
                <div className="ch-bag-num">B{i + 1}</div>
                <input className="ch-input" type="number" placeholder="0.0"
                  value={b.gross || ''} min="0" step="0.1"
                  onChange={e => updateBag(i, 'gross', e.target.value)}
                  style={{padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 12.5}}/>
                <input className="ch-input" type="number" placeholder="disabled"
                  disabled style={{opacity: 0.25, cursor: 'not-allowed', padding: '6px 8px'}}/>
                <input className="ch-input" type="number" placeholder="disabled"
                  disabled style={{opacity: 0.25, cursor: 'not-allowed', padding: '6px 8px'}}/>
                <div className="ch-bag-net">{net > 0 ? net.toFixed(2) : '-'}</div>
                <button onClick={() => removeBag(i)}
                  style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1}}>×</button>
              </div>
            );
          })}
        </div>

        {bags.length > 0 && (
          <>
            {/* Total session deductions */}
            <div style={{padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)'}}>
              <div style={{fontWeight: 600, fontSize: '0.82rem', marginBottom: 8, color: 'var(--muted)'}}>Session Totals & Deductions</div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10}}>
                <div>
                  <div style={{fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3}}>GROSS KG</div>
                  <div style={{fontFamily: 'var(--font-mono)', fontWeight: 600}}>{totals.gross.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3}}>BAG DEDUCTION (total)</div>
                  <input className="ch-input" type="number" placeholder="0.0" min="0" step="0.01"
                    value={bags.length === 1 ? (bags[0].bagWt || '') : ''}
                    onChange={e => {
                      // Distribute total bag deduction across all bags equally
                      const total = parseFloat(e.target.value) || 0;
                      const each  = total / bags.length;
                      onChange(bags.map(b => ({...b, bagWt: each})));
                    }}
                    style={{padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 12}}/>
                  <div style={{fontSize: '0.7rem', color: 'var(--danger)', marginTop: 2}}>−{totals.bag.toFixed(2)} kg</div>
                </div>
                <div>
                  <div style={{fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3}}>WATER DEDUCTION (total)</div>
                  <input className="ch-input" type="number" placeholder="0.0" min="0" step="0.01"
                    value={bags.length === 1 ? (bags[0].waterKg || '') : ''}
                    onChange={e => {
                      const total = parseFloat(e.target.value) || 0;
                      const each  = total / bags.length;
                      onChange(bags.map(b => ({...b, waterKg: each})));
                    }}
                    style={{padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 12}}/>
                  <div style={{fontSize: '0.7rem', color: 'var(--danger)', marginTop: 2}}>−{totals.water.toFixed(2)} kg ({totals.gross > 0 ? ((totals.water / totals.gross) * 100).toFixed(1) : 0}%)</div>
                </div>
                <div>
                  <div style={{fontSize: '0.72rem', color: 'var(--success)', marginBottom: 3}}>NET KG</div>
                  <div style={{fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)'}}>
                    {totals.net.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue summary */}
            <div className="ch-bag-footer">
              <span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)'}}>
                {bags.length} bags · Net: <strong style={{color: 'var(--text)'}}>{totals.net.toFixed(2)} kg</strong>
                {' · '}Worker: <strong style={{color: 'var(--success)'}}>{inr(workerPay)}</strong>
                {' · '}Agent rev: <strong style={{color: 'var(--success)'}}>{inr(agentRev)}</strong>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
