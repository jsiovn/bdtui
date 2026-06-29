import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

// Default execFile maxBuffer is 1MB; bd JSON output (esp. `list --all` with many
// closed beads) can exceed that and throw "stdout maxBuffer length exceeded".
const MAX_BUFFER = 64 * 1024 * 1024; // 64MB

// bd reports failures with a non-zero exit and a structured JSON body
// ({"error": "…", "schema_version": 1}) — usually on stderr, occasionally on
// stdout. Surface the human-readable `error` field; fall back to the raw text,
// then execFile's own message. Without this the whole multi-line JSON blob —
// leading "{" and all — gets thrown verbatim and dumped into the one-line
// status bar, which is the "error with {" users see when a tab fails to load.
function bdErrorMessage(err) {
  const raw = (err.stderr?.trim() || err.stdout?.trim() || '');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {}
    return raw;
  }
  return err.message;
}

async function runBd(args, cwd) {
  try {
    const { stdout } = await execFileP('bd', args, { cwd, maxBuffer: MAX_BUFFER });
    return JSON.parse(stdout);
  } catch (err) {
    throw new Error(bdErrorMessage(err));
  }
}

// Run a bd command whose stdout we don't consume (e.g. `dep add`/`dep remove`,
// which print a human-readable "✓ Added dependency…" line, not JSON). We can't
// JSON.parse that — doing so was the source of the "Unexpected token '✓'" error.
// Failures still surface: a non-zero exit rejects execFile and we throw stderr.
async function runBdVoid(args, cwd) {
  try {
    await execFileP('bd', args, { cwd, maxBuffer: MAX_BUFFER });
  } catch (err) {
    throw new Error(bdErrorMessage(err));
  }
}

// `bd blocked` only returns *derived*-blocked beads (open beads whose blockers
// aren't all closed); it omits beads whose status was explicitly set to
// "blocked". The Blocked tab should show both, so merge the two sources, deduped.
async function bdBlocked(cwd) {
  const [derived, explicit] = await Promise.all([
    runBd(['blocked', '--json'], cwd).catch(() => []),
    runBd(['list', '--status', 'blocked', '--json', '--limit', '0'], cwd).catch(() => []),
  ]);
  const byId = new Map();
  for (const b of [...(derived || []), ...(explicit || [])]) {
    if (b?.id && !byId.has(b.id)) byId.set(b.id, b);
  }
  return [...byId.values()];
}

export const bdList = (filter, cwd, { unlimited = false } = {}) => {
  if (filter === 'ready') return runBd(['ready', '--json'], cwd);
  if (filter === 'blocked') return bdBlocked(cwd);
  const args = ['list', '--json'];
  if (filter === 'all') args.push('--all');
  else if (filter) args.push('--status', filter);
  // `--limit 0` lifts bd's default 50-row cap for the paginated flat views.
  if (unlimited) args.push('--limit', '0');
  return runBd(args, cwd);
};

// bdList('all') with the 50-row cap lifted — used for enumerating every epic.
export const bdListAll = (cwd) => bdList('all', cwd, { unlimited: true });

export const bdShow = async (id, cwd) => {
  const res = await runBd(['show', id, '--json'], cwd);
  return Array.isArray(res) ? res[0] : res;
};

export const bdDeps = async (id, cwd) => {
  const [down, up] = await Promise.all([
    runBd(['dep', 'list', id, '--json'], cwd).catch(() => []),
    runBd(['dep', 'list', id, '--direction=up', '--json'], cwd).catch(() => []),
  ]);
  return { down: Array.isArray(down) ? down : [], up: Array.isArray(up) ? up : [] };
};

export const bdDepListDown = async (id, cwd) => {
  const res = await runBd(['dep', 'list', id, '--json'], cwd).catch(() => []);
  return Array.isArray(res) ? res : [];
};

export const bdUpdate = (id, opts, cwd) => {
  const args = ['update', id];
  if (opts.status) args.push('--status', opts.status);
  if (opts.priority !== undefined) args.push('--priority', String(opts.priority));
  return runBd([...args, '--json'], cwd);
};

export const bdClose = (id, reason, cwd) => {
  const args = ['close', id];
  if (reason) args.push('--reason', reason);
  return runBd([...args, '--json'], cwd);
};

export const bdClaim = (id, cwd) => runBd(['update', id, '--claim', '--json'], cwd);

export const bdReopen = (id, cwd) => runBd(['reopen', id, '--json'], cwd);

export const bdDepAdd = (child, parent, type, cwd) => {
  const args = ['dep', 'add', child, parent];
  if (type && type !== 'blocks') args.push('--type', type);
  return runBdVoid(args, cwd);
};

export const bdDepRemove = (child, parent, cwd) =>
  runBdVoid(['dep', 'remove', child, parent], cwd);

// Returns all children of an epic (all statuses — bd children includes closed by default)
export const bdChildren = (id, cwd) => runBd(['children', id, '--json'], cwd);

export const bdEpics = async (cwd) => {
  const all = await bdListAll(cwd);
  return Array.isArray(all) ? all.filter((b) => b.issue_type === 'epic') : [];
};
