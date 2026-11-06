/* circuits.js — 스위치 회로(전기로 보는 논리)와 게이트 회로망(기호로 보는 논리)
 * 모두 지역 좌표 640×460 상자 안에 그린다. set(a, b, p, t): p = 스위치 움직임 진행(0~1), t = 전류 무늬 시각
 */
(function (root) {
  'use strict';
  const L = root.Logic;
  const { el, text, group } = L;

  // 전원(전지): 긴 판 +, 짧은 판 −
  function battery(g, x, y) {
    const b = group(g, x, y, { class: 'battery' });
    el('line', { x1: -30, y1: -8, x2: 30, y2: -8, class: 'bat-long' }, b);
    el('line', { x1: -16, y1: 8, x2: 16, y2: 8, class: 'bat-short' }, b);
    text(b, -46, -2, '+', { class: 'bat-sign', 'text-anchor': 'middle' });
    text(b, -40, 34, '전원', { class: 'sw-label small', 'text-anchor': 'end' });
    return b;
  }

  // 끊긴 곳 표시
  function breakMark(g, x, y) {
    const m = group(g, x, y, { class: 'break-mark' });
    el('circle', { cx: 0, cy: 0, r: 15 }, m);
    el('path', { d: 'M-6 -6 L6 6 M6 -6 L-6 6' }, m);
    text(m, 0, -24, '끊김', { 'text-anchor': 'middle' });
    return m;
  }

  // 전환 스위치(계단 스위치): 가운데 공통 접점과 위·아래 접점 사이를 레버가 오간다
  function spdt(g, cx, cy, dir, label) {
    const s = group(g, 0, 0, { class: 'sw spdt' });
    const tx = cx + dir * 80;
    el('circle', { cx, cy, r: 7, class: 'sw-pin' }, s);
    el('circle', { cx: tx, cy: cy - 60, r: 7, class: 'sw-pin' }, s);
    el('circle', { cx: tx, cy: cy + 60, r: 7, class: 'sw-pin' }, s);
    text(s, tx + dir * 26, cy - 54, '1', { class: 'sw-throw', 'text-anchor': 'middle' });
    text(s, tx + dir * 26, cy + 66, '0', { class: 'sw-throw', 'text-anchor': 'middle' });
    const lever = el('line', { x1: cx, y1: cy, x2: tx, y2: cy + 60, class: 'sw-lever' }, s);
    text(s, cx, cy + 108, label, { class: 'sw-label', 'text-anchor': 'middle' });
    const val = text(s, cx, cy - 92, '', { class: 'sw-value', 'text-anchor': 'middle' });
    return {
      g: s, up: { x: tx, y: cy - 60 }, down: { x: tx, y: cy + 60 }, common: { x: cx, y: cy },
      set(v, p = 1, prev = v) {
        const from = prev ? -60 : 60, to = v ? -60 : 60;
        const yy = from + (to - from) * L.clamp01(p);
        lever.setAttribute('y2', String(cy + yy));
        s.classList.toggle('on', !!v && p >= 1);
        val.textContent = v ? '1 (위)' : '0 (아래)';
      }
    };
  }

  // ---------- 스위치 회로 ----------
  // 모든 회로는 같은 틀: 왼쪽 전원(90,300), 위 선 y≈170, 전구(560,300), 아래 귀선 y=430
  function frameCommon(g) {
    battery(g, 90, 300);
    const ret = L.wire(g, 'M560 336 V430 H90 V308');
    const lp = L.lamp(g, 560, 300, { label: '결과' });
    return { ret, lp };
  }

  function circuitAND(parent, x, y) {
    const g = group(parent, x, y, { class: 'circuit' });
    const w1 = L.wire(g, 'M90 292 V170 H200');
    const w2 = L.wire(g, 'M280 170 H360');
    const w3 = L.wire(g, 'M440 170 H560 V266');
    const { ret, lp } = frameCommon(g);
    const sA = L.knifeSwitch(g, 200, 170, { label: 'A' });
    const sB = L.knifeSwitch(g, 360, 170, { label: 'B' });
    const kA = breakMark(g, 320, 140), kB = breakMark(g, 500, 140);
    const wires = [w1, w2, w3, ret];
    return {
      g, wires, lamp: lp, sA, sB,
      set(a, b, p = 1, t = 0, pa = a, pb = b) {
        sA.set(a, p, pa); sB.set(b, p, pb);
        const done = p >= 1, on = done && a && b;
        wires.forEach((w) => w.set(on ? 1 : 0, t));
        lp.set(on ? 1 : 0);
        kA.style.opacity = done && !a ? '1' : '0';
        kB.style.opacity = done && !b ? '1' : '0';
        return on ? 1 : 0;
      },
      note: '길이 하나뿐 → 두 스위치가 모두 닫혀야 전류가 흐릅니다'
    };
  }

  function circuitOR(parent, x, y) {
    const g = group(parent, x, y, { class: 'circuit' });
    const wm = L.wire(g, 'M90 292 V200 H160');
    const a1 = L.wire(g, 'M160 200 V130 H220'), a2 = L.wire(g, 'M300 130 H380 V200');
    const b1 = L.wire(g, 'M160 200 V270 H220'), b2 = L.wire(g, 'M300 270 H380 V200');
    const wr = L.wire(g, 'M380 200 H560 V266');
    const { ret, lp } = frameCommon(g);
    el('circle', { cx: 160, cy: 200, r: 6, class: 'node-dot' }, g);
    el('circle', { cx: 380, cy: 200, r: 6, class: 'node-dot' }, g);
    const sA = L.knifeSwitch(g, 220, 130, { label: 'A' });
    const sB = L.knifeSwitch(g, 220, 270, { label: 'B' });
    return {
      g, lamp: lp, sA, sB,
      set(a, b, p = 1, t = 0, pa = a, pb = b) {
        sA.set(a, p, pa); sB.set(b, p, pb);
        const done = p >= 1, on = done && (a || b);
        [wm, wr, ret].forEach((w) => w.set(on ? 1 : 0, t));
        [a1, a2].forEach((w) => w.set(done && a ? 1 : 0, t));
        [b1, b2].forEach((w) => w.set(done && b ? 1 : 0, t));
        lp.set(on ? 1 : 0);
        return on ? 1 : 0;
      },
      note: '길이 두 갈래 → 어느 한쪽만 닫혀도 전류가 흐릅니다'
    };
  }

  // 계단 스위치: 두 연결선이 엇갈려 있어서 두 스위치가 서로 다를 때만 이어진다
  function circuitXOR(parent, x, y) {
    const g = group(parent, x, y, { class: 'circuit' });
    const w1 = L.wire(g, 'M90 292 V250 H190');
    const tUp = L.wire(g, 'M270 190 C330 190 350 310 420 310');   // A 위(1) ↔ B 아래(0)
    const tDn = L.wire(g, 'M270 310 C330 310 350 190 420 190');   // A 아래(0) ↔ B 위(1)
    const w3 = L.wire(g, 'M500 250 H560 V266');
    const { ret, lp } = frameCommon(g);
    const sA = spdt(g, 190, 250, 1, 'A');
    const sB = spdt(g, 500, 250, -1, 'B');
    return {
      g, lamp: lp, sA, sB,
      set(a, b, p = 1, t = 0, pa = a, pb = b) {
        sA.set(a, p, pa); sB.set(b, p, pb);
        const done = p >= 1, on = done && a !== b;
        [w1, w3, ret].forEach((w) => w.set(on ? 1 : 0, t));
        tUp.set(on && a ? 1 : 0, t);
        tDn.set(on && !a ? 1 : 0, t);
        lp.set(on ? 1 : 0);
        return on ? 1 : 0;
      },
      note: '연결선이 엇갈려 있음 → 두 스위치가 서로 다를 때만 이어집니다 (계단 스위치)'
    };
  }

  // NOT: 평소에는 닫혀 있고, 누르면(A=1) 끊기는 스위치 (냉장고 문 스위치)
  function circuitNOT(parent, x, y) {
    const g = group(parent, x, y, { class: 'circuit' });
    const w1 = L.wire(g, 'M90 292 V170 H280');
    const w2 = L.wire(g, 'M360 170 H560 V266');
    const { ret, lp } = frameCommon(g);
    const sw = L.knifeSwitch(g, 280, 170, { label: '입력 A', valueFn: () => '' });
    const k = breakMark(g, 450, 140);
    return {
      g, lamp: lp, sw,
      set(a, b, p = 1, t = 0, pa = a) {
        sw.set(a ? 0 : 1, p, pa ? 0 : 1);   // A=1(눌림) → 스위치 열림
        sw.g.querySelector('.sw-value').textContent = a ? 'A = 1 → 끊김' : 'A = 0 → 이어짐';
        const done = p >= 1, on = done && !a;
        [w1, w2, ret].forEach((w) => w.set(on ? 1 : 0, t));
        lp.set(on ? 1 : 0);
        k.style.opacity = done && a ? '1' : '0';
        return on ? 1 : 0;
      },
      note: '누르면 끊기는 스위치 → 입력이 1이면 불이 꺼집니다'
    };
  }

  const CIRCUITS = { AND: circuitAND, OR: circuitOR, XOR: circuitXOR, NOT: circuitNOT };

  // ---------- 게이트 회로망 ----------
  // spec = { inputs:[{id,label,x,y}], gates:[{id,type,x,y,in:[src,src]}], outputs:[{id,label,src,x,y}] }
  // 선은 직각으로 잇는다. bend로 꺾는 위치를 정할 수 있다
  function network(parent, spec, opts = {}) {
    const g = group(parent, 0, 0, { class: 'network' });
    const wiresG = el('g', {}, g), partsG = el('g', {}, g);
    const scale = opts.scale || 1;
    const pos = {}, nodes = {};
    for (const i of spec.inputs) {
      pos[i.id] = { x: i.x + 22, y: i.y };
      const chip = L.bitChip(partsG, i.x, i.y, 0, { r: 20 });
      text(chip.g, -34, 7, i.label || i.id, { class: 'net-label', 'text-anchor': 'end' });
      nodes[i.id] = { kind: 'in', chip };
    }
    for (const gt of spec.gates) {
      const sym = L.gateSymbol(partsG, gt.type, gt.x, gt.y, { scale });
      pos[gt.id] = sym.outPort();
      nodes[gt.id] = { kind: 'gate', sym, def: gt };
    }
    const wires = [];
    const uses = {};
    for (const gt of spec.gates) for (const s of gt.in) uses[s] = (uses[s] || 0) + 1;
    for (const o of spec.outputs) uses[o.src] = (uses[o.src] || 0) + 1;
    const dots = new Set();
    const route = (from, to, bend) => {
      const mx = bend !== undefined ? bend : (from.x + to.x) / 2;
      return `M${from.x} ${from.y} H${mx} V${to.y} H${to.x}`;
    };
    for (const gt of spec.gates) {
      const sym = nodes[gt.id].sym;
      gt.in.forEach((src, k) => {
        const port = L.GATES[gt.type].arity === 1 ? sym.inPort(0) : sym.inPort(k);
        const bend = gt.bend && gt.bend[k] !== undefined ? gt.bend[k] : (pos[src].x + port.x) / 2;
        const w = L.wire(wiresG, route(pos[src], port, bend));
        wires.push({ w, src });
        // 한 신호가 여러 곳으로 갈라지는 곳에 점을 찍는다 (갈라짐과 교차를 구별)
        const key = `${src}@${bend}`;
        if (uses[src] > 1 && !dots.has(key)) { dots.add(key); el('circle', { cx: bend, cy: pos[src].y, r: 6, class: 'node-dot' }, partsG); }
      });
    }
    for (const o of spec.outputs) {
      const lp = L.lamp(partsG, o.x, o.y, { label: o.label });
      lp.g.setAttribute('transform', `translate(${o.x} ${o.y}) scale(0.85)`);
      const w = L.wire(wiresG, route(pos[o.src], { x: o.x - 22, y: o.y - 8 }, o.bend));
      wires.push({ w, src: o.src });
      nodes[o.id] = { kind: 'out', lamp: lp, src: o.src };
    }
    function evaluate(inputs) {
      const val = Object.assign({}, inputs);
      for (const gt of spec.gates) {
        const ins = gt.in.map((s) => val[s]);
        val[gt.id] = L.evalGate(gt.type, ins[0], ins[1]);
      }
      return val;
    }
    return {
      g, nodes, wires, evaluate,
      set(inputs, t = 0) {
        const val = evaluate(inputs);
        for (const i of spec.inputs) nodes[i.id].chip.set(val[i.id]);
        for (const { w, src } of wires) w.set(val[src], t);
        for (const o of spec.outputs) nodes[o.id].lamp.set(val[o.src]);
        return val;
      }
    };
  }

  root.Circuits = { CIRCUITS, network, battery, spdt };
})(window);
