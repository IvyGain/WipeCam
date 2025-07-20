const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
  getHotkeys: () => ipcRenderer.invoke('get-hotkeys'),
  onToggleBackground: (callback) => ipcRenderer.on('toggle-background', callback),
  startResize: (direction) => ipcRenderer.send('start-resize', direction),
  resizeWindow: (direction, deltaX, deltaY) => ipcRenderer.send('resize-window', { direction, deltaX, deltaY }),
  onResizeStarted: (callback) => ipcRenderer.on('resize-started', callback)
});