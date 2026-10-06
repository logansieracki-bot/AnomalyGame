// Tiny procedural audio. Everything is synthesized, no asset files.
const Sfx = (() => {
  let ctx = null, noise = null, master = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // low room hum
    const o = ctx.createOscillator(); o.frequency.value = 52;
    const g = ctx.createGain(); g.gain.value = 0.035;
    o.connect(g); g.connect(master); o.start();
  }

  function env(g, t, a, d, vol) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function burst(type, freq, q, a, d, vol, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, d, vol);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + a + d + 0.05);
  }
  function tone(freq, a, d, vol, type = 'sine', delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); env(g, t, a, d, vol);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + a + d + 0.05);
  }

  return {
    init,
    camSwitch() { burst('bandpass', 2500, 0.8, 0.01, 0.18, 0.12); },
    monitor(up) { tone(up ? 440 : 220, 0.01, 0.12, 0.08, 'square'); },
    click()     { tone(880, 0.005, 0.05, 0.06, 'square'); },
    accept()    { tone(660, 0.01, 0.12, 0.1); tone(990, 0.01, 0.2, 0.1, 'sine', 0.1); },
    reject()    { tone(140, 0.01, 0.35, 0.14, 'sawtooth'); },
    blockDoor() { burst('lowpass', 300, 1, 0.005, 0.25, 0.5); tone(70, 0.005, 0.3, 0.3); },
    // entity tells while something is waiting at your entry point
    knock()     { tone(90, 0.003, 0.14, 0.7); tone(85, 0.003, 0.14, 0.6, 'sine', 0.22); },
    scratch()   { for (let i = 0; i < 4; i++) burst('bandpass', 3200 + i * 300, 4, 0.005, 0.07, 0.25, i * 0.09); },
    breath()    { burst('lowpass', 500, 1, 0.5, 0.7, 0.3); },
    whisper()   { burst('highpass', 4500, 1, 0.3, 0.6, 0.05); },
    jam()       { burst('lowpass', 400, 1, 0.005, 0.5, 0.6); tone(45, 0.005, 0.6, 0.5, 'sawtooth'); },
    spawn()     { tone(60, 0.05, 0.4, 0.05, 'sine'); },
    jump()      { burst('bandpass', 1200, 0.5, 0.005, 0.8, 0.9); tone(60, 0.005, 0.8, 0.8, 'sawtooth'); },
    win()       { tone(523, 0.02, 0.5, 0.15); tone(659, 0.02, 0.5, 0.15, 'sine', 0.15); tone(784, 0.02, 0.9, 0.15, 'sine', 0.3); },
  };
})();
