// 포탄·바람의 표현만 담당한다. 위치·속도·명중 판정은 engine.js 값을 그대로 사용한다.
export const weaponSize = (g, small) => small ? Math.max(5, g.M * 0.42) : Math.max(10, g.M * 0.6);

export function recoilFor(player, shots, reduced) {
  if (reduced) return 0;
  for (const s of shots || []) {
    const age = s.age || 0, speed = Math.hypot(s.vx, s.vy) || 1;
    if (s.k !== 'c' || age < 0 || age >= 0.14) continue;
    const x = s.x - s.vx * age - s.vx / speed * 2;
    const y = s.y - s.vy * age - s.vy / speed * 2;
    if (Math.hypot(player.x - x, player.y - y) < 3.5) return Math.sin(age / 0.14 * Math.PI) * 0.13 * (s.p || 1);
  }
  return 0;
}

export function drawShot(ctx, g, w, s, small, T, reduced) {
  const age = Math.max(0, s.age || 0), power = Math.max(0.3, Math.min(1, s.p || 1));
  const speed = Math.hypot(s.vx, s.vy) || 1, travel = age * speed * g.P / 100;
  ctx.save();
  ctx.translate(g.tx(s.x), g.ty(s.y));
  ctx.rotate(Math.atan2(-s.vy, s.vx));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (s.k === 'c') {
    const r = (small ? 2.6 : Math.max(4, w * 0.009)) * (0.8 + 0.35 * power);
    if (!reduced) {
      const tail = Math.min(travel, r * (3.2 + power));
      if (tail > r) {
        const smoke = ctx.createLinearGradient(-tail, 0, -r * 0.4, 0);
        smoke.addColorStop(0, '#7b8b9e00'); smoke.addColorStop(1, '#64778b48');
        ctx.fillStyle = smoke;
        ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.45);
        ctx.quadraticCurveTo(-tail * 0.65, -r * 0.55, -tail, 0);
        ctx.quadraticCurveTo(-tail * 0.65, r * 0.55, -r * 0.6, r * 0.45); ctx.fill();
      }
      // 포구 섬광은 실제 발사 원점에서 계산하며 포탄을 따라가지 않는다.
      if (!small && age < 0.09) {
        const muzzle = weaponSize(g, small) * 1.93 - g.P * 0.02 - travel;
        const flash = ctx.createRadialGradient(muzzle, 0, 0, muzzle, 0, r * 2);
        flash.addColorStop(0, '#fff4c9'); flash.addColorStop(0.35, '#ffbf59b0'); flash.addColorStop(1, '#f08a2400');
        ctx.fillStyle = flash; ctx.globalAlpha = (1 - age / 0.09) * 0.8;
        ctx.beginPath(); ctx.ellipse(muzzle, 0, r * 2, r * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    const metal = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 1.1);
    metal.addColorStop(0, '#aab8ca'); metal.addColorStop(0.35, '#52647d'); metal.addColorStop(0.75, '#24344c'); metal.addColorStop(1, '#101a2b');
    ctx.fillStyle = metal; ctx.strokeStyle = '#14213d'; ctx.lineWidth = small ? 0.8 : 1.2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f4ba67'; ctx.lineWidth = small ? 0.7 : 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, -0.7, 0.7); ctx.stroke();
    ctx.fillStyle = '#edf3ffb8'; ctx.beginPath(); ctx.ellipse(-r * 0.28, -r * 0.35, r * 0.24, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
  } else {
    // 흐름은 진행 방향으로 퍼진다. 시간에 따라 부드럽게 휘며 무작위로 떨리지 않는다.
    const spread = (small ? 3.2 : Math.max(5, w * 0.012)) * (0.7 + power * 0.4) * (1 + Math.min(age, 0.8) * 0.65);
    const length = Math.min(travel + spread, (small ? 17 : 42) * (0.7 + power * 0.3) * (1 + Math.min(age, 0.8) * 0.35));
    const fade = 0.8 * Math.max(0, 1 - age / 1.15) ** 1.2;
    const wind = ctx.createLinearGradient(-length, 0, spread * 0.4, 0);
    wind.addColorStop(0, '#22a6c700'); wind.addColorStop(0.4, '#8cd8e3'); wind.addColorStop(1, T.wind);
    ctx.strokeStyle = wind; ctx.lineWidth = small ? 1.1 : 1.7;
    const count = small || reduced ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const band = i - (count - 1) / 2, y = band * spread * 0.55;
      const sway = reduced ? 0 : Math.sin(age * 6 + i * 1.4) * spread * 0.13;
      const tip = -Math.abs(band) * spread * 0.3;
      ctx.globalAlpha = fade * (1 - Math.abs(band) * 0.12);
      ctx.beginPath(); ctx.moveTo(-length + Math.abs(band) * spread * 0.35, y * 0.7);
      ctx.bezierCurveTo(-length * 0.65, y + sway, -length * 0.2, y - sway, tip, y);
      if (!reduced && Math.abs(band) > 1) ctx.bezierCurveTo(spread * 0.45, y, spread * 0.4, y + Math.sign(band) * spread * 0.45, -spread * 0.15, y + Math.sign(band) * spread * 0.35);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawImpact(ctx, g, f, small, T, reduced) {
  const t = Math.max(0, Math.min(1, (f.age || 0) / 0.45)), fade = (1 - t) ** 2, ease = 1 - (1 - t) ** 2;
  const base = small ? 3 : 7;
  ctx.save(); ctx.translate(g.tx(f.x), g.ty(f.y)); ctx.globalAlpha = fade;
  ctx.lineCap = 'round'; ctx.lineWidth = small ? 1 : 1.8;
  if (f.k === 'b') {
    ctx.strokeStyle = T.axis;
    ctx.beginPath(); ctx.moveTo(-base, -base); ctx.lineTo(base, base); ctx.moveTo(base, -base); ctx.lineTo(-base, base); ctx.stroke();
  } else if (reduced) {
    ctx.strokeStyle = f.k === 'w' ? T.wind : T.shell;
    ctx.beginPath(); ctx.arc(0, 0, base, 0, Math.PI * 2); ctx.stroke();
  } else if (f.k === 'w') {
    // 바람이 민 점을 같은 높이에서 좌우로 이동시켜 역할을 보여 준다.
    if (!small && Number.isFinite(f.dx)) {
      const dx = f.dx * g.P / 100;
      ctx.strokeStyle = T.wind; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx * ease, 0); ctx.stroke();
      ctx.fillStyle = '#fffdf3'; ctx.strokeStyle = T.wind;
      ctx.beginPath(); ctx.arc(dx * ease, 0, base * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // 진행 방향을 따라 부드럽게 흩어지는 바람.
    ctx.rotate(Math.atan2(-(f.vy || 0), f.vx || 1));
    ctx.strokeStyle = T.wind;
    for (const side of [-1, 1]) {
      const r = base * (0.6 + ease * 2.2);
      ctx.beginPath(); ctx.moveTo(-base * (0.5 + ease), side * base * 0.2);
      ctx.bezierCurveTo(r * 0.6, side * base, r * 0.8, side * r, -r * 0.2, side * r); ctx.stroke();
    }
  } else {
    const r = base * (0.4 + ease * (f.k === 'm' ? 3 : 2));
    if (!small) {
      ctx.fillStyle = '#8190a1'; ctx.globalAlpha = fade * 0.17;
      for (let i = 0; i < 3; i++) {
        const angle = (f.seed || 0) + i * 2.1;
        ctx.beginPath(); ctx.arc(Math.cos(angle) * r * 0.65, Math.sin(angle) * r * 0.65, base * (0.3 + ease * 0.65), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = fade; ctx.strokeStyle = T.shell;
    for (let i = 0; i < (small ? 3 : 5); i++) {
      const angle = (f.seed || 0) + i * Math.PI * 2 / (small ? 3 : 5);
      const inner = r * 0.65, outer = r + base * 0.5 * (1 - t);
      ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner); ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer); ctx.stroke();
    }
  }
  ctx.restore();
}
