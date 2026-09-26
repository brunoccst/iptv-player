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
  secure: storage('secure'),
  data: storage('data'),
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
