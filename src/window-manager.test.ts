import { describe, test, expect, vi, beforeEach } from 'vitest';
import { WindowManager } from './window-manager';

// Mock Electron modules
vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    setSkipTaskbar: vi.fn(),
    on: vi.fn(),
    webContents: {
      on: vi.fn(),
    },
  })),
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
  },
}));

describe('WindowManager', () => {
  let windowManager: WindowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    windowManager = new WindowManager();
  });

  test('should create transparent window with correct settings', async () => {
    const window = await windowManager.createTransparentWindow();
    
    expect(window).toBeDefined();
    const BrowserWindow = (await import('electron')).BrowserWindow;
    expect(BrowserWindow).toHaveBeenCalledWith({
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
  });

  test('should set window always on top', async () => {
    const window = await windowManager.createTransparentWindow();
    
    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(window.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true);
  });

  test('should handle window close event', async () => {
    const { app } = await import('electron');
    await windowManager.createTransparentWindow();
    
    const onCall = (windowManager.window!.on as any).mock.calls.find(
      (call: any) => call[0] === 'closed'
    );
    
    expect(onCall).toBeDefined();
    
    // Simulate window close
    if (onCall && onCall[1]) {
      (onCall[1] as Function)();
    }
    
    expect(windowManager.window).toBeNull();
  });
});