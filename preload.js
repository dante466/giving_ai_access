// BEGIN preload.js
const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script executing...');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    console.log('Sending IPC:', channel, data);
    ipcRenderer.send(channel, data);
  },
  on: (channel, func) => {
    console.log('Registering listener for:', channel);
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  readFileSync: (path, encoding) => ipcRenderer.invoke('fs-read', path, encoding),
  writeFileSync: (path, data) => ipcRenderer.invoke('fs-write', path, data),
  existsSync: (path) => ipcRenderer.invoke('fs-exists', path),
  toggleOverlay: (enable) => ipcRenderer.send('toggle-overlay', enable),
  startBoundingBox: (mode) => ipcRenderer.send('start-bounding-box', mode),
  captureArea: (coords, mode) => ipcRenderer.send('capture-area', { ...coords, mode }),
  disableBoundingBox: () => ipcRenderer.send('disable-bounding-box'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'), 
});
// END preload.js