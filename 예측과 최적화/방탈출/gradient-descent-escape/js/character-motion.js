/* 생성된 4방향 동작 시트 + 발을 고정한 호흡. 걷기/충돌은 기존 world가 맡는다. */
(function (root) {
  'use strict';
  const GD = root.GD, TAU = Math.PI * 2, rows = { down: 0, left: 1, right: 2, up: 3 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // 몸을 변형한 뒤 게임 화면에는 한 번만 그린다. 확대된 화면에 띠를 직접 그리면
  // 띠마다 다시 샘플링되면서 픽셀 경계가 어긋나 가로 이음선이 생긴다.
  const poseCanvas = document.createElement('canvas');
  poseCanvas.width = poseCanvas.height = 128;
  const poseCtx = poseCanvas.getContext('2d');
  poseCtx.imageSmoothingEnabled = false;
  const walkCanvas = document.createElement('canvas');
  walkCanvas.width = walkCanvas.height = 128;
  const walkCtx = walkCanvas.getContext('2d');
  walkCtx.imageSmoothingEnabled = false;
  let activeAt = 0, initialized = false, lastX = null, lastY = null, lastDir = null;
  let pendingCue = null, playingCue = null;
  const modes = [
    { id: 'idle', label: '숨쉬며 대기', duration: 3.4 },
    { id: 'walk', label: '걷기', duration: .68 },
    { id: 'scratch', label: '머리 긁기', duration: 2.8 },
    { id: 'look', label: '주위 둘러보기', duration: 2.5 },
    { id: 'satchel', label: '가방 끈 고쳐 잡기', duration: 2.3 },
    { id: 'stretch', label: '기지개 켜기', duration: 3.2 },
    { id: 'inspect', label: '몸을 숙여 살펴보기', duration: 1.6 },
    { id: 'surprise', label: '깜짝 놀라기', duration: 1.1 },
    { id: 'discovery', label: '발견하고 기뻐하기', duration: 1.5 },
  ];
  const sheets = { sage: 'animations/explorer-walk.png', blue: 'animations/explorer-walk-blue.png', red: 'animations/explorer-walk-red.png', yellow: 'animations/explorer-walk-yellow.png' };
  const clips = {
    // 2026-11-10: 초당 약 3장이라 느리고 끊겨 보여 재생 시간을 약 35% 줄임(초당 4.5~5장)
    scratch: { atlas: 'gestures', frames: [0, 2, 3, 4, 3, 4, 3, 5, 0], duration: 1.8 },
    look: { atlas: 'gestures', frames: [0, 2, 6, 6, 5, 0], duration: 1.6 },
    satchel: { atlas: 'gestures', frames: [0, 2, 7, 7, 5, 0], duration: 1.5 },
    stretch: { atlas: 'actions', frames: [0, 1, 2, 2, 1, 3, 0], duration: 2.1 },
    inspect: { atlas: 'actions', frames: [0, 4, 5, 4, 0], duration: 1.05 },
    surprise: { atlas: 'actions', frames: [0, 6, 6, 0], duration: .75 },
    discovery: { atlas: 'actions', frames: [0, 7, 7, 0], duration: 1 },
  };
  const schedule = [{ at: 3.4, mode: 'scratch' }, { at: 10, mode: 'look' }, { at: 17, mode: 'satchel' }, { at: 24, mode: 'stretch' }];
  function atlasPath(kind, avatar = 'sage') {
    return `animations/explorer-${kind}${sheets[avatar] && avatar !== 'sage' ? '-' + avatar : ''}.png`;
  }
  function equipmentFor(state = GD.state) {
    if (!state || !state.has('lamp')) return 'none';
    return state.flag('lampLit') ? 'lit' : 'unlit';
  }
  function equipmentPath(kind, avatar = 'sage', equipment = 'lit') {
    return `animations/lantern-v1/explorer-${kind}-${equipment}${sheets[avatar] && avatar !== 'sage' ? '-' + avatar : ''}.png`;
  }
  function preload() {
    const carried = ['lit', 'unlit'].flatMap(equipment => Object.keys(sheets).flatMap(color => ['gestures', 'walk', 'actions'].map(kind => equipmentPath(kind, color, equipment))));
    return [...Object.values(sheets), ...Object.keys(sheets).flatMap(color => ['gestures', 'actions'].map(kind => atlasPath(kind, color))), ...carried, 'animations/cog-life.png', 'animations/lamp-flame.png', 'furniture/lamp-lit.png'];
  }
  // 한 가지 탐험복 색에 필요한 그림만(2026-11-12: 네 색을 모두 미리 받으면 16 MB → 고른 색만 약 4 MB, 나머지는 바꿀 때)
  function preloadFor(avatar = 'sage') {
    const color = sheets[avatar] ? avatar : 'sage';
    const carried = ['lit', 'unlit'].flatMap(equipment => ['gestures', 'walk', 'actions'].map(kind => equipmentPath(kind, color, equipment)));
    return [sheets[color], ...['gestures', 'actions'].map(kind => atlasPath(kind, color)), ...carried, 'animations/cog-life.png', 'animations/lamp-flame.png', 'furniture/lamp-lit.png'];
  }
  function walkFrame(progress, step) {
    // 양발 한 주기를 두 칸에 걸쳐 재생한다. 0·7열은 대기 연결용이며 보행 중에는 1~6열을 쓴다.
    const cycle = ((step % 2) + Math.max(0, Math.min(.9999, progress))) / 2;
    return [1, 2, 3, 4, 5, 6][Math.floor(cycle * 6)];
  }
  function reset() { initialized = false; pendingCue = playingCue = null; }
  function cue(time, mode = 'inspect') {
    if (typeof time === 'string') mode = time;
    if (clips[mode]) pendingCue = mode;
  }
  function state(player, time, busy = false) {
    if (!initialized || player.moving || player.x !== lastX || player.y !== lastY || player.dir !== lastDir || busy) { activeAt = time; initialized = true; }
    lastX = player.x; lastY = player.y; lastDir = player.dir;
    if (player.moving) { playingCue = pendingCue = null; return 'walk'; }
    if (reduced.matches) { playingCue = pendingCue = null; activeAt = time; return 'idle'; }
    if (busy) { playingCue = null; return 'idle'; }
    if (pendingCue) { playingCue = { mode: pendingCue, at: time }; pendingCue = null; }
    if (playingCue) {
      if (time - playingCue.at < clips[playingCue.mode].duration) return playingCue.mode;
      playingCue = null; activeAt = time;
    }
    const cycle = (time - activeAt) % 32;
    const gesture = schedule.find(item => cycle >= item.at && cycle < item.at + clips[item.mode].duration);
    return gesture ? gesture.mode : 'idle';
  }
  function deformation(mode, time, phase, dir, step, reduce, age = time) {
    if (reduce) return { lift: 0, sway: 0, lean: 0, chest: 0 };
    const breath = (1 - Math.cos(time * TAU / 3.4)) / 2;
    const facing = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    if (mode === 'walk') {
      return { lift: Math.sin(Math.PI * phase) * .85, sway: Math.sin(Math.PI * phase) * (step % 2 ? -.65 : .65), lean: facing * .45, chest: breath * .004 };
    }
    return { lift: breath * 1.15, sway: Math.sin(time * TAU / 6.8) * .22, lean: 0, chest: breath * .022 };
  }
  function draw(ctx, image, options) {
    const { x, y, dir = 'down', frame = 0, time = 0, mode = 'idle', phase = 0, step = 0, age = time, avatar = 'sage', equipment = 'none', reduce = reduced.matches, k = 1 } = options;
    const pose = deformation(mode, time, phase, dir, step, reduce, age);
    const carrying = equipment === 'lit' || equipment === 'unlit';
    let source = image, column = frame, kind = 'walk';
    if (carrying && mode === 'walk') {
      const walking = GD.assets.img(equipmentPath('walk', avatar, equipment));
      if (walking.complete && walking.naturalWidth) source = walking;
    }
    if (mode !== 'walk') {
      const clip = !reduce && clips[mode];
      kind = clip ? clip.atlas : 'gestures';
      const atlas = GD.assets.img(carrying ? equipmentPath(kind, avatar, equipment) : atlasPath(kind, avatar));
      if (atlas.complete && atlas.naturalWidth) {
        source = atlas;
        column = clip ? clip.frames[Math.min(clip.frames.length - 1, Math.floor(Math.max(0, age) / clip.duration * clip.frames.length))] : (!reduce && time % 4.7 > 4.48 ? 1 : 0);
      } else column = 0;
    }
    let sx = column * 128, sy = rows[dir] * 128, shift = 0;
    if (mode === 'walk') {
      // 2026-11-11: 등잔 걷기 시트는 칸마다 몸 전체가 좌우로 최대 8px 어긋나 있다.
      // 머리 중심을 서 있는 그림에 맞춘 칸별 보정(js/walk-align.js)으로 옮겨 그린다.
      const align = GD.walkAlign && GD.walkAlign[equipment];
      shift = align ? align[rows[dir] * 8 + column] || 0 : 0;
      const neutral = GD.assets.img(carrying ? equipmentPath('gestures', avatar, equipment) : atlasPath('gestures', avatar));
      walkCtx.clearRect(0, 0, 128, 128);
      if (neutral.complete && neutral.naturalWidth) {
        // 머리와 얼굴은 서 있을 때와 같은 부품을 쓰고, 팔·다리(보정해 옮긴 보행 프레임)만 바꾼다.
        walkCtx.drawImage(source, sx, sy + 52, 128, 76, shift, 52, 128, 76);
        walkCtx.drawImage(neutral, 0, sy, 128, 52, 0, 0, 128, 52);
      } else walkCtx.drawImage(source, sx, sy, 128, 128, shift, 0, 128, 128);
      source = walkCanvas; sx = sy = 0;
    }
    if (carrying && equipment === 'lit' && !reduce) {
      // 불꽃도 손에 든 등잔 유리 안에 그린다. 몸과 함께 한 장으로 합성해 위치가 어긋나지 않게 한다.
      const point = GD.lanternFrames && GD.lanternFrames[kind] && GD.lanternFrames[kind][rows[dir] * 8 + column];
      const fire = GD.assets.img('animations/lamp-flame.png');
      if (point && fire.complete && fire.naturalWidth) {
        if (source !== walkCanvas) {
          walkCtx.clearRect(0, 0, 128, 128);
          walkCtx.drawImage(source, sx, sy, 128, 128, 0, 0, 128, 128);
        }
        walkCtx.save(); walkCtx.globalAlpha = .36 + Math.sin(time * 8.7) * .10;
        walkCtx.drawImage(fire, Math.floor(time * 9) % 8 * 128, 0, 128, 128, point[0] + shift - 16, point[1] - 28, 32, 32);
        walkCtx.restore(); source = walkCanvas; sx = sy = 0;
      }
    }
    poseCtx.clearRect(0, 0, 128, 128);
    // 2026-11-11: 걷는 동안 한 장을 128→129px로 늘였다 줄이면 픽셀 줄이 하나씩 겹쳐 그려져
    // 크기가 칸마다 달라 보였다 → 걷기는 크기를 바꾸지 않고 정수 위치로만 옮긴다.
    // 대기 호흡은 세로 1px 늘림만 쓴다(가로 늘림은 얼굴 폭이 바뀌어 보임). 발 기준 (64,120) 고정.
    const height = mode === 'walk' ? 128 : 128 + Math.round(pose.lift * 128 / 110);
    const left = Math.round(pose.sway + pose.lean);
    const top = 120 - Math.round(120 * height / 128);
    poseCtx.drawImage(source, sx, sy, 128, 128, left, top, 128, height);
    // 화면 배율이 정수가 아니므로 기기 픽셀 격자에 맞춰 그린다. 소수 위치에서 최근접 샘플링하면
    // 걸음마다 빠지는 픽셀 줄이 바뀌어 몸이 커졌다 작아졌다 하는 것처럼 보인다.
    const m = ctx.getTransform ? ctx.getTransform() : null;
    if (m && m.a > 0 && m.d > 0) {
      // k: 게임 화면 크기 배율(2026-11-12 주인공 80%). 한 장을 한 번에 줄여 그린다(띠 이음선 없음)
      ctx.drawImage(poseCanvas, (Math.round(x * m.a + m.e) - m.e) / m.a, (Math.round(y * m.d + m.f) - m.f) / m.d, 128 * k, 128 * k);
    } else ctx.drawImage(poseCanvas, Math.round(x), Math.round(y), 128 * k, 128 * k);
    return mode;
  }
  function drawCog(ctx, fallback, x, y, time, near = false, k = 1) {
    const source = GD.assets.img('animations/cog-life.png');
    if (!source.complete || !source.naturalWidth) { ctx.drawImage(fallback, 0, 0, 128, 128, x, y, 128 * k, 128 * k); return; }
    // 2026-11-10: 대기 8장(눈을 천천히 감는 그림)을 4초에 돌려 졸리고 느려 보였다 →
    // 평소엔 눈 뜬 그림, 5.2초마다 0.22초 깜빡임, 이어서 짧게 두리번(4~7번 그림을 0.15초씩). 인사는 1.6초로 또렷하게.
    const still = reduced.matches, greeting = !still && near && time % 8 < 1.6, t = time % 5.2;
    let column = 0;
    if (greeting) column = Math.min(7, Math.floor(time % 8 / 1.6 * 8));
    else if (!still && t > 2.4 && t < 2.62) column = [1, 3, 3, 1][Math.min(3, Math.floor((t - 2.4) / .055))];
    else if (!still && t > 4 && t < 4.6) column = 4 + Math.min(3, Math.floor((t - 4) / .15));
    const tick = still ? 0 : Math.floor(time * 2.5) % 2;   // 태엽 인형처럼 1px 째깍 들썩임
    ctx.drawImage(source, column * 128, (greeting ? 1 : 0) * 128, 128, 128, x, y - tick, 128 * k, 128 * k);
  }
  GD.characterMotion = { modes, sheets, clips, atlasPath, equipmentFor, equipmentPath, preload, preloadFor, sheet: value => sheets[value] || sheets.sage, walkFrame, reset, cue, state, draw, drawCog, deformation };
})(window);
