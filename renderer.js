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

// セグメンテーション結果の処理（背景色対応）
function onSegmentationResults(results) {
  if (!canvasElement || !canvasCtx) return;

  // キャンバスをクリア
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (backgroundRemovalEnabled && results.segmentationMask) {
    // 背景除去処理
    processFastSegmentation(results);
  } else {
    // 通常描画（背景色ありの場合は背景を塗りつぶし）
    if (backgroundColor !== 'transparent') {
      canvasCtx.fillStyle = backgroundColor;
      canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  }
}

// 最速背景除去処理（背景色選択対応）
function processFastSegmentation(results) {
  const { image, segmentationMask } = results;
  
  if (backgroundColor === 'transparent') {
    // 透明背景（従来通り）
    canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.globalCompositeOperation = 'destination-in';
    canvasCtx.drawImage(segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.globalCompositeOperation = 'source-over';
  } else {
    // 指定した背景色で塗りつぶし
    
    // 背景を指定した色で塗りつぶし
    canvasCtx.fillStyle = backgroundColor;
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 一時キャンバスで人物部分を抽出
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasElement.width;
    tempCanvas.height = canvasElement.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 元画像を描画
    tempCtx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // マスクで人物部分を切り取り
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(segmentationMask, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // 人物部分を背景の上に描画
    canvasCtx.drawImage(tempCanvas, 0, 0);
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
        width: { ideal: 480 }, // 解像度を下げて軽量化
        height: { ideal: 360 },
        frameRate: { ideal: 15, max: 20 } // フレームレート制限で軽量化
      }
    };
    
    // 特定のデバイスIDが指定されている場合は使用
    if (savedDeviceId) {
      constraints.video.deviceId = { exact: savedDeviceId };
    } else {
      constraints.video.facingMode = 'user';
    }
    
    console.log('Camera constraints (lightweight):', constraints);
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentCameraId = savedDeviceId;
    
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
      console.log('Background color changed to:', backgroundColor);
      
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
      console.log('Custom background color changed to:', backgroundColor);
      
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