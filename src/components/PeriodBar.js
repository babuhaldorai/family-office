/**
 * Shared PeriodBar — src/components/PeriodBar.js
 * Same look as the Tea Plantation period bar.
 * Props:
 *   period: { preset, from, to }
 *   onChange: (period) => void
 *   presets: optional array of {key, label} — defaults to TM/LM/YTD/LY/AT
 */
import React from 'react';

const DEFAULT_PRESETS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd',        label: 'YTD'        },
  { key: 'last_year',  label: 'Last Year'  },
  { key: 'all',        label: 'All Time'   },
];

function calcBounds(key) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const f = d => d.toISOString().slice(0, 10);
  const map = {
    this_month: { from: f(new Date(y, m, 1)),     to: f(new Date(y, m + 1, 0))  },
    last_month: { from: f(new Date(y, m - 1, 1)), to: f(new Date(y, m, 0))      },
    ytd:        { from: `${y}-01-01`,              to: f(now)                    },
    last_year:  { from: `${y-1}-01-01`,            to: `${y-1}-12-31`           },
    all:        { from: '2000-01-01',               to: '2099-12-31'             },
  };
  return map[key] || { from: '2000-01-01', to: '2099-12-31' };
}

export { calcBounds };

export default function PeriodBar({ period, onChange, presets = DEFAULT_PRESETS }) {
  return (
    <div className="ch-period-bar">
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {presets.map(o => (
          <button key={o.key}
            className={`ch-period-btn ${period?.preset === o.key ? 'active' : ''}`}
            onClick={() => onChange({ preset: o.key, ...calcBounds(o.key) })}>
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
        <input type="date" className="ch-input"
          style={{ width: 130, padding: '5px 9px', fontSize: 12 }}
          value={period?.from || ''}
          onChange={e => onChange({ ...period, preset: 'custom', from: e.target.value })} />
        <span style={{ color: '#9a9a8c', fontSize: 12 }}>to</span>
        <input type="date" className="ch-input"
          style={{ width: 130, padding: '5px 9px', fontSize: 12 }}
          value={period?.to || ''}
          onChange={e => onChange({ ...period, preset: 'custom', to: e.target.value })} />
      </div>
    </div>
  );
}
