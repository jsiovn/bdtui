import blessed from 'blessed';
import { state } from '../state.js';

const STATUS_SHORT = {
  open:        'open   ',
  in_progress: 'in_prog',
  blocked:     'blocked',
  deferred:    'deferrd',
  closed:      'closed ',
};

const PRIORITY_COLOR = ['red', 'yellow', 'green', 'cyan', 'gray'];
const STATUS_COLOR = {
  open: 'white', in_progress: 'cyan', blocked: 'red',
  deferred: 'yellow', closed: 'gray',
};

const TYPE_BADGE = {
  epic:    '{magenta-fg}E{/}',
  task:    '{blue-fg}T{/}',
  chore:   '{gray-fg}C{/}',
  bug:     '{red-fg}B{/}',
  story:   '{cyan-fg}S{/}',
  feature: '{green-fg}F{/}',
};

function t(color, text) {
  return `{${color}-fg}${text}{/}`;
}

function formatRow(bead, depth = 0, isLast = false) {
  const id   = bead.id.padEnd(14);
  const p    = `P${bead.priority ?? 2}`;
  const stat = bead.status || 'open';
  const s    = (STATUS_SHORT[stat] || stat.slice(0, 7)).padEnd(7);
  const badge = TYPE_BADGE[bead.issue_type] ?? t('gray', '?');
  const prefix = depth > 0 ? t('gray', isLast ? ' └ ' : ' ├ ') : '   ';
  const title = bead.title || '';

  const idCol = t('gray', id);
  const pCol  = t(PRIORITY_COLOR[bead.priority ?? 2] ?? 'white', p);
  const sCol  = t(STATUS_COLOR[stat] ?? 'white', s);

  return `${idCol} ${pCol} ${sCol} ${badge}${prefix}${title}`;
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
    scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'cyan' } },
    style: {
      selected: { bg: 'blue', fg: 'white', bold: true },
      border: { fg: 'gray' },
      label: { fg: 'white', bold: true },
    },
  });
}

export function renderList(list) {
  const total = state.listOrder.length;
  // In paged ("load more") mode only the first visibleCount rows are rendered;
  // everything else renders the full list.
  const shown = state.visibleCount > 0 && state.visibleCount < total
    ? state.visibleCount
    : total;
  const ids = state.listOrder.slice(0, shown);

  const items = ids.map((id) => {
    const b = state.beadsById.get(id);
    const { depth = 0, isLast = false } = state.treeMeta.get(id) ?? {};
    return b ? formatRow(b, depth, isLast) : t('gray', id);
  });

  const selIdx = state.selectedId
    ? Math.max(0, ids.indexOf(state.selectedId))
    : 0;

  const label = shown < total
    ? ` Beads ${t('gray', `(showing ${shown} of ${total})`)} `
    : ` Beads ${t('gray', `(${total})`)} `;
  list.setLabel(label);
  list.setItems(items);
  if (ids.length > 0) list.select(Math.min(selIdx, ids.length - 1));
}
