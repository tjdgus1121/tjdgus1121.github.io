// 추세선 대포 Firebase 설정 (프로젝트 trend-cannon-6d72b, Realtime Database 싱가포르)
// 현재 로그인 없는 테스트 모드. 세션 ID는 참가자 구분용이며 인증 수단이 아닙니다.
// 테스트 규칙: tjdgus1121.github.io_배포안함/firebase/trend-cannon.test.rules.json
// null로 바꾸면 같이하기는 꺼지고 「혼자 연습하기」만 됩니다.

export const loginFreeTest = {
  roomRoot: 'trendTestRooms',
  expiresAt: 1795273200000, // 2026-11-22 00:00 KST 이후 서버 규칙에서 차단
};

export const firebaseConfig = {
  apiKey: 'AIzaSyCgLIkQwsKsRu4FomnVg6cZ_1EX1vjiyl8',
  authDomain: 'trend-cannon-6d72b.firebaseapp.com',
  databaseURL: 'https://trend-cannon-6d72b-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'trend-cannon-6d72b',
  storageBucket: 'trend-cannon-6d72b.firebasestorage.app',
  messagingSenderId: '850649912011',
  appId: '1:850649912011:web:1fbce1aafff581115e414e',
};
