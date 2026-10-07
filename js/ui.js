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
  // FNAF-style floor plan: rooms joined by hallway lines, your office at the bottom.
  const mapEl = $('map'), mapBtns = {};
  const NW = 24, NH = 16, YOU_POS = [38, 82];
  const center = p => [p[0] + NW / 2, p[1] + NH / 2];
  { const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    const line = (a, b, cls) => { const l = document.createElementNS(NS, 'line'); const [x1, y1] = center(a), [x2, y2] = center(b);
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); if (cls) l.setAttribute('class', cls); svg.appendChild(l); };
    for (const [a, b] of EDGES) line(ROOM[a].pos, ROOM[b].pos);
    for (const r of Object.keys(ENTRY_LINKS.door)) line(YOU_POS, ROOM[r].pos);
    for (const r of Object.keys(ENTRY_LINKS.vent)) line(YOU_POS, ROOM[r].pos, 'vent');
    mapEl.appendChild(svg);
    const tag = (t, x, y) => { const d = document.createElement('span'); d.className = 'tag'; d.textContent = t; d.style.left = x + '%'; d.style.top = y + '%'; mapEl.appendChild(d); };
    tag('DOOR', 22, 77); tag('VENT', 68, 77); }
  ROOMS.forEach((r, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<i>${i + 1}</i><b>${DIST[r.id]}</b>` + r.label;
    b.style.left = r.pos[0] + '%'; b.style.top = r.pos[1] + '%';
    b.title = `${r.name} [${i + 1}] - ${DIST[r.id]} steps from you`;
    b.onclick = () => Game.switchCam(r.id);
    mapEl.appendChild(b); mapBtns[r.id] = b;
  });
  const you = document.createElement('button'); you.className = 'you'; you.textContent = 'YOU'; you.disabled = true;
  you.style.left = YOU_POS[0] + '%'; you.style.top = YOU_POS[1] + '%'; mapEl.appendChild(you);

  function buildMenu() {
    const m = $('reportMenu'); m.innerHTML = '';
    const head = t => { const h = document.createElement('h4'); h.textContent = t; m.appendChild(h); };
    const item = (label, type, hint) => { const b = document.createElement('button'); b.innerHTML = label + (hint ? `<small>${hint}</small>` : ''); b.onclick = () => Game.submitReport(type); m.appendChild(b); };
    head('ENVIRONMENT');
    ANOMALY_TYPES.forEach(t => item(t.label, t.id, t.hint));
    if (G.cfg.ents.length) { head('ENTITY PRESENCE'); G.cfg.ents.forEach(id => item(ENTITIES[id].name, 'ent:' + id)); }
  }

  { const v = $('vol'), a = $('amb'), r = $('reduced');
    if (v) { v.value = Sfx.volume; v.oninput = () => Sfx.setVolume(+v.value); }
    if (a) { a.value = Sfx.ambience; a.oninput = () => Sfx.setAmbience(+a.value); }
    if (r) { r.checked = Sfx.reduced; r.onchange = () => Sfx.setReduced(r.checked); } }

  const nb = $('nightButtons');
  NIGHTS.forEach(n => {
    const b = document.createElement('button'); b.textContent = `NIGHT ${n.n}`;
    b.onclick = () => begin(n.n); nb.appendChild(b);
  });

  let deathAt = 0, deathCause = null;                         // power-out deaths black the screen out
  Sfx.onGlitch = () => { G.staticT = Math.max(G.staticT, 0.12); };
  function begin(n) {
    Sfx.init(); Sfx.newNight(); Sfx.start(); deathAt = 0; deathCause = null;
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
  // flashlights are hold-to-use
  for (const k of ['door', 'vent']) {
    const b = $(k + 'Light');
    b.onpointerdown = e => { e.preventDefault(); Game.setFlash(k, true); };
    for (const ev of ['onpointerup', 'onpointerleave', 'onpointercancel']) b[ev] = () => Game.setFlash(k, false);
  }
  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); Game.toggleMonitor(); }
    else if (k === 'a') Game.toggleBlock('door');
    else if (k === 'd') Game.toggleBlock('vent');
    else if (k === 'q') Game.setFlash('door', true);
    else if (k === 'e') Game.setFlash('vent', true);
    else if (k === 'r') Game.toggleReportMenu();
    else if (k >= '1' && k <= '9' && G.monitor && ROOMS[+k - 1]) Game.switchCam(ROOMS[+k - 1].id);
  });

  addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'q') Game.setFlash('door', false); else if (k === 'e') Game.setFlash('vent', false);
  });
  addEventListener('blur', () => { Game.setFlash('door', false); Game.setFlash('vent', false); });

  // ---- one-shot events -> sound ----
  function handleEvents() {
    for (const ev of G.events.splice(0)) {
      switch (ev.type) {
        case 'cam': Sfx.cam(); break;
        case 'monitor': Sfx.monitor(ev.data); break;
        case 'click': Sfx.click(); break;
        case 'submit': Sfx.submit(ev.data); break;
        case 'flash': Sfx.flash(ev.data); break;
        case 'ready': Sfx.cooldownDone(); break;
        case 'accept': Sfx.accept(); break;
        case 'reject': Sfx.reject(); break;
        case 'block': Sfx.block(); break;
        case 'jam': Sfx.jam(); break;
        case 'tell': Sfx.tell(ev.data.kind, ev.data.entry); break;
        case 'spike': Sfx.spike(ev.data); break;
        case 'sight': Sfx.sight(); break;
        case 'spawn': break;
        case 'lose': deathAt = performance.now(); deathCause = ev.data; setTimeout(showEnd, Sfx.death(ev.data)); break;
        case 'win': Sfx.win(); setTimeout(showEnd, 400); break;
      }
    }
  }

  // ---- HUD refresh ----
  function updateHud() {
    const room = ROOM[G.cam];
    $('camLabel').textContent = 'OFFICE'; $('camLabel').style.display = G.monitor ? 'none' : '';
    $('mapTitle').textContent = `${room.name.toUpperCase()} | ${DIST[room.id]} STEPS FROM YOU`;
    $('clock').textContent = HOURS[Game.hourIndex()];
    $('powerFill').style.width = G.power + '%';
    $('powerFill').style.background = G.power < 25 ? '#d96' : '#8fcf8f';
    $('powerNum').textContent = Math.ceil(G.power) + '%';
    $('loadFill').style.width = G.overload + '%';
    $('monitorBtn').textContent = G.monitor ? 'LOWER MONITOR [SPACE]' : 'RAISE MONITOR [SPACE]';
    $('defense').classList.toggle('hidden', G.monitor);
    $('doorBtn').classList.toggle('active', G.door); $('ventBtn').classList.toggle('active', G.vent);
    for (const k of ['door', 'vent']) {
      $(k + 'Strain').style.width = G.strain[k] + '%';
      $(k + 'Strain').style.background = G.strain[k] > 70 ? '#e55' : '#cf8f4f';
      $(k + 'Note').textContent = G.jam[k] > 0 ? `JAMMED ${Math.ceil(G.jam[k])}s` : (G.strain[k] > 70 ? 'STRAINING' : '');
      $(k + 'Btn').disabled = G.jam[k] > 0;
      $(k + 'Light').disabled = G[k];
      $(k + 'Light').classList.toggle('active', G.flash[k]);
    }
    $('doorBtn').textContent = G.door ? 'DOOR: CLOSED [A]' : 'DOOR: OPEN [A]';
    $('ventBtn').textContent = G.vent ? 'VENT: SEALED [D]' : 'VENT: OPEN [D]';
    $('mapWrap').classList.toggle('hidden', !G.monitor);
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
  // ---- security camera look ----
  // The room is drawn into a small buffer (low resolution, like a CCTV sensor), then upscaled with a
  // slow pan, soft focus, ghosting, scanlines, a rolling sync bar, VHS head-switching noise at the bottom,
  // tracking glitches and burned-in on-screen text (camera name, REC, date/time).
  const CW = 640, CH = 360;
  const cbuf = document.createElement('canvas'); cbuf.width = CW; cbuf.height = CH;
  const cctx = cbuf.getContext('2d');
  const noiseFrames = [];
  for (let k = 0; k < 4; k++) {                                    // coarse, blocky static (not fine grain)
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const x = c.getContext('2d'), d = x.createImageData(320, 180);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); noiseFrames.push(c);
  }
  const scan3 = document.createElement('canvas'); scan3.width = 4; scan3.height = 3;
  { const x = scan3.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, 4, 1); }
  const pad = n => String(n).padStart(2, '0');
  const supportsFilter = 'filter' in ctx;

  function drawCameraScene() {
    cctx.save(); cctx.setTransform(0.5, 0, 0, 0.5, 0, 0); cctx.clearRect(0, 0, W, H);
    Scene.drawRoom(cctx, G.cam, G.anomalies);
    for (const e of G.entities) {
      if (Game.roomOf(e) !== G.cam) continue;
      const i = G.entities.indexOf(e), x = 300 + i * 340 + (e.stage * 53) % 120;
      Scene.drawFigure(cctx, x, 560, 360, 0.95, true);
    }
    for (const h of G.halluc) {
      if (h.room !== G.cam) continue;
      const fade = Math.min(1, h.life / 0.6) * Math.min(1, (h.max - h.life) / 0.6 + 0.2);
      const flick = Math.random() < 0.18 ? 0.25 : 1;
      if (h.kind === 'face') {
        cctx.save(); cctx.globalAlpha = h.alpha * fade * flick;
        cctx.fillStyle = '#dff'; cctx.beginPath(); cctx.ellipse(h.x, h.y, 34, 46, 0, 0, 7); cctx.fill();
        cctx.fillStyle = '#000'; cctx.fillRect(h.x - 16, h.y - 10, 9, 14); cctx.fillRect(h.x + 8, h.y - 10, 9, 14); cctx.fillRect(h.x - 8, h.y + 18, 16, 6);
        cctx.restore();
      } else Scene.drawFigure(cctx, h.x, h.y, 330, h.alpha * fade * flick, false);
    }
    cctx.restore();
  }

  function renderCamera(now) {
    const t = now / 1000, over = G.overload / 100;
    drawCameraScene();
    // upscale with slow pan + zoom so the edges never show
    const zoom = 1.08, dw = W * zoom, dh = H * zoom, ox = (W - dw) / 2 + Math.sin(t * 0.35) * (zoom - 1) * W * 0.5, oy = (H - dh) / 2;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    if (supportsFilter) ctx.filter = 'grayscale(0.9) contrast(1.25) brightness(1.15) blur(0.7px)';
    ctx.drawImage(cbuf, ox, oy, dw, dh);
    ctx.filter = 'none';
    ctx.globalAlpha = 0.12; ctx.drawImage(cbuf, ox + 6, oy, dw, dh); ctx.globalAlpha = 1;       // ghosting
    ctx.restore();

    // sync / tracking problems get worse with overload
    const bandY = (t * 70) % (H + 260) - 130;
    const bg = ctx.createLinearGradient(0, bandY - 80, 0, bandY + 80);
    bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(0.5, `rgba(255,255,255,${0.05 + over * 0.05})`); bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, bandY - 80, W, 160);
    ctx.drawImage(canvas, 0, H - 40, W, 40, Math.sin(t * 3) * 9, H - 40, W, 40);              // VHS head-switching wobble
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, H - 8, W, 8);
    const bands = Math.random() < 0.012 + over * 0.07 ? 1 + Math.floor(Math.random() * 3) : 0;   // tracking glitches
    for (let i = 0; i < bands; i++) {
      const y = Math.random() * H, hh = 6 + Math.random() * 30;
      ctx.drawImage(canvas, 0, y, W, hh, (Math.random() - 0.5) * (30 + over * 80), y, W, hh);
    }

    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(190,215,205)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H); ctx.restore();

    // burned-in on-screen text (below the scanlines and static, so it looks like part of the tape)
    const hr = Math.floor(G.t / 60), mm = Math.floor(G.t % 60), ss = Math.floor(t) % 60;
    ctx.save(); ctx.font = 'bold 30px "Courier New", monospace'; ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(180,255,190,.7)'; ctx.shadowBlur = 5; ctx.fillStyle = '#e8f4e8';
    ctx.fillText(`CAM ${pad(ROOMS.findIndex(r => r.id === G.cam) + 1)}`, 28, 24);
    ctx.font = 'bold 20px "Courier New", monospace'; ctx.fillText(ROOM[G.cam].name.toUpperCase(), 28, 60);
    ctx.font = 'bold 22px "Courier New", monospace'; ctx.textAlign = 'center';
    ctx.fillText(`10/31/1991  ${hr === 0 ? 12 : hr}:${pad(mm)}:${pad(ss)} AM`, W / 2, 26);
    if (Math.floor(t * 1.2) % 2 === 0) { ctx.shadowColor = 'rgba(255,60,60,.8)'; ctx.fillStyle = '#e33'; ctx.textAlign = 'left'; ctx.font = 'bold 22px "Courier New", monospace'; ctx.fillText('● REC', 190, 30); }
    ctx.restore();

    // scanlines, coarse static, vignette, tint
    ctx.save();
    ctx.fillStyle = ctx.createPattern(scan3, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.06 + over * 0.08; ctx.drawImage(noiseFrames[Math.floor(Math.random() * 4)], 0, 0, W, H);
    if (G.staticT > 0) {                                             // switching cameras: signal drops for a moment
      ctx.globalAlpha = Math.min(0.95, G.staticT * 4); ctx.drawImage(noiseFrames[Math.floor(Math.random() * 4)], 0, 0, W, H);
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 3; i++) ctx.fillRect(0, Math.random() * H, W, 2 + Math.random() * 6);
    }
    ctx.restore();
    ctx.fillStyle = `rgba(120,0,0,${over * over * 0.3})`; ctx.fillRect(0, 0, W, H);
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H);
    if (!G.monitor) {
      Scene.drawOffice(ctx, { door: G.door, vent: G.vent, flash: G.flash, fakes: G.entryFake, atEntry: Game.entitiesAtEntry });
      post(0.1, 'rgb(140,170,160)');
    } else renderCamera(now);
    if (deathCause === 'power' && deathAt) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0, (performance.now() - deathAt - 150) / 500))})`; ctx.fillRect(0, 0, W, H);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000) * SPEED; last = now;
    // when speeding up for tests, run several small steps
    const steps = Math.max(1, Math.round(SPEED)); for (let i = 0; i < steps; i++) Game.update(dt / steps);
    handleEvents();
    if (!window.__soundtest) Sfx.frame(dt, { monitor: G.monitor, cam: G.cam, fear: G.fear, overload: G.overload, night: G.night, progress: Game.progress(), running: G.running, holding: G.holding });
    if (G.cfg) { updateHud(); render(now); } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__game = Game;                                      // handy for debugging in the console
  if (params.get('night')) begin(+params.get('night'));
})();
