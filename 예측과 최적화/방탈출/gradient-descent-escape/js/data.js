/* 맵·물건·아이템·문구 데이터. 좌표는 맵 그림의 픽셀(왼쪽 위 기준), 칸은 64px.
 * 게임의 최종 배치는 이 파일이다. 에셋 패키지의 layouts/*.json은 초기 시각 참고용이다.
 * w: 여백을 뺀 그림 폭, h: 종횡비로 자동 계산(stretch:true일 때만 직접 지정)
 * bottom: 바닥·탁자와 맞닿는 선. 지정하면 y를 bottom-h로 계산한다.
 *  walk: 걸을 수 있는 칸 범위 [x0, y0, x1, y1](양끝 포함)
 *  foot: 물건이 막는 칸 [x, y, 너비, 높이] — 없으면 그림 아래쪽 40%로 자동 계산, wall:true 면 막지 않음
 *  approach: 높은 선반·탁자 위 물건을 살펴볼 바닥 칸 [[x,y],…]
 *  pivot/rotation: 분리 부품의 회전 기준(0~1)과 각도. base: 함께 그릴 가구의 바닥선
 *  tint: 칠한 가구 색(캔버스 filter 문자열, 원본 그림은 그대로)
 *  portals: 이 칸으로 들어서면 다른 맵으로(need: 필요한 상태, lock: 잠겨 있을 때 문구) */
(function (root) {
  'use strict';
  const GD = root.GD;
  const { TV, TV_ON, TAPE } = GD.assets;

  GD.ITEMS = {
    news: { name: '신문 조각', icon: 'icons/icon-document.png', desc: '「시계탑 시계 또 멈춰」 기사가 실린 신문 조각.', doc: 'news' },
    order: { name: '우체국장의 주문서', icon: 'icons/icon-document.png', desc: '게시판에 꽂혀 있던 주문서.', doc: 'order' },
    matches: { name: '성냥', icon: 'icons/icon-matches.png', desc: '눅눅하지 않은 성냥갑. 등잔에 불을 붙일 수 있다.' },
    lamp: { name: '등잔', icon: 'icons/icon-lamp.png', iconLit: 'icons/icon-lamp-lit.png', desc: '기름이 든 석유 등잔.', descLit: '불이 켜진 등잔. 어두운 구석도 볼 수 있다.' },
    plan: { name: '연구소 평면도', icon: 'icons/icon-plan.png', desc: '방 배치가 그려진 평면도. 지도 버튼(M)으로 펼쳐 볼 수 있다.' },
    slip: { name: '측정 쪽지', icon: 'icons/icon-slip.png', desc: '박사가 같은 추를 매달고 잰 길이를 적은 쪽지. 다섯 장을 모으면 측정 기록이 된다.' },
    dataA: { name: '측정 기록 A', icon: 'icons/icon-document.png', desc: '같은 추 1개를 다섯 번 단 용수철 길이: 117, 122, 120, 123, 118 (mm)', table: 'A' },
    token: { name: '놋쇠 토큰', icon: 'icons/icon-token.png', desc: '숫자를 새길 수 있는 놋쇠 토큰 다섯 개.' },
    tape: { name: '비디오테이프', icon: TAPE, desc: '이름표에 「빗나간 예측 — 그레이의 연구 노트 ①」이라고 적혀 있다. 측정실의 영상 상자(TV)에 넣으면 볼 수 있다.' },
    hook: { name: '용수철 갈고리', icon: 'props/spring-hook.png', desc: '용수철 아래에 거는 갈고리. 측정대에 끼우면 추를 매달 수 있다.' },
    weight: { name: '쇠추', icon: 'icons/icon-weight.png', desc: '고리 달린 작은 쇠추. 다섯 개가 한 벌이다.' },
    memo: { name: '작업대 메모', icon: 'icons/icon-document.png', desc: '작업대 서랍에서 나온 메모.', doc: 'memo' },
    dataB: { name: '측정 기록 B', icon: 'icons/icon-document.png', desc: '추 0~5개를 단 용수철 전체 길이: 10, 12.5, 13, 16.5, 18, 20 (cm)', table: 'B' },
  };

  GD.DOCS = {
    order: { title: '우체국장의 주문서', body: '그레이 박사님께.\n다음 주 월요일까지 편지 저울 한 대를 부탁드립니다.\n지난번 저울은 같은 편지를 올릴 때마다 요금이 달라져 손님들 항의가 끊이지 않았습니다.\n추를 몇 개 올리든, 바늘이 어디를 가리킬지 정확히 새겨진 눈금판이 필요합니다.', sign: '— 헤일번 우체국장' },
    news: { title: '신문 조각', body: '「시계탑 시계 또 멈춰」\n헤일번 시계탑의 시계가 3시 47분에서 다시 멈췄다. 시민들은 아침 종 없이 눈을 떴다.\n시계탑 아래 연구소의 그레이 박사는 "눈금판이 완성되면 시계도 다시 돌 것"이라고만 말했다.', sign: '— 헤일번 소식, 10월 31일' },
    memo: { title: '작업대 메모', body: '책은 언제나 왼쪽부터 센다.\n(나중에 쓸 일이 있을 것이다.)', sign: '— E. G.' },
  };

  /* 데이터 A·B */
  GD.DATA_A = [117, 122, 120, 123, 118];
  GD.DATA_B = [10, 12.5, 13, 16.5, 18, 20];

  // w는 실제 그림 폭. 투명 여백을 뺀 종횡비와 바닥/탁자 접점을 함께 맞춘다.
  const s = (o) => {
    const crop = GD.assets.mapBounds[o.img];
    if (crop && !o.stretch) o.h = Math.round(o.w * crop[3] / crop[2]);
    if (o.bottom !== undefined) o.y = o.bottom - o.h;
    return o;
  };
  GD.MAPS = {
    hall: {
      name: '현관', img: './img/maps/hall.png', w: 16, h: 16, walk: [1, 4, 14, 14],
      portals: [
        { tiles: [[7, 3], [8, 3]], to: 'measure', at: [10, 14], dir: 'up', need: 'talkedCog', lock: '문이 잠겨 있다. 먼저 저 자동인형에게 말을 걸어 보자.' },
        { tiles: [[0, 6], [0, 7]], to: 'storage', at: [10, 4], dir: 'left' },
        { tiles: [[7, 15], [8, 15]], lock: '정문이 굳게 잠겼다. 아침 종이 울려야 열린다고 했다.', exit: 'plateIn', act: 'frontDoor' },   // 엔딩 뒤: 정문으로 나가는 마무리
      ],
      objs: [
        s({ id: 'hallRug', img: './img/props/rug-burgundy.png', x: 336, bottom: 672, w: 352, wall: true, base: -100 }),
        s({ id: 'hallHarborArt', name: '항구의 풍경화', img: './img/props/frame-harbor-painting.png', x: 830, y: 70, w: 128, wall: true, act: 'artwork', detail: '낡은 액자 속 항구는 비가 그친 뒤의 모습이다. 멀리 우체국의 둥근 지붕이 보인다.' }),
        s({ id: 'hallGrayArt', name: '그레이 박사의 초상', img: './img/props/frame-gray-portrait.png', x: 356, y: 100, w: 56, wall: true, act: 'artwork', detail: '둥근 안경과 흰 머리 한 줄. 노트에 등장하는 그레이 박사의 젊은 날 초상이다.' }),
        // 돌 아치 안쪽(x 453~571, 문턱 y 252)에 꼭 맞는 두 짝 문(tools/make-arch-door.py). 열리면 문을 치워 아치 너머 복도가 보이게 한다.
        s({ id: 'doorMeasure', img: './img/props/door-hall-arch.png', x: 453, y: 46, w: 118, h: 206, stretch: true, wall: true, z: 0, base: 252, openFlag: 'talkedCog' }),
        s({ id: 'clock', name: '괘종시계', img: 'furniture/grandfather-clock.png', x: 120, w: 56, h: 160, foot: [2, 4, 1, 1], act: 'clock', bottom: 306 }),
        s({ id: 'board', name: '게시판', img: 'furniture/record-board.png', x: 656, w: 192, h: 144, foot: [10, 4, 3, 1], act: 'board', bottom: 316 }),
        s({ id: 'orderPaper', img: 'objects/pickup-slip.png', x: 728, y: 194, w: 32, h: 32, wall: true, base: 316, z: 1 }),
        s({ id: 'bench', name: '나무 벤치', img: 'furniture/bench.png', x: 736, w: 192, h: 120, foot: [12, 13, 3, 1], act: 'bench', bottom: 860 }),
        s({ id: 'umbrellaStand', name: '현관 우산꽂이', img: 'furniture/collectible-umbrella-stand-v1.png', x: 600, bottom: 860, w: 28, foot: [9, 13, 1, 1], approach: [[9, 12], [10, 13]], act: 'umbrellaStand' }),
        s({ id: 'news', name: '바닥의 신문 조각', img: 'objects/pickup-slip.png', x: 392, y: 728, w: 32, h: 32, pickup: 'news' }),
        s({ id: 'cog', name: '자동인형 코그', npc: 'cog', tx: 5, ty: 6, act: 'cog' }),
        s({ id: 'hallBooks', name: '현관의 작은 책장', img: './img/props/bookcase-side-left.png', x: 64, bottom: 716, w: 80, foot: [1, 10, 1, 2], act: 'bookcase' }),
        s({ id: 'hallWardrobe', name: '외투 보관장', img: 'furniture/wardrobe-closed.png', imgOn: 'furniture/wardrobe-open.png', on: 'hallWardrobeOpen', x: 862, bottom: 312, w: 88, foot: [14, 4, 1, 1], act: 'hallWardrobe' }),
        s({ id: 'mailTable', name: '우편 정리대', img: './img/props/desk-side-left.png', x: 66, bottom: 872, w: 112, foot: [1, 12, 2, 2], act: 'mailTable' }),
        s({ id: 'mailEnvelope', img: 'props/letter-envelope.png', x: 92, y: 778, w: 32, h: 18, stretch: true, base: 872, z: 1, wall: true }),
        s({ id: 'mailWatch', name: '수리 중인 회중시계', img: 'props/watch-complete.png', x: 123, bottom: 808, w: 24, wall: true, base: 872, z: 1, act: 'mailTable' }),
        s({ id: 'hallChair', name: '나무 의자', img: './img/props/chair-side-right.png', x: 196, bottom: 850, w: 38, foot: [3, 13, 1, 1], act: 'restChair' }),
        s({ id: 'hallFern', name: '창가 고사리', img: './img/props/potted-fern.png', x: 594, bottom: 312, w: 56, foot: [9, 4, 1, 1], say: '창으로 들어오는 빗빛을 받은 고사리다. 화분 흙은 아직 촉촉하다.' }),
      ],
    },
    storage: {
      name: '창고', dusty: true, drip: [608, 432], img: './img/maps/storage.png', w: 12, h: 10, walk: [1, 3, 10, 9],
      portals: [{ tiles: [[11, 3], [11, 4]], to: 'hall', at: [1, 6], dir: 'right' }],
      objs: [
        // 2026-11-10 재배치: 정면 그림(보관장·선반·상자·측정대)은 뒷벽에 붙이고, 왼벽엔 옆모습 작업대+짝 의자, 가운데는 양탄자, 트렁크는 오른쪽 아래.
        // 뒷벽 바닥선 ≈ y 207. 키 큰 가구는 bottom 300(2칸 깊이), 낮은 상자는 bottom 262(벽에 등을 댄 첫 줄).
        s({ id: 'storageRug', img: './img/props/rug-burgundy.png', x: 248, bottom: 500, w: 256, wall: true, base: -100 }),
        s({ id: 'storageBlueprint', name: '벽의 오래된 기계 도면', img: './img/props/frame-clock-blueprint.png', x: 504, y: 96, w: 128, wall: true, act: 'artwork', detail: '톱니와 진자, 용수철의 연결이 그려진 도면이다. 도구를 고치면서 참고했던 것 같다.' }),
        s({ id: 'storageWardrobe', name: '덮개 보관장', img: 'furniture/wardrobe-closed.png', imgOn: 'furniture/wardrobe-open.png', on: 'storageWardrobeOpen', x: 36, bottom: 300, w: 80, foot: [1, 3, 1, 2], act: 'storageWardrobe' }),
        s({ id: 'packingA', tint: 'hue-rotate(80deg) saturate(.8)', name: '발송 대기 상자', img: 'furniture/trunk-closed.png', imgOn: 'furniture/trunk-open.png', on: 'packingBoxesOpen', x: 156, bottom: 262, w: 96, foot: [2, 3, 2, 1], act: 'packingBox' }),
        s({ id: 'shelf', name: '철제 선반', img: 'furniture/iron-shelf.png', x: 272, w: 112, h: 172, foot: [4, 3, 2, 2], act: 'shelf', bottom: 300 }),
        s({ id: 'lampShelf', name: '선반 위 등잔', img: 'furniture/lamp-unlit.png', x: 314, w: 28, h: 60, wall: true, base: 300, z: 1, approach: [[4, 5], [5, 5], [6, 3], [6, 4]], act: 'lamp', hideIf: (st) => st.has('lamp'), bottom: 244 }),
        s({ id: 'plan', name: '벽에 걸린 평면도', img: 'objects/pickup-plan.png', x: 392, y: 128, w: 40, h: 40, wall: true, pickup: 'plan' }),
        s({ id: 'packingB', tint: 'hue-rotate(-25deg) saturate(1.3)', name: '포장재 상자', img: 'furniture/trunk-closed.png', imgOn: 'furniture/trunk-open.png', on: 'packingBoxesOpen', x: 440, bottom: 262, w: 88, foot: [7, 3, 1, 1], act: 'packingBox' }),
        s({ id: 'spring', name: '낡은 용수철 측정대', img: 'props/old-spring-stand.png', x: 540, y: 190, w: 96, h: 128, foot: [8, 4, 2, 1], act: 'oldSpring', bottom: 318 }),
        s({ id: 'spareShelf', name: '예비 부품 작업대', img: './img/props/desk-side-left.png', x: 26, bottom: 560, w: 112, foot: [1, 7, 1, 2], act: 'spareShelf' }),
        s({ id: 'spareGearA', img: 'props/gear-medium.png', x: 50, bottom: 498, w: 28, wall: true, base: 560, z: 1 }),
        s({ id: 'spareGearB', img: 'props/gear-small.png', x: 86, bottom: 500, w: 22, wall: true, base: 560, z: 1 }),
        s({ id: 'storageChair', name: '먼지 쌓인 의자', img: './img/props/chair-side-right.png', x: 156, bottom: 538, w: 38, foot: [2, 8, 1, 1], act: 'restChair' }),
        s({ id: 'matches', name: '바닥의 성냥갑', img: 'objects/pickup-matches.png', x: 330, y: 432, w: 32, h: 32, pickup: 'matches' }),
        s({ id: 'sTrunk', name: '나무 트렁크', img: 'furniture/trunk-closed.png', imgOn: 'furniture/trunk-open.png', on: 'storageTrunkOpen', x: 560, w: 128, h: 100, foot: [9, 8, 2, 1], act: 'storageTrunk', bottom: 572 }),
      ],
    },
    measure: {
      name: '측정실', img: './img/maps/measure.png', w: 24, h: 16, walk: [1, 5, 22, 14],
      dark: [[1, 12, 3, 3], [20, 12, 3, 3]],
      portals: [
        { tiles: [[10, 15], [11, 15]], to: 'hall', at: [8, 4], dir: 'down' },
        { tiles: [[21, 4], [22, 4]], to: 'workshop', at: [10, 14], dir: 'up', need: 'workshopOpen', lock: '작업실 문이 잠겨 있다. 자물쇠판에 천칭 그림이 새겨져 있다.' },
      ],
      objs: [
        s({ id: 'measureRug', img: './img/props/rug-blue-ivory.png', x: 576, bottom: 528, w: 288, wall: true, base: -100 }),
        s({ id: 'measureHarborArt', name: '옛 항구의 그림', img: './img/props/frame-harbor-painting.png', x: 84, y: 84, w: 112, wall: true, approach: [[3, 5], [1, 6], [2, 6]], act: 'artwork', detail: '우체국으로 드나드는 배들이 보인다. 정확한 편지 저울이 필요했던 마을의 모습이다.' }),
        s({ id: 'measureGrayArt', name: '연구자의 초상', img: './img/props/frame-gray-portrait.png', x: 1287, y: 120, w: 52, wall: true, act: 'artwork', detail: '박사는 노트 속 모습과 같은 조끼를 입고 있다. 낡은 액자 가장자리에 먼지가 앉았다.' }),
        s({ id: 'measureBlueprint', name: '시계와 용수철 도면', img: './img/props/frame-clock-blueprint.png', x: 788, y: 136, w: 160, wall: true, act: 'artwork', detail: '용수철과 시계가 한 장에 그려져 있다. 아직 눈금과 수치는 적혀 있지 않다.' }),
        // 돌 문틀 안쪽(x 1374~1461, 문턱 y 356)에 맞춘 두 짝 문. 예전 그림은 비율 계산으로 높이가 200이 되어 아래 바닥 칸(21~22, 5)의 캐릭터를 덮었다.
        s({ id: 'doorWorkshop', img: './img/props/door-measure-workshop.png', x: 1374, y: 218, w: 88, h: 138, stretch: true, wall: true, z: 0, base: 356, openFlag: 'workshopOpen' }),
        s({ id: 'bookcase', name: '책장', img: 'furniture/bookcase.png', x: 80, w: 96, foot: [1, 5, 2, 1], act: 'bookcase', bottom: 372 }),
        s({ id: 'desk', name: '박사의 책상', img: 'furniture/desk.png', x: 608, y: 224, w: 224, h: 168, foot: [10, 5, 3, 1], act: 'desk', bottom: 392 }),
        s({ id: 'deskNotebook', name: '펼친 연구 노트', img: 'props/notebook-open.png', x: 644, y: 304, w: 56, h: 24, wall: true, base: 392, z: 1, approach: [[9, 6], [10, 6]], act: 'desk', stretch: true }),
        s({ id: 'mTrunk', tint: 'hue-rotate(190deg) saturate(.7)', name: '잠긴 트렁크', img: 'furniture/trunk-closed.png', x: 72, w: 128, h: 100, foot: [1, 11, 2, 1], act: 'dialTrunk', bottom: 744 }),   // 미션 3: 소수 다이얼 5.2 (missions2.js)
        s({ id: 'balanceTable', name: '천칭 탁자', img: 'furniture/desk.png', x: 1004, y: 454, w: 192, h: 144, foot: [16, 8, 3, 1], act: 'balance', bottom: 598 }),
        s({ id: 'balanceBase', name: '천칭', img: 'props/balance-base.png', x: 1068, y: 360, w: 64, h: 112, wall: true, base: 598, z: 1, approach: [[16, 9], [17, 9], [18, 9]], act: 'balance', bottom: 542 }),
        s({ id: 'balanceBeam', name: '천칭 가로대', img: 'props/balance-beam.png', x: 1032, y: 438, w: 136, h: 45, wall: true, z: 2, base: 598, approach: [[16, 9], [17, 9], [18, 9]], act: 'balance' }),
        s({ id: 'balancePanL', name: '천칭 왼쪽 접시', img: 'props/balance-pan.png', x: 1012, y: 445, w: 44, h: 60, wall: true, z: 3, base: 598, approach: [[16, 9], [17, 9], [18, 9]], act: 'balance' }),
        s({ id: 'balancePanR', name: '천칭 오른쪽 접시', img: 'props/balance-pan.png', x: 1144, y: 445, w: 44, h: 60, wall: true, z: 3, base: 598, approach: [[16, 9], [17, 9], [18, 9]], act: 'balance' }),
        s({ id: 'dome', name: '책상 위 유리 돔', img: 'furniture/dome-closed.png', x: 756, y: 196, w: 48, h: 64, wall: true, base: 392, z: 2, approach: [[12, 6], [13, 6]], act: 'dome', bottom: 328 }),
        s({ id: 'chalkboard', name: '연구 칠판', img: 'furniture/chalkboard.png', x: 572, y: 140, w: 192, h: 115, wall: true, act: 'chalkboard' }),
        s({ id: 'globe', name: '지구본의 작은 서랍', img: 'furniture/globe-closed.png', imgOn: 'furniture/globe-open.png', on: 'globeOpen', x: 1008, w: 64, h: 107, foot: [16, 12, 1, 1], act: 'globe', bottom: 816 }),
        s({ id: 'measureWatchPart', name: '창턱의 회중시계 부품', img: 'objects/pickup-watchpart.png', x: 1132, bottom: 248, w: 24, wall: true, base: 260, z: 2, approach: [[17, 5], [18, 5]], act: 'windowWatchPart', hideIf: st => (st.data.parts || []).includes(2) }),
        s({ id: 'tvStand', name: '영상 상자 받침장', img: './img/props/tv-stand.png', x: 320, bottom: 568, w: 128, foot: [5, 8, 2, 1], approach: [[4, 9], [5, 9], [6, 9], [7, 9]], act: 'tv' }),
        s({ id: 'tv', name: '박사의 영상 상자(TV)', img: './img/props/tv-side-right.png', x: 344, bottom: 541, w: 80, wall: true, base: 568, z: 1, approach: [[4, 9], [5, 9], [6, 9], [7, 9]], act: 'tv' }),
        s({ id: 'readingBooks', tint: 'hue-rotate(115deg) saturate(.7)', name: '측정 자료 책장', img: './img/props/bookcase-side-left.png', x: 44, bottom: 640, w: 88, foot: [1, 8, 1, 2], act: 'bookcase' }),
        s({ id: 'deskChair', name: '박사의 의자', img: './img/props/chair-back.png', x: 700, bottom: 436, w: 40, foot: [11, 6, 1, 1], act: 'restChair' }),
        s({ id: 'tvChair', name: '영상 상자 앞 의자', img: './img/props/chair-back.png', x: 356, bottom: 676, w: 40, foot: [5, 10, 1, 1], act: 'restChair' }),
        s({ id: 'precisionTable', name: '기구 진열대', img: './img/props/desk-back.png', x: 1088, bottom: 812, w: 176, foot: [17, 12, 3, 1], act: 'machineInspect' }),
        s({ id: 'prototype', name: '미완성 예측 장치', img: 'furniture/prediction-machine-base.png', x: 1120, bottom: 764, w: 80, wall: true, base: 812, z: 1, approach: [[17, 11], [18, 11], [17, 13], [18, 13]], act: 'machineInspect' }),
        s({ id: 'glassRack', name: '실험 유리병', img: './img/props/lab-glass-rack.png', x: 1208, bottom: 764, w: 48, wall: true, base: 812, z: 1, approach: [[19, 11], [19, 13], [20, 13]], say: '마개가 닫힌 유리병과 빈 플라스크다. 저울 연구에 쓰던 작은 실험 도구들이다.' }),
        s({ id: 'scalePlate', name: '미완성 눈금판', img: 'props/scale-plate.png', x: 352, y: 232, w: 144, wall: true, act: 'scalePlate' }),
        s({ id: 'telescope', name: '항구를 향한 망원경', img: 'furniture/telescope.png', x: 1412, bottom: 824, w: 64, foot: [22, 12, 1, 1], dark: true, say: '렌즈의 먼지를 닦고 들여다봤다. 비구름 너머로 항구와 우체국 지붕이 어렴풋이 보인다.' }),
        s({ id: 'emptyHourglass', name: '빈 모래시계', img: 'objects/hourglass-map.png', x: 1160, bottom: 542, w: 22, wall: true, base: 598, z: 4, approach: [[18, 9]], say: '유리 안에 모래가 없다. 이대로는 시간을 잴 수 없다.' }),
        s({ id: 'measureFern', name: '작은 화분', img: './img/props/potted-fern.png', x: 1222, bottom: 372, w: 52, foot: [19, 5, 1, 1], say: '기구 옆에서도 고사리는 자라고 있다. 박사가 돌보던 화분인 것 같다.' }),
        s({ id: 'slip1', name: '측정 쪽지', img: 'objects/pickup-slip.png', x: 870, y: 430, w: 32, h: 32, slip: 0 }),
        s({ id: 'slip2', name: '측정 쪽지', img: 'objects/pickup-slip.png', x: 520, y: 610, w: 32, h: 32, slip: 1 }),
        s({ id: 'slip3', name: '측정 쪽지', img: 'objects/pickup-slip.png', x: 900, y: 770, w: 32, h: 32, slip: 2 }),
        s({ id: 'slip4', name: '구석의 측정 쪽지', img: 'objects/pickup-slip.png', x: 112, y: 864, w: 32, h: 32, slip: 3, dark: true }),
        s({ id: 'slip5', name: '구석의 측정 쪽지', img: 'objects/pickup-slip.png', x: 1360, y: 848, w: 32, h: 32, slip: 4, dark: true }),
      ],
    },
    workshop: {
      name: '작업실', img: './img/maps/workshop.png', w: 24, h: 16, walk: [1, 6, 22, 14],
      portals: [
        { tiles: [[10, 15], [11, 15]], to: 'measure', at: [21, 5], dir: 'down' },
        { tiles: [[21, 5], [22, 5]], to: 'bedroom', at: [1, 5], dir: 'right', need: 'lampLit', lock: '박사의 방으로 이어지는 문이다. 안이 너무 어두워 들어갈 수 없다. 등잔이 있어야겠다.' },
        { tiles: [[5, 5], [6, 5]], to: 'clockroom', at: [7, 19], dir: 'up', need: 'stairsOpen', lock: '나선 계단으로 오르는 철문이 잠겨 있다. 자물쇠 대신 두루마리 무늬가 새겨져 있다.' },
      ],
      objs: [
        s({ id: 'workRug', img: './img/props/rug-blue-ivory.png', x: 512, bottom: 736, w: 320, wall: true, base: -100 }),
        s({ id: 'workBlueprint', name: '작업실의 기계 도면', img: './img/props/frame-clock-blueprint.png', x: 86, y: 96, w: 128, wall: true, approach: [[1, 6], [4, 6]], act: 'artwork', detail: '새 용수철 측정대 뒤에 걸린 도면이다. 수리할 때 빠뜨리지 말아야 할 연결부들이 보인다.' }),
        s({ id: 'workHarborArt', name: '벽에 걸린 항구 그림', img: './img/props/frame-harbor-painting.png', x: 324, y: 96, w: 144, wall: true, approach: [[4, 6], [7, 6]], act: 'artwork', detail: '박사가 일하다 고개를 들면 볼 수 있는 곳에 걸린 그림이다. 물빛과 지붕의 색이 아직 선명하다.' }),
        s({ id: 'springFrame', name: '용수철 측정대', img: 'furniture/spring-stage.png', x: 128, y: 272, w: 112, h: 150, foot: [2, 6, 2, 1], act: 'springFrame', bottom: 422 }),
        s({ id: 'springCoil', img: 'props/spring-coil.png', x: 177, y: 291, w: 14, h: 60, wall: true, base: 422, z: 1 }),
        s({ id: 'springHook', img: 'props/spring-hook.png', x: 174, y: 358, w: 20, h: 32, wall: true, base: 422, z: 2, hideIf: (st) => !st.has('hook') && !st.flag('dataB') }),
        s({ id: 'books', name: '열네 권의 책', img: 'furniture/book-row.png', x: 700, w: 280, h: 70, wall: true, approach: [[11, 6], [12, 6], [13, 6]], act: 'books', bottom: 286 }),
        s({ id: 'workbench', name: '작업대 서랍', img: './img/props/desk-side-right.png', x: 1360, w: 144, foot: [21, 10, 2, 3], act: 'workbench', bottom: 800, approach: [[20, 10], [20, 12]] }),
        s({ id: 'scroll', name: '두루마리 통', img: 'furniture/scroll-cylinder.png', x: 40, w: 96, h: 64, foot: [1, 10, 2, 1], act: 'scroll', bottom: 700 }),
        s({ id: 'gearbox', name: '부품 정리 상자', img: 'furniture/gearbox-closed.png', imgOn: 'furniture/gearbox-open.png', on: 'gearboxOpen', x: 64, w: 96, h: 96, foot: [1, 13, 2, 1], act: 'gearbox', bottom: 900 }),
        s({ id: 'scaleTable', img: 'furniture/desk.png', x: 912, y: 288, w: 256, h: 192, foot: [14,6,4,1], bottom: 480 }),
        s({ id: 'scale1', name: '실패한 저울 1호', img: 'furniture/postal-scale.png', x: 924, y: 236, w: 44, h: 84, wall: true, base: 480, z: 1, approach: [[14,7],[15,7]], act: 'scaleTest', scaleNo: 1, bottom: 400 }),
        s({ id: 'scale2', name: '실패한 저울 2호', img: 'furniture/postal-scale.png', x: 1004, y: 236, w: 44, h: 84, wall: true, base: 480, z: 1, approach: [[16,7]], act: 'scale2', scaleNo: 2, bottom: 400 }),
        s({ id: 'scale3', name: '실패한 저울 3호', img: 'furniture/postal-scale.png', x: 1084, y: 236, w: 44, h: 84, wall: true, base: 480, z: 1, approach: [[17,7],[18,7]], act: 'scaleTest', scaleNo: 3, bottom: 400 }),
        ...[[-28, 924], [8, 1004], [34, 1084]].map(([rotation, x], i) => s({ id: 'scaleNeedle' + i, img: 'props/machine-needle.png', x: x + 21, y: 366, w: 2, h: 12, stretch: true, wall: true, base: 480, z: 2, pivot: [.5, .94], rotation })),
        s({ id: 'scale2w', img: 'objects/pickup-weight.png', x: 1019, y: 220, w: 14, h: 20, wall: true, z: 3, base: 480, hideIf: (st) => st.picked.scale2w, bottom: 334 }),
        s({ id: 'hook', name: '바닥의 갈고리', img: 'props/spring-hook.png', x: 344, y: 488, w: 40, h: 40, pickup: 'hook' }),
        s({ id: 'w1', name: '쇠추', img: 'objects/pickup-weight.png', x: 1176, y: 768, w: 32, h: 32, pickup: 'weight' }),
        s({ id: 'w2', name: '쇠추', img: 'objects/pickup-weight.png', x: 380, y: 832, w: 32, h: 32, pickup: 'weight' }),
        s({ id: 'repairTable', name: '수리용 부품 탁자', img: './img/props/desk-side-left.png', x: 32, bottom: 832, w: 128, foot: [1, 11, 2, 2], act: 'spareShelf' }),
        s({ id: 'repairGear', img: 'props/gear-large.png', x: 107, bottom: 768, w: 26, wall: true, base: 832, z: 1 }),
        s({ id: 'repairGlass', img: './img/props/lab-glass-rack.png', x: 52, bottom: 741, w: 48, wall: true, base: 832, z: 1 }),
        s({ id: 'toolBooks', tint: 'hue-rotate(-20deg) saturate(1.2)', name: '공구와 기록의 책장', img: './img/props/bookcase-side-left.png', x: 32, bottom: 640, w: 80, foot: [1, 8, 1, 2], act: 'bookcase' }),
        s({ id: 'workNotice', name: '작업 일정판', img: 'furniture/chalkboard.png', x: 548, bottom: 270, w: 128, wall: true, approach: [[8, 6], [9, 6], [10, 6]], act: 'workNotice' }),
        s({ id: 'castIronStove', name: '작업실 무쇠 난로', img: 'furniture/collectible-cast-iron-stove-v1.png', x: 474, bottom: 398, w: 64, wall: true, base: 398, approach: [[7, 6], [8, 6]], act: 'castIronStove' }),
        s({ id: 'workNotebook', name: '작업대의 기록', img: 'props/notebook-open.png', x: 1402, y: 652, w: 40, h: 20, stretch: true, wall: true, base: 800, z: 1, approach: [[20, 10], [20, 12]], act: 'workbench' }),
        s({ id: 'workChair', name: '작업 의자', img: './img/props/chair-side-right.png', x: 176, bottom: 800, w: 38, foot: [3, 12, 1, 1], act: 'restChair' }),
        s({ id: 'benchChair', name: '작업대 의자', img: './img/props/chair-side-left.png', x: 1300, bottom: 772, w: 38, foot: [20, 11, 1, 1], act: 'restChair' }),
        s({ id: 'toolWardrobe', name: '작업복 보관장', img: 'furniture/wardrobe-closed.png', imgOn: 'furniture/wardrobe-open.png', on: 'toolWardrobeOpen', x: 1180, bottom: 410, w: 88, foot: [18, 6, 2, 1], act: 'toolWardrobe' }),
        // 미션 6을 풀면 열리는 나선 계단 철문(기둥 사이 뒷벽) → 기계실
        // 계단 출입구: 박사의 방 출입구와 같은 돌 테두리 홈(tools/make-stairs-alcove.py)을 벽에 박고, 철문은 그 안쪽 입구(x 342~441)에 맞춘다
        s({ id: 'stairsAlcove', img: './img/props/stairs-alcove.png', x: 316, y: 264, w: 149, h: 203, stretch: true, wall: true, base: 300 }),
        s({ id: 'stairsGate', name: '나선 계단 철문', img: 'objects/gate-stairs-closed.png', imgOn: 'objects/gate-stairs-open.png', on: 'stairsOpen', x: 342, bottom: 459, w: 99, wall: true, base: 400, approach: [[5, 6], [6, 6]], act: 'stairsGate', label: (st) => st.flag('stairsOpen') && '기계실로 이동하기' }),
        s({ id: 'workCrate', tint: 'hue-rotate(-25deg) saturate(1.35)', name: '폐부품 상자', img: 'furniture/trunk-closed.png', imgOn: 'furniture/trunk-open.png', on: 'workCrateOpen', x: 1360, bottom: 896, w: 128, foot: [21, 13, 2, 1], act: 'packingBox' }),
      ],
    },
    // ---------- 2부: 박사의 방 · 기계실 · 발코니 (시나리오 4-1 맵 2-1·3·4). 원본 맵 그림을 그대로 쓴다 ----------
    bedroom: {
      name: '박사의 방', img: 'maps/map-bedroom.png', w: 12, h: 10, walk: [1, 3, 10, 9],
      portals: [{ tiles: [[0, 4], [0, 5]], to: 'workshop', at: [21, 6], dir: 'down' }],
      objs: [
        s({ id: 'bed', name: '박사의 침대', img: 'furniture/bed.png', x: 64, bottom: 604, w: 150, act: 'bed' }),
        s({ id: 'watchCase', name: '회중시계 진열 상자', img: 'furniture/watch-case.png', x: 290, bottom: 246, w: 150, wall: true, approach: [[4, 3], [5, 3], [6, 3]], act: 'watchCase' }),
        s({ id: 'bedWardrobe', name: '박사의 옷장', img: 'furniture/wardrobe-closed.png', imgOn: 'furniture/wardrobe-open.png', on: 'bedWardrobeOpen', x: 540, bottom: 336, w: 120, act: 'bedWardrobe' }),
        s({ id: 'bedDesk', name: '박사의 책상', img: 'furniture/desk.png', x: 380, bottom: 560, w: 210, act: 'bedDesk' }),
        s({ id: 'diary', name: '박사의 일기', img: 'props/notebook-open.png', x: 440, y: 470, w: 54, h: 24, stretch: true, wall: true, base: 560, z: 1, approach: [[6, 6], [7, 6], [8, 6]], act: 'diary' }),
        s({ id: 'magnifier', name: '책상 위 돋보기', img: 'objects/pickup-magnifier.png', x: 520, bottom: 494, w: 28, wall: true, base: 560, z: 2, approach: [[6, 6], [7, 6], [8, 6]], act: 'collectMagnifier', hideIf: st => st.has('magnifier') }),
        s({ id: 'bedTrunk', name: '여행 가방', img: 'furniture/trunk-closed.png', x: 590, bottom: 600, w: 120, say: '오래 쓴 여행 가방이다. 헤일번에 오기 전, 시계 장인에게 배우던 시절 쓰던 것일까.' }),
        s({ id: 'bedFern', name: '창가 화분', img: './img/props/potted-fern.png', x: 470, bottom: 250, w: 50, wall: true, say: '창가 화분이 시들지 않았다. 박사는 떠나기 전까지 물을 주었던 것 같다.' }),
      ],
    },
    clockroom: {
      name: '기계실', img: 'maps/map-clockroom.png', w: 16, h: 24, walk: [1, 7, 14, 21],
      portals: [
        { tiles: [[7, 22], [8, 22]], to: 'workshop', at: [5, 6], dir: 'down' },
        { tiles: [[7, 6], [8, 6]], to: 'balcony', at: [11, 13], dir: 'up', need: 'plateIn', lock: '발코니로 나가는 문이다. 문 한가운데에 눈금판 모양의 홈이 파여 있다.' },
      ],
      objs: [
        s({ id: 'machineDesk', name: '예측 기계', img: 'furniture/desk.png', x: 360, bottom: 866, w: 290, act: 'machine' }),
        s({ id: 'machine', name: '예측 기계', img: 'furniture/prediction-machine-base.png', x: 405, bottom: 770, w: 210, wall: true, base: 866, z: 1, approach: [[6, 14], [7, 14], [8, 14], [9, 14]], act: 'machine' }),
        s({ id: 'machineKnob', img: 'props/machine-knob.png', x: 572, bottom: 708, w: 30, wall: true, base: 866, z: 2, hideIf: (st) => !st.flag('knobIn') }),
        s({ id: 'dirBox', name: '톱니 상자', img: 'furniture/gearbox-closed.png', imgOn: 'furniture/gearbox-open.png', on: 'dirBoxOpen', x: 120, bottom: 560, w: 160, act: 'dirBox' }),
        s({ id: 'hourglass', name: '모래시계', img: 'objects/hourglass-map.png', x: 770, bottom: 540, w: 46, act: 'hourglass' }),
        s({ id: 'oilCan', name: '기계실 기름통', img: 'objects/collectible-oil-can-v1.png', x: 864, bottom: 500, w: 48, foot: [13, 7, 1, 1], approach: [[13, 8], [12, 7]], act: 'oilCan' }),
        s({ id: 'bigGear', name: '멈춘 큰 톱니', img: 'objects/clock-gear-big.png', x: 730, bottom: 860, w: 160, act: 'bigGear' }),
        s({ id: 'balconyDoor', name: '발코니 문', img: 'objects/door-balcony-closed.png', x: 452, y: 176, w: 118, h: 160, stretch: true, wall: true, z: 0, base: 336, openFlag: 'plateIn', approach: [[7, 7], [8, 7]], act: 'balconyDoor', label: (st) => st.flag('plateIn') && '발코니로 이동하기' }),
      ],
    },
    balcony: {
      name: '새벽 발코니', img: 'maps/map-balcony.png', w: 24, h: 16, walk: [1, 7, 22, 13],
      portals: [{ tiles: [[11, 14], [12, 14]], to: 'clockroom', at: [8, 7], dir: 'down' }],
      objs: [
        s({ id: 'balconyBench', name: '벤치', img: 'furniture/bench.png', x: 175, bottom: 735, w: 240, act: 'letter' }),
        s({ id: 'letter', name: '벤치 위 편지', img: 'props/letter-envelope.png', x: 268, y: 640, w: 40, h: 24, stretch: true, wall: true, base: 735, z: 1, approach: [[3, 12], [4, 12], [5, 12], [6, 12]], act: 'letter' }),
        s({ id: 'balconyScope', name: '삼각대 망원경', img: 'furniture/telescope.png', x: 720, bottom: 622, w: 110, act: 'balconyScope', say: '렌즈 너머로 우체국 지붕이 보인다. 아침 종소리에 맞춰 우체국 창문들이 하나둘 열린다.' }),
        s({ id: 'recordBoard', name: '기록판', img: 'furniture/record-board.png', x: 1120, bottom: 600, w: 210, act: 'recordBoard' }),
        s({ id: 'cogEnd', name: '자동인형 코그', npc: 'cog', tx: 16, ty: 9, act: 'cogEnd' }),
      ],
    },
  };
  GD.MAP_ORDER = ['storage', 'hall', 'measure', 'workshop', 'bedroom', 'clockroom', 'balcony'];

  /* 박사·코그 그림 */
  GD.FACES = {
    gray: { name: '그레이 박사', faces: { smile: 'characters/gray-stand-smile.png', think: 'characters/gray-stand-think.png', puzzled: 'characters/gray-stand-puzzled.png', eureka: 'characters/gray-stand-eureka.png', tired: 'characters/gray-stand-tired.png' } },
    cog: { name: '코그', faces: { normal: 'characters/cog-stand-normal.png', happy: 'characters/cog-stand-happy.png', surprised: 'characters/cog-stand-surprised.png' } },
    me: { name: '나' },
    narr: { name: '' },
  };
})(window);
