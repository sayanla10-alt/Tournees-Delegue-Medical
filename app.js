/* =============================================================================
   app.js : interface de l'application "Tournées"
   - Données mises en cache sur le téléphone : tout fonctionne hors ligne
   - Les visites validées sont mises en file d'attente puis envoyées au Google Sheet
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
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIXE) === 0) localStorage.removeItem(k); });
    }
  };

  function aujourdhui() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function prochainJourOuvre(iso) {
    var i = jourSemaineIndex(iso);
    return i > 4 ? ajouterJours(iso, 7 - i) : iso;
  }
  // À partir du vendredi, on prépare la semaine suivante
  function semaineParDefaut(iso) {
    var i = jourSemaineIndex(iso);
    return i >= 4 ? ajouterJours(iso, 7 - i) : iso;
  }

  var S = {
    config: LS.get('config', { url: '', token: '', demo: false, delegue: '' }),
    data: LS.get('data', null),          // { base, quartiers, statuts, historique, syncedAt }
    plan: LS.get('plan', []),
    params: LS.get('params', {
      mode: 'semaine', dateRef: semaineParDefaut(aujourdhui()), commune: 'Toutes',
      maxJour: 8, regroup: true, delai: 7, eviterCollegues: true
    }),
    queue: LS.get('queue', []),
    ui: {
      tab: 'tournee', jour: null, ouvert: null, voirParams: false, ref: null, props: null,
      recherche: '', filtre: 'tous', contactOuvert: null, limite: 40,
      sync: 'idle', erreur: '', installEvt: null, enCours: false,
      collegue: null, jourEquipe: null, histFiltre: 'moi',
      aPublier: LS.get('aPublier', false), portee: LS.get('portee', null)
    }
  };

  function sauver() {
    LS.set('config', S.config); LS.set('data', S.data); LS.set('plan', S.plan);
    LS.set('params', S.params); LS.set('queue', S.queue);
  }

  function pret() { return !!(S.data && S.data.base && S.data.base.length); }
  function statuts() { return (S.data && S.data.statuts && S.data.statuts.length) ? S.data.statuts : STATUTS_DEFAUT; }
  function quartiers() { return (S.data && S.data.quartiers && S.data.quartiers.length) ? S.data.quartiers : quartiersDefautObjets(); }

  // ------------------------------------------------------------------ Équipe
  function moi() { return String(S.config.delegue || '').trim(); }
  function estMoi(nom) { return String(nom || '').trim().toLowerCase() === moi().toLowerCase(); }
  function arretsCollegues() {
    return ((S.data && S.data.plannings) || []).filter(function (p) { return p.delegue && !estMoi(p.delegue); });
  }
  function prevuParCollegues(code, depuis) {
    return arretsCollegues().filter(function (p) { return p.code === code && p.date >= depuis; });
  }
  function etiquetteCollegues(code, depuis) {
    var l = prevuParCollegues(code, depuis);
    if (!l.length) return '';
    return '<span class="etiquette equipe">Prévu par ' + esc(l[0].delegue) + ', ' + dateCourte(l[0].date) +
      (l.length > 1 ? ' (+' + (l.length - 1) + ')' : '') + '</span>';
  }
  function porteePlan() {
    var d = S.plan.map(function (a) { return a.date; }).sort();
    return d.length ? { debut: d[0], fin: d[d.length - 1] } : null;
  }
  // Tournée envoyée au Google Sheet : remplace la précédente sur toute la période concernée
  function chargePlan() {
    var p = porteePlan() || { debut: aujourdhui(), fin: aujourdhui() }, ancien = S.ui.portee;
    if (ancien) { if (ancien.debut < p.debut) p.debut = ancien.debut; if (ancien.fin > p.fin) p.fin = ancien.fin; }
    return { delegue: moi(), debut: p.debut, fin: p.fin, arrets: S.plan.map(function (a) {
      return { date: a.date, heure: a.heure, heurePrevue: a.heurePrevue || '', creneau: a.creneau, id: a.rowId,
               code: a.code, nom: a.nom, specialite: a.specialite, priorite: a.priorite, quartier: a.quartier,
               commune: a.commune, lieu: a.lieu, statut: a.statut, etat: a.etat, uid: a.uid };
    }) };
  }
  function publierPlan() {
    if (S.config.demo || !S.config.url) return;
    S.ui.aPublier = true; LS.set('aPublier', true);
    synchroniser(true);
  }

  // ------------------------------------------------------------------ Mise en forme
  var JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
              'septembre', 'octobre', 'novembre', 'décembre'];

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateCourte(iso) {
    var p = iso.split('-');
    return JOURS_COURTS[jourSemaineIndex(iso)] + ' ' + p[2] + '/' + p[1];
  }
  function dateLongue(iso) {
    var p = iso.split('-');
    return nomJour(iso).toLowerCase() + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }
  function km(n) { return (Math.round(n * 10) / 10).toLocaleString('fr-FR') + ' km'; }
  function pct(n) { return (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1 }) + ' %'; }
  function vuDepuis(derniere, ref) {
    if (!derniere) return 'Jamais visité';
    var j = joursEcoules(derniere, ref || aujourdhui());
    return j === 0 ? 'Vu aujourd\'hui' : 'Vu il y a ' + j + ' j';
  }
  function heureActuelle() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function lienCarte(o) {
    var q = [o.lieu, o.quartier, o.commune, 'Abidjan'].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }
  function estKo(statut) { return statut && !Moteur.estVisite(statut, statuts()); }

  var $ = function (id) { return document.getElementById(id); };
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('visible'); }, 3200);
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
    return appel(S.config.url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body)
    });
  }

  function synchroniser(silencieux) {
    if (S.config.demo || !S.config.url) return Promise.resolve();
    if (S.ui.enCours) return Promise.resolve();
    if (!navigator.onLine) { S.ui.sync = 'horsligne'; afficherEntete(); return Promise.resolve(); }
    S.ui.enCours = true; S.ui.sync = 'encours'; afficherEntete();
    var envoi = S.queue.length ? apiPost('valider', { visites: S.queue }).then(function (r) {
      var recus = {}; (r.recus || []).forEach(function (u) { recus[u] = true; });
      S.queue = S.queue.filter(function (v) { return !recus[v.uid]; });
      LS.set('queue', S.queue);
    }) : Promise.resolve();
    var tentePub = false;
    return envoi.then(function () {
      if (!S.ui.aPublier || !moi()) return;
      tentePub = true;
      return apiPost('planning', chargePlan()).then(function () {
        S.ui.aPublier = false; LS.set('aPublier', false);
        S.ui.portee = porteePlan(); LS.set('portee', S.ui.portee);
      });
    }).then(function () { return apiGet('data'); }).then(function (d) {
      S.data = { base: d.base, quartiers: d.quartiers, statuts: d.statuts, historique: d.historique,
                 plannings: d.plannings || [], syncedAt: new Date().toISOString() };
      S.queue.forEach(function (v) { Moteur.appliquerVisite(S.data.base, v, S.data.statuts); });
      LS.set('data', S.data);
      S.ui.sync = 'ok'; S.ui.erreur = '';
      if (!silencieux) toast('Données à jour : ' + S.data.base.length + ' lignes.');
    }).catch(function (e) {
      S.ui.sync = 'erreur'; S.ui.erreur = e.message;
      if (!silencieux) toast(e.message);
    }).then(function () {
      S.ui.enCours = false;
      rendreSiPossible();
      if (S.ui.aPublier && !tentePub && navigator.onLine) setTimeout(function () { synchroniser(true); }, 300);
    });
  }

  // ------------------------------------------------------------------ En-tête et barre
  function afficherEntete() {
    $('enteteDate').textContent = dateLongue(aujourdhui()).replace(/^./, function (c) { return c.toUpperCase(); });
    var p = $('pastilleSync'), etat, texte;
    if (S.config.demo) { etat = 'demo'; texte = 'Démo'; }
    else if (!S.config.url) { etat = 'erreur'; texte = 'Non connecté'; }
    else if (S.ui.sync === 'encours') { etat = 'encours'; texte = 'Synchro…'; }
    else if (!navigator.onLine || S.ui.sync === 'horsligne') {
      etat = 'horsligne'; texte = S.queue.length ? S.queue.length + ' en attente' : 'Hors ligne';
    }
    else if (S.ui.sync === 'erreur') { etat = 'erreur'; texte = 'Erreur synchro'; }
    else if (S.queue.length) { etat = 'attente'; texte = S.queue.length + ' en attente'; }
    else {
      etat = 'ok';
      texte = S.data && S.data.syncedAt ? 'À jour ' + new Date(S.data.syncedAt).toTimeString().slice(0, 5) : 'À jour';
    }
    p.dataset.etat = etat; p.textContent = texte;
    p.setAttribute('aria-label', 'Synchronisation : ' + texte + (S.ui.erreur ? '. ' + S.ui.erreur : ''));
  }

  function afficherBarre() {
    var n = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; }).length;
    var visible = S.ui.tab === 'tournee' && n > 0;
    $('barreValider').hidden = !visible;
    document.body.classList.toggle('avec-barre', visible);
    $('boutonValider').textContent = 'Valider ' + n + ' visite' + (n > 1 ? 's' : '');
  }

  function afficherNav() {
    document.querySelectorAll('.navigation button').forEach(function (b) {
      if (b.dataset.tab === S.ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  // ------------------------------------------------------------------ Rendu principal
  function rendre() {
    var vue = $('vue');
    var tab = S.ui.tab;
    if (!pret() && tab !== 'reglages') tab = 'accueil';
    else if (pret() && S.config.url && !S.config.demo && !moi() && tab !== 'reglages') tab = 'identite';
    vue.innerHTML = (VUES[tab] || VUES.tournee)();
    afficherEntete(); afficherBarre(); afficherNav();
  }
  function rendreSiPossible() {
    var a = document.activeElement;
    if (a && $('vue').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { afficherEntete(); afficherBarre(); return; }
    rendre();
  }

  var VUES = {};

  // ------------------------------------------------------------------ Vue : accueil
  VUES.accueil = function () {
    return '<section class="accueil">' +
      '<svg class="accueil-ligne" viewBox="0 0 320 40" style="width:100%;height:40px" aria-hidden="true">' +
        '<path d="M10 20H310" stroke="#0E3B43" stroke-width="4"/>' +
        '<circle cx="20" cy="20" r="8" fill="#fff" stroke="#E39E12" stroke-width="4"/>' +
        '<circle cx="110" cy="20" r="8" fill="#2B7D52" stroke="#2B7D52" stroke-width="4"/>' +
        '<circle cx="200" cy="20" r="8" fill="#fff" stroke="#0E3B43" stroke-width="4"/>' +
        '<circle cx="300" cy="20" r="8" fill="#fff" stroke="#0E3B43" stroke-width="4"/></svg>' +
      '<h1>Votre tournée de la semaine, prête en un geste.</h1>' +
      '<p>L\'application choisit les praticiens à voir selon leur priorité et la date de votre dernière visite, ' +
      'les regroupe par quartier et les ordonne selon leurs heures de présence. Elle fonctionne aussi sans réseau.</p>' +
      '<button class="bouton bouton-plein" data-a="nav" data-tab="reglages" type="button">Connecter mon Google Sheet</button>' +
      '<button class="bouton" data-a="demo" type="button">Essayer avec des données de démonstration</button>' +
      '</section>';
  };

  // ------------------------------------------------------------------ Vue : identité
  VUES.identite = function () {
    return '<section class="accueil"><h1>Qui êtes-vous ?</h1>' +
      '<p>Votre nom apparaît auprès de vos collègues, sur votre tournée et vos visites. Il permet aussi à chacun de savoir quels praticiens sont déjà prévus.</p>' +
      '<label class="champ"><span>Votre nom</span><input type="text" id="nomDelegue" autocomplete="name" placeholder="Ex. Koffi Yao"></label>' +
      '<button class="bouton bouton-plein" data-a="enregistrerNom" type="button">Continuer</button></section>';
  };

  // ------------------------------------------------------------------ Vue : tournée
  VUES.tournee = function () {
    var p = S.params, h = '';
    var communes = ['Toutes'].concat(Array.from(new Set(quartiers().map(function (q) { return q.commune; }))).sort(
      function (a, b) { return a.localeCompare(b, 'fr'); }));

    if (S.ui.voirParams || !S.plan.length) {
      h += '<section class="bloc"><h3 style="margin-top:0">Préparer la tournée</h3>' +
        '<div class="segment" role="group" aria-label="Durée">' +
          '<button type="button" data-a="param" data-k="mode" data-v="jour" aria-pressed="' + (p.mode === 'jour') + '">Une journée</button>' +
          '<button type="button" data-a="param" data-k="mode" data-v="semaine" aria-pressed="' + (p.mode === 'semaine') + '">Une semaine</button>' +
        '</div>' +
        '<label class="champ"><span>' + (p.mode === 'jour' ? 'Date' : 'Semaine du') + '</span>' +
          '<input type="date" data-f="param" data-k="dateRef" value="' + esc(p.dateRef) + '"></label>' +
        '<label class="champ"><span>Commune</span><select data-f="param" data-k="commune">' +
          communes.map(function (c) { return '<option' + (c === p.commune ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
        '</select></label>' +
        '<div class="grille-2">' +
          '<label class="champ"><span>Visites par jour</span><input type="number" min="1" max="20" inputmode="numeric" data-f="param" data-k="maxJour" value="' + p.maxJour + '"></label>' +
          '<label class="champ"><span>Délai mini (jours)</span><input type="number" min="0" max="365" inputmode="numeric" data-f="param" data-k="delai" value="' + p.delai + '"></label>' +
        '</div>' +
        '<label class="interrupteur"><span>Regrouper les visites par secteur</span>' +
          '<input type="checkbox" data-f="param" data-k="regroup"' + (p.regroup ? ' checked' : '') + '></label>' +
        (S.config.demo ? '' : '<label class="interrupteur"><span>Éviter les praticiens prévus par un collègue</span>' +
          '<input type="checkbox" data-f="param" data-k="eviterCollegues"' + (p.eviterCollegues !== false ? ' checked' : '') + '></label>') +
        '<button class="bouton bouton-plein bouton-large" data-a="generer" type="button">Générer la tournée</button>' +
        (S.plan.length ? '<p class="discret" style="margin:10px 0 0">Les visites déjà validées sont conservées.</p>' : '') +
        '</section>';
    } else {
      h += '<section class="bloc resume-params"><p><b>' +
        (p.mode === 'jour' ? 'Journée du ' + dateCourte(p.dateRef) : 'Semaine du ' + dateCourte(lundiDe(p.dateRef))) +
        '</b><span class="discret">' + (p.commune === 'Toutes' ? 'Toutes les communes' : esc(p.commune)) +
        ', ' + p.maxJour + ' visites par jour</span></p>' +
        '<button class="bouton" data-a="voirParams" type="button">Modifier</button></section>';
    }

    if (!S.plan.length) {
      return h + '<div class="vide"><strong>Aucune tournée pour le moment</strong>Choisissez la période puis générez la tournée.</div>';
    }

    var dates = Array.from(new Set(S.plan.map(function (a) { return a.date; }))).sort();
    if (!S.ui.jour || dates.indexOf(S.ui.jour) < 0) {
      var t = aujourdhui();
      S.ui.jour = dates.indexOf(t) >= 0 ? t : (dates.filter(function (d) { return d >= t; })[0] || dates[0]);
    }
    h += '<div class="jours" role="group" aria-label="Jour">' + dates.map(function (d) {
      var n = S.plan.filter(function (a) { return a.date === d; });
      var faits = n.filter(function (a) { return a.etat === 'valide'; }).length;
      return '<button type="button" class="jour' + (d === aujourdhui() ? ' aujourdhui' : '') + '" data-a="jour" data-v="' + d +
        '" aria-pressed="' + (d === S.ui.jour) + '"><b>' + JOURS_COURTS[jourSemaineIndex(d)].replace('.', '') + ' ' +
        (+d.slice(8)) + '</b><small>' + (faits ? faits + '/' : '') + n.length + ' visite' + (n.length > 1 ? 's' : '') + '</small></button>';
    }).join('') + '</div>';

    var duJour = S.plan.filter(function (a) { return a.date === S.ui.jour; });
    var totalKm = duJour.reduce(function (s, a) { return s + (a.dist || 0); }, 0);
    var p1 = duJour.filter(function (a) { return a.priorite === 1; }).length;
    h += '<p class="bilan-jour"><b>' + dateLongue(S.ui.jour).replace(/^./, function (c) { return c.toUpperCase(); }) +
      '</b> : ' + duJour.length + ' visite' + (duJour.length > 1 ? 's' : '') + ', environ ' + km(totalKm) +
      ' de trajet' + (p1 ? ', dont ' + p1 + ' en priorité 1' : '') + '.</p>';

    ['Matin', 'Après-midi'].forEach(function (cren) {
      var liste = duJour.filter(function (a) { return (a.creneau === 'Matin') === (cren === 'Matin'); });
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
    return h;
  };

  function rendreArret(a) {
    var ouvert = S.ui.ouvert === a.uid, verrou = a.etat === 'valide';
    var cls = 'arret' + (ouvert ? ' ouvert' : '') + (verrou ? ' verrouille' : '') +
      (a.statut ? (estKo(a.statut) ? ' absent' : ' fait') : '');
    var etiquettes = '';
    if (a.priorite === 1) etiquettes += '<span class="etiquette p1">Priorité 1</span>';
    else etiquettes += '<span class="etiquette">Priorité ' + a.priorite + '</span>';
    etiquettes += '<span class="etiquette">' + esc(vuDepuis(a.derniere, a.date)) + '</span>';
    if (a.statut) etiquettes += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(a.statut) +
      (verrou ? ', validé' : '') + '</span>';
    if (a.etat === 'ajoute') etiquettes += '<span class="etiquette">Ajouté</span>';
    if (a.horsCreneau) etiquettes += '<span class="etiquette alerte">Hors créneau</span>';
    etiquettes += etiquetteCollegues(a.code, lundiDe(a.date));

    var h = '<li class="' + cls + '" data-p="' + a.priorite + '">' +
      '<div class="arret-heure"><b>' + esc(a.heure || '--:--') + '</b>' +
      (a.heurePrevue && a.heurePrevue !== a.heure ? '<small>arrivée ' + esc(a.heurePrevue) + '</small>' : '') + '</div>' +
      '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
      '<div><div class="arret-carte">' +
        '<button type="button" class="bouton-texte" style="all:unset;display:block;width:100%;cursor:pointer" data-a="ouvrir" data-uid="' + a.uid + '" aria-expanded="' + ouvert + '">' +
          '<span class="arret-nom">' + esc(a.nom) + '</span>' +
          '<span class="arret-lieu">' + esc(a.specialite) + ', ' + esc(a.lieu) + '</span>' +
          '<span class="arret-lieu">' + esc(a.quartier) + ', ' + esc(a.commune) + '</span>' +
          '<span class="etiquettes">' + etiquettes + '</span>' +
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
        '<a class="bouton" href="' + lienCarte(a) + '" target="_blank" rel="noopener">Itinéraire</a>' +
        (verrou ? '' : '<button class="bouton" type="button" data-a="rattraper" data-uid="' + a.uid + '">Absent, rattraper</button>') +
        '</div>' +
        (verrou ? '' : '<button class="bouton-texte" type="button" data-a="retirer" data-uid="' + a.uid + '">Retirer de la tournée</button>') +
        '</div>';
    }
    return h + '</div></div></li>';
  }

  // ------------------------------------------------------------------ Vue : rattrapage
  function refParDefaut() {
    var t = prochainJourOuvre(aujourdhui());
    var estAujourdhui = t === aujourdhui();
    var h = estAujourdhui ? heureActuelle() : '08:00';
    var derniers = S.plan.filter(function (a) { return a.date === t && a.statut; });
    return { quartier: derniers.length ? derniers[derniers.length - 1].quartier : '', date: t,
             creneau: heureVersMinutes(h) >= 13 * 60 ? 'Après-midi' : 'Matin', heure: h, code: '', rowId: '', nom: '' };
  }

  VUES.rattrapage = function () {
    if (!S.ui.ref) S.ui.ref = refParDefaut();
    var r = S.ui.ref, h = '<h2 class="titre-vue">Rattrapage</h2>';
    h += '<p class="sous-titre">Trouvez une visite à faire maintenant, près de l\'endroit où vous êtes.</p>';
    if (r.code) {
      h += '<div class="bandeau"><p>RDV manqué : <b>' + esc(r.nom) + '</b> à ' + esc(r.heure) + ', ' + esc(r.quartier) +
        '. La visite est marquée « Absent ».</p></div>';
    }
    var parCommune = {};
    quartiers().forEach(function (q) { (parCommune[q.commune] = parCommune[q.commune] || []).push(q.quartier); });
    h += '<section class="bloc">' +
      '<label class="champ"><span>Je suis à</span><select data-f="ref" data-k="quartier">' +
        '<option value="">Choisir un quartier</option>' +
        Object.keys(parCommune).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (c) {
          return '<optgroup label="' + esc(c) + '">' + parCommune[c].map(function (q) {
            return '<option' + (q === r.quartier ? ' selected' : '') + '>' + esc(q) + '</option>';
          }).join('') + '</optgroup>';
        }).join('') +
      '</select></label>' +
      '<button class="bouton bouton-large" type="button" data-a="localiser" style="margin-bottom:12px">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>' +
        'Utiliser ma position</button>' +
      '<div class="grille-2">' +
        '<label class="champ"><span>Date</span><input type="date" data-f="ref" data-k="date" value="' + esc(r.date) + '"></label>' +
        '<label class="champ"><span>À partir de</span><input type="time" data-f="ref" data-k="heure" value="' + esc(r.heure) + '"></label>' +
      '</div>' +
      '<div class="segment" role="group" aria-label="Créneau">' + CRENEAUX.map(function (c) {
        return '<button type="button" data-a="refCreneau" data-v="' + c + '" aria-pressed="' + (r.creneau === c) + '">' + c + '</button>';
      }).join('') + '</div>' +
      '</section>';

    if (!r.quartier) return h + '<div class="vide"><strong>Indiquez où vous êtes</strong>Choisissez un quartier ou utilisez votre position.</div>';
    if (jourSemaineIndex(r.date) > 4) return h + '<div class="vide"><strong>Pas de visites le week-end</strong>Choisissez un jour de semaine.</div>';

    var occupes = S.plan.concat(arretsCollegues().filter(function (p) { return p.date === r.date; }));
    var res = Moteur.proposerRattrapage(S.data.base, quartiers(), occupes, r, S.params.delai);
    S.ui.props = res;
    if (res.memePraticien.length) {
      h += '<h3>Revoir ' + esc(r.nom) + '</h3><ul class="liste">' +
        res.memePraticien.map(function (x, i) { return rendreProposition(x, 'm', i); }).join('') + '</ul>';
    }
    h += '<h3>Disponibles ' + dateCourte(r.date) + ', à moins de ' + REGLAGES_MOTEUR.rayonRattrapageKm + ' km</h3>';
    if (!res.proches.length) {
      h += '<div class="vide">Aucun praticien disponible dans ce rayon sur ce créneau. Essayez l\'après-midi ou un quartier voisin.</div>';
    } else {
      h += '<ul class="liste">' + res.proches.map(function (x, i) { return rendreProposition(x, 'p', i); }).join('') + '</ul>';
    }
    return h;
  };

  function rendreProposition(x, section, i) {
    var row = x.row;
    var deja = S.plan.some(function (a) { return a.date === x.date && a.code === row.code; });
    return '<li class="element"><div class="element-tete"><div>' +
      '<div class="element-titre">' + esc(row.nom) + '</div>' +
      '<div class="discret">' + esc(row.specialite) + ', ' + esc(row.lieu) + '</div>' +
      '<div class="discret">' + esc(row.quartier) + ', ' + esc(row.jour) + ' ' + esc(row.creneau.toLowerCase()) +
      ' dès ' + esc(row.heure) + '</div>' +
      '<div class="etiquettes"><span class="etiquette' + (+row.priorite === 1 ? ' p1' : '') + '">Priorité ' + row.priorite + '</span>' +
      '<span class="etiquette">' + esc(vuDepuis(row.derniere, x.date)) + '</span>' +
      '<span class="etiquette">' + esc(x.source) + ', ' + dateCourte(x.date) + '</span>' + etiquetteCollegues(row.code, aujourdhui()) + '</div></div>' +
      '<div class="element-mesure">' + km(x.dist) + '<small>score ' + Math.round(x.score) + '</small></div></div>' +
      (deja ? '<p class="discret" style="margin:8px 0 0">Déjà dans la tournée de ce jour.</p>' :
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="ajouterProp" data-s="' + section + '" data-i="' + i +
        '">Ajouter à la tournée du ' + dateCourte(x.date) + '</button>') +
      '</li>';
  }

  // ------------------------------------------------------------------ Vue : équipe
  VUES.equipe = function () {
    var h = '<h2 class="titre-vue">Équipe</h2>';
    if (S.config.demo) return h + '<div class="vide"><strong>Disponible avec le Google Sheet</strong>Les tournées de vos collègues s\'affichent ici une fois l\'application connectée.</div>';
    var depuis = lundiDe(aujourdhui());
    var arrets = arretsCollegues().filter(function (p) { return p.date >= depuis; });
    var noms = Array.from(new Set(arrets.map(function (p) { return p.delegue; }))).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    h += '<p class="sous-titre">Tournées publiées par vos collègues, mises à jour à chaque synchronisation.</p>';
    if (!noms.length) return h + '<div class="vide"><strong>Aucune tournée publiée</strong>Les tournées apparaissent ici dès qu\'un collègue génère la sienne.</div>';
    if (noms.indexOf(S.ui.collegue) < 0) S.ui.collegue = noms[0];
    h += '<div class="filtres" role="group" aria-label="Collègue">' + noms.map(function (n) {
      return '<button type="button" data-a="collegue" data-v="' + esc(n) + '" aria-pressed="' + (n === S.ui.collegue) + '">' + esc(n) + '</button>';
    }).join('') + '</div>';
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
    var idx = Moteur.indexQuartiers(quartiers());
    ['Matin', 'Après-midi'].forEach(function (cren) {
      var liste = duJour.filter(function (p) { return (p.creneau === 'Matin') === (cren === 'Matin'); });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (p, i) {
        if (i > 0) {
          var d = Moteur.distQ(idx, liste[i - 1].quartier, p.quartier);
          if (d > 0) h += '<li class="troncon" aria-hidden="true"><div></div><div class="arret-rail"></div><span>' + km(d) + '</span></li>';
        }
        var ko = p.statut && estKo(p.statut);
        h += '<li class="arret' + (p.statut ? (ko ? ' absent' : ' fait') : '') + '" data-p="' + (+p.priorite || 3) + '">' +
          '<div class="arret-heure"><b>' + esc(p.heure || '--:--') + '</b></div>' +
          '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
          '<div><div class="arret-carte"><span class="arret-nom">' + esc(p.nom) + '</span>' +
          '<span class="arret-lieu">' + esc(p.specialite) + ', ' + esc(p.lieu) + '</span>' +
          '<span class="arret-lieu">' + esc(p.quartier) + ', ' + esc(p.commune) + '</span>' +
          (p.statut ? '<span class="etiquettes"><span class="etiquette ' + (ko ? 'ko' : 'ok') + '">' + esc(p.statut) + (p.etat === 'valide' ? ', validé' : '') + '</span></span>' : '') +
          '</div></div></li>';
      });
      h += '</ol>';
    });
    return h;
  };

  // ------------------------------------------------------------------ Vue : contacts
  VUES.contacts = function () {
    var f = S.ui.filtre, q = S.ui.recherche.trim().toLowerCase();
    var groupes = {}, ordre = [];
    S.data.base.forEach(function (r) {
      if (!groupes[r.code]) { groupes[r.code] = []; ordre.push(r.code); }
      groupes[r.code].push(r);
    });
    var liste = ordre.map(function (c) { return groupes[c]; }).filter(function (g) {
      var r = g[0];
      if (f === 'medecins' && r.type !== 'Médecin') return false;
      if (f === 'pharmacies' && r.type !== 'Pharmacie') return false;
      if (f === 'p1' && +r.priorite !== 1) return false;
      if (f === 'retard' && joursEcoules(r.derniere, aujourdhui()) < REGLAGES_MOTEUR.cadence[+r.priorite || 3]) return false;
      if (!q) return true;
      return g.some(function (x) {
        return [x.nom, x.specialite, x.quartier, x.commune, x.lieu].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    });
    liste.sort(function (a, b) {
      return (+a[0].priorite - +b[0].priorite) || joursEcoules(b[0].derniere, aujourdhui()) - joursEcoules(a[0].derniere, aujourdhui());
    });

    var h = '<h2 class="titre-vue">Contacts</h2>' +
      '<div class="recherche"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>' +
      '<input type="search" data-f="recherche" placeholder="Nom, spécialité, quartier…" value="' + esc(S.ui.recherche) + '" aria-label="Rechercher un contact"></div>' +
      '<div class="filtres" role="group" aria-label="Filtre">' +
      [['tous', 'Tous'], ['p1', 'Priorité 1'], ['retard', 'En retard'], ['medecins', 'Médecins'], ['pharmacies', 'Pharmacies']].map(function (x) {
        return '<button type="button" data-a="filtre" data-v="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      '<p class="discret">' + liste.length + ' praticien' + (liste.length > 1 ? 's' : '') +
      '. Pour ajouter ou modifier un contact, utilisez le Google Sheet depuis l\'ordinateur.</p><ul class="liste">';

    liste.slice(0, S.ui.limite).forEach(function (g) {
      var r = g[0], ouvert = S.ui.contactOuvert === r.code;
      h += '<li class="element"><button type="button" style="all:unset;display:block;width:100%;cursor:pointer" data-a="contact" data-v="' +
        esc(r.code) + '" aria-expanded="' + ouvert + '">' +
        '<span class="element-titre">' + esc(r.nom) + '</span>' +
        '<span class="discret bloc-texte">' + esc(r.specialite) + ', ' + esc(r.quartier) + (g.length > 1 ? ' et ' + (g.length - 1) + ' autre lieu' : '') + '</span>' +
        '<span class="etiquettes"><span class="etiquette' + (+r.priorite === 1 ? ' p1' : '') + '">Priorité ' + r.priorite + '</span>' +
        '<span class="etiquette">' + esc(vuDepuis(r.derniere)) + '</span>' +
        (r.statut ? '<span class="etiquette ' + (estKo(r.statut) ? 'ko' : 'ok') + '">' + esc(r.statut) + '</span>' : '') +
        etiquetteCollegues(r.code, aujourdhui()) +
        '</span></button>';
      if (ouvert) {
        if (r.commentaire) h += '<p class="discret" style="margin:10px 0 0">Dernier commentaire : ' + esc(r.commentaire) + '</p>';
        h += '<ul class="lignes-contact">' + g.map(function (x) {
          return '<li><div><b>' + esc(x.jour) + ' ' + esc(x.creneau.toLowerCase()) + ', ' + esc(x.heure) + '</b>' +
            '<div class="discret">' + esc(x.lieu) + ', ' + esc(x.quartier) + '</div></div>' +
            '<button class="bouton" type="button" data-a="planifier" data-v="' + esc(x.id) + '">Planifier</button></li>';
        }).join('') + '</ul>' +
        '<a class="bouton bouton-large" style="margin-top:10px" href="' + lienCarte(r) + '" target="_blank" rel="noopener">Itinéraire</a>';
      }
      h += '</li>';
    });
    h += '</ul>';
    if (liste.length > S.ui.limite) h += '<button class="bouton bouton-large" type="button" data-a="plus">Afficher plus</button>';
    return h;
  };

  // ------------------------------------------------------------------ Vue : historique
  VUES.historique = function () {
    var enAttente = S.queue.slice().reverse().map(function (v) { v = Object.assign({}, v); v.attente = true; return v; });
    var tout = enAttente.concat((S.data.historique || []).filter(function (v) {
      return !S.queue.some(function (q) { return q.uid === v.uid; });
    }));
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
    if (S.queue.length) {
      h += '<div class="bandeau"><p>' + S.queue.length + ' visite' + (S.queue.length > 1 ? 's' : '') +
        ' en attente d\'envoi. Elles partiront automatiquement dès que le réseau revient.</p></div>';
    }
    if (!S.config.demo) {
      h += '<div class="filtres" role="group" aria-label="Visites affichées">' +
        '<button type="button" data-a="histFiltre" data-v="moi" aria-pressed="' + (S.ui.histFiltre !== 'equipe') + '">Mes visites</button>' +
        '<button type="button" data-a="histFiltre" data-v="equipe" aria-pressed="' + (S.ui.histFiltre === 'equipe') + '">Toute l\'équipe</button></div>';
    }
    var liste = S.ui.histFiltre === 'equipe' ? tout : hist;
    if (!liste.length) return h + '<div class="vide"><strong>Aucune visite enregistrée</strong>Les visites validées depuis la tournée apparaîtront ici.</div>';
    h += '<ul class="liste">' + liste.slice(0, 150).map(function (v) {
      return '<li class="element"><div class="element-tete"><div>' +
        '<div class="element-titre">' + esc(v.nom) + '</div>' +
        '<div class="discret">' + esc(v.lieu) + ', ' + esc(v.quartier) + '</div>' +
        (v.commentaire ? '<div style="margin-top:4px">' + esc(v.commentaire) + '</div>' : '') +
        '<div class="etiquettes"><span class="etiquette ' + (compte(v) ? 'ok' : 'ko') + '">' + esc(v.statut) + '</span>' +
        (v.attente ? '<span class="etiquette p1">En attente d\'envoi</span>' : '') +
        (v.delegue && !estMoi(v.delegue) ? '<span class="etiquette equipe">' + esc(v.delegue) + '</span>' : '') + '</div></div>' +
        '<div class="element-mesure">' + (v.date ? dateCourte(v.date) : '') + '<small>' + esc(v.creneau) + '</small></div></div></li>';
    }).join('') + '</ul>';
    return h;
  };

  // ------------------------------------------------------------------ Vue : réglages
  VUES.reglages = function () {
    var c = S.config;
    var h = '<h2 class="titre-vue">Réglages</h2>';
    h += '<section class="bloc"><h3 style="margin-top:0">Connexion au Google Sheet</h3>' +
      '<p class="discret" style="margin-top:0">Collez l\'URL de l\'application Web et le jeton d\'accès affichés dans le Google Sheet (menu Tournées).</p>' +
      '<label class="champ"><span>URL de l\'application Web</span><input type="url" id="cfgUrl" inputmode="url" autocomplete="off" ' +
        'placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>' +
      '<label class="champ"><span>Jeton d\'accès</span><input type="text" id="cfgToken" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(c.token) + '"></label>' +
      '<label class="champ"><span>Votre nom (visible par vos collègues)</span><input type="text" id="cfgNom" autocomplete="name" value="' + esc(c.delegue || '') + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="tester">Tester</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="enregistrer">Enregistrer</button></div>' +
      (S.ui.erreur ? '<p class="discret" style="color:var(--rouge);margin-bottom:0">' + esc(S.ui.erreur) + '</p>' : '') +
      '</section>';
    h += '<section class="bloc"><h3 style="margin-top:0">Données</h3>' +
      '<p class="discret" style="margin-top:0">' +
      (S.config.demo ? 'Mode démonstration : les données restent sur ce téléphone.' :
        (S.data && S.data.syncedAt ? 'Dernière synchronisation : ' + new Date(S.data.syncedAt).toLocaleString('fr-FR') + '.' : 'Pas encore synchronisé.')) +
      (pret() ? ' ' + S.data.base.length + ' lignes en mémoire.' : '') +
      (S.queue.length ? ' ' + S.queue.length + ' visite(s) en attente d\'envoi.' : '') + '</p>' +
      (S.config.url && !S.config.demo ? '<button class="bouton bouton-large" type="button" data-a="sync" style="margin-bottom:10px">Synchroniser maintenant</button>' : '') +
      (S.config.url && !S.config.demo ? '<button class="bouton bouton-plein bouton-large" type="button" data-a="partager" style="margin-bottom:10px">Partager l\'application avec un collègue</button>' +
        '<p class="discret" style="margin-top:0">Le lien contient l\'accès à la base : envoyez-le uniquement à vos collègues.</p>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="demo" style="margin-bottom:10px">Charger les données de démonstration</button>' +
      '<button class="bouton bouton-large bouton-danger" type="button" data-a="reinitialiser">Effacer les données de ce téléphone</button>' +
      '</section>';
    h += '<section class="bloc"><h3 style="margin-top:0">Installer sur le téléphone</h3>' +
      (S.ui.installEvt ? '<button class="bouton bouton-plein bouton-large" type="button" data-a="installer">Installer l\'application</button>' :
        '<p class="discret" style="margin:0">Android (Chrome) : menu ⋮ puis « Installer l\'application ». ' +
        'iPhone (Safari) : bouton Partager puis « Sur l\'écran d\'accueil ».</p>') +
      '</section><p class="discret" style="text-align:center">Tournées, version 1.0</p>';
    return h;
  };

  // ------------------------------------------------------------------ Actions
  function arret(uid) { return S.plan.filter(function (a) { return a.uid === uid; })[0]; }

  function genererTournee() {
    var conserves = S.plan.filter(function (a) { return a.etat === 'valide'; });
    var nonValides = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; }).length;
    if (nonValides && !confirm(nonValides + ' visite(s) renseignée(s) ne sont pas validées et seront perdues. Continuer ?')) return;
    var p = S.params;
    if (p.mode === 'jour' && jourSemaineIndex(p.dateRef) > 4) { toast('Choisissez un jour de semaine.'); return; }
    var dates = p.mode === 'jour' ? [p.dateRef] : [0, 1, 2, 3, 4].map(function (i) { return ajouterJours(lundiDe(p.dateRef), i); });
    var garder = conserves.filter(function (a) { return dates.indexOf(a.date) >= 0; });
    var exclus = {}; garder.forEach(function (a) { exclus[a.code] = true; });
    if (p.eviterCollegues !== false) arretsCollegues().forEach(function (c) { if (dates.indexOf(c.date) >= 0) exclus[c.code] = true; });
    var nouveau = Moteur.genererPlanning(S.data.base, quartiers(), {
      mode: p.mode, dateRef: p.dateRef, commune: p.commune, maxJour: +p.maxJour || 8,
      regroup: p.regroup, delai: +p.delai || 0, exclusCodes: exclus
    });
    garder.forEach(function (a) { Moteur.insererArret(nouveau, a, quartiers()); });
    S.plan = nouveau; S.ui.voirParams = false; S.ui.jour = null; S.ui.ouvert = null;
    sauver(); rendre(); publierPlan();
    toast(nouveau.length ? nouveau.length + ' visites planifiées.' : 'Aucun praticien ne correspond à ces critères.');
  }

  function valider() {
    var aValider = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; });
    if (!aValider.length) return;
    var t = aujourdhui(), ko = 0;
    aValider.forEach(function (a) {
      var v = { uid: a.uid, date: a.date > t ? t : a.date, id: a.rowId, code: a.code, nom: a.nom, type: a.type,
                specialite: a.specialite, priorite: a.priorite, commune: a.commune, quartier: a.quartier,
                lieu: a.lieu, creneau: a.creneau, statut: a.statut, commentaire: a.commentaire || '', delegue: moi() };
      Moteur.appliquerVisite(S.data.base, v, statuts());
      if (S.config.demo) {
        v.horodatage = new Date().toISOString();
        S.data.historique = [v].concat(S.data.historique || []);
      } else {
        S.queue.push(v);
      }
      if (estKo(a.statut)) ko++;
      a.etat = 'valide';
    });
    S.ui.ouvert = null;
    sauver(); rendre();
    toast(aValider.length + ' visite' + (aValider.length > 1 ? 's validées' : ' validée') +
      (ko ? '. ' + ko + ' non réalisée(s) : pensez au rattrapage.' : '.'));
    publierPlan();
  }

  function ajouterArret(row, date, score, dist, etat) {
    if (S.plan.some(function (a) { return a.date === date && a.code === row.code; })) {
      toast('Ce praticien est déjà prévu ce jour-là.'); return false;
    }
    var a = Moteur.creerArret(row, date, score, dist || 0);
    a.etat = etat || 'ajoute';
    Moteur.insererArret(S.plan, a, quartiers());
    sauver(); publierPlan();
    toast('Ajouté à la tournée du ' + dateCourte(date) + '.');
    return true;
  }

  function localiser() {
    if (!navigator.geolocation) { toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
    toast('Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var r = Moteur.quartierLePlusProche(pos.coords.latitude, pos.coords.longitude, quartiers());
      if (!r) return;
      S.ui.ref.quartier = r.quartier.quartier;
      rendre();
      toast(r.km > 8 ? 'Vous semblez hors d\'Abidjan. Quartier le plus proche : ' + r.quartier.quartier + '.' :
        'Position : ' + r.quartier.quartier + ' (environ ' + km(r.km) + ').');
    }, function () {
      toast('Position indisponible. Autorisez la localisation ou choisissez le quartier.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 });
  }

  function chargerDemo() {
    if (pret() && !S.config.demo && !confirm('Remplacer les données synchronisées par des données de démonstration ?')) return;
    S.config.demo = true;
    S.data = { base: genererBaseFictive(aujourdhui()), quartiers: quartiersDefautObjets(), statuts: STATUTS_DEFAUT,
               historique: [], syncedAt: null };
    S.plan = []; S.queue = []; S.ui.tab = 'tournee'; S.ui.voirParams = false; S.ui.ref = null;
    sauver(); rendre();
    toast('Données de démonstration chargées : ' + S.data.base.length + ' lignes.');
  }

  function lireConfigFormulaire() {
    return { url: ($('cfgUrl').value || '').trim(), token: ($('cfgToken').value || '').trim(), demo: false,
             delegue: (($('cfgNom') && $('cfgNom').value) || '').trim() };
  }

  var ACTIONS = {
    nav: function (el) {
      S.ui.tab = el.dataset.tab;
      if (S.ui.tab === 'rattrapage' && S.ui.ref && !S.ui.ref.code) S.ui.ref = null;
      rendre(); window.scrollTo(0, 0);
    },
    param: function (el) { S.params[el.dataset.k] = el.dataset.v; LS.set('params', S.params); rendre(); },
    voirParams: function () { S.ui.voirParams = true; rendre(); },
    generer: genererTournee,
    jour: function (el) { S.ui.jour = el.dataset.v; S.ui.ouvert = null; rendre(); },
    ouvrir: function (el) { S.ui.ouvert = S.ui.ouvert === el.dataset.uid ? null : el.dataset.uid; rendre(); },
    statut: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.statut = a.statut === el.dataset.v ? '' : el.dataset.v;
      LS.set('plan', S.plan); rendre();
    },
    retirer: function (el) {
      S.plan = S.plan.filter(function (a) { return a.uid !== el.dataset.uid; });
      Moteur.recalculerDistances(S.plan, quartiers());
      S.ui.ouvert = null; LS.set('plan', S.plan); rendre(); publierPlan();
    },
    rattraper: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      if (!a.statut) a.statut = 'Absent';
      LS.set('plan', S.plan);
      S.ui.ref = { quartier: a.quartier, date: a.date, creneau: a.creneau, heure: a.heure, code: a.code, rowId: a.rowId, nom: a.nom };
      S.ui.tab = 'rattrapage'; rendre(); window.scrollTo(0, 0);
    },
    refCreneau: function (el) { S.ui.ref.creneau = el.dataset.v; rendre(); },
    localiser: localiser,
    ajouterProp: function (el) {
      var liste = el.dataset.s === 'm' ? S.ui.props.memePraticien : S.ui.props.proches;
      var x = liste[+el.dataset.i]; if (!x) return;
      if (ajouterArret(x.row, x.date, x.score, x.dist)) rendre();
    },
    contact: function (el) { S.ui.contactOuvert = S.ui.contactOuvert === el.dataset.v ? null : el.dataset.v; rendre(); },
    filtre: function (el) { S.ui.filtre = el.dataset.v; S.ui.limite = 40; rendre(); },
    plus: function () { S.ui.limite += 40; rendre(); },
    collegue: function (el) { S.ui.collegue = el.dataset.v; S.ui.jourEquipe = null; rendre(); },
    jourEquipe: function (el) { S.ui.jourEquipe = el.dataset.v; rendre(); },
    histFiltre: function (el) { S.ui.histFiltre = el.dataset.v; rendre(); },
    enregistrerNom: function () {
      var n = ($('nomDelegue').value || '').trim();
      if (n.length < 2) { toast('Indiquez votre nom.'); return; }
      S.config.delegue = n; LS.set('config', S.config);
      S.ui.tab = 'tournee'; rendre(); publierPlan();
      toast('Bienvenue ' + n + '.');
    },
    planifier: function (el) {
      var row = S.data.base.filter(function (r) { return String(r.id) === el.dataset.v; })[0]; if (!row) return;
      var date = prochaineDate(prochainJourOuvre(aujourdhui()), row.jour, false);
      if (ajouterArret(row, date, calcScore(row.priorite, joursEcoules(row.derniere, date), row.statut), 0)) {
        S.ui.jour = date; rendre();
      }
    },
    valider: valider,
    sync: function () {
      if (S.config.demo) { toast('Mode démonstration : aucune synchronisation.'); return; }
      if (!S.config.url) { S.ui.tab = 'reglages'; rendre(); return; }
      synchroniser(false);
    },
    tester: function () {
      var cfg = lireConfigFormulaire();
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url)) { toast('L\'URL doit commencer par https://script.google.com/'); return; }
      toast('Test en cours…');
      apiGet('ping', cfg).then(function (r) { toast('Connexion réussie au classeur « ' + r.classeur + ' ».'); },
                               function (e) { toast(e.message); });
    },
    enregistrer: function () {
      var cfg = lireConfigFormulaire();
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url) || !cfg.token) {
        toast('Renseignez l\'URL (https://script.google.com/…) et le jeton.'); return;
      }
      if (S.config.demo) { S.plan = []; S.queue = []; S.data = null; }
      S.config = cfg; S.ui.erreur = ''; sauver();
      toast('Réglages enregistrés. Synchronisation…');
      synchroniser(false).then(function () { if (pret()) { S.ui.tab = 'tournee'; rendre(); } });
    },
    demo: chargerDemo,
    reinitialiser: function () {
      var msg = S.queue.length ? S.queue.length + ' visite(s) non envoyée(s) seront perdues. ' : '';
      if (!confirm(msg + 'Effacer toutes les données de l\'application sur ce téléphone ?')) return;
      LS.vider(); location.reload();
    },
    installer: function () {
      var evt = S.ui.installEvt; if (!evt) return;
      evt.prompt(); evt.userChoice.then(function () { S.ui.installEvt = null; rendre(); });
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el || !ACTIONS[el.dataset.a]) return;
    e.preventDefault();
    ACTIONS[el.dataset.a](el, e);
  });

  // Champs de formulaire
  document.addEventListener('input', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f;
    if (f === 'commentaire') { var a = arret(el.dataset.uid); if (a) { a.commentaire = el.value; LS.set('plan', S.plan); } }
    if (f === 'recherche') {
      S.ui.recherche = el.value; S.ui.limite = 40;
      var pos = el.selectionStart; rendre();
      var champ = document.querySelector('[data-f="recherche"]');
      if (champ) { champ.focus(); champ.setSelectionRange(pos, pos); }
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f;
    if (f === 'param') {
      var k = el.dataset.k;
      S.params[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? +el.value : el.value);
      LS.set('params', S.params);
      if (k === 'dateRef') rendre();
    }
    if (f === 'ref') { S.ui.ref[el.dataset.k] = el.value; rendre(); }
  });

  // ------------------------------------------------------------------ Démarrage
  window.addEventListener('online', function () { synchroniser(true); });
  window.addEventListener('offline', function () { S.ui.sync = 'horsligne'; afficherEntete(); });
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); S.ui.installEvt = e; if (S.ui.tab === 'reglages') rendre();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var age = S.data && S.data.syncedAt ? Date.now() - new Date(S.data.syncedAt).getTime() : Infinity;
    if (S.queue.length || age > 10 * 60 * 1000) synchroniser(true);
  });
  setInterval(function () { if (document.visibilityState === 'visible' && S.queue.length) synchroniser(true); }, 120000);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // Lien d'installation : #config=<base64 de {"url","token"}> (la partie après # n'est jamais envoyée au serveur)
  function lireConfigLien() {
    var m = location.hash.match(/config=([A-Za-z0-9_\-]+)/);
    if (!m) return false;
    try {
      var b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      var cfg = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (!cfg.url || !cfg.token) return false;
      if (S.config.demo || S.config.url !== cfg.url) { S.plan = []; S.queue = S.config.url === cfg.url ? S.queue : []; S.data = null; }
      S.config = { url: cfg.url, token: cfg.token, demo: false, delegue: S.config.delegue || '' };
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
  ACTIONS.partager = function () {
    var lien = lienInstallation();
    var texte = 'Application Tournées : ouvrez ce lien sur votre téléphone, puis installez l\'application.';
    if (navigator.share) {
      navigator.share({ title: 'Tournées', text: texte, url: lien }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(lien).then(function () { toast('Lien copié. Envoyez-le à votre collègue.'); },
        function () { prompt('Copiez ce lien :', lien); });
    } else {
      prompt('Copiez ce lien :', lien);
    }
  };

  var configureParLien = lireConfigLien();
  rendre();
  if (configureParLien) toast('Application configurée. Synchronisation…');
  if (S.config.url && !S.config.demo) synchroniser(!configureParLien).then(function () {
    if (configureParLien && pret()) { S.ui.tab = 'tournee'; rendre(); }
  });
})();
