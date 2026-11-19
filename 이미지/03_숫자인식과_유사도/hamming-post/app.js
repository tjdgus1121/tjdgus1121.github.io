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
  distance: '서로 다른 칸을 세면 해밍 거리가 돼요.'
};
const SESSION_KEY = 'myTaste.room.v2';
const state = {
  network: null, room: null, code: '', role: '', name: '',
  answers: Array(9).fill(null), question: 0, editing: false,
  first: '', second: '', unsubscribe: null, busy: false
};
const $ = (id) => document.getElementById(id);
const completed = (player) => /^[01]{9}$/.test(player?.answers || '');
const isHost = () => state.room?.meta.hostUid === state.network?.uid;
const ownPlayer = () => state.room?.players?.[state.network?.uid];
const readyPlayers = () => Object.entries(state.room?.players || {}).filter(([, player]) => completed(player));
const distance = (first, second) => Array.from(first).filter((bit, index) => bit !== second[index]).length;

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

function showMessage(message = '') {
  $('app-message').textContent = message;
  $('app-message').hidden = !message;
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
    showMessage(message);
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
  document.body.dataset.screen = name;
  ['entry', 'question', 'room'].forEach((screen) => {
    $(screen + '-screen').hidden = screen !== name;
  });
  $('leave-button').hidden = name === 'entry';
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
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* optional storage */ }
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
  showScreen('entry');
  $('footer-message').textContent = '친구와 같은 방에서 함께해요.';
  showMessage(message);
}

function showQuestion(focus = false) {
  showScreen('question');
  const question = QUESTIONS[state.question];
  $('question-title').textContent = question.title;
  $('question-count').textContent = (state.question + 1) + ' / 9';
  $('question-room').textContent = '방 ' + state.code;
  $('footer-message').textContent = '두 개 중 더 좋은 쪽을 골라요.';
  $('previous-question').disabled = state.question === 0;
  $('retry-submit').hidden = true;
  $('question-progress').replaceChildren(...QUESTIONS.map((_, index) => {
    const step = document.createElement('span');
    step.className = 'progress-step' + (index < state.question ? ' complete' : '') + (index === state.question ? ' current' : '');
    step.setAttribute('aria-label', (index + 1) + '번째 질문' + (index < state.question ? ' 완료' : ''));
    return step;
  }));
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
      if (state.question < 8) {
        state.question += 1;
        remember();
        showQuestion(true);
      } else {
        perform(button, submitAnswers);
      }
    });
    return button;
  }));
  if (focus) $('question-title').focus();
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
  const me = ownPlayer();
  if (!isHost() && phase === 'collect' && (state.editing || !completed(me))) {
    if ($('question-screen').hidden) {
      state.editing = true;
      showQuestion(true);
    }
    return;
  }
  showScreen('room');
  document.body.dataset.stage = phase;
  document.body.dataset.role = isHost() ? 'teacher' : 'student';
  $('room-code').textContent = state.code;
  $('room-subtitle').textContent = PHASE_TEXT[phase] || '';
  $('teacher-controls').hidden = !isHost();
  $('copy-room-link').hidden = !isHost();
  $('footer-message').textContent = isHost() ? '위쪽 버튼으로 공개 단계를 바꿔 주세요.' : '화면은 선생님의 진행에 맞춰 바뀌어요.';
  document.querySelectorAll('[data-phase]').forEach((button) => {
    button.setAttribute('aria-current', button.dataset.phase === phase ? 'step' : 'false');
    button.disabled = button.dataset.phase !== 'collect' && readyPlayers().length < 2;
  });
  $('collection-view').hidden = phase !== 'collect';
  $('comparison-view').hidden = phase === 'collect';
  if (phase === 'collect') renderCollection();
  else renderComparison();
}

function renderCollection() {
  const players = Object.entries(state.room.players || {}).filter(([uid, player]) => uid !== state.room.meta.hostUid || completed(player));
  const ready = players.filter(([, player]) => completed(player));
  $('ready-count').textContent = ready.length + ' / ' + players.length + '명 선택 완료';
  $('collection-title').textContent = isHost() ? '우리 반 취향' : '내 취향표 완성';
  $('edit-answers').hidden = isHost() || !completed(ownPlayer());
  $('student-waiting').hidden = isHost() || !completed(ownPlayer());
  $('participant-gallery').hidden = !isHost();
  if (!isHost()) {
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
}

function renderComparison() {
  const players = readyPlayers();
  const ids = players.map(([uid]) => uid);
  if (isHost()) {
    if (!ids.includes(state.first)) state.first = ids[0] || '';
  } else {
    state.first = completed(ownPlayer()) ? state.network.uid : '';
  }
  if (!ids.includes(state.second) || state.second === state.first) state.second = ids.find((uid) => uid !== state.first) || '';
  const otherPlayers = players.filter(([uid]) => uid !== state.first);
  fillPicker('first-player', players, state.first);
  fillPicker('second-player', otherPlayers, state.second);
  $('first-picker-wrap').hidden = !isHost();
  $('comparison-count').textContent = players.length + '명';
  const first = state.room.players?.[state.first];
  const second = state.room.players?.[state.second];
  const validPair = completed(first) && completed(second) && state.first !== state.second;
  $('comparison-empty').hidden = validPair;
  $('comparison-content').hidden = !validPair;
  $('comparison-empty').textContent = !state.first && !isHost() ? '취향 선택을 마치지 못했어요. 선생님께 취향 모으기를 다시 열어 달라고 해 주세요.' : '취향을 모두 고른 친구가 두 명 이상 필요해요.';
  const phase = state.room.meta.phase;
  const binary = phase === 'binary' || phase === 'distance';
  $('comparison-title').textContent = phase === 'distance' ? '우리는 몇 칸 다를까?' : phase === 'binary' ? '취향도 숫자로 나타낼 수 있어요' : '누구랑 비교할까?';
  $('comparison-instruction').textContent = phase === 'distance' ? '다른 자리는 1, 같은 자리는 0. 1이 몇 개인지 세어 보세요.' : '같은 자리의 취향을 비교해 보세요.';
  $('binary-guide').hidden = !binary;
  $('distance-explanation').hidden = phase !== 'distance';
  if (validPair) {
    $('first-player-name').textContent = first.name + (state.first === state.network.uid ? ' · 나' : '');
    $('second-player-name').textContent = second.name;
    $('first-matrix').replaceChildren(...matrix(first.answers, { binary, compareTo: second.answers }));
    $('second-matrix').replaceChildren(...matrix(second.answers, { binary, compareTo: first.answers }));
    if (phase === 'distance') {
      const count = distance(first.answers, second.answers);
      $('difference-matrix').replaceChildren(...matrix(first.answers, { compareTo: second.answers, differenceOnly: true }));
      $('distance-value').textContent = count;
      $('distance-summary').textContent = '다른 취향 ' + count + '개 · 같은 취향 ' + (9 - count) + '개';
    }
  }
  $('comparison-friends').replaceChildren(...otherPlayers.map(([uid, player]) => {
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
    showMessage(!validCode ? '선생님이 알려 준 숫자 6자리 방 코드를 적어 주세요.' : '이름이나 별명을 12자 이내로 적어 주세요.');
    (!validCode ? $('room-code-input') : $('player-name-input')).focus();
    return;
  }
  perform($('join-button'), async () => {
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
