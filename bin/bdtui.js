#!/usr/bin/env node
import path from 'path';
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

const { run } = await import('../src/app.js');
await run(cwd);
