// One worker: what they earned day by day in a period, what they were paid,
// and their advances.
import React, { useMemo } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Money, Muted, href, download } from '../ui/kit';
import { usePeriod, PeriodPicker } from '../ui/Period';
import { workerDays } from '../core/planner';
import { inr, fmtDate, toCSV } from '../core/util';
import { MODE_LABEL } from '../core/books';

export default function WorkerPage({ id }) {
  const { books, today, can } = useData();
  const ps = usePeriod(today, 'month');
  const d = useMemo(() => workerDays(books, id, ps.period), [books, id, ps.period]);
  if (!d) return <Page title="Worker" backTo="/tea/people"><Card><Muted>This worker is not there any more.</Muted></Card></Page>;
  if (!can.money) return <Page title={d.w.name} backTo="/tea/people"><Card><Muted>Earnings are not available for your access level.</Muted></Card></Page>;
  const csv = () => download(`${d.w.name}-${ps.period.from}-to-${ps.period.to}.csv`, toCSV([['Date', 'Fields', 'Net kg', 'Earned'], ...d.days.map((x) => [fmtDate(x.date), x.fields, x.kg, x.wage])]));
  return (
    <Page title={d.w.name} sub={d.w.payBasis === 'day' ? `Daily wage ${d.w.dayRate ? inr(d.w.dayRate) : ''}` : `₹${d.w.kgRate ?? 6} per kg`} backTo="/tea/people"
      right={can.write && <a className="v2-btn sm" href={href('/pay', { type: 'worker', party: id })}>Pay</a>}>
      <PeriodPicker state={ps} />
      <div className="v2-grid">
        <Card><Muted>Earned</Muted><div className="v2-big v2-num">{inr(d.earned)}</div><Muted>{d.days.length} {d.days.length === 1 ? 'day' : 'days'} · {d.kg.toFixed(1)} kg</Muted></Card>
        <Card><Muted>Paid in this period</Muted><div className="v2-big v2-num">{inr(d.paid)}</div>{d.recovered > 0 && <Muted>plus {inr(d.recovered)} taken from advances</Muted>}</Card>
        <Card><Muted>Still owed, all time</Muted><div className={'v2-big v2-num ' + (d.w.due > 0.5 ? '' : 'v2-green')}>{inr(Math.max(0, d.w.due))}</div>{d.w.due < -0.5 && <Muted>Paid {inr(-d.w.due)} ahead</Muted>}</Card>
        <Card><Muted>Advance owed</Muted><div className="v2-big v2-num">{inr(d.w.advanceBalance)}</div></Card>
      </div>
      <Card title="Day by day" right={d.days.length > 0 && <button type="button" className="v2-link" onClick={csv}>Download</button>}>
        {d.days.length === 0 && <Muted>No harvest days in this period.</Muted>}
        {d.days.map((x) => <Row key={x.date} left={<><strong>{fmtDate(x.date, { dow: true, year: false })}</strong> · {x.fields}</>} sub={x.daily ? `${x.kg.toFixed(1)} kg · daily wage` : `${x.kg.toFixed(1)} kg`} right={<strong>{inr(x.wage)}</strong>} />)}
        {d.days.length > 0 && <Row left={<strong>Total</strong>} right={<strong>{inr(d.earned)}</strong>} />}
      </Card>
      <Card title="Payments and advances in this period">
        {d.pay.length + d.adv.length === 0 && <Muted>None.</Muted>}
        {[...d.pay.map((e) => ({ e, what: 'Paid' })), ...d.adv.map((e) => ({ e, what: 'Advance given' }))].sort((a, b) => b.e.date.localeCompare(a.e.date)).map(({ e, what }) => (
          <Row key={e.id} top to={can.write ? href('/pay', { entry: e.id }) : undefined} left={<><strong>{what}</strong> · {fmtDate(e.date)}</>}
            sub={[MODE_LABEL[e.mode], e.by, e.advanceRecovered ? `${inr(e.advanceRecovered)} advance taken back` : '', e.diffComment || e.note].filter(Boolean).join(' · ')} right={<Money v={e.amount} />} />
        ))}
      </Card>
    </Page>
  );
}
