// One box for the photos of an entry: several photos, each with when it was
// added and by whom; View and Remove on each. Used by the harvest and payment forms.
import React, { useRef, useState } from 'react';
import { useData } from '../data/DataContext';
import { Card, Row, Btn, Muted } from './kit';
import { fmtMomentIST } from '../core/util';

export default function Photos({ photos, onChange, date, folder = 'slips', title, hint, existing }) {
  const { say, demo, user } = useData();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const add = async (files) => {
    const list = [...(files || [])];
    if (!list.length) return;
    setErr('');
    const svc = await import('../data/slipService');
    const added = [];
    for (let i = 0; i < list.length; i += 1) {
      setBusy(list.length > 1 ? `Storing photo ${i + 1} of ${list.length}…` : 'Storing the photo…');
      try {
        const path = await svc.keepPhoto(await svc.shrink(list[i]), date, folder);
        added.push({ path, at: new Date().toISOString(), by: user?.displayName || user?.email || '' });
      } catch (e) { setErr(`The photo could not be stored: ${svc.photoError(e)}`); break; }
    }
    if (added.length) {
      onChange([...photos, ...added]);
      say(`${added.length === 1 ? 'Photo' : added.length + ' photos'} attached. ${existing ? 'Press Save changes to keep it.' : 'It is kept when you save.'}`);
    }
    setBusy('');
    if (fileRef.current) fileRef.current.value = '';
  };
  const view = async (p) => {
    try { const svc = await import('../data/slipService'); window.open(await svc.photoUrl(p.path), '_blank', 'noopener'); }
    catch (e) { say('The photo could not be opened: ' + (e.code || e.message), true); }
  };
  const remove = (i) => { if (window.confirm('Take this photo off the entry?')) onChange(photos.filter((_, j) => j !== i)); };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} aria-label={title} onChange={(e) => add(e.target.files)} />
      <Card title={`${title}${photos.length ? ` · ${photos.length}` : ''}`}>
        {photos.length === 0 && <Muted>{hint} Nothing is read from the photo.</Muted>}
        {photos.map((p, i) => (
          <Row key={p.path} left={`📷 Photo ${i + 1}`} sub={p.at ? `Added ${fmtMomentIST(p.at)}${p.by ? ' by ' + p.by : ''}` : 'Added before times were kept'}
            right={<span style={{ display: 'flex', gap: 12 }}><button type="button" className="v2-link" onClick={() => view(p)}>View</button><button type="button" className="v2-link" onClick={() => remove(i)}>Remove</button></span>} />
        ))}
        {err && <div className="v2-muted" role="alert" style={{ color: 'var(--red)' }}>{err}</div>}
        <Btn kind="sec" disabled={!!busy} onClick={() => (demo ? say('Photos cannot be stored on sample data.', true) : fileRef.current.click())}>{busy || (photos.length ? '+ Add another photo' : 'Take or choose a photo')}</Btn>
        {photos.length === 0 && <Muted>You can add more than one, for example both sides of a slip.</Muted>}
      </Card>
    </>
  );
}
