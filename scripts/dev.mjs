#!/usr/bin/env node
// One-command local stack: backend + title-normalizer worker + web player (+ fake panel with --fake).
// Usage: npm run dev:all [-- --fake] [-- --no-web]. Ctrl+C stops everything. See DECISIONS.md#d-034.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === 'win32';
const venvPython = path.join(root, 'services/title-normalizer/.venv', isWindows ? 'Scripts/python.exe' : 'bin/python');
const COLORS = { panel: 35, backend: 36, worker: 33, web: 32 };

function fail(message) {
  console.error(`\n[dev] ${message}\n`);
  process.exit(1);
}

function has(command) {
  return spawnSync(command, ['--version'], { stdio: 'ignore', shell: isWindows }).status === 0;
}

// Preflight: clear messages instead of a wall of stack traces.
if (!existsSync(path.join(root, 'node_modules'))) fail('Run `npm install` first.');
if (!has('dotnet')) fail('The .NET 10 SDK is missing (`dotnet` not on PATH).');
if (!existsSync(venvPython)) {
  fail(
    'Missing the worker venv. Create it once:\n  cd services/title-normalizer && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt',
  );
}

const children = [];
let stopping = false;

function prefix(name, stream, target) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) target.write(`\x1b[${COLORS[name]}m${name.padEnd(7)}\x1b[0m| ${line}\n`);
  });
}

function start(name, command, commandArgs, cwd) {
  // Own process group (POSIX) so stopping also ends grandchildren (`dotnet run` → app, npm → vite).
  const child = spawn(command, commandArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: !isWindows, shell: isWindows });
  prefix(name, child.stdout, process.stdout);
  prefix(name, child.stderr, process.stderr);
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`\n[dev] ${name} exited (${signal ?? code}). Stopping the rest.`);
    stop(1);
  });
  children.push(child);
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try {
      if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
  setTimeout(() => process.exit(exitCode), 500);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

if (args.has('--fake')) {
  const panel = path.join(root, 'tools/fake-xtream-server');
  if (!existsSync(path.join(panel, 'media')))
    console.warn('[dev] No fake panel media yet: run `python tools/fake-xtream-server/generate_media.py` for playable videos.');
  start('panel', venvPython, ['server.py'], panel);
}
start('backend', 'dotnet', ['run', '--project', 'src/Backend.Api'], path.join(root, 'backend'));
start('worker', venvPython, ['-m', 'title_normalizer'], path.join(root, 'services/title-normalizer'));
if (!args.has('--no-web')) start('web', 'npm', ['run', 'dev', '--workspace=@iptv/web-player'], root);

const urls = [
  args.has('--no-web') ? null : 'Web http://localhost:5173',
  'API http://localhost:5080',
  args.has('--fake') ? 'fake panel http://localhost:8090 (demo / demo)' : null,
];
console.log(`[dev] ${urls.filter(Boolean).join(' · ')} · Ctrl+C stops all.`);
