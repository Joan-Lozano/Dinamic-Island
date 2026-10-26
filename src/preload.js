const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('island', {
  onMedia: (cb) => {
    ipcRenderer.on('media:state', (_e, s) => cb(s));
    ipcRenderer.invoke('media:get').then(cb);
  },
  onSystem: (cb) => ipcRenderer.on('system:sample', (_e, s) => cb(s)),
  media: (cmd, value) => ipcRenderer.send('media:cmd', cmd, value),
  watchSystem: (on) => ipcRenderer.send('system:watch', !!on),
  setInteractive: (on) => ipcRenderer.send('island:interactive', !!on),
});
