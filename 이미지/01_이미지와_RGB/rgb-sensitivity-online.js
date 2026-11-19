import { firebaseConfig } from './rgb-sensitivity-firebase-config.js';
import { BOARD_PATH, TOP_LIMIT, normalizeName, validResult, rankedEntries, bestRecord } from './rgb-sensitivity-ranking-model.js';

const $ = id => document.getElementById(id);
const CHANNELS = ['R', 'G', 'B'];
const SDK = 'https://www.gstatic.com/firebasejs/12.15.0';
let api = null, authApi = null, auth = null, unsubscribe = null, offConnection = null;
let currentResult = null, myUid = null, busy = false, connectionRun = 0;
let lastRecords = null, ready = false;

function timed(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]).finally(() => clearTimeout(timer));
}

function connection(state, label, message) {
  $('rankingConnection').dataset.state = state;
  $('rankingConnection').textContent = label;
  $('rankingMessage').textContent = message;
  $('rankingSubmit').disabled = !api || !ready || !currentResult || busy;
  $('rankingReconnect').hidden = state !== 'error';
}

function render(records) {
  lastRecords = records;
  const rows = rankedEntries(records);
  $('rankingRows').replaceChildren(...rows.map(rec => {
    const row = document.createElement('tr');
    if (rec.uid === myUid) row.classList.add('is-me');
    const values = [String(rec.rank), rec.name + (rec.uid === myUid ? ' · 나' : ''), rec.score.toLocaleString('ko-KR'), ...CHANNELS.map(ch => rec.channels[ch].score.toLocaleString('ko-KR'))];
    values.forEach((value, index) => {
      const cell = document.createElement(index === 1 ? 'th' : 'td');
      if (index === 1) cell.scope = 'row';
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
  $('rankingMessage').textContent = rows.length ? '새 기록이 등록되면 자동으로 갱신돼요. 시간은 순위에 반영하지 않아요.' : '아직 등록된 기록이 없어요. 게임을 마치고 첫 기록을 남겨보세요!';
}

function readableError(error) {
  if (/permission|PERMISSION/.test(error?.message || '')) return '랭킹 접근이 허용되지 않았어요. 연결 설정을 확인해 주세요.';
  if (/operation-not-allowed|configuration-not-found|CONFIGURATION_NOT_FOUND/.test(error?.code || error?.message || '')) return '랭킹 로그인이 아직 준비되지 않았어요. 게임 기록은 이 화면에 남아 있어요.';
  if (/network|offline|fetch/i.test(error?.message || '')) return '인터넷 연결을 확인해 주세요. 현재 게임 결과는 그대로 남아 있어요.';
  return error?.message || '랭킹에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

async function connect() {
  const run = ++connectionRun;
  unsubscribe?.(); offConnection?.(); unsubscribe = offConnection = null;
  api = null;
  ready = false;
  if (!firebaseConfig) {
    connection('pending', '연결 대기', '랭킹 서버 연결을 준비하고 있어요. 게임은 바로 플레이할 수 있어요.');
    return;
  }
  connection('connecting', '연결 중', '실시간 기록을 불러오고 있어요.');
  try {
    const [appSdk, dbSdk] = await timed(Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-database.js`)]), 15000, '랭킹 연결 시간이 초과됐어요. 다시 연결해 주세요.');
    if (run !== connectionRun) return;
    const app = appSdk.getApps().find(app => app.name === 'rgb-sensitivity') || appSdk.initializeApp(firebaseConfig, 'rgb-sensitivity');
    const db = dbSdk.getDatabase(app);
    api = { app, db, sdk: dbSdk };
    let loaded = false;
    const query = dbSdk.query(dbSdk.ref(db, BOARD_PATH), dbSdk.orderByChild('score'), dbSdk.limitToLast(TOP_LIMIT));
    const firstTimer = setTimeout(() => {
      if (!loaded && run === connectionRun) connection('error', '연결 확인 필요', '랭킹 응답을 기다리고 있어요. 인터넷 연결을 확인하고 다시 연결해 주세요.');
    }, 15000);
    unsubscribe = dbSdk.onValue(query, snapshot => {
      if (run !== connectionRun) return;
      loaded = true;
      ready = true;
      clearTimeout(firstTimer);
      connection('online', '실시간 연결', '');
      render(snapshot.val());
      if (currentResult && !busy) $('rankingSaveStatus').textContent = '별명을 쓰고 최고 기록을 등록해 보세요.';
    }, error => {
      if (run !== connectionRun) return;
      clearTimeout(firstTimer);
      api = null;
      ready = false;
      connection('error', '연결 실패', readableError(error));
    });
    offConnection = dbSdk.onValue(dbSdk.ref(db, '.info/connected'), snapshot => {
      if (run !== connectionRun || !loaded || !api) return;
      ready = !!snapshot.val();
      if (ready) { connection('online', '실시간 연결', ''); render(lastRecords); }
      else connection('connecting', '재연결 중', '잠시 연결이 끊겼어요. 다시 연결되면 기록이 자동으로 갱신돼요.');
    });
  } catch (error) {
    if (run !== connectionRun) return;
    api = null;
    ready = false;
    connection('error', '연결 실패', readableError(error));
  }
}

window.addEventListener('rgb-sensitivity:complete', event => {
  currentResult = validResult(event.detail) ? structuredClone(event.detail) : null;
  $('rankingSubmit').disabled = !api || !ready || !currentResult || busy;
  $('rankingSaveStatus').textContent = api && ready ? '별명을 쓰고 최고 기록을 등록해 보세요.' : '랭킹 연결 후 등록할 수 있어요. 게임 결과는 이 화면에 남아 있어요.';
});
window.addEventListener('rgb-sensitivity:reset', () => {
  currentResult = null;
  $('rankingSubmit').disabled = true;
});
window.dispatchEvent(new CustomEvent('rgb-sensitivity:request-result'));

$('rankingForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !api || !ready || !validResult(currentResult)) return;
  const name = normalizeName($('rankingName').value);
  $('rankingName').value = name;
  if (!name) { $('rankingSaveStatus').textContent = '랭킹에 공개할 별명을 입력하세요.'; $('rankingName').focus(); return; }
  const result = structuredClone(currentResult);
  const connected = api;
  busy = true;
  $('rankingSubmit').disabled = true;
  $('rankingSaveStatus').textContent = '최고 기록을 등록하고 있어요…';
  try {
    authApi ||= await timed(import(`${SDK}/firebase-auth.js`), 15000, '랭킹 로그인 준비 시간이 초과됐어요.');
    auth ||= authApi.initializeAuth(connected.app, { persistence: authApi.browserLocalPersistence });
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    const user = auth.currentUser || (await timed(authApi.signInAnonymously(auth), 15000, '랭킹 로그인 시간이 초과됐어요.')).user;
    myUid = user.uid;
    const recordRef = connected.sdk.ref(connected.db, `${BOARD_PATH}/${user.uid}`);
    const saved = await timed(connected.sdk.runTransaction(recordRef, current => bestRecord(current, result, name, connected.sdk.serverTimestamp()), { applyLocally: false }), 15000, '기록 저장 응답이 늦어요. 연결이 돌아오면 반영될 수 있으니 랭킹을 확인해 주세요.');
    const best = saved.snapshot.val();
    $('rankingSaveStatus').textContent = saved.committed ? `최고 기록 ${best.score.toLocaleString('ko-KR')}점을 등록했어요!` : `이미 등록한 최고 기록 ${best.score.toLocaleString('ko-KR')}점을 유지했어요.`;
    try { localStorage.setItem('rgbSensitivity.rankingName', name); } catch { /* Playing and ranking do not require localStorage access. */ }
    render({ ...(lastRecords || {}), [myUid]: best });
  } catch (error) {
    $('rankingSaveStatus').textContent = readableError(error);
  } finally {
    busy = false;
    $('rankingSubmit').disabled = !api || !ready || !currentResult;
  }
});
$('rankingReconnect').addEventListener('click', connect);
try { $('rankingName').value = normalizeName(localStorage.getItem('rgbSensitivity.rankingName')); } catch { /* Optional remembered nickname. */ }
window.addEventListener('pagehide', () => { connectionRun++; unsubscribe?.(); offConnection?.(); });
window.addEventListener('pageshow', event => { if (event.persisted) connect(); });
connect();
