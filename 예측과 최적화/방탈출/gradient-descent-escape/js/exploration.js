/* 선택 탐색: 가구를 열고, 책을 고르고, 기구를 비교한다. 1부 필수 미션의 보상·조건은 바꾸지 않는다. */
(function (root) {
  'use strict';
  const GD = root.GD, acts = GD.acts, A = GD.assets.url, ui = GD.ui, st = GD.state;
  const image = (path, alt, cls = '') => `<img class="inspect-art ${cls}" src="${A(path)}" alt="${ui.esc(alt)}">`;

  acts.clock = () => ui.popup({
    title: '멈춘 괘종시계', narrow: true,
    html: `<div class="inspect-split">${image('furniture/grandfather-clock.png', '괘종시계')}<div><p class="clock-time">3 : 47</p><p>신문에 적힌 시각과 같다. 바늘도 진자도 멈췄다.</p><button type="button" class="btn" id="windClock">태엽 손잡이 돌려보기</button><p id="clockReply" role="status"></p></div></div>`,
    onMount(body) { body.querySelector('#windClock').onclick = () => { st.set('clockChecked'); body.querySelector('#clockReply').textContent = '찰칵. 태엽은 감겼지만 시계는 움직이지 않는다. 박사가 남긴 눈금판을 완성해야 할 것 같다.'; }; },
  });

  acts.bench = () => ui.popup({
    title: '나무 벤치', narrow: true,
    html: `${image('furniture/bench.png', '낮은 나무 벤치', 'wide-art')}<div class="pan-btns"><button type="button" class="btn" id="sitBench">잠깐 앉아 쉰다</button><button type="button" class="btn ghost" id="underBench">벤치 밑을 살핀다</button></div><p id="benchReply" role="status">오래된 나무가 삐걱거린다.</p>`,
    onMount(body) {
      body.querySelector('#sitBench').onclick = () => { st.set('benchRested'); body.querySelector('#benchReply').textContent = st.flag('talkedCog') ? '잠깐 숨을 돌렸다. 막히면 코그에게 다시 물어봐도 좋겠다.' : '앉아서 둘러보니 작은 자동인형이 눈에 들어온다. 먼저 말을 걸어 보자.'; };
      body.querySelector('#underBench').onclick = () => { body.querySelector('#benchReply').textContent = '벤치 밑에는 먼지뿐이다. 대신 바닥에 떨어진 신문 조각이 눈에 띈다.'; };
    },
  });

  const pages = [
    ['같은 것을 여러 번 재기', '같은 추를 매달아도 측정값은 조금씩 다를 수 있다. 한 번의 측정만 보고 결정하지 말자.'],
    ['측정 기록', '쪽지를 모아 나란히 놓으면 흩어져 있을 때 보이지 않던 차이가 보인다.'],
    ['여러 값을 대표하는 수', '가장 큰 값이나 가장 작은 값 하나만 고르면 한쪽으로 치우친다.'],
    ['균형점', '수직선에서 어떤 점을 기준으로 삼으면 양쪽의 차이가 균형을 이룰까?'],
    ['예측과 실제', '예측값과 측정값은 서로 다른 역할을 한다. 둘 사이의 차이를 따로 기록하자.'],
    ['오차의 방향', '예측보다 길면 양수, 예측보다 짧으면 음수. 방향까지 기억하는 차이다.'],
    ['양수와 음수', '서로 다른 방향의 차이는 더했을 때 지워질 수 있다.'],
    ['천칭', '천칭이 수평이라고 해서 모든 토큰이 0인 것은 아니다.'],
    ['추의 개수', '추를 하나 더 매달면 용수철 길이는 어떻게 달라질까?'],
    ['아무것도 매달지 않았을 때', '추 0개일 때의 길이도 중요한 측정 기록이다.'],
    ['도구 점검', '녹슨 용수철과 삐뚤어진 기둥. 계산하기 전에 도구 상태도 확인하자.'],
    ['기록의 순서', '책은 언제나 왼쪽부터 센다. 열네 권이 한 줄로 꽂혀 있다.'],
    ['그레이의 메모', '원래 기록을 지우지 말 것. 실패한 예측도 다음 연구의 단서가 된다.'],
    ['다음 연구', '마지막 장은 비어 있다. 박사의 고민은 아직 끝나지 않았다.'],
  ];
  function books() {
    ui.popup({ title: '책 열네 권 — 한 권씩 꺼내 보기',
      html: `<p>책등에는 제목이 없다. 안쪽 첫 장을 펼쳐 보자.</p><div class="book-picker">${pages.map((p, i) => `<button type="button" data-book="${i}" aria-label="왼쪽에서 ${i + 1}번째 책"><img src="${A(`furniture/books/book-${String(i + 1).padStart(2, '0')}.png`)}" alt=""><span>${i + 1}</span></button>`).join('')}</div><div class="paper book-page" role="status"><b>책을 골라 보자.</b><p>다 읽은 책은 제자리에 꽂아 둔다.</p></div>`,
      onMount(body) { body.querySelectorAll('[data-book]').forEach((b) => { b.onclick = () => {
        body.querySelectorAll('[data-book]').forEach((x) => { x.classList.remove('selected'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('selected'); b.setAttribute('aria-pressed', 'true');
        const p = pages[Number(b.dataset.book)]; body.querySelector('.book-page').innerHTML = `<b>${ui.esc(p[0])}</b><p>${ui.esc(p[1])}</p>`;
      }; }); },
    });
  }
  acts.books = books;
  acts.bookcase = books;

  acts.oldSpring = () => ui.popup({
    title: '버려진 용수철 측정대', narrow: true,
    html: `<div class="apparatus-compare">${image('props/old-spring-stand.png', '녹슬고 늘어진 낡은 측정대')}<div class="clean-stand" hidden>${image('furniture/spring-stage.png', '작업실의 새 측정대')}<img class="clean-coil" src="${A('props/spring-coil.png')}" alt="반듯한 용수철"></div></div><div class="pan-btns"><button type="button" class="btn" id="compareStand">작업실 측정대와 비교</button></div><p id="standReply" role="status">녹이 슬고 용수철 간격도 고르지 않다. 더 이상 측정에 쓰지 않는 도구다.</p>`,
    onMount(body) { let clean = false; body.querySelector('#compareStand').onclick = () => { clean = !clean; body.querySelector('.apparatus-compare > img').hidden = clean; body.querySelector('.clean-stand').hidden = !clean; body.querySelector('#compareStand').textContent = clean ? '낡은 측정대로 돌아가기' : '작업실 측정대와 비교'; body.querySelector('#standReply').textContent = clean ? '작업실에는 기둥이 반듯한 측정대가 있다. 갈고리와 추를 찾아 거기에서 재자.' : '녹이 슬고 용수철 간격도 고르지 않다. 더 이상 측정에 쓰지 않는 도구다.'; }; },
  });

  function cabinet({ title, flag, closed, open, description, compartments = false }) {
    const draw = (body) => {
      const opened = st.flag(flag);
      body.innerHTML = `<div class="closeup" style="background-image:url('${A(opened ? open : closed)}')"></div><div class="pan-btns inspect-buttons"><button type="button" class="btn" id="toggleCabinet">${opened ? '닫기' : '열어 보기'}</button>${opened && compartments ? Array.from({ length: 6 }, (_, i) => `<button type="button" class="btn ghost" data-slot="${i + 1}">${i + 1}번 칸</button>`).join('') : ''}</div><p id="cabinetReply" role="status">${opened ? description : '작은 손잡이가 달려 있다.'}</p>`;
      body.querySelector('#toggleCabinet').onclick = () => { st.set(flag, !opened); GD.world.rebuild(); draw(body); body.querySelector('#toggleCabinet').focus(); };
      body.querySelectorAll('[data-slot]').forEach((b) => { b.onclick = () => { body.querySelector('#cabinetReply').textContent = `${b.dataset.slot}번 칸은 비어 있다. 톱니를 분류하던 작은 칸인 것 같다.`; }; });
    };
    ui.popup({ title, narrow: true, onMount: draw });
  }
  acts.globe = () => cabinet({ title: '지구본 받침의 작은 서랍', flag: 'globeOpen', closed: 'closeups/globe-closed.png', open: 'closeups/globe-open.png', description: '서랍은 비어 있다. 나무 안쪽에 오래된 소금 자국이 보인다. 항구에서 가져온 물건일까?' });
  acts.gearbox = () => cabinet({ title: '부품 정리 상자', flag: 'gearboxOpen', closed: 'closeups/gearbox-closed.png', open: 'closeups/gearbox-open.png', description: '작은 칸이 여섯 개다. 한 칸씩 살펴볼 수 있다.', compartments: true });
  acts.dome = () => ui.popup({
    title: '유리 돔', narrow: true,
    html: `<div class="closeup" style="background-image:url('${A('closeups/dome-closed.png')}')"></div><button type="button" class="btn inspect-buttons" id="wipeDome">유리 표면을 닦아 본다</button><p id="domeReply" role="status">먼지가 앉아 안이 잘 보이지 않는다.</p>`,
    onMount(body) { body.querySelector('#wipeDome').onclick = () => { body.querySelector('#domeReply').textContent = '받침대는 비어 있고 작은 열쇠 구멍이 보인다. 지금 가진 물건으로는 열 수 없다.'; body.querySelector('#wipeDome').disabled = true; }; },
  });
  acts.chalkboard = () => {
    const messages = st.flag('dataA') ? ['측정값\n117 · 122 · 120 · 123 · 118 mm', '예측값\n다섯 번의 측정을 대표하는 하나의 수', '오차\n실제값 − 예측값'] : ['측정\n같은 추 하나를 여러 번 달아 본다', '예측\n다음에는 얼마가 나올까?', '오차\n예측과 실제 사이의 차이'];
    ui.popup({ title: '연구 칠판', narrow: true,
      html: `<div class="chalk-surface" style="background-image:url('${A('closeups/chalkboard.png')}')"><p role="status" id="chalkWriting">박사의 지워진 연구를 정리해 보자.</p></div><div class="pan-btns inspect-buttons">${['측정', '예측', '오차'].map((x, i) => `<button type="button" class="btn ghost" data-chalk="${i}">${x} 적기</button>`).join('')}</div>`,
      onMount(body) { body.querySelectorAll('[data-chalk]').forEach((b) => { b.onclick = () => { body.querySelector('#chalkWriting').textContent = messages[Number(b.dataset.chalk)]; }; }); },
    });
  };
  acts.scroll = () => ui.popup({ title: '세 버튼이 달린 두루마리 통', narrow: true,
    html: `<div class="closeup" style="background-image:url('${A('closeups/scroll-table.png')}')"></div><div class="pan-btns inspect-buttons">${['왼쪽', '가운데', '오른쪽'].map((t, i) => `<button type="button" class="btn ghost" data-scroll="${i}" aria-pressed="false">${t} 버튼</button>`).join('')}</div><p id="scrollReply" role="status">세 버튼이 각각 움직인다. 뚜껑은 잠겨 있다.</p>`,
    onMount(body) { body.querySelectorAll('[data-scroll]').forEach((b) => { b.onclick = () => { body.querySelectorAll('[data-scroll]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); body.querySelector('#scrollReply').textContent = `${b.textContent}을 누르자 안에서 딸깍 소리가 났다. 아직 열리지는 않는다. 책을 세는 순서와 관련이 있을까?`; }; }); },
  });

  acts.scaleTest = (o) => {
    const no = o.scaleNo || 1, baseline = [-28, 8, 34][no - 1]; let loaded = false;
    ui.popup({ title: `실패한 저울 ${no}호 — 바늘 살펴보기`, narrow: true,
      html: `<div class="inspect-split"><div class="scale-test">${image('furniture/postal-scale.png', '편지 저울')}<img class="test-needle" src="${A('props/machine-needle.png')}" alt="저울 바늘" style="transform:rotate(${baseline}deg)"><img class="test-weight" src="${A('props/ref-weight-blank.png')}" alt="기준 추" hidden></div><div><p>박사가 보관해 둔 실패작이다. 같은 기준 추로 세 저울의 반응을 비교해 보자.</p><button type="button" class="btn" id="testScale">기준 추 올리기</button><p id="scaleReply" role="status">빈 접시인데도 바늘이 0의 위치에서 비껴나 있다.</p></div></div>`,
      onMount(body) { body.querySelector('#testScale').onclick = () => {
        loaded = !loaded; body.querySelector('.test-weight').hidden = !loaded;
        body.querySelector('.test-needle').style.transform = `rotate(${baseline + (loaded ? 38 : 0)}deg)`;
        body.querySelector('#testScale').textContent = loaded ? '기준 추 내리기' : '기준 추 올리기';
        body.querySelector('#scaleReply').textContent = loaded ? '바늘이 움직인다. 같은 추라도 다른 저울에서는 가리키는 곳이 다르다. 정확한 눈금이 필요한 이유다.' : '추를 내려도 비뚤어진 시작 위치로 돌아온다. 먼저 영점을 맞춰야 한다.';
      }; },
    });
  };

  const wardrobe = (title, flag) => cabinet({ title, flag, closed: 'closeups/wardrobe-closed.png', open: 'closeups/wardrobe-open.png', description: '외투와 오래된 작업복이 걸려 있다. 주머니에는 잊고 간 연필 조각과 먼지뿐이다.' });
  acts.hallWardrobe = () => wardrobe('현관의 외투 보관장', 'hallWardrobeOpen');
  acts.storageWardrobe = () => wardrobe('덮개와 낡은 옷 보관장', 'storageWardrobeOpen');
  acts.toolWardrobe = () => wardrobe('작업복 보관장', 'toolWardrobeOpen');
  acts.packingBox = (o) => cabinet({ title: o.name, flag: o.on, closed: 'closeups/trunk-closed.png', open: 'closeups/trunk-open.png', description: o.id === 'workCrate' ? '못 쓰게 된 부품과 포장지가 들어 있다. 필요한 쇠추는 다른 곳에서 찾아야 한다.' : '구겨진 포장지와 빈 봉투가 들어 있다. 우체국으로 저울을 보낼 때 쓰려던 상자 같다.' });
  acts.restChair = () => ui.talk([{ who: 'narr', text: '의자에 쌓인 먼지를 털고 잠깐 앉았다. 나무가 삐걱거린다. 다시 일어나 연구소를 살펴보자.' }]);
  acts.mailTable = () => ui.popup({ title: '우편 정리대', narrow: true,
    html: `<div class="inspect-split">${image('props/letter-envelope.png', '봉인된 봉투')}<div><p>우체국에서 온 봉투와 수리 중인 회중시계가 놓여 있다.</p><button type="button" class="btn" id="turnEnvelope">봉투 뒤집어 보기</button><p id="mailReply" role="status">작은 톱니 모양의 밀랍 인장이 보인다.</p></div></div>`,
    onMount(body) { body.querySelector('#turnEnvelope').onclick = () => { body.querySelector('#mailReply').textContent = st.has('order') ? '보낸 곳은 헤일번 우체국. 게시판에서 읽은 주문서를 담았던 봉투 같다.' : '받는 이: 그레이 박사. 우체국의 부탁은 현관 게시판에 꽂혀 있다.'; }; },
  });
  acts.spareShelf = (o = {}) => ui.popup({ title: o.name || '예비 부품', narrow: true,
    html: `<p>맞물리는 모양을 살펴보고 제자리에 둔다.</p><div class="parts-picker">${['small', 'medium', 'large'].map((size, i) => `<button type="button" class="btn ghost" data-gear="${i}"><img src="${A(`props/gear-${size}.png`)}" alt="${['작은', '중간', '큰'][i]} 톱니"><span>${['작은', '중간', '큰'][i]} 톱니 돌려보기</span></button>`).join('')}</div><p role="status" id="partsReply">황동 톱니와 교체용 부품을 분류해 둔 곳이다.</p>`,
    onMount(body) { const turns = [0, 0, 0]; body.querySelectorAll('[data-gear]').forEach((b) => { b.onclick = () => { const i = +b.dataset.gear; turns[i] += 45; b.querySelector('img').style.transform = `rotate(${turns[i]}deg)`; body.querySelector('#partsReply').textContent = '손으로 돌려 보니 톱니가 매끄럽게 움직인다. 부러진 것은 보이지 않는다. 살펴본 부품은 제자리에 둔다.'; }; }); },
  });
  acts.machineInspect = () => ui.popup({ title: '미완성 예측 장치', narrow: true,
    html: `<div class="closeup" style="background-image:url('${A('closeups/machine-closeup.png')}')"></div><div class="pan-btns inspect-buttons"><button type="button" class="btn" id="inspectKnob">황동 손잡이 살피기</button><button type="button" class="btn ghost" id="inspectGearSlot">톱니 홈 살피기</button></div><p id="machineReply" role="status">눈금과 규칙을 완성하려고 만들던 장치다. 아직 부품이 빠져 있다.</p>`,
    onMount(body) {
      body.querySelector('#inspectKnob').onclick = () => { body.querySelector('#machineReply').textContent = '돌릴 수 있는 손잡이 하나와 비어 있는 축 하나가 보인다. 지금은 측정 기록부터 모아야 한다.'; };
      body.querySelector('#inspectGearSlot').onclick = () => { body.querySelector('#machineReply').textContent = '아래쪽에 톱니가 들어갈 둥근 홈이 있다. 이 장치의 연구는 다음 노트에서 이어질 것 같다.'; };
    },
  });
  acts.scalePlate = () => ui.popup({ title: '아직 새기지 않은 눈금판', narrow: true,
    html: `${image('props/scale-plate.png', '숫자가 없는 황동 눈금판', 'wide-art')}<div class="paper">${st.flag('dataB') ? '추의 개수와 길이를 모았다. 이제 이 기록에서 예측 규칙을 찾아야 눈금을 새길 수 있다.' : '눈금 선만 있고 숫자는 비어 있다. 그레이 박사는 정확히 예측한 길이를 이 판에 새기려 했던 것 같다.'}</div>`,
  });
  acts.workNotice = () => ui.popup({ title: '작업 일정판', narrow: true,
    html: '<div class="paper">다음 측정 준비\n\n□ 측정대 기둥 점검\n□ 아래 갈고리 끼우기\n□ 같은 쇠추 다섯 개 모으기\n□ 추를 달지 않은 길이부터 기록하기\n\n— 다 쓴 도구는 제자리에.</div>',
  });
  acts.artwork = (o) => ui.popup({ title: o.name, narrow: true,
    html: `<img class="wall-art-detail" src="${A(o.img)}" alt="${ui.esc(o.name)}"><p>${ui.esc(o.detail || '오래된 액자다.')}</p>`,
  });
})(window);
