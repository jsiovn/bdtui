import blessed from 'blessed';

// Invisible full-screen layer under a modal. blessed sends a mouse event to the
// topmost clickable element under the pointer, so without this a click beside
// a dialog lands on the list / detail / tab bar behind it and steals keyboard
// focus from the dialog. Create it BEFORE the modal widget (z-order is creation
// order). render() is replaced so it is hit-tested but paints nothing.
export function backdrop(screen, onOutside) {
  const shade = blessed.box({
    parent: screen,
    top: 0, left: 0,
    width: '100%', height: '100%',
    autoFocus: false,
  });
  shade.render = function () {
    this.lpos = this._getCoords();
    return this.lpos;
  };
  shade.on('click', onOutside);
  return shade;
}

// One click picks a row. blessed's own mouse:true click only moves the
// highlight to a row and needs a second click on it to confirm. The detached
// check covers a click on the already-highlighted row, which blessed has just
// confirmed (and the picker closed) by the time this runs.
function pickOnClick(picker) {
  picker.on('element click', (el) => {
    const i = picker.items.indexOf(el);
    if (i >= 0 && !picker.detached) picker.enterSelected(i);
  });
}

function listPicker(screen, label, items, borderColor = 'cyan', width = 36, left = 'center') {
  return new Promise((resolve, reject) => {
    const height = Math.min(items.length + 4, 20);
    const close = () => {
      shade.destroy();
      picker.destroy();
      screen.render();
    };
    const cancel = () => {
      close();
      reject(new Error('cancelled'));
    };
    const shade = backdrop(screen, cancel);
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
      mouse: true,
      tags: true,
      style: {
        selected: { bg: 'blue', fg: 'white', bold: true },
        border: { fg: borderColor },
        label: { fg: borderColor, bold: true },
      },
    });
    pickOnClick(picker);

    picker.focus();
    screen.render();

    picker.once('select', (item) => {
      close();
      // Strip color tags so callers get the plain text (e.g. the command to copy).
      resolve(blessed.helpers.cleanTags(item.content));
    });

    picker.key(['escape', 'q', 'h'], cancel);
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
    const shade = backdrop(screen, () => prompt._.input.cancel());
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
      // A click inside the dialog must not reach the backdrop (cancel) or move
      // focus off the input (blur also cancels): absorb it, without focusing.
      autoFocus: false,
      style: {
        border: { fg: 'green' },
        label: { fg: 'green', bold: true },
      },
    });
    prompt.on('click', () => {});
    // blessed's Button.press() focuses the button first. That blurs the input,
    // and a blurred input cancels itself, so the Okay button cancels. Submit
    // straight from the press instead.
    prompt._.okay.press = () => prompt._.input.submit();

    prompt.input(`${label}:`, defaultVal, (err, value) => {
      shade.destroy();
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
    // Newest epics on top: sort by created_at descending (ISO-8601 UTC strings
    // sort lexicographically in chronological order). Fall back to id for ties
    // or missing timestamps.
    const sorted = [...epics].sort((a, b) => {
      const ta = a.created_at || '';
      const tb = b.created_at || '';
      if (ta !== tb) return tb.localeCompare(ta);
      return b.id.localeCompare(a.id);
    });
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

    const close = () => {
      shade.destroy();
      picker.destroy();
      screen.render();
    };
    const cancel = () => {
      close();
      reject(new Error('cancelled'));
    };
    const shade = backdrop(screen, cancel);
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
      mouse: true,
      tags: true,
      scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'magenta' } },
      style: {
        selected: { bg: 'blue', fg: 'white', bold: true },
        border: { fg: 'magenta' },
        label: { fg: 'magenta', bold: true },
      },
    });

    pickOnClick(picker);

    // Select current epic by default if set
    if (currentEpicId) {
      const idx = ids.indexOf(currentEpicId);
      if (idx >= 0) picker.select(idx);
    }

    picker.focus();
    screen.render();

    picker.once('select', (_item, index) => {
      const picked = ids[index];
      close();
      if (picked === null) return reject(new Error('cancelled'));
      resolve(picked === CLEAR_FILTER_TAG ? null : picked);
    });

    picker.key(['escape', 'q'], cancel);

    picker.key(['x'], () => {
      close();
      resolve(null);
    });
  });
}

export function skillPicker(screen, beadId, issueType) {
  // Epics get the epic-level executor (runs every ready child sequentially on a
  // single branch); tasks/chores/bugs get the per-bead executors. One row per
  // skill: with agent-workflow-beads >= 1.3.0 the epic skills pick their own
  // per-bead worker, so there are no per-CLI rows.
  const skills = issueType === 'epic'
    ? ['executor-epic-sequential', 'executor-epic-sequential-worktree']
    : [
        'executor-task',
        'executor-task-worktree',
        'executor-epic-task',
        'executor-epic-task-worktree',
        'executor-rework-in-place',
      ];
  const items = skills.map((skill) => `{green-fg}/${skill}{/green-fg} {gray-fg}${beadId}{/gray-fg}`);
  return listPicker(screen, 'Copy workflow command', items, 'magenta', 56, 1);
}

export function parentPicker(screen, epics, { selfId, currentParentIds = [] } = {}) {
  return new Promise((resolve, reject) => {
    const exclude = new Set([selfId, ...currentParentIds]);
    const sorted = [...epics]
      .filter((e) => !exclude.has(e.id))
      .sort((a, b) => {
        const ta = a.updated_at || '', tb = b.updated_at || '';
        if (ta !== tb) return tb.localeCompare(ta);
        return b.id.localeCompare(a.id);
      });

    const rows = ['{yellow-fg}Standalone bead{/}'];
    const ids = [null];

    for (const e of sorted) {
      const id = e.id.padEnd(12);
      const title = (e.title || '').slice(0, 60);
      rows.push(`{gray-fg}${id}{/} ${title}`);
      ids.push(e.id);
    }

    const width = 72;
    const height = Math.min(rows.length + 4, Math.max(8, screen.height - 4));

    const close = () => {
      shade.destroy();
      picker.destroy();
      screen.render();
    };
    const cancel = () => {
      close();
      reject(new Error('cancelled'));
    };
    const shade = backdrop(screen, cancel);
    const picker = blessed.list({
      parent: screen,
      label: ' Change Parent ',
      border: { type: 'line' },
      top: 'center',
      left: 'center',
      width,
      height,
      items: rows,
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      scrollbar: { ch: ' ', track: { bg: 'black' }, style: { bg: 'magenta' } },
      style: {
        selected: { bg: 'blue', fg: 'white', bold: true },
        border: { fg: 'magenta' },
        label: { fg: 'magenta', bold: true },
      },
    });
    pickOnClick(picker);

    picker.focus();
    screen.render();

    picker.once('select', (_item, index) => {
      close();
      resolve(ids[index]);
    });

    picker.key(['escape', 'q'], cancel);
  });
}
