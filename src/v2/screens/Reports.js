import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Money, Tabs, Table, Select, Muted, Chips, BarRow, Text, Btn, useWide, go, href, download } from '../ui/kit';
import { usePeriod, PeriodPicker } from '../ui/Period';
import { inr, inRange, sum, fmtDate, fmtMonth, r2 } from '../core/util';
import { MODE_LABEL, DIFF_LABEL } from '../core/books';
import { doBetter, spendingGrowth, forecastNextMonth } from '../core/insights';
import { entriesCSV } from '../core/backup';
import { useDelete } from '../data/useDelete';
import { nextHarvests, manureNeeds, manureBuyPlan, pendingWork, summaryForAI, dayAccounting } from '../core/planner';
import { aiAccess, AI_DAILY_LIMIT } from '../core/ai';
import { uid as newId } from '../core/util';
import { photoBadge } from '../core/photos';

const TABS = [['summary', 'Summary'], ['plan', 'Plan ahead'], ['better', 'Do better'], ['fields', 'Fields'], ['agents', 'Agents'], ['workers', 'Workers'], ['rentals', 'Rentals'], ['entries', 'Every entry']];
const BIZ = [['all', 'All'], ['tea', 'Tea'], ['rental', 'Rentals'], ['home', 'Homes']];

export default function Reports({ tab = 'summary', query }) {
  const { can, today } = useData();
  const ps = usePeriod(today, query.all ? 'all' : 'year');
  if (!can.money) return <Page title="Reports"><Card><Muted>Reports are not available for your access level.</Muted></Card></Page>;
  return (
    <Page title="Reports">
      <Tabs tabs={TABS} value={tab} onChange={(t) => go('/reports/' + t)} />
      {tab !== 'better' && tab !== 'plan' && <PeriodPicker state={ps} />}
      {tab === 'plan' && <Plan />}
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
      <Chips small scroll label="Business" options={BIZ} value={biz} onChange={setBiz} />
      <div className="v2-grid">
        <Card><Muted>Money in</Muted><div className="v2-big v2-num">{inr(Math.round(p.cashIn))}</div></Card>
        <Card><Muted>Money out</Muted><div className="v2-big v2-num">{inr(Math.round(p.cashOut))}</div></Card>
        <Card><Muted>Left (cash)</Muted><div className={'v2-big v2-num ' + (p.cashNet >= 0 ? 'v2-green' : 'v2-red')}>{inr(Math.round(p.cashNet))}</div></Card>
        <Card><Muted>Profit</Muted><div className={'v2-big v2-num ' + (p.profit >= 0 ? 'v2-green' : 'v2-red')}>{inr(Math.round(p.profit))}</div></Card>
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

// The AI summary. The server decides whether it may run; this only explains.
function AiSummary() {
  const { raw, user, today, demo, say } = useData();
  const find = (id) => (raw.settings || []).find((x) => x.id === id) || null;
  const access = aiAccess(find('ai'), find('aiUsage'), user?.uid, today);
  const latest = find('aiLatest');
  const [waiting, setWaiting] = useState(null); // { requestId, since }
  const mine = waiting && latest && latest.requestId === waiting.requestId ? latest : null;
  const finished = mine && mine.status !== 'working';
  useEffect(() => { if (finished) setWaiting(null); }, [finished]);
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setTimeout(() => { setWaiting(null); say('The AI summary is taking longer than expected. It will appear here when it is ready; check the function log in Netlify if it never does.', true); }, 180000);
    return () => clearTimeout(t);
  }, [waiting, say]);
  const ask = async () => {
    if (demo) return say('AI summaries cannot be made from sample data.', true);
    const requestId = newId();
    setWaiting({ requestId });
    try {
      const { auth } = await import('../../firebase');
      const res = await fetch('/.netlify/functions/ai-summary-background', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await auth.currentUser.getIdToken()) }, body: JSON.stringify({ requestId }) });
      if (res.status === 404) { setWaiting(null); say('The AI function is not on the site yet. In Netlify, check that Functions lists "ai-summary-background" and redeploy.', true); }
    } catch (e) { setWaiting(null); say('Could not reach the site. Check the connection.', true); }
    return null;
  };
  const shown = latest && latest.status === 'done' ? latest : null;
  return (
    <Card title="AI summary" right={access.ok ? <Tag kind="g">{access.left} of {AI_DAILY_LIMIT} left today</Tag> : null}>
      {!access.ok && <Muted>{access.why}</Muted>}
      {access.ok && <Btn disabled={!!waiting} onClick={ask}>{waiting ? 'Writing the summary… this can take a minute' : 'Write an AI summary of my business'}</Btn>}
      {latest && latest.status === 'error' && (!waiting) && <div className="v2-tag r" style={{ whiteSpace: 'normal' }}>{latest.error}</div>}
      {shown && (
        <>
          <Muted>Written {fmtDate(shown.date)} for {shown.by}{shown.cutOff ? '. It was cut short by the length limit.' : ''}</Muted>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {String(shown.text).split('\n').map((line, i) => (/^[A-Z][^-]*$/.test(line.trim()) && line.trim().length < 40 ? <strong key={i} style={{ display: 'block', marginTop: i ? 12 : 0 }}>{line.trim()}</strong> : <div key={i}>{line}</div>))}
          </div>
          <Muted>An AI wrote this from your figures. It can be wrong; check anything important against the entries before acting on it.</Muted>
        </>
      )}
    </Card>
  );
}

function Better() {
  const { books, say } = useData();
  const [area, setArea] = useState('all');
  const tips = useMemo(() => doBetter(books), [books]);
  const shown = tips.filter((t) => area === 'all' || t.area === area || t.area === 'all');
  const link = (t) => (t.link?.field ? href('/field/' + t.link.field) : t.link?.property ? href('/property/' + t.link.property) : t.link?.entries ? href('/reports/entries', t.link.entries) : t.link?.tab ? href('/reports/' + t.link.tab) : null);
  return (
    <>
      <Chips small label="Area" options={BIZ.filter(([k]) => k !== 'home')} value={area} onChange={setArea} />
      <Muted>Worked out from your own entries, sorted by how much each could be worth in a year. The rupee figures are rough estimates.</Muted>
      <AiSummary />
      <Card title="Or take it to any AI yourself, free">
        <Muted>This copies a summary of your figures (fields, agents, costs, rentals, what the app flags) with a set of questions. Paste it into any AI assistant you already use. Names of workers, tenants and agents are left out. Nothing is sent anywhere by the app.</Muted>
        <Btn kind="sec" onClick={async () => { const text = summaryForAI(books); try { await navigator.clipboard.writeText(text); say('Copied. Paste it into an AI assistant.'); } catch (e) { download('summary-for-ai.txt', text, 'text/plain;charset=utf-8'); say('Saved as a file instead (copying was not allowed).'); } }}>Copy the summary and questions</Btn>
      </Card>
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

function Plan() {
  const { books } = useData();
  const pending = useMemo(() => pendingWork(books), [books]);
  const harvests = useMemo(() => nextHarvests(books), [books]);
  const manure = useMemo(() => manureNeeds(books), [books]);
  const forecast = useMemo(() => forecastNextMonth(books), [books]);
  return (
    <>
      <Muted>Worked out from your own past entries. These are typical figures, not promises; they get steadier as more is logged.</Muted>
      <Card title="What is pending now">
        {pending.length === 0 && <Muted>Nothing is waiting.</Muted>}
        {pending.map((p, i) => <Row key={i} top left={<strong>{p.what}</strong>} sub={p.detail} right={p.amount != null ? <Money v={p.amount} /> : null} />)}
      </Card>
      <Card title="Where the next harvest should be">
        {harvests.map((h) => (h.leased ? <Row key={h.fieldId} left={h.name} right={<Tag kind="n">Leased to {h.leased}</Tag>} />
          : h.tooFew != null ? <Row key={h.fieldId} top left={h.name} sub={`Only ${h.tooFew} harvest ${h.tooFew === 1 ? 'day' : 'days'} logged. At least 3 are needed to estimate.`} right={<Tag kind="n">Not enough yet</Tag>} />
            : (
              <Row key={h.fieldId} top to={href('/field/' + h.fieldId)}
                left={<strong>{h.name}</strong>}
                sub={`Last harvested ${fmtDate(h.last)} (${h.waited} days ago). Usually every ${h.gap} days. Expect ${h.kgLow}–${h.kgHigh} kg${h.workers ? `, about ${h.workers} ${h.workers === 1 ? 'picker' : 'pickers'} at ${h.perPicker} kg each` : ''}.`}
                right={<Tag kind={h.overdueBy >= 0 ? '' : 'g'}>{h.overdueBy > 0 ? `Due ${h.overdueBy} days ago` : h.overdueBy === 0 ? 'Due today' : `In ${-h.overdueBy} days`}</Tag>} />
            )))}
        {harvests.length === 0 && <Muted>No fields yet.</Muted>}
        <Muted>The usual gap and kg come from the last 8 rounds on each field. If a field has waited longer than usual, a little more leaf is expected.</Muted>
      </Card>
      {forecast && (
        <Card title={`${fmtMonth(forecast.month)}, all fields`}>
          <Row top left="Expected harvest" sub={`From ${forecast.basis}`} right={<strong>{forecast.kgLow.toLocaleString('en-IN')} – {forecast.kgHigh.toLocaleString('en-IN')} kg</strong>} />
        </Card>
      )}
      <Card title="Manure to have ready">
        {manure.rows.map((r) => (
          <Row key={r.fieldId} top to={href('/field/' + r.fieldId)} left={<strong>{r.name}</strong>}
            sub={`${r.last ? 'Last manured ' + fmtDate(r.last) : 'No manuring logged'}${r.bags ? `. Usually ${r.bags} bags${r.perAcre ? ` (${r.perAcre} per acre)` : ''}` : ''}${r.types.length ? '. Used before: ' + r.types.map((t) => `${t.name}${t.avgChange != null ? ` (yield ${t.avgChange > 0 ? '+' : ''}${t.avgChange}% after)` : ''}`).join(', ') : ''}`}
            right={<Tag kind={r.status === 'ok' ? 'g' : r.status === 'now' || r.status === 'soon' ? '' : 'n'}>{r.tag}</Tag>} />
        ))}
        <Row left="Bags needed for fields due now or soon" right={<strong>{manure.need}</strong>} />
        <Row left="Bags in stock" right={manure.inStock} />
        <Row left={<strong>To buy</strong>} right={<strong>{manure.toBuy} bags{manure.cost ? ` · about ${inr(manure.cost)}` : ''}</strong>} />
        {manure.cost != null && <Muted>Cost uses the price of your last purchase ({inr(manure.lastPrice)} a bag with transport).</Muted>}
      </Card>
      <BuyPlan />
      <Card title="Which type of manure, and why">
        <Muted>The app can show what you used before and how the yield moved afterwards (above), but it cannot tell you which fertilizer the soil needs: that depends on a soil test (pH and nutrient levels), the age of the bushes and when they were last pruned. A soil test through the Tea Board or UPASI advisory service, or a local agricultural office, costs little and gives a specific recommendation. The “Do better” tab has a button to take your figures to an AI assistant for a general second opinion.</Muted>
      </Card>
    </>
  );
}

function BuyPlan() {
  const { books, can } = useData();
  const plan = useMemo(() => manureBuyPlan(books), [books]);
  return (
    <Card title="Manure to buy, by type" right={can.write && <a href={href('/stock')}>+ Bought</a>}>
      {plan.due.length === 0 && <Muted>No field is due for manuring now.</Muted>}
      {plan.due.map((d) => (
        <Row key={d.fieldId} top to={href('/field/' + d.fieldId)} left={<strong>{d.name}</strong>}
          sub={d.bags ? `${d.rate} bags an acre (${d.own ? 'its own last manurings' : 'average of the other fields'})${d.adj !== 1 ? `, × ${d.adj} for its yield` : ''}. ${Object.keys(d.comp).length ? 'Mix as ' + d.compFrom + ': ' + Object.entries(d.comp).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ') : 'No mix on record to split by.'}` : d.why}
          right={<span>{d.bags ? <strong>{d.bags} bags</strong> : <Tag kind="n">?</Tag>} <Tag>{d.tag}</Tag></span>} />
      ))}
      {plan.types.length > 0 && (<>
        <div className="v2-flab" style={{ marginTop: 6 }}>By type</div>
        {plan.types.map((t) => <Row key={t.name} left={<strong>{t.name}</strong>} sub={`Needed ${t.need} · in stock ${Math.floor(t.have)}${t.price != null ? ` · last bought at ${inr(t.price)} a bag delivered` : ''}`} right={<strong>{t.toBuy ? `Buy ${t.toBuy}` : 'Enough'}{t.cost ? ` · ${inr(t.cost)}` : ''}</strong>} />)}
        {plan.cost > 0 && <Row left={<strong>Likely cost</strong>} right={<strong>{inr(plan.cost)}</strong>} />}
      </>)}
      {plan.unsplit > 0 && <Muted>{plan.unsplit} bags could not be split by type because no mix is on record for those fields.</Muted>}
      <Muted>A field that gives more leaf per acre than your average takes more out of the soil, so it is given up to 20% more; a weaker one up to 20% less. Bags in mixes still in stock are counted by what is in them.</Muted>
    </Card>
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
        onRow={(r) => go('/worker/' + r.key)} />
      <Muted>Tap a worker to see what they earned day by day. "Paid" is the cash handed over in the period. Advances taken back from wages are not cash, so earned can be more than paid without anything being due.</Muted>
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
  const { books, can, run } = useData();
  const del = useDelete();
  const wide = useWide();
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');
  const [biz, setBiz] = useState('all');
  const [party, setParty] = useState(query.party || '');
  const [by, setBy] = useState(query.by || '');
  const [mode, setMode] = useState('');
  const cat = query.cat || '';
  const partyName = (party && books.personById.get(party)?.name) || party;
  const parties = useMemo(() => [...new Set([...books.entries.map((e) => e.party), ...books.deliveries.map((d) => d.agentName)].filter(Boolean))].sort(), [books]);
  const needle = q.trim().toLowerCase();

  // payments
  const money = useMemo(() => books.entries.filter((e) => inRange(e.date, period)
    && e.kind !== 'advance_recovery'
    && (show === 'all' || show === 'money' || (show === 'diff' ? Math.abs(e.diff) > 0.005 : e.dir === show))
    && (biz === 'all' || e.business === biz)
    && (!party || e.partyId === party || e.party === partyName)
    && (!by || (e.by || 'Not recorded') === by) && (!mode || e.mode === mode) && (!cat || e.cat === cat)
    && (!needle || `${e.party} ${e.forText} ${e.note || ''} ${e.diffComment || ''} ${e.amount} ${e.cat}`.toLowerCase().includes(needle))),
  [books, period, show, biz, party, partyName, by, mode, cat, needle]);
  // harvests are not money, but they are things you logged, so they are listed too
  const harvests = useMemo(() => ((show !== 'all' && show !== 'harvest') || by || mode || cat || (biz !== 'all' && biz !== 'tea') ? [] : books.deliveries.filter((d) => inRange(d.date, period)
    && (!party || d.agentId === party || d.agentName === partyName || d.workers.some((w) => w.workerId === party || books.nameOf(w.workerId) === partyName))
    && (!needle || `harvest ${d.agentName} ${d.fieldName} ${d.workers.map((w) => books.nameOf(w.workerId)).join(' ')} ${d.net} ${d.note || ''}`.toLowerCase().includes(needle)))),
  [books, period, show, biz, party, partyName, by, mode, cat, needle]);

  // days marked "no harvest", so every day is accounted for
  const nones = useMemo(() => ((show !== 'all' && show !== 'harvest') || party || by || mode || cat || (biz !== 'all' && biz !== 'tea') ? []
    : books.notes.filter((n) => n.kind === 'noharvest' && inRange(n.date, period) && (!needle || 'no harvest'.includes(needle)))),
  [books, period, show, party, by, mode, cat, biz, needle]);
  const days = useMemo(() => dayAccounting(books, period), [books, period]);
  const markNone = (d) => run({ ops: [{ col: 'notes', id: 'noharvest-' + d, data: { kind: 'noharvest', date: d, by: '' } }] }, `${fmtDate(d)} marked as no harvest`);
  const totalIn = sum(money.filter((e) => e.dir === 'in'), (e) => e.amount);
  const totalOut = sum(money.filter((e) => e.dir === 'out'), (e) => e.amount);
  // running total, oldest first, starting from zero on the first day shown
  const running = useMemo(() => { const m = new Map(); let t = 0; money.slice().reverse().forEach((e) => { t = r2(t + e.signed); m.set(e.id, t); }); return m; }, [money]);
  const rows = useMemo(() => [
    ...money.map((e) => ({ type: 'money', id: e.id, date: e.date, at: e.updatedAt || '', e })),
    ...harvests.map((d) => ({ type: 'harvest', id: d.id, date: d.date, at: d.updatedAt || '', d })),
    ...nones.map((n) => ({ type: 'none', id: n.id, date: n.date, at: n.updatedAt || '', n })),
  ].sort((a, b) => b.date.localeCompare(a.date) || String(b.at).localeCompare(String(a.at))), [money, harvests, nones]);

  const diffTag = (e) => (Math.abs(e.diff) > 0.005 ? <Tag>{inr(Math.abs(e.diff))} {e.diff > 0 ? 'extra' : 'short'}{e.diffReason ? ' · ' + DIFF_LABEL[e.diffReason] : ''}</Tag> : null);
  const harvestFor = (d) => `Harvest · ${d.fieldName} · ${d.net.toFixed(1)} kg`;
  const harvestNote = (d) => `${can.money ? `Wages earned ${inr(d.wages)} · ` : ''}${d.value != null ? `agent to pay ${inr(d.value)}` : 'rate not known yet'}${photoBadge(d) ? ' · ' + photoBadge(d) : ''}`;
  const open = (r) => { if (r.type === 'none') { if (can.harvest) go('/harvest', { date: r.date }); return; } if (r.type === 'harvest') { if (can.harvest) go('/harvest/' + r.id); } else if (can.write) go('/pay', { entry: r.id }); };
  const remove = (r) => (r.type === 'harvest' ? del.delivery(r.id) : r.type === 'none' ? (window.confirm(`Undo “no harvest” for ${fmtDate(r.date)}?`) && run({ ops: [{ col: 'notes', id: r.id, remove: true }] }, 'Undone')) : del.entry(r.id));
  const months = [];
  rows.forEach((r) => { const mk = r.date.slice(0, 7); if (!months.length || months[months.length - 1].mk !== mk) months.push({ mk, rows: [] }); months[months.length - 1].rows.push(r); });
  const count = `${money.length} ${money.length === 1 ? 'payment' : 'payments'}${harvests.length ? `, ${harvests.length} ${harvests.length === 1 ? 'harvest' : 'harvests'}` : ''}${nones.length ? `, ${nones.length} no-harvest ${nones.length === 1 ? 'day' : 'days'}` : ''}`;
  return (
    <>
      <Text value={q} onChange={setQ} type="search" placeholder="Search a name, amount or comment" aria-label="Search" />
      <Chips small scroll label="Show" options={[['all', 'Everything'], ['money', 'Payments'], ['harvest', 'Harvests'], ['in', 'Money in'], ['out', 'Money out'], ['diff', 'With a difference']]} value={show} onChange={setShow} />
      <div className="v2-cols">
        <Select aria-label="Business" value={biz} onChange={setBiz} options={BIZ} />
        <Select aria-label="With" value={partyName} onChange={setParty} options={parties} placeholder="Anyone" />
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
          <Muted>{count}. Tap one to open it; the bin icon deletes it.</Muted>
          {money.length > 0 && <button type="button" className="v2-link" onClick={() => download(`entries-${period.from}-to-${period.to}.csv`, entriesCSV(books, money))}>Download for Excel</button>}
        </div>
        {(show === 'all' || show === 'harvest') && days.harvested.length + days.none.length + days.missing.length > 0 && (
          <div className="v2-stack" style={{ gap: 6, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
            <div><strong>Every day accounted for?</strong> {days.harvested.length} harvested · {days.none.length} no harvest · <span className={days.missing.length ? 'v2-red' : 'v2-green'}>{days.missing.length} not logged</span> <span className="v2-muted">({fmtDate(days.from, { year: false })} to {fmtDate(days.to, { year: false })})</span></div>
            {days.missing.length > 0 && <Muted>Tap a date to mark it “no harvest”, or log the harvest from Home.</Muted>}
            {days.missing.length > 0 && can.harvest && (
              <div className="v2-chips">{days.missing.slice(-31).reverse().map((d) => <button key={d} type="button" className="v2-chip sm" onClick={() => markNone(d)}>{fmtDate(d, { dow: true, year: false })}</button>)}</div>
            )}
            {days.missing.length > 31 && <Muted>Showing the latest 31 of {days.missing.length}. Choose a shorter period to see the rest.</Muted>}
          </div>
        )}
        {harvests.length > 0 && <Muted>Harvests are listed so nothing you logged is missing, but they are not money: the totals above count payments only.</Muted>}
      </Card>
      {wide ? (
        <Card>
          <Table head={['Date', 'With', 'For', { label: 'In', r: 1 }, { label: 'Out', r: 1 }, 'How', 'Handled by', 'Difference', 'Comment', { label: 'Running total', r: 1 }]} empty="Nothing matches."
            onRow={open} onDelete={can.write || can.harvest ? remove : undefined}
            rows={rows.map((r) => (r.type === 'none'
              ? { key: 'n' + r.id, id: r.id, type: r.type, noDelete: !can.harvest, deleteLabel: 'Undo no harvest', cells: [fmtDate(r.date), '', 'No harvest that day', '', '', '', r.n.by || '', <Tag kind="n">No harvest</Tag>, '', ''] }
              : r.type === 'harvest'
              ? { key: 'h' + r.id, id: r.id, type: r.type, noDelete: !can.harvest, deleteLabel: 'Delete this harvest', cells: [fmtDate(r.date), r.d.agentName, harvestFor(r.d), '', '', '', '', <Tag kind="n">Harvest</Tag>, harvestNote(r.d), ''] }
              : { key: r.id, id: r.id, type: r.type, noDelete: !can.write, deleteLabel: 'Delete this payment', cells: [fmtDate(r.date), r.e.party, r.e.forText, r.e.dir === 'in' ? inr(r.e.amount) : '', r.e.dir === 'out' ? inr(r.e.amount) : '', MODE_LABEL[r.e.mode] || '', r.e.by || '', diffTag(r.e), [photoBadge(r.e), r.e.diffComment, r.e.note].filter(Boolean).join(' · '), inr(running.get(r.id))] }))}
            foot={['Total', count, '', inr(totalIn), inr(totalOut), '', '', '', '', inr(totalIn - totalOut)]} />
          <Muted>The running total starts at zero on the first day shown and counts payments only. It is not a bank or cash balance.</Muted>
        </Card>
      ) : months.map((m) => (
        <Card key={m.mk} title={fmtMonth(m.mk)}>
          {m.rows.map((r) => (r.type === 'none' ? (
            <Row key={'n' + r.id} onClick={can.harvest ? () => open(r) : undefined} onDelete={can.harvest ? () => remove(r) : undefined} deleteLabel="Undo no harvest"
              left={<><strong>{fmtDate(r.date, { dow: true, year: false })}</strong> · no harvest</>} right={<Tag kind="n">No harvest</Tag>} />
          ) : r.type === 'harvest' ? (
            <Row key={'h' + r.id} top onClick={can.harvest ? () => open(r) : undefined} onDelete={can.harvest ? () => remove(r) : undefined} deleteLabel="Delete this harvest"
              left={<><strong>{r.d.agentName}</strong> · {harvestFor(r.d)}</>}
              sub={<>{fmtDate(r.date, { year: false })} · {harvestNote(r.d)}</>}
              right={<Tag kind="n">Harvest</Tag>} />
          ) : (
            <Row key={r.id} top onClick={can.write ? () => open(r) : undefined} onDelete={can.write ? () => remove(r) : undefined} deleteLabel="Delete this payment"
              left={<><strong>{r.e.party}</strong> · {r.e.forText}</>}
              sub={<>{[fmtDate(r.date, { year: false }), MODE_LABEL[r.e.mode], r.e.by, photoBadge(r.e), r.e.diffComment || r.e.note].filter(Boolean).join(' · ')}{diffTag(r.e) && <div style={{ marginTop: 4 }}>{diffTag(r.e)}</div>}</>}
              right={<span className={r.e.dir === 'in' ? 'v2-green' : ''} style={{ fontWeight: 600 }}>{inr(r.e.signed, { sign: true })}</span>} />
          )))}
        </Card>
      ))}
      {!wide && rows.length === 0 && <Card><Muted>Nothing matches.</Muted></Card>}
    </>
  );
}
