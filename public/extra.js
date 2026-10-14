// Jeux Zozz’lympiques — épreuves 2e vague : haltérophilie, tir à l'arc, ski slalom, lancer du marteau, escalade, judo
import { sleep, $, countdown, fitCanvas, slime, stands, liveStandings, sfx, buzz, tilt } from './kit.js';

const PLUM = '#2a1638', CORAL = '#e8456b', MINT = '#9ee6cf', BUTTER = '#ffd75e', PAPER = '#fff1f5', ROSE = '#ffb6cf';
const FONT = (px, w = 800) => `${w} ${px}px Unbounded, sans-serif`;

/* ---------------- Haltérophilie : soulever puis équilibrer en inclinant le téléphone ---------------- */
export async function haltero(root, ctx) {
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="kg">100 kg</span><span id="b">Meilleur : —</span></div>
      <div class="phase ph-wait" id="ph">Prépare-toi</div>
      <div class="help" id="msg">&nbsp;</div>
      <div class="runbar" id="rb"><i id="rbi" style="transform:scaleX(0)"></i></div>
      <button class="tapzone" id="tap" disabled>…</button>
    </div>`;
  const cv = $(root, '#cv'), tap = $(root, '#tap'), ph = $(root, '#ph'), msg = $(root, '#msg'), rbi = $(root, '#rbi'), kgEl = $(root, '#kg'), bEl = $(root, '#b');
  const { g, W, H } = fitCanvas(cv);
  const T = tilt(tap, 25);
  let kg = 100, best = 0, fails = 0, totalFails = 0, angle = 0, lifted = 0, state = 'idle';
  const phase = (c, t, s) => { ph.className = 'phase ph-' + c; ph.textContent = t; msg.textContent = s || ' '; };
  function draw() {
    if (!root.isConnected) return;
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H); stands(g, W, 14);
    const gy = H * 0.84;
    g.fillStyle = '#e9b98a'; g.fillRect(W * 0.12, gy, W * 0.76, H - gy);
    // zone d'équilibre
    const cx = W / 2, by = gy - 30 - lifted * H * 0.42;
    if (state === 'balance') {
      g.save(); g.translate(cx, by); g.fillStyle = 'rgba(158,230,207,.45)';
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, W * 0.42, -Math.PI / 2 - 0.44, -Math.PI / 2 + 0.44); g.closePath(); g.fill(); g.restore();
    }
    slime(g, cx, gy - 22, 26, ctx.color(ctx.me));
    // bras
    g.strokeStyle = PLUM; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 18, gy - 30); g.lineTo(cx - 34, by); g.moveTo(cx + 18, gy - 30); g.lineTo(cx + 34, by); g.stroke();
    // barre
    g.save(); g.translate(cx, by); g.rotate(angle * Math.PI / 180);
    g.fillStyle = PLUM; g.fillRect(-W * 0.4, -3, W * 0.8, 6);
    const plates = Math.min(6, 1 + Math.floor((kg - 100) / 20));
    for (const s of [-1, 1]) for (let i = 0; i < plates; i++) { g.fillStyle = [CORAL, BUTTER, MINT, '#c9b8ff'][i % 4]; g.fillRect(s * (W * 0.3 + i * 9) - 4, -22 + i * 1.5, 8, 44 - i * 3); }
    g.restore();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  while (fails < 3) {
    kgEl.textContent = kg + ' kg';
    // PHASE 1 : soulever
    state = 'lift'; angle = 0; lifted = 0;
    const need = Math.round(14 + (kg - 100) / 10 * 1.6);
    phase('run', '① Soulève : tape vite !', `${need} taps en 3 secondes`);
    tap.className = 'tapzone'; tap.textContent = 'TAP'; tap.disabled = false;
    let taps = 0, rec = [];
    const onTap = (e) => { e.preventDefault(); const n = performance.now(); rec = rec.filter((x) => n - x < 1000); if (rec.length >= 15) return; rec.push(n); taps++; lifted = Math.min(1, taps / need); rbi.style.transform = `scaleX(${lifted})`; };
    tap.addEventListener('pointerdown', onTap);
    const t0 = performance.now();
    while (performance.now() - t0 < 3000 && taps < need) await sleep(30);
    tap.removeEventListener('pointerdown', onTap);
    let ok = taps >= need;
    if (ok) {
      // PHASE 2 : équilibre
      state = 'balance'; tap.className = 'tapzone jumpbtn'; tap.textContent = T.sensor ? '⇆ Incline' : '⇆ Glisse';
      phase('jump', '② Tiens la barre droite !', T.sensor ? 'Incline le téléphone pour la redresser' : 'Glisse le doigt à gauche ou à droite pour la redresser');
      T.recalibrate(); sfx('thud'); buzz(60);
      const level = (kg - 100) / 10;
      let vel = 0, push = 0, last = performance.now(); const start = last;
      while (performance.now() - start < 3000) {
        await sleep(16);
        const now = performance.now(), dt = (now - last) / 1000; last = now;
        if (Math.random() < dt * (1.5 + level * 0.25)) push = (Math.random() - 0.5) * (30 + level * 9);
        vel += (push + angle * 0.9 - T.value() * 70) * dt; vel *= Math.pow(0.25, dt);
        angle += vel * dt * 4; push *= Math.pow(0.3, dt);
        rbi.style.transform = `scaleX(${1 - (now - start) / 3000})`;
        if (Math.abs(angle) > 25) { ok = false; break; }
      }
    }
    tap.disabled = true; state = 'idle';
    if (ok) {
      best = kg; bEl.textContent = 'Meilleur : ' + best + ' kg'; sfx('ok'); buzz([40, 40, 40]);
      phase('wait', `✅ ${kg} kg validés !`, 'Barre suivante : +10 kg'); fails = 0; kg += 10;
    } else {
      fails++; totalFails++; sfx('fail'); buzz(200); lifted = 0; angle = Math.sign(angle || 1) * 30;
      phase('wait', `❌ Essai manqué (${fails}/3)`, fails < 3 ? 'Même barre, nouvel essai' : 'Fin de la compétition');
    }
    await sleep(1500);
  }
  T.stop();
  ctx.finish(best * 100 - totalFails, best ? best + ' kg' : '0 kg');
}

/* ---------------- Tir à l'arc : tenir pour stabiliser, relâcher pour tirer ---------------- */
export async function arc(root, ctx) {
  root.innerHTML = `
    <div class="hud"><span class="big" id="s">0 pts</span><span id="t">Volée 1/3 · flèche 1/3</span></div>
    <canvas class="full" id="cv"></canvas>
    <div class="help" id="msg">Garde le doigt posé pour bander l'arc et stabiliser le viseur, relâche pour tirer. Tiens le téléphone immobile !</div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), sEl = $(root, '#s'), tEl = $(root, '#t');
  const { g, W, H } = fitCanvas(cv);
  const T = tilt(null);
  const R = Math.min(W, H) * 0.36, cx = W / 2, cy = H * 0.46;
  let aim = { x: 0, y: 0 }, holdStart = 0, holding = false, arrows = [], score = 0, wind = 0, t = 0;
  function draw(now) {
    if (!root.isConnected) return;
    g.fillStyle = '#bfeccb'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    const rings = [['#fff', 10], ['#fff', 9], [PLUM, 8], [PLUM, 7], ['#7cc0e6', 6], ['#7cc0e6', 5], [CORAL, 4], [CORAL, 3], [BUTTER, 2], [BUTTER, 1]];
    rings.forEach(([c], i) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, R * (1 - i / 10), 0, 7); g.fill(); g.strokeStyle = 'rgba(42,22,56,.25)'; g.lineWidth = 1; g.stroke(); });
    g.fillStyle = PLUM; g.font = FONT(10); g.textAlign = 'center'; g.fillText('X', cx, cy + 4);
    for (const a of arrows) { g.fillStyle = PLUM; g.beginPath(); g.arc(cx + a.x * R, cy + a.y * R, 4, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    // vent
    g.fillStyle = PLUM; g.font = FONT(11); g.textAlign = 'left'; g.fillText(`Vent ${wind > 0 ? '→' : '←'} ${Math.abs(wind * 10).toFixed(1)}`, 10, 32);
    // viseur
    const sx = cx + aim.x * R, sy = cy + aim.y * R;
    g.strokeStyle = holding ? CORAL : PLUM; g.lineWidth = 3;
    g.beginPath(); g.arc(sx, sy, 16, 0, 7); g.moveTo(sx - 26, sy); g.lineTo(sx - 8, sy); g.moveTo(sx + 8, sy); g.lineTo(sx + 26, sy); g.moveTo(sx, sy - 26); g.lineTo(sx, sy - 8); g.moveTo(sx, sy + 8); g.lineTo(sx, sy + 26); g.stroke();
    if (holding) { const p = Math.min(1, (performance.now() - holdStart) / 1200); g.fillStyle = CORAL; g.fillRect(10, H - 16, (W - 20) * p, 6); }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  // dérive du viseur : bruit doux, réduit en bandant, augmenté si le téléphone bouge ou si on tient trop longtemps
  let last = performance.now(), ph1 = Math.random() * 9, ph2 = Math.random() * 9;
  const sway = setInterval(() => {
    if (!root.isConnected) return clearInterval(sway);
    const now = performance.now(), dt = (now - last) / 1000; last = now; t += dt;
    const held = holding ? (now - holdStart) / 1000 : 0;
    let amp = holding ? (held < 1.2 ? 0.55 - held * 0.3 : 0.2 + (held - 1.2) * 0.35) : 0.6;
    amp = Math.max(0.12, Math.min(0.9, amp)) + T.shake() * 0.6;
    aim.x = amp * (Math.sin(t * 1.3 + ph1) * 0.6 + Math.sin(t * 2.9 + ph2) * 0.4);
    aim.y = amp * (Math.cos(t * 1.1 + ph2) * 0.6 + Math.sin(t * 2.3 + ph1) * 0.4);
  }, 16);
  await countdown(root);
  for (let v = 0; v < 3; v++) {
    wind = (Math.random() - 0.5) * 0.3;
    for (let a = 0; a < 3; a++) {
      tEl.textContent = `Volée ${v + 1}/3 · flèche ${a + 1}/3`;
      await new Promise((res) => {
        const down = (e) => { holding = true; holdStart = performance.now(); cv.setPointerCapture(e.pointerId); buzz(20); };
        const up = () => { if (!holding) return; holding = false; cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointerup', up); res(); };
        cv.addEventListener('pointerdown', down); cv.addEventListener('pointerup', up);
      });
      const hx = aim.x + wind * 0.5, hy = aim.y;
      const d = Math.hypot(hx, hy), pts = d >= 1 ? 0 : 10 - Math.floor(d * 10);
      arrows.push({ x: hx, y: hy }); score += pts; sEl.textContent = score + ' pts';
      sfx(pts >= 9 ? 'ok' : 'thud'); buzz(30);
      msg.textContent = pts === 10 ? '🎯 10 ! En plein cœur' : pts ? `${pts} point${pts > 1 ? 's' : ''}` : 'Hors cible';
      await sleep(700);
    }
    await sleep(600); if (v < 2) arrows = [];
  }
  clearInterval(sway); T.stop();
  ctx.finish(score, score + ' pts');
}

/* ---------------- Ski slalom : incliner pour passer les portes ---------------- */
export async function ski(root, ctx) {
  const N = 20;
  root.innerHTML = `
    <div class="hud"><span class="big" id="g">Porte 0/${N}</span><span id="t">0.00 s</span></div>
    <canvas class="full" id="cv" style="background:#f4fbff"></canvas>
    <div class="help" id="msg">Incline le téléphone (ou glisse le doigt) pour passer entre les drapeaux. Porte ratée = +2 s.</div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), gEl = $(root, '#g'), tEl = $(root, '#t');
  const { g, W, H } = fitCanvas(cv);
  const T = tilt(cv, 22);
  const gates = Array.from({ length: N }, (_, i) => ({ y: 260 + i * 210, x: 0.22 + Math.random() * 0.56, ok: null }));
  let x = 0.5, dist = 0, pen = 0, passed = 0, start = 0, running = false, trail = [];
  const GW = 0.2, SPEED = 230; // largeur de porte (fraction), vitesse px/s
  function draw() {
    g.fillStyle = '#f4fbff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(124,192,230,.35)'; g.lineWidth = 2;
    for (let k = 0; k < 8; k++) { const yy = ((k * 90 - dist) % 720 + 720) % 720; g.beginPath(); g.moveTo(0, yy); g.lineTo(W * 0.15, yy + 20); g.stroke(); }
    const sy = H * 0.72;
    g.strokeStyle = 'rgba(42,22,56,.15)'; g.lineWidth = 3; g.beginPath(); trail.forEach((p, i) => { const yy = sy + (dist - p.d); i ? g.lineTo(p.x * W, yy) : g.moveTo(p.x * W, yy); }); g.stroke();
    for (const gt of gates) {
      const yy = sy - (gt.y - dist); if (yy < -40 || yy > H + 40) continue;
      const col = gt.ok === false ? '#bbb' : (gates.indexOf(gt) % 2 ? CORAL : '#4a8fe0');
      for (const s of [-1, 1]) { const fx = (gt.x + s * GW / 2) * W; g.strokeStyle = PLUM; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, yy); g.lineTo(fx, yy - 34); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(fx, yy - 34); g.lineTo(fx + s * -18, yy - 28); g.lineTo(fx, yy - 20); g.fill(); }
    }
    // skieur
    const px = x * W, lean = T.value();
    g.save(); g.translate(px, sy); g.rotate(lean * 0.4);
    g.fillStyle = PLUM; g.fillRect(-14, 10, 4, 22); g.fillRect(10, 10, 4, 22);
    g.restore();
    slime(g, px, sy, 15, ctx.color(ctx.me));
    g.fillStyle = BUTTER; g.beginPath(); g.ellipse(px, sy - 12, 15, 7, 0, Math.PI, 0); g.fill();
  }
  draw();
  await countdown(root);
  running = true; start = performance.now(); T.recalibrate();
  let last = performance.now();
  await new Promise((res) => {
    function frame(now) {
      if (!root.isConnected) return res();
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      x = Math.max(0.05, Math.min(0.95, x + T.value() * 0.75 * dt));
      dist += SPEED * dt;
      trail.push({ x, d: dist }); if (trail.length > 60) trail.shift();
      for (const gt of gates) if (gt.ok === null && dist >= gt.y) {
        gt.ok = Math.abs(x - gt.x) <= GW / 2;
        passed++; gEl.textContent = `Porte ${passed}/${N}`;
        if (!gt.ok) { pen += 2; sfx('fail'); buzz(120); msg.textContent = '❌ Porte manquée : +2 s'; } else { sfx('tick'); msg.textContent = '✅'; }
        ctx.prog(passed / N);
      }
      tEl.textContent = ((now - start) / 1000 + pen).toFixed(2) + ' s';
      draw();
      if (passed >= N) return res();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  T.stop();
  const time = (performance.now() - start) / 1000 + pen;
  ctx.finish(-Math.round(time * 100) / 100, time.toFixed(2) + ' s');
}

/* ---------------- Lancer du marteau : tourner puis lâcher dans la zone ---------------- */
export async function marteau(root, ctx) {
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="b">Meilleur : —</span><span id="tr">Essai 1/3</span></div>
      <div class="help" id="msg">Fais des cercles de plus en plus vite, puis lève le doigt quand la boule passe dans la zone verte.</div>
      <div class="wheel" id="wh"><canvas id="dial" style="position:absolute;inset:0;width:100%;height:100%"></canvas><span id="sp">0 tr/s</span></div>
    </div>`;
  const cv = $(root, '#cv'), wh = $(root, '#wh'), dial = $(root, '#dial'), msg = $(root, '#msg'), bEl = $(root, '#b'), trEl = $(root, '#tr'), spEl = $(root, '#sp');
  const { g, W, H } = fitCanvas(cv);
  const D = fitCanvas(dial);
  const SECTOR = -Math.PI / 2, HALF = 0.38; // zone de lâcher : en haut
  let marks = [], fly = null, best = 0, ang = 0, speed = 0;
  const X = (m) => W * 0.08 + (m / 95) * W * 0.86;
  function draw() {
    if (!root.isConnected) return;
    g.fillStyle = '#bfeccb'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
    for (const m of [50, 60, 70, 80, 90]) { g.beginPath(); g.moveTo(X(m), H * 0.3); g.lineTo(X(m), H * 0.95); g.stroke(); g.fillStyle = PLUM; g.font = FONT(9); g.textAlign = 'center'; g.fillText(m + ' m', X(m), H * 0.27); }
    g.fillStyle = BUTTER; g.fillRect(X(86.74) - 2, H * 0.3, 4, H * 0.65); g.fillStyle = PLUM; g.fillText('RM 86,74', X(86.74), H * 0.98);
    g.fillStyle = '#c9d3e3'; g.beginPath(); g.arc(W * 0.08, H * 0.62, 14, 0, 7); g.fill();
    for (const mk of marks) { g.fillStyle = mk.foul ? '#bbb' : CORAL; g.beginPath(); g.arc(X(mk.d), H * 0.62, 6, 0, 7); g.fill(); }
    if (fly) { const k = Math.min(1, (performance.now() - fly.t0) / 1000); const fx = W * 0.08 + (X(fly.d) - W * 0.08) * k, fy = H * 0.62 - Math.sin(k * Math.PI) * H * 0.4; g.fillStyle = PLUM; g.beginPath(); g.arc(fx, fy, 6, 0, 7); g.fill(); if (k >= 1 && !fly.done) { fly.done = true; marks.push({ d: fly.d, foul: fly.foul }); sfx('thud'); } }
    slime(g, W * 0.08, H * 0.62 - 6, 11, ctx.color(ctx.me));
    // cadran
    const dg = D.g, w = D.W, h = D.H, c = w / 2, r = w * 0.4;
    dg.clearRect(0, 0, w, h);
    dg.strokeStyle = MINT; dg.lineWidth = 16; dg.beginPath(); dg.arc(c, c, r, SECTOR - HALF, SECTOR + HALF); dg.stroke();
    dg.strokeStyle = 'rgba(42,22,56,.15)'; dg.lineWidth = 2; dg.beginPath(); dg.moveTo(c, c); dg.lineTo(c + Math.cos(ang) * r, c + Math.sin(ang) * r); dg.stroke();
    dg.fillStyle = PLUM; dg.beginPath(); dg.arc(c + Math.cos(ang) * r, c + Math.sin(ang) * r, 11, 0, 7); dg.fill();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  for (let at = 1; at <= 3; at++) {
    trEl.textContent = `Essai ${at}/3`; speed = 0; fly = null;
    msg.textContent = 'Tourne ! Au moins 3 tours, puis lève le doigt dans la zone verte.';
    const res = await new Promise((resolve) => {
      let lastA = null, lastT = 0, turns = 0;
      const pa = (e) => { const r = wh.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
      const down = (e) => { wh.setPointerCapture(e.pointerId); lastA = pa(e); lastT = performance.now(); ang = lastA; };
      const move = (e) => {
        if (lastA === null) return;
        const a = pa(e), now = performance.now(); let d = a - lastA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        const inst = Math.abs(d) / (2 * Math.PI) / Math.max(0.008, (now - lastT) / 1000);
        speed = speed * 0.9 + Math.min(inst, 7) * 0.1; turns += Math.abs(d) / (2 * Math.PI);
        lastA = a; lastT = now; ang = a; spEl.textContent = speed.toFixed(1) + ' tr/s';
        if (Math.random() < 0.05) sfx('tick');
      };
      const up = () => {
        if (lastA === null) return;
        wh.removeEventListener('pointerdown', down); wh.removeEventListener('pointermove', move); wh.removeEventListener('pointerup', up);
        let off = ang - SECTOR; while (off > Math.PI) off -= 2 * Math.PI; while (off < -Math.PI) off += 2 * Math.PI;
        resolve({ off: Math.abs(off), turns, speed });
      };
      wh.addEventListener('pointerdown', down); wh.addEventListener('pointermove', move); wh.addEventListener('pointerup', up);
    });
    const foul = res.off > HALF || res.turns < 3;
    const acc = 1 - res.off / HALF;
    const d = foul ? 0 : Math.round((25 + 13 * Math.min(res.speed, 5) * (0.6 + 0.4 * acc)) * 100) / 100;
    fly = { t0: performance.now(), d: foul ? 15 : d, foul };
    await sleep(1100);
    if (foul) { msg.textContent = res.turns < 3 ? '🚩 Moins de 3 tours : essai nul' : '🚩 Dans la cage ! Essai nul'; sfx('whistle'); }
    else { msg.textContent = `📏 ${d.toFixed(2).replace('.', ',')} m`; if (d * 100 > best) { best = Math.round(d * 100); bEl.textContent = 'Meilleur : ' + (best / 100).toFixed(2).replace('.', ',') + ' m'; sfx('ok'); } }
    await sleep(1400);
  }
  ctx.finish(best, best ? (best / 100).toFixed(2).replace('.', ',') + ' m' : 'Nul');
}

/* ---------------- Escalade de vitesse : gauche / droite selon la prise allumée ---------------- */
export async function escalade(root, ctx) {
  const N = 20;
  root.innerHTML = `
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="hud"><span class="big" id="h">0 / ${N}</span><span id="t">0.00 s</span></div>
      <div class="rank-row"><div class="pos p1" id="pos">1<sup>er</sup></div><div class="mini" id="mini"></div></div>
      <div class="duo"><button class="tapzone" id="L" disabled>◀</button><button class="tapzone" id="R" disabled>▶</button></div>
    </div>`;
  const cv = $(root, '#cv'), L = $(root, '#L'), Rb = $(root, '#R'), hEl = $(root, '#h'), tEl = $(root, '#t');
  const { g, W, H } = fitCanvas(cv);
  const st = liveStandings(ctx, $(root, '#pos'), $(root, '#mini'));
  const holds = Array.from({ length: N }, () => (Math.random() < 0.5 ? 0 : 1));
  let h = 0, frozen = 0, done = false, start = 0;
  const shown = {};
  function draw() {
    if (!root.isConnected) return;
    st.update();
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    const n = ctx.players.length, lw = W / n;
    ctx.players.forEach((p, i) => {
      const x0 = i * lw; g.fillStyle = i % 2 ? '#ffd6e3' : '#ffe6ee'; g.fillRect(x0 + 1, 0, lw - 2, H);
      if (p.id === ctx.me) { g.fillStyle = 'rgba(232,69,107,.12)'; g.fillRect(x0 + 1, 0, lw - 2, H); }
      const v = ctx.progs[p.id] || 0; shown[p.id] = (shown[p.id] ?? 0) + (v - (shown[p.id] ?? 0)) * 0.2;
      const top = 24, bot = H - 20, y = bot - (bot - top) * shown[p.id];
      if (p.id === ctx.me) for (let k = h; k < Math.min(N, h + 4); k++) { const yy = bot - (bot - top) * ((k + 1) / N); g.fillStyle = k === h ? CORAL : 'rgba(42,22,56,.25)'; g.beginPath(); g.arc(x0 + lw * (holds[k] ? 0.72 : 0.28), yy, Math.min(7, lw * 0.15), 0, 7); g.fill(); }
      slime(g, x0 + lw / 2, y, Math.min(13, lw * 0.3), p.color);
      g.font = `${Math.min(14, lw * 0.5)}px serif`; g.textAlign = 'center'; g.fillText(p.flag, x0 + lw / 2, H - 4);
    });
    g.fillStyle = BUTTER; g.fillRect(0, 18, W, 3); g.fillStyle = PLUM; g.font = FONT(9); g.textAlign = 'left'; g.fillText('15 m', 4, 14);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  L.disabled = Rb.disabled = false; start = performance.now();
  const timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (!done) tEl.textContent = ((performance.now() - start) / 1000).toFixed(2) + ' s'; }, 50);
  const press = (side) => (e) => {
    e.preventDefault(); if (done || performance.now() < frozen) return;
    if (holds[h] === side) { h++; sfx('tick'); }
    else { h = Math.max(0, h - 1); frozen = performance.now() + 400; sfx('fail'); buzz(120); }
    hEl.textContent = `${h} / ${N}`; ctx.prog(h / N);
    if (h >= N) { done = true; L.disabled = Rb.disabled = true; const t = (performance.now() - start) / 1000; tEl.textContent = t.toFixed(2) + ' s'; ctx.finish(-Math.round(t * 100) / 100, t.toFixed(2) + ' s'); }
  };
  L.addEventListener('pointerdown', press(0)); Rb.addEventListener('pointerdown', press(1));
}

/* ---------------- Judo : duel de réflexes au signal « Hajime ! » ---------------- */
export async function judo(root, ctx) {
  const pair = ctx.current.pairs.find((p) => p.a === ctx.me || p.b === ctx.me);
  const oppId = pair.a === ctx.me ? pair.b : pair.a, isBot = oppId === 'BOT', host = pair.a === ctx.me;
  const oppName = isBot ? '🤖 Bot' : ctx.name(oppId), oppCol = isBot ? '#8a8fa8' : ctx.color(oppId);
  root.innerHTML = `
    <div class="hud"><span class="big" id="sc">0 – 0</span><span>vs ${oppName}</span><span>Au meilleur des 5</span></div>
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot"><div class="phase ph-wait" id="ph">Prépare-toi…</div><button class="tapzone" id="tap" disabled>Attends…</button></div>`;
  const cv = $(root, '#cv'), tap = $(root, '#tap'), ph = $(root, '#ph'), scEl = $(root, '#sc');
  const { g, W, H } = fitCanvas(cv);
  let me = 0, opp = 0, throwAnim = null, forfeit = false;
  const inbox = [], waiters = [];
  ctx.onMsg((d) => { if (d.type === 'left') forfeit = true; else inbox.push(d); while (waiters.length) waiters.shift()(); });
  const next = (type, r) => new Promise((res) => { const c = () => { if (forfeit) return res(null); const i = inbox.findIndex((m) => m.type === type && m.r === r); if (i >= 0) return res(inbox.splice(i, 1)[0]); waiters.push(c); }; c(); });
  function draw() {
    if (!root.isConnected) return;
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H); stands(g, W, 14);
    g.fillStyle = '#ffe08a'; g.fillRect(W * 0.08, H * 0.7, W * 0.84, H * 0.16); g.fillStyle = CORAL; g.fillRect(W * 0.08, H * 0.7, W * 0.84, 4);
    const r = Math.min(W, H) * 0.12;
    let mx = W * 0.32, ox = W * 0.68, my = H * 0.6, oy = H * 0.6, mr = 0, orr = 0;
    if (throwAnim) { const k = Math.min(1, (performance.now() - throwAnim.t0) / 600); if (throwAnim.win) { ox = W * 0.68 - k * W * 0.2; oy = H * 0.6 - Math.sin(k * Math.PI) * H * 0.35; orr = k * Math.PI * 2; } else { mx = W * 0.32 + k * W * 0.2; my = H * 0.6 - Math.sin(k * Math.PI) * H * 0.35; mr = -k * Math.PI * 2; } }
    for (const [x, y, col, rot, belt] of [[mx, my, ctx.color(ctx.me), mr, PLUM], [ox, oy, oppCol, orr, CORAL]]) {
      g.save(); g.translate(x, y); g.rotate(rot); g.translate(-x, -y);
      slime(g, x, y, r, col, '#fff'); g.fillStyle = '#fff'; g.fillRect(x - r, y + r * 0.1, r * 2, r * 0.6); g.fillStyle = belt; g.fillRect(x - r, y + r * 0.3, r * 2, r * 0.14);
      g.restore();
    }
    g.fillStyle = PLUM; g.font = FONT(11); g.textAlign = 'center'; g.fillText('TOI', W * 0.32, H * 0.95); g.fillText(oppName, W * 0.68, H * 0.95);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  for (let r = 0; me < 3 && opp < 3 && !forfeit; r++) {
    ph.className = 'phase ph-wait'; ph.textContent = 'Prêt…'; tap.disabled = false; tap.className = 'tapzone locked'; tap.textContent = 'Attends…';
    let delay;
    if (isBot || host) { delay = 1500 + Math.random() * 2500; if (!isBot) ctx.send({ type: 'jd', r, delay }); }
    else { const m = await next('jd', r); if (!m) break; delay = m.delay; }
    const mine = await new Promise((res) => {
      let sig = 0;
      const timer = setTimeout(() => { sig = performance.now(); ph.className = 'phase ph-jump'; ph.textContent = 'HAJIME !'; tap.className = 'tapzone jumpbtn'; tap.textContent = 'TAP !'; sfx('whistle'); buzz(50); }, delay);
      const h = (e) => { e.preventDefault(); tap.removeEventListener('pointerdown', h); clearTimeout(cut); if (!sig) { clearTimeout(timer); res(-1); } else res(performance.now() - sig); };
      const cut = setTimeout(() => { tap.removeEventListener('pointerdown', h); res(9999); }, delay + 3000);
      tap.addEventListener('pointerdown', h);
    });
    tap.disabled = true;
    let theirs;
    if (isBot) { await sleep(300); theirs = Math.random() < 0.06 ? -1 : 260 + Math.random() * 240; }
    else { ctx.send({ type: 'rt', r, t: mine }); const m = await next('rt', r); if (!m) break; theirs = m.t; }
    const valid = (t) => t >= 0 && t < 9999;
    let iWin;
    if (!valid(mine) && !valid(theirs)) iWin = null;
    else if (!valid(mine)) iWin = false; else if (!valid(theirs)) iWin = true; else iWin = mine < theirs || (mine === theirs && host);
    if (iWin === null) { ph.textContent = 'Double faute : on rejoue'; }
    else {
      if (iWin) me++; else opp++;
      throwAnim = { t0: performance.now(), win: iWin }; sfx(iWin ? 'ok' : 'fail'); sfx('thud'); buzz(iWin ? 60 : 200);
      ph.className = 'phase ' + (iWin ? 'ph-jump' : 'ph-run');
      ph.textContent = iWin ? (mine < 0 ? 'IPPON !' : `IPPON ! ${Math.round(mine)} ms`) : mine === -1 ? 'Faux départ : point perdu' : `Trop lent (${Math.round(mine)} ms)`;
    }
    scEl.textContent = `${me} – ${opp}`;
    await sleep(1600); throwAnim = null;
  }
  const win = forfeit || me > opp;
  ph.textContent = forfeit ? '🏆 Victoire par forfait' : win ? '🏆 Victoire !' : '😢 Défaite';
  ctx.finish(win ? 1 : 0, forfeit ? 'forfait' : `${me}-${opp}`);
}
