// activity14_yolo_lab_worker.js — 특징 추출(MobileNetV2) + 탐지 머리 학습을 화면 밖에서 처리하는 워커
importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.wasm.min.js', 'activity14_yolo_lab_head.js');

const Hd = self.YoloHead;
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

let session = null;
const rawFeats = new Map();     // 사진 번호 → 백본 출력 [49×320]
let run = null;                 // 진행 중인 학습
let model = null;               // 마지막으로 끝난 학습 결과 { last, best, stats, ... }

const post = (msg, transfer) => self.postMessage(msg, transfer || []);
const tick = () => new Promise((r) => setTimeout(r, 0));

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`모델 파일 응답 ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    post({ type: 'load-progress', ratio: Math.min(1, got / total) });
  }
  const out = new Uint8Array(got);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

async function extract(input) {
  const t = new ort.Tensor('float32', input, [1, 3, Hd.INPUT, Hd.INPUT]);
  const res = await session.run({ [session.inputNames[0]]: t });
  return Hd.toCellMajor(res[session.outputNames[0]].data);
}

// ---------- 학습 ----------
function evaluate(params, items) {
  const sum = { obj: 0, noobj: 0, box: 0, cls: 0, total: 0 };
  let correct = 0, clsRight = 0, objPos = 0, nPos = 0, objNeg = 0, nNeg = 0;
  const snaps = new Float32Array(items.length * SNAP);
  items.forEach((it, n) => {
    const l = Hd.imageLoss(params, it.feats, it.target);
    for (const k in sum) sum[k] += l[k];
    const pred = Hd.predict(params, it.feats);
    const best = Hd.bestCell(pred);
    const j = Hd.judge(best, it.target);
    if (j.correct) correct++;
    if (best.cls === it.target.list[0].cls) clsRight++;   // 상자 위치는 보지 않고 종류만 맞았는지
    for (let k = 0; k < Hd.CELLS; k++) {
      if (it.target.resp[k] >= 0) { objPos += pred.obj[k]; nPos++; } else { objNeg += pred.obj[k]; nNeg++; }
    }
    const o = n * SNAP;
    snaps.set(pred.obj, o);
    snaps[o + 49] = best.box.x1; snaps[o + 50] = best.box.y1; snaps[o + 51] = best.box.x2; snaps[o + 52] = best.box.y2;
    snaps[o + 53] = best.cls; snaps[o + 54] = best.prob; snaps[o + 55] = best.obj;
    snaps[o + 56] = j.iou; snaps[o + 57] = j.correct ? 1 : 0;
  });
  const n = items.length || 1;
  for (const k in sum) sum[k] /= n;
  return { loss: sum, acc: correct / n, clsAcc: clsRight / n, objPos: objPos / Math.max(1, nPos), objNeg: objNeg / Math.max(1, nNeg), snaps };
}
const SNAP = 58;   // 사진마다 기록: 물체 점수 49 + 상자 4 + 종류·확률·물체 3 + IoU·정답 2

async function train(msg) {
  const { settings, items } = msg;
  const stats = Hd.featureStats(items.filter((it) => it.split === 'train').map((it) => rawFeats.get(it.id)));
  const prep = items.map((it) => {
    const feats = Hd.normalize(rawFeats.get(it.id), stats);
    const target = Hd.makeTarget(it.boxes);
    // 분류 모드용: 사진 전체 평균 특징과 대표 이름(가장 큰 상자의 이름)
    const main = target.list.reduce((a, b) => (b.area > a.area ? b : a));
    return { id: it.id, split: it.split, feats, target, pooled: Hd.poolFeatures(feats), label: main.cls };
  });
  const trainSet = prep.filter((it) => it.split === 'train');
  const valSet = prep.filter((it) => it.split === 'val');
  const params = Hd.createParams(settings.seed, settings.K);
  const opt = Hd.createAdam(params);
  const grads = Hd.zerosLike(params);
  const rand = Hd.rng(settings.seed + 99);
  // 분류 모드(티처블 머신 방식) 분류기를 같은 사진·같은 순서로 함께 학습해 비교한다
  const cls = Hd.createClassifier(settings.seed, settings.K);
  const clsOpt = Hd.createAdam(cls);
  const clsGrads = Hd.zerosLike(cls);
  const clsAcc = (set) => set.length ? set.filter((it) => Hd.classifierPredict(cls, it.pooled).cls === it.label).length / set.length : 0;
  const myRun = { stop: false, paused: false };
  run = myRun;

  let best = { epoch: 0, valLoss: Infinity, params: Hd.cloneParams(params) };
  const report = (epoch, ms) => {
    const tr = evaluate(params, trainSet);
    const va = evaluate(params, valSet);
    if (va.loss.total < best.valLoss) best = { epoch, valLoss: va.loss.total, params: Hd.cloneParams(params) };
    post({
      type: 'epoch', runId: settings.runId, epoch, ms,
      train: { loss: tr.loss, acc: tr.acc, clsAcc: tr.clsAcc, objPos: tr.objPos, objNeg: tr.objNeg },
      val: { loss: va.loss, acc: va.acc, clsAcc: va.clsAcc },
      clsMode: { trainAcc: clsAcc(trainSet), valAcc: clsAcc(valSet) },
      trainSnaps: tr.snaps, valSnaps: va.snaps, bestEpoch: best.epoch
    }, [tr.snaps.buffer, va.snaps.buffer]);
  };
  report(0, 0);
  await tick();

  const B = settings.batch;
  for (let epoch = 1; epoch <= settings.epochs; epoch++) {
    const t0 = performance.now();
    const order = trainSet.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let s = 0; s < order.length; s += B) {
      const batch = order.slice(s, s + B);
      for (const i of batch) {
        Hd.imageLoss(params, trainSet[i].feats, trainSet[i].target, grads);
        Hd.classifierLoss(cls, trainSet[i].pooled, trainSet[i].label, clsGrads);
      }
      Hd.adamStep(params, grads, opt, settings.lr, 1 / batch.length);
      Hd.adamStep(cls, clsGrads, clsOpt, settings.lr, 1 / batch.length);
      await tick();
      while (myRun.paused && !myRun.stop) await new Promise((r) => setTimeout(r, 120));
      if (myRun.stop) break;
    }
    if (myRun.stop) break;
    report(epoch, performance.now() - t0);
  }
  model = { last: Hd.cloneParams(params), best, stats, prep, trainSet, runId: settings.runId };
  if (run === myRun) run = null;
  post({ type: 'train-done', runId: settings.runId, stopped: myRun.stop, bestEpoch: best.epoch });
  sendInsights('best');
}

// ---------- 학습 결과 들여다보기 ----------
// 학습 사진마다 '책임 칸'의 숨은 값 32개 (가장 큰 동물 기준)
function responsibleHidden(params, it) {
  const t = it.target.list.reduce((a, b) => (b.area > a.area ? b : a));
  const pred = Hd.predict(params, it.feats, true);
  return { cell: t.cell, cls: t.cls, h: pred.hidden.slice(t.cell * Hd.H, (t.cell + 1) * Hd.H) };
}

function paramsOf(which) { return which === 'last' ? model.last : model.best.params; }

function buildInsights(which) {
  const params = paramsOf(which);
  const rows = model.trainSet.map((it) => ({ id: it.id, ...responsibleHidden(params, it) }));
  const pca = Hd.pca2(rows.map((r) => r.h), Hd.H);
  // 숨은 값마다 가장 강하게 켜진 학습 사진 3장
  const unitTop = [];
  for (let j = 0; j < Hd.H; j++) {
    unitTop.push(rows.map((r) => ({ id: r.id, v: r.h[j] })).sort((a, b) => b.v - a.v).slice(0, 3).filter((x) => x.v > 0));
  }
  return { which, rows, pca, unitTop };
}

let insights = null;
function sendInsights(which) {
  if (!model) return;
  insights = buildInsights(which);
  post({
    type: 'insights', which, runId: model.runId,
    points: insights.rows.map((r, i) => ({ id: r.id, cls: r.cls, x: insights.pca.points[i][0], y: insights.pca.points[i][1] })),
    unitTop: insights.unitTop
  });
}

function analyze(feats) {
  const params = paramsOf(insights.which);
  const norm = Hd.normalize(feats, model.stats);
  const pred = Hd.predict(params, norm, true);
  const best = Hd.bestCell(pred);
  const k = best.cell;
  const K = params.K, O = Hd.BOX_OUT + K;
  const h = Array.from(pred.hidden.slice(k * Hd.H, (k + 1) * Hd.H));
  const o = Array.from(pred.outs.slice(k * O, (k + 1) * O));
  // 1등 종류와 2등 종류의 점수 차이가 어디서 왔는지: 숨은 값 × (1등 가중치 − 2등 가중치)
  const c1 = best.cls;
  let c2 = c1 === 0 ? 1 : 0;
  for (let c = 0; c < K; c++) if (c !== c1 && o[Hd.BOX_OUT + c] > o[Hd.BOX_OUT + c2]) c2 = c;
  const w1 = (j) => params.W2[(Hd.BOX_OUT + c1) * Hd.H + j], w2 = (j) => params.W2[(Hd.BOX_OUT + c2) * Hd.H + j];
  const contrib = h.map((v, j) => ({ unit: j, h: v, w: w1(j) - w2(j), c: v * (w1(j) - w2(j)) }));
  const neighbors = insights.rows
    .map((r) => ({ id: r.id, cls: r.cls, sim: Hd.cosine(r.h, h) }))
    .sort((a, b) => b.sim - a.sim).slice(0, 5);
  const xy = insights.pca.project(h);
  return {
    K, obj: pred.obj, cls: pred.cls, boxes: pred.boxes, best, h, o, contrib, c1, c2,
    bDiff: params.b2[Hd.BOX_OUT + c1] - params.b2[Hd.BOX_OUT + c2], neighbors, point: { x: xy[0], y: xy[1] }
  };
}

// ---------- 메시지 ----------
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      const bytes = await fetchBytes(m.url);
      post({ type: 'load-progress', ratio: 1, preparing: true });
      session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      post({ type: 'ready' });
    } else if (m.type === 'extract') {
      const t0 = performance.now();
      rawFeats.set(m.id, await extract(m.input));
      post({ type: 'extracted', id: m.id, ms: performance.now() - t0 });
    } else if (m.type === 'get-features') {
      const f = rawFeats.get(m.id);
      post({ type: 'features', id: m.id, feats: f ? f.slice() : null });
    } else if (m.type === 'train') {
      if (run) run.stop = true;
      await tick();
      await train(m);
    } else if (m.type === 'pause') {
      if (run) run.paused = true;
    } else if (m.type === 'resume') {
      if (run) run.paused = false;
    } else if (m.type === 'stop') {
      if (run) { run.stop = true; run.paused = false; }
    } else if (m.type === 'insights') {
      sendInsights(m.which);
    } else if (m.type === 'analyze') {
      if (!model) throw new Error('먼저 학습을 해 주세요.');
      const feats = await extract(m.input);
      post({ type: 'analysis', reqId: m.reqId, result: analyze(feats) });
    }
  } catch (err) {
    post({ type: 'error', about: m.type, id: m.id, reqId: m.reqId, message: err.message || String(err) });
  }
};
