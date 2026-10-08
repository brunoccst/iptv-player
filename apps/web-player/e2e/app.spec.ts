import { expect, test } from '@playwright/test';
import { expectPlaying, login, seek, videoTime, waitForLibrary } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
  await waitForLibrary(page);
});

test('library is deduplicated into master titles with a version selector', async ({ page }) => {
  const grid = page.locator('.grid');
  await expect(grid.getByRole('button', { name: 'Big Test Movie' })).toHaveCount(1);
  await expect(grid.getByRole('button', { name: 'Sequel Test 2' })).toBeVisible();
  await expect(grid.getByRole('button', { name: 'Sequel Test 3' })).toBeVisible();

  await grid.getByRole('button', { name: 'Big Test Movie' }).click();
  const options = page.getByRole('dialog').getByLabel('Version / Stream Quality').locator('option');
  await expect(options).toHaveText(['4K · ENG (best)', '1080p', 'CAM']);
});

test('plays HLS through the relay with keyboard skip, hover frame preview and version switch', async ({ page }) => {
  await page.getByRole('button', { name: 'Big Test Movie' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Play' }).click();
  await expectPlaying(page);

  const before = await videoTime(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => videoTime(page)).toBeGreaterThan(before + 8);

  const rail = await page.locator('.timeline__rail').boundingBox();
  await page.mouse.move(rail!.x + rail!.width * 0.5, rail!.y + 2);
  await expect(page.getByTestId('timeline-preview')).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('.timeline__preview canvas')!;
          const pixels = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data;
          return pixels.reduce((sum, value, index) => (index % 4 === 3 ? sum : sum + value), 0);
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(10_000);

  await page.getByRole('button', { name: 'Audio, subtitles and version' }).click();
  await page.getByRole('dialog', { name: 'Audio, subtitles and version' }).getByRole('button', { name: '1080p' }).click();
  await expect(page.locator('.player__subtitle')).toHaveText(/^1080p/);
  await expectPlaying(page);
});

test('MKV-only titles explain they need the TV app', async ({ page }) => {
  await page.getByRole('button', { name: 'Matroska Only' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('alert')).toContainText('only available as MKV', { timeout: 60_000 });
});

test('episodes: skip ahead, continue watching + resume, next-episode countdown', async ({ page }) => {
  await page.getByRole('button', { name: 'Series', exact: true }).click();
  await page.locator('.grid').getByRole('button', { name: 'Test Series' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Version / Stream Quality').selectOption({ label: 'ENG' });
  // One episode list for both versions (D-066): the 1080p listing has only the pilot.
  await expect(dialog.getByLabel(/^Version of .*Pilot/)).toBeVisible();
  await expect(dialog.getByText('Only in ENG')).toBeVisible();
  await dialog
    .getByRole('button', { name: /^Play .*Pilot/ })
    .first()
    .click();

  // "Skip ahead" opens 30 s … 3 min; Escape (or the button again) closes the options without skipping.
  const skipAhead = page.getByRole('button', { name: 'Skip ahead: choose how far' });
  await expect(skipAhead).toBeVisible({ timeout: 20_000 });
  await skipAhead.click();
  await expect(page.getByRole('button', { name: 'Skip ahead 30 seconds' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Skip ahead 30 seconds' })).toBeHidden();
  await expect(page.getByTestId('player')).toBeVisible();
  await skipAhead.click();
  await page.getByRole('button', { name: 'Skip ahead 2 minutes' }).click();
  await expect.poll(() => videoTime(page)).toBeGreaterThanOrEqual(124);

  // → three times in a row skips 10 s, 30 s, then 1 min (D-150).
  const beforeSkips = await videoTime(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.skip-flash')).toHaveText('+1:00');
  await expect.poll(() => videoTime(page)).toBeGreaterThanOrEqual(beforeSkips + 100);

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Home' }).click();
  const resumeCard = page.getByRole('region', { name: 'Continue Watching' }).getByRole('button', { name: 'Test Series' });
  await expect(resumeCard).toBeVisible();

  await resumeCard.click();
  await expect.poll(() => videoTime(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(85);

  const duration = await page.evaluate(() => document.querySelector<HTMLVideoElement>('.player__video')!.duration);
  await seek(page, duration - 7);
  await expect(page.getByText(/Next episode in \d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Play Now' }).click();
  await expect(page.locator('.player__subtitle')).toContainText('S01:E02');
  await expectPlaying(page);

  // Previous / next episode around ±10 s, and "from the beginning" (D-077, as on TV).
  await page.getByRole('button', { name: 'Previous episode: S01:E01' }).click();
  await expect(page.locator('.player__subtitle')).toContainText('S01:E01');
  await expectPlaying(page);
  await expect(page.getByRole('button', { name: /^Previous episode/ })).toHaveCount(0);
  await seek(page, 60);
  await expect.poll(() => videoTime(page)).toBeGreaterThanOrEqual(59);
  await page.getByRole('button', { name: 'Play from the beginning' }).click();
  await expect.poll(() => videoTime(page)).toBeLessThan(15);
  await seek(page, 90);
  await expect.poll(() => videoTime(page)).toBeGreaterThanOrEqual(89);

  // Started from Continue Watching, Back shows the series' details rather than Home (issue #166).
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.getByLabel('Version / Stream Quality')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Right-click on a Continue Watching card: its options (holding OK on TV, D-078, D-079).
  await page.getByRole('button', { name: 'Home' }).click();
  const continueRow = page.getByRole('region', { name: 'Continue Watching' });
  await continueRow.getByRole('button', { name: 'Test Series' }).click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Options for Test Series' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await continueRow.getByRole('button', { name: 'Test Series' }).click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Remove from Continue Watching' }).click();
  await expect(continueRow).toBeHidden();
});

test('live TV guide shows what is on and plays a channel', async ({ page }) => {
  await page.getByRole('button', { name: 'Live TV' }).click();
  const guide = page.getByRole('region', { name: 'TV guide' });
  // Five channels, each with a programme on now; "Test Arena" has no XMLTV id and comes from short EPG.
  await expect(guide.locator('.guide__programme--now')).toHaveCount(5);
  await expect(guide.getByRole('button', { name: /^Warm-up,|^Arena Live,/ }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/guide.png' });

  const onNow = guide.locator('.guide__programme--now').first();
  const title = (await onNow.locator('.guide__title').textContent())!.replace('‹ ', '');
  await onNow.click();
  await expect(page.getByRole('region', { name: 'Programme details' })).toContainText('On now');
  await page.getByRole('button', { name: 'Watch live' }).click();
  await expect(page.locator('.player__live')).toBeVisible();
  await expect(page.locator('.player__subtitle')).toContainText(title);
  await expectPlaying(page, 1);

  // Guide over the playing channel (D-058 on TV, D-081 here): G or the Guide button; a click switches channel.
  const playing = (await page.locator('.player__title').textContent())!;
  await page.keyboard.press('g');
  const panel = page.getByRole('complementary', { name: 'Guide' });
  await expect(panel.getByRole('button', { name: /, playing$/ })).toContainText(playing);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Guide', exact: true }).click();
  const other = panel.getByRole('button').filter({ hasNotText: playing }).first();
  const otherName = (await other.locator('strong').textContent())!.trim();
  await other.click();
  await expect(panel).toBeHidden();
  await expect(page.locator('.player__title')).toHaveText(otherName.replace(/^\d+\s+/, ''));
  await expectPlaying(page, 1);
});

test('downloads are encrypted in-app and play offline, even after reload', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Another Film' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Download .* for offline/ })
    .click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Downloaded/ })).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Big Test Movie' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Download .* for offline/ })
    .click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Downloaded/ })).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('Escape');

  // Stored chunks are ciphertext, not media: no ftyp/moov box signature at the start of any chunk.
  const plaintextChunks = await page.evaluate(async () => {
    const cache = await caches.open('offline-media-v1');
    let plain = 0;
    for (const request of await cache.keys()) {
      if (!request.url.includes('/part/')) continue;
      const head = new TextDecoder('latin1').decode(new Uint8Array(await (await cache.match(request))!.arrayBuffer()).slice(0, 64));
      if (head.includes('ftyp') || head.includes('moof') || head.includes('moov')) plain++;
    }
    return plain;
  });
  expect(plaintextChunks).toBe(0);

  await page.getByRole('button', { name: 'My Downloads' }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Play Another Film' }).click();
  await expectPlaying(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play Big Test Movie' }).click();
  await expectPlaying(page);
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'My Downloads' })).toBeVisible();
  await expect(page.getByText("You're offline")).toBeHidden();
  await page.getByRole('button', { name: 'Play Big Test Movie' }).click();
  await expectPlaying(page);
});

test('My List: save a title from its details and find it on the My List page', async ({ page }) => {
  await page.locator('.grid').getByRole('button', { name: 'Big Test Movie' }).click();
  const details = page.getByRole('dialog');
  await details.getByRole('button', { name: 'Add Big Test Movie to My List' }).click();
  await expect(details.getByRole('button', { name: 'Remove Big Test Movie from My List' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');

  // Saved titles keep their cover's quality tag, in the Home row and on the My List page.
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const row = page.getByRole('region', { name: 'My List' });
  await expect(row.getByRole('button', { name: 'Big Test Movie' }).locator('.card__badge')).toHaveText('4K');
  await page.getByRole('button', { name: 'My List', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My List' })).toBeVisible();
  const saved = page.locator('.grid').getByRole('button', { name: 'Big Test Movie' });
  await expect(saved.locator('.card__badge')).toHaveText('4K');
  await saved.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove Big Test Movie from My List' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Add movies and series with the + button')).toBeVisible();
});

test('optional parental PIN guards opening a regular profile from the picker', async ({ page }) => {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Profiles' }).click();
  // A group shows only its own items, under its name with a back arrow.
  await expect(page.getByRole('menuitem', { name: /^Sign out/ })).toBeHidden();
  await page.getByRole('menuitem', { name: 'Back from Profiles' }).click();
  await page.getByRole('menuitem', { name: 'Profiles' }).click();
  await page.getByRole('menuitem', { name: 'Parental PIN' }).click();
  const settings = page.getByRole('dialog', { name: 'Parental PIN' });
  await settings.getByLabel('PIN (4 digits)').fill('2468');
  await settings.getByLabel('Repeat the PIN').fill('2468');
  await settings.getByRole('button', { name: 'Set PIN' }).click();
  await expect(settings.getByRole('status')).toHaveText('PIN set.');
  await settings.getByRole('button', { name: 'Close' }).first().click();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Profiles' }).click();
  await page.getByRole('menuitem', { name: 'Manage Profiles' }).click();
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
  await page.locator('.profile-tile').first().click();
  const prompt = page.getByRole('dialog', { name: /Enter the parental PIN/ });
  await prompt.getByLabel('Parental PIN').fill('1111');
  await prompt.getByRole('button', { name: 'OK' }).click();
  await expect(prompt.getByRole('alert')).toHaveText('Wrong PIN.');
  await prompt.getByLabel('Parental PIN').fill('2468');
  await prompt.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('back up to an encrypted file and restore it in another browser (D-056)', async ({ page, browser }) => {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Library & devices' }).click();
  await page.getByRole('menuitem', { name: 'Back up & restore' }).click();
  const dialog = page.getByRole('dialog', { name: 'Back up and restore' });
  await dialog.getByLabel('Password (at least 8 characters)').fill('correct horse');
  await dialog.getByLabel('Repeat the password').fill('correct horse');
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save backup file' }).click();
  const file = await (await downloading).path();
  await expect(dialog.getByRole('status')).toHaveText('Backup saved to your downloads.');

  const other = await browser.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Restore from a backup' }).click();
  const restore = other.getByRole('dialog', { name: 'Back up and restore' });
  await restore.getByLabel('Backup file').setInputFiles(file);
  await restore.getByLabel('Backup password').fill('wrong password');
  await restore.getByRole('button', { name: 'Restore backup' }).click();
  await expect(restore.getByRole('alert')).toHaveText('Wrong password, or the file is damaged.');
  await restore.getByLabel('Backup password').fill('correct horse');
  await restore.getByRole('button', { name: 'Restore backup' }).click();
  await expect(other.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await other.close();
});

test('account menu → App: About and the diagnostics log, as on TV (D-079)', async ({ page }) => {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'App' }).click();
  await page.getByRole('menuitem', { name: 'About' }).click();
  const about = page.getByRole('dialog', { name: 'About' });
  await expect(about).toContainText('Development build (browser)');
  await expect(about).not.toContainText('My server');
  await about.getByRole('button', { name: 'Close', exact: true }).first().click();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'App' }).click();
  await page.getByRole('menuitem', { name: 'Log' }).click();
  const log = page.getByRole('dialog', { name: 'Log' });
  await expect(log.locator('.log__lines')).toContainText('[app]');
  const saving = page.waitForEvent('download');
  await log.getByRole('button', { name: 'Save log' }).click();
  expect((await saving).suggestedFilename()).toMatch(/-log-\d{4}-\d{2}-\d{2}\.txt$/);
});

test('right-click on a movie: Mark as watched tags the cover and the details; Mark as not watched removes it (D-081)', async ({ page }) => {
  const grid = page.locator('.grid');
  const card = grid.locator('.card', { has: page.getByRole('button', { name: 'Sequel Test 2' }) });
  await expect(card).toBeVisible();
  await expect(card.getByTestId('watched-tag')).toHaveCount(0);

  await card.getByRole('button', { name: 'Sequel Test 2' }).click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Options for Sequel Test 2' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Go to details', 'Mark as watched', 'Add to My List', 'Cancel']);
  await menu.getByRole('menuitem', { name: 'Mark as watched' }).click();
  await expect(card.getByTestId('watched-tag')).toHaveText('Watched');

  await card.getByRole('button', { name: 'Sequel Test 2' }).click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Go to details' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('watched-tag')).toBeVisible();
  await page.keyboard.press('Escape');

  await card.getByRole('button', { name: 'Sequel Test 2' }).click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Mark as not watched' }).click();
  await expect(card.getByTestId('watched-tag')).toHaveCount(0);

  // The details' eye button does the same (D-104).
  await card.getByRole('button', { name: 'Sequel Test 2' }).click();
  await dialog.getByRole('button', { name: 'Mark as watched' }).click();
  await expect(dialog.getByTestId('watched-tag')).toBeVisible();
  await dialog.getByRole('button', { name: 'Mark as not watched' }).click();
  await expect(dialog.getByTestId('watched-tag')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // My List from the card menu (D-104).
  await card.getByRole('button', { name: 'Sequel Test 2' }).click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Add to My List' }).click();
  await card.getByRole('button', { name: 'Sequel Test 2' }).click({ button: 'right' });
  await expect(menu.getByRole('menuitem', { name: 'Remove from My List' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Remove from My List' }).click();
});

test('series: Mark series as watched tags the cover and every episode; unwatching one episode (its … menu) clears the series tag (D-082, D-083)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Series', exact: true }).click();
  const card = page.locator('.grid .card', { has: page.getByRole('button', { name: 'Test Series' }) });
  await card.getByRole('button', { name: 'Test Series' }).click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Options for Test Series' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Go to details', 'Mark series as watched', 'Add to My List', 'Cancel']);
  await menu.getByRole('menuitem', { name: 'Mark series as watched' }).click();
  await expect(card.getByTestId('watched-tag')).toBeVisible();

  await card.getByRole('button', { name: 'Test Series' }).click();
  const dialog = page.getByRole('dialog');
  const episodes = dialog.getByRole('region', { name: 'Episodes' });
  await expect(dialog.locator('.details__watched')).toBeVisible();
  await expect(episodes.getByTestId('watched-tag').first()).toBeVisible();

  // One episode back to not watched: its tag and the series tag go.
  const count = await episodes.getByTestId('watched-tag').count();
  // The whole season is watched: its button says so (issue #132).
  await expect(episodes.getByRole('button', { name: 'Mark season as not watched' })).toBeVisible();
  // The row has Play and "…" (D-083); the episode's options are in its menu.
  await expect(episodes.getByRole('button', { name: /^Mark (?!season)/ })).toHaveCount(0);
  await episodes
    .getByRole('button', { name: /^More options for / })
    .first()
    .click();
  const episodeMenu = page.getByRole('menu');
  await expect(episodeMenu.getByRole('menuitem', { name: /^(Download|Downloaded)$/ })).toBeVisible();
  await episodeMenu.getByRole('menuitem', { name: 'Mark as not watched' }).click();
  await expect(episodes.getByTestId('watched-tag')).toHaveCount(count - 1);
  await expect(dialog.locator('.details__watched')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(card.getByTestId('watched-tag')).toHaveCount(0);
});

test('details: two columns on a wide window, the panel on a narrow one (D-158, D-164)', async ({ page }) => {
  await page.getByRole('button', { name: 'Series', exact: true }).click();
  await page.locator('.grid').getByRole('button', { name: 'Test Series' }).click();
  const dialog = page.getByRole('dialog', { name: 'Test Series' });
  const left = dialog.getByTestId('details-left');
  const right = dialog.getByTestId('details-right');
  await expect(left.getByRole('heading', { name: 'Test Series' })).toBeVisible();
  await expect(left.getByRole('button', { name: /^Play/ })).toBeVisible();
  await expect(right.getByRole('region', { name: 'Episodes' })).toBeVisible();
  // The panel covers the window and the columns sit side by side.
  const panel = await dialog.boundingBox();
  expect(panel).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });
  const [l, r] = [await left.boundingBox(), await right.boundingBox()];
  expect(r!.x).toBeGreaterThanOrEqual(l!.x + l!.width - 1);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
  // Only the episode list scrolls; the title, season Watched button and season choice stay above it (D-165).
  const list = right.locator('.episodes__list');
  await expect(list).toHaveCSS('overflow-y', 'auto');
  await expect(list.getByRole('button', { name: 'Mark season as watched' })).toHaveCount(0);
  await expect(right.getByRole('button', { name: 'Mark season as watched' })).toBeVisible();
  await expect(right).toHaveCSS('overflow-y', 'hidden');

  // A narrow window: the panel with the episodes under the rest.
  await page.setViewportSize({ width: 560, height: 900 });
  await expect(left).toHaveCount(0);
  await expect(dialog.locator('.details__hero').getByRole('button', { name: /^Play/ })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Episodes' })).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('details: a movie keeps its facts in one column, 2/3 of a wide window (D-165, D-168)', async ({ page }) => {
  await page.locator('.grid').getByRole('button', { name: 'Big Test Movie' }).click();
  const dialog = page.getByRole('dialog', { name: 'Big Test Movie' });
  const left = dialog.getByTestId('details-left');
  await expect(left.getByText('Cast:')).toBeVisible();
  await expect(left.getByText('Source:')).toBeVisible();
  await expect(dialog.getByTestId('details-right')).toHaveCount(0);
  expect((await left.boundingBox())!.width).toBeCloseTo(960, -1);
});

test('app language (D-084): the whole app switches, and the choice stays after a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'App' }).click();
  await page.getByRole('menuitem', { name: 'App language' }).click();
  await page.getByRole('dialog', { name: 'App language' }).getByLabel('Deutsch').click();
  const nav = page.getByRole('navigation', { name: 'Hauptmenü' });
  await expect(nav.getByRole('button', { name: 'Startseite' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Meine Liste' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Hauptmenü' }).getByRole('button', { name: 'Filme' })).toBeVisible();
  // Titles keep the provider's names.
  await expect(page.getByRole('button', { name: 'Big Test Movie' }).first()).toBeVisible();
  // The menu names it in English too, so it can be found in any language.
  await page.getByRole('button', { name: 'Kontomenü' }).click();
  await page.getByRole('menuitem', { name: 'App', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'App-Sprache · App language' })).toBeVisible();
});

test('Home rows show the left arrow only once scrolled, the right one until the end (D-159)', async ({ page }) => {
  // Narrow enough that the fake panel's rows do not fit.
  await page.setViewportSize({ width: 560, height: 900 });
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const right = page.locator('.row__arrow--right').first();
  await expect(right).toBeAttached();
  const row = page.locator('.row', { has: right });
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  // The cards snap into place first (scroll-snap): the row is still at its beginning.
  await page.waitForTimeout(300);
  await expect(row.locator('.row__arrow--left')).toHaveCount(0);
  await row.locator('.row__arrow--right').click();
  await expect(row.locator('.row__arrow--left')).toBeVisible();
  // Back at the beginning, the first card snaps in line with the title, and the left arrow goes again.
  await row.locator('.row__arrow--left').click();
  await expect(row.locator('.row__arrow--left')).toHaveCount(0);
  await expect(row.locator('.row__arrow--right')).toBeVisible();
});

test('Home row titles take the mouse over their whole text, above the cards’ hover room (D-085)', async ({ page }) => {
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const link = page.getByRole('button', { name: 'Open Action' });
  await link.scrollIntoViewIfNeeded();
  // Rows load as they come near the screen and grow when they do: measure once the ones around it are in.
  await expect(page.getByRole('region', { name: 'Action' }).locator('.row__track')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Series', exact: true }).locator('.row__track')).toBeAttached();
  await link.scrollIntoViewIfNeeded();
  const box = (await link.boundingBox())!;
  for (const [fx, fy] of [
    [0.1, 0.2],
    [0.5, 0.5],
    [0.9, 0.8],
  ]) {
    const onTitle = await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('.row__link'),
      [box.x + box.width * fx!, box.y + box.height * fy!],
    );
    expect(onTitle).toBe(true);
  }
  await link.click();
  await expect(page.getByRole('tab', { name: 'Action' })).toHaveAttribute('aria-selected', 'true');
});

test('category chips stay on one line with Show all / Show less when they do not fit (D-085, D-091)', async ({ page }) => {
  await page.setViewportSize({ width: 300, height: 800 });
  await page.getByRole('button', { name: 'Movies', exact: true }).first().click();
  const chips = page.getByRole('tablist', { name: 'Categories' });
  const tops = async () =>
    new Set(await chips.getByRole('tab').evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top))));
  expect((await tops()).size).toBe(1);

  await page.getByRole('button', { name: 'Show all categories' }).click();
  expect((await tops()).size).toBeGreaterThan(1);
  // Expanded, the chips use the full width in a box of at most half the screen, under "Show less" (D-091).
  const box = (await chips.boundingBox())!;
  const less = (await page.getByRole('button', { name: 'Show fewer categories' }).boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(400);
  expect(less.y + less.height).toBeLessThanOrEqual(box.y);
  await chips.getByRole('tab', { name: 'Drama' }).click();
  // Picking a chip returns to the line, with the chosen chip in view.
  await expect(page.getByRole('button', { name: 'Show all categories' })).toBeVisible();
  expect((await tops()).size).toBe(1);
  await expect(chips.getByRole('tab', { name: 'Drama' })).toBeInViewport();
});

test('search: All, Movies, Series or Live TV shows only those results (D-108)', async ({ page }) => {
  await page.getByPlaceholder('Titles, series').fill('Test');
  await expect(page.getByRole('heading', { name: 'Results for “Test”' })).toBeVisible();
  const filter = page.getByRole('tablist', { name: 'Search' });
  const grid = (name: string) => page.locator('.grid').getByRole('button', { name });
  await expect(grid('Big Test Movie')).toBeVisible();
  await expect(grid('Test Series')).toBeVisible();

  await filter.getByRole('tab', { name: 'Series' }).click();
  await expect(grid('Test Series')).toBeVisible();
  await expect(grid('Big Test Movie')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Movies' })).toHaveCount(0);

  await filter.getByRole('tab', { name: 'Movies' }).click();
  await expect(grid('Big Test Movie')).toBeVisible();
  await expect(grid('Test Series')).toHaveCount(0);

  await filter.getByRole('tab', { name: 'Live TV' }).click();
  await expect(grid('Test News HD')).toBeVisible();
  await expect(grid('Big Test Movie')).toHaveCount(0);
});

test('search finds programmes of the TV guide and plays the channel that shows them (issue #119)', async ({ page }) => {
  await page.getByPlaceholder('Titles, series').fill('Storm');
  await expect(page.getByRole('heading', { name: 'On TV' })).toBeVisible();
  const programme = page
    .getByTestId('programme-results')
    .getByRole('button', { name: /Storm Watch/ })
    .first();
  await expect(programme).toBeVisible();
  await expect(page.getByTestId('programme-results')).toContainText('Test Weather');
  await programme.click();
  await expect(page.getByRole('heading', { name: 'Test Weather' })).toBeVisible();
});

test('automatic subtitles: set up once, then a movie gets an OpenSubtitles subtitle, on and listed (D-111)', async ({ page }) => {
  const calls: string[] = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await page.route('https://api.opensubtitles.com/**', async (route) => {
    const url = route.request().url();
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    calls.push(url.replace('https://api.opensubtitles.com/api/v1', ''));
    if (url.includes('/subtitles?'))
      return route.fulfill({
        headers: cors,
        json: { data: [{ id: '1', attributes: { language: 'en', download_count: 9, files: [{ file_id: 42 }] } }] },
      });
    return route.fulfill({ headers: cors, json: { link: 'https://dl.opensubtitles.com/42.srt', remaining: 4 } });
  });
  await page.route('https://dl.opensubtitles.com/**', (route) =>
    route.fulfill({ headers: cors, body: '1\n00:00:00,000 --> 00:59:00,000\nHello from OpenSubtitles\n' }),
  );

  await page.locator('.menu__avatar').click();
  await page.getByRole('menuitem', { name: 'App' }).click();
  await page.getByRole('menuitem', { name: 'Automatic subtitles' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'On' }).check();
  await dialog.getByLabel('API key').fill('test-key');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Big Test Movie' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('status')).toHaveText('Subtitles: English · OpenSubtitles');
  expect(calls).toEqual(['/subtitles?languages=en&query=big+test+movie&type=movie&year=2020', '/download']);
  await page.getByRole('button', { name: 'Audio, subtitles and version' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Audio, subtitles and version' }).getByRole('button', { name: 'English · OpenSubtitles' }),
  ).toBeVisible();
});

test('Categories shown: an unchecked category leaves browsing, but search still finds its titles (D-110)', async ({ page }) => {
  await page.getByRole('button', { name: 'Movies', exact: true }).first().click();
  const grid = page.locator('.grid');
  await expect(grid.getByRole('button', { name: 'Matroska Only' })).toBeVisible();

  await page.locator('.menu__avatar').click();
  await page.getByRole('menuitem', { name: 'Profiles' }).click();
  await page.getByRole('menuitem', { name: 'Categories shown' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Drama' }).uncheck();
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('tablist', { name: 'Categories' }).getByRole('tab', { name: 'Drama' })).toHaveCount(0);
  await expect(grid.getByRole('button', { name: 'Matroska Only' })).toHaveCount(0);
  await expect(grid.getByRole('button', { name: 'Big Test Movie' })).toBeVisible();

  await page.getByPlaceholder('Titles, series').fill('Matroska');
  await expect(grid.getByRole('button', { name: 'Matroska Only' })).toBeVisible();
});
