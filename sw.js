/* =============================================================================
   sw.js : service worker de MediPlanner (fonctionnement hors ligne et mises a jour)

   - Les fichiers de l'application sont servis depuis un cache propre a chaque version
     (jamais melanges entre deux versions).
   - Une nouvelle version s'installe en arriere-plan puis ATTEND : l'application affiche
     un bandeau « Mise à jour disponible » et l'utilisateur choisit le moment
     (message SKIP_WAITING). Les donnees locales ne sont jamais touchees.
   - Exception : un telephone encore sur l'ancienne application « Tournées » (caches
     tournees-v*) n'a pas ce bandeau ; il bascule automatiquement sur cette version.
   - Les appels au Google Sheet (script.google.com) et version.json ne sont jamais mis en cache.

   Publier une version : modifier VERSION ici, APP_VERSION dans app.js et version.json.
   ============================================================================= */
var VERSION = '3.31.36';
var CACHE = 'mediplanner-' + VERSION;
var POLICES = [
  'https://cdn.jsdelivr.net/npm/@fontsource/barlow-semi-condensed@5.3.0/files/barlow-semi-condensed-latin-600-normal.woff2',
  'https://cdn.jsdelivr.net/npm/@fontsource/barlow-semi-condensed@5.3.0/files/barlow-semi-condensed-latin-700-normal.woff2'
];
// 3.29.2 : les fichiers sont pré-chargés exactement sous l'adresse que la page demande (?v=version) et toujours depuis
// le réseau (cache: 'reload'), jamais depuis le cache du navigateur : une nouvelle version ne peut plus enregistrer l'ancien fichier
var FICHIERS = [
  './', './index.html', './manifest.webmanifest',
  './app.css?v=' + VERSION, './commun.js?v=' + VERSION, './moteur.js?v=' + VERSION, './app.js?v=' + VERSION,
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(FICHIERS.map(function (u) {
        return fetch(new Request(u, { cache: 'reload' })).then(function (r) {
          if (!r.ok) throw new Error('Pré-chargement impossible : ' + u + ' (' + r.status + ')');
          return c.put(u, r);
        });
      })).then(function () {
        return c.addAll(POLICES).catch(function () {});
      });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE && k.indexOf('mediplanner-') === 0) {
            return caches.delete(k);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  // Ne jamais mettre en cache les requetes POST, les appels Apps Script, Supabase ou version.json
  if (e.request.method !== 'GET' ||
      url.indexOf('script.google.com') >= 0 ||
      url.indexOf('supabase.co') >= 0 ||
      url.indexOf('version.json') >= 0) {
    return;
  }

  // 3.29.2 : une page ouverte avec des paramètres (lien de partage) ou hors ligne retombe sur index.html
  var navigation = e.request.mode === 'navigate';
  e.respondWith(
    caches.match(e.request).then(function (r) {
      if (!r && navigation) return fetch(e.request).catch(function () { return caches.match('./index.html'); });
      return r || fetch(e.request).then(function (resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var respClone = resp.clone();
          caches.open(CACHE).then(function (c) {
            c.put(e.request, respClone);
          });
        }
        return resp;
      });
    })
  );
});

self.addEventListener('message', function (e) {
  var d = e.data;
  if (d === 'SKIP_WAITING' || (d && (d.type === 'SKIP_WAITING' || d.action === 'skipWaiting'))) {
    self.skipWaiting();
  }
});