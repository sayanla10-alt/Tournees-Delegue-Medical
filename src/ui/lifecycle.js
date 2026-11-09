  // ------------------------------------------------------------------ Icônes
  function icone(n) {
    var d = {
      relancer: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
      localisation: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      pieton: '<circle cx="13" cy="4" r="1.8"/><path d="M10 21l2-6 3 3v3M9 11l3-3.5 3 2 2.5 3M12 7.5l-1.3 5.3 3.3 2.2"/><path d="M8.5 12.5 7 15"/>',
      voiture: '<path d="M5 16V12l1.8-4.2A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.8 1.3L19 12v4"/><path d="M4 16h16v2.5H4z"/><path d="M5 12h14"/><circle cx="7.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
      medecin: '<path d="M12 2.5v19"/><path d="M14.6 4.2c1.3.2 1.6 1.6.4 2.2L9.4 9c-1.6.8-1.4 2.6.3 3.1l4.4 1.2c1.6.5 1.7 2.3.2 3l-3.5 1.6"/><circle cx="14.6" cy="4.1" r=".6"/>',
      pharmacie: '<path d="M5 10.5h14c0 3.6-3.1 6.5-7 6.5s-7-2.9-7-6.5z"/><path d="M12 17v3.5M8.5 21h7"/><path d="M8.5 10.5c-.4-2.3 1.2-3.4 3.3-3.4s3.3-1.2 2.7-3.1"/><circle cx="14.4" cy="3.9" r=".6"/>',
      repertoire: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10M6 14h6"/>',
      equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.6 3 5.2"/>',
      partager: '<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/>',
      telecharger: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
      fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
      epingle: '<path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z"/><path d="M12 13v8"/>',
      carte: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
      cible: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
      loupe: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
      valider: '<path d="M5 12.5 10 17 19 7"/>',
      whatsapp: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 19L4 20Z"/><path d="M9.2 8.6c.2 2.6 2.4 5 5.2 5.4l1.1-1.3-1.8-.9-.8.8c-1-.4-1.9-1.3-2.3-2.3l.8-.8-.9-1.8-1.3.9Z"/>',
      tel: '<path d="M5 4h3.5l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L15 13l4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
      sms: '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9.5h8M8 12.5h5"/>',
      waze: '<path d="M12 3 20 20l-8-4-8 4 8-17Z"/>',
      route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6"/>',
      filtre: '<path d="M4 6h16M7 12h10M10 18h4"/>',
      chevron: '<path d="m6 9 6 6 6-6"/>',
      calendrier: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
      crayon: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
      poubelle: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
      eclair: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'
    }[n] || '';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }

  // ------------------------------------------------------------------ Démarrage
  window.addEventListener('online', function () { synchroniser(true); });
  window.addEventListener('offline', function () { S.ui.sync = 'horsligne'; afficherEntete(); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'BACKGROUND_SYNC') {
        if (connecte() && navigator.onLine) synchroniser(true);
      }
    });
  }
  // Chargement asynchrone des données flash IndexedDB
  // 3.26.80 : la base (plus de 500 ko) n'est gardée que dans IndexedDB ; on attend sa lecture avant la 1re synchronisation,
  // sinon chaque ouverture retéléchargeait toute la base (1,4 Mo) et affichait « Chargement de votre base »
  S.ui.restauration = true;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   // évite l'effacement par le téléphone
  var idbRestauree = IDB.chargerTout().then(function (tous) {
    Object.keys(tous).forEach(function (k) {
      LS._mem[k] = tous[k];
    });
    if (LS._mem.config) S.config = LS._mem.config;
    if (LS._mem.data) {
      if (!S.data || !S.data.praticiens || String(LS._mem.data.syncedAt || '') >= String(S.data.syncedAt || '')) {
        S.data = LS._mem.data;
      }
    }
    if (LS._mem.plan && (!S.plan || !S.plan.length || (LS._mem.plan.length && LS._mem.plan[0].cle))) {
      S.plan = LS._mem.plan;
    }
    if (LS._mem.programme) S.programme = LS._mem.programme;
    // 3.28.25 : réglages et filtres absents au démarrage : ceux de la base du téléphone sont repris, puis gardés aussi dans localStorage
    idbRelue = true;
    Object.keys(absentsAuDemarrage).forEach(function (k) {
      if (tous[k] === undefined) { IDB.set(k, LS._mem[k]); return; }
      LS._mem[k] = tous[k];
      try { localStorage.setItem(PREFIXE + k, JSON.stringify(tous[k])); } catch (e) {}
    });
    if (absentsAuDemarrage.filtres && tous.filtres) S.ui.filtres = Object.assign({}, FILTRES_VIDES, tous.filtres);
    if (absentsAuDemarrage.filtresAutour && tous.filtresAutour) S.ui.filtresAutour = Object.assign({}, FILTRES_VIDES, tous.filtresAutour);
    absentsAuDemarrage = {};
    if (LS._mem.params) {
      S.params = Object.assign({}, defautParams, LS._mem.params);
      if (dateRefPassee(S.params)) S.params.dateRef = prochainJourOuvre(aujourdhui());
    }
    if (LS._mem.imposes) S.imposes = LS._mem.imposes;
    if (LS._mem.rejetes) S.rejetes = LS._mem.rejetes;
    if (LS._mem.queue) S.queue = LS._mem.queue;
    if (LS._mem.fiches) S.fiches = LS._mem.fiches;
    if (LS._mem.deadLetter) S.deadLetter = LS._mem.deadLetter;
    if (LS._mem.archives) S.archives = LS._mem.archives;
    if (LS._mem.horsPlan) S.horsPlan = LS._mem.horsPlan;
    ctxCache.data = null;
  }).then(function () {
    S.ui.restauration = false; rendreSiPossible();
  }, function () { S.ui.restauration = false; rendreSiPossible(); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.ui.installEvt = e; if (S.ui.tab === 'reglages') rendre(); });
  // 3.25.28 : recalcul de la position et des distances à l'ouverture, réouverture, focus et réveil
  if (S.ui.tab === 'jour') { var tj0 = aujourdhui(); if (datesPlan().indexOf(tj0) >= 0) { S.ui.jour = tj0; S.ui.jourVue = null; } else S.ui.jourVue = tj0; }
  // 3.27.23 : 18 h 30, compte rendu du jour non finalisé : notification du téléphone (une fois par jour)
  function rappelCrSoir() {
    if (!pret() || minutesMaintenant() < 18 * 60 + 30) return;
    var t = aujourdhui(), R = rapportDe(t);
    if (R && R.valideLe) return;
    if (!S.plan.some(function (a) { return a.date === t; })) return;
    notifier('cr-soir', 'Compte rendu à finaliser', 'Votre compte rendu du ' + dateCourte(t) + ' n\'est pas encore finalisé. Touchez pour le terminer.');
  }
  // 3.27.23 : Répertoire ouvert : la prochaine présence change dès la fermeture d'un créneau (19 h -> 19 h 01)
  var minuteRep = minutesMaintenant();
  function rafraichirRepertoireHeure() {
    var m = minutesMaintenant(), avant = minuteRep; minuteRep = m;
    if (S.ui.tab !== 'praticiens' || S.ui.feuille || m <= avant || !pret()) return;
    var ae = document.activeElement; if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    var fins = {}; Object.keys(ctx().parCode || {}).forEach(function (k) { ctx().parCode[k].forEach(function (c) { fins[c.fin] = true; }); });
    if (Object.keys(fins).some(function (f) { return +f >= avant && +f < m; })) rendreSiPossible();
  }
  // 3.27.21 : application restée ouverte d'un jour à l'autre (APK, onglet) : Journée repasse sur aujourd'hui
  var jourOuverture = aujourdhui();
  function verifierChangementJour() {
    var t = aujourdhui();
    if (t === jourOuverture) return;
    var ancien = jourOuverture; jourOuverture = t;
    if (!S.ui.jour || S.ui.jour <= ancien || (S.ui.jourVue && S.ui.jourVue <= ancien)) {
      if (datesPlan().indexOf(t) >= 0) { S.ui.jour = t; S.ui.jourVue = null; } else S.ui.jourVue = t;
    }
    if (S.ui.tab === 'jour') window.scrollTo(0, 0);
    rendreSiPossible();
  }
  setTimeout(function () { relocaliserSiBesoin('ouverture'); }, 0);
  window.addEventListener('pageshow', function () { verifierChangementJour(); relocaliserSiBesoin('ouverture'); });
  window.addEventListener('focus', function () { verifierChangementJour(); relocaliserSiBesoin('ouverture'); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    verifierChangementJour();
    relocaliserSiBesoin('ouverture');
    // 3.27.10 : à chaque retour dans l'application, la base est relue (réponse « inchangé » si rien n'a bougé)
    synchroniser(true, true);
  });
  // Tournées de l'équipe rafraîchies chaque minute quand l'application est ouverte
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    verifierChangementJour();
    rappelCrSoir();
    rafraichirRepertoireHeure();
    // 3.27.10 : chaque minute, envoi de ce qui attend et vérification de la base (corrections faites dans le Google Sheet)
    synchroniser(true, true);
  }, 60000);

  // 3.28.13 : base Supabase vérifiée toutes les 15 s (empreinte légère) : un ajout ou une correction d'un délégué apparaît chez tous les autres
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    if (((S.config && S.config.bddSource) || 'supabase') !== 'supabase') return;
    synchroniser(true, true);
  }, 15000);

  // ------------------------------------------------------------------ Thème
  function appliquerTheme(t) {
    LS.set('theme', t);
    if (t === 'clair' || t === 'sombre') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    majCouleurBarre();
  }
  function majCouleurBarre() {
    var m = document.querySelector('meta[name=theme-color]'); if (!m) return;
    var sombre = document.documentElement.dataset.theme === 'sombre' ||
      (!document.documentElement.dataset.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    m.setAttribute('content', sombre ? '#0B1E2C' : '#0B4F6C');
  }
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', majCouleurBarre); } catch (e) {}
  majCouleurBarre();

  // ------------------------------------------------------------------ Écran de lancement
  function rendreLancement() {
    var el = $('lancement');
    if (!S.ui.lancement) { el.hidden = true; el.innerHTML = ''; return; }
    var etat, detail = '';
    if (S.config.demo) etat = ['demo', 'Mode démonstration'];
    else if (!pret()) etat = ['aucune', 'Aucune base connectée'];
    else if (S.ui.sync === 'erreur' || !navigator.onLine || S.ui.sync === 'horsligne') etat = ['local', 'Hors ligne : données locales'];
    else etat = ['ok', 'Base de données opérationnelle'];
    if (pret() && S.data.syncedAt) detail = 'Synchro ' + new Date(S.data.syncedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    // 3.25.0 : accueil plein écran, sans décompte ; ouverture après 2 s, ou tout de suite d'un toucher
    var h = '<div class="lancement moderne" role="dialog" aria-modal="true" aria-labelledby="titreLancement">' +
      '<div class="lancement-tete"><div class="logo-halo"><img src="icon-192.png" alt=""></div><h1 id="titreLancement">MediPlanner</h1>' +
      '<p>Tournées médicales, planning des praticiens et suivi d\'équipe</p>' +
      '<span class="version">v' + APP_VERSION + '</span></div><div class="lancement-corps">' +
      '<div class="etat-base ' + etat[0] + '">' + etat[1] + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</div>';
    if (pret()) {
      var prat = ctx().prat, nMed = 0, nPha = 0;
      Object.keys(prat).forEach(function (k) { if (prat[k].type === 'Pharmacie') nPha++; else nMed++; });
      var l = lundiDe(semaineParDefaut(aujourdhui())), f = ajouterJours(l, 6);   // à partir du jeudi : semaine suivante
      var pf = prochainFerie();
      var sem = arretsPlanifies(true).filter(function (a) { return a.date >= l && a.date <= f; });
      var del = {}; sem.forEach(function (a) { if (a.delegue) del[a.delegue] = true; });
      var vus = visitesConnues().filter(function (v) { return String(v.date).slice(0, 10) >= lundiDe(aujourdhui()) && Moteur.estVisite(v.statut, statuts()); }).length;
      h += '<div class="metriques">' +
        '<div class="metrique"><b>' + nMed + '</b><span>médecins enregistrés</span></div>' +
        '<div class="metrique"><b>' + nPha + '</b><span>pharmacies</span></div>' +
        '<div class="metrique"><b>' + sem.length + '</b><span>visites planifiées, semaine du ' + dateCourte(l).slice(5) + (S.config.demo ? '' : ' (équipe)') + '</span></div>' +
        '<div class="metrique"><b>' + (S.config.demo ? vus : Object.keys(del).length) + '</b><span>' + (S.config.demo ? 'visites réalisées cette semaine' : 'délégués avec une tournée') + '</span></div></div>' +
        (pf ? '<p class="discret" style="margin:-6px 0 14px">Prochain jour férié : <b>' + esc(nomFerie(pf)) + '</b>, ' + dateLongue(pf) + '.</p>' : '');
    }
    if (S.ui.nouveautes && S.ui.nouveautes.length) {
      h += '<div class="nouveautes"><b>Nouveautés de la mise à jour ' + APP_VERSION + '</b><ul>' + S.ui.nouveautes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
    }
    h += '<p class="lancement-astuce" id="lancementAstuce">' + (S.ui.lancementAuto ? 'Touchez l\'écran pour suspendre le décompte et lire tranquillement' : 'Prenez le temps de lire puis lancez votre journée ci-dessous') + '</p>';
    h += pret() ? '<button class="bouton bouton-plein" type="button" data-a="fermerLancement" data-tab="jour">Lancer l\'application</button>' +
        '<button class="bouton" type="button" data-a="fermerLancement" data-tab="bilan" style="margin-top:10px">Voir mon bilan</button>'
      : '<button class="bouton bouton-plein" type="button" data-a="fermerLancement" data-tab="jour">Lancer l\'application</button>';
    el.innerHTML = h + '</div></div>';
    el.hidden = false;
    if (pret() && S.ui.lancementAuto) demarrerDecompte();
  }
  // Lancement automatique : l'écran d'accueil se ferme seul et ouvre la tournée.
  // Un toucher sur l'écran d'accueil arrête le décompte et laisse tout le temps de lire.
  var minuteurLancement = null;
  function demarrerDecompte() {
    if (minuteurLancement) return;
    minuteurLancement = setInterval(function () {
      if (!S.ui.lancement || !S.ui.lancementAuto) { clearInterval(minuteurLancement); minuteurLancement = null; return; }
      var reste = S.ui.lancementFin - Date.now();
      if (reste <= 0) {
        clearInterval(minuteurLancement); minuteurLancement = null;
        S.ui.lancement = false; S.ui.lancementAuto = false;
        S.ui.tab = 'jour';   // le lancement ouvre toujours « Aujourd'hui »
        rendre(); window.scrollTo(0, 0);
      }
    }, 200);
  }
  function arreterDecompte() {
    if (!S.ui.lancementAuto) return;
    S.ui.lancementAuto = false;
    if (minuteurLancement) { clearInterval(minuteurLancement); minuteurLancement = null; }
    var a = document.getElementById('lancementAstuce');
    if (a) a.textContent = 'Décompte suspendu — prenez le temps de lire puis lancez l\'application ci-dessous.';
    var d = document.querySelector('#lancement .decompte'); if (d) d.remove();
  }
  // Un toucher sur l'accueil suspend le décompte pour laisser lire (au lieu de fermer instantanément)
  function suspendreLancementSurToucher(e) {
    if (!S.ui.lancement || !e.target.closest || !e.target.closest('#lancement')) return;
    if (e.target.closest('[data-a]')) return; // les boutons exécutent leur action
    arreterDecompte();
  }
  document.addEventListener('pointerdown', suspendreLancementSurToucher, { passive: true });
  document.addEventListener('touchstart', suspendreLancementSurToucher, { passive: true });
  document.addEventListener('click', suspendreLancementSurToucher);

  // ------------------------------------------------------------------ Mises à jour (service worker)
  // Une nouvelle version s'installe en arrière-plan puis attend : le bandeau propose « Mise à jour ».
  // Accepter : le nouveau service worker prend la main, la page se recharge, les données locales restent.
  var swReg = null, majDemandee = false;
  function proposerMaj() {
    if (!swReg || !swReg.waiting) return;
    fetch('version.json?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (v) {
      if (!swReg || !swReg.waiting) return;
      var verServeur = v && v.version ? v.version : '';
      if (verServeur && typeof compVersion === 'function' && compVersion(verServeur, APP_VERSION) <= 0) {
        try {
          swReg.waiting.postMessage('SKIP_WAITING');
          swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch (e) {}
        return;
      }
      var reportee = null;
      try { reportee = sessionStorage.getItem('mediplanner_maj_reportee'); } catch (e) {}
      if (reportee && (!verServeur || reportee === verServeur)) return;
      S.ui.majVersion = verServeur;
      var b = $('bandeauMaj');
      b.innerHTML = '<div class="contenu"><div class="texte"><b>Mise à jour disponible' + (v && v.version ? ' : v' + esc(v.version) : '') + '</b>' +
        (v && v.notes && v.notes.length ? '<ul>' + v.notes.slice(0, 3).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
          : 'Une nouvelle version de MediPlanner est prête. Vos données sont conservées.') +
        '</div><div class="boutons"><button class="bouton bouton-plein" type="button" data-a="appliquerMaj">Mise à jour</button>' +
        '<button class="bouton-texte" type="button" data-a="plusTardMaj">Plus tard</button></div></div>';
      b.hidden = false;
    });
  }
  function appliquerMaj() {
    sauver();                                   // tout est déjà dans le stockage local ; par sécurité
    majDemandee = true;
    $('bandeauMaj').hidden = true;
    toast('Mise à jour en cours…');
    if (swReg && swReg.waiting) {
      try {
        swReg.waiting.postMessage('SKIP_WAITING');
        swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch (err) {}
    }
    else location.reload();
    setTimeout(function () { location.reload(); }, 2500);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    var controleurInitial = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!controleurInitial && !majDemandee) return;    // première installation : rien à recharger
      if (window.__rechargement) return;
      window.__rechargement = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) proposerMaj();
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) proposerMaj(); });
      });
      // 3.28.30 : recherche de mise à jour toutes les 5 min et à chaque retour sur l'application (au plus une fois par minute)
      setInterval(function () { reg.update().catch(function () {}); }, 5 * 60 * 1000);
      var dernierUpdateSw = Date.now();
      var verifierRetour = function () {
        if (document.visibilityState !== 'visible') return;
        var now = Date.now();
        if (now - dernierUpdateSw < 60 * 1000) return;
        dernierUpdateSw = now;
        reg.update().catch(function () {});
      };
      document.addEventListener('visibilitychange', verifierRetour);
      window.addEventListener('focus', verifierRetour);
      window.addEventListener('pageshow', verifierRetour);
    }).catch(function () {});
  }

  // Lien d'installation : #config=<base64 de {"url","token"}> (jamais envoyé au serveur)
  function lireConfigLien() {
    var m = location.hash.match(/config=([A-Za-z0-9_\-]+)/);
    if (!m) return false;
    try {
      var cfg = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (!cfg.url || !cfg.token) return false;
      if (S.config.demo || S.config.url !== cfg.url) {
        S.plan = []; S.jours = {}; S.queue = S.config.url === cfg.url ? S.queue : []; S.data = null; S.imposes = []; S.rejetes = {};
      }
      S.config.url = cfg.url; S.config.token = cfg.token; S.config.demo = false;
      sauver();
      // 3.26.50 : tant que l'application n'est pas installée, le lien de configuration reste dans l'adresse :
      // « Sur l'écran d'accueil » (iPhone) l'enregistre, et l'application installée (mémoire séparée) se connecte seule
      var installee = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
      if (installee) history.replaceState(null, '', location.pathname + location.search);
      return true;
    } catch (e) { return false; }
  }
  function lienInstallation() {
    var json = JSON.stringify({ url: S.config.url, token: S.config.token });
    var b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#config=' + b64;
  }

  var configureParLien = lireConfigLien();
  // 3.27.26 : rafraîchissement dans la même session : même onglet, même carte ouverte, même position
  var ecranSession = null;
  try { ecranSession = JSON.parse(sessionStorage.getItem(UI_SESSION) || 'null'); } catch (e) {}
  if (ecranSession && Date.now() - (ecranSession.t || 0) < 6 * 3600000) {
    if (['jour', 'semaine', 'autour', 'rapport', 'praticiens', 'produits', 'bilan', 'equipe', 'reglages'].indexOf(ecranSession.tab) >= 0) S.ui.tab = ecranSession.tab;
    S.ui.ouvert = ecranSession.ouvert || null; S.ui.contactOuvert = ecranSession.contact || null; S.ui.hopOuvert = ecranSession.hop || null;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    var yRestaurer = ecranSession.y || 0;
    var restaurerPosition = function (n) {
      if (!yRestaurer) return;
      if (pret() && document.documentElement.scrollHeight > yRestaurer + 100) { window.scrollTo(0, yRestaurer); yRestaurer = 0; return; }
      if (n < 20) setTimeout(function () { restaurerPosition(n + 1); }, 150);
    };
    setTimeout(function () { restaurerPosition(0); }, 60);
  } else ecranSession = null;
  var minuteurMemo; window.addEventListener('scroll', function () { clearTimeout(minuteurMemo); minuteurMemo = setTimeout(memoriserEcran, 250); }, { passive: true });
  window.addEventListener('pagehide', memoriserEcran);
  chargerFeriesCalendrier();
  try { if (!sessionStorage.getItem('mediplanner.lancement')) { S.ui.lancement = true; sessionStorage.setItem('mediplanner.lancement', '1'); } }
  catch (e) { S.ui.lancement = true; }
  // Nouveautés : celles des versions publiées depuis la dernière ouverture, affichées une seule fois
  (function () {
    var vue = LS.get('versionVue', '');
    if (vue === APP_VERSION) return;
    // après une mise à jour : retour sur « Aujourd'hui », sauf rafraîchissement en cours de session (3.27.26)
    if (vue && !ecranSession) { S.ui.tab = 'jour'; S.ui.pharmaciesProches = false; LS.set('onglet', 'jour'); }
    if (pret() || vue) {
      var notes = [];
      JOURNAL.forEach(function (v) { if (compVersion(v[0], vue) > 0 && compVersion(v[0], APP_VERSION) <= 0) notes = notes.concat(v[1]); });
      S.ui.nouveautes = notes;
      if (notes.length) S.ui.lancement = true;   // après une mise à jour, l'accueil s'affiche même dans la même session
    }
    LS.set('versionVue', APP_VERSION);
  })();
  if (S.ui.lancement) {
    S.ui.lancementAuto = true;
    S.ui.lancementFin = Date.now() + 1000 * (S.ui.nouveautes && S.ui.nouveautes.length ? DELAI_LANCEMENT_NOUVEAUTES : DELAI_LANCEMENT);
  }
  // 3.24.5 : « Pharmacie » abrégé en « Phcie » à l'écran seulement (cartes, listes, feuilles, messages).
  // On ne touche qu'aux textes affichés : ni les valeurs des champs, ni les attributs, ni les données,
  // ni les textes partagés (WhatsApp, exports) ; les lecteurs d'écran gardent le mot entier (aria-label).
  (function () {
    var RE = /\bPharmacie\b|\bPHARMACIE\b/g, EXCLUS = { TEXTAREA: 1, SCRIPT: 1, STYLE: 1, OPTION: 1, INPUT: 1, SELECT: 1 };
    var RE_BLVD = /\bBoulevard\b/gi;
    var RE_CSU = /\bCSU\s+Communautaire\b/gi;
    function abreger(n) {
      if (n.nodeType === 3) {
        var p = n.parentNode; if (!p || EXCLUS[p.nodeName] || (p.closest && p.closest('[contenteditable],textarea,select,.texte-entier'))) return;
        var txt = n.nodeValue;
        if (RE.test(txt)) { RE.lastIndex = 0; txt = txt.replace(RE, function (m) { return m === 'PHARMACIE' ? 'PHCIE' : 'Phcie'; }); }
        if (RE_BLVD.test(txt)) { RE_BLVD.lastIndex = 0; txt = txt.replace(RE_BLVD, 'Blvd.'); }
        if (RE_CSU.test(txt)) { RE_CSU.lastIndex = 0; txt = txt.replace(RE_CSU, 'CSU COM'); }
        if (txt !== n.nodeValue) n.nodeValue = txt;
        return;
      }
      if (n.nodeType !== 1 || EXCLUS[n.nodeName]) return;
      var w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), l = [], t;
      while ((t = w.nextNode())) l.push(t);
      l.forEach(abreger);
    }
    if (!window.MutationObserver) return;
    abreger(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { if (m.type === 'characterData') abreger(m.target); else m.addedNodes.forEach(abreger); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  })();
  // 3.24.9 : les jours écartés d'office par les versions précédentes reviennent dans l'agenda
  if (!LS.get('retiresV2', false)) { LS.set('joursRetires', {}); LS.set('retiresV2', true); }
  importerAgenda();
  // 3.19.0 : à l'ouverture, Journée montre toujours aujourd'hui
  (function () {
    var t = aujourdhui();
    if (datesPlan().indexOf(t) >= 0) { S.ui.jour = t; S.ui.jourVue = null; } else { S.ui.jourVue = t; }
  })();
  rendre();
  if (configureParLien) toast('Application configurée. Synchronisation…');
  var lancerSync = function () {
    if (connecte()) synchroniser(!configureParLien).then(function () {
      if (configureParLien && pret()) { S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); }
    });
  };
  // 3.26.80 : 1re synchronisation après la lecture de la base du téléphone (au plus 4 s d'attente)
  Promise.race([idbRestauree, new Promise(function (ok) { setTimeout(ok, 4000); })]).then(function () { S.ui.restauration = false; lancerSync(); });

  // 3.25.42 : Intégration du bouton retour physique / geste Android pour refermer les modales sans quitter la PWA
  function gererHistoriqueModal(ouvert) {
    try {
      if (ouvert) {
        if (!history.state || !history.state.mediplannerModal) {
          history.pushState({ mediplannerModal: true }, '');
        }
      }
    } catch (e) {}
  }
  window.addEventListener('popstate', function () {
    if (S.ui.feuille) {
      ACTIONS.fermerFeuille();
      return;
    }
    if (S.ui.ouvert) {
      S.ui.ouvert = null;
      rendre();
      return;
    }
    if (S.ui.contactOuvert) {
      S.ui.contactOuvert = null;
      rendre();
      return;
    }
  });

  // Accès pour les tests automatisés
  window.__tournees = { S: S, ctx: ctx, actualiserLieux: actualiserLieux, texteProgramme: texteProgramme, texteRapport: texteRapport, urlWhatsapp: urlWhatsapp, normaliserNumero: normaliserNumero,
                        supprimerJourPlanifie: supprimerJourPlanifie, demanderSuppressionJour: demanderSuppressionJour,
                        version: APP_VERSION, calculerStats: calculerStats, filtrerPraticiens: filtrerPraticiens, erreursEtape: erreursEtape, rendre: rendre, distMoi: distMoi };
})();
