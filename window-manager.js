import { BrowserWindow, app } from 'electron';

export class WindowManager {
  window: BrowserWindow | null = null;

  async createTransparentWindow(): Promise<BrowserWindow> {
    this.window = new BrowserWindow({
      width: 320,
      height: 240,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      hasShadow: false,
      resizable: true,
      movable: true,
      focusable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.setVisibleOnAllWorkspaces(true);
    this.window.setSkipTaskbar(true);

    this.window.on('closed', () => {
      this.window = null;
    });

    return this.window;
  }
}