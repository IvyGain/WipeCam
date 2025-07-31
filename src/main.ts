import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 160,
    minHeight: 120,
    maxWidth: 3840,
    maxHeight: 2160,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    movable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setSkipTaskbar(true);

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ウィンドウリサイズイベントを監視
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      console.log('Window resized to:', width, 'x', height);
      mainWindow.webContents.send('window-resized', { width, height });
    }
  });
}

function registerGlobalShortcuts(): void {
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
      console.log('🔥 Hotkey triggered: Toggle background removal');
      if (mainWindow && mainWindow.webContents) {
        console.log('📤 Sending toggle-background event to renderer');
        mainWindow.webContents.send('toggle-background');
      } else {
        console.error('❌ MainWindow or webContents not available');
      }
    });
    console.log('CommandOrControl+Shift+B registered:', registered2);

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

// IPCイベントハンドラー
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-name', () => {
  return app.getName();
});

// アプリケーションイベント
app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});