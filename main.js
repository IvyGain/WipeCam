import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let currentSizeIndex = 0;
const sizePresets = [
  { width: 160, height: 120 },   // 極小
  { width: 320, height: 240 },   // 小
  { width: 480, height: 360 },   // 中
  { width: 640, height: 480 },   // 大
  { width: 960, height: 720 }    // 極大
];

function createWindow() {
  const initialSize = sizePresets[currentSizeIndex];
  mainWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
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
  // ホットキー: Ctrl+Shift+W - ウィンドウの表示/非表示
  globalShortcut.register('CommandOrControl+Shift+W', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });

  // ホットキー: Ctrl+Shift+B - 背景除去のトグル
  globalShortcut.register('CommandOrControl+Shift+B', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-background');
    }
  });

  // ホットキー: Ctrl+Shift+S - サイズ変更
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (mainWindow) {
      changeSizePreset();
    }
  });

  // ホットキー: Ctrl+Shift+Q - アプリ終了
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.quit();
  });
}

function changeSizePreset() {
  if (!mainWindow) return;
  
  currentSizeIndex = (currentSizeIndex + 1) % sizePresets.length;
  const newSize = sizePresets[currentSizeIndex];
  
  mainWindow.setSize(newSize.width, newSize.height);
  mainWindow.webContents.send('size-changed', newSize);
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

ipcMain.on('change-size', () => {
  changeSizePreset();
});

ipcMain.handle('get-current-size', () => {
  return sizePresets[currentSizeIndex];
});

ipcMain.handle('get-hotkeys', () => {
  return {
    'Ctrl+Shift+W': 'ウィンドウの表示/非表示',
    'Ctrl+Shift+B': '背景除去のON/OFF',
    'Ctrl+Shift+S': 'サイズ変更',
    'Ctrl+Shift+Q': 'アプリ終了'
  };
});