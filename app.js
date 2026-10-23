/* =============================================================================
   app.js : interface de l'application "Tournées" (version 3)
   - Données en cache sur le téléphone : tout fonctionne hors ligne
   - Visites validées et tournées publiées envoyées au Google Sheet dès que possible
   ============================================================================= */
(function () {
  'use strict';

  // ------------------------------------------------------------------ Stockage local
  var PREFIXE = 'tournees.';
  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem(PREFIXE + k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(PREFIXE + k, JSON.stringify(v)); }
      catch (e) { toast('Mémoire du téléphone pleine : certaines données n\'ont pas été enregistrées.'); }
    },
    vider: function () {
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIXE) === 0) localStorage.removeItem(k); }); } catch (e) {}
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

  var S = {
    config: LS.get('config', { url: '', token: '', demo: false, delegue: '', whatsapp: '', waWeb: false, depart: '' }),
    data: donnees,
    plan: plan,
    programme: LS.get('programme', { etat: 'proposition', valideLe: '' }),
    params: LS.get('params', null),
    imposes: LS.get('imposes', []),
    rejetes: LS.get('rejetes', {}),
    queue: LS.get('queue', []),
    ui: {
      tab: 'tournee', jour: null, ouvert: null, voirParams: false, feuille: null,
      recherche: '', filtre: 'tous', contactOuvert: null, limite: 40,
      sync: 'idle', erreur: '', installEvt: null, enCours: false,
      collegue: null, jourEquipe: null, histFiltre: 'moi',
      couvPortee: 'jour', couvFiltre: 'toutes', couvOuverte: true,
      autour: LS.get('autour', { lat: null, lon: null, label: '', moment: 'maintenant', date: '', heure: '', rayon: 5, ref: null }),
      aPublier: LS.get('aPublier', false), portee: LS.get('portee', null), conflits: []
    }
  };
  // L'ancienne tournée publiée est retirée de la feuille Plannings pour ne pas bloquer les collègues
  if (ancienPlan) {
    var auj = aujourdhui();
    S.ui.portee = { debut: ajouterJours(auj, -7), fin: ajouterJours(auj, 28) }; LS.set('portee', S.ui.portee);
    S.ui.aPublier = true; LS.set('aPublier', true);
  }
  var defautParams = { mode: 'semaine', dateRef: semaineParDefaut(aujourdhui()), communes: [], parJour: false,
                       communesJour: {}, maxJour: 8, delai: 7, eviterCollegues: true };
  S.params = Object.assign({}, defautParams, S.params || {});
  if (!Array.isArray(S.params.communes)) S.params.communes = [];
  S.config = Object.assign({ whatsapp: '', waWeb: false, depart: '', delegue: '' }, S.config);

  function sauver() {
    LS.set('config', S.config); LS.set('data', S.data); LS.set('plan', S.plan); LS.set('programme', S.programme);
    LS.set('params', S.params); LS.set('queue', S.queue); LS.set('imposes', S.imposes); LS.set('rejetes', S.rejetes);
  }

  function pret() { return !!(S.data && S.data.praticiens && S.data.praticiens.length); }
  function statuts() { return (S.data && S.data.statuts && S.data.statuts.length) ? S.data.statuts : STATUTS_DEFAUT; }
  function quartiers() { return (S.data && S.data.quartiers && S.data.quartiers.length) ? S.data.quartiers : quartiersDefautObjets(); }

  // Contexte du moteur, reconstruit seulement quand les données changent
  var ctxCache = { data: null, ctx: null };
  function ctx() {
    if (ctxCache.data !== S.data) ctxCache = { data: S.data, ctx: Moteur.preparer(S.data) };
    return ctxCache.ctx;
  }
  function praticien(code) { return ctx().prat[code]; }

  // ------------------------------------------------------------------ Mise en forme
  var JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var ZONES = ['Zone Nord', 'Zone Centre', 'Zone Est', 'Zone Sud', 'Zone Ouest'];

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateCourte(iso) { var p = iso.split('-'); return JOURS_COURTS[jourSemaineIndex(iso)] + ' ' + p[2] + '/' + p[1]; }
  function dateLongue(iso) { var p = iso.split('-'); return nomJour(iso).toLowerCase() + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1]; }
  function majuscule(s) { return s.replace(/^./, function (c) { return c.toUpperCase(); }); }
  function km(n) { return (Math.round(n * 10) / 10).toLocaleString('fr-FR') + ' km'; }
  function pct(n) { return (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1 }) + ' %'; }
  function vuDepuis(derniere, ref) {
    if (!derniere) return 'Jamais visité';
    var j = joursEcoules(derniere, ref || aujourdhui());
    return j === 0 ? 'Vu aujourd\'hui' : 'Vu il y a ' + j + ' j';
  }
  function etoiles(n) {
    n = lireNote(n);
    return '<span class="note" title="Potentiel de prescription ' + n + ' sur 3" aria-label="Potentiel ' + n + ' sur 3">' +
      '★★★'.slice(0, n) + '<i>' + '★★★'.slice(0, 3 - n) + '</i></span>';
  }
  function badgeConv(v) { return estConventionne(v) ? '<span class="etiquette conv">Conventionné</span>' : '<span class="etiquette">Non conventionné</span>'; }
  function lienCarte(o) {
    if (o.lat && o.lon) return 'https://www.google.com/maps/search/?api=1&query=' + (+o.lat).toFixed(5) + ',' + (+o.lon).toFixed(5);
    var q = [o.lieu, o.quartier, o.commune, 'Abidjan'].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }
  function estKo(statut) { return statut && !Moteur.estVisite(statut, statuts()); }
  function communesListe() {
    var vus = {}, l = [];
    quartiers().forEach(function (q) { if (!vus[q.commune]) { vus[q.commune] = true; l.push({ commune: q.commune, zone: q.zone }); } });
    return l.sort(function (a, b) { return ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone) || a.commune.localeCompare(b.commune, 'fr'); });
  }
  function libelleCommunes(l) {
    if (!l || !l.length) return 'Toutes les communes';
    return l.length <= 3 ? l.join(', ') : l.slice(0, 2).join(', ') + ' et ' + (l.length - 2) + ' autres';
  }

  var $ = function (id) { return document.getElementById(id); };
  var toastTimer;
  function toast(msg, duree) {
    var t = $('toast'); t.textContent = msg; t.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('visible'); }, duree || 3400);
  }

  // ------------------------------------------------------------------ Équipe
  function moi() { return String(S.config.delegue || '').trim(); }
  function estMoi(nom) { return String(nom || '').trim().toLowerCase() === moi().toLowerCase(); }
  function arretsCollegues() {
    return ((S.data && S.data.plannings) || []).filter(function (p) { return p.delegue && !estMoi(p.delegue); });
  }
  // Collègues ayant prévu ce praticien la même semaine que la date donnée
  function cibleParCollegues(code, date) {
    var l = lundiDe(date);
    return arretsCollegues().filter(function (p) { return p.code === code && lundiDe(p.date) === l; });
  }
  function etiquetteCollegues(code, date) {
    var l = cibleParCollegues(code, date);
    if (!l.length) return '';
    var v = l.some(function (p) { return p.programme === 'Validé'; });
    return '<span class="etiquette equipe">' + (v ? 'Ciblé par ' : 'Envisagé par ') + esc(l[0].delegue) + ', ' + dateCourte(l[0].date) +
      (l.length > 1 ? ' (+' + (l.length - 1) + ')' : '') + '</span>';
  }
  function exclusCollegues(dates) {
    var semaines = {}, ex = {};
    dates.forEach(function (d) { semaines[lundiDe(d)] = true; });
    arretsCollegues().forEach(function (p) { if (semaines[lundiDe(p.date)]) ex[p.code] = true; });
    return ex;
  }

  // ------------------------------------------------------------------ API Google Apps Script
  function appel(url, options) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var minuteur = ctrl ? setTimeout(function () { ctrl.abort(); }, 30000) : null;
    if (ctrl) options.signal = ctrl.signal;
    return fetch(url, options).then(function (r) {
      if (!r.ok) throw new Error('Le serveur a répondu ' + r.status + '. Vérifiez l\'URL de l\'application Web.');
      return r.json();
    }, function (e) {
      throw new Error(e && e.name === 'AbortError' ? 'Le serveur ne répond pas (délai dépassé).' :
        'Connexion impossible. Vérifiez le réseau et l\'URL de l\'application Web.');
    }).then(function (j) {
      if (minuteur) clearTimeout(minuteur);
      if (!j || !j.ok) throw new Error((j && j.erreur) || 'Réponse inattendue du serveur.');
      return j;
    });
  }
  function apiGet(action, cfg) {
    cfg = cfg || S.config;
    return appel(cfg.url + (cfg.url.indexOf('?') < 0 ? '?' : '&') + 'action=' + action +
                 '&token=' + encodeURIComponent(cfg.token) + '&_=' + Date.now(), { method: 'GET' });
  }
  function apiPost(action, payload) {
    var body = { token: S.config.token, action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    return appel(S.config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  }
  function connecte() { return !S.config.demo && !!S.config.url; }

  // Tournée publiée : remplace la précédente sur toute la période concernée
  function porteePlan() {
    var d = S.plan.map(function (a) { return a.date; }).sort();
    return d.length ? { debut: d[0], fin: d[d.length - 1] } : null;
  }
  function chargePlan() {
    var p = porteePlan() || { debut: aujourdhui(), fin: aujourdhui() }, ancien = S.ui.portee;
    if (ancien) { if (ancien.debut < p.debut) p.debut = ancien.debut; if (ancien.fin > p.fin) p.fin = ancien.fin; }
    var prog = S.programme.etat === 'valide' ? 'Validé' : 'Proposition';
    return { delegue: moi(), debut: p.debut, fin: p.fin, arrets: S.plan.map(function (a) {
      return { date: a.date, heure: a.heure, creneau: a.creneau, debut: a.debut, fin: a.fin, idPresence: a.idPresence,
               code: a.code, nom: a.nom, specialite: a.specialite, note: a.note, quartier: a.quartier, commune: a.commune,
               lieu: a.lieu, statut: a.statut, etat: a.etat, programme: prog, uid: a.uid };
    }) };
  }
  function publierPlan() {
    if (!connecte()) return;
    S.ui.aPublier = true; LS.set('aPublier', true);
    synchroniser(true);
  }

  function synchroniser(silencieux) {
    if (!connecte()) return Promise.resolve();
    if (S.ui.enCours) return Promise.resolve();
    if (!navigator.onLine) { S.ui.sync = 'horsligne'; afficherEntete(); return Promise.resolve(); }
    S.ui.enCours = true; S.ui.sync = 'encours'; afficherEntete();
    var tentePub = false;
    var envoi = S.queue.length ? apiPost('valider', { visites: S.queue }).then(function (r) {
      var recus = {}; (r.recus || []).forEach(function (u) { recus[u] = true; });
      S.queue = S.queue.filter(function (v) { return !recus[v.uid]; });
      LS.set('queue', S.queue);
    }) : Promise.resolve();
    return envoi.then(function () {
      if (!S.ui.aPublier || !moi()) return;
      tentePub = true;
      return apiPost('planning', chargePlan()).then(function (r) {
        S.ui.aPublier = false; LS.set('aPublier', false);
        S.ui.portee = porteePlan(); LS.set('portee', S.ui.portee);
        S.ui.conflits = r.conflits || [];
      });
    }).then(function () { return apiGet('data'); }).then(function (d) {
      S.data = { version: d.version, praticiens: d.praticiens, presences: d.presences, quartiers: d.quartiers,
                 statuts: d.statuts, historique: d.historique, plannings: d.plannings || [], syncedAt: new Date().toISOString() };
      S.queue.forEach(function (v) { Moteur.appliquerVisite(S.data.praticiens, v, S.data.statuts); });
      LS.set('data', S.data);
      S.ui.sync = 'ok'; S.ui.erreur = '';
      if (S.ui.conflits.length) {
        var conflits = S.ui.conflits; S.ui.conflits = [];
        var remplaces = resoudreConflits(conflits);
        if (remplaces) {
          toast(remplaces + ' médecin' + (remplaces > 1 ? 's' : '') + ' déjà ciblé' + (remplaces > 1 ? 's' : '') +
            ' par un collègue ' + (remplaces > 1 ? 'ont été remplacés' : 'a été remplacé') + ' automatiquement.', 5000);
          S.ui.aPublier = true; LS.set('aPublier', true); tentePub = false;
        } else {
          toast(conflits.length + ' médecin' + (conflits.length > 1 ? 's' : '') + ' de votre tournée ' +
            (conflits.length > 1 ? 'sont' : 'est') + ' aussi ciblé' + (conflits.length > 1 ? 's' : '') + ' par un collègue (étiquette bleue).', 5000);
        }
      }
      if (!silencieux) toast('Données à jour : ' + S.data.praticiens.length + ' praticiens.');
    }).catch(function (e) {
      S.ui.sync = 'erreur'; S.ui.erreur = e.message;
      if (!silencieux) toast(e.message);
    }).then(function () {
      S.ui.enCours = false;
      rendreSiPossible();
      if (S.ui.aPublier && !tentePub && navigator.onLine) setTimeout(function () { synchroniser(true); }, 400);
    });
  }

  // Mise à jour légère : tournées des collègues seulement
  function rafraichirEquipe() {
    if (!connecte() || !navigator.onLine || !S.data) return Promise.resolve(false);
    return apiGet('equipe').then(function (r) {
      S.data.plannings = r.plannings || [];
      LS.set('data', S.data);
      return true;
    }).catch(function () { return false; });
  }

  // ------------------------------------------------------------------ En-tête, barre, navigation
  function afficherEntete() {
    $('enteteDate').textContent = majuscule(dateLongue(aujourdhui())) + (moi() ? ' · ' + moi() : '');
    var p = $('pastilleSync'), etat, texte;
    if (S.config.demo) { etat = 'demo'; texte = 'Démo'; }
    else if (!S.config.url) { etat = 'erreur'; texte = 'Non connecté'; }
    else if (S.ui.sync === 'encours') { etat = 'encours'; texte = 'Synchro…'; }
    else if (!navigator.onLine || S.ui.sync === 'horsligne') { etat = 'horsligne'; texte = S.queue.length ? S.queue.length + ' en attente' : 'Hors ligne'; }
    else if (S.ui.sync === 'erreur') { etat = 'erreur'; texte = 'Erreur synchro'; }
    else if (S.queue.length) { etat = 'attente'; texte = S.queue.length + ' en attente'; }
    else { etat = 'ok'; texte = S.data && S.data.syncedAt ? 'À jour ' + new Date(S.data.syncedAt).toTimeString().slice(0, 5) : 'À jour'; }
    p.dataset.etat = etat; p.textContent = texte;
    p.setAttribute('aria-label', 'Synchronisation : ' + texte + (S.ui.erreur ? '. ' + S.ui.erreur : ''));
  }
  function afficherBarre() {
    var n = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; }).length;
    var visible = S.ui.tab === 'tournee' && n > 0 && !S.ui.feuille;
    $('barreValider').hidden = !visible;
    document.body.classList.toggle('avec-barre', visible);
    $('boutonValider').textContent = 'Enregistrer ' + n + ' compte' + (n > 1 ? 's' : '') + ' rendu' + (n > 1 ? 's' : '') + ' de visite';
  }
  function afficherNav() {
    document.querySelectorAll('.navigation button').forEach(function (b) {
      if (b.dataset.tab === S.ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  // ------------------------------------------------------------------ Rendu
  function rendre() {
    var tab = S.ui.tab;
    if (!pret() && tab !== 'reglages') tab = 'accueil';
    else if (pret() && connecte() && !moi() && tab !== 'reglages') tab = 'identite';
    $('vue').innerHTML = (VUES[tab] || VUES.tournee)();
    rendreFeuille();
    afficherEntete(); afficherBarre(); afficherNav();
  }
  function rendreSiPossible() {
    var a = document.activeElement;
    if (a && (($('vue').contains(a)) || $('feuille').contains(a)) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { afficherEntete(); afficherBarre(); return; }
    rendre();
  }
  var VUES = {};

  // ------------------------------------------------------------------ Vue : accueil et identité
  VUES.accueil = function () {
    return '<section class="accueil">' +
      '<svg class="accueil-ligne" viewBox="0 0 320 40" style="width:100%;height:40px" aria-hidden="true">' +
        '<path d="M10 20H310" stroke="#0E3B43" stroke-width="4"/>' +
        '<circle cx="20" cy="20" r="8" fill="#fff" stroke="#E39E12" stroke-width="4"/>' +
        '<circle cx="110" cy="20" r="8" fill="#2B7D52" stroke="#2B7D52" stroke-width="4"/>' +
        '<circle cx="200" cy="20" r="8" fill="#fff" stroke="#0E3B43" stroke-width="4"/>' +
        '<circle cx="300" cy="20" r="8" fill="#fff" stroke="#0E3B43" stroke-width="4"/></svg>' +
      '<h1>Votre tournée, construite sur le planning de chaque médecin.</h1>' +
      '<p>L\'application choisit les praticiens selon leur potentiel et la date de votre dernière visite, vérifie qu\'ils sont ' +
      'présents au bon endroit et à la bonne heure, et évite ceux que vos collègues ont déjà ciblés. Elle fonctionne aussi sans réseau.</p>' +
      '<button class="bouton bouton-plein" data-a="nav" data-tab="reglages" type="button">Connecter mon Google Sheet</button>' +
      '<button class="bouton" data-a="demo" type="button">Essayer avec des données de démonstration</button></section>';
  };
  VUES.identite = function () {
    return '<section class="accueil"><h1>Qui êtes-vous ?</h1>' +
      '<p>Votre nom apparaît auprès de vos collègues, sur votre tournée et vos visites. Il permet à chacun de savoir quels praticiens sont déjà ciblés.</p>' +
      '<label class="champ"><span>Votre nom</span><input type="text" id="nomDelegue" autocomplete="name" placeholder="Ex. Koffi Yao"></label>' +
      '<label class="champ"><span>Votre numéro WhatsApp (facultatif)</span><input type="tel" id="numWhatsapp" inputmode="tel" placeholder="Ex. 07 07 07 07 07"></label>' +
      '<button class="bouton bouton-plein" data-a="enregistrerNom" type="button">Continuer</button></section>';
  };

  // ------------------------------------------------------------------ Période et paramètres
  function datesPeriode() {
    var p = S.params;
    return p.mode === 'jour' ? [p.dateRef] : joursOuvres(lundiDe(p.dateRef));
  }
  function communesPour(date) {
    var p = S.params, l = p.communes;
    if (p.mode === 'semaine' && p.parJour) {
      var j = p.communesJour[jourSemaineIndex(date)];
      if (j && j.length) l = j;
    }
    return l && l.length ? l : null;
  }
  function departCoord() {
    var q = quartiers().filter(function (x) { return x.quartier === S.config.depart; })[0];
    return q ? { lat: q.lat, lon: q.lon } : null;
  }

  // ------------------------------------------------------------------ Vue : tournée
  VUES.tournee = function () {
    var h = '';
    if (S.ui.voirParams || !S.plan.length) h += rendreParams();
    else h += rendreResume();
    if (!S.plan.length) {
      return h + '<div class="vide"><strong>Aucune tournée pour le moment</strong>Choisissez la période et les communes, puis lancez le tirage.</div>';
    }
    var dates = Array.from(new Set(S.plan.map(function (a) { return a.date; }))).sort();
    if (!S.ui.jour || dates.indexOf(S.ui.jour) < 0) {
      var t = aujourdhui();
      S.ui.jour = dates.indexOf(t) >= 0 ? t : (dates.filter(function (d) { return d >= t; })[0] || dates[0]);
    }
    h += rendreProgramme();
    h += '<div class="jours" role="group" aria-label="Jour">' + dates.map(function (d) {
      var n = S.plan.filter(function (a) { return a.date === d; });
      var faits = n.filter(function (a) { return a.etat === 'valide'; }).length;
      return '<button type="button" class="jour' + (d === aujourdhui() ? ' aujourdhui' : '') + '" data-a="jour" data-v="' + d +
        '" aria-pressed="' + (d === S.ui.jour) + '"><b>' + JOURS_COURTS[jourSemaineIndex(d)].replace('.', '') + ' ' + (+d.slice(8)) +
        '</b><small>' + (faits ? faits + '/' : '') + n.length + ' visite' + (n.length > 1 ? 's' : '') + '</small></button>';
    }).join('') + '</div>';

    var duJour = S.plan.filter(function (a) { return a.date === S.ui.jour; });
    var totalKm = duJour.reduce(function (s, a) { return s + (a.dist || 0); }, 0);
    var n3 = duJour.filter(function (a) { return +a.note === 3; }).length;
    var com = Array.from(new Set(duJour.map(function (a) { return a.commune; })));
    h += '<p class="bilan-jour"><b>' + majuscule(dateLongue(S.ui.jour)) + '</b> : ' + duJour.length + ' visite' +
      (duJour.length > 1 ? 's' : '') + ', environ ' + km(totalKm) + ' de trajet' + (n3 ? ', dont ' + n3 + ' à fort potentiel' : '') +
      '. ' + esc(com.join(', ')) + '.</p>';
    if (S.programme.etat !== 'valide') {
      h += '<div class="rangee rangee-tirage"><button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + 'Nouveau tirage</button>' +
        (S.params.mode === 'semaine' && dates.length > 1 ? '<button class="bouton" type="button" data-a="tirage" data-v="semaine">' + icone('relancer') + 'Semaine entière</button>' : '') +
        '</div><p class="discret aide">Épinglez les médecins à conserver : le nouveau tirage du jour (ou de la semaine) remplace les autres.</p>';
    }
    ['Matin', 'Soir'].forEach(function (cren) {
      var liste = duJour.filter(function (a) { return a.creneau === cren; });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (a, i) {
        if (i > 0 && a.dist > 0) {
          h += '<li class="troncon" aria-hidden="true"><div></div><div class="arret-rail"></div><span>' +
            km(a.dist) + ', environ ' + Math.round(a.dist * REGLAGES_MOTEUR.minutesParKm) + ' min</span></li>';
        }
        h += rendreArret(a);
      });
      h += '</ol>';
    });
    h += rendreCouverture(dates);
    return h;
  };

  function rendreResume() {
    var p = S.params, dates = datesPeriode();
    var com = p.mode === 'semaine' && p.parJour ? 'Secteurs différents selon les jours' : libelleCommunes(p.communes);
    return '<section class="bloc resume-params"><p><b>' +
      (p.mode === 'jour' ? 'Journée du ' + dateCourte(p.dateRef) : 'Semaine du ' + dateCourte(dates[0])) +
      '</b><span class="discret">' + esc(com) + ', ' + p.maxJour + ' visites par jour' +
      (S.imposes.length ? ', ' + S.imposes.length + ' à voir absolument' : '') + '</span></p>' +
      '<button class="bouton" data-a="voirParams" type="button">Modifier</button></section>';
  }

  function rendreParams() {
    var p = S.params;
    var h = '<section class="bloc"><h3 style="margin-top:0">Préparer la tournée</h3>' +
      '<div class="segment" role="group" aria-label="Durée">' +
        '<button type="button" data-a="param" data-k="mode" data-v="jour" aria-pressed="' + (p.mode === 'jour') + '">Une journée</button>' +
        '<button type="button" data-a="param" data-k="mode" data-v="semaine" aria-pressed="' + (p.mode === 'semaine') + '">Une semaine</button>' +
      '</div>' +
      '<label class="champ"><span>' + (p.mode === 'jour' ? 'Date' : 'Semaine du') + '</span>' +
        '<input type="date" data-f="param" data-k="dateRef" value="' + esc(p.dateRef) + '"></label>' +
      '<div class="champ"><span>Communes ciblées</span>' +
        '<button type="button" class="selecteur" data-a="choisirCommunes" data-v="tout">' + esc(libelleCommunes(p.communes)) + '<b>▾</b></button></div>';
    if (p.mode === 'semaine') {
      h += '<label class="interrupteur"><span>Secteurs différents selon les jours</span>' +
        '<input type="checkbox" data-f="param" data-k="parJour"' + (p.parJour ? ' checked' : '') + '></label>';
      if (p.parJour) {
        h += '<div class="secteurs">' + JOURS.map(function (j, i) {
          var l = p.communesJour[i];
          return '<div class="secteur"><span>' + j + '</span><button type="button" class="selecteur" data-a="choisirCommunes" data-v="' + i + '">' +
            esc(l && l.length ? libelleCommunes(l) : 'Comme ci-dessus') + '<b>▾</b></button></div>';
        }).join('') + '</div>';
      }
    }
    h += '<div class="grille-2">' +
        '<label class="champ"><span>Visites par jour</span><input type="number" min="1" max="20" inputmode="numeric" data-f="param" data-k="maxJour" value="' + p.maxJour + '"></label>' +
        '<label class="champ"><span>Délai mini (jours)</span><input type="number" min="0" max="365" inputmode="numeric" data-f="param" data-k="delai" value="' + p.delai + '"></label>' +
      '</div>' +
      (S.config.demo ? '' : '<label class="interrupteur"><span>Écarter les médecins déjà ciblés par un collègue</span>' +
        '<input type="checkbox" data-f="param" data-k="eviterCollegues"' + (p.eviterCollegues !== false ? ' checked' : '') + '></label>');
    h += '<div class="imposes"><div class="imposes-tete"><b>À voir absolument</b>' +
      '<button type="button" class="bouton petit" data-a="ouvrirRecherche">' + icone('plus') + 'Ajouter</button></div>';
    if (!S.imposes.length) {
      h += '<p class="discret" style="margin:6px 0 0">RDV ou médecins incontournables : la tournée est construite autour d\'eux.</p>';
    } else {
      h += '<ul class="liste-imposes">' + S.imposes.map(function (im, i) {
        var pr = praticien(im.code);
        var c = im.cle ? Moteur.creneauParCle(ctx(), im.cle) : null;
        var quand = im.date ? dateCourte(im.date) + (c ? ', ' + c.creneau.toLowerCase() + ', ' + esc(c.lieu) : '') : 'Au meilleur moment de la période';
        return '<li><div><b>' + esc(pr ? pr.nom : im.code) + '</b> ' + (pr ? etoiles(pr.note) : '') +
          '<span class="discret bloc-texte">' + quand + (im.rdv ? ', RDV ' + esc(im.rdv) : '') + '</span></div>' +
          '<button type="button" class="bouton-icone sombre" data-a="retirerImpose" data-i="' + i + '" aria-label="Retirer">' + icone('fermer') + '</button></li>';
      }).join('') + '</ul>';
    }
    h += '</div><button class="bouton bouton-plein bouton-large" data-a="generer" type="button">' + icone('relancer') + 'Lancer le tirage</button>' +
      (S.plan.length ? '<p class="discret" style="margin:10px 0 0">Les visites déjà faites et les médecins épinglés sont conservés.</p>' : '') +
      '</section>';
    return h;
  }

  function rendreProgramme() {
    var dates = datesPeriode();
    if (S.programme.etat === 'valide') {
      return '<section class="bandeau-prog valide"><div><b>Programme validé</b><span>' +
        (S.programme.valideLe ? 'le ' + esc(S.programme.valideLe) : '') + ', visible par l\'équipe</span></div>' +
        '<div class="rangee"><button class="bouton bouton-plein" type="button" data-a="ouvrirExport">' + icone('whatsapp') + 'Envoyer</button>' +
        '<button class="bouton" type="button" data-a="rouvrirProgramme">Modifier</button></div></section>';
    }
    return '<section class="bandeau-prog"><div><b>Proposition</b><span>' +
      (S.params.mode === 'semaine' ? 'Semaine du ' + dateCourte(dates[0]) : 'Journée du ' + dateCourte(dates[0])) +
      '. Ajustez, puis validez le programme.</span></div>' +
      '<div class="rangee"><button class="bouton bouton-plein" type="button" data-a="validerProgramme">' + icone('valider') + 'Valider le programme</button></div></section>';
  }

  function rendreArret(a) {
    var ouvert = S.ui.ouvert === a.uid, verrou = a.etat === 'valide', proposition = S.programme.etat !== 'valide';
    var cls = 'arret' + (ouvert ? ' ouvert' : '') + (verrou ? ' verrouille' : '') + (a.garde ? ' garde' : '') +
      (a.statut ? (estKo(a.statut) ? ' absent' : ' fait') : '');
    var e = '';
    e += badgeConv(a.conventionne);
    e += '<span class="etiquette">' + esc(vuDepuis(a.derniere, a.date)) + '</span>';
    if (a.impose) e += '<span class="etiquette p1">À voir absolument' + (a.rdv ? ', RDV ' + esc(a.rdv) : '') + '</span>';
    if (a.statut) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(a.statut) + (verrou ? ', enregistré' : '') + '</span>';
    if (a.etat === 'ajoute') e += '<span class="etiquette">Ajouté</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    e += etiquetteCollegues(a.code, a.date);

    var h = '<li class="' + cls + '" data-p="' + (+a.note === 3 ? 1 : 3) + '">' +
      '<div class="arret-heure"><b>' + esc(a.heure) + '</b><small>' + esc(a.debut) + '-' + esc(a.fin) + '</small></div>' +
      '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
      '<div><div class="arret-carte">' +
        (proposition && !verrou ? '<button type="button" class="epingle" data-a="garder" data-uid="' + a.uid + '" aria-pressed="' + !!a.garde +
          '" aria-label="' + (a.garde ? 'Ne plus conserver' : 'Conserver au prochain tirage') + '">' + icone('epingle') + '</button>' : '') +
        '<button type="button" class="carte-bouton" data-a="ouvrir" data-uid="' + a.uid + '" aria-expanded="' + ouvert + '">' +
          '<span class="arret-nom">' + esc(a.nom) + ' ' + etoiles(a.note) + '</span>' +
          '<span class="arret-lieu">' + esc(a.specialite) + ', ' + esc(a.lieu) + '</span>' +
          '<span class="arret-lieu">' + esc(a.quartier) + ', ' + esc(a.commune) + '</span>' +
          '<span class="etiquettes">' + e + '</span>' +
        '</button>';
    if (ouvert) {
      h += '<div class="arret-detail">';
      if (!verrou) {
        h += '<div class="statuts" role="group" aria-label="Résultat de la visite">' + statuts().map(function (s) {
          return '<button type="button" class="statut' + (s.visite ? '' : ' ko') + '" data-a="statut" data-uid="' + a.uid +
            '" data-v="' + esc(s.nom) + '" aria-pressed="' + (a.statut === s.nom) + '">' + esc(s.nom) + '</button>';
        }).join('') + '</div>' +
        '<label class="champ"><span>Commentaire</span><textarea data-f="commentaire" data-uid="' + a.uid +
          '" placeholder="Échantillons remis, prochaine étape…">' + esc(a.commentaire) + '</textarea></label>';
      } else if (a.commentaire) {
        h += '<p class="discret" style="margin-top:0">' + esc(a.commentaire) + '</p>';
      }
      h += '<div class="actions-arret">' +
        '<a class="bouton" href="' + lienCarte(a) + '" target="_blank" rel="noopener">' + icone('carte') + 'Y aller</a>' +
        (verrou ? '' : '<button class="bouton" type="button" data-a="rattraper" data-uid="' + a.uid + '">Absent : remplacer</button>') +
        '</div>' +
        (verrou ? '' : '<button class="bouton-texte" type="button" data-a="retirer" data-uid="' + a.uid + '">Retirer de la tournée</button>') +
        '</div>';
    }
    return h + '</div></div></li>';
  }

  // ------------------------------------------------------------------ Couverture géographique
  function rendreCouverture(datesPlan) {
    var portee = S.ui.couvPortee, dates = portee === 'jour' ? [S.ui.jour] : joursOuvres(lundiDe(S.ui.jour));
    var mes = S.plan.filter(function (a) { return dates.indexOf(a.date) >= 0; });
    var eq = arretsCollegues().filter(function (a) { return dates.indexOf(a.date) >= 0; });
    var cv = Moteur.couverture(ctx(), dates, mes, eq);
    var couv = cv.filter(function (c) { return c.moi > 0; }), non = cv.filter(function (c) { return c.moi === 0; });
    var h = '<section class="bloc couverture"><div class="couv-tete"><h3>Couverture</h3>' +
      '<div class="segment petit" role="group" aria-label="Période">' +
        '<button type="button" data-a="couvPortee" data-v="jour" aria-pressed="' + (portee === 'jour') + '">Jour</button>' +
        '<button type="button" data-a="couvPortee" data-v="semaine" aria-pressed="' + (portee === 'semaine') + '">Semaine</button></div></div>' +
      '<p class="discret" style="margin:0 0 8px">' + (portee === 'jour' ? majuscule(dateLongue(S.ui.jour)) : 'Semaine du ' + dateCourte(dates[0])) +
      ' : ' + couv.length + ' commune' + (couv.length > 1 ? 's' : '') + ' couverte' + (couv.length > 1 ? 's' : '') + ' sur ' + cv.length + '.</p>';
    h += carteCouverture(dates, mes, eq);
    h += '<div class="filtres" role="group" aria-label="Filtre">' +
      [['toutes', 'Toutes'], ['couvertes', 'Couvertes (' + couv.length + ')'], ['non', 'Non couvertes (' + non.length + ')']].map(function (x) {
        return '<button type="button" data-a="couvFiltre" data-v="' + x[0] + '" aria-pressed="' + (S.ui.couvFiltre === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>';
    var liste = S.ui.couvFiltre === 'couvertes' ? couv : (S.ui.couvFiltre === 'non' ? non : cv);
    var zone = '';
    h += '<ul class="liste-couv">' + liste.map(function (c) {
      var t = '';
      if (c.zone !== zone) { zone = c.zone; t += '<li class="couv-zone">' + esc(zone) + '</li>'; }
      var eqNoms = Object.keys(c.equipe);
      return t + '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
        '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
        (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non couverte') +
        (eqNoms.length ? ' ; équipe : ' + eqNoms.map(function (n) { return esc(n) + ' (' + c.equipe[n] + ')'; }).join(', ') : '') +
        '</span></div><span class="couv-dispo">' + c.dispo + ' dispo.' + (c.prioritaires ? '<small>' + c.prioritaires + ' ★★★ en retard</small>' : '') + '</span></li>';
    }).join('') + '</ul></section>';
    return h;
  }

  function carteCouverture(dates, mes, eq) {
    var qs = quartiers();
    if (!qs.length) return '';
    var minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    qs.forEach(function (q) { minLat = Math.min(minLat, q.lat); maxLat = Math.max(maxLat, q.lat); minLon = Math.min(minLon, q.lon); maxLon = Math.max(maxLon, q.lon); });
    var W = 360, H = Math.round(W * (maxLat - minLat) / (maxLon - minLon)) + 30, m = 18;
    function x(lon) { return m + (lon - minLon) / (maxLon - minLon) * (W - 2 * m); }
    function y(lat) { return m + (maxLat - lat) / (maxLat - minLat) * (H - 2 * m); }
    var parQ = {}, parQe = {};
    mes.forEach(function (a) { parQ[a.quartier] = (parQ[a.quartier] || 0) + 1; });
    eq.forEach(function (a) { parQe[a.quartier] = (parQe[a.quartier] || 0) + 1; });
    var centres = {};
    qs.forEach(function (q) { var c = centres[q.commune] = centres[q.commune] || { x: 0, y: 0, n: 0 }; c.x += x(q.lon); c.y += y(q.lat); c.n++; });
    var s = '<svg class="carte" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Carte de couverture des quartiers">';
    qs.forEach(function (q) {
      var n = parQ[q.quartier] || 0, ne = parQe[q.quartier] || 0;
      var cls = n ? 'q-moi' : (ne ? 'q-equipe' : 'q-vide');
      var r = n ? Math.min(4 + n * 1.6, 11) : (ne ? 4.5 : 3);
      s += '<circle class="' + cls + '" cx="' + x(q.lon).toFixed(1) + '" cy="' + y(q.lat).toFixed(1) + '" r="' + r.toFixed(1) + '"><title>' +
        esc(q.quartier + ', ' + q.commune + (n ? ' : ' + n + ' visite(s)' : '') + (ne ? ' ; équipe : ' + ne : '')) + '</title></circle>';
    });
    Object.keys(centres).forEach(function (k) {
      var c = centres[k];
      s += '<text x="' + (c.x / c.n).toFixed(1) + '" y="' + (c.y / c.n + 3).toFixed(1) + '">' + esc(k) + '</text>';
    });
    s += '</svg><div class="legende"><span><i class="q-moi"></i>Mes visites</span><span><i class="q-equipe"></i>Équipe</span><span><i class="q-vide"></i>Non couvert</span></div>';
    return s;
  }

  // ------------------------------------------------------------------ Vue : autour de moi
  VUES.autour = function () {
    var A = S.ui.autour, h = '<h2 class="titre-vue">Autour de moi</h2>';
    h += '<p class="sous-titre">Les praticiens présents près de vous, d\'après leur propre planning.</p>';
    if (A.ref) {
      h += '<div class="bandeau"><p>Remplacement de <b>' + esc(A.ref.nom) + '</b> (' + esc(A.ref.heure) + ', ' + esc(A.ref.quartier) +
        '), marqué « Absent ». <button type="button" class="bouton-texte" data-a="finRef">Terminer</button></p></div>';
    }
    var parCommune = {};
    quartiers().forEach(function (q) { (parCommune[q.commune] = parCommune[q.commune] || []).push(q.quartier); });
    h += '<section class="bloc">' +
      '<button class="bouton bouton-large" type="button" data-a="localiser" style="margin-bottom:10px">' + icone('cible') + 'Utiliser ma position</button>' +
      '<label class="champ"><span>Ou choisir un quartier</span><select data-f="autourQuartier">' +
        '<option value="">' + (A.label ? esc(A.label) : 'Choisir un quartier') + '</option>' +
        Object.keys(parCommune).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (c) {
          return '<optgroup label="' + esc(c) + '">' + parCommune[c].map(function (q) { return '<option>' + esc(q) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + '</select></label>' +
      '<div class="segment" role="group" aria-label="Moment">' +
        '<button type="button" data-a="autourMoment" data-v="maintenant" aria-pressed="' + (A.moment === 'maintenant') + '">Maintenant</button>' +
        '<button type="button" data-a="autourMoment" data-v="choisir" aria-pressed="' + (A.moment === 'choisir') + '">Autre moment</button></div>';
    if (A.moment === 'choisir') {
      h += '<div class="grille-2"><label class="champ"><span>Date</span><input type="date" data-f="autour" data-k="date" value="' + esc(A.date || prochainJourOuvre(aujourdhui())) + '"></label>' +
        '<label class="champ"><span>Heure (vide = journée)</span><input type="time" data-f="autour" data-k="heure" value="' + esc(A.heure) + '"></label></div>';
    }
    h += '<div class="filtres" role="group" aria-label="Rayon">' + [2, 5, 10, 20].map(function (r) {
      return '<button type="button" data-a="autourRayon" data-v="' + r + '" aria-pressed="' + (A.rayon === r) + '">' + r + ' km</button>';
    }).join('') + '</div></section>';

    if (A.lat === null) return h + '<div class="vide"><strong>Où êtes-vous ?</strong>Utilisez votre position ou choisissez un quartier.</div>';
    var date, minute;
    if (A.moment === 'maintenant') { date = aujourdhui(); minute = minutesMaintenant(); }
    else { date = A.date || prochainJourOuvre(aujourdhui()); minute = heureVersMinutes(A.heure); }
    if (jourSemaineIndex(date) > 4) {
      return h + '<div class="vide"><strong>Pas de présences le week-end</strong>Choisissez « Autre moment » et un jour de semaine.</div>';
    }
    var res = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, A.rayon)
      .filter(function (x) { return !A.ref || x.c.code !== A.ref.code; });
    S.ui.resAutour = res;
    var groupes = minute === null ? [['matin', 'Le matin'], ['soir', 'Le soir']] :
      [['present', 'Présents maintenant'], ['plustard', 'Plus tard dans la journée']];
    h += '<p class="discret">' + majuscule(dateLongue(date)) + (minute !== null ? ', ' + minutesVersHeure(minute) : '') +
      ', autour de ' + esc(A.label || 'votre position') + ' : ' + res.length + ' praticien' + (res.length > 1 ? 's' : '') + '.</p>';
    groupes.forEach(function (g) {
      var l = res.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.etat === g[0]; });
      h += '<h3>' + g[1] + ' (' + l.length + ')</h3>';
      if (!l.length) { h += '<p class="discret">Aucun praticien dans ce rayon.</p>'; return; }
      h += '<ul class="liste">' + l.slice(0, 25).map(function (o) { return rendreProposition(o.x, o.i, date); }).join('') + '</ul>';
    });
    if (A.ref) {
      var autres = (ctx().parCode[A.ref.code] || []).filter(function (c) { return c.cle !== A.ref.cle; });
      h += '<h3>Autres présences de ' + esc(A.ref.nom) + '</h3>';
      h += autres.length ? '<ul class="liste">' + autres.map(function (c) {
        var d = prochaineOccurrence(c.jourIdx, A.ref.date, c.creneau === 'Soir' && A.ref.creneau === 'Matin');
        return '<li class="element"><div class="element-tete"><div><b>' + esc(c.jour) + ' ' + c.creneau.toLowerCase() + '</b>, ' +
          minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '<span class="discret bloc-texte">' + esc(c.lieu) + ', ' + esc(c.quartier) + '</span></div></div>' +
          '<button class="bouton bouton-large" type="button" data-a="planifierCle" data-v="' + esc(c.cle) + '" data-d="' + d + '">Planifier le ' + dateCourte(d) + '</button></li>';
      }).join('') + '</ul>' : '<p class="discret">Pas d\'autre présence connue.</p>';
    }
    return h;
  };

  function prochaineOccurrence(jourIdx, depuis, memeJourPossible) {
    var delta = jourIdx - jourSemaineIndex(depuis);
    if (delta < 0 || (delta === 0 && !memeJourPossible)) delta += 7;
    return ajouterJours(depuis, delta);
  }

  function rendreProposition(x, i, date) {
    var c = x.c, p = c.prat;
    var deja = S.plan.some(function (a) { return a.date === date && a.code === p.code; });
    return '<li class="element"><div class="element-tete"><div>' +
      '<span class="element-titre">' + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
      '<span class="discret bloc-texte">' + esc(p.specialite) + ', ' + esc(c.lieu) + '</span>' +
      '<span class="discret bloc-texte">' + esc(c.quartier) + ', ' + c.creneau.toLowerCase() + ' ' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '</span>' +
      '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere, date)) + '</span>' +
      etiquetteCollegues(p.code, date) + '</span></div>' +
      '<div class="element-mesure">' + km(x.dist) + '<small>score ' + Math.round(x.score) + '</small></div></div>' +
      (deja ? '<p class="discret" style="margin:8px 0 0">Déjà dans votre tournée ce jour-là.</p>' :
        '<div class="rangee" style="margin-top:10px"><a class="bouton" href="' + lienCarte({ lat: c.coord && c.coord.lat, lon: c.coord && c.coord.lon }) + '" target="_blank" rel="noopener">' + icone('carte') + 'Y aller</a>' +
        '<button class="bouton bouton-plein" type="button" data-a="ajouterAutour" data-i="' + i + '" data-d="' + date + '">Ajouter au ' + dateCourte(date) + '</button></div>') +
      '</li>';
  }

  // ------------------------------------------------------------------ Vue : équipe
  VUES.equipe = function () {
    var h = '<h2 class="titre-vue">Équipe</h2>';
    if (S.config.demo) return h + '<div class="vide"><strong>Disponible avec le Google Sheet</strong>Les tournées de vos collègues s\'affichent ici une fois l\'application connectée.</div>';
    var depuis = lundiDe(aujourdhui());
    var arrets = arretsCollegues().filter(function (p) { return p.date >= depuis; });
    var noms = Array.from(new Set(arrets.map(function (p) { return p.delegue; }))).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    h += '<p class="sous-titre">Tournées publiées par vos collègues, rafraîchies toutes les 2 minutes.</p>';
    if (!noms.length) return h + '<div class="vide"><strong>Aucune tournée publiée</strong>Les tournées apparaissent ici dès qu\'un collègue lance un tirage.</div>';
    h += '<ul class="liste resume-equipe">' + noms.map(function (n) {
      var l = arrets.filter(function (p) { return p.delegue === n; });
      var valide = l.some(function (p) { return p.programme === 'Validé'; });
      var com = Array.from(new Set(l.map(function (p) { return p.commune; })));
      return '<li><button type="button" data-a="collegue" data-v="' + esc(n) + '" aria-pressed="' + (n === S.ui.collegue) + '">' +
        '<b>' + esc(n) + '</b><span class="etiquette ' + (valide ? 'ok' : '') + '">' + (valide ? 'Validé' : 'Proposition') + '</span>' +
        '<span class="discret bloc-texte">' + l.length + ' visites, ' + esc(libelleCommunes(com)) + '</span></button></li>';
    }).join('') + '</ul>';
    if (noms.indexOf(S.ui.collegue) < 0) S.ui.collegue = noms[0];
    var siens = arrets.filter(function (p) { return p.delegue === S.ui.collegue; });
    var dates = Array.from(new Set(siens.map(function (p) { return p.date; }))).sort();
    if (!S.ui.jourEquipe || dates.indexOf(S.ui.jourEquipe) < 0) {
      var t = aujourdhui();
      S.ui.jourEquipe = dates.indexOf(t) >= 0 ? t : (dates.filter(function (d) { return d >= t; })[0] || dates[0]);
    }
    h += '<div class="jours" role="group" aria-label="Jour">' + dates.map(function (d) {
      var n = siens.filter(function (p) { return p.date === d; }).length;
      return '<button type="button" class="jour" data-a="jourEquipe" data-v="' + d + '" aria-pressed="' + (d === S.ui.jourEquipe) +
        '"><b>' + JOURS_COURTS[jourSemaineIndex(d)].replace('.', '') + ' ' + (+d.slice(8)) + '</b><small>' + n + ' visite' + (n > 1 ? 's' : '') + '</small></button>';
    }).join('') + '</div>';
    var duJour = siens.filter(function (p) { return p.date === S.ui.jourEquipe; });
    var maj = duJour.reduce(function (m, p) { return p.maj > m ? p.maj : m; }, '');
    h += '<p class="bilan-jour"><b>' + esc(S.ui.collegue) + '</b>, ' + dateLongue(S.ui.jourEquipe) + ' : ' + duJour.length +
      ' visite' + (duJour.length > 1 ? 's' : '') + (maj ? '. Mise à jour le ' + esc(maj.slice(8, 10) + '/' + maj.slice(5, 7) + ' à ' + maj.slice(11, 16)) : '') + '.</p>';
    ['Matin', 'Soir'].forEach(function (cren) {
      var liste = duJour.filter(function (p) { return p.creneau === cren; });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (p) {
        var ko = p.statut && estKo(p.statut);
        h += '<li class="arret' + (p.statut ? (ko ? ' absent' : ' fait') : '') + '" data-p="' + (+p.note === 3 ? 1 : 3) + '">' +
          '<div class="arret-heure"><b>' + esc(p.heure || '--:--') + '</b><small>' + esc(p.debut) + '-' + esc(p.fin) + '</small></div>' +
          '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
          '<div><div class="arret-carte"><span class="arret-nom">' + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
          '<span class="arret-lieu">' + esc(p.specialite) + ', ' + esc(p.lieu) + '</span>' +
          '<span class="arret-lieu">' + esc(p.quartier) + ', ' + esc(p.commune) + '</span>' +
          (p.statut ? '<span class="etiquettes"><span class="etiquette ' + (ko ? 'ko' : 'ok') + '">' + esc(p.statut) + '</span></span>' : '') +
          '</div></div></li>';
      });
      h += '</ol>';
    });
    return h;
  };

  // ------------------------------------------------------------------ Vue : contacts
  VUES.contacts = function () {
    var f = S.ui.filtre, q = normaliser(S.ui.recherche);
    var t = aujourdhui(), c = ctx();
    var liste = Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
      if (f === 'note3' && p.note !== 3) return false;
      if (f === 'conv' && !p.conv) return false;
      if (f === 'medecins' && p.type !== 'Médecin') return false;
      if (f === 'pharmacies' && p.type !== 'Pharmacie') return false;
      if (f === 'retard' && joursEcoules(p.derniere, t) < REGLAGES_MOTEUR.cadence[p.note]) return false;
      if (f === 'equipe' && !cibleParCollegues(p.code, t).length) return false;
      if (!q) return true;
      var lieux = (c.presencesParCode[p.code] || []).map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
      return normaliser(p.nom + ' ' + p.specialite + ' ' + lieux).indexOf(q) >= 0;
    });
    liste.sort(function (a, b) { return b.note - a.note || joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t); });
    var h = '<h2 class="titre-vue">Contacts</h2>' +
      '<div class="recherche">' + icone('loupe') + '<input type="search" data-f="recherche" placeholder="Nom, spécialité, lieu, quartier…" value="' + esc(S.ui.recherche) + '" aria-label="Rechercher un praticien"></div>' +
      '<div class="filtres" role="group" aria-label="Filtre">' +
      [['tous', 'Tous'], ['note3', '★★★'], ['conv', 'Conventionnés'], ['retard', 'En retard'], ['equipe', 'Ciblés par l\'équipe'], ['medecins', 'Médecins'], ['pharmacies', 'Pharmacies']].map(function (x) {
        return '<button type="button" data-a="filtre" data-v="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      '<p class="discret">' + liste.length + ' praticien' + (liste.length > 1 ? 's' : '') + '. Pour ajouter ou modifier un praticien ou son planning, utilisez le Google Sheet (feuilles Praticiens et Presences).</p><ul class="liste">';
    liste.slice(0, S.ui.limite).forEach(function (p) {
      var ouvert = S.ui.contactOuvert === p.code, lieux = c.presencesParCode[p.code] || [];
      h += '<li class="element"><button type="button" class="carte-bouton" data-a="contact" data-v="' + esc(p.code) + '" aria-expanded="' + ouvert + '">' +
        '<span class="element-titre">' + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
        '<span class="discret bloc-texte">' + esc(p.specialite) + ', ' + lieux.length + ' lieu' + (lieux.length > 1 ? 'x' : '') + ' : ' +
          esc(Array.from(new Set(lieux.map(function (x) { return x.commune; }))).join(', ')) + '</span>' +
        '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere)) + '</span>' +
        (p.statut ? '<span class="etiquette ' + (estKo(p.statut) ? 'ko' : 'ok') + '">' + esc(p.statut) + '</span>' : '') +
        etiquetteCollegues(p.code, t) + '</span></button>';
      if (ouvert) {
        if (p.commentaire) h += '<p class="discret" style="margin:10px 0 0">Dernier commentaire : ' + esc(p.commentaire) + '</p>';
        h += grillePresences(p.code);
        var impose = S.imposes.some(function (im) { return im.code === p.code; });
        h += '<div class="rangee" style="margin-top:10px">' +
          (impose ? '<span class="etiquette p1">Dans « À voir absolument »</span>' :
            '<button class="bouton bouton-plein" type="button" data-a="imposerDirect" data-v="' + esc(p.code) + '">À voir absolument</button>') +
          '</div>';
      }
      h += '</li>';
    });
    h += '</ul>';
    if (liste.length > S.ui.limite) h += '<button class="bouton bouton-large" type="button" data-a="plus">Afficher plus</button>';
    return h;
  };

  // Planning hebdomadaire d'un praticien (lieux x jours)
  function grillePresences(code) {
    var c = ctx(), lieux = c.presencesParCode[code] || [];
    if (!lieux.length) return '<p class="discret">Aucune présence renseignée.</p>';
    var h = '<div class="grille-pres"><table><thead><tr><th>Lieu</th>' + JOURS.map(function (j) { return '<th>' + j.slice(0, 3) + '</th>'; }).join('') + '</tr></thead><tbody>';
    lieux.forEach(function (pr) {
      var hM = lireHoraire(pr.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      h += '<tr><td><b>' + esc(pr.lieu) + '</b><small>' + esc(pr.quartier) + ', ' + esc(pr.commune) + '<br>Matin ' + minutesVersHeure(hM[0]) + '-' + minutesVersHeure(hM[1]) +
        ', soir ' + minutesVersHeure(hS[0]) + '-' + minutesVersHeure(hS[1]) + '</small></td>' +
        JOURS_CLES.map(function (j, i) {
          var d = lireDispo(pr[j]);
          var t = d.matin && d.soir ? 'M S' : (d.matin ? 'M' : (d.soir ? 'S' : ''));
          if (!t) return '<td></td>';
          var cleM = pr.id + '|' + i + '|Matin', cleS = pr.id + '|' + i + '|Soir';
          return '<td class="dispo">' + (d.matin ? '<button type="button" data-a="planifierCle" data-v="' + esc(cleM) + '" title="Planifier ' + JOURS[i] + ' matin">M</button>' : '') +
            (d.soir ? '<button type="button" data-a="planifierCle" data-v="' + esc(cleS) + '" title="Planifier ' + JOURS[i] + ' soir">S</button>' : '') + '</td>';
        }).join('') + '</tr>';
    });
    return h + '</tbody></table><p class="discret">Touchez M (matin) ou S (soir) pour planifier une visite à la prochaine présence.</p></div>';
  }

  // ------------------------------------------------------------------ Vue : historique
  VUES.historique = function () {
    var enAttente = S.queue.slice().reverse().map(function (v) { v = Object.assign({}, v); v.attente = true; return v; });
    var tout = enAttente.concat((S.data.historique || []).filter(function (v) { return !S.queue.some(function (q) { return q.uid === v.uid; }); }));
    var hist = tout.filter(function (v) { return !v.delegue || estMoi(v.delegue); });
    var t = aujourdhui(), lundi = lundiDe(t), mois = t.slice(0, 7), il30 = ajouterJours(t, -30);
    var compte = function (v) { return Moteur.estVisite(v.statut, statuts()); };
    var sem = hist.filter(function (v) { return v.date >= lundi && compte(v); }).length;
    var moisN = hist.filter(function (v) { return String(v.date).slice(0, 7) === mois && compte(v); }).length;
    var derniers = hist.filter(function (v) { return v.date >= il30; });
    var taux = derniers.length ? 100 * derniers.filter(compte).length / derniers.length : null;
    var h = '<h2 class="titre-vue">Historique</h2><div class="chiffres">' +
      '<div class="chiffre"><b>' + sem + '</b><span>visites cette semaine</span></div>' +
      '<div class="chiffre"><b>' + moisN + '</b><span>visites ce mois-ci</span></div>' +
      '<div class="chiffre"><b>' + (taux === null ? 'n.d.' : pct(taux)) + '</b><span>présence sur 30 jours</span></div></div>';
    if (S.queue.length) h += '<div class="bandeau"><p>' + S.queue.length + ' compte(s) rendu(s) en attente d\'envoi. Ils partiront dès que le réseau revient.</p></div>';
    if (!S.config.demo) {
      h += '<div class="filtres" role="group" aria-label="Visites affichées">' +
        '<button type="button" data-a="histFiltre" data-v="moi" aria-pressed="' + (S.ui.histFiltre !== 'equipe') + '">Mes visites</button>' +
        '<button type="button" data-a="histFiltre" data-v="equipe" aria-pressed="' + (S.ui.histFiltre === 'equipe') + '">Toute l\'équipe</button></div>';
    }
    var liste = S.ui.histFiltre === 'equipe' ? tout : hist;
    if (!liste.length) return h + '<div class="vide"><strong>Aucune visite enregistrée</strong>Les comptes rendus enregistrés depuis la tournée apparaîtront ici.</div>';
    return h + '<ul class="liste">' + liste.slice(0, 150).map(function (v) {
      return '<li class="element"><div class="element-tete"><div>' +
        '<span class="element-titre">' + esc(v.nom) + '</span>' +
        '<span class="discret bloc-texte">' + esc(v.lieu) + ', ' + esc(v.quartier) + '</span>' +
        (v.commentaire ? '<span class="bloc-texte" style="margin-top:4px">' + esc(v.commentaire) + '</span>' : '') +
        '<span class="etiquettes"><span class="etiquette ' + (compte(v) ? 'ok' : 'ko') + '">' + esc(v.statut) + '</span>' +
        (v.attente ? '<span class="etiquette p1">En attente d\'envoi</span>' : '') +
        (v.delegue && !estMoi(v.delegue) ? '<span class="etiquette equipe">' + esc(v.delegue) + '</span>' : '') + '</span></div>' +
        '<div class="element-mesure">' + (v.date ? dateCourte(v.date) : '') + '<small>' + esc(v.creneau) + '</small></div></div></li>';
    }).join('') + '</ul>';
  };

  // ------------------------------------------------------------------ Vue : réglages
  VUES.reglages = function () {
    var c = S.config;
    var qOpts = '<option value="">Aucun (début au premier rendez-vous)</option>' + quartiers().map(function (q) {
      return '<option' + (q.quartier === c.depart ? ' selected' : '') + '>' + esc(q.quartier) + '</option>';
    }).join('');
    var h = '<h2 class="titre-vue">Réglages</h2>';
    h += '<section class="bloc"><h3 style="margin-top:0">Moi</h3>' +
      '<label class="champ"><span>Votre nom (visible par vos collègues)</span><input type="text" id="cfgNom" autocomplete="name" value="' + esc(c.delegue || '') + '"></label>' +
      '<label class="champ"><span>Votre numéro WhatsApp</span><input type="tel" id="cfgWhatsapp" inputmode="tel" placeholder="Ex. 07 07 07 07 07" value="' + esc(c.whatsapp || '') + '"></label>' +
      '<label class="interrupteur"><span>Toujours ouvrir WhatsApp Web</span><input type="checkbox" id="cfgWaWeb"' + (c.waWeb ? ' checked' : '') + '></label>' +
      '<label class="champ"><span>Point de départ habituel</span><select id="cfgDepart">' + qOpts + '</select></label>' +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="enregistrerMoi">Enregistrer</button></section>';
    h += '<section class="bloc"><h3 style="margin-top:0">Connexion au Google Sheet</h3>' +
      '<label class="champ"><span>URL de l\'application Web</span><input type="url" id="cfgUrl" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>' +
      '<label class="champ"><span>Jeton d\'accès</span><input type="text" id="cfgToken" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(c.token) + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="tester">Tester</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="enregistrerConnexion">Enregistrer</button></div>' +
      (S.ui.erreur ? '<p class="discret" style="color:var(--rouge);margin-bottom:0">' + esc(S.ui.erreur) + '</p>' : '') + '</section>';
    h += '<section class="bloc"><h3 style="margin-top:0">Données</h3><p class="discret" style="margin-top:0">' +
      (S.config.demo ? 'Mode démonstration : les données restent sur ce téléphone.' :
        (S.data && S.data.syncedAt ? 'Dernière synchronisation : ' + new Date(S.data.syncedAt).toLocaleString('fr-FR') + '.' : 'Pas encore synchronisé.')) +
      (pret() ? ' ' + S.data.praticiens.length + ' praticiens, ' + S.data.presences.length + ' lieux de présence.' : '') +
      (S.queue.length ? ' ' + S.queue.length + ' compte(s) rendu(s) en attente.' : '') + '</p>' +
      (connecte() ? '<button class="bouton bouton-large" type="button" data-a="sync" style="margin-bottom:10px">Synchroniser maintenant</button>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="partager" style="margin-bottom:6px">Partager l\'application avec un collègue</button>' +
        '<p class="discret" style="margin-top:0">Le lien donne accès à la base : envoyez-le uniquement à vos collègues.</p>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="demo" style="margin-bottom:10px">Charger les données de démonstration</button>' +
      '<button class="bouton bouton-large bouton-danger" type="button" data-a="reinitialiser">Effacer les données de ce téléphone</button></section>';
    h += '<section class="bloc"><h3 style="margin-top:0">Installer sur le téléphone</h3>' +
      (S.ui.installEvt ? '<button class="bouton bouton-plein bouton-large" type="button" data-a="installer">Installer l\'application</button>' :
        '<p class="discret" style="margin:0">Android (Chrome) : menu ⋮ puis « Installer l\'application ». iPhone (Safari) : bouton Partager puis « Sur l\'écran d\'accueil ».</p>') +
      '</section><p class="discret" style="text-align:center">Tournées, version 3.0</p>';
    return h;
  };

  // ------------------------------------------------------------------ Feuilles (fenêtres du bas)
  function rendreFeuille() {
    var f = S.ui.feuille, el = $('feuille');
    if (!f) { el.hidden = true; el.innerHTML = ''; document.body.classList.remove('feuille-ouverte'); return; }
    el.hidden = false; document.body.classList.add('feuille-ouverte');
    var contenu = FEUILLES[f.type](f);
    el.innerHTML = '<div class="voile" data-a="fermerFeuille"></div><div class="feuille" role="dialog" aria-modal="true" aria-label="' + esc(f.titre || '') + '">' +
      '<div class="feuille-tete"><b>' + esc(f.titre || '') + '</b><button type="button" class="bouton-icone sombre" data-a="fermerFeuille" aria-label="Fermer">' + icone('fermer') + '</button></div>' +
      '<div class="feuille-corps">' + contenu + '</div></div>';
  }
  var FEUILLES = {};

  FEUILLES.communes = function (f) {
    var sel = {}; f.sel.forEach(function (c) { sel[c] = true; });
    var zone = '', h = '<p class="discret" style="margin-top:0">' + (f.cle === 'tout' ? 'Aucune sélection = toutes les communes.' :
      'Aucune sélection = les communes choisies pour la semaine.') + '</p>';
    communesListe().forEach(function (c) {
      if (c.zone !== zone) {
        if (zone) h += '</div>';
        zone = c.zone;
        h += '<div class="zone-tete"><b>' + esc(zone) + '</b><button type="button" class="bouton-texte" data-a="zoneToggle" data-v="' + esc(zone) + '">Toute la zone</button></div><div class="puces">';
      }
      h += '<button type="button" class="puce" data-a="communeToggle" data-v="' + esc(c.commune) + '" aria-pressed="' + !!sel[c.commune] + '">' + esc(c.commune) + '</button>';
    });
    h += '</div><div class="rangee" style="margin-top:14px"><button class="bouton" type="button" data-a="communesAucune">Effacer</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="communesOk">Valider (' + (f.sel.length || 'toutes') + ')</button></div>';
    return h;
  };

  FEUILLES.recherche = function (f) {
    var c = ctx(), q = normaliser(f.q || ''), h = '';
    if (!f.code) {
      h += '<div class="recherche">' + icone('loupe') + '<input type="search" id="rechercheImpose" data-f="rechercheImpose" placeholder="Nom, spécialité, lieu…" value="' + esc(f.q || '') + '" autofocus></div>';
      if (q.length < 2) return h + '<p class="discret">Tapez au moins 2 lettres.</p>';
      var res = Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
        var lieux = (c.presencesParCode[p.code] || []).map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
        return normaliser(p.nom + ' ' + p.specialite + ' ' + lieux).indexOf(q) >= 0;
      }).slice(0, 30);
      if (!res.length) return h + '<p class="discret">Aucun praticien trouvé.</p>';
      return h + '<ul class="liste">' + res.map(function (p) {
        return '<li><button type="button" class="element carte-bouton" data-a="choisirImpose" data-v="' + esc(p.code) + '">' +
          '<span class="element-titre">' + esc(p.nom) + ' ' + etoiles(p.note) + '</span><span class="discret bloc-texte">' + esc(p.specialite) + ', ' +
          esc(Array.from(new Set((c.presencesParCode[p.code] || []).map(function (x) { return x.commune; }))).join(', ')) + '</span></button></li>';
      }).join('') + '</ul>';
    }
    var p = c.prat[f.code], dates = datesPeriode();
    var options = [];
    dates.forEach(function (d) {
      var j = jourSemaineIndex(d);
      (c.parCode[f.code] || []).forEach(function (cr) { if (cr.jourIdx === j) options.push({ d: d, c: cr }); });
    });
    h += '<p><b>' + esc(p.nom) + '</b> ' + etoiles(p.note) + '<span class="discret bloc-texte">' + esc(p.specialite) + '</span></p>';
    h += '<p class="discret">Présences sur la période :</p>';
    h += '<div class="choix-creneaux"><label class="choix"><input type="radio" name="impCle" value=""' + (!f.cle ? ' checked' : '') + '><span><b>Au meilleur moment</b><small>L\'application choisit le jour le plus pratique</small></span></label>' +
      options.map(function (o) {
        var v = o.d + '|' + o.c.cle;
        return '<label class="choix"><input type="radio" name="impCle" value="' + esc(v) + '"' + (f.cle === v ? ' checked' : '') + '><span><b>' +
          majuscule(dateCourte(o.d)) + ', ' + o.c.creneau.toLowerCase() + ' ' + minutesVersHeure(o.c.debut) + '-' + minutesVersHeure(o.c.fin) + '</b><small>' +
          esc(o.c.lieu) + ', ' + esc(o.c.quartier) + '</small></span></label>';
      }).join('') + '</div>';
    if (!options.length) h += '<p class="discret" style="color:var(--rouge)">Ce praticien n\'est présent aucun jour de la période choisie.</p>';
    h += '<label class="champ"><span>Heure de RDV (facultatif)</span><input type="time" id="impRdv" value="' + esc(f.rdv || '') + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="retourRecherche">Retour</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="ajouterImpose"' + (options.length ? '' : ' disabled') + '>Ajouter</button></div>';
    return h;
  };

  FEUILLES.exporter = function (f) {
    var dates = f.portee === 'jour' ? [S.ui.jour] : Array.from(new Set(S.plan.map(function (a) { return a.date; }))).sort();
    var texte = texteProgramme(dates);
    f.texte = texte;
    var num = normaliserNumero(S.config.whatsapp);
    return '<div class="segment" role="group" aria-label="Contenu"><button type="button" data-a="exportPortee" data-v="jour" aria-pressed="' + (f.portee === 'jour') + '">Le ' + dateCourte(S.ui.jour) + '</button>' +
      '<button type="button" data-a="exportPortee" data-v="semaine" aria-pressed="' + (f.portee !== 'jour') + '">Tout le programme</button></div>' +
      '<pre class="apercu">' + esc(texte) + '</pre>' +
      (texte.length > 3500 ? '<p class="discret">Message long : si WhatsApp le coupe, envoyez jour par jour.</p>' : '') +
      (num ? '<p class="discret">Envoi vers votre numéro +' + esc(num) + (S.config.waWeb || !estMobile() ? ', avec WhatsApp Web.' : ', avec l\'application WhatsApp.') + '</p>' :
        '<p class="discret">Renseignez votre numéro dans les Réglages pour l\'envoyer directement dans votre conversation.</p>') +
      '<button class="bouton bouton-plein bouton-large wa" type="button" data-a="envoyerWhatsapp">' + icone('whatsapp') + 'Envoyer sur WhatsApp</button>' +
      '<div class="rangee" style="margin-top:10px"><button class="bouton" type="button" data-a="copierTexte">Copier le texte</button>' +
      (navigator.share ? '<button class="bouton" type="button" data-a="partagerTexte">Partager…</button>' : '') + '</div>';
  };

  // ------------------------------------------------------------------ Export du programme
  function estMobile() {
    try { return window.matchMedia('(pointer: coarse)').matches && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); } catch (e) { return false; }
  }
  function normaliserNumero(n) {
    var d = String(n || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.length === 10 && d.charAt(0) === '0') d = '225' + d;
    else if (d.length === 8) d = '225' + d;
    else if (d.length === 10 && d.indexOf('225') !== 0) d = '225' + d;
    return d.length >= 11 ? d : '';
  }
  function lienItineraire(arrets) {
    var pts = arrets.filter(function (a) { return a.lat && a.lon; }).map(function (a) { return (+a.lat).toFixed(5) + ',' + (+a.lon).toFixed(5); });
    var liens = [];
    for (var i = 0; i < pts.length; i += 9) {
      var morceau = pts.slice(i === 0 ? 0 : i - 1, i + 10 - (i === 0 ? 0 : 1));
      if (i > 0 && morceau.length < 2) break;
      if (morceau.length === 1) { liens.push('https://www.google.com/maps/search/?api=1&query=' + morceau[0]); break; }
      var url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + morceau[0] + '&destination=' + morceau[morceau.length - 1];
      if (morceau.length > 2) url += '&waypoints=' + morceau.slice(1, -1).join('%7C');
      liens.push(url);
      if (i + 10 >= pts.length) break;
    }
    return liens;
  }
  // Message court : pour chaque jour, le médecin, sa spécialité, l'établissement et le secteur
  function texteProgramme(dates) {
    var lignes = ['*Programme ' + (dates.length > 1 ? 'du ' + dateCourte(dates[0]) + ' au ' + dateCourte(dates[dates.length - 1]) : 'du ' + dateCourte(dates[0])) + '*'];
    dates.forEach(function (d) {
      var l = S.plan.filter(function (a) { return a.date === d; });
      if (!l.length) return;
      lignes.push('', '*' + majuscule(dateCourte(d)) + '*');
      l.forEach(function (a) {
        lignes.push('- ' + a.nom + ', ' + a.specialite + ', ' + a.lieu + ', ' + a.quartier);
      });
    });
    return lignes.join('\n');
  }
  function urlWhatsapp(texte) {
    var num = normaliserNumero(S.config.whatsapp), t = encodeURIComponent(texte);
    if (S.config.waWeb || !estMobile()) return 'https://web.whatsapp.com/send?' + (num ? 'phone=' + num + '&' : '') + 'text=' + t;
    return 'https://wa.me/' + num + '?text=' + t;
  }

  // ------------------------------------------------------------------ Actions sur la tournée
  function arret(uid) { return S.plan.filter(function (a) { return a.uid === uid; })[0]; }

  function reordonner(date) {
    var autres = S.plan.filter(function (a) { return a.date !== date; });
    var jour = Moteur.ordonnerJour(S.plan.filter(function (a) { return a.date === date; }), departCoord());
    S.plan = autres.concat(jour).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    trierPlan();
  }
  function trierPlan() {
    var ordre = {};
    S.plan.forEach(function (a, i) { ordre[a.uid] = i; });
    S.plan.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return ordre[a.uid] - ordre[b.uid];
    });
  }

  // Premier arrivé, premier servi : les médecins qu'un collègue avait ciblés avant nous sont
  // remplacés automatiquement, sauf ceux épinglés, imposés ou déjà visités (simplement signalés).
  function resoudreConflits(conflits) {
    if (S.programme.etat === 'valide') return 0;
    var touches = {}, dates = {}, codes = {};
    conflits.forEach(function (c) {
      codes[c.code] = true;
      S.plan.forEach(function (a) {
        if (a.code === c.code && a.date === c.date && !a.garde && !a.impose && a.etat !== 'valide' && !a.statut) {
          touches[a.uid] = true; dates[a.date] = true; S.rejetes[a.code] = true;
        }
      });
    });
    var d = Object.keys(dates).sort();
    if (!d.length) return 0;
    var p = S.params, reste = S.plan.filter(function (a) { return !touches[a.uid]; });
    var exclus = exclusCollegues(d);
    Object.keys(codes).forEach(function (c) { exclus[c] = true; });
    reste.forEach(function (a) { if (d.indexOf(a.date) < 0) exclus[a.code] = true; });
    var r = Moteur.genererPlanning(ctx(), {
      dates: d, communesPour: communesPour, maxJour: +p.maxJour || 8, delai: +p.delai || 0, exclus: exclus,
      rejetes: S.rejetes, conserves: reste.filter(function (a) { return d.indexOf(a.date) >= 0; }), imposes: [], depart: departCoord()
    });
    S.plan = reste.filter(function (a) { return d.indexOf(a.date) < 0; }).concat(r.arrets);
    trierPlan(); sauver();
    return Object.keys(touches).length;
  }

  function avantTirage() {
    if (!connecte() || !navigator.onLine) return Promise.resolve();
    toast('Vérification des tournées de l\'équipe…', 2000);
    return Promise.race([rafraichirEquipe(), new Promise(function (r) { setTimeout(r, 8000); })]);
  }

  function lancerTirage(portee) {
    var p = S.params;
    if (p.mode === 'jour' && jourSemaineIndex(p.dateRef) > 4) { toast('Choisissez un jour de semaine.'); return; }
    var renseignees = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; }).length;
    if (renseignees && !confirm(renseignees + ' compte(s) rendu(s) non enregistré(s) seront perdus. Continuer ?')) return;
    avantTirage().then(function () {
      var periode = datesPeriode();
      var cible = portee === 'jour' ? [S.ui.jour] : (portee === 'semaine' ? Array.from(new Set(S.plan.map(function (a) { return a.date; }))).sort() : periode);
      if (portee === 'nouveau') S.rejetes = {};
      // Médecins écartés au nouveau tirage : ceux qui étaient proposés et non conservés
      if (portee === 'jour' || portee === 'semaine') {
        S.plan.forEach(function (a) {
          if (cible.indexOf(a.date) >= 0 && !a.garde && !a.impose && a.etat !== 'valide') S.rejetes[a.code] = true;
        });
      }
      var conserves = S.plan.filter(function (a) { return cible.indexOf(a.date) >= 0 && (a.etat === 'valide' || a.garde); });
      var horsCible = portee === 'nouveau' ? [] : S.plan.filter(function (a) { return cible.indexOf(a.date) < 0; });
      var exclus = p.eviterCollegues !== false ? exclusCollegues(cible) : {};
      horsCible.forEach(function (a) { exclus[a.code] = true; });
      var r = Moteur.genererPlanning(ctx(), {
        dates: cible, communesPour: communesPour, maxJour: +p.maxJour || 8, delai: +p.delai || 0,
        exclus: exclus, rejetes: S.rejetes, conserves: conserves, imposes: S.imposes, depart: departCoord()
      });
      S.plan = horsCible.concat(r.arrets);
      trierPlan();
      S.programme = { etat: 'proposition', valideLe: '' };
      S.ui.voirParams = false; S.ui.ouvert = null;
      if (portee === 'nouveau') S.ui.jour = null;
      sauver(); rendre(); publierPlan();
      var msg = r.arrets.length ? r.arrets.length + ' visites proposées' + (portee === 'jour' ? ' pour ce jour' : '') + '.' : 'Aucun praticien ne correspond à ces critères.';
      if (r.nonPlaces.length) msg += ' ' + r.nonPlaces.length + ' médecin(s) « à voir » absent(s) sur la période.';
      var attendu = (+p.maxJour || 8) * cible.filter(function (d) { return jourSemaineIndex(d) < 5; }).length;
      if (r.arrets.length && r.arrets.length < attendu * 0.75) {
        msg += ' Moins de visites que prévu : les médecins présents sont déjà ciblés par l\'équipe ou vus récemment. Élargissez les communes.';
      }
      toast(msg, 4500);
    });
  }

  function validerVisites() {
    var aValider = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; });
    if (!aValider.length) return;
    var t = aujourdhui(), ko = 0;
    aValider.forEach(function (a) {
      var v = { uid: a.uid, date: a.date > t ? t : a.date, idPresence: a.idPresence, code: a.code, nom: a.nom, type: a.type,
                specialite: a.specialite, note: a.note, commune: a.commune, quartier: a.quartier, lieu: a.lieu,
                creneau: a.creneau, statut: a.statut, commentaire: a.commentaire || '', delegue: moi() };
      Moteur.appliquerVisite(S.data.praticiens, v, statuts());
      if (S.config.demo) { v.horodatage = new Date().toISOString(); S.data.historique = [v].concat(S.data.historique || []); }
      else S.queue.push(v);
      if (estKo(a.statut)) ko++;
      a.etat = 'valide';
    });
    ctxCache.data = null;
    S.ui.ouvert = null;
    sauver(); rendre();
    toast(aValider.length + ' compte(s) rendu(s) enregistré(s)' + (ko ? '. ' + ko + ' visite(s) non réalisée(s) : utilisez « Remplacer ».' : '.'));
    publierPlan();
  }

  function ajouterArret(c, date) {
    if (S.plan.some(function (a) { return a.date === date && a.code === c.code; })) { toast('Ce praticien est déjà prévu ce jour-là.'); return false; }
    var a = Moteur.arretDepuisCreneau(c, date);
    a.etat = 'ajoute'; a.garde = true;
    S.plan.push(a);
    reordonner(date);
    S.ui.jour = date;
    sauver(); publierPlan();
    var cib = cibleParCollegues(c.code, date);
    toast('Ajouté au ' + dateCourte(date) + (cib.length ? ', attention : aussi prévu par ' + cib[0].delegue : '') + '.');
    return true;
  }

  // Place un médecin « à voir absolument » au meilleur endroit de la tournée existante
  function placerImpose(im) {
    var c = ctx(), dates = datesPeriode(), best = null;
    (c.parCode[im.code] || []).forEach(function (cr) {
      dates.forEach(function (d) {
        if (jourSemaineIndex(d) !== cr.jourIdx || (im.date && im.date !== d) || (im.cle && im.cle !== cr.cle)) return;
        if (S.plan.some(function (a) { return a.date === d && a.code === im.code; })) return;
        var a = Moteur.arretDepuisCreneau(cr, d);
        a.impose = true; a.garde = true; if (im.rdv) a.rdv = im.rdv;
        var jour = S.plan.filter(function (x) { return x.date === d; });
        var avant = jour.reduce(function (s, x) { return s + (x.dist || 0); }, 0);
        var essai = Moteur.ordonnerJour(jour.map(function (x) { return Object.assign({}, x); }).concat([a]), departCoord());
        var cout = essai.filter(function (x) { return x.retard; }).length * 1000 + essai.reduce(function (s, x) { return s + x.dist; }, 0) - avant + jour.length * 0.5;
        if (!best || cout < best.cout) best = { cout: cout, a: a, d: d };
      });
    });
    if (!best) return false;
    S.plan.push(best.a);
    reordonner(best.d);
    S.ui.jour = best.d;
    return true;
  }

  function localiser() {
    if (!navigator.geolocation) { toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
    toast('Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var A = S.ui.autour, r = Moteur.quartierLePlusProche(pos.coords.latitude, pos.coords.longitude, quartiers());
      A.lat = pos.coords.latitude; A.lon = pos.coords.longitude;
      A.label = r ? 'ma position (près ' + (/^[aeiouyéèàâîôûAEIOUYÉÈÀÂÎÔÛ]/.test(r.quartier.quartier) ? 'd\'' : 'de ') + r.quartier.quartier + ')' : 'ma position';
      LS.set('autour', A); rendre();
      if (r && r.km > 8) toast('Vous semblez hors d\'Abidjan. Quartier le plus proche : ' + r.quartier.quartier + '.');
    }, function () {
      toast('Position indisponible. Autorisez la localisation ou choisissez un quartier.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 });
  }

  function chargerDemo() {
    if (pret() && !S.config.demo && !confirm('Remplacer les données synchronisées par des données de démonstration ?')) return;
    S.config.demo = true;
    var b = genererBaseFictive(aujourdhui());
    S.data = { version: VERSION_DONNEES, praticiens: b.praticiens, presences: b.presences, quartiers: quartiersDefautObjets(),
               statuts: STATUTS_DEFAUT, historique: [], plannings: [], syncedAt: null };
    S.plan = []; S.queue = []; S.imposes = []; S.rejetes = {}; S.programme = { etat: 'proposition', valideLe: '' };
    S.ui.tab = 'tournee'; S.ui.voirParams = false;
    sauver(); rendre();
    toast('Démonstration : ' + b.praticiens.length + ' praticiens, ' + b.presences.length + ' lieux de présence.');
  }

  function copier(texte) {
    if (navigator.clipboard) return navigator.clipboard.writeText(texte).then(function () { toast('Texte copié.'); }, function () { prompt('Copiez ce texte :', texte); });
    prompt('Copiez ce texte :', texte);
  }

  var ACTIONS = {
    nav: function (el) {
      S.ui.tab = el.dataset.tab; S.ui.feuille = null;
      rendre(); window.scrollTo(0, 0);
      if (S.ui.tab === 'equipe') rafraichirEquipe().then(function (ok) { if (ok && S.ui.tab === 'equipe') rendreSiPossible(); });
    },
    param: function (el) { S.params[el.dataset.k] = el.dataset.v; LS.set('params', S.params); rendre(); },
    voirParams: function () { S.ui.voirParams = true; rendre(); window.scrollTo(0, 0); },
    generer: function () { lancerTirage('nouveau'); },
    tirage: function (el) { lancerTirage(el.dataset.v); },
    jour: function (el) { S.ui.jour = el.dataset.v; S.ui.ouvert = null; rendre(); },
    ouvrir: function (el) { S.ui.ouvert = S.ui.ouvert === el.dataset.uid ? null : el.dataset.uid; rendre(); },
    garder: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.garde = !a.garde; if (a.garde) delete S.rejetes[a.code];
      LS.set('plan', S.plan); rendre();
    },
    statut: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.statut = a.statut === el.dataset.v ? '' : el.dataset.v;
      LS.set('plan', S.plan); rendre();
    },
    retirer: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      S.plan = S.plan.filter(function (x) { return x.uid !== a.uid; });
      S.rejetes[a.code] = true;
      S.imposes = S.imposes.filter(function (im) { return im.code !== a.code; });
      reordonner(a.date);
      S.ui.ouvert = null; sauver(); rendre(); publierPlan();
    },
    rattraper: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      if (!a.statut) a.statut = 'Absent';
      LS.set('plan', S.plan);
      S.ui.autour = Object.assign(S.ui.autour, { lat: a.lat, lon: a.lon, label: a.quartier, moment: a.date === aujourdhui() ? 'maintenant' : 'choisir',
        date: a.date, heure: a.heure, ref: { nom: a.nom, code: a.code, cle: a.cle, date: a.date, heure: a.heure, quartier: a.quartier, creneau: a.creneau } });
      LS.set('autour', S.ui.autour);
      S.ui.tab = 'autour'; rendre(); window.scrollTo(0, 0);
    },
    validerProgramme: function () {
      var d = new Date();
      S.programme = { etat: 'valide', valideLe: pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' à ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) };
      sauver(); publierPlan();
      S.ui.feuille = { type: 'exporter', titre: 'Envoyer le programme', portee: S.params.mode === 'jour' ? 'jour' : 'semaine' };
      rendre();
      toast('Programme validé et partagé avec l\'équipe.');
    },
    rouvrirProgramme: function () { S.programme = { etat: 'proposition', valideLe: '' }; sauver(); publierPlan(); rendre(); },
    ouvrirExport: function () { S.ui.feuille = { type: 'exporter', titre: 'Envoyer le programme', portee: S.params.mode === 'jour' ? 'jour' : 'semaine' }; rendre(); },
    exportPortee: function (el) { S.ui.feuille.portee = el.dataset.v; rendre(); },
    envoyerWhatsapp: function () { window.open(urlWhatsapp(S.ui.feuille.texte), '_blank', 'noopener'); },
    copierTexte: function () { copier(S.ui.feuille.texte); },
    partagerTexte: function () { navigator.share({ title: 'Programme de tournée', text: S.ui.feuille.texte }).catch(function () {}); },
    fermerFeuille: function () { S.ui.feuille = null; rendre(); },
    couvPortee: function (el) { S.ui.couvPortee = el.dataset.v; rendre(); },
    couvFiltre: function (el) { S.ui.couvFiltre = el.dataset.v; rendre(); },
    // Communes
    choisirCommunes: function (el) {
      var cle = el.dataset.v, sel = cle === 'tout' ? S.params.communes : (S.params.communesJour[cle] || []);
      S.ui.feuille = { type: 'communes', titre: cle === 'tout' ? 'Communes ciblées' : 'Communes du ' + JOURS[+cle].toLowerCase(), cle: cle, sel: sel.slice() };
      rendre();
    },
    communeToggle: function (el) {
      var f = S.ui.feuille, c = el.dataset.v, i = f.sel.indexOf(c);
      if (i >= 0) f.sel.splice(i, 1); else f.sel.push(c);
      rendre();
    },
    zoneToggle: function (el) {
      var f = S.ui.feuille, l = communesListe().filter(function (c) { return c.zone === el.dataset.v; }).map(function (c) { return c.commune; });
      var tous = l.every(function (c) { return f.sel.indexOf(c) >= 0; });
      l.forEach(function (c) { var i = f.sel.indexOf(c); if (tous && i >= 0) f.sel.splice(i, 1); if (!tous && i < 0) f.sel.push(c); });
      rendre();
    },
    communesAucune: function () { S.ui.feuille.sel = []; rendre(); },
    communesOk: function () {
      var f = S.ui.feuille;
      if (f.cle === 'tout') S.params.communes = f.sel.slice(); else S.params.communesJour[f.cle] = f.sel.slice();
      LS.set('params', S.params); S.ui.feuille = null; rendre();
    },
    // À voir absolument
    ouvrirRecherche: function () { S.ui.feuille = { type: 'recherche', titre: 'À voir absolument', q: '' }; rendre(); var i = $('rechercheImpose'); if (i) i.focus(); },
    choisirImpose: function (el) { S.ui.feuille.code = el.dataset.v; S.ui.feuille.cle = ''; rendre(); },
    retourRecherche: function () { S.ui.feuille.code = null; rendre(); },
    ajouterImpose: function () {
      var f = S.ui.feuille, choix = document.querySelector('input[name=impCle]:checked'), rdv = ($('impRdv').value || '').trim();
      var im = { code: f.code };
      if (choix && choix.value) { var p = choix.value.split('|'); im.date = p[0]; im.cle = p.slice(1).join('|'); }
      if (rdv) im.rdv = rdv;
      S.imposes = S.imposes.filter(function (x) { return x.code !== im.code; }).concat([im]);
      var place = S.plan.length && S.programme.etat !== 'valide' ? placerImpose(im) : false;
      S.ui.feuille = null; sauver(); rendre();
      if (place) publierPlan();
      toast(place ? 'Ajouté à la tournée du ' + dateCourte(S.ui.jour) + '.' : 'Ajouté. Il sera placé au prochain tirage.');
    },
    retirerImpose: function (el) { S.imposes.splice(+el.dataset.i, 1); LS.set('imposes', S.imposes); rendre(); },
    imposerDirect: function (el) { S.ui.feuille = { type: 'recherche', titre: 'À voir absolument', code: el.dataset.v, cle: '' }; rendre(); },
    planifierCle: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v); if (!c) return;
      var d = el.dataset.d || prochaineOccurrence(c.jourIdx, prochainJourOuvre(aujourdhui()), true);
      if (ajouterArret(c, d)) { S.ui.tab = 'tournee'; rendre(); window.scrollTo(0, 0); }
    },
    // Autour de moi
    localiser: localiser,
    autourMoment: function (el) { S.ui.autour.moment = el.dataset.v; LS.set('autour', S.ui.autour); rendre(); },
    autourRayon: function (el) { S.ui.autour.rayon = +el.dataset.v; LS.set('autour', S.ui.autour); rendre(); },
    ajouterAutour: function (el) {
      var x = S.ui.resAutour[+el.dataset.i]; if (!x) return;
      if (ajouterArret(x.c, el.dataset.d)) rendre();
    },
    finRef: function () { S.ui.autour.ref = null; LS.set('autour', S.ui.autour); rendre(); },
    // Divers
    contact: function (el) { S.ui.contactOuvert = S.ui.contactOuvert === el.dataset.v ? null : el.dataset.v; rendre(); },
    filtre: function (el) { S.ui.filtre = el.dataset.v; S.ui.limite = 40; rendre(); },
    plus: function () { S.ui.limite += 40; rendre(); },
    collegue: function (el) { S.ui.collegue = el.dataset.v; S.ui.jourEquipe = null; rendre(); },
    jourEquipe: function (el) { S.ui.jourEquipe = el.dataset.v; rendre(); },
    histFiltre: function (el) { S.ui.histFiltre = el.dataset.v; rendre(); },
    valider: validerVisites,
    sync: function () {
      if (S.config.demo) { toast('Mode démonstration : aucune synchronisation.'); return; }
      if (!S.config.url) { S.ui.tab = 'reglages'; rendre(); return; }
      synchroniser(false);
    },
    enregistrerNom: function () {
      var n = ($('nomDelegue').value || '').trim();
      if (n.length < 2) { toast('Indiquez votre nom.'); return; }
      S.config.delegue = n; S.config.whatsapp = normaliserNumero($('numWhatsapp').value) || '';
      LS.set('config', S.config); S.ui.tab = 'tournee'; rendre(); publierPlan();
      toast('Bienvenue ' + n + '.');
    },
    enregistrerMoi: function () {
      var n = ($('cfgNom').value || '').trim(), w = ($('cfgWhatsapp').value || '').trim();
      if (w && !normaliserNumero(w)) { toast('Numéro WhatsApp non reconnu. Exemple : 07 07 07 07 07.'); return; }
      var ancien = moi();
      S.config.delegue = n; S.config.whatsapp = normaliserNumero(w); S.config.waWeb = $('cfgWaWeb').checked; S.config.depart = $('cfgDepart').value;
      LS.set('config', S.config); rendre(); toast('Réglages enregistrés.');
      if (n && n !== ancien) publierPlan();
    },
    tester: function () {
      var cfg = { url: ($('cfgUrl').value || '').trim(), token: ($('cfgToken').value || '').trim() };
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url)) { toast('L\'URL doit commencer par https://script.google.com/'); return; }
      toast('Test en cours…');
      apiGet('ping', cfg).then(function (r) { toast('Connexion réussie au classeur « ' + r.classeur + ' ».'); }, function (e) { toast(e.message); });
    },
    enregistrerConnexion: function () {
      var url = ($('cfgUrl').value || '').trim(), token = ($('cfgToken').value || '').trim();
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url) || !token) { toast('Renseignez l\'URL (https://script.google.com/…) et le jeton.'); return; }
      if (S.config.demo) { S.plan = []; S.queue = []; S.data = null; S.imposes = []; S.rejetes = {}; }
      S.config.url = url; S.config.token = token; S.config.demo = false; S.ui.erreur = ''; sauver();
      toast('Réglages enregistrés. Synchronisation…');
      synchroniser(false).then(function () { if (pret()) { S.ui.tab = 'tournee'; rendre(); } });
    },
    demo: chargerDemo,
    reinitialiser: function () {
      var msg = S.queue.length ? S.queue.length + ' compte(s) rendu(s) non envoyé(s) seront perdus. ' : '';
      if (!confirm(msg + 'Effacer toutes les données de l\'application sur ce téléphone ?')) return;
      LS.vider(); location.reload();
    },
    installer: function () {
      var evt = S.ui.installEvt; if (!evt) return;
      evt.prompt(); evt.userChoice.then(function () { S.ui.installEvt = null; rendre(); });
    },
    partager: function () {
      var lien = lienInstallation(), texte = 'Application Tournées : ouvrez ce lien sur votre téléphone, puis installez l\'application.';
      if (navigator.share) navigator.share({ title: 'Tournées', text: texte, url: lien }).catch(function () {});
      else copier(lien);
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el || !ACTIONS[el.dataset.a] || el.disabled) return;
    if (el.tagName === 'A') return;
    e.preventDefault();
    ACTIONS[el.dataset.a](el, e);
  });
  document.addEventListener('input', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f, pos;
    if (f === 'commentaire') { var a = arret(el.dataset.uid); if (a) { a.commentaire = el.value; LS.set('plan', S.plan); } }
    if (f === 'recherche' || f === 'rechercheImpose') {
      if (f === 'recherche') { S.ui.recherche = el.value; S.ui.limite = 40; } else S.ui.feuille.q = el.value;
      pos = el.selectionStart; rendre();
      var champ = document.querySelector('[data-f="' + f + '"]');
      if (champ) { champ.focus(); try { champ.setSelectionRange(pos, pos); } catch (x) {} }
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f;
    if (f === 'param') {
      var k = el.dataset.k;
      S.params[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? +el.value : el.value);
      LS.set('params', S.params);
      if (k === 'dateRef' || k === 'parJour') rendre();
    }
    if (f === 'autour') { S.ui.autour[el.dataset.k] = el.value; LS.set('autour', S.ui.autour); rendre(); }
    if (f === 'autourQuartier' && el.value) {
      var q = quartiers().filter(function (x) { return x.quartier === el.value; })[0];
      if (q) { S.ui.autour.lat = q.lat; S.ui.autour.lon = q.lon; S.ui.autour.label = q.quartier; LS.set('autour', S.ui.autour); rendre(); }
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.ui.feuille) { S.ui.feuille = null; rendre(); } });

  // ------------------------------------------------------------------ Icônes
  function icone(n) {
    var d = {
      relancer: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
      epingle: '<path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z"/><path d="M12 13v8"/>',
      carte: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
      cible: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
      loupe: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
      valider: '<path d="M5 12.5 10 17 19 7"/>',
      whatsapp: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 19L4 20Z"/><path d="M9.2 8.6c.2 2.6 2.4 5 5.2 5.4l1.1-1.3-1.8-.9-.8.8c-1-.4-1.9-1.3-2.3-2.3l.8-.8-.9-1.8-1.3.9Z"/>'
    }[n] || '';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }

  // ------------------------------------------------------------------ Démarrage
  window.addEventListener('online', function () { synchroniser(true); });
  window.addEventListener('offline', function () { S.ui.sync = 'horsligne'; afficherEntete(); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.ui.installEvt = e; if (S.ui.tab === 'reglages') rendre(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var age = S.data && S.data.syncedAt ? Date.now() - new Date(S.data.syncedAt).getTime() : Infinity;
    if (S.queue.length || age > 10 * 60 * 1000) synchroniser(true);
    else rafraichirEquipe().then(function (ok) { if (ok) rendreSiPossible(); });
  });
  // Tournées de l'équipe rafraîchies toutes les 2 minutes quand l'application est ouverte
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    if (S.queue.length || S.ui.aPublier) { synchroniser(true); return; }
    rafraichirEquipe().then(function (ok) { if (ok && !S.ui.feuille) rendreSiPossible(); });
  }, 120000);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // Lien d'installation : #config=<base64 de {"url","token"}> (jamais envoyé au serveur)
  function lireConfigLien() {
    var m = location.hash.match(/config=([A-Za-z0-9_\-]+)/);
    if (!m) return false;
    try {
      var cfg = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (!cfg.url || !cfg.token) return false;
      if (S.config.demo || S.config.url !== cfg.url) {
        S.plan = []; S.queue = S.config.url === cfg.url ? S.queue : []; S.data = null; S.imposes = []; S.rejetes = {};
      }
      S.config.url = cfg.url; S.config.token = cfg.token; S.config.demo = false;
      sauver();
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    } catch (e) { return false; }
  }
  function lienInstallation() {
    var json = JSON.stringify({ url: S.config.url, token: S.config.token });
    var b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#config=' + b64;
  }

  var configureParLien = lireConfigLien();
  rendre();
  if (configureParLien) toast('Application configurée. Synchronisation…');
  if (connecte()) synchroniser(!configureParLien).then(function () {
    if (configureParLien && pret()) { S.ui.tab = 'tournee'; rendre(); }
  });

  // Accès pour les tests automatisés
  window.__tournees = { S: S, ctx: ctx, texteProgramme: texteProgramme, urlWhatsapp: urlWhatsapp, normaliserNumero: normaliserNumero };
})();
