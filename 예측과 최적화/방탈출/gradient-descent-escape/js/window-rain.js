/* 창문 유리에만 내리는 비 + 가끔 치는 번개.
 * 맵 그림의 창문은 멈춰 있으므로, 창문마다 작은 캔버스에 빗줄기를 그리고 유리 마스크(tools/make-window-masks.py)로 잘라 맵 위에 겹친다.
 * 빗줄기는 맵 픽셀 단위(1px)로 그려서 확대될 때 픽셀 그림과 어울리게 한다.
 * 저사양 기기를 생각해 창문당 빗줄기 수를 넓이에 맞춰 제한하고, '움직임 줄이기' 설정이면 아무것도 하지 않는다(그림 속 비만 보임). */
(function (root) {
  'use strict';
  const GD = root.GD;
  const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SLANT = -0.3;          // 아래로 1px 갈 때 왼쪽으로 0.3px (그림 속 빗줄기 방향)
  const FAR = 'rgba(150, 210, 226, .38)', NEAR = 'rgba(205, 240, 250, .62)';
  const panes = new Map();     // 마스크 주소 → { cv, g, mask, drops, beads }
  const motes = new Map();     // 마스크 주소 → 창빛 속 먼지 [{ x, y, ph, sp }]
  // 저사양 보호: 프레임 시간이 길면(35fps 아래가 2초 넘게 이어지면) 빗줄기를 절반으로, 흘러내리는 물방울은 끔
  let slowFor = 0, lowQuality = false;
  let last = 0, flash = 0, flashT = -1, nextFlash = 5 + Math.random() * 6;

  const rnd = (a, b) => a + Math.random() * (b - a);
  // 비 세기(0.45~1): 약 40초 주기로 굵어졌다 가늘어짐. 빗소리(sound.js)도 같은 값을 쓴다
  const intensity = (t) => .725 + .2 * Math.sin(t * 2 * Math.PI / 41) + .075 * Math.sin(t * 2 * Math.PI / 13 + 1.3);
  function drop(w, h, anyY) {
    const near = Math.random() < .35;
    return { x: rnd(0, w + h * .3), y: anyY ? rnd(0, h) : rnd(-h * .4, 0), near,
      len: near ? Math.round(rnd(6, 10)) : Math.round(rnd(3, 6)), v: near ? rnd(170, 230) : rnd(95, 135) };
  }
  // 유리에 맺혀 천천히 흘러내리는 물방울
  function bead(w, h, anyY) { return { x: Math.round(rnd(2, w - 3)), y: anyY ? rnd(0, h) : rnd(-20, 0), v: rnd(5, 16), stop: rnd(.4, 2.2) }; }

  function pane(win) {
    let p = panes.get(win.mask);
    if (p) return p;
    const cv = document.createElement('canvas');
    cv.width = win.w; cv.height = win.h;
    const mask = new Image();
    mask.src = win.mask;
    const n = Math.max(12, Math.round(win.w * win.h / 230));
    p = { cv, g: cv.getContext('2d'), mask,
      drops: Array.from({ length: n }, () => drop(win.w, win.h, true)),
      beads: Array.from({ length: Math.max(2, Math.round(win.w / 40)) }, () => bead(win.w, win.h, true)) };
    panes.set(win.mask, p);
    return p;
  }

  // 번개가 숨은 단서를 비춘다: 등잔 없이 어두운 구석에 아직 줍지 않은 쪽지가 있으면 한 번만 알려 준다
  function lightningHint() {
    const st = GD.state, map = st && GD.MAPS[st.data.map];
    if (!map || !map.dark || st.flag('lampLit') || st.flag('lightningHint')) return;
    const hidden = map.objs.some((o) => o.dark && o.slip !== undefined && !st.picked[o.id]);
    if (!hidden || (GD.ui && GD.ui.busy)) return;
    st.set('lightningHint');
    setTimeout(() => GD.ui.toast('번개가 번쩍이자 어두운 구석에 하얀 종이가 잠깐 비쳤다'), 350);
  }
  // 번개: 짧게 두 번 번쩍. 다음 번개까지 9~18초
  function stepFlash(dt) {
    nextFlash -= dt;
    if (nextFlash <= 0 && flashT < 0) { flashT = 0; nextFlash = rnd(9, 18); if (GD.sound) GD.sound.thunder(); lightningHint(); }
    if (flashT >= 0) {
      flashT += dt;
      const t = flashT;
      flash = t < .07 ? 1 : t < .2 ? 1 - (t - .07) / .13 : t < .27 ? 0 : t < .33 ? .65 : t < .7 ? .65 * (1 - (t - .33) / .37) : 0;
      if (t >= .7) { flashT = -1; flash = 0; }
    }
  }

  function drawPane(ctx, win, dt) {
    const p = pane(win);
    if (!p.mask.complete || !p.mask.naturalWidth) return;
    const { g, cv } = p, w = cv.width, h = cv.height;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    if (flash > 0) { g.fillStyle = `rgba(225, 248, 255, ${flash * .5})`; g.fillRect(0, 0, w, h); }
    const show = Math.round(p.drops.length * intensity(performance.now() / 1000) * (lowQuality ? .5 : 1));   // 비가 약할 땐(또는 느린 기기면) 일부만 그림
    for (let i = 0; i < p.drops.length; i++) {
      const d = p.drops[i];
      d.y += d.v * dt; d.x += d.v * dt * SLANT;
      if (d.y - d.len > h || d.x < -4) Object.assign(d, drop(w, h, false));
      if (i >= show) continue;
      g.fillStyle = d.near ? NEAR : FAR;
      const x = d.x, y = d.y;
      for (let k = 0; k < d.len; k += 2) g.fillRect(Math.round(x - k * SLANT), Math.round(y - k), 1, 2);   // 계단 모양 1px 빗줄기
    }
    for (const b of (lowQuality ? [] : p.beads)) {
      if (b.stop > 0) b.stop -= dt; else b.y += b.v * dt;
      if (b.stop <= 0 && Math.random() < dt * .4) b.stop = rnd(.3, 1.4);   // 멈췄다 흘렀다
      if (b.y > h + 4) Object.assign(b, bead(w, h, false));
      const bx = b.x, by = Math.round(b.y);
      g.fillStyle = 'rgba(200, 240, 250, .28)'; g.fillRect(bx, by - 6, 1, 6);   // 지나간 자국
      g.fillStyle = 'rgba(230, 252, 255, .85)'; g.fillRect(bx - 1, by, 2, 2);  // 물방울
    }
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(p.mask, 0, 0);
    ctx.drawImage(cv, win.x, win.y);
  }

  /* 실내 효과(2026-11-12): 창 아래 바닥의 달빛 기둥에 빗줄기 그림자가 천천히 흘러내리고,
     번개가 치면 창 모양(창살 포함) 빛이 바닥에 비스듬히 비친다. 가구보다 먼저 그려 가구가 가린다. */
  const shades = new Map();
  function drawFloor(ctx, win, t) {
    const top = win.y + win.h, band = 230;
    if (!lowQuality) {
      let sh = shades.get(win.mask);
      if (!sh) { sh = Array.from({ length: Math.max(6, Math.round(win.w / 9)) }, () => ({ x: rnd(0, win.w), ph: rnd(0, band), v: rnd(28, 46), len: rnd(10, 22) })); shades.set(win.mask, sh); }
      const k = intensity(t);
      ctx.save();
      ctx.strokeStyle = 'rgba(18, 28, 46, .16)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const d of sh.slice(0, Math.round(sh.length * k))) {
        const y = (d.ph + t * d.v) % band;
        const fade = Math.min(1, y / 40, (band - y) / 60);
        if (fade <= .15) continue;
        const x = win.x + d.x - y * .12;   // 그려진 달빛 자국 방향(살짝 왼쪽 아래)으로
        ctx.moveTo(Math.round(x), Math.round(top + y)); ctx.lineTo(Math.round(x - d.len * .12), Math.round(top + y + d.len));
      }
      ctx.stroke();
      ctx.restore();
    }
    const p = panes.get(win.mask);
    if (flash > 0 && p && p.mask.complete && p.mask.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flash) * .32;
      ctx.globalCompositeOperation = 'lighter';
      // 유리 모양을 벽 아래 바닥으로 눌러 찍는다(맵에 그려진 달빛 자국처럼 창 바로 아래, 살짝 왼쪽)
      ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([1, 0, -.12, .5, win.x - 6, top + 100])));
      ctx.drawImage(p.mask, 0, 0, win.w, win.h);
      ctx.restore();
    }
  }

  GD.windowRain = {
    /* 맵 그림 바로 다음(가구보다 먼저) 호출: 창문 앞 가구가 비를 가린다 */
    draw(ctx, mapId) {
      // 눈금판을 끼우면 새벽이 오고 비가 그친다(엔딩 대사와 발코니 장면에 맞춤)
      const dawn = GD.state && GD.state.flag('plateIn');
      const list = !dawn && GD.windowGlass && GD.windowGlass[mapId];
      const now = performance.now() / 1000;
      const dt = Math.min(.06, last ? now - last : 0);
      last = now;
      // 가장 가까운 창문까지의 거리로 빗소리 크기를 조절(창가일수록 크게). 창이 없는 방은 멀리서 들리듯 작게
      if (GD.sound && GD.sound.near && GD.world && GD.world.player) {
        const p = GD.world.player, px = p.x * 64 + 32, py = p.y * 64 + 32;
        const d = list && list.length ? Math.min(...list.map((w) => Math.hypot(px - (w.x + w.w / 2), py - (w.y + w.h)))) : 900;
        GD.sound.near(Math.max(0, Math.min(1, 1 - (d - 60) / 520)));
      }
      if (reduce || !list || !list.length) return;
      if (!lowQuality && dt > 0) { slowFor = dt > 1 / 35 ? slowFor + dt : Math.max(0, slowFor - dt * 2); if (slowFor > 2) lowQuality = true; }
      stepFlash(dt);
      for (const win of list) drawPane(ctx, win, dt);
      for (const win of list) drawFloor(ctx, win, now);
    },
    /* 가구 다음에 호출: 창 아래로 떨어지는 달빛 속에 먼지가 천천히 떠다닌다 */
    dust(ctx, mapId) {
      const list = GD.windowGlass && GD.windowGlass[mapId];
      if (reduce || !list) return;
      const t = performance.now() / 1000;
      for (const win of list) {
        let ms = motes.get(win.mask);
        if (!ms) {
          ms = Array.from({ length: Math.round(win.w / 6) }, () => ({ x: rnd(0, win.w), y: rnd(0, 230), ph: rnd(0, 6.3), sp: rnd(.15, .45), big: Math.random() < .4 }));
          motes.set(win.mask, ms);
        }
        const top = win.y + win.h;
        for (const m of ms) {
          const y = (m.y + t * 6 * m.sp) % 230;                       // 아주 천천히 내려앉음
          const x = m.x + Math.sin(t * m.sp + m.ph) * 7 + y * .25;    // 좌우로 흔들리며 빛 방향(오른쪽 아래)으로
          const fadeEdge = Math.min(1, y / 40, (230 - y) / 50);       // 빛 기둥 위아래 끝은 흐리게
          const a = (.4 + .45 * (.5 + .5 * Math.sin(t * 1.7 + m.ph * 3))) * fadeEdge * (1 + flash * 1.5);
          ctx.fillStyle = `rgba(255, 252, 240, ${Math.min(.95, a)})`;
          ctx.fillRect(Math.round(win.x + x), Math.round(top + y), m.big ? 2 : 1, m.big ? 2 : 1);
        }
      }
    },
    /* 지금 번개 밝기(0~1): 어두운 구석이 번개 때 잠깐 보이게 world.js가 쓴다 */
    get flash() { return reduce ? 0 : flash; },
    /* 느린 기기로 판단해 효과를 줄였는지 */
    get lowQuality() { return lowQuality; },
    setLowQuality(on) { lowQuality = !!on; slowFor = 0; },   // world.js 의 가벼운 화면과 함께 켜고 끈다
    /* 지금 비 세기(0.45~1) */
    get intensity() { return intensity(performance.now() / 1000); },
    /* 장면 연출·확인용: 지금 번개 치기 */
    flashNow() { if (!reduce) { flashT = 0; if (GD.sound) GD.sound.thunder(); lightningHint(); } },
    /* 가구·인물 다음, 어둠 전에 호출: 번개 칠 때 방 전체가 아주 살짝 밝아진다 */
    roomFlash(ctx, w, h) {
      if (reduce || flash <= 0) return;
      ctx.fillStyle = `rgba(200, 228, 255, ${flash * .07})`;
      ctx.fillRect(0, 0, w, h);
    },
  };
})(window);
