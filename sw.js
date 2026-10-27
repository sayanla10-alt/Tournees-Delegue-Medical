/* =============================================================================
   sw.js : service worker de MediPlanner (fonctionnement hors ligne et mises à jour)

   - Les fichiers de l'application sont servis depuis un cache propre à chaque version
     (jamais mélangés entre deux versions).
   - Une nouvelle version s'installe en arrière-plan puis ATTEND : l'application affiche
     un bandeau « Mise à jour disponible » et l'utilisateur choisit le moment
     (message SKIP_WAITING). Les données locales (localStorage) ne sont jamais touchées.
   - Exception : un téléphone encore sur l'ancienne application « Tournées » (caches
     tournees-v*) n'a pas ce bandeau ; il bascule automatiquement sur cette version.
   - Les appels au Google Sheet (script.google.com) et version.json ne sont jamais mis en cache.

   Publier une version : modifier VERSION ici, APP_VERSION dans app.js et version.json.
   ============================================================================= */
var VERSION = '3.25.16';
var CACHE = 'mediplanner-' + VERSION;
var POLICES = [
  'https://cdn.jsdelivr.net/npm/@fontsource/barlow-semi-condensed@5.3.0/files/barlow-semi-condensed-latin-600-normal.woff2',
  'https://cdn.jsdelivr.net/npm/@fontsource/barlow-semi-condensed@5.3.0/files/barlow-semi-condensed-latin-700-normal.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];
var FICHIERS = [
  './', './index.html', './manifest.webmanifest', './app.css',
  './commun.js', './moteur.js', './app.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

function cachesAnciens() {
  return caches.keys().then(function (cles) { return cles.filter(function (k) { return /^tournees-v/.test(k); }); });
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // cache: 'reload' : on prend les fichiers sur le réseau, pas dans le cache HTTP du navigateur
    return c.addAll(FICHIERS.map(function (u) { return new Request(u, { cache: 'reload' }); })).then(function () {
      // polices : facultatives, jamais bloquantes (réseau lent ou coupé)
      var polices = Promise.all(POLICES.map(function (u) { return c.add(new Request(u, { mode: 'cors' })).catch(function () {}); }));
      return Promise.race([polices, new Promise(function (r) { setTimeout(r, 8000); })]);
    });
  }).then(cachesAnciens).then(function (anciens) {
    if (anciens.length) return self.skipWaiting();   // ancienne application sans bandeau : bascule directe
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(cachesAnciens().then(function (anciens) {
    return caches.keys().then(function (cles) {
      return Promise.all(cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }).then(function () {
      if (!anciens.length) return;
      // Les pages ouvertes de l'ancienne application sont rechargées dans la nouvelle version.
      // Hors de waitUntil : le rechargement passe par ce service worker, qui doit d'abord être actif.
      setTimeout(function () {
        self.clients.matchAll({ type: 'window' }).then(function (fen) {
          fen.forEach(function (f) { if (f.navigate) f.navigate(f.url).catch(function () {}); });
        });
      }, 300);
    });
  }));
});

self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
  if (e.data && e.data.type === 'VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (POLICES.indexOf(e.request.url) >= 0) {
    e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (/\/version\.json$/.test(url.pathname)) return;           // toujours le réseau
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match('./index.html').then(function (r) { return r || fetch(e.request); });
    }).catch(function () { return fetch(e.request); }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (r) { return r || fetch(e.request); });
  }));
});
