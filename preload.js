const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
  getHotkeys: () => ipcRenderer.invoke('get-hotkeys'),
  onToggleBackground: (callback) => ipcRenderer.on('toggle-background', callback),
  resizeWindow: (newWidth, newHeight) => ipcRenderer.send('resize-window', { newWidth, newHeight })
});