import blessed from 'blessed';
import { state } from '../state.js';

const STATUS_COLOR = {
  open: 'white', in_progress: 'cyan', blocked: 'red',
  deferred: 'yellow', closed: 'gray',
};
const PRIORITY_COLOR  = ['red', 'yellow', 'green', 'cyan', 'gray'];
const PRIORITY_LABEL  = ['Critical', 'High', 'Normal', 'Low', 'Trivial'];

function esc(s)          { return String(s ?? '').replace(/\{/g, '{open}').replace(/\}/g, '{close}'); }
function t(color, text)  { return `{${color}-fg}${text}{/}`; }
function bold(text)      { return `{bold}${text}{/bold}`; }
function fmtDate(iso)    { return iso ? iso.slice(0, 10) : '—'; }

function field(label, value, labelWidth = 10) {
  return `${t('gray', (label + ':').padEnd(labelWidth))} ${value}`;
}

function visLen(s)        { return s.replace(/\{[^}]+\}/g, '').length; }
function padRight(s, n)   { const p = n - visLen(s); return p > 0 ? s + ' '.repeat(p) : s; }

function fieldRow(lLabel, lVal, rLabel, rVal, lValWidth = 14) {
  const left  = t('gray', (lLabel + ':').padEnd(10)) + ' ' + padRight(lVal, lValWidth);
  const right = '  ' + t('gray', (rLabel + ':').padEnd(10)) + ' ' + rVal;
  return left + ' ' + t('gray', '│') + right;
}

function sectionHeader(title) {
  return `\n${bold(t('cyan', title))}\n${t('gray', '─'.repeat(44))}`;
}

function depLine(dep, arrow, color) {
  const id    = esc(dep.id || String(dep));
  const type  = esc(dep.dep_type || dep.type || 'blocks');
  const title = dep.title ? ` ${t('gray', '— ' + esc(dep.title))}` : '';
  return `  ${t(color, arrow)} {bold}${id}{/bold} ${t('gray', `[${type}]`)}${title}`;
}

// Apply inline markdown styling to already-escaped text. Order matters:
// inline code is captured first to placeholders so its content is not
// mangled by bold/italic/link regexes.
function applyInline(s) {
  const codes = [];
  let out = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\x00C${codes.length - 1}\x00`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '{bold}{white-fg}$1{/white-fg}{/bold}');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:!?)]|$)/g, '$1{italic}$2{/italic}');
  out = out.replace(/~~([^~]+)~~/g, '{strikethrough}$1{/strikethrough}');
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '{underline}{cyan-fg}$1{/cyan-fg}{/underline} {gray-fg}($2){/gray-fg}',
  );
  out = out.replace(/\x00C(\d+)\x00/g, (_, i) => t('yellow', '`' + codes[+i] + '`'));
  return out;
}

function renderDescription(lines, text) {
  const src = text.split('\n');
  let inCode = false;
  for (const raw of src) {
    const l = raw;

    if (l.trim().startsWith('```')) {
      inCode = !inCode;
      lines.push(`  ${t('gray', '────')}`);
      continue;
    }
    if (inCode) {
      lines.push(`  ${t('green', esc(l))}`);
      continue;
    }

    if (l.startsWith('### '))     lines.push(`  ${bold(t('blue', applyInline(esc(l.slice(4)))))}`);
    else if (l.startsWith('## ')) lines.push(`  ${bold(t('cyan', applyInline(esc(l.slice(3)))))}`);
    else if (l.startsWith('# '))  lines.push(`  ${bold(t('white', applyInline(esc(l.slice(2)))))}`);
    else if (l.match(/^[-*] /))   lines.push(`  ${t('gray', '•')} ${applyInline(esc(l.slice(2)))}`);
    else if (l.match(/^\s*\d+\.\s+/)) {
      const m = l.match(/^(\s*)(\d+)\.\s+(.*)$/);
      lines.push(`  ${m[1]}${t('gray', m[2] + '.')} ${applyInline(esc(m[3]))}`);
    }
    else if (l.startsWith('> '))  lines.push(`  ${t('gray', '│')} ${t('gray', applyInline(esc(l.slice(2))))}`);
    else                          lines.push(`  ${applyInline(esc(l))}`);
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
  lines.push(`{bold}{white-fg}${esc(b.id)}{/} {gray-fg}—{/} ${esc(b.title || '')}`);
  lines.push(t('gray', '═'.repeat(50)));
  lines.push('');

  // ── Fields ─────────────────────────────────────────────────────────────────
  lines.push(fieldRow(
    'Status',   `{${statColor}-fg}{bold}${esc(b.status || '—')}{/bold}{/}`,
    'Priority', `{${prioColor}-fg}{bold}P${prio} ${prioLabel}{/bold}{/}`,
  ));
  lines.push(fieldRow(
    'Type',  t('white', esc(b.issue_type || '—')),
    'Owner', t('white', esc(b.owner || '—')),
  ));
  lines.push(fieldRow(
    'Created', t('gray', fmtDate(b.created_at)),
    'Updated', t('gray', fmtDate(b.updated_at)),
  ));

  if (b.labels?.length > 0) {
    lines.push(field('Labels', b.labels.map((l) => t('blue', esc(l))).join('  ')));
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
