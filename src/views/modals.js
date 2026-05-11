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

export function skillPicker(screen, beadId) {
  const items = [
    `/executor-task ${beadId}`,
    `/executor-task-worktree ${beadId}`,
    `/executor-epic-task ${beadId}`,
    `/executor-epic-task-worktree ${beadId}`,
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
