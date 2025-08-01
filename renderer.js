import { CameraManager } from './camera.js';
import { SegmentationManagerAppStore } from './segmentation-manager-appstore.js';
import { UIManager } from './ui-manager.js';

class RendererAppStore {
  private cameraManager: CameraManager;
  private segmentationManager: SegmentationManagerAppStore;
  private uiManager: UIManager;
  private isInitialized = false;

  constructor() {
    this.cameraManager = new CameraManager();
    this.segmentationManager = new SegmentationManagerAppStore();
    this.uiManager = new UIManager();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 AppStore対応版 WipeCam レンダラープロセス開始');
      
      // AppStore版用のUI初期化
      this.initializeAppStoreUI();
      
      // 背景除去機能初期化
      await this.segmentationManager.initializeBackgroundRemoval();
      
      // カメラ初期化
      await this.initializeCamera();
      
      // イベントリスナー設定
      this.setupEventListeners();
      
      // アプリ内ショートカット設定
      this.setupAppShortcuts();
      
      this.isInitialized = true;
      console.log('✅ AppStore対応版 WipeCam 初期化完了');
      
    } catch (error) {
      console.error('❌ AppStore対応版 WipeCam 初期化エラー:', error);
    }
  }

  private initializeAppStoreUI(): void {
    console.log('🎨 AppStore版UI初期化中...');
    
    // カメラステータス表示の初期化
    const statusText = document.getElementById('camera-status-text');
    if (statusText) {
      statusText.textContent = 'カメラ初期化中...';
    }
    
    // コントロールパネルの初期化
    this.initializeControlPanel();
    
    console.log('✅ AppStore版UI初期化完了');
  }

  private initializeControlPanel(): void {
    // 背景除去の初期状態を設定
    const backgroundToggle = document.getElementById('background-toggle') as HTMLInputElement;
    if (backgroundToggle) {
      const savedState = localStorage.getItem('backgroundRemovalEnabled');
      backgroundToggle.checked = savedState === 'true';
    }
    
    // 背景色の初期状態を設定
    const backgroundColorSelect = document.getElementById('background-color') as HTMLSelectElement;
    if (backgroundColorSelect) {
      const savedColor = localStorage.getItem('backgroundColor') || 'transparent';
      backgroundColorSelect.value = savedColor;
    }
    
    // エフェクトの初期状態を設定
    const effectSelect = document.getElementById('effect-select') as HTMLSelectElement;
    if (effectSelect) {
      effectSelect.value = 'none';
    }
  }

  private async initializeCamera(): Promise<void> {
    try {
      const cameras = await this.cameraManager.getCameraDevices();
      console.log('📹 利用可能なカメラ:', cameras);
      
      // カメラ選択ドロップダウンを更新
      this.updateCameraSelect(cameras);
      
      if (cameras.length > 0) {
        const stream = await this.cameraManager.startCamera();
        this.setupVideoStream(stream);
        
        // ステータスを更新
        const statusText = document.getElementById('camera-status-text');
        if (statusText) {
          statusText.textContent = 'カメラ接続済み';
        }
      } else {
        console.warn('⚠️ カメラが見つかりません');
        this.showCameraError();
      }
    } catch (error) {
      console.error('❌ カメラ初期化エラー:', error);
      this.showCameraError();
    }
  }

  private updateCameraSelect(cameras: any[]): void {
    const cameraSelect = document.getElementById('camera-select') as HTMLSelectElement;
    if (!cameraSelect) return;
    
    // 既存のオプションをクリア（最初の「カメラを選択...」を除く）
    while (cameraSelect.children.length > 1) {
      cameraSelect.removeChild(cameraSelect.lastChild!);
    }
    
    // 新しいカメラオプションを追加
    cameras.forEach((camera, index) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label || `カメラ ${index + 1}`;
      cameraSelect.appendChild(option);
    });
    
    // 最初のカメラを選択
    if (cameras.length > 0) {
      cameraSelect.value = cameras[0].deviceId;
    }
  }

  private setupVideoStream(stream: MediaStream): void {
    const videoElement = document.getElementById('video') as HTMLVideoElement;
    if (videoElement) {
      videoElement.srcObject = stream;
      videoElement.play();
      
      // ビデオ処理ループ開始
      this.startVideoProcessing();
    }
  }

  private startVideoProcessing(): void {
    const videoElement = document.getElementById('video') as HTMLVideoElement;
    const canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
    
    if (!videoElement || !canvasElement) return;
    
    const processFrame = () => {
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        this.segmentationManager.processVideo(videoElement);
      }
      requestAnimationFrame(processFrame);
    };
    
    processFrame();
  }

  private setupEventListeners(): void {
    // カメラ切り替え
    const cameraSelect = document.getElementById('camera-select') as HTMLSelectElement;
    if (cameraSelect) {
      cameraSelect.addEventListener('change', async (e) => {
        const target = e.target as HTMLSelectElement;
        const deviceId = target.value;
        
        try {
          const stream = await this.cameraManager.startCamera(deviceId);
          this.setupVideoStream(stream);
        } catch (error) {
          console.error('❌ カメラ切り替えエラー:', error);
        }
      });
    }

    // 背景除去トグル
    const backgroundToggle = document.getElementById('background-toggle') as HTMLInputElement;
    if (backgroundToggle) {
      backgroundToggle.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const enabled = target.checked;
        localStorage.setItem('backgroundRemovalEnabled', enabled.toString());
        console.log('🎨 背景除去:', enabled ? 'ON' : 'OFF');
      });
    }

    // 背景色変更
    const backgroundColorSelect = document.getElementById('background-color') as HTMLSelectElement;
    if (backgroundColorSelect) {
      backgroundColorSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const color = target.value;
        localStorage.setItem('backgroundColor', color);
        console.log('🎨 背景色変更:', color);
      });
    }

    // エフェクト変更
    const effectSelect = document.getElementById('effect-select') as HTMLSelectElement;
    if (effectSelect) {
      effectSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const effect = target.value;
        this.applyEffect(effect);
      });
    }

    // 画像保存
    const saveButton = document.getElementById('save-button') as HTMLButtonElement;
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        this.saveImage();
      });
    }
  }

  private setupAppShortcuts(): void {
    // AppStore版ではアプリ内でのショートカットのみ使用
    document.addEventListener('keydown', (e) => {
      // Cmd+S: 画像保存
      if (e.metaKey && e.key === 's') {
        e.preventDefault();
        this.saveImage();
      }
      
      // Cmd+B: 背景除去トグル
      if (e.metaKey && e.key === 'b') {
        e.preventDefault();
        this.toggleBackgroundRemoval();
      }
      
      // Cmd+R: カメラ再起動
      if (e.metaKey && e.key === 'r') {
        e.preventDefault();
        this.restartCamera();
      }
    });
  }

  private async saveImage(): Promise<void> {
    try {
      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      if (!canvas) return;
      
      // メインプロセスに保存ダイアログを要求
      const { ipcRenderer } = require('electron');
      const result = await ipcRenderer.invoke('show-save-dialog');
      
      if (result && !result.canceled && result.filePath) {
        // キャンバスを画像として保存
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = result.filePath;
        link.href = dataURL;
        link.click();
        
        console.log('💾 画像を保存しました:', result.filePath);
      }
    } catch (error) {
      console.error('❌ 画像保存エラー:', error);
    }
  }

  private toggleBackgroundRemoval(): void {
    const backgroundToggle = document.getElementById('background-toggle') as HTMLInputElement;
    if (backgroundToggle) {
      backgroundToggle.checked = !backgroundToggle.checked;
      backgroundToggle.dispatchEvent(new Event('change'));
    }
  }

  private async restartCamera(): Promise<void> {
    try {
      const stream = await this.cameraManager.startCamera();
      this.setupVideoStream(stream);
      console.log('🔄 カメラを再起動しました');
    } catch (error) {
      console.error('❌ カメラ再起動エラー:', error);
    }
  }

  private applyEffect(effect: string): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || !canvas) return;
    
    // エフェクト適用ロジック
    console.log('🎭 エフェクト適用:', effect);
    
    // 簡易的なエフェクト実装
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    switch (effect) {
      case 'vintage':
        // ヴィンテージ効果
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.2); // 赤を強調
          data[i + 1] = Math.min(255, data[i + 1] * 0.9); // 緑を抑制
          data[i + 2] = Math.min(255, data[i + 2] * 0.8); // 青を抑制
        }
        break;
      case 'cool':
        // クール効果
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 0.8); // 赤を抑制
          data[i + 1] = Math.min(255, data[i + 1] * 0.9); // 緑を抑制
          data[i + 2] = Math.min(255, data[i + 2] * 1.3); // 青を強調
        }
        break;
      case 'warm':
        // ウォーム効果
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.3); // 赤を強調
          data[i + 1] = Math.min(255, data[i + 1] * 1.1); // 緑を少し強調
          data[i + 2] = Math.min(255, data[i + 2] * 0.7); // 青を抑制
        }
        break;
      case 'noir':
        // ノワール効果
        for (let i = 0; i < data.length; i += 4) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        break;
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  private showCameraError(): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #ff6b6b;">
        <h3>カメラアクセスエラー</h3>
        <p>カメラへのアクセスが許可されていません。</p>
        <p>システム環境設定 > セキュリティとプライバシー > プライバシー > カメラ</p>
        <p>でWipeCamにカメラアクセスを許可してください。</p>
      </div>
    `;
    
    const container = document.getElementById('app-container');
    if (container) {
      container.appendChild(errorDiv);
    }
  }
}

// アプリケーション開始
const app = new RendererAppStore();
app.initialize().catch(console.error);

console.log('📱 AppStore対応版 WipeCam レンダラープロセス開始'); 