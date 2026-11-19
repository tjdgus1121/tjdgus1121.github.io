// 추세선 대포 — 계산만 담당 (화면·통신 없음)
// 좌표: 맵은 0~100 정사각형, y는 위쪽이 큼. 화면에 보이는 눈금은 0~10 (값 ÷ 10)

export const C = 50;                         // 맵 가운데 (시소 받침점 기준)
export const PER = 400;                      // 테두리 한 바퀴 길이
export const TEAMS = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];
export const TEAM_MAX = 8;                   // 한 팀 최대 인원 (기본 6명 + 여유 2명)
export const TH_MAX = 70 * Math.PI / 180;    // 직선 기울기 각도 한계
export const D_MAX = 45;                     // 직선이 가운데에서 떨어질 수 있는 거리 한계
// 모아 쏘기: 세기 p = P_MIN(톡 누르기) ~ 1(CHARGE_TIME 동안 누르기)
// 티끌 모아 태산: 한 발은 아주 조금만 움직이고, 팀이 많이 맞힐수록 쌓여 크게 움직임 (동시에 맞출 필요 없음)
// 한 발의 힘은 사용자 요청으로 약 20% 높임. 모은 시간에 따라 0.3~1배로 조절한다.
export const ROT_MAX = 1.8 * Math.PI / 180;  // 다 모아 쏜 포탄이 직선 끝(받침점에서 50)에 정면으로 맞으면 도는 각도
export const WIND_SHIFT = 0.96;              // 다 모아 분 바람이 옆으로 미는 거리
export const P_MIN = 0.3;
export const CHARGE_TIME = 0.6;              // 초
export const SHELL_SPEED = 130;
export const PUFF_SPEED = 100;
export const COOLDOWN = 0.25;                // 초 (모으는 시간이 따로 있음)
export const MOVE_SPEED = 120;               // 테두리 이동 속도 (칸/초) — 판이 짧아(15초) 빠르게
export const AIM_MAX = 60 * Math.PI / 180;   // 대포가 꺾을 수 있는 각도
export const RANK_PTS = [10, 8, 6, 5, 4, 3, 2, 1];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const deg = (d) => d * Math.PI / 180;

// ── 정해진 씨앗으로 같은 난수 (모든 팀이 같은 점을 받게) ──
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 직선: 각도 th와 가운데에서의 거리 d (법선 n = (−sin th, cos th)) ──
export const normal = (L) => ({ x: -Math.sin(L.th), y: Math.cos(L.th) });
export const along = (L) => ({ x: Math.cos(L.th), y: Math.sin(L.th) });
export const lineY = (L, x) => C + (L.d + Math.sin(L.th) * (x - C)) / Math.cos(L.th);
export const foot = (L) => { const n = normal(L); return { x: C + L.d * n.x, y: C + L.d * n.y }; };   // 받침점
export function side(L, p) { const n = normal(L); return n.x * (p.x - C) + n.y * (p.y - C) - L.d; }
export const clampLine = (L) => ({ th: clamp(L.th, -TH_MAX, TH_MAX), d: clamp(L.d, -D_MAX, D_MAX) });

// 받침점을 중심으로 돌리기 (시소)
export function rotateLine(L, dth) {
  const th = clamp(L.th + dth, -TH_MAX, TH_MAX);
  return clampLine({ th, d: L.d * Math.cos(th - L.th) });
}
// 옆으로 밀기 (바람). sx > 0 이면 오른쪽
export const shiftLine = (L, sx) => clampLine({ th: L.th, d: L.d - sx * Math.sin(L.th) });

// 통신으로 주고받는 변화량 op = { k: 'r', v: 각도 } | { k: 's', v: 거리 }
export function applyOp(L, op) {
  const r = op.k === 'r' ? rotateLine(L, op.v) : shiftLine(L, op.v);
  return { th: +r.th.toFixed(6), d: +r.d.toFixed(4) };
}

// 한 발 맞히기: 조금 움직이고 팀 명중 수(n)를 하나 올림
export const hitLine = (L, op) => ({ ...applyOp(L, op), n: ((L && L.n) || 0) + 1 });
// 이 한 발이 오차를 줄이는 방향인지 (+1 좋음 / −1 나쁨) — 개인 기록용
export function pushGood(pts, L, op) { return mse(pts, applyOp(L, op)) < mse(pts, L) ? 1 : -1; }

// 화면 눈금(0~10) 기준 식 y = a x + b
export const slopeOf = (L) => Math.tan(L.th);
export const interceptOf = (L) => lineY(L, 0) / 10;

// ── 판마다 주는 점 ── 판 번호에 따라 유형이 돌아감 (1판은 항상 기본)
export const ROUND_TYPES = [
  { key: 'basic', name: '기본', desc: '점 12개' },
  { key: 'outlier', name: '튀는 점', desc: '혼자 멀리 떨어진 점이 직선을 끌어당겨요' },
  { key: 'steep', name: '가파른 언덕', desc: '기울기가 큰 점들' },
  { key: 'noisy', name: '흩어진 점', desc: '점들이 넓게 퍼져 있어요' },
  { key: 'few', name: '점 6개', desc: '점이 적을수록 한 점의 오차가 커요' },
];
export const roundType = (round) => ROUND_TYPES[(Math.max(1, round) - 1) % ROUND_TYPES.length];

export function makeRound(seed, round) {
  const r = rng((seed * 31 + round * 7919 + 1) >>> 0);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const type = roundType(round);
  for (let attempt = 0; attempt < 200; attempt++) {
    const sign = r() < 0.5 ? -1 : 1;
    const ang = type.key === 'steep' ? 42 + r() * 14 : 20 + r() * 30;   // 기울기가 분명한 모양만
    const truth = { th: sign * deg(ang), d: (r() * 2 - 1) * (type.key === 'steep' ? 6 : 12) };
    const n = type.key === 'few' ? 6 : 12;
    const noise = type.key === 'noisy' ? 9 + r() * 3 : 4 + r() * 4;
    const pts = [];
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      const x = 8 + (84 * (i + 0.1 + 0.8 * r())) / n;
      const y = lineY(truth, x) + gauss() * noise;
      if (y < 4 || y > 96) ok = false;
      else pts.push({ x: +x.toFixed(2), y: +y.toFixed(2) });
    }
    if (!ok) continue;
    if (type.key === 'outlier') {   // 가운데 쪽 점 하나를 멀리 튀게
      const k = 3 + Math.floor(r() * 6), p = pts[k];
      const up = lineY(truth, p.x) < 50 ? 1 : -1;
      const y = lineY(truth, p.x) + up * (30 + r() * 8);
      if (y < 4 || y > 96) continue;
      p.y = +y.toFixed(2); p.out = true;
    }
    // 시작 직선: 기울기는 반대쪽으로, 높이도 어긋나게 (모든 팀 같음)
    const start = { th: -sign * deg(12), d: (r() < 0.5 ? -1 : 1) * 18 };
    return { pts, start: applyOp(start, { k: 's', v: 0 }), truth, type };
  }
  return { pts: [{ x: 20, y: 30 }, { x: 50, y: 50 }, { x: 80, y: 70 }], start: { th: deg(-12), d: 18 }, truth: { th: deg(34), d: 0 }, type };
}

// 평균제곱오차 (눈금 0~10 기준)
export function mse(pts, L) {
  let s = 0;
  for (const p of pts) { const e = (p.y - lineY(L, p.x)) / 10; s += e * e; }
  return s / pts.length;
}

// 최소제곱 직선 (정답 비교용, 한계로 자르지 않음)
export function bestFit(pts) {
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0;
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
  const m = sxx ? sxy / sxx : 0, b = my - m * mx;
  const th = Math.atan(m);
  return { th, d: (m * C + b - C) * Math.cos(th) };
}

// ── 테두리: s=0 왼쪽 위 → 위(0~100) → 오른쪽(100~200) → 아래(200~300) → 왼쪽(300~400), 시계 방향 ──
const TAN = [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }];
const INW = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }];
export const wrapS = (s) => ((s % PER) + PER) % PER;
export const segOf = (s) => Math.min(3, Math.floor(wrapS(s) / 100));
export const inward = (s) => INW[segOf(s)];
export const kindAt = (s) => (segOf(s) % 2 === 0 ? 'cannon' : 'mouth');   // 위·아래 = 대포, 왼쪽·오른쪽 = 입
export function posAt(s) {
  s = wrapS(s);
  const seg = segOf(s), u = s - seg * 100;
  return [{ x: u, y: 100 }, { x: 100, y: 100 - u }, { x: 100 - u, y: 0 }, { x: 0, y: u }][seg];
}

// 맵 안의 점에서 가장 가까운 테두리 위치
export function nearestS(p) {
  const x = clamp(p.x, 0, 100), y = clamp(p.y, 0, 100);
  const c = [
    { s: x, dist: Math.abs(p.y - 100) },
    { s: 100 + (100 - y), dist: Math.abs(p.x - 100) },
    { s: 200 + (100 - x), dist: Math.abs(p.y) },
    { s: 300 + y, dist: Math.abs(p.x) },
  ];
  c.sort((a, b) => a.dist - b.dist);
  return wrapS(c[0].s);
}

// 테두리를 따라 target 쪽으로 (짧은 방향)
export function moveToward(s, target, step) {
  const diff = ((target - s) % PER + PER * 1.5) % PER - PER / 2;
  if (Math.abs(diff) <= step) return wrapS(target);
  return wrapS(s + Math.sign(diff) * step);
}

// 방향키: 화면 방향 k = {x, y}. 모서리에서는 멈췄다가 꺾는 키를 누르면 이어서 감
export function stepByKeys(s, k, step) {
  if (!k.x && !k.y) return s;
  s = wrapS(s);
  const seg = segOf(s), u = s - seg * 100;
  const dot = (i) => TAN[i].x * k.x + TAN[i].y * k.y;
  let dir = Math.sign(dot(seg));
  let corner = false;
  if (!dir && u < 1e-6 && dot((seg + 3) % 4) < 0) { dir = -1; corner = true; }
  if (!dir) return s;
  let ns = s + dir * step;
  if (dir > 0) {
    const b = (seg + 1) * 100;
    if (ns >= b && dot((seg + 1) % 4) <= 0) ns = b;
  } else if (!corner) {
    const b = seg * 100;
    if (ns < b && dot((seg + 3) % 4) >= 0) ns = b;
  }
  return wrapS(ns);
}

// 대포 조준: 안쪽 방향에서 phi 만큼 꺾음 (입은 항상 안쪽으로 똑바로)
export function shotDir(s, phi) {
  const n = inward(s);
  if (kindAt(s) === 'mouth') return n;
  const c = Math.cos(phi), sn = Math.sin(phi);
  return { x: n.x * c - n.y * sn, y: n.x * sn + n.y * c };
}
export function aimToward(s, p) {
  const o = posAt(s), n = inward(s);
  const v = { x: p.x - o.x, y: p.y - o.y };
  const a = Math.atan2(n.x * v.y - n.y * v.x, n.x * v.x + n.y * v.y);
  return clamp(a, -AIM_MAX, AIM_MAX);
}
export const clampAim = (phi) => clamp(phi, -AIM_MAX, AIM_MAX);

// 조준 미리보기: 지금 자리·각도로 쏘면 직선 어디에 닿는지 (안 닿으면 맵 끝까지, hit=false)
export function rayHit(L, s, phi) {
  const o = posAt(s), d = shotDir(s, phi), n = normal(L);
  const dn = n.x * d.x + n.y * d.y;
  let tHit = Infinity;
  if (Math.abs(dn) > 1e-9) { const tt = -side(L, o) / dn; if (tt > 0) tHit = tt; }
  const tx = d.x > 1e-9 ? (100 - o.x) / d.x : d.x < -1e-9 ? -o.x / d.x : Infinity;
  const ty = d.y > 1e-9 ? (100 - o.y) / d.y : d.y < -1e-9 ? -o.y / d.y : Infinity;
  const tOut = Math.min(tx, ty);
  const hit = tHit <= tOut, tt = hit ? tHit : tOut;
  return { from: o, to: { x: o.x + d.x * tt, y: o.y + d.y * tt }, hit };
}

// 포탄·바람 하나 만들기
export const powerOf = (held) => clamp(P_MIN + (1 - P_MIN) * (held / CHARGE_TIME), P_MIN, 1);
export function makeShot(s, phi, p = 1) {
  const kind = kindAt(s);
  const d = shotDir(s, phi), o = posAt(s), sp = kind === 'cannon' ? SHELL_SPEED : PUFF_SPEED;
  return { k: kind === 'cannon' ? 'c' : 'w', x: o.x + d.x * 2, y: o.y + d.y * 2, vx: d.x * sp, vy: d.y * sp, p: +clamp(p, P_MIN, 1).toFixed(2) };
}

// 한 걸음 움직이고 직선을 지났으면 맞은 자리를 돌려줌
export function stepShot(p, L, dt) {
  const before = side(L, p);
  const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  const after = side(L, { x: nx, y: ny });
  if (before !== 0 && Math.sign(before) !== Math.sign(after)) {
    const t = before / (before - after);
    return { hit: { x: p.x + (nx - p.x) * t, y: p.y + (ny - p.y) * t } };
  }
  p.x = nx; p.y = ny;
  return { out: nx < -3 || nx > 103 || ny < -3 || ny > 103 };
}

// 맞은 자리에서 생기는 변화량
export function hitOp(shot, L, at) {
  const pw = clamp(shot.p || 1, P_MIN, 1);
  if (shot.k === 'w') return { k: 's', v: Math.sign(shot.vx) * WIND_SHIFT * pw };
  const F = foot(L), u = along(L), n = normal(L);
  const lever = clamp((at.x - F.x) * u.x + (at.y - F.y) * u.y, -70, 70);
  const sp = Math.hypot(shot.vx, shot.vy) || 1;
  const vn = (shot.vx * n.x + shot.vy * n.y) / sp;
  return { k: 'r', v: ROT_MAX * pw * (lever / 50) * vn };
}

// 팀 순위: mses = { t1: 0.42, ... } (참가자 없는 팀은 빼고 넘김)
export function rankTeams(mses) {
  const list = Object.entries(mses).sort((a, b) => a[1] - b[1]);
  const out = {};
  list.forEach(([t, m], i) => { out[t] = { mse: +m.toFixed(4), rank: i + 1, pts: RANK_PTS[i] || 0 }; });
  return out;
}
