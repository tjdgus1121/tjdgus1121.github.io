/* 시나리오 미션 5(마무리)~8과 엔딩 — 01_시나리오.md 6·7장.
 *  미션 5 「움직이는 예측선」: 좌표 칠판(작업 일정판)에 직선 맞추기 → 기울기·절편 → 뒷벽 선반의 10번째 책 → 두루마리 통 열쇠
 *  미션 6 「예측을 평가하는 숫자」: 두루마리 ☾☉★와 내 직선의 평균제곱오차 비교 → 기호 순서 ☉★☾ → 기울기 손잡이, 나선 계단
 *  박사의 방: 일기 장면 「지친 밤」(등잔이 있어야 들어감), 옷장·진열 상자 둘러보기
 *  미션 7 「내려가는 방향」: 예측 기계에 손잡이 → 돌려 보고 발밑 재기 → 톱니 상자 방향 레버 → 톱니 6개
 *  미션 8 「마지막 조정」: 톱니(학습률)를 골라 모래시계 10번 → 수렴 → 눈금판
 *  엔딩: 발코니 문 홈에 눈금판 → 시계가 다시 돎 → 발코니 편지 → 코그·기록판
 * 데이터 B(추 0~5개)에서 절편 10 고정, 손실 L(a) = 11(a − 2)² + 0.3, 발밑 기울기 L′(a) = 22a − 44. */
(function (root) {
  'use strict';
  const GD = root.GD, acts = GD.acts;
  const S = () => GD.state, ui = () => GD.ui, A = (p) => GD.assets.url(p);
  const narr = (...t) => t.map((x) => ({ who: 'narr', text: x }));
  const r2 = (v) => Math.round(v * 100) / 100;
  const BTN = 'style="color:#1d2a2c;border-color:#4a2f20"';
  const XB = [0, 1, 2, 3, 4, 5], YB = () => GD.DATA_B;
  const L = (a, b = 10) => [1, 2, 3, 4, 5].reduce((s, x) => s + (YB()[x] - (a * x + b)) ** 2, 0) / 5;   // 추 1~5개 다섯 점
  const dL = (a) => 22 * a - 44;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(GD.ITEMS, {
    scrollKey: { name: '두루마리 통 열쇠', icon: 'icons/icon-key-scroll.png', desc: '책장 10번째 책 속에 숨어 있던 열쇠. 작업실 두루마리 통에 맞을 것 같다.' },
    knob: { name: '기울기 손잡이', icon: 'icons/icon-knob.png', desc: '예측 기계의 오른쪽(기울기) 손잡이. 기계실 예측 기계에 끼운다.' },
    gears: { name: '톱니', icon: 'icons/icon-gears.png', desc: '크기가 다른 톱니 여섯 개. 톱니마다 손잡이를 한 번에 돌리는 비율이 다르다.' },
    plate: { name: '눈금판', icon: 'icons/icon-plate.png', desc: '추 1개당 2 cm, 0개일 때 10 cm. 박사가 끝내지 못한 용수철 저울 눈금판이 완성되었다.' },
  });
  Object.assign(GD.NOTES, {
    line: { title: '10월 14일 밤(이어서) — 예측선', body: '우체국장은 편지(추 1개)부터 큰 상자(추 7개)까지 무엇을 올려도 맞는 눈금을 원한다. 모든 무게를 매달아 볼 수는 없다.\n그래서 점들 사이를 지나는 직선, 추 개수 x를 넣으면 길이가 나오는 공식 ŷ = a·x + b를 세운다.\n0 눈금(절편 b)은 재면 바로 안다. 10 cm. 남은 것은 눈금 간격(기울기 a) 하나다.\n그런데 사흘 밤 동안 그은 직선 ☾·☉·★ 중 무엇이 더 좋은가? 두루마리 통에 넣어 두었다.' },
    mse: { title: '10월 19일 밤 — 예측을 평가하는 숫자', body: '직선을 여러 개 그렸지만 어느 것이 더 좋은지 판단할 기준이 없었다.\n측정실 칠판의 정사각형을 다시 썼다. 직선마다 오차 정사각형의 넓이 평균이 하나의 점수가 된다. 작을수록 좋은 직선이다.\n기울기 a를 넣으면 이 점수가 나오는 규칙, 이것을 손실함수 L(a)라 부르자. 그래프는 또 그릇 모양이다.' },
    slope: { title: '10월 24일 밤, 안개 — 내려가는 방향', body: '기계의 계기판은 지금 손잡이 위치의 손실만 가리킨다. 나는 안개 낀 산에서 발밑만 보이는 등산가와 같다.\n발밑의 기울기, 곧 손실함수의 미분계수가 길을 알려 준다. 기울기의 반대쪽으로 가면 내려간다.\n기울기가 클수록 바닥에서 멀고, 0에 가까울수록 바닥이다. 그렇다면 한 번에 얼마나 돌려야 하지?' },
    rate: { title: '10월 31일, 마지막 밤 — 마지막 조정', body: '새 a = a − (톱니 비율) × (발밑 기울기).\n크게 돌리면 지나치고, 작게 돌리면 새벽까지 끝낼 수 없다.\n한 번에 움직이는 비율을 학습률이라 하고, 바닥에 점점 다가가는 것을 수렴이라 한다. 맞는 톱니를 찾은 사람에게 이 시계탑을 맡긴다.' },
  });

  /* ---------- 공통: 추-길이 좌표판 (가로 추 0~5개, 세로 8~22 cm) ---------- */
  const PX = (x) => 60 + x * 90, PY = (y) => 270 - (y - 8) * 18;
  function plotBase() {
    let g = `<rect x="0" y="0" width="560" height="310" fill="#23382f"/>`;
    for (let x = 0; x <= 5; x++) g += `<line x1="${PX(x)}" y1="${PY(8)}" x2="${PX(x)}" y2="${PY(22)}" stroke="#f4f1e6" stroke-opacity=".12"/><text x="${PX(x)}" y="294" text-anchor="middle" fill="#f4f1e6" font-size="14">${x}</text>`;
    for (let y = 10; y <= 22; y += 4) g += `<line x1="${PX(0)}" y1="${PY(y)}" x2="${PX(5)}" y2="${PY(y)}" stroke="#f4f1e6" stroke-opacity=".12"/><text x="${PX(0) - 10}" y="${PY(y) + 5}" text-anchor="end" fill="#f4f1e6" font-size="13">${y}</text>`;
    g += `<text x="${PX(5)}" y="306" text-anchor="end" fill="#f4f1e6" font-size="12" opacity=".8">추 개수 x</text><text x="70" y="16" fill="#f4f1e6" font-size="12" opacity=".8">길이 y (cm)</text>`;
    return g;
  }
  const dots = () => XB.map((x) => `<circle cx="${PX(x)}" cy="${PY(YB()[x])}" r="6" fill="#ffd27a" stroke="#3a2410" stroke-width="2"/>`).join('');
  const svgWrap = (inner, label) => `<svg viewBox="0 0 560 310" role="img" aria-label="${label}" style="width:100%;height:auto;display:block;border:6px solid #6b4a2b;border-radius:10px">${inner}</svg>`;
  function lineSVG(a, b, color = '#8ec5ff', width = 3) {
    const x0 = 0, x1 = 5;
    return `<line x1="${PX(x0)}" y1="${PY(a * x0 + b)}" x2="${PX(x1)}" y2="${PY(a * x1 + b)}" stroke="${color}" stroke-width="${width}"/>`;
  }

  /* ---------- 미션 5: 좌표 칠판에 직선 맞추기 ---------- */
  const baseNotice = acts.workNotice;
  acts.workNotice = (o) => {
    const f = S().flags;
    if (!f.dataB || f.lineDone) return baseNotice ? baseNotice(o) : undefined;
    if (f.lineIntro) { linePopup(); return; }
    // 2026-11-12: 왜 직선(공식)이 필요한지 먼저 보여 준다 — 우체국장이 원하는 건 재 보지 않은 무게의 눈금
    S().set('lineIntro');
    ui().talk([
      { who: 'narr', text: '칠판에 점 여섯 개가 찍혀 있다. 옆에는 우체국장의 쪽지가 핀으로 꽂혀 있다.' },
      { who: 'narr', text: '"편지는 추 1개, 보통 소포는 추 3개, 큰 상자는 추 7개쯤 됩니다. 무엇을 올리든 바늘이 가리킬 곳에 눈금을 미리 새겨 주십시오."' },
      { who: 'gray', face: 'puzzled', text: '측정대에서 잰 것은 추 0개부터 5개까지뿐이다. 추 7개짜리 상자는? 2개 반짜리 소포는? 모든 무게를 매달아 볼 수는 없다.' },
      { who: 'gray', face: 'think', text: '게다가 같은 개수도 잴 때마다 조금씩 다르다. 점들은 딱 한 줄 위에 있지 않고, 대체로 한 줄로 늘어설 뿐이다.' },
      { who: 'gray', face: 'eureka', text: '점들 사이를 지나는 직선 하나를 정하면 된다. 추 개수 x를 넣으면 길이가 나오는 공식 ŷ = a·x + b. 재 보지 않은 무게도 이 공식이 예측해 준다.' },
      { who: 'me', text: '박사님이 만들고 싶었던 건 추 개수만 넣으면 길이가 나오는 공식이구나. 칠판에 직선을 그어 보자.' },
    ], { bg: 'scenes/workshop-front.png', memory: true, onEnd: linePopup });
  };
  function linePopup() {
    let a = 1, b = 8;
    ui().popup({
      puzzle: true, title: '좌표 칠판 — 점들을 지나는 직선',
      html: `<p><b>박사의 목표</b>: 추 x개를 달면 용수철이 몇 cm가 될지 예측하는 공식 <b>ŷ = a·x + b</b>. 측정 기록 B를 점으로 찍었다. 두 손잡이로 점들 사이를 지나는 직선을 눈대중으로 그어 보자.</p>
        <div class="cols mid"><div id="lnPlot"></div><div>
        <div class="vol-row">왼쪽 손잡이 (세로축과 만나는 곳) <input type="range" id="lnB" min="6" max="14" step="0.5" value="${b}"><output id="lnBv">${b}</output></div>
        <div class="vol-row">오른쪽 손잡이 (기울어진 정도) <input type="range" id="lnA" min="0" max="4" step="0.1" value="${a}"><output id="lnAv">${a}</output></div>
        <p class="feedback" id="lnEq"></p>
        <div class="card"><p style="margin:0 0 8px">저울 눈금판에 이 공식을 새기려면 두 가지를 알아야 한다. <b>눈금 간격</b>과 <b>0 눈금의 자리</b>.</p>
          <h3>① 눈금 간격 — 추가 하나 늘 때마다 용수철이 몇 cm씩 늘어나는지는 직선의 무엇이 정할까요?</h3>
          <div class="pan-btns" style="justify-content:flex-start" data-q="1"><button type="button" class="btn ghost" ${BTN} data-v="slope">기울기</button><button type="button" class="btn ghost" ${BTN} data-v="icpt">절편</button></div>
          <h3 style="margin-top:10px">② 0 눈금 — 아무것도 올리지 않았을 때(추 0개) 바늘의 자리는 직선의 무엇이고, 몇 cm인가요?</h3>
          <div class="pan-btns" style="justify-content:flex-start" data-q="2"><button type="button" class="btn ghost" ${BTN} data-v="b10">절편, 10 cm</button><button type="button" class="btn ghost" ${BTN} data-v="a2">기울기, 2 cm</button><button type="button" class="btn ghost" ${BTN} data-v="b12">절편, 12.5 cm</button></div>
          <div class="feedback" id="lnFb">손잡이로 직선을 맞춘 뒤 두 질문에 답하세요.</div></div></div></div>`,
      onMount(body, close) {
        const plot = body.querySelector('#lnPlot'), eq = body.querySelector('#lnEq'), fb = body.querySelector('#lnFb');
        const ans = {};
        const draw = () => {
          plot.innerHTML = svgWrap(plotBase() + lineSVG(a, b) + dots() + `<circle cx="${PX(0)}" cy="${PY(b)}" r="9" fill="none" stroke="#8ec5ff" stroke-width="3"/>`, `직선 y = ${a}x + ${b}과 측정 점`);
          eq.textContent = `내 직선: ŷ = ${a} × x + ${b}`;
        };
        draw();
        body.querySelector('#lnA').addEventListener('input', (e) => { a = Number(e.target.value); body.querySelector('#lnAv').textContent = a; draw(); });
        body.querySelector('#lnB').addEventListener('input', (e) => { b = Number(e.target.value); body.querySelector('#lnBv').textContent = b; draw(); });
        body.querySelectorAll('[data-q] [data-v]').forEach((btn) => btn.addEventListener('click', () => {
          const q = btn.parentElement.dataset.q, v = btn.dataset.v;
          btn.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
          ans[q] = v;
          if (q === '1' && v !== 'slope') { fb.className = 'feedback no'; fb.textContent = '절편은 직선이 세로축과 만나는 높이(출발점)예요. 추가 하나 늘 때마다 늘어나는 양, 곧 눈금 간격은 직선이 기울어진 정도예요.'; return; }
          if (q === '2' && v === 'a2') { fb.className = 'feedback no'; fb.textContent = '2는 추 하나마다 늘어나는 양이에요. 추가 0개일 때 바늘이 가리킨 길이를 표에서 보세요.'; return; }
          if (q === '2' && v === 'b12') { fb.className = 'feedback no'; fb.textContent = '12.5는 추 1개일 때 길이예요. 추를 하나도 달지 않은 0개일 때를 보세요.'; return; }
          if (ans['1'] === 'slope' && ans['2'] === 'b10') {
            fb.className = 'feedback ok';
            fb.textContent = `맞아요. 눈금 간격은 기울기 a, 0 눈금은 절편 b = 10 cm. 내 직선(기울기 ${a})으로 추 7개짜리 큰 상자를 예측하면 ŷ = ${a} × 7 + ${b} = ${r2(a * 7 + b)} cm. 재 보지 않은 무게도 공식이 알려 줘요.`;
            S().data.studentLine = { a, b };
            body.querySelectorAll('[data-q] button').forEach((x) => { x.disabled = true; });
            setTimeout(() => { close(); lineDone(); }, 3400);
          } else { fb.className = 'feedback'; fb.textContent = '좋아요. 나머지 질문에도 답해 보세요.'; }
        }));
      },
    });
  }
  function lineDone() {
    const st = S();
    st.set('lineDone'); st.addNote('line');
    ui().talk([
      { who: 'gray', face: 'eureka', text: '추 개수 x를 넣으면 길이가 나오는 공식, ŷ = a·x + b. 이것만 있으면 어떤 소포가 와도 눈금을 새길 수 있다.' },
      { who: 'gray', face: 'think', text: '절편 b는 재면 바로 안다. 10센티미터. 남은 것은 눈금 간격, 기울기 a 하나다.' },
      { who: 'gray', face: 'puzzled', text: '그런데 사흘 밤 동안 기울기가 다른 직선을 세 개나 그었다. 셋 다 그럴듯해서 어느 것을 새길지 고를 수가 없었다.' },
      { who: 'gray', face: 'smile', text: '세 직선은 두루마리에 옮겨 그려 통에 잠가 두었다. 서랍은 120으로, 트렁크는 5.2로 잠갔듯이 열쇠도 오늘 찾은 숫자 자리에 숨겼다.' },
      { who: 'gray', face: 'smile', text: '오늘 찾은 숫자는 0 눈금, 추를 하나도 달지 않은 용수철의 길이다. 작업실 뒷벽 선반의 책 열네 권을 그만큼 왼쪽부터 세어 보라.' },
      { who: 'me', text: '박사님이 고르지 못한 직선 세 개가 두루마리 통에 있구나. 추 0개일 때 10 cm였지… 뒷벽 선반의 책을 왼쪽부터 열 번째까지 세어 당겨 봐야겠어.' },
    ], { bg: 'scenes/workshop-front.png', memory: true });
  }

  /* ---------- 미션 5: 뒷벽 선반의 책 열네 권 — 왼쪽부터 10번째 ---------- */
  const baseBooks = acts.books;
  acts.books = (o) => {
    const f = S().flags;
    if (o && o.id === 'books' && f.lineDone && !f.bookDone) return bookPopup();
    return baseBooks(o);
  };
  function bookPopup() {
    const cols = ['#7a2e2e', '#2e5a4a', '#8a6a2a', '#3b4f7a', '#6b3f6b', '#2e5a4a', '#7a4a2e', '#4a6b3b', '#8a3b2e', '#3b5a7a', '#6b5a2e', '#2e4a5a', '#7a2e4a', '#4a4a6b'];
    ui().popup({
      puzzle: true, title: '열네 권의 책 — 하나만 당겨진다',
      html: `<p>박사의 메모: "열쇠는 오늘 찾은 숫자 자리에. 책은 언제나 왼쪽부터 센다." 오늘 찾은 숫자는 0 눈금, 곧 추를 하나도 달지 않은 용수철의 길이다.</p>
        <div id="books" style="display:flex;gap:4px;align-items:flex-end;justify-content:center;padding:14px;background:#5a3b22;border-radius:10px">
          ${cols.map((c, i) => `<button type="button" data-b="${i}" aria-label="왼쪽에서 ${i + 1}번째 책" style="width:30px;height:${120 + (i * 37) % 40}px;background:${c};border:2px solid #2a1a10;border-radius:4px 4px 2px 2px;cursor:pointer"></button>`).join('')}
        </div>
        <div class="feedback" id="bkFb"></div>`,
      onMount(body, close) {
        const fb = body.querySelector('#bkFb');
        body.querySelectorAll('[data-b]').forEach((btn) => btn.addEventListener('click', () => {
          const i = Number(btn.dataset.b);
          if (i === 9) {
            btn.style.transform = 'translateY(-18px) rotate(-8deg)';
            fb.className = 'feedback ok'; fb.textContent = '10번째 책이 덜컥 기울더니, 책장 뒤에서 작은 열쇠가 굴러 나왔다!';
            setTimeout(() => { close(); S().set('bookDone'); S().give('scrollKey'); ui().talk([{ who: 'me', text: '두루마리 통 열쇠다! 박사님의 직선 세 개와 내 직선, 어느 것을 눈금판에 새겨야 할지 왼쪽 벽 두루마리 통에서 겨뤄 봐야겠어.' }]); }, 1500);
          } else {
            btn.animate && btn.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 260 });
            fb.className = 'feedback no'; fb.textContent = `${i + 1}번째 책은 꿈쩍도 않는다. 추 0개일 때 바늘이 가리킨 길이(직선이 세로축과 만나는 자리)를 떠올려 보자.`;
          }
        }));
      },
    });
  }

  /* ---------- 미션 6: 두루마리 통 — 직선 비교와 기호 순서 ---------- */
  const baseScroll = acts.scroll;
  acts.scroll = (o) => {
    const st = S();
    if (st.flag('scrollDone')) { ui().talk(narr('두루마리 통이 열려 있다. 세 장의 두루마리가 좋은 순서로 놓여 있다.')); return; }
    if (!st.has('scrollKey')) return baseScroll ? baseScroll(o) : undefined;
    if (st.flag('scrollIntro')) { msePopup(); return; }
    // 2026-11-12: 두루마리가 무엇이고 무엇으로 고르는지 — 1부의 넓이 평균을 직선에 다시 쓰는 장면
    st.set('scrollIntro');
    ui().talk([
      { who: 'narr', text: '열쇠가 맞았다. 뚜껑을 열자 두루마리 세 장이 나온다. 통 안쪽 자물쇠에는 ☾ ☉ ★ 버튼과 글씨: "가장 믿을 만한 직선부터."' },
      { who: 'gray', face: 'puzzled', text: '달밤에 그은 직선 ☾, 한낮에 그은 ☉, 별밤에 그은 ★. 칠판에 대 보면 셋 다 그럴듯하다. 눈대중으로는 끝내 고르지 못했다.' },
      { who: 'gray', face: 'think', text: '그러다 측정 기록 A 때를 떠올렸다. 예측이 얼마나 틀렸는지, 오차를 한 변으로 하는 정사각형 넓이의 평균으로 쟀었지.' },
      { who: 'gray', face: 'eureka', text: '직선도 똑같이 재면 된다. 점마다 직선까지의 오차로 정사각형을 그리고 넓이 평균을 내면, 직선마다 점수가 하나씩 생긴다.' },
      { who: 'me', text: '1부에서 기준값을 고를 때 쓴 넓이 평균을 이번엔 직선에 쓰는 거구나. 내 직선도 같이 겨뤄 보자.' },
    ], { bg: 'scenes/workshop-front.png', memory: true, onEnd: msePopup });
  };
  function msePopup() {
    const mine = (S().data.studentLine || { a: 1.8 }).a;
    const lines = [
      { k: 'moon', sym: '☾', a: 1, color: '#c9b8ff' },
      { k: 'sun', sym: '☉', a: 1.5, color: '#ffb35c' },
      { k: 'star', sym: '★', a: 2.8, color: '#7fd6c2' },
      { k: 'mine', sym: '🖉', a: mine, color: '#8ec5ff' },
    ];
    const done = new Map();
    let cur = null, seq = [];
    ui().popup({
      puzzle: true, title: '두루마리 통 — 어느 직선이 더 좋은가',
      html: `<p>박사의 두루마리 ☾·☉·★와 <b>내 직선(🖉)</b>을 칠판에 하나씩 겹쳐 보자. 점마다 직선까지의 오차(빨간 선)를 한 변으로 정사각형을 그리고, <b>넓이의 평균</b>을 그 직선의 점수로 삼는다. 1부에서 기준값을 평가한 방법 그대로다. (절편은 모두 10, 다른 것은 기울기뿐)</p>
        <div class="pan-btns" id="msBtns">${lines.map((l) => `<button type="button" class="btn ghost" data-l="${l.k}">${l.sym} a = ${l.a}</button>`).join('')}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">
          <div id="msPlot"></div>
          <svg id="msBowl" viewBox="0 0 400 270" role="img" aria-label="기울기와 넓이 평균 그래프" style="width:100%;height:auto;background:#f6ecd6;border:3px solid #6b4a2b;border-radius:10px"></svg>
        </div>
        <div class="feedback" id="msFb">두루마리를 하나 골라 칠판에 겹쳐 보자.</div>
        <div id="msAsk"></div>`,
      onMount(body, close) {
        const plot = body.querySelector('#msPlot'), bowl = body.querySelector('#msBowl'), fb = body.querySelector('#msFb'), ask = body.querySelector('#msAsk');
        const bx = (a) => 40 + a * 85, by = (v) => 230 - Math.min(v, 14) * 15;
        const drawPlot = () => {
          let g = plotBase();
          if (cur) {
            for (let x = 1; x <= 5; x++) {   // 오차 정사각형(직선 쪽으로 붙임)
              const yh = cur.a * x + 10, y = YB()[x], s = Math.abs(y - yh) * 18;
              g += `<rect x="${PX(x)}" y="${Math.min(PY(y), PY(yh))}" width="${s}" height="${s}" fill="${cur.color}" fill-opacity=".18" stroke="${cur.color}" stroke-width="1.5"/>`;
              g += `<line x1="${PX(x)}" y1="${PY(y)}" x2="${PX(x)}" y2="${PY(yh)}" stroke="#ff8a7a" stroke-width="3"/>`;
            }
            g += lineSVG(cur.a, 10, cur.color, 4);
          }
          plot.innerHTML = svgWrap(g + dots(), '측정 점과 고른 직선의 오차 정사각형');
        };
        const drawBowl = () => {
          let g = `<line x1="40" y1="230" x2="380" y2="230" stroke="#4a2f20" stroke-width="2"/><line x1="40" y1="20" x2="40" y2="230" stroke="#4a2f20" stroke-width="2"/>
            <text x="392" y="265" text-anchor="end" font-size="13" fill="#4a2f20">기울기 a →</text><text x="48" y="16" font-size="14" fill="#4a2f20">넓이의 평균(평균제곱오차)</text>`;
          [0, 1, 2, 3, 4].forEach((a) => { g += `<text x="${bx(a)}" y="246" text-anchor="middle" font-size="13" fill="#4a2f20">${a}</text>`; });
          if (done.size >= 3) {
            let d = '';
            for (let a = .88; a <= 3.12; a += .02) d += `${d ? 'L' : 'M'}${bx(a).toFixed(1)} ${by(L(a)).toFixed(1)} `;   // 그래프 안(손실 14 이하)만
            g += `<path d="${d}" fill="none" stroke="#b07f22" stroke-width="2.5" stroke-dasharray="6 5"/>`;
          }
          done.forEach((v, k) => {
            const l = lines.find((x) => x.k === k);
            g += `<circle cx="${bx(l.a)}" cy="${by(v)}" r="7" fill="${l.color}" stroke="#3a2410" stroke-width="2"/><text x="${bx(l.a)}" y="${by(v) - 12}" text-anchor="middle" font-size="13" font-weight="700" fill="#1d2a2c">${l.sym} ${r2(v)}</text>`;
          });
          bowl.innerHTML = g;
        };
        drawPlot(); drawBowl();
        body.querySelectorAll('#msBtns [data-l]').forEach((btn) => btn.addEventListener('click', () => {
          cur = lines.find((l) => l.k === btn.dataset.l);
          const v = L(cur.a);
          done.set(cur.k, v);
          drawPlot(); drawBowl();
          fb.className = 'feedback';
          fb.textContent = `${cur.sym} 기울기 ${cur.a}: 오차 정사각형 넓이의 평균 = ${r2(v)}`;
          if (['moon', 'sun', 'star'].every((k) => done.has(k))) showAsk();
        }));
        function showAsk() {
          if (ask.childElementCount) return;
          ask.innerHTML = `<div class="card" style="margin-top:10px"><h3>점수(넓이 평균)가 작을수록 좋은 직선이다. 1부 유리 돔처럼 점수 그래프가 또 그릇 모양이다. 가장 좋은 직선은 그래프의 어디에 있을까?</h3>
            <div class="pan-btns" style="justify-content:flex-start" id="whereQ"><button type="button" class="btn ghost" ${BTN} data-w="bottom">그릇의 바닥</button><button type="button" class="btn ghost" ${BTN} data-w="top">가장 높은 곳</button><button type="button" class="btn ghost" ${BTN} data-w="left">맨 왼쪽</button></div>
            <div id="lockBox" hidden><h3 style="margin-top:12px">두루마리 통 자물쇠: <b>좋은 직선부터</b> 기호를 차례로 누르자.</h3>
              <div class="pan-btns" style="justify-content:flex-start">${lines.slice(0, 3).map((l) => `<button type="button" class="btn ghost" ${BTN} data-s="${l.sym}" style="color:#1d2a2c;border-color:#4a2f20;font-size:22px">${l.sym}</button>`).join('')}<button type="button" class="btn ghost" ${BTN} id="symReset">다시</button></div>
              <p id="symSeq" style="font-size:22px;margin:6px 0">_ → _ → _</p></div>
            <div class="feedback" id="msQ"></div></div>`;
          const q = ask.querySelector('#msQ'), lock = ask.querySelector('#lockBox'), seqEl = ask.querySelector('#symSeq');
          ask.querySelectorAll('[data-w]').forEach((btn) => btn.addEventListener('click', () => {
            if (btn.dataset.w === 'bottom') { q.className = 'feedback ok'; q.textContent = '맞아요. 넓이 평균이 가장 작은 곳, 그릇의 바닥이 가장 좋은 직선이에요.'; lock.hidden = false; }
            else { q.className = 'feedback no'; q.textContent = '점수가 클수록 오차 정사각형이 크다는 뜻이에요. 작은 쪽을 찾아보세요.'; }
          }));
          const show = () => { seqEl.textContent = [0, 1, 2].map((i) => seq[i] || '_').join(' → '); };
          ask.querySelector('#symReset').addEventListener('click', () => { seq = []; show(); });
          ask.querySelectorAll('[data-s]').forEach((btn) => btn.addEventListener('click', () => {
            if (seq.length >= 3) seq = [];
            seq.push(btn.dataset.s); show();
            if (seq.length < 3) return;
            const s = seq.join('');
            if (s === '☉★☾') {
              q.className = 'feedback ok'; q.textContent = '딸깍! 두루마리 통이 열렸다. 바닥에 손잡이 하나가 들어 있다.';
              setTimeout(() => { close(); mseDone(); }, 1700);
            } else {
              q.className = 'feedback no';
              q.textContent = seq[0] === '☾' ? '☾는 직선이 점들보다 아래로 지나가서 정사각형이 커요(11.3). 넓이 평균이 작을수록 좋은 직선이에요.'
                : seq[0] === '★' ? '★는 앞쪽 점에서는 괜찮지만 뒤로 갈수록 크게 벗어나요(7.34). ☉(3.05)와 숫자를 비교해 보세요.'
                  : '첫 번째는 맞았어요. 남은 두 개의 점수를 비교해 보세요.';
              seq = [];
            }
          }));
        }
      },
    });
  }
  function mseDone() {
    const st = S();
    // 2026-11-12: 철문은 대화가 끝날 때가 아니라 바로 연다. 대화가 다른 대화로 바뀌거나 중간에 새로 고침하면
    // onEnd가 불리지 않아 scrollDone만 남고 철문이 영영 잠기던 버그.
    st.set('scrollDone'); st.set('stairsOpen'); st.take('scrollKey'); st.give('knob'); st.addNote('mse');
    GD.world.rebuild();
    const mine = (st.data.studentLine || { a: 1.8 }).a, score = L(mine);
    ui().talk([
      { who: 'me', text: score < L(1.5) ? `내 직선(기울기 ${mine})의 점수는 ${r2(score)}. 박사님의 가장 좋은 직선 ☉(3.05)보다도 낮아!` : `내 직선(기울기 ${mine})의 점수는 ${r2(score)}. 점수로 재니까 어느 직선이 나은지 바로 보이네.` },
      { who: 'gray', face: 'eureka', text: '직선마다 하나의 점수가 생겼다. 점수가 작을수록 좋은 직선이다.' },
      { who: 'gray', face: 'think', text: '기울기 a를 넣으면 이 점수가 나오는 규칙, 이것을 손실함수 L(a)라 부르자.' },
      { who: 'gray', face: 'puzzled', text: '그런데 그릇의 바닥이 정확히 어디인지는 아직 모른다. 직선을 무한히 그려 볼 수는 없지 않은가.' },
      { who: 'gray', face: 'smile', text: '통 바닥의 손잡이는 기계실 예측 기계의 기울기 손잡이다. 기계는 손잡이를 돌릴 때마다 그 자리의 점수를 재 준다.' },
      { who: 'narr', text: '덜컹, 왼쪽 뒷벽의 나선 계단 철문이 열렸다.' },
      { who: 'me', text: '바닥을 찾을 방법은 예측 기계에 있겠구나. 나선 계단 위 기계실로 올라가서 손잡이를 끼워 봐야겠어.' },
    ], { bg: 'scenes/workshop-front.png', memory: true });
  }
  acts.stairsGate = () => (repairStairs() || S().flag('stairsOpen') ? GD.world.go('clockroom', [7, 19], 'up') : ui().talk(narr('나선 계단으로 오르는 철문이 잠겨 있다. 자물쇠 대신 두루마리 무늬가 새겨져 있다.')));

  // 예전 버전에서 두루마리를 풀고도 철문이 잠긴 저장을 바로잡는다(onEnterMap·철문에서 확인).
  function repairStairs() {
    const st = S();
    if (!st.flag('scrollDone') || st.flag('stairsOpen')) return false;
    st.set('stairsOpen'); if (!st.has('knob') && !st.flag('knobIn')) st.give('knob');
    GD.world.rebuild(); return true;
  }

  /* ---------- 박사의 방 ---------- */
  acts.bed = () => ui().talk(narr('좁은 침대에 체크무늬 이불이 반듯하게 개어 있다. 박사는 며칠째 여기서 잠들지 않은 것 같다.'));
  acts.watchCase = () => ui().talk(narr('유리 진열 상자에 회중시계를 놓는 받침이 있다. 다섯 개의 작은 홈이 비어 있다. 부품이 어딘가에 흩어져 있는 걸까.'));
  acts.bedWardrobe = () => {
    const st = S(), open = st.flag('bedWardrobeOpen');
    ui().popup({ title: '박사의 옷장', narrow: true,
      html: `<div class="closeup" id="bwImg" style="background-image:url('${A(open ? 'closeups/wardrobe-open.png' : 'closeups/wardrobe-closed.png')}')"></div><div class="pan-btns inspect-buttons"><button type="button" class="btn" id="bwToggle">${open ? '닫기' : '열어 보기'}</button></div><p role="status" id="bwTxt">${open ? '청록 조끼 두 벌과 낡은 외투가 걸려 있다.' : '열쇠 구멍 둘레에 톱니 무늬가 새겨져 있다.'}</p>`,
      onMount(body) {
        body.querySelector('#bwToggle').onclick = () => {
          const now = !st.flag('bedWardrobeOpen'); st.set('bedWardrobeOpen', now); GD.world.rebuild();
          body.querySelector('#bwImg').style.backgroundImage = `url('${A(now ? 'closeups/wardrobe-open.png' : 'closeups/wardrobe-closed.png')}')`;
          body.querySelector('#bwToggle').textContent = now ? '닫기' : '열어 보기';
          body.querySelector('#bwTxt').textContent = now ? '청록 조끼 두 벌과 낡은 외투가 걸려 있다. 노트 속 박사가 입던 조끼다.' : '옷장 문을 닫았다.';
        };
      } });
  };
  acts.diary = () => {
    const st = S();
    if (!st.flag('diaryRead')) {
      st.set('diaryRead');
      ui().talk([
        { who: 'narr', text: '일기장 귀퉁이가 닳아 있다. 가장 최근 장을 펼친다.' },
        { who: 'gray', face: 'tired', text: '우체국장이 또 다녀갔다. 소포 요금이 틀렸다고, 이번이 마지막 기회라고.' },
        { who: 'gray', face: 'tired', text: '용수철만 열두 번째다. 용수철이 문제가 아니라 내 예측이 문제라는 걸 안다.' },
        { who: 'gray', face: 'think', text: '스승님이라면 뭐라고 하셨을까. 시계를 고칠 때처럼 하라고 하셨겠지.' },
        { who: 'gray', face: 'think', text: '얼마나 틀렸는지 재고, 조금씩 고친다. …그 \'조금\'이 얼마인지가 문제지만.' },
        { who: 'narr', text: '마지막 장은 비어 있다. 종이에서 희미하게 레몬 냄새가 난다.' },
        { who: 'me', text: '얼마나 틀렸는지 재고, 조금씩 고친다… 박사님은 그 일을 기계실에서 끝내려 했나 봐. 그 \'조금\'이 얼마인지 기억해 둬야겠어.' },
      ], { bg: 'scenes/bedroom-front.png', memory: true });
      return;
    }
    ui().popup({ title: '일기 마지막 장', narrow: true,
      html: `<div class="closeup" id="dyImg" style="background-image:url('${A('closeups/diary-blank.png')}')"></div><div class="pan-btns inspect-buttons"><button type="button" class="btn" id="dyHeat">등잔 불에 살짝 쬐어 본다</button></div><p role="status" id="dyTxt">빈 종이다. 레몬 냄새가 난다.</p>`,
      onMount(body) {
        body.querySelector('#dyHeat').onclick = () => {
          body.querySelector('#dyTxt').textContent = '갈색 글씨가 서서히 떠오른다: "시계는 진열 상자에. 부품은 내가 머문 다섯 곳에."';
          st.set('secretInk');
        };
      } });
  };

  /* ---------- 미션 7: 예측 기계 — 돌려 보고 발밑 재기 ---------- */
  acts.machine = () => {
    const st = S(), f = st.flags;
    if (!f.knobIn) {
      if (!st.has('knob')) { ui().talk(narr('예측 기계다. 왼쪽 손잡이는 10에 고정되어 있고, 오른쪽 손잡이 자리가 비어 있다.')); return; }
      st.take('knob'); st.set('knobIn'); GD.world.rebuild();
      ui().talk([
        { who: 'narr', text: '기울기 손잡이를 오른쪽 자리에 끼웠다. 철컥, 계기판 바늘이 깨어난다.' },
        { who: 'gray', face: 'think', text: '두루마리 세 장의 점수를 손으로 내는 데 사흘 밤이 걸렸다. 이 기계는 손잡이를 돌리면 그 자리의 점수를 곧바로 계기판에 보여 준다.' },
        { who: 'gray', face: 'tired', text: '그래도 한 번에 보이는 것은 지금 자리의 점수 하나뿐이다. 기울기를 0.01씩 바꿔 가며 그릇 전체를 그리려면 몇 해가 걸린다.' },
        { who: 'gray', face: 'think', text: '나는 안개 낀 산에서 발밑만 보이는 등산가와 같다. 손잡이를 조금 돌렸더니 점수가 커졌다. 어느 방향으로 돌려야 바닥에 닿을까?' },
      ], { bg: 'scenes/clockroom-front.png', memory: true, onEnd: slopePopup });
      return;
    }
    if (f.rateDone) { ui().talk(narr('예측 기계의 바늘이 a = 2.00을 가리키며 멈춰 있다. 손실 0.3, 그릇의 바닥이다.')); return; }
    if (f.dirBoxOpen && st.has('gears')) return ratePopup();
    slopePopup();
  };
  function slopePopup() {
    let a = 1, tan = false;
    const seen = new Map([[1, L(1)]]);
    const bx = (v) => 30 + v * 110, by = (v) => 240 - Math.min(v, 16) * 13;
    ui().popup({
      puzzle: true, title: '예측 기계 — 안개 속에서 방향 찾기',
      html: `<p>오른쪽 손잡이(기울기 a)를 조금씩 돌려 계기판의 <b>손실</b>을 보자. 석판에는 <b>가 본 곳만</b> 점이 찍힌다(안개). 절편은 10에 고정.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;align-items:center">
          <div class="card" style="text-align:center"><h3>계기판</h3><p style="font:900 40px var(--font);margin:6px 0" id="gauge"></p><p id="aNow" style="margin:0"></p></div>
          <svg id="fog" viewBox="0 0 440 270" role="img" aria-label="가 본 기울기와 손실" style="width:100%;height:auto;background:#d9d4c7;border:3px solid #6b4a2b;border-radius:10px"></svg>
        </div>
        <div class="pan-btns"><button type="button" class="btn ghost" data-d="-0.1">◀ 왼쪽으로 조금 (a − 0.1)</button><button type="button" class="btn ghost" data-d="0.1">오른쪽으로 조금 (a + 0.1) ▶</button><button type="button" class="btn" id="tanBtn">발밑 재기 레버</button></div>
        <div class="feedback" id="slFb">손잡이를 양쪽으로 돌려 보자.</div>`,
      onMount(body) {
        const fog = body.querySelector('#fog'), fb = body.querySelector('#slFb');
        const draw = () => {
          const v = L(a);
          body.querySelector('#gauge').textContent = r2(v);
          body.querySelector('#aNow').textContent = `기울기 a = ${r2(a)}`;
          let g = `<rect width="440" height="270" fill="#cfc9bb"/><text x="10" y="18" font-size="13" fill="#4a2f20">손실</text><text x="430" y="262" text-anchor="end" font-size="13" fill="#4a2f20">기울기 a</text>`;
          [0, 1, 2, 3].forEach((t) => { g += `<text x="${bx(t)}" y="262" text-anchor="middle" font-size="12" fill="#4a2f20">${t}</text>`; });
          seen.forEach((val, k) => { g += `<circle cx="${bx(k)}" cy="${by(val)}" r="${k === a ? 7 : 5}" fill="${k === a ? '#d4583e' : '#2f5f8f'}"/>`; });
          if (tan) {   // 발밑 기울기: 지금 점의 접선(초록, 예측선의 기울기 a와 다른 색)
            const m = dL(a), x0 = a - .45, x1 = a + .45;
            // 이름표는 접선 위가 아니라 오른쪽 위 빈 곳에 범례로 (손실이 작은 쪽이라 점이 거의 없음)
            g += `<line x1="${bx(x0)}" y1="${by(L(a) + m * (x0 - a))}" x2="${bx(x1)}" y2="${by(L(a) + m * (x1 - a))}" stroke="#2f8a5b" stroke-width="4"/>
              <line x1="266" y1="34" x2="290" y2="34" stroke="#2f8a5b" stroke-width="4"/>
              <text x="430" y="39" text-anchor="end" font-size="14" font-weight="800" fill="#2f8a5b" stroke="#cfc9bb" stroke-width="4" paint-order="stroke">발밑 기울기 ${r2(m)}</text>`;
          }
          fog.innerHTML = g;
        };
        draw();
        body.querySelectorAll('[data-d]').forEach((btn) => btn.addEventListener('click', () => {
          const prev = L(a);
          a = r2(Math.max(.5, Math.min(3.5, a + Number(btn.dataset.d))));
          seen.set(a, L(a)); tan = false; draw();
          fb.className = 'feedback';
          fb.textContent = L(a) > prev ? `손실이 ${r2(prev)} → ${r2(L(a))}로 커졌다. 이쪽은 오르막이다.` : `손실이 ${r2(prev)} → ${r2(L(a))}로 작아졌다. 이쪽이 내리막이다.`;
          check();
        }));
        body.querySelector('#tanBtn').addEventListener('click', () => {
          tan = true; draw();
          const m = dL(a);
          fb.className = 'feedback';
          fb.textContent = `발밑 기울기(접선의 기울기) = ${r2(m)}. ${m < 0 ? '음수: 오른쪽으로 갈수록 내려간다.' : m > 0 ? '양수: 오른쪽으로 갈수록 올라간다.' : '0: 평평하다. 바닥이다!'}`;
          S().set('tanUsed'); check();
        });
        function check() {
          const ks = [...seen.keys()];
          if (!S().flag('slopeSeen') && ks.some((k) => k < 1) && ks.some((k) => k > 1) && S().flag('tanUsed')) {
            S().set('slopeSeen');
            fb.className = 'feedback ok';
            fb.textContent += ' — 발밑 기울기의 부호가 방향을 알려 준다. 왼쪽 톱니 상자의 방향 레버에 써 보자.';
          }
        }
      },
    });
  }

  /* ---------- 미션 7: 톱니 상자 — 방향 레버 + 규칙 ---------- */
  acts.dirBox = () => {
    const st = S();
    if (st.flag('dirBoxOpen')) { ui().talk(narr(st.has('gears') || st.flag('rateDone') ? '톱니 상자는 비어 있다. 꺼낸 톱니는 예측 기계 아래 홈에 끼운다.' : '톱니 상자가 열려 있다.')); return; }
    if (!st.flag('slopeSeen')) { ui().talk(narr('방향 레버 세 개가 달린 톱니 상자다. 레버마다 안개 속 지점이 그려져 있다. 예측 기계로 발밑 기울기를 먼저 재 보자.')); return; }
    if (!st.flag('dirIntro')) {
      st.set('dirIntro');
      ui().talk([
        { who: 'narr', text: '톱니 상자 뚜껑에 박사의 글씨가 새겨져 있다. "안개 속에서 섰던 세 자리."' },
        { who: 'gray', face: 'think', text: '안개 낀 밤, 세 자리에 서서 발밑 기울기만 재고 어느 쪽으로 내려가야 할지 적어 두었다.' },
        { who: 'gray', face: 'smile', text: '방향을 바르게 읽는 사람만 톱니를 꺼낼 수 있다. 톱니는 손잡이를 한 번에 얼마나 돌릴지 정하는 부품이니까.' },
        { who: 'me', text: '세 자리의 발밑 기울기를 보고 방향을 고르면 되겠어. 기계에서 본 대로라면…' },
      ], { bg: 'scenes/clockroom-front.png', memory: true, onEnd: () => acts.dirBox() });
      return;
    }
    const pts = [{ a: 1, ans: 'R' }, { a: 2.5, ans: 'L' }, { a: 1.8, ans: 'R' }];
    const pick = {};
    ui().popup({
      puzzle: true, title: '톱니 상자 — 방향 레버',
      html: `<p>석판의 안개 속 세 지점. 각 지점의 <b>발밑 기울기</b>를 보고 손잡이를 돌릴 방향을 고르자.</p>
        ${pts.map((p, i) => `<div class="card" style="margin-top:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap"><b>지점 ${i + 1}: a = ${p.a}</b><span style="color:#2f8a5b;font-weight:800">발밑 기울기 ${r2(dL(p.a))}</span>
          <span class="pan-btns" style="margin:0;flex:1 1 300px" data-p="${i}"><button type="button" class="btn ghost" ${BTN} data-v="L">◀ a를 줄인다</button><button type="button" class="btn ghost" ${BTN} data-v="R">a를 키운다 ▶</button></span></div>`).join('')}
        <div class="card" style="margin-top:8px"><h3>규칙: 발밑 기울기가 음수이면 a를 <select id="r1"><option value="">고르기</option><option value="up">키우고</option><option value="down">줄이고</option></select>, 양수이면 a를 <select id="r2"><option value="">고르기</option><option value="up">키운다</option><option value="down">줄인다</option></select>. 즉 기울기의 반대 방향으로 움직인다.</h3>
          <h3 style="margin-top:8px">덤: 세 지점 중 바닥에 가장 가까운 곳은? <select id="r3"><option value="">고르기</option><option value="1">a = 1</option><option value="2.5">a = 2.5</option><option value="1.8">a = 1.8</option></select></h3></div>
        <div class="pan-btns"><button type="button" class="btn" id="dbTry">레버를 당긴다</button></div>
        <div class="feedback" id="dbFb"></div>`,
      onMount(body, close) {
        const fb = body.querySelector('#dbFb');
        body.querySelectorAll('[data-p] [data-v]').forEach((btn) => btn.addEventListener('click', () => {
          const i = btn.parentElement.dataset.p; pick[i] = btn.dataset.v;
          btn.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
        }));
        body.querySelector('#dbTry').addEventListener('click', () => {
          const wrong = pts.findIndex((p, i) => pick[i] !== p.ans);
          if (wrong >= 0) { fb.className = 'feedback no'; fb.textContent = `지점 ${wrong + 1}: 손잡이를 그쪽으로 조금 돌려 보면 손실이 커져요. 접선이 내려가는 쪽이 바닥 쪽이에요. (발밑 기울기 ${r2(dL(pts[wrong].a))})`; return; }
          if (body.querySelector('#r1').value !== 'up' || body.querySelector('#r2').value !== 'down') { fb.className = 'feedback no'; fb.textContent = '레버는 맞았어요. 규칙 빈칸을 다시 보세요: 음수일 때 어느 쪽으로 갔나요?'; return; }
          if (body.querySelector('#r3').value !== '1.8') { fb.className = 'feedback no'; fb.textContent = '바닥에서는 그릇이 평평해져요. 발밑 기울기의 크기가 가장 작은(0에 가까운) 곳이 바닥에 가장 가까워요.'; return; }
          fb.className = 'feedback ok'; fb.textContent = '철컥, 철컥, 철컥! 톱니 상자가 열렸다. 크기가 다른 톱니 여섯 개와 노트의 마지막 장이 들어 있다.';
          setTimeout(() => { close(); dirDone(); }, 1700);
        });
      },
    });
  };
  function dirDone() {
    const st = S();
    st.set('dirBoxOpen'); st.give('gears', 6); st.addNote('slope'); GD.world.rebuild();
    ui().talk([
      { who: 'gray', face: 'eureka', text: '발밑의 기울기, 곧 손실함수의 미분계수가 길을 알려 준다. 기울기의 반대쪽으로 가면 내려간다.' },
      { who: 'gray', face: 'think', text: '기울기가 클수록 바닥에서 멀고, 0에 가까울수록 바닥이다.' },
      { who: 'gray', face: 'tired', text: '방향은 찾았다. 그러나 크게 돌리면 지나치고, 작게 돌리면 새벽까지 끝낼 수 없다.' },
      { who: 'gray', face: 'tired', text: '우체국장은 첫 우편이 나가는 새벽에 저울을 가져가겠다고 했다. 모래시계로 열 번, 손잡이를 돌릴 시간밖에 없다.' },
      { who: 'gray', face: 'smile', text: '톱니마다 한 번에 돌리는 비율이 다르다. 열 번 안에 바닥에 닿게 하는 톱니를 찾은 사람에게 이 시계탑을 맡긴다.' },
      { who: 'me', text: '박사님 일기의 "그 \'조금\'이 얼마인지가 문제"라는 말이 이거였구나. 톱니를 하나씩 끼우고 모래시계를 뒤집어 봐야겠어.' },
    ], { bg: 'scenes/clockroom-front.png', memory: true });
  }

  /* ---------- 미션 8: 톱니(학습률) + 모래시계 10번 ---------- */
  const RATES = [0.005, 0.02, 0.04, 0.05, 0.08, 0.1];
  function run(rate) {   // a = 1에서 10번 갱신
    const rows = []; let a = 1, hit = 0;
    for (let i = 1; i <= 10; i++) {
      const m = dL(a); a = a - rate * m;
      rows.push({ i, a, m, loss: L(a) });
      if (!hit && Math.abs(a - 2) < .05) hit = i;
    }
    return { rows, hit };
  }
  function ratePopup() {
    const st = S();
    const wins = new Set(st.data.goodRates || []);
    let timer = 0;
    const bx = (a) => 30 + (Math.max(-.6, Math.min(4.6, a)) + .6) * 72, by = (v) => 236 - Math.min(v, 15) * 14;
    ui().popup({
      puzzle: true, title: '예측 기계 — 마지막 조정',
      html: `<p>새 a = a − <b>톱니 비율</b> × <span style="color:#2f8a5b;font-weight:800">발밑 기울기</span>. 톱니를 하나 끼우고 모래시계를 뒤집으면 a = 1부터 <b>열 번</b> 손잡이가 돌아간다. 10번 안에 바늘이 2 ± 0.05에 들어오면 성공.</p>
        <div class="pan-btns" id="gearBtns">${RATES.map((r) => `<button type="button" class="btn ghost" data-r="${r}">톱니 ${r}${wins.has(r) ? ' ✓' : ''}</button>`).join('')}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">
          <svg id="rtBowl" viewBox="0 0 440 260" role="img" aria-label="손실 그릇 위에서 움직이는 공" style="width:100%;height:auto;background:#f6ecd6;border:3px solid #6b4a2b;border-radius:10px"></svg>
          <div style="max-height:260px;overflow:auto"><table class="rec" id="rtTable" style="width:100%"><thead><tr><th>회</th><th>a</th><th>발밑 기울기</th><th>손실</th></tr></thead><tbody></tbody></table></div>
        </div>
        <div class="feedback" id="rtFb">톱니를 골라 보자.</div>
        <div id="rtAsk"></div>`,
      onMount(body, close) {
        const bowl = body.querySelector('#rtBowl'), tb = body.querySelector('#rtTable tbody'), fb = body.querySelector('#rtFb'), ask = body.querySelector('#rtAsk');
        const drawBowl = (path) => {
          let d = '';
          for (let a = .85; a <= 3.15; a += .02) d += `${d ? 'L' : 'M'}${bx(a).toFixed(1)} ${by(L(a)).toFixed(1)} `;   // 그래프 안(손실 15 이하)만
          let g = `<path d="${d}" fill="none" stroke="#b07f22" stroke-width="3"/><line x1="${bx(2)}" y1="20" x2="${bx(2)}" y2="240" stroke="#2f8a5b" stroke-dasharray="4 4"/><text x="${bx(2)}" y="16" text-anchor="middle" font-size="12" fill="#2f8a5b">바닥 a = 2</text>`;
          [0, 1, 2, 3, 4].forEach((t) => { g += `<text x="${bx(t)}" y="254" text-anchor="middle" font-size="12" fill="#4a2f20">${t}</text>`; });
          if (path && path.length) {
            g += `<polyline points="${path.map((p) => `${bx(p).toFixed(1)},${by(L(p)).toFixed(1)}`).join(' ')}" fill="none" stroke="#d4583e" stroke-width="1.5" stroke-dasharray="3 3"/>`;
            const last = path[path.length - 1];
            g += `<circle cx="${bx(last)}" cy="${by(L(last))}" r="9" fill="#d4583e" stroke="#fff" stroke-width="2"/>`;
          } else g += `<circle cx="${bx(1)}" cy="${by(L(1))}" r="9" fill="#d4583e" stroke="#fff" stroke-width="2"/>`;
          bowl.innerHTML = g;
        };
        drawBowl();
        body.querySelectorAll('#gearBtns [data-r]').forEach((btn) => btn.addEventListener('click', () => {
          clearInterval(timer);
          const rate = Number(btn.dataset.r), { rows, hit } = run(rate);
          tb.innerHTML = ''; fb.className = 'feedback'; fb.textContent = `톱니 ${rate}을 끼우고 모래시계를 뒤집었다…`;
          const path = [1];
          let k = 0;
          const step = () => {
            const r = rows[k];
            path.push(r.a);
            tb.insertAdjacentHTML('beforeend', `<tr${hit === r.i ? ' style="background:#d8f0dd"' : ''}><td>${r.i}</td><td>${r2(r.a)}</td><td>${r2(r.m)}</td><td>${r2(r.loss)}</td></tr>`);
            drawBowl(path);
            if (GD.sound && GD.sound.step) GD.sound.step();
            k++;
            if (k >= rows.length) { clearInterval(timer); finish(rate, hit, rows); }
          };
          if (reduce()) { while (k < rows.length) step(); } else timer = setInterval(step, 260);
        }));
        function finish(rate, hit, rows) {
          const last = rows[rows.length - 1].a;
          if (hit) {
            wins.add(rate); st.data.goodRates = [...wins].sort((x, y) => x - y); st.save();
            body.querySelector(`[data-r="${rate}"]`).textContent = `톱니 ${rate} ✓`;
            fb.className = 'feedback ok';
            fb.textContent = `성공! ${hit}번째에 바늘이 2 ± 0.05 안에 들어왔다.` + (rate === 0.05 ? ' 한 번 바닥을 살짝 넘었다가 돌아왔다.' : '');
            showAsk();
          } else {
            fb.className = 'feedback no';
            fb.textContent = rate < .02 ? `방향은 맞았어요. 그런데 한 걸음이 너무 작아 열 번 뒤에도 a = ${r2(last)}. 새벽까지 끝낼 수 없어요. 조금 더 큰 톱니를 써 보세요.`
              : Math.abs(last - 2) > 2 ? `기계가 덜컹거린다! 바닥을 넘을 때마다 더 멀리 튕겨 나가요(a = ${r2(last)}, 발산). 기울기가 크면 한 걸음도 커지는데, 톱니까지 크면 반대편으로 넘어가요. 훨씬 작은 톱니를 써 보세요.`
                : `바닥을 지나쳐 양쪽을 오가며 흔들려요(a = ${r2(last)}). 조금 작은 톱니를 써 보세요.`;
          }
        }
        function showAsk() {
          if (ask.childElementCount) return;
          ask.innerHTML = `<div class="card" style="margin-top:10px"><h3>마지막 빈칸: 한 번에 움직이는 비율을 <select id="t1"><option value="">고르기</option><option value="rate">학습률</option><option value="slope">기울기</option><option value="loss">손실</option></select>이라 하고, 바닥에 점점 다가가는 것을 <select id="t2"><option value="">고르기</option><option value="conv">수렴</option><option value="div">발산</option><option value="osc">진동</option></select>이라 한다.</h3>
            <div class="pan-btns" style="justify-content:flex-start"><button type="button" class="btn" id="tTry">눈금판 새기기</button></div><div class="feedback" id="tFb">성공한 톱니가 여러 개라면 어느 것이 가장 빨랐는지도 비교해 보세요.</div></div>`;
          ask.querySelector('#tTry').addEventListener('click', () => {
            const tf = ask.querySelector('#tFb');
            if (ask.querySelector('#t1').value === 'rate' && ask.querySelector('#t2').value === 'conv') {
              tf.className = 'feedback ok'; tf.textContent = '기계가 a = 2.00을 가리키며 눈금판을 찍어 낸다. 추 1개당 2 cm, 0개일 때 10 cm!';
              setTimeout(() => { clearInterval(timer); close(); rateDone(); }, 1800);
            } else { tf.className = 'feedback no'; tf.textContent = '톱니가 정하는 것은 한 걸음의 크기예요. 그리고 바닥에서 멀어지는 것은 발산, 다가가는 것은…?'; }
          });
        }
      },
      onClose() { clearInterval(timer); },
    });
  }
  function rateDone() {
    const st = S();
    st.set('rateDone'); st.take('gears', 6); st.give('plate'); st.addNote('rate');
    ui().talk([
      { who: 'gray', face: 'smile', text: '새 a = a − 학습률 × 발밑 기울기. 너무 크지도 작지도 않게, 바닥에 닿을 때까지 되풀이한다.' },
      { who: 'gray', face: 'eureka', text: 'ŷ = 2x + 10. 추 1개당 2센티미터, 0개일 때 10센티미터. 편지든 큰 상자든, 이제 바늘이 가리킬 자리를 미리 새길 수 있다.' },
      { who: 'narr', text: '눈금판을 얻었다!' },
      { who: 'me', text: '기계실 위쪽 발코니 문에 눈금판 모양 홈이 있었지. 거기에 끼워 봐야겠어.' },
    ], { bg: 'scenes/clockroom-front.png', memory: true });
  }
  acts.hourglass = () => ui().talk(narr('모래시계 아래에 쪽지가 끼워져 있다: "모래가 다 떨어지기 전에 열 번."'));
  acts.bigGear = () => ui().talk(narr(S().flag('plateIn') ? '큰 톱니가 다시 천천히 돌고 있다. 째깍, 째깍.' : '시계탑의 큰 톱니가 멈춰 있다. 눈금판이 완성되면 다시 돈다고 했다.'));

  /* ---------- 엔딩 ---------- */
  acts.balconyDoor = () => {
    const st = S();
    if (st.flag('plateIn')) { GD.world.go('balcony', [11, 13], 'up'); return; }   // 열린 문: F로 바로 이동
    if (!st.has('plate')) { ui().talk(narr('발코니로 나가는 문이다. 한가운데에 눈금판 모양의 홈이 파여 있다.')); return; }
    st.take('plate'); st.set('plateIn'); GD.world.rebuild();
    ui().talk([
      { who: 'narr', text: '눈금판을 홈에 끼웠다. 딸깍.' },
      { who: 'narr', text: '쿠웅— 기계실이 흔들리더니, 큰 톱니가 천천히 돌기 시작한다.' },
      { who: 'narr', text: '댕, 댕, 댕, 댕, 댕, 댕. 시계탑의 종이 여섯 번 울린다. 창밖이 새벽빛으로 밝아진다.' },
      { who: 'narr', text: '발코니 문이 열렸다!' },
      { who: 'me', text: '새벽빛이 들어온다. 발코니로 나가 봐야겠어.' },
    ], { bg: 'scenes/clockroom-front.png', onEnd: () => {
      if (GD.sound && GD.sound.goal) for (let i = 0; i < 6; i++) setTimeout(() => GD.sound.goal(), i * 700);
    } });
  };
  acts.letter = () => {
    const st = S();
    st.set('letterRead');
    ui().talk([
      { who: 'narr', text: '벤치 위에 봉투 하나. 박사의 글씨다.' },
      { who: 'gray', face: 'smile', text: '이 편지를 읽는다면, 당신은 내가 열 밤 동안 걸은 길을 하룻밤에 걸었다.' },
      { who: 'gray', face: 'think', text: '나는 정답을 처음부터 알지 못했다. 다만 이렇게 했다.' },
      { who: 'gray', face: 'think', text: '하나, 얼마나 틀렸는지를 숫자 하나로 잰다(손실함수). 둘, 발밑의 기울기를 보고 내려가는 쪽을 고른다(미분).' },
      { who: 'gray', face: 'think', text: '셋, 너무 크지도 작지도 않게 한 걸음 옮긴다(학습률). 넷, 바닥에 닿을 때까지 되풀이한다(반복과 수렴).' },
      { who: 'gray', face: 'smile', text: '언젠가 손잡이를 사람이 아니라 기계가 스스로 돌리는 날이 온다면, 그 기계는 이것을 \'배운다\'고 부를지도 모르겠다.' },
      { who: 'narr', text: '편지 끝에 작게 적혀 있다. — E. 그레이, 새벽에' },
      { who: 'me', text: '코그도 와 있네. 이야기를 나누고, 오른쪽 기록판도 살펴봐야겠어.' },
    ], { bg: 'scenes/balcony-dawn-front.png', memory: true });
  };
  acts.cogEnd = () => {
    const st = S();
    st.set('cogEndTalked');
    ui().talk([
      { who: 'cog', face: 'happy', text: '아침 종이 울렸어요! 정문도 열렸을 거예요.' },
      { who: 'cog', face: 'happy', text: '눈금판은 첫 우편이 나가기 전에 우체국장님께 전해 드릴게요. 이제 같은 편지에 요금이 다르게 나오는 일은 없을 거예요.' },
      { who: 'cog', face: 'normal', text: '오늘날 인공지능도 이 방법으로 배운대요. 이름은 경사하강법.' },
      { who: 'cog', face: 'surprised', text: '다른 점은 손잡이가 하나가 아니라 수백만 개라는 것뿐이래요.' },
      { who: 'cog', face: 'happy', text: '오른쪽 기록판에 오늘 밤의 기록을 남겨 두었어요. 다 보고 나면 현관 정문으로 나가요!' },
    ]);
  };
  // 엔딩 뒤 현관 정문: 실제로 문을 열고 나가는 마무리(2026-11-12 — 정문이 열렸다는데 정문은 잠겨 있던 모순)
  acts.frontDoor = () => {
    const st = S();
    ui().talk([
      { who: 'narr', text: '정문의 빗장이 풀려 있다. 문을 밀자 비가 갠 아침 공기가 밀려든다.' },
      { who: 'narr', text: '언덕 아래 우체국 지붕 위로 첫 우편 마차가 출발한다. 코그가 눈금판 꾸러미를 안고 손을 흔든다.' },
      { who: 'me', text: '얼마나 틀렸는지 재고, 발밑의 기울기를 보고, 알맞은 만큼 고친다. 박사님의 노트는 끝났지만 그 방법은 이제 내 것이야.' },
      { who: 'narr', text: '— 그레이 박사의 마지막 밤 · 끝 —' },
    ], { bg: 'backgrounds/lab-dawn.png', memory: true, onEnd: () => { if (!st.flag('finished')) acts.recordBoard(); else ui().toast('탈출 성공! 수집하지 못한 곳을 더 둘러봐도 좋아요'); } });
    st.set('leftHouse');
  };
  acts.recordBoard = () => {
    const st = S();
    const rows = [
      ['1. 하나의 수를 찾아라', '여러 측정값 중 무엇을 예측값으로 삼아야 할까?', '평균'],
      ['2. 오차가 사라졌다?', '차이를 모두 더하니 0이다. 그런데 계속 빗나간다.', '편차, 부호의 상쇄'],
      ['3. 지워지지 않는 오차', '음수와 양수가 지워지지 않게 기록할 방법이 필요하다.', '편차의 제곱, 분산'],
      ['4. 가장 좋은 기준값', '어느 값이 제곱한 차이의 평균을 가장 작게 할까?', '제곱오차의 최소화'],
      ['5. 움직이는 예측선', '추의 무게가 바뀌면 하나의 숫자로는 부족하다.', '일차함수, 기울기와 절편'],
      ['6. 예측을 평가하는 숫자', '어느 직선이 더 좋은지 판단할 기준이 없다.', '평균제곱오차, 손실함수'],
      ['7. 내려가는 방향', '어느 방향으로 손잡이를 돌려야 할까?', '미분, 손실함수의 기울기'],
      ['8. 마지막 조정', '크게 돌리면 지나치고, 작게 돌리면 늦는다.', '학습률, 반복 갱신, 수렴'],
    ];
    st.set('finished');
    ui().popup({
      title: '기록판 — 그레이 박사의 마지막 밤',
      html: `<div class="closeup fit" style="background-image:url('${A('backgrounds/lab-dawn.png')}');height:min(180px, 16vh)"></div>
        <h3 style="margin:10px 0 6px">탈출 성공! 아침 종이 울리고 정문이 열렸다.</h3>
        <div style="overflow-x:auto"><table class="rec" style="width:100%"><thead><tr><th>미션</th><th>노트에 남은 고민</th><th>발견한 개념</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td><b>${r[2]}</b></td></tr>`).join('')}</tbody></table></div>
        <p>모은 노트 ${st.data.notes.length}장 · 미션 8에서 성공한 톱니: ${(st.data.goodRates || []).join(', ') || '-'}</p>
        <div class="card" style="margin-top:8px"><h3>정리 질문</h3><p>· 미션 4의 그릇과 미션 6의 그릇은 무엇이 같고 무엇이 다를까?<br>· 그래프를 다 그리면 바닥을 바로 찾을 수 있는데, 왜 미션 7~8처럼 조금씩 내려갈까?<br>· 학습률이 너무 크면 왜 점점 멀어질까?</p></div>`,
    });
  };

  /* ---------- 미션 화면 음악: puzzle: true 팝업이 열려 있는 동안 퍼즐 곡 ---------- */
  const roomTrack = () => (S().data.map === 'balcony' ? 'ending' : 'explore');
  const basePopup = GD.ui.popup;
  let puzzleOpen = false;   // 퍼즐 화면이 지금 열려 있는가(다른 팝업으로 바로 바뀌어도 정확히 되돌리려고)
  GD.ui.popup = (opts = {}) => {
    if (!opts.puzzle || !GD.sound || !GD.sound.music) return basePopup(opts);
    puzzleOpen = true;
    GD.sound.music('puzzle');
    const onClose = opts.onClose;
    return basePopup({ ...opts, onClose(...args) {
      puzzleOpen = false;
      if (onClose) onClose(...args);
      setTimeout(() => { if (!puzzleOpen) GD.sound.music(roomTrack()); }, 50);   // 바로 다음 퍼즐이 열리면 그대로
    } });
  };

  /* ---------- 새 방에 처음 들어설 때 ---------- */
  const prevEnter = GD.onEnterMap;
  GD.onEnterMap = (id) => {
    repairStairs();
    if (GD.sound && GD.sound.music) GD.sound.music(id === 'balcony' ? 'ending' : 'explore');   // 발코니는 엔딩 곡
    // 1부를 마치고 '나중에 이어서 하기'를 골랐다면, 다음에 방에 들어설 때 2부 여는 장면을 한 번 보여 준다
    if (S().flag('dataB') && !S().flag('part2Started') && GD.part2Opening) setTimeout(() => { if (!GD.ui.busy && !S().flag('part2Started')) GD.part2Opening(); }, 600);
    const st = S(), T = {
      bedroom: narr('박사의 방이다. 등잔 불빛에 좁은 침대와 책상이 드러난다. 책상 위에 일기장이 펼쳐져 있다.'),
      clockroom: narr('나선 계단 끝, 시계탑의 기계실이다. 커다란 톱니들이 멈춰 있다.', '한가운데 책상 위에 손잡이 두 개와 둥근 계기판이 달린 기계가 있다.'),
      balcony: narr('새벽 발코니다. 비가 그치고, 항구 도시의 지붕 너머로 해가 떠오른다.'),
    }[id];
    if (T && !st.data.seen[id]) { st.data.seen[id] = true; st.save(); setTimeout(() => ui().talk(T), 350); return; }
    if (prevEnter) prevEnter(id);
  };
})(window);
