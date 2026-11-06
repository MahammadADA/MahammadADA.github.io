/* ==========================================================================
   quest/audio.js — tiny retro sound effects made with the Web Audio API.
   No sound files needed. Can be muted with the M key or the sound button.
   ========================================================================== */

window.Quest = window.Quest || {};

(function (Q) {
  const STORAGE_KEY = "mahammad-quest-sound";
  let ctx = null;
  let master = null;
  let enabled = localStorage.getItem(STORAGE_KEY) !== "off";

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, duration, { type = "square", volume = 1, slideTo = null, delay = 0 } = {}) {
    const ac = ensure();
    if (!ac) return;
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function noise(duration, { volume = 0.5, delay = 0 } = {}) {
    const ac = ensure();
    if (!ac) return;
    const length = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(master);
    src.start(ac.currentTime + delay);
  }

  Q.audio = {
    get enabled() {
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
      if (enabled) this.select();
      return enabled;
    },
    unlock() {
      ensure();
    },
    blip() {
      tone(520 + Math.random() * 80, 0.03, { volume: 0.25 });
    },
    select() {
      tone(660, 0.06, { volume: 0.5 });
      tone(990, 0.08, { volume: 0.4, delay: 0.05 });
    },
    open() {
      tone(330, 0.08, { type: "triangle", volume: 0.8 });
      tone(495, 0.1, { type: "triangle", volume: 0.7, delay: 0.06 });
    },
    pickup() {
      [784, 988, 1319].forEach((f, i) => tone(f, 0.09, { volume: 0.5, delay: i * 0.06 }));
    },
    xp() {
      tone(880, 0.08, { type: "triangle", volume: 0.7 });
      tone(1175, 0.14, { type: "triangle", volume: 0.6, delay: 0.07 });
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { volume: 0.55, delay: i * 0.09 }));
      tone(1568, 0.4, { type: "triangle", volume: 0.5, delay: 0.38 });
    },
    dice() {
      for (let i = 0; i < 7; i++) noise(0.04, { volume: 0.35, delay: i * 0.07 });
    },
    victory() {
      const notes = [523, 659, 784, 659, 784, 1047];
      notes.forEach((f, i) => tone(f, 0.18, { volume: 0.5, delay: i * 0.12 }));
      tone(1319, 0.6, { type: "triangle", volume: 0.5, delay: 0.75 });
    },
    bump() {
      tone(140, 0.06, { type: "square", volume: 0.3, slideTo: 90 });
    },
  };
})(window.Quest);
