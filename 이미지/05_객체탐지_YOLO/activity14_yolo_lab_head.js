/* activity14_yolo_lab_head.js — YOLO v1식 탐지 머리: 순전파·손실·역전파·Adam (화면과 무관한 순수 계산)
 *
 * 사진(224×224) → MobileNetV2(고정) → 7×7 칸 × 특징 320개
 * 칸마다:  특징 320개 → 숨은 값 32개(ReLU) → 출력 5 + K개 (K = 학생이 만든 종류 수)
 *   출력 0       : 물체 점수        p = σ(o0)
 *   출력 1, 2    : 칸 안에서의 상자 중심 위치  σ(o1), σ(o2)  (0~1)
 *   출력 3, 4    : 상자 너비·높이의 제곱근     σ(o3), σ(o4)  (너비 = σ(o3)²)
 *   출력 5 ~ 4+K : 종류별 점수 → 소프트맥스 확률
 */
(function (root) {
  'use strict';

  const G = 7;            // 격자 크기
  const CELLS = G * G;
  const C = 320;          // 칸마다 특징 수
  const H = 32;           // 숨은 값 수
  const BOX_OUT = 5;      // 물체 1 + 상자 4. 그 뒤에 종류 K개
  const INPUT = 224;
  const LAMBDA_COORD = 5;     // 상자 오차를 더 무겁게 (YOLO v1과 같은 값)
  const LAMBDA_NOOBJ = 0.5;   // 배경 칸의 물체 점수 오차는 가볍게
  const MEAN = [0.485, 0.456, 0.406];   // ImageNet 정규화
  const STD = [0.229, 0.224, 0.225];

  const sigmoid = (x) => 1 / (1 + Math.exp(-x));

  // 같은 씨앗이면 같은 결과가 나오는 난수 (수업에서 결과를 재현하려고)
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(rand) {
    const u = Math.max(1e-12, rand()), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function createParams(seed = 1, K = 2) {
    const rand = rng(seed);
    const O = BOX_OUT + K;
    const p = {
      K,
      W1: new Float32Array(H * C), b1: new Float32Array(H),
      W2: new Float32Array(O * H), b2: new Float32Array(O)
    };
    const s1 = Math.sqrt(2 / C), s2 = Math.sqrt(1 / H) * 0.1;
    for (let i = 0; i < p.W1.length; i++) p.W1[i] = gauss(rand) * s1;
    for (let i = 0; i < p.W2.length; i++) p.W2[i] = gauss(rand) * s2;
    return p;
  }

  const arrayKeys = (p) => Object.keys(p).filter((k) => p[k] instanceof Float32Array);

  function zerosLike(p) {
    const z = { K: p.K };
    for (const k of arrayKeys(p)) z[k] = new Float32Array(p[k].length);
    return z;
  }

  function cloneParams(p) {
    const c = { K: p.K };
    for (const k of arrayKeys(p)) c[k] = p[k].slice();
    return c;
  }

  // 원본 W×H 사진을 비율을 지켜 224×224에 넣는 방법
  function letterbox(w, h, size = INPUT) {
    const r = Math.min(size / w, size / h);
    const nw = Math.round(w * r), nh = Math.round(h * r);
    return { srcW: w, srcH: h, size, r, nw, nh, padX: Math.floor((size - nw) / 2), padY: Math.floor((size - nh) / 2) };
  }

  // 원본 기준 0~1 상자 → 입력(224) 기준 0~1 상자
  function boxToInput(b, lb) {
    return {
      x1: (b[0] * lb.srcW * lb.r + lb.padX) / lb.size,
      y1: (b[1] * lb.srcH * lb.r + lb.padY) / lb.size,
      x2: (b[2] * lb.srcW * lb.r + lb.padX) / lb.size,
      y2: (b[3] * lb.srcH * lb.r + lb.padY) / lb.size
    };
  }

  function boxToSource(b, lb) {
    const f = (v, pad, len) => Math.min(1, Math.max(0, (v * lb.size - pad) / (len * lb.r)));
    return { x1: f(b.x1, lb.padX, lb.srcW), y1: f(b.y1, lb.padY, lb.srcH), x2: f(b.x2, lb.padX, lb.srcW), y2: f(b.y2, lb.padY, lb.srcH) };
  }

  // RGBA(224×224) → 정규화한 [3, 224, 224]
  function toInputTensor(rgba, size = INPUT) {
    const N = size * size;
    const f = new Float32Array(3 * N);
    for (let i = 0; i < N; i++) {
      for (let c = 0; c < 3; c++) f[c * N + i] = (rgba[4 * i + c] / 255 - MEAN[c]) / STD[c];
    }
    return f;
  }

  // 백본 출력 [320, 7, 7] → 칸마다 특징을 모은 [49, 320]
  function toCellMajor(chw, offset = 0) {
    const out = new Float32Array(CELLS * C);
    for (let c = 0; c < C; c++) {
      for (let k = 0; k < CELLS; k++) out[k * C + c] = chw[offset + c * CELLS + k];
    }
    return out;
  }

  // 정답 상자 → 이 사진에서 책임지는 칸과 목표값. 한 칸에 둘이면 큰 상자를 맡긴다
  function makeTarget(boxes) {
    const resp = new Int16Array(CELLS).fill(-1);
    const list = [];
    for (const b of boxes) {
      const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
      const w = Math.max(1e-4, b.x2 - b.x1), h = Math.max(1e-4, b.y2 - b.y1);
      const gx = Math.min(G - 1, Math.max(0, Math.floor(cx * G)));
      const gy = Math.min(G - 1, Math.max(0, Math.floor(cy * G)));
      const cell = gy * G + gx;
      const t = { cell, gx, gy, tx: cx * G - gx, ty: cy * G - gy, sw: Math.sqrt(w), sh: Math.sqrt(h), cls: b.cls, area: w * h, box: b };
      if (resp[cell] >= 0 && list[resp[cell]].area >= t.area) continue;
      if (resp[cell] >= 0) list[resp[cell]] = t; else { resp[cell] = list.length; list.push(t); }
    }
    return { resp, list };
  }

  // 한 칸 순전파. h, z1, o 배열을 채운다
  function forwardCell(p, feats, base, z1, h, o) {
    const O = BOX_OUT + p.K;
    for (let j = 0; j < H; j++) {
      let s = p.b1[j];
      const row = j * C;
      for (let c = 0; c < C; c++) s += p.W1[row + c] * feats[base + c];
      z1[j] = s;
      h[j] = s > 0 ? s : 0;
    }
    for (let k = 0; k < O; k++) {
      let s = p.b2[k];
      const row = k * H;
      for (let j = 0; j < H; j++) s += p.W2[row + j] * h[j];
      o[k] = s;
    }
  }

  // o[from] ~ o[from+K-1] 의 소프트맥스를 out에 채운다
  function softmaxInto(o, from, K, out) {
    let m = -Infinity;
    for (let k = 0; k < K; k++) m = Math.max(m, o[from + k]);
    let sum = 0;
    for (let k = 0; k < K; k++) { out[k] = Math.exp(o[from + k] - m); sum += out[k]; }
    for (let k = 0; k < K; k++) out[k] /= sum;
    return out;
  }

  const EPS = 1e-7;

  // 사진 한 장의 손실. grads가 있으면 기울기를 더한다
  function imageLoss(p, feats, target, grads) {
    const K = p.K, O = BOX_OUT + K;
    const z1 = new Float64Array(H), h = new Float64Array(H), o = new Float64Array(O);
    const dO = new Float64Array(O), dz = new Float64Array(H), q = new Float64Array(K);
    const loss = { obj: 0, noobj: 0, box: 0, cls: 0 };
    for (let k = 0; k < CELLS; k++) {
      const base = k * C;
      forwardCell(p, feats, base, z1, h, o);
      const pr = sigmoid(o[0]);
      const ti = target.resp[k];
      dO.fill(0);
      if (ti >= 0) {
        const t = target.list[ti];
        loss.obj += -Math.log(pr + EPS);
        dO[0] = pr - 1;
        const tv = [t.tx, t.ty, t.sw, t.sh];
        for (let q = 0; q < 4; q++) {
          const s = sigmoid(o[1 + q]);
          const d = s - tv[q];
          loss.box += LAMBDA_COORD * d * d;
          dO[1 + q] = LAMBDA_COORD * 2 * d * s * (1 - s);
        }
        softmaxInto(o, BOX_OUT, K, q);
        loss.cls += -Math.log(q[t.cls] + EPS);
        for (let k = 0; k < K; k++) dO[BOX_OUT + k] = q[k] - (t.cls === k ? 1 : 0);
      } else {
        loss.noobj += -LAMBDA_NOOBJ * Math.log(1 - pr + EPS);
        dO[0] = LAMBDA_NOOBJ * pr;
      }
      if (!grads) continue;
      for (let kk = 0; kk < O; kk++) {
        const d = dO[kk];
        if (d === 0) continue;
        grads.b2[kk] += d;
        const row = kk * H;
        for (let j = 0; j < H; j++) grads.W2[row + j] += d * h[j];
      }
      for (let j = 0; j < H; j++) {
        if (z1[j] <= 0) { dz[j] = 0; continue; }
        let s = 0;
        for (let kk = 0; kk < O; kk++) s += p.W2[kk * H + j] * dO[kk];
        dz[j] = s;
      }
      for (let j = 0; j < H; j++) {
        const d = dz[j];
        if (d === 0) continue;
        grads.b1[j] += d;
        const row = j * C;
        for (let c = 0; c < C; c++) grads.W1[row + c] += d * feats[base + c];
      }
    }
    loss.total = loss.obj + loss.noobj + loss.box + loss.cls;
    return loss;
  }

  function createAdam(p) {
    return { t: 0, m: zerosLike(p), v: zerosLike(p) };
  }

  function adamStep(p, g, opt, lr, scale, b1 = 0.9, b2 = 0.999) {
    opt.t++;
    const c1 = 1 - Math.pow(b1, opt.t), c2 = 1 - Math.pow(b2, opt.t);
    for (const key of arrayKeys(p)) {
      const P = p[key], Gk = g[key], m = opt.m[key], v = opt.v[key];
      for (let i = 0; i < P.length; i++) {
        const gi = Gk[i] * scale;
        m[i] = b1 * m[i] + (1 - b1) * gi;
        v[i] = b2 * v[i] + (1 - b2) * gi * gi;
        P[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8);
      }
      Gk.fill(0);
    }
  }

  // 사진 한 장 예측: 칸마다 물체 점수·상자·종류 확률
  function predict(p, feats, wantHidden = false) {
    const K = p.K, O = BOX_OUT + K;
    const z1 = new Float64Array(H), h = new Float64Array(H), o = new Float64Array(O), q = new Float64Array(K);
    const obj = new Float32Array(CELLS), cls = new Float32Array(CELLS * K), boxes = new Float32Array(CELLS * 4);
    const hidden = wantHidden ? new Float32Array(CELLS * H) : null;
    const outs = wantHidden ? new Float32Array(CELLS * O) : null;
    for (let k = 0; k < CELLS; k++) {
      forwardCell(p, feats, k * C, z1, h, o);
      obj[k] = sigmoid(o[0]);
      const gx = k % G, gy = Math.floor(k / G);
      const cx = (gx + sigmoid(o[1])) / G, cy = (gy + sigmoid(o[2])) / G;
      const w = sigmoid(o[3]) ** 2, hh = sigmoid(o[4]) ** 2;
      boxes[4 * k] = cx - w / 2; boxes[4 * k + 1] = cy - hh / 2;
      boxes[4 * k + 2] = cx + w / 2; boxes[4 * k + 3] = cy + hh / 2;
      softmaxInto(o, BOX_OUT, K, q);
      for (let c = 0; c < K; c++) cls[K * k + c] = q[c];
      if (hidden) { hidden.set(h, k * H); outs.set(o, k * O); }
    }
    return { K, obj, cls, boxes, hidden, outs };
  }

  // 가장 자신 있는 칸 하나 (점수 = 물체 점수 × 종류 확률)
  function topClass(pred, k) {
    let c = 0;
    for (let j = 1; j < pred.K; j++) if (pred.cls[pred.K * k + j] > pred.cls[pred.K * k + c]) c = j;
    return c;
  }

  function bestCell(pred) {
    let best = 0, bs = -1;
    for (let k = 0; k < CELLS; k++) {
      const s = pred.obj[k] * pred.cls[pred.K * k + topClass(pred, k)];
      if (s > bs) { bs = s; best = k; }
    }
    const c = topClass(pred, best);
    return {
      cell: best, score: bs, cls: c, obj: pred.obj[best], prob: pred.cls[pred.K * best + c],
      box: { x1: pred.boxes[4 * best], y1: pred.boxes[4 * best + 1], x2: pred.boxes[4 * best + 2], y2: pred.boxes[4 * best + 3] }
    };
  }

  function iou(a, b) {
    const iw = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
    const ih = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
    const inter = iw * ih;
    const u = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
    return u > 0 ? inter / u : 0;
  }

  // 판정: 가장 자신 있는 상자가 정답 상자 중 하나와 IoU 0.5 이상 겹치고 종류도 맞으면 정답
  function judge(best, target) {
    let bestIou = 0, match = null;
    for (const t of target.list) {
      const v = iou(best.box, t.box);
      if (v > bestIou) { bestIou = v; match = t; }
    }
    const clsOk = match ? match.cls === best.cls : false;
    return { iou: bestIou, clsOk, correct: bestIou >= 0.5 && clsOk, gtCls: match ? match.cls : target.list[0].cls };
  }

  // ---------- 분류 모드 (상자 없이 사진 전체가 무엇인지만) ----------
  // 49칸의 특징을 평균 내어 사진 한 장을 숫자 320개로 만든다
  function poolFeatures(feats) {
    const x = new Float32Array(C);
    for (let k = 0; k < CELLS; k++) for (let c = 0; c < C; c++) x[c] += feats[k * C + c];
    for (let c = 0; c < C; c++) x[c] /= CELLS;
    return x;
  }

  function createClassifier(seed = 1, K = 2) {
    const rand = rng(seed + 7);
    const p = { K, W: new Float32Array(K * C), b: new Float32Array(K) };
    for (let i = 0; i < p.W.length; i++) p.W[i] = gauss(rand) * 0.01;
    return p;
  }

  function classifierScores(p, x) {
    const z = new Float64Array(p.K);
    for (let k = 0; k < p.K; k++) {
      let s = p.b[k];
      for (let c = 0; c < C; c++) s += p.W[k * C + c] * x[c];
      z[k] = s;
    }
    return softmaxInto(z, 0, p.K, new Float64Array(p.K));
  }

  // 한 장의 교차 엔트로피 손실. grads가 있으면 기울기를 더한다
  function classifierLoss(p, x, y, grads) {
    const q = classifierScores(p, x);
    if (grads) {
      for (let k = 0; k < p.K; k++) {
        const d = q[k] - (k === y ? 1 : 0);
        grads.b[k] += d;
        for (let c = 0; c < C; c++) grads.W[k * C + c] += d * x[c];
      }
    }
    return -Math.log(q[y] + EPS);
  }

  function classifierPredict(p, x) {
    const q = classifierScores(p, x);
    let best = 0;
    for (let k = 1; k < p.K; k++) if (q[k] > q[best]) best = k;
    return { cls: best, prob: q[best], probs: q };
  }

  // 특징 정규화: 학습 사진 전체의 칸별 평균·표준편차로 맞춘다
  function featureStats(featList) {
    const mean = new Float64Array(C), sq = new Float64Array(C);
    let n = 0;
    for (const f of featList) {
      for (let k = 0; k < CELLS; k++) {
        for (let c = 0; c < C; c++) { const v = f[k * C + c]; mean[c] += v; sq[c] += v * v; }
        n++;
      }
    }
    const std = new Float32Array(C), m32 = new Float32Array(C);
    for (let c = 0; c < C; c++) {
      m32[c] = mean[c] / n;
      std[c] = Math.sqrt(Math.max(1e-8, sq[c] / n - m32[c] * m32[c]));
    }
    return { mean: m32, std };
  }

  function normalize(f, st) {
    const out = new Float32Array(f.length);
    for (let k = 0; k < CELLS; k++) for (let c = 0; c < C; c++) out[k * C + c] = (f[k * C + c] - st.mean[c]) / st.std[c];
    return out;
  }

  // 2차원 지도: 벡터들의 주성분 2개 (거듭제곱법)
  function pca2(vectors, dim) {
    const n = vectors.length;
    const mean = new Float64Array(dim);
    for (const v of vectors) for (let i = 0; i < dim; i++) mean[i] += v[i] / n;
    const cov = new Float64Array(dim * dim);
    for (const v of vectors) {
      for (let i = 0; i < dim; i++) {
        const a = v[i] - mean[i];
        for (let j = 0; j < dim; j++) cov[i * dim + j] += a * (v[j] - mean[j]) / n;
      }
    }
    const comps = [];
    for (let c = 0; c < 2; c++) {
      let x = new Float64Array(dim).map((_, i) => 1 + ((i * 7 + c * 3) % 5));
      for (let it = 0; it < 200; it++) {
        const y = new Float64Array(dim);
        for (let i = 0; i < dim; i++) for (let j = 0; j < dim; j++) y[i] += cov[i * dim + j] * x[j];
        for (const prev of comps) { let d = 0; for (let i = 0; i < dim; i++) d += y[i] * prev[i]; for (let i = 0; i < dim; i++) y[i] -= d * prev[i]; }
        let norm = 0; for (let i = 0; i < dim; i++) norm += y[i] * y[i];
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < dim; i++) x[i] = y[i] / norm;
      }
      comps.push(x);
    }
    const project = (v) => comps.map((cp) => { let s = 0; for (let i = 0; i < dim; i++) s += (v[i] - mean[i]) * cp[i]; return s; });
    return { mean, comps, project, points: vectors.map(project) };
  }

  function cosine(a, b) {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? d / Math.sqrt(na * nb) : 0;
  }

  const api = {
    G, CELLS, C, H, BOX_OUT, INPUT, LAMBDA_COORD, LAMBDA_NOOBJ,
    sigmoid, rng, createParams, zerosLike, cloneParams, letterbox, boxToInput, boxToSource, toInputTensor, toCellMajor,
    makeTarget, imageLoss, createAdam, adamStep, predict, topClass, bestCell, iou, judge, featureStats, normalize, pca2, cosine, softmaxInto,
    poolFeatures, createClassifier, classifierLoss, classifierPredict
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YoloHead = api;
})(typeof self !== 'undefined' ? self : this);
