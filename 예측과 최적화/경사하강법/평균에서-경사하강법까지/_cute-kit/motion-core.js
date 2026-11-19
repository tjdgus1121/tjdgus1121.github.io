/* 모션 해설 공통 엔진 — 수업 내용과 무관한 부분만 둔다.
 *
 * ※ 경사하강법 모션 해설의 공통 엔진에 player()의 reserve 옵션(무대 위아래에 내줄 높이)을 더한 판이다.
 *
 * 타임라인은 "장면을 길이로 이어 붙이는" 방식이다.
 *   tl.chapter('1. 기울기 정하기')      현재 위치에 장 표시(재생기의 장 이동 목록)
 *   tl.beat(4.2, (s, lt) => { … })      지속형: 시작 뒤로 계속 적용되어 상태가 쌓인다(그래프, 패널 내용 등)
 *   tl.scene(8, (s, lt) => { … })       구간형: 그 길이 동안만 적용된다(개념 카드처럼 잠깐 덮는 장면)
 * 장면을 중간에 끼우거나 길이를 바꾸면 뒤 장면의 시작 시각이 자동으로 밀린다.
 * 화면은 stateAt(t) 가 그 시각의 상태를 처음부터 다시 계산해 그리므로, 되감기·건너뛰기·영상 렌더가 모두 같은 결과를 낸다.
 */
(function (root) {
  'use strict';

  /* ---------- 시간 도구 ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  const prog = (lt, start, dur) => ease(clamp((lt - start) / dur));
  const lerp = (a, b, p) => a + (b - a) * p;
  const fade = (lt, start = 0, dur = .4) => prog(lt, start, dur);
  const pressed = (lt, at) => lt >= at && lt < at + .2;
  /* 구간형 장면의 들어오고 나가는 정도(0~1) */
  const inOut = (lt, dur, fadeIn = .45, fadeOut = .4) => Math.min(prog(lt, 0, fadeIn), 1 - prog(lt, dur - fadeOut, fadeOut));
  /* 키프레임 [[시각, 값], …] 사이를 부드럽게 보간 */
  function frames(lt, kf) {
    if (lt <= kf[0][0]) return kf[0][1];
    for (let i = 1; i < kf.length; i++) {
      const [t1, v1] = kf[i], [t0, v0] = kf[i - 1];
      if (lt <= t1) return lerp(v0, v1, ease((lt - t0) / (t1 - t0)));
    }
    return kf[kf.length - 1][1];
  }
  /* 키프레임을 따라 지나온 값의 [최소, 최대] */
  function visited(lt, kf) {
    let lo = kf[0][1], hi = lo;
    for (const [t, v] of kf) if (lt >= t) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const v = frames(lt, kf);
    return [Math.min(lo, v), Math.max(hi, v)];
  }

  /* ---------- 타임라인 ---------- */
  function timeline() {
    const entries = [], chapters = [];
    let cursor = 0;
    return {
      get time() { return cursor; },
      get duration() { return cursor; },
      chapters,
      chapter(label) { chapters.push([cursor, label]); },
      beat(dur, fn) { entries.push({ t0: cursor, until: Infinity, fn }); cursor += dur; },
      scene(dur, fn) { entries.push({ t0: cursor, until: cursor + dur, fn, dur }); cursor += dur; },
      wait(dur) { cursor += dur; },
      stateAt(t, makeState) {
        const s = makeState();
        for (const e of entries) {
          if (t < e.t0) break;
          if (t < e.until) e.fn(s, t - e.t0, e.dur);
        }
        return s;
      },
    };
  }

  /* ---------- 자막 · 포인터 상태 ---------- */
  function cap(s, lt, text, at = 0) { if (lt >= at) s.caption = { text, o: clamp((lt - at) / .35) }; }
  /* 포인터: from → to 로 moveAt 부터 dur 동안 이동, clickAt 에 클릭. 대상은 data-target 이름 */
  function point(s, lt, from, to, moveAt, clickAt, dur = .65) {
    s.pointer = {
      from, to, p: prog(lt, moveAt, dur), o: 1,
      click: clickAt != null && lt >= clickAt && lt < clickAt + .5 ? (lt - clickAt) / .5 : -1,
    };
  }
  const hidePointer = (s, lt, at = 0) => { if (s.pointer) s.pointer.o = 1 - prog(lt, at, .3); };

  /* ---------- DOM 도구 ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* 수식 그리기. Σ의 범위(i=1, 5 등)는 항상 기호 바로 위·아래에 둔다(\sum → \sum\limits).
   * root.TEX_MACROS(kit.js)에 핵심 기호의 색을 한곳에서 정해 두고 \pa(기울기 a) 같은 이름으로 쓴다. */
  function setTex(el, tex) {
    if (el.dataset.cur === tex) return;
    el.dataset.cur = tex;
    if (!tex) { el.textContent = ''; return; }
    root.katex.render(tex.replace(/\\sum(?!\\limits)/g, '\\sum\\limits'), el, { throwOnError: false, macros: { ...(root.TEX_MACROS || {}) } });
  }
  const renderTexIn = (host) => host.querySelectorAll('[data-tex]').forEach((el) => setTex(el, el.dataset.tex));
  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }

  /* ---------- 공통 렌더러 ---------- */
  function captionRenderer(el) {
    return (s) => {
      setText(el, s.caption ? s.caption.text : '');
      el.style.opacity = s.caption ? s.caption.o : 0;
    };
  }
  function pointerRenderer(stage, ptr, rip, rest = { x: 1780, y: 1140 }) {
    const lastPos = new Map();
    function targetPos(key) {
      if (key == null) return rest;
      const el = stage.querySelector(`[data-target="${key}"]`);
      if (!el) return lastPos.get(key) || rest;
      const st = stage.getBoundingClientRect(), r = el.getBoundingClientRect(), k = st.width / stage.offsetWidth;
      const pos = { x: (r.left + r.width * .55 - st.left) / k, y: (r.top + r.height * .6 - st.top) / k };
      lastPos.set(key, pos);
      return pos;
    }
    return (s) => {
      if (!s.pointer || s.pointer.o <= 0) { ptr.style.opacity = 0; rip.style.opacity = 0; return; }
      const a = targetPos(s.pointer.from), b = targetPos(s.pointer.to), p = s.pointer.p;
      const x = lerp(a.x, b.x, p), y = lerp(a.y, b.y, p) - Math.sin(Math.PI * p) * 40;
      const press = s.pointer.click >= 0 && s.pointer.click < .3 ? .88 : 1;
      ptr.style.opacity = s.pointer.o;
      ptr.style.transform = `translate(${x}px, ${y}px) scale(${press})`;
      if (s.pointer.click >= 0) {
        rip.style.opacity = (1 - s.pointer.click) * .7;
        rip.style.transform = `translate(${x}px, ${y}px) scale(${.3 + s.pointer.click * 1.2})`;
      } else rip.style.opacity = 0;
    };
  }

  /* ---------- 재생기 ----------
   * ?render=1 이면 컨트롤을 숨기고 1:1 크기로 둔다. render.mjs 는 window.__ready / __seek / __duration 을 쓴다. */
  /* audio(선택): 화면과 함께 재생할 <audio>. 재생·정지·건너뛰기에 맞춰 위치를 맞춘다. */
  // reserve: 무대 밖 위아래 요소에 내줄 높이(px). 숫자나 함수(창 크기가 바뀔 때마다 다시 잼)
  function player({ stage, wrap, width = 1920, height = 1080, duration, chapters, render, controls, audio = null, ready = null, reserve = 110 }) {
    const RENDER = new URLSearchParams(location.search).has('render');
    const st = { t: 0, playing: false, startAt: 0, startT: 0, raf: 0, rate: 1 };
    const syncAudio = () => {
      if (!audio || RENDER) return;
      audio.playbackRate = st.rate;
      if (st.playing) {
        if (Math.abs(audio.currentTime - st.t) > .25) audio.currentTime = st.t;
        if (audio.paused) audio.play().catch(() => { /* 사용자 조작 전에는 재생이 막힐 수 있음 */ });
      } else if (!audio.paused) audio.pause();
    };
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    function seek(t) {
      st.t = clamp(t, 0, duration);
      render(st.t);
      controls.scrub.value = st.t.toFixed(2);
      controls.time.value = `${fmt(st.t)} / ${fmt(duration)}`;
    }
    function setPlaying(on) {
      st.playing = on;
      cancelAnimationFrame(st.raf);
      if (on) {
        if (st.t >= duration) seek(0);
        st.startAt = performance.now(); st.startT = st.t;
        st.raf = requestAnimationFrame(tick);
      }
      controls.play.textContent = on ? '❚❚ 일시정지' : '▶ 재생';
      syncAudio();
    }
    function tick(now) {
      if (!st.playing) return;
      const t = st.startT + (now - st.startAt) / 1000 * st.rate;
      seek(t);
      if (audio && !audio.paused && Math.abs(audio.currentTime - t) > .3) audio.currentTime = t;
      if (t >= duration) { setPlaying(false); return; }
      st.raf = requestAnimationFrame(tick);
    }
    function fit() {
      const r = typeof reserve === 'function' ? reserve() : reserve;
      const k = RENDER ? 1 : Math.min((innerWidth - 32) / width, (innerHeight - r) / height, 1);
      stage.style.transform = `scale(${k})`;
      wrap.style.width = width * k + 'px';
      wrap.style.height = height * k + 'px';
    }
    async function init() {
      if (RENDER) document.body.classList.add('render');
      fit();
      addEventListener('resize', () => { fit(); seek(st.t); });
      try { await document.fonts.ready; } catch { /* 기본 글꼴로 계속 */ }
      // Optional first-frame assets must finish before the autoplay clock starts.
      // Other lessons retain their existing startup when no promise is supplied.
      if (ready) await ready;
      controls.scrub.max = duration;
      chapters.forEach(([t, label]) => {
        const o = document.createElement('option');
        o.value = t; o.textContent = `${fmt(t)}  ${label}`;
        controls.select.appendChild(o);
      });
      controls.select.addEventListener('change', () => { seek(Number(controls.select.value)); setPlaying(true); });
      controls.play.addEventListener('click', () => setPlaying(!st.playing));
      controls.restart.addEventListener('click', () => { seek(0); setPlaying(true); });
      // 재생 속도(선택): 바꾸는 순간의 위치에서 새 속도로 이어 간다. 음성도 같은 속도(음 높이는 그대로)
      if (controls.speed) controls.speed.addEventListener('change', () => {
        st.rate = Number(controls.speed.value) || 1;
        if (st.playing) { st.startAt = performance.now(); st.startT = st.t; }
        syncAudio();
      });
      // 재생 바를 누르거나 끌면: 재생 중이면 그 자리부터 이어서 재생, 멈춰 있으면 그 자리에 멈춘 채로
      controls.scrub.addEventListener('input', () => {
        seek(Number(controls.scrub.value));
        if (st.playing) {
          st.startAt = performance.now(); st.startT = st.t;
          if (audio && !RENDER) audio.currentTime = st.t;
        }
      });
      seek(0);
      if (!RENDER && !matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true);
    }
    root.__duration = duration;
    root.__seek = seek;
    root.__ready = init();
    return { seek, syncAudio, get playing() { return st.playing; }, get time() { return st.t; } };
  }

  root.Motion = {
    clamp, ease, prog, lerp, fade, pressed, inOut, frames, visited,
    timeline, cap, point, hidePointer,
    svg, esc, setTex, renderTexIn, setText, captionRenderer, pointerRenderer, player,
  };
})(window);
