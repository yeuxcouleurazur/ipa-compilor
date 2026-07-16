const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  startBuild: (options) => ipcRenderer.send('start-build', options),
  cancelBuild: () => ipcRenderer.send('cancel-build'),
  onBuildLog: (callback) => ipcRenderer.on('build-log', (_event, value) => callback(value)),
  onBuildFinished: (callback) => ipcRenderer.on('build-finished', (_event, success) => callback(success)),
});
