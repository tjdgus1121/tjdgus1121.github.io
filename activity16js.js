// ===== DOM References =====
const statusEl          = document.getElementById('status');
const runBtn            = document.getElementById('runBtn');
const buttonText        = document.getElementById('buttonText');
const contentImgInput   = document.getElementById('contentImg');
const styleImgInput     = document.getElementById('styleImg');
const contentPreview    = document.getElementById('contentPreview');
const stylePreview      = document.getElementById('stylePreview');
const canvas            = document.getElementById('canvas');
const downloadBtn       = document.getElementById('downloadBtn');
const contentInputWrapper = document.getElementById('contentInputWrapper');
const styleInputWrapper   = document.getElementById('styleInputWrapper');
// ===== State =====
let currentModel   = 'magenta'; // 'magenta' | 'onnx'
let magentaModel   = null;      // mi.ArbitraryStyleTransferNetwork instance
let onnxSession    = null;

// ===== Utilities =====
function setStatus(message, type = '') {
  statusEl.innerHTML = type === 'loading'
    ? `<div class="loading-spinner"></div>${message}`
    : message;
  statusEl.className = `status ${type}`;
}

function updateRunButton() {
  const hasContent = contentImgInput.files.length > 0;
  const hasStyle   = styleImgInput.files.length > 0;
  const modelReady = currentModel === 'magenta' ? magentaModel !== null : onnxSession !== null;
  runBtn.disabled  = !(hasContent && hasStyle && modelReady);
}

// ===== Script loader helper =====
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
    document.head.appendChild(s);
  });
}

// ===== Image → Canvas helper =====
function imageToCanvas(imgEl, maxSize) {
  let w = imgEl.naturalWidth  || imgEl.width;
  let h = imgEl.naturalHeight || imgEl.height;
  if (maxSize && (w > maxSize || h > maxSize)) {
    const s = Math.min(maxSize / w, maxSize / h);
    w = Math.round(w * s); h = Math.round(h * s);
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(imgEl, 0, 0, w, h);
  return c;
}

// ===== Model: Magenta (@magenta/image) =====
// Uses storage.googleapis.com/magentadata/ — separate from TFHub/Kaggle, CORS 허용
async function loadMagenta() {
  if (magentaModel) {
    setStatus('✅ Magenta 모델 준비 완료!', 'success');
    return;
  }
  setStatus('🧠 TF.js 3.x 로드 중...', 'loading');
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js');

  setStatus('🧠 @magenta/image 라이브러리 로드 중...', 'loading');
  await loadScript('https://cdn.jsdelivr.net/npm/@magenta/image@0.2.1/dist/magentaimage.min.js');

  setStatus('🧠 Magenta 모델 다운로드 중... (최초 1회, 약 30MB)', 'loading');
  // mi = window.mi (UMD global from @magenta/image)
  magentaModel = new mi.ArbitraryStyleTransferNetwork();
  await magentaModel.initialize();
  setStatus('✅ Magenta 모델 준비 완료!', 'success');
}

async function runMagenta() {
  const contentCanvas = imageToCanvas(contentPreview, 512);
  const styleCanvas   = imageToCanvas(stylePreview,   256);

  // stylize() returns ImageData with same dims as contentCanvas
  const resultData = await magentaModel.stylize(contentCanvas, styleCanvas);

  canvas.width  = contentCanvas.width;
  canvas.height = contentCanvas.height;
  canvas.getContext('2d').putImageData(resultData, 0, 0);
}

// ===== Model: ONNX =====
async function loadOnnx() {
  if (onnxSession) {
    setStatus('✅ ONNX 모델 준비 완료!', 'success');
    return;
  }
  setStatus('⚙️ ONNX 모델 로드 중...', 'loading');
  onnxSession = await ort.InferenceSession.create('model/style_dynamic.onnx', {
    executionProviders: ['wasm'],
  });
  setStatus('✅ ONNX 모델 준비 완료!', 'success');
}

function fileToTensor(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        const s = Math.min(maxSize / w, maxSize / h);
        w = Math.round(w * s); h = Math.round(h * s);
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const d = c.getContext('2d').getImageData(0, 0, w, h).data;
      const f = new Float32Array(w * h * 3);
      for (let i = 0; i < w * h; i++) {
        f[i * 3]     = d[i * 4]     / 255;
        f[i * 3 + 1] = d[i * 4 + 1] / 255;
        f[i * 3 + 2] = d[i * 4 + 2] / 255;
      }
      resolve(new ort.Tensor('float32', f, [1, h, w, 3]));
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = URL.createObjectURL(file);
  });
}

async function runOnnx() {
  const [cTensor, sTensor] = await Promise.all([
    fileToTensor(contentImgInput.files[0]),
    fileToTensor(styleImgInput.files[0]),
  ]);
  const feeds = {};
  feeds[onnxSession.inputNames[0]] = cTensor;
  feeds[onnxSession.inputNames[1]] = sTensor;
  const results = await onnxSession.run(feeds);
  const out = results[onnxSession.outputNames[0]];

  const [, h, w] = out.dims;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  for (let i = 0; i < h * w; i++) {
    imgData.data[i * 4]     = Math.max(0, Math.min(255, out.data[i * 3]     * 255));
    imgData.data[i * 4 + 1] = Math.max(0, Math.min(255, out.data[i * 3 + 1] * 255));
    imgData.data[i * 4 + 2] = Math.max(0, Math.min(255, out.data[i * 3 + 2] * 255));
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

// ===== Model Selection =====
async function selectModel(model) {
  currentModel = model;
  document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-${model}`).classList.add('active');
  updateRunButton();
  await initCurrentModel();
}

async function initCurrentModel() {
  try {
    if (currentModel === 'magenta') {
      await loadMagenta();
    } else {
      await loadOnnx();
    }
    updateRunButton();
  } catch (e) {
    setStatus(`❌ 모델 로드 실패: ${e.message}`, 'error');
  }
}

// ===== Run =====
runBtn.addEventListener('click', async () => {
  try {
    runBtn.disabled = true;
    buttonText.textContent = '🔄 처리 중...';

    if (currentModel === 'magenta') {
      setStatus('🎨 Magenta로 스타일 변환 중...', 'loading');
      await runMagenta();
      setStatus(`✨ Magenta 변환 완료! (${canvas.width}×${canvas.height}px)`, 'success');
    } else {
      setStatus('⚙️ ONNX 모델로 변환 중...', 'loading');
      await runOnnx();
      setStatus(`✨ ONNX 변환 완료! (${canvas.width}×${canvas.height}px)`, 'success');
    }

    downloadBtn.style.display = 'block';
  } catch (e) {
    console.error(e);
    setStatus(`❌ 오류: ${e.message}`, 'error');
  } finally {
    buttonText.textContent = '✨ 스타일 변환하기';
    updateRunButton();
  }
});

// ===== Image Preview =====
function previewImage(file, imgEl, placeholderEl, wrapperEl) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    imgEl.src = e.target.result;
    imgEl.style.display = 'block';
    placeholderEl.style.display = 'none';
    wrapperEl.classList.add('has-file');
  };
  reader.readAsDataURL(file);
}

contentImgInput.addEventListener('change', e => {
  previewImage(e.target.files[0], contentPreview,
    document.getElementById('contentPlaceholder'), contentInputWrapper);
  updateRunButton();
});

styleImgInput.addEventListener('change', e => {
  previewImage(e.target.files[0], stylePreview,
    document.getElementById('stylePlaceholder'), styleInputWrapper);
  updateRunButton();
});

stylePromptInput.addEventListener('input', updateRunButton);

// ===== Download =====
downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `stylized-${currentModel}.png`;
  link.href = canvas.toDataURL();
  link.click();
});

// ===== Init =====
setStatus('🔄 초기화 중...', 'loading');
initCurrentModel();
