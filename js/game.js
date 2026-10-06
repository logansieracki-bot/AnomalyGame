// Game rules and state. No DOM access here; ui.js reads the state and calls these functions.
const Game = (() => {
  const rand = ([a, b]) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const G = {
    running: false, over: null,           // over: {win, reason}
    night: 1, cfg: null, t: 0,
    cam: 'living', monitor: true,
    power: 100, overload: 0,
    door: false, vent: false,
    strain: { door: 0, vent: 0 }, jam: { door: 0, vent: 0 },
    anomalies: [], halluc: [], entities: [],
    nextSpawn: 0,
    report: { state: 'idle', t: 0, dur: 0, room: null, type: null, menuOpen: false },
    toast: null, staticT: 0,
    stats: { correct: 0, wrong: 0 },
    events: [],                           // one-shot notifications for the UI (sounds, toasts)
  };

  const progress = () => clamp(G.t / NIGHT_LENGTH, 0, 1);
  const hourIndex = () => Math.min(6, Math.floor(G.t / 60));
  const emit = (type, data) => G.events.push({ type, data });
  const entPath = e => ENTITIES[e.id].path;
  const atEntryStage = e => e.stage >= entPath(e).length;
  const roomOf = e => (e.away > 0 || atEntryStage(e)) ? null : entPath(e)[e.stage];
  const entryBlocked = kind => kind === 'door' ? G.door : G.vent;

  function start(n) {
    const cfg = NIGHTS[n - 1];
    Object.assign(G, {
      running: true, over: null, night: n, cfg, t: 0, cam: 'living', monitor: true,
      power: 100, overload: 0, door: false, vent: false,
      strain: { door: 0, vent: 0 }, jam: { door: 0, vent: 0 },
      anomalies: [], halluc: [], nextSpawn: rand([8, 12]), toast: null, staticT: 0.3,
      stats: { correct: 0, wrong: 0 }, events: [],
      report: { state: 'idle', t: 0, dur: 0, room: null, type: null, menuOpen: false },
    });
    G.entities = cfg.ents.map(id => ({ id, stage: 0, moveT: rand(cfg.move) + 8, away: 0, entryT: 0, tellT: 0, leaveT: 0 }));
  }

  function switchCam(id) {
    if (!G.running || id === G.cam || !ROOM[id]) return;
    G.cam = id; G.staticT = 0.25; emit('cam');
  }
  function toggleMonitor() {
    if (!G.running) return;
    G.monitor = !G.monitor; G.report.menuOpen = false; emit('monitor', G.monitor);
  }
  function setBlock(kind, on) {
    if (!G.running || G.monitor) return;                  // you must be at the door/vent, not on cameras
    if (G[kind] === on) return;
    if (on && G.jam[kind] > 0) { toast(`${kind.toUpperCase()} IS JAMMED OPEN`, 'bad'); emit('reject'); return; }
    G[kind] = on; if (on) emit('block');
  }
  function toggleBlock(kind) { setBlock(kind, !G[kind]); }

  function toast(text, kind) { G.toast = { text, kind, t: 2.6 }; }

  // ---- spawning ----
  function spawnAnomaly() {
    const cfg = G.cfg;
    const cap = cfg.active + Math.floor(progress() * 2);
    if (G.anomalies.length >= cap) return;
    for (let tries = 0; tries < 8; tries++) {
      let room = Scene.pick(ROOMS).id;
      if (G.monitor && room === G.cam && tries < 6) continue;     // it won't appear while you are watching that room
      const type = Scene.pick(ANOMALY_TYPES).id;
      const a = Scene.makeAnomaly(room, type, cfg.subtle * (0.6 + 0.6 * progress()));
      if (a.target && G.anomalies.some(x => x.room === room && x.target === a.target)) continue;
      a.born = G.t; G.anomalies.push(a); emit('spawn'); return;
    }
  }
  function spawnHallucination() {
    const room = Math.random() < 0.6 ? G.cam : Scene.pick(ROOMS).id;
    const kind = Math.random() < 0.3 ? 'face' : 'figure';
    G.halluc.push({
      room, kind, x: 150 + Math.random() * 980, y: kind === 'face' ? 150 : 520 + Math.random() * 80,
      life: 2.5 + Math.random() * 2.5, max: 5, alpha: 0.12 + Math.random() * 0.2 + progress() * 0.1,
    });
    if (room === G.cam && G.monitor) emit('whisper');
  }

  // ---- reporting ----
  function toggleReportMenu() {
    if (!G.running || !G.monitor || G.report.state !== 'idle') return;
    G.report.menuOpen = !G.report.menuOpen; emit('click');
  }
  function submitReport(type) {
    const R = G.report;
    if (!G.running || !G.monitor || R.state !== 'idle') return;
    Object.assign(R, { state: 'proc', t: G.cfg.delay, dur: G.cfg.delay, room: G.cam, type, menuOpen: false });
    emit('click');
  }
  function resolveReport() {
    const R = G.report;
    const roomName = ROOM[R.room].name;
    let ok = false;
    if (R.type.startsWith('ent:')) {
      const e = G.entities.find(en => en.id === R.type.slice(4) && roomOf(en) === R.room);
      if (e) {
        ok = true; e.stage = 0; e.away = rand([10, 16]); e.moveT = rand(G.cfg.move);
        G.overload = clamp(G.overload - 5, 0, 100);
        toast(`${ENTITIES[e.id].name.toUpperCase()} DRIVEN BACK`, 'good');
      }
    } else {
      const i = G.anomalies.findIndex(a => a.room === R.room && a.type === R.type);
      if (i >= 0) {
        ok = true; G.anomalies.splice(i, 1);
        G.overload = clamp(G.overload - 12, 0, 100);
        toast(`REPORT ACCEPTED - ${ANOMALY_TYPES.find(t => t.id === R.type).label.toUpperCase()} FIXED`, 'good');
      }
    }
    if (ok) { G.stats.correct++; emit('accept'); }
    else { G.stats.wrong++; toast(`REPORT REJECTED - NOTHING MATCHING IN ${roomName.toUpperCase()}`, 'bad'); emit('reject'); }
    R.state = 'cool'; R.t = G.cfg.cooldown; R.dur = G.cfg.cooldown;
  }

  // ---- end states ----
  function lose(reason) { if (G.over) return; G.over = { win: false, reason }; G.running = false; emit('lose'); }
  function win() { if (G.over) return; G.over = { win: true, reason: '6 AM' }; G.running = false; emit('win'); }

  // ---- per-frame update ----
  function update(dt) {
    if (!G.running) return;
    const cfg = G.cfg;
    G.t += dt;
    if (G.t >= NIGHT_LENGTH) return win();
    G.staticT = Math.max(0, G.staticT - dt);
    if (G.toast) { G.toast.t -= dt; if (G.toast.t <= 0) G.toast = null; }

    // power
    const drain = (G.monitor ? 0.28 : 0.06) + (G.door ? 0.15 : 0) + (G.vent ? 0.15 : 0);
    G.power -= drain * dt;
    if (G.power <= 0) { G.power = 0; return lose('POWER OUT'); }

    // door/vent wear: keep one shut too long and it jams open for a while
    const build = STRAIN.build + G.night * 0.5;
    for (const k of ['door', 'vent']) {
      if (G.jam[k] > 0) { G.jam[k] -= dt; if (G.jam[k] <= 0) G.strain[k] = 30; continue; }
      if (G[k]) {
        G.strain[k] += build * dt;
        if (G.strain[k] >= 100) { G.strain[k] = 100; G[k] = false; G.jam[k] = STRAIN.jam; toast(`${k.toUpperCase()} JAMMED OPEN`, 'bad'); emit('jam'); }
      } else G.strain[k] = Math.max(0, G.strain[k] - STRAIN.recover * dt);
    }

    // anomalies
    G.nextSpawn -= dt;
    if (G.nextSpawn <= 0) { spawnAnomaly(); G.nextSpawn = rand(cfg.spawn) * (1 - 0.35 * progress()); }

    // hallucinations
    if (cfg.halluc > 0 && Math.random() < cfg.halluc * 0.05 * (1 + 2 * progress()) * dt) spawnHallucination();
    for (const h of G.halluc) h.life -= dt;
    G.halluc = G.halluc.filter(h => h.life > 0);

    // report state machine
    const R = G.report;
    if (R.state === 'proc') { R.t -= dt; if (R.t <= 0) resolveReport(); }
    else if (R.state === 'cool') { R.t -= dt; if (R.t <= 0) R.state = 'idle'; }

    // entities
    let present = 0;
    for (const e of G.entities) {
      const def = ENTITIES[e.id], len = def.path.length;
      if (e.away > 0) { e.away -= dt; continue; }
      if (atEntryStage(e)) {
        e.tellT -= dt;
        if (e.tellT <= 0) { emit('tell', def.tell); e.tellT = 0.9; }
        if (entryBlocked(def.entry)) {
          e.leaveT += dt;
          if (e.leaveT >= 2.5) { e.stage = 0; e.away = rand([8, 12]); e.moveT = rand(cfg.move); e.leaveT = 0; e.entryT = 0; emit('block'); }
        } else {
          e.leaveT = 0; e.entryT += dt;
          if (e.entryT >= cfg.kill) return lose(`${def.name.toUpperCase()} GOT IN`);
        }
        continue;
      }
      present++;
      const watched = G.monitor && roomOf(e) === G.cam;
      if (e.id === 'watcher' && watched) continue;               // the Watcher only moves when unobserved
      e.moveT -= dt * (1 + G.overload / 150) * (1 + 0.4 * progress());
      if (e.moveT <= 0) {
        e.stage++; e.moveT = rand(cfg.move);
        if (e.stage >= len) { e.entryT = 0; e.leaveT = 0; e.tellT = 0; }
      }
    }

    // overload
    let rate = G.anomalies.length * 0.55 + present * 0.4 - 1.0;
    if (rate < 0) rate *= 0.5;
    G.overload = clamp(G.overload + rate * dt, 0, 100);
    if (G.overload >= 100) return lose('ENTITY OVERLOAD');
  }

  return {
    G, start, update, switchCam, toggleMonitor, toggleBlock, setBlock,
    toggleReportMenu, submitReport, hourIndex, roomOf, atEntryStage, progress,
    entitiesAtEntry: kind => G.entities.filter(e => e.away <= 0 && atEntryStage(e) && ENTITIES[e.id].entry === kind),
  };
})();
