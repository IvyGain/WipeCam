import { describe, test, expect, vi } from 'vitest';
import { CameraManager } from './camera';

// Mock navigator.mediaDevices
global.navigator = {
  mediaDevices: {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn(),
  },
} as any;

describe('CameraManager', () => {
  test('should initialize camera stream', async () => {
    const mockStream = {
      id: 'test-stream',
      active: true,
      getTracks: vi.fn(() => []),
    };
    
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(mockStream as any);
    
    const camera = new CameraManager();
    const stream = await camera.startCamera();
    
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
    });
    expect(stream).toBe(mockStream);
  });

  test('should handle camera permission denied', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new Error('Permission denied')
    );
    
    const camera = new CameraManager();
    await expect(camera.startCamera()).rejects.toThrow('Permission denied');
  });

  test('should stop camera stream', async () => {
    const mockTrack = {
      stop: vi.fn(),
    };
    const mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    };
    
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(mockStream as any);
    
    const camera = new CameraManager();
    await camera.startCamera();
    camera.stopCamera();
    
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});