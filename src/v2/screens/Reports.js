import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Money, Tabs, Table, Select, Muted, Chips, BarRow, Text, go, href, download } from '../ui/kit';
import { usePeriod, PeriodPicker } from '../ui/Period';
import { inr, inRange, sum, fmtDate, fmtMonth, r2 } from '../core/util';
import { MODE_LABEL, DIFF_LABEL } from '../core/books';
import { doBetter, spendingGrowth, forecastNextMonth } from '../core/insights';
import { entriesCSV } from '../core/backup';

const TABS = [['summary', 'Summary'], ['better', 'Do better'], ['fields', 'Fields'], ['agents', 'Agents'], ['workers', 'Workers'], ['rentals', 'Rentals'], ['entries', 'Every entry']];
const BIZ = [['all', 'All'], ['tea', 'Tea'], ['rental', 'Rentals'], ['home', 'Homes']];

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 900px)');
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export default function Reports({ tab = 'summary', query }) {
  const { can, today } = useData();
  const ps = usePeriod(today, query.all ? 'all' : 'year');
  if (!can.money) return <Page title="Reports"><Card><Muted>Reports are not available for your access level.</Muted></Card></Page>;
  return (
    <Page title="Reports">
      <Tabs tabs={TABS} value={tab} onChange={(t) => go('/reports/' + t)} />
      {tab !== 'better' && <PeriodPicker state={ps} />}
      {tab === 'summary' && <Summary period={ps.period} />}
      {tab === 'better' && <Better />}
      {tab === 'fields' && <FieldsTab period={ps.period} />}
      {tab === 'agents' && <AgentsTab period={ps.period} />}
      {tab === 'workers' && <WorkersTab period={ps.period} />}
      {tab === 'rentals' && <RentalsTab period={ps.period} />}
      {tab === 'entries' && <Entries period={ps.period} query={query} />}
    </Page>
  );
}

const mapRows = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);

function Summary({ period }) {
  const { books } = useData();
  const [biz, setBiz] = useState('all');
  const p = useMemo(() => books.pnl(period, { business: biz }), [books, period, biz]);
  const months = useMemo(() => books.monthly(period, { business: biz }).slice(-12), [books, period, biz]);
  const growth = useMemo(() => spendingGrowth(books, period).filter((g) => g.now > 0 || g.was > 0).slice(0, 8), [books, period]);
  const handlers = useMemo(() => books.byHandler(period), [books, period]);
  const forecast = useMemo(() => forecastNextMonth(books), [books]);
  const maxM = Math.max(1, ...months.map((m) => Math.max(m.in, m.out)));
  const maxG = Math.max(1, ...growth.map((g) => Math.max(g.now, g.was)));
  const tea = useMemo(() => {
    const ds = books.deliveries.filter((d) => inRange(d.date, period));
    const kgs = sum(ds, (d) => d.net);
    const t = books.pnl(period, { business: 'tea' });
    const rated = ds.filter((d) => d.value != null);
    const gross = sum(ds, (d) => d.gross);
    return { kgs, avgRate: sum(rated, (d) => d.net) > 0 ? sum(rated, (d) => d.value) / sum(rated, (d) => d.net) : null, wages: kgs ? sum(ds, (d) => d.wages) / kgs : null, other: kgs ? (t.regular - (t.expense.get('Worker wages') || 0)) / kgs : null, dedPct: gross ? (sum(ds, (d) => d.ded) / gross) * 100 : null };
  }, [books, period]);
  const entriesLink = (extra) => href('/reports/entries', extra);
  return (
    <>
      <Chips small label="Business" options={BIZ} value={biz} onChange={setBiz} />
      <div className="v2-grid">
        <Card><Muted>Money in</Muted><div className="v2-big v2-num">{inr(p.cashIn)}</div></Card>
        <Card><Muted>Money out</Muted><div className="v2-big v2-num">{inr(p.cashOut)}</div></Card>
        <Card><Muted>Left (cash)</Muted><div className={'v2-big v2-num ' + (p.cashNet >= 0 ? 'v2-green' : 'v2-red')}>{inr(p.cashNet)}</div></Card>
        <Card><Muted>Profit</Muted><div className={'v2-big v2-num ' + (p.profit >= 0 ? 'v2-green' : 'v2-red')}>{inr(p.profit)}</div></Card>
      </div>
      <div className="v2-two">
        <Card title="Profit · tap a line to see its entries">
          {mapRows(p.income).map(([c, v]) => <Row key={c} to={entriesLink({ cat: c })} left={c} right={<Money v={v} />} />)}
          <Row left={<strong>Income</strong>} right={<strong><Money v={p.incomeTotal} /></strong>} />
          {mapRows(p.expense).map(([c, v]) => <Row key={c} to={entriesLink({ cat: c })} left={c} right={<Money v={-v} />} />)}
          <Row left={<strong>Regular costs</strong>} right={<strong><Money v={-p.regular} /></strong>} />
          {mapRows(p.oneTime).map(([c, v]) => <Row key={c} to={entriesLink({ cat: c })} left={`${c} (one-time)`} right={<Money v={-v} />} />)}
          {p.equipShare > 0 && <Row top left="Equipment, this period's share" sub="The price spread over the years it lasts" right={<Money v={-p.equipShare} />} />}
          <Row left={<strong>Profit</strong>} right={<span className={'v2-big ' + (p.profit >= 0 ? 'v2-green' : 'v2-red')}>{inr(p.profit)}</span>} />
        </Card>
        <Card title="Why profit and cash differ">
          <Row left="Profit" right={<Money v={p.profit} />} />
          {p.equipShare > 0 && <Row left="Equipment share (not cash this period)" right={<Money v={p.equipShare} sign />} />}
          {p.capitalBought > 0 && <Row left="Equipment bought (cash, spread over years)" right={<Money v={-p.capitalBought} />} />}
          {p.advancesOut > 0 && <Row left="Advances given to workers" right={<Money v={-p.advancesOut} />} />}
          {p.advRecovered > 0 && <Row left="Advances taken back from wages" right={<Money v={p.advRecovered} sign />} />}
          {p.depositsIn > 0 && <Row left="Deposits and advances received, to be returned" right={<Money v={p.depositsIn} sign />} />}
          {p.depositsOut > 0 && <Row left="Deposits and advances returned" right={<Money v={-p.depositsOut} />} />}
          <Row left={<strong>Left (cash) = money in − money out</strong>} right={<strong><Money v={p.cashNet} /></strong>} />
          <Muted>{p.bridgeOk ? 'These lines add up exactly.' : 'These lines do not add up. Open Settings → Totals check.'}</Muted>
        </Card>
        <Card title="Money in and out, by month">
          {months.length === 0 ? <Muted>Nothing in this period.</Muted> : (
            <div className="v2-colchart" role="img" aria-label={'Money in and out by month: ' + months.map((m) => `${fmtMonth(m.mk)} in ${Math.round(m.in)} out ${Math.round(m.out)}`).join('; ')}>
              {months.map((m) => (
                <div key={m.mk}><div className="pair"><i style={{ height: Math.round((m.in / maxM) * 120), background: 'var(--green)' }} /><i style={{ height: Math.round((m.out / maxM) * 120), background: '#C98A1B' }} /></div>{fmtMonth(m.mk, { year: false })}</div>
              ))}
            </div>
          )}
          <Muted>Green is money in, amber is money out.</Muted>
        </Card>
        <Card title="Where spending is growing, against the same dates a year earlier">
          {growth.length === 0 && <Muted>No spending in this period.</Muted>}
          {growth.map((g) => (
            <BarRow key={g.cat} label={g.cat} value={g.now} max={maxG} kind={g.pct != null && g.pct < 0 ? 'grey' : 'amber'}
              text={<>{inr(g.now)} {g.pct != null ? <Tag kind={g.pct > 25 ? '' : 'n'}>{g.pct > 0 ? '+' : ''}{Math.round(g.pct)}%</Tag> : <Tag kind="n">new</Tag>}</>} />
          ))}
        </Card>
        {tea.kgs > 0 && (biz === 'all' || biz === 'tea') && (
          <Card title="Tea: what each kg earns and costs">
            <Row left="Leaf sold" right={`${tea.kgs.toFixed(1)} kg`} />
            <Row left="Average agent rate" right={tea.avgRate != null ? `₹${tea.avgRate.toFixed(2)}` : '—'} />
            <Row left="Wages per kg" right={tea.wages != null ? `−₹${tea.wages.toFixed(2)}` : '—'} />
            <Row left="Manure, field work and other, per kg" right={tea.other != null ? `−₹${tea.other.toFixed(2)}` : '—'} />
            {tea.avgRate != null && <Row left={<strong>Left per kg</strong>} right={<span className="v2-big v2-green">₹{(tea.avgRate - tea.wages - tea.other).toFixed(2)}</span>} />}
            <Row left="Lost to agent deductions" right={tea.dedPct != null ? `${tea.dedPct.toFixed(1)}% of weight` : '—'} />
          </Card>
        )}
        {forecast && (
          <Card title={`${fmtMonth(forecast.month)}, estimate`}>
            <Row top left="Harvest" sub={`From ${forecast.basis}`} right={<strong>{forecast.kgLow.toLocaleString('en-IN')} – {forecast.kgHigh.toLocaleString('en-IN')} kg</strong>} />
            <Row left="Tea money left after regular costs" right={<strong>{inr(forecast.profitLow)} – {inr(forecast.profitHigh)}</strong>} />
            <Muted>An estimate from your own past figures, not a promise. It gets steadier as more seasons are logged.</Muted>
          </Card>
        )}
      </div>
      <Card title="Who handled the money, and how">
        <Table head={['Person', { label: 'Cash', r: 1 }, { label: 'UPI', r: 1 }, { label: 'Bank', r: 1 }, { label: 'Cheque', r: 1 }, { label: 'Not recorded', r: 1 }, { label: 'Paid out', r: 1 }, { label: 'Received', r: 1 }]}
          rows={handlers.map((h) => ({ key: h.name, cells: [h.name, inr(h.cash), inr(h.upi), inr(h.bank), inr(h.cheque), inr(h.other), inr(h.out), inr(h.in)] }))}
          foot={['Total', inr(sum(handlers, (h) => h.cash)), inr(sum(handlers, (h) => h.upi)), inr(sum(handlers, (h) => h.bank)), inr(sum(handlers, (h) => h.cheque)), inr(sum(handlers, (h) => h.other)), inr(sum(handlers, (h) => h.out)), inr(sum(handlers, (h) => h.in))]}
          onRow={(r) => go('/reports/entries', { by: r.key })} />
      </Card>
    </>
  );
}

function Better() {
  const { books } = useData();
  const [area, setArea] = useState('all');
  const tips = useMemo(() => doBetter(books), [books]);
  const shown = tips.filter((t) => area === 'all' || t.area === area || t.area === 'all');
  const link = (t) => (t.link?.field ? href('/field/' + t.link.field) : t.link?.property ? href('/property/' + t.link.property) : t.link?.entries ? href('/reports/entries', t.link.entries) : t.link?.tab ? href('/reports/' + t.link.tab) : null);
  return (
    <>
      <Chips small label="Area" options={BIZ.filter(([k]) => k !== 'home')} value={area} onChange={setArea} />
      <Muted>Worked out from your own entries, sorted by how much each could be worth in a year. The rupee figures are rough estimates.</Muted>
      {shown.length === 0 && <Card><Muted>Nothing stands out yet. These suggestions need a few months of harvests, payments and expenses to compare.</Muted></Card>}
      {shown.map((t, i) => (
        <Card key={i}>
          <div className="v2-row top" style={{ minHeight: 0 }}><strong>{t.title}</strong>{t.value ? <Tag kind="g">about {inr(t.value)} a year</Tag> : t.tag ? <Tag>{t.tag}</Tag> : null}</div>
          <div>{t.detail}</div>
          <Muted>Try: {t.action}</Muted>
          {link(t) && <a href={link(t)}>See what this is based on</a>}
        </Card>
      ))}
    </>
  );
}

function FieldsTab({ period }) {
  const { books } = useData();
  const rows = useMemo(() => books.byField(period), [books, period]);
  return (
    <Card title="By field, counted on the harvest date">
      <Table head={['Field', { label: 'Net kg', r: 1 }, { label: 'Kg per acre', r: 1 }, { label: 'Tea value', r: 1 }, { label: 'Lease rent', r: 1 }, { label: 'Wages', r: 1 }, { label: 'Manure and work', r: 1 }, { label: 'Other', r: 1 }, { label: 'Left', r: 1 }, { label: 'Left per kg', r: 1 }]}
        rows={rows.map((r) => ({ key: r.fieldId, cells: [`${r.name}${r.acres ? ' · ' + r.acres + ' ac' : ''}`, r.netKg.toFixed(1), r.kgPerAcre != null ? r.kgPerAcre.toFixed(0) : '—', inr(r.income), r.lease ? inr(r.lease) : '', inr(r.wages), inr(r.work), inr(r.misc), <strong>{inr(r.profit)}</strong>, r.profitPerKg != null ? inr(r.profitPerKg) : '—'] }))}
        foot={['Total', sum(rows, (r) => r.netKg).toFixed(1), '', inr(sum(rows, (r) => r.income)), inr(sum(rows, (r) => r.lease)), inr(sum(rows, (r) => r.wages)), inr(sum(rows, (r) => r.work)), inr(sum(rows, (r) => r.misc)), inr(sum(rows, (r) => r.profit)), '']}
        onRow={(r) => r.key && go('/field/' + r.key + '/money')} />
      {sum(rows, (r) => r.unratedKg) > 0 && <Muted>{sum(rows, (r) => r.unratedKg).toFixed(1)} kg is waiting for a rate and has no value yet.</Muted>}
      <Muted>Leaf is valued on the day it was delivered and work on the day it was done, so this table can differ from money in and out for the same dates. Manure taken from stock is charged to the field it was applied to.</Muted>
    </Card>
  );
}

function AgentsTab({ period }) {
  const { books } = useData();
  const rows = useMemo(() => books.byAgent(period), [books, period]);
  return (
    <>
      <Card title="By agent">
        <Table head={['Agent', { label: 'Deliveries', r: 1 }, { label: 'Net kg', r: 1 }, { label: 'Average rate', r: 1 }, { label: 'Value', r: 1 }, { label: 'Deducted', r: 1 }, { label: 'Of which water', r: 1 }, { label: 'Days to pay', r: 1 }, { label: 'Still owes (all time)', r: 1 }]}
          rows={rows.map((a) => ({ key: a.id, cells: [a.name, a.deliveries, a.netKg.toFixed(1), a.avgRate != null ? `₹${a.avgRate.toFixed(2)}` : '—', inr(a.value), a.dedPct != null ? a.dedPct.toFixed(1) + '%' : '—', a.waterPct != null ? a.waterPct.toFixed(1) + '%' : '—', a.daysToPay ?? '—', a.unratedKg > 0 ? `${a.unratedKg.toFixed(1)} kg unrated` : inr(a.balance)] }))}
          foot={['Total', sum(rows, (a) => a.deliveries), sum(rows, (a) => a.netKg).toFixed(1), '', inr(sum(rows, (a) => a.value)), '', '', '', inr(sum(rows, (a) => a.balance))]}
          onRow={(r) => go('/reports/entries', { party: r.key, all: 1 })} />
      </Card>
      {books.agents.map((a) => (
        <Card key={a.id} title={`Rate history · ${a.name}`}>
          <Table head={['From', 'To', { label: 'Deliveries', r: 1 }, { label: 'Net kg', r: 1 }, { label: 'Rate', r: 1 }]} empty="No deliveries yet."
            rows={a.ratePeriods.map((p, i) => ({ key: i, cells: [fmtDate(p.from), fmtDate(p.to), p.count, p.kg.toFixed(1), p.rate != null ? `₹${p.rate.toFixed(2)}` : 'not paid yet'] }))} />
        </Card>
      ))}
    </>
  );
}

function WorkersTab({ period }) {
  const { books } = useData();
  const rows = useMemo(() => books.byWorker(period), [books, period]);
  return (
    <Card title="By worker">
      <Table head={['Worker', { label: 'Days', r: 1 }, { label: 'Net kg', r: 1 }, { label: 'Earned', r: 1 }, { label: 'Paid', r: 1 }, { label: 'Extra given', r: 1 }, { label: 'Still due (all time)', r: 1 }, { label: 'Advance owed', r: 1 }]}
        rows={rows.map((w) => ({ key: w.id, cells: [w.name, w.days, w.netKg.toFixed(1), inr(w.earned), inr(w.paid), w.extraPaid ? inr(w.extraPaid) : '', inr(w.due), inr(w.advanceBalance)] }))}
        foot={['Total', '', sum(rows, (w) => w.netKg).toFixed(1), inr(sum(rows, (w) => w.earned)), inr(sum(rows, (w) => w.paid)), inr(sum(rows, (w) => w.extraPaid)), inr(sum(rows, (w) => w.due)), inr(sum(rows, (w) => w.advanceBalance))]}
        onRow={(r) => go('/reports/entries', { party: r.key, all: 1 })} />
      <Muted>"Paid" is the cash handed over in the period. Advances taken back from wages are not cash, so earned can be more than paid without anything being due.</Muted>
    </Card>
  );
}

function RentalsTab({ period }) {
  const { books } = useData();
  const props = books.properties;
  const rows = props.map((p) => {
    const es = books.entries.filter((e) => e.propertyId === p.id && inRange(e.date, period));
    const t = books.tenancies.find((x) => x.propertyId === p.id && x.isActive);
    const rent = sum(es.filter((e) => e.kind === 'rent'), (e) => e.amount);
    const spent = sum(es.filter((e) => e.meta.pnl === 'expense'), (e) => e.amount);
    return { p, t, rent, spent };
  });
  return (
    <Card title="Rentals and homes">
      <Table head={['Property', 'Tenant', { label: 'Rent a month', r: 1 }, { label: 'Rent received', r: 1 }, { label: 'Spent', r: 1 }, { label: 'Left', r: 1 }, { label: 'Rent due now', r: 1 }, { label: 'Advance held', r: 1 }]}
        rows={rows.map(({ p, t, rent, spent }) => ({ key: p.id, cells: [p.name, t ? t.tenantName : p.kind === 'home' ? 'Own home' : '—', t ? inr(t.currentRent) : '', inr(rent), inr(spent), inr(rent - spent), t ? inr(t.balance) : '', t ? inr(t.advanceHeld) : ''] }))}
        foot={['Total', '', '', inr(sum(rows, (r) => r.rent)), inr(sum(rows, (r) => r.spent)), inr(sum(rows, (r) => r.rent - r.spent)), inr(sum(rows, (r) => r.t?.balance || 0)), inr(sum(rows, (r) => r.t?.advanceHeld || 0))]}
        onRow={(r) => go('/property/' + r.key)} />
    </Card>
  );
}

function Entries({ period, query }) {
  const { books, can } = useData();
  const wide = useWide();
  const [q, setQ] = useState('');
  const [dir, setDir] = useState('all');
  const [biz, setBiz] = useState('all');
  const [party, setParty] = useState(query.party || '');
  const [by, setBy] = useState(query.by || '');
  const [mode, setMode] = useState('');
  const cat = query.cat || '';
  const parties = useMemo(() => [...new Set(books.entries.map((e) => e.party).filter(Boolean))].sort(), [books]);
  const partyName = party && books.personById.get(party)?.name;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return books.entries.filter((e) => inRange(e.date, period)
      && (dir === 'all' || (dir === 'diff' ? Math.abs(e.diff) > 0.005 : e.dir === dir))
      && (biz === 'all' || e.business === biz)
      && (!party || e.partyId === party || e.party === party)
      && (!by || (e.by || 'Not recorded') === by) && (!mode || e.mode === mode) && (!cat || e.cat === cat)
      && (!needle || `${e.party} ${e.forText} ${e.note || ''} ${e.diffComment || ''} ${e.amount} ${e.cat}`.toLowerCase().includes(needle))
      && e.kind !== 'advance_recovery');
  }, [books, period, q, dir, biz, party, by, mode, cat]);
  const totalIn = sum(list.filter((e) => e.dir === 'in'), (e) => e.amount);
  const totalOut = sum(list.filter((e) => e.dir === 'out'), (e) => e.amount);
  // running total, oldest first, starting from zero on the first day shown
  const running = useMemo(() => { const m = new Map(); let t = 0; list.slice().reverse().forEach((e) => { t = r2(t + e.signed); m.set(e.id, t); }); return m; }, [list]);
  const open = (id) => can.write && go('/pay', { entry: id });
  const diffTag = (e) => (Math.abs(e.diff) > 0.005 ? <Tag>{inr(Math.abs(e.diff))} {e.diff > 0 ? 'extra' : 'short'}{e.diffReason ? ' · ' + DIFF_LABEL[e.diffReason] : ''}</Tag> : null);
  const months = [];
  list.forEach((e) => { const mk = e.date.slice(0, 7); if (!months.length || months[months.length - 1].mk !== mk) months.push({ mk, rows: [] }); months[months.length - 1].rows.push(e); });
  return (
    <>
      <Text value={q} onChange={setQ} type="search" placeholder="Search a name, amount or comment" aria-label="Search" />
      <Chips small label="Show" options={[['all', 'All'], ['in', 'Money in'], ['out', 'Money out'], ['diff', 'With a difference']]} value={dir} onChange={setDir} />
      <div className="v2-cols">
        <Select aria-label="Business" value={biz} onChange={setBiz} options={BIZ} />
        <Select aria-label="With" value={partyName || party} onChange={setParty} options={parties} placeholder="Anyone" />
        <Select aria-label="Handled by" value={by} onChange={setBy} options={[...books.handlers, 'Not recorded']} placeholder="Handled by anyone" />
        <Select aria-label="How" value={mode} onChange={setMode} options={Object.entries(MODE_LABEL)} placeholder="Any way" />
      </div>
      {cat && <div><Tag kind="n">Only: {cat}</Tag> <a href={href('/reports/entries')}>Show everything</a></div>}
      <Card>
        <div className="v2-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <div><Muted>In</Muted><div className="v2-big v2-num v2-green">{inr(totalIn)}</div></div>
          <div><Muted>Out</Muted><div className="v2-big v2-num">{inr(totalOut)}</div></div>
          <div><Muted>Net</Muted><div className="v2-big v2-num">{inr(totalIn - totalOut)}</div></div>
        </div>
        <div className="v2-row" style={{ minHeight: 0 }}>
          <Muted>{list.length} {list.length === 1 ? 'entry' : 'entries'}.{can.write ? ' Tap one to open or edit it.' : ''}</Muted>
          {list.length > 0 && <button type="button" className="v2-link" onClick={() => download(`entries-${period.from}-to-${period.to}.csv`, entriesCSV(books, list))}>Download for Excel</button>}
        </div>
      </Card>
      {wide ? (
        <Card>
          <Table head={['Date', 'With', 'For', { label: 'In', r: 1 }, { label: 'Out', r: 1 }, 'How', 'Handled by', 'Difference', 'Comment', { label: 'Running total', r: 1 }]} empty="No entries match."
            onRow={can.write ? (r) => open(r.key) : undefined}
            rows={list.map((e) => ({ key: e.id, cells: [fmtDate(e.date), e.party, e.forText, e.dir === 'in' ? inr(e.amount) : '', e.dir === 'out' ? inr(e.amount) : '', MODE_LABEL[e.mode] || '', e.by || '', diffTag(e), [e.diffComment, e.note].filter(Boolean).join(' · '), inr(running.get(e.id))] }))}
            foot={['Total', `${list.length} entries`, '', inr(totalIn), inr(totalOut), '', '', '', '', inr(totalIn - totalOut)]} />
          <Muted>The running total starts at zero on the first day shown. It is not a bank or cash balance.</Muted>
        </Card>
      ) : months.map((m) => (
        <Card key={m.mk} title={fmtMonth(m.mk)}>
          {m.rows.map((e) => (
            <Row key={e.id} top onClick={can.write ? () => open(e.id) : undefined}
              left={<><strong>{e.party}</strong> · {e.forText}</>}
              sub={<>{[fmtDate(e.date, { year: false }), MODE_LABEL[e.mode], e.by, e.diffComment || e.note].filter(Boolean).join(' · ')}{diffTag(e) && <div style={{ marginTop: 4 }}>{diffTag(e)}</div>}</>}
              right={<span className={e.dir === 'in' ? 'v2-green' : ''} style={{ fontWeight: 600 }}>{inr(e.signed, { sign: true })}</span>} />
          ))}
        </Card>
      ))}
      {!wide && list.length === 0 && <Card><Muted>No entries match.</Muted></Card>}
    </>
  );
}
