import { expect, type Page } from '@playwright/test';
import { E2E } from './stack';

export async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Server URL').fill(E2E.panelUrl);
  await page.getByLabel('Username').fill(E2E.username);
  await page.getByLabel('Password').fill(E2E.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/** Waits until the normalizer has produced the deduplicated library (rows show master cards). */
export async function waitForLibrary(page: Page) {
  await page.getByRole('button', { name: 'Movies', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Big Test Movie' })).toBeVisible({ timeout: 60_000 });
}

export const videoTime = (page: Page) => page.evaluate(() => document.querySelector<HTMLVideoElement>('.player__video')?.currentTime ?? 0);

export async function expectPlaying(page: Page, atLeastSeconds = 1.5) {
  await expect.poll(() => videoTime(page), { timeout: 30_000 }).toBeGreaterThan(atLeastSeconds);
}

export async function seek(page: Page, seconds: number) {
  await page.evaluate((to) => {
    document.querySelector<HTMLVideoElement>('.player__video')!.currentTime = to;
  }, seconds);
}
