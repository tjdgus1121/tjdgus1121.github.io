import { connect } from './net.js';

const QUESTIONS = [
  { title: '민트초코는?', category: '민트초코', options: ['좋아', '싫어'], icons: ['🌿', '🍫'] },
  { title: '탕수육은?', category: '탕수육', options: ['부먹', '찍먹'], icons: ['🥣', '🥢'] },
  { title: '둘 중 더 좋아하는 건?', category: '동물', options: ['강아지', '고양이'], icons: ['🐶', '🐱'] },
  { title: '쉬는 날엔?', category: '쉬는 날', options: ['집', '밖'], icons: ['🏠', '🚲'] },
  { title: '놀러 간다면?', category: '여행', options: ['바다', '산'], icons: ['🌊', '⛰️'] },
  { title: '연락할 땐?', category: '연락', options: ['카톡', '전화'], icons: ['💬', '📞'] },
  { title: '간식은?', category: '간식', options: ['단 거', '짠 거'], icons: ['🍰', '🍿'] },
  { title: '더 좋은 시간은?', category: '시간', options: ['아침', '밤'], icons: ['☀️', '🌙'] },
  { title: '여행 계획은?', category: '계획', options: ['미리 짜기', '가서 정하기'], icons: ['📝', '🎒'] }
];
const PHASE_TEXT = {
  collect: '친구들의 취향을 모으고 있어요.',
  compare: '누가 나랑 비슷할까? 친구를 골라 봐요.',
  binary: '같은 취향표를 0과 1로 바꿔 보세요.',
  distance: '두 친구가 다른 칸을 세고, 우리 반의 거리 분포를 살펴봐요.'
};
const SESSION_KEY = 'myTaste.room.v2';
const state = {
  network: null, room: null, code: '', role: '', name: '',
  answers: Array(9).fill(null), question: 0, editing: false,
  first: '', second: '', distanceFilter: 'all', statsPair: '', inspectedDistance: null, unsubscribe: null, busy: false
};
const $ = (id) => document.getElementById(id);
const completed = (player) => /^[01]{9}$/.test(player?.answers || '');
const isHost = () => state.room?.meta.hostUid === state.network?.uid;
const ownPlayer = () => state.room?.players?.[state.network?.uid];
const readyPlayers = () => Object.entries(state.room?.players || {}).filter(([, player]) => completed(player));
const participantsInRoom = () => Object.entries(state.room?.players || {}).filter(([uid, player]) => uid !== state.room?.meta?.hostUid || completed(player));
const distance = (first, second) => Array.from(first).filter((bit, index) => bit !== second[index]).length;
const percent = (count, total) => (100 * count / total).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '%';

function remember() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      code: state.code, role: state.role, name: state.name,
      answers: state.answers, question: state.question, editing: state.editing
    }));
  } catch { /* The active room still works when browser storage is unavailable. */ }
}

function savedRoom() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!/^[0-9]{6}$/.test(saved?.code || '')) return null;
    if (!['host', 'player'].includes(saved.role)) return null;
    return saved;
  } catch { return null; }
}

function showMessage(message = '', anchor = null) {
  const alert = $('app-message');
  if (message && anchor?.closest('.entry-game')) anchor.after(alert);
  else if (message) $('entry-screen').parentElement.append(alert);
  alert.textContent = message;
  alert.hidden = !message;
}

async function perform(button, operation) {
  if (state.busy) return;
  state.busy = true;
  showMessage();
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    await operation();
  } catch (error) {
    const permissionDenied = /permission.denied/i.test(String(error.code || '') + error.message);
    const message = button?.id === 'create-room' && permissionDenied
      ? '방을 만들 수 없어요. Firebase 보안 규칙이 게시되어 있는지 확인해 주세요.'
      : state.network?.readableError?.(error) || error.message || '연결을 확인한 뒤 다시 눌러 주세요.';
    showMessage(message, button);
  } finally {
    state.busy = false;
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

async function network() {
  if (state.network) return state.network;
  $('connection-status').textContent = '연결 중';
  state.network = await connect({
    onConnection(connected) {
      $('connection-status').textContent = connected ? '연결됨' : '다시 연결 중';
      $('connection-status').classList.toggle('offline', !connected);
    }
  });
  return state.network;
}

function showScreen(name) {
  const changed = document.body.dataset.screen !== name;
  document.body.dataset.screen = name;
  ['entry', 'question', 'room'].forEach((screen) => {
    $(screen + '-screen').hidden = screen !== name;
  });
  $('leave-button').hidden = name === 'entry';
  if (changed) window.scrollTo(0, 0);
}

function watchRoom() {
  state.unsubscribe?.();
  state.unsubscribe = state.network.watchRoom(state.code, (room) => {
    if (!room || room.meta?.phase === 'closed') {
      exitRoom('함께하기가 끝났어요. 새 방 코드로 다시 만나요.');
      return;
    }
    if (room.meta.schema !== 'taste9-v1') {
      exitRoom('질문 구성이 다른 방이에요. 새 방 코드를 확인해 주세요.');
      return;
    }
    state.room = room;
    state.role = isHost() ? 'host' : 'player';
    $('leave-button').textContent = isHost() ? '수업 끝내기' : '나가기';
    remember();
    render();
  }, (error) => {
    showMessage(error.message || '방에 연결할 수 없어요. 연결 상태와 방 코드를 확인해 주세요.');
  });
}

function exitRoom(message = '') {
  state.unsubscribe?.();
  state.unsubscribe = null;
  state.room = null;
  state.code = '';
  state.answers = Array(9).fill(null);
  state.question = 0;
  state.editing = false;
  state.first = '';
  state.second = '';
  state.distanceFilter = 'all';
  $('pending-submissions').open = false;
  state.statsPair = '';
  state.inspectedDistance = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* optional storage */ }
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
  showScreen('entry');
  $('footer-message').textContent = '친구와 같은 방에서 함께해요.';
  showMessage(message);
}

function renderQuestionBoard() {
  $('answered-count').textContent = `${state.answers.filter((answer) => answer !== null).length} / ${QUESTIONS.length}칸 채움`;
  $('question-progress').replaceChildren(...QUESTIONS.map(({ category, options, icons }, index) => {
    const answer = state.answers[index];
    const step = document.createElement('li');
    step.className = 'progress-step';
    if (answer !== null) step.dataset.choice = answer;
    if (index === state.question) step.setAttribute('aria-current', 'step');
    const description = `${index + 1}번 ${category} · ${answer === null ? '아직 미선택' : options[answer]}`;
    step.setAttribute('aria-label', description);
    step.title = description;
    const mark = document.createElement('span');
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = answer === null ? index + 1 : icons[answer];
    step.append(mark);
    return step;
  }));
}

function showQuestion(focus = false) {
  showScreen('question');
  const question = QUESTIONS[state.question];
  $('question-title').textContent = question.title;
  $('question-count').textContent = `${state.question + 1} / ${QUESTIONS.length}`;
  $('question-room').textContent = '방 ' + state.code;
  $('question-next').textContent = state.question === QUESTIONS.length - 1 ? '고르면 취향표를 보내요.' : '고르면 다음 질문으로 넘어가요.';
  $('previous-question').disabled = state.question === 0;
  $('retry-submit').hidden = true;
  renderQuestionBoard();
  $('choice-list').replaceChildren(...question.options.map((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button choice-' + index;
    button.setAttribute('aria-pressed', String(state.answers[state.question] === index));
    const icon = document.createElement('span');
    icon.className = 'choice-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = question.icons[index];
    const text = document.createElement('strong');
    text.textContent = option;
    button.append(icon, text);
    button.addEventListener('click', () => {
      if (state.busy) return;
      state.answers[state.question] = index;
      remember();
      if (state.question < QUESTIONS.length - 1) {
        state.question += 1;
        remember();
        showQuestion(true);
      } else {
        renderQuestionBoard();
        for (const [side, choice] of Array.from($('choice-list').children).entries()) {
          choice.setAttribute('aria-pressed', String(index === side));
        }
        perform(button, submitAnswers);
      }
    });
    return button;
  }));
  if (focus) $('question-title').focus({ preventScroll: true });
}

async function submitAnswers() {
  if (state.room?.meta.phase !== 'collect') throw new Error('선생님이 취향 모으기를 다시 열면 답할 수 있어요.');
  if (!state.answers.every((answer) => answer === 0 || answer === 1)) throw new Error('아직 고르지 않은 질문이 있어요.');
  try {
    await state.network.submitAnswers(state.code, state.answers.join(''));
    state.editing = false;
    remember();
    $('retry-submit').hidden = true;
    render();
  } catch (error) {
    $('retry-submit').hidden = false;
    throw error;
  }
}

function matrix(answers, { binary = false, compareTo = null, differenceOnly = false } = {}) {
  return QUESTIONS.map((question, index) => {
    const value = Number(answers[index]);
    const different = compareTo !== null && answers[index] !== compareTo[index];
    const cell = document.createElement('div');
    cell.className = 'taste-cell' + (different ? ' different' : '');
    const category = document.createElement('span');
    category.className = 'cell-category';
    category.textContent = question.category;
    const text = document.createElement('span');
    text.className = 'cell-value' + (binary ? ' bit' : '');
    text.textContent = differenceOnly ? String(Number(different)) : binary ? String(value) : question.options[value];
    cell.setAttribute('aria-label', question.category + ', ' + (differenceOnly ? (different ? '다름 1' : '같음 0') : text.textContent) + (different && !differenceOnly ? ', 서로 다름' : ''));
    if (!differenceOnly) {
      cell.append(category);
      if (!binary) {
        const icon = document.createElement('span');
        icon.className = 'cell-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = question.icons[value];
        cell.append(icon);
      }
    }
    cell.append(text);
    return cell;
  });
}

function render() {
  if (!state.room) return;
  const phase = state.room.meta.phase;
  const phaseChanged = document.body.dataset.screen === 'room' && document.body.dataset.stage !== phase;
  const me = ownPlayer();
  const teacher = isHost();
  if (!teacher && phase === 'collect' && (state.editing || !completed(me))) {
    if ($('question-screen').hidden) {
      state.editing = true;
      showQuestion(true);
    }
    return;
  }
  showScreen('room');
  document.body.dataset.stage = phase;
  document.body.dataset.role = teacher ? 'teacher' : 'student';
  $('room-code').textContent = state.code;
  $('room-subtitle').textContent = PHASE_TEXT[phase] || '';
  $('teacher-controls').hidden = !teacher;
  $('teacher-submissions').hidden = !teacher;
  $('copy-room-link').hidden = !teacher;
  $('footer-message').textContent = teacher ? '위쪽 버튼으로 공개 단계를 바꿔 주세요.' : '화면은 선생님의 진행에 맞춰 바뀌어요.';
  const participants = participantsInRoom();
  const ready = participants.filter(([, player]) => completed(player));
  if (teacher) renderSubmissions(participants, ready.length);
  document.querySelectorAll('[data-phase]').forEach((button) => {
    button.setAttribute('aria-current', button.dataset.phase === phase ? 'step' : 'false');
    button.disabled = button.dataset.phase !== 'collect' && ready.length < 2;
  });
  $('collection-view').hidden = phase !== 'collect';
  $('comparison-view').hidden = phase === 'collect';
  if (phase !== 'distance') {
    $('class-stats').hidden = true;
    state.statsPair = '';
    state.inspectedDistance = null;
  }
  if (phase === 'collect') renderCollection(participants, ready.length, teacher);
  else renderComparison(ready);
  if (phaseChanged) window.scrollTo(0, 0);
}

function renderSubmissions(participants, submitted) {
  for (const [id, count] of [['joined-total', participants.length], ['submitted-total', submitted], ['pending-total', participants.length - submitted]]) {
    const text = `${count}명`;
    if ($(id).textContent !== text) $(id).textContent = text;
  }
  if (!$('pending-submissions').open) return;
  const pending = participants.filter(([, player]) => !completed(player));
  $('pending-submission-empty').hidden = pending.length > 0;
  $('pending-submission-empty').textContent = participants.length ? '참가한 학생이 모두 제출했어요.' : '아직 참가한 학생이 없어요.';
  $('pending-submission-list').hidden = pending.length === 0;
  $('pending-submission-list').replaceChildren(...pending.map(([, player]) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const status = document.createElement('small');
    name.textContent = player.name;
    status.textContent = player.online ? '접속 중' : '오프라인';
    item.append(name, status);
    return item;
  }));
}

function renderCollection(players, submitted, teacher) {
  $('ready-count').hidden = teacher;
  $('ready-count').textContent = submitted + ' / ' + players.length + '명 선택 완료';
  $('collection-title').textContent = teacher ? '우리 반 취향' : '내 취향표 완성';
  $('edit-answers').hidden = teacher || !completed(ownPlayer());
  $('student-waiting').hidden = teacher || !completed(ownPlayer());
  $('participant-gallery').hidden = !teacher;
  if (!teacher) {
    if (completed(ownPlayer())) $('my-taste-matrix').replaceChildren(...matrix(ownPlayer().answers));
    return;
  }
  $('participant-gallery').replaceChildren(...players.map(([, player]) => {
    const card = document.createElement('section');
    card.className = 'participant-card';
    const heading = document.createElement('h3');
    const name = document.createElement('span');
    name.textContent = player.name;
    const status = document.createElement('span');
    status.className = 'participant-status';
    status.textContent = completed(player) ? (player.online ? '선택 완료' : '자리 비움') : '고르는 중';
    heading.append(name, status);
    card.append(heading);
    const content = document.createElement('div');
    if (completed(player)) {
      content.className = 'taste-matrix';
      content.append(...matrix(player.answers));
    } else {
      content.className = 'pending-player';
      content.textContent = '고르는 중';
    }
    card.append(content);
    return card;
  }));
  if (!players.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = '방 코드를 알려 주고 친구들을 기다려 주세요.';
    $('participant-gallery').append(empty);
  }
}

function fillPicker(id, players, selected) {
  const select = $(id);
  select.replaceChildren(...players.map(([uid, player]) => {
    const option = document.createElement('option');
    option.value = uid;
    option.textContent = player.name;
    return option;
  }));
  select.value = selected;
  select.disabled = players.length === 0;
}

function filterByDistance(first, others) {
  const groups = Array.from({ length: QUESTIONS.length + 1 }, () => []);
  for (const pair of others) groups[distance(first.answers, pair[1].answers)].push(pair);
  const shortest = groups.findIndex((group) => group.length > 0);
  const select = $('distance-filter');
  select.options[0].textContent = `모든 거리 · ${others.length}명`;
  select.options[1].textContent = `최단 거리 ${shortest} · ${groups[shortest].length}명`;
  groups.forEach((group, value) => { select.options[value + 2].textContent = `거리 ${value} · ${group.length}명`; });
  select.value = state.distanceFilter;
  if (state.distanceFilter === 'all') return groups.flat();
  const value = state.distanceFilter === 'shortest' ? shortest : Number(state.distanceFilter);
  return groups[value];
}

function renderComparison(players = readyPlayers()) {
  const teacher = isHost();
  const phase = state.room.meta.phase;
  const ids = players.map(([uid]) => uid);
  if (teacher) {
    if (!ids.includes(state.first)) state.first = ids[0] || '';
  } else {
    state.first = completed(ownPlayer()) ? state.network.uid : '';
  }
  const first = state.room.players?.[state.first];
  const otherPlayers = players.filter(([uid]) => uid !== state.first);
  const filterVisible = teacher && phase === 'distance' && completed(first) && otherPlayers.length > 0;
  const candidates = filterVisible ? filterByDistance(first, otherPlayers) : otherPlayers;
  $('teacher-distance-filter').hidden = !filterVisible;
  if (filterVisible) $('distance-match-count').textContent = `${first.name} · 비교 후보 ${candidates.length}명`;
  if (!candidates.some(([uid]) => uid === state.second)) state.second = candidates[0]?.[0] || '';
  fillPicker('first-player', players, state.first);
  fillPicker('second-player', candidates, state.second);
  $('first-picker-wrap').hidden = !teacher;
  $('comparison-friends-title').textContent = filterVisible ? '비교 후보' : '참가한 친구들';
  $('comparison-count').textContent = (filterVisible ? candidates.length : players.length) + '명';
  const second = state.room.players?.[state.second];
  const validPair = completed(first) && completed(second) && state.first !== state.second;
  $('comparison-empty').hidden = validPair;
  $('comparison-content').hidden = !validPair;
  let emptyMessage = '취향을 모두 고른 친구가 두 명 이상 필요해요.';
  if (!state.first && !teacher) emptyMessage = '취향 선택을 마치지 못했어요. 선생님께 취향 모으기를 다시 열어 달라고 해 주세요.';
  if (filterVisible && !candidates.length) emptyMessage = '이 거리의 친구가 없어요. 다른 거리를 골라 보세요.';
  $('comparison-empty').textContent = emptyMessage;
  const binary = phase === 'binary' || phase === 'distance';
  $('comparison-title').textContent = phase === 'distance' ? '우리는 몇 칸 다를까?' : phase === 'binary' ? '취향도 숫자로 나타낼 수 있어요' : '누구랑 비교할까?';
  $('comparison-instruction').textContent = phase === 'distance' ? '다른 자리는 1, 같은 자리는 0. 1이 몇 개인지 세어 보세요.' : '같은 자리의 취향을 비교해 보세요.';
  $('binary-guide').hidden = !binary;
  $('distance-explanation').hidden = phase !== 'distance';
  const pairDistance = validPair && phase === 'distance' ? distance(first.answers, second.answers) : null;
  if (validPair) {
    $('first-player-name').textContent = first.name + (state.first === state.network.uid ? ' · 나' : '');
    $('second-player-name').textContent = second.name;
    $('first-matrix').replaceChildren(...matrix(first.answers, { binary, compareTo: second.answers }));
    $('second-matrix').replaceChildren(...matrix(second.answers, { binary, compareTo: first.answers }));
    if (pairDistance !== null) {
      $('difference-matrix').replaceChildren(...matrix(first.answers, { compareTo: second.answers, differenceOnly: true }));
      $('distance-value').textContent = pairDistance;
      $('distance-summary').textContent = `다른 취향 ${pairDistance}개 · 같은 취향 ${QUESTIONS.length - pairDistance}개`;
    }
  }
  if (phase === 'distance') renderClassStats(players, pairDistance);
  $('comparison-friends').replaceChildren(...candidates.map(([uid, player]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'friend-button';
    button.setAttribute('aria-pressed', String(state.second === uid));
    const name = document.createElement('span');
    name.textContent = player.name;
    button.append(name);
    if (phase === 'distance' && completed(first)) {
      const count = document.createElement('small');
      count.textContent = '거리 ' + distance(first.answers, player.answers);
      button.append(count);
    }
    button.addEventListener('click', () => {
      state.second = uid;
      renderComparison();
    });
    return button;
  }));
}

function classDistanceCounts(ballots) {
  const counts = Array(QUESTIONS.length + 1).fill(0);
  ballots.forEach((first, index) => {
    for (let other = 0; other < index; other++) counts[distance(first, ballots[other])]++;
  });
  return counts;
}

function histogramReading(counts, pairs, selected, pairDistance) {
  const count = counts[selected];
  const meaning = selected === 0 ? ' 아홉 답이 모두 같은 쌍이에요.' : selected === QUESTIONS.length ? ' 아홉 답이 모두 다른 쌍이에요.' : '';
  const current = selected === pairDistance ? ' 지금 비교한 두 친구도 여기에 포함돼요.' : '';
  $('histogram-reading').textContent = `거리 ${selected}인 쌍은 ${count}쌍 (${percent(count, pairs)})이에요.${meaning}${current}`;
  $('histogram-distance').value = String(selected);
  for (const [index, bar] of Array.from($('distance-histogram').children).entries()) {
    bar.setAttribute('aria-pressed', String(index === selected));
  }
}

function renderQuestionStats(ballots) {
  const index = Number($('stats-question-select').value);
  const question = QUESTIONS[index];
  const left = ballots.filter((answer) => answer[index] === '0').length;
  const right = ballots.length - left;
  const pairs = ballots.length * (ballots.length - 1) / 2;
  $('stats-options').replaceChildren(...question.options.map((option, side) => {
    const label = document.createElement('span');
    label.textContent = `${question.icons[side]} ${option} ${side === 0 ? left : right}명`;
    return label;
  }));
  $('stats-left-share').style.width = percent(left, ballots.length);
  $('stats-question-reading').textContent = `${left}명 × ${right}명 = ${left * right}쌍 (전체 쌍의 ${percent(left * right, pairs)})이 이 문항에서 달랐어요.`;
}

function renderClassStats(players, pairDistance) {
  $('class-stats').hidden = players.length < 2;
  if (players.length < 2) return;

  const ballots = players.map(([, player]) => player.answers);
  const counts = classDistanceCounts(ballots);
  const pairs = players.length * (players.length - 1) / 2;
  const most = Math.max(...counts);
  const modes = counts.flatMap((count, index) => count === most ? [index] : []);
  const totalDistance = counts.reduce((total, count, value) => total + value * count, 0);
  $('stats-sample').textContent = `아홉 개를 모두 고른 ${players.length}명 가운데 두 사람씩 묶었어요. 같은 쌍은 한 번만 세어요.`;
  $('stats-pairs').textContent = `${pairs.toLocaleString('ko-KR')}쌍`;
  $('stats-mean').textContent = (totalDistance / pairs).toFixed(1);
  $('stats-mode').textContent = modes.length === counts.length ? '모든 거리' : modes.join(' · ');
  $('histogram-pair').hidden = pairDistance === null;
  $('histogram-pair').textContent = pairDistance === null ? '' : `지금 비교한 쌍 · 거리 ${pairDistance}`;

  const pairKey = pairDistance === null ? '' : `${state.first}/${state.second}`;
  if (state.statsPair !== pairKey) {
    state.statsPair = pairKey;
    state.inspectedDistance = null;
  }
  const inspect = (value) => {
    state.inspectedDistance = value;
    histogramReading(counts, pairs, value, pairDistance);
  };
  const histogram = $('distance-histogram');
  counts.forEach((count, value) => {
    let bar = histogram.children[value];
    if (!bar) {
      bar = document.createElement('button');
      bar.type = 'button';
      bar.className = 'histogram-bar';
      bar.innerHTML = '<span class="bar-track"><span class="bar-count"></span><span class="bar-fill"></span></span><span class="bar-number"></span>';
      bar.querySelector('.bar-number').textContent = value;
      histogram.append(bar);
    }
    bar.querySelector('.bar-count').textContent = count;
    bar.style.setProperty('--bar-height', `${100 * count / most}%`);
    bar.classList.toggle('current-pair', value === pairDistance);
    bar.setAttribute('aria-label', `거리 ${value}, ${count}쌍${value === pairDistance ? ', 지금 비교한 쌍 포함' : ''}`);
    bar.onclick = () => inspect(value);
  });
  $('histogram-distance').onchange = (event) => inspect(Number(event.target.value));
  histogramReading(counts, pairs, state.inspectedDistance ?? pairDistance ?? modes[0], pairDistance);
  renderQuestionStats(ballots);
}

$('histogram-distance').replaceChildren(...Array.from({ length: QUESTIONS.length + 1 }, (_, value) => new Option(`${value}칸`, value)));
$('distance-filter').append(...Array.from({ length: QUESTIONS.length + 1 }, (_, value) => new Option(`거리 ${value}`, value)));
$('distance-filter').addEventListener('change', (event) => {
  state.distanceFilter = event.target.value;
  renderComparison();
});
$('pending-submissions').addEventListener('toggle', () => {
  if (!state.room || !isHost() || !$('pending-submissions').open) return;
  renderSubmissions(participantsInRoom(), readyPlayers().length);
});
$('stats-question-select').replaceChildren(...QUESTIONS.map(({ category }, index) => {
  const option = document.createElement('option');
  option.value = index;
  option.textContent = `${index + 1}. ${category}`;
  return option;
}));
$('stats-question-select').addEventListener('change', () => {
  renderQuestionStats(readyPlayers().map(([, player]) => player.answers));
});

$('create-room').addEventListener('click', () => perform($('create-room'), async () => {
  const net = await network();
  const result = await net.createRoom('선생님');
  state.code = result.code;
  state.role = 'host';
  state.name = '선생님';
  state.editing = false;
  remember();
  watchRoom();
}));
$('join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = $('room-code-input').value.trim();
  const name = $('player-name-input').value.trim().normalize('NFC');
  const validCode = /^[0-9]{6}$/.test(code);
  const validName = name.length >= 1 && name.length <= 12;
  $('room-code-input').setAttribute('aria-invalid', String(!validCode));
  $('player-name-input').setAttribute('aria-invalid', String(!validName));
  if (!validCode || !validName) {
    const message = !validCode ? '선생님이 알려 준 숫자 6자리 방 코드를 적어 주세요.' : '이름이나 별명을 12자 이내로 적어 주세요.';
    showMessage(message, $('join-button'));
    (!validCode ? $('room-code-input') : $('player-name-input')).focus();
    return;
  }
  perform($('join-button'), async () => {
    const field = document.activeElement;
    if (field === $('room-code-input') || field === $('player-name-input')) field.blur();
    const net = await network();
    await net.joinRoom(code, name);
    state.code = code;
    state.name = name;
    state.role = 'player';
    state.answers = Array(9).fill(null);
    state.question = 0;
    state.editing = true;
    remember();
    watchRoom();
  });
});
$('previous-question').addEventListener('click', () => {
  if (state.question === 0 || state.busy) return;
  state.question -= 1;
  remember();
  showQuestion(true);
});
$('retry-submit').addEventListener('click', () => perform($('retry-submit'), submitAnswers));
$('edit-answers').addEventListener('click', () => {
  state.answers = ownPlayer().answers.split('').map(Number);
  state.question = 0;
  state.editing = true;
  remember();
  showQuestion(true);
});
document.querySelectorAll('[data-phase]').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.room?.meta.phase === button.dataset.phase) return;
    perform(button, async () => {
      await state.network.setPhase(state.code, button.dataset.phase);
    });
  });
});
$('first-player').addEventListener('change', (event) => {
  state.first = event.target.value;
  renderComparison();
});
$('second-player').addEventListener('change', (event) => {
  state.second = event.target.value;
  renderComparison();
});
$('leave-button').addEventListener('click', () => {
  $('leave-dialog-title').textContent = isHost() ? '함께하기를 끝낼까요?' : '방에서 나갈까요?';
  $('leave-dialog-copy').textContent = isHost() ? '이 방의 취향표가 삭제되고 친구들의 참여가 종료돼요.' : '고른 취향은 수업방에 남고, 이 기기의 연결을 종료해요.';
  $('confirm-leave').textContent = isHost() ? '수업 끝내기' : '나가기';
  $('leave-dialog').showModal();
});
$('confirm-leave').addEventListener('click', () => perform($('confirm-leave'), async () => {
  if (isHost()) await state.network.closeRoom(state.code);
  else await state.network.leaveRoom(state.code);
  exitRoom();
}));
$('copy-room-link').addEventListener('click', async () => {
  const link = new URL(location.href);
  link.search = '';
  link.hash = '';
  link.searchParams.set('room', state.code);
  try {
    await navigator.clipboard.writeText(link.href);
    $('copy-room-link').textContent = '링크를 복사했어요 ✓';
  } catch {
    $('share-link').value = link.href;
    $('share-dialog').showModal();
    $('share-link').select();
  }
});
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.dataset.action === 'help') $('help-dialog').showModal();
  if (target.dataset.action === 'close-dialog') target.closest('dialog').close();
});
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
const queryRoom = new URL(location.href).searchParams.get('room');
showScreen('entry');
if (/^[0-9]{6}$/.test(queryRoom || '')) $('room-code-input').value = queryRoom;
const saved = savedRoom();
if (saved) {
  perform(null, async () => {
    const net = await network();
    state.code = saved.code;
    state.role = saved.role;
    state.name = saved.name || '';
    const validDraft = Array.isArray(saved.answers) && saved.answers.length === 9 && saved.answers.every((value) => value === null || value === 0 || value === 1);
    state.answers = validDraft ? saved.answers : Array(9).fill(null);
    state.question = Number.isInteger(saved.question) && saved.question >= 0 && saved.question < 9 ? saved.question : 0;
    state.editing = Boolean(saved.editing);
    if (state.role === 'player') await net.joinRoom(state.code, state.name);
    watchRoom();
  });
}
export { QUESTIONS, distance };
