let videoElement = null;
let canvasElement = null;
let canvasCtx = null;
let isSmallSize = true;
let backgroundRemovalEnabled = false;
let selfieSegmentation = null;

// 設定値
let segmentationThreshold = 0.5;
let blurAmount = 2;
let currentEffect = 'none';

// MediaPipe Selfie Segmentationの初期化
function initializeSelfieSegmentation() {
  selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
    }
  });

  selfieSegmentation.setOptions({
    modelSelection: 1, // 0: general, 1: landscape
    selfieMode: true,
  });

  selfieSegmentation.onResults(onSegmentationResults);
}

// セグメンテーション結果の処理
function onSegmentationResults(results) {
  if (!canvasElement || !canvasCtx) return;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (backgroundRemovalEnabled && results.segmentationMask) {
    // 高度なセグメンテーション処理
    processAdvancedSegmentation(results);
  } else {
    // 背景除去が無効の場合は通常の描画
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    // エフェクトのみ適用
    if (currentEffect !== 'none') {
      applyEffect(currentEffect);
    }
  }

  canvasCtx.restore();
}

// 高度なセグメンテーション処理
function processAdvancedSegmentation(results) {
  const { image, segmentationMask } = results;
  
  // 一時キャンバスでマスク処理
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvasElement.width;
  tempCanvas.height = canvasElement.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // マスクを閾値で二値化
  tempCtx.drawImage(segmentationMask, 0, 0, tempCanvas.width, tempCanvas.height);
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i] / 255; // R値をアルファとして使用
    data[i + 3] = alpha > segmentationThreshold ? 255 : 0; // 閾値で二値化
  }
  
  // ぼかし効果を適用
  if (blurAmount > 0) {
    canvasCtx.filter = `blur(${blurAmount}px)`;
  }
  
  tempCtx.putImageData(imageData, 0, 0);
  
  // 人物部分のみを描画
  canvasCtx.globalCompositeOperation = 'source-over';
  canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.globalCompositeOperation = 'destination-in';
  canvasCtx.drawImage(tempCanvas, 0, 0);
  
  // エフェクトを適用
  if (currentEffect !== 'none') {
    canvasCtx.globalCompositeOperation = 'source-over';
    applyEffect(currentEffect);
  }
  
  canvasCtx.filter = 'none';
}

// エフェクト適用
function applyEffect(effect) {
  const imageData = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
  const data = imageData.data;
  
  switch (effect) {
    case 'vintage':
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        data[i] = Math.min(255, r * 1.2 + 30);     // 赤を強調
        data[i + 1] = Math.min(255, g * 1.1 + 20); // 緑を少し強調
        data[i + 2] = Math.max(0, b * 0.8 - 20);   // 青を抑制
      }
      break;
      
    case 'cool':
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, data[i] * 0.8);     // 赤を抑制
        data[i + 1] = Math.min(255, data[i + 1] * 1.1); // 緑を強調
        data[i + 2] = Math.min(255, data[i + 2] * 1.3); // 青を強調
      }
      break;
      
    case 'warm':
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.3);   // 赤を強調
        data[i + 1] = Math.min(255, data[i + 1] * 1.1); // 緑を少し強調
        data[i + 2] = Math.max(0, data[i + 2] * 0.7);   // 青を抑制
      }
      break;
      
    case 'noir':
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      break;
  }
  
  canvasCtx.putImageData(imageData, 0, 0);
}

// ビデオフレームの処理
async function processVideo() {
  if (!videoElement || !selfieSegmentation) return;
  
  if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
    await selfieSegmentation.send({ image: videoElement });
  }
  
  requestAnimationFrame(processVideo);
}

async function startCamera() {
  videoElement = document.getElementById('video');
  canvasElement = document.getElementById('canvas');
  canvasCtx = canvasElement.getContext('2d');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      }
    });
    
    videoElement.srcObject = stream;
    
    // ビデオのメタデータが読み込まれたらキャンバスのサイズを設定
    videoElement.addEventListener('loadedmetadata', () => {
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
      processVideo();
    });
    
  } catch (error) {
    console.error('Error accessing camera:', error);
    alert('カメラへのアクセスに失敗しました。カメラの権限を確認してください。');
  }
}

function toggleBackgroundRemoval() {
  backgroundRemovalEnabled = !backgroundRemovalEnabled;
  const button = document.getElementById('toggle-bg');
  button.style.opacity = backgroundRemovalEnabled ? '1' : '0.6';
}

// 設定パネルの制御
function initializeSettings() {
  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdValue = document.getElementById('threshold-value');
  const blurSlider = document.getElementById('blur-slider');
  const blurValue = document.getElementById('blur-value');
  const effectSelect = document.getElementById('effect-select');
  
  if (thresholdSlider) {
    thresholdSlider.addEventListener('input', (e) => {
      segmentationThreshold = parseFloat(e.target.value);
      thresholdValue.textContent = segmentationThreshold.toFixed(1);
    });
  }
  
  if (blurSlider) {
    blurSlider.addEventListener('input', (e) => {
      blurAmount = parseInt(e.target.value);
      blurValue.textContent = `${blurAmount}px`;
    });
  }
  
  if (effectSelect) {
    effectSelect.addEventListener('change', (e) => {
      currentEffect = e.target.value;
    });
  }
}

function toggleSize() {
  const container = document.getElementById('container');
  if (isSmallSize) {
    container.style.width = '640px';
    container.style.height = '480px';
  } else {
    container.style.width = '320px';
    container.style.height = '240px';
  }
  isSmallSize = !isSmallSize;
}

function changeSizePreset() {
  window.electronAPI.changeSize();
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

function updateContainerSize(size) {
  const container = document.getElementById('container');
  container.style.width = `${size.width}px`;
  container.style.height = `${size.height}px`;
}

function closeWindow() {
  if (videoElement && videoElement.srcObject) {
    const tracks = videoElement.srcObject.getTracks();
    tracks.forEach(track => track.stop());
  }
  window.electronAPI.closeWindow();
}

document.addEventListener('DOMContentLoaded', () => {
  initializeSelfieSegmentation();
  startCamera();
  initializeSettings();
  
  document.getElementById('toggle-bg').addEventListener('click', toggleBackgroundRemoval);
  document.getElementById('toggle-size').addEventListener('click', toggleSize);
  document.getElementById('change-size').addEventListener('click', changeSizePreset);
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
  
  window.electronAPI.onSizeChanged((event, size) => {
    updateContainerSize(size);
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
    if (e.target.tagName === 'BUTTON') return;
    
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