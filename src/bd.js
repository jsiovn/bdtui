import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

async function runBd(args, cwd) {
  try {
    const { stdout } = await execFileP('bd', args, { cwd });
    return JSON.parse(stdout);
  } catch (err) {
    throw new Error(err.stderr?.trim() || err.message);
  }
}

export const bdList = (filter, cwd) => {
  if (filter === 'ready') return runBd(['ready', '--json'], cwd);
  const args = ['list', '--json'];
  if (filter && filter !== 'all') args.push('--status', filter);
  return runBd(args, cwd);
};

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
  return runBd(args, cwd);
};

export const bdDepRemove = (child, parent, cwd) =>
  runBd(['dep', 'remove', child, parent], cwd);
