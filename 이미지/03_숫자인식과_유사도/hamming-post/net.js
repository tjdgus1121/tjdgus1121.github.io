import { firebaseConfig } from './firebase-config.js';

const SDK_VERSION = '12.19.0';
const ROOT = 'hammingRooms';
const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000;
const PHASES = ['collect', 'compare', 'binary', 'distance', 'closed'];
const SESSION_KEY = 'hammingPost.session.v1';

let connectionPromise = null;
let connection = null;
const connectionListeners = new Set();

function roomPath(code, suffix = '') {
  return `${ROOT}/${code}${suffix ? `/${suffix}` : ''}`;
}

function normalizeName(value) {
  const name = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 12 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('이름이나 별명을 1~12자로 입력해 주세요.');
  }
  return name;
}

function normalizeCode(value) {
  const code = String(value ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new Error('방 코드는 숫자 6자리예요.');
  return code;
}

function normalizeAnswers(value) {
  const answers = String(value ?? '').trim();
  if (!/^[01]{9}$/.test(answers)) throw new Error('아홉 칸의 취향을 모두 골라 주세요.');
  return answers;
}

function readableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (/operation-not-allowed|admin-restricted-operation/.test(code)) return '익명 로그인이 아직 켜져 있지 않아요. 선생님께 Firebase 설정을 확인해 달라고 알려 주세요.';
  if (/unauthorized-domain/.test(code)) return '이 사이트 주소의 Firebase 인증 설정이 필요해요. 선생님께 알려 주세요.';
  if (/permission.denied/i.test(code + message)) return '방이 닫혔거나 접근 권한이 없어요. 방 코드와 진행 단계를 확인해 주세요.';
  if (/network-request-failed|unavailable|disconnected/.test(code + message)) return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  if (/expired|만료/.test(message)) return '이 방은 수업 시간이 지나 참여할 수 없어요.';
  return message || '함께하기 연결에 실패했어요. 잠시 뒤 다시 시도해 주세요.';
}

function randomRoomCode() {
  const digits = new Uint32Array(1);
  crypto.getRandomValues(digits);
  return String(digits[0] % 1_000_000).padStart(6, '0');
}

function savedSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value) || !/^\d{6}$/.test(value.code || '')) return null;
    const name = String(value.name || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 12 || /[\u0000-\u001f\u007f]/.test(name)) return null;
    return { code: value.code, name };
  } catch (_) {
    return null;
  }
}

function rememberSession(code, name) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, name })); } catch (_) { /* current page still works */ }
}

function forgetSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* optional browser storage */ }
}

function requireOnline(state) {
  if (!state.online) throw new Error('인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
}

async function waitForValue(dbSdk, reference, predicate, description) {
  return new Promise((resolve, reject) => {
    let stop = () => {};
    const timeout = setTimeout(() => {
      stop();
      reject(new Error(`${description} 시간이 길어지고 있어요. 인터넷 연결을 확인해 주세요.`));
    }, 12_000);
    stop = dbSdk.onValue(reference, (snapshot) => {
      if (!predicate(snapshot.val())) return;
      clearTimeout(timeout);
      queueMicrotask(stop);
      resolve(snapshot.val());
    }, (error) => {
      clearTimeout(timeout);
      queueMicrotask(stop);
      reject(error);
    });
  });
}

async function ensureConnection(onConnection) {
  if (onConnection) connectionListeners.add(onConnection);
  if (connection) {
    onConnection?.(connection.online);
    return connection;
  }
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    if (!firebaseConfig?.apiKey || !firebaseConfig.databaseURL) {
      throw new Error('Firebase 함께하기 설정이 비어 있어요.');
    }
    const base = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
    const [appSdk, authSdk, dbSdk] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-database.js`),
    ]);
    const app = appSdk.getApps().find((item) => item.name === 'hamming-post')
      || appSdk.initializeApp(firebaseConfig, 'hamming-post');
    const auth = authSdk.getAuth(app);
    await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
    await auth.authStateReady();
    const user = auth.currentUser || (await authSdk.signInAnonymously(auth)).user;
    const db = dbSdk.getDatabase(app);
    const result = {
      auth,
      authSdk,
      db,
      dbSdk,
      uid: user.uid,
      online: false,
      offset: 0,
      disconnects: new Map(),
      now: () => Date.now() + result.offset,
    };
    dbSdk.onValue(dbSdk.ref(db, '.info/serverTimeOffset'), (snapshot) => {
      result.offset = Number(snapshot.val()) || 0;
    });
    dbSdk.onValue(dbSdk.ref(db, '.info/connected'), async (snapshot) => {
      result.online = snapshot.val() === true;
      if (result.online) {
        // onDisconnect handlers are one-shot. Recreate presence when a laptop
        // reconnects, including an already joined room after a brief outage.
        for (const code of [...result.disconnects.keys()]) {
          try {
            await armDisconnect(result, code);
            await dbSdk.update(dbSdk.ref(db, roomPath(code, `players/${result.uid}`)), { online: true });
          } catch (_) { /* the next explicit action can report a real room error */ }
        }
      }
      connectionListeners.forEach((listener) => listener(result.online));
    });
    await waitForValue(dbSdk, dbSdk.ref(db, '.info/connected'), (value) => value === true, 'Firebase 연결');
    await waitForValue(dbSdk, dbSdk.ref(db, '.info/serverTimeOffset'), () => true, '수업 시각 맞추기');
    connection = result;
    return result;
  })();

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

async function armDisconnect(state, code) {
  const presenceRef = state.dbSdk.ref(state.db, roomPath(code, `players/${state.uid}/online`));
  const handler = state.dbSdk.onDisconnect(presenceRef);
  await handler.set(false);
  state.disconnects.set(code, handler);
}

async function cancelDisconnect(state, code) {
  const handler = state.disconnects.get(code);
  if (!handler) return;
  state.disconnects.delete(code);
  try { await handler.cancel(); } catch (_) { /* the server cleanup remains safe */ }
}

function activeRoom(room, now) {
  if (!room?.meta || room.meta.schema !== 'taste9-v1') throw new Error('방을 찾을 수 없어요. 코드를 다시 확인해 주세요.');
  if (Number(room.meta.expiresAt) <= now) throw new Error('이 방은 수업 시간이 지나 참여할 수 없어요.');
  return room;
}

export async function connect({ onConnection } = {}) {
  const state = await ensureConnection(onConnection);
  const ref = (code, suffix = '') => state.dbSdk.ref(state.db, roomPath(code, suffix));

  async function createRoom(name) {
    const nickname = normalizeName(name);
    requireOnline(state);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = randomRoomCode();
      const initialRoom = {
        meta: {
          hostUid: state.uid,
          phase: 'collect',
          schema: 'taste9-v1',
          createdAt: state.dbSdk.serverTimestamp(),
          expiresAt: state.now() + ROOM_LIFETIME_MS,
        },
        players: {
          [state.uid]: {
            name: nickname,
            answers: '',
            joinedAt: state.dbSdk.serverTimestamp(),
            online: true,
          },
        },
      };
      const result = await state.dbSdk.runTransaction(ref(code), (current) => (current ? undefined : initialRoom), { applyLocally: false });
      if (!result.committed || result.snapshot.child('meta/hostUid').val() !== state.uid) continue;
      await armDisconnect(state, code);
      rememberSession(code, nickname);
      return { code };
    }
    throw new Error('방 코드를 만들지 못했어요. 다시 눌러 주세요.');
  }

  async function joinRoom(roomCode, name) {
    const code = normalizeCode(roomCode);
    const nickname = normalizeName(name);
    requireOnline(state);
    const snapshot = await state.dbSdk.get(ref(code));
    const room = activeRoom(snapshot.val(), state.now());
    const mine = room.players?.[state.uid];
    if (mine) {
      await state.dbSdk.update(ref(code, `players/${state.uid}`), { online: true });
      rememberSession(code, mine.name);
    } else {
      if (room.meta.phase !== 'collect') throw new Error('취향을 모으는 시간이 끝났어요. 새 방 코드를 받아 주세요.');
      await state.dbSdk.set(ref(code, `players/${state.uid}`), {
        name: nickname,
        answers: '',
        joinedAt: state.dbSdk.serverTimestamp(),
        online: true,
      });
      rememberSession(code, nickname);
    }
    await armDisconnect(state, code);
    return { code };
  }

  function watchRoom(roomCode, onRoom, onError) {
    let code;
    try { code = normalizeCode(roomCode); } catch (error) { onError?.(new Error(readableError(error))); return () => {}; }
    return state.dbSdk.onValue(ref(code), (snapshot) => onRoom(snapshot.val()), (error) => onError?.(new Error(readableError(error))));
  }

  async function submitAnswers(roomCode, answers) {
    const code = normalizeCode(roomCode);
    const bits = normalizeAnswers(answers);
    requireOnline(state);
    await state.dbSdk.update(ref(code, `players/${state.uid}`), {
      answers: bits,
      submittedAt: state.dbSdk.serverTimestamp(),
      online: true,
    });
  }

  async function setPhase(roomCode, phase) {
    const code = normalizeCode(roomCode);
    if (!PHASES.includes(phase)) throw new Error('알 수 없는 수업 단계예요.');
    requireOnline(state);
    const result = await state.dbSdk.runTransaction(ref(code, 'meta'), (current) => {
      if (!current || current.hostUid !== state.uid) return;
      if (current.phase === 'closed' || current.phase === phase) return;
      return { ...current, phase };
    }, { applyLocally: false });
    if (!result.committed) throw new Error('방장만 다음 단계로 넘길 수 있어요.');
  }

  async function leaveRoom(roomCode) {
    const code = normalizeCode(roomCode);
    requireOnline(state);
    await state.dbSdk.update(ref(code, `players/${state.uid}`), { online: false });
    await cancelDisconnect(state, code);
    const saved = savedSession();
    if (saved?.code === code) forgetSession();
  }

  async function closeRoom(roomCode) {
    const code = normalizeCode(roomCode);
    requireOnline(state);
    const result = await state.dbSdk.runTransaction(ref(code), (current) => {
      if (!current?.meta || current.meta.hostUid !== state.uid) return;
      return null;
    }, { applyLocally: false });
    if (!result.committed) throw new Error('방장만 함께하기를 마칠 수 있어요.');
    await cancelDisconnect(state, code);
    const saved = savedSession();
    if (saved?.code === code) forgetSession();
  }

  return {
    uid: state.uid,
    get savedSession() { return savedSession(); },
    createRoom,
    joinRoom,
    watchRoom,
    submitAnswers,
    setPhase,
    leaveRoom,
    closeRoom,
    readableError,
  };
}

export { PHASES, ROOT, readableError };

// 모듈을 쓰지 않는 보조 페이지에서도 같은 연결 API를 호출할 수 있게 노출합니다.
globalThis.HammingNet = Object.freeze({ connect, PHASES, ROOT, readableError });
