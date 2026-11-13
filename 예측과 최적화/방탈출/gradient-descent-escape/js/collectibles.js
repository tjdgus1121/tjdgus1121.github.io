/* 선택 수집품. 필수 미션/엔딩 함수는 그대로 두고 원래 둘러보기를 감싼다.
 * 획득 이력 cards/parts와 진열 이력 partsPlaced를 분리해 중복 보상을 막는다. */
(function (root) {
  'use strict';
  const GD = root.GD, acts = GD.acts, st = GD.state, ui = GD.ui;
  const A = GD.assets.url, esc = ui.esc;
  const historyCards = [
    { id: 1, title: '르장드르', body: '1805년, 측정값과 예측의 차이를 제곱해 더한 값을 가장 작게 만드는 방법(최소제곱법)을 발표했다.' },
    { id: 2, title: '가우스', body: '같은 생각으로 소행성 세레스의 위치를 예측했고, 1809년에 그 방법을 발표했다.' },
    { id: 3, title: '코시', body: '1847년, 값을 조금씩 고쳐 가며 답에 다가가는 방법을 발표했다. 오늘날 경사하강법의 원형이다.' },
    { id: 4, title: '오늘의 인공지능', body: '바꿀 값이 수백만~수십억 개인 모델이 같은 방법으로 손실을 줄이며 배운다.' },
  ];
  const masterLines = [
    { who: 'narr', text: '회중시계 뚜껑 안쪽에 오래된 사진이 붙어 있다. 젊은 박사와 나이 든 시계 장인.' },
    { who: 'master', text: '엘리아스, 시계가 틀린 시각을 가리키면 어떻게 하느냐?' },
    { who: 'gray', face: 'think', text: '……얼마나 틀렸는지 재고, 나사를 조금 돌립니다.' },
    { who: 'master', text: '그래. 한 번에 맞추려 들지 마라. 크게 돌리면 지나치고, 겁내면 영영 못 맞춘다.' },
    { who: 'master', text: '틀린 만큼만, 조금씩. 그게 시계를 고치는 사람의 일이다.' },
    { who: 'gray', face: 'smile', text: '스승님, 결국 저는 그 말씀대로 했습니다.' },
    { who: 'narr', text: '회중시계의 초침이 다시 움직이기 시작했다.' },
  ];
  const regions = ['북쪽 바다', '서쪽 산맥', '헤일번 항구', '남쪽 섬들', '동쪽 평원', '얼어붙은 해협', '먼 대륙', '붉은 사막'];
  const keyShapes = [
    ['round', '둥근 머리', '●'], ['star', '별 머리', '★'], ['gear', '톱니 머리', '⚙'], ['heart', '하트 머리', '♥'], ['square', '네모 머리', '■'],
  ];
  Object.assign(GD.ITEMS, {
    keyring: { name: '열쇠 꾸러미', icon: 'icons/icon-keyring.png', desc: '둥근·별·톱니·하트·네모 머리 열쇠 다섯 개. 잠금에 새겨진 무늬와 맞춰 보자. 한 번 얻으면 계속 쓸 수 있다.' },
    magnifier: { name: '돋보기', icon: 'icons/icon-magnifier.png', desc: '작은 홈이나 글씨를 자세히 살펴볼 수 있다. 한 번 얻으면 계속 쓸 수 있다.' },
    card: { name: '역사 카드', icon: 'icons/icon-card.png', desc: '노트 부록 「이 생각을 한 사람들」에서 모은 카드를 읽을 수 있다.' },
    watchpart: { name: '회중시계 부품', icon: 'icons/icon-watchpart.png', desc: '박사의 방 진열 상자에 넣는 부품. 다섯 곳에 하나씩 흩어져 있다. 진행에 꼭 필요한 물건은 아니다.' },
  });
  GD.FACES.master = { name: '스승의 목소리' };
  GD.NOTES.master = { title: '숨은 장면 — 스승의 말', body: '틀린 만큼만, 조금씩. 회중시계에 남아 있던 스승과 박사의 기억.' };
  // 기존 문서를 지우지 않고 실제 항구 핀과 같은 지명을 단서로 덧붙인다.
  GD.DOCS.news.body += '\n\n신문 발행지: 헤일번 항구.';
  GD.DOCS.order.body += '\n\n발신지: 헤일번 항구 우체국.';

  const data = () => { st.normalizeCollections(); return st.data; };
  const owns = (kind, id) => data()[kind === 'card' ? 'cards' : 'parts'].includes(id);
  const body = () => document.querySelector('#popup .pop-body');
  const button = (id, label, extra = '') => `<button type="button" class="btn" id="${id}" ${extra}>${label}</button>`;
  const art = (path, alt) => `<img class="collectible-art" src="${esc(A(path))}" alt="${esc(alt)}">`;
  const optionalLabel = '<p class="collectible-optional">선택 탐색 · 나중에 돌아와도 괜찮아요</p>';
  const feedback = '<p class="feedback" id="collectibleFeedback" role="status" aria-live="polite"></p>';
  function message(text, wrong = false) {
    const el = body().querySelector('#collectibleFeedback');
    el.className = 'feedback' + (wrong ? ' no' : ''); el.textContent = text;
  }
  function optional(show) {
    if (st.flag('optionalCollectiblesHint')) return show();
    st.set('optionalCollectiblesHint');
    ui.talk([{ who: 'cog', text: '급하지 않으면 나중에 봐도 돼요.' }], { onEnd: show });
  }
  function award(kind, id) {
    if (owns(kind, id)) return false;
    data()[kind === 'card' ? 'cards' : 'parts'].push(id);
    st.give(kind === 'card' ? 'card' : 'watchpart');
    GD.world.rebuild();
    return true;
  }
  function takeButton(kind, id, onTaken) {
    const box = body(), selector = kind === 'card' ? '#takeHistoryCard' : '#takeWatchPart';
    const b = box.querySelector(selector);
    if (!b) return;
    b.disabled = owns(kind, id);
    b.onclick = () => {
      if (!award(kind, id)) return;
      b.disabled = true; b.textContent = '챙겼다';
      if (kind === 'card') {
        const card = historyCards[id - 1];
        message(`역사 카드 ${id}/4 — ${card.title}. 노트 부록에서 다시 읽을 수 있다.`);
      } else message(`회중시계 부품 ${id}을 챙겼다. (${data().parts.length}/5)`);
      if (onTaken) onTaken();
    };
  }
  function foundCard(id, action) {
    const card = historyCards[id - 1];
    const tray = body().querySelector('#collectibleFound');
    tray.innerHTML = `<div class="collectible-card"><h3>역사 카드 ${id} — ${esc(card.title)}</h3><p>${esc(card.body)}</p></div>${button('takeHistoryCard', '역사 카드 챙기기')}`;
    takeButton('card', id, action);
  }
  function foundPart(id) {
    body().querySelector('#collectibleFound').innerHTML = `${art(`props/watch-part-${id}.png`, `회중시계 부품 ${id}`)}${button('takeWatchPart', '회중시계 부품 챙기기')}`;
    takeButton('part', id);
  }

  // 포장재 상자의 기존 열기/닫기와 내용 반응은 그대로 실행한다.
  const basePacking = acts.packingBox;
  acts.packingBox = o => {
    if (!o || o.id !== 'packingB') return basePacking(o);
    optional(() => {
      basePacking(o);
      const box = body();
      const enhance = () => {
        box.querySelector('#toggleCabinet')?.addEventListener('click', enhance, { once: true });
        box.querySelector('#collectibleKeyring')?.remove();
        if (!st.flag(o.on)) return;
        const section = document.createElement('div'); section.id = 'collectibleKeyring'; section.className = 'collectible-extra';
        section.innerHTML = st.has('keyring') ? '<p>열쇠 꾸러미는 이미 챙겼다.</p>' : `<p>포장지 아래 열쇠 다섯 개가 묶여 있다.</p>${art('objects/pickup-keyring.png', '열쇠 꾸러미')}${button('takeKeyring', '열쇠 꾸러미 챙기기')}`;
        box.appendChild(section);
        const take = section.querySelector('#takeKeyring');
        if (take) take.onclick = () => { if (st.has('keyring')) return; st.give('keyring'); enhance(); };
      };
      enhance();
    });
  };

  acts.collectMagnifier = () => optional(() => ui.popup({ title: '책상 위 돋보기', narrow: true,
    html: `${optionalLabel}${art('objects/pickup-magnifier.png', '작은 돋보기')}<p>일기 옆에 작은 돋보기가 놓여 있다.</p>${button('takeMagnifier', st.has('magnifier') ? '이미 챙긴 돋보기' : '돋보기 챙기기', st.has('magnifier') ? 'disabled' : '')}`,
    onMount(box) { box.querySelector('#takeMagnifier').onclick = e => { if (st.has('magnifier')) return; st.give('magnifier'); st.picked.magnifier = true; st.changed(); e.target.disabled = true; e.target.textContent = '돋보기를 챙겼다'; GD.world.rebuild(); }; },
  }));

  const baseGlobe = acts.globe;
  acts.globe = o => {
    if (owns('card', 1)) return baseGlobe(o);
    optional(() => {
      let region = 0;
      ui.popup({ title: '지구본 — 항구의 핀', narrow: true, puzzle: true,
        html: `${optionalLabel}<div class="collectible-globe"><img id="collectibleGlobeArt" src="${A('closeups/globe-closed.png')}" alt="지구본과 받침"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 28c-10 0-16 7-16 15 0 11 16 25 16 25s16-14 16-25c0-8-6-15-16-15Z" fill="#e7b355" stroke="#3b281c" stroke-width="2"/><circle cx="50" cy="43" r="5" fill="#f7e4b4"/></svg></div>
          <div class="pan-btns">${button('globePrev', '◀ 돌리기')}<output id="globeRegion" class="collectible-region"></output>${button('globeNext', '돌리기 ▶')}</div><p>신문과 주문서에서 보았던 항구의 핀을 정면으로 돌려 보자.</p>${button('globeTry', '받침의 비밀칸 열어 본다')}${feedback}<div id="collectibleFound"></div>`,
        onMount(box) {
          const update = () => {
            box.querySelector('#globeRegion').textContent = `${regions[region]}${region === 2 ? ' ⚓' : ''} (${region + 1}/8)`;
            box.querySelector('.collectible-globe svg').style.transform = `translateX(${Math.sin(region * Math.PI / 4) * 14}%)`;
          };
          box.querySelector('#globePrev').onclick = () => { region = (region + 7) % 8; update(); };
          box.querySelector('#globeNext').onclick = () => { region = (region + 1) % 8; update(); };
          box.querySelector('#globeTry').onclick = () => {
            if (region !== 2) { message('받침이 꿈쩍도 않는다. 신문이나 주문서에 나온 지명을 떠올려 보자.', true); return; }
            st.flags.globeOpen = true; st.set('globeSecretOpen'); GD.world.rebuild(); box.querySelector('#collectibleGlobeArt').src = A('closeups/globe-open.png');
            message('헤일번 항구의 핀이 정면에 오자, 받침의 비밀칸이 열렸다.');
            if (GD.sound) GD.sound.door(); foundCard(1);
          };
          update();
        },
      });
    });
  };

  const baseWardrobe = acts.bedWardrobe;
  acts.bedWardrobe = o => {
    if (owns('card', 2) || st.flag('wardrobeUnlocked')) return baseWardrobe(o);
    optional(() => {
      let selected = '';
      ui.popup({ title: '박사의 옷장 — 톱니 무늬 열쇠', narrow: true, puzzle: true,
        html: `${optionalLabel}${art('closeups/wardrobe-closed.png', '톱니 무늬 잠금이 달린 옷장')}<p>열쇠 구멍 둘레에 <b>⚙ 톱니 무늬</b>가 새겨져 있다. 맞는 열쇠가 필요하다.</p>${st.has('keyring') ? `<div class="collectible-keys">${keyShapes.map(([id, label, symbol]) => `<button type="button" class="btn ghost" data-key="${id}" aria-pressed="false"><span aria-hidden="true">${symbol}</span>${label}</button>`).join('')}</div>${button('tryWardrobeKey', '고른 열쇠로 열기')}` : '<p>열쇠 꾸러미가 있으면 무늬를 맞춰 볼 수 있겠다.</p>'}${feedback}`,
        onMount(box) {
          box.querySelectorAll('[data-key]').forEach(b => b.onclick = () => { selected = b.dataset.key; box.querySelectorAll('[data-key]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
          const tryKey = box.querySelector('#tryWardrobeKey');
          if (tryKey) tryKey.onclick = () => {
            if (selected !== 'gear') { message('열쇠가 들어가지 않는다. 열쇠 구멍 둘레의 무늬를 다시 보자.', true); return; }
            st.flags.wardrobeUnlocked = true; st.flags.bedWardrobeOpen = true;
            award('card', 2); if (GD.sound) GD.sound.door(); GD.world.rebuild(); baseWardrobe(o);
          };
        },
      });
    });
  };

  function searchPopup({ title, path, description, searchId, searchLabel, kind, id, base, object }) {
    if (owns(kind, id)) {
      if (base) return base(object);
      return ui.popup({ title, narrow: true, html: `${optionalLabel}${art(path, title)}<p>이곳의 ${kind === 'card' ? '역사 카드' : '회중시계 부품'}은 이미 챙겼다.</p>` });
    }
    optional(() => ui.popup({ title, narrow: true,
      html: `${optionalLabel}${art(path, title)}<p>${esc(description)}</p>${searchId ? button(searchId, searchLabel) : ''}${feedback}<div id="collectibleFound"></div>`,
      onMount(box) {
        const reveal = () => {
          message(kind === 'card' ? '안쪽에서 작은 역사 카드를 찾았다.' : '작은 황동 부품이 보인다. 회중시계의 한 조각이다.');
          if (kind === 'card') foundCard(id); else foundPart(id);
        };
        if (searchId) box.querySelector('#' + searchId).onclick = reveal; else reveal();
      },
    }));
  }
  acts.oilCan = o => searchPopup({ title: '기계실 기름통', path: 'objects/collectible-oil-can-v1.png', description: '손잡이가 달린 오래된 기름통이다. 통 뒤에 종이 한 귀퉁이가 삐져나와 있다.', searchId: 'searchOilCan', searchLabel: '기름통 뒤를 살펴본다', kind: 'card', id: 3, object: o });
  const baseScope = acts.balconyScope || (o => ui.talk([{ who: 'narr', text: (o || GD.MAPS.balcony.objs.find(x => x.id === 'balconyScope')).say }]));
  acts.balconyScope = o => searchPopup({ title: '삼각대 망원경', path: 'furniture/telescope.png', description: '삼각대의 다리 사이에 접힌 종이가 끼어 있다.', searchId: 'searchScope', searchLabel: '다리 사이를 살펴본다', kind: 'card', id: 4, base: baseScope, object: o });
  acts.umbrellaStand = o => searchPopup({ title: '현관 우산꽂이', path: 'furniture/collectible-umbrella-stand-v1.png', description: '젖은 우산들 사이로 작은 황동 조각이 보인다.', searchId: 'searchUmbrellas', searchLabel: '우산 사이를 살펴본다', kind: 'part', id: 1, object: o });
  acts.windowWatchPart = o => searchPopup({ title: '창턱의 작은 부품', path: 'props/watch-part-2.png', description: '창턱 위에 놓인 작은 회중시계 부품이다.', kind: 'part', id: 2, object: o });
  acts.castIronStove = o => searchPopup({ title: '작업실 무쇠 난로', path: 'furniture/collectible-cast-iron-stove-v1.png', description: '불이 꺼진 차가운 난로다. 재받이 안에 황동빛 조각이 섞여 있다.', searchId: 'searchAsh', searchLabel: '차가운 재 속을 뒤져 본다', kind: 'part', id: 3, object: o });
  const baseBigGear = acts.bigGear;
  acts.bigGear = o => searchPopup({ title: '큰 톱니 아래', path: 'objects/clock-gear-big.png', description: '큰 톱니 아래 받침에 작은 부품이 걸려 있다. 톱니에 손을 대지 않고 바깥쪽 조각만 챙길 수 있겠다.', searchId: 'searchBigGear', searchLabel: '톱니 아래 받침을 살펴본다', kind: 'part', id: 5, base: baseBigGear, object: o });

  const baseDesk = acts.bedDesk || acts.diary;
  acts.bedDesk = o => optional(() => ui.popup({ title: '박사의 책상', narrow: true,
    html: `${optionalLabel}${art('furniture/desk.png', '일기와 서랍이 있는 책상')}<div class="pan-btns">${button('readDiary', '일기 읽기')}${button('openDeskDrawer', '서랍 열기')}</div>`,
    onMount(box) {
      box.querySelector('#readDiary').onclick = () => { ui.closePopup(); baseDesk(o); };
      box.querySelector('#openDeskDrawer').onclick = drawer;
    },
  }));
  function drawer() {
    ui.popup({ title: '책상 서랍 — 가짜 바닥', narrow: true, puzzle: true,
      html: `${optionalLabel}<img class="collectible-art" id="collectibleDrawerArt" src="${A(owns('part', 4) ? 'closeups/desk-drawer-bedroom-false-bottom.png' : 'closeups/desk-drawer-bedroom.png')}" alt="박사의 책상 서랍"><p>${owns('part', 4) ? '가짜 바닥 아래의 부품은 이미 챙겼다.' : st.has('magnifier') ? '돋보기로 바닥 가장자리를 자세히 살펴볼 수 있겠다.' : '서랍 바닥이 조금 높아 보인다. 자세히 볼 도구가 있으면 좋겠다.'}</p>${!owns('part', 4) && st.has('magnifier') ? button('inspectDrawer', '돋보기로 살펴본다') : ''}${feedback}<div id="collectibleFound"></div>`,
      onMount(box) {
        const inspect = box.querySelector('#inspectDrawer');
        if (!inspect) return;
        inspect.onclick = () => {
          message('바닥 가장자리에 손톱만 한 홈이 있다.');
          box.querySelector('#collectibleFound').innerHTML = button('liftFalseBottom', '홈을 들어 올린다');
          box.querySelector('#liftFalseBottom').onclick = () => {
            box.querySelector('#collectibleDrawerArt').src = A('closeups/desk-drawer-bedroom-false-bottom.png');
            st.set('falseBottomOpen'); message('가짜 바닥이 들리자, 안쪽에 숨겨 둔 부품이 보였다.'); foundPart(4);
          };
        };
      },
    });
  }

  function playMaster() {
    if (!st.flag('masterMemoryUnlocked')) return;
    ui.closePopup();
    ui.talk(masterLines, { bg: 'scenes/bedroom-front-sepia.png', memory: true, onEnd: () => st.set('masterMemorySeen') });
  }
  const baseWatchCase = acts.watchCase;
  acts.watchCase = o => optional(() => {
    let memoryTimer = 0;
    const render = () => {
      const d = data(), placed = d.partsPlaced, held = d.parts.filter(n => !placed.includes(n));
      ui.popup({ title: '회중시계 진열 상자', narrow: true,
        html: `${optionalLabel}<div class="collectible-case"><img class="collectible-case-bg" src="${A('closeups/watch-case.png')}" alt="회중시계 진열 상자">${placed.length === 5 ? `<img class="collectible-complete-watch" src="${A('props/watch-complete.png')}" alt="완성된 회중시계">` : `<div class="collectible-slots">${[1, 2, 3, 4, 5].map(n => `<div class="collectible-slot" data-part-slot="${n}" aria-label="부품 ${n}${placed.includes(n) ? ' 넣음' : ' 빈 홈'}">${placed.includes(n) ? `<img src="${A(`props/watch-part-${n}.png`)}" alt="회중시계 부품 ${n}">` : `<span>${n}</span>`}</div>`).join('')}</div>`}</div><p id="placedWatchParts">진열한 부품 ${placed.length}/5 · 가방 속 부품 ${held.length}개</p><div class="pan-btns">${button('inspectEmptyCase', '상자 둘러보기')}${placed.length === 5 ? button('replayMasterMemory', '숨은 장면 「스승의 말」 다시 보기') : button('insertWatchPart', '부품 넣기') }</div>${feedback}`,
        onMount(box) {
          box.querySelector('#inspectEmptyCase').onclick = () => {
            if (!data().partsPlaced.length) { ui.closePopup(); baseWatchCase(o); }
            else message(data().partsPlaced.length === 5 ? '다섯 조각이 맞물려 회중시계가 완성되었다. 오래된 기억을 다시 볼 수 있다.' : `다섯 홈 중 ${data().partsPlaced.length}곳에 부품이 들어 있다.`);
          };
          const replay = box.querySelector('#replayMasterMemory'); if (replay) replay.onclick = playMaster;
          const insert = box.querySelector('#insertWatchPart');
          if (insert) insert.onclick = () => {
            const now = data(), part = now.parts.find(n => !now.partsPlaced.includes(n));
            if (!part) { message('아직 넣을 부품이 없다. 발견한 부품을 챙겨 온 뒤 넣어 보자.', true); return; }
            now.partsPlaced.push(part); st.take('watchpart');
            if (GD.sound) GD.sound.door();
            if (now.partsPlaced.length === 5) {
              st.flags.masterMemoryUnlocked = true; st.addNote('master'); st.changed();
              if (GD.sound) GD.sound.goal();
              render(); memoryTimer = setTimeout(playMaster, 650);
            } else render();
          };
        },
        onClose() { clearTimeout(memoryTimer); },
      });
    };
    render();
  });

  const baseNotes = ui.notes;
  ui.notes = () => {
    baseNotes();
    const section = document.createElement('section'); section.className = 'collectible-appendix';
    section.innerHTML = `<h3>부록 — 이 생각을 한 사람들</h3><p>역사 카드 ${data().cards.length}/4 · 선택 수집품</p><div class="collectible-history">${historyCards.map(card => `<article class="collectible-card" data-history-card="${card.id}"><h4>${owns('card', card.id) ? `${card.id}. ${esc(card.title)}` : `${card.id}. ?`}</h4><p>${owns('card', card.id) ? esc(card.body) : '?'}</p></article>`).join('')}</div>${st.flag('masterMemoryUnlocked') ? button('replayMasterMemory', '숨은 장면 「스승의 말」 다시 보기') : ''}`;
    // 다시 보기 버튼 때문에 노트를 열 때마다 맨 아래로 자동 스크롤되지 않게 한다.
    const jump = document.createElement('div'); jump.className = 'inspect-buttons';
    jump.innerHTML = button('goHistoryAppendix', '부록 「이 생각을 한 사람들」 보기');
    body().prepend(jump);
    body().appendChild(section);
    jump.querySelector('button').onclick = () => {
      const heading = section.querySelector('h3'); heading.tabIndex = -1;
      heading.scrollIntoView({ block: 'start' }); heading.focus({ preventScroll: true });
    };
    section.querySelector('#replayMasterMemory')?.addEventListener('click', playMaster);
  };
  const baseRecord = acts.recordBoard;
  acts.recordBoard = o => {
    baseRecord(o);
    const summary = document.createElement('p'); summary.id = 'collectibleCounts';
    summary.textContent = `역사 카드 ${data().cards.length}/4 · 회중시계 부품 ${data().parts.length}/5`;
    body().appendChild(summary);
  };
  GD.collectibles = { historyCards, masterLines, playMaster };
})(window);
