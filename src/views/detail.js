import blessed from 'blessed';
import { state } from '../state.js';

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : '—';
}

function depLine(dep, arrow) {
  const id = dep.id || String(dep);
  const type = dep.dep_type || dep.type || 'blocks';
  const title = dep.title ? ` — ${dep.title}` : '';
  return `  ${arrow} {bold}${id}{/} [${type}]${title}`;
}

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
    scrollbar: { ch: '│', track: { bg: 'black' } },
    style: {
      border: { fg: 'gray' },
      label: { fg: 'white', bold: true },
    },
  });
}

export function renderDetail(box) {
  const id = state.selectedId;
  if (!id) { box.setContent('No bead selected.'); return; }

  const b = state.beadsById.get(id);
  if (!b) { box.setContent(`Loading ${id}…`); return; }

  const lines = [];
  lines.push(`{bold}${b.id}{/} — ${b.title || ''}`);
  lines.push('{gray-fg}' + '─'.repeat(48) + '{/}');
  lines.push('');

  const statusColor = {
    open: 'white', in_progress: 'cyan', blocked: 'red',
    deferred: 'gray', closed: 'gray',
  }[b.status] || 'white';

  lines.push(`Status:   {${statusColor}-fg}${b.status || '—'}{/}   Priority: {yellow-fg}P${b.priority ?? '—'}{/}`);
  lines.push(`Type:     ${(b.issue_type || '—').padEnd(12)} Owner: ${b.owner || '—'}`);
  lines.push(`Created:  ${fmtDate(b.created_at).padEnd(12)} Updated: ${fmtDate(b.updated_at)}`);

  if (b.labels?.length > 0) {
    lines.push(`Labels:   ${b.labels.join(', ')}`);
  }

  if (b.depsDown?.length > 0) {
    lines.push('');
    lines.push(`{bold}Depends on (${b.depsDown.length}):{/}`);
    for (const d of b.depsDown) lines.push(depLine(d, '→'));
  }

  if (b.depsUp?.length > 0) {
    lines.push('');
    lines.push(`{bold}Needed by (${b.depsUp.length}):{/}`);
    for (const d of b.depsUp) lines.push(depLine(d, '←'));
  }

  if (b.description) {
    lines.push('');
    lines.push('{bold}Description:{/}');
    for (const l of b.description.split('\n')) lines.push(`  ${l}`);
  }

  if (b.acceptance) {
    lines.push('');
    lines.push('{bold}Acceptance:{/}');
    for (const l of b.acceptance.split('\n')) lines.push(`  ${l}`);
  }

  if (b.notes) {
    lines.push('');
    lines.push('{bold}Notes:{/}');
    for (const l of b.notes.split('\n')) lines.push(`  ${l}`);
  }

  box.setContent(lines.join('\n'));
}
