const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
  changeSize: () => ipcRenderer.send('change-size'),
  getCurrentSize: () => ipcRenderer.invoke('get-current-size'),
  getHotkeys: () => ipcRenderer.invoke('get-hotkeys'),
  onToggleBackground: (callback) => ipcRenderer.on('toggle-background', callback),
  onSizeChanged: (callback) => ipcRenderer.on('size-changed', callback)
});