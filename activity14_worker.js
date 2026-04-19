import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js';

// GitHub Pages 자체 호스팅 모델 사용
env.allowLocalModels = true;
env.localModelPath = 'https://tjdgus1121.github.io/models/';

let detector = null;

(async () => {
    try {
        detector = await pipeline('object-detection', 'yolos-small', { dtype: 'q8' });
        self.postMessage({ type: 'ready' });
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
})();

self.onmessage = async (e) => {
    if (e.data.type !== 'detect') return;
    if (!detector) {
        self.postMessage({ type: 'error', message: '모델 준비 중입니다.' });
        return;
    }
    try {
        const threshold = e.data.threshold ?? 0.25;
        const results = await detector(e.data.dataUrl, { threshold });
        self.postMessage({ type: 'results', results });
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};
