  // ------------------------------------------------------------------ Vue : accueil et identité
  // 3.26.73 : téléphone relié à la base, données pas encore reçues : on explique et on relance, au lieu de l'écran d'accueil
  VUES.chargement = function () {
    if (S.ui.restauration) return '<section class="accueil"><img src="icon-192.png" alt="" width="64" height="64" style="border-radius:16px;margin:6px 0 18px"><h1>Ouverture…</h1><p>Lecture de vos données sur le téléphone.</p></section>';
    var enc = S.ui.sync === 'encours', err = S.ui.sync === 'erreur', hl = S.ui.sync === 'horsligne' || !navigator.onLine;
    return '<section class="accueil">' +
      '<img src="icon-192.png" alt="" width="64" height="64" style="border-radius:16px;margin:6px 0 18px">' +
      '<h1>' + (enc ? 'Téléchargement de votre base…' : 'Votre base n\'est pas encore chargée') + '</h1>' +
      '<p>' + (enc ? 'Les praticiens et leurs plannings arrivent (environ 1,4 Mo). Cela peut prendre jusqu\'à une minute avec un réseau lent. Gardez l\'application ouverte.' :
        hl ? 'Pas de réseau. Activez les données mobiles ou le Wi-Fi, puis touchez « Réessayer ».' :
        err ? 'Le chargement a échoué : ' + esc(String(S.ui.erreur || 'erreur inconnue').replace(/\.\s*$/, '')) + '. Touchez « Réessayer ». Si cela recommence, vérifiez le réseau ou demandez un nouveau lien de connexion.' :
        'Touchez « Réessayer » pour charger les données.') + '</p>' +
      (enc ? '' : '<button class="bouton bouton-plein bouton-large" type="button" data-a="sync">Réessayer</button>') +
      '<button class="bouton bouton-large" type="button" data-a="nav" data-tab="reglages" style="margin-top:10px">Réglages de connexion</button>' +
      '</section>';
  };
  VUES.accueil = function () {
    return '<section class="accueil">' +
      '<img src="icon-192.png" alt="" width="64" height="64" style="border-radius:16px;margin:6px 0 18px">' +
      '<h1>Votre tournée, construite sur le planning de chaque médecin.</h1>' +
      '<p>L\'application choisit les praticiens selon leur potentiel et la date de votre dernière visite, vérifie qu\'ils sont ' +
      'présents au bon endroit et à la bonne heure, et évite ceux que vos collègues ont déjà ciblés. Elle fonctionne aussi sans réseau.</p>' +
      '<button class="bouton bouton-plein" data-a="nav" data-tab="reglages" type="button">Connecter mon Google Sheet</button>' +
      '<button class="bouton" data-a="demo" type="button">Essayer avec des données de démonstration</button></section>';
  };
  VUES.identite = function () {
    return '<section class="accueil"><h1>Qui êtes-vous ?</h1>' +
      '<p>Votre nom apparaît auprès de vos collègues, sur votre tournée et vos visites. Il permet à chacun de savoir quels praticiens sont déjà ciblés.</p>' +
      champNom('nomDelegue', moi(), 'Votre nom') +
      '<label class="champ"><span>Votre numéro WhatsApp (facultatif)</span><input type="tel" id="numWhatsapp" inputmode="tel" placeholder="Ex. 07 07 07 07 07"></label>' +
      '<button class="bouton bouton-plein" data-a="enregistrerNom" type="button">Continuer</button></section>';
  };

  // ------------------------------------------------------------------ Période et paramètres
  // Jours fériés : calendrier officiel de la Côte d'Ivoire (date.nager.at, mis en cache sur le téléphone)
  // + jours ajoutés dans la feuille Listes (fêtes musulmanes, ponts…)
  var NOMS_FERIES = { "New Year's Day": 'Jour de l\'An', 'Easter Monday': 'Lundi de Pâques', 'Labour Day': 'Fête du Travail',
    'Ascension Day': 'Ascension', 'Whit Monday': 'Lundi de Pentecôte', 'Independence Day': 'Fête de l\'Indépendance',
    'Assumption Day': 'Assomption', 'All Saints Day': 'Toussaint', 'National Peace Day': 'Journée nationale de la Paix', 'Christmas Day': 'Noël' };
  var memoFeries = { cle: null, m: null };
  function feriesMap() {
    var cal = LS.get('feriesCal', null), cle = (cal ? cal.t : 0) + '|' + ((S.data && S.data.feries) || []).join(',');
    if (memoFeries.cle === cle) return memoFeries.m;
    var m = {};
    if (!cal) FERIES_DEFAUT.forEach(function (d) { m[d] = 'Jour férié'; });
    else Object.keys(cal.m).forEach(function (d) { m[d] = cal.m[d]; });
    ((S.data && S.data.feries) || []).forEach(function (d) { if (!m[d]) m[d] = 'Jour férié'; });
    memoFeries = { cle: cle, m: m };
    return m;
  }
  function feries() { return Object.keys(feriesMap()); }
  function estFerie(d) { return !!feriesMap()[d]; }
  function nomFerie(d) { return feriesMap()[d] || ''; }
  function chargerFeriesCalendrier() {
    var cal = LS.get('feriesCal', null);
    if (!navigator.onLine || (cal && Date.now() - cal.t < 7 * 86400000)) return;
    var an = +aujourdhui().slice(0, 4);
    Promise.all([an, an + 1].map(function (y) { return fetch('https://date.nager.at/api/v3/PublicHolidays/' + y + '/CI').then(function (r) { return r.json(); }); }))
      .then(function (l) {
        var m = {};
        l.forEach(function (a) { a.forEach(function (x) { m[x.date] = NOMS_FERIES[x.name] || x.localName || x.name; }); });
        if (!Object.keys(m).length) return;
        LS.set('feriesCal', { t: Date.now(), m: m }); ctxCache.data = null; rendreSiPossible();
      }).catch(function () {});
  }
  function bandeauFeries(dates) {
    var l = dates.filter(estFerie);
    if (!l.length) return '';
    return '<div class="bandeau info">' + icone('calendrier') + '<p><b>Jour' + (l.length > 1 ? 's' : '') + ' férié' + (l.length > 1 ? 's' : '') + '</b> : ' +
      l.map(function (d) { return dateCourte(d) + ', ' + esc(nomFerie(d)); }).join(' ; ') + '. Aucune visite n\'est prévue ce' + (l.length > 1 ? 's jours-là' : ' jour-là') + '.</p></div>';
  }
  // 3.17.0 : visites déjà présentes un jour donné, à ne jamais écraser par une nouvelle planification :
  // tournée en cours (toute si elle est confirmée, sinon les visites renseignées, gardées ou imposées),
  // sinon programme archivé ou publié (confirmé) et comptes rendus de ce jour
  function vraiStatut(s) { return s && s !== 'À faire' ? s : ''; }
  function versPlan(x, v, d) {
    var s = v || x, x2 = x || {}, pr = praticien(s.code) || {}, c = creneauDe(s.code, d, s.idPresence || x2.idPresence, s.creneau || x2.creneau);
    var st = v ? v.statut || '' : vraiStatut(x2.statut);
    return completerHeures({ uid: (v && v.uid) || x2.uid || ('C-' + d + '-' + s.code), date: d, heure: x2.heure || (v && v.heure) || '', creneau: s.creneau || x2.creneau || (c ? c.creneau : ''),
      debut: x2.debut || '', fin: x2.fin || '', idPresence: s.idPresence || x2.idPresence || '', code: s.code, nom: s.nom || pr.nom || s.code, type: pr.type || s.type || 'Médecin',
      specialite: s.specialite || pr.specialite || '', note: pr.note || s.note, conventionne: pr.conventionne, quartier: s.quartier || x2.quartier || '', commune: s.commune || x2.commune || '',
      lieu: s.lieu || x2.lieu || '', lat: c && c.coord ? c.coord.lat : null, lon: c && c.coord ? c.coord.lon : null, statut: st,
      activite: v ? v.activite || '' : '', produits: v ? v.produits || '' : '', commentaire: v ? v.commentaire || '' : '', prochaine: v ? String(v.prochaine || '').slice(0, 10) : '',
      etat: st ? 'valide' : '', garde: true, impose: false, rdv: '', dist: 0, retard: false });
  }
  function donneesJour(d, tout) {
    var dansPlan = S.plan.filter(function (a) { return a.date === d; });
    if (dansPlan.length) return dansPlan.filter(function (a) { return tout || jourConfirme(d) || a.statut || a.etat === 'valide' || a.garde || a.impose || a.corrige; });
    var prevus = programmeDuJour(d).filter(function (x) {
      return tout || vraiStatut(x.statut) || (x.prog ? x.prog === 'valide' : x.programme !== 'Proposition');
    });
    var faites = visitesConnues().filter(function (v) { return String(v.date || '').slice(0, 10) === d && (!v.delegue || estMoi(v.delegue)) && v.code; });
    var parCode = {}; faites.forEach(function (v) { parCode[v.code] = v; });
    var l = prevus.map(function (x) { return versPlan(x, parCode[x.code], d); });
    faites.forEach(function (v) { if (!prevus.some(function (x) { return x.code === v.code; })) l.push(versPlan(null, v, d)); });
    var vus = {};
    return l.filter(function (a) { if (vus[a.code]) return false; vus[a.code] = true; return true; });
  }
  function bandeauDejaPlanifie(dates) {
    var l = dates.map(function (d) { return { d: d, n: donneesJour(d).length }; }).filter(function (x) { return x.n; });
    if (!l.length) return '';
    return '<div class="bandeau info deja-planifie">' + icone('calendrier') + '<p><b>Déjà planifié</b><br>' +
      l.map(function (x) { return majuscule(dateCourte(x.d)) + ' : ' + x.n + ' visite' + (x.n > 1 ? 's' : ''); }).join('<br>') +
      '<br><span class="discret">Ces visites restent en place ; seuls les créneaux libres seront complétés.</span></p></div>';
  }
  function prochainFerie() {
    var t = aujourdhui(), l = feries().filter(function (d) { return d >= t; }).sort();
    return l.length ? l[0] : '';
  }
  // Dates de la période (affichage) et dates travaillées (jours fériés exclus) pour le tirage
  // 3.24.23 : on ne planifie jamais un jour passé ; une semaine entamée ne garde que ses jours à venir
  function dateRefValide() {
    var p = S.params, t = aujourdhui();
    if (!p.dateRef || p.dateRef < t && (p.mode === 'jour' || joursOuvres(lundiDe(p.dateRef))[4] < t)) { p.dateRef = t; LS.set('params', p); }
    return p.dateRef;
  }
  function datesAffichees() {
    var p = S.params, t = aujourdhui(), r = dateRefValide();
    return (p.mode === 'jour' ? [r] : joursOuvres(lundiDe(r))).filter(function (d) { return d >= t; });
  }
  function datesPeriode() { return datesAffichees().filter(function (d) { return !estFerie(d); }); }
  function communesPour(date) {
    var p = S.params;
    if (p.mode === 'semaine' && p.parJour) {
      var j = p.communesJour[jourSemaineIndex(date)];
      if (j && j.length) return j;
    }
    // 3.25.35 : Le filtre maître est dans Répertoire (S.ui.filtres.communes)
    var fCom = (S.ui.filtres && Array.isArray(S.ui.filtres.communes) && S.ui.filtres.communes.length) ? S.ui.filtres.communes : p.communes;
    return fCom && fCom.length ? fCom : null;
  }
  function departCoord() {
    var q = quartiers().filter(function (x) { return x.quartier === S.config.depart; })[0];
    return q ? { lat: q.lat, lon: q.lon } : null;
  }

  // ------------------------------------------------------------------ Vues du parcours : Aujourd'hui (terrain) et Planifier (préparation)
  function datesPlan() { return Array.from(new Set(S.plan.map(function (a) { return a.date; }))).sort(); }
  // 3.24.23 : Planifier ne montre qu'aujourd'hui et l'à venir ; les jours passés restent en mémoire (Aujourd'hui, Reprendre un ancien programme)
  function datesPlanAvenir() { var t = aujourdhui(); return datesPlan().filter(function (d) { return d >= t; }); }
  function etatJour(d) { return S.jours[d] && S.jours[d].etat === 'valide' ? 'valide' : 'proposition'; }
  function jourConfirme(d) { return etatJour(d) === 'valide'; }
  function joursBrouillon() { return datesPlanAvenir().filter(function (d) { return !jourConfirme(d); }); }
  function mettreBrouillon(dates) { dates.forEach(function (d) { S.jours[d] = { etat: 'proposition', valideLe: '', modifieLe: '' }; }); }
  function signatureJour(d) { return S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code + '@' + a.heure; }).sort().join(','); }
  function confirmerJours(dates) {
    var h = horodatageCourt(), sig = LS.get('signJours', {});
    dates.forEach(function (d) { S.jours[d] = { etat: 'valide', valideLe: h, modifieLe: '' }; sig[d] = signatureJour(d); });
    LS.set('signJours', sig);
  }
  // un jour confirmé dont le contenu a changé depuis la dernière publication est daté « modifié le »
  function marquerModifie(sansModif) {
    var sig = LS.get('signJours', {}), h = horodatageCourt();
    datesPlan().forEach(function (d) {
      var s = signatureJour(d);
      if (!sansModif && jourConfirme(d) && sig[d] !== undefined && sig[d] !== s) S.jours[d].modifieLe = h;
      sig[d] = s;
    });
    LS.set('signJours', sig);
  }
  // fenêtre de l'agenda : 7 jours passés (les comptes rendus non envoyés restent), états alignés sur les jours présents
  function nettoyerAgenda() {
    var lim = ajouterJours(aujourdhui(), -7);
    S.plan = S.plan.filter(function (a) { return a.date >= lim || (a.statut && a.etat !== 'valide'); });
    var present = ensemble(datesPlan()), retires = LS.get('joursRetires', {});
    // 3.24.9 : un jour qui disparaît n'est plus noté « retiré » d'office (il revenait vide après certaines mises à jour) ;
    // seul un retrait volontaire (dernière visite du jour retirée) l'écarte de l'import
    Object.keys(S.jours).forEach(function (d) { if (!present[d]) delete S.jours[d]; });
    Object.keys(retires).forEach(function (d) { if (present[d] || d < lim) delete retires[d]; });
    LS.set('joursRetires', retires);
    datesPlan().forEach(function (d) { if (!S.jours[d]) S.jours[d] = { etat: 'proposition', valideLe: '', modifieLe: '' }; });
  }
  // migration : les jours confirmés d'avant l'agenda (programme archivé ou publié, comptes rendus) rejoignent l'agenda
  // 3.22.2 : tout jour de la fenêtre qui a au moins une donnée (tournée archivée ou publiée, brouillon compris,
  // ou compte rendu) apparaît d'office dans l'agenda, à chaque ouverture et après chaque synchronisation.
  // Un jour vidé volontairement (toutes ses visites retirées) n'est pas réimporté.
  // 3.24.2 : lieu, quartier, commune et GPS d'une visite suivent la base : une officine ou un cabinet
  // déplacé (ou des coordonnées corrigées) dans la feuille se reflète à l'écran dès la synchronisation
  function actualiserLieux() {
    var C = ctx(), t0 = ajouterJours(aujourdhui(), -7), change = false, futur = false;
    function maj(a) {
      if (!a || !a.code || String(a.date || '') < t0) return;
      var l = C.parCode[a.code] || [], vus = {}, pres = [];
      l.forEach(function (c) { if (!vus[c.idPresence]) { vus[c.idPresence] = true; pres.push(c); } });
      var c = (a.idPresence && pres.filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0]) || (pres.length === 1 ? pres[0] : null);
      var p = C.prat[a.code];
      var n = c ? { lieu: c.lieu || '', quartier: c.quartier || '', commune: c.commune || '', lat: c.coord ? c.coord.lat : null, lon: c.coord ? c.coord.lon : null } : {};
      if (p && p.nom) n.nom = p.nom;
      Object.keys(n).forEach(function (k) {
        var av = a[k] === undefined || a[k] === null ? '' : String(a[k]), ap = n[k] === undefined || n[k] === null ? '' : String(n[k]);
        if (k === 'lat' || k === 'lon') { av = av === '' ? '' : (+av).toFixed(6); ap = ap === '' ? '' : (+ap).toFixed(6); }
        if (av !== ap) { a[k] = n[k]; change = true; if (a.date >= aujourdhui()) futur = true; }
      });
    }
    S.plan.forEach(maj); (S.horsPlan || []).forEach(maj);
    if (!change) return false;
    LS.set('horsPlan', S.horsPlan || []); sauver();
    if (futur && moi()) { S.ui.aPublier = true; LS.set('aPublier', true); }
    return true;
  }
  function importerAgenda() {
    if (!pret()) return 0;
    actualiserLieux();
    var t = aujourdhui(), n = 0, deja = ensemble(datesPlan()), retires = LS.get('joursRetires', {});
    for (var k = -7; k <= 70; k++) {
      var d = ajouterJours(t, k);
      if (deja[d] || retires[d] || jourSemaineIndex(d) > 4) continue;
      var src = programmeDuJour(d), l = donneesJour(d, true);
      if (!l.length) continue;
      var confirme = src.some(function (x) { return x.prog ? x.prog === 'valide' : x.programme === 'Validé'; }) || l.some(function (x) { return x.statut; });
      l = l.map(function (x) {
        var h = (S.horsPlan || []).filter(function (y) { return y.date === d && y.code === x.code; })[0];
        if (!h) return x;
        S.horsPlan = S.horsPlan.filter(function (y) { return y !== h; });
        var c = Object.assign({}, h); delete c.hors; delete c.horsTournee; c.garde = true; return c;
      });
      S.plan = S.plan.concat(l); S.jours[d] = { etat: confirme ? 'valide' : 'proposition', valideLe: '', modifieLe: '' }; n++;
    }
    LS.set('agendaImporte', true);
    if (!n) return 0;
    LS.set('horsPlan', S.horsPlan || []);
    trierPlan(); sauver();
    return n;
  }
  // 3.27.41 : mise à jour dynamique du planning depuis la feuille Plannings du serveur
  // pour les jours futurs sans visites validées, si l'utilisateur n'a pas de saisie locale non publiée
  function actualiserPlanDepuisServeur() {
    if (!pret() || !moi() || S.ui.aPublier) return false;
    var t = aujourdhui(), change = false;
    var srvPlannings = (S.data && S.data.plannings) || [];
    var srvParDate = {};
    srvPlannings.forEach(function (p) {
      if (p.delegue && estMoi(p.delegue) && p.date >= t) {
        (srvParDate[p.date] = srvParDate[p.date] || []).push(p);
      }
    });
    var datesTraitees = ensemble(Object.keys(srvParDate).concat(datesPlan().filter(function (d) { return d >= t; })));
    Object.keys(datesTraitees).forEach(function (d) {
      if (jourSemaineIndex(d) > 4) return;
      var visitesJour = S.plan.filter(function (a) { return a.date === d; });
      var aValide = visitesJour.some(function (a) { return a.statut || a.etat === 'valide'; });
      if (aValide) return;
      var srvVisites = srvParDate[d] || [];
      var codesActuels = visitesJour.map(function (a) { return a.code; }).join(',');
      var codesServeur = srvVisites.map(function (p) { return p.code; }).join(',');
      if (codesActuels !== codesServeur) {
        S.plan = S.plan.filter(function (a) { return a.date !== d; });
        if (srvVisites.length) {
          var src = donneesJour(d, true);
          var confirme = srvVisites.some(function (x) { return x.prog ? x.prog === 'valide' : x.programme === 'Validé'; });
          S.plan = S.plan.concat(src);
          S.jours[d] = { etat: confirme ? 'valide' : 'proposition', valideLe: '', modifieLe: '' };
        } else {
          delete S.jours[d];
        }
        change = true;
      }
    });
    if (change) {
      trierPlan();
      sauver();
    }
    return change;
  }
  function choisirJour(dates) {
    if (!S.ui.jour || dates.indexOf(S.ui.jour) < 0) {
      var t = aujourdhui();
      S.ui.jour = dates.indexOf(t) >= 0 ? t : (dates.filter(function (d) { return d >= t; })[0] || dates[0]);
    }
  }
  function barreJours(dates) {
    return '<div class="jours" role="group" aria-label="Jour">' + dates.map(function (d) {
      var n = S.plan.filter(function (a) { return a.date === d; });
      var faits = n.filter(function (a) { return a.etat === 'valide'; }).length;
      return '<button type="button" class="jour' + (d === aujourdhui() ? ' aujourdhui' : '') + '" data-a="jour" data-v="' + d +
        '" aria-pressed="' + (d === S.ui.jour) + '"><b>' + JOURS_COURTS[jourSemaineIndex(d)].replace('.', '') + ' ' + (+d.slice(8)) +
        '</b><small>' + (faits ? faits + '/' : '') + n.length + ' visite' + (n.length > 1 ? 's' : '') + '</small></button>';
    }).join('') + '</div>';
  }
  // 3.24.3 : repère du jour affiché par rapport à aujourd'hui, chacun sa couleur
  // (avant-hier et hier en bleu, aujourd'hui en vert, demain et après-demain en ambre)
  function etiquetteRelative(d) {
    var t = aujourdhui(), m = { '-2': ['Avant-hier', 'rel-passe2'], '-1': ['Hier', 'rel-passe'], '0': ['Aujourd\'hui', 'ok'], '1': ['Demain', 'rel-futur'], '2': ['Après-demain', 'rel-futur2'] };
    for (var k = -2; k <= 2; k++) if (ajouterJours(t, k) === d) return ' <span class="etiquette ' + m[k][1] + ' jour-du-jour">' + m[k][0] + '</span>';
    return '';
  }
  function libelleJour(d) { return d === aujourdhui() ? 'Aujourd\'hui' : majuscule(dateLongue(d)); }

  // Aujourd'hui : les visites du jour, dans l'ordre, avec contact, itinéraire et compte rendu
  // Jour affiché : celui de la tournée (S.ui.jour) ou, hors tournée, une date choisie avec ‹ › ou le calendrier (S.ui.jourVue)
  function jourAffiche() {
    var dates = datesPlan();
    if (S.ui.jourVue && dates.indexOf(S.ui.jourVue) >= 0) { S.ui.jour = S.ui.jourVue; S.ui.jourVue = null; }
    if (S.ui.jourVue) return S.ui.jourVue;
    if (!dates.length) return aujourdhui();
    choisirJour(dates); return S.ui.jour;
  }
  function allerAuJour(d) {
    if (datesPlan().indexOf(d) >= 0) { S.ui.jour = d; S.ui.jourVue = null; } else S.ui.jourVue = d;
    S.ui.ouvert = null; rendre(); window.scrollTo(0, 0);
  }
  // En-tête du jour : « Aujourd'hui », la date affichée, l'état de la tournée, une seule navigation (bande de la semaine)
  function nbVisitesJour(d) { var n = S.plan.filter(function (a) { return a.date === d; }).length; return n || programmeDuJour(d).length; }
  function enteteJour(d) {
    var t = aujourdhui(), dates = datesPlan(), tour = dates.indexOf(d) >= 0, etat;
    if (tour) etat = jourConfirme(d) ? '<span class="etiquette ok">Confirmée</span>' :
      '<button type="button" class="etiquette alerte bouton-etiquette" data-a="nav" data-tab="semaine">Brouillon › Planifier</button>';
    else etat = d < t ? '<span class="etiquette">' + (passeVerrouille(d) ? 'Lecture seule' : 'Jour passé') + '</span>' : (d > t ? '<span class="etiquette p1">' + (futurVerrouille(d) ? 'Aperçu' : 'Jour à venir') + '</span>' : '');
    // 3.19.0 : bande défilante des jours ouvrés (glisser à gauche ou à droite), jour choisi au centre, en couleur
    // 3.26.50 : aujourd'hui (et le jour choisi) toujours présents dans la frise, même un week-end (grisé)
    var jours = []; for (var k = -42; k <= 42; k++) jours.push(ajouterJours(d, k));   // 3.26.65 : tous les jours, samedi, dimanche et fériés grisés
    return '<div class="tete-jour"><div><h2 class="titre-vue">Journée' + etiquetteRelative(d) + '</h2>' +
        '<p class="date-jour">' + majuscule(dateLongue(d)) + (d !== t ? ' · <button type="button" class="bouton-texte" data-a="jourAujourdhui">Revenir à aujourd\'hui</button>' : '') + '</p></div>' + etat + '</div>' +
      '<p class="sous-titre">Déroulez votre tournée dans l\'ordre : itinéraire GPS, contacts praticiens et comptes rendus.</p>' +
      '<div class="bande-jours">' +
        '<div class="bj-jours" role="group" aria-label="Jours">' + jours.map(function (x) {
          var n = nbVisitesJour(x);
          return '<button type="button" class="bj-jour' + (x === t ? ' aujourdhui' : '') + (jourSemaineIndex(x) === 0 ? ' lundi' : '') + (jourSemaineIndex(x) > 4 || estFerie(x) ? ' non-ouvre grise' : '') + '" data-a="jourAller" data-v="' + x + '" aria-pressed="' + (x === d) + '"><small>' +
            JOURS_COURTS[jourSemaineIndex(x)].replace('.', '') + '</small><b>' + (+x.slice(8)) + '</b><em>' + MOIS_ABREGES[+x.slice(5, 7) - 1] + '</em><i>' + (n ? n : '') + '</i></button>';
        }).join('') + '</div>' +
        '<button type="button" class="bj-cal" data-a="calOuvrir" aria-label="Choisir une date">' + icone('calendrier') + '</button></div>';
  }
  // 3.27.41 : programme d'un jour hors tournée en cours : feuille Plannings du serveur en priorité, sinon archive locale
  function programmeDuJour(d) {
    var srv = ((S.data && S.data.plannings) || []).filter(function (x) { return x.date === d && x.delegue && estMoi(x.delegue); });
    if (srv && srv.length) return srv;
    var arch = LS.get('archives', {});
    if (arch[d] && arch[d].length) return arch[d];
    return [];
  }
  // visite prévue un jour hors de la tournée en cours (passé ou aujourd'hui) : carte avec compte rendu, gardée à part
  S.horsPlan = LS.get('horsPlan', []).filter(function (a) { return a.date >= ajouterJours(aujourdhui(), -70); });
  // créneau de présence d'un praticien un jour donné (pour retrouver heure, début et fin d'une visite passée)
  function creneauDe(code, d, idPresence, creneau) {
    var l = (ctx().parCode[code] || []).filter(function (c) { return c.jourIdx === jourSemaineIndex(d); });
    return l.filter(function (c) { return idPresence && String(c.idPresence) === String(idPresence); })[0] ||
      l.filter(function (c) { return creneau && c.creneau === creneau; })[0] || l[0] || null;
  }
  function completerHeures(a) {
    if (a.heure && a.debut) return a;
    var c = creneauDe(a.code, a.date, a.idPresence, a.creneau);
    if (c) {
      if (!a.heure) a.heure = minutesVersHeure(c.debut);
      if (!a.debut) a.debut = minutesVersHeure(c.debut);
      if (!a.fin) a.fin = minutesVersHeure(c.fin);
      if (!a.creneau) a.creneau = c.creneau;
      if (!a.lieu) a.lieu = c.lieu; if (!a.quartier) a.quartier = c.quartier; if (!a.reperes) a.reperes = c.reperes || '';
    }
    return a;
  }
  function arretHors(x, d) {
    var uid = 'H-' + d + '-' + x.code, a = S.horsPlan.filter(function (y) { return y.uid === uid; })[0];
    if (a) return completerHeures(a);
    var pr = praticien(x.code) || {}, cr = x.idPresence && ctx().parCode[x.code] ? ctx().parCode[x.code].filter(function (c) { return String(c.idPresence) === String(x.idPresence); })[0] : null;
    a = { uid: uid, hors: true, date: d, heure: x.heure || '', creneau: x.creneau || (cr ? cr.creneau : ''), debut: x.debut || (cr ? minutesVersHeure(cr.debut) : ''), fin: x.fin || (cr ? minutesVersHeure(cr.fin) : ''),
      idPresence: x.idPresence || '', code: x.code, nom: x.nom || pr.nom || x.code, type: pr.type || x.type || 'Médecin', specialite: x.specialite || pr.specialite || '',
      note: x.note || pr.note, conventionne: pr.conventionne, quartier: x.quartier || '', commune: x.commune || '', lieu: x.lieu || '', lat: cr && cr.coord ? cr.coord.lat : '', lon: cr && cr.coord ? cr.coord.lon : '', etat: 'propose' };
    S.horsPlan.push(a); return completerHeures(a);
  }
  // visite déjà renseignée un jour hors tournée : carte « compte rendu enregistré », modifiable (même identifiant que dans l'Historique)
  function arretDeVisite(v, x, d) {
    var uid = v.uid || ('V-' + d + '-' + v.code), a = S.horsPlan.filter(function (y) { return y.uid === uid; })[0];
    if (a) return completerHeures(a);
    var pr = praticien(v.code) || {}; x = x || {};
    a = { uid: uid, hors: true, date: d, heure: v.heure || x.heure || '', creneau: v.creneau || x.creneau || '', debut: x.debut || '', fin: x.fin || '', idPresence: v.idPresence || x.idPresence || '',
      code: v.code, nom: v.nom || x.nom || pr.nom || v.code, type: v.type || pr.type || 'Médecin', specialite: v.specialite || x.specialite || pr.specialite || '', note: v.note || x.note || pr.note,
      conventionne: pr.conventionne, quartier: v.quartier || x.quartier || '', commune: v.commune || x.commune || '', lieu: v.lieu || x.lieu || '',
      statut: v.statut || '', activite: v.activite || '', produits: v.produits || '', commentaire: v.commentaire || '', prochaine: String(v.prochaine || '').slice(0, 10), etat: 'valide' };
    S.horsPlan.push(a); return completerHeures(a);
  }
  // toutes les visites d'un jour hors tournée : prévues (archive ou tournée publiée) et réalisées (Historique)
  function arretsHorsJour(d) {
    var sup = (LS.get('visitesSupprimees', {}) || {})[d] || {};
    var prevus = programmeDuJour(d).filter(function (x) { return !sup[x.code]; }), faites = visitesConnues().filter(function (v) { return String(v.date || '').slice(0, 10) === d && (!v.delegue || estMoi(v.delegue)) && !sup[v.code]; });
    var parCode = {}; faites.forEach(function (v) { parCode[v.code] = v; });
    var l = prevus.map(function (x) { return parCode[x.code] ? arretDeVisite(parCode[x.code], x, d) : arretHors(x, d); });
    faites.forEach(function (v) { if (!prevus.some(function (x) { return x.code === v.code; })) { var a = arretDeVisite(v, null, d); a.horsTournee = true; l.push(a); } });
    return l.sort(function (a, b) { return String(a.heure || '').localeCompare(String(b.heure || '')); });
  }
  // 3.22.1 : en bas de Journée, de quoi remplacer au pied levé un praticien qui n'est plus disponible :
  // + Médecin, + Pharmacie (présents près de moi), Autour de moi (par ma position ou dans les communes du jour)
  function blocRemplacant(d) {
    if (d < aujourdhui() || jourSemaineIndex(d) > 4) return '';
    // 3.27.10 : + Médecin, + Pharmacie, Autour de moi figés en bas comme la barre de Planifier, même taille de boutons
    // 3.27.29 : phrase courte, encadré ajusté au texte ; « Modifier la tournée » dessous
    return '<section class="bloc-remplacant"><p class="discret">Praticien indisponible ? Trouver un remplaçant.</p></section>' +
      '<button class="bouton-texte lien-modifier-tournee" type="button" data-a="nav" data-tab="semaine">' + icone('calendrier') + 'Modifier la tournée</button>' +
      '<div class="barre-plan-actions-flottante"><div class="rangee-tirage barre-remplacant"><button class="bouton" type="button" data-a="ajouterProches" data-v="Médecin" data-d="' + d + '">' + icone('plus') + '<span>Médecin</span></button>' +
      '<button class="bouton" type="button" data-a="ajouterProches" data-v="Pharmacie" data-d="' + d + '">' + icone('plus') + '<span>Pharmacie</span></button>' +
      '<button class="bouton" type="button" data-a="ajouterTournee" data-d="' + d + '">' + icone('cible') + '<span>Autour de moi</span></button></div></div>';
  }
  // jour sans visite (aujourd'hui ou à venir, jour ouvré) : planifier directement cette journée
  function boutonPlanifierJour(d) {
    if (d < aujourdhui()) return '';
    // week-end ou férié : on propose le prochain jour ouvré
    var n = 0; while ((jourSemaineIndex(d) > 4 || estFerie(d)) && n++ < 10) d = ajouterJours(d, 1);
    return '<button class="bouton bouton-plein bouton-large" type="button" data-a="planifierDate" data-v="' + d + '" style="margin-top:12px">' + icone('calendrier') + 'Planifier le ' + esc(dateCourte(d)) + '</button>' +
      boutonAnciens('margin-top:8px');   // 3.26.76 : ou reprendre un ancien programme
  }
  // 3.24.7 : compteurs du jour : visites, faites, sans CR (ouvre le compte rendu), à planifier
  // (visites par jour voulues dans Planifier moins celles déjà prévues ; ouvre Planifier pour ce jour)
  function compteursJour(d, l) {
    var t = aujourdhui(), n = l.length, nf = l.filter(function (a) { return a.statut && !estKo(a.statut); }).length;
    var sans = d <= t || !futurVerrouille(d) ? l.filter(function (a) { return !a.statut; }).length : 0;
    var aPlan = d >= t && jourSemaineIndex(d) < 5 && !estFerie(d) ? Math.max(0, (+S.params.maxJour || 8) - n) : 0;
    return '<b>' + n + ' visite' + (n > 1 ? 's' : '') + '</b> · ' + nf + ' faite' + (nf > 1 ? 's' : '') +
      (sans ? ' · <button type="button" class="bouton-texte lien-cr" data-a="ouvrirRapport">' + sans + ' sans CR ›</button>' : '') +
      (aPlan ? ' · <button type="button" class="bouton-texte lien-cr lien-plan" data-a="planifierDate" data-v="' + d + '">' + aPlan + ' à planifier ›</button>' : '');
  }
  function rendreJourHors(d) {
    var t = aujourdhui(), h = '';
    if (!futurVerrouille(d)) {
      // jour passé (ou à venir si la saisie anticipée est activée) : tout reste modifiable, comme dans la tournée (compte rendu à saisir ou à corriger)
      var l = arretsHorsJour(d);
      if (!l.length) return '<div class="vide"><strong>Aucune visite ce jour-là</strong>Ni tournée archivée ni compte rendu pour cette date.</div>' + boutonPlanifierJour(d);
      var nf = l.filter(function (a) { return a.statut && !estKo(a.statut); }).length;
      h += '<section class="synthese-jour"><div class="sj-ligne"><span>' + compteursJour(d, l) + '</span></div>' +
        barreRealise(nf, l.length, l.filter(function (a) { return a.statut; }).length) +
        '<small class="discret">' + (passeVerrouille(d) ? 'Consultation seule (« Saisie avancée » désactivée dans Réglages › Avancé).' : (d > t ? 'Saisie anticipée activée : touchez une visite pour saisir son compte rendu.' : 'Touchez une visite pour saisir ou modifier son compte rendu.')) + '</small></section>';
      h += '<ol class="ligne">' + l.map(rendreArret).join('') + '</ol>';
      if (l.length) h += blocRemplacant(d);
      if (programmeDuJour(d).length) h += '<div class="rangee-actions pied-jour"><button class="bouton petit" type="button" data-a="ouvrirAnciens">' + icone('relancer') + 'Reprendre ce programme un autre jour</button></div>';
      return h;
    }
    // jour à venir hors tournée : aperçu de la tournée publiée
    var prevus = programmeDuJour(d).slice().sort(function (a, b) { return String(a.heure || '').localeCompare(String(b.heure || '')); });
    if (!prevus.length) return '<div class="vide"><strong>Rien de prévu ce jour-là</strong>Aucune tournée publiée pour cette date.</div>' + boutonPlanifierJour(d);
    h += '<p class="bilan-jour"><b>' + prevus.length + ' visite' + (prevus.length > 1 ? 's' : '') + ' prévue' + (prevus.length > 1 ? 's' : '') + '</b>.</p>';
    h += '<ul class="liste">' + prevus.map(function (x) {
      return '<li class="element' + classeType(x) + '"><div class="element-tete"><div><b>' + esc(x.heure || '--:--') + '</b> · ' + pastilleType(x) + '<b>' + esc(x.nom || '') + '</b> ' + etoiles(x.note) +
        '<span class="discret bloc-texte">' + esc([x.specialite, x.lieu, x.quartier].filter(Boolean).join(', ')) + '</span></div></div></li>';
    }).join('') + '</ul>';
    return h + '<button class="bouton bouton-plein bouton-large" type="button" data-a="jourReprendre" data-v="' + d + '">' + icone('relancer') + 'Reprendre ce programme</button>';
  }

  // ------------------------------------------------------------------ Aujourd'hui : écran de terrain + compte rendu de la journée
  // 1. en-tête (date, état, semaine) 2. synthèse et progression 3. « Maintenant » (selon l'heure) 4. parcours du jour
  // 5. ajouter / modifier 6. compte rendu de la journée (rempli à partir des visites, complété par le délégué)
