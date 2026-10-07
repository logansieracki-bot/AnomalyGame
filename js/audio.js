// Audio engine.
//
// Real recordings are loaded from assets/audio/manifest.json (see assets/audio/README.md).
// Web Audio is used only for MIXING: loops, panning, filtering, reverb, ducking.
// Anything missing from the manifest falls back to a quiet synthesized stand-in so the game
// is always playable, but the intent is that every stand-in gets replaced by a real recording.
//
// Signal flow:
//   beds (camera / rooms / office) -> ambFilter -> ambDuck ----------------\
//   phantoms (lowpass + pan + wall reverb) -> phantomBus ------------------+-> master -> compressor -> out
//   tells / body / impacts / ui -> own buses -------------------------------/
const Sfx = (() => {
  const BASE = 'assets/audio/';
  let ctx = null, master, comp, ambFilter, ambDuck, convolver;
  const bus = {};                       // named gain nodes
  const buf = {};                       // 'group.key' -> [AudioBuffer]
  const bag = {};                       // 'group.key' -> shuffle bag of indexes
  const status = {};                    // 'group.key' -> { want: n, loaded: n }
  let noise = null;
  const beds = { cam: [], office: [], rooms: {} };   // looping sources (for pitch/spool effects)
  const roomGain = {};
  let loadedPromise = null;

  const S = {
    volume: 0.8, reduced: false,
    beatT: 0, breathT: 2, wasHolding: false,
    phantomT: 12, deadAirT: 60, glitchT: 30, creakT: 15, deadUntil: 0,
    dying: false,
  };
  try { S.volume = parseFloat(localStorage.getItem('as_vol') ?? S.volume); S.reduced = localStorage.getItem('as_reduced') === '1'; } catch (e) {}

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- setup ----------
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();             // acts as a limiter so nothing clips
    comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.25;
    master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
    for (const n of ['cam', 'office', 'phantom', 'tell', 'body', 'impact', 'ui']) { bus[n] = ctx.createGain(); }
    ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 16000;
    ambDuck = ctx.createGain();
    bus.cam.connect(ambFilter); bus.office.connect(ambFilter); ambFilter.connect(ambDuck); ambDuck.connect(master);
    for (const n of ['phantom', 'tell', 'body', 'impact', 'ui']) bus[n].connect(master);
    bus.cam.gain.value = 1; bus.office.gain.value = 0.3;
    applyMix();

    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    convolver = ctx.createConvolver();                  // "through a wall" reverb for phantoms; replaced by an IR file if provided
    convolver.buffer = makeIR(1.6);
    convolver.connect(bus.phantom);

    loadedPromise = load().then(startBeds);
  }
  function makeIR(sec) {                                // plain decaying noise: reverb DSP, not a sound effect
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  function applyMix() {
    if (!ctx) return;
    master.gain.value = S.volume;
    bus.impact.gain.value = S.reduced ? 0.4 : 1;
  }

  // ---------- loading ----------
  function flatten(obj, prefix, out) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? prefix + '.' + k : k;
      if (typeof v === 'string') out[key] = [v];
      else if (Array.isArray(v)) out[key] = v;
      else if (v && typeof v === 'object') flatten(v, key, out);
    }
    return out;
  }
  async function load() {
    let manifest = {};
    try { manifest = await (await fetch(BASE + 'manifest.json')).json(); } catch (e) { return; }   // no manifest / file:// -> synth fallbacks only
    const entries = flatten(manifest, '', {});
    await Promise.all(Object.entries(entries).map(async ([key, paths]) => {
      status[key] = { want: paths.length, loaded: 0 };
      for (const p of paths) {
        try {
          const r = await fetch(BASE + p); if (!r.ok) continue;
          const b = await ctx.decodeAudioData(await r.arrayBuffer());
          (buf[key] ||= []).push(b); status[key].loaded++;
        } catch (e) { /* missing or undecodable: skip silently */ }
      }
    }));
  }
  const has = key => !!(buf[key] && buf[key].length);
  function pick(key) {                                  // shuffle bag: no repeats until all have played
    const list = buf[key]; if (!list || !list.length) return null;
    let b = bag[key]; if (!b || !b.length) { b = bag[key] = list.map((_, i) => i).sort(() => Math.random() - 0.5); }
    return list[b.pop()];
  }

  // ---------- primitives ----------
  function loop(buffer, out, gain = 1) {
    const s = ctx.createBufferSource(); s.buffer = buffer; s.loop = true;
    const g = ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(out); s.start(0, Math.random() * buffer.duration);
    return { s, g };
  }
  function play(key, { out = bus.ui, vol = 1, pan = 0, rate = 1, lp = 0, delay = 0 } = {}) {
    const b = pick(key); if (!b) return null;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    let node = s;
    const g = ctx.createGain(); g.gain.value = vol; node.connect(g); node = g;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(out); s.start(t);
    return s;
  }
  function env(g, t, a, d, vol) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // stand-ins used only when no recording is available
  function burst(type, freq, q, a, d, vol, out, delay = 0, pan = 0) {
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, d, vol);
    s.connect(f); f.connect(g);
    let n = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
    n.connect(out); s.start(t, Math.random()); s.stop(t + a + d + 0.05);
  }
  function tone(freq, a, d, vol, out, type = 'sine', delay = 0, pan = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); env(g, t, a, d, vol); o.connect(g);
    let n = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
    n.connect(out); o.start(t); o.stop(t + a + d + 0.05);
  }

  // ---------- ambience beds ----------
  function startBeds() {
    if (!ctx) return;
    if (has('cam.base')) beds.cam.push(loop(pick('cam.base'), bus.cam, 0.8));
    else { // stand-in: tape hiss + mains hum
      const hiss = loop(noise, bus.cam, 0.025); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3500;
      hiss.g.disconnect(); hiss.g.connect(f); f.connect(bus.cam); beds.cam.push(hiss);
      const o = ctx.createOscillator(); o.frequency.value = 60; const g = ctx.createGain(); g.gain.value = 0.02; o.connect(g); g.connect(bus.cam); o.start();
    }
    for (const r of ROOMS) {
      const key = 'rooms.' + r.id;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(bus.cam); roomGain[r.id] = g;
      if (has(key)) beds.rooms[r.id] = loop(pick(key), g, 0.7);
    }
    if (has('office.base')) beds.office.push(loop(pick('office.base'), bus.office, 0.8));
    else { // stand-in: low air-handling rumble
      const rumble = loop(noise, bus.office, 0.18); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      rumble.g.disconnect(); rumble.g.connect(f); f.connect(bus.office); beds.office.push(rumble);
    }
    if (has('body.tinnitus')) { const t = loop(pick('body.tinnitus'), bus.body, 0); bus.tinn = t.g; }
    else { const o = ctx.createOscillator(); o.frequency.value = 7200; const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(bus.body); o.start(); bus.tinn = g; }
  }
  function allBedSources() { return [...beds.cam, ...beds.office, ...Object.values(beds.rooms)].map(b => b.s); }

  // ---------- phantoms: far, muffled, through walls, never a knock/scratch/breath ----------
  function phantom() {
    if (!ctx) return;
    const pan = rand(-0.55, 0.55) * (Math.random() < 0.5 ? 1 : -1) * 0.9;
    const lp = rand(700, 1800);
    if (has('phantoms')) {
      const b = pick('phantoms'), s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rand(0.92, 1.05);
      const g = ctx.createGain(); g.gain.value = rand(0.35, 0.8);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = pan;
      const dry = ctx.createGain(); dry.gain.value = 0.35; const wet = ctx.createGain(); wet.gain.value = 0.9;
      s.connect(g); g.connect(f); f.connect(p); p.connect(dry); dry.connect(bus.phantom); p.connect(wet); wet.connect(convolver);
      s.start();
    } else {                                            // stand-in: a distant dull thump or creak
      const out = ctx.createGain(); out.gain.value = 1; out.connect(convolver); out.connect(bus.phantom);
      if (Math.random() < 0.5) tone(rand(55, 80), 0.03, 0.35, 0.12, out, 'sine', 0, pan);
      else burst('bandpass', rand(300, 500), 6, 0.4, 0.5, 0.04, out, 0, pan);
    }
  }
  function deadAir() {                                  // sudden silence is scarier than noise
    if (!ctx || S.dying) return;
    const t = ctx.currentTime, dur = rand(2, 5);
    ambDuck.gain.cancelScheduledValues(t); ambDuck.gain.setTargetAtTime(0, t, 0.05);
    ambDuck.gain.setTargetAtTime(1, t + dur, 0.5);
    S.deadUntil = t + dur;
  }
  function duck(level, sec) {                           // brief hold-your-breath dip
    if (!ctx || S.dying || ctx.currentTime < S.deadUntil) return;
    const t = ctx.currentTime;
    ambDuck.gain.cancelScheduledValues(t); ambDuck.gain.setTargetAtTime(level, t, 0.04); ambDuck.gain.setTargetAtTime(1, t + sec, 0.4);
  }

  // ---------- body: heartbeat, breathing, tinnitus ----------
  function beat(vol) {
    if (has('body.heartbeat')) play('body.heartbeat', { out: bus.body, vol });
    else { tone(52, 0.01, 0.16, vol * 0.5, bus.body); tone(46, 0.01, 0.2, vol * 0.4, bus.body, 'sine', 0.17); }
  }
  function breathe(vol) {
    if (has('body.breath')) play('body.breath', { out: bus.body, vol, rate: rand(0.95, 1.08) });
    else burst('lowpass', 500, 1, 0.5, 0.7, vol * 0.25, bus.body);
  }
  function gasp(vol = 0.7) {
    if (has('body.gasp')) play('body.gasp', { out: bus.body, vol });
    else burst('bandpass', 900, 0.7, 0.05, 0.4, vol * 0.3, bus.body);
  }

  // ---------- per-frame driver (called by ui.js, or the sound test page) ----------
  // st: { monitor, cam, fear, overload, night, progress, running, holding }
  function frame(dt, st) {
    if (!ctx || S.dying) return;
    const t = ctx.currentTime, fear = clamp(st.fear, 0, 1);
    bus.cam.gain.setTargetAtTime(st.monitor ? 1 : 0.12, t, 0.2);
    bus.office.gain.setTargetAtTime(st.monitor ? 0.3 : 1, t, 0.2);
    for (const id in roomGain) roomGain[id].gain.setTargetAtTime(st.monitor && id === st.cam ? 1 : 0, t, 0.2);
    ambFilter.frequency.setTargetAtTime(16000 - fear * 12500, t, 0.3);            // tunnel hearing
    for (const s of allBedSources()) s.detune.setTargetAtTime(-fear * 120, t, 0.5);
    if (bus.tinn) bus.tinn.gain.setTargetAtTime(fear * 0.02, t, 0.8);
    if (!st.running) return;

    const night = st.night || 1, prog = st.progress || 0, pace = 1 + night * 0.15 + prog;
    // heartbeat + breathing follow fear
    if (fear > 0.12) {
      S.beatT -= dt;
      if (S.beatT <= 0) { beat(0.15 + 0.85 * fear); S.beatT = 60 / (55 + 95 * fear); }
    }
    if (st.holding) S.wasHolding = true;                                           // breath held: silence
    else {
      if (S.wasHolding) { gasp(0.4 + 0.5 * fear); S.wasHolding = false; S.breathT = 2; }
      if (fear > 0.3) { S.breathT -= dt; if (S.breathT <= 0) { breathe(0.2 + 0.6 * fear); S.breathT = 3.4 - 2.6 * fear; } }
    }
    // random world: phantoms, dead air, tape glitches, house creaks
    S.phantomT -= dt; if (S.phantomT <= 0) { phantom(); S.phantomT = rand(14, 32) / pace; }
    S.deadAirT -= dt; if (S.deadAirT <= 0) { deadAir(); S.deadAirT = rand(45, 90) / (1 + night * 0.1); }
    S.glitchT -= dt; if (S.glitchT <= 0) { S.glitchT = rand(25, 60); if (st.monitor) glitch(); }
    S.creakT -= dt; if (S.creakT <= 0) { S.creakT = rand(10, 25); if (!st.monitor) officeOneShot(); }
  }
  function glitch() {
    if (!ctx) return;
    if (has('cam.dropout')) play('cam.dropout', { out: bus.cam, vol: 0.7 });
    else burst('highpass', 2500, 0.5, 0.01, 0.12, 0.08, bus.cam);
    if (api.onGlitch) api.onGlitch();
  }
  function officeOneShot() {
    if (has('office.oneshot')) play('office.oneshot', { out: bus.office, vol: rand(0.4, 0.9), pan: rand(-0.8, 0.8) });
    else tone(rand(70, 110), 0.02, 0.2, 0.08, bus.office, 'sine', 0, rand(-0.8, 0.8));
  }

  // ---------- events ----------
  function spike(amount) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (bus.tinn) { bus.tinn.gain.cancelScheduledValues(t); bus.tinn.gain.setTargetAtTime(Math.min(0.12, 0.02 + amount * 0.1), t, 0.05); }
    S.beatT = 0;                                                                   // heart jumps immediately
  }
  function sight() {                                                               // the room holds its breath
    if (!ctx) return;
    duck(0.2, 1.6);
    if (has('impacts.sight')) play('impacts.sight', { out: bus.impact, vol: 0.7 });
    else tone(38, 0.05, 0.9, 0.35, bus.impact, 'sine');
  }
  function tell(kind, entry) {                                                     // close, dry, physical (opposite of phantoms)
    if (!ctx) return;
    const pan = entry === 'vent' ? 0.6 : -0.6;
    if (has('tell.' + kind)) { play('tell.' + kind, { out: bus.tell, vol: 0.9, pan }); return; }
    if (kind === 'knock') { tone(90, 0.003, 0.14, 0.7, bus.tell, 'sine', 0, pan); tone(85, 0.003, 0.14, 0.6, bus.tell, 'sine', 0.22, pan); }
    else if (kind === 'scratch') for (let i = 0; i < 4; i++) burst('bandpass', 3200 + i * 300, 4, 0.005, 0.07, 0.25, bus.tell, i * 0.09, pan);
    else burst('lowpass', 500, 1, 0.5, 0.7, 0.3, bus.tell, 0, pan);
  }

  // Death sequences: silence, then one dry physical event. Returns ms until the end screen should appear.
  function death(cause) {
    if (!ctx) return 700;
    S.dying = true;
    const t = ctx.currentTime;
    for (const g of [ambDuck, bus.phantom, bus.body]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.02); }
    const impact = key => {
      if (has('impacts.' + key)) play('impacts.' + key, { out: bus.impact, vol: 1 });
      else if (key === 'vent') { burst('bandpass', 1800, 2, 0.01, 0.5, 0.5, bus.impact); tone(55, 0.005, 0.4, 0.6, bus.impact); }
      else { burst('lowpass', 600, 1, 0.005, 0.3, 0.9, bus.impact); tone(48, 0.005, 0.5, 0.9, bus.impact); }
    };
    const after = (sec, bodyAfter = true) => {                                     // tinnitus, a close breath, heart fading out
      const tt = ctx.currentTime;
      if (bus.tinn) { bus.tinn.gain.cancelScheduledValues(tt); bus.tinn.gain.setTargetAtTime(0.08, tt, 0.1); }
      if (bodyAfter) { bus.body.gain.cancelScheduledValues(tt); bus.body.gain.setValueAtTime(1, tt); setTimeout(() => gasp(0.6), 600); }
    };
    if (cause === 'door' || cause === 'vent') {
      setTimeout(() => { impact(cause); after(); }, 900);
      return 2600;
    }
    if (cause === 'overload') {                                                    // every layer swells into a roar, hard cut
      const tt = t + 0.4;
      ambDuck.gain.setTargetAtTime(2.2, tt, 0.6); bus.phantom.gain.setTargetAtTime(2.5, tt, 0.4);
      for (let i = 0; i < 8; i++) setTimeout(phantom, 400 + i * 220);
      setTimeout(() => { for (const g of [ambDuck, bus.phantom]) { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(0, ctx.currentTime); } after(); }, 2800);
      return 4200;
    }
    // power: thunk, everything spools down, long quiet, something approaches
    if (has('impacts.power_down')) play('impacts.power_down', { out: bus.impact, vol: 1 });
    else { burst('lowpass', 400, 1, 0.005, 0.25, 0.7, bus.impact); tone(60, 0.005, 0.4, 0.6, bus.impact); }
    for (const s of allBedSources()) s.playbackRate.setTargetAtTime(0.1, t, 0.8);
    setTimeout(() => {
      if (has('impacts.power_approach')) play('impacts.power_approach', { out: bus.impact, vol: 0.8 });
      else for (let i = 0; i < 6; i++) tone(70, 0.01, 0.12, 0.25, bus.impact, 'sine', i * (0.9 + i * 0.15));
    }, 3500);
    setTimeout(() => { impact('door'); after(); }, 8200);
    return 9800;
  }

  // restore everything for a fresh night
  function newNight() {
    S.dying = false; S.phantomT = rand(10, 20); S.deadAirT = rand(40, 70); S.glitchT = rand(20, 40); S.creakT = rand(8, 16);
    S.beatT = 0; S.breathT = 2; S.wasHolding = false; S.deadUntil = 0;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const g of [ambDuck, bus.phantom, bus.body]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(1, t); }
    for (const s of allBedSources()) { s.playbackRate.cancelScheduledValues(t); s.playbackRate.setValueAtTime(1, t); }
    if (bus.tinn) { bus.tinn.gain.cancelScheduledValues(t); bus.tinn.gain.setValueAtTime(0, t); }
  }

  // simple UI feedback sounds (these fit the VHS interface, so stand-ins are fine)
  const ui = {
    cam() { if (has('ui.cam')) play('ui.cam', { out: bus.ui, vol: 0.6 }); else burst('bandpass', 2500, 0.8, 0.01, 0.18, 0.1, bus.ui); },
    monitor(up) { if (has('ui.monitor')) play('ui.monitor', { out: bus.ui, vol: 0.6 }); else tone(up ? 440 : 220, 0.01, 0.12, 0.07, bus.ui, 'square'); },
    click() { if (has('ui.click')) play('ui.click', { out: bus.ui, vol: 0.5 }); else tone(880, 0.005, 0.05, 0.05, bus.ui, 'square'); },
    accept() { if (has('ui.accept')) play('ui.accept', { out: bus.ui, vol: 0.7 }); else { tone(660, 0.01, 0.12, 0.09, bus.ui); tone(990, 0.01, 0.2, 0.09, bus.ui, 'sine', 0.1); } },
    reject() { if (has('ui.reject')) play('ui.reject', { out: bus.ui, vol: 0.7 }); else tone(140, 0.01, 0.35, 0.12, bus.ui, 'sawtooth'); },
    block() { if (has('ui.block')) play('ui.block', { out: bus.impact, vol: 0.8 }); else { burst('lowpass', 300, 1, 0.005, 0.25, 0.4, bus.impact); tone(70, 0.005, 0.3, 0.25, bus.impact); } },
    jam() { if (has('ui.jam')) play('ui.jam', { out: bus.impact, vol: 0.8 }); else { burst('lowpass', 400, 1, 0.005, 0.5, 0.5, bus.impact); tone(45, 0.005, 0.6, 0.4, bus.impact, 'sawtooth'); } },
    win() { if (has('ui.win')) play('ui.win', { out: bus.ui, vol: 0.8 }); else { tone(523, 0.02, 0.5, 0.13, bus.ui); tone(659, 0.02, 0.5, 0.13, bus.ui, 'sine', 0.15); tone(784, 0.02, 0.9, 0.13, bus.ui, 'sine', 0.3); } },
  };
  const wrap = f => (...a) => { if (ctx) f(...a); };

  const api = {
    init, frame, newNight, spike, sight, tell, death, glitch, phantom, deadAir, officeOneShot, beat, breathe, gasp,
    cam: wrap(ui.cam), monitor: wrap(ui.monitor), click: wrap(ui.click), accept: wrap(ui.accept), reject: wrap(ui.reject),
    block: wrap(ui.block), jam: wrap(ui.jam), win: wrap(ui.win),
    setVolume(v) { S.volume = clamp(v, 0, 1); applyMix(); try { localStorage.setItem('as_vol', S.volume); } catch (e) {} },
    setReduced(b) { S.reduced = !!b; applyMix(); try { localStorage.setItem('as_reduced', b ? '1' : '0'); } catch (e) {} },
    get volume() { return S.volume; }, get reduced() { return S.reduced; },
    status: () => status, ready: () => loadedPromise, onGlitch: null,
  };
  return api;
})();
