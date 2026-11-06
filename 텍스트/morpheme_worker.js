/**
 * morpheme_worker.js
 * Web Worker — TF.js 형태소 분석 전담 (메인 스레드 블로킹 없음)
 * 메시지 프로토콜:
 *   받기: { type:'init' } | { type:'analyze', sentences:[...] }
 *   보내기: { type:'ready', charCount, tagCount }
 *          | { type:'progress', index, total, text }
 *          | { type:'done', allRaw }
 *          | { type:'error', message }
 *
 * [개선] 추론 방식: 어절 단위 독립 처리 → 문장 전체 연속 처리
 *   - 학습 시 공백 제거한 전체 문장을 한 시퀀스로 입력한 것과 동일한 방식
 *   - BiLSTM이 어절 경계를 넘어 양방향 문맥을 활용 가능
 *   - MAX_LEN 초과 시 어절 경계에서 분할하여 청크 처리
 */

importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');

const PUNCT_RE   = /[.,!?;:'"()\[\]…·~—「」『』【】《》〈〉‥]/g;
let MAX_LEN   = 128;  // 모델 로드 후 실제 값으로 덮어씀
let model    = null;
let char2idx = null;
let idx2tag  = null;
let jamoVocab = null;

// ── 자모 분해 ───────────────────────────────────────
function decomposeJamo(ch) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return [0, 0, 0];
    return [Math.floor(code / (21 * 28)), Math.floor((code % (21 * 28)) / 28), code % 28];
}

// ── 초기화 ─────────────────────────────────────────
async function init() {
    // jamo_vocab.json은 재학습 후에만 존재 → 없으면 null로 유지
    const jamoP = fetch('jamo_vocab.json').then(r => r.json()).catch(() => null);
    const [m, c, i, jamo] = await Promise.all([
        tf.loadLayersModel('tfjs_model/model.json'),
        fetch('char2idx.json').then(r => r.json()),
        fetch('idx2tag.json').then(r => r.json()),
        jamoP
    ]);
    model    = m;
    char2idx = c;
    idx2tag  = i;

    // 모델의 실제 입력 시퀀스 길이를 읽어서 MAX_LEN 동기화
    MAX_LEN = m.inputs[0].shape[1] || 128;

    // 모델 입력 수로 자모 모드 자동 판단
    // (jamo_vocab.json 없이 4-입력 모델이 로드되면 fallback 처리)
    const isMultiInput = m.inputNames && m.inputNames.length > 1;
    if (isMultiInput && !jamo) {
        throw new Error('4-입력 모델이지만 jamo_vocab.json이 없습니다. 학습 완료 후 새로고침하세요.');
    }
    jamoVocab = isMultiInput ? jamo : null;

    self.postMessage({
        type: 'ready',
        charCount: Object.keys(c).length,
        tagCount:  Object.keys(i).length,
        jamoEnabled: isMultiInput
    });
}

// ── 문장 전체 컨텍스트 추론 ─────────────────────────
// 학습: 공백 제거한 전체 문장 → 모델 입력 (훈련 분포와 동일)
// 추론: 어절들을 이어붙인 연속 시퀀스로 처리, MAX_LEN 초과 시 청크 분할
function analyzeText(text) {
    // 1) 구두점 제거 후 어절 분리
    const eojeols = text.replace(PUNCT_RE, '').split(/\s+/).filter(w => w.length > 0);
    if (eojeols.length === 0) return [];

    // 2) 어절들을 MAX_LEN 이하의 청크로 묶음 (훈련 방식: 연속 문자열)
    const result = [];
    let chunkChars = [];

    const flushChunk = () => {
        if (chunkChars.length === 0) return;
        const morphs = runModel(chunkChars);
        if (morphs.length > 0) result.push({ morphs });
        chunkChars = [];
    };

    for (const eojeol of eojeols) {
        const chars = Array.from(eojeol);
        // 청크가 꽉 차면 먼저 처리 (어절 경계에서 분할)
        if (chunkChars.length > 0 && chunkChars.length + chars.length > MAX_LEN) {
            flushChunk();
        }
        chunkChars.push(...chars);
    }
    flushChunk();

    return result;
}

// ── 단일 청크 모델 추론 ────────────────────────────
function runModel(chars) {
    const ids    = chars.map(c => char2idx[c] ?? 1);
    const padded = [...ids, ...new Array(MAX_LEN).fill(0)].slice(0, MAX_LEN);

    let inputT, outputT, tagIds;

    if (jamoVocab) {
        // 자모 피처 포함 (재학습 후 모델)
        const cho_list = [], jung_list = [], jong_list = [];
        for (const c of chars) {
            const [cho, jung, jong] = decomposeJamo(c);
            cho_list.push(jamoVocab.cho[jamoVocab.chosung[cho]] ?? 0);
            jung_list.push(jamoVocab.jung[jamoVocab.jungsung[jung]] ?? 0);
            jong_list.push(jong > 0 ? (jamoVocab.jong[jamoVocab.jongsung[jong - 1]] ?? 0) : 0);
        }
        const pad = arr => [...arr, ...new Array(MAX_LEN).fill(0)].slice(0, MAX_LEN);
        // NamedTensorMap 대신 ordered array 사용 (TF.js 호환성)
        const tChar = tf.tensor2d([padded],        [1, MAX_LEN], 'int32');
        const tCho  = tf.tensor2d([pad(cho_list)],  [1, MAX_LEN], 'int32');
        const tJung = tf.tensor2d([pad(jung_list)], [1, MAX_LEN], 'int32');
        const tJong = tf.tensor2d([pad(jong_list)], [1, MAX_LEN], 'int32');
        inputT  = [tChar, tCho, tJung, tJong];
        outputT = model.predict(inputT);
        tagIds  = outputT.argMax(-1).arraySync()[0];
        inputT.forEach(t => t.dispose());
    } else {
        // 기존 모델 (문자 임베딩만)
        inputT  = tf.tensor2d([padded], [1, MAX_LEN], 'int32');
        outputT = model.predict(inputT);
        tagIds  = outputT.argMax(-1).arraySync()[0];
        inputT.dispose();
    }
    outputT.dispose();

    return decodeBIO(chars, tagIds);
}

// ── BIO 디코딩 ─────────────────────────────────────
function decodeBIO(chars, tagIds) {
    const morphs = [];
    let curLex = '', curTag = '';
    chars.forEach((char, i) => {
        const tag = idx2tag[String(tagIds[i])] ?? 'O';
        if (tag.startsWith('B-')) {
            if (curLex) morphs.push({ lex: curLex, tag: curTag });
            curLex = char;
            curTag = tag.slice(2);
        } else if (tag.startsWith('I-') && curLex && curTag === tag.slice(2)) {
            // 동일 태그의 I- 시퀀스만 연결
            curLex += char;
        } else if (tag === 'O') {
            // O 태그: 형태소 외부 문자 → 현재 형태소 확정 후 버림
            if (curLex) morphs.push({ lex: curLex, tag: curTag });
            curLex = '';
            curTag = '';
        } else {
            // B- 없이 시작하는 I- 등 예외 → 새 형태소로 처리
            if (curLex) morphs.push({ lex: curLex, tag: curTag });
            curLex = char;
            curTag = tag.replace(/^[BI]-/, '');
        }
    });
    if (curLex) morphs.push({ lex: curLex, tag: curTag });
    return morphs;
}

// ── 전역 오류 → 메인 스레드 전달 ──────────────────
self.onerror = function(msg, src, line, col, err) {
    self.postMessage({ type: 'error', message: `Worker 오류 [${line}:${col}] ${msg}` });
    return true; // 기본 오류 출력 억제
};
self.onunhandledrejection = function(e) {
    const msg = e.reason?.message ?? String(e.reason);
    self.postMessage({ type: 'error', message: `Worker 미처리 거부: ${msg}` });
};

// ── 메시지 핸들러 ───────────────────────────────────
self.onmessage = async function(e) {
    const { type, data } = e.data;

    if (type === 'init') {
        try {
            await init();
        } catch (err) {
            const msg = (typeof err === 'string') ? err
                      : (err?.message && typeof err.message === 'string') ? err.message
                      : JSON.stringify(err) !== '{}' ? JSON.stringify(err)
                      : String(err);
            self.postMessage({ type: 'error', message: msg });
        }

    } else if (type === 'analyze') {
        const sentences = data.sentences;
        const allRaw    = [];
        for (let i = 0; i < sentences.length; i++) {
            try {
                allRaw.push(analyzeText(sentences[i]));
            } catch (err) {
                const msg = err?.message ?? String(err);
                self.postMessage({ type: 'error', message: `문장 ${i} 분석 오류: ${msg}` });
                allRaw.push([]);
            }
            self.postMessage({ type: 'progress', index: i + 1, total: sentences.length, text: sentences[i] });
        }
        self.postMessage({ type: 'done', allRaw });
    }
};
