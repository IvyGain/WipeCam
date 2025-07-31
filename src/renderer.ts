import { CameraManager } from './camera.js';
import { SegmentationManager } from './segmentation-manager.js';
import { UIManager } from './ui-manager.js';
import { WindowSize } from './types.js';

class WipeCamApp {
  private cameraManager = new CameraManager();
  private segmentationManager = new SegmentationManager();
  private uiManager = new UIManager();
  
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  
  private backgroundRemovalEnabled = false;
  private backgroundColor = 'transparent';
  private isInitializing = false;
  private isProcessingModeSwitch = false;
  private isUsingMacOSNative = false;

  async initialize(): Promise<void> {
    try {
      console.log('DOM loaded, starting lightweight initialization...');
      
      this.isInitializing = true;
      this.setupElements();
      this.initializeSettings();
      this.initializeResizeHandles();
      this.setupEventListeners();
      
      this.restoreSettings();
      
      console.log('Initializing MediaPipe (lightweight)...');
      await this.segmentationManager.initializeSelfieSegmentation();
      console.log('MediaPipe initialization complete (lightweight)');
      
      console.log('Initializing camera select (lightweight)...');
      await this.initializeCameraSelect();
      
      const savedCameraId = localStorage.getItem('selectedCameraId');
      console.log('Starting camera (lightweight) with saved ID:', savedCameraId);
      await this.startCamera(savedCameraId);
      
      this.uiManager.updateBackgroundRemovalButton(this.backgroundRemovalEnabled);
      this.isInitializing = false;
      
      console.log('All initialization complete (lightweight)');
      
    } catch (error) {
      console.error('Initialization failed (lightweight):', error);
      this.isInitializing = false;
      alert('アプリの初期化に失敗しました: ' + (error as Error).message);
    }
  }

  private setupElements(): void {
    this.videoElement = document.getElementById('video') as HTMLVideoElement;
    this.canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
    this.canvasCtx = this.canvasElement?.getContext('2d') || null;
  }

  private restoreSettings(): void {
    const savedBackgroundRemoval = localStorage.getItem('backgroundRemovalEnabled');
    if (savedBackgroundRemoval === 'true') {
      this.backgroundRemovalEnabled = true;
      console.log('💾 Restored background removal state:', this.backgroundRemovalEnabled);
    }
    
    const savedBackgroundColor = localStorage.getItem('backgroundColor');
    if (savedBackgroundColor) {
      this.backgroundColor = savedBackgroundColor;
      console.log('Restored background color:', this.backgroundColor);
    }
  }

  private async startCamera(deviceId?: string | null): Promise<void> {
    try {
      if (!this.videoElement || !this.canvasElement) {
        throw new Error('Video or canvas element not found');
      }

      const stream = await this.cameraManager.startCamera(deviceId || undefined);
      this.videoElement.srcObject = stream;
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 5000);
        
        this.videoElement!.onloadedmetadata = () => {
          clearTimeout(timeout);
          console.log('Video loaded (lightweight):', this.videoElement!.videoWidth, 'x', this.videoElement!.videoHeight);
          
          const container = document.getElementById('container');
          const containerWidth = container ? container.offsetWidth : 960;
          const containerHeight = container ? container.offsetHeight : 720;
          
          this.updateCanvasSize(containerWidth, containerHeight);
          resolve();
        };
        
        this.videoElement!.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video load error'));
        };
      });
      
      if (this.segmentationManager.getSelfieSegmentation()) {
        console.log('Starting video processing (lightweight)...');
        this.isUsingMacOSNative = false;
        this.segmentationManager.setMacOSNativeMode(false);
        this.segmentationManager.processVideo(this.videoElement);
        
        const bgButton = document.getElementById('toggle-bg') as HTMLButtonElement;
        if (bgButton) {
          bgButton.style.pointerEvents = 'auto';
          this.uiManager.updateBackgroundRemovalButton(this.backgroundRemovalEnabled);
        }
      } else {
        throw new Error('MediaPipe not initialized');
      }
      
      console.log('Camera started successfully (lightweight)');
      
    } catch (error) {
      console.error('Error accessing camera (lightweight):', error);
      
      if (deviceId || localStorage.getItem('selectedCameraId')) {
        console.log('Retrying with default camera...');
        localStorage.removeItem('selectedCameraId');
        return this.startCamera(null);
      }
      
      alert(`カメラへのアクセスに失敗しました: ${(error as Error).message}\nカメラの権限を確認してください。`);
      throw error;
    }
  }

  private toggleBackgroundRemoval(): void {
    if (this.isProcessingModeSwitch || this.isInitializing) {
      console.log('⚠️ Background removal toggle blocked - processing in progress');
      return;
    }
    
    this.backgroundRemovalEnabled = !this.backgroundRemovalEnabled;
    
    console.log('🎭 Background removal toggled to:', this.backgroundRemovalEnabled);
    
    this.uiManager.updateBackgroundRemovalButton(this.backgroundRemovalEnabled);
    localStorage.setItem('backgroundRemovalEnabled', this.backgroundRemovalEnabled.toString());
  }

  private async initializeCameraSelect(): Promise<void> {
    const cameraSelect = document.getElementById('camera-select') as HTMLSelectElement;
    
    try {
      await this.cameraManager.getCameraDevices();
      const availableCameras = this.cameraManager.getAvailableCameras();
      
      cameraSelect.innerHTML = '';
      
      if (availableCameras.length === 0) {
        cameraSelect.innerHTML = '<option value="">カメラが見つかりません</option>';
        return;
      }
      
      cameraSelect.innerHTML = '<option value="">デフォルトカメラ</option>';
      
      availableCameras.forEach(camera => {
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.textContent = camera.label;
        cameraSelect.appendChild(option);
      });
      
      cameraSelect.addEventListener('change', async (e) => {
        e.stopPropagation();
        const target = e.target as HTMLSelectElement;
        const selectedDeviceId = target.value || null;
        console.log('Switching to camera:', selectedDeviceId);
        await this.startCamera(selectedDeviceId);
        
        if (selectedDeviceId) {
          localStorage.setItem('selectedCameraId', selectedDeviceId);
        } else {
          localStorage.removeItem('selectedCameraId');
        }
      });
      
      const savedCameraId = localStorage.getItem('selectedCameraId');
      if (savedCameraId && availableCameras.some(camera => camera.deviceId === savedCameraId)) {
        cameraSelect.value = savedCameraId;
        console.log('Restoring saved camera:', savedCameraId);
      }
      
    } catch (error) {
      console.error('Failed to initialize camera select:', error);
      cameraSelect.innerHTML = '<option value="">カメラの取得に失敗</option>';
    }
  }

  private initializeSettings(): void {
    const colorButtons = document.querySelectorAll('.color-btn');
    const customColorPicker = document.getElementById('custom-color') as HTMLInputElement;
    
    colorButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        colorButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.backgroundColor = btn.getAttribute('data-color') || 'transparent';
        console.log('🎨 Background color changed to:', this.backgroundColor);
        
        localStorage.setItem('backgroundColor', this.backgroundColor);
      });
    });
    
    if (customColorPicker) {
      customColorPicker.addEventListener('change', (e) => {
        e.stopPropagation();
        
        colorButtons.forEach(b => b.classList.remove('active'));
        
        const target = e.target as HTMLInputElement;
        this.backgroundColor = target.value;
        console.log('🎨 Custom background color changed to:', this.backgroundColor);
        
        localStorage.setItem('backgroundColor', this.backgroundColor);
      });
    }
    
    if (this.backgroundColor) {
      const matchingBtn = document.querySelector(`[data-color="${this.backgroundColor}"]`);
      if (matchingBtn) {
        colorButtons.forEach(b => b.classList.remove('active'));
        matchingBtn.classList.add('active');
      } else {
        customColorPicker.value = this.backgroundColor;
      }
    }
  }

  private updateCanvasSize(width: number, height: number): void {
    if (!this.canvasElement || !this.videoElement) {
      console.warn('⚠️ Canvas or video element not found for resize');
      return;
    }
    
    console.log('📹 Updating canvas size to:', width, 'x', height);
    
    let videoAspect = 16/9;
    if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
      videoAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;
    }
    
    const containerAspect = width / height;
    
    let displayWidth: number, displayHeight: number;
    let canvasWidth: number, canvasHeight: number;
    
    if (videoAspect > containerAspect) {
      displayWidth = width;
      displayHeight = width / videoAspect;
      canvasWidth = width;
      canvasHeight = Math.round(width / videoAspect);
    } else {
      displayHeight = height;
      displayWidth = height * videoAspect;
      canvasHeight = height;
      canvasWidth = Math.round(height * videoAspect);
    }
    
    this.canvasElement.style.width = displayWidth + 'px';
    this.canvasElement.style.height = displayHeight + 'px';
    this.videoElement.style.width = displayWidth + 'px';
    this.videoElement.style.height = displayHeight + 'px';
    
    this.canvasElement.style.position = 'absolute';
    this.canvasElement.style.left = '50%';
    this.canvasElement.style.top = '50%';
    this.canvasElement.style.transform = 'translate(-50%, -50%)';
    
    this.videoElement.style.position = 'absolute';
    this.videoElement.style.left = '50%';
    this.videoElement.style.top = '50%';
    this.videoElement.style.transform = 'translate(-50%, -50%)';
    
    this.canvasElement.width = canvasWidth;
    this.canvasElement.height = canvasHeight;
    
    console.log('📹 Canvas size set with aspect ratio maintained:', canvasWidth, 'x', canvasHeight);
  }

  private initializeResizeHandles(): void {
    const resizeHandles = document.querySelectorAll('.resize-handle');
    const container = document.getElementById('container')!;
    let isResizing = false;
    let currentDirection: string | null = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let aspectRatio = 4/3;
    
    resizeHandles.forEach(handle => {
      const direction = (handle as HTMLElement).dataset.direction!;
      
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isResizing = true;
        currentDirection = direction;
        startX = (e as MouseEvent).screenX;
        startY = (e as MouseEvent).screenY;
        
        const rect = container.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        aspectRatio = startWidth / startHeight;
        
        document.body.style.cursor = getComputedStyle(handle as Element).cursor;
        document.body.style.userSelect = 'none';
      });
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing || !currentDirection) return;
      
      e.preventDefault();
      
      const deltaX = e.screenX - startX;
      const deltaY = e.screenY - startY;
      
      let newWidth: number, newHeight: number;
      
      switch (currentDirection) {
        case 'nw':
        case 'sw':
          newWidth = Math.max(160, startWidth - deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'ne':
        case 'se':
          newWidth = Math.max(160, startWidth + deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        default:
          return;
      }
      
      if (newHeight < 120) {
        newHeight = 120;
        newWidth = newHeight * aspectRatio;
      }
      
      if (newWidth > 3840) {
        newWidth = 3840;
        newHeight = newWidth / aspectRatio;
      }
      if (newHeight > 2160) {
        newHeight = 2160;
        newWidth = newHeight * aspectRatio;
      }
      
      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
      
      this.updateCanvasSize(newWidth, newHeight);
      window.electronAPI.resizeWindow(newWidth, newHeight);
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        currentDirection = null;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
      }
    });
  }

  private setupEventListeners(): void {
    document.getElementById('toggle-bg')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.uiManager.setWindowActive(true, 'button-click');
      this.toggleBackgroundRemoval();
    });
    
    document.getElementById('show-hotkeys')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.uiManager.setWindowActive(true, 'button-click');
      this.uiManager.showHotkeysModal();
    });
    
    document.getElementById('close-modal')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.uiManager.setWindowActive(true, 'button-click');
      this.uiManager.hideHotkeysModal();
    });
    
    document.getElementById('close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.uiManager.resetActiveTimer();
      this.closeWindow();
    });

    window.electronAPI.onToggleBackground(() => {
      console.log('⌨️ Hotkey triggered for background removal toggle');
      this.uiManager.setWindowActive(true, 'hotkey-triggered');
      this.toggleBackgroundRemoval();
    });

    window.electronAPI.onWindowResized((event, { width, height }: WindowSize) => {
      console.log('📹 Window resized event received:', width, 'x', height);
      const container = document.getElementById('container');
      if (container) {
        container.style.width = width + 'px';
        container.style.height = height + 'px';
        this.updateCanvasSize(width, height);
      }
    });

    this.setupDragAndClick();
  }

  private setupDragAndClick(): void {
    let isDragging = false;
    let initialX: number;
    let initialY: number;
    
    const container = document.getElementById('container')!;
    
    container.addEventListener('click', (e) => {
      if (this.isControlElement(e.target as Element)) return;
      
      e.stopPropagation();
      console.log('📺 Container left-clicked - activating window');
      this.uiManager.setWindowActive(true, 'container-click');
    });
    
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target as Node)) {
        console.log('📺 Outside click detected - deactivating window');
        this.uiManager.setWindowActive(false, 'outside-click');
      }
    });
    
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.isControlElement(e.target as Element)) return;
      
      this.uiManager.setWindowActive(true, 'drag-start');
      
      initialX = e.clientX;
      initialY = e.clientY;
      isDragging = true;
      container.style.cursor = 'move';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      e.preventDefault();
      const currentX = e.clientX - initialX;
      const currentY = e.clientY - initialY;
      
      window.electronAPI.moveWindow(currentX, currentY);
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
      container.style.cursor = 'default';
    });
  }

  private isControlElement(element: Element): boolean {
    return element.tagName === 'BUTTON' || 
           element.classList.contains('resize-handle') ||
           element.closest('.settings-panel') !== null ||
           element.closest('#controls') !== null ||
           element.tagName === 'INPUT' ||
           element.tagName === 'SELECT' ||
           element.tagName === 'LABEL';
  }

  private closeWindow(): void {
    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    window.electronAPI.closeWindow();
  }
}

const app = new WipeCamApp();

document.addEventListener('DOMContentLoaded', () => {
  app.initialize();
});