import React, { useRef, useEffect } from 'react';
import {getRateForAgentDate,inr} from '../../utils/chaayaService';

const WORKER_RATE = 6;

export default function BagBuilder({bags, onChange, agentName, dateStr, rates}) {
  const inputRefs = useRef([]);
  const lastAddedRef = useRef(null);

  // Focus the newly added bag's gross input after render
  useEffect(() => {
    if (lastAddedRef.current !== null) {
      const idx = lastAddedRef.current;
      inputRefs.current[idx]?.focus();
      inputRefs.current[idx]?.select();
      lastAddedRef.current = null;
    }
  }, [bags.length]);

  const addBag = () => {
    lastAddedRef.current = bags.length; // index of new bag
    onChange([...bags, {gross: 0, bagWt: 0, waterKg: 0}]);
  };

  const removeBag = i  => onChange(bags.filter((_, idx) => idx !== i));
  const updateBag = (i, field, val) =>
    onChange(bags.map((b, idx) => idx === i ? {...b, [field]: parseFloat(val) || 0} : b));

  // On Enter in a bag's gross input: move to next bag, or add a new one
  const handleKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i < bags.length - 1) {
        // Move to next bag
        inputRefs.current[i + 1]?.focus();
        inputRefs.current[i + 1]?.select();
      } else {
        // Last bag — add a new one (useEffect will focus it)
        addBag();
      }
    }
  };

  // Deductions stored as session totals on bag[0] only
  const sessionBagDed   = bags.length > 0 ? (bags[0].bagWt   || 0) : 0;
  const sessionWaterDed = bags.length > 0 ? (bags[0].waterKg || 0) : 0;

  const totalGross = bags.reduce((s, b) => s + (b.gross || 0), 0);
  const totalNet   = parseFloat((totalGross - sessionBagDed - sessionWaterDed).toFixed(2));

  const rateRec   = getRateForAgentDate(rates, agentName, dateStr);
  const rate      = rateRec ? rateRec.rate : 0;
  const workerPay = Math.round(totalNet * WORKER_RATE);
  const agentRev  = parseFloat((totalNet * rate).toFixed(1));

  const setBagDed = (val) => {
    const total = parseFloat(val) || 0;
    onChange(bags.map((b, i) => i === 0 ? {...b, bagWt: total} : {...b, bagWt: 0}));
  };

  const setWaterDed = (val) => {
    const total = parseFloat(val) || 0;
    onChange(bags.map((b, i) => i === 0 ? {...b, waterKg: total} : {...b, waterKg: 0}));
  };

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

      {/* Bag list */}
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
          <div style={{opacity: 0.4}}>Bag wt</div>
          <div style={{opacity: 0.4}}>Water kg</div>
          <div>Net kg</div>
          <div></div>
        </div>

        <div className="ch-bag-list">
          {bags.length === 0 && (
            <div style={{textAlign: 'center', padding: 18, color: 'var(--muted)', fontSize: 12.5}}>
              Click "+ Add Bag" to start.
            </div>
          )}
          {bags.map((b, i) => (
            <div className="ch-bag-row" key={i}>
              <div className="ch-bag-num">B{i + 1}</div>
              <input
                className="ch-input"
                type="number"
                placeholder="0.0"
                value={b.gross || ''}
                min="0"
                step="0.1"
                ref={el => inputRefs.current[i] = el}
                onChange={e => updateBag(i, 'gross', e.target.value)}
                onKeyDown={e => handleKeyDown(e, i)}
                style={{padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 12.5}}
              />
              <input className="ch-input" type="number" placeholder="—"
                disabled style={{opacity: 0.25, cursor: 'not-allowed', padding: '6px 8px'}}/>
              <input className="ch-input" type="number" placeholder="—"
                disabled style={{opacity: 0.25, cursor: 'not-allowed', padding: '6px 8px'}}/>
              <div className="ch-bag-net" style={{
                color: i === bags.length - 1 ? 'var(--success)' : 'var(--muted)',
                fontSize: i === bags.length - 1 ? 13 : 11,
              }}>
                {i === bags.length - 1 ? (totalNet > 0 ? totalNet.toFixed(2) : '-') : (b.gross > 0 ? `${b.gross}` : '-')}
              </div>
              <button onClick={() => removeBag(i)}
                style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1}}>×</button>
            </div>
          ))}
        </div>

        {bags.length > 0 && (
          <>
            {/* Session deductions */}
            <div style={{padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)'}}>
              <div style={{fontWeight: 600, fontSize: '0.82rem', marginBottom: 8, color: 'var(--muted)'}}>
                Session Totals &amp; Deductions
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10}}>
                <div>
                  <div style={{fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3}}>GROSS KG</div>
                  <div style={{fontFamily: 'var(--font-mono)', fontWeight: 600}}>{totalGross.toFixed(1)}</div>
                </div>
                <div>
                  <div style={{fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3}}>BAG DEDUCTION (session total)</div>
                  <input className="ch-input" type="number" placeholder="0.0" min="0" step="0.01"
                    value={sessionBagDed || ''}
                    onChange={e => setBagDed(e.target.value)}
                    style={{padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 12}}/>
                  <div style={{fontSize: '0.7rem', color: 'var(--danger)', marginTop: 2}}>−{sessionBagDed} kg</div>
                </div>
                <div>
                  <div style={{fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3}}>WATER DEDUCTION (session total)</div>
                  <input className="ch-input" type="number" placeholder="0.0" min="0" step="0.01"
                    value={sessionWaterDed || ''}
                    onChange={e => setWaterDed(e.target.value)}
                    style={{padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 12}}/>
                  <div style={{fontSize: '0.7rem', color: 'var(--danger)', marginTop: 2}}>
                    −{sessionWaterDed} kg ({totalGross > 0 ? ((sessionWaterDed / totalGross) * 100).toFixed(1) : 0}%)
                  </div>
                </div>
                <div>
                  <div style={{fontSize: '0.72rem', color: 'var(--success)', marginBottom: 3}}>NET KG</div>
                  <div style={{fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)'}}>
                    {totalNet.toFixed(2)}
                  </div>
                  <div style={{fontSize: '0.7rem', color: 'var(--muted)', marginTop: 2}}>
                    {totalGross.toFixed(2)} − {sessionBagDed} − {sessionWaterDed} = {totalNet.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue summary */}
            <div className="ch-bag-footer">
              <span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)'}}>
                {bags.length} bags · Net: <strong style={{color: 'var(--text)'}}>{totalNet.toFixed(2)} kg</strong>
                {' · '}Worker: <strong style={{color: 'var(--success)'}}>{inr(workerPay)}</strong>
                {' · '}Agent rev: <strong style={{color: 'var(--success)'}}>₹{agentRev.toFixed(1)}</strong>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
