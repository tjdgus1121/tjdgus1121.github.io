/* 대화·장면(미연시)·팝업·가방·알림 */
(function (root) {
  'use strict';
  const GD = root.GD;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const A = (p) => GD.assets.url(p);
  const clearWorldInput = () => GD.world && GD.world.clearInput && GD.world.clearInput();
  const queueFocus = (scope) => setTimeout(() => GD.keyboard && GD.keyboard.focusInitial(scope), 30);

  /* ---------- 대화·장면 ----------
   * lines: [{ who:'gray'|'cog'|'me'|'narr', face, text, choices:[{t, fn}] }] 또는 문자열(내레이션)
   * opts: { bg, memory, onEnd } — bg 가 있으면 미연시 큰 장면, 없으면 맵 위 작은 대화 */
  const scene = { el: null, lines: [], i: 0, typing: 0, full: '', timer: 0, onEnd: null, open: false };
  function talk(lines, opts = {}) {
    const el = scene.el = $('#scene');
    scene.lines = lines.map((l) => (typeof l === 'string' ? { who: 'narr', text: l } : l));
    scene.i = 0; scene.onEnd = opts.onEnd || null; scene.open = true;
    clearWorldInput();
    el.hidden = false;
    el.classList.toggle('big', !!opts.bg);
    el.classList.toggle('small', !opts.bg);
    el.classList.toggle('memory', !!opts.memory);
    $('.scene-bg', el).style.backgroundImage = opts.bg ? `url("${A(opts.bg)}")` : '';
    show();
    queueFocus('scene');
  }
  function show() {
    const el = scene.el, l = scene.lines[scene.i];
    const who = GD.FACES[l.who] || GD.FACES.narr;
    const facePath = who.faces ? who.faces[l.face || Object.keys(who.faces)[0]] : null;
    const dlg = $('.dlg', el), ch = $('.scene-char', el), face = $('.dlg-face', el);
    $('.dlg-name', el).textContent = l.who === 'narr' ? '' : (l.name || who.name);
    const big = el.classList.contains('big');
    if (big && facePath) { ch.src = A(facePath); ch.classList.add('on'); } else ch.classList.remove('on');
    if (!big && facePath) { face.src = A(facePath); dlg.classList.add('has-face'); } else dlg.classList.remove('has-face');
    const box = $('.dlg-choices', el);
    box.innerHTML = '';
    dlg.classList.remove('choosing');
    $('#sceneKbdHint', el).hidden = true;
    scene.full = l.text;
    scene.typing = 0;
    clearInterval(scene.timer);
    const p = $('.dlg-text', el);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { p.textContent = l.text; scene.typing = l.text.length; afterType(); return; }
    p.textContent = '';
    scene.timer = setInterval(() => {
      scene.typing += 2;
      p.textContent = scene.full.slice(0, scene.typing);
      if (scene.typing >= scene.full.length) { clearInterval(scene.timer); afterType(); }
    }, 40);
  }
  function afterType() {
    const l = scene.lines[scene.i], el = scene.el;
    $('.dlg-text', el).textContent = scene.full;
    if (l.choices) {
      const box = $('.dlg-choices', el);
      $('.dlg', el).classList.add('choosing');
      l.choices.forEach((c, k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = c.t;
        b.addEventListener('click', (e) => { e.stopPropagation(); close(); if (c.fn) c.fn(); });
        box.appendChild(b);
      });
      $('#sceneKbdHint', el).hidden = false;
      queueFocus('scene');
    }
  }
  function next() {
    if (!scene.open) return;
    const l = scene.lines[scene.i];
    if (scene.typing < scene.full.length) { clearInterval(scene.timer); scene.typing = scene.full.length; afterType(); return; }
    if (l.choices) return;
    scene.i++;
    if (scene.i >= scene.lines.length) { const cb = scene.onEnd; close(); if (cb) cb(); return; }
    show();
  }
  function skip() {
    if (!scene.open) return;
    const lastChoice = scene.lines.findIndex((l, k) => k >= scene.i && l.choices);
    if (lastChoice >= 0) { scene.i = lastChoice; show(); return; }
    const cb = scene.onEnd; close(); if (cb) cb();
  }
  function close() {
    clearInterval(scene.timer);
    scene.open = false;
    if (scene.el) { scene.el.hidden = true; scene.el.className = ''; }
    clearWorldInput();
    GD.world && GD.world.focus();
  }

  /* ---------- 팝업 ---------- */
  const pop = { open: false, onClose: null };
  function popup({ title, html = '', narrow = false, onMount, onClose, noClose = false }) {
    // 다른 팝업으로 바로 바뀔 때도 이전 화면의 RAF·미디어 리스너를 정리한다.
    const previousClose = pop.onClose;
    pop.onClose = null;
    if (previousClose) previousClose();
    const el = $('#popup');
    $('#popupTitle').textContent = title;
    const body = $('.pop-body', el);
    body.innerHTML = '<p class="kbd-hint">방향키: 버튼 이동 · F: 선택 · Esc: 닫기</p>' + html;
    $('.pop-card', el).classList.toggle('narrow', narrow);
    $('.pop-close', el).hidden = noClose;
    el.hidden = false;
    $('.pop-card', el).scrollTop = 0;   // 앞 창에서 내려간 스크롤이 새 창에 남지 않게
    pop.open = true; pop.onClose = onClose || null;
    clearWorldInput();
    if (onMount) onMount(body, closePopup);
    queueFocus('popup');
  }
  function closePopup() {
    if (!pop.open) return;
    const el = $('#popup');
    el.hidden = true;
    $('.pop-body', el).innerHTML = '';
    pop.open = false;
    clearWorldInput();
    const cb = pop.onClose; pop.onClose = null;
    if (cb) cb();
    GD.world && GD.world.focus();
  }

  /* ---------- 알림 ---------- */
  function toast(text, icon) {
    const box = $('#toast');
    const d = document.createElement('div');
    d.innerHTML = (icon ? `<img src="${esc(A(icon))}" alt="">` : '') + `<span>${esc(text)}</span>`;
    box.appendChild(d);
    while (box.children.length > 2) box.firstElementChild.remove();
    setTimeout(() => d.remove(), 3200);
  }
  function pingBag() { const b = $('#btnBag'); b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); }
  // 얻은 물건 아이콘이 캐릭터 머리 위에서 가방 버튼으로 포물선을 그리며 날아간다
  function flyToBag(icon) {
    const bag = $('#btnBag');
    const from = GD.world && GD.world.playerScreen ? GD.world.playerScreen() : null;
    if (GD.sound) GD.sound.pickup();
    if (!bag || !from || !icon || matchMedia('(prefers-reduced-motion: reduce)').matches || !document.body.animate) { pingBag(); return; }
    const r = bag.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    const im = document.createElement('img');
    im.src = A(icon); im.alt = ''; im.className = 'fly-item';
    im.style.left = `${from[0]}px`; im.style.top = `${from[1]}px`;
    document.body.appendChild(im);
    const dx = tx - from[0], dy = ty - from[1];
    const anim = im.animate([
      { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%, calc(-50% - 46px)) scale(1.25)', opacity: 1, offset: .25 },
      { transform: `translate(calc(-50% + ${dx * .55}px), calc(-50% + ${dy * .55 - 60}px)) scale(1)`, opacity: 1, offset: .62 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.45)`, opacity: .2 },
    ], { duration: 850, easing: 'cubic-bezier(.3,.6,.4,1)' });
    anim.onfinish = () => { im.remove(); pingBag(); };
  }

  /* ---------- 가방·노트·자료·평면도 ---------- */
  function tableHTML(kind) {
    if (kind === 'A') return `<table class="rec"><tr><th>측정</th>${GD.DATA_A.map((_, i) => `<th>${i + 1}회</th>`).join('')}</tr><tr><th>길이(mm)</th>${GD.DATA_A.map((v) => `<td>${v}</td>`).join('')}</tr></table>`;
    return `<table class="rec"><tr><th>추 개수</th>${GD.DATA_B.map((_, i) => `<th>${i}개</th>`).join('')}</tr><tr><th>길이(cm)</th>${GD.DATA_B.map((v) => `<td>${v}</td>`).join('')}</tr></table>`;
  }
  function bag() {
    const S = GD.state, ids = Object.keys(GD.ITEMS).filter((id) => S.has(id));
    const errs = S.flag('errorsDone');
    popup({
      title: '가방', html: ids.length ? `<div class="bag-grid">${ids.map((id) => {
        const it = GD.ITEMS[id], n = S.count(id);
        const label = id === 'token' && errs ? '오차 토큰' : it.name;
        return `<button type="button" class="bag-item" data-id="${id}"><img src="${esc(A(S.icon(id)))}" alt=""><span>${esc(label)}</span>${n > 1 ? `<i class="cnt">${n}</i>` : ''}</button>`;
      }).join('')}</div><div class="bag-desc card"><p>물건을 누르면 설명이 나와요.</p></div>` : '<p>아직 가방이 비어 있다.</p>',
      onMount(body) {
        body.querySelectorAll('.bag-item').forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.id, it = GD.ITEMS[id];
          let desc = id === 'lamp' && S.flag('lampLit') ? it.descLit : it.desc;
          if (id === 'token' && errs) desc = '오차를 새긴 토큰: −3, +2, 0, +3, −2';
          let extra = it.table ? tableHTML(it.table) : '';
          if (it.doc) extra += ` <button type="button" class="btn" data-read="${it.doc}">읽기</button>`;
          const box = body.querySelector('.bag-desc');
          box.innerHTML = `<h3>${esc(it.name)}</h3><p>${esc(desc)}</p>${extra}`;
          const r = box.querySelector('[data-read]');
          if (r) r.addEventListener('click', () => doc(r.dataset.read));
        }));
      },
    });
  }
  function doc(id) {
    const d = GD.DOCS[id];
    popup({ title: d.title, narrow: true, html: `<div class="paper">${esc(d.body)}<p class="sign">${esc(d.sign || '')}</p></div>` });
  }
  function notes() {
    const S = GD.state, list = S.data.notes.map((id) => GD.NOTES[id]).filter(Boolean);
    popup({
      title: '그레이 박사의 노트', narrow: true,
      html: list.length ? `<div class="notes-list">${list.map((n) => `<div class="paper"><b>${esc(n.title)}</b>\n${esc(n.body)}</div>`).join('')}</div>` : '<p>아직 모은 노트가 없다.</p>',
    });
  }
  function plan() {
    const S = GD.state, cur = S.data.map;
    // 3×3 칸: 윗줄 = 측정실·작업실, 가운데 = 창고·현관, 아랫줄 = 정문
    const cell = (id, name, locked) => `<div class="${id === cur ? 'here' : ''} ${locked ? 'locked' : ''}">${esc(name)}${id === cur ? '<br>(지금 여기)' : ''}</div>`;
    popup({
      title: '연구소 평면도', narrow: true,
      html: `<div class="plan">${cell('', '')}${cell('balcony', '발코니', !S.flag('plateIn'))}${cell('', '')}
        ${cell('', '')}${cell('clockroom', '기계실', !S.flag('stairsOpen'))}${cell('', '')}
        ${cell('', '')}${cell('workshop', '작업실', !S.flag('workshopOpen'))}${cell('bedroom', '박사의 방', !S.flag('lampLit'))}
        ${cell('', '')}${cell('measure', '측정실')}${cell('', '')}
        ${cell('storage', '창고')}${cell('hall', '현관')}${cell('', '')}</div>
        <p>현관 위쪽 문 → 측정실 → 오른쪽 위 문 → 작업실. 작업실 오른쪽 위 → 박사의 방(등잔 필요), 왼쪽 뒷벽 철문 → 기계실 → 위쪽 문 → 발코니.</p>`,
    });
  }

  GD.ui = { talk, next, skip, close, popup, closePopup, toast, pingBag, flyToBag, bag, doc, notes, plan, tableHTML, esc,
    get busy() { return scene.open || pop.open; }, get talking() { return scene.open; }, get popupOpen() { return pop.open; } };

  // 대화창 조작
  document.addEventListener('DOMContentLoaded', () => {
    $('#scene .dlg').addEventListener('click', (e) => { if (e.target.closest('.dlg-choices, .dlg-skip')) return; next(); });
    $('#scene .dlg-next').addEventListener('click', (e) => { e.stopPropagation(); next(); });
    $('#scene .dlg-skip').addEventListener('click', (e) => { e.stopPropagation(); skip(); });
    $('#popup .pop-close').addEventListener('click', closePopup);
  });
})(window);
