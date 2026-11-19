(() => {
  'use strict';

  const CHANNELS = ['R', 'G', 'B'];
  const NAMES = { R: '빨강', G: '초록', B: '파랑' };
  const WEIGHT_TENTHS = { R: 3, G: 6, B: 1 };
  const BASES = [104, 128, 152];
  const DELTAS = [24, 16, 10, 6, 3];
  const GRID = 5;
  const LIMIT_MS = 10000;
  const TRIALS_PER_CHANNEL = BASES.length * DELTAS.length;
  const $ = id => document.getElementById(id);
  const rgbText = values => `rgb(${values.join(', ')})`;
  const colorFor = (base, channel, delta) => CHANNELS.map(ch => base + (ch === channel ? delta : 0));
  const fixedOne = value => String(Number(value.toFixed(1)));
  const shuffle = source => {
    const copy = source.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const state = {
    phase: 'ready', trials: [], observation: [], trialIndex: 0,
    predictions: [], predictionIndex: 0, predictionAnswers: [],
    deadline: 0, remaining: LIMIT_MS, startedAt: 0, elapsedBeforePause: 0,
    rafId: 0, focusIndex: 0
  };

  // Identical base/delta combinations and target-position distributions for all channels.
  // The balanced rotations put each channel in each position in a triplet exactly five times.
  function makeTrials() {
    const conditions = shuffle(BASES.flatMap(base => DELTAS.map(delta => ({ base, delta }))));
    const order = shuffle(CHANNELS);
    const rotations = shuffle(Array.from({ length: TRIALS_PER_CHANNEL }, (_, i) => i % CHANNELS.length));
    const positions = shuffle(Array.from({ length: GRID * GRID }, (_, i) => i)).slice(0, TRIALS_PER_CHANNEL);
    const byChannel = Object.fromEntries(CHANNELS.map(ch => [ch, shuffle(positions)]));
    return conditions.flatMap((condition, i) => order.map((_, j) => {
      const channel = order[(j + rotations[i]) % CHANNELS.length];
      return { ...condition, channel, answer: byChannel[channel][i] };
    }));
  }

  function makePredictions() {
    return [
      { base: 112, deltas: { R: 24, G: 24, B: 24 } },
      { base: 128, deltas: { R: 12, G: 12, B: 12 } },
      { base: 144, deltas: { R: 6, G: 6, B: 6 } },
      { base: 104, deltas: { R: 32, G: 10, B: 24 } },
      { base: 128, deltas: { R: 6, G: 4, B: 36 } },
      { base: 120, deltas: { R: 12, G: 12, B: 60 } }
    ].map(round => ({ ...round, order: shuffle(CHANNELS) }));
  }

  function stopClock() {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  function showPanel(id, step) {
    for (const panel of document.querySelectorAll('#activity > section')) panel.hidden = panel.id !== id;
    const steps = [$('stepObserve'), $('stepPredict'), $('stepResult')];
    steps.forEach((item, i) => {
      item.classList.toggle('is-complete', i < step);
      if (i === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    const panel = $(id);
    panel.scrollIntoView({ block: 'start', behavior: 'instant' });
    panel.querySelector('h2').focus({ preventScroll: true });
  }

  function renderLiveRecords() {
    $('liveRecords').replaceChildren(...CHANNELS.map(channel => {
      const records = state.observation.filter(item => item.channel === channel);
      const card = document.createElement('div');
      card.className = 'live-record';
      const label = document.createElement('b');
      label.textContent = `${channel} ${NAMES[channel]}`;
      const count = document.createElement('span');
      count.textContent = `${records.filter(item => item.ok).length}점 · ${records.length}/15`;
      card.append(label, count);
      return card;
    }));
  }

  function renderClock(now) {
    const remaining = Math.max(0, state.deadline - now);
    $('timeValue').replaceChildren(document.createTextNode((remaining / 1000).toFixed(1)));
    const unit = document.createElement('small');
    unit.textContent = '초';
    $('timeValue').append(unit);
    $('timeFill').style.transform = `scaleX(${remaining / LIMIT_MS})`;
    return remaining;
  }

  function tick(now) {
    if (state.phase !== 'observing') return;
    if (renderClock(now) <= 0) {
      answerObservation(null, now);
      return;
    }
    state.rafId = requestAnimationFrame(tick);
  }

  function beginObservationTrial() {
    const trial = state.trials[state.trialIndex];
    state.phase = 'observing';
    state.focusIndex = 0;
    state.elapsedBeforePause = 0;
    state.remaining = LIMIT_MS;
    $('observeCount').textContent = `${state.trialIndex + 1} / ${state.trials.length}`;
    $('observeProgress').style.width = `${state.trialIndex / state.trials.length * 100}%`;
    $('activeChannel').textContent = `${trial.channel} ${NAMES[trial.channel]}`;
    $('stimulusLabel').textContent = `같은 회색 ${trial.base} · ${trial.channel}만 +${trial.delta}`;
    $('observeFeedback').textContent = '색이 다른 칸을 골라주세요.';
    $('nextObserveBtn').hidden = true;
    $('pauseBtn').hidden = false;
    const board = $('board');
    const base = [trial.base, trial.base, trial.base];
    const odd = colorFor(trial.base, trial.channel, trial.delta);
    board.replaceChildren(...Array.from({ length: GRID * GRID }, (_, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(index);
      tile.tabIndex = index === 0 ? 0 : -1;
      tile.setAttribute('aria-label', `${Math.floor(index / GRID) + 1}행 ${index % GRID + 1}열`);
      tile.style.backgroundColor = rgbText(index === trial.answer ? odd : base);
      return tile;
    }));
    renderLiveRecords();
    board.children[0].focus({ preventScroll: true });
    state.startedAt = performance.now();
    state.deadline = state.startedAt + LIMIT_MS;
    renderClock(state.startedAt);
    stopClock();
    state.rafId = requestAnimationFrame(tick);
  }

  function start() {
    stopClock();
    if ($('pauseDialog').open) $('pauseDialog').close();
    state.trials = makeTrials();
    state.observation = [];
    state.trialIndex = 0;
    state.predictions = makePredictions();
    state.predictionIndex = 0;
    state.predictionAnswers = [];
    state.phase = 'ready';
    showPanel('observePanel', 0);
    beginObservationTrial();
  }

  function answerObservation(picked, now = performance.now()) {
    if (state.phase !== 'observing') return;
    const trial = state.trials[state.trialIndex];
    const timedOut = now >= state.deadline || picked === null;
    const ok = !timedOut && picked === trial.answer;
    const elapsedMs = Math.min(LIMIT_MS, state.elapsedBeforePause + Math.max(0, now - state.startedAt));
    state.observation.push({ ...trial, ok, timedOut, elapsedMs });
    state.phase = 'observationFeedback';
    stopClock();
    renderClock(now);
    [...$('board').children].forEach((tile, index) => {
      tile.disabled = true;
      if (index === trial.answer) {
        tile.classList.add('is-answer');
        tile.setAttribute('aria-label', `${tile.getAttribute('aria-label')} · 정답`);
      }
      if (!timedOut && picked === index && !ok) tile.classList.add('is-wrong');
    });
    const location = `${Math.floor(trial.answer / GRID) + 1}행 ${trial.answer % GRID + 1}열`;
    $('observeFeedback').textContent = ok ? '찾았어요! 관찰 기록 +1점.' : `${timedOut ? '시간이 끝났어요.' : '이번에는 다른 칸이에요.'} 정답은 ${location}.`;
    renderLiveRecords();
    $('pauseBtn').hidden = true;
    $('nextObserveBtn').hidden = false;
    $('nextObserveBtn').textContent = state.trialIndex + 1 === state.trials.length ? '관찰 결과 보기 →' : '다음 문제 →';
    $('nextObserveBtn').focus({ preventScroll: true });
    // Keep the feedback and next action visible after a touch selection on a small screen.
    $('nextObserveBtn').scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  function nextObservation() {
    if (state.phase !== 'observationFeedback') return;
    state.trialIndex++;
    if (state.trialIndex === state.trials.length) {
      state.phase = 'observed';
      renderSummary($('observationSummary'));
      showPanel('observedPanel', 0);
      return;
    }
    beginObservationTrial();
    $('observePanel').scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function pause() {
    if (state.phase !== 'observing') return;
    const now = performance.now();
    if (now >= state.deadline) {
      answerObservation(null, now);
      return;
    }
    state.remaining = state.deadline - now;
    state.elapsedBeforePause += now - state.startedAt;
    state.phase = 'paused';
    stopClock();
    $('pauseDialog').showModal();
  }

  function resume() {
    if (state.phase !== 'paused') return;
    $('pauseDialog').close();
    state.phase = 'observing';
    state.startedAt = performance.now();
    state.deadline = state.startedAt + state.remaining;
    $('board').children[state.focusIndex].focus({ preventScroll: true });
    renderClock(state.startedAt);
    state.rafId = requestAnimationFrame(tick);
  }

  function renderSummary(container) {
    container.replaceChildren();
    const cards = document.createElement('div');
    cards.className = 'summary-cards';
    const totals = CHANNELS.map(channel => {
      const records = state.observation.filter(item => item.channel === channel);
      const correct = records.filter(item => item.ok);
      const card = document.createElement('article');
      card.className = 'summary-card';
      const title = document.createElement('b');
      title.textContent = `${channel} ${NAMES[channel]}`;
      const score = document.createElement('strong');
      score.textContent = String(correct.length);
      const suffix = document.createElement('small');
      suffix.textContent = ` / ${TRIALS_PER_CHANNEL}점`;
      score.append(suffix);
      const time = document.createElement('p');
      time.textContent = correct.length ? `정답 평균 ${(correct.reduce((sum, item) => sum + item.elapsedMs, 0) / correct.length / 1000).toFixed(1)}초` : '정답 평균 시간 —';
      card.append(title, score, time);
      cards.append(card);
      return correct.length;
    });
    const note = document.createElement('p');
    note.className = 'summary-text';
    const best = Math.max(...totals);
    const names = CHANNELS.filter((_, index) => totals[index] === best).join(' · ');
    note.textContent = best === 0 ? '이번에는 찾은 칸이 없었어요. 같은 화면과 밝기에서 다시 관찰해 보세요.' : `이번에 가장 많이 찾은 채널: ${names} (${best}/15). 같은 수치의 변화를 내가 얼마나 잘 찾았는지 보여주는 기록이에요.`;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    table.className = 'results-table';
    const caption = table.createCaption();
    caption.textContent = '증가량별 정답 수 · 각 채널에서 같은 Δ를 3번씩 관찰';
    const head = table.createTHead().insertRow();
    ['증가량 Δ', 'R 빨강', 'G 초록', 'B 파랑'].forEach(text => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = text;
      head.append(cell);
    });
    const body = table.createTBody();
    DELTAS.forEach(delta => {
      const row = body.insertRow();
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = `+${delta}`;
      row.append(label);
      CHANNELS.forEach(channel => {
        const correct = state.observation.filter(item => item.channel === channel && item.delta === delta && item.ok).length;
        row.insertCell().textContent = `${correct} / ${BASES.length}`;
      });
    });
    wrap.append(table);
    const footnote = document.createElement('p');
    footnote.className = 'observation-footnote';
    footnote.textContent = '색조와 밝기를 함께 구별한 기록이에요. 이 점수로 흑백 가중치 3:6:1을 측정하거나 증명하지는 않아요.';
    container.append(cards, note, wrap, footnote);
  }

  const grayFor = (round, channel) => round.base + round.deltas[channel] * WEIGHT_TENTHS[channel] / 10;
  const bestFor = round => CHANNELS.reduce((best, ch) => grayFor(round, ch) > grayFor(round, best) ? ch : best, 'R');

  function beginPrediction() {
    const round = state.predictions[state.predictionIndex];
    state.phase = 'predicting';
    $('predictCount').textContent = `${state.predictionIndex + 1} / ${state.predictions.length}`;
    const sameDelta = new Set(Object.values(round.deltas)).size === 1;
    $('predictionInstruction').textContent = `기준은 모두 회색 ${round.base}예요. ${sameDelta ? `각 채널에 똑같이 +${round.deltas.R}를 넣었어요.` : '이번에는 채널마다 더하는 양이 달라요. 가중치와 증가량을 함께 보세요.'}`;
    $('predictFeedback').textContent = '공식으로 바꾼 흑백 밝기가 가장 클 카드를 고르세요.';
    $('nextPredictBtn').hidden = true;
    $('predictionCards').replaceChildren(...round.order.map(channel => {
      const card = document.createElement('article');
      card.className = 'prediction-card';
      card.dataset.channel = channel;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'prediction-choice';
      button.dataset.channel = channel;
      button.setAttribute('aria-label', `${channel} ${NAMES[channel]}에 ${round.deltas[channel]} 더한 카드 선택`);
      const patch = document.createElement('span');
      patch.className = 'color-patch';
      patch.style.backgroundColor = rgbText(colorFor(round.base, channel, round.deltas[channel]));
      const label = document.createElement('strong');
      label.className = 'card-label';
      label.textContent = `${channel} +${round.deltas[channel]}`;
      const name = document.createElement('small');
      name.textContent = NAMES[channel];
      label.append(name);
      const rgb = document.createElement('code');
      rgb.textContent = `(${colorFor(round.base, channel, round.deltas[channel]).join(',')})`;
      const select = document.createElement('span');
      select.className = 'pick-label';
      select.textContent = '이 카드 선택 →';
      button.append(patch, label, rgb, select);
      const result = document.createElement('div');
      result.className = 'gray-result';
      result.hidden = true;
      card.append(button, result);
      return card;
    }));
  }

  function answerPrediction(channel) {
    if (state.phase !== 'predicting' || !CHANNELS.includes(channel)) return;
    const round = state.predictions[state.predictionIndex];
    const best = bestFor(round);
    const ok = channel === best;
    state.predictionAnswers.push({ picked: channel, best, ok });
    state.phase = 'predictionFeedback';
    for (const card of $('predictionCards').children) {
      const ch = card.dataset.channel;
      const gray = grayFor(round, ch);
      const increase = round.deltas[ch] * WEIGHT_TENTHS[ch] / 10;
      card.classList.toggle('is-picked', ch === channel);
      card.classList.toggle('is-best', ch === best);
      card.querySelector('button').disabled = true;
      card.querySelector('.pick-label').textContent = [ch === channel ? '내 선택' : '', ch === best ? '✓ 가장 밝음' : ''].filter(Boolean).join(' · ');
      const result = card.querySelector('.gray-result');
      const patch = document.createElement('span');
      patch.className = 'gray-patch';
      // Actual displayed grayscale is rounded to an 8-bit value, while exact model values remain labeled.
      const displayed = Math.round(gray);
      patch.style.backgroundColor = rgbText([displayed, displayed, displayed]);
      const value = document.createElement('b');
      value.textContent = `회색 ${fixedOne(gray)}`;
      const calculation = document.createElement('p');
      calculation.textContent = `${round.deltas[ch]} × ${WEIGHT_TENTHS[ch] / 10} = +${fixedOne(increase)}`;
      result.replaceChildren(patch, value, calculation);
      result.hidden = false;
    }
    $('predictFeedback').textContent = `${ok ? '예측 성공! +1점.' : '이번 정답은 ' + best + '예요.'} ${best}의 밝기 증가가 +${fixedOne(round.deltas[best] * WEIGHT_TENTHS[best] / 10)}로 가장 커요.`;
    $('nextPredictBtn').hidden = false;
    $('nextPredictBtn').textContent = state.predictionIndex + 1 === state.predictions.length ? '두 결과 함께 보기 →' : '다음 예측 →';
    $('nextPredictBtn').focus({ preventScroll: true });
    $('nextPredictBtn').scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  function nextPrediction() {
    if (state.phase !== 'predictionFeedback') return;
    state.predictionIndex++;
    if (state.predictionIndex === state.predictions.length) {
      state.phase = 'done';
      $('predictionScore').textContent = `${state.predictionAnswers.filter(answer => answer.ok).length} / ${state.predictions.length}`;
      renderSummary($('finalObservationSummary'));
      showPanel('resultPanel', 2);
      return;
    }
    beginPrediction();
    $('predictPanel').scrollIntoView({ block: 'start', behavior: 'instant' });
    $('predictTitle').focus({ preventScroll: true });
  }

  $('startBtn').addEventListener('click', start);
  $('retryBtn').addEventListener('click', start);
  $('nextObserveBtn').addEventListener('click', nextObservation);
  $('pauseBtn').addEventListener('click', pause);
  $('resumeBtn').addEventListener('click', resume);
  $('pauseDialog').addEventListener('cancel', event => { event.preventDefault(); resume(); });
  $('startPredictBtn').addEventListener('click', () => {
    if (state.phase !== 'observed') return;
    showPanel('predictPanel', 1);
    beginPrediction();
  });
  $('nextPredictBtn').addEventListener('click', nextPrediction);
  $('predictionCards').addEventListener('click', event => {
    const button = event.target.closest('button[data-channel]');
    if (button) answerPrediction(button.dataset.channel);
  });
  $('board').addEventListener('click', event => {
    const tile = event.target.closest('button[data-index]');
    if (tile) answerObservation(Number(tile.dataset.index));
  });
  $('board').addEventListener('keydown', event => {
    if (state.phase !== 'observing') return;
    const tile = event.target.closest('button[data-index]');
    if (!tile) return;
    const index = Number(tile.dataset.index);
    let next = index;
    if (event.key === 'ArrowRight') next = Math.floor(index / GRID) * GRID + (index % GRID + 1) % GRID;
    else if (event.key === 'ArrowLeft') next = Math.floor(index / GRID) * GRID + (index % GRID + GRID - 1) % GRID;
    else if (event.key === 'ArrowDown') next = (index + GRID) % (GRID * GRID);
    else if (event.key === 'ArrowUp') next = (index + GRID * (GRID - 1)) % (GRID * GRID);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = GRID * GRID - 1;
    else return;
    event.preventDefault();
    state.focusIndex = next;
    [...$('board').children].forEach((button, i) => { button.tabIndex = i === next ? 0 : -1; });
    $('board').children[next].focus({ preventScroll: true });
  });
  $('board').addEventListener('focusin', event => {
    const tile = event.target.closest('button[data-index]');
    if (tile) state.focusIndex = Number(tile.dataset.index);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => { pause(); stopClock(); });
})();
