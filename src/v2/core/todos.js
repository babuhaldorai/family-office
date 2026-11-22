// To-dos written while logging a harvest: one note each, kept on Home under
// "To do", for the chosen person, naming the field, date and (optionally) worker,
// with a link back to the harvest.
import { fmtDate } from './util';

export function harvestTodoOps(todos, { deliveryId, fieldId, fieldName, date, nameOf, by, today, newId }) {
  return (todos || []).filter((t) => t && t.text && t.text.trim()).map((t) => ({
    col: 'notes', id: newId(),
    data: {
      kind: 'todo', text: t.text.trim(), done: false, date: today, by: by || '',
      assignee: t.who || undefined,
      about: ['Harvest', fieldName, fmtDate(date, { dow: true, year: false }), t.workerId ? nameOf(t.workerId) : ''].filter(Boolean).join(' · '),
      link: `/harvest/${deliveryId}`, deliveryId, fieldId, workerId: t.workerId || undefined,
    },
  }));
}
