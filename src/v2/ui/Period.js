import React, { useState } from 'react';
import { Chips, DateField } from './kit';
import { periodFor, addDays, fmtDate } from '../core/util';

const PRESETS = [['week', 'This week'], ['lastWeek', 'Last week'], ['month', 'This month'], ['lastMonth', 'Last month'], ['year', 'This year'], ['lastYear', 'Last year'], ['all', 'All'], ['custom', 'Dates']];

// Monday–Sunday week containing the date
const weekOf = (today) => {
  const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const from = addDays(today, -dow);
  return { from, to: addDays(from, 6), label: `${fmtDate(from, { year: false })} – ${fmtDate(addDays(from, 6), { year: false })}` };
};

export function usePeriod(today, initial = 'year') {
  const [preset, setPreset] = useState(initial);
  const [custom, setCustom] = useState({ from: addDays(today, -30), to: today });
  const period = preset === 'custom'
    ? { from: custom.from || '2000-01-01', to: custom.to || '2099-12-31', label: `${fmtDate(custom.from)} – ${fmtDate(custom.to)}` }
    : preset === 'week' ? weekOf(today) : preset === 'lastWeek' ? weekOf(addDays(today, -7)) : periodFor(preset, today);
  return { period, preset, setPreset, custom, setCustom };
}

export function PeriodPicker({ state, presets }) {
  const { preset, setPreset, custom, setCustom, period } = state;
  const opts = presets ? PRESETS.filter(([k]) => presets.includes(k)) : PRESETS;
  return (
    <div className="v2-stack" style={{ gap: 8 }}>
      <Chips small scroll label="Period" options={opts} value={preset} onChange={setPreset} />
      {preset === 'custom' ? (
        <div className="v2-cols">
          <DateField label="From" value={custom.from} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
          <DateField label="To" value={custom.to} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
        </div>
      ) : <div className="v2-muted">{period.label}{preset === 'year' || preset === 'lastYear' ? ' (April to March)' : ''}</div>}
    </div>
  );
}
