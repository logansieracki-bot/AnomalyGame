// Procedural placeholder rooms. Each room has a fixed layout (the "baseline photo");
// anomalies are modifications applied on top of it when drawing.
// To swap in real photos later, replace drawRoom() with a drawImage of the baseline
// plus per-anomaly overlay images; the anomaly data model stays the same.
const Scene = (() => {
  const HORIZON = 330;
  const layouts = {};
  let aid = 0;

  function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

  function layoutFor(roomId) {
    if (layouts[roomId]) return layouts[roomId];
    const r = mulberry(hash(roomId));
    const doorLeft = r() < 0.5;
    const L = { items: [], lampX: 0, lampOn: r() < 0.45, doorLeft };
    L.items.push({ id: 'door', kind: 'door', x: doorLeft ? 90 + r() * 50 : 1060 + r() * 60, y: HORIZON - 240, w: 130, h: 290 });
    L.items.push({ id: 'window', kind: 'window', x: 500 + r() * 140, y: 70, w: 220, h: 170 });
    L.items.push({ id: 'frame', kind: 'frame', x: doorLeft ? 330 + r() * 60 : 880 + r() * 80, y: 110, w: 90, h: 70, rot: 0 });
    L.lampX = doorLeft ? 1000 + r() * 60 : 300 + r() * 60;
    const furn = [];
    for (let i = 0; i < 3; i++) {
      const w = 200 + r() * 110, h = 90 + r() * 70;
      const x = 120 + i * 370 + r() * 60;
      const bottom = HORIZON + 140 + r() * 130;
      const f = { id: 'furn' + i, kind: 'furn', x, y: bottom - h, w, h, rot: 0 };
      furn.push(f); L.items.push(f);
    }
    const shapes = ['box', 'cup', 'book'];
    furn.forEach((f, i) => {
      const s = 28 + r() * 22;
      L.items.push({ id: 'small' + i, kind: 'small', shape: shapes[(i + Math.floor(r() * 3)) % 3], x: f.x + 20 + r() * (f.w - s - 40), y: f.y - s, w: s * (i % 3 === 2 ? 1.6 : 1), h: i % 3 === 2 ? s * 0.4 : s, rot: 0 });
    });
    layouts[roomId] = L;
    return L;
  }

  // ---- anomaly generation ----
  function makeAnomaly(roomId, type, subtle, r = Math.random) {
    const L = layoutFor(roomId);
    const mag = 1 - subtle * 0.75;                       // 1 = obvious, 0.25 = subtle
    const movable = L.items.filter(i => i.kind === 'small' || i.kind === 'frame');
    const a = { id: ++aid, room: roomId, type, target: null };
    switch (type) {
      case 'lighting':
        if (r() < 0.55) a.target = 'lamp';
        else { a.target = 'ambient'; a.delta = (r() < 0.5 ? 1 : -1) * (0.05 + 0.16 * mag); }
        break;
      case 'structural':
        a.target = r() < 0.5 ? 'door' : 'window'; a.amount = 0.4 + 0.6 * mag; break;
      case 'shadow':   // hard-edged dark slab cast on the WALL; never on the floor, never a person shape
        a.x = 200 + r() * 880; a.y = 40 + r() * 80; a.w = 50 + r() * 70; a.h = 100 + r() * 70;
        a.skew = (r() - 0.5) * 70; a.alpha = 0.3 + 0.45 * mag; break;
      case 'surface':  // wet sheen on the FLOOR, or a crack in the WALL
        if (r() < 0.6) { a.shape = 'puddle'; a.x = 220 + r() * 840; a.y = 480 + r() * 190; a.r = 22 + 55 * mag; a.alpha = 0.25 + 0.4 * mag; }
        else { a.shape = 'crack'; a.x = 220 + r() * 840; a.y = 30 + r() * 80; a.len = 80 + 120 * mag; a.alpha = 0.4 + 0.5 * mag; a.seed = Math.floor(r() * 1e6); }
        break;
      case 'relocated': {
        const t = pick(movable, r); a.target = t.id;
        a.dx = (r() < 0.5 ? -1 : 1) * (30 + 150 * mag); a.dy = (r() - 0.5) * 30; break;
      }
      case 'rotation': {
        const t = pick(movable, r); a.target = t.id;
        a.angle = (r() < 0.5 ? -1 : 1) * (0.12 + 0.9 * mag); break;
      }
      case 'missing': a.target = pick(movable, r).id; break;
      case 'new':
        a.x = 150 + r() * 980; a.y = 520 + r() * 150; a.size = 24 + 44 * mag; a.shape = pick(['box', 'doll', 'bag'], r); break;
    }
    return a;
  }

  // ---- drawing ----
  const BRIGHT = 1.9;   // placeholder art is authored dark; lift it so the feed is readable
  const grey = (v, a = 1) => { v = Math.min(255, v * BRIGHT); return `rgba(${v},${v},${v},${a})`; };

  function drawFigure(ctx, x, y, h, alpha, solid) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
    const s = h / 340;
    ctx.scale(s, s);
    ctx.fillStyle = solid ? '#070807' : '#d8e8d8';
    ctx.beginPath(); ctx.arc(0, -300, 30, 0, 7); ctx.fill();                     // head
    ctx.beginPath(); ctx.moveTo(-40, -262); ctx.quadraticCurveTo(0, -280, 40, -262);
    ctx.lineTo(55, -90); ctx.lineTo(-55, -90); ctx.fill();                       // torso
    ctx.fillRect(-45, -90, 32, 90); ctx.fillRect(13, -90, 32, 90);               // legs
    ctx.fillRect(-75, -258, 20, 150); ctx.fillRect(55, -258, 20, 150);           // arms
    if (solid) { ctx.fillStyle = '#e8ffe8'; ctx.fillRect(-14, -306, 7, 5); ctx.fillRect(8, -306, 7, 5); }
    ctx.restore();
  }

  function drawRoom(ctx, roomId, anomalies, opts = {}) {
    const room = ROOM[roomId], L = layoutFor(roomId);
    const A = {
      move: {}, rot: {}, missing: {}, lampToggle: false, ambient: 0,
      doorOpen: 0, windowClosed: 0, shadows: [], stains: [], news: [],
    };
    for (const a of anomalies) {
      if (a.room !== roomId) continue;
      if (a.type === 'relocated') A.move[a.target] = a;
      else if (a.type === 'rotation') A.rot[a.target] = a.angle;
      else if (a.type === 'missing') A.missing[a.target] = true;
      else if (a.type === 'lighting') { if (a.target === 'lamp') A.lampToggle = true; else A.ambient += a.delta; }
      else if (a.type === 'structural') { if (a.target === 'door') A.doorOpen = a.amount; else A.windowClosed = a.amount; }
      else if (a.type === 'shadow') A.shadows.push(a);
      else if (a.type === 'surface') A.stains.push(a);
      else if (a.type === 'new') A.news.push(a);
    }
    const wv = room.wall, fv = room.floor;

    // wall + floor
    let g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, grey(wv * 0.6)); g.addColorStop(1, grey(wv));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON);
    g = ctx.createLinearGradient(0, HORIZON, 0, H);
    g.addColorStop(0, grey(fv * 1.3)); g.addColorStop(1, grey(fv * 0.6));
    ctx.fillStyle = g; ctx.fillRect(0, HORIZON, W, H - HORIZON);
    ctx.fillStyle = grey(wv * 1.5); ctx.fillRect(0, HORIZON - 6, W, 10);

    // door
    const door = L.items.find(i => i.id === 'door');
    ctx.fillStyle = grey(wv * 0.45); ctx.fillRect(door.x - 8, door.y - 8, door.w + 16, door.h + 8);
    if (A.doorOpen) {
      ctx.fillStyle = '#020302'; ctx.fillRect(door.x, door.y, door.w, door.h);
      const lw = door.w * (1 - 0.7 * A.doorOpen);
      ctx.fillStyle = grey(wv * 1.1);
      ctx.beginPath(); ctx.moveTo(door.x, door.y); ctx.lineTo(door.x + lw, door.y + 14 * A.doorOpen);
      ctx.lineTo(door.x + lw, door.y + door.h - 10 * A.doorOpen); ctx.lineTo(door.x, door.y + door.h); ctx.fill();
    } else {
      ctx.fillStyle = grey(wv * 1.1); ctx.fillRect(door.x, door.y, door.w, door.h);
      ctx.fillStyle = grey(wv * 0.9); ctx.fillRect(door.x + 14, door.y + 20, door.w - 28, door.h * 0.4);
      ctx.fillStyle = grey(110); ctx.beginPath(); ctx.arc(door.x + door.w - 18, door.y + door.h * 0.55, 6, 0, 7); ctx.fill();
    }

    // window
    const win = L.items.find(i => i.id === 'window');
    ctx.fillStyle = grey(wv * 0.4); ctx.fillRect(win.x - 10, win.y - 10, win.w + 20, win.h + 20);
    ctx.fillStyle = grey(10 + 8); ctx.fillRect(win.x, win.y, win.w, win.h);
    ctx.fillStyle = grey(wv * 0.5); ctx.fillRect(win.x + win.w / 2 - 3, win.y, 6, win.h);
    const cw = 34 + 70 * A.windowClosed;
    ctx.fillStyle = grey(wv * 0.8);
    ctx.fillRect(win.x - 10, win.y - 14, cw, win.h + 40);
    ctx.fillRect(win.x + win.w + 10 - cw, win.y - 14, cw, win.h + 40);

    // frame
    const fr = L.items.find(i => i.id === 'frame');
    if (!A.missing.frame) {
      ctx.save(); ctx.translate(fr.x + fr.w / 2, fr.y + fr.h / 2); ctx.rotate(A.rot.frame || 0);
      if (A.move.frame) ctx.translate(A.move.frame.dx * 0.4, A.move.frame.dy);
      ctx.fillStyle = grey(wv * 0.5); ctx.fillRect(-fr.w / 2, -fr.h / 2, fr.w, fr.h);
      ctx.fillStyle = grey(wv * 0.9); ctx.fillRect(-fr.w / 2 + 6, -fr.h / 2 + 6, fr.w - 12, fr.h - 12);
      ctx.fillStyle = grey(wv * 0.55); ctx.beginPath(); ctx.moveTo(-fr.w / 2 + 6, fr.h / 2 - 6);
      ctx.lineTo(-10, -4); ctx.lineTo(10, 14); ctx.lineTo(24, 2); ctx.lineTo(fr.w / 2 - 6, fr.h / 2 - 6); ctx.fill();
      ctx.restore();
    }

    // furniture + small items
    for (const it of L.items) {
      if (it.kind !== 'furn') continue;
      const m = A.move[it.id], dx = m ? m.dx : 0, dy = m ? m.dy : 0;
      ctx.fillStyle = grey(wv * 1.6); ctx.fillRect(it.x + dx, it.y + dy, it.w, 14);
      ctx.fillStyle = grey(wv * 1.25); ctx.fillRect(it.x + dx, it.y + 14 + dy, it.w, it.h - 14);
      ctx.fillStyle = grey(wv * 0.7); ctx.fillRect(it.x + dx, it.y + it.h - 6 + dy, it.w, 6);
    }
    for (const it of L.items) {
      if (it.kind !== 'small' || A.missing[it.id]) continue;
      const m = A.move[it.id];
      ctx.save();
      ctx.translate(it.x + it.w / 2 + (m ? m.dx : 0), it.y + it.h / 2 + (m ? m.dy : 0));
      ctx.rotate(A.rot[it.id] || 0);
      ctx.fillStyle = grey(it.shape === 'book' ? 105 : 140);
      if (it.shape === 'cup') {
        ctx.fillRect(-it.w / 2, -it.h / 2, it.w, it.h);
        ctx.fillStyle = grey(60); ctx.fillRect(-it.w / 2 + 3, -it.h / 2, it.w - 6, 5);
        ctx.fillStyle = grey(140); ctx.fillRect(it.w / 2, -it.h / 4, 9, it.h / 2);   // handle: shows rotation
      } else {
        ctx.fillRect(-it.w / 2, -it.h / 2, it.w, it.h);
        ctx.fillStyle = grey(90); ctx.fillRect(-it.w / 2, -it.h / 2, it.w, 4);
      }
      ctx.restore();
    }

    // lamp
    const lampOn = L.lampOn !== A.lampToggle;
    ctx.fillStyle = grey(55); ctx.fillRect(L.lampX - 4, HORIZON - 70, 8, 250);
    ctx.fillStyle = lampOn ? grey(210) : grey(95);
    ctx.beginPath(); ctx.moveTo(L.lampX - 38, HORIZON - 60); ctx.lineTo(L.lampX + 38, HORIZON - 60);
    ctx.lineTo(L.lampX + 24, HORIZON - 120); ctx.lineTo(L.lampX - 24, HORIZON - 120); ctx.fill();

    // anomalies drawn on top of the room
    for (const s of A.stains) {
      if (s.shape === 'puddle') {                     // light, glossy, on the floor
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(110,125,125,${s.alpha})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.7, s.r * 0.7, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(200,215,215,${s.alpha * 0.9})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x - s.r * 0.3, s.y - s.r * 0.15, s.r * 0.8, s.r * 0.25, 0, 3.4, 5.6); ctx.stroke();
        ctx.restore();
      } else {                                        // thin jagged dark line on the wall
        const rr = mulberry(s.seed); ctx.save(); ctx.strokeStyle = `rgba(0,0,0,${s.alpha})`; ctx.lineWidth = 3; ctx.lineJoin = 'miter';
        let x = s.x, y = s.y; ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 0; i < 9; i++) { x += (rr() - 0.5) * 40; y += s.len / 9; ctx.lineTo(x, y); }
        ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y + s.len * 0.45); ctx.lineTo(s.x + 35, s.y + s.len * 0.6); ctx.lineTo(s.x + 55, s.y + s.len * 0.55); ctx.stroke();
        ctx.restore();
      }
    }
    for (const s of A.shadows) {                      // hard-edged slab on the wall
      ctx.fillStyle = `rgba(0,0,0,${s.alpha})`; ctx.beginPath();
      ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.w, s.y + s.skew); ctx.lineTo(s.x + s.w, s.y + s.h + s.skew); ctx.lineTo(s.x, s.y + s.h); ctx.fill();
    }
    for (const n of A.news) {
      ctx.save(); ctx.translate(n.x, n.y);
      if (n.shape === 'doll') { ctx.fillStyle = grey(170); ctx.beginPath(); ctx.arc(0, -n.size, n.size * 0.35, 0, 7); ctx.fill(); ctx.fillRect(-n.size * 0.3, -n.size * 0.7, n.size * 0.6, n.size * 0.7); }
      else if (n.shape === 'bag') { ctx.fillStyle = grey(70); ctx.beginPath(); ctx.ellipse(0, -n.size * 0.4, n.size * 0.7, n.size * 0.5, 0, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = grey(150); ctx.fillRect(-n.size / 2, -n.size, n.size, n.size); ctx.fillStyle = grey(100); ctx.fillRect(-n.size / 2, -n.size, n.size, 5); }
      ctx.restore();
    }

    // lighting: lamp glow + ambient shift
    if (lampOn) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(L.lampX, HORIZON - 90, 10, L.lampX, HORIZON - 90, 420);
      lg.addColorStop(0, 'rgba(120,120,110,.55)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (A.ambient) {
      ctx.fillStyle = A.ambient > 0 ? `rgba(255,255,255,${A.ambient})` : `rgba(0,0,0,${-A.ambient * 2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Your room. Door on the left, vent on the right.
  function drawOffice(ctx, state) {
    ctx.fillStyle = '#0b0d0d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#101313'; ctx.fillRect(0, 470, W, 250);
    // door
    ctx.fillStyle = '#050606'; ctx.fillRect(110, 120, 300, 450);
    if (!state.door) {
      ctx.fillStyle = '#020303'; ctx.fillRect(130, 140, 260, 430);
      for (const e of state.atEntry('door')) drawFigure(ctx, 260, 570, 420, 0.9, true);
    } else {
      ctx.fillStyle = '#2a2f2e'; ctx.fillRect(110, 120, 300, 450);
      ctx.fillStyle = '#1f2423'; ctx.fillRect(135, 150, 250, 190); ctx.fillRect(135, 370, 250, 170);
      ctx.fillStyle = '#6a706e'; ctx.beginPath(); ctx.arc(360, 360, 9, 0, 7); ctx.fill();
    }
    // vent
    ctx.fillStyle = '#1b1f1f'; ctx.fillRect(850, 230, 280, 210);
    ctx.fillStyle = '#020303'; ctx.fillRect(865, 245, 250, 180);
    if (!state.vent) {
      for (const e of state.atEntry('vent')) {
        ctx.fillStyle = '#e8ffe8'; ctx.fillRect(960, 320, 10, 7); ctx.fillRect(1010, 320, 10, 7);
      }
    } else {
      ctx.fillStyle = '#343a39'; ctx.fillRect(865, 245, 250, 180);
      for (const x of [880, 925, 970, 1015, 1060]) { ctx.fillStyle = '#1c2120'; ctx.fillRect(x, 255, 18, 160); }
      ctx.fillStyle = '#6a706e';
      for (const [x, y] of [[872, 252], [1106, 252], [872, 416], [1106, 416]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
    }
    for (const x of [880, 925, 970, 1015, 1060]) { if (!state.vent) { ctx.fillStyle = 'rgba(60,66,64,.55)'; ctx.fillRect(x, 255, 6, 160); } }
    // desk
    ctx.fillStyle = '#161a19'; ctx.fillRect(0, 600, W, 120);
    ctx.fillStyle = '#222827'; ctx.fillRect(0, 600, W, 10);
    ctx.fillStyle = '#1b201f'; ctx.fillRect(520, 560, 240, 50);
  }

  return { layoutFor, makeAnomaly, drawRoom, drawOffice, drawFigure, pick };
})();
