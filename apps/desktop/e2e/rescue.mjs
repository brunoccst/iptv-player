// A start that fails must still open the rescue window with an Update now button (D-251). The start is failed on purpose
// (IPTV_DESKTOP_FORCE_START_ERROR) and the update feed is a local copy of what a release holds (latest-linux.yml).
// Run: node e2e/rescue.mjs (needs a display; CI uses xvfb-run), with E2E_EXECUTABLE=release/linux-unpacked/<slug> for the packaged app.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const userData = mkdtempSync(path.join(tmpdir(), 'iptv-desktop-rescue-'));
const latest = [
  'version: 99.0.0',
  'files:',
  '  - url: app-99.0.0.AppImage',
  '    sha512: AAAA',
  '    size: 1',
  'path: app-99.0.0.AppImage',
  'sha512: AAAA',
  "releaseDate: '2026-11-26T00:00:00.000Z'",
  '',
].join('\n');
const feed = createServer((request, response) => {
  response.writeHead(request.url?.includes('latest') ? 200 : 404, { 'Content-Type': 'text/yaml' }).end(latest);
});
await new Promise((resolve) => feed.listen(0, '127.0.0.1', resolve));

const app = await electron.launch({
  executablePath: process.env.E2E_EXECUTABLE || createRequire(import.meta.url)('electron'),
  args: [...(process.env.E2E_EXECUTABLE ? [] : [appDir]), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
  env: {
    ...process.env,
    IPTV_DESKTOP_USER_DATA: userData,
    IPTV_DESKTOP_FORCE_START_ERROR: "Cannot find package 'ffmpeg-static' (test)",
    IPTV_DESKTOP_UPDATE_FEED: `http://127.0.0.1:${feed.address().port}`,
  },
});
try {
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'The app could not start' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Cannot find package 'ffmpeg-static' (test)")).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Version 99.0.0 is available', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Update now' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download from GitHub' })).toBeDisabled(); // a build without an update repository
  assert.equal(await page.getByRole('button', { name: 'Close' }).isEnabled(), true);
  console.log('rescue window found the update');
} finally {
  await app.close().catch(() => undefined);
  feed.close();
}
