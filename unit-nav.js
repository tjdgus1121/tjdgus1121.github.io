/* 단원 공통 메뉴 (텍스트 · 예측과 최적화 · 인공지능과 빅데이터)
 *
 * 사용: <script src="(사이트 루트까지 상대 경로)/unit-nav.js" data-unit="predict" defer></script>
 *   data-unit : text | predict | ai
 *   data-pos  : tl(기본, 왼쪽 위) | tr | bl | br | tab | inline
 *   data-compact : 있으면 버튼에 단원 이름을 빼고 ☰ 만 보인다
 *   data-mount : 메뉴를 넣을 헤더 ID. data-cover와 data-cover-mount는 인트로 대화상자와 그 안의 헤더 ID.
 *   data-root / data-page : 단일 HTML에 내장할 때 사이트 루트 URL과 현재 활동 경로.
 * 메뉴 항목 경로는 사이트 루트 기준. 하위 화면(모션·게임·편)은 match 접두어로 해당 활동을 강조한다.
 * 활동을 추가·삭제할 때는 아래 UNITS 만 고치면 모든 화면 메뉴에 반영된다.
 */
(() => {
  "use strict";
  const me = document.currentScript;
  if (!me) return;
  const ROOT = new URL(me.dataset.root || ".", me.src || document.baseURI);

  // [경로, 이름, 하위 화면 접두어 목록(선택), 외부 링크 여부(선택)]
  const UNITS = {
    text: {
      name: "텍스트 탐구", icon: "💬", color: "#0e7490", home: "텍스트/indextext.html",
      groups: [
        ["텍스트를 숫자로", [
          ["텍스트/activity0_textgame.html", "핵심 단어 뽑기 게임"],
          ["텍스트/activity1_tfidf.html", "TF-IDF 분석 도구", ["텍스트/activity1_tfidf_prev.html"]],
        ]],
        ["유사도", [
          ["텍스트/doppelganger/index.html", "도플갱어를 찾아라", ["텍스트/doppelganger/"]],
          ["텍스트/activity2_similarity.html", "유사도 분석"],
          ["텍스트/activity3_quiz.html", "코사인 유사도 단어 잇기"],
          ["텍스트/activity4_similiarityprc.html", "유사도 계산하기"],
        ]],
        ["감정 분석", [
          ["텍스트/activity5_jaccard.html", "감정 분석 도구"],
          ["https://jaccard.pages.dev/", "자카드 감정 분류 실험실", null, true],
        ]],
        ["언어 모델", [
          ["텍스트/attention/index.html", "LLM 어텐션", ["텍스트/attention/"]],
        ]],
      ],
    },
    predict: {
      name: "예측과 최적화", icon: "📈", color: "#4f46e5", home: "예측과 최적화/index.html",
      groups: [
        ["예측과 오차", [
          ["예측과 최적화/시소핏/index.html", "시소 핏"],
        ]],
        ["경사하강법", [
          ["예측과 최적화/경사하강법/index.html", "경사하강법 활동 모음"],
          ["예측과 최적화/경사하강법/gradient_descent_lab.html", "추세선과 오차 실험실"],
          ["예측과 최적화/경사하강법/gradient_descent_slope.html", "기울기 하나로 배우는 경사하강법", ["예측과 최적화/경사하강법/gradient-descent-motion/"]],
          ["예측과 최적화/경사하강법/squared-error.html", "오차제곱 이해하기"],
          ["예측과 최적화/경사하강법/평균에서-경사하강법까지/index.html", "평균에서 경사하강법까지", ["예측과 최적화/경사하강법/평균에서-경사하강법까지/"]],
          ["예측과 최적화/경사하강법/co2_loss_excel.html", "실제 데이터로 손실함수 찾기", ["예측과 최적화/경사하강법/loss-excel-motion/"]],
          ["예측과 최적화/방탈출/gradient-descent-escape/index.html", "방탈출 · 그레이 박사의 마지막 밤", ["예측과 최적화/방탈출/"]],
        ]],
        ["더 살펴보기", [
          ["예측과 최적화/추세선대포/index.html", "추세선 대포", ["예측과 최적화/추세선대포/"]],
          ["예측과 최적화/GAN_QUEST_인공지능수학.html", "GAN QUEST"],
          ["예측과 최적화/길찾기/index.html", "A*까지 가는 길", ["예측과 최적화/길찾기/"]],
        ]],
        ["확률로 분류하고 평가하기", [
          ["예측과 최적화/조건부확률/index.html", "조건부확률 모션 해설", ["예측과 최적화/조건부확률/"]],
          ["예측과 최적화/나이브베이즈/index.html", "나이브 베이즈", ["예측과 최적화/나이브베이즈/"]],
          ["예측과 최적화/분류평가/index.html", "AI 성적표 읽기", ["예측과 최적화/분류평가/"]],
        ]],
      ],
    },
    ai: {
      name: "인공지능과 빅데이터", icon: "🧠", color: "#0f766e", home: "인공지능과 빅데이터/index.html",
      groups: [
        ["기초 연습", [
          ["인공지능과 빅데이터/09_기초연습/index.html", "기초 연습 모음"],
          ["인공지능과 빅데이터/09_기초연습/binary_game.html", "이진법 게임", ["인공지능과 빅데이터/09_기초연습/_s_learn.html"]],
          ["인공지능과 빅데이터/09_기초연습/logic_gates/index.html", "논리 연산 탐구", ["인공지능과 빅데이터/09_기초연습/logic_gates/"]],
          ["인공지능과 빅데이터/09_기초연습/excel_practice.html", "엑셀 기초 연습실"],
        ]],
      ],
    },
  };

  const unit = UNITS[me.dataset.unit];
  if (!unit) return;

  const abs = p => new URL(p, ROOT);
  const norm = u => decodeURIComponent(u.pathname).replace(/\/index\.html$/, "/");
  const here = norm(me.dataset.page ? abs(me.dataset.page) : new URL(location.href));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // 현재 화면과 같은 항목, 없으면 접두어가 가장 길게 맞는 항목을 강조
  let flat = [], n = 0;
  for (const [, items] of unit.groups) for (const it of items) flat.push({ path: it[0], name: it[1], match: it[2] || [], ext: !!it[3], n: it[3] ? "↗" : String(++n) });
  let cur = flat.find(it => !it.ext && norm(abs(it.path)) === here), sub = false;
  if (!cur) {
    let best = 0;
    for (const it of flat) for (const m of it.match) {
      const pre = norm(abs(m));
      if (here.startsWith(pre) && pre.length > best) { best = pre.length; cur = it; sub = true; }
    }
  }
  const inner = flat.filter(it => !it.ext);
  const ci = cur ? inner.indexOf(cur) : -1;
  const prev = ci > 0 ? inner[ci - 1] : null, next = ci >= 0 && ci < inner.length - 1 ? inner[ci + 1] : null;

  function mount() {
    if (document.getElementById("unitNav")) return;
    if (!document.querySelector('[data-unit-nav]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = abs("unit-nav.css").href; css.dataset.unitNav = "";
      document.head.appendChild(css);
    }
    const nav = document.createElement("nav");
    nav.id = "unitNav";
    nav.className = "unav" + ("compact" in me.dataset ? " compact" : "");
    nav.dataset.pos = me.dataset.pos || "tl";
    nav.setAttribute("aria-label", unit.name + " 단원 메뉴");
    nav.style.setProperty("--unav-c", unit.color);
    const item = it => {
      const isCur = it === cur;
      const href = isCur && me.dataset.page ? location.href : it.ext ? it.path : abs(it.path).href;
      return `<a class="unav-item${isCur ? " cur" : ""}" href="${esc(href)}"${isCur && !sub ? ' aria-current="page"' : ""}${it.ext ? ' target="_blank" rel="noopener"' : ""}>`
        + `<span class="unav-n">${it.n}</span><span>${esc(it.name)}</span>`
        + (isCur ? `<span class="unav-here">${sub ? "↩ 안내로" : "지금 여기"}</span>` : it.ext ? '<span class="unav-x">새 창</span>' : "") + "</a>";
    };
    const step = (it, cls, label) => it
      ? `<a class="${cls}" href="${esc(abs(it.path).href)}" title="${esc(it.name)}">${cls === "pv" ? "← " : ""}<em>${label} · ${esc(it.name)}</em>${cls === "nx" ? " →" : ""}</a>`
      : `<span class="${cls}">${cls === "pv" ? "← " : ""}${label}${cls === "nx" ? " →" : ""}</span>`;
    nav.innerHTML = `
      <button type="button" class="unav-btn" aria-expanded="false" aria-controls="unitNavPanel" aria-label="${esc(unit.name)} 메뉴" title="${esc(unit.name)} 메뉴">
        <span class="unav-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="unav-btn-t">${esc(unit.name)}</span>
      </button>
      <div class="unav-panel" id="unitNavPanel" hidden>
        <div class="unav-head">
          <span class="unav-ico" aria-hidden="true">${unit.icon}</span>
          <span class="unav-ttl"><small>단원 메뉴</small><b>${esc(unit.name)}</b></span>
          <a class="unav-home" href="${esc(abs(unit.home).href)}">단원 홈</a>
        </div>
        <div class="unav-list">
          ${unit.groups.map(([t, items]) => `<div class="unav-sec">${esc(t)}</div>${items.map(it => item(flat.find(f => f.path === it[0]))).join("")}`).join("")}
        </div>
        <div class="unav-foot">
          ${cur && !cur.ext ? `<div class="unav-step">${step(prev, "pv", "이전")}${step(next, "nx", "다음")}</div>` : ""}
          <a class="unav-site" href="${esc(abs("index.html").href)}">⌂ 전체 활동 홈</a>
        </div>
      </div>`;
    const btn = nav.querySelector(".unav-btn"), panel = nav.querySelector(".unav-panel");
    const setOpen = open => {
      panel.hidden = !open; nav.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      if (open) (panel.querySelector(".unav-item.cur") || panel.querySelector("a"))?.scrollIntoView({ block: "nearest" });
    };
    // 전체 화면 인트로가 열려 있으면 메뉴도 대화상자 안에 있어야 조작할 수 있다.
    const cover = me.dataset.cover && document.getElementById(me.dataset.cover);
    const header = me.dataset.mount && document.getElementById(me.dataset.mount);
    const coverHeader = cover && (document.getElementById(me.dataset.coverMount) || cover);
    const placeNav = () => {
      const container = cover?.open ? coverHeader : header || document.body;
      if (nav.parentElement === container) return;
      setOpen(false);
      if (container === document.body) container.append(nav);
      else container.prepend(nav);
    };
    placeNav();
    if (cover) {
      new MutationObserver(placeNav).observe(cover, { attributes: true, attributeFilter: ["open"] });
      nav.addEventListener("keydown", e => { if (e.key !== "Escape") e.stopPropagation(); });
    }
    btn.addEventListener("click", e => { e.stopPropagation(); setOpen(panel.hidden); });
    document.addEventListener("click", e => { if (!panel.hidden && !nav.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !panel.hidden) {
        if (cover?.open) e.preventDefault();
        setOpen(false);
        btn.focus();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
