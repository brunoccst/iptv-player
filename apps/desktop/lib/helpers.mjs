// Pure helpers of the desktop app (no Electron), tested in test/helpers.test.mjs. See D-071.
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export const contentType = (file) => TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

/**
 * The file under `root` for a request path, or null when it would leave `root`. Unknown paths get index.html
 * (the caller checks existence); the page has no routes, but a reload must still find the app.
 */
export function staticFile(root, requestPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestPath, 'http://app').pathname);
  } catch {
    return null;
  }
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  const base = path.resolve(root);
  return file === base || file.startsWith(base + path.sep) ? file : null;
}

/**
 * Response headers for a request from the app page to another address (the IPTV provider): allowed for the app
 * (CORS), whatever the provider sends. The page is a normal web page, and providers do not send CORS headers.
 */
export function withCors(responseHeaders, appOrigin) {
  const headers = {};
  for (const [name, value] of Object.entries(responseHeaders ?? {})) {
    if (!name.toLowerCase().startsWith('access-control-')) headers[name] = value;
  }
  headers['Access-Control-Allow-Origin'] = [appOrigin];
  headers['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS'];
  headers['Access-Control-Allow-Headers'] = ['*'];
  headers['Access-Control-Expose-Headers'] = ['*'];
  return headers;
}

/** Request headers for the provider: the player User-Agent, and no page origin (providers expect a player). */
export function asPlayer(requestHeaders, userAgent) {
  const headers = {};
  for (const [name, value] of Object.entries(requestHeaders ?? {})) {
    const lower = name.toLowerCase();
    if (lower !== 'user-agent' && lower !== 'origin' && lower !== 'referer') headers[name] = value;
  }
  headers['User-Agent'] = userAgent;
  return headers;
}

/** A storage key as a safe file name (keys look like `iptv-player:library:movies`). */
export const keyFile = (key) => encodeURIComponent(key).replace(/\*/g, '%2A').replace(/^\./, '%2E') + '.txt';

/** "Desktop app 1.2.3" from the release notes; null without one. */
export function releaseVersion(notes) {
  return /\bDesktop app (\d+\.\d+\.\d+)\b/.exec(notes ?? '')?.[1] ?? null;
}

/** Whether MAJOR.MINOR.PATCH `a` is newer than `b`. */
export function isNewer(a, b) {
  const parse = (version) => (/^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '') ?? []).slice(1).map(Number);
  const [x, y] = [parse(a), parse(b)];
  if (x.length !== 3) return false;
  if (y.length !== 3) return true;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
