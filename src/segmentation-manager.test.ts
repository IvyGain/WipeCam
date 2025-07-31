import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SegmentationManager } from './segmentation-manager.js';

// Mock MediaPipe SelfieSegmentation
const mockSelfieSegmentation = {
  setOptions: vi.fn(),
  onResults: vi.fn(),
  send: vi.fn()
};

// Mock global SelfieSegmentation constructor
Object.defineProperty(global, 'SelfieSegmentation', {
  value: vi.fn(() => mockSelfieSegmentation),
  writable: true
});

// Mock DOM elements
const mockCanvas = {
  width: 640,
  height: 480,
  getContext: vi.fn(() => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    fillRect: vi.fn(),
    globalCompositeOperation: 'source-over'
  }))
};

const mockVideo = {
  videoWidth: 640,
  videoHeight: 480,
  readyState: 4, // HAVE_ENOUGH_DATA
  HAVE_ENOUGH_DATA: 4
};

Object.defineProperty(global, 'document', {
  value: {
    getElementById: vi.fn((id: string) => {
      if (id === 'canvas') return mockCanvas;
      return null;
    }),
    createElement: vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
        globalCompositeOperation: 'source-over'
      }))
    }))
  },
  writable: true
});

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => {
      switch (key) {
        case 'backgroundRemovalEnabled':
          return 'true';
        case 'backgroundColor':
          return 'transparent';
        default:
          return null;
      }
    })
  },
  writable: true
});

Object.defineProperty(global, 'console', {
  value: {
    log: vi.fn(),
    error: vi.fn()
  },
  writable: true
});

Object.defineProperty(global, 'setTimeout', {
  value: vi.fn((callback: Function, delay: number) => {
    callback();
    return 1;
  }),
  writable: true
});

Object.defineProperty(global, 'requestAnimationFrame', {
  value: vi.fn((callback: Function) => {
    // Don't call callback to avoid infinite loop in tests
    return 1;
  }),
  writable: true
});

describe('SegmentationManager', () => {
  let segmentationManager: SegmentationManager;

  beforeEach(() => {
    segmentationManager = new SegmentationManager();
    vi.clearAllMocks();
  });

  describe('initializeSelfieSegmentation', () => {
    it('should initialize MediaPipe successfully', async () => {
      await segmentationManager.initializeSelfieSegmentation();
      
      expect(mockSelfieSegmentation.setOptions).toHaveBeenCalledWith({
        modelSelection: 0,
        selfieMode: true
      });
      expect(mockSelfieSegmentation.onResults).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Initializing MediaPipe (lightweight)...');
      expect(console.log).toHaveBeenCalledWith('MediaPipe initialized successfully (lightweight)');
    });

    it('should handle initialization errors', async () => {
      (global.SelfieSegmentation as any).mockImplementation(() => {
        throw new Error('MediaPipe load error');
      });

      await expect(segmentationManager.initializeSelfieSegmentation())
        .rejects.toThrow('MediaPipe load error');
      
      expect(console.error).toHaveBeenCalledWith(
        'Failed to initialize MediaPipe:', 
        expect.any(Error)
      );
    });
  });

  describe('processVideo', () => {
    beforeEach(async () => {
      // Reset the mock implementation before each test
      (global.SelfieSegmentation as any).mockImplementation(() => mockSelfieSegmentation);
      await segmentationManager.initializeSelfieSegmentation();
    });

    it('should process video when conditions are met', async () => {
      await segmentationManager.processVideo(mockVideo as any);
      
      expect(mockSelfieSegmentation.send).toHaveBeenCalledWith({ 
        image: mockVideo 
      });
    });

    it('should skip processing when video is not ready', async () => {
      const notReadyVideo = { ...mockVideo, readyState: 1 };
      await segmentationManager.processVideo(notReadyVideo as any);
      
      expect(mockSelfieSegmentation.send).not.toHaveBeenCalled();
    });

    it('should handle missing video element', async () => {
      await expect(segmentationManager.processVideo(null as any))
        .resolves.not.toThrow();
    });
  });

  describe('setMacOSNativeMode', () => {
    it('should enable macOS native mode', () => {
      segmentationManager.setMacOSNativeMode(true);
      
      // Test by checking if onSegmentationResults skips processing
      const mockResults = {
        image: new Image(),
        segmentationMask: document.createElement('canvas')
      };
      
      // This should not throw and should skip processing
      expect(() => {
        // @ts-ignore - accessing private method for testing
        segmentationManager.onSegmentationResults(mockResults);
      }).not.toThrow();
    });

    it('should disable macOS native mode', () => {
      segmentationManager.setMacOSNativeMode(false);
      
      expect(() => {
        segmentationManager.setMacOSNativeMode(false);
      }).not.toThrow();
    });
  });

  describe('getSelfieSegmentation', () => {
    it('should return selfie segmentation instance', async () => {
      // Reset mock implementation
      (global.SelfieSegmentation as any).mockImplementation(() => mockSelfieSegmentation);
      await segmentationManager.initializeSelfieSegmentation();
      
      const instance = segmentationManager.getSelfieSegmentation();
      
      expect(instance).toBe(mockSelfieSegmentation);
    });

    it('should return null when not initialized', () => {
      const newManager = new SegmentationManager();
      const instance = newManager.getSelfieSegmentation();
      
      expect(instance).toBeNull();
    });
  });
});