// Jeux Zozz’lympiques hors-ligne : un faux serveur + des bots, entièrement dans la page (aucune connexion nécessaire).
window.makeBotSocket = function () {
  const handlers = {};
  const sock = { on(e, f) { (handlers[e] ??= []).push(f); }, emit(e, d) { setTimeout(() => srv(e, d || {}), 0); }, disconnect() { clearT(); room = null; } };
  const send = (e, d) => (handlers[e] || []).forEach((f) => f(d === undefined ? d : JSON.parse(JSON.stringify(d))));
  setTimeout(() => send('connect'), 0);

  const COUNTRIES = [
    { code: 'FR', name: 'France', flag: '🇫🇷', color: '#3d6bff' }, { code: 'BR', name: 'Brésil', flag: '🇧🇷', color: '#ffd43b' },
    { code: 'JP', name: 'Japon', flag: '🇯🇵', color: '#ff7eb6' }, { code: 'US', name: 'États-Unis', flag: '🇺🇸', color: '#23308f' },
    { code: 'DE', name: 'Allemagne', flag: '🇩🇪', color: '#3b3b3b' }, { code: 'IT', name: 'Italie', flag: '🇮🇹', color: '#1fbf5f' },
    { code: 'ES', name: 'Espagne', flag: '🇪🇸', color: '#e63946' }, { code: 'CA', name: 'Canada', flag: '🇨🇦', color: '#f1f1f1' },
    { code: 'AU', name: 'Australie', flag: '🇦🇺', color: '#ff9f1c' }, { code: 'KE', name: 'Kenya', flag: '🇰🇪', color: '#8d5524' },
    { code: 'CN', name: 'Chine', flag: '🇨🇳', color: '#a4161a' }, { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', color: '#9d4edd' },
    { code: 'AR', name: 'Argentine', flag: '🇦🇷', color: '#74c0fc' }, { code: 'SE', name: 'Suède', flag: '🇸🇪', color: '#b5e550' },
    { code: 'MA', name: 'Maroc', flag: '🇲🇦', color: '#0b6e4f' }, { code: 'NZ', name: 'Nouvelle-Zélande', flag: '🇳🇿', color: '#2ec4b6' },
  ];
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
  const MODES = { libre: { name: 'Jeu libre', count: 1 }, penta: { name: 'Pentathlon', count: 5 }, hepta: { name: 'Heptathlon', count: 7 }, deca: { name: 'Décathlon', count: 10 }, jo: { name: 'Mode J.O.', count: Infinity } };
  const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
  const BOT_NAMES = ['Gloop', 'Bloby', 'Squishy', 'Gommo', 'Bulle', 'Pâtou', 'Slimo', 'Jello', 'Mochi', 'Fizz', 'Wobble', 'Chewie', 'Pop', 'Glu', 'Flubb'];
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  let room = null, timers = [];
  const clearT = () => { timers.forEach(clearTimeout); timers.forEach(clearInterval); timers = []; };

  const pub = () => ({
    code: 'BOTS', hostId: room.hostId, phase: room.phase, mode: room.mode,
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, country: p.country, total: p.total, medals: p.medals || [0, 0, 0], connected: true })),
    program: room.program, index: room.index, current: room.current ? { ...room.current, ready: [...(room.ready || [])] } : null, done: Object.keys(room.results), reveal: room.reveal,
    countries: COUNTRIES, events: EVENTS, modes: MODES,
  });
  const emit = () => send('state', pub());

  const t2 = (t) => ({ score: -Math.round(t * 100) / 100, detail: t.toFixed(2) + ' s' });
  function botResult(ev) {
    const race = { sprint: [8.5, 15], haies: [11, 20], cyclisme: [8, 16], natation: [26, 45], aviron: [14, 26], tir: [9, 18], escalade: [6.5, 12], ski: [18, 30] }[ev];
    if (race) { const t = rnd(...race); return { delay: t * 1000 + 2600, t, ...t2(t) }; }
    switch (ev) {
      case 'hauteur': { const k = Math.floor(rnd(0, 9)), f = Math.floor(rnd(3, 6)); const h = k ? 150 + (k - 1) * 10 : 0; return { delay: rnd(8, 25) * 1000, score: h * 100 - f, detail: h ? (h / 100).toFixed(2).replace('.', ',') + ' m' : '0 m' }; }
      case 'longueur': { const cm = Math.round(rnd(560, 880)); return { delay: rnd(14, 20) * 1000, score: cm, detail: (cm / 100).toFixed(2).replace('.', ',') + ' m' }; }
      case 'hiphop': { const s = Math.floor(rnd(60, 260)); return { delay: 62600, score: s, detail: s + ' pts' }; }
      case 'skate': { const n = Math.floor(rnd(1, 7)), s = n * 100 + Math.floor(rnd(0, n * 30)); return { delay: rnd(40, 70) * 1000, score: s, detail: s + ' pts' }; }
      case 'basket': case 'rugby': { const n = Math.floor(rnd(1, 6)); return { delay: rnd(14, 24) * 1000, score: n, detail: n + '/5' }; }
      case 'haltero': { const kg = 100 + 10 * Math.floor(rnd(0, 11)); return { delay: rnd(25, 60) * 1000, score: kg * 100 - Math.floor(rnd(3, 6)), detail: kg + ' kg' }; }
      case 'arc': { const s = Math.floor(rnd(40, 85)); return { delay: rnd(30, 50) * 1000, score: s, detail: s + ' pts' }; }
      case 'marteau': { const cm = Math.round(rnd(5200, 8500)); return { delay: rnd(15, 25) * 1000, score: cm, detail: (cm / 100).toFixed(2).replace('.', ',') + ' m' }; }
      case 'golf': { const n = Math.floor(rnd(5, 15)); return { delay: rnd(25, 45) * 1000, score: -n, detail: n + ' coups' }; }
    }
  }

  function startEvent() {
    clearT();
    room.ready = new Set();
    const ev = room.program[room.index];
    room.phase = 'event'; room.results = {}; room.details = {};
    let pairs = null;
    const later = [];
    const setT = (f, ms) => later.push([f, ms]);
    const bots = [...room.players.values()].filter((p) => p.bot);
    if (EVENTS[ev].type === 'duel') {
      // le joueur humain affronte le bot de duel ; les bots s'affrontent entre eux
      pairs = [{ a: room.hostId, b: 'BOT', first: Math.random() < 0.5 ? room.hostId : 'BOT' }];
      const ids = shuffle(bots.map((b) => b.id));
      for (let i = 0; i < ids.length; i += 2) {
        const a = ids[i], b = ids[i + 1] || 'BOT';
        pairs.push({ a, b, first: a });
        const aw = Math.random() < 0.5;
        const pts = 1 + Math.floor(Math.random() * 3);
        setT(() => {
          result(a, aw ? 1 : 0, aw ? `${pts}-0` : `0-${pts}`);
          if (b !== 'BOT') result(b, aw ? 0 : 1, aw ? `0-${pts}` : `${pts}-0`);
        }, rnd(15, 40) * 1000);
      }
    } else {
      for (const b of bots) {
        const r = botResult(ev);
        if (r.t) { // progression visible au 100 m / tir
          setT(() => {
            const st = performance.now() + 2600;
            const iv = setInterval(() => { const v = Math.min(1, Math.max(0, (performance.now() - st) / 1000 / r.t)); send('prog', { id: b.id, v }); if (v >= 1) clearInterval(iv); }, 120);
            timers.push(iv);
          }, 0);
        }
        setT(() => result(b.id, r.score, r.detail), r.delay);
      }
    }
    room.current = { id: (room.current?.id || 0) + 1, event: ev, seed: Math.floor(Math.random() * 1e9), pairs, index: room.index, count: room.program.length, go: false };
    room.reveal = null;
    room.later = later;
    // les bots lisent les règles en 1 à 3 s
    for (const b of bots) timers.push(setTimeout(() => ready(b.id), rnd(1000, 3000)));
    emit();
  }
  function ready(id) {
    if (!room || room.phase !== 'event' || room.current.go) return;
    room.ready.add(id);
    if ([...room.players.keys()].every((k) => room.ready.has(k))) {
      room.current.go = true;
      for (const [f, ms] of room.later) timers.push(setTimeout(f, ms));
    }
    emit();
  }
  function result(id, score, detail) {
    if (!room || room.phase !== 'event' || room.results[id] !== undefined) return;
    room.results[id] = score; room.details[id] = detail;
    emit();
    if ([...room.players.keys()].every((k) => room.results[k] !== undefined)) finish();
  }
  function finish() {
    const ev = EVENTS[room.current.event];
    const all = [...room.players.values()].sort((a, b) => room.results[b.id] - room.results[a.id]);
    const ranking = [];
    if (ev.type === 'duel') for (const p of all) { const w = room.results[p.id] > 0; ranking.push({ id: p.id, score: room.results[p.id], detail: room.details[p.id], pts: w ? 10 : 8, rank: w ? 1 : 2 }); }
    else {
      let ps = null, pr = 0;
      all.forEach((p, i) => { const s = room.results[p.id]; const r = i > 0 && s === ps ? pr : i; ps = s; pr = r; ranking.push({ id: p.id, score: s, detail: room.details[p.id], pts: POINTS[r] || 0, rank: r + 1 }); });
    }
    for (const r of ranking) { const pl = room.players.get(r.id); pl.total += r.pts; pl.medals = pl.medals || [0, 0, 0]; if (ev.type !== 'duel' && r.rank >= 1 && r.rank <= 3) pl.medals[r.rank - 1]++; }
    room.reveal = { event: room.current.event, ranking };
    room.phase = 'reveal';
    emit();
  }

  function srv(e, d) {
    if (e === 'create') {
      const n = Math.max(1, Math.min(15, d.bots || 7));
      room = { hostId: d.pid, phase: 'lobby', mode: null, players: new Map(), program: [], index: 0, current: null, results: {}, reveal: null };
      room.players.set(d.pid, { id: d.pid, name: String(d.name || 'Joueur').slice(0, 16), country: 'FR', total: 0 });
      const names = shuffle(BOT_NAMES);
      const cs = COUNTRIES.filter((c) => c.code !== 'FR');
      for (let i = 0; i < n; i++) room.players.set('bot' + i, { id: 'bot' + i, bot: true, name: '🤖 ' + names[i], country: cs[i].code, total: 0 });
      return emit();
    }
    if (e === 'join') return send('err', { msg: 'Hors-ligne : crée une partie contre des bots', silent: true });
    if (!room) return;
    const me = room.players.get(room.hostId);
    if (e === 'country') {
      if ([...room.players.values()].some((p) => p.country === d.code && p.id !== me.id)) {
        const other = [...room.players.values()].find((p) => p.country === d.code);
        other.country = me.country; // échange avec le bot
      }
      me.country = d.code; return emit();
    }
    if (e === 'start') {
      if (room.phase === 'final') for (const p of room.players.values()) { p.total = 0; p.medals = [0, 0, 0]; }
      const all = Object.keys(EVENTS);
      room.program = d.mode === 'libre' ? [d.event] : shuffle(all).slice(0, Math.min(MODES[d.mode].count, all.length));
      room.mode = d.mode; room.index = 0;
      return startEvent();
    }
    if (e === 'ready') return ready(room.hostId);
    if (e === 'result') return result(room.hostId, d.score, d.detail);
    if (e === 'next') { room.index++; if (room.index < room.program.length) startEvent(); else { room.phase = 'final'; emit(); } return; }
    if (e === 'podium') { room.phase = 'final'; return emit(); }
    if (e === 'toLobby') { clearT(); if (room.phase === 'final') for (const p of room.players.values()) { p.total = 0; p.medals = [0, 0, 0]; } room.phase = 'lobby'; room.reveal = null; return emit(); }
    if (e === 'leave') { clearT(); room = null; }
  }
  return sock;
};
