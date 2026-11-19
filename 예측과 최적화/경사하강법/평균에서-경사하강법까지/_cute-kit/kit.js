/* 귀여운 모션 해설 공통 부품 (window.Kit). motion-core.js(window.Motion) 다음에 넣는다.
 *
 *  - 캐릭터: makeKid / paintKid (얼굴 있는 젤리 친구), makeMascot (학사모 병아리 선생님)
 *  - 장식: makeDeco (둥실둥실 별·동그라미), tag (둥근 이름표)
 *  - 글자: labels (위치 고정 수식·알약), board (오른쪽 공식 판), chips (머리줄 장 표시), chapTag (장 시작 스티커)
 *  - 시간: say (말풍선 자막), narration (TTS 길이에 맞춘 장면 멈춤·입 모양), boot (재생기 시작)
 *
 * 상태(state)는 tl.stateAt(대본 시각)으로 계산하고, 깜빡임·통통 튀기 같은 반복 동작은 영상 시각 V 로 그린다.
 * 그래서 state 안에는 '시간이 지나면 계속 변하는 값'을 넣지 않는다(멈춤 위치 찾기가 깨진다).
 */
(function (root) {
  'use strict';
  const { clamp, lerp, svg, esc, renderTexIn, setText } = root.Motion;
  const $ = (id) => document.getElementById(id);

  const C = {
    ink: '#3b3355', muted: '#6f6787', gray: '#d9d3e6', blue: '#5fa2ff', orange: '#ffa560', purple: '#b084f5', yellow: '#ffd966',
    pink: '#ff8fab', mint: '#7fd6b9', coral: '#ff7a59', sky: '#4f8ff0', gold: '#ffcf4d',
    cream: '#fff8ec', blueInk: '#2f6fd6', orangeInk: '#c25e10', purpleInk: '#6b3fc4', coralInk: '#d4472a', greenInk: '#1f8a5c',
    blueSoft: '#e4efff', orangeSoft: '#ffeedd', purpleSoft: '#f1e8ff', graySoft: '#f1edf6', yellowSoft: '#fff4c4', coralSoft: '#ffe6df', mintSoft: '#ddf6ec',
  };
  /* 핵심 기호 색 — 수식(TeX)에서 이름으로만 쓰고 색은 여기 한곳에서 정한다.
   *  \pa : 기울기 a(예측 직선의 기울기, 그래프의 직선과 같은 산호색)
   *  \pal: 학습률 α(보라)
   * 예) 'L(\\pa)=13\\pa^2-52\\pa+53', 'a_{new}=\\pa-\\pal L′(\\pa)' */
  root.TEX_MACROS = {
    '\\pa': `{\\color{${C.coralInk}}\\boldsymbol{a}}`,
    '\\pal': `{\\color{${C.purpleInk}}\\boldsymbol{\\alpha}}`,
  };
  /* 살짝 튀어 오르며 멈추는 곡선 (0→1, 중간에 1을 조금 넘음) */
  const backOut = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
  const popIn = (lt, t0, dur = .5) => backOut(clamp((lt - t0) / dur));
  const pulse = (lt, t0, dur) => Math.sin(Math.PI * clamp((lt - t0) / dur));
  const rand = (seed) => { const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, p) => { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p))).toString(16).padStart(2, '0')).join(''); };
  const setA = (el, attrs) => { for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); };
  const text = (parent, x, y, str, attrs = {}) => { const t = svg('text', { x, y, class: 'svg-text', ...attrs }, parent); t.textContent = str; return t; };
  const textWidth = (str, size) => [...str].reduce((w, ch) => w + (ch.codePointAt(0) > 0x2000 && !/[가-힣·∩ᶜ²−]/.test(ch) ? size * 1.2 : /[가-힣]/.test(ch) ? size * .9 : /\s/.test(ch) ? size * .28 : size * .55), 0);
  /* ---------- 핵심 기호 색(일반 글자) ----------
   * 수식(TeX)의 \pa·\pal 과 같은 색을 일반 글자에도 쓴다: 홀로 쓰인 a(기울기, 'ax'·'ab'·'13a' 포함)와 α.
   * 영어 낱말 속 a(예: max)는 앞이 알파벳이라 건드리지 않는다. */
  const VAR_RE = /(?<![A-Za-z\\])a(?=[xb]|[^A-Za-z]|$)|α/g;
  const VAR_COL = { a: C.coralInk, 'α': C.purpleInk };
  /* SVG 글자: 기호만 tspan 으로 색을 입힌다 */
  function setRich(t, s) {
    if (t.textContent === s) return;
    VAR_RE.lastIndex = 0;
    if (!VAR_RE.test(s)) { t.textContent = s; return; }
    t.textContent = '';
    let i = 0;
    s.replace(VAR_RE, (m, at) => {
      if (at > i) t.append(document.createTextNode(s.slice(i, at)));
      svg('tspan', { fill: VAR_COL[m], 'font-weight': 900 }, t).textContent = m;
      i = at + m.length;
      return m;
    });
    if (i < s.length) t.append(document.createTextNode(s.slice(i)));
  }
  /* HTML 덩어리: 글자 마디를 돌며 기호를 <b class="pv"> 로 감싼다(KaTeX 수식·이미 감싼 곳은 건너뜀) */
  function paintVars(el) {
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest('.katex, .pv, script, style, svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      const s = n.nodeValue;
      VAR_RE.lastIndex = 0;
      if (!VAR_RE.test(s)) return;
      const frag = document.createDocumentFragment();
      let i = 0;
      s.replace(VAR_RE, (m, at) => {
        if (at > i) frag.append(s.slice(i, at));
        const b = document.createElement('b');
        b.className = 'pv';
        b.style.color = VAR_COL[m];
        b.textContent = m;
        frag.append(b);
        i = at + m.length;
        return m;
      });
      if (i < s.length) frag.append(s.slice(i));
      n.replaceWith(frag);
    });
  }

  /* 둥근 이름표(글자 뒤 알약). 반환: { g, rect, text, set(str) } */
  function tag(parent, x, y, str, { size = 24, fill = '#fff', color = C.ink, anchor = 'middle' } = {}) {
    const g = svg('g', {}, parent);
    const h = size + 18;
    const rect = svg('rect', { y: y - h / 2, height: h, rx: h / 2, fill, stroke: C.ink, 'stroke-width': 2.5 }, g);
    const t = text(g, 0, y + size * .36, '', { 'font-size': size, fill: color, 'text-anchor': 'middle' });
    const set = (s) => {
      const w = textWidth(s, size) + 34, x0 = anchor === 'middle' ? x - w / 2 : x;
      setA(rect, { x: x0, width: w });
      t.setAttribute('x', x0 + w / 2);
      setRich(t, s);
    };
    set(str);
    return { g, rect, text: t, set };
  }

  /* ---------- 젤리 친구 ---------- */
  function makeKid(parent) {
    const g = svg('g', {}, parent);
    const shadow = svg('ellipse', { cx: 0, cy: 25, rx: 17, ry: 4, fill: C.ink, opacity: .13 }, g);
    const inner = svg('g', {}, g);
    const body = svg('rect', { x: -21, y: -23, width: 42, height: 46, rx: 19, stroke: C.ink, 'stroke-width': 2.6 }, inner);
    svg('ellipse', { cx: -10, cy: -11, rx: 4, ry: 6.5, fill: '#fff', opacity: .45 }, inner);
    const eyesOpen = svg('g', { fill: C.ink }, inner);
    svg('ellipse', { cx: -7, cy: -4, rx: 2.6, ry: 3.3 }, eyesOpen);
    svg('ellipse', { cx: 7, cy: -4, rx: 2.6, ry: 3.3 }, eyesOpen);
    svg('circle', { cx: -6.2, cy: -5.2, r: .9, fill: '#fff' }, eyesOpen);
    svg('circle', { cx: 7.8, cy: -5.2, r: .9, fill: '#fff' }, eyesOpen);
    const eyesClosed = svg('path', { d: 'M-10 -4 Q-7 -1 -4 -4 M4 -4 Q7 -1 10 -4', stroke: C.ink, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, inner);
    svg('ellipse', { cx: -13, cy: 3, rx: 4, ry: 2.5, fill: C.pink, opacity: .8 }, inner);
    svg('ellipse', { cx: 13, cy: 3, rx: 4, ry: 2.5, fill: C.pink, opacity: .8 }, inner);
    const smile = svg('path', { d: 'M-4 4 Q0 8.5 4 4', stroke: C.ink, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, inner);
    const worry = svg('ellipse', { cx: 0, cy: 6, rx: 2.3, ry: 2.8, fill: C.ink, opacity: 0 }, inner);
    const happy = svg('path', { d: 'M-5 3 Q0 11 5 3 Z', fill: C.coral, stroke: C.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round', opacity: 0 }, inner);
    return { g, shadow, inner, body, eyesOpen, eyesClosed, smile, worry, happy };
  }
  /* mood: 'smile' | 'worry' | 'happy'  ·  sleep: 1 이면 눈 감고 천천히 숨쉬기 */
  function paintKid(el, { col, id = 0, t = 0, mood = 'smile', sleep = 0, bob = 1 }) {
    el.body.setAttribute('fill', col);
    const blink = ((t + id * .61) % 3.3) < .12;
    const closed = blink || sleep > .5;
    el.eyesOpen.setAttribute('opacity', closed ? 0 : 1);
    el.eyesClosed.setAttribute('opacity', closed ? 1 : 0);
    el.smile.setAttribute('opacity', mood === 'smile' ? 1 : 0);
    el.worry.setAttribute('opacity', mood === 'worry' ? 1 : 0);
    el.happy.setAttribute('opacity', mood === 'happy' ? 1 : 0);
    const b = sleep > .5 ? Math.sin(t * 1.6 + id) * 1.2 : Math.sin(t * 3.1 + id * 1.7) * 2;
    el.inner.setAttribute('transform', `translate(0 ${(b * bob).toFixed(2)})`);
  }
  function placeKid(el, x, y, sc, o = 1) {
    if (o <= .001 || sc <= .001) { el.g.setAttribute('opacity', 0); return; }
    el.g.setAttribute('opacity', clamp(o).toFixed(3));
    el.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc.toFixed(3)})`);
  }

  /* ---------- 병아리 선생님 ---------- */
  function makeMascot(parent) {
    const g = svg('g', {}, parent);
    svg('ellipse', { cx: 0, cy: 68, rx: 48, ry: 9, fill: C.ink, opacity: .14 }, g);
    const body = svg('g', {}, g);
    const wingL = svg('ellipse', { cx: -56, cy: 14, rx: 15, ry: 24, fill: '#ffc93d', stroke: C.ink, 'stroke-width': 3.5 }, body);
    const wingR = svg('ellipse', { cx: 56, cy: 14, rx: 15, ry: 24, fill: '#ffc93d', stroke: C.ink, 'stroke-width': 3.5 }, body);
    svg('circle', { r: 60, fill: C.yellow, stroke: C.ink, 'stroke-width': 4 }, body);
    svg('ellipse', { cx: 0, cy: 26, rx: 34, ry: 24, fill: '#fff2b8' }, body);
    svg('path', { d: 'M-30 -62 L0 -76 L30 -62 L0 -48 Z', fill: C.ink }, body);
    svg('rect', { x: -15, y: -58, width: 30, height: 12, rx: 3, fill: C.ink }, body);
    svg('path', { d: 'M24 -63 Q34 -50 30 -36', stroke: C.ink, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, body);
    svg('circle', { cx: 30, cy: -33, r: 5, fill: C.pink, stroke: C.ink, 'stroke-width': 2 }, body);
    const eyes = svg('g', {}, body);
    [-20, 20].forEach((x) => {
      svg('circle', { cx: x, cy: -12, r: 7, fill: C.ink }, eyes);
      svg('circle', { cx: x + 2.4, cy: -14.5, r: 2.4, fill: '#fff' }, eyes);
    });
    const eyesShut = svg('path', { d: 'M-27 -12 Q-20 -6 -13 -12 M13 -12 Q20 -6 27 -12', stroke: C.ink, 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round', opacity: 0 }, body);
    svg('ellipse', { cx: -36, cy: 6, rx: 10, ry: 6.5, fill: C.pink, opacity: .85 }, body);
    svg('ellipse', { cx: 36, cy: 6, rx: 10, ry: 6.5, fill: C.pink, opacity: .85 }, body);
    const beakShut = svg('path', { d: 'M-10 2 Q0 -4 10 2 Q0 14 -10 2 Z', fill: '#ff9f43', stroke: C.ink, 'stroke-width': 2.8, 'stroke-linejoin': 'round' }, body);
    const beakOpen = svg('g', { opacity: 0 }, body);
    svg('path', { d: 'M-11 0 Q0 -6 11 0 Q0 6 -11 0 Z', fill: '#ff9f43', stroke: C.ink, 'stroke-width': 2.8, 'stroke-linejoin': 'round' }, beakOpen);
    svg('path', { d: 'M-9 7 Q0 4 9 7 Q0 20 -9 7 Z', fill: '#ff7a59', stroke: C.ink, 'stroke-width': 2.8, 'stroke-linejoin': 'round' }, beakOpen);
    return {
      render(m, t, talking) {
        const o = m.o === undefined ? 1 : m.o;
        g.setAttribute('opacity', clamp(o));
        const hop = Math.abs(Math.sin(t * 2.2)) * 4;
        g.setAttribute('transform', `translate(${m.x.toFixed(1)} ${(m.y - hop).toFixed(1)}) scale(${(m.k * (.6 + .4 * clamp(o))).toFixed(3)})`);
        beakOpen.setAttribute('opacity', talking ? 1 : 0);
        beakShut.setAttribute('opacity', talking ? 0 : 1);
        const blink = (t % 3.9) < .14;
        eyes.setAttribute('opacity', blink ? 0 : 1);
        eyesShut.setAttribute('opacity', blink ? 1 : 0);
        const wave = m.wave || 0;
        const flap = wave * Math.sin(t * 11) * 28 + (talking ? Math.sin(t * 6) * 6 : 0);
        wingL.setAttribute('transform', `rotate(${(-flap).toFixed(1)} -46 0)`);
        wingR.setAttribute('transform', `rotate(${(flap - wave * 20).toFixed(1)} 46 0)`);
      },
    };
  }
  const MASCOT_HOME = { x: 108, y: 1002, k: .8 };

  /* ---------- 배경 장식 ---------- */
  const STAR = 'M0 -12 L3.5 -4 L12 -3.5 L5.5 2.5 L7.5 11 L0 6.5 L-7.5 11 L-5.5 2.5 L-12 -3.5 L-3.5 -4 Z';
  function makeDeco(parent, list) {
    const items = (list || [
      { x: 58, y: 150, star: 1, c: C.yellow, s: 1.6 }, { x: 1262, y: 128, r: 9, c: C.pink }, { x: 44, y: 640, star: 1, c: C.mint, s: 1.1 },
      { x: 1268, y: 600, star: 1, c: C.blue, s: 1.2 }, { x: 1262, y: 905, r: 11, c: C.yellow }, { x: 36, y: 400, r: 7, c: C.purple },
      { x: 1898, y: 122, star: 1, c: C.pink, s: .9 },
    ]).map((d, i) => {
      const g = svg('g', {}, parent);
      if (d.star) svg('path', { d: STAR, fill: d.c, stroke: C.ink, 'stroke-width': 2, transform: `scale(${d.s})` }, g);
      else svg('circle', { r: d.r, fill: d.c, stroke: C.ink, 'stroke-width': 2 }, g);
      return { ...d, g, i };
    });
    return (t, o = 1) => {
      parent.setAttribute('opacity', o.toFixed(3));
      items.forEach((d) => d.g.setAttribute('transform', `translate(${d.x} ${(d.y + Math.sin(t * 1.1 + d.i * 1.7) * 7).toFixed(1)}) rotate(${(Math.sin(t * .8 + d.i) * 12).toFixed(1)})`));
    };
  }

  /* ---------- 말풍선 자막 ---------- */
  function say(s, lt, str, at = 0) {
    if (lt < at) return;
    s.caption = { text: str, o: clamp((lt - at) / .3) };
    s.talk = lt - at;
  }

  /* ---------- 위치 고정 글자·수식 (s.lab[id] = 0..1, s.labS[id] = 크기 배율) ---------- */
  function labels(container, LABS) {
    container.innerHTML = LABS.map((l) => `<div class="lab ${l.cls || ''}" id="lab-${l.id}" style="left:${l.x}px;top:${l.y}px">${l.tex ? `<span data-tex="${esc(l.tex)}"></span>` : l.html}</div>`).join('');
    renderTexIn(container);
    paintVars(container);
    const els = LABS.map((l) => [l.id, $('lab-' + l.id)]);
    return (s) => els.forEach(([id, el]) => {
      const o = (s.lab && s.lab[id]) || 0;
      el.style.opacity = clamp(o * 1.5);
      if (o > 0) el.style.transform = `translate(-50%, -50%) scale(${((.6 + .4 * backOut(o)) * ((s.labS && s.labS[id]) || 1)).toFixed(3)})`;
    });
  }

  /* ---------- 오른쪽 공식 판 (s.board = { key, items: [0..1] }, s.bars[id] = 0..1) ---------- */
  function board(el, BOARDS) {
    let current = '';
    const itemHTML = (it) => {
      if (it.tex) return `<div class="tex${it.big ? ' big' : ''}${it.box ? ' box' : ''}"${it.fs ? ` style="font-size:${it.fs}px"` : ''} data-tex="${esc(it.tex)}"></div>`;
      if (it.bars) return `<div class="bars">${it.bars.map(([label, val, id, col]) => `<div class="bar-row"><span>${esc(label)}</span><div class="track"><i data-bar="${id}" style="background:${col}"></i><em>${esc(val)}</em></div></div>`).join('')}</div>`;
      return it.html;
    };
    return (s) => {
      if (!s.board) { el.style.opacity = 0; return; }
      el.style.opacity = 1;
      if (s.board.key !== current) {
        current = s.board.key;
        const cfg = BOARDS[current];
        el.innerHTML = `<div class="kicker">${esc(cfg.kicker)}</div>` + cfg.items.map((it) => `<div class="item">${itemHTML(it)}</div>`).join('');
        renderTexIn(el);
        paintVars(el);
      }
      el.querySelectorAll('.item').forEach((node, i) => {
        const o = s.board.items[i] || 0;
        node.style.opacity = clamp(o * 1.4);
        node.style.transform = `scale(${(.85 + .15 * backOut(o)).toFixed(3)})`;
      });
      el.querySelectorAll('[data-bar]').forEach((bar) => {
        const v = ((s.bars && s.bars[bar.dataset.bar]) || 0) * 100;
        bar.style.width = v + '%';
        // 막대가 거의 꽉 차면 글자를 막대 안쪽 끝에 둔다
        const em = bar.nextElementSibling;
        if (v > 72) { em.style.left = 'auto'; em.style.right = `calc(${100 - v}% + 14px)`; } else { em.style.right = 'auto'; em.style.left = `calc(${v}% + 12px)`; }
      });
    };
  }

  function chips(el, names) {
    el.innerHTML = names.map((c, i) => `<span>${i + 1}. ${esc(c)}</span>`).join('');
    const spans = [...el.children];
    return (chap) => spans.forEach((sp, i) => { sp.classList.toggle('on', i === chap); sp.classList.toggle('done', i < chap); });
  }

  function chapTag(el) {
    return (s) => {
      if (s.chapTag && s.chapTag.o > 0) {
        setText(el, s.chapTag.text);
        el.style.opacity = clamp(s.chapTag.o * 1.5);
        el.style.transform = `rotate(-3deg) scale(${(.5 + .5 * s.chapTag.o).toFixed(3)})`;
      } else el.style.opacity = 0;
    };
  }

  /* ---------- 내레이션(TTS) 시간 ----------
   * window.NARRATION(narration.js, narrate.py 가 생성) = { holds: [[대본시각, 멈출 초], …], lines: [{start, lead, dur}, …] } */
  function narration() {
    const NAR = root.NARRATION || { holds: [], lines: [] };
    const HOLDS = NAR.holds.slice().sort((a, b) => a[0] - b[0]);
    const HOLD_TOTAL = HOLDS.reduce((sum, [, d]) => sum + d, 0);
    const scriptTime = (V) => {
      let acc = 0;
      for (const [at, dur] of HOLDS) {
        const vs = at + acc;
        if (V < vs) break;
        if (V < vs + dur) return at;
        acc += dur;
      }
      return V - acc;
    };
    const videoTime = (S) => S + HOLDS.reduce((acc, [at, dur]) => acc + (at < S ? dur : 0), 0);
    const LINES = NAR.lines.map((l) => ({ ...l, v: videoTime(l.start) + (l.lead || 0) }));
    const talking = (V, s) => {
      if (LINES.length) {
        let cur = null;
        for (const l of LINES) { if (l.v <= V) cur = l; else break; }
        const k = cur ? V - cur.v : -1;
        return k >= 0 && k < cur.dur && Math.floor(k * 7) % 2 === 0;
      }
      return s.talk < 2.6 && Math.floor(s.talk * 7) % 2 === 0;
    };
    return { HOLDS, HOLD_TOTAL, scriptTime, videoTime, LINES, talking };
  }

  /* 자막 목록(대본 시각)과 멈춤 후보 — narrate.py 가 render.mjs --captions 로 받아 간다.
   * hold: 그 자막 구간에서 화면이 멈춰 있는(state 가 변하지 않는) 가장 늦은 시각 */
  function exportCaptions(tl, baseState) {
    root.__exportCaptions = () => {
      const out = [];
      let last = '';
      for (let k = 0; k * .02 <= tl.duration; k++) {
        const t = k * .02, c = tl.stateAt(t, baseState).caption, txt = c ? c.text : '';
        if (txt !== last) { if (txt) out.push({ text: txt, start: Number(t.toFixed(2)) }); last = txt; }
      }
      const still = (t) => { const s = tl.stateAt(t, baseState); s.caption = null; s.talk = 0; return JSON.stringify(s); };
      out.forEach((c, i) => {
        const b = (i + 1 < out.length ? out[i + 1].start : tl.duration) - .05;
        c.hold = Number(b.toFixed(2));
        for (let t = b; t >= c.start + .3; t -= .02) {
          if (still(t) === still(t + .04)) { c.hold = Number(t.toFixed(2)); break; }
        }
      });
      return { duration: tl.duration, captions: out };
    };
  }

  /* ---------- 시리즈 편 이동 (무대 밖, 영상에는 찍히지 않는다) ---------- */
  const SERIES = [
    { dir: 'ep1-mean-variance', title: '평균·편차·분산' },
    { dir: 'ep2-loss-function', title: '오차와 손실함수' },
    { dir: 'ep3-gradient-descent', title: '경사하강법' },
  ];
  /* <nav id="seriesNav" data-ep="1"> 안에 목록·이전·편 번호·다음 링크를 만든다. 경로는 편 폴더 기준 상대 경로 */
  function seriesNav(nav) {
    if (!nav) return;
    const cur = Number(nav.dataset.ep) - 1;
    const href = (i) => `../${SERIES[i].dir}/index.html`;
    const step = (i, cls, label) => (SERIES[i]
      ? `<a class="sn-btn ${cls}" href="${href(i)}" aria-label="${label}: ${i + 1}편 ${SERIES[i].title}">${cls === 'prev' ? '← ' : ''}${label}${cls === 'next' ? ' →' : ''}</a>`
      : `<span class="sn-btn ${cls}" aria-disabled="true">${cls === 'prev' ? '← ' : ''}${label}${cls === 'next' ? ' →' : ''}</span>`);
    const eps = SERIES.map((e, i) => (i === cur
      ? `<li><span class="sn-btn sn-ep" aria-current="page"><b>${i + 1}</b><span class="t">${e.title}</span><em>보는 중</em></span></li>`
      : `<li><a class="sn-btn sn-ep" href="${href(i)}" aria-label="${i + 1}편 ${e.title}"><b>${i + 1}</b><span class="t">${e.title}</span></a></li>`)).join('');
    // 마지막 편은 바로 옆의 체험활동 버튼이 다음 단계라서 '다음 편'을 두지 않는다
    const next = SERIES[cur + 1] ? step(cur + 1, 'next', '다음 편') : '';
    nav.innerHTML = `<a class="sn-btn sn-home" href="../index.html">☰ 전체 목록</a>${step(cur - 1, 'prev', '이전 편')}<ol class="sn-eps">${eps}<li><a class="sn-btn sn-act" href="${ACTIVITY}">✎ 체험활동${next ? '' : ' →'}</a></li></ol>${next}`;
  }
  const ACTIVITY = '../activity/index.html';

  /* 재생기 시작. draw(s, V, talking) 가 장면을 그린다(자막은 여기서 그린다). */
  function boot({ tl, baseState, draw }) {
    const nav = $('seriesNav');
    seriesNav(nav);
    const N = narration();
    const renderCaption = root.Motion.captionRenderer($('caption'));
    exportCaptions(tl, baseState);
    function render(V) {
      const s = tl.stateAt(N.scriptTime(V), baseState);
      draw(s, V, N.talking(V, s));
      renderCaption(s);
    }
    const audio = $('narration');
    // 재생 속도 고르기(재생 바 앞). 세 편 template 을 고치지 않도록 여기서 만든다
    const scrub = $('scrub'), speed = document.createElement('select');
    speed.id = 'speedSel';
    [[.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; o.selected = v === 1; speed.append(o); });
    const speedLab = document.createElement('label');
    speedLab.className = 'sr'; speedLab.htmlFor = 'speedSel'; speedLab.textContent = '재생 속도';
    const scrubLab = scrub.previousElementSibling && scrub.previousElementSibling.tagName === 'LABEL' ? scrub.previousElementSibling : scrub;
    scrubLab.before(speedLab, speed);
    root.Motion.player({
      stage: $('stage'), wrap: $('stageWrap'), duration: tl.duration + N.HOLD_TOTAL,
      chapters: [[0, '시작'], ...tl.chapters.map(([c, label]) => [N.videoTime(c), label])], render,
      controls: { play: $('playBtn'), restart: $('restartBtn'), select: $('chapterSel'), scrub, time: $('timeOut'), speed },
      audio: N.LINES.length && audio && audio.getAttribute('src') ? audio : null,
      reserve: () => 110 + (nav ? nav.offsetHeight + 14 : 0),
    });
    return N;
  }

  root.Kit = {
    C, backOut, popIn, pulse, rand, mix, setA, text, textWidth, tag, setRich, paintVars,
    makeKid, paintKid, placeKid, makeMascot, MASCOT_HOME, makeDeco, STAR,
    say, labels, board, chips, chapTag, narration, exportCaptions, boot,
  };
})(window);
