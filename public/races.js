// Jeux Zozz’lympiques — moteur de course partagé (vue de côté en haut, position en direct en bas)
// + les 5 courses : 100 m, 110 m haies, cyclisme sur piste, natation 4 nages, aviron.
import { sleep, $, countdown, fitCanvas, liveStandings , sfx} from './kit.js';

const THEMES = {
  sprint:   { track: '#ffb6cf', line: '#ffffff', len: 100, marks: [25, 50, 75], unit: 'm' },
  haies:    { track: '#ffb6cf', line: '#ffffff', len: 110, marks: [], unit: 'm', hurdles: Array.from({ length: 10 }, (_, i) => 13.72 + i * 9.14) },
  cyclisme: { track: '#e9b98a', line: '#4a7bd6', len: 1000, marks: [250, 500, 750], unit: 'm', gear: 'bike' },
  natation: { track: '#7fd3f5', line: 'rope', len: 200, marks: [50, 100, 150], unit: 'm', gear: 'swim' },
  aviron:   { track: '#5fb3e3', line: 'rgba(255,255,255,.5)', len: 2000, marks: [500, 1000, 1500], unit: 'm', gear: 'boat' },
};

function drawSlime(g, cx, cy, r, color, gear, hop, t) {
  g.lineWidth = 2; g.strokeStyle = '#2a1638';
  if (gear === 'bike') { // deux roues sous le slime
    for (const s of [-1, 1]) {
      g.beginPath(); g.arc(cx + s * r * 0.9, cy + r * 0.55, r * 0.55, 0, 7); g.stroke();
      g.beginPath(); const a = t * 12; g.moveTo(cx + s * r * 0.9 + Math.cos(a) * r * 0.5, cy + r * 0.55 + Math.sin(a) * r * 0.5); g.lineTo(cx + s * r * 0.9 - Math.cos(a) * r * 0.5, cy + r * 0.55 - Math.sin(a) * r * 0.5); g.stroke();
    }
    hop = 0; cy -= r * 0.25;
  }
  if (gear === 'boat') { // coque + avirons
    g.fillStyle = '#fff1f5'; g.beginPath(); g.moveTo(cx - r * 1.8, cy + r * 0.5); g.lineTo(cx + r * 2, cy + r * 0.5); g.lineTo(cx + r * 1.4, cy + r * 0.9); g.lineTo(cx - r * 1.4, cy + r * 0.9); g.closePath(); g.fill(); g.stroke();
    const a = Math.sin(t * 6) * 0.6;
    g.beginPath(); g.moveTo(cx, cy + r * 0.3); g.lineTo(cx - Math.cos(a) * r * 1.8, cy + r * 0.9 + Math.sin(a) * r * 0.4); g.stroke();
    hop = 0;
  }
  if (gear === 'swim') { // seul le haut du corps dépasse de l'eau
    g.save(); g.beginPath(); g.rect(cx - r * 2, cy - r * 2, r * 4, r * 2.2); g.clip();
  }
  g.fillStyle = 'rgba(31,33,64,.2)'; if (!gear) { g.beginPath(); g.ellipse(cx, cy + r * 0.9, r, r * 0.25, 0, 0, 7); g.fill(); }
  g.fillStyle = color;
  g.beginPath(); g.ellipse(cx, cy - hop, r, r * 0.88, 0, 0, 7); g.fill(); g.stroke();
  if (gear === 'swim') { // bonnet + lunettes
    g.fillStyle = '#e8456b'; g.beginPath(); g.ellipse(cx, cy - hop - r * 0.35, r * 0.95, r * 0.55, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#ffd75e'; g.fillRect(cx + r * 0.15, cy - hop - r * 0.2, r * 0.5, r * 0.22);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(cx - r * 1.3, cy, r * 0.3, Math.PI, 0); g.stroke();
    return;
  }
  if (gear === 'bike') { // casque profilé
    g.fillStyle = '#ffd75e'; g.beginPath(); g.ellipse(cx - r * 0.1, cy - r * 0.55, r * 0.95, r * 0.42, -0.15, Math.PI, 0); g.fill(); g.stroke();
  } else if (gear === 'boat') { // casquette
    g.fillStyle = '#2a1638'; g.beginPath(); g.ellipse(cx, cy - r * 0.5, r * 0.9, r * 0.4, 0, Math.PI, 0); g.fill(); g.fillRect(cx, cy - r * 0.55, r * 1.1, r * 0.12);
  } else { // bandeau
    g.fillStyle = '#fff'; g.fillRect(cx - r, cy - hop - r * 0.55, r * 2, r * 0.3);
    g.fillStyle = '#e8456b'; g.fillRect(cx - r, cy - hop - r * 0.47, r * 2, r * 0.12);
  }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + r * 0.4, cy - hop - r * 0.05, r * 0.22, 0, 7); g.fill();
  g.fillStyle = '#2a1638'; g.beginPath(); g.arc(cx + r * 0.48, cy - hop - r * 0.05, r * 0.11, 0, 7); g.fill();
}

// Crée l'écran partagé ; renvoie { ctl, advance(m), go(), meters, finished, trip() }
function raceScreen(root, ctx, kind) {
  const T = THEMES[kind];
  root.innerHTML = `
    <div class="split-top"><canvas id="race"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="m">0 m</span><span id="t">0.00 s</span></div>
      <div class="rank-row"><div class="pos p1" id="pos">1<sup>er</sup></div><div class="mini" id="mini"></div></div>
      <div class="ctl" id="ctl"></div>
    </div>`;
  const cv = $(root, '#race'), mEl = $(root, '#m'), tEl = $(root, '#t');
  const { g, W, H } = fitCanvas(cv);
  const st = liveStandings(ctx, $(root, '#pos'), $(root, '#mini'));
  const shown = {};
  const R = { ctl: $(root, '#ctl'), meters: 0, finished: false, started: false, start: 0, tripT: 0, onFinish: null };
  let clock = 0;
  function draw(dt) {
    clock += dt;
    const n = ctx.players.length, top = 18, laneH = Math.min(46, (H - top - 16) / n);
    const x0 = 46, x1 = W - 16, X = (m) => x0 + (x1 - x0) * m / T.len;
    g.fillStyle = '#fff1f5'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2a1638'; g.fillRect(0, 0, W, top - 4);
    for (let i = 0; i < W; i += 8) { g.fillStyle = ['#ffb6cf', '#9ee6cf', '#ffd75e', '#fff'][(i / 8) % 4]; g.fillRect(i + 2, 3 + ((i / 8 + Math.floor(clock * 4)) % 2) * 4, 4, 4); }
    g.fillStyle = T.track; g.fillRect(0, top, W, laneH * n);
    for (let i = 0; i <= n; i++) {
      const y = top + i * laneH;
      if (T.line === 'rope') { for (let x = 0; x < W; x += 8) { g.fillStyle = (x / 8) % 2 ? '#e8456b' : '#fff'; g.beginPath(); g.arc(x + 4, y, 2.5, 0, 7); g.fill(); } }
      else { g.strokeStyle = T.line; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    }
    g.font = '800 10px Unbounded, sans-serif'; g.textAlign = 'center';
    for (const d of T.marks) { const x = X(d); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(x - 1, top, 2, laneH * n); g.fillStyle = '#2a1638'; g.fillText(d + ' m', x, Math.min(H - 2, top + laneH * n + 12)); }
    if (T.hurdles) for (const h of T.hurdles) for (let i = 0; i < n; i++) {
      const x = X(h), y = top + i * laneH;
      g.fillStyle = '#fff'; g.fillRect(x - 1, y + laneH * 0.25, 2, laneH * 0.6); g.fillStyle = '#e8456b'; g.fillRect(x - 4, y + laneH * 0.25, 8, 3);
    }
    for (let y = top, k = 0; y < top + laneH * n; y += 6, k++) { g.fillStyle = k % 2 ? '#2a1638' : '#fff'; g.fillRect(x1, y, 6, 6); g.fillStyle = k % 2 ? '#fff' : '#2a1638'; g.fillRect(x1 + 6, y, 6, 6); }
    ctx.players.forEach((p, i) => {
      const target = ctx.progs[p.id] || 0;
      shown[p.id] = (shown[p.id] ?? 0) + (target - (shown[p.id] ?? 0)) * Math.min(1, dt * 10);
      const cy = top + i * laneH + laneH / 2, r = Math.min(laneH * 0.34, 14);
      const cx = X(shown[p.id] * T.len);
      const moving = target > 0 && target < 1;
      let hop = moving && !T.gear ? Math.abs(Math.sin(clock * 18 + i)) * r * 0.35 : 0;
      if (p.id === ctx.me) { g.fillStyle = 'rgba(242,92,148,.28)'; g.fillRect(0, top + i * laneH, W, laneH); }
      if (p.id === ctx.me && R.tripT > 0) { hop = 0; g.fillStyle = 'rgba(230,57,70,.5)'; g.beginPath(); g.arc(cx, cy, r * 1.6, 0, 7); g.fill(); }
      g.font = `${Math.min(laneH * 0.6, 18)}px serif`; g.textAlign = 'left'; g.fillText(p.flag, 4, cy + 6);
      // en natation, nage retour (50-100 et 150-200 m) : on reste en ligne, la vue est déroulée
      drawSlime(g, cx, cy, r, p.color, T.gear, hop, clock + i);
      if (p.id === ctx.me) { g.fillStyle = '#2a1638'; g.font = '900 9px Unbounded, sans-serif'; g.textAlign = 'left'; g.fillText('TOI', cx + r * 1.4 + 4, cy + 4); }
    });
    if (R.tripT > 0) R.tripT -= dt;
  }
  let last = performance.now();
  (function loop(t) { if (!root.isConnected) return; const dt = Math.max(0, Math.min(0.05, (t - last) / 1000)); last = t; draw(dt); st.update(); requestAnimationFrame(loop); })(last);
  const timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (R.started && !R.finished) tEl.textContent = ((performance.now() - R.start) / 1000).toFixed(2) + ' s'; }, 50);
  R.go = async () => { await countdown(root); R.started = true; R.start = performance.now(); };
  R.advance = (m) => {
    if (!R.started || R.finished) return;
    R.meters = Math.min(T.len, R.meters + m);
    mEl.textContent = Math.floor(R.meters) + ' m';
    ctx.prog(R.meters / T.len);
    if (R.meters >= T.len) {
      R.finished = true;
      const time = (performance.now() - R.start) / 1000;
      tEl.textContent = time.toFixed(2) + ' s';
      if (R.onFinish) R.onFinish();
      ctx.finish(-Math.round(time * 100) / 100, time.toFixed(2) + ' s');
    }
  };
  R.trip = () => { R.tripT = 0.6; if (navigator.vibrate) navigator.vibrate(150); };
  R.len = T.len;
  return R;
}

// Limiteur anti-triche : max n actions par seconde
const limiter = (n) => { let rec = []; return () => { const now = performance.now(); rec = rec.filter((t) => now - t < 1000); if (rec.length >= n) return false; rec.push(now); return true; }; };

/* ---------- 100 m ---------- */
export async function sprint(root, ctx) {
  const R = raceScreen(root, ctx, 'sprint');
  R.ctl.innerHTML = `<button class="tapzone" id="tap" disabled>TAP</button>`;
  const tap = $(root, '#tap'), ok = limiter(15);
  await R.go(); tap.disabled = false;
  tap.addEventListener('pointerdown', (e) => { e.preventDefault(); if (ok()) R.advance(1); });
  R.onFinish = () => { tap.disabled = true; };
}

/* ---------- 110 m haies ---------- */
export async function haies(root, ctx) {
  const R = raceScreen(root, ctx, 'haies');
  R.ctl.innerHTML = `<div class="duo"><button class="tapzone" id="tap" disabled>TAP</button><button class="jump" id="jump" disabled>SAUT</button></div>
    <div class="help" id="hint">Prochaine haie : 13,7 m</div>`;
  const tap = $(root, '#tap'), jump = $(root, '#jump'), hint = $(root, '#hint'), ok = limiter(15);
  const H = THEMES.haies.hurdles;
  let air = 0, slow = 0, next = 0;
  await R.go(); tap.disabled = jump.disabled = false;
  const lockZone = () => next < H.length && H[next] - R.meters < 2.5 && air <= 0;
  const refresh = () => {
    const locked = lockZone();
    tap.classList.toggle('locked', locked); jump.classList.toggle('callout', locked);
    tap.textContent = locked ? '⛔' : 'TAP';
    if (locked) { hint.textContent = '⚠️ HAIE ! Appuie sur SAUT'; hint.style.background = 'var(--gold)'; }
  };
  tap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (lockZone()) { refresh(); return; } // course bloquée devant la haie : il faut sauter
    if (!ok()) return;
    const step = slow > 0 ? 0.45 : 1;
    if (slow > 0) slow--;
    const before = R.meters;
    R.advance(step);
    if (air > 0) air -= step;
    while (next < H.length && before < H[next] && R.meters >= H[next]) {
      if (air <= 0) { slow = 12; R.trip(); sfx('fail'); hint.textContent = '💥 Haie renversée ! Tu ralentis…'; }
      next++;
    }
    if (next < H.length) {
      const d = H[next] - R.meters;
      if (slow <= 0) hint.textContent = d < 3 ? '⚠️ SAUTE !' : `Prochaine haie : ${d.toFixed(1).replace('.', ',')} m`;
      hint.style.background = d < 3 ? 'var(--gold)' : '';
    } else { hint.textContent = 'Dernière ligne droite !'; hint.style.background = ''; }
    refresh();
  });
  jump.addEventListener('pointerdown', (e) => { e.preventDefault(); if (air <= 0) { air = 3.2; hint.textContent = '🦘 En l\'air ! Continue de taper'; hint.style.background = ''; } refresh(); });
  R.onFinish = () => { tap.disabled = jump.disabled = true; };
}

/* ---------- Cyclisme sur piste (1 km) : faire tourner la roue ---------- */
export async function cyclisme(root, ctx) {
  const R = raceScreen(root, ctx, 'cyclisme');
  R.ctl.innerHTML = `<div class="wheel" id="wh"><div class="spokes" id="sp"></div><span>Fais des cercles</span></div>`;
  const wh = $(root, '#wh'), sp = $(root, '#sp');
  const PER_TURN = 25; // 1 tour de doigt = 25 m, 40 tours pour 1 km
  let lastA = null, rot = 0, recent = [];
  await R.go();
  const angle = (e) => { const r = wh.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  wh.addEventListener('pointerdown', (e) => { wh.setPointerCapture(e.pointerId); lastA = angle(e); });
  wh.addEventListener('pointermove', (e) => {
    if (lastA === null || !R.started) return;
    const a = angle(e); let d = a - lastA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; lastA = a;
    const now = performance.now();
    recent = recent.filter((x) => now - x.t < 1000); recent.push({ t: now, d: Math.abs(d) });
    const speed = recent.reduce((s, x) => s + x.d, 0) / (2 * Math.PI); // tours/s
    if (speed > 8) return; // plafond : 8 tours/s
    rot += d; sp.style.transform = `rotate(${rot}rad)`;
    R.advance(Math.abs(d) / (2 * Math.PI) * PER_TURN);
  });
  const up = () => { lastA = null; };
  wh.addEventListener('pointerup', up); wh.addEventListener('pointercancel', up);
}

/* ---------- Natation 4 × 50 m ---------- */
export async function natation(root, ctx) {
  const R = raceScreen(root, ctx, 'natation');
  const multi = (navigator.maxTouchPoints || 0) >= 2;
  const SEG = [
    { name: 'Papillon', kind: 'circle', how: multi ? '2 doigts : fais tourner (cercles)' : 'Fais des cercles', need: 16 },
    { name: 'Dos', kind: 'lr', how: multi ? '2 doigts : gauche ↔ droite' : 'Glisse gauche ↔ droite', need: 16 },
    { name: 'Brasse', kind: 'ud', how: multi ? '2 doigts : haut ↕ bas' : 'Glisse haut ↕ bas', need: 16 },
    { name: 'Crawl', kind: 'tap', how: 'Tape vite sur la zone', need: 40 },
  ];
  R.ctl.innerHTML = `<div class="segbar" id="sb">${SEG.map((s, i) => `<span data-i="${i}">${s.name}</span>`).join('')}</div>
    <div class="swimzone" id="sz"><b id="sh"></b></div>`;
  const sz = $(root, '#sz'), sh = $(root, '#sh'), sb = $(root, '#sb');
  const seg = () => Math.min(3, Math.floor(R.meters / 50));
  function label() { const s = SEG[seg()]; sh.textContent = s.how; sb.querySelectorAll('span').forEach((x) => x.classList.toggle('on', +x.dataset.i === seg())); }
  label();
  await R.go();
  const ok = limiter(15);
  const pts = new Map(); // pointeurs actifs
  let ext = null, dir = 0, angAcc = 0, lastAng = null;
  const stroke = () => { const s = seg(); R.advance(50 / SEG[s].need); if (seg() !== s) { ext = null; angAcc = 0; lastAng = null; } label(); };
  sz.addEventListener('pointerdown', (e) => {
    e.preventDefault(); sz.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (SEG[seg()].kind === 'tap' && R.started && ok()) stroke();
  });
  sz.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !R.started) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = seg(), kind = SEG[s].kind; if (kind === 'tap') return;
    const need = multi ? 2 : 1;
    if (pts.size < need) return;
    const arr = [...pts.values()];
    const avg = { x: arr.reduce((a, p) => a + p.x, 0) / arr.length, y: arr.reduce((a, p) => a + p.y, 0) / arr.length };
    if (kind === 'ud' || kind === 'lr') { // aller-retour
      const v = kind === 'ud' ? avg.y : avg.x;
      if (ext === null) { ext = v; return; }
      const d = v - ext;
      if (dir !== 0 && Math.sign(d) === dir) ext = v; // on prolonge le geste
      else if (Math.abs(d) > 45) { dir = Math.sign(d); ext = v; stroke(); } // demi-tour = un mouvement
    } else { // rotation
      let a;
      if (multi) a = Math.atan2(arr[1].y - arr[0].y, arr[1].x - arr[0].x);
      else { const r = sz.getBoundingClientRect(); a = Math.atan2(avg.y - (r.top + r.height / 2), avg.x - (r.left + r.width / 2)); }
      if (lastAng !== null) { let d = a - lastAng; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; angAcc += Math.abs(d); }
      lastAng = a;
      while (angAcc >= Math.PI && !R.finished) { angAcc -= Math.PI; stroke(); }
    }
  });
  const up = (e) => { pts.delete(e.pointerId); lastAng = null; };
  sz.addEventListener('pointerup', up); sz.addEventListener('pointercancel', up);
}

/* ---------- Aviron 2000 m : coups de rame vers le bas, en rythme ---------- */
export async function aviron(root, ctx) {
  const R = raceScreen(root, ctx, 'aviron');
  R.ctl.innerHTML = `<div class="rowzone" id="rz"><div class="oar l"></div><div class="oar r"></div><b id="rh">Tire vers le bas ⬇ en rythme</b></div>`;
  const rz = $(root, '#rz'), rh = $(root, '#rh');
  await R.go();
  let y0 = null, lastStroke = 0;
  rz.addEventListener('pointerdown', (e) => { rz.setPointerCapture(e.pointerId); y0 = e.clientY; });
  rz.addEventListener('pointermove', (e) => {
    if (y0 === null || !R.started) return;
    if (e.clientY - y0 > 70) {
      y0 = null;
      const now = performance.now(), gap = now - lastStroke; lastStroke = now;
      const good = gap >= 380; // trop rapide = coup raté
      R.advance(good ? 50 : 18);
      rh.textContent = good ? '💪 Bon coup !' : '🌊 Trop vite, garde le rythme';
      rz.classList.remove('pull'); void rz.offsetWidth; rz.classList.add('pull');
    }
  });
  rz.addEventListener('pointerup', () => { y0 = null; });
}
