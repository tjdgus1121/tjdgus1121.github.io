/* 상호작용과 미션 팝업. 계산은 화면이 보여 주고, 학생은 개념을 드러내는 행동(깃발 옮기기·오차 화살표 맞추기·토큰 올리기·추 달기)을 한다. */
(function (root) {
  'use strict';
  const GD = root.GD;
  const S = () => GD.state;
  const ui = () => GD.ui;
  const A = (p) => GD.assets.url(p);
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sgn = (e) => (e > 0 ? '+' : e < 0 ? '−' : '') + Math.abs(e);
  const narr = (...t) => t.map((x) => ({ who: 'narr', text: x }));
  const DA = () => GD.DATA_A, DB = () => GD.DATA_B;

  /* ---------- 박사의 노트(모은 장) ---------- */
  GD.NOTES = {
    cover: { title: '노트 표지', body: '이 노트를 발견한 사람에게.\n나는 우체국장에게 정확한 용수철 저울을 약속했다. 추를 매달면 바늘이 어디를 가리킬지 미리 알아야 눈금을 새길 수 있다.\n그런데 내 예측은 번번이 빗나갔다. 왜 틀리는지 밤마다 적어, 연구소 곳곳에 한 장씩 남겨 두었다.\n— E. 그레이' },
    A: { title: '10월 3일 밤 — 측정 기록 A', body: '같은 추 하나를 다섯 번 매달고 쟀다. 117, 122, 120, 123, 118이었다.\n같은 추인데 왜 매번 다른가?\n눈금판에는 숫자를 하나만 새길 수 있다. 여러 측정값 중 무엇을 예측값으로 삼아야 할까?' },
    drawer: { title: '10월 5일 밤 — 오차', body: '평균 120을 예측값으로 삼았다. 이제 얼마나 틀렸는지 재야 한다.\n실제값에서 예측값을 뺀 것, 그것을 오차라고 부르자.' },
    balance: { title: '10월 5일 밤(이어서) — 합이 0?', body: '오차를 새긴 토큰을 천칭에 올렸다. 모자라면 왼쪽, 넘치면 오른쪽.\n천칭이 완벽하게 수평이다. 오차를 모두 더하니 0이다. 그런데 실제로는 계속 빗나간다.\n양수와 음수가 서로 지워졌을 뿐이다.' },
    B: { title: '10월 14일 밤 — 측정 기록 B', body: '추를 0개부터 5개까지 매달아 길이를 쟀다. 10, 12.5, 13, 16.5, 18, 20 (cm).\n추의 무게를 바꾸니 예측도 달라져야 한다. 하나의 숫자로는 부족하다.' },
  };

  /* ---------- 맵에 들어설 때 ---------- */
  GD.onEnterMap = (id) => {
    const st = S();
    if (st.data.seen[id]) return;
    st.data.seen[id] = true; st.save();
    const T = {
      storage: narr('먼지 냄새가 나는 창고다. 선반 위에 등잔이 보인다.'),
      measure: narr('측정실이다. 비 오는 창 아래, 커다란 책상과 천칭이 놓여 있다.'),
      workshop: [{ who: 'narr', text: '작업실이다. 벽 쪽에 용수철 측정대가 서 있다.' }, { who: 'narr', text: '측정대에 갈고리가 빠져 있고, 추도 보이지 않는다. 곳곳을 뒤져 보자.' }],
    }[id];
    if (T) setTimeout(() => ui().talk(T), 350);
  };

  /* ---------- 상호작용 나누기 ---------- */
  const acts = {};
  acts.dispatch = (o) => {
    if (o.dark && !S().flag('lampLit')) {
      ui().talk(narr('구석이 너무 어둡다. 무언가 떨어져 있는 것 같은데… 불빛이 있으면 보일 것 같다.'));
      return;
    }
    if (o.slip !== undefined) return slip(o);
    if (o.pickup) return pickup(o);
    if (o.act && acts[o.act]) return acts[o.act](o);
    if (o.say) ui().talk(narr(o.say));
  };

  function pickup(o) {
    const st = S();
    st.picked[o.id] = true;
    st.give(o.pickup);
    GD.world.rebuild();
    if (o.pickup === 'plan') { document.getElementById('btnMap').hidden = false; ui().talk(narr('연구소 평면도다. 이제 지도 버튼(M)으로 방 배치를 볼 수 있다.')); }
    if (o.pickup === 'news') ui().talk(narr('바닥에 떨어진 신문 조각이다. 가방에서 읽어 볼 수 있다.'));
    if (o.pickup === 'hook') ui().talk(narr('용수철 갈고리다. 작업실 측정대에 끼우면 추를 매달 수 있겠다.'));
    if (o.pickup === 'weight') weightNote();
  }
  function weightNote() {
    const n = S().count('weight');
    ui().toast(`쇠추 ${n}/5`, 'icons/icon-weight.png');
  }
  function slip(o) {
    const st = S();
    st.picked[o.id] = true;
    st.data.slips.push(o.slip);
    st.give('slip', 1, { quiet: true });
    const n = st.data.slips.length;
    ui().toast(`측정 쪽지 ${n}/5 — ${DA()[o.slip]} mm`, 'icons/icon-slip.png');
    GD.world.rebuild();
    if (n === 5) setTimeout(gotDataA, 500);
    else if (n === 3 && !st.flag('lampLit')) setTimeout(() => ui().talk(narr('나머지 쪽지는 어디 있을까? 방 구석이 유난히 어둡다. 불빛이 있으면 좋겠다.')), 300);
  }
  function gotDataA() {
    const st = S();
    if (st.flag('dataA')) return;
    st.set('dataA');
    st.take('slip', 5);
    st.give('dataA');
    st.addNote('A');
    ui().talk([
      { who: 'narr', text: '쪽지 다섯 장을 모았다. 뒷면에 박사의 글씨가 이어진다.' },
      { who: 'gray', face: 'think', text: '같은 추 하나를 다섯 번 매달고 쟀다. 117, 122, 120, 123, 118이었다.' },
      { who: 'gray', face: 'puzzled', text: '같은 추인데 왜 매번 다른가? 손이 떨려서일까, 용수철이 미세하게 흔들려서일까.' },
      { who: 'gray', face: 'think', text: '눈금판에는 숫자를 하나만 새길 수 있다. 여러 측정값 중 무엇을 예측값으로 삼아야 할까?' },
      { who: 'gray', face: 'smile', text: '책상 서랍에는 그 수를 잠금 번호로 걸어 두었다.' },
      { who: 'narr', text: '측정 기록 A를 얻었다. 이제 책상 서랍의 자물쇠를 열어 보자.' },
    ], { bg: 'backgrounds/lab-furnished.png', memory: true });
  }

  /* ---------- 현관 ---------- */
  acts.cog = () => {
    const st = S();
    if (!st.flag('talkedCog')) {
      // 2026-11-12: 진행 상태는 대화 전에 저장한다(대화가 끊겨도 문이 잠기지 않게). 알림만 대화 끝에.
      st.set('talkedCog'); GD.world.rebuild();
      ui().talk([
        { who: 'cog', face: 'surprised', text: '삐걱… 손님이군요! 저는 코그, 그레이 박사님의 자동인형이에요.' },
        { who: 'cog', face: 'normal', text: '정문은 아침 종이 울려야 열려요. 그런데 시계가 3시 47분에 멈춰 버렸어요.' },
        { who: 'cog', face: 'normal', text: '박사님은 우체국에 납품할 저울 눈금판을 끝내지 못하고 사라지셨어요. 연구소 곳곳에 노트와 측정 기록을 남기셨대요.' },
        { who: 'cog', face: 'happy', text: '물건 가까이 가서 F를 누르면 살펴볼 수 있어요. 화면을 눌러도 그곳까지 걸어가요.' },
        { who: 'cog', face: 'normal', text: '참, 측정실에는 박사님의 영상 상자(TV)가 있어요. 창고 어딘가에 박사님이 남긴 비디오테이프가 있을 텐데…' },
        { who: 'cog', face: 'happy', text: '위쪽 문을 열어 드릴게요. 막히면 언제든 저를 찾아오세요!' },
      ], { onEnd: () => ui().toast('측정실 문이 열렸다') });
      return;
    }
    const f = st.flags, w = st.count('weight');
    let hint;
    if (!f.cover) hint = '위쪽 문 너머 측정실에 박사님의 책상이 있어요.';
    else if (!f.dataA) hint = f.lampLit ? '쪽지 다섯 장, 방 구석구석을 살펴보세요. 이제 등잔이 있으니 어두운 구석도 보일 거예요.' : '어두운 구석에 쪽지가 있다면… 창고 선반의 등잔을 가져가 보세요. 불을 붙일 성냥도 창고 바닥 어딘가에 있을 거예요.';
    else if (!f.drawerOpen) hint = '다섯 값을 대표하는 하나의 수… 수직선 위 깃발을 옮겨서, 양쪽 화살표 길이가 똑같아지는 곳을 찾아보세요.';
    else if (!f.errorsDone) hint = '오차는 실제값에서 예측값을 뺀 거예요. 117이면 117 − 120이죠.';
    else if (!f.balanceDone) hint = '모자란 쪽(음수)은 왼쪽 접시, 넘친 쪽(양수)은 오른쪽 접시에 올려 보세요.';
    // 2026-11-12: 1부 중간 세 단계가 빠져 칠판·트렁크에서 막히면 '갈고리' 힌트가 나오던 것을 할 일 순서와 맞춤
    else if (!f.squaresDone && !f.workshopOpen) hint = '천칭에서 나온 분필로 측정실 뒷벽 칠판에 오차를 그려 보세요. −3도 +3도 지워지지 않는 모양이 있을 거예요.';
    else if (!f.dialOpen && !f.workshopOpen) hint = '칠판에 남은 넓이의 평균(소수)을 측정실 왼쪽 아래 트렁크의 다이얼에 맞춰 보세요.';
    else if (!f.workshopOpen) hint = '유리 돔 받침에 기준추를 하나씩 올려 넓이 평균을 비교해 보세요. 가장 작은 곳이 답이에요.';
    else if (!st.has('hook') && !f.dataB) hint = '작업실 측정대에 끼울 갈고리가 작업실 바닥 어딘가에 있을 거예요.';
    else if (w < 5 && !f.dataB) hint = '쇠추는 작업실 바닥, 작업대 서랍, 실패한 저울 위에 있어요. 하나는 창고 선반 아래 칸에서 본 것 같아요.';
    else if (!f.dataB) hint = '측정대에서 추를 하나씩 달아 보세요. 0개일 때도 재야 해요!';
    else if (!f.lineDone) hint = '2부예요! 작업실 뒷벽의 좌표 칠판(작업 일정판)에 측정 기록 B가 점으로 찍혀 있어요. 점들에 맞는 직선을 그어 보세요.';
    else if (!f.bookDone) hint = '추를 하나도 달지 않았을 때 길이는 10 cm였죠? 작업실 뒷벽 선반의 책 열네 권을 왼쪽부터 그만큼 세어 보세요.';
    else if (!f.scrollDone) hint = '두루마리 통의 직선들을 칠판에 겹쳐 보세요. 오차 정사각형 넓이의 평균이 작을수록 좋은 직선이에요.';
    else if (!f.knobIn) hint = '나선 계단 위 기계실의 예측 기계에, 두루마리 통에서 나온 기울기 손잡이를 끼워 보세요.';
    else if (!f.slopeSeen) hint = '손잡이를 왼쪽·오른쪽으로 조금씩 돌려 보고, 발밑 재기 레버로 기울기를 읽어 보세요.';
    else if (!f.dirBoxOpen) hint = '기계실 왼쪽 위 톱니 상자예요. 발밑 기울기가 음수면 a를 키우고, 양수면 줄여요.';
    else if (!f.rateDone) hint = '톱니마다 한 번에 돌리는 비율이 달라요. 너무 크면 튕겨 나가고, 너무 작으면 새벽까지 못 끝내요.';
    else if (!f.letterRead) hint = '눈금판을 기계실 위쪽 발코니 문의 홈에 끼워 보세요. 시계가 다시 돌 거예요!';
    else if (!f.finished) hint = '아침 종이 울렸어요! 발코니의 기록판에 오늘 밤의 기록이 남아 있어요.';
    else hint = '탈출 성공이에요! 현관 정문으로 나가도 되고, 못 찾은 역사 카드나 시계 부품을 더 찾아봐도 좋아요.';
    ui().talk([{ who: 'cog', face: f.dataB ? 'happy' : 'normal', text: hint }]);
  };
  acts.board = () => {
    const st = S();
    if (!st.has('order')) { st.give('order'); }
    ui().doc('order');
  };
  acts.bench = () => ui().talk(narr('벤치 밑을 들여다봤다. 먼지뿐이다. 아무것도 없다.'));

  /* ---------- 창고 ---------- */
  acts.shelf = () => {
    const st = S();
    if (!st.picked.shelfW) {
      ui().talk(narr('선반 아래 칸 구석에 쇠추 하나가 굴러다닌다. 챙겨 두자.'), { onEnd: () => { if (st.picked.shelfW) return; st.picked.shelfW = true; st.give('weight'); weightNote(); } });
    } else ui().talk(narr('철제 선반이다. 아래 칸은 이제 비어 있다.'));
  };
  acts.lamp = () => {
    const st = S();
    const lit = st.has('matches');
    ui().popup({
      title: '선반 위 등잔', narrow: true,
      html: `<div class="closeup" style="background-image:url('${A('closeups/lamp-unlit.png')}')"></div>
        <p>${lit ? '기름이 남아 있다. 성냥이 있으니 불을 붙일 수 있다.' : '기름은 남아 있는데 불을 붙일 것이 없다. 일단 챙겨 두자.'}</p>
        <button type="button" class="btn" id="takeLamp">${lit ? '성냥으로 불을 붙이고 챙긴다' : '챙긴다'}</button>`,
      onMount(body, close) {
        const take = body.querySelector('#takeLamp');
        take.addEventListener('click', () => {
          if (st.has('lamp')) return;
          take.disabled = true;
          if (lit) body.querySelector('.closeup').style.backgroundImage = `url('${A('closeups/lamp-lit.png')}')`;
          st.give('lamp'); GD.world.rebuild();
          setTimeout(() => { if (take.isConnected) close(); }, lit ? 700 : 0);
        });
      },
    });
  };
  acts.storageTrunk = () => {
    const st = S();
    const draw = (body) => {
      const open = st.flag('storageTrunkOpen'), hasTape = !st.picked.tape;
      body.innerHTML = `<div class="closeup" style="background-image:url('${A(open ? 'closeups/trunk-open.png' : 'closeups/trunk-closed.png')}')">
          ${open && hasTape ? `<button type="button" id="tapeBtn" aria-label="비디오테이프 꺼내기" style="left:57%;top:33%;width:13%;height:14%;border:0;background:url('${A(GD.assets.TAPE)}') center / contain no-repeat;cursor:pointer;transform:rotate(-8deg)"></button>` : ''}
        </div>
        <p>${!open ? '잠기지 않은 나무 트렁크다. 뚜껑이 무겁다.' : hasTape ? '오른쪽 칸에 비디오테이프 하나가 들어 있다! 왼쪽 칸은 비어 있다.' : '두 칸 모두 비어 있다.'}</p>
        ${!open ? '<button type="button" class="btn" id="openTrunk">열어 본다</button>' : ''}`;
      const ob = body.querySelector('#openTrunk');
      if (ob) ob.addEventListener('click', () => { st.set('storageTrunkOpen'); GD.world.rebuild(); draw(body); });
      const tb = body.querySelector('#tapeBtn');
      if (tb) tb.addEventListener('click', () => { st.picked.tape = true; st.give('tape'); draw(body); });
    };
    ui().popup({ title: '나무 트렁크', narrow: true, onMount: draw });
  };

  /* ---------- 측정실 ---------- */
  acts.bookcase = () => ui().talk(narr('측정과 오차에 관한 책이 빼곡하다.', '아래 수납장을 열어 봤다. 텅 비어 있다. 누군가 이미 다 꺼내 간 것 같다.'));
  acts.desk = () => {
    const st = S(), f = st.flags;
    if (!f.cover) {
      st.set('cover'); st.addNote('cover');
      ui().talk([
        { who: 'narr', text: '책상 위에 노트 한 권이 펼쳐져 있다. 첫 장에 이렇게 적혀 있다.' },
        { who: 'gray', face: 'think', text: '이 노트를 발견한 사람에게.' },
        { who: 'gray', face: 'think', text: '나는 우체국장에게 정확한 용수철 저울을 약속했다. 추를 매달면 바늘이 어디를 가리킬지 미리 알아야 눈금을 새길 수 있다.' },
        { who: 'gray', face: 'tired', text: '그런데 내 예측은 번번이 빗나갔다. 왜 틀리는지 밤마다 적어, 연구소 곳곳에 한 장씩 남겨 두었다.' },
        { who: 'gray', face: 'smile', text: '내가 지나온 고민을 차례로 풀어 보라. 마지막 장에 이르면 눈금판이 완성되고, 멈춘 시계가 다시 돌 것이다.' },
        { who: 'narr', text: '노트를 덮자 바람이 불어 종이가 흩날렸다. 바닥 곳곳에 측정 쪽지가 떨어져 있다.' },
      ], { bg: 'backgrounds/lab-night-dark.png', memory: true });
      return;
    }
    if (!f.dataA) { ui().talk(narr(`서랍에 3칸 숫자 자물쇠가 걸려 있다. 먼저 바닥의 측정 쪽지를 모두 모으자. (${st.data.slips.length}/5)`)); return; }
    if (!f.drawerOpen) return drawerPopup();
    if (!f.errorsDone) return errorPopup();
    ui().talk(narr('노트에 오차 계산이 정리되어 있다. −3, +2, 0, +3, −2.'));
  };

  /* ① 서랍 자물쇠: 대표하는 하나의 수(평균) */
  function nlSVG(id, h = 250) {
    return `<svg id="${id}" viewBox="0 0 540 ${h}" tabindex="0" role="slider" aria-label="예측값 깃발" style="width:100%;touch-action:none;cursor:grab;background:#fff8e8;border-radius:12px;border:2px solid #d9c49c"></svg>`;
  }
  const NX = (v) => 30 + (v - 114) * 40;
  function drawNL(svg, c, { arrows = true, errs = null } = {}) {
    let s = '<line x1="15" y1="200" x2="525" y2="200" stroke="#1d2a2c" stroke-width="3"/>';
    for (let v = 114; v <= 126; v++) s += `<line x1="${NX(v)}" y1="192" x2="${NX(v)}" y2="208" stroke="#1d2a2c" stroke-width="2"/><text x="${NX(v)}" y="232" font-size="15" font-weight="800" text-anchor="middle" fill="#7c6d58">${v}</text>`;
    const rows = [60, 86, 112, 138, 164];
    let left = 0, right = 0;
    DA().forEach((v, i) => {
      const y = rows[i];
      if (errs) {
        const e = errs[i];
        if (e !== null) {
          const tip = 120 + e, ok = tip === v, col = ok ? '#2f8a5b' : '#d4583e';
          s += `<line x1="${NX(120)}" y1="${y}" x2="${NX(tip)}" y2="${y}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
          if (e !== 0) s += `<path d="M${NX(tip)} ${y} l${e > 0 ? -12 : 12} -7 l0 14 Z" fill="${col}"/>`;
        }
      } else if (arrows && Math.abs(v - c) > .01) {
        const col = v < c ? '#3f7fc4' : '#d4583e';
        s += `<line x1="${NX(c)}" y1="${y}" x2="${NX(v)}" y2="${y}" stroke="${col}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
        if (v < c) left += c - v; else right += v - c;
      }
      s += `<circle cx="${NX(v)}" cy="${y}" r="9" fill="#2f6f74" stroke="#1d2a2c" stroke-width="2"/><text x="${NX(v) + (v < 120 ? -14 : 14)}" y="${y + 5}" font-size="14" font-weight="900" text-anchor="${v < 120 ? 'end' : 'start'}" fill="#2f6f74">${v}</text>`;
      s += `<line x1="${NX(v)}" y1="${y + 9}" x2="${NX(v)}" y2="196" stroke="#2f6f74" stroke-dasharray="3 5" opacity=".5"/>`;
    });
    // 깃발
    s += `<line x1="${NX(c)}" y1="36" x2="${NX(c)}" y2="200" stroke="#b07f22" stroke-width="5"/><path d="M${NX(c)} 36 l40 11 l-40 11 Z" fill="#e2a940" stroke="#1d2a2c" stroke-width="2"/><text x="${NX(c)}" y="28" font-size="16" font-weight="900" text-anchor="middle" fill="#1d2a2c">예측 ${c}</text>`;
    svg.innerHTML = s;
    return { left, right };
  }
  function drawerPopup() {
    const st = S();
    let c = 118, digits = [0, 0, 0], tries = 0;
    ui().popup({
      puzzle: true, title: '박사의 책상 서랍',
      html: `<div class="cols">
          <div class="card">
            <h3>측정 기록 A</h3>${ui().tableHTML('A')}
            <p style="margin-top:10px">깃발을 끌어서(또는 ←→ 키) 다섯 값을 대표할 예측값을 찾아보세요.</p>
            ${nlSVG('nlA')}
            <p id="balanceTxt" style="font-weight:800"></p>
          </div>
          <div>
            <div class="closeup" id="drawerImg" style="background-image:url('${A('closeups/drawer-closed.png')}')"></div>
            <p>서랍의 숫자 자물쇠: 세 자리 수를 맞추고 열어 보세요.</p>
            <div class="lock-row">
              <div class="wheels">
                ${[0, 1, 2].map((k) => `<div class="wheel"><button type="button" data-k="${k}" data-d="1" aria-label="${k + 1}번째 숫자 올리기">▲</button><output id="w${k}" aria-live="polite">0</output><button type="button" data-k="${k}" data-d="-1" aria-label="${k + 1}번째 숫자 내리기">▼</button></div>`).join('')}
              </div>
              <button type="button" class="btn" id="tryOpen">열어 본다</button>
            </div>
            <div class="feedback" id="fb"></div>
          </div>
        </div>`,
      onMount(body, close) {
        const svg = body.querySelector('#nlA'), txt = body.querySelector('#balanceTxt'), fb = body.querySelector('#fb');
        const redraw = () => {
          const { left, right } = drawNL(svg, c);
          const eq = Math.abs(left - right) < .01;
          txt.innerHTML = `왼쪽 화살표 합 <b style="color:#3f7fc4">${left}</b> · 오른쪽 화살표 합 <b style="color:#d4583e">${right}</b> ${eq ? '→ <span style="color:#2f8a5b">균형!</span>' : ''}`;
        };
        redraw();
        const setFromX = (clientX) => {
          const r = svg.getBoundingClientRect(), x = (clientX - r.left) / r.width * 540;
          c = Math.max(115, Math.min(125, Math.round(((x - 30) / 40 + 114) * 2) / 2));
          redraw();
        };
        let drag = false;
        svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); setFromX(e.clientX); });
        svg.addEventListener('pointermove', (e) => { if (drag) setFromX(e.clientX); });
        svg.addEventListener('pointerup', () => { drag = false; });
        svg.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') { c = Math.max(115, c - .5); redraw(); e.preventDefault(); }
          if (e.key === 'ArrowRight') { c = Math.min(125, c + .5); redraw(); e.preventDefault(); }
        });
        body.querySelectorAll('.wheel button').forEach((b) => b.addEventListener('click', () => {
          const k = +b.dataset.k;
          digits[k] = (digits[k] + +b.dataset.d + 10) % 10;
          body.querySelector(`#w${k}`).textContent = digits[k];
        }));
        body.querySelector('#tryOpen').addEventListener('click', () => {
          const v = digits[0] * 100 + digits[1] * 10 + digits[2];
          tries++;
          fb.className = 'feedback no';
          if (v === 120) {
            fb.className = 'feedback ok';
            fb.textContent = '딸깍! 서랍이 열렸다. 120은 다섯 값의 균형점, 곧 평균이다.';
            body.querySelector('#drawerImg').style.backgroundImage = `url('${A('closeups/drawer-open.png')}')`;
            body.querySelector('.wheels').style.display = 'none';
            const btn = body.querySelector('#tryOpen');
            btn.textContent = '서랍 속을 살펴본다';
            btn.onclick = () => { close(); drawerDone(); };
            btn.replaceWith(btn.cloneNode(true));
            body.querySelector('#tryOpen').addEventListener('click', () => { close(); drawerDone(); });
            return;
          }
          if (v === 123) fb.textContent = '가장 큰 값을 고르면 나머지 네 번은 모두 예측보다 짧게 나와요. 한쪽으로 치우친 예측이에요.';
          else if (v === 117) fb.textContent = '가장 작은 값을 고르면 반대로 모두 길게 나와요.';
          else if (DA().includes(v)) fb.textContent = `${v}도 측정값 중 하나지만, 깃발을 ${v}에 두고 양쪽 화살표 합을 비교해 보세요.`;
          else fb.textContent = tries > 1 ? '깃발 양쪽의 화살표 길이 합이 똑같아지는 곳이 균형점이에요. 그 수를 맞춰 보세요.' : '열리지 않는다. 다섯 값을 대표하는 하나의 수는 무엇일까?';
        });
      },
    });
  }
  function drawerDone() {
    const st = S();
    st.set('drawerOpen');
    st.give('token', 5);
    st.addNote('drawer');
    ui().talk([
      { who: 'narr', text: '서랍 안에 놋쇠 토큰 다섯 개와 노트 한 장이 들어 있다.' },
      { who: 'gray', face: 'think', text: '평균 120을 예측값으로 삼았다. 그런데 우체국장은 같은 편지를 두 번 올렸더니 요금이 다르게 나왔다고 했다.' },
      { who: 'gray', face: 'puzzled', text: '바늘이 예측한 자리에서 빗나가면 요금이 틀린다. 고치려면 먼저 얼마나 틀렸는지를 재야 한다.' },
      { who: 'gray', face: 'eureka', text: '실제값에서 예측값을 뺀 것, 그것을 오차라고 부르자. 다섯 측정값의 오차를 토큰에 새겨 두자.' },
      { who: 'narr', text: '책상의 노트에서 오차를 구해 보자.' },
    ], { bg: 'backgrounds/lab-furnished.png', memory: true });
  }

  /* ② 오차 구하기 */
  function errorPopup() {
    const st = S();
    const errs = [null, null, null, null, null];
    ui().popup({
      puzzle: true, title: '오차 구하기 — 오차 = 실제값 − 예측값',
      html: `<div class="cols">
          <div class="card">
            <h3>수직선</h3>
            <p>예측값 120(깃발)에서 출발한 화살표가 실제 측정값(점)에 닿으면 맞습니다.</p>
            ${nlSVG('nlE')}
          </div>
          <div class="card">
            <h3>노트</h3>
            ${DA().map((v, i) => `<div class="err-row"><span class="eq">${v} − 120 =</span>
              <span class="stepper"><button type="button" data-i="${i}" data-d="-1" aria-label="${v}의 오차 1 줄이기">−</button><output id="e${i}">?</output><button type="button" data-i="${i}" data-d="1" aria-label="${v}의 오차 1 늘리기">+</button></span>
              <span class="mark" id="m${i}"></span></div>`).join('')}
            <button type="button" class="btn" id="checkE" style="margin-top:12px">확인</button>
            <div class="feedback" id="fbE"></div>
          </div>
        </div>`,
      onMount(body, close) {
        const svg = body.querySelector('#nlE'), fb = body.querySelector('#fbE');
        svg.style.cursor = 'default';
        const redraw = () => drawNL(svg, 120, { errs });
        redraw();
        body.querySelectorAll('.stepper button').forEach((b) => b.addEventListener('click', () => {
          const i = +b.dataset.i;
          errs[i] = Math.max(-9, Math.min(9, (errs[i] ?? 0) + +b.dataset.d));
          body.querySelector(`#e${i}`).textContent = sgn(errs[i]) || '0';
          body.querySelector(`#m${i}`).textContent = '';
          redraw();
        }));
        body.querySelector('#checkE').addEventListener('click', () => {
          let firstBad = -1;
          DA().forEach((v, i) => {
            const ok = errs[i] === v - 120;
            const m = body.querySelector(`#m${i}`);
            m.textContent = ok ? '✓' : '✗'; m.className = 'mark ' + (ok ? 'ok' : 'no');
            if (!ok && firstBad < 0) firstBad = i;
          });
          if (firstBad < 0) {
            fb.className = 'feedback ok';
            fb.textContent = '모두 맞았다! 토큰에 −3, +2, 0, +3, −2를 새겼다.';
            const btn = body.querySelector('#checkE');
            btn.textContent = '토큰을 챙긴다';
            btn.replaceWith(btn.cloneNode(true));
            body.querySelector('#checkE').addEventListener('click', () => { close(); errorsDone(); });
            return;
          }
          const v = DA()[firstBad], e = errs[firstBad], right = v - 120;
          fb.className = 'feedback no';
          if (e === null) fb.textContent = `${v}의 오차를 아직 정하지 않았어요.`;
          else if (e === -right && e !== 0) fb.textContent = `부호를 확인해 보세요. ${v}은(는) 예측값 120보다 ${v < 120 ? '작아요. 실제가 모자라면 오차는 음수예요' : '커요. 실제가 넘치면 오차는 양수예요'}.`;
          else fb.textContent = `${v}에서 120까지 수직선 눈금을 세어 보세요. 화살표 끝이 점에 닿아야 해요.`;
        });
      },
    });
  }
  function errorsDone() {
    const st = S();
    st.set('errorsDone');
    ui().talk([
      { who: 'gray', face: 'think', text: '−3, +2, 0, +3, −2. 모자라면 음수, 넘치면 양수.' },
      { who: 'gray', face: 'smile', text: '모자란 토큰은 천칭의 왼쪽에, 넘친 토큰은 오른쪽에 올려 보자. 전체적으로 얼마나 틀렸는지 알 수 있지 않을까?' },
    ], { bg: 'backgrounds/lab-furnished.png', memory: true });
  }

  /* ③ 천칭: 오차의 합 */
  acts.balance = () => {
    const f = S().flags;
    if (!f.errorsDone) { ui().talk(narr('놋쇠 천칭이다. 두 접시가 비어 있다. 무언가 올려 볼 것이 생기면 다시 와 보자.')); return; }
    if (!f.balanceDone) return balancePopup();
    ui().talk(narr('천칭은 수평을 이룬 채 멈춰 있다. 합이 0이어도 오차가 없다는 뜻은 아니었다.'));
  };
  function balancePopup() {
    const vals = DA().map((v) => v - 120);
    const place = vals.map(() => null); // 'L' | 'R' | 'C'
    let sel = -1, asked = false;
    let stopMotion = () => {};
    ui().popup({
      puzzle: true, title: '천칭 — 오차 토큰 올리기',
      html: `<div class="closeup fit" style="background-image:url('${A('closeups/balance-stage.png')}')">
          <svg id="balSvg" viewBox="0 0 1672 941" preserveAspectRatio="none" style="left:0;top:0;width:100%;height:100%"></svg>
        </div>
        <div class="tokens" id="tray"></div>
        <div class="pan-btns">
          <button type="button" class="btn ghost" data-p="L">◀ 왼쪽 접시 (모자람)</button>
          <button type="button" class="btn ghost" data-p="C">가운데 받침</button>
          <button type="button" class="btn ghost" data-p="R">오른쪽 접시 (넘침) ▶</button>
        </div>
        <div class="feedback" id="fbB">토큰을 고른 뒤, 올릴 곳을 누르세요. (접시를 직접 눌러도 됩니다)</div>
        <div id="ask"></div>`,
      onMount(body, close) {
        const svg = body.querySelector('#balSvg'), tray = body.querySelector('#tray'), fb = body.querySelector('#fbB'), ask = body.querySelector('#ask');
        const reduce = matchMedia('(prefers-reduced-motion: reduce)');
        let targetAngle = 0, currentAngle = 0, velocity = 0, lastTick = 0, frameId = 0, allPlaced = false;
        const pose = (angle, seconds) => {
          const t = angle * Math.PI / 180, cx = 836, cy = 74, arm = 252;
          const beam = svg.querySelector('#balBeam');
          if (beam) beam.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
          ['L', 'R'].forEach((side, k) => {
            const sign = k ? 1 : -1, pan = svg.querySelector(`[data-moving-pan="${side}"]`);
            const sway = reduce.matches || allPlaced ? 0 : Math.sin(seconds * 2.6 + k * .7) * .45 - velocity * .025;
            if (pan) pan.setAttribute('transform', `translate(${cx + sign * arm * Math.cos(t)} ${cy + sign * arm * Math.sin(t)}) rotate(${sway})`);
          });
        };
        const tick = stamp => {
          if (!svg.isConnected || !ui().popupOpen) return;
          const dt = Math.min(.04, (stamp - (lastTick || stamp - 16)) / 1000); lastTick = stamp;
          velocity += ((targetAngle - currentAngle) * 90 - velocity * 16) * dt;
          currentAngle += velocity * dt;
          const ripple = allPlaced ? 0 : Math.sin(stamp / 1000 * Math.PI * 2 / 5.8) * .7;
          pose(currentAngle + ripple, stamp / 1000);
          frameId = requestAnimationFrame(tick);
        };
        const motionChanged = () => {
          cancelAnimationFrame(frameId); frameId = 0;
          currentAngle = targetAngle; velocity = 0; lastTick = 0;
          pose(targetAngle, 0);
          if (!reduce.matches) frameId = requestAnimationFrame(tick);
        };
        stopMotion = () => { cancelAnimationFrame(frameId); reduce.removeEventListener('change', motionChanged); };
        reduce.addEventListener('change', motionChanged);
        const draw = () => {
          let sum = 0; vals.forEach((e, i) => { if (place[i] === 'L' || place[i] === 'R') sum += e; });
          const ang = Math.max(-14, Math.min(14, sum * 3));
          targetAngle = ang; allPlaced = place.every(p => p);
          let s = `<image href="${A('props/balance-base.png')}" x="586" y="20" width="500" height="500"/>`;
          s += `<g id="balBeam"><image href="${A('props/balance-beam.png')}" x="556" y="-22" width="560" height="187"/></g>`;
          ['L', 'R'].forEach((side, k) => {
            s += `<g data-moving-pan="${side}"><g data-pan="${side}" style="cursor:pointer"><image href="${A('props/balance-pan.png')}" x="-110" y="-11" width="220" height="220"/><rect x="-110" y="0" width="220" height="220" fill="transparent"/></g>`;
            let n = 0;
            vals.forEach((e, i) => { if (place[i] === side) { s += tokenSVG(-34 + n * 68, 150, e); n++; } });
            s += '</g>';
          });
          let m = 0;
          vals.forEach((e, i) => { if (place[i] === 'C') { s += tokenSVG(836 + (m - 0) * 70, 548, e); m++; } });
          s += `<rect data-pan="C" x="736" y="480" width="200" height="120" fill="transparent" style="cursor:pointer"/>`;
          const all = place.every((p) => p);
          if (all) s += `<g><rect x="636" y="610" width="400" height="90" rx="45" fill="#fbefd0" stroke="#1d2a2c" stroke-width="5"/><text x="836" y="672" font-size="48" font-weight="900" text-anchor="middle" fill="#c2472d">합 = ${sgn(sum) || 0}</text></g>`;
          svg.innerHTML = s;
          pose(reduce.matches ? targetAngle : currentAngle, performance.now() / 1000);
          svg.querySelectorAll('[data-pan]').forEach((g) => g.addEventListener('click', () => put(g.dataset.pan)));
          tray.innerHTML = vals.map((e, i) => `<button type="button" class="token ${place[i] ? 'placed' : ''} ${sel === i ? 'sel' : ''}" data-i="${i}" ${place[i] ? 'disabled' : ''} aria-label="오차 토큰 ${sgn(e) || 0}">${sgn(e) || 0}</button>`).join('');
          tray.querySelectorAll('.token').forEach((b) => b.addEventListener('click', () => { sel = +b.dataset.i; draw(); }));
          if (all && !asked) { asked = true; question(sum); }
        };
        const tokenSVG = (x, y, e) => `<circle cx="${x}" cy="${y}" r="32" fill="${e < 0 ? '#deebfb' : e > 0 ? '#fde1d8' : '#fbefd0'}" stroke="#1d2a2c" stroke-width="4"/><text x="${x}" y="${y + 11}" font-size="30" font-weight="900" text-anchor="middle" fill="${e < 0 ? '#2c66b0' : e > 0 ? '#c2472d' : '#9c6a14'}">${sgn(e) || 0}</text>`;
        const put = (p) => {
          if (sel < 0) { fb.className = 'feedback no'; fb.textContent = '먼저 아래에서 토큰 하나를 고르세요.'; return; }
          const e = vals[sel];
          if (e === 0 && p !== 'C') { fb.className = 'feedback no'; fb.textContent = '0은 어느 쪽에도 무게를 더하지 않아요. 가운데 받침에 두세요.'; return; }
          if (e < 0 && p !== 'L') { fb.className = 'feedback no'; fb.textContent = `${sgn(e)}은(는) 예측보다 모자란 쪽이에요. 왼쪽 접시에 올려 보세요.`; return; }
          if (e > 0 && p !== 'R') { fb.className = 'feedback no'; fb.textContent = `${sgn(e)}은(는) 예측보다 넘친 쪽이에요. 오른쪽 접시에 올려 보세요.`; return; }
          place[sel] = p; sel = -1;
          fb.className = 'feedback'; fb.textContent = place.every((x) => x) ? '' : '좋아요. 다음 토큰을 올려 보세요.';
          draw();
        };
        body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => put(b.dataset.p)));
        const question = () => {
          fb.className = 'feedback'; fb.textContent = '천칭이 완벽하게 수평이다. 오차를 모두 더하니 0!';
          ask.innerHTML = `<div class="card" style="margin-top:10px"><h3>오차의 합이 0이라는 것은 무엇을 뜻할까?</h3>
            <div class="pan-btns" style="justify-content:flex-start">
              <button type="button" class="btn ghost" style="color:#1d2a2c;border-color:#4a2f20" data-a="1">예측이 완벽하다</button>
              <button type="button" class="btn ghost" style="color:#1d2a2c;border-color:#4a2f20" data-a="2">양수와 음수가 서로 지워졌다</button>
              <button type="button" class="btn ghost" style="color:#1d2a2c;border-color:#4a2f20" data-a="3">측정을 잘못했다</button>
            </div><div class="feedback" id="fbQ"></div></div>`;
          const fq = ask.querySelector('#fbQ');
          ask.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
            const a = b.dataset.a;
            if (a === '2') {
              fq.className = 'feedback ok'; fq.textContent = '맞아요. 토큰 하나하나는 0이 아닌데, 더하면 서로 지워져 0이 된 거예요.';
              setTimeout(() => { close(); balanceDone(); }, 1600);
            } else if (a === '1') { fq.className = 'feedback no'; fq.textContent = '그렇다면 117은 왜 120이 아니었을까요? 토큰 하나하나는 0이 아니에요.'; } else { fq.className = 'feedback no'; fq.textContent = '측정값을 바꿔도 평균과의 차이를 더하면 늘 0이 돼요. 실수가 아니라 평균이 원래 가진 성질이에요.'; }
          }));
        };
        draw();
        motionChanged();
      },
      onClose() { stopMotion(); },
    });
  }
  function balanceDone() {
    const st = S();
    st.set('balanceDone');
    st.addNote('balance');
    st.give('chalk', 1, { quiet: true });   // 분필은 먼저 가방에, 얻는 알림은 대사 뒤에
    ui().talk([
      { who: 'gray', face: 'puzzled', text: '천칭이 완벽하게 수평이다. 오차를 모두 더하니 0이다. 그런데 실제로는 계속 빗나간다.' },
      { who: 'gray', face: 'tired', text: '오차가 0이라면 내 예측은 완벽한가? 아니다. 양수와 음수가 서로 지워졌을 뿐이다.' },
      { who: 'gray', face: 'think', text: '그냥 더해서는 얼마나 틀렸는지 잴 수 없다. 서로 지워지지 않게 기록할 방법이 필요하다.' },
      { who: 'narr', text: '천칭 받침의 비밀 칸이 덜컥 열리며 분필 한 자루가 나왔다.' },
      { who: 'me', text: '지워지지 않게 기록할 방법이라… 이 분필로 뒷벽 칠판에 오차를 그려 보면서 고민해 봐야겠어.' },
    ], { bg: 'backgrounds/lab-furnished.png', memory: true, onEnd: () => { const it = GD.ITEMS.chalk; ui().toast(`${it.name}을(를) 얻었다`, st.icon('chalk')); if (ui().flyToBag) ui().flyToBag(st.icon('chalk')); } });
  }

  /* TV: 비디오테이프 → 모션그래픽 1편 */
  acts.tv = () => {
    const st = S();
    const play = () => {
      if (st.has('tape')) { st.take('tape'); st.set('tapeIn'); }
      ui().popup({
        title: '영상 상자 — 「빗나간 예측」',
        html: `<p id="movieLoading" role="status">박사의 연구 노트를 불러오는 중…</p><div class="tv"><iframe src="../gd-motion-ep1-error/index.html" title="모션그래픽 1편 빗나간 예측" allow="autoplay; fullscreen" allowfullscreen></iframe>
          <div class="tv-bar"><span class="knob"></span><span>그레이의 연구 노트 ① · 영상 안에서 재생·일시정지·장면 이동</span></div></div>
          <div class="pan-btns inspect-buttons"><button type="button" class="btn" id="markWatched">내용을 확인했다</button><button type="button" class="btn ghost" id="ejectTape">테이프 꺼내기</button><a class="btn ghost" href="../gd-motion-ep1-error/index.html" target="_blank" rel="noopener">영상만 크게 열기 ↗</a></div><p class="movie-status" role="status">${st.flag('watched') ? '시청 기록이 남아 있다. 언제든 다시 볼 수 있다.' : '닫아도 테이프는 상자에 남는다. 시청 기록은 확인 버튼을 눌렀을 때 남긴다.'}</p>`,
        onMount(body, close) {
          body.querySelector('iframe').addEventListener('load', () => { body.querySelector('#movieLoading').hidden = true; });
          body.querySelector('#markWatched').onclick = () => { st.set('watched'); body.querySelector('.movie-status').textContent = '시청 기록을 남겼다. 박사의 고민이 조금 보이는 것 같다.'; };
          body.querySelector('#ejectTape').onclick = () => { close(); st.set('tapeIn', false); st.give('tape'); GD.world.rebuild(); };
        },
      });
    };
    if (!st.has('tape') && !st.flag('tapeIn')) {
      ui().popup({ title: '박사의 영상 상자(TV)', narrow: true, html: `<img class="inspect-art" src="${A(GD.assets.TV)}" alt="영상 상자"><p>테이프를 넣는 구멍이 비어 있다. 창고의 나무 트렁크에 박사가 남긴 비디오테이프가 있을지도 모른다.</p>` });
      return;
    }
    if (st.flag('tapeIn')) { play(); return; }
    ui().talk([{ who: 'narr', text: st.flag('tapeIn') ? '영상 상자에 「빗나간 예측」 테이프가 들어 있다.' : '비디오테이프를 영상 상자에 넣을까?', choices: [{ t: st.flag('tapeIn') ? '다시 본다' : '넣는다', fn: play }, { t: '나중에', fn: null }] }]);
  };

  /* ---------- 작업실 ---------- */
  acts.workbench = () => {
    const st = S();
    const D = [
      { id: 'wb1', text: '빈 서랍이다. 톱밥 냄새만 난다.' },
      { id: 'wb2', text: '메모 한 장이 들어 있다.', give: 'memo' },
      { id: 'wb3', text: '쇠추 하나가 굴러다닌다!', give: 'weight' },
      { id: 'wb4', text: '부러진 줄칼 하나뿐. 쓸 만한 건 없다.' },
    ];
    ui().popup({
      title: '작업대 서랍', narrow: true,
      html: `<div class="closeup" style="background-image:url('${A('closeups/drawer-open.png')}');aspect-ratio:1672/600;background-position:center 60%"></div>
        <div class="pan-btns" style="margin-top:12px">${D.map((d, i) => `<button type="button" class="btn ghost" data-i="${i}">${i + 1}번 서랍${st.picked[d.id] ? ' (열어 봄)' : ''}</button>`).join('')}</div>
        <div class="feedback" id="fbW">서랍이 네 칸 있다. 하나씩 열어 보자.</div>`,
      onMount(body) {
        const fb = body.querySelector('#fbW');
        body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
          const d = D[+b.dataset.i];
          if (st.picked[d.id]) { fb.className = 'feedback'; fb.textContent = d.give ? '이미 챙긴 서랍이다. 이제 비어 있다.' : d.text; return; }
          st.picked[d.id] = true;
          fb.className = d.give ? 'feedback ok' : 'feedback';
          fb.textContent = d.text;
          b.textContent = `${+b.dataset.i + 1}번 서랍 (열어 봄)`;
          if (d.give) { st.give(d.give); if (d.give === 'weight') weightNote(); if (d.give === 'memo') setTimeout(() => ui().doc('memo'), 900); }
          st.save();
        }));
      },
    });
  };
  acts.scale2 = () => {
    const st = S();
    if (!st.picked.scale2w) {
      ui().talk(narr('실패한 저울 2호의 접시 위에 쇠추가 올려져 있었다. 챙기자.'), { onEnd: () => { if (st.picked.scale2w) return; st.picked.scale2w = true; st.give('weight'); weightNote(); GD.world.rebuild(); } });
    } else acts.scaleTest({ scaleNo: 2 });
  };

  /* ④ 용수철 측정대: 측정 기록 B */
  acts.springFrame = () => {
    const st = S(), w = st.count('weight');
    if (st.flag('dataB')) { endPopup(); return; }
    if (!st.has('hook')) { ui().talk(narr('용수철 측정대다. 용수철 아래 갈고리가 빠져 있어서 추를 매달 수 없다. 갈고리를 찾아보자.')); return; }
    if (w < 5) { ui().talk(narr(`갈고리는 끼웠다. 그런데 쇠추가 ${w}개뿐이다. 다섯 개가 다 있어야 0개부터 5개까지 재 볼 수 있다.`)); return; }
    if (!st.flag('springIntro')) {
      st.set('springIntro');
      ui().talk([
        { who: 'gray', face: 'think', text: '추 하나일 때의 예측은 고민했다. 그러나 우체국에는 가벼운 편지도, 무거운 소포도 온다.' },
        { who: 'gray', face: 'puzzled', text: '추의 무게를 바꾸면 길이도 달라지겠지. 추를 0개부터 5개까지 매달아 재 보자.' },
      ], { bg: 'scenes/workshop-front.png', memory: true, onEnd: springPopup });
      return;
    }
    springPopup();
  };
  function springPopup() {
    let n = 0;
    const rec = [true, false, false, false, false, false];
    ui().popup({
      puzzle: true, title: '용수철 측정대 — 추를 하나씩 달아 길이 재기',
      html: `<div class="cols">
          <svg id="spSvg" viewBox="520 40 700 640" style="width:100%;border-radius:14px;border:3px solid #4a2f20;background:#1f3b36" role="img" aria-label="용수철 측정대 확대 그림"></svg>
          <div class="card">
            <h3>측정 기록 B</h3>
            <div id="recTbl"></div>
            <div class="pan-btns" style="margin:12px 0;justify-content:flex-start">
              <button type="button" class="btn" id="addW">＋ 추 달기</button>
              <button type="button" class="btn ghost" style="color:#1d2a2c;border-color:#4a2f20" id="subW">－ 추 빼기</button>
            </div>
            <p id="spTxt" style="font-weight:800"></p>
            <button type="button" class="btn" id="doneB" hidden>측정 기록 B로 정리한다</button>
          </div>
        </div>`,
      onMount(body, close) {
        const svg = body.querySelector('#spSvg'), tbl = body.querySelector('#recTbl'), txt = body.querySelector('#spTxt');
        const draw = () => {
          const L = DB()[n], top = 178, len = 90 + (L - 10) * 12, bot = top + len;
          let s = `<image href="${A('closeups/spring-stage.png')}" x="0" y="0" width="1672" height="941"/>`;
          s += `<image href="${A('props/spring-coil.png')}" x="806" y="${top}" width="60" height="${len}" preserveAspectRatio="none"/>`;
          s += `<image href="${A('props/spring-hook.png')}" x="806" y="${bot - 6}" width="60" height="60"/>`;
          for (let i = 0; i < n; i++) s += `<image href="${A('props/hang-weight.png')}" x="801" y="${bot + 36 + i * 33}" width="70" height="70"/>`;
          s += `<line x1="866" y1="${bot}" x2="958" y2="${bot}" stroke="#c2472d" stroke-width="6"/><path d="M958 ${bot} l-16 -10 l0 20 Z" fill="#c2472d"/>`;
          s += `<rect x="990" y="${bot - 32}" width="210" height="64" rx="32" fill="#fde1d8" stroke="#1d2a2c" stroke-width="4"/><text x="1095" y="${bot + 14}" font-size="40" font-weight="900" text-anchor="middle" fill="#c2472d">${L} cm</text>`;
          svg.innerHTML = s;
          tbl.innerHTML = `<table class="rec"><tr><th>추</th>${DB().map((_, i) => `<th>${i}개</th>`).join('')}</tr><tr><th>길이(cm)</th>${DB().map((v, i) => `<td class="${i === n ? 'new' : ''}">${rec[i] ? v : '?'}</td>`).join('')}</tr></table>`;
          txt.textContent = `지금 추 ${n}개 → 바늘이 ${L} cm를 가리킨다.` + (n === 0 ? ' 추를 하나도 달지 않았을 때의 길이도 중요한 기록이다.' : '');
          const all = rec.every((r) => r);
          body.querySelector('#doneB').hidden = !all;
          if (all) txt.textContent += ' 모든 칸을 채웠다!';
        };
        body.querySelector('#addW').addEventListener('click', () => { if (n < 5) { n++; rec[n] = true; draw(); } });
        body.querySelector('#subW').addEventListener('click', () => { if (n > 0) { n--; draw(); } });
        body.querySelector('#doneB').addEventListener('click', () => { close(); gotDataB(); });
        draw();
      },
    });
  }
  function gotDataB() {
    const st = S();
    st.set('dataB');
    st.give('dataB');
    st.addNote('B');
    ui().talk([
      { who: 'gray', face: 'eureka', text: '추가 하나 늘 때마다 길이도 늘어난다. 추 0개일 때는 10센티미터.' },
      { who: 'gray', face: 'think', text: '추의 무게를 바꾸니 예측도 달라져야 한다. 하나의 숫자로는 부족하다.' },
      { who: 'gray', face: 'smile', text: '점들은 대체로 한 줄로 늘어선다. 이 줄을 하나의 규칙으로 쓸 수 있을까?' },
      { who: 'narr', text: '측정 기록 B를 얻었다!' },
    ], { bg: 'scenes/workshop-front.png', memory: true, onEnd: endPopup });
  }
  function endPopup() {
    ui().popup({
      title: '1부 완료 — 측정 기록을 모두 모았다',
      html: `<div class="card"><h3>측정 기록 A — 같은 추 1개를 다섯 번</h3>${ui().tableHTML('A')}
          <p>평균(예측값) 120 · 오차의 합은 0(양수와 음수가 지워짐) · 오차를 정사각형으로 바꾼 넓이의 평균 5.2 · 넓이 평균이 가장 작은 기준값 = 평균 120</p></div>
        <div class="card" style="margin-top:12px"><h3>측정 기록 B — 추 0~5개</h3>${ui().tableHTML('B')}
          <p>추가 늘수록 길이도 늘어난다. 예측이 '하나의 수'에서 '규칙(직선)'으로 바뀌어야 한다.</p></div>
        <div class="card" style="margin-top:12px"><h3>2부 — 규칙을 찾아서</h3>
          <p>추를 몇 개 다느냐에 따라 길이가 달라진다. 이제 예측은 '하나의 수'가 아니라 <b>점들을 지나는 직선</b>이어야 한다. 어떤 직선이 가장 좋은지 찾아, 눈금판을 완성하자.</p>
          <p><b>길잡이</b> · 작업실 좌표 칠판(작업 일정판) → 뒷벽 선반의 책 → 두루마리 통 → 나선 계단 → 기계실의 예측 기계 → 발코니</p>
          <p style="opacity:.8">수업을 여기서 마쳐도 괜찮아요. 진행은 이 기기에 자동 저장되고, 다음 시간에 타이틀의 「이어서 하기」로 계속할 수 있어요.</p></div>
        <div class="pan-btns" style="margin-top:12px"><button type="button" class="btn" id="endOk">2부 시작하기</button><button type="button" class="btn ghost" id="endLater">나중에 이어서 하기</button></div>`,
      onMount(body, close) {
        body.querySelector('#endOk').addEventListener('click', () => { close(); part2Opening(); });
        body.querySelector('#endLater').addEventListener('click', () => { close(); S().save(); ui().toast('진행을 저장했다. 다음에 「이어서 하기」로 2부를 시작하자'); });
      },
    });
  }

  // 2부 여는 장면: 박사의 짧은 독백 → 첫 할 일(좌표 칠판) 안내
  function part2Opening() {
    const st = S();
    st.set('part2Started');
    ui().talk([
      { who: 'narr', text: '— 2부 · 규칙을 찾아서 —' },
      { who: 'gray', face: 'think', text: '1부에서 찾은 것: 같은 추라면 평균 120이 가장 덜 틀리는 예측이었다. 틀린 정도는 오차 제곱의 평균으로 잰다.' },
      { who: 'gray', face: 'puzzled', text: '그런데 추를 0개에서 5개로 바꾸니 길이가 10에서 20까지 달라졌다. 숫자 하나로는 모든 무게를 예측할 수 없다.' },
      { who: 'gray', face: 'smile', text: '작업실 벽의 좌표 칠판에 그 기록을 점으로 찍어 두었다. 점들은 대체로 한 줄로 늘어선다.' },
      { who: 'me', text: '작업실 뒷벽의 작업 일정판… 저게 좌표 칠판이구나. 거기로 가서 점들을 지나는 직선을 고민해 봐야겠어.' },
    ], { bg: 'scenes/workshop-front.png', memory: true });
  }

  GD.part2Opening = part2Opening;
  GD.acts = acts;
})(window);
