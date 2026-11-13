/* 게임 상태 한곳 관리 + 저장(localStorage, 실패해도 게임은 계속) */
(function (root) {
  'use strict';
  const GD = root.GD;
  const KEY = 'gd-escape-v1';

  function fresh() {
    return { v: 1, map: 'hall', x: 8, y: 12, dir: 'up', avatar: 'sage', flags: {}, items: {}, picked: {}, slips: [], notes: [], used: {}, seen: {}, cards: [], parts: [], partsPlaced: [] };
  }
  function normalizeCollections(data) {
    const numbers = (values, max) => [...new Set((Array.isArray(values) ? values : []).filter(n => Number.isInteger(n) && n >= 1 && n <= max))].sort((a, b) => a - b);
    data.cards = numbers(data.cards, 4);
    data.parts = numbers(data.parts, 5);
    data.partsPlaced = numbers(data.partsPlaced, 5).filter(n => data.parts.includes(n));
    // 목록이 획득 이력의 기준이다. 진열한 부품은 가방 개수에서만 뺀다.
    data.items.card = data.cards.length;
    data.items.watchpart = data.parts.length - data.partsPlaced.length;
    return data;
  }
  const st = {
    data: fresh(),
    listeners: [],
    canSave: true,
    get flags() { return this.data.flags; },
    get picked() { return this.data.picked; },
    flag(k) { return !!this.data.flags[k]; },
    set(k, v = true) { this.data.flags[k] = v; this.changed(); },
    has(id) { return (this.data.items[id] || 0) > 0; },
    count(id) { return this.data.items[id] || 0; },
    give(id, n = 1, { quiet = false } = {}) {
      this.data.items[id] = (this.data.items[id] || 0) + n;
      const it = GD.ITEMS[id];
      if (!quiet && GD.characterMotion) GD.characterMotion.cue('discovery');
      if (!quiet && it) GD.ui.toast(n > 1 ? `${it.name} ${n}개를 얻었다` : `${it.name}을(를) 얻었다`, this.icon(id));
      if (!quiet && it && GD.ui.flyToBag) GD.ui.flyToBag(this.icon(id));
      // 성냥 + 등잔 → 불 켜기
      if (this.has('lamp') && this.has('matches') && !this.flag('lampLit')) {
        this.data.flags.lampLit = true;
        this.take('matches');
        setTimeout(() => GD.ui.toast('성냥으로 등잔에 불을 붙였다', 'icons/icon-lamp-lit.png'), 700);
      }
      GD.ui.pingBag();
      this.changed();
    },
    take(id, n = 1) {
      this.data.items[id] = Math.max(0, (this.data.items[id] || 0) - n);
      this.data.used[id] = true;
      this.changed();
    },
    icon(id) {
      const it = GD.ITEMS[id];
      if (!it) return '';
      return id === 'lamp' && this.flag('lampLit') ? it.iconLit : it.icon;
    },
    addNote(id) { if (!this.data.notes.includes(id)) { this.data.notes.push(id); this.changed(); } },
    changed() { this.save(); this.listeners.forEach((f) => f()); },
    onChange(f) { this.listeners.push(f); },
    normalizeCollections() { normalizeCollections(this.data); },
    save() {
      if (!this.canSave) return;
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { this.canSave = false; }
    },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return false;
        const d = JSON.parse(raw);
        if (!d || d.v !== 1) return false;
        this.data = Object.assign(fresh(), d);
        normalizeCollections(this.data);
        // 이전 시험판은 기록 A를 가방에 넣고도 진행 플래그를 남기지 않았다.
        if (this.has('dataA') || this.data.slips.length >= 5) {
          this.data.flags.dataA = true; this.data.items.dataA = 1; this.data.items.slip = 0;
          if (!this.data.notes.includes('A')) this.data.notes.push('A');
        }
        // 과거에 대화만 시작하고 중단해도 획득 표시가 먼저 저장되던 쇠추 복구.
        const weights = ['shelfW', 'scale2w', 'wb3', 'w1', 'w2'].filter((id) => this.data.picked[id]).length;
        this.data.items.weight = Math.max(this.count('weight'), weights);
        // 2026-11-12: 예전 버전은 일부 진행을 대화가 끝날 때만 저장해, 대화가 끊긴 저장은 영영 막혔다.
        const f = this.data.flags, it = this.data.items;
        if (f.balanceDone && !f.squaresDone && !it.chalk) it.chalk = 1;              // 천칭 → 분필
        if (f.bowlDone) f.workshopOpen = true;                                     // 유리 돔 → 작업실 문
        if (f.scrollDone && !f.stairsOpen) { f.stairsOpen = true; if (!it.knob && !f.knobIn) it.knob = 1; }   // 두루마리 → 계단
        if (f.rateDone && !f.plateIn && !it.plate) f.plateIn = true;               // 눈금판을 끼우다 끊김 → 발코니 문
        return true;
      } catch { this.canSave = false; return false; }
    },
    hasSave() { try { return !!localStorage.getItem(KEY); } catch { this.canSave = false; return false; } },
    reset() { this.data = fresh(); try { localStorage.removeItem(KEY); } catch { /* 저장 불가 환경 */ } },

    /* 지금 할 일(머리줄) */
    goal() {
      const f = this.data.flags, n = this.data.slips.length, w = this.count('weight') + (f.dataB ? 5 : 0);
      const tapeHint = !f.watched && (this.has('tape') || f.tapeIn) ? (f.tapeIn ? ' · TV에 넣어 둔 비디오테이프도 볼 수 있다' : ' · 측정실 TV에 비디오테이프를 넣어 볼 수도 있다') : '';
      if (!f.talkedCog) return '현관의 자동인형 코그에게 말을 걸어 보자 (가까이 가서 F)';
      if (!f.cover) return '위쪽 문으로 측정실에 가서 박사의 책상을 살펴보자';
      if (!f.dataA) {
        const darkLeft = [3, 4].some((i) => !this.data.slips.includes(i));
        return `측정 쪽지를 모으자 (${n}/5)` + (darkLeft && !f.lampLit && n >= 3 ? ' — 남은 쪽지는 어두운 구석에 있다. 불빛이 필요하다' : '') + tapeHint;
      }
      if (!f.drawerOpen) return '박사의 책상 서랍 자물쇠를 열자: 측정값 다섯 개를 대표하는 하나의 수는?' + tapeHint;
      if (!f.errorsDone) return '책상의 노트에서 측정값 다섯 개의 오차를 구하자' + tapeHint;
      if (!f.balanceDone) return '오차를 새긴 토큰을 천칭에 올려 보자' + tapeHint;
      if (!f.squaresDone && !f.workshopOpen) return '천칭에서 나온 분필로 뒷벽 칠판에 오차를 그려 보자' + tapeHint;
      if (!f.dialOpen && !f.workshopOpen) return '왼쪽 아래 잠긴 트렁크의 소수 다이얼을 맞추자 (칠판에 남은 수)' + tapeHint;
      if (!f.workshopOpen) return '유리 돔을 열고 기준추를 바꿔 올리며, 넓이 평균이 가장 작은 기준값을 찾자' + tapeHint;
      if (!this.has('hook') && !f.dataB) return '오른쪽 문으로 작업실에 가서 용수철 측정대를 살펴보자' + tapeHint;
      if (w < 5 && !f.dataB) return `쇠추를 모으자 (${w}/5) — 작업실 곳곳과 창고를 뒤져 보자` + tapeHint;
      if (!f.dataB) return '용수철 측정대에서 추 0~5개일 때의 길이를 재자' + tapeHint;
      // 2부 (missions3.js)
      if (!f.lineDone) return '작업실 좌표 칠판(작업 일정판)에서 측정 기록 B에 맞는 직선을 그어 보자';
      if (!f.bookDone) return '작업실 뒷벽 선반의 책 열네 권: 추 0개일 때의 길이만큼 왼쪽부터 세어 당겨 보자';
      if (!f.scrollDone) return '작업실 왼쪽 벽 아래 두루마리 통을 열고, 어느 직선이 더 좋은지 넓이 평균으로 비교하자';
      if (!f.knobIn) return '나선 계단으로 기계실에 올라가, 예측 기계에 기울기 손잡이를 끼우자';
      if (!f.slopeSeen) return '예측 기계의 손잡이를 양쪽으로 돌려 보고, 발밑 재기 레버로 기울기를 읽자';
      if (!f.dirBoxOpen) return '기계실 왼쪽 위 톱니 상자의 방향 레버: 발밑 기울기를 보고 돌릴 방향을 고르자';
      if (!f.rateDone) return '예측 기계에 톱니를 끼우고 모래시계를 뒤집어, 10번 안에 바닥(a = 2)에 닿는 톱니를 찾자';
      if (!f.plateIn) return '눈금판을 기계실 위쪽 발코니 문의 홈에 끼우자';
      if (!f.letterRead) return '발코니 벤치 위의 편지를 읽어 보자';
      if (!f.finished) return '코그와 이야기하고 오른쪽 기록판을 살펴보자';
      if (!f.leftHouse) return '탈출 성공! 현관 정문으로 나가 보자 (수집하지 못한 곳을 더 둘러봐도 좋다)';
      return '탈출 성공! 아침 종이 울렸다. 수집하지 못한 곳을 자유롭게 둘러봐도 좋다.';
    },
  };
  GD.state = st;
})(window);
