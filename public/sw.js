// Jeux Zozz’lympiques — cache pour jouer contre les bots sans réseau
const CACHE = 'zozzlympiques-v4';
const SHELL = ['./', 'index.html', 'style.css', 'main.js', 'kit.js', 'games.js', 'races.js', 'solos.js', 'duels.js', 'extra.js', 'bots.js', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'https://unpkg.com/three@0.160.0/build/three.module.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { mode: u.startsWith('http') ? 'no-cors' : 'same-origin' })).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/socket.io')) return; // le temps réel ne passe jamais par le cache
  // réseau d'abord (version à jour), cache en secours (hors ligne)
  e.respondWith(fetch(e.request).then((r) => {
    if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
