'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('relayDesktop', {
  getState: () => ipcRenderer.invoke('relay:get-state'),
  saveSettings: (payload) => ipcRenderer.invoke('relay:save-settings', payload || {}),
  restartRelay: () => ipcRenderer.invoke('relay:restart-relay'),
  restartApp: () => ipcRenderer.invoke('relay:restart-app'),
  onStateChanged: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const listener = (_event, payload) => handler(payload || {});
    ipcRenderer.on('relay:state-changed', listener);
    return () => ipcRenderer.removeListener('relay:state-changed', listener);
  },
});

