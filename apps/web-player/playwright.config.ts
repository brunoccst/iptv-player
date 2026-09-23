import { defineConfig } from '@playwright/test';
import { E2E } from './e2e/stack';

/** End-to-end tests against a real local stack (fake Xtream panel, backend, worker, production build). See e2e/README.md. */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: E2E.webUrl,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
});
