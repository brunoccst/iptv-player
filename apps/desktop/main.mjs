// Desktop app (Windows, macOS, Linux), DECISIONS.md#d-071: the web player in its own window. It talks to the IPTV
// provider directly like the TV app (D-038), so no backend is needed. The page is served from 127.0.0.1 by this
// process; provider requests get the player User-Agent and CORS headers added here.
import { app, BrowserWindow, dialog, ipcMain, Menu, net, safeStorage, session, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  asPlayer,
  contentType,
  isNewer,
  keyFile,
  lanAddress,
  releaseVersion,
  staticFile,
  vlcArguments,
  vlcCandidates,
  withCors,
} from './lib/helpers.mjs';

const { autoUpdater } = electronUpdater;
const here = path.dirname(fileURLToPath(import.meta.url));
const config = (() => {
  try {
    return JSON.parse(readFileSync(path.join(here, 'build-config.json'), 'utf8'));
  } catch {
    return { appName: 'IPTV Player', appSlug: 'iptv-player', userAgent: 'VLC/3.0.21 LibVLC/3.0.21', updateRepo: '' };
  }
})();
/** Fixed, so the page keeps its origin and with it its saved state (settings, downloads) between starts. */
const PORT = 47831;
const UPDATE_CHECK_DELAY_MS = 15_000;
const RELEASE_TAG = 'desktop';
/** Same limit as the TV (PairingServer.kt): sign-in, profiles, progress and My List. */
const MAX_PAIRING_BODY = 8 * 1024 * 1024;
/** The phone gives up after 30 s; the page answers much sooner. */
const PAIRING_ANSWER_TIMEOUT_MS = 45_000;

app.setName(config.appName);
// Tests start the app with a fresh profile folder.
if (process.env.IPTV_DESKTOP_USER_DATA) app.setPath('userData', process.env.IPTV_DESKTOP_USER_DATA);
// The web player (apps/web-player/dist), bundled next to the app or taken from the repository while developing.
const webRoot = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(here, '../web-player/dist');

// One window: starting the app again brings it to the front.
if (!app.requestSingleInstanceLock()) app.quit();

let window = null;
let appOrigin = '';
const isApp = (url) => url === appOrigin || url.startsWith(appOrigin + '/');

/** Serves the web player on 127.0.0.1 (a secure context: offline downloads need it). */
function startServer() {
  const server = createServer((request, response) => {
    let file = staticFile(webRoot, request.url ?? '/');
    if (file && !(existsSync(file) && statSync(file).isFile())) file = path.join(webRoot, 'index.html');
    if (!file || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentType(file),
      // index.html and the Service Worker must be fresh after an update; the rest has hashed names.
      'Cache-Control': /(index\.html|sw\.js)$/.test(file) ? 'no-cache' : 'max-age=31536000, immutable',
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      if (error.code !== 'EADDRINUSE') return reject(error);
      // Another program uses the port: any free one (this start then has fresh page storage; sign-in is kept).
      console.warn(`Port ${PORT} is in use; using a free port.`);
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server.address().port));
  });
}

/** Provider requests look like a player and may be read by the page (CORS). */
function prepareSession() {
  const external = { urls: ['http://*/*', 'https://*/*'] };
  session.defaultSession.webRequest.onBeforeSendHeaders(external, (details, callback) => {
    if (isApp(details.url)) return callback({});
    callback({ requestHeaders: asPlayer(details.requestHeaders, config.userAgent) });
  });
  session.defaultSession.webRequest.onHeadersReceived(external, (details, callback) => {
    if (isApp(details.url)) return callback({});
    const answer = { responseHeaders: withCors(details.responseHeaders, appOrigin) };
    // Providers do not answer CORS preflights; the page never sends anything that needs one, but just in case.
    if (details.method === 'OPTIONS') answer.statusLine = 'HTTP/1.1 204 No Content';
    callback(answer);
  });
}

/** Storage for the page: `secure` encrypted by the system (Windows DPAPI, macOS Keychain, Linux secret store). */
function registerStorage() {
  const folders = { secure: path.join(app.getPath('userData'), 'secure'), data: path.join(app.getPath('userData'), 'data') };
  const encrypt = safeStorage.isEncryptionAvailable();
  if (!encrypt) console.warn('No system encryption available: the sign-in is stored unencrypted.');

  ipcMain.handle('iptv:storage', async (event, kind, operation, key, value) => {
    if (!isApp(event.senderFrame?.url ?? '') || !(kind in folders) || typeof key !== 'string') throw new Error('Not allowed');
    const file = path.join(folders[kind], keyFile(key));
    const secure = kind === 'secure' && encrypt;
    switch (operation) {
      case 'get':
        try {
          const bytes = await readFile(file);
          return secure ? safeStorage.decryptString(bytes) : bytes.toString('utf8');
        } catch {
          return null;
        }
      case 'set': {
        await mkdir(folders[kind], { recursive: true });
        // Written next to it first, so a crash never leaves half a file.
        await writeFile(file + '.tmp', secure ? safeStorage.encryptString(String(value)) : String(value));
        await rename(file + '.tmp', file);
        return null;
      }
      case 'remove':
        await rm(file, { force: true });
        return null;
      default:
        throw new Error('Unknown storage operation');
    }
  });
  ipcMain.on('iptv:info', (event) => {
    event.returnValue = { version: app.getVersion(), platform: process.platform };
  });
}

/**
 * Phone-to-computer pairing (D-072), the TV's protocol (D-060): while the page shows the QR code, a small HTTP server
 * listens on the home network (random port) at /pair. Each request body goes to the page, which checks the one-time
 * key, merges and answers (packages/shared/src/pairing); the answer goes back to the phone.
 */
function registerPairing() {
  let server = null;
  const waiting = new Map();
  let nextId = 1;

  const answer = (id, status, body = '') => {
    const response = waiting.get(id);
    if (!response) return;
    waiting.delete(id);
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(body);
  };
  const stop = () => {
    server?.close();
    server = null;
    for (const id of [...waiting.keys()]) answer(id, 410);
  };
  const fromApp = (event) => {
    if (!isApp(event.senderFrame?.url ?? '')) throw new Error('Not allowed');
  };

  ipcMain.handle('iptv:pairing-start', async (event) => {
    fromApp(event);
    stop();
    const host = lanAddress(networkInterfaces());
    if (!host) return { host: null, port: 0, key: '' };
    const sender = event.sender;
    const current = createServer((request, response) => {
      if (request.method !== 'POST' || !request.url?.startsWith('/pair')) {
        response.writeHead(404).end();
        return;
      }
      const length = Number(request.headers['content-length']);
      if (!(length > 0 && length <= MAX_PAIRING_BODY)) {
        response.writeHead(413).end();
        request.resume();
        return;
      }
      const chunks = [];
      let size = 0;
      request.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_PAIRING_BODY) request.destroy();
        else chunks.push(chunk);
      });
      request.on('end', () => {
        const id = nextId++;
        waiting.set(id, response);
        sender.send('iptv:pairing-request', { id, body: Buffer.concat(chunks).toString('utf8') });
        setTimeout(() => answer(id, 504), PAIRING_ANSWER_TIMEOUT_MS);
      });
    });
    const port = await new Promise((resolve, reject) => {
      current.once('error', reject);
      current.listen(0, '0.0.0.0', () => resolve(current.address().port));
    });
    server = current;
    return { host, port, key: randomBytes(32).toString('base64') };
  });
  ipcMain.handle('iptv:pairing-respond', (event, id, status, body) => {
    fromApp(event);
    answer(Number(id), Number(status), String(body ?? ''));
  });
  ipcMain.handle('iptv:pairing-stop', (event) => {
    fromApp(event);
    stop();
  });
  app.on('before-quit', stop);
}

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#141414',
    title: config.appName,
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  window.once('ready-to-show', () => window.show());
  // Links to other sites open in the browser; the window only ever shows the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isApp(url)) event.preventDefault();
  });
  // No menu bar: Ctrl+Shift+I (Cmd+Option+I) opens the developer tools for diagnostics, F11 toggles full screen.
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const devtools = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i';
    if (devtools || (input.meta && input.alt && input.key.toLowerCase() === 'i')) window.webContents.toggleDevTools();
    else if (input.key === 'F11') window.setFullScreen(!window.isFullScreen());
    else return;
    event.preventDefault();
  });
  window.on('closed', () => (window = null));
  void window.loadURL(appOrigin + '/');
}

/**
 * Updates (D-073). About 15 s after start, and from account menu → Check for updates: the `desktop` release says
 * which version is newest. On Windows and with the Linux AppImage the app downloads the installer itself (checked
 * against the SHA-512 in latest.yml) and restarts into the new version: a file the app downloads has no "downloaded
 * from the internet" mark, so Windows does not ask the SmartScreen question again. macOS (unsigned) and the .deb
 * open the download page instead.
 */
const selfUpdates = () =>
  app.isPackaged &&
  Boolean(config.updateRepo) &&
  (process.platform === 'win32' || (process.platform === 'linux' && !!process.env.APPIMAGE));
const skippedFile = () => path.join(app.getPath('userData'), 'update-skipped.txt');
const readSkipped = () => (existsSync(skippedFile()) ? readFileSync(skippedFile(), 'utf8').trim() : '');
let updating = false;

async function checkForUpdate(manual = false) {
  if (!config.updateRepo || updating || !window) {
    if (manual && !config.updateRepo) await message('This build does not check for updates.');
    return;
  }
  updating = true;
  // An automatic check that fails (offline) stays quiet; a failed install the user asked for does not.
  let installing = false;
  try {
    const latest = selfUpdates() ? await latestFromFeed() : await latestFromRelease();
    if (!latest || !isNewer(latest.version, app.getVersion())) {
      if (manual) await message(`You have the newest version (${app.getVersion()}).`);
      return;
    }
    if (!manual && latest.version === readSkipped()) return;
    const { response: choice } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'App update',
      message: `Version ${latest.version} is available (you have ${app.getVersion()}).`,
      detail: latest.install
        ? 'The app downloads it and restarts with the new version. Your data stays.'
        : 'The download page opens in your browser. Install the new version over this one; your data stays.',
      buttons: [latest.install ? 'Install now' : 'Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice !== 0) {
      await writeFile(skippedFile(), latest.version);
      return;
    }
    installing = true;
    if (latest.install) await latest.install();
    else await shell.openExternal(releasePage());
  } catch (error) {
    console.warn(`Update failed: ${error?.message ?? error}`);
    if (manual || installing) {
      const { response: choice } = await dialog.showMessageBox(window, {
        type: 'warning',
        title: 'App update',
        message: 'The update did not work.',
        detail: `${error?.message ?? error}\n\nYou can download the new version from the release page instead.`,
        buttons: ['Open the download page', 'Close'],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice === 0) await shell.openExternal(releasePage());
    }
  } finally {
    updating = false;
    window?.setProgressBar(-1);
  }
}

const releasePage = () => `https://github.com/${config.updateRepo}/releases/tag/${RELEASE_TAG}`;
const message = (text) => (window ? dialog.showMessageBox(window, { type: 'info', title: 'App update', message: text }) : null);

/** Windows and AppImage: electron-updater reads latest.yml from the release (generic feed, fixed file names). */
async function latestFromFeed() {
  // Tests point the app at a local copy of the release.
  if (process.env.IPTV_DESKTOP_UPDATE_FEED) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.IPTV_DESKTOP_UPDATE_FEED });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  const result = await autoUpdater.checkForUpdates();
  const version = result?.updateInfo?.version;
  if (!version) return null;
  return {
    version,
    async install() {
      const onProgress = ({ percent }) => window?.setProgressBar(Math.max(0, Math.min(1, percent / 100)));
      autoUpdater.on('download-progress', onProgress);
      try {
        await autoUpdater.downloadUpdate();
      } finally {
        autoUpdater.off('download-progress', onProgress);
      }
      window?.setProgressBar(-1);
      const { response: now } = await dialog.showMessageBox(window, {
        type: 'info',
        title: 'App update',
        message: `Version ${version} is ready.`,
        detail: 'The app closes, installs it in the same folder and opens again.',
        buttons: ['Restart now', 'When I close the app'],
        defaultId: 0,
        cancelId: 1,
      });
      if (now === 0) {
        // Silent: no setup wizard, the same folder; then the new version starts.
        setImmediate(() => autoUpdater.quitAndInstall(true, true));
      } else {
        autoUpdater.autoInstallOnAppQuit = true;
      }
    },
  };
}

/** macOS and .deb: the version from the release notes ("Desktop app X.Y.Z"). */
async function latestFromRelease() {
  const response = await net.fetch(`https://api.github.com/repos/${config.updateRepo}/releases/tags/${RELEASE_TAG}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GitHub answered HTTP ${response.status}`);
  const version = releaseVersion((await response.json()).body);
  return version ? { version, install: null } : null;
}

app.on('second-instance', () => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

app.whenReady().then(async () => {
  // macOS keeps its standard menu (copy/paste, quit); Windows and Linux have none.
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  appOrigin = `http://127.0.0.1:${await startServer()}`;
  prepareSession();
  registerStorage();
  registerPairing();
  createWindow();
  setTimeout(() => void checkForUpdate(), UPDATE_CHECK_DELAY_MS);
  ipcMain.handle('iptv:check-updates', (event) => {
    if (!isApp(event.senderFrame?.url ?? '')) throw new Error('Not allowed');
    void checkForUpdate(true);
  });
  // "Open in VLC" (D-081, like the TV's "open in another player", D-057): VLC plays the stream with the provider
  // User-Agent. Only http(s) addresses; returns 'vlc', or 'none' when VLC is not installed.
  ipcMain.handle('iptv:open-external', (event, url, title) => {
    if (!isApp(event.senderFrame?.url ?? '')) throw new Error('Not allowed');
    const args = vlcArguments(String(url ?? ''), config.userAgent, title ? String(title) : null);
    if (!args) throw new Error('Not a stream address');
    const vlc = vlcCandidates(process.platform, process.env).find((file) => existsSync(file));
    if (!vlc) return 'none';
    spawn(vlc, args, { detached: true, stdio: 'ignore' }).unref();
    return 'vlc';
  });
  app.on('activate', () => {
    if (!window) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
