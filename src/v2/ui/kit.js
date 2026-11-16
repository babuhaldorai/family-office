// Small building blocks used by every screen.
import React, { useEffect, useState, useCallback } from 'react';
import { fmtDate, inr, isDate } from '../core/util';
import { MODES } from '../core/books';

// ── routing: plain #/path?query links, so Back works and screens can be bookmarked
const parse = () => {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  const query = {};
  q.split('&').filter(Boolean).forEach((kv) => { const [k, v = ''] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v); });
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query };
};
export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const href = (path, query) => {
  const q = query ? Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
  return '#' + path + (q ? '?' + q : '');
};
export const go = (path, query) => { window.location.hash = href(path, query).slice(1); };
export const back = (fallback = '/') => { if (window.history.length > 1) window.history.back(); else go(fallback); };

// ── layout
export function Page({ title, sub, right, backTo, narrow, children }) {
  return (
    <div className={'v2-page' + (narrow ? ' narrow' : '')}>
      <div className="v2-top">
        <div>
          <h1 className="v2-h">{title}</h1>
          {sub && <div className="v2-sub">{sub}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {right}
          {backTo !== undefined && <button type="button" className="v2-link" onClick={() => back(backTo || '/')}>Back</button>}
        </div>
      </div>
      <div className="v2-stack">{children}</div>
    </div>
  );
}
export const Card = ({ title, right, hi, children, style }) => (
  <section className={'v2-card' + (hi ? ' hi' : '')} style={style}>
    {(title || right) && <div className="v2-row" style={{ minHeight: 0 }}><span className="v2-lab">{title}</span>{right}</div>}
    {children}
  </section>
);
export const DelBtn = ({ onClick, label = 'Delete' }) => (
  <button type="button" className="v2-del" aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onClick(); }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>
  </button>
);
export const Row = ({ left, sub, right, top, onClick, to, onDelete, deleteLabel }) => {
  const inner = (<><span style={{ minWidth: 0 }}>{left}{sub && <div className="v2-muted">{sub}</div>}</span><span className="v2-num" style={{ textAlign: 'right' }}>{right}</span></>);
  const cls = 'v2-row' + (top ? ' top' : '');
  const main = to ? <a className={cls + ' tap'} href={to}>{inner}</a>
    : onClick ? <button type="button" className={cls + ' tap'} onClick={onClick}>{inner}</button>
      : <div className={cls}>{inner}</div>;
  if (!onDelete) return main;
  return <div className="v2-rowwrap">{main}<DelBtn onClick={onDelete} label={deleteLabel} /></div>;
};
export const Tag = ({ kind, children, to, onClick }) => {
  const cls = 'v2-tag' + (kind ? ' ' + kind : '');
  if (to) return <a className={cls} href={to}>{children}</a>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{children}</button>;
  return <span className={cls}>{children}</span>;
};
export const Money = ({ v, sign, className }) => <span className={'v2-num ' + (className || '')}>{inr(v, { sign })}</span>;
export const Empty = ({ children }) => <div className="v2-empty">{children}</div>;
export const Muted = ({ children, style }) => <div className="v2-muted" style={style}>{children}</div>;

// ── inputs
export const Field = ({ label, hint, children, style }) => (
  <label className="v2-f" style={style}><span className="v2-flab">{label}</span>{children}{hint && <span className="v2-muted">{hint}</span>}</label>
);
export const Text = ({ value, onChange, big, ...rest }) => (
  <input className={'v2-inp' + (big ? ' big' : '')} type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
);
export const Num = ({ value, onChange, big, ...rest }) => (
  <input className={'v2-inp' + (big ? ' big' : '')} type="text" inputMode="decimal" autoComplete="off" value={value ?? ''}
    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); if ((v.match(/\./g) || []).length <= 1) onChange(v); }} {...rest} />
);
export const Area = ({ value, onChange, ...rest }) => (
  <textarea className="v2-inp" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
);
export const Select = ({ value, onChange, options, placeholder, ...rest }) => (
  <select className="v2-inp" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}
  </select>
);
// The native picker shows dates in the device's own order (India and the US
// differ), so the date is also written out in words underneath.
export const DateField = ({ label = 'Date', value, onChange, style, ...rest }) => (
  <Field label={label} style={style} hint={isDate(value) ? fmtDate(value, { dow: true }) : 'Choose a date'}>
    <input className="v2-inp" type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />
  </Field>
);
export function Chips({ options, value, onChange, label, small, multi, scroll }) {
  const isOn = (v) => (multi ? (value || []).includes(v) : value === v);
  const toggle = (v) => {
    if (!multi) return onChange(v);
    const cur = value || [];
    return onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  return (
    <div className={'v2-chips' + (scroll ? ' scroll' : '')} role="group" aria-label={label}>
      {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return (
        <button key={v} type="button" className={'v2-chip' + (small ? ' sm' : '') + (isOn(v) ? ' on' : '')} aria-pressed={isOn(v)} onClick={() => toggle(v)}>{l}</button>
      ); })}
    </div>
  );
}
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="v2-tabs" role="tablist">
    {tabs.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
  </div>
);
export const Check = ({ checked, onChange, children }) => (
  <label className="v2-check"><input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} /><span>{children}</span></label>
);
export const Btn = ({ kind, small, block, children, ...rest }) => (
  <button type="button" className={'v2-btn' + (kind ? ' ' + kind : '') + (small ? ' sm' : '') + (block ? ' block' : '')} {...rest}>{children}</button>
);

// How, who and when — asked the same way on every payment.
export function PayHow({ value, onChange, handlers, verb = 'paid', withDate = true, dateLabel }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <>
      <div className="v2-flab">How was it {verb}?</div>
      <Chips label="How" options={[...MODES, ['', 'Not sure']]} value={value.mode || ''} onChange={(v) => set('mode', v)} />
      <div className="v2-flab">Who {verb === 'received' ? 'received it' : 'handled it'}?</div>
      <Chips label="Who" options={[...handlers, ['', 'Not sure']]} value={value.by || ''} onChange={(v) => set('by', v)} />
      {withDate && <DateField label={dateLabel || `Date ${verb}`} value={value.date} onChange={(v) => set('date', v)} />}
    </>
  );
}

// "I don't know this bit — ask Ragu." Becomes an action item on Home for that
// person, with a link straight back to this record.
export function Ask({ value, onChange, handlers, suggestion = '' }) {
  if (!value) return <button type="button" className="v2-link" onClick={() => onChange({ who: handlers[1] || handlers[0] || '', text: suggestion })}>Not sure about something here? Ask someone to fill it in</button>;
  return (
    <Card title="Ask someone to fill this in">
      <div className="v2-flab">Who should answer?</div>
      <Chips label="Who should answer" options={handlers} value={value.who} onChange={(v) => onChange({ ...value, who: v })} />
      <Field label="What do you need from them?"><Text value={value.text} onChange={(v) => onChange({ ...value, text: v })} placeholder="How was this received, and who received it?" /></Field>
      <Muted>It appears on Home under “To do” for them, with a link back to this entry. Save this entry to send it.</Muted>
      <button type="button" className="v2-link" onClick={() => onChange(null)}>Do not ask</button>
    </Card>
  );
}
export const askOp = (ask, { link, about, by, date, id }) => (ask && ask.who && ask.text.trim()
  ? [{ col: 'notes', id, data: { kind: 'todo', text: ask.text.trim(), about, assignee: ask.who, link, date, by, done: false } }] : []);

export function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 900px)');
    const on = () => setWide(m.matches);
    if (m.addEventListener) m.addEventListener('change', on); else m.addListener(on);
    return () => { if (m.removeEventListener) m.removeEventListener('change', on); else m.removeListener(on); };
  }, []);
  return wide;
}

// A table on a computer. On a phone each row becomes its own block with the
// column names written beside the values, so nothing has to be scrolled sideways.
export function Table({ head, rows, foot, onRow, onDelete, empty = 'Nothing here yet.' }) {
  const wide = useWide();
  if (!rows.length) return <Empty>{empty}</Empty>;
  const label = (h) => (h && typeof h === 'object' ? h.label : h);
  if (!wide) {
    const block = (cells, key, r) => {
      const pairs = cells.map((c, j) => [label(head[j]), c]).slice(1).filter(([, c]) => c !== '' && c !== null && c !== undefined && c !== false);
      const body = (
        <>
          <div className="v2-stk-title">{cells[0]}</div>
          <div className="v2-stk-grid">{pairs.map(([l, c], k) => <React.Fragment key={k}><span className="v2-stk-l">{l}</span><span className="v2-stk-v">{c}</span></React.Fragment>)}</div>
        </>
      );
      return (
        <div key={key} className={'v2-stk' + (r ? '' : ' tot')}>
          {r && onRow ? <button type="button" className="v2-stk-main" onClick={() => onRow(r)}>{body}</button> : <div className="v2-stk-main">{body}</div>}
          {r && onDelete && !r.noDelete && <DelBtn onClick={() => onDelete(r)} label={r.deleteLabel || 'Delete this row'} />}
        </div>
      );
    };
    return <div>{rows.map((r, i) => block(r.cells, r.key ?? i, r))}{foot && block(foot, 'foot', null)}</div>;
  }
  return (
    <div className="v2-tw">
      <table className="v2-table">
        <thead><tr>{head.map((h, i) => <th key={i} className={h.r ? 'r' : ''}>{h.label ?? h}</th>)}{onDelete && <th><span style={{ position: 'absolute', left: -9999 }}>Delete</span></th>}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key ?? i} className={onRow ? 'tap' : ''} onClick={onRow ? () => onRow(r) : undefined}
              tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => { if (e.key === 'Enter') onRow(r); } : undefined}>
              {r.cells.map((c, j) => <td key={j} className={head[j] && head[j].r ? 'r' : ''}>{c}</td>)}
              {onDelete && <td style={{ padding: '2px 0', verticalAlign: 'middle' }}>{r.noDelete ? null : <DelBtn onClick={() => onDelete(r)} label={r.deleteLabel || 'Delete this row'} />}</td>}
            </tr>
          ))}
          {foot && <tr className="tot">{foot.map((c, j) => <td key={j} className={head[j] && head[j].r ? 'r' : ''}>{c}</td>)}{onDelete && <td />}</tr>}
        </tbody>
      </table>
    </div>
  );
}

export function BarRow({ label, value, max, text, kind }) {
  const pct = max > 0 ? Math.max(1, Math.round((Math.abs(value) / max) * 100)) : 0;
  return (<div className="v2-barrow"><span>{label}</span><div><div className={'v2-bar' + (kind ? ' ' + kind : '')} style={{ width: pct + '%' }} /></div><strong className="v2-num">{text}</strong></div>);
}

export function download(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + text : text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function useForm(initial) {
  const [form, setForm] = useState(initial);
  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: typeof v === 'function' ? v(f[k]) : v })), []);
  return [form, set, setForm];
}
