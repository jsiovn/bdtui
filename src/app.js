import blessed from 'blessed';
import { execFile } from 'child_process';
import { state, loadList, loadDetail, applyMutation, applyFilters, isPaged, ensureSelectedVisible } from './state.js';
import { createList, renderList } from './views/list.js';
import { createDetail, renderDetail } from './views/detail.js';
import { statusPicker, priorityPicker, textPrompt, parentPicker, skillPicker, epicPicker } from './views/modals.js';
import { showHelp } from './keys.js';
import { bdUpdate, bdClose, bdClaim, bdReopen, bdDepAdd, bdDepRemove, bdDepListDown, bdEpics } from './bd.js';

const FILTERS = ['blocked', 'ready', 'in_progress', 'closed', 'all'];
const TYPE_FILTERS = ['all', 'epic', 'task', 'chore', 'bug'];

// Neutralize blessed tag markup in free text before it lands in a tags:true
// box (mirrors esc() in views/detail.js). The title search is user-typed, so a
// query like "{bold}" would otherwise corrupt the status line.
// Single pass: a two-step .replace(/\{/).replace(/\}/) would re-process the "}"
// it just inserted into "{open}", corrupting any text that contains a literal
// "}" (e.g. a bd JSON error blob) into a stray "{open}" token.
const escTags = (s) => String(s ?? '').replace(/[{}]/g, (c) => (c === '{' ? '{open}' : '{close}'));

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
  // Describe every active narrowing filter (title search, epic scope, type) in
  // one line with the result count and reset hint. Returns null when none are
  // active so the caller can fall back to a plain "Ready".
  function filterSummary() {
    const parts = [];
    // Plain text only — setStatus() escapes the whole summary, so pre-escaping
    // textFilter here would double-escape any braces in the search query.
    if (state.textFilter) parts.push(`"${state.textFilter}"`);
    if (state.epicFilter) parts.push(`epic: ${state.epicFilter}`);
    if (state.typeFilter !== 'all') parts.push(`type: ${state.typeFilter}`);
    if (parts.length === 0) return null;
    return `${parts.join('  ·  ')} — ${state.listOrder.length} results | Shift+r to reset`;
  }
  function defaultStatus() {
    return filterSummary() || 'Ready';
  }
  function setStatus(msg, isError = false, transient = false) {
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    // The status bar is a single tags:true row. Neutralize blessed tag markup
    // and collapse newlines so dynamic text — bd error messages especially,
    // which can be multi-line and contain "{" — renders as plain text instead
    // of corrupting the markup or overflowing the one-line height.
    const safe = escTags(String(msg ?? '').replace(/\s*\n\s*/g, ' ').trim());
    const icon = isError ? '{red-fg}✗{/}' : '{green-fg}●{/}';
    const text = isError ? `{red-fg}${safe}{/}` : safe;
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
    const textInfo = state.textFilter
      ? `  {gray-fg}│{/}  {green-fg}search:{/} "${escTags(state.textFilter)}"`
      : '';
    const info  = count > 0 ? `{gray-fg}  │  ${count} beads{/}` : '';
    tabBar.setContent(tabs.join('{gray-fg}│{/}') + typeInfo + epicInfo + textInfo + info);
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

  // Lazy "load more": the paged tabs (all / closed) load every bead but render
  // them pageSize at a time; reveal the next batch once selection reaches the
  // last visible row (infinite-scroll style).
  function maybeLoadMore() {
    if (!isPaged()) return;
    if (state.visibleCount >= state.listOrder.length) return;
    if (list.selected < state.visibleCount - 1) return;
    state.visibleCount = Math.min(state.visibleCount + state.pageSize, state.listOrder.length);
    renderList(list);
    setStatus(`Showing ${state.visibleCount} of ${state.listOrder.length}`, false, true);
    screen.render();
  }

  // When list selection changes, update selectedId and debounce detail fetch
  function onNav() {
    setImmediate(() => {
      maybeLoadMore();
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
      ensureSelectedVisible();
      if (state.selectedId) await loadDetail(state.selectedId);
      render();
      setStatus(defaultStatus());
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
      setStatus(defaultStatus());
    } catch (err) {
      setStatus(err.message, true, true);
    }
  }

  async function cycleTypeFilter() {
    const idx = TYPE_FILTERS.indexOf(state.typeFilter);
    state.typeFilter = TYPE_FILTERS[(idx + 1) % TYPE_FILTERS.length];
    applyFilters();
    if (state.selectedId && !state.listOrder.includes(state.selectedId)) {
      state.selectedId = state.listOrder[0] || null;
    } else if (!state.selectedId) {
      state.selectedId = state.listOrder[0] || null;
    }
    ensureSelectedVisible();
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
    setStatus(defaultStatus());
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

  // r reloads data while preserving every active filter; Shift+r clears all
  // narrowing filters (title search, epic scope, type) and reloads fresh.
  // blessed reports a shifted letter as `S-<lower>` (never bare uppercase), so
  // the binding must be 'S-r' — 'R' would be dead. Same for S-c / S-g below.
  key(['r'], async () => {
    await refresh();
  });
  key(['S-r'], async () => {
    const had = !!(state.textFilter || state.epicFilter || state.typeFilter !== 'all');
    state.textFilter = null;
    state.epicFilter = null;
    state.typeFilter = 'all';
    await refresh();
    if (had) setStatus('Filters reset', false, true);
  });
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
      applyFilters();
    }
    state.selectedId = state.listOrder[0] || null;
    if (state.selectedId) {
      try { await loadDetail(state.selectedId); } catch (err) {
        setStatus(err.message, true, true);
        return;
      }
    }
    render();
    setStatus(defaultStatus());
  });

  // '?' toggles the help modal. Registered directly (NOT through key(), which
  // swallows every global while a modal is open) so the same key that opens the
  // help can also close it. Driving open AND close from this one handler — kept
  // out of showHelp's own close keys — avoids re-entrancy: a separate '?' close
  // binding would fire on the very keypress that registered it and slam the
  // modal shut again. closeHelp is non-null exactly while the help is open.
  let closeHelp = null;
  screen.key(['?'], () => {
    if (closeHelp) { closeHelp(); return; }
    if (modalOpen) return; // another modal (a picker) owns the screen
    modalOpen = true;
    closeHelp = showHelp(screen, () => {
      closeHelp = null;
      modalOpen = false;
      list.focus();
      screen.render();
    });
  });

  key(['enter', 'l'], () => {
    if (screen.focused === list) { setFocusBorder('detail'); detail.focus(); screen.render(); }
  });

  key(['escape'], () => {
    if (screen.focused !== list) { setFocusBorder('list'); list.focus(); screen.render(); }
  });

  key(['h'], async () => {
    if (screen.focused === detail) { setFocusBorder('list'); list.focus(); screen.render(); return; }
    if (screen.focused !== list) return;
    if (!state.selectedId) return;
    const id = state.selectedId;
    const bead = state.beadsById.get(id);
    if (bead?.issue_type === 'epic') {
      setStatus(`${id} is an epic — epics are top-level`, true, true);
      return;
    }
    setStatus('Loading parents…');
    let epics, downDeps;
    try {
      [epics, downDeps] = await Promise.all([bdEpics(state.cwd), bdDepListDown(id, state.cwd)]);
    } catch (err) {
      setStatus(err.message, true, true);
      return;
    }
    // A bead should have at most one parent, but a prior bug could leave it with
    // several parent-child deps — collect them all so we can clear every one.
    const currentParentIds = downDeps
      .filter((d) => d.dependency_type === 'parent-child')
      .map((d) => d.id)
      .filter(Boolean);
    let newParent;
    try {
      newParent = await parentPicker(screen, epics, { selfId: id, currentParentIds });
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true, true);
      return;
    }
    list.focus();
    setStatus(`Reparenting ${id}…`);
    try {
      await applyMutation(id, async () => {
        // Detach every existing parent first so the bead is never left with two
        // parents, then attach the chosen one (skip if it's already a parent).
        for (const pid of currentParentIds) {
          if (pid !== newParent) await bdDepRemove(id, pid, state.cwd);
        }
        if (newParent && !currentParentIds.includes(newParent)) {
          await bdDepAdd(id, newParent, 'parent-child', state.cwd);
        }
      });
      await loadList();
      ensureSelectedVisible();
      render();
      setStatus(
        newParent ? `Reparented ${id} → ${newParent}` : `${id} is now standalone`,
        false,
        true,
      );
    } catch (err) {
      setStatus(err.message, true, true);
    }
  });

  key(['g'], () => {
    if (screen.focused !== list) return;
    list.select(0);
    onNav();
    screen.render();
  });

  key(['S-g'], () => {
    if (screen.focused !== list) return;
    // Jump to the true bottom — in paged mode reveal every remaining batch first.
    if (isPaged() && state.visibleCount < state.listOrder.length) {
      state.visibleCount = state.listOrder.length;
      renderList(list);
    }
    list.select(state.listOrder.length - 1);
    onNav();
    screen.render();
  });

  key(['/'], async () => {
    if (screen.focused !== list) return;
    try {
      // Pre-fill with the active search so it can be edited; an empty submit
      // clears the title filter (other filters stay put).
      const query = await textPrompt(screen, 'Filter by title', state.textFilter || '');
      list.focus();
      state.textFilter = query || null;
      applyFilters();
      if (!state.selectedId || !state.listOrder.includes(state.selectedId)) {
        state.selectedId = state.listOrder[0] || null;
      }
      ensureSelectedVisible();
      renderList(list);
      renderDetail(detail);
      screen.render();
      setStatus(defaultStatus());
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
      if (state.selectedId && !state.listOrder.includes(state.selectedId)) {
        state.selectedId = state.listOrder[0] || null;
      }
      ensureSelectedVisible();
      render();
      setStatus(`Closed ${id}`, false, true);
    } catch (err) {
      list.focus();
      if (err.message !== 'cancelled') setStatus(err.message, true, true);
    }
  });

  key(['S-c'], async () => {
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
      if (state.selectedId && !state.listOrder.includes(state.selectedId)) {
        state.selectedId = state.listOrder[0] || null;
      }
      ensureSelectedVisible();
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
    try {
      const line = await skillPicker(screen, id, bead?.issue_type);
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

  // Release blessed's mouse capture so the terminal can do native click-drag
  // text selection (then copy with the terminal's own copy). blessed grabs the
  // mouse process-wide the moment any element sets mouse:true, which blocks
  // native selection; toggling it off hands the mouse back to the terminal.
  // Re-enable via program.enableMouse() directly — screen.enableMouse() is a
  // no-op here because blessed's _listenedMouse latch is already set.
  let mouseCaptured = true;
  key(['m'], () => {
    mouseCaptured = !mouseCaptured;
    if (mouseCaptured) {
      screen.program.enableMouse();
      setStatus('Mouse restored — wheel scroll & click active', false, true);
    } else {
      screen.program.disableMouse();
      setStatus('Mouse released — drag to select text, copy with your terminal · press m to restore');
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
  // setStatus already appends "? help · q quit"; defaultStatus() yields "Ready"
  // (or the active-filter summary) without duplicating the help hint.
  setStatus(defaultStatus());
}
