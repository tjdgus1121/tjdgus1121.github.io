/* 먼지 쌓인 방(data.js 맵의 dusty: true, 지금은 창고)에서 한 칸 걸을 때마다 발밑에 먼지가 조금 일었다 가라앉는다.
 * 바닥 높이에서 그리므로(world.js가 맵·창문 비 다음, 가구·인물 앞에 호출) 캐릭터가 먼지를 밟고 선 것처럼 보인다.
 * '움직임 줄이기' 설정이면 끈다. */
(function (root) {
  'use strict';
  const GD = root.GD;
  const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = 64, LIFE = .6;
  let bits = [];

  function puff(map, tx, ty) {
    if (reduce || !map || !map.dusty) return;
    const now = performance.now() / 1000, cx = tx * T + 32, cy = ty * T + 56;
    for (let i = 0; i < 9; i++) {
      const side = Math.random() < .5 ? -1 : 1;   // 발 양옆으로 퍼짐(가운데는 다리에 가려지므로)
      const a = Math.PI * (1 + Math.random());
      const sp = 18 + Math.random() * 26;
      bits.push({ x: cx + side * (10 + Math.random() * 14), y: cy, vx: side * Math.abs(Math.cos(a)) * sp, vy: Math.sin(a) * sp * .45, born: now, big: Math.random() < .3 });
    }
    if (bits.length > 60) bits = bits.slice(-60);
  }

  function draw(ctx) {
    if (!bits.length) return;
    const now = performance.now() / 1000;
    bits = bits.filter((b) => now - b.born < LIFE);
    for (const b of bits) {
      const t = now - b.born, k = t / LIFE;
      const x = b.x + b.vx * t * (1 - k * .5), y = b.y + b.vy * t * (1 - k * .5) - k * 4;
      ctx.fillStyle = `rgba(214, 204, 182, ${(.8 * (1 - k * k)).toFixed(3)})`;
      const s = b.big ? 3 : 2;
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
    }
  }

  // 방을 옮기면 남은 먼지를 지운다
  function clear() { bits = []; }

  GD.footDust = { puff, draw, clear };
})(window);
