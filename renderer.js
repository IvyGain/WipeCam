let videoElement = null;
let canvasElement = null;
let canvasCtx = null;
let isSmallSize = true;
let backgroundRemovalEnabled = false;
let selfieSegmentation = null;
let availableCameras = [];
let currentCameraId = null;

// 設定値（シンプル化）
let segmentationThreshold = 0.5;
let currentEffect = 'none';
let backgroundColor = 'transparent'; // 背景色設定

// MediaPipe Selfie Segmentationの初期化（軽量版）
async function initializeSelfieSegmentation() {
  return new Promise((resolve, reject) => {
    try {
      console.log('Initializing MediaPipe (lightweight)...');
      
      selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
      });

      selfieSegmentation.setOptions({
        modelSelection: 0, // 軽量モデル
        selfieMode: true,
      });

      selfieSegmentation.onResults(onSegmentationResults);
      
      // 初期化完了を待つ
      setTimeout(() => {
        console.log('MediaPipe initialized successfully (lightweight)');
        resolve();
      }, 1000); // 軽量化のため待機時間短縮
      
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      reject(error);
    }
  });
}

// セグメンテーション結果の処理（背景色対応修復版）
function onSegmentationResults(results) {
  if (!canvasElement || !canvasCtx) return;
  
  // macOSネイティブ処理中はスキップ
  if (isUsingMacOSNative) {
    console.log('🎆 Skipping MediaPipe - using macOS native processing');
    return;
  }

  console.log('🤖 MediaPipe processing - backgroundRemovalEnabled:', backgroundRemovalEnabled, 'backgroundColor:', backgroundColor);

  // キャンバスをクリア
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (backgroundRemovalEnabled && results.segmentationMask) {
    // 背景除去処理を実行
    console.log('🎨 Applying background removal with segmentation');
    processFastSegmentation(results);
  } else {
    // 通常描画（背景色ありの場合は背景を塗りつぶし）
    console.log('🖼️ Normal rendering with backgroundColor:', backgroundColor);
    
    if (backgroundColor !== 'transparent') {
      canvasCtx.fillStyle = backgroundColor;
      canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      console.log('🎨 Background filled for normal rendering');
    }
    
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  }
}

// 最速背景除去処理（背景色選択対応修復版）
function processFastSegmentation(results) {
  const { image, segmentationMask } = results;
  
  console.log('🎨 Processing with backgroundColor:', backgroundColor);
  
  // キャンバスをクリア
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  if (backgroundColor === 'transparent') {
    // 透明背景（従来通り）
    canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.globalCompositeOperation = 'destination-in';
    canvasCtx.drawImage(segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.globalCompositeOperation = 'source-over';
  } else {
    // 指定した背景色で塗りつぶし
    console.log('🎨 Applying background color:', backgroundColor);
    
    // Step 1: 背景を指定した色で塗りつぶし
    canvasCtx.fillStyle = backgroundColor;
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Step 2: 一時キャンバスで人物部分を抽出
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasElement.width;
    tempCanvas.height = canvasElement.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Step 3: 元画像を一時キャンバスに描画
    tempCtx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Step 4: マスクで人物部分を切り取り
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(segmentationMask, 0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.globalCompositeOperation = 'source-over';
    
    // Step 5: 人物部分を背景の上に描画
    canvasCtx.drawImage(tempCanvas, 0, 0);
    
    console.log('✅ Background color applied successfully');
  }
}

// カメラデバイス取得（軽量版）
async function getCameraDevices() {
  try {
    // 初回はカメラアクセス権限を要求してからデバイス一覧を取得
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // すぐに停止
    } catch (permissionError) {
      console.warn('Camera permission not granted:', permissionError);
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    availableCameras = videoDevices.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `カメラ ${index + 1}`
    }));
    
    console.log('Available cameras:', availableCameras);
    return availableCameras;
  } catch (error) {
    console.error('Failed to get camera devices:', error);
    return [];
  }
}

// ビデオフレームの処理（軽量版）
async function processVideo() {
  if (!videoElement || !selfieSegmentation) return;
  
  if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
    await selfieSegmentation.send({ image: videoElement });
  }
  
  requestAnimationFrame(processVideo);
}

// macOS背景処理機能付きカメラ開始（改良版）
async function startCameraWithMacOSBackground(deviceId = null) {
  try {
    console.log('🎆 Starting camera with macOS background processing:', deviceId);
    
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    canvasCtx = canvasElement.getContext('2d');
    
    if (!videoElement || !canvasElement) {
      throw new Error('Video or canvas element not found');
    }
    
    // 既存のストリームを停止
    if (videoElement.srcObject) {
      const tracks = videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoElement.srcObject = null;
    }
    
    const savedDeviceId = deviceId || localStorage.getItem('selectedCameraId');
    
    // ステップ1: シンプルな制約でカメラを開始
    let constraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30 },
        facingMode: 'user'
      }
    };
    
    if (savedDeviceId) {
      constraints.video.deviceId = { exact: savedDeviceId };
    }
    
    console.log('🔧 Step 1: Getting camera stream...');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    videoElement.srcObject = stream;
    currentCameraId = savedDeviceId;
    
    // ステップ2: ビデオロード待機
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 10000);
      
      videoElement.onloadedmetadata = () => {
        clearTimeout(timeout);
        console.log('📹 Video loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        resolve();
      };
    });
    
    // ステップ3: macOS背景処理を手動で有効化するガイド
    console.log('📱 Step 2: Enabling macOS background processing...');
    
    // ユーザーにmacOS背景処理を有効化するようガイド
    showMacOSBackgroundGuide();
    
    // ステップ4: MediaPipeを無効化して純正処理のみ使用
    console.log('🎆 Step 3: Using macOS native processing instead of MediaPipe');
    isUsingMacOSNative = true; // macOSネイティブ処理フラグを有効化
    processVideoNative();
    
    console.log('✨ macOS background camera setup completed!');
    return stream;
    
  } catch (error) {
    console.error('❌ macOS background processing setup failed:', error);
    throw error;
  }
}

// macOS背景処理有効化ガイド表示
function showMacOSBackgroundGuide() {
  const guideModal = document.createElement('div');
  guideModal.id = 'macos-guide-modal';
  guideModal.className = 'modal';
  guideModal.style.display = 'flex';
  guideModal.style.zIndex = '2000';
  
  guideModal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; text-align: left;">
      <h3 style="margin-bottom: 16px; color: #007AFF;">🎆 macOS背景処理を有効化</h3>
      <div style="margin-bottom: 20px; line-height: 1.5;">
        <p style="margin: 8px 0; font-size: 14px;"><strong>1. Control Centerを開く</strong></p>
        <p style="margin: 8px 0 16px 0; color: #666; font-size: 13px;">   メニューバー右上のコントロールセンターをクリック</p>
        
        <p style="margin: 8px 0; font-size: 14px;"><strong>2. ビデオエフェクトを選択</strong></p>
        <p style="margin: 8px 0 16px 0; color: #666; font-size: 13px;">   「ビデオエフェクト」または「カメラ」アイコンをクリック</p>
        
        <p style="margin: 8px 0; font-size: 14px;"><strong>3. 背景をONにする</strong></p>
        <p style="margin: 8px 0 16px 0; color: #666; font-size: 13px;">   「背景」トグルをオンにして、お好みの背景を選択</p>
        
        <div style="background: #f0f8ff; padding: 12px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; font-size: 13px; color: #007AFF;">
            💡 <strong>ヒント:</strong> 背景をオンにすると、Appleの高精度AIが人物を綺麗に識別します！
          </p>
        </div>
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="guide-close" style="padding: 8px 16px; background: #007AFF; color: white; border: none; border-radius: 6px; cursor: pointer;">理解しました</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(guideModal);
  
  // 閉じるイベント
  const closeBtn = guideModal.querySelector('#guide-close');
  const closeGuide = () => {
    document.body.removeChild(guideModal);
  };
  
  closeBtn.addEventListener('click', closeGuide);
  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) closeGuide();
  });
  
  // 10秒後に自動で閉じる
  setTimeout(closeGuide, 10000);
}

// エラーガイド表示
function showErrorGuide() {
  const errorModal = document.createElement('div');
  errorModal.className = 'modal';
  errorModal.style.display = 'flex';
  errorModal.style.zIndex = '2000';
  
  errorModal.innerHTML = `
    <div class="modal-content" style="max-width: 380px; text-align: center;">
      <h3 style="color: #ff3b30; margin-bottom: 16px;">⚠️ 設定が必要です</h3>
      
      <div style="margin-bottom: 20px; text-align: left; line-height: 1.5;">
        <p style="margin: 8px 0; font-size: 14px;"><strong>📱 Control Centerで設定:</strong></p>
        <p style="margin: 8px 0 16px 0; color: #666; font-size: 13px;">1. メニューバー右上 > Control Center</p>
        <p style="margin: 8px 0 16px 0; color: #666; font-size: 13px;">2. ビデオエフェクト > 背景をON</p>
        
        <p style="margin: 8px 0; font-size: 14px;"><strong>🔒 権限設定:</strong></p>
        <p style="margin: 8px 0 16px 0; color: #666; font-size: 13px;">System Preferences > Security & Privacy > Camera</p>
      </div>
      
      <div style="background: #fff3cd; padding: 12px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; font-size: 13px; color: #856404;">
          📝 <strong>重要:</strong> macOSの背景処理を事前に有効化してから再度お試しください
        </p>
      </div>
      
      <button id="error-close" style="padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 6px; cursor: pointer;">理解しました</button>
    </div>
  `;
  
  document.body.appendChild(errorModal);
  
  // 閉じるイベント
  const closeBtn = errorModal.querySelector('#error-close');
  const closeError = () => {
    document.body.removeChild(errorModal);
  };
  
  closeBtn.addEventListener('click', closeError);
  errorModal.addEventListener('click', (e) => {
    if (e.target === errorModal) closeError();
  });
}

// macOS純正背景処理用のビデオ処理（背景色対応修復版）
let isUsingMacOSNative = false; // macOSネイティブ処理フラグ

function processVideoNative() {
  if (!videoElement) return;
  
  if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
    console.log('🎆 macOS native processing with backgroundColor:', backgroundColor);
    
    // キャンバスをクリア
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (backgroundRemovalEnabled) {
      // 背景除去有効時: 背景色を適用してから人物を描画
      if (backgroundColor !== 'transparent') {
        canvasCtx.fillStyle = backgroundColor;
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        console.log('🎨 macOS: Background filled with', backgroundColor);
      }
      
      // macOSが背景処理した映像を描画（人物部分のみ）
      canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    } else {
      // 背景除去無効時: 通常表示
      if (backgroundColor !== 'transparent') {
        canvasCtx.fillStyle = backgroundColor;
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      }
      canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    }
  }
  
  requestAnimationFrame(processVideoNative);
}

// カメラ開始（軽量版）
async function startCamera(deviceId = null) {
  try {
    console.log('Starting camera (lightweight) with deviceId:', deviceId);
    
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    canvasCtx = canvasElement.getContext('2d');
    
    if (!videoElement || !canvasElement) {
      throw new Error('Video or canvas element not found');
    }
    
    // 既存のストリームを停止
    if (videoElement.srcObject) {
      const tracks = videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoElement.srcObject = null;
    }
    
    // 保存されたデバイスIDまたは指定されたデバイスIDを使用
    const savedDeviceId = deviceId || localStorage.getItem('selectedCameraId');
    
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
        // macOS純正背景処理を有効化
        backgroundBlur: true,
        backgroundSegmentation: true,
        videoKind: 'environment' // 背景処理を有効化するヒント
      }
    };
    
    // 特定のデバイスIDが指定されている場合は使用
    if (savedDeviceId) {
      constraints.video.deviceId = { exact: savedDeviceId };
    } else {
      constraints.video.facingMode = 'user';
    }
    
    console.log('Camera constraints with macOS background processing:', constraints);
    
    // macOS背景処理機能を有効化する試行
    let stream;
    try {
      // 最新のWebRTC APIで背景処理をリクエスト
      stream = await navigator.mediaDevices.getUserMedia({
        ...constraints,
        video: {
          ...constraints.video,
          // Chrome/SafariでのmacOS背景処理API
          backgroundSegmentation: { exact: true },
          backgroundBlur: { exact: true }
        }
      });
      
      console.log('✅ macOS background processing enabled');
      currentCameraId = savedDeviceId;
      
      // ストリームの背景処理状態を確認
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      if (settings.backgroundSegmentation || settings.backgroundBlur) {
        console.log('🎉 Hardware background processing active!');
      }
      
    } catch (advancedError) {
      console.log('⚠️ Advanced background processing not available, falling back to basic constraints');
      
      // フォールバック: 基本的な制約で再試行
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      currentCameraId = savedDeviceId;
    }
    videoElement.srcObject = stream;
    
    // Promiseでビデオのロードを待機
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 5000); // タイムアウト短縮
      
      videoElement.onloadedmetadata = () => {
        clearTimeout(timeout);
        console.log('Video loaded (lightweight):', videoElement.videoWidth, 'x', videoElement.videoHeight);
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        resolve();
      };
      
      videoElement.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Video load error'));
      };
    });
    
    // MediaPipeが初期化されているか確認してから処理開始
    if (selfieSegmentation) {
      console.log('Starting video processing (lightweight)...');
      isUsingMacOSNative = false; // 通常モードではMediaPipeを使用
      processVideo();
    } else {
      throw new Error('MediaPipe not initialized');
    }
    
    console.log('Camera started successfully (lightweight)');
    
  } catch (error) {
    console.error('Error accessing camera (lightweight):', error);
    
    // 指定されたカメラが使えない場合はデフォルトで再試行
    if (deviceId || localStorage.getItem('selectedCameraId')) {
      console.log('Retrying with default camera...');
      localStorage.removeItem('selectedCameraId');
      return startCamera(null);
    }
    
    alert(`カメラへのアクセスに失敗しました: ${error.message}\nカメラの権限を確認してください。`);
    throw error;
  }
}

function toggleBackgroundRemoval() {
  backgroundRemovalEnabled = !backgroundRemovalEnabled;
  const button = document.getElementById('toggle-bg');
  button.style.opacity = backgroundRemovalEnabled ? '1' : '0.6';
}

// カメラドロップダウンの初期化（軽量版）
async function initializeCameraSelect() {
  const cameraSelect = document.getElementById('camera-select');
  
  try {
    // カメラデバイスを取得
    await getCameraDevices();
    
    // ドロップダウンをクリア
    cameraSelect.innerHTML = '';
    
    if (availableCameras.length === 0) {
      cameraSelect.innerHTML = '<option value="">カメラが見つかりません</option>';
      return;
    }
    
    // デフォルトオプション
    cameraSelect.innerHTML = '<option value="">デフォルトカメラ</option>';
    
    // 利用可能なカメラを追加
    availableCameras.forEach(camera => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label;
      cameraSelect.appendChild(option);
    });
    
    // カメラ選択のイベントリスナー
    cameraSelect.addEventListener('change', async (e) => {
      e.stopPropagation();
      const selectedDeviceId = e.target.value || null;
      console.log('Switching to camera:', selectedDeviceId);
      await startCamera(selectedDeviceId);
      
      // 選択されたカメラを保存
      if (selectedDeviceId) {
        localStorage.setItem('selectedCameraId', selectedDeviceId);
      } else {
        localStorage.removeItem('selectedCameraId');
      }
    });
    
    cameraSelect.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    
    // 保存されたカメラ設定を復元
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

// 設定パネルの制御（背景色選択対応）
function initializeSettings() {
  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdValue = document.getElementById('threshold-value');
  const effectSelect = document.getElementById('effect-select');
  const colorButtons = document.querySelectorAll('.color-btn');
  const customColorPicker = document.getElementById('custom-color');
  const macOSBackgroundBtn = document.getElementById('enable-macos-bg');
  
  if (thresholdSlider) {
    thresholdSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      segmentationThreshold = parseFloat(e.target.value);
      if (thresholdValue) thresholdValue.textContent = segmentationThreshold.toFixed(1);
      console.log('Threshold changed to:', segmentationThreshold);
    });
    
    thresholdSlider.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }
  
  // 背景色ボタンのイベントリスナー
  colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // アクティブ状態を更新
      colorButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // 背景色を設定
      backgroundColor = btn.getAttribute('data-color');
      console.log('🎨 Background color changed to:', backgroundColor);
      console.log('🔍 Current state - backgroundRemovalEnabled:', backgroundRemovalEnabled, 'isUsingMacOSNative:', isUsingMacOSNative);
      
      // localStorageに保存
      localStorage.setItem('backgroundColor', backgroundColor);
    });
    
    btn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  });
  
  // カスタムカラーピッカーのイベントリスナー
  if (customColorPicker) {
    customColorPicker.addEventListener('change', (e) => {
      e.stopPropagation();
      
      // アクティブ状態を更新
      colorButtons.forEach(b => b.classList.remove('active'));
      
      // 背景色を設定
      backgroundColor = e.target.value;
      console.log('🎨 Custom background color changed to:', backgroundColor);
      console.log('🔍 Current state - backgroundRemovalEnabled:', backgroundRemovalEnabled, 'isUsingMacOSNative:', isUsingMacOSNative);
      
      // localStorageに保存
      localStorage.setItem('backgroundColor', backgroundColor);
    });
    
    customColorPicker.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }
  
  // 保存された背景色を復元
  const savedBackgroundColor = localStorage.getItem('backgroundColor');
  if (savedBackgroundColor) {
    backgroundColor = savedBackgroundColor;
    
    // UIを更新
    const matchingBtn = document.querySelector(`[data-color="${savedBackgroundColor}"]`);
    if (matchingBtn) {
      colorButtons.forEach(b => b.classList.remove('active'));
      matchingBtn.classList.add('active');
    } else {
      // カスタムカラーの場合
      customColorPicker.value = savedBackgroundColor;
    }
    
    console.log('Restored background color:', backgroundColor);
  }
  
  // macOS背景処理ボタンのイベントリスナー
  if (macOSBackgroundBtn) {
    macOSBackgroundBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      try {
        // ボタンをローディング状態に
        macOSBackgroundBtn.textContent = '🔄 設定中...';
        macOSBackgroundBtn.disabled = true;
        
        // macOS背景処理を有効化してカメラを再起動
        const savedCameraId = localStorage.getItem('selectedCameraId');
        await startCameraWithMacOSBackground(savedCameraId);
        
        // 成功時のボタン状態
        macOSBackgroundBtn.classList.add('enabled');
        macOSBackgroundBtn.textContent = '✨ macOS高精度処理有効';
        macOSBackgroundBtn.disabled = false;
        
        // 背景除去も自動で有効化
        backgroundRemovalEnabled = true;
        const bgButton = document.getElementById('toggle-bg');
        if (bgButton) {
          bgButton.style.opacity = '1';
        }
        
        console.log('✨ macOS background processing successfully enabled');
        
        // 設定パネルを閉じる
        setTimeout(() => {
          const panel = document.getElementById('settings-panel');
          if (panel) {
            panel.classList.add('hidden');
          }
        }, 1500);
        
      } catch (error) {
        console.error('Failed to enable macOS background processing:', error);
        
        // エラー時のボタン状態を復元
        macOSBackgroundBtn.classList.remove('enabled');
        macOSBackgroundBtn.textContent = '🎆 高精度背景処理を有効化';
        macOSBackgroundBtn.disabled = false;
        
        // ユーザーフレンドリーなエラーメッセージ
        showErrorGuide();
      }
    });
    
    macOSBackgroundBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }
  
  if (effectSelect) {
    effectSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      currentEffect = e.target.value;
    });
    
    effectSelect.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }
}

async function showHotkeysModal() {
  const modal = document.getElementById('hotkeys-modal');
  const hotkeysListElement = document.getElementById('hotkeys-list');
  
  try {
    const hotkeys = await window.electronAPI.getHotkeys();
    
    hotkeysListElement.innerHTML = '';
    Object.entries(hotkeys).forEach(([key, description]) => {
      const item = document.createElement('div');
      item.className = 'hotkey-item';
      item.innerHTML = `
        <span class="hotkey-key">${key}</span>
        <span class="hotkey-desc">${description}</span>
      `;
      hotkeysListElement.appendChild(item);
    });
    
    modal.style.display = 'flex';
  } catch (error) {
    console.error('Failed to load hotkeys:', error);
  }
}

function hideHotkeysModal() {
  const modal = document.getElementById('hotkeys-modal');
  modal.style.display = 'none';
}

function initializeResizeHandles() {
  const resizeHandles = document.querySelectorAll('.resize-handle');
  const container = document.getElementById('container');
  let isResizing = false;
  let currentDirection = null;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let aspectRatio = 4/3; // デフォルトアスペクト比
  
  resizeHandles.forEach(handle => {
    const direction = handle.dataset.direction;
    
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      isResizing = true;
      currentDirection = direction;
      startX = e.screenX;
      startY = e.screenY;
      
      const rect = container.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      aspectRatio = startWidth / startHeight; // 現在のアスペクト比を記録
      
      document.body.style.cursor = getComputedStyle(handle).cursor;
      document.body.style.userSelect = 'none';
      
      console.log(`Starting resize: ${direction}, startSize: ${startWidth}x${startHeight}`);
    });
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing || !currentDirection) return;
    
    e.preventDefault();
    
    const deltaX = e.screenX - startX;
    const deltaY = e.screenY - startY;
    
    let newWidth, newHeight;
    
    // 方向に応じてサイズを計算（アスペクト比維持）
    switch (currentDirection) {
      case 'nw':
        // 左上: X軸の変化を基準にアスペクト比を維持
        newWidth = Math.max(160, startWidth - deltaX);
        newHeight = newWidth / aspectRatio;
        break;
      case 'ne':
        // 右上: X軸の変化を基準にアスペクト比を維持
        newWidth = Math.max(160, startWidth + deltaX);
        newHeight = newWidth / aspectRatio;
        break;
      case 'sw':
        // 左下: X軸の変化を基準にアスペクト比を維持
        newWidth = Math.max(160, startWidth - deltaX);
        newHeight = newWidth / aspectRatio;
        break;
      case 'se':
        // 右下: X軸の変化を基準にアスペクト比を維持
        newWidth = Math.max(160, startWidth + deltaX);
        newHeight = newWidth / aspectRatio;
        break;
    }
    
    // 最小サイズ制限
    if (newHeight < 120) {
      newHeight = 120;
      newWidth = newHeight * aspectRatio;
    }
    
    // 最大サイズ制限
    if (newWidth > 3840) {
      newWidth = 3840;
      newHeight = newWidth / aspectRatio;
    }
    if (newHeight > 2160) {
      newHeight = 2160;
      newWidth = newHeight * aspectRatio;
    }
    
    // コンテナサイズを直接変更
    container.style.width = `${newWidth}px`;
    container.style.height = `${newHeight}px`;
    
    // キャンバスサイズも同期
    if (canvasElement) {
      canvasElement.width = newWidth;
      canvasElement.height = newHeight;
    }
    
    // Electronウィンドウサイズを同期
    window.electronAPI.resizeWindow(newWidth, newHeight);
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      currentDirection = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
      console.log('Resize ended');
    }
  });
}

function closeWindow() {
  if (videoElement && videoElement.srcObject) {
    const tracks = videoElement.srcObject.getTracks();
    tracks.forEach(track => track.stop());
  }
  window.electronAPI.closeWindow();
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('DOM loaded, starting lightweight initialization...');
    
    initializeSettings();
    initializeResizeHandles();
    
    // MediaPipeを初期化して待機（軽量版）
    console.log('Initializing MediaPipe (lightweight)...');
    await initializeSelfieSegmentation();
    console.log('MediaPipe initialization complete (lightweight)');
    
    // カメラ選択を初期化
    console.log('Initializing camera select (lightweight)...');
    await initializeCameraSelect();
    
    // カメラを開始
    const savedCameraId = localStorage.getItem('selectedCameraId');
    console.log('Starting camera (lightweight) with saved ID:', savedCameraId);
    await startCamera(savedCameraId);
    
    console.log('All initialization complete (lightweight)');
    
  } catch (error) {
    console.error('Initialization failed (lightweight):', error);
    alert('アプリの初期化に失敗しました: ' + error.message);
  }
  
  document.getElementById('toggle-bg').addEventListener('click', toggleBackgroundRemoval);
  document.getElementById('show-hotkeys').addEventListener('click', showHotkeysModal);
  document.getElementById('close-modal').addEventListener('click', hideHotkeysModal);
  document.getElementById('close').addEventListener('click', closeWindow);
  
  // 設定パネルの閉じるボタン
  const closeSettingsBtn = document.getElementById('close-settings');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      const panel = document.getElementById('settings-panel');
      if (panel) {
        panel.classList.add('hidden');
      }
    });
  }
  
  // Handle settings button (if exists)
  const settingsBtn = document.getElementById('settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const panel = document.getElementById('settings-panel');
      if (panel) {
        panel.classList.toggle('hidden');
      }
    });
  }
  
  // IPC listeners for hotkey actions
  window.electronAPI.onToggleBackground(() => {
    toggleBackgroundRemoval();
  });
  
  // Hide modal when clicking outside
  document.getElementById('hotkeys-modal').addEventListener('click', (e) => {
    if (e.target.id === 'hotkeys-modal') {
      hideHotkeysModal();
    }
  });
  
  // Make window draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  
  const container = document.getElementById('container');
  
  container.addEventListener('mousedown', (e) => {
    // リサイズハンドル、ボタン、設定パネル内の要素の場合はドラッグ無効
    if (e.target.tagName === 'BUTTON' || 
        e.target.classList.contains('resize-handle') ||
        e.target.closest('.settings-panel') ||
        e.target.closest('#controls') ||
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'LABEL') return;
    
    initialX = e.clientX;
    initialY = e.clientY;
    isDragging = true;
    container.style.cursor = 'move';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    
    window.electronAPI.moveWindow(currentX, currentY);
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'default';
  });
});