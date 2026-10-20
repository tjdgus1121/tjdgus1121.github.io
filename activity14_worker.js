import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js';

// GitHub Pages 자체 호스팅 모델 사용
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.localModelPath = 'https://tjdgus1121.github.io/models/';

let detector = null;

// 모델이 분석 직전에 맞추는 해상도 (짧은 변 픽셀). 모델 기본값 800은 저사양 PC에서 사진 한 장에 20초 넘게 걸려
// 480으로 낮춤: 거리 사진 기준 약 5배 빠르고 탐지 결과는 거의 같음. 긴 변은 같은 비율(1333 × 480/800)로 제한
const ANALYSIS_SIZE = { shortest_edge: 480, longest_edge: 800 };

(async () => {
    try {
        detector = await pipeline('object-detection', 'yolos-small', {
            dtype: 'q8',
            // 내려받기 진행률 (파일마다 0~100)
            progress_callback: (p) => {
                if (p.status === 'progress') self.postMessage({ type: 'progress', file: p.file, progress: p.progress });
            },
        });
        const processor = detector.processor.image_processor ?? detector.processor.feature_extractor;
        if (processor) processor.size = ANALYSIS_SIZE;
        self.postMessage({ type: 'ready' });
    } catch (err) {
        self.postMessage({ type: 'load-error', message: err.message });
    }
})();

self.onmessage = async (e) => {
    if (e.data.type !== 'detect') return;
    const id = e.data.id;   // 어느 요청의 결과인지 (웹캠을 끈 뒤 늦게 온 결과를 버리는 데 씀)
    if (!detector) {
        self.postMessage({ type: 'error', id, message: '모델 준비 중입니다.' });
        return;
    }
    try {
        const threshold = e.data.threshold ?? 0.25;
        const results = await detector(e.data.dataUrl, { threshold });
        self.postMessage({ type: 'results', id, results });
    } catch (err) {
        self.postMessage({ type: 'error', id, message: err.message });
    }
};
