// activity15webworker.js — 빠른 스타일 변환(화풍마다 미리 학습된 신경망) 추론 워커
// 메인 화면이 멈추지 않도록 모델 다운로드·추론을 여기서 한다.
const ONNX_RUNTIME_VERSION = '1.26.0';
const ONNX_RUNTIME_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_VERSION}/dist/`;
importScripts(`${ONNX_RUNTIME_BASE}ort.min.js`);

ort.env.wasm.wasmPaths = ONNX_RUNTIME_BASE;
ort.env.wasm.numThreads = 1;   // GitHub Pages는 교차 출처 격리가 아니라 다중 스레드를 못 씀

// 모델 주소 → 세션 Promise. 한 번 받은 화풍은 다시 받지 않고, 받는 중에 변환을 누르면 그 Promise를 기다린다.
const sessions = new Map();

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`모델 파일을 받지 못했습니다 (HTTP ${res.status})`);
  const total = Number(res.headers.get('Content-Length')) || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(99, Math.round(got / total * 100)));
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }
  return bytes;
}

function getSession(url) {
  if (!sessions.has(url)) {
    const p = (async () => {
      self.postMessage({ type: 'model_progress', url, percent: 0 });
      const bytes = await fetchWithProgress(url, percent => self.postMessage({ type: 'model_progress', url, percent }));
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      self.postMessage({ type: 'model_ready', url });
      return session;
    })();
    // 실패한 화풍은 기록에서 지워 다음에 다시 시도할 수 있게 한다
    p.catch(() => sessions.delete(url));
    sessions.set(url, p);
  }
  return sessions.get(url);
}

// RGBA 바이트 → [1, 3, 높이, 너비] float32 (0~255 그대로. 이 모델들은 0~255 값을 받는다)
function toTensorData(rgba, width, height) {
  const n = width * height;
  const out = new Float32Array(3 * n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    out[i] = rgba[p];
    out[i + n] = rgba[p + 1];
    out[i + 2 * n] = rgba[p + 2];
  }
  return out;
}

// [1, 3, 높이, 너비] 출력 → RGBA 바이트. 출력은 0~255 범위의 실수라 반올림하고 0~255로 자른다.
function toRGBA(data, width, height) {
  const n = width * height;
  const out = new Uint8ClampedArray(n * 4);   // Uint8ClampedArray가 0~255 자르기와 반올림을 해 준다
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    out[p] = data[i];
    out[p + 1] = data[i + n];
    out[p + 2] = data[i + 2 * n];
    out[p + 3] = 255;
  }
  return out;
}

async function run({ id, url, width, height, pixels }) {
  const session = await getSession(url);
  self.postMessage({ type: 'running', id });
  const t0 = performance.now();
  const input = new ort.Tensor('float32', toTensorData(new Uint8ClampedArray(pixels), width, height), [1, 3, height, width]);
  const results = await session.run({ [session.inputNames[0]]: input });
  const output = results[session.outputNames[0]];
  const [, c, h, w] = output.dims;
  if (c !== 3) throw new Error(`예상과 다른 출력 형태입니다: ${output.dims.join('×')}`);
  const rgba = toRGBA(output.data, w, h);
  const ms = performance.now() - t0;
  self.postMessage({ type: 'done', id, width: w, height: h, pixels: rgba.buffer, ms }, [rgba.buffer]);
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'preload') await getSession(msg.url);
    else if (msg.type === 'run') await run(msg);
  } catch (error) {
    self.postMessage({ type: 'error', id: msg.id ?? null, url: msg.url, message: error && error.message ? error.message : String(error) });
  }
};
