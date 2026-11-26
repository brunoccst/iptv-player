// What the rescue window (rescue.mjs) may do: its three buttons and the texts and progress it shows.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rescue', {
  update: () => ipcRenderer.invoke('rescue:update'),
  github: () => ipcRenderer.invoke('rescue:github'),
  close: () => ipcRenderer.invoke('rescue:close'),
  onState: (callback) => ipcRenderer.on('rescue:state', (event, state) => callback(state)),
  ready: () => ipcRenderer.invoke('rescue:ready'),
});
