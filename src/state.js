import { bdList, bdShow, bdDeps } from './bd.js';

export const state = {
  beadsById: new Map(),
  listOrder: [],
  selectedId: null,
  filter: 'ready',
  cwd: process.cwd(),
};

export async function loadList() {
  const beads = await bdList(state.filter, state.cwd);
  state.listOrder = beads.map((b) => b.id);
  for (const b of beads) {
    state.beadsById.set(b.id, { ...state.beadsById.get(b.id), ...b });
  }
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
