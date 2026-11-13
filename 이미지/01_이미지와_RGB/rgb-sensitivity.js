(() => {
  'use strict';

  const ORDER = ['R', 'G', 'B'];
  const NAMES = { R: '빨강', G: '초록', B: '파랑' };
  // 기준색(24칸)은 문제마다 새로 뽑아 눈이 한 색에 익숙해지지 않게 한다.
  // R·G·B 모두 같은 범위에서 뽑고 같은 Δ표를 쓰므로 세 계열 비교는 그대로 공정하다.
  // 주 채널 145~205(+Δ 해도 255 이하), 나머지 두 채널 각각 30~90.
  const FAMILY_RANGE = [145, 205];
  const SECONDARY_RANGE = [30, 90];
  const MIN_BASE_SHIFT = 20;   // 직전 문제 기준색과 적어도 한 채널은 이만큼 달라야 함
  // 단계별 증가량. 쉬운 구간(누구나 보이는 큰 차이)은 짧게, 경계가 나오는 10~4 구간은 1씩 촘촘하게.
  // Only the active channel increases; no channel is rescaled.
  const DELTAS = [24, 20, 17, 15, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  // 계단식 측정: 맞히면 한 단계 어렵게, 틀리면 두 단계 쉽게. 실수 한 번으로 끝나지 않고
  // 자기 눈의 경계 근처를 오르내리게 된다.
  const QUESTIONS = 20;
  const STEP_UP = 1;
  const STEP_DOWN = 2;
  const STAGE_MS = 10000;
  const GRID = 5;
  const $ = id => document.getElementById(id);
  const freshRecords = () => Object.fromEntries(ORDER.map(ch => [ch,
    { correct: 0, mistakes: 0, asked: 0, points: 0, elapsedMs: 0, trail: [], done: false }
  ]));
  const state = {
    phase: 'ready', channelIndex: 0, stage: 1, records: freshRecords(),
    answerIndex: 0, focusIndex: 0, questionStartedAt: 0, deadline: 0,
    rafId: 0, nextTimer: 0, runId: 0, lastBase: null
  };
  const el = {
    ready: $('readyPanel'), play: $('playPanel'), result: $('resultPanel'),
    board: $('board'), channel: $('chValue'), stage: $('stageValue'),
    correct: $('correctValue'), time: $('timeValue'), timebar: $('timebarFill'),
    question: $('questionValue'), delta: $('deltaLine'), feedback: $('feedback'),
    start: $('startBtn'), retry: $('retryBtn'), resultRows: $('resultRows')
  };
  const currentChannel = () => ORDER[state.channelIndex];
  const currentRecord = () => state.records[currentChannel()];
  const seconds = ms => (ms / 1000).toFixed(1);

  // Only active solving time counts; feedback and channel transitions are excluded.
  // 정답 점수는 맞힌 단계 × 10점이라 어려운 단계에서 맞힐수록 크다.
  function scoreFor(record) {
    const base = record.points;
    const bonus = Math.round(Math.max(0, record.correct * 50 - record.elapsedMs / 1000 * 5));
    return { base, bonus, total: base + bonus };
  }

  // 구별 경계: 맞히다가 틀린 곳, 틀리다가 다시 맞힌 곳(방향이 바뀐 곳)의 Δ 평균.
  // 처음 바뀐 곳들은 초반 실수(쉬운 단계에서 틀리고 다시 맞힘)일 때가 많아,
  // 네 곳 이상이면 앞의 두 곳, 두세 곳이면 앞의 한 곳을 빼고 평균한다.
  function thresholdOf(record) {
    const t = record.trail;
    if (!t.length) return null;
    const turns = [];
    for (let i = 1; i < t.length; i++) if (t[i].ok !== t[i - 1].ok) turns.push(t[i].delta);
    if (!turns.length) {
      if (t.every(q => q.ok)) return { value: Math.min(...t.map(q => q.delta)), kind: 'below' };
      return { value: DELTAS[0], kind: 'above' };
    }
    const used = turns.slice(turns.length >= 4 ? 2 : turns.length >= 2 ? 1 : 0);
    return { value: used.reduce((n, d) => n + d, 0) / used.length, kind: 'exact' };
  }

  function thresholdText(th) {
    if (!th) return '-';
    if (th.kind === 'below') return `${th.value} 이하`;
    if (th.kind === 'above') return `${th.value} 초과`;
    return String(Number(th.value.toFixed(1)));
  }

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
      $('recordScore' + ch).textContent = scoreFor(record).total.toLocaleString('ko-KR');
      $('recordMeta' + ch).textContent = `${record.asked}/${QUESTIONS}문제 · ${seconds(record.elapsedMs)}초`;
      $('recordStatus' + ch).textContent = record.done ? '완료' : active ? '진행 중' : '대기';
    }
  }

  function renderHud() {
    const ch = currentChannel();
    const record = currentRecord();
    el.play.dataset.ch = ch;
    el.channel.textContent = `${ch} ${NAMES[ch]}`;
    el.stage.textContent = `${state.stage} / ${DELTAS.length}`;
    el.correct.textContent = `${record.correct}개`;
    el.question.textContent = `${Math.min(record.asked + 1, QUESTIONS)} / ${QUESTIONS}`;
    el.delta.textContent = `${NAMES[ch]} 계열 · ${ch}만 +${DELTAS[state.stage - 1]} · 바탕색은 문제마다 바뀜`;
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

  function pickBase(index) {
    const prev = state.lastBase;
    let base;
    for (let tries = 0; tries < 20; tries++) {
      base = ORDER.map((_, i) => i === index ? randInt(...FAMILY_RANGE) : randInt(...SECONDARY_RANGE));
      if (!prev || base.some((v, i) => Math.abs(v - prev[i]) >= MIN_BASE_SHIFT)) break;
    }
    state.lastBase = base;
    return base;
  }

  function buildBoard() {
    const index = state.channelIndex;
    const delta = DELTAS[state.stage - 1];
    const base = pickBase(index);
    const odd = base.slice();
    odd[index] += delta;
    state.answerIndex = randInt(0, GRID * GRID - 1);
    state.focusIndex = 0;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < GRID * GRID; i++) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(i);
      tile.tabIndex = i === 0 ? 0 : -1;
      tile.setAttribute('aria-label', `${Math.floor(i / GRID) + 1}행 ${i % GRID + 1}열`);
      tile.style.background = rgbText(i === state.answerIndex ? odd : base);
      fragment.appendChild(tile);
    }
    el.board.replaceChildren(fragment);
  }

  function tick(now) {
    if (state.phase !== 'playing') return;
    if (renderTime(now) <= 0) {
      resolveRound(null, now);
      return;
    }
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

  function completeChannel() {
    const ch = currentChannel();
    currentRecord().done = true;
    const next = ORDER[state.channelIndex + 1];
    el.feedback.textContent += next
      ? ` ${ch} ${QUESTIONS}문제 완료! 잠시 후 ${next} ${NAMES[next]}으로 넘어가요.`
      : ' 세 계열 완료! 결과를 계산해요.';
    renderRecords();
    scheduleNext(() => {
      if (!next) { finishGame(); return; }
      state.channelIndex += 1;
      state.stage = 1;
      el.feedback.dataset.kind = 'notice';
      el.feedback.textContent = `${next} ${NAMES[next]} 시작! ${QUESTIONS}문제를 풀어요.`;
      startStage();
    }, 1200);
  }

  function resolveRound(index, now = performance.now()) {
    // This lock also prevents double clicks from counting one board twice.
    if (state.phase !== 'playing') return;
    state.phase = 'feedback';
    cancelAnimationFrame(state.rafId);
    const timedOut = now >= state.deadline;
    const correct = !timedOut && index === state.answerIndex;
    const record = currentRecord();
    record.elapsedMs += Math.max(0, Math.min(STAGE_MS, now - state.questionStartedAt));
    record.asked += 1;
    record.trail.push({ stage: state.stage, delta: DELTAS[state.stage - 1], ok: correct });
    renderTime(now);
    for (const tile of el.board.children) tile.disabled = true;
    const nextStage = correct
      ? Math.min(DELTAS.length, state.stage + STEP_UP)
      : Math.max(1, state.stage - STEP_DOWN);
    if (correct) {
      record.correct += 1;
      record.points += state.stage * 10;
      el.feedback.dataset.kind = 'correct';
      el.feedback.textContent = nextStage > state.stage
        ? '정답! 한 단계 어려워져요.'
        : '정답! 가장 어려운 단계를 유지해요.';
    } else {
      record.mistakes += 1;
      el.feedback.dataset.kind = 'wrong';
      el.feedback.textContent = `${timedOut ? '시간 초과!' : '아쉬워요!'} ${nextStage < state.stage ? `${state.stage - nextStage}단계 쉬워져요.` : '같은 단계로 다시 해요.'}`;
      const answer = el.board.children[state.answerIndex];
      answer.classList.add('is-answer');
      answer.textContent = '정답';
      if (!timedOut && index !== null) el.board.children[index].textContent = '✕';
    }
    renderRecords();
    if (record.asked >= QUESTIONS) {
      completeChannel();
      return;
    }
    scheduleNext(() => {
      state.stage = nextStage;
      startStage();
    }, correct ? 180 : 900);
  }

  function finishGame() {
    stopScheduledWork();
    state.phase = 'done';
    el.play.hidden = true;
    el.result.hidden = false;
    const records = ORDER.map(ch => state.records[ch]);
    const correct = records.reduce((n, rec) => n + rec.correct, 0);
    const elapsed = records.reduce((n, rec) => n + rec.elapsedMs, 0);
    const scores = records.map(scoreFor);
    const total = scores.reduce((n, score) => n + score.total, 0);
    const ths = records.map(thresholdOf);
    $('totalScore').textContent = total.toLocaleString('ko-KR');
    $('totalCorrect').textContent = `${correct} / ${QUESTIONS * ORDER.length}개`;
    $('totalTime').textContent = `${seconds(elapsed)}초`;
    $('scoreBreakdown').textContent = `정답 점수 ${scores.reduce((n, score) => n + score.base, 0).toLocaleString('ko-KR')}점 + 시간 보너스 ${scores.reduce((n, score) => n + score.bonus, 0).toLocaleString('ko-KR')}점`;
    const best = Math.min(...ths.map(th => th.value));
    const bestChs = ORDER.filter((ch, i) => ths[i].value === best);
    $('resultNote').textContent = `가장 작은 차이까지 구별한 계열은 ${bestChs.join(' · ')} (구별 경계 ${thresholdText(ths[ORDER.indexOf(bestChs[0])])})! 같은 화면과 밝기에서 다시 비교해 보세요.`;
    $('resultInsight').textContent = '구별 경계 = 맞히다가 틀린 곳과 틀리다가 다시 맞힌 곳의 증가량 평균이에요. 작을수록 더 작은 차이까지 구별한 거예요.';
    el.resultRows.replaceChildren();
    ORDER.forEach((ch, i) => {
      const rec = state.records[ch];
      const row = document.createElement('tr');
      const cells = [`${ch} ${NAMES[ch]}`, `${rec.correct} / ${QUESTIONS}`, thresholdText(ths[i]), `${seconds(rec.elapsedMs)}초`, `${scores[i].total.toLocaleString('ko-KR')}점`];
      cells.forEach((value, j) => {
        const cell = document.createElement(j === 0 ? 'th' : 'td');
        if (j === 0) cell.scope = 'row';
        cell.textContent = value;
        row.appendChild(cell);
      });
      el.resultRows.appendChild(row);
      $('bar' + ch).style.width = `${Math.min(100, scores[i].total / 3000 * 100)}%`;
      $('barText' + ch).textContent = `${scores[i].total.toLocaleString('ko-KR')}점 · 구별 경계 ${thresholdText(ths[i])}`;
    });
    renderRecords();
    el.retry.focus({ preventScroll: true });
    el.result.scrollIntoView({ block: 'nearest' });
  }

  function resetGame() {
    stopScheduledWork();
    state.runId += 1;
    state.phase = 'ready';
    state.channelIndex = 0;
    state.stage = 1;
    state.records = freshRecords();
    el.ready.hidden = false;
    el.play.hidden = true;
    el.result.hidden = true;
    renderRecords();
  }

  function startGame() {
    resetGame();
    el.ready.hidden = true;
    el.play.hidden = false;
    el.feedback.dataset.kind = 'notice';
    el.feedback.textContent = 'R 빨강부터 시작해요. 색이 다른 한 칸을 찾아보세요.';
    startStage();
    el.play.scrollIntoView({ block: 'nearest' });
  }

  el.start.addEventListener('click', startGame);
  el.retry.addEventListener('click', startGame);
  el.board.addEventListener('click', event => {
    const tile = event.target.closest('.tile');
    if (tile && el.board.contains(tile)) resolveRound(Number(tile.dataset.index));
  });
  el.board.addEventListener('keydown', event => {
    if (state.phase !== 'playing') return;
    const tile = event.target.closest('.tile');
    if (!tile || !el.board.contains(tile)) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -GRID, ArrowDown: GRID };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const index = Number(tile.dataset.index);
    const next = index + moves[event.key];
    if (next < 0 || next >= GRID * GRID) return;
    if (Math.abs(moves[event.key]) === 1 && Math.floor(next / GRID) !== Math.floor(index / GRID)) return;
    tile.tabIndex = -1;
    el.board.children[next].tabIndex = 0;
    el.board.children[next].focus();
  });
  window.addEventListener('pagehide', () => { state.runId += 1; stopScheduledWork(); });
  window.addEventListener('pageshow', event => { if (event.persisted) resetGame(); });
  resetGame();
})();
