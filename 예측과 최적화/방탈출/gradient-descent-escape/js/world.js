/* 맵 엔진: 칸 단위 걷기 · 충돌 · 카메라 · 앞뒤 정렬 그리기 · 어둠 · 상호작용 찾기 · 눌러서 이동(BFS) */
(function (root) {
  'use strict';
  const GD = root.GD;
  // STEP: 한 칸 걷는 시간(ms). 2026-11-12 주인공을 80%로 줄인 뒤 170이 굼떠 보여 140으로
  const T = 64, STEP = 140;
  // 주인공 그림 배율(2026-11-12: 가구·칸에 비해 커 보여 80%로). 발끝(그림의 64,120)은 칸 아래쪽 같은 자리에 둔다
  const PK = .8;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const ROW = { down: 0, left: 1, right: 2, up: 3 };
  const img = (p) => GD.assets.img(p);

  let cv, ctx, dpr = 1, scale = 1, cam = { x: 0, y: 0 }, last = 0, time = 0;
  /* 가벼운 화면(2026-11-12): 느린 기기에서 화면 배율 1, 초당 30장, 장식 효과 줄임.
     설정에서 켜고 끌 수 있고(기기에 저장), '자동'이면 처음 몇 초 프레임 간격을 재서 느리면 스스로 켠다. */
  const LITE_KEY = 'gd-escape-lite';
  let liteMode = (() => { try { return localStorage.getItem(LITE_KEY) || 'auto'; } catch { return 'auto'; } })();   // 'auto' | 'on' | 'off'
  let lite = liteMode === 'on', frameAvg = 16.7, slowTime = 0, lastDraw = 0;
  function setLite(on) {
    if (lite === on) return;
    lite = on; resize();
    if (GD.windowRain && GD.windowRain.setLowQuality) GD.windowRain.setLowQuality(on);
    document.body.classList.toggle('lite', on);
  }
  function setLiteMode(mode) {
    liteMode = mode; try { localStorage.setItem(LITE_KEY, mode); } catch { /* 저장 불가 */ }
    slowTime = 0; setLite(mode === 'on');
  }
  let M = null, grid = null;
  const P = { tx: 8, ty: 12, x: 8, y: 12, dir: 'up', moving: false, t: 0, from: null, to: null, path: [], then: null, frame: 0 };
  const held = [];
  let fade = 0, fadeTo = null, lockCool = 0, target = null, promptEl;

  /* ---------- 맵 ---------- */
  const S = () => GD.state;
  function visible(o) {
    const st = S();
    if ((o.pickup || o.slip !== undefined) && st.picked[o.id]) return false;
    if (o.hideIf && o.hideIf(st)) return false;
    if (o.openFlag) {   // 문: 닫힌 모습을 본 뒤 열리면 0.7초 동안 열리는 모습을 보여 주고 사라진다
      if (!st.flag(o.openFlag)) { doorClosedSeen.add(o.id); return true; }
      if (!doorOpenAt.has(o.id)) {
        doorOpenAt.set(o.id, doorClosedSeen.has(o.id) ? time : -99);
        if (doorClosedSeen.has(o.id) && GD.sound) GD.sound.door();
      }
      return time - doorOpenAt.get(o.id) < .7;
    }
    return true;
  }
  const doorClosedSeen = new Set(), doorOpenAt = new Map();
  // 열리는 중인 두 짝 문: 왼쪽·오른쪽 문짝이 각자 경첩 쪽으로 접히며 어두워진다
  function drawOpeningDoor(o, p) {
    const im = img(p);
    if (!im.complete || !im.naturalWidth) return;
    const q = Math.min(1, (time - doorOpenAt.get(o.id)) / .7), e = 1 - Math.pow(1 - q, 3);
    const k = 1 - e * .88, hw = im.naturalWidth / 2, half = o.w / 2 * k;
    ctx.save(); ctx.globalAlpha = 1 - e * .7;
    ctx.drawImage(im, 0, 0, hw, im.naturalHeight, o.x, o.y, half, o.h);
    ctx.drawImage(im, hw, 0, hw, im.naturalHeight, o.x + o.w - half, o.y, half, o.h);
    ctx.restore();
  }
  function isDark(o) { return o.dark && !S().flag('lampLit'); }
  function objTiles(o) {
    if (o.npc) return [o.tx, o.ty, o.tx, o.ty];
    return [Math.floor(o.x / T), Math.floor(o.y / T), Math.floor((o.x + o.w - 1) / T), Math.floor((o.y + o.h - 1) / T)];
  }
  function footTiles(o) {
    if (o.npc) return [[o.tx, o.ty]];
    let x0, y0, x1, y1;
    if (o.foot) { [x0, y0] = o.foot; x1 = x0 + o.foot[2] - 1; y1 = y0 + o.foot[3] - 1; } else {
      const fy = o.y + o.h * .6;
      x0 = Math.floor((o.x + 12) / T); x1 = Math.floor((o.x + o.w - 12) / T);
      y0 = Math.floor((fy + 12) / T); y1 = Math.floor((o.y + o.h - 12) / T);
    }
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
    return out;
  }
  function buildGrid() {
    grid = Array.from({ length: M.h }, () => Array(M.w).fill(0));
    const [a, b, c, d] = M.walk;
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) grid[y][x] = 1;
    M.objs.forEach((o) => {
      if (o.wall || o.pickup || o.slip !== undefined || !visible(o)) return;
      footTiles(o).forEach(([x, y]) => { if (grid[y] && grid[y][x] !== undefined) grid[y][x] = 0; });
    });
  }
  const walkable = (x, y) => !!(grid[y] && grid[y][x]);
  function portalAt(x, y) { return (M.portals || []).find((p) => p.tiles.some(([a, b]) => a === x && b === y)); }

  function load(id, at, dir) {
    M = GD.MAPS[id];
    const st = S();
    st.data.map = id;
    if (at) { st.data.x = at[0]; st.data.y = at[1]; }
    if (dir) st.data.dir = dir;
    P.tx = P.x = st.data.x; P.ty = P.y = st.data.y; P.dir = st.data.dir;
    P.moving = false; P.path = []; P.then = null;
    GD.characterMotion.reset();
    buildGrid();
    // 가구 배치가 바뀐 뒤 예전 저장 위치가 가구 안에 있으면 가까운 바닥으로 옮긴다.
    if (!walkable(P.tx, P.ty)) {
      const free = [];
      grid.forEach((row, y) => row.forEach((v, x) => { if (v && !portalAt(x, y)) free.push([x, y]); }));
      free.sort((a, b) => Math.abs(a[0] - P.tx) + Math.abs(a[1] - P.ty) - Math.abs(b[0] - P.tx) - Math.abs(b[1] - P.ty));
      if (free[0]) { P.tx = P.x = st.data.x = free[0][0]; P.ty = P.y = st.data.y = free[0][1]; }
    }
    document.getElementById('roomName').textContent = M.name;
    showBanner(id);
    if (GD.footDust) GD.footDust.clear();
    if (GD.onEnterMap) GD.onEnterMap(id);
  }
  // 방에 들어설 때 방 이름을 화면 가운데 위에 잠깐 띄운다(같은 방 안 순간이동이면 생략)
  let bannerMap = null;
  const bannerSeen = {};
  function showBanner(id) {
    const el = document.getElementById('roomBanner');
    if (!el || id === bannerMap) return;
    bannerMap = id;
    el.querySelector('b').textContent = M.name;
    // 처음 가 보는 방은 길게, 다시 온 방은 짧게
    el.classList.toggle('again', !!bannerSeen[id]); bannerSeen[id] = true;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function go(id, at, dir) {
    if (GD.sound && GD.sound.pass) GD.sound.pass();
    fadeTo = { id, at, dir };
    fade = .001;
  }

  /* ---------- 움직임 ---------- */
  function face(dir) { P.dir = dir; S().data.dir = dir; }
  function tryStep(dir, fromKey) {
    face(dir);
    const [dx, dy] = DIRS[dir], nx = P.tx + dx, ny = P.ty + dy;
    const portal = portalAt(nx, ny);
    if (portal) {
      const st = S();
      if (!portal.to && portal.exit && st.flag(portal.exit) && GD.acts[portal.act]) {   // 열린 바깥문(정문): 마무리 장면
        if (time > lockCool) { lockCool = time + 1.2; held.length = 0; P.path = []; P.then = null; GD.acts[portal.act](portal); }
        return false;
      }
      if (!portal.to || (portal.need && !st.flag(portal.need))) {
        if (fromKey !== false && time > lockCool) { lockCool = time + 1.2; GD.ui.talk([{ who: 'narr', text: portal.lock }]); held.length = 0; }
        return false;
      }
      P.path = []; P.then = null;
      go(portal.to, portal.at, portal.dir);
      return true;
    }
    if (!walkable(nx, ny)) return false;
    P.moving = true; P.t = 0; P.from = [P.tx, P.ty]; P.to = [nx, ny];
    return true;
  }
  function update(dt) {
    if (fade > 0) {
      fade += dt / 260;
      if (fadeTo && fade >= 1) { const f = fadeTo; fadeTo = null; load(f.id, f.at, f.dir); }
      if (!fadeTo && fade >= 2) fade = 0;
      return;
    }
    if (P.moving) {
      P.t += dt;
      const p = Math.min(1, P.t / STEP);
      P.x = P.from[0] + (P.to[0] - P.from[0]) * p; P.y = P.from[1] + (P.to[1] - P.from[1]) * p;
      P.frame = GD.characterMotion.walkFrame(p, P.stepCount || 0);
      if (p >= 1) {
        P.moving = false; P.tx = P.to[0]; P.ty = P.to[1]; P.x = P.tx; P.y = P.ty;
        const st = S(); st.data.x = P.tx; st.data.y = P.ty;
        P.stepCount = (P.stepCount || 0) + 1;
        if (GD.sound) GD.sound.step();
        if (GD.footDust) GD.footDust.puff(M, P.tx, P.ty);
        if (P.stepCount % 6 === 0) st.save();
      } else return;
    }
    if (GD.ui.busy) { P.frame = 0; return; }
    if (P.path.length) {
      const [nx, ny] = P.path.shift();
      const dir = nx > P.tx ? 'right' : nx < P.tx ? 'left' : ny > P.ty ? 'down' : 'up';
      if (!tryStep(dir, false)) { P.path = []; P.then = null; }
      return;
    }
    if (P.then) { const f = P.then; P.then = null; f(); return; }
    // 누르고 있는 키, 없으면 걷는 도중 잠깐 눌렀다 뗀 키(queued)도 놓치지 않고 다음 칸에 쓴다
    const d = held[held.length - 1] || queued;
    queued = null;
    if (d) { tryStep(d); return; }
    P.frame = 0;
  }

  /* ---------- 상호작용 ---------- */
  function interactive(o) { return o.act || o.say || o.pickup || o.slip !== undefined || o.npc; }
  function reach(o, tx, ty) {
    if (o.approach) return o.approach.some(([x, y]) => x === tx && y === ty);
    const [x0, y0, x1, y1] = objTiles(o);
    const dx = Math.max(x0 - tx, 0, tx - x1), dy = Math.max(y0 - ty, 0, ty - y1);
    return dx <= 1 && dy <= (o.wall ? 2 : 1);
  }
  // 물건의 '바닥 기준점'(칸): 막는 칸(foot)이 있으면 그 가운데, 없으면 그림 아랫줄. 키 큰 그림의 가운데(허공)를 기준으로 하면
  // 옆에 서 있어도 위를 보거나, 선반 위 등잔보다 선반이 먼저 잡혔다.
  function anchor(o) {
    if (o.npc) return [o.tx, o.ty];
    const ft = footTiles(o);
    if (!o.wall && ft.length) return [ft.reduce((a, [x]) => a + x, 0) / ft.length, ft.reduce((a, [, y]) => a + y, 0) / ft.length];
    const [x0, , x1] = objTiles(o);   // 벽·탁자 위 물건: 그것이 놓인 바닥선(base, 없으면 그림 아래끝)의 칸
    return [(x0 + x1) / 2, Math.floor(((o.base > 0 ? o.base : o.y + o.h) - 1) / T)];
  }
  // (tx, ty)에 서서 dir 쪽을 볼 때 손이 닿는 물건들을 점수 순서로(앞이 F 대상)
  function targetsAt(tx, ty, dir) {
    const [fx, fy] = DIRS[dir], out = [];
    M.objs.forEach((o) => {
      if (!interactive(o) || !visible(o) || !reach(o, tx, ty)) return;
      const [cx, cy] = anchor(o);
      let vx = cx - tx, vy = cy - ty, d = Math.hypot(vx, vy);
      // 접근 칸이 정해진 물건(벽 높이 걸린 그림·칠판 등)은 그 칸에 서면 바로 앞 한 칸으로 친다.
      // 기준점이 벽 위쪽이라 늘 멀게 계산되어 바닥 가구에 밀리고 마우스로만 고를 수 있던 문제(2026-11-12)
      if (o.approach && d > 1) { vx /= d; vy /= d; d = 1; }
      const facing = (vx * fx + vy * fy) / (d || 1);
      const small = o.z > 0 || o.pickup || o.slip !== undefined;   // 가구 위에 놓인 물건·줍는 물건이 그 가구보다 먼저
      out.push({ o, sc: d - facing * 1.2 - (small ? .9 : 0) - (o.approach ? .3 : 0) });
    });
    return out.sort((a, b) => a.sc - b.sc).map((x) => x.o);
  }
  // 겹친 물건 고르기: Q(또는 Tab)로 같은 자리에서 닿는 다음 물건으로 넘긴다. 자리·방향이 바뀌면 처음부터
  let pick = { key: '', i: 0 };
  function findTarget() {
    const list = targetsAt(P.tx, P.ty, P.dir), key = `${S().data.map}:${P.tx},${P.ty},${P.dir}:${list.map((o) => o.id).join('|')}`;
    if (pick.key !== key) pick = { key, i: 0 };
    targetCount = list.length;
    return list.length ? list[pick.i % list.length] : null;
  }
  let targetCount = 0;
  // 안내 말풍선: 실제 폭을 재서 화면 밖으로 잘리지 않게(좁은 화면에서 '다른 물건'까지 붙으면 길어짐)
  let promptW = 0, promptPos = '';
  function setPromptText(t) {
    const span = promptEl.querySelector('span');
    if (span.textContent !== t) { span.textContent = t; promptW = 0; }
  }
  function placePrompt(ox, oy) {
    if (!promptW) promptW = promptEl.offsetWidth || 180;   // 글자가 바뀐 뒤 한 번만 잰다
    const half = promptW / 2 + 8;
    const pos = `${Math.round(Math.max(half, Math.min(innerWidth - half, (ox - cam.x) * scale)))},${Math.round(Math.max(120, (oy - cam.y) * scale - 6))}`;
    if (pos === promptPos) return;
    promptPos = pos;
    const [l, t] = pos.split(',');
    promptEl.style.left = l + 'px'; promptEl.style.top = t + 'px';
  }
  function showPrompt(on) { if (promptEl.hidden === on) promptEl.hidden = !on; }
  function setNextBtn(on) { const b = document.getElementById('btnNext'); if (b && b.hidden === on) b.hidden = !on; }
  function nextTarget() { if (targetCount > 1) pick.i++; }
  function label(o) {
    if (typeof o.label === 'function') { const t = o.label(S()); if (t) return t; }   // 상태에 따라 바뀌는 이름표(열린 문 → 이동하기)
    if (isDark(o)) return '어두운 구석 살펴보기';
    const verb = o.npc ? '말 걸기' : o.pickup || o.slip !== undefined ? '줍기' : '살펴보기';
    return `${o.name || ''} ${verb}`.trim();
  }
  function interact(o) {
    o = o || target;
    if (!o && doorTarget && !GD.ui.busy) { face(doorTarget.dir); tryStep(doorTarget.dir); return; }   // 문 앞 F
    if (!o || GD.ui.busy) return;
    // 물건이 놓인 칸 쪽을 바라보기
    const [ax, ay] = anchor(o);
    const cx = ax - P.tx, cy = ay - P.ty;
    face(Math.abs(cx) > Math.abs(cy) ? (cx > 0 ? 'right' : 'left') : (cy > 0 ? 'down' : 'up'));
    GD.characterMotion.cue(time);
    GD.acts.dispatch(o);
  }

  /* ---------- 눌러서 이동 ---------- */
  function bfs(goalFn) {
    const key = (x, y) => y * M.w + x, prev = new Map([[key(P.tx, P.ty), null]]);
    const q = [[P.tx, P.ty]];
    while (q.length) {
      const [x, y] = q.shift();
      if (goalFn(x, y)) {
        const path = []; let k = key(x, y);
        while (prev.get(k) !== null) { path.unshift([k % M.w, Math.floor(k / M.w)]); k = prev.get(k); }
        return path;
      }
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (!prev.has(k) && walkable(nx, ny)) { prev.set(k, key(x, y)); q.push([nx, ny]); }
      }
    }
    return null;
  }
  // 마우스를 물건 위에 올리면 손가락 커서 + 작은 이름표(누를 수 있는 것을 알려 줌). 판정은 clickAt과 같다
  function hoverAt(sx, sy) {
    const tip = document.getElementById('hoverTip');
    if (!tip || !M) return;
    let o = null;
    if (!GD.ui.busy && fade === 0) {
      const wx = sx / scale + cam.x, wy = sy / scale + cam.y;
      const hits = M.objs.filter((ob) => {
        if (!interactive(ob) || !visible(ob)) return false;
        if (ob.npc) return Math.abs(wx - (ob.tx * T + 32)) < 48 && wy > ob.ty * T - 70 && wy < ob.ty * T + 64;
        const px = Math.max(0, (28 / scale - ob.w) / 2), py = Math.max(0, (28 / scale - ob.h) / 2);
        return wx >= ob.x - px && wx <= ob.x + ob.w + px && wy >= ob.y - py && wy <= ob.y + ob.h + py;
      });
      hits.sort((a, b) => (a.w || 64) * (a.h || 64) - (b.w || 64) * (b.h || 64));
      o = hits[0] || null;
    }
    cv.style.cursor = o ? 'pointer' : '';
    if (!o) { tip.hidden = true; return; }
    tip.textContent = label(o);
    tip.style.left = `${sx + 14}px`; tip.style.top = `${sy + 18}px`;
    tip.hidden = false;
  }
  function clickAt(sx, sy) {
    if (GD.ui.busy || fade > 0) return;
    const wx = sx / scale + cam.x, wy = sy / scale + cam.y;
    // 물건을 눌렀는가(작은 물건 우선)
    const minHit = matchMedia('(pointer: coarse)').matches ? 44 : 28;
    const hits = M.objs.filter((o) => {
      if (!interactive(o) || !visible(o)) return false;
      if (o.npc) return Math.abs(wx - (o.tx * T + 32)) < 48 && wy > o.ty * T - 70 && wy < o.ty * T + 64;
      // 그림을 작게 그려도 종이·추를 누를 영역은 충분히 남긴다.
      const px = Math.max(0, (minHit / scale - o.w) / 2), py = Math.max(0, (minHit / scale - o.h) / 2);
      return wx >= o.x - px && wx <= o.x + o.w + px && wy >= o.y - py && wy <= o.y + o.h + py;
    });
    hits.sort((a, b) => (a.w || 64) * (a.h || 64) - (b.w || 64) * (b.h || 64));
    const o = hits[0];
    if (o) {
      if (reach(o, P.tx, P.ty)) { interact(o); return; }
      const path = bfs((x, y) => reach(o, x, y));
      if (path) { P.path = path; P.then = () => { if (visible(o) && reach(o, P.tx, P.ty)) interact(o); }; }
      else GD.ui.toast('지금은 다가갈 수 없다. 다른 쪽에서 살펴보자.');
      return;
    }
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    const portal = portalAt(tx, ty);
    if (portal) {
      const path = bfs((x, y) => Math.abs(x - tx) + Math.abs(y - ty) === 1);
      if (path) {
        P.path = path;
        P.then = () => { const dir = tx > P.tx ? 'right' : tx < P.tx ? 'left' : ty > P.ty ? 'down' : 'up'; lockCool = 0; tryStep(dir); };
      }
      return;
    }
    if (walkable(tx, ty)) { const path = bfs((x, y) => x === tx && y === ty); if (path) { P.path = path; P.then = null; } }
  }

  /* ---------- 그리기 ---------- */
  function resize() {
    dpr = lite ? 1 : Math.min(1.5, root.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    scale = Math.max(.42, Math.min(1.2, innerHeight / (11.2 * T), innerWidth / (8.5 * T)));
  }
  // 칠한 가구: tint(캔버스 filter 문자열)를 입힌 사본을 한 번만 만들어 둔다. filter를 못 쓰는 브라우저는 원래 색.
  const tinted = new Map();
  function tintedImg(p, im, crop, tint) {
    const key = p + '|' + tint;
    if (tinted.has(key)) return tinted.get(key);
    const [sx, sy, sw, sh] = crop || [0, 0, im.naturalWidth, im.naturalHeight];
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    const g = c.getContext('2d');
    if ('filter' in g) g.filter = tint;
    g.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    tinted.set(key, c);
    return c;
  }
  /* 줄여 둔 그림(2026-11-12): 소품 원본이 그리는 크기보다 수십~수천 배 커서(예: 1516×980 노트를 40×20으로)
     매 프레임 큰 그림을 줄여 그리는 비용과 메모리가 저사양 기기에 부담이었고, 최근접 축소라 테두리도 지글거렸다.
     그림마다 한 번, 그리는 크기의 2배(화면 배율 1.2 × 기기 배율 1.5까지 덮음)로 반씩 부드럽게 줄여 둔다. */
  const shrunk = new Map();
  function shrunkImg(p, im, crop, tint, w, h) {
    const key = p + '|' + (tint || '');
    const [sx, sy, sw, sh] = crop || [0, 0, im.naturalWidth, im.naturalHeight];
    const tw = Math.max(1, Math.ceil(w * 2)), th = Math.max(1, Math.ceil(h * 2));
    if (sw * sh <= tw * th * 2 && !tint) return null;   // 원본이 이미 작으면 그대로 그린다
    const have = shrunk.get(key);
    if (have && have.width >= tw * .8 && have.height >= th * .8) return have;
    let src = im, cx = sx, cy = sy, cw = sw, ch = sh;
    while (cw > tw * 2 && ch > th * 2) {   // 반씩 줄이기: 한 번에 크게 줄일 때 생기는 거친 무늬를 막는다
      const half = document.createElement('canvas');
      half.width = Math.ceil(cw / 2); half.height = Math.ceil(ch / 2);
      const hg = half.getContext('2d'); hg.imageSmoothingQuality = 'high';
      hg.drawImage(src, cx, cy, cw, ch, 0, 0, half.width, half.height);
      src = half; cx = cy = 0; cw = half.width; ch = half.height;
    }
    const c = document.createElement('canvas');
    c.width = Math.min(cw, tw); c.height = Math.min(ch, th);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    if (tint && 'filter' in g) g.filter = tint;
    g.drawImage(src, cx, cy, cw, ch, 0, 0, c.width, c.height);
    shrunk.set(key, c);
    return c;
  }
  function drawImg(p, x, y, w, h, tint) {
    const im = img(p);
    if (!im.complete || !im.naturalWidth) return;
    const crop = im.small ? null : GD.assets.mapBounds[p];   // 작은 사본은 이미 그림 범위만 잘라 둠
    const small = shrunkImg(p, im, crop, tint, w, h);
    if (small) ctx.drawImage(small, x, y, w, h);
    else if (tint) ctx.drawImage(tintedImg(p, im, crop, tint), x, y, w, h);
    else if (crop) ctx.drawImage(im, ...crop, x, y, w, h);
    else ctx.drawImage(im, x, y, w, h);
  }
  function render() {
    const vw = innerWidth / scale, vh = innerHeight / scale;
    const mw = M.w * T, mh = M.h * T;
    const px = P.x * T + 32, py = P.y * T + 32;
    cam.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, px - vw / 2));
    cam.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, py - vh / 2));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1214'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -cam.x * dpr * scale, -cam.y * dpr * scale);
    ctx.imageSmoothingEnabled = false;
    drawImg(M.img, 0, 0, mw, mh);
    if (GD.windowRain) GD.windowRain.draw(ctx, S().data.map);   // 창문 유리의 움직이는 비
    const st = S(), list = [];
    M.objs.forEach((o) => {
      if (!visible(o)) return;
      if (o.npc) { list.push({ base: o.ty * T + 60, z: 0, draw: () => drawCog(o) }); return; }
      const p = o.imgOn && st.flag(o.on) ? o.imgOn : o.img;
      list.push({ base: o.base || (o.y + o.h), z: o.z || 0, draw: () => {
        if (o.openFlag && st.flag(o.openFlag)) drawOpeningDoor(o, p);
        else if (GD.ambientMotion && GD.ambientMotion.draw(ctx, o, p, time, drawImg)) {
          // 움직이는 부분과 고정된 부분을 ambientMotion에서 함께 그린다.
        } else if (o.rotation !== undefined) {
          const [ax, ay] = o.pivot || [.5, .5], ox = o.x + o.w * ax, oy = o.y + o.h * ay;
          ctx.save(); ctx.translate(ox, oy); ctx.rotate(o.rotation * Math.PI / 180);
          drawImg(p, -o.w * ax, -o.h * ay, o.w, o.h, o.tint); ctx.restore();
        } else drawImg(p, o.x, o.y, o.w, o.h, o.tint);
        if ((o.pickup || o.slip !== undefined) && !isDark(o)) sparkle(o.x + o.w / 2, o.y - 6, lite);
      } });
    });
    list.push({ base: P.y * T + 60, z: .5, draw: drawPlayer });
    if (GD.drip && M.drip) list.push({ base: -90, z: 0, draw: () => GD.drip.draw(ctx, M, S().data.map) });   // 비 새는 천장의 물웅덩이(바닥 높이)
    if (GD.footDust) list.push({ base: P.y * T + 60, z: .6, draw: () => GD.footDust.draw(ctx) });   // 발밑 먼지: 양탄자 위, 발 앞
    list.sort((a, b) => a.base - b.base || a.z - b.z).forEach((d) => d.draw());
    if (GD.windowRain) { GD.windowRain.dust(ctx, S().data.map); GD.windowRain.roomFlash(ctx, mw, mh); }   // 번개 칠 때 방이 살짝 밝아짐
    drawDark();
    // 맵 전환 어둠
    if (fade > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(5,8,10,${Math.min(1, fade < 1 ? fade : 2 - fade)})`;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
  }
  // 화면 가장자리 어둡게(비네트)는 index.html 의 #vignette(CSS)가 맡는다. 예전에는 매 프레임 화면 전체에
  // 그라데이션을 칠해 GPU 없는 기기에서 가장 비싼 작업 중 하나였다(2026-11-12).
  function drawPlayer() {
    const im = img(GD.characterMotion.sheet(S().data.avatar));
    if (!im.complete || !im.naturalWidth) return;
    const fx = P.x * T + 32, fy = P.y * T + 58;
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(fx, fy - 2, 26 * PK, 8 * PK, 0, 0, Math.PI * 2); ctx.fill();
    const nextMotion = GD.characterMotion.state(P, time, GD.ui.busy);
    if (P.motion !== nextMotion) P.motionSince = time;
    P.motion = nextMotion;
    GD.characterMotion.draw(ctx, im, { x: fx - 64 * PK, y: fy - 120 * PK, k: PK, dir: P.dir, frame: P.frame, time, age: time - P.motionSince, mode: P.motion, avatar: S().data.avatar, equipment: GD.characterMotion.equipmentFor(S()), phase: P.moving ? Math.min(1, P.t / STEP) : 0, step: P.stepCount || 0 });
  }
  function drawCog(o) {
    const im = img('sprites/cog-sheet.png');
    if (!im.complete || !im.naturalWidth) return;
    const fx = o.tx * T + 32, fy = o.ty * T + 58;
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(fx, fy - 2, 24 * PK, 7 * PK, 0, 0, Math.PI * 2); ctx.fill();
    // 코그도 주인공과 같은 비율로 줄여 둘의 키 차이를 그대로 둔다
    GD.characterMotion.drawCog(ctx, im, fx - 64 * PK, fy - 118 * PK, time, !GD.ui.busy && Math.hypot(P.x - o.tx, P.y - o.ty) < 4, PK);
    if (GD.state.flag('cogHint')) bubble(fx + 20 * PK, fy - 112 * PK, '?');
  }
  function sparkle(x, y, still = false) {
    const a = still ? .9 : .55 + .45 * Math.sin(time * 4 + x);
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.fillStyle = '#ffe69a';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 4 : 11, t = i * Math.PI / 4; ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function bubble(x, y, t) {
    ctx.save(); ctx.fillStyle = '#f6ecd6'; ctx.strokeStyle = '#4a2f20'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y + Math.sin(time * 3) * 3, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d4583e'; ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t, x, y + 8 + Math.sin(time * 3) * 3);
    ctx.restore();
  }
  /* 조명(2026-11-12): 예전에는 밝은 방 한가운데 어두운 구석만 까만 원으로 찍혀 어색했다.
     이제 방 전체에 밤빛(푸른 어둠)을 은은히 깔고, 어두운 구석은 벽 모양을 따라 가장자리가 퍼지는 그늘로,
     창문 아래 달빛·주인공 등잔이 그 어둠을 걷어 낸다. 화면의 1/4 해상도 빛 지도에 그린 뒤 부드럽게 키워 덮는다(가볍다). */
  const NIGHT = { hall: .2, storage: .3, measure: .2, workshop: .2, bedroom: .3, clockroom: .24, balcony: 0 };
  // 빛 지도는 게임 캔버스 위에 겹친 작은 캔버스(#light, 화면의 1/4 해상도). 키우기는 브라우저 합성이 맡는다(캔버스에 화면 전체를 칠하지 않음)
  let lm = null, lg = null, lmOn = false;
  function softRect(g, x, y, w, h, a, feather) {   // 가장자리가 퍼지는 사각 그늘(겹겹이 쌓아 가운데로 갈수록 진하게)
    const n = 6, each = 1 - Math.pow(1 - Math.min(.99, a), 1 / n);   // n 겹이 모두 겹친 가운데가 정확히 a
    for (let i = 0; i < n; i++) {
      const k = feather * (1 - i / (n - 1));
      g.fillStyle = `rgba(4,7,12,${each.toFixed(3)})`;
      g.beginPath(); g.roundRect ? g.roundRect(x - k, y - k, w + k * 2, h + k * 2, k + 8) : g.rect(x - k, y - k, w + k * 2, h + k * 2); g.fill();
    }
  }
  function hole(g, x, y, r, a) {   // 빛이 닿은 곳: 어둠을 걷어 낸다
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(.55, `rgba(0,0,0,${(a * .7).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function lanternFlicker() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.sin(time * 7.3) * .5 + Math.sin(time * 12.9 + 1.7) * .3 + Math.sin(time * 3.1) * .2;
  }
  function drawDark() {
    const st = S(), id = st.data.map, lit = st.flag('lampLit');
    const flash = GD.windowRain ? GD.windowRain.flash : 0;   // 번개가 치면 방이 잠깐 보인다
    let night = NIGHT[id] ?? .2;
    if (st.flag('plateIn')) night *= .35;   // 시계가 다시 돌고 새벽이 왔다
    const dark = M.dark || [];
    const fx = P.x * T + 32, fy = P.y * T + 58 - 48 * PK;   // 손에 든 등잔 높이
    const fl = lanternFlicker();
    if (!lm) { lm = document.getElementById('light'); lg = lm && lm.getContext('2d'); }
    if (lm && (night > 0 || dark.length)) {
      const vw = innerWidth / scale, vh = innerHeight / scale, k = .25 * scale;   // 월드 1px → 빛 지도 k px
      const w = Math.ceil(innerWidth * .25), h = Math.ceil(innerHeight * .25);
      if (lm.width !== w || lm.height !== h) { lm.width = w; lm.height = h; }
      if (!lmOn) { lm.hidden = false; lmOn = true; }
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, w, h);
      lg.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
      if (night > 0) { lg.fillStyle = `rgba(10,16,34,${(night * (1 - flash * .7)).toFixed(3)})`; lg.fillRect(cam.x, cam.y, vw, vh); }
      dark.forEach(([x, y, dw, dh]) => softRect(lg, x * T, y * T, dw * T, dh * T, (lit ? .45 : .92) * (1 - flash * .55), 72));
      lg.globalCompositeOperation = 'destination-out';
      ((GD.windowGlass && GD.windowGlass[id]) || []).forEach((win) => {   // 창문 아래 바닥의 달빛
        if (st.flag('plateIn') && id === 'clockroom') return;
        hole(lg, win.x + win.w / 2, win.y + win.h + 140, Math.min(260, win.w * 1.3), .75);
      });
      if (lit) hole(lg, fx, fy + 20, 230 + fl * 10, .95);   // 등잔이 비추는 둘레
      lg.globalCompositeOperation = 'source-over';
    } else if (lm && lmOn) { lm.hidden = true; lmOn = false; }
    if (lit) {
      // 등잔 불꽃이 일렁이듯 빛의 크기·밝기가 조금씩 흔들린다(따뜻한 빛을 더한다)
      const g = ctx.createRadialGradient(fx, fy, 10, fx, fy, 170 + fl * 8);
      g.addColorStop(0, `rgba(255,200,110,${(.22 + fl * .035).toFixed(3)})`); g.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(fx - 180, fy - 180, 360, 360); ctx.globalCompositeOperation = 'source-over';
    }
  }
  // 바로 옆 칸(바라보는 쪽 우선)에 있는 문(포탈)
  function portalNear() {
    const order = [P.dir, 'up', 'down', 'left', 'right'].filter((d, i, a) => a.indexOf(d) === i);
    for (const d of order) {
      const [dx, dy] = DIRS[d], p = portalAt(P.tx + dx, P.ty + dy);
      if (p) return { p, dir: d, tx: P.tx + dx, ty: P.ty + dy };
    }
    return null;
  }
  const portalOpen = (p) => (p.to && (!p.need || S().flag(p.need))) || (p.exit && S().flag(p.exit));
  function portalLabel(p) {
    if (!portalOpen(p)) return '문 살펴보기';
    if (!p.to) return '정문 밖으로 나가기';
    const n = (GD.MAPS[p.to] || {}).name || '다음 방';
    const last = n.charCodeAt(n.length - 1) - 0xAC00, josa = last >= 0 && last < 11172 && last % 28 && last % 28 !== 8 ? '으로' : '로';
    return `${n}${josa} 이동하기`;
  }
  let doorTarget = null;
  function updatePrompt() {
    if (GD.ui.busy) { const t = document.getElementById('hoverTip'); if (t && !t.hidden) { t.hidden = true; cv.style.cursor = ''; } }
    const idle = !GD.ui.busy && !P.moving && fade === 0;
    target = idle ? findTarget() : null;
    doorTarget = idle ? portalNear() : null;
    // 문 안내는 문을 바라볼 때만(방에 들어서자마자 등 뒤 문에 '이동하기'가 뜨지 않게, 2026-11-12).
    // 바라보는 쪽이 문이면 문이 먼저(문 옆 화분 등에 가려 '이동하기'가 안 뜨지 않게)
    if (doorTarget && doorTarget.dir !== P.dir) doorTarget = null;
    if (doorTarget) target = null;
    if (!target && doorTarget) {   // 문 앞: F로 이동(잠겼으면 이유를 들려줌)
      showPrompt(true);
      setPromptText(portalLabel(doorTarget.p));
      const more = promptEl.querySelector('.more'); if (more && !more.hidden) { more.hidden = true; promptW = 0; } setNextBtn(false);
      const ox = doorTarget.tx * T + 32, oy = Math.max(doorTarget.ty * T - 8, 30);
      placePrompt(ox, oy);
      return;
    }
    if (!target) { showPrompt(false); setNextBtn(false); return; }
    let ox, oy;
    if (target.npc) { ox = target.tx * T + 32; oy = target.ty * T + 58 - 128 * PK; } else { ox = target.x + target.w / 2; oy = Math.max(target.y, 30); }
    showPrompt(true);
    setPromptText(label(target));
    const more = promptEl.querySelector('.more');   // 같은 자리에서 닿는 물건이 여럿이면 Q(휴대폰은 '다른 물건' 버튼)로 고른다
    if (more) {
      if (more.hidden !== targetCount < 2) { more.hidden = targetCount < 2; promptW = 0; }
      const t = ` 다른 물건 ${pick.i % targetCount + 1}/${targetCount}`;
      if (targetCount > 1 && more.lastChild.textContent !== t) { more.lastChild.textContent = t; promptW = 0; }
    }
    setNextBtn(targetCount > 1);
    placePrompt(ox, oy);
  }
  function loop(ts) {
    requestAnimationFrame(loop);
    if (lite && ts - lastDraw < 31) return;   // 초당 30장(걷기는 시간 기준이라 속도는 같다)
    const gap = ts - (lastDraw || ts);
    lastDraw = ts;
    const dt = Math.min(60, ts - (last || ts));
    last = ts; time = ts / 1000;
    if (M) { update(dt); render(); updatePrompt(); }
    // 자동: 프레임 간격의 이동 평균이 21ms(초당 약 48장)보다 길게 3초 이어지면 가벼운 화면으로(들쭉날쭉한 40장보다 고른 30장이 낫다). 탭이 숨겨졌던 큰 간격은 무시
    if (liteMode === 'auto' && !lite && gap > 0 && gap < 250 && fade === 0) {
      frameAvg = frameAvg * .95 + gap * .05;
      slowTime = frameAvg > 21 ? slowTime + gap : Math.max(0, slowTime - gap);
      if (slowTime > 3000) setLite(true);
    }
  }

  /* ---------- 입력 ---------- */
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  let queued = null;
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  function press(d) {
    if (held.includes(d)) return;   // 꾹 누를 때의 자동 반복: 이미 걷는 중(떼었을 때 한 칸 더 가지 않게)
    held.push(d);
    queued = d;
    // 걷는 도중 반대 방향: 한 칸을 다 가지 않고 그 자리에서 바로 되돌아선다
    if (P.moving && P.from && P.to) {
      const cur = P.to[0] > P.from[0] ? 'right' : P.to[0] < P.from[0] ? 'left' : P.to[1] > P.from[1] ? 'down' : 'up';
      if (d === OPP[cur]) { const f = P.from; P.from = P.to; P.to = f; P.t = Math.max(0, STEP - P.t); face(d); queued = null; }
    } else if (!P.moving && !GD.ui.busy && fade === 0 && held.length === 1) {
      face(d);   // 서 있을 때는 누르는 순간 그쪽을 본다(다음 프레임을 기다리지 않음)
    }
  }
  function release(d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); }
  function clearInput() { held.length = 0; queued = null; P.path = []; P.then = null; }
  function init() {
    cv = document.getElementById('world'); ctx = cv.getContext('2d');
    promptEl = document.getElementById('prompt');
    resize(); addEventListener('resize', resize);
    if (lite) { document.body.classList.add('lite'); if (GD.windowRain && GD.windowRain.setLowQuality) GD.windowRain.setLowQuality(true); }
    addEventListener('keydown', (e) => {
      if (getComputedStyle(document.getElementById('title')).display !== 'none') return;
      if (GD.keyboard && GD.keyboard.handleKeydown(e)) return;
      const inScene = GD.ui.talking, inPop = GD.ui.popupOpen;
      if (e.key === 'Escape') { if (inPop) GD.ui.closePopup(); return; }
      if (inScene) {
        // 버튼·입력 요소의 Enter/Space는 브라우저 본래 활성화에 맡긴다.
        if (document.activeElement && document.activeElement.matches('button, input, select, textarea, [contenteditable="true"], svg[role="slider"]')) return;
        const onChoice = document.activeElement && document.activeElement.closest('.dlg-choices, .dlg-skip');
        if ([' ', 'Enter', 'f', 'F'].includes(e.key) && !onChoice) { e.preventDefault(); GD.ui.next(); }
        return;
      }
      if (inPop || !M) return;
      if (KEYS[e.key]) { e.preventDefault(); P.path = []; P.then = null; press(KEYS[e.key]); return; }
      if (['f', 'F', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); interact(); return; }
      if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); nextTarget(); return; }
      if (e.key === 'i' || e.key === 'I') GD.ui.bag();
      if (e.key === 'n' || e.key === 'N') GD.ui.notes();
      if ((e.key === 'm' || e.key === 'M') && S().has('plan')) GD.ui.plan();
      if ((e.key === 'v' || e.key === 'V') && GD.sound) GD.sound.setOn(!GD.sound.on);   // V: 소리 켜기/끄기
    });
    addEventListener('keyup', (e) => { if (KEYS[e.key]) release(KEYS[e.key]); });
    addEventListener('blur', clearInput);
    cv.addEventListener('pointerdown', (e) => { clickAt(e.clientX, e.clientY); });
    cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') hoverAt(e.clientX, e.clientY); });
    cv.addEventListener('pointerleave', () => { const t = document.getElementById('hoverTip'); if (t) t.hidden = true; cv.style.cursor = ''; });
    // 휴대폰 방향 버튼
    document.querySelectorAll('#touch .pad button').forEach((b) => {
      const d = b.dataset.dir;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); P.path = []; press(d); b.setPointerCapture(e.pointerId); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => release(d)));
    });
    document.getElementById('btnAct').addEventListener('click', () => interact());
    const btnNext = document.getElementById('btnNext');
    if (btnNext) btnNext.addEventListener('click', () => nextTarget());
    if (matchMedia('(pointer: coarse)').matches) document.getElementById('touch').hidden = false;
    requestAnimationFrame(loop);
  }

  GD.world = {
    init, load, go, rebuild: () => M && buildGrid(), interact,
    canWalk: walkable, canReach: reach, clearInput, targetsAt, nextTarget,
    get lite() { return lite; }, get liteMode() { return liteMode; }, setLiteMode,
    get target() { return target; },
    focus() { /* 키 입력은 window 에서 받으므로 캔버스 포커스는 필요 없음 */ },
    get map() { return M; },
    get player() { return P; },
    /* 캐릭터 머리 위의 화면 좌표(CSS px) — 얻은 물건이 날아가는 출발점 */
    playerScreen() { return [(P.x * T + 32 - cam.x) * scale, (P.y * T + 58 - 78 * PK - cam.y) * scale]; },
    teleport(id, at, dir) { load(id, at, dir); },
  };
})(window);
