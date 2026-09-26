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
});
