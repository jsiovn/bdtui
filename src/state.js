import { bdList, bdShow, bdDeps, bdDepListDown } from './bd.js';

function byUpdatedDesc(a, b) {
  const ta = a?.updated_at || '', tb = b?.updated_at || '';
  if (ta !== tb) return tb.localeCompare(ta);
  return (b?.id || '').localeCompare(a?.id || '');
}

export const state = {
  beadsById: new Map(),
  fullTreeItems: [],   // unfiltered ordered tree items (before typeFilter)
  listOrder: [],
  treeMeta: new Map(), // id -> { depth: 0|1, isLast: bool }
  selectedId: null,
  filter: 'ready',
  typeFilter: 'all',   // 'all' | 'epic' | 'task'
  epicFilter: null,    // null or epic bead id — when set, list is scoped to that epic + its children
  blockedIds: new Set(), // ids that appear in `bd blocked` — derived state, not raw status
  pageSize: 100,        // lazy "load more" batch size for the flat all view
  visibleCount: 0,     // how many of listOrder are currently rendered (paged mode)
  cwd: process.cwd(),
};

// The "all" and "closed" tabs (no epic filter) can hold huge numbers of beads,
// so they reveal rows lazily in pageSize batches; every other view renders its
// rows all at once. All tabs build the same epic→children tree (see loadList).
export function isPaged() {
  return (state.filter === 'all' || state.filter === 'closed') && !state.epicFilter;
}

// Paged mode only renders the first visibleCount rows. After a reload that keeps
// a deep selection, grow the window (to its batch boundary) so the selected bead
// stays rendered — otherwise the cursor and state.selectedId desync and mutation
// keys would act on an off-screen bead. Call AFTER selectedId is finalized.
export function ensureSelectedVisible() {
  if (!isPaged() || !state.selectedId) return;
  const idx = state.listOrder.indexOf(state.selectedId);
  if (idx < state.visibleCount) return;
  state.visibleCount = Math.min(
    state.listOrder.length,
    Math.ceil((idx + 1) / state.pageSize) * state.pageSize,
  );
}

function scopeToEpic(items, epicId) {
  const out = [];
  let inside = false;
  for (const it of items) {
    if (it.depth === 0) {
      inside = it.id === epicId;
      if (inside) out.push(it);
    } else if (inside) {
      out.push(it);
    }
  }
  // Fix isLast on the last child after scoping (cheap, optional polish).
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].depth > 0) { out[i] = { ...out[i], isLast: true }; break; }
  }
  return out;
}

export function applyTypeFilter() {
  let items = state.fullTreeItems;
  if (state.epicFilter) {
    items = scopeToEpic(items, state.epicFilter);
  }
  if (state.typeFilter !== 'all') {
    items = items
      .filter((t) => state.beadsById.get(t.id)?.issue_type === state.typeFilter)
      .sort((x, y) => byUpdatedDesc(state.beadsById.get(x.id), state.beadsById.get(y.id)))
      .map((t) => ({ id: t.id, depth: 0, isLast: false }));
  }
  state.listOrder = items.map((t) => t.id);
  state.treeMeta = new Map(items.map((t) => [t.id, { depth: t.depth, isLast: t.isLast }]));
  state.visibleCount = isPaged()
    ? Math.min(state.pageSize, state.listOrder.length)
    : state.listOrder.length;
}

function buildTreeOrder(beads, parentOf) {
  const byId = new Map(beads.map((b) => [b.id, b]));
  // A bead is a root when it has no parent present in this bead set (epics and
  // standalone beads). The tree is intentionally two levels deep — epics on top,
  // their direct children indented under them.
  const isRoot = (id) => {
    const pid = parentOf.get(id);
    return !pid || !byId.has(pid);
  };

  const childrenOf = new Map();
  const roots = [];
  for (const b of beads) {
    const pid = parentOf.get(b.id);
    // Nest a bead only when its parent is itself a root. Anything else — no
    // parent, a parent filtered out of this view, or a parent that is itself
    // nested (deeper than two levels) — renders at the top level so no bead is
    // ever silently dropped from the list.
    if (pid && byId.has(pid) && isRoot(pid)) {
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid).push(b);
    } else {
      roots.push(b);
    }
  }

  for (const children of childrenOf.values()) {
    children.sort(byUpdatedDesc);
  }
  roots.sort(byUpdatedDesc);

  const ordered = [];
  for (const root of roots) {
    ordered.push({ id: root.id, depth: 0, isLast: false });
    const children = childrenOf.get(root.id) || [];
    children.forEach((child, i) => {
      ordered.push({ id: child.id, depth: 1, isLast: i === children.length - 1 });
    });
  }

  return ordered;
}

export async function loadList() {
  const paged = isPaged();
  const [beads, blocked] = await Promise.all([
    // Paged tabs (all / closed) lift bd's 50-row cap; rows are still revealed in
    // pageSize batches by the renderer.
    bdList(state.filter, state.cwd, { unlimited: paged }),
    bdList('blocked', state.cwd).catch(() => []),
  ]);
  state.blockedIds = new Set((blocked || []).map((b) => b.id));
  const byId = new Map(beads.map((b) => [b.id, b]));

  // Parent-child relationships come straight from the `parent` field bd embeds in
  // every list row (the target of the bead's parent-child dependency). This is
  // the same data `bd dep list` returns, so the tree builds from the single
  // `bd list` call above — no per-bead subprocess fan-out, even on huge repos.
  const parentOf = new Map();
  for (const b of beads) {
    if (b.parent && b.parent !== b.id) parentOf.set(b.id, b.parent);
  }

  // The Blocked tab merges in `bd blocked` (derived-blocked) rows, and that
  // command — unlike `bd list` — omits the `parent` field entirely. Recover the
  // parent for those rows with a dep-list lookup. Scoped to the blocked filter
  // (the only parent-less source) and to non-epic rows without an embedded
  // parent, so it stays a handful of calls on an already-small view.
  if (state.filter === 'blocked') {
    const needsLookup = beads.filter((b) => !('parent' in b) && b.issue_type !== 'epic');
    const depLists = await Promise.all(
      needsLookup.map((b) => bdDepListDown(b.id, state.cwd))
    );
    needsLookup.forEach((b, i) => {
      const pc = depLists[i].find((d) => d.dependency_type === 'parent-child');
      if (pc?.id && pc.id !== b.id) parentOf.set(b.id, pc.id);
    });
  }

  // Bring in parent epics that aren't already in the filtered list so the tree
  // can root under them. Only add the epic itself, NOT its other children —
  // that's what caused closed beads to leak into ready/open filters. Skipped for
  // "all", which already contains every bead. The fetch is bounded by the number
  // of distinct missing parents (≈ epic count), not the bead count.
  if (state.filter !== 'all') {
    const missingParents = [...new Set(parentOf.values())].filter((id) => !byId.has(id));
    const fetched = await Promise.all(
      missingParents.map((id) => bdShow(id, state.cwd).catch(() => null))
    );
    for (const p of fetched) {
      if (p && p.id && !byId.has(p.id)) {
        beads.push(p);
        byId.set(p.id, p);
      }
    }
  }

  for (const b of beads) {
    state.beadsById.set(b.id, { ...state.beadsById.get(b.id), ...b });
  }

  state.fullTreeItems = buildTreeOrder(beads, parentOf);
  applyTypeFilter();
  return beads;
}

export async function loadDetail(id) {
  const [bead, deps] = await Promise.all([
    bdShow(id, state.cwd),
    bdDeps(id, state.cwd),
  ]);
  const merged = { ...bead, depsDown: deps.down, depsUp: deps.up };
  state.beadsById.set(id, merged);
  return merged;
}

export async function applyMutation(id, mutatorFn) {
  await mutatorFn();
  return loadDetail(id);
}
