// Audio engine. NOTHING here is synthesized: every sound is a real recording loaded from
// assets/audio/manifest.json (see assets/audio/README.md). If a file is missing that sound is simply
// silent. Web Audio is used only to MIX: loops, panning, filtering, ducking, optional wall reverb.
//
// Signal flow:
//   beds (camera / rooms / office) -> ambFilter -> ambDuck -> ambLevel ---\
//   phantoms (lowpass + pan [+ wall reverb if an IR file exists]) --------+-> master -> compressor -> out
//   tells / body / impacts / ui -> their own buses -----------------------/
const Sfx = (() => {
  const BASE = 'assets/audio/';
  let ctx = null, master, comp, ambFilter, ambDuck, ambLevel, convolver = null;
  const bus = {};
  const buf = {};                       // 'group.key' -> [AudioBuffer]
  const bag = {};                       // shuffle bags so variants don't repeat
  const status = {};                    // 'group.key' -> { want, loaded }
  let trims = {};                       // optional per-key gain trims from the manifest ("gains")
  const beds = { sources: [], rooms: {} };
  const roomGain = {};
  let loadedPromise = null;

  const S = {
    volume: 0.8, ambience: 0.5, reduced: false,
    beatT: 0, breathT: 2, wasHolding: false,
    phantomT: 12, deadAirT: 60, glitchT: 30, creakT: 15, deadUntil: 0,
    dying: false,
  };
  try {
    const v = parseFloat(localStorage.getItem('as_vol')); if (!isNaN(v)) S.volume = v;
    const a = parseFloat(localStorage.getItem('as_amb')); if (!isNaN(a)) S.ambience = a;
    S.reduced = localStorage.getItem('as_reduced') === '1';
  } catch (e) {}

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const trim = (key, dflt = 1) => trims[key] ?? dflt;

  // ---------- setup ----------
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();             // acts as a limiter so nothing clips
    comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.25;
    master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
    for (const n of ['cam', 'office', 'phantom', 'tell', 'body', 'impact', 'ui']) bus[n] = ctx.createGain();
    ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 16000;
    ambDuck = ctx.createGain(); ambLevel = ctx.createGain();
    bus.cam.connect(ambFilter); bus.office.connect(ambFilter); ambFilter.connect(ambDuck); ambDuck.connect(ambLevel); ambLevel.connect(master);
    for (const n of ['phantom', 'tell', 'body', 'impact', 'ui']) bus[n].connect(master);
    bus.cam.gain.value = 1; bus.office.gain.value = 0.3;
    applyMix();
    loadedPromise = load().then(startBeds);
  }
  function applyMix() {
    if (!ctx) return;
    master.gain.value = S.volume;
    ambLevel.gain.value = S.ambience;
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
    try { manifest = await (await fetch(BASE + 'manifest.json')).json(); } catch (e) { return; }   // no manifest / file:// -> silent
    trims = manifest.gains || {}; delete manifest.gains;
    const entries = flatten(manifest, '', {});
    await Promise.all(Object.entries(entries).map(async ([key, paths]) => {
      status[key] = { want: paths.length, loaded: 0 };
      for (const p of paths) {
        try {
          const r = await fetch(BASE + p); if (!r.ok) continue;
          const b = await ctx.decodeAudioData(await r.arrayBuffer());
          (buf[key] ||= []).push(b); status[key].loaded++;
        } catch (e) { /* missing or undecodable: skip */ }
      }
    }));
    if (has('ir')) { convolver = ctx.createConvolver(); convolver.buffer = buf['ir'][0]; convolver.connect(bus.phantom); }
  }
  const has = key => !!(buf[key] && buf[key].length);
  function pick(key) {                                  // shuffle bag: no repeats until all variants have played
    const list = buf[key]; if (!list || !list.length) return null;
    let b = bag[key]; if (!b || !b.length) b = bag[key] = list.map((_, i) => i).sort(() => Math.random() - 0.5);
    return list[b.pop()];
  }

  // ---------- primitives ----------
  function loop(buffer, out, gain = 1) {
    const s = ctx.createBufferSource(); s.buffer = buffer; s.loop = true;
    const g = ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(out); s.start(0, Math.random() * buffer.duration);
    return { s, g };
  }
  // Plays one recording. rate/stretch change speed; lp low-passes; pan is -1..1.
  function play(key, { out = bus.ui, vol = 1, pan = 0, rate = 1, lp = 0, delay = 0 } = {}) {
    if (!ctx) return null;
    const b = pick(key); if (!b) return null;
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    let node = s;
    const g = ctx.createGain(); g.gain.value = vol * trim(key); node.connect(g); node = g;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(out); s.start(ctx.currentTime + delay);
    return s;
  }

  // ---------- ambience beds ----------
  function startBeds() {
    if (!ctx) return;
    if (has('cam.base')) beds.sources.push(loop(pick('cam.base'), bus.cam, 0.5 * trim('cam.base')).s);
    for (const r of ROOMS) {
      const key = 'rooms.' + r.id;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(bus.cam); roomGain[r.id] = g;
      if (has(key)) beds.sources.push(loop(pick(key), g, 0.5 * trim(key)).s);
    }
    if (has('office.base')) beds.sources.push(loop(pick('office.base'), bus.office, 0.5 * trim('office.base')).s);
    if (has('body.tinnitus')) { const t = loop(pick('body.tinnitus'), bus.body, 0); bus.tinn = t.g; }
  }

  // ---------- phantoms: far, muffled, through walls, never a knock/scratch/breath ----------
  function phantom() {
    if (!ctx || !has('phantoms')) return;
    const pan = rand(0.15, 0.55) * (Math.random() < 0.5 ? 1 : -1);
    const s = ctx.createBufferSource(); s.buffer = pick('phantoms'); s.playbackRate.value = rand(0.92, 1.05);
    const g = ctx.createGain(); g.gain.value = rand(0.35, 0.8) * trim('phantoms');
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = rand(700, 1800);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = pan;
    s.connect(g); g.connect(f); f.connect(p);
    const dry = ctx.createGain(); dry.gain.value = convolver ? 0.35 : 1; p.connect(dry); dry.connect(bus.phantom);
    if (convolver) { const wet = ctx.createGain(); wet.gain.value = 0.9; p.connect(wet); wet.connect(convolver); }
    s.start();
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
  const beat = vol => play('body.heartbeat', { out: bus.body, vol });
  const breathe = vol => play('body.breath', { out: bus.body, vol, rate: rand(0.95, 1.08) });
  const gasp = (vol = 0.7) => play('body.gasp', { out: bus.body, vol });

  // ---------- per-frame driver (ui.js, or the sound test page) ----------
  // st: { monitor, cam, fear, overload, night, progress, running, holding }
  function frame(dt, st) {
    if (!ctx || S.dying) return;
    const t = ctx.currentTime, fear = clamp(st.fear, 0, 1);
    bus.cam.gain.setTargetAtTime(st.monitor ? 1 : 0.12, t, 0.2);
    bus.office.gain.setTargetAtTime(st.monitor ? 0.3 : 1, t, 0.2);
    for (const id in roomGain) roomGain[id].gain.setTargetAtTime(st.monitor && id === st.cam ? 1 : 0, t, 0.2);
    ambFilter.frequency.setTargetAtTime(16000 - fear * 12500, t, 0.3);            // tunnel hearing
    for (const s of beds.sources) s.detune.setTargetAtTime(-fear * 120, t, 0.5);
    if (bus.tinn) bus.tinn.gain.setTargetAtTime(fear * 0.02, t, 0.8);
    if (!st.running) return;

    const night = st.night || 1, prog = st.progress || 0, pace = 1 + night * 0.15 + prog;
    if (fear > 0.12) {                                                              // heartbeat follows fear
      S.beatT -= dt;
      if (S.beatT <= 0) { beat(0.15 + 0.85 * fear); S.beatT = 60 / (55 + 95 * fear); }
    }
    if (st.holding) S.wasHolding = true;                                           // breath held: silence
    else {
      if (S.wasHolding) { gasp(0.4 + 0.5 * fear); S.wasHolding = false; S.breathT = 2; }
      if (fear > 0.3) { S.breathT -= dt; if (S.breathT <= 0) { breathe(0.2 + 0.6 * fear); S.breathT = 3.4 - 2.6 * fear; } }
    }
    S.phantomT -= dt; if (S.phantomT <= 0) { phantom(); S.phantomT = rand(14, 32) / pace; }
    S.deadAirT -= dt; if (S.deadAirT <= 0) { deadAir(); S.deadAirT = rand(45, 90) / (1 + night * 0.1); }
    S.glitchT -= dt; if (S.glitchT <= 0) { S.glitchT = rand(25, 60); if (st.monitor) glitch(); }
    S.creakT -= dt; if (S.creakT <= 0) { S.creakT = rand(10, 25); if (!st.monitor) officeOneShot(); }
  }
  function glitch() {                                                               // brief tape dropout, synced with a visual glitch
    if (!ctx) return;
    play('cam.dropout', { out: bus.cam, vol: 0.7 });
    if (api.onGlitch) api.onGlitch();
  }
  const officeOneShot = () => play('office.oneshot', { out: bus.office, vol: rand(0.4, 0.9), pan: rand(-0.8, 0.8) });

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
    play('impacts.sight', { out: bus.impact, vol: 0.7 });
  }
  function tell(kind, entry) {                                                     // close, dry, physical (opposite of phantoms)
    play('tell.' + kind, { out: bus.tell, vol: 0.9, pan: entry === 'vent' ? 0.6 : -0.6 });
  }

  // Death sequences: silence, then one dry physical event. Returns ms until the end screen should appear.
  function death(cause) {
    if (!ctx) return 700;
    S.dying = true;
    const t = ctx.currentTime;
    for (const g of [ambDuck, bus.phantom, bus.body]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.02); }
    const after = () => {                                                          // tinnitus, a close breath, heart gone
      const tt = ctx.currentTime;
      if (bus.tinn) { bus.tinn.gain.cancelScheduledValues(tt); bus.tinn.gain.setTargetAtTime(0.08, tt, 0.1); }
      bus.body.gain.cancelScheduledValues(tt); bus.body.gain.setValueAtTime(1, tt); setTimeout(() => gasp(0.6), 600);
    };
    if (cause === 'door' || cause === 'vent') {
      setTimeout(() => { play('impacts.' + cause, { out: bus.impact, vol: 1 }); after(); }, 900);
      return 2600;
    }
    if (cause === 'overload') {                                                    // every layer swells into a roar, hard cut
      const tt = t + 0.4;
      ambDuck.gain.setTargetAtTime(2.2, tt, 0.6); bus.phantom.gain.setTargetAtTime(2.5, tt, 0.4);
      setTimeout(() => play('impacts.overload', { out: bus.impact, vol: 1 }), 400);
      for (let i = 0; i < 8; i++) setTimeout(phantom, 400 + i * 220);
      setTimeout(() => { for (const g of [ambDuck, bus.phantom]) { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(0, ctx.currentTime); } after(); }, 2800);
      return 4200;
    }
    // power: thunk, everything spools down, long quiet, something approaches
    play('impacts.power_down', { out: bus.impact, vol: 1 });
    for (const s of beds.sources) s.playbackRate.setTargetAtTime(0.1, t, 0.8);
    setTimeout(() => play('impacts.power_approach', { out: bus.impact, vol: 0.8 }), 3500);
    setTimeout(() => { play('impacts.door', { out: bus.impact, vol: 1 }); after(); }, 8200);
    return 9800;
  }

  // restore everything for a fresh night
  function newNight() {
    S.dying = false; S.phantomT = rand(10, 20); S.deadAirT = rand(40, 70); S.glitchT = rand(20, 40); S.creakT = rand(8, 16);
    S.beatT = 0; S.breathT = 2; S.wasHolding = false; S.deadUntil = 0;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const g of [ambDuck, bus.phantom, bus.body]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(1, t); }
    for (const s of beds.sources) { s.playbackRate.cancelScheduledValues(t); s.playbackRate.setValueAtTime(1, t); }
    if (bus.tinn) { bus.tinn.gain.cancelScheduledValues(t); bus.tinn.gain.setValueAtTime(0, t); }
  }

  // Interface sounds: analog-horror hardware (VCR buttons, CRT power, tape spool, camcorder beeps).
  // Each is a recording from assets/audio/ui/; missing ones are silent.
  const ui = (key, opt = {}) => (...a) => { if (ctx) play('ui.' + key, { out: opt.out || bus.ui, vol: opt.vol ?? 0.7 }); };
  const api = {
    init, frame, newNight, spike, sight, tell, death, glitch, phantom, deadAir, officeOneShot, beat, breathe, gasp,
    start: ui('start'), cam: ui('cam', { vol: 0.6 }), click: ui('click', { vol: 0.6 }),
    monitor(up) { if (ctx) play(up ? 'ui.monitor_up' : 'ui.monitor_down', { out: bus.ui, vol: 0.7 }); },
    submit(seconds) {                                          // camcorder REC beep, then a tape spool that lasts as long as the report takes
      if (!ctx) return;
      play('ui.rec_beep', { out: bus.ui, vol: 0.7 });
      const b = buf['ui.processing'] && buf['ui.processing'][0];
      play('ui.processing', { out: bus.ui, vol: 0.5, rate: b ? clamp(b.duration / seconds, 0.6, 1.8) : 1, delay: 0.25 });
    },
    accept: ui('accept'), reject: ui('reject'), cooldownDone: ui('ready', { vol: 0.4 }),
    flash(on) { if (ctx) play(on ? 'ui.flash_on' : 'ui.flash_off', { out: bus.ui, vol: 0.7 }); },
    win: ui('win', { vol: 0.8 }),
    setVolume(v) { S.volume = clamp(v, 0, 1); applyMix(); try { localStorage.setItem('as_vol', S.volume); } catch (e) {} },
    setAmbience(v) { S.ambience = clamp(v, 0, 1); applyMix(); try { localStorage.setItem('as_amb', S.ambience); } catch (e) {} },
    setReduced(b) { S.reduced = !!b; applyMix(); try { localStorage.setItem('as_reduced', b ? '1' : '0'); } catch (e) {} },
    get volume() { return S.volume; }, get ambience() { return S.ambience; }, get reduced() { return S.reduced; },
    status: () => status, ready: () => loadedPromise, onGlitch: null,
  };
  // door/vent closing and jams are physical impacts, so they go through the impact bus (respects "reduce loud sounds")
  api.block = () => { if (ctx) play('ui.block', { out: bus.impact, vol: 0.8 }); };
  api.jam = () => { if (ctx) play('ui.jam', { out: bus.impact, vol: 0.8 }); };
  return api;
})();
