import { SegmentationResult } from './types.js';

export class SegmentationManager {
  private selfieSegmentation: any = null;
  private isUsingMacOSNative = false;
  
  async initializeSelfieSegmentation(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Initializing MediaPipe (lightweight)...');
        
        // @ts-ignore - MediaPipe library loaded via script
        this.selfieSegmentation = new SelfieSegmentation({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
          }
        });

        this.selfieSegmentation.setOptions({
          modelSelection: 0,
          selfieMode: true,
        });

        this.selfieSegmentation.onResults((results: SegmentationResult) => {
          this.onSegmentationResults(results);
        });
        
        setTimeout(() => {
          console.log('MediaPipe initialized successfully (lightweight)');
          resolve();
        }, 1000);
        
      } catch (error) {
        console.error('Failed to initialize MediaPipe:', error);
        reject(error);
      }
    });
  }

  private onSegmentationResults(results: SegmentationResult): void {
    const canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
    const canvasCtx = canvasElement?.getContext('2d');
    
    if (!canvasElement || !canvasCtx) return;
    
    if (this.isUsingMacOSNative) {
      console.log('🎆 Skipping MediaPipe - using macOS native processing');
      return;
    }

    const backgroundRemovalEnabled = localStorage.getItem('backgroundRemovalEnabled') === 'true';
    const backgroundColor = localStorage.getItem('backgroundColor') || 'transparent';

    console.log('🤖 MediaPipe processing - backgroundRemovalEnabled:', backgroundRemovalEnabled, 'backgroundColor:', backgroundColor);

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (backgroundRemovalEnabled && results.segmentationMask) {
      console.log('🎨 Applying background removal with segmentation');
      this.processFastSegmentation(results, canvasCtx, canvasElement, backgroundColor);
    } else {
      console.log('🖼️ Normal rendering with backgroundColor:', backgroundColor);
      
      if (backgroundColor !== 'transparent') {
        canvasCtx.fillStyle = backgroundColor;
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      }
      
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }
  }

  private processFastSegmentation(
    results: SegmentationResult, 
    canvasCtx: CanvasRenderingContext2D, 
    canvasElement: HTMLCanvasElement, 
    backgroundColor: string
  ): void {
    const { image, segmentationMask } = results;
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (backgroundColor === 'transparent') {
      canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.globalCompositeOperation = 'destination-in';
      canvasCtx.drawImage(segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.globalCompositeOperation = 'source-over';
    } else {
      canvasCtx.fillStyle = backgroundColor;
      canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasElement.width;
      tempCanvas.height = canvasElement.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      
      tempCtx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(segmentationMask, 0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.globalCompositeOperation = 'source-over';
      
      canvasCtx.drawImage(tempCanvas, 0, 0);
    }
  }

  async processVideo(videoElement: HTMLVideoElement): Promise<void> {
    if (!videoElement || !this.selfieSegmentation) return;
    
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
      await this.selfieSegmentation.send({ image: videoElement });
    }
    
    requestAnimationFrame(() => this.processVideo(videoElement));
  }

  setMacOSNativeMode(enabled: boolean): void {
    this.isUsingMacOSNative = enabled;
  }

  getSelfieSegmentation(): any {
    return this.selfieSegmentation;
  }
}