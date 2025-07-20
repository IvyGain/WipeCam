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
  
  // マスクを処理して精密な切り取り用マスクを作成
  const processedMask = createPrecisionMask(segmentationMask);
  
  // 人物部分のみを描画
  canvasCtx.globalCompositeOperation = 'source-over';
  canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
  
  // 精密マスクで切り取り
  canvasCtx.globalCompositeOperation = 'destination-in';
  canvasCtx.drawImage(processedMask, 0, 0);
  
  // エフェクトを適用
  if (currentEffect !== 'none') {
    canvasCtx.globalCompositeOperation = 'source-over';
    applyEffect(currentEffect);
  }
}

// 精密なマスク作成
function createPrecisionMask(segmentationMask) {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvasElement.width;
  maskCanvas.height = canvasElement.height;
  const maskCtx = maskCanvas.getContext('2d');
  
  // マスクを描画
  maskCtx.drawImage(segmentationMask, 0, 0, maskCanvas.width, maskCanvas.height);
  const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = imageData.data;
  const width = maskCanvas.width;
  const height = maskCanvas.height;
  
  // 二値化とモルフォロジー処理
  const processedData = new Uint8ClampedArray(data.length);
  
  // Step 1: 閾値による二値化（より精密に）
  for (let i = 0; i < data.length; i += 4) {
    const maskValue = data[i] / 255; // R値を使用
    const isHuman = maskValue > segmentationThreshold;
    
    processedData[i] = isHuman ? 255 : 0;     // R
    processedData[i + 1] = isHuman ? 255 : 0; // G  
    processedData[i + 2] = isHuman ? 255 : 0; // B
    processedData[i + 3] = isHuman ? 255 : 0; // A
  }
  
  // Step 2: モルフォロジー処理（ノイズ除去）
  const morphProcessed = applyMorphology(processedData, width, height);
  
  // Step 3: 境界線のみにぼかしを適用
  if (blurAmount > 0) {
    applyEdgeBlur(morphProcessed, width, height);
  }
  
  // 結果を描画
  const finalImageData = new ImageData(morphProcessed, width, height);
  maskCtx.putImageData(finalImageData, 0, 0);
  
  return maskCanvas;
}

// モルフォロジー処理（クロージング + オープニング）
function applyMorphology(data, width, height) {
  const processed = new Uint8ClampedArray(data);
  
  // クロージング（膨張→収縮）で小さな穴を埋める
  const dilated = dilate(processed, width, height, 2);
  const closed = erode(dilated, width, height, 2);
  
  // オープニング（収縮→膨張）で小さなノイズを除去
  const eroded = erode(closed, width, height, 1);
  const opened = dilate(eroded, width, height, 1);
  
  return opened;
}

// 膨張処理
function dilate(data, width, height, radius) {
  const result = new Uint8ClampedArray(data.length);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      let maxValue = 0;
      
      // 近傍の最大値を取得
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const nIndex = (ny * width + nx) * 4;
            maxValue = Math.max(maxValue, data[nIndex]);
          }
        }
      }
      
      result[index] = maxValue;
      result[index + 1] = maxValue;
      result[index + 2] = maxValue;
      result[index + 3] = maxValue;
    }
  }
  
  return result;
}

// 収縮処理
function erode(data, width, height, radius) {
  const result = new Uint8ClampedArray(data.length);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      let minValue = 255;
      
      // 近傍の最小値を取得
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const nIndex = (ny * width + nx) * 4;
            minValue = Math.min(minValue, data[nIndex]);
          }
        }
      }
      
      result[index] = minValue;
      result[index + 1] = minValue;
      result[index + 2] = minValue;
      result[index + 3] = minValue;
    }
  }
  
  return result;
}

// 境界線のみにぼかしを適用
function applyEdgeBlur(data, width, height) {
  if (blurAmount === 0) return;
  
  // エッジ検出
  const edges = detectEdges(data, width, height);
  
  // エッジ部分のみガウシアンぼかしを適用
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      
      if (edges[index] > 0) { // エッジピクセルの場合
        const blurredValue = getGaussianBlur(data, x, y, width, height, blurAmount);
        data[index] = blurredValue;
        data[index + 1] = blurredValue;
        data[index + 2] = blurredValue;
        data[index + 3] = blurredValue;
      }
    }
  }
}

// エッジ検出（ソーベルフィルタ）
function detectEdges(data, width, height) {
  const edges = new Uint8ClampedArray(data.length);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      
      // ソーベルX
      const gx = 
        -data[((y-1)*width + (x-1)) * 4] + data[((y-1)*width + (x+1)) * 4] +
        -2*data[(y*width + (x-1)) * 4] + 2*data[(y*width + (x+1)) * 4] +
        -data[((y+1)*width + (x-1)) * 4] + data[((y+1)*width + (x+1)) * 4];
      
      // ソーベルY  
      const gy = 
        -data[((y-1)*width + (x-1)) * 4] - 2*data[((y-1)*width + x) * 4] - data[((y-1)*width + (x+1)) * 4] +
        data[((y+1)*width + (x-1)) * 4] + 2*data[((y+1)*width + x) * 4] + data[((y+1)*width + (x+1)) * 4];
      
      const magnitude = Math.sqrt(gx*gx + gy*gy);
      const edgeValue = magnitude > 30 ? 255 : 0; // エッジ閾値
      
      edges[index] = edgeValue;
      edges[index + 1] = edgeValue;
      edges[index + 2] = edgeValue;
      edges[index + 3] = edgeValue;
    }
  }
  
  return edges;
}

// ガウシアンぼかし
function getGaussianBlur(data, x, y, width, height, radius) {
  let sum = 0;
  let weightSum = 0;
  const sigma = radius / 3;
  
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const ny = y + dy;
      const nx = x + dx;
      
      if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
        const distance = dx*dx + dy*dy;
        const weight = Math.exp(-distance / (2 * sigma * sigma));
        const index = (ny * width + nx) * 4;
        
        sum += data[index] * weight;
        weightSum += weight;
      }
    }
  }
  
  return weightSum > 0 ? Math.round(sum / weightSum) : 0;
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
      e.stopPropagation();
      segmentationThreshold = parseFloat(e.target.value);
      if (thresholdValue) thresholdValue.textContent = segmentationThreshold.toFixed(1);
    });
    
    // マウスイベントでもドラッグを防止
    thresholdSlider.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }
  
  if (blurSlider) {
    blurSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      blurAmount = parseInt(e.target.value);
      if (blurValue) blurValue.textContent = `${blurAmount}px`;
    });
    
    // マウスイベントでもドラッグを防止
    blurSlider.addEventListener('mousedown', (e) => {
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
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    
    // 方向に応じてサイズを計算
    switch (currentDirection) {
      case 'nw':
        newWidth = Math.max(160, startWidth - deltaX);
        newHeight = Math.max(120, startHeight - deltaY);
        break;
      case 'ne':
        newWidth = Math.max(160, startWidth + deltaX);
        newHeight = Math.max(120, startHeight - deltaY);
        break;
      case 'sw':
        newWidth = Math.max(160, startWidth - deltaX);
        newHeight = Math.max(120, startHeight + deltaY);
        break;
      case 'se':
        newWidth = Math.max(160, startWidth + deltaX);
        newHeight = Math.max(120, startHeight + deltaY);
        break;
    }
    
    // 最大サイズ制限
    newWidth = Math.min(1200, newWidth);
    newHeight = Math.min(900, newHeight);
    
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

document.addEventListener('DOMContentLoaded', () => {
  initializeSelfieSegmentation();
  startCamera();
  initializeSettings();
  initializeResizeHandles();
  
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