// UI stress test for the web grid (NEXT-STEPS "UI stress tests", D-048).
// Start the stack with a huge category: FAKE_PANEL_STRESS=5000 npm run dev:all -- --fake
// Then: node scripts/stress-web.mjs [http://localhost:5173]
// Prints, every 50 scroll steps: cards in the DOM, DOM nodes, long tasks and frame times (p50/p95) while scrolling.
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => window.__long.push(entry.duration))).observe({
    type: 'longtask',
    buffered: true,
  });
});
await page.goto(url);
await page.getByLabel('Server URL').fill('http://127.0.0.1:8090');
await page.getByLabel('Username').fill('demo');
await page.getByLabel('Password').fill('demo');
await page.getByRole('button', { name: 'Sign In' }).click();
await page.getByRole('button', { name: 'Movies', exact: true }).click();
await page.getByRole('tab', { name: 'Stress Test (huge)' }).click();
await page.waitForTimeout(3000);

const stats = () =>
  page.evaluate(() => ({
    cards: document.querySelectorAll('.grid > *').length,
    nodes: document.querySelectorAll('*').length,
    height: document.documentElement.scrollHeight,
  }));
const longTasks = () =>
  page.evaluate(() => {
    const tasks = window.__long;
    window.__long = [];
    return { count: tasks.length, maxMs: Math.round(Math.max(0, ...tasks)) };
  });
// Frame times over one second of continuous scrolling.
const frames = () =>
  page.evaluate(async () => {
    const deltas = [];
    let previous = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        deltas.push(now - previous);
        previous = now;
        if (deltas.length < 60) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
      const scroller = setInterval(() => scrollBy(0, 40), 16);
      setTimeout(() => clearInterval(scroller), 1000);
    });
    deltas.sort((a, b) => a - b);
    return { p50Ms: Math.round(deltas[30]), p95Ms: Math.round(deltas[57]) };
  });

let last = await stats();
for (let step = 1; step <= 800; step++) {
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(150);
  if (step % 50 !== 0) continue;
  const now = await stats();
  console.log(JSON.stringify({ step, ...now, longTasks: await longTasks(), frames: await frames() }));
  if (now.height === last.height) break;
  last = now;
}
await browser.close();
