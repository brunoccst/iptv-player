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

  await page.getByRole('button', { name: 'My List', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My List' })).toBeVisible();
  await page.locator('.grid').getByRole('button', { name: 'Big Test Movie' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove Big Test Movie from My List' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Add movies and series with the + button')).toBeVisible();
});
