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
var VERSION = '3.26.1';
var CACHE = 'mediplanner-' + VERSION;
var POLICES = [
  'https://cdn.jsdelivr.net/npm/@fontsource/barlow-semi-condensed@5.3.0/files/barlow-semi-condensed-latin-600-normal.woff2',
  'https://cdn.jsdelivr.net/npm/@fontsource/barlow-semi-condensed@5.3.0/files/barlow-semi-condensed-latin-700-normal.woff2'
];
var FICHIERS = [
  './', './index.html', './manifest.webmanifest', './app.css',
  './commun.js', './moteur.js', './app.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // cache: 'reload' : on prend les fichiers sur le réseau, pas dans le cache HTTP du navigateur
    return c.addAll(FICHIERS.map(function (u) { return new Request(u, { cache: 'reload' }); })).then(function () {
      // polices : facultatives, jamais bloquantes (réseau lent ou coupé)
      var polices = Promise.all(POLICES.map(function (u) { return c.add(new Request(u, { mode: 'cors' })).catch(function () {}); }));
      return Promise.race([polices, new Promise(function (r) { setTimeout(r, 6000); })]);
    });
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (cles) {
      return Promise.all(
        cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      // Rafraîchissement automatique de tous les écrans ouverts dès l'activation
      return self.clients.matchAll({ type: 'window' }).then(function (fen) {
        fen.forEach(function (f) {
          if (f.navigate) f.navigate(f.url).catch(function () {});
        });
      });
    })
  );
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

// Background Sync : réveil en arrière-plan dès le retour du réseau (zones blanches en Côte d'Ivoire)
self.addEventListener('sync', function (e) {
  if (e.tag === 'mediplanner-sync-queue') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        if (clients && clients.length) {
          clients.forEach(function (c) { c.postMessage({ type: 'BACKGROUND_SYNC' }); });
        }
      })
    );
  }
});