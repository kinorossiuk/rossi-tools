(() => {
  'use strict';
  const root = document.querySelector('[data-timer-tool]');
  if (!root) return;
  const stateKey = 'rossi-tools-timer-state-v1';
  const soundKey = 'rossi-tools-timer-sound-v1';
  const hours = root.querySelector('#timer-hours');
  const minutes = root.querySelector('#timer-minutes');
  const seconds = root.querySelector('#timer-seconds');
  const remaining = root.querySelector('#timer-remaining');
  const target = root.querySelector('#timer-target');
  const startButton = root.querySelector('#timer-start');
  const pauseButton = root.querySelector('#timer-pause');
  const resetButton = root.querySelector('#timer-reset');
  const soundButton = root.querySelector('#timer-sound');
  const notificationButton = root.querySelector('#timer-notification');
  const notificationCopy = root.querySelector('#timer-notification-copy');
  const status = root.querySelector('#timer-status');
  const adjustButtons = Array.from(root.querySelectorAll('[data-timer-adjust]'));
  const maxSeconds = 99 * 3600 + 59 * 60 + 59;
  const kstTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let timerId = null;
  let audioContext = null;
  let soundEnabled = localStorage.getItem(soundKey) !== 'off';
  let state = { running: false, remainingMs: 0, endsAt: null };

  const setStatus = (message, error = false) => { status.textContent = message; status.classList.toggle('is-error', error); };
  const format = (milliseconds) => {
    const allSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(allSeconds / 3600); const mins = Math.floor((allSeconds % 3600) / 60); const secs = allSeconds % 60;
    return [hours, mins, secs].map((part) => String(part).padStart(2, '0')).join(':');
  };
  const saveState = () => localStorage.setItem(stateKey, JSON.stringify(state));
  const readState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(stateKey) ?? '{}');
      if (!saved || typeof saved !== 'object') return state;
      return {
        running: saved.running === true,
        remainingMs: Number.isFinite(saved.remainingMs) ? Math.max(0, saved.remainingMs) : 0,
        endsAt: Number.isFinite(saved.endsAt) ? saved.endsAt : null,
      };
    } catch { return state; }
  };
  const inputMilliseconds = () => (Math.max(0, Number(hours.value) || 0) * 3600 + Math.max(0, Number(minutes.value) || 0) * 60 + Math.max(0, Number(seconds.value) || 0)) * 1000;
  const setInputs = (milliseconds) => {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    hours.value = String(Math.floor(total / 3600));
    minutes.value = String(Math.floor((total % 3600) / 60));
    seconds.value = String(total % 60);
  };
  const inputSeconds = () => {
    const part = (input) => {
      const value = Number(input.value);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    };
    return Math.min(maxSeconds, part(hours) * 3600 + part(minutes) * 60 + part(seconds));
  };
  const formatDuration = (total) => {
    const hourPart = Math.floor(total / 3600); const minutePart = Math.floor((total % 3600) / 60); const secondPart = total % 60;
    return hourPart > 0 ? `${hourPart}시간 ${minutePart}분 ${secondPart}초` : `${minutePart}분 ${secondPart}초`;
  };
  const adjustLocked = () => state.running || state.remainingMs > 0;
  const syncAdjustButtons = () => {
    const locked = adjustLocked(); const total = inputSeconds();
    adjustButtons.forEach((button) => {
      const delta = Number(button.dataset.timerAdjust);
      button.disabled = locked || (delta < 0 ? total <= 0 : total >= maxSeconds);
    });
  };
  const normalizeInputs = () => {
    setInputs(inputSeconds() * 1000);
    syncAdjustButtons();
  };
  const adjustDuration = (delta) => {
    if (!Number.isFinite(delta) || adjustLocked()) return;
    const total = Math.min(maxSeconds, Math.max(0, inputSeconds() + delta));
    setInputs(total * 1000);
    root.classList.remove('is-complete');
    setStatus(`설정 시간: ${formatDuration(total)}`);
    update();
  };
  const updateNotification = () => {
    if (!('Notification' in window)) { notificationButton.disabled = true; notificationCopy.textContent = '이 브라우저는 OS 알림을 지원하지 않습니다.'; return; }
    if (Notification.permission === 'granted') { notificationButton.disabled = true; notificationButton.textContent = '알림 허용됨'; notificationCopy.textContent = '타이머 종료 시 OS 알림을 표시합니다.'; }
    else if (Notification.permission === 'denied') { notificationButton.disabled = true; notificationButton.textContent = '알림 차단됨'; notificationCopy.textContent = '브라우저 설정에서 이 사이트의 알림을 허용해 주세요.'; }
  };
  const update = () => {
    const left = state.running && state.endsAt ? Math.max(0, state.endsAt - Date.now()) : state.remainingMs;
    remaining.value = format(left);
    document.title = state.running ? `${format(left)} · 타이머 · ROSSI TOOLS` : '타이머 · ROSSI TOOLS';
    if (state.running && state.endsAt) target.textContent = `종료 예정: ${kstTime.format(new Date(state.endsAt))} KST`;
    else target.textContent = left > 0 ? '일시정지됨' : '시간을 설정하고 시작하세요.';
    pauseButton.disabled = !state.running && left === 0; pauseButton.textContent = state.running ? '일시정지' : '계속'; resetButton.disabled = left === 0 && !state.running;
    syncAdjustButtons();
    if (state.running && left === 0) finish();
  };
  const sound = () => {
    if (!soundEnabled) return;
    try {
      audioContext ??= new AudioContext();
      const beep = (at, frequency) => { const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.13, at + .02); gain.gain.exponentialRampToValueAtTime(.0001, at + .22); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(at); oscillator.stop(at + .24); };
      const now = audioContext.currentTime; [0, .3, .6].forEach((offset) => beep(now + offset, 880));
    } catch { setStatus('소리를 재생할 수 없습니다. 브라우저 설정을 확인해 주세요.', true); }
  };
  const finish = () => {
    if (!state.running) return;
    state = { running: false, remainingMs: 0, endsAt: null }; saveState(); clearInterval(timerId); timerId = null;
    root.classList.add('is-complete'); sound();
    if ('Notification' in window && Notification.permission === 'granted') new Notification('타이머 완료', { body: '설정한 시간이 종료되었습니다.', tag: 'rossi-tools-timer' });
    setStatus('타이머가 완료되었습니다.'); update();
  };
  const run = () => { clearInterval(timerId); timerId = window.setInterval(update, 250); update(); };
  const start = (milliseconds) => {
    if (milliseconds <= 0) { setStatus('1초 이상의 시간을 설정해 주세요.', true); return; }
    root.classList.remove('is-complete');
    try { audioContext ??= new AudioContext(); audioContext.resume(); } catch { /* 알림음은 종료 시 다시 시도 */ }
    state = { running: true, remainingMs: milliseconds, endsAt: Date.now() + milliseconds }; saveState(); setStatus('타이머를 시작했습니다.'); run();
  };
  startButton.addEventListener('click', () => start(inputMilliseconds()));
  pauseButton.addEventListener('click', () => {
    if (state.running) { state.remainingMs = Math.max(0, state.endsAt - Date.now()); state.running = false; state.endsAt = null; saveState(); clearInterval(timerId); timerId = null; setStatus('타이머를 일시정지했습니다.'); update(); }
    else start(state.remainingMs);
  });
  resetButton.addEventListener('click', () => { state = { running: false, remainingMs: 0, endsAt: null }; saveState(); clearInterval(timerId); timerId = null; root.classList.remove('is-complete'); setStatus('타이머를 초기화했습니다.'); update(); });
  adjustButtons.forEach((button) => button.addEventListener('click', () => adjustDuration(Number(button.dataset.timerAdjust))));
  [hours, minutes, seconds].forEach((input) => { input.addEventListener('input', syncAdjustButtons); input.addEventListener('change', normalizeInputs); });
  soundButton.addEventListener('click', () => { soundEnabled = !soundEnabled; localStorage.setItem(soundKey, soundEnabled ? 'on' : 'off'); soundButton.textContent = `소리: ${soundEnabled ? '켜짐' : '꺼짐'}`; soundButton.setAttribute('aria-pressed', String(soundEnabled)); });
  notificationButton.addEventListener('click', async () => { if ('Notification' in window) { await Notification.requestPermission(); updateNotification(); } });
  state = readState();
  if (state.running && (!Number.isFinite(state.endsAt) || state.endsAt <= Date.now())) state = { running: false, remainingMs: 0, endsAt: null };
  if (!state.running && Number.isFinite(state.remainingMs) && state.remainingMs > 0) setInputs(state.remainingMs);
  soundButton.textContent = `소리: ${soundEnabled ? '켜짐' : '꺼짐'}`; soundButton.setAttribute('aria-pressed', String(soundEnabled)); updateNotification();
  if (state.running) run(); else update();
})();
