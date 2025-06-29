// activity15_styletransfer.js (수정된 버전)
const contentInput = document.getElementById('contentInput');
const styleSelect = document.getElementById('styleSelect');
const runBtn = document.getElementById('runBtn');
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const canvas = document.getElementById('outputCanvas');
const downloadBtn = document.getElementById('downloadBtn');
const previewImg = document.getElementById('previewImg');
const ctx = canvas.getContext('2d');

let worker = null;
let contentImg = null;
let isProcessing = false;

// Web Worker 초기화
function initWorker() {
  if (worker) {
    worker.terminate();
  }
  
  worker = new Worker('./activity15webworker.js');
  
  worker.onmessage = function(e) {
    const { type, message, color, progress, imageData, width, height, error } = e.data;
    
    switch (type) {
      case 'status':
        updateStatus(message, color);
        break;
        
      case 'progress':
        updateProgress(progress);
        break;
        
      case 'model_loaded':
        runBtn.disabled = (contentImg === null);
        break;
        
      case 'style_transfer_complete':
        displayResult(imageData, width, height);
        isProcessing = false;
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-magic"></i> 스타일 적용';
        hideProgress();
        break;
        
      case 'error':
        console.error('Worker error:', error);
        updateStatus('처리 중 오류가 발생했습니다: ' + error, 'red');
        isProcessing = false;
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-magic"></i> 스타일 적용';
        hideProgress();
        break;
    }
  };
  
  worker.onerror = function(error) {
    console.error('Worker error:', error);
    updateStatus('Web Worker 오류가 발생했습니다', 'red');
    isProcessing = false;
    runBtn.disabled = false;
    runBtn.innerHTML = '<i class="fas fa-magic"></i> 스타일 적용';
    hideProgress();
  };
}

// 상태 업데이트
function updateStatus(msg, color = 'black') {
  statusEl.textContent = msg;
  statusEl.className = '';
  
  switch (color) {
    case 'green':
      statusEl.classList.add('success');
      break;
    case 'red':
      statusEl.classList.add('error');
      break;
    case 'blue':
      statusEl.classList.add('loading');
      break;
    default:
      statusEl.style.color = color;
  }
}

// 진행률 업데이트
function updateProgress(progress) {
  if (progressBar && progressText) {
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
    
    if (progress >= 100) {
      setTimeout(hideProgress, 1000);
    }
  }
}

// 진행률 표시
function showProgress() {
  const progressContainer = document.getElementById('progressContainer');
  if (progressContainer) {
    progressContainer.style.display = 'block';
    updateProgress(0);
  }
}

// 진행률 숨기기
function hideProgress() {
  const progressContainer = document.getElementById('progressContainer');
  if (progressContainer) {
    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 500);
  }
}

// 결과 이미지 표시 (수정된 버전)
function displayResult(imageData, width, height) {
  try {
    canvas.width = width;
    canvas.height = height;
    
    // ImageData 객체 생성 및 검증
    if (imageData.length !== width * height * 4) {
      throw new Error(`이미지 데이터 크기가 맞지 않습니다: ${imageData.length} !== ${width * height * 4}`);
    }
    
    const imgData = new ImageData(new Uint8ClampedArray(imageData), width, height);
    ctx.putImageData(imgData, 0, 0);
    
    // 다운로드 버튼 활성화
    if (downloadBtn) {
      downloadBtn.style.display = 'inline-flex';
      downloadBtn.onclick = () => downloadImage();
    }
    
    updateStatus('스타일 전송 완료!', 'green');
    
  } catch (error) {
    console.error('Display result error:', error);
    updateStatus('결과 표시 중 오류가 발생했습니다: ' + error.message, 'red');
  }
}

// 이미지 다운로드
function downloadImage() {
  try {
    const link = document.createElement('a');
    link.download = `styled_image_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download error:', error);
    updateStatus('다운로드 중 오류가 발생했습니다', 'red');
  }
}

// 이미지 미리보기 업데이트
function updatePreview(img) {
  if (previewImg) {
    previewImg.src = img.src;
    previewImg.style.display = 'block';
  }
}

// 이미지 크기 조정 함수
function resizeImage(img, maxDimension = 768) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  let { width, height } = img;
  
  // 최대 크기 제한 (메모리 및 성능 고려)
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }
  
  canvas.width = width;
  canvas.height = height;
  
  // 고품질 리샘플링 설정
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  
  return { canvas, width, height };
}

// 이미지 업로드 처리 (수정된 버전)
contentInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  
  // 파일 크기 체크 (10MB 제한)
  if (file.size > 10 * 1024 * 1024) {
    updateStatus('파일 크기가 너무 큽니다 (최대 10MB)', 'red');
    return;
  }
  
  // 파일 형식 체크
  if (!file.type.startsWith('image/')) {
    updateStatus('이미지 파일만 업로드 가능합니다', 'red');
    return;
  }
  
  updateStatus('이미지 로딩 중…', 'blue');
  
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      try {
        // 이미지 크기 조정 (성능 최적화를 위해 768px로 제한)
        const { canvas: resizedCanvas, width, height } = resizeImage(img, 768);
        
        // 새로운 이미지 객체 생성
        const resizedImg = new Image();
        resizedImg.onload = () => {
          contentImg = resizedImg;
          updatePreview(resizedImg);
          
          const sizeMsg = (width !== img.width || height !== img.height) 
            ? ` (${width}×${height}로 리사이즈됨)` 
            : '';
          updateStatus(`콘텐츠 준비 완료${sizeMsg}`, 'green');
          
          runBtn.disabled = !worker;
          
          // 캔버스에 원본 이미지 표시
          canvas.width = width;
          canvas.height = height;
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(resizedImg, 0, 0);
        };
        
        resizedImg.onerror = () => {
          updateStatus('리사이즈된 이미지 로딩 실패', 'red');
        };
        
        resizedImg.src = resizedCanvas.toDataURL('image/png', 1.0);
        
      } catch (error) {
        console.error('Image processing error:', error);
        updateStatus('이미지 처리 중 오류가 발생했습니다', 'red');
      }
    };
    
    img.onerror = () => {
      updateStatus('이미지 로딩 실패', 'red');
    };
    
    img.src = reader.result;
  };
  
  reader.onerror = () => {
    updateStatus('파일 읽기 실패', 'red');
  };
  
  reader.readAsDataURL(file);
});

// 스타일 변경 시 모델 재로드
styleSelect.addEventListener('change', () => {
  if (worker && !isProcessing) {
    updateStatus('새로운 스타일 모델 로딩 중...', 'blue');
    runBtn.disabled = true;
    worker.postMessage({
      type: 'load_model',
      data: { modelPath: styleSelect.value }
    });
  }
});

// 스타일 전송 실행 (수정된 버전)
runBtn.addEventListener('click', async () => {
  if (!worker || !contentImg || isProcessing) return;
  
  isProcessing = true;
  runBtn.disabled = true;
  runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 처리 중...';
  
  showProgress();
  updateStatus('이미지 데이터 준비 중...', 'blue');
  
  try {
    // 캔버스에서 이미지 데이터 추출
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = contentImg.width;
    tempCanvas.height = contentImg.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(contentImg, 0, 0);
    
    const imageData = tempCtx.getImageData(0, 0, contentImg.width, contentImg.height);
    
    // 데이터 검증
    if (!imageData.data || imageData.data.length === 0) {
      throw new Error('이미지 데이터를 추출할 수 없습니다');
    }
    
    console.log(`Processing image: ${contentImg.width}x${contentImg.height}, data length: ${imageData.data.length}`);
    
    // Web Worker에게 처리 요청
    worker.postMessage({
      type: 'process_style_transfer',
      data: {
        imageData: Array.from(imageData.data), // Uint8ClampedArray를 일반 배열로 변환
        width: contentImg.width,
        height: contentImg.height
      }
    });
    
  } catch (error) {
    console.error('Image processing error:', error);
    updateStatus('이미지 처리 중 오류가 발생했습니다: ' + error.message, 'red');
    isProcessing = false;
    runBtn.disabled = false;
    runBtn.innerHTML = '<i class="fas fa-magic"></i> 스타일 적용';
    hideProgress();
  }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initWorker();
  
  // 초기 모델 로드
  setTimeout(() => {
    if (worker && styleSelect.value) {
      worker.postMessage({
        type: 'load_model',
        data: { modelPath: styleSelect.value }
      });
    }
  }, 1000);
  
  updateStatus('이미지와 스타일을 선택하세요.', 'black');
});

// 페이지 언로드 시 Worker 정리
window.addEventListener('beforeunload', () => {
  if (worker) {
    worker.terminate();
  }
});