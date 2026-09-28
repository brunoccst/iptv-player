// Before `electron .` or a build: writes build-config.json (read by main.mjs) from the repo root .env and the CI
// environment, and copies the app icon. The web player must be built first (apps/web-player/dist). See D-071.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const env = {};
for (const file of ['../../../.env', '../../../.env.local']) {
  if (!existsSync(here(file))) continue;
  for (const line of readFileSync(here(file), 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
}
const value = (key, fallback = '') => (process.env[key] ?? env[key] ?? fallback).trim();

const config = {
  appName: value('APP_NAME', 'IPTV Player'),
  appSlug: value('APP_SLUG', 'iptv-player'),
  // Many providers only answer known players (same default as the TV app).
  userAgent: value('APP_PROVIDER_USER_AGENT', 'VLC/3.0.21 LibVLC/3.0.21'),
  // "owner/repo" whose `desktop` release has updates; empty in local builds: no update checks.
  updateRepo: value('APP_UPDATE_REPO'),
  buildCommit: value('APP_BUILD_COMMIT'),
};
writeFileSync(here('../build-config.json'), JSON.stringify(config, null, 2) + '\n');

mkdirSync(here('../build'), { recursive: true });
copyFileSync(here('../../web-player/public/icon-512.png'), here('../build/icon.png'));
if (!existsSync(here('../../web-player/dist/index.html'))) {
  console.warn('apps/web-player/dist is missing: run `npm run build --workspace=@iptv/web-player` first.');
}
console.log(`build-config.json: ${JSON.stringify(config)}`);
