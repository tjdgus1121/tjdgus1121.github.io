'use strict';
/* =====================================================================
   조건부확률 → 베이즈 정리 → 나이브 베이즈 : 인터랙티브 모션 해설
   1. 데이터와 계산   2. 도구   3. 무대 크기   4. 진행 엔진
   5. 문자 카드 묶음(Deck)   6. 장면(STEPS)   7. 시작
   ===================================================================== */

/* ---------- 1. 데이터와 계산 ---------- */
const VOCAB = ['무료', '쿠폰', '당첨', '내일', '숙제'];
// [id, 스팸 여부, 문자]. 단어 목록은 문장에서 자동으로 찾는다(숫자를 손으로 맞추지 않도록).
const RAW = [
  ['S1', 1, '[무료] 쿠폰 당첨! 지금 바로 확인'],
  ['S2', 1, '무료 체험 쿠폰 지급, 오늘만 특가!'],
  ['S3', 1, '축하합니다! 경품 당첨 링크 클릭'],
  ['S4', 1, '무료 배송 할인 쿠폰 받아 가세요'],
  ['S5', 1, '대출 한도 무료 조회'],
  ['S6', 1, '이벤트 당첨 쿠폰 도착'],
  ['S7', 1, '내일 마감! 무료 상담 신청'],
  ['S8', 1, '고수익 알바 추천, 100% 보장'],
  ['N1', 0, '내일까지 수학 숙제 제출이야'],
  ['N2', 0, '내일 동아리 모임 3시!'],
  ['N3', 0, '숙제 범위 어디까지야?'],
  ['N4', 0, '도서관 무료 특강 신청했어?'],
  ['N5', 0, '내일 숙제 같이 할래?'],
  ['N6', 0, '엄마가 준 쿠폰으로 떡볶이 먹자'],
  ['N7', 0, '내일 체육복 챙겨 와'],
  ['N8', 0, '분식집 추천 좀 해 줘'],
  ['N9', 0, '과학 숙제 사진 보내 줘'],
  ['N10', 0, '내일 비 온대, 우산 챙겨'],
  ['N11', 0, '내일 시험 범위 확인했어?'],
  ['N12', 0, '숙제 다 했어? 나 아직…'],
];
const MSG = {};
for (const [id, spam, text] of RAW) MSG[id] = { id, spam: !!spam, text, words: VOCAB.filter(w => text.includes(w)) };
// 화면에 놓이는 순서(스팸과 정상이 섞이게).
const ORDER = ['N1', 'S1', 'N2', 'N3', 'S2', 'N4', 'S3', 'N5', 'N6', 'S4', 'N7', 'S5', 'N8', 'N9', 'S6', 'N10', 'S7', 'N11', 'S8', 'N12'];
const IDS = { spam: ORDER.filter(id => MSG[id].spam), ham: ORDER.filter(id => !MSG[id].spam) };
const N = { spam: IDS.spam.length, ham: IDS.ham.length, all: ORDER.length };
const has = (id, word) => MSG[id].words.includes(word);
const count = (cls, word) => IDS[cls].filter(id => has(id, word)).length;
const PRIOR = { spam: N.spam / N.all, ham: N.ham / N.all };
/** P(단어 | 분류). smooth면 라플라스 스무딩: (개수+1)/(문자 수+2) — 단어가 '있다/없다' 두 경우라서 분모에 2. */
const lik = (word, cls, smooth) => (count(cls, word) + (smooth ? 1 : 0)) / (N[cls] + (smooth ? 2 : 0));
/** 문자에 들어 있는 단어만 곱하는 입문용 나이브 베이즈. */
function classify(words, smooth = true) {
  let s = PRIOR.spam, h = PRIOR.ham;
  for (const w of new Set(words.filter(word => VOCAB.includes(word)))) { s *= lik(w, 'spam', smooth); h *= lik(w, 'ham', smooth); }
  return { s, h, post: s + h > 0 ? s / (s + h) : 0.5 };
}
const QUIZ = [
  { text: '내일 숙제 범위 알려 줘' },
  { text: '무료 쿠폰, 내일까지만 사용 가능' },
  { text: '도서관 무료 특강 내일 4시' },
].map(q => ({ ...q, words: VOCAB.filter(w => q.text.includes(w)) }));

/* ---------- 2. 도구 ---------- */
const $ = sel => document.querySelector(sel);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = ms => (REDUCE ? 0 : ms);
const wait = ms => new Promise(r => setTimeout(r, T(ms)));
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
}
const at = (e, x, y, extra) => { Object.assign(e.style, { left: `${x}px`, top: `${y}px` }, extra || {}); return e; };
/** 움직임이 끝나면 마지막 상태를 인라인 스타일로 남기고 애니메이션은 지운다(쌓이지 않게). */
function anim(e, frames, o = {}) {
  if (!e || !e.isConnected) return Promise.resolve();
  const a = e.animate(frames, { duration: T(o.duration ?? 520), delay: T(o.delay ?? 0), easing: o.easing ?? 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
  return a.finished.then(() => { if (e.isConnected) { try { a.commitStyles(); } catch (_) { /* 화면에 없는 요소 */ } } a.cancel(); }).catch(() => {});
}
const pop = (e, o = {}) => anim(e, [{ opacity: 0, transform: 'translateY(16px) scale(.97)' }, { opacity: 1, transform: 'none' }], o);
const flash = e => anim(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 420 });
function countUp(e, to, { from = 0, ms = 700, fmt = v => String(Math.round(v)) } = {}) {
  return new Promise(res => {
    if (REDUCE || ms <= 0) { e.textContent = fmt(to); res(); return; }
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / ms), v = from + (to - from) * (1 - Math.pow(1 - k, 3));
      e.textContent = fmt(v); if (k < 1) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });
}
/* ---------- 효과음(파일 없이 Web Audio로 합성) ---------- */
/**
 * 설명 움직임에 맞춰 짧고 가벼운 소리를 낸다. 브라우저 정책상 첫 클릭·키 입력 뒤에 소리가 켜진다.
 * 머리줄의 소리 단추로 끄고 켤 수 있고, 선택은 이 브라우저에만 저장된다.
 */
const Sound = {
  ctx: null, master: null, last: {},
  on: (() => { try { return localStorage.getItem('nb-sound') !== 'off'; } catch (_) { return true; } })(),
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = .55; this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },
  toggle() { this.on = !this.on; try { localStorage.setItem('nb-sound', this.on ? 'on' : 'off'); } catch (_) { /* 저장 불가 */ } if (this.on) { this.unlock(); this.play('correct'); } return this.on; },
  ready() { return this.on && this.ctx && this.ctx.state === 'running'; },
  /** 음 하나: 주파수 f에서 시작해 slide 배로 미끄러지는 짧은 소리 */
  tone(f, { at = 0, dur = .12, type = 'sine', vol = .12, slide = 1, attack = .008 } = {}) {
    const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
  },
  /** 잡음: 바람 소리(휙)나 연필 긁는 소리 */
  noise({ at = 0, dur = .3, vol = .08, from = 600, to = 2400, q = 1.2, type = 'bandpass' } = {}) {
    const c = this.ctx, t = c.currentTime + at, len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + .02);
  },
  play(name) {
    if (!this.ready()) return;
    const now = performance.now(), gap = { tick: 35, pop: 60, sparkle: 120, land: 70, fly: 90 }[name] ?? 40;
    if (now - (this.last[name] || 0) < gap) return; this.last[name] = now;
    const T0 = (f, o) => this.tone(f, o);
    switch (name) {
      case 'tick': T0(1900, { dur: .03, type: 'square', vol: .025 }); break;
      case 'pop': T0(620, { dur: .09, vol: .09, slide: 1.6 }); break;
      case 'ask': T0(880, { dur: .08, vol: .06, type: 'triangle' }); T0(1175, { at: .07, dur: .1, vol: .06, type: 'triangle' }); break;
      case 'fly': T0(420, { dur: .22, vol: .05, type: 'triangle', slide: 2.4 }); break;
      case 'land': T0(1046, { dur: .1, vol: .08, type: 'triangle' }); T0(1568, { at: .03, dur: .12, vol: .04 }); break;
      case 'sparkle': [1318, 1760, 2349].forEach((f, k) => T0(f, { at: k * .05, dur: .14, vol: .045, type: 'triangle' })); break;
      case 'stamp': T0(150, { dur: .16, vol: .22, slide: .4 }); T0(1046, { at: .06, dur: .28, vol: .07, type: 'triangle' }); T0(1568, { at: .09, dur: .3, vol: .04 }); break;
      case 'correct': [523, 659, 784, 1047].forEach((f, k) => T0(f, { at: k * .07, dur: .18, vol: .08, type: 'triangle' })); break;
      case 'wrong': T0(330, { dur: .14, vol: .07, type: 'triangle' }); T0(247, { at: .12, dur: .2, vol: .07, type: 'triangle' }); break;
      case 'whoosh': this.noise({ dur: .45, vol: .1, from: 300, to: 2600 }); T0(392, { at: .25, dur: .2, vol: .05, type: 'triangle' }); T0(523, { at: .33, dur: .2, vol: .05, type: 'triangle' }); T0(784, { at: .41, dur: .3, vol: .05, type: 'triangle' }); break;
      case 'title': T0(784, { dur: .1, vol: .04, type: 'triangle' }); T0(1175, { at: .08, dur: .16, vol: .04, type: 'triangle' }); break;
      case 'scratch': this.noise({ dur: .5, vol: .05, from: 3500, to: 2500, q: .8, type: 'highpass' }); break;
      case 'grow': T0(330, { dur: .18, vol: .06, type: 'triangle', slide: 1.5 }); break;
    }
  },
};
['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, () => { if (Sound.on) Sound.unlock(); }, { capture: true }));

/* ---------- 강조 움직임 ---------- */
/** 요소의 무대 좌표 사각형 */
function rectOf(el) {
  const r = el.getBoundingClientRect(), b = $('#stage').getBoundingClientRect();
  return { x: (r.left - b.left) / app.scale, y: (r.top - b.top) / app.scale, w: r.width / app.scale, h: r.height / app.scale };
}
/** 핵심 순간: 요소 둘레로 빛살과 고리가 퍼진다(장식 레이어에 잠깐 그렸다 지움). */
function burst(el, { color = '#ffc845', rays = 10 } = {}) {
  Sound.play('sparkle');
  if (REDUCE || !el?.isConnected) return Promise.resolve();
  const r = rectOf(el), cx = r.x + r.w / 2, cy = r.y + r.h / 2, R0 = Math.min(Math.max(r.w, r.h) / 2 + 10, 150);
  const svg = sv('svg', { class: 'fx-layer', width: 1280, height: 780, viewBox: '0 0 1280 780', 'aria-hidden': 'true' });
  const ring = sv('circle', { cx, cy, r: R0, fill: 'none', stroke: color, 'stroke-width': 5 });
  svg.append(ring);
  const lines = Array.from({ length: rays }, (_, k) => {
    const a = (k / rays) * Math.PI * 2 + 0.3, c = Math.cos(a), s = Math.sin(a);
    const l = sv('line', { x1: cx + c * (R0 + 4), y1: cy + s * (R0 + 4), x2: cx + c * (R0 + 22), y2: cy + s * (R0 + 22), stroke: k % 2 ? INK_C : color, 'stroke-width': 5, 'stroke-linecap': 'round' });
    svg.append(l); return { l, c, s };
  });
  $('#stage').append(svg);
  ring.style.transformBox = 'fill-box'; ring.style.transformOrigin = 'center';
  const jobs = [anim(ring, [{ opacity: 1, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)' })];
  for (const { l, c, s } of lines) jobs.push(anim(l, [{ opacity: 0, transform: 'translate(0,0)' }, { opacity: 1, offset: .3 }, { opacity: 0, transform: `translate(${c * 26}px, ${s * 26}px)` }], { duration: 640, easing: 'ease-out' }));
  return Promise.all(jobs).then(() => svg.remove());
}
const INK_C = '#1f2a44';
/** 도장 찍듯 크게 나타났다 제자리에 앉는다. 결론이 완성되는 순간에 쓴다. */
function stamp(el, o = {}) {
  Sound.play('stamp');
  burst(el, o);
  return anim(el, [{ opacity: 0, transform: 'scale(1.35) rotate(-4deg)' }, { opacity: 1, transform: 'scale(.96) rotate(0)', offset: .65 }, { opacity: 1, transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.9,.3,1)', ...o });
}
/** 사각형 중심에서 (tx, ty) 방향으로 나가 경계에 닿는 점 */
function edgePoint(r, tx, ty, pad = 8) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = tx - cx, dy = ty - cy;
  const k = 1 / Math.max(Math.abs(dx) / (r.w / 2 + pad), Math.abs(dy) / (r.h / 2 + pad), 1e-6);
  return [cx + dx * Math.min(k, 1), cy + dy * Math.min(k, 1)];
}
/** a에서 b로 휘어진 화살표를 그려 나간다. bend: 휘는 정도(+는 진행 방향 오른쪽). */
function arrowBetween(a, b, { bend = 0, color = INK_C, width = 3.5, dash = false, layer = FRONT(), ms = 620, delay = 0 } = {}) {
  const ra = rectOf(a), rb = rectOf(b);
  const [x1, y1] = edgePoint(ra, rb.x + rb.w / 2, rb.y + rb.h / 2), [x2, y2] = edgePoint(rb, ra.x + ra.w / 2, ra.y + ra.h / 2);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const qx = mx + (-(y2 - y1) / len) * bend, qy = my + ((x2 - x1) / len) * bend;
  const ang = Math.atan2(y2 - qy, x2 - qx), hx = Math.cos(ang), hy = Math.sin(ang);
  const svg = sv('svg', { class: 'arrow-layer', width: 1280, height: 780, viewBox: '0 0 1280 780', 'aria-hidden': 'true' });
  const path = sv('path', { d: `M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}`, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': dash ? '.02 .03' : '1 1', 'stroke-dashoffset': dash ? 0 : 1 });
  const head = sv('path', { d: `M ${x2 - hx * 16 - hy * 9} ${y2 - hy * 16 + hx * 9} L ${x2} ${y2} L ${x2 - hx * 16 + hy * 9} ${y2 - hy * 16 - hx * 9}`, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 });
  svg.append(path, head); layer.prepend(svg);
  const done = (dash ? anim(path, [{ opacity: 0 }, { opacity: 1 }], { duration: ms, delay }) : anim(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms, delay, easing: 'cubic-bezier(.6,0,.3,1)' }))
    .then(() => anim(head, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 }));
  svg.done = done; svg.mid = { x: (x1 + 2 * qx + x2) / 4, y: (y1 + 2 * qy + y2) / 4 };
  return svg;
}
/** from 요소 자리에서 조각(html)이 떠올라 포물선을 그리며 to 요소 자리로 날아간다. */
/** 조각이 from에서 떠올라 포물선을 그리며 to 자리에 내려앉는다. 내려앉은 조각(ghost)을 돌려준다. */
async function flight(from, to, { html, cls = '', ms = 760, delay = 0, lift = 70 } = {}) {
  if (!from?.isConnected || !to?.isConnected) return null;
  const a = rectOf(from), b = rectOf(to);
  const g = h('div', { class: `ghost ${cls}`, html: html ?? to.innerHTML, 'aria-hidden': 'true' });
  FRONT().append(g);
  const gw = g.offsetWidth, gh = g.offsetHeight;
  const sx = a.x + a.w / 2 - gw / 2, sy = a.y + a.h / 2 - gh / 2, ex = b.x + b.w / 2 - gw / 2, ey = b.y + b.h / 2 - gh / 2;
  at(g, sx, sy);
  const midX = (ex - sx) / 2, midY = (ey - sy) / 2 - lift;
  setTimeout(() => Sound.play('fly'), T(delay));
  setTimeout(() => Sound.play('land'), T(delay + ms * .92));
  await anim(g, [
    { transform: 'translate(0,0) scale(.6)', opacity: 0 },
    { transform: 'translate(0,0) scale(1.15)', opacity: 1, offset: .15 },
    { transform: `translate(${midX}px, ${midY}px) scale(1.1)`, opacity: 1, offset: .55 },
    { transform: `translate(${ex - sx}px, ${ey - sy}px) scale(1)`, opacity: 1 },
  ], { duration: ms, delay, easing: 'cubic-bezier(.45,0,.35,1)' });
  return g;
}
/** 날아와 내려앉은 뒤 조각은 녹아 없어지고 목표가 살짝 튄다. */
/** 내려앉은 자리에 잉크가 번지듯 얇은 고리가 퍼진다(새겨지는 느낌). */
function inkRing(el, color = '#1f2a44') {
  if (REDUCE || !el?.isConnected) return;
  const r = rectOf(el), ring = h('i', { class: 'ink-ring', 'aria-hidden': 'true' });
  at(ring, r.x - 6, r.y - 6, { width: `${r.w + 12}px`, height: `${r.h + 12}px`, borderColor: color });
  FRONT().append(ring);
  anim(ring, [{ opacity: .9, transform: 'scale(.85)' }, { opacity: 0, transform: 'scale(1.35)' }], { duration: 460, easing: 'cubic-bezier(.2,.7,.3,1)' }).then(() => ring.remove());
}
/** 조각을 꾹 눌러 찍는다: 조각은 눌리며 사라지고, 그 자리에서 같은 순간 target이 찍혀 나온다. 비는 순간이 없다. */
function press(g, target) {
  const base = g.style.transform || '';
  Sound.play('pop');
  inkRing(target);
  return Promise.all([
    anim(g, [{ opacity: 1, transform: `${base} scale(1)` }, { opacity: .9, transform: `${base} scale(.9)`, offset: .45 }, { opacity: 0, transform: `${base} scale(.82)` }], { duration: 260, easing: 'ease-in' }).then(() => g.remove()),
    target ? anim(target, [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'scale(.93)', offset: .55 }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.3,1.2,.5,1)' }) : null,
  ]);
}
/**
 * 조각이 날아가 to에 닿으면 꾹 눌러 찍힌다. reveal을 주면(아직 안 보이는 요소) 그 순간 그 요소가 찍혀 나오고,
 * 주지 않으면 조각이 to 속으로 스며들며 to가 한 번 눌린다.
 */
async function flyGhost(from, to, o = {}) {
  const g = await flight(from, to, o);
  if (!g) return;
  if (o.reveal) { await press(g, o.reveal); return; }
  const base = g.style.transform || '';
  Sound.play('pop'); inkRing(to);
  await Promise.all([
    anim(g, [{ opacity: 1, transform: `${base} scale(1)` }, { opacity: 0, transform: `${base} scale(.35)` }], { duration: 240, easing: 'ease-in' }).then(() => g.remove()),
    anim(to, [{ transform: 'none' }, { transform: 'scale(.92)', offset: .4 }, { transform: 'scale(1.06)', offset: .75 }, { transform: 'none' }], { duration: 360 }),
  ]);
}
/**
 * 빈칸(?)에 답을 채운다. 식 전체가 아니라 빈칸만 바뀐다.
 * 답 조각이 날아와 ? 를 덮으며 내려앉고, 덮인 그 자리에서 답이 꾹 찍혀 새겨진다(사라졌다 다시 뜨지 않는다).
 * 날아오는 동안 칸 너비가 답의 너비까지 부드럽게 늘어난다.
 */
async function fillSlot(slot, html, { from, ghost, cls = '', ms = 720, lift = 60 } = {}) {
  if (!slot?.isConnected) return;
  const s = app.scale, keep = slot.innerHTML;
  if (getComputedStyle(slot).display === 'inline') slot.style.display = 'inline-block';
  const w0 = slot.getBoundingClientRect().width / s;
  slot.innerHTML = html; const w1 = slot.getBoundingClientRect().width / s; slot.innerHTML = keep;
  slot.style.minWidth = `${w0}px`;
  const grow = anim(slot, [{ minWidth: `${w0}px` }, { minWidth: `${Math.max(w0, w1)}px` }], { duration: 420, delay: from ? ms * .4 : 0, easing: 'cubic-bezier(.65,0,.25,1)' });
  let g = null;
  if (from) g = await flight(from, slot, { html: ghost ?? html, cls, ms, lift });
  else {
    // 날아오는 조각이 없으면 ? 가 먼저 눌려 들어간다.
    const old = h('span', { class: 'slot-old' }); old.append(...slot.childNodes); slot.append(old);
    await anim(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 180, easing: 'ease-in' });
  }
  await grow;
  // 조각이 ? 를 덮은 상태에서 내용을 바꾸고, 조각을 누르는 순간 답이 찍혀 나온다.
  slot.innerHTML = html;
  const inner = h('span', { class: 'slot-new' }); inner.append(...slot.childNodes); slot.append(inner);
  inner.style.opacity = 0;
  if (g) await press(g, inner);
  else { Sound.play('pop'); inkRing(inner); await anim(inner, [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'scale(.93)', offset: .55 }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.3,1.2,.5,1)' }); }
  slot.style.minWidth = '';
  inner.replaceWith(...inner.childNodes);
}
/** 연필 자국: 누른 자리에 작은 동그라미를 그렸다가 지운다. */
function pencilMark(ev) {
  if (ev.pointerType === 'touch' || ev.button !== 0) return;
  Sound.play('tick');
  if (REDUCE) return;
  const p = toStage(ev), r = 15, k = Math.random() * 6;
  let d = '';
  for (let i = 0; i <= 26; i++) { const a = (i / 22) * Math.PI * 2 + k, rr = r * (1 + .12 * Math.sin(i * 1.7 + k)); d += `${i ? 'L' : 'M'} ${(p.x + Math.cos(a) * rr).toFixed(1)} ${(p.y + Math.sin(a) * rr * .8).toFixed(1)} `; }
  const svg = sv('svg', { class: 'fx-layer pencil-mark', width: 1280, height: 780, viewBox: '0 0 1280 780', 'aria-hidden': 'true' },
    sv('path', { d, fill: 'none', stroke: '#33415f', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }));
  $('#stage').append(svg);
  const path = svg.firstChild;
  anim(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 260, easing: 'ease-out' })
    .then(() => anim(svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: 120 })).then(() => svg.remove());
}
const dec = (x, d = 3) => String(Number(x.toFixed(d)));
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const sci = x => (x === 0 ? '0' : x < 0.001 ? x.toExponential(2).replace('e-', '×10⁻').replace(/⁻(\d+)/, (_, n) => '⁻' + [...n].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('')) : dec(x, 4));
// 수식 조각(HTML)
const SP = '<span class="sp">스팸</span>', HM = '<span class="hm">정상</span>';
const W = w => `<span class="wd">${w}</span>`;
const P = (a, b) => `P(${a}${b != null ? `<span class="bar">|</span>${b}` : ''})`;
const F = (n, d, cls = '') => `<span class="frac ${cls}"><span>${n}</span><span>${d}</span></span>`;
function parseAnswer(raw) {
  let s = String(raw).trim().replace(/\s/g, '').replace(/,/g, '.').replace(/[≈=]/g, '');
  if (!s) return NaN;
  let percent = false;
  if (s.endsWith('%')) { percent = true; s = s.slice(0, -1); }
  let v;
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  if (!new RegExp(`^${number}(?:/${number})?$`).test(s)) return NaN;
  if (s.includes('/')) { const [a, b] = s.split('/'); v = Number(a) / Number(b); } else v = Number(s);
  if (!Number.isFinite(v)) return NaN;
  return percent ? v / 100 : v;
}

/* ---------- 3. 무대 크기 ---------- */
const app = { i: 0, token: 0, scale: 1, visited: new Set(), completed: new Set(), waiters: {}, pending: new Set(), transitioning: false, assisting: false };
/** 그림 영역 660px + 말풍선이 피할 수 있는 여유 공간. */
const STAGE = { w: 1280, scene: 780 };
function fit() {
  const wrap = $('#stageWrap'), panel = $('.panel');
  const availW = Math.min(document.documentElement.clientWidth - 24, 1600);
  const mode = $('#viewScale')?.value || 'auto';
  const fitted = mode === 'auto' || mode === 'fit';
  let scale = fitted ? Math.min(1, (availW - 6) / STAGE.w) : Number(mode);
  // 화면 높이에 맞춰 글자를 축소하지 않는다. 작은 화면은 읽기 크기의 무대 안에서 이동한다.
  // 말풍선은 모든 화면에서 그림 안의 별도 레이어에 둔다. 그림 확대와 별개로 글자 크기를 유지한다.
  let sceneH = STAGE.scene * scale;
  const reserved = $('.topbar').offsetHeight + panel.offsetHeight + 88;
  const viewportH = Math.max(440, Math.min(sceneH, Math.max(440, Math.min(780, window.innerHeight - reserved))));
  const scrollbarW = wrap.offsetWidth - wrap.clientWidth - 6 || 20;
  if (fitted) {
    scale = Math.min(1, (availW - 6 - (sceneH > viewportH ? scrollbarW : 0)) / STAGE.w);
    sceneH = STAGE.scene * scale;
  }
  app.scale = scale;
  const w = Math.min(availW, STAGE.w * scale + 6 + (sceneH > viewportH ? scrollbarW : 0));
  wrap.style.width = `${w}px`; wrap.style.height = `${viewportH + 6}px`;
  wrap.classList.add('scrollable');
  $('#stageSpace').style.width = `${STAGE.w * scale}px`;
  $('#stageSpace').style.height = `${sceneH}px`;
  $('#stage').style.transform = `scale(${scale})`;
  const width = `${w}px`;
  panel.style.minHeight = '';
  panel.style.maxWidth = width;
  $('.model-note').style.maxWidth = width;
  $('#viewTip').textContent = fitted ? '그림을 화면 너비에 맞춥니다. 작은 글씨는 문자 자료 창에서 읽거나 100%·125%로 확대해 보세요.' : '확대한 그림 안에서 움직이거나 ‘조작 위치로 이동’을 눌러 보세요.';
  Guide.refresh();
}
const toStage = ev => { const r = $('#stage').getBoundingClientRect(); return { x: (ev.clientX - r.left) / app.scale, y: (ev.clientY - r.top) / app.scale }; };

/* ---------- 4. 진행 엔진 ---------- */
const CHAPTERS = ['시작', '조건부확률', '베이즈 정리', '나이브 베이즈', '직접 분류'];
/** 장이 바뀔 때 무대를 가로지르는 장 표지. 그 장이 답할 질문 하나를 먼저 보여 준다. */
const CHAPTER_CARD = [
  null,
  { color: '#ee6c55', q: '이미 아는 사실이 생기면, 확률은 어떻게 달라질까?' },
  { color: '#4263eb', q: '세기 쉬운 확률로, 알고 싶은 확률을 구할 수 있을까?' },
  { color: '#2aa198', q: '단어가 많아져도 20통만으로 셀 수 있을까?' },
  { color: '#ffc845', q: '만든 공식으로 새 문자를 직접 판정해 보자' },
];
async function chapterWipe(ch) {
  const card = CHAPTER_CARD[ch];
  if (!card || REDUCE) return;
  const accent = h('div', { class: 'wipe accent', style: { background: card.color } });
  const body = h('div', { class: 'wipe' },
    h('div', { class: 'wipe-inner' },
      h('span', { class: 'wipe-num', style: { background: card.color } }, String(ch)),
      h('div', null, h('p', { class: 'wipe-kicker' }, `${ch}장`), h('h2', { class: 'wipe-title' }, CHAPTERS[ch]), h('p', { class: 'wipe-q' }, card.q))));
  body.setAttribute('aria-hidden', 'true'); accent.setAttribute('aria-hidden', 'true');
  $('#stage').append(accent, body);
  Sound.play('whoosh');
  const inn = body.querySelector('.wipe-inner');
  inn.style.opacity = 0;
  const slide = (e, from, to, delay, ms = 460) => anim(e, [{ transform: `translateX(${from})` }, { transform: `translateX(${to})` }], { duration: ms, delay, easing: 'cubic-bezier(.75,0,.2,1)' });
  await Promise.all([slide(accent, '-101%', '0%', 0), slide(body, '-101%', '0%', 70)]);
  await Promise.all([
    anim(inn, [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }),
    anim(body.querySelector('.wipe-num'), [{ transform: 'scale(.2) rotate(-90deg)' }, { transform: 'scale(1.15) rotate(8deg)', offset: .7 }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.3,1.3,.5,1)' }),
  ]);
  await wait(1250);
  await Promise.all([slide(body, '0%', '101%', 0, 420), slide(accent, '0%', '101%', 80, 420)]);
  accent.remove(); body.remove();
}
/** 제목: 낱말이 차례로 솟아오르고 형광펜이 왼쪽에서 오른쪽으로 칠해진다. */
function revealTitle(text) {
  const words = text.split(' ');
  const mark = h('span', { class: 'title-mark' }, words.map((w, k) => h('span', { class: 'tw' }, w + (k < words.length - 1 ? ' ' : ''))));
  $('#title').replaceChildren(mark);
  setTimeout(() => Sound.play('title'), T(200));
  [...mark.children].forEach((w, k) => anim(w, [{ opacity: 0, transform: 'translateY(22px) rotate(3deg)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 60 + k * 55, easing: 'cubic-bezier(.2,1.2,.4,1)' }));
  anim(mark, [{ backgroundSize: '0% 13px' }, { backgroundSize: '100% 13px' }], { duration: 520, delay: 220 + words.length * 55, easing: 'cubic-bezier(.6,0,.3,1)' });
}
const BACK = () => $('#back'), FRONT = () => $('#front');
function setFeedback(msg, kind) { if (kind === 'bad' && msg) Sound.play('wrong'); const f = $('#feedback'); f.className = `feedback${kind ? ' ' + kind : ''}`; f.innerHTML = msg || ''; if (app.started) requestAnimationFrame(() => Guide.refresh()); }

/** 대상은 밝게, 나머지는 흐리게. 말풍선은 대상과 겹치지 않는 가까운 빈 자리에 둔다. */
const Guide = {
  task: null, targets: [], root: null,
  init() {
    this.holes = sv('g'); this.rings = sv('g', { class: 'guide-rings' });
    const mask = sv('mask', { id: 'guide-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1280, height: 780 },
      sv('rect', { width: 1280, height: 780, fill: 'white' }), this.holes);
    this.root = sv('svg', { id: 'guide', width: 1280, height: 780, viewBox: '0 0 1280 780', 'aria-hidden': 'true' },
      sv('defs', null, mask), sv('rect', { width: 1280, height: 780, fill: '#24324b', 'fill-opacity': '.58', mask: 'url(#guide-mask)' }), this.rings);
    $('#stage').append(this.root); this.root.hidden = true; this.root.style.display = 'none';
  },
  start(task) {
    this.task = task;
    this.blinkTargets?.forEach(e => e.classList.remove('denominator-blink'));
    this.blinkTargets = task.blink ? [task.blink()].flat().filter(Boolean) : [];
    this.blinkTargets.forEach(e => e.classList.add('denominator-blink'));
    const focus = typeof task.focus === 'function' ? task.focus() : task.focus || taskTargets(task);
    this.targets = focus ? [focus].flat().filter(Boolean) : [...$('#stage').querySelectorAll(
      task.type === 'signal' ? '#front button:not(:disabled), #front .handle, #back .clickable, #deck .pickable' : '#front .fx, #front .eq-card')];
    if (!this.targets.length && app.i === 1) this.targets = [...$('#deck').children];
    this.refresh();
    let last = '';
    const follow = () => {
      if (this.task !== task) return;
      const stamp = this.targets.filter(e=>e.isConnected).map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v)).join(',');}).join(';') + $('#task').offsetHeight;
      if (stamp !== last) { last = stamp; this.refresh(); }
      this.frame = requestAnimationFrame(follow);
    };
    cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(follow);
    Learning.render(); Learning.requestFit();
    requestAnimationFrame(() => Learning.moveTarget());
  },
  clear() {
    cancelAnimationFrame(this.frame);
    this.blinkTargets?.forEach(e => e.classList.remove('denominator-blink'));
    this.blinkTargets = [];
    document.querySelectorAll('.pointing').forEach(e => e.classList.remove('pointing'));
    this.task = null; this.targets = []; if (this.root) this.root.style.display = 'none';
    if (Learning.ready) Learning.render();
  },
  rect(el) {
    const r = el.getBoundingClientRect(), b = $('#stage').getBoundingClientRect();
    return { x: (r.left-b.left)/app.scale, y: (r.top-b.top)/app.scale, w:r.width/app.scale, h:r.height/app.scale };
  },
  refresh() {
    if (!this.root) return;
    const wrap = $('#stageWrap'), overlay = $('#questionLayer');
    overlay.style.width = `${wrap.clientWidth}px`; overlay.style.height = `${wrap.clientHeight}px`;
    overlay.style.transform = `translate(${wrap.scrollLeft}px, ${wrap.scrollTop}px)`;
    const targets = this.targets.filter(e => e.isConnected && getComputedStyle(e).display !== 'none' && e.getAttribute('visibility') !== 'hidden');
    const rects = targets.map(e => this.rect(e)).filter(r => r.w > 0 && r.h > 0);
    this.holes.replaceChildren(); this.rings.replaceChildren();
    for (const r of rects) {
      const attrs = { x:r.x-9, y:r.y-9, width:r.w+18, height:r.h+18, rx:14 };
      this.holes.append(sv('rect', { ...attrs, fill:'black' }));
      this.rings.append(sv('rect', { ...attrs, fill:'none', stroke:'#ffe49b', 'stroke-width':3 }));
    }
    this.root.style.display = this.task && rects.length ? '' : 'none';
    this.place(rects);
  },
  place(targets = []) {
    const task = $('#task');
    const wrap = $('#stageWrap'), wr = wrap.getBoundingClientRect(), base = $('#stage').getBoundingClientRect();
    const viewW = wrap.clientWidth, viewH = wrap.clientHeight, margin = 12;
    if (!viewW || !viewH) return;
    const clip = r => {
      const left = Math.max(0, r.x), top = Math.max(0, r.y);
      return { x: left, y: top, w: Math.max(0, Math.min(viewW, r.x + r.w) - left), h: Math.max(0, Math.min(viewH, r.y + r.h) - top) };
    };
    const screen = r => clip({ x: r.x * app.scale + base.left - wr.left - wrap.clientLeft, y: r.y * app.scale + base.top - wr.top - wrap.clientTop, w: r.w * app.scale, h: r.h * app.scale });
    targets = targets.map(screen).filter(r => r.w > 0 && r.h > 0);
    const obstacles = obstacleRects().map(screen).filter(r => r.w > 0 && r.h > 0);
    const overlap = (a,b) => Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    // 저울 복습은 계산·접시 왼쪽, 이야기 오른쪽의 공간을 미리 나눈다.
    const storySlot = $('#front .balance-story-slot');
    if (storySlot) {
      const slot = screen(this.rect(storySlot));
      if (slot.w >= 260 && slot.h >= 120) {
        const x = Math.max(margin, slot.x), y = Math.max(margin, slot.y);
        task.style.width = `${Math.min(slot.w, viewW - x - margin)}px`;
        task.classList.remove('wide');
        task.querySelector('.ask-bubble').style.maxHeight = `${viewH - y - margin}px`;
        task.style.left = `${x}px`; task.style.top = `${y}px`;
        const box = { x, y, w: task.offsetWidth, h: task.offsetHeight };
        task.dataset.targetOverlap = String(Math.round(targets.reduce((sum, r) => sum + overlap(box, r), 0)));
        task.dataset.conceptOverlap = String(Math.round(obstacles.reduce((sum, r) => sum + overlap(box, r), 0)));
        return;
      }
    }
    // 그림 안의 현재 보이는 영역을 기준으로 빈 자리 후보를 찾는다. 확대·이동 중에도 글자 크기는 일정하다.
    const choice = this.task?.type === 'choice';
    const collapsed = task.classList.contains('collapsed');
    const shapes = collapsed ? [[180, '']] : choice ? [[560, ''], [880, 'wide'], [viewW - 24, 'wide']] : [[490, ''], [760, 'wide'], [viewW - 24, 'wide']];
    const center = targets.length ? { x:targets.reduce((s,r)=>s+r.x+r.w/2,0)/targets.length, y:targets.reduce((s,r)=>s+r.y+r.h/2,0)/targets.length } : {x:viewW * .8,y:viewH * .8};
    task.querySelector('.ask-bubble').style.maxHeight = `${viewH - margin * 2}px`;
    let best;
    for (const [width, cls] of shapes) {
      const actualW = Math.min(width, viewW - margin * 2), wide = cls && actualW >= 680;
      task.style.width = `${actualW}px`; task.classList.toggle('wide', !!wide);
      const w = task.offsetWidth, height = task.offsetHeight;
      const maxX = Math.max(margin, viewW - w - margin), maxY = Math.max(margin, viewH - height - margin);
      const xs = [margin, maxX], ys = [margin, maxY];
      for (let x = margin; x <= maxX; x += 24) xs.push(x);
      for (let y = margin; y <= maxY; y += 24) ys.push(y);
      // 격자 사이의 작은 겹침도 피하도록 실제 개념 상자의 가장자리 후보를 더한다.
      for (const r of [...targets, ...obstacles.filter(r => r.w > 80 && r.h > 40)]) {
        xs.push(Math.max(margin, Math.min(maxX, r.x - w - 10)), Math.max(margin, Math.min(maxX, r.x + r.w + 10)));
        ys.push(Math.max(margin, Math.min(maxY, r.y - height - 10)), Math.max(margin, Math.min(maxY, r.y + r.h + 10)));
      }
      for (const y of ys) for (const x of xs) {
        const box = { x, y, w, h: height };
        const targetArea = targets.reduce((s, r) => s + overlap(box, r), 0);
        const conceptArea = obstacles.reduce((s, r) => s + overlap(box, r), 0);
        const score = targetArea * 1000 + conceptArea * 10 + Math.hypot(x + w / 2 - center.x, y + height / 2 - center.y) * 2 + (wide ? 300 : 0);
        if (!best || targetArea < best.targetArea - .1 || (Math.abs(targetArea - best.targetArea) <= .1 && (conceptArea < best.conceptArea - .1 || (Math.abs(conceptArea - best.conceptArea) <= .1 && score < best.score)))) best = { x, y, score, width: `${actualW}px`, wide, targetArea, conceptArea };
      }
    }
    if (!best) return;
    task.style.width = best.width; task.classList.toggle('wide', !!best.wide);
    task.style.left = `${best.x}px`; task.style.top = `${best.y}px`;
    task.dataset.targetOverlap = String(Math.round(best.targetArea));
    task.dataset.conceptOverlap = String(Math.round(best.conceptArea));
  },
};
/** 질문창이 피해야 할 장면 내용의 사각형(무대 좌표). 효과용 레이어·투명한 묶음 상자는 빼고, 조합 칸처럼 묶음 안 칸은 낱낱이 센다. */
function obstacleRects() {
  const els = [$('.stage-head'), ...$('#back').children, ...$('#front').children, ...$('#deck').children]
    .flatMap(e => (e.classList.contains('combo') ? [...e.children] : [e]))
    .filter(e => !e.matches('.fx-layer, .arrow-layer, .anchor, .ghost, .piece-frame, .balance-story-slot') && Number(getComputedStyle(e).opacity) > .1 && getComputedStyle(e).visibility !== 'hidden');
  return els.map(e => Guide.rect(e)).filter(r => r.w > 0 && r.h > 0);
}
function makeCtx(token) {
  return {
    alive: () => token === app.token,
    /** 무대에서 일어난 일을 과제에 알린다. 과제가 아직 기다리지 않으면 보관해 둔다. */
    signal(name, payload) {
      if (token !== app.token) return;
      const w = app.waiters[name];
      if (w) { delete app.waiters[name]; w(payload); } else app.pending.add(name);
    },
    feedback: (msg, kind = 'bad') => { if (token === app.token) setFeedback(msg, kind); },
  };
}
const waitSignal = name => new Promise(res => { if (app.pending.delete(name)) res(); else app.waiters[name] = res; });
function runTask(task, ctx) {
  return new Promise(resolve => {
    const box = $('#taskControls');
    $('#task .read-next')?.remove();
    // 새 질문이 뜨면 앞 질문의 피드백은 지운다(앞 정답 문구가 새 질문 밑에 남아 헷갈리지 않게).
    $('#taskPrompt').innerHTML = typeof task.prompt === 'function' ? task.prompt() : task.prompt; box.replaceChildren(); $('#task').classList.remove('done'); setQuestionCollapsed(false); setFeedback('');
    $('#task').dataset.type = task.type;
    $('#task').dataset.wait = task.wait || '';
    $('#task').dataset.check = task.checkId || '';
    const help = $('#taskHelp'), hintBtn = $('#hintBtn'), hintText = $('#hintText'), assist = $('#assistBtn');
    let settled = false, attempts = 0, helped = false, level = 0;
    let clues = task.hints || (task.type === 'signal' ? TASK_HELP[task.wait] || [] : []);
    if (task.type === 'input') clues = [task.hint || '분모로 정한 범위 안에서 해당하는 대상을 세어 보세요.', '분모와 분자는 같은 범위의 문자에서 셉니다.', `정답은 ${task.show || task.answer}입니다. ${task.ok || ''}`];
    if (task.type === 'choice' && !task.any) {
      const right = task.options.find(option => option.correct);
      clues = ['질문에서 비교하는 값이나 대상을 먼저 찾아보세요.', '그림·식과 보기의 설명을 하나씩 맞춰 보세요. 어떤 기준으로 세거나 비교하고 있나요?', `정답은 ‘${right.label}’입니다. ${right.msg || ''}`];
    }
    // 힌트를 차례로 열고, 학생이 요청하면 실제 장면 조작으로 풀이를 보여 준다.
    help.hidden = !clues.length; hintText.textContent = ''; assist.hidden = true; assist.disabled = false; assist.textContent = '함께 해보기';
    hintBtn.disabled = false; hintBtn.textContent = '힌트 보기';
    hintBtn.onclick = () => {
      if (settled || !ctx.alive()) return;
      helped = true;
      hintText.innerHTML = clues[Math.min(level, clues.length - 1)]; level++;
      hintBtn.textContent = level < clues.length ? '힌트 더 보기' : '풀이 다시 보기';
      if (level >= clues.length && task.type === 'signal') assist.hidden = false;
      Guide.refresh();
    };
    assist.onclick = async () => {
      if (settled || app.assisting || !ctx.alive()) return;
      helped = true; app.assisting = true; assist.disabled = true; assist.textContent = '조작 중…'; renderNav(); Learning.render();
      try { await assistTask(task, ctx); }
      catch (error) { if (ctx.alive()) { setFeedback('도움 조작을 끝내지 못했어요. 풀이대로 직접 눌러 보세요.', 'bad'); assist.disabled = false; assist.textContent = '함께 해보기'; } console.error(error); }
      finally { if (ctx.alive()) { app.assisting = false; renderNav(); Learning.render(); } }
    };
    const finish = msg => {
      if (settled || !ctx.alive()) return; settled = true;
      if (task.resultPrompt) $('#taskPrompt').innerHTML = typeof task.resultPrompt === 'function' ? task.resultPrompt() : task.resultPrompt;
      if (msg) setFeedback(msg, 'good');
      Sound.play('correct');
      Guide.clear();
      box.querySelectorAll('button, input').forEach(e => { e.disabled = true; });
      help.hidden = true;
      Learning.record(task, msg, helped, attempts); Learning.requestFit();
      if (msg) {
        setQuestionCollapsed(false); $('#task').classList.add('done'); showAsk();
        const read = h('button', { type: 'button', class: 'btn read-next' }, task.readLabel || '읽었어요 · 계속');
        read.addEventListener('click', () => { if (!ctx.alive()) return; read.disabled = true; hideAsk().then(resolve); });
        if (task.readAfterFeedback) $('#feedback').after(read); else box.append(read);
        Guide.refresh();
        requestAnimationFrame(() => read.focus({ preventScroll: true }));
      } else hideAsk().then(resolve);
    };
    if (task.type === 'action') {
      const b = h('button', { type: 'button', class: 'btn go', onclick: () => finish(task.ok) }, task.label);
      box.append(b);
    } else if (task.type === 'signal') {
      waitSignal(task.wait).then(p => finish(typeof task.ok === 'function' ? task.ok(p) : task.ok));
    } else if (task.type === 'input') {
      const id = `answer-${app.token}`;
      const input = h('input', { type: 'text', id, inputmode: 'decimal', autocomplete: 'off', placeholder: task.integer ? '숫자' : '예: 3/4 또는 0.75' });
      const check = h('button', { type: 'button', class: 'btn go' }, '확인');
      let wrong = 0;
      const submit = () => {
        let v = parseAnswer(input.value), note = '';
        if (Number.isNaN(v)) { setFeedback('숫자, 분수(예: 3/4), 퍼센트(예: 75%) 중 하나로 입력하세요.', 'bad'); return; }
        if (!task.integer && v > 1 && v <= 100) { v /= 100; note = ' (퍼센트로 읽었어요.)'; }
        if (Math.abs(v - task.answer) <= (task.tol ?? 0.011)) { finish((task.ok || '정답!') + note); return; }
        wrong++; attempts++;
        const hint = (task.hints || []).find(x => Math.abs(v - x.near) <= 0.006);
        setFeedback(hint ? hint.msg : task.hint || '다시 생각해 보세요.', 'bad');
        if (wrong >= 2 && !box.querySelector('.reveal')) box.append(h('button', { type: 'button', class: 'btn reveal', onclick: () => { helped = true; input.value = task.show; finish(`정답은 ${task.show}입니다. ${task.ok || ''}`); } }, '정답 보기'));
      };
      check.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      box.append(h('label', { for: id }, task.label || '답'), input, check);
      setTimeout(() => { if (ctx.alive()) input.focus({ preventScroll: true }); }, 60);
    } else if (task.type === 'choice') {
      for (const opt of task.options) {
        const b = h('button', { type: 'button', class: 'btn pick' }, opt.label);
        // 보기에 마우스를 올리거나 초점을 두면, 그 보기가 가리키는 식·그림의 부분이 표시된다.
        if (opt.points) {
          const on = v => () => { const els = [opt.points()].flat().filter(Boolean); els.forEach(e => e.classList.toggle('pointing', v)); };
          b.addEventListener('pointerenter', on(true)); b.addEventListener('pointerleave', on(false));
          b.addEventListener('focus', on(true)); b.addEventListener('blur', on(false));
          b.addEventListener('click', on(false));
        }
        b.addEventListener('click', () => {
          if (settled || !ctx.alive()) return;
          attempts++;
          box.querySelectorAll('.pick').forEach(x => x.classList.remove('chosen')); b.classList.add('chosen');
          if (task.any || opt.correct) finish(opt.msg); else setFeedback(opt.msg, 'bad');
        });
        box.append(b);
      }
    }
    Guide.start(task); showAsk();
  });
}
/** 말풍선(질문창)을 내보내거나 들여보낸다. 무대 밖(좁은 화면)에서도 같은 움직임. */
/** 앞선 등장·퇴장 움직임이 늦게 끝나며 반대 상태를 덮어쓰지 않도록 먼저 멈춘다. */
const stopTask = () => $('#task').getAnimations().forEach(a => a.cancel());
function setQuestionCollapsed(value) {
  $('#task').classList.toggle('collapsed', value);
  $('#questionToggle').textContent = value ? '질문 펼치기' : '그림 보기';
  $('#questionToggle').setAttribute('aria-expanded', String(!value));
  Guide.refresh();
}
function hideAsk() {
  if (!app.askShown) return Promise.resolve();
  app.askShown = false; stopTask();
  return anim($('#task'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 200, easing: 'ease-in' });
}
function showAsk() {
  Guide.refresh();
  const bob = () => anim($('.asker'), [{ transform: 'none' }, { transform: 'translateY(-10px) rotate(-4deg)' }, { transform: 'none' }], { duration: 420, easing: 'ease-out' });
  if (app.askShown) { bob(); return anim($('.ask-bubble'), [{ opacity: 0.4, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260 }); }
  app.askShown = true; bob(); stopTask(); Sound.play('ask');
  return anim($('#task'), [{ opacity: 0, transform: 'translateY(8px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' });
}
/** 이전 장면을 정리한다. 새 장면은 이것이 끝난 뒤에야 나타나므로 두 장면이 겹쳐 보이지 않는다. */
function outro(next) {
  Guide.clear();
  const jobs = [hideAsk(), anim($('.stage-head'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in' })];
  for (const layer of [BACK(), FRONT()]) for (const el of [...layer.children]) {
    el.style.pointerEvents = 'none';
    jobs.push(anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: 240, easing: 'ease-in' }).then(() => el.remove()));
  }
  if (!next.deck) jobs.push(Deck.hide());
  return Promise.all(jobs);
}
async function go(i) {
  Learning.init();
  if(app.transitioning || app.assisting || !Number.isInteger(i) || i < 0 || i >= STEPS.length)return;
  if (app.started) Learning.begin();
  app.transitioning=true;
  $('#qnext').hidden = true; $('#taskHelp').hidden = true;
  $('#taskControls').querySelectorAll('button, input').forEach(control => { control.disabled = true; });
  app.token++; const token = app.token, ctx = makeCtx(token);
  const first = !app.started; app.started = true;
  const prevI = app.i;
  app.i = i; app.waiters = {}; app.pending = new Set(); app.visited.add(i);
  const step = STEPS[i];
  Learning.save(); Learning.render();
  $('#stageWrap').scrollTo({ left: 0, top: 0 });
  // 설명 판(무대 밖)은 바로 바꾼다. 높이가 고정이라 무대 크기는 변하지 않는다.
  $('#stepCount').textContent = `${i + 1} / ${STEPS.length} · ${CHAPTERS[step.ch]}`;
  $('#narration').innerHTML = step.say;
  anim($('#narration'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120 });
  renderNav(); renderChapters();
  Deck.setPick(null);
  // 1) 퇴장
  if (!first) await outro(step);
  if (!ctx.alive()) return;
  // 앞으로 나아가며 새 장에 들어설 때만 장 표지를 보여 준다(뒤로 갈 때는 바로).
  if (!first && i > prevI && STEPS[prevI].ch !== step.ch) await chapterWipe(step.ch);
  if (!ctx.alive()) return;
  $('#taskPrompt').innerHTML = ''; $('#taskControls').replaceChildren(); setFeedback('');
  $('#taskHelp').hidden = true;
  $('#task').classList.remove('done'); $('#qnext').hidden = true;
  // 2) 제목
  $('#kicker').textContent = step.kicker; revealTitle(step.title);
  if (typeof decorate === 'function') decorate(step.ch);
  anim($('.stage-head'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  anim($('#kicker'), [{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  // 3) 장면(각 장면이 자기 등장 움직임을 마칠 때까지 기다린다) → 4) 말풍선 질문
  await step.enter(ctx);
  if(!ctx.alive())return;
  app.transitioning=false;renderNav();renderChapters(); Learning.render(); fit();
  const tasks = [...(step.tasks || [])];
  const chapterEnd = step.ch > 0 && !STEPS.slice(i + 1).some(scene => scene.ch === step.ch);
  if (chapterEnd) tasks.push(...(CHAPTER_CHECKS[step.ch] || []).map((task, k) => ({ ...task, checkId: `${step.ch}-${k}`, focus: () => [], prompt: `새 자료로 확인해요 · ${task.prompt}` })));
  for (const task of tasks) {
    if (!ctx.alive()) return;
    await runTask(task, ctx);
    if (!ctx.alive()) return;
    if (task.then) {
      app.transitioning=true;renderNav();renderChapters();
      await task.then(ctx);
      // 설명 움직임이 끝난 화면을 잠깐 보여 준 뒤 다음 질문을 띄운다.
      await wait(task.hold ?? 350);
      if(!ctx.alive())return;
      app.transitioning=false;renderNav();renderChapters(); Learning.render();
    }
  }
  if (!ctx.alive()) return;
  app.completed.add(i);
  Learning.save(); Learning.render();
  $('#taskPrompt').innerHTML = step.done || '이 단계를 마쳤어요.';
  $('#taskControls').replaceChildren(); $('#task').classList.add('done');
  setFeedback(''); Guide.clear();
  if (step.finale) { await step.finale(ctx); if (!ctx.alive()) return; }
  const qnext = $('#qnext'); qnext.textContent = i === STEPS.length - 1 ? '첫 화면 ↺' : '다음 ▶'; qnext.hidden = false;
  showAsk();
  renderNav(); renderChapters(); Learning.requestFit();
}
function renderNav() {
  const prev = $('#prev'), next = $('#next'), last = app.i === STEPS.length - 1;
  prev.disabled = app.transitioning || app.assisting || app.i === 0;
  next.disabled = app.transitioning || app.assisting || !app.completed.has(app.i);
  next.textContent = last ? '첫 화면 ↺' : '다음 ▶';
  next.classList.toggle('ready', app.completed.has(app.i));
}
function renderChapters() {
  const nav = $('#chapters'); nav.replaceChildren();
  CHAPTERS.forEach((name, c) => {
    const first = STEPS.findIndex(s => s.ch === c), current = STEPS[app.i].ch === c;
    const visited = STEPS.some((s, k) => s.ch === c && app.visited.has(k));
    const done = STEPS.every((s, k) => s.ch !== c || app.completed.has(k));
    const b = h('button', { type: 'button', class: `${current ? 'current' : ''}${done && !current ? ' done' : ''}`, disabled: app.transitioning || app.assisting || !visited || first === app.i, 'aria-current': current ? 'step' : null }, h('b', null, c), name);
    b.addEventListener('click', () => go(first));
    nav.append(b);
  });
}

/* ---------- 5. 문자 카드 묶음 ---------- */
const CW = 224, CH = 62;
const markWords = text => text.split(/(무료|쿠폰|당첨|내일|숙제)/).filter(Boolean).map(part => (VOCAB.includes(part) ? h('span', { class: 'kw', 'data-w': part }, part) : part));
/** 카드 왼쪽 위가 (vx, vy)에 오도록 배율 s를 고려한 위치. 카드는 가운데를 기준으로 커지고 작아진다. */
const cardAt = (vx, vy, s = 1) => ({ x: vx - (CW - CW * s) / 2, y: vy - (CH - CH * s) / 2, s, o: 1 });
function grid(ids, { x0 = 52, y0 = 126, cols = 5, s = 1, gx = 14, gy = 12 } = {}) {
  const out = {};
  ids.forEach((id, k) => { out[id] = cardAt(x0 + (k % cols) * (CW * s + gx), y0 + Math.floor(k / cols) * (CH * s + gy), s); });
  return out;
}
const Deck = {
  cards: {}, shown: false, onPick: null,
  init() {
    const root = $('#deck');
    for (const id of ORDER) {
      const el = h('div', { class: 'card', 'data-id': id }, h('span', { class: 'badge' }, '?'), h('p', { class: 'msg' }, markWords(MSG[id].text)));
      root.append(el);
      this.cards[id] = { el, x: 640 - CW / 2, y: 560, s: 0.6, o: 0 };
      this.paint(id);
    }
    root.addEventListener('click', e => { const card = e.target.closest('.card.pickable'); if (card && this.onPick) this.onPick(card.dataset.id); });
    root.addEventListener('keydown', e => { const card = e.target.closest('.card.pickable'); if (card && this.onPick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.onPick(card.dataset.id); } });
  },
  tf(c) { return `translate(${c.x}px, ${c.y}px) scale(${c.s})`; },
  paint(id) { const c = this.cards[id]; c.el.style.transform = this.tf(c); c.el.style.opacity = c.o; c.el.style.pointerEvents = c.o > 0.05 ? 'auto' : 'none'; },
  /** 여러 카드를 새 자리로 옮긴다. 이미 같은 자리면 거의 움직이지 않는다. */
  async to(states, { ms = 700, stagger = 0, order = ORDER } = {}) {
    const jobs = [];
    order.forEach((id, k) => {
      const st = states[id]; if (!st) return;
      const c = this.cards[id];
      const current=getComputedStyle(c.el);
      const from = { transform: current.transform, opacity: current.opacity };
      c.el.getAnimations().forEach(a => a.cancel());
      Object.assign(c, { x: st.x ?? c.x, y: st.y ?? c.y, s: st.s ?? c.s, o: st.o ?? c.o });
      this.paint(id);
      // Backwards fill keeps a delayed card at its starting position, instead of flashing its destination first.
      jobs.push(anim(c.el,[from,{transform:this.tf(c),opacity:c.o}],{duration:ms,delay:k*stagger}));
    });
    this.shown = true;
    await Promise.all(jobs);
  },
  /** 처음 나타날 때는 아래에서 흩어지듯 날아오고, 이미 보이면 제자리로 옮긴다. */
  async show(states, opts = {}) {
    if (!this.shown) {
      ORDER.forEach((id, k) => { const c = this.cards[id]; Object.assign(c, { x: 540 + (k % 5) * 12, y: 640, s: 0.55, o: 0 }); this.paint(id); });
      await this.to(states, { ms: 760, stagger: 32, ...opts });
    } else await this.to(states, { ms: 650, ...opts });
  },
  async hide() {
    if (!this.shown) return;
    this.shown = false;
    const states = {}; ORDER.forEach(id => { const c = this.cards[id]; states[id] = { x: c.x, y: c.y + 30, s: c.s * 0.9, o: 0 }; });
    await this.to(states, { ms: 320 }); this.shown = false;
    this.reset();
  },
  label(id, on) {
    const c = this.cards[id], spam = MSG[id].spam;
    c.el.classList.toggle('labeled', on); c.el.classList.toggle('spam', on && spam); c.el.classList.toggle('ham', on && !spam);
    c.el.querySelector('.badge').textContent = on ? (spam ? '! 스팸' : '✓ 정상') : '?';
  },
  labelAll(on) { ORDER.forEach(id => this.label(id, on)); },
  async flip(ids, stagger = 45) {
    await Promise.all(ids.map(async (id, k) => {
      const c = this.cards[id], base = this.tf(c);
      await wait(k * stagger);
      Sound.play('tick');
      await c.el.animate([{ transform: base }, { transform: `${base} rotateY(90deg)` }], { duration: T(170), easing: 'ease-in' }).finished.catch(() => {});
      this.label(id, true);
      await c.el.animate([{ transform: `${base} rotateY(-90deg)` }, { transform: base }], { duration: T(190), easing: 'ease-out' }).finished.catch(() => {});
    }));
  },
  async mark(words, ids = ORDER, stagger = 0) {
    for (const id of ids) {
      this.cards[id].el.querySelectorAll('.kw').forEach(k => k.classList.toggle('on', words.includes(k.dataset.w)));
      if (stagger) await wait(stagger);
    }
  },
  dim(ids) { ORDER.forEach(id => this.cards[id].el.classList.toggle('dim', ids.includes(id))); },
  focus(ids) { ORDER.forEach(id => this.cards[id].el.classList.toggle('focus', ids.includes(id))); },
  setPick(fn, ids = ORDER) {
    this.onPick = fn;
    ORDER.forEach(id => {
      const on = !!fn && ids.includes(id), el = this.cards[id].el;
      el.classList.toggle('pickable', on);
      if (on) { el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); el.setAttribute('aria-label', MSG[id].text); }
      else { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label'); }
    });
  },
  /** 카드를 글자 없는 작은 알약(스팸 = 산호색, 정상 = 청록색)으로 보이게 한다. 개수 세기 장면용. */
  tokens(on) { $('#deck').classList.toggle('tokens', on); },
  reset() { this.dim([]); this.focus([]); this.mark([]); this.tokens(false); },
};
