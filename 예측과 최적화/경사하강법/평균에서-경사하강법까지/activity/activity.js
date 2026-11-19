/* 손실함수와 경사하강법 실험실 — 1280×720 무대 하나에서 튜토리얼처럼 진행한다.
 * 단계(A1~B5)마다 여러 박자(beat)가 있고, 박자마다 그래프 위 말풍선이 할 일을 알려 준다.
 * 손잡이를 끌거나 고르면 조건이 맞을 때 '다음 →'이 나타난다. 계산은 gd-math.js(GDMath), 그림은 _cute-kit(Kit). */
(function () {
  'use strict';
  const M = window.GDMath, K = window.Kit, { svg, clamp } = window.Motion;
  const { C, text, tag, makeKid, paintKid, placeKid, setA } = K;
  const $ = (id) => document.getElementById(id);
  const P = M.FRIENDS, CO = M.coeffs(P);
  const L = (a) => M.loss(P, a), dL = (a) => M.slope(P, a);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 1280, H = 720;

  /* 숫자 표시: 음수 기호는 −, 아주 작은 값은 0 */
  const fmt = (v, d = 2) => (Math.abs(v) < .5 * 10 ** -d ? 0 : v).toFixed(d).replace('-', '−');
  const sgn = (v, d = 2) => (v > .5 * 10 ** -d ? '+' : '') + fmt(v, d);
  /* HTML 요소 만들기: h('div', { class: 'row', onclick: fn }, 자식…) */
  function h(name, attrs = {}, ...kids) {
    const e = document.createElement(name);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => e.append(c instanceof Node ? c : String(c)));
    return e;
  }
  const btn = (label, onclick, attrs = {}) => h('button', { type: 'button', ...attrs, onclick }, label);
  function animate(dur, onFrame, done) {
    if (REDUCED) { onFrame(1); done(); return; }
    const t0 = performance.now();
    const f = (now) => { const k = Math.min(1, (now - t0) / dur); onFrame(k); if (k < 1) requestAnimationFrame(f); else done(); };
    requestAnimationFrame(f);
  }
  const toastEl = $('toast'), toastQ = [];
  let toastBusy = false;
  function toast(msg) {
    toastQ.push(msg);
    if (toastBusy) return;
    const next = () => {
      const m = toastQ.shift();
      if (!m) { toastBusy = false; return; }
      toastBusy = true;
      toastEl.textContent = m;
      toastEl.classList.add('show');
      setTimeout(() => { toastEl.classList.remove('show'); setTimeout(next, 300); }, 2400);
    };
    next();
  }

  /* ================= 무대: 창 크기에 맞춰 1280×720을 통째로 확대·축소 ================= */
  const vp = $('viewport'), frame = $('frame'), stg = $('stage'), scene = $('scene'), guide = $('guide'), ov = $('ov');
  let k = 1;
  function fit() {
    const r = vp.getBoundingClientRect();
    k = Math.max(.2, Math.min(r.width / W, r.height / H));
    stg.style.transform = `scale(${k})`;
    frame.style.width = `${W * k}px`;
    frame.style.height = `${H * k}px`;
  }
  /* 화면 좌표·요소 위치 → 무대 좌표 */
  const toStage = (e) => { const r = stg.getBoundingClientRect(); return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; };
  const elPos = (el) => { const r = el.getBoundingClientRect(), s = stg.getBoundingClientRect(); return [(r.left + r.width / 2 - s.left) / k, (r.top + r.height / 2 - s.top) / k]; };
  const place = (el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; };

  /* ================= SVG 그리기 도구 ================= */
  const pathOf = (f, a0, a1, X, Y, step = .02) => { const p = []; for (let a = a0; a <= a1 + 1e-9; a += step) p.push(`${p.length ? 'L' : 'M'}${X(a).toFixed(1)} ${Y(f(a)).toFixed(1)}`); return p.join(' '); };
  function axes(s, { X, Y, xs, ys, xMax, yMax, xTitle, yTitle, size = 20 }) {
    ys.forEach((v) => svg('line', { x1: X(0), x2: X(xMax), y1: Y(v), y2: Y(v), stroke: '#eee6da', 'stroke-width': 1.5 }, s));
    svg('line', { x1: X(0), x2: X(xMax), y1: Y(0), y2: Y(0), stroke: C.ink, 'stroke-width': 3 }, s);
    svg('line', { x1: X(0), x2: X(0), y1: Y(0), y2: Y(yMax), stroke: C.ink, 'stroke-width': 3 }, s);
    xs.forEach((v) => text(s, X(v), Y(0) + size + 6, String(v), { 'font-size': size, fill: C.ink, 'text-anchor': 'middle' }));
    ys.forEach((v) => text(s, X(0) - 10, Y(v) + size * .35, String(v), { 'font-size': size - 1, fill: C.ink, 'text-anchor': 'end' }));
    text(s, X(xMax), Y(0) + size * 2 + 10, xTitle, { 'font-size': size - 1, fill: C.coralInk, 'text-anchor': 'end' });
    text(s, X(0) + 12, Y(yMax) + 6, yTitle, { 'font-size': size - 1, fill: C.ink });
  }
  /* 산점도: 아래층(under) · 직선 · 위층(over) · 친구 · 맨 위(top) */
  function scatter(s, X, Y, { kidScale = .85, size = 20 } = {}) {
    axes(s, { X, Y, xs: [1, 2, 3, 4, 5, 6], ys: [2, 4, 6, 8, 10, 12], xMax: 6.4, yMax: 12.8, xTitle: '공부 시간 x', yTitle: '점수 y', size });
    const under = svg('g', {}, s);
    const line = svg('line', { stroke: C.coral, 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
    const over = svg('g', {}, s);
    P.forEach((f, i) => { const kd = makeKid(s); placeKid(kd, X(f.x), Y(f.y), kidScale); paintKid(kd, { col: f.col, id: i }); });
    const top = svg('g', {}, s);
    return { under, line, over, top, setLine: (a) => { const [xe, ye] = lineEnd(a); setA(line, { x1: X(0), y1: Y(0), x2: X(xe), y2: Y(ye) }); } };
  }
  const lineEnd = (a) => { const xe = a > 0 ? Math.min(6.3, 12 / a) : 6.3; return [xe, a * xe]; };
  function lossAxes(s, X, Y, aMax = 4) {
    axes(s, { X, Y, xs: [0, 1, 2, 3, 4].filter((v) => v <= aMax), ys: [10, 20, 30, 40, 50], xMax: aMax + .2, yMax: 56, xTitle: '기울기 a', yTitle: '손실 L(a)' });
  }
  let clipN = 0;
  function clipBox(s, x, y, w, hh) {
    const id = `clip${++clipN}`;
    svg('rect', { x, y, width: w, height: hh }, svg('clipPath', { id }, s));
    return svg('g', { 'clip-path': `url(#${id})` }, s);
  }

  /* ================= 무대 위 HTML 부품 ================= */
  function chips(st) {
    const el = h('div', { class: 'chips' }, h('span', { class: 'chip' }, h('b', {}, st.key), st.title), st.formula ? h('span', { class: 'chip f', html: st.formula }) : '');
    ov.append(el);
    K.paintVars(el);
  }
  function meters(names, x = 1100, y = 92) {
    const box = h('div', { class: 'meters' });
    place(box, x, y);
    const vals = names.map((n) => { const v = h('strong', {}, '–'); box.append(h('div', { class: 'meter' }, h('span', {}, n), v)); return v; });
    ov.append(box);
    K.paintVars(box);
    return vals;
  }
  /* 끌 수 있는 손잡이(키보드 화살표도 됨). drag([무대x, 무대y]) → 새 값(또는 null) */
  /* snap: [[목표값, 범위], …] — 손가락·마우스로 끌 때만 목표 근처에서 딱 붙는다 */
  function handle({ label, aria, min, max, value, step = .01, big = .1, fmtv = (v) => String(v), onChange, drag, cls = '', snap = [] }) {
    const el = h('div', { class: `handle ${cls}`, role: 'slider', tabindex: '0', 'aria-label': aria, 'aria-valuemin': min, 'aria-valuemax': max }, label);
    ov.append(el);
    let v = value;
    el.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      onChange(clamp(v + d * (e.shiftKey ? big : step), min, max));
    });
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
    el.addEventListener('pointermove', (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      let r = drag(toStage(e));
      if (r === null || !Number.isFinite(r)) return;
      r = clamp(r, min, max);
      const hit = snap.find(([t, w]) => Math.abs(r - t) <= w);
      onChange(hit ? hit[0] : r);
    });
    el.addEventListener('pointerup', () => el.classList.remove('drag'));
    const api = {
      el,
      at(x, y) { place(el, x, y); },
      set(nv) { v = nv; el.setAttribute('aria-valuenow', String(nv)); el.setAttribute('aria-valuetext', fmtv(nv)); },
      show(on) { el.hidden = !on; },
      pos() { return [parseFloat(el.style.left), parseFloat(el.style.top)]; },
    };
    api.set(value);
    return api;
  }
  /* 2차원 손잡이: drag([x, y]) → [a, b] 또는 null. 좌우 화살표는 a, 위아래 화살표는 b. onChange(값, 끌었는지) */
  function handle2({ label, aria, value, step = .01, big = .1, fmtv, onChange, drag, cls = '' }) {
    const el = h('div', { class: `handle ${cls}`, role: 'slider', tabindex: '0', 'aria-label': aria }, label);
    ov.append(el);
    let v = value.slice();
    el.addEventListener('keydown', (e) => {
      const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const s = e.shiftKey ? big : step;
      onChange([v[0] + d[0] * s, v[1] + d[1] * s], false);
    });
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
    el.addEventListener('pointermove', (e) => { if (!el.hasPointerCapture(e.pointerId)) return; const r = drag(toStage(e)); if (r) onChange(r, true); });
    el.addEventListener('pointerup', () => el.classList.remove('drag'));
    return {
      el,
      at(x, y) { place(el, x, y); },
      set(nv) { v = nv.slice(); el.setAttribute('aria-valuetext', fmtv(v)); },
      show(on) { el.hidden = !on; },
      pos() { return [parseFloat(el.style.left), parseFloat(el.style.top)]; },
    };
  }
  /* 그림 위 투명 고르기 버튼(친구 고르기) */
  function spot(x, y, label, onclick) { const b = btn('', onclick, { class: 'spot', 'aria-label': label, 'aria-pressed': 'false' }); place(b, x, y); ov.append(b); return b; }
  function fbtn(label, onclick, attrs = {}) { const b = btn(label, onclick, { ...attrs, class: `fbtn ${attrs.class || ''}` }); ov.append(b); return b; }

  /* ================= 튜토리얼 말풍선 ================= */
  const coach = (() => {
    let st = null, beats = [], i = 0, ready = false, box = null, msgEl = null, actEl = null, defAt = [300, 92, 400], targetFn = null;
    let misses = 0, hintTimer = 0;
    function start(step, list, at) { st = step; beats = list; defAt = at; show(0, false); }
    /* 아래 줄: 왼쪽에 ◀ 이전, 오른쪽에 주 버튼들 */
    function setAct(...main) {
      actEl.replaceChildren(i > 0 ? btn('◀ 이전', () => show(i - 1, true), { class: 'back' }) : h('span'), h('span', { class: 'mains' }, ...main));
    }
    function show(n, focus) {
      clearTimeout(hintTimer);
      i = n; ready = false; misses = 0;
      const b = beats[i];
      if (box) box.remove();
      const [x, y, w] = b.at || defAt;
      box = h('div', { class: 'coach', role: 'region', 'aria-label': `${st.key} 안내` });
      place(box, x, y); box.style.width = `${w}px`;
      box.append(h('div', { class: 'c-top' }, `${st.key} · ${i + 1} / ${beats.length}`, h('span', { class: 'dots' }, ...beats.map((_, j) => h('i', { class: j <= i ? 'on' : '' })))));
      const textEl = h('div', { class: 'c-text', tabindex: '-1', html: b.text });
      box.append(textEl);
      if (b.body) box.append(b.body());
      if (b.choices) {
        const ch = h('div', { class: 'c-choices' });
        b.choices.forEach((c) => {
          const bt = btn(c.t, () => {
            if (ready) return;
            if (c.ok || b.neutral) { bt.classList.add(b.neutral ? 'chosen' : 'right'); ch.querySelectorAll('button').forEach((x) => { x.disabled = x !== bt; }); if (c.pick) c.pick(); done(c.fb); }
            else { bt.classList.add('wrong'); say(c.fb, true); }
          });
          ch.append(bt);
        });
        box.append(ch);
      }
      K.paintVars(box);   // 기호 a·α 색(영상과 같은 규칙)
      msgEl = h('p', { class: 'c-msg', 'aria-live': 'polite' });
      actEl = h('div', { class: 'c-act' });
      box.append(msgEl, actEl);
      setAct(...(b.action ? [btn(b.action.label, () => { if (ready) return; const r = b.action.run(); if (r.ok) done(r.msg); else if (r.msg) say(r.msg, true); }, { class: 'primary' })] : []));
      ov.append(box);
      targetFn = b.target || null;
      if (b.enter) b.enter();
      if (b.final) finish();
      else if (!b.wait && !b.choices && !b.action) done(null);
      else if (b.hint) hintTimer = setTimeout(() => { if (!ready) say(`힌트: ${b.hint}`); }, 25000);
      if (focus) textEl.focus();
      check();
    }
    /* warn = 틀렸다는 안내. 두 번째부터는 박자의 힌트를 덧붙인다 */
    function say(m, warn = false) {
      if (!msgEl) return;
      const b = beats[i];
      if (warn) misses++;
      msgEl.textContent = warn && misses >= 2 && b && b.hint ? `${m} 힌트: ${b.hint}` : (m || '');
      K.paintVars(msgEl);
      msgEl.classList.toggle('warn', warn);
      drawGuide();
    }
    function done(m) {
      if (ready) return;
      ready = true;
      clearTimeout(hintTimer);
      say(m, false);
      setAct(btn('다음 →', () => show(i + 1, true), { class: 'primary' }));
      if (beats[i].after) beats[i].after();
      drawGuide();
    }
    function finish() {
      ready = true;
      markDone(st);
      const b = beats[i], last = cur >= STEPS.length - 1, main = [];
      if (b.extra) main.push(h('a', { class: 'pill primary', href: b.extra.href }, b.extra.label));
      main.push(last ? btn(`${STEPS[0].key}부터 다시`, () => go(0), { class: b.extra ? '' : 'primary' }) : btn('다음 단계 →', () => go(cur + 1), { class: 'primary' }));
      setAct(...main);
    }
    function check() {
      if (!box) return;
      const b = beats[i];
      if (!ready && b.wait && b.wait()) done(typeof b.ok === 'function' ? b.ok() : b.ok);
      drawGuide();
    }
    /* 말풍선 가장자리에서 눌러 볼 곳까지 점선, 그 자리에 깜빡이는 고리 */
    function drawGuide() {
      guide.replaceChildren();
      if (!box || !targetFn || ready) return;
      const t = targetFn();
      if (!t) return;
      const x = parseFloat(box.style.left), y = parseFloat(box.style.top), w = box.offsetWidth, hh = box.offsetHeight;
      const cx = clamp(t[0], x, x + w), cy = clamp(t[1], y, y + hh), dx = t[0] - cx, dy = t[1] - cy, d = Math.hypot(dx, dy);
      if (d > 44) svg('line', { x1: cx, y1: cy, x2: t[0] - dx / d * 36, y2: t[1] - dy / d * 36, stroke: C.blueInk, 'stroke-width': 3, 'stroke-dasharray': '7 6' }, guide);
      svg('circle', { cx: t[0], cy: t[1], r: 34, fill: 'none', stroke: C.blueInk, 'stroke-width': 4, class: 'pulse' }, guide);
    }
    return { start, check, place: drawGuide, say, isReady: () => ready, reset() { clearTimeout(hintTimer); box = null; targetFn = null; beats = []; } };
  })();

  /* ================= 단계 이동 ================= */
  /* 기본 활동(main)과 추가 활동(plus)은 같은 엔진을 쓰고 단계 묶음만 다르다 */
  const SET = document.body.dataset.set === 'plus' ? 'plus' : 'main';
  /* 완료한 단계는 이 브라우저에만 기억한다(새로고침해도 ✓ 유지). 저장이 막혀도 활동은 그대로 된다 */
  const STORE = `gd-lab-${SET}-done-v1`;
  const DONE = new Set((() => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } })());
  let cur = 0;
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('이 브라우저에 저장된 완료 표시(✓)를 모두 지울까요?')) return;
    DONE.clear();
    try { localStorage.removeItem(STORE); } catch { /* 저장소를 못 써도 화면 표시는 지운다 */ }
    renderStepper();
    toast('완료 기록을 지웠어요.');
  });
  function markDone(st) {
    if (DONE.has(st.key)) return;
    DONE.add(st.key);
    try { localStorage.setItem(STORE, JSON.stringify([...DONE])); } catch { /* 저장이 안 돼도 진행에는 문제없음 */ }
    renderStepper();
    toast(STEPS.every((x) => DONE.has(x.key)) ? '모든 단계를 마쳤어요!' : `${st.key} 완료!`);
  }
  function renderStepper() {
    const items = [];
    STEPS.forEach((st, i) => {
      if (i && st.key[0] !== STEPS[i - 1].key[0]) items.push(h('li', { class: 'gap', 'aria-hidden': 'true' }));
      const b = btn('', () => go(i), { class: DONE.has(st.key) ? 'done' : '', 'aria-current': i === cur ? 'step' : null, 'aria-label': `${st.key} ${st.title}${DONE.has(st.key) ? ' (완료)' : ''}` });
      b.append(h('b', {}, st.key), h('span', { class: 't' }, st.short));
      items.push(h('li', {}, b));
    });
    $('steps').replaceChildren(...items);
  }
  function go(n) {
    cur = n;
    const st = STEPS[n];
    scene.replaceChildren(); guide.replaceChildren(); ov.replaceChildren(); coach.reset();
    scene.setAttribute('aria-label', `${st.key} ${st.title} 실험 화면`);
    const ep = st.key[0] === 'A' ? 2 : 3;
    $('watch').href = ep === 2 ? '../ep2-loss-function/index.html' : '../ep3-gradient-descent/index.html';
    $('watch').textContent = `▶ ${ep}편 영상`;
    chips(st);
    renderStepper();
    st.build(st);
    history.replaceState(null, '', `#${st.key}`);
  }

  /* 직선 손잡이 끌기: 원점과 손가락 위치를 잇는 기울기 */
  const lineDrag = (X0, sx, Y0, sy) => ([px, py]) => { const xv = (px - X0) / sx, yv = (Y0 - py) / sy; return xv > .4 ? yv / xv : null; };

  /* ================= 안개 속 걷기 무대(B2·B3) ================= */
  function walker(s) {
    const X = (a) => 120 + a * 185, Y = (v) => 660 - v * 10.5;
    lossAxes(s, X, Y);
    const g = clipBox(s, X(0) + 2, Y(54), X(4.2) - X(0), Y(0) - Y(54) - 2);
    svg('path', { d: pathOf(L, 0, 4.2, X, Y), fill: 'none', stroke: C.purple, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    const vtx = svg('circle', { cx: X(2), cy: Y(1), r: 10, fill: C.mint, stroke: C.ink, 'stroke-width': 2.5 }, g);
    const fog = svg('path', { fill: C.cream, 'fill-rule': 'evenodd', opacity: .97 }, g);
    const qm = svg('g', {}, g);
    [[200, 200], [760, 170], [560, 420], [240, 470], [780, 470]].forEach(([x, y], i) => text(qm, x, y, '?', { 'font-size': 46 + (i % 3) * 12, fill: '#d9d0e6', 'text-anchor': 'middle' }));
    const trail = svg('g', {}, s);
    const tan = svg('g', {}, s);
    const tanLine = svg('line', { stroke: C.coral, 'stroke-width': 4, 'stroke-dasharray': '12 8', 'stroke-linecap': 'round' }, tan);
    const tanTag = tag(tan, 0, 0, '', { size: 18 });
    const prev = svg('g', {}, s);
    const prevLine = svg('line', { stroke: C.greenInk, 'stroke-width': 5, 'stroke-linecap': 'round' }, prev);
    const prevHead = svg('path', { d: 'M0 -10 L16 0 L0 10 Z', fill: C.mint, stroke: C.ink, 'stroke-width': 1.5 }, prev);
    const prevTag = tag(prev, 0, 0, '', { size: 16, fill: C.mintSoft, color: C.greenInk });
    const ball = makeKid(s);
    // 오른쪽: 지금 a로 그린 예측 직선
    svg('rect', { x: 900, y: 92, width: 350, height: 240, rx: 18, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, s);
    text(s, 918, 122, '지금의 예측 직선', { 'font-size': 18, fill: C.ink });
    const mx = (x) => 930 + x * 48, my = (y) => 318 - y * 15;
    svg('line', { x1: mx(0), x2: mx(6.4), y1: my(0), y2: my(0), stroke: C.ink, 'stroke-width': 2 }, s);
    svg('line', { x1: mx(0), x2: mx(0), y1: my(0), y2: my(12.3), stroke: C.ink, 'stroke-width': 2 }, s);
    const mLine = svg('line', { stroke: C.coral, 'stroke-width': 4, 'stroke-linecap': 'round' }, s);
    P.forEach((f) => svg('circle', { cx: mx(f.x), cy: my(f.y), r: 8, fill: f.col, stroke: C.ink, 'stroke-width': 2 }, s));
    const mTag = tag(s, 1180, 122, '', { size: 16, fill: C.coralSoft, color: C.coralInk });
    const inPlot = (a) => a > -.3 && a < 4.2 && L(a) < 54;
    const ballXY = (a) => [X(clamp(a, -.3, 4.2)), Y(Math.min(L(a), 54)) - 24];
    function draw({ a, fog: fogOn = true, hop = 0, preview = null, busy = false }) {
      const ok = inPlot(a), d = dL(a), bx = X(clamp(a, -.3, 4.2)), by = Y(Math.min(L(a), 54));
      fog.setAttribute('d', `M0 0 H${W} V${H} H0 Z M${bx - 100} ${by} a100 100 0 1 0 200 0 a100 100 0 1 0 -200 0 Z`);
      fog.setAttribute('opacity', fogOn ? .97 : 0);
      qm.setAttribute('opacity', fogOn ? 1 : 0);
      vtx.setAttribute('opacity', fogOn ? 0 : 1);
      tan.setAttribute('opacity', ok && !busy ? 1 : 0);
      const ux = 185, uy = -d * 10.5, n = Math.hypot(ux, uy);
      setA(tanLine, { x1: bx - ux / n * 110, y1: by - uy / n * 110, x2: bx + ux / n * 110, y2: by + uy / n * 110 });
      tanTag.set(`기울기 L′(a) = ${sgn(d, 2)}`);
      let py = by - 78;
      const showPrev = ok && !busy && preview !== null;
      prev.setAttribute('opacity', showPrev ? 1 : 0);
      if (showPrev) {
        const x2 = X(clamp(preview, -.3, 4.2)), dir = Math.sign(x2 - bx) || 1, vis = Math.abs(x2 - bx) > 18 ? 1 : 0;
        setA(prevLine, { x1: bx, y1: py, x2: x2 - dir * 14, y2: py, opacity: vis });
        prevHead.setAttribute('transform', `translate(${(x2 - dir * 16).toFixed(1)} ${py.toFixed(1)}) scale(${dir} 1)`);
        prevHead.setAttribute('opacity', vis);
        prevTag.set(`다음 걸음 Δa = ${sgn(preview - a, 3)}`);
        prevTag.g.setAttribute('transform', `translate(${bx.toFixed(1)} ${(py - 32).toFixed(1)})`);
        py -= 76;
      }
      tanTag.g.setAttribute('transform', `translate(${bx.toFixed(1)} ${py.toFixed(1)})`);
      placeKid(ball, bx, by - 24 - hop, 1);
      paintKid(ball, { col: C.gold, id: 7, mood: !ok ? 'worry' : Math.abs(a - 2) < .05 ? 'happy' : 'smile' });
      const [xe, ye] = lineEnd(Math.max(a, 0));
      setA(mLine, { x1: mx(0), y1: my(0), x2: mx(xe), y2: my(ye) });
      mTag.set(`ŷ = ${fmt(a, 2)}x`);
    }
    const dot = (a) => { if (inPlot(a)) svg('circle', { cx: X(a), cy: Y(L(a)), r: 6, fill: '#fff', stroke: C.ink, 'stroke-width': 2 }, trail); };
    return { X, Y, draw, dot, inPlot, ballXY, clearTrail: () => trail.replaceChildren() };
  }

  /* ================= 단계 ================= */
  const MAIN = [
    /* ---------- A1 오차 ---------- */
    {
      key: 'A1', short: '오차', title: '오차란 무엇일까?', formula: 'e = y − ŷ',
      build(st) {
        const X = (x) => 120 + x * 150, Y = (y) => 660 - y * 46;
        const sc = scatter(scene, X, Y);
        const S = { a: 2.2, picked: new Set(), result: new Map(), shown: false, pickable: false };
        const SIDE = [-1, 1, -1, 1, 1];
        const segs = P.map((f) => svg('line', { stroke: f.col, 'stroke-width': 5, 'stroke-linecap': 'round' }, sc.under));
        const preds = P.map(() => svg('circle', { r: 8, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, sc.over));
        const labs = P.map(() => text(sc.over, 0, 0, '', { 'font-size': 18, fill: C.ink, class: 'svg-text halo' }));
        const rings = P.map(() => svg('circle', { r: 33, fill: 'none', 'stroke-width': 4 }, sc.top));
        const [mLine] = meters(['예측 직선']);
        const hd = handle({ label: 'a', aria: '직선의 기울기 a', min: 0, max: 3.5, value: S.a, fmtv: (v) => `기울기 ${v.toFixed(2)}`, onChange: (v) => { S.a = Math.round(v * 100) / 100; draw(); }, drag: lineDrag(120, 150, 660, 46), snap: [[2, .03]] });
        hd.show(false);
        const spots = P.map((f, i) => spot(X(f.x), Y(f.y), `${f.name} 고르기`, () => { if (!S.pickable) return; S.picked.has(i) ? S.picked.delete(i) : S.picked.add(i); S.result.clear(); coach.say(''); draw(); }));
        function draw() {
          const a = S.a, [xe, ye] = lineEnd(a);
          sc.setLine(a); hd.at(X(xe), Y(ye)); hd.set(a);
          mLine.textContent = `ŷ = ${a.toFixed(2)}x`;
          P.forEach((f, i) => {
            const x = X(f.x), yh = Y(a * f.x), e = f.y - a * f.x, r = S.result.get(i);
            setA(preds[i], { cx: x, cy: yh });
            setA(segs[i], { x1: x, y1: Y(f.y), x2: x, y2: yh, opacity: S.shown ? 1 : 0 });
            setA(labs[i], { x: x + SIDE[i] * 30, y: (Y(f.y) + yh) / 2 + 6, 'text-anchor': SIDE[i] < 0 ? 'end' : 'start', opacity: S.shown ? 1 : 0 });
            labs[i].textContent = `${f.name} ${f.y} − ${fmt(a * f.x, 1)} = ${sgn(e, 1)}`;
            setA(rings[i], { cx: x, cy: Y(f.y), opacity: S.picked.has(i) || r === false ? 1 : 0, stroke: r === undefined ? C.blueInk : r ? C.greenInk : C.coralInk, 'stroke-dasharray': r ? 'none' : r === false ? '5 5' : '9 6' });
            spots[i].hidden = !S.pickable;
            spots[i].setAttribute('aria-pressed', String(S.picked.has(i)));
            spots[i].setAttribute('aria-label', `${f.name}(${f.x}시간, ${f.y}점) 고르기${r === undefined ? '' : r ? ' — 맞음' : ' — 틀림'}`);
          });
          coach.check();
        }
        draw();
        coach.start(st, [
          { text: '<p>공부 시간 x로 점수를 예측하는 직선 <span class="f">ŷ = 2.2x</span>예요.</p><p>직선 위의 <b>흰 점</b>이 친구마다의 예측값 ŷ예요. ŷ는 ‘<b>와이 햇</b>’이라고 읽어요.</p>', target: () => [X(4), Y(8.8)] },
          {
            hint: '흰 점(예측)이 친구보다 위에 있으면 그 친구는 예측보다 점수가 낮아요.', text: '<p><span class="f">오차 e = 실제 y − 예측 ŷ</span></p><p>오차가 <b>음수(−)</b>일 친구를 모두 눌러 고른 뒤 <b>확인</b>을 누르세요.</p>',
            enter: () => { S.pickable = true; draw(); },
            action: { label: '확인', run: () => {
              const neg = new Set(P.map((f, i) => (f.y - S.a * f.x < -1e-9 ? i : -1)).filter((i) => i >= 0));
              P.forEach((f, i) => S.result.set(i, S.picked.has(i) === neg.has(i)));
              draw();
              return [...S.result.values()].every(Boolean)
                ? { ok: true, msg: '정답! 실제 점수가 예측보다 낮은 친구, 즉 직선보다 아래에 있는 친구의 오차가 음수예요.' }
                : { ok: false, msg: '빨간 점선 동그라미가 틀린 친구예요. 실제 점수가 흰 점(예측)보다 낮은지 보고 다시 골라 보세요.' };
            } },
            after: () => { S.pickable = false; S.shown = true; draw(); },
          },
          { hint: '가온은 2시간 공부했어요. 2 × a = 4가 되는 a는?', text: '<p>이제 직선 끝의 <b>a 손잡이</b>를 끌어 기울기를 바꿔요.</p><p>가온(2시간, 4점)의 오차를 <b>0</b>으로 만들어 보세요.</p>', enter: () => hd.show(true), target: () => hd.pos(), wait: () => Math.abs(4 - 2 * S.a) < .015, ok: 'a = 2이면 가온의 예측 2 × 2 = 4점, 오차 0! 그래도 다른 친구들의 오차는 남아 있어요.' },
          { final: true, text: '<p><b>A1 완료!</b> 점이 직선보다 위면 오차가 +, 아래면 −예요.</p><p>다음 단계에서는 여러 오차를 <b>수 하나</b>로 모아 봐요.</p>' },
        ], [886, 330, 370]);
      },
    },

    /* ---------- A2 손실 ---------- */
    {
      key: 'A2', short: '손실', title: '오차를 수 하나로: 손실', formula: '손실 = (e₁² + … + e₅²) ÷ 5',
      build(st) {
        const X = (x) => 120 + x * 150, Y = (y) => 660 - y * 46;
        const sc = scatter(scene, X, Y);
        // 평균점 (x̄, ȳ) = (3.4, 7). 이 점을 지나는 직선은 기울기와 상관없이 오차의 합이 0이다
        const CX = M.mean(P.map((f) => f.x)), CY = M.mean(P.map((f) => f.y));
        // mode 'origin': ŷ = ax(원점을 지남) · 'pivot': ŷ = 7 + m(x − 3.4)(평균점을 지남)
        const S = { mode: 'origin', a: 1.5, m: .8, sq: false, lockM: false };
        const pred = (x) => (S.mode === 'origin' ? S.a * x : CY + S.m * (x - CX));
        svg('line', { x1: X(0), x2: X(6.4), y1: Y(7), y2: Y(7), stroke: C.muted, 'stroke-width': 2, 'stroke-dasharray': '8 7', opacity: .5 }, sc.under);
        text(sc.under, X(0) + 12, Y(7) - 10, '모두 7점(평균)으로 예측하면 손실 4', { 'font-size': 16, fill: C.muted, class: 'svg-text halo' });
        const pLine = svg('line', { stroke: C.coral, 'stroke-width': 6, 'stroke-linecap': 'round' }, clipBox(sc.under, X(0), Y(12.8), X(6.4) - X(0), Y(0) - Y(12.8)));
        const ctr = svg('g', {}, sc.under);  // 오차 글자(위층)가 가리지 않게 아래층
        svg('path', { d: `M${X(CX)} ${Y(CY) - 13} L${X(CX) + 13} ${Y(CY)} L${X(CX)} ${Y(CY) + 13} L${X(CX) - 13} ${Y(CY)} Z`, fill: C.ink, stroke: '#fff', 'stroke-width': 2 }, ctr);
        tag(ctr, X(CX), Y(CY) + 40, `평균점 (${fmt(CX, 1)}, ${fmt(CY, 0)})`, { size: 17, fill: '#fff' });
        const OFF = [-10, 10, -10, 10, 10];
        const el = P.map((f) => ({
          sq: svg('rect', { fill: f.col, 'fill-opacity': .4, stroke: C.ink, 'stroke-width': 2 }, sc.under),
          seg: svg('line', { stroke: f.col, 'stroke-width': 5, 'stroke-linecap': 'round' }, sc.over),
          lab: text(sc.over, 0, 0, '', { 'font-size': 18, fill: C.ink, class: 'svg-text halo' }),
        }));
        const [mLine, mSum, mLoss] = meters(['예측 직선의 기울기', '오차의 합 Σe', '손실 (오차² 평균)']);
        const hdA = handle({ label: 'a', aria: '원점을 지나는 직선의 기울기 a', min: 0, max: 3.5, value: S.a, fmtv: (v) => `기울기 ${v.toFixed(2)}`, onChange: (v) => { S.a = Math.round(v * 100) / 100; draw(); }, drag: lineDrag(120, 150, 660, 46), snap: [[2.06, .025], [2, .025]] });
        const hdM = handle({ label: 'm', aria: '평균점을 지나는 직선의 기울기 m', min: -3, max: 3.5, value: S.m, cls: 'blue', fmtv: (v) => `기울기 ${v.toFixed(2)}`, onChange: (v) => { S.m = Math.round(v * 100) / 100; draw(); },
          drag: ([px, py]) => { const dx = (px - X(CX)) / 150, dy = (Y(CY) - py) / 46; return dx > .25 ? dy / dx : null; } });
        function draw() {
          const piv = S.mode === 'pivot', e = P.map((f) => f.y - pred(f.x));
          sc.line.setAttribute('opacity', piv ? 0 : 1);
          pLine.setAttribute('opacity', piv ? 1 : 0);
          ctr.setAttribute('opacity', piv ? 1 : 0);
          hdA.show(!piv); hdM.show(piv && !S.lockM);
          if (piv) {
            setA(pLine, { x1: X(0), y1: Y(pred(0)), x2: X(6.4), y2: Y(pred(6.4)) });
            // 손잡이는 평균점에서 오른쪽으로 210px 떨어진 직선 위
            const ux = 150, uy = -46 * S.m, n = Math.hypot(ux, uy);
            hdM.at(X(CX) + ux / n * 210, Y(CY) + uy / n * 210); hdM.set(S.m);
            mLine.textContent = `m = ${fmt(S.m, 2)}`;
          } else {
            const [xe, ye] = lineEnd(S.a);
            sc.setLine(S.a); hdA.at(X(xe), Y(ye)); hdA.set(S.a);
            mLine.textContent = `ŷ = ${S.a.toFixed(2)}x`;
          }
          P.forEach((f, i) => {
            const x = X(f.x) + OFF[i], y1 = Y(f.y), y2 = Y(pred(f.x)), side = Math.abs(e[i]) * 46;
            setA(el[i].seg, { x1: x, y1, x2: x, y2 });
            setA(el[i].sq, { x: OFF[i] < 0 ? x - side : x, y: Math.min(y1, y2), width: side, height: side, opacity: S.sq ? 1 : 0 });
            setA(el[i].lab, { x: x + (OFF[i] < 0 ? -9 : 9), y: (y1 + y2) / 2 + 6, 'text-anchor': OFF[i] < 0 ? 'end' : 'start' });
            el[i].lab.textContent = S.sq ? `${sgn(e[i], 1)} → ${fmt(e[i] * e[i], 2)}` : sgn(e[i], 1);
          });
          mSum.textContent = sgn(M.sum(e), 2);
          mLoss.textContent = S.sq ? fmt(M.mean(e.map((v) => v * v)), 2) : '?';
          mLoss.parentElement.classList.toggle('off', !S.sq);
          coach.check();
        }
        draw();
        coach.start(st, [
          { hint: 'Σe = 0이 되는 기울기는 2와 2.1 사이예요. 손잡이를 천천히 움직여 보세요.', text: '<p>직선이 얼마나 잘 맞는지 <b>수 하나</b>로 나타내 볼까요?</p><p>먼저 손잡이를 끌어, 오차를 모두 더한 <b>Σe</b>(오른쪽)를 0으로 만들어 보세요.</p>', target: () => hdA.pos(), wait: () => S.mode === 'origin' && Math.abs(M.sum(M.errors(P, S.a))) < .1, ok: 'Σe = 0! 그럼 이 직선이 가장 잘 맞는 직선일까요? 다른 직선으로도 확인해 봐요.' },
          { hint: '파란 손잡이를 아래쪽으로 끌면 직선이 오른쪽 아래로 기울어요.', text: '<p>이번엔 직선이 <b>평균점 (3.4, 7)</b>을 지나게 고정했어요. (공부 시간 평균 3.4시간, 점수 평균 7점)</p><p>파란 손잡이로 직선을 돌려 기울기를 <b>음수</b>로 만들어 보세요. Σe는 어떻게 될까요?</p>',
            enter: () => { S.mode = 'pivot'; draw(); }, after: () => { S.lockM = true; draw(); }, target: () => hdM.pos(), wait: () => S.m < -.3,
            ok: '거꾸로 기운 엉뚱한 직선인데도 Σe = 0! 평균점을 지나면 Σ(y − 7) = 0, Σ(x − 3.4) = 0이라 기울기가 얼마든 +와 −가 딱 지워져요.' },
          { text: '<p>그렇다면 오차의 합 Σe로 직선을 평가하면 안 되는 까닭은?</p>', choices: [
            { t: '+와 −가 지워져서, 엉뚱한 직선도 Σe = 0이 되니까', ok: true, fb: '맞아요. 평균점만 지나면 거꾸로 기운 직선도 Σe = 0이에요. 그래서 오차를 제곱해요.' },
            { t: '계산이 너무 복잡해서', fb: '더하기는 간단해요. 문제는 기울기가 음수여도 Σe = 0이 된다는 거예요.' },
            { t: 'Σe가 클수록 좋은 직선이라서', fb: 'Σe = 0인 직선 중에도 엉뚱한 직선이 있었죠? 크기로도 판단할 수 없어요.' },
          ] },
          { text: '<p>같은 엉뚱한 직선을 <b>오차의 제곱</b>(막대를 한 변으로 하는 정사각형 넓이)으로 보면?</p><p>넓이는 모두 0 이상이라 지워지지 않아요. 넓이의 평균인 <b>손실</b>이 크게 나와요.</p><p class="note">※ 평균점을 지나는 직선은 y축과 만나는 높이(절편 b)가 있는 직선 ŷ = mx + b예요. 여기서는 원점을 지나는 ŷ = ax만 다루고, a와 b를 함께 찾는 건 <b>추가 활동</b>에서 해요.</p>',
            enter: () => { S.sq = true; draw(); }, target: () => elPos(mLoss) },
          { hint: '손실 칸의 수를 보면서 손잡이를 천천히 위아래로 움직여 보세요.', text: '<p>다시 원점을 지나는 직선 <b>ŷ = ax</b>로 돌아왔어요.</p><p>이번엔 <b>손실</b>(정사각형 넓이의 평균)이 가장 작아지게 직선을 돌려 보세요.</p>',
            enter: () => { S.mode = 'origin'; draw(); }, target: () => hdA.pos(), wait: () => S.mode === 'origin' && Math.abs(S.a - 2) <= .02, ok: 'a = 2에서 손실 1! Σe = 0이던 a ≈ 2.06과는 다른 곳이에요. 모두 7점으로 예측할 때(4)보다 훨씬 작아요.' },
          { final: true, text: '<p><b>A2 완료!</b> 오차를 제곱해 평균 낸 값이 손실이에요.</p><p>손실은 기울기 a에 따라 달라지죠. 다음 단계에서 그래프로 그려 봐요.</p>' },
        ], [886, 330, 370]);
      },
    },

    /* ---------- A3 손실함수 ---------- */
    {
      key: 'A3', short: '손실함수', title: '손실함수 L(a)', formula: 'a를 넣으면 손실 L(a)가 하나',
      build(st) {
        const X = (a) => 120 + a * 270, Y = (v) => 660 - v * 10.5;
        lossAxes(scene, X, Y, 3.5);
        const S = { a: 1, trace: new Map(), pred: '', curve: false };
        svg('line', { x1: X(0), x2: X(3.7), y1: Y(4), y2: Y(4), stroke: C.muted, 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: .6 }, scene);
        text(scene, X(3.7), Y(4) - 8, '모두 7점 예측: 4', { 'font-size': 15, fill: C.muted, 'text-anchor': 'end' });
        const curve = svg('path', { d: pathOf(L, 0, 3.5, X, Y), fill: 'none', stroke: C.purple, 'stroke-width': 5, opacity: 0 }, scene);
        const traceG = svg('g', {}, scene);
        const guideL = svg('line', { stroke: C.coral, 'stroke-width': 2.5, 'stroke-dasharray': '6 5' }, scene);
        const cur = svg('circle', { r: 9, fill: C.coral, stroke: C.ink, 'stroke-width': 2.5 }, scene);
        // 오른쪽 위: 지금 a로 그린 직선
        svg('rect', { x: 830, y: 92, width: 240, height: 214, rx: 18, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, scene);
        text(scene, 846, 118, '데이터와 직선 ŷ = ax', { 'font-size': 16, fill: C.ink });
        const ix = (x) => 852 + x * 33, iy = (y) => 290 - y * 13;
        svg('line', { x1: ix(0), x2: ix(6.4), y1: iy(0), y2: iy(0), stroke: C.ink, 'stroke-width': 2 }, scene);
        svg('line', { x1: ix(0), x2: ix(0), y1: iy(0), y2: iy(12.5), stroke: C.ink, 'stroke-width': 2 }, scene);
        const iLine = svg('line', { stroke: C.coral, 'stroke-width': 4, 'stroke-linecap': 'round' }, scene);
        P.forEach((f) => svg('circle', { cx: ix(f.x), cy: iy(f.y), r: 7, fill: f.col, stroke: C.ink, 'stroke-width': 2 }, scene));
        const [mA, mL] = meters(['입력 a', '출력 L(a)']);
        const hd = handle({ label: 'a', aria: '기울기 a (손실함수의 입력)', min: 0, max: 3.5, value: S.a, fmtv: (v) => `a = ${v.toFixed(2)}`, onChange: (v) => set(v), drag: ([px]) => (px - 120) / 270 });
        hd.show(false);
        const stamp = (key, v) => svg('circle', { cx: X(Number(key)), cy: Y(v), r: 5, fill: C.purple, opacity: .85 }, traceG);
        function set(v) {
          S.a = Math.round(v * 100) / 100;
          const key = (Math.round(S.a * 20) / 20).toFixed(2);
          if (!S.trace.has(key)) { S.trace.set(key, L(Number(key))); stamp(key, S.trace.get(key)); }
          draw();
        }
        function draw() {
          const a = S.a, l = L(a), [xe, ye] = lineEnd(a);
          setA(cur, { cx: X(a), cy: Y(l) });
          setA(guideL, { x1: X(a), y1: Y(0), x2: X(a), y2: Y(l) });
          setA(iLine, { x1: ix(0), y1: iy(0), x2: ix(xe), y2: iy(ye) });
          hd.at(X(a), Y(0)); hd.set(a);
          mA.textContent = a.toFixed(2); mL.textContent = fmt(l, 2);
          curve.setAttribute('opacity', S.curve ? .9 : 0);
          coach.check();
        }
        draw();
        const keys = () => [...S.trace.keys()].map(Number);
        coach.start(st, [
          { neutral: true, text: '<p>기울기 a를 바꾸면 손실 L도 바뀌어요.</p><p>a가 0에서 3.5까지 변할 때 L(a)의 그래프는 어떤 모양일까요? <b>먼저 예측!</b></p>',
            choices: ['직선', '아래로 볼록한 곡선', '위로 볼록한 곡선'].map((t) => ({ t, pick: () => { S.pred = t; }, fb: `예측: ${t}. 직접 확인해 봐요!` })) },
          { hint: '손잡이를 왼쪽 끝(0)부터 오른쪽 끝(3.5)까지 천천히 끌어 보세요.', text: '<p>가로축의 <b>a 손잡이</b>를 좌우로 끌어 보세요. a마다 손실 L(a)가 점으로 찍혀요.</p><p>1보다 작은 곳, 3보다 큰 곳까지 <b>점 12개 이상</b>!</p>', enter: () => hd.show(true), target: () => hd.pos(),
            wait: () => keys().length >= 12 && Math.min(...keys()) < 1 && Math.max(...keys()) > 3,
            ok: () => `${S.pred === '아래로 볼록한 곡선' ? '예측대로' : '예측과 달리'} 아래로 볼록한 곡선이 나타났어요!`, after: () => { S.curve = true; draw(); } },
          { text: '<p>손실함수 L(a)에서 바꿔 넣는 <b>변수(입력)</b>는 무엇일까요?</p>', choices: [
            { t: '공부 시간 x', fb: 'x와 y는 이미 주어진 데이터라 고정이에요. 가로축을 보세요.' },
            { t: '기울기 a', ok: true, fb: '맞아요! 데이터는 그대로, a를 넣으면 손실이 하나 나와요. 그래서 a의 함수 L(a)예요.' },
            { t: '점수 y', fb: 'y는 맞혀야 할 실제 점수(데이터)예요.' },
          ] },
          { final: true, text: '<p><b>A3 완료!</b> 손실함수의 입력은 a, 출력은 손실 L(a)예요.</p><p>다음 단계에서 이 곡선이 왜 포물선인지 식으로 확인해요.</p>' },
        ], [330, 92, 420]);
      },
    },

    /* ---------- A4 이차함수로 정리 ---------- */
    {
      key: 'A4', short: '이차함수', title: '펼쳐 보면 a의 이차함수', formula: '(y − ax)² = y² − 2xy·a + x²·a²',
      build(st) {
        const S = { placed: {}, sel: null, coef: {} };
        const sh = h('div', { class: 'sheet' });
        ov.append(sh);
        const TERMS = [{ id: 'c', t: 'y²', why: 'y²에는 a가 없어요.' }, { id: 'l', t: '− 2xy·a', why: '−2xy·a에는 a가 한 번 곱해져 있어요.' }, { id: 'q', t: '+ x²·a²', why: 'x²·a²에는 a가 두 번(a²) 곱해져 있어요.' }];
        const BINS = [{ id: 'q', t: 'a²이 있는 항 (이차항)' }, { id: 'l', t: 'a가 한 번 곱해진 항 (일차항)' }, { id: 'c', t: 'a가 없는 항 (상수항)' }];
        const formula = h('div', { class: 'big' }, '(y − ax)² = y² − 2xy·a + x²·a²');
        const tiles = TERMS.map((tm) => btn(tm.t, () => { if (S.placed[tm.id]) return; S.sel = tm.id; drawTiles(); }, { class: 'tile', 'aria-pressed': 'false' }));
        const tileRow = h('div', { class: 'row' }, ...tiles);
        const bins = BINS.map((b) => {
          const box = h('div', { class: 'placed-box' });
          const put = btn(b.t, () => {
            if (!S.sel) { coach.say('먼저 위의 항을 하나 고르세요.', true); return; }
            const tm = TERMS.find((x) => x.id === S.sel);
            if (tm.id === b.id) { S.placed[tm.id] = true; S.sel = null; coach.say(`좋아요! ${tm.why}`); } else coach.say(`다시 생각해 봐요. ${tm.why}`, true);
            drawTiles(); coach.check();
          });
          return { b, box, el: h('div', { class: 'bin' }, put, box) };
        });
        function drawTiles() {
          tiles.forEach((t, i) => {
            const tm = TERMS[i];
            t.setAttribute('aria-pressed', String(S.sel === tm.id));
            if (S.placed[tm.id] && !t.classList.contains('placed')) { t.classList.add('placed'); t.disabled = true; bins.find((x) => x.b.id === tm.id).box.append(t); }
          });
        }
        // 표와 계수 채우기
        const part2 = h('div', { class: 'two', hidden: true });
        const tbl = h('table', {}, h('thead', {}, h('tr', {}, ...['친구', 'x²', 'xy', 'y²'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, ...P.map((f) => h('tr', {}, ...[f.name, f.x * f.x, f.x * f.y, f.y * f.y].map((v) => h('td', {}, v)))),
            h('tr', { class: 'avg' }, ...['평균', CO.xx, CO.xy, CO.yy].map((v) => h('td', {}, v)))));
        const BL = [
          { id: 'q', name: 'a²의 계수', opts: ['13', '26', '53'], ok: '13', why: 'a²의 계수는 x²의 평균이에요.' },
          { id: 'l', name: 'a의 계수', opts: ['− 26', '− 52', '+ 52'], ok: '− 52', why: 'a의 계수는 −2 × (xy의 평균)이에요.' },
          { id: 'c', name: '상수항', opts: ['13', '26', '53'], ok: '53', why: '상수항은 y²의 평균이에요.' },
        ];
        const blanks = {};
        const asm = h('div', { class: 'big asm' }, 'L(a) = ');
        BL.forEach((b, i) => { blanks[b.id] = h('span', { class: 'blank' }, '?'); asm.append(blanks[b.id], ['a² ', 'a + ', ''][i]); });
        const opts = BL.map((b) => h('div', { class: 'opts' }, h('span', { class: 'lbl' }, b.name), ...b.opts.map((o) => btn(o, () => {
          if (S.coef[b.id]) return;
          if (o === b.ok) { S.coef[b.id] = true; blanks[b.id].textContent = o; blanks[b.id].classList.add('ok'); coach.say(`맞아요. ${b.why}`); } else coach.say(`다시! ${b.why} 표의 평균 줄을 보세요.`, true);
          coach.check();
        }))));
        part2.append(tbl, h('div', {}, h('h4', {}, '평균을 넣어 a에 대해 정리'), h('p', { style: 'margin:4px 0 8px;font-size:15px' }, 'L(a) = (x²의 평균)a² − 2(xy의 평균)a + (y²의 평균)'), asm, ...opts));
        sh.append(h('h4', {}, '한 친구의 오차 제곱 펼치기'), formula, tileRow, h('div', { class: 'bins' }, ...bins.map((x) => x.el)), part2);
        K.paintVars(sh);
        coach.start(st, [
          { text: '<p>왜 손실함수가 포물선일까요?</p><p>한 친구의 오차 제곱을 펼친 식을 <b>a에 대해</b> 정리해 봐요.</p>', target: () => elPos(formula) },
          { hint: 'a²이 들어 있으면 이차항, a가 하나면 일차항, a가 없으면 상수항이에요.', text: '<p>펼친 세 항을 <b>a가 몇 번 곱해졌는지</b>에 따라 칸에 넣으세요.</p><p>항을 누른 다음 칸을 누르면 돼요.</p>', target: () => elPos(tileRow), wait: () => TERMS.every((x) => S.placed[x.id]), ok: '이차항 x²·a², 일차항 −2xy·a, 상수항 y²!' },
          { hint: '표 맨 아래 평균 줄(13, 26, 53)을 쓰세요. a의 계수는 −2 × 26이에요.', text: '<p>다섯 친구의 x², xy, y²를 구해 <b>평균</b>을 냈어요(표).</p><p>평균으로 L(a)의 빈칸을 채워 보세요.</p>', enter: () => { part2.hidden = false; }, target: () => elPos(asm), wait: () => BL.every((x) => S.coef[x.id]), ok: 'L(a) = 13a² − 52a + 53. a에 대한 이차함수예요! 그래서 그래프가 포물선이었어요.' },
          { text: '<p>a²의 계수 13은 <b>x²의 평균</b>이에요. 여기서 알 수 있는 것은?</p>', choices: [
            { t: '제곱의 평균이라 항상 양수 → 언제나 아래로 볼록', ok: true, fb: '맞아요! 데이터가 바뀌어도 a² 계수는 양수라서, 손실함수에는 가장 낮은 점(최솟값)이 꼭 있어요.' },
            { t: '데이터에 따라 위로 볼록할 수도 있다', fb: 'x²은 0 이상이라 평균도 양수예요. 볼록한 방향은 바뀌지 않아요.' },
            { t: 'a² 계수가 손실의 최솟값이다', fb: '최솟값은 꼭짓점에서 정해져요(다음 단계). a² 계수는 볼록한 방향과 폭을 정해요.' },
          ] },
          { final: true, text: '<p><b>A4 완료!</b> 손실함수는 a² 계수가 양수인 이차함수예요.</p><p>다음 단계에서 가장 낮은 점, 꼭짓점을 찾아요.</p>' },
        ], [850, 92, 390]);
      },
    },

    /* ---------- A5 대칭축과 꼭짓점 ---------- */
    {
      key: 'A5', short: '꼭짓점', title: '대칭축과 꼭짓점', formula: 'L(a) = 13a² − 52a + 53',
      build(st) {
        const X = (a) => 120 + a * 235, Y = (v) => 660 - v * 10.5;
        lossAxes(scene, X, Y);
        const S = { t: 1, lines: 0 };
        const g = clipBox(scene, X(0), Y(56), X(4.2) - X(0), Y(0) - Y(56));
        svg('path', { d: pathOf(L, 0, 4.1, X, Y), fill: 'none', stroke: C.purple, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
        const mirror = svg('path', { fill: 'none', stroke: C.coral, 'stroke-width': 5, 'stroke-dasharray': '12 8', 'stroke-linecap': 'round' }, g);
        const axis = svg('line', { stroke: C.blueInk, 'stroke-width': 4, 'stroke-dasharray': '4 6' }, scene);
        const vtx = svg('g', { opacity: 0 }, scene);
        svg('circle', { cx: X(2), cy: Y(1), r: 11, fill: C.mint, stroke: C.ink, 'stroke-width': 2.5 }, vtx);
        tag(vtx, X(2), Y(1) - 52, '꼭짓점 (2, 1)', { size: 20, fill: C.mintSoft, color: C.greenInk });
        svg('line', { x1: X(0), x2: X(.22), y1: 706, y2: 706, stroke: C.coral, 'stroke-width': 5, 'stroke-dasharray': '12 8' }, scene);
        text(scene, X(.27), 712, '세로선 왼쪽을 접어 넘긴 모양', { 'font-size': 17, fill: C.coralInk });
        const hd = handle({ label: '축', aria: '접는 세로선의 위치 a', min: .4, max: 3.6, value: S.t, cls: 'blue', fmtv: (v) => `a = ${v.toFixed(2)}`, onChange: (v) => { S.t = Math.round(v * 100) / 100; draw(); }, drag: ([px]) => (px - 120) / 235, snap: [[2, .03]] });
        const [mT] = meters(['세로선 위치']);
        function draw() {
          const t = S.t, pts = [];
          for (let a = Math.max(0, t - 2.4); a <= t + 1e-9; a += .02) pts.push(`${pts.length ? 'L' : 'M'}${X(2 * t - a).toFixed(1)} ${Y(L(a)).toFixed(1)}`);
          mirror.setAttribute('d', pts.join(' '));
          setA(axis, { x1: X(t), x2: X(t), y1: Y(0), y2: Y(56) });
          hd.at(X(t), Y(0)); hd.set(t);
          mT.textContent = `a = ${t.toFixed(2)}`;
          coach.check();
        }
        draw();
        const LINES = ['L(a) = 13a² − 52a + 53', '= 13(a² − 4a) + 53', '= 13(a² − 4a + 4) − 52 + 53', '= 13(a − 2)² + 1'];
        const ol = h('ol', { class: 'c-lines' });
        coach.start(st, [
          { hint: '빨간 점선이 보라색 곡선에 겹치도록 세로선을 곡선의 가장 낮은 쪽으로 옮겨 보세요.', text: '<p>아래로 볼록한 포물선은 <b>좌우 대칭</b>이에요.</p><p>파란 <b>축</b> 손잡이를 끌어, 왼쪽을 접어 넘긴 <b>빨간 점선</b>이 오른쪽 곡선과 딱 겹치는 곳을 찾으세요.</p>', target: () => hd.pos(), wait: () => S.t === 2, ok: '딱 겹쳐요! 대칭축 a = 2, 그 위의 가장 낮은 점이 꼭짓점 (2, 1)이에요.', after: () => vtx.setAttribute('opacity', 1) },
          { text: '<p>식으로도 확인해 봐요. <b>완전제곱식</b>으로 바꾸면 꼭짓점이 보여요.</p>', body: () => ol,
            action: { label: '한 줄씩 정리', run: () => {
              if (S.lines < LINES.length) { ol.append(h('li', {}, LINES[S.lines])); S.lines++; }
              return S.lines >= LINES.length ? { ok: true, msg: '(a − 2)² ≥ 0이라 a = 2일 때 최솟값 1. 접어서 찾은 곳과 같아요!' } : { ok: false, msg: '' };
            } } },
          { text: '<p>만약 a²의 계수가 −13처럼 <b>음수</b>였다면?</p>', choices: [
            { t: '위로 볼록해서 가장 낮은 점이 없다', ok: true, fb: '맞아요. 그래서 손실은 오차를 제곱해 a² 계수가 양수가 되게 해요. 그래야 가장 작은 손실이 있어요.' },
            { t: '그래도 꼭짓점이 최솟값이다', fb: 'a² 계수가 음수면 포물선이 뒤집혀 위로 볼록해져요.' },
            { t: '직선이 된다', fb: 'a² 항이 남아 있으니 여전히 포물선이에요. 방향만 뒤집혀요.' },
          ] },
          { final: true, text: '<p><b>A 마무리!</b> 오차 → 손실 → 손실함수 → 이차함수 → 꼭짓점 a = 2.</p><p>B에서는 그래프 없이 <b>기울기만으로</b> 꼭짓점을 찾아가요.</p>' },
        ], [330, 92, 400]);
      },
    },

    /* ---------- B1 미분계수 ---------- */
    {
      key: 'B1', short: '미분', title: '기울기 = 순간변화율', formula: '{L(a+h) − L(a)} ÷ h = 26a + 13h − 52',
      build(st) {
        const X = (a) => 120 + a * 235, Y = (v) => 660 - v * 10.5;
        lossAxes(scene, X, Y);
        const S = { a: 1, h: .8 };
        const g = clipBox(scene, X(0), Y(56), X(4.2) - X(0), Y(0) - Y(56));
        svg('path', { d: pathOf(L, 0, 4.2, X, Y), fill: 'none', stroke: C.purple, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
        const tanL = svg('line', { stroke: C.ink, 'stroke-width': 2.5, 'stroke-dasharray': '6 6', opacity: .55 }, g);
        const run = svg('line', { stroke: C.muted, 'stroke-width': 2, 'stroke-dasharray': '4 4' }, g);
        const rise = svg('line', { stroke: C.muted, 'stroke-width': 2, 'stroke-dasharray': '4 4' }, g);
        const sec = svg('line', { stroke: C.coral, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
        const dotP = svg('circle', { r: 9, fill: C.coral, stroke: C.ink, 'stroke-width': 2.5 }, scene), dotQ = svg('circle', { r: 9, fill: C.blue, stroke: C.ink, 'stroke-width': 2.5 }, scene);
        const hLab = text(scene, 0, 0, 'h', { 'font-size': 20, fill: C.ink, 'text-anchor': 'middle', class: 'svg-text halo' });
        const [mSec, mH, mTan] = meters(['할선 기울기', '간격 h', '접선 기울기 L′(a)']);
        const pH = handle({ label: 'P', aria: '점 P의 위치 a', min: .2, max: 3.4, value: S.a, fmtv: (v) => `a = ${v.toFixed(2)}`, onChange: (v) => { S.a = Math.round(v * 100) / 100; draw(); }, drag: ([px]) => (px - 120) / 235 });
        const qH = handle({ label: 'Q', aria: '점 Q까지의 간격 h', min: .01, max: 1.2, value: S.h, cls: 'blue', fmtv: (v) => `h = ${v.toFixed(2)}`, onChange: (v) => { S.h = Math.round(v * 100) / 100; draw(); }, drag: ([px]) => (px - 120) / 235 - S.a });
        pH.show(false); qH.show(false);
        function draw() {
          const a = S.a, hh = S.h, q = a + hh, m = (L(q) - L(a)) / hh, d = dL(a);
          setA(sec, { x1: X(a - 1.2), y1: Y(L(a) - m * 1.2), x2: X(q + 1.2), y2: Y(L(a) + m * (hh + 1.2)) });
          setA(tanL, { x1: X(a - 1.3), y1: Y(L(a) - d * 1.3), x2: X(a + 1.3), y2: Y(L(a) + d * 1.3) });
          setA(run, { x1: X(a), y1: Y(L(a)), x2: X(q), y2: Y(L(a)) });
          setA(rise, { x1: X(q), y1: Y(L(a)), x2: X(q), y2: Y(L(q)) });
          setA(hLab, { x: (X(a) + X(q)) / 2, y: Y(L(a)) + 28, opacity: hh > .15 ? 1 : 0 });
          setA(dotP, { cx: X(a), cy: Y(L(a)) }); setA(dotQ, { cx: X(q), cy: Y(L(q)) });
          pH.at(X(a), Y(L(a))); pH.set(a);
          qH.at(X(q), Y(L(q))); qH.set(hh);
          mSec.textContent = sgn(m, 2); mH.textContent = hh.toFixed(2); mTan.textContent = sgn(d, 2);
          coach.check();
        }
        draw();
        coach.start(st, [
          { text: '<p>곡선 위 두 점 P(a), Q(a + h)를 이은 직선이 <b>할선</b>, 그 기울기가 <b>평균변화율</b>이에요.</p><p>계산하면 26a + 13h − 52가 돼요(위 식).</p>', target: () => [X(S.a), Y(L(S.a))] },
          { hint: 'Q 손잡이를 P에 거의 닿을 때까지 왼쪽으로 끌어요.', text: '<p><b>Q 손잡이</b>를 P 쪽으로 끌어 h를 <b>0.05 이하</b>로 줄여 보세요. 할선은 어떻게 될까요?</p>', enter: () => qH.show(true), target: () => qH.pos(), wait: () => S.h <= .05, ok: 'h → 0이면 13h → 0. 할선이 접선(점선)과 겹치고, 기울기는 L′(a) = 26a − 52예요.', after: () => qH.show(false) },
          { hint: 'P 손잡이를 곡선의 가장 낮은 곳보다 오른쪽으로 옮겨요.', text: '<p>이번엔 <b>P 손잡이</b>로 점을 a = 2보다 <b>오른쪽</b>으로 옮겨 보세요. 접선의 기울기 부호는 어떻게 될까요?</p>', enter: () => pH.show(true), target: () => pH.pos(), wait: () => S.a > 2.2, ok: 'a > 2에서는 L′(a) > 0(오르막), a < 2에서는 L′(a) < 0(내리막)이에요.' },
          { text: '<p>L′(a) = 26a − 52 = <b>0</b>인 곳은 어디이고, 무엇을 뜻할까요?</p>', choices: [
            { t: 'a = 2, 접선이 수평인 꼭짓점(손실 최소)', ok: true, fb: '맞아요! 기울기가 0인 곳이 꼭짓점이에요. 경사하강법은 기울기가 0인 곳을 향해 걸어가요.' },
            { t: 'a = 0, 그래프가 시작하는 곳', fb: 'L′(0) = −52로 아주 가파르게 내려가는 중이에요.' },
            { t: 'a = 26, 기울기가 가장 큰 곳', fb: '26a − 52 = 0을 풀어 보세요. 26a = 52예요.' },
          ] },
          { final: true, text: '<p><b>B1 완료!</b> 발밑의 기울기 L′(a) = 26a − 52만 알면 오르막인지 내리막인지 알 수 있어요.</p>' },
        ], [330, 92, 400]);
      },
    },

    /* ---------- B2 방향 ---------- */
    {
      key: 'B2', short: '방향', title: '안개 속에서 방향 정하기', formula: 'L′(a) = 26a − 52',
      build(st) {
        const Wk = walker(scene);
        const S = { a: 1, busy: false, hop: 0, walk: false, right: false, left: false };
        const bl = fbtn('◀', () => walk(-1), { class: 'round', 'aria-label': '왼쪽으로 0.1 걷기' });
        const br = fbtn('▶', () => walk(1), { class: 'round', 'aria-label': '오른쪽으로 0.1 걷기' });
        function draw() {
          Wk.draw({ a: S.a, hop: S.hop, busy: S.busy });
          const [bx, by] = Wk.ballXY(S.a), on = S.walk && !S.busy && Wk.inPlot(S.a);
          place(bl, bx - 66, by); place(br, bx + 66, by);
          bl.hidden = br.hidden = !on;
          coach.check();
        }
        function walk(dir) {
          if (S.busy) return;
          const a0 = S.a, L0 = L(a0), d0 = dL(a0), a1 = Math.round((a0 + dir * .1) * 1e6) / 1e6;
          S.busy = true;
          animate(380, (t) => { S.a = a0 + (a1 - a0) * t; S.hop = Math.sin(Math.PI * t) * 30; draw(); }, () => {
            S.busy = false; S.hop = 0; S.a = a1; Wk.dot(a1);
            const down = L(a1) < L0;
            if (down && dir > 0 && d0 < 0) S.right = true;
            if (down && dir < 0 && d0 > 0) S.left = true;
            draw();
            if (!coach.isReady()) coach.say(`기울기 ${sgn(d0, 1)}에서 ${dir > 0 ? '오른쪽' : '왼쪽'}으로 → 손실 ${fmt(L0, 2)} → ${fmt(L(a1), 2)} ${down ? '↓ 내려갔어요' : '↑ 올라갔어요'}`, !down);
          });
        }
        Wk.dot(S.a);
        draw();
        coach.start(st, [
          { text: '<p>실제 AI는 a 같은 값이 수백만 개라 손실함수의 그래프를 그릴 수 없어요.</p><p>아는 것은 지금 서 있는 곳의 <b>기울기 L′(a)</b>뿐! (안개)</p>', target: () => Wk.ballXY(S.a) },
          { hint: '◀와 ▶를 하나씩 눌러 보고, 손실이 줄어드는(↓) 쪽을 찾아보세요.', text: '<p>지금 기울기는 <b>−26</b>이에요. 공 옆의 ◀ ▶로 걸어서 <b>손실이 줄어드는 쪽</b>을 찾아보세요.</p>', enter: () => { S.walk = true; draw(); }, target: () => Wk.ballXY(S.a), wait: () => S.right, ok: '기울기가 음수(−)면 오른쪽(+)으로 가야 내려가요.' },
          { hint: '◀와 ▶ 중 손실이 줄어드는(↓) 쪽을 찾아보세요.', text: '<p>이번엔 <b>a = 3</b>에서 출발! 기울기는 <b>+26</b>이에요. 어느 쪽으로 가야 내려갈까요?</p>', enter: () => { S.a = 3; Wk.clearTrail(); Wk.dot(3); draw(); }, target: () => Wk.ballXY(S.a), wait: () => S.left, ok: '기울기가 양수(+)면 왼쪽(−)으로 가야 내려가요.' },
          { text: '<p>기울기 L′(a)만 알 때, 손실을 줄이려면 a를 어느 쪽으로 움직여야 할까요?</p>', enter: () => { S.walk = false; draw(); }, choices: [
            { t: '기울기의 부호와 반대 방향 (−L′(a) 쪽)', ok: true, fb: '맞아요! 기울기가 −면 +쪽, +면 −쪽. 그래서 움직임에 −L′(a)가 들어가요.' },
            { t: '기울기와 같은 방향', fb: '기울기 방향으로 가면 오르막을 올라가요.' },
            { t: '항상 오른쪽', fb: 'a = 3에서 오른쪽으로 가면 손실이 커졌어요.' },
          ] },
          { final: true, text: '<p><b>B2 완료!</b> 방향은 기울기의 반대, 즉 <b>−L′(a)</b> 쪽이에요.</p><p>다음 단계에서는 <b>얼마나</b> 움직일지 정해요.</p>' },
        ], [290, 92, 400]);
      },
    },

    /* ---------- B3 경사하강법 식 ---------- */
    {
      key: 'B3', short: '한 걸음', title: '기울기에 비례해 걷기', formula: 'a ← a − α · L′(a)  (α = 0.02)',
      build(st) {
        const Wk = walker(scene), ALPHA = .02;
        const S = { a: 1, busy: false, hop: 0, fog: true, stepOn: false, log: [] };
        const stepB = fbtn('한 걸음 ▶', () => stepOnce(), { class: 'primary' });
        const tbody = h('tbody');
        const logBox = h('div', { class: 'logbox' }, h('h4', {}, '걸음 기록 (최근 5걸음)'),
          h('table', { class: 'log' }, h('thead', {}, h('tr', {}, ...['걸음', 'a', 'L′(a)', 'α·L′(a)', '새 a'].map((t) => h('th', { scope: 'col' }, t)))), tbody));
        place(logBox, 900, 352); ov.append(logBox);
        function draw() {
          Wk.draw({ a: S.a, fog: S.fog, hop: S.hop, busy: S.busy, preview: S.stepOn ? M.step(P, S.a, ALPHA) : null });
          const [bx, by] = Wk.ballXY(S.a);
          place(stepB, bx + 34, by + 8);
          stepB.hidden = !S.stepOn || S.busy;
          tbody.replaceChildren(...S.log.slice(-5).map((r) => h('tr', {}, ...[r.k, fmt(r.a0, 3), sgn(r.d, 2), sgn(ALPHA * r.d, 3), fmt(r.a1, 3)].map((v) => h('td', {}, v)))));
          coach.check();
        }
        function stepOnce() {
          if (S.busy) return;
          const a0 = S.a, d = dL(a0), a1 = M.step(P, a0, ALPHA);
          S.log.push({ k: S.log.length + 1, a0, d, a1 });
          S.busy = true;
          animate(420, (t) => { S.a = a0 + (a1 - a0) * t; S.hop = Math.sin(Math.PI * t) * 40; draw(); }, () => { S.busy = false; S.hop = 0; S.a = a1; Wk.dot(a1); draw(); });
        }
        Wk.dot(S.a);
        draw();
        coach.start(st, [
          { text: '<p>꼭짓점에서 멀면 기울기가 가팔라서 <b>성큼</b>, 가까우면 <b>조금</b>! 기울기에 <b>비례</b>해 걸어요.</p><p>비례상수 α를 <b>학습률</b>이라고 해요(여기선 0.02).</p>', target: () => Wk.ballXY(S.a) },
          { text: '<p>a = 1, L′(1) = −26, α = 0.02일 때 한 걸음 뒤 a는?</p>', choices: [
            { t: '1 − 0.02 × (−26) = 1.52', ok: true, fb: '맞아요! 기울기가 음수라 −α·L′(a)는 양수, 오른쪽으로 0.52만큼 가요.' },
            { t: '1 − 0.02 × 26 = 0.48', fb: 'L′(1)은 −26이에요. 부호까지 넣어 계산해 보세요.' },
            { t: '1 − 26 = −25', fb: '학습률 α = 0.02를 곱해서 걸음을 작게 해요.' },
          ] },
          { hint: '‘한 걸음 ▶’을 여러 번 눌러요. 7걸음쯤이면 도착해요.', text: '<p>공 옆의 <b>한 걸음 ▶</b>을 계속 눌러 꼭짓점 <b>0.01 이내</b>까지 가 보세요.</p><p>오른쪽 표에서 걸음 크기 α·L′(a)를 지켜봐요.</p>', enter: () => { S.stepOn = true; draw(); }, target: () => (stepB.hidden ? null : elPos(stepB)), wait: () => Math.abs(S.a - 2) < .01 && !S.busy, ok: () => `${S.log.length}걸음 만에 꼭짓점 근처! 걸음 크기가 점점 작아졌어요.` },
          { text: '<p>안개를 걷어 볼게요. α는 그대로인데 걸음이 점점 작아진 까닭은?</p>', enter: () => { S.fog = false; S.stepOn = false; draw(); }, choices: [
            { t: '꼭짓점에 가까울수록 기울기 L′(a)가 0에 가까워져서', ok: true, fb: '맞아요. 걸음 = α × L′(a)라서 기울기가 작아지면 걸음도 저절로 작아져요. 그래서 꼭짓점을 지나치지 않아요.' },
            { t: 'α가 조금씩 작아져서', fb: 'α는 0.02 그대로예요. 표의 L′(a) 칸을 보세요.' },
            { t: '안개가 걷혀서', fb: '안개는 보이는 것만 바꿔요. 걸음은 식으로 정해져요.' },
          ] },
          { final: true, text: '<p><b>B3 완료!</b> 경사하강법: <span class="f">a ← a − α·L′(a)</span></p><p>다음 단계에서 왜 꼭 꼭짓점으로 가는지 식으로 확인해요.</p>' },
        ], [290, 92, 400]);
      },
    },

    /* ---------- B4 수렴 유도 ---------- */
    {
      key: 'B4', short: '수렴', title: '왜 꼭짓점으로 다가갈까?', formula: '꼭짓점까지 남은 거리 a − 2',
      build(st) {
        const S = { factor: false, ratio: false };
        const sh = h('div', { class: 'sheet' });
        ov.append(sh);
        const BL = {
          factor: { opts: ['a − 2', 'a − 26', '2a − 1'], ok: 'a − 2', why: '26a − 52에서 26을 묶으면 26(a − 2)예요.' },
          ratio: { opts: ['1 − 26α', '26α', '1 + 26α'], ok: '1 − 26α', why: '(a − 2)를 공통인수로 묶으면 (a − 2)(1 − 26α)예요.' },
        };
        const blank = (id) => {
          const b = BL[id], span = h('span', { class: 'blank' }, '?');
          const opts = h('div', { class: 'opts' }, ...b.opts.map((o) => btn(o, () => {
            if (S[id]) return;
            if (o === b.ok) { S[id] = true; span.textContent = o; K.paintVars(span); span.classList.add('ok'); coach.say(`맞아요. ${b.why}`); refresh(); } else coach.say(`다시! ${b.why}`, true);
            coach.check();
          })));
          return { span, opts };
        };
        const f = blank('factor'), r = blank('ratio');
        const li = [
          h('li', { html: 'a<sub>new</sub> = a − α · L′(a)' }),
          h('li', {}, 'L′(a) = 26a − 52 = 26 × ( ', f.span, ' )', f.opts),
          h('li', { html: 'a<sub>new</sub> = a − 26α(a − 2)' }),
          h('li', { html: 'a<sub>new</sub> − 2 = (a − 2) − 26α(a − 2) = ( ' }, r.span, ' ) × (a − 2)', r.opts),
          h('li', { html: '→ 남은 거리는 한 걸음마다 <b>(1 − 26α)배</b>' }),
        ];
        const dist = h('div', { class: 'dist', hidden: true }, h('h4', {}, 'α = 0.02일 때 남은 거리 |a − 2| (a = 1에서 출발)'),
          ...[0, 1, 2, 3, 4].map((n) => { const d = .48 ** n; return h('div', {}, h('span', {}, `${n}걸음`), h('i', { style: `width:${(d * 100).toFixed(1)}%` }), h('span', {}, `${fmt(d, 3)}${n ? '  (× 0.48)' : ''}`)); }));
        function refresh() {
          li[2].classList.toggle('dim', !S.factor);
          li[3].classList.toggle('dim', !S.factor);
          li[4].classList.toggle('dim', !S.ratio);
        }
        sh.append(h('h4', {}, '경사하강법 식을 꼭짓점까지 남은 거리로 바꿔 쓰기'), h('ol', { class: 'derive' }, ...li), dist);
        K.paintVars(sh);
        refresh();
        coach.start(st, [
          { text: '<p>경사하강법이 왜 꼭짓점으로 다가가는지 <b>식</b>으로 확인해 봐요.</p><p>꼭짓점 2까지 남은 거리 <b>(a − 2)</b>가 한 걸음 뒤 어떻게 될까요?</p>', target: () => elPos(li[0]) },
          { hint: '26a와 52를 각각 26으로 나눠 보세요.', text: '<p>② <b>26a − 52</b>를 26으로 묶으면 괄호 안은?</p>', target: () => elPos(f.span), wait: () => S.factor, ok: '26(a − 2)! 기울기는 꼭짓점까지 거리에 비례해요.' },
          { hint: '(a − 2)를 1 × (a − 2)로 생각하고 묶어 보세요.', text: '<p>④ 양변에서 2를 빼고 <b>(a − 2)</b>로 묶으면, 남은 거리에 곱해지는 수는?</p>', target: () => elPos(r.span), wait: () => S.ratio, ok: '새 거리 = (1 − 26α) × 원래 거리!' },
          { text: '<p>α = 0.02이면 남은 거리는 한 걸음마다 몇 배가 될까요?</p>', choices: [
            { t: '0.48배', ok: true, fb: '맞아요! 1 − 26 × 0.02 = 0.48. 매번 절반쯤으로 줄어서 꼭짓점에 계속 다가가요.' },
            { t: '0.52배', fb: '0.52 = 26 × 0.02는 빼는 양이에요. 1에서 빼 보세요.' },
            { t: '0.02배', fb: '0.02는 학습률 α예요. 곱해지는 수는 1 − 26α예요.' },
          ], after: () => { dist.hidden = false; } },
          { final: true, text: '<p><b>B4 완료!</b> 왼쪽 막대처럼 남은 거리가 매번 0.48배로 줄어요.</p><p>마지막으로 학습률을 바꿔 실험해 봐요.</p>' },
        ], [850, 92, 390]);
      },
    },

    /* ---------- B5 학습률 ---------- */
    {
      key: 'B5', short: '학습률', title: '학습률 α 실험', formula: 'r = 1 − 26α',
      build(st) {
        const X = (a) => 120 + a * 185, Y = (v) => 660 - v * 10.5;
        lossAxes(scene, X, Y);
        const S = { r: .48, seenZig: false, seenDiv: false, placed: {}, sel: null };
        const alphaOf = (r) => (1 - r) / 26;
        const g = clipBox(scene, X(0), Y(56), X(4.2) - X(0), Y(0) - Y(56));
        svg('path', { d: pathOf(L, 0, 4.2, X, Y), fill: 'none', stroke: C.purple, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
        const trail = svg('g', {}, g);
        const outTag = tag(scene, 500, 560, '그래프 밖으로 멀어져요 → 발산!', { size: 18, fill: C.coralSoft, color: C.coralInk });
        // 오른쪽: r 수직선
        svg('rect', { x: 900, y: 92, width: 350, height: 260, rx: 18, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, scene);
        const aTxt = text(scene, 918, 126, '', { 'font-size': 20, fill: C.ink });
        const RX = (r) => 930 + (r + 1.6) * 104;
        svg('rect', { x: RX(-1), y: 226, width: RX(1) - RX(-1), height: 30, fill: C.mintSoft, stroke: C.greenInk, 'stroke-width': 1.5 }, scene);
        svg('rect', { x: RX(-1.6), y: 226, width: RX(-1) - RX(-1.6), height: 30, fill: C.coralSoft, stroke: C.coralInk, 'stroke-width': 1.5 }, scene);
        text(scene, (RX(-1) + RX(1)) / 2, 214, '다가감 |r| < 1', { 'font-size': 15, fill: C.greenInk, 'text-anchor': 'middle' });
        text(scene, (RX(-1.6) + RX(-1)) / 2, 214, '발산', { 'font-size': 15, fill: C.coralInk, 'text-anchor': 'middle' });
        [-1, 0, 1].forEach((v) => { svg('line', { x1: RX(v), x2: RX(v), y1: 256, y2: 266, stroke: C.ink, 'stroke-width': 2 }, scene); text(scene, RX(v), 288, String(v), { 'font-size': 16, fill: C.ink, 'text-anchor': 'middle' }); });
        const kind = text(scene, 1075, 334, '', { 'font-size': 19, 'text-anchor': 'middle' });
        const kindOf = (r) => (Math.abs(r) < .03 ? '한 번에 도착!' : r > 0 ? '한쪽에서 다가감' : r > -1 ? '지그재그로 다가감' : '점점 멀어짐 (발산)');
        const hd = handle({ label: 'r', aria: '비율 r (학습률 α가 함께 바뀜)', min: -1.34, max: .87, value: S.r, fmtv: (v) => `r = ${v.toFixed(2)}, α = ${alphaOf(v).toFixed(4)}`, onChange: (v) => { S.r = Math.round(v * 100) / 100; draw(); }, drag: ([px]) => (px - 930) / 104 - 1.6, snap: [[0, .04]] });
        function draw() {
          const r = S.r, al = alphaOf(r);
          if (r < 0 && r > -1) S.seenZig = true;
          if (r < -1) S.seenDiv = true;
          trail.replaceChildren();
          let a = 1, out = false, last = null;
          for (let n = 0; n <= 6; n++) {
            if (!(a > -.3 && a < 4.3 && L(a) < 60)) { out = true; break; }
            const nxt = M.step(P, a, al);
            if (n < 6 && nxt > -.3 && nxt < 4.3 && L(nxt) < 60) svg('line', { x1: X(a), y1: Y(L(a)), x2: X(nxt), y2: Y(L(nxt)), stroke: C.gold, 'stroke-width': 3 }, trail);
            svg('circle', { cx: X(a), cy: Y(L(a)), r: n ? 7 : 9, fill: n ? '#fff' : C.gold, stroke: C.ink, 'stroke-width': 2 }, trail);
            if (!last || Math.hypot(X(a) - last[0], Y(L(a)) - last[1]) > 26) { text(trail, X(a), Y(L(a)) - 15, String(n), { 'font-size': 15, fill: C.ink, 'text-anchor': 'middle', class: 'svg-text halo' }); last = [X(a), Y(L(a))]; }
            a = nxt;
          }
          outTag.g.setAttribute('opacity', out || Math.abs(a - 2) > 2.2 ? 1 : 0);
          aTxt.textContent = `α = ${al.toFixed(4)}   r = ${fmt(r, 2)}`;
          hd.at(RX(r), 241); hd.set(r);
          kind.textContent = kindOf(r);
          kind.setAttribute('fill', r <= -1 ? C.coralInk : C.greenInk);
          coach.check();
        }
        draw();
        // 분류 카드(말풍선 안)
        const CARDS = [.01, .03, .05, .07, .09];
        const BINS = [{ id: 'one', t: '한쪽에서' }, { id: 'zig', t: '지그재그' }, { id: 'div', t: '발산' }];
        const right = (al) => { const r = 1 - 26 * al; return r > 0 ? 'one' : r > -1 ? 'zig' : 'div'; };
        const sortBody = () => {
          const cards = CARDS.map((al) => btn(`α = ${al}`, () => { if (S.placed[al]) return; S.sel = al; S.r = Math.round((1 - 26 * al) * 100) / 100; draw(); paint(); }, { class: 'tile', 'aria-pressed': 'false' }));
          const bins = BINS.map((b) => {
            const box = h('div', { class: 'placed-box' });
            const put = btn(b.t, () => {
              if (S.sel === null) { coach.say('먼저 학습률 카드를 하나 누르세요.', true); return; }
              if (right(S.sel) === b.id) { S.placed[S.sel] = b.id; coach.say(`α = ${S.sel}: r = ${fmt(1 - 26 * S.sel, 2)} → ${b.t}`); S.sel = null; } else coach.say(`다시! α = ${S.sel}이면 r = ${fmt(1 - 26 * S.sel, 2)}. 그래프의 걸음을 보세요.`, true);
              paint(); coach.check();
            });
            return { b, box, el: h('div', { class: 'bin' }, put, box) };
          });
          function paint() {
            cards.forEach((c, i) => {
              const al = CARDS[i];
              c.setAttribute('aria-pressed', String(S.sel === al));
              if (S.placed[al] && !c.classList.contains('placed')) { c.classList.add('placed'); c.disabled = true; bins.find((x) => x.b.id === S.placed[al]).box.append(c); }
            });
          }
          return h('div', {}, h('div', { class: 'c-cards' }, ...cards), h('div', { class: 'c-bins' }, ...bins.map((x) => x.el)));
        };
        coach.start(st, [
          { hint: 'r 손잡이를 왼쪽 끝(빨간 칸)까지 끌어 보세요.', text: '<p>남은 거리는 한 걸음마다 <span class="f">r = 1 − 26α</span>배예요.</p><p>오른쪽 <b>r 손잡이</b>를 끌면 α가 바뀌고, a = 1에서 출발한 여섯 걸음이 그려져요. <b>r &lt; 0</b>과 <b>r &lt; −1</b>까지 가 보세요!</p>', target: () => hd.pos(), wait: () => S.seenZig && S.seenDiv, ok: 'r < 0이면 꼭짓점을 넘나들며 지그재그, r < −1이면 점점 멀어져요(발산)!' },
          { hint: '카드를 누르면 그래프에 걸음이 그려져요. 한쪽에서 오는지, 넘나드는지, 멀어지는지 보세요.', text: '<p>학습률 카드를 누르면 그 α로 걸어 봐요. 확인한 뒤 알맞은 칸에 넣으세요.</p>', body: sortBody, wait: () => CARDS.every((x) => S.placed[x]), ok: 'r > 0 한쪽에서, −1 < r < 0 지그재그로 다가가고, r < −1이면 발산!' },
          { hint: 'r = 1 − 26α = 0이 되도록 r 손잡이를 0에 맞춰 보세요.', text: '<p><b>도전!</b> r 손잡이로 한 걸음 만에 꼭짓점에 닿는 α를 찾아보세요.</p>', target: () => hd.pos(), wait: () => Math.abs(S.r) < .03, ok: () => `r ≈ 0 → α = 1/26 ≈ 0.0385! (지금 α = ${alphaOf(S.r).toFixed(4)})` },
          { text: '<p>꼭짓점으로 다가가려면(|1 − 26α| &lt; 1) 학습률 α는 어느 범위여야 할까요?</p>', choices: [
            { t: '0 < α < 1/13 (약 0.077)', ok: true, fb: '맞아요! −1 < 1 − 26α < 1을 풀면 0 < α < 1/13. 너무 크면 지나쳐서 발산해요.' },
            { t: '0 < α < 1/26', fb: '1/26은 한 걸음 만에 도착하는 값이에요. 그보다 커도 지그재그로 다가가요.' },
            { t: 'α가 클수록 항상 빨리 도착한다', fb: 'α = 0.09처럼 크면 r < −1이 되어 멀어져요.' },
          ] },
          { final: true, extra: { label: '추가 활동: 절편 b까지 →', href: 'plus.html' }, text: '<p><b>모든 단계 완료!</b></p><p>① 오차를 제곱해 평균 낸 손실은 a의 이차함수 ② 꼭짓점이 최솟값 ③ 그래프를 몰라도 기울기 반대 방향으로 학습률만큼: <b>경사하강법</b></p>' },
        ], [290, 92, 420]);
      },
    },
  ];

  /* ================= 추가 활동: 기울기 a와 절편 b ŷ = ax + b ================= */
  // L(a, b) = 평균((y − ax − b)²) = 13a² + 6.8ab + b² − 52a − 14b + 53 → a, b의 이차식(그릇 모양 곡면)
  const L2 = (a, b) => M.mean(P.map((f) => (f.y - a * f.x - b) ** 2));
  const gA = (a, b) => M.mean(P.map((f) => -2 * f.x * (f.y - a * f.x - b)));
  const gB = (a, b) => M.mean(P.map((f) => -2 * (f.y - a * f.x - b)));
  const XM = M.mean(P.map((f) => f.x)), YM = M.mean(P.map((f) => f.y));
  const AS = M.mean(P.map((f) => (f.x - XM) * (f.y - YM))) / M.mean(P.map((f) => (f.x - XM) ** 2)), BS = YM - AS * XM;
  const LMIN = L2(AS, BS);

  /* 왼쪽 3D 그릇(철사 그물) + 오른쪽 등고선 지도 + 아래 돌리기 손잡이 */
  function bowl(s) {
    const CX3 = 330, CY3 = 470, TOP = 40;
    let th = -.6;
    const proj = (a, b, l) => {
      const u = (a - 1.5) / 1.5, v = (b - 2) / 4, c = Math.cos(th), sn = Math.sin(th);
      return [CX3 + (u * c - v * sn) * 200, CY3 + (u * sn + v * c) * 100 - Math.min(l, TOP) / TOP * 290];
    };
    const g3 = svg('g', {}, s);
    const floor = svg('path', { fill: '#f3ecdf', stroke: '#d9cfbf', 'stroke-width': 2 }, g3);
    const wire = svg('g', {}, g3);
    const slice3 = svg('path', { fill: 'none', stroke: C.coral, 'stroke-width': 5, 'stroke-linecap': 'round' }, g3);
    const path3 = svg('polyline', { fill: 'none', stroke: C.greenInk, 'stroke-width': 3 }, g3);
    const drop = svg('line', { stroke: C.ink, 'stroke-width': 2, 'stroke-dasharray': '4 4' }, g3);
    const shadow = svg('ellipse', { rx: 9, ry: 4, fill: C.ink, opacity: .3 }, g3);
    const dot3 = svg('circle', { r: 10, fill: C.gold, stroke: C.ink, 'stroke-width': 2.5 }, g3);
    text(s, 60, 120, '손실 곡면 L(a, b)', { 'font-size': 20, fill: C.ink });
    svg('line', { x1: 80, x2: 580, y1: 690, y2: 690, stroke: C.line || '#e7dfd2', 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
    text(s, 40, 696, '돌리기', { 'font-size': 15, fill: C.muted });
    function drawWire() {
      const f = [[0, -2], [3, -2], [3, 6], [0, 6]].map(([a, b]) => proj(a, b, 0));
      floor.setAttribute('d', `M${f.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')} Z`);
      wire.replaceChildren();
      const line = (pts) => {
        let d = '', pen = false;
        pts.forEach(([a, b]) => { const l = L2(a, b); if (l > TOP) { pen = false; return; } const [x, y] = proj(a, b, l); d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; pen = true; });
        if (d) svg('path', { d, fill: 'none', stroke: C.purple, 'stroke-width': 1.6, opacity: .75 }, wire);
      };
      for (let i = 0; i <= 12; i++) {
        const a = i * .25, b = -2 + i * (8 / 12);
        line(Array.from({ length: 49 }, (_, j) => [a, -2 + j / 6]));
        line(Array.from({ length: 49 }, (_, j) => [j / 16, b]));
      }
      let d = '', pen = false;
      for (let a = 0; a <= 3.0001; a += .03) { const l = L2(a, 0); if (l > TOP) { pen = false; continue; } const [x, y] = proj(a, 0, l); d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; pen = true; }
      slice3.setAttribute('d', d);
    }
    // 등고선 지도: a 0~3, b −2~6
    const MX = (a) => 700 + a * 120, MY = (b) => 650 - (b + 2) * 28;
    svg('rect', { x: MX(0), y: MY(6), width: MX(3) - MX(0), height: MY(-2) - MY(6), fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, s);
    [0, 1, 2, 3].forEach((a) => text(s, MX(a), MY(-2) + 24, String(a), { 'font-size': 17, fill: C.ink, 'text-anchor': 'middle' }));
    [-2, 0, 2, 4, 6].forEach((b) => text(s, MX(0) - 8, MY(b) + 6, String(b), { 'font-size': 17, fill: C.ink, 'text-anchor': 'end' }));
    text(s, MX(3), MY(-2) + 46, '기울기 a', { 'font-size': 17, fill: C.coralInk, 'text-anchor': 'end' });
    text(s, MX(0) - 8, MY(6) - 8, 'b', { 'font-size': 17, fill: C.coralInk, 'text-anchor': 'end' });
    text(s, MX(0), MY(-2) + 46, '위에서 내려다본 등고선 지도', { 'font-size': 15, fill: C.muted });
    const gm = clipBox(s, MX(0), MY(6), MX(3) - MX(0), MY(-2) - MY(6));
    [.8, 1.5, 3, 6, 12, 24, 48].forEach((lv, i) => {
      const k = lv - LMIN, pts = [];
      for (let t = 0; t <= Math.PI * 2 + 1e-9; t += Math.PI / 90) {
        const c = Math.cos(t), sn = Math.sin(t), r = Math.sqrt(k / (13 * c * c + 6.8 * c * sn + sn * sn));
        pts.push(`${MX(AS + r * c).toFixed(1)},${MY(BS + r * sn).toFixed(1)}`);
      }
      svg('polygon', { points: pts.join(' '), fill: i === 0 ? '#ece2fb' : 'none', stroke: C.purple, 'stroke-width': 1.8, opacity: .85 }, gm);
    });
    const sliceM = svg('line', { x1: MX(0), x2: MX(3), y1: MY(0), y2: MY(0), stroke: C.coral, 'stroke-width': 3, 'stroke-dasharray': '8 6' }, gm);
    const path2 = svg('polyline', { fill: 'none', stroke: C.greenInk, 'stroke-width': 3 }, gm);
    const arrow = svg('g', {}, gm);
    const arrL = svg('line', { stroke: C.greenInk, 'stroke-width': 4, 'stroke-linecap': 'round' }, arrow);
    const arrH = svg('path', { d: 'M0 -9 L15 0 L0 9 Z', fill: C.mint, stroke: C.ink, 'stroke-width': 1.5 }, arrow);
    const minM = svg('g', { opacity: 0 }, s);
    svg('circle', { cx: MX(AS), cy: MY(BS), r: 8, fill: C.mint, stroke: C.ink, 'stroke-width': 2 }, minM);
    tag(minM, MX(AS) + 70, MY(BS) - 26, '가장 낮은 곳', { size: 15, fill: C.mintSoft, color: C.greenInk });
    const rot = handle({ label: '↻', aria: '그릇 돌리기 각도', min: -3.1, max: 3.1, value: th, step: .05, big: .3, fmtv: (v) => `${Math.round(v * 180 / Math.PI)}도`, onChange: (v) => { th = v; drawWire(); api.redraw(); }, drag: ([px]) => (px - 330) / 250 * Math.PI });
    const api = {
      MX, MY, rot,
      theta: () => th,
      redraw: () => {},
      draw({ a, b, path = [], next = null, showMin = false, sliceHi = false }) {
        rot.at(330 + th / Math.PI * 250, 690); rot.set(th);
        const l = L2(a, b), [x, y] = proj(a, b, l), [fx, fy] = proj(a, b, 0);
        setA(dot3, { cx: x, cy: y, opacity: l <= TOP ? 1 : 0 });
        setA(drop, { x1: x, y1: y, x2: fx, y2: fy, opacity: l <= TOP ? 1 : 0 });
        setA(shadow, { cx: fx, cy: fy });
        path3.setAttribute('points', path.filter(([pa, pb]) => L2(pa, pb) <= TOP).map(([pa, pb]) => proj(pa, pb, L2(pa, pb)).map((v) => v.toFixed(1)).join(',')).join(' '));
        path2.setAttribute('points', path.map(([pa, pb]) => `${MX(pa).toFixed(1)},${MY(pb).toFixed(1)}`).join(' '));
        arrow.setAttribute('opacity', next ? 1 : 0);
        if (next) {
          const x1 = MX(a), y1 = MY(b), x2 = MX(next[0]), y2 = MY(next[1]), d = Math.hypot(x2 - x1, y2 - y1) || 1;
          setA(arrL, { x1, y1, x2: x2 - (x2 - x1) / d * 12, y2: y2 - (y2 - y1) / d * 12, opacity: d > 16 ? 1 : 0 });
          arrH.setAttribute('transform', `translate(${(x2 - (x2 - x1) / d * 14).toFixed(1)} ${(y2 - (y2 - y1) / d * 14).toFixed(1)}) rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI).toFixed(1)})`);
          arrH.setAttribute('opacity', d > 16 ? 1 : 0);
        }
        minM.setAttribute('opacity', showMin ? 1 : 0);
        slice3.setAttribute('stroke-width', sliceHi ? 7 : 4);
        slice3.setAttribute('opacity', sliceHi ? 1 : .55);
        sliceM.setAttribute('opacity', sliceHi ? 1 : .45);
      },
    };
    drawWire();
    return api;
  }

  const PLUS = [
    /* ---------- C1 절편 b ---------- */
    {
      key: 'C1', short: '절편 b', title: '절편 b까지 바꾼다면?', formula: 'ŷ = ax + b',
      build(st) {
        const X = (x) => 120 + x * 150, Y = (y) => 660 - y * 46;
        const sc = scatter(scene, X, Y);
        sc.line.setAttribute('opacity', 0);
        const S = { a: 1, b: 0 };
        const line = svg('line', { stroke: C.coral, 'stroke-width': 6, 'stroke-linecap': 'round' }, clipBox(sc.under, X(0), Y(12.8), X(6.4) - X(0), Y(0) - Y(12.8)));
        const OFF = [-10, 10, -10, 10, 10];
        const segs = P.map((f) => svg('line', { stroke: f.col, 'stroke-width': 5, 'stroke-linecap': 'round' }, sc.over));
        const [mA, mB, mL] = meters(['기울기 a', '절편 b', '손실 L(a, b)']);
        const hB = handle({ label: 'b', aria: '절편 b (직선이 y축과 만나는 높이)', min: -2, max: 8, value: S.b, cls: 'blue', fmtv: (v) => `b = ${v.toFixed(2)}`, onChange: (v) => { S.b = Math.round(v * 100) / 100; draw(); }, drag: ([, py]) => (660 - py) / 46 });
        const hA = handle({ label: 'a', aria: '기울기 a', min: -1, max: 3.5, value: S.a, fmtv: (v) => `a = ${v.toFixed(2)}`, onChange: (v) => { S.a = Math.round(v * 100) / 100; draw(); },
          drag: ([px, py]) => { const xv = (px - 120) / 150, yv = (660 - py) / 46; return xv > .4 ? (yv - S.b) / xv : null; } });
        function draw() {
          const { a, b } = S, yAt = (x) => a * x + b;
          setA(line, { x1: X(0), y1: Y(yAt(0)), x2: X(6.4), y2: Y(yAt(6.4)) });
          hB.at(X(0), Y(clamp(b, -.2, 12.6))); hB.set(b);
          const xe = clamp((12.2 - b) / (a || 1e-9), 1, 5.9), xh = a > 0 ? Math.min(5.9, xe) : 5.9;
          hA.at(X(xh), Y(clamp(yAt(xh), .2, 12.6))); hA.set(a);
          P.forEach((f, i) => setA(segs[i], { x1: X(f.x) + OFF[i], y1: Y(f.y), x2: X(f.x) + OFF[i], y2: Y(yAt(f.x)) }));
          mA.textContent = a.toFixed(2); mB.textContent = b.toFixed(2); mL.textContent = fmt(L2(a, b), 2);
          coach.check();
        }
        draw();
        coach.start(st, [
          { text: '<p>이번엔 직선을 <b>위아래로도</b> 옮길 수 있어요: <span class="f">ŷ = ax + b</span></p><p>y축 위의 <b>b 손잡이</b>는 직선이 y축과 만나는 높이, <b>절편</b>이에요.</p>', target: () => hB.pos() },
          { hint: 'b 손잡이를 1~2 높이로 올린 뒤, a 손잡이로 기울기를 1.5쯤으로 낮춰 보세요.', text: '<p>a와 b 손잡이를 함께 움직여 <b>손실을 1보다 작게</b> 만들어 보세요.</p><p>원점을 지나는 직선(b = 0)으로는 1이 가장 작았어요.</p>', target: () => hB.pos(), wait: () => L2(S.a, S.b) < .95, ok: () => `손실 ${fmt(L2(S.a, S.b), 2)}! 바꿀 값이 하나 늘자 더 잘 맞출 수 있어요.` },
          { text: '<p>이제 손실은 무엇에 따라 달라질까요?</p>', choices: [
            { t: 'a와 b, 두 변수 → L(a, b)', ok: true, fb: '맞아요. a와 b를 정하면 손실이 하나 정해지니까, 손실은 두 변수의 함수 L(a, b)예요.' },
            { t: 'a 하나 → L(a)', fb: 'b를 바꿔도 손실이 달라졌죠? b도 변수예요.' },
            { t: '공부 시간 x와 점수 y', fb: 'x와 y는 고정된 데이터예요. 바꾸는 것은 직선의 a와 b예요.' },
          ] },
          { final: true, text: '<p><b>C1 완료!</b> 손실은 두 변수의 함수 L(a, b)가 됐어요.</p><p>다음 단계에서 L(a, b)의 그래프를 3D로 볼게요.</p>' },
        ], [886, 330, 370]);
      },
    },

    /* ---------- C2 그릇 모양 곡면 ---------- */
    {
      key: 'C2', short: '곡면', title: '손실 곡면과 등고선', formula: 'L = 13a² + 6.8ab + b² − 52a − 14b + 53',
      build(st) {
        const S = { a: .5, b: 4.5, sliceHi: false, th0: -.6, found: false };
        const B = bowl(scene);
        const [mA, mB, mL] = meters(['기울기 a', '절편 b', '손실 L(a, b)']);
        const pt = handle2({ label: '●', aria: '등고선 지도 위의 점 (a, b)', value: [S.a, S.b], fmtv: ([a, b]) => `a = ${a.toFixed(2)}, b = ${b.toFixed(2)}`,
          onChange: ([a, b], dragged) => {
            S.a = Math.round(clamp(a, 0, 3) * 100) / 100; S.b = Math.round(clamp(b, -2, 6) * 100) / 100;
            if (dragged && L2(S.a, S.b) < .8) { S.a = Math.round(AS * 100) / 100; S.b = Math.round(BS * 100) / 100; }
            draw();
          },
          drag: ([px, py]) => [(px - B.MX(0)) / 120, (B.MY(-2) - py) / 28 - 2] });
        function draw() {
          B.draw({ a: S.a, b: S.b, showMin: S.found, sliceHi: S.sliceHi });
          pt.at(B.MX(S.a), B.MY(S.b)); pt.set([S.a, S.b]);
          mA.textContent = S.a.toFixed(2); mB.textContent = S.b.toFixed(2); mL.textContent = fmt(L2(S.a, S.b), 2);
          coach.check();
        }
        B.redraw = draw;
        draw();
        coach.start(st, [
          { hint: '아래 ↻ 손잡이를 좌우로 끌어요.', text: '<p>L(a, b)는 <b>a, b에 대한 이차식</b>이에요(위 식).</p><p>그래프는 3차원의 <b>그릇 모양 곡면</b>! 아래 <b>↻ 손잡이</b>로 돌려 보세요.</p>', target: () => B.rot.pos(), wait: () => Math.abs(B.theta() - S.th0) > .5, ok: '어느 쪽에서 봐도 가운데가 움푹 꺼졌어요. 이런 곡면을 포물면이라고 해요. 이 그릇은 한쪽으로 길쭉한 골짜기 모양이에요.' },
          { hint: '등고선 타원들의 한가운데로 점을 옮겨요.', text: '<p>오른쪽은 그릇을 위에서 내려다본 <b>등고선 지도</b>예요. 같은 선 위는 손실이 같아요.</p><p>● 점을 끌어 그릇의 <b>가장 낮은 곳</b>을 찾아보세요.</p>', target: () => pt.pos(), wait: () => L2(S.a, S.b) < .66, ok: () => `가장 낮은 곳: a ≈ ${AS.toFixed(2)}, b ≈ ${BS.toFixed(2)}, 손실 ≈ ${LMIN.toFixed(2)}!`, after: () => { S.found = true; draw(); } },
          { text: '<p>지도의 빨간 점선(b = 0)을 따라 그릇을 자른 <b>단면</b>이 빨간 곡선이에요. 어디서 본 곡선일까요?</p>', enter: () => { S.sliceHi = true; draw(); }, choices: [
            { t: '기본 활동의 손실함수 L(a)', ok: true, fb: '맞아요! L(a) = 13a² − 52a + 53은 이 그릇을 b = 0으로 자른 단면이에요. 그릇을 세로로 자르면 단면은 늘 포물선이에요.' },
            { t: '평균점을 지나는 직선', fb: 'b = 0이면 직선이 원점을 지나요. 기본 활동 A3~A5의 곡선을 떠올려 보세요.' },
            { t: '오차의 합 Σe', fb: 'Σe는 지워져서 0이 되던 값이에요. 이 곡선은 제곱의 평균, 손실이에요.' },
          ] },
          { final: true, text: '<p><b>C2 완료!</b> 바꿀 값이 a 하나 → 포물선, a와 b 둘 → 그릇 모양 곡면.</p><p>다음 단계에서 이 그릇 위에서 경사하강법으로 걸어 봐요.</p>' },
        ], [650, 84, 430]);
      },
    },

    /* ---------- C3 기울기 2개로 내려가기 ---------- */
    {
      key: 'C3', short: '경사하강', title: '두 방향 기울기로 내려가기', formula: 'a ← a − α·∂L/∂a,  b ← b − α·∂L/∂b',
      build(st) {
        const ALPHA = .05;
        const S = { a: 1, b: 0, path: [[1, 0]], steps: 0 };
        const B = bowl(scene);
        const [mGA, mGB, mL] = meters(['a 방향 기울기 ∂L/∂a', 'b 방향 기울기 ∂L/∂b', '손실 L(a, b)']);
        const nextOf = (a, b) => [a - ALPHA * gA(a, b), b - ALPHA * gB(a, b)];
        const walk = (n) => {
          for (let k = 0; k < n; k++) { [S.a, S.b] = nextOf(S.a, S.b); S.path.push([S.a, S.b]); S.steps++; }
          draw();
        };
        const b1 = fbtn('한 걸음 ▶', () => walk(1), { class: 'primary' });
        const b10 = fbtn('10걸음 ▶▶', () => walk(10));
        place(b1, 1100, 330); place(b10, 1100, 384);
        b1.style.width = b10.style.width = '156px';
        b10.hidden = true;
        function draw() {
          B.draw({ a: S.a, b: S.b, path: S.path, next: nextOf(S.a, S.b), showMin: true });
          mGA.textContent = sgn(gA(S.a, S.b), 2); mGB.textContent = sgn(gB(S.a, S.b), 2); mL.textContent = fmt(L2(S.a, S.b), 3);
          coach.check();
        }
        B.redraw = draw;
        draw();
        coach.start(st, [
          { text: '<p>바꿀 값이 a, b 둘이면 기울기도 2개예요.</p><p><b>∂L/∂a</b>는 b를 고정하고 잰 a 방향 기울기, <b>∂L/∂b</b>는 a를 고정하고 잰 b 방향 기울기예요.</p>', target: () => [B.MX(S.a), B.MY(S.b)] },
          { hint: '‘한 걸음 ▶’을 2~3번 눌러요.', text: '<p><b>한 걸음 ▶</b>을 눌러 보세요. 두 기울기의 반대 방향(초록 화살표)으로 a와 b가 함께 움직여요(α = 0.05).</p><p>손실 <b>1 아래</b>까지!</p>', target: () => elPos(b1), wait: () => L2(S.a, S.b) < 1, ok: () => `${S.steps}걸음 만에 골짜기 바닥까지 내려왔어요. 그런데…` },
          { hint: '‘10걸음 ▶▶’을 여러 번 눌러요. 70걸음쯤 필요해요.', text: '<p>이제 <b>10걸음 ▶▶</b>으로 계속 가 보세요. 손실 <b>0.7 아래</b>까지! 걸음이 어떻게 움직이나요?</p>', enter: () => { b10.hidden = false; }, target: () => elPos(b10), wait: () => L2(S.a, S.b) < .7, ok: () => `${S.steps}걸음째 도착! 처음엔 금방 내려왔는데, 골짜기를 따라서는 아주 천천히 걸었죠.` },
          { text: '<p>골짜기 바닥에 들어간 뒤 걸음이 느려진 까닭은?</p>', choices: [
            { t: '골짜기가 길쭉해서, 바닥을 따라가는 방향의 기울기가 아주 완만해서', ok: true, fb: '맞아요. 한 방향은 가파르고 다른 방향은 완만한 긴 골짜기에서는 경사하강법이 느려져요. 실제 AI는 이를 줄이려고 학습률을 방향마다 조절하는 방법도 써요.' },
            { t: '학습률 α가 점점 작아져서', fb: 'α는 0.05 그대로예요. 기울기(오른쪽 칸)가 작아졌어요.' },
            { t: '손실이 음수가 되어서', fb: '손실은 제곱의 평균이라 0보다 작아질 수 없어요.' },
          ] },
          { final: true, extra: { label: '◀ 기본 활동으로', href: 'index.html' }, text: '<p><b>추가 활동 완료!</b> 바꿀 값이 2개면 그릇 모양 곡면, 실제 AI처럼 수백만 개면 눈으로 그릴 수 없는 그릇이에요.</p><p>그래도 방법은 같아요: <b>각 방향 기울기의 반대로, 학습률만큼</b>.</p>' },
        ], [650, 84, 430]);
      },
    },
  ];

  const STEPS = SET === 'plus' ? PLUS : MAIN;

  addEventListener('resize', () => { fit(); coach.place(); });
  fit();
  const fromHash = STEPS.findIndex((st) => `#${st.key}` === location.hash);
  go(fromHash >= 0 ? fromHash : 0);
})();
