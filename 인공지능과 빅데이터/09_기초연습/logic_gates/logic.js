/* logic.js — 논리 게이트 정의와 SVG 그림 부품 (모션 해설·체험 웹앱이 함께 쓴다)
 *
 * 그림 부품은 모두 "만들기 → set(값)" 구조다. set은 몇 번을 불러도 같은 그림이 나오므로
 * 모션(시간 t로 그림)과 체험(클릭으로 그림)이 같은 부품을 그대로 쓴다.
 */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // ---------- 게이트 정의 ----------
  const GATES = {
    NOT: { key: 'NOT', ko: '논리 부정', arity: 1, color: '#6250d6', fn: (a) => 1 - a, expr: '¬A', set: 'Aᶜ', say: '반대로 바꾼다',
      why: '입력을 뒤집습니다. 1이면 0, 0이면 1.' },
    AND: { key: 'AND', ko: '논리곱', arity: 2, color: '#2a78d6', fn: (a, b) => a & b, expr: 'A ∧ B', set: 'A ∩ B', say: '둘 다 1일 때만 1',
      why: '진리표가 곱셈 A×B와 똑같아서 ‘곱’이라 부릅니다.' },
    OR: { key: 'OR', ko: '논리합', arity: 2, color: '#14946a', fn: (a, b) => a | b, expr: 'A ∨ B', set: 'A ∪ B', say: '하나라도 1이면 1',
      why: '덧셈 A+B와 닮았지만 1+1을 1로 둡니다(켜짐은 켜짐).' },
    XOR: { key: 'XOR', ko: '배타적 논리합', arity: 2, color: '#d9582a', fn: (a, b) => a ^ b, expr: 'A ⊕ B', set: '(A∪B) − (A∩B)', say: '둘이 다를 때만 1',
      why: 'OR에서 ‘둘 다 1’인 경우를 빼 버린(배타) 것. A+B를 2로 나눈 나머지와 같습니다.' },
    NAND: { key: 'NAND', ko: '부정 논리곱', arity: 2, color: '#b8406f', fn: (a, b) => 1 - (a & b), expr: '¬(A ∧ B)', set: '(A ∩ B)ᶜ', say: 'AND를 뒤집은 것',
      why: 'AND의 결과를 NOT으로 뒤집습니다. 이것 하나로 모든 게이트를 만들 수 있습니다.' },
    NOR: { key: 'NOR', ko: '부정 논리합', arity: 2, color: '#2c7d2c', fn: (a, b) => 1 - (a | b), expr: '¬(A ∨ B)', set: '(A ∪ B)ᶜ', say: 'OR을 뒤집은 것',
      why: 'OR의 결과를 NOT으로 뒤집습니다. NAND처럼 이것 하나로도 모든 게이트를 만들 수 있습니다.' }
  };
  const ORDER = ['NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR'];
  const ROWS2 = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const COLORS = { ink: '#1f2a44', paper: '#f6f4ee', wireOff: '#a3abbb', on: '#f0a500', onDark: '#7a5200', soft: '#e7e3d8' };

  function evalGate(type, a, b) { return GATES[type].fn(a, b); }
  function column(type) { return GATES[type].arity === 1 ? [0, 1].map((a) => evalGate(type, a)) : ROWS2.map(([a, b]) => evalGate(type, a, b)); }

  // ---------- SVG 도우미 ----------
  let uid = 0;
  const nextId = (p) => `${p}${++uid}`;
  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs = {}) {
    const t = el('text', Object.assign({ x, y }, attrs), parent);
    t.textContent = str;
    return t;
  }
  function group(parent, x = 0, y = 0, attrs = {}) {
    return el('g', Object.assign({ transform: `translate(${x} ${y})` }, attrs), parent);
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // ---------- 게이트 기호 (ANSI 모양) ----------
  // 지역 좌표: 폭 120, 높이 80. 입력 A (0,24) B (0,56), 하나짜리는 (0,40). 출력 (120,40)
  const BODY = {
    AND: 'M18 4 H62 A36 36 0 0 1 62 76 H18 Z',
    OR: 'M14 4 Q46 4 70 14 Q92 24 102 40 Q92 56 70 66 Q46 76 14 76 Q30 40 14 4 Z',
    NOT: 'M24 6 L88 40 L24 74 Z'
  };
  const XOR_ARC = 'M4 4 Q20 40 4 76';
  function gateSymbol(parent, type, x, y, opts = {}) {
    const s = opts.scale || 1;
    const g = group(parent, x, y, { class: 'gate-symbol' });
    g.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
    const G = GATES[type];
    const base = type === 'NAND' ? 'AND' : type === 'NOR' || type === 'XOR' ? 'OR' : type;
    const bubble = type === 'NOT' || type === 'NAND' || type === 'NOR';
    const tipX = base === 'AND' ? 98 : base === 'OR' ? 102 : 88;
    const inputs = G.arity === 1 ? [[0, 40]] : [[0, 24], [0, 56]];
    // 입력 다리
    const legs = inputs.map(([ix, iy]) => el('line', { x1: ix, y1: iy, x2: base === 'NOT' ? 24 : base === 'OR' ? 22 : 18, y2: iy, class: 'gate-leg' }, g));
    if (type === 'XOR') el('path', { d: XOR_ARC, class: 'gate-arc' }, g);
    const body = el('path', { d: BODY[base], class: 'gate-body', fill: opts.fill || '#fff', stroke: opts.stroke || COLORS.ink }, g);
    let bubbleEl = null;
    const outStart = bubble ? tipX + 12 : tipX;
    if (bubble) bubbleEl = el('circle', { cx: tipX + 6, cy: 40, r: 6, class: 'gate-bubble', fill: '#fff' }, g);
    const outLeg = el('line', { x1: outStart, y1: 40, x2: 120, y2: 40, class: 'gate-leg' }, g);
    let label = null;
    if (opts.label !== false) label = text(g, base === 'NOT' ? 46 : 50, 45, type, { class: 'gate-label', 'text-anchor': 'middle', fill: opts.labelColor || G.color });
    return {
      g, body, bubble: bubbleEl, legs, outLeg, label,
      inPort: (i) => ({ x: x + inputs[i][0] * s, y: y + inputs[i][1] * s }),
      outPort: () => ({ x: x + 120 * s, y: y + 40 * s })
    };
  }

  // ---------- 전선 ----------
  // 값이 1이면 진한 호박색 + 흐르는 점선(전류), 0이면 회색. 색만이 아니라 굵기와 움직임도 달라진다
  function wire(parent, d, opts = {}) {
    const g = el('g', { class: 'wire' }, parent);
    const base = el('path', { d, class: 'wire-base' }, g);
    const flow = el('path', { d, class: 'wire-flow' }, g);
    const w = {
      g, base, flow, value: 0,
      set(v, t = 0) {
        w.value = v;
        g.classList.toggle('on', !!v);
        flow.style.strokeDashoffset = v ? String(-((t * 60) % 1000)) : '0';
      },
      draw(p) { // 0~1: 선이 그려지는 정도
        base.setAttribute('pathLength', '1');
        base.style.strokeDasharray = '1';
        base.style.strokeDashoffset = String(1 - clamp01(p));
        flow.style.opacity = p >= 1 ? '' : '0';
      }
    };
    if (opts.value) w.set(opts.value);
    return w;
  }

  // ---------- 스위치 (칼 스위치) ----------
  // 지역 좌표: 왼쪽 접점 (0,0), 오른쪽 접점 (80,0)
  function knifeSwitch(parent, x, y, opts = {}) {
    const g = group(parent, x, y, { class: 'sw' });
    el('circle', { cx: 0, cy: 0, r: 7, class: 'sw-pin' }, g);
    el('circle', { cx: 80, cy: 0, r: 7, class: 'sw-pin' }, g);
    const lever = el('line', { x1: 0, y1: 0, x2: 80, y2: 0, class: 'sw-lever' }, g);
    const lab = opts.label ? text(g, 40, 44, opts.label, { class: 'sw-label', 'text-anchor': 'middle' }) : null;
    const val = text(g, 40, -58, '0', { class: 'sw-value', 'text-anchor': 'middle' });
    const s = {
      g, x, y, on: 0,
      // p: 움직임 진행(0~1), prev: 움직이기 전 상태(같으면 움직이지 않음). 열림 각도 34°
      set(on, p = 1, prev = on ? 0 : 1) {
        s.on = on;
        const from = prev ? 0 : 34, to = on ? 0 : 34;
        const ang = (from + (to - from) * clamp01(p)) * Math.PI / 180;
        lever.setAttribute('x2', (80 * Math.cos(ang)).toFixed(2));
        lever.setAttribute('y2', (-80 * Math.sin(ang)).toFixed(2));
        g.classList.toggle('on', !!on && p >= 1);
        val.textContent = opts.valueFn ? opts.valueFn(on) : on ? '1 켜짐' : '0 꺼짐';
      }
    };
    s.set(opts.on || 0);
    return s;
  }

  // ---------- 전구 ----------
  function lamp(parent, x, y, opts = {}) {
    const g = group(parent, x, y, { class: 'lamp' });
    const rays = el('g', { class: 'lamp-rays' }, g);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      el('line', { x1: Math.cos(a) * 44, y1: -10 + Math.sin(a) * 44, x2: Math.cos(a) * 58, y2: -10 + Math.sin(a) * 58 }, rays);
    }
    const bulb = el('path', { d: 'M-24 -10 A24 24 0 1 1 24 -10 Q24 4 12 14 L12 22 L-12 22 L-12 14 Q-24 4 -24 -10 Z', class: 'lamp-bulb' }, g);
    el('path', { d: 'M-8 -6 L-3 8 L3 8 L8 -6', class: 'lamp-fil' }, g);
    el('rect', { x: -13, y: 22, width: 26, height: 14, rx: 3, class: 'lamp-base' }, g);
    // 전선이 전구 아래로 지나가므로 글자는 오른쪽에 둔다
    const val = text(g, 64, 30, '0 꺼짐', { class: 'lamp-value' });
    if (opts.label) text(g, 64, 6, opts.label, { class: 'sw-label' });
    const L = {
      g, on: 0,
      set(on) { L.on = on; g.classList.toggle('on', !!on); val.textContent = on ? '1 켜짐' : '0 꺼짐'; }
    };
    L.set(opts.on || 0);
    return L;
  }

  // ---------- 0/1 값 표시 칩 ----------
  function bitChip(parent, x, y, v = 0, opts = {}) {
    const g = group(parent, x, y, { class: 'bit-chip' });
    const r = opts.r || 16;
    const c = el('circle', { cx: 0, cy: 0, r }, g);
    const t = text(g, 0, 6, String(v), { 'text-anchor': 'middle' });
    const B = { g, set(val) { t.textContent = String(val); g.classList.toggle('on', !!val); } };
    B.set(v);
    return B;
  }

  // ---------- 진리표 ----------
  // cols: 머리말 배열, rows: 값 배열의 배열. 마지막 열이 결과 열
  function truthTable(parent, x, y, cols, rows, opts = {}) {
    const cw = opts.cw || 76, rh = opts.rh || 44;
    const g = group(parent, x, y, { class: 'tt' });
    const W = cw * cols.length;
    el('rect', { x: 0, y: 0, width: W, height: rh * (rows.length + 1), rx: 10, class: 'tt-frame' }, g);
    el('rect', { x: 0, y: 0, width: W, height: rh, rx: 10, class: 'tt-head-bg' }, g);
    el('rect', { x: 0, y: rh - 10, width: W, height: 10, class: 'tt-head-bg' }, g);
    if (opts.outColor) el('rect', { x: cw * (cols.length - 1), y: 0, width: cw, height: rh * (rows.length + 1), class: 'tt-out-bg', fill: opts.outColor, opacity: 0.1 }, g);
    cols.forEach((c, i) => text(g, cw * i + cw / 2, rh / 2 + 7, c, { class: 'tt-head', 'text-anchor': 'middle', fill: i === cols.length - 1 && opts.outColor ? opts.outColor : undefined }));
    const rowEls = rows.map((r, ri) => {
      const rg = el('g', { class: 'tt-row' }, g);
      const hl = el('rect', { x: 3, y: rh * (ri + 1) + 3, width: W - 6, height: rh - 6, rx: 7, class: 'tt-hl' }, rg);
      el('line', { x1: 0, y1: rh * (ri + 1), x2: W, y2: rh * (ri + 1), class: 'tt-line' }, rg);
      const cells = r.map((v, ci) => text(rg, cw * ci + cw / 2, rh * (ri + 1) + rh / 2 + 7, String(v), { class: 'tt-cell' + (ci === r.length - 1 ? ' tt-out' : ''), 'text-anchor': 'middle' }));
      return { rg, hl, cells };
    });
    el('line', { x1: cw * (cols.length - 1), y1: 6, x2: cw * (cols.length - 1), y2: rh * (rows.length + 1) - 6, class: 'tt-divider' }, g);
    const T = {
      g, rows: rowEls, width: W, height: rh * (rows.length + 1), cw, rh,
      highlight(i) { rowEls.forEach((r, k) => r.rg.classList.toggle('active', k === i)); },
      reveal(i, p, col) { // 결과 칸(또는 col 칸)을 p만큼 보이기
        const c = rowEls[i].cells[col === undefined ? rowEls[i].cells.length - 1 : col];
        c.style.opacity = String(clamp01(p));
      },
      setCell(i, col, v) { rowEls[i].cells[col].textContent = String(v); },
      cellPos: (i, col) => ({ x: x + cw * col + cw / 2, y: y + rh * (i + 1) + rh / 2 })
    };
    return T;
  }

  // ---------- 벤 다이어그램 ----------
  // 네 영역 = 진리표 네 행: 00(둘 다 밖), 10(A만), 01(B만), 11(겹침)
  function venn(parent, x, y, opts = {}) {
    const r = opts.r || 90, gap = opts.gap || 60, W = opts.w || 2 * r + 2 * gap + 60, H = opts.h || 2 * r + 60;
    const g = group(parent, x, y, { class: 'venn' });
    const ax = W / 2 - gap, bx = W / 2 + gap, cy = H / 2;
    const id = nextId('v');
    const defs = el('defs', {}, g);
    const mk = (name, children) => {
      const m = el('mask', { id: `${id}${name}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
      children.forEach(([shape, fill]) => {
        if (shape === 'rect') el('rect', { x: 0, y: 0, width: W, height: H, fill }, m);
        else el('circle', { cx: shape === 'A' ? ax : bx, cy, r, fill }, m);
      });
      return `url(#${id}${name})`;
    };
    const masks = {
      '10': mk('a', [['A', 'white'], ['B', 'black']]),
      '01': mk('b', [['B', 'white'], ['A', 'black']]),
      '11': mk('ab', [['A', 'white']]),
      '00': mk('o', [['rect', 'white'], ['A', 'black'], ['B', 'black']])
    };
    const clipB = el('clipPath', { id: `${id}cb` }, defs);
    el('circle', { cx: bx, cy, r }, clipB);
    el('rect', { x: 0, y: 0, width: W, height: H, rx: 14, class: 'venn-frame' }, g);
    const regions = {
      '00': el('rect', { x: 0, y: 0, width: W, height: H, rx: 14, mask: masks['00'], class: 'venn-r' }, g),
      '10': el('circle', { cx: ax, cy, r, mask: masks['10'], class: 'venn-r' }, g),
      '01': el('circle', { cx: bx, cy, r, mask: masks['01'], class: 'venn-r' }, g),
      '11': el('circle', { cx: ax, cy, r, 'clip-path': `url(#${id}cb)`, class: 'venn-r' }, g)
    };
    const single = !!opts.single;   // NOT: 원 A 하나만
    if (single) {
      regions['10'].setAttribute('cx', String(W / 2));
      regions['10'].removeAttribute('mask');
      regions['00'].setAttribute('mask', mk('o1', [['rect', 'white']]));
      regions['00'].style.display = 'none';
      const m1 = el('mask', { id: `${id}s`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
      el('rect', { x: 0, y: 0, width: W, height: H, fill: 'white' }, m1);
      el('circle', { cx: W / 2, cy, r, fill: 'black' }, m1);
      regions['00'].setAttribute('mask', `url(#${id}s)`);
      regions['00'].style.display = '';
      regions['01'].style.display = regions['11'].style.display = 'none';
    }
    el('circle', { cx: single ? W / 2 : ax, cy, r, class: 'venn-line' }, g);
    if (!single) el('circle', { cx: bx, cy, r, class: 'venn-line' }, g);
    const mini = !!opts.minimal;   // 작은 그림: 이름만 바깥에, 영역 표시는 생략
    const nameY = mini ? cy - r - 6 : cy - r * 0.62;
    text(g, (single ? W / 2 : ax) - (mini ? 0 : r * 0.55), nameY, 'A', { class: 'venn-name' + (mini ? ' mini' : ''), 'text-anchor': 'middle' });
    if (!single) text(g, bx + (mini ? 0 : r * 0.55), nameY, 'B', { class: 'venn-name' + (mini ? ' mini' : ''), 'text-anchor': 'middle' });
    if (!mini) text(g, 18, 30, 'U', { class: 'venn-name small' });
    // 영역 위의 작은 (A,B) 표시
    const tagPos = single
      ? { '10': [W / 2, cy + 6], '00': [W - 40, H - 20] }
      : { '10': [ax - r * 0.5, cy + 6], '01': [bx + r * 0.5, cy + 6], '11': [W / 2, cy + 6], '00': [W - 44, H - 20] };
    const tags = {};
    for (const k in tagPos) tags[k] = text(g, tagPos[k][0], tagPos[k][1], single ? 'A=' + k[0] : k[0] + k[1], { class: 'venn-tag', 'text-anchor': 'middle', display: mini ? 'none' : null });
    const V = {
      g, W, H, regions, tags,
      // fills: { '00':0/1 ... } 값이 1인 영역을 color로 칠함. p는 칠하는 진행(0~1)
      set(fills, color, p = 1) {
        for (const k in regions) {
          if (!tags[k]) continue;
          const on = fills[k] ? 1 : 0;
          regions[k].setAttribute('fill', color || COLORS.on);
          regions[k].style.opacity = String(on * 0.78 * clamp01(p));
          tags[k].classList.toggle('on', !!on && p > 0.5);
        }
      },
      point(k, active) { for (const q in tags) tags[q].classList.toggle('point', active && q === k); }
    };
    V.set({}, null, 0);
    return V;
  }
  function vennFills(type) {
    const G = GATES[type];
    if (G.arity === 1) return { '00': G.fn(0), '01': G.fn(0), '10': G.fn(1), '11': G.fn(1) };
    return { '00': G.fn(0, 0), '01': G.fn(0, 1), '10': G.fn(1, 0), '11': G.fn(1, 1) };
  }

  // ---------- 저장된 진도 ----------
  const PROGRESS_KEY = 'logicGates.progress.v1';
  function readProgress() {
    try { const v = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'); if (v && v.motion && v.lab) return v; } catch (e) { /* 새로 시작 */ }
    return { motion: {}, lab: {} };
  }
  function markProgress(kind, id) {
    const p = readProgress();
    if (p[kind][id]) return;
    p[kind][id] = Date.now();
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) { /* 저장이 막혀 있으면 이번 접속 동안만 */ }
  }

  // 주제 지도: 모션 장 ↔ 체험 활동 (안내 페이지와 양쪽 연결 버튼이 함께 쓴다)
  const TOPICS = [
    { id: 'basics', title: '0과 1로 생각하기', motion: 'ch-basics', lab: 'lab-gate', labTitle: '게이트 실험실' },
    { id: 'not', title: 'NOT · 뒤집기', motion: 'ch-not', lab: 'lab-gate', gate: 'NOT', labTitle: '게이트 실험실 · NOT' },
    { id: 'and', title: 'AND · 논리곱', motion: 'ch-and', lab: 'lab-gate', gate: 'AND', labTitle: '게이트 실험실 · AND' },
    { id: 'or', title: 'OR · 논리합', motion: 'ch-or', lab: 'lab-gate', gate: 'OR', labTitle: '게이트 실험실 · OR' },
    { id: 'xor', title: 'XOR · 배타적 논리합', motion: 'ch-xor', lab: 'lab-gate', gate: 'XOR', labTitle: '게이트 실험실 · XOR' },
    { id: 'nandnor', title: 'NAND · NOR', motion: 'ch-nandnor', lab: 'lab-mystery', labTitle: '정체를 밝혀라' },
    { id: 'universal', title: 'NAND 하나로 전부 만들기', motion: 'ch-universal', lab: 'lab-build', labTitle: '회로 만들기' },
    { id: 'adder', title: '반가산기: 1 + 1 = 10', motion: 'ch-adder', lab: 'lab-build', labTitle: '회로 만들기 · 반가산기' },
    { id: 'bits', title: '비트 연산과 XOR 암호', motion: 'ch-bits', lab: 'lab-bits', labTitle: '비트 연산' },
    { id: 'neuron', title: 'AI 뉴런과 XOR 문제', motion: 'ch-neuron', lab: 'lab-neuron', labTitle: '퍼셉트론' }
  ];

  root.Logic = {
    GATES, ORDER, ROWS2, COLORS, evalGate, column, el, text, group, clamp01,
    gateSymbol, wire, knifeSwitch, lamp, bitChip, truthTable, venn, vennFills,
    readProgress, markProgress, TOPICS
  };
})(window);
