const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // File system
  readWorkspace: () => ipcRenderer.invoke('fs:readWorkspace'),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
});
