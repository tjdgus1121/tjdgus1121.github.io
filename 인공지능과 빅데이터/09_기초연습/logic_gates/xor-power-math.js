(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.XorPowerMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PAIRS = Object.freeze([[1, 1], [1, 0], [0, 1], [0, 0]].map(Object.freeze));
  function bit(value) {
    if (value !== 0 && value !== 1) throw new TypeError('입력은 0 또는 1이어야 합니다.');
    return value;
  }
  function finite(value) {
    if (!Number.isFinite(value)) throw new TypeError('유한한 숫자를 입력하세요.');
    return value;
  }
  function evaluate(x, y, alpha, wf, wg) {
    bit(x); bit(y);
    alpha = alpha === undefined ? 1.5 : finite(alpha);
    wf = wf === undefined ? 1 : finite(wf);
    wg = wg === undefined ? 1 : finite(wg);
    const tf = (-x - 2 * y) || 0, tg = x + 2 * y;
    const f = Number(tf >= -2), g = Number(tg >= 0.5);
    const sum = wf * f + wg * g;
    const h = Number(sum >= alpha), target = Number(x !== y);
    return { x: x, y: y, tf: tf, tg: tg, f: f, g: g, sum: sum, h: h, target: target, match: h === target };
  }
  function rows(alpha, wf, wg) {
    return PAIRS.map(function (p) { return evaluate(p[0], p[1], alpha, wf, wg); });
  }
  function interval(wf, wg) {
    const all = rows(1.5, wf, wg);
    const lower = Math.max.apply(null, all.filter(function (r) { return !r.target; }).map(function (r) { return r.sum; }));
    const upper = Math.min.apply(null, all.filter(function (r) { return r.target; }).map(function (r) { return r.sum; }));
    return { lower: lower, upper: upper, lowerClosed: false, upperClosed: true, exists: lower < upper };
  }
  function request(x, y) {
    bit(x); bit(y);
    return { valid: x !== y, reason: x && y ? '중복 선택' : x || y ? '단일 선택' : '선택 없음',
      source: x !== y ? (x ? '일반 전원' : '비상발전기') : null };
  }
  function acceptSource(current, x, y) {
    return request(x, y).source || current;
  }
  return Object.freeze({ PAIRS: PAIRS, evaluate: evaluate, rows: rows, interval: interval, request: request, acceptSource: acceptSource });
});
