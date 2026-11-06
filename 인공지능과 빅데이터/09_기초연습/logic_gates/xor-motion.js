(function () {
  'use strict';
  const M = typeof module === 'object' && module.exports ? require('./xor-power-math.js') : window.XorPowerMath;
  function beat(at, x, y, title, copy, phase, alpha) {
    return { at: at, x: x, y: y, title: title, copy: copy, phase: phase || 0, alpha: alpha === undefined ? 1.5 : alpha };
  }
  const SCENES = [
    { name: '전원 선택', duration: 90, beats: [
      beat(0, 0, 0, '폭우가 내린 날, 대피소가 어두워졌어요.', '학교 체육관이 대피소가 되었어요. 조명과 안내 방송에 전기가 필요해요.', 0),
      beat(12, 0, 1, '비상발전기로 전기를 공급해요.', '비상발전기를 선택했어요. 지금 공급하는 전원은 비상발전기입니다.', 1),
      beat(28, 0, 1, '일반 전원도 복구되었어요.', '이제 두 전원 모두 사용할 수 있어요. 이 수업에서는 두 전원을 함께 연결하지 않는 방식을 사용해요.', 2),
      beat(42, 1, 1, '두 전원을 함께 선택하면?', '선택이 겹쳤어요. 새 전환 요청을 보류하고 기존 비상발전기 공급을 유지해요.', 3),
      beat(58, 1, 0, '정확히 하나를 선택하면 유효해요.', '발전기 선택을 해제했어요. 이제 일반 전원 하나만 선택한 유효한 요청입니다.', 4),
      beat(70, 0, 0, '아무것도 선택하지 않았다면?', '새 요청이 없으므로 전환하지 않아요. 출력 0은 현재 전기가 꺼진다는 뜻이 아니에요.', 5),
      beat(80, 1, 0, '정확히 하나를 골라내는 규칙, XOR.', '10과 01만 통과시키는 XOR. 이 선택 검사를 수행하는 뉴런을 만들어 볼까요?', 6)
    ] },
    { name: '뉴런 하나?', duration: 40, beats: [
      beat(0, 1, 0, '네 요청을 네 점으로 옮겨 볼까요?', '가로축은 일반 전원 선택 x, 세로축은 비상발전기 선택 y예요. 목표 1인 두 점은 대각선으로 놓여 있어요.', 0),
      beat(10, 1, 1, '한 뉴런은 직선으로 나누어 판단해요.', '가중합과 문턱을 비교하는 뉴런 하나는 직선 한쪽을 1로 판단해요. 그런데 이 직선은 11을 잘못 통과시켜요.', 1),
      beat(20, 0, 1, '직선을 바꿔도 네 점을 함께 나눌 수 없어요.', '이 직선은 10을 찾지만 01을 놓쳐요. XOR의 두 무리를 가르는 직선 하나는 없어요.', 2),
      beat(30, 1, 0, '작은 판단 두 개를 결합해 볼까요?', '중간 뉴런이 서로 다른 질문에 답하게 해 봅시다. 문턱 판정으로 값을 바꾼 뒤 결과를 결합할 거예요.', 3)
    ] },
    { name: '두 가지 검사', duration: 50, beats: [
      beat(0, 1, 1, '첫 질문: 중복 선택은 없나요?', '분홍 NAND는 두 입력이 모두 1일 때만 0이에요. 11을 막아 중복 선택을 걸러 내요.', 0),
      beat(12, 0, 0, '둘째 질문: 선택이 하나라도 있나요?', '주황 OR는 두 입력이 모두 0일 때만 0이에요. 아무 요청도 없는 00을 걸러 내요.', 1),
      beat(24, 1, 0, '선택은 있어야 하고, 중복은 없어야 해요.', '두 검사 결과가 모두 1이면 마지막 AND도 1이에요. 일반 전원 하나를 선택한 10은 통과합니다.', 2),
      beat(36, 0, 1, '이 조합이 XOR와 같아요.', '비상발전기 하나를 선택한 01도 통과해요. 같은 x와 y가 두 검사로 함께 전달됩니다.', 3)
    ] },
    { name: '뉴런 내부', duration: 45, beats: [
      beat(0, 1, 0, '뉴런 안에서는 무엇을 계산할까요?', '입력값에 연결선의 가중치를 곱해요. x에 −1을 곱하면 −1, y에 −2를 곱하면 0입니다.', 0),
      beat(10, 1, 0, '곱한 두 값을 더해요.', '−1과 0을 더하면 가중합 t는 −1이에요. 가중합은 음수가 될 수도 있어요.', 1),
      beat(22, 1, 0, '문턱 −2 이상이면 1을 내보내요.', '−1은 −2보다 커요. 따라서 이 뉴런의 출력은 1입니다. 음수여도 문턱 이상이면 통과해요.', 2),
      beat(34, 0, 1, '같은 값도 통과한다는 점이 중요해요.', '이번에는 합이 −2예요. −2 ≥ −2이므로 출력은 1! 문제에 주어진 등호를 꼭 확인하세요.', 3)
    ] },
    { name: 'NAND 계산', duration: 60, beats: [
      beat(0, 1, 1, '11에서는 −3, 문턱에 못 미쳐요.', '−1×1 + (−2)×1 = −3. −3은 −2보다 작으므로 f는 0입니다. 중복 선택이 차단돼요.', 0),
      beat(14, 1, 0, '10에서는 −1, 문턱을 통과해요.', '−1×1 + (−2)×0 = −1. −1 ≥ −2이므로 f는 1입니다.', 1),
      beat(28, 0, 1, '01에서는 정확히 −2예요.', '−1×0 + (−2)×1 = −2. 문턱과 같아도 f는 1입니다. 여기서 등호를 빼면 안 돼요.', 2),
      beat(42, 0, 0, '00에서는 0, 역시 통과해요.', '0 ≥ −2이므로 f는 1입니다. 중복이 없다는 검사 하나만으로는 선택이 있다는 것까지 알 수 없어요.', 3),
      beat(52, 0, 1, 'f는 11만 막는 NAND가 되었어요.', '11, 10, 01, 00에서 f는 차례로 0, 1, 1, 1. 주어진 수식으로 NAND가 만들어졌어요.', 4)
    ] },
    { name: 'OR 계산', duration: 50, beats: [
      beat(0, 1, 1, '11의 합은 3, OR는 통과시켜요.', '1×1 + 2×1 = 3. 3 ≥ 0.5이므로 g는 1입니다. OR에는 둘 다 1인 경우도 포함돼요.', 0),
      beat(12, 1, 0, '10의 합은 1이에요.', '1×1 + 2×0 = 1. 1 ≥ 0.5이므로 g는 1입니다.', 1),
      beat(24, 0, 1, '01의 합은 2예요.', '1×0 + 2×1 = 2. 2 ≥ 0.5이므로 g는 1입니다.', 2),
      beat(36, 0, 0, '00만 문턱 아래에 있어요.', '합이 0이면 0.5에 못 미쳐 g는 0입니다. g는 선택이 하나라도 있는지 묻는 OR가 되었어요.', 3)
    ] },
    { name: '새로운 입력', duration: 50, beats: [
      beat(0, 1, 1, '중복 선택 11은 마지막 합이 1이에요.', 'f는 0, g는 1. 마지막 연결선의 가중치는 각각 1이므로 1×0 + 1×1 = 1입니다.', 0),
      beat(12, 0, 0, '선택 없는 00도 마지막 합은 1이에요.', 'f는 1, g는 0. 합은 1이에요. 막아야 하는 두 경우가 같은 값으로 모였어요.', 1),
      beat(25, 1, 0, '단일 선택 10은 마지막 합이 2예요.', 'f와 g가 모두 1이므로 1×1 + 1×1 = 2입니다. 01도 같은 합 2가 됩니다.', 2),
      beat(38, 0, 1, '이제 마지막 뉴런은 1과 2를 구분해요.', '두 중간 뉴런의 문턱 판정이 입력을 새 값으로 바꿨어요. 마지막에는 합 1을 막고 합 2를 통과시키면 됩니다.', 3)
    ] },
    { name: 'α의 범위', duration: 75, beats: [
      beat(0, 1, 1, '마지막 문턱 α는 어디에 놓을까요?', '합 1인 경우는 선택 없음 또는 중복 선택이에요. 합 2인 경우는 유효한 단일 선택입니다.', 0, 0.5),
      beat(12, 1, 1, '1을 막으려면 α가 1보다 커야 해요.', '출력 1의 조건은 합 ≥ α예요. 합 1이 출력 0이 되려면 1 < α가 필요합니다.', 1, 1.4),
      beat(26, 1, 0, '2를 통과시키려면 α는 2 이하여야 해요.', '합 2가 출력 1이 되려면 2 ≥ α. 즉 α ≤ 2가 필요해요. 두 조건을 동시에 만족해야 합니다.', 2, 1.6),
      beat(40, 1, 1, 'α=1은 중복 선택도 통과시켜요.', '합 1 ≥ α 1이므로 출력이 1이 됩니다. 00과 11을 막지 못하니 α=1은 제외해요.', 3, 1),
      beat(50, 1, 0, 'α=2는 단일 선택을 통과시켜요.', '합 2 ≥ α 2이므로 출력은 1입니다. 등호가 있으니 α=2는 포함해요.', 4, 2),
      beat(60, 0, 1, '가능한 범위 전체는 1 < α ≤ 2.', '1은 빈 점, 2는 채운 점이에요. 1.5는 가능한 값 하나이고, 답은 그 값들을 모두 포함한 구간입니다.', 5, 1.5)
    ] },
    { name: '내가 해결사', duration: 30, beats: [
      beat(0, 0, 1, '이제 문제 그림으로도 설명할 수 있어요.', '중간 출력 → 마지막 가중합 → 필요한 부등식. 같은 계산 순서로 원래 문제를 풀어 보세요.', 0),
      beat(12, 1, 0, '대피소의 전원 선택 검사를 완성했어요!', '직접 실험에서는 α를 바꾸고 네 요청을 모두 검사해 보세요. 이어지는 10문제로 계산과 경계값을 확인할 수 있어요.', 1)
    ] }
  ];
  let offset = 0;
  SCENES.forEach(function (s) { s.start = offset; offset += s.duration; });
  const TOTAL = offset;
  const CHECKPOINTS = [
    { id: 'conflict', time: 41.8, title: '두 전원을 함께 선택하면 새 전환 요청은 어떻게 할까요?',
      options: ['둘 다 선택했으니 그대로 허용해요', '중복 선택이므로 새 전환을 보류해요'], correct: 1,
      explanation: '이 모형은 두 전원을 함께 연결하지 않는 방식이에요. 중복 요청을 보류하고 기존 비상발전기 공급은 유지합니다.' },
    { id: 'endpoints', time: SCENES[7].start + 38, title: 'α의 범위에서 1과 2는 각각 포함될까요?',
      options: ['1과 2 모두 포함해요', '1은 제외하고 2는 포함해요', '1과 2 모두 제외해요'], correct: 1,
      explanation: '합 1을 막으려면 α>1, 합 2를 통과시키려면 α≤2예요. 이어서 α=1과 α=2를 실제 계산으로 확인해요.' }
  ];
  function locate(time) {
    const t = Math.max(0, Math.min(TOTAL, Number(time) || 0));
    let si = SCENES.length - 1;
    for (let i = 0; i < SCENES.length; i++) { if (t < SCENES[i].start + SCENES[i].duration) { si = i; break; } }
    const scene = SCENES[si], local = t - scene.start;
    let bi = 0;
    scene.beats.forEach(function (b, i) { if (b.at <= local) bi = i; });
    return { si: si, bi: bi, scene: scene, beat: scene.beats[bi], local: local };
  }
  function crossing(previous, next, answered) {
    return CHECKPOINTS.find(function (c) { return !answered.has(c.id) && previous < c.time && next >= c.time; });
  }
  if (typeof module === 'object' && module.exports) module.exports = { SCENES: SCENES, TOTAL: TOTAL, CHECKPOINTS: CHECKPOINTS, locate: locate, crossing: crossing };
  if (typeof document === 'undefined') return;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  const svg = function (label, body, cls, box) { return '<svg class="' + (cls || '') + '" viewBox="' + (box || '0 0 1000 440') + '" role="img" aria-label="' + esc(label) + '">' + body + '</svg>'; };
  const txt = function (x, y, content, cls, extra) { return '<text x="' + x + '" y="' + y + '" class="' + (cls || 'svg-label') + '" ' + (extra || '') + '>' + esc(content) + '</text>'; };
  const pill = function (x, y, w, content, fill, cls) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="36" rx="12" fill="' + (fill || '#fff') + '" stroke="#d2dfd2"/>' + txt(x + w / 2, y + 24, content, cls || 'svg-label', 'text-anchor="middle"'); };
  const state = { time: 0, playing: false, speed: 1, manual: null, manualAlpha: null, current: '복구 대기', answered: new Set(), lastKey: '', checkpoint: null };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const player = $('player'), visual = $('visual'), detail = $('sceneDetail');
  let lastStamp = null;
  function fmt(seconds) { const n = Math.floor(seconds); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); }
  function sourceAt(time) { return time < 12 ? '복구 대기' : time < 58 ? '비상발전기' : '일반 전원'; }
  function drawTable(all, active, mode, onlyTarget) {
    let heads = '<th>x</th><th>y</th>';
    if (!onlyTarget) heads += mode === 'f' ? '<th>−x−2y</th><th>f</th>' : mode === 'g' ? '<th>x+2y</th><th>g</th>' : '<th>f</th><th>g</th><th>마지막 합</th>';
    heads += '<th>' + (onlyTarget ? '선택 유효' : 'XOR 목표') + '</th>';
    if (mode === 'check') heads += '<th>뉴런 출력</th><th>확인</th>';
    return '<div class="truth-wrap"><table class="truth"><caption class="sr-only">11, 10, 01, 00 요청의 계산 결과</caption><thead><tr>' + heads + '</tr></thead><tbody>' + all.map(function (r) {
      let cells = '<td>' + r.x + '</td><td>' + r.y + '</td>';
      if (!onlyTarget) cells += mode === 'f' ? '<td>' + r.tf + '</td><td>' + r.f + '</td>' : mode === 'g' ? '<td>' + r.tg + '</td><td>' + r.g + '</td>' : '<td>' + r.f + '</td><td>' + r.g + '</td><td>' + r.sum + '</td>';
      cells += '<td>' + r.target + '</td>';
      if (mode === 'check') cells += '<td>' + r.h + '</td><td class="' + (r.match ? 'good' : 'bad') + '">' + (r.match ? '일치' : '오판') + '</td>';
      return '<tr' + (active && active.x === r.x && active.y === r.y ? ' class="active"' : '') + '>' + cells + '</tr>';
    }).join('') + '</tbody></table></div>';
  }
  function person(x, y, shirt, scale) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + (scale || 1) + ')"><path d="M-12 10 Q0 3 12 10 L15 44 H-15Z" fill="' + shirt + '"/><path d="M-8 44V61M8 44V61" stroke="#536254" stroke-width="6" stroke-linecap="round"/><circle cy="-4" r="15" fill="#f1cbb0"/><path d="M-15 -7Q-16 -26 2 -23Q20 -21 16 -4Q9 -9 5 -15Q0 -5 -15 -7" fill="#5f5750"/><circle cx="-5" cy="-3" r="1.5" fill="#3c4940"/><circle cx="5" cy="-3" r="1.5" fill="#3c4940"/><path d="M-3 4Q0 7 4 4" fill="none" stroke="#a96a59" stroke-width="1.5"/></g>';
  }
  function shelter(ctx, loc) {
    const r = M.request(ctx.x, ctx.y), phase = loc.beat.phase;
    const available = !!state.manual || phase >= 2 || loc.si > 0;
    const supplied = ctx.current !== '복구 대기';
    let body = '<defs><pattern id="roofTile" width="20" height="18" patternUnits="userSpaceOnUse"><path d="M0 17H20" stroke="#708f85" stroke-width="1"/></pattern><radialGradient id="lampLight"><stop stop-color="#ffe8a5" stop-opacity=".75"/><stop offset="1" stop-color="#ffe8a5" stop-opacity="0"/></radialGradient></defs>';
    body += '<rect x="6" y="8" width="988" height="417" rx="26" fill="#edf1e9"/><path d="M20 359Q170 330 295 355T580 350T980 350V425H20Z" fill="#dce5d4"/>';
    body += '<g fill="#d4e1df"><ellipse cx="125" cy="69" rx="70" ry="23"/><ellipse cx="175" cy="50" rx="45" ry="30"/><ellipse cx="225" cy="70" rx="66" ry="22"/><ellipse cx="800" cy="50" rx="84" ry="23"/><ellipse cx="854" cy="35" rx="42" ry="23"/></g>';
    for (let i = 0; i < 16; i++) body += '<path class="rain" d="M' + (50 + i * 61) + ' 102l-32 90"/>';
    body += '<g class="' + (supplied ? 'powered' : '') + '"><rect x="320" y="173" width="370" height="178" rx="8" fill="#fff8e6" stroke="#a3b4a1" stroke-width="2"/><path d="M295 178L505 80L715 178Z" fill="#85a599" stroke="#6c8a7e" stroke-width="2"/><path d="M308 172L505 92L703 172Z" fill="url(#roofTile)"/>';
    body += '<rect x="389" y="131" width="230" height="39" rx="12" fill="#fffdf1" stroke="#c2cdb8"/>' + txt(504, 157, '학교 체육관 · 대피소', 'svg-note', 'text-anchor="middle"');
    [350, 420, 570, 640].forEach(function (x) { body += '<rect class="shelter-window" x="' + x + '" y="202" width="28" height="65" rx="7"/>'; });
    body += '<path d="M474 352V228Q504 206 534 228V352" fill="#b6c8b4"/><path d="M504 225V350" stroke="#96ac95" stroke-width="2"/><circle cx="494" cy="286" r="3" fill="#688769"/><circle cx="514" cy="286" r="3" fill="#688769"/>';
    body += '<ellipse class="lamp-glow" cx="504" cy="267" rx="165" ry="88" fill="url(#lampLight)"/><path d="M335 294H675" stroke="#e7ddc2" stroke-width="2"/>' + person(381, 291, '#d69d82', .7) + person(608, 289, '#8aa6bd', .75) + person(435, 301, '#b4a4be', .5) + '</g>';
    body += '<path d="M111 281L151 132L190 281M125 226H177M132 202H172M141 174H165M119 255H182M104 156H198M118 182H184" fill="none" stroke="' + (available ? '#6f9db3' : '#aeb9b1') + '" stroke-width="5" stroke-linecap="round"/>';
    body += pill(59, 287, 180, available ? '일반 전원 · 사용 가능' : '일반 전원 · 복구 대기', available ? '#e4eff7' : '#e4e8e0', 'svg-small');
    body += '<g transform="translate(782 224)"><rect width="146" height="79" rx="16" fill="#e8bf79" stroke="#be985d" stroke-width="2"/><rect x="17" y="16" width="54" height="41" rx="8" fill="#8b9880"/><path d="M25 27H64M25 36H64M25 45H64" stroke="#c4cfb7" stroke-width="3"/><rect x="88" y="13" width="39" height="30" rx="6" fill="#fff5d8"/><circle cx="99" cy="27" r="3" fill="#6a7962"/><circle cx="115" cy="27" r="3" fill="#6a7962"/><path d="M101 36Q108 41 115 36" stroke="#9c8e67" fill="none"/><path d="M18 80v7M128 80v7" stroke="#66755d" stroke-width="8" stroke-linecap="round"/><path d="M48 0V-12H98V0" stroke="#9a8358" stroke-width="5" fill="none"/></g>';
    body += pill(765, 317, 176, '비상발전기', '#fff0d0');
    body += '<path class="wire ' + (ctx.current === '일반 전원' ? 'active' : '') + '" d="M151 326V375H433"/><path class="wire ' + (ctx.current === '비상발전기' ? 'active' : '') + '" d="M855 354V375H577"/>';
    if (supplied) body += '<path class="signal" d="' + (ctx.current === '일반 전원' ? 'M151 326V375H433' : 'M855 354V375H577') + '"/>';
    body += '<rect x="433" y="350" width="144" height="52" rx="15" fill="#fffdf2" stroke="#9ab39e" stroke-width="2"/>' + txt(505, 382, '전원 선택 검사', 'svg-small', 'text-anchor="middle"');
    const call = state.manual ? r.reason + (r.valid ? ' · 유효한 요청' : ' · 새 전환 보류') : phase === 0 ? '조명과 안내 방송에 전기가 필요해요!' : phase === 1 ? '발전기 하나를 선택했어요.' : phase === 2 ? '일반 전원도 돌아왔어요!' : phase === 3 ? '중복 선택! 새 전환은 보류해요.' : phase === 5 ? '새 선택 없음 · 기존 공급 유지' : '전원은 정확히 하나만 선택해요.';
    body += '<rect class="callout-box" x="267" y="17" width="466" height="43" rx="15"/>' + txt(500, 45, call, 'svg-note', 'text-anchor="middle"');
    body += pill(360, 405, 290, '현재 공급원: ' + ctx.current, '#e8f1e3', 'svg-small');
    return svg('비 오는 학교 체육관 대피소, 일반 전원과 비상발전기. 현재 공급원은 ' + ctx.current, body);
  }
  function coordinates(phase) {
    const pts = [{ x: 0, y: 0, label: '00 · 선택 없음' }, { x: 1, y: 0, label: '10 · 일반 전원' }, { x: 0, y: 1, label: '01 · 비상발전기' }, { x: 1, y: 1, label: '11 · 중복 선택' }];
    let s = '<rect x="150" y="20" width="700" height="365" rx="23" fill="#f0f5ed"/><path d="M320 315H735M350 340V48" stroke="#9eafa1" stroke-width="2"/>' + txt(740, 340, 'x', 'svg-math') + txt(331, 50, 'y', 'svg-math');
    s += txt(350, 372, '0', 'svg-small', 'text-anchor="middle"') + txt(650, 372, '1', 'svg-small', 'text-anchor="middle"');
    if (phase === 1) s += '<path d="M395 50L735 390" stroke="#b9986c" stroke-width="4" stroke-dasharray="10 7"/>';
    if (phase >= 2) s += '<path d="M410 50L610 390" stroke="#b9986c" stroke-width="4" stroke-dasharray="10 7"/>';
    pts.forEach(function (p) {
      const x = 350 + p.x * 300, y = 315 - p.y * 220, target = Number(p.x !== p.y);
      s += '<circle cx="' + x + '" cy="' + y + '" r="29" fill="' + (target ? '#ffe4a8' : '#d6e8dc') + '" stroke="' + (target ? '#c7a36b' : '#8da994') + '" stroke-width="2"/>' + txt(x, y + 9, target, 'svg-big', 'text-anchor="middle"');
      s += txt(x, y + (p.y ? -43 : -45), p.label, 'svg-label', 'text-anchor="middle"');
    });
    s += txt(500, 418, phase >= 3 ? '입력을 새 값으로 바꾸는 중간 판단이 필요해요.' : '숫자는 XOR의 목표 출력입니다.', 'svg-note', 'text-anchor="middle"');
    return svg('XOR의 네 점. 10과 01의 목표는 1, 00과 11의 목표는 0. 직선 하나로 분리할 수 없습니다.', s);
  }
  function wire(d, value) {
    return '<path class="wire" d="' + d + '"/><path class="signal' + (value ? '' : ' zero') + '" d="' + d + '"/>';
  }
  function network(ctx, loc) {
    const r = ctx.result, logic = loc.si === 2, hiddenOutput = loc.si >= 3 && loc.si <= 5;
    let s = wire('M140 100H340', ctx.x) + wire('M140 300H182L300 125L340 108', ctx.y) + wire('M140 100H182L300 275L340 292', ctx.x) + wire('M140 300H340', ctx.y);
    s += wire('M436 100L674 185', r.f) + wire('M436 300L674 215', r.g) + wire('M766 200H864', r.h);
    [[100, 100, 'x', ctx.x], [100, 300, 'y', ctx.y]].forEach(function (n) {
      s += '<circle class="token" cx="' + n[0] + '" cy="' + n[1] + '" r="35"/>' + txt(n[0], n[1] + 9, n[2] + '=' + n[3], 'svg-big', 'text-anchor="middle"');
    });
    if (!logic) {
      s += pill(201, 53, 62, '−1', '#fff6e3') + pill(221, 148, 62, '−2', '#fff6e3') + pill(190, 211, 62, '1', '#fff6e3') + pill(244, 317, 62, '2', '#fff6e3');
      s += pill(532, 109, 52, '1', '#f1f5ed') + pill(532, 254, 52, '1', '#f1f5ed');
    }
    const nodes = [
      { x: 390, y: 100, fill: '#f7d5df', name: 'f', value: r.f, label: logic ? '중복 없음 · NAND' : 't = ' + r.tf + '   문턱 −2', focus: loc.si === 4 },
      { x: 390, y: 300, fill: '#f8e3be', name: 'g', value: r.g, label: logic ? '선택 있음 · OR' : 't = ' + r.tg + '   문턱 0.5', focus: loc.si === 5 },
      { x: 720, y: 200, fill: '#d2e9d4', name: 'h', value: hiddenOutput ? '?' : r.h, label: logic ? '둘 다 충족 · AND' : '합 ' + r.sum + '   문턱 α', focus: loc.si >= 6 }
    ];
    nodes.forEach(function (n) {
      s += '<g class="' + (n.focus ? 'node-focus' : '') + '"><circle cx="' + n.x + '" cy="' + n.y + '" r="46" fill="' + n.fill + '" stroke="#a6b3a1" stroke-width="2"/>' + txt(n.x, n.y + 8, n.name + ' = ' + n.value, 'svg-big', 'text-anchor="middle"') + '</g>';
      s += txt(n.x, n.y - 65, n.label, 'svg-label', 'text-anchor="middle"');
    });
    s += pill(848, 178, 130, hiddenOutput ? '다음에 계산' : (r.match ? '선택 유효 ' : '검사 오판 ') + r.h, r.match ? '#edf5e7' : '#ffe3df', 'svg-small');
    s += txt(100, 155, '일반 전원 선택', 'svg-small', 'text-anchor="middle"') + txt(100, 355, '발전기 선택', 'svg-small', 'text-anchor="middle"');
    s += txt(500, 417, logic ? '같은 두 입력이 두 검사로 갈라지고, 결과가 다시 합쳐져요.' : '가중치를 곱하고 → 더하고 → 문턱과 비교해요.', 'svg-note', 'text-anchor="middle"');
    const mobile = '<div class="mobile-network"><div class="mobile-inputs"><span class="mobile-input">일반 전원 x=' + ctx.x + '</span><span class="mobile-input">발전기 y=' + ctx.y + '</span></div><div class="mobile-arrow">↙ 같은 입력이 함께 전달돼요 ↘</div><div class="mobile-hidden"><div class="mobile-node f"><small>' + (logic ? '중복 없음 · NAND' : '−x−2y = ' + r.tf) + '</small><strong>f = ' + r.f + '</strong><small>' + (logic ? '11을 막아요' : '문턱 −2 이상이면 1') + '</small></div><div class="mobile-node g"><small>' + (logic ? '선택 있음 · OR' : 'x+2y = ' + r.tg) + '</small><strong>g = ' + r.g + '</strong><small>' + (logic ? '00을 막아요' : '문턱 0.5 이상이면 1') + '</small></div></div><div class="mobile-arrow">↘ 가중치 1씩 곱해 합쳐요 ↙</div><div class="mobile-node h"><small>' + (logic ? '두 결과를 AND로 결합' : '1×' + r.f + ' + 1×' + r.g + ' = ' + r.sum) + '</small><strong>h = ' + (hiddenOutput ? '?' : r.h) + '</strong><small>' + (logic ? '두 조건이 모두 1이어야 해요' : '마지막 문턱 α와 비교') + '</small></div></div>';
    return svg('x=' + ctx.x + ', y=' + ctx.y + '에서 분홍 f=' + r.f + ', 주황 g=' + r.g + ', 마지막 합=' + r.sum, s, 'network-svg') + mobile;
  }
  function neuron(ctx, phase) {
    const r = ctx.result;
    let s = wire('M110 100H360L450 190', ctx.x) + wire('M110 320H360L450 230', ctx.y) + wire('M550 210H838', r.f);
    s += pill(30, 79, 130, 'x = ' + ctx.x, '#e6f0f7') + pill(30, 299, 130, 'y = ' + ctx.y, '#fff0d7');
    s += pill(225, 80, 124, '× (−1)', '#f8e0e7') + pill(225, 300, 124, '× (−2)', '#f8e0e7');
    s += '<circle cx="500" cy="210" r="63" fill="#f9dce4" stroke="#cf95a8" stroke-width="2"/>' + txt(500, 205, '가중합 t', 'svg-label', 'text-anchor="middle"') + txt(500, 238, phase >= 1 ? r.tf : '?', 'svg-big', 'text-anchor="middle"');
    s += pill(636, 140, 215, '문턱 −2와 비교', '#fff5d8') + pill(814, 192, 156, phase >= 2 ? '출력 ' + r.f : '출력 ?', '#dfedda');
    s += txt(500, 392, '① 곱하기          ② 더하기          ③ 문턱 비교', 'svg-note', 'text-anchor="middle"');
    return svg('입력에 가중치를 곱하고 합한 다음 문턱과 비교하는 뉴런 내부', s);
  }
  function numberLine(ctx, loc) {
    const phase = loc.beat.phase, alpha = ctx.alpha, px = function (v) { return 105 + v * 250; };
    let s = '<path d="M105 102H880" stroke="#a9b9a7" stroke-width="3"/>';
    [0, 1, 2, 3].forEach(function (v) { s += '<path d="M' + px(v) + ' 96V110" stroke="#8d9d8b" stroke-width="2"/>' + txt(px(v), 143, v, 'svg-math', 'text-anchor="middle"'); });
    if (phase >= 5) s += '<path d="M' + px(1) + ' 102H' + px(2) + '" stroke="#3c8b66" stroke-width="9"/><circle cx="' + px(1) + '" cy="102" r="9" fill="#fff" stroke="#3c8b66" stroke-width="4"/><circle cx="' + px(2) + '" cy="102" r="9" fill="#3c8b66"/>';
    s += '<path d="M' + px(alpha) + ' 32V86" stroke="#a46582" stroke-width="3"/><path d="M' + (px(alpha) - 7) + ' 77L' + px(alpha) + ' 89L' + (px(alpha) + 7) + ' 77" fill="#a46582"/>';
    s += txt(px(alpha), 24, 'α = ' + alpha, 'svg-math', 'text-anchor="middle"');
    s += txt(px(1), 184, '합 1 · 선택 없음 / 중복', 'svg-label', 'text-anchor="middle"') + txt(px(2) + 12, 218, '합 2 · 단일 선택', 'svg-label', 'text-anchor="middle"');
    return svg('수직선 위의 문턱 alpha ' + alpha + (phase >= 5 ? '. 가능한 범위는 1 초과 2 이하.' : ''), s, '', '0 0 1000 240');
  }
  function chip(content, tone) { return '<div class="math-chip ' + (tone || '') + '">' + content + '</div>'; }
  function renderScene(ctx, loc) {
    const r = ctx.result, si = loc.si, phase = loc.beat.phase;
    if (si === 0) {
      visual.innerHTML = shelter(ctx, loc);
      detail.innerHTML = phase >= 6 ? drawTable(M.rows(), r, '', true) : '<div class="math-strip">' + chip('x = <strong>' + ctx.x + '</strong>') + chip('y = <strong>' + ctx.y + '</strong>') + chip(M.request(ctx.x, ctx.y).reason, r.target ? 'green' : '') + '</div>';
    } else if (si === 1) {
      visual.innerHTML = coordinates(phase);
      detail.innerHTML = phase >= 3 ? '<div class="boundary">직선 한 번의 판단 → 중간 뉴런 두 개의 판단으로!</div>' : '';
    } else if (si === 3) {
      visual.innerHTML = neuron(ctx, phase);
      detail.innerHTML = '<div class="calculation enter"><h3>분홍 뉴런 f의 계산</h3><div class="formula-line">① −1×' + ctx.x + ' = ' + (-ctx.x) + '<br>　 −2×' + ctx.y + ' = ' + (-2 * ctx.y) + '</div><div class="formula-line">② ' + (-ctx.x) + ' + (' + (-2 * ctx.y) + ') = <b>' + (phase >= 1 ? r.tf : '?') + '</b></div><div class="formula-line">③ ' + (phase >= 2 ? r.tf + (r.tf >= -2 ? ' ≥ ' : ' < ') + '−2' : '합과 문턱 −2 비교') + '</div><div class="formula-result">f = ' + (phase >= 2 ? r.f : '?') + '</div></div>';
    } else if (si === 7) {
      visual.innerHTML = numberLine(ctx, loc);
      let html = '<div class="alpha-board"><div class="constraint-row"><div class="constraint"><span>합 1은 출력 0이어야 해요</span><strong>' + (phase >= 1 ? '1 &lt; α' : '어떤 조건일까요?') + '</strong></div><div class="constraint"><span>합 2는 출력 1이어야 해요</span><strong>' + (phase >= 2 ? 'α ≤ 2' : '어떤 조건일까요?') + '</strong></div></div>';
      html += phase >= 5 ? '<div class="solution enter">1 &lt; α ≤ 2 &nbsp; <small>(1, 2]</small></div>' : '<div class="alpha-result">현재 요청 ' + ctx.x + ctx.y + ': 합 ' + r.sum + (r.sum >= ctx.alpha ? ' ≥ ' : ' &lt; ') + 'α ' + ctx.alpha + ' → 출력 ' + r.h + (r.match ? ' · 목표와 일치' : ' · 검사 오판') + '</div>';
      html += '<div class="alpha-presets" style="justify-content:center;margin:8px 0 0">' + [1, 1.5, 2, 2.001].map(function (a) { return '<button type="button" data-scene-alpha="' + a + '">α=' + a + '</button>'; }).join('') + '</div></div>';
      detail.innerHTML = html;
    } else {
      visual.innerHTML = network(ctx, loc);
      if (si === 2) {
        detail.innerHTML = '<div class="math-strip">' + chip('NAND: 중복 없음 <strong>' + r.f + '</strong>', 'rose') + chip('OR: 선택 있음 <strong>' + r.g + '</strong>', 'orange') + chip('AND: 둘 다 충족 <strong>' + r.h + '</strong>', 'green') + '</div>';
      } else if (si === 4 || si === 5) {
        const isf = si === 4, sum = isf ? r.tf : r.tg, threshold = isf ? -2 : 0.5;
        const formula = isf ? '−1×' + ctx.x + ' + (−2)×' + ctx.y : '1×' + ctx.x + ' + 2×' + ctx.y;
        detail.innerHTML = '<div class="math-strip">' + chip(formula + ' = <strong>' + sum + '</strong>', isf ? 'rose' : 'orange') + chip(sum + (sum >= threshold ? ' ≥ ' : ' &lt; ') + threshold + ' → <strong>' + (isf ? r.f : r.g) + '</strong>', 'green') + '</div>' + drawTable(M.rows(), r, isf ? 'f' : 'g');
        if (isf && ctx.x === 0 && ctx.y === 1) detail.innerHTML += '<div class="boundary enter">−2 ≥ −2 → 1 &nbsp; 문턱과 같은 값도 통과해요!</div>';
      } else if (si === 6) {
        detail.innerHTML = '<div class="math-strip">' + chip('1×' + r.f + ' + 1×' + r.g + ' = <strong>' + r.sum + '</strong>', 'green') + chip(r.target ? '통과시킬 합: 2' : '막아야 할 합: 1') + '</div>' + drawTable(M.rows(), r);
      } else if (si === 8) {
        detail.innerHTML = phase === 0 ? '<div class="math-strip">' + chip('f: t ≥ −2이면 1', 'rose') + chip('g: t ≥ 0.5이면 1', 'orange') + chip('h: t ≥ α이면 1', 'green') + '</div>' : '<div class="finish-card enter"><h2>이제 내가 α를 정해 볼 차례예요.</h2><p>모든 요청을 확인하고, 가능한 범위 전체를 찾아보세요.</p><div class="finish-actions"><button type="button" data-open-practice class="primary-btn">전원 선택 실험 &amp; 10문제 →</button><button type="button" data-replay-alpha class="secondary-btn">α 설명 다시 보기 ↺</button></div></div>';
      }
    }
  }
  function render(force) {
    const loc = locate(state.time), b = loc.beat;
    const x = state.manual ? state.manual.x : b.x, y = state.manual ? state.manual.y : b.y;
    const alpha = state.manualAlpha === null ? b.alpha : state.manualAlpha;
    if (!state.manual) state.current = sourceAt(state.time);
    const result = M.evaluate(x, y, alpha);
    const ctx = { x: x, y: y, alpha: alpha, current: state.current, result: result };
    const key = [loc.si, loc.bi, x, y, alpha, state.current, !!state.manual].join(':');
    if (force || key !== state.lastKey) {
      state.lastKey = key;
      $('sceneBody').dataset.scene = loc.si;
      $('sceneKicker').textContent = 'MISSION ' + String(loc.si + 1).padStart(2, '0') + ' · ' + loc.scene.name;
      $('sceneTitle').textContent = state.manual ? '지금은 내가 전원 선택 검사관!' : b.title;
      $('sceneCount').textContent = String(loc.si + 1).padStart(2, '0') + ' / 09';
      $('caption').textContent = state.manual ? '두 전원이 사용 가능한 상황을 가정해요. 현재 요청은 ' + x + y + ', ' + M.request(x, y).reason + '입니다. 뉴런 출력 ' + result.h + '과 XOR 목표 ' + result.target + '를 비교해 보세요.' : b.copy;
      renderScene(ctx, loc);
      Array.from($('chapters').children).forEach(function (el, i) { el.setAttribute('aria-current', String(i === loc.si)); });
      [['inputX', 'valueX', x], ['inputY', 'valueY', y]].forEach(function (a) { $(a[0]).setAttribute('aria-pressed', String(!!a[2])); $(a[1]).textContent = a[2]; });
      const manual = !!state.manual || state.manualAlpha !== null;
      $('followBtn').hidden = !manual;
      $('modeTag').textContent = manual ? '직접 조작 중 · 일시 정지' : '장면 따라보기';
    }
    $('seek').value = state.time;
    $('seek').setAttribute('aria-valuetext', fmt(state.time) + ', ' + loc.scene.name);
    $('clock').textContent = fmt(state.time) + ' / ' + fmt(TOTAL);
    $('prev').disabled = state.time <= 0;
    $('next').disabled = state.time >= TOTAL;
    $('play').textContent = state.playing ? 'Ⅱ 잠시 멈추기' : state.time >= TOTAL ? '↺ 다시 보기' : state.time > 0 ? '▶ 이어 보기' : '▶ 이야기 시작';
    $('play').setAttribute('aria-label', state.playing ? '모션 일시 정지' : '모션 재생');
    player.classList.toggle('playing', state.playing);
  }
  function pause() { state.playing = false; lastStamp = null; render(); }
  function seek(time) {
    state.time = Math.max(0, Math.min(TOTAL, time));
    state.manual = null; state.manualAlpha = null;
    lastStamp = null;
    render(true);
  }
  function togglePlay() {
    if ($('checkpoint').open) return;
    if (state.playing) { pause(); return; }
    if (state.time >= TOTAL) { state.answered.clear(); seek(0); }
    state.manual = null; state.manualAlpha = null;
    state.playing = true; lastStamp = null; render(true);
  }
  function step(direction) {
    pause();
    const times = [];
    SCENES.forEach(function (s) { s.beats.forEach(function (b) { times.push(s.start + b.at); }); });
    if (direction > 0) seek(times.find(function (t) { return t > state.time + 0.2; }) || TOTAL);
    else seek(times.filter(function (t) { return t < state.time - 0.2; }).pop() || 0);
  }
  let checkpointFocus = null;
  function showCheckpoint(cp) {
    state.checkpoint = cp; checkpointFocus = document.activeElement;
    pause();
    $('checkpointTitle').textContent = cp.title;
    $('checkpointFeedback').textContent = '';
    $('checkpointContinue').disabled = true;
    $('checkpointContinue').textContent = '선택한 뒤 이어보기 →';
    $('checkpointOptions').replaceChildren();
    cp.options.forEach(function (text, i) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', function () {
        Array.from($('checkpointOptions').children).forEach(function (el) { el.setAttribute('aria-pressed', String(el === button)); });
        $('checkpointFeedback').textContent = (i === cp.correct ? '맞아요! ' : '이렇게 확인해 볼까요? ') + cp.explanation;
        state.answered.add(cp.id); $('checkpointContinue').disabled = false; $('checkpointContinue').textContent = '계산으로 확인하며 이어보기 →';
      });
      $('checkpointOptions').appendChild(button);
    });
    $('checkpoint').showModal();
  }
  $('checkpointContinue').addEventListener('click', function () { $('checkpoint').close(); state.checkpoint = null; togglePlay(); });
  $('checkpoint').addEventListener('close', function () {
    state.checkpoint = null;
    if (checkpointFocus && checkpointFocus.focus) checkpointFocus.focus();
  });
  function tick(stamp) {
    if (state.playing) {
      if (lastStamp === null) lastStamp = stamp;
      const delta = Math.min((stamp - lastStamp) / 1000, 0.25) * state.speed;
      lastStamp = stamp;
      const next = Math.min(TOTAL, state.time + delta);
      const cp = crossing(state.time, next, state.answered);
      if (cp) { state.time = cp.time; showCheckpoint(cp); }
      else { state.time = next; if (state.time >= TOTAL) state.playing = false; render(); }
    } else lastStamp = null;
    if (!reduced.matches) player.style.setProperty('--flow', String(-state.time * 28));
    requestAnimationFrame(tick);
  }
  SCENES.forEach(function (s, i) {
    const button = document.createElement('button'); button.type = 'button';
    button.innerHTML = '<b>' + String(i + 1).padStart(2, '0') + '</b><span class="chapter-name">' + s.name + '</span>';
    button.setAttribute('aria-label', (i + 1) + '장 ' + s.name); button.title = s.name;
    button.addEventListener('click', function () { pause(); seek(s.start); });
    $('chapters').appendChild(button);
  });
  $('play').addEventListener('click', togglePlay);
  $('restart').addEventListener('click', function () { pause(); state.answered.clear(); seek(0); });
  $('prev').addEventListener('click', function () { step(-1); });
  $('next').addEventListener('click', function () { step(1); });
  $('seek').addEventListener('input', function () { const requested = Number(this.value); pause(); seek(requested); });
  $('speed').addEventListener('change', function () { state.speed = Number(this.value); });
  $('full').addEventListener('click', function () {
    const p = document.fullscreenElement ? document.exitFullscreen() : player.requestFullscreen ? player.requestFullscreen() : null;
    if (p && p.catch) p.catch(function () { $('caption').textContent = '이 브라우저에서는 전체 화면을 열 수 없어요. 현재 화면에서 계속 볼 수 있습니다.'; });
  });
  document.addEventListener('fullscreenchange', function () { $('full').setAttribute('aria-label', document.fullscreenElement ? '전체 화면 닫기' : '모션 전체 화면'); });
  function manualInput(which) {
    pause();
    if (!state.manual) { const b = locate(state.time).beat; state.manual = { x: b.x, y: b.y }; }
    state.manual[which] = 1 - state.manual[which];
    state.current = M.acceptSource(state.current, state.manual.x, state.manual.y);
    render(true);
  }
  $('inputX').addEventListener('click', function () { manualInput('x'); });
  $('inputY').addEventListener('click', function () { manualInput('y'); });
  $('followBtn').addEventListener('click', function () { state.manual = null; state.manualAlpha = null; render(true); });
  $('sceneBody').addEventListener('click', function (event) {
    const alpha = event.target.closest('[data-scene-alpha]');
    if (alpha) { pause(); state.manualAlpha = Number(alpha.dataset.sceneAlpha); render(true); }
    if (event.target.closest('[data-open-practice]')) openPractice();
    if (event.target.closest('[data-replay-alpha]')) { pause(); seek(SCENES[7].start); }
  });
  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea,button,a,summary,dialog,[contenteditable]') || $('checkpoint').open) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  $('transcript').innerHTML = SCENES.map(function (s, i) { return '<section><h3>' + (i + 1) + '. ' + esc(s.name) + '</h3>' + s.beats.map(function (b) { return '<p><b>' + fmt(s.start + b.at) + '</b> ' + esc(b.copy) + '</p>'; }).join('') + '</section>'; }).join('') +
    '<section><h3>한 직선으로 XOR를 나눌 수 없는 이유</h3><p>가중합 w₁x+w₂y ≥ θ일 때 1이라고 합시다. 00의 출력 0은 θ&gt;0, 10과 01의 출력 1은 w₁≥θ와 w₂≥θ를 요구합니다. 그러면 w₁+w₂≥2θ&gt;θ가 됩니다. 하지만 11의 출력 0은 w₁+w₂&lt;θ를 요구하므로 모순입니다.</p></section>';

  /* 후속 체험: 모션의 조작 상태와 학생의 답안 상태는 독립적으로 유지합니다. */
  const STORE = 'xorPower.practice.v1';
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (_) { saved = {}; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  if (!saved.answers || typeof saved.answers !== 'object' || Array.isArray(saved.answers)) saved.answers = {};
  const lab = { x: 0, y: 1, alpha: 1.5, current: '비상발전기', checked: false };
  const QUESTIONS = [
    { title: '(x,y)=(0,1)일 때, 분홍 뉴런의 가중합 t와 출력 f를 구하세요.', kind: 'pair', labels: ['가중합 t', '출력 f'], answer: [-2, 1], hint: ['입력에서 분홍 뉴런으로 가는 두 가중치를 보세요.', '−1×0 + (−2)×1을 계산하세요.', '합 −2가 문턱 −2 이상인지 비교하세요.'], explanation: '가중합은 −2, 출력은 1입니다. −2 ≥ −2로 등호가 포함됩니다.' },
    { title: '(x,y)=(1,0)일 때, 주황 뉴런의 가중합 t와 출력 g를 구하세요.', kind: 'pair', labels: ['가중합 t', '출력 g'], answer: [1, 1], hint: ['주황 뉴런의 가중치는 1과 2입니다.', '1×1 + 2×0을 계산하세요.', '합 1을 문턱 0.5와 비교하세요.'], explanation: '가중합은 1, 1 ≥ 0.5이므로 출력 g는 1입니다.' },
    { title: '11, 10, 01, 00 순서로 분홍 뉴런 f의 출력 네 개를 적으세요.', kind: 'sequence', answer: [0, 1, 1, 1], hint: ['각 입력의 가중합 −x−2y를 구하세요.', '가중합은 −3, −1, −2, 0입니다.', '각각 문턱 −2 이상인지 비교하세요.'], explanation: '0, 1, 1, 1입니다. 두 전원을 중복 선택한 11만 막는 NAND입니다.' },
    { title: '11, 10, 01, 00 순서로 주황 뉴런 g의 출력 네 개를 적으세요.', kind: 'sequence', answer: [1, 1, 1, 0], hint: ['각 입력의 가중합 x+2y를 구하세요.', '가중합은 3, 1, 2, 0입니다.', '각각 문턱 0.5 이상인지 비교하세요.'], explanation: '1, 1, 1, 0입니다. 요청이 없는 00만 막는 OR입니다.' },
    { title: '11, 10, 01, 00 순서로 마지막 뉴런의 가중합 f+g를 적으세요.', kind: 'sequence', answer: [1, 2, 2, 1], hint: ['마지막 연결선의 가중치는 각각 1입니다.', '각 행의 f와 g를 더하세요.', '막을 두 경우는 1, 통과시킬 두 경우는 2로 모입니다.'], explanation: '1, 2, 2, 1입니다. 마지막 문턱은 합 1과 2를 구분해야 합니다.' },
    { title: 'α=1이면 네 가지 전원 선택 요청을 모두 올바르게 검사할까요?', kind: 'choice', options: ['네, 모두 올바릅니다.', '아니요. 00과 11도 통과합니다.'], answer: '1', hint: ['선택이 겹친 11의 마지막 합을 확인하세요.', '11의 마지막 합은 1입니다.', '1 ≥ α=1이므로 출력이 1이 됩니다.'], explanation: 'α=1에서는 네 경우 모두 출력 1입니다. 선택 없음과 중복 선택도 통과시키므로 실패합니다.' },
    { title: 'α=2는 가능한 문턱 값인가요?', kind: 'choice', options: ['가능합니다. 합 2도 통과합니다.', '불가능합니다. 합이 문턱과 같으면 차단됩니다.'], answer: '0', hint: ['문제의 활성화 함수에 등호가 있는지 보세요.', '합 ≥ α일 때 출력 1입니다.', '2 ≥ 2이므로 단일 선택은 통과합니다. 합 1은 차단됩니다.'], explanation: '가능합니다. 2 ≥ 2이므로 10과 01이 통과하며, 합 1인 11과 00은 차단됩니다.' },
    { title: '주어진 회로가 XOR를 만들도록 α의 가능한 범위 전체를 구하세요.', kind: 'range', answer: [1, 'open', 2, 'closed'], hint: ['출력 0인 두 행의 합과 출력 1인 두 행의 합을 비교하세요.', '합 1은 막고 합 2는 통과시켜야 합니다.', '막는 조건은 1<α, 통과 조건은 α≤2입니다.'], explanation: '1 < α ≤ 2입니다. 1은 제외하고 2는 포함합니다.' },
    { title: '확장: 마지막 가중치가 f 쪽 2, g 쪽 1이면 α의 범위는?', kind: 'range', answer: [2, 'open', 3, 'closed'], hint: ['마지막 합을 2f+g로 다시 계산하세요.', '11,10,01,00에서 합은 1,3,3,2입니다.', '출력 0인 합의 최댓값 2는 막고, 출력 1인 합 3은 통과시켜야 합니다.'], explanation: '2 < α ≤ 3입니다. 막아야 할 합 1,2와 통과시킬 합 3을 구분합니다.' },
    { title: '확장: 마지막 가중합이 f−g라면, XOR를 만드는 α가 있을까요?', kind: 'choice', options: ['있습니다.', '없습니다. 두 조건을 함께 만족할 수 없습니다.'], answer: '1', hint: ['11,10,01,00의 합을 다시 구하세요.', '합은 −1,0,0,1입니다. 00을 막으려면 α>1입니다.', '10과 01을 통과시키려면 α≤0입니다. α>1과 함께 만족할 수 있을까요?'], explanation: '없습니다. α>1과 α≤0을 동시에 만족하는 수는 없습니다.' }
  ];
  let questionIndex = 0, hintLevel = 0;
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (_) { /* 기기 저장이 막혀도 현재 세션은 계속 작동합니다. */ } }
  function renderLab() {
    const r = M.evaluate(lab.x, lab.y, lab.alpha), req = M.request(lab.x, lab.y);
    [['labX', lab.x, '일반 전원'], ['labY', lab.y, '비상발전기']].forEach(function (v) { $(v[0]).setAttribute('aria-pressed', String(!!v[1])); $(v[0]).innerHTML = v[2] + ' <b>' + v[1] + '</b>'; });
    $('alphaLabel').textContent = lab.alpha.toFixed(3);
    $('labResult').innerHTML = '<strong>' + req.reason + ' · XOR 목표 ' + r.target + '</strong>f=' + r.f + ', g=' + r.g + ' → 마지막 합 ' + r.sum + '<br>' + r.sum + (r.sum >= lab.alpha ? ' ≥ ' : ' &lt; ') + 'α ' + lab.alpha + ' → 뉴런 출력 <b>' + r.h + '</b>' + (r.match ? ' · 목표와 일치' : ' · 검사 오판');
    $('labSupply').textContent = '현재 공급원: ' + lab.current + '. 선택 검사와 별도로 기억합니다. 중복·선택 없음에서는 새 전환을 보류합니다.';
    if (!lab.checked) $('alphaCheck').textContent = '예상한 뒤 검사하면 네 요청의 결과가 함께 나타납니다.';
    else showAlphaCheck();
  }
  function changeLab(which) {
    lab[which] = 1 - lab[which]; lab.current = M.acceptSource(lab.current, lab.x, lab.y); renderLab();
  }
  $('labX').addEventListener('click', function () { changeLab('x'); });
  $('labY').addEventListener('click', function () { changeLab('y'); });
  function setAlpha(value) {
    lab.alpha = value; lab.checked = false; $('alphaSlider').value = value; $('alphaPrediction').value = ''; renderLab();
  }
  $('alphaSlider').addEventListener('input', function () { setAlpha(Number(this.value)); });
  document.querySelectorAll('[data-alpha]').forEach(function (el) { el.addEventListener('click', function () { setAlpha(Number(el.dataset.alpha)); }); });
  function showAlphaCheck() {
    const prediction = $('alphaPrediction').value;
    const all = M.rows(lab.alpha), count = all.filter(function (r) { return r.match; }).length;
    $('alphaCheck').innerHTML = '<p><b>' + (prediction === (count === 4 ? 'yes' : 'no') ? '예상과 같아요! ' : '예상과 다른 결과를 살펴보세요. ') + count + ' / 4 일치</b></p>' + drawTable(all, M.evaluate(lab.x, lab.y, lab.alpha), 'check');
  }
  $('checkAlpha').addEventListener('click', function () {
    if (!$('alphaPrediction').value) { $('alphaCheck').textContent = '먼저 모두 작동할지 예상해 주세요.'; $('alphaPrediction').focus(); return; }
    lab.checked = true; showAlphaCheck();
  });
  function makeFields(q, values) {
    if (q.kind === 'pair') return q.labels.map(function (label, i) { return '<label>' + label + '<input type="number" name="v' + i + '" required step="1" inputmode="numeric"></label>'; }).join('');
    if (q.kind === 'sequence') return '<label>쉼표 또는 띄어쓰기로 네 숫자를 구분하세요<input type="text" name="seq" class="sequence-input" required autocomplete="off" placeholder="예: 0, 0, 0, 0"></label>';
    if (q.kind === 'choice') return q.options.map(function (text, i) { return '<label class="radio-option"><input type="radio" name="choice" value="' + i + '" required>' + esc(text) + '</label>'; }).join('');
    return '<label>하한<input type="number" name="lower" required step="any"></label><label>하한 포함<select name="left"><option value="open">제외 · 빈 점</option><option value="closed">포함 · 채운 점</option></select></label><label>상한<input type="number" name="upper" required step="any"></label><label>상한 포함<select name="right"><option value="open">제외 · 빈 점</option><option value="closed">포함 · 채운 점</option></select></label>';
  }
  function readAnswer(q) {
    const fields = $('questionFields');
    if (q.kind === 'pair') return [fields.querySelector('[name=v0]').value, fields.querySelector('[name=v1]').value];
    if (q.kind === 'sequence') return fields.querySelector('[name=seq]').value;
    if (q.kind === 'choice') { const checked = fields.querySelector('[name=choice]:checked'); return checked ? checked.value : null; }
    return [fields.querySelector('[name=lower]').value, fields.querySelector('[name=left]').value, fields.querySelector('[name=upper]').value, fields.querySelector('[name=right]').value];
  }
  function grade(q, value) {
    if (q.kind === 'pair') return Array.isArray(value) && value.length === 2 && value.every(function (v, i) { return String(v).trim() !== '' && Number(v) === q.answer[i]; });
    if (q.kind === 'choice') return value === q.answer;
    if (q.kind === 'sequence') {
      const clean = String(value).trim();
      if (!/^-?\d+(?:[\s,，]+-?\d+){3}$/.test(clean)) return false;
      return clean.split(/[\s,，]+/).map(Number).every(function (v, i) { return v === q.answer[i]; });
    }
    return Array.isArray(value) && value.length === 4 && String(value[0]).trim() !== '' && String(value[2]).trim() !== '' && Number(value[0]) === q.answer[0] && value[1] === q.answer[1] && Number(value[2]) === q.answer[2] && value[3] === q.answer[3];
  }
  // 저장값은 표시 전에 현재 문항 형식으로 확인하고 정오를 다시 계산합니다.
  const restored = {};
  QUESTIONS.forEach(function (q, i) {
    const rec = saved.answers[i];
    if (!rec || typeof rec !== 'object') return;
    const v = rec.value;
    const valid = q.kind === 'pair' ? Array.isArray(v) && v.length === 2 && v.every(function (n) { return typeof n === 'string' || typeof n === 'number'; })
      : q.kind === 'range' ? Array.isArray(v) && v.length === 4 && ['open', 'closed'].includes(v[1]) && ['open', 'closed'].includes(v[3]) && [v[0], v[2]].every(function (n) { return typeof n === 'string' || typeof n === 'number'; })
      : typeof v === 'string';
    if (valid) restored[i] = { value: v, first: rec.first === undefined ? v : rec.first, correct: grade(q, v), attempts: Array.isArray(rec.attempts) ? rec.attempts.slice(-50) : [] };
  });
  saved.answers = restored;
  function renderQuiz() {
    const q = QUESTIONS[questionIndex], record = saved.answers[questionIndex];
    hintLevel = 0; $('quizHint').hidden = true; $('quizFeedback').textContent = ''; $('quizFeedback').className = 'quiz-feedback';
    $('questionTag').textContent = (questionIndex < 8 ? '기본' : '확장') + ' 문제 ' + (questionIndex + 1) + ' / 10';
    $('questionTitle').textContent = q.title; $('questionFields').innerHTML = makeFields(q);
    $('quizNav').replaceChildren();
    QUESTIONS.forEach(function (_, i) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = i + 1;
      button.setAttribute('aria-label', (i + 1) + '번 문제'); button.setAttribute('aria-current', String(i === questionIndex));
      if (saved.answers[i] && saved.answers[i].correct) button.className = 'done';
      button.addEventListener('click', function () { questionIndex = i; renderQuiz(); });
      $('quizNav').appendChild(button);
    });
    const count = QUESTIONS.filter(function (_, i) { return saved.answers[i] && saved.answers[i].correct; }).length;
    $('quizScore').textContent = count + ' / 10 확인';
    $('nextQuestion').textContent = questionIndex === 9 ? '첫 문제로 돌아가기 ↺' : '다음 문제 →';
    if (record && record.value !== undefined) {
      const v = record.value, fields = $('questionFields');
      if (q.kind === 'pair' && Array.isArray(v)) { fields.querySelector('[name=v0]').value = v[0]; fields.querySelector('[name=v1]').value = v[1]; }
      if (q.kind === 'sequence') fields.querySelector('[name=seq]').value = String(v);
      if (q.kind === 'choice') Array.from(fields.querySelectorAll('[name=choice]')).forEach(function (el) { el.checked = el.value === v; });
      if (q.kind === 'range' && Array.isArray(v)) { ['lower', 'left', 'upper', 'right'].forEach(function (name, i) { fields.querySelector('[name=' + name + ']').value = v[i]; }); }
      $('quizFeedback').textContent = record.correct ? '이전에 확인한 답을 불러왔어요. 다시 제출해 계산을 확인할 수 있어요.' : '이전에 제출한 답을 불러왔어요. 수정해서 다시 확인해 보세요.';
    }
  }
  $('quizForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const q = QUESTIONS[questionIndex], value = readAnswer(q), correct = grade(q, value);
    const previous = saved.answers[questionIndex];
    const attempts = previous && Array.isArray(previous.attempts) ? previous.attempts.slice(-49) : [];
    attempts.push({ value: value, correct: correct });
    saved.answers[questionIndex] = { value: value, first: previous ? previous.first : value, correct: correct, attempts: attempts };
    persist();
    let message = correct ? '맞아요! ' + q.explanation : '다시 확인해 볼까요? ';
    if (!correct && q.kind === 'range' && Number(value[0]) === q.answer[0] && Number(value[2]) === q.answer[2]) {
      message += value[1] === 'closed' ? '하한과 같은 합도 통과합니다. 하한을 포함했을 때 차단해야 할 요청이 통과하지 않는지 살펴보세요.' : '상한과 같은 합도 통과합니다. 상한을 포함해도 되는지 등호를 확인하세요.';
    } else if (!correct) message += '힌트에서 확인할 위치와 계산 순서를 살펴보세요. 답을 바꾸고 다시 제출할 수 있어요.';
    renderQuiz(); $('quizFeedback').className = 'quiz-feedback ' + (correct ? 'success' : 'retry'); $('quizFeedback').textContent = message;
  });
  $('hintBtn').addEventListener('click', function () { const q = QUESTIONS[questionIndex]; $('quizHint').hidden = false; $('quizHint').textContent = '힌트 ' + (Math.min(hintLevel, 2) + 1) + '/3 · ' + q.hint[Math.min(hintLevel, 2)]; hintLevel++; });
  $('nextQuestion').addEventListener('click', function () { questionIndex = (questionIndex + 1) % QUESTIONS.length; renderQuiz(); });
  $('clearPractice').addEventListener('click', function () { if (!window.confirm('이 모션의 연습 답과 진도만 지울까요?')) return; saved = { answers: {} }; persist(); renderQuiz(); });
  async function openPractice() {
    pause();
    if (document.fullscreenElement && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch (_) { /* 전체 화면 전환이 제한되어도 조작 상태는 보존합니다. */ }
    }
    $('practice').hidden = false; renderLab(); renderQuiz();
    $('practice').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    $('practiceTitle').focus({ preventScroll: true });
  }
  $('practiceLink').addEventListener('click', function (event) { event.preventDefault(); history.replaceState(null, '', '#practice'); openPractice(); });
  $('hidePractice').addEventListener('click', function () { $('practice').hidden = true; history.replaceState(null, '', location.pathname + location.search); player.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' }); $('play').focus({ preventScroll: true }); });
  render(); renderLab(); renderQuiz(); requestAnimationFrame(tick);
  if (location.hash === '#practice') openPractice();
})();
