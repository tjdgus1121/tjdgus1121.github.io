/* 체험활동 계산 모듈 — 화면과 무관한 순수 함수만 둔다(node 로 검사: node gd-math.test.cjs).
 * 데이터는 세 편 영상과 같다: 다섯 친구의 점수 y 와 공부 시간 x. */
(function (root) {
  'use strict';
  const FRIENDS = [
    { name: '가온', col: '#ff9fb8', x: 2, y: 4 },
    { name: '나래', col: '#ffc75a', x: 2, y: 6 },
    { name: '다솜', col: '#8fd9a8', x: 4, y: 7 },
    { name: '라온', col: '#7fb8ff', x: 4, y: 8 },
    { name: '마루', col: '#c4a1ff', x: 5, y: 10 },
  ];
  const CLASSES = {
    ours: { label: '우리 반', scores: FRIENDS.map((f) => f.y) },
    next: { label: '옆 반', scores: [6, 7, 7, 7, 8] },
  };

  const sum = (v) => v.reduce((s, x) => s + x, 0);
  const mean = (v) => sum(v) / v.length;
  /* 1편: 예측값 p 하나로 모두를 맞힐 때 */
  const deviations = (scores, p) => scores.map((y) => y - p);
  const meanSquare = (scores, p) => mean(scores.map((y) => (y - p) ** 2));
  const variance = (scores) => meanSquare(scores, mean(scores));

  /* 2편: y = ax 로 맞힐 때. L(a) = mean(x²)·a² − 2·mean(xy)·a + mean(y²) */
  const errors = (pts, a) => pts.map(({ x, y }) => y - a * x);
  const loss = (pts, a) => mean(errors(pts, a).map((e) => e * e));
  function coeffs(pts) {
    const xx = mean(pts.map((p) => p.x * p.x)), xy = mean(pts.map((p) => p.x * p.y)), yy = mean(pts.map((p) => p.y * p.y));
    return { xx, xy, yy, aStar: xy / xx, lMin: yy - xy * xy / xx };
  }

  /* 3편: 경사하강법. L′(a) = 2·mean(x²)·a − 2·mean(xy) */
  const slope = (pts, a) => { const c = coeffs(pts); return 2 * c.xx * a - 2 * c.xy; };
  const step = (pts, a, alpha) => a - alpha * slope(pts, a);
  /* 남은 거리 (a − a*) 가 한 걸음마다 곱해지는 수: 1 − 2·mean(x²)·α (이 데이터에선 1 − 26α) */
  const shrink = (pts, alpha) => 1 - 2 * coeffs(pts).xx * alpha;

  const api = { FRIENDS, CLASSES, sum, mean, deviations, meanSquare, variance, errors, loss, coeffs, slope, step, shrink };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GDMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
