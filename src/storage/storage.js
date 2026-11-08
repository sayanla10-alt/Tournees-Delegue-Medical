  // ------------------------------------------------------------------ Stockage flash résilient (IndexedDB)
  // Remplace définitivement le plafond des 5 Mo du localStorage par la mémoire flash illimitée du smartphone.
  // Wrapper asynchrone sécurisé façon idb-keyval : lectures et écritures fluides, zéro saccade UI.
  var IDB = {
    nom: 'mediplanner_db',
    version: 1,
    magasin: 'donnees',
    db: null,
    ouvert: false,
    _fileAttente: [],
    _initPromise: null,
    init: function () {
      if (IDB._initPromise) return IDB._initPromise;
      if (!window.indexedDB) return Promise.resolve(null);
      IDB._initPromise = new Promise(function (resolve) {
        try {
          var req = window.indexedDB.open(IDB.nom, IDB.version);
          req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(IDB.magasin)) {
              db.createObjectStore(IDB.magasin, { keyPath: 'cle' });
            }
          };
          req.onsuccess = function (e) {
            IDB.db = e.target.result;
            IDB.ouvert = true;
            IDB.migrerDepuisLocalStorage();
            IDB._viderFileAttente();
            resolve(IDB.db);
          };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
      return IDB._initPromise;
    },
    _viderFileAttente: function () {
      if (!IDB.db || !IDB._fileAttente.length) return;
      var file = IDB._fileAttente.slice();
      IDB._fileAttente = [];
      try {
        var tx = IDB.db.transaction([IDB.magasin], 'readwrite');
        var store = tx.objectStore(IDB.magasin);
        file.forEach(function (item) {
          store.put({ cle: item.k, val: item.val, maj: Date.now() });
        });
      } catch (e) {}
    },
    set: function (k, val) {
      if (!IDB.db) {
        IDB._fileAttente.push({ k: k, val: val });
        IDB.init();
        return;
      }
      try {
        var tx = IDB.db.transaction([IDB.magasin], 'readwrite');
        tx.objectStore(IDB.magasin).put({ cle: k, val: val, maj: Date.now() });
      } catch (e) {
        IDB._fileAttente.push({ k: k, val: val });
      }
    },
    get: function (k) {
      return IDB.init().then(function (db) {
        if (!db) return null;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction([IDB.magasin], 'readonly');
            var req = tx.objectStore(IDB.magasin).get(k);
            req.onsuccess = function (e) { resolve(e.target.result ? e.target.result.val : null); };
            req.onerror = function () { resolve(null); };
          } catch (e) { resolve(null); }
        });
      });
    },
    del: function (k) {
      if (!IDB.db) return;
      try {
        var tx = IDB.db.transaction([IDB.magasin], 'readwrite');
        tx.objectStore(IDB.magasin).delete(k);
      } catch (e) {}
    },
    chargerTout: function () {
      return IDB.init().then(function (db) {
        if (!db) return {};
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction([IDB.magasin], 'readonly');
            var store = tx.objectStore(IDB.magasin);
            var res = {};
            if (store.getAll) {
              var req = store.getAll();
              req.onsuccess = function (e) {
                var liste = e.target.result || [];
                liste.forEach(function (item) { if (item && item.cle) res[item.cle] = item.val; });
                resolve(res);
              };
              req.onerror = function () { resolve(res); };
            } else {
              var cur = store.openCursor();
              cur.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                  if (cursor.value && cursor.value.cle) res[cursor.value.cle] = cursor.value.val;
                  cursor.continue();
                } else resolve(res);
              };
              cur.onerror = function () { resolve(res); };
            }
          } catch (e) { resolve({}); }
        });
      });
    },
    vider: function () {
      IDB._fileAttente = [];
      if (!IDB.db) return;
      try {
        var tx = IDB.db.transaction([IDB.magasin], 'readwrite');
        tx.objectStore(IDB.magasin).clear();
      } catch (e) {}
    },
    migrerDepuisLocalStorage: function () {
      try {
        var cles = Object.keys(localStorage);
        cles.forEach(function (cleLs) {
          if (cleLs.indexOf(PREFIXE) === 0) {
            var k = cleLs.slice(PREFIXE.length);
            var brut = localStorage.getItem(cleLs);
            if (brut) {
              try {
                var val = JSON.parse(brut);
                IDB.set(k, val);
                if (LS._mem[k] === undefined) LS._mem[k] = val;
                if (!CLES_LEGERES[k]) localStorage.removeItem(cleLs);
              } catch (eP) {}
            }
          }
        });
      } catch (e) {}
    }
  };

  var PREFIXE = 'tournees.';
  var CLES_LEGERES = { config: true, token: true, theme: true, onglet: true };
  var CLES_LOURDES = { data: true, plan: true, archives: true, queue: true, fiches: true, rapports: true, stats: true, horsPlan: true, imposes: true, rejetes: true, hist: true, plannings: true };

  var LS = {
    _mem: {},
    get: function (k, d) {
      if (LS._mem[k] !== undefined) return LS._mem[k];
      try {
        var v = localStorage.getItem(PREFIXE + k);
        if (v !== null) {
          var obj = JSON.parse(v);
          LS._mem[k] = obj;
          return obj;
        }
      } catch (e) {}
      return d;
    },
    set: function (k, v) {
      LS._mem[k] = v;
      IDB.set(k, v);
      if (k === 'plan' && typeof S !== 'undefined' && S && S.horsPlan) {
        IDB.set('horsPlan', S.horsPlan);
      }
      if (CLES_LEGERES[k]) {
        try {
          var str = JSON.stringify(v);
          if (str.length < 50000) localStorage.setItem(PREFIXE + k, str);
        } catch (e) {}
      } else {
        try { localStorage.removeItem(PREFIXE + k); } catch (e) {}
      }
    },
    vider: function () {
      LS._mem = {};
      IDB.vider();
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf(PREFIXE) === 0) localStorage.removeItem(k);
        });
      } catch (e) {}
    }
  };

  function aujourdhui() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function minutesMaintenant() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function prochainJourOuvre(iso) { var i = jourSemaineIndex(iso); return i > 4 ? ajouterJours(iso, 7 - i) : iso; }
  function semaineParDefaut(iso) { var i = jourSemaineIndex(iso); return i >= 4 ? ajouterJours(iso, 7 - i) : iso; }

  // ------------------------------------------------------------------ État
  var donnees = LS.get('data', null);
  if (donnees && (!donnees.praticiens || !donnees.presences)) donnees = null;   // cache d'une ancienne version
  var plan = LS.get('plan', []);
  var ancienPlan = plan.length && !plan[0].cle;   // tournée d'une version précédente (ancienne base)
  if (ancienPlan) plan = [];

  var cfgInit = LS.get('config', { url: '', token: '', demo: false, delegue: '', whatsapp: '', waWeb: false, depart: '', bddSource: 'supabase' });
  // 3.28.12 : Supabase devient la base principale de lecture sur tous les téléphones (Sheets en appoint, synchronisé)
  if (cfgInit.bddSourceReset32812 !== true) {
    cfgInit.bddSource = 'supabase';
    cfgInit.bddSourceReset32812 = true;
    LS.set('config', cfgInit);
  }

  var S = {
    config: cfgInit,
    data: donnees,
    plan: plan,
    programme: LS.get('programme', { etat: 'proposition', valideLe: '' }),
    params: LS.get('params', null),
    imposes: LS.get('imposes', []),
    rejetes: LS.get('rejetes', {}),
    queue: LS.get('queue', []),
    fiches: LS.get('fiches', []),
    deadLetter: LS.get('deadLetter', { visites: [], fiches: [] }),
    ui: {
      tab: (function () {
        // 3.0.0 : nouveaux onglets du parcours (anciens noms convertis)
        var t = LS.get('onglet', 'jour'), anciens = { tournee: 'jour', contacts: 'praticiens', recherche: 'praticiens', stats: 'bilan', historique: 'bilan' };
        t = anciens[t] || t;
        return ['jour', 'semaine', 'autour', 'rapport', 'praticiens', 'produits', 'bilan', 'equipe', 'reglages'].indexOf(t) >= 0 ? t : 'jour';
      })(), jour: (function () { var j = LS.get('jourVu', null); return j && j.le === aujourdhui() ? j.j : null; })(),
      jourVue: (function () { var j = LS.get('jourVu', null); return j && j.le === aujourdhui() ? j.v || null : null; })(), ouvert: null, voirParams: false, feuille: null,
      recherche: '', filtre: 'tous', contactOuvert: null, limite: 40,
      sync: 'idle', erreur: '', installEvt: null, enCours: false,
      collegue: null, eqSel: LS.get('eqSel', []), jourEquipe: null, histFiltre: LS.get('histFiltre', 'moi'), rechercheAutour: '',
      couvPortee: LS.get('couvPortee', 'jour'), couvFiltre: LS.get('couvFiltre', 'couvertes'), couvOuverte: false, couvInterieurOuverte: false,
      statsVue: 'tableau', annulReprise: LS.get('annulReprise', null), eqPortee: LS.get('eqPortee', 'semaine'), eqDate: aujourdhui(),
      autour: LS.get('autour', { lat: null, lon: null, label: '', moment: 'maintenant', date: '', heure: '', rayon: 0.5, ref: null }),
      aPublier: LS.get('aPublier', false), portee: LS.get('portee', null), conflits: [],
      filtres: null, tri: LS.get('tri', 'nom'), stats: null, lancement: false, dernierClicY: null
    }
  };
  // 3.20.0 : agenda. Tous mes jours planifiés (7 jours passés et tout l'à venir) sont dans S.plan ;
  // l'état brouillon / confirmé est porté par chaque jour (S.jours), plus par une tournée unique.
  S.jours = LS.get('etatsJours', null);
  if (!S.jours) {
    S.jours = {};
    var p0 = S.programme || {};
    Array.from(new Set(S.plan.map(function (x) { return x.date; }))).forEach(function (d) {
      S.jours[d] = { etat: p0.etat === 'valide' ? 'valide' : 'proposition', valideLe: p0.valideLe || '', modifieLe: p0.modifieLe || '' };
    });
    LS.set('etatsJours', S.jours);
  }
  // 3.25.25 : cœur de cible dynamique (spécialités pré-sélectionnées par défaut, modifiables en 1 geste ; changer les spécialités met à jour le cœur de cible)
  var SPECS_DEFAUT_BASE = ['Cardiologue', 'Diabétologue', 'Endocrinologue', 'Généraliste'];
  function coeurDeCible() {
    var l = LS.get('coeurDeCible', null);
    return Array.isArray(l) && l.length ? l.filter(function (x) { return x && x !== 'Pharmacien'; }) : SPECS_DEFAUT_BASE.slice();
  }
  function sauverCoeurDeCible(l) {
    var propre = (l || []).filter(function (x) { return x && x !== 'Pharmacien'; });
    if (propre.length) {
      LS.set('coeurDeCible', propre.slice());
      SPECS_DEFAUT = propre.slice();
      FILTRES_VIDES.specialites = propre.slice();
    }
  }
  var SPECS_DEFAUT = coeurDeCible();
  var FILTRES_VIDES = { specialites: SPECS_DEFAUT.slice(), communes: [], potentiels: [], visite: 'tous', conv: 'tous', type: 'tous', equipe: 'tous' };
  S.ui.filtres = Object.assign({}, FILTRES_VIDES, LS.get('filtres', {}));
  S.ui.pharmaciesProches = S.ui.tab === 'autour' ? LS.get('proches', false) : false;
  if (S.ui.pharmaciesProches === true) S.ui.pharmaciesProches = 'Pharmacie';
  S.ui.filtresAutour = Object.assign({}, FILTRES_VIDES, LS.get('filtresAutour', {}));
  // « Pharmacien » n'est plus une spécialité filtrable (2.2.4)
  [S.ui.filtres, S.ui.filtresAutour].forEach(function (f) { f.specialites = (f.specialites || []).filter(function (x) { return x !== 'Pharmacien'; }); });
  if (!LS.get('specsDefaut325', false) || !LS.get('coeurCible32525', false)) {
    if (!S.ui.filtres.specialites || !S.ui.filtres.specialites.length) S.ui.filtres.specialites = coeurDeCible();
    if (!S.ui.filtresAutour.specialites || !S.ui.filtresAutour.specialites.length) S.ui.filtresAutour.specialites = coeurDeCible();
    LS.set('filtres', S.ui.filtres); LS.set('filtresAutour', S.ui.filtresAutour);
  }
  // 2.2.0 : nouveaux réglages par défaut (une seule fois)
  if (!LS.get('defauts220', false)) {
    S.ui.autour.moment = 'maintenant'; S.ui.autour.rayon = 0.5; LS.set('autour', S.ui.autour);
    S.ui.couvPortee = 'jour'; S.ui.couvFiltre = 'couvertes'; LS.set('couvPortee', 'jour'); LS.set('couvFiltre', 'couvertes');
    LS.set('defauts220', true);
  }
  // Contacts et Autour ont chacun leur propre jeu de filtres, conservé jusqu'à modification
  function cleFiltres() { return 'filtres'; }
  function filtresCour() { return S.ui[cleFiltres()]; }
  function rechercheCour() { return S.ui.tab === 'autour' ? S.ui.rechercheAutour : S.ui.recherche; }
  function majFiltres(f) {
    if (f && Array.isArray(f.specialites) && f.specialites.length) sauverCoeurDeCible(f.specialites);
    S.ui[cleFiltres()] = f;
    LS.set(cleFiltres(), f);
    S.ui.limite = 40;
    // 3.25.35 : Harmonisation totale avec le filtre maître (Recherche / Répertoire)
    if (f) {
      if (Array.isArray(f.communes)) {
        S.params.communes = f.communes.slice();
        LS.set('params', S.params);
        if (S.ui.filtresAutour) {
          S.ui.filtresAutour.communes = f.communes.slice();
          LS.set('filtresAutour', S.ui.filtresAutour);
        }
      }
      if (Array.isArray(f.specialites)) {
        S.params.specialites = f.specialites.slice();
        LS.set('params', S.params);
        if (S.ui.filtresAutour) {
          S.ui.filtresAutour.specialites = f.specialites.slice();
          LS.set('filtresAutour', S.ui.filtresAutour);
        }
      }
      if (Array.isArray(f.potentiels)) {
        S.params.potentiels = f.potentiels.slice();
        LS.set('params', S.params);
      }
    }
  }
  S.ui.stats = Object.assign({ periode: 'semaine', debut: '', fin: '', portee: 'moi', objectif: 40, vueSpec: 'base' }, LS.get('stats', {}));
  // L'ancienne tournée publiée est retirée de la feuille Plannings pour ne pas bloquer les collègues
  if (ancienPlan) {
    var auj = aujourdhui();
    S.ui.portee = { debut: ajouterJours(auj, -7), fin: ajouterJours(auj, 28) }; LS.set('portee', S.ui.portee);
    S.ui.aPublier = true; LS.set('aPublier', true);
  }
  var defautParams = { mode: 'semaine', dateRef: semaineParDefaut(aujourdhui()), communes: [], parJour: false,
                       communesJour: {}, maxJour: 8, delai: 7, eviterCollegues: true,
                       specialites: coeurDeCible(), typeCibles: 'medecins', potentiels: [] };
  S.params = Object.assign({}, defautParams, S.params || {});
  if (!Array.isArray(S.params.communes)) S.params.communes = [];
  if (!Array.isArray(S.params.specialites)) S.params.specialites = [];
  if (!LS.get('specsDefaut325', false) || !LS.get('coeurCible32525', false)) {
    if (!S.params.specialites.length) S.params.specialites = coeurDeCible();
    else sauverCoeurDeCible(S.params.specialites);
    LS.set('params', S.params); LS.set('specsDefaut325', true); LS.set('coeurCible32525', true);
  }
  // v2.0.4 : par défaut, tournée sans pharmacies (réglage appliqué une fois aux téléphones existants)
  if (!S.params.defauts204) { S.params.typeCibles = 'medecins'; S.params.defauts204 = true; LS.set('params', S.params); }
  if (!Array.isArray(S.params.potentiels)) S.params.potentiels = [];
  // 3.25.35 : Harmonisation immédiate de tous les filtres de l'application (le filtre maître est dans Répertoire / Recherche)
  if (S.ui.filtres && Array.isArray(S.ui.filtres.communes) && S.ui.filtres.communes.length) {
    S.params.communes = S.ui.filtres.communes.slice();
    if (S.ui.filtresAutour) S.ui.filtresAutour.communes = S.ui.filtres.communes.slice();
    LS.set('params', S.params);
    LS.set('filtresAutour', S.ui.filtresAutour);
  } else if (S.params && Array.isArray(S.params.communes) && S.params.communes.length) {
    S.ui.filtres.communes = S.params.communes.slice();
    if (S.ui.filtresAutour) S.ui.filtresAutour.communes = S.params.communes.slice();
    LS.set('filtres', S.ui.filtres);
    LS.set('filtresAutour', S.ui.filtresAutour);
  }
  // 3.25.0 : la période proposée commence demain (J+1), y compris après rafraîchissement
  if (!S.params.dateRef || S.params.dateRef <= aujourdhui()) { S.params.dateRef = prochainJourOuvre(ajouterJours(aujourdhui(), 1)); LS.set('params', S.params); }
  S.config = Object.assign({ whatsapp: '', waWeb: false, depart: '', delegue: '' }, S.config);

  // 3.22.0 : copie de secours du téléphone, une par jour sur 7 jours (comptes rendus et fiches non envoyés, agenda,
  // comptes rendus de journée). Exportable en fichier depuis Réglages › Avancé, pour reprendre après un incident.
  // reprise : on ajoute ce qui manque (comptes rendus et fiches non envoyés, comptes rendus de journée) ;
  // l'agenda n'est repris que si le téléphone n'en a plus. Rien d'existant n'est écrasé.
  function importerSecours(fichier) {
    var lecteur = new FileReader();
    lecteur.onload = function () {
      var o; try { o = JSON.parse(lecteur.result); } catch (e) { toast('Fichier illisible.'); return; }
      var sec = o && o.secours, jours = sec ? Object.keys(sec).sort() : [];
      if (!jours.length) { toast('Ce fichier n\'est pas une sauvegarde MediPlanner.'); return; }
      var s = sec[jours[jours.length - 1]];
      confirmerPuis('Reprendre une sauvegarde', 'Reprendre la sauvegarde du <b>' + dateFr(jours[jours.length - 1]) + '</b>' + (o.delegue ? ' (' + esc(o.delegue) + ')' : '') +
        ' ? Les comptes rendus et fiches non envoyés qui manquent seront ajoutés ; rien d\'existant n\'est remplacé.', 'Reprendre', function () {
        var uids = ensemble(S.queue.map(function (v) { return v.uid; }).concat(((S.data && S.data.historique) || []).map(function (v) { return v.uid; })));
        var nq = (s.queue || []).filter(function (v) { return !uids[v.uid]; }); S.queue = S.queue.concat(nq);
        var fu = ensemble(S.fiches.map(function (f) { return f.uid; })), nf = (s.fiches || []).filter(function (f) { return !fu[f.uid]; }); S.fiches = S.fiches.concat(nf);
        Object.keys(s.rapports || {}).forEach(function (d) { if (!S.rapports[d]) S.rapports[d] = s.rapports[d]; }); LS.set('rapports', S.rapports);
        var np = 0;
        if (!S.plan.length && (s.plan || []).length) { S.plan = s.plan; S.jours = s.jours || {}; np = datesPlan().length; }
        sauver(); rendre(); if (connecte()) synchroniser(true);
        toast(nq.length + ' compte(s) rendu(s), ' + nf.length + ' fiche(s)' + (np ? ', ' + np + ' jour(s) d\'agenda' : '') + ' repris.', 5000);
      });
    };
    lecteur.readAsText(fichier);
  }
  function copieSecours() {
    var t = aujourdhui(), sec = LS.get('secours', {});
    sec[t] = { le: new Date().toISOString(), delegue: moi(), queue: S.queue, fiches: S.fiches, plan: S.plan, jours: S.jours,
               horsPlan: S.horsPlan || [], rapports: S.rapports || {}, imposes: S.imposes };
    Object.keys(sec).sort().reverse().slice(7).forEach(function (d) { delete sec[d]; });
    LS.set('secours', sec);
  }
  function sauver() {
    archiverPlan(); nettoyerAgenda(); try { copieSecours(); } catch (e) { /* stockage plein : la sauvegarde n'empêche pas l'enregistrement */ }
    LS.set('config', S.config); LS.set('data', S.data); LS.set('plan', S.plan); LS.set('etatsJours', S.jours);
    LS.set('params', S.params); LS.set('queue', S.queue); LS.set('imposes', S.imposes); LS.set('rejetes', S.rejetes);
    LS.set('fiches', S.fiches); LS.set('deadLetter', S.deadLetter);
    archiverPlan();
    declencherBackgroundSync();
  }
  // Archive locale des tournées (par date, 70 jours) : permet de reprendre un ancien programme, même hors ligne
  function archiverPlan() {
    if (!S.plan.length) return;
    var arch = LS.get('archives', {}), limite = ajouterJours(aujourdhui(), -70);
    var parDate = {};
    S.plan.forEach(function (a) {
      (parDate[a.date] = parDate[a.date] || []).push({ date: a.date, heure: a.heure, creneau: a.creneau, idPresence: a.idPresence, code: a.code,
        nom: a.nom, specialite: a.specialite, note: a.note, quartier: a.quartier, commune: a.commune, lieu: a.lieu, statut: a.statut || '', prog: etatJour(a.date) });
    });
    Object.keys(parDate).forEach(function (d) { arch[d] = parDate[d]; });
    Object.keys(arch).forEach(function (d) { if (d < limite) delete arch[d]; });
    LS.set('archives', arch);
  }
  function enAttente() { return S.queue.length + S.fiches.length; }
  function rejetsEnAttente() { return (S.deadLetter && ((S.deadLetter.visites && S.deadLetter.visites.length) + (S.deadLetter.fiches && S.deadLetter.fiches.length))) || 0; }

  function pret() { return !!(S.data && S.data.praticiens && S.data.praticiens.length); }
  function statuts() { return (S.data && S.data.statuts && S.data.statuts.length) ? S.data.statuts : STATUTS_DEFAUT; }
  function quartiers() {
    var def = quartiersDefautObjets();
    if (!S.data || !S.data.quartiers || !S.data.quartiers.length) return def;
    var existants = {}, res = [];
    S.data.quartiers.forEach(function (q) {
      var cle = (q.quartier || '').trim().toLowerCase();
      if (cle) { existants[cle] = true; res.push(q); }
    });
    def.forEach(function (q) {
      var cle = (q.quartier || '').trim().toLowerCase();
      if (!existants[cle]) res.push(q);
    });
    return res;
  }
  function nomSecteur(q, com, coord) {
    var s = (q && q !== 'NL' && q !== 'Non localisé') ? String(q).trim() : '';
    if (com && s.toLowerCase().indexOf(com.toLowerCase()) === 0) {
      var rNom = s.slice(com.length).replace(/^[\s\-_/]+/, '').trim();
      if (rNom) s = rNom;
    }
    // Exception Cocody Centre : ne jamais réduire à simple "Centre"
    if ((/cocody/i.test(com) || /cocody/i.test(q) || /cocody/i.test(s)) && s.toLowerCase() === 'centre') {
      s = 'Cocody Centre';
    }
    if ((!s || s.toLowerCase() === (com || '').toLowerCase()) && coord && isFinite(coord.lat) && isFinite(coord.lon)) {
      var r = Moteur.quartierLePlusProche(coord.lat, coord.lon, quartiers());
      if (r && r.quartier && r.quartier.quartier) s = r.quartier.quartier;
    }
    if ((/cocody/i.test(com) || /cocody/i.test(s)) && s.toLowerCase() === 'centre') {
      s = 'Cocody Centre';
    }
    return s || com || '';
  }
  function formaterDureeTrajet(m) {
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return r > 0 ? (h + ' h ' + pad2(r)) : (h + ' h');
  }

  // Contexte du moteur, reconstruit seulement quand les données changent
  var ctxCache = { data: null, ctx: null };
  function ctx() {
    if (ctxCache.data !== S.data) ctxCache = { data: S.data, ctx: Moteur.preparer(Object.assign({}, S.data, { feries: feries() })) };
    return ctxCache.ctx;
  }
  function praticien(code) { return ctx().prat[code]; }

