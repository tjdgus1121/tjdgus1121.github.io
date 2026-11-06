/* activity14_yolo_lab.js — YOLO 직접 학습시키기 화면
 *
 * 흐름: 사진 올리기 → 학생이 상자를 그리고 이름 붙이기(라벨링) → (워커) MobileNetV2로 특징 뽑기
 *       → (워커) 탐지 머리 학습, 에폭마다 기록 받기 → 기록으로 학습 과정 되감기 → 새 사진 판별과 근거 보여 주기
 * 계산: activity14_yolo_lab_head.js(YoloHead), 그래프: activity14_yolo_lab_chart.js(YoloChart)
 */
(() => {
  'use strict';

  const Hd = window.YoloHead;
  const Chart = window.YoloChart;
  const DATA_DIR = 'samples/';   // 학생에게 나눠 주는 샘플 폴더 (사진 + 선생님 정답지 labels.json)
  const BACKBONE_URL = '../models/yolo_lab/mobilenetv2_features.onnx';
  const STORE_KEY = 'yoloLab.labels.v1';       // 학생이 표시한 정답을 이 브라우저에 저장
  const S = Hd.INPUT;                           // 224
  const CELL = S / Hd.G;                        // 32
  const SNAP = 58;
  const MAX_CLASSES = 7;
  const MIN_PER_CLASS = 3;                      // 이름마다 학습 2장 + 검증 1장 이상
  // 이름(종류) 색: 고정 순서. 노랑·분홍·청록 위 글자는 어둡게
  const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
  const INK = { '#1baf7a': '#111', '#eda100': '#111', '#e87ba4': '#111' };
  const SERIES = { train: '#6250d6', val: '#1baf7a' };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    step: 1,
    entries: [], answerKey: new Map(),  // 샘플 폴더 정답지 (임시 버튼·시험 사진·출처에만 씀)
    photos: [], byId: new Map(),        // 학생이 올린 사진
    classes: [],                        // [{ name, color }]
    active: 0,                          // 상자에 붙일 이름
    cur: -1,                            // 라벨링 중인 사진 (photos 번호)
    selBox: -1,
    filter: 'all',
    uploading: false, skipped: [],
    model: 'loading',
    featsDone: 0, featsTotal: 0,
    channel: 0, featCell: -1,
    rawFeats: new Map(),
    runs: [], run: null,
    training: false, paused: false,
    reviewEpoch: 0, reviewSet: 'val', heat: false,
    which: 'best', insights: null,
    judge: null, analysis: null, judgePending: false,
    detMode: 'best', detThr: 0.15, detIou: 0.4
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    prepPhotos: $('prepPhotos'), prepModel: $('prepModel'), prepFeats: $('prepFeats'), prepMsg: $('prepMsg'),
    retryWrap: $('retryWrap'), retryBtn: $('retryBtn'),
    tabs: [...document.querySelectorAll('.step-tab')],
    panels: [1, 2, 3, 4, 5].map((n) => $('panel-' + n)),
    trainFiles: $('trainFiles'), trainFolder: $('trainFolder'), pickFiles: $('pickFiles'), pickFolder: $('pickFolder'),
    clearFiles: $('clearFiles'), uploadSummary: $('uploadSummary'), skippedBox: $('skippedBox'), skippedTitle: $('skippedTitle'), skippedList: $('skippedList'),
    dataArea: $('dataArea'), prevPhoto: $('prevPhoto'), nextPhoto: $('nextPhoto'), labelPos: $('labelPos'),
    dataCanvas: $('dataCanvas'), wholeBox: $('wholeBox'), delBox: $('delBox'), skipPhoto: $('skipPhoto'), dataCalc: $('dataCalc'),
    classList: $('classList'), classInput: $('classInput'), addClass: $('addClass'), classMsg: $('classMsg'),
    labelSummary: $('labelSummary'), dataFilter: $('dataFilter'), dataCount: $('dataCount'), gallery: $('gallery'), clearLabels: $('clearLabels'),
    featText: $('featText'), featMeter: $('featMeter'), featTitle: $('featTitle'), featCanvas: $('featCanvas'),
    chanSlider: $('chanSlider'), chanOut: $('chanOut'), chanBest: $('chanBest'), featReadout: $('featReadout'), featBars: $('featBars'),
    lrSel: $('lrSel'), nSel: $('nSel'), epSel: $('epSel'), seedSel: $('seedSel'), trainBtn: $('trainBtn'), pauseBtn: $('pauseBtn'), stopBtn: $('stopBtn'),
    trainStatus: $('trainStatus'), liveGrid: $('liveGrid'), runTable: $('runTable'),
    phenoList: $('phenoList'), epochSlider: $('epochSlider'), epochOut: $('epochOut'), reviewSet: $('reviewSet'),
    heatToggle: $('heatToggle'), reviewSummary: $('reviewSummary'), reviewGrid: $('reviewGrid'), confusion: $('confusion'),
    fileInput: $('fileInput'), uploadBtn: $('uploadBtn'), examples: $('examples'), whichBest: $('whichBest'), whichLast: $('whichLast'),
    judgeMsg: $('judgeMsg'), judgeArea: $('judgeArea'), judgeArea2: $('judgeArea2'), verdict: $('verdict'),
    judgeCanvas: $('judgeCanvas'), judgeHeat: $('judgeHeat'), judgeWhere: $('judgeWhere'), judgeCalc: $('judgeCalc'), judgeProbs: $('judgeProbs'),
    contribList: $('contribList'), neighborList: $('neighborList'), creditList: $('creditList'),
    nextBox: $('nextBox'), labelFile: $('labelFile'), saveLabelsBtn: $('saveLabels'), loadLabelsBtn: $('loadLabels'), labelIoMsg: $('labelIoMsg'),
    noiseSel: $('noiseSel'), classTable: $('classTable'),
    camBtn: $('camBtn'), camBox: $('camBox'), camVideo: $('camVideo'), camShot: $('camShot'), camAuto: $('camAuto'), camStop: $('camStop'),
    detMode: $('detMode'), detControls: $('detControls'), detThr: $('detThr'), detThrOut: $('detThrOut'), detSummary: $('detSummary'),
    detIou: $('detIou'), detIouOut: $('detIouOut')
  };

  // ---------- 표기 ----------
  const minus = (s) => s.replace('-', '−');
  const f2 = (v) => minus(Number(v).toFixed(2));
  const f3 = (v) => minus(Number(v).toFixed(3));
  const pct = (v) => Math.round(v * 100) + '%';
  const sgn = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
  const num = (v) => (v < 0 ? '(−' + Math.abs(v).toFixed(2) + ')' : v.toFixed(2));
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const row = (k, v) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  const ink = (color) => INK[color] || '#fff';
  const tagHtml = (c) => `<span class="tag" style="background:${c.color};--tag-ink:${ink(c.color)}">${esc(c.name)}</span>`;
  const sampleUrl = (file) => DATA_DIR + encodeURIComponent(file);

  // ---------- 그래프 ----------
  const lossSeries = [{ name: '학습', color: SERIES.train }, { name: '검증', color: SERIES.val }];
  const charts = {
    loss: Chart.LineChart($('chartLoss'), { title: '학습·검증 오차', series: lossSeries }),
    acc: Chart.LineChart($('chartAcc'), { title: '학습·검증 정답률', yMax: 1, format: (v) => Math.round(v * 100) + '%', series: lossSeries }),
    obj: Chart.LineChart($('chartObj'), { title: '물체 칸과 배경 칸의 점수 평균', yMax: 1, series: [{ name: '물체 칸', color: '#1f2328' }, { name: '배경 칸', color: '#1f2328', dash: true }] }),
    review: Chart.LineChart($('chartReview'), { title: '오차 다시 보기', series: lossSeries }),
    map: Chart.ScatterChart($('featureMap'), { title: '학습 사진 숨은 값 지도' }),
    mode: Chart.LineChart($('chartMode'), { title: '분류와 탐지의 검증 정답률', yMax: 1, format: (v) => Math.round(v * 100) + '%', series: [{ name: '분류(이름만)', color: '#1f2328' }, { name: '탐지(위치까지)', color: SERIES.val }] })
  };

  // ---------- 워커 ----------
  let worker = null;
  const waiters = new Map();
  let reqSeq = 0;

  function waitFor(key) { return new Promise((resolve, reject) => waiters.set(key, { resolve, reject })); }
  function settle(key, value, error) {
    const w = waiters.get(key);
    if (!w) return;
    waiters.delete(key);
    if (error) w.reject(new Error(error)); else w.resolve(value);
  }

  function startWorker() {
    if (worker) worker.terminate();
    waiters.forEach((w) => w.reject(new Error('다시 시작')));
    waiters.clear();
    state.model = 'loading';
    setPrep(el.prepModel, 'loading', '내려받는 중… 0%', 0);
    try {
      worker = new Worker('activity14_yolo_lab_worker.js');
    } catch (err) {
      modelFailed(err.message);
      return;
    }
    worker.onmessage = onWorker;
    worker.onerror = (e) => { e.preventDefault(); if (state.model !== 'ready') modelFailed(e.message || '워커를 시작하지 못했습니다'); };
    worker.postMessage({ type: 'load', url: new URL(BACKBONE_URL, location.href).href });
  }

  function onWorker(e) {
    const m = e.data;
    switch (m.type) {
      case 'load-progress':
        setPrep(el.prepModel, 'loading', m.preparing ? '준비 중…' : `내려받는 중… ${Math.floor(m.ratio * 100)}%`, m.ratio);
        break;
      case 'ready':
        state.model = 'ready';
        setPrep(el.prepModel, 'done', '✓ 준비 완료 (MobileNetV2, 약 7MB)', 1);
        extractAll();
        break;
      case 'extracted': settle('extracted:' + m.id, m); break;
      case 'features': settle('features:' + m.id, m.feats); break;
      case 'epoch': onEpoch(m); break;
      case 'train-done': onTrainDone(m); break;
      case 'insights': onInsights(m); break;
      case 'analysis': if (state.judge && m.reqId === state.judge.reqId) onAnalysis(m.result); break;
      case 'error':
        if (m.about === 'load') modelFailed(m.message);
        else if (m.about === 'extract') settle('extracted:' + m.id, null, m.message);
        else if (m.about === 'analyze') { state.judgePending = false; showJudgeMsg('사진을 판별하지 못했습니다. (' + m.message + ')'); }
        else showPrepMsg('계산 중 오류가 났습니다: ' + m.message);
        break;
    }
  }

  function modelFailed(detail) {
    state.model = 'failed';
    setPrep(el.prepModel, 'failed', '⚠ 받지 못함', 0);
    showPrepMsg('AI의 눈(MobileNetV2)을 불러오지 못했습니다. 인터넷 연결을 확인하고, 학교망이라면 cdn.jsdelivr.net 접속이 막혀 있지 않은지 확인해 주세요.' + (detail ? ` (${detail})` : ''));
    el.retryWrap.hidden = false;
  }

  function setPrep(item, kind, text, ratio) {
    item.dataset.state = kind;
    item.querySelector('.txt').textContent = text;
    item.querySelector('.bar span').style.width = Math.round(Math.min(1, Math.max(0, ratio)) * 100) + '%';
  }

  function showPrepMsg(text) {
    el.prepMsg.textContent = text ? '⚠ ' + text : '';
    el.prepMsg.hidden = !text;
  }

  // ---------- 샘플 정답지 (시험 사진·출처·임시 버튼용) ----------
  async function loadAnswerKey() {
    try {
      const res = await fetch(DATA_DIR + 'labels.json');
      if (!res.ok) throw new Error('응답 ' + res.status);
      state.entries = (await res.json()).images;
      state.entries.forEach((it) => state.answerKey.set(it.file.normalize('NFC'), it));
    } catch (err) {
      state.entries = [];   // 정답지가 없어도 직접 라벨링은 할 수 있다
    }
    buildExamples();
    buildCredits();
  }

  // ---------- 이름(종류) ----------
  const classIndex = (name) => state.classes.findIndex((c) => c.name === name);

  function addClassName(raw, quiet) {
    const name = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 12);
    if (!name) { if (!quiet) setClassMsg('이름을 입력해 주세요.'); return -1; }
    const at = classIndex(name);
    if (at >= 0) return at;
    if (state.classes.length >= MAX_CLASSES) { if (!quiet) setClassMsg(`이름은 ${MAX_CLASSES}개까지 만들 수 있습니다.`); return -1; }
    const used = new Set(state.classes.map((c) => c.color));
    state.classes.push({ name, color: PALETTE.find((c) => !used.has(c)) || PALETTE[0] });
    return state.classes.length - 1;
  }

  function setClassMsg(t) { el.classMsg.textContent = t; }

  function boxCount(name) {
    let n = 0;
    for (const p of state.photos) for (const b of p.boxes) if (b.cls === name) n++;
    return n;
  }

  function renderClassList() {
    el.classList.replaceChildren(...state.classes.map((c, i) => {
      const item = document.createElement('div');
      item.className = 'class-item';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'class-btn';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(i === state.active));
      btn.innerHTML = `<span class="swatch" style="background:${c.color}"></span><span class="key">${i + 1}</span><span></span><span class="cnt"></span>`;
      btn.children[2].textContent = c.name;
      const n = boxCount(c.name);
      btn.children[3].textContent = `상자 ${n}개`;
      btn.addEventListener('click', () => { state.active = i; applyActiveToSelected(); renderClassList(); renderLabeler(); });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'class-del';
      del.textContent = '×';
      del.disabled = n > 0 || state.training;
      del.setAttribute('aria-label', `이름 ‘${c.name}’ 지우기${n ? ' (상자에 쓰인 이름은 지울 수 없음)' : ''}`);
      del.addEventListener('click', () => {
        if (boxCount(c.name)) return;
        state.classes.splice(i, 1);
        state.active = Math.min(state.active, Math.max(0, state.classes.length - 1));
        saveLabels();
        renderClassList();
      });
      item.append(btn, del);
      return item;
    }));
    if (!state.classes.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '아직 이름이 없습니다. 아래에 첫 이름을 만들어 보세요.';
      el.classList.append(p);
    }
    el.addClass.disabled = state.classes.length >= MAX_CLASSES || state.training;
  }

  // 상자를 눌러 고른 상태에서 이름을 누르면 그 상자의 이름을 바꾼다
  function applyActiveToSelected() {
    const p = curPhoto();
    if (!p || !p.boxes[state.selBox] || !state.classes[state.active]) return;
    p.boxes[state.selBox].cls = state.classes[state.active].name;
    labelsChanged(p);
  }

  // ---------- 라벨 저장·복원 (이 브라우저) ----------
  let saveTimer = null;
  function saveLabels() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const prev = readStore();
        for (const p of state.photos) prev.labels[p.id] = { boxes: p.boxes.map((b) => [b.x1, b.y1, b.x2, b.y2, b.cls]), skip: p.skip };
        prev.classes = state.classes.map((c) => c.name);
        localStorage.setItem(STORE_KEY, JSON.stringify(prev));
      } catch (err) { /* 저장 공간이 없거나 막혀 있으면 이번 접속 동안만 유지 */ }
    }, 300);
  }
  function readStore() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (v && v.labels) return v;
    } catch (err) { /* 무시하고 새로 시작 */ }
    return { classes: [], labels: {} };
  }

  // ---------- 사진 올리기 ----------
  const loadImg = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  // files: File 배열. preset: { 파일이름: { boxes: [[x1,y1,x2,y2]], cls } } (임시 버튼에서 정답지를 함께 넣을 때)
  async function addFiles(fileList, preset) {
    if (state.uploading) return;
    if (state.training) { showPrepMsg('학습 중에는 사진을 바꿀 수 없습니다. 학습이 끝난 뒤 올려 주세요.'); return; }
    showPrepMsg('');
    const skipped = [], jobs = [], seen = new Set();
    for (const f of fileList) {
      const name = f.name.normalize('NFC');   // 맥에서 받은 한글 파일 이름도 같은 글자로 맞춘다
      if (name === 'labels.json' || /\.txt$/i.test(name)) continue;
      if (!(f.type || '').startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(name)) { skipped.push([name, '사진 파일이 아님']); continue; }
      if (name.startsWith('시험_')) { skipped.push([name, '시험 사진 — 5단계 판별에 쓰세요']); continue; }
      if (state.byId.has(name) || seen.has(name)) { skipped.push([name, '이미 올린 사진']); continue; }
      seen.add(name);
      jobs.push({ f, name });
    }
    state.uploading = true;
    updateUploadUi();
    const store = readStore();
    for (const n of store.classes || []) addClassName(n, true);
    let done = 0;
    const added = [];
    for (let i = 0; i < jobs.length; i += 8) {
      await Promise.all(jobs.slice(i, i + 8).map(async ({ f, name }) => {
        const url = URL.createObjectURL(f);
        const img = await loadImg(url);
        done++;
        setPrep(el.prepPhotos, 'loading', `사진 여는 중… ${done} / ${jobs.length}`, done / jobs.length);
        if (!img) { URL.revokeObjectURL(url); skipped.push([name, '사진을 열 수 없음']); return; }
        const p = { id: name, img, url, lb: Hd.letterbox(img.naturalWidth, img.naturalHeight, S), boxes: [], skip: false, extracted: false };
        const saved = store.labels[name];
        const pre = preset && preset[name];
        if (pre) {
          const ci = addClassName(pre.cls, true);
          if (ci >= 0) p.boxes = pre.boxes.map((b) => ({ x1: b[0], y1: b[1], x2: b[2], y2: b[3], cls: pre.cls }));
        } else if (saved) {
          p.skip = !!saved.skip;
          for (const b of saved.boxes || []) if (addClassName(b[4], true) >= 0) p.boxes.push({ x1: b[0], y1: b[1], x2: b[2], y2: b[3], cls: b[4] });
        }
        added.push(p);
      }));
    }
    added.sort((a, b) => a.id.localeCompare(b.id, 'ko', { numeric: true }));
    for (const p of added) { state.photos.push(p); state.byId.set(p.id, p); }
    state.uploading = false;
    state.skipped = skipped;
    if (state.cur < 0 && state.photos.length) state.cur = 0;
    if (added.length && preset) saveLabels();
    buildGallery();
    updateUploadUi();
    renderClassList();
    render();
    extractAll();
  }

  function clearFiles() {
    if (state.training) return;
    for (const p of state.photos) if (p.url) URL.revokeObjectURL(p.url);
    state.photos = [];
    state.byId.clear();
    state.rawFeats.clear();
    state.cur = -1;
    state.selBox = -1;
    state.skipped = [];
    buildGallery();
    updateUploadUi();
    setPrep(el.prepFeats, 'loading', '대기 중', 0);
    render();
  }

  function updateUploadUi() {
    const busy = state.uploading || state.training;
    el.pickFiles.disabled = el.pickFolder.disabled = busy;
    el.clearFiles.hidden = !state.photos.length;
    el.clearFiles.disabled = busy;
    el.dataArea.hidden = !state.photos.length;
    el.uploadSummary.textContent = state.photos.length ? `올린 사진 ${state.photos.length}장` : '아직 올린 사진이 없습니다.';
    el.skippedBox.hidden = !state.skipped.length;
    if (state.skipped.length) {
      el.skippedTitle.textContent = `방금 고른 파일 중 쓰지 않은 파일 ${state.skipped.length}개`;
      el.skippedList.replaceChildren(...state.skipped.map(([name, why]) => {
        const li = document.createElement('li');
        li.textContent = `${name} — ${why}`;
        return li;
      }));
    }
    updateLabelSummary();
  }

  // ---------- 학습·검증 나누기 ----------
  const labeled = (p) => !p.skip && p.boxes.length > 0;
  const area = (b) => (b.x2 - b.x1) * (b.y2 - b.y1);
  // 사진의 대표 이름 = 가장 큰 상자의 이름
  const mainClass = (p) => p.boxes.reduce((a, b) => (area(b) > area(a) ? b : a)).cls;

  // 파일 이름으로 정해지는 순서 (같은 사진은 언제나 같은 쪽으로 간다)
  function hashOf(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // 이름마다 표시한 사진의 20%를 검증용으로 뗀다
  function splitData() {
    const groups = new Map();
    for (const p of state.photos) {
      if (!labeled(p)) continue;
      const c = mainClass(p);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(p);
    }
    const usable = [], dropped = [], train = [], val = [];
    for (const c of state.classes) {
      const list = groups.get(c.name) || [];
      if (list.length < MIN_PER_CLASS) { if (list.length || boxCount(c.name)) dropped.push({ name: c.name, n: list.length }); continue; }
      usable.push(c);
      const sorted = list.slice().sort((a, b) => hashOf(a.id) - hashOf(b.id));
      const nVal = Math.max(1, Math.round(list.length * 0.2));
      val.push(...sorted.slice(0, nVal));
      train.push(...sorted.slice(nVal).sort((a, b) => a.id.localeCompare(b.id, 'ko', { numeric: true })));
    }
    return { usable, dropped, train, val, ok: usable.length >= 2 };
  }

  function updateLabelSummary() {
    const total = state.photos.length;
    const done = state.photos.filter(labeled).length;
    const skip = state.photos.filter((p) => p.skip).length;
    const sp = splitData();
    const per = state.classes.map((c) => `${c.name} ${state.photos.filter((p) => labeled(p) && mainClass(p) === c.name).length}`).join(' · ');
    el.labelSummary.textContent = `표시 완료 ${done} / ${total}장${skip ? ` (뺀 사진 ${skip}장)` : ''}${per ? ' — ' + per : ''}`;
    let prep;
    if (!total) prep = ['loading', '1단계에서 사진을 올려 주세요', 0];
    else if (sp.ok) prep = ['done', `✓ 이름 ${sp.usable.length}개 · 학습 ${sp.train.length}장 · 검증 ${sp.val.length}장`, 1];
    else prep = ['loading', `표시 ${done}장 — 이름 2개 이상, 이름마다 ${MIN_PER_CLASS}장 이상 필요`, Math.min(0.9, done / Math.max(1, MIN_PER_CLASS * 2))];
    if (!state.uploading) setPrep(el.prepPhotos, ...prep);
  }

  // ---------- 라벨링 화면 ----------
  const curPhoto = () => state.photos[state.cur] || null;
  let drag = null;   // { mode: 'draw' | 'maybe', x0, y0, x, y, hit }

  function toInputBox(p, b) { return Hd.boxToInput([b.x1, b.y1, b.x2, b.y2], p.lb); }

  function drawPhoto(ctx, it, size) {
    const k = size / S;
    ctx.fillStyle = '#727272';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(it.img, it.lb.padX * k, it.lb.padY * k, it.lb.nw * k, it.lb.nh * k);
  }

  function strokeBox(ctx, b, size, color, width, dash) {
    ctx.save();
    if (dash) {
      ctx.setLineDash(dash);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = width + 2;
      ctx.strokeRect(b.x1 * size, b.y1 * size, (b.x2 - b.x1) * size, (b.y2 - b.y1) * size);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.strokeRect(b.x1 * size, b.y1 * size, (b.x2 - b.x1) * size, (b.y2 - b.y1) * size);
    ctx.restore();
  }

  function label(ctx, x, y, text, bg, size, fg = '#fff') {
    const fs = Math.max(11, Math.round(size / 15));
    ctx.save();
    ctx.font = `700 ${fs}px "Pretendard Variable", "Malgun Gothic", sans-serif`;
    const tw = ctx.measureText(text).width + 8, th = fs + 6;
    x = Math.min(Math.max(0, x), size - tw);
    y = y - th < 0 ? Math.min(size - th, y) : y - th;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, tw, th);
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 4, y + th / 2 + 0.5);
    ctx.restore();
  }

  function drawHeat(ctx, values, size) {
    const c = size / Hd.G;
    for (let k = 0; k < Hd.CELLS; k++) {
      const a = Math.min(0.8, Math.max(0, values[k]) * 0.8);
      if (a < 0.02) continue;
      ctx.fillStyle = `rgba(255, 196, 0, ${a.toFixed(3)})`;
      ctx.fillRect((k % Hd.G) * c, Math.floor(k / Hd.G) * c, c, c);
    }
  }

  function drawGrid(ctx, size, alpha = 0.35) {
    const c = size / Hd.G;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = 1; g < Hd.G; g++) { ctx.moveTo(g * c, 0); ctx.lineTo(g * c, size); ctx.moveTo(0, g * c); ctx.lineTo(size, g * c); }
    ctx.stroke();
    ctx.restore();
  }

  const colorOf = (name) => { const c = state.classes[classIndex(name)]; return c ? c.color : '#888'; };

  function renderLabeler() {
    const p = curPhoto();
    if (!p) return;
    const ctx = el.dataCanvas.getContext('2d');
    const size = el.dataCanvas.width;
    drawPhoto(ctx, p, size);
    drawGrid(ctx, size, 0.4);
    if (p.skip) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(0, 0, size, size);
    }
    // 고른 상자(없으면 마지막 상자)의 책임 칸
    const focus = state.selBox >= 0 ? state.selBox : p.boxes.length - 1;
    if (focus >= 0 && p.boxes[focus]) {
      const t = Hd.makeTarget([{ ...toInputBox(p, p.boxes[focus]), cls: 0 }]).list[0];
      const c = size / Hd.G;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(t.gx * c, t.gy * c, c, c);
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
      ctx.strokeRect(t.gx * c, t.gy * c, c, c);
    }
    p.boxes.forEach((b, i) => {
      const ib = toInputBox(p, b), col = colorOf(b.cls);
      strokeBox(ctx, ib, size, col, i === state.selBox ? 5 : 3);
      if (i === state.selBox) strokeBox(ctx, ib, size, '#fff', 1.5, [6, 4]);
      label(ctx, ib.x1 * size, ib.y1 * size, b.cls, col, size, ink(col));
    });
    if (drag && drag.mode === 'draw') {
      const b = { x1: Math.min(drag.x0, drag.x), y1: Math.min(drag.y0, drag.y), x2: Math.max(drag.x0, drag.x), y2: Math.max(drag.y0, drag.y) };
      const col = state.classes[state.active] ? state.classes[state.active].color : '#fff';
      strokeBox(ctx, b, size, col, 3, [8, 5]);
    }
    el.labelPos.textContent = `${state.cur + 1} / ${state.photos.length} · ${p.id}`;
    el.prevPhoto.disabled = state.cur <= 0;
    el.nextPhoto.disabled = state.cur >= state.photos.length - 1;
    el.delBox.disabled = state.selBox < 0;
    el.skipPhoto.setAttribute('aria-pressed', String(p.skip));
    el.skipPhoto.textContent = p.skip ? '학습에 다시 넣기' : '이 사진 학습에서 빼기';
    el.dataCanvas.setAttribute('aria-label', `${p.id} 라벨링: 상자 ${p.boxes.length}개${p.skip ? ', 학습에서 뺀 사진' : ''}. 끌어서 상자를 그립니다`);

    // 책임 칸 계산 보여 주기
    if (focus < 0 || !p.boxes[focus]) {
      el.dataCalc.innerHTML = state.classes.length
        ? '<p class="empty">사진 위를 끌어 물체를 감싸는 상자를 그려 보세요.</p>'
        : '<p class="empty">먼저 오른쪽에서 이름을 하나 만들어 주세요. (예: A, 강아지)</p>';
      return;
    }
    const b = toInputBox(p, p.boxes[focus]);
    const t = Hd.makeTarget([{ ...b, cls: 0 }]).list[0];
    const px = (v) => Math.round(v * S);
    const cx = (b.x1 + b.x2) / 2 * S, cy = (b.y1 + b.y2) / 2 * S, w = (b.x2 - b.x1) * S, h = (b.y2 - b.y1) * S;
    el.dataCalc.innerHTML =
      row('상자', `${esc(p.boxes[focus].cls)} · (${px(b.x1)}, ${px(b.y1)}) ~ (${px(b.x2)}, ${px(b.y2)}) <span class="mini">· 224×224 기준</span>`) +
      row('상자 중심', `(${cx.toFixed(1)}, ${cy.toFixed(1)})`) +
      row('책임 칸', `${cx.toFixed(1)} ÷ 32 = ${(cx / CELL).toFixed(2)} → <b>${t.gx + 1}열</b>, ${cy.toFixed(1)} ÷ 32 = ${(cy / CELL).toFixed(2)} → <b>${t.gy + 1}행</b> <span class="mini">· 흰 칸</span>`) +
      row('상자 크기', `너비 ${w.toFixed(0)}px → √(${w.toFixed(0)} ÷ 224) = <b>${f2(t.sw)}</b>, 높이 ${h.toFixed(0)}px → √(${h.toFixed(0)} ÷ 224) = <b>${f2(t.sh)}</b>`) +
      row('칸 나누기', `‘있다’를 배우는 칸 <b>${p.boxes.length}개</b>, ‘없다’를 배우는 칸 <b>${Hd.CELLS - p.boxes.length}개</b>`);
  }

  function goPhoto(i) {
    if (i < 0 || i >= state.photos.length) return;
    state.cur = i;
    state.selBox = -1;
    state.featCell = -1;
    renderLabeler();
    markGallery();
  }

  // 그림 위 좌표 → 224 입력 기준 0~1 (사진 영역 밖은 사진 가장자리로)
  function canvasPoint(e) {
    const p = curPhoto();
    const r = el.dataCanvas.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const x0 = p.lb.padX / S, x1 = (p.lb.padX + p.lb.nw) / S, y0 = p.lb.padY / S, y1 = (p.lb.padY + p.lb.nh) / S;
    return { x: Math.min(x1, Math.max(x0, x)), y: Math.min(y1, Math.max(y0, y)) };
  }

  function hitBox(p, pt) {
    let best = -1, ba = Infinity;
    p.boxes.forEach((b, i) => {
      const ib = toInputBox(p, b);
      if (pt.x >= ib.x1 && pt.x <= ib.x2 && pt.y >= ib.y1 && pt.y <= ib.y2 && area(ib) < ba) { ba = area(ib); best = i; }
    });
    return best;
  }

  function addBox(p, ib) {
    if (!state.classes[state.active]) { setClassMsg('먼저 오른쪽에서 이름을 만들고 골라 주세요.'); el.classInput.focus(); return; }
    const sb = Hd.boxToSource(ib, p.lb);
    p.boxes.push({ x1: sb.x1, y1: sb.y1, x2: sb.x2, y2: sb.y2, cls: state.classes[state.active].name });
    // 새로 그린 상자는 고르지 않는다. 고른 채로 두면 다음 상자를 위해 이름을 바꿀 때 이 상자 이름까지 바뀐다
    state.selBox = -1;
    labelsChanged(p);
  }

  function labelsChanged(p) {
    saveLabels();
    renderLabeler();
    renderClassList();
    paintGalleryCard(p);
    updateLabelSummary();
    updateNSel();
    if (state.step === 1) el.tabs.forEach((t, i) => { t.disabled = !stepEnabled(i + 1); });
  }

  // ---------- 갤러리 ----------
  const galleryCards = new Map();
  function buildGallery() {
    galleryCards.clear();
    const frag = document.createDocumentFragment();
    state.photos.forEach((p, i) => {
      const card = makeCard(p.id, '');
      card.dataset.idx = String(i);
      galleryCards.set(p.id, card);
      paintGalleryCard(p);
      frag.append(card);
    });
    el.gallery.replaceChildren(frag);
    applyFilter();
  }

  function paintGalleryCard(p) {
    const card = galleryCards.get(p.id);
    if (!card) return;
    const cv = card.querySelector('canvas'), ctx = cv.getContext('2d');
    drawPhoto(ctx, p, cv.width);
    for (const b of p.boxes) strokeBox(ctx, toInputBox(p, b), cv.width, colorOf(b.cls), 3);
    if (p.skip) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(0, 0, cv.width, cv.width); }
    const cap = card.querySelector('.cap');
    const status = p.skip ? '뺌' : p.boxes.length ? '✓ ' + [...new Set(p.boxes.map((b) => b.cls))].join(', ') : '아직';
    cap.replaceChildren();
    const s1 = document.createElement('b'); s1.textContent = status;
    cap.append(s1);
    card.dataset.status = p.skip ? 'skip' : p.boxes.length ? 'done' : 'todo';
    card.setAttribute('aria-label', `${p.id}: ${status}`);
    card.hidden = !(state.filter === 'all' || state.filter === card.dataset.status);
  }

  function markGallery() {
    for (const [id, card] of galleryCards) card.setAttribute('aria-pressed', String(state.photos[state.cur] && state.photos[state.cur].id === id));
  }

  function applyFilter() {
    let n = 0;
    for (const card of galleryCards.values()) {
      card.hidden = !(state.filter === 'all' || state.filter === card.dataset.status);
      if (!card.hidden) n++;
    }
    el.dataCount.textContent = `${n}장 · 사진을 누르면 그 사진을 라벨링합니다`;
    for (const b of el.dataFilter.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.f === state.filter));
    markGallery();
  }

  function makeCard(id, caption, tag = 'button') {
    const card = document.createElement(tag);
    if (tag === 'button') card.type = 'button';
    card.className = 'photo';
    card.dataset.id = id;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 200;
    const cap = document.createElement('span');
    cap.className = 'cap';
    if (caption) cap.innerHTML = caption;
    card.append(cv, cap);
    return card;
  }

  // ---------- 특징 뽑기 ----------
  const inputCanvas = document.createElement('canvas');
  inputCanvas.width = inputCanvas.height = S;
  const inputCtx = inputCanvas.getContext('2d', { willReadFrequently: true });
  function toInput(img, lb) {
    inputCtx.fillStyle = 'rgb(114,114,114)';
    inputCtx.fillRect(0, 0, S, S);
    inputCtx.imageSmoothingQuality = 'high';
    inputCtx.drawImage(img, lb.padX, lb.padY, lb.nw, lb.nh);
    return Hd.toInputTensor(inputCtx.getImageData(0, 0, S, S).data, S);
  }

  const featsReadyFor = (list) => list.length > 0 && list.every((p) => p.extracted);

  let extracting = false;
  async function extractAll() {
    if (extracting || state.model !== 'ready' || !state.photos.length) return;
    extracting = true;
    const t0 = performance.now();
    try {
      // 뽑는 도중에 사진을 더 올려도 남은 것이 없을 때까지 이어서 뽑는다
      for (;;) {
        const p = state.photos.find((x) => !x.extracted);
        if (!p) break;
        const input = toInput(p.img, p.lb);
        const w = waitFor('extracted:' + p.id);
        worker.postMessage({ type: 'extract', id: p.id, input }, [input.buffer]);
        await w;
        if (state.byId.get(p.id) === p) p.extracted = true;
        updateFeatCounts();
        setPrep(el.prepFeats, 'loading', `${state.featsDone} / ${state.featsTotal}장 · ${((performance.now() - t0) / 1000).toFixed(0)}초`, state.featsDone / state.featsTotal);
        if (state.step === 2) updateFeatProgress();
        if (state.step === 3) updateTrainUi();
      }
      updateFeatCounts();
      if (state.featsTotal && state.featsDone === state.featsTotal) setPrep(el.prepFeats, 'done', `✓ ${state.featsTotal}장 완료 (${((performance.now() - t0) / 1000).toFixed(1)}초)`, 1);
    } catch (err) {
      setPrep(el.prepFeats, 'failed', '⚠ 중단됨', state.featsDone / Math.max(1, state.featsTotal));
      showPrepMsg('특징을 뽑다가 멈췄습니다. “다시 시도”를 눌러 주세요. (' + err.message + ')');
      el.retryWrap.hidden = false;
    }
    extracting = false;
    render();
  }

  function updateFeatCounts() {
    state.featsTotal = state.photos.length;
    state.featsDone = state.photos.filter((x) => x.extracted).length;
  }

  function updateFeatProgress() {
    updateFeatCounts();
    const r = state.featsTotal ? state.featsDone / state.featsTotal : 0;
    el.featMeter.style.width = Math.round(r * 100) + '%';
    el.featText.textContent = state.featsTotal && state.featsDone === state.featsTotal ? `✓ ${state.featsTotal}장 모두 끝났습니다.`
      : state.model !== 'ready' ? 'AI의 눈을 받는 중입니다…' : `${state.featsDone} / ${state.featsTotal || '…'}장 처리 중`;
  }

  async function getFeats(id) {
    if (state.rawFeats.has(id)) return state.rawFeats.get(id);
    const p = state.byId.get(id);
    if (!p || !p.extracted) return null;
    const w = waitFor('features:' + id);
    worker.postMessage({ type: 'get-features', id });
    const f = await w;
    if (f) state.rawFeats.set(id, f);
    return f;
  }

  // 사진의 대표 상자(가장 큰 상자)가 책임지는 칸
  function mainTarget(p) {
    if (!p.boxes.length) return null;
    const b = p.boxes.reduce((a, c) => (area(c) > area(a) ? c : a));
    return Hd.makeTarget([{ ...toInputBox(p, b), cls: 0 }]).list[0];
  }

  async function renderStep2() {
    updateFeatProgress();
    const p = curPhoto();
    if (!p) return;
    const t = mainTarget(p);
    if (state.featCell < 0) state.featCell = t ? t.cell : 24;
    el.featTitle.textContent = `${p.id} · 특징 #${state.channel}을 7×7칸에 칠하기`;
    const f = await getFeats(p.id);
    if (state.step !== 2 || curPhoto() !== p) return;
    const ctx = el.featCanvas.getContext('2d');
    const size = el.featCanvas.width;
    drawPhoto(ctx, p, size);
    if (!f) {
      el.featReadout.innerHTML = '<p class="empty">이 사진은 아직 특징을 뽑지 않았습니다. 잠시 기다려 주세요.</p>';
      el.featBars.getContext('2d').clearRect(0, 0, el.featBars.width, el.featBars.height);
      return;
    }
    const ch = state.channel;
    const vals = new Float32Array(Hd.CELLS);
    let mn = Infinity, mx = -Infinity;
    for (let k = 0; k < Hd.CELLS; k++) { vals[k] = f[k * Hd.C + ch]; mn = Math.min(mn, vals[k]); mx = Math.max(mx, vals[k]); }
    // 제곱해서 칠하면 크게 반응한 칸만 진하게 남는다
    const norm = vals.map((v) => ((v - mn) / Math.max(1e-6, mx - mn)) ** 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, size, size);
    drawHeat(ctx, norm, size);
    drawGrid(ctx, size);
    for (const b of p.boxes) strokeBox(ctx, toInputBox(p, b), size, '#fff', 2, [6, 4]);
    const c = size / Hd.G, k = state.featCell;
    ctx.lineWidth = 4; ctx.strokeStyle = '#000';
    ctx.strokeRect((k % Hd.G) * c, Math.floor(k / Hd.G) * c, c, c);
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
    ctx.strokeRect((k % Hd.G) * c, Math.floor(k / Hd.G) * c, c, c);
    ctx.save();
    ctx.font = `700 ${Math.round(c / 3.6)}px "Pretendard Variable", "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let q = 0; q < Hd.CELLS; q++) {
      const x = (q % Hd.G + 0.5) * c, y = (Math.floor(q / Hd.G) + 0.5) * c;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(minus(vals[q].toFixed(1)), x + 1, y + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(minus(vals[q].toFixed(1)), x, y);
    }
    ctx.restore();
    let rows = row('특징 번호', `#${ch} (320개 중 하나)`) +
      row('칸별 값', `가장 작은 값 ${f2(mn)} ~ 가장 큰 값 ${f2(mx)} <span class="mini">· 클수록 노랗게</span>`);
    if (t) {
      let bg = 0;
      for (let q = 0; q < Hd.CELLS; q++) if (q !== t.cell) bg += vals[q];
      bg /= Hd.CELLS - 1;
      rows += row('물체 칸', `책임 칸(${t.gx + 1}열 ${t.gy + 1}행)의 값 <b>${f2(vals[t.cell])}</b>`) + row('배경 칸', `나머지 48칸 평균 <b>${f2(bg)}</b>`);
    } else {
      rows += row('물체 칸', '1단계에서 이 사진에 상자를 그리면 비교할 수 있습니다.');
    }
    el.featReadout.innerHTML = rows + row('고른 칸', `${k % Hd.G + 1}열 ${Math.floor(k / Hd.G) + 1}행 — 아래 막대는 이 칸의 숫자 320개`);
    el.chanBest.disabled = !t;
    drawFeatBars(f, k, ch);
  }

  function drawFeatBars(f, k, ch) {
    const cv = el.featBars, ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, base = H - 18;
    ctx.clearRect(0, 0, W, H);
    let mx = 0;
    for (let c = 0; c < Hd.C; c++) mx = Math.max(mx, Math.abs(f[k * Hd.C + c]));
    const bw = W / Hd.C, mid = base / 2;
    ctx.fillStyle = '#d9d6ce';
    ctx.fillRect(0, mid, W, 1);
    for (let c = 0; c < Hd.C; c++) {
      const v = f[k * Hd.C + c] / Math.max(1e-6, mx);
      ctx.fillStyle = c === ch ? '#2456c9' : '#a9b8dc';
      const h = v * (mid - 2);
      ctx.fillRect(c * bw, v >= 0 ? mid - h : mid, Math.max(1, bw - 0.4), Math.max(1, Math.abs(h)));
    }
    ctx.fillStyle = '#5b616b';
    ctx.font = '13px "Pretendard Variable", "Malgun Gothic", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('특징 #0', 0, H - 3);
    ctx.textAlign = 'right';
    ctx.fillText('#319', W, H - 3);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2456c9';
    ctx.fillText(`#${ch}`, Math.min(W - 70, Math.max(70, (ch + 0.5) * bw)), H - 3);
    ctx.textAlign = 'left';
  }

  async function pickBestChannel() {
    const p = curPhoto();
    const t = p && mainTarget(p);
    const f = t && await getFeats(p.id);
    if (!f) return;
    let best = 0, bs = -Infinity;
    for (let c = 0; c < Hd.C; c++) {
      let bg = 0;
      for (let q = 0; q < Hd.CELLS; q++) if (q !== t.cell) bg += f[q * Hd.C + c];
      const d = f[t.cell * Hd.C + c] - bg / (Hd.CELLS - 1);
      if (d > bs) { bs = d; best = c; }
    }
    state.channel = best;
    state.featCell = t.cell;
    el.chanSlider.value = String(best);
    el.chanOut.textContent = String(best);
    renderStep2();
  }

  // ---------- 3단계: 학습 ----------
  function updateNSel() {
    const total = splitData().train.length;
    const prev = el.nSel.value;
    const opts = [['all', `학습 사진 전부 (${total}장)`]];
    for (const k of [100, 50, 20]) if (k < total && k >= 4) opts.push([String(k), `그중 ${k}장`]);
    el.nSel.replaceChildren(...opts.map(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; }));
    el.nSel.value = opts.some(([v]) => v === prev) ? prev : 'all';
  }

  // 'all'이면 학습 사진 전부, 숫자면 이름마다 고르게 그만큼
  function pickTrain(train, n, usable) {
    if (n === 'all') return train;
    const groups = usable.map((c) => train.filter((p) => mainClass(p) === c.name));
    const out = [];
    for (let i = 0; out.length < n && groups.some((g) => i < g.length); i++) for (const g of groups) if (i < g.length && out.length < n) out.push(g[i]);
    return out;
  }

  function startTraining() {
    if (state.training) return;
    const sp = splitData();
    if (!sp.ok) return;
    const all = sp.train.concat(sp.val);
    if (!featsReadyFor(all)) return;
    const lr = Number(el.lrSel.value), n = el.nSel.value === 'all' ? 'all' : Number(el.nSel.value);
    const epochs = Number(el.epSel.value), seed = Number(el.seedSel.value);
    const classes = sp.usable.map((c) => ({ name: c.name, color: c.color }));
    const idx = new Map(classes.map((c, i) => [c.name, i]));
    const trainList = pickTrain(sp.train, n, sp.usable);
    // 학습에 쓰는 이름의 상자만 넘긴다 (사진이 모자라 뺀 이름의 상자는 무시)
    const toItem = (p, split) => ({
      id: p.id, split,
      boxes: p.boxes.filter((b) => idx.has(b.cls)).map((b) => ({ ...toInputBox(p, b), cls: idx.get(b.cls) }))
    });
    const items = trainList.map((p) => toItem(p, 'train')).concat(sp.val.map((p) => toItem(p, 'val'))).filter((x) => x.boxes.length);
    // 실험: 학습 사진 일부의 이름을 일부러 다른 이름으로 바꿔서 학습 (검증 사진은 그대로)
    const noise = Number(el.noiseSel.value) || 0;
    const trueMain = new Map(items.map((x) => [x.id, x.boxes.reduce((a, b) => (area(b) > area(a) ? b : a)).cls]));
    const noisy = new Set();
    if (noise > 0 && classes.length > 1) {
      const trainItems = items.filter((x) => x.split === 'train').sort((a, b) => hashOf(a.id + '#' + seed) - hashOf(b.id + '#' + seed));
      for (const x of trainItems.slice(0, Math.round(trainItems.length * noise))) {
        const shift = 1 + (hashOf(x.id) % (classes.length - 1));
        x.boxes = x.boxes.map((b) => ({ ...b, cls: (b.cls + shift) % classes.length }));
        noisy.add(x.id);
      }
    }
    const run = {
      id: state.runs.length + 1, lr, n: items.filter((x) => x.split === 'train').length, seed, epochs, classes, noise, noisy, trueMain,
      trainIds: items.filter((x) => x.split === 'train').map((x) => x.id), valIds: items.filter((x) => x.split === 'val').map((x) => x.id),
      boxes: new Map(items.map((x) => [x.id, x.boxes])), dropped: sp.dropped,
      history: [], bestEpoch: 0, ms: 0, done: false, stopped: false
    };
    state.runs.push(run);
    state.run = run;
    state.training = true;
    state.paused = false;
    state.insights = null;
    state.analysis = null;
    state.judge = null;
    el.judgeArea.hidden = el.judgeArea2.hidden = true;
    worker.postMessage({ type: 'train', items, settings: { lr, epochs, batch: 10, seed, K: classes.length, runId: run.id } });
    buildLiveGrid(run);
    charts.loss.reset(); charts.acc.reset(); charts.obj.reset(); charts.mode.reset();
    updateUploadUi();
    renderClassList();
    updateTrainUi();
    render();
  }

  function buildLiveGrid(run) {
    // 이름마다 학습·검증 사진을 번갈아 골라 최대 8장
    const pick = (ids, max) => {
      const out = [];
      for (let i = 0; out.length < max && i < ids.length; i++) {
        for (const c of run.classes) {
          const list = ids.filter((id) => mainClassOfRun(run, id) === c.name);
          if (list[i] && out.length < max && !out.includes(list[i])) out.push(list[i]);
        }
      }
      return out;
    };
    const frag = document.createDocumentFragment();
    for (const [split, ids] of [['train', pick(run.trainIds, 4)], ['val', pick(run.valIds, 4)]]) {
      for (const id of ids) {
        const card = makeCard(id, `<b>${split === 'val' ? '검증' : '학습'}</b><span class="cardres"></span>`, 'div');
        card.dataset.split = split;
        card.dataset.n = String((split === 'val' ? run.valIds : run.trainIds).indexOf(id));
        paintCard(card, run, id, null, false);
        frag.append(card);
      }
    }
    el.liveGrid.replaceChildren(frag);
  }

  function mainClassOfRun(run, id) {
    const boxes = run.boxes.get(id);
    const b = boxes.reduce((a, c) => (area(c) > area(a) ? c : a));
    return run.classes[b.cls].name;
  }

  // 스냅샷(에폭 기록)에서 한 사진의 예측 꺼내기
  function snapOf(arr, n) {
    const o = n * SNAP;
    return {
      obj: arr.subarray(o, o + 49),
      box: { x1: arr[o + 49], y1: arr[o + 50], x2: arr[o + 51], y2: arr[o + 52] },
      cls: arr[o + 53], prob: arr[o + 54], objScore: arr[o + 55], iou: arr[o + 56], correct: arr[o + 57] > 0.5
    };
  }

  function paintCard(card, run, id, pred, heat) {
    const p = state.byId.get(id);
    const cv = card.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const size = cv.width;
    if (!p) { ctx.fillStyle = '#ccc'; ctx.fillRect(0, 0, size, size); return; }
    drawPhoto(ctx, p, size);
    if (heat && pred) { drawHeat(ctx, pred.obj, size); drawGrid(ctx, size, 0.25); }
    for (const b of run.boxes.get(id) || []) strokeBox(ctx, b, size, pred ? '#fff' : run.classes[b.cls].color, pred ? 1.5 : 3, pred ? [5, 4] : null);
    if (pred) {
      const c = run.classes[pred.cls];
      strokeBox(ctx, pred.box, size, c.color, 3.5);
      label(ctx, pred.box.x1 * size, pred.box.y1 * size, `${pred.correct ? '✓' : '✗'} ${c.name} ${pct(pred.prob)}`, pred.correct ? c.color : '#1f2328', size, pred.correct ? ink(c.color) : '#fff');
    }
  }

  function paintLiveGrid(run, h) {
    for (const card of el.liveGrid.children) {
      const id = card.dataset.id;
      const pred = snapOf(card.dataset.split === 'val' ? h.valSnaps : h.trainSnaps, Number(card.dataset.n));
      paintCard(card, run, id, pred, false);
      card.querySelector('.cardres').textContent = `정답 ${mainClassOfRun(run, id)} · ${pred.correct ? '맞음' : '틀림'}`;
    }
  }

  function onEpoch(m) {
    const run = state.run;
    if (!run || m.runId !== run.id) return;
    run.history.push(m);
    run.bestEpoch = m.bestEpoch;
    if (m.epoch > 0) run.ms += m.ms;
    if (state.step === 3) { paintLiveGrid(run, m); updateCharts(run); }
    updateTrainUi();
  }

  const series = (run, f) => run.history.map(f);

  function updateCharts(run) {
    if (!run || !run.history.length) return;
    const xs = series(run, (h) => h.epoch);
    const marks = run.history.length > 2 ? [{ x: run.bestEpoch, label: `검증 최저 ${run.bestEpoch}` }] : [];
    charts.loss.update(xs, [series(run, (h) => h.train.loss.total), series(run, (h) => h.val.loss.total)], marks);
    charts.acc.update(xs, [series(run, (h) => h.train.acc), series(run, (h) => h.val.acc)]);
    charts.obj.update(xs, [series(run, (h) => h.train.objPos), series(run, (h) => h.train.objNeg)]);
    charts.mode.update(xs, [series(run, (h) => h.clsMode.valAcc), series(run, (h) => h.val.acc)]);
  }

  // 검증 정답률이 가장 높았던 에폭 (같으면 먼저 나온 에폭)
  function bestAccOf(run) {
    let top = { acc: 0, epoch: 0 };
    for (const h of run.history) if (h.val.acc > top.acc) top = { acc: h.val.acc, epoch: h.epoch };
    return top;
  }

  function updateTrainUi() {
    const run = state.run;
    const busy = state.training;
    const sp = splitData();
    const ready = sp.ok && featsReadyFor(sp.train.concat(sp.val));
    el.trainBtn.disabled = busy || !ready;
    el.pauseBtn.disabled = !busy;
    el.stopBtn.disabled = !busy;
    el.pauseBtn.textContent = state.paused ? '계속' : '일시정지';
    el.lrSel.disabled = el.nSel.disabled = el.epSel.disabled = el.seedSel.disabled = el.noiseSel.disabled = busy;
    el.trainBtn.textContent = state.runs.length ? '새로 학습' : '학습 시작';
    if (!busy && !sp.ok) {
      el.trainStatus.innerHTML = `<span>1단계에서 이름을 2개 이상 만들고, 이름마다 사진 ${MIN_PER_CLASS}장 이상에 상자를 표시해 주세요.</span>`;
      return;
    }
    if (!busy && !ready) {
      el.trainStatus.innerHTML = `<span>특징 뽑기가 끝나면 학습할 수 있습니다. (${state.featsDone} / ${state.featsTotal})</span>`;
      return;
    }
    const note = sp.dropped.length ? `<span class="mini">사진이 ${MIN_PER_CLASS}장보다 적어 이번 학습에서 빼는 이름: ${sp.dropped.map((d) => `${esc(d.name)}(${d.n}장)`).join(', ')}</span>` : '';
    if (!run || (!busy && run.done && !run.history.length)) {
      el.trainStatus.innerHTML = `<span>이름 ${sp.usable.length}개 · 학습 ${sp.train.length}장 · 검증 ${sp.val.length}장(이름마다 20%)으로 학습합니다. “학습 시작”을 눌러 보세요.</span>` + note;
      return;
    }
    const h = run.history[run.history.length - 1];
    if (!h) { el.trainStatus.innerHTML = '<span>학습 준비 중…</span>'; return; }
    const per = h.epoch ? run.ms / h.epoch / 1000 : 0;
    const top = bestAccOf(run);
    el.trainStatus.innerHTML =
      `<span>에폭 <b>${h.epoch}</b> / ${run.epochs}</span>` +
      `<span>오차 학습 <b>${f3(h.train.loss.total)}</b> · 검증 <b>${f3(h.val.loss.total)}</b></span>` +
      `<span>검증 정답률 지금 <b>${pct(h.val.acc)}</b> · 최고 <b>${pct(top.acc)}</b> (${top.epoch}에폭)</span>` +
      `<span>분류만 하면 <b>${pct(h.clsMode.valAcc)}</b></span>` +
      `<span>${(run.ms / 1000).toFixed(1)}초${per ? ` (에폭당 ${per.toFixed(2)}초)` : ''}</span>` +
      (state.paused ? '<span><b>일시정지 중</b></span>' : busy ? '' : `<span>${run.stopped ? '중간에 멈춤' : '학습 끝'} → 4단계에서 돌아보기</span>`);
  }

  function onTrainDone(m) {
    const run = state.runs.find((r) => r.id === m.runId);
    if (!run) return;
    run.done = true;
    run.stopped = m.stopped;
    run.bestEpoch = m.bestEpoch;
    if (run === state.run) {
      state.training = false;
      state.paused = false;
      state.reviewEpoch = run.history.length - 1;
      state.which = 'best';
      document.querySelector('input[name="which"][value="best"]').checked = true;
    }
    renderRunTable();
    updateUploadUi();
    renderClassList();
    updateTrainUi();
    render();
  }

  function renderRunTable() {
    const rows = state.runs.filter((r) => r.history.length).map((r) => {
      const last = r.history[r.history.length - 1];
      const top = bestAccOf(r);
      return `<tr><td>${r.id}${r === state.run ? ' (현재)' : ''}</td><td>${r.lr}</td><td>${r.n}장 · 이름 ${r.classes.length}개${r.noise ? ` · <span class="err-text">틀린 정답 ${Math.round(r.noise * 100)}%</span>` : ''}</td><td>${r.seed}번</td><td>${last.epoch}${r.stopped ? ' (멈춤)' : ''}</td>` +
        `<td>${pct(top.acc)} <span class="mini">(${top.epoch}에폭)</span></td><td>${f3(last.train.loss.total)} / ${f3(last.val.loss.total)}</td><td>${(r.ms / 1000).toFixed(1)}초</td></tr>`;
    });
    el.runTable.innerHTML = rows.length ? rows.reverse().join('') : '<tr><td colspan="8" class="empty">아직 학습 기록이 없습니다.</td></tr>';
  }

  // ---------- 4단계: 돌아보기 ----------
  function findPhenomena(run) {
    const H = run.history, last = H[H.length - 1], out = [];
    const h0 = H[0];
    out.push({
      title: '① 학습 전: 아무것도 모른다', epoch: 0, heat: true,
      text: `학습 전(0에폭)에는 모든 칸의 ‘물체가 있다’ 점수가 약 ${f2(h0.train.objNeg)}로 비슷합니다. 상자도 엉뚱한 곳에 있고 검증 정답률은 ${pct(h0.val.acc)}입니다.`
    });
    const eBg = H.findIndex((h) => h.epoch > 0 && h.train.objNeg < 0.1);
    if (eBg > 0) {
      const h = H[eBg];
      out.push({
        title: '② ‘없다’부터 배운다', epoch: h.epoch, heat: true,
        text: `${h.epoch}에폭에 배경 칸 점수는 ${f2(h0.train.objNeg)} → ${f2(h.train.objNeg)}로 떨어졌고, 물체 칸 점수는 ${f2(h0.train.objPos)} → ${f2(h.train.objPos)}입니다. 한 사진에 배경 칸은 48개 안팎, 물체 칸은 몇 개뿐이라 일단 “없다”고 답하는 것이 오차를 가장 빨리 줄이기 때문입니다. 물체 칸은 그다음에 올라갑니다.`
      });
    }
    const eHalf = H.findIndex((h) => h.val.acc >= 0.5);
    if (eHalf >= 0) {
      out.push({
        title: '③ 처음으로 절반을 맞힌 때', epoch: H[eHalf].epoch, heat: false,
        text: `${H[eHalf].epoch}에폭에 처음으로 검증 사진의 절반 이상(${pct(H[eHalf].val.acc)})을 맞혔습니다. 상자 위치와 이름을 함께 맞혀야 정답입니다.`
      });
    }
    const bestH = H.find((h) => h.epoch === run.bestEpoch) || last;
    if (last.epoch - run.bestEpoch >= 5 && last.val.loss.total > bestH.val.loss.total * 1.05) {
      out.push({
        title: '④ 과적합: 외우기 시작했다', epoch: run.bestEpoch, heat: false,
        text: `검증 오차는 ${run.bestEpoch}에폭(${f3(bestH.val.loss.total)})에 가장 낮았다가 마지막에 ${f3(last.val.loss.total)}로 다시 올랐습니다. 그동안 학습 오차는 ${f3(bestH.train.loss.total)} → ${f3(last.train.loss.total)}로 계속 줄었습니다. 학습 사진의 답을 외웠을 뿐, 처음 보는 사진에는 오히려 나빠진 것입니다.`
      });
    } else {
      out.push({
        title: '④ 과적합은 아직', epoch: last.epoch, heat: false,
        text: `이번 학습에서는 검증 오차가 뚜렷하게 다시 오르지 않았습니다(가장 낮았던 때 ${run.bestEpoch}에폭). 학습 횟수를 늘리거나 학습 사진을 줄여 보세요.`
      });
    }
    const top = bestAccOf(run);
    const topH = H.find((h) => h.epoch === top.epoch) || last;
    let wrongLoc = 0, wrongAll = 0;
    run.valIds.forEach((_, n) => { const sp = snapOf(topH.valSnaps, n); if (!sp.correct) { wrongAll++; if (sp.iou < 0.5) wrongLoc++; } });
    out.push({
      title: '⑤ 이름은 맞히는데 위치가 어렵다', epoch: top.epoch, heat: false, set: 'wrong',
      text: `검증 정답률이 가장 높았던 ${top.epoch}에폭에, 상자 위치는 보지 않고 이름만 보면 ${pct(topH.val.clsAcc)}를 맞혔습니다. 같은 ‘눈’으로 사진 전체의 이름만 맞히는 분류 모드(티처블 머신 방식)는 ${pct(topH.clsMode.valAcc)}입니다. 상자까지 맞힌 탐지 정답률은 ${pct(topH.val.acc)}입니다. 틀린 ${wrongAll}장 중 ${wrongLoc}장은 상자가 정답과 절반도 안 겹쳐서(IoU < 0.5) 틀렸습니다. “어디에 있나”를 맞히는 것이 “무엇인가”보다 어렵습니다.`
    });
    out.push({
      title: '⑥ 학습 사진 vs 처음 보는 사진', epoch: last.epoch, heat: false, set: 'train',
      text: `마지막에 학습 사진은 ${pct(last.train.acc)}를 맞히지만 검증 사진은 ${pct(last.val.acc)}를 맞힙니다. 이 차이가 클수록 외운 것이 많다는 뜻입니다.`
    });
    let ups = 0;
    // 오차가 아주 작아진 뒤의 작은 흔들림은 빼고, 10% 넘게 그리고 0.3 넘게 다시 오른 에폭만 센다
    for (let i = 2; i < H.length; i++) {
      const prev = H[i - 1].train.loss.total, cur = H[i].train.loss.total;
      if (cur > prev * 1.1 && cur - prev > 0.3) ups++;
    }
    if (run.lr >= 0.03 || ups >= 3) {
      out.push({ title: '⑦ 학습률이 너무 크면', epoch: last.epoch, heat: false,
        text: `학습 오차가 직전보다 10% 넘게 오른 에폭이 ${ups}번 있었습니다. 한 번에 너무 크게 고치면 오차가 가장 작은 곳을 지나쳐 버려 오르락내리락합니다. 오차 그래프의 모양을 보세요.` });
    } else if (run.lr <= 0.0003) {
      out.push({ title: '⑦ 학습률이 너무 작으면', epoch: last.epoch, heat: false,
        text: `한 번에 조금씩만 고쳐서 ${last.epoch}에폭이 지나도 학습 정답률이 ${pct(last.train.acc)}입니다. 같은 에폭 수로 학습률 0.002일 때와 비교해 보세요.` });
    } else {
      out.push({ title: '⑦ 다음 실험', epoch: last.epoch, heat: false,
        text: '학습률을 0.03(크게)이나 0.0003(작게)으로 바꾸거나, 이름을 늘리거나, 사진을 더 표시해 다시 학습해 보세요. 결과는 실험 기록에서 비교할 수 있습니다. 한 번의 결과는 씨앗에 따라 흔들리니 여러 번 해 보세요.' });
    }
    const wrongVal = run.valIds.filter((_, n) => !snapOf(last.valSnaps, n).correct).length;
    out.push({
      title: '⑧ 헷갈린 사진', epoch: last.epoch, heat: true, set: 'wrong',
      text: wrongVal ? `마지막 에폭에서 검증 사진 ${wrongVal}장을 틀렸습니다. 이름을 틀렸는지 위치를 틀렸는지, 어떤 이름끼리 헷갈렸는지 판정표와 함께 확인해 보세요.` : '마지막 에폭에서 검증 사진을 모두 맞혔습니다. 학습 사진 중 틀린 것이 있는지 확인해 보세요.'
    });
    const stats = classStats(run, topH);
    const counts = stats.map((x) => x.trainN).filter((n) => n > 0);
    if (counts.length >= 2 && Math.max(...counts) >= 2 * Math.min(...counts)) {
      const few = stats.reduce((a, b) => (b.trainN < a.trainN ? b : a)), many = stats.reduce((a, b) => (b.trainN > a.trainN ? b : a));
      out.push({
        title: '⑨ 사진 수가 다르면', epoch: top.epoch, heat: false,
        text: `학습 사진이 가장 많은 이름은 ‘${many.name}’(${many.trainN}장), 가장 적은 이름은 ‘${few.name}’(${few.trainN}장)입니다. ${top.epoch}에폭에 검증 사진에서 이름을 맞힌 비율은 ‘${many.name}’ ${pct(many.nameAcc)}, ‘${few.name}’ ${pct(few.nameAcc)}입니다. 아래 ‘이름별 결과’ 표에서 사진 수와 정답률을 비교해 보세요. 사진이 적은 이름은 예외가 많을 수 있으니 여러 번 비교해 보세요.`
      });
    }
    if (run.noise > 0) {
      out.push({
        title: '⑩ 틀린 정답이 섞이면', epoch: top.epoch, heat: false, set: 'train',
        text: `학습 사진 ${run.noisy.size}장(${Math.round(run.noise * 100)}%)의 이름을 일부러 다른 이름으로 바꿔 학습했습니다. 최고 검증 정답률은 ${pct(top.acc)}입니다. 같은 씨앗으로 ‘안 섞음’과 비교해 보세요. 학습 사진 보기에서 ‘틀린 정답으로 배움’ 표시가 붙은 사진을 찾아보세요.`
      });
    }
    return out;
  }

  // 이름마다: 학습 사진 수(일부러 틀리게 한 것도 원래 이름으로 셈), 검증 사진 수, 이름만 맞힌 비율, 위치까지 맞힌 비율
  function classStats(run, h) {
    return run.classes.map((c, ci) => {
      const trainN = run.trainIds.filter((id) => run.trueMain.get(id) === ci).length;
      let valN = 0, nameOk = 0, ok = 0;
      run.valIds.forEach((id, n) => {
        if (run.trueMain.get(id) !== ci) return;
        const sp = snapOf(h.valSnaps, n);
        valN++;
        if (sp.cls === ci) nameOk++;
        if (sp.correct) ok++;
      });
      return { name: c.name, color: c.color, trainN, valN, nameAcc: valN ? nameOk / valN : 0, acc: valN ? ok / valN : 0 };
    });
  }

  function renderStep4() {
    const run = state.run;
    if (!run || run.history.length < 2) return;
    const H = run.history;
    el.epochSlider.max = String(H.length - 1);
    state.reviewEpoch = Math.min(Math.max(0, state.reviewEpoch), H.length - 1);
    el.epochSlider.value = String(state.reviewEpoch);
    const h = H[state.reviewEpoch];
    el.epochOut.textContent = `${h.epoch}에폭`;
    el.heatToggle.checked = state.heat;
    for (const b of el.reviewSet.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.s === state.reviewSet));

    el.phenoList.replaceChildren(...findPhenomena(run).map((p) => {
      const card = document.createElement('div');
      card.className = 'pheno-card';
      const t = document.createElement('h4'); t.textContent = p.title;
      const d = document.createElement('p'); d.textContent = p.text;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn btn-small';
      btn.textContent = `${p.epoch}에폭 보러 가기`;
      btn.addEventListener('click', () => {
        state.reviewEpoch = H.findIndex((x) => x.epoch === p.epoch);
        state.heat = p.heat;
        state.reviewSet = p.set || 'val';
        renderStep4();
        el.epochSlider.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
      card.append(t, d, btn);
      return card;
    }));

    const list = [];
    const addSet = (ids, snaps, split) => ids.forEach((id, n) => list.push({ id, split, pred: snapOf(snaps, n) }));
    if (state.reviewSet === 'val') addSet(run.valIds, h.valSnaps, 'val');
    else if (state.reviewSet === 'train') addSet(run.trainIds, h.trainSnaps, 'train');
    else { addSet(run.valIds, h.valSnaps, 'val'); addSet(run.trainIds, h.trainSnaps, 'train'); }
    const shown = state.reviewSet === 'wrong' ? list.filter((x) => !x.pred.correct) : list;
    const frag = document.createDocumentFragment();
    for (const x of shown) {
      const why = x.pred.correct ? '맞음' : x.pred.iou < 0.5 ? '위치 틀림' : '이름 틀림';
      const noisyNote = run.noisy.has(x.id) ? ` <span class="err-text">· 틀린 정답으로 배움(원래 ${esc(run.classes[run.trueMain.get(x.id)].name)})</span>` : '';
      const card = makeCard(x.id, `<b>${x.split === 'val' ? '검증' : '학습'} · 정답 ${esc(mainClassOfRun(run, x.id))}</b><span>${why}${noisyNote}</span>`, 'div');
      paintCard(card, run, x.id, x.pred, state.heat);
      frag.append(card);
    }
    el.reviewGrid.replaceChildren(frag);
    const vOk = run.valIds.filter((_, n) => snapOf(h.valSnaps, n).correct).length;
    el.reviewSummary.textContent = `${h.epoch}에폭: 검증 ${run.valIds.length}장 중 ${vOk}장 정답 (${pct(h.val.acc)}, 이름만 보면 ${pct(h.val.clsAcc)}) · 학습 사진 정답률 ${pct(h.train.acc)}` +
      (state.reviewSet === 'wrong' ? ` · 틀린 사진 ${shown.length}장` : '') + ' · 흰 점선 = 정답, 색 상자 = 모델의 답' +
      (state.heat ? ' · 노란 칸 = ‘물체가 있다’ 점수' : '');

    // 판정표: 위치가 맞은(IoU ≥ 0.5) 사진은 답한 이름으로, 위치가 틀린 사진은 따로 센다
    const K = run.classes.length;
    const tab = run.classes.map(() => new Array(K + 1).fill(0));
    run.valIds.forEach((id, n) => {
      const p = snapOf(h.valSnaps, n);
      const gt = run.classes.findIndex((c) => c.name === mainClassOfRun(run, id));
      if (p.iou < 0.5) tab[gt][K]++; else tab[gt][p.cls]++;
    });
    el.confusion.innerHTML = `<table class="confusion"><thead><tr><th>정답 ＼ 모델의 답</th>${run.classes.map((c) => `<th>${esc(c.name)}</th>`).join('')}<th>위치 틀림<br><span class="mini">(IoU &lt; 0.5)</span></th></tr></thead><tbody>` +
      run.classes.map((c, ci) => `<tr><th>${esc(c.name)}</th>${tab[ci].map((v, j) => `<td>${j === ci ? `<b class="ok-text">${v}장 ✓</b>` : v ? `<span class="err-text">${v}장 ✗</span>` : '0장'}</td>`).join('')}</tr>`).join('') +
      '</tbody></table>';

    el.classTable.innerHTML = '<table><thead><tr><th>이름</th><th>학습 사진</th><th>검증 사진</th><th>이름만 맞힘</th><th>위치까지 맞힘</th></tr></thead><tbody>' +
      classStats(run, h).map((c) => `<tr><th><span class="swatch" style="background:${c.color}"></span> ${esc(c.name)}</th><td>${c.trainN}장</td><td>${c.valN}장</td><td>${c.valN ? pct(c.nameAcc) : '–'}</td><td>${c.valN ? pct(c.acc) : '–'}</td></tr>`).join('') +
      '</tbody></table>';

    const xs = series(run, (x) => x.epoch);
    charts.review.update(xs, [series(run, (x) => x.train.loss.total), series(run, (x) => x.val.loss.total)],
      [{ x: h.epoch, label: `지금 ${h.epoch}` }].concat(run.bestEpoch !== h.epoch ? [{ x: run.bestEpoch, label: `최저 ${run.bestEpoch}` }] : []));
  }

  // ---------- 5단계: 판별 ----------
  function buildExamples() {
    const ex = state.entries.filter((x) => x.split === 'example');
    el.examples.replaceChildren(...ex.map((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `시험 사진 ${it.file} 판별하기`);
      const img = document.createElement('img');
      img.src = sampleUrl(it.file); img.alt = ''; img.width = 84; img.height = 64; img.loading = 'lazy';
      b.append(img);
      b.addEventListener('click', async () => {
        const im = it.imgEl || await loadImg(sampleUrl(it.file));
        if (!im) { showJudgeMsg('시험 사진을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); return; }
        it.imgEl = im;
        judgeImage(im);
      });
      return b;
    }));
  }

  function showJudgeMsg(text) {
    el.judgeMsg.textContent = text ? '⚠ ' + text : '';
    el.judgeMsg.hidden = !text;
  }

  function judgeImage(img) {
    if (!state.run || !state.run.done || !state.insights) { showJudgeMsg('먼저 3단계에서 학습을 끝내 주세요.'); return; }
    showJudgeMsg('');
    const lb = Hd.letterbox(img.naturalWidth || img.width, img.naturalHeight || img.height, S);
    const input = toInput(img, lb);
    const reqId = ++reqSeq;
    state.judge = { img, lb, reqId, input: input.slice() };
    state.judgePending = true;
    worker.postMessage({ type: 'analyze', reqId, input }, [input.buffer]);
    el.verdict.textContent = '판별하는 중…';
  }

  function onInsights(m) {
    if (!state.run || m.runId !== state.run.id) return;
    state.insights = m;
    const last = state.run.history[state.run.history.length - 1].epoch;
    el.whichBest.textContent = `검증 오차가 가장 낮았던 ${state.run.bestEpoch}에폭`;
    el.whichLast.textContent = `마지막 ${last}에폭`;
    if (state.judge && state.judge.input) {
      const input = state.judge.input.slice();
      state.judge.reqId = ++reqSeq;
      worker.postMessage({ type: 'analyze', reqId: state.judge.reqId, input }, [input.buffer]);
    } else if (state.step === 5) {
      charts.map.update(mapPoints(), null, state.run.classes);
    }
  }

  function mapPoints() {
    if (!state.insights) return [];
    return state.insights.points.map((p) => {
      const ph = state.byId.get(p.id);
      return { x: p.x, y: p.y, cls: p.cls, label: `${state.run.classes[p.cls].name} · ${p.id}`, img: ph ? ph.url : '' };
    });
  }

  function onAnalysis(r) {
    state.judgePending = false;
    state.analysis = r;
    el.judgeArea.hidden = false;
    el.judgeArea2.hidden = false;
    renderJudge();
  }

  // 49칸 각각을 후보 상자로 보고, 점수(있다 점수 × 이름 확률)가 기준 이상인 것만 남긴 뒤
  // 같은 이름끼리 IoU가 0.5보다 크게 겹치면 점수가 낮은 쪽을 지운다 (NMS)
  function detections(r, thr, iouThr = 0.5) {
    const K = r.K, cands = [];
    for (let k = 0; k < Hd.CELLS; k++) {
      let c = 0;
      for (let j = 1; j < K; j++) if (r.cls[K * k + j] > r.cls[K * k + c]) c = j;
      const score = r.obj[k] * r.cls[K * k + c];
      if (score >= thr) cands.push({ cell: k, cls: c, score, box: { x1: r.boxes[4 * k], y1: r.boxes[4 * k + 1], x2: r.boxes[4 * k + 2], y2: r.boxes[4 * k + 3] } });
    }
    cands.sort((a, b) => b.score - a.score);
    const alive = cands.map(() => true), kept = [];
    for (let i = 0; i < cands.length; i++) {
      if (!alive[i]) continue;
      kept.push(cands[i]);
      for (let j = i + 1; j < cands.length; j++) {
        if (alive[j] && cands[j].cls === cands[i].cls && Hd.iou(cands[i].box, cands[j].box) > iouThr) alive[j] = false;
      }
    }
    return { cands, kept };
  }

  function drawDetections(ctx, size, r, C, b, top) {
    el.detControls.hidden = state.detMode === 'best';
    for (const bt of el.detMode.querySelectorAll('button')) bt.setAttribute('aria-pressed', String(bt.dataset.m === state.detMode));
    if (state.detMode === 'best') {
      strokeBox(ctx, b.box, size, top.color, 4);
      label(ctx, b.box.x1 * size, b.box.y1 * size, `${top.name} ${pct(b.prob)}`, top.color, size, ink(top.color));
      return;
    }
    const { cands, kept } = detections(r, state.detThr, state.detIou);
    el.detThrOut.textContent = state.detThr.toFixed(2);
    el.detIouOut.textContent = state.detIou.toFixed(2);
    if (state.detMode === 'all') {
      for (const d of cands.slice().reverse()) strokeBox(ctx, d.box, size, C[d.cls].color, 1 + 2.5 * d.score);
      el.detSummary.textContent = cands.length
        ? `점수가 ${state.detThr.toFixed(2)} 이상인 후보 상자 ${cands.length}개입니다. 한 물체 근처의 여러 칸이 비슷한 상자를 냈습니다. ‘여러 물체 (NMS 후)’를 눌러 겹친 상자를 정리해 보세요.`
        : '기준을 넘는 후보가 없습니다. 기준을 낮춰 보세요.';
      return;
    }
    for (const d of kept) {
      strokeBox(ctx, d.box, size, C[d.cls].color, 4);
      label(ctx, d.box.x1 * size, d.box.y1 * size, `${C[d.cls].name} ${pct(d.score)}`, C[d.cls].color, size, ink(C[d.cls].color));
    }
    el.detSummary.textContent = kept.length
      ? `후보 ${cands.length}개 중 같은 이름끼리 IoU가 ${state.detIou.toFixed(2)}보다 큰 상자를 지우고 ${kept.length}개가 남았습니다: ${kept.map((d) => `${C[d.cls].name} ${pct(d.score)}`).join(', ')}. 한 물체에 상자가 여러 개 남았다면 겹침 기준을 낮춰 보세요.`
      : '기준을 넘는 후보가 없습니다. 기준을 낮춰 보세요.';
  }

  function renderJudge() {
    const r = state.analysis, J = state.judge, run = state.run;
    if (!r || !J || !run) return;
    const C = run.classes, K = r.K;
    const b = r.best, k = b.cell, gx = k % Hd.G, gy = Math.floor(k / Hd.G);
    const top = C[r.c1], second = C[r.c2];
    el.verdict.innerHTML = `${tagHtml(top)}(으)로 판별 · 확률 ${pct(b.prob)}` +
      (b.obj < 0.3 ? `<span class="note">다만 ‘물체가 있다’ 점수가 낮아(${f2(b.obj)}) 확신은 적습니다. 덜 배운 모델이나 학습 사진을 외운 모델은 처음 보는 사진에서 물체를 잘 찾지 못합니다. 또 이 모델은 여러분이 만든 이름(${C.map((c) => esc(c.name)).join(', ')})만 압니다.</span>` : '');

    const ctx = el.judgeCanvas.getContext('2d');
    const size = el.judgeCanvas.width, kk = size / S;
    ctx.fillStyle = '#727272';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(J.img, J.lb.padX * kk, J.lb.padY * kk, J.lb.nw * kk, J.lb.nh * kk);
    if (el.judgeHeat.checked) { drawHeat(ctx, r.obj, size); drawGrid(ctx, size); }
    const cs = size / Hd.G;
    ctx.lineWidth = 4; ctx.strokeStyle = '#000';
    ctx.strokeRect(gx * cs, gy * cs, cs, cs);
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
    ctx.strokeRect(gx * cs, gy * cs, cs, cs);
    drawDetections(ctx, size, r, C, b, top);

    const o = r.o, Z = (c) => o[Hd.BOX_OUT + c];
    el.judgeWhere.innerHTML =
      row('찾은 칸', `7×7칸 중 <b>${gx + 1}열 ${gy + 1}행</b> (검은 테두리 네모)`) +
      row('있다 점수', `σ(${f2(o[0])}) = 1 ÷ (1 + e<sup>${o[0] >= 0 ? '−' : ''}${Math.abs(o[0]).toFixed(2)}</sup>) = <b>${f3(b.obj)}</b>`) +
      row('뽑은 기준', `있다 점수 × 이름 확률 = ${f3(b.obj)} × ${f3(b.prob)} = <b>${f3(b.score)}</b> (49칸 중 가장 큼)`);

    // 이름별 확률 막대
    const probs = C.map((c, i) => ({ c, i, p: r.cls[K * k + i] })).sort((a, b2) => b2.p - a.p);
    el.judgeProbs.innerHTML = probs.map(({ c, p }) =>
      `<div class="bar-row"><span>${esc(c.name)}</span><span class="track"><span class="fill" style="left:0;width:${(p * 100).toFixed(1)}%;background:${c.color}"></span></span><span class="val">${pct(p)}</span></div>`).join('');

    const sumExp = C.reduce((s, _, i) => s + Math.exp(Z(i)), 0);
    const sumC = r.contrib.reduce((s, x) => s + x.c, 0);
    el.judgeCalc.innerHTML =
      row('이름별 점수', C.map((c, i) => `z<sub>${esc(c.name)}</sub> = ${f2(Z(i))}`).join(', ')) +
      row(`${esc(top.name)} 확률`, `e<sup>${f2(Z(r.c1))}</sup> ÷ (${C.map((_, i) => `e<sup>${f2(Z(i))}</sup>`).join(' + ')}) = ${Math.exp(Z(r.c1)).toPrecision(3)} ÷ ${sumExp.toPrecision(3)} = <b>${f3(r.cls[K * k + r.c1])}</b>`) +
      row('1등 − 2등', `z<sub>${esc(top.name)}</sub> − z<sub>${esc(second.name)}</sub> = ${f2(Z(r.c1))} − ${num(Z(r.c2))} = <b>${f2(Z(r.c1) - Z(r.c2))}</b>`) +
      row('차이의 출처', `숨은 값 32개의 기여 합 ${f2(sumC)} + 편향 차 ${num(r.bDiff)} = ${f2(sumC + r.bDiff)}`);

    const topC = r.contrib.slice().sort((a, b2) => Math.abs(b2.c) - Math.abs(a.c)).slice(0, 5);
    const maxC = Math.max(...topC.map((x) => Math.abs(x.c)), 1e-6);
    el.contribList.replaceChildren(...topC.map((x) => {
      const wrap = document.createElement('div');
      wrap.className = 'unit-row';
      const left = document.createElement('div');
      const side = x.c >= 0 ? top : second;
      const w = (Math.abs(x.c) / maxC) * 50;
      left.innerHTML =
        `<div class="bar-row diverge"><span>숨은 값 #${x.unit + 1}</span><span class="track"><span class="fill" style="${x.c >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`};background:${side.color}"></span></span><span class="val">${sgn(x.c)}</span></div>` +
        `<div class="mini">값 ${f2(x.h)} × 가중치 차 ${num(x.w)} = ${sgn(x.c)} → <b>${esc(side.name)} 쪽</b></div>`;
      const thumbs = document.createElement('div');
      thumbs.className = 'thumbs';
      for (const t of (state.insights.unitTop[x.unit] || [])) {
        const ph = state.byId.get(t.id);
        if (!ph) continue;
        const img = document.createElement('img');
        img.src = ph.url;
        img.alt = `숨은 값 #${x.unit + 1}이 크게 켜진 학습 사진 ${t.id}`;
        img.title = `${t.id} (값 ${f2(t.v)})`;
        img.width = 44; img.height = 44;
        thumbs.append(img);
      }
      wrap.append(left, thumbs);
      return wrap;
    }));

    el.neighborList.replaceChildren(...r.neighbors.map((nb) => {
      const ph = state.byId.get(nb.id);
      const c = C[nb.cls];
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = ph ? ph.url : ''; img.alt = `${c.name} 학습 사진 ${nb.id}`; img.width = 120; img.height = 120;
      const cap = document.createElement('figcaption');
      cap.innerHTML = `${tagHtml(c)}<br>닮은 정도 ${f2(nb.sim)}`;
      fig.append(img, cap);
      return fig;
    }));
    charts.map.update(mapPoints(), { x: r.point.x, y: r.point.y, label: '새 사진' }, C);
  }

  // ---------- 단계 이동 ----------
  function stepEnabled(n) {
    if (n === 1) return true;
    if (n === 2) return state.photos.length > 0;
    if (n === 3) return splitData().ok;
    return !!(state.run && state.run.done && state.run.history.length > 1 && !state.training);
  }

  function setStep(n, focusTab) {
    if (!stepEnabled(n)) return;
    if (n !== 5) stopCam();
    state.step = n;
    render();
    if (focusTab) el.tabs[n - 1].focus();
  }

  function render() {
    if (!stepEnabled(state.step)) state.step = 1;
    el.tabs.forEach((t, i) => {
      const n = i + 1, on = n === state.step;
      t.disabled = !stepEnabled(n);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      el.panels[i].hidden = !on;
    });
    if (state.step === 1) { renderClassList(); if (state.photos.length) { applyFilter(); renderLabeler(); } }
    else if (state.step === 2) renderStep2();
    else if (state.step === 3) {
      updateNSel();
      updateTrainUi();
      const run = state.run;
      if (run && run.history.length) { updateCharts(run); paintLiveGrid(run, run.history[run.history.length - 1]); }
    } else if (state.step === 4) renderStep4();
    else if (state.step === 5) { if (state.analysis) renderJudge(); else if (state.insights) charts.map.update(mapPoints(), null, state.run.classes); }
  }

  function buildCredits() {
    const frag = document.createDocumentFragment();
    for (const it of state.entries) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = it.credit.page; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = it.credit.title;
      const lic = it.credit.licenseUrl ? document.createElement('a') : document.createElement('span');
      if (it.credit.licenseUrl) { lic.href = it.credit.licenseUrl; lic.target = '_blank'; lic.rel = 'noopener'; }
      lic.textContent = it.credit.license;
      li.append(`${it.file}: `, a, ` — ${it.credit.artist || '작성자 미상'}, `, lic);
      frag.append(li);
    }
    el.creditList.replaceChildren(frag);
  }

  // ---------- 이벤트 ----------
  el.tabs.forEach((t) => t.addEventListener('click', () => setStep(Number(t.dataset.step))));
  document.querySelector('.steps').addEventListener('keydown', (e) => {
    const enabled = el.tabs.filter((t) => !t.disabled).map((t) => Number(t.dataset.step));
    const pos = enabled.indexOf(state.step);
    let next = null;
    if (e.key === 'ArrowRight') next = enabled[Math.min(enabled.length - 1, pos + 1)];
    else if (e.key === 'ArrowLeft') next = enabled[Math.max(0, pos - 1)];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next != null) { e.preventDefault(); setStep(next, true); }
  });

  // 사진 올리기
  el.pickFiles.addEventListener('click', () => el.trainFiles.click());
  el.pickFolder.addEventListener('click', () => el.trainFolder.click());
  for (const input of [el.trainFiles, el.trainFolder]) {
    input.addEventListener('change', () => {
      const files = [...input.files];
      input.value = '';   // 같은 파일을 다시 골라도 동작하게
      if (files.length) addFiles(files);
    });
  }
  el.clearFiles.addEventListener('click', clearFiles);

  // 임시(검증용): 샘플 폴더 사진을 서버에서 받아 선생님 정답지와 함께 넣는다. 수업 배포 전에 지울 것
  const loadAllTempBtn = $('loadAllTemp');
  if (loadAllTempBtn && new URLSearchParams(location.search).has('teacher')) loadAllTempBtn.hidden = false;
  if (loadAllTempBtn) {
    loadAllTempBtn.addEventListener('click', async () => {
      if (state.uploading || state.training) return;
      if (!state.entries.length) await loadAnswerKey();
      const list = state.entries.filter((x) => x.split !== 'example' && !state.byId.has(x.file.normalize('NFC')));
      if (!list.length) { showPrepMsg(state.entries.length ? '이미 모두 불러왔습니다.' : '정답지(labels.json)를 불러오지 못했습니다.'); return; }
      loadAllTempBtn.disabled = true;
      showPrepMsg('');
      const files = [], preset = {};
      let done = 0, failed = 0;
      for (let i = 0; i < list.length; i += 8) {
        await Promise.all(list.slice(i, i + 8).map(async (it) => {
          try {
            const res = await fetch(sampleUrl(it.file));
            if (!res.ok) throw new Error(res.status);
            files.push(new File([await res.blob()], it.file, { type: 'image/jpeg' }));
            preset[it.file.normalize('NFC')] = { cls: it.cls, boxes: it.boxes };
          } catch (err) {
            failed++;
          }
          done++;
          setPrep(el.prepPhotos, 'loading', `[임시] 서버에서 받는 중… ${done} / ${list.length}`, done / list.length);
        }));
      }
      loadAllTempBtn.disabled = false;
      await addFiles(files, preset);
      if (failed) showPrepMsg(`[임시] 사진 ${failed}장을 받지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.`);
    });
  }

  // 라벨링
  el.prevPhoto.addEventListener('click', () => goPhoto(state.cur - 1));
  el.nextPhoto.addEventListener('click', () => goPhoto(state.cur + 1));
  el.wholeBox.addEventListener('click', () => {
    const p = curPhoto();
    if (!p) return;
    addBox(p, { x1: p.lb.padX / S, y1: p.lb.padY / S, x2: (p.lb.padX + p.lb.nw) / S, y2: (p.lb.padY + p.lb.nh) / S });
  });
  el.delBox.addEventListener('click', () => {
    const p = curPhoto();
    if (!p || state.selBox < 0) return;
    p.boxes.splice(state.selBox, 1);
    state.selBox = -1;
    labelsChanged(p);
  });
  el.skipPhoto.addEventListener('click', () => {
    const p = curPhoto();
    if (!p) return;
    p.skip = !p.skip;
    labelsChanged(p);
  });
  el.dataCanvas.addEventListener('pointerdown', (e) => {
    const p = curPhoto();
    if (!p || state.training) return;
    const pt = canvasPoint(e);
    const hit = hitBox(p, pt);
    drag = { mode: hit >= 0 ? 'maybe' : 'draw', x0: pt.x, y0: pt.y, x: pt.x, y: pt.y, hit };
    if (hit >= 0) state.selBox = hit;
    try { el.dataCanvas.setPointerCapture(e.pointerId); } catch (err) { /* 캡처를 못 해도 그리기는 된다 */ }
    renderLabeler();
  });
  el.dataCanvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = canvasPoint(e);
    drag.x = pt.x; drag.y = pt.y;
    if (drag.mode === 'maybe' && (Math.abs(pt.x - drag.x0) > 0.02 || Math.abs(pt.y - drag.y0) > 0.02)) { drag.mode = 'draw'; state.selBox = -1; }
    if (drag.mode === 'draw') renderLabeler();
  });
  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    const p = curPhoto();
    if (p && d.mode === 'draw' && Math.abs(d.x - d.x0) > 0.03 && Math.abs(d.y - d.y0) > 0.03) {
      addBox(p, { x1: Math.min(d.x0, d.x), y1: Math.min(d.y0, d.y), x2: Math.max(d.x0, d.x), y2: Math.max(d.y0, d.y) });
    } else {
      renderLabeler();
    }
  };
  el.dataCanvas.addEventListener('pointerup', endDrag);
  el.dataCanvas.addEventListener('pointercancel', () => { drag = null; renderLabeler(); });
  // 단축키 (입력 칸에 쓰는 중에는 무시)
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  el.panels[0].addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || !curPhoto() || state.training) return;
    const p = curPhoto();
    if (ARROWS[e.key] && p.boxes[state.selBox] && e.target === el.dataCanvas) {
      e.preventDefault();
      nudgeBox(...ARROWS[e.key], e.shiftKey);
      return;
    }
    if ((e.key === 'n' || e.key === 'N') && p.boxes.length) { e.preventDefault(); el.nextBox.click(); return; }
    if (e.key === 'Escape' && state.selBox >= 0) { state.selBox = -1; renderLabeler(); return; }
    if (/^[1-7]$/.test(e.key) && state.classes[Number(e.key) - 1]) {
      state.active = Number(e.key) - 1;
      applyActiveToSelected();
      renderClassList(); renderLabeler();
    } else if (e.key === 'ArrowRight' && e.target === el.dataCanvas) { e.preventDefault(); goPhoto(state.cur + 1); }
    else if (e.key === 'ArrowLeft' && e.target === el.dataCanvas) { e.preventDefault(); goPhoto(state.cur - 1); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selBox >= 0) { e.preventDefault(); el.delBox.click(); }
    else if ((e.key === 'f' || e.key === 'F') && e.target === el.dataCanvas) { e.preventDefault(); el.wholeBox.click(); }
  });
  // 고른 상자를 1%씩 옮기거나(방향키) 오른쪽·아래 변을 늘이고 줄인다(Shift+방향키)
  function nudgeBox(dx, dy, resize) {
    const p = curPhoto();
    const b = p && p.boxes[state.selBox];
    if (!b) return;
    const step = 0.01;
    const lo = { x: p.lb.padX / S, y: p.lb.padY / S }, hi = { x: (p.lb.padX + p.lb.nw) / S, y: (p.lb.padY + p.lb.nh) / S };
    let { x1, y1, x2, y2 } = toInputBox(p, b);
    if (resize) {
      x2 = Math.min(hi.x, Math.max(x1 + 0.03, x2 + dx * step));
      y2 = Math.min(hi.y, Math.max(y1 + 0.03, y2 + dy * step));
    } else {
      const mx = Math.min(hi.x - x2, Math.max(lo.x - x1, dx * step)), my = Math.min(hi.y - y2, Math.max(lo.y - y1, dy * step));
      x1 += mx; x2 += mx; y1 += my; y2 += my;
    }
    const sb = Hd.boxToSource({ x1, y1, x2, y2 }, p.lb);
    Object.assign(b, { x1: sb.x1, y1: sb.y1, x2: sb.x2, y2: sb.y2 });
    labelsChanged(p);
  }
  el.nextBox.addEventListener('click', () => {
    const p = curPhoto();
    if (!p || !p.boxes.length) { setClassMsg('이 사진에는 아직 상자가 없습니다.'); return; }
    state.selBox = (state.selBox + 1) % p.boxes.length;
    renderLabeler();
    el.dataCanvas.focus();
  });

  // ---------- 정답 표시 파일 저장·불러오기 (모둠 합치기) ----------
  const LABEL_APP = 'yolo-lab-labels';
  el.saveLabelsBtn.addEventListener('click', () => {
    const labels = {};
    for (const p of state.photos) {
      if (p.boxes.length || p.skip) labels[p.id] = { boxes: p.boxes.map((b) => [+b.x1.toFixed(4), +b.y1.toFixed(4), +b.x2.toFixed(4), +b.y2.toFixed(4), b.cls]), skip: p.skip };
    }
    const n = Object.keys(labels).length;
    if (!n) { el.labelIoMsg.textContent = '저장할 정답 표시가 없습니다. 먼저 상자를 그려 주세요.'; return; }
    const data = { app: LABEL_APP, version: 1, savedAt: new Date().toISOString(), classes: state.classes.map((c) => c.name), labels };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date(), two = (v) => String(v).padStart(2, '0');
    a.href = URL.createObjectURL(blob);
    a.download = `yolo-정답표시-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    el.labelIoMsg.textContent = `사진 ${n}장의 정답 표시를 파일로 저장했습니다.`;
  });
  el.loadLabelsBtn.addEventListener('click', () => el.labelFile.click());
  el.labelFile.addEventListener('change', async () => {
    const files = [...el.labelFile.files];
    el.labelFile.value = '';
    if (!files.length || state.training) return;
    const store = readStore();
    const valid = (v) => typeof v === 'number' && v >= 0 && v <= 1;
    let photos = 0, applied = 0, droppedBoxes = 0;
    const bad = [];
    for (const f of files) {
      let data;
      try { data = JSON.parse(await f.text()); } catch (err) { bad.push(f.name); continue; }
      if (!data || data.app !== LABEL_APP || typeof data.labels !== 'object') { bad.push(f.name); continue; }
      for (const n of Array.isArray(data.classes) ? data.classes : []) addClassName(n, true);
      for (const [rawName, v] of Object.entries(data.labels)) {
        const name = String(rawName).normalize('NFC');
        const boxes = [];
        for (const b of Array.isArray(v && v.boxes) ? v.boxes : []) {
          if (!Array.isArray(b) || b.length !== 5 || ![0, 1, 2, 3].every((i) => valid(b[i])) || b[2] <= b[0] || b[3] <= b[1]) { droppedBoxes++; continue; }
          const ci = addClassName(b[4], true);
          if (ci < 0) { droppedBoxes++; continue; }
          boxes.push({ x1: b[0], y1: b[1], x2: b[2], y2: b[3], cls: state.classes[ci].name });
        }
        store.labels[name] = { boxes: boxes.map((b) => [b.x1, b.y1, b.x2, b.y2, b.cls]), skip: !!(v && v.skip) };
        photos++;
        const p = state.byId.get(name);
        if (p) { p.boxes = boxes; p.skip = !!(v && v.skip); applied++; }
      }
    }
    store.classes = state.classes.map((c) => c.name);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (err) { /* 이번 접속 동안만 유지 */ }
    state.selBox = -1;
    buildGallery();
    renderClassList();
    if (curPhoto()) renderLabeler();
    updateLabelSummary();
    updateNSel();
    render();
    el.labelIoMsg.textContent = (photos ? `사진 ${photos}장의 정답 표시를 불러왔습니다. 지금 올려 둔 사진 ${applied}장에 적용했고, 나머지는 그 사진을 올리면 적용됩니다.` : '') +
      (droppedBoxes ? ` 이름이 7개를 넘거나 값이 잘못된 상자 ${droppedBoxes}개는 뺐습니다.` : '') +
      (bad.length ? ` 정답 표시 파일이 아니어서 읽지 못한 파일: ${bad.join(', ')}` : '');
  });

  el.addClass.addEventListener('click', () => {
    const before = state.classes.length;
    const i = addClassName(el.classInput.value);
    if (i < 0) return;
    state.active = i;
    el.classInput.value = '';
    setClassMsg(state.classes.length > before ? `‘${state.classes[i].name}’ 이름을 만들었습니다. 이제 사진 위를 끌어 상자를 그려 보세요.` : `‘${state.classes[i].name}’ 이름은 이미 있어서 그 이름을 골랐습니다.`);
    saveLabels();
    renderClassList();
    renderLabeler();
  });
  el.classInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.addClass.click(); } });
  el.dataFilter.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.filter = b.dataset.f;
    applyFilter();
  });
  el.gallery.addEventListener('click', (e) => {
    const card = e.target.closest('.photo');
    if (!card) return;
    goPhoto(Number(card.dataset.idx));
    if (window.innerWidth <= 820) el.dataCanvas.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
  el.clearLabels.addEventListener('click', () => {
    if (state.training) return;
    if (!window.confirm('표시한 상자와 이름을 모두 지울까요? 되돌릴 수 없습니다.')) return;
    for (const p of state.photos) { p.boxes = []; p.skip = false; }
    state.classes = [];
    state.active = 0;
    state.selBox = -1;
    try { localStorage.removeItem(STORE_KEY); } catch (err) { /* 무시 */ }
    buildGallery();
    renderClassList();
    renderLabeler();
    updateLabelSummary();
    render();
  });

  // 특징
  el.chanSlider.addEventListener('input', () => {
    state.channel = Number(el.chanSlider.value);
    el.chanOut.textContent = String(state.channel);
    renderStep2();
  });
  el.chanBest.addEventListener('click', pickBestChannel);
  el.featCanvas.addEventListener('pointerdown', (e) => {
    const r = el.featCanvas.getBoundingClientRect();
    const gx = Math.min(Hd.G - 1, Math.floor(((e.clientX - r.left) / r.width) * Hd.G));
    const gy = Math.min(Hd.G - 1, Math.floor(((e.clientY - r.top) / r.height) * Hd.G));
    state.featCell = gy * Hd.G + gx;
    renderStep2();
  });
  el.featCanvas.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const k = Math.max(0, state.featCell);
    const gx = Math.min(Hd.G - 1, Math.max(0, k % Hd.G + d[0])), gy = Math.min(Hd.G - 1, Math.max(0, Math.floor(k / Hd.G) + d[1]));
    state.featCell = gy * Hd.G + gx;
    renderStep2();
  });

  // 학습
  el.trainBtn.addEventListener('click', startTraining);
  el.pauseBtn.addEventListener('click', () => {
    state.paused = !state.paused;
    worker.postMessage({ type: state.paused ? 'pause' : 'resume' });
    updateTrainUi();
  });
  el.stopBtn.addEventListener('click', () => { worker.postMessage({ type: 'stop' }); state.paused = false; });

  // 돌아보기
  el.epochSlider.addEventListener('input', () => { state.reviewEpoch = Number(el.epochSlider.value); renderStep4(); });
  el.reviewSet.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.reviewSet = b.dataset.s;
    renderStep4();
  });
  el.heatToggle.addEventListener('change', () => { state.heat = el.heatToggle.checked; renderStep4(); });

  // 판별
  el.uploadBtn.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', () => {
    const file = el.fileInput.files[0];
    el.fileInput.value = '';
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) { showJudgeMsg('사진 파일(JPG, PNG 등)을 골라 주세요.'); return; }
    const url = URL.createObjectURL(file);
    loadImg(url).then((img) => {
      URL.revokeObjectURL(url);
      if (img) judgeImage(img);
      else showJudgeMsg('이 사진을 열 수 없습니다. JPG나 PNG로 다시 골라 주세요. (아이폰 HEIC 사진은 JPG로 바꿔서 올려 주세요)');
    });
  });
  document.querySelectorAll('input[name="which"]').forEach((r) => r.addEventListener('change', () => {
    state.which = r.value;
    worker.postMessage({ type: 'insights', which: r.value });
  }));
  el.judgeHeat.addEventListener('change', renderJudge);
  el.detMode.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.detMode = b.dataset.m;
    renderJudge();
  });
  el.detThr.addEventListener('input', () => { state.detThr = Number(el.detThr.value); renderJudge(); });
  el.detIou.addEventListener('input', () => { state.detIou = Number(el.detIou.value); renderJudge(); });

  // 웹캠: 찍은 화면을 그대로 판별한다 (서버로 보내지 않음)
  let camStream = null, camTimer = null;
  async function startCam() {
    if (!state.run || !state.run.done || !state.insights) { showJudgeMsg('먼저 3단계에서 학습을 끝내 주세요.'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showJudgeMsg('이 브라우저에서는 웹캠을 쓸 수 없습니다. (https 주소나 최신 브라우저가 필요합니다)'); return; }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (err) {
      showJudgeMsg('웹캠을 켤 수 없습니다. 카메라 권한을 허용했는지, 다른 프로그램이 카메라를 쓰고 있지 않은지 확인해 주세요. (' + (err.name || err.message) + ')');
      return;
    }
    showJudgeMsg('');
    el.camVideo.srcObject = camStream;
    el.camBox.hidden = false;
    el.camBtn.disabled = true;
    try { await el.camVideo.play(); } catch (err) { /* 자동 재생이 막혀도 찰칵은 동작 */ }
  }
  function stopCam() {
    clearInterval(camTimer);
    camTimer = null;
    if (el.camAuto) el.camAuto.checked = false;
    if (camStream) camStream.getTracks().forEach((t) => t.stop());
    camStream = null;
    if (el.camVideo) el.camVideo.srcObject = null;
    if (el.camBox) el.camBox.hidden = true;
    if (el.camBtn) el.camBtn.disabled = false;
  }
  function camShot() {
    const v = el.camVideo;
    if (!camStream || !v.videoWidth || state.judgePending) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    judgeImage(c);
  }
  el.camBtn.addEventListener('click', startCam);
  el.camStop.addEventListener('click', stopCam);
  el.camShot.addEventListener('click', camShot);
  el.camAuto.addEventListener('change', () => {
    clearInterval(camTimer);
    camTimer = el.camAuto.checked ? setInterval(camShot, 1000) : null;
    if (el.camAuto.checked) camShot();
  });
  window.addEventListener('pagehide', stopCam);

  el.retryBtn.addEventListener('click', () => {
    el.retryWrap.hidden = true;
    showPrepMsg('');
    if (state.model !== 'ready') {
      // 특징은 워커 안에 있으므로 워커를 다시 만들면 처음부터 다시 뽑는다
      state.photos.forEach((p) => { p.extracted = false; });
      state.rawFeats.clear();
      startWorker();
    } else {
      extractAll();
    }
  });

  const year = $('current-year');
  if (year) year.textContent = new Date().getFullYear();

  // 시작
  for (const n of readStore().classes || []) addClassName(n, true);
  renderClassList();
  updateUploadUi();
  render();
  startWorker();
  loadAnswerKey();

  // 테스트용 (화면 동작에는 쓰지 않음)
  window.__yoloLab = { state, setStep, startTraining, judgeImage, splitData, addFiles };
})();
