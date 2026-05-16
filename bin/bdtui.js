#!/usr/bin/env node
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const arg = process.argv[2];

if (arg === '-v' || arg === '--version') {
  console.log(version);
  process.exit(0);
}

const cwd = arg ? path.resolve(arg) : process.cwd();
process.chdir(cwd);

ensureDoltRunning(cwd);

const { run } = await import('../src/app.js');
await run(cwd);

function ensureDoltRunning(cwd) {
  const test = spawnSync('bd', ['dolt', 'test'], { cwd, stdio: 'ignore' });
  if (test.status === 0) return;
  // `bd` missing or otherwise unusable — let the TUI surface the real error.
  if (test.error && test.error.code === 'ENOENT') return;

  process.stderr.write("Dolt server not running — starting via 'bd dolt start'…\n");
  const start = spawnSync('bd', ['dolt', 'start'], { cwd, stdio: 'inherit' });
  if (start.status !== 0) {
    process.stderr.write("Failed to start Dolt server. Run 'bd dolt start' manually.\n");
    process.exit(start.status ?? 1);
  }
}
