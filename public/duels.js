// Jeux Zozz’lympiques — duels : football (air-hockey), handball (7 m), escrime
import { sleep, $, countdown, fitCanvas, slime, stands , sfx, buzz} from './kit.js';

// Outils communs aux duels : adversaire, messages, forfait
function duel(ctx) {
  const pair = ctx.current.pairs.find((p) => p.a === ctx.me || p.b === ctx.me);
  const oppId = pair.a === ctx.me ? pair.b : pair.a;
  const isBot = oppId === 'BOT';
  const D = {
    pair, oppId, isBot, host: pair.a === ctx.me, firstIsMe: pair.first === ctx.me,
    oppName: isBot ? '🤖 Bot' : ctx.name(oppId), myCol: ctx.color(ctx.me), oppCol: isBot ? '#8a8fa8' : ctx.color(oppId),
    forfeit: false, onForfeit: null, handlers: [],
  };
  const inbox = [], waiters = [];
  ctx.onMsg((d) => {
    if (d.type === 'left') { D.forfeit = true; if (D.onForfeit) D.onForfeit(); while (waiters.length) waiters.shift()(); return; }
    for (const h of D.handlers) if (h(d)) return;
    inbox.push(d); while (waiters.length) waiters.shift()();
  });
  D.next = (type, r) => new Promise((res) => {
    const check = () => {
      if (D.forfeit) return res(null);
      const i = inbox.findIndex((m) => m.type === type && m.r === r);
      if (i >= 0) return res(inbox.splice(i, 1)[0]);
      waiters.push(check);
    };
    check();
  });
  return D;
}

// Choix simultané avec chrono (10 s) : renvoie [monChoix, choixAdverse]
async function simultaneousPick(ctx, D, r, buttons, allowed, timerEl, botPick) {
  buttons.forEach((b, i) => (b.disabled = !allowed.includes(i)));
  const mine = await new Promise((res) => {
    const t0 = performance.now();
    const iv = setInterval(() => { const l = 10 - (performance.now() - t0) / 1000; timerEl.textContent = Math.max(0, Math.ceil(l)) + ' s'; if (l <= 0 || D.forfeit) done(allowed[Math.floor(Math.random() * allowed.length)]); }, 200);
    const h = (e) => { e.preventDefault(); done(+e.currentTarget.dataset.v); };
    buttons.forEach((b) => b.addEventListener('pointerdown', h));
    function done(v) { clearInterval(iv); timerEl.textContent = ''; buttons.forEach((b) => { b.removeEventListener('pointerdown', h); b.disabled = true; }); res(v); }
  });
  buttons[mine]?.classList.add('picked');
  let theirs;
  if (D.isBot) { await sleep(500 + Math.random() * 700); theirs = botPick(); }
  else { ctx.send({ type: 'pick', r, v: mine }); const m = await D.next('pick', r); theirs = m ? m.v : 0; }
  buttons.forEach((b) => b.classList.remove('picked'));
  return [mine, theirs];
}

/* ---------------- Handball : tirs au but à 7 m ---------------- */
export async function handball(root, ctx) {
  const D = duel(ctx);
  root.innerHTML = `
    <div class="hud"><span class="big" id="sc">0 – 0</span><span>vs ${D.oppName}</span><span id="tm"></span></div>
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="help" id="msg"></div>
      <div class="grid9" id="g9">${Array.from({ length: 9 }, (_, i) => `<button data-v="${i}" disabled></button>`).join('')}</div>
    </div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), scEl = $(root, '#sc'), tm = $(root, '#tm');
  const btns = [...root.querySelectorAll('#g9 button')];
  const { g, W, H } = fitCanvas(cv);
  let me = 0, opp = 0, anim = null, role = 'shoot';
  const used = { me: new Set(), opp: new Set() };
  const goal = () => ({ x: W * 0.12, y: H * 0.18, w: W * 0.76, h: H * 0.58 });
  const cell = (i) => { const G = goal(); return { x: G.x + (i % 3 + 0.5) * G.w / 3, y: G.y + (Math.floor(i / 3) + 0.5) * G.h / 3 }; };
  function draw(t) {
    if (!root.isConnected) return;
    g.fillStyle = '#fff1f5'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    g.fillStyle = '#e9b98a'; g.fillRect(0, H * 0.76, W, H * 0.24);
    const G = goal();
    g.strokeStyle = 'rgba(31,33,64,.25)'; g.lineWidth = 1;
    for (let x = G.x; x <= G.x + G.w; x += 10) { g.beginPath(); g.moveTo(x, G.y); g.lineTo(x, G.y + G.h); g.stroke(); }
    for (let y = G.y; y <= G.y + G.h; y += 10) { g.beginPath(); g.moveTo(G.x, y); g.lineTo(G.x + G.w, y); g.stroke(); }
    g.lineWidth = 8; for (let k = 0; k < 10; k++) { g.strokeStyle = k % 2 ? '#e8456b' : '#fff'; g.beginPath(); g.moveTo(G.x, G.y + G.h - k * G.h / 10); g.lineTo(G.x, G.y + G.h - (k + 1) * G.h / 10); g.moveTo(G.x + G.w, G.y + G.h - k * G.h / 10); g.lineTo(G.x + G.w, G.y + G.h - (k + 1) * G.h / 10); g.stroke(); }
    g.beginPath(); for (let k = 0; k < 10; k++) { g.strokeStyle = k % 2 ? '#e8456b' : '#fff'; g.beginPath(); g.moveTo(G.x + k * G.w / 10, G.y); g.lineTo(G.x + (k + 1) * G.w / 10, G.y); g.stroke(); }
    const keeperCol = role === 'shoot' ? D.oppCol : D.myCol;
    let kx = W / 2, ky = G.y + G.h * 0.62, bx = W / 2, by = H * 0.92, br = 9;
    if (anim) {
      const k = Math.min(1, (t - anim.t0) / 600);
      const kc = cell(anim.keep), bc = cell(anim.shot);
      kx += (kc.x - kx) * k; ky += (kc.y - ky) * k;
      bx += (bc.x - bx) * k; by += (bc.y - by) * k; br = 9 - k * 3;
    }
    slime(g, kx, ky, Math.min(W, H) * 0.09, keeperCol, '#9ee6cf');
    g.fillStyle = '#ffd75e'; g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill(); g.stroke();
    if (anim && anim.label) { g.font = '900 27px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#2a1638'; g.lineWidth = 5; g.strokeText(anim.label, W / 2, H * 0.12 + 20); g.fillText(anim.label, W / 2, H * 0.12 + 20); }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  D.onForfeit = () => {};
  await countdown(root);
  let r = 0;
  while (!D.forfeit) {
    const iShoot = (r % 2 === 0) === D.firstIsMe;
    role = iShoot ? 'shoot' : 'keep';
    const mineUsed = iShoot ? used.me : null;
    if (mineUsed && mineUsed.size >= 9) mineUsed.clear();
    if (used.opp.size >= 9) used.opp.clear();
    const allowed = iShoot ? [...Array(9).keys()].filter((i) => !used.me.has(i)) : [...Array(9).keys()];
    btns.forEach((b, i) => { const done = iShoot ? used.me.has(i) : used.opp.has(i); b.textContent = done ? (iShoot ? '✖' : '⚽') : ''; b.className = done && !iShoot ? 'prev' : ''; });
    msg.textContent = iShoot ? `🎯 Tir ${Math.floor(r / 2) + 1} : choisis où tirer (✖ = déjà utilisé)` : `🧤 Gardien : choisis où plonger (⚽ = déjà tiré par ${D.oppName}, il ne peut plus y tirer)`;
    const [mine, theirs] = await simultaneousPick(ctx, D, r, btns, allowed, tm, () => {
      if (iShoot) return Math.floor(Math.random() * 9);
      const free = [...Array(9).keys()].filter((i) => !used.opp.has(i)); return free[Math.floor(Math.random() * free.length)];
    });
    if (D.forfeit) break;
    const shot = iShoot ? mine : theirs, keep = iShoot ? theirs : mine;
    (iShoot ? used.me : used.opp).add(shot);
    const goalScored = shot !== keep;
    if (goalScored) { if (iShoot) me++; else opp++; }
    anim = { t0: performance.now(), shot, keep, label: '' };
    await sleep(650);
    anim.label = goalScored ? 'BUT !' : 'ARRÊT !'; sfx(goalScored === iShoot ? 'ok' : 'fail');
    btns[shot].className = goalScored ? 'goal' : 'saved';
    scEl.textContent = `${me} – ${opp}`;
    await sleep(1100); anim = null;
    r++;
    // 5 tirs chacun, puis mort subite par paire de tirs
    if (r >= 10 && r % 2 === 0 && me !== opp) break;
  }
  const win = D.forfeit || me > opp;
  msg.textContent = D.forfeit ? '🏆 Victoire par forfait' : win ? '🏆 Victoire !' : '😢 Défaite';
  ctx.finish(win ? 1 : 0, D.forfeit ? 'forfait' : `${me}-${opp}`);
}

/* ---------------- Escrime : attaque / parade ---------------- */
export async function escrime(root, ctx) {
  const D = duel(ctx);
  const Z = ['⬆️ Haut', '⏺ Milieu', '⬇️ Bas'];
  root.innerHTML = `
    <div class="hud"><span class="big" id="sc">0 – 0</span><span>vs ${D.oppName}</span><span id="tm"></span></div>
    <div class="split-top"><canvas id="cv"></canvas></div>
    <div class="split-bot">
      <div class="help" id="msg"></div>
      <div class="zones" id="zs">${Z.map((z, i) => `<button data-v="${i}" disabled>${z}</button>`).join('')}</div>
    </div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), scEl = $(root, '#sc'), tm = $(root, '#tm');
  const btns = [...root.querySelectorAll('#zs button')];
  const { g, W, H } = fitCanvas(cv);
  let me = 0, opp = 0, attMe = D.firstIsMe, anim = null;
  function fencer(x, y, r, col, dir, lunge, zone) {
    slime(g, x, y, r, col, '#fff');
    g.fillStyle = 'rgba(31,33,64,.75)'; g.beginPath(); g.ellipse(x + dir * r * 0.15, y - r * 0.05, r * 0.75, r * 0.6, 0, 0, 7); g.fill(); // masque
    g.strokeStyle = '#c9d3e3'; g.lineWidth = 1; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(x + dir * r * 0.15 + k * r * 0.18, y - r * 0.6); g.lineTo(x + dir * r * 0.15 + k * r * 0.18, y + r * 0.5); g.stroke(); }
    const zy = [y - r * 0.9, y, y + r * 0.7][zone ?? 1];
    g.strokeStyle = '#2a1638'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + dir * r, y + r * 0.2); g.lineTo(x + dir * (r + r * 1.6 + lunge), zy); g.stroke();
  }
  function draw(t) {
    if (!root.isConnected) return;
    g.fillStyle = '#fff1f5'; g.fillRect(0, 0, W, H); stands(g, W, 14);
    g.fillStyle = '#c9d3e3'; g.fillRect(0, H * 0.72, W, H * 0.12); g.fillStyle = '#fff'; g.fillRect(W / 2 - 1, H * 0.72, 2, H * 0.12);
    const r = Math.min(W, H) * 0.12, y = H * 0.56;
    let lm = 0, lo = 0, zm = 1, zo = 1;
    if (anim) { const k = Math.min(1, (t - anim.t0) / 450); const L = Math.sin(k * Math.PI) * r * 0.9; if (anim.attMe) { lm = L; zm = anim.att; zo = anim.def; } else { lo = L; zo = anim.att; zm = anim.def; } }
    fencer(W * 0.28, y, r, D.myCol, 1, lm, zm);
    fencer(W * 0.72, y, r, D.oppCol, -1, lo, zo);
    g.font = '900 12px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#2a1638';
    g.fillText('TOI', W * 0.28, y + r * 1.45); g.fillText(D.oppName, W * 0.72, y + r * 1.45);
    for (let i = 0; i < 3; i++) { g.fillStyle = i < me ? '#2ec48f' : '#fff'; g.beginPath(); g.arc(W * 0.12 + i * 18, 30, 6, 0, 7); g.fill(); g.stroke(); g.fillStyle = i < opp ? '#e63946' : '#fff'; g.beginPath(); g.arc(W * 0.88 - i * 18, 30, 6, 0, 7); g.fill(); g.stroke(); }
    if (anim && anim.label) { g.font = '900 27px Unbounded, sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = '#2a1638'; g.lineWidth = 5; g.strokeText(anim.label, W / 2, H * 0.3); g.fillText(anim.label, W / 2, H * 0.3); }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  await countdown(root);
  let r = 0;
  while (!D.forfeit && me < 3 && opp < 3) {
    msg.textContent = attMe ? '⚔️ Tu attaques : choisis ta zone' : '🛡 Tu défends : devine la zone de parade';
    const [mine, theirs] = await simultaneousPick(ctx, D, r, btns, [0, 1, 2], tm, () => Math.floor(Math.random() * 3));
    if (D.forfeit) break;
    const att = attMe ? mine : theirs, def = attMe ? theirs : mine;
    anim = { t0: performance.now(), attMe, att, def, label: '' };
    await sleep(450);
    if (att === def) { anim.label = 'PARADE !'; sfx('thud'); attMe = !attMe; }
    else { anim.label = 'TOUCHE !'; sfx(attMe ? 'ok' : 'fail'); buzz(60); if (attMe) me++; else opp++; }
    scEl.textContent = `${me} – ${opp}`;
    await sleep(1100); anim = null; r++;
  }
  const win = D.forfeit || me > opp;
  msg.textContent = D.forfeit ? '🏆 Victoire par forfait' : win ? '🏆 Victoire !' : '😢 Défaite';
  ctx.finish(win ? 1 : 0, D.forfeit ? 'forfait' : `${me}-${opp}`);
}

/* ---------------- Football : air-hockey 1 contre 1 ---------------- */
const FOOT = { win: 3, limit: 120, goal: [32, 68], pr: 8, br: 4, zone: 0.5, field: '#7fd6a3', friction: 0.6, minSpeed: 0, serve: 0, maxSpeed: 260, botSpeed: 115, unit: 'buts', help: 'Garde le doigt sur ton slime pour le déplacer. Interdit de passer la ligne du milieu.' };
const PING = { win: 5, limit: 150, goal: [0, 100], pr: 7, br: 3, zone: 0.66, field: '#4a8fe0', friction: 1, minSpeed: 85, serve: 95, maxSpeed: 300, botSpeed: 150, unit: 'points', help: 'Glisse ta raquette pour renvoyer la balle. Une balle qui passe derrière toi = point pour l\'adversaire.' };
export const football = (root, ctx) => airGame(root, ctx, FOOT);
async function airGame(root, ctx, C) {
  const D = duel(ctx);
  const WIN = C.win, LIMIT = C.limit;
  root.innerHTML = `
    <div class="hud"><span class="big" id="sc">0 – 0</span><span>vs ${D.oppName}</span><span id="tm">2:00</span></div>
    <canvas class="full" id="cv"></canvas>
    <div class="help" id="msg">Garde le doigt sur ton slime pour le déplacer. ${C.help} Premier à ${WIN} ${C.unit}.</div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), scEl = $(root, '#sc'), tm = $(root, '#tm');
  const { g, W, H } = fitCanvas(cv);
  const FW = 100, FH = 160, PR = C.pr, BR = C.br, GOAL = C.goal, ZY = FH * C.zone;
  const sc = Math.min(W / FW, H / FH), ox = (W - FW * sc) / 2, oy = (H - FH * sc) / 2;
  // Le joueur « hôte » (pair.a) calcule la physique dans son repère (lui en bas) ; l'autre voit le terrain retourné.
  const flip = (p) => ({ x: FW - p.x, y: FH - p.y });
  const toScreen = (p) => { const q = D.host ? p : flip(p); return [ox + q.x * sc, oy + q.y * sc]; };
  const st = { ball: { x: 50, y: 80, vx: 0, vy: 0 }, hp: { x: 50, y: 140, vx: 0, vy: 0 }, gp: { x: 50, y: 20, vx: 0, vy: 0 }, s: [0, 0], t: 0, pause: 1 };
  let myLocal = { x: 50, y: 140 }, ended = false, lastGp = null;
  // saisie : position du doigt dans MON repère (moi en bas)
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: Math.max(PR, Math.min(FW - PR, (e.clientX - r.left - ox) / sc)), y: Math.max(ZY + PR, Math.min(FH - PR, (e.clientY - r.top - oy) / sc)) }; };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); myLocal = pt(e); });
  cv.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') myLocal = pt(e); });

  function draw() {
    g.clearRect(0, 0, W, H);
    g.fillStyle = C.field; g.fillRect(ox, oy, FW * sc, FH * sc);
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)'; g.fillRect(ox, oy + k * FH * sc / 8, FW * sc, FH * sc / 8); }
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(ox, oy, FW * sc, FH * sc);
    g.beginPath(); g.moveTo(ox, oy + FH * sc / 2); g.lineTo(ox + FW * sc, oy + FH * sc / 2); g.stroke();
    g.beginPath(); g.arc(ox + FW * sc / 2, oy + FH * sc / 2, 14 * sc, 0, 7); g.stroke();
    const gw = (GOAL[1] - GOAL[0]) * sc, gx0 = ox + GOAL[0] * sc;
    g.fillStyle = D.oppCol; g.fillRect(gx0, oy - 5, gw, 10); g.fillStyle = D.myCol; g.fillRect(gx0, oy + FH * sc - 5, gw, 10);
    g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.strokeRect(gx0, oy - 5, gw, 10); g.strokeRect(gx0, oy + FH * sc - 5, gw, 10);
    const [hx, hy] = toScreen(st.hp), [gx, gy] = toScreen(st.gp);
    slime(g, hx, hy, PR * sc, D.host ? D.myCol : D.oppCol);
    slime(g, gx, gy, PR * sc, D.host ? D.oppCol : D.myCol);
    const [bx, by] = toScreen(st.ball);
    g.fillStyle = '#fff'; g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, BR * sc, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#2a1638'; g.beginPath(); g.arc(bx, by, BR * sc * 0.4, 0, 7); g.fill();
    const mine = D.host ? st.s[0] : st.s[1], theirs = D.host ? st.s[1] : st.s[0];
    scEl.textContent = `${mine} – ${theirs}`;
    const left = Math.max(0, LIMIT - st.t);
    tm.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : (C.unit === 'buts' ? 'BUT EN OR' : 'POINT EN OR');
  }

  function finish(winnerHost, forfeit) {
    if (ended) return; ended = true;
    const win = forfeit || (D.host ? winnerHost : !winnerHost);
    const mine = D.host ? st.s[0] : st.s[1], theirs = D.host ? st.s[1] : st.s[0];
    msg.textContent = forfeit ? '🏆 Victoire par forfait' : win ? '🏆 Victoire !' : '😢 Défaite';
    ctx.finish(win ? 1 : 0, forfeit ? 'forfait' : `${mine}-${theirs}`);
  }
  D.onForfeit = () => finish(true, true);

  if (!D.host) {
    // Invité : envoie sa position, affiche l'état reçu
    D.handlers.push((d) => {
      if (d.type === 'fb') { Object.assign(st, d.st); return true; }
      if (d.type === 'fbend') { st.s = d.s; finish(d.w === 'host', false); return true; }
      return false;
    });
    await countdown(root);
    const send = setInterval(() => { if (ended || !root.isConnected) return clearInterval(send); ctx.send({ type: 'pad', p: flip(myLocal) }); }, 40);
    (function loop() { if (!root.isConnected) return; st.gp = { ...st.gp, ...flip(myLocal) }; draw(); if (!ended) requestAnimationFrame(loop); })();
    return;
  }

  // Hôte : physique
  D.handlers.push((d) => { if (d.type === 'pad') { lastGp = d.p; return true; } return false; });
  draw();
  await countdown(root);
  st.pause = 0.6;
  function movePaddle(P, target, dt, maxV) {
    let dx = target.x - P.x, dy = target.y - P.y; const d = Math.hypot(dx, dy), m = maxV * dt;
    if (d > m && d > 0) { dx *= m / d; dy *= m / d; }
    P.vx = dx / dt; P.vy = dy / dt; P.x += dx; P.y += dy;
  }
  function hit(P) {
    const b = st.ball, dx = b.x - P.x, dy = b.y - P.y, d = Math.hypot(dx, dy);
    if (d < PR + BR && d > 0) {
      const nx = dx / d, ny = dy / d;
      b.x = P.x + nx * (PR + BR); b.y = P.y + ny * (PR + BR);
      const rv = (b.vx - P.vx) * nx + (b.vy - P.vy) * ny;
      if (rv < 0) { b.vx -= 1.9 * rv * nx; b.vy -= 1.9 * rv * ny; }
      const s = Math.hypot(b.vx, b.vy); if (s > C.maxSpeed) { b.vx *= C.maxSpeed / s; b.vy *= C.maxSpeed / s; }
    }
  }
  function serve(towardHostSide) { st.ball = { x: 50, y: towardHostSide ? 100 : 60, vx: (Math.random() - 0.5) * C.serve * 0.6, vy: towardHostSide ? C.serve : -C.serve }; st.pause = 1; sfx('whistle'); }
  let last = performance.now(), sendAcc = 0;
  function step(t) {
    if (!root.isConnected || ended) return;
    const dt = Math.max(0.001, Math.min(0.033, (t - last) / 1000)); last = t;
    st.t += dt;
    movePaddle(st.hp, myLocal, dt, 600);
    if (D.isBot) { // IA du bot (en haut)
      const b = st.ball;
      const target = b.y < FH - ZY + 4 ? { x: b.x + (Math.random() - 0.5) * 4, y: Math.max(PR, b.y - 7) } : { x: Math.max(30, Math.min(70, b.x)), y: 18 };
      movePaddle(st.gp, { x: target.x, y: Math.min(FH - ZY - PR, target.y) }, dt, C.botSpeed);
    } else if (lastGp) movePaddle(st.gp, { x: lastGp.x, y: Math.min(FH - ZY - PR, Math.max(PR, lastGp.y)) }, dt, 900);
    if (st.pause > 0) st.pause -= dt;
    else {
      const b = st.ball;
      for (let i = 0; i < 3; i++) {
        b.x += b.vx * dt / 3; b.y += b.vy * dt / 3;
        if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); } if (b.x > FW - BR) { b.x = FW - BR; b.vx = -Math.abs(b.vx); }
        const inGoal = b.x > GOAL[0] && b.x < GOAL[1];
        if (b.y < BR && !inGoal) { b.y = BR; b.vy = Math.abs(b.vy); }
        if (b.y > FH - BR && !inGoal) { b.y = FH - BR; b.vy = -Math.abs(b.vy); }
        hit(st.hp); hit(st.gp);
      }
      b.vx *= Math.pow(C.friction, dt); b.vy *= Math.pow(C.friction, dt);
      if (C.minSpeed) { const sp = Math.hypot(b.vx, b.vy); if (sp < C.minSpeed) { const k = sp > 1 ? C.minSpeed / sp : 0; if (k) { b.vx *= k; b.vy *= k; } else b.vy = b.y < FH / 2 ? C.minSpeed : -C.minSpeed; } }
      if (b.y < -BR) { st.s[0]++; sfx(D.host ? 'ok' : 'fail'); buzz(80); serve(false); }
      else if (b.y > FH + BR) { st.s[1]++; sfx(D.host ? 'fail' : 'ok'); buzz(80); serve(true); }
      const [h, gs] = st.s;
      if (h >= WIN || gs >= WIN || (st.t >= LIMIT && h !== gs)) {
        const w = h > gs ? 'host' : 'guest';
        if (!D.isBot) ctx.send({ type: 'fbend', w, s: st.s });
        draw(); finish(w === 'host', false); return;
      }
    }
    sendAcc += dt;
    if (!D.isBot && sendAcc > 0.045) { sendAcc = 0; ctx.send({ type: 'fb', st: { ball: st.ball, hp: st.hp, s: st.s, t: st.t } }); }
    draw();
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
