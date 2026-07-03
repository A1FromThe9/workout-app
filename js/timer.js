// Rest timer: countdown driven by wall-clock timestamps so it stays accurate
// even if the tab throttles setInterval (e.g. screen dimmed mid-set).
const RestTimer = (() => {
  let endAt = null; // authoritative while running
  let remainingSeconds = 0; // authoritative while paused/stopped
  let intervalId = null;
  let onTick = () => {};
  let onDone = () => {};

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Web Audio unavailable; silently skip.
    }
  }

  function vibrate() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  function currentRemaining() {
    if (intervalId && endAt) {
      return Math.max(0, Math.round((endAt - Date.now()) / 1000));
    }
    return remainingSeconds;
  }

  function tick() {
    const remaining = currentRemaining();
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      remainingSeconds = 0;
      beep();
      vibrate();
      onDone();
    }
  }

  return {
    start(seconds, callbacks = {}) {
      onTick = callbacks.onTick || onTick;
      onDone = callbacks.onDone || onDone;
      remainingSeconds = seconds;
      endAt = Date.now() + seconds * 1000;
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(tick, 250);
      tick();
    },
    pause() {
      if (intervalId) {
        remainingSeconds = currentRemaining();
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    resume() {
      if (!intervalId && remainingSeconds > 0) {
        endAt = Date.now() + remainingSeconds * 1000;
        intervalId = setInterval(tick, 250);
        tick();
      }
    },
    reset() {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      remainingSeconds = 0;
      endAt = null;
    },
    isRunning() {
      return intervalId !== null;
    },
    getRemaining() {
      return currentRemaining();
    },
  };
})();

window.RestTimer = RestTimer;
