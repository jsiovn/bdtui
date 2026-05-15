import blessed from 'blessed';

function listPicker(screen, label, items, borderColor = 'cyan', width = 36, left = 'center') {
  return new Promise((resolve, reject) => {
    const height = Math.min(items.length + 4, 20);
    const picker = blessed.list({
      parent: screen,
      label: ` ${label} `,
      border: { type: 'line' },
      top: 'center',
      left,
      width,
      height,
      items,
      keys: true,
      vi: true,
      tags: true,
      style: {
        selected: { bg: 'blue', fg: 'white', bold: true },
        border: { fg: borderColor },
        label: { fg: borderColor, bold: true },
      },
    });

    picker.focus();
    screen.render();

    picker.once('select', (item) => {
      picker.destroy();
      screen.render();
      resolve(item.content.trim());
    });

    picker.key(['escape', 'q', 'h'], () => {
      picker.destroy();
      screen.render();
      reject(new Error('cancelled'));
    });
  });
}

export function statusPicker(screen) {
  return listPicker(
    screen,
    'Change Status',
    ['open', 'in_progress', 'blocked', 'deferred', 'closed'],
    'cyan',
  );
}

export function priorityPicker(screen) {
  return listPicker(
    screen,
    'Change Priority',
    ['0 — Critical', '1 — High', '2 — Normal', '3 — Low', '4 — Trivial'],
    'yellow',
  ).then((val) => parseInt(val[0], 10));
}

export function textPrompt(screen, label, defaultVal = '') {
  return new Promise((resolve, reject) => {
    const prompt = blessed.prompt({
      parent: screen,
      border: 'line',
      height: 'shrink',
      width: '60%',
      top: 'center',
      left: 'center',
      label: ` ${label} `,
      tags: true,
      keys: true,
      vi: true,
      style: {
        border: { fg: 'green' },
        label: { fg: 'green', bold: true },
      },
    });

    prompt.input(`${label}:`, defaultVal, (err, value) => {
      prompt.destroy();
      screen.render();
      if (err || value == null) return reject(new Error('cancelled'));
      resolve(value.trim());
    });

    screen.render();
  });
}

const CLEAR_FILTER_TAG = '__clear__';

export function epicPicker(screen, epics, currentEpicId = null) {
  return new Promise((resolve, reject) => {
    const sorted = [...epics].sort((a, b) => a.id.localeCompare(b.id));
    const rows = [];
    const ids = [];

    if (currentEpicId) {
      rows.push('{yellow-fg}✗ Clear epic filter{/}');
      ids.push(CLEAR_FILTER_TAG);
    }

    for (const e of sorted) {
      const marker = e.id === currentEpicId ? '{cyan-fg}●{/} ' : '  ';
      const id = e.id.padEnd(12);
      const title = (e.title || '').slice(0, 60);
      rows.push(`${marker}{gray-fg}${id}{/} ${title}`);
      ids.push(e.id);
    }

    if (rows.length === 0) {
      rows.push('{gray-fg}(no epics found){/}');
      ids.push(null);
    }

    const width = 72;
    const height = Math.min(rows.length + 4, Math.max(8, screen.height - 4));

    const picker = blessed.list({
      parent: screen,
      label: ' Filter by Epic ',
      border: { type: 'line' },
      top: 'center',
      left: 'center',
      width,
      height,
      items: rows,
      keys: true,
      vi: true,
      tags: true,
      scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'magenta' } },
      style: {
        selected: { bg: 'blue', fg: 'white', bold: true },
        border: { fg: 'magenta' },
        label: { fg: 'magenta', bold: true },
      },
    });

    // Select current epic by default if set
    if (currentEpicId) {
      const idx = ids.indexOf(currentEpicId);
      if (idx >= 0) picker.select(idx);
    }

    picker.focus();
    screen.render();

    picker.once('select', (_item, index) => {
      const picked = ids[index];
      picker.destroy();
      screen.render();
      if (picked === null) return reject(new Error('cancelled'));
      resolve(picked === CLEAR_FILTER_TAG ? null : picked);
    });

    picker.key(['escape', 'q'], () => {
      picker.destroy();
      screen.render();
      reject(new Error('cancelled'));
    });
  });
}

export function skillPicker(screen, beadId) {
  const items = [
    `/executor-task ${beadId}`,
    `/executor-task-worktree ${beadId}`,
    `/executor-epic-task ${beadId}`,
    `/executor-epic-task-worktree ${beadId}`,
    `/executor-rework-in-place ${beadId}`,
  ];
  return listPicker(screen, 'Copy workflow command', items, 'magenta', 56, 1);
}

const DEP_TYPES = [
  'blocks', 'tracks', 'related', 'relates-to',
  'validates', 'caused-by', 'parent-child',
];

export async function depMenu(screen) {
  const action = await listPicker(
    screen,
    'Dependency',
    ['Add dep', 'Remove dep'],
    'magenta',
  );

  const targetId = await textPrompt(screen, 'Target bead ID');
  if (!targetId) throw new Error('cancelled');

  if (action === 'Add dep') {
    const type = await listPicker(screen, 'Dep type', DEP_TYPES, 'magenta');
    return { action: 'add', targetId, type };
  }

  return { action: 'remove', targetId };
}
