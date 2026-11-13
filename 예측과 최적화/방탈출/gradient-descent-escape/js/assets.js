/* 그림 경로·불러오기. 원본 그림은 옆 폴더 gradient-descent-escape-assets 를 그대로 읽는다.
 * 그림 파일에 없는 것(TV·비디오테이프)은 SVG 로 직접 그려 같은 방식으로 쓴다. */
(function (root) {
  'use strict';
  const GD = root.GD = root.GD || {};
  const BASE = '../gradient-descent-escape-assets/';
  const url = (p) => (p.startsWith('data:') || p.startsWith('./') ? p : BASE + p); // ./ 로 시작하면 게임 폴더 안 그림
  const cache = new Map();

  function img(p) {
    if (cache.has(p)) return cache.get(p);
    const im = new Image();
    im.decoding = 'async';
    // 맵 소품은 잘라서 줄인 사본(tools/make-small-sprites.py)을 쓴다. 살펴보기 창의 큰 그림은 url()로 원본 그대로
    const small = GD.assets && GD.assets.small && GD.assets.small[p];
    im.small = !!small;
    im.src = small || url(p);
    im.ok = false;
    im.onload = () => { im.ok = true; };
    im.onerror = () => { im.bad = true; console.warn('그림을 찾지 못함:', p); };
    cache.set(p, im);
    return im;
  }
  function preload(list) {
    return Promise.all(list.map((p) => new Promise((res) => {
      const im = img(p);
      if (im.complete && im.naturalWidth) { im.ok = true; res(); return; }
      im.addEventListener('load', res, { once: true });
      im.addEventListener('error', res, { once: true });
    })));
  }

  /* ---------- 코드로 그린 그림 ---------- */
  const svgURL = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  // 박사의 영상 상자(TV) — 나무 상자 + 놋쇠 손잡이, 화면은 꺼진 녹색 유리
  const tvSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 170">
    <ellipse cx="80" cy="160" rx="62" ry="8" fill="#000" opacity=".28"/>
    <rect x="34" y="128" width="12" height="32" rx="4" fill="#4a2f20" stroke="#1d1410" stroke-width="3"/>
    <rect x="114" y="128" width="12" height="32" rx="4" fill="#4a2f20" stroke="#1d1410" stroke-width="3"/>
    <rect x="10" y="22" width="140" height="112" rx="18" fill="#7a5034" stroke="#1d1410" stroke-width="5"/>
    <rect x="16" y="28" width="128" height="10" rx="5" fill="#9a6a45"/>
    <rect x="22" y="40" width="88" height="78" rx="16" fill="#1f3b36" stroke="#b07f22" stroke-width="6"/>
    <path d="M32 52 q14 -6 30 -4" stroke="#7fb3a6" stroke-width="5" stroke-linecap="round" fill="none" opacity=".55"/>
    <circle cx="128" cy="62" r="9" fill="#e2a940" stroke="#1d1410" stroke-width="3"/>
    <circle cx="128" cy="90" r="9" fill="#e2a940" stroke="#1d1410" stroke-width="3"/>
    <rect x="118" y="106" width="22" height="7" rx="3" fill="#1d1410"/>
    <path d="M56 22 L40 4 M104 22 L120 4" stroke="#b07f22" stroke-width="4" stroke-linecap="round"/>
    <circle cx="40" cy="4" r="4" fill="#e2a940"/><circle cx="120" cy="4" r="4" fill="#e2a940"/>
  </svg>`;
  const TV = svgURL(tvSVG);
  const TV_ON = svgURL(tvSVG.replace('fill="#1f3b36"', 'fill="#3c756c"').replace('</svg>', '<path d="M56 62 L56 94 L83 78 Z" fill="#ead7a5"/></svg>'));
  // 비디오테이프 「빗나간 예측」 (가방 아이콘·줍기 공용)
  const TAPE = svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <rect x="10" y="30" width="108" height="68" rx="9" fill="#2b2b30" stroke="#121214" stroke-width="5"/>
    <rect x="22" y="38" width="84" height="26" rx="5" fill="#f6ecd6" stroke="#121214" stroke-width="3"/>
    <rect x="26" y="42" width="40" height="7" rx="3" fill="#e2a940"/>
    <rect x="26" y="53" width="70" height="5" rx="2.5" fill="#d4583e" opacity=".8"/>
    <rect x="32" y="70" width="64" height="20" rx="8" fill="#151517" stroke="#4b4b52" stroke-width="3"/>
    <circle cx="46" cy="80" r="7" fill="#f6ecd6"/><circle cx="82" cy="80" r="7" fill="#f6ecd6"/>
    <circle cx="46" cy="80" r="3" fill="#151517"/><circle cx="82" cy="80" r="3" fill="#151517"/>
  </svg>`);
  // 편차 토큰(숫자 없는 놋쇠 토큰을 가방에서 묶음으로)
  const HOOK = 'props/spring-hook.png';

  GD.assets = { BASE, url, img, preload, TV, TV_ON, TAPE, HOOK };
})(window);
