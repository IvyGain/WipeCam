import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 240,
    minWidth: 160,
    minHeight: 120,
    maxWidth: 1200,
    maxHeight: 900,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    movable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setSkipTaskbar(true);

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerGlobalShortcuts() {
  try {
    // ホットキー: Ctrl+Shift+W - ウィンドウの表示/非表示
    const registered1 = globalShortcut.register('CommandOrControl+Shift+W', () => {
      console.log('Hotkey triggered: Show/Hide window');
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    });
    console.log('CommandOrControl+Shift+W registered:', registered1);

    // ホットキー: Ctrl+Shift+B - 背景除去のトグル
    const registered2 = globalShortcut.register('CommandOrControl+Shift+B', () => {
      console.log('Hotkey triggered: Toggle background');
      if (mainWindow) {
        mainWindow.webContents.send('toggle-background');
      }
    });
    console.log('CommandOrControl+Shift+B registered:', registered2);

    // ホットキー: Ctrl+Shift+S - サイズ変更（無効化）
    // changeSizePreset関数はもう使わないのでコメントアウト
    /*
    const registered3 = globalShortcut.register('CommandOrControl+Shift+S', () => {
      console.log('Hotkey triggered: Change size');
      if (mainWindow) {
        changeSizePreset();
      }
    });
    console.log('CommandOrControl+Shift+S registered:', registered3);
    */

    // ホットキー: Ctrl+Shift+Q - アプリ終了
    const registered4 = globalShortcut.register('CommandOrControl+Shift+Q', () => {
      console.log('Hotkey triggered: Quit app');
      app.quit();
    });
    console.log('CommandOrControl+Shift+Q registered:', registered4);
    
  } catch (error) {
    console.error('Failed to register global shortcuts:', error);
  }
}


app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC handlers
ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('move-window', (event, { x, y }) => {
  if (mainWindow) {
    const [currentX, currentY] = mainWindow.getPosition();
    mainWindow.setPosition(currentX + x, currentY + y);
  }
});


ipcMain.handle('get-hotkeys', () => {
  return {
    'Ctrl+Shift+W': 'ウィンドウの表示/非表示',
    'Ctrl+Shift+B': '背景除去のON/OFF',
    'Ctrl+Shift+Q': 'アプリ終了'
  };
});

ipcMain.on('start-resize', (event, direction) => {
  if (mainWindow) {
    mainWindow.webContents.send('resize-started', direction);
  }
});

ipcMain.on('resize-window', (event, { direction, deltaX, deltaY }) => {
  if (!mainWindow) return;
  
  const [currentWidth, currentHeight] = mainWindow.getSize();
  const [currentX, currentY] = mainWindow.getPosition();
  
  let newWidth = currentWidth;
  let newHeight = currentHeight;
  let newX = currentX;
  let newY = currentY;
  
  switch (direction) {
    case 'nw':
      newWidth = Math.max(160, currentWidth - deltaX);
      newHeight = Math.max(120, currentHeight - deltaY);
      newX = currentX + (currentWidth - newWidth);
      newY = currentY + (currentHeight - newHeight);
      break;
    case 'ne':
      newWidth = Math.max(160, currentWidth + deltaX);
      newHeight = Math.max(120, currentHeight - deltaY);
      newY = currentY + (currentHeight - newHeight);
      break;
    case 'sw':
      newWidth = Math.max(160, currentWidth - deltaX);
      newHeight = Math.max(120, currentHeight + deltaY);
      newX = currentX + (currentWidth - newWidth);
      break;
    case 'se':
      newWidth = Math.max(160, currentWidth + deltaX);
      newHeight = Math.max(120, currentHeight + deltaY);
      break;
  }
  
  // 最大サイズ制限
  newWidth = Math.min(1200, newWidth);
  newHeight = Math.min(900, newHeight);
  
  mainWindow.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(newWidth),
    height: Math.round(newHeight)
  });
});