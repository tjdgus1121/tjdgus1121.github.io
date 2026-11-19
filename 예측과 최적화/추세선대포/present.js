// 추세선 대포 — 결과 발표 화면 (교사 프로젝터·학생 공용)
// 보기: 전체(격자) · 한 팀씩(캐러셀) · 겹쳐 보기 · 순위 발표(꼴찌부터 공개), 판별 탭 + 종합 탭
import * as E from './engine.js';
import { drawMap, teamColor } from './render.js';

const $ = (id) => document.getElementById(id);
const teamName = (t) => `${String(t).slice(1)}팀`;
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const eqOf = (L) => { if (!L) return '–'; const a = E.slopeOf(L), b = E.interceptOf(L); return `y = ${a.toFixed(2)}x ${b < 0 ? '−' : '+'} ${Math.abs(b).toFixed(2)}`; };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function badge(t, big) { const b = el('span', `team-badge${big ? ' big' : ''}`, String(t).slice(1)); b.dataset.team = t; b.setAttribute('aria-hidden', 'true'); return b; }
const rankCls = (r) => (r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '');

const MODES = [['grid', '전체'], ['focus', '한 팀씩'], ['overlay', '겹쳐 보기'], ['reveal', '순위 발표']];
const S = { src: null, open: false, round: null, mode: 'grid', idx: 0, shown: false, hl: null, auto: 0, draws: [], dir: 0, returnFocus: null };

export const isPresenterOpen = () => S.open;

// src = { results: () => ({ r1: {...}, ... }), meta: () => meta, mine: 't3' | null }
export function openPresenter(src, opts = {}) {
  S.src = src;
  const rs = roundKeys();
  if (!rs.length) return false;
  const m = src.meta() || {};
  S.round = opts.round || (m.state === 'final' && rs.length > 1 ? 'total' : rs[rs.length - 1]);
  S.mode = opts.mode || 'grid'; S.idx = 0; S.shown = false; S.hl = null;
  S.returnFocus = document.activeElement;
  S.open = true;
  $('present').hidden = false;
  document.body.classList.add('pv-lock');
  render();
  $('pvClose').focus();
  return true;
}

export function closePresenter() {
  if (!S.open) return;
  S.open = false;
  stopAuto();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $('present').hidden = true;
  document.body.classList.remove('pv-lock');
  if (S.returnFocus && S.returnFocus.focus) S.returnFocus.focus();
}

// 결과·진행 상태가 바뀌면 다시 그림 (보던 판·보기 방식은 유지)
export function refreshPresenter() {
  if (!S.open) return;
  const rs = roundKeys();
  if (!rs.length) { closePresenter(); return; }
  if (S.round !== 'total' && !rs.includes(S.round)) S.round = rs[rs.length - 1];
  render();
}

// ── 데이터 ──
function roundKeys() {
  const r = (S.src && S.src.results()) || {};
  return Object.keys(r).filter((k) => /^r\d+$/.test(k) && r[k]).sort((a, b) => +a.slice(1) - +b.slice(1));
}
function roundData(key) {
  const r = S.src.results()[key], m = S.src.meta() || {};
  const n = +key.slice(1);
  const pts = E.makeRound(m.seed, n).pts;
  const best = E.bestFit(pts);
  const teams = E.TEAMS.filter((t) => r[t]).map((t) => ({ t, ...r[t] })).sort((a, b) => a.rank - b.rank);
  return { n, pts, best, bestMse: r.best, teams };
}
function totalData() {
  const res = S.src.results(), keys = roundKeys();
  const rows = E.TEAMS.map((t) => ({ t, total: 0, per: keys.map((k) => res[k][t] || null) }))
    .filter((row) => row.per.some(Boolean));
  for (const row of rows) row.total = row.per.reduce((a, p) => a + (p ? p.pts || 0 : 0), 0);
  rows.sort((a, b) => b.total - a.total || +a.t.slice(1) - +b.t.slice(1));
  rows.forEach((row, i) => { row.rank = i > 0 && rows[i - 1].total === row.total ? rows[i - 1].rank : i + 1; });
  const names = {};
  for (const k of keys) for (const t of E.TEAMS) if (res[k][t] && res[k][t].names) names[t] = res[k][t].names;
  return { keys, rows, names };
}

// ── 그리기 ──
function render() {
  if (S.mode !== 'focus') stopAuto();   // 자동 넘김은 한 팀씩 보기에서만
  S.draws = [];
  const isTotal = S.round === 'total';
  $('pvTitle').textContent = isTotal ? '종합 결과' : `${S.round.slice(1)}판 결과`;
  // 판 탭
  const tabs = $('pvRounds'); tabs.replaceChildren();
  const rs = roundKeys();
  const tabList = rs.map((k) => [k, `${k.slice(1)}판`]);
  if (rs.length > 1) tabList.push(['total', '종합']);
  for (const [k, label] of tabList) {
    const b = el('button', 'pv-pill', label); b.type = 'button'; b.dataset.round = k;
    b.setAttribute('aria-pressed', String(k === S.round));
    tabs.appendChild(b);
  }
  // 보기 방식
  const modes = $('pvModes'); modes.replaceChildren();
  for (const [k, label] of MODES) {
    if (isTotal && k === 'overlay') continue;
    const b = el('button', 'pv-pill', label); b.type = 'button'; b.dataset.mode = k;
    b.setAttribute('aria-pressed', String(k === S.mode));
    modes.appendChild(b);
  }
  if (isTotal && S.mode === 'overlay') S.mode = 'grid';

  const body = $('pvBody'), foot = $('pvFoot');
  body.replaceChildren(); foot.replaceChildren();
  body.dataset.mode = S.mode;
  if (isTotal) {
    const d = totalData();
    if (S.mode === 'grid') renderBoard(body, d);
    else if (S.mode === 'focus') renderTeamRounds(body, foot, d);
    else renderReveal(body, foot, d.rows.map((r) => ({ t: r.t, rank: r.rank, main: `${r.total}점`, sub: r.per.map((p, i) => (p ? `${i + 1}판 ${p.rank}위` : `${i + 1}판 –`)).join(' · ') })), null);
  } else {
    const d = roundData(S.round);
    if (S.mode === 'grid') renderGrid(body, d);
    else if (S.mode === 'focus') renderFocus(body, foot, d);
    else if (S.mode === 'overlay') renderOverlay(body, d);
    else renderReveal(body, foot, d.teams.map((x) => ({ t: x.t, rank: x.rank, main: `오차 ${fmt(x.mse)}`, sub: `+${x.pts}점`, line: x.line })), d);
  }
  if (S.auto) startAutoFlag();
  requestAnimationFrame(redraw);
}
function redraw() { if (S.open) for (const f of S.draws) f(); }

// 전체: 순위대로 격자
function renderGrid(body, d) {
  if (!d.teams.length) { body.appendChild(el('p', 'pv-empty', '이 판에 참가한 팀이 없어요.')); return; }
  const grid = el('div', 'pv-grid');
  d.teams.forEach((x, i) => {
    const card = el('button', `pv-card ${rankCls(x.rank)}`); card.type = 'button'; card.dataset.team = x.t; card.dataset.idx = i;
    card.setAttribute('aria-label', `${x.rank}위 ${teamName(x.t)}, 오차 ${fmt(x.mse)}. 크게 보기`);
    if (S.src.mine === x.t) card.classList.add('mine');
    const head = el('div', 'pv-card-head');
    head.append(el('span', `pv-rank ${rankCls(x.rank)}`, `${x.rank}위`), badge(x.t), el('strong', '', teamName(x.t) + (S.src.mine === x.t ? ' (우리)' : '')), el('span', 'pv-mse', fmt(x.mse)));
    const cv = el('canvas', 'map-canvas');
    card.append(head, cv, el('div', 'pv-names', (x.names || []).join(', ')));
    grid.appendChild(card);
    S.draws.push(() => drawMap(cv, { small: (cv._w || 300) < 320, pts: d.pts, line: x.line, best: d.best, residuals: true, lineColor: teamColor(x.t) }));
  });
  body.append(el('p', 'pv-hint', `최적 직선(점선)의 오차 ${fmt(d.bestMse)} · 카드를 누르면 크게 봐요`), grid);
}

// 한 팀씩: 캐러셀
function renderFocus(body, foot, d) {
  const list = d.teams;
  if (!list.length) { body.appendChild(el('p', 'pv-empty', '이 판에 참가한 팀이 없어요.')); return; }
  S.idx = (S.idx + list.length) % list.length;
  const x = list[S.idx];
  const slide = el('div', `pv-slide${S.dir && !REDUCED ? (S.dir > 0 ? ' in-right' : ' in-left') : ''}`);
  slide.dataset.team = x.t;
  const cv = el('canvas', 'map-canvas pv-big');
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', `${teamName(x.t)} 결과 맵`);
  const info = el('div', 'pv-info');
  const top = el('div', 'pv-info-top');
  const nm = el('h3', 'pv-team');
  nm.append(badge(x.t), el('span', '', teamName(x.t) + (S.src.mine === x.t ? ' (우리)' : '')));
  top.append(el('span', `pv-rank big ${rankCls(x.rank)}`, `${x.rank}위`), nm);
  info.append(top, el('p', 'pv-names', (x.names || []).join(', ') || ' '));
  const stats = el('dl', 'pv-stats');
  const stat = (k, v, cls) => { const w = el('div', cls || ''); w.append(el('dt', '', k), el('dd', '', v)); stats.appendChild(w); };
  stat('오차 (평균제곱오차)', fmt(x.mse), 'main');
  stat('최적 오차', fmt(d.bestMse));
  stat('최적과의 차이', `+${fmt(x.mse - d.bestMse)}`);
  stat('받은 점수', `+${x.pts}점`);
  stat('우리 직선', eqOf(x.line));
  stat('최적 직선 (점선)', eqOf(d.best));
  info.appendChild(stats);
  // 점마다 오차² 막대: 어느 점이 오차를 키웠나
  if (x.line) {
    const pts = [...d.pts].sort((a, b) => a.x - b.x);
    const sq = pts.map((p) => ((p.y - E.lineY(x.line, p.x)) / 10) ** 2);
    const max = Math.max(...sq, 1e-9), worst = sq.indexOf(max);
    const box = el('div', 'pv-bars-box');
    box.appendChild(el('p', 'pv-bars-title', '점마다 (오차)² — 막대가 클수록 그 점에서 많이 빗나갔어요'));
    const bars = el('div', 'pv-bars');
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', `점 ${pts.length}개의 오차 제곱. 가장 큰 값 ${fmt(max)} (x = ${(pts[worst].x / 10).toFixed(1)})`);
    sq.forEach((v, i) => {
      const b = el('span', `pv-bar${i === worst ? ' worst' : ''}`);
      b.style.height = `${Math.max(2, (v / max) * 100)}%`;
      b.title = `x = ${(pts[i].x / 10).toFixed(1)} · (오차)² = ${fmt(v)}`;
      bars.appendChild(b);
    });
    box.append(bars, el('p', 'pv-bars-note', `가장 크게 빗나간 점: x = ${(pts[worst].x / 10).toFixed(1)} · (오차)² ${fmt(max)} · 평균 내면 ${fmt(x.mse)}`));
    info.appendChild(box);
  }
  slide.append(el('div', 'pv-map', ''), info);
  slide.firstChild.appendChild(cv);
  body.appendChild(slide);
  S.draws.push(() => drawMap(cv, { pts: d.pts, line: x.line, best: d.best, residuals: true, lineColor: teamColor(x.t) }));
  carouselFoot(foot, list.map((y) => y.t), true);
}

// 캐러셀 아래: 이전 · 팀 점 · 다음 · 자동 넘김
function carouselFoot(foot, teams, withAuto) {
  const prev = el('button', 'pv-nav', '◀ 이전'); prev.type = 'button'; prev.dataset.nav = '-1';
  const next = el('button', 'pv-nav', '다음 ▶'); next.type = 'button'; next.dataset.nav = '1';
  const dots = el('div', 'pv-dots');
  teams.forEach((t, i) => {
    const b = el('button', 'pv-dot', t.slice(1)); b.type = 'button'; b.dataset.team = t; b.dataset.go = i;
    b.setAttribute('aria-label', `${teamName(t)} 보기`);
    if (i === S.idx) b.setAttribute('aria-current', 'true');
    dots.appendChild(b);
  });
  foot.append(prev, dots, next, el('span', 'pv-count', `${S.idx + 1} / ${teams.length}`));
  if (withAuto) {
    const a = el('button', 'pv-nav auto', '▶ 자동 넘김'); a.type = 'button'; a.id = 'pvAuto'; a.setAttribute('aria-pressed', 'false');
    foot.appendChild(a);
  }
}

// 겹쳐 보기: 모든 팀 직선 + 최적 직선
function renderOverlay(body, d) {
  const wrap = el('div', 'pv-overlay');
  const cv = el('canvas', 'map-canvas pv-big');
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', '모든 팀의 직선을 겹친 맵');
  const side = el('div', 'pv-legend');
  side.appendChild(el('p', 'pv-legend-title', '팀을 누르면 그 직선만 강조해요'));
  for (const x of d.teams) {
    const b = el('button', `pv-leg${S.hl === x.t ? ' on' : ''}`); b.type = 'button'; b.dataset.hl = x.t; b.dataset.team = x.t;
    b.setAttribute('aria-pressed', String(S.hl === x.t));
    b.append(el('span', `pv-rank ${rankCls(x.rank)}`, `${x.rank}위`), badge(x.t), el('strong', '', teamName(x.t)), el('span', 'pv-mse', fmt(x.mse)));
    side.appendChild(b);
  }
  const bl = el('div', 'pv-leg best-key'); bl.append(el('span', 'dash'), el('strong', '', '최적 직선'), el('span', 'pv-mse', fmt(d.bestMse)));
  side.appendChild(bl);
  const mapBox = el('div', 'pv-map'); mapBox.appendChild(cv);
  wrap.append(mapBox, side);
  body.appendChild(wrap);
  S.draws.push(() => drawMap(cv, {
    pts: d.pts, best: d.best,
    lines: d.teams.map((x) => ({ L: x.line, color: teamColor(x.t), label: x.t.slice(1), dim: !!S.hl && S.hl !== x.t, bold: S.hl === x.t })),
    line: S.hl ? (d.teams.find((x) => x.t === S.hl) || {}).line : null, residuals: !!S.hl, lineColor: S.hl ? teamColor(S.hl) : undefined,
  }));
}

// 순위 발표: 꼴찌부터 한 장씩 (스페이스로 공개 → 다음)
function renderReveal(body, foot, items, d) {
  if (!items.length) { body.appendChild(el('p', 'pv-empty', '발표할 팀이 없어요.')); return; }
  const order = [...items].sort((a, b) => b.rank - a.rank || +b.t.slice(1) - +a.t.slice(1));   // 꼴찌부터
  S.idx = Math.max(0, Math.min(order.length - 1, S.idx));
  const it = order[S.idx];
  const slide = el('div', `pv-reveal ${rankCls(it.rank)}${S.shown ? ' shown' : ''}${!REDUCED ? ' anim' : ''}`);
  slide.appendChild(el('div', 'pv-reveal-rank', `${it.rank}위`));
  if (!S.shown) {
    slide.appendChild(el('p', 'pv-reveal-q', '는 과연 어느 팀?'));
    const b = el('button', 'btn fire big', '공개하기'); b.type = 'button'; b.dataset.reveal = '1';
    slide.appendChild(b);
    slide.appendChild(el('p', 'pv-hint', '스페이스 또는 → 로도 넘길 수 있어요'));
  } else {
    slide.dataset.team = it.t;
    const who = el('div', 'pv-reveal-who');
    who.append(badge(it.t, true), el('strong', '', teamName(it.t) + (S.src.mine === it.t ? ' (우리)' : '')));
    slide.append(who, el('p', 'pv-reveal-main', it.main), el('p', 'pv-reveal-sub', it.sub));
    if (d && it.line) {
      const cv = el('canvas', 'map-canvas pv-mini');
      slide.appendChild(cv);
      S.draws.push(() => drawMap(cv, { small: true, pts: d.pts, line: it.line, best: d.best, residuals: true, lineColor: teamColor(it.t) }));
    }
    if (S.idx === order.length - 1) {
      const all = el('button', 'btn big', '전체 순위 보기'); all.type = 'button'; all.dataset.mode = 'grid';
      slide.appendChild(all);
    }
  }
  body.appendChild(slide);
  // 진행 표시
  const prev = el('button', 'pv-nav', '◀ 이전'); prev.type = 'button'; prev.dataset.nav = '-1';
  const next = el('button', 'pv-nav', S.shown ? '다음 ▶' : '공개 ▶'); next.type = 'button'; next.dataset.nav = '1';
  const steps = el('div', 'pv-dots');
  order.forEach((o, i) => {
    const s = el('span', `pv-step${i < S.idx || (i === S.idx && S.shown) ? ' done' : ''}${i === S.idx ? ' cur' : ''}`, `${o.rank}위`);
    steps.appendChild(s);
  });
  foot.append(prev, steps, next);
}

// 종합: 누적 점수 막대 (판마다 칸 나눔)
function renderBoard(body, d) {
  const max = Math.max(1, ...d.rows.map((r) => r.total));
  const board = el('div', 'pv-board');
  for (const r of d.rows) {
    const row = el('div', `pv-brow ${rankCls(r.rank)}`); row.dataset.team = r.t;
    if (S.src.mine === r.t) row.classList.add('mine');
    const who = el('div', 'pv-bwho'); who.append(el('span', `pv-rank ${rankCls(r.rank)}`, `${r.rank}위`), badge(r.t), el('strong', '', teamName(r.t)));
    const bar = el('div', 'pv-bbar');
    r.per.forEach((p, i) => {
      if (!p || !p.pts) return;
      const seg = el('span', `pv-seg-fill r${i % 5}`, `${i + 1}판 ${p.pts}`);
      seg.style.width = `${(p.pts / max) * 100}%`;
      seg.title = `${i + 1}판 ${p.rank}위 · 오차 ${fmt(p.mse)} · ${p.pts}점`;
      bar.appendChild(seg);
    });
    row.append(who, bar, el('strong', 'pv-btotal', `${r.total}점`));
    board.appendChild(row);
  }
  body.append(el('p', 'pv-hint', '판마다 받은 순위 점수(10·8·6·5·4·3·2·1)를 더한 값이에요'), board);
  // MVP: 판마다 저장된 개인 기록에서 줄인 오차가 가장 큰 사람
  const per = {};
  const stats = (S.src.stats && S.src.stats()) || {};
  for (const rs of Object.values(stats)) for (const [u, s] of Object.entries(rs || {})) {
    const q = per[u] || (per[u] = { n: s.n, t: s.t, h: 0, g: 0 });
    q.h += s.h || 0; q.g += s.g || 0;
  }
  const list = Object.values(per).filter((q) => q.h > 0);
  if (list.length) {
    const top = list.reduce((a, q) => (q.g > a.g ? q : a));
    const box = el('div', 'pv-mvp');
    const b = badge(top.t);
    box.append(el('span', 'pv-mvp-tag', 'MVP'), b, el('strong', '', top.n), el('span', '', [teamName(top.t), top.g > 0.05 ? `좋은 방향으로 민 힘 ${fmt(top.g, 1)}` : ''].filter(Boolean).join(' · ')));
    body.appendChild(box);
    for (const row of board.children) {
      const tm = list.filter((q) => q.t === row.dataset.team).sort((a, c) => c.g - a.g)[0];
      if (tm) row.querySelector('.pv-bwho').appendChild(el('span', 'pv-tmvp', `MVP ${tm.n}`));
    }
  }
}

// 종합 · 한 팀씩: 그 팀의 판별 결과를 나란히
function renderTeamRounds(body, foot, d) {
  if (!d.rows.length) return;
  S.idx = (S.idx + d.rows.length) % d.rows.length;
  const r = d.rows[S.idx], res = S.src.results(), m = S.src.meta() || {};
  const slide = el('div', `pv-slide tr${S.dir && !REDUCED ? (S.dir > 0 ? ' in-right' : ' in-left') : ''}`);
  slide.dataset.team = r.t;
  const head = el('div', 'pv-tr-head');
  const nm = el('h3', 'pv-team'); nm.append(badge(r.t), el('span', '', teamName(r.t) + (S.src.mine === r.t ? ' (우리)' : '')));
  head.append(el('span', `pv-rank big ${rankCls(r.rank)}`, `${r.rank}위`), nm, el('strong', 'pv-tr-total', `${r.total}점`));
  slide.append(head, el('p', 'pv-names', (d.names[r.t] || []).join(', ') || ' '));
  const row = el('div', 'pv-tr-rounds');
  d.keys.forEach((k, i) => {
    const p = res[k][r.t];
    const cell = el('div', 'pv-tr-cell');
    cell.appendChild(el('p', 'pv-tr-label', `${i + 1}판`));
    if (p) {
      const pts = E.makeRound(m.seed, i + 1).pts, best = E.bestFit(pts);
      const cv = el('canvas', 'map-canvas');
      cell.append(cv, el('p', 'pv-tr-stat', `${p.rank}위 · 오차 ${fmt(p.mse)} · +${p.pts}점`));
      S.draws.push(() => drawMap(cv, { small: (cv._w || 300) < 320, pts, line: p.line, best, residuals: true, lineColor: teamColor(r.t) }));
    } else cell.appendChild(el('p', 'pv-empty', '참가하지 않음'));
    row.appendChild(cell);
  });
  slide.appendChild(row);
  body.appendChild(slide);
  carouselFoot(foot, d.rows.map((x) => x.t), true);
}

// ── 조작 ──
function go(delta) {
  if (S.mode === 'reveal') {
    const n = S.round === 'total' ? totalData().rows.length : roundData(S.round).teams.length;
    if (delta > 0) { if (!S.shown) S.shown = true; else if (S.idx < n - 1) { S.idx++; S.shown = false; } }
    else if (S.shown) S.shown = false; else if (S.idx > 0) { S.idx--; S.shown = true; }
    render(); return;
  }
  if (S.mode !== 'focus') return;
  S.dir = delta; S.idx += delta;
  render();
  S.dir = 0;
}
function startAuto() {
  stopAuto();
  S.auto = setInterval(() => { S.dir = 1; S.idx++; render(); S.dir = 0; }, 5000);
  startAutoFlag();
}
function startAutoFlag() { const a = $('pvAuto'); if (a) { a.setAttribute('aria-pressed', 'true'); a.textContent = '❚❚ 자동 넘김 멈춤'; } }
function stopAuto() {
  if (S.auto) clearInterval(S.auto);
  S.auto = 0;
  const a = $('pvAuto'); if (a) { a.setAttribute('aria-pressed', 'false'); a.textContent = '▶ 자동 넘김'; }
}

function setMode(mode) { S.mode = mode; S.idx = 0; S.shown = false; S.hl = null; S.dir = 0; render(); }

function onClick(e) {
  const t = e.target.closest('button');
  if (!t || !$('present').contains(t)) return;
  if (t.id === 'pvClose') return closePresenter();
  if (t.id === 'pvFull') return toggleFull();
  if (t.id === 'pvAuto') { if (S.auto) stopAuto(); else startAuto(); return; }
  if (t.dataset.round) { S.round = t.dataset.round; S.idx = 0; S.shown = false; S.hl = null; return render(); }
  if (t.dataset.mode) return setMode(t.dataset.mode);
  if (t.classList.contains('pv-card')) { S.mode = 'focus'; S.idx = +t.dataset.idx; S.dir = 0; return render(); }
  if (t.dataset.nav) return go(+t.dataset.nav);
  if (t.dataset.go !== undefined) { const d = +t.dataset.go - S.idx; S.dir = Math.sign(d); S.idx = +t.dataset.go; render(); S.dir = 0; return; }
  if (t.dataset.reveal) return go(1);
  if (t.dataset.hl) { S.hl = S.hl === t.dataset.hl ? null : t.dataset.hl; return render(); }
}

function toggleFull() {
  const p = $('present');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (p.requestFullscreen) p.requestFullscreen().catch(() => {});
}

function onKey(e) {
  if (!S.open) return;
  if (e.target.closest && e.target.closest('input, select, textarea')) return;
  const k = e.key;
  if (k === 'Escape') { if (!document.fullscreenElement) closePresenter(); return; }
  if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); go(1); }
  else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(-1); }
  else if ((k === ' ' || k === 'Enter') && S.mode === 'reveal' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); go(1); }
  else if (k === 'f' || k === 'F') toggleFull();
  else if (/^[1-4]$/.test(k)) { const m = MODES[+k - 1][0]; if (!(S.round === 'total' && m === 'overlay')) setMode(m); }
  else if (k === 'Tab') trapFocus(e);
}
function trapFocus(e) {
  const f = [...$('present').querySelectorAll('button:not([disabled])')].filter((b) => b.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// 밀어서 넘기기 (한 팀씩·순위 발표)
let swipeX = null;
function onDown(e) { if (S.mode === 'focus' || S.mode === 'reveal') swipeX = e.clientX; }
function onUp(e) {
  if (swipeX === null) return;
  const dx = e.clientX - swipeX; swipeX = null;
  if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
}

export function initPresenter() {
  const p = $('present');
  p.addEventListener('click', onClick);
  p.addEventListener('pointerdown', onDown);
  p.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);
  document.addEventListener('fullscreenchange', () => { $('pvFull').textContent = document.fullscreenElement ? '전체 화면 끄기' : '전체 화면'; requestAnimationFrame(() => requestAnimationFrame(redraw)); });
  if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(redraw)).observe($('pvBody'));
  else window.addEventListener('resize', () => requestAnimationFrame(redraw));
}
