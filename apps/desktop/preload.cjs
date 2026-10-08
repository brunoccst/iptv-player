// Gives the page (apps/web-player/src/desktop.ts) its storage through the main process. See D-071.
const { contextBridge, ipcRenderer } = require('electron');

const storage = (kind) => ({
  getItem: (key) => ipcRenderer.invoke('iptv:storage', kind, 'get', key),
  setItem: (key, value) => ipcRenderer.invoke('iptv:storage', kind, 'set', key, value),
  removeItem: (key) => ipcRenderer.invoke('iptv:storage', kind, 'remove', key),
});

const info = ipcRenderer.sendSync('iptv:info');
contextBridge.exposeInMainWorld('iptvDesktop', {
  version: info.version,
  platform: info.platform,
  checkForUpdates: () => ipcRenderer.invoke('iptv:check-updates'),
  // While an accepted update downloads: { version, percent }, then null when it ends or fails.
  onUpdateProgress(listener) {
    const handler = (_event, progress) => listener(progress);
    ipcRenderer.on('iptv:update-progress', handler);
    return () => ipcRenderer.removeListener('iptv:update-progress', handler);
  },
  // The update dialogs' texts in the app's language (D-084).
  setTexts: (texts) => ipcRenderer.invoke('iptv:set-texts', texts),
  // "Open in VLC" (D-081): 'vlc' when VLC started, 'none' when it is not installed.
  openInVlc: (url, title) => ipcRenderer.invoke('iptv:open-external', url, title),
  secure: storage('secure'),
  data: storage('data'),
  // The library database (D-121): statements and queries as JSON, like the TV app's native module.
  db: {
    run: (statements) => ipcRenderer.invoke('iptv:db', 'run', statements),
    query: (sql, params) => ipcRenderer.invoke('iptv:db', 'query', sql, params),
  },
  // Phone-to-computer pairing (D-072): the main process runs the server, the page decides and answers.
  pairing: {
    start: () => ipcRenderer.invoke('iptv:pairing-start'),
    stop: () => ipcRenderer.invoke('iptv:pairing-stop'),
    respond: (id, status, body) => ipcRenderer.invoke('iptv:pairing-respond', id, status, body),
    onRequest(listener) {
      const handler = (_event, request) => listener(request);
      ipcRenderer.on('iptv:pairing-request', handler);
      return () => ipcRenderer.removeListener('iptv:pairing-request', handler);
    },
  },
});
