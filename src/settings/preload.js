const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  reset: () => ipcRenderer.invoke('settings:reset'),
  onChange: (cb) => ipcRenderer.on('settings:changed', (_e, s) => cb(s)),
  identify: () => ipcRenderer.send('settings:identify'),
  quit: () => ipcRenderer.send('settings:quit'),
});
