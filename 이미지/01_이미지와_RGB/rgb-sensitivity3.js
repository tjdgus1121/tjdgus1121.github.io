// R·G·B 색감 테스트 3 — QUEST 적응형 측정 (sensitivity1·2와 별개 실험판, 랭킹 없음)
// 판·순서·칸 수는 sensitivity1과 같고, 다음 문제의 차이(Δ)를 "지금까지 답 전체로 추정한 내 경계"에 맞춰 고른다.
//   Watson & Pelli (1983) QUEST: A Bayesian adaptive psychometric method. Perception & Psychophysics 33.
// 결과는 색별 "구별 경계"(작을수록 작은 차이까지 봄)로 비교한다. 세 색 모두 같은 조건·규칙.
(() => {
  'use strict';

  const ORDER = ['R', 'G', 'B'];
  const NAMES = { R: '빨강', G: '초록', B: '파랑' };
  // 판: 주 채널 130~140, 나머지 두 채널 16 — 이 구간에서 G 차이가 가장 잘 보이고(CIEDE2000) R·B와 간격도 가장 넓음
  const FAMILY_RANGE = [130, 140];
  const SECONDARY_LEVEL = 16;
  const PRACTICE_LEVEL = 135;
  const PRACTICE_DELTA = 12;
  const MIN_BASE_SHIFT = 4;    // 같은 색의 직전 문제 기준값과 이만큼 달라야 함(같은 판이 이어져 보이지 않게)
  const QUESTIONS = 7;         // 색마다
  const TOTAL = QUESTIONS * ORDER.length;
  const STAGE_MS = 10000;
  // 칸 수: 색마다 1·2번째 문제 9칸, 3·4번째 16칸, 5~7번째 25칸 (세 색 같음). 연습은 9칸
  const GRID_BY_Q = [3, 3, 4, 4, 5, 5, 5];
  const PRACTICE_GRID = 3;

  // ── QUEST ──
  // 경계 후보 T(Δ 단위)를 0.7~30 사이 로그 간격 200개로 두고, 답할 때마다 각 후보의 가능도를 곱해 갱신한다.
  // 정답 확률 모형(바이블 함수): p = γ + (1 − γ − λ)(1 − exp(−(Δ/T)^β)), γ = 1/칸 수(찍어서 맞힐 확률), λ = 실수
  const Q_N = 200, Q_MIN = 0.7, Q_MAX = 30, Q_BETA = 2.5, Q_LAPSE = 0.03;
  const START_DELTA = 12;     // 색마다 첫 문제는 쉽게(연습과 같은 차이) — 몸풀기, 추정에는 그대로 반영
  const EASE = 1.6;           // 추정 경계의 1.6배 Δ로 출제 — 경계 바로 위보다 쉬워 정답률 약 80%(시뮬)
  const DELTA_MIN = 1, DELTA_MAX = 24;
  const Q_T = Array.from({ length: Q_N }, (_, i) => Math.exp(Math.log(Q_MIN) + i * (Math.log(Q_MAX) - Math.log(Q_MIN)) / (Q_N - 1)));
  const pModel = (delta, T, tiles) => {
    const g = 1 / tiles;
    return g + (1 - g - Q_LAPSE) * (1 - Math.exp(-Math.pow(delta / T, Q_BETA)));
  };
  function questEstimate(logPost) {
    const max = Math.max(...logPost);
    let s = 0, m = 0;
    for (let i = 0; i < Q_N; i++) { const w = Math.exp(logPost[i] - max); s += w; m += w * Math.log(Q_T[i]); }
    return Math.exp(m / s);
  }
  const clampDelta = d => Math.max(DELTA_MIN, Math.min(DELTA_MAX, Math.round(d)));

  const $ = id => document.getElementById(id);
  const freshRecords = () => Object.fromEntries(ORDER.map(ch => [ch, {
    correct: 0, asked: 0, elapsedMs: 0, trail: [], done: false,
    logPost: new Array(Q_N).fill(0), delta: START_DELTA, estimate: null
  }]));
  const state = {
    phase: 'ready', qIndex: 0, records: freshRecords(),
    answerIndex: 0, questionStartedAt: 0, deadline: 0,
    rafId: 0, nextTimer: 0, runId: 0,
    practicing: false, practiceIndex: 0, basePlan: [], positionPlans: {}, grid: PRACTICE_GRID
  };
  const el = {
    ready: $('readyPanel'), play: $('playPanel'), result: $('resultPanel'),
    board: $('board'), channel: $('chValue'), stage: $('stageValue'),
    correct: $('correctValue'), time: $('timeValue'), timebar: $('timebarFill'),
    question: $('questionValue'), delta: $('deltaLine'), feedback: $('feedback'),
    start: $('startBtn'), retry: $('retryBtn'), resultRows: $('resultRows')
  };
  const currentChannel = () => ORDER[state.practicing ? state.practiceIndex : state.qIndex % ORDER.length];
  const currentRecord = () => state.records[currentChannel()];
  const currentDelta = () => state.practicing ? PRACTICE_DELTA : currentRecord().delta;
  const seconds = ms => (ms / 1000).toFixed(1);
  const fmt1 = v => String(Number(v.toFixed(1)));
  // 눈 점수: 구별 경계가 작을수록 큼 (경계 Δ 1 → 1000점, Δ 5 → 200점, Δ 10 → 100점)
  const eyeScore = est => (est ? Math.round(1000 / Math.max(1, est)) : 0);

  function stopScheduledWork() {
    cancelAnimationFrame(state.rafId);
    clearTimeout(state.nextTimer);
    state.rafId = 0;
    state.nextTimer = 0;
  }
  function scheduleNext(action, delay) {
    const runId = state.runId;
    state.nextTimer = setTimeout(() => {
      state.nextTimer = 0;
      if (state.runId === runId && state.phase === 'feedback') action();
    }, delay);
  }

  function renderRecords() {
    for (const ch of ORDER) {
      const record = state.records[ch];
      const active = state.phase !== 'ready' && state.phase !== 'done' && ch === currentChannel() && !record.done;
      $('record' + ch).classList.toggle('is-active', active);
      $('record' + ch).classList.toggle('is-done', record.done);
      $('recordScore' + ch).textContent = String(record.correct);
      $('recordMeta' + ch).textContent = `${record.asked}/${QUESTIONS}문제 · ${seconds(record.elapsedMs)}초`;
      $('recordStatus' + ch).textContent = record.done ? '완료' : active ? (state.practicing ? '연습' : '진행 중') : '대기';
    }
  }

  function renderHud() {
    const ch = currentChannel();
    const record = currentRecord();
    el.play.dataset.ch = ch;
    el.channel.textContent = `${state.practicing ? '연습 · ' : ''}${ch} ${NAMES[ch]}`;
    el.stage.textContent = `+${currentDelta()}`;
    el.correct.textContent = state.practicing ? '미반영' : `${record.correct}개`;
    el.question.textContent = state.practicing ? `${state.practiceIndex + 1} / ${ORDER.length}` : `${Math.min(state.qIndex + 1, TOTAL)} / ${TOTAL}`;
    const others = ORDER.filter(value => value !== ch).join('·');
    const level = state.practicing ? PRACTICE_LEVEL : state.basePlan[record.asked];
    el.delta.textContent = `${ch} ${level} → ${level + currentDelta()} (+${currentDelta()}) · ${others}=${SECONDARY_LEVEL}`;
  }

  function renderTime(now) {
    const left = Math.max(0, Math.min(STAGE_MS, state.deadline - now));
    el.time.textContent = seconds(left);
    el.time.classList.toggle('is-low', left <= 3000);
    el.timebar.style.transform = `scaleX(${left / STAGE_MS})`;
    return left;
  }

  const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const rgbText = rgb => `rgb(${rgb.join(', ')})`;
  function shuffled(values) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // 기준값 7개를 한 번 뽑아 세 색이 같은 순서로 씀
  function makeBasePlan() {
    const plan = [];
    const [min, max] = FAMILY_RANGE;
    for (let q = 0; q < QUESTIONS; q++) {
      const prev = plan[q - 1];
      let level = randInt(min, max);
      for (let tries = 1; prev !== undefined && Math.abs(level - prev) < MIN_BASE_SHIFT && tries < 20; tries++) level = randInt(min, max);
      if (prev !== undefined && Math.abs(level - prev) < MIN_BASE_SHIFT) level = prev < (min + max) / 2 ? max : min;
      plan.push(level);
    }
    return plan;
  }
  // 판을 90°씩 돌려 서로 겹치는 칸 4개짜리 묶음(가운데 칸 제외)
  function rotationOrbits(n) {
    const rot = i => { const r = Math.floor(i / n), c = i % n; return c * n + (n - 1 - r); };
    const seen = new Set();
    const orbits = [];
    for (let i = 0; i < n * n; i++) {
      if (seen.has(i) || rot(i) === i) continue;
      const orbit = [i, rot(i), rot(rot(i)), rot(rot(rot(i)))];
      orbit.forEach(j => seen.add(j));
      orbits.push(orbit);
    }
    return orbits;
  }
  // 정답 위치: 같은 번째 문제는 세 색이 판을 90°씩 돌린 자리(가운데·모서리에서 떨어진 정도가 같음)를 받아
  // 찾는 어려움은 같고, 한 판 안에서는 세 색·모든 문제의 정답 칸이 서로 겹치지 않음
  function makePositionPlans() {
    const plans = Object.fromEntries(ORDER.map(ch => [ch, []]));
    const groups = {};
    GRID_BY_Q.slice(0, QUESTIONS).forEach((n, q) => { (groups[n] = groups[n] || []).push(q); });
    for (const [size, qs] of Object.entries(groups)) {
      const orbits = shuffled(rotationOrbits(Number(size)));
      qs.forEach((q, k) => {
        const spots = shuffled(orbits[k % orbits.length]);
        ORDER.forEach((ch, c) => { plans[ch][q] = spots[c]; });
      });
    }
    return plans;
  }

  function buildBoard() {
    const ch = currentChannel();
    const index = ORDER.indexOf(ch);
    const delta = currentDelta();
    const record = currentRecord();
    const level = state.practicing ? PRACTICE_LEVEL : state.basePlan[record.asked];
    const base = ORDER.map((_, i) => i === index ? level : SECONDARY_LEVEL);
    const odd = base.slice();
    odd[index] += delta;   // 다른 칸은 늘 주 채널 +Δ (밝은 칸)
    const n = state.practicing ? PRACTICE_GRID : GRID_BY_Q[Math.min(record.asked, GRID_BY_Q.length - 1)];
    state.grid = n;
    el.board.style.setProperty('--grid', String(n));
    el.board.dataset.grid = String(n);
    state.answerIndex = state.practicing ? randInt(0, n * n - 1) : state.positionPlans[ch][record.asked];
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < n * n; i++) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(i);
      tile.tabIndex = i === 0 ? 0 : -1;
      tile.setAttribute('aria-label', `${Math.floor(i / n) + 1}행 ${i % n + 1}열`);
      tile.style.background = rgbText(i === state.answerIndex ? odd : base);
      fragment.appendChild(tile);
    }
    el.board.replaceChildren(fragment);
  }

  function tick(now) {
    if (state.phase !== 'playing') return;
    if (renderTime(now) <= 0) { resolveRound(null, now); return; }
    state.rafId = requestAnimationFrame(tick);
  }

  function startStage() {
    state.phase = 'playing';
    renderHud();
    renderRecords();
    buildBoard();
    state.questionStartedAt = performance.now();
    state.deadline = state.questionStartedAt + STAGE_MS;
    renderTime(state.questionStartedAt);
    el.board.children[0].focus({ preventScroll: true });
    cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
  }

  // 답 하나로 그 색의 경계 추정을 갱신하고 다음 Δ를 정함
  function questUpdate(record, delta, tiles, correct) {
    for (let i = 0; i < Q_N; i++) {
      const p = pModel(delta, Q_T[i], tiles);
      record.logPost[i] += Math.log(correct ? p : 1 - p);
    }
    record.estimate = questEstimate(record.logPost);
    record.delta = clampDelta(record.estimate * EASE);
  }

  function resolveRound(index, now = performance.now()) {
    if (state.phase !== 'playing') return;   // 두 번 눌러도 한 번만
    state.phase = 'feedback';
    cancelAnimationFrame(state.rafId);
    const timedOut = now >= state.deadline;
    const correct = !timedOut && index === state.answerIndex;
    renderTime(now);
    for (const tile of el.board.children) tile.disabled = true;
    if (!correct) {
      const answer = el.board.children[state.answerIndex];
      answer.classList.add('is-answer');
      answer.textContent = '정답';
      if (!timedOut && index !== null) el.board.children[index].textContent = '✕';
    }
    if (state.practicing) {
      el.feedback.dataset.kind = correct ? 'correct' : 'wrong';
      el.feedback.textContent = `${correct ? '찾았어요!' : timedOut ? '시간이 끝났어요. 정답 칸을 확인해 보세요.' : '표시된 정답 칸을 확인해 보세요.'} 연습은 기록에 넣지 않아요.`;
      renderRecords();
      scheduleNext(() => {
        state.practiceIndex++;
        if (state.practiceIndex >= ORDER.length) {
          state.practicing = false;
          state.qIndex = 0;
          el.feedback.dataset.kind = 'notice';
          el.feedback.textContent = `연습 완료! 본게임은 R·G·B를 번갈아 ${TOTAL}문제(색마다 ${QUESTIONS}문제) 풀어요.`;
        } else {
          el.feedback.dataset.kind = 'notice';
          el.feedback.textContent = `${currentChannel()} ${NAMES[currentChannel()]} 연습이에요. 색이 다른 한 칸을 찾아보세요.`;
        }
        startStage();
      }, correct ? 700 : 1400);
      return;
    }
    const ch = currentChannel();
    const record = currentRecord();
    const delta = record.delta;
    record.elapsedMs += Math.max(0, Math.min(STAGE_MS, now - state.questionStartedAt));
    record.trail.push({ delta, tiles: state.grid * state.grid, ok: correct });
    record.asked += 1;
    if (correct) record.correct += 1;
    questUpdate(record, delta, state.grid * state.grid, correct);
    const next = record.delta;
    const move = next < delta ? '차이를 줄여요' : next > delta ? '차이를 키워요' : '같은 차이로 해요';
    el.feedback.dataset.kind = correct ? 'correct' : 'wrong';
    el.feedback.textContent = `${correct ? '정답!' : timedOut ? '시간 초과!' : '아쉬워요!'} 다음 ${ch} 문제는 ${move}${next !== delta ? ` (+${next})` : ''}.`;
    if (record.asked >= QUESTIONS) record.done = true;
    state.qIndex += 1;
    renderRecords();
    if (state.qIndex >= TOTAL) {
      el.feedback.textContent += ` ${TOTAL}문제 완료! 결과를 계산해요.`;
      scheduleNext(finishGame, 1200);
      return;
    }
    scheduleNext(startStage, correct ? 250 : 900);
  }

  function finishGame() {
    stopScheduledWork();
    state.phase = 'done';
    el.play.hidden = true;
    el.result.hidden = false;
    const records = ORDER.map(ch => state.records[ch]);
    const ests = records.map(r => r.estimate);
    const scores = ests.map(eyeScore);
    const total = scores.reduce((a, b) => a + b, 0);
    $('totalScore').textContent = total.toLocaleString('ko-KR');
    $('totalCorrect').textContent = `${records.reduce((n, r) => n + r.correct, 0)} / ${TOTAL}개`;
    $('totalTime').textContent = `${seconds(records.reduce((n, r) => n + r.elapsedMs, 0))}초`;
    $('scoreBreakdown').textContent = '눈 점수 = 1000 ÷ 구별 경계 · 풀이 시간은 별도 기록 · 연습 제외';
    // 순서: 구별 경계가 작을수록(작은 차이까지 볼수록) 앞. 소수 첫째 자리까지 같으면 =
    const ranked = ORDER.map((ch, i) => ({ ch, e: Number(ests[i].toFixed(1)) })).sort((a, b) => a.e - b.e);
    const orderText = ranked.map((x, i) => (i ? (ranked[i - 1].e === x.e ? ' = ' : ' > ') : '') + x.ch).join('');
    $('resultNote').textContent = `이번 순서 ${orderText} (구별 경계가 작은 순 = 더 작은 차이까지 본 순). 결과는 내가 실제로 찾은 기록 그대로예요.`;
    $('resultInsight').textContent = ranked[0].ch === 'G'
      ? '초록이 가장 작은 차이까지 보였어요. 사람 눈은 같은 양을 더해도 초록을 가장 밝게 느껴요(시감 효율이 초록에서 가장 큼). 그래서 흑백으로 바꿀 때 0.3R + 0.6G + 0.1B처럼 G에 가장 큰 비중을 줘요.'
      : '사람 눈은 평균적으로 초록을 가장 밝게 느끼지만(흑백 변환 0.3R + 0.6G + 0.1B), 한 번의 기록은 화면 밝기·집중도에 따라 달라질 수 있어요. 같은 화면에서 다시 해 보거나 친구들 결과와 모아 비교해 보세요.';
    el.resultRows.replaceChildren();
    const bestEst = Math.min(...ests);
    ORDER.forEach((ch, i) => {
      const rec = records[i];
      const row = document.createElement('tr');
      const cells = [`${ch} ${NAMES[ch]}`, `${rec.correct} / ${QUESTIONS}`, `Δ ${fmt1(ests[i])}`, `${seconds(rec.elapsedMs)}초`, `${scores[i].toLocaleString('ko-KR')}점`];
      cells.forEach((value, j) => {
        const cell = document.createElement(j === 0 ? 'th' : 'td');
        if (j === 0) cell.scope = 'row';
        cell.textContent = value;
        row.appendChild(cell);
      });
      el.resultRows.appendChild(row);
      $('bar' + ch).style.width = `${Math.max(4, Math.min(100, bestEst / ests[i] * 100))}%`;
      $('barText' + ch).textContent = `구별 경계 Δ ${fmt1(ests[i])} · 눈 점수 ${scores[i].toLocaleString('ko-KR')}점`;
    });
    renderRecords();
    el.retry.focus({ preventScroll: true });
    el.result.scrollIntoView({ block: 'nearest' });
  }

  function resetGame() {
    stopScheduledWork();
    state.runId += 1;
    state.phase = 'ready';
    state.qIndex = 0;
    state.records = freshRecords();
    state.practicing = false;
    state.practiceIndex = 0;
    state.basePlan = [];
    state.positionPlans = {};
    el.board.replaceChildren();
    el.ready.hidden = false;
    el.play.hidden = true;
    el.result.hidden = true;
    renderRecords();
  }

  function beginGame() {
    state.basePlan = makeBasePlan();
    state.positionPlans = makePositionPlans();
    state.practicing = true;
    el.ready.hidden = true;
    el.play.hidden = false;
    el.feedback.dataset.kind = 'notice';
    el.feedback.textContent = '먼저 R 빨강 연습이에요. 색이 다른 한 칸을 찾아보세요. 연습은 기록에 넣지 않아요.';
    startStage();
    el.play.scrollIntoView({ block: 'nearest' });
  }

  function openStartRules() {
    if ($('startRulesDialog').open || state.phase === 'countdown') return;
    $('startRulesDialog').showModal();
    $('confirmStartRules').focus();
  }
  function beginCountdown() {
    $('startRulesDialog').close();
    resetGame();
    state.phase = 'countdown';
    const runId = state.runId;
    const dialog = $('countdownDialog');
    let number = 5;
    $('countdownNumber').textContent = '5!';
    dialog.showModal();
    function advance() {
      if (state.runId !== runId || state.phase !== 'countdown') return;
      if (document.hidden) { state.nextTimer = setTimeout(advance, 1000); return; }   // 다른 탭이면 준비 시간 멈춤
      number--;
      if (number === 0) { state.nextTimer = 0; dialog.close(); beginGame(); return; }
      $('countdownNumber').textContent = `${number}!`;
      state.nextTimer = setTimeout(advance, 1000);
    }
    state.nextTimer = setTimeout(advance, 1000);
  }
  function cancelCountdown() {
    $('countdownDialog').close();
    resetGame();
    el.start.focus({ preventScroll: true });
  }

  for (const host of document.querySelectorAll('[data-rule-image]')) host.append($('rulesImageTemplate').content.cloneNode(true));
  el.start.addEventListener('click', openStartRules);
  el.retry.addEventListener('click', openStartRules);
  $('closeStartRules').addEventListener('click', () => $('startRulesDialog').close());
  $('confirmStartRules').addEventListener('click', beginCountdown);
  $('cancelCountdown').addEventListener('click', cancelCountdown);
  $('countdownDialog').addEventListener('cancel', event => { event.preventDefault(); cancelCountdown(); });
  el.board.addEventListener('click', event => {
    const tile = event.target.closest('.tile');
    if (tile && el.board.contains(tile)) resolveRound(Number(tile.dataset.index));
  });
  el.board.addEventListener('keydown', event => {
    if (state.phase !== 'playing') return;
    const tile = event.target.closest('.tile');
    if (!tile || !el.board.contains(tile)) return;
    const G = state.grid;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -G, ArrowDown: G };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const index = Number(tile.dataset.index);
    const next = index + moves[event.key];
    if (next < 0 || next >= G * G) return;
    if (Math.abs(moves[event.key]) === 1 && Math.floor(next / G) !== Math.floor(index / G)) return;
    tile.tabIndex = -1;
    el.board.children[next].tabIndex = 0;
    el.board.children[next].focus();
  });
  window.addEventListener('pagehide', () => {
    state.runId += 1;
    stopScheduledWork();
    if ($('countdownDialog').open) $('countdownDialog').close();
    if ($('startRulesDialog').open) $('startRulesDialog').close();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) resetGame(); });
  // 시험용: 내부 상태 확인 (화면 동작에는 영향 없음)
  window.__rgbSensitivity3 = { state, ORDER, QUESTIONS, TOTAL };
  resetGame();
})();
