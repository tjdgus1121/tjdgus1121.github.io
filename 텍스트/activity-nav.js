/* 예전 텍스트 활동 메뉴 → 사이트 공통 단원 메뉴(../unit-nav.js)로 바뀌었다 (2026-11-19).
   이 파일을 아직 불러오는 페이지가 있어도 같은 메뉴가 나오도록 연결만 한다. */
(() => {
    "use strict";
    if (document.querySelector('script[src*="unit-nav.js"]')) return;
    const s = document.createElement("script");
    s.src = new URL("../unit-nav.js", document.currentScript.src).href;
    s.dataset.unit = "text";
    document.head.appendChild(s);
})();
