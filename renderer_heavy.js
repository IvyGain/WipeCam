let videoElement = null;
let canvasElement = null;
let canvasCtx = null;
let isSmallSize = true;
let backgroundRemovalEnabled = false;
let selfieSegmentation = null;
let availableCameras = [];
let currentCameraId = null;

// 設定値
let segmentationThreshold = 0.5;
let blurAmount = 2;
let currentEffect = 'none';

// MediaPipe Selfie Segmentationの初期化
async function initializeSelfieSegmentation() {
  return new Promise((resolve, reject) => {
    try {
      console.log('Initializing MediaPipe...');
      
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
        console.log('MediaPipe initialized successfully');
        resolve();
      }, 1500); // 1.5秒待機
      
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      reject(error);
    }
  });
}

// セグメンテーション結果の処理（軽量版）
function onSegmentationResults(results) {
  if (!canvasElement || !canvasCtx) return;

  // キャンバスをクリア
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (backgroundRemovalEnabled && results.segmentationMask) {
    // シンプルな背景除去処理
    processSimpleSegmentation(results);
  } else {
    // 通常描画
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  }
}

// シンプルな背景除去処理（超軽量版）
function processSimpleSegmentation(results) {
  const { image, segmentationMask } = results;
  
  // 元画像を描画
  canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
  
  // マスクを直接適用（重い処理なし）
  canvasCtx.globalCompositeOperation = 'destination-in';
  canvasCtx.drawImage(segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.globalCompositeOperation = 'source-over';
}

// 高精度マスク作成
function createHighPrecisionMask(segmentationMask) {
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
  
  // Step 1: アダプティブ閾値処理（局所的に最適な閾値を計算）
  const processedData = applyAdaptiveThreshold(data, width, height);
  
  // Step 2: モルフォロジー処理でノイズ除去と穴埋め
  const morphData = applyAdvancedMorphology(processedData, width, height);
  
  // Step 3: エッジリファインメント（境界を鮮明化）
  const refinedData = applyEdgeRefinement(morphData, width, height);
  
  // Step 4: アンチエイリアシング（滑らかな境界）
  const finalData = applyAntiAliasing(refinedData, width, height);
  
  // 最終結果を描画
  const finalImageData = new ImageData(finalData, width, height);
  maskCtx.putImageData(finalImageData, 0, 0);
  
  return maskCanvas;
}

// アダプティブ閾値処理
function applyAdaptiveThreshold(data, width, height) {
  const result = new Uint8ClampedArray(data.length);
  const windowSize = 15; // 局所領域のサイズ
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const maskValue = data[index] / 255;
      
      // 局所的な閾値を計算
      let localSum = 0;
      let count = 0;
      
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const nIndex = (ny * width + nx) * 4;
            localSum += data[nIndex] / 255;
            count++;
          }
        }
      }
      
      const localMean = localSum / count;
      const adaptiveThreshold = Math.max(segmentationThreshold, localMean * 0.8);
      
      // より厳密な判定
      const confidence = Math.abs(maskValue - 0.5) * 2; // 0-1の確信度
      const isHuman = maskValue > adaptiveThreshold && confidence > 0.3;
      
      const alpha = isHuman ? Math.min(255, maskValue * 255 * (1 + confidence * 0.5)) : 0;
      
      result[index] = alpha;
      result[index + 1] = alpha;
      result[index + 2] = alpha;
      result[index + 3] = alpha;
    }
  }
  
  return result;
}

// 高度なモルフォロジー処理
function applyAdvancedMorphology(data, width, height) {
  // クロージング（膨張→収縮）で小さな穴を埋める
  let processed = dilate(data, width, height, 2);
  processed = erode(processed, width, height, 2);
  
  // オープニング（収縮→膨張）で細かいノイズを除去
  processed = erode(processed, width, height, 1);
  processed = dilate(processed, width, height, 1);
  
  // 追加の膨張で境界を少し拡張
  processed = dilate(processed, width, height, 1);
  
  return processed;
}

// エッジリファインメント（境界鮮明化）
function applyEdgeRefinement(data, width, height) {
  const result = new Uint8ClampedArray(data.length);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      const current = data[index];
      
      // 周囲8ピクセルを調べる
      const neighbors = [
        data[((y-1)*width + (x-1)) * 4], data[((y-1)*width + x) * 4], data[((y-1)*width + (x+1)) * 4],
        data[(y*width + (x-1)) * 4],                                     data[(y*width + (x+1)) * 4],
        data[((y+1)*width + (x-1)) * 4], data[((y+1)*width + x) * 4], data[((y+1)*width + (x+1)) * 4]
      ];
      
      const maxNeighbor = Math.max(...neighbors);
      const minNeighbor = Math.min(...neighbors);
      const avgNeighbor = neighbors.reduce((a, b) => a + b) / neighbors.length;
      
      let refined = current;
      
      // エッジ検出と強化
      if (maxNeighbor - minNeighbor > 100) { // エッジ領域
        if (current > avgNeighbor) {
          refined = Math.min(255, current * 1.2); // 人物側を強化
        } else {
          refined = Math.max(0, current * 0.5); // 背景側を減衰
        }
      }
      
      result[index] = refined;
      result[index + 1] = refined;
      result[index + 2] = refined;
      result[index + 3] = refined;
    }
  }
  
  return result;
}

// アンチエイリアシング
function applyAntiAliasing(data, width, height) {
  if (blurAmount === 0) return data;
  
  const result = new Uint8ClampedArray(data);
  const radius = Math.min(blurAmount, 3); // 最大3ピクセルまで
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const index = (y * width + x) * 4;
      const current = data[index];
      
      // エッジピクセルのみに適用
      const neighbors = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          neighbors.push(data[((y + dy) * width + (x + dx)) * 4]);
        }
      }
      
      const variance = neighbors.reduce((sum, val) => sum + Math.pow(val - current, 2), 0) / neighbors.length;
      
      if (variance > 1000) { // エッジ部分
        let sum = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= radius) {
              const weight = 1 - (distance / radius);
              sum += data[((y + dy) * width + (x + dx)) * 4] * weight;
              count += weight;
            }
          }
        }
        
        const smoothed = Math.round(sum / count);
        result[index] = smoothed;
        result[index + 1] = smoothed;
        result[index + 2] = smoothed;
        result[index + 3] = smoothed;
      }
    }
  }
  
  return result;
}

// 膨張処理（既存の改良版）
function dilate(data, width, height, radius) {
  const result = new Uint8ClampedArray(data.length);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      let maxValue = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= radius) {
              const nIndex = (ny * width + nx) * 4;
              maxValue = Math.max(maxValue, data[nIndex]);
            }
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

// 収縮処理（既存の改良版）
function erode(data, width, height, radius) {
  const result = new Uint8ClampedArray(data.length);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      let minValue = 255;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= radius) {
              const nIndex = (ny * width + nx) * 4;
              minValue = Math.min(minValue, data[nIndex]);
            }
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

// マスクにぼかし処理を適用
function applyBlurToMask(imageData, width, height, radius) {
  if (radius === 0) return;
  
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  // 簡単なボックスブラー
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      
      // 周囲のピクセルの平均を計算
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const idx = (ny * width + nx) * 4;
            sum += data[idx];
            count++;
          }
        }
      }
      
      const idx = (y * width + x) * 4;
      const avg = count > 0 ? Math.round(sum / count) : 0;
      output[idx] = avg;
      output[idx + 1] = avg;
      output[idx + 2] = avg;
      output[idx + 3] = avg;
    }
  }
  
  // 結果をコピー
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }
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

// カメラデバイス取得
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

// ビデオフレームの処理
async function processVideo() {
  if (!videoElement || !selfieSegmentation) return;
  
  if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
    await selfieSegmentation.send({ image: videoElement });
  }
  
  requestAnimationFrame(processVideo);
}

async function startCamera(deviceId = null) {
  try {
    console.log('Starting camera with deviceId:', deviceId);
    
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
        frameRate: { ideal: 15, max: 30 }
      }
    };
    
    // 特定のデバイスIDが指定されている場合は使用
    if (savedDeviceId) {
      constraints.video.deviceId = { exact: savedDeviceId };
    } else {
      constraints.video.facingMode = 'user';
    }
    
    console.log('Camera constraints:', constraints);
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentCameraId = savedDeviceId;
    
    videoElement.srcObject = stream;
    
    // Promiseでビデオのロードを待機
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 10000);
      
      videoElement.onloadedmetadata = () => {
        clearTimeout(timeout);
        console.log('Video loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
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
      console.log('Starting video processing...');
      processVideo();
    } else {
      throw new Error('MediaPipe not initialized');
    }
    
    console.log('Camera started successfully');
    
  } catch (error) {
    console.error('Error accessing camera:', error);
    
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

// カメラドロップダウンの初期化
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
      console.log('Threshold changed to:', segmentationThreshold);
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
      console.log('Blur amount changed to:', blurAmount);
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
    console.log('DOM loaded, starting initialization...');
    
    initializeSettings();
    initializeResizeHandles();
    
    // MediaPipeを初期化して待機
    console.log('Initializing MediaPipe...');
    await initializeSelfieSegmentation();
    console.log('MediaPipe initialization complete');
    
    // カメラ選択を初期化
    console.log('Initializing camera select...');
    await initializeCameraSelect();
    
    // カメラを開始
    const savedCameraId = localStorage.getItem('selectedCameraId');
    console.log('Starting camera with saved ID:', savedCameraId);
    await startCamera(savedCameraId);
    
    console.log('All initialization complete');
    
  } catch (error) {
    console.error('Initialization failed:', error);
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