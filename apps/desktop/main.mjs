// Desktop app (Windows, macOS, Linux), DECISIONS.md#d-071: the web player in its own window. It talks to the IPTV
// provider directly like the TV app (D-038), so no backend is needed. The page is served from 127.0.0.1 by this
// process; provider requests get the player User-Agent and CORS headers added here.
import { app, BrowserWindow, dialog, ipcMain, Menu, net, safeStorage, session, shell } from 'electron';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asPlayer, contentType, isNewer, keyFile, releaseVersion, staticFile, withCors } from './lib/helpers.mjs';

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

/** Once after start: a newer version in this repository's `desktop` release → offer the download page. */
async function checkForUpdate() {
  if (!config.updateRepo) return;
  try {
    const response = await net.fetch(`https://api.github.com/repos/${config.updateRepo}/releases/tags/${RELEASE_TAG}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return;
    const release = await response.json();
    const latest = releaseVersion(release.body);
    const skippedFile = path.join(app.getPath('userData'), 'update-skipped.txt');
    const skipped = existsSync(skippedFile) ? readFileSync(skippedFile, 'utf8').trim() : '';
    if (!latest || !isNewer(latest, app.getVersion()) || latest === skipped || !window) return;
    const { response: choice } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'App update',
      message: `Version ${latest} is available (you have ${app.getVersion()}).`,
      detail: 'The download page opens in your browser. Install the new version over this one; your data stays.',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice === 0) await shell.openExternal(release.html_url ?? `https://github.com/${config.updateRepo}/releases/tag/${RELEASE_TAG}`);
    else await writeFile(skippedFile, latest);
  } catch (error) {
    console.warn(`Update check failed: ${error?.message ?? error}`);
  }
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
  createWindow();
  setTimeout(() => void checkForUpdate(), UPDATE_CHECK_DELAY_MS);
  app.on('activate', () => {
    if (!window) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
