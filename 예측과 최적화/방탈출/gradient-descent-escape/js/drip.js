/* 비 새는 천장: 맵 데이터의 drip: [x, y](바닥 픽셀 좌표)에 작은 물웅덩이를 그리고,
 * 3~7초마다 물방울이 떨어져 동그란 물결이 퍼진다. 소리를 켰으면 "똑".
 * 바닥 무늬처럼 양탄자 위·가구 아래 높이에서 그린다. '움직임 줄이기'면 웅덩이만 그린다. */
(function (root) {
  'use strict';
  const GD = root.GD;
  const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let next = 2, fallAt = -1, rings = [], mapId = null;

  function draw(ctx, map, id) {
    if (!map || !map.drip) return;
    const [x, y] = map.drip, now = performance.now() / 1000;
    if (id !== mapId) { mapId = id; rings = []; fallAt = -1; next = now + 1.5; }
    // 물웅덩이: 어둡고 살짝 비치는 타원 + 윗가장자리 반짝임
    ctx.fillStyle = 'rgba(20, 34, 40, .32)';
    ctx.beginPath(); ctx.ellipse(x, y, 30, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(150, 200, 215, .22)';
    ctx.beginPath(); ctx.ellipse(x - 6, y - 3, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (reduce) return;
    if (now > next && fallAt < 0) { fallAt = now; next = now + 3 + Math.random() * 4; }
    if (fallAt >= 0) {   // 떨어지는 물방울(위에서 0.35초)
      const k = (now - fallAt) / .35;
      if (k >= 1) { fallAt = -1; rings.push(now); if (GD.sound && GD.sound.drip) GD.sound.drip(); }
      else { ctx.fillStyle = 'rgba(200, 236, 248, .8)'; ctx.fillRect(Math.round(x), Math.round(y - 150 * (1 - k * k)), 2, 4); }
    }
    rings = rings.filter((t) => now - t < 1.1);
    for (const t of rings) {   // 물결 두 겹이 퍼지며 사라짐
      const k = (now - t) / 1.1;
      for (const off of [0, .25]) {
        const q = k - off;
        if (q <= 0) continue;
        ctx.strokeStyle = `rgba(190, 228, 240, ${(.55 * (1 - q)).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y, 4 + q * 24, 1.5 + q * 8, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  GD.drip = { draw };
})(window);
