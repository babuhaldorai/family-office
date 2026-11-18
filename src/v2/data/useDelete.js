// One-tap delete used on every list. Everything goes to the recycle bin
// (Settings → Recycle bin), so a wrong tap can be undone.
import { useData } from './DataContext';
import { removeEntryOps, removeDeliveryOps, removeWithPayments } from './actions';
import { fmtDate, inr } from '../core/util';

export function useDelete() {
  const { books, run } = useData();
  const done = 'Moved to the recycle bin';
  return {
    entry(id) {
      const e = books.entryById.get(id);
      if (!e) return;
      const extra = e.kind === 'tea_sale' && (e.deliveryIds || []).length ? '\n\nIts harvests go back to "rate not known".' : '';
      if (window.confirm(`Delete this payment?\n\n${e.party} · ${fmtDate(e.date)} · ${inr(e.amount)}${extra}`)) run(removeEntryOps(id, books), done);
    },
    delivery(id) {
      const d = books.deliveryById.get(id);
      if (!d) return;
      const res = removeDeliveryOps(id, books);
      if (res.error) { run(res); return; }
      if (window.confirm(`Delete this harvest?\n\n${fmtDate(d.date)} · ${d.fieldName} · ${d.agentName} · ${d.net.toFixed(1)} kg`)) run(res, done);
    },
    bill(col, id, label) {
      const res = removeWithPayments(col, id, books);
      if (res.error) { run(res); return; }
      const grp = res.groupSize > 1 ? `\n\nIt was entered together with ${res.groupSize - 1} other ${col === 'stock' ? 'line' : 'field'}${res.groupSize > 2 ? 's' : ''}; ${res.groupSize > 2 ? 'they are' : 'it is'} deleted too.` : '';
      if (window.confirm(`Delete ${label}?${grp}${res.alsoRemoved ? `\n\nThe ${res.alsoRemoved === 1 ? 'payment' : res.alsoRemoved + ' payments'} recorded for it will be deleted too.` : ''}`)) run(res, done);
    },
  };
}
