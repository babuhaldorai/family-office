import React, { useMemo, useState } from 'react';
import { useData } from '../data/DataContext';
import { Page, Card, Row, Tag, Money, Text, Btn, Muted, Select, href } from '../ui/kit';
import { fmtDate, addDays, periodFor, uid, inr } from '../core/util';
import { doBetter } from '../core/insights';

export default function Home() {
  const { books, today, can, run, user } = useData();
  const [note, setNote] = useState('');
  const [forWho, setForWho] = useState('');
  // which person's items this device shows; remembered on the device
  const [me, setMeState] = useState(() => { try { return window.localStorage.getItem('fo-me') || ''; } catch (e) { return ''; } });
  const setMe = (v) => { setMeState(v); try { window.localStorage.setItem('fo-me', v); } catch (e) { /* private window */ } };
  const month = useMemo(() => books.pnl(periodFor('month', today)), [books, today]);
  const tips = useMemo(() => (can.money ? doBetter(books).slice(0, 2) : []), [books, can.money]);

  const allTodos = books.notes.filter((n) => n.kind === 'todo' && !n.done).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const todos = allTodos.filter((n) => !me || !n.assignee || n.assignee === me);
  // days in the last three with no harvest and not marked "no harvest"
  const skipped = new Set(books.notes.filter((n) => n.kind === 'noharvest').map((n) => n.date));
  const harvested = new Set(books.deliveries.map((d) => d.date));
  const missing = books.deliveries.length && books.settings.remindHarvest !== false ? [1, 2, 3].map((k) => addDays(today, -k)).filter((d) => !harvested.has(d) && !skipped.has(d)) : [];

  const addNote = () => {
    if (!note.trim()) return;
    run({ ops: [{ col: 'notes', id: uid(), data: { kind: 'todo', text: note.trim(), date: today, done: false, by: user?.displayName || '', assignee: forWho || undefined } }] }, forWho ? `Added for ${forWho}` : 'Kept for later');
    setNote('');
  };
  const linkFor = (a) => {
    if (a.type === 'agent') return href('/pay', { type: 'agent', party: a.partyId });
    if (a.type === 'workers') return href('/tea/people');
    if (a.type === 'tenancy') return href('/pay', { type: 'tenant', tenancy: a.tenancyId });
    if (a.type === 'field') return href('/field/' + a.fieldId + '/lease');
    if (a.type === 'property') return href('/property/' + a.propertyId);
    if (a.type === 'bills') return href('/pay', { type: 'bill' });
    return href('/');
  };
  const empty = !books.people.length && !books.fields.length && !books.deliveries.length;

  return (
    <Page title="Home" sub={fmtDate(today, { dow: true })} right={<a className="v2-btn sec sm" href={href('/settings')}>Settings</a>}>
      {empty && (
        <Card title="Getting started" hi>
          <div>Nothing has been entered in the new app yet.</div>
          {can.admin && <a className="v2-btn" href={href('/settings/import')}>Bring in the data from the old app</a>}
          <a className="v2-btn sec" href={href('/settings/lists')}>Or add your fields, workers and agents</a>
        </Card>
      )}

      {can.money && books.attention.length > 0 && (
        <Card title="Needs attention">
          {books.attention.map((a) => (
            <Row key={a.id} to={linkFor(a)} left={<strong>{a.title}</strong>} sub={a.sub}
              right={<Tag>{a.amount != null ? inr(a.amount) : a.tag}</Tag>} />
          ))}
        </Card>
      )}
      {can.money && !empty && books.attention.length === 0 && <Card title="Needs attention"><Muted>Nothing is waiting. All paid up.</Muted></Card>}

      {can.harvest && (
        <Card title="To do" right={(
          <span style={{ width: 150 }}><Select aria-label="Whose items to show" value={me} onChange={setMe} options={books.handlers.map((h) => [h, `For ${h}`])} placeholder="Everyone's" /></span>
        )}>
          <Text value={note} onChange={setNote} placeholder="Type a note or a question…" aria-label="Quick note" onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Select aria-label="Who is it for" value={forWho} onChange={setForWho} options={books.handlers.map((h) => [h, `For ${h}`])} placeholder="For anyone" />
            <Btn kind="sec" onClick={addNote}>Add</Btn>
          </div>
          {todos.map((n) => (
            <div key={n.id} className="v2-row top">
              <span>{n.text}
                <div className="v2-muted">{[n.about, n.assignee ? `For ${n.assignee}` : '', n.by ? `from ${n.by}` : '', fmtDate(n.date, { year: false })].filter(Boolean).join(' · ')}</div>
              </span>
              <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
                {n.link ? <Tag to={'#' + n.link}>Open</Tag> : <Tag to={href('/harvest')}>Log it</Tag>}
                <Tag kind="g" onClick={() => run({ ops: [{ col: 'notes', id: n.id, patch: { done: true } }] }, 'Marked done')}>Done</Tag>
              </span>
            </div>
          ))}
          {me && allTodos.length > todos.length && <Muted>{allTodos.length - todos.length} more for other people. Choose “Everyone's” to see them.</Muted>}
          {missing.map((d) => (
            <div key={d} className="v2-row top">
              <span>No harvest entered for {fmtDate(d, { dow: true, year: false })}<div className="v2-muted">Reminder</div></span>
              <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
                <Tag to={href('/harvest', { date: d })}>Log it</Tag>
                <Tag kind="g" onClick={() => run({ ops: [{ col: 'notes', id: 'noharvest-' + d, data: { kind: 'noharvest', date: d } }] })}>No harvest</Tag>
              </span>
            </div>
          ))}
        </Card>
      )}

      {can.harvest && (
        <Card title="Add something">
          <a className="v2-btn" href={href('/harvest')}>+ Today's harvest</a>
          <div className="v2-cols">
            {can.write && <a className="v2-btn sec" href={href('/pay')}>Payment in or out</a>}
            <a className="v2-btn sec" href={href('/tea/fields')}>Field work</a>
          </div>
        </Card>
      )}

      {can.money && !empty && (
        <Card title={'This month · ' + periodFor('month', today).label} right={<a href={href('/reports')}>Reports</a>}>
          <div className="v2-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div><Muted>Money in</Muted><div className="v2-big v2-num">{inr(Math.round(month.cashIn))}</div></div>
            <div><Muted>Money out</Muted><div className="v2-big v2-num">{inr(Math.round(month.cashOut))}</div></div>
            <div><Muted>Left</Muted><div className={'v2-big v2-num ' + (month.cashNet >= 0 ? 'v2-green' : 'v2-red')}>{inr(Math.round(month.cashNet))}</div></div>
          </div>
        </Card>
      )}

      {tips.length > 0 && (
        <Card title="Where to do better" right={<a href={href('/reports/better')}>See all</a>}>
          {tips.map((t, i) => (
            <Row key={i} top to={href('/reports/better')} left={<strong>{t.title}</strong>} sub={t.action}
              right={t.value ? <Tag kind="g">about <Money v={t.value} /> a year</Tag> : t.tag ? <Tag>{t.tag}</Tag> : null} />
          ))}
        </Card>
      )}
    </Page>
  );
}
