/* motion.js — 논리 연산 모션 해설: 시각 t → 그림 (되감기·장 이동·MP4 렌더 모두 같은 그림)
 * 장(chapter) = { id, title, dur, cues:[[초, 자막]], lab, build(root) → refs, update(refs, lt) }
 */
(() => {
  'use strict';
  const L = window.Logic, C = window.Circuits;
  const { el, text, group, GATES, ROWS2 } = L;
  const W = 1280, H = 720;

  // ---------- 시간 도우미 ----------
  const clamp01 = L.clamp01;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const P = (t, a, b) => ease(clamp01((t - a) / (b - a)));   // a~b 사이 진행(부드럽게)
  const lin = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, p) => a + (b - a) * p;
  const op = (n, v) => { n.style.opacity = String(clamp01(v)); };
  // 크기 변화가 필요한 묶음은 transform 속성 없는 g로 감싼다 (CSS transform이 속성을 덮어쓰지 않게)
  const wrap = (parent, cls = '') => el('g', { class: 'pop ' + cls }, parent);
  const pop = (n, p) => { op(n, p); n.style.transform = `scale(${(0.86 + 0.14 * ease(clamp01(p))).toFixed(4)})`; };
  // 네 경우(00,01,10,11)를 차례로: t0부터 step초씩
  function stepper(t, t0, step, n) {
    if (t < t0) return { i: -1, p: 0 };
    const i = Math.min(n - 1, Math.floor((t - t0) / step));
    return { i, p: clamp01((t - t0 - i * step) / 0.9) };   // 0.9초 동안 스위치가 움직임
  }
  const card = (parent, x, y, w, h, cls = '') => el('rect', { x, y, width: w, height: h, rx: 14, class: 'card ' + cls }, parent);
  function para(parent, x, y, lines, attrs = {}) {   // 여러 줄 글
    const t = el('text', Object.assign({ x, y }, attrs), parent);
    lines.forEach((ln, i) => { const s = el('tspan', { x, dy: i ? (attrs.lh || 30) : 0 }, t); s.textContent = ln; });
    return t;
  }

  // ---------- 2입력 게이트 장 (AND · OR · XOR 공통 틀) ----------
  function gateChapter(type, cfg) {
    const G = GATES[type];
    return {
      id: cfg.id, title: cfg.title, dur: 52, cues: cfg.cues, lab: cfg.lab,
      build(root) {
        const r = {};
        r.circ = wrap(root);
        r.c = C.CIRCUITS[type](r.circ, 10, 96);
        r.note = text(r.circ, 330, 600, r.c.note, { class: 'm-note', 'text-anchor': 'middle' });
        r.ex = wrap(root);
        card(r.ex, 700, 384, 540, 74);
        text(r.ex, 724, 414, '생활 속 예', { class: 'm-kicker' });
        text(r.ex, 724, 442, cfg.example, { class: 'm-body' });
        r.tt = L.truthTable(root, 760, 104, ['A', 'B', type], ROWS2.map(([a, b]) => [a, b, G.fn(a, b)]), { cw: 96, outColor: G.color });
        r.whyG = wrap(root);
        r.why = cfg.why(r.whyG, r.tt);
        r.sym = wrap(root);
        L.gateSymbol(r.sym, type, 60, 150, { scale: 2 });
        text(r.sym, 180, 350, `${type} · ${G.ko}`, { class: 'm-title2', 'text-anchor': 'middle' });
        text(r.sym, 180, 382, `${G.expr}`, { class: 'm-expr', 'text-anchor': 'middle' });
        r.vennW = wrap(root);
        r.venn = L.venn(r.vennW, 370, 120, { r: 92, gap: 62 });
        text(r.vennW, 370 + r.venn.W / 2, 120 + r.venn.H + 34, `벤 다이어그램: ${G.set}`, { class: 'm-body', 'text-anchor': 'middle' });
        r.sum = wrap(root);
        card(r.sum, 700, 488, 540, 96, 'card-strong');
        text(r.sum, 724, 524, `${type} = ${G.say}`, { class: 'm-title2' });
        text(r.sum, 724, 560, `${G.expr}   ·   ${G.set}`, { class: 'm-expr' });
        return r;
      },
      update(r, t) {
        // 1) 회로 그리기 → 네 경우
        const draw = P(t, 0.3, 2.6);
        r.c.g.querySelectorAll('.wire').forEach((w) => {
          const base = w.querySelector('.wire-base');
          base.setAttribute('pathLength', '1');
          base.style.strokeDasharray = draw < 1 ? '1' : '';
          base.style.strokeDashoffset = draw < 1 ? String(1 - draw) : '';
        });
        const s = stepper(t, 4, 4.5, 4);
        const cur = s.i < 0 ? [0, 0] : ROWS2[s.i], prev = s.i <= 0 ? [0, 0] : ROWS2[s.i - 1];
        r.c.set(cur[0], cur[1], s.i < 0 ? 1 : s.p, t, prev[0], prev[1]);
        const circVis = 1 - P(t, 33, 34.2);
        op(r.circ, Math.min(P(t, 0, 0.8), circVis));
        op(r.ex, Math.min(P(t, 1.5, 2.5), 1 - P(t, 22.5, 23.3)));
        op(r.note, P(t, 5, 6));
        // 진리표: 경우가 지날 때마다 결과 칸을 채운다
        op(r.tt.g, P(t, 0.5, 1.5));
        for (let i = 0; i < 4; i++) r.tt.reveal(i, s.i > i || (s.i === i && s.p >= 1) ? 1 : 0);
        let hl = s.i >= 0 && t < 22.5 ? s.i : -1;
        // 2) 이름의 이유
        op(r.whyG, P(t, 23, 24));
        r.why.update(t);
        // 3) 기호와 벤: 영역 하나 = 진리표 한 줄
        pop(r.sym, P(t, 34, 35));
        op(r.vennW, P(t, 36.5, 37.5));
        const vs = stepper(t, 39, 1.9, 4);
        const fills = {};
        ROWS2.forEach(([a, b], i) => { fills[`${a}${b}`] = vs.i >= i ? G.fn(a, b) : 0; });
        r.venn.set(fills, G.color, 1);
        if (vs.i >= 0 && t < 47) { hl = vs.i; r.venn.point(`${ROWS2[vs.i][0]}${ROWS2[vs.i][1]}`, true); } else r.venn.point('', false);
        r.tt.highlight(hl);
        pop(r.sum, P(t, 46.5, 47.5));
      }
    };
  }

  // 오른쪽 '이름의 이유' 열: 진리표 줄 높이에 맞춰 값을 쓴다
  function whyColumn(g, tt, head, vals, opts = {}) {
    const x = 760 + tt.width + 70;
    text(g, x, 104 + 30, head, { class: 'm-why-head', 'text-anchor': 'middle' });
    const cells = vals.map((v, i) => text(g, x, tt.cellPos(i, 0).y + 7, String(v), { class: 'm-why-cell', 'text-anchor': 'middle' }));
    const eqs = vals.map((_, i) => text(g, x + 66, tt.cellPos(i, 0).y + 7, '✓', { class: 'm-why-eq', 'text-anchor': 'middle' }));
    return { cells, eqs, x };
  }

  // ---------- 장 목록 ----------
  const CH = [];

  // 1. 0과 1로 생각하기
  CH.push({
    id: 'ch-basics', title: '0과 1로 생각하기', dur: 36, lab: 'lab.html#lab-gate',
    cues: [
      [0, '컴퓨터가 하는 판단은 결국 ‘참이냐, 거짓이냐’ 두 가지입니다.'],
      [5, '참은 1, 거짓은 0으로 씁니다. 전기 회로에서는 ‘켜짐’이 1, ‘꺼짐’이 0입니다.'],
      [11, '스위치를 켜면 전류가 흘러 전구가 켜지고(1), 끄면 전구도 꺼집니다(0).'],
      [20, '논리 연산은 1과 0을 받아서 새로운 1이나 0을 만드는 ‘규칙’입니다.'],
      [27, '기본 규칙은 여섯 가지입니다. 하나씩, 왜 그런 이름인지까지 살펴봅시다.']
    ],
    build(root) {
      const r = {};
      r.q = wrap(root);
      card(r.q, 70, 108, 560, 120);
      text(r.q, 96, 146, '명제', { class: 'm-kicker' });
      text(r.q, 96, 184, '“지금 교실에 불이 켜져 있다.”', { class: 'm-title2' });
      r.pT = wrap(root); card(r.pT, 660, 132, 130, 70, 'pill-on'); text(r.pT, 725, 178, '참', { class: 'm-title2', 'text-anchor': 'middle' });
      r.pF = wrap(root); card(r.pF, 810, 132, 130, 70, 'pill-off'); text(r.pF, 875, 178, '거짓', { class: 'm-title2', 'text-anchor': 'middle' });
      // 대응표
      r.map = wrap(root);
      const mx = 700, my = 250;
      card(r.map, mx, my, 500, 190);
      ['논리', '수', '전기'].forEach((h, i) => text(r.map, mx + 90 + i * 160, my + 42, h, { class: 'm-kicker', 'text-anchor': 'middle' }));
      r.row1 = wrap(r.map); r.row0 = wrap(r.map);
      [['참', '1', '켜짐'], ['거짓', '0', '꺼짐']].forEach((row, k) => {
        const grp = k ? r.row0 : r.row1;
        r[k ? 'hl0' : 'hl1'] = el('rect', { x: mx + 12, y: my + 62 + k * 62, width: 476, height: 54, rx: 9, class: 'm-hl' }, grp);
        row.forEach((c, i) => text(grp, mx + 90 + i * 160, my + 100 + k * 62, c, { class: 'm-title2', 'text-anchor': 'middle' }));
      });
      // 스위치 하나 회로
      r.circ = wrap(root);
      const g = group(r.circ, 40, 252);
      C.battery(g, 90, 160);
      r.w = [L.wire(g, 'M90 152 V60 H200'), L.wire(g, 'M280 60 H460 V126'), L.wire(g, 'M460 196 V270 H90 V168')];
      r.sw = L.knifeSwitch(g, 200, 60, { label: '스위치' });
      r.lp = L.lamp(g, 460, 160, { label: '전구' });
      // 입력 → 규칙 → 결과
      r.rule = wrap(root);
      card(r.rule, 700, 470, 500, 100);
      r.inA = L.bitChip(r.rule, 760, 520, 1, { r: 22 });
      text(r.rule, 760, 562, '입력', { class: 'm-small', 'text-anchor': 'middle' });
      el('path', { d: 'M792 520 H858', class: 'm-arrow' }, r.rule);
      el('rect', { x: 866, y: 490, width: 150, height: 60, rx: 10, class: 'm-rulebox' }, r.rule);
      text(r.rule, 941, 528, '규칙', { class: 'm-title2', 'text-anchor': 'middle' });
      el('path', { d: 'M1022 520 H1088', class: 'm-arrow' }, r.rule);
      r.outB = L.bitChip(r.rule, 1120, 520, 0, { r: 22 });
      text(r.rule, 1120, 562, '결과', { class: 'm-small', 'text-anchor': 'middle' });
      r.chips = L.ORDER.map((k, i) => {
        const c = wrap(root);
        el('rect', { x: 120 + i * 180, y: 610, width: 150, height: 52, rx: 26, class: 'm-gchip', stroke: GATES[k].color }, c);
        text(c, 195 + i * 180, 644, k, { class: 'm-gchip-t', 'text-anchor': 'middle', fill: GATES[k].color });
        return c;
      });
      return r;
    },
    update(r, t) {
      pop(r.q, P(t, 0, 0.8));
      pop(r.pT, P(t, 2.5, 3.2)); pop(r.pF, P(t, 3, 3.7));
      op(r.map, P(t, 5, 6));
      op(r.circ, P(t, 9, 10));
      // 11초부터 3초마다 켜기/끄기
      const k = t < 11 ? -1 : Math.floor((t - 11) / 3);
      const on = k >= 0 ? (k % 2 === 0 ? 1 : 0) : 0, prev = k > 0 ? ((k - 1) % 2 === 0 ? 1 : 0) : 0;
      const p = k >= 0 ? clamp01((t - 11 - k * 3) / 0.7) : 1;
      r.sw.set(on, p, k > 0 ? prev : on);
      // 날이 접점에 닿아 있을 때만 켜진다 (여는 중에는 움직이기 시작하면 바로 꺼짐)
      const lit = (on ? p >= 1 : prev && k > 0 && p <= 0) ? 1 : 0;
      r.w.forEach((w) => w.set(lit, t));
      r.lp.set(lit);
      r.hl1.style.opacity = t > 11 && lit ? '1' : '0';
      r.hl0.style.opacity = t > 11 && !lit ? '1' : '0';
      pop(r.rule, P(t, 20, 21));
      const rk = Math.floor(Math.max(0, t - 21) / 2) % 2;
      r.inA.set(rk ? 0 : 1); r.outB.set(rk ? 1 : 0);
      r.chips.forEach((c, i) => pop(c, P(t, 27 + i * 0.5, 27.6 + i * 0.5)));
    }
  });

  // 2. NOT
  CH.push({
    id: 'ch-not', title: 'NOT · 반대로 뒤집기', dur: 40, lab: 'lab.html#lab-gate?NOT',
    cues: [
      [0, '첫 번째 규칙 NOT은 가장 단순합니다. 받은 값을 반대로 뒤집습니다.'],
      [4, '냉장고 문 스위치가 그렇습니다. 문이 닫혀 스위치가 눌리면(1) 안쪽 불이 꺼집니다(0).'],
      [11, '문을 열어 스위치가 풀리면(0) 불이 켜집니다(1). 들어온 값과 나온 값이 늘 반대입니다.'],
      [18, '수로 쓰면 1 − A입니다. 1이면 0, 0이면 1이 되니까요.'],
      [25, '회로 기호는 삼각형 끝에 작은 동그라미. 이 동그라미가 ‘뒤집기’ 표시입니다.'],
      [31, '벤 다이어그램으로 보면 A의 바깥쪽, 즉 여집합입니다.']
    ],
    build(root) {
      const r = {};
      r.circ = wrap(root);
      r.c = C.CIRCUITS.NOT(r.circ, 10, 96);
      r.ex = wrap(root);
      card(r.ex, 700, 384, 540, 74);
      text(r.ex, 724, 414, '생활 속 예', { class: 'm-kicker' });
      text(r.ex, 724, 442, '냉장고 문이 닫혀 스위치가 눌리면 → 안쪽 불이 꺼진다', { class: 'm-body' });
      r.tt = L.truthTable(root, 800, 110, ['A', 'NOT A'], [[0, 1], [1, 0]], { cw: 120, outColor: GATES.NOT.color });
      r.whyG = wrap(root);
      text(r.whyG, 1130, 140, '1 − A', { class: 'm-why-head', 'text-anchor': 'middle' });
      r.whyV = [[1, '1 − 0 = 1'], [0, '1 − 1 = 0']].map(([, s], i) => text(r.whyG, 1130, r.tt.cellPos(i, 0).y + 7, s, { class: 'm-why-cell', 'text-anchor': 'middle' }));
      r.sym = wrap(root);
      L.gateSymbol(r.sym, 'NOT', 90, 150, { scale: 2 });
      el('circle', { cx: 90 + 94 * 2, cy: 230, r: 26, class: 'm-ring' }, r.sym);
      text(r.sym, 280, 300, '동그라미 = 뒤집기', { class: 'm-body', 'text-anchor': 'middle' });
      text(r.sym, 210, 360, 'NOT · 논리 부정 · ¬A', { class: 'm-title2', 'text-anchor': 'middle' });
      r.vennW = wrap(root);
      r.venn = L.venn(r.vennW, 440, 400, { r: 70, gap: 0, w: 300, h: 190, single: true });
      text(r.vennW, 590, 622, '벤 다이어그램: A의 바깥 = Aᶜ', { class: 'm-body', 'text-anchor': 'middle' });
      r.sum = wrap(root);
      card(r.sum, 800, 488, 440, 96, 'card-strong');
      text(r.sum, 824, 524, 'NOT = 반대로 뒤집는다', { class: 'm-title2' });
      text(r.sum, 824, 560, '¬A  =  1 − A  ·  Aᶜ', { class: 'm-expr' });
      return r;
    },
    update(r, t) {
      const draw = P(t, 0.3, 2.6);
      r.c.g.querySelectorAll('.wire-base').forEach((b) => { b.setAttribute('pathLength', '1'); b.style.strokeDasharray = draw < 1 ? '1' : ''; b.style.strokeDashoffset = draw < 1 ? String(1 - draw) : ''; });
      const s = stepper(t, 5, 6, 2);
      const a = s.i < 0 ? 0 : s.i, pa = s.i <= 0 ? 0 : s.i - 1;
      r.c.set(a, 0, s.i < 0 ? 1 : s.p, t, pa);
      op(r.circ, Math.min(P(t, 0, 0.8), 1 - P(t, 24, 25)));
      op(r.ex, Math.min(P(t, 2, 3), 1 - P(t, 24, 25)));
      op(r.tt.g, P(t, 0.5, 1.5));
      for (let i = 0; i < 2; i++) r.tt.reveal(i, s.i > i || (s.i === i && s.p >= 1) ? 1 : 0);
      r.tt.highlight(s.i >= 0 && t < 18 ? s.i : t >= 31 && t < 36 ? 0 : -1);
      op(r.whyG, P(t, 18, 19));
      r.whyV.forEach((v, i) => op(v, P(t, 19 + i, 20 + i)));
      pop(r.sym, P(t, 25, 26));
      op(r.vennW, P(t, 30.5, 31.5));
      r.venn.set({ '00': 1, '10': 0 }, GATES.NOT.color, P(t, 32, 33.5));
      pop(r.sum, P(t, 35, 36));
    }
  });

  // 3~5. AND · OR · XOR
  CH.push(gateChapter('AND', {
    id: 'ch-and', title: 'AND · 논리곱', lab: 'lab.html#lab-gate?AND',
    example: '카드키를 대고 그리고 지문도 맞아야 → 문이 열린다',
    cues: [
      [0, 'AND는 ‘그리고’입니다. 카드키를 대고, 그리고 지문도 맞아야 문이 열립니다.'],
      [4, '스위치 두 개를 한 줄로 이었습니다. 전류가 지나갈 길이 하나뿐이라, 한 곳이라도 끊기면 불이 꺼집니다.'],
      [13, '네 가지 경우를 모두 해 보면, 불이 켜지는 건 A도 1, B도 1일 때 단 한 번입니다.'],
      [23, '그런데 이 결과는 곱셈 A × B와 똑같습니다. 0을 곱하면 무조건 0이니까요. 그래서 ‘논리곱’입니다.'],
      [34, '회로 기호는 D 모양입니다. 벤 다이어그램에서는 A와 B가 겹치는 곳, 교집합입니다.'],
      [40, '벤 다이어그램의 네 영역은 진리표의 네 줄과 하나씩 짝이 됩니다. 결과가 1인 줄의 영역만 칠하면 됩니다.'],
      [47, '정리: AND는 둘 다 1일 때만 1입니다.']
    ],
    why(g, tt) {
      const c = whyColumn(g, tt, 'A × B', ROWS2.map(([a, b]) => `${a}×${b}=${a * b}`));
      return { update(t) { c.cells.forEach((n, i) => op(n, P(t, 24 + i * 1.2, 25 + i * 1.2))); c.eqs.forEach((n, i) => op(n, P(t, 28.5, 29.5))); } };
    }
  }));
  CH.push(gateChapter('OR', {
    id: 'ch-or', title: 'OR · 논리합', lab: 'lab.html#lab-gate?OR',
    example: '현관 버튼을 누르거나 또는 리모컨을 누르면 → 문이 열린다',
    cues: [
      [0, 'OR은 ‘또는’입니다. 현관 버튼을 누르거나, 또는 리모컨을 눌러도 문이 열립니다.'],
      [4, '이번에는 스위치를 두 갈래로 나란히 이었습니다. 길이 두 개라 한쪽만 닫혀도 전류가 흐릅니다.'],
      [13, '불이 꺼지는 건 둘 다 0일 때 단 한 번뿐입니다.'],
      [23, '결과는 덧셈 A + B와 닮았습니다. 다만 1 + 1이 2가 아니라 1. 불은 켜짐 아니면 꺼짐이라 1보다 커질 수 없으니까요. 그래서 ‘논리합’입니다.'],
      [34, '기호는 앞이 오목한 방패 모양, 벤 다이어그램에서는 A와 B를 합친 곳, 합집합입니다.'],
      [40, '여기서도 영역 하나가 진리표 한 줄입니다. 칠해지지 않는 곳은 (0, 0) 하나뿐입니다.'],
      [47, '정리: OR은 하나라도 1이면 1입니다.']
    ],
    why(g, tt) {
      const c = whyColumn(g, tt, 'A + B', ROWS2.map(([a, b]) => `${a}+${b}=${a + b}`));
      const fix = text(g, c.x, tt.cellPos(3, 0).y + 7, '1+1 → 1', { class: 'm-why-cell m-fix', 'text-anchor': 'middle' });
      const note = para(g, 760, 372 + 2, ['2가 되면 1로: ‘켜짐’은 켜짐'], { class: 'm-small' });
      return {
        update(t) {
          c.cells.forEach((n, i) => op(n, P(t, 24 + i * 1.2, 25 + i * 1.2) * (i === 3 ? 1 - P(t, 29, 30) : 1)));
          op(fix, P(t, 29.3, 30.3));
          c.eqs.forEach((n) => op(n, P(t, 30.5, 31.5)));
          op(note, Math.min(P(t, 29.5, 30.5), 1 - P(t, 33, 34)));
        }
      };
    }
  }));
  const xorCh = gateChapter('XOR', {
    id: 'ch-xor', title: 'XOR · 배타적 논리합', lab: 'lab.html#lab-gate?XOR',
    example: '계단 전등: 아래층·위층 어느 스위치로도 켜고 끌 수 있다',
    cues: [
      [0, 'XOR은 ‘둘 중 하나만’입니다. 계단 전등이 좋은 예입니다.'],
      [4, '아래층과 위층 스위치, 어느 쪽을 눌러도 전등이 켜졌다 꺼졌다 합니다. 두 스위치를 잇는 선이 엇갈려 있기 때문입니다.'],
      [13, '스위치가 서로 다를 때만 길이 이어져 불이 켜집니다. 둘 다 위이거나 둘 다 아래면 꺼집니다.'],
      [23, '왜 ‘배타적’ 논리합일까요? OR과 비교하면 ‘둘 다 1’인 경우만 0입니다. 둘 다인 경우를 배제한다는 뜻입니다.'],
      [28.5, '수로 보면 A + B를 2로 나눈 나머지입니다. 1 + 1 = 2이니 나머지는 0. 이 성질은 덧셈 회로에서 다시 나옵니다.'],
      [34, '기호는 OR 앞에 곡선을 한 줄 더 그은 모양, 벤 다이어그램은 겹친 부분을 뺀 합집합입니다.'],
      [47, '정리: XOR은 두 입력이 서로 다를 때만 1입니다.']
    ],
    why(g, tt) {
      const orC = whyColumn(g, tt, 'OR', ROWS2.map(([a, b]) => a | b));
      const strike = el('line', { x1: orC.x - 20, y1: tt.cellPos(3, 0).y + 14, x2: orC.x + 20, y2: tt.cellPos(3, 0).y - 12, class: 'm-strike' }, g);
      const tag = text(g, orC.x + 34, tt.cellPos(3, 0).y + 7, '← 둘 다는 빼기', { class: 'm-small m-err' });
      const modG = el('g', {}, g);
      para(modG, 760, 380, ['(A + B) ÷ 2의 나머지:  0, 1, 1, 0', '1 + 1 = 2 = 이진법 10 → 일의 자리 0'], { class: 'm-small', lh: 26 });
      return {
        update(t) {
          orC.cells.forEach((n, i) => op(n, P(t, 23.5 + i * 0.6, 24.3 + i * 0.6)));
          orC.eqs.forEach((n) => op(n, 0));
          op(strike, P(t, 26, 26.6)); op(tag, P(t, 26.3, 27));
          op(modG, Math.min(P(t, 28.7, 29.7), 1 - P(t, 33, 34)));
        }
      };
    }
  });
  xorCh.dur = 52;
  CH.push(xorCh);

  // 6. NAND · NOR
  CH.push({
    id: 'ch-nandnor', title: 'NAND · NOR · 뒤집기를 붙이면', dur: 46, lab: 'lab.html#lab-mystery',
    cues: [
      [0, 'AND와 OR의 결과를 NOT으로 한 번 더 뒤집은 게이트도 따로 이름이 있습니다.'],
      [4, 'AND 뒤에 NOT을 붙이면 NAND. AND의 결과 줄이 모두 반대가 됩니다.'],
      [11, '기호도 AND 끝에 뒤집기 동그라미 하나를 붙인 모양입니다.'],
      [17, 'OR 뒤에 NOT을 붙이면 NOR. ‘둘 다 0일 때만 1’이 됩니다.'],
      [31, '벤 다이어그램에서는 칠한 곳과 안 칠한 곳이 정확히 맞바뀝니다.'],
      [38, '뒤집기만 붙였을 뿐인데 왜 따로 이름을 붙였을까요? 다음 장에서 그 이유가 나옵니다.']
    ],
    build(root) {
      const r = { sides: [] };
      [['AND', 'NAND', 70], ['OR', 'NOR', 700]].forEach(([base, inv, x0]) => {
        const s = {};
        s.tt = L.truthTable(root, x0 + 60, 250, ['A', 'B', base, inv], ROWS2.map(([a, b]) => [a, b, GATES[base].fn(a, b), GATES[inv].fn(a, b)]), { cw: 92, outColor: GATES[inv].color });
        s.symBase = wrap(root); L.gateSymbol(s.symBase, base, x0 + 90, 112, { scale: 1.3 });
        s.symInv = wrap(root); L.gateSymbol(s.symInv, inv, x0 + 90, 112, { scale: 1.3 });
        s.title = text(root, x0 + 300, 170, `${inv} = NOT(${base})`, { class: 'm-title2' });
        s.arrow = el('path', { d: `M${x0 + 60 + 92 * 2.5} 236 q46 -26 92 0`, class: 'm-arrow-curve' }, root);
        s.arrowT = text(root, x0 + 60 + 92 * 3, 222, 'NOT', { class: 'm-small m-strongc', 'text-anchor': 'middle' });
        s.vW = wrap(root);
        s.vBase = L.venn(s.vW, x0 + 30, 500, { r: 52, gap: 36, w: 230, h: 150 });
        s.vInv = L.venn(s.vW, x0 + 300, 500, { r: 52, gap: 36, w: 230, h: 150 });
        text(s.vW, x0 + 145, 678, base, { class: 'm-small', 'text-anchor': 'middle' });
        text(s.vW, x0 + 415, 678, inv, { class: 'm-small', 'text-anchor': 'middle' });
        s.base = base; s.inv = inv;
        r.sides.push(s);
      });
      return r;
    },
    update(r, t) {
      r.sides.forEach((s, k) => {
        const t0 = k ? 16 : 2;
        op(s.tt.g, P(t, t0 - 1, t0));
        for (let i = 0; i < 4; i++) s.tt.reveal(i, P(t, t0 + 3 + i * 0.8, t0 + 3.6 + i * 0.8), 3);
        s.tt.highlight(t > t0 + 3 && t < t0 + 6.4 ? Math.min(3, Math.floor((t - t0 - 3) / 0.8)) : -1);
        op(s.arrow, P(t, t0 + 2, t0 + 3)); op(s.arrowT, P(t, t0 + 2, t0 + 3));
        op(s.symBase, Math.min(P(t, t0, t0 + 1), 1 - P(t, t0 + 8.5, t0 + 9.5)));
        pop(s.symInv, P(t, t0 + 9, t0 + 10));
        op(s.title, P(t, t0 + 9.5, t0 + 10.5));
        op(s.vW, P(t, 30, 31));
        const fb = L.vennFills(s.base), fi = L.vennFills(s.inv);
        s.vBase.set(fb, GATES[s.base].color, P(t, 31, 32));
        s.vInv.set(fi, GATES[s.inv].color, P(t, 32.5, 34));
      });
    }
  });

  // 7. NAND 하나로 전부
  const NETS = [
    { title: 'NOT = A NAND A', spec: { inputs: [{ id: 'A', x: 220, y: 330 }], gates: [{ id: 'n', type: 'NAND', x: 400, y: 278, in: ['A', 'A'], bend: [320, 320] }], outputs: [{ id: 'o', label: 'NOT A', src: 'n', x: 760, y: 340 }] }, rows: [[0], [1]], t0: 3 },
    { title: 'AND = NOT(A NAND B)', spec: { inputs: [{ id: 'A', x: 170, y: 270 }, { id: 'B', x: 170, y: 410 }], gates: [{ id: 'n1', type: 'NAND', x: 330, y: 288, in: ['A', 'B'] }, { id: 'n2', type: 'NAND', x: 560, y: 288, in: ['n1', 'n1'], bend: [520, 520] }], outputs: [{ id: 'o', label: 'A AND B', src: 'n2', x: 900, y: 350 }] }, rows: ROWS2, t0: 17 },
    { title: 'OR = (NOT A) NAND (NOT B)', spec: { inputs: [{ id: 'A', x: 150, y: 230 }, { id: 'B', x: 150, y: 470 }], gates: [{ id: 'na', type: 'NAND', x: 300, y: 190, in: ['A', 'A'], bend: [250, 250] }, { id: 'nb', type: 'NAND', x: 300, y: 430, in: ['B', 'B'], bend: [250, 250] }, { id: 'n3', type: 'NAND', x: 600, y: 310, in: ['na', 'nb'] }], outputs: [{ id: 'o', label: 'A OR B', src: 'n3', x: 940, y: 372 }] }, rows: ROWS2, t0: 34 }
  ];
  CH.push({
    id: 'ch-universal', title: 'NAND 하나로 모든 게이트를', dur: 54, lab: 'lab.html#lab-build',
    cues: [
      [0, 'NAND가 특별한 이유: NAND 한 종류만 있으면 다른 모든 게이트를 만들 수 있습니다.'],
      [3, '먼저 NOT. 두 입력에 같은 A를 넣으면 0 NAND 0 = 1, 1 NAND 1 = 0. 뒤집기가 됩니다.'],
      [17, 'AND는 NAND를 한 번 더 뒤집으면 됩니다. 방금 만든 ‘NAND로 만든 NOT’을 뒤에 붙입니다.'],
      [34, 'OR은 A와 B를 각각 뒤집어서 NAND에 넣습니다. ‘A도 아니고 B도 아닌 것은 아니다’ = ‘A 또는 B’ (드모르간 법칙).'],
      [49, 'NAND 한 종류로 모든 계산 회로를 만들 수 있어서, 실제 칩 설계에서도 기본 부품으로 많이 씁니다. NOR도 같은 성질이 있습니다.']
    ],
    build(root) {
      const r = { nets: [] };
      NETS.forEach((n) => {
        const w = wrap(root);
        const net = C.network(w, n.spec, { scale: 1.3 });
        text(w, 640, 610, n.title, { class: 'm-title2', 'text-anchor': 'middle' });
        r.nets.push({ w, net, n });
      });
      r.tally = ['NOT', 'AND', 'OR'].map((k, i) => {
        const g = wrap(root);
        el('rect', { x: 860 + i * 130, y: 104, width: 116, height: 48, rx: 24, class: 'm-gchip', stroke: GATES[k].color }, g);
        text(g, 918 + i * 130, 136, '✓ ' + k, { class: 'm-gchip-t', 'text-anchor': 'middle', fill: GATES[k].color });
        return g;
      });
      r.end = wrap(root);
      card(r.end, 240, 300, 800, 130, 'card-strong');
      text(r.end, 640, 352, 'NAND 하나 = 범용 게이트', { class: 'm-title1', 'text-anchor': 'middle' });
      text(r.end, 640, 396, '한 가지 부품을 많이 이어 붙여 모든 계산 회로를 만든다', { class: 'm-body', 'text-anchor': 'middle' });
      return r;
    },
    update(r, t) {
      r.nets.forEach(({ w, net, n }, k) => {
        const tEnd = k < 2 ? NETS[k + 1].t0 - 0.6 : 48.5;
        op(w, Math.min(P(t, n.t0 - 0.5, n.t0 + 0.5), 1 - P(t, tEnd, tEnd + 0.6)));
        const step = n.rows.length === 2 ? 5 : 3.2;
        const s = stepper(t, n.t0 + 1.5, step, n.rows.length);
        const row = n.rows[Math.max(0, s.i)];
        const ins = n.spec.inputs.length === 1 ? { A: row[0] } : { A: row[0], B: row[1] };
        net.set(ins, t);
      });
      r.tally.forEach((g, i) => pop(g, P(t, [14, 31, 47][i], [14.6, 31.6, 47.6][i])));
      pop(r.end, P(t, 49.3, 50.3));
    }
  });

  // 8. 반가산기
  CH.push({
    id: 'ch-adder', title: '반가산기 · 1 + 1 = 10', dur: 50, lab: 'lab.html#lab-build?adder',
    cues: [
      [0, '이제 게이트로 계산을 해 봅시다. 가장 작은 덧셈, 한 자리 이진수 두 개를 더합니다.'],
      [5, '0+0=0, 0+1=1, 1+0=1. 그런데 1+1=2는 이진법에서 10입니다. 윗자리로 1이 올라갑니다.'],
      [21, '합의 자리 S를 보세요. 다를 때만 1, XOR과 같습니다. 올림 C는 둘 다 1일 때만 1, AND입니다.'],
      [30, '그래서 XOR 하나와 AND 하나면 덧셈기가 됩니다. 이것을 반가산기라고 부릅니다.'],
      [45, '이런 덧셈기를 자리마다 이어 붙인 것이 컴퓨터 속 계산 장치의 시작입니다.']
    ],
    build(root) {
      const r = {};
      r.tt = L.truthTable(root, 80, 140, ['A', 'B', '올림 C', '합 S'], ROWS2.map(([a, b]) => [a, b, a & b, a ^ b]), { cw: 100 });
      r.col = wrap(root);
      card(r.col, 80, 420, 400, 190);
      r.colT = para(r.col, 300, 474, ['', '', ''], { class: 'm-addcol', 'text-anchor': 'end', lh: 44 });
      r.colT.querySelectorAll('tspan')[2].setAttribute('dy', '58');   // 답은 가로줄 아래에
      el('line', { x1: 180, y1: 534, x2: 320, y2: 534, class: 'm-rule' }, r.col);
      r.colNote = text(r.col, 340, 590, '', { class: 'm-small' });
      r.mark = wrap(root);
      el('rect', { x: 280, y: 146, width: 96, height: 228, rx: 10, class: 'm-colmark', stroke: GATES.AND.color }, r.mark);
      el('rect', { x: 380, y: 146, width: 96, height: 228, rx: 10, class: 'm-colmark', stroke: GATES.XOR.color }, r.mark);
      text(r.mark, 328, 400, '= AND', { class: 'm-small m-strongc', 'text-anchor': 'middle', fill: GATES.AND.color });
      text(r.mark, 428, 400, '= XOR', { class: 'm-small m-strongc', 'text-anchor': 'middle', fill: GATES.XOR.color });
      r.netW = wrap(root);
      r.net = C.network(r.netW, {
        inputs: [{ id: 'A', x: 640, y: 250 }, { id: 'B', x: 640, y: 450 }],
        gates: [{ id: 'x', type: 'XOR', x: 820, y: 196, in: ['A', 'B'], bend: [740, 790] }, { id: 'a', type: 'AND', x: 820, y: 396, in: ['A', 'B'], bend: [740, 790] }],
        outputs: [{ id: 's', label: '합 S', src: 'x', x: 1160, y: 254 }, { id: 'c', label: '올림 C', src: 'a', x: 1160, y: 454 }]
      }, { scale: 1.3 });
      text(r.netW, 940, 640, '반가산기 = XOR + AND', { class: 'm-title2', 'text-anchor': 'middle' });
      r.chain = wrap(root);
      card(r.chain, 580, 120, 660, 110, 'card-strong');
      ['자리 1', '자리 2', '자리 3', '…'].forEach((s, i) => {
        el('rect', { x: 610 + i * 156, y: 146, width: 128, height: 58, rx: 10, class: 'm-rulebox' }, r.chain);
        text(r.chain, 674 + i * 156, 182, s, { class: 'm-body', 'text-anchor': 'middle' });
        if (i < 3) el('path', { d: `M${738 + i * 156} 175 H${766 + i * 156}`, class: 'm-arrow' }, r.chain);
      });
      return r;
    },
    update(r, t) {
      op(r.tt.g, P(t, 0.5, 1.5));
      const s = stepper(t, 6, 3.6, 4);
      for (let i = 0; i < 4; i++) { r.tt.reveal(i, s.i >= i ? 1 : 0, 2); r.tt.reveal(i, s.i >= i ? 1 : 0, 3); }
      const cur = ROWS2[Math.max(0, s.i)];
      op(r.col, P(t, 5.5, 6.5) * (1 - P(t, 29.5, 30.5)));
      const ts = r.colT.querySelectorAll('tspan');
      ts[0].textContent = `${cur[0]}`; ts[1].textContent = `+ ${cur[1]}`; ts[2].textContent = `${cur[0] & cur[1]}${cur[0] ^ cur[1]}`;
      r.colNote.textContent = cur[0] & cur[1] ? '← 윗자리로 올림 1' : '';
      op(r.mark, Math.min(P(t, 21, 22), 1 - P(t, 29.5, 30.5)));
      const n2 = stepper(t, 31, 3.4, 4);
      r.tt.highlight(t < 21 ? s.i : t >= 31 && t < 45 ? n2.i : -1);
      op(r.netW, P(t, 30, 31));
      const nr = ROWS2[Math.max(0, n2.i)];
      r.net.set({ A: nr[0], B: nr[1] }, t);
      pop(r.chain, P(t, 45, 46));
    }
  });

  // 9. 비트 연산과 XOR 암호
  const MSG = 72, KEY = 0b10110101;
  const bitsOf = (v) => Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1);
  CH.push({
    id: 'ch-bits', title: '비트 연산 · XOR 암호', dur: 42, lab: 'lab.html#lab-bits',
    cues: [
      [0, '논리 연산은 비트 여러 개에 한꺼번에 쓸 수 있습니다. 글자 H는 컴퓨터 안에서 01001000입니다.'],
      [5, '비밀 열쇠 10110101과 자리마다 XOR을 합니다. 같으면 0, 다르면 1.'],
      [15, '결과 11111101은 뜻을 알 수 없는 값, 즉 암호문이 됩니다.'],
      [20, '받는 사람이 같은 열쇠로 한 번 더 XOR하면, 원래 글자 H가 그대로 돌아옵니다.'],
      [31, '왜 돌아올까요? 같은 값끼리 XOR하면 0이고, 어떤 값에 0을 XOR하면 그대로이기 때문입니다.']
    ],
    build(root) {
      const r = { rows: {} };
      const mk = (key, label, y, val, sub) => {
        const g = wrap(root);
        text(g, 300, y + 36, label, { class: 'm-title2', 'text-anchor': 'end' });
        const cells = bitsOf(val).map((b, i) => {
          const c = group(g, 330 + i * 66, y);
          const rect = el('rect', { x: 0, y: 0, width: 56, height: 56, rx: 9, class: 'm-bit' }, c);
          const tx = text(c, 28, 38, String(b), { class: 'm-bit-t', 'text-anchor': 'middle' });
          return { c, rect, tx, b };
        });
        const side = text(g, 880, y + 36, sub, { class: 'm-body' });
        r.rows[key] = { g, cells, side };
      };
      mk('m', '글자 H', 120, MSG, '= 72 → ‘H’');
      mk('k', '⊕ 열쇠', 190, KEY, '');
      mk('c', '= 암호문', 290, MSG ^ KEY, '= 253 → 뜻 없음');
      mk('c2', '암호문', 410, MSG ^ KEY, '');
      mk('k2', '⊕ 열쇠', 480, KEY, '');
      mk('m2', '= 해독', 580, MSG, '= 72 → ‘H’ ✓');
      r.l1 = el('line', { x1: 320, y1: 270, x2: 860, y2: 270, class: 'm-rule' }, root);
      r.l2 = el('line', { x1: 320, y1: 560, x2: 860, y2: 560, class: 'm-rule' }, root);
      r.col = el('rect', { x: 0, y: 112, width: 70, height: 244, rx: 10, class: 'm-colmark', stroke: GATES.XOR.color }, root);
      r.col2 = el('rect', { x: 0, y: 402, width: 70, height: 244, rx: 10, class: 'm-colmark', stroke: GATES.XOR.color }, root);
      r.alg = wrap(root);
      card(r.alg, 880, 380, 360, 250, 'card-strong');
      r.algT = para(r.alg, 904, 426, ['M ⊕ K ⊕ K', '= M ⊕ (K ⊕ K)', '= M ⊕ 0', '= M'], { class: 'm-expr', lh: 44 });
      text(r.alg, 904, 612, '같은 값끼리 XOR → 0', { class: 'm-small' });
      return r;
    },
    update(r, t) {
      const R = r.rows;
      op(R.m.g, P(t, 0, 1)); op(R.k.g, P(t, 4.5, 5.5));
      op(R.c.g, P(t, 5.5, 6.5)); op(r.l1, P(t, 5.5, 6.5));
      const i1 = t < 6 ? -1 : Math.min(7, Math.floor((t - 6) / 1.05));
      R.c.cells.forEach((c, i) => op(c.tx, i <= i1 ? 1 : 0));
      op(R.c.side, P(t, 15, 16));
      r.col.setAttribute('x', String(323 + Math.max(0, i1) * 66));
      op(r.col, t >= 6 && t < 14.8 ? 1 : 0);
      op(R.c2.g, P(t, 20, 21)); op(R.k2.g, P(t, 20.5, 21.5)); op(R.m2.g, P(t, 21, 22)); op(r.l2, P(t, 21, 22));
      const i2 = t < 22 ? -1 : Math.min(7, Math.floor((t - 22) / 0.75));
      R.m2.cells.forEach((c, i) => op(c.tx, i <= i2 ? 1 : 0));
      op(R.m2.side, P(t, 28.5, 29.5));
      r.col2.setAttribute('x', String(323 + Math.max(0, i2) * 66));
      op(r.col2, t >= 22 && t < 28.2 ? 1 : 0);
      ['m', 'k', 'c', 'c2', 'k2', 'm2'].forEach((k) => R[k].cells.forEach((c) => c.c.classList.toggle('on', c.b === 1)));
      op(r.alg, P(t, 31, 32));
      r.algT.querySelectorAll('tspan').forEach((s, i) => op(s, P(t, 31.5 + i * 1.8, 32.3 + i * 1.8)));
    }
  });

  // 10. AI 뉴런과 XOR 문제
  const PL = { x0: 760, y0: 560, u: 300 };   // 평면: (0,0) 화면 위치와 1칸 길이
  const toScr = (a, b) => [PL.x0 + a * PL.u, PL.y0 - b * PL.u];
  function lineThrough(w1, w2, b) {   // w1·x + w2·y + b = 0 을 평면 상자 안에서 자른 선분
    const xs = [-0.45, 1.45], pts = [];
    if (Math.abs(w2) > 1e-6) xs.forEach((x) => pts.push([x, (-b - w1 * x) / w2]));
    else { const x = -b / w1; pts.push([x, -0.45], [x, 1.45]); }
    return pts.map(([x, y]) => toScr(x, y));
  }
  function halfPlanePoly(w1, w2, b) {   // w1x+w2y+b > 0 쪽 영역을 상자로 자른 다각형
    const box = [[-0.45, -0.45], [1.45, -0.45], [1.45, 1.45], [-0.45, 1.45]];
    const f = ([x, y]) => w1 * x + w2 * y + b;
    const out = [];
    for (let i = 0; i < 4; i++) {
      const p = box[i], q = box[(i + 1) % 4], fp = f(p), fq = f(q);
      if (fp > 0) out.push(p);
      if ((fp > 0) !== (fq > 0)) { const k = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
    }
    return out.map(([x, y]) => toScr(x, y).join(',')).join(' ');
  }
  CH.push({
    id: 'ch-neuron', title: 'AI 뉴런과 XOR 문제', dur: 62, lab: 'lab.html#lab-neuron',
    cues: [
      [0, 'AI 신경망의 뉴런(퍼셉트론)도 0과 1을 내는 장치입니다. 입력에 가중치를 곱해 더하고, 그 합이 0보다 크면 1을 냅니다.'],
      [7, '평면으로 보면, 뉴런은 직선 하나를 긋고 한쪽은 1, 다른 쪽은 0이라고 답하는 셈입니다.'],
      [12, 'AND: (1, 1)만 따로 떼어 내는 직선이 있습니다. 네 점 모두 맞습니다.'],
      [19, '직선을 조금 옮기면 OR, 방향을 뒤집으면 NAND도 됩니다.'],
      [30, '그런데 XOR은? 1인 두 점이 대각선으로 마주 보고 있어서, 어떤 직선을 그어도 한 점 이상 틀립니다.'],
      [44, '해결책은 뉴런을 두 층으로 쌓는 것. OR 직선과 NAND 직선, 두 줄 사이의 띠만 1이라고 답하면 XOR이 됩니다.'],
      [54, '1969년 민스키와 패퍼트가 짚은 이 ‘XOR 문제’는, 여러 층 신경망이 필요한 이유를 보여 주는 대표적인 예입니다.']
    ],
    build(root) {
      const r = {};
      // 뉴런 그림
      r.neu = wrap(root);
      const nG = r.neu;
      r.inA = L.bitChip(nG, 110, 250, 0, { r: 26 }); text(nG, 70, 258, 'A', { class: 'net-label', 'text-anchor': 'end' });
      r.inB = L.bitChip(nG, 110, 450, 0, { r: 26 }); text(nG, 70, 458, 'B', { class: 'net-label', 'text-anchor': 'end' });
      el('path', { d: 'M136 250 L310 340', class: 'm-edge' }, nG);
      el('path', { d: 'M136 450 L310 360', class: 'm-edge' }, nG);
      r.w1T = text(nG, 210, 272, 'w₁', { class: 'm-wt', 'text-anchor': 'middle' });
      r.w2T = text(nG, 210, 452, 'w₂', { class: 'm-wt', 'text-anchor': 'middle' });
      el('circle', { cx: 350, cy: 350, r: 44, class: 'm-neuron' }, nG);
      text(nG, 350, 364, 'Σ', { class: 'm-title1', 'text-anchor': 'middle' });
      r.bT = text(nG, 350, 286, '+ b', { class: 'm-wt', 'text-anchor': 'middle' });
      el('path', { d: 'M394 350 H440', class: 'm-arrow' }, nG);
      el('rect', { x: 446, y: 318, width: 70, height: 64, rx: 10, class: 'm-rulebox' }, nG);
      el('path', { d: 'M458 368 H481 V332 H504', class: 'm-step' }, nG);
      el('path', { d: 'M520 350 H556', class: 'm-arrow' }, nG);
      r.out = L.bitChip(nG, 586, 350, 0, { r: 26 });
      r.form = text(nG, 330, 570, 'w₁·A + w₂·B + b > 0 이면 1', { class: 'm-expr', 'text-anchor': 'middle' });
      r.param = text(nG, 330, 612, '', { class: 'm-body', 'text-anchor': 'middle' });
      // 두 층 그림
      r.deep = wrap(root);
      const dG = r.deep;
      [[110, 250, 'A'], [110, 450, 'B']].forEach(([x, y, s]) => { L.bitChip(dG, x, y, 0, { r: 24 }); text(dG, 70, y + 8, s, { class: 'net-label', 'text-anchor': 'end' }); });
      [[330, 240, 'OR'], [330, 460, 'NAND']].forEach(([x, y, s]) => {
        el('path', { d: `M134 250 L${x - 40} ${y}`, class: 'm-edge' }, dG);
        el('path', { d: `M134 450 L${x - 40} ${y}`, class: 'm-edge' }, dG);
        el('circle', { cx: x, cy: y, r: 40, class: 'm-neuron', stroke: GATES[s].color }, dG);
        text(dG, x, y + 8, s, { class: 'm-gchip-t', 'text-anchor': 'middle', fill: GATES[s].color });
        el('path', { d: `M${x + 40} ${y} L${500} 350`, class: 'm-edge' }, dG);
      });
      el('circle', { cx: 540, cy: 350, r: 40, class: 'm-neuron', stroke: GATES.AND.color }, dG);
      text(dG, 540, 358, 'AND', { class: 'm-gchip-t', 'text-anchor': 'middle', fill: GATES.AND.color });
      text(dG, 330, 570, '1층: 직선 두 개  →  2층: 둘 다 맞는 곳', { class: 'm-body', 'text-anchor': 'middle' });
      text(dG, 330, 612, '= XOR', { class: 'm-title2', 'text-anchor': 'middle', fill: GATES.XOR.color });
      // 평면
      r.plane = wrap(root);
      const pg0 = r.plane;
      const box = { x: toScr(-0.45, 1.45)[0], y: toScr(-0.45, 1.45)[1], width: PL.u * 1.9, height: PL.u * 1.9 };
      el('rect', Object.assign({ rx: 12, class: 'm-plane' }, box), pg0);
      const cp = el('clipPath', { id: 'planeClip' }, el('defs', {}, pg0));
      el('rect', Object.assign({ rx: 12 }, box), cp);
      const pg = el('g', { 'clip-path': 'url(#planeClip)' }, pg0);
      r.shade1 = el('polygon', { class: 'm-shade' }, pg);
      r.shade2 = el('polygon', { class: 'm-shade m-shade2' }, pg);
      r.band = el('polygon', { class: 'm-band' }, pg);
      el('line', { x1: toScr(-0.4, 0)[0], y1: PL.y0, x2: toScr(1.4, 0)[0], y2: PL.y0, class: 'm-axis' }, pg);
      el('line', { x1: PL.x0, y1: toScr(0, -0.4)[1], x2: PL.x0, y2: toScr(0, 1.4)[1], class: 'm-axis' }, pg);
      text(pg, toScr(1.4, 0)[0] - 4, PL.y0 + 30, 'A', { class: 'net-label', 'text-anchor': 'end' });
      text(pg, PL.x0 - 16, toScr(0, 1.4)[1] + 20, 'B', { class: 'net-label', 'text-anchor': 'end' });
      r.line1 = el('line', { class: 'm-sep' }, pg);
      r.line2 = el('line', { class: 'm-sep m-sep2' }, pg);
      r.pts = ROWS2.map(([a, b]) => {
        const [x, y] = toScr(a, b);
        const g = group(pg, x, y);
        const ring = el('circle', { r: 30, class: 'm-wrong' }, g);
        const c = el('circle', { r: 20, class: 'm-pt' }, g);
        const tx = text(g, 0, 7, '', { class: 'm-pt-t', 'text-anchor': 'middle' });
        text(g, 30, -30, `(${a}, ${b})`, { class: 'm-small' });   // 축선(x=0, y=0)을 피해 오른쪽 위
        return { g, c, tx, ring, a, b };
      });
      r.score = text(pg0, 970, 150, '', { class: 'm-title2', 'text-anchor': 'middle' });
      r.gateName = text(pg0, 970, 112, '', { class: 'm-kicker', 'text-anchor': 'middle' });
      return r;
    },
    update(r, t) {
      op(r.neu, Math.min(P(t, 0, 1), 1 - P(t, 44, 45)));
      op(r.deep, P(t, 44.5, 45.5));
      op(r.plane, P(t, 6.5, 7.5));
      // 장면별 목표 게이트와 직선
      let target = 'AND', w1 = 1, w2 = 1, b = -1.5, two = false;
      if (t < 12) { b = -1.5; }
      else if (t < 19) { b = -1.5; }
      else if (t < 25) { target = 'OR'; b = lerp(-1.5, -0.5, P(t, 19.5, 21.5)); }
      else if (t < 30) {
        target = 'NAND';
        const c = lerp(0.5, 1.5, P(t, 25, 26.5));   // 직선 A + B = c 를 위로 옮긴 뒤
        const flip = t >= 27 ? -1 : 1;              // 27초에 1이라고 답하는 쪽을 뒤집는다
        w1 = flip; w2 = flip; b = -flip * c;
      }
      else if (t < 44) { // XOR: 직선을 돌려 보며 틀린 개수를 센다
        target = 'XOR';
        const p = lin(t, 31, 43);
        const ang = p * Math.PI * 3.2 + 0.4;
        w1 = Math.cos(ang); w2 = Math.sin(ang);
        const off = 0.5 + 0.35 * Math.sin(p * Math.PI * 5);
        b = -(w1 * off + w2 * off);
      } else { target = 'XOR'; two = true; }
      const show = t >= 11;
      const seg = lineThrough(w1, w2, b);
      [['x1', 0, 0], ['y1', 0, 1], ['x2', 1, 0], ['y2', 1, 1]].forEach(([k, i, j]) => r.line1.setAttribute(k, seg[i][j].toFixed(1)));
      r.shade1.setAttribute('points', halfPlanePoly(w1, w2, b));
      op(r.line1, show && !two ? P(t, 11, 12) : two ? 1 - P(t, 44, 45) : 0);
      op(r.shade1, show && !two ? P(t, 11, 12) * 0.9 : 0);
      // 두 층: OR 직선(x+y-0.5) 과 NAND 직선(-x-y+1.5)
      const s2 = lineThrough(1, 1, -0.5), s3 = lineThrough(-1, -1, 1.5);
      const pv = P(t, 45, 47);
      [['x1', 0, 0], ['y1', 0, 1], ['x2', 1, 0], ['y2', 1, 1]].forEach(([k, i, j]) => { r.line2.setAttribute(k, s3[i][j].toFixed(1)); });
      if (two) [['x1', 0, 0], ['y1', 0, 1], ['x2', 1, 0], ['y2', 1, 1]].forEach(([k, i, j]) => r.line1.setAttribute(k, s2[i][j].toFixed(1)));
      op(r.line1, two ? pv : r.line1.style.opacity);
      op(r.line2, two ? pv : 0);
      r.band.setAttribute('points', [toScr(-0.45, 0.95), toScr(0.95, -0.45), toScr(1.45, -0.45), toScr(1.45, 0.05), toScr(0.05, 1.45), toScr(-0.45, 1.45)].map((p) => p.join(',')).join(' '));
      op(r.band, two ? P(t, 47, 48.5) : 0);
      // 점 표시와 채점
      let wrong = 0;
      r.pts.forEach((pt) => {
        const goal = GATES[target].fn(pt.a, pt.b);
        const z = two ? (GATES.OR.fn(pt.a, pt.b) & GATES.NAND.fn(pt.a, pt.b)) : (w1 * pt.a + w2 * pt.b + b > 0 ? 1 : 0);
        pt.c.classList.toggle('one', goal === 1);
        pt.tx.textContent = String(goal);
        const bad = show && z !== goal;
        if (bad) wrong++;
        op(pt.ring, bad ? 1 : 0);
      });
      r.gateName.textContent = t >= 7 ? `목표: ${target}` : '';
      r.score.textContent = show ? (wrong ? `틀린 점 ${wrong}개` : '네 점 모두 맞음 ✓') : '';
      r.score.classList.toggle('m-err', wrong > 0);
      r.param.textContent = !two && show ? `w₁ = ${w1.toFixed(1)}, w₂ = ${w2.toFixed(1)}, b = ${b.toFixed(1)}` : '';
      r.inA.set(0); r.inB.set(0); r.out.set(0);
    }
  });

  // 11. 정리
  CH.push({
    id: 'ch-summary', title: '정리 · 여섯 가지 규칙', dur: 28, lab: 'lab.html',
    cues: [
      [0, '여섯 규칙을 한눈에 정리합니다. 진리표의 결과 줄, 기호, 벤 다이어그램은 모두 같은 내용을 다르게 그린 것입니다.'],
      [12, '복잡한 계산도 결국 이 여섯 가지를 이어 붙여 만듭니다.'],
      [19, '이제 체험 페이지에서 직접 스위치를 켜 보고, 회로를 만들고, 뉴런의 직선을 움직여 보세요.']
    ],
    build(root) {
      const r = { cards: [] };
      L.ORDER.forEach((k, i) => {
        const G = GATES[k];
        const x = 60 + (i % 3) * 400, y = 104 + Math.floor(i / 3) * 290;
        const g = wrap(root);
        card(g, x, y, 370, 266);
        el('rect', { x, y, width: 370, height: 10, rx: 4, fill: G.color }, g);
        text(g, x + 22, y + 48, `${k}`, { class: 'm-title2', fill: G.color });
        text(g, x + 22 + (k.length * 16 + 22), y + 48, G.ko, { class: 'm-body' });
        L.gateSymbol(g, k, x + 18, y + 70, { scale: 0.85, label: false });
        L.venn(g, x + 172, y + 66, { r: 34, gap: 24, w: 176, h: 112, single: k === 'NOT', minimal: true }).set(L.vennFills(k), G.color, 1);
        const rows = G.arity === 1 ? [[0], [1]] : ROWS2;
        text(g, x + 22, y + 218, (G.arity === 1 ? 'A: ' : 'AB: ') + rows.map((rr) => rr.join('')).join('  '), { class: 'm-mono-s' });
        text(g, x + 22, y + 244, '→  ' + L.column(k).join('    '), { class: 'm-mono-s m-strongc', fill: G.color });
        text(g, x + 210, y + 244, G.say, { class: 'm-small' });
        r.cards.push(g);
      });
      return r;
    },
    update(r, t) { r.cards.forEach((g, i) => pop(g, P(t, 1 + i * 1.4, 1.8 + i * 1.4))); }
  });

  // ========== 재생 엔진 ==========
  const svg = document.getElementById('stage');
  const layer = el('g', {}, svg);
  const header = el('g', { class: 'm-header' }, svg);
  const hChip = el('rect', { x: 40, y: 28, width: 54, height: 40, rx: 8, class: 'm-hchip' }, header);
  const hNum = text(header, 67, 56, '', { class: 'm-hnum', 'text-anchor': 'middle' });
  const hTitle = text(header, 110, 58, '', { class: 'm-htitle' });
  void hChip;
  let start = 0;
  CH.forEach((c) => { c.start = start; start += c.dur; });
  const TOTAL = start;

  const $ = (id) => document.getElementById(id);
  const ui = {
    play: $('playBtn'), prev: $('prevBtn'), next: $('nextBtn'), time: $('timeText'), bar: $('scrub'), barFill: $('scrubFill'),
    marks: $('scrubMarks'), speed: $('speedSel'), cc: $('ccBtn'), caption: $('caption'), chList: $('chapterList'),
    lab: $('labLink'), labT: $('labLinkText'), endCard: $('endCard'), startCard: $('startCard'), startBtn: $('startBtn'),
    full: $('fullBtn'), player: $('player'), transcript: $('transcript')
  };
  const state = { t: 0, playing: false, rate: 1, idx: -1, refs: null, cc: true, lastFrame: 0 };
  const progress = L.readProgress();

  const chapterAt = (t) => { let i = 0; while (i < CH.length - 1 && t >= CH[i + 1].start) i++; return i; };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function render(t) {
    const i = chapterAt(t), ch = CH[i];
    if (i !== state.idx) {
      layer.replaceChildren();
      state.refs = ch.build(layer);
      state.idx = i;
      hNum.textContent = String(i + 1).padStart(2, '0');
      hTitle.textContent = ch.title;
      onChapterChange(i);
    }
    const lt = t - ch.start;
    ch.update(state.refs, lt);
    // 장 처음·끝 전환
    op(layer, Math.min(P(lt, 0, 0.4), 1 - P(lt, ch.dur - 0.35, ch.dur)));
    op(header, P(lt, 0, 0.4));
    // 자막
    let cue = '';
    for (const [s, c] of ch.cues) if (lt >= s) cue = c;
    if (ui.caption.textContent !== cue) ui.caption.textContent = cue;
    // 진행 표시
    ui.barFill.style.width = `${(t / TOTAL) * 100}%`;
    ui.bar.setAttribute('aria-valuenow', String(Math.round(t)));
    ui.bar.setAttribute('aria-valuetext', `${fmt(t)} / ${fmt(TOTAL)}, ${i + 1}장 ${ch.title}`);
    ui.time.textContent = `${fmt(t)} / ${fmt(TOTAL)}`;
    if (lt > ch.dur * 0.85 && !progress.motion[ch.id]) { progress.motion[ch.id] = 1; L.markProgress('motion', ch.id); markList(); }
  }

  function onChapterChange(i) {
    const ch = CH[i];
    const topic = L.TOPICS.find((x) => x.motion === ch.id);
    ui.lab.href = ch.lab;
    ui.labT.textContent = topic ? `이 내용 직접 해 보기 · ${topic.labTitle}` : '체험 활동 모두 보기';
    [...ui.chList.querySelectorAll('button')].forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
    if (history.replaceState) history.replaceState(null, '', '#' + ch.id);
  }

  function seek(t) {
    state.t = Math.max(0, Math.min(TOTAL - 0.001, t));
    ui.endCard.hidden = true;
    render(state.t);
  }
  function play() {
    if (state.t >= TOTAL - 0.01) seek(0);
    state.playing = true; ui.startCard.hidden = true; ui.endCard.hidden = true;
    ui.play.textContent = '❚❚ 일시정지'; ui.play.setAttribute('aria-label', '일시정지');
    state.lastFrame = performance.now();
    requestAnimationFrame(loop);
  }
  function pause() {
    state.playing = false;
    ui.play.textContent = '▶ 재생'; ui.play.setAttribute('aria-label', '재생');
  }
  function loop(now) {
    if (!state.playing) return;
    const dt = Math.min(0.1, (now - state.lastFrame) / 1000);
    state.lastFrame = now;
    state.t += dt * state.rate;
    if (state.t >= TOTAL) { state.t = TOTAL - 0.001; render(state.t); pause(); ui.endCard.hidden = false; return; }
    render(state.t);
    requestAnimationFrame(loop);
  }
  const goChapter = (i) => { seek(CH[Math.max(0, Math.min(CH.length - 1, i))].start + 0.001); };

  // 장 목록과 진행 막대 눈금
  function buildList() {
    ui.chList.replaceChildren(...CH.map((c, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="no">${String(i + 1).padStart(2, '0')}</span><span class="tt"></span><span class="du">${fmt(c.dur)}</span><span class="ck" aria-hidden="true"></span>`;
      b.querySelector('.tt').textContent = c.title;
      b.addEventListener('click', () => { goChapter(i); ui.startCard.hidden = true; });
      li.append(b);
      return li;
    }));
    ui.marks.replaceChildren(...CH.slice(1).map((c) => { const m = document.createElement('span'); m.style.left = `${(c.start / TOTAL) * 100}%`; return m; }));
    ui.transcript.replaceChildren(...CH.map((c, i) => {
      const sec = document.createElement('section');
      const h = document.createElement('h3'); h.textContent = `${i + 1}. ${c.title}`;
      const p = document.createElement('p'); p.textContent = c.cues.map((x) => x[1]).join(' ');
      sec.append(h, p);
      return sec;
    }));
    markList();
  }
  function markList() {
    [...ui.chList.querySelectorAll('button')].forEach((b, i) => {
      const done = !!progress.motion[CH[i].id];
      b.classList.toggle('done', done);
      b.querySelector('.ck').textContent = done ? '✓' : '';
      b.setAttribute('aria-label', `${i + 1}장 ${CH[i].title}, ${fmt(CH[i].dur)}${done ? ', 본 장' : ''}`);
    });
  }

  // ---------- 조작 ----------
  ui.play.addEventListener('click', () => (state.playing ? pause() : play()));
  ui.startBtn.addEventListener('click', play);
  ui.prev.addEventListener('click', () => { const i = chapterAt(state.t); goChapter(state.t - CH[i].start > 2 ? i : i - 1); });
  ui.next.addEventListener('click', () => goChapter(chapterAt(state.t) + 1));
  ui.speed.addEventListener('change', () => { state.rate = Number(ui.speed.value); });
  ui.cc.addEventListener('click', () => {
    state.cc = !state.cc;
    ui.caption.hidden = !state.cc;
    ui.cc.setAttribute('aria-pressed', String(state.cc));
  });
  const scrubTo = (e) => { const r = ui.bar.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * TOTAL); };
  ui.bar.addEventListener('pointerdown', (e) => {
    ui.bar.setPointerCapture(e.pointerId);
    scrubTo(e);
    const mv = (ev) => scrubTo(ev);
    const up = () => { ui.bar.removeEventListener('pointermove', mv); ui.bar.removeEventListener('pointerup', up); };
    ui.bar.addEventListener('pointermove', mv); ui.bar.addEventListener('pointerup', up);
  });
  ui.bar.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -5, ArrowRight: 5, PageDown: 30, PageUp: -30 }[e.key];
    if (d) { e.preventDefault(); seek(state.t + d); }
    if (e.key === 'Home') { e.preventDefault(); seek(0); }
    if (e.key === 'End') { e.preventDefault(); seek(TOTAL - 0.01); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea, [role="slider"]')) return;
    if (e.key === ' ' || e.key === 'k') { if (e.target.tagName === 'BUTTON') return; e.preventDefault(); state.playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') seek(state.t + 5);
    else if (e.key === 'ArrowLeft') seek(state.t - 5);
    else if (e.key === 'n' || e.key === 'N') ui.next.click();
    else if (e.key === 'p' || e.key === 'P') ui.prev.click();
  });
  ui.full.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (ui.player.requestFullscreen) ui.player.requestFullscreen();
  });
  $('restartBtn').addEventListener('click', () => { seek(0); play(); });

  // ---------- 시작 ----------
  buildList();
  const hash = location.hash.slice(1);
  const qs = new URLSearchParams(location.search);
  const startIdx = Math.max(0, CH.findIndex((c) => c.id === hash));
  if (qs.has('t')) { seek(Number(qs.get('t'))); ui.startCard.hidden = true; }   // 스크린샷·렌더용
  else seek(CH[startIdx].start + (startIdx ? 0.001 : 0));
  if (startIdx > 0) ui.startBtn.textContent = `▶ ${startIdx + 1}장부터 보기`;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render(state.t));

  // 렌더·검사용
  window.__motion = { seek, total: TOTAL, chapters: CH.map((c) => ({ id: c.id, start: c.start, dur: c.dur, title: c.title, cues: c.cues })), state };
})();
