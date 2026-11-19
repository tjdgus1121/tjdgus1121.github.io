'use strict';
/* =====================================================================
   장면 정의. 각 장면은 enter(무대 구성) → tasks(사용자 행동을 차례로 기다림) → done.
   무대에서 일어난 일은 ctx.signal('이름')으로 과제에 알린다.
   ===================================================================== */
let R = {}; // 현재 장면이 쓰는 요소 참조(장면마다 새로 만든다)

function taskTargets(task) {
  const select = q => [...$('#stage').querySelectorAll(q)];
  switch (task.wait) {
    case 'chip': case 'all3': case 'grow1': case 'grow2': case 'rain': return R.chip;
    case 'den': case 'num': return [R.diagram, R.card];
    case 'spambox': return R.spamBox;
    case 'move1': return [R.eq1.querySelector('.term'), R.eq1.querySelector('.zone')];
    case 'move2': return [R.eq2.querySelector('.term'), R.eq2.querySelector('.zone')];
    case 'move3': return [R.eq.querySelector('.term'), R.eq.querySelector('.zone')];
    case 'below': return R.model.pHandle;
    case 'cutV': return R.model?.guides?.v;
    case 'cutH': return [R.model?.guides?.a, R.model?.guides?.b].filter(Boolean);
    case 'erased': return select('#front .erase:not(.gone)');
    case 'table': return select('#front table button:not(:disabled)');
    case 'cancel': return select('#front .denom');
    case 'weighed': return [R.chips?.[R.currentWord], R.dropZone].filter(Boolean);
    case 'smooth': return R.plus;
    case 'made': return select('#front .chip');
    case 'quiz': return select('#front .quiz-card');
  }
  if (app.i === 2 && task.type === 'input') return select('#back .cond');
  return null;
}

/* 세 번째 도움말의 ‘함께 해보기’가 실제 조작을 끝까지 재현할 때 쓰는 안내와 경로. */
const TASK_HELP = {
  chip: ['조건이라는 말을 먼저 찾으세요.', '‘무료’를 포함한 문자만 새 전체가 됩니다.', '오른쪽 위 ‘조건: 무료 포함’을 누르세요.'],
  den: ['조건 뒤의 말을 보세요.', '조건은 ‘무료’이므로 무료 원 전체가 기준입니다.', '파란 ‘무료’ 원 안을 누르세요.'],
  num: ['분자는 조건 안에 있어야 합니다.', '무료이면서 스팸인 겹친 부분을 찾으세요.', '두 원이 겹친 5통 부분을 누르세요.'],
  rain: ['먼저 조건을 적용해 보세요.', '비 온 날만 새 전체가 됩니다.', '오른쪽 위 ‘조건: 비 온 날’을 누르세요.'],
  spambox: ['이번에는 스팸 묶음 안에서 셉니다.', '스팸 8통 중 무료가 몇 통인지 보려는 단계입니다.', '왼쪽 ‘스팸 8통’ 상자를 누르세요.'],
  move1: ['분모를 없애려면 양쪽에 같은 것을 곱합니다.', 'P(무료)는 왼쪽 항에 곱해집니다.', 'P(무료) 항을 왼쪽 빈 자리로 끌거나 눌러 옮기세요.'],
  move2: ['두 번째 길도 같은 방식입니다.', '이번 분모는 P(스팸)입니다.', 'P(스팸) 항을 왼쪽 빈 자리로 끌거나 눌러 옮기세요.'],
  move3: ['알고 싶은 P(스팸|무료)를 혼자 남깁니다.', '곱해진 P(무료)를 반대편으로 보냅니다.', 'P(무료) 항을 오른쪽 빈 자리로 끌거나 눌러 옮기세요.'],
  cutV: ['세로선은 분류의 두 경우를 나눕니다.', '점선을 따라 스팸과 정상 기둥을 만드세요.', '파란 세로 점선을 누르거나 끝까지 그으세요.'],
  cutH: ['각 기둥 안에서도 무료/무료 아님을 나눕니다.', '스팸과 정상 기둥에 가로선이 하나씩 필요합니다.', '두 파란 가로 점선을 각각 누르거나 끝까지 그으세요.'],
  below: ['사전확률은 노란 손잡이로 바꿉니다.', '스팸 기둥을 충분히 좁히면 50% 아래가 됩니다.', '노란 원을 왼쪽으로 여러 번 옮기거나 ← 키를 30번 누르세요.'],
  all3: ['세 단어가 함께 있는 문자만 찾습니다.', '무료·쿠폰·당첨이 모두 든 경우를 세야 합니다.', '오른쪽 위 ‘세 단어 모두 든 문자 찾기’를 누르세요.'],
  grow1: ['단어마다 있음/없음 두 갈래입니다.', '세 단어면 2×2×2가지 조합입니다.', '오른쪽 위 ‘조합마다 칸 나누기’를 누르세요.'],
  grow2: ['단어 하나가 늘면 조합 칸은 두 배가 됩니다.', '더 많은 단어를 넣은 격자를 확인합니다.', '오른쪽 위 ‘단어를 더 늘리면?’을 누르세요.'],
  erased: ['빨간 조건은 앞 단어를 함께 세게 합니다.', '나이브 가정은 그 추가 조건을 근사해 지웁니다.', '빨간 조건 버튼 두 개를 모두 누르세요.'],
  table: ['각 단어를 두 분류에서 따로 셉니다.', '표의 세 단어를 모두 열어야 합니다.', '무료·쿠폰·당첨 버튼을 모두 누르세요.'],
  cancel: ['두 식의 분모는 같은 P(단어들)입니다.', '비교에서는 같은 분모가 순서를 바꾸지 않습니다.', '두 식 중 아무 P(단어들) 분모 하나를 누르세요. 화면이 두 분모를 함께 지웁니다.'],
  weighed: ['각 단어는 스팸과 정상 점수 양쪽에 곱해집니다.', '세 단어를 모두 올려야 변화가 보입니다.', '무료·쿠폰·당첨 칩을 모두 저울에 올리거나 누르세요.'],
  smooth: ['0이 하나면 곱 전체가 0이 됩니다.', '+1은 보지 못한 경우에 작은 여지를 줍니다.', '표 위 ‘모든 칸에 +1’을 누르세요.'],
  weather: ['하늘과 바람을 하나씩 고릅니다.', '고른 특징은 두 점수에 각각 곱해집니다.', '‘맑음’과 ‘약한 바람’을 차례로 누르세요.'],
  made: ['정상 문자에 더 자주 나온 단어를 찾으세요.', '내일과 숙제는 정상 쪽 증거입니다.', '다른 선택을 끄고 ‘내일’, ‘숙제’만 누르세요.'],
  quiz: ['단어장에 있는 단어만 계산합니다.', '스팸 점수를 두 점수의 합으로 나누고 50% 기준과 비교하세요.', QUIZ.map((q, i) => { const r = classify(q.words); return `문자 ${i + 1}: ${r.post >= .5 ? '스팸' : '정상'} (${pct(r.post)}).`; }).join(' ')],
};

const MODEL_NOTE = '<p class="note" style="position:static">이 수업의 입문용 모델은 단어장 5개 중 <b>문자에 실제로 있는 단어만</b> 곱합니다. 결과는 이 20통의 자료와 가정에서 나온 <b>모델의 확률</b>이며, 실제 사실에 대한 확실성은 아닙니다.</p>';

/** 도움말의 마지막 단계에서 실제 장면 이벤트를 통해 과제를 완성한다. */
async function assistTask(task, ctx) { // ctx는 부모의 과제 흐름과 같은 컨텍스트를 유지하기 위해 받는다.
  const click = el => { if (el && !el.disabled) el.click(); };
  const key = (el, k) => el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const byText = (root, text) => [...(root || document).querySelectorAll('button')].find(el => el.textContent.trim() === text);
  switch (task.wait) {
    case 'chip': case 'rain': case 'spambox': case 'all3': case 'grow1': case 'grow2': case 'smooth': click(R.chip || R.spamBox || R.plus); break;
    case 'den': key(R.b, 'Enter'); break;
    case 'num': key(R.lens, 'Enter'); break;
    case 'move1': click(R.eq1?.querySelector('.term')); break;
    case 'move2': click(R.eq2?.querySelector('.term')); break;
    case 'move3': click(R.eq?.querySelector('.term')); break;
    case 'cutV': key(R.model?.guides?.v, 'Enter'); break;
    case 'cutH': key(R.model?.guides?.a, 'Enter'); key(R.model?.guides?.b, 'Enter'); break;
    case 'below': for (let n = 0; n < 30; n++) key(R.model?.pHandle, 'ArrowLeft'); break;
    case 'erased': [...$('#front').querySelectorAll('.erase:not(.gone)')].forEach(click); break;
    case 'table': [...$('#front').querySelectorAll('table button:not(:disabled)')].forEach(click); break;
    case 'cancel': click($('#front').querySelector('.denom:not(:disabled)')); break;
    case 'weighed': click(R.chips?.[R.currentWord]); break;
    case 'weather': click(byText($('#front'), '맑음')); click(byText($('#front'), '약한 바람')); break;
    case 'made': {
      const chips = [...$('#front').querySelectorAll('.chip-ev')];
      chips.filter(el => el.getAttribute('aria-pressed') === 'true' && !['내일', '숙제'].includes(el.childNodes[0]?.textContent.trim())).forEach(click);
      ['내일', '숙제'].forEach(word => { const el = chips.find(c => c.childNodes[0]?.textContent.trim() === word); if (el?.getAttribute('aria-pressed') !== 'true') click(el); });
      break;
    }
    case 'quiz': [...$('#front').querySelectorAll('.quiz-card')].forEach((card, i) => {
      const verdict = classify(QUIZ[i].words).post >= .5 ? '스팸' : '정상';
      click([...card.querySelectorAll('button')].find(el => el.textContent.includes(verdict)));
    }); break;
    default: break;
  }
  return ctx;
}

/* ---------- 장면용 도구 ---------- */
const fxAt = (html, x, y, { layer = FRONT(), cls = '', size } = {}) => {
  const e = h('div', { class: `fx ${cls}`, html }); at(e, x, y, size ? { fontSize: `${size}px` } : null); layer.append(e); return e;
};
const noteAt = (html, x, y, w, cls = 'note') => { const e = h('p', { class: cls, html }); at(e, x, y, { width: `${w}px`, margin: 0 }); FRONT().append(e); return e; };
const tagAt = (html, x, y, cls = '') => { const e = h('div', { class: `tag ${cls}`, html }); at(e, x, y); FRONT().append(e); return e; };
const boxAt = (label, x, y, w, hgt, cls) => { const e = h('div', { class: `box ${cls}` }, h('span', { class: 'box-label' }, label)); at(e, x, y, { width: `${w}px`, height: `${hgt}px` }); BACK().append(e); return e; };
function phoneAt(x, y, text, sender = '알 수 없는 번호', { w, h: ph } = {}) {
  const bubble = h('div', { class: 'bubble' }, markWords(text));
  const el = h('div', { class: 'phone' }, h('div', { class: 'screen' }, h('p', { class: 'sender' }, sender), bubble));
  at(el, x, y, w ? { width: `${w}px`, height: `${ph}px` } : null); BACK().append(el); return { el, bubble };
}
const litWords = async (root, stagger = 260) => { for (const k of root.querySelectorAll('.kw')) { k.classList.add('on'); flash(k); await wait(stagger); } };
/** 사후확률 막대. 빗금 = 스팸 쪽. 가운데 선 = 50%. */
function meterAt(x, y, w) {
  const bar = h('div', { class: 'meter' }, h('i'), h('span')); at(bar, x, y, { width: `${w}px` });
  const label = h('div', { class: 'meter-label' }); at(label, x, y + 42);
  FRONT().append(bar, label);
  return {
    bar, label,
    set(post, ms = 600) {
      const fill = bar.querySelector('i'), from = parseFloat(fill.style.width) || 0;
      fill.style.width = `${post * 100}%`;
      fill.animate([{ width: `${from}%` }, { width: `${post * 100}%` }], { duration: T(ms), easing: 'cubic-bezier(.2,.8,.2,1)' });
      label.innerHTML = `스팸일 확률 <span class="sp">${pct(post)}</span> → ${post >= 0.5 ? '<b class="sp">스팸</b>으로 판정' : '<b class="hm">정상</b>으로 판정'}`;
    },
  };
}
/** 끌어다 놓기와 눌러서 놓기를 함께 지원하는 단어 조각. onDrop(이 조각, 놓인 대상 요소) */
function draggable(el, { targets, onDrop, onTap, onMiss }) {
  let start = null, dragging = false, home = null;
  el.addEventListener('pointerdown', ev => {
    if (el.disabled) return;
    start = toStage(ev); home = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }; dragging = false;
    el.setPointerCapture(ev.pointerId);
  });
  el.addEventListener('pointermove', ev => {
    if (!start) return;
    const p = toStage(ev), dx = p.x - start.x, dy = p.y - start.y;
    if (!dragging && Math.hypot(dx, dy) > 6) { dragging = true; el.classList.add('dragging'); }
    if (dragging) { el.style.left = `${home.x + dx}px`; el.style.top = `${home.y + dy}px`; targets().forEach(t => t.classList.toggle('over', hit(t, ev))); }
  });
  const hit = (t, ev) => { const r = t.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
  el.addEventListener('pointerup', ev => {
    if (!start) return;
    const wasDrag = dragging; start = null; dragging = false; el.classList.remove('dragging');
    targets().forEach(t => t.classList.remove('over'));
    if (!wasDrag) { onTap(el); return; }
    const target = targets().find(t => hit(t, ev));
    if (target) onDrop(el, target); else onMiss?.();
    // 놓인 뒤 원래 자리로 돌아간다(채워진 칸에는 복사본 내용이 들어간다).
    el.animate([{ left: el.style.left, top: el.style.top }, { left: `${home.x}px`, top: `${home.y}px` }], { duration: T(260), easing: 'ease-out' });
    el.style.left = `${home.x}px`; el.style.top = `${home.y}px`;
  });
  // 키보드(Enter/Space)로 누른 경우: 포인터 이벤트 없이 click만 온다(detail 0).
  el.addEventListener('click', ev => { if (ev.detail === 0) onTap(el); });
  el.addEventListener('pointercancel', () => { if (home) { el.style.left = `${home.x}px`; el.style.top = `${home.y}px`; } start = null; dragging = false; el.classList.remove('dragging'); });
}

/* ---------- 벡터 장식(장마다 다른 도형) ---------- */
const INK = '#1f2a44';
const PAL = { mark: '#ffc845', markSoft: '#fff0c2', spam: '#ee6c55', spamSoft: '#ffe0d6', ham: '#2aa198', hamSoft: '#d3f0eb', blue: '#4263eb', blueSoft: '#dfe6ff' };
/** 둥글게 일렁이는 덩어리. 점을 원 둘레에 놓고 이웃 점의 중간점을 지나는 곡선으로 잇는다. */
function blobPath(cx, cy, r, seed = 1) {
  const n = 8, pts = Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2, rr = r * (1 + 0.13 * Math.sin(k * 2.3 + seed) + 0.07 * Math.cos(k * 3.7 + seed * 2)); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M ${mid(pts[n - 1], pts[0]).join(' ')}`;
  pts.forEach((p, k) => { const m = mid(p, pts[(k + 1) % n]); d += ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; });
  return `${d} Z`;
}
const sparklePath = (x, y, r) => `M ${x} ${y - r} Q ${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q ${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q ${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q ${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`;
const DECOR = {
  blob: (x, y, r, fill, seed) => sv('path', { d: blobPath(x, y, r, seed), fill }),
  ring: (x, y, r, stroke) => sv('circle', { cx: x, cy: y, r, fill: 'none', stroke, 'stroke-width': 7, class: 'float-b' }),
  dashRing: (x, y, r) => sv('circle', { cx: x, cy: y, r, fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-dasharray': '2 12', 'stroke-linecap': 'round', class: 'spin' }),
  sparkle: (x, y, r, fill) => sv('path', { d: sparklePath(x, y, r), fill, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round', class: 'float-a' }),
  squiggle: (x, y, w, stroke) => { let d = `M ${x} ${y}`; for (let k = 0; k < 4; k++) d += ` q ${w / 8} -16 ${w / 4} 0`; return sv('path', { d, fill: 'none', stroke, 'stroke-width': 7, 'stroke-linecap': 'round', class: 'float-b' }); },
  plus: (x, y, s, stroke) => sv('path', { d: `M ${x - s} ${y} H ${x + s} M ${x} ${y - s} V ${y + s}`, stroke, 'stroke-width': 7, 'stroke-linecap': 'round', class: 'float-a' }),
  dots: (x, y, cols, rows) => sv('g', null, Array.from({ length: cols * rows }, (_, k) => sv('circle', { cx: x + (k % cols) * 18, cy: y + Math.floor(k / cols) * 18, r: 3.5, fill: INK }))),
  tri: (x, y, s, fill) => sv('path', { d: `M ${x} ${y - s} L ${x + s * 0.9} ${y + s * 0.6} L ${x - s * 0.9} ${y + s * 0.6} Z`, fill, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round', class: 'float-a' }),
};
// 장면 내용(가운데)과 질문창(아래)을 피해 가장자리에만 둔다.
const DECOR_SETS = [
  [['blob', 1170, 70, 175, PAL.markSoft, 1], ['blob', 40, 560, 90, PAL.spamSoft, 3], ['sparkle', 1258, 330, 18, PAL.mark], ['squiggle', 880, 92, 110, PAL.spam], ['dashRing', 1262, 560, 40], ['dots', 1170, 642, 5, 2]],
  [['blob', 1190, 50, 160, PAL.spamSoft, 2], ['ring', 1262, 600, 24, PAL.spam], ['plus', 1258, 200, 10, PAL.mark], ['dots', 1170, 646, 5, 2], ['sparkle', 1262, 130, 16, PAL.mark]],
  [['blob', 1180, 60, 170, PAL.blueSoft, 4], ['tri', 1262, 330, 20, PAL.mark], ['squiggle', 6, 646, 80, PAL.blue], ['dashRing', 1262, 600, 34], ['sparkle', 1100, 96, 18, PAL.blue]],
  [['blob', 1180, 60, 170, PAL.hamSoft, 5], ['ring', 22, 626, 24, PAL.ham], ['plus', 1262, 420, 10, PAL.spam], ['dots', 1170, 646, 5, 2], ['sparkle', 1262, 130, 16, PAL.mark]],
  [['blob', 1170, 70, 175, PAL.markSoft, 6], ['blob', 1268, 650, 70, PAL.hamSoft, 7], ['sparkle', 1100, 100, 22, PAL.spam], ['sparkle', 22, 626, 16, PAL.mark], ['squiggle', 900, 92, 110, PAL.ham]],
];
let decorChapter = -1;
/** 장이 바뀔 때만 배경 도형을 새로 깐다(같은 장 안에서는 그대로 두어 이어지는 느낌). */
function decorate(ch) {
  if (ch === decorChapter) return;
  decorChapter = ch;
  const layer = $('#decor');
  for (const old of [...layer.children]) anim(old, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).then(() => old.remove());
  const svg = sv('svg', { width: 1280, height: 820, viewBox: '0 0 1280 820', style: 'position:absolute;left:0;top:0;overflow:visible' });
  DECOR_SETS[ch].forEach(([kind, ...args], k) => {
    const shape = DECOR[kind](...args);
    const wrap = sv('g'); wrap.append(shape); svg.append(wrap);
    wrap.style.transformBox = 'fill-box'; wrap.style.transformOrigin = 'center';
  });
  layer.append(svg);
  [...svg.children].forEach((wrap, k) => anim(wrap, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 80 * k, easing: 'cubic-bezier(.3,1.4,.5,1)' }));
}

/* ---------- 아이콘 일러스트(도입 장면) ---------- */
const ICONS = {
  envelope: '<rect x="4" y="10" width="76" height="54" rx="9" fill="#fffdf8" stroke="#1f2a44" stroke-width="4"/><path d="M8 16 L42 42 L76 16" fill="none" stroke="#1f2a44" stroke-width="4" stroke-linejoin="round"/><circle cx="74" cy="12" r="11" fill="#ee6c55" stroke="#1f2a44" stroke-width="3.5"/><text x="74" y="17" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">!</text>',
  warning: '<path d="M42 6 L80 72 H4 Z" fill="#ffc845" stroke="#1f2a44" stroke-width="4" stroke-linejoin="round"/><rect x="38.5" y="28" width="7" height="24" rx="3.5" fill="#1f2a44"/><circle cx="42" cy="61" r="4.2" fill="#1f2a44"/>',
  coupon: '<path d="M6 16 H78 V30 A8 8 0 0 0 78 46 V60 H6 V46 A8 8 0 0 0 6 30 Z" fill="#ffe0d6" stroke="#1f2a44" stroke-width="4" stroke-linejoin="round"/><path d="M30 18 V58" stroke="#1f2a44" stroke-width="3" stroke-dasharray="4 5"/><text x="55" y="45" text-anchor="middle" font-size="22" font-weight="900" fill="#b8392a">%</text>',
  gift: '<rect x="10" y="30" width="64" height="44" rx="6" fill="#2aa198" stroke="#1f2a44" stroke-width="4"/><rect x="6" y="20" width="72" height="16" rx="5" fill="#d3f0eb" stroke="#1f2a44" stroke-width="4"/><path d="M42 20 V74" stroke="#1f2a44" stroke-width="4"/><path d="M42 20 C30 4 18 14 30 20 M42 20 C54 4 66 14 54 20" fill="#ffc845" stroke="#1f2a44" stroke-width="3.5" stroke-linejoin="round"/>',
  sparkle: `<path d="${sparklePath(42, 42, 34)}" fill="#ffc845" stroke="#1f2a44" stroke-width="4" stroke-linejoin="round"/>`,
};
function iconAt(name, x, y, size = 84, cls = 'float-a') {
  const svg = sv('svg', { width: size, height: size, viewBox: '0 0 84 84', 'aria-hidden': 'true', class: cls });
  svg.innerHTML = ICONS[name]; at(svg, x, y, { position: 'absolute' });
  BACK().append(svg); return svg;
}

/* ---------- 저울 ---------- */
function balanceAt(x, y, labels = ['! 스팸 점수', '✓ 정상 점수']) {
  const svg = sv('svg', { width: 720, height: 400, viewBox: '0 0 720 400', 'aria-hidden': 'true' });
  at(svg, x, y, { position: 'absolute', overflow: 'visible' });
  svg.append(sv('ellipse', { cx: 360, cy: 374, rx: 170, ry: 11, fill: '#1f2a44', 'fill-opacity': 0.14 }), sv('rect', { x: 347, y: 104, width: 26, height: 250, rx: 6, fill: '#1f2a44' }), sv('rect', { x: 240, y: 346, width: 240, height: 22, rx: 9, fill: '#1f2a44' }));
  const beam = sv('g');
  beam.append(sv('rect', { x: 90, y: 96, width: 540, height: 16, rx: 8, fill: '#33415f' }));
  const pans = ['spam', 'ham'].map(cls => {
    const color = cls === 'spam' ? '#b8392a' : '#17665f', g = sv('g');
    g.append(
      sv('line', { x1: 0, y1: 0, x2: -78, y2: 112, stroke: '#1f2a44', 'stroke-width': 2 }),
      sv('line', { x1: 0, y1: 0, x2: 78, y2: 112, stroke: '#1f2a44', 'stroke-width': 2 }),
      sv('path', { d: 'M -100 112 Q 0 160 100 112 Z', fill: cls === 'spam' ? '#ffe0d6' : '#d3f0eb', stroke: '#1f2a44', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    );
    const tokens = sv('g'), title = sv('text', { x: 0, y: 186, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, fill: color }, cls === 'spam' ? labels[0] : labels[1]);
    const value = sv('text', { x: 0, y: 214, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 800, fill: '#1f2a44' });
    g.append(tokens, title, value); svg.append(g);
    return { g, tokens, title, value, n: 0, color };
  });
  svg.append(beam, sv('circle', { cx: 360, cy: 104, r: 13, fill: '#ffc845', stroke: '#1f2a44', 'stroke-width': 4 }));
  FRONT().append(svg);
  let angle = 0, raf = 0;
  const layout = a => {
    const rad = a * Math.PI / 180;
    beam.setAttribute('transform', `rotate(${a} 360 104)`);
    [-260, 260].forEach((dx, k) => pans[k].g.setAttribute('transform', `translate(${360 + dx * Math.cos(rad)} ${104 + dx * Math.sin(rad)})`));
  };
  layout(0);
  const api = {
    svg, pans,
    /** 점수 비율로 기울기를 정한다. 오른쪽(정상)이 무거우면 시계 방향(+). */
    weigh(s, hh) {
      const target = hh === 0 && s === 0 ? 0 : hh === 0 ? -24 : s === 0 ? 24 : Math.max(-24, Math.min(24, 14 * Math.log10(hh / s)));
      pans[0].value.textContent = sci(s); pans[1].value.textContent = sci(hh);
      pans[1].value.setAttribute('fill', hh === 0 ? '#c63a2f' : '#1f2a44');
      cancelAnimationFrame(raf);
      const from = angle, t0 = performance.now(), ms = T(1100);
      const back = k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
      const tick = now => { const k = ms ? Math.min(1, (now - t0) / ms) : 1; angle = from + (target - from) * back(k); layout(angle); if (k < 1) raf = requestAnimationFrame(tick); else { angle = target; layout(angle); } };
      raf = requestAnimationFrame(tick);
    },
    /** 쌓인 추를 모두 내린다. */
    clear() { pans.forEach(p => { p.tokens.replaceChildren(); p.n = 0; }); },
    /** 접시 위에 추(글자가 적힌 블록)를 하나 쌓는다. 블록이 줄을 가려 글자가 겹치지 않는다. */
    token(k, text) {
      const p = pans[k], y = 90 - p.n * 24, t = sv('g');
      t.append(sv('rect', { x: -42, y, width: 84, height: 22, rx: 6, fill: '#fffdf8', stroke: p.color, 'stroke-width': 2.5 }),
        sv('text', { x: 0, y: y + 16.5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 900, fill: p.color }, text));
      p.tokens.append(t); p.n++;
      anim(t, [{ opacity: 0, transform: 'translateY(-90px)' }, { opacity: 1, transform: 'translateY(4px)', offset: .8 }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.5,0,.6,1)' });
    },
  };
  return api;
}

/* ---------- 넓이 모델: 빈 도화지(넓이 1)에 연필로 선을 그어 나눈다 ---------- */
/** 연필 그림(끝이 (0,0)). 선을 그을 때 끝을 따라 움직인다. */
function pencilIcon() {
  const g = sv('g', { class: 'pencil-icon', 'pointer-events': 'none', opacity: 0 });
  g.innerHTML = '<g transform="translate(-4.5 -43.5) scale(1.5)"><g stroke="#1f2a44" stroke-width="1.6" stroke-linejoin="round">'
    + '<path d="M8 20 L24 4 L28 8 L12 24 Z" fill="#ffc845"/><path d="M24 4 L26 2 Q27.5 1 29 2.5 L29.5 3 Q31 4.5 30 6 L28 8 Z" fill="#f6a6b2"/>'
    + '<path d="M8 20 L12 24 L3 29 Z" fill="#f3d3a5"/></g><path d="M3 29 L5.8 27.4 L4.6 26.2 Z" fill="#1f2a44"/></g>';
  return g;
}
const fmtP = (v, exact, txt) => (Math.abs(v - exact) < 1e-9 ? txt : pct(v, 0));
/**
 * 전체 넓이 1인 도화지.
 *   세로선(가로 길이) = P(스팸) : P(정상)
 *   각 기둥 안의 가로선(세로 길이) = P(무료|스팸), P(무료|정상)
 *   조각 넓이 = 가로 × 세로 = P(스팸 ∩ 무료) 같은 결합확률(곱셈 규칙). 네 조각의 합 = 1
 * phase: blank → width → height → prior → free
 */
function areaModel(x, y, ctx, onChange) {
  const Wd = 600, Ht = 320, ox = 20, oy = 70;
  const st = { p: PRIOR.spam, a: lik('무료', 'spam'), b: lik('무료', 'ham') };
  const show = { cols: false, v: false, a: false, b: false };
  let mode = 'blank';
  const svg = sv('svg', { width: 640, height: 450, viewBox: '0 0 640 450', role: 'group', 'aria-label': '넓이 1인 도화지를 선으로 나누는 넓이 모델' });
  at(svg, x, y, { position: 'absolute', overflow: 'visible' });
  const defs = sv('defs');
  defs.innerHTML = '<pattern id="stripe" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#ee6c55"/><rect width="4" height="10" fill="#f58a76"/></pattern>'
    + '<pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#2aa198"/><circle cx="6" cy="6" r="2.4" fill="#17665f"/></pattern>';
  const paper = sv('rect', { x: ox, y: oy, width: Wd, height: Ht, fill: '#fffdf8' });
  const spamCol = sv('rect', { y: oy, height: Ht, fill: '#ffe0d6', opacity: 0 }), hamCol = sv('rect', { y: oy, height: Ht, fill: '#d3f0eb', opacity: 0 });
  const spamShade = sv('rect', { fill: 'url(#stripe)', opacity: 0 }), hamShade = sv('rect', { fill: 'url(#dots)', opacity: 0 });
  const frame = sv('rect', { x: ox, y: oy, width: Wd, height: Ht, fill: 'none', stroke: '#1f2a44', 'stroke-width': 3 });
  const ink = () => sv('path', { fill: 'none', stroke: '#1f2a44', 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0 });
  const cutV = ink(), cutA = ink(), cutB = ink();
  const text = (size, fill, anchor = 'middle', weight = 800) => sv('text', { 'font-size': size, 'font-weight': weight, fill, 'text-anchor': anchor, 'paint-order': 'stroke', stroke: '#fffdf8', 'stroke-width': 5, 'pointer-events': 'none' });
  // 기둥 머리: 가로 길이 = 사전확률(괄호 모양 선 + 식)
  const brace = color => sv('path', { fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0 });
  const braceS = brace('#b8392a'), braceH = brace('#17665f');
  const headS = text(18, '#b8392a'), headH = text(18, '#17665f');
  headS.setAttribute('opacity', 0); headH.setAttribute('opacity', 0);
  // 가로선 이름표: 세로 길이 = 가능도
  const pill = color => { const g = sv('g', { opacity: 0, 'pointer-events': 'none' }); g.append(sv('rect', { height: 26, rx: 13, fill: '#fffdf8', stroke: color, 'stroke-width': 2.5 }), sv('text', { 'font-size': 15, 'font-weight': 900, fill: color, 'text-anchor': 'middle' })); return g; };
  const pillA = pill('#b8392a'), pillB = pill('#17665f');
  // 네 조각 이름표: 넓이 = 가로 × 세로
  const region = color => { const t = text(15, color); t.setAttribute('opacity', 0); t.append(sv('tspan', { 'font-weight': 900 }), sv('tspan', { 'font-weight': 700 })); return t; };
  const rSA = region('#7a2416'), rSN = region('#b8392a'), rHA = region('#0f4f49'), rHN = region('#17665f');
  const caption = sv('text', { x: ox, y: oy + Ht + 34, 'font-size': 17, 'font-weight': 800, fill: '#33415f' }, '도화지 전체의 넓이 = 1 (문자 20통 전체)');
  // 연필로 따라 그을 점선 안내(누르거나 끌어서 긋는다)
  const guide = label => {
    const g = sv('g', { class: 'cut-guide', tabindex: -1, role: 'button', 'aria-label': label });
    g.append(sv('path', { class: 'cut-dots', fill: 'none', stroke: '#4263eb', 'stroke-width': 3, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round' }),
      sv('rect', { class: 'cut-hit', fill: 'transparent' }));
    g.style.display = 'none';
    return g;
  };
  const gV = guide('세로선 긋기: 스팸과 정상으로 나누기'), gA = guide('스팸 기둥에 가로선 긋기'), gB = guide('정상 기둥에 가로선 긋기');
  const pen = pencilIcon();
  const mkHandle = (label, shape) => { const g = sv('g', { class: 'handle', tabindex: 0, role: 'slider', 'aria-label': label, 'aria-valuemin': 2, 'aria-valuemax': 98 }); g.append(shape); return g; };
  const pHandle = mkHandle('사전확률 P(스팸)', sv('circle', { r: 15, fill: '#ffc845', stroke: '#1f2a44', 'stroke-width': 3 }));
  const aHandle = mkHandle('가능도 P(무료|스팸)', sv('rect', { height: 12, rx: 6, fill: '#fff', stroke: '#b8392a', 'stroke-width': 3 }));
  const bHandle = mkHandle('P(무료|정상)', sv('rect', { height: 12, rx: 6, fill: '#fff', stroke: '#17665f', 'stroke-width': 3 }));
  svg.append(defs, paper, spamCol, hamCol, spamShade, hamShade, frame, cutV, cutA, cutB, braceS, braceH, headS, headH,
    rSA, rSN, rHA, rHN, pillA, pillB, caption, gV, gA, gB, aHandle, bHandle, pHandle, pen);
  FRONT().append(svg);
  const geo = () => { const pw = st.p * Wd, ah = st.a * Ht, bh = st.b * Ht; return { pw, ah, bh, xv: ox + pw, ya: oy + Ht - ah, yb: oy + Ht - bh }; };
  const segs = {
    v: () => { const g = geo(); return [[g.xv, oy], [g.xv, oy + Ht]]; },
    a: () => { const g = geo(); return [[ox, g.ya], [g.xv, g.ya]]; },
    b: () => { const g = geo(); return [[g.xv, g.yb], [ox + Wd, g.yb]]; },
  };
  const lines = { v: cutV, a: cutA, b: cutB }, guides = { v: gV, a: gA, b: gB };
  const setText = (t, x0, y0, s) => { t.setAttribute('x', x0); t.setAttribute('y', y0); t.textContent = s; };
  const setRegion = (t, x0, y0, title, formula, visible) => {
    t.setAttribute('x', x0); t.setAttribute('y', y0);
    const [a, b] = t.children; a.textContent = title; b.textContent = formula; a.setAttribute('x', x0); b.setAttribute('x', x0); b.setAttribute('dy', 19);
    t.style.visibility = visible ? '' : 'hidden';
  };
  const draw = () => {
    const { pw, ah, bh, xv, ya, yb } = geo(), hw = Wd - pw;
    spamCol.setAttribute('x', ox); spamCol.setAttribute('width', pw); hamCol.setAttribute('x', xv); hamCol.setAttribute('width', hw);
    Object.entries({ x: ox, y: ya, width: pw, height: ah }).forEach(([k, v]) => spamShade.setAttribute(k, v));
    Object.entries({ x: xv, y: yb, width: hw, height: bh }).forEach(([k, v]) => hamShade.setAttribute(k, v));
    for (const [k, l] of Object.entries(lines)) { const [[x1, y1], [x2, y2]] = segs[k](); if (l.dataset.full) l.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`); }
    for (const [k, g] of Object.entries(guides)) {
      const [[x1, y1], [x2, y2]] = segs[k](), pad = 18;
      g.querySelector('.cut-dots').setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
      Object.entries({ x: Math.min(x1, x2) - pad, y: Math.min(y1, y2) - pad, width: Math.abs(x2 - x1) + pad * 2, height: Math.abs(y2 - y1) + pad * 2 }).forEach(([a, v]) => g.querySelector('.cut-hit').setAttribute(a, v));
    }
    // 머리: 괄호 + P(스팸) = 8/20
    braceS.setAttribute('d', `M ${ox + 3} ${oy - 6} V ${oy - 14} H ${xv - 3} V ${oy - 6}`);
    braceH.setAttribute('d', `M ${xv + 3} ${oy - 6} V ${oy - 14} H ${ox + Wd - 3} V ${oy - 6}`);
    setText(headS, ox + pw / 2, oy - 24, pw > 150 ? `P(스팸) = ${fmtP(st.p, PRIOR.spam, '8/20')}` : pw > 60 ? fmtP(st.p, PRIOR.spam, '8/20') : '');
    setText(headH, xv + hw / 2, oy - 24, hw > 150 ? `P(정상) = ${fmtP(1 - st.p, PRIOR.ham, '12/20')}` : fmtP(1 - st.p, PRIOR.ham, '12/20'));
    // 가로선 이름표
    const putPill = (g, cx, cy, s, maxW) => { const [r, t] = g.children; t.textContent = s; const w = Math.min(maxW, s.length * 8.6 + 22); r.setAttribute('x', cx - w / 2); r.setAttribute('y', cy - 13); r.setAttribute('width', w); t.setAttribute('x', cx); t.setAttribute('y', cy + 5); g.style.visibility = maxW > 120 ? '' : 'hidden'; };
    putPill(pillA, ox + pw / 2, ya - 18, `P(무료|스팸) = ${fmtP(st.a, lik('무료', 'spam'), '5/8')}`, pw - 16);
    putPill(pillB, xv + hw / 2, yb - 18, `P(무료|정상) = ${fmtP(st.b, lik('무료', 'ham'), '1/12')}`, hw - 16);
    // 네 조각: 넓이 = 가로 × 세로
    const pS = fmtP(st.p, PRIOR.spam, '0.4'), pH = fmtP(1 - st.p, PRIOR.ham, '0.6');
    const exact = Math.abs(st.p - PRIOR.spam) + Math.abs(st.a - lik('무료', 'spam')) + Math.abs(st.b - lik('무료', 'ham')) < 1e-9;
    const vSA = st.p * st.a, vSN = st.p * (1 - st.a), vHA = (1 - st.p) * st.b, vHN = (1 - st.p) * (1 - st.b);
    const nice = v => (exact ? dec(v, 2) : pct(v, 0));
    setRegion(rSA, ox + pw / 2, ya + Math.max(30, ah / 2 + 2), '스팸 ∩ 무료', `${pS} × ${fmtP(st.a, lik('무료', 'spam'), '5/8')} = ${nice(vSA)}`, pw > 150 && ah > 56);
    setRegion(rSN, ox + pw / 2, oy + (Ht - ah) / 2, '스팸 ∩ 무료 아님', `${pS} × ${fmtP(1 - st.a, 1 - lik('무료', 'spam'), '3/8')} = ${nice(vSN)}`, pw > 150 && Ht - ah > 70);
    setRegion(rHN, xv + hw / 2, oy + (Ht - bh) / 2 - 6, '정상 ∩ 무료 아님', `${pH} × ${fmtP(1 - st.b, 1 - lik('무료', 'ham'), '11/12')} = ${nice(vHN)}`, hw > 170 && Ht - bh > 70);
    setRegion(rHA, xv + hw / 2, yb - (bh > 56 ? -bh / 2 - 2 : 66), '정상 ∩ 무료 ↓', `${pH} × ${fmtP(st.b, lik('무료', 'ham'), '1/12')} = ${nice(vHA)}`, hw > 170);
    if (show.sum) caption.textContent = exact ? '네 조각의 합: 0.25 + 0.15 + 0.05 + 0.55 = 1 ✓' : '네 조각의 합 = 1 ✓ (선을 옮겨도 언제나 1)';
    // 손잡이
    pHandle.setAttribute('transform', `translate(${xv} ${oy - 14})`);
    aHandle.firstChild.setAttribute('width', Math.max(20, pw - 24)); aHandle.setAttribute('transform', `translate(${ox + 12} ${ya - 6})`);
    bHandle.firstChild.setAttribute('width', Math.max(20, hw - 24)); bHandle.setAttribute('transform', `translate(${xv + 12} ${yb - 6})`);
    [[pHandle, st.p], [aHandle, st.a], [bHandle, st.b]].forEach(([g, v]) => { g.setAttribute('aria-valuenow', Math.round(v * 100)); g.setAttribute('aria-valuetext', pct(v, 0)); });
    onChange(st);
  };
  /** 선 하나를 연필로 긋는다. 점선을 따라 끌면 손을 따라 그어지고, 누르기만 하면(또는 Enter) 끝까지 저절로 그어진다. */
  const cut = key => new Promise(resolve => {
    const g = guides[key], line = lines[key];
    let t = 0, dragging = false, finishing = false;
    const paint = k => {
      const [[x1, y1], [x2, y2]] = segs[key](), xe = x1 + (x2 - x1) * k, ye = y1 + (y2 - y1) * k;
      line.setAttribute('d', `M ${x1} ${y1} L ${xe} ${ye}`); line.setAttribute('opacity', 1);
      pen.setAttribute('transform', `translate(${xe} ${ye})`); pen.setAttribute('opacity', k < 1 ? 1 : 0);
    };
    const project = ev => { const p = toStage(ev), [[x1, y1], [x2, y2]] = segs[key](), lx = p.x - x - x1, ly = p.y - y - y1, dx = x2 - x1, dy = y2 - y1; return Math.max(0, Math.min(1, (lx * dx + ly * dy) / (dx * dx + dy * dy))); };
    const complete = () => {
      if (finishing) return; finishing = true; if (!dragging) Sound.play('scratch');
      g.style.display = 'none'; g.setAttribute('tabindex', -1);
      const from = t, ms = T(700 * (1 - from) + 120), t0 = performance.now();
      const tick = now => { const k = ms ? Math.min(1, (now - t0) / ms) : 1, e = from + (1 - from) * (1 - Math.pow(1 - k, 2)); paint(e); if (k < 1) requestAnimationFrame(tick); else { line.dataset.full = '1'; paint(1); draw(); resolve(); } };
      requestAnimationFrame(tick);
    };
    g.style.display = ''; g.setAttribute('tabindex', 0);
    g.addEventListener('pointerdown', ev => { if (finishing) return; Sound.play('scratch'); dragging = true; g.setPointerCapture(ev.pointerId); t = Math.max(t, project(ev) * .3); paint(t); });
    g.addEventListener('pointermove', ev => { if (!dragging) return; t = Math.max(t, project(ev)); paint(t); if (t > .97) complete(); });
    const end = () => { if (dragging) { dragging = false; complete(); } };
    g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); complete(); } });
    anim(g.querySelector('.cut-dots'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    pen.setAttribute('opacity', 0);
  });
  const clamp = v => Math.max(0.02, Math.min(0.98, v));
  const bind = (g, key, fromPoint) => {
    let active = false;
    g.addEventListener('pointerdown', ev => { if (g.getAttribute('aria-disabled') === 'true') return; active = true; g.setPointerCapture(ev.pointerId); g.style.cursor = 'grabbing'; });
    g.addEventListener('pointermove', ev => { if (!active) return; const p = toStage(ev); st[key] = clamp(fromPoint(p.x - x - ox, p.y - y - oy)); draw(); });
    const stop = () => { active = false; g.style.cursor = ''; };
    g.addEventListener('pointerup', stop); g.addEventListener('pointercancel', stop);
    g.addEventListener('keydown', ev => {
      if (g.getAttribute('aria-disabled') === 'true') return;
      const step = ev.key.startsWith('Page') ? 0.1 : 0.01, dir = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[ev.key];
      if (!dir) return; ev.preventDefault(); st[key] = Number(clamp(st[key] + dir * step).toFixed(6)); draw();
    });
  };
  bind(pHandle, 'p', lx => lx / Wd);
  bind(aHandle, 'a', (_, ly) => (Ht - ly) / Ht);
  bind(bHandle, 'b', (_, ly) => (Ht - ly) / Ht);
  const fadeIn = (els, o = {}) => Promise.all([els].flat().map((e, k) => { e.setAttribute('opacity', 1); return anim(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: (o.delay ?? 0) + k * (o.stagger ?? 0) }); }));
  const api = {
    svg, st, draw, pHandle, aHandle, bHandle, spamShade, hamShade, guides, caption,
    get mode() { return mode; },
    cut,
    /** 세로선을 그은 뒤: 두 기둥이 칠해지고 머리에 P(스팸), P(정상)이 붙는다. */
    async afterV() {
      show.cols = true;
      spamCol.setAttribute('opacity', 1); hamCol.setAttribute('opacity', 1);
      [spamCol, hamCol].forEach(e => { e.style.transformBox = 'fill-box'; });
      spamCol.style.transformOrigin = 'right'; hamCol.style.transformOrigin = 'left';
      await Promise.all([anim(spamCol, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.65,0,.25,1)' }), anim(hamCol, [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 520, delay: 90, easing: 'cubic-bezier(.65,0,.25,1)' })]);
      await fadeIn([braceS, headS, braceH, headH], { stagger: 120 });
      burst(headS, { color: '#ee6c55', rays: 8 });
    },
    /** 가로선을 그은 뒤: 그 기둥의 ‘무료’ 부분이 바닥부터 차오르고, 선 이름표와 두 조각의 넓이 식이 붙는다. */
    async afterH(key) {
      const [shade, pillEl, regs] = key === 'a' ? [spamShade, pillA, [rSA, rSN]] : [hamShade, pillB, [rHA, rHN]];
      shade.setAttribute('opacity', .82); shade.style.transformBox = 'fill-box'; shade.style.transformOrigin = 'bottom';
      await anim(shade, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.3,1.2,.5,1)' });
      await fadeIn(pillEl);
      await fadeIn(regs, { stagger: 180 });
    },
    /** 네 조각의 합 = 1 을 도장으로 */
    async sumCheck() {
      show.sum = true; draw();
      await stamp(caption, { color: '#2aa198' });
    },
    phase(m) {
      mode = m;
      for (const [g, on] of [[pHandle, m === 'prior' || m === 'free'], [aHandle, m === 'free'], [bHandle, m === 'free']]) {
        g.setAttribute('aria-disabled', String(!on)); g.setAttribute('tabindex', on ? 0 : -1);
        g.style.display = ['prior', 'free'].includes(m) ? '' : 'none';
        g.style.opacity = on ? '1' : '.35';
      }
      draw();
    },
  };
  api.phase('blank');
  return api;
}

/**
 * 베이즈 정리의 분모가 하는 일을 넓이로 보여 준다.
 * 1) ‘무료’에 해당하는 두 조각(빗금·점무늬)만 떼어 한 줄로 모으면 전체의 30%
 * 2) 이 30%를 새로운 전체로 보고 100%로 늘리면(= 분모로 나누면) 빗금의 몫이 사후확률
 */
async function gatherPieces() {
  const m = R.model, st = m.st, a = st.p * st.a, b = (1 - st.p) * st.b, den = a + b, post = a / den;
  const bar = rectOf(R.meter.bar), W = bar.w, H = bar.h, X = bar.x, Y = bar.y;
  const mk = (shade, cls) => { const r = rectOf(shade), e = h('div', { class: `piece ${cls}`, 'aria-hidden': 'true' }); at(e, r.x, r.y, { width: `${r.w}px`, height: `${r.h}px` }); FRONT().append(e); return { e, r }; };
  const pa = mk(m.spamShade, 'spam'), pb = mk(m.hamShade, 'ham');
  const box = (x, y, w, hh) => ({ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` });
  const label = R.meter.label;
  label.style.visibility = ''; label.innerHTML = '';
  // 1) 모으기: 높이를 막대에 맞추면 너비가 넓이에 비례한다(막대 전체 너비 = 넓이 1).
  await Promise.all([
    anim(pa.e, [box(pa.r.x, pa.r.y, pa.r.w, pa.r.h), box(X, Y, a * W, H)], { duration: 950, easing: 'cubic-bezier(.65,0,.25,1)' }),
    anim(pb.e, [box(pb.r.x, pb.r.y, pb.r.w, pb.r.h), box(X + a * W, Y, b * W, H)], { duration: 950, delay: 140, easing: 'cubic-bezier(.65,0,.25,1)' }),
  ]);
  const ghostBar = h('div', { class: 'piece-frame', 'aria-hidden': 'true' }); at(ghostBar, X, Y, { width: `${W}px`, height: `${H}px` }); FRONT().prepend(ghostBar);
  pop(ghostBar);
  label.innerHTML = `두 조각을 모으면 전체의 <b>${pct(den, 0)}</b> = ${B_EVID}`; pop(label);
  await wait(1300);
  // 2) 늘리기: 남은 30%를 새로운 전체(100%)로 → 분모로 나누기
  label.innerHTML = `÷ ${pct(den, 0)} → 다시 <b>100%</b>로 늘리면, 빗금 몫은 <b class="sp">${pct(post)}</b>`; flash(label);
  await Promise.all([
    anim(pa.e, [box(X, Y, a * W, H), box(X, Y, post * W, H)], { duration: 1000, easing: 'cubic-bezier(.65,0,.25,1)' }),
    anim(pb.e, [box(X + a * W, Y, b * W, H), box(X + post * W, Y, (1 - post) * W, H)], { duration: 1000, easing: 'cubic-bezier(.65,0,.25,1)' }),
  ]);
  burst(pa.e, { color: '#ee6c55' });
  await wait(1200);
  R.gathered = true; R.meter.bar.style.visibility = ''; R.meter.set(post, 0);
  await Promise.all([pa.e, pb.e, ghostBar].map(e => anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 320 }).then(() => e.remove())));
  m.draw();
}

/* =====================================================================
   정렬 격자: 무대 좌우 여백 44, 열 사이 24. 장면 내용은 y 150~620(아래는 말풍선 자리).
   가운데 정렬 요소는 실제 너비를 재서 맞춘다.
   ===================================================================== */
const GRID = { L: 44, R: 1236, gap: 24, top: 150 };
const DECK_GRID = { x0: GRID.L, y0: GRID.top, cols: 5, gx: 18, gy: 14 };
/** n열 격자의 k번째 열 {x, w} */
const colX = (n, k) => { const w = (GRID.R - GRID.L - GRID.gap * (n - 1)) / n; return { x: Math.round(GRID.L + k * (w + GRID.gap)), w: Math.round(w) }; };
const tagEl = html => h('div', { class: 'tag', html });
const tagSp = html => h('div', { class: 'tag spam', html });
const tagHm = html => h('div', { class: 'tag ham', html });
/** 요소들을 한 줄로 늘어놓는다. align: left(x에서 시작) / center(무대 가운데) / right(x에서 끝) */
function rowAt(children, x, y, { gap = 16, align = 'left' } = {}) {
  const row = h('div', { class: 'row-flex' }, children);
  Object.assign(row.style, { top: `${y}px`, gap: `${gap}px` });
  if (align === 'center') Object.assign(row.style, { left: '0', width: '1280px', justifyContent: 'center' });
  else if (align === 'right') row.style.right = `${1280 - x}px`;
  else row.style.left = `${x}px`;
  FRONT().append(row); return row;
}
const centerX = el => { el.style.left = `${Math.round((1280 - el.offsetWidth) / 2)}px`; return el; };
const rightTo = (el, xr = GRID.R) => { el.style.left = `${Math.round(xr - el.offsetWidth)}px`; return el; };
/** el 오른쪽 끝에서 gap만큼 떨어진 x */
const afterX = (el, gap = 40) => Math.round(parseFloat(el.style.left) + el.offsetWidth + gap);
const centerNote = (html, y, cls = 'note') => { const e = noteAt(html, GRID.L, y, GRID.R - GRID.L, cls); e.style.textAlign = 'center'; return e; };
/** 오른쪽 위 조건 단추(제목 줄 높이에 오른쪽 끝 맞춤) */
function topChip(label, ctx, name) {
  const chip = h('button', { type: 'button', class: 'chip pulse' }, label);
  at(chip, 0, 30); FRONT().append(chip); rightTo(chip); pop(chip, { delay: 150 });
  chip.addEventListener('click', () => { chip.classList.remove('pulse'); chip.classList.add('on'); chip.disabled = true; ctx.signal(name); });
  return chip;
}
/** 화살표가 붙은 한 단계 설명(→ ‘무료’만 ×6/20 →) */
const stepArrow = html => h('span', { class: 'step-arrow', html });

/* ---------- 식 조작: 항을 끌어 옮기면 식이 바뀌고, 옮긴 항은 제자리에서 새 자리로 날아간다 ---------- */
/** 수식 안의 항(button.term)을 끌어 놓는다. 누르기만 해도(또는 Enter) 첫 번째 목표로 옮긴다. */
function dragTerm(el, { targets, onDrop }) {
  let start = null, dragging = false;
  const hit = (t, ev) => { const r = t.getBoundingClientRect(); return ev.clientX >= r.left - 20 && ev.clientX <= r.right + 20 && ev.clientY >= r.top - 20 && ev.clientY <= r.bottom + 20; };
  el.addEventListener('pointerdown', ev => { if (el.disabled) return; start = toStage(ev); dragging = false; el.setPointerCapture(ev.pointerId); targets().forEach(t => t.classList.add('target')); });
  el.addEventListener('pointermove', ev => {
    if (!start) return;
    const p = toStage(ev), dx = p.x - start.x, dy = p.y - start.y;
    if (!dragging && Math.hypot(dx, dy) > 6) { dragging = true; el.classList.add('dragging'); }
    if (dragging) { el.style.transform = `translate(${dx}px, ${dy}px) rotate(-3deg)`; targets().forEach(t => t.classList.toggle('over', hit(t, ev))); }
  });
  el.addEventListener('pointerup', ev => {
    if (!start) return;
    const was = dragging; start = null; dragging = false; el.classList.remove('dragging');
    const target = was ? targets().find(t => hit(t, ev)) : targets()[0];
    targets().forEach(t => t.classList.remove('over', 'target'));
    if (target) { onDrop(target); return; }
    const from = el.style.transform; el.style.transform = '';
    el.animate([{ transform: from }, { transform: 'none' }], { duration: T(280), easing: 'ease-out' });
  });
  el.addEventListener('click', ev => { if (ev.detail === 0) onDrop(targets()[0]); });
  el.addEventListener('pointercancel', () => { start = null; dragging = false; el.style.transform = ''; el.classList.remove('dragging'); targets().forEach(t => t.classList.remove('over', 'target')); });
}
/** 식 조각에 이름을 붙인다. 이름이 같은 조각은 식이 바뀌어도 같은 것으로 보고 새 자리로 미끄러져 간다. */
const K = (k, html) => `<span data-k="${k}">${html}</span>`;
/**
 * 식을 새 모양으로 바꾼다(FLIP).
 * - data-k가 같은 조각: 옛 자리에서 새 자리로 미끄러진다(무엇이 어디로 갔는지 눈으로 따라갈 수 있게).
 * - .moved 항: 옛 .term 자리에서 튕기듯 날아온다.
 * - 나머지(=, ×, 분수선 등 새로 생긴 것): 이동이 거의 끝날 때 나타난다.
 */
async function morphEq(box, html, { center = true } = {}) {
  const s = app.scale, old = box.querySelector('.term'), from = old?.getBoundingClientRect();
  const before = new Map([...box.querySelectorAll('[data-k]')].map(e => [e.dataset.k, e.getBoundingClientRect()]));
  box.innerHTML = html;
  if (center) centerX(box);
  const moved = box.querySelector('.moved');
  const keyed = [...box.querySelectorAll('[data-k]')].filter(e => e !== moved && before.has(e.dataset.k) && !e.parentElement.closest('[data-k]'));
  const keep = moved ? [...keyed, moved] : keyed;
  // 움직이지 않는 부분은 감싸서 서서히 나타나게 한다(글자 노드도 감싼다).
  const fade = e => anim(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: keyed.length ? 480 : 200 });
  const walk = node => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        if (!ch.textContent.trim() || node.classList?.contains('frac')) continue;
        const wrap = document.createElement('span'); ch.replaceWith(wrap); wrap.append(ch); fade(wrap);
      } else if (ch.nodeType === 1) {
        if (keep.includes(ch)) continue;
        if (keep.some(k => ch.contains(k))) {
          walk(ch);
          // 분수선은 분자 칸의 ::after라서 칸째로 나타나게 할 수 없다 → 분수선이 늦게 그려지도록 칸에 표시
          if (ch.parentElement?.classList.contains('frac') && ch === ch.parentElement.firstElementChild) ch.classList.add('bar-in');
        } else fade(ch);
      }
    }
  };
  walk(box);
  const jobs = keyed.map(e => {
    const b = before.get(e.dataset.k), a = e.getBoundingClientRect();
    const dx = (b.left - a.left) / s, dy = (b.top - a.top) / s;
    if (Math.abs(dx) + Math.abs(dy) < 1) return Promise.resolve();
    return anim(e, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 720, easing: 'cubic-bezier(.65,0,.25,1)' });
  });
  if (from && moved) {
    const to = moved.getBoundingClientRect();
    jobs.push(anim(moved, [{ transform: `translate(${(from.left - to.left) / s}px, ${(from.top - to.top) / s}px)` }, { transform: 'translate(0,0) scale(1.08)', offset: .85 }, { transform: 'none' }], { duration: 820, easing: 'cubic-bezier(.5,0,.3,1)' }));
  }
  if (!jobs.length) jobs.push(wait(500));
  await Promise.all(jobs);
  box.querySelectorAll('.bar-in').forEach(e => e.classList.remove('bar-in'));
}
/** 점(dot)이 경로를 따라 이동한다. 선은 점 뒤로 그려져 나간다. */
function travel(path, dot, ms = 760) {
  Sound.play('fly');
  const L = path.getTotalLength();
  path.style.strokeDasharray = `${L} ${L}`;
  return new Promise(res => {
    if (REDUCE) { path.style.strokeDashoffset = 0; const p = path.getPointAtLength(L); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); res(); return; }
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, p = path.getPointAtLength(L * e);
      path.style.strokeDashoffset = L * (1 - e); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      if (k < 1 && path.isConnected) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });
}
/** 같은 겹침에 이르는 두 길: 전체 → ‘무료’ → 겹침, 전체 → 스팸 → 겹침 */
function roadsAt(top) {
  const svg = sv('svg', { width: 1280, height: 270, viewBox: '0 0 1280 270', class: 'roads', 'aria-hidden': 'true' });
  at(svg, 0, top, { position: 'absolute', overflow: 'visible' });
  const C = { s: [200, 135], u: [640, 40], d: [640, 230], e: [1080, 135] };
  const road = (d, color) => sv('path', { d, fill: 'none', stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round', style: 'stroke-dashoffset:9999;stroke-dasharray:9999 9999' });
  const paths = [
    [road('M 200 135 Q 330 40 640 40', '#4263eb'), road('M 640 40 Q 950 40 1080 135', '#4263eb')],
    [road('M 200 135 Q 330 230 640 230', '#ee6c55'), road('M 640 230 Q 950 230 1080 135', '#ee6c55')],
  ];
  const label = (x, y, html, color) => { const t = sv('text', { x, y, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, fill: color, 'paint-order': 'stroke', stroke: '#fbf5e8', 'stroke-width': 6, opacity: 0 }); t.innerHTML = html; return t; };
  const labels = [
    [label(380, 52, '‘무료’인 것만 <tspan font-weight="900">× 6/20</tspan>', '#3451c9'), label(905, 52, '그중 스팸 <tspan font-weight="900">× 5/6</tspan>', '#3451c9')],
    [label(380, 238, '스팸인 것만 <tspan font-weight="900">× 8/20</tspan>', '#b8392a'), label(905, 238, '그중 ‘무료’ <tspan font-weight="900">× 5/8</tspan>', '#b8392a')],
  ];
  const node = ([x, y], text, fill, stroke, w = 170) => {
    const g = sv('g', { opacity: 0 });
    g.append(sv('rect', { x: x - w / 2, y: y - 26, width: w, height: 52, rx: 26, fill, stroke, 'stroke-width': 3 }),
      sv('text', { x, y: y + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 900, fill: '#1f2a44' }, text));
    g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center';
    return g;
  };
  const nodes = { s: node(C.s, '전체 20통', '#fffdf8', '#1f2a44'), u: node(C.u, '‘무료’ 6통', '#dfe6ff', '#4263eb'), d: node(C.d, '스팸 8통', '#ffe0d6', '#b8392a'), e: node(C.e, '겹침 5통 = 5/20', '#ffc845', '#1f2a44', 210) };
  const dots = [sv('circle', { r: 11, fill: '#4263eb', stroke: '#1f2a44', 'stroke-width': 3, opacity: 0 }), sv('circle', { r: 11, fill: '#ee6c55', stroke: '#1f2a44', 'stroke-width': 3, opacity: 0 })];
  svg.append(...paths.flat(), ...labels.flat(), nodes.s, nodes.u, nodes.d, nodes.e, ...dots);
  FRONT().append(svg);
  const show = (g, ms = 420) => anim(g, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.12)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: ms, easing: 'cubic-bezier(.3,1.3,.5,1)' });
  return {
    svg, nodes,
    start: () => show(nodes.s),
    /** k번째 길을 따라 점이 달린다. 처음 도착하면 끝 칸이 나타나고, 두 번째 도착이면 같은 곳이라고 터뜨린다. */
    async run(k) {
      const dot = dots[k], mid = k ? nodes.d : nodes.u, [p1, p2] = paths[k], [l1, l2] = labels[k];
      dot.setAttribute('opacity', 1);
      anim(l1, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 250 });
      await travel(p1, dot);
      await show(mid, 360);
      anim(l2, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 250 });
      await travel(p2, dot);
      dot.setAttribute('opacity', 0);
      if (nodes.e.getAttribute('opacity') === '0' && !nodes.e.style.opacity) { nodes.e.setAttribute('opacity', 1); await show(nodes.e, 520); }
      else { await anim(nodes.e, [{ transform: 'none' }, { transform: 'scale(1.18)' }, { transform: 'none' }], { duration: 420 }); }
      burst(nodes.e, { color: k ? '#ee6c55' : '#4263eb' });
    },
  };
}
/* ---------- 벤 다이어그램: 가리키는 영역 표시와 정의 설명 ---------- */
const LENS = 'M 334.3 120.5 A 130 130 0 0 1 334.3 309.5 A 105 105 0 0 1 334.3 120.5 Z';
const VENN_TIP = {
  all: ['전체 20통', '조건이 없을 때의 전체'],
  A: ['스팸 8통', '스팸 원 전체'],
  B: ['‘무료’ 6통', '‘무료’ 원 전체 = 조건'],
  lens: ['겹침 5통', '스팸이면서 ‘무료’'],
};
/**
 * 마우스가 가리키는 영역을 굵은 점선과 이름표로 보여 주고, 누르면 그 영역을 고른 것으로 처리한다.
 * 분모를 고를 때는 ‘무료’ 원 안 어디든 ‘무료’ 원 전체를 뜻하고, 분자를 고를 때는 겹친 곳과 나머지를 구분한다.
 */
function vennPointer(ctx) {
  const svg = R.diagram, tip = h('div', { class: 'hover-tip', 'aria-hidden': 'true' }); tip.style.opacity = 0; FRONT().append(tip);
  const region = p => {
    const x = p.x - GRID.L, y = p.y - GRID.top, inA = Math.hypot(x - 245, y - 215) < 130, inB = Math.hypot(x - 380, y - 215) < 105;
    if (inA && inB) return R.mode === 'den' ? 'B' : 'lens';
    return inB ? 'B' : inA ? 'A' : 'all';
  };
  let shown = '';
  /** key 영역을 강조하고 이름표를 p(무대 좌표) 근처에 둔다. key가 ''이면 모두 숨긴다. */
  R.hover = (key, p) => {
    if (R.mode === 'done') key = '';
    if (key !== shown) {
      Object.entries(R.hl).forEach(([k, e]) => e.setAttribute('opacity', k === key ? 1 : 0));
      if (key) tip.innerHTML = `${VENN_TIP[key][0]}<small>${VENN_TIP[key][1]}</small>`;
      shown = key;
    }
    tip.style.opacity = key ? 1 : 0;
    if (key && p) at(tip, Math.min(p.x + 18, GRID.L + 600 - tip.offsetWidth - 4), Math.min(p.y + 22, GRID.top + 400 - tip.offsetHeight - 4));
  };
  const choose = key => {
    if (R.mode === 'den') {
      if (key === 'B') ctx.signal('den');
      else ctx.feedback(key === 'A' ? '그건 스팸 8통의 원이에요. 지금은 조건 ‘무료’가 붙어 있어요.' : '그건 전체 20통이에요. 조건 ‘무료’가 붙으면 전체가 바뀌어요.');
    } else if (R.mode === 'num') {
      if (key === 'lens') ctx.signal('num');
      else ctx.feedback({ B: '그건 ‘무료’ 원 전체(분모)예요. 분자는 그 안에서 스팸인, 두 원이 겹친 곳이에요.', A: '그건 스팸 8통 전체예요. 분자는 ‘무료’ 원 안에 있어야 해요.', all: '그건 전체 20통이에요. 분자는 ‘무료’ 원 안에서 찾아요.' }[key]);
    }
  };
  svg.addEventListener('pointermove', ev => { const p = toStage(ev); R.hover(region(p), p); });
  svg.addEventListener('pointerleave', () => R.hover(''));
  svg.addEventListener('click', ev => { if (R.mode !== 'done') choose(region(toStage(ev))); });
  // 키보드: 초점이 간 영역을 같은 방식으로 보여 주고 Enter/Space로 고른다.
  [[R.a, 'A'], [R.b, 'B'], [R.lens, 'lens']].forEach(([el, key]) => {
    const center = () => { const r = rectOf(el); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    el.addEventListener('focus', () => R.hover(key, center()));
    el.addEventListener('blur', () => R.hover(''));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(key); } });
  });
}
/**
 * 정의가 왜 그런 모양인지: ‘무료’라는 걸 알면 원 밖은 지워지고, ‘무료’ 원이 새로운 전체가 된다.
 * 그 안에서 스팸(겹침)의 몫 = 5통 ÷ 6통. 둘 다 전체 20으로 나누면 확률의 식 P(A∩B) ÷ P(B).
 */
async function explainVenn() {
  const svg = R.diagram;
  // 1) 조건 밖을 종이로 덮는다(구멍 = ‘무료’ 원)
  const veil = sv('path', { d: 'M -1000 -1000 H 1600 V 1400 H -1000 Z M 275 215 a 105 105 0 1 0 210 0 a 105 105 0 1 0 -210 0 Z', 'fill-rule': 'evenodd', fill: '#fbf5e8', opacity: 0, 'pointer-events': 'none' });
  R.zoom.insertBefore(veil, R.n5);
  const cap = (x, y, text, color, anchor = 'start') => { const t = sv('text', { x, y, 'font-size': 20, 'font-weight': 900, fill: color, 'text-anchor': anchor, 'paint-order': 'stroke', stroke: '#fbf5e8', 'stroke-width': 6, opacity: 0, 'pointer-events': 'none' }, text); svg.insertBefore(t, R.frame); return t; };
  const c1 = cap(22, 36, '‘무료’라는 걸 알면 → 원 밖은 지운다', '#33415f');
  await Promise.all([anim(veil, [{ opacity: 0 }, { opacity: .9 }], { duration: 650 }), anim(c1, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 200 })]);
  await wait(500);
  // 2) ‘무료’ 원을 무대 가운데로 크게: 이 원이 새로운 전체
  R.zoom.style.transformOrigin = '0 0';
  anim(R.lblB, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
  await anim(R.zoom, [{ transform: 'translate(0px, 0px) scale(1)' }, { transform: 'translate(300px, 210px) scale(1.55) translate(-380px, -215px)' }], { duration: 950, easing: 'cubic-bezier(.65,0,.25,1)' });
  c1.textContent = '조건 ‘무료’ 6통 = 새로운 전체';
  const c2 = cap(22, 386, '그중 스팸(겹침) 5통', '#b8392a');
  anim(c2, [{ opacity: 0 }, { opacity: 1 }], { duration: 350 });
  burst(R.bOutline, { color: '#4263eb', rays: 12 });
  await wait(600);
  // 3) 오른쪽: 개수의 비 → 확률의 비 → 정의
  const top = Math.round(GRID.top + R.card.offsetHeight + 22), x0 = R.x + 8;
  const row1 = fxAt(`= ${F('?', '?')}`, x0, top, { size: 24 });
  await pop(row1, { duration: 300 });
  const [n1, d1] = row1.querySelectorAll('.frac > span');
  await Promise.all([fillSlot(n1, '<span class="sp">겹침 5통</span>', { from: R.n5, ghost: '5', cls: 'sp', lift: 30 }), fillSlot(d1, '<span style="color:#3451c9">새 전체 6통</span>', { from: R.n1, ghost: '5 + 1', cls: 'den', lift: 30, ms: 880 })]);
  const div = tagEl('위·아래를 모두 ÷ 20 → 개수가 확률로'); at(div, afterX(row1, 20), top + 26); FRONT().append(div);
  await wait(250); await pop(div, { duration: 300 });
  await wait(350);
  // 개수의 비 → 확률의 비. 5/20이 바로 P(스팸∩무료), 6/20이 P(무료)
  const row2 = fxAt(`= ${F('<span class="sp">5/20</span>', '<span style="color:#3451c9">6/20</span>')} <span class="same">= ${F(`<span class="hl-num">${B_JOINT}</span>`, `<span class="hl-den">${B_EVID}</span>`)}</span>`, x0, top + 92, { size: 24 });
  const same = row2.querySelector('.same'); same.style.opacity = 0;
  await pop(row2);
  await wait(300);
  await anim(same, [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 420 });
  const [fn, fd] = R.card.querySelectorAll('#f1 > span'), [sn, sd] = same.querySelectorAll('.frac > span');
  [fn, sn].forEach(e => e.classList.add('pointing')); burst(sn, { color: '#ee6c55', rays: 8 });
  await wait(700);
  [fn, sn].forEach(e => e.classList.remove('pointing')); [fd, sd].forEach(e => e.classList.add('pointing')); burst(sd, { color: '#4263eb', rays: 8 });
  await wait(700);
  [fd, sd].forEach(e => e.classList.remove('pointing'));
  await wait(200);
  // 4) 정의(일반형) 도장
  const def = h('div', { class: 'eq-card goal def' }, h('span', { class: 'goal-tag' }, '조건부확률의 정의'),
    h('div', { class: 'fx', style: { position: 'static', fontSize: '26px' }, html: `${P('A', 'B')} = ${F(P('A ∩ B'), P('B'))}` }));
  at(def, x0, top + 196, { width: `${R.w - 8}px` }); FRONT().append(def);
  await stamp(def, { rays: 14 });
}
/* ---------- 다른 예 1: 비 오는 날의 지각(조건부확률) ---------- */
const RAIN_DAYS = [2, 6, 7, 13, 17], LATE_DAYS = [2, 6, 9, 13, 15, 19];
const ICON_SUN = '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><g stroke="#1f2a44" stroke-width="2.5" stroke-linecap="round"><path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5L32 32M8 32l3.5-3.5M28.5 11.5L32 8"/></g><circle cx="20" cy="20" r="8" fill="#ffc845" stroke="#1f2a44" stroke-width="2.5"/></svg>';
const ICON_RAIN = '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><path d="M11 24h19a7 7 0 0 0 0-14 9 9 0 0 0-17-1 7.5 7.5 0 0 0-2 15z" fill="#dfe6ff" stroke="#1f2a44" stroke-width="2.5" stroke-linejoin="round"/><g stroke="#4263eb" stroke-width="3" stroke-linecap="round"><path d="M14 29l-2 5M21 29l-2 5M28 29l-2 5"/></g></svg>';
/** 20일 달력의 하루 칸 */
function dayCell(k) {
  const rain = RAIN_DAYS.includes(k), late = LATE_DAYS.includes(k);
  const el = h('div', { class: `day${rain ? ' rain' : ''}${late ? ' late' : ''}`, html: `<span class="dn">${Math.floor(k / 5) + 1}주 ${'월화수목금'[k % 5]}</span>${rain ? ICON_RAIN : ICON_SUN}${late ? '<b class="late-tag">지각</b>' : ''}` });
  return el;
}

/* ---------- 다른 예 2: 검사 양성(베이즈 정리, 사전확률의 힘) ---------- */
const TEST = { n: 1000, sick: [37, 112, 245, 318, 401, 527, 640, 733, 861, 958] };
TEST.sickPos = TEST.sick.slice(0, 9);
TEST.healthyPos = Array.from({ length: TEST.n }, (_, k) => k).filter(k => !TEST.sick.includes(k)).filter((_, j) => j % 10 === 4);

/* ---------- 다른 예 3: 날씨로 소풍 판정(나이브 베이즈) ---------- */
const PICNIC = {
  prior: { go: 6 / 10, stay: 4 / 10 },
  n: { go: 6, stay: 4 },
  count: { 맑음: { go: 5, stay: 1 }, 흐림: { go: 1, stay: 3 }, '약한 바람': { go: 5, stay: 1 }, '강한 바람': { go: 1, stay: 3 } },
};
/** 고른 날씨 특징으로 저울을 다시 쌓고 판정 문장을 고친다. */
function updatePicnic() {
  let go = PICNIC.prior.go, stay = PICNIC.prior.stay;
  R.bal.clear(); R.bal.token(0, '0.6'); R.bal.token(1, '0.4');
  for (const g of ['하늘', '바람']) {
    const f = R.pick[g]; if (!f) continue;
    const c = PICNIC.count[f];
    go *= c.go / PICNIC.n.go; stay *= c.stay / PICNIC.n.stay;
    R.bal.token(0, `× ${c.go}/${PICNIC.n.go}`); R.bal.token(1, `× ${c.stay}/${PICNIC.n.stay}`);
  }
  R.bal.weigh(go, stay);
  R.picnicPost = go / (go + stay);
  R.tbl.querySelectorAll('tbody tr').forEach(tr => tr.classList.toggle('picked', Object.values(R.pick).includes(tr.dataset.f)));
  const post = R.picnicPost;
  R.verdict.innerHTML = `소풍 갈 확률 = ${dec(go, 3)} ÷ (${dec(go, 3)} + ${dec(stay, 3)}) ≈ <b class="${post >= .5 ? 'sp' : 'hm'}">${pct(post)}</b> → <b>${post >= .5 ? '간다' : '안 간다'}</b>`;
  flash(R.verdict);
}

/* ---------- 조합 칸: 단어 있음/없음의 모든 조합마다 칸 하나 ---------- */
const COMBO = { x: 44, y: 258, w: 1192, h: 272 };
/** words의 있음/없음 조합(2^n개)마다 칸을 만들고, 각 칸에 들어갈 문자 id를 구한다. 마지막 칸 = 모두 있음. */
function comboCells(words, cols, gap = 12) {
  const n = 2 ** words.length, rows = Math.ceil(n / cols);
  const cw = (COMBO.w - gap * (cols - 1)) / cols, chh = (COMBO.h - gap * (rows - 1)) / rows;
  const wrap = h('div', { class: 'combo', 'aria-hidden': 'true' }); at(wrap, 0, 0); BACK().append(wrap);
  const cells = Array.from({ length: n }, (_, k) => {
    const mask = words.map((_, j) => (k >> (words.length - 1 - j)) & 1);
    const x = COMBO.x + (k % cols) * (cw + gap), y = COMBO.y + Math.floor(k / cols) * (chh + gap);
    const ids = ORDER.filter(id => words.every((w, j) => MSG[id].text.includes(w) === !!mask[j]));
    const el = h('div', { class: `cell${words.length > 3 ? ' small' : ''}` });
    el.append(words.length <= 3
      ? h('div', { class: 'cell-key' }, words.map((w, j) => h('span', { class: mask[j] ? 'on' : 'off' }, w)))
      : h('div', { class: 'cell-bits' }, mask.map(b => h('i', { class: b ? 'on' : null }))));
    at(el, x, y, { width: `${cw}px`, height: `${chh}px` }); wrap.append(el);
    return { x, y, w: cw, h: chh, ids, el };
  });
  [...wrap.children].forEach((c, k) => anim(c, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: Math.min(k * 22, 500), easing: 'cubic-bezier(.3,1.3,.5,1)' }));
  return { wrap, cells };
}
/** 문자 카드를 작은 알약 모양으로 바꿔 자기 조합 칸 안에 줄 세운다. */
function cardsIntoCells(cells, { s, top, perRow, gap = 4 }) {
  const states = {};
  for (const c of cells) c.ids.forEach((id, k) => {
    const pw = CW * s, ph = CH * s, x0 = c.x + (c.w - Math.min(perRow, c.ids.length) * (pw + gap) + gap) / 2;
    states[id] = cardAt(x0 + (k % perRow) * (pw + gap), c.y + top + Math.floor(k / perRow) * (ph + gap), s);
  });
  return Deck.to(states, { ms: 900, stagger: 22 });
}
const fmtInt = v => Math.round(v).toLocaleString('ko-KR');
/** 스팸에 자주 나오는 단어. 앞의 셋은 지금까지 쓴 단어, 뒤로 갈수록 실제 필터가 더 보는 단어들. */
const SPAM_WORDS = ['무료', '쿠폰', '당첨', '대출', '이벤트', '100%', '추천', '할인', '특가', '클릭'];
/**
 * 단어 n개의 있음/없음 조합 2ⁿ칸을 그리고, 문자 20통을 실제 자기 조합 칸에 점으로 넣는다.
 * 점 색: 스팸만 = 산호, 정상만 = 청록, 섞임 = 노랑. 두 통 이상이면 숫자를 쓴다.
 */
function wordGrid(words) {
  const n = words.length, total = 2 ** n, A = { x: 44, y: 306, w: 1192, h: 228 };
  const cols = Math.min(total, 2 ** Math.round(Math.log2(Math.sqrt(5.2 * total)))), rows = total / cols, cw = A.w / cols, chh = A.h / rows;
  const svg = sv('svg', { class: 'combo-big', width: A.w, height: A.h, viewBox: `0 0 ${A.w} ${A.h}`, 'aria-hidden': 'true' });
  at(svg, A.x, A.y, { position: 'absolute' });
  const gap = Math.min(4, cw * .12);
  for (let k = 0; k < total; k++) svg.append(sv('rect', { class: 'c', x: (k % cols) * cw + gap / 2, y: Math.floor(k / cols) * chh + gap / 2, width: cw - gap, height: chh - gap, rx: Math.min(6, cw * .15) }));
  const groups = new Map();
  for (const id of ORDER) { const k = words.reduce((s, w) => s * 2 + (MSG[id].text.includes(w) ? 1 : 0), 0); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(id); }
  const r = Math.max(4.5, Math.min(cw, chh) * .32);
  for (const [k, ids] of groups) {
    const sp = ids.filter(id => MSG[id].spam).length, fill = sp === ids.length ? '#ee6c55' : sp === 0 ? '#2aa198' : '#ffc845';
    const cx = (k % cols) * cw + cw / 2, cy = Math.floor(k / cols) * chh + chh / 2;
    const dot = sv('circle', { cx, cy, r: ids.length > 1 ? Math.max(r, 9) : r, fill, stroke: '#1f2a44', 'stroke-width': 2 });
    svg.append(dot);
    if (ids.length > 1) svg.append(sv('text', { x: cx, y: cy + 4.5, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 900, fill: '#1f2a44' }, ids.length));
  }
  BACK().append(svg);
  svg.style.transformOrigin = 'center';
  anim(svg, [{ opacity: 0, transform: 'scale(1.12)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  return { svg, cells: total, filled: groups.size };
}
/**
 * 나이브 가정의 수학적 이득: 한 분류에서 미리 세어 둘 확률의 개수
 *   조합을 통째로 = 2ⁿ − 1 (모든 조합의 확률, 합이 1이라 하나는 저절로 정해짐)
 *   나이브 가정   = n     (단어마다 하나)
 * 막대는 같은 n에서 '통째로'를 100%로 둔 실제 비율이다.
 */
function paramCard(x, y, w) {
  const card = h('div', { class: 'eq-card param' }); at(card, x, y, { width: `${w}px` });
  card.innerHTML = '<p class="param-head">스팸 쪽에서 미리 세어 둘 확률의 개수</p>'
    + '<p class="param-n">단어 <b class="n">3</b>개일 때</p>'
    + '<div class="param-row joint"><span class="lbl">조합을 통째로 <small>2ⁿ − 1</small></span><div class="pbar"><i></i></div><b class="v">7</b></div>'
    + '<div class="param-row naive"><span class="lbl">나이브 가정 <small>n</small></span><div class="pbar"><i></i></div><b class="v">3</b></div>'
    + '<p class="param-foot">단어가 늘면 차이가 어떻게 될까요?</p>';
  FRONT().append(card);
  const [jb, nb] = card.querySelectorAll('.pbar i'), [jv, nv] = card.querySelectorAll('.v'), nEl = card.querySelector('.n'), foot = card.querySelector('.param-foot');
  const setBars = (n, ms) => {
    const ratio = n / (2 ** n - 1);
    anim(jb, [{ width: getComputedStyle(jb).width }, { width: '100%' }], { duration: ms });
    return anim(nb, [{ width: getComputedStyle(nb).width }, { width: `${Math.max(ratio * 100, 1.2)}%` }], { duration: ms, easing: 'cubic-bezier(.65,0,.25,1)' });
  };
  jb.style.width = '100%'; nb.style.width = `${3 / 7 * 100}%`;
  return {
    card,
    async run() {
      let prev = 3;
      for (const n of [10, 20]) {
        await wait(600);
        nEl.textContent = n; flash(nEl);
        await Promise.all([
          countUp(jv, 2 ** n - 1, { from: 2 ** prev - 1, ms: 1100, fmt: fmtInt }),
          countUp(nv, n, { from: prev, ms: 1100 }),
          setBars(n, 1100),
        ]);
        prev = n;
      }
      foot.innerHTML = '조합은 단어마다 <b>2배씩</b>, 나이브 가정은 <b>1개씩</b>만 늘어요.<br>20통처럼 작은 자료에서도 단어별 비율은 셀 수 있지만, 값은 흔들릴 수 있어요.';
      await stamp(foot, { color: '#2aa198' });
    },
  };
}
/** 무대 좌표로 본 요소의 위치(장면 내 배치용) */
const stageRect = el => { const r = el.getBoundingClientRect(), base = $('#stage').getBoundingClientRect(), s = app.scale; return { x: (r.left - base.left) / s, y: (r.top - base.top) / s, w: r.width / s, h: r.height / s }; };
/** 수식의 한 부분 아래(또는 위)에 역할 이름표를 단다 */
function roleLabel(target, html, cls, below = true) {
  const r = stageRect(target), tag = h('div', { class: `role ${cls}`, html });
  FRONT().append(tag);
  at(tag, Math.round(r.x + r.w / 2 - tag.offsetWidth / 2), Math.round(below ? r.y + r.h + 14 : r.y - tag.offsetHeight - 14));
  pop(tag); return tag;
}

/* =====================================================================
   장면 목록 — 주제: 베이즈 정리와 나이브 베이즈 공식이 "왜 이런 모양인가"
   ===================================================================== */
const B_POST = P(SP, W('무료')), B_LIK = P(W('무료'), SP), B_PRIOR = P(SP), B_EVID = P(W('무료')), B_JOINT = P(`${SP} ∩ ${W('무료')}`);
const WORDS3 = `${W('무료')}, ${W('쿠폰')}, ${W('당첨')}`;
/* 각 장의 마지막에 부모가 덧붙일 짧은 전이 확인 문제. 기존 19개 장면은 늘리지 않는다. */
const CHAPTER_CHECKS = {
  1: [{
    type: 'choice',
    prompt: '새 반의 기록에서 “버스를 탄 날 4일 중 지각 1일”이라면 P(지각 | 버스)는?',
    options: [
      { label: '1/4', correct: true, msg: '맞아요. 조건 ‘버스’의 새 전체 4일 중 지각 1일입니다.' },
      { label: '1/20', correct: false, msg: '전체 등교일이 아니라 버스를 탄 날만 분모로 씁니다.' },
      { label: '4/1', correct: false, msg: '조건부확률은 조건 전체를 분모에 둡니다.' },
    ],
  }],
  2: [{
    type: 'choice',
    prompt: '동아리 지원자 중 코딩 경험자의 비율 P(경험 | 지원)과, 코딩 경험자 중 동아리 지원자의 비율 P(지원 | 경험)은 무엇이 같을까요?',
    options: [
      { label: '둘 다 “지원하면서 경험 있음”이라는 같은 겹침을 쓴다', correct: true, msg: '맞아요. 같은 겹침을 서로 다른 전체로 나눈 두 질문입니다.' },
      { label: '분모가 항상 같다', correct: false, msg: '질문이 바뀌면 기준 전체, 즉 분모가 달라집니다.' },
      { label: '값이 항상 같다', correct: false, msg: '겹침은 같아도 나누는 전체가 달라 값은 달라질 수 있습니다.' },
    ],
  }],
  3: [{
    type: 'choice',
    prompt: '어떤 특징이 “A 분류에서는 6/10, B 분류에서는 2/10”으로 나타났다면, 다른 조건이 같을 때 이 특징을 추가하면 판정은 어느 쪽으로 기울까요?',
    options: [
      { label: 'A 쪽', correct: true, msg: '맞아요. A 점수에는 0.6, B 점수에는 0.2가 곱해져 A/B 점수 비가 3배가 됩니다. A 쪽으로 기울지만, 최종 판정은 이전 점수도 함께 봐야 해요.' },
      { label: 'B 쪽', correct: false, msg: 'B에서는 그 특징의 가능도가 더 작습니다.' },
      { label: '바뀌지 않는다', correct: false, msg: '두 분류에서 곱하는 가능도가 다르면 점수 비율이 바뀝니다.' },
    ],
  }],
  4: [{
    type: 'choice',
    prompt: '새 문자에 단어장 밖의 “전시회”만 있고 단어장 단서는 없다면, 이 입문용 모델은 무엇을 근거로 판정할까요?',
    options: [
      { label: '단어장 밖 단어는 빼고 사전확률을 기준으로 한다', correct: true, msg: '맞아요. 이 수업 모델은 등록한 단어가 실제로 있을 때만 곱하므로, 단서가 없으면 사전확률이 남습니다.' },
      { label: '전시회가 정상 단어라고 자동으로 안다', correct: false, msg: '학습하지 않은 단어의 뜻이나 성격을 이 모델이 자동으로 알지는 못합니다.' },
      { label: '무조건 스팸으로 판정한다', correct: false, msg: '단어장 밖이라는 이유만으로 스팸으로 정하지 않습니다.' },
    ],
  }],
};
const STEPS = [
  /* ---------------- 0. 시작 ---------------- */
  {
    ch: 0, kicker: '시작', title: '이 공식들은 왜 이렇게 생겼을까?',
    say: '스팸 필터는 베이즈 정리와 나이브 베이즈로 문자를 판정합니다. 공식을 외우는 대신, 문자 20통으로 <b>공식이 이런 모양이 되는 이유</b>를 직접 만들어 봅니다.',
    async enter() {
      R = {};
      const left = colX(2, 0), right = colX(2, 1), pw = 270, ph = 470, py = GRID.top;
      const px = Math.round(left.x + (left.w - pw) / 2);
      R.phone = phoneAt(px, py, MSG.S1.text, '알 수 없는 번호', { w: pw, h: ph });
      R.phone.bubble.style.opacity = 0;
      pop(R.phone.el, { duration: 650 });
      [['envelope', px - 118, py + 36, 84], ['sparkle', px - 92, py + 206, 60], ['coupon', px - 128, py + 320, 84], ['warning', px + pw - 50, py - 42, 84], ['gift', px + pw - 64, py + ph - 80, 84]].forEach(([name, x, y, size], k) => {
        const icon = iconAt(name, x, y, size, k % 2 ? 'float-b' : 'float-a');
        anim(icon, [{ opacity: 0, transform: 'scale(.3) rotate(-25deg)' }, { opacity: 1, transform: 'none' }], { delay: 450 + k * 100, duration: 520, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      });
      // 오른쪽: 오늘 만들 두 공식(목표)
      const head = noteAt('오늘 직접 만들어 볼 공식', right.x, py + 40, right.w, 'big-note');
      const c1 = h('div', { class: 'eq-card goal' }, h('span', { class: 'goal-tag' }, '베이즈 정리'), h('div', { class: 'fx', style: { position: 'static', fontSize: '28px' }, html: `${P('A', 'B')} = ${F(`${P('B', 'A')} × ${P('A')}`, P('B'))}` }));
      const c2 = h('div', { class: 'eq-card goal' }, h('span', { class: 'goal-tag' }, '나이브 베이즈'), h('div', { class: 'fx', style: { position: 'static', fontSize: '25px' }, html: `${P(SP, '단어들')} ∝ ${P(SP)} × ∏ ${P('단어', SP)}` }));
      at(c1, right.x, py + 100, { width: `${right.w}px` }); at(c2, right.x, py + 280, { width: `${right.w}px` });
      FRONT().append(c1, c2);
      [head, c1, c2].forEach((e, k) => pop(e, { delay: 300 + k * 150 }));
      await wait(380);
      anim(R.phone.bubble, [{ opacity: 0, transform: 'translateY(20px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      await wait(520);
    },
    tasks: [{
      type: 'choice', any: true, prompt: '오른쪽 공식, 처음 보면 어떤 느낌인가요?',
      options: [
        { label: '외우기 어렵다', msg: '외울 필요 없어요. 왜 이런 모양인지 알면 저절로 기억됩니다.' },
        { label: '왜 이런지 궁금하다', msg: '좋아요! 문자 20통을 세는 것에서 시작해 차근차근 만들어 봅시다.' },
        { label: '이미 안다', msg: '그럼 각 부분이 어디서 왔는지 그림으로 확인해 봅시다.' },
      ],
      then: () => litWords(R.phone.bubble),
    }],
    done: '<b>다음 ▶</b>에서 공식의 재료가 될 문자 20통을 모읍니다.',
  },

  /* ---------------- 1. 확률 = 부분 ÷ 전체 ---------------- */
  {
    ch: 1, deck: true, kicker: '1장 · 조건부확률', title: '확률은 “부분 ÷ 전체”',
    say: '지난주에 받은 문자 20통입니다. 사람이 스팸/정상을 미리 표시해 두었어요. 모든 확률 공식은 결국 <b>부분 ÷ 전체</b>에서 출발합니다.',
    async enter() {
      R = {};
      Deck.reset(); Deck.labelAll(false);
      await Deck.show(grid(ORDER, DECK_GRID));
      R.spam = tagSp('! 스팸 <b>?</b>통'); R.ham = tagHm('✓ 정상 <b>?</b>통'); R.all = tagEl('전체 <b>20</b>통');
      pop(rowAt([R.spam, R.ham, R.all], GRID.L, 462));
      await wait(300);
    },
    tasks: [
      {
        type: 'action', prompt: '사람이 붙여 둔 라벨을 뒤집어 볼까요?', label: '라벨 뒤집기', ok: '스팸 8통, 정상 12통이에요.',
        then: async () => {
          await Deck.flip(ORDER, 40);
          await Promise.all([countUp(R.spam.querySelector('b'), N.spam), countUp(R.ham.querySelector('b'), N.ham)]);
          // 부분(스팸 8통)과 전체(20통)가 분수의 위·아래 자리로 날아가 앉는다.
          const f = fxAt(`${P(SP)} = ${F('?', '?')}<span class="tail"> = ${F(8, 20)}</span>`, GRID.L, 516);
          R.f = f; const tail = f.querySelector('.tail'); tail.style.opacity = 0;
          await pop(f, { duration: 320 });
          const [num, den] = f.querySelectorAll('.frac > span');
          Deck.focus(IDS.spam);
          await Promise.all([fillSlot(num, '<span class="sp">스팸 8통</span>', { from: R.spam, ghost: '스팸 8통', cls: 'sp' }), fillSlot(den, '전체 20통', { from: R.all, ghost: '전체 20통', ms: 820 })]);
          Deck.focus([]);
          await anim(tail, [{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], { duration: 360 });
          burst(f.querySelectorAll('.frac')[1]);
        },
      },
      {
        type: 'choice', prompt: '이 분수에서 <b>분모 20</b>은 무엇을 뜻할까요?',
        blink: () => [...R.f.querySelectorAll('.frac > span:last-child')],
        options: [
          { label: '스팸 문자 수', points: () => R.spam, correct: false, msg: '스팸 수(8)는 분자예요. 분모는 “무엇 중에서” 고르는지를 정하는 기준이에요.' },
          { label: '기준이 되는 전체', points: () => R.all, correct: true, msg: '맞아요. 분모는 “어디서 고르는가”를 정하는 전체예요. 이 생각이 모든 공식의 출발점입니다.' },
          { label: '정상 문자 수', points: () => R.ham, correct: false, msg: '정상은 12통이에요. 분모 20은 스팸과 정상을 모두 합친 수입니다.' },
        ],
        then: async () => {
          const x = afterX(R.f), den = R.f.querySelectorAll('.frac > span:last-child');
          den.forEach(d => d.classList.add('hl-den'));
          burst(den[1], { color: '#4263eb' });
          await pop(noteAt('분모 = 기준이 되는 전체.<br>다음 장면에서 이 <b>전체</b>를 바꿔 봅니다.', x, 534, GRID.R - x));
        },
      },
    ],
    done: '<b>다음 ▶</b>에서 ‘무료’라는 조건을 걸어 전체를 바꿔 봅니다.',
  },

  /* ---------------- 2. 조건 = 전체를 바꾸기 ---------------- */
  {
    ch: 1, deck: true, kicker: '1장 · 조건부확률', title: '조건이 붙으면 전체가 바뀐다',
    say: '‘무료’가 든 문자라는 걸 이미 안다면, 고르는 범위가 ‘무료’ 문자로 좁아집니다. 이렇게 이미 아는 사실을 <b>조건</b>이라고 해요.',
    async enter(ctx) {
      R = {};
      Deck.reset(); Deck.labelAll(true);
      await Deck.show(grid(ORDER, DECK_GRID));
      R.oldF = fxAt(`${P(SP)} = ${F('<span class="sp">8</span>', '20')}`, GRID.L, 470);
      pop(R.oldF);
      R.oldNote = noteAt('조건 없음: 전체 <b>20통</b> 중 스팸 <b>8통</b>', GRID.L, 562, 420);
      pop(R.oldNote);
      R.chip = topChip('조건: ‘무료’ 포함', ctx, 'chip');
      await wait(300);
    },
    tasks: [
      {
        type: 'signal', wait: 'chip', prompt: '오른쪽 위 <b>‘무료’ 조건</b> 단추를 눌러 볼래요?', ok: '‘무료’가 든 문자만 골라냈어요.',
        then: async () => {
          await Deck.mark(['무료'], ORDER, 30); await wait(250);
          const inIds = ORDER.filter(id => has(id, '무료')), outIds = ORDER.filter(id => !has(id, '무료'));
          pop(noteAt('조건에 맞지 않는 14통은 고르는 범위에서 빠집니다.', GRID.L, 150, 424));
          R.cond = boxAt('조건 ‘무료’ → 새로운 전체', 500, 172, 736, 168, 'cond'); stamp(R.cond);
          Deck.dim(outIds);
          await Deck.to({ ...grid(outIds, { x0: GRID.L, y0: 190, cols: 3, s: 0.6, gx: 10, gy: 10 }), ...grid(inIds, { x0: 520, y0: 196, cols: 3, gx: 12, gy: 14 }) }, { ms: 900, stagger: 16 });
          R.s = tagSp('! 스팸 <b>0</b>통'); R.h = tagHm('✓ 정상 <b>0</b>통');
          pop(rowAt([R.s, R.h], 520, 362));
          await Promise.all([countUp(R.s.querySelector('b'), count('spam', '무료')), countUp(R.h.querySelector('b'), count('ham', '무료'))]);
        },
      },
      {
        type: 'action', label: '설명 읽었어요 · 퀴즈 풀기', focus: () => R.cond,
        prompt: '‘무료’가 들어 있는 문자들만 모아 보았어요. 이제 <b>상자 안의 문자들만</b> 고르는 범위입니다. 바깥 문자는 남아 있지만, 이 조건의 확률을 계산할 때는 세지 않아요.',
      },
      {
        type: 'input', integer: true, label: '새로운 전체 =', prompt: '그럼 이제 <b>분모(새로운 전체)</b>는 몇 통일까요?', answer: 6, tol: 0.01, show: '6통',
        hints: [{ near: 20, msg: '20통은 조건이 없을 때의 전체예요. 지금은 노란 상자 안만 봅니다.' }, { near: 5, msg: '5통은 그중 스팸이에요. 분모는 노란 상자 안의 전체입니다.' }],
        hint: '노란 상자 안에 있는 문자를 모두 세어 보세요.', ok: '맞아요. 노란 상자 6통이 새로운 전체예요.',
        then: async () => {
          pop(tagAt('조건 없음', GRID.L, 424));
          pop(tagAt('새 조건: ‘무료’', 500, 424));
          R.newF = fxAt(`${B_POST} = ${F('?', '?')}`, 500, 470);
          await pop(R.newF, { duration: 360 });
          const den = R.newF.querySelector('.frac > span:last-child');
          await fillSlot(den, '<b class="hl-den">6</b>', { from: R.cond.querySelector('.box-label'), ghost: '6', cls: 'den' });
          burst(den, { color: '#4263eb' });
          R.newNote = noteAt('분모 <b>20 → 6</b>: 기준이 전체 문자에서<br><b>‘무료’가 들어 있는 문자</b>로 바뀌었어요.', 500, 562, 736);
          await pop(R.newNote, { duration: 550 });
        },
      },
      {
        type: 'input', integer: true, label: '그중 스팸 =', prompt: '새로운 전체는 ‘무료’ 문자 <b>6통</b>이에요. 그 안에서 <b>스팸인 문자</b>는 몇 통일까요?', answer: 5, tol: .01, show: '5통',
        hint: '상자 안에서 빨간 스팸 라벨이 붙은 문자만 세어 보세요.', ok: '맞아요. ‘무료’ 문자 6통 중 스팸은 5통이에요.',
        then: async () => {
          await fillSlot(R.newF.querySelector('.frac > span:first-child'), '<span class="sp hl-num">5</span>', { from: R.s, ghost: '5', cls: 'sp' });
          burst(R.newF.querySelector('.frac'));
          R.newNote.innerHTML = '세로 막대 <b>|</b> 오른쪽은 이미 아는 <b>조건</b>입니다.<br><b>‘무료’ 문자 6통 중 스팸 5통</b>이므로 5/6이에요.';
          await wait(700);
        },
      },
      {
        type: 'action', label: '두 확률 비교했어요', focus: () => [R.oldF, R.newF, R.cond],
        prompt: '<b>20통 중 8통</b>(8/20)과 <b>‘무료’ 6통 중 5통</b>(5/6). <b>무엇 중에서</b> 고르는지가 바뀌면 확률도 바뀌어요.',
      },
    ],
    done: '핵심: <b>조건이 붙으면 분모(전체)가 바뀝니다.</b>',
  },

  /* ---------------- 3. 정의식으로 ---------------- */
  {
    ch: 1, kicker: '1장 · 조건부확률', title: '벤 다이어그램으로 만든 조건부확률 공식',
    say: '같은 내용을 벤 다이어그램으로 그렸어요. 숫자는 각 영역의 문자 수입니다. 분자와 분모가 벤 다이어그램의 어디인지 찾으면 공식이 나옵니다. 마우스를 올리면 지금 가리키는 영역이 표시돼요.',
    async enter(ctx) {
      R = {};
      const svg = sv('svg', { width: 600, height: 400, viewBox: '0 0 600 400', class: 'venn-hit' }); at(svg, GRID.L, GRID.top, { position: 'absolute' });
      R.diagram = svg;
      R.mode = 'den';
      // 확대할 때 함께 움직이는 묶음(R.zoom)과, 제자리에 남는 테두리·안내 글
      R.zoom = sv('g');
      const all = sv('rect', { x: -2, y: -2, width: 604, height: 404, fill: '#fffdf8' });
      R.a = sv('circle', { cx: 245, cy: 215, r: 130, fill: '#ee6c55', 'fill-opacity': 0.12, tabindex: 0, role: 'button', 'aria-label': '스팸 원' });
      R.b = sv('circle', { cx: 380, cy: 215, r: 105, fill: '#4263eb', 'fill-opacity': 0.10, tabindex: 0, role: 'button', 'aria-label': '무료 원' });
      R.lens = sv('path', { d: LENS, fill: '#ee6c55', 'fill-opacity': 0, 'pointer-events': 'none', tabindex: -1, role: 'button', 'aria-label': '겹친 부분' });
      // 채색 뒤에 경계선을 다시 그려 겹친 면이 원의 경계를 덮지 않게 한다.
      R.bOutline = sv('circle', { cx: 380, cy: 215, r: 105, fill: 'none', stroke: '#4263eb', 'stroke-width': 3, 'pointer-events': 'none' });
      const aOutline = sv('circle', { cx: 245, cy: 215, r: 130, fill: 'none', stroke: '#b8392a', 'stroke-width': 3, 'pointer-events': 'none' });
      const label = (x, y, t, size = 30, fill = '#1f2a44') => sv('text', { x, y, 'font-size': size, 'font-weight': 800, fill, 'text-anchor': 'middle', 'pointer-events': 'none' }, t);
      R.n5 = label(318, 222, '5'); R.n1 = label(436, 222, '1');
      // 마우스를 올린 영역을 보여 주는 강조 도형(한 번에 하나만 보인다)
      const hl = (el, color) => { el.setAttribute('class', 'venn-hl'); el.setAttribute('opacity', 0); Object.entries({ fill: color, 'fill-opacity': .22, stroke: color, 'stroke-width': 6, 'stroke-dasharray': '12 8' }).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
      R.hl = {
        all: hl(sv('rect', { x: 8, y: 8, width: 584, height: 384, rx: 18 }), '#33415f'),
        A: hl(sv('circle', { cx: 245, cy: 215, r: 130 }), '#b8392a'),
        B: hl(sv('circle', { cx: 380, cy: 215, r: 105 }), '#4263eb'),
        lens: hl(sv('path', { d: LENS }), '#c63a2f'),
      };
      R.zoom.append(all, R.a, R.b, R.lens, aOutline, R.bOutline, ...Object.values(R.hl),
        label(72, 42, '전체 20통', 18, '#5d6680'), label(165, 222, '3'), R.n5, R.n1, label(60, 372, '11', 26, '#5d6680'),
        label(160, 76, '스팸 8통', 19, '#b8392a'), R.lblB = label(440, 100, '조건 ‘무료’ 6통', 19, '#3451c9'));
      R.frame = sv('rect', { x: 1.5, y: 1.5, width: 597, height: 397, rx: 22, fill: 'none', stroke: '#1f2a44', 'stroke-width': 3, 'pointer-events': 'none' });
      svg.append(R.zoom, R.frame);
      BACK().append(svg); pop(svg, { duration: 520 });
      vennPointer(ctx);
      const x = GRID.L + 600 + GRID.gap, w = GRID.R - x;
      R.card = h('div', { class: 'eq-card' }); at(R.card, x, GRID.top, { width: `${w}px` }); FRONT().append(R.card);
      R.card.innerHTML = `<div class="fx" style="position:static">${B_POST} = <span class="frac" id="f1"><span>?</span><span>?</span></span></div>`
        + '<p class="note" style="position:static;margin:14px 0 0" id="f1note">분자와 분모가 벤 다이어그램의 어디인지 찾아봅시다.</p>';
      pop(R.card, { delay: 150 });
      R.x = x; R.w = w;
      await wait(520);
    },
    tasks: [
      {
        type: 'signal', wait: 'den', prompt: '조건이 ‘무료’니까 <b>분모(전체)</b>는 벤 다이어그램 중 어디일까요? 클릭해 보세요.', ok: '맞아요. 조건 ‘무료’의 원 전체가 분모예요.',
        then: async () => {
          R.bOutline.setAttribute('stroke-width', 5);
          anim(R.b, [{ fillOpacity: .1 }, { fillOpacity: .35 }, { fillOpacity: .18 }], { duration: 700 });
          const den = R.card.querySelector('#f1 > span:last-child');
          await fillSlot(den, B_EVID, { from: R.b, ghost: '‘무료’ 6통', cls: 'den', lift: 40 });
          den.classList.add('hl'); burst(den, { color: '#4263eb' });
          R.mode = 'num'; R.lens.setAttribute('pointer-events', 'all'); R.lens.setAttribute('tabindex', 0);
        },
      },
      {
        type: 'signal', wait: 'num', prompt: '그럼 <b>분자</b>는요? ‘무료’ 안에서 <b>스팸</b>인 곳은 벤 다이어그램 중 어디일까요?', ok: '맞아요. 스팸이면서 ‘무료’ — 두 원이 겹친 곳이 분자예요.',
        then: async () => {
          R.mode = 'done'; R.hover?.('');
          anim(R.lens, [{ fillOpacity: 0 }, { fillOpacity: 0.32 }], { duration: 500 });
          const num = R.card.querySelector('#f1 > span:first-child');
          await fillSlot(num, B_JOINT, { from: R.lens, ghost: '겹침 5통', cls: 'sp', lift: 60 });
          num.classList.add('hl'); burst(num, { color: '#ee6c55' });
          R.card.querySelector('#f1note').innerHTML = '<span class="hl-num">분자 = 겹침(스팸이면서 ‘무료’)</span> · <span class="hl-den">분모 = 조건 ‘무료’ 전체</span>';
          await wait(500);
          await explainVenn();
        },
        hold: 600,
      },
    ],
    done: '조건부확률 = <b>겹친 부분 ÷ 조건 전체</b>. <b>다음 ▶</b>에서 질문을 뒤집어 봅니다.',
  },

  /* ---------------- 3-1. 다른 예: 비 오는 날의 지각 ---------------- */
  {
    ch: 1, kicker: '1장 · 다른 예', title: '비 오는 날엔 지각이 많을까?',
    say: '스팸이 아닌 예로도 확인해 봐요. 지난 4주(20일)의 등교 기록입니다. 지각한 날은 6일, 비 온 날은 5일이에요. <b>“비 온 날”이라는 조건</b>을 걸면 분모가 어떻게 바뀔까요?',
    async enter(ctx) {
      R = { days: [] };
      const x0 = GRID.L, y0 = 168, cw = 102, chh = 80, gap = 10;
      for (let k = 0; k < 20; k++) {
        const d = dayCell(k); at(d, x0 + (k % 5) * (cw + gap), y0 + Math.floor(k / 5) * (chh + gap), { width: `${cw}px`, height: `${chh}px` });
        FRONT().append(d); R.days.push(d);
        anim(d, [{ opacity: 0, transform: 'translateY(14px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: k * 28 });
      }
      R.allTag = tagEl('지난 4주 = <b>20</b>일 · 지각 <b>6</b>일'); at(R.allTag, x0, 534); FRONT().append(R.allTag); pop(R.allTag, { delay: 500 });
      const rx = 640, rw = GRID.R - rx;
      R.card = h('div', { class: 'eq-card' }); at(R.card, rx, 356, { width: `${rw}px` }); FRONT().append(R.card);
      R.card.innerHTML = `<div class="fx" style="position:static;font-size:26px">${P('지각')} = ${F('<span class="sp">지각 6일</span>', '<span class="hl-den">20일</span>')} = <b>30%</b></div>`
        + `<div class="fx" style="position:static;font-size:26px;margin-top:10px" id="rainF">${P('지각', '<span style="color:#3451c9">비</span>')} = <span class="frac"><span>?</span><span>?</span></span></div>`;
      pop(R.card, { delay: 300 });
      R.chip = topChip('조건: 비 온 날', ctx, 'rain');
      await wait(700);
    },
    tasks: [
      {
        type: 'signal', wait: 'rain', prompt: '오른쪽 위 <b>‘비 온 날’ 조건</b>을 눌러 볼까요? 고르는 범위가 어떻게 바뀌는지 보세요.', ok: '비 온 5일만 새로운 전체가 되었어요.',
        then: async () => {
          const rx = 640, box = boxAt('조건 ‘비 온 날’ → 새로운 전체 5일', rx, 176, GRID.R - rx, 150, 'cond'); stamp(box);
          R.box = box;
          // 비 오지 않은 날은 흐려지고, 비 온 날은 상자 안으로 옮겨 간다.
          R.days.forEach((d, k) => { if (!RAIN_DAYS.includes(k)) anim(d, [{ opacity: 1 }, { opacity: .25 }], { duration: 400 }); });
          await Promise.all(RAIN_DAYS.map((k, j) => {
            const d = R.days[k], from = rectOf(d), tx = rx + 18 + j * 114, ty = 214;
            at(d, tx, ty);
            return anim(d, [{ transform: `translate(${from.x - tx}px, ${from.y - ty}px)` }, { transform: 'translate(0,0) scale(1.06)', offset: .8 }, { transform: 'none' }], { duration: 760, delay: j * 90, easing: 'cubic-bezier(.65,0,.25,1)' });
          }));
          R.allTag.innerHTML = '조건 없음: 20일 중 지각 6일'; flash(R.allTag);
          const [num, den] = R.card.querySelectorAll('#rainF .frac > span');
          await fillSlot(den, '<span class="hl-den">비 온 5일</span>', { from: box.querySelector('.box-label'), ghost: '5일', cls: 'den', lift: 30 });
          const lateInRain = RAIN_DAYS.filter(k => LATE_DAYS.includes(k)).map(k => R.days[k]);
          lateInRain.forEach(d => d.classList.add('pointing'));
          await fillSlot(num, '<span class="sp">그중 지각 3일</span>', { from: lateInRain[1], ghost: '3일', cls: 'sp', lift: 40 });
          lateInRain.forEach(d => d.classList.remove('pointing'));
          const res = h('b', { class: 'answer' }, '= 60%'); R.card.querySelector('#rainF').append(' ', res); await stamp(res, { color: '#ee6c55' });
        },
      },
      {
        type: 'choice', prompt: '같은 기록인데 지각 확률이 <b>30% → 60%</b>로 달라졌어요. 왜 그럴까요?',
        options: [
          { label: '비 온 날 5일과 그중 지각 3일을 새로 세어서', correct: true, points: () => [...R.card.querySelectorAll('.hl-den')], msg: '맞아요. 조건이 없을 때는 지각 6일/전체 20일, 조건이 붙으면 비 온 날 중 지각 3일/비 온 날 5일입니다.' },
          { label: '지각한 날이 전체에서 늘어나서', points: () => R.days.filter((_, k) => LATE_DAYS.includes(k)), correct: false, msg: '전체 지각일은 6일 그대로예요. 다만 조건부확률에서는 비 온 날 안의 지각 3일을 분자로, 비 온 날 5일을 분모로 다시 셉니다.' },
          { label: '비 온 날이 많아서', points: () => R.box, correct: false, msg: '비 온 날은 5일뿐이에요. 오히려 범위를 좁혔기 때문에 확률이 바뀌었어요.' },
        ],
        then: async () => {
          // 정의식에 넣어 보면 1장의 스팸 공식과 똑같은 모양
          const note = h('div', { class: 'fx same-form', html: `${P('지각', '비')} = ${F(P('지각 ∩ 비'), P('비'))} = ${F('3/20', '5/20')} = 3/5` });
          const cap = h('p', { class: 'note same-cap', html: '스팸 공식과 <b>똑같은 모양</b>: 겹침 ÷ 조건 전체' });
          R.card.append(note, cap);
          await stamp(note, { color: '#4263eb' });
        },
      },
    ],
    done: '주제가 무엇이든 조건부확률 = <b>겹침 ÷ 조건 전체</b>. <b>다음 ▶</b>에서 2장 베이즈 정리로 갑니다.',
  },

  /* ---------------- 4. 같은 겹침, 다른 전체 ---------------- */
  {
    ch: 2, deck: true, kicker: '2장 · 베이즈 정리', title: '질문을 뒤집으면: 같은 겹침, 다른 전체',
    say: '스팸 필터를 만들 때는 스팸 문자를 모아 ‘스팸에 어떤 단어가 많은지’를 셉니다. 즉 우리가 쉽게 아는 건 <b>스팸 중 ‘무료’의 비율</b>이에요.',
    async enter(ctx) {
      R = {};
      Deck.reset(); Deck.labelAll(true);
      const s = 0.72, cw = CW * s, pad = 20, spamW = Math.round(2 * cw + 12 + pad * 2), boxH = 240;
      R.spamBox = boxAt('! 스팸 8통', GRID.L, 162, spamW, boxH, 'spam clickable');
      R.hamBox = boxAt('✓ 정상 12통', GRID.L + spamW + 16, 162, GRID.R - (GRID.L + spamW + 16), boxH, 'ham');
      R.spamBox.setAttribute('role', 'button'); R.spamBox.setAttribute('tabindex', '0'); R.spamBox.setAttribute('aria-label', '스팸 묶음');
      const pick = () => { R.spamBox.classList.remove('clickable', 'pulse'); ctx.signal('spambox'); };
      R.spamBox.addEventListener('click', pick); R.spamBox.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      pop(R.spamBox); pop(R.hamBox, { delay: 80 });
      await Deck.show({ ...grid(IDS.spam, { x0: GRID.L + pad, y0: 188, cols: 2, s, gx: 12, gy: 10 }), ...grid(IDS.ham, { x0: GRID.L + spamW + 16 + pad, y0: 188, cols: 4, s, gx: 12, gy: 10 }) }, { stagger: 14 });
      R.spamBox.classList.add('pulse');
      Deck.setPick(pick, IDS.spam);
      const half = (GRID.R - GRID.L - 60) / 2;
      R.a = h('div', { class: 'eq-card' }); at(R.a, GRID.L, 422, { width: `${half}px` });
      R.a.innerHTML = `<div class="fx" style="position:static;font-size:26px">${B_POST} = ${F('<span class="n5">5</span>', '‘무료’ 6')}</div><p class="note" style="position:static;margin:4px 0 0">‘무료’ 문자 중 스팸 — 1장에서 구한 값</p>`;
      R.b = h('div', { class: 'eq-card' }); at(R.b, GRID.R - half, 422, { width: `${half}px` });
      R.b.innerHTML = `<div class="fx" style="position:static;font-size:26px">${B_LIK} = <span id="bval">?</span></div><p class="note" style="position:static;margin:4px 0 0">스팸 문자 중 ‘무료’ — 우리가 쉽게 세는 값</p>`;
      FRONT().append(R.a, R.b); pop(R.a, { delay: 120 }); pop(R.b, { delay: 200 });
      await wait(450);
    },
    tasks: [
      {
        type: 'signal', wait: 'spambox', prompt: '왼쪽 <b>스팸 묶음</b>을 눌러서 그 안의 ‘무료’를 찾아볼래요?', ok: '스팸 8통 중 5통에 ‘무료’가 있어요.',
        then: async () => {
          Deck.setPick(null); Deck.dim(IDS.ham);
          await Deck.mark(['무료'], IDS.spam, 110);
          R.spamBox.querySelector('.box-label').textContent = '! 스팸 8통 · ‘무료’ 5통'; flash(R.spamBox.querySelector('.box-label'));
          await fillSlot(R.b.querySelector('#bval'), F('<span class="n5">5</span>', '스팸 8'), { from: R.spamBox.querySelector('.box-label'), ghost: '5/8', cls: 'sp', lift: 40 });
        },
      },
      {
        type: 'choice', prompt: '두 분수를 비교해 보세요. <b>똑같은 부분</b>은 어디일까요?',
        options: [
          { label: '분자 5 (스팸이면서 ‘무료’)', points: () => [...FRONT().querySelectorAll('.n5')], correct: true, msg: '맞아요! 둘 다 같은 겹침(5통)을 다른 전체로 나눈 거예요. 이 공통의 겹침이 두 값을 잇는 다리가 됩니다.' },
          { label: '분모', points: () => [R.a, R.b].map(c => c.querySelector('.frac > span:last-child')), correct: false, msg: '분모는 6과 8로 달라요. 조건이 다르면 전체도 달라지죠.' },
          { label: '같은 부분이 없다', correct: false, msg: '분자를 보세요. 둘 다 5예요.' },
        ],
        then: async () => {
          // 두 분자 5는 같은 문자 5통이다: 스팸이면서 ‘무료’인 카드가 함께 빛난다.
          Deck.dim(ORDER.filter(id => !(MSG[id].spam && has(id, '무료')))); Deck.focus(IDS.spam.filter(id => has(id, '무료')));
          FRONT().querySelectorAll('.n5').forEach((n, k) => { n.classList.add('hl'); setTimeout(() => burst(n, { color: '#ee6c55' }), T(k * 180)); });
          // 카드 높이에 맞춰 ≠는 세로 가운데, 설명은 카드 바로 아래에 둔다
          const top = parseFloat(R.a.style.top), cardH = Math.max(R.a.offsetHeight, R.b.offsetHeight);
          const ne = h('div', { class: 'fx' }, '≠'); at(ne, 0, 0, { fontSize: '40px', color: '#c63a2f' }); FRONT().append(ne); centerX(ne); ne.style.top = `${Math.round(top + (cardH - ne.offsetHeight) / 2)}px`; pop(ne);
          pop(centerNote('분자(겹침 5통)는 같고 분모만 다르다 → 하나를 알면 다른 하나로 <b>바꿔 쓸 수 있다</b>', Math.round(top + cardH + 16), 'big-note'), { delay: 200 });
        },
      },
    ],
    done: '<b>다음 ▶</b>에서 이 공통의 겹침을 식으로 써 봅니다.',
  },

  /* ---------------- 5. 곱셈 규칙: 겹침을 두 길로 ---------------- */
  {
    ch: 2, kicker: '2장 · 베이즈 정리', title: '겹침을 두 가지 길로 쓰기',
    say: '조건부확률 식의 분모를 반대편으로 옮기면 <b>곱셈 규칙</b>이 됩니다. “전체에서 먼저 좁히고, 그 안에서 한 번 더 좁힌다”는 뜻이에요. 좁히는 <b>순서는 두 가지</b>지만 <b>도착하는 겹침은 하나</b>입니다.',
    async enter(ctx) {
      R = {};
      R.eq1 = h('div', { class: 'fx' }); at(R.eq1, 0, GRID.top - 8, { fontSize: '28px' }); FRONT().append(R.eq1);
      R.eq1.innerHTML = `<span class="road-tag r1">길 ①</span><span class="zone" id="z1">${K('post', B_POST)}</span> = ${F(K('joint', B_JOINT), `<button type="button" class="term" aria-label="P(무료)를 왼쪽으로 옮기기">${B_EVID}</button>`)}`;
      centerX(R.eq1); pop(R.eq1);
      dragTerm(R.eq1.querySelector('.term'), { targets: () => [R.eq1.querySelector('#z1')], onDrop: () => ctx.signal('move1') });
      R.roads = roadsAt(312);
      await wait(300);
      await R.roads.start();
    },
    tasks: [
      {
        type: 'signal', wait: 'move1', prompt: '1장에서 만든 식이에요. 분모 <b>P(무료)</b>를 왼쪽으로 끌어 옮겨 볼까요? (양쪽에 P(무료)를 곱하는 것과 같아요)', ok: '분모가 사라지고 곱셈이 되었어요.',
        then: async ctx => {
          await morphEq(R.eq1, `<span class="road-tag r1">길 ①</span>${K('post', B_POST)} × <span class="term moved">${B_EVID}</span> = ${K('joint', `<span class="sp">${B_JOINT}</span>`)}`);
          // 곱셈 규칙을 길로 읽는다: 전체 → ‘무료’로 좁히고 → 그중 스팸으로 한 번 더
          await R.roads.run(0);
          // 반대 방향의 같은 식(2장 앞 장면의 P(무료|스팸))
          R.eq2 = h('div', { class: 'fx' }); at(R.eq2, 0, 198, { fontSize: '28px' }); FRONT().append(R.eq2);
          R.eq2.innerHTML = `<span class="road-tag r2">길 ②</span><span class="zone" id="z2">${K('lik', B_LIK)}</span> = ${F(K('joint', B_JOINT), `<button type="button" class="term" aria-label="P(스팸)을 왼쪽으로 옮기기">${B_PRIOR}</button>`)}`;
          centerX(R.eq2); pop(R.eq2);
          dragTerm(R.eq2.querySelector('.term'), { targets: () => [R.eq2.querySelector('#z2')], onDrop: () => ctx.signal('move2') });
        },
      },
      {
        type: 'signal', wait: 'move2', prompt: '이번엔 순서를 바꿔 <b>스팸부터</b> 좁히는 식이에요. 분모 <b>P(스팸)</b>도 왼쪽으로 옮겨 볼래요?', ok: '같은 겹침을 다른 길로 썼어요.',
        then: async () => {
          await morphEq(R.eq2, `<span class="road-tag r2">길 ②</span>${K('lik', B_LIK)} × <span class="term moved">${B_PRIOR}</span> = ${K('joint', `<span class="sp">${B_JOINT}</span>`)}`);
          await R.roads.run(1);
          const note = centerNote('<span class="r1c">6/20 × 5/6</span> = <span class="r2c">8/20 × 5/8</span> = <b class="sp">5/20</b> — 어느 순서로 좁혀도 <b>같은 겹침</b>. 그러니 두 곱은 서로 같습니다.', 578, 'big-note');
          await pop(note);
        },
      },
    ],
    done: '<b>다음 ▶</b>에서 두 식을 이어 베이즈 정리를 완성합니다.',
  },

  /* ---------------- 6. 베이즈 정리 완성 ---------------- */
  {
    ch: 2, kicker: '2장 · 베이즈 정리', title: '알고 싶은 것만 남기면 베이즈 정리',
    say: '두 곱은 같은 겹침이므로 등호로 이을 수 있어요. 그다음 <b>알고 싶은 P(스팸 | 무료)만 혼자 남기면</b> 베이즈 정리가 됩니다. 조건의 <b>방향을 뒤집는</b> 식이에요.',
    async enter(ctx) {
      R = {};
      // 앞 장면의 두 곱이 내려와 하나의 등식으로 합쳐진다.
      const l = h('div', { class: 'fx' }, h('span', { html: `<span class="road-tag r1">길 ①</span>${B_POST} × ${B_EVID}` }));
      const r = h('div', { class: 'fx' }, h('span', { html: `<span class="road-tag r2">길 ②</span>${B_LIK} × ${B_PRIOR}` }));
      at(l, 0, 142, { fontSize: '26px' }); at(r, 0, 196, { fontSize: '26px' }); FRONT().append(l, r); centerX(l); centerX(r);
      pop(l); pop(r, { delay: 120 });
      const eq = h('div', { class: 'fx' }); at(eq, 0, 290, { fontSize: '32px' }); FRONT().append(eq); R.eq = eq;
      eq.innerHTML = `${K('post', B_POST)} × <button type="button" class="term" aria-label="P(무료)를 오른쪽으로 옮기기">${B_EVID}</button> <b class="eqsign">=</b> <span class="zone" id="zr">${K('lik', B_LIK)} × ${K('prior', B_PRIOR)}</span>`;
      centerX(eq); eq.style.opacity = 0;
      await wait(500);
      // 두 줄이 내려와 겹치는 순간, 그 자리에 등식이 꾹 찍혀 나온다.
      const [g1, g2] = await Promise.all([flight(l, eq.querySelector('[data-k="post"]'), { html: l.innerHTML, cls: 'plain', lift: 10 }), flight(r, eq.querySelector('#zr'), { html: r.innerHTML, cls: 'plain', lift: -10, delay: 120 })]);
      await Promise.all([press(g1, eq), g2 && press(g2, null)]);
      stamp(eq.querySelector('.eqsign'));
      R.top = [l, r, centerNote(`둘 다 ${B_JOINT}(겹침 5/20)이므로 등호로 잇는다`, 248)];
      pop(R.top[2], { delay: 150 });
      dragTerm(eq.querySelector('.term'), { targets: () => [eq.querySelector('#zr')], onDrop: () => ctx.signal('move3') });
      await wait(400);
    },
    tasks: [
      {
        type: 'signal', wait: 'move3', prompt: '알고 싶은 건 <b>P(스팸 | 무료)</b>예요. 혼자 남기려면 P(무료)를 어디로 보내야 할까요? 오른쪽으로 끌어 보세요.', ok: '베이즈 정리 완성!',
        then: async () => {
          // 재료가 된 두 곱은 물러나고, 식만 남긴다.
          R.top.forEach(e => anim(e, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 260 }).then(() => e.remove()));
          await morphEq(R.eq, `${K('post', B_POST)} <b class="eqsign">=</b> ${F(`${K('lik', B_LIK)} × ${K('prior', B_PRIOR)}`, `<span class="term moved">${B_EVID}</span>`)}`);
          burst(R.eq, { color: '#ffc845', rays: 14 });
          const q = k => R.eq.querySelector(`[data-k="${k}"]`);
          roleLabel(q('post'), '사후확률<br><small>알고 싶은 것</small>', 'post', true); await wait(260);
          roleLabel(q('lik'), '가능도 <small>스팸 속 ‘무료’ 비율</small>', 'lik', false); await wait(260);
          roleLabel(q('prior'), '사전확률 <small>원래 스팸 비율</small>', 'prior', false); await wait(260);
          roleLabel(R.eq.querySelector('.moved'), '증거 <small>‘무료’가 나올 확률</small>', 'evid', true); await wait(420);
          // 숫자를 넣어 1장에서 센 5/6과 같은지 확인한다.
          const num = fxAt(`숫자로: ${F('<span class="wd">5/8</span> × <span class="hm">8/20</span>', '<span style="color:#3451c9">6/20</span>')} = <span class="answer">5/6</span>`, 660, 494, { size: 26 });
          const ans = num.querySelector('.answer'); ans.style.opacity = 0;
          await pop(num);
          await wait(300);
          await stamp(ans, { color: '#2aa198' });
          const chk = tagHm('✓ 1장에서 직접 센 5/6과 같다'); at(chk, 660, 604); FRONT().append(chk); await pop(chk);
        },
      },
      {
        type: 'choice', prompt: '이 식이 왜 쓸모 있을까요?', focus: () => [R.eq],
        options: [
          { label: '셀 수 있는 값으로 알고 싶은 값을 구해서', correct: true, msg: '맞아요. 스팸 속 단어 비율(가능도)처럼 모으기 쉬운 값으로, 새 문자가 스팸일 확률(사후확률)을 구합니다.' },
          { label: '계산이 더 짧아서', correct: false, msg: '계산 길이 때문이 아니에요. 알고 싶은 값을 직접 셀 수 없을 때 아는 값으로 바꿔 구하려는 거예요.' },
          { label: '결과가 항상 커져서', correct: false, msg: '사전확률이 작으면 결과도 작아질 수 있어요. 다음 장면에서 직접 확인해 봅시다.' },
        ],
      },
    ],
    done: '베이즈 정리 = <b>같은 겹침을 두 길로 쓰고, 알고 싶은 것만 남긴 식</b>. <b>다음 ▶</b>',
  },

  /* ---------------- 7. 분모 펼치기(넓이 모델) ---------------- */
  {
    ch: 2, kicker: '2장 · 베이즈 정리', title: '분모 P(무료)를 펼치면',
    say: '빈 도화지 전체를 <b>확률 1</b>(문자 20통 전체)로 봅니다. 연필로 선을 그어 나눌 때마다 조각의 <b>넓이 = 확률</b>이에요. 세로선은 사전확률, 가로선은 가능도, 조각 넓이는 <b>가로 × 세로</b>(곱셈 규칙)입니다.',
    async enter(ctx) {
      R = { areaPhase: 'blank' };
      const x = 700, w = GRID.R - x;
      R.read = h('div', { class: 'eq-card area-explain' }); at(R.read, x, GRID.top, { width: `${w}px` }); FRONT().append(R.read);
      R.meter = meterAt(x, 552, w);
      let armed = false;
      R.model = areaModel(GRID.L - 20, GRID.top - 30, ctx, st => {
        const num = st.p * st.a, ham = (1 - st.p) * st.b, den = num + ham, post = num / den;
        const ph = R.areaPhase;
        if (ph === 'blank') {
          R.read.innerHTML = '<b>도화지 전체 = 확률 1</b>'
            + '<div class="area-piece">문자 20통 전체를 넓이 1인 직사각형으로 봐요.</div>'
            + '<small>선을 그어 나누면 각 조각의 넓이가 그 조각의 확률이 됩니다.</small>';
        } else if (ph === 'width') {
          R.read.innerHTML = '<b>① 세로선: 가로 길이 = 사전확률</b>'
            + `<div class="area-piece spam">${P(SP)} = 8/20 = <b>40%</b></div><div class="area-piece ham">${P(HM)} = 12/20 = <b>60%</b></div>`
            + '<small>40% + 60% = 1 → 두 기둥이 도화지를 빈틈없이 나눠요.</small>';
        } else if (ph === 'height') {
          R.read.innerHTML = '<b>② 가로선: 세로 길이 = 가능도</b>'
            + `<div class="area-piece spam"><b class="sp">빗금 = 스팸 ∩ 무료</b><br>${P(SP)} × ${B_LIK} = 40% × 62.5% = <b>${pct(num, 2)}</b></div>`
            + `<div class="area-piece ham"><b class="hm">점무늬 = 정상 ∩ 무료</b><br>${P(HM)} × ${P(W('무료'), HM)} = 60% × 1/12 ≈ <b>${pct(ham, 2)}</b></div>`
            + `<small>조각 넓이 = 가로 × 세로 = 곱셈 규칙.<br>‘무료’가 든 조각을 모두 더하면 ${B_EVID} = ${pct(den, 2)}</small>`;
        } else {
          R.read.innerHTML = '<b>③ 베이즈 정리 = 내 조각 ÷ 남은 조각의 합</b>'
            + `<div class="fx" style="position:static;font-size:20px;margin-top:6px">${B_POST} = ${F(`<span class="sp">${pct(num, 2)}</span>`, `<span class="hl-den">${pct(num, 2)} + ${pct(ham, 2)}</span>`)} ≈ ${pct(post)}</div>`
            + `<small style="margin-top:8px">분자: 빗금 = ${P(SP)} × ${B_LIK}<br>분모: 빗금 + 점무늬 = ${B_EVID}</small>`;
        }
        const showMeter = R.gathered && ph !== 'blank' && ph !== 'width' && ph !== 'height';
        R.meter.bar.style.visibility = R.meter.label.style.visibility = showMeter ? '' : 'hidden';
        if (showMeter) R.meter.set(post, 0);
        R.post = post;
        if (armed && post < 0.5) ctx.signal('below');
      });
      pop(R.model.svg); pop(R.read, { delay: 120 });
      // 선을 다 그으면 곧바로 두 기둥이 칠해지고 식이 붙는다(정답 문구보다 먼저).
      R.model.cut('v').then(async () => { R.areaPhase = 'width'; R.model.phase('width'); await R.model.afterV(); ctx.signal('cutV'); });
      armed = true;
      await wait(500);
    },
    tasks: [{
      type: 'signal', wait: 'cutV', focus: () => [R.model.guides.v, R.read],
      prompt: '빈 도화지 전체가 확률 1이에요. 파란 점선을 따라 연필로 <b>세로선</b>을 그어 스팸과 정상으로 나눠 볼까요? (끌어서 긋거나, 눌러도 돼요)',
      ok: '가로 길이가 P(스팸) = 8/20, P(정상) = 12/20이 되었어요.',
      then: async ctx => {
        // 다음: 두 기둥 안에 가로선
        let n = 0;
        for (const k of ['a', 'b']) R.model.cut(k).then(async () => { await R.model.afterH(k); if (++n === 2) ctx.signal('cutH'); });
      },
    }, {
      type: 'signal', wait: 'cutH', focus: () => [...['a', 'b'].map(k => R.model.guides[k]).filter(g => g.style.display !== 'none'), R.read],
      prompt: '이번엔 각 기둥 안을 ‘무료’가 있는지로 나눠요. 두 점선을 따라 <b>가로선</b>을 그어 보세요. 스팸 기둥은 5/8, 정상 기둥은 1/12 높이예요.',
      ok: '조각마다 넓이 = 가로 × 세로. 네 조각을 모두 더하면 다시 1이에요.',
      then: async () => {
        R.areaPhase = 'height'; R.model.draw();
        await R.model.sumCheck();
      },
    }, {
      type: 'action', label: '두 조각 모아 보기', focus: () => [R.model.spamShade, R.model.hamShade, R.read],
      prompt: '‘무료’가 들어 있다는 걸 알면, 남는 세계는 <b>빗금(25%)과 점무늬(5%) 두 조각뿐</b>입니다. 두 조각을 모아 볼까요?',
      ok: '‘무료’ 세계(30%)를 다시 100%로 늘리면, 그중 빗금이 사후확률이에요.',
      then: async () => { await gatherPieces(); R.areaPhase = 'prior'; R.model.phase('prior'); },
      hold: 600,
    }, {
      type: 'signal', wait: 'below', prompt: '위의 <b>노란 ●</b>을 왼쪽으로 끌어 세로선을 옮겨 보세요. <b>사전확률</b>만 줄였을 때 스팸일 확률이 <b>50% 미만</b>이 되게 해 볼까요? (← →)',
      ok: () => `P(스팸)을 ${pct(R.model.st.p, 0)}로 줄이니 빗금이 좁아져서, ‘무료’가 있어도 스팸일 확률이 ${pct(R.post)}로 떨어졌어요.`,
      then: async () => {
        R.areaPhase = 'free'; R.model.phase('free');
        pop(noteAt('이제 흰 막대로 가로선도 옮길 수 있어요. 분모는 항상 <b>빗금 + 점무늬</b>입니다.', 44, 600, 620), { delay: 100 });
      },
    }],
    done: '사후확률 = 내 조각 ÷ 모든 조각의 합. <b>다음 ▶</b>에서 단어가 여러 개인 문자로 넘어갑니다.',
  },

  /* ---------------- 7-1. 다른 예: 검사 양성(사전확률의 힘) ---------------- */
  {
    ch: 2, kicker: '2장 · 다른 예', title: '검사에서 양성이면 정말 병일까?',
    say: '1000명 중 10명(1%)만 걸리는 병이 있어요. 검사는 병이 있으면 90%를 양성으로 잡지만, 병이 없어도 10%는 양성으로 잘못 나옵니다. 베이즈 정리는 여기서 <b>사전확률(1%)</b>이 얼마나 큰 힘을 갖는지 보여 줘요.',
    async enter(ctx) {
      R = {};
      const svg = sv('svg', { width: 1192, height: 250, viewBox: '0 0 1192 250', 'aria-hidden': 'true', style: 'overflow:visible' });
      at(svg, GRID.L, 160, { position: 'absolute' }); BACK().append(svg); R.svg = svg;
      R.dots = Array.from({ length: TEST.n }, (_, k) => {
        const sick = TEST.sick.includes(k), cx = 8 + (k % 50) * 11, cy = 10 + Math.floor(k / 50) * 11;
        const c = sv('circle', { cx, cy, r: sick ? 4.6 : 3.8, fill: sick ? '#ee6c55' : '#9fd8d1', stroke: sick ? '#1f2a44' : 'none', 'stroke-width': 1.5 });
        c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center';
        svg.append(c); return c;
      });
      anim(svg, [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
      R.legend = noteAt('<b>1000명</b> · <b class="sp">● 병 있음 10명 (1%)</b> · <span class="hm">● 병 없음 990명</span>', GRID.L, 392, 560);
      pop(R.legend, { delay: 300 });
      R.info = h('div', { class: 'eq-card test-info' }); at(R.info, 660, 160, { width: `${GRID.R - 660}px` }); FRONT().append(R.info);
      R.info.innerHTML = '<b>검사의 성능</b><div class="area-piece spam">병이 있으면 → <b>90%</b> 양성 ' + `<small>${P('양성', '병')} = 0.9</small></div>`
        + `<div class="area-piece ham">병이 없어도 → <b>10%</b> 양성(거짓 양성) <small>${P('양성', '건강')} = 0.1</small></div>`;
      pop(R.info, { delay: 200 });
      await wait(700);
    },
    tasks: [
      {
        type: 'choice', any: true, prompt: '검사에서 <b>양성</b>이 나왔어요. 이 사람이 정말 병이 있을 확률은 얼마쯤일까요? 먼저 예측해 보세요.', focus: () => [R.info],
        options: ['약 90%', '약 50%', '약 10%'].map(label => ({ label, msg: `예측: ${label}. 1000명을 직접 검사해서 확인해 봐요.` })),
        then: async () => { R.guess = $('#taskControls .pick.chosen')?.textContent || ''; },
      },
      {
        type: 'action', label: '1000명 검사하기', focus: () => [R.svg],
        prompt: '1000명 모두 검사해 볼까요? 양성이 나온 사람에게 노란 고리가 생겨요.',
        then: async () => {
          const pos = [...TEST.sickPos, ...TEST.healthyPos];
          pos.forEach((k, j) => {
            const d = R.dots[k];
            setTimeout(() => { d.setAttribute('stroke', '#e0a400'); d.setAttribute('stroke-width', 3); if (!TEST.sick.includes(k)) d.setAttribute('fill', '#2aa198'); if (j % 6 === 0) Sound.play('tick'); }, T(j * 14));
          });
          await wait(pos.length * 14 + 300);
          R.legend.innerHTML = `양성 <b>108명</b> = <b class="sp">병 있음 9명</b> (10명 × 90%) + <b class="hm">병 없음 99명</b> (990명 × 10%)`; flash(R.legend);
        },
      },
      {
        type: 'action', label: '양성만 모으기', focus: () => [R.svg, R.legend],
        prompt: '‘양성’이라는 걸 알면, <b>양성 108명</b>이 새로운 전체예요. 양성인 사람만 모아 볼까요?',
        then: async () => {
          const pos = [...TEST.sickPos, ...TEST.healthyPos], keep = new Set(pos);
          R.dots.forEach((d, k) => { if (!keep.has(k)) anim(d, [{ opacity: 1 }, { opacity: .15 }], { duration: 400 }); });
          anim(R.info, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).then(() => R.info.remove());
          // 병 있는 9명을 맨 앞에 두고 12 × 9로 모은다.
          Sound.play('fly');
          await Promise.all(pos.map((k, j) => {
            const d = R.dots[k], cx = +d.getAttribute('cx'), cy = +d.getAttribute('cy'), tx = 700 + (j % 12) * 26, ty = 14 + Math.floor(j / 12) * 24;
            return anim(d, [{ transform: 'none' }, { transform: `translate(${tx - cx}px, ${ty - cy}px) scale(2.1)` }], { duration: 900, delay: j * 6, easing: 'cubic-bezier(.65,0,.25,1)' });
          }));
          Sound.play('land');
          // 모인 108명: 병 있는 9명은 진하게, 거짓 양성 99명은 청록으로
          pos.forEach(k => { const d = R.dots[k], sick = TEST.sick.includes(k); d.setAttribute('fill', sick ? '#ee6c55' : '#2aa198'); d.setAttribute('stroke', sick ? '#1f2a44' : '#fffdf8'); d.setAttribute('stroke-width', sick ? 2.2 : 1); });
          R.group = noteAt('양성 108명 중 <b class="sp">● 병 있음 9명</b>뿐', 744, 392, 420);
          pop(R.group);
          await wait(400);
          const card = h('div', { class: 'eq-card' }); at(card, GRID.L, 452, { width: `${GRID.R - GRID.L}px` }); FRONT().append(card);
          card.innerHTML = `<div class="fx" style="position:static;font-size:24px">${P('병', '양성')} = ${F('<span class="sp">9</span>', '<span class="sp">9</span> + <span class="hm">99</span>')} = `
            + `${F(`<span class="hl-num">0.9 × 0.01</span>`, `<span class="hl-num">0.9 × 0.01</span> + <span class="hl-den">0.1 × 0.99</span>`)} <b class="answer test-ans">≈ 8.3%</b></div>`;
          const ans = card.querySelector('.test-ans'); ans.style.opacity = 0;
          await pop(card);
          await wait(300);
          await stamp(ans, { color: '#ee6c55' });
          R.card = card;
        },
        hold: 700,
      },
      {
        type: 'choice', prompt: () => `예측은 <b>${R.guess || '?'}</b>, 실제는 <b>약 8%</b>. 병이 있는 사람의 90%를 양성으로 찾는데, 양성 중 실제 환자는 왜 이렇게 적을까요?`, focus: () => [R.card],
        options: [
          { label: '사전확률이 1%로 아주 작아서', correct: true, msg: '맞아요. 건강한 990명의 10%(99명)가 진짜 환자 9명을 덮어 버려요. 그래서 베이즈 정리는 가능도에 반드시 사전확률을 곱합니다.' },
          { label: '검사 기계가 고장 나서', correct: false, msg: '검사 성능은 처음 그대로(90%, 10%)예요. 문제는 병 있는 사람이 원래 아주 적다는 것이에요.' },
          { label: '계산이 틀려서', correct: false, msg: '계산은 맞아요. 9 ÷ 108 ≈ 8.3%. 직관이 사전확률을 빠뜨리기 쉬운 거예요.' },
        ],
      },
    ],
    done: '사후확률 = 가능도 × <b>사전확률</b> ÷ 증거. 사전확률이 작으면 좋은 검사도 결과가 작아져요. <b>다음 ▶</b>',
  },

  /* ---------------- 8. 단어가 여러 개라면 ---------------- */
  {
    ch: 3, deck: true, kicker: '3장 · 나이브 베이즈', title: '단어가 여러 개면 무엇이 문제일까?',
    say: '처음 문자에는 ‘무료’, ‘쿠폰’, ‘당첨’이 함께 있어요. 베이즈 정리를 그대로 쓰면 가능도 자리에 <b>세 단어가 함께 나올 확률</b>이 들어갑니다.',
    async enter(ctx) {
      R = {};
      Deck.reset(); Deck.labelAll(true);
      R.f = fxAt(`${P(SP, WORDS3)} = ${F(`<span class="hl" id="joint">${P(WORDS3, SP)}</span> × ${P(SP)}`, P(WORDS3))}`, 0, GRID.top, { size: 23 }); centerX(R.f); pop(R.f);
      await Deck.show(grid(ORDER, { ...DECK_GRID, y0: 252, gy: 10 }));
      R.chip = topChip('세 단어 모두 든 문자 찾기', ctx, 'all3');
      await wait(300);
    },
    tasks: [
      {
        type: 'signal', wait: 'all3', prompt: '노란 부분을 구하려면 스팸 중 세 단어가 <b>모두</b> 든 문자를 세야 해요. 오른쪽 위 단추로 찾아볼까요?', ok: '세 단어가 모두 든 문자는 단 1통이에요.',
        then: async () => {
          const words = ['무료', '쿠폰', '당첨'], match = ORDER.filter(id => words.every(w => has(id, w)));
          await Deck.mark(words, ORDER, 25);
          Deck.dim(ORDER.filter(id => !match.includes(id))); Deck.focus(match);
          await Deck.to(Object.fromEntries(match.map(id => [id, { s: 1.12 }])), { ms: 500 });
          const s = match.filter(id => MSG[id].spam).length, hh = match.length - s;
          pop(rowAt([tagSp(`! 스팸 8통 중 <b>${s}</b>통`), tagHm(`✓ 정상 12통 중 <b>${hh}</b>통`)], GRID.L, 558));
        },
      },
      {
        type: 'choice', prompt: '이 1통, 0통만 보고 ‘세 단어가 함께 나올 확률’을 정해도 될까요?',
        options: [
          { label: '괜찮다', correct: false, msg: '1통, 0통은 우연에 크게 흔들려요. 정상 문자에 세 단어가 함께 나온 적이 없을 뿐, 앞으로도 없다고 장담할 수 없죠.' },
          { label: '데이터가 너무 적다', correct: true, msg: '맞아요. 1통, 0통은 우연에 크게 흔들려요. 그런데 단어가 늘면 더 심각해집니다. 직접 볼까요?' },
        ],
        then: async ctx => {
          R.chip.remove();
          R.chip = topChip('조합마다 칸 나누기', ctx, 'grow1');
          await wait(200);
        },
      },
      {
        type: 'signal', wait: 'grow1', prompt: '세 단어가 각각 <b>있다/없다</b>로 나뉘니 조합은 2 × 2 × 2 = <b>8가지</b>예요. 오른쪽 위 단추로 20통을 조합 칸에 나눠 담아 볼까요?',
        then: async ctx => {
          FRONT().querySelectorAll('.row-flex').forEach(e => anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 }).then(() => e.remove()));
          Deck.dim([]); Deck.focus([]); Deck.mark([]); Deck.tokens(true);
          R.combo = comboCells(['무료', '쿠폰', '당첨'], 4);
          await cardsIntoCells(R.combo.cells, { s: 0.3, top: 34, perRow: 4 });
          R.combo.cells.forEach(c => {
            const sp = c.ids.filter(id => MSG[id].spam).length, hm = c.ids.length - sp;
            c.el.classList.toggle('empty', !c.ids.length);
            c.el.append(h('span', { class: 'cell-count' }, c.ids.length ? `스팸 ${sp} · 정상 ${hm}` : '0통'));
          });
          const last = R.combo.cells.at(-1).el; burst(last, { color: '#ee6c55' });
          const empty = R.combo.cells.filter(c => !c.ids.length).length, few = R.combo.cells.filter(c => c.ids.length === 1).length;
          R.cnote = centerNote(`칸 <b>8</b>개 중 빈 칸 <b class="sp">${empty}</b>개, 1통뿐인 칸 <b>${few}</b>개 — 맨 끝 ‘세 단어 모두’ 칸에는 스팸 1통뿐`, 542, 'big-note');
          await pop(R.cnote);
          R.chip.remove();
          R.chip = topChip('단어를 더 늘리면?', ctx, 'grow2');
        },
      },
      {
        type: 'signal', wait: 'grow2', prompt: '실제 필터는 ‘대출’, ‘이벤트’, ‘100%’, ‘추천’처럼 스팸에 자주 나오는 단어를 더 봐요. 단어가 하나 늘 때마다 칸은 <b>2배</b>! 단추를 눌러 단어를 더해 보세요.',
        then: async () => {
          // 8칸 그림을 접고, 스팸에 자주 나오는 단어를 하나씩 더하며 칸이 두 배씩 늘어나는 것을 본다(문자는 실제 자기 칸에 들어간다).
          anim(R.combo.wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 }).then(() => R.combo.wrap.remove());
          Deck.to(Object.fromEntries(ORDER.map(id => { const c = Deck.cards[id]; return [id, { o: 0, s: c.s * .5 }]; })), { ms: 300 });
          const chips = SPAM_WORDS.map((w, k) => h('span', { class: `word-chip${k < 3 ? ' on' : ''}` }, w));
          const strip = rowAt(chips, 0, 262, { align: 'center', gap: 8 });
          chips.slice(3).forEach(c => { c.style.opacity = 0; });
          pop(strip);
          let grid = null;
          for (let n = 3; n <= SPAM_WORDS.length; n++) {
            if (n > 3) { const c = chips[n - 1]; c.classList.add('on'); await pop(c, { duration: 260 }); flash(c); }
            const next = wordGrid(SPAM_WORDS.slice(0, n));
            Sound.play('grow');
            if (grid) { const old = grid.svg; anim(old, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).then(() => old.remove()); }
            grid = next;
            const empty = grid.cells - grid.filled;
            R.cnote.innerHTML = `단어 <b>${n}</b>개 → 칸 <b>${fmtInt(grid.cells)}</b>개 · 문자가 든 칸 <b>${grid.filled}</b>개 · 빈 칸 <b class="sp">${fmtInt(empty)}</b>개`;
            await wait(n < 6 ? 900 : 650);
          }
          R.cnote.innerHTML = `단어 10개 → 칸 <b>1,024</b>개인데 문자는 <b>20</b>통 → <b class="sp">${fmtInt(grid.cells - grid.filled)}</b>칸이 0통`;
          await stamp(R.cnote, { color: '#ee6c55' });
        },
        hold: 900,
      },
    ],
    done: '조합을 통째로 세면 칸 대부분이 0입니다. 노란 부분을 <b>셀 수 있는 모양</b>으로 바꿔야 해요. <b>다음 ▶</b>',
  },

  /* ---------------- 9. 왜 곱하기가 되는가 ---------------- */
  {
    ch: 3, kicker: '3장 · 나이브 베이즈', title: '나이브 가정: 왜 곱하기가 될까?',
    say: '2장의 곱셈 규칙을 단어마다 한 번씩 쓰면 정확한 식이 나와요. 그런데 뒤 단어들에 붙은 <b>빨간 조건</b> 때문에 여전히 조합을 세야 합니다.',
    async enter(ctx) {
      R = { erased: 0 };
      const er = (txt, k) => `<button type="button" class="erase" data-k="${k}" aria-label="조건 ${txt} 지우기">${txt}</button>`;
      R.f = fxAt(`${P(WORDS3, SP)} = ${P(W('무료'), SP)} × ${P(W('쿠폰'), `${er('무료,', 0)} ${SP}`)} × ${P(W('당첨'), `${er('무료, 쿠폰,', 1)} ${SP}`)}`, 0, GRID.top, { size: 24 });
      centerX(R.f); pop(R.f);
      R.why = centerNote('“스팸이고 <b>‘무료’도 있을 때</b> ‘쿠폰’이 나올 확률” — 이걸 세려면 여전히 ‘무료’가 든 스팸만 골라야 해요.', 214);
      pop(R.why, { delay: 150 });
      R.f.querySelectorAll('.erase').forEach(b => b.addEventListener('click', () => {
        if (b.classList.contains('gone')) return;
        b.classList.add('gone'); b.disabled = true; burst(b, { color: '#c63a2f', rays: 8 });
        anim(b, [{ opacity: 1, maxWidth: '400px' }, { opacity: 0, maxWidth: '0px', paddingLeft: '0px', paddingRight: '0px', marginLeft: '0px' }], { duration: 520, delay: 350 }).then(() => { b.remove(); centerX(R.f); });
        if (++R.erased === 2) setTimeout(() => ctx.signal('erased'), T(900));
      }));
      await wait(450);
    },
    tasks: [
      {
        type: 'signal', wait: 'erased', prompt: '나이브 가정: “분류가 스팸으로 주어졌다면, 다른 단어의 존재가 이 단어 확률을 더 바꾸지 않는다”고 <b>근사</b>합니다. 원인을 말하는 가정은 아니에요. 이 가정으로 <b>빨간 조건 두 개</b>를 눌러 지워 볼까요?', ok: '조건이 사라지고 단순한 곱이 되었어요.',
        then: async ctx => {
          anim(R.why, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).then(() => R.why.remove());
          pop(centerNote('이제 각 칸은 <b>스팸 8통 전체</b>에서 단어 하나씩만 세면 돼요. 1통이 아니라 8통으로 셀 수 있습니다.', 214));
          const tbl = h('table', { class: 'lik' });
          tbl.innerHTML = '<thead><tr><th class="word">단어 (눌러서 세기)</th><th class="sp">! 스팸 8통 중</th><th class="hm">✓ 정상 12통 중</th></tr></thead><tbody></tbody>';
          R.opened = new Set();
          for (const w of ['무료', '쿠폰', '당첨']) {
            const tr = h('tr', { 'data-w': w });
            const btn = h('button', { type: 'button', class: 'btn pulse' }, w);
            btn.addEventListener('click', async () => {
              btn.classList.remove('pulse'); btn.disabled = true;
              const [sc, hc] = tr.querySelectorAll('td');
              if (count('ham', w) === 0) hc.classList.add('zero');
              await Promise.all([fillSlot(sc.querySelector('.qslot'), F(count('spam', w), N.spam)), fillSlot(hc.querySelector('.qslot'), F(count('ham', w), N.ham))]);
              R.opened.add(w); if (R.opened.size === 3) setTimeout(() => ctx.signal('table'), T(500));
            });
            tr.append(h('th', { class: 'word' }, btn), h('td', null, h('span', { class: 'qslot' }, '?')), h('td', null, h('span', { class: 'qslot' }, '?')));
            tbl.querySelector('tbody').append(tr);
          }
          at(tbl, GRID.L, 268, { width: '640px' }); FRONT().append(tbl); pop(tbl);
          R.param = paramCard(708, 268, GRID.R - 708); pop(R.param.card, { delay: 150 });
        },
      },
      {
        type: 'signal', wait: 'table', prompt: '세 단어를 하나씩 눌러, 각 단어가 스팸·정상 문자에 몇 통씩 나왔는지 세어 보세요.', ok: '세 칸 모두 충분한 문자로 셀 수 있어요. 단, 정상 쪽 ‘당첨’은 0통이에요.',
        then: () => R.param.run(),
        hold: 800,
      },
    ],
    done: '나이브 가정 덕분에 <b>조합 대신 단어별 곱</b>이 됩니다. <b>다음 ▶</b>에서 분모를 정리합니다.',
  },

  /* ---------------- 10. 왜 분모가 사라지고 ∝가 될까 ---------------- */
  {
    ch: 3, kicker: '3장 · 나이브 베이즈', title: '분모는 왜 사라지고 ∝가 될까?',
    say: '판정은 “스팸일 확률”과 “정상일 확률” 중 어느 쪽이 큰지 <b>비교</b>하는 일이에요. 두 식을 나란히 놓고 분모를 살펴봅시다.',
    async enter(ctx) {
      R = {};
      const half = colX(2, 0), right = colX(2, 1);
      const mk = (cls, label) => `${P(cls, '단어들')} <span class="rel">=</span> ${F(`${P('단어들', cls)} × ${P(cls)}`, `<button type="button" class="denom" aria-label="공통 분모 지우기">${P('단어들')}</button>`)}`;
      R.a = h('div', { class: 'eq-card' }); at(R.a, half.x, GRID.top, { width: `${half.w}px` });
      R.a.innerHTML = `<p class="note" style="position:static;margin:0 0 6px"><b class="sp">! 스팸일 확률</b></p><div class="fx" style="position:static;font-size:24px">${mk(SP)}</div>`;
      R.b = h('div', { class: 'eq-card' }); at(R.b, right.x, GRID.top, { width: `${right.w}px` });
      R.b.innerHTML = `<p class="note" style="position:static;margin:0 0 6px"><b class="hm">✓ 정상일 확률</b></p><div class="fx" style="position:static;font-size:24px">${mk(HM)}</div>`;
      FRONT().append(R.a, R.b); pop(R.a); pop(R.b, { delay: 100 });
      const cancel = () => ctx.signal('cancel');
      [R.a, R.b].forEach(c => c.querySelector('.denom').addEventListener('click', cancel));
      await wait(450);
      [R.a, R.b].forEach(c => { const d = c.querySelector('.denom'); d.classList.add('pulse'); });
    },
    tasks: [
      {
        type: 'choice', prompt: '두 식에서 <b>똑같은 부분</b>은 어디일까요?',
        options: [
          { label: '분모 P(단어들)', points: () => [...FRONT().querySelectorAll('.denom')], correct: true, msg: '맞아요. 같은 문자를 판정하니까 분모 P(단어들)는 두 식에서 똑같아요.' },
          { label: '분자', points: () => [R.a, R.b].map(c => c.querySelector('.frac > span:first-child')), correct: false, msg: '분자에는 각각 스팸, 정상이 들어가서 달라요.' },
          { label: '같은 부분이 없다', correct: false, msg: '분모를 보세요. 둘 다 P(단어들)이에요.' },
        ],
        // 같은 수로 나누면 두 값이 같은 비율로 줄어들 뿐, 어느 쪽이 큰지는 그대로다.
        then: async () => {
          const card = h('div', { class: 'eq-card cmp' }); at(card, 0, 340, { width: '760px' }); FRONT().append(card); centerX(card);
          card.innerHTML = '<div class="cmp-row"><span class="sp">! 스팸 쪽 분자</span><div class="cmp-bar"><i class="s"></i></div></div>'
            + '<div class="cmp-row"><span class="hm">✓ 정상 쪽 분자</span><div class="cmp-bar"><i class="h"></i></div></div>'
            + '<p class="cmp-note">예시 막대 — 두 분자를 같은 P(단어들)로 나눠 봅니다.</p>';
          const [s, hh] = card.querySelectorAll('.cmp-bar i'), note = card.querySelector('.cmp-note');
          s.style.width = '80%'; hh.style.width = '48%';
          await pop(card);
          await wait(500);
          note.innerHTML = '<b>÷ P(단어들)</b> → 둘 다 같은 비율로 줄어들어요';
          await Promise.all([anim(s, [{ width: '80%' }, { width: '44%' }], { duration: 1000, easing: 'cubic-bezier(.65,0,.25,1)' }), anim(hh, [{ width: '48%' }, { width: '26.4%' }], { duration: 1000, easing: 'cubic-bezier(.65,0,.25,1)' })]);
          note.innerHTML = '길이는 바뀌어도 <b class="sp">스팸 쪽이 더 길다</b>는 사실은 그대로 ✓';
          await stamp(note, { color: '#ee6c55' });
          R.cmp = card;
        },
        hold: 700,
      },
      {
        type: 'signal', wait: 'cancel', prompt: '같은 수로 나눈 두 값은 크기 순서가 바뀌지 않아요. 비교만 할 거라면 분모는 필요 없겠죠? <b>분모를 눌러</b> 지워 보세요.', ok: '분모를 지우니 “=”가 “∝(비례)”가 되었어요.',
        then: async () => {
          if (R.cmp) anim(R.cmp, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(12px)' }], { duration: 260 }).then(() => R.cmp.remove());
          for (const c of [R.a, R.b]) {
            const d = c.querySelector('.denom'), rel = c.querySelector('.rel'), frac = d.closest('.frac');
            d.classList.remove('pulse'); d.disabled = true;
            await anim(d, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(20px)' }], { duration: 320 });
            const top = frac.firstElementChild.innerHTML;
            frac.outerHTML = `<span class="num-only">${top}</span>`;
            rel.textContent = '∝'; rel.classList.add('hl'); flash(rel);
          }
          await wait(300);
          const f = fxAt(`${P(SP, WORDS3)} ∝ ${P(SP)} × ${P(W('무료'), SP)} × ${P(W('쿠폰'), SP)} × ${P(W('당첨'), SP)}`, 0, 336, { size: 25 }); centerX(f);
          await stamp(f, { rays: 14 });
          await wait(300);
          pop(centerNote('앞 장면의 나이브 곱을 가능도 자리에 넣으면 <b>나이브 베이즈 공식</b> 완성. 이 값을 <b>스팸 점수</b>라고 부를게요.', 410));
          await wait(300);
          pop(centerNote('확률이 필요하면? <b>스팸 점수 ÷ (스팸 점수 + 정상 점수)</b> — 2장에서 분모를 “조각의 합”으로 펼친 것과 같은 원리예요.', 470, 'big-note'));
        },
      },
    ],
    done: '나이브 베이즈 = <b>공통 분모는 지우고(∝), 단어별 확률을 곱한다</b>. <b>다음 ▶</b>',
  },

  /* ---------------- 11. 저울로 비교: 복습 → 단어 하나의 조건을 양쪽 곱셈에 반영 ---------------- */
  {
    ch: 3, kicker: '3장 · 나이브 베이즈 · 복습', title: '다시 짚어보기: 단어가 있으면 어떤 계산을 할까?',
    progressKey: '공식대로 저울에 올려 보기',
    say: '앞에서 구한 <b>P(스팸 | 무료) = 5/6</b>을 저울로 다시 살펴봅니다. 단어를 가운데 상자에 놓으면, <b>그 단어가 있다는 조건을 반영해 양쪽 점수에 각각의 가능도를 곱합니다.</b> 더 큰 점수 쪽으로 판정하고 두 점수의 합으로 나누어 모델 확률을 구해요.',
    async enter(ctx) {
      const review = R = { used: new Set(), chips: {}, currentWord: null, s: PRIOR.spam, h: PRIOR.ham, sf: [N.spam, N.all], hf: [N.ham, N.all] };
      const fraction = ([n, d]) => d === 1 ? String(n) : `${n}/${d}`;
      const multiply = ([n, d], a, b) => {
        n *= a; d *= b;
        const gcd = (x, y) => y ? gcd(y, x % y) : x;
        const g = gcd(n, d); return [n / g, d / g];
      };
      const score = x => Math.abs(Number(x.toFixed(6)) - x) < 1e-12 ? dec(x, 6) : `≈ ${dec(x, 6)}`;
      review.storySlot = h('div', { class: 'balance-story-slot', 'aria-hidden': 'true' });
      at(review.storySlot, 756, 140, { position: 'absolute', width: '480px', height: '620px' }); FRONT().append(review.storySlot);
      review.message = h('div', { class: 'balance-message', html: `살펴볼 문자: ${markWords('[무료] 쿠폰 당첨! 지금 확인').map(el => typeof el === 'string' ? el : el.outerHTML).join('')}` });
      at(review.message, 44, 140, { width: '690px' }); FRONT().append(review.message);
      review.cards = ['spam', 'ham'].map((cls, k) => {
        const card = h('section', { class: `balance-calculation ${cls === 'spam' ? 'sp' : 'hm'}`, 'aria-label': cls === 'spam' ? '스팸 점수 계산' : '정상 점수 계산' });
        at(card, 44 + k * 359, 194, { width: '331px' }); FRONT().append(card); return card;
      });
      review.bal = balanceAt(172, 324);
      review.bal.svg.setAttribute('width', '432'); review.bal.svg.setAttribute('height', '240');
      review.bal.pans.forEach(pan => { pan.value.setAttribute('y', '132'); pan.value.setAttribute('font-size', '20'); pan.title.setAttribute('y', '181'); });
      review.bal.svg.classList.add('review-balance'); review.bal.svg.removeAttribute('aria-hidden');
      review.bal.svg.setAttribute('role', 'img'); review.bal.svg.setAttribute('aria-label', '점수가 더 큰 쪽으로 기울어지는 비교 저울');
      pop(review.bal.svg); review.bal.weigh(review.s, review.h);
      review.dropZone = h('div', { class: 'balance-drop', role: 'group', 'aria-label': '단어를 놓아 양쪽 점수에 가능도를 곱하는 곳', html: '<b>양쪽 점수에 반영</b><small>먼저 복습을 읽어요</small>' });
      at(review.dropZone, 296, 430, { width: '184px' }); FRONT().append(review.dropZone);
      review.compare = h('p', { class: 'balance-comparison', 'aria-live': 'polite' });
      at(review.compare, 44, 572, { width: '690px' }); FRONT().append(review.compare);
      const compare = () => {
        const post = review.s / (review.s + review.h), greater = review.s > review.h;
        review.compare.innerHTML = `<b>${greater ? '스팸' : '정상'} 점수가 더 커요 → ${greater ? '스팸' : '정상'} 판정</b><span> · 스팸일 모델 확률 ${pct(post)}</span>`;
      };
      const renderCards = (word, drop) => {
        ['spam', 'ham'].forEach((cls, k) => {
          const total = N[cls], hits = word ? count(cls, word) : null;
          const before = drop ? (k === 0 ? drop.beforeS : drop.beforeH) : k === 0 ? review.sf : review.hf;
          const after = k === 0 ? review.sf : review.hf;
          review.cards[k].innerHTML = word
            ? `<b>${cls === 'spam' ? '스팸' : '정상'} ${total}통 중 ‘${word}’ ${hits}통</b><span>P(${word} | ${cls === 'spam' ? '스팸' : '정상'}) = ${hits}/${total}</span><strong>${fraction(before)} × ${hits}/${total} = ${drop ? fraction(after) : '?'}</strong><small>${drop ? `현재 점수 ${score(k === 0 ? review.s : review.h)}` : '이 비율을 현재 점수에 곱해요'}</small>`
            : `<b>${cls === 'spam' ? '스팸' : '정상'} 전체 ${total}통 / 문자 ${N.all}통</b><strong>${total}/${N.all} = ${dec(PRIOR[cls], 1)}</strong><small>아직 단어를 반영하지 않은 사전확률</small>`;
        });
      };
      review.activate = word => {
        review.currentWord = word;
        Object.entries(review.chips).forEach(([w, chip]) => { chip.disabled = w !== word || review.used.has(w); chip.classList.toggle('ready', w === word); });
        review.dropZone.classList.add('ready');
        review.dropZone.innerHTML = `<b>양쪽 점수에 반영</b><small>‘${word}’${word === '무료' ? '를' : '을'} 여기에 놓기</small>`;
        review.message.querySelectorAll('.kw').forEach(el => el.classList.toggle('on', el.dataset.w === word));
        renderCards(word);
      };
      const add = word => {
        if (!ctx.alive() || app.transitioning || review.currentWord !== word || review.used.has(word)) return;
        const drop = { word, beforeS: [...review.sf], beforeH: [...review.hf] };
        review.currentWord = null; review.used.add(word);
        Object.values(review.chips).forEach(chip => { chip.disabled = true; chip.classList.remove('ready'); });
        review.chips[word].classList.add('used'); review.dropZone.classList.remove('ready');
        review.dropZone.innerHTML = `<b>‘${word}’ 포함 반영!</b><small>오른쪽에서 계산을 짚어봐요</small>`;
        review.s *= lik(word, 'spam'); review.h *= lik(word, 'ham');
        review.sf = multiply(review.sf, count('spam', word), N.spam);
        review.hf = multiply(review.hf, count('ham', word), N.ham);
        drop.afterS = fraction(review.sf); drop.afterH = fraction(review.hf);
        drop.formulaS = `${fraction(drop.beforeS)} × ${count('spam', word)}/${N.spam} = ${drop.afterS}`;
        drop.formulaH = `${fraction(drop.beforeH)} × ${count('ham', word)}/${N.ham} = ${drop.afterH}`;
        drop.post = review.s / (review.s + review.h);
        review.lastDrop = drop; renderCards(word, drop); compare();
        review.bal.weigh(review.s, review.h); review.cards.forEach(flash);
        ctx.signal('weighed', drop);
      };
      ['무료', '쿠폰', '당첨'].forEach((word, k) => {
        const chip = h('button', { type: 'button', class: 'chip balance-word', disabled: true, 'aria-label': `${word} 포함 조건을 양쪽 점수에 반영` }, word);
        at(chip, 212 + k * 116, 600); FRONT().append(chip); review.chips[word] = chip;
        draggable(chip, { targets: () => [review.dropZone], onDrop: () => add(word), onTap: () => add(word), onMiss: () => {
          if (ctx.alive() && review.currentWord === word) { setQuestionCollapsed(false); ctx.feedback(`‘${word}’${word === '무료' ? '를' : '을'} 가운데 ‘양쪽 점수에 반영’ 상자에 놓으세요. 놓으면 두 점수에 각각의 가능도를 곱합니다.`); showAsk(); }
        } });
      });
      renderCards(); compare();
      await wait(450);
    },
    tasks: [
      {
        type: 'action', focus: () => [], label: '복습했어요 · 저울 시작',
        prompt: '<b>이쯤에서 앞의 계산을 다시 짚어봅시다.</b><span class="balance-story-line">‘무료’가 있는 문자 6통 중 스팸은 5통이었죠. <b>P(스팸 | 무료) = 5/6</b>이었습니다.</span><span class="balance-story-line">이번에는 그 값을 <b>양쪽 점수를 계산하고 비교하는 저울</b>로 만들어 봐요. 아직 단어를 반영하기 전이라 스팸 8/20 = 0.4, 정상 12/20 = 0.6으로 <b>정상 점수가 더 큽니다.</b></span><span class="balance-story-line">단어를 놓는다는 것은 <b>‘이 문자에 그 단어가 있다’는 조건을 계산에 반영</b>하는 뜻이에요. 단어 하나씩, 실제 개수와 곱셈을 함께 보겠습니다.</span>',
        then: () => R.activate('무료'), hold: 0,
      },
      ...['무료', '쿠폰'].map((word, index) => ({
        type: 'signal', wait: 'weighed', focus: () => [], readAfterFeedback: true,
        resultPrompt: `‘${word}’${word === '무료' ? '를' : '을'} 놓으면 이 계산을 합니다.`,
        prompt: () => `<b>${index + 1}/3 · ‘${word}’${word === '무료' ? '가' : '이'} 있다는 조건을 반영해 봅시다.</b><span class="balance-story-line">${index === 0 ? '스팸 8통 중 무료 5통, 정상 12통 중 무료 1통입니다.' : '스팸 8통 중 쿠폰 4통, 정상 12통 중 쿠폰 1통입니다. 앞에서 만든 점수에 다음 단어의 비율을 곱해요.'}</span><span class="balance-story-line">‘${word}’ 칩을 가운데 <b>‘양쪽 점수에 반영’ 상자</b>로 드래그해 놓으세요. 놓으면 양쪽에 각각 <b>${count('spam', word)}/8과 ${count('ham', word)}/12를 곱합니다.</b> 칩을 누르거나 Enter로도 같은 계산을 할 수 있어요.</span>`,
        hints: [`‘${word}’ 포함 조건을 반영하는 단계예요.`, `스팸 점수에는 ${count('spam', word)}/8, 정상 점수에는 ${count('ham', word)}/12를 곱합니다.`, `‘${word}’ 칩을 가운데 점선 상자에 놓으세요. 눌러도 같은 계산입니다.`],
        readLabel: index === 0 ? '읽었어요 · 쿠폰 살펴보기' : '읽었어요 · 점수 비교',
        ok: drop => {
          drop ||= R.lastDrop;
          return `<span class="balance-story-line"><b>‘${word}’를 놓은 것은 ‘이 문자에 ${word}${word === '무료' ? '가' : '이'} 있다’를 양쪽 곱셈에 반영한 것입니다.</b></span><span class="balance-story-math sp">스팸: ${drop.formulaS}</span><span class="balance-story-math hm">정상: ${drop.formulaH}</span><span class="balance-story-line">${index === 0 ? '<b>0.25 > 0.05</b>로 스팸 점수가 더 커져 저울이 스팸 쪽으로 기울어요.' : '스팸 점수 0.125가 정상 점수 1/240보다 큽니다. 두 점수는 모두 작아졌어도 상대적인 크기가 달라져요. <b>각 분류 안에서 단어가 독립이라고 가정해</b> 단어별 비율을 곱하는 것이 나이브 가정입니다.'}</span><span class="balance-story-math">스팸일 모델 확률<br>${index === 0 ? '0.25 ÷ (0.25 + 0.05) = 5/6' : '(1/8) ÷ (1/8 + 1/240) = 30/31'} ≈ ${pct(drop.post)}</span>${index === 0 ? '<span class="balance-story-line">앞에서 센 <b>무료 6통 중 스팸 5통</b>과 같은 답이죠. <b>점수 0.25 자체가 스팸 확률 25%라는 뜻은 아닙니다.</b></span>' : ''}`;
        },
        ...(index === 0 ? { then: () => R.activate('쿠폰'), hold: 0 } : {}),
      })),
      {
        type: 'choice', focus: () => [], prompt: '두 점수가 모두 작아졌는데, 스팸일 모델 확률은 83.3% → 96.8%로 커졌어요. 왜 그럴까요?',
        options: [
          { label: '정상 점수가 상대적으로 더 많이 줄어, 스팸 점수의 비중이 커져서', correct: true, msg: '맞아요. 쿠폰은 스팸 점수에 4/8, 정상 점수에 1/12를 곱합니다. 스팸 점수의 절대적인 증가가 아니라 두 점수의 비율을 봅니다.' },
          { label: '단어를 올릴 때마다 스팸 점수를 더해서', correct: false, msg: '단어의 비율을 곱합니다. 두 점수 모두 작아졌지만 정상 점수가 상대적으로 더 크게 줄었어요.' },
        ],
        then: () => R.activate('당첨'), hold: 0,
      },
      {
        type: 'signal', wait: 'weighed', focus: () => [], readAfterFeedback: true, readLabel: '읽었어요 · 0의 이유 살펴보기',
        resultPrompt: '‘당첨’을 놓자 정상 점수가 0이 됐어요.',
        prompt: '<b>3/3 · 이번에는 ‘당첨’이 있다는 조건입니다.</b><span class="balance-story-line">스팸 8통 중 당첨 3통, 정상 12통 중 당첨 0통이에요. ‘당첨’을 가운데 상자에 놓으면 스팸 점수에는 <b>3/8</b>, 정상 점수에는 <b>0/12</b>를 곱합니다. 정상 쪽에는 어떤 일이 생길까요?</span>',
        hints: ['정상 자료에서는 당첨이 0번 나왔습니다.', '정상 점수에도 0/12를 곱합니다.', '당첨 칩을 가운데 점선 상자에 놓거나 누르세요.'],
        ok: drop => { drop ||= R.lastDrop; return `<span class="balance-story-line"><b>‘당첨’이 있다를 반영하면서 양쪽에 해당 비율을 곱했어요.</b></span><span class="balance-story-math sp">스팸: ${drop.formulaS}</span><span class="balance-story-math hm">정상: ${drop.formulaH}</span><span class="balance-story-math">스팸일 모델 확률<br>(3/64) ÷ (3/64 + 0) = ${pct(drop.post)}</span><span class="balance-story-line">정상 점수가 0이 되어 모델은 100%를 출력합니다. <b>현재 자료에 당첨이 없었다는 것이 현실에서도 불가능하다는 뜻은 아니에요.</b> 다음에서 이 0을 어떻게 다루는지 살펴봅니다.</span>`; },
      },
      {
        type: 'choice', focus: () => [], prompt: '정상 점수가 0이 된 이유는 무엇일까요?',
        options: [
          { label: '정상 문자에 ‘당첨’이 한 번도 없어서', correct: true, msg: '맞아요. P(당첨 | 정상) = 0/12 = 0이 정상 점수에 곱해졌습니다. 앞 단어들로 계산한 점수도 0이 되므로, 관찰하지 못한 경우에 작은 여지를 주는 스무딩을 다음에서 살펴봅니다.' },
          { label: '스팸 문자가 더 많아서', correct: false, msg: '스팸은 8통, 정상은 12통으로 오히려 정상이 많아요.' },
          { label: '곱셈을 잘못해서', correct: false, msg: '계산은 맞아요. 0이 하나라도 곱해지면 결과가 0이 됩니다.' },
        ],
      },
    ],
    done: '단어를 놓는다는 것은 <b>그 단어가 있다는 조건을 양쪽 곱셈에 반영</b>하는 일이었어요. 저울은 결과 점수를 비교하고, 확률은 두 점수의 합으로 나누어 구합니다. <b>다음 ▶</b>에서 0을 다루기 위한 +1, +2를 살펴봅니다.',
  },

  /* ---------------- 12. 스무딩 ---------------- */
  {
    ch: 3, kicker: '3장 · 나이브 베이즈', title: '공식에 +1, +2가 붙는 이유',
    say: '20통에 한 번 없었다고 “절대 안 나온다”고 할 수는 없죠. 그래서 모든 칸의 개수에 1을, ‘있다/없다’ 두 경우라 분모에 2를 더합니다. <b>라플라스 스무딩</b>이에요.',
    async enter(ctx) {
      R = {};
      const words = ['무료', '쿠폰', '당첨'], left = colX(2, 0), right = colX(2, 1);
      R.plus = h('button', { type: 'button', class: 'chip pulse' }, '모든 칸에 +1'); at(R.plus, left.x, GRID.top); FRONT().append(R.plus); pop(R.plus, { delay: 150 });
      R.plus.addEventListener('click', () => { R.plus.classList.remove('pulse'); R.plus.disabled = true; R.plus.classList.add('on'); ctx.signal('smooth'); });
      const tbl = h('table', { class: 'lik' });
      tbl.innerHTML = '<thead><tr><th class="word">단어</th><th class="sp">! P(단어 | 스팸)</th><th class="hm">✓ P(단어 | 정상)</th></tr></thead><tbody></tbody>';
      for (const w of words) {
        const tr = h('tr', { 'data-w': w });
        tr.append(h('th', { class: 'word' }, w), h('td', { html: F(count('spam', w), N.spam) }), h('td', { class: count('ham', w) === 0 ? 'zero' : null, html: F(count('ham', w), N.ham) }));
        tbl.querySelector('tbody').append(tr);
      }
      at(tbl, left.x, 216, { width: `${left.w}px` }); FRONT().append(tbl); pop(tbl);
      R.tbl = tbl;
      R.score = h('div', { class: 'eq-card' }); at(R.score, right.x, GRID.top, { width: `${right.w}px` }); FRONT().append(R.score); pop(R.score, { delay: 120 });
      R.meter = meterAt(right.x, 470, right.w);
      const show = (smooth, ms = 600) => {
        const r = classify(words, smooth), ls = words.map(w => dec(lik(w, 'spam', smooth), 3)), lh = words.map(w => dec(lik(w, 'ham', smooth), 3));
        R.score.innerHTML = `<p class="note" style="position:static;margin:0 0 6px"><b class="sp">! 스팸 점수</b> ≈ 0.4 × ${ls.join(' × ')}</p><div class="fx" style="position:static;font-size:26px">≈ <span class="sp">${sci(r.s)}</span></div>`
          + `<p class="note" style="position:static;margin:12px 0 6px"><b class="hm">✓ 정상 점수</b> ≈ 0.6 × ${lh.join(' × ')}</p><div class="fx" style="position:static;font-size:26px">≈ <span class="hm">${sci(r.h)}</span></div><small class="note" style="position:static">가능도는 표시용 반올림값(≈)이며, 점수와 막대는 원래 분수로 계산합니다.</small>`;
        R.meter.set(r.post, ms); return r;
      };
      R.show = show; show(false);
      R.meter.label.innerHTML += ' <span class="note" style="position:static">← 이 20통 자료와 현재 가정에서는 정상 점수 0이라 100%로 계산됨 (현실의 확실성은 아님)</span>';
      R.right = right;
      await wait(500);
    },
    tasks: [
      {
        type: 'signal', wait: 'smooth', prompt: '표 위의 <b>+1</b> 단추를 누르면 0이 어떻게 될까요?', ok: '이제 0인 칸이 없어요.',
        then: async () => {
          // +1, +2의 뜻: 각 묶음에 ‘그 단어가 있는 문자 1통, 없는 문자 1통’을 상상으로 미리 넣어 둔 것
          const x = afterX(R.plus, 18), note = noteAt('= 각 묶음에 <b>가상의 문자 2통</b>(단어 있음 1 · 없음 1)을 미리 넣은 셈', x, GRID.top - 2, 628 - x);
          note.style.fontSize = '15.5px'; note.style.lineHeight = '1.4'; pop(note);
          const [, thS, thH] = R.tbl.querySelectorAll('thead th');
          await Promise.all([flyGhost(R.plus, thS, { html: '+ 가상 2통', cls: 'sp', lift: 30 }), flyGhost(R.plus, thH, { html: '+ 가상 2통', cls: 'ham', lift: 30, delay: 160 })]);
          for (const tr of R.tbl.querySelectorAll('tbody tr')) {
            const w = tr.dataset.w, [sc, hc] = tr.querySelectorAll('td');
            sc.innerHTML = `${F(`${count('spam', w)}+1`, `${N.spam}+2`)}<span class="sub">= ${dec(lik(w, 'spam', true))}</span>`;
            hc.innerHTML = `${F(`${count('ham', w)}+1`, `${N.ham}+2`)}<span class="sub">= ${dec(lik(w, 'ham', true))}</span>`;
            hc.classList.remove('zero'); flash(sc); flash(hc); await wait(220);
          }
          R.show(true, 1400);
          burst(R.meter.bar, { color: '#2aa198' });
          pop(noteAt(`스팸일 확률 = 스팸 점수 ÷ (스팸 점수 + 정상 점수) ≈ <b class="sp">${pct(classify(['무료', '쿠폰', '당첨']).post)}</b>`, R.right.x, 556, R.right.w));
        },
      },
    ],
    done: '+1은 “본 적 없는 단어도 아주 작은 가능성은 있다”는 뜻이에요. <b>다음 ▶</b>에서 직접 써 봅시다.',
  },

  /* ---------------- 12-1. 다른 예: 날씨로 소풍 판정 ---------------- */
  {
    ch: 3, kicker: '3장 · 다른 예', title: '날씨만 보고 소풍 갈지 판정하기',
    say: '단어 대신 <b>날씨 특징</b>으로도 똑같이 할 수 있어요. 지난 10번의 기록: 소풍 간 날 6번, 안 간 날 4번. 나이브 가정은 <b>소풍 간다/안 간다가 주어졌을 때</b> 하늘과 바람의 동시 패턴을 따로 세지 않는 근사예요. 원인 관계를 말하는 것이 아니라, 특징마다 확률을 곱해 계산을 단순하게 하는 약속입니다.',
    async enter(ctx) {
      R = { pick: {} };
      const tw = 450;
      const tbl = h('table', { class: 'lik' });
      tbl.innerHTML = '<thead><tr><th class="word">특징</th><th class="sp">소풍 간 6번 중</th><th class="hm">안 간 4번 중</th></tr></thead><tbody></tbody>';
      for (const [f, c] of Object.entries(PICNIC.count)) {
        const tr = h('tr', { 'data-f': f }); tr.append(h('th', { class: 'word' }, f), h('td', null, `${c.go}/${PICNIC.n.go}`), h('td', null, `${c.stay}/${PICNIC.n.stay}`));
        tbl.querySelector('tbody').append(tr);
      }
      at(tbl, GRID.L, GRID.top, { width: `${tw}px` }); FRONT().append(tbl); pop(tbl); R.tbl = tbl;
      R.bal = balanceAt(GRID.R - 720 + 4, 96, ['소풍 간다 점수', '안 간다 점수']); pop(R.bal.svg, { delay: 120 });
      R.bal.token(0, '0.6'); R.bal.token(1, '0.4'); R.bal.weigh(PICNIC.prior.go, PICNIC.prior.stay);
      R.verdict = noteAt('하늘 하나, 바람 하나를 골라 보세요.', GRID.R - 560, 560, 560, 'big-note'); R.verdict.style.textAlign = 'center'; R.verdict.style.fontSize = '19px';
      // 특징 고르기(하늘 / 바람에서 하나씩)
      const pickRow = (group, items, y) => {
        const label = h('span', { class: 'pick-label' }, group);
        const chips = items.map(f => {
          const c = h('button', { type: 'button', class: 'chip feat', 'aria-pressed': 'false' }, f);
          c.addEventListener('click', () => {
            R.pick[group] = f;
            chips.forEach(o => { const on = o === c; o.classList.toggle('on', on); o.setAttribute('aria-pressed', String(on)); });
            updatePicnic();
            if (R.pick.하늘 && R.pick.바람) ctx.signal('weather');
          });
          return c;
        });
        R.wchips.push(...chips);
        pop(rowAt([label, ...chips], GRID.L, y, { gap: 10 }), { delay: 200 });
      };
      R.wchips = [];
      pickRow('하늘', ['맑음', '흐림'], 420);
      pickRow('바람', ['약한 바람', '강한 바람'], 484);
      await wait(600);
    },
    tasks: [
      {
        type: 'signal', wait: 'weather', focus: () => R.wchips,
        prompt: '아래에서 <b>하늘</b> 하나, <b>바람</b> 하나를 골라 저울에 올려 보세요. 고를 때마다 양쪽에 그 특징의 확률이 곱해져요.',
        ok: () => `${R.pick.하늘} + ${R.pick.바람} → 소풍 갈 확률 ${pct(R.picnicPost)}. 다른 조합도 눌러 보세요.`,
      },
      {
        type: 'choice', prompt: '스팸 필터와 비교해 보세요. 이 판정 공식에서 <b>같은 점</b>은 무엇일까요?',
        options: [
          { label: '사전확률 × 특징마다의 가능도를 곱한다', correct: true, msg: '맞아요. 단어가 날씨로 바뀌었을 뿐, 공식은 똑같아요.' },
          { label: '단어를 센다는 점만 같다', correct: false, msg: '여기엔 단어가 없어요. 같은 건 ‘곱하는 구조’예요. 저울의 추를 보세요.' },
          { label: '같은 점이 없다', correct: false, msg: '저울 양쪽의 추를 보세요. 사전확률(0.6, 0.4) 위에 특징의 확률이 곱해지고 있어요.' },
        ],
        then: async () => {
          const f = fxAt(`${P('간다', '하늘, 바람')} ∝ ${P('간다')} × ${P('하늘', '간다')} × ${P('바람', '간다')}`, 0, 604, { size: 22 }); rightTo(f);
          await stamp(f, { rays: 12 });
        },
      },
    ],
    done: '특징이 단어든 날씨든, 나이브 베이즈 = <b>사전확률 × 특징별 가능도의 곱</b>. <b>다음 ▶</b>',
  },

  /* ---------------- 13. 직접 만들기 ---------------- */
  {
    ch: 4, kicker: '4장 · 직접 분류', title: '문자를 만들어 공식으로 판정하기',
    say: '단어 단추를 눌러 문자를 만들어 보세요. 단어를 넣을 때마다 공식에 곱이 하나씩 늘고, 판정 막대가 바로 움직입니다. 단추 아래 숫자는 그 단어가 판정을 <b>몇 배 기울이는지</b>(P(단어|스팸) ÷ P(단어|정상))예요. (+1 스무딩 적용)',
    async enter(ctx) {
      R = { words: [] };
      const pw = 270, ph = 470, x = GRID.L + pw + 12 + 44, w = GRID.R - x;
      R.phone = phoneAt(GRID.L, GRID.top, '단어를 골라 보세요', '내가 만든 문자', { w: pw, h: ph });
      pop(R.phone.el);
      R.score = h('div', { class: 'eq-card' }); at(R.score, x, 226, { width: `${w}px` }); FRONT().append(R.score);
      R.meter = meterAt(x, 470, w);
      const update = () => {
        const r = classify(R.words);
        R.phone.bubble.replaceChildren(...(R.words.length ? markWords(R.words.join(' ')) : ['단어를 골라 보세요']));
        R.phone.bubble.querySelectorAll('.kw').forEach(k => k.classList.add('on'));
        const ls = R.words.map(v => dec(lik(v, 'spam', true), 2)), lh = R.words.map(v => dec(lik(v, 'ham', true), 2));
        R.score.innerHTML = `<p class="note" style="position:static;margin:0"><b class="sp">! 스팸 점수</b> ≈ 0.4${ls.map(v => ` × ${v}`).join('')} ≈ <b class="sp">${sci(r.s)}</b><br><b class="hm">✓ 정상 점수</b> ≈ 0.6${lh.map(v => ` × ${v}`).join('')} ≈ <b class="hm">${sci(r.h)}</b><br><small>가능도는 표시용 반올림값(≈)이며, 점수와 막대는 원래 분수로 계산합니다.</small></p>`;
        R.meter.set(r.post, 450);
        R.post = r.post;
        if (R.words.length >= 2 && r.post < 0.2) ctx.signal('made');
      };
      const chips = VOCAB.map(v => {
        // 단어 하나가 판정을 어느 쪽으로 몇 배 기울이는지 = P(단어|스팸) ÷ P(단어|정상)
        const ratio = lik(v, 'spam', true) / lik(v, 'ham', true);
        const lean = ratio >= 1 ? h('small', { class: 'lean sp' }, `스팸 쪽 ×${ratio.toFixed(1)}`) : h('small', { class: 'lean hm' }, `정상 쪽 ×${(1 / ratio).toFixed(1)}`);
        const c = h('button', { type: 'button', class: 'chip chip-ev', 'aria-pressed': 'false' }, v, lean);
        c.addEventListener('click', () => {
          const on = !R.words.includes(v);
          R.words = on ? [...R.words, v] : R.words.filter(o => o !== v);
          c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); update();
        });
        return c;
      });
      pop(rowAt(chips, x, GRID.top, { gap: 14 }), { delay: 120 });
      pop(R.score, { delay: 200 });
      update();
      await wait(500);
    },
    tasks: [{
      type: 'signal', wait: 'made', prompt: '단어를 <b>2개 이상</b> 골라 <b>스팸 확률 20% 미만</b>인 문자를 만들 수 있을까요?',
      ok: () => `${R.words.join(', ')} → 스팸 확률 ${pct(R.post)}. ‘내일’, ‘숙제’처럼 정상 문자에 자주 나오는 단어는 정상 쪽 증거가 됩니다.`,
    }],
    done: '단어마다 판정을 기울이는 힘이 다릅니다. <b>다음 ▶</b>에서 새 문자를 판정해 봅시다.',
  },

  /* ---------------- 14. 판정 퀴즈 ---------------- */
  {
    ch: 4, kicker: '4장 · 직접 분류', title: '분류기라면 어떻게 판정할까?',
    say: '처음 보는 문자 3통입니다. 이 입문용 분류기는 단어장(무료·쿠폰·당첨·내일·숙제) 중 <b>문자에 실제로 있는 단어만</b> 보고, 계산한 모델 확률이 50% 이상이면 스팸으로 판정해요. 이 값은 자료와 가정에서 나온 점수이지 현실의 확실성은 아니에요.',
    async enter(ctx) {
      R = { picks: [null, null, null] };
      QUIZ.forEach((q, k) => {
        const card = h('div', { class: 'quiz-card' });
        const msg = h('p', { class: 'msg' }, markWords(q.text)); msg.querySelectorAll('.kw').forEach(x => x.classList.add('on'));
        const row = h('div', { class: 'row' });
        const result = h('div', { class: 'result' });
        ['스팸', '정상'].forEach(label => {
          const b = h('button', { type: 'button', 'aria-pressed': 'false' }, label === '스팸' ? '! 스팸' : '✓ 정상');
          b.addEventListener('click', () => {
            if (R.revealed) return;
            R.picks[k] = label; row.querySelectorAll('button').forEach(x => { const on = x === b; x.classList.toggle('chosen', on); x.setAttribute('aria-pressed', String(on)); });
            if (R.picks.every(Boolean)) ctx.signal('quiz');
          });
          row.append(b);
        });
        card.append(h('p', { class: 'note', style: { position: 'static', margin: '0 0 6px', fontSize: '14px' } }, `문자 ${k + 1}`), msg, row, result);
        const c = colX(3, k); at(card, c.x, GRID.top, { width: `${c.w}px` }); FRONT().append(card); pop(card, { delay: k * 100 });
        q.result = result;
      });
      await wait(500);
    },
    tasks: [{
      type: 'signal', wait: 'quiz', prompt: '분류기라면 세 문자를 각각 어떻게 판정할까요? 예측해서 골라 보세요.',
      ok: () => {
        R.revealed = true;
        let right = 0;
        QUIZ.forEach((q, k) => {
          const r = classify(q.words), verdict = r.post >= 0.5 ? '스팸' : '정상', ok = verdict === R.picks[k]; if (ok) right++;
          q.result.innerHTML = `<div class="meter" style="position:relative;width:100%;height:22px"><i style="width:0"></i><span></span></div><p style="margin:8px 0 0">스팸일 확률 <b class="sp">${pct(r.post)}</b> → <b class="${verdict === '스팸' ? 'sp' : 'hm'}">${verdict}</b> ${ok ? '<span style="color:#1f8a4c">✓ 예측 적중</span>' : '<span style="color:#c63a2f">✗ 예측과 다름</span>'}</p>`;
          const fill = q.result.querySelector('i'); fill.style.width = `${r.post * 100}%`; fill.animate([{ width: '0%' }, { width: `${r.post * 100}%` }], { duration: T(800), delay: T(k * 200), fill: 'backwards', easing: 'cubic-bezier(.2,.8,.2,1)' });
        });
        return `3통 중 ${right}통을 맞혔어요.`;
      },
      then: async () => {
        const r3 = classify(QUIZ[2].words);
        pop(noteAt(`문자 3에서는 단어장에 있는 <b>‘무료’, ‘내일’</b>만 계산에 쓰고, <b>‘도서관’, ‘특강’</b>은 단어장 밖이라 이 입문용 모델이 무시합니다. 그래서 사람에게는 정상 맥락이어도 ${pct(r3.post)}로 스팸 판정이 났어요. 이는 <b>적은 자료·제한된 단어장</b>의 한계이며, 그다음으로는 분류가 주어졌을 때 단어들의 관계를 따로 세지 않는 <b>나이브 가정</b>의 한계도 있어요. 이 활동의 50% 기준을 바꾸거나 더 많은 자료와 단어를 학습하면 이런 오류를 줄일 수 있습니다.`, GRID.L, 476, GRID.R - GRID.L, 'big-note'), { delay: 600 });
      },
    }],
    done: '<b>다음 ▶</b>에서 오늘 만든 공식을 정리합니다.',
  },

  /* ---------------- 15. 정리 ---------------- */
  {
    ch: 4, kicker: '정리', title: '공식이 이런 모양인 이유',
    say: '외울 필요 없이, 세 가지 생각만 기억하면 공식을 다시 만들 수 있어요.',
    async enter() {
      R = {};
      const cards = [
        ['1', '조건부확률', '조건이 붙으면 전체(분모)가 바뀐다. 겹친 부분 ÷ 조건 전체.', `${P('A', 'B')} = ${F(P('A ∩ B'), P('B'))}`],
        ['2', '베이즈 정리', '같은 겹침을 두 길로 쓰고, 알고 싶은 것만 남긴다.', `${P('A', 'B')} = ${F(`${P('B', 'A')} × ${P('A')}`, P('B'))}`],
        ['3', '나이브 베이즈', '공통 분모는 지우고(∝), 분류가 주어졌을 때 단어를 조건부로 독립이라 근사해 곱한다.', `${P(SP, '단어들')}<br>∝ ${P(SP)} × ∏ ${P('단어', SP)}`],
      ];
      const els = cards.map(([num, name, d, f], k) => {
        const c = h('div', { class: 'summary-card' }, h('h2', null, h('i', null, num), name), h('p', null, d), h('div', { class: 'fx', html: f }));
        const col = colX(3, k); at(c, col.x, GRID.top, { width: `${col.w}px` }); FRONT().append(c); c.style.opacity = 0;
        return c;
      });
      const tallest = Math.max(...els.map(c => c.offsetHeight)); els.forEach(c => { c.style.height = `${tallest}px`; });
      // 카드 하나가 나타나면, 아래로 휘는 화살표가 다음 카드로 이어진다(공식이 앞 공식에서 만들어진다는 뜻).
      const anchor = (c, dx) => { const r = rectOf(c), a = h('i', { class: 'anchor' }); at(a, r.x + r.w / 2 + dx, r.y + r.h); FRONT().append(a); return a; };
      const steps = ['분모 옮기기 → 두 길을 등호로', '단어별로 나누기 → 공통 분모 지우기'];
      for (let k = 0; k < els.length; k++) {
        await stamp(els[k], { rays: 12 });
        if (k < steps.length) {
          const arr = arrowBetween(anchor(els[k], 40), anchor(els[k + 1], -40), { bend: 46, color: '#4263eb', width: 4, ms: 560 });
          await arr.done;
          const tag = h('div', { class: 'role evid' }, steps[k]); FRONT().append(tag);
          at(tag, Math.round(arr.mid.x - tag.offsetWidth / 2), Math.round(arr.mid.y + 10)); await pop(tag);
        }
      }
      R.base = GRID.top + tallest;
      await wait(200);
    },
    // 마지막: 나이브 베이즈가 수학적으로 해낸 일을 한 줄씩
    async finale() {
      const lines = [
        '<b>조건부확률</b> — 조건은 ‘전체’를 바꾼다: 분모가 기준이다.',
        '<b>베이즈 정리</b> — 같은 겹침을 두 길로 써서, 세기 쉬운 P(단어|스팸)로 알고 싶은 P(스팸|단어)를 구한다.',
        '<b>나이브 베이즈</b> — 2ⁿ개의 조합 대신 단어 n개의 확률만 세면 된다. 작은 자료에서도 시작할 수 있지만, 결과는 자료와 가정에 따라 흔들린다.',
      ];
      let y = R.base + 92;
      for (const html of lines) {
        const n = centerNote(html, y, 'sum-line'); await pop(n, { duration: 420 }); y += 42; await wait(380);
      }
    },
    tasks: [],
    done: '수고했어요! <b>처음으로 ↺</b>를 누르면 다시 볼 수 있습니다.',
  },
];

/* ---------- 시작 ---------- */
function boot() {
  // 자료 개수가 설명과 어긋나지 않는지 확인(숫자를 바꿀 때 안전장치)
  const expect = { spam: [8, { 무료: 5, 쿠폰: 4, 당첨: 3 }], ham: [12, { 무료: 1, 쿠폰: 1, 당첨: 0 }] };
  for (const [cls, [n, words]] of Object.entries(expect)) {
    console.assert(N[cls] === n, `${cls} 문자 수`);
    for (const [w, c] of Object.entries(words)) console.assert(count(cls, w) === c, `${cls}의 ${w} 개수`);
  }
  Deck.init();
  Guide.init();
  $('#stage').addEventListener('pointerdown', pencilMark);
  const soundBtn = $('#soundBtn'), paintSound = () => { soundBtn.textContent = Sound.on ? '♪ 소리 켬' : '♪ 소리 끔'; soundBtn.setAttribute('aria-pressed', String(Sound.on)); soundBtn.classList.toggle('off', !Sound.on); };
  soundBtn.addEventListener('click', () => { Sound.toggle(); paintSound(); });
  paintSound();
  $('#prev').addEventListener('click', () => { if (app.i > 0) go(app.i - 1); });
  const advance = () => { if (!app.completed.has(app.i)) return; go(app.i === STEPS.length - 1 ? 0 : app.i + 1); };
  $('#next').addEventListener('click', advance); $('#qnext').addEventListener('click', advance);
  window.addEventListener('resize', fit);
  // 무대 자체만 스크롤을 되돌린다. 바깥 stageWrap은 작은 화면에서 읽기 위한 이동을 허용한다.
  $('#stage').addEventListener('scroll', () => { $('#stage').scrollTop = 0; $('#stage').scrollLeft = 0; });
  document.fonts.ready.then(fit);
  fit();
  go(0);
}
boot();
