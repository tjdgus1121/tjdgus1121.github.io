(async () => {
  const statusEl = document.getElementById('status');
  const runBtn = document.getElementById('runBtn');
  const buttonText = document.getElementById('buttonText');
  const contentImg = document.getElementById('contentImg');
  const styleImg = document.getElementById('styleImg');
  const contentPreview = document.getElementById('contentPreview');
  const stylePreview = document.getElementById('stylePreview');
  const canvas = document.getElementById('canvas');
  const downloadBtn = document.getElementById('downloadBtn');
  const contentInputWrapper = document.getElementById('contentInputWrapper');
  const styleInputWrapper = document.getElementById('styleInputWrapper');

  let session = null;
  let originalImageDimensions = null; // 원본 이미지 크기 저장

  // 상태 표시 함수
  function setStatus(message, type = 'info') {
    statusEl.innerHTML = type === 'loading' ? 
      `<div class="loading-spinner"></div>${message}` : message;
    statusEl.className = `status ${type}`;
    console.log(`Status: ${message}`);
  }

  // ONNX 세션 초기화
  async function initializeSession() {
    try {
      setStatus('AI 모델을 불러오는 중...', 'loading');
      const modelPath = "model/style_dynamic.onnx";
      session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm']
      });
      setStatus('🚀 AI 모델 준비 완료! 이미지를 업로드하여 시작하세요.', 'success');
      console.log('Model loaded successfully:', session);
    } catch (error) {
      console.error('Model loading error:', error);
      setStatus(`❌ AI 모델 로딩 실패: ${error.message}`, 'error');
    }
  }

  // 이미지 미리보기 및 원본 크기 저장 함수
  function previewImage(file, imgElement, placeholderElement, wrapperElement, isContentImage = false) {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imgElement.src = e.target.result;
        imgElement.style.display = 'block';
        placeholderElement.style.display = 'none';
        wrapperElement.classList.add('has-file');
        // 원본 이미지인 경우 크기 정보 저장
        if (isContentImage) {
          const img = new Image();
          img.onload = () => {
            originalImageDimensions = {
              width: img.width,
              height: img.height
            };
            console.log('Original image dimensions:', originalImageDimensions);
          };
          img.src = e.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // 이미지를 텐서로 변환 (원본 비율 유지하면서 최대 1024까지 스케일링)
  async function imageToTensor(file, maxSize = 1024) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // 원본 비율을 유지하면서 최대 크기에 맞게 조정
          let targetWidth = img.width;
          let targetHeight = img.height;
          if (targetWidth > maxSize || targetHeight > maxSize) {
            const scale = Math.min(maxSize / targetWidth, maxSize / targetHeight);
            targetWidth = Math.round(targetWidth * scale);
            targetHeight = Math.round(targetHeight * scale);
          }
          // 캔버스 생성
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const data = imageData.data;
          // RGBA를 RGB로 변환하고 0-1로 정규화
          const pixelCount = targetWidth * targetHeight;
          const floatData = new Float32Array(pixelCount * 3);
          for (let i = 0; i < pixelCount; i++) {
            floatData[i * 3 + 0] = data[i * 4 + 0] / 255.0; // R
            floatData[i * 3 + 1] = data[i * 4 + 1] / 255.0; // G
            floatData[i * 3 + 2] = data[i * 4 + 2] / 255.0; // B
          }
          // 텐서 생성 [1, height, width, 3]
          const tensor = new ort.Tensor('float32', floatData, [1, targetHeight, targetWidth, 3]);
          console.log(`Tensor created: ${img.width}x${img.height} → ${targetWidth}x${targetHeight} (원본 비율 유지)`, tensor.dims);
          resolve(tensor);
        } catch (error) {
          console.error('Tensor creation error:', error);
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'));
      img.src = URL.createObjectURL(file);
    });
  }

  // 텐서를 캔버스에 렌더링 (원본 비율 유지)
  function renderToCanvas(tensor, canvas) {
    try {
      const ctx = canvas.getContext('2d');
      const [batch, height, width, channels] = tensor.dims;
      canvas.width = width;
      canvas.height = height;
      console.log('Rendering tensor with dims:', tensor.dims);
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;
      for (let i = 0; i < height * width; i++) {
        const r = Math.max(0, Math.min(255, tensor.data[i * 3 + 0] * 255));
        const g = Math.max(0, Math.min(255, tensor.data[i * 3 + 1] * 255));
        const b = Math.max(0, Math.min(255, tensor.data[i * 3 + 2] * 255));
        data[i * 4 + 0] = r; // R
        data[i * 4 + 1] = g; // G
        data[i * 4 + 2] = b; // B
        data[i * 4 + 3] = 255; // A
      }
      ctx.putImageData(imageData, 0, 0);
      console.log(`렌더링 완료: ${width}x${height}`);
      downloadBtn.style.display = 'inline-block';
    } catch (error) {
      console.error('Rendering error:', error);
      throw error;
    }
  }

  // 버튼 상태 업데이트
  function updateButtonState() {
    const hasContent = contentImg.files.length > 0;
    const hasStyle = styleImg.files.length > 0;
    const hasSession = session !== null;
    runBtn.disabled = !(hasContent && hasStyle && hasSession);
  }

  // 다운로드 기능
  downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'stylized-image.png';
    link.href = canvas.toDataURL();
    link.click();
  });

  // 이벤트 리스너
  contentImg.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      previewImage(file, contentPreview, document.getElementById('contentPlaceholder'), contentInputWrapper, true);
    }
    updateButtonState();
  });

  styleImg.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      previewImage(file, stylePreview, document.getElementById('stylePlaceholder'), styleInputWrapper);
    }
    updateButtonState();
  });

  // 스타일 적용 버튼 클릭
  runBtn.addEventListener('click', async () => {
    const contentFile = contentImg.files[0];
    const styleFile = styleImg.files[0];
    if (!contentFile || !styleFile || !session) {
      setStatus('❌ 두 이미지를 모두 선택하고 AI 모델이 로드되었는지 확인하세요.', 'error');
      return;
    }
    try {
      runBtn.disabled = true;
      buttonText.textContent = '🔄 처리 중...';
      setStatus('🎨 AI가 이미지를 분석하고 스타일을 적용하는 중...', 'loading');
      // 텐서 생성 (원본 비율 유지)
      console.log('원본 비율을 유지하여 텐서로 변환 중...');
      const [contentTensor, styleTensor] = await Promise.all([
        imageToTensor(contentFile, 1024),
        imageToTensor(styleFile, 1024)
      ]);
      console.log('Content tensor:', contentTensor.dims);
      console.log('Style tensor:', styleTensor.dims);
      // 추론 실행
      setStatus('🧠 AI가 예술적 걸작을 만들어내는 중...', 'loading');
      const feeds = {};
      feeds[session.inputNames[0]] = contentTensor;
      feeds[session.inputNames[1]] = styleTensor;
      console.log('Running inference with feeds:', Object.keys(feeds));
      const results = await session.run(feeds);
      console.log('Inference completed, output keys:', Object.keys(results));
      const outputTensor = results[session.outputNames[0]];
      console.log('Output tensor:', outputTensor.dims);
      // 결과 렌더링
      renderToCanvas(outputTensor, canvas);
      const outputWidth = outputTensor.dims[2];
      const outputHeight = outputTensor.dims[1];
      setStatus(`✨ 스타일 변환 완료! 결과 해상도: ${outputWidth}×${outputHeight}px (원본 비율 유지)`, 'success');
    } catch (error) {
      console.error('Processing error:', error);
      setStatus(`❌ 처리 실패: ${error.message}`, 'error');
    } finally {
      buttonText.textContent = '✨ 스타일 변환하기';
      updateButtonState();
    }
  });

  // 초기화
  setStatus('🔄 AI 모델 초기화 중...', 'loading');
  await initializeSession();
  updateButtonState();
})(); 