// activity15webworker.js (수정된 버전)
importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.min.js');

// ONNX Runtime 설정
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = false;

let session = null;

// 모델 로드 함수
async function loadModel(modelPath) {
  try {
    self.postMessage({ type: 'status', message: `모델 로딩 중: ${modelPath}`, color: 'blue' });
    
    const sessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'basic'
    };
    
    session = await ort.InferenceSession.create(modelPath, sessionOptions);
    self.postMessage({ type: 'status', message: '모델 로딩 완료!', color: 'green' });
    self.postMessage({ type: 'model_loaded' });
  } catch (error) {
    console.error('Model loading error:', error);
    self.postMessage({ type: 'status', message: '모델 로딩 실패: ' + error.message, color: 'red' });
    self.postMessage({ type: 'error', error: error.message });
  }
}

// 이미지 데이터 정규화 함수 (수정된 버전)
async function normalizeImageData(imageData, width, height) {
  const inputData = new Float32Array(1 * 3 * height * width);
  const totalPixels = height * width;
  
  // 메모리 효율성을 위해 청크 크기 조정
  const chunkSize = Math.min(10000, Math.max(1000, Math.floor(totalPixels / 50)));
  
  for (let i = 0; i < totalPixels; i += chunkSize) {
    const endIndex = Math.min(i + chunkSize, totalPixels);
    
    for (let j = i; j < endIndex; j++) {
      const pixelIndex = j * 4;
      
      // RGB 값을 정확히 추출하고 정규화 (0-1 범위)
      const r = imageData[pixelIndex] / 255.0;
      const g = imageData[pixelIndex + 1] / 255.0;
      const b = imageData[pixelIndex + 2] / 255.0;
      
      // 채널별로 올바른 인덱스에 저장 (CHW 형식)
      inputData[j] = r;                               // R 채널
      inputData[j + totalPixels] = g;                 // G 채널  
      inputData[j + 2 * totalPixels] = b;             // B 채널
    }
    
    // 진행도 업데이트 (전처리: 0-20%)
    const progress = Math.floor((endIndex / totalPixels) * 20);
    self.postMessage({ type: 'progress', progress });
    
    // 주기적으로 메인 스레드에 제어권 양보
    if (i % (chunkSize * 3) === 0) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
  
  return inputData;
}

// 출력 데이터 후처리 함수 (수정된 버전)
async function denormalizeOutputData(outputData, width, height) {
  const totalPixels = height * width;
  const outputImageData = new Uint8ClampedArray(totalPixels * 4);
  
  const chunkSize = Math.min(10000, Math.max(1000, Math.floor(totalPixels / 50)));
  
  for (let i = 0; i < totalPixels; i += chunkSize) {
    const endIndex = Math.min(i + chunkSize, totalPixels);
    
    for (let j = i; j < endIndex; j++) {
      const pixelIndex = j * 4;
      
      // CHW 형식에서 RGB 값 추출
      const r = outputData[j];                        // R 채널
      const g = outputData[j + totalPixels];          // G 채널
      const b = outputData[j + 2 * totalPixels];      // B 채널
      
      // 값 범위 검증 및 정규화
      // 일부 모델은 0-1 범위, 일부는 0-255 범위를 출력할 수 있음
      const normalizeValue = (val) => {
        if (val > 1.0) {
          // 이미 0-255 범위인 경우
          return Math.min(255, Math.max(0, Math.round(val)));
        } else {
          // 0-1 범위인 경우
          return Math.min(255, Math.max(0, Math.round(val * 255)));
        }
      };
      
      outputImageData[pixelIndex] = normalizeValue(r);     // R
      outputImageData[pixelIndex + 1] = normalizeValue(g); // G
      outputImageData[pixelIndex + 2] = normalizeValue(b); // B
      outputImageData[pixelIndex + 3] = 255;               // A (불투명)
    }
    
    // 진행도 업데이트 (후처리: 70-100%)
    const progress = 70 + Math.floor((endIndex / totalPixels) * 30);
    self.postMessage({ type: 'progress', progress: Math.min(100, progress) });
    
    // 주기적으로 메인 스레드에 제어권 양보
    if (i % (chunkSize * 3) === 0) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
  
  return outputImageData;
}

// 스타일 전송 처리 함수 (수정된 버전)
async function processStyleTransfer(imageData, width, height) {
  try {
    if (!session) {
      throw new Error('모델이 로드되지 않았습니다');
    }

    // 입력 데이터 검증
    if (!imageData || imageData.length !== width * height * 4) {
      throw new Error('이미지 데이터가 올바르지 않습니다');
    }

    self.postMessage({ type: 'status', message: '이미지 데이터 전처리 중...', color: 'blue' });
    self.postMessage({ type: 'progress', progress: 0 });
    
    // 전처리: ImageData를 ONNX 입력 텐서로 변환
    const inputData = await normalizeImageData(imageData, width, height);
    
    self.postMessage({ type: 'status', message: '텐서 생성 중...', color: 'blue' });
    self.postMessage({ type: 'progress', progress: 25 });
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // ONNX 텐서 생성 (NCHW 형식: [batch, channels, height, width])
    const inputTensor = new ort.Tensor('float32', inputData, [1, 3, height, width]);
    
    self.postMessage({ type: 'status', message: 'AI 모델 추론 중... (시간이 걸릴 수 있습니다)', color: 'blue' });
    self.postMessage({ type: 'progress', progress: 30 });

    // 모델 실행
    const feeds = {};
    const inputNames = session.inputNames;
    feeds[inputNames[0]] = inputTensor;
    
    const results = await session.run(feeds);
    
    // 출력 텐서 가져오기
    const outputNames = session.outputNames;
    const outputTensor = results[outputNames[0]];
    
    if (!outputTensor) {
      throw new Error('모델 출력을 찾을 수 없습니다');
    }
    
    // 출력 텐서 형태 검증
    const outputShape = outputTensor.dims;
    console.log('Output shape:', outputShape);
    
    // 출력이 NCHW 형식인지 확인
    if (outputShape.length !== 4 || outputShape[0] !== 1 || outputShape[1] !== 3) {
      throw new Error(`예상치 못한 출력 형태: ${outputShape}`);
    }
    
    const outputHeight = outputShape[2];
    const outputWidth = outputShape[3];
    
    self.postMessage({ type: 'progress', progress: 70 });
    self.postMessage({ type: 'status', message: '결과 이미지 후처리 중...', color: 'blue' });

    // 후처리: 출력 텐서를 ImageData로 변환
    const outputImageData = await denormalizeOutputData(outputTensor.data, outputWidth, outputHeight);

    // 결과 전송
    self.postMessage({ 
      type: 'style_transfer_complete', 
      imageData: outputImageData, 
      width: outputWidth, 
      height: outputHeight 
    });
    
    self.postMessage({ type: 'status', message: '스타일 전송 완료!', color: 'green' });
    self.postMessage({ type: 'progress', progress: 100 });

  } catch (error) {
    console.error('Style transfer error:', error);
    self.postMessage({ type: 'status', message: '스타일 전송 실패: ' + error.message, color: 'red' });
    self.postMessage({ type: 'error', error: error.message });
  }
}

// 메시지 리스너
self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'load_model':
      await loadModel(data.modelPath);
      break;
      
    case 'process_style_transfer':
      await processStyleTransfer(data.imageData, data.width, data.height);
      break;
      
    case 'ping':
      self.postMessage({ type: 'pong' });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};