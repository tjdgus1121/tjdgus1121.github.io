/* backguard.js — 뒤로가기를 "되돌리기"로 쓰는 공용 스크립트
 *
 * 학생이 그림을 그리다 뒤로가기를 누르면 활동 전체가 사라지는 문제를 막는다.
 * 되돌릴 것이 남아 있는 동안에는 한 단계씩 되돌리고,
 * 다 되돌리고 나면 평소처럼 이전 페이지로 나간다. (사이트에 갇히지 않게 하기 위함)
 *
 * 쓰는 법 — 되돌릴 동작을 하기 "직전"에 복구 함수를 넘긴다.
 *   BackGuard.push(function () { ...원래대로 돌리는 코드... });
 */
(function () {
  'use strict';

  var stack = [];
  var MAX = 30;          // 너무 쌓이면 메모리를 먹으므로 제한
  var armed = false;     // 뒤로가기를 가로챌 준비가 됐는지
  var toastEl = null;
  var toastTimer = null;

  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);' +
        'z-index:99999;padding:11px 18px;border-radius:8px;' +
        'background:#232227;color:#fff;font-size:14px;font-weight:700;' +
        'font-family:"Noto Sans KR",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);' +
        'pointer-events:none;opacity:0;transition:opacity .18s';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 1400);
  }

  function arm() {
    if (armed) return;
    try { history.pushState({ backguard: 1 }, ''); armed = true; } catch (e) { /* 무시 */ }
  }

  function undoOnce(fromBack) {
    var fn = stack.pop();
    try { fn(); } catch (e) { console.error('[backguard] 되돌리기 실패', e); }
    toast(stack.length ? '되돌렸습니다 · 남은 되돌리기 ' + stack.length + '회'
                       : '되돌렸습니다 · 처음 상태입니다');
    if (fromBack && stack.length) arm();   // 아직 남았으면 다시 가로챌 준비
  }

  window.addEventListener('popstate', function () {
    armed = false;
    if (stack.length) { undoOnce(true); return; }
    history.back();          // 되돌릴 게 없으면 평소처럼 이전 페이지로
  });

  // 키보드에도 익숙한 방식으로 열어 둔다
  window.addEventListener('keydown', function (e) {
    var z = (e.key === 'z' || e.key === 'Z');
    if (!(e.ctrlKey || e.metaKey) || !z || e.shiftKey) return;
    if (!stack.length) return;
    e.preventDefault();
    undoOnce(false);
  });

  window.BackGuard = {
    push: function (undoFn) {
      if (typeof undoFn !== 'function') return;
      stack.push(undoFn);
      if (stack.length > MAX) stack.shift();
      arm();
    },
    clear: function () { stack.length = 0; },
    size: function () { return stack.length; }
  };
})();
