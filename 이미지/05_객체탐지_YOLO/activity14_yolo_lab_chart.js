/* activity14_yolo_lab_chart.js — 학습 그래프(꺾은선)와 특징 지도(산점도)를 그리는 작은 SVG 도구 */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  let tip = null;
  function tooltip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.setAttribute('role', 'status');
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(html, clientX, clientY) {
    const t = tooltip();
    t.innerHTML = html;
    t.hidden = false;
    const r = t.getBoundingClientRect();
    let x = clientX + 14, y = clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = clientY - r.height - 14;
    t.style.left = Math.max(8, x) + 'px';
    t.style.top = Math.max(8, y) + 'px';
  }
  function showTipPosition(clientX, clientY) {
    const t = tooltip();
    const r = t.getBoundingClientRect();
    let x = clientX + 14, y = clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = clientY - r.height - 14;
    t.style.left = Math.max(8, x) + 'px';
    t.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  /* 꺾은선 그래프
   *   opts: { title, series: [{ name, color, dash }], yMax (고정 최댓값, 없으면 자동), format(v), xLabel }
   *   update(xs, ys[][], marks)  marks: [{ x, label }] 세로 표시선
   */
  function LineChart(host, opts) {
    const W = 360, H = 190, M = { l: 40, r: 64, t: 12, b: 26 };
    host.classList.add('chart');
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.innerHTML = opts.series.map((s) =>
      `<span><svg width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke="${s.color}" stroke-width="2.5" ${s.dash ? 'stroke-dasharray="4 3"' : ''}/></svg>${s.name}</span>`).join('');
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.title });
    host.append(legend, svg);
    const fmt = opts.format || ((v) => v.toFixed(2));
    let state = { xs: [], ys: [], marks: [] };

    function draw() {
      svg.replaceChildren();
      const { xs, ys, marks } = state;
      const xMax = Math.max(1, opts.xMax || 0, xs.length ? xs[xs.length - 1] : 1);
      let yMax = opts.yMax;
      if (!yMax) {
        let m = 0;
        for (const s of ys) for (const v of s) if (isFinite(v)) m = Math.max(m, v);
        yMax = niceMax(m);
      }
      const X = (x) => M.l + (x / xMax) * (W - M.l - M.r);
      const Y = (y) => M.t + (1 - Math.min(1, Math.max(0, y / yMax))) * (H - M.t - M.b);
      // 격자와 축
      for (let k = 0; k <= 4; k++) {
        const v = (yMax * k) / 4;
        svg.append(svgEl('line', { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), class: 'grid' }));
        const t = svgEl('text', { x: M.l - 6, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' });
        t.textContent = fmt(v);
        svg.append(t);
      }
      const xt = svgEl('text', { x: W - M.r, y: H - 6, class: 'tick', 'text-anchor': 'end' });
      xt.textContent = `${opts.xLabel || '에폭'} ${xMax}`;
      const x0 = svgEl('text', { x: M.l, y: H - 6, class: 'tick' });
      x0.textContent = '0';
      svg.append(xt, x0);
      marks.forEach((mk, mi) => {
        svg.append(svgEl('line', { x1: X(mk.x), x2: X(mk.x), y1: M.t, y2: H - M.b, class: 'mark' }));
        // 표시선이 여러 개면 라벨을 한 줄씩 내려 겹치지 않게
        const t = svgEl('text', { x: X(mk.x) + 3, y: M.t + 10 + mi * 12, class: 'mark-label' });
        t.textContent = mk.label;
        svg.append(t);
      });
      // 선 + 끝 라벨
      const ends = [];
      opts.series.forEach((s, si) => {
        const data = ys[si] || [];
        if (!data.length) return;
        const d = data.map((v, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(v).toFixed(1)}`).join('');
        svg.append(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-dasharray': s.dash ? '5 4' : 'none' }));
        const last = data.length - 1;
        ends.push({ y: Y(data[last]), x: X(xs[last]), text: `${s.name} ${fmt(data[last])}`, color: s.color });
      });
      // 끝 라벨이 겹치지 않게 위아래로 벌린다
      ends.sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
      for (const e of ends) {
        svg.append(svgEl('circle', { cx: e.x, cy: e.y, r: 3, fill: e.color }));
        const t = svgEl('text', { x: Math.min(e.x + 6, W - M.r + 6), y: e.y + 4, class: 'end-label' });
        t.textContent = e.text;
        svg.append(t);
      }
      // 십자선 (가리키면 그 에폭의 모든 값)
      const hair = svgEl('line', { y1: M.t, y2: H - M.b, class: 'hair', visibility: 'hidden' });
      const hit = svgEl('rect', { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: 'transparent' });
      svg.append(hair, hit);
      const move = (ev) => {
        if (!xs.length) return;
        const r = svg.getBoundingClientRect();
        const px = ((ev.clientX - r.left) / r.width) * W;
        const xv = ((px - M.l) / (W - M.l - M.r)) * xMax;
        let i = 0;
        for (let k = 1; k < xs.length; k++) if (Math.abs(xs[k] - xv) < Math.abs(xs[i] - xv)) i = k;
        hair.setAttribute('x1', X(xs[i])); hair.setAttribute('x2', X(xs[i]));
        hair.setAttribute('visibility', 'visible');
        const rows = opts.series.map((s, si) => ys[si] && ys[si][i] !== undefined
          ? `<div><i style="background:${s.color}"></i>${s.name} <b>${fmt(ys[si][i])}</b></div>` : '').join('');
        showTip(`<div class="tip-head">${opts.xLabel || '에폭'} ${xs[i]}</div>${rows}`, ev.clientX, ev.clientY);
      };
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', () => { hair.setAttribute('visibility', 'hidden'); hideTip(); });
    }

    draw();
    return {
      update(xs, ys, marks = []) { state = { xs, ys, marks }; draw(); },
      reset() { state = { xs: [], ys: [], marks: [] }; draw(); }
    };
  }

  /* 산점도 (특징 지도)
   *   update(points, extra, classes)
   *   points: [{ x, y, cls, label, img }]  extra: { x, y, label } (별 모양)  classes: [{ name, color }]
   *   이름이 많으면 색만으로 구분하기 어려우므로 이름마다 모양도 다르게 그린다
   */
  const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'down', 'hexagon', 'cross'];
  function shapeEl(kind, cx, cy, r, attrs) {
    const pts = (list) => svgEl('polygon', Object.assign({ points: list.map(([x, y]) => `${(cx + x * r).toFixed(1)},${(cy + y * r).toFixed(1)}`).join(' ') }, attrs));
    switch (kind) {
      case 'square': return svgEl('rect', Object.assign({ x: cx - r * 0.85, y: cy - r * 0.85, width: r * 1.7, height: r * 1.7 }, attrs));
      case 'triangle': return pts([[0, -1.15], [1.05, 0.75], [-1.05, 0.75]]);
      case 'diamond': return pts([[0, -1.2], [1.2, 0], [0, 1.2], [-1.2, 0]]);
      case 'down': return pts([[0, 1.15], [1.05, -0.75], [-1.05, -0.75]]);
      case 'hexagon': return pts([[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]]);
      case 'cross': return pts([[-0.35, -1], [0.35, -1], [0.35, -0.35], [1, -0.35], [1, 0.35], [0.35, 0.35], [0.35, 1], [-0.35, 1], [-0.35, 0.35], [-1, 0.35], [-1, -0.35], [-0.35, -0.35]]);
      default: return svgEl('circle', Object.assign({ cx, cy, r }, attrs));
    }
  }

  function ScatterChart(host, opts) {
    const W = 420, H = 300, M = 16;
    host.classList.add('chart');
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.title });
    host.append(legend, svg);

    function drawLegend(classes) {
      legend.replaceChildren();
      classes.forEach((c, i) => {
        const span = document.createElement('span');
        const ic = svgEl('svg', { width: 14, height: 14, 'aria-hidden': 'true' });
        ic.append(shapeEl(SHAPES[i % SHAPES.length], 7, 7, 5, { fill: c.color }));
        const t = document.createElement('span');
        t.textContent = c.name;
        span.append(ic, t);
        legend.append(span);
      });
      const star = document.createElement('span');
      star.innerHTML = '<svg width="14" height="14" aria-hidden="true"><path d="M7 0 L9 5 L14 5.5 L10 9 L11.5 14 L7 11 L2.5 14 L4 9 L0 5.5 L5 5 Z" fill="#1f2328"/></svg>새 사진';
      legend.append(star);
    }

    function update(points, extra, classes = []) {
      drawLegend(classes);
      svg.replaceChildren();
      const all = extra ? points.concat([extra]) : points;
      if (!all.length) return;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of all) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const sx = (W - 2 * M) / Math.max(1e-6, x1 - x0), sy = (H - 2 * M) / Math.max(1e-6, y1 - y0);
      const X = (v) => M + (v - x0) * sx, Y = (v) => H - M - (v - y0) * sy;
      svg.append(svgEl('rect', { x: 0.5, y: 0.5, width: W - 1, height: H - 1, class: 'frame' }));
      for (const p of points) {
        const c = classes[p.cls] || { color: '#888' };
        const el = shapeEl(SHAPES[p.cls % SHAPES.length], X(p.x), Y(p.y), 5, { fill: c.color, class: 'dot' });
        const enter = (ev) => {
          const t = tooltip();
          showTip('', ev.clientX, ev.clientY);
          t.replaceChildren();
          if (p.img) { const im = document.createElement('img'); im.src = p.img; im.alt = ''; im.width = 96; im.height = 72; t.append(im); }
          const d = document.createElement('div'); d.textContent = p.label; t.append(d);
          showTipPosition(ev.clientX, ev.clientY);
        };
        el.addEventListener('pointerenter', enter);
        el.addEventListener('pointerdown', enter);
        el.addEventListener('pointerleave', hideTip);
        svg.append(el);
      }
      if (extra) {
        const cx = X(extra.x), cy = Y(extra.y);
        svg.append(svgEl('path', {
          d: `M${cx} ${cy - 11} L${cx + 3.2} ${cy - 3.5} L${cx + 11} ${cy - 3} L${cx + 5} ${cy + 2.5} L${cx + 7} ${cy + 10.5} L${cx} ${cy + 6} L${cx - 7} ${cy + 10.5} L${cx - 5} ${cy + 2.5} L${cx - 11} ${cy - 3} L${cx - 3.2} ${cy - 3.5} Z`,
          fill: '#1f2328', stroke: '#fff', 'stroke-width': 1.5
        }));
        const t = svgEl('text', { x: Math.min(cx + 13, W - 60), y: cy + 4, class: 'end-label' });
        t.textContent = extra.label;
        svg.append(t);
      }
    }
    return { update };
  }

  root.YoloChart = { LineChart, ScatterChart, hideTip };
})(window);
