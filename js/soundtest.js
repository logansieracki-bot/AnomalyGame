// Sound test page: open index.html?soundtest=1 (over http, with headphones) to audition every
// sound, bed and scare without playing a night, and to see which manifest files actually loaded.
(() => {
  if (!new URLSearchParams(location.search).get('soundtest')) return;
  window.__soundtest = true;
  const st = { monitor: true, cam: 'kitchen', fear: 0, overload: 0, night: 3, progress: 0.5, running: true, holding: false };
  const el = document.createElement('div'); el.id = 'soundtest';
  el.innerHTML = '<h2>SOUND TEST</h2><div id="stBody"></div>';
  document.getElementById('app').appendChild(el);
  const body = el.querySelector('#stBody');

  const section = (title) => { const s = document.createElement('section'); s.innerHTML = `<h3>${title}</h3>`; body.appendChild(s); return s; };
  const btn = (parent, label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { Sfx.init(); fn(); }; parent.appendChild(b); return b; };

  const files = document.createElement('div');
  let s = section('Start');
  btn(s, 'START AUDIO', () => { Sfx.newNight(); files.textContent = 'loading...'; Sfx.ready().then(refresh); });
  btn(s, 'RESET (after a death)', () => Sfx.newNight());
  s.insertAdjacentHTML('beforeend', ' Volume <input type="range" id="stVol" min="0" max="1" step="0.05"> <label><input type="checkbox" id="stRed"> Reduce loud sounds</label>');
  s.querySelector('#stVol').value = Sfx.volume; s.querySelector('#stVol').oninput = e => Sfx.setVolume(+e.target.value);
  s.querySelector('#stRed').checked = Sfx.reduced; s.querySelector('#stRed').onchange = e => Sfx.setReduced(e.target.checked);

  s = section('Ambience');
  btn(s, 'Camera view', () => st.monitor = true);
  btn(s, 'Office view (monitor down)', () => st.monitor = false);
  const sel = document.createElement('select');
  ROOMS.forEach(r => sel.add(new Option(r.name, r.id))); sel.value = st.cam; sel.onchange = () => { st.cam = sel.value; };
  s.appendChild(sel);
  btn(s, 'Dead air', () => Sfx.deadAir());
  btn(s, 'Tape glitch', () => Sfx.glitch());
  btn(s, 'Office house sound', () => Sfx.officeOneShot());

  s = section('Fear (heartbeat, breathing, tunnel hearing)');
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = 'Fear <input type="range" id="stFear" min="0" max="1" step="0.01" value="0"> <span id="stFearV">0</span> <label><input type="checkbox" id="stHold"> Holding breath (flashlight on something)</label>';
  s.appendChild(row);
  row.querySelector('#stFear').oninput = e => { st.fear = +e.target.value; row.querySelector('#stFearV').textContent = st.fear.toFixed(2); };
  row.querySelector('#stHold').onchange = e => { st.holding = e.target.checked; };
  btn(s, 'Heartbeat', () => Sfx.beat(0.8));
  btn(s, 'Breath', () => Sfx.breathe(0.6));
  btn(s, 'Gasp', () => Sfx.gasp(0.7));
  btn(s, 'Sighting (spike)', () => { Sfx.spike(0.7); Sfx.sight(); st.fear = Math.max(st.fear, 0.7); });

  s = section('Phantoms (far, muffled, never knock/scratch/breath)');
  btn(s, 'Phantom', () => Sfx.phantom());
  btn(s, '5 in a row', () => { for (let i = 0; i < 5; i++) setTimeout(() => Sfx.phantom(), i * 1500); });

  s = section('Entity sounds (close, dry; only after you have SEEN the entity)');
  btn(s, 'Knock (door)', () => Sfx.tell('knock', 'door'));
  btn(s, 'Scratch (vent)', () => Sfx.tell('scratch', 'vent'));
  btn(s, 'Breath (door)', () => Sfx.tell('breath', 'door'));

  s = section('Interface');
  for (const k of ['cam', 'click', 'accept', 'reject', 'block', 'jam', 'win']) btn(s, k, () => Sfx[k]());
  btn(s, 'monitor up', () => Sfx.monitor(true)); btn(s, 'monitor down', () => Sfx.monitor(false));

  s = section('Death sequences (then press RESET)');
  for (const c of ['door', 'vent', 'overload', 'power']) btn(s, c, () => { const ms = Sfx.death(c); const n = document.getElementById('stDur'); if (n) n.textContent = `${c}: end screen after ${(ms / 1000).toFixed(1)}s`; });
  s.insertAdjacentHTML('beforeend', ' <span id="stDur"></span>');

  s = section('Loaded files (from assets/audio/manifest.json)');
  s.appendChild(files);
  function refresh() {
    const stt = Sfx.status(), keys = Object.keys(stt).sort();
    if (!keys.length) { files.innerHTML = '<span class="miss">No manifest loaded: using synthesized stand-ins only. (Serve over http; file:// cannot load audio files.)</span>'; return; }
    files.innerHTML = '<table>' + keys.map(k => `<tr><td>${k}</td><td class="${stt[k].loaded ? 'ok' : 'miss'}">${stt[k].loaded}/${stt[k].want}</td></tr>`).join('') + '</table>';
  }
  files.textContent = 'Press START AUDIO to load the manifest.';

  btn(document.querySelector('#stBody section'), 'REFRESH FILE LIST', refresh);

  let last = performance.now();
  (function loop(now) { const dt = Math.min(0.1, (now - last) / 1000); last = now; Sfx.frame(dt, st); requestAnimationFrame(loop); })(last);
})();
