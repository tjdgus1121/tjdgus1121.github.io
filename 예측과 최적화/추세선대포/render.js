// 추세선 대포 — 맵 하나를 Canvas에 그림 (학생 큰 맵·교사 작은 맵·첫 화면 예시 공용)
import { lineY, foot, posAt, kindAt, shotDir, inward } from './engine.js';
import { drawShot, drawImpact, weaponSize, recoilFor } from './effects.js';
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

// 한 번만 읽고 모든 맵에서 재사용. 정적인 화면도 이미지 준비 후 다시 그린다.
const pendingArt = new Map();
const pendingPortraits = new Map();
const fanStates = new WeakMap();
let artSettled = false;
function loadSprite(file) {
  const image = new Image();
  const ready = new Promise((resolve) => { image.onload = image.onerror = resolve; });
  image.src = new URL(`./assets/${file}`, import.meta.url).href;
  return { image, ready };
}
const sprites = { cannon: loadSprite('cannon-v2.png'), fan: loadSprite('fan-v2.png'), fanBody: loadSprite('fan-body-v3.png'), fanRotor: loadSprite('fan-rotor-v3.png') };
Promise.all([...Object.values(sprites).map((s) => s.ready), document.fonts.ready]).then(() => {
  artSettled = true;
  for (const [cv, options] of pendingArt) if (cv.isConnected) drawMap(cv, options);
  pendingArt.clear();
  for (const [cv, charge] of pendingPortraits) if (cv.isConnected) drawFanPortrait(cv, charge);
  pendingPortraits.clear();
});
const spriteReady = (sprite) => sprite.complete && sprite.naturalWidth > 0;

// Integrate speed rather than multiplying time: charging and release never jump the rotor angle.
function fanPhase(owner, id, charge, now) {
  let states = fanStates.get(owner);
  if (!states) fanStates.set(owner, states = new Map());
  let state = states.get(id);
  if (!state) states.set(id, state = { phase: 0, speed: 3, last: now });
  const dt = Math.max(0, Math.min(.1, now - state.last)); state.last = now;
  if (motionPreference.matches) { state.phase = 0; state.speed = 0; return 0; }
  const target = 3 + 18 * Math.max(0, Math.min(1, charge || 0));
  const next = state.speed + (target - state.speed) * (1 - Math.exp(-dt * 8));
  state.phase = (state.phase + (state.speed + next) * .5 * dt) % (Math.PI * 2);
  state.speed = next;
  return state.phase;
}
function paintFan(ctx, size, phase) {
  if (!spriteReady(sprites.fanBody.image) || !spriteReady(sprites.fanRotor.image)) {
    if (!spriteReady(sprites.fan.image)) return false;
    ctx.drawImage(sprites.fan.image, 24, 8, 1256, 1186, -size * .823, -size * 1.109, size * 2.35, size * 2.219);
    return true;
  }
  ctx.save();
  ctx.translate(-size * .87, -size * 1.12);
  ctx.scale(size * 2.45 / 1312, size * 2.45 / 1312);
  ctx.save();
  // Rotor spins in its own circular plane, then projects into the front grille ellipse.
  ctx.beginPath(); ctx.ellipse(953, 557, 283, 414, 0, 0, Math.PI * 2); ctx.clip();
  ctx.translate(953, 557); ctx.scale(.49, .71); ctx.rotate(phase);
  ctx.drawImage(sprites.fanRotor.image, -621, -667);
  ctx.restore();
  ctx.drawImage(sprites.fanBody.image, 0, 0);
  ctx.restore();
  return true;
}
export function drawFanPortrait(cv, charge = 0) {
  if (!cv || cv.hidden) return;
  if (!artSettled) pendingPortraits.set(cv, charge);
  const { w, dpr } = fitCanvas(cv, false, .8), h = w * .8;
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.save(); ctx.translate(w * .41, h * .5);
  paintFan(ctx, w * .36, fanPhase(cv, 'portrait', charge, performance.now() / 1000));
  ctx.restore();
}

let theme = null;
export function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k) => cs.getPropertyValue(k).trim();
  theme = {
    rail: v('--rail'), track: v('--rail-track'), bg: v('--map-bg'), grid: v('--map-grid'), axis: v('--map-axis'), text: v('--muted'), ink: v('--ink'),
    pt: v('--map-point'), line: v('--accent'), best: v('--map-best'), resid: v('--danger'),
    cannon: v('--map-cannon'), mate: v('--map-mate'), me: v('--fire'), shell: v('--map-shell'), wind: v('--map-wind'),
    teams: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--t${i}`)),
  };
  return theme;
}
export const teamColor = (t) => { if (!theme) readTheme(); return theme.teams[(+String(t).slice(1) || 1) - 1]; };

// 크기는 ResizeObserver로만 읽음 (매 프레임 레이아웃 읽기 피함)
const ro = 'ResizeObserver' in window ? new ResizeObserver((es) => { for (const e of es) e.target._w = Math.round(e.contentRect.width); }) : null;
export function fitCanvas(cv, small, aspect = 1) {
  if (!cv._obs) { cv._obs = true; if (ro) ro.observe(cv); }
  if (!cv._w || !ro) cv._w = Math.round(cv.getBoundingClientRect().width);
  const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  const w = Math.max(50, cv._w);
  const width = Math.round(w * dpr), height = Math.round(w * aspect * dpr);
  if (cv.width !== width || cv.height !== height) { cv.width = width; cv.height = height; }
  return { w, dpr };
}

export function geom(w, small) {
  const M = w * (small ? 0.06 : 0.075), P = w - 2 * M;
  return { M, P, tx: (x) => M + (x / 100) * P, ty: (y) => M + ((100 - y) / 100) * P, toWorld: (px, py) => ({ x: ((px - M) / P) * 100, y: 100 - ((py - M) / P) * 100 }) };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// o = { pts, line, best, residuals, players:[{s, a, label, me}], shots, fx, small, meColor, lineColor }
export function drawMap(cv, o) {
  if (!artSettled) pendingArt.set(cv, o);
  if (!theme) readTheme();
  const T = theme;
  const { w, dpr } = fitCanvas(cv, o.small);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = geom(w, o.small);
  const { M, P, tx, ty } = g;

  // 레일(테두리 띠): 대포가 다니는 길
  ctx.clearRect(0, 0, w, w);
  ctx.fillStyle = T.rail; roundRect(ctx, 0, 0, w, w, o.small ? 10 : 18); ctx.fill();
  ctx.strokeStyle = T.track; ctx.lineWidth = 1.5;
  roundRect(ctx, 1, 1, w - 2, w - 2, o.small ? 9 : 17); ctx.stroke();
  if (!o.small) {
    for (const x of [M * 0.34, w - M * 0.34]) for (const y of [M * 0.34, w - M * 0.34]) {
      ctx.fillStyle = T.axis; ctx.beginPath(); ctx.arc(x, y, Math.max(2, M * 0.07), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.strokeStyle = T.track; ctx.lineWidth = o.small ? 1 : 2; ctx.setLineDash(o.small ? [3, 4] : [6, 7]);
  ctx.strokeRect(M / 2, M / 2, w - M, w - M);
  ctx.setLineDash([]);
  ctx.fillStyle = T.bg; ctx.fillRect(M, M, P, P);

  // 눈금 (1칸 = 1)
  ctx.lineWidth = 1; ctx.strokeStyle = T.grid; ctx.beginPath();
  for (let i = 1; i < 10; i++) {
    const a = M + (P * i) / 10;
    ctx.moveTo(a, M); ctx.lineTo(a, M + P); ctx.moveTo(M, a); ctx.lineTo(M + P, a);
  }
  ctx.stroke();
  if (!o.small) {
    ctx.fillStyle = T.axis; ctx.font = `600 ${Math.max(10, w * 0.02)}px system-ui, sans-serif`;
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
    for (let i = 2; i <= 8; i += 2) ctx.fillText(String(i), tx(i * 10), ty(0) - 3);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (let i = 2; i <= 8; i += 2) ctx.fillText(String(i), tx(0) + 4, ty(i * 10));
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(M, M, P, P); ctx.clip();

  const strokeLine = (L) => { ctx.beginPath(); ctx.moveTo(tx(-5), ty(lineY(L, -5))); ctx.lineTo(tx(105), ty(lineY(L, 105))); ctx.stroke(); };

  // 잔차 (결과 화면)
  if (o.residuals && o.line && o.pts) {
    ctx.strokeStyle = T.resid; ctx.lineWidth = o.small ? 1.2 : 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const p of o.pts) { ctx.moveTo(tx(p.x), ty(p.y)); ctx.lineTo(tx(p.x), ty(lineY(o.line, p.x))); }
    ctx.stroke();
  }
  if (o.best) {
    ctx.strokeStyle = T.best; ctx.lineWidth = o.small ? 1.5 : 2.5; ctx.setLineDash(o.small ? [4, 4] : [8, 6]);
    strokeLine(o.best); ctx.setLineDash([]);
  }
  // 여러 팀 직선 겹쳐 그리기 (발표 화면): [{ L, color, label, dim, bold }]
  if (o.lines) {
    for (const it of o.lines) {
      if (!it.L) continue;
      ctx.globalAlpha = it.dim ? 0.18 : 1;
      ctx.lineCap = 'round';
      const lw = it.bold ? 6 : 3.5;
      ctx.strokeStyle = T.bg; ctx.lineWidth = lw + 3; strokeLine(it.L);
      ctx.strokeStyle = it.color; ctx.lineWidth = lw; strokeLine(it.L);
      ctx.globalAlpha = 1;
    }
  }
  if (o.line) {
    const lw = o.small ? 3 : 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = T.bg; ctx.lineWidth = lw + (o.small ? 2 : 4); strokeLine(o.line);   // 흰 테두리로 점·격자 위에서도 또렷하게
    ctx.strokeStyle = o.lineColor || T.line; ctx.lineWidth = lw; strokeLine(o.line);
    // 받침점 (시소 가운데)
    const F = foot(o.line), fx = tx(F.x), fy = ty(F.y), r = o.small ? 4 : 9;
    ctx.fillStyle = T.ink; ctx.strokeStyle = T.bg; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fx, fy + lw / 2); ctx.lineTo(fx - r, fy + lw / 2 + r * 1.5); ctx.lineTo(fx + r, fy + lw / 2 + r * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // 점
  if (o.pts) {
    const pr = o.small ? 2.8 : Math.max(4.5, w * 0.012);
    ctx.fillStyle = T.pt; ctx.strokeStyle = T.bg; ctx.lineWidth = o.small ? 1 : 2;
    for (const p of o.pts) { ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), pr, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (o.residuals) {   // 결과: 튀는 점(이상치) 표시
      ctx.strokeStyle = T.resid; ctx.lineWidth = o.small ? 1 : 2; ctx.setLineDash([3, 3]);
      for (const p of o.pts) if (p.out) { ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), pr * 2.6, 0, Math.PI * 2); ctx.stroke(); }
      ctx.setLineDash([]); ctx.fillStyle = T.pt;
    }
  }
  // 조준 미리보기 (내 대포·선풍기): 쏘면 닿는 곳까지 점선, 안 닿으면 끝에 ×
  if (o.aim && !o.small) {
    const a = o.aim;
    ctx.strokeStyle = o.meColor || T.me; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(tx(a.from.x), ty(a.from.y)); ctx.lineTo(tx(a.to.x), ty(a.to.y)); ctx.stroke(); ctx.setLineDash([]);
    const ex = tx(a.to.x), ey = ty(a.to.y), r = Math.max(6, w * 0.012);
    if (a.hit) { ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fillStyle = o.meColor || T.me; ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(ex - r * 0.7, ey - r * 0.7); ctx.lineTo(ex + r * 0.7, ey + r * 0.7); ctx.moveTo(ex + r * 0.7, ey - r * 0.7); ctx.lineTo(ex - r * 0.7, ey + r * 0.7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  // 모든 화면이 같은 시각 효과를 사용한다. 판정 좌표와 속도는 바꾸지 않는다.
  const reduced = motionPreference.matches;
  for (const shot of o.shots || []) drawShot(ctx, g, w, shot, o.small, T, reduced);
  for (const effect of o.fx || []) drawImpact(ctx, g, effect, o.small, T, reduced);
  ctx.restore();

  // 겹친 직선 이름표: 맵 오른쪽 끝에서 직선이 지나는 높이에 팀 번호 (레일 위)
  if (o.lines && !o.small) {
    const tags = o.lines.filter((it) => it.L && it.label && !it.dim)
      .map((it) => ({ it, y: ty(Math.max(0, Math.min(100, lineY(it.L, 100)))) }))
      .sort((a, b) => a.y - b.y);
    const r = Math.max(9, M * 0.36);
    for (let i = 1; i < tags.length; i++) if (tags[i].y - tags[i - 1].y < r * 2.1) tags[i].y = tags[i - 1].y + r * 2.1;   // 겹치지 않게 아래로
    ctx.font = `800 ${r * 1.1}px "Jua Game", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const { it, y } of tags) {
      const x = M + P + M / 2;
      ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(it.label, x, y + 0.5);
    }
  }

  // 대포·선풍기 (기존 위치·조준·판정 좌표 그대로)
  if (o.players) for (const [i, p] of spreadPlayers(o.players).entries()) drawShooter(ctx, g, p, o, T, fanPhase(cv, p.id || p.label || i, p.charge, o.time ?? performance.now() / 1000));
}

// 같은 자리에 몰린 팀원: 조금씩 비켜 그리고 이름표는 하나로 ("김하늘 외 2"), 내 곁이면 "나 +2"
const NEAR = 7;
function spreadPlayers(players) {
  const me = players.find((p) => p.me), mates = players.filter((p) => !p.me).map((p) => ({ ...p })).sort((a, b) => a.s - b.s);
  const groups = [];
  for (const p of mates) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(p.s - g[g.length - 1].s) < NEAR) g.push(p); else groups.push([p]);
  }
  const out = [];
  let meExtra = 0;
  for (const g of groups) {
    const nearMe = me && g.some((p) => Math.abs(((p.s - me.s + 600) % 400) - 200) < NEAR);
    g.forEach((p, i) => {
      p.s += (i - (g.length - 1) / 2) * 3.2;
      if (nearMe) p.label = '';
      else if (i > 0) p.label = '';
      else if (g.length > 1 && p.label) p.label = `${p.label} 외 ${g.length - 1}`;
      out.push(p);
    });
    if (nearMe) meExtra += g.length;
  }
  if (me) out.push({ ...me, label: meExtra ? `나 +${meExtra}` : me.label });   // 내 것은 맨 위에
  return out;
}

function drawShooter(ctx, g, p, o, T, phase) {
  const small = o.small;
  const pos = posAt(p.s), x = g.tx(pos.x), y = g.ty(pos.y);
  const n = inward(p.s);
  const size = weaponSize(g, small);
  const col = p.me ? (o.meColor || T.me) : T.mate;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  // 팀 색과 내 위치는 이미지 색상과 별개인 받침 고리로 구분한다.
  ctx.fillStyle = col; ctx.globalAlpha = p.me ? 0.22 : 0.12;
  ctx.beginPath(); ctx.arc(0, 0, size * 1.12, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = col; ctx.lineWidth = p.me ? 2.5 : 1;
  ctx.beginPath(); ctx.arc(0, 0, size * 1.12, 0, Math.PI * 2); ctx.stroke();
  if (kindAt(p.s) === 'cannon') {
    const d = shotDir(p.s, p.a || 0);
    const ang = Math.atan2(-d.y, d.x);   // 화면은 y가 아래로
    // 조준선 (내 대포만, 큰 맵)
    if (p.me && !small && !o.aim) {
      ctx.save(); ctx.rotate(ang);
      ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(size * 2.1, 0); ctx.lineTo(size * 5, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.save(); ctx.rotate(ang);
    ctx.translate(-size * recoilFor(pos, o.shots, motionPreference.matches || small), 0);
    if (spriteReady(sprites.cannon.image)) {
      ctx.drawImage(sprites.cannon.image, 115, 106, 1135, 843, -size * 1.05, -size * 1.114, size * 3, size * 2.228);
    } else {
      ctx.fillStyle = T.cannon; ctx.strokeStyle = T.cannon; ctx.lineWidth = 1;
      roundRect(ctx, 0, -size * 0.3, size * 1.6, size * 0.6, size * 0.15); ctx.fill();   // 포신
      ctx.fillStyle = col; ctx.fillRect(size * 1.25, -size * 0.3, size * 0.3, size * 0.6);   // 포구 띠
    }
    ctx.restore();
    if (!spriteReady(sprites.cannon.image)) {
      ctx.fillStyle = col; ctx.strokeStyle = T.cannon; ctx.lineWidth = p.me ? 3 : 2;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.78, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = T.cannon; ctx.beginPath(); ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.save(); ctx.scale(n.x, 1);   // 왼쪽·오른쪽 모두 맵 안쪽을 향함
    if (!paintFan(ctx, size, phase)) {
      // 로드 실패 시에도 입 대신 보호망·날개가 있는 선풍기를 표시.
      ctx.fillStyle = T.cannon; roundRect(ctx, -size * 0.6, size * 0.55, size * 1.5, size * 0.25, size * 0.1); ctx.fill();
      ctx.fillStyle = T.wind; ctx.beginPath(); ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = small ? 1 : 2;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.65, 0, Math.PI * 2); ctx.moveTo(-size * 0.65, 0); ctx.lineTo(size * 0.65, 0); ctx.moveTo(0, -size * 0.65); ctx.lineTo(0, size * 0.65); ctx.stroke();
    }
    if (p.me && !small) {
      ctx.strokeStyle = T.wind; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const dy of [-0.35, 0, 0.35]) { ctx.moveTo(size * 1.65, size * dy); ctx.lineTo(size * 2.65, size * dy); }
      ctx.moveTo(size * 2.3, -size * 0.25); ctx.lineTo(size * 2.65, 0); ctx.lineTo(size * 2.3, size * 0.25); ctx.stroke();
    }
    ctx.restore();
  }
  if (p.me && p.charge && !small) {   // 모으기 고리: 다 차면 가장 셈
    ctx.strokeStyle = T.shell; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, size * 1.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.charge); ctx.stroke();
    if (p.charge >= 1) { ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 0, size * 1.55, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  if (!small && p.label) {
    const fs = Math.max(11, Math.min(18, size * 0.72));
    ctx.font = `${p.me ? 800 : 600} ${fs}px "Jua Game", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 이름표는 맵 안쪽, 대포 옆에 (바깥 레일은 좁아서 잘림)
    const off = kindAt(p.s) === 'cannon' ? size * 2.65 : size * 2.1;
    let lx = n.x * off + (n.x ? n.x * size * 0.9 : 0), ly = -n.y * off + (n.x ? -size * 1.6 : 0);
    const tw = ctx.measureText(p.label).width + fs * 0.9, th = fs * 1.5;

    const extent = g.P + g.M * 2;
    lx = Math.max(tw / 2 + 4, Math.min(extent - tw / 2 - 4, x + lx)) - x;
    ly = Math.max(th / 2 + 4, Math.min(extent - th / 2 - 4, y + ly)) - y;
    ctx.fillStyle = p.me ? col : 'rgba(255,255,255,.9)';
    roundRect(ctx, lx - tw / 2, ly - th / 2, tw, th, th / 2); ctx.fill();
    if (!p.me) { ctx.strokeStyle = T.mate; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = p.me ? '#fff' : T.ink;
    ctx.fillText(p.label, lx, ly + 0.5);
  }
  ctx.restore();
}
