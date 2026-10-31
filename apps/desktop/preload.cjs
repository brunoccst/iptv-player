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
  // Downloads go on with the window closed (issue #219): the page says whether any run, and hears when it was hidden.
  setDownloadsActive: (active) => ipcRenderer.invoke('iptv:downloads-active', active),
  onBackground(listener) {
    const handler = () => listener();
    ipcRenderer.on('iptv:background', handler);
    return () => ipcRenderer.removeListener('iptv:background', handler);
  },
  // Start with the computer, in the tray (issue #309): whether it is on; `set` turns it on or off first.
  startup: {
    get: () => ipcRenderer.invoke('iptv:startup'),
    set: (on) => ipcRenderer.invoke('iptv:startup', on === true),
  },
  // Brings the window back, from the tray too (a reminder's notification was clicked).
  show: () => ipcRenderer.invoke('iptv:show'),
  // "Open in VLC" (D-057): 'vlc' when VLC started, 'none' when it is not installed. With a watch id, where VLC
  // stops comes back as { id, position, duration, ended } (issue #265).
  openInVlc: (url, title, startAt, watchId) => ipcRenderer.invoke('iptv:open-external', url, title, startAt, watchId),
  onVlcProgress(listener) {
    const handler = (_event, progress) => listener(progress);
    ipcRenderer.on('iptv:vlc-progress', handler);
    return () => ipcRenderer.removeListener('iptv:vlc-progress', handler);
  },
  // What Chromium cannot decode, through the bundled FFmpeg (issue #236): what a stream holds, then an HLS playlist
  // of it as H.264 and AAC on the app's own server.
  transcode: {
    probe: (url) => ipcRenderer.invoke('iptv:transcode', 'probe', url),
    start: (options) => ipcRenderer.invoke('iptv:transcode', 'start', options),
    stop: () => ipcRenderer.invoke('iptv:transcode', 'stop'),
    // A timeline picture of a converted title (issue #270): JPEG bytes, or null.
    frame: (options) => ipcRenderer.invoke('iptv:transcode', 'frame', options),
    // Downloads converted for FFmpeg (issue #270): the page reads a piece of `path` from `start` and answers.
    onOfflineRead(listener) {
      const handler = (_event, request) =>
        void Promise.resolve(listener(request)).then(
          (answer) => ipcRenderer.invoke('iptv:offline-answer', request.id, answer),
          () => ipcRenderer.invoke('iptv:offline-answer', request.id, { status: 502 }),
        );
      ipcRenderer.on('iptv:offline-read', handler);
      return () => ipcRenderer.removeListener('iptv:offline-read', handler);
    },
  },
  secure: storage('secure'),
  data: storage('data'),
  // The library database (D-121): statements and queries as JSON, like the TV app's native module.
  db: {
    run: (statements) => ipcRenderer.invoke('iptv:db', 'run', statements),
    query: (sql, params) => ipcRenderer.invoke('iptv:db', 'query', sql, params),
  },
  // Phone-to-computer pairing (D-060): the main process runs the server, the page decides and answers.
  pairing: {
    start: () => ipcRenderer.invoke('iptv:pairing-start'),
    stop: () => ipcRenderer.invoke('iptv:pairing-stop'),
    respond: (id, status, body) => ipcRenderer.invoke('iptv:pairing-respond', id, status, body),
    // Scanning another device's code with the webcam (issue #254), and the automatic sync with the paired TV (issue
    // #227, path '/remote'): { status, body } of its answer.
    send: (host, port, body, path) => ipcRenderer.invoke('iptv:pairing-send', host, port, body, path),
    onRequest(listener) {
      const handler = (_event, request) => listener(request);
      ipcRenderer.on('iptv:pairing-request', handler);
      return () => ipcRenderer.removeListener('iptv:pairing-request', handler);
    },
  },
  // The computer as a sync hub (issue #268): phones that scanned its code sync with it like with the TV.
  remote: {
    start: () => ipcRenderer.invoke('iptv:remote-start'),
    stop: () => ipcRenderer.invoke('iptv:remote-stop'),
    respond: (id, status, body) => ipcRenderer.invoke('iptv:remote-respond', id, status, body),
    onRequest(listener) {
      const handler = (_event, request) => listener(request);
      ipcRenderer.on('iptv:remote-request', handler);
      return () => ipcRenderer.removeListener('iptv:remote-request', handler);
    },
  },
});
