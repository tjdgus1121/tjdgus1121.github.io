// activity15_styletransfer.js — 신경망 스타일 변환 화면
// 사진 → (크기 맞추기) → 워커에서 화풍 신경망 한 번 통과 → 원본과 나란히 보여 주고, 강도는 (1−t)·원본 + t·변환으로 섞는다.
(() => {
  'use strict';

  const STYLES = [
    { key: 'mosaic', name: '모자이크', en: 'Mosaic', desc: '스테인드글라스 같은 조각 선' },
    { key: 'candy', name: '캔디', en: 'Candy', desc: '알록달록 굵은 붓 터치' },
    { key: 'rain_princess', name: '비의 공주', en: 'Rain Princess', desc: '빛이 번지는 유화 칼 터치' },
    { key: 'udnie', name: '우드니', en: 'Udnie', desc: '각진 면으로 나눈 추상화' },
    { key: 'pointilism', name: '점묘화', en: 'Pointilism', desc: '작은 색점을 찍어 그린 그림' },
  ];
  const modelUrl = (key) => `../onnx_models/style_${key}.onnx`;
  const SAMPLE_URL = 'style_examples/sample.jpg';
  const MAX_FILE_MB = 15;

  const $ = (id) => document.getElementById(id);
  const el = {
    controls: $('controls'), file: $('photoInput'), drop: $('dropZone'), sampleBtn: $('sampleBtn'),
    styleList: $('styleList'), size: $('sizeSelect'), run: $('runBtn'),
    status: $('status'), progress: $('progress'), progressFill: $('progressFill'),
    compare: $('compare'), original: $('originalCanvas'), result: $('resultCanvas'), placeholder: $('resultPlaceholder'),
    resultTitle: $('resultTitle'), originalTitle: $('originalTitle'),
    strength: $('strength'), strengthValue: $('strengthValue'), formula: $('formula'),
    meta: $('resultMeta'), download: $('downloadBtn'), stale: $('staleNote'),
  };

  const state = {
    worker: null,
    photo: null,          // 원본 사진 (HTMLImageElement)
    photoName: '',
    styleKey: STYLES[0].key,
    size: Number(el.size.value),
    busy: false,
    runId: 0,
    runUrl: '',
    base: null,           // 변환에 넣은 원본 ImageData (결과와 같은 크기)
    styled: null,         // 결과 { data, width, height, styleKey, size, ms }
    pendingKey: '',       // 지금 변환 중인 화풍
    ready: new Set(),     // 받아 둔 모델 주소
    timer: 0,
    startedAt: 0,
    blendRaf: 0,
  };

  const styleOf = (key) => STYLES.find((s) => s.key === key);

  // ===== 상태 표시 =====
  function setStatus(text, kind = 'info') {
    el.status.textContent = text;
    el.status.dataset.kind = kind;
  }
  function setProgress(mode, percent = 0) {
    // mode: 'hidden' | 'bar'(실제 진행률) | 'busy'(얼마나 남았는지 모르는 계산 중)
    el.progress.hidden = mode === 'hidden';
    el.progress.dataset.mode = mode;
    el.progressFill.style.width = mode === 'bar' ? `${percent}%` : '';
    if (mode === 'bar') el.progress.setAttribute('aria-valuenow', String(percent));
    else el.progress.removeAttribute('aria-valuenow');
  }
  function stopTimer() {
    clearInterval(state.timer);
    state.timer = 0;
  }

  // ===== 워커 =====
  function initWorker() {
    try {
      state.worker = new Worker('./activity15webworker.js');
    } catch (err) {
      setStatus(location.protocol === 'file:'
        ? '파일을 직접 열면 신경망을 실행할 수 없어요. 웹 주소(https://…)로 열어 주세요.'
        : `신경망 실행 준비에 실패했습니다: ${err.message}`, 'error');
      return;
    }
    state.worker.onmessage = onWorkerMessage;
    state.worker.onerror = (e) => {
      e.preventDefault();
      finishRun();
      setProgress('hidden');
      setStatus('신경망 실행 도구(ONNX Runtime)를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.', 'error');
    };
    preload(state.styleKey);
  }

  function preload(key) {
    if (state.worker && !state.ready.has(modelUrl(key))) state.worker.postMessage({ type: 'preload', url: modelUrl(key) });
  }

  function onWorkerMessage(e) {
    const m = e.data;
    switch (m.type) {
      case 'model_progress':
        // 변환을 기다리는 중일 때만 진행률을 크게 보여 준다 (미리 받기는 조용히)
        if (state.busy && m.url === state.runUrl) {
          setStatus(`「${styleOf(state.pendingKey || state.styleKey).name}」 화풍 모델 받는 중… ${m.percent}% (약 6.7MB, 처음 한 번만)`, 'loading');
          setProgress('bar', m.percent);
        }
        break;
      case 'model_ready':
        state.ready.add(m.url);
        break;
      case 'running':
        if (m.id !== state.runId) return;
        setProgress('busy');
        state.startedAt = performance.now();
        stopTimer();
        state.timer = setInterval(() => {
          setStatus(`신경망에 사진을 통과시키는 중… ${((performance.now() - state.startedAt) / 1000).toFixed(1)}초`, 'loading');
        }, 100);
        setStatus('신경망에 사진을 통과시키는 중…', 'loading');
        break;
      case 'done':
        if (m.id !== state.runId) return;
        onDone(m);
        break;
      case 'error':
        if (m.id === null && !(state.busy && m.url === state.runUrl)) {
          // 미리 받기 실패: 지금 고른 화풍일 때만 알림 (변환할 때 다시 시도함)
          if (m.url === modelUrl(state.styleKey) && !state.busy) setStatus(`화풍 모델을 미리 받지 못했어요. 「변환하기」를 누르면 다시 시도해요. (${m.message})`, 'error');
          return;
        }
        if (m.id !== null && m.id !== state.runId) return;
        finishRun();
        setProgress('hidden');
        setStatus(`변환하지 못했어요: ${m.message} — 인터넷 연결을 확인하고 다시 눌러 보세요.`, 'error');
        break;
    }
  }

  // ===== 사진 =====
  function loadPhotoFromUrl(url, name, revoke) {
    setStatus('사진을 여는 중…', 'loading');
    const img = new Image();
    img.onload = () => {
      if (revoke) URL.revokeObjectURL(url);
      state.photo = img;
      state.photoName = name;
      state.styled = null;
      state.base = null;
      el.compare.hidden = false;
      drawOriginalPreview();
      showResultPlaceholder('「변환하기」를 누르면 여기에 결과가 나와요.');
      updateRunButton();
      setStatus(`사진 준비 완료 (${img.naturalWidth}×${img.naturalHeight}). 화풍을 고르고 「변환하기」를 누르세요.`, 'success');
    };
    img.onerror = () => {
      if (revoke) URL.revokeObjectURL(url);
      setStatus('사진을 열지 못했어요. JPG·PNG 같은 이미지 파일인지 확인해 주세요.', 'error');
    };
    img.src = url;
  }

  function loadPhotoFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setStatus('이미지 파일만 올릴 수 있어요.', 'error'); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { setStatus(`파일이 너무 커요. ${MAX_FILE_MB}MB 이하 사진을 골라 주세요.`, 'error'); return; }
    loadPhotoFromUrl(URL.createObjectURL(file), file.name, true);
  }

  // 긴 변을 size로 맞추고, 가로·세로를 4의 배수로 (신경망이 1/4로 줄였다 다시 키우므로 크기가 정확히 돌아오게)
  function fitSize(w, h, size) {
    const scale = Math.min(1, size / Math.max(w, h));
    const round4 = (v) => Math.max(4, Math.round(v * scale / 4) * 4);
    return { width: round4(w), height: round4(h) };
  }

  function drawOriginalPreview() {
    if (!state.photo) return;
    const { width, height } = fitSize(state.photo.naturalWidth, state.photo.naturalHeight, state.size);
    el.original.width = width;
    el.original.height = height;
    const ctx = el.original.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.photo, 0, 0, width, height);
    el.originalTitle.textContent = `원본 · ${width}×${height}`;
  }

  // ===== 결과 =====
  function showResultPlaceholder(text) {
    el.placeholder.textContent = text;
    el.placeholder.hidden = false;
    el.result.hidden = true;
    el.download.disabled = true;
    el.strength.disabled = true;
    el.formula.textContent = '';
    el.meta.textContent = '';
    el.stale.hidden = true;
    el.resultTitle.textContent = '결과';
  }

  function onDone(m) {
    stopTimer();
    const s = { data: new Uint8ClampedArray(m.pixels), width: m.width, height: m.height, styleKey: state.pendingKey, size: state.size, ms: m.ms };
    state.styled = s;
    finishRun();
    setProgress('hidden');
    el.result.width = s.width;
    el.result.height = s.height;
    el.result.hidden = false;
    el.placeholder.hidden = true;
    el.download.disabled = false;
    el.strength.disabled = false;
    el.strength.value = 100;   // 새 결과는 화풍 그대로부터 보여 준다
    el.resultTitle.textContent = `결과 · ${styleOf(s.styleKey).name}`;
    el.meta.textContent = `${s.width}×${s.height} 픽셀 · 신경망 통과 ${(s.ms / 1000).toFixed(1)}초`;
    renderBlend();
    updateStaleNote();
    setStatus(`완료! 「${styleOf(s.styleKey).name}」 화풍으로 바꿨어요. 아래 강도 막대로 원본과 섞어 보세요.`, 'success');
  }

  // 결과 = (1 − t) × 원본 + t × 변환  — 픽셀마다 R·G·B 각각
  function renderBlend() {
    const s = state.styled;
    if (!s || !state.base) return;
    if (state.base.width !== s.width || state.base.height !== s.height) {   // 크기가 다르면 섞지 않고 결과만
      el.result.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(s.data), s.width, s.height), 0, 0);
      el.formula.textContent = '';
      return;
    }
    const t = Number(el.strength.value) / 100;
    const a = state.base.data, b = s.data;
    const out = new ImageData(s.width, s.height);
    const o = out.data;
    for (let i = 0; i < o.length; i += 4) {
      o[i] = a[i] + (b[i] - a[i]) * t;
      o[i + 1] = a[i + 1] + (b[i + 1] - a[i + 1]) * t;
      o[i + 2] = a[i + 2] + (b[i + 2] - a[i + 2]) * t;
      o[i + 3] = 255;
    }
    el.result.getContext('2d').putImageData(out, 0, 0);
    el.strengthValue.textContent = `${Math.round(t * 100)}%`;
    // 가운데 픽셀 하나로 계산을 보여 준다
    const p = (Math.floor(s.height / 2) * s.width + Math.floor(s.width / 2)) * 4;
    const rgb = (arr) => `(${arr[p]}, ${arr[p + 1]}, ${arr[p + 2]})`;
    const k = (1 - t).toFixed(2).replace(/\.?0+$/, '') || '0';
    const tt = t.toFixed(2).replace(/\.?0+$/, '') || '0';
    el.formula.textContent = `결과 = ${k} × 원본 + ${tt} × 변환   ·   가운데 픽셀 R·G·B: 원본 ${rgb(a)}, 변환 ${rgb(b)} → 결과 ${rgb(o)}`;
  }

  function scheduleBlend() {
    if (state.blendRaf) return;
    state.blendRaf = requestAnimationFrame(() => { state.blendRaf = 0; renderBlend(); });
  }

  // 결과를 만든 뒤 화풍·크기를 바꿨으면 알려 준다
  function updateStaleNote() {
    const s = state.styled;
    el.stale.hidden = !(s && (s.styleKey !== state.styleKey || s.size !== state.size));
  }

  // ===== 변환 =====
  function updateRunButton() {
    el.run.disabled = state.busy || !state.photo || !state.worker;
  }

  function finishRun() {
    stopTimer();
    state.busy = false;
    el.controls.disabled = false;
    el.run.textContent = '변환하기';
    updateRunButton();
  }

  function startRun() {
    if (state.busy || !state.photo || !state.worker) return;
    drawOriginalPreview();
    const { width, height } = { width: el.original.width, height: el.original.height };
    state.base = el.original.getContext('2d').getImageData(0, 0, width, height);
    const pixels = new Uint8ClampedArray(state.base.data);   // 원본은 남기고 사본을 워커로 넘김
    state.runId += 1;
    state.runUrl = modelUrl(state.styleKey);
    state.styled = null;
    state.pendingKey = state.styleKey;
    state.busy = true;
    el.controls.disabled = true;   // 변환 중에는 사진·화풍·크기를 바꾸지 못하게 (화면과 실제 모델이 어긋나지 않게)
    el.run.textContent = '변환 중…';
    updateRunButton();
    showResultPlaceholder('변환 중…');
    if (state.ready.has(state.runUrl)) {
      setStatus('신경망에 사진을 통과시키는 중…', 'loading');
      setProgress('busy');
    } else {
      setStatus(`「${styleOf(state.styleKey).name}」 화풍 모델 받는 중… (약 6.7MB, 처음 한 번만)`, 'loading');
      setProgress('bar', 0);
    }
    state.worker.postMessage({ type: 'run', id: state.runId, url: state.runUrl, width, height, pixels: pixels.buffer }, [pixels.buffer]);
  }

  function download() {
    const s = state.styled;
    if (!s) return;
    el.result.toBlob((blob) => {
      if (!blob) { setStatus('그림 파일을 만들지 못했어요.', 'error'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `스타일변환_${styleOf(s.styleKey).name}_${el.strength.value}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }

  // ===== 화풍 목록 =====
  function renderStyles() {
    const frag = document.createDocumentFragment();
    STYLES.forEach((s, i) => {
      const label = document.createElement('label');
      label.className = 'style-card';
      label.innerHTML = `<input type="radio" name="style" value="${s.key}"${i === 0 ? ' checked' : ''}>
        <img src="style_examples/thumb_${s.key}.jpg" width="320" height="240" alt="" loading="lazy">
        <span class="style-name">${s.name} <small>${s.en}</small></span>
        <span class="style-desc">${s.desc}</span>`;
      frag.appendChild(label);
    });
    el.styleList.appendChild(frag);
  }

  // ===== 이벤트 =====
  el.file.addEventListener('change', () => { loadPhotoFile(el.file.files[0]); el.file.value = ''; });
  el.sampleBtn.addEventListener('click', () => loadPhotoFromUrl(SAMPLE_URL, '예시 사진', false));
  ['dragenter', 'dragover'].forEach((t) => el.drop.addEventListener(t, (e) => { e.preventDefault(); if (!el.controls.disabled) el.drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => el.drop.addEventListener(t, () => el.drop.classList.remove('is-over')));
  el.drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (el.controls.disabled) return;
    loadPhotoFile(e.dataTransfer.files[0]);
  });
  el.styleList.addEventListener('change', (e) => {
    if (e.target.name !== 'style') return;
    state.styleKey = e.target.value;
    preload(state.styleKey);
    updateStaleNote();
  });
  el.size.addEventListener('change', () => {
    state.size = Number(el.size.value);
    if (state.photo && !state.styled) drawOriginalPreview();
    updateStaleNote();
  });
  el.run.addEventListener('click', startRun);
  el.strength.addEventListener('input', scheduleBlend);
  el.download.addEventListener('click', download);
  window.addEventListener('pagehide', () => { stopTimer(); if (state.worker) state.worker.terminate(); });

  // ===== 작동 원리 캐러셀 (버튼을 눌렀을 때만 대화창으로) =====
  function setupExplain() {
    const dlg = $('explainDlg'), track = $('explainTrack'), viewport = $('explainViewport');
    const prev = $('explainPrev'), next = $('explainNext'), dots = $('explainDots'), count = $('explainCount');
    const slides = [...track.children];
    const n = slides.length;
    let index = 0;

    slides.forEach((slide, i) => {
      slide.setAttribute('aria-label', `${i + 1} / ${n}`);
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dot';
      dot.setAttribute('aria-label', `${i + 1}번째 설명 보기`);
      dot.addEventListener('click', () => go(i));
      dots.appendChild(dot);
    });

    function go(i) {
      index = Math.max(0, Math.min(n - 1, i));
      track.style.transform = `translateX(${-index * 100}%)`;
      slides.forEach((slide, k) => {
        const on = k === index;
        slide.inert = !on;   // 보이지 않는 장의 링크로 Tab이 가지 않게
        slide.setAttribute('aria-hidden', String(!on));
        if (on) slide.scrollTop = 0;
      });
      [...dots.children].forEach((dot, k) => dot.setAttribute('aria-current', String(k === index)));
      count.textContent = `${index + 1} / ${n}`;
      if (index === 0 && document.activeElement === prev) next.focus();
      prev.disabled = index === 0;
      next.innerHTML = index === n - 1 ? '닫기' : '다음 <span aria-hidden="true">→</span>';
    }

    $('explainBtn').addEventListener('click', () => { go(0); dlg.showModal(); next.focus(); });
    $('explainClose').addEventListener('click', () => dlg.close());
    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => (index === n - 1 ? dlg.close() : go(index + 1)));
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // 바깥 어두운 곳을 누르면 닫기

    // 휴대폰·태블릿: 옆으로 밀어서 넘기기 (위아래 스크롤은 그대로)
    let sx = null, sy = 0;
    viewport.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
    viewport.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
    });
    viewport.addEventListener('pointercancel', () => { sx = null; });
    go(0);
  }

  renderStyles();
  setupExplain();
  updateRunButton();
  setProgress('hidden');
  setStatus('① 사진을 고르거나 「예시 사진 쓰기」를 누르세요.', 'info');
  initWorker();
})();
