import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple integration test approach
describe('UIManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be importable', async () => {
    const { UIManager } = await import('./ui-manager.js');
    expect(UIManager).toBeDefined();
    expect(typeof UIManager).toBe('function');
  });

  it('should create an instance', async () => {
    const { UIManager } = await import('./ui-manager.js');
    const manager = new UIManager();
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(UIManager);
  });

  it('should have required methods', async () => {
    const { UIManager } = await import('./ui-manager.js');
    const manager = new UIManager();
    
    expect(typeof manager.setWindowActive).toBe('function');
    expect(typeof manager.resetActiveTimer).toBe('function');
    expect(typeof manager.showHotkeysModal).toBe('function');
    expect(typeof manager.hideHotkeysModal).toBe('function');
    expect(typeof manager.updateBackgroundRemovalButton).toBe('function');
  });

  it('should handle missing DOM elements gracefully', async () => {
    // Mock document.getElementById to return null
    const mockGetElementById = vi.fn(() => null);
    
    Object.defineProperty(global, 'document', {
      value: { getElementById: mockGetElementById },
      configurable: true
    });

    Object.defineProperty(global, 'console', {
      value: { log: vi.fn(), error: vi.fn() },
      configurable: true
    });

    const { UIManager } = await import('./ui-manager.js');
    const manager = new UIManager();
    
    // These should not throw when elements are missing
    expect(() => manager.setWindowActive(true)).not.toThrow();
    expect(() => manager.updateBackgroundRemovalButton(true)).not.toThrow();
  });

  it('should log appropriate messages', async () => {
    const mockConsole = { log: vi.fn(), error: vi.fn() };
    
    Object.defineProperty(global, 'console', {
      value: mockConsole,
      configurable: true
    });

    Object.defineProperty(global, 'document', {
      value: { getElementById: vi.fn(() => null) },
      configurable: true
    });

    const { UIManager } = await import('./ui-manager.js');
    const manager = new UIManager();
    
    manager.setWindowActive(true);
    
    expect(mockConsole.error).toHaveBeenCalledWith('❌ Container element not found');
  });
});