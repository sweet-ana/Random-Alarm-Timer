(() => {
  'use strict';

  // ============================================
  // CONFIG
  // ============================================
  const MIN_INTERVAL_SEC = 60;
  const EDGE_MARGIN_SEC = 1;

  // ============================================
  // STATE
  // ============================================
  const state = {
    signals: [],
    totalDurationSec: 0,
    startTime: 0,
    accumulated: 0,
    running: false,
    paused: false,
    modalOpen: false,
    rafId: null,
    currentAudio: null,
    currentLang: 'ru'
  };

  // ============================================
  // DOM REFS
  // ============================================
  const $ = id => document.getElementById(id);
  const refs = {
    durationInput: $('duration'),
    countInput: $('count'),
    startBtn: $('start'),
    pauseBtn: $('pause'),
    resetBtn: $('reset'),
    timeLeftEl: $('time-left'),
    progressEl: $('progress'),
    statusEl: $('status'),
    errorEl: $('error'),
    modal: $('modal'),
    modalTitle: $('modal-title'),
    modalTime: $('modal-time'),
    modalConfirm: $('modal-confirm'),
    historyList: $('history-list')
  };

  // ============================================
  // I18N
  // ============================================
  const translations = {
    ru: {
      duration: 'Длительность (минуты)',
      count: 'Количество сигналов',
      start: '▶ Старт',
      pause: '⏸ Пауза',
      resume: '▶ Продолжить',
      reset: '⟲ Сброс',
      'status-default': 'Задайте параметры и нажмите «Старт»',
      'history-title': 'История сигналов',
      'history-empty': 'Пока пусто',
      'modal-sub': 'Время срабатывания',
      'modal-confirm': 'Подтвердить',
      'signal-prefix': 'Сигнал №',
      'status-fired': 'Сработало:',
      'status-remaining': 'Осталось:',
      'status-paused': 'на паузе',
      'status-finished': 'Таймер завершён',
      'error-invalid-duration': 'Введите корректную длительность (положительное число).',
      'error-invalid-count': 'Введите корректное количество сигналов (целое число ≥ 1).',
      'error-too-small': (count, minMin) =>
        `Для ${count} сигналов нужно минимум ${minMin} мин (минимальный интервал — 1 мин).`
    },
    en: {
      duration: 'Duration (minutes)',
      count: 'Number of alarms',
      start: '▶ Start',
      pause: '⏸ Pause',
      resume: '▶ Resume',
      reset: '⟲ Reset',
      'status-default': 'Set parameters and press "Start"',
      'history-title': 'Alarms History',
      'history-empty': 'Empty yet',
      'modal-sub': 'Trigger time',
      'modal-confirm': 'Confirm',
      'signal-prefix': 'Alarm #',
      'status-fired': 'Fired:',
      'status-remaining': 'Remaining:',
      'status-paused': 'paused',
      'status-finished': 'Timer finished',
      'error-invalid-duration': 'Please enter a valid duration (positive number).',
      'error-invalid-count': 'Please enter a valid alarm count (integer ≥ 1).',
      'error-too-small': (count, minMin) =>
        `At least ${minMin} min needed for ${count} alarms (minimum interval — 1 min).`
    }
  };

  function t(key) {
    return translations[state.currentLang][key] || key;
  }

  function applyLanguage(lang) {
    state.currentLang = lang;
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (el.tagName === 'LABEL') {
        const input = el.querySelector('input');
        el.textContent = t(key);
        if (input) el.appendChild(input);
      } else {
        el.textContent = t(key);
      }
    });

    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    const emptyHistory = refs.historyList.querySelector('.empty-history');
    if (emptyHistory) {
      emptyHistory.textContent = t('history-empty');
    }

    // Исправление: если есть сигналы, показываем их статус, иначе дефолт
    if (state.signals.length > 0) {
      updateStatus();
    } else if (!state.running && !state.paused) {
      refs.statusEl.textContent = t('status-default');
    }

    if (state.paused) {
      refs.pauseBtn.textContent = t('resume');
    } else {
      refs.pauseBtn.textContent = t('pause');
    }

    const items = refs.historyList.querySelectorAll('.history-item');
    items.forEach((item, idx) => {
      const numSpan = item.querySelector('.num');
      if (numSpan) {
        numSpan.textContent = `${t('signal-prefix')}${idx + 1}`;
      }
    });
  }

  // ============================================
  // AUDIO
  // ============================================
  function playBellOnce() {
    try {
      const a = new Audio('bell.mp3');
      a.volume = 0.8;
      a.play().catch(() => {});
    } catch (e) {}
  }

  function startBellLoop() {
    stopBellLoop();
    try {
      state.currentAudio = new Audio('bell.mp3');
      state.currentAudio.loop = true;
      state.currentAudio.volume = 0.8;
      state.currentAudio.play().catch(() => {});
    } catch (e) {}
  }

  function stopBellLoop() {
    if (state.currentAudio) {
      try {
        state.currentAudio.pause();
        state.currentAudio.currentTime = 0;
      } catch (e) {}
      state.currentAudio = null;
    }
  }

  // ============================================
  // UI HELPERS
  // ============================================
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateStatus() {
    const fired = state.signals.filter(s => s.fired).length;
    const total = state.signals.length;
    const remaining = total - fired;
    refs.statusEl.innerHTML =
      `${t('status-fired')} <strong>${fired}</strong> / ${total} · ${t('status-remaining')} <strong>${remaining}</strong>`;
  }

  function addHistoryItem(index, timeSec) {
    const empty = refs.historyList.querySelector('.empty-history');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML =
      `<span class="num">${t('signal-prefix')}${index}</span>` +
      `<span class="time">${fmt(timeSec)}</span>`;
    refs.historyList.appendChild(item);
    refs.historyList.scrollTop = refs.historyList.scrollHeight;
  }

  function clearHistory() {
    refs.historyList.innerHTML = `<div class="empty-history">${t('history-empty')}</div>`;
  }

  // ============================================
  // TIMER LOGIC
  // ============================================
  function generateTimes(durationSec, count) {
    const availableSpan = durationSec - 2 * EDGE_MARGIN_SEC;
    const minNeeded = (count - 1) * MIN_INTERVAL_SEC;
    const freeTime = availableSpan - minNeeded;

    const rands = [];
    let sum = 0;
    for (let i = 0; i < count + 1; i++) {
      const r = Math.random() || 1e-9;
      rands.push(r);
      sum += r;
    }
    const parts = rands.map(r => (r / sum) * freeTime);

    const times = [];
    let acc = parts[0];
    times.push(acc);
    for (let i = 1; i < count; i++) {
      acc += MIN_INTERVAL_SEC + parts[i];
      times.push(acc);
    }

    times.sort((a, b) => a - b);
    return times.map(v => Math.min(v + EDGE_MARGIN_SEC, durationSec - EDGE_MARGIN_SEC));
  }

  function tick() {
    if (!state.running) return;
    const now = performance.now();
    const elapsed = state.accumulated + (now - state.startTime) / 1000;

    for (const sig of state.signals) {
      if (!sig.fired && !sig.awaitingConfirm && elapsed >= sig.time) {
        triggerSignal(sig, elapsed);
        break;
      }
    }

    if (!state.modalOpen) {
      const remaining = state.totalDurationSec - elapsed;
      refs.timeLeftEl.textContent = fmt(remaining);
      const pct = Math.min(100, (elapsed / state.totalDurationSec) * 100);
      refs.progressEl.style.width = pct + '%';

      if (elapsed >= state.totalDurationSec) {
        finish();
        return;
      }
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function triggerSignal(sig, elapsed) {
    sig.fired = true;
    sig.awaitingConfirm = true;

    state.accumulated += (performance.now() - state.startTime) / 1000;
    state.running = false;
    cancelAnimationFrame(state.rafId);

    startBellLoop();

    const index = state.signals.indexOf(sig) + 1;
    refs.modalTitle.textContent = `${t('signal-prefix')}${index}`;
    refs.modalTime.textContent = fmt(sig.time);
    refs.modal.classList.add('active');
    state.modalOpen = true;

    updateStatus();
  }

  function finish() {
    state.running = false;
    state.paused = false;
    cancelAnimationFrame(state.rafId);
    refs.timeLeftEl.textContent = '00:00';
    refs.progressEl.style.width = '100%';
    refs.statusEl.innerHTML = t('status-finished');
    refs.pauseBtn.disabled = true;
    refs.pauseBtn.textContent = t('pause');
    refs.startBtn.disabled = false;
    refs.resetBtn.disabled = false;
    refs.durationInput.disabled = false;
    refs.countInput.disabled = false;

    playBellOnce();
  }

  function resetState() {
    state.signals = [];
    state.totalDurationSec = 0;
    state.startTime = 0;
    state.accumulated = 0;
    state.running = false;
    state.paused = false;
    state.modalOpen = false;
    state.rafId = null;
    state.currentAudio = null;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', () => applyLanguage(btn.dataset.lang));
  });

  refs.modalConfirm.addEventListener('click', () => {
    stopBellLoop();
    refs.modal.classList.remove('active');
    state.modalOpen = false;

    const sig = state.signals.find(s => s.awaitingConfirm);
    if (sig) {
      sig.awaitingConfirm = false;
      const index = state.signals.indexOf(sig) + 1;
      addHistoryItem(index, sig.time);
    }

    const elapsed = state.accumulated;
    if (elapsed < state.totalDurationSec) {
      state.startTime = performance.now();
      state.running = true;
      tick();
    } else {
      finish();
    }
  });

  refs.startBtn.addEventListener('click', () => {
    refs.errorEl.textContent = '';
    const durationMin = parseFloat(refs.durationInput.value);
    const countRaw = refs.countInput.value.trim();
    const count = parseInt(countRaw, 10);

    if (!durationMin || !isFinite(durationMin) || durationMin <= 0) {
      refs.errorEl.textContent = t('error-invalid-duration');
      return;
    }

    if (!countRaw || !/^\d+$/.test(countRaw) || count <= 0) {
      refs.errorEl.textContent = t('error-invalid-count');
      return;
    }

    const durationSec = durationMin * 60;

    const availableSpan = durationSec - 2 * EDGE_MARGIN_SEC;
    const minNeeded = (count - 1) * MIN_INTERVAL_SEC;
    if (availableSpan < minNeeded) {
      const minMinutes = Math.ceil((minNeeded + 2 * EDGE_MARGIN_SEC) / 60);
      refs.errorEl.textContent = t('error-too-small')(count, minMinutes);
      return;
    }

    try {
      const times = generateTimes(durationSec, count);
      state.totalDurationSec = durationSec;
      state.signals = [];
      for (let i = 0; i < count; i++) {
        state.signals.push({ time: times[i], fired: false, awaitingConfirm: false });
      }

      state.accumulated = 0;
      state.startTime = performance.now();
      state.running = true;
      state.paused = false;
      state.modalOpen = false;

      refs.durationInput.disabled = true;
      refs.countInput.disabled = true;
      refs.startBtn.disabled = true;
      refs.pauseBtn.disabled = false;
      refs.resetBtn.disabled = false;

      clearHistory();
      updateStatus();
      tick();
    } catch (e) {
      refs.errorEl.textContent = e.message;
    }
  });

  refs.pauseBtn.addEventListener('click', () => {
    if (state.modalOpen) return;
    if (!state.running && !state.paused) return;
    if (state.running) {
      state.accumulated += (performance.now() - state.startTime) / 1000;
      state.running = false;
      state.paused = true;
      cancelAnimationFrame(state.rafId);
      refs.pauseBtn.textContent = t('resume');
      refs.statusEl.innerHTML += ` · <em>${t('status-paused')}</em>`;
    } else if (state.paused) {
      state.startTime = performance.now();
      state.running = true;
      state.paused = false;
      refs.pauseBtn.textContent = t('pause');
      updateStatus();
      tick();
    }
  });

  refs.resetBtn.addEventListener('click', () => {
    state.running = false;
    state.paused = false;
    state.modalOpen = false;
    cancelAnimationFrame(state.rafId);
    stopBellLoop();
    refs.modal.classList.remove('active');
    resetState();
    refs.timeLeftEl.textContent = '00:00';
    refs.progressEl.style.width = '0%';
    refs.statusEl.textContent = t('status-default');
    refs.errorEl.textContent = '';
    clearHistory();
    refs.startBtn.disabled = false;
    refs.pauseBtn.disabled = true;
    refs.pauseBtn.textContent = t('pause');
    refs.resetBtn.disabled = true;
    refs.durationInput.disabled = false;
    refs.countInput.disabled = false;
  });

  // ============================================
  // INIT
  // ============================================
  refs.timeLeftEl.textContent = fmt(parseFloat(refs.durationInput.value) * 60 || 0);
  applyLanguage('ru');
})();
