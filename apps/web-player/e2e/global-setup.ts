import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { E2E, repoRoot } from './stack';

const children: ChildProcess[] = [];

function start(name: string, command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) {
  // Own process group so teardown also stops grandchildren (npx → vite).
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let output = '';
  child.stdout?.on('data', (chunk) => (output = (output + chunk).slice(-4000)));
  child.stderr?.on('data', (chunk) => (output = (output + chunk).slice(-4000)));
  child.on('exit', (code) => {
    if (code && code !== 143) console.error(`[e2e] ${name} exited with ${code}\n${output}`);
  });
  children.push(child);
  return child;
}

async function waitFor(url: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (
      await fetch(url).then(
        (r) => r.status < 500,
        () => false,
      )
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

/** Starts the fake panel and a production web build; the page talks to the panel directly (D-088). Returns teardown. */
export default async function globalSetup() {
  const panelDir = path.join(repoRoot, 'tools/fake-xtream-server');
  if (!existsSync(path.join(panelDir, 'media/movie-hls/index.m3u8'))) run('python3', ['generate_media.py'], panelDir);

  for (const url of [E2E.panelUrl, E2E.webUrl]) {
    if (
      await fetch(url).then(
        () => true,
        () => false,
      )
    )
      throw new Error(`${url} is already in use. Stop the process using it first.`);
  }

  start('panel', 'python3', ['server.py', '--port', new URL(E2E.panelUrl).port], { cwd: panelDir });
  const webDir = path.join(repoRoot, 'apps/web-player');
  run('npx', ['vite', 'build', '--outDir', 'dist-e2e', '--emptyOutDir'], webDir);
  start('web', 'npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', new URL(E2E.webUrl).port, '--strictPort'], { cwd: webDir });

  await waitFor(`${E2E.panelUrl}/player_api.php`);
  await waitFor(E2E.webUrl);

  return async () => {
    for (const child of children) {
      try {
        process.kill(-child.pid!, 'SIGTERM');
      } catch {
        // Already exited.
      }
    }
  };
}
