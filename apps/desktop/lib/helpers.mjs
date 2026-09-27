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

/**
 * The computer's address on the home network for the pairing QR code (D-072): the first private IPv4 address,
 * skipping virtual adapters (WSL, Hyper-V, VirtualBox, Docker, VPNs) a phone cannot reach. `interfaces` is
 * `os.networkInterfaces()`.
 */
export function lanAddress(interfaces) {
  const virtual = /vethernet|virtualbox|vmware|docker|wsl|hyper-v|tailscale|zerotier|utun|tun|tap|br-|veth/i;
  const candidates = [];
  for (const [name, addresses] of Object.entries(interfaces ?? {})) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' && address.family !== 4) continue;
      if (address.internal || address.address.startsWith('169.254.')) continue;
      const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address);
      candidates.push({ address: address.address, score: (isPrivate ? 2 : 0) + (virtual.test(name) ? 0 : 1) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address ?? null;
}

/**
 * Where VLC usually is (D-081, "Open in VLC"): the standard install folders, then every folder on PATH. `env` and
 * `platform` come from the process; `join` is the platform's path join (tests pass path.win32 / path.posix).
 */
export function vlcCandidates(platform, env, join = path.join) {
  const onPath = (name) =>
    (env.PATH ?? env.Path ?? '')
      .split(platform === 'win32' ? ';' : ':')
      .filter(Boolean)
      .map((folder) => join(folder, name));
  if (platform === 'win32')
    return [
      ...[env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs')]
        .filter(Boolean)
        .map((folder) => join(folder, 'VideoLAN', 'VLC', 'vlc.exe')),
      ...onPath('vlc.exe'),
    ];
  if (platform === 'darwin')
    return [
      '/Applications/VLC.app/Contents/MacOS/VLC',
      ...(env.HOME ? [join(env.HOME, 'Applications', 'VLC.app', 'Contents', 'MacOS', 'VLC')] : []),
      ...onPath('vlc'),
    ];
  return [...onPath('vlc'), '/usr/bin/vlc', '/snap/bin/vlc', '/var/lib/flatpak/exports/bin/org.videolan.VLC'];
}

/**
 * VLC arguments for one stream: the provider's User-Agent (like the app's own requests) and the title in VLC's window.
 * Only http(s) addresses; anything else returns null, so the page cannot make the app start VLC on local files.
 */
export function vlcArguments(url, userAgent, title) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return [
    `--http-user-agent=${userAgent}`,
    ...(title ? [`--meta-title=${String(title).slice(0, 200)}`] : []),
    '--no-one-instance',
    parsed.href,
  ];
}

/**
 * The main process's own texts (update dialogs) in the app's language (D-084): the page sends the translations,
 * keyed by the English text; a missing one stays English. `{name}` placeholders are filled from `params`.
 */
export function fillText(texts, source, params = {}) {
  const text = typeof texts?.[source] === 'string' && texts[source] ? texts[source] : source;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Only string pairs, and not too many, from the page. */
export function cleanTexts(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, text]) => typeof key === 'string' && typeof text === 'string' && key.length < 500 && text.length < 1000)
      .slice(0, 100),
  );
}
