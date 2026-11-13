/* 대화·팝업에서 방향키/F로 버튼을 고르는 보조 입력 */
(function (root) {
  'use strict';
  const GD = root.GD;
  const $ = (s, el = document) => el.querySelector(s);
  const arrow = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  let remembered = null;
  let observeQueued = false;

  function currentScope() {
    if (GD.ui && GD.ui.popupOpen) return $('#popup');
    if (GD.ui && GD.ui.talking) return $('#scene');
    return null;
  }
  function visibleButton(button) {
    if (!button) return false;
    if (button.disabled || button.hidden || button.closest('[hidden], [inert]')) return false;
    const style = getComputedStyle(button);
    return style.display !== 'none' && style.visibility !== 'hidden' && button.getClientRects().length > 0;
  }
  function buttons(scope) { return scope ? [...scope.querySelectorAll('button')].filter(visibleButton) : []; }
  function keyFor(el) { return el && el.id ? '#' + CSS.escape(el.id) : null; }
  function mark(el, scroll = true) {
    document.querySelectorAll('.kbd-focus').forEach((old) => old.classList.remove('kbd-focus'));
    if (!el) return;
    remembered = keyFor(el);
    el.classList.add('kbd-focus');
    el.focus({ preventScroll: true });
    if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function isNativeArrowTarget(el) {
    return !!(el && (el.matches('input, select, textarea, [contenteditable="true"], svg[role="slider"]') || el.closest('iframe')));
  }
  function focusInitial(scopeName) {
    const scope = scopeName === 'popup' ? $('#popup') : scopeName === 'scene' ? $('#scene') : currentScope();
    if (!scope || scope.hidden) return false;
    const list = buttons(scope);
    if (!list.length) return false;
    const active = document.activeElement;
    if (list.includes(active)) { active.classList.add('kbd-focus'); return true; }
    const rememberedButton = remembered && scope.querySelector(remembered);
    const preferred = scope.id === 'popup'
      ? scope.querySelector('.pop-body button:not([disabled]):not([hidden])')
      : scope.querySelector('.dlg-choices button:not([disabled]):not([hidden])') || scope.querySelector('.dlg-next:not([hidden])');
    // 처음 포커스를 놓을 때는 화면을 끌어내리지 않음: 창의 제목·그림부터 보이게 (방향키로 옮기면 그때 따라감).
    // 대화가 끝나며 열린 창은 MutationObserver 경로(restoreAfterReplacement)로 여기 오므로 scopeName과 상관없이 막는다.
    mark(visibleButton(rememberedButton) ? rememberedButton : visibleButton(preferred) ? preferred : list[0], false);
    return true;
  }
  function move(direction) {
    const scope = currentScope(), list = buttons(scope);
    if (!list.length) return false;
    let from = document.activeElement;
    if (!list.includes(from)) { focusInitial(); return true; }
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const candidates = list.filter((b) => b !== from).map((b) => {
      const r = b.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const primary = direction === 'ArrowLeft' ? -dx : direction === 'ArrowRight' ? dx : direction === 'ArrowUp' ? -dy : dy;
      const cross = direction === 'ArrowLeft' || direction === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
      return { b, primary, score: primary + cross * .42 };
    }).filter((c) => c.primary > 2).sort((a, b) => a.score - b.score || a.primary - b.primary);
    if (candidates[0]) mark(candidates[0].b);
    return true;
  }
  function handleKeydown(e) {
    const scope = currentScope();
    if (!scope) return false;
    const active = document.activeElement;
    if (e.key === 'Escape' && GD.ui.popupOpen) { e.preventDefault(); GD.ui.closePopup(); return true; }
    if (arrow.has(e.key)) {
      if (isNativeArrowTarget(active)) return false;
      e.preventDefault();
      return move(e.key);
    }
    if ((e.key === 'f' || e.key === 'F') && !isNativeArrowTarget(active)) {
      e.preventDefault();
      if (e.repeat) return true;
      const list = buttons(scope);
      if (list.includes(active)) { active.click(); return true; }
      focusInitial();
      return true;
    }
    return false;
  }
  function restoreAfterReplacement() {
    observeQueued = false;
    const scope = currentScope();
    if (!scope || scope.contains(document.activeElement)) return;
    focusInitial();
  }
  function install() {
    const observer = new MutationObserver(() => {
      if (!observeQueued) { observeQueued = true; requestAnimationFrame(restoreAfterReplacement); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  document.addEventListener('focusin', (e) => {
    const scope = currentScope();
    if (scope && e.target instanceof HTMLButtonElement && scope.contains(e.target)) {
      remembered = keyFor(e.target);
      document.querySelectorAll('.kbd-focus').forEach((old) => { if (old !== e.target) old.classList.remove('kbd-focus'); });
      e.target.classList.add('kbd-focus');
    }
  });
  document.addEventListener('DOMContentLoaded', install);
  GD.keyboard = { handleKeydown, focusInitial };
})(window);
