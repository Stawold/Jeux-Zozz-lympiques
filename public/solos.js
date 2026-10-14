// Jeux Zozz’lympiques — épreuves solo : saut en longueur, skateboard, basketball, rugby, mini-golf
import { sleep, $, countdown, fitCanvas, slime, stands , sfx, buzz} from './kit.js';

const fmtM = (cm) => (cm / 100).toFixed(2).replace('.', ',') + ' m';

/* ---------------- Saut en longueur (2 phases bien distinctes) ---------------- */
export async function longueur(root, ctx) {
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="b">Meilleur : —</span><span id="tr">Essai 1/3</span></div>
      <div class="phase ph-wait" id="ph">Prépare-toi</div>
      <div class="help" id="msg">&nbsp;</div>
      <div class="runbar" id="rb"><i id="rbi"></i></div>
      <div class="gauge" id="gg" hidden><div class="zone" style="left:60%;width:20%"></div><div class="foul"></div><div class="arrow" id="a" style="left:0"></div></div>
      <button class="tapzone" id="tap" disabled>…</button>
    </div>`;
  const cv = $(root, '#cv'), tap = $(root, '#tap'), msg = $(root, '#msg'), a = $(root, '#a'), bEl = $(root, '#b'), trEl = $(root, '#tr');
  const ph = $(root, '#ph'), rb = $(root, '#rb'), rbi = $(root, '#rbi'), gg = $(root, '#gg');
  const { g, W, H } = fitCanvas(cv);
  const PIT0 = 0.42, M = (m) => W * PIT0 + (m / 10) * W * 0.55;
  let runX = 10, jump = null, marks = [], best = 0;
  const phase = (cls, txt, sub) => { ph.className = 'phase ph-' + cls; ph.textContent = txt; msg.textContent = sub || ' '; };
  function draw(t) {
    if (!root.isConnected) return;
    g.fillStyle = '#fff1f5'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    const gy = H * 0.72;
    g.fillStyle = '#ffb6cf'; g.fillRect(0, gy, W * PIT0, H - gy);
    g.fillStyle = '#f3d9a4'; g.fillRect(W * PIT0 + 6, gy, W * 0.56, H - gy);
    g.fillStyle = '#fff'; g.fillRect(W * PIT0 - 6, gy, 12, 6);
    g.fillStyle = '#e63946'; g.fillRect(W * PIT0 + 4, gy, 3, 6);
    g.font = '800 10px Unbounded, sans-serif'; g.textAlign = 'center';
    for (const m of [6, 7, 8, 9]) { g.fillStyle = '#2a1638'; g.fillRect(M(m) - 1, gy, 2, 10); g.fillText(m + ' m', M(m), gy + 22); }
    g.fillStyle = '#ffd75e'; g.fillRect(M(8.95) - 2, gy - 34, 4, 34); g.fillStyle = '#2a1638'; g.fillText('RM 8,95', M(8.95), gy - 38);
    g.fillText('PLANCHE', W * PIT0, gy + 22);
    for (const mk of marks) { g.fillStyle = mk.foul ? '#e63946' : '#2a1638'; g.beginPath(); g.arc(M(mk.d), gy + 3, 4, 0, 7); g.fill(); }
    let x = runX, y = gy - 16;
    if (jump) {
      const k = Math.min(1, (t - jump.t0) / 900);
      x = W * PIT0 + (M(jump.d) - W * PIT0) * k; y = gy - 16 - Math.sin(k * Math.PI) * H * 0.35;
      if (k >= 1 && !jump.done) { jump.done = true; marks.push({ d: jump.d, foul: jump.foul }); }
    }
    slime(g, x, y, 15, ctx.color(ctx.me));
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  for (let attempt = 1; attempt <= 3; attempt++) {
    trEl.textContent = `Essai ${attempt}/3`;
    jump = null; runX = 10;
    // PHASE 1 : élan
    rb.hidden = false; gg.hidden = true; rbi.style.transition = 'none'; rbi.style.transform = 'scaleX(1)';
    tap.className = 'tapzone'; tap.textContent = 'COURS !'; tap.disabled = false;
    phase('run', '① Élan : tape vite !', 'Tape le plus vite possible jusqu\'à la fin de la barre');
    let taps = 0, rec = [];
    const onTap = (e) => { e.preventDefault(); const n = performance.now(); rec = rec.filter((x) => n - x < 1000); if (rec.length >= 15) return; rec.push(n); taps++; runX = Math.min(W * PIT0 - 20, 10 + taps * (W * PIT0 / 34)); };
    tap.addEventListener('pointerdown', onTap);
    requestAnimationFrame(() => { rbi.style.transition = 'transform 2.5s linear'; rbi.style.transform = 'scaleX(0)'; });
    await sleep(2500);
    tap.removeEventListener('pointerdown', onTap);
    const speed = Math.min(1, taps / 30);
    // transition : stop
    tap.disabled = true; tap.textContent = 'STOP';
    phase('wait', '✋ Stop ! Arrivée sur la planche', `Vitesse d'élan : ${Math.round(speed * 100)} %`);
    await sleep(1200);
    // PHASE 2 : appel
    rb.hidden = true; gg.hidden = false;
    tap.className = 'tapzone jumpbtn'; tap.textContent = 'SAUTE !'; tap.disabled = false;
    phase('jump', '② Appel : saute !', 'Tape quand la flèche est dans le vert, le plus près possible du rouge');
    let pos = 0, dir = 1, stop = false, lt = performance.now();
    const sweep = (t) => { if (stop || !root.isConnected) return; const dt = Math.max(0, (t - lt) / 1000); lt = t; pos += dir * 110 * dt; if (pos > 100) { pos = 100; dir = -1; } if (pos < 0) { pos = 0; dir = 1; } a.style.left = pos + '%'; requestAnimationFrame(sweep); };
    requestAnimationFrame(sweep);
    const p = await new Promise((res) => { const h = (e) => { e.preventDefault(); tap.removeEventListener('pointerdown', h); res(pos); }; tap.addEventListener('pointerdown', h); setTimeout(() => res(pos), 6000); });
    stop = true; tap.disabled = true;
    const foul = p > 80;
    const acc = Math.max(0, Math.min(1, 1 - (80 - p) / 40));
    const d = foul ? 0 : Math.round((3 + 6.2 * speed * (0.55 + 0.45 * acc)) * 100) / 100;
    jump = { t0: performance.now(), d: foul ? 3 : d, foul };
    await sleep(1000);
    if (foul) { phase('wait', '🚩 Mordu !', 'Essai nul'); sfx('whistle'); }
    else { phase('wait', '📏 ' + fmtM(d * 100), d * 100 > best ? 'Meilleur saut !' : ''); if (d * 100 > best) { best = Math.round(d * 100); bEl.textContent = 'Meilleur : ' + fmtM(best); } }
    await sleep(1500);
  }
  ctx.finish(best, best ? fmtM(best) : 'Nul');
}

/* ---------------- Skateboard : séquences à reproduire ---------------- */
export async function skate(root, ctx) {
  const TRICKS = ['Ollie', 'Kickflip', 'Heelflip', '360 Flip', 'Impossible', 'Darkslide'];
  const AR = ['⬅️', '⬇️', '⬆️', '➡️'];
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="s">0 pts</span><span id="t">Figure 1/6</span></div>
      <div class="help" id="msg">Mémorise la séquence…</div>
      <div class="seq" id="seq"></div>
      <div class="pads">${AR.map((x, i) => `<button class="${i % 3 ? 'alt' : ''}" data-l="${i}" disabled>${x}</button>`).join('')}</div>
    </div>`;
  const cv = $(root, '#cv'), seqEl = $(root, '#seq'), msg = $(root, '#msg'), sEl = $(root, '#s'), tEl = $(root, '#t');
  const pads = [...root.querySelectorAll('.pads button')];
  const { g, W, H } = fitCanvas(cv);
  let trick = null, score = 0;
  function draw(t) {
    if (!root.isConnected) return;
    g.fillStyle = '#fff1f5'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    // half-pipe
    const gy = H * 0.8;
    g.fillStyle = '#c9d3e3'; g.beginPath(); g.moveTo(0, H * 0.3); g.quadraticCurveTo(0, gy, W * 0.25, gy); g.lineTo(W * 0.75, gy); g.quadraticCurveTo(W, gy, W, H * 0.3); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.strokeStyle = '#2a1638'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, H * 0.3); g.quadraticCurveTo(0, gy, W * 0.25, gy); g.lineTo(W * 0.75, gy); g.quadraticCurveTo(W, gy, W, H * 0.3); g.stroke();
    let x = W / 2 + Math.sin(t / 900) * W * 0.18, y = gy - 22, rot = 0;
    if (trick) { const k = Math.min(1, (t - trick.t0) / 1100); y -= Math.sin(k * Math.PI) * H * 0.4; rot = trick.ok ? k * Math.PI * 2 : Math.sin(k * 20) * 0.3; if (k >= 1) trick = null; }
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#e8456b'; g.fillRect(-20, 14, 40, 5); g.fillStyle = '#2a1638'; g.beginPath(); g.arc(-13, 22, 3, 0, 7); g.arc(13, 22, 3, 0, 7); g.fill();
    g.restore();
    slime(g, x, y, 14, ctx.color(ctx.me));
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  for (let f = 0; f < 6; f++) {
    const len = f + 3, seq = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
    tEl.textContent = `Figure ${f + 1}/6 · ${TRICKS[f]}`;
    seqEl.innerHTML = seq.map(() => '<span>?</span>').join('');
    const slots = [...seqEl.children];
    pads.forEach((p) => (p.disabled = true));
    msg.textContent = '👀 Mémorise la séquence…';
    msg.textContent = '👀 Attention… mémorise la séquence';
    await sleep(1200);
    for (let i = 0; i < len; i++) {
      slots[i].textContent = AR[seq[i]]; slots[i].className = 'show';
      await sleep(Math.max(650, 950 - f * 50));
      slots[i].className = 'seen';
    }
    msg.textContent = '👀 Dernier coup d\'œil…';
    await sleep(1300);
    slots.forEach((x) => { x.textContent = '?'; x.className = ''; });
    msg.textContent = '🛹 À toi ! 10 secondes';
    pads.forEach((p) => (p.disabled = false));
    const res = await new Promise((resolve) => {
      let i = 0; const t0 = performance.now();
      const iv = setInterval(() => { const left = 10 - (performance.now() - t0) / 1000; msg.textContent = `🛹 À toi ! ${Math.max(0, left).toFixed(1)} s`; if (left <= 0) done(false, 0); }, 100);
      const h = (e) => {
        e.preventDefault();
        const l = +e.currentTarget.dataset.l;
        if (l === seq[i]) { slots[i].textContent = AR[l]; slots[i].className = 'ok'; i++; if (i === len) done(true, 10 - (performance.now() - t0) / 1000); }
        else { slots[i].textContent = AR[l]; slots[i].className = 'ko'; done(false, 0); }
      };
      pads.forEach((p) => p.addEventListener('pointerdown', h));
      function done(ok, left) { clearInterval(iv); pads.forEach((p) => { p.removeEventListener('pointerdown', h); p.disabled = true; }); resolve({ ok, left }); }
    });
    trick = { t0: performance.now(), ok: res.ok };
    if (res.ok) { sfx('ok'); const pts = 100 + Math.round(res.left * 5); score += pts; msg.textContent = `✅ ${TRICKS[f]} réussi ! +${pts}`; }
    else msg.textContent = `❌ ${TRICKS[f]} raté`;
    sEl.textContent = score + ' pts';
    await sleep(1300);
  }
  ctx.finish(score, score + ' pts');
}

/* ---------------- Basketball (lancers francs) & Rugby (pénalités) : jeu d'adresse ---------------- */
// Glisse le ballon vers la cible : la direction vise, la vitesse du geste donne la force.
async function kickGame(root, ctx, mode) {
  const rugby = mode === 'rugby';
  const N = 5;
  const SPOTS = rugby
    ? [{ x: 0.5, d: 22 }, { x: 0.32, d: 28 }, { x: 0.68, d: 32 }, { x: 0.25, d: 38 }, { x: 0.72, d: 45 }]
    : [{ x: 0.5 }, { x: 0.3 }, { x: 0.7 }, { x: 0.38 }, { x: 0.64 }];
  root.innerHTML = `
    <div class="hud"><span class="big" id="s">0 / ${N}</span><span id="t">${rugby ? 'Pénalité' : 'Lancer'} 1/${N}</span></div>
    <canvas class="full" id="cv"></canvas>
    <div class="help" id="msg">Glisse ${rugby ? 'le ballon' : 'la balle'} vers ${rugby ? 'les perches' : 'le panier'}. Plus ton geste est rapide, plus le tir est fort.</div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), sEl = $(root, '#s'), tEl = $(root, '#t');
  const { g, W, H } = fitCanvas(cv);
  let made = 0, shot = 0, trail = [], fly = null, grab = false;
  const target = () => ({ x: W * (rugby ? SPOTS[shot].x : 0.5), y: H * (rugby ? 0.22 : 0.24) });
  const ballPos = () => ({ x: W * (rugby ? 0.5 : SPOTS[shot].x), y: H * 0.84 });
  // force = vitesse du geste en « hauteurs d'écran par seconde »
  const window_ = () => (rugby ? [1.4 + SPOTS[shot].d / 30, 9] : [1.7, 3.4]);
  const halfW = () => (rugby ? Math.max(14, 46 - SPOTS[shot].d * 0.6) : 18);
  function draw(t) {
    if (!root.isConnected) return;
    g.fillStyle = rugby ? '#bfeccb' : '#fff1f5'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    const T = target();
    if (rugby) {
      g.strokeStyle = '#fff'; g.lineWidth = 2; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(0, H * k / 5); g.lineTo(W, H * k / 5); g.stroke(); }
      g.strokeStyle = '#2a1638'; g.lineWidth = 5; const hw = halfW();
      g.beginPath(); g.moveTo(T.x - hw, T.y - 55); g.lineTo(T.x - hw, T.y + 40); g.moveTo(T.x + hw, T.y - 55); g.lineTo(T.x + hw, T.y + 40); g.moveTo(T.x - hw, T.y + 18); g.lineTo(T.x + hw, T.y + 18); g.stroke();
      g.fillStyle = 'rgba(46,196,143,.25)'; g.fillRect(T.x - hw, T.y - 55, hw * 2, 73);
      g.fillStyle = '#2a1638'; g.font = '900 13px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillText(SPOTS[shot].d + ' m', W / 2, H * 0.97);
    } else {
      g.fillStyle = '#e9b98a'; g.fillRect(0, H * 0.6, W, H * 0.4);
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, H * 0.6, W * 0.3, 0, Math.PI); g.stroke();
      g.fillStyle = '#fff'; g.strokeStyle = '#2a1638'; g.lineWidth = 3; g.fillRect(T.x - 45, T.y - 60, 90, 60); g.strokeRect(T.x - 45, T.y - 60, 90, 60); g.strokeStyle = '#e8456b'; g.strokeRect(T.x - 18, T.y - 34, 36, 26);
      g.strokeStyle = '#e8456b'; g.lineWidth = 4; g.beginPath(); g.ellipse(T.x, T.y, 22, 6, 0, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(T.x + k * 8, T.y + 4); g.lineTo(T.x + k * 5, T.y + 24); g.stroke(); }
    }
    const B = ballPos();
    slime(g, B.x - 34, B.y + 6, 16, ctx.color(ctx.me));
    let bx = B.x, by = B.y, br = 13;
    if (fly) {
      const k = Math.min(1, (t - fly.t0) / 850);
      bx = B.x + (fly.x - B.x) * k; by = B.y + (fly.y - B.y) * k - Math.sin(k * Math.PI) * H * 0.22; br = 13 - k * 5;
      if (k >= 1 && !fly.done) { fly.done = true; fly.res(); }
    } else if (grab && trail.length) { bx = trail[trail.length - 1].x; by = trail[trail.length - 1].y; }
    if (grab && trail.length > 1) { g.strokeStyle = 'rgba(31,33,64,.35)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(trail[0].x, trail[0].y); for (const p of trail) g.lineTo(p.x, p.y); g.stroke(); }
    if (!fly && !grab) { g.strokeStyle = 'rgba(242,92,148,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(B.x, B.y, 22 + Math.sin(t / 200) * 3, 0, 7); g.stroke(); }
    if (rugby) { g.fillStyle = '#fff1f5'; g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.beginPath(); g.ellipse(bx, by, br, br * 0.7, -0.6, 0, 7); g.fill(); g.stroke(); }
    else { g.fillStyle = '#ff9f1c'; g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(bx - br, by); g.lineTo(bx + br, by); g.stroke(); }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
  await countdown(root);
  for (shot = 0; shot < N; shot++) {
    tEl.textContent = `${rugby ? 'Pénalité' : 'Lancer'} ${shot + 1}/${N}`;
    msg.textContent = `Glisse ${rugby ? 'le ballon' : 'la balle'} vers ${rugby ? 'les perches' : 'le panier'} d'un geste vif.`;
    const v = await new Promise((res) => {
      const down = (e) => { const p = pt(e), B = ballPos(); if (Math.hypot(p.x - B.x, p.y - B.y) > 70) return; grab = true; trail = [p]; cv.setPointerCapture(e.pointerId); };
      const move = (e) => { if (!grab) return; trail.push(pt(e)); if (trail.length > 30) trail.shift(); };
      const up = () => {
        if (!grab) return; grab = false;
        // on mesure la fin du geste (les 120 dernières ms)
        const end = trail[trail.length - 1];
        const recent = trail.filter((p) => end.t - p.t <= 120);
        const st = recent[0];
        const dx = end.x - st.x, dy = end.y - st.y, dt = Math.max(16, end.t - st.t);
        trail = [];
        if (dy > -15) { msg.textContent = 'Glisse vers le haut, vers la cible !'; return; }
        cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up);
        const speed = Math.hypot(dx, dy) / dt * 1000 / H; // hauteurs d'écran / s
        const B = ballPos(), T = target();
        const crossX = B.x + dx / dy * (T.y - B.y); // où la trajectoire croise la cible
        res({ speed, crossX });
      };
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
    });
    const T = target(), off = v.crossX - T.x, [lo, hi] = window_();
    const okAim = Math.abs(off) < halfW();
    const okPow = v.speed >= lo && v.speed <= hi;
    const ok = okAim && okPow;
    const fy = T.y + (rugby ? -30 : 0) + (okPow ? 0 : v.speed < lo ? 70 : -55);
    await new Promise((res) => (fly = { t0: performance.now(), x: T.x + Math.max(-W, Math.min(W, off)), y: fy, res }));
    if (ok) { made++; sfx('ok'); buzz(40); msg.textContent = rugby ? '✅ Transformée !' : '✅ Panier !'; } else { sfx('fail'); msg.textContent = '❌ ' + (!okPow ? (v.speed < lo ? 'Trop court : geste plus rapide !' : 'Trop fort : geste plus doux !') : off < 0 ? 'Trop à gauche' : 'Trop à droite'); }
    sEl.textContent = `${made} / ${N}`;
    await sleep(1300); fly = null;
  }
  ctx.finish(made, `${made}/${N}`);
}
export const basket = (root, ctx) => kickGame(root, ctx, 'basket');
export const rugby = (root, ctx) => kickGame(root, ctx, 'rugby');

/* ---------------- Mini-golf (3 trous) ---------------- */
export async function golf(root, ctx) {
  const ALL = [
    { name: 'Le Tout-Droit', s: [50, 145], h: [50, 25], walls: [[28, 72, 44, 7]] },
    { name: 'La Chicane', s: [18, 148], h: [82, 28], walls: [[0, 100, 66, 7], [34, 56, 66, 7]] },
    { name: 'Le Goulot', s: [50, 148], h: [50, 22], walls: [[0, 100, 40, 7], [60, 100, 40, 7], [40, 56, 20, 16]] },
    { name: 'Le Coude', s: [15, 150], h: [85, 20], walls: [[30, 40, 7, 120], [63, 0, 7, 110]] },
    { name: 'Les Plots', s: [50, 150], h: [50, 18], walls: [[20, 110, 14, 14], [66, 110, 14, 14], [43, 78, 14, 14], [20, 46, 14, 14], [66, 46, 14, 14]] },
    { name: 'Le Couloir', s: [12, 150], h: [88, 150], walls: [[24, 30, 7, 130], [48, 0, 7, 130], [72, 30, 7, 130]] },
    { name: 'La Forteresse', s: [50, 150], h: [50, 45], walls: [[25, 25, 50, 6], [25, 25, 6, 45], [69, 25, 6, 45], [25, 64, 18, 6], [57, 64, 18, 6]] },
    { name: 'Le Zigzag', s: [85, 152], h: [15, 15], walls: [[30, 125, 70, 6], [0, 95, 70, 6], [30, 65, 70, 6], [0, 35, 70, 6]] },
    { name: "L'Entonnoir", s: [50, 152], h: [50, 20], walls: [[0, 90, 44, 6], [56, 90, 44, 6], [44, 70, 4, 26], [52, 70, 4, 26], [30, 40, 40, 5]] },
  ];
  let seed = (ctx.current.seed || 1) >>> 0;
  const rand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = [...ALL.keys()];
  const HOLES = [0, 1, 2].map(() => ALL[pool.splice(Math.floor(rand() * pool.length), 1)[0]]);

  root.innerHTML = `
    <div class="hud"><span class="big" id="s">0 coup</span><span id="t">Trou 1/3</span></div>
    <canvas class="full" id="cv" style="background:#9fe3cf"></canvas>
    <div class="help" id="msg">Glisse vers l'arrière pour viser et doser, puis relâche. 7 coups max par trou.</div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), sEl = $(root, '#s'), tEl = $(root, '#t');
  const { g, W, H } = fitCanvas(cv);
  const sc = Math.min(W / 104, H / 164), ox = (W - 100 * sc) / 2, oy = (H - 160 * sc) / 2;
  const S = (x, y) => [ox + x * sc, oy + y * sc];
  const R = 2.2, HR = 3.6, A = 60, VMAX = 230;
  let hole = 0, ball = null, aim = null, total = 0, strokes = 0, sinking = false;
  function draw() {
    if (!root.isConnected) return;
    const Ho = HOLES[hole];
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#6fd3a8'; const [x0, y0] = S(0, 0); g.fillRect(x0, y0, 100 * sc, 160 * sc);
    g.strokeStyle = '#2a1638'; g.lineWidth = 4; g.strokeRect(x0, y0, 100 * sc, 160 * sc);
    g.fillStyle = '#e8456b'; for (const [x, y, w, h] of Ho.walls) { const [a, b] = S(x, y); g.fillRect(a, b, w * sc, h * sc); g.strokeRect(a, b, w * sc, h * sc); }
    const [hx, hy] = S(...Ho.h); g.fillStyle = '#2a1638'; g.beginPath(); g.arc(hx, hy, HR * sc, 0, 7); g.fill();
    g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx, hy - 26); g.stroke(); g.fillStyle = '#ffd75e'; g.beginPath(); g.moveTo(hx, hy - 26); g.lineTo(hx + 16, hy - 21); g.lineTo(hx, hy - 16); g.fill();
    if (ball) {
      const [bx, by] = S(ball.x, ball.y);
      if (aim) { const v = aimVel(); if (v) { g.strokeStyle = `hsl(${120 - v.p * 120},80%,40%)`; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + v.vx * sc * 0.35, by + v.vy * sc * 0.35); g.stroke(); g.setLineDash([]); } }
      g.fillStyle = '#fff'; g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, Math.max(4, R * sc), 0, 7); g.fill(); g.stroke();
      if (!ball.moving && !sinking) slime(g, bx - 22, by + 4, 10, ctx.color(ctx.me));
    }
  }
  function aimVel() {
    if (!aim) return null;
    const dx = aim.sx - aim.cx, dy = aim.sy - aim.cy, len = Math.hypot(dx, dy);
    if (len < 8) return null;
    const p = Math.min(1, len / (H * 0.35));
    return { vx: dx / len * p * VMAX, vy: dy / len * p * VMAX, p };
  }
  function collide() {
    const walls = [...HOLES[hole].walls, [-10, -10, 120, 10], [-10, 160, 120, 10], [-10, 0, 10, 160], [100, 0, 10, 160]];
    for (const [x, y, w, h] of walls) {
      const cx = Math.max(x, Math.min(ball.x, x + w)), cy = Math.max(y, Math.min(ball.y, y + h));
      const dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy);
      if (d < R && d > 0) {
        const nx = dx / d, ny = dy / d, dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) { ball.vx -= 2 * dot * nx * 0.85; ball.vy -= 2 * dot * ny * 0.85; }
        ball.x = cx + nx * R; ball.y = cy + ny * R;
      }
    }
  }
  async function roll() {
    ball.moving = true;
    let last = performance.now();
    await new Promise((res) => {
      function f(t) {
        const dt = Math.max(0, Math.min(0.05, (t - last) / 1000)); last = t;
        for (let i = 0; i < 4; i++) {
          const sdt = dt / 4, v = Math.hypot(ball.vx, ball.vy);
          if (v > 0) { const nv = Math.max(0, v - A * sdt); ball.vx *= nv / v; ball.vy *= nv / v; ball.x += ball.vx * sdt; ball.y += ball.vy * sdt; collide(); }
          const [hx, hy] = HOLES[hole].h;
          if (Math.hypot(ball.x - hx, ball.y - hy) < HR && Math.hypot(ball.vx, ball.vy) < 95) { ball.in = true; ball.x = hx; ball.y = hy; ball.vx = ball.vy = 0; }
        }
        draw();
        if (!ball.in && Math.hypot(ball.vx, ball.vy) > 0.5 && root.isConnected) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
    ball.vx = ball.vy = 0; ball.moving = false;
  }
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  for (hole = 0; hole < 3; hole++) {
    const Ho = HOLES[hole];
    ball = { x: Ho.s[0], y: Ho.s[1], vx: 0, vy: 0 }; strokes = 0;
    tEl.textContent = `Trou ${hole + 1}/3 · ${HOLES[hole].name}`;
    draw();
    if (hole === 0) await countdown(root);
    while (!ball.in && strokes < 7) {
      msg.textContent = `Coup ${strokes + 1} — glisse vers l'arrière puis relâche`;
      const v = await new Promise((res) => {
        const down = (e) => { const [x, y] = pt(e); aim = { sx: x, sy: y, cx: x, cy: y }; cv.setPointerCapture(e.pointerId); draw(); };
        const move = (e) => { if (!aim) return; const [x, y] = pt(e); aim.cx = x; aim.cy = y; draw(); };
        const up = () => { const v = aimVel(); aim = null; draw(); if (v) { cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); res(v); } };
        cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
      });
      strokes++; total++;
      sEl.textContent = total + (total > 1 ? ' coups' : ' coup');
      ball.vx = v.vx; ball.vy = v.vy;
      await roll();
    }
    if (!ball.in) { total++; sEl.textContent = total + ' coups'; msg.textContent = '⛳ 7 coups atteints : +1 de pénalité'; }
    else { sfx('ok'); } if (ball.in) msg.textContent = strokes === 1 ? '🎉 TROU EN UN !' : `⛳ Dans le trou en ${strokes} coups`;
    await sleep(1400);
  }
  ctx.finish(-total, total + ' coups');
}
