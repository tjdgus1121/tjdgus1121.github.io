import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js';

let detector = null;

(async () => {
    try {
        detector = await pipeline('object-detection', 'Xenova/yolos-small', { dtype: 'q8' });
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
