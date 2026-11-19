// 추세선 대포 — 효과음 (파일 없이 Web Audio로 만듦). 첫 클릭 뒤에만 소리가 남(브라우저 정책)
const KEY = 'trendCannon.mute';
let ctx = null, master = null, muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* 저장 못 해도 진행 */ }

export const isMuted = () => muted;
export function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* 무시 */ }
  if (master) master.gain.value = muted ? 0 : 0.5;
}

// 사용자 동작(클릭·키) 때 불러 오디오를 깨움
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}

function ready() { return ctx && master && !muted && ctx.state === 'running'; }

function tone(freq, dur, { type = 'sine', vol = 0.3, to = null, delay = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, { vol = 0.3, from = 800, to = 300, q = 1, delay = 0 } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}

// 소리 목록
export const sfx = {
  fire(p = 1) { if (!ready()) return; tone(220 + 160 * (1 - p), 0.12, { type: 'square', vol: 0.08 + 0.1 * p, to: 70 }); noise(0.1, { vol: 0.15 * p, from: 1800, to: 400 }); },
  wind(p = 1) { if (!ready()) return; noise(0.35 + 0.2 * p, { vol: 0.12 + 0.12 * p, from: 500, to: 1600, q: 0.8 }); },
  hit(p = 1) { if (!ready()) return; tone(140, 0.18, { type: 'triangle', vol: 0.25 * (0.5 + p / 2), to: 60 }); noise(0.12, { vol: 0.12, from: 900, to: 200 }); },
  charge(p) { if (!ready()) return; tone(300 + 500 * p, 0.05, { type: 'sine', vol: 0.03 }); },
  count() { if (!ready()) return; tone(660, 0.12, { type: 'sine', vol: 0.2 }); },
  go() { if (!ready()) return; tone(990, 0.25, { type: 'sine', vol: 0.25 }); },
  tick() { if (!ready()) return; tone(1200, 0.05, { type: 'square', vol: 0.05 }); },
  end() { if (!ready()) return; tone(523, 0.5, { type: 'triangle', vol: 0.25 }); tone(392, 0.7, { type: 'triangle', vol: 0.22, delay: 0.18 }); },
  reveal() { if (!ready()) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.16, delay: i * 0.09 })); },
  rankUp() { if (!ready()) return; tone(440, 0.15, { type: 'sine', vol: 0.15, to: 880 }); },
};
