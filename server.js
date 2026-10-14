// Bubblegame — serveur de partie (Express + Socket.IO)
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.send('ok'));
const server = http.createServer(app);
const io = new Server(server);

const COUNTRIES = [
  { code: 'FR', name: 'France', flag: '🇫🇷', color: '#3d6bff' },
  { code: 'BR', name: 'Brésil', flag: '🇧🇷', color: '#ffd43b' },
  { code: 'JP', name: 'Japon', flag: '🇯🇵', color: '#ff7eb6' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸', color: '#23308f' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪', color: '#3b3b3b' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹', color: '#1fbf5f' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸', color: '#e63946' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', color: '#f1f1f1' },
  { code: 'AU', name: 'Australie', flag: '🇦🇺', color: '#ff9f1c' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', color: '#8d5524' },
  { code: 'CN', name: 'Chine', flag: '🇨🇳', color: '#a4161a' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', color: '#9d4edd' },
  { code: 'AR', name: 'Argentine', flag: '🇦🇷', color: '#74c0fc' },
  { code: 'SE', name: 'Suède', flag: '🇸🇪', color: '#b5e550' },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦', color: '#0b6e4f' },
  { code: 'NZ', name: 'Nouvelle-Zélande', flag: '🇳🇿', color: '#2ec4b6' },
];

// Les 17 épreuves
const EVENTS = {
  sprint: { name: '100 m', type: 'solo' },
  haies: { name: '110 m haies', type: 'solo' },
  cyclisme: { name: 'Cyclisme sur piste', type: 'solo' },
  natation: { name: 'Natation 4 nages', type: 'solo' },
  aviron: { name: 'Aviron', type: 'solo' },
  hauteur: { name: 'Saut en hauteur', type: 'solo' },
  longueur: { name: 'Saut en longueur', type: 'solo' },
  tir: { name: 'Tir de vitesse', type: 'solo' },
  curling: { name: 'Curling', type: 'duel' },
  football: { name: 'Football', type: 'duel' },
  skate: { name: 'Skateboard', type: 'solo' },
  basket: { name: 'Basketball', type: 'solo' },
  handball: { name: 'Handball', type: 'duel' },
  rugby: { name: 'Rugby', type: 'solo' },
  escrime: { name: 'Escrime', type: 'duel' },
  golf: { name: 'Mini-golf', type: 'solo' },
  haltero: { name: 'Haltérophilie', type: 'solo' },
  arc: { name: "Tir à l'arc", type: 'solo' },
  ski: { name: 'Ski slalom', type: 'solo' },
  marteau: { name: 'Lancer du marteau', type: 'solo' },
  escalade: { name: 'Escalade', type: 'solo' },
  judo: { name: 'Judo', type: 'duel' },
  hiphop: { name: 'Hip-Hop', type: 'solo' },
};
const MODES = {
  libre: { name: 'Jeu libre', count: 1 },
  penta: { name: 'Pentathlon', count: 5 },
  hepta: { name: 'Heptathlon', count: 7 },
  deca: { name: 'Décathlon', count: 10 },
  jo: { name: 'Mode J.O.', count: Infinity },
};
const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const MAX_PLAYERS = 16;

const rooms = new Map();

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join('');
  while (rooms.has(c));
  return c;
}

function publicState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    mode: room.mode,
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, country: p.country, total: p.total, medals: p.medals || [0, 0, 0], connected: p.connected,
    })),
    program: room.program,
    index: room.index,
    current: room.current ? { ...room.current, ready: [...(room.ready || [])] } : null,
    done: Object.keys(room.results || {}),
    reveal: room.reveal,
    countries: COUNTRIES,
    events: EVENTS,
    modes: MODES,
  };
}

function emitState(room) {
  io.to(room.code).emit('state', publicState(room));
}

function freeCountry(room) {
  const used = new Set([...room.players.values()].map((p) => p.country));
  return COUNTRIES.find((c) => !used.has(c.code))?.code;
}

function startEvent(room) {
  const event = room.program[room.index];
  room.phase = 'event';
  room.results = {};
  room.details = {};
  let pairs = null;
  if (EVENTS[event].type === 'duel') {
    const ids = shuffle([...room.players.values()].filter((p) => p.connected).map((p) => p.id));
    pairs = [];
    for (let i = 0; i < ids.length; i += 2) {
      const a = ids[i];
      const b = ids[i + 1] || 'BOT';
      pairs.push({ a, b, first: Math.random() < 0.5 ? a : b });
    }
  }
  room.current = {
    id: (room.current?.id || 0) + 1,
    event,
    seed: Math.floor(Math.random() * 1e9),
    pairs,
    index: room.index,
    count: room.program.length,
  };
  room.ready = new Set();
  room.reveal = null;
  emitState(room);
}

function checkReady(room) {
  if (room.phase !== 'event' || room.current.go) return;
  const connected = [...room.players.values()].filter((p) => p.connected);
  if (connected.length && connected.every((p) => room.ready.has(p.id))) { room.current.go = true; }
}

function finishEvent(room) {
  const ev = EVENTS[room.current.event];
  const all = [...room.players.values()];
  const scored = all
    .filter((p) => room.results[p.id] !== undefined)
    .sort((a, b) => room.results[b.id] - room.results[a.id]);
  const ranking = [];
  if (ev.type === 'duel') {
    for (const p of scored) {
      const win = room.results[p.id] > 0;
      ranking.push({ id: p.id, score: room.results[p.id], detail: room.details[p.id], pts: win ? 10 : 8, rank: win ? 1 : 2 });
    }
  } else {
    let prevScore = null;
    let prevRank = 0;
    scored.forEach((p, i) => {
      const s = room.results[p.id];
      const rank = i > 0 && s === prevScore ? prevRank : i; // égalité = même place, mêmes points
      prevScore = s;
      prevRank = rank;
      ranking.push({ id: p.id, score: s, detail: room.details[p.id], pts: POINTS[rank] || 0, rank: rank + 1 });
    });
  }
  all.filter((p) => room.results[p.id] === undefined)
    .forEach((p) => ranking.push({ id: p.id, score: null, pts: 0, rank: null }));
  for (const r of ranking) { const pl = room.players.get(r.id); pl.total += r.pts; pl.medals = pl.medals || [0, 0, 0]; if (ev.type !== 'duel' && r.rank >= 1 && r.rank <= 3) pl.medals[r.rank - 1]++; }
  room.reveal = { event: room.current.event, ranking };
  room.phase = 'reveal';
  emitState(room);
}

function checkDone(room) {
  if (room.phase !== 'event') return;
  const connected = [...room.players.values()].filter((p) => p.connected);
  if (connected.length === 0) return;
  if (connected.every((p) => room.results[p.id] !== undefined)) finishEvent(room);
}

function opponentOf(room, pid) {
  const pair = room.current?.pairs?.find((p) => p.a === pid || p.b === pid);
  if (!pair) return null;
  return pair.a === pid ? pair.b : pair.a;
}

io.on('connection', (socket) => {
  const ctx = () => {
    const room = rooms.get(socket.data.room);
    const player = room?.players.get(socket.data.pid);
    return { room, player };
  };

  function joinRoom(room, pid, name) {
    let p = room.players.get(pid);
    if (!p) {
      p = { id: pid, name: String(name || 'Joueur').slice(0, 16), country: freeCountry(room), total: 0 };
      room.players.set(pid, p);
    }
    p.connected = true;
    p.socketId = socket.id;
    socket.data.room = room.code;
    socket.data.pid = pid;
    socket.join(room.code);
    if (!room.players.get(room.hostId)?.connected) room.hostId = pid;
    clearTimeout(room.cleanup);
    emitState(room);
  }

  socket.on('create', ({ name, pid }) => {
    if (!pid) return;
    const code = newCode();
    const room = { code, hostId: pid, phase: 'lobby', mode: null, players: new Map(), program: [], index: 0, current: null, results: {}, reveal: null };
    rooms.set(code, room);
    joinRoom(room, pid, name);
  });

  socket.on('join', ({ code, name, pid, silent }) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    const fail = (msg) => socket.emit('err', { msg, silent: !!silent });
    if (!room || !pid) return fail('Partie introuvable');
    if (!room.players.has(pid)) {
      if (room.phase !== 'lobby') return fail('La partie a déjà commencé');
      if (room.players.size >= MAX_PLAYERS) return fail('Partie complète (16 joueurs max)');
    }
    joinRoom(room, pid, name);
  });

  socket.on('leave', () => {
    const { room, player } = ctx();
    if (!room || !player) return;
    socket.leave(room.code);
    if (room.phase === 'lobby') room.players.delete(player.id);
    else player.connected = false;
    socket.data.room = null;
    if (room.hostId === player.id) {
      const next = [...room.players.values()].find((p) => p.connected);
      if (next) room.hostId = next.id;
    }
    if (room.players.size === 0) rooms.delete(room.code);
    else { checkReady(room); checkDone(room); emitState(room); }
  });

  socket.on('country', ({ code }) => {
    const { room, player } = ctx();
    if (!room || !player || room.phase !== 'lobby') return;
    if (!COUNTRIES.some((c) => c.code === code)) return;
    if ([...room.players.values()].some((p) => p.country === code && p.id !== player.id)) return;
    player.country = code;
    emitState(room);
  });

  socket.on('start', ({ mode, event }) => {
    const { room, player } = ctx();
    if (!room || !player || room.hostId !== player.id) return;
    if (!['lobby', 'final'].includes(room.phase)) return;
    if (!MODES[mode]) return;
    if (room.phase === 'final') for (const p of room.players.values()) { p.total = 0; p.medals = [0, 0, 0]; }
    const all = Object.keys(EVENTS);
    if (mode === 'libre') {
      if (!EVENTS[event]) return;
      room.program = [event];
    } else {
      room.program = shuffle(all).slice(0, Math.min(MODES[mode].count, all.length));
    }
    room.mode = mode;
    room.index = 0;
    startEvent(room);
  });

  socket.on('ready', () => {
    const { room, player } = ctx();
    if (!room || !player || room.phase !== 'event') return;
    room.ready.add(player.id);
    checkReady(room);
    emitState(room);
  });

  socket.on('result', ({ score, detail }) => {
    const { room, player } = ctx();
    if (!room || !player || room.phase !== 'event') return;
    if (typeof score !== 'number' || !isFinite(score)) return;
    if (room.results[player.id] !== undefined) return;
    room.results[player.id] = score;
    room.details[player.id] = typeof detail === 'string' ? detail.slice(0, 40) : undefined;
    emitState(room);
    checkDone(room);
  });

  // Progression live (100 m)
  socket.on('prog', ({ v }) => {
    const { room, player } = ctx();
    if (!room || !player) return;
    socket.to(room.code).volatile.emit('prog', { id: player.id, v: Math.max(0, Math.min(1, Number(v) || 0)) });
  });

  // Relais curling entre les deux joueurs d'un duel
  socket.on('curl', (data) => {
    const { room, player } = ctx();
    if (!room || !player || room.phase !== 'event') return;
    const opp = opponentOf(room, player.id);
    if (!opp || opp === 'BOT') return;
    const o = room.players.get(opp);
    if (o?.socketId) io.to(o.socketId).emit('curl', data);
  });

  socket.on('next', () => {
    const { room, player } = ctx();
    if (!room || !player || room.hostId !== player.id || room.phase !== 'reveal') return;
    room.index++;
    if (room.index < room.program.length) startEvent(room);
    else { room.phase = 'final'; emitState(room); }
  });

  socket.on('toLobby', () => {
    const { room, player } = ctx();
    if (!room || !player || room.hostId !== player.id) return;
    if (!['reveal', 'final'].includes(room.phase)) return;
    if (room.phase === 'final') for (const p of room.players.values()) { p.total = 0; p.medals = [0, 0, 0]; }
    room.phase = 'lobby';
    room.reveal = null;
    room.current = { id: room.current?.id || 0 };
    for (const [id, p] of room.players) if (!p.connected) room.players.delete(id);
    emitState(room);
  });

  socket.on('podium', () => {
    const { room, player } = ctx();
    if (!room || !player || room.hostId !== player.id || room.phase !== 'reveal') return;
    room.phase = 'final';
    emitState(room);
  });

  socket.on('disconnect', () => {
    const { room, player } = ctx();
    if (!room || !player || player.socketId !== socket.id) return;
    player.connected = false;
    if (room.hostId === player.id) {
      const next = [...room.players.values()].find((p) => p.connected);
      if (next) room.hostId = next.id;
    }
    const opp = opponentOf(room, player.id);
    if (room.phase === 'event' && opp && opp !== 'BOT' && room.results[player.id] === undefined) {
      const o = room.players.get(opp);
      if (o?.socketId) io.to(o.socketId).emit('curl', { type: 'left' });
    }
    if ([...room.players.values()].every((p) => !p.connected)) {
      room.cleanup = setTimeout(() => rooms.delete(room.code), 30 * 60 * 1000);
    }
    if (room.phase === 'event') checkReady(room);
    checkDone(room);
    emitState(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Bubblegame sur http://localhost:${PORT}`));
