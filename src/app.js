import blessed from 'blessed';
import { execFile } from 'child_process';
import { state, loadList, loadDetail, applyMutation, applyTypeFilter } from './state.js';
import { createList, renderList } from './views/list.js';
import { createDetail, renderDetail } from './views/detail.js';
import { statusPicker, priorityPicker, textPrompt, depMenu, skillPicker, epicPicker } from './views/modals.js';
import { showHelp } from './keys.js';
import { bdUpdate, bdClose, bdClaim, bdReopen, bdDepAdd, bdDepRemove, bdEpics } from './bd.js';

const FILTERS = ['blocked', 'ready', 'in_progress', 'closed', 'all'];
const TYPE_FILTERS = ['all', 'epic', 'task'];

export async function run(cwd) {
  state.cwd = cwd;

  const screen = blessed.screen({ smartCSR: true, title: 'bdtui', fullUnicode: true });

  const tabBar = blessed.box({
    parent: screen,
    top: 0, left: 0,
    width: '100%', height: 1,
    content: '', tags: true,
    style: { bg: 'black', fg: 'white' },
  });

  const statusBar = blessed.box({
    parent: screen,
    bottom: 0, left: 0,
    width: '100%', height: 1,
    content: ' Loading… | {gray-fg}? help{/}',
    tags: true,
    style: { bg: 'black', fg: 'white' },
  });

  const list = createList(screen);
  const detail = createDetail(screen);

  let debounceTimer = null;

  let statusTimer = null;
  function defaultStatus() {
    return state.filter ? `Filter: ${state.filter}` : 'Ready';
  }
  function setStatus(msg, isError = false, transient = false) {
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    const icon = isError ? '{red-fg}✗{/}' : '{green-fg}●{/}';
    const text = isError ? `{red-fg}${msg}{/}` : msg;
    statusBar.setContent(` ${icon} ${text}  {gray-fg}? help · q quit{/}`);
    screen.render();
    if (transient) {
      statusTimer = setTimeout(() => {
        statusTimer = null;
        setStatus(defaultStatus());
      }, 3000);
    }
  }

  function renderTabBar() {
    const tabs = FILTERS.map((f) => {
      return f === state.filter
        ? `{blue-bg}{white-fg}{bold} ${f} {/bold}{/}`
        : `{gray-fg} ${f} {/}`;
    });
    const count = state.listOrder.length;
    const typeLabel = state.typeFilter === 'all' ? 'all' : `${state.typeFilter} only`;
    const typeInfo = `  {gray-fg}│{/}  {yellow-fg}type:{/} ${typeLabel}`;
    const epicInfo = state.epicFilter
      ? `  {gray-fg}│{/}  {magenta-fg}epic:{/} ${state.epicFilter}`
      : '';
    const info  = count > 0 ? `{gray-fg}  │  ${count} beads{/}` : '';
    tabBar.setContent(tabs.join('{gray-fg}│{/}') + typeInfo + epicInfo + info);
  }

  function setFocusBorder(focused) {
    if (focused === 'list') {
      list.style.border.fg   = 'cyan';
      detail.style.border.fg = 'gray';
    } else {
      list.style.border.fg   = 'gray';
      detail.style.border.fg = 'cyan';
    }
  }

  function render() {
    renderTabBar();
    renderList(list);
    renderDetail(detail);
    screen.render();
  }

  // When list selection changes, update selectedId and debounce detail fetch
  function onNav() {
    setImmediate(() => {
      const idx = list.selected;
      const id = state.listOrder[idx];
      if (!id || id === state.selectedId) return;
      state.selectedId = id;
      renderDetail(detail);
      screen.render();

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          await loadDetail(id);
          renderDetail(detail);
          screen.render();
        } catch (err) {
          setStatus(err.message, true, true);
        }
      }, 80);
    });
  }

  // Capture all keypresses on the list to detect navigation
  list.on('keypress', onNav);

  // Focus border highlighting
  list.on('focus',   () => { setFocusBorder('list');   screen.render(); });
  detail.on('focus', () => { setFocusBorder('detail'); screen.render(); });

  async function refresh() {
    setStatus('Refreshing…');
    try {
      await loadList();
      if (state.selectedId && !state.listOrder.includes(state.selectedId)) {
        state.selectedId = state.listOrder[0] || null;
      }
      if (state.selectedId) await loadDetail(state.selectedId);
      render();
      setStatus('Ready');
    } catch (err) {
      setStatus(err.message, true, true);
    }
  }

  async function cycleFilter(dir = 1) {
    const idx = FILTERS.indexOf(state.filter);
    const next = (idx + dir + FILTERS.length) % FILTERS.length;
    state.filter = FILTERS[next];
    setStatus(`Filter: ${state.filter} — loading…`);
    try {
      await loadList();
      state.selectedId = state.listOrder[0] || null;
      if (state.selectedId) await loadDetail(state.selectedId);
      render();
      setStatus(`Filter: ${state.filter}`);
    } catch (err) {
      setStatus(err.message, true, true);
    }
  }

  async function cycleTypeFilter() {
    const idx = TYPE_FILTERS.indexOf(state.typeFilter);
    state.typeFilter = TYPE_FILTERS[(idx + 1) % TYPE_FILTERS.length];
    applyTypeFilter();
    if (state.selectedId && !state.listOrder.includes(state.selectedId)) {
      state.selectedId = state.listOrder[0] || null;
    } else if (!state.selectedId) {
      state.selectedId = state.listOrder[0] || null;
    }
    render();
    if (state.selectedId) {
      try {
        await loadDetail(state.selectedId);
        renderDetail(detail);
        screen.render();
      } catch (err) {
        setStatus(err.message, true, true);
        return;
      }
    }
    setStatus(`Type: ${state.typeFilter}`, false, true);
  }

  // ── Global keys ────────────────────────────────────────────────────────────
  // Modal open? swallow global keys so modals own their own keybindings
  // (e.g. Esc/q close the help dialog instead of quitting the app).
  let modalOpen = false;
  function key(keys, handler) {
    screen.key(keys, (...args) => {
      if (modalOpen) return;
      handler(...args);
    });
  }

  key(['q', 'C-c'], () => { screen.destroy(); process.exit(0); });

  key(['r'], refresh);
  key(['tab'], () => cycleFilter(1));
  key(['S-tab'], () => cycleFilter(-1));
  key(['t'], cycleTypeFilter);

  key(['e'], async () => {
    if (screen.focused !== list) return;
    setStatus('Loading epics…');
    let epics;
    try {
      epics = await bdEpics(state.cwd);
    } catch (err) {
      setStatus(err.message, true, true);
      return;
    }
    setStatus(defaultStatus());
    let picked;
    try {
      picked = await epicPicker(screen, epics, state.epicFilter);
    } catch {
      list.focus();
      return;
    }
    list.focus();
    state.epicFilter = picked;
    if (picked) {
      state.filter = 'all';
      setStatus(`Epic: ${picked} — loading…`);
      try {
        await loadList();
      } catch (err) {
        setStatus(err.message, true, true);
        return;
      }
    } else {
      applyTypeFilter();
    }
    state.selectedId = state.listOrder[0] || null;
    if (state.selectedId) {
      try { await loadDetail(state.selectedId); } catch (err) {
        setStatus(err.message, true, true);
        return;
      }
    }
    render();
    setStatus(picked ? `Epic: ${picked}` : 'Epic filter cleared', false, true);
  });

  key(['?'], () => {
    modalOpen = true;
    showHelp(screen, () => {
      modalOpen = false;
      list.focus();
      screen.render();
    });
  });

  key(['enter', 'l'], () => {
    if (screen.focused === list) { setFocusBorder('detail'); detail.focus(); screen.render(); }
  });

  key(['h', 'escape'], () => {
    if (screen.focused !== list) { setFocusBorder('list'); list.focus(); screen.render(); }
  });

  key(['g'], () => {
    if (screen.focused !== list) return;
    list.select(0);
    onNav();
    screen.render();
  });

  key(['G'], () => {
    if (screen.focused !== list) return;
    list.select(state.listOrder.length - 1);
    onNav();
    screen.render();
  });

  key(['/'], async () => {
    if (screen.focused !== list) return;
    try {
      const query = await textPrompt(screen, 'Filter by title');
      list.focus();
      if (!query) { render(); return; }
      const q = query.toLowerCase();
      state.listOrder = state.listOrder.filter((id) => {
        const b = state.beadsById.get(id);
        return b?.title?.toLowerCase().includes(q);
      });
      state.selectedId = state.listOrder[0] || null;
      renderList(list);
      renderDetail(detail);
      screen.render();
      setStatus(`"${query}" — ${state.listOrder.length} results | r to reset`);
    } catch {
      list.focus();
    }
  });

  // ── Mutation keys (list focus only) ────────────────────────────────────────

  key(['s'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    try {
      const newStatus = await statusPicker(screen);
      list.focus();
      const oldStatus = state.beadsById.get(id)?.status;
      setStatus(`${id}: ${oldStatus} → ${newStatus}…`);
      await applyMutation(id, () => bdUpdate(id, { status: newStatus }, state.cwd));
      renderList(list);
      renderDetail(detail);
      screen.render();
      setStatus(`${id}: ${oldStatus} → ${newStatus}`, false, true);
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true, true);
    }
  });

  key(['c'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    try {
      const reason = await textPrompt(screen, 'Close reason');
      list.focus();
      setStatus(`Closing ${id}…`);
      await applyMutation(id, () => bdClose(id, reason, state.cwd));
      await loadList();
      render();
      setStatus(`Closed ${id}`, false, true);
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true, true);
    }
  });

  key(['C'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    setStatus(`Claiming ${id}…`);
    try {
      await applyMutation(id, () => bdClaim(id, state.cwd));
      renderList(list);
      renderDetail(detail);
      screen.render();
      setStatus(`Claimed ${id}`, false, true);
    } catch (err) {
      setStatus(err.message, true, true);
    }
  });

  key(['o'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    setStatus(`Reopening ${id}…`);
    try {
      await applyMutation(id, () => bdReopen(id, state.cwd));
      await loadList();
      render();
      setStatus(`Reopened ${id}`, false, true);
    } catch (err) {
      setStatus(err.message, true, true);
    }
  });

  key(['p'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    try {
      const priority = await priorityPicker(screen);
      list.focus();
      setStatus(`Setting priority ${priority} on ${id}…`);
      await applyMutation(id, () => bdUpdate(id, { priority }, state.cwd));
      renderList(list);
      renderDetail(detail);
      screen.render();
      setStatus(`${id}: priority → ${priority}`, false, true);
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true, true);
    }
  });

  key(['D'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    try {
      const result = await depMenu(screen);
      list.focus();
      if (result.action === 'add') {
        setStatus(`Adding dep: ${id} → ${result.targetId} [${result.type}]…`);
        await applyMutation(id, () => bdDepAdd(id, result.targetId, result.type, state.cwd));
        setStatus(`Added: ${id} → ${result.targetId} [${result.type}]`, false, true);
      } else {
        setStatus(`Removing dep: ${id} → ${result.targetId}…`);
        await applyMutation(id, () => bdDepRemove(id, result.targetId, state.cwd));
        setStatus(`Removed dep: ${id} → ${result.targetId}`, false, true);
      }
      renderDetail(detail);
      screen.render();
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true, true);
    }
  });

  async function copyToClipboard(text, { okMsg, busyMsg } = {}) {
    setStatus(busyMsg || `Copying…`);
    const write = (cmd, args) => new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err) => { if (!settled) { settled = true; err ? reject(err) : resolve(); } };
      const p = execFile(cmd, args, (err) => finish(err || null));
      p.on('error', finish);
      if (p.stdin) {
        p.stdin.once('finish', () => setTimeout(() => finish(null), 100));
        p.stdin.end(text);
      }
    });
    const candidates = process.platform === 'win32'
      ? [['clip', []]]
      : [
          ['wl-copy', []],
          ['xclip', ['-selection', 'clipboard']],
          ['xsel', ['--clipboard', '--input']],
          ['pbcopy', []],
        ];
    for (const [cmd, args] of candidates) {
      try {
        await write(cmd, args);
        setStatus(okMsg || `Copied`, false, true);
        return;
      } catch {}
    }
    const hint = process.platform === 'win32'
      ? 'clip.exe missing'
      : 'install wl-clipboard, xclip, or xsel';
    setStatus(`clipboard unavailable — ${hint}`, true, true);
  }

  key(['y'], () => {
    const id = state.selectedId;
    if (!id) return;
    copyToClipboard(id, { busyMsg: `Copying ${id}…`, okMsg: `Copied ${id}` });
  });

  key(['w'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    const bead = state.beadsById.get(id);
    if (bead?.issue_type === 'epic') {
      setStatus(`${id} is an epic — workflow skills apply to tasks only`, true, true);
      return;
    }
    try {
      const line = await skillPicker(screen, id);
      list.focus();
      await copyToClipboard(line, {
        busyMsg: `Copying ${line}…`,
        okMsg: `Copied: ${line}`,
      });
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true, true);
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────────────

  setFocusBorder('list');
  list.focus();
  setStatus('Loading…');
  try {
    await loadList();
    state.selectedId = state.listOrder[0] || null;
    if (state.selectedId) await loadDetail(state.selectedId);
  } catch (err) {
    setStatus(err.message, true);
  }
  render();
  setStatus('Ready | ? help');
}
