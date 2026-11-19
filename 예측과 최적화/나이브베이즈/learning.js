'use strict';

// 저장값은 현재 장면 목록과 맞는지 검증한다. 문항 내부의 미완료 조작은 단계부터 다시 진행한다.
const PROGRESS_VERSION = 2;
function readProgress(value, signature, count) {
  if (!value || value.version !== PROGRESS_VERSION || value.signature !== signature) return null;
  const valid = n => Number.isInteger(n) && n >= 0 && n < count;
  if (!valid(value.current) || !Array.isArray(value.visited) || !Array.isArray(value.completed)) return null;
  const completed = [...new Set(value.completed.filter(valid))];
  const visited = [...new Set([...value.visited.filter(valid), ...completed, value.current])];
  const history = {};
  for (const [key, rows] of Object.entries(value.history || {})) {
    if (!/^\d+$/.test(key) || !valid(Number(key)) || !Array.isArray(rows)) continue;
    history[key] = rows.slice(-24).filter(row => row && typeof row.prompt === 'string' && typeof row.text === 'string')
      .map(row => ({ prompt: row.prompt.slice(0, 1200), text: row.text.slice(0, 2400) }));
  }
  const checks = {};
  for (const [key, row] of Object.entries(value.checks || {})) {
    if (!/^[1-4]-\d+$/.test(key) || !row || typeof row.done !== 'boolean') continue;
    checks[key] = { done: row.done, assisted: row.assisted === true, attempts: Math.max(0, Math.min(100, Number(row.attempts) || 0)) };
  }
  return { current: value.current, visited, completed, history, checks };
}

const Learning = {
  ready: false, key: 'nb-learning-progress-v2', history: {}, checks: {}, saved: null,
  offerResume: false, storageOK: true, fitFrame: 0,
  plain(html) { const tmp = document.createElement('div'); tmp.innerHTML = html || ''; return tmp.textContent.trim(); },
  init() {
    if (this.ready) return;
    this.ready = true;
    this.signature = STEPS.map(step => step.progressKey || step.title).join('|');
    try {
      const raw = localStorage.getItem(this.key);
      try { this.saved = readProgress(JSON.parse(raw), this.signature, STEPS.length); } catch (_) { this.saved = null; }
    } catch (_) { this.storageOK = false; }
    if (this.saved) {
      app.visited = new Set(this.saved.visited); app.completed = new Set(this.saved.completed);
      this.history = this.saved.history; this.checks = this.saved.checks;
      this.offerResume = this.saved.current > 0 || this.saved.completed.length > 0;
    }
    $('#resumeLesson').addEventListener('click', () => {
      if (app.transitioning || app.assisting) return;
      const i = this.saved.current; this.offerResume = false; $('#resumeBanner').hidden = true; go(i);
    });
    $('#reviewStart').addEventListener('click', () => { this.offerResume = false; this.save(); this.render(); });
    $('#restartLesson').addEventListener('click', () => { $('.learning-tools').open = false; $('#restartDialog').showModal(); });
    $('#confirmRestart').addEventListener('click', () => this.restart());
    $('#stepSelect').addEventListener('change', event => {
      const i = Number(event.target.value);
      if (app.visited.has(i) && !app.transitioning && !app.assisting) { this.offerResume = false; go(i); }
    });
    $('#historyBtn').addEventListener('click', () => { $('.learning-tools').open = false; this.showHistory(); });
    $('#dataBtn').addEventListener('click', () => { $('.learning-tools').open = false; $('#dataFilter').value = 'all'; this.showData(); $('#dataDialog').showModal(); });
    $('#dataFilter').addEventListener('change', () => this.showData());
    $('#viewScale').addEventListener('change', () => { fit(); this.moveTarget(); });
    $('#focusTarget').addEventListener('click', () => { $('.learning-tools').open = false; this.moveTarget(true); });
    $('#questionToggle').addEventListener('click', () => setQuestionCollapsed(!$('#task').classList.contains('collapsed')));
    $('#stageWrap').addEventListener('scroll', () => Guide.refresh(), { passive: true });
    document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));
  },
  save() {
    if (!this.ready || this.offerResume) return;
    const value = { version: PROGRESS_VERSION, signature: this.signature, current: app.i,
      visited: [...app.visited], completed: [...app.completed], history: this.history, checks: this.checks };
    try { localStorage.setItem(this.key, JSON.stringify(value)); this.storageOK = true; }
    catch (_) { this.storageOK = false; }
  },
  begin() { this.offerResume = false; $('#resumeBanner').hidden = true; },
  restart() {
    if (app.transitioning || app.assisting) return;
    $('#restartDialog').close(); this.begin(); this.saved = null; this.history = {}; this.checks = {};
    app.completed.clear(); app.visited.clear(); go(0);
  },
  record(task, message, assisted, attempts) {
    this.begin();
    const prompt = this.plain(typeof task.prompt === 'function' ? task.prompt() : task.prompt);
    const text = this.plain(message);
    if (text) {
      const rows = this.history[app.i] || [];
      const existing = rows.findIndex(row => row.prompt === prompt);
      const row = { prompt, text };
      if (existing >= 0) rows[existing] = row; else rows.push(row);
      this.history[app.i] = rows.slice(-24);
    }
    if (task.checkId) this.checks[task.checkId] = { done: true, assisted, attempts };
    this.save(); this.render();
  },
  render() {
    if (!this.ready) return;
    const checkCount = Object.values(this.checks).filter(row => row.done).length;
    const aided = Object.values(this.checks).filter(row => row.done && row.assisted).length;
    $('#progressStatus').textContent = `${STEPS.length}단계 중 ${app.completed.size}단계 완료${checkCount ? ` · 확인 문제 ${checkCount}개 완료${aided ? ` (도움 ${aided}개)` : ''}` : ''} · ${this.storageOK ? '이 브라우저에 자동 저장' : '브라우저 저장을 사용할 수 없어요'}`;
    $('#resumeBanner').hidden = !this.offerResume;
    if (this.offerResume) $('#resumeText').textContent = `지난 학습: ${this.saved.current + 1}단계 ‘${STEPS[this.saved.current].title}’. 이어서 학습하면 그 단계의 조작부터 다시 시작해요.`;
    const select = $('#stepSelect'); select.replaceChildren();
    STEPS.forEach((step, i) => select.append(h('option', { value: i, disabled: !app.visited.has(i) }, `${i + 1}. ${step.title}${app.completed.has(i) ? ' ✓' : !app.visited.has(i) ? ' · 아직 배우지 않음' : ''}`)));
    select.value = String(app.i);
    const busy = app.transitioning || app.assisting;
    ['stepSelect', 'restartLesson', 'resumeLesson', 'reviewStart'].forEach(id => { $(`#${id}`).disabled = busy; });
    $('#dataBtn').hidden = !STEPS[app.i].deck;
    $('#focusTarget').disabled = !Guide.targets.some(el => el.isConnected);
  },
  requestFit() {
    cancelAnimationFrame(this.fitFrame);
    this.fitFrame = requestAnimationFrame(() => fit());
  },
  moveTarget(explicit = false) {
    const wrap = $('#stageWrap');
    const elements = Guide.targets.filter(el => el.isConnected && getComputedStyle(el).display !== 'none' && el.getAttribute('visibility') !== 'hidden');
    if (!elements.length) return;
    const el = elements.find(node => node.matches?.('button, .handle, .term, .cut-guide, [role="button"]')) || elements[0];
    const r = el.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const left = wrap.scrollLeft + r.left - wr.left - Math.max(12, (wrap.clientWidth - r.width) / 2);
    // 작은 화면에서는 조작 대상을 위쪽에 두어 아래쪽에 질문 자리를 남긴다.
    const top = wrap.scrollTop + r.top - wr.top - Math.max(12, Math.min(56, (wrap.clientHeight - r.height) / 2));
    const x = !explicit && r.left >= wr.left + 12 && r.right <= wr.left + wrap.clientWidth - 12 ? wrap.scrollLeft : Math.max(0, left);
    const y = !explicit && r.top >= wr.top + 12 && r.bottom <= wr.top + wrap.clientHeight - 12 ? wrap.scrollTop : Math.max(0, top);
    wrap.scrollTo({ left: x, top: y, behavior: REDUCE ? 'instant' : 'smooth' });
    if (explicit) wrap.scrollIntoView({ block: 'nearest', behavior: REDUCE ? 'instant' : 'smooth' });
  },
  showHistory() {
    const root = $('#historyContent'); root.replaceChildren();
    root.append(h('h3', null, `${app.i + 1}. ${STEPS[app.i].title}`), h('p', { html: STEPS[app.i].say }));
    const rows = this.history[app.i] || [];
    if (!rows.length) root.append(h('p', null, '문제를 풀면 정답 설명도 여기에 남아요.'));
    rows.forEach(row => root.append(h('article', { class: 'history-item' }, h('h3', null, row.prompt), h('p', null, row.text))));
    $('#historyDialog').showModal();
  },
  showData() {
    const free = $('#dataFilter').value === 'free';
    const ids = ORDER.filter(id => !free || has(id, '무료'));
    const root = $('#dataContent'); root.replaceChildren();
    ids.forEach(id => {
      // 라벨을 뒤집기 전에는 확대 자료에서도 정답 라벨을 공개하지 않는다.
      const badge = Deck.cards[id].el.querySelector('.badge').textContent;
      const words = MSG[id].words;
      root.append(h('article', { class: `readable-card${badge.startsWith('!') ? ' spam' : badge.startsWith('✓') ? ' ham' : ''}` },
        h('strong', null, `문자 ${ORDER.indexOf(id) + 1} · ${badge}`), h('p', null, MSG[id].text),
        h('small', null, `단어장에 있는 단어: ${words.length ? words.join(', ') : '없음'}`)));
    });
    $('#dataCount').textContent = `${free ? '‘무료’ 포함' : '전체'} ${ids.length}통. 라벨은 현재 학습 화면과 같아요.`;
  },
};
