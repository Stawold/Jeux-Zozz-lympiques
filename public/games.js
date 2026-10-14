// Jeux Zozz’lympiques — épreuves V1 (tir, hauteur, hip-hop, curling)
import { sleep, $, countdown, fitCanvas, liveStandings , sfx, buzz} from './kit.js';

/* ---------------- Tir de vitesse (écran partagé) ---------------- */
async function tir(root, ctx) {
  const TOTAL = 20;
  root.innerHTML = `
    <div class="hud"><span class="big" id="n">0 / ${TOTAL}</span><span id="t">0.00 s</span></div>
    <div class="rank-row"><div class="pos p1" id="pos">1<sup>er</sup></div><div class="mini" id="mini"></div></div>
    <div class="arena" id="ar"></div>
    <div class="help">Éclate les cibles ! Tir à côté = +0,5 s</div>`;
  const ar = $(root, '#ar'), nEl = $(root, '#n'), tEl = $(root, '#t');
  const st = liveStandings(ctx, $(root, '#pos'), $(root, '#mini'));
  (function loop() { if (!root.isConnected) return; st.update(); setTimeout(loop, 150); })();
  await countdown(root);
  const start = performance.now();
  let hit = 0, pen = 0, done = false;
  const timer = setInterval(() => { if (!done) tEl.textContent = ((performance.now() - start) / 1000 + pen).toFixed(2) + ' s'; }, 50);
  const colors = ['#e8456b', '#2a1638', '#9ee6cf', '#f4b48a'];
  function spawn() {
    const r = ar.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'bubble';
    b.style.left = 42 + Math.random() * (r.width - 84) + 'px';
    b.style.top = 42 + Math.random() * (r.height - 84) + 'px';
    b.style.setProperty('--c', colors[hit % colors.length]);
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (done) return;
      const s = document.createElement('div');
      s.className = 'burst'; s.style.left = b.style.left; s.style.top = b.style.top;
      ar.appendChild(s); setTimeout(() => s.remove(), 300);
      b.remove(); sfx('pop'); buzz(15);
      hit++;
      nEl.textContent = `${hit} / ${TOTAL}`;
      ctx.prog(hit / TOTAL);
      if (hit >= TOTAL) {
        done = true;
        clearInterval(timer);
        const time = (performance.now() - start) / 1000 + pen;
        tEl.textContent = time.toFixed(2) + ' s';
        ctx.finish(-Math.round(time * 100) / 100, time.toFixed(2) + ' s');
      } else spawn();
    });
    ar.appendChild(b);
  }
  ar.addEventListener('pointerdown', () => { if (!done) { pen += 0.5; sfx('fail'); buzz(80); } });
  spawn();
}

/* ---------------- Saut en hauteur ---------------- */
async function hauteur(root, ctx) {
  root.innerHTML = `
    <div class="hud"><span class="big" id="h">1,50 m</span><span id="b">Meilleur : —</span></div>
    <div class="help">Tape quand la flèche est dans la zone verte. 3 échecs à une hauteur = éliminé.</div>
    <div class="gauge" id="g"><div class="zone" id="z"></div><div class="arrow" id="a"></div></div>
    <div class="tries" id="tr"></div>
    <div class="title" id="msg"></div>
    <button class="tapzone" id="tap" disabled>SAUTE</button>`;
  const z = $(root, '#z'), a = $(root, '#a'), tap = $(root, '#tap'), hEl = $(root, '#h'), bEl = $(root, '#b'), tr = $(root, '#tr'), msg = $(root, '#msg');
  let level = 0, fails = 0, totalFails = 0, best = 0, pos = 0, dir = 1, zStart = 0, zW = 0, running = false, done = false;
  const height = () => 150 + level * 10;
  const fmt = (cm) => (cm / 100).toFixed(2).replace('.', ',') + ' m';
  function setup() {
    zW = Math.max(4, 30 - level * 2.5);
    zStart = 5 + Math.random() * (90 - zW);
    z.style.left = zStart + '%'; z.style.width = zW + '%';
    hEl.textContent = fmt(height());
    tr.textContent = [0, 1, 2].map((i) => (i < fails ? '❌' : '⚪')).join('');
  }
  let lastT = performance.now();
  function loop(t) {
    const dt = (t - lastT) / 1000; lastT = t;
    if (running) {
      pos += dir * (55 + level * 6) * dt;
      if (pos > 100) { pos = 100; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
      a.style.left = pos + '%';
    }
    if (!done) requestAnimationFrame(loop);
  }
  setup();
  await countdown(root);
  running = true; tap.disabled = false;
  requestAnimationFrame(loop);
  tap.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    if (!running || done) return;
    running = false;
    const ok = pos >= zStart && pos <= zStart + zW;
    if (ok) {
      best = height(); bEl.textContent = 'Meilleur : ' + fmt(best);
      msg.textContent = '✅ Franchi !'; sfx('ok');
      level++; fails = 0;
    } else {
      fails++; totalFails++;
      msg.textContent = '❌ Barre tombée'; sfx('fail');
      if (navigator.vibrate) navigator.vibrate(120);
    }
    setup();
    if (fails >= 3) {
      done = true; tap.disabled = true;
      msg.textContent = best ? 'Fin ! ' + fmt(best) : 'Éliminé';
      ctx.finish(best * 100 - totalFails, best ? fmt(best) : '0 m');
      return;
    }
    await sleep(700);
    msg.textContent = '';
    pos = 0; dir = 1; running = true;
  });
}

/* ---------------- Hip-Hop ---------------- */
async function hiphop(root, ctx) {
  root.innerHTML = `
    <div class="hud"><span class="big" id="s">0 pts</span><span id="t">60 s</span></div>
    <canvas class="full" id="cv"></canvas>
    <div class="pads">
      <button data-l="0">⬅️</button><button class="alt" data-l="1">⬇️</button>
      <button class="alt" data-l="2">⬆️</button><button data-l="3">➡️</button>
    </div>`;
  const cv = $(root, '#cv'), sEl = $(root, '#s'), tEl = $(root, '#t');
  const { g, W, H } = fitCanvas(cv);
  const ARROWS = ['⬅️', '⬇️', '⬆️', '➡️'];
  const COLS = ['#ff7eb6', '#8b5cf6', '#5ee0c8', '#ffe066'];
  const hitY = H - 50, lw = W / 4;
  let notes = [], score = 0, flash = [0, 0, 0, 0], label = '', labelT = 0, done = false;
  await countdown(root);
  const start = performance.now();
  let nextSpawn = 0, last = start;
  function press(l) {
    if (done) return;
    flash[l] = 1;
    let best = null, bd = 1e9;
    for (const n of notes) if (n.l === l && !n.hit) { const d = Math.abs(n.y - hitY); if (d < bd) { bd = d; best = n; } }
    if (best && bd < 22) { best.hit = true; score += 3; label = 'PARFAIT +3'; sfx('tick'); }
    else if (best && bd < 50) { best.hit = true; score += 1; label = 'BIEN +1'; }
    else label = 'RATÉ';
    labelT = 0.5;
    sEl.textContent = score + ' pts';
  }
  root.querySelectorAll('.pads button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(+b.dataset.l); }));
  function frame(t) {
    const el = (t - start) / 1000, dt = (t - last) / 1000; last = t;
    const left = Math.max(0, 60 - el);
    tEl.textContent = Math.ceil(left) + ' s';
    const speed = 180 + el * 6; // px/s, accélère
    if (el < 58.5 && el >= nextSpawn) {
      notes.push({ l: Math.floor(Math.random() * 4), y: -30, hit: false });
      nextSpawn = el + Math.max(0.28, 0.9 - el * 0.011);
    }
    for (const n of notes) n.y += speed * dt;
    notes = notes.filter((n) => !n.hit && n.y < H + 40);
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(43,29,58,.55)'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = `rgba(255,255,255,${0.05 + flash[i] * 0.3})`; g.fillRect(i * lw + 3, 0, lw - 6, H);
      flash[i] = Math.max(0, flash[i] - dt * 4);
    }
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, hitY); g.lineTo(W, hitY); g.stroke();
    g.font = `${Math.min(lw * 0.6, 40)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const n of notes) {
      g.fillStyle = COLS[n.l]; g.beginPath(); g.arc(n.l * lw + lw / 2, n.y, Math.min(lw * 0.4, 28), 0, 7); g.fill();
    }
    if (labelT > 0) {
      labelT -= dt; g.fillStyle = '#fff'; g.font = '800 21px Unbounded, sans-serif';
      g.fillText(label, W / 2, H * 0.4);
    }
    if (left <= 0) {
      done = true;
      ctx.finish(score, score + ' pts');
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------------- Curling (duel) ---------------- */
async function curling(root, ctx) {
  const pair = ctx.current.pairs.find((p) => p.a === ctx.me || p.b === ctx.me);
  const oppId = pair.a === ctx.me ? pair.b : pair.a;
  const isBot = oppId === 'BOT';
  const oppName = isBot ? '🤖 Bot' : ctx.name(oppId);
  const myCol = ctx.color(ctx.me), oppCol = isBot ? '#888' : ctx.color(oppId);

  root.innerHTML = `
    <div class="hud"><span id="who">vs ${oppName}</span><span id="t">20 s</span></div>
    <div class="title" id="msg"></div>
    <canvas class="full" id="cv" style="background:#eef7ff"></canvas>
    <label class="curl-start" for="sx"><span>Départ</span><input id="sx" type="range" min="-30" max="30" value="0" step="1" disabled><span id="sxv">centre</span></label>
    <div class="help" id="help">Choisis ton point de départ, puis glisse vers le bas pour viser et doser la force.</div>`;
  const cv = $(root, '#cv'), msg = $(root, '#msg'), tEl = $(root, '#t');
  const { g, W, H } = fitCanvas(cv);

  // Monde : x ∈ [-40,40], y ∈ [-40, 380]. Maison centrée en (0,0).
  const SW = 40, R = 4, HOUSE = 20, A = 40, VMAX = 200, START = { x: 0, y: 360 };
  const sx = $(root, '#sx'), sxv = $(root, '#sxv');
  sx.addEventListener('input', () => { START.x = +sx.value; sxv.textContent = START.x === 0 ? 'centre' : (START.x < 0 ? '◀ ' : '') + Math.abs(START.x) + (START.x > 0 ? ' ▶' : ''); draw(); });
  const sc = Math.min(W / 88, H / 440);
  const ox = W / 2, oy = H / 2 - 170 * sc; // y monde 170 au centre
  const toS = (x, y) => [ox + x * sc, oy + y * sc];

  let stones = []; // {x,y,vx,vy,owner:'me'|'opp'}
  const order = [];
  const firstIsMe = pair.first === ctx.me;
  for (let i = 0; i < 6; i++) order.push((i % 2 === 0) === firstIsMe ? 'me' : 'opp');
  let turn = 0, sim = false, aiming = null, deadline = 0, ended = false, forfeit = false;
  const inbox = [], waiters = [];
  ctx.onMsg((d) => {
    if (d.type === 'left') { forfeit = true; endGame(true, 'forfait'); return; }
    inbox.push(d); while (waiters.length) waiters.shift()();
  });
  const nextMsg = (type, n) => new Promise((res) => {
    const check = () => {
      const i = inbox.findIndex((m) => m.type === type && m.n === n);
      if (i >= 0) return res(inbox.splice(i, 1)[0]);
      waiters.push(check);
    };
    check();
  });

  function draw() {
    g.clearRect(0, 0, W, H);
    // piste
    const [x0, y0] = toS(-SW, -40), [x1, y1] = toS(SW, 380);
    g.fillStyle = '#f7fbff'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = '#b8d4ea'; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // maison
    const [cx, cy] = toS(0, 0);
    [[HOUSE, '#4dabf7'], [HOUSE * 0.66, '#fff'], [HOUSE * 0.33, '#ff6b9a'], [3, '#fff']].forEach(([r, c]) => {
      g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r * sc, 0, 7); g.fill();
    });
    g.strokeStyle = '#9ec3e0'; g.beginPath(); g.moveTo(x0, cy); g.lineTo(x1, cy); g.moveTo(cx, y0); g.lineTo(cx, y1); g.stroke();
    // ligne de lancer
    const [, hy] = toS(0, 300); g.strokeStyle = '#ff7eb6'; g.beginPath(); g.moveTo(x0, hy); g.lineTo(x1, hy); g.stroke();
    // pierres
    for (const s of stones) drawStone(s.x, s.y, s.owner === 'me' ? myCol : oppCol);
    if (!sim && !ended && order[turn] === 'me') {
      drawStone(START.x, START.y, myCol, 0.9);
      if (aiming) {
        const v = aimVel();
        if (v) {
          const [sx, sy] = toS(START.x, START.y);
          const k = v.p;
          g.strokeStyle = `hsl(${120 - k * 120},80%,45%)`; g.lineWidth = 4; g.setLineDash([8, 6]);
          g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + v.vx * sc * 0.9, sy + v.vy * sc * 0.9); g.stroke(); g.setLineDash([]);
        }
      }
    }
    // compteur pierres
    const left = (o) => order.slice(turn).filter((x) => x === o).length;
    g.fillStyle = '#2a1638'; g.font = '800 11px Unbounded, sans-serif'; g.textAlign = 'left';
    g.fillText(`Toi : ${left('me')} pierre(s)`, 8, H - 10);
    g.textAlign = 'right'; g.fillText(`${oppName} : ${left('opp')}`, W - 8, H - 10); g.textAlign = 'left';
  }
  function drawStone(x, y, col, alpha = 1) {
    const [sx, sy] = toS(x, y);
    g.globalAlpha = alpha;
    g.fillStyle = '#6c757d'; g.beginPath(); g.arc(sx, sy, R * sc, 0, 7); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(sx, sy, R * sc * 0.7, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(sx - R * sc * 0.25, sy - R * sc * 0.25, R * sc * 0.22, 0, 7); g.fill();
    g.globalAlpha = 1;
  }
  function aimVel() {
    if (!aiming) return null;
    let dx = aiming.sx - aiming.cx, dy = aiming.sy - aiming.cy; // tirer vers le bas = lancer vers le haut
    const len = Math.hypot(dx, dy);
    if (dy >= -2 || len < 8) return null;
    const p = Math.min(1, len / (H * 0.35));
    const ux = dx / len, uy = dy / len;
    return { vx: ux * p * VMAX, vy: uy * p * VMAX, p };
  }

  function step(dt) {
    let moving = false;
    for (const s of stones) {
      const v = Math.hypot(s.vx, s.vy);
      if (v > 0) {
        const nv = Math.max(0, v - A * dt);
        s.vx *= nv / v; s.vy *= nv / v;
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (nv > 0) moving = true;
      }
    }
    for (let i = 0; i < stones.length; i++) for (let j = i + 1; j < stones.length; j++) {
      const a = stones[i], b = stones[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 2 * R) {
        const nx = dx / d, ny = dy / d;
        const ov = 2 * R - d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) { a.vx -= rel * nx; a.vy -= rel * ny; b.vx += rel * nx; b.vy += rel * ny; moving = true; }
      }
    }
    stones = stones.filter((s) => Math.abs(s.x) < SW && s.y > -40 && s.y < 385);
    return moving;
  }
  async function simulate() {
    sim = true;
    let last = performance.now();
    await new Promise((res) => {
      function f(t) {
        let dt = Math.max(0, Math.min(0.05, (t - last) / 1000)); last = t;
        let moving = false;
        const sub = 4;
        for (let i = 0; i < sub; i++) moving = step(dt / sub) || moving;
        draw();
        if (moving && !ended) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
    for (const s of stones) { s.vx = 0; s.vy = 0; }
    sim = false;
  }
  const snapshot = () => stones.map((s) => ({ x: +s.x.toFixed(3), y: +s.y.toFixed(3), owner: s.owner }));
  const launch = (vx, vy, owner, x = 0) => stones.push({ x, y: START.y, vx, vy, owner });

  function myThrow() {
    return new Promise((res) => {
      msg.textContent = '🎯 À toi de lancer !';
      sx.disabled = false;
      deadline = performance.now() + 20000;
      const tick = setInterval(() => {
        const l = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
        tEl.textContent = l + ' s';
        if (l <= 0) { cleanup(); res({ vx: 0, vy: -100, x: START.x }); } // tir faible automatique
      }, 200);
      const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const down = (e) => { const [x, y] = pt(e); aiming = { sx: x, sy: y, cx: x, cy: y }; cv.setPointerCapture(e.pointerId); draw(); };
      const move = (e) => { if (!aiming) return; const [x, y] = pt(e); aiming.cx = x; aiming.cy = y; draw(); };
      const up = () => { const v = aimVel(); aiming = null; draw(); if (v) { cleanup(); res({ ...v, x: START.x }); } };
      function cleanup() { clearInterval(tick); cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); tEl.textContent = ''; sx.disabled = true; }
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
      if (ended) cleanup();
    });
  }
  function botThrow() {
    const tx = (Math.random() - 0.5) * 16, ty = (Math.random() - 0.5) * 16;
    const x = Math.round((Math.random() - 0.5) * 40);
    const dx = tx - x, dy = ty - START.y, d = Math.hypot(dx, dy);
    const v = Math.sqrt(2 * A * d) * (0.92 + Math.random() * 0.14);
    return { vx: dx / d * v, vy: dy / d * v, x };
  }

  function score() {
    const inHouse = stones.map((s) => ({ ...s, d: Math.hypot(s.x, s.y) })).filter((s) => s.d <= HOUSE + R).sort((a, b) => a.d - b.d);
    if (!inHouse.length) return { winner: null, pts: 0 };
    const w = inHouse[0].owner;
    const firstOther = inHouse.find((s) => s.owner !== w);
    const pts = inHouse.filter((s) => s.owner === w && (!firstOther || s.d < firstOther.d)).length;
    return { winner: w, pts };
  }
  function endGame(win, detail) {
    if (ended) return;
    ended = true;
    msg.textContent = win ? '🏆 Victoire !' : '😢 Défaite';
    $(root, '#help').textContent = detail;
    ctx.finish(win ? 1 : 0, detail);
  }

  draw();
  await sleep(600);
  let extra = 0;
  while (!ended) {
    while (turn < order.length && !ended) {
      const who = order[turn], n = turn;
      if (who === 'me') {
        const v = await myThrow();
        if (ended) break;
        msg.textContent = '';
        if (!isBot) ctx.send({ type: 'throw', n, vx: v.vx, vy: v.vy, x: v.x });
        launch(v.vx, v.vy, 'me', v.x);
        await simulate();
        if (!isBot) ctx.send({ type: 'sync', n, stones: snapshot().map((s) => ({ ...s, owner: s.owner === 'me' ? 'opp' : 'me' })) });
      } else {
        msg.textContent = `⏳ ${oppName} vise…`;
        let v;
        if (isBot) { await sleep(1200); v = botThrow(); }
        else v = await nextMsg('throw', n);
        if (ended) break;
        msg.textContent = '';
        launch(v.vx, v.vy, 'opp', v.x || 0);
        await simulate();
        if (!isBot) {
          const s = await nextMsg('sync', n);
          if (ended) break;
          stones = s.stones.map((o) => ({ ...o, vx: 0, vy: 0 }));
          draw();
        }
      }
      turn++;
    }
    if (ended) break;
    const r = score();
    if (r.winner) {
      endGame(r.winner === 'me', r.winner === 'me' ? `${r.pts}-0` : `0-${r.pts}`);
    } else {
      // égalité / maison vide : une pierre de plus chacun
      extra++;
      msg.textContent = '⚖️ Maison vide : une pierre de plus chacun !';
      await sleep(1500);
      order.push(firstIsMe ? 'me' : 'opp', firstIsMe ? 'opp' : 'me');
      if (extra > 5) endGame(firstIsMe, 'égalité');
    }
  }
}

export { tir, hauteur, hiphop, curling };
