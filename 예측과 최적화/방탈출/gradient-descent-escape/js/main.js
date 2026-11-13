/* 시작: 그림 미리 불러오기 → 타이틀 → 오프닝 장면 → 현관 */
(function (root) {
  'use strict';
  const GD = root.GD;
  const $ = (s) => document.querySelector(s);
  const TEACHER = new URLSearchParams(location.search).has('teacher');

  function preloadList() {
    const set = new Set(['sprites/player-sheet.png', 'sprites/cog-sheet.png']);
    // 탐험복은 저장된(없으면 기본) 색만 미리 받는다. 다른 색은 설정에서 고를 때 받는다
    let avatar = 'sage';
    try { avatar = (JSON.parse(localStorage.getItem('gd-escape-v1') || '{}').avatar) || 'sage'; } catch { /* 저장 없음 */ }
    GD.characterMotion.preloadFor(avatar).forEach(p => set.add(p));
    Object.values(GD.MAPS).forEach((m) => {
      set.add(m.img);
      m.objs.forEach((o) => { if (o.img) set.add(o.img); if (o.imgOn) set.add(o.imgOn); });
    });
    return [...set];
  }

  function hud() {
    const st = GD.state;
    const goal = st.goal(), el = $('#goalText');
    if (el.textContent !== goal) {
      // 할 일이 바뀌면 상자가 한 번 반짝이며 알려 준다(처음 표시는 제외)
      if (el.textContent) { const box = el.closest('.goal'); box.classList.remove('updated'); void box.offsetWidth; box.classList.add('updated'); if (GD.sound && GD.sound.goal) GD.sound.goal(); }
      el.textContent = goal;
    }
    $('#btnMap').hidden = !st.has('plan');
  }

  function startWorld() {
    $('#title').hidden = true;
    $('#title').style.display = 'none';
    $('#hud').hidden = false;
    const st = GD.state;
    GD.world.load(st.data.map, [st.data.x, st.data.y], st.data.dir);
    hud();
  }
  function newGame() {
    GD.state.reset();
    GD.state.data.seen.hall = true;
    $('#title').style.display = 'none';
    GD.ui.talk([
      { who: 'narr', text: '19세기 말 어느 가을, 항구 도시 헤일번.' },
      { who: 'narr', text: '비를 피할 곳을 찾던 당신 앞에, 불 꺼진 시계탑이 서 있다.' },
      { who: 'narr', text: '시계탑 시계는 3시 47분에서 멈춰 있다.' },
      { who: 'narr', text: '문이 열려 있다. 안으로 들어서는 순간—' },
      { who: 'narr', text: '쾅!' },
    ], {
      bg: './img/tower-exterior-night.png', // 분침을 문자판 안으로 고친 사본
      onEnd: () => {
        startWorld();
        setTimeout(() => GD.ui.talk([{ who: 'narr', text: '등 뒤에서 정문이 닫혔다. 현관 한쪽에 작은 놋쇠 자동인형이 서 있다.' }, { who: 'narr', text: '방향키(또는 WASD)로 걷고, 가까이 가서 F를 눌러 말을 걸어 보자. 화면을 눌러도 걸을 수 있다.' }]), 500);
      },
    });
  }

  function menu() {
    const jumps = TEACHER ? `<div class="card" style="margin-top:12px"><h3>교사용 바로 가기</h3>
      <div class="pan-btns" style="justify-content:flex-start">
        <button type="button" class="btn ghost" style="color:#1d2a2c;border-color:#4a2f20" data-j="a">측정 기록 A 직전</button>
        <button type="button" class="btn ghost" style="color:#1d2a2c;border-color:#4a2f20" data-j="err">오차 구하기 직전</button>
        <button type="button" class="btn ghost" style="color:#1d2a2c;border-color:#4a2f20" data-j="b">측정 기록 B 직전</button>
      </div></div>` : '';
    GD.ui.popup({
      title: '설정', narrow: true,
      html: `<div class="card"><h3>조작</h3><p>맵에서 방향키·WASD: 걷기 · F: 살펴보기 · Q: 같은 자리의 다른 물건(휴대폰은 「다른 물건」 버튼)<br>상호작용 화면에서 방향키: 버튼 이동 · F/Enter/Space: 선택 · Esc: 닫기<br>I: 가방 · N: 노트 · M: 평면도 · V: 소리 켜기/끄기<br>화면을 누르면 그곳까지 걸어가고, 물건을 누르면 다가가서 살펴봅니다.</p></div>
        <div class="card" style="margin-top:12px"><h3>탐험복 색</h3><div class="avatar-colors">${Object.keys(GD.characterMotion.sheets).map((id, i) => `<button type="button" data-avatar="${id}" aria-pressed="${(GD.state.data.avatar || 'sage') === id}"><span class="avatar-sample" style="background-image:url('${GD.assets.url(GD.characterMotion.sheet(id))}')"></span>${['세이지', '파랑', '빨강', '노랑'][i]}</button>`).join('')}</div></div>
        <div class="card" style="margin-top:12px"><h3>소리</h3>
          <p><button type="button" class="btn" id="menuSound" aria-pressed="${GD.sound.on}">${GD.sound.on ? '🔊 소리 끄기' : '🔈 소리 켜기'}</button></p>
          <label class="vol-row">전체 크기 <input type="range" id="volMaster" min="0" max="100" step="5" value="${Math.round(GD.sound.levels.master * 100)}"></label>
          <label class="vol-row">빗소리 <input type="range" id="volRain" min="0" max="100" step="5" value="${Math.round(GD.sound.levels.rain * 100)}"></label>
          <label class="vol-row">음악 <input type="range" id="volMusic" min="0" max="100" step="5" value="${Math.round(GD.sound.levels.music * 100)}"></label>
          <p style="font-size:14px;margin:6px 0 0">빗소리·천둥·발소리·문소리는 이 기기 안에서 만들어 내고, 음악은 audio 폴더의 두 곡을 씁니다. 교실에서는 기본으로 꺼져 있어요.</p></div>
        <div class="card" style="margin-top:12px"><h3>화면</h3><p style="margin:0 0 8px">느린 기기에서는 가벼운 화면이 더 부드러워요(초당 30장·장식 효과 줄임).</p>
          <div class="pan-btns" style="justify-content:flex-start" id="liteBtns">${[['auto', '자동'], ['on', '가벼운 화면'], ['off', '보통 화면']].map(([v, t]) => `<button type="button" class="btn ghost" style="color:#1d2a2c;border-color:#4a2f20" data-lite="${v}" aria-pressed="${GD.world.liteMode === v}">${t}</button>`).join('')}</div>
          <p style="font-size:14px;margin:6px 0 0" id="liteNow">지금: ${GD.world.lite ? '가벼운 화면' : '보통 화면'}</p></div>
        <div class="card" style="margin-top:12px"><h3>진행</h3><p>${GD.state.canSave ? '진행 상황은 이 기기 브라우저에 자동 저장됩니다.' : '이 브라우저에서는 진행 상황이 저장되지 않아요.'}</p>
        <button type="button" class="btn" id="restart">처음부터 다시</button></div>${jumps}`,
      onMount(body, close) {
        body.querySelectorAll('[data-avatar]').forEach(b => b.addEventListener('click', () => {
          GD.state.data.avatar = b.dataset.avatar; GD.state.changed();
          GD.assets.preload(GD.characterMotion.preloadFor(b.dataset.avatar));   // 처음 고른 색이면 이때 받는다
          body.querySelectorAll('[data-avatar]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        }));
        body.querySelectorAll('[data-lite]').forEach((b) => b.addEventListener('click', () => {
          GD.world.setLiteMode(b.dataset.lite);
          body.querySelectorAll('[data-lite]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          body.querySelector('#liteNow').textContent = `지금: ${GD.world.lite ? '가벼운 화면' : '보통 화면'}`;
        }));
        const sb = body.querySelector('#menuSound');
        sb.addEventListener('click', () => { GD.sound.setOn(!GD.sound.on); sb.setAttribute('aria-pressed', String(GD.sound.on)); sb.textContent = GD.sound.on ? '🔊 소리 끄기' : '🔈 소리 켜기'; });
        body.querySelector('#volMaster').addEventListener('input', (e) => GD.sound.setLevel('master', e.target.value / 100));
        body.querySelector('#volRain').addEventListener('input', (e) => GD.sound.setLevel('rain', e.target.value / 100));
        body.querySelector('#volMusic').addEventListener('input', (e) => GD.sound.setLevel('music', e.target.value / 100));
        body.querySelector('#restart').addEventListener('click', () => { if (confirm('처음부터 다시 시작할까요? 지금 진행은 지워집니다.')) { close(); GD.state.reset(); location.reload(); } });
        body.querySelectorAll('[data-j]').forEach((b) => b.addEventListener('click', () => { close(); teacherJump(b.dataset.j); }));
      },
    });
  }
  function teacherJump(j) {
    const st = GD.state, d = st.data, f = d.flags;
    Object.assign(f, { talkedCog: true, cover: true });
    ['news', 'order'].forEach((k) => { d.items[k] = 1; });
    d.notes = ['cover'];
    if (j === 'a') {
      Object.assign(f, { lampLit: true }); d.items.lamp = 1;
      d.slips = [0, 1, 2, 3]; ['slip1', 'slip2', 'slip3', 'slip4'].forEach((k) => { d.picked[k] = true; }); d.items.slip = 4;
      GD.world.teleport('measure', [21, 12], 'down');
    }
    if (j === 'err' || j === 'b') {
      Object.assign(f, { lampLit: true, dataA: true, drawerOpen: true }); d.items.lamp = 1; d.items.dataA = 1; d.items.token = 5; d.items.slip = 0;
      d.slips = [0, 1, 2, 3, 4]; ['slip1', 'slip2', 'slip3', 'slip4', 'slip5'].forEach((k) => { d.picked[k] = true; });
      d.notes = ['cover', 'A', 'drawer'];
      GD.world.teleport('measure', [11, 7], 'up');
    }
    if (j === 'b') {
      Object.assign(f, { errorsDone: true, balanceDone: true, squaresDone: true, dialOpen: true, bowlDone: true, workshopOpen: true }); d.notes.push('balance', 'squares', 'bowl');
      d.items.hook = 1; d.items.weight = 5; ['hook', 'w1', 'w2', 'scale2w', 'shelfW', 'wb3'].forEach((k) => { d.picked[k] = true; });
      d.seen.workshop = true;
      GD.world.teleport('workshop', [3, 7], 'up');
    }
    st.changed(); GD.world.rebuild();
  }

  async function boot() {
    GD.world.init();
    GD.state.onChange(hud);
    $('#btnBag').addEventListener('click', () => GD.ui.bag());
    $('#btnNotes').addEventListener('click', () => GD.ui.notes());
    $('#btnMap').addEventListener('click', () => GD.ui.plan());
    $('#btnMenu').addEventListener('click', menu);
    GD.sound.init();
    GD.sound.music('title');   // 타이틀 화면 음악(소리를 켰을 때만)
    $('#btnStart').addEventListener('click', newGame);
    $('#btnContinue').addEventListener('click', () => { if (GD.state.load()) { GD.assets.preload(GD.characterMotion.preloadFor(GD.state.data.avatar)); startWorld(); } else newGame(); });
    if (GD.state.hasSave()) $('#btnContinue').hidden = false;
    if (!GD.state.canSave) $('#saveNote').textContent = '이 브라우저에서는 진행이 저장되지 않아요(시크릿 창 등).';
    await GD.assets.preload(preloadList());
    $('#loading').classList.add('done');
    $('#btnStart').focus();
  }
  document.addEventListener('DOMContentLoaded', boot);
})(window);
