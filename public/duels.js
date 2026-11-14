// Jeux Ose’Lympiques — duels : football (air-hockey), handball (7 m), escrime
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
const HOCKEY = { ...FOOT, goal: [36, 64], field: '#e3f4ff', friction: 0.85, maxSpeed: 320, botSpeed: 125, relative: true, stick: true, help: 'Pose le doigt où tu veux : ton joueur suit ton glissé. Frappe le palet avec ta crosse ! Interdit de passer la ligne rouge.' };
export const hockey = (root, ctx) => hockeyGame(root, ctx);
async function airGame(root, ctx, C) {
  const D = duel(ctx);
  const WIN = C.win, LIMIT = C.limit;
  root.innerHTML = `
    <div class="hud"><span class="big" id="sc">0 – 0</span><span>vs ${D.oppName}</span><span id="tm">2:00</span></div>
    <canvas class="full" id="cv"></canvas>
    <div class="help" id="msg">${C.help} Premier à ${WIN} ${C.unit}.</div>`;
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
  const clampP = (p) => ({ x: Math.max(PR, Math.min(FW - PR, p.x)), y: Math.max(ZY + PR, Math.min(FH - PR, p.y)) });
  let anchor = null;
  if (C.relative) {
    // doigt n'importe où : le joueur suit le déplacement du doigt (comme un pavé tactile)
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); anchor = { fx: e.clientX, fy: e.clientY, x: myLocal.x, y: myLocal.y }; });
    cv.addEventListener('pointermove', (e) => { if (!anchor) return; myLocal = clampP({ x: anchor.x + (e.clientX - anchor.fx) / sc * 1.25, y: anchor.y + (e.clientY - anchor.fy) / sc * 1.25 }); if (myLocal.x <= PR || myLocal.x >= FW - PR || myLocal.y <= ZY + PR || myLocal.y >= FH - PR) anchor = { fx: e.clientX, fy: e.clientY, x: myLocal.x, y: myLocal.y }; });
    const rel = () => (anchor = null); cv.addEventListener('pointerup', rel); cv.addEventListener('pointercancel', rel);
  } else {
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); myLocal = pt(e); });
    cv.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') myLocal = pt(e); });
  }
  // crosse : lame devant le joueur, du côté où il se déplace
  const side = { hp: 1, gp: -1 }, prevX = { hp: 50, gp: 50 };
  const blade = (P, k) => ({ x: P.x + side[k] * PR * 0.75, y: P.y + (k === 'hp' ? -1 : 1) * PR * 0.95 });
  function updSide(k, P) { const dx = P.x - prevX[k]; if (Math.abs(dx) > 0.25) side[k] = Math.sign(dx); prevX[k] = P.x; }
  function drawStick(k, P) {
    const B = blade(P, k), [px, py] = toScreen(P), [bx, by] = toScreen(B);
    g.strokeStyle = '#7a4a21'; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(px, py); g.lineTo(bx, by); g.stroke();
    const [ex] = toScreen({ x: B.x + side[k] * 2.6, y: B.y }); g.strokeStyle = '#2a1638'; g.lineWidth = 6; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, by); g.stroke();
  }

  function draw() {
    g.clearRect(0, 0, W, H);
    g.fillStyle = C.field; g.fillRect(ox, oy, FW * sc, FH * sc);
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)'; g.fillRect(ox, oy + k * FH * sc / 8, FW * sc, FH * sc / 8); }
    g.strokeStyle = C.field === '#e3f4ff' ? '#e8456b' : '#fff'; g.lineWidth = 3; g.strokeRect(ox, oy, FW * sc, FH * sc);
    g.beginPath(); g.moveTo(ox, oy + FH * sc / 2); g.lineTo(ox + FW * sc, oy + FH * sc / 2); g.stroke();
    g.beginPath(); g.arc(ox + FW * sc / 2, oy + FH * sc / 2, 14 * sc, 0, 7); g.stroke();
    const gw = (GOAL[1] - GOAL[0]) * sc, gx0 = ox + GOAL[0] * sc;
    g.fillStyle = D.oppCol; g.fillRect(gx0, oy - 5, gw, 10); g.fillStyle = D.myCol; g.fillRect(gx0, oy + FH * sc - 5, gw, 10);
    g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.strokeRect(gx0, oy - 5, gw, 10); g.strokeRect(gx0, oy + FH * sc - 5, gw, 10);
    const [hx, hy] = toScreen(st.hp), [gx, gy] = toScreen(st.gp);
    if (C.stick) { updSide('hp', st.hp); updSide('gp', st.gp); }
    slime(g, hx, hy, PR * sc, D.host ? D.myCol : D.oppCol);
    slime(g, gx, gy, PR * sc, D.host ? D.oppCol : D.myCol);
    if (C.stick) { drawStick('hp', st.hp); drawStick('gp', st.gp); }
    const [bx, by] = toScreen(st.ball);
    g.fillStyle = C.field === '#e3f4ff' ? '#2a1638' : '#fff'; g.strokeStyle = '#2a1638'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, BR * sc, 0, 7); g.fill(); g.stroke();
    g.fillStyle = C.field === '#e3f4ff' ? '#4a2b5e' : '#2a1638'; g.beginPath(); g.arc(bx, by, BR * sc * 0.4, 0, 7); g.fill();
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
  // hockey : le corps ne fait que bloquer (rebond amorti), c'est la crosse qui frappe
  function hitHockey(P, k) {
    const b = st.ball;
    let dx = b.x - P.x, dy = b.y - P.y, d = Math.hypot(dx, dy);
    if (d < PR + BR && d > 0) {
      const nx = dx / d, ny = dy / d; b.x = P.x + nx * (PR + BR); b.y = P.y + ny * (PR + BR);
      const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; }
    }
    const Bl = blade(P, k), RB = 3.2;
    dx = b.x - Bl.x; dy = b.y - Bl.y; d = Math.hypot(dx, dy);
    if (d < RB + BR && d > 0) {
      const nx = dx / d, ny = dy / d; b.x = Bl.x + nx * (RB + BR); b.y = Bl.y + ny * (RB + BR);
      const rv = (b.vx - P.vx * 1.4) * nx + (b.vy - P.vy * 1.4) * ny;
      if (rv < 0) { b.vx -= 2 * rv * nx; b.vy -= 2 * rv * ny; sfx('tick'); }
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
        if (C.stick) { hitHockey(st.hp, 'hp'); hitHockey(st.gp, 'gp'); } else { hit(st.hp); hit(st.gp); }
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

/* ---------------- Hockey sur glace : on ne joue que la crosse, cages avancées comme au vrai hockey ---------------- */
async function hockeyGame(root, ctx) {
  const D = duel(ctx);
  const WIN = 3, LIMIT = 120;
  root.innerHTML = `
    <div class="hud"><span class="big" id="sc">0 – 0</span><span>vs ${D.oppName}</span><span id="tm">2:00</span></div>
    <canvas class="full" id="cv"></canvas>
    <div class="help" id="msg">Pose le doigt où tu veux et glisse : ta crosse suit. Frappe le palet avec la lame. Premier à ${WIN} buts.</div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), scEl = $(root, '#sc'), tm = $(root, '#tm');
  const { g, W, H } = fitCanvas(cv);
  const FW = 100, FH = 160, BR = 3, CR = 16, GX0 = 38, GX1 = 62, GM = 25, GB = 16, BL = 6; // GM : ligne de but, GB : fond de cage, BL : demi-lame
  const sc = Math.min(W / FW, H / FH), ox = (W - FW * sc) / 2, oy = (H - FH * sc) / 2;
  const flip = (p) => ({ x: FW - p.x, y: FH - p.y });
  const toS = (p) => { const q = D.host ? p : flip(p); return [ox + q.x * sc, oy + q.y * sc]; };
  const st = { ball: { x: 50, y: 80, vx: 0, vy: 0 }, hp: { x: 50, y: 128, vx: 0, vy: 0 }, gp: { x: 50, y: 32, vx: 0, vy: 0 }, s: [0, 0], t: 0, pause: 1, info: '' };
  let myLocal = { x: 50, y: 128 }, ended = false, lastGp = null, anchor = null;
  const clampMine = (p) => ({ x: Math.max(4, Math.min(FW - 4, p.x)), y: Math.max(FH / 2 + 4, Math.min(FH - 5, p.y)) });
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); anchor = { fx: e.clientX, fy: e.clientY, x: myLocal.x, y: myLocal.y }; });
  cv.addEventListener('pointermove', (e) => {
    if (!anchor) return;
    const want = { x: anchor.x + (e.clientX - anchor.fx) / sc * 1.3, y: anchor.y + (e.clientY - anchor.fy) / sc * 1.3 };
    myLocal = clampMine(want);
    if (myLocal.x !== want.x || myLocal.y !== want.y) anchor = { fx: e.clientX, fy: e.clientY, x: myLocal.x, y: myLocal.y };
  });
  const rel = () => (anchor = null); cv.addEventListener('pointerup', rel); cv.addEventListener('pointercancel', rel);

  // côté de la palette (crochet de la lame) : suit le dernier déplacement horizontal
  const side = { hp: 1, gp: -1 }, prevX = { hp: 50, gp: 50 };
  function updSide(k, P) { const dx = P.x - prevX[k]; if (Math.abs(dx) > 0.3) side[k] = Math.sign(dx); prevX[k] = P.x; }
  function drawStick(k, P, col) {
    const up = k === 'hp' ? 1 : -1; // le manche part vers son propre camp
    const [bx, by] = toS(P), [hx, hy] = toS({ x: P.x - side[k] * 10, y: P.y + up * 26 });
    const [l0x, l0y] = toS({ x: P.x - side[k] * BL, y: P.y }), [l1x, l1y] = toS({ x: P.x + side[k] * BL, y: P.y - up * 1.2 });
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(42,22,56,.18)'; g.lineWidth = 7; g.beginPath(); g.moveTo(hx + 3, hy + 3); g.lineTo(l0x + 3, l0y + 3); g.stroke();
    g.strokeStyle = '#c98b4b'; g.lineWidth = 5; g.beginPath(); g.moveTo(hx, hy); g.lineTo(l0x, l0y); g.stroke();
    g.strokeStyle = col; g.lineWidth = 5; const [mx, my] = toS({ x: P.x - side[k] * 8, y: P.y + up * 21 }); g.beginPath(); g.moveTo(hx, hy); g.lineTo(mx, my); g.stroke();
    g.strokeStyle = '#2a1638'; g.lineWidth = 7; g.beginPath(); g.moveTo(l0x, l0y); g.lineTo(l1x, l1y); g.stroke();
    g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo((l0x + l1x) / 2, (l0y + l1y) / 2); g.lineTo(l1x, l1y); g.stroke();
  }
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function drawGoal(top) {
    const m = top ? GM : FH - GM, b = top ? GB : FH - GB;
    const [ax, ay] = toS({ x: GX0, y: m }), [bx2, by2] = toS({ x: GX1, y: b });
    // zone de but bleue devant la cage
    const [cx, cy] = toS({ x: 50, y: m }); const down = (D.host ? !top : top) ? -1 : 1;
    g.fillStyle = 'rgba(111,141,255,.25)'; g.beginPath(); g.arc(cx, cy, 11 * sc, down > 0 ? 0 : Math.PI, down > 0 ? Math.PI : 2 * Math.PI); g.fill();
    // filet + cadre
    const x0 = Math.min(ax, bx2), y0 = Math.min(ay, by2), w = Math.abs(bx2 - ax), h = Math.abs(by2 - ay);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x0, y0, w, h);
    g.strokeStyle = 'rgba(42,22,56,.25)'; g.lineWidth = 1; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x0 + w * i / 6, y0); g.lineTo(x0 + w * i / 6, y0 + h); g.stroke(); }
    g.strokeStyle = '#e8456b'; g.lineWidth = 4; g.beginPath();
    const [p1x, p1y] = toS({ x: GX0, y: m }), [p2x, p2y] = toS({ x: GX0, y: b }), [p3x, p3y] = toS({ x: GX1, y: b }), [p4x, p4y] = toS({ x: GX1, y: m });
    g.moveTo(p1x, p1y); g.lineTo(p2x, p2y); g.lineTo(p3x, p3y); g.lineTo(p4x, p4y); g.stroke();
    g.strokeStyle = 'rgba(232,69,107,.6)'; g.lineWidth = 2; const [lx0, ly] = toS({ x: 0, y: m }), [lx1] = toS({ x: FW, y: m }); g.beginPath(); g.moveTo(Math.min(lx0, lx1) + 8, ly); g.lineTo(Math.max(lx0, lx1) - 8, ly); g.stroke();
  }
  function draw() {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#eef8ff'; rr(ox, oy, FW * sc, FH * sc, CR * sc); g.fill();
    g.strokeStyle = '#2a1638'; g.lineWidth = 3; rr(ox, oy, FW * sc, FH * sc, CR * sc); g.stroke();
    g.save(); rr(ox, oy, FW * sc, FH * sc, CR * sc); g.clip();
    g.strokeStyle = '#e8456b'; g.lineWidth = 4; g.beginPath(); g.moveTo(ox, oy + FH * sc / 2); g.lineTo(ox + FW * sc, oy + FH * sc / 2); g.stroke();
    g.strokeStyle = '#6f8dff'; g.lineWidth = 4; for (const y of [FH * 0.33, FH * 0.67]) { g.beginPath(); g.moveTo(ox, oy + y * sc); g.lineTo(ox + FW * sc, oy + y * sc); g.stroke(); }
    g.strokeStyle = '#6f8dff'; g.lineWidth = 2; g.beginPath(); g.arc(ox + FW * sc / 2, oy + FH * sc / 2, 12 * sc, 0, 7); g.stroke();
    drawGoal(true); drawGoal(false);
    g.restore();
    updSide('hp', st.hp); updSide('gp', st.gp);
    const [bx, by] = toS(st.ball);
    g.fillStyle = 'rgba(42,22,56,.2)'; g.beginPath(); g.ellipse(bx + 2, by + 2, BR * sc, BR * sc * 0.8, 0, 0, 7); g.fill();
    g.fillStyle = '#1a1024'; g.beginPath(); g.arc(bx, by, BR * sc, 0, 7); g.fill();
    drawStick('hp', st.hp, D.host ? D.myCol : D.oppCol); drawStick('gp', st.gp, D.host ? D.oppCol : D.myCol);
    const mine = D.host ? st.s[0] : st.s[1], theirs = D.host ? st.s[1] : st.s[0];
    scEl.textContent = `${mine} – ${theirs}`;
    const left = Math.max(0, LIMIT - st.t);
    tm.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'BUT EN OR';
    if (st.info) { g.fillStyle = '#2a1638'; g.font = '900 22px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillText(st.info, W / 2, H / 2 - 18); }
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
    D.handlers.push((d) => {
      if (d.type === 'hk') { Object.assign(st, d.st); return true; }
      if (d.type === 'hkend') { st.s = d.s; finish(d.w === 'host', false); return true; }
      return false;
    });
    await countdown(root);
    const send = setInterval(() => { if (ended || !root.isConnected) return clearInterval(send); ctx.send({ type: 'pad', p: flip(myLocal) }); }, 40);
    (function loop() { if (!root.isConnected) return; st.gp = { ...st.gp, ...flip(myLocal) }; draw(); if (!ended) requestAnimationFrame(loop); })();
    return;
  }

  // ---- Hôte : physique ----
  D.handlers.push((d) => { if (d.type === 'pad') { lastGp = d.p; return true; } return false; });
  draw();
  await countdown(root);
  function moveStick(P, target, dt, maxV) {
    let dx = target.x - P.x, dy = target.y - P.y; const d = Math.hypot(dx, dy), m = maxV * dt;
    if (d > m && d > 0) { dx *= m / d; dy *= m / d; }
    P.vx = dx / dt; P.vy = dy / dt; P.x += dx; P.y += dy;
  }
  // collision palet / segment [a,b] de rayon r ; vel = vitesse du segment
  function segHit(a, b, r, vel, e) {
    const B = st.ball, abx = b.x - a.x, aby = b.y - a.y, L2 = abx * abx + aby * aby || 1;
    const k = Math.max(0, Math.min(1, ((B.x - a.x) * abx + (B.y - a.y) * aby) / L2));
    const cx = a.x + abx * k, cy = a.y + aby * k, dx = B.x - cx, dy = B.y - cy, d = Math.hypot(dx, dy);
    if (d >= r + BR || d === 0) return false;
    const nx = dx / d, ny = dy / d; B.x = cx + nx * (r + BR); B.y = cy + ny * (r + BR);
    const rv = (B.vx - vel.x) * nx + (B.vy - vel.y) * ny;
    if (rv < 0) { B.vx -= (1 + e) * rv * nx; B.vy -= (1 + e) * rv * ny; }
    return true;
  }
  function stickHit(P, k) {
    const up = k === 'hp' ? 1 : -1;
    const a = { x: P.x - side[k] * BL, y: P.y }, b = { x: P.x + side[k] * BL, y: P.y - up * 1.2 };
    if (segHit(a, b, 1.6, { x: P.vx * 1.35, y: P.vy * 1.35 }, 0.9)) { sfx('tick'); const B = st.ball, s = Math.hypot(B.vx, B.vy); if (s > 330) { B.vx *= 330 / s; B.vy *= 330 / s; } }
    segHit({ x: P.x - side[k] * BL, y: P.y }, { x: P.x - side[k] * 10, y: P.y + up * 26 }, 1.2, { x: P.vx, y: P.vy }, 0.5); // manche
  }
  function walls() {
    const B = st.ball;
    // coins arrondis
    for (const [cx, cy] of [[CR, CR], [FW - CR, CR], [CR, FH - CR], [FW - CR, FH - CR]]) {
      const inX = cx === CR ? B.x < CR : B.x > FW - CR, inY = cy === CR ? B.y < CR : B.y > FH - CR;
      if (!inX || !inY) continue;
      const dx = B.x - cx, dy = B.y - cy, d = Math.hypot(dx, dy), m = CR - BR;
      if (d > m) { const nx = dx / d, ny = dy / d; B.x = cx + nx * m; B.y = cy + ny * m; const vn = B.vx * nx + B.vy * ny; if (vn > 0) { B.vx -= 1.8 * vn * nx; B.vy -= 1.8 * vn * ny; } }
    }
    if (B.x < BR) { B.x = BR; B.vx = Math.abs(B.vx) * 0.85; } if (B.x > FW - BR) { B.x = FW - BR; B.vx = -Math.abs(B.vx) * 0.85; }
    if (B.y < BR) { B.y = BR; B.vy = Math.abs(B.vy) * 0.85; } if (B.y > FH - BR) { B.y = FH - BR; B.vy = -Math.abs(B.vy) * 0.85; }
    // cages : côtés et fond pleins, seule l'ouverture compte
    for (const [m, b] of [[GM, GB], [FH - GM, FH - GB]]) {
      const zero = { x: 0, y: 0 };
      segHit({ x: GX0, y: m }, { x: GX0, y: b }, 0.8, zero, 0.6);
      segHit({ x: GX1, y: m }, { x: GX1, y: b }, 0.8, zero, 0.6);
      segHit({ x: GX0, y: b }, { x: GX1, y: b }, 0.8, zero, 0.3);
    }
  }
  function faceoff(info, towardHost) {
    st.ball = { x: 50, y: FH / 2 + (towardHost === undefined ? 0 : towardHost ? 6 : -6), vx: 0, vy: 0 };
    st.pause = 1.2; st.info = info; slow = 0; sfx('whistle');
  }
  let last = performance.now(), sendAcc = 0, slow = 0;
  st.pause = 0.6;
  function step(t) {
    if (!root.isConnected || ended) return;
    const dt = Math.max(0.001, Math.min(0.033, (t - last) / 1000)); last = t;
    st.t += dt;
    moveStick(st.hp, myLocal, dt, 700);
    if (D.isBot) {
      const B = st.ball;
      const target = B.y < FH / 2 + 6 ? { x: B.x - side.gp * 2, y: Math.max(4, B.y - 4) } : { x: Math.max(36, Math.min(64, B.x)), y: GM + 8 };
      moveStick(st.gp, { x: target.x, y: Math.min(FH / 2 - 4, target.y) }, dt, 115);
    } else if (lastGp) moveStick(st.gp, { x: lastGp.x, y: Math.min(FH / 2 - 4, Math.max(5, lastGp.y)) }, dt, 900);
    if (st.pause > 0) { st.pause -= dt; if (st.pause <= 0) st.info = ''; }
    else {
      const B = st.ball;
      for (let i = 0; i < 4; i++) {
        const px = B.x, py = B.y;
        B.x += B.vx * dt / 4; B.y += B.vy * dt / 4;
        walls(); stickHit(st.hp, 'hp'); stickHit(st.gp, 'gp');
        // but : le palet entre dans la cage par l'ouverture
        if (B.x > GX0 && B.x < GX1) {
          if (py >= GM && B.y < GM && B.vy < 0) { st.s[0]++; sfx(D.host ? 'ok' : 'fail'); buzz(80); faceoff('BUT !', false); break; }
          if (py <= FH - GM && B.y > FH - GM && B.vy > 0) { st.s[1]++; sfx(D.host ? 'fail' : 'ok'); buzz(80); faceoff('BUT !', true); break; }
        }
      }
      B.vx *= Math.pow(0.8, dt); B.vy *= Math.pow(0.8, dt);
      // palet coincé ou immobile trop longtemps : engagement au centre
      if (Math.hypot(B.vx, B.vy) < 6) slow += dt; else slow = 0;
      if (slow > 2.5) faceoff('Engagement');
      const [h, gs] = st.s;
      if (h >= WIN || gs >= WIN || (st.t >= LIMIT && h !== gs)) {
        const w = h > gs ? 'host' : 'guest';
        if (!D.isBot) ctx.send({ type: 'hkend', w, s: st.s });
        draw(); finish(w === 'host', false); return;
      }
    }
    sendAcc += dt;
    if (!D.isBot && sendAcc > 0.045) { sendAcc = 0; ctx.send({ type: 'hk', st: { ball: st.ball, hp: st.hp, s: st.s, t: st.t, info: st.info } }); }
    draw();
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
