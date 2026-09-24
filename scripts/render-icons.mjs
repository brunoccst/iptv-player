// Renders the app icon (one SVG design) to every PNG the web app and the APK need. Run: node scripts/render-icons.mjs
// Output is committed; rerun only when the design changes. Uses the repo's Playwright Chromium.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BG = '#141414';

/** The artwork: a TV screen with a red play button, drawn in a 1024 box. `scale` shrinks it around the centre. */
const art = (scale = 1) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <defs>
      <linearGradient id="play" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff4d4d"/><stop offset="1" stop-color="#c0060f"/>
      </linearGradient>
    </defs>
    <rect x="152" y="232" width="720" height="480" rx="64" fill="none" stroke="#ffffff" stroke-width="44"/>
    <path d="M392 792 H632" stroke="#ffffff" stroke-width="44" stroke-linecap="round"/>
    <path d="M436 346 L436 598 L640 472 Z" fill="url(#play)" stroke="url(#play)" stroke-width="36" stroke-linejoin="round"/>
  </g>`;

const svg = (width, height, body, background = BG, radius = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
  (background ? `<rect width="${width}" height="${height}" rx="${radius}" fill="${background}"/>` : '') +
  body +
  '</svg>';

/** 320x180 Android TV banner: artwork centred on the dark background. */
const banner = svg(320, 180, `<g transform="translate(70 0) scale(0.1758)">${art(1)}</g>`);

const outputs = [
  // APK: launcher icon, adaptive foreground (art inside the 66% safe zone), splash image, TV banner.
  { file: 'apps/tv-app/assets/icon.png', size: 1024, svg: svg(1024, 1024, art(0.9)) },
  { file: 'apps/tv-app/assets/adaptive-icon.png', size: 1024, svg: svg(1024, 1024, art(0.62), null) },
  { file: 'apps/tv-app/assets/splash-icon.png', size: 1024, svg: svg(1024, 1024, art(0.9), null) },
  { file: 'apps/tv-app/assets/tv-banner.png', width: 320, height: 180, svg: banner },
  // Web: favicon (SVG + PNG), home-screen icons.
  { file: 'apps/web-player/public/icon-192.png', size: 192, svg: svg(1024, 1024, art(0.9)) },
  { file: 'apps/web-player/public/icon-512.png', size: 512, svg: svg(1024, 1024, art(0.9)) },
  { file: 'apps/web-player/public/apple-touch-icon.png', size: 180, svg: svg(1024, 1024, art(0.9)) },
];

const favicon = svg(1024, 1024, art(0.95), BG, 200);
mkdirSync(join(root, 'apps/web-player/public'), { recursive: true });
writeFileSync(join(root, 'apps/web-player/public/favicon.svg'), `${favicon}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const output of outputs) {
  const width = output.width ?? output.size;
  const height = output.height ?? output.size;
  await page.setViewportSize({ width, height });
  const scaled = output.svg.replace(/width="(\d+)" height="(\d+)"/, `width="${width}" height="${height}"`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${scaled}</body></html>`);
  mkdirSync(dirname(join(root, output.file)), { recursive: true });
  await page.screenshot({ path: join(root, output.file), omitBackground: true, clip: { x: 0, y: 0, width, height } });
  console.log(`wrote ${output.file}`);
}
await browser.close();
