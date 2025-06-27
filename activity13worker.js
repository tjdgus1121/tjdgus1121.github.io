// activity13worker.js
importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');
// ONNX Runtime Web WASM 로딩 경로 설정
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

let session = null;
self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      session = await ort.InferenceSession.create('realesrgan-x4v3-dynamic.onnx');
      self.postMessage({ type: 'inited' });
    } catch (err) {
      self.postMessage({ type: 'initError', error: err.message });
    }
  } else if (msg.type === 'processTile') {
    const { imageBitmap, x, y, w, h, scale } = msg;
    // OffscreenCanvas로 타일 처리
    const off = new OffscreenCanvas(w, h);
    const ctx = off.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // 텐서 생성
    const floatData = new Float32Array(3 * w * h);
    for (let i = 0; i < w * h; i++) {
      floatData[i] = data[i*4] / 255;
      floatData[i + w*h] = data[i*4 + 1] / 255;
      floatData[i + 2*w*h] = data[i*4 + 2] / 255;
    }
    const inputTensor = new ort.Tensor('float32', floatData, [1, 3, h, w]);

    // 모델 추론
    const outputMap = await session.run({ input: inputTensor });
    const outTensor = outputMap.output;
    const [_, __, oh, ow] = outTensor.dims;

    // 출력 ImageData로 변환
    const outData = new Uint8ClampedArray(ow * oh * 4);
    for (let i = 0; i < ow * oh; i++) {
      outData[i*4]     = outTensor.data[i] * 255;
      outData[i*4 + 1] = outTensor.data[i + ow*oh] * 255;
      outData[i*4 + 2] = outTensor.data[i + 2*ow*oh] * 255;
      outData[i*4 + 3] = 255;
    }

    // 메인 스레드로 전송 (Transferable)
    self.postMessage({
      type: 'tileDone',
      x, y, ow, oh,
      imageData: outData.buffer
    }, [outData.buffer]);
  }
};
