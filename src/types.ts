export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface HotkeyMap {
  [key: string]: string;
}

export interface SegmentationResult {
  image: HTMLImageElement | HTMLVideoElement;
  segmentationMask: HTMLImageElement | HTMLCanvasElement;
}

export interface ElectronAPI {
  closeWindow(): void;
  moveWindow(x: number, y: number): void;
  resizeWindow(width: number, height: number): void;
  getHotkeys(): Promise<HotkeyMap>;
  onToggleBackground(callback: () => void): void;
  onWindowResized(callback: (event: any, size: WindowSize) => void): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}