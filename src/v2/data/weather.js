// Rainfall from Open-Meteo (free, no account or key). Used to fill in the rain
// for a harvest day and to warn before manuring. Every call fails quietly:
// with no signal the form simply leaves the rain box for you to type.
import { addDays, daysBetween } from '../core/util';

const getJSON = async (url) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('weather ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
};
const daily = (j) => (j && j.daily && j.daily.time ? j.daily.time.map((date, i) => ({ date, mm: j.daily.precipitation_sum[i] })) : [])
  .filter((d) => d.mm !== null && d.mm !== undefined);

// Recorded rain for a range of past dates (India time).
export async function rainRecord(lat, lon, from, to, today) {
  const base = `latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=Asia%2FKolkata`;
  const back = daysBetween(from, today);
  if (back <= 90) {
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?${base}&past_days=${Math.max(1, back)}&forecast_days=1`);
    return daily(j).filter((d) => d.date >= from && d.date <= to);
  }
  const j = await getJSON(`https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${from}&end_date=${to}`);
  return daily(j);
}

// Rain for many past dates at once (used to fill in old harvests). The archive
// runs a few days behind, so the last weeks come from the recent record.
export async function rainHistory(lat, lon, from, to, today) {
  const out = new Map();
  const recentFrom = addDays(today, -85);
  const base = `latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=Asia%2FKolkata`;
  if (from < recentFrom) {
    const end = to < addDays(recentFrom, -1) ? to : addDays(recentFrom, -1);
    daily(await getJSON(`https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${from}&end_date=${end}`)).forEach((d) => out.set(d.date, d.mm));
  }
  if (to >= recentFrom) {
    daily(await getJSON(`https://api.open-meteo.com/v1/forecast?${base}&past_days=90&forecast_days=1`)).forEach((d) => { if (d.date >= from && d.date <= to && d.date <= today) out.set(d.date, d.mm); });
  }
  return out;
}

// Rain expected over the next week.
export async function rainForecast(lat, lon, today) {
  const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=Asia%2FKolkata&forecast_days=8`);
  return daily(j).filter((d) => d.date > today && d.date <= addDays(today, 7));
}

// Find a village or town by name, to set a field's location once.
export async function findPlace(name) {
  const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=en&format=json`);
  return (j.results || []).map((r) => ({ label: [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude }));
}
