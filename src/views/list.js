import blessed from 'blessed';
import { state } from '../state.js';

const STATUS_SHORT = {
  open: 'open   ',
  in_progress: 'in_prog',
  blocked: 'blocked',
  deferred: 'deferrd',
  closed: 'closed ',
};

function formatRow(bead) {
  const id = bead.id.padEnd(14);
  const p = `P${bead.priority ?? 2}`;
  const s = (STATUS_SHORT[bead.status] || bead.status.slice(0, 7)).padEnd(7);
  return `${id} ${p} ${s} ${bead.title || ''}`;
}

export function createList(screen) {
  return blessed.list({
    parent: screen,
    top: 1,
    left: 0,
    width: '40%',
    bottom: 1,
    border: { type: 'line' },
    label: ' Beads ',
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    scrollbar: { ch: '│', track: { bg: 'black' } },
    style: {
      selected: { bg: 'blue', fg: 'white', bold: true },
      border: { fg: 'gray' },
      label: { fg: 'white', bold: true },
    },
  });
}

export function renderList(list) {
  const items = state.listOrder.map((id) => {
    const b = state.beadsById.get(id);
    return b ? formatRow(b) : id;
  });

  const selIdx = state.selectedId
    ? Math.max(0, state.listOrder.indexOf(state.selectedId))
    : 0;

  list.setItems(items);
  if (state.listOrder.length > 0) list.select(selIdx);
}
