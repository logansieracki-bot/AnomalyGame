// Rendering, DOM wiring and input.
(() => {
  const G = Game.G;
  const $ = id => document.getElementById(id);
  const canvas = $('view'), ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const SPEED = parseFloat(params.get('speed')) || 1;

  // ---- prebuilt post-processing layers ----
  function makeNoise() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), d = x.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return c;
  }
  const noise = makeNoise();
  const noisePat = ctx.createPattern(noise, 'repeat');
  const scan = document.createElement('canvas'); scan.width = 4; scan.height = 4;
  { const x = scan.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, 0, 4, 1); }
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.85)');

  function post(strength, tint) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.05 + strength * 0.12;
    const ox = Math.random() * 256, oy = Math.random() * 256;
    ctx.translate(-ox, -oy); ctx.fillStyle = noisePat; ctx.fillRect(0, 0, W + 256, H + 256); ctx.translate(ox, oy);
    ctx.globalAlpha = 1; ctx.fillStyle = ctx.createPattern(scan, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---- DOM setup ----
  const mapEl = $('map'), mapBtns = {};
  ROOMS.forEach((r, i) => {
    const b = document.createElement('button');
    b.textContent = r.label; b.style.gridColumn = r.cell[0] + 1; b.style.gridRow = r.cell[1] + 1;
    b.title = `${r.name} [${i + 1}]`;
    b.onclick = () => Game.switchCam(r.id);
    mapEl.appendChild(b); mapBtns[r.id] = b;
  });
  const you = document.createElement('button'); you.className = 'you'; you.textContent = 'YOU'; you.disabled = true;
  you.style.gridRow = 4; mapEl.appendChild(you);

  function buildMenu() {
    const m = $('reportMenu'); m.innerHTML = '';
    const head = t => { const h = document.createElement('h4'); h.textContent = t; m.appendChild(h); };
    const item = (label, type) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => Game.submitReport(type); m.appendChild(b); };
    head('ENVIRONMENT');
    ANOMALY_TYPES.forEach(t => item(t.label, t.id));
    if (G.cfg.ents.length) { head('ENTITY PRESENCE'); G.cfg.ents.forEach(id => item(ENTITIES[id].name, 'ent:' + id)); }
  }

  const nb = $('nightButtons');
  NIGHTS.forEach(n => {
    const b = document.createElement('button'); b.textContent = `NIGHT ${n.n}`;
    b.onclick = () => begin(n.n); nb.appendChild(b);
  });

  function begin(n) {
    Sfx.init();
    Game.start(n); buildMenu();
    $('screen').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('nightLabel').textContent = `NIGHT ${n}`;
  }
  function showEnd() {
    const s = $('screen'), o = G.over;
    s.className = o.win ? 'win' : 'lose';
    s.innerHTML = `<h1>${o.win ? '6 AM' : 'YOU DIED'}</h1>
      <div class="stats">${o.win ? `You survived night ${G.night}.` : o.reason}<br>
      Correct reports: ${G.stats.correct} &nbsp; False reports: ${G.stats.wrong}<br>
      Unresolved anomalies: ${G.anomalies.length}</div><div id="endBtns"></div>`;
    const eb = s.querySelector('#endBtns'); eb.id = 'nightButtons';
    const again = document.createElement('button'); again.textContent = 'RETRY NIGHT ' + G.night; again.onclick = () => { restoreScreen(); begin(G.night); };
    eb.appendChild(again);
    if (o.win && G.night < NIGHTS.length) { const nx = document.createElement('button'); nx.textContent = 'NEXT NIGHT'; nx.onclick = () => { restoreScreen(); begin(G.night + 1); }; eb.appendChild(nx); }
    const menu = document.createElement('button'); menu.textContent = 'MENU'; menu.onclick = () => location.reload(); eb.appendChild(menu);
    s.classList.remove('hidden'); $('hud').classList.add('hidden');
  }
  const restoreScreen = () => { $('screen').className = ''; };

  // ---- input ----
  $('monitorBtn').onclick = Game.toggleMonitor;
  $('reportBtn').onclick = Game.toggleReportMenu;
  $('doorBtn').onclick = () => Game.toggleBlock('door');
  $('ventBtn').onclick = () => Game.toggleBlock('vent');
  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); Game.toggleMonitor(); }
    else if (k === 'a') Game.toggleBlock('door');
    else if (k === 'd') Game.toggleBlock('vent');
    else if (k === 'r') Game.toggleReportMenu();
    else if (k >= '1' && k <= '9' && G.monitor && ROOMS[+k - 1]) Game.switchCam(ROOMS[+k - 1].id);
  });

  // ---- one-shot events -> sound ----
  function handleEvents() {
    for (const ev of G.events.splice(0)) {
      switch (ev.type) {
        case 'cam': Sfx.camSwitch(); break;
        case 'monitor': Sfx.monitor(ev.data); break;
        case 'click': Sfx.click(); break;
        case 'accept': Sfx.accept(); break;
        case 'reject': Sfx.reject(); break;
        case 'block': Sfx.blockDoor(); break;
        case 'tell': Sfx[ev.data](); break;
        case 'whisper': Sfx.whisper(); break;
        case 'spawn': break;
        case 'lose': Sfx.jump(); setTimeout(showEnd, 700); break;
        case 'win': Sfx.win(); setTimeout(showEnd, 400); break;
      }
    }
  }

  // ---- HUD refresh ----
  function updateHud() {
    const room = ROOM[G.cam];
    $('camLabel').textContent = G.monitor ? `CAM ${ROOMS.indexOf(room) + 1} - ${room.name.toUpperCase()}` : 'OFFICE';
    $('clock').textContent = HOURS[Game.hourIndex()];
    $('powerFill').style.width = G.power + '%';
    $('powerFill').style.background = G.power < 25 ? '#d96' : '#8fcf8f';
    $('powerNum').textContent = Math.ceil(G.power) + '%';
    $('loadFill').style.width = G.overload + '%';
    $('monitorBtn').textContent = G.monitor ? 'LOWER MONITOR [SPACE]' : 'RAISE MONITOR [SPACE]';
    $('defense').classList.toggle('hidden', G.monitor);
    $('doorBtn').classList.toggle('active', G.door); $('ventBtn').classList.toggle('active', G.vent);
    $('doorBtn').textContent = G.door ? 'DOOR: CLOSED [A]' : 'DOOR: OPEN [A]';
    $('ventBtn').textContent = G.vent ? 'VENT: SEALED [D]' : 'VENT: OPEN [D]';
    $('map').classList.toggle('hidden', !G.monitor);
    $('reportPanel').classList.toggle('hidden', !G.monitor);
    for (const r of ROOMS) mapBtns[r.id].classList.toggle('active', r.id === G.cam);

    const R = G.report, rb = $('reportBtn'), st = $('reportStatus');
    $('reportMenu').classList.toggle('hidden', !(R.menuOpen && R.state === 'idle'));
    rb.disabled = R.state !== 'idle';
    if (R.state === 'idle') { rb.textContent = 'REPORT [R]'; st.textContent = ''; }
    else if (R.state === 'proc') {
      const label = R.type.startsWith('ent:') ? ENTITIES[R.type.slice(4)].name : ANOMALY_TYPES.find(t => t.id === R.type).label;
      rb.textContent = `PROCESSING ${R.t.toFixed(1)}s`; st.textContent = `Filing: ${label} @ ${ROOM[R.room].name}`;
    } else { rb.textContent = `COOLDOWN ${R.t.toFixed(1)}s`; st.textContent = ''; }

    const t = $('toast');
    if (G.toast) { t.textContent = G.toast.text; t.className = 'show ' + G.toast.kind; } else t.className = '';
  }

  // ---- canvas frame ----
  function render(now) {
    ctx.clearRect(0, 0, W, H);
    if (!G.monitor) {
      Scene.drawOffice(ctx, { door: G.door, vent: G.vent, atEntry: Game.entitiesAtEntry });
      post(0.1, 'rgb(140,170,160)');
    } else {
      Scene.drawRoom(ctx, G.cam, G.anomalies);
      for (const e of G.entities) {
        if (Game.roomOf(e) !== G.cam) continue;
        const i = G.entities.indexOf(e), x = 300 + i * 340 + (e.stage * 53) % 120;
        Scene.drawFigure(ctx, x, 560, 360, 0.95, true);
      }
      for (const h of G.halluc) {
        if (h.room !== G.cam) continue;
        const fade = Math.min(1, h.life / 0.6) * Math.min(1, (h.max - h.life) / 0.6 + 0.2);
        const flick = Math.random() < 0.18 ? 0.25 : 1;
        if (h.kind === 'face') {
          ctx.save(); ctx.globalAlpha = h.alpha * fade * flick;
          ctx.fillStyle = '#dff'; ctx.beginPath(); ctx.ellipse(h.x, h.y, 34, 46, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#000'; ctx.fillRect(h.x - 16, h.y - 10, 9, 14); ctx.fillRect(h.x + 8, h.y - 10, 9, 14); ctx.fillRect(h.x - 8, h.y + 18, 16, 6);
          ctx.restore();
        } else Scene.drawFigure(ctx, h.x, h.y, 330, h.alpha * fade * flick, false);
      }
      const overloadShake = G.overload / 100;
      if (G.staticT > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, G.staticT * 3); ctx.fillStyle = ctx.createPattern(noise, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore(); }
      if (Math.random() < 0.01 + overloadShake * 0.05) {   // glitch band
        const y = Math.random() * H; ctx.drawImage(canvas, 0, y, W, 24, (Math.random() - 0.5) * 40, y, W, 24);
      }
      post(overloadShake + (G.staticT > 0 ? 0.3 : 0), 'rgb(150,255,170)');
      ctx.fillStyle = `rgba(120,0,0,${overloadShake * overloadShake * 0.3})`; ctx.fillRect(0, 0, W, H);
    }
    // alert dots on the map: none (the player has to look), except entities' rooms are never revealed.
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000) * SPEED; last = now;
    // when speeding up for tests, run several small steps
    const steps = Math.max(1, Math.round(SPEED)); for (let i = 0; i < steps; i++) Game.update(dt / steps);
    handleEvents();
    if (G.cfg) { updateHud(); render(now); } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__game = Game;                                      // handy for debugging in the console
  if (params.get('night')) begin(+params.get('night'));
})();
