import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
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

  // ウィンドウリサイズイベントを監視
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      console.log('Window resized to:', width, 'x', height);
      mainWindow.webContents.send('window-resized', { width, height });
    }
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


ipcMain.on('resize-window', (event, { newWidth, newHeight }) => {
  if (!mainWindow) return;
  
  // サイズ制限を適用
  const width = Math.max(160, Math.min(3840, newWidth));
  const height = Math.max(120, Math.min(2160, newHeight));
  
  // ウィンドウサイズを設定
  mainWindow.setSize(Math.round(width), Math.round(height));
});