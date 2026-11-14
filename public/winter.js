// Jeux Ose’Lympiques — épreuves d'hiver refaites : bobsleigh, patinage artistique, saut à ski, snowboard halfpipe
import { sleep, $, countdown, fitCanvas, slime, stands, sfx, buzz } from './kit.js';

const W_PLUM = '#2a1638', W_CORAL = '#e8456b', W_MINT = '#9ee6cf', W_BUTTER = '#ffd75e', W_PAPER = '#fff1f5', W_ROSE = '#ffb6cf', W_LILAC = '#c9b8ff';
const wSeeded = (s0) => { let seed = (s0 || 1) >>> 0; return () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const wPhaseEl = (ph, msg) => (c, t, s) => { ph.className = 'phase ph-' + c; ph.textContent = t; if (msg) msg.textContent = s || ' '; };

/* ---------------- Bobsleigh : vue derrière le bob, poussée puis pilotage dans la piste ---------------- */
export async function bobsleigh(root, ctx) {
  const LEN = 800;
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="v">0 km/h</span><span id="t">0,00 s</span></div>
      <div class="runbar"><i id="pr" style="transform:scaleX(0)"></i></div>
      <div class="phase ph-wait" id="ph">Prépare-toi</div>
      <div class="duo"><button class="tapzone" id="L" disabled>⬅</button><button class="tapzone" id="Rb" disabled>➡</button></div>
    </div>`;
  const cv = $(root, '#cv'), L = $(root, '#L'), Rb = $(root, '#Rb'), vEl = $(root, '#v'), tEl = $(root, '#t'), pr = $(root, '#pr');
  const phase = wPhaseEl($(root, '#ph'));
  const { g, W, H } = fitCanvas(cv);
  // piste identique pour tous : enchaînement de virages (courbure -1..1) et de lignes droites
  const rnd = wSeeded(ctx.current.seed);
  const sections = []; let s = 0;
  sections.push({ a: 0, b: 60, c: 0 }); s = 60;
  while (s < LEN + 200) {
    const l = 50 + rnd() * 70, c = (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 0.55);
    sections.push({ a: s, b: s + l, c }); s += l;
    const st = 15 + rnd() * 35; sections.push({ a: s, b: s + st, c: 0 }); s += st;
  }
  const curv = (z) => { const sec = sections.find((q) => z >= q.a && z < q.b); if (!sec) return 0; const k = Math.min(1, (z - sec.a) / 12, (sec.b - z) / 12); return sec.c * Math.max(0, k); };
  let pos = 0, v = 0, px = 0, steer = 0, hitT = 0, state = 'wait', t0 = 0, time = 0, shake = 0;
  // commandes : maintenir ⬅ / ➡ pour diriger (pendant la poussée, chaque tap compte)
  let taps = 0, rec = [];
  const hold = { L: false, R: false };
  const bind = (el, k) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId); hold[k] = true;
      if (state === 'push') { const n = performance.now(); rec = rec.filter((x) => n - x < 1000); if (rec.length < 15) { rec.push(n); taps++; v = Math.min(11, 2 + taps * 0.35); } }
    });
    const up = () => (hold[k] = false); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  bind(L, 'L'); bind(Rb, 'R');
  function draw(now) {
    if (!root.isConnected) return;
    const hor = H * 0.3, N = 70, DZ = 2.4;
    const sk = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
    g.fillStyle = '#d9ecfb'; g.fillRect(0, 0, W, H);
    // sapins et montagne au loin
    g.fillStyle = '#b7d3ea'; g.beginPath(); g.moveTo(0, hor); for (let x = 0; x <= W; x += W / 8) g.lineTo(x, hor - 20 - Math.abs(Math.sin(x * 0.03 + 1)) * 40); g.lineTo(W, hor); g.fill();
    g.fillStyle = '#f4fbff'; g.fillRect(0, hor, W, H - hor);
    // projection des rangées de la piste, de loin vers près
    const rows = []; let xc = 0, dx = 0;
    for (let i = 0; i <= N; i++) { const z = i * DZ; dx += curv(pos + z) * 0.0042 * DZ; xc += dx * DZ; rows.push({ z, xc }); }
    const proj = (r) => { const p = 1 / (1 + r.z / 9); return { y: hor + (H - hor) * p, cx: W / 2 + sk + (r.xc - px * 3.4) * p * W * 0.13, hw: 4 * p * W * 0.13 }; };
    for (let i = N; i > 0; i--) {
      const a = proj(rows[i]), b = proj(rows[i - 1]);
      const stripe = Math.floor((pos + rows[i].z) / 6) % 2;
      // murs de glace
      g.fillStyle = stripe ? '#ffd6e3' : '#ffffff';
      g.beginPath(); g.moveTo(a.cx - a.hw * 1.25, a.y - a.hw * 0.25); g.lineTo(a.cx - a.hw, a.y); g.lineTo(b.cx - b.hw, b.y); g.lineTo(b.cx - b.hw * 1.25, b.y - b.hw * 0.25); g.fill();
      g.beginPath(); g.moveTo(a.cx + a.hw * 1.25, a.y - a.hw * 0.25); g.lineTo(a.cx + a.hw, a.y); g.lineTo(b.cx + b.hw, b.y); g.lineTo(b.cx + b.hw * 1.25, b.y - b.hw * 0.25); g.fill();
      // glace
      g.fillStyle = stripe ? '#e3f2fd' : '#eef8ff';
      g.beginPath(); g.moveTo(a.cx - a.hw, a.y); g.lineTo(a.cx + a.hw, a.y); g.lineTo(b.cx + b.hw, b.y); g.lineTo(b.cx - b.hw, b.y); g.fill();
      if (i % 4 === 0) { g.strokeStyle = 'rgba(42,22,56,.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a.cx - a.hw * 0.3, a.y); g.lineTo(b.cx - b.hw * 0.3, b.y); g.moveTo(a.cx + a.hw * 0.3, a.y); g.lineTo(b.cx + b.hw * 0.3, b.y); g.stroke(); }
    }
    // ligne d'arrivée
    const fz = LEN - pos;
    if (fz > 0 && fz < N * DZ) { const i = Math.round(fz / DZ), a = proj(rows[i]); g.fillStyle = W_PLUM; g.fillRect(a.cx - a.hw, a.y - 3, a.hw * 2, 6); }
    // le bob vu de derrière
    const by = H * 0.86, bw = W * 0.2, lean = (hold.L ? -1 : 0) + (hold.R ? 1 : 0);
    g.save(); g.translate(W / 2 + sk, by); g.rotate(lean * 0.06 + curv(pos) * 0.05);
    g.fillStyle = 'rgba(42,22,56,.18)'; g.beginPath(); g.ellipse(0, 18, bw * 0.6, 7, 0, 0, 7); g.fill();
    g.fillStyle = W_CORAL; g.beginPath(); g.moveTo(-bw / 2, 10); g.quadraticCurveTo(-bw / 2, -22, 0, -26); g.quadraticCurveTo(bw / 2, -22, bw / 2, 10); g.closePath(); g.fill();
    g.fillStyle = W_PLUM; g.fillRect(-bw / 2 - 2, 10, bw + 4, 6);
    g.restore();
    slime(g, W / 2 + sk + lean * 3, by - 34, 14, ctx.color(ctx.me));
    if (hitT > 0) { g.fillStyle = 'rgba(232,69,107,.18)'; g.fillRect(0, 0, W, H); }
    // flèche du prochain virage
    const nc = curv(pos + 30);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  // Phase 1 : poussée
  state = 'push'; L.disabled = Rb.disabled = false; L.textContent = 'TAP'; Rb.textContent = 'TAP';
  phase('run', '① Poussée : tape vite sur les deux boutons !');
  t0 = performance.now();
  let last = t0;
  await new Promise((res) => {
    function f(now) {
      if (!root.isConnected) return res();
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      time = (now - t0) / 1000;
      if (state === 'push') {
        pos += v * dt;
        if (time > 3) { state = 'run'; L.textContent = '⬅'; Rb.textContent = '➡'; phase('jump', '② Pilote ! Reste au milieu de la piste', `Vitesse de départ : ${Math.round(v * 3.6)} km/h`); sfx('whistle'); }
      } else {
        // descente : la pente accélère, les virages déportent vers l'extérieur
        v = Math.min(44, v + 2.6 * dt);
        steer = (hold.R ? 1 : 0) - (hold.L ? 1 : 0);
        px += (steer * 1.5 - curv(pos) * v * v * 0.0006) * dt; // virage à gauche → déporté à droite, il faut appuyer à gauche
        if (Math.abs(px) > 0.85) { px = Math.sign(px) * 0.8; if (hitT <= 0) { v *= 0.82; hitT = 0.5; shake = 1; sfx('fail'); buzz(120); phase('run', '💥 Paroi ! Redresse !'); } }
        else if (hitT <= 0 && Math.abs(px) < 0.5) phase('jump', Math.abs(curv(pos + 30)) > 0.2 ? (curv(pos + 30) < 0 ? 'Virage à gauche : appuie à gauche' : 'Virage à droite : appuie à droite') : 'Ligne droite : laisse filer');
        pos += v * dt;
      }
      hitT -= dt; shake = Math.max(0, shake - dt * 2);
      vEl.textContent = Math.round(v * 3.6) + ' km/h'; tEl.textContent = time.toFixed(2).replace('.', ',') + ' s';
      pr.style.transform = `scaleX(${Math.min(1, pos / LEN)})`; ctx.prog(Math.min(1, pos / LEN));
      if (pos >= LEN) return res();
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  });
  L.disabled = Rb.disabled = true; state = 'done';
  phase('wait', `🏁 Arrivée en ${time.toFixed(2).replace('.', ',')} s`);
  sfx('ok');
  ctx.finish(-Math.round(time * 100) / 100, time.toFixed(2) + ' s');
}

/* ---------------- Patinage artistique : 4 éléments différents, 2 fois chacun ---------------- */
export async function artistique(root, ctx) {
  const PROG = [
    { k: 'saut', n: 'Triple Axel' }, { k: 'pir', n: 'Pirouette assise' }, { k: 'pas', n: 'Séquence de pas' }, { k: 'spir', n: 'Spirale' },
    { k: 'saut', n: 'Quadruple Lutz' }, { k: 'pir', n: 'Pirouette Biellmann' }, { k: 'pas', n: 'Pas chorégraphiques' }, { k: 'spir', n: 'Spirale arabesque' },
  ];
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="s">0 pts</span><span id="t">Élément 1/8</span></div>
      <div class="phase ph-wait" id="ph">Prépare-toi</div>
      <div class="help" id="msg">&nbsp;</div>
      <div class="ringzone" id="rz"><canvas id="ring" style="position:absolute;inset:0;width:100%;height:100%"></canvas><span id="rl"></span></div>
    </div>`;
  const cv = $(root, '#cv'), rz = $(root, '#rz'), ring = $(root, '#ring'), rl = $(root, '#rl'), sEl = $(root, '#s'), tEl = $(root, '#t'), msg = $(root, '#msg');
  const phase = wPhaseEl($(root, '#ph'), msg);
  const { g, W, H } = fitCanvas(cv);
  const RG = fitCanvas(ring);
  let score = 0, spin = 0, jumpT = 0, pose = '', sk = { x: W / 2, y: H * 0.6 }, trail = [];
  function draw(now) {
    if (!root.isConnected) return;
    g.fillStyle = '#eaf6ff'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    g.strokeStyle = 'rgba(124,192,230,.5)'; g.lineWidth = 2; g.beginPath(); g.ellipse(W / 2, H * 0.62, W * 0.42, H * 0.28, 0, 0, 7); g.stroke();
    const t = now / 1000;
    if (!spin) { sk.x = W / 2 + Math.cos(t * 0.8) * W * 0.3; sk.y = H * 0.62 + Math.sin(t * 0.8) * H * 0.2; }
    trail.push({ x: sk.x, y: sk.y }); if (trail.length > 40) trail.shift();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.beginPath(); trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y + 12) : g.moveTo(p.x, p.y + 12))); g.stroke();
    const hop = jumpT > now ? Math.sin((1 - (jumpT - now) / 600) * Math.PI) * 26 : 0;
    g.save(); g.translate(sk.x, sk.y - hop); g.rotate(spin ? t * spin * 6 : pose === 'spir' ? -0.5 : 0); g.translate(-sk.x, -(sk.y - hop));
    slime(g, sk.x, sk.y - hop, 15, ctx.color(ctx.me), W_LILAC);
    g.restore();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  const add = (p, txt) => { score += p; sEl.textContent = score + ' pts'; msg.textContent = txt; };
  const { g: rg, W: rw, H: rh } = RG;
  const C = { x: rw / 2, y: rh / 2 }, base = Math.min(rw, rh) * 0.22;
  const pt = (e) => { const r = ring.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  // 1. Saut : taper quand le cercle mobile recouvre le cercle doré
  async function saut(el, lvl) {
    phase('jump', `⛸ ${el.n}`, 'Tape quand le cercle rouge recouvre le cercle doré'); rl.textContent = 'TAP';
    const dur = lvl ? 1050 : 1400;
    const d = await new Promise((resolve) => {
      const t0 = performance.now(); let fin = false;
      (function f() {
        if (fin || !root.isConnected) return;
        const k = (performance.now() - t0) / dur, r = base * (2.6 - 1.9 * k);
        rg.clearRect(0, 0, rw, rh);
        rg.strokeStyle = W_BUTTER; rg.lineWidth = 10; rg.beginPath(); rg.arc(C.x, C.y, base, 0, 7); rg.stroke();
        rg.strokeStyle = W_CORAL; rg.lineWidth = 5; rg.beginPath(); rg.arc(C.x, C.y, Math.max(4, r), 0, 7); rg.stroke();
        if (k > 1.25) { done(9); return; }
        requestAnimationFrame(f);
      })();
      const h = (e) => { e.preventDefault(); done(Math.abs((performance.now() - t0) / dur - 0.842)); };
      function done(x) { if (fin) return; fin = true; rz.removeEventListener('pointerdown', h); resolve(x); }
      rz.addEventListener('pointerdown', h);
    });
    jumpT = performance.now() + 600;
    if (d < 0.035) { add(10, `Parfait ! ${el.n} +10`); sfx('ok'); buzz(30); }
    else if (d < 0.08) { add(6, `Bien ! ${el.n} +6`); sfx('tick'); }
    else if (d < 0.14) { add(3, `Réception fragile sur le ${el.n} +3`); sfx('tick'); }
    else { add(0, `Chute sur le ${el.n}…`); sfx('fail'); buzz(150); }
  }
  // 2. Pirouette : faire tourner le doigt sur le rond pendant 3 s
  async function pir(el, lvl) {
    phase('run', `🌀 ${el.n}`, 'Fais des cercles sur le rond le plus vite possible (3 s)'); rl.textContent = '';
    rg.clearRect(0, 0, rw, rh); rg.strokeStyle = W_LILAC; rg.lineWidth = 14; rg.beginPath(); rg.arc(C.x, C.y, base * 1.5, 0, 7); rg.stroke();
    let turns = 0, lastA = null;
    const pa = (e) => { const p = pt(e); return Math.atan2(p.y - C.y, p.x - C.x); };
    const down = (e) => { rz.setPointerCapture(e.pointerId); lastA = pa(e); };
    const move = (e) => { if (lastA === null) return; const a = pa(e); let d = a - lastA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; lastA = a; turns += Math.abs(d) / (2 * Math.PI); spin = Math.min(3, turns / 3 + 0.5); };
    const up = () => { lastA = null; };
    rz.addEventListener('pointerdown', down); rz.addEventListener('pointermove', move); rz.addEventListener('pointerup', up);
    await sleep(3000);
    rz.removeEventListener('pointerdown', down); rz.removeEventListener('pointermove', move); rz.removeEventListener('pointerup', up);
    spin = 0;
    const need = lvl ? 15 : 13; // tours pour 10 pts
    const p = Math.max(0, Math.min(10, Math.floor((turns - 3) / (need - 3) * 10)));
    add(p, `${el.n} : ${turns.toFixed(1).replace('.', ',')} tours · +${p}`); sfx(p >= 7 ? 'ok' : 'tick');
  }
  // 3. Séquence de pas : reproduire 5 glissés de direction affichés, vite
  async function pas(el, lvl) {
    const DIRS = ['⬆', '➡', '⬇', '⬅'], n = 5, seq = Array.from({ length: n }, () => Math.floor(Math.random() * 4));
    let i = 0, errors = 0, flash = null;
    const lim = lvl ? 5000 : 6000;
    phase('run', `👣 ${el.n}`, `Glisse dans le sens de la flèche entourée, une à une (${lim / 1000} s)`); rl.textContent = '';
    const paint = () => {
      rg.clearRect(0, 0, rw, rh); rg.textAlign = 'center'; rg.textBaseline = 'middle';
      const gap = Math.min(60, rw / 5.6);
      seq.forEach((d, k) => {
        const x = rw / 2 + (k - (n - 1) / 2) * gap, y = rh * 0.42;
        if (k < i) { rg.fillStyle = W_MINT; rg.beginPath(); rg.arc(x, y, gap * 0.42, 0, 7); rg.fill(); }
        if (k === i) { rg.strokeStyle = flash === 'ko' ? W_CORAL : W_PLUM; rg.lineWidth = 4; rg.beginPath(); rg.arc(x, y, gap * 0.42, 0, 7); rg.stroke(); }
        rg.font = '900 28px Unbounded, sans-serif';
        rg.fillStyle = k < i ? W_PLUM : k === i ? (flash === 'ko' ? W_CORAL : W_PLUM) : 'rgba(42,22,56,.3)';
        rg.fillText(DIRS[d], x, y + 1);
        if (k < i) { rg.font = '900 14px Unbounded, sans-serif'; rg.fillStyle = '#1f9e6e'; rg.fillText('✓', x, y + gap * 0.62); }
      });
      if (flash) { rg.font = '900 22px Unbounded, sans-serif'; rg.fillStyle = flash === 'ok' ? '#1f9e6e' : W_CORAL; rg.fillText(flash === 'ok' ? '✓ Validé !' : '✗ Mauvais sens', rw / 2, rh * 0.78); }
    };
    paint();
    const t0 = performance.now();
    await new Promise((resolve) => {
      let st = null, fin = false, ft = 0;
      const down = (e) => { st = pt(e); rz.setPointerCapture(e.pointerId); };
      const up = (e) => {
        if (!st || fin) return; const p = pt(e), dx = p.x - st.x, dy = p.y - st.y; st = null;
        if (Math.hypot(dx, dy) < 25) return;
        const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        if (d === seq[i]) { i++; flash = 'ok'; sfx('tick'); buzz(20); } else { errors++; flash = 'ko'; sfx('fail'); buzz(80); }
        clearTimeout(ft); ft = setTimeout(() => { flash = null; if (!fin) paint(); }, 500);
        paint(); if (i >= n) setTimeout(end, 350);
      };
      const end = () => { if (fin) return; fin = true; clearTimeout(to); rz.removeEventListener('pointerdown', down); rz.removeEventListener('pointerup', up); resolve(); };
      const to = setTimeout(end, lim);
      rz.addEventListener('pointerdown', down); rz.addEventListener('pointerup', up);
    });
    const time = (performance.now() - t0) / 1000;
    const p = i < n ? Math.max(0, i - errors) : Math.max(2, 10 - errors * 2 - (time > lim / 2000 ? 1 : 0));
    add(p, i < n ? `${el.n} incomplète (${i}/${n}) · +${p}` : `✓ ${el.n} validée en ${time.toFixed(1).replace('.', ',')} s · +${p}`);
    if (p >= 8) sfx('ok');
  }
  // 4. Spirale : garder le doigt sur l'étoile qui glisse sur la glace (4 s)
  async function spir(el, lvl) {
    phase('jump', `✨ ${el.n}`, 'Pose le doigt sur l\'étoile et suis-la sans la lâcher (4 s)'); rl.textContent = '';
    pose = 'spir';
    let on = 0, total = 0, f = null, star = { x: C.x, y: C.y };
    const down = (e) => { rz.setPointerCapture(e.pointerId); f = pt(e); };
    const move = (e) => { if (f) f = pt(e); };
    const up = () => { f = null; };
    rz.addEventListener('pointerdown', down); rz.addEventListener('pointermove', move); rz.addEventListener('pointerup', up);
    const t0 = performance.now(), D = 4000, sp = lvl ? 1.35 : 1;
    let last = t0;
    await new Promise((resolve) => {
      (function fr() {
        if (!root.isConnected) return resolve();
        const now = performance.now(), t = (now - t0) / 1000, dt = (now - last) / 1000; last = now;
        // trajectoire en arabesque (courbe de Lissajous)
        star = { x: C.x + Math.sin(t * 1.3 * sp) * rw * 0.36, y: C.y + Math.sin(t * 2.1 * sp + 0.6) * rh * 0.3 };
        const hit = f && Math.hypot(f.x - star.x, f.y - star.y) < 34;
        if (hit) on += dt; total += dt;
        rg.clearRect(0, 0, rw, rh);
        rg.fillStyle = hit ? W_MINT : W_ROSE; rg.beginPath(); rg.arc(star.x, star.y, 30, 0, 7); rg.fill();
        rg.fillStyle = W_PLUM; rg.font = '900 26px Unbounded, sans-serif'; rg.textAlign = 'center'; rg.textBaseline = 'middle'; rg.fillText('★', star.x, star.y + 1);
        rg.fillStyle = W_CORAL; rg.fillRect(0, rh - 6, rw * Math.min(1, (now - t0) / D), 6);
        if (now - t0 >= D) return resolve();
        requestAnimationFrame(fr);
      })();
    });
    rz.removeEventListener('pointerdown', down); rz.removeEventListener('pointermove', move); rz.removeEventListener('pointerup', up);
    pose = ''; rg.clearRect(0, 0, rw, rh);
    const k = total ? on / total : 0, p = Math.round(Math.min(1, k * 1.1) * 10);
    add(p, `${el.n} : ${Math.round(k * 100)} % sur l'étoile · +${p}`); sfx(p >= 7 ? 'ok' : 'tick');
  }
  const RUN = { saut, pir, pas, spir };
  await countdown(root);
  for (let i = 0; i < PROG.length; i++) {
    const el = PROG[i]; tEl.textContent = `Élément ${i + 1}/${PROG.length}`;
    phase('wait', `Prochain élément : ${el.n}`); rl.textContent = ''; rg.clearRect(0, 0, rw, rh);
    await sleep(900);
    await RUN[el.k](el, i >= 4 ? 1 : 0);
    await sleep(1000);
  }
  phase('wait', `Programme terminé : ${score} pts`, 'Les juges ont rendu leur note');
  ctx.finish(score, score + ' pts');
}

/* ---------------- Saut à ski (vol à ski) : élan accroupi, appel au bout de la table, vol en équilibre, télémark ---------------- */
export async function sautski(root, ctx) {
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="b">Meilleur : —</span><span id="tr">Saut 1/2</span></div>
      <div class="phase ph-wait" id="ph">Prépare-toi</div>
      <div class="help" id="msg">&nbsp;</div>
      <div class="gauge" id="gg"><div class="zone" id="gz" style="left:40%;width:20%"></div><div class="arrow" id="ga" style="left:50%"></div></div>
      <button class="tapzone" id="tap" disabled>…</button>
      <div class="duo flyduo" id="fz" hidden><div class="tapzone swz" id="FL">⬆<small>glisse vers le haut</small></div><div class="tapzone swz" id="FR">⬆<small>glisse vers le haut</small></div></div>
    </div>`;
  const fz = $(root, '#fz'), FL = $(root, '#FL'), FR = $(root, '#FR');
  const cv = $(root, '#cv'), tap = $(root, '#tap'), bEl = $(root, '#b'), trEl = $(root, '#tr'), gg = $(root, '#gg'), ga = $(root, '#ga'), gz = $(root, '#gz');
  const phase = wPhaseEl($(root, '#ph'), $(root, '#msg'));
  const { g, W, H } = fitCanvas(cv);
  // monde : x horizontal (m), y vertical (m) ; table du tremplin en (0,0)
  const hill = (x) => -(0.6 * x - 0.00105 * x * x);
  const RAMP = 90; // longueur de l'élan
  let J = { x: -RAMP, y: RAMP * 0.55, ang: 0, mode: 'ramp' }, marks = [], best = 0, held = false;
  tap.addEventListener('pointerdown', (e) => { e.preventDefault(); tap.setPointerCapture(e.pointerId); held = true; });
  const rel = () => (held = false); tap.addEventListener('pointerup', rel); tap.addEventListener('pointercancel', rel);
  function draw() {
    if (!root.isConnected) return;
    // caméra qui suit le sauteur
    const sc = Math.min(W / 120, H / 80), camX = J.x + 25, camY = J.y - 10;
    const S = (x, y) => [W / 2 + (x - camX) * sc, H / 2 - (y - camY) * sc];
    g.fillStyle = '#d9ecfb'; g.fillRect(0, 0, W, H);
    // tremplin d'élan
    g.fillStyle = '#ffffff'; g.strokeStyle = '#9fc9e8'; g.lineWidth = 2;
    const [x0, y0] = S(-RAMP - 40, (RAMP + 40) * 0.55), [tx, ty] = S(0, 0);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(tx, ty); g.lineTo(tx, H); g.lineTo(x0, H); g.closePath(); g.fill();
    const [zx, zy] = S(-6, 3.3); g.strokeStyle = W_CORAL; g.lineWidth = 5; g.beginPath(); g.moveTo(zx, zy); g.lineTo(tx, ty); g.stroke(); g.strokeStyle = '#9fc9e8'; g.lineWidth = 2;
    // piste de réception
    g.fillStyle = '#f4fbff'; g.beginPath(); g.moveTo(tx, ty + 8);
    for (let x = 0; x <= 320; x += 4) { const [a, b] = S(x, hill(x) - 3); g.lineTo(a, b); }
    g.lineTo(S(320, 0)[0], H); g.lineTo(tx, H); g.closePath(); g.fill(); g.stroke();
    // repères K et HS
    g.font = '800 10px Unbounded, sans-serif'; g.textAlign = 'center';
    for (const [m, c, lab] of [[100, W_PLUM, '100'], [150, W_PLUM, '150'], [200, W_CORAL, 'K 200'], [240, W_PLUM, 'HS 240']]) { const [a, b] = S(m, hill(m) - 3); g.fillStyle = c; g.fillRect(a - 1, b, 3, 12); g.fillText(lab, a, b + 24); }
    for (const mk of marks) { const [a, b] = S(mk, hill(mk) - 3); g.fillStyle = W_CORAL; g.beginPath(); g.arc(a, b, 4, 0, 7); g.fill(); }
    // le sauteur : skis + slime
    const [px, py] = S(J.x, J.y);
    g.save(); g.translate(px, py); g.rotate(-J.ang);
    g.strokeStyle = W_PLUM; g.lineWidth = 3;
    if (J.mode === 'fly') { g.beginPath(); g.moveTo(-14, 6); g.lineTo(16, -6); g.moveTo(-14, 10); g.lineTo(16, 10); g.stroke(); }
    else { g.beginPath(); g.moveTo(-16, 8); g.lineTo(16, 8); g.stroke(); }
    g.restore();
    if (J.mode === 'fall') slime(g, px + 10, py - 6, 10, ctx.color(ctx.me)); else slime(g, px, py - (J.crouch ? 6 : 12), J.crouch ? 9 : 11, ctx.color(ctx.me));
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  for (let jmp = 1; jmp <= 2; jmp++) {
    trEl.textContent = `Saut ${jmp}/2`;
    J = { x: -RAMP, y: RAMP * 0.55, ang: 0.5, mode: 'ramp', crouch: false };
    gg.hidden = true; fz.hidden = true; tap.hidden = false; tap.className = 'tapzone'; tap.disabled = false; tap.textContent = 'MAINTIENS';
    phase('wait', `Saut ${jmp}/2 : sur la barre de départ`, 'Maintiens le bouton pour te lancer en position accroupie');
    // 1. Élan : maintenir appuyé (accroupi = vitesse) ; relâcher sur la table = appel
    while (!held) await sleep(30);
    phase('run', '① Élan : garde le doigt appuyé…', 'Relâche pile au bout de la table (zone rose)');
    let v = 6, crouchT = 0, tot = 0, released = null, last = performance.now();
    while (J.x < 4) {
      await sleep(16);
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      J.crouch = held; tot += dt; if (held) crouchT += dt;
      v = Math.min(27, v + (held ? 7 : 3.5) * dt);
      J.x += v * dt; J.y = Math.max(0, -J.x * 0.55); J.ang = 0.5;
      if (!held && released === null && J.x > -RAMP + 5) released = J.x;
      tap.classList.toggle('jumpbtn', J.x > -14); tap.textContent = J.x > -14 ? 'LÂCHE !' : 'MAINTIENS';
    }
    const c = tot ? crouchT / tot : 0;
    const rx = released ?? 6; // pas relâché = appel raté au bout
    const q = Math.max(0, 1 - Math.abs(rx - (-1)) / 7); // idéal : 1 m avant le bout de la table
    tap.classList.remove('jumpbtn');
    const qTxt = q > 0.85 ? 'Appel parfait !' : q > 0.5 ? 'Bon appel' : rx < -1 ? 'Appel trop tôt' : 'Appel trop tard';
    // 2. Vol : glisser G puis D vers le haut, sur le rythme imposé par le vent
    J.mode = 'fly'; tap.hidden = true; gg.hidden = true; fz.hidden = false;
    phase('jump', `② Vol ! ${qTxt}`, 'Glisse vers le haut dans la zone qui s\'allume, pile quand le cercle se referme');
    let x = 0, y = 0, vx = 0.9 * (25 + 5 * c), vy = 1 + 3 * q, lift = 0.6, beats = 0, good = 0;
    // rythme : un temps toutes les 0,45 à 0,75 s (le vent change la cadence), côtés alternés
    let beatAt = performance.now() + 700, beatSide = 0, judged = false, period = 600;
    const swipes = [];
    const zoneSwipe = (el, s) => {
      let st = null;
      el.onpointerdown = (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); st = { y: e.clientY, t: performance.now() }; };
      el.onpointerup = (e) => { if (!st) return; const dy = st.y - e.clientY; const t = st.t; st = null; if (dy > 25) swipes.push({ s, t: (t + performance.now()) / 2 }); };
    };
    zoneSwipe(FL, 0); zoneSwipe(FR, 1);
    const judge = (qq, txt) => { beats++; good += qq; lift = lift * 0.55 + qq * 0.45; $(root, '#msg').textContent = txt; };
    last = performance.now();
    let landed = false;
    while (!landed) {
      await sleep(16);
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000) * 1.5; last = now;
      // traitement des glissés
      while (swipes.length) {
        const sw = swipes.shift(), err = Math.abs(sw.t - beatAt);
        if (judged || err > 260) { judge(0, '✗ Hors rythme'); sfx('fail'); continue; }
        if (sw.s !== beatSide) { judge(0, '✗ Mauvais côté'); sfx('fail'); judged = true; continue; }
        const qq = Math.max(0, 1 - err / 260); judged = true;
        judge(qq, qq > 0.75 ? '✓ Parfait, bien gainé !' : qq > 0.4 ? '✓ Bien' : '~ Un peu décalé');
        sfx(qq > 0.75 ? 'ok' : 'tick'); buzz(15);
      }
      if (now > beatAt + 260) {
        if (!judged) { judge(0, '✗ Temps manqué : le vent te déséquilibre'); buzz(60); }
        beatSide = 1 - beatSide; period = 450 + Math.random() * 300; beatAt += period; judged = false;
      }
      // anneaux qui se referment sur la zone active
      const k = Math.max(0, Math.min(1, (beatAt - now) / period));
      FL.classList.toggle('beat', beatSide === 0 && !judged); FR.classList.toggle('beat', beatSide === 1 && !judged);
      (beatSide ? FR : FL).style.setProperty('--k', (1 + k * 1.4).toFixed(3));
      vy -= 9.8 * (1 - lift * 0.68) * dt; x += vx * dt; y += vy * dt;
      J.x = x; J.y = y; J.ang = 0.25 + (1 - lift) * 0.35;
      if (y - hill(x) <= 0 && x > 5) landed = true;
    }
    fz.hidden = true; FL.classList.remove('beat'); FR.classList.remove('beat');
    J.y = hill(x); J.mode = 'land';
    // 3. Réception : stopper la barre (qui ne revient pas) dans la zone verte
    gg.hidden = false; tap.hidden = false; tap.disabled = false; tap.className = 'tapzone jumpbtn'; tap.textContent = 'STOP !';
    const zl = 45 + Math.random() * 30, zw = 14;
    gz.style.left = zl + '%'; gz.style.width = zw + '%';
    phase('jump', '③ Réception : stoppe la barre dans le vert !', 'Elle ne revient pas : rate-la et c\'est la chute');
    held = false;
    const pos = await new Promise((res) => {
      const t0 = performance.now(), D = 1300; let fin = false;
      const h2 = (e) => { e.preventDefault(); done(); };
      function done() { if (fin) return; fin = true; tap.removeEventListener('pointerdown', h2); res(Math.min(100, (performance.now() - t0) / D * 100)); }
      tap.addEventListener('pointerdown', h2);
      (function mv() { if (fin) return; const p = (performance.now() - t0) / D * 100; ga.style.left = Math.min(100, p) + '%'; if (p >= 100) return done(); requestAnimationFrame(mv); })();
    });
    let d = Math.round(x * 2) / 2;
    if (pos >= zl && pos <= zl + zw) { phase('wait', `✅ ${String(d).replace('.', ',')} m · télémark !`, `Rythme en vol : ${Math.round(good / Math.max(1, beats) * 100)} %`); sfx('ok'); buzz([30, 30, 30]); }
    else { J.mode = 'fall'; phase('run', `💥 Chute à la réception · 0 m`, `Tu aurais posé à ${String(d).replace('.', ',')} m…`); d = 0; sfx('fail'); buzz(250); }
    gg.hidden = true;
    if (d > 0) marks.push(d); best = Math.max(best, d); bEl.textContent = 'Meilleur : ' + String(best).replace('.', ',') + ' m';
    tap.disabled = true; tap.className = 'tapzone'; tap.textContent = '…'; held = false;
    await sleep(2200);
  }
  ctx.finish(Math.round(best * 10), best.toFixed(1).replace('.', ',') + ' m');
}

/* ---------------- Snowboard halfpipe : pomper au fond, tourner en l'air, poser à plat ---------------- */
export async function snowboard(root, ctx) {
  const AIRS = 6;
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="s">0 pts</span><span id="t">Saut 0/${AIRS}</span></div>
      <div class="phase ph-wait" id="ph">Prépare-toi</div>
      <div class="help" id="msg">&nbsp;</div>
      <div class="ringzone snowz" id="rz"><canvas id="dial" style="position:absolute;inset:0;width:100%;height:100%"></canvas><span id="rl">TAP au fond · ↻ en l'air</span></div>
    </div>`;
  const cv = $(root, '#cv'), rz = $(root, '#rz'), rl = $(root, '#rl'), sEl = $(root, '#s'), tEl = $(root, '#t');
  const DL = fitCanvas($(root, '#dial'));
  const phase = wPhaseEl($(root, '#ph'), $(root, '#msg'));
  const { g, W, H } = fitCanvas(cv);
  let armed = true, score = 0, airs = 0, E = 0.75, ph = -Math.PI / 2, dir = 1, inAir = null, rot = 0, lastA = null, fall = 0, popTxt = '', popT = 0;
  const pipe = (u) => { // u ∈ [-1,1] → point du halfpipe (demi-cercle aplati)
    const cx = W / 2, R = W * 0.4, by = H * 0.55;
    return { x: cx + u * R, y: by + Math.sqrt(Math.max(0, 1 - u * u)) * H * 0.3 };
  };
  const center = () => { const r = rz.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  rz.addEventListener('pointerdown', (e) => {
    e.preventDefault(); rz.setPointerCapture(e.pointerId);
    const c = center(); lastA = Math.atan2(e.clientY - c.y, e.clientX - c.x);
    if (!inAir && fall <= 0 && airs < AIRS) {
      // pomper : efficace seulement au fond du pipe
      const u = Math.sin(ph);
      if (Math.abs(u) < 0.3) { E = Math.min(1.75, E + 0.16); popTxt = 'Bonne impulsion !'; sfx('tick'); }
      else { E = Math.max(0.7, E - 0.06); popTxt = 'Impulsion au fond du pipe !'; }
      popT = 0.8;
    }
  });
  rz.addEventListener('pointermove', (e) => {
    if (lastA === null || !inAir) return;
    const c = center(), a = Math.atan2(e.clientY - c.y, e.clientX - c.x); let d = a - lastA;
    if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; lastA = a;
    rot += Math.abs(d) * 180 / Math.PI;
  });
  const upP = () => (lastA = null); rz.addEventListener('pointerup', upP); rz.addEventListener('pointercancel', upP);
  let last = performance.now();
  function frame(now) {
    if (!root.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let P, ang = 0;
    if (fall > 0) { fall -= dt; }
    if (inAir) {
      inAir.t += dt;
      const k = inAir.t / inAir.T;
      const lip = pipe(inAir.side);
      P = { x: lip.x - inAir.side * Math.sin(k * Math.PI) * W * 0.04, y: lip.y - Math.sin(k * Math.PI) * inAir.h };
      ang = rot * Math.PI / 180 * inAir.side;
      if (k >= 1) land();
    } else {
      // oscillation dans le pipe (pendule) ; amplitude E : au-delà de 1, on décolle de la lèvre
      ph += dt * 2.7 * dir;
      const u = Math.max(-1, Math.min(1, Math.sin(ph) * Math.min(E, 1)));
      if (Math.abs(Math.sin(ph)) < 0.6) armed = true;
      if (armed && E > 1 && Math.abs(Math.sin(ph)) >= 0.995 && airs < AIRS && fall <= 0) takeoff(Math.sign(Math.sin(ph)));
      P = pipe(u); ang = -u * 1.1;
    }
    // décor
    g.fillStyle = '#d9ecfb'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, pipe(-1).y);
    for (let u = -1; u <= 1.001; u += 0.05) { const p = pipe(u); g.lineTo(p.x, p.y); }
    g.lineTo(W, pipe(1).y); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    g.strokeStyle = '#9fc9e8'; g.lineWidth = 3; g.beginPath(); for (let u = -1; u <= 1.001; u += 0.05) { const p = pipe(u); u === -1 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y); } g.stroke();
    // jauge d'élan
    g.fillStyle = 'rgba(42,22,56,.15)'; g.fillRect(12, H - 18, W * 0.3, 8); g.fillStyle = E > 1 ? W_MINT : W_CORAL; g.fillRect(12, H - 18, W * 0.3 * Math.min(1, E / 1.75), 8);
    g.fillStyle = W_PLUM; g.font = '800 10px Unbounded, sans-serif'; g.textAlign = 'left'; g.fillText(E > 1 ? 'ÉLAN : ÇA DÉCOLLE' : 'ÉLAN', 12, H - 24);
    // rider
    g.save(); g.translate(P.x, P.y - 14); g.rotate(fall > 0 ? 1.4 : ang);
    g.fillStyle = W_CORAL; g.fillRect(-16, 10, 32, 5);
    g.restore();
    g.save(); g.translate(P.x, P.y - 14); g.rotate(fall > 0 ? 1.4 : ang * 0.9); slime(g, 0, -2, 12, ctx.color(ctx.me)); g.restore();
    drawDial();
    if (inAir) { const left = 1 - inAir.t / inAir.T; g.fillStyle = 'rgba(42,22,56,.15)'; g.fillRect(W * 0.2, H * 0.08, W * 0.6, 8); g.fillStyle = left > 0.3 ? W_MINT : W_CORAL; g.fillRect(W * 0.2, H * 0.08, W * 0.6 * left, 8); g.fillStyle = W_PLUM; g.font = '800 11px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillText('TEMPS EN L\'AIR', W / 2, H * 0.08 - 6); }
    else if (popT > 0) { popT -= dt; g.fillStyle = W_PLUM; g.font = '800 14px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillText(popTxt, W / 2, H * 0.2); }
    if (airs < AIRS || inAir) requestAnimationFrame(frame);
  }
  // cadran de rotation : vert = tu peux poser (près d'un demi-tour), rouge = rotation de travers
  function drawDial() {
    const { g: d, W: dw, H: dh } = DL; d.clearRect(0, 0, dw, dh);
    if (!inAir) { rz.classList.remove('ok', 'ko'); return; }
    const n = Math.round(rot / 180), off = Math.abs(rot - n * 180), ok = off <= 45;
    rz.classList.toggle('ok', ok); rz.classList.toggle('ko', !ok);
    const cx = dw / 2, cy = dh / 2, R = Math.min(dw, dh) * 0.36;
    d.lineWidth = 12;
    for (const base of [0, Math.PI]) { d.strokeStyle = 'rgba(31,158,110,.55)'; d.beginPath(); d.arc(cx, cy, R, base - Math.PI / 2 - Math.PI / 4, base - Math.PI / 2 + Math.PI / 4); d.stroke(); }
    d.strokeStyle = 'rgba(42,22,56,.15)'; d.lineWidth = 2; d.beginPath(); d.arc(cx, cy, R, 0, 7); d.stroke();
    const a = (rot % 360) * Math.PI / 180 - Math.PI / 2;
    d.strokeStyle = W_PLUM; d.lineWidth = 6; d.lineCap = 'round'; d.beginPath(); d.moveTo(cx, cy); d.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); d.stroke();
    d.fillStyle = W_PLUM; d.textAlign = 'center'; d.textBaseline = 'middle';
    d.font = '900 34px Unbounded, sans-serif'; d.fillText(Math.round(rot) + '°', cx, cy - R - 26 > 10 ? cy - R - 22 : 24);
    d.font = '900 16px Unbounded, sans-serif'; d.fillText(ok ? (n ? '✓ ' + n * 180 + '° : tu peux poser' : '✓ Air simple') : '✗ Continue jusqu\'au vert', cx, Math.min(dh - 16, cy + R + 22));
  }
  function takeoff(side) {
    const h = (E - 1) / 0.75; // 0..1
    armed = false;
    inAir = { side, t: 0, T: 0.9 + h * 1.1, h: H * (0.12 + h * 0.33), hm: 1 + h * 5 };
    rot = 0; airs++; tEl.textContent = `Saut ${airs}/${AIRS}`;
    phase('jump', '🌀 En l\'air : fais tourner ton doigt !', 'Arrête-toi sur un demi-tour pile (180°, 360°, 540°…) pour poser');
    rl.textContent = '↻';
  }
  function land() {
    const r = rot, n = Math.round(r / 180), off = Math.abs(r - n * 180), hm = inAir.hm;
    inAir = null; ph = Math.PI / 2 * (Math.sin(ph) > 0 ? 1 : -1) + 0.001; dir = 1;
    if (off <= 45) {
      const pts = n * 100 + Math.round(hm * 20);
      score += pts; sEl.textContent = score + ' pts'; sfx('ok'); buzz(40);
      phase('run', `✅ ${n ? n * 180 + '° posé' : 'Air simple'} · ${hm.toFixed(1).replace('.', ',')} m · +${pts}`, 'Retape au fond du pipe pour reprendre de l\'élan');
    } else {
      fall = 1.2; E = 0.8; sfx('fail'); buzz(200);
      phase('run', `💥 Chute : ${Math.round(r)}° (pas un demi-tour pile)`, 'Rotation de travers à la réception. Reprends ton élan.');
    }
    E = Math.max(0.8, E - 0.35);
    rl.textContent = 'TAP au fond · ↻ en l\'air';
  }
  requestAnimationFrame(frame);
  await countdown(root);
  phase('run', 'Prends de l\'élan : tape quand tu passes au fond du pipe', 'Quand la jauge est verte, tu décolles à la lèvre suivante');
  while (airs < AIRS || inAir) await sleep(100);
  await sleep(1300);
  phase('wait', `Run terminé : ${score} pts`);
  ctx.finish(score, score + ' pts');
}
