import * as THREE from 'three';
import * as V1 from './games.js';
import * as RACES from './races.js';
import * as SOLOS from './solos.js';
import * as DUELS from './duels.js';
import * as EXTRA from './extra.js';
import { sfx, buzz, sound, requestSensors } from './kit.js';
const GAMES = { ...V1, ...RACES, ...SOLOS, ...DUELS, ...EXTRA };

/* ---------- Identité locale ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
let pid = store.get('bg_pid');
if (!pid) { pid = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('bg_pid', pid); }

// Mode en ligne (serveur) ou entraînement contre des bots (tout dans la page, fonctionne sans réseau)
let socket = null;
function bindSocket(s) {
  s.on('connect', () => {
    const code = new URLSearchParams(location.search).get('r') || store.get('bg_room');
    if (code) s.emit('join', { code, pid, name: store.get('bg_name') || 'Joueur', silent: !new URLSearchParams(location.search).get('r') });
  });
  s.on('err', ({ msg, silent }) => { if (silent) { store.del('bg_room'); render(); } else toast(msg); });
  s.on('state', onState);
  s.on('prog', ({ id, v }) => { gameProgs[id] = v; scene3d.setProg(id, v); });
  s.on('curl', (d) => { if (gameMsgHandler) gameMsgHandler(d); else gameInbox.push(d); });
}
function useBots() {
  window.OFFLINE = true;
  try { socket?.disconnect(); } catch {}
  S = null; store.del('bg_room');
  socket = window.makeBotSocket(); bindSocket(socket);
  render();
}
function useOnline() { window.OFFLINE = false; location.href = location.pathname; }
const app = document.getElementById('app');
let S = null;            // état de la salle
let runningGameId = null;
let gameMsgHandler = null, gameInbox = [];
let myResult = null;
let libreEvent = 'sprint', chosenMode = 'jo';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const country = (code) => S?.countries.find((c) => c.code === code) || { flag: '🏳️', color: '#ccc', name: '?' };
const player = (id) => S?.players.find((p) => p.id === id);
function toast(t) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }

/* ---------- Réseau ---------- */
function onState(st) {
  const prevPhase = S?.phase;
  S = st;
  store.set('bg_room', st.code);
  if (st.phase === 'event' && st.current.id !== runningGameId) { myResult = null; }
  if (st.phase !== 'event') runningGameId = null;
  scene3d.sync();
  if (st.phase === 'event' && runningGameId === st.current.id) { if (st.current.go && !gameStarted) startGame(); else if (!gameStarted) updateRules(); else updateWait(); return; }
  if (prevPhase === 'lobby' && st.phase === 'lobby' && document.activeElement?.tagName === 'INPUT') return;
  render();
}
let gameProgs = {};

/* ---------- Écrans ---------- */
function render() {
  document.body.dataset.phase = S ? S.phase : 'home';
  if (!S) return renderHome();
  if (S.phase === 'lobby') return renderLobby();
  if (S.phase === 'event') return renderEvent();
  if (S.phase === 'reveal') return renderReveal();
  if (S.phase === 'final') return renderFinal();
}

function renderHome() {
  const urlCode = new URLSearchParams(location.search).get('r') || '';
  if (window.OFFLINE) {
    let nb = 7;
    app.innerHTML = `
      <div class="kicker">Édition Taghazout</div><h1 class="logo"><span class="l1">Les Jeux</span><span class="l2">Zozz’lympiques</span></h1>
      <p class="sub">Entraînement contre des bots</p>
      <div class="card">
        <input id="name" maxlength="16" placeholder="Ton pseudo" value="${esc(store.get('bg_name') || '')}">
        <h2>Nombre de bots : <span id="nbv">${nb}</span></h2>
        <input id="nb" type="range" min="1" max="15" value="${nb}" style="padding:0;border:0;accent-color:#e8456b">
        <button id="create">Jouer contre les bots</button>
      </div>
      <button class="ghost" id="snd" style="width:auto;align-self:center;padding:10px 18px">${sound.muted ? '🔇 Son coupé' : '🔊 Son activé'}</button>
      <p class="muted">Tout tourne sur ton téléphone, même sans réseau. Dans les duels, tu affrontes un bot.</p>
      ${window.OFFLINE_ONLY ? '' : '<button class="ghost" id="online">← Jouer en ligne avec des amis</button>'}`;
    const sb = document.getElementById('snd'); sb.onclick = () => { sound.muted = !sound.muted; sb.textContent = sound.muted ? '🔇 Son coupé' : '🔊 Son activé'; };
    const on = document.getElementById('online'); if (on) on.onclick = useOnline;
    const r = document.getElementById('nb');
    r.oninput = () => { nb = +r.value; document.getElementById('nbv').textContent = nb; };
    document.getElementById('create').onclick = () => {
      const n = document.getElementById('name').value.trim() || 'Joueur'; store.set('bg_name', n);
      socket.emit('create', { name: n, pid, bots: nb });
    };
    return;
  }
  app.innerHTML = `
    <div class="kicker">Édition Taghazout</div><h1 class="logo"><span class="l1">Les Jeux</span><span class="l2">Zozz’lympiques</span></h1>
    <div class="card">
      <input id="name" maxlength="16" placeholder="Ton pseudo" value="${esc(store.get('bg_name') || '')}">
      <button id="create">Créer une partie</button>
      <div class="row"><input id="code" maxlength="4" placeholder="CODE" style="text-transform:uppercase;text-align:center;letter-spacing:4px" value="${esc(urlCode)}">
      <button class="alt" id="join" style="margin:0 0 10px">Rejoindre</button></div>
    </div>
    <button class="alt" id="bots">🤖 Entraînement contre des bots</button>
    <p class="muted">De 2 à 16 joueurs, chacun sur son téléphone. L'entraînement fonctionne aussi sans réseau.</p>`;
  document.getElementById('bots').onclick = useBots;
  const name = () => { const n = document.getElementById('name').value.trim() || 'Joueur'; store.set('bg_name', n); return n; };
  document.getElementById('create').onclick = () => socket.emit('create', { name: name(), pid });
  document.getElementById('join').onclick = () => socket.emit('join', { code: document.getElementById('code').value, name: name(), pid });
}

function medalLine(p) {
  const m = p.medals || [0, 0, 0];
  if (!m[0] && !m[1] && !m[2]) return '';
  return `<span class="medline">${m[0] ? `<i class="md g">${m[0]}</i>` : ''}${m[1] ? `<i class="md s">${m[1]}</i>` : ''}${m[2] ? `<i class="md b">${m[2]}</i>` : ''}</span>`;
}
function medalTable() {
  const rows = [...S.players].map((p) => ({ p, m: p.medals || [0, 0, 0] })).filter((x) => x.m[0] + x.m[1] + x.m[2] > 0)
    .sort((a, b) => b.m[0] - a.m[0] || b.m[1] - a.m[1] || b.m[2] - a.m[2] || b.p.total - a.p.total);
  if (!rows.length) return '';
  return `<div class="card"><h2>Tableau des médailles</h2><table class="medtab"><thead><tr><th></th><th>Pays</th><th><i class="md g"></i></th><th><i class="md s"></i></th><th><i class="md b"></i></th><th>Total</th></tr></thead><tbody>
    ${rows.map((x, i) => `<tr class="${x.p.id === pid ? 'me' : ''}"><td>${i + 1}</td><td>${country(x.p.country).flag} ${esc(x.p.name)}</td><td>${x.m[0]}</td><td>${x.m[1]}</td><td>${x.m[2]}</td><td><b>${x.m[0] + x.m[1] + x.m[2]}</b></td></tr>`).join('')}
  </tbody></table></div>`;
}
function playerRow(p, right = '') {
  const c = country(p.country);
  return `<div class="pl ${p.id === pid ? 'me' : ''} ${p.connected ? '' : 'off'}">
    <span class="dot" style="background:${c.color}"></span><span class="flag">${c.flag}</span>
    <span class="nm">${esc(p.name)}${p.id === S.hostId ? ' 👑' : ''}${medalLine(p)}</span><span class="pts">${right}</span></div>`;
}

function renderLobby() {
  const me = player(pid), host = S.hostId === pid;
  const taken = new Set(S.players.map((p) => p.country));
  const link = `${location.origin}${location.pathname}?r=${S.code}`;
  app.innerHTML = `
    <div class="kicker" style="margin-top:6px">Édition Taghazout</div>
    <h1 class="logo small"><span class="l1">Les Jeux</span><span class="l2">Zozz’lympiques</span></h1>
    ${window.OFFLINE ? '' : `<div class="codecard"><div><div class="lbl">Code de la partie</div><div class="code">${S.code}</div></div>
      <button class="pillbtn" id="share">Partager</button></div>`}
    <section class="blk"><div class="blkhead"><h2>Athlètes</h2><span>${S.players.length} / 16</span></div>
      <div class="blobs">${S.players.map((p) => `<div class="pblob ${p.id === pid ? 'me' : ''} ${p.connected ? '' : 'off'}"><span class="blob" style="background:${country(p.country).color}"></span><span class="pn">${country(p.country).flag} ${esc(p.name)}${p.id === S.hostId ? ' ★' : ''}</span></div>`).join('')}
      ${S.players.length < 16 && !window.OFFLINE ? '<div class="pblob"><span class="blob add">+</span><span class="pn" style="opacity:.6">Inviter</span></div>' : ''}</div></section>
    <section class="blk"><h2>Ton pays</h2><div class="flags">
      ${S.countries.map((c) => `<button data-c="${c.code}" class="${me?.country === c.code ? 'sel' : ''}" ${!window.OFFLINE && taken.has(c.code) && me?.country !== c.code ? 'disabled' : ''} title="${c.name}" aria-label="${c.name}">${c.flag}</button>`).join('')}
    </div><div class="muted" style="margin-top:6px">${country(me?.country).name}</div></section>
    ${host ? `<section class="blk"><h2>Programme</h2>
      <div class="tiles">${Object.entries(S.modes).map(([k, mo], i) => `<button data-m="${k}" class="tile t${i} ${chosenMode === k ? 'sel' : ''} ${k === 'jo' ? 'wide' : ''}"><b>${String(k === 'libre' ? 1 : k === 'jo' ? Object.keys(S.events).length : mo.count).padStart(2, '0')}</b><span>${k === 'jo' ? 'Mode J.O. · toutes les épreuves' : mo.name}</span></button>`).join('')}</div>
      ${chosenMode === 'libre' ? `<div class="chips" style="margin-top:10px">${Object.entries(S.events).map(([k, e]) => `<button data-e="${k}" class="${libreEvent === k ? 'sel' : ''}">${e.name}</button>`).join('')}</div>` : ''}
      <div class="muted" style="margin:10px 0">${modeHint()}</div>
      <button class="cta" id="start">Lancer les jeux <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></section>`
    : `<div class="card muted">En attente de l'hôte pour lancer…</div>`}
    <button class="ghost" id="leave">Quitter</button>`;
  app.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => socket.emit('country', { code: b.dataset.c })));
  app.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { chosenMode = b.dataset.m; renderLobby(); }));
  app.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => { libreEvent = b.dataset.e; renderLobby(); }));
  const st = document.getElementById('start');
  if (st) st.onclick = () => socket.emit('start', { mode: chosenMode, event: libreEvent });
  document.getElementById('leave').onclick = () => { socket.emit('leave'); store.del('bg_room'); S = null; history.replaceState(null, '', location.pathname); render(); scene3d.sync(); };
  const sh = document.getElementById('share'); if (sh) sh.onclick = async () => {
    try { if (navigator.share) await navigator.share({ title: 'Les Jeux Zozz’lympiques', text: `Rejoins les Jeux Zozz’lympiques ! Code ${S.code}`, url: link }); else { await navigator.clipboard.writeText(link); toast('Lien copié !'); } } catch {}
  };
}
function modeHint() {
  const n = Object.keys(S.events).length;
  const m = S.modes[chosenMode];
  if (chosenMode === 'libre') return '1 épreuve au choix';
  if (chosenMode === 'jo') return `Toutes les épreuves (${n}) dans un ordre aléatoire`;
  return `${m.name} : ${Math.min(m.count, n)} épreuve(s) au hasard${m.count > n ? ` (V1 : ${n} disponibles)` : ''}`;
}

/* ---------- Records ---------- */
// Vrais records du monde quand l'épreuve s'y prête, sinon record Zozz’lympique à battre.
const fs = (v) => v.toFixed(2).replace('.', ',') + ' s', fm = (v) => v.toFixed(2).replace('.', ',') + ' m';
const RECORDS = {
  sprint: { who: 'Usain Bolt 🇯🇲', value: 9.58, lower: true, fmt: fs, world: true },
  haies: { who: 'Aries Merritt 🇺🇸', value: 12.8, lower: true, fmt: fs, world: true },
  hauteur: { who: 'Javier Sotomayor 🇨🇺', value: 2.45, fmt: fm, world: true },
  longueur: { who: 'Mike Powell 🇺🇸', value: 8.95, fmt: fm, world: true },
  tir: { who: 'Record Zozz’lympique', value: 8.5, lower: true, fmt: fs },
  hiphop: { who: 'Record Zozz’lympique', value: 300, fmt: (v) => Math.round(v) + ' pts' },
  cyclisme: { who: 'Record Zozz’lympique', value: 10, lower: true, fmt: fs },
  natation: { who: 'Record Zozz’lympique', value: 28, lower: true, fmt: fs },
  aviron: { who: 'Record Zozz’lympique', value: 15, lower: true, fmt: fs },
  skate: { who: 'Record Zozz’lympique', value: 620, fmt: (v) => Math.round(v) + ' pts' },
  golf: { who: 'Record Zozz’lympique', value: 5, lower: true, fmt: (v) => v + ' coups' },
  haltero: { who: 'Lasha Talakhadze 🇬🇪 (arraché)', value: 225, fmt: (v) => Math.round(v) + ' kg', world: true },
  marteau: { who: 'Iouri Sedykh 🇺🇦', value: 86.74, fmt: fm, world: true },
  arc: { who: 'Record Zozz’lympique', value: 84, fmt: (v) => Math.round(v) + ' pts' },
  ski: { who: 'Record Zozz’lympique', value: 19, lower: true, fmt: fs },
  escalade: { who: 'Record Zozz’lympique', value: 6, lower: true, fmt: fs },
};
const TIMED = ['sprint', 'haies', 'tir', 'cyclisme', 'natation', 'aviron', 'ski', 'escalade'];
function rawValue(ev, score) {
  if (TIMED.includes(ev) || ev === 'golf') return -score;
  if (ev === 'hauteur') return Math.ceil(score / 100) / 100; // cm -> m
  if (ev === 'longueur' || ev === 'marteau') return score / 100;
  if (ev === 'haltero') return Math.ceil(score / 100);
  return score;
}
const better = (rec, a, b) => (b == null ? true : rec.lower ? a < b : a > b);
function recordStrip(ev) {
  const rec = RECORDS[ev]; if (!rec) return null;
  const pb = Number(store.get('bg_pb_' + ev)) || null;
  const el = document.createElement('div');
  el.className = 'record';
  el.innerHTML = `<span class="wr">${rec.world ? '🌍 ' : '⭐ '}${esc(rec.who)} · ${rec.fmt(rec.value)}</span><span class="pb">Toi : ${pb ? rec.fmt(pb) : '—'}</span>`;
  return el;
}

const RULES = {
  sprint: ['Tape le plus vite possible sur le gros bouton TAP.', '1 tap = 1 mètre, arrivée à 100 m.', 'Maximum 15 taps par seconde : inutile de tricher à plusieurs doigts.', 'Classement au temps.'],
  tir: ['20 cibles apparaissent une par une.', 'Touche-les le plus vite possible.', 'Chaque tir à côté ajoute 0,5 s à ton temps.', 'Classement au temps total.'],
  hauteur: ['La barre part de 1,50 m et monte de 10 cm à chaque saut réussi.', 'Tape SAUTE quand la flèche est dans la zone verte.', 'La zone rétrécit à chaque hauteur.', '3 échecs sur une même barre = éliminé. Classement à la meilleure hauteur, puis au moins d\'échecs.'],
  hiphop: ['1 minute de danse.', 'Les blocs colorés descendent dans 4 colonnes.', 'Tape la touche de la colonne quand le bloc passe sur la ligne blanche.', 'Parfait = 3 pts, Bien = 1 pt. Ça accélère !'],
  curling: ['Duel en 1 contre 1, 3 pierres chacun, lancers alternés.', 'Choisis ton point de départ avec le curseur.', 'Glisse vers le bas pour viser et doser la force, puis relâche (20 s max).', 'La pierre la plus proche du centre gagne la manche. Victoire = 10 pts, défaite = 8 pts.'],
  haies: ['110 m avec 10 haies.', 'Tape TAP pour courir. Devant chaque haie, TAP se bloque (⛔) et SAUT clignote : saute pour repartir.', 'Saute trop tôt et tu retombes avant la haie : il faudra ressauter.', 'Classement au temps.'],
  cyclisme: ['1 km sur la piste.', 'Fais des cercles avec ton doigt sur la roue : chaque tour = 25 m.', 'Vitesse limitée à 8 tours par seconde.', 'Classement au temps.'],
  natation: ['200 m 4 nages : 4 longueurs de 50 m.', 'Papillon : 2 doigts qui tournent (cercles). Dos : 2 doigts gauche-droite. Brasse : 2 doigts haut-bas. Crawl : tape vite.', 'Un seul doigt suffit si ton écran n\'est pas multi-touch.', 'Classement au temps.'],
  aviron: ['2000 m en ligne droite.', 'Tire vers le bas sur la zone d\'eau pour ramer.', 'Garde le rythme : un coup trop rapproché du précédent compte beaucoup moins.', 'Classement au temps.'],
  longueur: ['3 essais, le meilleur compte.', '① ÉLAN : tape le plus vite possible tant que la barre rose se vide (2,5 s).', '✋ STOP : tu arrives sur la planche.', '② APPEL : le bouton devient vert « SAUTE ! ». Tape quand la flèche est dans le vert, au plus près du rouge. Dans le rouge = mordu, essai nul.'],
  skate: ['6 figures de plus en plus longues (3 à 8 flèches).', 'Les flèches s\'affichent une par une et restent visibles, puis se cachent.', 'Reproduis la séquence avec les flèches en 10 s. Une erreur = figure ratée.', 'Chaque figure réussie = 100 pts + bonus de rapidité.'],
  basket: ['5 lancers francs, la position change à chaque tir.', 'Pose le doigt sur la balle et glisse-la vers le panier.', 'La direction du geste vise ; sa vitesse donne la force : ni trop mou, ni trop violent.', 'Classement au nombre de paniers.'],
  rugby: ['5 pénalités de plus en plus loin (22 à 45 m).', 'Pose le doigt sur le ballon et glisse-le vers les perches.', 'La direction vise ; plus le geste est rapide, plus le coup va loin. Les longues distances demandent un geste vif.', 'Classement au nombre de transformations.'],
  golf: ['Mini-golf : 3 parcours tirés au sort parmi 9 (les mêmes pour tout le monde).', 'Glisse vers l\'arrière pour viser et doser, relâche pour putter.', 'Les murs roses font rebondir la balle. 7 coups max par trou (+1 de pénalité).', 'Le moins de coups l\'emporte.'],
  football: ['Duel 1 contre 1 façon air-hockey.', 'Garde le doigt sur ton slime pour le déplacer, sans passer la ligne du milieu.', 'Pousse le ballon dans le but adverse. Premier à 3 buts (2 min, puis but en or).', 'Victoire = 10 pts, défaite = 8 pts.'],
  handball: ['Duel de jets à 7 m : 5 tirs chacun, en alternance.', 'Tireur : choisis 1 des 9 zones du but (jamais 2 fois la même). Gardien : choisis où plonger.', 'Même zone = arrêt, sinon but. Égalité = mort subite.', 'Victoire = 10 pts, défaite = 8 pts.'],
  escrime: ['Duel au fleuret : le premier à 3 touches gagne.', 'L\'attaquant choisit Haut, Milieu ou Bas, le défenseur aussi en même temps.', 'Même zone = parade et le défenseur devient l\'attaquant. Sinon touche !', 'Victoire = 10 pts, défaite = 8 pts.'],
  haltero: ['La barre part de 100 kg, +10 kg à chaque réussite. 3 échecs de suite = fin.', '① Soulève : tape vite pour remplir la jauge en 3 s (plus c\'est lourd, plus il faut de taps).', '② Équilibre : la barre penche toute seule. Incline le téléphone (ou glisse le doigt) pour la garder dans le vert 3 s. Au-delà de 25°, elle tombe.', 'Conseil : verrouille la rotation de l\'écran. Classement à la meilleure barre.'],
  arc: ['3 volées de 3 flèches sur une cible de 10 points.', 'Garde le doigt posé pour bander l\'arc : le viseur se calme… puis se remet à trembler si tu tiens trop longtemps.', 'Relâche pour tirer. Tiens le téléphone immobile : s\'il bouge, le viseur tremble plus. Attention au vent.', 'Classement au total des points.'],
  ski: ['Slalom de 20 portes.', 'Incline le téléphone à gauche ou à droite pour tourner (ou glisse le doigt sur la piste).', 'Passe entre les deux drapeaux de chaque porte. Porte manquée = +2 s.', 'Classement au temps.'],
  marteau: ['3 essais, le meilleur compte.', 'Fais des cercles sur la roue, de plus en plus vite : la vitesse donne la distance.', 'Lève le doigt quand la boule est dans la zone verte (en haut). Ailleurs = dans la cage, essai nul. Minimum 3 tours.', 'Classement à la meilleure distance.'],
  escalade: ['Mur de vitesse de 15 m, 20 prises.', 'La prise suivante s\'allume à gauche ou à droite : tape le bon côté.', 'Mauvais côté = tu glisses d\'une prise et tu es bloqué un instant.', 'Classement au temps.'],
  judo: ['Duel de réflexes, au meilleur des 5 manches.', 'Attends le signal « HAJIME ! » puis tape le plus vite possible.', 'Taper avant le signal = faux départ, point perdu.', 'Victoire = 10 pts, défaite = 8 pts.'],
};
let gameStarted = false;

function renderEvent() {
  const cur = S.current, ev = S.events[cur.event];
  runningGameId = cur.id;
  gameStarted = false;
  removeWait();
  const strip = recordStrip(cur.event);
  app.innerHTML = `
    <div class="title" style="margin-top:6px">Épreuve ${cur.index + 1}/${cur.count}</div>
    <h1 class="logo" style="margin:10px 0 14px;font-size:44px">${esc(ev.name)}</h1>
    <div class="card"><h2>Règles</h2><ul class="rules">${RULES[cur.event].map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
    <div id="rec"></div>
    <div class="card" id="rdy"></div>
    <button id="ready">✔ J'ai compris, prêt !</button>`;
  if (strip) document.getElementById('rec').append(strip);
  scene3d.setEvent(cur.event);
  document.getElementById('ready').onclick = () => { sound.unlock(); sfx('tick'); if (['haltero', 'arc', 'ski'].includes(cur.event)) requestSensors(); socket.emit('ready'); };
  updateRules();
  if (cur.go) startGame();
}
function updateRules() {
  const el = document.getElementById('rdy'); if (!el) return;
  const ready = new Set(S.current.ready || []);
  const connected = S.players.filter((p) => p.connected);
  el.innerHTML = `<h2>Prêts : ${connected.filter((p) => ready.has(p.id)).length}/${connected.length}</h2><div class="flags">${connected.map((p) => `<span class="rd ${ready.has(p.id) ? 'ok' : ''}" title="${esc(p.name)}">${country(p.country).flag}</span>`).join('')}</div>`;
  const b = document.getElementById('ready');
  if (b && ready.has(pid)) { b.disabled = true; b.textContent = 'En attente des autres…'; }
}

function startGame() {
  const cur = S.current, ev = S.events[cur.event];
  gameStarted = true;
  gameMsgHandler = null; gameInbox = [];
  app.innerHTML = `<div class="game" id="g"></div>`;
  const root = document.getElementById('g');
  const head = document.createElement('div');
  head.className = 'title';
  head.textContent = `Épreuve ${cur.index + 1}/${cur.count} · ${ev.name}`;
  const box = document.createElement('div');
  box.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:6px;min-height:0';
  const strip = recordStrip(cur.event);
  root.append(...(strip ? [head, strip, box] : [head, box]));
  gameProgs = {};
  const ctx = {
    me: pid,
    current: cur,
    name: (id) => player(id)?.name || '?',
    color: (id) => country(player(id)?.country).color,
    players: S.players.filter((p) => p.connected).map((p) => ({ id: p.id, name: esc(p.name), flag: country(p.country).flag, color: country(p.country).color })),
    get progs() { return gameProgs; },
    prog: (v) => { gameProgs[pid] = v; socket.emit('prog', { v }); scene3d.setProg(pid, v); },
    send: (d) => socket.emit('curl', d),
    onMsg: (fn) => { gameMsgHandler = fn; const q = gameInbox; gameInbox = []; q.forEach(fn); },
    finish: (score, detail) => {
      if (myResult || runningGameId !== cur.id) return;
      const rec = RECORDS[cur.event];
      let flag = '';
      if (rec) {
        const v = rawValue(cur.event, score);
        const pb = Number(store.get('bg_pb_' + cur.event)) || null;
        if (v > 0 && better(rec, v, rec.value)) flag = 'wr';
        else if (v > 0 && better(rec, v, pb)) flag = 'pb';
        if (v > 0 && better(rec, v, pb)) store.set('bg_pb_' + cur.event, String(v));
        if (flag === 'wr') detail += ' 🔥 RECORD';
      }
      myResult = { score, detail, flag };
      sfx(flag ? 'fanfare' : 'crowd'); buzz([60, 40, 60]);
      socket.emit('result', { score, detail });
      scene3d.cheer(pid);
      setTimeout(updateWait, 900);
    },
  };
  scene3d.setEvent(cur.event);
  GAMES[cur.event](box, ctx);
}
function updateWait() {
  if (!myResult || S.phase !== 'event') return;
  let w = document.getElementById('wait');
  if (!w) { w = document.createElement('div'); w.id = 'wait'; w.className = 'card wait'; document.body.appendChild(w); }
  const connected = S.players.filter((p) => p.connected);
  const done = connected.filter((p) => S.done.includes(p.id)).length;
  const nr = myResult.flag === 'wr' ? '<div class="newrec">🔥 Nouveau record ' + (RECORDS[S.current.event]?.world ? 'du monde' : 'Zozz’lympique') + ' !</div>'
    : myResult.flag === 'pb' ? '<div class="newrec">Record perso battu !</div>' : '';
  w.innerHTML = nr + `<b>Terminé : ${esc(myResult.detail || '')}</b><div class="muted">En attente des autres… ${done}/${connected.length}</div>`;
}
const removeWait = () => document.getElementById('wait')?.remove();

const MEDAL = ['🥇', '🥈', '🥉'];
function podiumHTML(groups, cls = '') {
  const cols = ['#ffd75e', '#c9d3e3', '#f4b48a'];
  const step = (r, h) => {
    const list = groups[r] || [];
    if (!list.length) return '<div class="step"></div>';
    return `<div class="step"><div class="fl">${list.map((x) => country(x.p.country).flag).join('')}</div>
      <div class="who">${list.map((x) => esc(x.p.name)).join('<br>')}<br><span style="font-weight:600">${esc(list[0].sub)}</span></div>
      <div class="block" style="height:${h}px;background:${cols[r]}">${r + 1}</div></div>`;
  };
  return `<div class="podium ${cls}">${step(1, 80)}${step(0, 120)}${step(2, 55)}</div>`;
}
let revealView = null;
// Photo-finish : les 3 premiers à l'instant où le vainqueur franchit la ligne
function drawPhotoFinish(cv, top) {
  const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, fx = W * 0.72, pxs = 1100; // pixels par seconde d'écart
  g.fillStyle = '#ffb6cf'; g.fillRect(0, 0, W, H);
  for (let x = fx % 22 - 22; x < W; x += 22) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, 0, 1, H); }
  for (let y = 0, k = 0; y < H; y += 8, k++) { g.fillStyle = k % 2 ? '#2a1638' : '#fff'; g.fillRect(fx - 3, y, 6, 8); }
  const lane = H / top.length;
  top.forEach((x, i) => {
    const p = player(x.id); if (!p) return;
    const dt = Math.abs(x.score - top[0].score), cx = fx - dt * pxs + 4, cy = lane * i + lane / 2, rr = Math.min(lane * 0.36, 20);
    g.fillStyle = country(p.country).color; g.beginPath(); g.ellipse(cx - rr, cy, rr, rr * 0.9, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - rr * 0.6, cy - rr * 0.1, rr * 0.2, 0, 7); g.fill();
    g.fillStyle = '#2a1638'; g.beginPath(); g.arc(cx - rr * 0.52, cy - rr * 0.08, rr * 0.1, 0, 7); g.fill();
    g.font = '800 11px Unbounded, sans-serif'; g.textAlign = 'left';
    g.fillText(`${i + 1}. ${p.name.slice(0, 10)}`, 6, cy - 4);
    g.font = '600 12px Barlow, sans-serif'; g.fillText(i ? `+${dt.toFixed(2).replace('.', ',')} s` : (x.detail || ''), 6, cy + 12);
  });
}
function renderReveal() {
  removeWait();
  const r = S.reveal, key = S.current?.id + ':' + r.event;
  if (!revealView || revealView.key !== key) {
    revealView = { key, step: 'podium' };
    clearTimeout(renderReveal.t);
    renderReveal.t = setTimeout(() => { if (revealView.key === key && revealView.step === 'podium') { revealView.step = 'ranking'; if (S.phase === 'reveal') renderReveal(); } }, 6000);
  }
  const host = S.hostId === pid;
  const last = S.index >= S.program.length - 1;
  const duel = S.events[r.event].type === 'duel';
  const ev = S.events[r.event];
  const hostBtns = host ? `<button id="next">${last ? '🏆 Podium final' : '▶️ Épreuve suivante'}</button>${!last ? '<button class="alt" id="pod">Terminer maintenant</button>' : ''}`
    : '<div class="card muted">L\'hôte lance la suite…</div>';
  if (revealView.step === 'podium') {
    const groups = [[], [], []];
    if (duel) for (const x of r.ranking) { if (x.rank === 1) groups[0].push({ p: player(x.id), sub: '+10 pts' }); }
    else for (const x of r.ranking) if (x.rank && x.rank <= 3 && player(x.id)) groups[x.rank - 1].push({ p: player(x.id), sub: x.detail || '' });
    const meRow = r.ranking.find((x) => x.id === pid);
    const RACE = ['sprint', 'haies', 'cyclisme', 'natation', 'aviron', 'ski', 'escalade'];
    const top = r.ranking.filter((x) => x.score != null).slice(0, 3);
    const pf = RACE.includes(r.event) && top.length >= 2 && Math.abs(top[0].score - top[1].score) <= 0.15;
    app.innerHTML = `
      <div class="title" style="margin-top:6px">Résultats</div>
      <h1 class="logo" style="margin:8px 0 12px;font-size:40px">${esc(ev.name)}</h1>
      ${pf ? '<div class="card pfcard"><h2>📸 Photo-finish</h2><canvas id="pf"></canvas></div>' : ''}
      <div class="card">${duel ? '<h2 style="text-align:center">Vainqueurs des duels</h2>' : ''}${podiumHTML(groups)}</div>
      ${meRow ? `<div class="card dark" style="text-align:center"><h2 style="margin:0">Toi : ${meRow.rank ? (duel ? (meRow.rank === 1 ? 'victoire' : 'défaite') : meRow.rank + (meRow.rank === 1 ? 'er' : 'e')) : '—'} · ${esc(meRow.detail || '')} · +${meRow.pts} pts</h2></div>` : ''}
      <button class="ghost" id="seeRank">📊 Classement provisoire</button>`;
    scene3d.setEvent('reveal', r.ranking.slice(0, 3).map((x) => x.id));
    document.getElementById('seeRank').onclick = () => { revealView.step = 'ranking'; renderReveal(); };
    if (pf) drawPhotoFinish(document.getElementById('pf'), top);
    if (!revealView.sang) { revealView.sang = true; sfx(pf ? 'tick' : 'fanfare'); if (pf) setTimeout(() => sfx('fanfare'), 400); }
    return;
  }
  // classement provisoire avec évolution des places
  const prevTotal = Object.fromEntries(r.ranking.map((x) => [x.id, x.pts]));
  const rankOf = (arr, val) => { const sorted = [...arr].sort((a, b) => b.v - a.v); const m = new Map(); let rk = 0; sorted.forEach((x, i) => { if (i === 0 || x.v !== sorted[i - 1].v) rk = i; m.set(x.id, rk); }); return m; };
  const now = rankOf(S.players.map((p) => ({ id: p.id, v: p.total })));
  const before = rankOf(S.players.map((p) => ({ id: p.id, v: p.total - (prevTotal[p.id] || 0) })));
  const rows = [...S.players].sort((a, b) => b.total - a.total).map((p) => {
    const d = before.get(p.id) - now.get(p.id);
    const mv = S.index === 0 ? '' : d > 0 ? `<span class="move up">▲${d}</span>` : d < 0 ? `<span class="move down">▼${-d}</span>` : '<span class="move">=</span>';
    const pts = prevTotal[p.id] ? ` <span style="opacity:.6;font-size:14px">(+${prevTotal[p.id]})</span>` : '';
    return playerRow(p, `${MEDAL[now.get(p.id)] || now.get(p.id) + 1 + 'e'} · ${p.total} pts${pts}`).replace('<span class="dot"', mv + '<span class="dot"');
  }).join('');
  app.innerHTML = `
    <div class="title" style="margin-top:6px">Après ${S.index + 1} épreuve${S.index ? 's' : ''} sur ${S.program.length}</div>
    <div class="card" style="margin-top:10px"><h2>Classement provisoire</h2><div class="players">${rows}</div></div>
    <button class="ghost" id="seePod">🏅 Revoir le podium</button>
    ${hostBtns}`;
  scene3d.setEvent('reveal', [...S.players].sort((a, b) => b.total - a.total).slice(0, 3).map((p) => p.id));
  document.getElementById('seePod').onclick = () => { revealView.step = 'podium'; renderReveal(); };
  const n = document.getElementById('next'); if (n) n.onclick = () => socket.emit('next');
  const p = document.getElementById('pod'); if (p) p.onclick = () => socket.emit('podium');
}

function renderFinal() {
  removeWait();
  const host = S.hostId === pid;
  const sorted = [...S.players].sort((a, b) => b.total - a.total);
  // rangs avec égalités
  let rank = 0;
  const ranked = sorted.map((p, i) => { if (i === 0 || p.total !== sorted[i - 1].total) rank = i; return { p, rank }; });
  const step = (r, h) => {
    const list = ranked.filter((x) => x.rank === r);
    if (!list.length) return '<div class="step"></div>';
    const cols = ['#ffd75e', '#c9d3e3', '#f4b48a'];
    return `<div class="step"><div class="fl">${list.map((x) => country(x.p.country).flag).join('')}</div>
      <div class="who">${list.map((x) => esc(x.p.name)).join('<br>')}<br>${list[0].p.total} pts</div>
      <div class="block" style="height:${h}px;background:${cols[r]}">${r + 1}</div></div>`;
  };
  app.innerHTML = `
    <h1 class="logo" style="margin-top:2vh;font-size:36px">Podium final</h1>
    <div class="card"><div class="podium">${step(1, 90)}${step(0, 130)}${step(2, 65)}</div></div>
    <div class="card"><div class="players">${ranked.map(({ p, rank }) => playerRow(p, `${MEDAL[rank] || rank + 1 + 'e'} · ${p.total} pts`)).join('')}</div></div>
    ${medalTable()}
    ${host ? '<button id="lobby">🔁 Retour au lobby</button>' : '<div class="card muted">Bravo à tous ! L\'hôte relance la partie.</div>'}
    <button class="ghost" id="quit">Quitter la partie</button>`;
  document.getElementById('quit').onclick = () => { socket.emit('leave'); store.del('bg_room'); S = null; history.replaceState(null, '', location.pathname); render(); };
  scene3d.setEvent('final', ranked.filter((x) => x.rank < 3).map((x) => x.p.id));
  const l = document.getElementById('lobby'); if (l) l.onclick = () => socket.emit('toLobby');
}

/* ---------- Scène 3D de fond ---------- */
const scene3d = (() => {
  const canvas = document.getElementById('bg');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xfff1f5, 18, 60);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd6e3, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(5, 10, 6); scene.add(sun);
  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), M(0xffb6cf, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  // Stade : piste ovale à couloirs + tribunes, toujours présent
  const stadium = new THREE.Group(); scene.add(stadium);
  for (let i = 0; i <= 6; i++) {
    const r = 9 + i * 0.9;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r + 0.05, 96), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.01, -2); ring.scale.set(1.6, 1, 1); stadium.add(ring);
  }
  const infield = new THREE.Mesh(new THREE.CircleGeometry(8.9, 64), M(0x9ee6cf, { roughness: 1 }));
  infield.rotation.x = -Math.PI / 2; infield.position.set(0, 0.005, -2); infield.scale.set(1.6, 1, 1); stadium.add(infield);
  const crowdCols = [0xe8456b, 0x9ee6cf, 0xffd75e, 0xfff1f5, 0xc9b8ff];
  for (let k = 0; k < 3; k++) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(40, 1.2, 2), M(0x2a1638));
    stand.position.set(0, 0.6 + k * 1.2, -18 - k * 2); stadium.add(stand);
    for (let i = 0; i < 40; i++) {
      const fan = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), M(crowdCols[(i + k) % 5]));
      fan.position.set(-19.5 + i, 1.45 + k * 1.2, -18 - k * 2); fan.userData.fan = Math.random() * 6; stadium.add(fan);
    }
  }
  const deco = new THREE.Group(); scene.add(deco);
  const slimes = new Map();
  let event = 'lobby', top = [], progs = {};
  const bodyGeo = new THREE.SphereGeometry(0.5, 32, 24);
  const eyeGeo = new THREE.SphereGeometry(0.09, 12, 8), pupGeo = new THREE.SphereGeometry(0.05, 10, 8);
  const white = M(0xffffff), ink = M(0x2a1638), pink = M(0xe8456b), mint = M(0x9ee6cf), gold = M(0xffcf4a, { metalness: 0.6, roughness: 0.3 });

  function makeSlime(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, mat); body.scale.set(0.95, 0.95, 0.95); body.position.y = 0.55; g.add(body);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, white); e.position.set(s * 0.16, 0.7, 0.42); g.add(e);
      const p = new THREE.Mesh(pupGeo, ink); p.position.set(s * 0.16, 0.7, 0.5); g.add(p);
      // baskets
      const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 4, 10), white);
      shoe.rotation.x = Math.PI / 2; shoe.position.set(s * 0.2, 0.09, 0.06); g.add(shoe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.36), pink);
      sole.position.set(s * 0.2, 0.02, 0.06); g.add(sole);
    }
    const acc = new THREE.Group(); g.add(acc);
    g.userData = { body, acc, phase: Math.random() * 6, jump: 0, target: new THREE.Vector3(), accFor: null };
    scene.add(g); return g;
  }

  // Accessoire selon l'épreuve
  function accessory(kind, i) {
    const a = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); a.add(m); return m; };
    if (kind === 'sprint') { // bandeau éponge + dossard
      add(new THREE.TorusGeometry(0.44, 0.06, 10, 32), white, 0, 0.85, 0, Math.PI / 2);
      add(new THREE.TorusGeometry(0.445, 0.025, 8, 32), pink, 0, 0.85, 0, Math.PI / 2);
      bib(a, i);
    } else if (kind === 'tir') { // casquette + lunettes de tir
      add(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), ink, 0, 0.9, 0);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24, 1, false, -Math.PI / 2, Math.PI), ink, 0, 0.92, 0.25);
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), M(0xffcf4a, { transparent: true, opacity: 0.75 }), s * 0.16, 0.72, 0.5, Math.PI / 2);
    } else if (kind === 'hauteur') { // dossard + poignets
      bib(a, i);
      add(new THREE.TorusGeometry(0.44, 0.04, 8, 32), mint, 0, 0.85, 0, Math.PI / 2);
      for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.08, 0.04, 8, 16), mint, s * 0.5, 0.45, 0, 0, Math.PI / 2);
    } else if (kind === 'hiphop') { // casquette à l'envers + casque audio
      add(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), pink, 0, 0.9, 0);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24, 1, false, Math.PI / 2, Math.PI), pink, 0, 0.92, -0.25);
      add(new THREE.TorusGeometry(0.47, 0.03, 8, 32, Math.PI), ink, 0, 0.6, 0);
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16), ink, s * 0.47, 0.6, 0, 0, 0, Math.PI / 2);
    } else if (kind === 'curling') { // bonnet à pompon + balai
      add(new THREE.SphereGeometry(0.43, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2a1638), 0, 0.82, 0);
      add(new THREE.TorusGeometry(0.42, 0.06, 10, 32), white, 0, 0.83, 0, Math.PI / 2);
      add(new THREE.SphereGeometry(0.11, 12, 10), white, 0, 1.28, 0);
      add(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8), M(0xe39a62), 0.55, 0.6, 0.1, 0, 0, 0.3);
      add(new THREE.BoxGeometry(0.3, 0.08, 0.12), pink, 0.72, 0.04, 0.1);
    } else if (kind === 'helmet') { // casque
      add(new THREE.SphereGeometry(0.47, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0xffcf4a), 0, 0.78, -0.02).scale.set(1, 0.9, 1.15);
      add(new THREE.BoxGeometry(0.5, 0.05, 0.12), ink, 0, 0.82, 0.42);
    } else if (kind === 'swim') { // bonnet + lunettes
      add(new THREE.SphereGeometry(0.47, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), pink, 0, 0.75, 0);
      for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.09, 0.03, 8, 16), M(0x4dabf7), s * 0.16, 0.7, 0.47);
    } else if (kind === 'band') { // bandeau sport + maillot
      add(new THREE.TorusGeometry(0.44, 0.05, 10, 32), mint, 0, 0.85, 0, Math.PI / 2);
      bib(a, i);
    } else if (kind === 'scrum') { // casque de mêlée
      add(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2a1638), 0, 0.78, 0);
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), M(0x2a1638), s * 0.46, 0.62, 0, 0, 0, Math.PI / 2);
    } else if (kind === 'mask') { // masque d'escrime + fleuret
      add(new THREE.SphereGeometry(0.4, 20, 14, -Math.PI / 2, Math.PI), M(0x1f2140, { wireframe: true }), 0, 0.62, 0.12);
      add(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), M(0xc9d3e3, { metalness: 0.8 }), 0.55, 0.5, 0.35, 1.1, 0, 0);
    } else if (kind === 'visor') { // visière de golf
      add(new THREE.TorusGeometry(0.43, 0.04, 8, 32), white, 0, 0.88, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 24, 1, false, -Math.PI / 2, Math.PI), M(0xffcf4a), 0, 0.88, 0.26);
    } else if (kind === 'podium') { // médaille
      add(new THREE.TorusGeometry(0.36, 0.02, 6, 24, Math.PI), pink, 0, 0.62, 0.15, Math.PI * 0.6, 0, Math.PI);
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 20), gold, 0, 0.4, 0.5, Math.PI / 2);
    } else { // lobby : bandeau aux couleurs du jeu
      add(new THREE.TorusGeometry(0.44, 0.05, 10, 32), pink, 0, 0.85, 0, Math.PI / 2);
    }
    return a;
  }
  function bib(a, i) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 48;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 48);
    x.fillStyle = '#e8456b'; x.fillRect(0, 0, 64, 8);
    x.fillStyle = '#2a1638'; x.font = 'italic 900 30px sans-serif'; x.textAlign = 'center'; x.fillText(String(i + 1), 32, 42);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    m.position.set(0, 0.42, 0.47); m.rotation.x = 0.25; a.add(m);
  }
  function dressAll() {
    let i = 0;
    for (const [id, m] of slimes) {
      const ACC = { haies: 'sprint', longueur: 'sprint', aviron: 'tir', basket: 'band', handball: 'band', football: 'band', cyclisme: 'helmet', skate: 'helmet', natation: 'swim', rugby: 'scrum', escrime: 'mask', golf: 'visor' };
      const kind = (event === 'final' || event === 'reveal') ? (top.includes(id) ? 'podium' : 'lobby') : (ACC[event] || event);
      const key = kind + ':' + i;
      if (m.userData.accFor !== key) {
        m.remove(m.userData.acc);
        m.userData.acc = accessory(kind, i); m.add(m.userData.acc); m.userData.accFor = key;
      }
      i++;
    }
  }
  function sync() {
    const list = S ? S.players : [];
    const ids = new Set(list.map((p) => p.id));
    for (const [id, m] of slimes) if (!ids.has(id)) { scene.remove(m); slimes.delete(id); }
    for (const p of list) {
      let m = slimes.get(p.id);
      const col = country(p.country).color;
      if (!m) { m = makeSlime(col); slimes.set(p.id, m); m.userData.col = col; }
      if (m.userData.col !== col) { m.userData.body.material.color.set(col); m.userData.col = col; }
    }
    if (!S) setEvent('home'); else if (S.phase === 'lobby') setEvent('lobby');
    dressAll(); layout();
  }
  const THEMES = { sprint: 0xffb6cf, haies: 0xffb6cf, longueur: 0xf3d9a4, tir: 0xb9ecd9, hauteur: 0xffd0a8, hiphop: 0xd9c8ff, curling: 0xeaf6ff, cyclisme: 0xe9b98a, natation: 0x7fd3f5, aviron: 0x5fb3e3, football: 0x7fd6a3, rugby: 0x9fe3b8, golf: 0x6fd3a8, basket: 0xe9b98a, handball: 0xe9b98a, escrime: 0xc9d3e3, skate: 0xc9d3e3 };
  function setEvent(e, t = []) {
    if (e !== event) progs = {};
    event = e; top = t;
    ground.material.color.set(THEMES[e] ?? 0xffb6cf);
    stadium.visible = false; // direction « affiche » : décor 3D épuré
    if (e === 'final') ground.material.color.set(0xffd6e3);
    deco.clear();
    if (e === 'curling') {
      [[3, 0x4dabf7], [2, 0xffffff], [1, 0xff6b9a]].forEach(([r, c], i) => {
        const d = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: c }));
        d.rotation.x = -Math.PI / 2; d.position.set(0, 0.03 + i * 0.005, -6); deco.add(d);
      });
    }
    if (e === 'hauteur') {
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), white); p.position.set(s * 2.5, 1.2, -5); deco.add(p); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5, 8), pink); bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.2, -5); deco.add(bar);
      const mat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 2.5), M(0x2a1638)); mat.position.set(0, 0.25, -6.6); deco.add(mat);
    }
    if (e === 'tir') {
      for (let i = 0; i < 5; i++) {
        const tg = new THREE.Group();
        [[0.5, 0xffffff], [0.36, 0xf25c94], [0.22, 0xffffff], [0.1, 0x1f2140]].forEach(([r, c], k) => {
          const d = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: c })); d.position.z = k * 0.002; tg.add(d);
        });
        tg.position.set((i - 2) * 1.4, 1.6, -7); deco.add(tg);
      }
    }
    if (e === 'final' || e === 'reveal') {
      [[0, 1.2, 0xffcf4a], [-1.5, 0.8, 0xc9d3e3], [1.5, 0.5, 0xe39a62]].forEach(([x, h, c]) => {
        const blk = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.2), M(c)); blk.position.set(x, h / 2, -1); deco.add(blk);
      });
    }
    dressAll(); layout();
  }
  function setProg(id, v) { progs[id] = v; if (event === 'sprint') layout(); }
  function cheer(id) { const m = slimes.get(id); if (m) m.userData.jump = 1; }
  function layout() {
    const arr = [...slimes.entries()];
    const n = arr.length;
    arr.forEach(([id, m], i) => {
      const t = m.userData.target;
      if (event === 'sprint') t.set((i - (n - 1) / 2) * 1.2, 0, -(progs[id] || 0) * 50);
      else if (event === 'final' || event === 'reveal') {
        const k = top.indexOf(id);
        const spots = [[0, 1.2], [-1.5, 0.8], [1.5, 0.5]];
        if (k >= 0) t.set(spots[k][0], spots[k][1], -1);
        else t.set(((i % 8) - 3.5) * 1.1, 0, 1.5 + Math.floor(i / 8) * 1.1);
      } else {
        // en ligne, comme sur une ligne de départ
        const perRow = 8, row = Math.floor(i / perRow), col = i % perRow, cnt = Math.min(perRow, n - row * perRow);
        t.set((col - (cnt - 1) / 2) * 1.15, 0, -row * 1.3);
      }
    });
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  let last = performance.now();
  const camT = new THREE.Vector3(), look = new THREE.Vector3();
  function loop(t) {
    // la 3D n'est visible qu'au podium final : on ne calcule rien le reste du temps (batterie)
    if (document.body.dataset.phase !== 'final') { last = t; requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (event === 'sprint') { const me = slimes.get(pid); const z = me ? me.position.z : 0; camT.set(6, 2.5, z + 3); look.set(0, 0.5, z - 3); }
    else if (event === 'final' || event === 'reveal') { camT.set(0, 2.6, 6); look.set(0, 1, -1); }
    else { camT.set(Math.sin(t / 7000) * 1.5, 2.6, 6.5); look.set(0, 0.6, -1); }
    cam.position.lerp(camT, 1 - Math.exp(-dt * 3)); cam.lookAt(look);
    for (const [, m] of slimes) {
      const u = m.userData;
      m.position.x += (u.target.x - m.position.x) * (1 - Math.exp(-dt * (event === 'sprint' ? 8 : 3)));
      m.position.z += (u.target.z - m.position.z) * (1 - Math.exp(-dt * (event === 'sprint' ? 8 : 3)));
      u.phase += dt * (event === 'sprint' ? 14 : 4);
      const w = Math.sin(u.phase);
      u.body.scale.set(0.95 + w * 0.04, 0.95 - w * 0.05, 0.95 + w * 0.04);
      if (u.jump > 0) { u.jump -= dt * 0.8; m.position.y = u.target.y + Math.abs(Math.sin(u.jump * 12)) * 0.8; }
      else m.position.y = u.target.y + Math.max(0, w) * (event === 'final' ? 0.3 : 0.04);
      m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z);
    }
    for (const f of stadium.children) if (f.userData.fan !== undefined) f.position.y += Math.sin(t / 250 + f.userData.fan) * dt * 0.6;
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return { sync, setEvent, setProg, cheer };
})();

// Démarrage
if (window.OFFLINE || typeof window.io !== 'function') { window.OFFLINE = true; socket = window.makeBotSocket(); bindSocket(socket); }
else { socket = window.io(); bindSocket(socket); }
render();
if ('serviceWorker' in navigator && !window.OFFLINE_ONLY && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
