// 추세선 대포 — 화면 흐름 (첫 화면 · 학생 · 교사 · 혼자 연습)
import * as E from './engine.js';
import { drawMap, drawFanPortrait, geom, teamColor } from './render.js';
import { firebaseStore, fakeStore } from './net.js';
import { firebaseConfig, loginFreeTest } from './firebase-config.js';
import { sfx, unlockAudio, isMuted, setMuted } from './sound.js';
import { openPresenter, closePresenter, refreshPresenter, initPresenter, isPresenterOpen } from './present.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const FAKE = qs.has('fake');            // 시험용: 같은 페이지 안 여러 iframe이 가짜 저장소를 나눠 씀
const ONLINE = FAKE || !!firebaseConfig;
const ROOT = loginFreeTest.roomRoot;
const SESSION_KEY = 'trendCannon.test.session' + (FAKE ? '.' + window.name : '');   // 기존 인증 방 세션과 분리
const teamName = (t) => `${String(t).slice(1)}팀`;
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const sign = (b) => (b < 0 ? '−' : '+');
const eqOf = (L) => { const a = E.slopeOf(L), b = E.interceptOf(L); return `y = ${fmt(a)}x ${sign(b)} ${fmt(Math.abs(b))}`; };
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
// 팀 수(2~8)는 교사가 정함. 전체 정원 약 64명(무료 동시 접속 100 안)을 팀 수로 나눠 팀당 정원
const TOTAL_CAP = 64;
const teamCount = (m) => Math.min(8, Math.max(2, (m && m.teams) || 8));
const activeTeams = (m) => E.TEAMS.slice(0, teamCount(m));
const teamCap = (m) => Math.max(E.TEAM_MAX, Math.ceil(TOTAL_CAP / teamCount(m)));

// ── 공통 UI ──
const SCREENS = ['scrHome', 'scrJoin', 'scrWait', 'scrPlay', 'scrResult', 'scrHost'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  document.body.dataset.screen = id;
  if (id !== 'scrPlay') stopPlayLoop();
  if (id !== 'scrHost') stopHostLoop();
  if (id === 'scrHome') startHero(); else stopHero();
  if (id !== 'scrResult' && id !== 'scrHost') closePresenter();
  if (id !== 'scrResult') clearInterval(nextTimer);
  window.scrollTo(0, 0);
}
const setBar = (el, f) => { el.style.transform = `scaleX(${Math.max(0, Math.min(1, f)).toFixed(4)})`; };
function setTeamBadge(el, t) {
  el.hidden = !t;
  if (!t) return;
  el.dataset.team = t; el.textContent = String(t).slice(1);
}

// ── 첫 화면 예시 맵: 대포와 선풍기가 번갈아 쏴서 직선이 점들 쪽으로 맞춰져 가는 모습 ──
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero = { raf: 0, last: 0 };
function heroReset() {
  const rd = E.makeRound(((Math.random() * 1e6) >>> 0) + 3, 1);
  Object.assign(hero, { pts: rd.pts, line: { ...rd.start }, best: E.bestFit(rd.pts), shooters: [{ s: 50, a: 0 }, { s: 330, a: 0 }], turn: 0, cd: 1, shots: [], fx: [], done: 0, age: 0 });
}
function heroPlan(L) {
  // 기울기가 더 어긋나 있으면 위 대포, 아니면 옆 선풍기
  const dth = hero.best.th - L.th, sx = Math.abs(Math.sin(L.th)) > 0.05 ? -(hero.best.d - L.d) / Math.sin(L.th) : 0;
  if (Math.abs(dth) > 0.035 || !sx) return { who: 0, s: dth < 0 ? 85 : 15 };   // 위에서 아래로 누름: 오른쪽 끝 → 기울기 감소
  const y = Math.min(92, Math.max(8, E.lineY(L, sx > 0 ? 8 : 92)));
  return { who: 1, s: sx > 0 ? 300 + y : 200 - y };
}
function heroFrame(t) {
  hero.raf = requestAnimationFrame(heroFrame);
  const dt = Math.min(0.05, (t - (hero.last || t)) / 1000); hero.last = t;
  const L = hero.line;
  hero.age += dt;
  if (hero.age > 25) { heroReset(); return; }   // 막히면 새 점으로
  const done = Math.abs(hero.best.th - L.th) < 0.035 && Math.abs(hero.best.d - L.d) < 1.8;
  if (done) { hero.done += dt; if (hero.done > 2.5) heroReset(); }
  else {
    const plan = heroPlan(L), sh = hero.shooters[plan.who];
    sh.s = E.moveToward(sh.s, plan.s, E.MOVE_SPEED * 1.6 * dt);
    hero.cd -= dt;
    if (Math.abs(sh.s - plan.s) < 0.5 && hero.cd <= 0 && !hero.shots.length) {
      const need = plan.who === 0 ? Math.abs(hero.best.th - L.th) / (E.ROT_MAX * 0.7) : 0.6;
      const shot = E.makeShot(sh.s, 0, Math.min(1, Math.max(E.P_MIN, need))); shot.age = 0; hero.shots.push(shot); hero.cd = 0.7;
    }
  }
  for (let i = hero.shots.length - 1; i >= 0; i--) {
    const p = hero.shots[i]; p.age += dt;
    const r = E.stepShot(p, hero.line, dt);
    if (r.hit) { hero.fx.push({ x: r.hit.x, y: r.hit.y, k: p.k, age: 0, vx: p.vx, vy: p.vy, dx: p.k === 'w' ? Math.sign(p.vx) * E.WIND_SHIFT * (p.p || 1) : 0 }); hero.line = E.applyOp(hero.line, E.hitOp(p, hero.line, r.hit)); hero.shots.splice(i, 1); }
    else if (r.out) hero.shots.splice(i, 1);
  }
  for (let i = hero.fx.length - 1; i >= 0; i--) { hero.fx[i].age += dt; if (hero.fx[i].age > 0.45) hero.fx.splice(i, 1); }
  heroDraw(done);
}
function heroDraw(done) {
  drawFanPortrait($('fanHeroPortrait'));
  drawMap($('cvHero'), {
    pts: hero.pts, line: hero.line, best: done ? hero.best : null, residuals: true,
    players: hero.shooters.map((s, i) => ({ id: `hero-${i}`, s: s.s, a: 0, me: i === 0, label: i === 0 ? '대포' : '선풍기' })), shots: hero.shots, fx: hero.fx,
  });
}
function startHero() {
  if (hero.raf) return;
  heroReset();
  if (REDUCED) {   // 움직임 줄이기: 다 맞춘 모습 한 장만
    hero.line = { ...hero.best }; hero.shooters[0].s = 70; hero.shooters[1].s = 320;
    requestAnimationFrame(() => heroDraw(true));
    return;
  }
  hero.last = 0; hero.raf = requestAnimationFrame(heroFrame);
}
function stopHero() { if (hero.raf) cancelAnimationFrame(hero.raf); hero.raf = 0; }
let toastTimer = 0;
function toast(msg, kind) {
  const t = $('toast');
  t.textContent = msg; t.className = `toast show${kind === 'error' ? ' error' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, kind === 'error' ? 5000 : 2600);
}
function setConn(ok) {
  const b = $('connBadge');
  b.hidden = false; b.textContent = ok ? '테스트 연결됨' : '연결 끊김 · 다시 연결 중';
  b.classList.toggle('off', !ok);
}
const saveSession = (o) => { try { o ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(o)) : sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* 저장 못 해도 진행 */ } };
const loadSession = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; } };

// ── 저장소 (처음 쓸 때 연결) ──
let storePromise = null;
function getStore() {
  if (!ONLINE) return Promise.reject(new Error('Firebase 설정이 아직 없어 같이하기를 쓸 수 없습니다. 「혼자 연습하기」는 됩니다.'));
  if (!storePromise) {
    storePromise = (FAKE ? Promise.resolve(fakeStore()) : firebaseStore(firebaseConfig)).then((st) => {
      st.onConn((c) => { setConn(c); if (c) onReconnect(); });
      return st;
    }).catch((e) => { storePromise = null; throw e; });
  }
  return storePromise;
}
const errMsg = (e) => (e && /permission|PERMISSION/.test(String(e.message || e)) ? '로그인 없는 테스트 규칙이 아직 게시되지 않았거나 기간이 끝났어요. Firebase 규칙을 확인해 주세요.' : (e && e.message) || '연결에 실패했습니다.');

// 구독 정리
let subs = [];
const addSub = (u) => { if (typeof u === 'function') subs.push(u); };
function clearSubs() { subs.forEach((u) => { try { u(); } catch (e) { /* 이미 해제 */ } }); subs = []; }

// ════════════════════════════════════════
// 게임 조작 (학생·연습 공용)
// ════════════════════════════════════════
const play = {
  mode: null,            // 'practice' | 'online'
  pts: [], line: null, shown: null, type: null, round: 1,
  s: 50, a: 0, cd: 0, target: null, hold: 0,
  keys: new Set(), charging: null, queued: null,
  shots: [], fx: [], mates: new Map(),
  startAt: 0, endsAt: 0, now: () => Date.now(),
  onOp: null, onShot: null, onPos: null, onEnd: null,
  raf: 0, last: 0, lastSent: 0, sent: '', lastTimer: '', lastEq: 0, ended: false,
  lastCount: '', stat: { h: 0, g: 0 }, chargeTick: 0,
};

function resetPlay(mode, rd, line, s0) {
  Object.assign(play, {
    mode, pts: rd.pts, type: rd.type || null, line: { ...line }, shown: { ...line }, s: s0, a: 0, cd: 0, target: null, hold: 0,
    shots: [], fx: [], ended: false, sent: '', lastTimer: '', lastCount: '', charging: null, queued: null, stat: { h: 0, g: 0 },
  });
  play.keys.clear();
}

const isActive = () => { const n = play.now(); return !play.ended && n >= play.startAt && n < play.endsAt; };

// 모아 쏘기: 누르기 시작 → 놓을 때 발사 (오래 누를수록 셈)
function startCharge() { if (isActive() && !play.charging) { play.charging = { t: 0 }; play.chargeTick = 0; } }
function releaseCharge() {
  if (!play.charging) return;
  const p = E.powerOf(play.charging.t);
  play.charging = null;
  fire(p);
}
function fire(p = E.P_MIN) {
  if (!isActive()) return;
  if (play.cd > 0) { play.queued = p; return; }   // 재장전 중이면 끝나자마자
  const shot = E.makeShot(play.s, play.a, p);
  shot.own = true; shot.age = 0;
  play.shots.push(shot);
  play.cd = E.COOLDOWN;
  (shot.k === 'w' ? sfx.wind : sfx.fire)(shot.p);
  if (play.onShot) play.onShot(shot);
}

function keyVector() {
  const k = play.keys;
  return { x: (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0), y: (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0) };
}

function shake() {
  if (REDUCED) return;
  const st = $('cvPlay').parentElement;
  st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
}

function playFrame(t) {
  play.raf = requestAnimationFrame(playFrame);
  const dt = Math.min(0.05, (t - (play.last || t)) / 1000);
  play.last = t;
  const now = play.now(), active = isActive();

  if (active) {
    const k = keyVector(), step = E.MOVE_SPEED * dt;
    if (k.x || k.y) { play.s = E.stepByKeys(play.s, k, step); play.target = null; }
    else if (play.hold) { play.s = E.wrapS(play.s + play.hold * step); play.target = null; }
    else if (play.target !== null) { play.s = E.moveToward(play.s, play.target, step); if (Math.abs(play.s - play.target) < 1e-6) play.target = null; }
    const turn = (play.keys.has('KeyD') ? 1 : 0) - (play.keys.has('KeyA') ? 1 : 0);
    if (turn && E.kindAt(play.s) === 'cannon') play.a = E.clampAim(play.a + turn * -E.inward(play.s).y * 1.6 * dt);
    play.cd = Math.max(0, play.cd - dt);
    if (play.charging) {
      play.charging.t += dt;
      play.chargeTick -= dt;
      if (play.chargeTick <= 0 && play.charging.t < E.CHARGE_TIME + 0.1) { sfx.charge(E.powerOf(play.charging.t)); play.chargeTick = 0.12; }
    }
    if (play.queued !== null && play.cd <= 0) { const p = play.queued; play.queued = null; fire(p); }
    if (play.onPos && t - play.lastSent > 150) {
      const key = `${play.s.toFixed(1)}|${play.a.toFixed(2)}`;
      if (key !== play.sent) { play.sent = key; play.lastSent = t; play.onPos(play.s, play.a); }
    }
  } else play.charging = null;

  // 포탄·바람
  for (let i = play.shots.length - 1; i >= 0; i--) {
    const p = play.shots[i];
    p.age = (p.age || 0) + dt;
    const r = E.stepShot(p, p.own ? play.line : play.shown, dt);
    if (r.hit) {
      play.fx.push({ x: r.hit.x, y: r.hit.y, k: p.k, age: 0, vx: p.vx, vy: p.vy, dx: p.k === 'w' ? Math.sign(p.vx) * E.WIND_SHIFT * (p.p || 1) : 0, seed: Math.random() * 6 });
      if (p.own && active) {
        // 티끌 모아 태산: 한 발은 조금, 팀이 많이 맞힐수록 쌓여 크게
        const op = E.hitOp(p, play.line, r.hit);
        play.stat.h++; play.stat.g += E.pushGood(play.pts, play.line, op) * (p.p || 1);   // 개인 기록: 좋은 방향으로 민 힘 (끝날 때까지 안 보여 줌)
        play.line = E.hitLine(play.line, op);   // 내 화면엔 바로 반영
        sfx.hit(p.p || 1);
        if ((p.p || 1) >= 0.95) shake();
        if (play.onOp) play.onOp(op);
      }
      play.shots.splice(i, 1);
    } else if (r.out) play.shots.splice(i, 1);
  }
  for (let i = play.fx.length - 1; i >= 0; i--) { play.fx[i].age += dt; if (play.fx[i].age > 0.45) play.fx.splice(i, 1); }

  // 직선·팀원 부드럽게 따라가기
  const f = Math.min(1, dt * 12);
  play.shown.th += (play.line.th - play.shown.th) * f;
  play.shown.d += (play.line.d - play.shown.d) * f;
  for (const m of play.mates.values()) {
    const diff = ((m.s - m.shownS) % E.PER + E.PER * 1.5) % E.PER - E.PER / 2;
    m.shownS = E.wrapS(m.shownS + diff * Math.min(1, dt * 10));
    m.shownA += (m.a - m.shownA) * Math.min(1, dt * 10);
  }

  const players = [{ id: 'me', s: play.s, a: play.a, me: true, label: '나', charge: play.charging ? E.powerOf(play.charging.t) : 0 }];
  for (const [id, m] of play.mates) players.push({ id, s: m.shownS, a: m.shownA, label: m.label });
  drawMap($('cvPlay'), {
    pts: play.pts, line: play.shown, players, shots: play.shots, fx: play.fx, meColor: play.meColor,
    aim: active ? E.rayHit(play.line, play.s, play.a) : null,
  });

  // 이동한 변에 따라 실제 장비와 발사 버튼을 함께 표시한다.
  const weapon = E.kindAt(play.s);
  if (play.lastWeapon !== weapon) {
    play.lastWeapon = weapon;
    const cannon = weapon === 'cannon';
    $('weaponIcon').hidden = !cannon;
    $('fanPortrait').hidden = cannon;
    $('weaponName').textContent = cannon ? '대포' : '선풍기';
    $('weaponRole').textContent = cannon ? '기울기 조절' : '← 좌우 이동 →';
    $('weaponHint').textContent = cannon ? '포탄으로 직선을 기울여요' : '기울기는 그대로, 직선을 좌우로 밀어요';
    $('padFire').textContent = cannon ? '대포 발사' : '바람 발사';
  }

  if (weapon !== 'cannon') drawFanPortrait($('fanPortrait'), play.charging ? E.powerOf(play.charging.t) : 0);

  // 시간·식·안내·소리
  const left = Math.max(0, play.endsAt - now);
  const txt = now < play.startAt ? '' : `${Math.ceil(left / 1000)}초`;
  if (txt !== play.lastTimer) {
    if (txt && play.lastTimer && left > 0 && left <= 3000) sfx.tick();
    play.lastTimer = txt; $('hudTimer').textContent = txt;
    const low = left <= 3000 && left > 0;
    $('hudTimer').classList.toggle('low', low); $('timeFill').parentElement.classList.toggle('low', low);
  }
  setBar($('timeFill'), now < play.startAt ? 1 : left / Math.max(1, play.endsAt - play.startAt));
  if (t - play.lastEq > 200) { play.lastEq = t; $('eqText').textContent = eqOf(play.line); }
  const ov = $('overlay');
  if (now < play.startAt) {
    const c = String(Math.ceil((play.startAt - now) / 1000));
    if (ov.dataset.c !== c) {
      ov.dataset.c = c;
      if (c <= '3' && c.length === 1) sfx.count();
      const ty = play.type, first = play.round <= 1;
      ov.innerHTML = `<div class="ov-card"><div class="ov-round"></div><div class="count">${c}</div><div class="ov-type"></div>${first ? HINT_HTML : '<div class="sub">테두리 = 이동 · 맵 누르기 = 발사 · 길게 = 세게</div>'}</div>`;
      ov.querySelector('.ov-round').textContent = play.mode === 'practice' ? '연습' : `${play.round}판`;
      ov.querySelector('.ov-type').textContent = ty ? `${ty.name} · ${ty.desc}` : '';
    }
    ov.hidden = false;
  } else if (now >= play.endsAt) {
    if (ov.dataset.c !== 'end') { ov.dataset.c = 'end'; ov.innerHTML = '<div class="ov-card"><div class="count">끝!</div><div class="sub">오차를 세는 중…</div></div>'; sfx.end(); }
    ov.hidden = false;
    if (!play.ended) { play.ended = true; play.charging = null; play.shots.length = 0; if (play.onEnd) play.onEnd(); }
  } else if (!ov.hidden) { ov.hidden = true; ov.dataset.c = ''; sfx.go(); }
}
const HINT_HTML = `<ul class="ov-hint">
  <li><b>테두리</b>를 눌러 이동</li>
  <li><b>안쪽</b>을 길게 눌렀다 떼면 발사</li>
  <li>대포는 <b>기울기</b>, 바람은 <b>좌우</b>!</li>
</ul>`;
function startPlayLoop() { if (!play.raf) { play.last = 0; play.raf = requestAnimationFrame(playFrame); } }
function stopPlayLoop() { if (play.raf) cancelAnimationFrame(play.raf); play.raf = 0; play.keys.clear(); play.charging = null; play.hold = 0; }

// 조작: 키보드 (스페이스·엔터 누르고 있으면 모으기, 떼면 발사)
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD']);
window.addEventListener('keydown', (e) => {
  const el = e.target instanceof Element ? e.target : null;
  if ($('scrPlay').hidden || (el && el.closest('input, select, textarea'))) return;
  if (GAME_KEYS.has(e.code)) { play.keys.add(e.code); e.preventDefault(); }
  else if (e.code === 'Space' || e.code === 'Enter') {
    if (el && el.closest('button')) return;   // 버튼 위에서는 그 버튼 동작
    e.preventDefault();
    if (!e.repeat) startCharge();
  }
});
window.addEventListener('keyup', (e) => {
  play.keys.delete(e.code);
  if ((e.code === 'Space' || e.code === 'Enter') && !$('scrPlay').hidden) releaseCharge();
});
window.addEventListener('blur', () => { play.keys.clear(); play.charging = null; play.hold = 0; });

// 조작: 마우스·터치 (테두리 띠 = 이동, 맵 안 = 조준 + 누르고 있으면 모으기)
function worldOf(e) {
  const cv = $('cvPlay'), r = cv.getBoundingClientRect();
  return geom(r.width, false).toWorld(e.clientX - r.left, e.clientY - r.top);
}
const inPlot = (p) => p.x > 3 && p.x < 97 && p.y > 3 && p.y < 97;
$('cvPlay').addEventListener('pointerdown', (e) => {
  if (!isActive()) return;
  e.preventDefault();
  const p = worldOf(e);
  if (inPlot(p)) {
    if (E.kindAt(play.s) === 'cannon') play.a = E.aimToward(play.s, p);
    $('cvPlay').setPointerCapture?.(e.pointerId);
    startCharge();
  } else {
    play.target = E.nearestS(p);
  }
});
$('cvPlay').addEventListener('pointermove', (e) => {
  if (!isActive() || E.kindAt(play.s) !== 'cannon') return;
  if (e.pointerType !== 'mouse' && !play.charging) return;   // 터치는 누르고 있을 때만 조준 따라감
  const p = worldOf(e);
  if (inPlot(p) || play.charging) play.a = E.aimToward(play.s, p);
});
['pointerup', 'pointercancel'].forEach((ev) => $('cvPlay').addEventListener(ev, () => releaseCharge()));
function holdButton(btn, dir) {
  const stop = () => { play.hold = 0; };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); play.hold = dir; play.target = null; btn.setPointerCapture?.(e.pointerId); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play.hold = dir; } });
  btn.addEventListener('keyup', stop);
  btn.addEventListener('blur', stop);
}
holdButton($('padCCW'), -1);
holdButton($('padCW'), 1);
// 발사 버튼: 누르고 있으면 모으기, 떼면 발사 (키보드는 스페이스·엔터)
$('padFire').addEventListener('pointerdown', (e) => { e.preventDefault(); $('padFire').setPointerCapture?.(e.pointerId); startCharge(); });
['pointerup', 'pointercancel'].forEach((ev) => $('padFire').addEventListener(ev, () => releaseCharge()));
$('padFire').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); startCharge(); } });
$('padFire').addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') releaseCharge(); });

// 소리: 첫 사용자 동작에서 오디오를 깨움, 음소거 버튼
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, { capture: true }));
function renderSoundBtn() {
  const b = $('btnSound'), m = isMuted();
  b.setAttribute('aria-pressed', String(!m));
  b.setAttribute('aria-label', m ? '소리 꺼짐 (누르면 켜기)' : '소리 켜짐 (누르면 끄기)');
  b.innerHTML = `<span aria-hidden="true">${m ? '🔇' : '🔊'}</span><span class="lbl">${m ? '소리 꺼짐' : '소리 켜짐'}</span>`;
}
$('btnSound').addEventListener('click', () => { setMuted(!isMuted()); renderSoundBtn(); });
renderSoundBtn();

// ════════════════════════════════════════
// 혼자 연습하기 (15초 판, 판 유형이 차례로 바뀜)
// ════════════════════════════════════════
const PRACTICE_SEC = 15;
let practiceRound = 0;
function startPractice() {
  practiceRound++;
  const seed = (Math.random() * 1e9) >>> 0;
  const rd = E.makeRound(seed, practiceRound);
  resetPlay('practice', rd, rd.start, 50);
  play.round = practiceRound;
  play.mates.clear();
  play.now = () => Date.now();
  play.startAt = Date.now() + (practiceRound === 1 ? 5000 : 3000);
  play.endsAt = play.startAt + PRACTICE_SEC * 1000;
  play.onOp = null; play.onShot = null; play.onPos = null;
  play.onEnd = () => setTimeout(showPracticeResult, 700);
  $('hudTeam').textContent = '혼자 연습';
  setTeamBadge($('hudBadge'), null);
  play.meColor = null;
  $('hudRound').textContent = `${practiceRound}번째 · ${rd.type.name}`;
  $('btnPracticeEnd').hidden = false;
  show('scrPlay');
  startPlayLoop();
}
$('btnPracticeEnd').addEventListener('click', () => {
  if (play.mode !== 'practice' || play.ended) return;
  play.endsAt = Math.min(play.endsAt, Date.now());
  if (play.startAt > play.endsAt) play.startAt = play.endsAt;
});

function showPracticeResult() {
  const best = E.bestFit(play.pts);
  const m = E.mse(play.pts, play.line), bm = E.mse(play.pts, best);
  fillResult({
    title: m - bm < 0.3 ? '거의 최적 직선이에요!' : `연습 결과 · ${play.type ? play.type.name : ''}`,
    line: play.line, best, mse: m, bestMse: bm, rows: null,
    status: `최적과의 차이 ${fmt(m - bm)}. 오차가 최적 오차에 가까울수록 잘 맞춘 거예요.`,
    actions: [['다음 판 (새 점)', startPractice, true], ['처음으로', () => { practiceRound = 0; goHome(); }]],
  });
  sfx.reveal();
}

// A short celebration uses the actual round/final rank, never cumulative rank for a round winner.
function renderCelebration(root, o) {
  const winners = o.winners || [];
  const key = `${o.key}|${winners.join(',')}`;
  if (root.dataset.key === key) return;
  root.dataset.key = key;
  root.replaceChildren();
  const art = document.createElement('img'); art.src = 'assets/victory-flag-v3.png'; art.alt = ''; art.width = 104; art.height = 112;
  const copy = document.createElement('div'); copy.className = 'celebration-copy';
  const kicker = document.createElement('p'); kicker.className = 'celebration-kicker';
  kicker.textContent = o.practice ? `${o.round}판 연습 끝!` : o.final ? '모든 판이 끝났어요!' : `${o.round}판 끝!`;
  const title = document.createElement('h2');
  title.textContent = o.practice ? '우리 선, 얼마나 가까워졌을까?' : winners.length ? `${winners.map(teamName).join(' · ')}${winners.length > 1 ? ' 공동' : ''} 1위!` : '결과를 모으고 있어요';
  const note = document.createElement('p'); note.className = 'celebration-note';
  note.textContent = o.practice ? '점과 선 사이의 오차를 살펴보세요.' : o.final ? '전체 순위와 판별 결과를 확인해 보세요.' : '이번 판 순위예요. 아래에서 오차와 누적 순위를 확인해 보세요.';
  copy.append(kicker, title, note); root.append(art, copy);
  root.classList.remove('celebrate');
  if (!REDUCED) { void root.offsetWidth; root.classList.add('celebrate'); }
}

// 결과 화면 채우기 (연습·학생 공용)
function fillResult(o) {
  $('resTitle').textContent = o.title;
  renderCelebration($('resultCelebration'), { winners: o.winners || [], final: o.final, round: o.round || practiceRound, practice: !o.rows, key: o.celebrationKey || `practice-${practiceRound}` });
  $('resMse').textContent = fmt(o.mse, 3);
  $('resBest').textContent = fmt(o.bestMse, 3);
  const top = Math.max(o.mse || 0, o.bestMse || 0) || 1;   // 우리 오차를 막대 전체로, 최적은 그 비율
  $('barOurs').style.width = `${Math.max(2, ((o.mse || 0) / top) * 100)}%`;
  $('barBest').style.width = `${Math.max(2, ((o.bestMse || 0) / top) * 100)}%`;
  $('resEq').textContent = o.line ? eqOf(o.line) : '–';
  $('resBestEq').textContent = eqOf(o.best);
  const tb = $('resTable');
  tb.replaceChildren();
  tb.hidden = !o.rows;
  if (o.rows) for (const r of o.rows) tb.appendChild(rankRow(r));
  $('resStatus').textContent = o.status || '';
  const box = $('resActions');
  box.replaceChildren();
  for (const [label, fn, primary] of o.actions || []) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `btn${primary ? ' primary' : ''}`; b.textContent = label; b.addEventListener('click', fn);
    box.appendChild(b);
  }
  show('scrResult');
  drawMap($('cvResult'), { pts: play.pts, line: o.line, best: o.best, residuals: !!o.line });
  requestAnimationFrame(() => drawMap($('cvResult'), { pts: play.pts, line: o.line, best: o.best, residuals: !!o.line }));
}

// 순위 한 줄: { rank, team, mse, pts, total, mine, none }
function rankRow(r) {
  const li = document.createElement('li');
  if (r.mine) li.className = 'mine';
  li.dataset.team = r.team;
  if (r.none) li.classList.add('none');
  const cell = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; li.appendChild(s); };
  cell('r', r.rank ? `${r.rank}위` : '–');
  cell('t', teamName(r.team) + (r.mine ? ' (우리)' : ''));
  cell('m', r.none ? '이번 판 없음' : [r.sub, r.mse !== undefined ? `오차 ${fmt(r.mse, 3)}` : ''].filter(Boolean).join(' · '));
  cell('p', r.total !== undefined ? `${r.total}점` : r.pts !== undefined ? `+${r.pts}점` : '');
  if (r.move) {   // 누적 순위 변화 (화살표 + 글자, 색만으로 구분하지 않음)
    const mv = document.createElement('span');
    mv.className = `mv ${r.move > 0 ? 'up' : 'down'}`;
    mv.textContent = r.move > 0 ? `▲${r.move}` : `▼${-r.move}`;
    mv.setAttribute('aria-label', r.move > 0 ? `${r.move}계단 오름` : `${-r.move}계단 내려감`);
    li.querySelector('.r').appendChild(mv);
  }
  return li;
}

// 판별 결과 → 누적 점수
function totals(results) {
  const tot = Object.fromEntries(E.TEAMS.map((t) => [t, 0]));
  for (const rr of Object.values(results || {})) for (const t of E.TEAMS) if (rr[t]) tot[t] += rr[t].pts || 0;
  return tot;
}

// ════════════════════════════════════════
// 학생
// ════════════════════════════════════════
const me = { code: null, team: null, name: null, joined: false, meta: null, players: {}, results: {}, stats: {}, round: 0, shownState: '' };

let teamPick = null, joinMeta = null;
// 팀 버튼 격자 (참가 화면·대기 화면 공용). selfUid 를 주면 내 자리는 빼고 셈
function renderTeamGrid(grid, players, meta, selected, selfUid) {
  grid.replaceChildren();
  const teams = activeTeams(meta), cap = teamCap(meta);
  const counts = Object.fromEntries(E.TEAMS.map((t) => [t, 0]));
  for (const [u, p] of Object.entries(players || {})) if (u !== selfUid && counts[p.team] !== undefined) counts[p.team]++;
  grid.dataset.n = teams.length;
  for (const t of teams) {
    const n = counts[t] + (selfUid && t === selected ? 1 : 0);
    const full = counts[t] >= cap && t !== selected;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'team-btn'; b.dataset.team = t;
    b.disabled = full;
    b.setAttribute('aria-pressed', String(selected === t));
    b.innerHTML = `<span class="tb-name"></span><small></small>`;
    b.firstChild.textContent = teamName(t);
    b.lastChild.textContent = full ? '가득 참' : `${n}/${cap}명`;
    b.setAttribute('aria-label', `${teamName(t)}, ${n}명${full ? ', 가득 참' : ''}${selected === t ? ', 고른 팀' : ''}`);
    grid.appendChild(b);
  }
}
$('teamGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.team-btn');
  if (!b || b.disabled) return;
  teamPick = b.dataset.team;
  for (const x of $('teamGrid').children) x.setAttribute('aria-pressed', String(x === b));
});

let codeCheckSeq = 0;
async function checkCode() {
  const code = $('inCode').value.replace(/\D/g, '').slice(0, 4);
  if ($('inCode').value !== code) $('inCode').value = code;
  const seq = ++codeCheckSeq;
  $('teamPick').disabled = true;
  if (code.length < 4) { $('teamPickNote').textContent = '방 코드를 먼저 입력하세요'; $('teamGrid').replaceChildren(); return; }
  $('teamPickNote').textContent = '방을 찾는 중…';
  try {
    const st = await getStore();
    const [meta, players] = await Promise.all([st.get(`${ROOT}/${code}/meta`), st.get(`${ROOT}/${code}/players`)]);
    if (seq !== codeCheckSeq) return;
    if (!meta) { $('teamPickNote').textContent = '그런 방이 없어요. 코드를 확인하세요.'; $('teamGrid').replaceChildren(); return; }
    if (meta.state === 'final') { $('teamPickNote').textContent = '이미 끝난 게임이에요.'; $('teamGrid').replaceChildren(); return; }
    joinMeta = meta;
    if (teamPick && !activeTeams(meta).includes(teamPick)) teamPick = null;
    $('teamPickNote').textContent = `${teamCount(meta)}팀 · 팀당 최대 ${teamCap(meta)}명` + (meta.state === 'lobby' ? '' : ' (게임 진행 중 · 들어가면 바로 함께해요)');
    $('teamPick').disabled = false;
    renderTeamGrid($('teamGrid'), players, meta, teamPick);
  } catch (e) {
    if (seq === codeCheckSeq) { $('teamPickNote').textContent = ''; $('joinErr').textContent = errMsg(e); }
  }
}
$('inCode').addEventListener('input', () => { $('joinErr').textContent = ''; checkCode(); });

$('joinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('inCode').value.trim(), name = $('inName').value.trim().replace(/\s+/g, ' ');
  const err = (m) => { $('joinErr').textContent = m; };
  if (!/^\d{4}$/.test(code)) return err('방 코드는 숫자 4자리예요.');
  if (!name) { $('inName').focus(); return err('이름을 입력하세요.'); }
  if (name.length > 10) return err('이름은 10자 이내로 써 주세요.');
  if (!teamPick) return err('팀을 고르세요.');
  $('btnJoin').disabled = true;
  try {
    await joinRoom(code, name, teamPick);
  } catch (ex) {
    err(errMsg(ex));
  } finally { $('btnJoin').disabled = false; }
});

async function joinRoom(code, name, team, resume) {
  const st = await getStore();
  const meta = await st.get(`${ROOT}/${code}/meta`);
  if (!meta) throw new Error('방이 없거나 닫혔어요.');
  if (meta.state === 'final' && !resume) throw new Error('이미 끝난 게임이에요.');
  if (!resume) {
    const players = (await st.get(`${ROOT}/${code}/players`)) || {};
    if (!activeTeams(meta).includes(team)) { renderTeamGrid($('teamGrid'), players, meta, null); throw new Error(`이번 게임은 ${teamCount(meta)}팀까지예요. 다른 팀을 고르세요.`); }
    const n = Object.entries(players).filter(([u, p]) => p.team === team && u !== st.uid).length;
    if (n >= teamCap(meta)) { renderTeamGrid($('teamGrid'), players, meta, null); throw new Error(`${teamName(team)}은 가득 찼어요. 다른 팀을 고르세요.`); }
  }
  Object.assign(me, { code, team, name, joined: true, meta: null, players: {}, results: {}, stats: {}, round: 0, shownState: '', serverLine: null });
  await writeMe(st);
  saveSession({ role: 'player', code, team, name });
  enterPlayer(st);
}

async function writeMe(st) {
  await st.set(`${ROOT}/${me.code}/players/${st.uid}`, { name: me.name, team: me.team, at: st.now() });
  st.dropOnLeave(`${ROOT}/${me.code}/players/${st.uid}`);
  st.dropOnLeave(`${ROOT}/${me.code}/teams/${me.team}/pos/${st.uid}`);
}

// 끊겼다 다시 연결되면 내 자리를 다시 씀 (끊길 때 onDisconnect로 지워지므로)
async function onReconnect() {
  if (!me.joined || !me.meta) return;
  try { const st = await getStore(); await writeMe(st); play.sent = ''; } catch (e) { /* 다음 연결 때 다시 */ }
}

function enterPlayer(st) {
  clearSubs();
  const base = `${ROOT}/${me.code}`;
  $('waitRoom').textContent = `방 ${me.code}`;
  $('waitTeam').textContent = `${teamName(me.team)} · ${me.name}`;
  setTeamBadge($('waitBadge'), me.team);
  $('waitMembers').dataset.team = me.team;
  show('scrWait');
  addSub(st.on(`${base}/meta`, (m) => onPlayerMeta(st, m)));
  addSub(st.on(`${base}/players`, (p) => {
    me.players = p || {};
    if (me.joined && me.meta && !me.players[st.uid]) {   // 끊김 등으로 지워졌으면 다시 (방이 닫힌 경우는 빼고)
      st.get(`${base}/meta`).then((m) => { if (m && me.joined) return writeMe(st); }).catch(() => {});
    }
    renderMembers(st);
    renderWaitSwitch(st);
  }));
  addSub(st.on(`${base}/stats`, (s) => { me.stats = s || {}; if (me.meta && me.meta.state === 'final') showPlayerResult(st); refreshPresenter(); }));
  addSub(st.on(`${base}/results`, (r) => { me.results = r || {}; if (me.meta && (me.meta.state === 'reveal' || me.meta.state === 'final')) showPlayerResult(st); refreshPresenter(); }));
  addSub(st.on(`${base}/teams/${me.team}/line`, (L) => {
    if (!L) return;
    me.serverLine = { th: L.th, d: L.d, n: L.n || 0 };   // n: 이번 판 팀 명중 수
    if (play.mode !== 'online') return;
    play.line = { ...me.serverLine };
    if (!play.shown) play.shown = { ...play.line };
  }));
  addSub(st.on(`${base}/teams/${me.team}/pos`, (pos) => {
    pos = pos || {};
    for (const u of [...play.mates.keys()]) if (!pos[u] || u === st.uid) play.mates.delete(u);
    for (const [u, v] of Object.entries(pos)) {
      if (u === st.uid || !v) continue;
      const m = play.mates.get(u);
      const label = (me.players[u] && me.players[u].name) || '';
      if (m) Object.assign(m, { s: v.s, a: v.a || 0, label });
      else play.mates.set(u, { s: v.s, a: v.a || 0, shownS: v.s, shownA: v.a || 0, label });
    }
  }));
  addSub(st.onAdded(`${base}/teams/${me.team}/shots`, (k, v) => {
    if (!v || v.u === st.uid) return;
    const age = (st.now() - v.at) / 1000;
    if (age > 1.2 || age < -2) return;
    const a = Math.max(0, age);
    play.shots.push({ k: v.k, x: v.x + v.vx * a, y: v.y + v.vy * a, vx: v.vx, vy: v.vy, p: v.p || 1, age: a });
  }));
}

function renderMembers(st) {
  const ul = $('waitMembers');
  ul.replaceChildren();
  for (const [u, p] of Object.entries(me.players)) {
    if (p.team !== me.team) continue;
    const li = document.createElement('li');
    if (u === st.uid) li.className = 'me';
    const av = document.createElement('span'); av.className = 'av'; av.setAttribute('aria-hidden', 'true');
    av.textContent = Array.from(String(p.name).trim())[0] || '?';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.name; if (u === st.uid) li.setAttribute('aria-label', `${p.name} (나)`);
    li.append(av, nm);
    ul.appendChild(li);
  }
}

// 대기 화면 팀 바꾸기: 시작 전(lobby)에만, 또는 교사가 팀 수를 줄여 내 팀이 없어졌을 때
function renderWaitSwitch(st) {
  const m = me.meta, box = $('waitSwitch');
  if (!m || !me.joined) { box.hidden = true; return; }
  const lost = !activeTeams(m).includes(me.team);
  box.hidden = !(m.state === 'lobby' || lost);
  if (box.hidden) return;
  box.classList.toggle('warn', lost);
  $('waitSwitchTitle').innerHTML = lost ? '선생님이 팀 수를 바꿨어요. <b>팀을 다시 골라 주세요!</b>' : '팀 바꾸기 <small>시작 전까지 바꿀 수 있어요</small>';
  renderTeamGrid($('waitTeamGrid'), me.players, m, lost ? null : me.team, st.uid);
}
$('waitTeamGrid').addEventListener('click', async (e) => {
  const b = e.target.closest('.team-btn');
  if (!b || b.disabled || !me.joined) return;
  const t = b.dataset.team;
  if (t === me.team) return;
  try {
    const st = await getStore();
    const n = Object.entries(me.players).filter(([u, p]) => p.team === t && u !== st.uid).length;
    if (n >= teamCap(me.meta)) { toast(`${teamName(t)}은 가득 찼어요.`, 'error'); return; }
    st.remove(`${ROOT}/${me.code}/teams/${me.team}/pos/${st.uid}`).catch(() => {});
    me.team = t; me.serverLine = null;
    await writeMe(st);
    saveSession({ role: 'player', code: me.code, team: t, name: me.name });
    enterPlayer(st);   // 팀별 구독(직선·위치·포탄)을 새 팀으로
    toast(`${teamName(t)}으로 옮겼어요.`);
  } catch (ex) { toast(errMsg(ex), 'error'); }
});

function onPlayerMeta(st, m) {
  if (!m) { leaveRoom(true); toast('방이 닫혔어요.', 'error'); return; }
  const prevRound = me.meta ? me.meta.round : -1;
  me.meta = m;
  renderWaitSwitch(st);
  if (m.state === 'lobby') { $('waitStatus').textContent = '선생님이 게임을 시작하면 바로 맵이 열려요.'; show('scrWait'); return; }
  if (m.state === 'playing') {
    const rd = E.makeRound(m.seed, m.round);
    if (m.round !== prevRound || play.mode !== 'online' || $('scrPlay').hidden) {
      const s0 = ((hash(st.uid) % 8) * 50 + 25) % E.PER;   // 팀원끼리 처음 자리가 겹치지 않게
      // 직선은 서버 값 우선 (판 중간에 들어와도 지금 모양 그대로). 새 판이면 곧 시작 직선이 다시 도착함
      resetPlay('online', rd, me.serverLine || rd.start, play.mode === 'online' && m.round === me.round ? play.s : s0);
      me.round = m.round; play.round = m.round;
      play.now = () => st.now();
      play.onOp = (op) => {
        // 서버의 최신 직선·쌓인 힘 위에 내 힘을 더함 (동시에 맞힌 팀원 힘과 합쳐짐)
        st.tx(`${ROOT}/${me.code}/teams/${me.team}/line`, (cur) => {
          const base = cur && typeof cur.th === 'number' ? cur : rd.start;
          return E.hitLine(base, op);   // 서버 값 위에 더함 (동시에 맞혀도 모두 반영)
        }).catch((e) => { if (isActive()) toast(errMsg(e), 'error'); });   // 판이 막 끝난 뒤 맞은 포탄은 규칙이 막음: 조용히 무시
      };
      play.onShot = (s) => {
        try {
          st.push(`${ROOT}/${me.code}/teams/${me.team}/shots`, { u: st.uid, k: s.k, x: +s.x.toFixed(2), y: +s.y.toFixed(2), vx: +s.vx.toFixed(2), vy: +s.vy.toFixed(2), p: s.p, at: st.now() });
        } catch (e) { /* 팀원 화면 효과만 빠짐 */ }
      };
      play.onPos = (s, a) => { st.set(`${ROOT}/${me.code}/teams/${me.team}/pos/${st.uid}`, { s: +s.toFixed(1), a: +a.toFixed(2) }).catch(() => {}); };
      const roundNo = m.round;
      play.onEnd = () => {   // 개인 기록(명중·줄인 오차)은 판이 끝날 때 한 번만 저장 → 최종 결과의 MVP
        st.set(`${ROOT}/${me.code}/stats/r${roundNo}/${st.uid}`, { t: me.team, n: me.name, h: play.stat.h, g: +play.stat.g.toFixed(4) }).catch(() => {});
      };
      play.onPos(play.s, play.a);
      $('btnPracticeEnd').hidden = true;
      $('hudTeam').textContent = `${teamName(me.team)} · ${me.name}`;
      setTeamBadge($('hudBadge'), me.team);
      play.meColor = teamColor(me.team);
    }
    play.startAt = m.startAt; play.endsAt = m.endsAt;
    $('hudRound').textContent = `${m.round} / ${m.rounds}판`;
    if ($('scrPlay').hidden) { show('scrPlay'); }
    startPlayLoop();
    return;
  }
  if (m.state === 'reveal' || m.state === 'final') {
    if (m.round && (play.mode !== 'online' || !play.pts.length)) { play.pts = E.makeRound(m.seed, m.round).pts; }
    showPlayerResult(st);
  }
}

function showPlayerResult(st) {
  const m = me.meta;
  if (!m || !m.round) { show('scrWait'); return; }
  const rr = me.results[`r${m.round}`];
  if (!rr) { $('waitStatus').textContent = '오차를 세는 중…'; show('scrWait'); return; }
  const rdNow = E.makeRound(m.seed, m.round);
  const pts = rdNow.pts;
  play.pts = pts;
  const best = E.bestFit(pts);
  const mine = rr[me.team];
  const final = m.state === 'final';
  const st8 = standings(me.results, m.round, playedTeams(me.results, me.team));
  const myRow = st8.find((r) => r.team === me.team) || { rank: '–', move: 0, total: 0 };
  const rows = st8.map((r) => ({ team: r.team, rank: r.rank, move: final ? 0 : r.move, total: r.total, mine: r.team === me.team,
    mse: !final && rr[r.team] ? rr[r.team].mse : undefined, sub: !final && rr[r.team] ? `이번 판 ${rr[r.team].rank}위` : undefined, none: !final && !rr[r.team] }));
  const L = (mine && mine.line) || play.line || best;
  let title, status;
  const mv = mvpOf(me.stats);
  if (final) {
    title = `최종 결과 · ${teamName(me.team)} ${myRow.rank}위 (${myRow.total}점)`;
    const tm = mv.byTeam[me.team];
    status = [tm ? [`우리 팀 MVP: ${tm.n}`, mvpDesc(tm)].filter(Boolean).join(' · ') : '', mv.top ? `전체 MVP: ${mv.top.n} (${teamName(mv.top.t)})` : ''].filter(Boolean).join('  ·  ') || '수고했어요!';
  } else {
    const comeback = myRow.rank === 1 && myRow.move > 0;
    title = mine ? `${m.round}판 · 이번 판 ${mine.rank}위 (+${mine.pts}점) · 누적 ${myRow.rank}위${comeback ? ' 역전!' : ''}` : `${m.round}판 결과`;
    status = rdNow.type.name;
    if (comeback || myRow.move > 0) sfx.rankUp(); else sfx.reveal();
  }
  fillResult({
    title, winners: final ? st8.filter(r => r.rank === 1).map(r => r.team) : E.TEAMS.filter(t => rr[t]?.rank === 1), final, round: m.round, celebrationKey: `${me.code}-${m.round}-${m.state}`, line: L, best, mse: mine ? mine.mse : E.mse(pts, L), bestMse: rr.best, rows, status,
    actions: [['모든 팀 결과 보기', () => openPresenter({ results: () => me.results, meta: () => me.meta, stats: () => me.stats, mine: me.team }), true], ['나가기', () => leaveRoom(false)]],
  });
  startNextCountdown(() => me.meta, () => st.now(), $('resNext'));
}

// 결과에 한 번이라도 나온 팀 (+ 우리 팀)
function playedTeams(results, mineTeam) {
  return E.TEAMS.filter((t) => t === mineTeam || Object.values(results || {}).some((x) => x && x[t]));
}
// 누적 순위: n판까지 합계, 직전 판 대비 순위 변화(move > 0 이면 오름)
function standings(results, n, teams) {
  const sum = (k) => { const tot = Object.fromEntries(teams.map((t) => [t, 0])); for (let i = 1; i <= k; i++) { const rr = results[`r${i}`]; if (rr) for (const t of teams) if (rr[t]) tot[t] += rr[t].pts || 0; } return tot; };
  const rankOf = (tot) => {
    const order = [...teams].sort((a, b) => tot[b] - tot[a] || +a.slice(1) - +b.slice(1));
    const rk = {};
    order.forEach((t, i) => { rk[t] = i > 0 && tot[order[i - 1]] === tot[t] ? rk[order[i - 1]] : i + 1; });
    return { order, rk };
  };
  const now = sum(n), prev = sum(n - 1), A = rankOf(now), B = rankOf(prev);
  return A.order.map((t) => ({ team: t, total: now[t], rank: A.rk[t], move: n > 1 ? B.rk[t] - A.rk[t] : 0 }));
}
const mvpDesc = (q) => (q.g > 0.05 ? `좋은 방향으로 민 힘 ${fmt(q.g, 1)}` : '');
// MVP: 판마다 저장된 개인 기록(stats/r{n}/{uid} = {t, n, h, g})을 모아 좋은 방향으로 민 힘(g)이 가장 큰 사람
function mvpOf(stats) {
  const per = {};
  for (const rs of Object.values(stats || {})) for (const [u, s] of Object.entries(rs || {})) {
    const q = per[u] || (per[u] = { n: s.n, t: s.t, h: 0, g: 0 });
    q.h += s.h || 0; q.g += s.g || 0; if (s.n) q.n = s.n; if (s.t) q.t = s.t;
  }
  const list = Object.values(per).filter((q) => q.h > 0);
  const byTeam = {};
  for (const q of list) if (!byTeam[q.t] || q.g > byTeam[q.t].g) byTeam[q.t] = q;
  const top = list.reduce((a, q) => (!a || q.g > a.g ? q : a), null);
  return { byTeam, top };
}
// 판 사이 자동 진행: "다음 판까지 n초"
let nextTimer = 0;
function startNextCountdown(getMeta, now, el) {
  clearInterval(nextTimer);
  const tick = () => {
    const m = getMeta();
    if (!m || m.state !== 'reveal' || !m.auto || !m.nextAt || m.round >= m.rounds) { el.textContent = m && m.state === 'reveal' && m.round >= m.rounds ? '마지막 판이 끝났어요. 최종 결과를 기다려요.' : (m && m.state === 'reveal' ? '다음 판을 기다리는 중…' : ''); return; }
    const s = Math.max(0, Math.ceil((m.nextAt - now()) / 1000));
    el.textContent = `다음 판(${m.round + 1}판 · ${E.roundType(m.round + 1).name})까지 ${s}초`;
  };
  tick();
  nextTimer = setInterval(tick, 250);
}

async function leaveRoom(closed) {
  stopPlayLoop();
  clearSubs();
  if (!closed && me.joined) {
    try { const st = await getStore(); await st.remove(`${ROOT}/${me.code}/players/${st.uid}`); await st.remove(`${ROOT}/${me.code}/teams/${me.team}/pos/${st.uid}`); } catch (e) { /* 연결 끊김: onDisconnect가 지움 */ }
  }
  Object.assign(me, { joined: false, meta: null, code: null });
  play.mode = null; play.mates.clear();
  saveSession(null);
  goHome();
}
$('btnLeave').addEventListener('click', () => leaveRoom(false));

// ════════════════════════════════════════
// 교사
// ════════════════════════════════════════
const host = { code: null, meta: null, players: {}, results: {}, stats: {}, teams: {}, raf: 0, timer: 0, finalizing: false, last: 0, lastTimer: '' };

$('btnHost').addEventListener('click', async () => {
  const btn = $('btnHost');
  btn.disabled = true;
  try {
    const st = await getStore();
    let code = null;
    for (let i = 0; i < 8 && !code; i++) {
      const c = String(1000 + Math.floor(Math.random() * 9000));
      if (!(await st.get(`${ROOT}/${c}/meta`))) code = c;
    }
    if (!code) throw new Error('빈 방 코드를 찾지 못했어요. 다시 눌러 주세요.');
    const meta = { state: 'lobby', round: 0, auto: $('chkAuto').checked, nextAt: 0, teams: +$('selTeams').value, rounds: +$('selRounds').value, duration: +$('selTime').value, seed: (Math.random() * 1e9) >>> 0, hostUid: st.uid, createdAt: st.now(), startAt: 0, endsAt: 0 };
    await st.set(`${ROOT}/${code}/meta`, meta);
    saveSession({ role: 'host', code });
    enterHost(st, code);
  } catch (e) { toast(errMsg(e), 'error'); } finally { btn.disabled = false; }
});

// ── 참가 QR (긴 주소를 치지 않게). 라이브러리는 교사 화면에서만 불러옴 ──
const QR_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
let qrLib = null;
function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!qrLib) {
    qrLib = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = QR_SRC; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (window.qrcode ? res(window.qrcode) : rej(new Error('QR 라이브러리 없음')));
      s.onerror = () => rej(new Error('QR 라이브러리를 불러오지 못함'));
      document.head.appendChild(s);
      setTimeout(() => rej(new Error('QR 라이브러리 응답 없음')), 10000);
    }).catch((e) => { qrLib = null; throw e; });
  }
  return qrLib;
}
async function drawQr(el, text) {
  try {
    const q = (await loadQr())(0, 'M');
    q.addData(text); q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });   // 라이브러리가 만든 SVG(사각형 경로만)
    const svg = el.querySelector('svg');
    if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '참가 화면으로 가는 QR 코드'); }
    el.classList.remove('qr-fail');
    return true;
  } catch (e) {
    el.textContent = 'QR을 불러오지 못했어요 (인터넷 연결 확인). 아래 참가 방법을 안내해 주세요.';
    el.classList.add('qr-fail');
    return false;
  }
}
function openQrModal() {
  if (!host.joinUrl) return;
  $('qrCode').textContent = host.code;
  $('qrModal').hidden = false;
  drawQr($('qrBig'), host.joinUrl);
  $('qrClose').focus();
}
function closeQrModal() { if (!$('qrModal').hidden) { $('qrModal').hidden = true; $('qrBtn').focus(); } }
$('qrBtn').addEventListener('click', openQrModal);
$('qrClose').addEventListener('click', closeQrModal);
$('qrModal').addEventListener('click', (e) => { if (e.target === $('qrModal')) closeQrModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeQrModal(); });
$('btnCopyLink').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(host.joinUrl); toast('참가 주소를 복사했어요. 메신저 등에 붙여 넣어 보내세요.'); }
  catch (e) { toast(`복사하지 못했어요. 주소: ${host.joinUrl}`, 'error'); }
});

function buildTeamCards() {
  const box = $('teamCards');
  box.replaceChildren();
  for (const t of E.TEAMS) {
    const card = document.createElement('section');
    card.className = 'team-card'; card.id = `card-${t}`; card.dataset.team = t;
    card.innerHTML = '<h3><span class="team-badge" aria-hidden="true"></span><span class="tn"></span><small></small></h3><canvas class="map-canvas" role="img"></canvas><div class="names"></div><div class="res"></div>';
    card.querySelector('.team-badge').textContent = t.slice(1);
    card.querySelector('.tn').textContent = teamName(t);
    card.querySelector('canvas').setAttribute('aria-label', `${teamName(t)} 맵`);
    box.appendChild(card);
    host.teams[t] = { line: null, shown: null, pos: {}, shown_pos: {}, shots: [], fx: [], card, cv: card.querySelector('canvas') };
  }
}

function enterHost(st, code) {
  clearSubs();
  Object.assign(host, { code, meta: null, players: {}, results: {}, stats: {}, teams: {}, finalizing: false });
  buildTeamCards();
  $('hostCode').textContent = code;
  const url = new URL(location.href);
  url.search = ''; url.searchParams.set('room', code); if (FAKE) url.searchParams.set('fake', '1');
  url.hash = '';
  host.joinUrl = url.href;
  $('hostLink').textContent = url.href.replace(/^https?:\/\//, '');
  $('hostQr').replaceChildren(); $('hostQr').classList.remove('qr-fail');
  drawQr($('hostQr'), host.joinUrl);
  show('scrHost');
  const base = `${ROOT}/${code}`;
  addSub(st.on(`${base}/meta`, (m) => {
    if (!m) { toast('방이 닫혔어요.'); stopHostLoop(); clearSubs(); saveSession(null); goHome(); return; }
    if (host.meta && host.meta.state === 'playing' && m.state === 'reveal') sfx.reveal();
    host.meta = m;
    if (m.state === 'playing') host.finalizing = false;
    renderHost();
  }));
  addSub(st.on(`${base}/players`, (p) => { host.players = p || {}; renderHost(); }));
  addSub(st.on(`${base}/results`, (r) => { host.results = r || {}; renderHost(); refreshPresenter(); }));
  addSub(st.on(`${base}/stats`, (s) => { host.stats = s || {}; renderHost(); refreshPresenter(); }));
  for (const t of E.TEAMS) {
    const T = host.teams[t];
    addSub(st.on(`${base}/teams/${t}/line`, (L) => { T.line = L ? { th: L.th, d: L.d, n: L.n || 0 } : null; if (L && !T.shown) T.shown = { ...T.line }; }));
    addSub(st.on(`${base}/teams/${t}/pos`, (pos) => {
      T.pos = pos || {};
      for (const u of Object.keys(T.shown_pos)) if (!T.pos[u]) delete T.shown_pos[u];
      for (const [u, v] of Object.entries(T.pos)) if (!T.shown_pos[u]) T.shown_pos[u] = { s: v.s, a: v.a || 0 };
    }));
    addSub(st.onAdded(`${base}/teams/${t}/shots`, (k, v) => {
      if (!v) return;
      const age = (st.now() - v.at) / 1000;
      if (age > 1.2 || age < -2) return;
      const a = Math.max(0, age);
      T.shots.push({ k: v.k, x: v.x + v.vx * a, y: v.y + v.vy * a, vx: v.vx, vy: v.vy, age: a });
    }));
  }
  host.store = st;
  startHostLoop();
}

function teamCounts() {
  const c = Object.fromEntries(E.TEAMS.map((t) => [t, []]));
  for (const p of Object.values(host.players)) if (c[p.team]) c[p.team].push(p.name);
  return c;
}

function renderHost() {
  const m = host.meta;
  if (!m) return;
  const counts = teamCounts();
  const total = Object.values(counts).reduce((a, l) => a + l.length, 0);
  const act = activeTeams(m);
  const stray = E.TEAMS.filter((t) => !act.includes(t)).reduce((a, t) => a + counts[t].length, 0);   // 없어진 팀에 남은 학생
  $('hostCount').textContent = `참가 ${total}명 · 팀당 최대 ${teamCap(m)}명` + (stray ? ` · 팀을 다시 골라야 하는 학생 ${stray}명` : '');
  $('hostCount').classList.toggle('warn', stray > 0);
  const lobby = m.state === 'lobby', playing = m.state === 'playing', reveal = m.state === 'reveal', final = m.state === 'final';
  $('selTeams').disabled = !lobby; $('selRounds').disabled = !lobby; $('selTime').disabled = !lobby;
  if (lobby) { $('selTeams').value = String(teamCount(m)); $('selRounds').value = String(m.rounds); $('selTime').value = String(m.duration); }
  $('teamCards').dataset.n = act.length;
  $('hostRound').textContent = lobby ? '대기 중' : `${m.round} / ${m.rounds}판 · ${E.roundType(m.round).name}${final ? ' · 끝' : ''}`;
  $('chkAuto').checked = m.auto !== false;
  const btn = $('btnStart');
  btn.hidden = playing || final || (reveal && m.round >= m.rounds);
  btn.textContent = `${m.round + 1}판 시작`;
  btn.disabled = total === 0 || stray > 0;
  btn.title = stray ? '없어진 팀에 있는 학생이 팀을 다시 고르면 시작할 수 있어요' : '';
  $('btnEndNow').hidden = !playing;
  $('btnFinal').hidden = !(reveal && m.round >= m.rounds);
  $('btnPresent').hidden = !(reveal || final) || !Object.keys(host.results).length;

  const rr = host.results[`r${m.round}`];
  const tot = totals(host.results);
  for (const t of E.TEAMS) {
    const T = host.teams[t], names = counts[t];
    T.card.hidden = !act.includes(t);
    T.card.querySelector('h3 small').textContent = `${names.length}명`;
    T.card.querySelector('.names').textContent = names.join(', ') || '아직 없음';
    T.card.classList.toggle('empty', names.length === 0 && !lobby);
    let res = '';
    if (final) res = `누적 ${tot[t]}점`;
    else if (reveal && rr) res = rr[t] ? `${rr[t].rank}위 · 오차 ${fmt(rr[t].mse, 3)} · +${rr[t].pts}점` : '참가자 없음';
    T.card.querySelector('.res').textContent = res;
    T.card.classList.toggle('first', !!(reveal && rr && rr[t] && rr[t].rank === 1));
    T.cv.hidden = lobby;
  }
  // 순위표: 판마다 누적 순위(▲▼ 변화), 최종엔 MVP
  const box = $('hostRankBox');
  box.hidden = !(reveal || final);
  if (reveal || final) {
    const ol = $('hostRank');
    ol.replaceChildren();
    const teams = playedTeams(host.results, null);
    renderCelebration($('hostCelebration'), { winners: final ? standings(host.results, m.round, teams).filter(r => r.rank === 1).map(r => r.team) : E.TEAMS.filter(t => rr?.[t]?.rank === 1), final, round: m.round, key: `${host.code}-${m.round}-${m.state}` });
    if (final) {
      $('hostRankTitle').textContent = `최종 순위 · ${m.round}판 순위 점수 합`;
      standings(host.results, m.round, teams).forEach((r) => ol.appendChild(rankRow({ rank: r.rank, team: r.team, total: r.total })));
      const mv = mvpOf(host.stats);
      $('hostMvp').hidden = !mv.top;
      if (mv.top) {
        $('hostMvp').textContent = `전체 MVP: ${mv.top.n} (${[teamName(mv.top.t), mvpDesc(mv.top)].filter(Boolean).join(' · ')})  ·  팀별 MVP: ` +
          teams.filter((x) => mv.byTeam[x]).map((x) => `${teamName(x)} ${mv.byTeam[x].n}`).join(', ');
      }
    } else if (rr) {
      $('hostMvp').hidden = true;
      $('hostRankTitle').textContent = `${m.round}판 끝 · 누적 순위 (이번 판 최적 오차 ${fmt(rr.best, 3)})`;
      standings(host.results, m.round, teams).forEach((r) => ol.appendChild(rankRow({
        rank: r.rank, team: r.team, total: r.total, move: r.move,
        sub: rr[r.team] ? `이번 판 ${rr[r.team].rank}위` : undefined, mse: rr[r.team] ? rr[r.team].mse : undefined, none: !rr[r.team],
      })));
    } else { $('hostMvp').hidden = true; $('hostRankTitle').textContent = '오차를 세는 중…'; }
  }
}

function hostFrame(t) {
  host.raf = requestAnimationFrame(hostFrame);
  if (t - host.last < 33) return;   // 교사 화면은 30fps면 충분
  const dt = Math.min(0.1, (t - (host.last || t)) / 1000);
  host.last = t;
  const m = host.meta, st = host.store;
  if (!m || !st) return;
  const now = st.now();
  const nextS = m.state === 'reveal' && m.auto && m.nextAt && m.round < m.rounds ? Math.max(0, Math.ceil((m.nextAt - now) / 1000)) : null;
  const timer = m.state === 'playing' ? (now < m.startAt ? `시작 ${Math.ceil((m.startAt - now) / 1000)}` : `${Math.ceil(Math.max(0, m.endsAt - now) / 1000)}초`) : nextS !== null ? `다음 판 ${nextS}` : '';
  if (timer !== host.lastTimer) {
    // 교사 화면(프로젝터) 소리: 3·2·1, 시작, 마지막 3초, 끝
    if (m.state === 'playing') {
      if (now < m.startAt && /^시작 [123]$/.test(timer)) sfx.count();
      else if (/^시작/.test(host.lastTimer) && now >= m.startAt) sfx.go();
      else if (now >= m.startAt && /^[123]초$/.test(timer)) sfx.tick();
      else if (timer === '0초') sfx.end();
    }
    host.lastTimer = timer; $('hostTimer').textContent = timer;
    $('hostTimer').classList.toggle('low', m.state === 'playing' && m.endsAt - now <= 3000 && now >= m.startAt);
  }
  $('hostTimeFill').parentElement.hidden = m.state !== 'playing';
  if (m.state === 'playing') setBar($('hostTimeFill'), now < m.startAt ? 1 : (m.endsAt - now) / Math.max(1, m.endsAt - m.startAt));
  if (m.state === 'lobby' || !m.round || isPresenterOpen()) return;   // 발표 화면이 덮고 있으면 작은 맵은 쉼
  const rd = host.rd && host.rd.key === `${m.seed}:${m.round}` ? host.rd : (host.rd = { key: `${m.seed}:${m.round}`, ...E.makeRound(m.seed, m.round), best: null });
  if (!rd.best) rd.best = E.bestFit(rd.pts);
  const showResult = m.state === 'reveal' || m.state === 'final';
  for (const tm of E.TEAMS) {
    const T = host.teams[tm];
    if (T.card.hidden) continue;
    if (T.line) {
      if (!T.shown) T.shown = { ...T.line };
      const f = Math.min(1, dt * 12);
      T.shown.th += (T.line.th - T.shown.th) * f; T.shown.d += (T.line.d - T.shown.d) * f;
    }
    for (const [u, v] of Object.entries(T.pos)) {
      const sp = T.shown_pos[u]; if (!sp) continue;
      const diff = ((v.s - sp.s) % E.PER + E.PER * 1.5) % E.PER - E.PER / 2;
      sp.s = E.wrapS(sp.s + diff * Math.min(1, dt * 10)); sp.a += ((v.a || 0) - sp.a) * Math.min(1, dt * 10);
    }
    for (let i = T.shots.length - 1; i >= 0; i--) {
      const p = T.shots[i];
      p.age += dt;
      const r = T.shown ? E.stepShot(p, T.shown, dt) : { out: true };
      if (r.hit) { T.fx.push({ x: r.hit.x, y: r.hit.y, k: p.k, age: 0, vx: p.vx, vy: p.vy, dx: p.k === 'w' ? Math.sign(p.vx) * E.WIND_SHIFT * (p.p || 1) : 0, seed: i }); T.shots.splice(i, 1); } else if (r.out) T.shots.splice(i, 1);
    }
    for (let i = T.fx.length - 1; i >= 0; i--) { T.fx[i].age += dt; if (T.fx[i].age > 0.45) T.fx.splice(i, 1); }
    const empty = T.card.classList.contains('empty');   // 참가자 없는 팀은 점만
    drawMap(T.cv, {
      small: true, pts: rd.pts, line: empty ? null : T.shown, best: showResult && !empty ? rd.best : null, residuals: showResult && !empty,
      players: Object.entries(T.shown_pos).map(([id, p]) => ({ id, s: p.s, a: p.a })), shots: T.shots, fx: T.fx,
    });
  }
}
function startHostLoop() {
  if (!host.raf) { host.last = 0; host.raf = requestAnimationFrame(hostFrame); }
  if (!host.timer) host.timer = setInterval(hostTick, 250);   // 화면이 가려져도 판은 끝나게 (rAF는 멈출 수 있음)
}
function stopHostLoop() {
  if (host.raf) cancelAnimationFrame(host.raf);
  if (host.timer) clearInterval(host.timer);
  host.raf = 0; host.timer = 0;
}

const AUTO_GAP = 8000;   // 판 결과를 보여 주는 시간 (자동 진행)
function hostTick() {
  const m = host.meta, st = host.store;
  if (!m || !st) return;
  if (m.state === 'reveal' && m.auto && m.nextAt && m.round < m.rounds && st.now() >= m.nextAt && !isPresenterOpen()) { startRound(); return; }
  if (m.state !== 'playing' || host.finalizing) return;
  if (st.now() >= m.endsAt + 800) finalizeRound();   // 마지막 포탄 반영 여유
}

async function finalizeRound() {
  const st = host.store, m = host.meta;
  host.finalizing = true;
  try {
    const pts = E.makeRound(m.seed, m.round).pts;
    const counts = teamCounts();
    const mses = {};
    for (const t of activeTeams(m)) {
      const L = host.teams[t].line;   // 구독으로 받아 둔 최신 직선 (shots까지 통째로 읽지 않음)
      if (counts[t].length && L) mses[t] = E.mse(pts, L);
    }
    const ranked = E.rankTeams(mses);
    for (const t of Object.keys(ranked)) {   // 발표 화면에서 지난 판도 다시 그릴 수 있게 직선·팀원도 남김
      const L = host.teams[t].line;
      ranked[t].line = { th: +L.th.toFixed(6), d: +L.d.toFixed(4) };
      ranked[t].names = counts[t].slice(0, 40);
    }
    ranked.best = +E.mse(pts, E.bestFit(pts)).toFixed(4);
    const nextAt = m.auto && m.round < m.rounds ? st.now() + AUTO_GAP : 0;   // 자동 진행: 결과를 잠깐 보여 주고 다음 판
    await st.update(`${ROOT}/${host.code}`, { [`results/r${m.round}`]: ranked, 'meta/state': 'reveal', 'meta/nextAt': nextAt });
  } catch (e) {
    host.finalizing = false;   // 다음 틱에 다시 시도
    toast(`채점 저장 실패: ${errMsg(e)} 잠시 후 다시 시도합니다.`, 'error');
  }
}

$('selTeams').addEventListener('change', () => host.store && host.store.update(`${ROOT}/${host.code}/meta`, { teams: +$('selTeams').value }).catch((e) => toast(errMsg(e), 'error')));
$('selRounds').addEventListener('change', () => host.store && host.store.update(`${ROOT}/${host.code}/meta`, { rounds: +$('selRounds').value }).catch((e) => toast(errMsg(e), 'error')));
$('selTime').addEventListener('change', () => host.store && host.store.update(`${ROOT}/${host.code}/meta`, { duration: +$('selTime').value }).catch((e) => toast(errMsg(e), 'error')));

// 판 시작 (버튼 또는 자동 진행). 1판은 조작 안내를 읽을 수 있게 준비 시간을 길게
let starting = false;
async function startRound() {
  const st = host.store, m = host.meta;
  if (!st || !m || starting) return;
  starting = true;
  const btn = $('btnStart');
  btn.disabled = true;
  try {
    const r = m.round + 1, rd = E.makeRound(m.seed, r), now = st.now();
    const lead = r === 1 ? 6000 : 3500;
    const upd = { 'meta/state': 'playing', 'meta/round': r, 'meta/startAt': now + lead, 'meta/endsAt': now + lead + m.duration * 1000, 'meta/nextAt': 0 };
    for (const t of E.TEAMS) { upd[`teams/${t}/line`] = rd.start; upd[`teams/${t}/shots`] = null; }
    for (const T of Object.values(host.teams)) { T.shown = { ...rd.start }; T.shots.length = 0; }
    await st.update(`${ROOT}/${host.code}`, upd);
  } catch (e) { toast(errMsg(e), 'error'); } finally { btn.disabled = false; starting = false; }
}
$('btnStart').addEventListener('click', startRound);
$('chkAuto').addEventListener('change', () => {
  const st = host.store, m = host.meta;
  if (!st || !m) return;
  const on = $('chkAuto').checked;
  st.update(`${ROOT}/${host.code}/meta`, { auto: on, nextAt: on && m.state === 'reveal' && m.round < m.rounds ? st.now() + AUTO_GAP : 0 }).catch((e) => toast(errMsg(e), 'error'));
});
$('btnEndNow').addEventListener('click', () => {
  const st = host.store;
  if (st && host.meta && host.meta.state === 'playing') st.update(`${ROOT}/${host.code}/meta`, { endsAt: st.now() - 800 }).catch((e) => toast(errMsg(e), 'error'));
});
$('btnPresent').addEventListener('click', () => {
  const m = host.meta || {};
  // 최종 결과 상태면 종합부터, 아니면 방금 끝난 판의 순위 발표부터
  openPresenter({ results: () => host.results, meta: () => host.meta, stats: () => host.stats, mine: null }, m.state === 'final' ? {} : { mode: 'reveal' });
});
$('btnFinal').addEventListener('click', () => {
  const st = host.store;
  if (st) st.update(`${ROOT}/${host.code}/meta`, { state: 'final' }).catch((e) => toast(errMsg(e), 'error'));
});
$('btnClose').addEventListener('click', async () => {
  if (!confirm('방을 닫을까요? 참가한 학생들도 모두 나가게 됩니다.')) return;
  const st = host.store;
  stopHostLoop(); clearSubs(); saveSession(null);
  try { if (st) await st.remove(`${ROOT}/${host.code}`); } catch (e) { toast(errMsg(e), 'error'); }
  goHome();
});

// ════════════════════════════════════════
// 첫 화면 · 시작
// ════════════════════════════════════════
function goHome() { show('scrHome'); }
document.querySelectorAll('[data-home]').forEach((b) => b.addEventListener('click', goHome));
$('btnPractice').addEventListener('click', startPractice);
$('btnJoinScr').addEventListener('click', () => { show('scrJoin'); $('joinErr').textContent = ''; ($('inCode').value.length === 4 ? $('inName') : $('inCode')).focus(); });

async function boot() {
  if (!$('scrHome').hidden) startHero();
  if (!ONLINE) {
    $('btnJoinScr').disabled = true; $('btnHost').disabled = true;
    $('homeNote').hidden = false;
    $('homeNote').textContent = 'Firebase 설정 전이라 같이하기는 꺼져 있어요. 「혼자 연습하기」로 조작을 먼저 익혀 보세요.';
    return;
  }
  const room = (qs.get('room') || '').replace(/\D/g, '').slice(0, 4);
  const ses = loadSession();
  if (ses && ses.code) {
    try {
      const st = await getStore();
      const meta = await st.get(`${ROOT}/${ses.code}/meta`);
      if (meta && ses.role === 'host' && meta.hostUid === st.uid) { enterHost(st, ses.code); return; }
      if (meta && ses.role === 'player') { await joinRoom(ses.code, ses.name, ses.team, true); return; }
    } catch (e) { /* 이어하기 실패 → 첫 화면 */ }
    saveSession(null);
  }
  if (room.length === 4) {
    $('inCode').value = room;
    show('scrJoin');
    $('inName').focus();
    checkCode();
  }
}
initPresenter();
boot();
