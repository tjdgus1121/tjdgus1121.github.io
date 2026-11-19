// 추세선 대포 — 실시간 저장소
// Firebase Realtime Database와 시험용 가짜 저장소(?fake=1)가 같은 모양의 함수를 제공함
//   uid, now(), get, set, update, remove, push, on, onAdded, tx, dropOnLeave, onConn

const SDK = '12.15.0';
let testUid = null;

function sessionUid() {
  if (testUid) return testUid;
  const key = 'trendCannon.testUid.' + window.name;
  try { testUid = sessionStorage.getItem(key); } catch (e) { /* 세션 저장이 막힌 경우 메모리에서 유지 */ }
  if (!/^guest_[0-9a-f]{32}$/.test(testUid || '')) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    testUid = 'guest_' + Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
    try { sessionStorage.setItem(key, testUid); } catch (e) { /* 현재 페이지에서는 같은 ID 유지 */ }
  }
  return testUid;
}

export function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${what} 응답이 ${Math.round(ms / 1000)}초 동안 없습니다.`)), ms); }),
  ]);
}

export async function firebaseStore(config) {
  const base = `https://www.gstatic.com/firebasejs/${SDK}`;
  const [appM, dbM] = await withTimeout(Promise.all([
    import(`${base}/firebase-app.js`), import(`${base}/firebase-database.js`),
  ]), 15000, 'Firebase 불러오기');
  const app = appM.initializeApp(config);
  // 로그인 없이 탭 세션 ID로 참가자를 구분한다. 인증된 신원은 아니며 테스트 방에서만 사용한다.
  const uid = sessionUid();
  const db = dbM.getDatabase(app);
  const R = (p) => dbM.ref(db, p);
  let offset = 0;
  dbM.onValue(R('.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
  return {
    kind: 'firebase',
    uid,
    now: () => Date.now() + offset,
    get: async (p) => (await withTimeout(dbM.get(R(p)), 10000, '읽기')).val(),
    set: (p, v) => dbM.set(R(p), v),
    update: (p, v) => dbM.update(R(p), v),
    remove: (p) => dbM.remove(R(p)),
    push: (p, v) => { const r = dbM.push(R(p)); dbM.set(r, v).catch(() => {}); return r.key; },
    on: (p, cb, err) => dbM.onValue(R(p), (s) => cb(s.val()), (e) => err && err(e)),
    onAdded: (p, cb, n = 12) => dbM.onChildAdded(dbM.query(R(p), dbM.limitToLast(n)), (s) => cb(s.key, s.val())),
    tx: (p, fn) => dbM.runTransaction(R(p), fn),
    dropOnLeave: (p) => dbM.onDisconnect(R(p)).remove(),
    onConn: (cb) => dbM.onValue(R('.info/connected'), (s) => cb(!!s.val())),
  };
}

// ── 시험용 가짜 저장소: 같은 페이지 안의 여러 iframe이 window.top 의 한 저장소를 나눠 씀 ──
class FakeHub {
  constructor() { this.root = {}; this.subs = new Set(); this.pending = new Set(); this.seq = 0; }
  parts(p) { return String(p).split('/').filter(Boolean); }
  read(p) {
    let n = this.root;
    for (const k of this.parts(p)) { if (n == null || typeof n !== 'object') return null; n = n[k]; }
    return n === undefined ? null : JSON.parse(JSON.stringify(n));
  }
  write(p, v) {
    const ks = this.parts(p);
    v = v === undefined || v === null ? null : JSON.parse(JSON.stringify(v));
    if (!ks.length) { this.root = v || {}; return; }
    let n = this.root;
    const chain = [];
    for (let i = 0; i < ks.length - 1; i++) {
      chain.push([n, ks[i]]);
      if (n[ks[i]] == null || typeof n[ks[i]] !== 'object') n[ks[i]] = {};
      n = n[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (v === null) delete n[last]; else n[last] = v;
    for (let i = chain.length - 1; i >= 0; i--) {   // 빈 객체 정리 (Firebase처럼)
      const [parent, key] = chain[i];
      if (parent[key] && typeof parent[key] === 'object' && !Object.keys(parent[key]).length) delete parent[key];
    }
  }
}

// 알림은 지금 쓰는 창의 코드와 타이머로 처리 (먼저 만든 iframe이 새로고침돼 사라져도 멈추지 않게)
function touchHub(hub, p) {
  const ks = hub.parts(p).join('/');
  for (const s of hub.subs) {
    if (s.path === ks || s.path.startsWith(ks + '/') || ks.startsWith(s.path + '/') || !s.path || !ks) hub.pending.add(s);
  }
  setTimeout(() => flushHub(hub), 15);   // 쓸 때마다 이 창 타이머로 (비어 있으면 아무 일 없음)
}
function flushHub(hub) {
  const list = [...hub.pending]; hub.pending.clear();
  for (const s of list) {
    if (!hub.subs.has(s)) continue;
    try { s.fire(); } catch (e) { console.error(e); }   // 한 구독의 오류가 다른 창 알림을 막지 않게
  }
}

export function fakeStore() {
  const top = window.top;
  const hub = top.__trendFakeHub || (top.__trendFakeHub = new FakeHub());
  // 탭 세션을 유지해 새로고침해도 같은 참가자로 복귀
  let uid = null;
  try { uid = sessionStorage.getItem('trendFake.uid.' + window.name); } catch (e) { /* 저장 못 하면 새로 */ }
  if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('trendFake.uid.' + window.name, uid); } catch (e) { /* 무시 */ } }
  const drops = [], mine = new Set();
  window.addEventListener('pagehide', () => {
    for (const s of mine) hub.subs.delete(s);   // 닫힌 창의 구독은 정리 (Firebase 연결이 끊기는 것과 같음)
    drops.forEach((p) => { hub.write(p, null); touchHub(hub, p); });
  });
  const sub = (path, fire) => {
    const s = { path: hub.parts(path).join('/'), fire };
    hub.subs.add(s); mine.add(s);
    setTimeout(() => hub.subs.has(s) && s.fire(), 0);
    return () => hub.subs.delete(s);
  };
  return {
    kind: 'fake',
    uid,
    hub,
    now: () => Date.now(),
    get: async (p) => hub.read(p),
    set: async (p, v) => { hub.write(p, v); touchHub(hub, p); },
    update: async (p, obj) => { for (const [k, v] of Object.entries(obj)) hub.write(`${p}/${k}`, v); touchHub(hub, p); },
    remove: async (p) => { hub.write(p, null); touchHub(hub, p); },
    push: (p, v) => { const key = 'k' + String(++hub.seq).padStart(9, '0'); hub.write(`${p}/${key}`, v); touchHub(hub, `${p}/${key}`); return key; },
    on: (p, cb) => sub(p, () => cb(hub.read(p))),
    onAdded: (p, cb, n = 12) => {
      let known = null;
      return sub(p, () => {
        const v = hub.read(p) || {};
        const keys = Object.keys(v).sort();
        if (known === null) { known = new Set(keys); keys.slice(-n).forEach((k) => cb(k, v[k])); return; }
        for (const k of keys) if (!known.has(k)) { known.add(k); cb(k, v[k]); }
      });
    },
    tx: async (p, fn) => { const nv = fn(hub.read(p)); if (nv !== undefined) { hub.write(p, nv); touchHub(hub, p); } },
    dropOnLeave: (p) => { drops.push(p); },
    onConn: (cb) => { setTimeout(() => cb(true), 0); return () => {}; },
  };
}
