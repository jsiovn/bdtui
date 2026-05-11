import blessed from 'blessed';
import { state } from '../state.js';

const STATUS_COLOR = {
  open: 'white', in_progress: 'cyan', blocked: 'red',
  deferred: 'yellow', closed: 'gray',
};
const PRIORITY_COLOR  = ['red', 'yellow', 'green', 'cyan', 'gray'];
const PRIORITY_LABEL  = ['Critical', 'High', 'Normal', 'Low', 'Trivial'];

function t(color, text)  { return `{${color}-fg}${text}{/}`; }
function bold(text)      { return `{bold}${text}{/bold}`; }
function fmtDate(iso)    { return iso ? iso.slice(0, 10) : '—'; }

function field(label, value, labelWidth = 10) {
  return `${t('gray', (label + ':').padEnd(labelWidth))} ${value}`;
}

function sectionHeader(title) {
  return `\n${bold(t('cyan', title))}\n${t('gray', '─'.repeat(44))}`;
}

function depLine(dep, arrow, color) {
  const id    = dep.id || String(dep);
  const type  = dep.dep_type || dep.type || 'blocks';
  const title = dep.title ? ` ${t('gray', '— ' + dep.title)}` : '';
  return `  ${t(color, arrow)} {bold}${id}{/bold} ${t('gray', `[${type}]`)}${title}`;
}

function renderDescription(lines, text) {
  for (const l of text.split('\n')) {
    if (l.startsWith('## '))      lines.push(`  ${bold(t('cyan', l.slice(3)))}`);
    else if (l.startsWith('# '))  lines.push(`  ${bold(t('white', l.slice(2)))}`);
    else if (l.match(/^[-*] /))   lines.push(`  ${t('gray', '•')} ${l.slice(2)}`);
    else                          lines.push(`  ${l}`);
  }
}

let lastId = null;

export function createDetail(screen) {
  return blessed.box({
    parent: screen,
    top: 1,
    left: '40%',
    width: '60%',
    bottom: 1,
    border: { type: 'line' },
    label: ' Detail ',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'cyan' } },
    style: {
      border: { fg: 'gray' },
      label: { fg: 'white', bold: true },
    },
  });
}

export function renderDetail(box) {
  const id = state.selectedId;
  if (!id) { box.setContent(t('gray', 'No bead selected.')); return; }

  const b = state.beadsById.get(id);
  if (!b) { box.setContent(t('gray', `Loading ${id}…`)); return; }

  const resetScroll = id !== lastId;
  lastId = id;

  const prio       = b.priority ?? 2;
  const prioColor  = PRIORITY_COLOR[prio] || 'white';
  const prioLabel  = PRIORITY_LABEL[prio] || String(prio);
  const statColor  = STATUS_COLOR[b.status] || 'white';

  const lines = [];

  // ── Header ─────────────────────────────────────────────────────────────────
  lines.push(`{bold}{white-fg}${b.id}{/} {gray-fg}—{/} ${b.title || ''}`);
  lines.push(t('gray', '═'.repeat(50)));
  lines.push('');

  // ── Fields ─────────────────────────────────────────────────────────────────
  lines.push(
    field('Status',   `{${statColor}-fg}{bold}${b.status || '—'}{/bold}{/}`) +
    '    ' +
    field('Priority', `{${prioColor}-fg}{bold}P${prio} ${prioLabel}{/bold}{/}`)
  );
  lines.push(
    field('Type',     t('white', b.issue_type || '—')) +
    '    ' +
    field('Owner',    t('white', b.owner || '—'))
  );
  lines.push(
    field('Created',  t('gray', fmtDate(b.created_at))) +
    '    ' +
    field('Updated',  t('gray', fmtDate(b.updated_at)))
  );

  if (b.labels?.length > 0) {
    lines.push(field('Labels', b.labels.map((l) => t('blue', l)).join('  ')));
  }

  // ── Dependencies ───────────────────────────────────────────────────────────
  if (b.depsDown?.length > 0) {
    lines.push(sectionHeader(`Depends on (${b.depsDown.length})`));
    for (const d of b.depsDown) lines.push(depLine(d, '→', 'yellow'));
  }
  if (b.depsUp?.length > 0) {
    lines.push(sectionHeader(`Needed by (${b.depsUp.length})`));
    for (const d of b.depsUp) lines.push(depLine(d, '←', 'green'));
  }

  // ── Description ────────────────────────────────────────────────────────────
  if (b.description) {
    lines.push(sectionHeader('Description'));
    lines.push('');
    renderDescription(lines, b.description);
  }

  if (b.acceptance) {
    lines.push(sectionHeader('Acceptance'));
    lines.push('');
    renderDescription(lines, b.acceptance);
  }

  if (b.notes) {
    lines.push(sectionHeader('Notes'));
    lines.push('');
    renderDescription(lines, b.notes);
  }

  box.setContent(lines.join('\n'));
  if (resetScroll) box.scrollTo(0);
}
