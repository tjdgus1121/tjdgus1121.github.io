/* 시나리오 미션 3~4 (측정실) — 01_시나리오.md 6장.
 *  미션 3 「지워지지 않는 오차」: 천칭에서 나온 분필 → 뒷벽 칠판에서 오차를 정사각형으로 → 넓이 평균 5.2 → 잠긴 트렁크 소수 다이얼
 *  미션 4 「가장 좋은 기준값」: 트렁크의 기준추·돔 열쇠 → 유리 돔 받침에 기준값을 바꿔 올리며 그릇 모양 그래프 → 바닥 120 → 작업실 문
 * 계산은 화면이 하고, 학생은 '정사각형으로 바꾸기', '나누어 평균 내기', '그릇의 바닥 고르기' 같은 개념 행동을 한다.
 * 기존 missions.js·exploration.js 다음에 불러와 칠판·유리 돔 반응을 미션으로 바꾼다(미션을 마친 뒤엔 원래 둘러보기 반응). */
(function (root) {
  'use strict';
  const GD = root.GD, acts = GD.acts;
  const S = () => GD.state, ui = () => GD.ui, A = (p) => GD.assets.url(p);
  const narr = (...t) => t.map((x) => ({ who: 'narr', text: x }));
  const sgn = (e) => (e > 0 ? '+' : e < 0 ? '−' : '') + Math.abs(e);
  const fmt = (v) => String(Math.round(v * 100) / 100);
  const DEV = () => GD.DATA_A.map((v) => v - 120);                       // −3, +2, 0, +3, −2
  const mse = (c) => GD.DATA_A.reduce((s, v) => s + (v - c) ** 2, 0) / GD.DATA_A.length;   // 5.2 + (c−120)²
  const BTN = 'style="color:#1d2a2c;border-color:#4a2f20"';

  Object.assign(GD.ITEMS, {
    chalk: { name: '분필', icon: 'icons/icon-chalk.png', desc: '천칭 받침의 비밀 칸에서 나온 분필. 측정실 뒷벽 칠판에 쓸 수 있다.' },
    refweight: { name: '기준추', icon: 'icons/icon-refweight.png', desc: '118 · 119 · 120 · 121 · 122가 새겨진 놋쇠 기준추 다섯 개. 유리 돔 받침에 올려 기준값을 바꿔 볼 수 있다.' },
    domeKey: { name: '유리 돔 열쇠', icon: 'icons/icon-key-dome.png', desc: '측정실 유리 돔을 여는 작은 열쇠.' },
  });
  Object.assign(GD.NOTES, {
    squares: { title: '10월 8일 밤 — 지워지지 않는 오차', body: '음수와 양수가 서로 지워진다. 그렇다면 지워지지 않게 바꿔야 한다.\n칠판에 차이마다 정사각형을 그려 보았다. 한 변이 차이인 정사각형은 음수일 수가 없다. 크게 틀린 것은 더 넓게 그려진다.\n측정이 많을수록 넓이의 합은 커지니, 측정 한 번에 얼마나 틀렸는지는 넓이의 평균으로 잰다. 5.2.' },
    bowl: { title: '10월 11일 밤 — 가장 좋은 기준값', body: '평균을 예측값으로 삼은 것은 그저 습관 아니었나?\n기준값을 119로, 121로, 118로 바꿔 가며 정사각형 넓이의 평균을 다시 쟀다.\n가장 작은 곳은 정확히 평균 120이었다. 평균은 습관이 아니라 \'가장 덜 틀리는 값\'이었다.\n그리고 그래프는 그릇 모양이다. 이 그릇의 바닥을 찾는 일이 앞으로 계속될 것 같다.' },
  });

  /* ---------- 공통: 오차 막대 → 정사각형 그리기 ---------- */
  // 가로 640 × 세로 300 칠판 좌표. 기준선 y=200, 오차 1 = 18px. 정사각형은 기준선 위로 쌓인다.
  const U = 18, BASE = 200, XS = [80, 200, 320, 440, 560];
  function chalkSVG(devs, squared, opts = {}) {
    const col = (d) => (d < 0 ? '#8ec5ff' : d > 0 ? '#ff9f8a' : '#f4f1e6');
    let g = `<line x1="20" y1="${BASE}" x2="620" y2="${BASE}" stroke="#f4f1e6" stroke-width="2" opacity=".7"/>`;
    if (opts.label) g += `<text x="20" y="28" fill="#f4f1e6" font-size="17" opacity=".85">${opts.label}</text>`;
    devs.forEach((d, i) => {
      const x = XS[i], s = Math.abs(d) * U;
      if (squared[i]) {
        if (d === 0) g += `<text x="${x}" y="${BASE - 10}" text-anchor="middle" fill="#f4f1e6" font-size="20" font-weight="700">0</text>`;
        else g += `<rect x="${x - s / 2}" y="${BASE - s}" width="${s}" height="${s}" fill="${col(d)}" fill-opacity=".22" stroke="${col(d)}" stroke-width="3"/>
          <text x="${x}" y="${BASE - s / 2 + 7}" text-anchor="middle" fill="#fff" font-size="20" font-weight="800">${fmt(d * d)}</text>`;
      } else if (d === 0) {
        g += `<circle cx="${x}" cy="${BASE}" r="5" fill="#f4f1e6"/>`;
      } else {
        const y = d > 0 ? BASE - s : BASE;
        g += `<rect x="${x - 9}" y="${y}" width="18" height="${s}" fill="${col(d)}" rx="3"/>`;
      }
      g += `<text x="${x}" y="${BASE + 76}" text-anchor="middle" fill="#f4f1e6" font-size="16">${i + 1}회 ${sgn(Math.round(d * 10) / 10)}</text>`;
    });
    return `<svg viewBox="0 0 640 290" role="img" aria-label="${opts.aria || '칠판의 오차 그림'}" style="width:100%;height:auto;display:block;background:#23382f;border:6px solid #6b4a2b;border-radius:10px">${g}</svg>`;
  }

  /* ---------- 미션 3: 칠판 ---------- */
  const baseChalkboard = acts.chalkboard;
  acts.chalkboard = (o) => {
    const st = S();
    if (!st.flag('balanceDone') || st.flag('squaresDone')) return baseChalkboard ? baseChalkboard(o) : undefined;
    if (!st.has('chalk')) { ui().talk(narr('칠판이 깨끗이 지워져 있다. 무언가 그려 보려면 분필이 있어야 한다.')); return; }
    squaresPopup();
  };
  function squaresPopup() {
    const devs = DEV(), squared = devs.map(() => false);
    ui().popup({
      puzzle: true, title: '칠판 — 지워지지 않게 기록하기',
      html: `<p>천칭에서는 오차가 서로 지워졌다. <b>한 변이 오차인 정사각형</b>으로 바꾸면 어떨까? 막대를 하나씩 눌러 정사각형으로 바꿔 보자.</p>
        <div id="sqBoard"></div>
        <div class="pan-btns" id="sqBtns">${devs.map((d, i) => `<button type="button" class="btn ghost" data-i="${i}">${i + 1}회 ${sgn(d)} → 정사각형</button>`).join('')}</div>
        <div class="feedback" id="sqFb">파란 막대는 모자란 쪽(−), 붉은 막대는 넘친 쪽(+)이다.</div>
        <div id="sqAsk"></div>`,
      onMount(body, close) {
        const board = body.querySelector('#sqBoard'), fb = body.querySelector('#sqFb'), ask = body.querySelector('#sqAsk');
        const draw = () => { board.innerHTML = chalkSVG(devs, squared, { aria: '오차 막대와 정사각형' }); };
        draw();
        body.querySelectorAll('#sqBtns [data-i]').forEach((b) => b.addEventListener('click', () => {
          const i = Number(b.dataset.i), d = devs[i];
          squared[i] = true; b.disabled = true; draw();
          fb.className = 'feedback';
          fb.textContent = d === 0 ? '오차 0은 정사각형도 0. 넓이가 없다.' : `${sgn(d)} → 한 변 ${Math.abs(d)}인 정사각형, 넓이 ${d * d}. ${d < 0 ? '음수였는데도 위로 쌓였다!' : ''}`;
          if (squared.every(Boolean)) askAverage();
        }));
        function askAverage() {
          const areas = devs.map((d) => d * d), sum = areas.reduce((a, b) => a + b, 0);
          fb.className = 'feedback ok';
          fb.textContent = `모든 정사각형이 위로 쌓였다. 더 이상 서로 지워지지 않는다! 넓이 합 = ${areas.join(' + ')} = ${sum}`;
          ask.innerHTML = `<div class="card" style="margin-top:10px"><h3>측정을 열 번 했다면, 넓이의 합은 어떻게 될까요? 측정 한 번에 얼마나 틀렸는지 비교하려면?</h3>
            <div class="pan-btns" style="justify-content:flex-start">
              <button type="button" class="btn ghost" ${BTN} data-a="sum">합 ${sum}을 그대로 쓴다</button>
              <button type="button" class="btn ghost" ${BTN} data-a="mean">측정 횟수로 나눠 평균을 낸다</button>
              <button type="button" class="btn ghost" ${BTN} data-a="max">가장 큰 넓이 하나만 쓴다</button>
            </div><div class="feedback" id="sqQ"></div></div>`;
          const q = ask.querySelector('#sqQ');
          ask.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
            const a = b.dataset.a;
            if (a === 'mean') {
              q.className = 'feedback ok';
              q.textContent = `맞아요. 넓이의 평균 = ${sum} ÷ ${areas.length} = ${fmt(sum / areas.length)}. 측정을 몇 번 하든 '한 번에 평균적으로 얼마나 틀렸는지'를 비교할 수 있어요.`;
              ask.querySelectorAll('[data-a]').forEach((x) => { x.disabled = true; });
              setTimeout(() => { close(); squaresDone(); }, 2200);
            } else if (a === 'sum') {
              q.className = 'feedback no'; q.textContent = '측정을 더 하면 합은 계속 커져요. 다섯 번 잰 것과 열 번 잰 것을 같은 잣대로 비교할 수 없어요.';
            } else {
              q.className = 'feedback no'; q.textContent = '한 번의 큰 실수만 보게 돼요. 다섯 번 모두의 틀림을 고르게 담아야 해요.';
            }
          }));
        }
      },
    });
  }
  function squaresDone() {
    const st = S();
    st.set('squaresDone'); st.take('chalk'); st.addNote('squares');
    ui().talk([
      { who: 'gray', face: 'think', text: '음수와 양수가 서로 지워진다. 그렇다면 지워지지 않게 바꿔야 한다.' },
      { who: 'gray', face: 'think', text: '한 변이 차이인 정사각형은 음수일 수가 없다. 게다가 크게 틀린 것은 더 넓게 그려진다.' },
      { who: 'gray', face: 'eureka', text: '측정 한 번에 얼마나 틀렸는지는 넓이의 평균으로 재자. 5.2.' },
      { who: 'gray', face: 'smile', text: '트렁크는 그 넓이들의 평균으로 잠가 두었다.' },
      { who: 'narr', text: '칠판에 5.2가 남았다.' },
      { who: 'me', text: '왼쪽 아래 구석에 다이얼 자물쇠가 달린 트렁크가 있었지. 이 수를 맞춰 봐야겠어.' },
    ], { bg: 'backgrounds/lab-furnished.png', memory: true });
  }

  /* ---------- 미션 3: 잠긴 트렁크 (소수 다이얼 □□.□) ---------- */
  acts.dialTrunk = () => {
    const st = S();
    if (st.flag('dialOpen')) { ui().talk(narr(st.flag('workshopOpen') ? '빈 트렁크다. 기준추와 열쇠는 이미 꺼냈다.' : '트렁크는 열려 있다. 꺼낸 기준추와 돔 열쇠로 유리 돔을 열어 보자.')); return; }
    if (!st.flag('squaresDone')) { ui().talk(narr('다이얼 자물쇠가 달린 트렁크다. 소수점이 있는 숫자(□□.□)를 맞춰야 한다. 아직 무엇을 넣어야 할지 모르겠다.')); return; }
    const w = [0, 0, 0];
    ui().popup({
      puzzle: true, title: '잠긴 트렁크 — 소수 다이얼',
      html: `<div class="cols mid"><div class="closeup" id="trImg" style="background-image:url('${A('closeups/trunk-closed.png')}')"></div><div>
        <p>칠판에 남은 수를 떠올려 다이얼을 맞추자.</p>
        <div class="lock-row"><div class="wheels">
          ${[0, 1, 2].map((k) => `${k === 2 ? '<span style="align-self:center;font:900 40px var(--font);color:#3a2410">.</span>' : ''}<div class="wheel"><button type="button" data-k="${k}" data-d="1" aria-label="${['십의 자리', '일의 자리', '소수 첫째 자리'][k]} 올리기">▲</button><output id="d${k}" aria-live="polite">0</output><button type="button" data-k="${k}" data-d="-1" aria-label="${['십의 자리', '일의 자리', '소수 첫째 자리'][k]} 내리기">▼</button></div>`).join('')}
        </div><button type="button" class="btn" id="trTry">열어 본다</button></div>
        <div class="feedback" id="trFb"></div></div></div>`,
      onMount(body, close) {
        const fb = body.querySelector('#trFb');
        body.querySelectorAll('.wheel button').forEach((b) => b.addEventListener('click', () => {
          const k = Number(b.dataset.k);
          w[k] = (w[k] + Number(b.dataset.d) + 10) % 10;
          body.querySelector('#d' + k).textContent = w[k];
          if (GD.sound && GD.sound.step) GD.sound.step();
        }));
        body.querySelector('#trTry').addEventListener('click', () => {
          const v = w[0] * 10 + w[1] + w[2] / 10;
          if (Math.abs(v - 5.2) < 1e-9) {
            fb.className = 'feedback ok'; fb.textContent = '딸깍! 다이얼이 맞았다.';
            body.querySelector('#trImg').style.backgroundImage = `url('${A('closeups/trunk-open.png')}')`;
            setTimeout(() => { close(); dialDone(); }, 1300);
            return;
          }
          fb.className = 'feedback no';
          fb.textContent = v === 26 ? '넓이의 합이에요. 측정을 더 하면 합은 계속 커져요. 측정 한 번에 평균적으로 얼마나 틀렸는지가 필요해요.'
            : v === 0 ? '아직 정사각형으로 바꾸지 않은 오차를 더한 값이네요. 칠판의 넓이를 보세요.'
              : v === 2 ? '부호만 떼고 평균 내는 방법(2)도 있어요. 하지만 박사는 크게 틀린 것을 더 무겁게 보려고 정사각형을 택했어요. 3만큼 틀리면 넓이가 9예요.'
                : '칠판에 남은 수, 넓이의 평균을 다시 떠올려 보세요.';
        });
      },
    });
  };
  function dialDone() {
    const st = S();
    st.set('dialOpen');
    st.give('refweight', 5); st.give('domeKey');
    ui().talk([
      { who: 'narr', text: '트렁크 안에 기준추 다섯 개와 작은 열쇠, 접힌 종이가 들어 있다.' },
      { who: 'gray', face: 'puzzled', text: '문득 의심이 들었다. 평균을 예측값으로 삼은 것은 그저 습관 아니었나?' },
      { who: 'gray', face: 'think', text: '기준값을 바꿔 보았다. 119로, 121로, 118로. 그때마다 정사각형 넓이의 평균을 다시 쟀다.' },
      { who: 'gray', face: 'think', text: '어느 값을 골라야 제곱한 차이의 평균이 가장 작을까? 답이 되는 추를 유리 돔 받침에 올려라.' },
      { who: 'me', text: '기준추가 다섯 개… 유리 돔으로 가서 하나씩 올려 보며 비교해 봐야겠어.' },
    ], { bg: 'backgrounds/lab-furnished.png', memory: true });
  }

  /* ---------- 미션 4: 유리 돔 — 기준값 바꿔 보기 ---------- */
  const baseDome = acts.dome;
  acts.dome = (o) => {
    const st = S();
    if (st.flag('bowlDone')) { ui().talk(narr('받침 위에 기준추 120이 놓여 있다. 그릇의 바닥은 평균이었다.')); return; }
    if (!st.has('domeKey')) return baseDome ? baseDome(o) : undefined;
    bowlPopup();
  };
  function bowlPopup() {
    const tried = new Map();   // 기준값 → 넓이 평균
    let cur = null;
    // 그래프: 가로 기준값 117.5~122.5, 세로 0~10
    const gx = (c) => 40 + (c - 117.5) * 64, gy = (v) => 230 - v * 20;
    ui().popup({
      puzzle: true, title: '유리 돔 — 가장 좋은 기준값',
      html: `<p>기준추를 받침에 올리면 그 값을 기준으로 정사각형이 다시 그려지고, <b>넓이의 평균</b>이 그래프에 점으로 찍힌다.</p>
        <div class="pan-btns" id="refBtns">${[118, 119, 120, 121, 122].map((c) => `<button type="button" class="btn ghost" data-c="${c}">기준추 ${c} 올리기</button>`).join('')}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:8px">
          <div id="bwBoard"></div>
          <svg id="bwGraph" viewBox="0 0 400 270" role="img" aria-label="기준값과 넓이 평균 그래프" style="width:100%;height:auto;background:#f6ecd6;border:3px solid #6b4a2b;border-radius:10px"></svg>
        </div>
        <div class="feedback" id="bwFb">기준추를 하나 골라 올려 보자.</div>
        <div id="bwAsk"></div>`,
      onMount(body, close) {
        const board = body.querySelector('#bwBoard'), graph = body.querySelector('#bwGraph'), fb = body.querySelector('#bwFb'), ask = body.querySelector('#bwAsk');
        const drawBoard = () => {
          if (cur === null) { board.innerHTML = chalkSVG(DEV(), DEV().map(() => false), { label: '기준값을 고르면 정사각형이 그려진다' }); return; }
          const devs = GD.DATA_A.map((v) => v - cur);
          board.innerHTML = chalkSVG(devs, devs.map(() => true), { label: `기준값 ${cur}`, aria: `기준값 ${cur}일 때 정사각형` });
        };
        const drawGraph = () => {
          let g = `<line x1="40" y1="230" x2="380" y2="230" stroke="#4a2f20" stroke-width="2"/><line x1="40" y1="20" x2="40" y2="230" stroke="#4a2f20" stroke-width="2"/>
            <text x="392" y="265" text-anchor="end" font-size="13" fill="#4a2f20">기준값 →</text><text x="48" y="16" font-size="14" fill="#4a2f20">넓이의 평균</text>`;
          [118, 119, 120, 121, 122].forEach((c) => { g += `<text x="${gx(c)}" y="246" text-anchor="middle" font-size="13" fill="#4a2f20">${c}</text>`; });
          [0, 5, 10].forEach((v) => { g += `<text x="34" y="${gy(v) + 4}" text-anchor="end" font-size="12" fill="#4a2f20">${v}</text>`; });
          if (tried.size >= 3) {   // 세 점 이상이면 그릇 모양을 점선으로
            let d = '';
            for (let c = 117.5; c <= 122.51; c += .1) d += `${d ? 'L' : 'M'}${gx(c).toFixed(1)} ${gy(Math.min(11, mse(c))).toFixed(1)} `;
            g += `<path d="${d}" fill="none" stroke="#b07f22" stroke-width="2.5" stroke-dasharray="6 5"/>`;
          }
          tried.forEach((v, c) => {
            g += `<circle cx="${gx(c)}" cy="${gy(v)}" r="${c === cur ? 8 : 6}" fill="${c === cur ? '#d4583e' : '#2f5f8f'}" stroke="#fff" stroke-width="2"/>
              <text x="${gx(c)}" y="${gy(v) - 12}" text-anchor="middle" font-size="13" font-weight="700" fill="#1d2a2c">${fmt(v)}</text>`;
          });
          graph.innerHTML = g;
        };
        drawBoard(); drawGraph();
        body.querySelectorAll('#refBtns [data-c]').forEach((b) => b.addEventListener('click', () => {
          cur = Number(b.dataset.c);
          const v = mse(cur), areas = GD.DATA_A.map((x) => (x - cur) ** 2);
          tried.set(cur, v);
          drawBoard(); drawGraph();
          fb.className = 'feedback';
          fb.textContent = `기준값 ${cur}: 넓이 ${areas.join(' + ')} = ${areas.reduce((a, c) => a + c, 0)}, 평균 ${fmt(v)}`;
          if (tried.size >= 3) showAsk();
        }));
        function showAsk() {
          if (ask.childElementCount) return;
          ask.innerHTML = `<div class="card" style="margin-top:10px"><h3>점들이 아래로 볼록한 그릇 모양이 되었다. 그릇의 바닥은 어디일까? 바닥의 추를 확정 받침에 올리자.</h3>
            <div class="pan-btns" style="justify-content:flex-start">${[118, 119, 120, 121, 122].map((c) => `<button type="button" class="btn ghost" ${BTN} data-f="${c}">${c} 확정</button>`).join('')}</div>
            <div class="feedback" id="bwQ"></div></div>`;
          const q = ask.querySelector('#bwQ');
          ask.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
            const c = Number(b.dataset.f);
            if (c === 120) {
              q.className = 'feedback ok'; q.textContent = '딸깍! 바닥은 120, 바로 평균이다. 넓이의 평균 5.2가 가장 작다.';
              ask.querySelectorAll('[data-f]').forEach((x) => { x.disabled = true; });
              setTimeout(() => { close(); bowlDone(); }, 1800);
            } else {
              q.className = 'feedback no';
              q.textContent = Math.abs(c - 120) === 1 ? `${fmt(mse(c))}예요. 120일 때(5.2)보다 커요. 양옆 점이 같은 높이라면 바닥은 그 가운데에 있겠죠?` : `${fmt(mse(c))}예요. 바닥에서 멀어질수록 빠르게 커져요.`;
            }
          }));
        }
      },
    });
  }
  function bowlDone() {
    const st = S();
    st.set('bowlDone'); st.set('workshopOpen'); st.take('refweight', 5); st.take('domeKey'); st.addNote('bowl');
    GD.world.rebuild();
    ui().talk([
      { who: 'gray', face: 'eureka', text: '제곱한 차이의 평균이 가장 작은 곳은 정확히 평균이었다.' },
      { who: 'gray', face: 'smile', text: '평균은 습관이 아니라 \'가장 덜 틀리는 값\'이었다.' },
      { who: 'gray', face: 'think', text: '그리고 그래프는 그릇 모양이다. 이 그릇의 바닥을 찾는 일이 앞으로 계속될 것 같다.' },
      { who: 'narr', text: '유리 돔 받침이 딸깍 내려앉았다. 오른쪽 위 작업실 문의 빗장이 풀리는 소리가 들린다!' },
      { who: 'me', text: '작업실이 열렸어. 박사님 고민이 거기서 이어지는 것 같아. 측정대부터 살펴봐야겠어.' },
    ], { bg: 'backgrounds/lab-furnished.png', memory: true });
  }
})(window);
