/* lab.js — 논리 연산 체험 웹앱: 게이트 실험실 · 정체를 밝혀라 · 회로 만들기 · 비트 연산 · 퍼셉트론 */
(() => {
  'use strict';
  const L = window.Logic, C = window.Circuits;
  const { GATES, ROWS2, el, text, group } = L;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let progress = L.readProgress();
  const done = (id) => !!progress.lab[id];
  function mark(id) { if (done(id)) return; L.markProgress('lab', id); progress = L.readProgress(); updateTabChecks(); }

  // ---------- 활동 탭 ----------
  const tabs = [...document.querySelectorAll('.tab')];
  const acts = [...document.querySelectorAll('.act')];
  let curAct = 'lab-gate';
  function openAct(id, focus) {
    if (!$(id)) id = 'lab-gate';
    curAct = id;
    tabs.forEach((t) => { const on = t.dataset.act === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    acts.forEach((a) => { a.hidden = a.id !== id; });
    if (focus) tabs.find((t) => t.dataset.act === id).focus();
    ACT_SHOW[id] && ACT_SHOW[id]();
  }
  tabs.forEach((t) => t.addEventListener('click', () => { openAct(t.dataset.act); history.replaceState(null, '', '#' + t.dataset.act); }));
  document.querySelector('.tabs').addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t.dataset.act === curAct);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
    if (n !== null) { e.preventDefault(); openAct(tabs[n].dataset.act, true); history.replaceState(null, '', '#' + tabs[n].dataset.act); }
  });
  function updateTabChecks() {
    const cnt = (pre) => Object.keys(progress.lab).filter((k) => k.startsWith(pre)).length;
    const set = (id, txt) => { tabs.find((t) => t.dataset.act === id).querySelector('.ck').textContent = txt; };
    const g = cnt('gate-'); set('lab-gate', g >= 6 ? '✓' : g ? `${g}/6` : '');
    set('lab-mystery', done('mystery') ? '✓' : '');
    const b = BUILD_MISSIONS.filter((m) => m.id !== 'free' && done('build-' + m.id)).length;
    set('lab-build', b >= 6 ? '✓' : b ? `${b}/6` : '');
    set('lab-bits', done('bits') ? '✓' : '');
    const n = ['AND', 'OR', 'NAND', 'NOR', 'XOR2'].filter((k) => done('neuron-' + k)).length;
    set('lab-neuron', n >= 5 ? '✓' : n ? `${n}/5` : '');
  }
  const ACT_SHOW = {};

  // 토글 버튼 공통
  function toggle(btn, v) { btn.setAttribute('aria-pressed', String(!!v)); }

  // ======================================================================
  // 01 게이트 실험실
  // ======================================================================
  const G1 = { type: 'AND', a: 0, b: 0, visited: {}, circ: null, net: null, tt: null, venn: null, anim: null, view: 'circ', circNote: '' };
  const svgC = $('gCirc'), svgS = $('gSym'), svgT = $('gTT'), svgV = $('gVenn');
  function buildGatePick() {
    $('gatePick').replaceChildren(...L.ORDER.map((k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.style.setProperty('--gc', GATES[k].color);
      b.dataset.g = k;
      b.innerHTML = `${k}<small>${GATES[k].ko}</small><span class="done"></span>`;
      b.addEventListener('click', () => setGate(k));
      return b;
    }));
  }
  function refreshPick() {
    [...$('gatePick').children].forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.g === G1.type));
      b.querySelector('.done').textContent = done('gate-' + b.dataset.g) ? '✓' : '';
      b.setAttribute('aria-label', `${b.dataset.g} ${GATES[b.dataset.g].ko}${done('gate-' + b.dataset.g) ? ', 완성함' : ''}`);
    });
  }
  const rowsOf = (type) => (GATES[type].arity === 1 ? [[0], [1]] : ROWS2);
  const rowKey = (type, a, b) => (GATES[type].arity === 1 ? `${a}` : `${a}${b}`);

  function setGate(type) {
    G1.type = type;
    G1.visited[type] = G1.visited[type] || new Set();
    const one = GATES[type].arity === 1;
    $('tgB').hidden = one;
    if (one) G1.b = 0;
    G1.visited[type].add(rowKey(type, G1.a, G1.b));   // 지금 보이는 입력은 이미 관찰한 것
    $('gateMotionLink').href = 'motion.html#' + ({ NOT: 'ch-not', AND: 'ch-and', OR: 'ch-or', XOR: 'ch-xor' }[type] || 'ch-nandnor');
    // 스위치 회로 (NAND·NOR는 AND·OR 뒤에 NOT을 붙인 그림)
    svgC.replaceChildren();
    if (C.CIRCUITS[type]) {
      G1.circ = C.CIRCUITS[type](svgC, 20, 10);
      G1.circNet = null;
      G1.circNote = G1.circ.note;
    } else {
      const base = type === 'NAND' ? 'AND' : 'OR';
      G1.circ = null;
      G1.circNet = C.network(svgC, {
        inputs: [{ id: 'A', x: 70, y: 170 }, { id: 'B', x: 70, y: 330 }],
        gates: [{ id: 'g', type: base, x: 190, y: 194, in: ['A', 'B'], bend: [130, 160] }, { id: 'n', type: 'NOT', x: 400, y: 194, in: ['g'] }],
        outputs: [{ id: 'o', label: type, src: 'n', x: 640, y: 242 }]
      }, { scale: 1.4 });
      G1.circNote = `${type} = ${base}의 결과를 NOT으로 한 번 더 뒤집은 것 (가운데 선이 ${base}의 결과)`;
    }
    // 회로 기호
    svgS.replaceChildren();
    G1.net = C.network(svgS, one
      ? { inputs: [{ id: 'A', x: 80, y: 190 }], gates: [{ id: 'g', type, x: 230, y: 134, in: ['A'] }], outputs: [{ id: 'o', label: `${type} A`, src: 'g', x: 560, y: 198 }] }
      : { inputs: [{ id: 'A', x: 80, y: 130 }, { id: 'B', x: 80, y: 260 }], gates: [{ id: 'g', type, x: 230, y: 118, in: ['A', 'B'], bend: [160, 190] }], outputs: [{ id: 'o', label: `A ${type} B`, src: 'g', x: 560, y: 182 }] },
      { scale: 1.6 });
    G1.symExpr = text(svgS, 360, 372, '', { class: 'sym-expr', 'text-anchor': 'middle' });
    // 진리표
    svgT.replaceChildren();
    const cols = one ? ['A', 'NOT A'] : ['A', 'B', type];
    G1.tt = L.truthTable(svgT, 15, 6, cols, rowsOf(type).map((r) => [...r, GATES[type].fn(r[0], r[1])]), { cw: one ? 150 : 100, rh: one ? 64 : 50, outColor: GATES[type].color });
    G1.ttNote = null;
    svgT.setAttribute('viewBox', `0 0 330 ${G1.tt.height + 14}`);
    // 벤
    svgV.replaceChildren();
    G1.venn = L.venn(svgV, 20, 20, { r: 100, gap: 55, w: 680, h: 260, single: one });
    G1.vennX = vennLabels(G1.venn, one, 55, 100);
    refreshPick();
    setView(G1.view);
    renderGate(G1.a, G1.b, false);
  }
  // 벤 다이어그램의 영역 = 진리표의 한 줄. 영역마다 입력 (A, B)와 결과를 적고,
  // 결과 1은 게이트 색, 결과 0은 회색, 아직 안 해 본 줄은 비워 둔다
  function vennLabels(V, one, gap, r) {
    for (const k in V.tags) V.tags[k].setAttribute('display', 'none');
    const cy = V.H / 2, ax = V.W / 2 - gap, bx = V.W / 2 + gap;
    const pos = one
      ? { '10': [V.W / 2, cy], '00': [V.W / 2 + r + 95, cy] }
      : { '10': [ax - r * 0.5, cy], '01': [bx + r * 0.5, cy], '11': [V.W / 2, cy], '00': [bx + r + 92, cy] };
    const labels = {};
    for (const k in pos) {
      const [x, y] = pos[k];
      const gk = group(V.g, x, y, { class: 'vx' });
      el('rect', { x: -38, y: -27, width: 76, height: 54, rx: 10, class: 'vx-pill' }, gk);
      text(gk, 0, -6, one ? `A=${k[0]}` : `(${k[0]}, ${k[1]})`, { class: 'vx-in', 'text-anchor': 'middle' });
      const out = text(gk, 0, 18, '?', { class: 'vx-out', 'text-anchor': 'middle' });
      const now = text(gk, 0, -34, '지금', { class: 'vx-now', 'text-anchor': 'middle' });
      labels[k] = { gk, out, now };
    }
    return { labels };
  }
  function renderVenn(type, a, b, vis) {
    const one = GATES[type].arity === 1, V = G1.venn, X = G1.vennX;
    for (const k in X.labels) {
      const row = one ? k[0] : k;
      const seen = vis.has(row), out = GATES[type].fn(+k[0], +k[1]);
      const reg = V.regions[k];
      reg.setAttribute('fill', out ? GATES[type].color : '#e4e1d9');
      reg.style.opacity = seen ? (out ? '0.72' : '1') : '0';
      const L1 = X.labels[k];
      L1.out.textContent = seen ? `→ ${out}` : '?';
      L1.gk.classList.toggle('is-seen', seen);
      L1.gk.classList.toggle('is-now', row === (one ? `${a}` : `${a}${b}`));
    }
  }
  function setView(v) {
    G1.view = v;
    [...$('gViews').children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === v)));
    // svg 요소에는 .hidden 속성이 없어 속성을 직접 켜고 끈다
    svgC.toggleAttribute('hidden', v !== 'circ'); svgS.toggleAttribute('hidden', v !== 'sym'); svgV.toggleAttribute('hidden', v !== 'venn');
    const G = GATES[G1.type];
    $('gCircNote').textContent = v === 'circ' ? G1.circNote
      : v === 'sym' ? `${G1.type} (${G.ko}) · ${G.expr} · ${G.say}`
        : `영역 하나 = 진리표 한 줄${GATES[G1.type].arity === 1 ? '' : ' (괄호는 A, B 값)'}. 색칠 = 결과 1 · 회색 = 결과 0 · ? = 아직 안 해 봄`;
  }
  $('gViews').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });

  function whyText(type, a, b) {
    const o = GATES[type].fn(a, b);
    switch (type) {
      case 'NOT': return [`1 − A = 1 − ${a} = ${o}`, '뒤집기는 1에서 빼는 것과 같습니다.'];
      case 'AND': return [`A × B = ${a} × ${b} = ${o}`, '논리곱: 결과가 곱셈과 똑같습니다. 0이 하나라도 있으면 0.'];
      case 'OR': return [`A + B = ${a} + ${b} = ${a + b}${a + b > 1 ? ' → 1' : ''}`, a + b > 1 ? '논리합: 덧셈과 닮았지만 1을 넘으면 1로 둡니다(켜짐은 켜짐).' : '논리합: 덧셈과 닮았습니다. 단, 1 + 1은 1로 둡니다.'];
      case 'XOR': return [`A + B = ${a + b} → 2로 나눈 나머지 ${o}`, '배타적 논리합: OR에서 ‘둘 다 1’인 경우만 빼 버린 것.'];
      case 'NAND': return [`1 − A × B = 1 − ${a * b} = ${o}`, 'AND의 결과를 뒤집습니다.'];
      case 'NOR': return [`1 − (A OR B) = 1 − ${a | b} = ${o}`, 'OR의 결과를 뒤집습니다. 둘 다 0일 때만 1.'];
    }
    return ['', ''];
  }

  function renderGate(pa, pb, animate) {
    const { type, a, b } = G1;
    const one = GATES[type].arity === 1;
    toggle($('tgA'), a); toggle($('tgB'), b);
    const vis = G1.visited[type];
    const key = rowKey(type, a, b);
    // 진리표: 해 본 줄만 결과를 보여 주고, 나머지는 ?
    rowsOf(type).forEach((r, i) => {
      const k = r.join('');
      const out = G1.tt.rows[i].cells[r.length];
      out.textContent = vis.has(k) ? String(GATES[type].fn(r[0], r[1])) : '?';
      out.classList.toggle('tt-hidden', !vis.has(k));
    });
    G1.tt.highlight(rowsOf(type).findIndex((r) => r.join('') === key));
    const total = rowsOf(type).length;
    // 벤: 해 본 줄의 영역만 칠한다
    renderVenn(type, a, b, vis);
    // 기호
    G1.net.set(one ? { A: a } : { A: a, B: b }, 0);
    const o = GATES[type].fn(a, b);
    G1.symExpr.textContent = `${GATES[type].expr}  =  ${GATES[type].expr.replace(/A/g, a).replace(/B/g, b)}  =  ${o}`;
    if (G1.circNet) G1.circNet.set({ A: a, B: b }, 0);
    // 이유
    const [f, s] = whyText(type, a, b);
    $('whyF').textContent = f;
    $('whyS').textContent = s;
    // 진행
    $('gateProg').textContent = vis.size >= total ? `✓ 진리표 완성! 다른 게이트도 해 보세요.` : `${total}가지 경우 중 ${vis.size}가지를 해 봤습니다.`;
    // 회로 그림(스위치 움직임)
    cancelAnimationFrame(G1.anim);
    if (G1.circ) {
      const circ = G1.circ, t0 = performance.now();
      const step = (now) => {
        if (G1.circ !== circ) return;   // 게이트를 바꿨으면 이전 회로 그리기는 멈춘다
        const p = animate && !reduceMotion ? Math.min(1, (now - t0) / 320) : 1;
        circ.set(G1.a, G1.b, p, reduceMotion ? 0 : now / 1000, pa, pb);
        if (p < 1 || (!reduceMotion && curAct === 'lab-gate')) G1.anim = requestAnimationFrame(step);
      };
      G1.anim = requestAnimationFrame(step);
    }
    if (vis.size >= total) mark('gate-' + type);
    refreshPick();
  }
  function press(which) {
    const pa = G1.a, pb = G1.b;
    if (which === 'A') G1.a ^= 1; else if (GATES[G1.type].arity === 2) G1.b ^= 1;
    G1.visited[G1.type].add(rowKey(G1.type, G1.a, G1.b));
    renderGate(pa, pb, true);
  }
  $('tgA').addEventListener('click', () => press('A'));
  $('tgB').addEventListener('click', () => press('B'));
  document.addEventListener('keydown', (e) => {
    if (curAct !== 'lab-gate' || (e.target.closest && e.target.closest('input, select, textarea')) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'a' || e.key === 'A') press('A');
    if (e.key === 'b' || e.key === 'B') press('B');
  });
  ACT_SHOW['lab-gate'] = () => renderGate(G1.a, G1.b, false);

  // ======================================================================
  // 02 정체를 밝혀라
  // ======================================================================
  const POOL = ['AND', 'OR', 'XOR', 'NAND', 'NOR'];
  const M = { order: [], round: 0, a: 0, b: 0, obs: new Map(), tests: 0, wrong: new Set(), solved: false, total: 0, rounds: [] };
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const myFig = $('myFig');
  let myParts = null;
  function buildMyFig() {
    myFig.replaceChildren();
    const inA = L.bitChip(myFig, 110, 100, 0, { r: 24 }), inB = L.bitChip(myFig, 110, 210, 0, { r: 24 });
    text(myFig, 70, 108, 'A', { class: 'net-label', 'text-anchor': 'end' });
    text(myFig, 70, 218, 'B', { class: 'net-label', 'text-anchor': 'end' });
    const wA = L.wire(myFig, 'M134 100 H230 V128 H290'), wB = L.wire(myFig, 'M134 210 H230 V182 H290');
    const wO = L.wire(myFig, 'M450 155 H540');
    el('rect', { x: 290, y: 90, width: 160, height: 130, rx: 16, class: 'mystery-box' }, myFig);
    const q = text(myFig, 370, 175, '?', { class: 'mystery-q', 'text-anchor': 'middle' });
    const lp = L.lamp(myFig, 580, 160, { label: '결과' });
    myParts = { inA, inB, wA, wB, wO, lp, q };
  }
  function newGame() {
    M.order = shuffle(POOL); M.round = 0; M.total = 0; M.rounds = [];
    startRound();
  }
  function startRound() {
    M.obs = new Map(); M.tests = 0; M.wrong = new Set(); M.solved = false; M.a = 0; M.b = 0;
    $('myLesson').hidden = true;
    $('myFeedback').replaceChildren();
    renderMystery();
  }
  const secret = () => M.order[M.round];
  const candidates = () => POOL.filter((g) => [...M.obs].every(([k, v]) => GATES[g].fn(+k[0], +k[1]) === v));
  function renderMystery(show) {
    toggle($('myA'), M.a); toggle($('myB'), M.b);
    $('myRound').textContent = `상자 ${M.round + 1} / ${POOL.length}`;
    myParts.inA.set(M.a); myParts.inB.set(M.b);
    myParts.wA.set(M.a); myParts.wB.set(M.b);
    const k = `${M.a}${M.b}`;
    const known = M.obs.has(k);
    const out = known ? M.obs.get(k) : 0;
    myParts.wO.set(known && out ? 1 : 0); myParts.lp.set(known && out ? 1 : 0);
    myParts.q.textContent = M.solved ? secret() : '?';
    myParts.q.classList.toggle('solved', M.solved);
    if (!known) myParts.lp.g.querySelector('.lamp-value').textContent = '실험 전';
    $('myObs').innerHTML = M.obs.size ? [...M.obs].map(([kk, v]) => `<tr${kk === k ? ' class="cur"' : ''}><td>${kk[0]}</td><td>${kk[1]}</td><td><b>${v}</b></td></tr>`).join('') : '<tr><td colspan="3" class="mini">아직 실험하지 않았습니다.</td></tr>';
    const cand = candidates();
    $('myHintText').textContent = $('myHint').checked ? `지금까지의 실험과 맞는 게이트: ${cand.join(', ')} (${cand.length}개)` : '';
    $('myAnswers').replaceChildren(...POOL.map((g) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.setProperty('--gc', GATES[g].color);
      b.textContent = g;
      b.disabled = M.solved || M.wrong.has(g);
      b.classList.toggle('out', M.wrong.has(g));
      b.addEventListener('click', () => answer(g));
      return b;
    }));
    $('myTest').disabled = M.solved;
    $('myScore').textContent = `이번 상자 실험 ${M.tests}번 · 지금까지 맞힌 상자 ${M.rounds.length}개 · 전체 실험 ${M.total + M.tests}번`;
    void show;
  }
  function answer(g) {
    const fb = $('myFeedback');
    const cand = candidates();
    if (g !== secret()) {
      M.wrong.add(g);
      const bad = [...M.obs].find(([k, v]) => GATES[g].fn(+k[0], +k[1]) !== v);
      fb.innerHTML = bad
        ? `<p class="note err">✗ ${g}라면 (A, B) = (${bad[0][0]}, ${bad[0][1]})에서 ${GATES[g].fn(+bad[0][0], +bad[0][1])}이 나와야 하는데, 실험 결과는 ${bad[1]}이었습니다. 실험 기록과 맞지 않는 답입니다.</p>`
        : `<p class="note err">✗ 아직 실험 결과만으로는 ${g}일 수도 있었지만, 정답이 아닙니다. 다른 입력으로 더 실험해 보세요.</p>`;
      renderMystery();
      return;
    }
    M.solved = true;
    const others = cand.filter((x) => x !== g);
    let msg;
    if (others.length) {
      const untested = ROWS2.map(([x, y]) => `${x}${y}`).filter((k) => !M.obs.has(k));
      const sep = untested.find((k) => others.some((o) => GATES[o].fn(+k[0], +k[1]) !== GATES[g].fn(+k[0], +k[1])));
      msg = `<p class="note">정답은 ${g}! 하지만 운이 좋았어요. 지금까지의 실험으로는 ${others.join(', ')}일 수도 있었습니다.${sep ? ` (A, B) = (${sep[0]}, ${sep[1]})를 실험했다면 확실히 구별할 수 있었습니다.` : ''}</p>`;
    } else {
      msg = `<p class="note ok">✓ 정답은 ${g}! 실험 ${M.tests}번으로 다른 가능성을 모두 지우고 확실하게 알아냈습니다.</p>`;
    }
    M.rounds.push({ g, tests: M.tests, sure: !others.length });
    M.total += M.tests;
    const last = M.round === POOL.length - 1;
    fb.innerHTML = msg + `<p style="margin-top:10px"><button type="button" class="btn btn-primary" id="myNext">${last ? '결과 보기' : '다음 상자 →'}</button></p>`;
    $('myNext').addEventListener('click', () => { if (last) finishGame(); else { M.round++; startRound(); } });
    renderMystery();
  }
  function finishGame() {
    const sure = M.rounds.filter((r) => r.sure).length;
    mark('mystery');
    const lesson = $('myLesson');
    lesson.hidden = false;
    lesson.innerHTML = `<div class="k">결과</div><div class="f">상자 5개 · 실험 ${M.total}번 · 확실하게 맞힌 상자 ${sure}개</div>
      <div class="s" style="margin-top:8px"><b>왜 3번이면 충분할까?</b> 실험 결과는 0 아니면 1, 두 가지뿐입니다. 그래서 실험 한 번은 후보를 많아야 절반으로 나눕니다. 후보가 5개면 2번으로는 4가지까지만 나눌 수 있으니 부족하고, 3번이면 8가지(2³ ≥ 5)를 나눌 수 있습니다.
      예: 먼저 (1, 1) → 1이면 AND·OR 남음, (0, 1)로 끝. 0이면 XOR·NAND·NOR 남음 → (0, 0)이 0이면 XOR, 1이면 (0, 1)로 NAND·NOR 구별.</div>
      <p style="margin-top:10px"><button type="button" class="btn" id="myAgain">새 상자 5개로 다시</button></p>`;
    $('myFeedback').replaceChildren();
    $('myAgain').addEventListener('click', newGame);
  }
  $('myA').addEventListener('click', () => { M.a ^= 1; renderMystery(); });
  $('myB').addEventListener('click', () => { M.b ^= 1; renderMystery(); });
  $('myTest').addEventListener('click', () => {
    const k = `${M.a}${M.b}`;
    M.tests++;
    M.obs.set(k, GATES[secret()].fn(M.a, M.b));
    renderMystery();
  });
  $('myHint').addEventListener('change', () => renderMystery());

  // ======================================================================
  // 03 회로 만들기
  // ======================================================================
  const BUILD_MISSIONS = [
    { id: 'nand', title: 'NAND 만들기', inputs: ['A', 'B'], outputs: [{ id: 'Y', label: 'Y', fn: GATES.NAND.fn }], palette: ['AND', 'NOT'], min: 2,
      text: 'AND와 NOT만으로 NAND를 만드세요. 목표: A NAND B', hints: ['NAND는 ‘AND 뒤에 NOT’입니다.', 'A, B → AND의 두 입력, AND의 출력 → NOT, NOT의 출력 → Y.'] },
    { id: 'xor', title: 'XOR 만들기', inputs: ['A', 'B'], outputs: [{ id: 'Y', label: 'Y', fn: GATES.XOR.fn }], palette: ['AND', 'OR', 'NOT'], min: 4,
      text: 'AND · OR · NOT으로 XOR를 만드세요. 목표: 두 입력이 다를 때만 1', hints: ['XOR은 OR에서 ‘둘 다 1’인 경우만 뺀 것입니다.', '‘둘 다 1’은 A AND B. 그것이 아니어야 하니 NOT(A AND B).', 'Y = (A OR B) AND NOT(A AND B). 게이트 4개면 됩니다.'] },
    { id: 'not-nand', title: 'NAND로 NOT', inputs: ['A'], outputs: [{ id: 'Y', label: 'Y', fn: (a) => 1 - a }], palette: ['NAND'], min: 1,
      text: 'NAND 하나만으로 NOT을 만드세요. 목표: Y = NOT A', hints: ['한 신호를 두 곳에 이어도 됩니다.', 'A를 NAND의 두 입력에 모두 이어 보세요. A NAND A는?'] },
    { id: 'and-nand', title: 'NAND로 AND', inputs: ['A', 'B'], outputs: [{ id: 'Y', label: 'Y', fn: GATES.AND.fn }], palette: ['NAND'], min: 2,
      text: 'NAND만으로 AND를 만드세요.', hints: ['AND = NOT(NAND)입니다.', '방금 만든 ‘NAND로 만든 NOT’을 NAND 뒤에 붙여 보세요.'] },
    { id: 'or-nand', title: 'NAND로 OR', inputs: ['A', 'B'], outputs: [{ id: 'Y', label: 'Y', fn: GATES.OR.fn }], palette: ['NAND'], min: 3,
      text: 'NAND만으로 OR를 만드세요.', hints: ['A OR B = NOT(NOT A AND NOT B) (드모르간 법칙).', 'A와 B를 각각 NAND로 뒤집은 다음, 그 둘을 NAND에 넣어 보세요.'] },
    { id: 'adder', title: '반가산기', inputs: ['A', 'B'], outputs: [{ id: 'S', label: '합 S', fn: GATES.XOR.fn }, { id: 'C', label: '올림 C', fn: GATES.AND.fn }], palette: ['XOR', 'AND', 'OR', 'NOT'], min: 2,
      text: 'A + B를 계산하는 회로: 합 S와 올림 C 두 출력을 만드세요. (1 + 1 = 10 → C = 1, S = 0)', hints: ['진리표에서 S 열과 C 열을 각각 보세요. 어떤 게이트의 진리표와 같나요?', 'S = A XOR B, C = A AND B. 한 입력을 여러 게이트에 이어도 됩니다.'] },
    { id: 'free', title: '자유 실험', inputs: ['A', 'B'], outputs: [{ id: 'Y', label: 'Y' }], palette: ['NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR'], min: 0,
      text: '모든 게이트를 마음껏 써서 회로를 만들어 보세요. 오른쪽 진리표에 내 회로의 결과가 나옵니다.', hints: ['예: NOT A AND B는 ‘A는 아니고 B만’일 때 1입니다.'] }
  ];
  const B = { mission: BUILD_MISSIONS[0], boards: {}, a: 0, b: 0, armed: null, sel: null, drag: null, hint: 0 };
  const bsvg = $('boardSvg');
  let seq = 0;
  const board = () => B.boards[B.mission.id];
  function initBoard(m) {
    if (B.boards[m.id]) return;
    const nIn = m.inputs.length, nOut = m.outputs.length;
    const nodes = {};
    m.inputs.forEach((id, i) => { nodes[id] = { kind: 'in', id, x: 70, y: nIn === 1 ? 280 : 170 + i * 220 }; });
    m.outputs.forEach((o, i) => { nodes[o.id] = { kind: 'out', id: o.id, label: o.label, x: 900, y: nOut === 1 ? 280 : 180 + i * 200 }; });
    B.boards[m.id] = { nodes, gates: [], wires: [] };
  }
  function buildMissions() {
    $('missions').replaceChildren(...BUILD_MISSIONS.map((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.m = m.id;
      b.innerHTML = `${esc(m.title)}<span class="ck"></span>`;
      b.addEventListener('click', () => setMission(m.id));
      return b;
    }));
  }
  function setMission(id) {
    B.mission = BUILD_MISSIONS.find((m) => m.id === id) || BUILD_MISSIONS[0];
    initBoard(B.mission);
    B.armed = null; B.sel = null; B.hint = 0;
    $('hintText').textContent = '';
    $('missionText').textContent = B.mission.text + (B.mission.min ? `  (가장 적게는 게이트 ${B.mission.min}개)` : '');
    $('palette').replaceChildren(...[(() => { const s = document.createElement('span'); s.className = 'mini'; s.textContent = '게이트 놓기:'; return s; })(),
      ...B.mission.palette.map((g) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.setProperty('--gc', GATES[g].color);
        b.textContent = '+ ' + g;
        b.setAttribute('aria-label', `${g} 게이트를 판에 놓기`);
        b.addEventListener('click', () => addGate(g));
        return b;
      })]);
    $('bB').hidden = B.mission.inputs.length === 1;
    renderBoard();
  }
  function addGate(type) {
    const bd = board();
    const spots = [];
    for (const y of [90, 250, 410]) for (const x of [250, 450, 650]) spots.push([x, y]);
    const free = spots.find(([x, y]) => !bd.gates.some((g) => Math.abs(g.x - x) < 90 && Math.abs(g.y - y) < 70)) || [300 + (seq % 5) * 30, 120 + (seq % 5) * 30];
    const g = { id: 'g' + (++seq), type, x: free[0], y: free[1] };
    bd.gates.push(g);
    B.sel = g.id;
    renderBoard();
    const gEl = bsvg.querySelector(`[data-gate="${g.id}"]`);
    if (gEl) gEl.focus();
  }
  // 끝점 좌표
  function portPos(node, port) {
    const bd = board();
    if (bd.nodes[node]) { const n = bd.nodes[node]; return n.kind === 'in' ? { x: n.x + 26, y: n.y } : { x: n.x - 30, y: n.y }; }
    const g = bd.gates.find((x) => x.id === node);
    if (port === 'out') return { x: g.x + 120, y: g.y + 40 };
    const one = GATES[g.type].arity === 1;
    return { x: g.x, y: g.y + (one ? 40 : port === 0 ? 24 : 56) };
  }
  // 값 계산 (연결이 빠지면 null)
  function evaluate(bd, ins) {
    const memo = {};
    const val = (node) => {
      if (node in memo) return memo[node];
      if (bd.nodes[node] && bd.nodes[node].kind === 'in') return (memo[node] = ins[node]);
      const g = bd.gates.find((x) => x.id === node);
      if (!g) return null;
      memo[node] = null;
      const n = GATES[g.type].arity;
      const srcs = [];
      for (let i = 0; i < n; i++) { const w = bd.wires.find((x) => x.to.node === g.id && x.to.port === i); srcs.push(w ? val(w.from) : null); }
      return (memo[node] = srcs.some((v) => v === null || v === undefined) ? null : GATES[g.type].fn(srcs[0], srcs[1]));
    };
    const out = {};
    for (const o of B.mission.outputs) { const w = bd.wires.find((x) => x.to.node === o.id); out[o.id] = w ? val(w.from) : null; }
    return { out, val };
  }
  // from이 to에 이미 의존하면(되돌아오는 길) 연결하면 안 된다
  function dependsOn(bd, node, target) {
    if (node === target) return true;
    const ws = bd.wires.filter((w) => w.to.node === node);
    return ws.some((w) => dependsOn(bd, w.from, target));
  }
  const wirePath = (p, q) => { const dx = Math.max(40, Math.abs(q.x - p.x) / 2); return `M${p.x} ${p.y} C${p.x + dx} ${p.y} ${q.x - dx} ${q.y} ${q.x} ${q.y}`; };

  function renderBoard() {
    const bd = board();
    bsvg.replaceChildren();
    const ins = { A: B.a, B: B.b };
    const { out, val } = evaluate(bd, ins);
    const wiresG = el('g', {}, bsvg), partsG = el('g', {}, bsvg);
    // 선
    bd.wires.forEach((w) => {
      const p = portPos(w.from, 'out'), q = portPos(w.to.node, w.to.port);
      const v = val(w.from);
      const d = wirePath(p, q);
      const path = el('path', { d, class: 'bwire' + (v === 1 ? ' on' : v === null ? ' undef' : '') }, wiresG);
      path.dataset.wire = `${w.from}>${w.to.node}:${w.to.port}`;
      const hit = el('path', { d, class: 'bwire-hit' }, wiresG);
      hit.addEventListener('pointerdown', (e) => e.stopPropagation());
      hit.addEventListener('click', (e) => { e.stopPropagation(); bd.wires.splice(bd.wires.indexOf(w), 1); flash('선을 끊었습니다.'); renderBoard(); });
      el('title', {}, hit).textContent = '눌러서 이 선 끊기';
    });
    // 입력·출력 마디
    for (const id in bd.nodes) {
      const n = bd.nodes[id];
      if (n.kind === 'in') {
        const chip = L.bitChip(partsG, n.x, n.y, ins[id], { r: 26 });
        text(chip.g, -38, 8, id, { class: 'net-label', 'text-anchor': 'end' });
        port(partsG, id, 'out', `입력 ${id}에서 선 시작하기`);
      } else {
        const lp = L.lamp(partsG, n.x, n.y + 10, { label: n.label });
        lp.g.setAttribute('transform', `translate(${n.x} ${n.y + 10}) scale(0.8)`);
        lp.set(out[id] === 1 ? 1 : 0);
        if (out[id] === null) lp.g.querySelector('.lamp-value').textContent = '연결 전';
        port(partsG, id, 0, `출력 ${n.label}에 선 끝 잇기`);
      }
    }
    // 게이트
    bd.gates.forEach((g) => {
      const gg = el('g', { class: 'bgate' + (B.sel === g.id ? ' sel' : ''), transform: `translate(${g.x} ${g.y})`, tabindex: 0, role: 'button', 'aria-label': `${g.type} 게이트. 방향키로 옮기고 Delete로 지웁니다` }, partsG);
      gg.dataset.gate = g.id;
      el('rect', { x: 10, y: 0, width: 100, height: 80, fill: 'transparent' }, gg);
      L.gateSymbol(gg, g.type, 0, 0, {});
      const v = val(g.id);
      text(gg, 60, 102, v === null ? '?' : String(v), { class: 'sw-value', 'text-anchor': 'middle' });
      gg.addEventListener('pointerdown', (e) => startDrag(e, g, gg));
      gg.addEventListener('keydown', (e) => gateKey(e, g));
      gg.addEventListener('focus', () => { if (B.sel !== g.id) { B.sel = g.id; $('bDel').disabled = false; gg.classList.add('sel'); } });
      const n = GATES[g.type].arity;
      for (let i = 0; i < n; i++) port(partsG, g.id, i, `${g.type} 입력 ${i + 1}에 선 끝 잇기`);
      port(partsG, g.id, 'out', `${g.type} 출력에서 선 시작하기`);
    });
    // 연결 대기 중인 선
    if (B.armed) {
      const p = portPos(B.armed, 'out');
      B.ghost = el('path', { d: wirePath(p, B.mouse || { x: p.x + 60, y: p.y }), class: 'ghost-wire' }, bsvg);
    } else B.ghost = null;
    $('bDel').disabled = !B.sel;
    toggle($('bA'), B.a); toggle($('bB'), B.b);
    renderCheck();
    [...$('missions').children].forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.m === B.mission.id));
      b.querySelector('.ck').textContent = done('build-' + b.dataset.m) ? '✓' : '';
    });
  }
  function port(parent, node, p, label) {
    const pos = portPos(node, p);
    const g = el('g', { class: 'port', transform: `translate(${pos.x} ${pos.y})`, tabindex: 0, role: 'button', 'aria-label': label }, parent);
    g.dataset.node = node; g.dataset.port = String(p);
    const bd = board();
    const isSrc = p === 'out';
    const connected = isSrc ? bd.wires.some((w) => w.from === node) : bd.wires.some((w) => w.to.node === node && w.to.port === p);
    if (B.armed === node && isSrc) g.classList.add('armed');
    if (connected) g.classList.add('connected');
    el('circle', { r: 18, class: 'hit' }, g);
    el('circle', { r: 8, class: 'dot' }, g);
    const act = (e) => { e.stopPropagation(); portClick(node, p); };
    g.addEventListener('pointerdown', (e) => e.stopPropagation());
    g.addEventListener('click', act);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e); } });
    return g;
  }
  function portClick(node, p) {
    const bd = board();
    if (p === 'out') {
      B.armed = B.armed === node ? null : node;
      flash(B.armed ? '이제 신호가 들어갈 점(게이트 왼쪽 끝이나 출력)을 누르세요.' : '');
      renderBoard();
      refocus(node, p);
      return;
    }
    if (!B.armed) {
      const i = bd.wires.findIndex((w) => w.to.node === node && w.to.port === p);
      if (i >= 0) { bd.wires.splice(i, 1); flash('선을 끊었습니다.'); }
      else flash('먼저 신호가 나오는 점(오른쪽 끝이나 입력 A·B)을 누르세요.');
      renderBoard();
      refocus(node, p);
      return;
    }
    if (dependsOn(bd, B.armed, node)) { flash('그렇게 이으면 신호가 자기 자신에게 되돌아옵니다. 다른 곳에 이어 보세요.'); B.armed = null; renderBoard(); return; }
    const i = bd.wires.findIndex((w) => w.to.node === node && w.to.port === p);
    if (i >= 0) bd.wires.splice(i, 1);   // 한 입력에는 선 하나만
    bd.wires.push({ from: B.armed, to: { node, port: p } });
    B.armed = null;
    flash('');
    renderBoard();
    refocus(node, p);
  }
  function refocus(node, p) {
    const t = [...bsvg.querySelectorAll('.port')].find((g) => g.dataset.node === node && g.dataset.port === String(p));
    if (t) t.focus({ preventScroll: true });
  }
  function flash(msg) { if (msg) { $('buildResult').dataset.flash = msg; } else delete $('buildResult').dataset.flash; }
  function svgPoint(e) {
    const r = bsvg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1000, y: ((e.clientY - r.top) / r.height) * 560 };
  }
  function startDrag(e, g, gg) {
    e.stopPropagation();
    B.sel = g.id;
    const p = svgPoint(e);
    B.drag = { g, gg, dx: p.x - g.x, dy: p.y - g.y, moved: false };
    gg.setPointerCapture(e.pointerId);
    gg.classList.add('sel');
    $('bDel').disabled = false;
    const move = (ev) => {
      const q = svgPoint(ev);
      g.x = Math.max(110, Math.min(760, q.x - B.drag.dx));
      g.y = Math.max(10, Math.min(450, q.y - B.drag.dy));
      B.drag.moved = true;
      gg.setAttribute('transform', `translate(${g.x} ${g.y})`);
      // 이 게이트에 닿은 선과 끝점만 다시 그린다
      redrawWiresFast();
    };
    const up = () => { gg.removeEventListener('pointermove', move); gg.removeEventListener('pointerup', up); B.drag = null; renderBoard(); const f = bsvg.querySelector(`[data-gate="${g.id}"]`); if (f) f.focus({ preventScroll: true }); };
    gg.addEventListener('pointermove', move);
    gg.addEventListener('pointerup', up);
  }
  // 끄는 동안에는 선과 끝점 위치만 고친다 (요소를 새로 만들면 포인터 붙잡기가 풀린다)
  function redrawWiresFast() {
    const bd = board();
    const paths = [...bsvg.querySelectorAll('.bwire')], hits = [...bsvg.querySelectorAll('.bwire-hit')];
    bd.wires.forEach((w, i) => { const d = wirePath(portPos(w.from, 'out'), portPos(w.to.node, w.to.port)); if (paths[i]) paths[i].setAttribute('d', d); if (hits[i]) hits[i].setAttribute('d', d); });
    bsvg.querySelectorAll('.port').forEach((pg) => {
      const pos = portPos(pg.dataset.node, pg.dataset.port === 'out' ? 'out' : Number(pg.dataset.port));
      pg.setAttribute('transform', `translate(${pos.x} ${pos.y})`);
    });
  }
  function gateKey(e, g) {
    const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (d) { e.preventDefault(); g.x = Math.max(110, Math.min(760, g.x + d[0])); g.y = Math.max(10, Math.min(450, g.y + d[1])); renderBoard(); bsvg.querySelector(`[data-gate="${g.id}"]`).focus(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeGate(g.id); }
  }
  function removeGate(id) {
    const bd = board();
    bd.gates = bd.gates.filter((x) => x.id !== id);
    bd.wires = bd.wires.filter((w) => w.from !== id && w.to.node !== id);
    if (B.armed === id) B.armed = null;
    B.sel = null;
    renderBoard();
  }
  bsvg.addEventListener('pointermove', (e) => { if (B.armed && B.ghost) { B.mouse = svgPoint(e); B.ghost.setAttribute('d', wirePath(portPos(B.armed, 'out'), B.mouse)); } });
  bsvg.addEventListener('pointerdown', () => { if (B.sel || B.armed) { B.sel = null; B.armed = null; flash(''); renderBoard(); } });
  document.addEventListener('keydown', (e) => { if (curAct === 'lab-build' && e.key === 'Escape' && B.armed) { B.armed = null; flash(''); renderBoard(); } });
  $('bDel').addEventListener('click', () => { if (B.sel) removeGate(B.sel); });
  $('bClear').addEventListener('click', () => { delete B.boards[B.mission.id]; initBoard(B.mission); B.sel = null; B.armed = null; renderBoard(); });
  $('bA').addEventListener('click', () => { B.a ^= 1; renderBoard(); });
  $('bB').addEventListener('click', () => { B.b ^= 1; renderBoard(); });
  $('hintBtn').addEventListener('click', () => {
    const hs = B.mission.hints;
    $('hintText').textContent = `힌트 ${Math.min(B.hint + 1, hs.length)}/${hs.length}: ${hs[Math.min(B.hint, hs.length - 1)]}`;
    B.hint = Math.min(B.hint + 1, hs.length - 1);
  });

  function renderCheck() {
    const m = B.mission, bd = board();
    const rows = m.inputs.length === 1 ? [[0], [1]] : ROWS2;
    const head = m.inputs.map((x) => `<th>${x}</th>`).join('') + m.outputs.map((o) => (o.fn ? `<th>목표 ${esc(o.label)}</th>` : '') + `<th>내 회로 ${esc(o.label)}</th>`).join('');
    let allOk = !!m.outputs[0].fn, anyNull = false;
    const body = rows.map((r) => {
      const ins = { A: r[0], B: r.length > 1 ? r[1] : 0 };
      const { out } = evaluate(bd, ins);
      const cur = r[0] === B.a && (r.length === 1 || r[1] === B.b);
      const cells = m.outputs.map((o) => {
        const mine = out[o.id];
        if (mine === null) anyNull = true;
        if (!o.fn) return `<td>${mine === null ? '?' : mine}</td>`;
        const goal = o.fn(r[0], r[1]);
        const ok = mine === goal;
        if (!ok) allOk = false;
        return `<td>${goal}</td><td class="${mine === null ? '' : ok ? 'good' : 'bad'}">${mine === null ? '?' : mine}${mine === null ? '' : ok ? ' ✓' : ' ✗'}</td>`;
      }).join('');
      return `<tr class="${cur ? 'cur' : ''}">${r.map((v) => `<td>${v}</td>`).join('')}${cells}</tr>`;
    }).join('');
    $('buildTable').innerHTML = `<table class="tt-check"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    const res = $('buildResult');
    const flashMsg = res.dataset.flash ? `<p class="note" style="margin-top:8px">${esc(res.dataset.flash)}</p>` : '';
    const n = bd.gates.length;
    if (!m.outputs[0].fn) { res.innerHTML = flashMsg + `<p class="mini">게이트 ${n}개를 썼습니다.</p>`; return; }
    if (allOk) {
      mark('build-' + m.id);
      res.innerHTML = flashMsg + `<p class="note ok">✓ 성공! 모든 줄이 목표와 같습니다. 게이트 ${n}개${n > m.min ? ` · 가장 적게는 ${m.min}개로도 됩니다. 도전해 보세요!` : n === m.min ? ' · 가장 적은 개수입니다!' : ''}</p>`;
    } else {
      res.innerHTML = flashMsg + `<p class="mini">${anyNull ? '아직 이어지지 않은 곳이 있습니다(?). ' : ''}✗ 표시된 줄을 보고 회로를 고쳐 보세요. A·B 스위치로 그 줄을 직접 확인할 수 있습니다.</p>`;
    }
  }
  ACT_SHOW['lab-build'] = () => renderBoard();

  // ======================================================================
  // 04 비트 연산
  // ======================================================================
  const BT = { A: 0b10110110, B: 0b01101100, op: 'AND', focus: -1, quests: {} };
  const OPS = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT'];
  const opFn = (op, a, b) => (op === 'NOT' ? (~a) & 255 : Array.from({ length: 8 }, (_, i) => GATES[op].fn((a >> i) & 1, (b >> i) & 1) << i).reduce((s, v) => s | v, 0));
  const bitsOf = (v) => Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1);
  const fmt8 = (v) => bitsOf(v).join('');
  const chr = (v) => (v >= 33 && v <= 126 ? `‘${String.fromCharCode(v)}’` : '');
  const QUESTS = [
    { id: 'mask', title: 'AND로 아래 4자리만 남기기', desc: 'A = 10110110에서 결과가 00000110이 되도록 B를 정하세요.', load: { A: 0b10110110, B: 0, op: 'AND' },
      ok: () => BT.op === 'AND' && BT.A === 0b10110110 && opFn('AND', BT.A, BT.B) === 0b00000110, why: 'AND는 1인 자리만 통과시키는 ‘구멍 뚫린 가림판(마스크)’처럼 씁니다.' },
    { id: 'flip', title: 'XOR로 모든 자리 뒤집기', desc: 'A = 01011001의 모든 자리를 뒤집으세요. (결과 10100110)', load: { A: 0b01011001, B: 0, op: 'XOR' },
      ok: () => BT.op === 'XOR' && BT.A === 0b01011001 && opFn('XOR', BT.A, BT.B) === 0b10100110, why: '1과 XOR하면 뒤집히고, 0과 XOR하면 그대로입니다.' },
    { id: 'set', title: 'OR로 맨 앞 자리만 켜기', desc: 'A = 00110101의 나머지는 그대로 두고 맨 앞 자리만 1로 만드세요.', load: { A: 0b00110101, B: 0, op: 'OR' },
      ok: () => BT.op === 'OR' && BT.A === 0b00110101 && opFn('OR', BT.A, BT.B) === 0b10110101, why: 'OR는 원하는 자리를 켤 때 씁니다. 0과 OR하면 그대로입니다.' },
    { id: 'self', title: '같은 수끼리 XOR', desc: 'A와 B를 똑같은 수(0이 아닌)로 만들고 XOR해 보세요. 결과는?', load: { A: 0b11010010, B: 0b00000000, op: 'XOR' },
      ok: () => BT.op === 'XOR' && BT.A === BT.B && BT.A !== 0, why: '같은 자리끼리는 늘 같으니 모두 0. 그래서 같은 열쇠로 두 번 XOR하면 원래대로 돌아옵니다.' }
  ];
  function buildOps() {
    $('opSel').replaceChildren(...OPS.map((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.op = o;
      b.style.setProperty('--gc', GATES[o].color);
      b.textContent = o === 'NOT' ? 'NOT A' : o;
      b.addEventListener('click', () => { BT.op = o; renderBits(); });
      return b;
    }));
  }
  function regRow(name, val, kind) {
    const row = document.createElement('div');
    row.className = 'reg' + (kind === 'res' ? ' rule' : '');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = name;
    row.append(nm);
    bitsOf(val).forEach((bt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bit' + (bt ? ' on' : '') + (kind === 'res' ? ' res' : '') + (BT.focus === i ? ' focus' : '');
      b.textContent = String(bt);
      const place = 1 << (7 - i);
      if (kind === 'res') {
        b.setAttribute('aria-label', `결과 ${i + 1}번째 자리(${place}): ${bt}. 계산 보기`);
        const show = () => { BT.focus = i; explainBit(i); highlightCol(i); };
        b.addEventListener('mouseenter', show); b.addEventListener('focus', show); b.addEventListener('click', show);
      } else {
        b.setAttribute('aria-pressed', String(!!bt));
        b.setAttribute('aria-label', `${name} ${i + 1}번째 자리(${place}): ${bt}. 눌러서 바꾸기`);
        b.disabled = kind === 'dim';
        b.addEventListener('click', () => { BT[name] ^= place; renderBits(); row.parentNode && $('regs').querySelectorAll('.reg')[name === 'A' ? 0 : 1].children[i + 1].focus(); });
      }
      row.append(b);
    });
    const info = document.createElement('span'); info.className = 'info';
    info.textContent = `= ${val} ${chr(val)}`;
    row.append(info);
    return row;
  }
  function highlightCol(i) { $('regs').querySelectorAll('.reg').forEach((r) => [...r.querySelectorAll('.bit')].forEach((b, k) => b.classList.toggle('focus', k === i))); }
  function explainBit(i) {
    const a = (BT.A >> (7 - i)) & 1, b = (BT.B >> (7 - i)) & 1;
    const r = BT.op === 'NOT' ? 1 - a : GATES[BT.op].fn(a, b);
    $('bitExplain').textContent = BT.op === 'NOT' ? `${i + 1}번째 자리: NOT ${a} = ${r}` : `${i + 1}번째 자리(${1 << (7 - i)}): ${a} ${BT.op} ${b} = ${r} — 각 자리를 따로따로 계산합니다.`;
  }
  function renderBits() {
    [...$('opSel').children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.op === BT.op)));
    const res = opFn(BT.op, BT.A, BT.B);
    $('regs').replaceChildren(regRow('A', BT.A, 'in'), regRow('B', BT.B, BT.op === 'NOT' ? 'dim' : 'in'), regRow(BT.op === 'NOT' ? 'NOT A' : BT.op, res, 'res'));
    $('regs').querySelectorAll('.reg')[2].querySelector('.nm').textContent = '결과';
    if (BT.focus >= 0) { explainBit(BT.focus); highlightCol(BT.focus); }
    // 퀘스트
    QUESTS.forEach((q) => { if (q.ok()) BT.quests[q.id] = true; });
    $('quests').replaceChildren(...QUESTS.map((q) => {
      const d = document.createElement('div');
      const ok = !!BT.quests[q.id];
      d.className = 'quest' + (ok ? ' done' : '');
      d.innerHTML = `<span class="st">${ok ? '✓' : '○'}</span><div><b>${esc(q.title)}</b><div class="${ok ? 'w' : 'd'}">${esc(ok ? q.why : q.desc)}</div></div><button type="button" class="btn btn-small">${ok ? '다시' : '해 보기'}</button>`;
      d.querySelector('button').addEventListener('click', () => { Object.assign(BT, q.load); BT.focus = -1; renderBits(); $('bitExplain').textContent = q.desc; });
      return d;
    }));
    checkBitsDone();
  }
  // XOR 암호
  const CI = { enc: false, dec: false, wrong: false };
  function cipherValid() {
    const m = $('cMsg').value;
    const ok = /^[A-Za-z0-9 !?.,]{1,12}$/.test(m);
    $('cMsgErr').textContent = ok ? '' : '⚠ 영문 대소문자·숫자·공백·! ? . ,만 쓸 수 있습니다(1~12자). 한글은 한 글자가 8비트보다 커서 이 활동에서는 쓰지 않습니다.';
    return ok;
  }
  function renderCipher() {
    const key = Number($('cKey').value);
    $('cKeyOut').textContent = `${key} = ${fmt8(key)}`;
    if (!cipherValid()) { $('cTable').innerHTML = ''; $('cEnc').disabled = true; $('cDec').disabled = true; $('cWrong').disabled = true; return; }
    $('cEnc').disabled = false;
    $('cDec').disabled = !CI.enc; $('cWrong').disabled = !CI.enc;
    const msg = [...$('cMsg').value].map((c) => c.charCodeAt(0));
    const enc = msg.map((v) => v ^ key);
    const dkey = CI.wrong ? (key ^ 0b00000100) : key;
    const dec = enc.map((v) => v ^ dkey);
    const rowsH = [
      ['글자', msg.map((v) => esc(String.fromCharCode(v)))],
      ['코드', msg.map((v) => v)],
      ['비트', msg.map((v) => fmt8(v))],
      ['⊕ 열쇠', msg.map(() => fmt8(key))],
      ['= 암호', CI.enc ? enc.map((v) => `<b>${fmt8(v)}</b>`) : msg.map(() => '…')],
      ['암호(16진)', CI.enc ? enc.map((v) => v.toString(16).toUpperCase().padStart(2, '0')) : msg.map(() => '…')]
    ];
    if (CI.dec) {
      rowsH.push([CI.wrong ? '⊕ 틀린 열쇠' : '⊕ 열쇠', msg.map(() => fmt8(dkey))]);
      rowsH.push(['= 해독', dec.map((v) => `<b>${fmt8(v)}</b>`)]);
      rowsH.push(['해독 글자', dec.map((v) => (v >= 32 && v <= 126 ? esc(String.fromCharCode(v)) : '·'))]);
    }
    $('cTable').innerHTML = rowsH.map(([h, cells]) => `<tr><th>${h}</th>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
    const r = $('cResult');
    if (CI.dec) {
      const same = dec.every((v, i) => v === msg[i]);
      r.innerHTML = same
        ? '<p class="note ok">✓ 같은 열쇠로 한 번 더 XOR하니 원래 말이 그대로 돌아왔습니다. (M ⊕ K) ⊕ K = M ⊕ (K ⊕ K) = M ⊕ 0 = M</p>'
        : '<p class="note err">열쇠가 한 자리만 달라도 해독한 글자가 엉뚱하게 나옵니다. 열쇠를 아는 사람만 읽을 수 있습니다.</p>';
      if (same) { CI.done = true; checkBitsDone(); }
    } else r.innerHTML = CI.enc ? '<p class="mini">암호문은 뜻을 알 수 없는 값입니다. 이제 받는 쪽에서 해독해 보세요.</p>' : '';
  }
  function checkBitsDone() {
    if (QUESTS.every((q) => BT.quests[q.id]) && CI.done) mark('bits');
  }
  $('cMsg').addEventListener('input', () => { CI.enc = CI.dec = CI.wrong = false; renderCipher(); });
  $('cKey').addEventListener('input', () => { CI.enc = CI.dec = CI.wrong = false; renderCipher(); });
  $('cEnc').addEventListener('click', () => { CI.enc = true; CI.dec = false; renderCipher(); });
  $('cDec').addEventListener('click', () => { CI.dec = true; CI.wrong = false; renderCipher(); });
  $('cWrong').addEventListener('click', () => { CI.dec = true; CI.wrong = true; renderCipher(); });
  ACT_SHOW['lab-bits'] = () => { renderBits(); renderCipher(); };

  // ======================================================================
  // 05 퍼셉트론
  // ======================================================================
  const INIT = [0.5, 0.5, 0.2];
  const ETA = 0.5;   // 학습률: 틀릴 때마다 고치는 크기
  const NT = { target: 'AND', w: INIT.slice(), h1: [1, 1, -0.5], h2: [0.5, 0.5, 0.2], two: false, moves: 0, steps: 0, ptr: 0, hover: -1, auto: null };
  const TARGETS = ['AND', 'OR', 'NAND', 'NOR', 'XOR'];
  const PO = { x0: 150, y0: 420, u: 280 }, BOX = { x0: -0.4, x1: 1.55, y0: -0.45, y1: 1.4 };
  const ts = (a, b) => [PO.x0 + a * PO.u, PO.y0 - b * PO.u];
  const nplane = $('nPlane'), ndia = $('nDiagram');
  const r1 = (v) => Math.round(v * 10) / 10;
  const sg = (v) => (v < 0 ? '−' + Math.abs(v).toFixed(1) : v.toFixed(1));
  let NP = null;
  const boxPoly = () => [[BOX.x0, BOX.y0], [BOX.x1, BOX.y0], [BOX.x1, BOX.y1], [BOX.x0, BOX.y1]];
  function buildPlane() {
    nplane.replaceChildren();
    const [bx, by] = ts(BOX.x0, BOX.y1);
    const box = { x: bx, y: by, width: (BOX.x1 - BOX.x0) * PO.u, height: (BOX.y1 - BOX.y0) * PO.u };
    const cp = el('clipPath', { id: 'npClip' }, el('defs', {}, nplane));
    el('rect', Object.assign({ rx: 12 }, box), cp);
    const g = el('g', { 'clip-path': 'url(#npClip)' }, nplane);
    el('rect', Object.assign({ class: 'n-plane-bg' }, box), g);
    const shade = el('polygon', { class: 'n-shade' }, g);
    el('line', { x1: ts(BOX.x0, 0)[0], y1: PO.y0, x2: ts(BOX.x1, 0)[0], y2: PO.y0, class: 'n-axis' }, g);
    el('line', { x1: PO.x0, y1: ts(0, BOX.y0)[1], x2: PO.x0, y2: ts(0, BOX.y1)[1], class: 'n-axis' }, g);
    const l1 = el('line', { class: 'n-sep' }, g), l2 = el('line', { class: 'n-sep n-sep2' }, g);
    const lab1 = text(g, 0, 0, '1이라고 답함', { class: 'n-region one', 'text-anchor': 'middle' });
    const lab0 = text(g, 0, 0, '0이라고 답함', { class: 'n-region zero', 'text-anchor': 'middle' });
    el('rect', Object.assign({ rx: 12, class: 'n-frame' }, box), nplane);
    text(nplane, ts(BOX.x1, 0)[0] - 10, PO.y0 - 10, 'A', { class: 'n-label', 'text-anchor': 'end' });
    text(nplane, PO.x0 + 12, ts(0, BOX.y1)[1] + 26, 'B', { class: 'n-label' });
    const pts = ROWS2.map(([a, b]) => {
      const [x, y] = ts(a, b);
      const pg = group(nplane, x, y, { class: 'n-ptg' });
      const ring = el('circle', { r: 29, class: 'n-wrong' }, pg);
      const c = el('circle', { r: 19, class: 'n-pt' }, pg);
      const t = text(pg, 0, 6, '', { class: 'n-pt-t', 'text-anchor': 'middle' });
      text(pg, 0, 46, `(${a}, ${b})`, { class: 'n-xy', 'text-anchor': 'middle' });
      return { a, b, ring, c, t, pg };
    });
    NP = { shade, l1, l2, lab1, lab0, pts };
  }
  function seg(w) {
    const [a, b, c] = w;
    if (Math.abs(b) > 1e-6) return [ts(BOX.x0 - 0.3, (-c - a * (BOX.x0 - 0.3)) / b), ts(BOX.x1 + 0.3, (-c - a * (BOX.x1 + 0.3)) / b)];
    if (Math.abs(a) > 1e-6) return [ts(-c / a, BOX.y0 - 0.3), ts(-c / a, BOX.y1 + 0.3)];
    return null;
  }
  function clipPoly(poly, w) {   // 반평면 w·(x, y, 1) > 0 으로 자르기
    const f = ([x, y]) => w[0] * x + w[1] * y + w[2];
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
      if (fp > 0) out.push(p);
      if ((fp > 0) !== (fq > 0)) { const k = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
    }
    return out;
  }
  const centroid = (poly) => poly.reduce((s2, p) => [s2[0] + p[0] / poly.length, s2[1] + p[1] / poly.length], [0, 0]);
  const area = (poly) => Math.abs(poly.reduce((s2, p, i) => { const q = poly[(i + 1) % poly.length]; return s2 + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const fire = (w, a, b) => (w[0] * a + w[1] * b + w[2] > 0 ? 1 : 0);
  function setLine(line, w) {
    const s2 = seg(w);
    if (!s2) { line.style.opacity = '0'; return; }
    line.style.opacity = '1';
    line.setAttribute('x1', s2[0][0]); line.setAttribute('y1', s2[0][1]); line.setAttribute('x2', s2[1][0]); line.setAttribute('y2', s2[1][1]);
  }
  // 이름표는 영역 안에서 네 점과 가장 먼 자리에 둔다 (점을 가리지 않게)
  function placeLabel(t, poly, inside) {
    if (poly.length < 3 || area(poly) < 0.06) { t.style.opacity = '0'; return; }
    let best = null, bd = -1;
    for (let x = BOX.x0 + 0.25; x <= BOX.x1 - 0.25; x += 0.05) {
      for (let y = BOX.y0 + 0.1; y <= BOX.y1 - 0.1; y += 0.05) {
        if (!inside(x, y)) continue;
        const d = Math.min(...ROWS2.map(([a, b]) => Math.hypot((x - a) * 1.6, y - b)));
        if (d > bd) { bd = d; best = [x, y]; }
      }
    }
    if (!best || bd < 0.22) best = centroid(poly);
    const [x, y] = ts(best[0], best[1]);
    t.style.opacity = '1';
    t.setAttribute('x', x.toFixed(0)); t.setAttribute('y', (y + 5).toFixed(0));
  }
  // 슬라이더: 쉬운 이름 + 기호
  const NAMES = [['A의 가중치', 'w₁'], ['B의 가중치', 'w₂'], ['편향', 'b']];
  function sliderSet(host, vec, names) {
    host.replaceChildren(...vec.map((v, i) => {
      const row = document.createElement('div');
      row.className = 'sl';
      const id = host.id + 's' + i;
      row.innerHTML = `<label for="${id}">${names[i][0]} <i>${names[i][1]}</i></label><input type="range" id="${id}" min="-3" max="3" step="0.1" value="${v}"><output for="${id}"></output>`;
      const inp = row.querySelector('input');
      inp.addEventListener('input', () => { vec[i] = Number(inp.value); NT.moves++; stopAuto(); renderNeuron(); });
      return row;
    }));
  }
  function syncSliders() {
    [['nSl1', NT.w], ['nSlH1', NT.h1], ['nSlH2', NT.h2]].forEach(([id, vec]) => {
      $(id).querySelectorAll('.sl').forEach((row, i) => {
        row.querySelector('input').value = String(vec[i]);
        const o = row.querySelector('output');
        o.textContent = sg(vec[i]);
        o.style.color = vec[i] >= 0 ? GATES.XOR.color : GATES.AND.color;
      });
    });
  }
  // 뉴런 그림: 선 굵기 = 가중치 크기, 주황 = +, 파랑 = −
  function drawDiagram(row) {
    ndia.replaceChildren();
    const edge = (x1, y1, x2, y2, w, labelTxt) => {
      el('line', { x1, y1, x2, y2, stroke: w >= 0 ? GATES.XOR.color : GATES.AND.color, 'stroke-width': (1.5 + Math.min(3, Math.abs(w)) * 2).toFixed(1), 'stroke-linecap': 'round', opacity: Math.abs(w) < 0.05 ? 0.25 : 0.9 }, ndia);
      if (labelTxt) text(ndia, (x1 + x2) / 2, (y1 + y2) / 2 - 8, labelTxt, { class: 'nd-w', 'text-anchor': 'middle', fill: w >= 0 ? GATES.XOR.color : GATES.AND.color });
    };
    const node = (x, y, r, v, label) => {
      el('circle', { cx: x, cy: y, r, class: 'nd-node' + (v === 1 ? ' on' : '') }, ndia);
      text(ndia, x, y + 5, label, { class: 'nd-t', 'text-anchor': 'middle' });
    };
    const [a, b] = row >= 0 ? ROWS2[row] : [null, null];
    if (!NT.two) {
      edge(64, 48, 166, 84, NT.w[0], `w₁ ${sg(NT.w[0])}`);
      edge(64, 128, 166, 92, NT.w[1], `w₂ ${sg(NT.w[1])}`);
      el('line', { x1: 220, y1: 88, x2: 292, y2: 88, stroke: '#1f2a44', 'stroke-width': 2 }, ndia);
      node(46, 48, 18, a, a === null ? '·' : String(a));
      node(46, 128, 18, b, b === null ? '·' : String(b));
      text(ndia, 14, 54, 'A', { class: 'nd-t' }); text(ndia, 14, 134, 'B', { class: 'nd-t' });
      node(192, 88, 28, null, 'Σ');
      text(ndia, 192, 142, `편향 b ${sg(NT.w[2])}`, { class: 'nd-w', 'text-anchor': 'middle', fill: NT.w[2] >= 0 ? GATES.XOR.color : GATES.AND.color });
      const out = row >= 0 ? fire(NT.w, a, b) : null;
      node(316, 88, 20, out, out === null ? '?' : String(out));
      text(ndia, 316, 132, '출력', { class: 'nd-cap', 'text-anchor': 'middle' });
    } else {
      edge(64, 48, 140, 48, NT.h1[0]); edge(64, 48, 140, 128, NT.h2[0]);
      edge(64, 128, 140, 48, NT.h1[1]); edge(64, 128, 140, 128, NT.h2[1]);
      el('line', { x1: 182, y1: 48, x2: 286, y2: 84, stroke: '#1f2a44', 'stroke-width': 2 }, ndia);
      el('line', { x1: 182, y1: 128, x2: 286, y2: 92, stroke: '#1f2a44', 'stroke-width': 2 }, ndia);
      node(46, 48, 18, a, a === null ? '·' : String(a));
      node(46, 128, 18, b, b === null ? '·' : String(b));
      text(ndia, 14, 54, 'A', { class: 'nd-t' }); text(ndia, 14, 134, 'B', { class: 'nd-t' });
      node(160, 48, 22, row >= 0 ? fire(NT.h1, a, b) : null, 'h₁');
      node(160, 128, 22, row >= 0 ? fire(NT.h2, a, b) : null, 'h₂');
      const out = row >= 0 ? fire(NT.h1, a, b) & fire(NT.h2, a, b) : null;
      node(310, 88, 24, out, 'AND');
      text(ndia, 310, 136, '출력', { class: 'nd-cap', 'text-anchor': 'middle' });
    }
    text(ndia, 180, 166, '선이 굵을수록 큰 가중치 · 주황 + · 파랑 −', { class: 'nd-cap', 'text-anchor': 'middle' });
  }
  function buildNeuronUi() {
    $('nTarget').replaceChildren(...TARGETS.map((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.t = t;
      b.style.setProperty('--gc', GATES[t].color);
      b.textContent = t;
      b.addEventListener('click', () => setTarget(t));
      return b;
    }));
    sliderSet($('nSl1'), NT.w, NAMES);
    sliderSet($('nSlH1'), NT.h1, NAMES.map(([k, s2]) => [k.replace('의 가중치', ' 가중치'), s2]));
    sliderSet($('nSlH2'), NT.h2, NAMES.map(([k, s2]) => [k.replace('의 가중치', ' 가중치'), s2]));
  }
  function setTarget(t) {
    stopAuto();
    NT.target = t; NT.w = INIT.slice(); NT.two = false; NT.moves = 0; NT.steps = 0; NT.ptr = 0;
    sliderSet($('nSl1'), NT.w, NAMES);
    $('nLearnMsg').textContent = '';
    renderNeuron();
  }
  // 퍼셉트론 학습 규칙: 틀린 점 하나를 골라 w ← w + η·(목표 − 출력)·입력
  function learnStep() {
    const G = GATES[NT.target];
    for (let k = 0; k < 4; k++) {
      const i = (NT.ptr + k) % 4, [a, b] = ROWS2[i];
      const y = fire(NT.w, a, b), t = G.fn(a, b);
      if (y === t) continue;
      const d = (t - y) * ETA;
      const before = NT.w.slice();
      NT.w[0] = r1(Math.max(-3, Math.min(3, NT.w[0] + d * a)));
      NT.w[1] = r1(Math.max(-3, Math.min(3, NT.w[1] + d * b)));
      NT.w[2] = r1(Math.max(-3, Math.min(3, NT.w[2] + d)));
      NT.ptr = (i + 1) % 4; NT.steps++;
      const ch = [['w₁', 0, a], ['w₂', 1, b], ['b', 2, 1]].map(([n, j, x]) => (x ? `${n} ${sg(before[j])}→${sg(NT.w[j])}` : `${n} 그대로(입력 0)`)).join(', ');
      $('nLearnMsg').textContent = `${NT.steps}걸음: (${a}, ${b})는 ${t}이어야 하는데 ${y}이라고 답했습니다 → 직선을 ${t > y ? '이 점이 1 쪽에 오도록' : '이 점이 0 쪽에 오도록'} 옮깁니다. ${ch}`;
      return true;
    }
    return false;
  }
  function stopAuto() { clearInterval(NT.auto); NT.auto = null; $('nAuto').textContent = '자동 학습'; }
  $('nStep').addEventListener('click', () => {
    stopAuto();
    if (!learnStep()) $('nLearnMsg').textContent = '네 점을 모두 맞혀서 더 고칠 것이 없습니다.';
    renderNeuron();
  });
  $('nAuto').addEventListener('click', () => {
    if (NT.auto) { stopAuto(); return; }
    const limit = NT.steps + 40;
    const tick = () => {
      const moved = learnStep();
      if (!moved) { stopAuto(); $('nLearnMsg').textContent = `✓ ${NT.steps}걸음 만에 학습이 끝났습니다. 틀릴 때마다 조금씩 고쳤을 뿐인데 직선이 제자리를 찾았습니다.`; }
      else if (NT.steps >= limit) { stopAuto(); $('nLearnMsg').textContent = `${NT.steps}걸음을 학습해도 틀린 점이 계속 남습니다. 직선이 이쪽저쪽을 오가기만 합니다.`; }
      renderNeuron();
    };
    if (reduceMotion) { while (NT.steps < limit && learnStep()) { /* 끝까지 */ } tick(); return; }
    $('nAuto').textContent = '멈춤';
    NT.auto = setInterval(tick, 380);
  });
  $('nReset').addEventListener('click', () => setTarget(NT.target));
  $('nTwo').addEventListener('click', () => { stopAuto(); NT.two = !NT.two; $('nLearnMsg').textContent = ''; renderNeuron(); });
  $('nTable').addEventListener('mouseover', (e) => { const tr = e.target.closest('tbody tr'); if (tr && NT.hover !== +tr.dataset.i) { NT.hover = +tr.dataset.i; renderNeuron(); } });
  $('nTable').addEventListener('focusin', (e) => { const tr = e.target.closest('tbody tr'); if (tr && NT.hover !== +tr.dataset.i) { NT.hover = +tr.dataset.i; renderNeuron(); const again = $('nTable').querySelector(`tbody tr[data-i="${NT.hover}"]`); if (again && document.activeElement !== again) again.focus(); } });
  $('nTable').addEventListener('mouseleave', () => { NT.hover = -1; renderNeuron(); });

  function renderNeuron() {
    [...$('nTarget').children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.t === NT.target)));
    const two = NT.two, G = GATES[NT.target], isXor = NT.target === 'XOR';
    $('nSl1').hidden = two; $('nTwoBox').hidden = !two; $('nLearnRow').hidden = two;
    syncSliders();
    // 평면: 1 쪽 칠하기 + 직선 + 영역 이름
    const box = boxPoly();
    let one, zero;
    if (two) {
      one = clipPoly(clipPoly(box, NT.h1), NT.h2);
      setLine(NP.l1, NT.h1); setLine(NP.l2, NT.h2);
      zero = clipPoly(box, NT.h1.map((v) => -v));
      if (area(zero) < 0.06) zero = clipPoly(box, NT.h2.map((v) => -v));
    } else {
      one = clipPoly(box, NT.w);
      zero = clipPoly(box, NT.w.map((v) => -v));
      setLine(NP.l1, NT.w); NP.l2.style.opacity = '0';
    }
    NP.shade.setAttribute('points', one.map((q) => ts(...q).join(',')).join(' '));
    const in1 = two ? (x, y) => fire(NT.h1, x, y) && fire(NT.h2, x, y) : (x, y) => fire(NT.w, x, y) === 1;
    placeLabel(NP.lab1, one, in1); placeLabel(NP.lab0, zero, (x, y) => !in1(x, y));
    let wrong = 0;
    const rows = ROWS2.map(([a, b], i) => {
      const goal = G.fn(a, b);
      let outV, mid;
      if (two) { const h1 = fire(NT.h1, a, b), h2 = fire(NT.h2, a, b); outV = h1 & h2; mid = `<td>${h1}</td><td>${h2}</td>`; }
      else { const z = NT.w[0] * a + NT.w[1] * b + NT.w[2]; outV = z > 0 ? 1 : 0; mid = `<td>${sg(r1(z))}</td>`; }
      const ok = outV === goal;
      if (!ok) wrong++;
      const pt = NP.pts[i];
      pt.c.classList.toggle('one', goal === 1);
      pt.t.textContent = String(goal);
      pt.ring.style.opacity = ok ? '0' : '1';
      pt.pg.classList.toggle('hl', NT.hover === i);
      return `<tr data-i="${i}" tabindex="0" class="${NT.hover === i ? 'hl' : ''}" aria-label="A ${a}, B ${b}: 출력 ${outV}, 목표 ${goal}, ${ok ? '맞음' : '틀림'}"><td>${a}</td><td>${b}</td>${mid}<td>${outV}</td><td>${goal}</td><td class="${ok ? 'good' : 'bad'}">${ok ? '✓' : '✗'}</td></tr>`;
    });
    $('nTable').innerHTML = `<thead><tr><th>A</th><th>B</th>${two ? '<th>h₁</th><th>h₂</th>' : '<th>계산 z</th>'}<th>출력</th><th>목표</th><th></th></tr></thead><tbody>${rows.join('')}</tbody>`;
    // 가리킨 줄의 계산
    const h = NT.hover;
    if (h >= 0) {
      const [a, b] = ROWS2[h];
      if (two) $('nCalc').textContent = `(${a}, ${b}): h₁ = ${fire(NT.h1, a, b)}, h₂ = ${fire(NT.h2, a, b)} → 둘 다 1이면 1 → 출력 ${fire(NT.h1, a, b) & fire(NT.h2, a, b)}`;
      else { const z = r1(NT.w[0] * a + NT.w[1] * b + NT.w[2]); const pw = (v) => (v < 0 ? `(${sg(v)})` : sg(v)); $('nCalc').textContent = `${a}×${pw(NT.w[0])} + ${b}×${pw(NT.w[1])} + ${pw(NT.w[2])} = ${sg(z)} ${z > 0 ? '> 0 → 1' : '≤ 0 → 0'}`; }
    } else $('nCalc').textContent = '표의 줄을 가리키면 그 점의 계산이 보입니다.';
    drawDiagram(h);
    // 결과와 XOR 안내
    const stuck = isXor && !two && (NT.moves >= 20 || NT.steps >= 12);
    $('nTwo').hidden = !(isXor && (stuck || two));
    $('nTwo').textContent = two ? '뉴런 하나로 돌아가기' : '뉴런 두 개(두 층)로 풀어 보기';
    $('nProof').hidden = !(isXor && (stuck || two));
    const res = $('nResult');
    if (!wrong) {
      res.innerHTML = `<p class="note ok">✓ 네 점을 모두 맞혔습니다! ${two ? '뉴런 두 개가 직선 두 개를 긋고, 두 직선 사이의 띠만 1이라고 답해서 XOR이 됩니다.' : `뉴런 하나로 ${NT.target}를 흉내 냈습니다.`}</p>`;
      mark('neuron-' + (two ? 'XOR2' : NT.target));
    } else if (stuck) {
      res.innerHTML = '<p class="note err">XOR은 1인 두 점이 대각선으로 마주 보고 있어서, 어떤 직선을 그어도 한 점 이상 틀립니다. 직선 하나(뉴런 하나)로는 <b>불가능</b>합니다.</p>';
    } else if (two) {
      res.innerHTML = `<p class="mini">틀린 점 ${wrong}개. 둘째 직선을 NAND처럼(두 가중치는 −, 편향은 +) 만들어 보세요.</p>`;
    } else {
      res.innerHTML = `<p class="mini">틀린 점 ${wrong}개. 슬라이더로 직선을 옮기거나 ‘한 걸음 학습’을 눌러 보세요.</p>`;
    }
  }
  ACT_SHOW['lab-neuron'] = renderNeuron;

  // ---------- 시작 ----------
  buildGatePick();
  buildMyFig();
  buildMissions();
  buildOps();
  buildPlane();
  buildNeuronUi();
  const [hAct, hArg] = location.hash.slice(1).split('?');
  if (hAct === 'lab-gate' && hArg && GATES[hArg]) G1.type = hArg;
  setGate(G1.type);
  newGame();
  setMission(hAct === 'lab-build' && hArg ? hArg : BUILD_MISSIONS[0].id);
  updateTabChecks();
  openAct(hAct || 'lab-gate');

  window.__lab = { G1, M, B, BT, NT, CI, openAct, setGate, setMission, renderBoard, portClick, addGate, board, evaluate, QUESTS, renderBits, renderNeuron };
})();
