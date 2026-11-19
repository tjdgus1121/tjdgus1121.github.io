(() => {
  'use strict';

  const ORDER = ['R', 'G', 'B'];
  const NAMES = { R: '빨강', G: '초록', B: '파랑' };
  // 한 번 뽑은 주 채널 기준값 7개를 R·G·B에 같은 순서로 사용한다.
  // 비선택 채널은 공통값 32. 실제 RGB만 표시하며 색별 Δ·점수 보정은 하지 않는다.
  // (2026-11-15 계산: 주 채널 130~190·나머지 32에서 같은 Δ의 사람 눈 색차 CIEDE2000이 G가 R의 1.54배, R이 B의 1.48배로
  //  세 색 사이가 고르게 벌어져 G > R > B 순서가 가장 또렷이 드러남. 세 색 조건은 그대로 같음)
  const FAMILY_RANGE = [130, 190];
  const SECONDARY_LEVEL = 32;
  const PRACTICE_LEVEL = 160;
  const PRACTICE_STAGE = 5;   // 연습은 Δ12 — 본게임 첫 문제(Δ9)와 차이가 너무 크지 않게
  const MIN_BASE_SHIFT = 20;   // 직전 문제 기준색과 주 채널 값이 이만큼 달라야 함
  // 단계별 증가량. 쉬운 구간(누구나 보이는 큰 차이)은 짧게, 경계가 나오는 10~1 구간은 1씩 촘촘하게.
  // Δ1까지 두어 눈이 좋은 학생이 마지막 단계에 막혀 R·G·B 차이가 사라지지 않게 한다.
  // Only the active channel increases; no channel is rescaled.
  const DELTAS = [24, 20, 17, 15, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  // 계단식 측정: Δ9(8단계)에서 시작해 맞히면 1단계 어렵게, 틀리면 1단계 쉽게. 세 색 모두 같은 규칙.
  // 누구나 보이는 큰 Δ에 문제를 쓰지 않고 눈의 경계 근처에서 천천히 내려가
  // 같은 Δ라도 색마다 다르게 보이는 차이(G > R > B)가 점수에 드러난다.
  // (같은 민감도 가상 관찰자 시뮬, G > R > B 순서 그대로: 색마다 10문제 74% · 7문제 55%(정답률 72→79%로 조금 쉬워짐).
  //  7문제에서 Δ10 시작으로 더 쉽게 하면 45%로 떨어져 Δ9 시작 유지)
  const QUESTIONS = 7;
  const START_STAGE = 8;   // DELTAS[7] = 9
  const STEP_UP = 1;
  const STEP_DOWN = 1;
  const MAX_SCORE = Array.from({ length: QUESTIONS }, (_, i) => Math.min(DELTAS.length, START_STAGE + i * STEP_UP) * 10).reduce((sum, points) => sum + points, 0);
  const STAGE_MS = 10000;
  // 칸 수: 색마다 1·2번째 문제 3×3(9칸), 3·4번째 4×4(16칸), 5~7번째 5×5(25칸). 세 색 모두 같음. 연습은 3×3
  const GRID_BY_Q = [3, 3, 4, 4, 5, 5, 5];
  const PRACTICE_GRID = 3;
  const $ = id => document.getElementById(id);
  const freshRecords = () => Object.fromEntries(ORDER.map(ch => [ch,
    { correct: 0, mistakes: 0, asked: 0, points: 0, elapsedMs: 0, trail: [], done: false }
  ]));
  const state = {
    // 본게임은 R→G→B→R→G→B… 문제마다 번갈아 냄(qIndex). 단계는 색마다 따로(stages), stage는 지금 색의 단계
    phase: 'ready', qIndex: 0, stages: { R: START_STAGE, G: START_STAGE, B: START_STAGE }, stage: START_STAGE, records: freshRecords(),
    answerIndex: 0, focusIndex: 0, questionStartedAt: 0, deadline: 0,
    rafId: 0, nextTimer: 0, runId: 0,
    practicing: false, practiceIndex: 0, basePlan: [], positionPlans: {}, grid: PRACTICE_GRID
  };
  const el = {
    ready: $('readyPanel'), play: $('playPanel'), result: $('resultPanel'), ranking: $('liveRankingPanel'),
    board: $('board'), channel: $('chValue'), stage: $('stageValue'),
    correct: $('correctValue'), time: $('timeValue'), timebar: $('timebarFill'),
    question: $('questionValue'), delta: $('deltaLine'), feedback: $('feedback'),
    start: $('startBtn'), retry: $('retryBtn'), resultRows: $('resultRows')
  };
  const TOTAL = QUESTIONS * ORDER.length;
  const currentChannel = () => ORDER[state.practicing ? state.practiceIndex : state.qIndex % ORDER.length];
  const currentRecord = () => state.records[currentChannel()];
  const currentDelta = () => state.practicing ? DELTAS[PRACTICE_STAGE - 1] : DELTAS[state.stage - 1];
  const seconds = ms => (ms / 1000).toFixed(1);

  // Only active solving time counts; feedback and channel transitions are excluded.
  // 정답 점수는 맞힌 단계 × 10점이라 어려운 단계에서 맞힐수록 크다.
  function scoreFor(record) {
    return { total: record.points };
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
      $('recordStatus' + ch).textContent = record.done ? '완료' : active ? (state.practicing ? '연습' : '진행 중') : '대기';
    }
  }

  function renderHud() {
    const ch = currentChannel();
    const record = currentRecord();
    el.play.dataset.ch = ch;
    el.channel.textContent = `${state.practicing ? '연습 · ' : ''}${ch} ${NAMES[ch]}`;
    el.stage.textContent = state.practicing ? '연습' : `${state.stage} / ${DELTAS.length}`;
    el.correct.textContent = state.practicing ? '미반영' : `${record.correct}개`;
    el.question.textContent = state.practicing ? `${state.practiceIndex + 1} / ${ORDER.length}` : `${Math.min(state.qIndex + 1, TOTAL)} / ${TOTAL}`;
    const otherChannels = ORDER.filter(value => value !== ch).join('·');
    const level = state.practicing ? PRACTICE_LEVEL : state.basePlan[record.asked];
    el.delta.textContent = `${ch} ${level} → ${level + currentDelta()} (+${currentDelta()}) · ${otherChannels}=${SECONDARY_LEVEL}`;
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

  function makeBasePlan() {
    const plan = [];
    const [min, max] = FAMILY_RANGE;
    for (let question = 0; question < QUESTIONS; question++) {
      const prev = plan[question - 1];
      let level = randInt(min, max);
      for (let tries = 1; prev !== undefined && Math.abs(level - prev) < MIN_BASE_SHIFT && tries < 20; tries++) level = randInt(min, max);
      if (prev !== undefined && Math.abs(level - prev) < MIN_BASE_SHIFT) level = prev < (min + max) / 2 ? max : min;
      plan.push(level);
    }
    return plan;
  }

  function buildBoard() {
    const ch = currentChannel();
    const index = ORDER.indexOf(ch);
    const delta = currentDelta();
    const level = state.practicing ? PRACTICE_LEVEL : state.basePlan[currentRecord().asked];
    const base = ORDER.map((_, i) => i === index ? level : SECONDARY_LEVEL);
    const odd = base.slice();
    odd[index] += delta;
    const n = state.practicing ? PRACTICE_GRID : GRID_BY_Q[Math.min(currentRecord().asked, GRID_BY_Q.length - 1)];
    state.grid = n;
    el.board.style.setProperty('--grid', String(n));
    el.board.dataset.grid = String(n);
    state.answerIndex = state.practicing ? randInt(0, n * n - 1) : state.positionPlans[ch][currentRecord().asked];
    state.focusIndex = 0;
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

  function resolveRound(index, now = performance.now()) {
    // This lock also prevents double clicks from counting one board twice.
    if (state.phase !== 'playing') return;
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
      el.feedback.textContent = `${correct ? '찾았어요!' : timedOut ? '시간이 끝났어요. 정답 칸을 확인해 보세요.' : '표시된 정답 칸을 확인해 보세요.'} 연습은 점수와 풀이 시간에 포함하지 않아요.`;
      renderRecords();
      scheduleNext(() => {
        state.practiceIndex++;
        if (state.practiceIndex >= ORDER.length) {
          state.practicing = false;
          state.qIndex = 0;
          state.stage = state.stages[currentChannel()];
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
    const record = currentRecord();
    record.elapsedMs += Math.max(0, Math.min(STAGE_MS, now - state.questionStartedAt));
    record.asked += 1;
    record.trail.push({ stage: state.stage, delta: currentDelta(), ok: correct });
    const nextStage = correct
      ? Math.min(DELTAS.length, state.stage + STEP_UP)
      : Math.max(1, state.stage - STEP_DOWN);
    if (correct) {
      record.correct += 1;
      record.points += state.stage * 10;
      el.feedback.dataset.kind = 'correct';
      el.feedback.textContent = nextStage > state.stage
        ? `정답! 다음 ${currentChannel()} 문제는 ${nextStage - state.stage}단계 어려워져요.`
        : `정답! ${currentChannel()}는 가장 어려운 단계를 유지해요.`;
    } else {
      record.mistakes += 1;
      el.feedback.dataset.kind = 'wrong';
      el.feedback.textContent = `${timedOut ? '시간 초과!' : '아쉬워요!'} ${nextStage < state.stage ? `다음 ${currentChannel()} 문제는 ${state.stage - nextStage}단계 쉬워져요.` : `${currentChannel()}는 같은 단계로 다시 해요.`}`;
    }
    const ch = currentChannel();
    state.stages[ch] = nextStage;   // 이 색의 다음 문제 단계 (다른 색 단계는 그대로)
    if (record.asked >= QUESTIONS) record.done = true;
    state.qIndex += 1;
    renderRecords();
    if (state.qIndex >= TOTAL) {
      el.feedback.textContent += ` ${TOTAL}문제 완료! 결과를 계산해요.`;
      scheduleNext(finishGame, 1200);
      return;
    }
    scheduleNext(() => {
      state.stage = state.stages[currentChannel()];
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
    $('scoreBreakdown').textContent = '정답 점수만 합산 · 풀이 시간은 별도 기록 · 연습 제외';
    const best = Math.max(...scores.map(score => score.total));
    // 이번 순서 (동점은 =)
    const ranked = ORDER.map((ch, i) => ({ ch, s: scores[i].total })).sort((a, b) => b.s - a.s);
    const orderText = ranked.map((x, i) => (i ? (ranked[i - 1].s === x.s ? ' = ' : ' > ') : '') + x.ch).join('');
    const bestChs = ORDER.filter((ch, i) => scores[i].total === best);
    $('resultNote').textContent = `이번 순서 ${orderText}. ` + (best === 0 ? '이번에는 맞힌 문제가 없었어요. 같은 화면과 밝기에서 다시 비교해 보세요.' : bestChs.length === ORDER.length ? `세 채널이 ${best.toLocaleString('ko-KR')}점으로 동점이에요. 같은 화면과 밝기에서 다시 비교해 보세요.` : `이번 관찰 점수 1위: ${bestChs.join(' · ')} (${best.toLocaleString('ko-KR')}점). 결과는 내가 실제로 찾은 기록 그대로예요.`);
    $('resultInsight').textContent = '구별 경계는 이번 게임에서 방향이 바뀐 증가량(Δ)으로 추정한 값이에요. 색조와 밝기를 함께 구별한 기록이며, 흑백 가중치를 직접 측정한 값은 아니에요.';
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
      $('bar' + ch).style.width = `${Math.min(100, scores[i].total / MAX_SCORE * 100)}%`;
      $('barText' + ch).textContent = `${scores[i].total.toLocaleString('ko-KR')}점 · 구별 경계 ${thresholdText(ths[i])}`;
    });
    renderRecords();
    el.retry.focus({ preventScroll: true });
    el.result.scrollIntoView({ block: 'nearest' });
    window.dispatchEvent(new CustomEvent('rgb-sensitivity:complete', { detail: completedResult() }));
  }

  function resetGame() {
    stopScheduledWork();
    state.runId += 1;
    state.phase = 'ready';
    state.qIndex = 0;
    state.stages = { R: START_STAGE, G: START_STAGE, B: START_STAGE };
    state.stage = START_STAGE;
    state.records = freshRecords();
    state.practicing = false;
    state.practiceIndex = 0;
    state.basePlan = [];
    state.positionPlans = {};
    el.board.replaceChildren();
    el.ready.hidden = false;
    el.play.hidden = true;
    el.result.hidden = true;
    el.ranking.hidden = true;
    document.body.classList.remove('has-ranking');
    renderRecords();
    window.dispatchEvent(new CustomEvent('rgb-sensitivity:reset'));
  }

  // 정답 위치: 칸 수가 같은 문제끼리 묶어 세 색이 같은 위치 묶음을 순서만 섞어 씀(위치 분포 공정). 번호는 서로 겹치지 않게
  function makePositionPlans() {
    const used = new Set();
    const plans = Object.fromEntries(ORDER.map(ch => [ch, []]));
    const groups = {};
    GRID_BY_Q.slice(0, QUESTIONS).forEach((n, q) => { (groups[n] = groups[n] || []).push(q); });
    for (const [size, qs] of Object.entries(groups)) {
      const n = Number(size);
      const pool = shuffled(Array.from({ length: n * n }, (_, i) => i).filter(i => !used.has(i))).slice(0, qs.length);
      pool.forEach(i => used.add(i));
      for (const ch of ORDER) {
        const order = shuffled(pool);
        qs.forEach((q, k) => { plans[ch][q] = order[k]; });
      }
    }
    return plans;
  }

  function beginGame() {
    state.basePlan = makeBasePlan();
    state.positionPlans = makePositionPlans();
    state.practicing = true;
    el.ready.hidden = true;
    el.play.hidden = false;
    el.ranking.hidden = false;
    document.body.classList.add('has-ranking');
    el.feedback.dataset.kind = 'notice';
    el.feedback.textContent = '먼저 R 빨강 연습이에요. 색이 다른 한 칸을 찾아보세요. 연습은 점수에 포함하지 않아요.';
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
      // Do not spend the visible preparation time while the student is on another tab.
      if (document.hidden) { state.nextTimer = setTimeout(advance, 1000); return; }
      number--;
      if (number === 0) {
        state.nextTimer = 0;
        dialog.close();
        beginGame();
        return;
      }
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

  function completedResult() {
    return {
      score: ORDER.reduce((sum, ch) => sum + state.records[ch].points, 0),
      correct: ORDER.reduce((sum, ch) => sum + state.records[ch].correct, 0),
      attempted: QUESTIONS * ORDER.length,
      channels: Object.fromEntries(ORDER.map(ch => [ch, { score: state.records[ch].points, correct: state.records[ch].correct }]))
    };
  }

  for (const host of document.querySelectorAll('[data-rule-image]')) host.append($('rulesImageTemplate').content.cloneNode(true));
  el.start.addEventListener('click', openStartRules);
  el.retry.addEventListener('click', openStartRules);
  $('closeStartRules').addEventListener('click', () => $('startRulesDialog').close());
  $('confirmStartRules').addEventListener('click', beginCountdown);
  $('cancelCountdown').addEventListener('click', cancelCountdown);
  $('countdownDialog').addEventListener('cancel', event => { event.preventDefault(); cancelCountdown(); });
  window.addEventListener('rgb-sensitivity:request-result', () => {
    if (state.phase === 'done') window.dispatchEvent(new CustomEvent('rgb-sensitivity:complete', { detail: completedResult() }));
  });
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
  resetGame();
})();
