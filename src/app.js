import blessed from 'blessed';
import { execFile } from 'child_process';
import { state, loadList, loadDetail, applyMutation } from './state.js';
import { createList, renderList } from './views/list.js';
import { createDetail, renderDetail } from './views/detail.js';
import { statusPicker, priorityPicker, textPrompt, depMenu } from './views/modals.js';
import { showHelp } from './keys.js';
import { bdUpdate, bdClose, bdClaim, bdReopen, bdDepAdd, bdDepRemove } from './bd.js';

const FILTERS = ['ready', 'open', 'in_progress', 'all'];

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

  function setStatus(msg, isError = false) {
    const prefix = isError ? '{red-fg}' : '';
    const suffix = isError ? '{/}' : '';
    statusBar.setContent(` ${prefix}${msg}${suffix} | {gray-fg}? help{/}`);
    screen.render();
  }

  function renderTabBar() {
    const tabs = FILTERS.map((f) => {
      return f === state.filter
        ? `{blue-bg}{white-fg} ${f} {/}`
        : ` {gray-fg}${f}{/} `;
    });
    tabBar.setContent(tabs.join(' '));
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
          setStatus(err.message, true);
        }
      }, 80);
    });
  }

  // Capture all keypresses on the list to detect navigation
  list.on('keypress', onNav);

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
      setStatus(err.message, true);
    }
  }

  async function cycleFilter() {
    const idx = FILTERS.indexOf(state.filter);
    state.filter = FILTERS[(idx + 1) % FILTERS.length];
    setStatus(`Filter: ${state.filter} — loading…`);
    try {
      await loadList();
      state.selectedId = state.listOrder[0] || null;
      if (state.selectedId) await loadDetail(state.selectedId);
      render();
      setStatus(`Filter: ${state.filter}`);
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  // ── Global keys ────────────────────────────────────────────────────────────

  screen.key(['q', 'C-c'], () => { screen.destroy(); process.exit(0); });

  screen.key(['r'], refresh);
  screen.key(['f'], cycleFilter);

  screen.key(['?'], () => showHelp(screen, () => { list.focus(); screen.render(); }));

  screen.key(['enter', 'l'], () => {
    if (screen.focused === list) { detail.focus(); screen.render(); }
  });

  screen.key(['h', 'escape'], () => {
    if (screen.focused !== list) { list.focus(); screen.render(); }
  });

  screen.key(['g'], () => {
    if (screen.focused !== list) return;
    list.select(0);
    onNav();
    screen.render();
  });

  screen.key(['G'], () => {
    if (screen.focused !== list) return;
    list.select(state.listOrder.length - 1);
    onNav();
    screen.render();
  });

  screen.key(['/'], async () => {
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

  screen.key(['s'], async () => {
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
      setStatus(`${id}: ${oldStatus} → ${newStatus}`);
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true);
    }
  });

  screen.key(['c'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    try {
      const reason = await textPrompt(screen, 'Close reason');
      list.focus();
      setStatus(`Closing ${id}…`);
      await applyMutation(id, () => bdClose(id, reason, state.cwd));
      await loadList();
      render();
      setStatus(`Closed ${id}`);
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true);
    }
  });

  screen.key(['C'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    setStatus(`Claiming ${id}…`);
    try {
      await applyMutation(id, () => bdClaim(id, state.cwd));
      renderList(list);
      renderDetail(detail);
      screen.render();
      setStatus(`Claimed ${id}`);
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  screen.key(['o'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    setStatus(`Reopening ${id}…`);
    try {
      await applyMutation(id, () => bdReopen(id, state.cwd));
      await loadList();
      render();
      setStatus(`Reopened ${id}`);
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  screen.key(['p'], async () => {
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
      setStatus(`${id}: priority → ${priority}`);
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true);
    }
  });

  screen.key(['D'], async () => {
    if (screen.focused !== list || !state.selectedId) return;
    const id = state.selectedId;
    try {
      const result = await depMenu(screen);
      list.focus();
      if (result.action === 'add') {
        setStatus(`Adding dep: ${id} → ${result.targetId} [${result.type}]…`);
        await applyMutation(id, () => bdDepAdd(id, result.targetId, result.type, state.cwd));
        setStatus(`Added: ${id} → ${result.targetId} [${result.type}]`);
      } else {
        setStatus(`Removing dep: ${id} → ${result.targetId}…`);
        await applyMutation(id, () => bdDepRemove(id, result.targetId, state.cwd));
        setStatus(`Removed dep: ${id} → ${result.targetId}`);
      }
      renderDetail(detail);
      screen.render();
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true);
    }
  });

  screen.key(['y'], () => {
    const id = state.selectedId;
    if (!id) return;
    const write = (cmd, args) => new Promise((res) => {
      const p = execFile(cmd, args, res);
      p.stdin?.end(id);
    });
    write('xclip', ['-selection', 'clipboard'])
      .catch(() => write('pbcopy', []))
      .then((err) => {
        setStatus(err ? `${id} (clipboard unavailable)` : `Copied ${id}`);
      });
  });

  // ── Boot ───────────────────────────────────────────────────────────────────

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
