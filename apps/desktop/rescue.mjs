// The rescue window (DECISIONS.md#d-250): shown by main.mjs when the app cannot start. It depends on Electron and the
// Node standard library only (electron-updater is loaded when used), so it works when the rest of the app is broken.
// It offers the update that may fix the app, and the release page as a way out when the update itself fails.
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RELEASE_TAG = 'desktop';
const RESCUE_TEXTS_FILE = 'rescue-texts.json';

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/** `x.y.z` is newer than `y.y.z`; same rule as the app (lib/helpers.mjs), repeated here because that may be what is broken. */
export const newerVersion = (latest, current) => {
  const parse = (v) =>
    String(v)
      .split(/[.-]/)
      .slice(0, 3)
      .map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parse(latest), parse(current)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

const fill = (texts, source, params = {}) =>
  (typeof texts?.[source] === 'string' && texts[source] ? texts[source] : source).replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Self-update works for the installed Windows app and the AppImage, like the app's own check (app.mjs, D-073). */
const canSelfUpdate = (config) =>
  Boolean(process.env.IPTV_DESKTOP_UPDATE_FEED) ||
  (app.isPackaged &&
    Boolean(config.updateRepo) &&
    (process.platform === 'win32' || (process.platform === 'linux' && !!process.env.APPIMAGE)));

export async function showRescue(error) {
  const config = readJson(path.join(here, 'build-config.json'), { appName: 'IPTV Player', updateRepo: '' });
  // The same profile folder as the app (it sets these first): its saved texts are in the user's language.
  app.setName(config.appName);
  if (process.env.IPTV_DESKTOP_USER_DATA) app.setPath('userData', process.env.IPTV_DESKTOP_USER_DATA);
  await app.whenReady();
  const texts = readJson(path.join(app.getPath('userData'), RESCUE_TEXTS_FILE), {});
  const tx = (source, params) => fill(texts, source, params);
  for (const window of BrowserWindow.getAllWindows()) window.destroy();

  const releasePage = config.updateRepo ? `https://github.com/${config.updateRepo}/releases/tag/${RELEASE_TAG}` : '';
  const selfUpdate = canSelfUpdate(config);
  const window = new BrowserWindow({
    width: 560,
    height: 460,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: config.appName,
    webPreferences: { preload: path.join(here, 'rescue-preload.cjs'), contextIsolation: true, sandbox: true },
  });
  window.setMenu(null);
  const send = (state) => !window.isDestroyed() && window.webContents.send('rescue:state', state);

  let latest = null;
  let busy = false;
  const state = (status, extra = {}) =>
    send({ status, canUpdate: selfUpdate && Boolean(latest) && !busy, canGithub: Boolean(releasePage), ...extra });

  let updater = null;
  const getUpdater = async () => {
    if (updater) return updater;
    const { default: electronUpdater } = await import('electron-updater');
    updater = electronUpdater.autoUpdater;
    if (process.env.IPTV_DESKTOP_UPDATE_FEED) {
      updater.forceDevUpdateConfig = true; // tests also run from the source folder
      updater.setFeedURL({ provider: 'generic', url: process.env.IPTV_DESKTOP_UPDATE_FEED });
    }
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    return updater;
  };

  const check = async () => {
    if (!selfUpdate) return state(tx('Update from the download page: install the newest version over this one. Your data stays.'));
    state(tx('Checking for an update…'));
    try {
      const result = await (await getUpdater()).checkForUpdates();
      const version = result?.updateInfo?.version;
      if (version && newerVersion(version, app.getVersion())) {
        latest = version;
        state(tx('Version {version} is available. It may fix this.', { version }));
      } else {
        state(tx('No newer version is available yet. Check the download page later.'));
      }
    } catch (checkError) {
      console.error('Rescue update check failed:', checkError);
      state(tx('Could not check for an update. Try the download page.'));
    }
  };

  ipcMain.handle('rescue:ready', () => {
    const detail = String(error?.stack ?? error?.message ?? error).slice(0, 2000);
    return { error: detail, version: app.getVersion() };
  });
  ipcMain.handle('rescue:github', () => (releasePage ? shell.openExternal(releasePage) : undefined));
  ipcMain.handle('rescue:close', () => app.exit(0));
  ipcMain.handle('rescue:update', async () => {
    if (!latest || busy) return;
    busy = true;
    const onProgress = ({ percent }) => state(tx('Downloading… {percent}%', { percent: Math.round(percent) }));
    try {
      const u = await getUpdater();
      u.on('download-progress', onProgress);
      state(tx('Downloading… {percent}%', { percent: 0 }));
      await u.downloadUpdate();
      u.off('download-progress', onProgress);
      state(tx('Installing the update. The app opens again by itself.'));
      // Silent, the same folder, then the new version starts (the same call as the app's update).
      setImmediate(() => u.quitAndInstall(true, true));
    } catch (updateError) {
      console.error('Rescue update failed:', updateError);
      busy = false;
      state(tx('The update did not work.') + ' ' + tx('You can download the new version from the release page instead.'));
    }
  });

  app.on('window-all-closed', () => app.exit(0));
  const labels = {
    title: tx('The app could not start'),
    intro: tx('Something went wrong while starting. Your data is safe. A newer version may fix it.'),
    update: tx('Update now'),
    github: tx('Download from GitHub'),
    close: tx('Close'),
  };
  await window.loadURL(
    'data:text/html;charset=utf-8,' +
      encodeURIComponent(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(config.appName)}</title>
<style>
body{font:15px system-ui,sans-serif;margin:24px;background:#14161a;color:#eee}
h1{font-size:20px;margin:0 0 8px}p{margin:8px 0}
pre{background:#0b0c0e;padding:10px;border-radius:6px;max-height:110px;overflow:auto;white-space:pre-wrap;font-size:12px;color:#f0b4b4}
#status{min-height:22px;color:#9fd0ff}
.row{display:flex;gap:10px;margin-top:16px}
button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid #555;background:#252a31;color:#eee;cursor:pointer}
button:disabled{opacity:.4;cursor:default}button.primary{background:#2d6cdf;border-color:#2d6cdf}
</style>
<h1 id="title">${escapeHtml(labels.title)}</h1>
<p>${escapeHtml(labels.intro)}</p>
<pre id="error"></pre>
<p id="status" role="status"></p>
<div class="row">
<button id="update" class="primary" disabled>${escapeHtml(labels.update)}</button>
<button id="github" disabled>${escapeHtml(labels.github)}</button>
<button id="close">${escapeHtml(labels.close)}</button>
</div>
<script>
const $ = (id) => document.getElementById(id);
window.rescue.ready().then((info) => { $('error').textContent = info.error; });
window.rescue.onState((s) => {
  $('status').textContent = s.status;
  $('update').disabled = !s.canUpdate;
  $('github').disabled = !s.canGithub;
});
$('update').onclick = () => window.rescue.update();
$('github').onclick = () => window.rescue.github();
$('close').onclick = () => window.rescue.close();
</script>`),
  );
  void check();
}
