/* 움직일 이유가 있는 실내 물건만 아주 작게 움직인다.
 * world.js의 render 순서 안에서 호출되므로 별도 타이머나 캔버스는 만들지 않는다. */
(function (root) {
  'use strict';
  const GD = root.GD = root.GD || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const DEG = Math.PI / 180;

  const easedSine = (time, seconds, phase = 0) => Math.sin(time * Math.PI * 2 / seconds + phase);
  const still = () => reduce.matches;
  const finishedBalance = () => GD.state && GD.state.flag('balanceDone');

  // 가로대의 중심축은 별도 받침 그림의 꼭대기에 맞춘다.
  function balanceAngle(time) {
    if (still() || finishedBalance()) return 0;
    // 흔들림은 알아볼 수 있지만 읽기나 클릭을 방해하지 않을 1.35도 안쪽으로 제한한다.
    return easedSine(time, 5.8, .4) * 1.35 * DEG;
  }
  function drawBalanceBeam(ctx, o, path, time, drawImage) {
    const angle = balanceAngle(time), pivotX = o.x + o.w / 2, pivotY = o.y + o.h * .49;
    ctx.save();
    ctx.translate(pivotX, pivotY); ctx.rotate(angle);
    drawImage(path, -o.w / 2, -o.h * .49, o.w, o.h, o.tint);
    ctx.restore();
  }
  function drawBalancePan(ctx, o, path, time, drawImage, side) {
    const angle = balanceAngle(time);
    // 접시의 연결점은 가로대 끝과 같이 위아래로 가고, 접시는 중력 방향을 향하도록 반대 각도로 보정한다.
    const vertical = (side === 'L' ? -1 : 1) * Math.sin(angle) * 66;
    const anchorX = o.x + o.w / 2, anchorY = o.y + 3 + vertical;
    ctx.save();
    ctx.translate(anchorX, anchorY); ctx.rotate(-angle * .78);
    drawImage(path, -o.w / 2, -3, o.w, o.h, o.tint);
    ctx.restore();
  }

  function drawFern(ctx, o, path, time, drawImage) {
    if (still()) { drawImage(path, o.x, o.y, o.w, o.h, o.tint); return; }
    const stemY = o.y + o.h * .67;
    const sway = easedSine(time, 4.7, o.x * .018) * 1.05 * DEG;
    // 잎 부분만 흔들고 화분은 바닥에 붙어 있도록 두 번 나눠 그린다.
    ctx.save();
    ctx.beginPath(); ctx.rect(o.x - 3, o.y - 3, o.w + 6, o.h * .71); ctx.clip();
    ctx.translate(o.x + o.w / 2, stemY); ctx.rotate(sway); ctx.translate(-(o.x + o.w / 2), -stemY);
    drawImage(path, o.x, o.y, o.w, o.h, o.tint);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(o.x - 2, o.y + o.h * .59, o.w + 4, o.h * .43); ctx.clip();
    drawImage(path, o.x, o.y, o.w, o.h, o.tint);
    ctx.restore();
  }

  function springStretch(time) {
    // 용수철이 늘어난 길이를 재는 장치라 수치가 흔들려 보이지 않게 0.6px 이하로만 둔다.
    return still() || (GD.state && GD.state.flag('dataB')) ? 0 : easedSine(time, 3.9, .8) * .55;
  }
  function drawSpringCoil(ctx, o, path, time, drawImage) {
    const stretch = springStretch(time);
    if (!stretch) { drawImage(path, o.x, o.y, o.w, o.h, o.tint); return; }
    drawImage(path, o.x, o.y, o.w, o.h + stretch, o.tint);
  }
  function drawSpringHook(ctx, o, path, time, drawImage) {
    drawImage(path, o.x, o.y + springStretch(time), o.w, o.h, o.tint);
  }

  function draw(ctx, o, path, time, drawImage) {
    if (!o || !path) return false;
    if (o.id === 'balanceBeam') { drawBalanceBeam(ctx, o, path, time, drawImage); return true; }
    if (o.id === 'balancePanL') { drawBalancePan(ctx, o, path, time, drawImage, 'L'); return true; }
    if (o.id === 'balancePanR') { drawBalancePan(ctx, o, path, time, drawImage, 'R'); return true; }
    if (o.id === 'hallFern' || o.id === 'measureFern' || o.id === 'workFern') { drawFern(ctx, o, path, time, drawImage); return true; }
    if (o.id === 'springCoil') { drawSpringCoil(ctx, o, path, time, drawImage); return true; }
    if (o.id === 'springHook') { drawSpringHook(ctx, o, path, time, drawImage); return true; }
    return false;
  }

  function drawLantern(ctx, x, y, dir, time, drawImage) {
    const offset = dir === 'left' ? -23 : 23;
    const swing = still() ? 0 : easedSine(time, 3.7) * .035;
    const lx = x + offset, ly = y - 43;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(swing);
    drawImage('furniture/lamp-lit.png', -8, 0, 16, 27);
    // 유리 안의 심지만 프레임 교체. 별도 효과용 RAF를 만들지 않는다.
    const flame = GD.assets.img('animations/lamp-flame.png');
    if (flame.complete && flame.naturalWidth) {
      const frame = still() ? 0 : Math.floor(time * 9) % 8;
      ctx.drawImage(flame, frame * 128, 0, 128, 128, -6, 9, 12, 12);
    }
    ctx.restore();
  }

  GD.ambientMotion = { draw, balanceAngle, springStretch, drawLantern };
})(window);
