/* 소리: 소리 파일 없이 Web Audio로 직접 만든다(인터넷·파일 불필요).
 *  - 빗소리: 잡음을 걸러 만든 실내에서 듣는 빗소리(높은 빗방울 + 낮은 지붕 울림), 천천히 세기가 출렁임
 *  - 천둥: 창문 번개(window-rain.js)가 칠 때 0.6~1.8초 뒤 낮게 우르릉
 *  - 발소리: 한 칸 걸을 때마다 짧고 작게
 * 교실을 생각해 기본은 꺼짐. 상단 🔈 버튼으로 켜고 끄며, 선택은 이 기기에 기억한다(localStorage).
 * 브라우저 규칙상 소리는 사용자가 버튼을 누른 뒤에만 시작된다. */
(function (root) {
  'use strict';
  const GD = root.GD;
  const KEY = 'gd-escape-sound';
  let nearGain = null, nearLast = -1;
  let ac = null, master = null, rainGain = null, rainBus = null, on = false, noise = null, brown = null, swellTimer = 0;
  // 소리 크기(0~1): 전체, 빗소리. 이 기기에 기억
  const LEVEL_KEY = 'gd-escape-volume';
  const levels = (() => { try { return Object.assign({ master: .8, rain: .8, music: .5 }, JSON.parse(localStorage.getItem(LEVEL_KEY) || '{}')); } catch { return { master: .8, rain: .8, music: .5 }; } })();
  function applyLevels() { if (master) master.gain.value = levels.master * 1.1; if (rainBus) rainBus.gain.value = levels.rain; musicVolume(); }
  function setLevel(kind, v) { levels[kind] = Math.max(0, Math.min(1, v)); applyLevels(); try { localStorage.setItem(LEVEL_KEY, JSON.stringify(levels)); } catch { /* 저장 못 해도 동작 */ } }

  const read = () => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } };
  const save = (v) => { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch { /* 저장 못 해도 소리는 동작 */ } };

  function buffers() {
    const len = ac.sampleRate * 2;
    noise = ac.createBuffer(1, len, ac.sampleRate);
    brown = ac.createBuffer(1, len, ac.sampleRate);
    const n = noise.getChannelData(0), b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      n[i] = w;
      last = (last + .02 * w) / 1.02;   // 갈색 잡음(낮은 소리 위주)
      b[i] = last * 3.5;
    }
  }

  function loop(buf, filters, gain) {
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    let node = src;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(gain);
    src.start(ac.currentTime + Math.random() * .1, Math.random() * 1.9);
    return src;
  }
  function filter(type, freq, q = .7) { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }

  function start() {
    if (ac) { ac.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    buffers();
    master = ac.createGain(); master.connect(ac.destination);
    rainBus = ac.createGain(); rainBus.connect(master);
    nearGain = ac.createGain(); nearGain.gain.value = .7; nearGain.connect(rainBus);
    rainGain = ac.createGain(); rainGain.gain.value = 0; rainGain.connect(nearGain);
    applyLevels();
    // 창에 부딪히는 빗방울(높은 쪽) + 지붕·벽을 타고 오는 낮은 울림. 실내라 높은 소리는 조금 깎는다.
    const hiss = ac.createGain(); hiss.gain.value = .045; hiss.connect(rainGain);
    loop(noise, [filter('bandpass', 1500, .5), filter('lowpass', 4200)], hiss);
    const roof = ac.createGain(); roof.gain.value = .11; roof.connect(rainGain);
    loop(brown, [filter('lowpass', 420)], roof);
    rainGain.gain.setTargetAtTime(1, ac.currentTime, 1.2);   // 서서히 들려오게
    // 빗줄기 세기가 몇 초마다 조금씩 출렁인다
    // 빗소리 세기는 창문 비와 같은 세기 값을 따라간다(창문 비가 없으면 조금씩 출렁임)
    swellTimer = setInterval(() => { if (!on || !ac) return; const k = GD.windowRain ? GD.windowRain.intensity : .75 + Math.random() * .25; rainGain.gain.setTargetAtTime(.45 + k * .75, ac.currentTime, 1.5); }, 1000);
  }

  function setOn(v) {
    on = !!v;
    save(on);
    if (on) start();
    else if (ac) ac.suspend();
    fadeTo(on ? wantTrack : null);
    const b = document.getElementById('btnSound');
    if (b) {
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기');
      b.querySelector('b').textContent = on ? '🔊' : '🔈';
      b.querySelector('span').textContent = on ? '소리 켬' : '소리 끔';
    }
  }

  function thunder() {
    if (!on || !ac || ac.state !== 'running') return;
    const t = ac.currentTime + .6 + Math.random() * 1.2;
    const src = ac.createBufferSource(); src.buffer = brown;
    const lp = filter('lowpass', 320); lp.frequency.setValueAtTime(320, t); lp.frequency.exponentialRampToValueAtTime(110, t + 3);
    const g = ac.createGain();
    const peak = .55 + Math.random() * .3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .12);
    g.gain.linearRampToValueAtTime(peak * .55, t + .5); g.gain.linearRampToValueAtTime(peak * .8, t + .75);   // 두 번 우르릉
    g.gain.exponentialRampToValueAtTime(.001, t + 3.2);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t, Math.random()); src.stop(t + 3.4);
    // 창유리가 덜컹: 높은 잡음을 빠르게 떨리게(초당 17번) 0.5초
    const rat = ac.createBufferSource(); rat.buffer = noise;
    const rb = filter('bandpass', 2600, 3), rg = ac.createGain(), trem = ac.createOscillator(), tg = ac.createGain();
    trem.frequency.value = 17; tg.gain.value = .025; trem.connect(tg); tg.connect(rg.gain);
    rg.gain.setValueAtTime(0, t + .08); rg.gain.linearRampToValueAtTime(.03, t + .14); rg.gain.exponentialRampToValueAtTime(.001, t + .65);
    rat.connect(rb); rb.connect(rg); rg.connect(master);
    rat.start(t + .08, Math.random()); trem.start(t + .08); rat.stop(t + .7); trem.stop(t + .7);
  }

  // 창가 가까움(0~1) → 빗소리 0.5~1.15배. 매 프레임 불려도 값이 바뀔 때만 천천히 따라간다
  function near(v) {
    if (!nearGain || Math.abs(v - nearLast) < .03) return;
    nearLast = v;
    nearGain.gain.setTargetAtTime(.5 + v * .65, ac.currentTime, .6);
  }

  // 방마다 바닥 소리: 현관 타일(높고 단단), 창고 돌(낮고 묵직), 측정실·작업실 마루(중간, 나무)
  const FLOOR = { hall: [760, 2.2, .08], storage: [430, 1.4, .1], measure: [560, 1.8, .085], workshop: [600, 1.8, .085] };
  let stepFlip = false;
  function step() {
    if (!on || !ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = noise;
    stepFlip = !stepFlip;
    const [fq, q, vol] = FLOOR[GD.state && GD.state.data.map] || [560, 1.6, .09];
    const bp = filter('bandpass', fq * (stepFlip ? 1 : 1.12), q);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.001, t + .09);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t, Math.random() * 1.8); src.stop(t + .1);
  }

  // 무거운 나무 문이 삐걱 열리는 소리: 낮게 떨리는 톱니파 + 바닥 쿵
  function door() {
    if (!on || !ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), bp = filter('bandpass', 700, 4), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(95, t + .55);
    lfo.frequency.value = 23; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);   // 삐걱거리는 떨림
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .06); g.gain.linearRampToValueAtTime(.035, t + .4); g.gain.exponentialRampToValueAtTime(.001, t + .62);
    o.connect(bp); bp.connect(g); g.connect(master);
    o.start(t); lfo.start(t); o.stop(t + .65); lfo.stop(t + .65);
    const thud = ac.createBufferSource(); thud.buffer = brown;
    const tl = filter('lowpass', 160), tg = ac.createGain();
    tg.gain.setValueAtTime(0, t + .55); tg.gain.linearRampToValueAtTime(.3, t + .57); tg.gain.exponentialRampToValueAtTime(.001, t + .9);
    thud.connect(tl); tl.connect(tg); tg.connect(master); thud.start(t + .55, Math.random()); thud.stop(t + .95);
  }

  // 할 일이 바뀔 때 낮고 짧은 종소리 한 번
  function goal() {
    if (!on || !ac || ac.state !== 'running') return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = 523;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .7);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .75);
  }

  // 방을 옮길 때: 낮게 스치는 바람 소리(문지방을 지나는 느낌)
  function pass() {
    if (!on || !ac || ac.state !== 'running') return;
    const t = ac.currentTime, src = ac.createBufferSource(); src.buffer = noise;
    const bp = filter('bandpass', 380, .9), g = ac.createGain();
    bp.frequency.setValueAtTime(260, t); bp.frequency.linearRampToValueAtTime(520, t + .35);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .12); g.gain.exponentialRampToValueAtTime(.001, t + .5);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + .55);
  }

  // 웅덩이에 떨어지는 물방울 "똑": 높은 음이 빠르게 내려감
  function drip() {
    if (!on || !ac || ac.state !== 'running') return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(520, t + .09);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + .005); g.gain.exponentialRampToValueAtTime(.001, t + .16);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .18);
  }

  // 물건을 얻었을 때 짧은 두 음(도-솔)
  function pickup() {
    if (!on || !ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    [[784, 0], [1175, .09]].forEach(([f, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.08, t + d + .01); g.gain.exponentialRampToValueAtTime(.001, t + d + .35);
      o.connect(g); g.connect(master); o.start(t + d); o.stop(t + d + .4);
    });
  }

  /* ---------- 배경음악 (audio/*.mp3) ----------
   * 탐험·타이틀·발코니 엔딩 = The Observatory Key, 미션(수수께끼) 화면이 열려 있는 동안 = The Scholar's Pendulum (사용자 지정 2026-11-10).
   * 두 곡 모두 크게 녹음되어(-11 LUFS) 빗소리 아래 깔리도록 낮춰 튼다. 곡을 바꿀 때 1.2초 동안 겹치며 넘어간다. */
  const TRACKS = { explore: 'audio/observatory-key.mp3', title: 'audio/observatory-key.mp3', ending: 'audio/observatory-key.mp3', puzzle: 'audio/scholars-pendulum.mp3' };
  const players = {};
  let wantTrack = null, fadeTimer = 0;
  const target = () => levels.master * levels.music * .42;
  function player(name) {
    const src = TRACKS[name];
    if (!players[src]) { const a = new Audio(src); a.loop = true; a.preload = 'none'; a.volume = 0; players[src] = a; }
    return players[src];
  }
  function musicVolume() { const p = wantTrack && on ? player(wantTrack) : null; if (p && !fadeTimer) p.volume = target(); }
  function fadeTo(name) {
    clearInterval(fadeTimer); fadeTimer = 0;
    const next = name && on ? player(name) : null;
    if (next && next.paused) { next.volume = 0; const pr = next.play(); if (pr && pr.catch) pr.catch(() => {}); }
    const others = Object.values(players).filter((p) => p !== next && !p.paused);
    let t = 0;
    fadeTimer = setInterval(() => {
      t = Math.min(1, t + .05);
      if (next) next.volume = target() * t;
      others.forEach((p) => { p.volume = Math.max(0, p.volume * (1 - t)); if (t >= 1) p.pause(); });
      if (t >= 1) { clearInterval(fadeTimer); fadeTimer = 0; }
    }, 60);
  }
  // 화면이 원하는 곡을 알려 준다. 소리가 꺼져 있으면 기억만 해 두고, 켤 때 그 곡부터 튼다
  function music(name) {
    if (!TRACKS[name] || TRACKS[name] === (wantTrack && TRACKS[wantTrack])) { wantTrack = name; return; }
    wantTrack = name;
    if (on) fadeTo(name);
  }

  function init() {
    const b = document.getElementById('btnSound');
    if (b) b.addEventListener('click', () => setOn(!on));
    // 저장된 '켬'은 화면을 처음 누를 때 시작(브라우저 자동재생 규칙)
    if (read()) {
      setOn(false); on = true; save(true);
      const resume = () => { setOn(true); removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); };
      addEventListener('pointerdown', resume); addEventListener('keydown', resume);
      if (b) { b.querySelector('b').textContent = '🔊'; b.querySelector('span').textContent = '소리 켬'; b.setAttribute('aria-pressed', 'true'); }
    }
    document.addEventListener('visibilitychange', () => {
      if (!ac || !on) return;
      if (document.hidden) { ac.suspend(); Object.values(players).forEach((p) => p.pause()); } else { ac.resume(); fadeTo(wantTrack); }
    });
    addEventListener('pagehide', () => clearInterval(swellTimer));
  }

  GD.sound = { init, thunder, step, pickup, door, goal, near, pass, drip, music, setOn,
    /* 지금 재생 중인 곡 파일 이름(확인용) */
    get nowPlaying() { return Object.entries(players).filter(([, p]) => !p.paused).map(([src]) => src.split('/').pop()); }, setLevel, get levels() { return { ...levels }; }, get on() { return on; } };
})(window);
