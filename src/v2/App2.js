import React, { useEffect, useState } from 'react';
import { applyUpdate } from '../serviceWorkerRegistration';
import './v2.css';
import { DataProvider, useData } from './data/DataContext';
import { useRoute, href } from './ui/kit';
import Home from './screens/Home';
import Harvest from './screens/Harvest';
import Payment from './screens/Payment';
import Tea from './screens/Tea';
import FieldPage, { StockForm } from './screens/FieldPage';
import { Properties, Property } from './screens/Property';
import Reports from './screens/Reports';
import Settings from './screens/Settings';

const NAV = [['', 'Home'], ['tea', 'Tea'], ['rentals', 'Rentals'], ['homes', 'Homes'], ['reports', 'Reports']];
const sectionOf = (path, books) => {
  const p = path[0] || '';
  if (p === 'harvest' || p === 'field' || p === 'stock') return 'tea';
  if (p === 'property') return books?.propertyById.get(path[1])?.kind === 'home' ? 'homes' : 'rentals';
  if (p === 'pay' || p === 'settings') return '';
  return p;
};

function Shell({ onLogout, onClassic }) {
  const { books, meta, can, demo } = useData();
  const { path, query } = useRoute();
  const [update, setUpdate] = useState(!!window.__swWaiting);
  const [online, setOnline] = useState(navigator.onLine);
  // Some hosts pin a badge to the bottom corner of the page, on top of the
  // bottom menu. Measure anything pinned there that is not ours and lift the
  // menu above it.
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const measure = () => {
      let h = 0;
      const vh = window.innerHeight;
      Array.from(document.body.children).forEach((el) => {
        if (el.id === 'root' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') return;
        const probe = [el, ...Array.from(el.querySelectorAll ? el.querySelectorAll('*') : []).slice(0, 30)];
        probe.forEach((n) => {
          const cs = window.getComputedStyle(n);
          if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
          const r = n.getBoundingClientRect();
          if (r.width > 20 && r.height > 10 && r.height < 120 && r.bottom > vh - 140 && r.top > vh / 2) h = Math.max(h, Math.ceil(vh - r.top) + 8);
        });
      });
      setLift(Math.min(h, 140));
    };
    const timers = [300, 1500, 4000].map((ms) => setTimeout(measure, ms));
    window.addEventListener('resize', measure);
    return () => { timers.forEach(clearTimeout); window.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => {
    const up = () => setUpdate(true);
    const net = () => setOnline(navigator.onLine);
    window.addEventListener('v2-update', up); window.addEventListener('online', net); window.addEventListener('offline', net);
    return () => { window.removeEventListener('v2-update', up); window.removeEventListener('online', net); window.removeEventListener('offline', net); };
  }, []);

  if (!books || !meta.loaded) return <div className="v2 v2-center"><div className="v2-h">Family Office</div><div className="v2-muted">Loading…</div></div>;

  // Data entry is deliberately not allowed to read the money collections
  const denied = can.money ? (meta.failed || []).filter(([, code]) => /permission/i.test(String(code))) : [];
  if (denied.length) {
    return (
      <div className="v2 v2-center">
        <div className="v2-h">Almost there</div>
        <div style={{ maxWidth: 520 }}>The new screens are installed, but the database has not been told to allow them yet. The updated security rules in the project file <strong>firestore.rules</strong> need to be published once in the Firebase console (Firestore Database → Rules).</div>
        <div className="v2-muted">Blocked: {denied.map(([c]) => c).join(', ')}</div>
        {onClassic && <button type="button" className="v2-btn sec" onClick={onClassic}>Open the old app meanwhile</button>}
        {onLogout && <button type="button" className="v2-link" onClick={onLogout}>Sign out</button>}
      </div>
    );
  }

  const section = sectionOf(path, books);
  const nav = can.money ? NAV : NAV.filter(([k]) => k === '' || k === 'tea');
  let screen;
  switch (path[0] || '') {
    case '': screen = <Home />; break;
    case 'harvest': screen = <Harvest key={path[1] || 'new'} id={path[1]} query={query} />; break;
    case 'pay': screen = <Payment key={query.entry || JSON.stringify(query)} query={query} />; break;
    case 'tea': screen = <Tea tab={path[1]} />; break;
    case 'field': screen = <FieldPage key={path[1] + (query.add || '') + (query.edit || '')} id={path[1]} tab={path[2]} query={query} />; break;
    case 'stock': screen = <StockForm key={path[1] || 'new'} id={path[1]} />; break;
    case 'rentals': screen = <Properties kind="rental" />; break;
    case 'homes': screen = <Properties kind="home" />; break;
    case 'property': screen = <Property key={path[1]} id={path[1]} />; break;
    case 'reports': screen = <Reports tab={path[1]} query={query} />; break;
    case 'settings': screen = <Settings section={path[1]} onLogout={onLogout} onClassic={onClassic} />; break;
    default: screen = <Home />;
  }

  return (
    <div className="v2">
      {demo && <div className="v2-banner">Sample data. Nothing you enter here is saved.</div>}
      {update && <button type="button" className="v2-banner" style={{ display: 'block', width: '100%', border: 0, cursor: 'pointer' }} onClick={applyUpdate}>A new version of the app is ready. Tap to update.</button>}
      {!demo && !online && <div className="v2-banner">No internet. You can keep entering; it will be sent when the connection returns.</div>}
      {meta.pending > 0 && <div className="v2-banner">{meta.pending} {meta.pending === 1 ? 'entry is' : 'entries are'} waiting to be sent.</div>}
      {can.money && !books.ok && <a className="v2-banner red" style={{ display: 'block' }} href={href('/settings/checks')}>Some totals do not agree. Tap to see which.</a>}
      <div className="v2-shell">
        <nav className="v2-side" aria-label="Main">
          <div className="brand">Family Office</div>
          {nav.map(([k, l]) => <a key={k} href={href('/' + k)} className={section === k ? 'on' : ''}>{l}</a>)}
          <a href={href('/settings')} className={path[0] === 'settings' ? 'on' : ''}>Settings</a>
          <div className="foot">
            {can.money && <span className={'v2-tag ' + (books.ok ? 'g' : 'r')}>{books.ok ? 'All totals agree' : 'Totals need a look'}</span>}
            <span className={'v2-tag ' + (meta.pending ? '' : 'g')}>{meta.pending ? `${meta.pending} waiting to sync` : demo ? 'Sample data' : 'Everything is saved'}</span>
          </div>
        </nav>
        <main className="v2-main" style={lift ? { paddingBottom: 76 + lift } : undefined}>{screen}</main>
      </div>
      <nav className="v2-nav" aria-label="Main" style={lift ? { bottom: lift } : undefined}>
        {nav.map(([k, l]) => <a key={k} href={href('/' + k)} className={section === k ? 'on' : ''}>{l}</a>)}
      </nav>
    </div>
  );
}

export default function V2App({ store, user, role, demo, fixedToday, onLogout, onClassic }) {
  return (
    <DataProvider store={store} user={user} role={role} demo={demo} fixedToday={fixedToday}>
      <Shell onLogout={onLogout} onClassic={onClassic} />
    </DataProvider>
  );
}
