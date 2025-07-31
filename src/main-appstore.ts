import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 400,
    minHeight: 300,
    maxWidth: 1920,
    maxHeight: 1080,
    transparent: false, // AppStoreでは透明ウィンドウは禁止
    frame: true, // 通常のウィンドウフレームを使用
    alwaysOnTop: false, // AppStoreでは常時最前面表示は禁止
    hasShadow: true,
    resizable: true,
    movable: true,
    show: false, // 初期状態では非表示
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      sandbox: true // サンドボックスを有効化
    }
  });

  // ウィンドウが準備できてから表示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

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

// IPCイベントハンドラー
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-name', () => {
  return app.getName();
});

// ファイル保存ダイアログ
ipcMain.handle('show-save-dialog', async (event, options) => {
  if (!mainWindow) return null;
  
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '画像を保存',
    defaultPath: 'wipecam-image.png',
    filters: [
      { name: 'PNG画像', extensions: ['png'] },
      { name: 'JPEG画像', extensions: ['jpg', 'jpeg'] },
      { name: 'すべてのファイル', extensions: ['*'] }
    ]
  });
  
  return result;
});

// アプリケーションイベント
app.whenReady().then(() => {
  console.log('🚀 WipeCam AppStore版を起動中...');
  createWindow();

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

// セキュリティ警告の無効化（開発時のみ）
if (process.env.NODE_ENV === 'development') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

console.log('📱 AppStore対応版 WipeCam メインプロセス開始'); 