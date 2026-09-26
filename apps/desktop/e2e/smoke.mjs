// Starts the desktop app against the fake panel (tools/fake-xtream-server on :8090) and checks the direct mode end to
// end: sign-in without a backend, the library built in the app, a movie that plays, and the sign-in kept after a
// restart (system-encrypted storage). Run: node e2e/smoke.mjs (needs a display; CI uses xvfb-run on Linux), with
// E2E_EXECUTABLE=release/linux-unpacked/iptv-player for a packaged build. D-071.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect } from '@playwright/test';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const panelUrl = process.env.E2E_PANEL_URL ?? 'http://localhost:8090';
const userData = mkdtempSync(path.join(tmpdir(), 'iptv-desktop-'));
const launch = () =>
  electron.launch({
    // E2E_EXECUTABLE: a packaged app (release/linux-unpacked/…); otherwise this folder's Electron (Playwright would
    // look next to itself, in the repository's node_modules) with the app folder.
    executablePath: process.env.E2E_EXECUTABLE || createRequire(import.meta.url)('electron'),
    args: [...(process.env.E2E_EXECUTABLE ? [] : [appDir]), ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    env: { ...process.env, IPTV_DESKTOP_USER_DATA: userData },
  });

let app = await launch();
try {
  let page = await app.firstWindow();
  page.on('console', (message) => message.type() === 'error' && console.log(`[page] ${message.text()}`));
  // The window opens empty and then loads the app from 127.0.0.1.
  await page.waitForURL(/^http:\/\/127\.0\.0\.1:\d+\//);
  await page.waitForLoadState();
  assert.equal(await page.evaluate(() => typeof window.iptvDesktop?.secure?.getItem), 'function');
  await expect(page.getByText('Your password stays on this computer')).toBeVisible({ timeout: 30_000 });

  await page.getByLabel('Server URL').fill(panelUrl);
  await page.getByLabel('Username').fill('demo');
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 });
  console.log('signed in directly to the panel');

  await page.getByRole('button', { name: 'Movies', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Big Test Movie' }).first()).toBeVisible({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Big Test Movie' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Play' }).click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector('.player__video')?.currentTime ?? 0), { timeout: 60_000 })
    .toBeGreaterThan(1.5);
  console.log('movie plays from the panel');

  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 });
  console.log('still signed in after a restart');
} finally {
  await app.close();
}
