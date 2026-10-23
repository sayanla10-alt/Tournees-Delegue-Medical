/* Service worker : met l'application en cache pour un fonctionnement hors ligne.
   Les appels au Google Sheet (script.google.com) ne sont jamais mis en cache.
   Après une mise à jour des fichiers, incrémenter VERSION. */
var VERSION = 'tournees-v4';
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
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(FICHIERS).then(function () {
      return Promise.all(POLICES.map(function (u) { return c.add(new Request(u, { mode: 'cors' })).catch(function () {}); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (POLICES.indexOf(e.request.url) >= 0) {
    e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Cache d'abord, puis mise à jour en arrière-plan
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (enCache) {
      var reseau = fetch(e.request).then(function (r) {
        if (r && r.ok) c.put(e.request, r.clone());
        return r;
      }).catch(function () { return enCache; });
      return enCache || reseau;
    });
  }));
});
