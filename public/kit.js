// Jeux Zozz’lympiques — outils partagés par les épreuves
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const $ = (root, sel) => root.querySelector(sel);

export async function countdown(root) {
  const el = document.createElement('div');
  el.className = 'cd';
  root.appendChild(el);
  for (const t of ['3', '2', '1', 'GO !']) {
    el.textContent = t;
    if (t === 'GO !') { sfx('gun'); buzz(80); } else { sfx('beep'); buzz(30); }
    await sleep(t === 'GO !' ? 450 : 800);
  }
  el.remove();
}

export function fitCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, W: r.width, H: r.height };
}

/* ---------- Classement live façon course (écran partagé) ---------- */
export function liveStandings(ctx, posEl, miniEl) {
  const fin = {}; // id -> instant d'arrivée
  let lastPos = 0;
  function update() {
    const now = performance.now();
    for (const p of ctx.players) if ((ctx.progs[p.id] || 0) >= 1 && !fin[p.id]) fin[p.id] = now;
    const list = [...ctx.players].sort((a, b) => {
      const fa = fin[a.id], fb = fin[b.id];
      if (fa && fb) return fa - fb; if (fa) return -1; if (fb) return 1;
      return (ctx.progs[b.id] || 0) - (ctx.progs[a.id] || 0);
    });
    const pos = list.findIndex((p) => p.id === ctx.me) + 1;
    if (pos !== lastPos) {
      posEl.innerHTML = `${pos}<sup>${pos === 1 ? 'er' : 'e'}</sup>`;
      posEl.className = 'pos bump ' + (pos <= 3 ? 'p' + pos : '');
      lastPos = pos;
    }
    const meIdx = pos - 1;
    const show = list.map((p, i) => ({ p, i })).filter(({ i }) => i < 4 || i === meIdx).slice(0, 5);
    // toujours 5 lignes : la hauteur ne bouge jamais quand le classement change
    const rows = show.map(({ p, i }) => `<div class="${p.id === ctx.me ? 'me' : ''}"><b>${i + 1}</b><span>${p.flag}</span><span class="n">${p.name}</span></div>`);
    while (rows.length < 5) rows.push('<div style="visibility:hidden"><b>0</b><span class="n">-</span></div>');
    const html = rows.join('');
    if (miniEl.innerHTML !== html) miniEl.innerHTML = html;
    return list;
  }
  return { update };
}

// Petit slime d'athlète vu de face (canvas 2D)
export function slime(g, cx, cy, r, color, band = '#e8456b') {
  g.lineWidth = 2; g.strokeStyle = '#2a1638';
  g.fillStyle = 'rgba(31,33,64,.2)'; g.beginPath(); g.ellipse(cx, cy + r * 0.9, r, r * 0.25, 0, 0, 7); g.fill();
  g.fillStyle = color; g.beginPath(); g.ellipse(cx, cy, r, r * 0.9, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.fillRect(cx - r, cy - r * 0.6, r * 2, r * 0.28);
  g.fillStyle = band; g.fillRect(cx - r, cy - r * 0.52, r * 2, r * 0.1);
  for (const s of [-1, 1]) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * r * 0.35, cy - r * 0.05, r * 0.2, 0, 7); g.fill();
    g.fillStyle = '#2a1638'; g.beginPath(); g.arc(cx + s * r * 0.35, cy - r * 0.02, r * 0.1, 0, 7); g.fill();
  }
}
// Fond de stade commun aux vues en canvas
export function stands(g, W, h) {
  g.fillStyle = '#ffd6e3'; g.fillRect(0, 0, W, h);
  const cols = ['#e8456b', '#ffd75e', '#9ee6cf', '#c9b8ff'];
  for (let i = 0, x = 4; x < W; i++, x += 9) { g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(x, h / 2 + ((i % 2) - 0.5) * 3, 2.5, 0, 7); g.fill(); }
}

/* ---------- Sons (synthétisés, aucun fichier) et vibrations ---------- */
let AC = null, muted = false;
try { muted = localStorage.getItem('bg_mute') === '1'; } catch {}
export const sound = {
  get muted() { return muted; },
  set muted(v) { muted = v; try { localStorage.setItem('bg_mute', v ? '1' : '0'); } catch {} },
  unlock() { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch {} },
};
addEventListener('pointerdown', () => sound.unlock(), { capture: true });
function tone(f, d, type = 'sine', v = 0.25, slide = 0, delay = 0) {
  const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
  o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + d + 0.02);
}
function noise(d, v = 0.3, freq = 1200, delay = 0, q = 0.7, attack = 0.005) {
  const t0 = AC.currentTime + delay, n = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, n, AC.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + attack); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
  s.connect(f).connect(g).connect(AC.destination); s.start(t0);
}
export function sfx(name) {
  if (muted || !AC) return;
  try {
    switch (name) {
      case 'beep': tone(660, 0.15, 'square', 0.12); break;
      case 'gun': noise(0.35, 0.8, 900, 0, 0.5); tone(120, 0.2, 'sawtooth', 0.15, -60); break;
      case 'pop': tone(500 + Math.random() * 300, 0.09, 'sine', 0.3, 500); break;
      case 'tick': tone(1200, 0.04, 'square', 0.06); break;
      case 'ok': tone(660, 0.1, 'triangle', 0.2); tone(990, 0.16, 'triangle', 0.2, 0, 0.09); break;
      case 'fail': tone(220, 0.3, 'sawtooth', 0.12, -90); break;
      case 'whistle': tone(2100, 0.35, 'sine', 0.15, 80); tone(2150, 0.35, 'sine', 0.08); break;
      case 'thud': tone(90, 0.25, 'sine', 0.5, -40); noise(0.12, 0.3, 300); break;
      case 'crowd': noise(1.6, 0.25, 700, 0, 0.4, 0.4); noise(1.4, 0.15, 1500, 0.1, 0.6, 0.5); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.16, 'triangle', 0.2, 0, i * 0.14)); break;
    }
  } catch {}
}
export const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch {} };

/* ---------- Inclinaison du téléphone (avec repli au doigt) ---------- */
// À appeler dans un geste utilisateur (bouton « Prêt ») pour iOS.
export async function requestSensors() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') await DeviceOrientationEvent.requestPermission();
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission();
  } catch {}
}
// value() : -1 (gauche) … +1 (droite). shake() : agitation récente (0 = immobile).
// Le doigt glissé sur `dragEl` prend le relais si le téléphone ne fournit pas de capteurs.
export function tilt(dragEl, range = 30) {
  let zero = null, gamma = null, lastSensor = 0, drag = 0, dragging = false, shakeV = 0, last = null;
  const onOri = (e) => { if (e.gamma == null) return; if (zero === null) zero = e.gamma; gamma = e.gamma - zero; lastSensor = performance.now(); };
  const onMot = (e) => { const a = e.accelerationIncludingGravity; if (!a || a.x == null) return; if (last) shakeV = shakeV * 0.85 + (Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z)) * 0.15; last = { x: a.x, y: a.y, z: a.z }; };
  addEventListener('deviceorientation', onOri); addEventListener('devicemotion', onMot);
  const pt = (e) => { const r = dragEl.getBoundingClientRect(); drag = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)); };
  if (dragEl) {
    dragEl.addEventListener('pointerdown', (e) => { dragging = true; dragEl.setPointerCapture(e.pointerId); pt(e); });
    dragEl.addEventListener('pointermove', (e) => { if (dragging) pt(e); });
    dragEl.addEventListener('pointerup', () => { dragging = false; });
  }
  return {
    get sensor() { return performance.now() - lastSensor < 600; },
    value() { if (dragging || !this.sensor) return drag; return Math.max(-1, Math.min(1, gamma / range)); },
    shake() { return this.sensor ? Math.min(1, shakeV / 3) : 0; },
    recalibrate() { zero = null; },
    stop() { removeEventListener('deviceorientation', onOri); removeEventListener('devicemotion', onMot); },
  };
}
