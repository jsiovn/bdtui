import { bdList, bdShow, bdDeps, bdDepListDown } from './bd.js';

export const state = {
  beadsById: new Map(),
  fullTreeItems: [],   // unfiltered ordered tree items (before typeFilter)
  listOrder: [],
  treeMeta: new Map(), // id -> { depth: 0|1, isLast: bool }
  selectedId: null,
  filter: 'ready',
  typeFilter: 'all',   // 'all' | 'epic' | 'task'
  cwd: process.cwd(),
};

export function applyTypeFilter() {
  let items = state.fullTreeItems;
  if (state.typeFilter !== 'all') {
    items = items
      .filter((t) => state.beadsById.get(t.id)?.issue_type === state.typeFilter)
      .map((t) => ({ id: t.id, depth: 0, isLast: false }));
  }
  state.listOrder = items.map((t) => t.id);
  state.treeMeta = new Map(items.map((t) => [t.id, { depth: t.depth, isLast: t.isLast }]));
}

function buildTreeOrder(beads, parentOf) {
  const byId = new Map(beads.map((b) => [b.id, b]));
  const childrenOf = new Map();

  for (const b of beads) {
    const pid = parentOf.get(b.id);
    if (pid && byId.has(pid)) {
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid).push(b);
    }
  }

  for (const children of childrenOf.values()) {
    children.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || a.id.localeCompare(b.id));
  }

  const childIds = new Set([...childrenOf.values()].flat().map((b) => b.id));
  const roots = beads.filter((b) => !childIds.has(b.id));

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
  const beads = await bdList(state.filter, state.cwd);
  const byId = new Map(beads.map((b) => [b.id, b]));

  // Build parent-child map from real bd deps (dependency_type === 'parent-child').
  // Fetch only for non-epic beads — epics don't have epic parents in this model.
  const candidates = beads.filter((b) => b.issue_type !== 'epic');
  const depLists = await Promise.all(
    candidates.map((b) => bdDepListDown(b.id, state.cwd))
  );

  const parentOf = new Map();
  candidates.forEach((b, i) => {
    const pc = depLists[i].find((d) => d.dependency_type === 'parent-child');
    if (pc?.id) parentOf.set(b.id, pc.id);
  });

  // Bring in parent epics that aren't already in the filtered list so the tree
  // can root under them. Only add the epic itself, NOT its other children —
  // that's what caused closed beads to leak into ready/open filters.
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
