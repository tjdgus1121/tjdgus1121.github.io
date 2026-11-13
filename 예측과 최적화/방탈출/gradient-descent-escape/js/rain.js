/* 타이틀 화면의 픽셀 비: 낮은 해상도 캔버스에 1칸짜리 빗줄기를 계단 모양으로 그리고, 화면에 키울 때 픽셀이 보이게 한다.
 * 앞쪽(굵고 밝고 빠름)·뒤쪽(짧고 흐리고 느림) 두 겹 + 길바닥에 튀는 3프레임 물방울.
 * 저사양 기기를 위해 방울 수를 제한하고, 타이틀이 사라지면 멈춘다. 움직임 줄이기 설정이면 한 장면만 그린다. */
(function () {
  'use strict';
  const cv = document.getElementById('rain');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const title = document.getElementById('title');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PIX = 3;          // 화면 3px = 빗방울 1칸
  const SLANT = .25;      // 아래로 4칸 갈 때 옆으로 1칸
  let w = 0, h = 0, drops = [], splashes = [], last = 0;
  let boltT = -1, nextBolt = 2.5;   // 타이틀 번개: 처음엔 2.5초 뒤, 그다음 7~14초마다 두 번 번쩍

  function make(anyY) {
    const near = Math.random() < .35;
    return {
      x: Math.floor(Math.random() * (w + 40)) - 30,
      y: anyY ? Math.random() * h : -Math.random() * h * .3,
      near,
      len: near ? 4 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2),
      v: near ? 150 + Math.random() * 50 : 85 + Math.random() * 30,
      col: near ? 'rgba(206,232,244,.72)' : 'rgba(150,192,214,.42)',
      floor: near ? Math.floor(h * (.8 + Math.random() * .2)) : h + 10,
    };
  }
  function resize() {
    w = Math.ceil(cv.clientWidth / PIX); h = Math.ceil(cv.clientHeight / PIX);
    cv.width = w; cv.height = h;
    const n = Math.round(Math.min(300, Math.max(80, (w * h) / 190)));
    drops = Array.from({ length: n }, () => make(true));
    splashes = [];
  }
  function bolt(dt) {
    nextBolt -= dt;
    if (nextBolt <= 0 && boltT < 0) { boltT = 0; nextBolt = 7 + Math.random() * 7; if (window.GD && GD.sound) GD.sound.thunder(); }
    if (boltT < 0) return 0;
    boltT += dt;
    const t = boltT;
    const a = t < .06 ? 1 : t < .18 ? 1 - (t - .06) / .12 : t < .26 ? 0 : t < .32 ? .7 : t < .75 ? .7 * (1 - (t - .32) / .43) : 0;
    if (t >= .75) boltT = -1;
    return a;
  }
  function draw(dt) {
    ctx.clearRect(0, 0, w, h);
    const flash = reduce ? 0 : bolt(dt);
    if (flash > 0) { ctx.fillStyle = `rgba(214, 236, 255, ${flash * .42})`; ctx.fillRect(0, 0, w, h); }
    for (const d of drops) {
      d.y += d.v * dt; d.x += d.v * dt * SLANT;
      if (d.y >= d.floor) {
        if (d.floor < h && splashes.length < 70) splashes.push({ x: Math.round(d.x), y: d.floor, t: 0 });
        Object.assign(d, make(false));
        continue;
      }
      ctx.fillStyle = d.col;
      const x0 = Math.round(d.x), y0 = Math.round(d.y);
      for (let i = 0; i < d.len; i++) ctx.fillRect(x0 - Math.floor(i * SLANT), y0 - i, 1, 1);
    }
    // 물방울 튐: 점 하나 → 양옆으로 두 점 → 더 멀리 흐린 두 점
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.t += dt;
      const f = Math.floor(s.t / .08);
      if (f > 2) { splashes.splice(i, 1); continue; }
      ctx.fillStyle = f === 2 ? 'rgba(210,234,246,.35)' : 'rgba(220,240,250,.7)';
      if (f === 0) ctx.fillRect(s.x, s.y, 1, 1);
      else { const k = f; ctx.fillRect(s.x - k, s.y - 1, 1, 1); ctx.fillRect(s.x + k, s.y - 1, 1, 1); }
    }
  }
  function loop(ts) {
    if (getComputedStyle(title).display === 'none' || title.hidden) { ctx.clearRect(0, 0, w, h); return; }
    const dt = Math.min(.05, (ts - (last || ts)) / 1000);
    last = ts;
    draw(dt);
    requestAnimationFrame(loop);
  }
  resize();
  addEventListener('resize', () => { resize(); if (reduce) draw(0); });
  if (reduce) { draw(0); return; }
  requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => { last = 0; });
})();
