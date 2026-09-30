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
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 30_000 });
  console.log('signed in directly to the panel');

  // Sync with phone (D-072): the code names this computer's pairing server; a request with a wrong key goes through
  // the app and is refused (403), and the code stays valid.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: /Library & devices/ }).click();
  await page.getByRole('menuitem', { name: 'Sync with phone' }).click();
  const qr = await page.getByTestId('pairing-qr').getAttribute('data-text');
  const [, host, port] = /^IPTVPAIR:1:([\d.]+):(\d+):/.exec(qr ?? '') ?? [];
  assert.ok(host && port, `pairing code: ${qr}`);
  const refused = await fetch(`http://${host}:${port}/pair`, { method: 'POST', body: 'not sealed with the key' });
  assert.equal(refused.status, 403);
  await expect(page.getByTestId('pairing-qr')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  console.log('pairing server answers through the app');

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

  // Profiles are in the library database with the library (D-121, D-126), not in files.
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(userData, 'library.db'), { readOnly: true });
  const keys = db
    .prepare('SELECT key FROM user_data')
    .all()
    .map((row) => String(row.key));
  db.close();
  assert.ok(
    keys.some((key) => key.startsWith('direct.profiles.')),
    `user data in the database: ${keys.join(', ')}`,
  );
  console.log('profiles are in the database');
} finally {
  await app.close();
}
