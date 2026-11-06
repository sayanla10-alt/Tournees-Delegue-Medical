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
  VUES.jour = function () {
    var d = jourAffiche(), t = aujourdhui(), h = enteteJour(d);
    if (S.ui.jourVue) {
      h += d === t ? rendreRappels() : '';
      if (!futurVerrouille(d)) { var lh = arretsHorsJour(d); if (lh.length && (rapportDe(d) || !passeVerrouille(d))) h += tuileRapport(d, lh); }
      h += rendreJourHors(d);
      return h;
    }
    if (!S.plan.length) {
      return h + rendreRappels() + '<div class="vide"><strong>Aucune visite prévue</strong>Préparez d\'abord votre tournée dans « Planifier ».</div>' +
        (boutonPlanifierJour(d) || '<button class="bouton bouton-plein bouton-large" type="button" data-a="nav" data-tab="semaine" style="margin-top:12px">' + icone('calendrier') + 'Planifier ma tournée</button>');
    }
    var duJour = S.plan.filter(function (a) { return a.date === d; });
    var renseignees = duJour.filter(function (a) { return a.statut; }).length;
    var com = Array.from(new Set(duJour.map(function (a) { return a.commune; }).filter(Boolean)));
    var est = estimationJour(duJour), liens = lienItineraire(duJour);
    var infos = [est ? minutesVersHeure(est.debut) + ' → ' + minutesVersHeure(est.fin) : '', com.length ? esc(libelleCommunes(com)) : ''].filter(Boolean).join(' · ');
    h += '<section class="synthese-jour"><div class="sj-ligne"><span>' + compteursJour(d, duJour) + (infos ? '<small class="discret bloc-texte">' + infos + '</small>' : '') + '</span>' +
        (liens.length ? '<a class="bouton petit" href="' + esc(liens[0]) + '" target="_blank" rel="noopener">' + icone('route') + 'Itinéraire</a>' : '') + '</div>' +
      barreRealise(duJour.filter(function (a) { return a.statut && !estKo(a.statut); }).length, duJour.length, duJour.filter(function (a) { return a.statut; }).length) +
      '</section>';
    if (!futurVerrouille(d) && (rapportDe(d) || !passeVerrouille(d))) h += tuileRapport(d, duJour);
    if (d === t) h += rendreRappels() + rendreMaintenant(duJour, liens);
    // 3.24.23 : les visites renseignées passent en bas (« Effectuées », dans l'ordre des heures) ;
    // en haut restent les visites à faire, les plus proches d'abord
    var hv = function (x) { return heureVersMinutes((x.statut && x.valideA) || x.heure) || 0; };
    var parHeure = function (x, y) { return hv(x) - hv(y); };
    var aFaire = duJour.filter(function (a) { return !a.statut; }), faites = duJour.filter(function (a) { return a.statut; }).sort(parHeure);
    // 3.25.15 : aujourd'hui, avec ma position : les visites pas encore vues du plus proche au plus loin
    var gp = d === t && S.ui.posGps && Date.now() - S.ui.posGps.t < 15 * 60000 ? S.ui.posGps : null, parProximite = false;
    if (gp) {
      var dm = {}; aFaire.forEach(function (a) { var c = coordPrecise(a) || coordArret(a); dm[a.uid] = c ? distanceVol(gp, c) : 99; });
      aFaire.sort(function (x, y) { return dm[x.uid] - dm[y.uid]; }); parProximite = true;
    }
    ['Matin', 'Soir'].forEach(function (cren) {
      var liste = aFaire.filter(function (a) { return a.creneau === cren; });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (a, i) {
        if (i > 0 && a.dist > 0 && !parProximite) {
          h += '<li class="troncon"><div></div><div class="arret-rail"></div>' +
            trajetMini(a.dist, a.trajet !== undefined ? a.trajet : Math.round(a.dist * REGLAGES_MOTEUR.minutesParKm)) + '</li>';
        }
        h += rendreArret(a);
      });
      h += '</ol>';
    });
    // fin de journée (tout est renseigné) : le parcours réel, dans l'ordre des heures de validation
    if (faites.length) h += '<div class="creneau-titre">' + (aFaire.length ? 'Effectuées · ' + faites.length : 'Parcours de la journée · ' + faites.length + ' visite' + (faites.length > 1 ? 's' : '')) + '</div><ol class="ligne faites">' + faites.map(rendreArret).join('') + '</ol>';
    h += blocRemplacant(d);
    return h;
  };
  // accès au compte rendu (page à part, dans le même onglet)
  function tuileRapport(d, liste) {
    var R = rapportDe(d), n = liste.length, r = liste.filter(function (a) { return a.statut; }).length;
    var etat = R && R.valideLe ? '<span class="etiquette ok">Validé</span>' : (R && Object.keys(R.ok || {}).length ? '<span class="etiquette p1">En cours</span>' : '<span class="etiquette">À faire</span>');
    return '<button type="button" class="acces-rapport" data-a="ouvrirRapport"><span>' + icone('crayon') + '<b>Compte Rendu</b><small>' + r + '/' + n + ' visite' + (n > 1 ? 's' : '') + ' renseignée' + (r > 1 ? 's' : '') +
      ' · faits marquants, concurrence, besoins</small></span>' + etat + icone('chevron') + '</button>';
  }
  VUES.rapport = function () {
    var d = jourAffiche(), t = aujourdhui();
    var liste = S.ui.jourVue ? arretsHorsJour(d) : S.plan.filter(function (a) { return a.date === d; });
    return '<button type="button" class="retour" data-a="nav" data-tab="jour">' + icone('chevron') + 'Journée</button>' +
      '<h2 class="titre-vue">Compte Rendu</h2><p class="sous-titre">' + majuscule(dateLongue(d)) + ' : rempli à partir de vos visites, à compléter puis à valider.</p>' +
      (futurVerrouille(d) ? '<div class="vide"><strong>Journée à venir</strong>Le compte rendu se fait le jour même ou après (ou activez « Saisie avancée » dans Réglages › Avancé).</div>' : rendreRapportJour(d, liste, passeVerrouille(d), true));
  };

  // « Maintenant » : ce qu'il y a à faire tout de suite, selon l'heure
  function rendreMaintenant(duJour, liens) {
    var now = minutesMaintenant(), sans = duJour.filter(function (a) { return !a.statut; });
    var aSaisir = sans.filter(function (a) { return heureVersMinutes(a.heure) !== null && heureVersMinutes(a.heure) < now; });
    var suivante = sans.filter(function (a) { return heureVersMinutes(a.heure) === null || heureVersMinutes(a.heure) >= now; })[0];
    var R = rapportDe(aujourdhui()), crValide = !!(R && R.valideLe), finJournee = now >= 18 * 60 + 30;
    var corps = '';
    suivrePosition();
    var proche = visiteProche(sans, suivante);
    if (proche) {
      corps += '<div class="bandeau-proche' + classeType(proche.a) + '">' + pastilleType(proche.a, true) + '<p>Vous êtes à <b>' + metres(proche.d) + '</b> de <b>' + esc(nomSansType(proche.a.nom)) + '</b> (prévu à ' + esc(proche.a.heure) + '). Le voir maintenant ?</p>' +
        '<div class="rangee"><button class="bouton" type="button" data-a="procheNon" data-uid="' + proche.a.uid + '">Non</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="procheOui" data-uid="' + proche.a.uid + '">Maintenant</button></div></div>';
    } else {
      var ph = pharmacieProche(duJour);
      if (ph) {
        corps += '<div class="bandeau-proche t-pharma">' + pastilleType(ph.c.prat, true) + '<p><b>' + esc(nomSansType(ph.c.prat.nom)) + '</b> est à <b>' + metres(ph.d) + '</b>' +
          ', ouverte jusqu\'à ' + minutesVersHeure(ph.c.fin) + ' (' + esc(vuDepuis(ph.c.prat.derniere)) + '). Y aller ?</p>' +
          '<div class="rangee"><button class="bouton" type="button" data-a="pharmaNon" data-v="' + esc(ph.c.code) + '">Non</button>' +
          '<button class="bouton bouton-plein" type="button" data-a="pharmaOui" data-v="' + esc(ph.c.cle) + '">Y aller</button></div></div>';
      }
    }
    if (!sans.length) {
      if (!crValide) {
        var msgCloture = finJournee
          ? 'Fin de journée : toutes vos visites sont renseignées. Pensez à finaliser votre compte rendu de la journée.'
          : 'Toutes les visites prévues sont renseignées. Vous pouvez dès maintenant finaliser et envoyer votre compte rendu de la journée.';
        corps += '<p>' + msgCloture + '</p>' +
          '<div class="rangee-wa"><button class="bouton bouton-plein" type="button" data-a="ouvrirRapport">' + icone('valider') + 'Finaliser le compte rendu</button></div>';
      }
      return corps ? '<section class="maintenant"><h3>Maintenant</h3>' + corps + '</section>' : '';
    }
    if (aSaisir.length) {
      corps += '<div class="a-saisir"><b>' + icone('crayon') + aSaisir.length + ' compte' + (aSaisir.length > 1 ? 's' : '') + ' rendu' + (aSaisir.length > 1 ? 's' : '') + ' à saisir</b>' +
        aSaisir.slice(0, 3).map(function (a) { return '<button type="button" class="bouton-texte" data-a="ouvrirVisite" data-uid="' + a.uid + '">' + esc(a.heure) + ' ' + esc(a.nom) + '</button>'; }).join('') + '</div>';
    }
    if (suivante) {
      var pa = praticien(suivante.code) || {}, premiere = suivante === duJour[0] && !duJour.some(function (a) { return a.statut; });
      var cS = coordPrecise(suivante) || coordArret(suivante), pos = S.ui.posGps && Date.now() - S.ui.posGps.t < 5 * 60000 ? S.ui.posGps : null, tr = '';
      if (cS && pos) {
        var qp = Moteur.quartierLePlusProche(pos.lat, pos.lon, quartiers()), dk = distanceVol(pos, cS);
        tr = trajetMini(dk, minutesTrajet(dk, qp ? qp.quartier.commune : '', suivante.commune, now));
      } else if (suivante.dist > 0) tr = trajetMini(suivante.dist, suivante.trajet !== undefined ? suivante.trajet : Math.round(suivante.dist * REGLAGES_MOTEUR.minutesParKm));
      corps += '<div class="suivante"><small>' + (premiere ? 'Première visite' : 'Visite suivante') + '</small><b>' + esc(suivante.heure) + ' · ' + pastilleType(suivante) + esc(suivante.nom) + '</b> ' + etoiles(suivante.note) +
        (lieuQuartier(suivante) ? '<span class="discret bloc-texte">' + esc(lieuQuartier(suivante)) + '</span>' : '') + tr +
        actionsRapides({ telephone: pa.telephone, lat: suivante.lat, lon: suivante.lon, lieu: suivante.lieu, quartier: suivante.quartier, commune: suivante.commune }) +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="ouvrirVisite" data-uid="' + suivante.uid + '">' + icone('crayon') + 'Compte Rendu de cette visite</button></div>';
    }
    var notifsOn = LS.get('notifs', false) && typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (finJournee && !crValide && !notifsOn) {
      corps += '<div class="rappel-cr-soir"><p>Rappel 18 h 30 : pensez à finaliser votre compte rendu de la journée.</p>' +
        '<div class="rangee-wa"><button class="bouton bouton-plein" type="button" data-a="ouvrirRapport">' + icone('valider') + 'Finaliser le compte rendu</button></div></div>';
    }
    return corps ? '<section class="maintenant"><h3>Maintenant</h3>' + corps + '</section>' : '';
  }

  // 3.23.0 : position suivie toutes les 2 minutes pendant que Journée montre aujourd'hui ;
  // une visite prévue plus tard, à moins de 500 m et dont le praticien est présent à cette heure, est proposée « maintenant »
  var RAYON_PROCHE_KM = 0.5, MARGE_PRESENCE_MIN = 10;   // 3.24.20 : 500 m, au moins 10 min de présence restantes
  function suivrePosition() {}   // 3.25.14 : remplacé par le recalcul global (localiser)
  // 3.26.54 : règle unique d'âge de la position du téléphone (10 min) pour toute l'application
  var AGE_GPS_MIN = 10;
  function gpsFrais() { var g = S.ui.posGps; return g && Date.now() - g.t < AGE_GPS_MIN * 60000 ? g : null; }
  function coordPrecise(a) {
    var c0 = lireCoord(a); if (c0) return c0;
    var cr = a.idPresence && ctx().parCode[a.code] ? ctx().parCode[a.code].filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0] : null;
    return cr && cr.coord ? cr.coord : null;
  }
  // pharmacie ouverte à moins de 500 m, hors de ma journée, non prévue par un collègue cette semaine, pas vue récemment
  var RAYON_PHARMACIE_KM = 0.5;
  function pharmacieProche(duJour) {
    var pos = gpsFrais(), t = aujourdhui(); if (!pos || jourSemaineIndex(t) > 4) return null;
    var now = minutesMaintenant(), refus = LS.get('refusPharmacies', {}), dans = ensemble(duJour.map(function (a) { return a.code; })), ex = exclusCollegues([t]), best = null;
    if (refus.d !== t) refus = { codes: {} };
    (ctx().parJour[jourSemaineIndex(t)] || []).forEach(function (c) {
      var p = c.prat;
      if (!p || p.type !== 'Pharmacie' || !c.coord || dans[c.code] || ex[c.code] || refus.codes[c.code] || absentLe(p, t)) return;
      if (now < c.debut || now > c.fin - 10) return;
      if (p.derniere && joursEcoules(p.derniere, t) < (+S.params.delai || 7)) return;
      var d = distanceVol(pos, c.coord);
      if (d <= RAYON_PHARMACIE_KM && (!best || d < best.d)) best = { c: c, d: d };
    });
    return best;
  }
  function visiteProche(sans, suivante) {
    var pos = gpsFrais(); if (!pos) return null;
    var now = minutesMaintenant(), refus = LS.get('refusProches', {}), best = null;
    sans.forEach(function (a) {
      if (a === suivante || (refus.d === aujourdhui() && refus.uids && refus.uids[a.uid])) return;
      var c = coordPrecise(a), deb = heureVersMinutes(a.debut), fin = heureVersMinutes(a.fin);
      if (!c || deb === null || fin === null || now < deb || now > fin - MARGE_PRESENCE_MIN) return;
      if (heureVersMinutes(a.heure) !== null && heureVersMinutes(a.heure) <= now + 15) return;   // déjà imminente
      var d = distanceVol(pos, c);
      if (d <= RAYON_PROCHE_KM && (!best || d < best.d)) best = { a: a, d: d };
    });
    return best;
  }
  // ------------------------------------------------------------------ Compte Rendu de la journée
  S.rapports = LS.get('rapports', {});
  function rapportDe(d) {
    var srv = ((S.data && S.data.rapports) || []).filter(function (r) { return String(r.date).slice(0, 10) === d && estMoi(r.delegue); })[0];
    // 3.27.24 : un compte rendu local vide (ouvert puis laissé) ne masque plus celui validé dans la base (autre téléphone, réinstallation)
    if (S.rapports[d]) {
      var L = S.rapports[d];
      if (!L.valideLe && srv && srv.valideLe && !L.edition) { L.valideLe = srv.valideLe; L.envoye = true; L.faits = L.faits || srv.faits || ''; L.concurrence = L.concurrence || srv.concurrence || ''; L.besoinsTexte = L.besoinsTexte || srv.besoins || ''; L.km = L.km || srv.km || ''; }
      return L;
    }
    if (srv) { S.rapports[d] = { faits: srv.faits || '', concurrence: srv.concurrence || '', besoins: [], besoinsTexte: srv.besoins || '', km: srv.km || '', valideLe: srv.valideLe || '', envoye: true, ok: { faits: 1, concurrence: 1, besoins: 1, km: 1 } }; return S.rapports[d]; }
    return null;
  }
  function rapportOuCree(d) { return rapportDe(d) || (S.rapports[d] = { faits: '', concurrence: '', besoins: [], besoinsTexte: '', km: '', ok: {} }); }
  function sauverRapports() { LS.set('rapports', S.rapports); }
  var BESOINS_JOUR = ['Supports promotionnels', 'Échantillons', 'Appui du responsable', 'Formation', 'Autre'];
  // synthèse automatique à partir des comptes rendus de visite de la journée
  function syntheseJour(duJour) {
    var s = { prevues: duJour.length, faites: [], nonFaites: [], sansCr: [], pot: { 3: 0, 2: 0, 1: 0 }, produits: {}, echantillons: [], commandes: [], ruptures: [], suites: [], km: 0, communes: [] };
    duJour.forEach(function (a) {
      if (a.commune && s.communes.indexOf(a.commune) < 0) s.communes.push(a.commune);
      if (!a.statut) { s.sansCr.push(a); return; }
      if (estKo(a.statut)) { s.nonFaites.push(a); return; }
      s.faites.push(a); s.pot[+a.note || 1] = (s.pot[+a.note || 1] || 0) + 1;
      var r = a.cr ? champsCr(a) : { produits: a.produits || '' };
      if (!estPharmacie(a)) listeProduits(r.produits || '').forEach(function (x) { s.produits[x] = (s.produits[x] || 0) + 1; });
      if (r.echantillons) s.echantillons.push(a.nom + ' : ' + r.echantillons);
      if (r.commande) s.commandes.push(a.nom + ' : ' + r.commande);
      var st = (a.cr && crDe(a).stocks) || {};
      Object.keys(st).forEach(function (x) { if (st[x] && st[x].etat === 'Rupture') s.ruptures.push(x + ' (' + a.nom + ')'); });
      if (a.prochaine && a.prochaine > a.date) s.suites.push(a.nom + ' : ' + (a.rdvConfirme ? 'RDV' : 'rappel') + ' le ' + dateFr(a.prochaine));
    });
    // 3.26.10 : la distance se calcule sur toutes les visites où le délégué s'est déplacé (faites ou absent/ko)
    var visitees = duJour.filter(function (a) { return !!a.statut; });
    if (visitees.length) {
      var ordVis = visitees.slice().sort(function (x, y) { return String(heureVisite(x)).localeCompare(String(heureVisite(y))); });
      var tot = 0, prec = departCoord();
      for (var iv = 0; iv < ordVis.length; iv++) {
        var cG = coordPrecise(ordVis[iv]);
        if (cG && prec && typeof distanceVol === 'function') {
          tot += distanceVol(prec, cG);
          prec = cG;
        } else {
          tot += (ordVis[iv].dist || 0);
        }
      }
      s.km = tot > 0 ? (Math.round(tot * 10) / 10) : ordVis.reduce(function (totK, a) { return totK + (a.dist || 0); }, 0);
    } else {
      s.km = duJour.reduce(function (totK, a) { return totK + (a.dist || 0); }, 0);
    }
    s.est = estimationJour(duJour);
    return s;
  }
  function lignesSynthese(s) {
    var prod = Object.keys(s.produits).sort(function (a, b) { return s.produits[b] - s.produits[a]; }).map(function (x) { return x + (s.produits[x] > 1 ? ' (' + s.produits[x] + ')' : ''); });
    var l = [['Visites', s.faites.length + ' faite' + (s.faites.length > 1 ? 's' : '') + ' sur ' + s.prevues + (s.sansCr.length ? ' · ' + s.sansCr.length + ' sans compte rendu' : '')]];
    if (s.faites.length) l.push(['Potentiel vu', [[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return s.pot[x[0]] + ' ' + x[1]; }).join(' · ')]);
    if (s.nonFaites.length) l.push(['Non faites', s.nonFaites.map(function (a) { return a.nom + ' (' + statutLibelle(a).toLowerCase() + ')'; }).join(', ')]);
    if (prod.length) l.push(['Produits présentés', prod.join(', ')]);
    if (s.echantillons.length) l.push(['Échantillons', s.echantillons.join(' ; ')]);
    if (s.commandes.length) l.push(['Commandes', s.commandes.join(' ; ')]);
    if (s.ruptures.length) l.push(['Ruptures', s.ruptures.join(', ')]);
    if (s.suites.length) l.push(['RDV et rappels', s.suites.join(' ; ')]);
    l.push(['Trajet', km(s.km) + (s.est ? ' (' + minutesVersHeure(s.est.debut) + '–' + minutesVersHeure(s.est.fin) + ')' : '') + (s.communes.length ? ' · ' + s.communes.join(', ') : '')]);
    return l;
  }
  function etapesRapport(R, s) {
    var resumeTxt = function (v, vide) { return String(v || '').trim() || vide; };
    return [
      { id: 'faits', titre: 'Faits marquants', resume: function () { return resumeTxt(R.faits, 'Rien à signaler'); },
        rendu: function () { return '<textarea data-f="rapport" data-k="faits" placeholder="Ex. le Dr X demande une étude sur Rozukaa ; nouvelle pharmacie ouverte à Angré">' + esc(R.faits || '') + '</textarea>'; } },
      { id: 'concurrence', titre: 'Concurrence observée', resume: function () { return resumeTxt(R.concurrence, 'Rien observé'); },
        rendu: function () { return '<textarea data-f="rapport" data-k="concurrence" placeholder="Produit, prix, action du concurrent…">' + esc(R.concurrence || '') + '</textarea>'; } },
      { id: 'besoins', titre: 'Besoins', resume: function () { var b = (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []); return b.length ? b.join(', ') : 'Aucun'; },
        rendu: function () {
          var tousB = (R.besoins || []).length === BESOINS_JOUR.length;
          return '<div class="grille-besoins-cr"><button type="button" class="puce puce-tous" data-a="rapBesoin" data-v="__tous" aria-pressed="' + tousB + '">Tous les besoins</button>' +
            BESOINS_JOUR.map(function (x) { return '<button type="button" class="puce" data-a="rapBesoin" data-v="' + esc(x) + '" aria-pressed="' + ((R.besoins || []).indexOf(x) >= 0) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
            '<textarea data-f="rapport" data-k="besoinsTexte" placeholder="Précisez si besoin" style="margin-top:8px;min-height:55px">' + esc(R.besoinsTexte || '') + '</textarea>';
        } }
    ];
  }
  function rendreRapportJour(d, duJour, lecture, page) {
    var R = lecture ? rapportDe(d) : rapportOuCree(d), s = syntheseJour(duJour.length ? duJour : []);
    var etat = R && R.valideLe ? '<span class="etiquette ok">Validé le ' + esc(R.valideLe) + '</span>' : (R && Object.keys(R.ok || {}).length ? '<span class="etiquette p1">En cours</span>' : '<span class="etiquette">À faire</span>');
    var h = '<section class="bloc rapport-jour" id="rapportJour"><div class="tete-bloc"><h3>' + (page ? 'Synthèse de la journée' : 'Compte Rendu') + '</h3>' + etat + '</div>';
    if (duJour.length) h += '<div class="tuiles-resume">' + lignesSynthese(s).map(function (x) {
      return '<div class="tuile statique' + (String(x[1]).length > 38 ? ' large' : '') + '"><small>' + esc(x[0]) + '</small><b>' + parLigne(x[1]) + '</b></div>';
    }).join('') + '</div>';
    // 3.24.16 : dans la page Compte Rendu, un bouton pour envoyer le CR de la journée au superviseur (numéro des Réglages)
    var waSup = page ? '<div class="rangee-wa"><button class="bouton wa" type="button" data-a="rapWhatsapp" data-v="' + d + '">' + icone('whatsapp') + (S.config.waResp ? 'Envoyer au superviseur' : 'Envoyer par WhatsApp') + '</button></div>' +
      (S.config.waResp ? '' : '<p class="discret" style="text-align:center;margin-top:-6px">Numéro du superviseur : Réglages (roue crantée).</p>') : '';
    if (!R) return h + '<p class="discret">Pas de compte rendu de journée enregistré.</p>' + waSup + '</section>';
    var etapes = etapesRapport(R, s), ok = R.ok || (R.ok = {}), edition = !lecture && (!R.valideLe || R.edition);
    var enCours = edition ? etapes.filter(function (e) { return !ok[e.id]; })[0] : null;
    h += '<div class="cr-pas etapes-filtres" style="margin-top:12px">';
    etapes.forEach(function (e, i) {
      if (!enCours || ok[e.id]) {
        h += edition ? '<button type="button" class="cr-fait" data-a="rapEditer" data-v="' + e.id + '"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b>' + icone('crayon') + '</button>'
          : '<div class="cr-fait"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b></div>';
        return;
      }
      if (e !== enCours) return;
      h += '<div class="cr-question"><span class="etape-titre">' + e.titre + ' <small>étape ' + (i + 1) + '/' + etapes.length + ', facultatif</small></span>' + e.rendu() +
        boutonsEtape(i > 0 ? 'rapPrec' : '', i > 0 ? etapes[i - 1].id : '', 'rapPasser', 'rapOk', e.id, i === etapes.length - 1) + '</div>';
    });
    h += '</div>';
    if (lecture) return h + waSup + '</section>';
    if (edition && !enCours) {
      if (s.sansCr.length) h += '<div class="bandeau"><p><b>' + s.sansCr.length + ' visite' + (s.sansCr.length > 1 ? 's' : '') + ' sans compte rendu :</b> ' +
        s.sansCr.map(function (a) { return '<button type="button" class="bouton-texte" data-a="ouvrirVisite" data-uid="' + a.uid + '">' + esc(a.nom) + '</button>'; }).join(', ') +
        '. Complétez-les, ou validez la journée telle quelle.</p></div>';
      h += '<button class="bouton bouton-plein bouton-large" type="button" data-a="rapValider" data-v="' + d + '">' + icone('valider') + 'Valider le compte rendu</button>';
    } else if (!edition) {
      h += '<div class="rangee-actions rangee-actions-cr-valide" style="margin-top:10px">' +
        '<button class="bouton bouton-plein" type="button" data-a="sortirRapport">' + icone('fermer') + '<span>Sortir</span></button>' +
        (page ? '' : '<button class="bouton petit wa" type="button" data-a="rapWhatsapp" data-v="' + d + '">' + icone('whatsapp') + 'Envoyer</button>') +
        '<button class="bouton petit" type="button" data-a="rapCopier" data-v="' + d + '">Copier</button>' +
        '<button class="bouton petit" type="button" data-a="rapModifier" data-v="' + d + '">' + icone('crayon') + 'Modifier</button></div>';
    }
    return h + (page ? '<div style="margin-top:12px">' + waSup + '</div>' : '') + '</section>';
  }
  function visitesDuJourRapport(d) { var l = S.plan.filter(function (a) { return a.date === d; }); return l.length ? l : arretsHorsJour(d); }
  // 3.25.4 : mise en forme WhatsApp (*gras*, _italique_, puces •, une ligne vide entre les sections)
  function sectionWa(titre, items, vide) {
    var l = (items || []).filter(function (x) { return String(x || '').trim(); });
    if (!l.length && vide === undefined) return [];
    return ['', '', '*' + titre.toUpperCase() + '*' + (l.length > 1 ? ' (' + l.length + ')' : '')].concat(l.length ? l.map(function (x) {
      return (x.indexOf('• ') === 0 ? x : '• ' + x);
    }) : ['_' + vide + '_']);
  }
  function heureVisite(a) { return (a.statut && a.valideA) || a.heure || ''; }
  // 3.26.70 : message WhatsApp aéré et lisible : pas d'heures ni de pastilles de position
  function texteRapport(d) {
    var R = rapportDe(d) || {}, duJour = visitesDuJourRapport(d), s = syntheseJour(duJour);
    var dateCourteCr = majuscule(JOURS_COURTS[jourSemaineIndex(d)]) + ' ' + d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
    var pot = [[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return s.pot[x[0]] + ' ' + x[1]; }).join(', ');
    var prod = Object.keys(s.produits).sort(function (a, b) { return s.produits[b] - s.produits[a]; }).map(function (x) { return x + (s.produits[x] > 1 ? ' (' + s.produits[x] + ')' : ''); });
    var faites = s.faites.slice().sort(function (a, b) { return String(heureVisite(a)).localeCompare(String(heureVisite(b))); });
    var l = ['*CR du ' + dateCourteCr + '*', moi() || 'Délégué', '',
      '*Bilan*',
      'Visites faites : *' + s.faites.length + ' / ' + s.prevues + '*' + (s.sansCr.length ? ' (' + s.sansCr.length + ' sans CR)' : '')];
    if (pot) l.push('Potentiel vu : ' + pot);
    var kmJ = R.km ? R.km + ' km' : (s.km ? km(s.km) + ' estimés' : '');
    if (kmJ) l.push('Trajet : ' + kmJ);
    if (s.communes.length) l.push('Communes : ' + s.communes.join(', '));
    var lignesFaites = faites.map(function (a) {
      var det = [estPharmacie(a) ? '' : abrSpec(a.specialite), abregerHopital(a.lieu || '')].filter(Boolean).join(', ');
      return '*' + a.nom + '*' + (det ? '\n   ' + det : '') + (a.produits ? '\n   Produits : ' + a.produits : '');
    });
    l = l.concat(sectionWa('Visites faites', lignesFaites));
    l = l.concat(sectionWa('Visites non faites', s.nonFaites.map(function (a) { return a.nom + ' : ' + String(statutLibelle(a) || '').toLowerCase(); })));
    l = l.concat(sectionWa('Produits présentés', prod));
    l = l.concat(sectionWa('Échantillons remis', s.echantillons));
    l = l.concat(sectionWa('Commandes', s.commandes));
    l = l.concat(sectionWa('Ruptures signalées', s.ruptures));
    l = l.concat(sectionWa('RDV et rappels', s.suites));
    l = l.concat(sectionWa('Faits marquants', String(R.faits || '').split(/\n+/), 'Rien à signaler'));
    l = l.concat(sectionWa('Concurrence', String(R.concurrence || '').split(/\n+/), 'Rien observé'));
    l = l.concat(sectionWa('Besoins', (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []), 'Aucun'));
    return l.join('\n');
  }
  function empreinteRapport(R) { return JSON.stringify([R.faits || '', R.concurrence || '', R.besoins || [], R.besoinsTexte || '', R.km || '']); }
  function envoyerRapport(d) {
    var R = rapportDe(d); if (!R || !R.valideLe || !connecte() || !moi()) return Promise.resolve();
    var s = syntheseJour(visitesDuJourRapport(d));
    var payload = { delegue: moi(), date: d, valideLe: R.valideLe, prevues: s.prevues, faites: s.faites.length,
      nonFaites: s.nonFaites.map(function (a) { return a.nom + ' (' + statutLibelle(a) + ')'; }).join(', '), sansCr: s.sansCr.length,
      synthese: lignesSynthese(s).map(function (x) { return x[0] + ' : ' + x[1]; }).join('\n'), faits: R.faits || '', concurrence: R.concurrence || '',
      besoins: (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []).join(', '), km: R.km || (Math.round(s.km * 10) / 10) };
    return apiPost('rapport', { rapport: payload }).then(function () { R.envoye = true; sauverRapports(); });
  }
  function envoyerRapportsEnAttente() {
    var l = Object.keys(S.rapports).filter(function (d) { return S.rapports[d].valideLe && !S.rapports[d].envoye; });
    return l.reduce(function (p, d) { return p.then(function () { return envoyerRapport(d).catch(function () {}); }); }, Promise.resolve());
  }

  // Planifier : réglages, proposition, ajustements, confirmation et partage, communes visitées
  // 3.20.0 : Planifier = l'agenda (frise chronologique de tous les jours planifiés, brouillon ou confirmés).
  // Le parcours de planification s'ouvre sur une page à part, dans le même onglet ; dès les résultats, il disparaît.
  // N'apparaît que ce qui sert sur le moment : « Confirmer » s'il y a des brouillons, « Accepter / Recalculer encore »
  // juste après un recalcul, « Envoyer par WhatsApp » une fois le jour confirmé.
  function barreCriteresPlanifier() {
    var p = S.params, dates = datesAffichees();
    var per;
    if (p.mode === 'jour') {
      per = datePlanLibelle(p.dateRef);
    } else {
      per = 'Sem. ' + datePlanLibelle(dates[0] || p.dateRef);
    }
    var com = p.mode === 'semaine' && p.parJour ? 'Par jour' : libelleCommunes(p.communes);
    var spec = p.typeCibles === 'pharmacies' ? 'Pharmacies' : (p.specialites && p.specialites.length ? (p.specialites.length === coeurDeCible().length && coeurDeCible().every(function (s) { return p.specialites.indexOf(s) >= 0; }) ? 'Cœur (' + p.specialites.length + ')' : p.specialites.length + ' spéc.') : 'Toutes spéc.');
    var rdvN = rdvProchaines(dates).length + S.imposes.length;
    return '<div class="barre-criteres-plan" role="group" aria-label="Critères de la tournée">' +
      '<div class="rangee-criteres rangee-criteres-1">' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="quand">' + icone('calendrier') + '<span>' + esc(per) + '</span></button>' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="ou">' + icone('carte') + '<span>' + esc(com) + '</span></button>' +
      '</div>' +
      '<div class="rangee-criteres rangee-criteres-2">' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="spec">' + icone('filtre') + '<span>' + esc(spec) + '</span></button>' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="rythme"><span>' + p.maxJour + '/j · ' + p.delai + 'j</span></button>' +
        '<button type="button" class="puce petite" data-a="ouvrirRecherche">' + icone('plus') + '<span>' + (rdvN ? rdvN + ' RDV/Prio' : 'RDV / Prio') + '</span></button>' +
      '</div>' +
    '</div>';
  }
  VUES.semaine = function () {
    if (!S.ui.voirParams) importerAgenda();
    if (S.ui.voirParams) {
      return '<div class="page-entree"><button type="button" class="retour" data-a="fermerParams">' + icone('chevron') + 'Planifier</button>' +
        '<h2 class="titre-vue">Planification</h2><p class="sous-titre">Une question à la fois ; touchez un critère pour l\'ajuster ou proposez directement votre tournée.</p>' + rendreParams() + '</div>';
    }
    var h = '<div class="tete-vue"><h2 class="titre-vue">Planifier</h2>' +
      '<button class="bouton petit bouton-plein" type="button" data-a="voirParams">' + icone('filtre') + 'Critères</button></div>' +
      '<p class="sous-titre">Préparez votre tournée selon vos priorités : ajustez vos critères par secteur et validez votre planning.</p>' +
      barreCriteresPlanifier();
    var datesF = datesPlanAvenir();
    if (!datesF.length) {
      return h + '<div class="vide"><strong>Aucun jour planifié</strong>Touchez « Proposer ma tournée » ou ajustez vos critères ci-dessus.</div>' +
        '<div class="rangee"><button class="bouton bouton-plein bouton-large" type="button" data-a="generer">' + icone('relancer') + 'Proposer ma tournée</button></div>' +
        '<button class="bouton bouton-large" type="button" data-a="voirParams" style="margin-top:8px">' + icone('filtre') + 'Choisir mes critères pas à pas</button>' +
        boutonAnciens('margin-top:10px');
    }
    var dates = datesF;
    // 3.25.0 : à l'ouverture (et après rafraîchissement), demain est sélectionné par défaut
    if (!S.ui.planInit) { S.ui.planInit = true; var j1 = prochainJourOuvre(ajouterJours(aujourdhui(), 1)); S.ui.jour = dates.filter(function (x) { return x >= j1; })[0] || dates[dates.length - 1]; }
    choisirJour(dates);
    var d = S.ui.jour, enAttente = S.ui.aAccepter === d;
    if (S.ui.annulReprise) {
      h += '<section class="bandeau-prog reprise"><div><b>Programme repris</b><span>' + esc(S.ui.annulReprise.libelle) +
        '. Conservez-le, ou revenez à l\'ancienne planification.</span></div><div class="rangee">' +
        '<button class="bouton bouton-plein" type="button" data-a="repriseConserver">' + icone('valider') + 'Conserver</button>' +
        '<button class="bouton" type="button" data-a="repriseAnnuler">Revenir à l\'ancienne</button></div></section>';
    } else if (!enAttente) h += rendreProgramme();
    h += frisePlanifier(datesPlan().filter(function (x) { return x < aujourdhui(); }).slice(-5).concat(dates), d);
    var duJour = S.plan.filter(function (a) { return a.date === d; });
    var n3 = duJour.filter(function (a) { return +a.note === 3; }).length;
    var nMatin = duJour.filter(function (a) { return a.creneau === 'Matin'; }).length;
    var nSoir = duJour.length - nMatin;
    var nPhar = duJour.filter(function (a) { return estPharmacie(a); }).length;
    var nMed = duJour.length - nPhar;
    // 3.26.68 : distance du parcours estimée d'une visite à la suivante (ordre des heures), coefficient routier inclus
    var totalKm = (function () { var l = duJour.slice().sort(function (x, y) { return String(x.heure || '').localeCompare(String(y.heure || '')); }), t = 0, prec = null;
      l.forEach(function (a) { var c = coordArret(a); if (c && prec) { var dk = distanceKm(prec, c); if (dk < 99) t += dk; } if (c) prec = c; }); return t; })();
    var comJour = Array.from(new Set(duJour.map(function (a) { return a.commune; }).filter(Boolean)));
    var etat = jourConfirme(d) ? '<span class="etiquette ok">Confirmé' + (S.jours[d] && S.jours[d].modifieLe ? ', modifié' : '') + '</span>' : '<span class="etiquette alerte">Brouillon</span>';
    var details = [
      nMatin + ' matin' + (nSoir ? ', ' + nSoir + ' soir' : ''),
      (function () { var cc = coeurDeCible(), nC = duJour.filter(function (a) { return !estPharmacie(a) && cc.indexOf(a.specialite) >= 0; }).length;
        return [nMed ? 'Cœur ' + nC + ' · Autres ' + (nMed - nC) : '', nPhar ? nPhar + ' phcie' + (nPhar > 1 ? 's' : '') : ''].filter(Boolean).join(' · '); })(),
      n3 ? n3 + ' ★★★' : '',
      totalKm ? km(totalKm) + ' estimés' : ''
    ].filter(Boolean).join(' · ');
    h += '<div class="tete-jour-plan"><div class="bilan-jour">' +
      '<div class="bj-ligne1"><b>' + majuscule(JOURS_COURTS[jourSemaineIndex(d)]) + ' ' + d.slice(8) + ' ' + MOIS_ABREGES[+d.slice(5, 7) - 1] + '.</b> · ' + duJour.length + ' visite' + (duJour.length > 1 ? 's' : '') +
      (comJour.length ? ' · <span class="bj-communes">' + esc(comJour.join(', ')) + '</span>' : '') + '</div>' +
      '<div class="discret details-plan">' + details + '</div></div>' +
      '<div class="tete-jour-droite">' + etat + '</div></div>';
    h += '<ul class="plan-jour">' + duJour.map(rendreLignePlan).join('') + '</ul>';
    var actionsPlan = '';
    if (enAttente) {
      actionsPlan = '<section class="bandeau-prog accepter"><div><b>Nouvelle sélection</b><span>Conserver ce tirage ?</span></div>' +
        '<div class="rangee"><button class="bouton" type="button" data-a="refuserProgramme" data-v="jour">Refuser</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="accepterJour">' + icone('valider') + 'Accepter</button></div></section>';
    } else if (!jourConfirme(d)) {
      // État B : Jour en brouillon -> Ajouter & Recalculer côte à côte, Accepter centré en bas
      actionsPlan = '<div class="rangee-tirage"><button class="bouton" type="button" data-a="ajouterTournee">' + icone('plus') + '<span>Ajouter</span></button>' +
        '<button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + '<span>Recalculer</span></button>' +
        '<button class="bouton bouton-plein bouton-accepter-plan" type="button" data-a="accepterJour">' + icone('valider') + '<span>Accepter</span></button></div>';
    } else {
      // État C : Jour déjà confirmé -> Ajouter & Recalculer côte à côte, WhatsApp centré en bas
      actionsPlan = '<div class="rangee-tirage"><button class="bouton" type="button" data-a="ajouterTournee">' + icone('plus') + '<span>Ajouter</span></button>' +
        '<button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + '<span>Recalculer</span></button>' +
        '<button class="bouton bouton-plein bouton-accepter-plan wa" type="button" data-a="partagerJourWhatsapp">' + icone('whatsapp') + '<span>WhatsApp</span></button></div>';
    }
    h += '<div class="barre-plan-actions-flottante">' + actionsPlan + '</div>';
    h += rendreCouverture(dates);
    h += boutonAnciens('margin-top:14px');
    return h;
  };
  // frise de l'agenda : tous les jours qui ont au moins une visite, dans l'ordre ; le jour choisi au centre
  function frisePlanifier(dates, d) {
    var t = aujourdhui();
    return '<div class="bande-jours frise-plan"><div class="bj-jours" role="group" aria-label="Jours planifiés">' + dates.map(function (x, i) {
      var n = S.plan.filter(function (a) { return a.date === x; }).length, ok = jourConfirme(x);
      var saut = i > 0 && joursEcoules(dates[i - 1], x) > 3;
      return '<button type="button" class="bj-jour' + (x === t ? ' aujourdhui' : '') + (x < t ? ' passe grise' : '') + (saut ? ' lundi' : '') + '"' + (x < t ? ' disabled aria-disabled="true" title="Jour passé"' : ' data-a="jour" data-v="' + x + '"') + ' aria-pressed="' + (x === d) + '"><small>' +
        JOURS_COURTS[jourSemaineIndex(x)].replace('.', '') + '</small><b>' + (+x.slice(8)) + '</b><em>' + MOIS_ABREGES[+x.slice(5, 7) - 1] + '</em>' +
        '<i class="etat-jour ' + (ok ? 'ok' : 'brouillon') + '">' + (ok ? '✓ ' : '• ') + n + '</i></button>';
    }).join('') + '</div>' +
      // 3.26.50 : même petit calendrier que dans Journée, pour choisir ou planifier une date
      '<button type="button" class="bj-cal" data-a="calOuvrir" data-ctx="plan" aria-label="Choisir une date à planifier">' + icone('calendrier') + '</button></div>';
  }

  // ------------------------------------------------------------------ Reprendre un ancien programme
  function boutonAnciens(style) {
    return '<button class="bouton bouton-large" type="button" data-a="ouvrirAnciens" style="' + style + '">' + icone('relancer') + 'Reprendre un ancien programme</button>';
  }
  // Sources : mes tournées publiées (feuille Plannings, 62 jours) et l'archive du téléphone, hors jours de la tournée en cours
  function anciensProgrammes() {
    var t0 = aujourdhui(), parDate = {}, enCours = ensemble(datesPlanAvenir());
    // 3.24.23 : jours passés de la tournée du téléphone (toujours mémorisés)
    S.plan.forEach(function (a) { if (a.date < t0) (parDate[a.date] = parDate[a.date] || []).push(a); });
    var arch = LS.get('archives', {}), srv = {};
    Object.keys(arch).forEach(function (d) { if (!enCours[d] && !parDate[d]) parDate[d] = arch[d]; });
    // la version publiée (feuille Plannings) complète les jours absents de l'archive du téléphone
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (p.delegue && estMoi(p.delegue) && !enCours[p.date] && !arch[p.date] && !parDate[p.date]) (srv[p.date] = srv[p.date] || []).push(p);
    });
    Object.keys(srv).forEach(function (d) { parDate[d] = srv[d]; });
    var semaines = {};
    Object.keys(parDate).forEach(function (d) {
      if (!parDate[d].length) return;
      var l = lundiDe(d); (semaines[l] = semaines[l] || {})[d] = parDate[d];
    });
    return Object.keys(semaines).sort().reverse().slice(0, 8).map(function (l) { return { lundi: l, jours: semaines[l] }; });
  }
  // Dates cibles : semaine (même jour de la semaine) ou journée choisie dans les réglages
  // Dates cibles : la semaine choisie (même jour de la semaine) ou le jour choisi
  function ciblesReprise(type, source, cible) {
    var m = {};
    if (type === 'semaine') {
      var jours = joursOuvres(lundiDe(cible));
      Object.keys(source).forEach(function (d) { m[d] = jours[jourSemaineIndex(d)]; });
    } else m[Object.keys(source)[0]] = cible;
    return m;
  }
  function cibleParDefaut(type, valeur) {
    var t = prochainJourOuvre(aujourdhui());
    var av = datesPlanAvenir();
    if (type === 'semaine') return lundiDe(av.length ? av[0] : (jourSemaineIndex(aujourdhui()) > 3 ? ajouterJours(aujourdhui(), 7) : aujourdhui()));
    // même jour de la semaine, à partir d'aujourd'hui
    return prochaineOccurrence(jourSemaineIndex(valeur), t, true);
  }
  function reprendreProgramme(type, valeur, cibleChoisie, force) {
    var semaine = anciensProgrammes().filter(function (x) { return x.lundi === (type === 'semaine' ? valeur : lundiDe(valeur)); })[0];
    if (!semaine) return;
    var source = {};
    if (type === 'semaine') source = semaine.jours; else source[valeur] = semaine.jours[valeur];
    var vers = ciblesReprise(type, source, cibleChoisie || cibleParDefaut(type, valeur)), c = ctx(), nouveaux = [], manques = [];
    Object.keys(source).forEach(function (d) {
      var cible = vers[d];
      if (!cible || cible < aujourdhui() || jourSemaineIndex(cible) > 4 || estFerie(cible)) { manques = manques.concat(source[d].map(function (x) { return x.nom; })); return; }
      var j = jourSemaineIndex(cible), vus = {};
      source[d].slice().sort(function (a, b) { return String(a.heure).localeCompare(String(b.heure)); }).forEach(function (x) {
        if (vus[x.code]) return; vus[x.code] = true;
        var pr = c.prat[x.code], crs = (c.parCode[x.code] || []).filter(function (cr) { return cr.jourIdx === j; });
        var cr = crs.filter(function (k) { return String(k.idPresence) === String(x.idPresence) && k.creneau === x.creneau; })[0] ||
                 crs.filter(function (k) { return String(k.idPresence) === String(x.idPresence); })[0] || crs[0];
        if (!pr || !cr || absentLe(pr, cible)) { manques.push(x.nom); return; }
        var a = Moteur.arretDepuisCreneau(cr, cible);
        a.garde = true; a.etat = 'repris';
        nouveaux.push(a);
      });
    });
    var cibles = ensemble(Object.keys(vers).map(function (k) { return vers[k]; }));
    var aRemplacer = S.plan.filter(function (a) { return cibles[a.date] && a.etat !== 'valide' && !a.corrige; });
    if (aRemplacer.some(function (a) { return a.statut; }) && !force) {
      confirmerPuis('Comptes rendus non enregistrés', 'Des comptes rendus non enregistrés sur ces jours seront perdus. Continuer ?', 'Continuer',
        function () { reprendreProgramme(type, valeur, cibleChoisie, true); });
      return;
    }
    // sauvegarde : « Revenir à l'ancienne planification » reste possible tant que la reprise n'est pas conservée
    S.ui.annulReprise = { plan: JSON.parse(JSON.stringify(S.plan)), jours: JSON.parse(JSON.stringify(S.jours)),
      libelle: (type === 'semaine' ? 'Semaine du ' + dateCourte(valeur) + ' reprise sur ' : 'Programme du ' + dateCourte(valeur) + ' repris sur ') +
        (type === 'semaine' ? 'la semaine du ' + dateCourte(lundiDe(vers[Object.keys(vers)[0]])) : 'le ' + dateCourte(vers[valeur])) };
    LS.set('annulReprise', S.ui.annulReprise);
    var gardes = S.plan.filter(function (a) { return !cibles[a.date] || a.etat === 'valide' || a.corrige; });
    var deja = {}; gardes.forEach(function (a) { deja[a.date + '|' + a.code] = true; });
    S.plan = gardes.concat(nouveaux.filter(function (a) { return !deja[a.date + '|' + a.code]; }));
    Object.keys(cibles).forEach(function (d) { if (S.plan.some(function (a) { return a.date === d; })) reordonner(d); });
    // les RDV confirmés tombant sur ces jours sont aussi placés
    rdvProchaines(Object.keys(cibles).sort()).forEach(function (im) {
      if (!S.plan.some(function (x) { return x.code === im.code && x.date >= im.apres; })) placerImpose(im);
    });
    mettreBrouillon(Object.keys(cibles).filter(function (d) { return S.plan.some(function (a) { return a.date === d; }); }));
    S.ui.jour = Object.keys(cibles).sort()[0]; S.ui.feuille = null; S.ui.voirParams = false; S.ui.tab = 'semaine';
    if (type === 'semaine') { S.params.mode = 'semaine'; S.params.dateRef = lundiDe(S.ui.jour); } else if (S.params.mode === 'jour') S.params.dateRef = S.ui.jour;
    sauver(); rendre(); publierPlan(true); window.scrollTo(0, 0);
    toast(nouveaux.length + ' visite' + (nouveaux.length > 1 ? 's' : '') + ' reprise' + (nouveaux.length > 1 ? 's' : '') + ' en brouillon' +
      (manques.length ? ' ; ' + manques.length + ' praticien' + (manques.length > 1 ? 's' : '') + ' absent' + (manques.length > 1 ? 's' : '') + ' ce jour-là (non repris)' : '') + '.', 5000);
  }

  // Médecin déjà prévu par un collègue la même semaine : question « Le remplacer ? » (Oui : un autre praticien ; Non : je le garde)
  function conflitArret(a) {
    if (a.etat === 'valide' || a.statut || a.conflitOk || S.config.demo) return null;
    var l = cibleParCollegues(a.code, a.date);
    return l.length ? l[0] : null;
  }
  function questionConflit(a, cf) {
    return '<div class="conflit"><p>Aussi prévu par <b>' + esc(cf.delegue) + '</b> le ' + dateFr(cf.date) + '. Le remplacer par un autre praticien ?</p>' +
      '<div class="rangee"><button class="bouton petit bouton-plein" type="button" data-a="conflitRemplacer" data-uid="' + a.uid + '">Remplacer</button>' +
      '<button class="bouton petit" type="button" data-a="conflitGarder" data-uid="' + a.uid + '">Non</button></div></div>';
  }
  // Candidats pour remplacer une visite : présents ce jour-là, hors tournée, non prévus par un collègue, selon les critères de la tournée ;
  // ceux du même établissement d'abord (+ bonus), ceux qui s'insèrent sans retard, puis par priorité et proximité du lieu remplacé
  function candidatsRemplacement(a) {
    var d = a.date, j = jourSemaineIndex(d), c = ctx(), filtre = filtreCibles(), ex = exclusCollegues([d]);
    Object.keys(refusesActuels().codes).forEach(function (cR) { ex[cR] = true; });   // 3.26.94 : retirés à la main : pas reproposés en remplacement
    var dansPlan = ensemble(S.plan.filter(function (x) { return x.date === d; }).map(function (x) { return x.code; }));
    var origine = coordArret(a), vus = {}, l = [];
    var lieuA = a.lieu || '';
    var cibleEstPh = estPharmacie(a);
    (c.parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      var pEstPh = estPharmacie(p);
      if (pEstPh !== cibleEstPh) return;   // Remplacement strict : médecins par médecins, pharmacies par pharmacies
      if (dansPlan[cr.code] || cr.code === a.code || ex[cr.code] || absentLe(p, d)) return;
      if (!cibleEstPh && filtre && !filtre(p)) return;
      if (d === aujourdhui() && cr.fin <= minutesMaintenant()) return;   // aujourd'hui : seulement ceux encore présents
      if (joursEcoules(p.derniere, d) < (+S.params.delai || 0)) return;
      var dist = origine && cr.coord ? distanceKm(origine, cr.coord) : 99;
      var memeLieu = memeEtablissement(lieuA, cr.lieu);
      var x = { cr: cr, dist: dist, score: Moteur.scoreDe(p, d) + (memeLieu ? 50 : 0), memeLieu: memeLieu };
      var existant = vus[cr.code];
      // 3.26.9 : priorité absolue au créneau du même établissement (CHU, même clinique) si le praticien y exerce aussi
      if (!existant || (x.memeLieu && !existant.memeLieu) || (!existant.memeLieu && x.dist < existant.dist) || (x.memeLieu && existant.memeLieu && x.dist < existant.dist)) {
        vus[cr.code] = x;
      }
    });
    Object.keys(vus).forEach(function (k) { l.push(vus[k]); });
    l.sort(function (x, y) {
      if (y.memeLieu !== x.memeLieu) return y.memeLieu ? 1 : -1;
      return (y.score - 20 * y.dist) - (x.score - 20 * x.dist);
    });
    var jour = S.plan.filter(function (x) { return x.date === d && x.uid !== a.uid; });
    return l.slice(0, 25).map(function (x) {
      var n = Moteur.arretDepuisCreneau(x.cr, d);
      var essai = Moteur.ordonnerJour(jour.map(function (y) { return Object.assign({}, y); }).concat([n]), departCoord());
      var place = essai.filter(function (y) { return y.uid === n.uid; })[0];
      x.heure = place ? place.heure : n.heure; x.ok = !essai.some(function (y) { return y.retard; });
      if (d === aujourdhui() && heureVersMinutes(x.heure) !== null && heureVersMinutes(x.heure) < minutesMaintenant()) x.heure = minutesVersHeure(Math.ceil(minutesMaintenant() / 5) * 5);   // aujourd'hui : au plus tôt maintenant
      return x;
    }).sort(function (x, y) {
      if (y.memeLieu !== x.memeLieu) return y.memeLieu ? 1 : -1;
      return (y.ok ? 1 : 0) - (x.ok ? 1 : 0);
    }).slice(0, 12);
  }
  function remplacerArret(uid) {
    var a = arret(uid); if (!a) return;
    S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: uid, choix: null, lieuRef: a.lieu };
    rendre();
  }
  function appliquerRemplacement(uid, cle, garder) {
    var a = arret(uid), cr = Moteur.creneauParCle(ctx(), cle); if (!a || !cr) return;
    if (!garder) { S.rejetes[a.code] = true; refuser(a.code); S.plan = S.plan.filter(function (x) { return x.uid !== uid; }); }
    var n = Moteur.arretDepuisCreneau(cr, a.date); n.etat = 'ajoute'; n.garde = true;
    S.plan.push(n); reordonner(a.date);
    if (S.ui.tab === 'semaine') mettreBrouillon([a.date]);
    S.ui.feuille = null; S.ui.ouvert = null; marquerModifie(); sauver(); rendre(); publierPlan();
    var placé = arret(n.uid);
    toast((garder ? n.nom + ' ajouté en remplacement de ' + a.nom : a.nom + ' remplacé par ' + n.nom) + (placé ? ' (' + placé.heure + ', ' + n.quartier + ')' : '') + '.', 5000);
  }
  // 3.26.94 : praticiens retirés à la main d'une liste proposée : ils ne reviennent plus dans les propositions (recalcul,
  // nouveau tirage, complément) tant que les critères de planification restent les mêmes ; un changement de critère les libère
  function signatureCriteres() {
    var p = S.params || {};
    return JSON.stringify([p.communes || [], p.parJour ? p.communesJour || {} : {}, (p.specialites || []).slice().sort(), (p.potentiels || []).slice().sort(), p.typeCibles || '', +p.delai || 0, +p.maxJour || 0, p.eviterCollegues !== false]);
  }
  function refusesActuels() {
    var r = LS.get('refuses', null), s = signatureCriteres();
    if (!r || r.crit !== s) { r = { crit: s, codes: {} }; LS.set('refuses', r); }
    return r;
  }
  function refuser(code) { var r = refusesActuels(); r.codes[code] = true; LS.set('refuses', r); }
  function retirerArret(uid) {
    var a = arret(uid); if (!a) return;
    S.plan = S.plan.filter(function (x) { return x.uid !== a.uid; });
    if (!S.plan.some(function (x) { return x.date === a.date; })) { var rt = LS.get('joursRetires', {}); rt[a.date] = true; LS.set('joursRetires', rt); }
    S.rejetes[a.code] = true; refuser(a.code);
    S.imposes = S.imposes.filter(function (im) { return im.code !== a.code; });
    reordonner(a.date);
    if (S.ui.tab === 'semaine' && S.plan.some(function (x) { return x.date === a.date; })) mettreBrouillon([a.date]);
    S.ui.ouvert = null; sauver(); rendre(); publierPlan();
    toast(a.nom + ' retiré de la tournée.');
  }
  // 3.26.31 : suppression d'une journée planifiée après confirmation (appui très long sur la date)
  function supprimerJourPlanifie(date) {
    var nb = S.plan.filter(function (x) { return x.date === date; }).length;
    S.plan = S.plan.filter(function (x) { return x.date !== date; });
    delete S.jours[date];
    var rt = LS.get('joursRetires', {});
    rt[date] = true;
    LS.set('joursRetires', rt);
    S.imposes = S.imposes.filter(function (im) { return im.date !== date; });
    var restantes = datesPlanAvenir();
    if (S.ui.jour === date) {
      S.ui.jour = restantes[0] || prochainJourOuvre(ajouterJours(aujourdhui(), 1));
      S.ui.jourVue = null;
    }
    S.ui.ouvert = null;
    marquerModifie();
    sauver();
    rendre();
    publierPlan(true);
    toast('Journée du ' + dateFr(date) + ' supprimée.');
  }
  // 3.26.51 : compte rendu effacé (appui très long) : la visite redevient à faire ; si déjà envoyé, la correction partira à la prochaine validation
  // 3.26.62 : suppression complète d'une visite de la journée (appui très long)
  function supprimerVisiteJour(a) {
    S.queue = S.queue.filter(function (v) { return v.uid !== a.uid; });
    S.plan = S.plan.filter(function (x) { return x.uid !== a.uid; }); S.horsPlan = (S.horsPlan || []).filter(function (x) { return x.uid !== a.uid; });
    // 3.26.64 : mémorisée comme supprimée : elle ne revient plus par le programme publié ni par l'historique
    var sup = LS.get('visitesSupprimees', {}); (sup[a.date] = sup[a.date] || {})[a.code] = true; LS.set('visitesSupprimees', sup);
    if (!S.plan.some(function (x) { return x.date === a.date; })) { var rt = LS.get('joursRetires', {}); rt[a.date] = true; LS.set('joursRetires', rt); }
    S.ui.ouvert = null; LS.set('horsPlan', S.horsPlan); S.ui.aPublier = true; LS.set('aPublier', true); sauver(); rendre(); publierPlan(); toast('Visite supprimée de la journée.');
  }
  function effacerCr(a) {
    delete a.cr; a.statut = ''; delete a.valideA; a.activite = ''; a.produits = ''; a.commentaire = ''; a.prochaine = ''; a.rdvConfirme = false;
    if (a.etat === 'valide') { a.etat = 'ajoute'; a.corrige = true; }
    S.queue = S.queue.filter(function (v) { return v.uid !== a.uid; });
    sauver(); rendre(); toast('Compte rendu effacé.');
  }
  function demanderSuppressionJour(date, nb) {
    nb = (nb !== undefined && nb !== null) ? nb : S.plan.filter(function (a) { return a.date === date; }).length;
    var dLong = majuscule(dateLongue(date));
    var nStr = nb > 0 ? (nb + ' visite' + (nb > 1 ? 's' : '')) : 'aucune visite';
    confirmerPuis(
      'Supprimer la journée',
      'Voulez-vous supprimer ' + (nb > 0 ? 'toutes les visites prévues le ' : 'la journée du ') + '<b>' + dLong + '</b> (' + nStr + ') ?<br><span class="discret">Cette journée sera retirée de votre planning.</span>',
      'Supprimer la journée',
      function () { supprimerJourPlanifie(date); }
    );
  }
  // Confirmation avant tout changement de la tournée
  // confirme les jours donnés (par défaut le jour affiché), puis propose l'envoi par WhatsApp (Oui / Non / Retour)
  function confirmerProgramme(dates, depuisChoix) {
    dates = dates && dates.length ? dates : [S.ui.jour];
    var avantJours = {};
    dates.forEach(function (d) { avantJours[d] = S.jours[d] ? JSON.parse(JSON.stringify(S.jours[d])) : { etat: 'proposition', valideLe: '', modifieLe: '' }; });
    var avantAAccepter = S.ui.aAccepter;
    confirmerJours(dates); S.ui.aAccepter = null; S.ui.avantTirage = null;
    S.ui.flashTexte = dates.length === 1 ? majuscule(dateLongue(dates[0])) + ' confirmé' : dates.length + ' jours confirmés';
    sauver(); publierPlan(true);
    S.ui.feuille = { type: 'valide', titre: 'Tournée confirmée ✓', dates: dates, avantJours: avantJours, avantAAccepter: avantAAccepter, depuisChoix: !!depuisChoix, retourAction: 'annulerConfirmation' };
    S.ui.flashValide = Date.now() + 4000; setTimeout(function () { S.ui.flashValide = 0; rendreSiPossible(); }, 4100);
    rendre();
  }
  // 3.19.0 : toute question se pose en trois boutons : Oui (appliquer), Non (refuser ; action propre à la question,
  // sinon retour à l'écran), Sortir (fermer sans rien changer et quitter le parcours en cours)
  function confirmerPuis(titre, message, libelleOui, action, siNon, ouiClasse) {
    S.ui.feuille = { type: 'confirmer', titre: titre, message: message, oui: libelleOui || 'Oui', action: action, non: siNon || null, ouiClasse: ouiClasse || null };
    rendre();
  }
  function piedQuestion(ouiAttrs, ouiLib, nonAction, ouiClasse) {
    return '<button class="bouton-texte sortir-question" type="button" data-a="sortirQuestion">Sortir</button>' +
      '<button class="bouton" type="button" data-a="' + (nonAction || 'fermerFeuille') + '">Non</button>' +
      '<button class="bouton ' + (ouiClasse || 'bouton-plein') + '" type="button" ' + ouiAttrs + '>' + ouiLib + '</button>';
  }

  // 3.26.43 : Abréviations conventionnelles et usuelles du secteur médical en Côte d'Ivoire
  // (CHU, CHR, HG, CSU, CSU COM, CMS, CM, GM, Poly., FSU COM, PISAM, SAMU, HMA, ICA).
  // Les noms propres de lieux ou quartiers (ex. Deux Plateaux) et l'identité des cliniques restent strictement intacts.
  function abregerHopital(nom) {
    if (!nom) return '';
    var s = String(nom).trim();

    // 1. Sigles majeurs conventionnels
    s = s.replace(/^Polyclinique\s+Internationale\s+Sainte\s+Anne[- ]Marie\b/i, 'PISAM');
    s = s.replace(/^Polyclinique\s+Sainte\s+Anne[- ]Marie\b/i, 'PISAM');
    s = s.replace(/^PISAM\s*\(.*?\)/i, 'PISAM');
    s = s.replace(/^H[ôo]pital\s+Militaire\s+d['’]Abidjan\s*\(HMA\)/i, 'HMA');
    s = s.replace(/^H[ôo]pital\s+Militaire\s+d['’]Abidjan\b/i, 'HMA');
    s = s.replace(/^Institut\s+de\s+Cardiologie\s+d['’]Abidjan\s*\(ICA\)/i, 'ICA');
    s = s.replace(/^Institut\s+de\s+Cardiologie\s+d['’]Abidjan\b/i, 'ICA');
    s = s.replace(/^Service\s+d['’]Aide\s+M[ée]dicale\s+Urgente\b/i, 'SAMU');

    // 2. Établissements publics & communautaires
    s = s.replace(/^Centre\s+Hospitalier\s+Universitaire\s+(?:de\s+|d['’])?/i, 'CHU ');
    s = s.replace(/^Centre\s+Hospitalier\s+R[ée]gional\s+(?:de\s+|d['’])?/i, 'CHR ');
    s = s.replace(/^H[ôo]pital\s+G[ée]n[ée]ral\s+(?:de\s+|d['’])?/i, 'HG ');
    s = s.replace(/^(?:Formation\s+Sanitaire\s+Urbaine\s+(?:[àa]\s+base\s+)?Communautaire|FSU[- ]COM)\s+(?:de\s+|d['’])?/i, 'FSU COM ');
    s = s.replace(/^(?:CSU\s+Communautaire|Centre\s+de\s+Sant[ée]\s+Urbain(?:\s+[àa]\s+base)?\s+Communautaire|CSU[- ]COM)\s*(?:de\s+|d['’])?/i, 'CSU COM ');
    s = s.replace(/\bCSU\s+Communautaire\b/gi, 'CSU COM');
    s = s.replace(/\bCSU-COM\b/gi, 'CSU COM');
    s = s.replace(/^Centre\s+de\s+Sant[ée]\s+Urbain\s+(?:de\s+|d['’])?/i, 'CSU ');

    // 3. Établissements privés, cliniques et centres
    s = s.replace(/^Centre\s+M[ée]dico[- ]Social\s+(?:de\s+|d['’])?/i, 'CMS ');
    s = s.replace(/^Centre\s+M[ée]dical\s+(?:de\s+|d['’])?/i, 'CM ');
    s = s.replace(/^Groupe\s+M[ée]dical\s+(?:de\s+|d['’]|du\s+)?/i, 'GM ');
    s = s.replace(/^Polyclinique\s+(?:des\s+|du\s+|de\s+la\s+|de\s+|d['’])?/i, 'Poly. ');
    s = s.replace(/^Clinique\s+M[ée]dicale\s+(?:de\s+|d['’])?/i, 'Clinique ');

    // 4. Voirie et voiries usuelles (Boulevard -> Blvd.)
    s = s.replace(/\bBoulevard\b/gi, 'Blvd.');

    // 5. Préservation et normalisation des quartiers (ex. "2 pltx" -> "Deux Plateaux")
    s = s.replace(/\b2\s*pltx\b/gi, 'Deux Plateaux');
    s = s.replace(/\b2\s*plateaux\b/gi, 'Deux Plateaux');

    return s.replace(/\s{2,}/g, ' ').trim();
  }

  // 3.27.22 : repères du lieu (colonne Repères de Presences), retrouvés par le n° de présence pour les visites déjà planifiées
  function reperesDe(a) {
    if (a.reperes) return a.reperes;
    var id = String(a.idPresence || ''), l = (S.data && S.data.presences) || [];
    var pr = id ? l.filter(function (x) { return String(x.id) === id; })[0] : null;
    if (!pr && a.code && a.lieu) pr = l.filter(function (x) { return x.code === a.code && normaliser(x.lieu) === normaliser(a.lieu); })[0];
    var r = pr && pr.reperes ? String(pr.reperes).trim() : '';
    // anciennes visites : repères déjà écrits dans le quartier, pas de redite
    return r && normaliser(a.quartier || '').indexOf(normaliser(r)) < 0 ? r : '';
  }
  // 3.25.36 : Médecin dans Planifier -> Spécialité, Hôpital où on le voit ce jour (abrégé), Secteur réel et distance
  function infosMedecinPlan(a) {
    var pObj = (typeof praticien === 'function' && praticien(a.code)) || {};
    var lieuBrut = a.lieu || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lieu) || '';
    var hopital = abregerHopital(lieuBrut);
    var qBrut = a.quartier || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].quartier) || '';
    var comBrut = a.commune || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].commune) || '';
    var coord = a.coord || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lat ? { lat: +pObj.lieux[0].lat, lon: +pObj.lieux[0].lon } : null);
    var secteur = nomSecteur(qBrut, comBrut, coord);
    var morceaux = [];
    if (a.specialite) morceaux.push(abrSpec(a.specialite));
    if (hopital) morceaux.push(hopital);
    if (secteur && (!hopital || hopital.toLowerCase().indexOf(secteur.toLowerCase()) < 0)) morceaux.push(secteur);
    var rep = reperesDe(a); if (rep) morceaux.push(rep);
    var pos = gpsFrais(), c = pos ? (coordPrecise(a) || coordArret(a) || coord) : null;
    if (c && pos) {
      var d = distanceVol(pos, c);
      morceaux.push(distMoi(d));
    }
    return morceaux.join(' · ');
  }

  // 3.26.35 : Pharmacie dans Planifier -> Localisation sans doublon + distance GPS en km (identique aux médecins)
  function infosPharmaciePlan(a) {
    var pObj = (typeof praticien === 'function' && praticien(a.code)) || {};
    var pCoord = (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lat) ? { lat: +pObj.lieux[0].lat, lon: +pObj.lieux[0].lon } : (pObj.lat && pObj.lon ? { lat: +pObj.lat, lon: +pObj.lon } : null);
    var pos = gpsFrais(), c = pos ? (coordPrecise(a) || coordArret(a) || a.coord || pCoord) : null;
    var base = infosSansDoublon(a, [a.lieu, a.quartier, reperesDe(a), a.commune]);
    if (c && pos) {
      var d = distanceVol(pos, c);
      return (base ? base + ' · ' : '') + distMoi(d);
    }
    return base;
  }

  // Ligne compacte de la tournée (Planifier) : garder, retirer, ouvrir la visite
  function rendreLignePlan(a) {
    var verrou = a.etat === 'valide', e = '';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? esc(libelleRdv(a)) : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(a)) + '</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici</span>';
    e += etiquetteCollegues(a.code, a.date);

    // Titre/Nom, Spécialité, Hôpital où on le voit ce jour et Secteur de l'hôpital
    // Pas de localisation précise (quartier précis, distance GPS) : réservée aux pharmacies qui ne bougent pas
    var sousTitre = estPharmacie(a)
      ? infosPharmaciePlan(a)
      : infosMedecinPlan(a);

    return '<li class="ligne-plan' + classeType(a) + (a.garde ? ' gardee' : '') + (verrou ? ' faite' : '') + '">' +
      '<div class="lp-gauche" data-a="voirVisite" data-uid="' + a.uid + '">' +
        '<span class="lp-pastille-col">' + pastilleType(a) + '</span>' +
        '<span class="lp-heure">' + esc(heureVisite(a)) + '</span>' +
      '</div>' +
      '<div class="lp-droite">' +
        '<button type="button" class="lp-corps lp-nom-btn" data-a="voirVisite" data-uid="' + a.uid + '">' +
          '<b>' + esc(a.nom) + '</b> ' + etoiles(a.note) +
        '</button>' +
        '<div class="lp-bas">' +
          '<button type="button" class="lp-details-btn" data-a="voirVisite" data-uid="' + a.uid + '">' +
            (sousTitre ? '<span class="discret bloc-texte">' + specGras(a, sousTitre) + '</span>' : '') +
            (e ? '<span class="etiquettes">' + e + '</span>' : '') +
          '</button>' +
          (verrou ? '<span class="lp-fait" title="Compte Rendu enregistré">' + icone('valider') + '</span>' :
            '<span class="lp-actions"><button type="button" class="lp-garder" data-a="garder" data-uid="' + a.uid + '" aria-pressed="' + !!a.garde + '" aria-label="' +
              (a.garde ? 'Ne plus garder' : 'Garder au prochain calcul') + '">' + icone('epingle') + '<small>' + (a.garde ? 'Gardé' : 'Garder') + '</small></button>' +
            '<button type="button" class="lp-retirer" data-a="retirer" data-uid="' + a.uid + '" aria-label="Retirer de la tournée">' + icone('fermer') + '</button></span>') +
        '</div>' +
      '</div>' +
      (conflitArret(a) ? questionConflit(a, conflitArret(a)) : '') +
      '</li>';
  }

  // Résumé de la planification : le titre (période), puis une tuile par option ; touchez une tuile pour la modifier
  function rendreResume() {
    var et = etapesParams(), quand = et.filter(function (e) { return e.id === 'quand'; })[0];
    return '<section class="bloc resume-plan"><div class="tete-bloc"><button type="button" class="titre-tuile" data-a="resumeEditer" data-v="quand"><h3>' + esc(quand.resume()) + '</h3>' + icone('crayon') + '</button>' +
      '<button class="bouton petit" data-a="voirParams" type="button">' + icone('calendrier') + 'Planifier</button></div>' +
      '<div class="tuiles-resume">' + et.filter(function (e) { return e.id !== 'quand'; }).map(function (e) {
        return '<button type="button" class="tuile" data-a="resumeEditer" data-v="' + e.id + '"><small>' + esc({ ou: 'Communes', qui: 'Praticiens', spec: 'Spécialités', valeur: 'Potentiel', rythme: 'Rythme', rdv: 'RDV et prioritaires' }[e.id] || e.titre) + '</small><b>' + esc(e.resume()) + '</b></button>';
      }).join('') + '</div></section>';
  }

  // Planification de la tournée posée une question à la fois, comme le compte rendu et la recherche :
  // Quand ? > Où ? > Qui ? > Quelle spécialité ? > Quel potentiel ? > Quel rythme ? > RDV et prioritaires ? puis « Proposer ma tournée ».
  S.ui.etapesP = LS.get('etapesParams', null) || { ok: {} };
  if (!LS.get('etapesParams', null) && S.plan.length) ['quand', 'ou', 'qui', 'spec', 'valeur', 'rythme', 'rdv'].forEach(function (k) { S.ui.etapesP.ok[k] = true; });
  function sauverEtapesP() { LS.set('etapesParams', S.ui.etapesP); }
  // 3.17.0 : ouvrir Planifier reprend toujours le parcours à l'étape 1 (réponses précédentes conservées)
  function etapesPDepuisDebut() { S.ui.etapesP = { ok: {} }; sauverEtapesP(); }
  function pucesSpecialitesCible(sel, actToggle, actToutes, actCoeur, actPlus) {
    var coeur = coeurDeCible(), s = sel || [];
    var estCoeur = s.length > 0 && s.length === coeur.length && coeur.every(function (x) { return s.indexOf(x) >= 0; });
    var liste = [], vus = {};
    // 3.25.27 : n'affiche sur la page que le cœur de cible (+ sélectionnées) ; les autres sont dans « Liste complète… »
    coeur.concat(s).forEach(function (nom) {
      if (nom && nom !== 'Pharmacien' && !vus[nom]) { vus[nom] = true; liste.push(nom); }
    });
    return '<div class="puces" style="margin:6px 0 8px">' +
      '<button type="button" class="puce puce-tous" data-a="' + actToutes + '" aria-pressed="' + (!s.length) + '">Toutes</button>' +
      '<button type="button" class="puce" data-a="' + actCoeur + '" aria-pressed="' + estCoeur + '">Cœur de cible (' + coeur.length + ')</button>' +
      '</div>' +
      '<div class="bloc-liste-complete">' +
        '<button type="button" class="bouton bouton-liste-complete" data-a="' + actPlus + '">' + icone('loupe') + 'Liste complète…</button>' +
      '</div>' +
      '<span class="sous-etape" style="margin:6px 0 4px">Spécialités du cœur de cible (pré-sélectionnées, touchez pour modifier)</span>' +
      '<div class="puces">' + liste.map(function (nom) {
        return '<button type="button" class="puce" data-a="' + actToggle + '" data-v="' + esc(nom) + '" aria-pressed="' + (s.indexOf(nom) >= 0) + '">' + esc(nom) + '</button>';
      }).join('') + '</div>';
  }
  function etapesParams() {
    var p = S.params, dates = datesAffichees();
    var demainIso = prochainJourOuvre(ajouterJours(aujourdhui(), 1));
    var l = [
      { id: 'quand', titre: 'Période', resume: function () {
          if (p.mode === 'jour') {
            if (p.dateRef === demainIso || p.dateRef === ajouterJours(aujourdhui(), 1)) return 'Demain';
            if (p.dateRef === aujourdhui()) return 'Aujourd\'hui';
            return 'Journée du ' + dateCourte(p.dateRef);
          }
          return dates.length && dates[0] !== lundiDe(dates[0]) ? 'Du ' + dateCourte(dates[0]) + ' au ' + dateCourte(dates[dates.length - 1]) : 'Semaine du ' + dateCourte(dates[0]);
        },
        rendu: function () {
          var t0 = prochainJourOuvre(aujourdhui()), j1 = prochainJourOuvre(ajouterJours(aujourdhui(), 1));
          var sem0 = lundiDe(t0), sem1 = ajouterJours(lundiDe(aujourdhui()), 7);
          return '<div class="segment" role="group" aria-label="Durée" style="margin-top:8px">' +
              '<button type="button" data-a="param" data-k="mode" data-v="jour" aria-pressed="' + (p.mode === 'jour') + '">Une journée</button>' +
              '<button type="button" data-a="param" data-k="mode" data-v="semaine" aria-pressed="' + (p.mode === 'semaine') + '">Une semaine</button></div>' +
            '<div class="grille-options-2" style="margin-bottom:8px">' +
              (p.mode === 'jour'
                ? '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="jour" data-d="' + t0 + '" aria-pressed="' + (p.dateRef === t0) + '">' + (t0 === aujourdhui() ? 'Aujourd\'hui' : 'Prochain jour ouvré') + '</button>' +
                  '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="jour" data-d="' + j1 + '" aria-pressed="' + (p.dateRef === j1) + '">Demain</button>'
                : '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="semaine" data-d="' + sem0 + '" aria-pressed="' + (lundiDe(p.dateRef) === sem0) + '">Cette semaine</button>' +
                  '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="semaine" data-d="' + sem1 + '" aria-pressed="' + (lundiDe(p.dateRef) === sem1) + '">Semaine prochaine</button>') +
            '</div>' +
            '<label class="champ" style="margin-bottom:0"><span>' + (p.mode === 'jour' ? 'Date' : 'Semaine du') + '</span>' +
              '<input type="date" data-f="param" data-k="dateRef" min="' + aujourdhui() + '" value="' + esc(p.dateRef) + '"></label>' +
              (p.mode === 'semaine' && lundiDe(p.dateRef) < aujourdhui() ? '<p class="discret" style="margin:6px 0 0">Semaine entamée : seuls les jours à venir seront planifiés.</p>' : '') + bandeauFeries(dates) + bandeauDejaPlanifie(datesPeriode());
        } },
      { id: 'ou', titre: 'Communes ciblées', resume: function () { return p.mode === 'semaine' && p.parJour ? 'Communes différentes selon le jour' : libelleCommunes(p.communes); },
        rendu: function () {
          var h = '<div class="champ" style="margin:8px 0 0"><span>Communes</span>' +
            '<button type="button" class="selecteur" data-a="choisirCommunes" data-v="tout"><span>' + esc(libelleCommunes(p.communes)) + '</span><b>▾</b></button></div>';
          if (p.mode === 'semaine') {
            h += '<label class="interrupteur"><span>Communes différentes selon le jour</span>' +
              '<input type="checkbox" data-f="param" data-k="parJour"' + (p.parJour ? ' checked' : '') + '></label>';
            if (p.parJour) {
              h += '<div class="secteurs">' + JOURS.map(function (j, i) {
                var c = p.communesJour[i];
                return '<div class="secteur"><span>' + j + '</span><button type="button" class="selecteur" data-a="choisirCommunes" data-v="' + i + '"><span>' +
                  esc(c && c.length ? libelleCommunes(c) : 'Comme ci-dessus') + '</span><b>▾</b></button></div>';
              }).join('') + '</div>';
            }
          }
          return h;
        } },
      { id: 'qui', titre: 'Praticiens à visiter', auto: true, resume: function () { return { tous: 'Médecins et pharmacies', medecins: 'Médecins', pharmacies: 'Pharmacies' }[p.typeCibles || 'tous']; },
        rendu: function () {
          return '<div class="grille-options-3" style="margin-top:8px">' + [['medecins', 'Médecins'], ['pharmacies', 'Pharmacies'], ['tous', 'Tous']].map(function (x) {
            return '<button type="button" class="puce" data-a="param" data-k="typeCibles" data-v="' + x[0] + '" data-auto="qui" aria-pressed="' + ((p.typeCibles || 'tous') === x[0]) + '">' + x[1] + '</button>';
          }).join('') + '</div>';
        } },
      { id: 'spec', titre: 'Spécialités', si: p.typeCibles !== 'pharmacies', facultatif: true, resume: function () { return libelleListe(p.specialites, 'Toutes'); },
        rendu: function () {
          return pucesSpecialitesCible(p.specialites, 'paramSpecToggle', 'paramSpecToutes', 'paramSpecDefaut', 'choisirSpecialites') +
            '<p class="discret" style="margin:6px 0 0">' + esc(libelleListe(p.specialites, 'Toutes les spécialités')) + (p.typeCibles === 'tous' ? ' (les pharmacies restent incluses)' : '') + '</p>';
        } },
      { id: 'valeur', titre: 'Potentiel', facultatif: true, resume: function () { return p.potentiels.length ? p.potentiels.map(function (x) { return ETOILES[x]; }).join(' · ') : 'Tous'; },
        rendu: function () {
          var tousP = !p.potentiels.length || p.potentiels.length === 3;
          return '<div class="grille-options-4" style="margin-top:8px">' +
            '<button type="button" class="puce puce-tous" data-a="paramPotentiel" data-v="tous" aria-pressed="' + tousP + '">Tous</button>' +
            ['A', 'B', 'C'].map(function (x) {
              return '<button type="button" class="puce" data-a="paramPotentiel" data-v="' + x + '" aria-pressed="' + (p.potentiels.indexOf(x) >= 0) + '">' + ETOILES[x] + '</button>';
            }).join('') + '</div>';
        } },
      { id: 'rythme', titre: 'Rythme de visite', resume: function () {
          return p.maxJour + '/jour · ' + p.delai + ' j mini' + (!S.config.demo && p.eviterCollegues !== false ? ' · hors collègues' : ''); },
        rendu: function () {
          return '<div class="grille-2 grille-rythme" style="margin-top:8px">' +
              '<div class="champ champ-rythme"><span>Visites par jour</span>' +
                '<div class="champ-compteur">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="maxJour" data-pas="-1" aria-label="Moins">−</button>' +
                  '<input type="number" min="1" max="20" inputmode="numeric" data-f="param" data-k="maxJour" value="' + p.maxJour + '">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="maxJour" data-pas="1" aria-label="Plus">+</button>' +
                '</div><small class="rythme-unite">visites / jour</small></div>' +
              '<div class="champ champ-rythme"><span>Ne pas revoir avant</span>' +
                '<div class="champ-compteur">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="delai" data-pas="-1" aria-label="Moins">−</button>' +
                  '<input type="number" min="0" max="365" inputmode="numeric" data-f="param" data-k="delai" value="' + p.delai + '">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="delai" data-pas="1" aria-label="Plus">+</button>' +
                '</div><small class="rythme-unite">jours minimum</small></div></div>' +
            (S.config.demo ? '' : '<label class="interrupteur" style="margin-bottom:0"><span>Éviter les médecins déjà prévus par un collègue</span>' +
              '<input type="checkbox" data-f="param" data-k="eviterCollegues"' + (p.eviterCollegues !== false ? ' checked' : '') + '></label>');
        } },
      { id: 'rdv', titre: 'RDV et prioritaires', resume: function () {
          var n = rdvProchaines(dates).length, m = S.imposes.length, r = [];
          if (n) r.push(n + ' RDV déjà pris'); if (m) r.push(m + ' prioritaire' + (m > 1 ? 's' : ''));
          return r.length ? r.join(' · ') : 'Aucun'; },
        rendu: function () {
          // RDV confirmés dans les comptes rendus (placés d'office automatiquement) + prioritaires ajoutés à la main
          var rdv = rdvProchaines(dates), h = '<p class="discret" style="margin:4px 0 8px">Placés d\'office : la tournée se construit autour d\'eux.</p>';
          h += '<span class="sous-etape">RDV déjà pris</span>';
          h += rdv.length ? '<ul class="liste-imposes">' + rdv.map(function (im) {
            var pr = praticien(im.code), passe = im.dateRdv < dates[0];
            return '<li class="li-retirable" data-retirer="rdv" data-v="' + esc(im.code + '|' + im.dateRdv) + '"><div><b>' + esc(pr ? pr.nom : im.code) + '</b> ' + (pr ? etoiles(pr.note) : '') +
              '<span class="discret bloc-texte">RDV du ' + dateFr(im.dateRdv).slice(0, -5) +
              (passe ? ', date passée : au plus tôt' : '') + (function () {
                // RDV un jour sans présence connue : placé à la prochaine présence connue, et on le dit
                var crs = ctx().parCode[im.code] || [], jour = jourSemaineIndex(im.dateRdv);
                if (passe || crs.some(function (cr) { return cr.jourIdx === jour; })) return '';
                var suiv = dates.filter(function (d) { return d >= im.dateRdv && !estFerie(d) && crs.some(function (cr) { return cr.jourIdx === jourSemaineIndex(d); }); })[0];
                return suiv ? ' reporté au ' + dateFr(suiv).slice(0, -5) + ' pour absence' : ', absent sur la période';
              })() + '</span></div><button type="button" class="bouton petit bouton-retirer-imp" data-a="retirerRdvDemande" data-v="' + esc(im.code + '|' + im.dateRdv) + '">' + icone('fermer') + 'Retirer</button></li>';
          }).join('') + '</ul>' : '<p class="discret" style="margin:4px 0 0">Aucun RDV pris sur cette période.</p>';
          h += '<div class="imposes-tete" style="margin-top:12px"><span class="sous-etape" style="margin:0">Prioritaires ajoutés</span></div>';
          h += S.imposes.length ? '<ul class="liste-imposes">' + S.imposes.map(function (im, i) {
            var pr = praticien(im.code);
            var c = im.cle ? Moteur.creneauParCle(ctx(), im.cle) : null;
            var quand = im.force && im.date === aujourdhui()
              ? 'Aujourd\'hui (' + dateCourte(im.date) + ') · visite inopinée'
              : (im.date ? dateFr(im.date) + (c ? ', ' + c.creneau.toLowerCase() + ', ' + esc(c.lieu) : '') : 'Au meilleur moment de la période');
            return '<li class="li-retirable" data-retirer="imp" data-v="' + i + '"><div><b>' + esc(pr ? pr.nom : im.code) + '</b> ' + (pr ? etoiles(pr.note) : '') +
              '<span class="discret bloc-texte">' + quand + (im.rdv ? ', RDV ' + esc(im.rdv) : '') + '</span></div>' +
              '<button type="button" class="bouton petit bouton-retirer-imp" data-a="retirerImposeDemande" data-i="' + i + '">' + icone('fermer') + 'Retirer</button></li>';
          }).join('') + '</ul>' : '<p class="discret" style="margin:4px 0 0">Aucun.</p>';
          // 3.26.77 : « Ajouter » en dernière ligne, sous les « Retirer », même taille, en vert
          h += '<div class="ligne-ajouter-imp"><button type="button" class="bouton petit bouton-retirer-imp bouton-ajouter-imp" data-a="ouvrirRecherche">' + icone('plus') + 'Ajouter</button></div>';
          return h;
        } }
    ];
    return l.filter(function (e) { return e.si !== false; });
  }
  // navigation d'une étape, commune à Planifier et à la Recherche : Précédent (sauf la 1re), Passer (si la question s'y prête),
  // Suivant (Terminer à la dernière)
  function boutonsEtape(aPrec, idPrec, aPasser, aOk, id, dernier) {
    return '<div class="rangee cr-boutons nav-etapes">' +
      (aPrec ? '<button class="bouton nav-prec" type="button" data-a="' + aPrec + '" data-v="' + idPrec + '">' + icone('chevron') + 'Précédent</button>' : '') +
      (aPasser ? '<button class="bouton" type="button" data-a="' + aPasser + '" data-v="' + id + '">Passer</button>' : '') +
      '<button class="bouton bouton-plein nav-suiv" type="button" data-a="' + aOk + '" data-v="' + id + '">' + (dernier ? 'Terminer' : 'Suivant' + icone('chevron')) + '</button></div>';
  }
  function rendreParams() {
    var ok = S.ui.etapesP.ok, etapes = etapesParams(), n = etapes.length;
    var enCours = etapes.filter(function (e) { return !ok[e.id]; })[0];
    var h = '<section class="bloc"><div class="cr-pas etapes-filtres">';
    etapes.forEach(function (e, i) {
      if (ok[e.id]) {
        h += '<button type="button" class="cr-fait" data-a="pEtapeEditer" data-v="' + e.id + '"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b>' + icone('crayon') + '</button>';
        return;
      }
      if (e !== enCours) return;
      h += '<div class="cr-question"><span class="etape-titre">' + e.titre + ' <small>étape ' + (i + 1) + '/' + n + (e.facultatif ? ', facultatif' : '') + '</small></span>' + e.rendu();
      h += boutonsEtape(i > 0 ? 'pEtapePrec' : '', i > 0 ? etapes[i - 1].id : '', e.facultatif ? 'pEtapePasser' : '', 'pEtapeOk', e.id, i === n - 1);
      h += '</div>';
    });
    h += '</div>';
    if (enCours) {
      h += '<div style="margin-top:10px;text-align:center"><button type="button" class="bouton-texte" data-a="generer">' + icone('relancer') + 'Proposer directement avec ces critères</button></div>';
      return h + '</section>';
    }
    // toutes les questions sont répondues : on peut proposer
    h += bandeauDejaPlanifie(datesPeriode()) + '<button class="bouton bouton-plein bouton-large" data-a="generer" type="button" style="margin-top:10px">' + icone('relancer') + 'Proposer ma tournée</button>' +
      '</section>';
    return h;
  }

  function rendreProgramme() {
    var h = '';
    // 3.19.0 : le bandeau vert ne s'affiche que quelques secondes après la confirmation
    // 3.25.22 : suppression du bandeau Brouillon en haut d'écran (gain de place mobile ; le badge et les boutons du bas suffisent)
    if (S.ui.flashValide && Date.now() < S.ui.flashValide) {
      h += '<section class="bandeau-prog valide flash"><div><b>Tournée confirmée</b><span>' + esc(S.ui.flashTexte || '') + '. Visible par l\'équipe.</span></div></section>';
    }
    return h;
  }

  // ------------------------------------------------------------------ Compte Rendu de visite (arbre de décision, 3.5.0)
  // Médecin : faite ? → types → produits présentés → réactions → échantillons → bilan → suite (rappel ou RDV confirmé + date)
  // Pharmacie : faite ? → interlocuteur → types → stocks → commande → compléments → suite
  // Non faite : motif → précision → remplaçant → suite. Seul un RDV confirmé place la visite dans la tournée.
  var REACTIONS = ['Intéressé', 'Indécis', 'Non intéressé', 'Non évalué', 'Demande d\'informations'];
  var ETATS_STOCK = ['Disponible', 'Stock faible', 'Rupture', 'Non vérifié'];
  var ANOMALIES = ['Proche péremption', 'Périmé'];
  var INTERLOCUTEURS = ['Pharmacien', 'Vendeurs', 'Chargé Commande', 'Autre'];
  var SUITES = {
    medecin: [['aucune', 'Aucune'], ['visite', 'Nouvelle visite'], ['appeler', 'Appeler'], ['informations', 'Envoyer infos']],
    pharmacie: [['aucune', 'Aucune'], ['visite', 'Nouvelle visite'], ['appeler', 'Appeler'], ['commande', 'Suivi'], ['informations', 'Informations']],
    nonFaite: [['aucune', 'Aucune'], ['reprogrammer', 'Reprogrammer'], ['appeler', 'Appeler']]
  };
  function activitesPharmacie() { return (S.data && S.data.activitesPharmacie && S.data.activitesPharmacie.length) ? S.data.activitesPharmacie : ACTIVITES_PHARMACIE_DEFAUT; }
  function statutFaite() { var l = statuts().filter(function (s) { return s.visite; }); return (l.filter(function (s) { return s.nom === 'Visite faite'; })[0] || l[0] || { nom: 'Visite faite' }).nom; }
  function motifsPour(a) {
    var base = estPharmacie(a) ? MOTIFS_PHARMACIE : MOTIFS_MEDECIN, connus = statuts().filter(function (s) { return !s.visite; }).map(function (s) { return s.nom; });
    var l = base.filter(function (m) { return !connus.length || connus.indexOf(m) >= 0; });
    return l.length ? l : base;
  }
  // compte rendu structuré de l'arrêt (reconstruit depuis les anciens champs si besoin)
  function crDe(a) {
    var ph = estPharmacie(a);
    if (!a.cr) {
      var c = { types: listeActivites(a.activite), produits: [], produitsStock: [], reactions: {}, echQ: {}, stocks: {}, cmdQ: {}, besoin: [], retourQ: {}, actionProduits: [], suite: 'aucune' };
      if (a.statut) { if (estKo(a.statut)) { c.faite = 'non'; c.motif = a.statut; c.precision = a.commentaire || ''; } else { c.faite = 'oui'; c.bilan = a.commentaire || ''; c.commentaire = a.commentaire || ''; } }
      if (!c.types.length && !a.statut) c.types = derniersTypesCr(ph).slice();
      var lp = listeProduits(a.produits), ref = produitsRef();
      c.produits = lp.filter(function (x) { return ref.indexOf(x) >= 0; }); c.autres = lp.filter(function (x) { return ref.indexOf(x) < 0; }).join(', ');
      if (c.produits.length || c.autres) c.presentes = 'oui';
      else if (!a.statut && !ph) c.produits = derniersProduitsCr().slice();
      if (ph && !a.statut) c.produitsStock = [];
      if (a.statut && a.prochaine) { c.suite = c.faite === 'non' ? 'reprogrammer' : 'visite'; c.suiteType = 'rdv'; c.date = a.prochaine; }
      else c.suite = 'aucune';
      a.cr = c;
    } else {
      if (!a.cr.suite && a.etat !== 'valide') a.cr.suite = 'aucune';
      if ((!a.cr.types || !a.cr.types.length) && !a.statut && !(a.cr.ok && a.cr.ok.types)) a.cr.types = derniersTypesCr(ph).slice();
      if (ph && !a.cr.produitsStock) a.cr.produitsStock = [];
    }
    return a.cr;
  }
  function implicite(a, c) {
    var t = c.types || [];
    return estPharmacie(a) ? { stocks: t.indexOf('Stocks') >= 0, commande: t.indexOf('Commande') >= 0 }
      : { presentes: (t.indexOf('Présentation') >= 0 || t.indexOf('Présentation produit') >= 0), echant: t.indexOf('Échantillons') >= 0 };
  }
  function produitsPresentes(c) { return (c.produits || []).concat(listeProduits(c.autres)); }
  function listeQ(o) { return Object.keys(o || {}).filter(function (p) { return +o[p] > 0; }).map(function (p) { return p + ' × ' + (+o[p]); }).join(' ; '); }
  // champs envoyés à l'historique (colonnes de la feuille Historique)
  function champsCr(a) {
    var c = crDe(a), ph = estPharmacie(a), im = implicite(a, c), r = { interlocuteur: '', reactions: '', echantillons: '', stocks: '', commande: '', complements: '', suite: '' };
    if (c.faite === 'oui') {
      r.statut = statutFaite(); r.activite = (c.types || []).join(' ; ');
      if (!ph) {
        var pres = c.presentes === 'oui' || im.presentes ? produitsPresentes(c) : [];
        r.produits = pres.join(', ');
        r.reactions = pres.filter(function (p) { return c.reactions[p]; }).map(function (p) { return p + ' : ' + c.reactions[p].toLowerCase(); }).join(' ; ');
        if (c.echant === 'oui' || im.echant) r.echantillons = listeQ(c.echQ);
        r.commentaire = c.bilan || '';
      } else {
        r.interlocuteur = c.interlocuteur || '';
        if (c.stocksVerif === 'oui' || im.stocks) {
          var prodsK = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : Object.keys(c.stocks || {});
          r.stocks = prodsK.filter(function (p) { return c.stocks[p] && c.stocks[p].etat; }).map(function (p) {
            var s = c.stocks[p]; return p + ' : ' + s.etat.toLowerCase() + (s.qte ? ' (' + s.qte + ')' : '') + (s.anomalie ? ', ' + s.anomalie.toLowerCase() + (s.lot ? ' lot ' + s.lot : '') : '');
          }).concat(c.autresStock ? ['Autres : ' + c.autresStock] : []).join(' ; ');
          r.produits = prodsK.filter(function (p) { return c.stocks[p] && (c.stocks[p].etat === 'Disponible' || c.stocks[p].etat === 'En stock' || c.stocks[p].etat === 'Stock faible'); }).join(', ');
          if (!r.produits && c.produitsStock && c.produitsStock.length) r.produits = c.produitsStock.join(', ');
        }
        var besoinL = (c.besoin || []).concat(c.besoinTexte ? [c.besoinTexte] : []);
        if (c.commande === 'oui' || im.commande) r.commande = listeQ(c.cmdQ) || (besoinL.length ? 'Oui, ' + besoinL.join(', ') : 'Oui');
        var t = c.types || [], comp = [];
        if (t.indexOf('Échantillons') >= 0 && listeQ(c.echQ)) { comp.push('Échantillons : ' + listeQ(c.echQ)); r.echantillons = listeQ(c.echQ); }
        if ((t.indexOf('Retour ou échange') >= 0 || t.indexOf('Retour') >= 0) && (listeQ(c.retourQ) || c.retourMotif)) comp.push('Retour : ' + listeQ(c.retourQ) + (c.retourMotif ? ' (' + c.retourMotif + ')' : ''));
        var act = t.filter(function (x) { return ['MEP', 'PLV', 'Formation', 'Animation'].indexOf(x) >= 0; });
        if (act.length && (c.action || (c.actionProduits || []).length)) comp.push(act.join(', ') + ' : ' + (c.action || '') + ((c.actionProduits || []).length ? ' (' + c.actionProduits.join(', ') + ')' : ''));
        r.complements = comp.join(' ; ');
        r.commentaire = c.commentaire || '';
      }
    } else if (c.faite === 'non') {
      r.statut = c.motif || ''; r.activite = ''; r.produits = ''; r.commentaire = c.precision || '';
    }
    var lib = (SUITES[c.faite === 'non' ? 'nonFaite' : (ph ? 'pharmacie' : 'medecin')].filter(function (x) { return x[0] === c.suite; })[0] || [])[1];
    if (c.suite && c.suite !== 'aucune' && c.suiteType && c.date) {
      r.suite = (c.suiteType === 'rdv' ? 'RDV confirmé : ' : 'Rappel : ') + (lib || '').toLowerCase();
      r.prochaine = c.date; r.rdv = c.suiteType === 'rdv';
    } else { r.prochaine = ''; r.rdv = false; }
    return r;
  }
  // garde les champs habituels de l'arrêt à jour (statut, activité, produits, commentaire, prochaine étape)
  function syncCr(a) {
    var r = champsCr(a);
    a.statut = r.statut || ''; a.activite = r.activite || ''; a.produits = r.produits || ''; a.commentaire = r.commentaire || '';
    a.prochaine = r.prochaine || ''; a.rdvConfirme = !!r.rdv;
    horodater(a);
  }
  // 3.25.9 : heure d'enregistrement de la visite (horodatage), affichée dans Journée à la place de l'heure planifiée
  function horodater(a) {
    if (!a.statut) { delete a.valideA; return; }
    if (!a.valideA && a.date === aujourdhui()) a.valideA = minutesVersHeure(minutesMaintenant());
  }
  function manquesCr(a) {
    var c = crDe(a), m = [];
    if (!c.faite) m.push('indiquez si la visite a été faite');
    else if (c.faite === 'non' && !c.motif) m.push('choisissez le motif');
    if (c.suite && c.suite !== 'aucune' && (!c.suiteType || !c.date)) m.push('précisez rappel ou RDV confirmé et la date');
    return m;
  }

  // petits éléments de formulaire
  function puceCr(a, cle, v, lib, actif, multi) {
    return '<button type="button" class="puce" data-a="' + (multi ? 'crMulti' : 'crChoix') + '" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + esc(v) +
      '" aria-pressed="' + !!actif + '">' + esc(lib || v) + '</button>';
  }
  // Composants du compte rendu, alignés sur Planifier : 2 choix = segment (comme « Une journée | Une semaine »),
  // jusqu'à 5 = puces, au-delà = sélecteur qui ouvre la liste (comme « Communes » ou « Spécialités »).
  S.ui.crOptions = {};
  function optionsNorm(options) { return options.map(function (o) { return Array.isArray(o) ? o : [o, o]; }); }
  function selecteurCr(a, cle, options, vals, multi, vide) {
    S.ui.crOptions[a.uid + '|' + cle] = optionsNorm(options);
    var libs = optionsNorm(options).filter(function (o) { return vals.indexOf(o[0]) >= 0; }).map(function (o) { return o[1]; });
    return '<div class="champ" style="margin:8px 0 0"><button type="button" class="selecteur" data-a="crListe" data-uid="' + a.uid + '" data-k="' + cle + '" data-m="' + (multi ? 1 : 0) + '">' +
      esc(libs.length ? libs.join(', ') : vide) + '<b>▾</b></button></div>';
  }
  function choixCr(a, cle, options, val, classePuces) {
    var o = optionsNorm(options);
    if (o.length === 2) return '<div class="segment" role="group" style="margin:8px 0 0">' + o.map(function (x) {
      return '<button type="button" data-a="crChoix" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + esc(x[0]) + '" aria-pressed="' + (val === x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    if (o.length > 5 && cle !== 'motif') return selecteurCr(a, cle, o, val ? [val] : [], false, 'Choisir…');
    return '<div class="puces' + (classePuces ? ' ' + classePuces : '') + '">' + o.map(function (x) { return puceCr(a, cle, x[0], x[1], val === x[0]); }).join('') + '</div>';
  }
  function multiCr(a, cle, options, vals) {
    if (options.length > 4) return selecteurCr(a, cle, options, vals || [], true, 'Choisir');
    var v = vals || [], tous = options.length > 1 && v.length === options.length;
    return '<div class="puces">' +
      (options.length > 1 ? '<button type="button" class="puce puce-tous" data-a="crMultiTous" data-uid="' + a.uid + '" data-k="' + cle + '" aria-pressed="' + tous + '">Tous</button>' : '') +
      options.map(function (o) { return puceCr(a, cle, o, o, v.indexOf(o) >= 0, true); }).join('') + '</div>';
  }
  // 3.25.27 : Parcours et types de visite strictement différenciés Médecin vs Pharmacie (sans mention croisée)
  // 3.27.17 : activités en pharmacie rangées pour tenir sur le moins de lignes (courtes ensemble, « Autre » en dernier)
  function ordrePastillesPh(l) {
    var pref = ['Routine', 'Stocks', 'MEP', 'Commande', 'Formation', 'Échantillons', 'Animation'];
    return l.slice().sort(function (x, y) { var a = pref.indexOf(x), b = pref.indexOf(y); if (x === 'Autre') return 1; if (y === 'Autre') return -1; return (a < 0 ? 99 : a) - (b < 0 ? 99 : b); });
  }
  function rendreChoixTypesCr(a, vals) {
    var ph = estPharmacie(a), sel = vals || [];
    var list = ph ? activitesPharmacie() : activites();
    S.ui.crOptions[a.uid + '|types'] = optionsNorm(list);
    var toutCoche = list.length > 0 && list.every(function (t) { return sel.indexOf(t) >= 0; });
    var h = '<div class="gammes-cr">';
    h += '<div class="gamme-cr-actions"><span class="discret">' + (sel.length ? sel.length + ' sélectionné' + (sel.length > 1 ? 's' : '') + ' : ' + esc(sel.join(', ')) : (ph ? 'Choisissez au moins une activité' : 'Choisissez au moins un type')) + '</span>' +
      '<span><button type="button" class="lien-action" data-a="crMultiTous" data-uid="' + a.uid + '" data-k="types">' + (toutCoche ? 'Tout décocher' : 'Tous') + '</button>' +
      (sel.length ? ' · <button type="button" class="lien-action" data-a="crTypesAucun" data-uid="' + a.uid + '">Effacer</button>' : '') + '</span></div>';
    h += '<div class="gamme-cr-bloc"><div class="gamme-cr-titre"><span><b>' + (ph ? 'Activités en pharmacie' : 'Types de visite médicale') + '</b></span></div>' +
      '<div class="puces puces-types-cr' + (ph ? ' puces-types-ph' : '') + '">' + (ph ? ordrePastillesPh(list.filter(function (t) { return !/^Retour/.test(t); })) : list).map(function (t) {
        var libT = (t === 'Présentation produit' || t === 'Présentation') ? 'Présentation'
                 : (t === 'Retour ou échange' || t === 'Retour') ? 'Retour'
                 : t;
        return puceCr(a, 'types', t, libT, sel.indexOf(t) >= 0, true);
      }).join('') + '</div></div>';
    h += '</div>';
    return h;
  }
  // 3.25.36 : Présentation 2x2 harmonieuse des produits par gamme selon la taille
  function libellePastilleCr(nomGamme, prod, totalFiches) {
    var nom = String(nomGamme || '').replace(/\s*\(.*\)$/, '').trim();
    var p = String(prod || '').trim();
    if (p === nom) return nom;
    if (p.indexOf(nom + ' ') === 0) {
      var court = p.slice(nom.length + 1);
      if (/^\d+$/.test(court)) court += ' mg';
      return court;
    }
    if (totalFiches === 1) return p;
    return p;
  }
  function taillePastille(court) {
    var len = (court || '').length;
    if (len <= 4) return 'court';
    if (len <= 7) return 'moyen';
    return 'long';
  }
  function rangDeclinaisonProduit(prod, nomGamme) {
    var p = normaliser(prod);
    if (p === 'zyltan' || p === 'zyltan 50' || p === 'zyltan 50 mg') return 0;
    if (p === 'zyltan am' || p === 'zyltan am 50') return 1;
    if (p === 'zyltan h' || p === 'zyltan h 50') return 2;
    if (p === 'losartan am') return 3;
    if (p === 'lesstrol 10' || p === 'lestrol 10' || p === 'lesstrol 10 mg') return 0;
    if (p === 'lesstrol' || p === 'lesstrol 20' || p === 'lestrol 20' || p === 'lesstrol 20 mg') return 1;
    if (p === 'lesstrol am' || p === 'lestrol am') return 2;
    if (p === 'lesstrol ez' || p === 'lestrol ez') return 3;
    if (p === 'tensicard' || p === 'tensicard 50' || p === 'tensicard 50 mg') return 0;
    if (p === 'tensicard am' || p === 'tensicard am 50') return 1;
    if (/eurithmic|eurythmic/.test(p)) return 0;
    return 10;
  }
  function harmoniserDeclinaisons(fiches, nomGamme) {
    if (!fiches || !fiches.length) return [];
    var nom = String(nomGamme || '').replace(/\s*\(.*\)$/, '').trim();
    return fiches.slice().sort(function (a, b) {
      var rA = rangDeclinaisonProduit(a.produit, nom);
      var rB = rangDeclinaisonProduit(b.produit, nom);
      if (rA !== rB) return rA - rB;
      var cA = libellePastilleCr(nom, a.produit, fiches.length);
      var cB = libellePastilleCr(nom, b.produit, fiches.length);
      return (cA.length - cB.length) || String(a.produit || '').localeCompare(String(b.produit || ''), 'fr');
    });
  }
  function harmoniserDeclinaisonsAncien(fiches, nomGamme) {
    if (!fiches || fiches.length <= 2) return fiches || [];
    var nom = String(nomGamme || '').replace(/\s*\(.*\)$/, '').trim();
    var items = fiches.map(function (f) {
      var c = libellePastilleCr(nom, f.produit, fiches.length);
      var estBase = (f.produit === nom);
      return { f: f, court: c, len: c.length, estBase: estBase };
    });
    // Pour 4 déclinaisons (ex: Zyltan : Zyltan, H, AM, Losartan AM)
    if (items.length === 4) {
      var baseIdx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].estBase) { baseIdx = i; break; }
      }
      if (baseIdx >= 0) {
        var baseItem = items.splice(baseIdx, 1)[0];
        items.sort(function (a, b) { return a.len - b.len; });
        return [baseItem.f, items[0].f, items[1].f, items[2].f];
      }
      items.sort(function (a, b) { return a.len - b.len; });
      return [items[0].f, items[1].f, items[2].f, items[3].f];
    }
    items.sort(function (a, b) {
      if (a.estBase !== b.estBase) return a.estBase ? -1 : 1;
      return a.len - b.len;
    });
    return items.map(function (x) { return x.f; });
  }

  function rendreChoixProduitsCr(a, cle, vals) {
    var inactifs = {};
    var lFiches = (S.data && S.data.fiches) || [];
    lFiches.forEach(function (f) {
      if (!estProduitActif(f)) inactifs[normaliser(f.produit)] = true;
    });

    var brut = (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT;
    brut = brut.filter(function (p) { return !inactifs[normaliser(p)]; });
    var autorises = {};
    brut.forEach(function (p) { autorises[normaliser(p)] = true; });

    var fichesToutes = (typeof fichesProduits === 'function' ? fichesProduits() : FICHES_PRODUITS_DEFAUT) || [];
    // 3.25.40 : Seuls les produits listés dans Listes!K sont affichés dans le CR visite
    var fiches = fichesToutes.filter(function (f) { return autorises[normaliser(f.produit)] && !inactifs[normaliser(f.produit)]; });
    if (!fiches.length) fiches = fichesToutes.filter(function (f) { return !inactifs[normaliser(f.produit)]; });
    var gammes = typeof gammesProduits === 'function' ? gammesProduits(fiches) : [];
    var sel = vals || [];

    // Séparation stricte Gamme A vs Gamme B
    var famsA = gammes.filter(function (g) { return estGammeA('', g.nom); }).sort(function (a, b) { return rangFamilleGammeA('', a.nom) - rangFamilleGammeA('', b.nom); });
    var famsB = gammes.filter(function (g) { return !estGammeA('', g.nom); });

    var prodsA = [], prodsB = [];
    famsA.forEach(function (g) { g.fiches.forEach(function (f) { prodsA.push(f.produit); }); });
    famsB.forEach(function (g) { g.fiches.forEach(function (f) { prodsB.push(f.produit); }); });

    var nbSelA = prodsA.filter(function (p) { return sel.indexOf(p) >= 0; }).length;
    var nbSelB = prodsB.filter(function (p) { return sel.indexOf(p) >= 0; }).length;

    // 3.25.37 : Gamme A toujours visible directement ; seule la Gamme B est repliée par défaut sur une seule ligne
    var bOuvert = !!S.ui.gammeBOuverte;
    var tousA = prodsA.length > 0 && prodsA.every(function (p) { return sel.indexOf(p) >= 0; });
    var tousB = prodsB.length > 0 && prodsB.every(function (p) { return sel.indexOf(p) >= 0; });

    var h = '<div class="choix-produits-cr">';
    h += '<div class="gamme-cr-actions" style="margin-bottom:8px">' +
      '<span class="discret">' + (sel.length ? '<b>' + sel.length + ' sélectionné' + (sel.length > 1 ? 's' : '') + '</b> : ' + esc(sel.join(', ')) : 'Touchez un produit pour le sélectionner') + '</span>' +
      (sel.length ? '<span><button type="button" class="lien-action" data-a="crProduitsAucun" data-uid="' + a.uid + '" data-k="' + cle + '">Tout effacer</button></span>' : '') +
      '</div>';

    // 1) Gamme A : directement affichée, entête compacte sans repli
    h += '<div class="gamme-cr-bloc ouverte" style="margin-bottom:6px">' +
      '<div class="gamme-cr-entete gamme-compacte">' +
        '<span><b>Gamme Aura 2</b>' + (nbSelA ? ' <i class="compteur">' + nbSelA + '</i>' : '') + '</span>' +
        (prodsA.length > 1 ? '<button type="button" class="lien-action" data-a="crGammeTous" data-uid="' + a.uid + '" data-k="' + cle + '" data-g="A">' + (tousA ? 'Tout décocher' : 'Tous') + '</button>' : '') +
      '</div>' +
      '<div class="liste-gammes-cr">';
    famsA.forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '').trim();
      var mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
      var fichesTriees = harmoniserDeclinaisons(g.fiches, nom);
      var seul = fichesTriees.length === 1;

      h += '<div class="ligne-gamme">' +
        '<div class="lg-tete">' +
          '<b>' + esc(nom) + '</b>' +
        '</div>' +
        '<div class="lg-produits' + (seul ? ' seul' : '') + '">' +
        fichesTriees.map(function (f) {
          var court = libellePastilleCr(nom, f.produit, g.fiches.length);
          var estSel = sel.indexOf(f.produit) >= 0;
          var tClass = taillePastille(court);
          return '<button type="button" class="pastille-produit ' + tClass + '" data-a="crMulti" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(f.produit) + '" aria-pressed="' + estSel + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
        }).join('') +
        '</div></div>';
    });
    h += '</div></div>';

    // 2) Gamme B : seule à être fermée par défaut, compacte sur la même ligne (gain d'espace)
    h += '<div class="gamme-cr-bloc' + (bOuvert ? ' ouverte' : ' repliee') + '" style="margin-bottom:8px">' +
      '<div class="gamme-cr-entete gamme-compacte">' +
        '<button type="button" class="gamme-cr-bascule" data-a="crGammeBascule" data-g="B" aria-expanded="' + bOuvert + '">' +
          '<span><b>Gamme Aura 1</b></span>' +
          '<span class="gamme-cr-meta">' + (nbSelB ? '<i class="compteur">' + nbSelB + '</i>' : '<small>' + famsB.length + ' fam.</small>') + icone('chevron') + '</span>' +
        '</button>' +
        (bOuvert && prodsB.length > 1 ? '<button type="button" class="lien-action" data-a="crGammeTous" data-uid="' + a.uid + '" data-k="' + cle + '" data-g="B">' + (tousB ? 'Décocher B' : 'Tous') + '</button>' : '') +
      '</div>';

    if (bOuvert) {
      h += '<div class="liste-gammes-cr">';
      famsB.forEach(function (g) {
        var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '').trim();
        var mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
        var fichesTriees = harmoniserDeclinaisons(g.fiches, nom);
        var seul = fichesTriees.length === 1;

        h += '<div class="ligne-gamme">' +
          '<div class="lg-tete">' +
            '<b>' + esc(nom) + '</b>' +
          '</div>' +
          '<div class="lg-produits' + (seul ? ' seul' : '') + '">' +
          fichesTriees.map(function (f) {
            var court = libellePastilleCr(nom, f.produit, g.fiches.length);
            var estSel = sel.indexOf(f.produit) >= 0;
            var tClass = taillePastille(court);
            return '<button type="button" class="pastille-produit ' + tClass + '" data-a="crMulti" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(f.produit) + '" aria-pressed="' + estSel + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
          }).join('') +
          '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';

    h += '</div>';
    return h;
  }
  function ouiNonCr(a, cle, val) { return choixCr(a, cle, [['oui', 'Oui'], ['non', 'Non']], val); }
  function ouiNonCrAncien(a, cle, val) { return '<div class="statuts deux">' + [['oui', 'Oui'], ['non', 'Non']].map(function (o) {
    return '<button type="button" class="statut' + (o[0] === 'non' ? ' ko' : '') + '" data-a="crChoix" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + o[0] + '" aria-pressed="' + (val === o[0]) + '">' + o[1] + '</button>';
  }).join('') + '</div>'; }
  function texteCr(a, cle, val, ph, zone) {
    return zone ? '<textarea data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" placeholder="' + esc(ph) + '">' + esc(val || '') + '</textarea>'
      : '<input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" value="' + esc(val || '') + '" placeholder="' + esc(ph) + '">';
  }
  function qteCr(a, cle, val) { return '<input type="number" min="0" inputmode="numeric" class="qte" data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" value="' + esc(val || '') + '" placeholder="0" aria-label="Quantité">'; }
  // choix unique en puces (remplace les listes déroulantes du compte rendu) : touchez de nouveau pour annuler
  function pucesValCr(a, cle, options, val, libs, classe) {
    return '<div class="puces' + (classe ? ' ' + classe : '') + '">' + options.map(function (o) {
      return '<button type="button" class="puce" data-a="crVal" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(o) + '" aria-pressed="' + ((val || '') === o) + '">' + esc((libs && libs[o]) || o) + '</button>';
    }).join('') + '</div>';
  }
  function selectCr(a, cle, options, val, vide) {
    return '<select data-f="crSelect" data-uid="' + a.uid + '" data-k="' + cle + '">' + (vide !== undefined ? '<option value="">' + esc(vide) + '</option>' : '') +
      options.map(function (o) { return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
  }
  function etapeCr(titre, contenu, aide) { return '<div class="champ etape-cr-bloc"><span>' + titre + '</span>' + contenu + (aide ? '<span class="aide-champ">' + aide + '</span>' : '') + '</div>'; }
  function tableQ(a, prefixe, produits, valeurs) {
    return '<div class="grille-2 champs-cr">' + produits.map(function (p) {
      return '<label class="champ"><span>' + esc(p) + '</span>' + qteCr(a, prefixe + '.' + p, (valeurs || {})[p]) + '</label>';
    }).join('') + '</div>';
  }

  // ------------------------------------------------------------------ Compte Rendu pas à pas (3.6.0)
  // Une question à la fois : la suivante apparaît selon la réponse. Les réponses données restent en lignes courtes
  // (touchez pour modifier : les questions suivantes sont reposées). Étapes facultatives : Continuer ou Passer.
  function etapesCr(a) {
    var c = crDe(a), ph = estPharmacie(a), im = implicite(a, c), cat = produitsRef(), l = [];
    function e(id, titre, type, rendu, resume, ok) { l.push({ id: id, titre: titre, type: type, rendu: rendu, resume: resume, valide: ok }); }
    var oui = function (v) { return v === 'oui' ? 'Oui' : (v === 'non' ? 'Non' : ''); };
    e('faite', 'La visite a-t-elle été faite ?', 'auto', function () { return ouiNonCr(a, 'faite', c.faite || 'oui'); }, function () { return oui(c.faite); });
    if (!c.faite) return l;
    if (c.faite === 'non') {
      e('motif', 'Motif', 'auto', function () { return choixCr(a, 'motif', motifsPour(a), c.motif); }, function () { return c.motif; });
      e('precision', 'Précision', 'facultatif', function () { return texteCr(a, 'precision', c.precision, ph ? 'Ex. pharmacien en congé' : 'Ex. en bloc opératoire', true); },
        function () { return c.precision || 'aucune'; });
      e('remplacant', 'Remplacer à proximité ?', 'auto', function () {
        return '<div class="segment" role="group" style="margin:8px 0 0">' +
          '<button type="button" data-a="crActionRemplacer" data-uid="' + a.uid + '">' + icone('carte') + ' Remplacer</button>' +
          '<button type="button" data-a="crChoix" data-uid="' + a.uid + '" data-k="remplacant" data-v="non" aria-pressed="' + (c.remplacant === 'non') + '">Non</button>' +
          '</div>';
      }, function () { return c.remplacant === 'oui' ? 'Remplacer' : (c.remplacant === 'non' ? 'Non' : ''); });
      if (c.remplacant === 'oui') { l.push({ id: '__remplacer', fin: 'remplacer' }); return l; }
      etapesSuite(a, c, SUITES.nonFaite, e);
      return l;
    }
    if (!ph) {
      e('types', 'Type(s) de visite médicale', 'continuer', function () { return rendreChoixTypesCr(a, c.types); }, function () { return (c.types || []).join(', '); },
        function () { return (c.types || []).length ? '' : 'choisissez au moins un type de visite médicale'; });
      if (!im.presentes) e('presentes', 'Produits présentés ?', 'auto', function () { return choixCr(a, 'presentes', [['oui', 'Oui'], ['non', 'Non']], c.presentes || 'oui'); }, function () { return oui(c.presentes); });
      if (c.presentes === 'oui' || im.presentes) {
        e('produits', 'Produits présentés', 'continuer', function () {
          return rendreChoixProduitsCr(a, 'produits', c.produits);
        }, function () { return produitsPresentes(c).join(', '); }, function () { return produitsPresentes(c).length ? '' : 'choisissez au moins un produit'; });
        e('reactions', 'Réaction du médecin', 'continuer', function () {
          // 3.26.88 : réaction par défaut : la dernière donnée pour ce produit, sinon « Intéressé »
          var memR = LS.get('dernieresReactionsCr', {}); c.reactions = c.reactions || {};
          produitsPresentes(c).forEach(function (p) { if (!c.reactions[p]) c.reactions[p] = memR[p] || 'Intéressé'; });
          return '<div class="champs-cr">' + produitsPresentes(c).map(function (p) {
            return '<div class="champ champ-reaction-produit"><div class="etiquette-med-cr"><b>' + esc(p) + '</b></div><div class="grille-reactions-cr">' + pucesValCr(a, 'reactions.' + p, REACTIONS, c.reactions[p]) + '</div></div>';
          }).join('') + '</div>';
        }, function () { var r = produitsPresentes(c).filter(function (p) { return c.reactions[p]; }); return r.length ? r.map(function (p) { return p + ' : ' + c.reactions[p].toLowerCase(); }).join(', ') : 'non renseignée'; });
      }
      if (!im.echant && !c.echant) c.echant = 'non';   // 3.27.23 : Non par défaut
      if (!im.echant) e('echant', 'Échantillons remis ?', 'auto', function () { return choixCr(a, 'echant', [['oui', 'Oui'], ['non', 'Non']], c.echant || 'non'); }, function () { return oui(c.echant); });
      if (c.echant === 'oui' || im.echant) e('echQ', 'Échantillons remis (quantités)', 'continuer', function () { return tableQ(a, 'echQ', produitsPresentes(c), c.echQ); }, function () { return listeQ(c.echQ) || 'aucune quantité'; });
      e('bilan', 'Bilan', 'facultatif', function () { return texteCr(a, 'bilan', c.bilan, 'Besoins, objections, engagements, autres activités…', true); }, function () { return c.bilan || 'aucun'; });
      etapesSuite(a, c, SUITES.medecin, e);
      return l;
    }
    e('interlocuteur', 'Interlocuteur', 'auto', function () { return choixCr(a, 'interlocuteur', INTERLOCUTEURS, c.interlocuteur); }, function () { return c.interlocuteur; });
    e('types', 'Activité(s) en pharmacie', 'continuer', function () { return rendreChoixTypesCr(a, c.types); }, function () { return (c.types || []).join(', '); },
      function () { return (c.types || []).length ? '' : 'choisissez au moins une activité en pharmacie'; });
    if (!im.stocks) e('stocksVerif', 'Stocks vérifiés ?', 'auto', function () { return choixCr(a, 'stocksVerif', [['oui', 'Oui'], ['non', 'Non']], c.stocksVerif); }, function () { return oui(c.stocksVerif); });
    if (c.stocksVerif === 'oui' || im.stocks) {
      e('produitsStock', 'Produits vérifiés en stock', 'continuer', function () {
        return rendreChoixProduitsCr(a, 'produitsStock', c.produitsStock || []);
      }, function () {
        var prods = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : [];
        return prods.join(', ') || 'aucun';
      }, function () {
        var prods = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : [];
        return prods.length ? '' : 'sélectionnez au moins un produit à vérifier';
      });
      e('stocks', 'Stock par produit', 'continuer', function () {
        var prods = (c.produitsStock && Array.isArray(c.produitsStock)) ? c.produitsStock.slice() : [];
        if (c.stocks) {
          Object.keys(c.stocks).forEach(function (k) {
            if (prods.indexOf(k) < 0) delete c.stocks[k];
          });
        }
        if (!prods.length) return '<p class="discret">Aucun produit sélectionné à l\'étape 4.</p>';
        return '<div class="champs-cr">' + prods.map(function (p) {
          var s = c.stocks[p] || (c.stocks[p] = { etat: 'Disponible' });
          return '<div class="ligne-stock"><b>' + esc(p) + '</b><div class="champ"><span>État</span>' + pucesValCr(a, 'stocks.' + p + '.etat', ETATS_STOCK, s.etat, null, 'puces-etats-stock') + '</div>' +
            (s.etat === 'Disponible' || s.etat === 'En stock' || s.etat === 'Stock faible' ? '<div class="champ"><span>Anomalie</span>' + pucesValCr(a, 'stocks.' + p + '.anomalie', ['', 'Périmé', 'Proche péremption'], s.anomalie || '', { '': 'Aucune' }) + '</div>' +
              (s.anomalie ? '<label class="champ"><span>N° de lot</span><input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="stocks.' + p + '.lot" value="' + esc(s.lot || '') + '" placeholder="N° de lot"></label>' : '') : '') + '</div>';
        }).join('') + '</div>';
      }, function () { var r = champsCr(a).stocks; return r || 'aucun produit renseigné'; });
    }
    // 3.27.15 : « Non » par défaut ; « Oui » ouvre le choix des produits (facultatif)
    if (!im.commande && !c.commande) c.commande = 'non';
    if (!im.commande) e('commande', 'Commande passée ?', 'auto', function () { return choixCr(a, 'commande', [['oui', 'Oui'], ['non', 'Non']], c.commande); }, function () { return oui(c.commande); });
    if (c.commande === 'oui' || im.commande) e('besoin', 'Besoin de réapprovisionnement', 'facultatif', function () { return rendreChoixProduitsCr(a, 'besoin', c.besoin) + texteCr(a, 'besoinTexte', c.besoinTexte, 'Autres besoins'); },
      function () { var b = (c.besoin || []).concat(c.besoinTexte ? [c.besoinTexte] : []); return b.length ? b.join(', ') : 'aucun'; });
    var t = c.types || [];
    // 3.26.51 : seuls les produits cochés plus tôt (vérifiés en stock) sont proposés ensuite, sinon tout le catalogue
    var catCoches = (c.produitsStock && c.produitsStock.length) ? c.produitsStock.slice() : cat;
    if (t.indexOf('Échantillons') >= 0) e('echQ', 'Échantillons (quantités)', 'continuer', function () { return tableQ(a, 'echQ', catCoches, c.echQ); }, function () { return listeQ(c.echQ) || 'aucune quantité'; });
    if (t.indexOf('Retour') >= 0 || t.indexOf('Retour ou échange') >= 0) e('retour', 'Retour', 'continuer', function () { return tableQ(a, 'retourQ', catCoches, c.retourQ) + texteCr(a, 'retourMotif', c.retourMotif, 'Motif du retour'); },
      function () { return (listeQ(c.retourQ) || 'aucune quantité') + (c.retourMotif ? ' (' + c.retourMotif + ')' : ''); });
    var act = t.filter(function (x) { return ['MEP', 'PLV', 'Formation', 'Animation'].indexOf(x) >= 0; });
    if (act.length) e('action', act.join(', ') + ' : action et produits', 'continuer', function () { return texteCr(a, 'action', c.action, 'Ex. présentoir installé, équipe formée sur Rozukaa') + rendreChoixProduitsCr(a, 'actionProduits', c.actionProduits); },
      function () { return [c.action].concat(c.actionProduits || []).filter(Boolean).join(', ') || 'non précisé'; });
    e('commentaire', 'Commentaire', 'facultatif', function () { return texteCr(a, 'commentaire', c.commentaire, 'Demande du pharmacien, concurrence, prix…', true); }, function () { return c.commentaire || 'aucun'; });
    etapesSuite(a, c, SUITES.pharmacie, e);
    return l;
  }
  function etapesSuite(a, c, options, e) {
    var valSuite = c.suite || 'aucune';
    var lib = function (v) { return ((options.filter(function (o) { return o[0] === v; })[0]) || [])[1] || 'Aucune'; };
    e('suite', 'Étape suivante', 'auto', function () {
      return choixCr(a, 'suite', options, valSuite, 'puces-suite-cr') +
        (valSuite === 'aucune' ? '<div class="rangee cr-boutons" style="margin-top:10px"><button class="bouton bouton-plein" type="button" data-a="crOk" data-uid="' + a.uid + '" data-v="suite">Terminer</button></div>' : '');
    }, function () { return lib(valSuite); });
    if (!c.suite || c.suite === 'aucune') return;
    e('suiteType', 'Rappel ou RDV confirmé ?', 'auto', function () { return choixCr(a, 'suiteType', [['rappel', 'Rappel'], ['rdv', 'RDV confirmé']], c.suiteType); },
      function () { return c.suiteType === 'rdv' ? 'RDV confirmé' : 'Rappel'; });
    e('date', 'Prochaine étape le', 'auto', function () {
      return '<div class="rangee-prochaine">' + [1, 7, 14, 30].map(function (n) {
        var d = ajouterJours(a.date, n);
        var lib = n === 1 ? '+1 j' : '+' + n + ' j';
        var sous = n === 1 ? 'Demain' : (n === 7 ? '1 sem.' : (n === 14 ? '2 sem.' : '1 mois'));
        return '<button type="button" class="puce puce-prochaine" data-a="crDate" data-uid="' + a.uid + '" data-v="' + d + '" aria-pressed="' + (c.date === d) + '">' +
          '<b>' + lib + '</b><small>' + sous + '</small></button>';
      }).join('') + '</div><label class="champ" style="margin:10px 0 0"><span>Ou une date précise</span><input type="date" data-f="crSelect" data-uid="' + a.uid + '" data-k="date" value="' + esc(c.date || '') + '" aria-label="Date de la prochaine étape"></label>' +
        '<span class="aide-champ">' + (c.suiteType === 'rappel' ? 'Rappel : il s\'affiche ce jour-là dans « Journée », sans modifier la tournée.' :
          'RDV confirmé : ' + (estPharmacie(a) ? 'la pharmacie est placée' : 'le praticien est placé') + ' d\'office ce jour-là dans vos tournées.') + '</span>';
    }, function () { return c.date ? majuscule(dateLongue(c.date)) : ''; });
  }
  // libellés courts des réponses repliées (comme Planifier : « Période  Journée du… »)
  var TITRES_COURTS = { 'Type(s) de visite médicale': 'Types', 'Activité(s) en pharmacie': 'Activités', 'La visite a-t-elle été faite ?': 'Visite faite', 'Trouver un remplaçant à proximité ?': 'Remplaçant', 'Type(s) de visite': 'Types',
    'Activité(s)': 'Types', 'Produits présentés ?': 'Présentés', 'Produits présentés': 'Produits', 'Réaction du médecin': 'Réaction',
    'Échantillons remis ?': 'Échantillons', 'Échantillons remis (quantités)': 'Échantillons', 'Échantillons (quantités)': 'Échantillons',
    'Étape suivante': 'Suite', 'Rappel ou RDV confirmé ?': 'Rappel / RDV', 'Prochaine étape le': 'Date', 'Stocks vérifiés ?': 'Stocks', 'Stock par produit': 'Détails stock',
    'Produits vérifiés en stock': 'Produits', 'Retour': 'Retour', 'Retour ou échange': 'Retour',
    'Commande passée ?': 'Commande', 'Commande (quantités)': 'Quantités', 'Besoin de réapprovisionnement': 'Besoin' };
  function titreCourt(t) { return TITRES_COURTS[t] || t; }
  // 3.25.43 : Formulaire Express en un seul écran pour les visites rapides
  function rendreCompteRenduExpress(a) {
    var c = crDe(a);
    if (!c.statut) { c.statut = 'Visite faite'; syncCr(a); }
    var estFait = Moteur.estVisite(c.statut, statuts());
    var ph = estPharmacie(a);

    var h = '<div class="cr-express-bloc">' +
      '<div class="tete-bloc tete-cr" style="display:flex;justify-content:space-between;align-items:center">' +
      '<div><h3 style="margin:0;display:inline-block">Compte Rendu Express</h3> <span class="pastille-version" style="font-size:11px;background:var(--bleu-pale);color:var(--primaire);padding:2px 6px;border-radius:4px;font-weight:700">1 écran</span></div>' +
      '<button type="button" class="bouton-texte" data-a="basculerModeComplet" data-uid="' + a.uid + '" style="font-size:12px;padding:2px 0">Formulaire complet →</button>' +
      '</div>';

    // 1. Statut
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Statut de la visite</span>' +
      '<div class="puces" style="margin-top:4px">' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Visite faite" aria-pressed="' + (c.statut === 'Visite faite') + '">✓ Visite faite</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Absent" aria-pressed="' + (c.statut === 'Absent') + '">Absent</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Indisponible" aria-pressed="' + (c.statut === 'Indisponible') + '">Indisponible</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="RDV reporté" aria-pressed="' + (c.statut === 'RDV reporté') + '">Reporté</button>' +
      '</div></div>';

    if (!estFait) {
      h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
        '<span>Préciser le motif</span>' +
        '<select data-f="crSelect" data-uid="' + a.uid + '" data-k="statut">' +
        statuts().filter(function (s) { return !s.visite; }).map(function (s) {
          return '<option' + (s.nom === c.statut ? ' selected' : '') + '>' + esc(s.nom) + '</option>';
        }).join('') + '</select></div>';
      h += '<div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer la visite non réalisée</button>' +
        (a.hors ? '' : '<button class="bouton bouton-large" type="button" data-a="crRemplacer" data-uid="' + a.uid + '">' + icone('cible') + 'Enregistrer et remplacer dans la tournée</button>') +
        '</div>';
      return h + '</div>';
    }

    // 2. Types de visite / Activités
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      rendreChoixTypesCr(a, c.types) +
      '</div>';

    // 3. Produits présentés
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<div class="gamme-cr-titre" style="margin-bottom:6px"><span><b>Produits présentés</b></span></div>' +
      rendreChoixProduitsCr(a, 'produits', c.produits) +
      '</div>';

    // 4. Prochaine étape
    var optProchaine = [
      ['', 'Aucune'],
      ['+1', 'Demain'],
      ['+7', '+7 j'],
      ['+14', '+14 j'],
      ['+30', '+30 j']
    ];
    var valP = c.prochaine;

    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Prochain contact / RDV</span>' +
      '<div class="puces" style="margin-top:4px">' +
      optProchaine.map(function (op) {
        var d = op[0] ? ajouterJours(aujourdhui(), parseInt(op[0], 10)) : '';
        var actif = (op[0] === '' && !valP) || (op[0] && valP === d);
        return '<button type="button" class="puce" data-a="crEtapeRapide" data-uid="' + a.uid + '" data-v="' + d + '" aria-pressed="' + actif + '">' + op[1] + '</button>';
      }).join('') +
      '</div></div>';

    // 5. Bilan / Note rapide facultative
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Observation rapide <small class="discret">(facultatif)</small></span>' +
      '<input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="bilan" value="' + esc(c.bilan || '') + '" placeholder="Objections, engagements, besoins…">' +
      '</div>';

    // 6. Bouton de validation sous le pouce
    h += '<div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">' +
      '<button class="bouton bouton-plein" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer</button>' +
      '<div style="text-align:center"><button type="button" class="bouton-texte" data-a="basculerModeComplet" data-uid="' + a.uid + '">Formulaire complet</button></div>' +
      '</div>';

    return h + '</div>';
  }

  function rendreCompteRendu(a) {
    if (S.config.crExpress && !a.modeComplet) {
      return rendreCompteRenduExpress(a);
    }
    var c = crDe(a), ok = c.ok || (c.ok = {}), h = '<div class="cr-pas etapes-filtres"><div class="tete-bloc tete-cr" style="display:flex;justify-content:space-between;align-items:center"><h3>Compte Rendu</h3>' +
      (S.config.crExpress ? '<button type="button" class="bouton-texte" data-a="basculerModeExpress" data-uid="' + a.uid + '" style="font-size:12px">⚡ Mode express</button>' : '') +
      '</div>';
    var etapes = etapesCr(a);
    for (var i = 0; i < etapes.length; i++) {
      var s = etapes[i];
      if (s.fin === 'remplacer') {
        return h + '<div class="actions-cr"><button class="bouton bouton-plein" type="button" data-a="crRemplacer" data-uid="' + a.uid + '">' +
          icone('cible') + 'Remplacer</button></div></div>';
      }
      if (ok[s.id]) {
        h += '<button type="button" class="cr-fait" data-a="crEditer" data-uid="' + a.uid + '" data-v="' + s.id + '"><span>' + esc(titreCourt(s.titre)) + '</span><b>' + esc(s.resume()) + '</b>' + icone('crayon') + '</button>';
        continue;
      }
      // question en cours : la seule affichée
      var err = s.valide ? s.valide() : '';
      h += '<div class="cr-question"><span class="etape-titre">' + esc(s.titre) + ' <small>étape ' + (i + 1) + (s.type === 'facultatif' ? ', facultatif' : '') + '</small></span>' + s.rendu();
      if (s.type !== 'auto') {
        h += '<div class="rangee cr-boutons">' + (s.type === 'facultatif' ? '<button class="bouton" type="button" data-a="crPasser" data-uid="' + a.uid + '" data-v="' + s.id + '">Passer</button>' : '') +
          '<button class="bouton bouton-plein" type="button" data-a="crOk" data-uid="' + a.uid + '" data-v="' + s.id + '"' + (err ? ' disabled' : '') + '>Continuer</button></div>' +
          (err ? '<span class="aide-champ">Pour continuer : ' + esc(err) + '.</span>' : '');
      }
      return h + '</div></div>';
    }
    // toutes les questions sont répondues
    return h + '</div>' + boutonEnregistrer(a);
  }
  // réouvre une étape : elle et les suivantes sont reposées (les réponses restent pré-remplies)
  function editerEtape(a, id) {
    var c = crDe(a), l = etapesCr(a), i = l.map(function (s) { return s.id; }).indexOf(id);
    c.ok = c.ok || {};
    l.slice(Math.max(i, 0)).forEach(function (s) { delete c.ok[s.id]; });
    LS.set('plan', S.plan);
  }
  function validerEtape(a, id) { var c = crDe(a); c.ok = c.ok || {}; c.ok[id] = true; LS.set('plan', S.plan); }

  // 3.26.48 / 3.27.9 : compte rendu : les options se calent sous le dernier point touché (sans exception pour l'intitulé)
  function centrerQuestion(uid, pouceY) {
    setTimeout(function () {
      var c = document.querySelector('.arret.ouvert .cr-question') ||
              document.querySelector('.arret.ouvert .cr-express-bloc') ||
              document.querySelector('.arret.ouvert .actions-cr') ||
              document.querySelector('.arret.ouvert .rangee-actions-cr-valide') ||
              document.querySelector('.arret.ouvert');
      if (c) centrerElement(c, true, pouceY);
    }, 40);
  }
  function centrerQuestionRapport() {
    setTimeout(function () {
      var q = document.querySelector('.rapport-jour .cr-question') ||
              document.querySelector('.rapport-jour [data-a="rapValider"]') ||
              document.querySelector('.rapport-jour .rangee-actions-cr-valide') ||
              document.querySelector('.rapport-jour');
      if (q) centrerElement(q, false, S.ui.dernierClicY);
    }, 50);
  }
  function centrerChoix(el) {
    setTimeout(function () {
      var sel = '[data-a="' + el.dataset.a + '"][data-uid="' + el.dataset.uid + '"][data-k="' + (el.dataset.k || '') + '"][data-v="' + (el.dataset.v || '') + '"]';
      var b = null; try { b = document.querySelector(sel); } catch (e) {}
      var c = b || document.querySelector('.arret.ouvert .cr-question') || document.querySelector('.arret.ouvert');
      if (c) centrerElement(c, true, S.ui.dernierClicY);
    }, 40);
  }
  function boutonEnregistrer(a) {
    var m = manquesCr(a);
    return '<div class="actions-cr">' + (m.length ?
      '<button class="bouton" type="button" disabled>' + icone('valider') + 'Enregistrer</button><span class="aide-champ">Pour enregistrer : ' + esc(m.join(', ')) + '.</span>' :
      '<button class="bouton bouton-plein" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer</button>') + '</div>';
  }
  // une valeur par ligne : « Routine, Présentation produit » ou « A ; B » s'affichent l'un sous l'autre
  function parLigne(v) { return String(v || '').split(/\s*;\s*|\n+/).filter(Boolean).map(esc).join('<br>'); }
  function resumeCompteRendu(a, tuiles) {
    var r = champsCr(a), l = [];
    if (r.interlocuteur) l.push('Interlocuteur : ' + r.interlocuteur);
    if (r.activite) l.push('Type de visite : ' + listeActivites(r.activite).join(', '));
    if (r.produits && !estPharmacie(a)) l.push('Produits présentés : ' + r.produits);
    if (r.reactions) l.push('Réactions : ' + r.reactions);
    if (r.echantillons) l.push('Échantillons : ' + r.echantillons);
    if (r.stocks) l.push('Stocks : ' + r.stocks);
    if (r.commande) l.push('Commande : ' + r.commande);
    if (r.complements && !/^Échantillons/.test(r.complements)) l.push(r.complements);
    if (r.commentaire) l.push((crDe(a).faite === 'non' ? 'Précision : ' : 'Bilan : ') + r.commentaire);
    if (r.suite) l.push(r.suite + ' le ' + dateCourte(r.prochaine));
    // 3.25.10 : pharmacie : un produit par carte (état, quantité, anomalie), les uns après les autres
    var cartesStock = '';
    if (tuiles && estPharmacie(a) && r.stocks) {
      var cs = crDe(a), st = cs.stocks || {};
      l = l.map(function (x) { return x.indexOf('Stocks : ') === 0 ? '\u0000stocks' : x; });
      var prodsK = (cs.produitsStock && cs.produitsStock.length) ? cs.produitsStock : Object.keys(st);
      cartesStock = prodsK.filter(function (p) { return st[p] && st[p].etat; }).map(function (p) {
        var x = st[p];
        return '<div class="tuile statique"><small>' + esc(p) + '</small><b>' + esc(x.etat) + '</b>' +
          (x.qte ? '<span class="discret bloc-texte">Quantité : ' + esc(x.qte) + '</span>' : '') +
          (x.anomalie ? '<span class="discret bloc-texte">' + esc(x.anomalie) + (x.lot ? ', lot ' + esc(x.lot) : '') + '</span>' : '') + '</div>';
      }).join('') + (cs.autresStock ? '<div class="tuile statique large"><small>Autres produits</small><b>' + esc(cs.autresStock) + '</b></div>' : '');
    }
    if (tuiles) return '<div class="tuile statique"><small>Résultat</small><b>' + esc(a.statut || '') + '</b></div>' + l.map(function (x) {
      if (x === '\u0000stocks') return cartesStock;
      var i = x.indexOf(' : '), lab = i > 0 ? x.slice(0, i) : (r.suite && x.indexOf(r.suite) === 0 ? 'Suite' : 'Note'), val = i > 0 ? x.slice(i + 3) : x;
      return '<div class="tuile statique' + (val.length > 40 ? ' large' : '') + '"><small>' + esc(lab) + '</small><b>' + parLigne(val) + '</b></div>';
    }).join('');
    return l.map(function (x) { return '<p class="discret">' + esc(x) + '</p>'; }).join('');
  }
  // valeur d'un chemin « a.b.c » dans le compte rendu
  function majCr(a, cle, valeur, multi) {
    var c = crDe(a), p = cle.split('.'), o = c;
    // nom de produit pouvant contenir un point : le 2e élément est le produit, le reste le champ
    if (p.length > 2) p = [p[0], p.slice(1, p.length - 1).join('.'), p[p.length - 1]];
    else if (p.length === 2) p = [p[0], p[1]];
    for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== 'object') o[p[i]] = {}; o = o[p[i]]; }
    var k = p[p.length - 1];
    if (multi) { var l = Array.isArray(o[k]) ? o[k] : [], j = l.indexOf(valeur); if (j >= 0) l.splice(j, 1); else l.push(valeur); o[k] = l; }
    else o[k] = valeur;
    if (cle === 'faite' && valeur === 'oui') { c.motif = ''; c.remplacant = ''; }
    if (cle === 'suite' && valeur === 'aucune') { c.suiteType = ''; c.date = ''; }
    if (cle === 'types') memoriserDerniersTypesCr(estPharmacie(a), c.types);
    if (cle === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
    if (cle === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
    syncCr(a); LS.set('plan', S.plan);
  }

  // Rappels du jour (et en retard) : suites « Rappel » de mes comptes rendus, sans visite depuis
  function rappelsDuJour() {
    var t = aujourdhui(), dernier = {}, l = [];
    (S.queue || []).concat((S.data && S.data.historique) || []).forEach(function (v) {
      if (v.delegue && !estMoi(v.delegue)) return;
      var d = String(v.date || '').slice(0, 10);
      if (!dernier[v.code] || d > dernier[v.code].d) dernier[v.code] = { d: d, v: v };
    });
    Object.keys(dernier).forEach(function (k) {
      var v = dernier[k].v, p = String(v.prochaine || '').slice(0, 10);
      if (/^Rappel/.test(v.suite || '') && p && p <= t) {
        // 3.27.14 : rappel traité (« Fait ») ou reporté depuis la carte : masqué
        var st = LS.get('rappelsTraites', {})[v.code + '|' + p];
        if (st && (st.fait || (st.jusqua && st.jusqua > t))) return;
        l.push({ v: v, date: p });
      }
    });
    return l.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  }
  function rendreRappels() {
    var l = rappelsDuJour();
    if (!l.length) return '';
    // 3.27.14 : une seule carte (même gabarit que « Compte Rendu ») ; un appui ouvre les actions : Appeler, Ajouter au jour, Demain, Fait
    var noms = l.map(function (x) { return x.v.nom; }), x0 = l[0];
    return '<button type="button" class="acces-rapport rappel-carte" data-a="ouvrirRappels"><span>' + icone('calendrier') +
      '<b>' + (l.length > 1 ? 'Rappels (' + l.length + ')' : 'Rappel · ' + esc(x0.v.nom)) + '</b><small>' +
      esc(l.length > 1 ? noms.join(', ') : String(x0.v.suite).replace(/^Rappel : /, '') + (x0.date < aujourdhui() ? ', prévu le ' + dateCourte(x0.date) : '')) +
      '</small></span>' + icone('chevron') + '</button>';
  }
  function feuilleRappels() {   // enregistrée dans FEUILLES plus bas (FEUILLES n'existe pas encore ici)
    var l = rappelsDuJour(), t = aujourdhui();
    if (!l.length) return '<p class="discret">Aucun rappel en attente.</p>';
    return '<ul class="liste-rappels-f">' + l.map(function (x) {
      var p = praticien(x.v.code) || {}, k = esc(x.v.code + '|' + x.date), num = normaliserNumero(p.telephone);
      var deja = S.plan.some(function (a) { return a.date === t && a.code === x.v.code; });
      return '<li><b>' + esc(x.v.nom) + '</b><span class="discret bloc-texte">' + esc(String(x.v.suite).replace(/^Rappel : /, '')) +
        (x.date < t ? ', prévu le ' + dateCourte(x.date) : '') + (p.telephone ? ' · ' + esc(p.telephone) : '') + '</span>' +
        '<div class="rappel-actions">' +
          (num ? '<a class="bouton petit rappel-appel" href="tel:+' + esc(num) + '" aria-label="Appeler" title="Appeler">' + icone('tel') + '</a>' : '') +
          (deja ? '<span class="etiquette ok">' + icone('valider') + 'Dans la journée</span>' : '<button type="button" class="bouton petit" data-a="rappelAjouter" data-v="' + esc(x.v.code) + '">' + icone('plus') + 'Ajouter au jour</button>') +
          '<button type="button" class="bouton petit" data-a="rappelTraiter" data-k="' + k + '" data-v="demain">Demain</button>' +
          '<button type="button" class="bouton petit bouton-plein" data-a="rappelTraiter" data-k="' + k + '" data-v="fait">' + icone('valider') + 'Fait</button>' +
        '</div></li>';
    }).join('') + '</ul><p class="discret" style="margin:8px 0 0">« Fait » retire le rappel ; « Demain » le reporte au jour ouvré suivant.</p>';
  }



  // jours passés : modifiables seulement si l'option cachée « Modifier les jours passés » (Réglages › Avancé) est activée
  function passeVerrouille(d) { return d < aujourdhui() && !S.config.modifPasse; }
  // jours à venir : aperçu seul, sauf option cachée Réglages › Avancé › « Saisir les jours à venir » (3.16.0)
  function futurVerrouille(d) { return d > aujourdhui() && !S.config.saisieFutur; }
  // état d'une visite en une ligne (carte fermée) : faite + produits, non faite + motif, à saisir, à venir
  function ligneEtat(a) {
    var t = aujourdhui(), now = minutesMaintenant(), hm = heureVersMinutes(a.heure);
    if (a.statut) {
      var ko = estKo(a.statut), pr = !ko && a.produits ? ' · ' + a.produits : '';
      return '<span class="ligne-etat ' + (ko ? 'ko' : 'ok') + '">' + (ko ? '✗ ' : '✓ ') + esc(statutLibelle(a)) + esc(pr) + (a.etat !== 'valide' ? ' · à enregistrer' : '') + '</span>';
    }
    if (a.date < t) return '<span class="ligne-etat alerte">! Compte Rendu à saisir</span>';
    if (a.date === t && hm !== null && hm < now) return '<span class="ligne-etat alerte">! Compte Rendu à saisir' + distanceMoi(a) + '</span>';
    var tag = a.impose ? (a.etape ? libelleRdv(a) : (a.rdv ? 'RDV ' + a.rdv : 'Prioritaire')) : '';
    return '<span class="ligne-etat">○ À venir' + (tag ? ' · ' + esc(tag) : '') + (a.date === t ? distanceMoi(a) : '') + '</span>';
  }
  // 3.23.2 : distance entre moi (GPS) et une visite du jour pas encore faite, pour choisir qui voir en priorité
  // 3.25.36 : distance entre moi (GPS) et une visite du jour pas encore faite avec durées à pied et en voiture
  function distanceMoi(a) {
    var pos = gpsFrais(), cp = pos ? coordPrecise(a) : null, c = cp || (pos ? coordArret(a) : null);
    if (!c || !pos) return '';
    var route = distanceVol(pos, c);
    var d = distMoi(route, !cp);
    var minPied = Math.max(1, Math.round(route * 15));
    var minVoit = Math.max(1, minutesTrajet(route * REGLAGES_MOTEUR.detourRoutier, '', a.commune || '', minutesMaintenant()));
    return '<span class="dist-moi' + (route < 0.5 ? ' tout-pres' : '') + '" role="img" aria-label="À ' + d + ' de vous, ' + formaterDureeTrajet(minPied) + ' à pied, ' + formaterDureeTrajet(minVoit) + ' en voiture">' +
      '<span class="dist-val" title="Distance">' + icone('cible') + d + '</span>' +
      '<span class="trajet-mode" title="À pied">' + icone('pieton') + formaterDureeTrajet(minPied) + '</span>' +
      '<span class="trajet-mode" title="En voiture">' + icone('voiture') + formaterDureeTrajet(minVoit) + '</span>' +
      '</span>';
  }
  // Carte d'une visite (Aujourd'hui) : contact d'abord, puis compte rendu en deux temps
  function rendreArret(a) {
    var ouvert = S.ui.ouvert === a.uid, verrou = a.etat === 'valide';
    var cls = 'arret' + (ouvert ? ' ouvert' : '') + (verrou ? ' verrouille' : '') + (a.garde ? ' garde' : '') +
      (a.statut ? (estKo(a.statut) ? (verrou ? ' absent' : ' absent-attente') : (verrou ? ' fait' : ' fait-attente')) : '') +   // plein = enregistré, vide de couleur = à enregistrer
      (S.ui.flashOk && S.ui.flashOk[a.uid] ? ' vient-enregistrer' : '');
    var e = '';
    e += badgeConv(a.conventionne);
    var pv = praticien(a.code) || {}, der = pv.derniere && (!a.derniere || pv.derniere > a.derniere) ? pv.derniere : a.derniere;
    var vu = vuDepuis(der, a.etat !== 'valide' && a.date > aujourdhui() ? a.date : aujourdhui());
    if (estPharmacie(a)) vu = vu.replace(/^Vu /, 'Visitée ').replace('Jamais visité', 'Jamais visitée');
    e += '<span class="etiquette">' + esc(vu) + '</span>';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? esc(libelleRdv(a)) : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut && !verrou) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(a)) + ', à enregistrer</span>';
    if (a.etat === 'ajoute') e += '<span class="etiquette">Ajouté</span>';
    if (a.etat === 'repris') e += '<span class="etiquette">Repris d\'un ancien programme</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.prochaine && a.prochaine <= a.date && !a.statut && !a.etape) e += '<span class="etiquette p1">RDV prévu le ' + dateCourte(a.prochaine) + '</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici (présent ' + esc(a.fiabTexte) + ')</span>';
    e += etiquetteCollegues(a.code, a.date);

    var h = '<li class="' + cls + '" data-p="' + (+a.note === 3 ? 1 : 3) + '" data-uid-arret="' + esc(a.uid) + '">' +
      '<div class="arret-heure"><b>' + esc((a.statut && a.valideA) || a.heure || (a.creneau ? a.creneau.slice(0, 5) : '--:--')) + '</b>' + (a.debut || a.fin ? '<small>' + esc(a.debut) + '-' + esc(a.fin) + '</small>' : '') + '</div>' +
      '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
      '<div><div class="arret-carte' + classeType(a) + '">' +
        '<button type="button" class="carte-bouton" data-a="ouvrir" data-uid="' + a.uid + '" aria-expanded="' + ouvert + '">' +
          '<span class="arret-nom">' + pastilleType(a) + esc(a.nom) + ' ' + etoiles(a.note) + '</span>' +
          (ouvert ? (lieuEtSpec(a) ? '<span class="arret-lieu">' + specGras(a, lieuEtSpec(a)) + '</span>' : '') +
            '<span class="arret-lieu">' + esc([a.quartier, reperesDe(a), a.commune].filter(Boolean).join(', ')) + '</span>' +
            '<span class="etiquettes">' + e + '</span>' : (lieuQuartier(a) ? '<span class="arret-lieu">' + specGras(a, lieuQuartier(a)) + '</span>' : '') + ligneEtat(a)) +
        '</button>' +
        (!ouvert && !a.hors && !passeVerrouille(a.date) && a.statut && estKo(a.statut) && !futurVerrouille(a.date) ? '<button class="bouton petit remplacer-ligne" type="button" data-a="completerJour" data-uid="' + a.uid + '">' + icone('relancer') + 'Remplacer</button>' : '');
    if (ouvert) {
      var pa = praticien(a.code) || {};
      h += '<div class="arret-detail">' +
        actionsRapides({ telephone: pa.telephone, lat: a.lat, lon: a.lon, lieu: a.lieu, quartier: a.quartier, commune: a.commune });
      if (futurVerrouille(a.date) && !(a.statut && verrou)) {
        // 3.25.0 : jour à venir sans « Saisie avancée » : pas de compte rendu, la planification reste possible
        h += '<div class="bandeau" style="margin-top:10px"><p><b>Visite à venir.</b> Le compte rendu ne se saisit pas à l\'avance.</p></div>' +
          '<div class="rangee-actions bas-carte"><button class="bouton petit danger-doux" type="button" data-a="retirer" data-uid="' + a.uid + '">' + icone('fermer') + 'Retirer de la tournée</button>' +
          '<button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else if (passeVerrouille(a.date) && !(a.statut && verrou)) {
        h += '<div class="bandeau" style="margin-top:10px"><p><b>Jour passé.</b> La saisie des comptes rendus des jours passés est désactivée. ' +
          'Pour l\'activer : roue crantée › Avancé › « Saisie avancée ».</p></div>' +
          '<div class="rangee-actions bas-carte"><button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else if (!verrou) {
        h += rendreCompteRendu(a);
        var cf = conflitArret(a);
        h += a.hors ? '<div class="rangee-actions bas-carte"><button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>' :
          cf ? questionConflit(a, cf) : '<div class="rangee-actions bas-carte"><button class="bouton petit danger-doux" type="button" data-a="retirer" data-uid="' + a.uid + '">' + icone('fermer') + 'Retirer de la tournée</button>' +
          '<button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else {
        h += '<div class="cr-enregistre">' +
          '<div class="tuiles-resume">' + resumeCompteRendu(a, true) + '</div>' +
          '<div class="rangee-actions-cr-valide">' +
          '<button class="bouton bouton-plein" type="button" data-a="quitterCarte">' + icone('fermer') + '<span>Sortir</span></button>' +
          (passeVerrouille(a.date) ? '' : '<button class="bouton" type="button" data-a="corriger" data-uid="' + a.uid + '">' + icone('crayon') + 'Modifier</button>') +
          '</div></div>';
      }
      h += '</div>';
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
    var ouverte = S.ui.couvOuverte;
    var h = '<section class="bloc couverture"><div class="couv-tete"><button type="button" class="groupe-bascule" data-a="couvOuvrir" aria-expanded="' + ouverte + '">' +
      '<b>Communes visitées</b><small>' + couv.length + '/' + cv.length + '</small>' + icone('chevron') + '</button>' +
      '<div class="segment petit" role="group" aria-label="Période">' +
        '<button type="button" data-a="couvPortee" data-v="jour" aria-pressed="' + (portee === 'jour') + '">Jour</button>' +
        '<button type="button" data-a="couvPortee" data-v="semaine" aria-pressed="' + (portee === 'semaine') + '" title="Semaine">Sem.</button></div></div>';
    if (!ouverte) return h + '</section>';
    h += '<div class="carte-l" id="carteCouv">' + carteCouverture(dates, mes, eq) + '</div>' +
      '<div class="legende"><span><i class="q-moi"></i>Mes visites' + (portee === 'jour' ? ' (dans l\'ordre)' : '') + '</span><span><i class="q-equipe"></i>Équipe</span><span><i class="q-vide"></i>Commune non visitée</span></div>';
    cartesAFaire.push({ id: 'carteCouv', route: portee === 'jour' ? mes : [], points: portee === 'jour' ? [] : mes, equipe: eq,
      nonCouvertes: non.map(function (c) { return c.commune; }) });
    h += segment('Filtre', 'couvFiltre', [['toutes', 'Toutes'], ['couvertes', 'Visitées · ' + couv.length], ['non', 'Non visitées · ' + non.length]], S.ui.couvFiltre);
    var liste = S.ui.couvFiltre === 'couvertes' ? couv : (S.ui.couvFiltre === 'non' ? non : cv);
    var autresCommunes = [], interieurCommunes = [];
    liste.forEach(function (c) {
      if (c.zone === 'Zone Intérieur' || (c.zone && c.zone.toLowerCase().indexOf('intérieur') >= 0)) {
        interieurCommunes.push(c);
      } else {
        autresCommunes.push(c);
      }
    });

    var zone = '';
    h += '<ul class="liste-couv">';
    autresCommunes.forEach(function (c) {
      if (c.zone !== zone) { zone = c.zone; h += '<li class="couv-zone">' + esc(zone) + '</li>'; }
      var eqNoms = Object.keys(c.equipe);
      h += '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
        '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
        (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non visitée') +
        (eqNoms.length ? ' ; équipe : ' + eqNoms.map(function (n) { return esc(n) + ' (' + c.equipe[n] + ')'; }).join(', ') : '') +
        '</span></div><span class="couv-dispo">' + c.dispo + ' dispo.' + (c.prioritaires ? '<small>' + c.prioritaires + ' ★★★ en retard</small>' : '') + '</span></li>';
    });

    if (interieurCommunes.length > 0) {
      var ouvInt = !!S.ui.couvInterieurOuverte;
      var nbVisInt = interieurCommunes.filter(function (x) { return x.moi > 0; }).length;
      h += '<li class="couv-zone couv-zone-interieur">' +
        '<button type="button" class="couv-zone-btn" data-a="couvInterieurToggle" aria-expanded="' + ouvInt + '">' +
        '<span>Zone Intérieur <small>(' + interieurCommunes.length + ' commune' + (interieurCommunes.length > 1 ? 's' : '') +
        (nbVisInt ? ' · ' + nbVisInt + ' visitée' + (nbVisInt > 1 ? 's' : '') : '') + ')</small></span>' +
        icone('chevron') +
        '</button></li>';
      if (ouvInt) {
        interieurCommunes.forEach(function (c) {
          var eqNoms = Object.keys(c.equipe);
          h += '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
            '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
            (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non visitée') +
            (eqNoms.length ? ' ; équipe : ' + eqNoms.map(function (n) { return esc(n) + ' (' + c.equipe[n] + ')'; }).join(', ') : '') +
            '</span></div><span class="couv-dispo">' + c.dispo + ' dispo.' + (c.prioritaires ? '<small>' + c.prioritaires + ' ★★★ en retard</small>' : '') + '</span></li>';
        });
      }
    }
    h += '</ul></section>';
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
    s += '</svg>';
    return s;
  }

  // ------------------------------------------------------------------ Cartes (Leaflet, fond OpenStreetMap épuré)
  // Chargée à la demande ; sans réseau, le schéma simplifié reste affiché.
  var cartesAFaire = [], promesseLeaflet = null;
  function chargerLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (promesseLeaflet) return promesseLeaflet;
    promesseLeaflet = new Promise(function (ok, ko) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = LEAFLET_JS; js.onload = function () { ok(window.L); };
      js.onerror = function () { promesseLeaflet = null; ko(); }; document.head.appendChild(js);
    });
    return promesseLeaflet;
  }
  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  function couleur(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function themeSombre() { return document.documentElement.dataset.theme === 'sombre' || (!document.documentElement.dataset.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  function dessinerCartes() {
    var l = cartesAFaire.slice();
    if (!l.length || !navigator.onLine) return;
    chargerLeaflet().then(function (L) { l.forEach(function (c) { dessinerCarte(L, c); }); }, function () {});
  }
  function dessinerCarte(L, c) {
    var el = $(c.id); if (!el) return;
    el.innerHTML = ''; el.classList.add('active');
    var carte = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    // fond OpenStreetMap (sans clé), adouci en CSS pour un rendu épuré (inversé en thème sombre)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© contributeurs OpenStreetMap' }).addTo(carte);
    el.classList.toggle('sombre', themeSombre());
    var prim = couleur('--primaire'), bleu = couleur('--bleu'), gris = couleur('--gris-2'), limites = [];
    // communes non couvertes : repère discret au centre de la commune
    var centres = {};
    quartiers().forEach(function (q) { var x = centres[q.commune] = centres[q.commune] || { lat: 0, lon: 0, n: 0 }; x.lat += +q.lat; x.lon += +q.lon; x.n++; });
    (c.nonCouvertes || []).forEach(function (k) {
      var x = centres[k]; if (!x) return;
      L.circle([x.lat / x.n, x.lon / x.n], { radius: 900, color: gris, weight: 1, dashArray: '4 4', fillOpacity: 0.06 }).addTo(carte).bindTooltip(k + ' : non visitée');
    });
    (c.equipe || []).forEach(function (a) {
      var p = coordArret(a); if (!p) return;
      L.circleMarker([p.lat, p.lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: bleu, fillOpacity: 0.9 }).addTo(carte)
        .bindTooltip(esc(a.delegue || 'Équipe') + ' : ' + esc(a.nom));
      limites.push([p.lat, p.lon]);
    });
    var parQ = {};
    (c.points || []).forEach(function (a) {
      var p = coordArret(a); if (!p) return;
      var k = a.quartier || (p.lat + ',' + p.lon), x = parQ[k] = parQ[k] || { lat: p.lat, lon: p.lon, n: 0, lib: a.quartier };
      x.n++;
    });
    Object.keys(parQ).forEach(function (k) {
      var x = parQ[k];
      L.circleMarker([x.lat, x.lon], { radius: Math.min(6 + x.n * 2, 18), color: '#fff', weight: 2, fillColor: prim, fillOpacity: 0.85 }).addTo(carte)
        .bindTooltip(esc(x.lib) + ' : ' + x.n + ' visite' + (x.n > 1 ? 's' : ''));
      limites.push([x.lat, x.lon]);
    });
    var trace = [];
    (c.route || []).forEach(function (a, i) {
      var p = a.lat !== undefined && a.lat !== null && a.lat !== '' ? { lat: +a.lat, lon: +a.lon } : coordArret(a); if (!p) return;
      trace.push([p.lat, p.lon]); limites.push([p.lat, p.lon]);
      L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'pin', html: '<span>' + (i + 1) + '</span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(carte)
        .bindTooltip((heureVisite(a) ? heureVisite(a) + ' · ' : '') + esc(a.nom) + (a.lieu ? '<br>' + esc(a.lieu) : ''));
    });
    if (trace.length > 1) L.polyline(trace, { color: prim, weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(carte);
    if (limites.length) carte.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
    else carte.setView([5.345, -4.01], 11);
  }
  function coordArret(a) {
    var c0 = lireCoord(a); if (c0) return c0;
    var cr = a.idPresence && ctx().parCode[a.code] ? ctx().parCode[a.code].filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0] : null;
    if (cr && cr.coord) return cr.coord;
    var q = quartiers().filter(function (x) { return x.quartier === a.quartier; })[0];
    return q ? { lat: +q.lat, lon: +q.lon } : null;
  }

  // ------------------------------------------------------------------ Vue : produits (aide-mémoire du délégué)
  // Fiches de la feuille « Fiches produits » du Google Sheet (repli : fiches intégrées), regroupées par gamme.
  var ORDRE_AIRES = ['Hypertension artérielle', 'Hypertension et cœur', 'Cholestérol et risque cardiovasculaire', 'Troubles du rythme cardiaque', 'Angine de poitrine', 'Prévention de la thrombose', 'Métabolisme et neuropathie'];
  var SECTIONS_FICHE = [['indications', 'Indications', 'ind'], ['contreIndications', 'Contre-indications', 'ci'], ['posologie', 'Posologie', 'pos'],
    ['precautions', 'Précautions et interactions', 'pre'], ['effets', 'Effets indésirables', 'ei'], ['arguments', 'Arguments clés pour la visite', 'arg']];
  function deduireFicheProduit(nom, existantes) {
    nom = String(nom || '').trim();
    var kn = normaliser(nom);
    var parent = (existantes || []).filter(function (f) {
      var kf = normaliser(f.produit);
      return kn.indexOf(kf) === 0 || kf.indexOf(kn) === 0 || normaliser(f.gamme).indexOf(kn.split(' ')[0]) >= 0;
    })[0];

    if (parent) {
      return {
        gamme: parent.gamme,
        aire: parent.aire,
        produit: nom,
        dci: parent.dci || nom,
        classe: parent.classe || '',
        indications: parent.indications || '',
        contreIndications: parent.contreIndications || '',
        posologie: parent.posologie || '',
        precautions: parent.precautions || '',
        effetsIndesirables: parent.effetsIndesirables || '',
        arguments: parent.arguments || ''
      };
    }
    var gamme = nom, aire = 'Cardiologie & Métabolisme', classe = '';
    if (/zyltan|losartan/i.test(nom)) { gamme = 'Zyltan (losartan)'; aire = 'Hypertension artérielle'; classe = 'ARA II'; }
    else if (/lesstrol|lestrol/i.test(nom)) { gamme = 'Lesstrol (atorvastatine)'; aire = 'Cholestérol et risque cardiovasculaire'; classe = 'Statine'; }
    else if (/tensicard/i.test(nom)) { gamme = 'Tensicard (aténolol)'; aire = 'Hypertension artérielle'; classe = 'Bêtabloquant'; }
    else if (/eurythmic/i.test(nom)) { gamme = 'Eurythmic (amiodarone)'; aire = 'Troubles du rythme cardiaque'; classe = 'Antiarythmique'; }
    else if (/telmikaa/i.test(nom)) { gamme = 'Telmikaa (telmisartan)'; aire = 'Hypertension artérielle'; classe = 'ARA II'; }
    else if (/rozukaa/i.test(nom)) { gamme = 'Rozukaa (rosuvastatine)'; aire = 'Cholestérol et risque cardiovasculaire'; classe = 'Statine'; }
    else if (/antiplatt/i.test(nom)) { gamme = 'Antiplatt (clopidogrel)'; aire = 'Prévention de la thrombose'; classe = 'Antiagrégant plaquettaire'; }
    else if (/myonit/i.test(nom)) { gamme = 'Myonit (trinitrine)'; aire = 'Angine de poitrine'; classe = 'Dérivé nitré'; }

    return {
      gamme: gamme,
      aire: aire,
      produit: nom,
      dci: nom,
      classe: classe,
      indications: 'Indication officielle selon notice du produit',
      contreIndications: '',
      posologie: 'Selon prescription médicale',
      precautions: '',
      effetsIndesirables: '',
      arguments: ''
    };
  }
  function fichesProduits() {
    var l = (S.data && S.data.fiches) || [];
    var fichesToutes = (l.length ? l : FICHES_PRODUITS_DEFAUT).slice();
    var inactifs = {};
    fichesToutes.forEach(function (f) {
      if (!estProduitActif(f)) inactifs[normaliser(f.produit)] = true;
    });
    var fiches = fichesToutes.filter(function (f) {
      return !inactifs[normaliser(f.produit)];
    });
    var prodsListes = (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT;
    var vus = {};
    fiches.forEach(function (f) { vus[normaliser(f.produit)] = true; });
    prodsListes.forEach(function (p) {
      var kp = normaliser(p);
      if (l.length && !vus[kp]) return;   // 3.26.79 : base connectée : un produit sans fiche active n'est pas proposé
      if (!vus[kp] && !inactifs[kp]) {
        var nouv = deduireFicheProduit(p, fiches);
        fiches.push(nouv);
        vus[kp] = true;
      }
    });
    return fiches;
  }
  function lignesFiche(t) { return String(t || '').split(/\n|;\s*(?=[A-ZÉÈÀÂÎÔ])/).map(function (x) { return x.replace(/^[•\-\s]+/, '').trim(); }).filter(Boolean); }
  // Disposition compacte : une ligne par gamme (nom, molécule) avec ses produits en pastilles ; un filtre par aire thérapeutique.
  // La fiche ne s'ouvre qu'au toucher d'un produit, dans une fenêtre ; ses rubriques secondaires se déplient à la demande.
  var AIRES_COURTES = { 'Hypertension artérielle': 'Hypertension', 'Cholestérol et risque cardiovasculaire': 'Cholestérol', 'Troubles du rythme cardiaque': 'Rythme', 'Prévention de la thrombose': 'Antiagrégant', 'Angine de poitrine': 'Angor', 'Métabolisme et neuropathie': 'Métabolisme' };
  function gammesProduits(l) {
    var g = [];
    l.forEach(function (f) { var x = g.filter(function (y) { return y.nom === f.gamme; })[0]; if (!x) g.push(x = { nom: f.gamme, aire: f.aire, fiches: [] }); x.fiches.push(f); });
    return g.sort(function (a, b) { var i = ORDRE_AIRES.indexOf(a.aire), j = ORDRE_AIRES.indexOf(b.aire); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
  }
  VUES.produits = function () {
    var q = normaliser(S.ui.rechProduit || ''), aire = S.ui.aireProduit || '', toutes = fichesProduits();
    var aires = []; toutes.forEach(function (f) { if (f.aire && aires.indexOf(f.aire) < 0) aires.push(f.aire); });
    aires.sort(function (a, b) { return ORDRE_AIRES.indexOf(a) - ORDRE_AIRES.indexOf(b); });
    var l = toutes.filter(function (f) { return (!aire || f.aire === aire) && (!q || normaliser([f.produit, f.dci, f.gamme, f.classe, f.indications, f.aire].join(' ')).indexOf(q) >= 0); });
    var h = '<h2 class="titre-vue">Produits</h2><p class="sous-titre">Votre aide-mémoire de visite : produits, arguments clés et échantillons.</p>' +
      '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="rechProduit" placeholder="Produit, molécule, indication…" value="' + esc(S.ui.rechProduit || '') + '" aria-label="Rechercher un produit"></div></div>' +
      '<div class="defile" role="group" aria-label="Aire thérapeutique"><button type="button" class="puce" data-a="aireProduit" data-v="" aria-pressed="' + !aire + '">Tous</button>' +
      aires.map(function (x) { return '<button type="button" class="puce" data-a="aireProduit" data-v="' + esc(x) + '" aria-pressed="' + (aire === x) + '">' + esc(AIRES_COURTES[x] || x) + '</button>'; }).join('') + '</div>';
    if (!l.length) return h + '<div class="vide"><strong>Aucun produit</strong>Aucune fiche ne correspond.<div style="margin-top:14px"><button class="bouton bouton-plein" type="button" data-a="reinitFiltresProduits">' + icone('fermer') + 'Réinitialiser la recherche et les filtres</button></div></div>';
    // 3.19.0 : une section repliable par aire thérapeutique (ouverte d'office si un filtre ou une recherche est actif)
    // 3.22.3 : par défaut, seule la première aire est dépliée (le reste se déplie au toucher)
    if (!S.ui.airesOuvertes) { S.ui.airesOuvertes = {}; if (aires[0]) S.ui.airesOuvertes[aires[0]] = true; }
    var aireCourante = null, ouvertes = S.ui.airesOuvertes, toutOuvert = !!(aire || q);
    var parAire = {}; l.forEach(function (f) { parAire[f.aire] = (parAire[f.aire] || 0) + 1; });
    h += '<div class="liste-gammes">';
    gammesProduits(l).forEach(function (g) {
      if (g.aire !== aireCourante) {
        aireCourante = g.aire;
        var ouv = toutOuvert || ouvertes[g.aire];
        h += '<button type="button" class="aire-titre aire-bascule" data-a="aireBascule" data-v="' + esc(g.aire || '') + '" aria-expanded="' + !!ouv + '"><span>' + esc(g.aire || '') +
          '</span><small>' + parAire[g.aire] + ' produit' + (parAire[g.aire] > 1 ? 's' : '') + '</small>' + icone('chevron') + '</button>';
      }
      if (!(toutOuvert || ouvertes[g.aire])) return;
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, ''), mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
      h += '<div class="ligne-gamme"><div class="lg-tete"><b>' + esc(nom) + '</b>' + (mol ? '<small>' + esc(mol) + '</small>' : '') + '</div><div class="lg-produits">' +
        g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).map(function (f) {
          // dans la ligne de la gamme, le nom de gamme n'est pas répété : « Rozukaa 10 » devient « 10 mg », « Zyltan AM » devient « AM »
          var court = f.produit.indexOf(nom + ' ') === 0 ? f.produit.slice(nom.length + 1) : f.produit;
          if (/^\d+$/.test(court)) court += ' mg';
          if (g.fiches.length === 1) court = f.produit;   // gamme d'un seul produit : nom complet (« Myonit SR » plutôt que « SR »)
          return '<button type="button" class="pastille-produit" data-a="produitOuvrir" data-v="' + esc(f.produit) + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
        }).join('') + '</div></div>';
    });
    return h + '</div><p class="discret" style="margin-top:12px;font-size:12.5px">Résumé des notices officielles des molécules ; la notice de la boîte fait foi. Fiches modifiables dans l\'onglet « Fiches produits » du Google Sheet.</p>';
  };
  // champ de recherche libre, identique à celui de l'onglet Recherche (loupe, sans critère à choisir)
  function champRechercheLibre(f, q) {
    return '<div class="recherche recherche-libre">' + icone('loupe') + '<input type="search" data-f="' + f + '" placeholder="Nom, spécialité, établissement, commune…" value="' +
      esc(q || '') + '" aria-label="Rechercher un praticien" autocomplete="off"></div>';
  }
  // 3.25.1 : résultats de la recherche libre d'« Autour de moi » : praticiens présents ce jour-là, tous rayons confondus,
  // selon les filtres appliqués, du plus proche au plus loin
  function momentAutour() {
    var A = S.ui.autour;
    if (A.moment === 'maintenant') return { date: aujourdhui(), minute: minutesMaintenant() };
    return { date: A.date || prochainJourOuvre(aujourdhui()), minute: heureVersMinutes(A.heure) };
  }
  function resultatsAutourLibre(q) {
    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    S.ui.resAutourLibre = [];
    if (!mots.length) return '';
    var A = S.ui.autour, m = momentAutour(), date = m.date;
    if (jourSemaineIndex(date) > 4) return '<p class="discret">Aucun praticien présent le week-end.</p>';
    var fa = S.ui.pharmaciesProches ? S.ui.filtresAutour : S.ui.filtres, filtre = criteresActifs(fa).length ? ensemble(filtrerPraticiens(fa, '').map(function (p) { return p.code; })) : null;
    var avecPos = A.lat !== null, pos = avecPos ? { lat: A.lat, lon: A.lon } : { lat: 5.345, lon: -4.02 };
    var dansT = ensemble(S.plan.filter(function (a) { return a.date === date; }).map(function (a) { return a.code; }));
    var l = Moteur.autourDe(ctx(), pos, date, m.minute, Infinity).filter(function (x) {
      var c = x.c, p = c.prat;
      if ((A.ref && c.code === A.ref.code) || (filtre && !filtre[c.code]) || absentLe(p, date) || dansT[c.code]) return false;
      var txt = normaliser([p.nom, p.specialite, c.lieu, c.quartier, c.commune].join(' '));
      return mots.every(function (w) { return txt.indexOf(w) >= 0; });
    });
    if (!avecPos) l.sort(function (a, b) { return b.score - a.score; });
    l = l.slice(0, 30); S.ui.resAutourLibre = l;
    if (!l.length) return '<p class="discret">Aucun praticien présent le ' + dateFr(date) + ' ne correspond, selon vos filtres.</p>';
    return '<p class="discret">' + l.length + (l.length === 30 ? '+' : '') + ' résultat' + (l.length > 1 ? 's' : '') + ', ' + dateLongue(date) + (avecPos ? ', du plus proche au plus loin' : '') + '.</p>' +
      '<ul class="liste">' + l.map(function (x, i) { return rendreProposition(x, i, date, 'libre', avecPos); }).join('') + '</ul>';
  }

  // ------------------------------------------------------------------ Vue : autour de moi
  VUES.autour = function () {
    var A = S.ui.autour, h = '<button type="button" class="retour" data-a="nav" data-tab="jour">' + icone('chevron') + 'Journée</button>' +
      '<h2 class="titre-vue">' + (A.ref ? 'Rattraper une visite' : S.ui.pharmaciesProches ? (S.ui.pharmaciesProches === 'Médecin' ? 'Médecins' : 'Pharmacies') + ' à proximité' : 'Autour de moi') + '</h2>' +
      '<p class="sous-titre">' + (A.ref ? 'Trouvez un praticien présent à proximité pour remplacer la visite annulée ou compléter votre journée.' : S.ui.pharmaciesProches === 'Médecin' ? 'Les médecins présents près de votre position, selon vos spécialités, à ajouter à votre tournée du jour.' : S.ui.pharmaciesProches ? 'Les pharmacies ouvertes près de votre position, à ajouter à votre tournée du jour.' : 'Médecin absent, trou dans la journée : trouvez qui est présent près de vous.') + '</p>';
    if (A.ref) {
      h += '<div class="bandeau"><p>Remplacement de <b>' + esc(A.ref.nom) + '</b> (' + esc(A.ref.heure) + ', ' + esc(A.ref.quartier) +
        '), marqué « Absent ». <button type="button" class="bouton-texte" data-a="finRef">Terminer</button></p></div>';
    }
    // 3.25.1 : recherche libre en tête, sans critère à choisir (nom, spécialité, établissement, quartier, commune), dès les premières lettres
    var qL = S.ui.rechAutourLibre || '';
    var haut = h + champRechercheLibre('rechAutourLibre', qL) +
      '<div id="resAutourLibre">' + resultatsAutourLibre(qL) + '</div>';
    h = '';
    var fin = function (x) { return haut + '<div id="autourListe"' + (normaliser(qL) ? ' hidden' : '') + '>' + x + '</div>'; };
    // 3.27.38 : Récupération automatique de la position GPS par défaut et déduction du quartier
    if (A.lat === null || !A.src) {
      var g0 = S.ui.posGps || LS.get('derniereGps', null);
      if (g0 && isFinite(g0.lat) && isFinite(g0.lon)) {
        S.ui.posGps = g0;
        var r0 = Moteur.quartierLePlusProche(g0.lat, g0.lon, quartiers());
        A.lat = g0.lat; A.lon = g0.lon; A.src = 'gps'; A.prec = g0.prec;
        A.quartier = r0 && r0.quartier ? r0.quartier.quartier : '';
        A.commune = r0 && r0.quartier ? r0.quartier.commune : '';
        A.label = A.quartier ? A.quartier + ' (ma position)' : 'Ma position';
        LS.set('autour', A);
      } else if (S.config && S.config.depart) {
        var qDef = quartiers().filter(function (x) { return x.quartier === S.config.depart; })[0];
        if (qDef) {
          A.lat = qDef.lat; A.lon = qDef.lon; A.quartier = qDef.quartier; A.commune = qDef.commune;
          A.label = qDef.quartier; A.src = 'gps_init';
          LS.set('autour', A);
        }
      }
      if (!S.ui.localisation) localiser(true, 'autour', true);
    }

    var estGps = A.src === 'gps' || A.src === 'gps_init';
    var txtGps = 'Utiliser ma position';
    if (estGps && A.quartier) {
      txtGps = 'Ma position : ' + A.quartier + (A.prec ? ' (± ' + A.prec + ' m)' : '');
    } else if (S.ui.posGps) {
      var qGps = Moteur.quartierLePlusProche(S.ui.posGps.lat, S.ui.posGps.lon, quartiers());
      if (qGps && qGps.quartier) txtGps = 'Utiliser ma position (' + qGps.quartier.quartier + ')';
    }
    var styleGps = 'margin-bottom:10px;' + (estGps ? ' border-color: var(--primaire); background: rgba(16,185,129,0.08); font-weight: 600;' : '');
    var blocBoutonGps = '<button class="bouton bouton-large' + (estGps ? ' actif' : '') + '" type="button" data-a="localiser" style="' + styleGps + '">' +
      icone('cible') + '<span>' + esc(txtGps) + '</span></button>';

    var valQuartier = (A.src === 'quartier' && A.quartier) ? A.quartier : '';
    var libelleQuartier = valQuartier || 'Choisir un autre quartier…';
    var blocSelecteurQuartier = '<div class="champ"><span>Ou choisir un quartier</span>' + selecteurListe('autourQuartier', {
      titre: 'Choisir un quartier',
      valeur: valQuartier,
      vide: libelleQuartier,
      sections: sectionsQuartiers(),
      appliquer: function (v) {
        var q = quartiers().filter(function (x) { return x.quartier === v; })[0];
        if (q) {
          S.ui.autour.lat = q.lat;
          S.ui.autour.lon = q.lon;
          S.ui.autour.label = q.quartier;
          S.ui.autour.quartier = q.quartier;
          S.ui.autour.commune = q.commune;
          S.ui.autour.src = 'quartier';
          S.ui.autour.prec = null;
          LS.set('autour', S.ui.autour);
          rendre();
        }
      }
    }) + '</div>';

    var blocRayon = '<div class="champ" style="margin:0"><span>Rayon</span>' + segment('Rayon', 'autourRayon', RAYONS.map(function (r) { return [String(r), String(r).replace('.', ',') + ' km']; }), String(A.rayon), 'margin:0') + '</div>';

    if (S.ui.pharmaciesProches) {
      // raccourci « Pharmacie » : juste la position et le rayon, les résultats tout de suite
      h += '<section class="bloc compact">' + blocBoutonGps + blocSelecteurQuartier + blocRayon + '</section>'; // 3.27.38


    } else {
    h += '<section class="bloc">' +
      '<div class="segment" role="group" aria-label="Moment">' +
        '<button type="button" data-a="autourMoment" data-v="maintenant" aria-pressed="' + (A.moment === 'maintenant') + '">Maintenant</button>' +
        '<button type="button" data-a="autourMoment" data-v="choisir" aria-pressed="' + (A.moment === 'choisir') + '">Autre moment</button></div>' +
      (A.moment === 'choisir' ? '<div class="grille-2"><label class="champ"><span>Date</span><input type="date" data-f="autour" data-k="date" value="' + esc(A.date || prochainJourOuvre(aujourdhui())) + '"></label>' +
        '<label class="champ"><span>Heure (vide : toute la journée)</span><input type="time" data-f="autour" data-k="heure" value="' + esc(A.heure) + '"></label></div>' : '') +
      blocBoutonGps + blocSelecteurQuartier + blocRayon + '</section>';



    h += barreFiltres(S.ui.filtres, '', true);
    }

    if (S.ui.localisation && A.lat === null) return fin(h + '<div class="vide"><strong>Recherche de votre position…</strong>Les résultats s\'affichent dès qu\'elle est trouvée.</div>');
    if (A.lat === null) return fin(h + '<div class="vide"><strong>Où êtes-vous ?</strong>Utilisez votre position ou choisissez un quartier.</div>');
    var date, minute;
    if (A.moment === 'maintenant') { date = aujourdhui(); minute = minutesMaintenant(); }
    else { date = A.date || prochainJourOuvre(aujourdhui()); minute = heureVersMinutes(A.heure); }
    if (jourSemaineIndex(date) > 4) {
      return fin(h + '<div class="vide"><strong>Pas de présences le week-end</strong>Médecins et pharmacies sont affichés du lundi au vendredi. Choisissez « Autre moment » et un jour de semaine.</div>');
    }
    h += bandeauFeries([date]);
    var fa = S.ui.pharmaciesProches ? S.ui.filtresAutour : S.ui.filtres, filtre = criteresActifs(fa).length ? ensemble(filtrerPraticiens(fa, '').map(function (p) { return p.code; })) : null;
    // 3.25.8 : ceux déjà dans ma tournée ce jour-là sont omis
    var dansTournee = ensemble(S.plan.filter(function (a) { return a.date === date; }).map(function (a) { return a.code; }));
    var res = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, A.rayon)
      .filter(function (x) { return (!A.ref || x.c.code !== A.ref.code) && (!filtre || filtre[x.c.code]) && !dansTournee[x.c.code]; });
    S.ui.resAutour = res;
    // 3.25.15 : à 0,5 km (proximité immédiate), seulement ceux présents maintenant
    var immediat = +A.rayon === 0.5 && minute !== null;
    if (immediat) res = res.filter(function (x) { return x.etat === 'present'; }), S.ui.resAutour = res;
    var groupes = minute === null ? [['matin', 'Le matin'], ['soir', 'Le soir']] :
      (immediat ? [['present', 'Présents maintenant']] : [['present', 'Présents maintenant'], ['plustard', 'Plus tard dans la journée']]);
    h += '<p class="discret">' + majuscule(dateLongue(date)) + (minute !== null ? ', ' + minutesVersHeure(minute) : '') +
      ', autour de ' + esc(A.src === 'quartier' ? (A.quartier || A.label) : (A.quartier ? A.quartier + ' (ma position)' : (A.label || 'votre position'))) + (A.src === 'gps' && A.prec ? ' (précision ± ' + A.prec + ' m)' : '') + ' : ' + res.length + (fa.type === 'Pharmacie' ? ' pharmacie' : (fa.type === 'Médecin' ? ' médecin' : ' praticien')) + (res.length > 1 ? 's' : '') + '.</p>';
    groupes.forEach(function (g) {
      var l = res.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.etat === g[0]; });
      h += '<h3>' + g[1] + ' (' + l.length + ')</h3>';
      if (!l.length) { h += '<p class="discret">Aucun ' + (S.ui.pharmaciesProches === 'Pharmacie' ? 'pharmacie' : 'praticien') + ' dans ce rayon.</p>'; return; }
      h += '<ul class="liste">' + l.slice(0, 25).map(function (o) { return rendreProposition(o.x, o.i, date); }).join('') + '</ul>';
    });
    // 3.25.10 : rien dans le rayon : les plus proches au-delà, pour ne jamais laisser la page vide
    if (!res.length) {
      var plus = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, Infinity)
        .filter(function (x) { return (!A.ref || x.c.code !== A.ref.code) && (!filtre || filtre[x.c.code]) && !dansTournee[x.c.code]; }).slice(0, 5);
      var base = S.ui.resAutour.length;
      S.ui.resAutour = S.ui.resAutour.concat(plus);
      if (plus.length) h += '<h3>Les plus proches, au-delà de ' + String(A.rayon).replace('.', ',') + ' km</h3><ul class="liste">' + plus.map(function (x, k) { return rendreProposition(x, base + k, date); }).join('') + '</ul>';
    }
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
    return fin(h);
  };

  function prochaineOccurrence(jourIdx, depuis, memeJourPossible) {
    var delta = jourIdx - jourSemaineIndex(depuis);
    if (delta < 0 || (delta === 0 && !memeJourPossible)) delta += 7;
    return ajouterJours(depuis, delta);
  }

  // 3.18.0 : type de praticien en couleur (médecin bleu, pharmacie violet), avec le mot pour ne pas dépendre de la couleur
  function estPharmacie(o) { var t = o && (o.type || (praticien(o.code) || {}).type); return t === 'Pharmacie'; }
  // 3.23.1 : le type se lit par un symbole et une couleur : caducée du médecin (bâton d'Asclépios, bleu),
  // coupe d'Hygie de la pharmacie (violet) ; le mot reste lu par les lecteurs d'écran
  function pastilleType(o, grand) {
    var ph = estPharmacie(o), lib = ph ? 'Pharmacie' : 'Médecin';
    return '<i class="type-pastille ' + (ph ? 't-pharma' : 't-med') + (grand ? ' grand' : '') + '" role="img" aria-label="' + lib + '" title="' + lib + '">' + icone(ph ? 'pharmacie' : 'medecin') + '</i>';
  }
  // 3.23.4 : pas de doublon sous le titre : le lieu n'est pas répété quand c'est le nom (pharmacies),
  // et « Pharmacien » n'est pas écrit (le symbole de la pharmacie le dit)
  function lieuAffiche(a) {
    var l = normaliser(nomSansType(a.lieu)), n = normaliser(nomSansType(a.nom));
    return !l || l === n || n.indexOf(l) >= 0 || l.indexOf(n) >= 0 ? '' : a.lieu;
  }
  // sous-titre sans redite : pas de spécialité pour une pharmacie, rien de ce que le nom dit déjà
  function infosSansDoublon(o, l) {
    var n = normaliser(nomSansType(o.nom)), ph = estPharmacie(o), vus = {};
    return l.filter(function (x, i) {
      if (!x || (i === 0 && ph && x === o.specialite)) return false;
      var k = normaliser(nomSansType(x));
      if (!k || vus[k] || n.indexOf(k) >= 0 || k.indexOf(n) >= 0) return false;
      vus[k] = true; return true;
    }).join(', ');
  }
  // 3.25.37 : Carte médecin dans Journée -> Spécialité en premier, avant l'hôpital, puis secteur sans double espace
  function lieuQuartier(a) {
    if (!estPharmacie(a)) {
      var parts = [];
      if (a.specialite) parts.push(abrSpec(a.specialite));
      var hop = abregerHopital(a.lieu || lieuAffiche(a));
      if (hop) parts.push(hop);
      var q = (typeof nomSecteur === 'function' ? nomSecteur(a.quartier, a.commune, a.coord) : a.quartier) || a.quartier;
      if (q && (!hop || hop.toLowerCase().indexOf(q.toLowerCase()) < 0)) parts.push(q);
      return parts.join(' · ').replace(/\s{2,}/g, ' ').trim();
    }
    var n = normaliser(a.nom), q = a.quartier && n.indexOf(normaliser(a.quartier)) >= 0 ? '' : a.quartier;
    return [lieuAffiche(a), q].filter(Boolean).join(', ').replace(/\s{2,}/g, ' ').trim();
  }
  function specGras(a, txt) {
    var s = !estPharmacie(a) && a.specialite ? abrSpec(a.specialite) : '';
    return s && txt.indexOf(s) === 0 ? '<b>' + esc(s) + '</b>' + esc(txt.slice(s.length)) : esc(txt);
  }
  function lieuEtSpec(a) {
    if (!estPharmacie(a)) {
      var parts = [];
      if (a.specialite) parts.push(abrSpec(a.specialite));
      var hop = abregerHopital(a.lieu || lieuAffiche(a));
      if (hop) parts.push(hop);
      return parts.join(' · ').replace(/\s{2,}/g, ' ').trim();
    }
    return String(lieuAffiche(a) || '').replace(/\s{2,}/g, ' ').trim();
  }
  function nomSansType(nom) { return String(nom || '').replace(/^\s*pharmacie\s+/i, ''); }
  function metres(km) {
    if (km <= 0.035) return 'sur place (< 35 m)';
    var m = Math.max(10, Math.round(km * 100) * 10);
    return m <= 30 ? 'sur place (< 30 m)' : m + ' mètres';
  }
  function classeType(o) {
    var c = estPharmacie(o) ? ' t-pharma' : ' t-med';
    if (!o) return c;
    var conv = o.conventionne !== undefined ? o.conventionne : ((praticien(o.code) || {}).conventionne);
    if (!estPharmacie(o) && estConventionne(conv)) c += ' med-engage';
    return c;
  }
  function rendreProposition(x, i, date, src, avecDist) {
    var c = x.c, p = c.prat;
    var deja = S.plan.some(function (a) { return a.date === date && a.code === p.code; });
    return '<li class="element' + classeType(p) + '"><div class="element-tete"><div>' +
      '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
      '<span class="discret bloc-texte">' + esc(infosSansDoublon(p, [p.specialite, c.lieu])) + '</span>' +
      '<span class="discret bloc-texte">' + esc(c.quartier) + ', ' + c.creneau.toLowerCase() + ' ' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '</span>' +
      '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere, date)) + '</span>' +
      etiquetteCollegues(p.code, date) + '</span></div>' +
      '<div class="element-mesure">' + (avecDist === false ? '' : distMoi(x.dist, c.coord && c.coord.approx)) +
        (avecDist !== false && c.coord && c.coord.approx ? '<small>quartier</small>' : '') + '<small>score ' + Math.round(x.score) + '</small></div></div>' +
      (avecDist !== false && c.coord && gpsPrecis() && (c.coord.approx || x.dist <= 2.5) ? '<p class="discret pos-approx">' + (c.coord.approx ? 'Position du lieu non enregistrée (centre du quartier). ' : 'Vous êtes devant mais la distance est fausse ? ') +
        '<button type="button" class="bouton-texte" data-a="posLieuIci" data-v="' + esc(c.cle) + '">' + icone('cible') + 'Je suis devant : enregistrer sa position</button></p>' : '') +
      (deja ? '<p class="discret" style="margin:8px 0 0">Déjà dans votre tournée ce jour-là.</p>' :
        '<div class="rangee" style="margin-top:10px"><a class="bouton" href="' + lienCarte({ lat: c.coord && c.coord.lat, lon: c.coord && c.coord.lon }) + '" target="_blank" rel="noopener">' + icone('carte') + 'Y aller</a>' +
        '<button class="bouton bouton-plein" type="button" data-a="ajouterAutour" data-i="' + i + '"' + (src ? ' data-s="' + src + '"' : '') + ' data-d="' + date + '">' + icone('plus') + (date === aujourdhui() ? 'Aujourd\'hui' : dateCourte(date)) + '</button></div>') +
      '</li>';
  }

  // ------------------------------------------------------------------ Vue : équipe (moi et mes collègues, jour ou semaine au choix)
  // Planifié : tournées (téléphone pour moi, feuille Plannings pour tous) ; fait : comptes rendus (Historique et file d'envoi)
  function donneesEquipe(dates) {
    var dd = ensemble(dates), nomMoi = moi() || 'Moi', l = [], cles = {};
    var hist = (S.queue || []).concat((S.data && S.data.historique) || []), parUid = {};
    hist.forEach(function (v) { if (v.uid && !parUid[v.uid]) parUid[v.uid] = v; });
    var miennesLocales = ensemble(S.plan.map(function (a) { return a.date; }));
    function ajouter(x) {
      var k = (x.delegue || '') + '|' + x.date + '|' + x.code;
      if (cles[k]) return; cles[k] = true; l.push(x);
    }
    S.plan.forEach(function (a) {
      if (!dd[a.date]) return;
      var v = parUid[a.uid];
      ajouter(Object.assign({}, a, { delegue: nomMoi, programme: jourConfirme(a.date) ? 'Validé' : 'Proposition',
        statut: v ? v.statut : (a.etat === 'valide' ? a.statut : ''), compte: v ? v : (a.etat === 'valide' ? a : null) }));
    });
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (!dd[p.date] || !p.delegue) return;
      if (estMoi(p.delegue) && miennesLocales[p.date]) return;   // ma version du téléphone est la plus récente
      var v = p.uid ? parUid[p.uid] : null, st = v ? v.statut : (p.statut === 'À faire' ? '' : p.statut);
      ajouter(Object.assign({}, p, { delegue: estMoi(p.delegue) ? nomMoi : p.delegue, statut: st || '', compte: v || null }));
    });
    // visites faites hors tournée publiée (ajouts, anciennes tournées)
    hist.forEach(function (v) {
      var d = String(v.date || '').slice(0, 10);
      if (!dd[d] || !v.delegue) return;
      var x = Object.assign({}, v, { date: d, delegue: estMoi(v.delegue) ? nomMoi : v.delegue, heure: '', programme: '', compte: v, horsTournee: true });
      ajouter(x);
    });
    return l;
  }
  function decalerEquipe(sens) {
    var p = S.ui.eqPortee, d = S.ui.eqDate || aujourdhui();
    S.ui.eqDate = ajouterJours(d, (p === 'semaine' ? 7 : 1) * sens);
    if (p === 'jour') { while (jourSemaineIndex(S.ui.eqDate) > 4) S.ui.eqDate = ajouterJours(S.ui.eqDate, sens); }
    S.ui.jourEquipe = null; LS.set('eqDate', S.ui.eqDate); rendre();
  }

  VUES.equipe = function (integre) {
    var nomMoi = moi() || 'Moi', p = S.ui.eqPortee || 'semaine', ref = S.ui.eqDate || aujourdhui();
    var dates = p === 'semaine' ? joursOuvres(lundiDe(ref)) : [ref];
    var h = (integre ? '' : '<h2 class="titre-vue">Équipe</h2>') + barreQuiQuand('equipe') +
      (ref !== aujourdhui() ? '<p class="discret" style="margin:-4px 0 10px"><button type="button" class="bouton-texte" data-a="eqAujourdhui">Revenir à aujourd\'hui</button></p>' : '');

    var tout = donneesEquipe(dates);
    var noms = Array.from(new Set(tout.map(function (x) { return x.delegue; }))).sort(function (a, b) {
      return (a === nomMoi ? -1 : b === nomMoi ? 1 : a.localeCompare(b, 'fr'));
    });
    if (!noms.length) return h + '<div class="vide"><strong>Rien sur cette période</strong>Aucune visite planifiée ni réalisée. Choisissez une autre date.</div>';
    var fait = function (x) { return x.statut && Moteur.estVisite(x.statut, statuts()); };
    var nonFait = function (x) { return x.statut && !Moteur.estVisite(x.statut, statuts()); };
    // synthèse par délégué
    var ligne = function (n, l) {
      var conf = l.some(function (x) { return x.programme === 'Validé'; }), nf = l.filter(fait).length, nk = l.filter(nonFait).length, prevu = l.filter(function (x) { return !x.horsTournee; }).length;
      var com = Array.from(new Set(l.map(function (x) { return x.commune; }).filter(Boolean)));
      return '<li><button type="button" data-a="collegue" data-v="' + esc(n) + '" aria-pressed="' + (n === '__tous' ? !sel.length : sel.indexOf(n) >= 0) + '">' +
        '<b>' + esc(n === '__tous' ? 'Toute l\'équipe' : n) + (n === nomMoi ? ' (moi)' : '') + '</b>' +
        (n === '__tous' ? '' : '<span class="etiquette ' + (conf ? 'ok' : '') + '">' + (conf ? 'Tournée confirmée' : (prevu ? 'Brouillon' : 'Hors tournée')) + '</span>') +
        '<span class="discret bloc-texte">' + prevu + ' planifiée' + (prevu > 1 ? 's' : '') + ', ' + nf + ' faite' + (nf > 1 ? 's' : '') +
        (nk ? ', ' + nk + ' non faite' + (nk > 1 ? 's' : '') : '') + (com.length ? ' · ' + esc(libelleCommunes(com)) : '') + '</span></button></li>';
    };
    // sélection : aucun = toute l'équipe ; un ou plusieurs délégués isolés
    var fq = S.ui.fq, sel = fq.qui === 'tous' ? [] : (fq.qui === 'moi' ? [nomMoi] : fq.liste.slice()).filter(function (n) { return noms.indexOf(n) >= 0; });
    if (fq.qui !== 'tous' && !sel.length) return h + '<div class="vide"><strong>Rien sur cette période</strong>Aucune visite pour ' + esc(libelleQui()) + '. Choisissez d\'autres délégués ou une autre date.</div>';
    if (noms.length === 1) sel = [];
    var tous = !sel.length, libSel = tous ? 'Toute l\'équipe' : sel.join(', ');
    if (!tous) {
      h += '<div style="margin:4px 0 8px"><button type="button" class="bouton-texte" data-a="collegueTous">← Revenir à toute l\'équipe</button></div>';
    }
    h += '<ul class="liste resume-equipe">' + noms.map(function (n) { return ligne(n, tout.filter(function (x) { return x.delegue === n; })); }).join('') + '</ul>';

    var siens = tous ? tout : tout.filter(function (x) { return sel.indexOf(x.delegue) >= 0; });
    // semaine : un jour à la fois
    var jour = ref;
    if (p === 'semaine') {
      if (!S.ui.jourEquipe || dates.indexOf(S.ui.jourEquipe) < 0) {
        var t = aujourdhui();
        S.ui.jourEquipe = dates.indexOf(t) >= 0 ? t : (dates.filter(function (d) { return siens.some(function (x) { return x.date === d; }); })[0] || dates[0]);
      }
      jour = S.ui.jourEquipe;
      h += '<div class="jours" role="group" aria-label="Jour">' + dates.map(function (d) {
        var l = siens.filter(function (x) { return x.date === d; }), nf = l.filter(fait).length;
        return '<button type="button" class="jour' + (d === aujourdhui() ? ' aujourdhui' : '') + '" data-a="jourEquipe" data-v="' + d + '" aria-pressed="' + (d === jour) +
          '"><b>' + JOURS_COURTS[jourSemaineIndex(d)].replace('.', '') + ' ' + (+d.slice(8)) + '</b><small>' + (nf ? nf + '/' : '') + l.length + ' visite' + (l.length > 1 ? 's' : '') + '</small></button>';
      }).join('') + '</div>';
    }
    var duJour = siens.filter(function (x) { return x.date === jour; });
    var nf = duJour.filter(fait).length;
    h += '<p class="bilan-jour"><b>' + esc(libSel) + '</b>, ' + dateLongue(jour) + ' : ' + duJour.length +
      ' visite' + (duJour.length > 1 ? 's' : '') + ', ' + nf + ' faite' + (nf > 1 ? 's' : '') + '.</p>';
    if (!duJour.length) h += '<p class="discret">Rien de planifié ni de réalisé ce jour-là.</p>';
    // « Toute l'équipe » : une tournée par délégué, l'une sous l'autre
    // plusieurs délégués : un bloc repliable par délégué (ouvert par défaut quand on les a choisis, replié pour toute l'équipe)
    var groupesDel = (tous && noms.length > 1) || sel.length > 1 ? noms.filter(function (n) { return (tous || sel.indexOf(n) >= 0) && duJour.some(function (x) { return x.delegue === n; }); }) : [null];
    var ouverts = S.ui.eqOuverts || (S.ui.eqOuverts = {});
    groupesDel.forEach(function (del) {
    var sesVisites = del ? duJour.filter(function (x) { return x.delegue === del; }) : duJour;
    if (del) {
      var ouvert = ouverts[del] !== undefined ? ouverts[del] : !tous, nfD = sesVisites.filter(fait).length;
      h += '<button type="button" class="groupe-delegue" data-a="eqBascule" data-v="' + esc(del) + '" aria-expanded="' + ouvert + '"><b>' + esc(del) + (del === nomMoi ? ' (moi)' : '') + '</b>' +
        '<small>' + sesVisites.length + ' visite' + (sesVisites.length > 1 ? 's' : '') + ', ' + nfD + ' faite' + (nfD > 1 ? 's' : '') + '</small>' + icone('chevron') + '</button>';
      if (!ouvert) return;
    }
    ['Matin', 'Soir', ''].forEach(function (cren) {
      var liste = sesVisites.filter(function (x) { return cren ? x.creneau === cren : (x.creneau !== 'Matin' && x.creneau !== 'Soir'); })
        .sort(function (a, b) { return String(a.heure || a.debut || '').localeCompare(String(b.heure || b.debut || '')) || String(a.delegue).localeCompare(String(b.delegue)); });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + (cren || 'Autres visites') + '</div><ol class="ligne">';
      liste.forEach(function (x) {
        var ko = nonFait(x), v = x.compte;
        var e = '';
        e += x.statut ? '<span class="etiquette ' + (ko ? 'ko' : 'ok') + '">' + esc(x.statut) + '</span>' : (jour < aujourdhui() ? '<span class="etiquette alerte">Sans compte rendu</span>' : '<span class="etiquette">Prévue</span>');
        if (x.horsTournee) e += '<span class="etiquette">Hors tournée</span>';
        h += '<li class="arret' + (x.statut ? (ko ? ' absent' : ' fait') : '') + '" data-p="' + (+x.note === 3 ? 1 : 3) + '">' +
          '<div class="arret-heure"><b>' + esc(x.heure || '--:--') + '</b><small>' + esc(x.debut || '') + (x.fin ? '-' + esc(x.fin) : '') + '</small></div>' +
          '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
          '<div><div class="arret-carte"><span class="arret-nom">' + esc(x.nom) + ' ' + etoiles(x.note) + '</span>' +
          '<span class="arret-lieu">' + esc(x.specialite || '') + (x.lieu ? ', ' + esc(x.lieu) : '') + '</span>' +
          '<span class="arret-lieu">' + esc(x.quartier || '') + (x.commune ? ', ' + esc(x.commune) : '') + '</span>' +
          '<span class="etiquettes">' + e + '</span>' +
          (v && (v.activite || v.produits || v.commentaire) ? '<span class="discret bloc-texte" style="margin-top:6px">' +
            [v.activite ? listeActivites(v.activite).join(', ') : '', v.produits ? 'Produits : ' + v.produits : '', v.commentaire || ''].filter(Boolean).map(esc).join(' · ') + '</span>' : '') +
          '</div></div></li>';
      });
      h += '</ol>';
    });
    });
    // carte du jour, tout en bas
    var pos = duJour.map(function (x) {
      var c = x.idPresence && ctx().parCode[x.code] ? ctx().parCode[x.code].filter(function (k) { return String(k.idPresence) === String(x.idPresence); })[0] : null;
      var co = c && c.coord ? c.coord : (x.lat && x.lon ? { lat: +x.lat, lon: +x.lon } : null);
      return co ? { lat: co.lat, lon: co.lon, nom: ((tous || sel.length > 1) ? x.delegue + ' : ' : '') + x.nom, lieu: x.lieu, heure: x.heure } : null;
    }).filter(Boolean);
    if (pos.length) {
      h += '<h3>Carte de la journée</h3><div class="carte-l" id="carteEquipe"></div>';
      cartesAFaire.push((tous || sel.length > 1) ? { id: 'carteEquipe', equipe: pos.map(function (q) { return { lat: q.lat, lon: q.lon, nom: q.nom, delegue: '' }; }) } : { id: 'carteEquipe', route: pos });
    }
    if (ref < ajouterJours(aujourdhui(), -60)) h += '<p class="discret">Les tournées sont conservées 62 jours ; au-delà, seules les visites faites restent visibles.</p>';
    return h;
  };

  // ------------------------------------------------------------------ Vue : contacts (filtres avancés cumulables)
  function ensemble(l) { var o = {}; (l || []).forEach(function (x) { o[x] = true; }); return o; }
  function aRevoir(p) {
    if (p.prochaine && p.prochaine <= ajouterJours(aujourdhui(), 7)) return true;
    return !!p.statut && (estKo(p.statut) || /rappeler|interess|report/.test(normaliser(p.statut)));
  }
  function filtrerPraticiens(f, texte) {
    var t = aujourdhui(), c = ctx(), q = normaliser(texte || '');
    var sp = ensemble(f.specialites), co = ensemble(f.communes), po = ensemble(f.potentiels);
    return Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
      if (f.type !== 'tous' && p.type !== f.type) return false;
      // spécialités médicales : appliquées aux médecins seulement, sans effet sur les pharmacies (conservées pour « Médecins »)
      if (f.specialites.length && p.type !== 'Pharmacie' && !sp[p.specialite]) return false;
      if (f.potentiels.length && !po[lettrePotentiel(p.note)]) return false;
      if (f.conv === 'oui' && !p.conv) return false;
      if (f.conv === 'non' && p.conv) return false;
      var lieux = c.presencesParCode[p.code] || [];
      if (f.communes.length && !lieux.some(function (x) { return typeof communeCorrespondante === 'function' ? communeCorrespondante(x, co) : co[x.commune]; })) return false;
      if (f.visite !== 'tous') {
        var derDate = p.derniere;
        if (!derDate && S.data && S.data.historique) {
          S.data.historique.forEach(function (hv) {
            if (hv.code === p.code && hv.date && (!derDate || hv.date > derDate)) {
              derDate = String(hv.date).slice(0, 10);
            }
          });
        }
        if (typeof S !== 'undefined' && S.queue && S.queue.length) {
          S.queue.forEach(function (qv) {
            if (qv.code === p.code && qv.date && (!derDate || qv.date > derDate)) {
              derDate = String(qv.date).slice(0, 10);
            }
          });
        }
        var j = derDate ? joursEcoules(derDate, t) : Infinity;
        if (f.visite === '30' && j <= 30) return false;
        if (f.visite === 'recent' && (!derDate || j > 30)) return false;
        if (f.visite === 'jamais' && derDate) return false;
        if (f.visite === 'retard' && j < REGLAGES_MOTEUR.cadence[p.note]) return false;
        if (f.visite === 'revoir' && !aRevoir(p)) return false;
      }
      if (f.equipe !== 'tous' && (f.equipe === 'oui') !== (cibleParCollegues(p.code, t).length > 0)) return false;
      if (!q) return true;

      // 3.25.33 : Recherche dans le Répertoire ciblée sur le praticien
      // 1. Recherche par nom (Dr Kouassi, etc.) ou code (MED-xxx)
      var nomNorm = normaliser(p.nom || '');
      if (nomNorm.indexOf(q) >= 0 || normaliser(p.code || '').indexOf(q) >= 0) return true;

      // 2. Recherche par spécialité (ex: "cardio")
      if (normaliser(p.specialite || '').indexOf(q) >= 0) return true;

      // 3. Lieux / Communes / Quartiers : uniquement à partir de 4 caractères
      // (évite que taper 'kou' pour chercher Kouassi ramène tous les praticiens de Koumassi sans ce nom)
      if (q.length >= 4) {
        var txtLieux = lieux.map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
        var mots = normaliser(txtLieux).split(' ');
        if (mots.some(function (w) { return w.indexOf(q) === 0; })) return true;
      }
      return false;
    });
  }
  var LIB_VISITE = { '30': 'Non visité depuis +30 j', recent: 'Visité -30 j', jamais: 'Jamais visité',
                     retard: 'En retard', revoir: 'À revoir' };
  // Liste des critères actifs : [clé, valeur, libellé]
  function criteresActifs(f) {
    var l = [];
    if (f.type !== 'tous') l.push(['type', f.type, f.type === 'Pharmacie' ? 'Pharmacies' : 'Médecins']);
    f.potentiels.forEach(function (x) { l.push(['potentiels', x, ETOILES[x]]); });
    if (f.type !== 'Pharmacie' && !sontToutesSpecialites(f.specialites)) f.specialites.forEach(function (x) { l.push(['specialites', x, x]); });
    f.communes.forEach(function (x) { l.push(['communes', x, x]); });
    if (f.visite !== 'tous') l.push(['visite', f.visite, LIB_VISITE[f.visite]]);
    if (f.conv !== 'tous') l.push(['conv', f.conv, f.conv === 'oui' ? 'Engagés' : 'Non engagés']);
    if (f.equipe !== 'tous') l.push(['equipe', f.equipe, f.equipe === 'oui' ? 'Ciblés par l\'équipe' : 'Non ciblés par l\'équipe']);
    return l;
  }
  var FILTRES_RAPIDES = [['potentiels', 'A', '★★★'], ['visite', 'recent', 'Visité -30 j'], ['visite', '30', 'Non visité +30 j'],
                         ['visite', 'revoir', 'À revoir'], ['visite', 'jamais', 'Jamais visité'], ['conv', 'oui', 'Engagés']];
  function estRapide(k, v) { return FILTRES_RAPIDES.some(function (x) { return x[0] === k && x[1] === v; }); }
  function filtreRapideActif(f, k, v) { return Array.isArray(f[k]) ? f[k].indexOf(v) >= 0 : f[k] === v; }
  function trierPraticiens(liste, tri) {
    var t = aujourdhui();
    return liste.sort(function (a, b) {
      if (tri === 'priorite' || tri === 'potentiel') return b.note - a.note || joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t);
      if (tri === 'retard') return joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t) || b.note - a.note;
      if (tri === 'score') return calcScore(b.note, joursEcoules(b.derniere, t), b.statut) - calcScore(a.note, joursEcoules(a.derniere, t), a.statut);
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
    });
  }

  // Barre de recherche et de filtres commune aux onglets Contacts et Autour
  // Filtres ordonnés comme un arbre de décision : Qui ? > Quelle spécialité ? > Où ? > Quelle valeur ? > Quel suivi ? (> Dans quel ordre ?)
  var QUESTIONS_FILTRES = {
    qui: { titre: 'Qui ?', cles: ['type'] },
    spec: { titre: 'Quelle spécialité ?', cles: ['specialites'] },
    com: { titre: 'Où ?', cles: ['communes'] },
    valeur: { titre: 'Quelle valeur ?', cles: ['potentiels', 'conv'] },
    suivi: { titre: 'Quel suivi ?', cles: ['visite', 'equipe'] },
    ordre: { titre: 'Dans quel ordre ?', cles: [] }
  };
  // Critères posés une question à la fois, comme le compte rendu : les réponses données se replient en une ligne,
  // seule la question en cours est ouverte ; une fois toutes répondues, une seule ligne résume l'ensemble.
  S.ui.etapesF = LS.get('etapesFiltres', {});
  S.ui.rechOuverte = LS.get('rechOuverte', false);
  // dernière question répondue sur la page de recherche : retour aux résultats (les critères se replient en une phrase)
  function finRecherche() {
    if (S.ui.tab !== 'praticiens' || !S.ui.rechOuverte) return false;
    var et = etatEtapes();
    if (!etapesFiltres(S.ui.filtres).every(function (e) { return et.ok[e.id]; })) return false;
    S.ui.rechOuverte = false; LS.set('rechOuverte', false); rendre(); window.scrollTo(0, 0); return true;
  }
  function etatEtapes() { var k = cleFiltres(); return S.ui.etapesF[k] || (S.ui.etapesF[k] = { ok: {} }); }
  function sauverEtapes() { LS.set('etapesFiltres', S.ui.etapesF); }
  function puceEtape(k, v, lib, actif, m, auto) {
    return '<button type="button" class="puce" data-a="etapeFiltre" data-k="' + k + '" data-v="' + esc(v) + '" data-m="' + (m ? 1 : 0) + '"' + (auto ? ' data-auto="' + auto + '"' : '') +
      ' aria-pressed="' + actif + '">' + esc(lib) + '</button>';
  }
  function memeEnsembleSpecs(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    var sa = a.filter(function (x) { return x && x !== 'Pharmacien'; }).sort();
    var sb = b.filter(function (x) { return x && x !== 'Pharmacien'; }).sort();
    if (sa.length !== sb.length) return false;
    for (var i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }

  function etapesFiltres(f) {
    var vis = [['tous', 'Toutes'], ['recent', 'Visité -30 j'], ['30', 'Non visité +30 j'], ['jamais', 'Jamais visité'], ['retard', 'En retard'], ['revoir', 'À revoir']];
    var l = [
      { id: 'qui', auto: true, resume: function () { return f.type === 'Pharmacie' ? 'Pharmacies' : (f.type === 'Médecin' ? 'Médecins' : 'Médecins et pharmacies'); },
        rendu: function () {
          return '<div class="puces">' + [['Médecin', 'Médecins'], ['Pharmacie', 'Pharmacies'], ['tous', 'Tous']].map(function (x) { return puceEtape('type', x[0], x[1], f.type === x[0], false, 'qui'); }).join('') + '</div>' +
            '<p class="discret raccourcis-titre-etape">Ou directement un raccourci :</p><div class="puces">' + FILTRES_RAPIDES.map(function (x) {
              return '<button type="button" class="puce petite" data-a="filtreRapide" data-fin="1" data-k="' + x[0] + '" data-v="' + x[1] + '" aria-pressed="' + filtreRapideActif(f, x[0], x[1]) + '">' + esc(x[2]) + '</button>';
            }).join('') + '</div>';
        } },
      { id: 'spec', si: f.type !== 'Pharmacie', resume: function () {
          if (!f.specialites.length) return 'Toutes';
          if (memeEnsembleSpecs(f.specialites, coeurDeCible())) return 'Cœur de cible';
          if (sontToutesSpecialites(f.specialites)) return 'Toutes';
          return f.specialites.length <= 2 ? f.specialites.map(abrSpec).join(', ') : f.specialites.slice(0, 2).map(abrSpec).join(', ') + ' +' + (f.specialites.length - 2);
        },
        rendu: function () {
          return '<p class="discret" style="margin:0 0 6px">' + (f.type === 'tous' ? 'Spécialités du cœur de cible pré-sélectionnées (les pharmacies restent affichées) :' : 'Spécialités du cœur de cible pré-sélectionnées (modifier met à jour votre cœur de cible) :') + '</p>' +
            pucesSpecialitesCible(f.specialites, 'filtreSpecToggle', 'filtreSpecToutes', 'filtreSpecCoeur', 'filtreSpecChoisir');
        } },
      { id: 'com', resume: function () { return f.communes.length ? condenserCommunesEtSecteurs(f.communes) : 'Toutes'; },
        rendu: function () {
          return '<p class="discret" style="margin:4px 0 8px">' + (f.communes.length ? esc(condenserCommunesEtSecteurs(f.communes)) : 'Toutes les communes') + '</p>' +
            '<button class="bouton petit" type="button" data-a="filtreQuestion" data-v="com">' + icone('loupe') + 'Choisir les communes</button>';
        } },
      { id: 'valeur', resume: function () {
          var r = f.potentiels.map(function (x) { return ETOILES[x]; }); if (f.conv !== 'tous') r.push(f.conv === 'oui' ? 'Engagés' : 'Non engagés');
          return r.length ? r.join(' · ') : 'Tous'; },
        rendu: function () {
          return '<span class="sous-etape">Potentiel</span><div class="puces"><button type="button" class="puce puce-tous" data-a="etapeFiltre" data-k="potentiels" data-v="tous" aria-pressed="' + (!f.potentiels.length || f.potentiels.length === 3) + '">Tous</button>' +
            [['A', '★★★'], ['B', '★★'], ['C', '★']].map(function (x) { return puceEtape('potentiels', x[0], x[1], f.potentiels.indexOf(x[0]) >= 0, true); }).join('') + '</div>' +
            '<span class="sous-etape">Engagé</span><div class="puces">' + [['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']].map(function (x) { return puceEtape('conv', x[0], x[1], f.conv === x[0]); }).join('') + '</div>';
        } },
      { id: 'suivi', resume: function () {
          var r = []; if (f.visite !== 'tous') r.push(LIB_VISITE[f.visite]);
          if (f.equipe !== 'tous' && !S.config.demo) r.push(f.equipe === 'oui' ? 'Prévus par un collègue' : 'Non prévus par un collègue');
          return r.length ? r.join(' · ') : 'Tous'; },
        rendu: function () {
          return '<span class="sous-etape">Dernière visite (un seul choix)</span><div class="puces puces-suivi-visite">' + vis.map(function (x) { return puceEtape('visite', x[0], x[1], f.visite === x[0]); }).join('') + '</div>' +
            (S.config.demo ? '' : '<span class="sous-etape">Prévu par un collègue cette semaine</span><div class="puces puces-equipe-semaine">' + [['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']].map(function (x) { return puceEtape('equipe', x[0], x[1], f.equipe === x[0]); }).join('') + '</div>');
        } },
      { id: 'ordre', auto: true, si: S.ui.tab === 'praticiens', resume: function () { return TRIS.filter(function (x) { return x[0] === S.ui.tri; }).map(function (x) { return x[1]; })[0] || 'Potentiel'; },
        rendu: function () { return '<div class="puces">' + TRIS.map(function (x) { return puceEtape('tri', x[0], x[1], S.ui.tri === x[0], false, 'ordre'); }).join('') + '</div>'; } }
    ];
    return l.filter(function (e) { return e.si !== false; });
  }
  function barreFiltres(f, q, sansSaisie) {
    var h = sansSaisie ? '' : '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="recherche" placeholder="Nom, spécialité, établissement, quartier…" value="' +
        esc(q) + '" aria-label="Rechercher un praticien"></div></div>';
    var et = etatEtapes(), ok = et.ok, etapes = etapesFiltres(f), n = etapes.length;
    var enCours = etapes.filter(function (e) { return !ok[e.id]; })[0];
    function ligne(e) {
      return '<button type="button" class="cr-fait" data-a="etapeEditer" data-v="' + e.id + '"><span>' + QUESTIONS_FILTRES[e.id].titre + '</span><b>' + esc(e.resume()) + '</b>' + icone('crayon') + '</button>';
    }
    h += '<div class="cr-pas etapes-filtres">';
    if (!enCours) {
      // tout est répondu : une seule ligne, dépliable pour modifier une réponse
      if (et.ouvert) h += etapes.map(ligne).join('') + '<button type="button" class="bouton-texte" data-a="etapesBascule">Replier les critères</button>';
      else h += '<button type="button" class="cr-fait criteres-resume" data-a="etapesBascule"><span>Critères</span><b>' +
        esc(etapes.map(function (e) { return e.id === 'ordre' ? 'tri par ' + e.resume().toLowerCase() : e.resume(); }).filter(function (x) { return x !== 'Toutes' && x !== 'Tous'; }).join(' · ') || 'Aucun') + '</b>' + icone('crayon') + '</button>';
      return h + '</div>';
    }
    etapes.forEach(function (e, i) {
      if (ok[e.id]) { h += ligne(e); return; }
      if (e !== enCours) return;
      h += '<div class="cr-question"><span class="etape-titre">' + QUESTIONS_FILTRES[e.id].titre + ' <small>étape ' + (i + 1) + '/' + n + '</small></span>' + e.rendu();
      h += boutonsEtape(i > 0 ? 'etapePrec' : '', i > 0 ? etapes[i - 1].id : '', e.auto ? '' : 'etapePasser', 'etapeOk', e.id, i === n - 1);
      h += '</div>';
    });
    return h + '</div>';
  }

  var ABREV_SPEC = {
    'cardiologie': 'cardio',
    'cardiologue': 'cardio',
    'diabétologie': 'diabéto',
    'diabétologue': 'diabéto',
    'diabetologie': 'diabéto',
    'diabetologue': 'diabéto',
    'gynécologie': 'gynéco',
    'gynécologue': 'gynéco',
    'gynecologie': 'gynéco',
    'gynecologue': 'gynéco',
    'gynécologie obstétrique': 'gynéco-obs',
    'pédiatrie': 'pédia',
    'pédiatre': 'pédia',
    'pediatrie': 'pédia',
    'pediatre': 'pédia',
    'gastro-entérologie': 'gastro',
    'gastro-entérologue': 'gastro',
    'dermatologie': 'dermato',
    'dermatologue': 'dermato',
    'rhumatologie': 'rhumato',
    'rhumatologue': 'rhumato',
    'pneumologie': 'pneumo',
    'pneumologue': 'pneumo',
    'neurologie': 'neuro',
    'neurologue': 'neuro',
    'ophtalmologie': 'ophtalmo',
    'ophtalmologue': 'ophtalmo',
    'psychiatrie': 'psy',
    'psychiatre': 'psy',
    'urologie': 'uro',
    'urologue': 'uro',
    'néphrologie': 'néphro',
    'néphrologue': 'néphro',
    'endocrinologie': 'endocrino',
    'endocrinologue': 'endocrino',
    'orl': 'ORL',
    'oto-rhino-laryngologie': 'ORL',
    'infectiologie': 'infectio',
    'infectiologue': 'infectio',
    'médecine générale': 'MG',
    'médecin généraliste': 'MG',
    'généraliste': 'MG'
  };

  function abbrevSpec(x) {
    if (!x) return '';
    var k = String(x).toLowerCase().trim();
    if (ABREV_SPEC[k]) return ABREV_SPEC[k];
    return x;
  }

  // Résumé des critères retenus, concis et abrégé (ex. « 11 médecins · ★★★ · Cocody · > 30j sans visite »)
  function phraseCriteres(f, q, n, tri) {
    var fem = f.type === 'Pharmacie', pl = n > 1, s = pl ? 's' : '', e = fem ? 'e' : '';
    var nom = f.type === 'Pharmacie' ? 'pharmacie' : (f.type === 'Médecin' ? 'médecin' : 'praticien');
    var t = (n ? n : 'Aucun' + (fem ? 'e' : '')) + ' ' + nom + (pl ? 's' : '');
    var c = [];
    if (f.type !== 'Pharmacie') {
      if (sontToutesSpecialites(f.specialites)) {
        c.push('toutes spécialités');
      } else if (f.specialites.length) {
        t += ' ' + f.specialites.map(function (x) {
          var ab = abbrevSpec(x);
          return pl && !/[sx]$/.test(ab) && !/^[A-Z]+$/.test(ab) ? ab + 's' : ab;
        }).join(' ou ');
        if (f.type === 'tous') t += ' (+ officines)';
      }
    }
    if (f.potentiels.length) c.push(f.potentiels.map(function (x) { return ETOILES[x]; }).join('/'));
    if (f.conv !== 'tous') c.push(f.conv === 'oui' ? 'engagés' : 'non engagés');
    var vis = {
      '30': '> 30j sans visite',
      recent: '< 30j',
      jamais: 'jamais visités',
      retard: 'en retard',
      revoir: 'à revoir'
    };
    if (f.visite !== 'tous') c.push(vis[f.visite] || f.visite);
    if (f.equipe !== 'tous') c.push((f.equipe === 'oui' ? 'prévus' : 'non prévus') + ' collègue');
    if (f.communes.length) {
      var comAffiche = condenserCommunesEtSecteurs(f.communes);
      if (comAffiche) c.push(comAffiche);
    }
    if (q && String(q).trim()) c.push('« ' + String(q).trim() + ' »');
    var lt = { priorite: 'tri potentiel', score: 'tri priorité', retard: 'tri retard', nom: 'tri nom' };
    if (n > 1 && lt[tri]) c.push(lt[tri]);
    var aucunFiltre = f.type === 'tous' && (!f.communes || !f.communes.length) && (!f.potentiels || !f.potentiels.length) &&
                      f.visite === 'tous' && f.conv === 'tous' && f.equipe === 'tous' && (!q || !String(q).trim());
    if (aucunFiltre) {
      return t + ' · Toute la base de données';
    }
    if (!c.length) c.push('Toute la base de données');
    return t + ' · ' + c.join(' · ');
  }

  // 3.27.30 : Répertoire en trois annuaires (Médecins, Pharmacies, Hôpitaux) ; point de retour : avant-repertoire-annuaires
  S.ui.annuaire = LS.get('annuaire', '') === 'hop' ? 'hop' : '';
  function selecteurAnnuaire(f) {
    var prat = ctx().prat, nM = 0, nP = 0;
    Object.keys(prat).forEach(function (k) { if (prat[k].type === 'Pharmacie') nP++; else nM++; });
    var actif = S.ui.annuaire === 'hop' ? 'hop' : (f.type === 'Pharmacie' ? 'ph' : (f.type === 'Médecin' ? 'med' : ''));
    var b = function (v, lib, n) { return '<button type="button" data-a="annuaire" data-v="' + v + '" aria-pressed="' + (actif === v) + '"><b>' + lib + '</b> <span class="sa-n">' + n + '</span></button>'; };
    return '<div class="selecteur-annuaire" role="group" aria-label="Annuaire">' + b('med', 'Médecins', nM) + b('ph', 'Pharmacies', nP) + b('hop', 'Hôpitaux', hopitauxRepertoire().length) + '</div>';
  }
  // établissements (onglet Etablissements) où au moins un médecin est présent, avec leurs médecins
  function hopitauxRepertoire() {
    var c = ctx(), par = {}, l = [];
    ((S.data && S.data.etablissements) || []).forEach(function (e) {
      var nom = String(e.nom || '').trim(), k = normaliser(nom); if (!k || par[k]) return;
      par[k] = { cle: k, nom: nom, commune: e.commune || '', quartier: e.quartier || '', reperes: e.reperes || '', telephone: e.telephone || '',
        lat: parseFloat(String(e.lat || '').replace(',', '.')), lon: parseFloat(String(e.lon || '').replace(',', '.')), codes: {}, pres: [] };
    });
    ((S.data && S.data.presences) || []).forEach(function (x) {
      var p = c.prat[x.code]; if (!p || p.type === 'Pharmacie') return;
      var k = normaliser(x.lieu || ''); if (!k) return;
      var e = par[k] || (par[k] = { cle: k, nom: String(x.lieu).trim(), commune: x.commune || '', quartier: x.quartier || '', reperes: x.reperes || '', telephone: '', lat: NaN, lon: NaN, codes: {}, pres: [] });
      if (!isFinite(e.lat) && aCoord(x)) { var co = lireCoord(x); e.lat = co.lat; e.lon = co.lon; }
      if (!e.codes[x.code]) { e.codes[x.code] = true; e.pres.push(x); }
    });
    // cabinets privés d'un médecin (« Cabinet médical du Dr … ») : restent sur la fiche du médecin, pas dans l'annuaire des hôpitaux
    var cabinet = function (nom) { var x = sansAccents(nom).toLowerCase(); return /cabinet/.test(x) && /\b(dr|docteur|pr|prive)\b/.test(x); };
    Object.keys(par).forEach(function (k) {
      var it = par[k];
      if (!isFinite(it.lat) && typeof trouverEtablissementRef === 'function') {
        var ref = trouverEtablissementRef(it.nom);
        if (ref && isFinite(ref.lat)) { it.lat = ref.lat; it.lon = ref.lon; }
      }
      if (it.pres.length && !cabinet(it.nom)) l.push(it);
    });
    return l;
  }
  function vueHopitaux(f) {
    var q = normaliser(S.ui.rechHop || ''), co = ensemble(f.communes || []), g = gpsFrais(), t = aujourdhui(), jA = jourSemaineIndex(t), c = ctx();
    var debutMois = t.slice(0, 8) + '01';
    var l = hopitauxRepertoire().filter(function (e) {
      if (f.communes && f.communes.length && !communeCorrespondante(e, co)) return false;
      return !q || normaliser(e.nom + ' ' + e.quartier + ' ' + e.commune).indexOf(q) >= 0;
    });
    l.forEach(function (e) { e.d = g && isFinite(e.lat) ? distanceVol(g, { lat: e.lat, lon: e.lon }) : null; });
    l.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    var h = '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="rechHop" placeholder="Hôpital, clinique, quartier, commune…" value="' +
      esc(S.ui.rechHop || '') + '" aria-label="Rechercher un hôpital"></div></div>';
    h += '<p class="phrase-criteres" style="text-align:center">' + l.length + ' établissement' + (l.length > 1 ? 's' : '') + (f.communes && f.communes.length ? ' · ' + esc(condenserCommunesEtSecteurs(f.communes) || '') : '') + ' · de A à Z' + '</p>';
    if (!l.length) return h + '<div class="vide"><strong>Aucun établissement</strong>Aucun hôpital ne correspond à cette recherche.</div>';
    h += '<ul class="liste">';
    l.slice(0, S.ui.limite).forEach(function (e) {
      var ouvert = S.ui.hopOuvert === e.cle;
      var vus = e.pres.filter(function (x) { var p = c.prat[x.code]; return p && p.derniere && p.derniere >= debutMois; }).length;
      var ici = e.pres.filter(function (x) { return jA <= 4 && (x[JOURS_CLES[jA]] || ''); }).length;

      var aGpsHop = isFinite(e.lat) && isFinite(e.lon) && e.lat !== 0, clGps = aGpsHop ? 'gps-ok' : 'gps-non';


      var badgeGps = '<span class="etiquette etiquette-gps etiquette-gps-cliquable ' + clGps + '" data-a="capterGpsHopital" data-v="' + esc(e.cle) + '" role="button" tabindex="0" title="' + (aGpsHop ? 'GPS enregistré : toucher pour actualiser' : 'Pas de GPS : toucher pour enregistrer la position') + '" aria-label="' + (aGpsHop ? 'GPS enregistré pour ' : 'Enregistrer le GPS de ') + esc(e.nom) + '">' + icone('carte') + 'GPS</span>';
      var nTot = e.pres.length;
      var txtPres = ici + '/' + nTot + ' médecin' + (nTot > 1 ? 's' : '') + ' présent' + (ici > 1 ? 's' : '') + ' aujourd\'hui';
      var clPres = ici > 0 ? 'etiquette p1' : 'etiquette';
      h += '<li class="element element-hopital"><div class="carte-bouton" data-a="hopital" data-v="' + esc(e.cle) + '" aria-expanded="' + ouvert + '" role="button" tabindex="0">' +
        '<span class="element-titre"><i class="type-pastille t-hop" aria-hidden="true">' + icone('epingle') + '</i>' + esc(e.nom) + '</span>' +
        '<span class="discret bloc-texte">' + esc([e.quartier, e.commune].filter(Boolean).join(', ')) + (e.d !== null ? ' · ' + distMoi(e.d) : '') + '</span>' +
        '<span class="etiquettes">' + badgeGps + '<span class="' + clPres + '">' + txtPres + '</span>' +
          (vus ? '<span class="etiquette ok">' + vus + ' vu' + (vus > 1 ? 's' : '') + ' ce mois</span>' : '') +
          '</span></div>';
      if (ouvert) {
        if (e.reperes) h += '<p class="discret" style="margin:6px 0 0">' + esc(e.reperes) + '</p>';
        h += actionsRapides({ telephone: e.telephone, lat: isFinite(e.lat) ? e.lat : null, lon: isFinite(e.lon) ? e.lon : null, lieu: e.nom, quartier: e.quartier, commune: e.commune });
        var ordre = function (x) { var v = jA <= 4 ? (x[JOURS_CLES[jA]] || '') : ''; return v ? 0 : 1; };
        var meds = e.pres.slice().sort(function (a, b) { return ordre(a) - ordre(b) || (+c.prat[b.code].note || 0) - (+c.prat[a.code].note || 0) || String(c.prat[a.code].nom).localeCompare(String(c.prat[b.code].nom), 'fr'); });
        h += '<ul class="hop-medecins">' + meds.map(function (x) {
          var p = c.prat[x.code];
          var jours = JOURS_CLES.map(function (j, i) { var v = lireDispo(x[j]); return v.matin || v.soir ? JOURS[i].slice(0, 3) + ' ' + (v.matin && v.soir ? 'M+S' : (v.matin ? 'M' : 'S')) : ''; }).filter(Boolean).join(' · ');
          var auj = ordre(x) === 0;
          return '<li><button type="button" class="hop-med" data-a="hopVoirMedecin" data-v="' + esc(p.code) + '"><b>' + esc(p.nom) + '</b> ' + etoiles(p.note) + (auj ? ' <span class="etiquette p1" style="font-size:11px;padding:1px 6px;margin-left:4px;vertical-align:middle">Aujourd\'hui</span>' : '') +
            '<small>' + (p.specialite ? '<b class="spec-gras">' + esc(abrSpec(p.specialite)) + '</b>' + (jours ? ' · ' : '') : '') + esc(jours) + '</small></button>' +
            '<button type="button" class="bouton petit" data-a="planifierProchaines" data-v="' + esc(p.code) + '">Planifier</button></li>';
        }).join('') + '</ul>';
      }
      h += '</li>';
    });
    h += '</ul>';
    if (l.length > S.ui.limite) h += '<div class="rangee"><button class="bouton bouton-large" type="button" data-a="plus">Afficher plus</button></div>';
    return h;
  }
  // 3.27.37 : Disponibilité en temps réel à l'instant T pour un médecin (Présent vert / Absent rouge)
  function badgePresenceMedecin(code, p) {
    var t = aujourdhui(), jA = jourSemaineIndex(t);
    if (jA <= 4 && !estFerie(t) && !absentLe(p, t)) {
      var now = minutesMaintenant();
      var crs = (ctx().parCode[code] || []);
      for (var i = 0; i < crs.length; i++) {
        var cr = crs[i];
        if (cr.jourIdx === jA && now >= cr.debut && now <= cr.fin) {
          var lieuTxt = cr.lieu ? ' (' + abregerHopital(cr.lieu) + ')' : '';
          return '<span class="etiquette ok" title="Présent actuellement en consultation' + esc(lieuTxt) + '">Présent</span>';
        }
      }
    }
    return '<span class="etiquette ko" title="Actuellement hors créneau de consultation">Absent</span>';
  }

  VUES.praticiens = function () {
    var f = S.ui.filtres, t = aujourdhui(), c = ctx();
    var liste = trierPraticiens(filtrerPraticiens(f, S.ui.recherche), S.ui.tri);
    // la fiche ouverte (par exemple juste créée) reste en tête de liste
    var io = liste.map(function (p) { return p.code; }).indexOf(S.ui.contactOuvert);
    if (io > 0 && S.ui.contactEnTete === S.ui.contactOuvert) liste.unshift(liste.splice(io, 1)[0]);
    // 3.19.0 : les critères s'ouvrent sur une page à part (même onglet) ; dès les résultats affichés, ils disparaissent
    // au profit d'une phrase (nombre de praticiens et critères appliqués) et de « Tout effacer »
    if (S.ui.rechOuverte) {
      return '<div class="page-entree"><button type="button" class="retour" data-a="rechFermer">' + icone('chevron') + 'Répertoire</button>' +
        '<h2 class="titre-vue">Critères de recherche</h2><p class="sous-titre">Une question à la fois ; les résultats s\'affichent à la fin.</p>' +
        '<section class="bloc">' + barreFiltres(f, S.ui.recherche, true) + '</section>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="rechFermer">' + icone('loupe') + 'Voir ' + (liste.length ? 'les ' + liste.length + ' résultat' + (liste.length > 1 ? 's' : '') : 'les résultats') + '</button></div>';
    }
    var h = '<div class="tete-vue"><h2 class="titre-vue">Répertoire</h2></div>' +
      '<p class="sous-titre">Médecins, pharmacies et hôpitaux : recherchez, filtrez, mettez à jour leurs fiches.</p>';
    h += selecteurAnnuaire(f);
    if (S.ui.annuaire === 'hop') {
      if (!gpsFrais()) relocaliserSiBesoin('repertoireHop');
      return h + vueHopitaux(f);
    }
    h += '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="recherche" placeholder="Nom, spécialité, établissement, quartier…" value="' +
        esc(S.ui.recherche) + '" aria-label="Rechercher un praticien"></div></div>';
    h += '<div class="rangee-actions-rep">' +
      '<button class="bouton bouton-criteres" type="button" data-a="rechOuvrir">' + icone('filtre') + '<span>Recherche</span></button>' +
      '<button class="bouton bouton-plein bouton-ajouter-rep" type="button" data-a="nouvelleFiche">' + icone('plus') + '<span>Ajouter</span></button>' +
      (S.ui.contactOuvert
        ? '<button class="bouton bouton-modifier-rep" type="button" data-a="modifierActif">' + icone('crayon') + '<span>Modifier</span></button>'
        : '<button class="bouton bouton-modifier-rep desactive" type="button" data-a="modifierActif" style="opacity:.45" title="Touchez d\'abord un contact dans la liste">' + icone('crayon') + '<span>Modifier</span></button>') +
      '</div>';
    var aFiltres = criteresActifs(f).length > 0 || !!(S.ui.recherche && String(S.ui.recherche).trim());
    var phrase = phraseCriteres(f, S.ui.recherche, liste.length, S.ui.tri);
    h += '<div class="bandeau-criteres-rep">' +
      '<p class="phrase-criteres">' + esc(phrase) + '</p>' +
      '<div class="centre-reinit-rep">' +
        (aFiltres
          ? '<button type="button" class="bouton-reinit-rep" data-a="effacerFiltres" title="Réinitialiser les filtres et recommencer">' +
              icone('relancer') + '<span>Réinitialiser les filtres</span>' +
            '</button>'
          : '<button type="button" class="bouton-reinit-rep desactive" disabled title="Aucun filtre actif">' +
              icone('relancer') + '<span>Réinitialiser les filtres</span>' +
            '</button>') +
      '</div>' +
      '</div>';
    if (!liste.length) return h + '<div class="vide"><strong>Aucun praticien</strong>Aucun praticien ne correspond à tous ces critères.<div style="margin-top:14px"><button class="bouton bouton-plein" type="button" data-a="effacerFiltres">' + icone('relancer') + 'Réinitialiser les filtres et recommencer</button></div></div>';
    h += '<ul class="liste">';
    liste.slice(0, S.ui.limite).forEach(function (p) {
      var ouvert = S.ui.contactOuvert === p.code, lieux = fusionnerLieux(c.presencesParCode[p.code] || []);
      h += '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="contact" data-v="' + esc(p.code) + '" aria-expanded="' + ouvert + '">' +
        '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
        '<span class="discret bloc-texte">' + (estPharmacie(p) ? '' : '<b class="spec-gras">' + esc(abrSpec(p.specialite)) + '</b>, ') + lieux.length + ' lieu' + (lieux.length > 1 ? 'x' : '') + ' : ' +
          (function () { var coF = ensemble(S.ui.filtres && S.ui.filtres.communes || []), aF = Object.keys(coF).length;
            var ok = function (x) { return aF && communeCorrespondante(x, coF); };
            var tri = lieux.slice().sort(function (x, y) { return (ok(y) ? 1 : 0) - (ok(x) ? 1 : 0); }), vus = {};
            return tri.filter(function (x) { if (vus[x.commune]) return false; vus[x.commune] = 1; return true; })
              .map(function (x) { return ok(x) ? '<b>' + esc(x.commune) + '</b>' : esc(x.commune); }).join(', '); })() + '</span>' +
        '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere)) + '</span>' +
          (function () { var nG = lieux.filter(aCoord).length, cl = !lieux.length || nG === 0 ? 'gps-non' : (nG === lieux.length ? 'gps-ok' : 'gps-partiel');
            return '<span class="etiquette etiquette-gps ' + cl + '">' + icone('carte') + 'GPS ' + nG + '/' + (lieux.length || 1) + '</span>'; })() +
        (estPharmacie(p) ? (p.statut ? '<span class="etiquette ' + (estKo(p.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(p)) + '</span>' : '') : badgePresenceMedecin(p.code, p)) +
        (/^TMP-/.test(p.code) || ficheEnAttente(p.code) ? '<span class="etiquette p1">Fiche en attente d\'envoi</span>' : '') +
        etiquetteCollegues(p.code, t) + '</span></button>';
      if (ouvert) {
        var cr = (c.parCode[p.code] || [])[0], pres = lieux[0] || {};
        h += prochainePresenceHtml(p) + actionsRapides({ telephone: p.telephone, lat: cr && cr.coord && cr.coord.lat, lon: cr && cr.coord && cr.coord.lon,
                              lieu: pres.lieu, quartier: pres.quartier, commune: pres.commune });
        if (p.telephone) h += '<p class="discret" style="margin:6px 0 0">Tél : ' + esc(p.telephone) + '</p>';
        if (p.commentaire) h += '<p class="discret" style="margin:0">Dernier commentaire : ' + esc(p.commentaire) + '</p>';
        if (p.prochaine) h += '<p class="discret" style="margin:4px 0 0">Prochain RDV le ' + dateCourte(p.prochaine) + '</p>';
        if (p.absentDu) h += '<p class="discret erreur-texte" style="margin:4px 0 0">Absent du ' + dateCourte(p.absentDu) + (p.absentAu ? ' au ' + dateCourte(p.absentAu) : '') + '</p>';
        h += grillePresences(p.code);
        var impose = S.imposes.some(function (im) { return im.code === p.code; });
        var nbLieux = lieux.length || 1;
        var nbGpsFixes = lieux.filter(aCoord).length;
        var badgeGpsClasse = nbGpsFixes === nbLieux ? 'fixe' : (nbGpsFixes > 0 ? 'partiel' : 'manquant');
        var badgeGpsHtml = icone('carte') + '<span>' + nbGpsFixes + '/' + nbLieux + '</span>';
        var tAuj = aujourdhui();
        var dejaAuj = S.plan.some(function (a) { return a.code === p.code && a.date === tAuj; });

        h += '<div class="bloc-actions-contact">' +

          '<div class="rangee rangee-actions-contact">' +
            (dejaAuj
              ? '<span class="badge-deja-prevu">' + icone('valider') + 'Prévu ce jour</span>'
              : '<button class="bouton bouton-inopinee" type="button" data-a="visiteInopineeDirect" data-v="' + esc(p.code) + '" title="Ajouter immédiatement à la tournée d\'aujourd\'hui">' +
                  icone('eclair') + '<span>Ajouter au jour</span></button>') +
            '<button class="bouton" type="button" data-a="imposerDirect" data-v="' + esc(p.code) + '">' + icone('calendrier') + '<span>' + (impose ? 'Re-planifier' : 'Planifier') + '</span></button>' +
            '<button class="bouton" type="button" data-a="modifierFiche" data-v="' + esc(p.code) + '">' + icone('crayon') + '<span>Modifier</span></button>' +
          '</div></div>';
      }
      h += '</li>';
    });
    h += '</ul>';
    if (liste.length > S.ui.limite) h += '<button class="bouton bouton-large" type="button" data-a="plus">Afficher plus</button>';
    return h;
  };

  // Planning hebdomadaire d'un praticien (lieux x jours)
  // 3.26.73 : un même lieu saisi sur plusieurs lignes n'apparaît qu'une fois (jours réunis)
  function fusionnerLieux(l) {
    var out = [], par = {};
    (l || []).forEach(function (pr) {
      var k = normaliser(pr.lieu || '') + '|' + normaliser(pr.commune || '');
      if (!normaliser(pr.lieu || '') || !par[k]) {
        var c = Object.assign({}, pr); c._ids = {};
        JOURS_CLES.forEach(function (j, i) { var d = lireDispo(pr[j]); c._ids[i + '|Matin'] = d.matin ? pr.id : null; c._ids[i + '|Soir'] = d.soir ? pr.id : null; });
        out.push(c); if (normaliser(pr.lieu || '')) par[k] = c; return;
      }
      var m = par[k];
      JOURS_CLES.forEach(function (j, i) {
        var a1 = lireDispo(m[j]), b1 = lireDispo(pr[j]);
        if (b1.matin && !a1.matin) m._ids[i + '|Matin'] = pr.id;
        if (b1.soir && !a1.soir) m._ids[i + '|Soir'] = pr.id;
        m[j] = ecrireDispo({ matin: a1.matin || b1.matin, soir: a1.soir || b1.soir });
      });
      if (!aCoord(m) && aCoord(pr)) { m.lat = pr.lat; m.lon = pr.lon; }
      if (!m.reperes && pr.reperes) m.reperes = pr.reperes;
    });
    return out;
  }
  // 3.27.6 : une seule semaine pour tous les lieux (couleur du lieu), légende dessous ; prochaine présence en tête
  function prochainePresence(p) {
    var crs = (ctx().parCode[p.code] || []).slice().sort(function (x, y) { return x.debut - y.debut; });
    if (!crs.length) return null;
    var t = aujourdhui(), now = minutesMaintenant();
    for (var k = 0; k < 28; k++) {
      var d = ajouterJours(t, k), j = jourSemaineIndex(d);
      if (j > 4 || estFerie(d) || absentLe(p, d)) continue;
      for (var n = 0; n < crs.length; n++) { var c = crs[n]; if (c.jourIdx === j && (k > 0 || now <= c.fin)) return { d: d, c: c }; }
    }
    return null;
  }
  // 3.27.23 : prochaines présences (aujourd'hui jusqu'à la fermeture incluse, puis les jours suivants), pour choisir la date
  function prochainesPresences(p, max) {
    var crs = (ctx().parCode[p.code] || []).slice().sort(function (x, y) { return x.debut - y.debut; }), res = [];
    var t = aujourdhui(), now = minutesMaintenant();
    for (var k = 0; k < 21 && res.length < max; k++) {
      var d = ajouterJours(t, k), j = jourSemaineIndex(d);
      if (j > 4 || estFerie(d) || absentLe(p, d)) continue;
      crs.forEach(function (c) { if (res.length < max && c.jourIdx === j && (k > 0 || now <= c.fin)) res.push({ d: d, c: c }); });
    }
    return res;
  }
  // conflits d'une date : déjà prévu, prévu par un collègue, autre lieu dans votre tournée sur ce créneau
  function conflitsPlanif(c, d) {
    var l = [];
    if (S.plan.some(function (a) { return a.date === d && a.code === c.code; })) return { bloque: true, l: ['déjà dans votre tournée'] };
    arretsCollegues().filter(function (x) { return x.code === c.code && x.date === d; }).forEach(function (x) { l.push('prévu par ' + x.delegue); });
    var ailleurs = S.plan.filter(function (a) { return a.date === d && a.creneau === c.creneau && a.lieu && !memeEtablissement(a.lieu, c.lieu); });
    if (ailleurs.length) l.push(ailleurs.length + ' visite' + (ailleurs.length > 1 ? 's' : '') + ' ailleurs ce ' + c.creneau.toLowerCase() + ' (' + abregerHopital(ailleurs[0].lieu) + ')');
    return { bloque: false, l: l };
  }
  function prochainePresenceHtml(p) {
    var x = prochainePresence(p); if (!x) return '';
    var t = aujourdhui(), d = x.d, c = x.c, quand = d === t ? 'Aujourd\'hui' : (d === ajouterJours(t, 1) ? 'Demain' : JOURS[jourSemaineIndex(d)] + ' ' + (+d.slice(8)));
    var abs = p.absentDu && p.absentDu <= t && (!p.absentAu || p.absentAu >= t) ? 'Absent' + (p.absentAu ? ' jusqu\'au ' + dateCourte(p.absentAu) : '') + ' · ' : '';
    var mois = new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short' });
    return '<div class="proch-pres"><span class="pp-d"><small>' + JOURS[jourSemaineIndex(d)].slice(0, 3) + '</small><b>' + (+d.slice(8)) + '</b><small>' + esc(mois) + '</small></span>' +
      '<p><b>' + esc(quand) + ', ' + c.creneau.toLowerCase() + (estPharmacie(p) ? '' : ' à ' + esc(abregerHopital(c.lieu))) + '</b>' + esc(abs) + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '</p>' +
      '<button type="button" class="bouton bouton-plein petit" data-a="planifierProchaines" data-v="' + esc(p.code) + '">Planifier</button></div>';
  }
  // 3.27.16 : couleur fixe par établissement (ordre de la base, identique chez tous les délégués) : 1 vert, 2 bleu, puis 8 autres
  var COULEURS_GRILLE = ['#1B7448', '#1E5AA8', '#6A3FA0', '#B4580A', '#B03A7A', '#0A6C74', '#7A5230', '#3B4BA8', '#5E6B1F', '#4A5A66'];
  function grillePresences(code) {
    var c = ctx(), p = praticien(code) || {}, estPh = p.type === 'Pharmacie', lieux = fusionnerLieux(c.presencesParCode[code] || []);
    var rangBase = new Map(); lieux.forEach(function (pr, i) { rangBase.set(pr, i); });   // couleur selon l'ordre de la base, pas selon le tri
    // 3.26.63 : avec un filtre de communes, le lieu de la commune choisie apparaît en premier
    var coG = ensemble(S.ui.filtres && S.ui.filtres.communes || []);
    if (Object.keys(coG).length) lieux = lieux.slice().sort(function (x, y) { return (communeCorrespondante(y, coG) ? 1 : 0) - (communeCorrespondante(x, coG) ? 1 : 0); });
    var couleurLieu = function (pr) { return COULEURS_GRILLE[(rangBase.get(pr) || 0) % COULEURS_GRILLE.length]; };
    if (!lieux.length) {
      return '<div class="bloc-presences" style="margin:8px 0;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
        '<p class="discret" style="margin:0 0 6px;text-align:center">Aucune présence ou horaire renseigné.</p>' +
        '<button class="bouton petit" type="button" data-a="modifierPlanning" data-v="' + esc(code) + '" style="margin:0 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px">' +
        icone('crayon') + (estPh ? ' Renseigner les horaires' : ' Renseigner le planning') + '</button></div>';
    }
    var hor = function (pr) { var hM = lireHoraire(pr.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      return 'Matin ' + minutesVersHeure(hM[0]) + '-' + minutesVersHeure(hM[1]) + ', soir ' + minutesVersHeure(hS[0]) + '-' + minutesVersHeure(hS[1]); };
    var jAuj = jourSemaineIndex(aujourdhui());
    var h = '<div class="sem-rep"><div class="sr-tete"><div><b>' + (estPh ? 'Reçoit les délégués' : 'Semaine type') + '</b><small>' + (estPh ? esc(hor(lieux[0])) : 'Touchez un créneau pour planifier') + '</small></div>' +
      '</div>' +
      '<div class="sr-grille"><span></span>' + JOURS.map(function (j, i) { return '<span class="sr-j' + (i === jAuj ? ' auj' : '') + '">' + j.slice(0, 3) + '</span>'; }).join('');
    [['Matin', 'M', 'matin'], ['Soir', 'S', 'soir']].forEach(function (cr) {
      h += '<span class="sr-ms">' + cr[1] + '</span>';
      JOURS_CLES.forEach(function (j, i) {
        var la = [];
        lieux.forEach(function (pr, idx) { if (lireDispo(pr[j])[cr[2]]) la.push({ pr: pr, idx: idx }); });
        if (!la.length) { h += '<span class="sr-c"></span>'; return; }
        h += '<span class="sr-cel">' + la.map(function (x) {
          var cle = ((x.pr._ids && x.pr._ids[i + '|' + cr[0]]) || x.pr.id) + '|' + i + '|' + cr[0];
          return '<button type="button" class="sr-c on" style="--k:' + couleurLieu(x.pr) + '" data-a="planifierCle" data-v="' + esc(cle) + '" title="Planifier ' + JOURS[i] + ' ' + cr[0].toLowerCase() + ', ' + esc(abregerHopital(x.pr.lieu || p.nom)) + '">' + cr[1] + '</button>';
        }).join('') + '</span>';
      });
    });
    h += '</div><ul class="sr-lieux">' + lieux.map(function (pr, idx) {
      var quartierNet = String(pr.quartier || '').replace(/\bBoulevard\b/gi, 'Blvd.');
      var adr = [quartierNet, pr.commune].filter(Boolean).join(', ') + (pr.reperes ? ' · ' + pr.reperes : '');
      return '<li>' + (estPh ? '' : '<span class="sr-pt" style="background:' + couleurLieu(pr) + '"></span>') + '<div>' +
        (estPh ? '' : '<b class="lieu-nom-plein">' + esc(abregerHopital(pr.lieu || 'Établissement')) + '</b>') +
        (adr ? '<small>' + esc(adr) + '</small>' : '') + (estPh ? '' : '<small>' + esc(hor(pr)) + '</small>') + '</div></li>';
    }).join('') + '</ul></div>' +
      '<div class="pres-actions">' +
        '<button type="button" class="bouton petit bouton-planning" data-a="modifierPlanning" data-v="' + esc(code) + '">' +
        icone('crayon') + (estPh ? ' Modifier les horaires' : ' Modifier le planning hebdomadaire') + '</button>' +
      '</div>';
    return h;
  }

  // ------------------------------------------------------------------ Vue : statistiques
  // 3.21.0 : un seul filtre « Qui / Quand » pour le Bilan (tableau de bord et historique) et l'Équipe :
  // moi, toute l'équipe ou plusieurs délégués choisis ; jour, semaine, mois ou période, avec ‹ › pour avancer ou reculer
  var FEUILLES = {};   // feuilles (fenêtres) : déclarées ici car certaines sont définies plus haut que leur section
  FEUILLES.rappels = feuilleRappels;
  S.ui.fq = LS.get('filtreQui', { qui: 'moi', liste: [] });
  function nomsDelegues() {
    var n = {}; ((S.data && S.data.delegues) || []).forEach(function (x) { n[x] = true; });
    ((S.data && S.data.plannings) || []).concat((S.data && S.data.historique) || []).forEach(function (x) { if (x.delegue) n[String(x.delegue).trim()] = true; });
    if (moi()) n[moi()] = true;
    return Object.keys(n).filter(Boolean).sort(function (a, b) { return estMoi(a) ? -1 : estMoi(b) ? 1 : a.localeCompare(b, 'fr'); });
  }
  function quiCorrespond(nom) {
    var f = S.ui.fq;
    if (f.qui === 'tous') return true;
    if (f.qui === 'liste') return f.liste.some(function (x) { return nom ? String(nom).trim().toLowerCase() === x.toLowerCase() : estMoi(x); });
    return !nom || estMoi(nom);
  }
  function formatQui() {
    var f = S.ui.fq;
    if (f.qui === 'tous') return { plein: 'Toute l\'équipe', court: 'Équipe' };
    if (f.qui === 'liste') {
      var t = f.liste.length > 2 ? f.liste.length + ' délégués' : f.liste.map(function (x) { return estMoi(x) ? 'Moi' : x.split(' ')[0]; }).join(', ');
      return { plein: t, court: t };
    }
    return { plein: 'Moi', court: 'Moi' };
  }
  function libelleQui() {
    return formatQui().plein;
  }
  function formatQuand(onglet) {
    var MOIS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    if (onglet === 'equipe') {
      if (S.ui.eqPortee === 'jour') {
        var d = S.ui.eqDate || aujourdhui();
        return { plein: majuscule(dateCourte(d)), court: majuscule(dateCourte(d)) };
      }
      var l = lundiDe(S.ui.eqDate || aujourdhui());
      return { plein: 'Semaine du ' + dateCourte(l), court: 'Sem. ' + dateCourte(l) };
    }
    var b = bornesStats(), st = S.ui.stats;
    if (b[0] === b[1]) {
      var d = majuscule(dateCourte(b[0]));
      return { plein: d, court: d };
    }
    if (st.periode === 'semaine') {
      return { plein: 'Semaine du ' + dateCourte(b[0]), court: 'Sem. ' + dateCourte(b[0]) };
    }
    if (st.periode === 'mois') {
      var mIdx = +b[0].slice(5, 7) - 1, annee = b[0].slice(0, 4);
      var mLong = majuscule(MOIS[mIdx]) + ' ' + annee;
      var mCourt = MOIS_COURTS[mIdx] + ' ' + annee;
      return { plein: mLong, court: mCourt };
    }
    return { plein: 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1]), court: dateCourte(b[0]) + ' - ' + dateCourte(b[1]) };
  }
  function libelleBornes(b) {
    var st = S.ui.stats;
    if (b[0] === b[1]) return majuscule(dateCourte(b[0]));
    if (st.periode === 'semaine') return 'Semaine du ' + dateCourte(b[0]);
    if (st.periode === 'mois') return majuscule(MOIS[+b[0].slice(5, 7) - 1]) + ' ' + b[0].slice(0, 4);
    return 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1]);
  }
  function barreQuiQuand(onglet) {
    var quiObj = formatQui();
    var qObj = formatQuand(onglet);
    var nav = onglet === 'equipe' || S.ui.stats.periode !== 'perso';
    return '<div class="barre-qq">' +
      (S.config.demo ? '' : '<button type="button" class="puce-filtre" data-a="quiOuvrir">' + icone('equipe') + '<span><span class="txt-plein">' + esc(quiObj.plein) + '</span><span class="txt-court">' + esc(quiObj.court) + '</span></span><b>▾</b></button>') +
      '<div class="qq-quand">' + (nav ? '<button type="button" class="bouton-icone sombre" data-a="quandDecaler" data-o="' + onglet + '" data-v="-1" aria-label="Période précédente">' + icone('chevron') + '</button>' : '') +
      '<button type="button" class="puce-filtre" data-a="quandOuvrir" data-o="' + onglet + '">' + icone('calendrier') + '<span><span class="txt-plein">' + esc(qObj.plein) + '</span><span class="txt-court">' + esc(qObj.court) + '</span></span><b>▾</b></button>' +
      (nav ? '<button type="button" class="bouton-icone sombre suivant" data-a="quandDecaler" data-o="' + onglet + '" data-v="1" aria-label="Période suivante">' + icone('chevron') + '</button>' : '') + '</div></div>';
  }
  FEUILLES.calendrierJour = function (f) {
    var curMois = f.mois || f.date.slice(0, 7), t = aujourdhui();
    var parts = curMois.split('-'), y = +parts[0], m = +parts[1];
    var nomMois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][m - 1];
    var rDemain = ajouterJours(t, 1), rSem = ajouterJours(t, 7), r2Sem = ajouterJours(t, 14);
    var raccourcis = '<div class="cal-raccourcis">' +
      '<button type="button" class="puce' + (f.date === t ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + t + '">Aujourd\'hui</button>' +
      '<button type="button" class="puce' + (f.date === rDemain ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + rDemain + '">Demain</button>' +
      '<button type="button" class="puce' + (f.date === rSem ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + rSem + '">+7 jours</button>' +
      '<button type="button" class="puce' + (f.date === r2Sem ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + r2Sem + '">+14 jours</button>' +
      '</div>';
    var chevronG = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var chevronD = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var barreMois = '<div class="cal-barre-mois">' +
      '<div class="cal-titre-mois"><b>' + nomMois + '</b><span class="cal-an-badge">' + y + '</span></div>' +
      '<div class="cal-navs">' +
        '<button type="button" class="cal-nav-btn" data-a="calChangerMois" data-v="-1" aria-label="Mois précédent">' + chevronG + '</button>' +
        '<button type="button" class="cal-nav-btn" data-a="calChangerMois" data-v="1" aria-label="Mois suivant">' + chevronD + '</button>' +
      '</div>' +
      '</div>';
    var entetes = '<div class="cal-grille-semaine">' +
      ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(function (j) { return '<span>' + j + '</span>'; }).join('') +
      '</div>';
    var premierJour = new Date(y, m - 1, 1);
    var dec = (premierJour.getDay() + 6) % 7;
    var nbJoursMois = new Date(y, m, 0).getDate();
    var nbJoursPrec = new Date(y, m - 1, 0).getDate();
    var cellules = [];
    for (var i = dec - 1; i >= 0; i--) {
      var jPrec = nbJoursPrec - i, mPrec = m === 1 ? 12 : m - 1, yPrec = m === 1 ? y - 1 : y;
      cellules.push({ num: jPrec, iso: yPrec + '-' + pad2(mPrec) + '-' + pad2(jPrec), horsMois: true });
    }
    for (var j = 1; j <= nbJoursMois; j++) {
      cellules.push({ num: j, iso: y + '-' + pad2(m) + '-' + pad2(j), horsMois: false });
    }
    // Strictement 42 cases (6 semaines complètes) : hauteur 100% stable sans aucun saut
    var reste = 42 - cellules.length;
    for (var k = 1; k <= reste; k++) {
      var mSuiv = m === 12 ? 1 : m + 1, ySuiv = m === 12 ? y + 1 : y;
      cellules.push({ num: k, iso: ySuiv + '-' + pad2(mSuiv) + '-' + pad2(k), horsMois: true });
    }
    var grille = '<div class="cal-grille-jours">' + cellules.map(function (c) {
      var nVisites = nbVisitesJour(c.iso), estAuj = c.iso === t, estChoisi = c.iso === f.date;
      var classes = ['cal-jour-btn'];
      if (c.horsMois) classes.push('hors-mois');
      if (estAuj) classes.push('aujourdhui');
      if (estChoisi) classes.push('choisi');
      if (nVisites > 0) classes.push('avec-visites');
      return '<button type="button" class="' + classes.join(' ') + '" data-a="calChoisirJour" data-v="' + c.iso + '">' +
        '<span>' + c.num + '</span>' +
        (nVisites > 0 ? '<span class="cal-point-visite"></span>' : '') +
        '</button>';
    }).join('') + '</div>';
    return '<div class="cal-boite">' + raccourcis + barreMois + entetes + grille + '</div>';
  };
  FEUILLES.qui = function (f) {
    var noms = nomsDelegues(), tousChoisis = noms.length > 0 && noms.every(function (n) { return f.liste.indexOf(n) >= 0; });
    return '<div class="segment" role="group" aria-label="Qui" style="margin-top:0">' + [['moi', 'Moi'], ['tous', 'Toute l\'équipe'], ['liste', 'Choisir']].map(function (x) {
        return '<button type="button" data-a="quiMode" data-v="' + x[0] + '" aria-pressed="' + (f.qui === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      (f.qui === 'liste' ? '<p class="discret" style="margin:4px 0 8px">Touchez les délégués à réunir dans le bilan.</p><div class="puces">' +
        (noms.length > 1 ? '<button type="button" class="puce puce-tous" data-a="quiTous" aria-pressed="' + tousChoisis + '">Tous</button>' : '') +
        noms.map(function (n) {
          return '<button type="button" class="puce" data-a="quiToggle" data-v="' + esc(n) + '" aria-pressed="' + (f.liste.indexOf(n) >= 0) + '">' + esc(n) + (estMoi(n) ? ' (moi)' : '') + '</button>';
        }).join('') + '</div>' : '') +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="quiAppliquer" style="margin-top:14px">Appliquer</button>';
  };
  FEUILLES.quand = function (f) {
    var opts = f.onglet === 'equipe' ? [['jour', 'Jour'], ['semaine', 'Semaine']] : [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['perso', 'Période']];
    return '<div class="segment" role="group" aria-label="Période" style="margin-top:0">' + opts.map(function (x) {
        return '<button type="button" data-a="quandMode" data-v="' + x[0] + '" aria-pressed="' + (f.periode === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      (f.periode === 'perso' ? '<div class="grille-2"><label class="champ"><span>Du</span><input type="date" id="quandDebut" value="' + esc(f.debut) + '"></label>' +
        '<label class="champ"><span>Au</span><input type="date" id="quandFin" value="' + esc(f.fin) + '"></label></div>' :
        '<label class="champ"><span>' + (f.periode === 'mois' ? 'Un jour du mois' : f.periode === 'semaine' ? 'Un jour de la semaine' : 'Date') + '</span><input type="date" id="quandRef" value="' + esc(f.ref) + '"></label>') +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="quandAppliquer">Appliquer</button>';
  };
  function bornesStats() {
    var st = S.ui.stats, t = st.ref || aujourdhui();
    if (st.periode === 'jour') return [t, t];
    if (st.periode === 'semaine') { var l = lundiDe(t); return [l, ajouterJours(l, 6)]; }
    if (st.periode === 'mois') { var d = t.slice(0, 8) + '01'; return [d, ajouterJours(ajouterJours(d, 32).slice(0, 8) + '01', -1)]; }
    var a = st.debut || ajouterJours(t, -29), b = st.fin || t;
    return a <= b ? [a, b] : [b, a];
  }
  function joursEntre(a, b) { var l = []; for (var d = a; d <= b && l.length < 400; d = ajouterJours(d, 1)) l.push(d); return l; }
  // Comptes rendus connus (envoyés et en attente), sans doublon
  function visitesConnues() {
    var vus = {}, l = [];
    S.queue.concat((S.data && S.data.historique) || []).forEach(function (v) {
      if (v.uid) { if (vus[v.uid]) return; vus[v.uid] = true; }
      l.push(v);
    });
    return l;
  }
  // Visites planifiées : ma tournée en cours + tournées publiées (les miennes ou celles de toute l'équipe)
  function arretsPlanifies(equipe) {
    var vus = {}, l = [];
    S.plan.forEach(function (a) {
      vus[a.uid] = true;
      l.push({ date: a.date, code: a.code, commune: a.commune, specialite: a.specialite, statut: a.statut, etat: a.etat, delegue: moi() || 'Moi' });
    });
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (vus[p.uid] || (!equipe && !estMoi(p.delegue))) return;
      vus[p.uid] = true; l.push(p);
    });
    return l;
  }
  function calculerStats() {
    var st = S.ui.stats, eq = S.ui.fq.qui !== 'moi' && !S.config.demo, b = bornesStats(), t = aujourdhui();
    var dans = function (d) { return d && d >= b[0] && d <= b[1]; };
    var visites = visitesConnues().filter(function (v) { return dans(String(v.date).slice(0, 10)) && (S.config.demo || quiCorrespond(v.delegue)); });
    var effectives = visites.filter(function (v) { return Moteur.estVisite(v.statut, statuts()); });
    var plan = arretsPlanifies(eq).filter(function (a) { return dans(a.date) && (S.config.demo || quiCorrespond(a.delegue)); });
    var echus = plan.filter(function (a) { return a.date <= t; });
    var faits = echus.filter(function (a) { return a.etat === 'valide' && Moteur.estVisite(a.statut, statuts()); });
    var delegues = {};
    if (eq) { plan.forEach(function (a) { if (a.delegue) delegues[a.delegue] = true; }); visites.forEach(function (v) { if (v.delegue) delegues[v.delegue] = true; }); }
    var nbDel = eq ? Math.max(1, Object.keys(delegues).length) : 1;
    var ouvres = joursEntre(b[0], b[1]).filter(function (d) { return jourSemaineIndex(d) < 5; }).length;
    var objectif = Math.round((+st.objectif || 0) / 5 * ouvres * nbDel);
    var prat = ctx().prat, nA = 0, nAok = 0;
    var filtre = !eq ? filtreCibles() : null;
    Object.keys(prat).forEach(function (k) {
      var p = prat[k]; if (p.note !== 3) return;
      if (filtre && !filtre(p)) return;
      nA++; if (joursEcoules(p.derniere, t) <= REGLAGES_MOTEUR.cadence[3]) nAok++;
    });
    return { bornes: b, equipe: eq, visites: visites, effectives: effectives, plan: plan, echus: echus, faits: faits,
             nbDel: nbDel, delegues: Object.keys(delegues).sort(), ouvres: ouvres, objectif: objectif, nA: nA, nAok: nAok };
  }
  function taux(a, b) { return b ? Math.round(100 * a / b) : null; }
  function txt(n) { return n === null || n === undefined ? 'n.d.' : n + ' %'; }

  VUES.recherche = VUES.praticiens;
  VUES.contacts = VUES.praticiens;

  // 3.26.0 : Onglet Suivi unifié regroupant Bilan, Tournées Équipe et Audit Données/GPS
  VUES.suivi = function () {
    var sousVue = S.ui.suiviVue || 'bilan';
    var tete = '<div class="tete-vue"><h2 class="titre-vue">Suivi & Contrôle</h2></div>' +
      '<p class="sous-titre">Pilotez votre activité : réalisations, tournées de l\'équipe et qualité des données.</p>' +
      '<div class="segment-suivi" style="margin:4px 0 10px">' +
      segment('Sous-onglet Suivi', 'suiviVue', [['bilan', 'Bilan'], ['equipe', 'Équipe'], ['audit', 'Audit']], sousVue) +
      '</div>';
    return tete + (sousVue === 'equipe' ? VUES.equipe(true) : (sousVue === 'audit' ? VUES.audit(true) : VUES.bilan(true)));
  };

  VUES.audit = function (integre) {
    if (!S.data || !S.data.praticiens || !S.data.praticiens.length) {
      return (integre ? '' : '<div class="tete-vue"><h2 class="titre-vue">Audit Données & GPS</h2></div>') +
        '<div class="vide"><strong>Aucune donnée</strong>Connectez un Google Sheet ou chargez les données de démonstration pour auditer la base.</div>';
    }

    var prats = S.data.praticiens, pres = S.data.presences || [], qList = quartiers();
    var qMap = {}; qList.forEach(function (q) { qMap[(q.quartier || '').trim().toLowerCase()] = q; });
    var presParCode = {}; pres.forEach(function (p) { (presParCode[p.code] = presParCode[p.code] || []).push(p); });

    var filtreAnomalie = S.ui.auditFiltre || 'tous';

    var total = prats.length;
    var sansGps = [], horsCi = [], ecartGeo = [], sansPresence = [], conformes = 0;
    var coordGroupes = {};

    prats.forEach(function (p) {
      var sesPres = presParCode[p.code] || [];
      var estPh = p.type === 'Pharmacie' || /^PHA-/i.test(p.code);
      var p0 = sesPres[0] || {};
      var lat = parseFloat(String(p0.lat || p.lat || '').replace(',', '.'));
      var lon = parseFloat(String(p0.lon || p.lon || '').replace(',', '.'));
      var aGps = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0);
      var dansCi = aGps && (lat >= 4.3 && lat <= 10.8) && (lon >= -8.6 && lon <= -2.4);

      var anomalie = null;

      if (!sesPres.length && !estPh) {
        sansPresence.push({ p: p, pres: p0, motif: 'Aucun créneau ni établissement renseigné' });
        anomalie = 'sansPresence';
      } else if (!aGps) {
        sansGps.push({ p: p, pres: p0, motif: 'Coordonnées GPS manquantes ou à zéro' });
        anomalie = 'sansGps';
      } else if (!dansCi) {
        horsCi.push({ p: p, pres: p0, motif: 'Coordonnées hors Côte d\'Ivoire (' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ')' });
        anomalie = 'horsCi';
      } else {
        var cleCoord = lat.toFixed(3) + '|' + lon.toFixed(3);
        coordGroupes[cleCoord] = coordGroupes[cleCoord] || [];
        coordGroupes[cleCoord].push({ p: p, pres: p0, lat: lat, lon: lon });

        var quartNom = (p0.quartier || p.quartier || '').trim().toLowerCase();
        var qRef = qMap[quartNom];
        if (!quartNom || quartNom === 'nl') {
          ecartGeo.push({ p: p, pres: p0, motif: 'Quartier non renseigné ou non localisé (NL)' });
          anomalie = 'ecartGeo';
        } else if (qRef && isFinite(qRef.lat)) {
          var dist = distanceVol({ lat: lat, lon: lon }, { lat: qRef.lat, lon: qRef.lon });
          if (dist > 8) {
            ecartGeo.push({ p: p, pres: p0, motif: 'Écart de ' + Math.round(dist) + ' km avec le quartier ' + qRef.quartier + ' (' + qRef.commune + ')' });
            anomalie = 'ecartGeo';
          }
        }
      }

      if (!anomalie) conformes++;
    });

    var centroides = [];
    Object.keys(coordGroupes).forEach(function (k) {
      var grp = coordGroupes[k];
      if (grp.length >= 3) {
        var lieuxUniques = {};
        grp.forEach(function (item) {
          var nLieu = normaliser((item.pres && item.pres.lieu) || item.p.nom || '');
          lieuxUniques[nLieu] = (lieuxUniques[nLieu] || 0) + 1;
        });
        var nbLieuxDistincts = Object.keys(lieuxUniques).length;
        if (nbLieuxDistincts >= 2) {
          grp.forEach(function (item) {
            centroides.push({ p: item.p, pres: item.pres, motif: 'Centroïde suspect : ' + nbLieuxDistincts + ' établissements distincts au même point (' + item.lat.toFixed(4) + ', ' + item.lon.toFixed(4) + ')' });
          });
        }
      }
    });

    var scoreSante = Math.round((conformes / total) * 100);

    var h = (integre ? '' : '<div class="tete-vue"><h2 class="titre-vue">Audit Qualité BDD & GPS</h2></div>');

    var coulScore = scoreSante >= 85 ? 'var(--vert,#1e7e34)' : (scoreSante >= 65 ? 'var(--ambre,#d97706)' : 'var(--rouge,#dc2626)');
    h += '<div class="bloc" style="margin-bottom:12px;padding:14px;background:var(--papier,#fff);border:1px solid var(--trait,#e2e8f0);border-radius:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<b>Santé globale de la base</b>' +
        '<b style="font-size:1.3rem;color:' + coulScore + '">' + scoreSante + ' %</b>' +
      '</div>' +
      '<div style="width:100%;height:10px;background:var(--trait,#e2e8f0);border-radius:5px;overflow:hidden">' +
        '<div style="width:' + scoreSante + '%;height:100%;background:' + coulScore + ';transition:width .3s"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.8rem;color:var(--gris,#64748b)">' +
        '<span>' + conformes + ' conformes sur ' + total + '</span>' +
        '<span>' + (total - conformes) + ' point(s) à optimiser</span>' +
      '</div>' +
    '</div>';

    h += '<div class="kpis" style="margin-bottom:14px">' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="sansGps" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'sansGps' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (sansGps.length ? 'var(--rouge,#dc2626)' : 'inherit') + '">' + sansGps.length + '</b>' +
        '<span>Sans GPS</span><small>Coordonnées vides ou 0</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="centroide" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'centroide' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (centroides.length ? 'var(--ambre,#d97706)' : 'inherit') + '">' + centroides.length + '</b>' +
        '<span>Centroïdes piégés</span><small>≥ 3 POI au même point</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="ecartGeo" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'ecartGeo' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (ecartGeo.length ? 'var(--ambre,#d97706)' : 'inherit') + '">' + ecartGeo.length + '</b>' +
        '<span>Écarts Quartier</span><small>> 8 km ou quartier NL</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="horsCi" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'horsCi' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (horsCi.length ? 'var(--rouge,#dc2626)' : 'inherit') + '">' + horsCi.length + '</b>' +
        '<span>Hors Côte d\'Ivoire</span><small>Hors limites nationales</small></button>' +
    '</div>';

    var listeAffichable = [];
    if (filtreAnomalie === 'sansGps') listeAffichable = sansGps;
    else if (filtreAnomalie === 'centroide') listeAffichable = centroides;
    else if (filtreAnomalie === 'ecartGeo') listeAffichable = ecartGeo;
    else if (filtreAnomalie === 'horsCi') listeAffichable = horsCi;
    else if (filtreAnomalie === 'sansPresence') listeAffichable = sansPresence;
    else {
      listeAffichable = sansGps.concat(centroides).concat(ecartGeo).concat(horsCi).concat(sansPresence);
    }

    var titreFiltre = {
      tous: 'Toutes les anomalies détectées (' + listeAffichable.length + ')',
      sansGps: 'Établissements sans GPS (' + sansGps.length + ')',
      centroide: 'Pièges de centroïde (' + centroides.length + ')',
      ecartGeo: 'Incohérences de quartier / distance (' + ecartGeo.length + ')',
      horsCi: 'Coordonnées hors limites CI (' + horsCi.length + ')',
      sansPresence: 'Sans créneaux de visite (' + sansPresence.length + ')'
    }[filtreAnomalie] || 'Anomalies';

    h += '<div class="tete-bloc" style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 8px">' +
      '<h3 style="margin:0;font-size:1rem">' + titreFiltre + '</h3>' +
      (filtreAnomalie !== 'tous' ? '<button type="button" class="bouton-texte" data-a="auditFiltrer" data-v="tous">Tout réafficher</button>' : '') +
      '</div>';

    if (!listeAffichable.length) {
      h += '<div class="vide" style="padding:20px 10px;text-align:center"><strong>✓ Aucune anomalie dans cette catégorie</strong>Toutes les fiches de ce groupe sont conformes.</div>';
    } else {
      h += '<ul class="liste liste-audit" style="display:flex;flex-direction:column;gap:8px;padding:0;margin:0;list-style:none">';
      listeAffichable.slice(0, 30).forEach(function (item) {
        var p = item.p, pr = item.pres || {};
        var estPh = p.type === 'Pharmacie' || /^PHA-/i.test(p.code);
        var nomLieu = pr.lieu || p.nom || '';
        var quartierNom = pr.quartier || p.quartier || 'Quartier non renseigné';
        var communeNom = pr.commune || p.commune || '';
        h += '<li style="background:var(--papier,#fff);border:1px solid var(--trait,#e2e8f0);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
              '<b>' + esc(p.nom) + '</b>' +
              '<span class="etiquette ' + (estPh ? '' : 'ok') + '" style="font-size:0.75rem">' + (estPh ? 'Pharmacie' : esc(abrSpec(p.specialite) || 'Médecin')) + '</span>' +
            '</div>' +
            '<div class="discret" style="font-size:0.8rem;margin-top:2px">' + esc(nomLieu) + (quartierNom ? ' · ' + esc(quartierNom) : '') + (communeNom ? ' (' + esc(communeNom) + ')' : '') + '</div>' +
            '<div style="color:var(--rouge,#dc2626);font-size:0.75rem;margin-top:4px;font-weight:600">⚠ ' + esc(item.motif) + '</div>' +
          '</div>' +
          '<button type="button" class="bouton petit bouton-plein" data-a="modifierFiche" data-v="' + esc(p.code) + '" style="white-space:nowrap">Corriger</button>' +
        '</li>';
      });
      h += '</ul>';
      if (listeAffichable.length > 30) {
        h += '<p class="discret" style="text-align:center;margin-top:10px">Affichage des 30 premières anomalies sur ' + listeAffichable.length + ' au total.</p>';
      }
    }

    return h;
  };

  VUES.bilan = function (integre) {
    var vueH = S.ui.statsVue === 'historique';
    var tete = (integre ? '' : '<h2 class="titre-vue">Bilan</h2>') +
      segment('Affichage', 'statsVue', [['tableau', 'Indicateurs'], ['historique', 'Historique']], vueH ? 'historique' : 'tableau') + barreQuiQuand('bilan');
    if (vueH) return tete + VUES.historique(true);
    var st = S.ui.stats, r = calculerStats(), b = r.bornes;
    var h = tete;
    h += '<p class="discret" style="margin:0 0 10px">' + (b[0] === b[1] ? majuscule(dateLongue(b[0])) : 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1])) +
      (r.equipe ? ', ' + r.nbDel + ' délégué' + (r.nbDel > 1 ? 's' : '') : ', mes visites') + '.</p>';

    var couv = taux(r.faits.length, r.echus.length), pres = taux(r.effectives.length, r.visites.length), att = taux(r.effectives.length, r.objectif);
    var aVenir = r.plan.length - r.echus.length;
    h += '<div class="kpis">' +
      kpi(txt(couv), 'Taux de réalisation', r.faits.length + ' faites sur ' + r.echus.length + ' prévues' + (aVenir > 0 ? ', ' + aVenir + ' à venir' : ''), couv) +
      kpi(String(r.effectives.length), 'Visites réalisées', r.visites.length + ' compte' + (r.visites.length > 1 ? 's' : '') + ' rendu' + (r.visites.length > 1 ? 's' : '') + ', présence ' + txt(pres)) +
      kpi(txt(att), 'Objectif atteint', r.effectives.length + ' / ' + r.objectif + ' visites (' + st.objectif + ' par semaine' + (r.equipe ? ' et par délégué' : '') + ')', att) +
      kpi(txt(taux(r.nAok, r.nA)), 'Praticiens ★★★ à jour', r.nAok + ' sur ' + r.nA + ' vus depuis moins de ' + REGLAGES_MOTEUR.cadence[3] + ' j', taux(r.nAok, r.nA)) +
      '</div>';

    // Activité dans le temps
    var jours = joursEntre(b[0], b[1]);
    if (jours.length > 1) {
      var parSemaine = jours.length > 35, groupes = [], idx = {};
      jours.forEach(function (d) {
        if (!parSemaine && jourSemaineIndex(d) > 4) return;
        var k = parSemaine ? lundiDe(d) : d;
        if (idx[k] === undefined) { idx[k] = groupes.length; groupes.push({ k: k, prevu: 0, fait: 0 }); }
      });
      r.plan.forEach(function (a) { var g = groupes[idx[parSemaine ? lundiDe(a.date) : a.date]]; if (g) g.prevu++; });
      r.effectives.forEach(function (v) { var d = String(v.date).slice(0, 10), g = groupes[idx[parSemaine ? lundiDe(d) : d]]; if (g) g.fait++; });
      var obj = (+st.objectif || 0) / 5 * r.nbDel * (parSemaine ? 5 : 1);
      h += '<section class="bloc"><h3>Activité ' + (parSemaine ? 'par semaine' : 'par jour') + '</h3>' + legende(true) +
        colonnes(groupes.map(function (g) {
          var lib = parSemaine ? 'Sem. ' + dateCourte(g.k).slice(5) : JOURS_COURTS[jourSemaineIndex(g.k)].charAt(0).toUpperCase() + (+g.k.slice(8));
          return { lib: lib, prevu: g.prevu, fait: g.fait, tip: (parSemaine ? 'Semaine du ' + dateCourte(g.k) : majuscule(dateLongue(g.k))) + ' : ' + g.fait + ' réalisée' + (g.fait > 1 ? 's' : '') + ', ' + g.prevu + ' planifiée' + (g.prevu > 1 ? 's' : '') };
        }), obj) +
        tableDonnees(['Période', 'Planifiées', 'Réalisées'], groupes.map(function (g) { return [parSemaine ? 'Sem. du ' + dateCourte(g.k) : dateCourte(g.k), g.prevu, g.fait]; })) +
        '</section>';
    }

    // Activité par commune
    var parCom = {};
    r.plan.forEach(function (a) { var c = a.commune || 'Non renseignée'; (parCom[c] = parCom[c] || { prevu: 0, fait: 0 }).prevu++; });
    r.effectives.forEach(function (v) { var c = v.commune || 'Non renseignée'; (parCom[c] = parCom[c] || { prevu: 0, fait: 0 }).fait++; });
    var coms = Object.keys(parCom).map(function (k) { return { lib: k, prevu: parCom[k].prevu, fait: parCom[k].fait }; })
      .sort(function (x, y) { return (y.prevu + y.fait) - (x.prevu + x.fait) || x.lib.localeCompare(y.lib, 'fr'); });
    h += '<section class="bloc"><h3>Activité par commune</h3>';
    if (!coms.length) h += '<p class="discret">Aucune visite planifiée ni réalisée sur la période.</p>';
    else {
      h += legende(false) + barres(coms.slice(0, 12).map(function (c) {
        return { lib: c.lib, piste: c.prevu, val: c.fait, etiquette: c.fait + ' / ' + c.prevu, tip: c.lib + ' : ' + c.fait + ' réalisée' + (c.fait > 1 ? 's' : '') + ' sur ' + c.prevu + ' planifiée' + (c.prevu > 1 ? 's' : '') };
      })) + (coms.length > 12 ? '<p class="discret">' + (coms.length - 12) + ' autre(s) commune(s) dans le tableau.</p>' : '') +
      tableDonnees(['Commune', 'Planifiées', 'Réalisées'], coms.map(function (c) { return [c.lib, c.prevu, c.fait]; }));
    }
    h += '</section>';

    // Répartition par spécialité
    var parSpec = {}, base = st.vueSpec !== 'visites';
    if (base) Object.keys(ctx().prat).forEach(function (k) { var p = ctx().prat[k]; if (p.type !== 'Pharmacie') parSpec[p.specialite || 'Autre'] = (parSpec[p.specialite || 'Autre'] || 0) + 1; });
    else r.effectives.forEach(function (v) { var k = v.specialite || 'Autre'; parSpec[k] = (parSpec[k] || 0) + 1; });
    var specs = Object.keys(parSpec).map(function (k) { return { lib: k, n: parSpec[k] }; }).sort(function (x, y) { return y.n - x.n; });
    if (specs.length > 9) { var autres = specs.slice(8).reduce(function (s2, x) { return s2 + x.n; }, 0); specs = specs.slice(0, 8).concat([{ lib: 'Autres', n: autres }]); }
    var totalSpec = specs.reduce(function (s2, x) { return s2 + x.n; }, 0);
    h += '<section class="bloc"><div class="couv-tete"><h3>Par spécialité</h3><div class="segment petit" role="group" aria-label="Données">' +
      '<button type="button" data-a="statsSpec" data-v="base" aria-pressed="' + base + '">Base</button>' +
      '<button type="button" data-a="statsSpec" data-v="visites" aria-pressed="' + !base + '">Visites</button></div></div>' +
      '<p class="discret" style="margin:4px 0 8px">' + (base ? 'Médecins actifs de la base, par spécialité.' : 'Visites réalisées sur la période, par spécialité.') + '</p>';
    h += totalSpec ? barres(specs.map(function (x) {
      return { lib: x.lib, val: x.n, etiquette: x.n + ' (' + Math.round(100 * x.n / totalSpec) + ' %)', tip: x.lib + ' : ' + x.n + ' (' + Math.round(100 * x.n / totalSpec) + ' %)' };
    })) + tableDonnees(['Spécialité', base ? 'Médecins' : 'Visites', 'Part'], specs.map(function (x) { return [x.lib, x.n, Math.round(100 * x.n / totalSpec) + ' %']; }))
      : '<p class="discret">Aucune visite réalisée sur la période.</p>';
    h += '</section>';

    // Par type de visite
    var parAct = {};
    r.effectives.forEach(function (v) { listeActivites(v.activite).forEach(function (x) { parAct[x] = (parAct[x] || 0) + 1; }); });
    var acts = Object.keys(parAct).map(function (k) { return { lib: k, n: parAct[k] }; }).sort(function (x, y) { return y.n - x.n; });
    if (acts.length) {
      h += '<section class="bloc"><h3>Par type de visite</h3>' + barres(acts.map(function (x) { return { lib: x.lib, val: x.n, etiquette: String(x.n), tip: x.lib + ' : ' + x.n }; })) +
        tableDonnees(['Type de visite', 'Visites'], acts.map(function (x) { return [x.lib, x.n]; })) + '</section>';
    }

    // Par délégué (équipe)
    if (r.equipe && r.delegues.length) {
      h += '<section class="bloc"><h3>Par délégué</h3>' + tableDonnees(['Délégué', 'Planifiées', 'Réalisées', 'Réalisation'], r.delegues.map(function (d) {
        var ech = r.echus.filter(function (a) { return a.delegue === d; }), ok = r.faits.filter(function (a) { return a.delegue === d; }).length;
        return [d, r.plan.filter(function (a) { return a.delegue === d; }).length, r.effectives.filter(function (v) { return v.delegue === d; }).length, txt(taux(ok, ech.length))];
      }), true) + '</section>';
    }
    h += '<section class="bloc"><h3>Objectif</h3><label class="champ" style="margin:0"><span>Visites par semaine' + (r.equipe ? ' et par délégué' : '') + '</span>' +
      '<input type="number" min="1" max="200" inputmode="numeric" data-f="stats" data-k="objectif" value="' + esc(st.objectif) + '"></label></section>';
    return h;
  };

  function kpi(valeur, titre, detail, jauge) {
    return '<div class="kpi"><b>' + esc(valeur) + '</b><span>' + esc(titre) + '</span><small>' + esc(detail) + '</small>' +
      (jauge !== undefined && jauge !== null ? '<div class="jauge' + (jauge >= 100 ? ' depasse' : '') + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        Math.min(jauge, 100) + '" aria-label="' + esc(titre) + '"><i style="width:' + Math.min(jauge, 100) + '%"></i></div>' : '') + '</div>';
  }
  function legende(avecObjectif) {
    return '<div class="graph-legende"><span><i class="l-serie"></i>Réalisées</span><span><i class="l-piste"></i>Planifiées</span>' +
      (avecObjectif ? '<span><i class="l-objectif"></i>Objectif</span>' : '') + '</div>';
  }
  function tableDonnees(entetes, lignes, ouvert) {
    return '<details class="voir-table"' + (ouvert ? ' open' : '') + '><summary>' + (ouvert ? 'Détail' : 'Voir les données') + '</summary><table class="table-donnees"><thead><tr>' +
      entetes.map(function (e, i) { return '<th' + (i ? ' class="n"' : '') + '>' + esc(e) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      lignes.map(function (l) { return '<tr>' + l.map(function (v, i) { return '<td' + (i ? ' class="n"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></details>';
  }
  // Barre à extrémité arrondie (4 px) côté donnée, base plate
  function barreV(x, y, w, h) {
    if (h <= 0) return '';
    var r = Math.min(4, w / 2, h);
    return 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function barreH(x, y, w, h) {
    if (w <= 0) return '';
    var r = Math.min(4, h / 2, w);
    return 'M' + x + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + x + 'Z';
  }
  function graduation(max) {
    if (max <= 5) return Math.max(1, Math.ceil(max));
    var p = Math.pow(10, Math.floor(Math.log10(max))), n = max / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  // Colonnes : planifiées (piste) et réalisées (série), ligne d'objectif en pointillé
  function colonnes(donnees, objectif) {
    var W = 340, H = 180, g = 28, bas = 22, haut = 10, n = donnees.length;
    var max = graduation(Math.max(1, objectif || 0, Math.max.apply(null, donnees.map(function (d) { return Math.max(d.prevu, d.fait); }))));
    var bande = (W - g) / n, lw = Math.max(4, Math.min(26, bande * 0.62));
    var y = function (v) { return haut + (H - haut - bas) * (1 - v / max); };
    var s = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visites planifiées et réalisées">';
    [0, max / 2, max].forEach(function (v) {
      s += '<line class="grille" x1="' + g + '" x2="' + W + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text x="' + (g - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>';
    });
    var pas = Math.ceil(n / 12);
    donnees.forEach(function (d, i) {
      var x = g + i * bande + (bande - lw) / 2, base = y(0);
      var hp = base - y(Math.max(d.prevu, d.fait)), hf = base - y(d.fait);
      s += '<g data-tip="' + esc(d.tip) + '"><rect x="' + (g + i * bande).toFixed(1) + '" y="' + haut + '" width="' + bande.toFixed(1) + '" height="' + (H - haut - bas) + '" fill="transparent"/>' +
        '<path class="piste" d="' + barreV(+x.toFixed(1), +(base - hp).toFixed(1), +lw.toFixed(1), +hp.toFixed(1)) + '"/>' +
        '<path class="serie" d="' + barreV(+x.toFixed(1), +(base - hf).toFixed(1), +lw.toFixed(1), +hf.toFixed(1)) + '"/></g>';
      if (i % pas === 0) s += '<text x="' + (x + lw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(d.lib) + '</text>';
    });
    if (objectif) s += '<line class="objectif" x1="' + g + '" x2="' + W + '" y1="' + y(objectif).toFixed(1) + '" y2="' + y(objectif).toFixed(1) + '"/>';
    return s + '</svg>';
  }
  // Barres horizontales : libellé à gauche, valeur en bout de barre ; piste facultative (planifiées)
  function barres(donnees) {
    var W = 340, lh = 26, gl = 104, dr = 58, H = donnees.length * lh + 4;
    var max = Math.max(1, Math.max.apply(null, donnees.map(function (d) { return Math.max(d.val, d.piste || 0); })));
    var larg = W - gl - dr, s = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Graphique en barres">';
    donnees.forEach(function (d, i) {
      var y0 = i * lh + 4, bh = 14, yb = y0 + (lh - bh) / 2 - 2;
      var wp = larg * (d.piste || 0) / max, wv = larg * d.val / max;
      var lib = d.lib.length > 16 ? d.lib.slice(0, 15) + '…' : d.lib;
      s += '<g data-tip="' + esc(d.tip) + '"><rect x="0" y="' + y0 + '" width="' + W + '" height="' + lh + '" fill="transparent"/>' +
        '<text class="lib" x="' + (gl - 8) + '" y="' + (yb + 11) + '" text-anchor="end">' + esc(lib) + '</text>' +
        (d.piste !== undefined ? '<path class="piste" d="' + barreH(gl, +yb.toFixed(1), +Math.max(wp, wv).toFixed(1), bh) + '"/>' : '') +
        '<path class="serie" d="' + barreH(gl, +yb.toFixed(1), +wv.toFixed(1), bh) + '"/>' +
        '<text class="val" x="' + (gl + Math.max(wp, wv) + 6).toFixed(1) + '" y="' + (yb + 11) + '">' + esc(d.etiquette) + '</text></g>';
    });
    return s + '</svg>';
  }

  // Infobulle des graphiques (survol à la souris, toucher sur téléphone)
  function montrerInfobulle(el, x, y) {
    var b = $('infobulle'); if (!b) return;
    b.textContent = el.getAttribute('data-tip'); b.hidden = false;
    var w = b.offsetWidth, hgt = b.offsetHeight;
    b.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
    b.style.top = Math.max(8, y - hgt - 14) + 'px';
  }
  function cacherInfobulle() { var b = $('infobulle'); if (b) b.hidden = true; }
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest('.graph [data-tip]');
    if (el) montrerInfobulle(el, e.clientX, e.clientY); else if (e.pointerType === 'mouse') cacherInfobulle();
  });
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest('.graph [data-tip]');
    if (el) montrerInfobulle(el, e.clientX, e.clientY); else cacherInfobulle();
  });
  window.addEventListener('scroll', cacherInfobulle, { passive: true });

  // ------------------------------------------------------------------ Vue : historique
  VUES.historique = function (integre) {
    var enAttente = S.queue.slice().reverse().map(function (v) { v = Object.assign({}, v); v.attente = true; return v; });
    var tout = enAttente.concat((S.data.historique || []).filter(function (v) { return !S.queue.some(function (q) { return q.uid === v.uid; }); }));
    var hist = tout.filter(function (v) { return S.config.demo || quiCorrespond(v.delegue); });
    var t = aujourdhui(), lundi = lundiDe(t), mois = t.slice(0, 7), il30 = ajouterJours(t, -30), bh = bornesStats();
    var compte = function (v) { return Moteur.estVisite(v.statut, statuts()); };
    var sem = hist.filter(function (v) { return v.date >= lundi && compte(v); }).length;
    var moisN = hist.filter(function (v) { return String(v.date).slice(0, 7) === mois && compte(v); }).length;
    var derniers = hist.filter(function (v) { return v.date >= il30; });
    var taux = derniers.length ? 100 * derniers.filter(compte).length / derniers.length : null;
    var h = (integre ? '' : '<h2 class="titre-vue">Historique</h2>') + '<div class="chiffres">' +
      '<div class="chiffre"><b>' + sem + '</b><span>visites cette semaine</span></div>' +
      '<div class="chiffre"><b>' + moisN + '</b><span>visites ce mois-ci</span></div>' +
      '<div class="chiffre"><b>' + (taux === null ? 'n.d.' : pct(taux)) + '</b><span>présence sur 30 jours</span></div></div>';
    if (S.queue.length) h += '<div class="bandeau"><p>' + S.queue.length + ' compte(s) rendu(s) en attente d\'envoi. Ils partiront dès que le réseau revient.</p></div>';
    var liste = hist.filter(function (v) { var d = String(v.date || '').slice(0, 10); return v.attente || (d >= bh[0] && d <= bh[1]); });
    h += '<p class="discret" style="margin:12px 0 8px">' + liste.length + ' visite' + (liste.length > 1 ? 's' : '') + ' · ' + esc(libelleQui()) + ' · ' + esc(libelleBornes(bh)) + '</p>';
    if (!liste.length) return h + '<div class="vide"><strong>Aucune visite sur cette période</strong>Changez de période ou de délégués.</div>';
    return h + '<ul class="liste">' + liste.slice(0, 150).map(function (v) {
      return '<li class="element' + classeType(v) + '"><div class="element-tete"><div>' +
        '<span class="element-titre">' + pastilleType(v) + esc(v.nom) + '</span>' +
        '<span class="discret bloc-texte">' + esc(v.lieu) + ', ' + esc(v.quartier) + '</span>' +
        (v.activite ? '<span class="bloc-texte discret" style="margin-top:4px">' + esc(v.activite) + '</span>' : '') +
        (v.produits ? '<span class="bloc-texte discret" style="margin-top:4px">Produits : ' + esc(v.produits) + '</span>' : '') +
        (v.commentaire ? '<span class="bloc-texte" style="margin-top:4px">' + esc(v.commentaire) + '</span>' : '') +
        (v.prochaine ? '<span class="bloc-texte discret">Prochain RDV le ' + dateCourte(String(v.prochaine).slice(0, 10)) + '</span>' : '') +
        '<span class="etiquettes"><span class="etiquette ' + (compte(v) ? 'ok' : 'ko') + '">' + esc(v.statut) + '</span>' +
        (v.attente ? '<span class="etiquette p1">En attente d\'envoi</span>' : '') +
        (v.delegue && !estMoi(v.delegue) ? '<span class="etiquette equipe">' + esc(v.delegue) + '</span>' : '') + '</span></div>' +
        '<div class="element-mesure">' + (v.date ? dateCourte(v.date) : '') + '<small>' + esc(v.creneau) + '</small></div></div></li>';
    }).join('') + '</ul>';
  };

  // ------------------------------------------------------------------ Vue : réglages
  VUES.reglages = function () {
    var c = S.config;
    var qOpts = '<option value="">Aucun (début à la première visite)</option>' + quartiers().map(function (q) {
      return '<option' + (q.quartier === c.depart ? ' selected' : '') + '>' + esc(q.quartier) + '</option>';
    }).join('');
    var h = '<h2 class="titre-vue">Réglages</h2><p class="sous-titre">Votre profil, l\'apparence, le partage et l\'installation de l\'application.</p>';
    h += '<section class="bloc"><h3 style="margin-top:0">Mon profil</h3>' +
      champNom('cfgNom', c.delegue || '', 'Votre nom (visible par vos collègues)') +
      '<label class="champ"><span>Votre numéro WhatsApp</span><input type="tel" id="cfgWhatsapp" inputmode="tel" placeholder="Ex. 07 07 07 07 07" value="' + esc(c.whatsapp || '') + '"></label>' +
      '<label class="champ"><span>WhatsApp Superviseur</span><input type="tel" id="cfgWaResp" inputmode="tel" placeholder="Facultatif" value="' + esc(c.waResp || '') + '"></label>' +
      '<label class="interrupteur"><span>Toujours ouvrir WhatsApp Web</span><input type="checkbox" id="cfgWaWeb"' + (c.waWeb ? ' checked' : '') + '></label>' +
      '<div class="champ"><span>Mon quartier</span>' + selecteurListe('cfgDepart', { titre: 'Mon quartier', dom: true, valeur: c.depart || '', vide: 'Choisir un quartier…', sections: sectionsQuartiers() }) + '</div>' +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="enregistrerMoi">Enregistrer</button></section>';
    // 3.26.73 : notifications du téléphone
    var nOk = typeof Notification !== 'undefined', nPerm = nOk ? Notification.permission : 'denied', nAct = LS.get('notifs', false) && nPerm === 'granted';
    h += '<section class="bloc"><h3 style="margin-top:0">Notifications</h3>' +
      '<p class="discret" style="margin:0 0 8px">Pharmacie ou médecin du jour à moins de 500 m, médecin aussi prévu par un collègue. Affichées quand l\'application est ouverte ou vient d\'être mise en arrière-plan.</p>' +
      (!nOk ? '<p class="discret">Ce navigateur ne gère pas les notifications. Installez l\'application depuis Chrome.</p>' :
        nPerm === 'denied' ? '<p class="discret">Notifications bloquées : autorisez-les dans les réglages du navigateur (cadenas › Autorisations › Notifications).</p>' :
        '<button class="bouton bouton-large' + (nAct ? '' : ' bouton-plein') + '" type="button" data-a="notifBascule">' + (nAct ? 'Désactiver les notifications' : 'Activer les notifications') + '</button>' +
        (nAct ? '<button class="bouton-texte" type="button" data-a="notifTest" style="display:block;margin:8px auto 0">Envoyer une notification d\'essai</button>' : '')) +
      '</section>';
    var th = LS.get('theme', 'clair');
    h += '<section class="bloc"><h3>Apparence</h3><div class="segment" role="group" aria-label="Thème" style="margin:0">' +
      [['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(function (x) {
        return '<button type="button" data-a="theme" data-v="' + x[0] + '" aria-pressed="' + (th === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div><p class="discret" style="margin:8px 0 0">Auto suit le réglage du téléphone.</p></section>';
    if (connecte()) {
      h += '<section class="bloc"><h3 style="margin-top:0">Partager avec un collègue</h3>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="partager" style="margin-bottom:6px">Partager l\'application</button>' +
        '<p class="discret" style="margin:0">Le lien donne accès à la base : envoyez-le uniquement à vos collègues.</p></section>';
    }
    // 3.19.0 : un bouton, comme « Partager » ; masqué quand l'application est déjà installée
    // 3.24.13 : toujours visible ; déjà installée (ouverte depuis l'icône), le bouton le dit au lieu de disparaître
    h += '<section class="bloc"><h3 style="margin-top:0">Installer sur le téléphone</h3>' + (estInstallee() ?
      '<button class="bouton bouton-large" type="button" disabled aria-disabled="true">' + icone('valider') + 'Application installée</button>' :
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="installer">' + icone('telecharger') + 'Installer l\'application</button>') + '</section>';
    h += '<section class="bloc"><h3>MediPlanner</h3><p class="discret" style="margin-top:0">Version ' + APP_VERSION +
      '. Les mises à jour sont signalées par un bandeau en haut de l\'écran ; vos données restent sur le téléphone.</p>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="verifierMaj">Recherche MàJ</button>' +
      '<button class="bouton" type="button" data-a="ouvrirLancement">Écran d\'accueil</button></div></section>';
    // Avancé : connexion à la base, synchronisation, démonstration, effacement
    h += '<details class="bloc avance"' + (!c.url || S.ui.erreur ? ' open' : '') + '><summary><b>Avancé</b><span class="discret">Connexion à la base et données du téléphone</span></summary>' +
      '<h3>Saisie</h3><label class="interrupteur"><span>Saisie avancée<small class="discret bloc-texte">Comptes rendus des jours passés et à venir. Désactivée : seul le jour même se saisit ; la planification des jours à venir reste possible.</small></span>' +
        '<input type="checkbox" data-f="saisieAvancee"' + (c.modifPasse && c.saisieFutur ? ' checked' : '') + '></label>' +
      '<label class="interrupteur" style="margin-top:10px"><span>Compte rendu express<small class="discret bloc-texte">Saisie rapide des visites de routine sur un seul écran (statut, types, produits et prochain RDV). Le formulaire complet reste accessible d\'un clic.</small></span>' +
        '<input type="checkbox" data-f="crExpress"' + (c.crExpress ? ' checked' : '') + '></label>' +
      '<h3>Connexion au Google Sheet</h3>' +
      '<label class="champ"><span>URL de l\'application Web</span><input type="url" id="cfgUrl" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>' +
      '<label class="champ"><span>Jeton d\'accès</span><input type="text" id="cfgToken" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(c.token) + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="tester">Tester</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="enregistrerConnexion">Enregistrer</button></div>' +
      (S.ui.erreur ? '<p class="discret" style="color:var(--rouge);margin-bottom:0">' + esc(S.ui.erreur) + '</p>' : '') +
      (S.data && S.data.praticiens && !S.data.serveurRecent && connecte() ? '<p class="discret" style="color:var(--rouge)">Ce téléphone est relié à une ancienne version du serveur : touchez « Synchroniser maintenant » pour basculer automatiquement sur le serveur à jour.</p>' : '') +
      (connecte() ? '<p class="discret" style="margin:4px 0 0">Serveur : …' + esc(String(S.config.url).replace(/\/exec.*$/, '').slice(-6)) + '</p>' : '') +
      '<h3>Données</h3><p class="discret" style="margin-top:0">' +
      (S.config.demo ? 'Mode démonstration : les données restent sur ce téléphone.' :
        (S.data && S.data.syncedAt ? 'Dernière synchronisation : ' + new Date(S.data.syncedAt).toLocaleString('fr-FR') + '.' : 'Pas encore synchronisé.')) +
      (pret() ? ' ' + S.data.praticiens.length + ' praticiens, ' + S.data.presences.length + ' lieux de présence.' : '') +
      (S.queue.length ? ' ' + S.queue.length + ' compte(s) rendu(s) en attente.' : '') +
      (S.fiches.length ? ' ' + S.fiches.length + ' fiche(s) praticien en attente' + (S.ui.serveurAncien ? ' : le serveur Apps Script doit être mis à jour pour les recevoir.' : '.') : '') + '</p>' +
      (connecte() ? '<button class="bouton bouton-large" type="button" data-a="sync" style="margin-bottom:10px">Synchroniser maintenant</button>' +
        '<button class="bouton bouton-large" type="button" data-a="rechargerBase" style="margin-bottom:10px">Recharger toute la base</button>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="demo" style="margin-bottom:10px">Charger les données de démonstration</button>' +
      '<h3>Sauvegarde</h3><p class="discret" style="margin-top:0">' +
        (S.data && S.data.sauvegarde ? 'Base : dernière copie le ' + new Date(S.data.sauvegarde).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' (7 copies dans Drive).' : 'Base : sauvegarde quotidienne à installer dans le Google Sheet (menu MediPlanner › Sauvegardes).') +
        ' Téléphone : ' + Object.keys(LS.get('secours', {})).length + ' copie(s) sur 7 jours.</p>' +
      '<div class="rangee" style="margin-bottom:10px"><button class="bouton" type="button" data-a="exporterSecours">' + icone('telecharger') + 'Exporter</button>' +
        '<label class="bouton" style="position:relative;overflow:hidden">' + icone('relancer') + 'Importer<input type="file" accept="application/json,.json" data-f="importSecours" style="position:absolute;inset:0;opacity:0"></label></div>' +
      '<button class="bouton bouton-large bouton-danger" type="button" data-a="reinitialiser">Effacer les données de ce téléphone</button></details>';
    return h;
  };

