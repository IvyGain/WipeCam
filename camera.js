import { CameraDevice } from './types.js';

export class CameraManager {
  private stream: MediaStream | null = null;
  private availableCameras: CameraDevice[] = [];
  private currentCameraId: string | null = null;

  async getCameraDevices(): Promise<CameraDevice[]> {
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (permissionError) {
        console.warn('Camera permission not granted:', permissionError);
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      this.availableCameras = videoDevices.map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `カメラ ${index + 1}`
      }));
      
      console.log('Available cameras:', this.availableCameras);
      return this.availableCameras;
    } catch (error) {
      console.error('Failed to get camera devices:', error);
      return [];
    }
  }

  async startCamera(deviceId?: string): Promise<MediaStream> {
    try {
      if (this.stream) {
        this.stopCamera();
      }

      const savedDeviceId = deviceId || localStorage.getItem('selectedCameraId') || undefined;

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: savedDeviceId ? undefined : 'user',
          deviceId: savedDeviceId ? { exact: savedDeviceId } : undefined
        }
      };

      console.log('Starting camera with constraints:', constraints);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentCameraId = savedDeviceId || null;
      
      return this.stream;
    } catch (error) {
      console.error('Error starting camera:', error);
      
      if (deviceId || localStorage.getItem('selectedCameraId')) {
        console.log('Retrying with default camera...');
        localStorage.removeItem('selectedCameraId');
        return this.startCamera();
      }
      
      throw error;
    }
  }

  async startCameraWithMacOSBackground(deviceId?: string): Promise<MediaStream> {
    try {
      console.log('🎆 Starting camera with macOS background processing:', deviceId);
      
      if (this.stream) {
        this.stopCamera();
      }

      const savedDeviceId = deviceId || localStorage.getItem('selectedCameraId') || undefined;
      
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 },
          facingMode: savedDeviceId ? undefined : 'user',
          deviceId: savedDeviceId ? { exact: savedDeviceId } : undefined
        }
      };
      
      console.log('🔧 Getting camera stream...');
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentCameraId = savedDeviceId || null;
      
      console.log('✨ macOS background camera setup completed!');
      return this.stream;
      
    } catch (error) {
      console.error('❌ macOS background processing setup failed:', error);
      throw error;
    }
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  getAvailableCameras(): CameraDevice[] {
    return this.availableCameras;
  }

  getCurrentCameraId(): string | null {
    return this.currentCameraId;
  }
}