import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CameraManager } from './camera.js';

// Mock MediaDevices API
const mockStream = {
  getTracks: vi.fn(() => [
    { stop: vi.fn() }
  ])
};

const mockVideoDevice = {
  deviceId: 'camera1',
  kind: 'videoinput',
  label: 'Test Camera'
};

Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: vi.fn(),
      enumerateDevices: vi.fn()
    }
  },
  writable: true
});

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  },
  writable: true
});

Object.defineProperty(global, 'console', {
  value: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  writable: true
});

describe('CameraManager', () => {
  let cameraManager: CameraManager;

  beforeEach(() => {
    cameraManager = new CameraManager();
    vi.clearAllMocks();
  });

  describe('getCameraDevices', () => {
    it('should return available camera devices', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);
      (navigator.mediaDevices.enumerateDevices as any).mockResolvedValue([
        mockVideoDevice,
        { deviceId: 'audio1', kind: 'audioinput', label: 'Test Mic' }
      ]);

      const devices = await cameraManager.getCameraDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual({
        deviceId: 'camera1',
        label: 'Test Camera'
      });
    });

    it('should handle permission errors gracefully', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(new Error('Permission denied'));
      (navigator.mediaDevices.enumerateDevices as any).mockResolvedValue([mockVideoDevice]);

      const devices = await cameraManager.getCameraDevices();

      expect(console.warn).toHaveBeenCalledWith('Camera permission not granted:', expect.any(Error));
      expect(devices).toHaveLength(1);
    });

    it('should handle enumeration errors', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);
      (navigator.mediaDevices.enumerateDevices as any).mockRejectedValue(new Error('Enumeration failed'));

      const devices = await cameraManager.getCameraDevices();

      expect(console.error).toHaveBeenCalledWith('Failed to get camera devices:', expect.any(Error));
      expect(devices).toEqual([]);
    });
  });

  describe('startCamera', () => {
    it('should start camera with default constraints', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);

      const stream = await cameraManager.startCamera();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
          deviceId: undefined
        }
      });
      expect(stream).toBe(mockStream);
    });

    it('should start camera with specific device ID', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);

      await cameraManager.startCamera('camera1');

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: undefined,
          deviceId: { exact: 'camera1' }
        }
      });
    });

    it('should retry with default camera on device error', async () => {
      (localStorage.getItem as any).mockReturnValue('invalid-device');
      (navigator.mediaDevices.getUserMedia as any)
        .mockRejectedValueOnce(new Error('Device not found'))
        .mockResolvedValueOnce(mockStream);

      const stream = await cameraManager.startCamera();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
      expect(localStorage.removeItem).toHaveBeenCalledWith('selectedCameraId');
      expect(stream).toBe(mockStream);
    });
  });

  describe('stopCamera', () => {
    it('should stop all tracks in the stream', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);
      
      await cameraManager.startCamera();
      cameraManager.stopCamera();

      expect(mockStream.getTracks).toHaveBeenCalled();
    });

    it('should handle stopping when no stream exists', () => {
      expect(() => {
        cameraManager.stopCamera();
      }).not.toThrow();
    });
  });
});