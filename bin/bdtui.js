#!/usr/bin/env node
import path from 'path';

const arg = process.argv[2];
const cwd = arg ? path.resolve(arg) : process.cwd();
process.chdir(cwd);

const { run } = await import('../src/app.js');
await run(cwd);
