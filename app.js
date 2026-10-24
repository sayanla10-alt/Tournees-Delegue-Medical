/* =============================================================================
   app.js : interface de MediPlanner v2.0.0 (anciennement « Tournées »)
   - Données en cache sur le téléphone : tout fonctionne hors ligne
   - Visites, fiches praticiens et tournées envoyées au Google Sheet dès que possible
   - Écran de lancement, statistiques, filtres avancés, fiche praticien en 4 étapes,
     actions rapides (appel, SMS, Waze, Maps), thème clair / sombre
   - Mises à jour : bandeau « Mise à jour disponible » piloté par le service worker
   ============================================================================= */
(function () {
  'use strict';

  var APP_VERSION = '3.0.3', EDITION = 'Enterprise';
  // Nouveautés par version : l'écran d'accueil affiche, une seule fois, celles des versions
  // publiées depuis la dernière ouverture du téléphone
  var JOURNAL = [
    ['3.0.3', ['L\'onglet « Ma semaine » s\'appelle désormais « Planifier »']],
    ['3.0.2', ['Compte rendu : les champs se déploient dès que le résultat de la visite est choisi']],
    ['3.0.1', ['Compte rendu complet de nouveau visible d\'emblée : vu ou non, type de visite, produits présentés, ce qui est ressorti de la discussion, prochaine étape']],
    ['3.0.0', ['Nouvelle organisation en 5 onglets qui suivent votre journée : Aujourd\'hui, Ma semaine, Praticiens, Équipe, Bilan',
               'Aujourd\'hui : vos visites dans l\'ordre, contact en premier, compte rendu guidé (résultat d\'abord, puis le détail)',
               'Ma semaine : réglages, proposition, médecins gardés ou retirés, confirmation et envoi WhatsApp, communes visitées',
               'Autour de moi s\'ouvre depuis Aujourd\'hui ou depuis une visite non faite (« Trouver un remplaçant »)',
               'Vocabulaire simplifié : tournée confirmée, brouillon, RDV, prioritaire, prochain RDV, communes visitées, taux de réalisation',
               'Réglages allégés : connexion et effacement des données rangés dans « Avancé »']],
    ['2.2.7', ['L\'application rouvre sur l\'onglet où vous étiez, après un rafraîchissement ou une mise à jour']],
    ['2.2.6', ['« Vu il y a … j » mis à jour dès qu\'un compte rendu est validé', 'Prochaine étape traitée comme un RDV : le praticien est placé d\'office ce jour-là dans la tournée']],
    ['2.2.5', ['Tournée : bouton « Valider ce compte rendu » dans chaque fiche de visite, et « Modifier le compte rendu » une fois validé']],
    ['2.2.4', ['Filtres : les spécialités ne concernent que les médecins ; elles sont ignorées (mais conservées) en choisissant Pharmacies']],
    ['2.2.3', ['Autour : pharmacies affichées du lundi au vendredi, sur toute leur plage horaire']],
    ['2.2.1', ['Titre « Tournée » affiché en haut de l\'onglet, comme les autres onglets']],
    ['2.2.0', ['Message WhatsApp : une puce devant chaque médecin',
               'Chaque onglet présente son rôle en une phrase',
               'Autour : mêmes filtres que Contacts, rayon 2 km et « Maintenant » par défaut, filtre Tout / Médecins / Pharmacies',
               'Programme validé toujours modifiable (il reste validé pour l\'équipe) ; compte rendu enregistré corrigeable',
               'Tournée : couverture « Jour » et « Couvertes » par défaut ; vos filtres restent mémorisés',
               'Type de visite : Routine, Réunion, Staff, Déjeuner, Garde ; produits de la gamme en un toucher',
               'Synchronisation plus fiable : nouvelles tentatives automatiques, aucune saisie perdue',
               'Formulaires et listes déroulantes modernisés',
               'Un praticien d\'un programme validé par un collègue n\'est plus proposé']],
    ['2.1.1', ['Fond de carte OpenStreetMap épuré (clair et sombre)']],
    ['2.1.0', ['Pharmacies réelles d\'Abidjan (OpenStreetMap) dans leur propre feuille, ouvertes matin et soir',
               'Jours fériés signalés, d\'après le calendrier officiel de la Côte d\'Ivoire',
               'Type de visite (routine, présentation produit, EPU…) dans le compte rendu et les statistiques',
               'WhatsApp à la place de Waze dans les fiches', 'Cartes modernes pour la couverture et les tournées de l\'équipe',
               'Après validation, l\'envoi du programme est proposé ; établissements en gras dans le message']],
    ['2.0.7', ['Couverture repliée par défaut sous la tournée (un toucher pour la carte et les communes)']],
    ['2.0.6', ['Compte rendu : produits présentés et date de prochaine étape (le praticien remonte en priorité à cette date)',
               'Temps de trajet plus réalistes : heures de pointe et traversée de la lagune',
               'Jours fériés et absences des praticiens respectés dans les tournées',
               'Lieux où le praticien est souvent absent signalés et proposés en dernier',
               'Nom du délégué choisi dans une liste', 'Historique regroupé dans l\'onglet Stats', 'Synchronisation plus légère']],
    ['2.0.5', ['Filtres sélectionnés de nouveau en couleur pleine, bien visibles', 'Base de test complétée : téléphones fictifs, derniers statuts et commentaires, positions GPS des établissements']],
    ['2.0.4', ['Filtres modernisés : puces cochées, recherche dans les listes, groupes repliables, filtres rapides en un toucher',
               'Thème clair par défaut ; tournée sans pharmacies par défaut', 'Sur tablette, les fenêtres s\'ouvrent au centre de l\'écran']],
    ['2.0.3', ['Les nouveautés ne s\'affichent qu\'une fois par mise à jour', 'L\'application se lance seule quelques secondes après l\'écran d\'accueil']],
    ['2.0.2', ['Message WhatsApp simplifié : titre, date, votre nom, puis chaque établissement avec ses médecins']],
    ['2.0.1', ['Potentiel de prescription de nouveau affiché en étoiles (★ à ★★★)']],
    ['2.0.0', ['Nouveau nom : MediPlanner, avec un écran d\'accueil et les chiffres clés',
               'Onglet Stats : couverture, objectifs, activité par commune et par spécialité',
               'Filtres avancés cumulables dans Contacts (spécialités, communes, potentiel ★ à ★★★, dernière visite)',
               'Tournée : spécialités ciblées, pharmacies oui/non, durée estimée et itinéraire du jour',
               'Fiche praticien en 4 étapes depuis le téléphone, même hors ligne',
               'Appeler, SMS, Waze ou Google Maps depuis chaque fiche',
               'Mode sombre (Réglages) et mises à jour signalées par un bandeau']]
  ];
  function compVersion(a, b) {
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    for (var i = 0; i < 3; i++) { var d = (+x[i] || 0) - (+y[i] || 0); if (d) return d; }
    return 0;
  }
  var DELAI_LANCEMENT = 5, DELAI_LANCEMENT_NOUVEAUTES = 10;   // secondes avant le lancement automatique

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
    fiches: LS.get('fiches', []),
    ui: {
      tab: (function () {
        // 3.0.0 : nouveaux onglets du parcours (anciens noms convertis)
        var t = LS.get('onglet', 'jour'), anciens = { tournee: 'jour', contacts: 'praticiens', stats: 'bilan', historique: 'bilan' };
        t = anciens[t] || t;
        return ['jour', 'semaine', 'autour', 'praticiens', 'bilan', 'equipe', 'reglages'].indexOf(t) >= 0 ? t : 'jour';
      })(), jour: null, ouvert: null, voirParams: false, feuille: null,
      recherche: '', filtre: 'tous', contactOuvert: null, limite: 40,
      sync: 'idle', erreur: '', installEvt: null, enCours: false,
      collegue: null, jourEquipe: null, histFiltre: LS.get('histFiltre', 'moi'), rechercheAutour: '',
      couvPortee: LS.get('couvPortee', 'jour'), couvFiltre: LS.get('couvFiltre', 'couvertes'), couvOuverte: LS.get('couvOuverte', false),
      statsVue: LS.get('statsVue', 'tableau'),
      autour: LS.get('autour', { lat: null, lon: null, label: '', moment: 'maintenant', date: '', heure: '', rayon: 2, ref: null }),
      aPublier: LS.get('aPublier', false), portee: LS.get('portee', null), conflits: [],
      filtres: null, tri: LS.get('tri', 'priorite'), stats: null, lancement: false
    }
  };
  var FILTRES_VIDES = { specialites: [], communes: [], potentiels: [], visite: 'tous', conv: 'tous', type: 'tous', equipe: 'tous' };
  S.ui.filtres = Object.assign({}, FILTRES_VIDES, LS.get('filtres', {}));
  S.ui.filtresAutour = Object.assign({}, FILTRES_VIDES, LS.get('filtresAutour', {}));
  // « Pharmacien » n'est plus une spécialité filtrable (2.2.4)
  [S.ui.filtres, S.ui.filtresAutour].forEach(function (f) { f.specialites = (f.specialites || []).filter(function (x) { return x !== 'Pharmacien'; }); });
  // 2.2.0 : nouveaux réglages par défaut (une seule fois)
  if (!LS.get('defauts220', false)) {
    S.ui.autour.moment = 'maintenant'; S.ui.autour.rayon = 2; LS.set('autour', S.ui.autour);
    S.ui.couvPortee = 'jour'; S.ui.couvFiltre = 'couvertes'; LS.set('couvPortee', 'jour'); LS.set('couvFiltre', 'couvertes');
    LS.set('defauts220', true);
  }
  // Contacts et Autour ont chacun leur propre jeu de filtres, conservé jusqu'à modification
  function cleFiltres() { return S.ui.tab === 'autour' ? 'filtresAutour' : 'filtres'; }
  function filtresCour() { return S.ui[cleFiltres()]; }
  function rechercheCour() { return S.ui.tab === 'autour' ? S.ui.rechercheAutour : S.ui.recherche; }
  function majFiltres(f) { S.ui[cleFiltres()] = f; LS.set(cleFiltres(), f); S.ui.limite = 40; }
  S.ui.stats = Object.assign({ periode: 'semaine', debut: '', fin: '', portee: 'moi', objectif: 40, vueSpec: 'base' }, LS.get('stats', {}));
  // L'ancienne tournée publiée est retirée de la feuille Plannings pour ne pas bloquer les collègues
  if (ancienPlan) {
    var auj = aujourdhui();
    S.ui.portee = { debut: ajouterJours(auj, -7), fin: ajouterJours(auj, 28) }; LS.set('portee', S.ui.portee);
    S.ui.aPublier = true; LS.set('aPublier', true);
  }
  var defautParams = { mode: 'semaine', dateRef: semaineParDefaut(aujourdhui()), communes: [], parJour: false,
                       communesJour: {}, maxJour: 8, delai: 7, eviterCollegues: true,
                       specialites: [], typeCibles: 'medecins', potentiels: [] };
  S.params = Object.assign({}, defautParams, S.params || {});
  if (!Array.isArray(S.params.communes)) S.params.communes = [];
  if (!Array.isArray(S.params.specialites)) S.params.specialites = [];
  // v2.0.4 : par défaut, tournée sans pharmacies (réglage appliqué une fois aux téléphones existants)
  if (!S.params.defauts204) { S.params.typeCibles = 'medecins'; S.params.defauts204 = true; LS.set('params', S.params); }
  if (!Array.isArray(S.params.potentiels)) S.params.potentiels = [];
  S.config = Object.assign({ whatsapp: '', waWeb: false, depart: '', delegue: '' }, S.config);

  function sauver() {
    LS.set('config', S.config); LS.set('data', S.data); LS.set('plan', S.plan); LS.set('programme', S.programme);
    LS.set('params', S.params); LS.set('queue', S.queue); LS.set('imposes', S.imposes); LS.set('rejetes', S.rejetes);
    LS.set('fiches', S.fiches);
  }
  function enAttente() { return S.queue.length + S.fiches.length; }

  function pret() { return !!(S.data && S.data.praticiens && S.data.praticiens.length); }
  function statuts() { return (S.data && S.data.statuts && S.data.statuts.length) ? S.data.statuts : STATUTS_DEFAUT; }
  function quartiers() { return (S.data && S.data.quartiers && S.data.quartiers.length) ? S.data.quartiers : quartiersDefautObjets(); }

  // Contexte du moteur, reconstruit seulement quand les données changent
  var ctxCache = { data: null, ctx: null };
  function ctx() {
    if (ctxCache.data !== S.data) ctxCache = { data: S.data, ctx: Moteur.preparer(Object.assign({}, S.data, { feries: feries() })) };
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
    return j <= 0 ? 'Vu aujourd\'hui' : 'Vu il y a ' + j + ' j';
  }
  // Potentiel de prescription affiché en étoiles : 3 = ★★★ (fort), 2 = ★★ (moyen), 1 = ★ (faible)
  var LIB_POTENTIEL = { A: 'fort', B: 'moyen', C: 'faible' };
  var ETOILES = { A: '★★★', B: '★★', C: '★' };
  function etoiles(n) {
    var k = lireNote(n), l = lettrePotentiel(n);
    return '<span class="note" title="Potentiel de prescription ' + k + ' sur 3 (' + LIB_POTENTIEL[l] + ')" aria-label="Potentiel ' + k + ' sur 3">' +
      '★★★'.slice(0, k) + '<i>' + '★★★'.slice(0, 3 - k) + '</i></span>';
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

  function libelleListe(l, tous) {
    if (!l || !l.length) return tous;
    return l.length <= 3 ? l.join(', ') : l.slice(0, 2).join(', ') + ' et ' + (l.length - 2) + ' autres';
  }
  function duree(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' h' + (m ? ' ' + pad2(m) : '') : m + ' min';
  }
  // Filtre du tirage : types de praticiens, spécialités et potentiels ciblés
  function filtreCibles() {
    var p = S.params, t = p.typeCibles || 'tous', sp = {}, po = {};
    (p.specialites || []).forEach(function (x) { sp[x] = true; });
    (p.potentiels || []).forEach(function (x) { po[x] = true; });
    var avecSpec = t !== 'pharmacies' && p.specialites && p.specialites.length, avecPot = p.potentiels && p.potentiels.length;
    if (t === 'tous' && !avecSpec && !avecPot) return null;
    return function (pr) {
      var pharma = pr.type === 'Pharmacie';
      if (t === 'medecins' && pharma) return false;
      if (t === 'pharmacies' && !pharma) return false;
      if (avecSpec && !pharma && !sp[pr.specialite]) return false;
      if (avecPot && !po[lettrePotentiel(pr.note)]) return false;
      return true;
    };
  }
  function libelleCibles() {
    var p = S.params, l = [];
    if (p.typeCibles === 'medecins') l.push('sans pharmacies');
    if (p.typeCibles === 'pharmacies') l.push('pharmacies seules');
    if (p.typeCibles !== 'pharmacies' && p.specialites.length) l.push(libelleListe(p.specialites, ''));
    if (p.potentiels.length) l.push(p.potentiels.slice().sort().map(function (x) { return ETOILES[x]; }).join(' / '));
    return l.join(', ');
  }
  function specialitesListe() {
    var n = {}, prat = ctx().prat;
    Object.keys(prat).forEach(function (k) { var p = prat[k]; if (p.type !== 'Pharmacie' && p.specialite) n[p.specialite] = (n[p.specialite] || 0) + 1; });
    return Object.keys(n).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (k) { return { nom: k, n: n[k] }; });
  }
  // Durée estimée d'une journée : du premier RDV à la fin de la dernière visite
  function estimationJour(l) {
    var R = REGLAGES_MOTEUR, deb = null, fin = null, dist = 0;
    l.forEach(function (a) {
      var h = heureVersMinutes(a.heure);
      if (h !== null) { if (deb === null || h < deb) deb = h; if (fin === null || h + R.dureeVisite > fin) fin = h + R.dureeVisite; }
      dist += a.trajet !== undefined ? a.trajet : (a.dist || 0) * R.minutesParKm;
    });
    if (deb === null) return null;
    return { debut: deb, fin: fin, trajet: Math.round(dist) };
  }
  // Appeler, SMS, Waze, Google Maps
  function actionsRapides(o) {
    var num = normaliserNumero(o.telephone), tel = num ? '+' + num : '';
    var pos = o.lat && o.lon && isFinite(+o.lat) && isFinite(+o.lon) ? (+o.lat).toFixed(5) + ',' + (+o.lon).toFixed(5) : '';
    var q = [o.lieu, o.quartier, o.commune, 'Abidjan'].filter(Boolean).join(', ');
    var gmaps = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + (pos || encodeURIComponent(q));
    function lien(href, ic, lib, actif, externe) {
      return actif ? '<a class="action-rapide" href="' + esc(href) + '"' + (externe ? ' target="_blank" rel="noopener"' : '') + '>' + icone(ic) + lib + '</a>'
        : '<a class="action-rapide" aria-disabled="true" title="Numéro de téléphone non renseigné">' + icone(ic) + lib + '</a>';
    }
    return '<div class="actions-rapides" role="group" aria-label="Actions rapides">' +
      lien('tel:' + tel, 'tel', 'Appeler', !!tel) + lien('sms:' + tel, 'sms', 'SMS', !!tel) +
      lien('https://wa.me/' + num, 'whatsapp', 'WhatsApp', !!num, true) + lien(gmaps, 'carte', 'Maps', true, true) + '</div>';
  }
  // Contrôle segmenté (un seul choix) : [[valeur, libellé], ...]
  function segment(titre, action, options, valeur, style) {
    return '<div class="segment" role="group" aria-label="' + esc(titre) + '"' + (style ? ' style="' + style + '"' : '') + '>' + options.map(function (o) {
      return '<button type="button" data-a="' + action + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(valeur) === String(o[0])) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  // Groupe de puces dans une fenêtre de filtres.
  // o : { id, titre, chemin (ex. 'brouillon.specialites' ou 'sel'), multiple, options: [{v, lib, n}],
  //       sections: [{titre, options}], recherche, repliable, resume, aide }
  function groupeChoix(f, o) {
    var val = valeurChemin(o.chemin), sel = o.multiple ? ensemble(val) : null;
    var ouvert = !o.repliable || !!(f.ouverts && f.ouverts[o.id]);
    var q = normaliser((f.q && f.q[o.id]) || '');
    function puce(op) {
      var actif = o.multiple ? !!sel[op.v] : val === op.v;
      return '<button type="button" class="puce" data-a="choix" data-chemin="' + o.chemin + '" data-m="' + (o.multiple ? 1 : 0) + '" data-v="' + esc(op.v) +
        '" data-lib="' + esc(normaliser(op.lib)) + '" aria-pressed="' + actif + '"' + (q && normaliser(op.lib).indexOf(q) < 0 ? ' hidden' : '') + '>' +
        esc(op.lib) + (op.n !== undefined ? '<small>' + op.n + '</small>' : '') + '</button>';
    }
    var nb = o.multiple ? val.length : 0;
    var resume = o.multiple ? (nb ? (nb <= 2 ? val.join(', ') : nb + ' choisis') : (o.resume || 'Tous')) : '';
    var h = '<section class="groupe-filtre' + (ouvert ? ' ouvert' : '') + '" data-groupe="' + o.id + '">' +
      '<div class="groupe-tete">' + (o.repliable ? '<button type="button" class="groupe-bascule" data-a="basculeGroupe" data-v="' + o.id + '" aria-expanded="' + ouvert + '">' : '<div class="groupe-bascule">') +
      '<b>' + esc(o.titre) + '</b>' + (nb ? '<span class="compteur">' + nb + '</span>' : '') + (o.repliable ? '<small>' + esc(resume) + '</small>' + icone('chevron') + '</button>' : '</div>') +
      (o.multiple && ouvert ? '<span class="groupe-actions"><button type="button" class="lien-action" data-a="groupeTout" data-chemin="' + o.chemin + '">Tout</button>' +
        (nb ? '<button type="button" class="lien-action" data-a="groupeAucun" data-chemin="' + o.chemin + '">Effacer</button>' : '') + '</span>' : '') + '</div>';
    if (!ouvert) return h + '</section>';
    if (o.aide) h += '<p class="discret groupe-aide">' + esc(o.aide) + '</p>';
    if (o.recherche) h += '<div class="recherche petite">' + icone('loupe') + '<input type="search" data-f="chercheOption" data-g="' + o.id + '" placeholder="Rechercher…" value="' +
      esc((f.q && f.q[o.id]) || '') + '" aria-label="Rechercher dans ' + esc(o.titre) + '"></div>';
    if (o.sections) {
      o.sections.forEach(function (sec) {
        h += '<div class="section-choix"><div class="sous-titre-zone"><span>' + esc(sec.titre) + '</span>' +
          (o.multiple ? '<button type="button" class="lien-action" data-a="sectionToute" data-chemin="' + o.chemin + '">Toute la zone</button>' : '') + '</div>' +
          '<div class="puces">' + sec.options.map(puce).join('') + '</div></div>';
      });
    } else h += '<div class="puces">' + o.options.map(puce).join('') + '</div>';
    return h + '</section>';
  }
  function cheminObjet(chemin) {
    var o = S.ui.feuille, k = chemin.split('.');
    for (var i = 0; i < k.length - 1; i++) o = o[k[i]];
    return { o: o, k: k[k.length - 1] };
  }
  function valeurChemin(chemin) { var c = cheminObjet(chemin); return c.o[c.k]; }
  function sectionsCommunes() {
    var secs = [], idx = {};
    communesListe().forEach(function (c) {
      if (idx[c.zone] === undefined) { idx[c.zone] = secs.length; secs.push({ titre: c.zone, options: [] }); }
      secs[idx[c.zone]].options.push({ v: c.commune, lib: c.commune });
    });
    return secs;
  }
  // Nom du délégué : choisi dans la liste de la feuille Listes (évite les fautes de frappe entre collègues)
  function champNom(id, valeur, libelle) {
    var l = (S.data && S.data.delegues) || [];
    if (!l.length) return '<label class="champ"><span>' + libelle + '</span><input type="text" id="' + id + '" autocomplete="name" placeholder="Ex. Koffi Yao" value="' + esc(valeur) + '"></label>';
    var autre = valeur && l.indexOf(valeur) < 0;
    return '<label class="champ"><span>' + libelle + '</span><select id="' + id + '" data-f="choixNom"><option value="">Choisir mon nom…</option>' +
      l.map(function (n) { return '<option' + (n === valeur ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') +
      '<option value="__autre"' + (autre ? ' selected' : '') + '>Mon nom n\'est pas dans la liste</option></select></label>' +
      '<label class="champ" id="' + id + 'Bloc"' + (autre ? '' : ' hidden') + '><span>Nom complet</span><input type="text" id="' + id + 'Autre" autocomplete="name" value="' + esc(autre ? valeur : '') + '">' +
      '<span class="aide-champ">Demandez aussi qu\'on vous ajoute dans la feuille Listes, colonne Délégués.</span></label>';
  }
  function lireNom(id) {
    var el = $(id); if (!el) return '';
    if (el.tagName === 'SELECT') return (el.value === '__autre' ? ($(id + 'Autre').value || '') : el.value).trim();
    return (el.value || '').trim();
  }
  // Produits déjà saisis : proposés à la saisie suivante
  function datalistProduits() {
    var l = LS.get('produits', []);
    return '<datalist id="listeProduits">' + l.map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist>';
  }
  function memoriserProduits(t) {
    var ref = produitsRef(), l = LS.get('produits', []);
    listeProduits(t).filter(function (n) { return ref.indexOf(n) < 0; }).forEach(function (n) {
      l = [n].concat(l.filter(function (x) { return x !== n; })).slice(0, 30);
    });
    LS.set('produits', l);
  }
  // Produits de la gamme (feuille Listes, colonne Produits) proposés en puces ; les autres en saisie libre
  function produitsRef() { return (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT; }
  function listeProduits(t) { return String(t || '').split(/\s*[,;]\s*/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function autresProduits(t) { var ref = produitsRef(); return listeProduits(t).filter(function (x) { return ref.indexOf(x) < 0; }); }
  function activites() { return (S.data && S.data.activites && S.data.activites.length) ? S.data.activites : ACTIVITES_DEFAUT; }
  function listeActivites(t) { return String(t || '').split(/\s*;\s*/).filter(Boolean).map(function (x) { return ACTIVITES_RENOMMEES[x] || x; }); }
  function ficheEnAttente(code) { return S.fiches.some(function (f) { return f.praticien.code === code; }); }

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
    return '<span class="etiquette equipe">' + (v ? 'Prévu par ' : 'Envisagé par ') + esc(l[0].delegue) + ', ' + dateCourte(l[0].date) +
      (l.length > 1 ? ' (+' + (l.length - 1) + ')' : '') + '</span>';
  }
  function exclusCollegues(dates) {
    var semaines = {}, ex = {};
    dates.forEach(function (d) { semaines[lundiDe(d)] = true; });
    arretsCollegues().forEach(function (p) { if (semaines[lundiDe(p.date)]) ex[p.code] = true; });
    return ex;
  }
  // Praticiens d'un programme validé par un collègue : jamais proposés, même si l'option « éviter » est désactivée
  function exclusValides(dates) {
    var semaines = {}, ex = {};
    dates.forEach(function (d) { semaines[lundiDe(d)] = true; });
    arretsCollegues().forEach(function (p) { if (p.programme === 'Validé' && semaines[lundiDe(p.date)]) ex[p.code] = true; });
    return ex;
  }

  // ------------------------------------------------------------------ API Google Apps Script
  // Erreur « réessayable » : réseau, délai, serveur occupé ou réponse non JSON (page d'erreur Google)
  function erreur(msg, reessai) { var e = new Error(msg); e.reessai = !!reessai; return e; }
  function appelUnique(url, options) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var minuteur = ctrl ? setTimeout(function () { ctrl.abort(); }, 45000) : null;
    var o = Object.assign({}, options); if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).then(function (r) {
      if (!r.ok) throw erreur('Le serveur a répondu ' + r.status + '.', r.status >= 500 || r.status === 429);
      return r.text().then(function (t) {
        try { return JSON.parse(t); } catch (x) { throw erreur('Le serveur est momentanément indisponible.', true); }
      });
    }, function (e) {
      throw erreur(e && e.name === 'AbortError' ? 'Le serveur ne répond pas (délai dépassé).' :
        'Connexion impossible. Vérifiez le réseau.', true);
    }).then(function (j) {
      if (minuteur) clearTimeout(minuteur);
      if (!j || !j.ok) throw erreur((j && j.erreur) || 'Réponse inattendue du serveur.', !!(j && j.reessai));
      return j;
    }, function (e) { if (minuteur) clearTimeout(minuteur); throw e; });
  }
  // Jusqu'à 3 tentatives espacées (1,5 s puis 4 s) pour les erreurs passagères
  function appel(url, options, essai) {
    essai = essai || 0;
    return appelUnique(url, options).catch(function (e) {
      if (!e.reessai || essai >= 2 || !navigator.onLine) throw e;
      return new Promise(function (ok) { setTimeout(ok, essai ? 4000 : 1500); }).then(function () { return appel(url, options, essai + 1); });
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
  function publierPlan(sansModif) {
    if (!sansModif) marquerModifie();
    if (!connecte()) return;
    S.ui.aPublier = true; LS.set('aPublier', true);
    synchroniser(true);
  }

  var minuteurReprise;
  function synchroniser(silencieux) {
    if (!connecte()) return Promise.resolve();
    if (S.ui.enCours) return Promise.resolve();
    if (!navigator.onLine) { S.ui.sync = 'horsligne'; afficherEntete(); return Promise.resolve(); }
    S.ui.enCours = true; S.ui.sync = 'encours'; afficherEntete();
    var tentePub = false;
    // 1. fiches praticiens (codes définitifs), 2. comptes rendus, 3. tournée, 4. données à jour
    var envoi = envoyerFiches().then(function () {
      return S.queue.length ? apiPost('valider', { visites: S.queue }).then(function (r) {
        var recus = {}; (r.recus || []).forEach(function (u) { recus[u] = true; });
        S.queue = S.queue.filter(function (v) { return !recus[v.uid]; });
        LS.set('queue', S.queue);
      }) : null;
    });
    return envoi.then(function () {
      if (!S.ui.aPublier || !moi()) return;
      tentePub = true;
      return apiPost('planning', chargePlan()).then(function (r) {
        S.ui.aPublier = false; LS.set('aPublier', false);
        S.ui.portee = porteePlan(); LS.set('portee', S.ui.portee);
        S.ui.conflits = r.conflits || [];
      });
    }).then(function () {
      // synchro allégée : empreinte des données de référence et date de la dernière visite connue
      var ref = S.data && S.data.sig && S.data.praticiens ? '&sig=' + encodeURIComponent(S.data.sig) : '';
      var hd = S.data && S.data.historique && S.data.historique.length ? S.data.historique.reduce(function (m, v) { return v.horodatage > m ? v.horodatage : m; }, '') : '';
      return apiGet('data' + ref + (hd ? '&hdepuis=' + encodeURIComponent(hd) : ''));
    }).then(function (d) {
      var ancien = S.data || {};
      var hist = d.historique || [];
      if (d.partiel) {
        var vus = {}; hist.forEach(function (v) { vus[v.uid] = true; });
        hist = hist.concat((ancien.historique || []).filter(function (v) { return !v.uid || !vus[v.uid]; }));
        hist.sort(function (a, b) { return String(b.horodatage || b.date) < String(a.horodatage || a.date) ? -1 : 1; });
        hist = hist.slice(0, 1500);
      }
      var base = d.inchange ? ancien : d;
      S.data = { version: d.version, sig: d.sig, praticiens: base.praticiens, presences: base.presences, quartiers: base.quartiers,
                 statuts: base.statuts, delegues: base.delegues || [], feries: base.feries || [], activites: base.activites || [], produits: base.produits || [],
                 historique: hist, plannings: d.plannings || [], syncedAt: new Date().toISOString() };
      S.queue.forEach(function (v) { Moteur.appliquerVisite(S.data.praticiens, v, S.data.statuts); });
      S.fiches.forEach(function (f) { appliquerFiche(f.praticien, f.presences); });
      LS.set('data', S.data);
      S.ui.sync = 'ok'; S.ui.erreur = ''; clearTimeout(minuteurReprise);
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
      if (!silencieux) toast(e.message + (enAttente() ? ' Vos saisies sont conservées et seront renvoyées automatiquement.' : ''), 5000);
      // nouvelle tentative discrète 30 s plus tard
      clearTimeout(minuteurReprise);
      minuteurReprise = setTimeout(function () { if (navigator.onLine) synchroniser(true); }, 30000);
    }).then(function () {
      S.ui.enCours = false;
      rendreSiPossible();
      if (S.ui.aPublier && !tentePub && navigator.onLine) setTimeout(function () { synchroniser(true); }, 400);
    });
  }

  // Fiches praticiens saisies sur le téléphone, envoyées une par une (dans l'ordre de saisie)
  function envoyerFiches() {
    if (!S.fiches.length) return Promise.resolve();
    var f = S.fiches[0];
    if (!f.uid) { f.uid = 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); LS.set('fiches', S.fiches); }
    return apiPost('fiche', { uid: f.uid, praticien: f.praticien, presences: f.presences }).then(function (r) {
      S.fiches.shift();
      if (r.ancien && r.code && r.ancien !== r.code) remplacerCode(r.ancien, r.code);
      if (r.ids) remplacerIds(r.ids);
      LS.set('fiches', S.fiches); LS.set('plan', S.plan); LS.set('imposes', S.imposes); LS.set('queue', S.queue);
      return envoyerFiches();
    }, function (e) {
      // Serveur pas encore mis à jour (pas d'action « fiche ») : les fiches restent en attente sur le téléphone,
      // sans bloquer l'envoi des comptes rendus ni la tournée
      if (/Action inconnue/i.test(e.message)) { S.ui.serveurAncien = true; return; }
      throw e;
    });
  }
  function remplacerCode(ancien, code) {
    S.plan.forEach(function (a) { if (a.code === ancien) a.code = code; });
    S.imposes.forEach(function (a) { if (a.code === ancien) a.code = code; });
    if (S.ui.contactOuvert === ancien) S.ui.contactOuvert = code;
    S.queue.forEach(function (a) { if (a.code === ancien) a.code = code; });
    S.fiches.forEach(function (f) {
      if (f.praticien.code === ancien) f.praticien.code = code;
      f.presences.forEach(function (x) { if (x.code === ancien) x.code = code; });
    });
    if (S.data) {
      S.data.praticiens.forEach(function (x) { if (x.code === ancien) x.code = code; });
      S.data.presences.forEach(function (x) { if (x.code === ancien) x.code = code; });
    }
    ctxCache.data = null;
  }
  function remplacerIds(ids) {
    Object.keys(ids).forEach(function (ancien) {
      var nouveau = String(ids[ancien]);
      if (ancien === nouveau) return;
      S.plan.forEach(function (a) {
        if (String(a.idPresence) !== ancien) return;
        a.idPresence = nouveau;
        if (a.cle) a.cle = nouveau + a.cle.slice(a.cle.indexOf('|'));
      });
      S.imposes.forEach(function (im) { if (im.cle && im.cle.split('|')[0] === ancien) im.cle = nouveau + im.cle.slice(im.cle.indexOf('|')); });
      S.queue.forEach(function (v) { if (String(v.idPresence) === ancien) v.idPresence = nouveau; });
      S.fiches.forEach(function (f) { f.presences.forEach(function (x) { if (String(x.id) === ancien) x.id = nouveau; }); });
    });
  }

  // Mise à jour légère : tournées des collègues seulement
  function rafraichirEquipe() {
    if (!connecte() || !navigator.onLine || !S.data || S.ui.enCours) return Promise.resolve(false);
    return apiGet('equipe').then(function (r) {
      // les tournées plus anciennes (statistiques du mois) sont conservées
      var depuis = r.depuis || ajouterJours(aujourdhui(), -14);
      S.data.plannings = (S.data.plannings || []).filter(function (p) { return p.date < depuis; }).concat(r.plannings || []);
      LS.set('data', S.data);
      return true;
    }).catch(function () { return false; });
  }

  // ------------------------------------------------------------------ En-tête, barre, navigation
  function afficherEntete() {
    var t = aujourdhui();
    var moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    $('enteteDate').textContent = majuscule(JOURS_COURTS[jourSemaineIndex(t)]) + ' ' + (+t.slice(8)) + ' ' + moisCourts[+t.slice(5, 7) - 1] + (moi() ? ' · ' + moi() : '');
    var p = $('pastilleSync'), etat, texte;
    if (S.config.demo) { etat = 'demo'; texte = 'Démo'; }
    else if (!S.config.url) { etat = 'erreur'; texte = 'Non connecté'; }
    else if (S.ui.sync === 'encours') { etat = 'encours'; texte = 'Synchro…'; }
    else if (!navigator.onLine || S.ui.sync === 'horsligne') { etat = 'horsligne'; texte = enAttente() ? enAttente() + ' en attente' : 'Hors ligne'; }
    else if (S.ui.sync === 'erreur') { etat = 'erreur'; texte = 'Erreur synchro'; }
    else if (enAttente()) { etat = 'attente'; texte = enAttente() + ' en attente'; }
    else { etat = 'ok'; texte = S.data && S.data.syncedAt ? 'À jour ' + new Date(S.data.syncedAt).toTimeString().slice(0, 5) : 'À jour'; }
    p.dataset.etat = etat; p.innerHTML = '<span>' + esc(texte) + '</span>' + (etat === 'demo' ? '' : icone('relancer'));
    p.setAttribute('aria-label', 'Synchronisation : ' + texte + (S.ui.erreur ? '. ' + S.ui.erreur : ''));
  }
  function afficherBarre() {
    var att = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; }), n = att.length;
    // inutile si le seul compte rendu en attente est celui de la carte ouverte (qui a son propre bouton)
    var visible = S.ui.tab === 'jour' && n > 0 && !S.ui.feuille && !(n === 1 && S.ui.ouvert === att[0].uid);
    $('barreValider').hidden = !visible;
    document.body.classList.toggle('avec-barre', visible);
    $('boutonValider').textContent = n > 1 ? 'Enregistrer les ' + n + ' comptes rendus' : 'Enregistrer le compte rendu';
  }
  function afficherNav() {
    document.querySelectorAll('.navigation button').forEach(function (b) {
      var actif = S.ui.tab === 'autour' ? 'jour' : S.ui.tab;
      if (b.dataset.tab === actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  // ------------------------------------------------------------------ Rendu
  function rendre() {
    var tab = S.ui.tab;
    // onglet mémorisé : l'application rouvre là où l'on était (rafraîchissement, mise à jour, relance)
    if (VUES[tab] && tab !== 'accueil' && tab !== 'identite' && LS.get('onglet', '') !== tab) LS.set('onglet', tab);
    if (!pret() && tab !== 'reglages') tab = 'accueil';
    else if (pret() && connecte() && !moi() && tab !== 'reglages') tab = 'identite';
    cacherInfobulle();
    cartesAFaire = [];
    $('vue').innerHTML = (VUES[tab] || VUES.jour)();
    dessinerCartes();
    rendreFeuille();
    rendreLancement();
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
  function prochainFerie() {
    var t = aujourdhui(), l = feries().filter(function (d) { return d >= t; }).sort();
    return l.length ? l[0] : '';
  }
  // Dates de la période (affichage) et dates travaillées (jours fériés exclus) pour le tirage
  function datesAffichees() { var p = S.params; return p.mode === 'jour' ? [p.dateRef] : joursOuvres(lundiDe(p.dateRef)); }
  function datesPeriode() { return datesAffichees().filter(function (d) { return !estFerie(d); }); }
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

  // ------------------------------------------------------------------ Vues du parcours : Aujourd'hui (terrain) et Planifier (préparation)
  function datesPlan() { return Array.from(new Set(S.plan.map(function (a) { return a.date; }))).sort(); }
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
  function libelleJour(d) { return d === aujourdhui() ? 'Aujourd\'hui' : majuscule(dateLongue(d)); }

  // Aujourd'hui : les visites du jour, dans l'ordre, avec contact, itinéraire et compte rendu
  VUES.jour = function () {
    var h = '<div class="tete-vue"><h2 class="titre-vue">Aujourd\'hui</h2>' +
      '<button class="bouton petit" type="button" data-a="ouvrirAutour">' + icone('cible') + 'Autour de moi</button></div>' +
      '<p class="sous-titre">Vos visites dans l\'ordre : itinéraire, contact et compte rendu.</p>';
    if (!S.plan.length) {
      return h + '<div class="vide"><strong>Aucune visite prévue</strong>Préparez d\'abord votre tournée dans « Planifier ».' +
        '<button class="bouton bouton-plein" type="button" data-a="nav" data-tab="semaine" style="margin-top:14px">' + icone('calendrier') + 'Planifier ma tournée</button></div>';
    }
    var dates = datesPlan(); choisirJour(dates);
    if (S.programme.etat !== 'valide') {
      h += '<div class="bandeau"><p><b>Tournée en brouillon.</b> Confirmez-la dans « Planifier » pour la partager avec l\'équipe. ' +
        '<button type="button" class="bouton-texte" data-a="nav" data-tab="semaine">Confirmer</button></p></div>';
    }
    if (dates.length > 1) h += barreJours(dates);
    var duJour = S.plan.filter(function (a) { return a.date === S.ui.jour; });
    var faits = duJour.filter(function (a) { return a.etat === 'valide'; }).length;
    var com = Array.from(new Set(duJour.map(function (a) { return a.commune; })));
    h += '<p class="bilan-jour"><b>' + libelleJour(S.ui.jour) + '</b> : ' + duJour.length + ' visite' + (duJour.length > 1 ? 's' : '') +
      ', ' + faits + ' compte' + (faits > 1 ? 's' : '') + ' rendu' + (faits > 1 ? 's' : '') + ' enregistré' + (faits > 1 ? 's' : '') + '. ' + esc(com.join(', ')) + '.</p>';
    var est = estimationJour(duJour);
    if (est) {
      h += '<div class="estimation" aria-label="Estimation de la journée">' +
        '<div><b>' + minutesVersHeure(est.debut) + '</b><span>première visite</span></div>' +
        '<div><b>' + minutesVersHeure(est.fin) + '</b><span>fin estimée</span></div>' +
        '<div><b>' + duree(est.fin - est.debut) + '</b><span>dont ' + duree(est.trajet) + ' de route</span></div></div>';
      var liens = lienItineraire(duJour);
      if (liens.length) {
        h += '<div class="rangee" style="margin-bottom:12px">' + liens.map(function (u, i) {
          return '<a class="bouton petit" href="' + esc(u) + '" target="_blank" rel="noopener">' + icone('route') +
            (liens.length > 1 ? 'Itinéraire, partie ' + (i + 1) : 'Itinéraire de la journée') + '</a>';
        }).join('') + '</div>';
      }
    }
    ['Matin', 'Soir'].forEach(function (cren) {
      var liste = duJour.filter(function (a) { return a.creneau === cren; });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (a, i) {
        if (i > 0 && a.dist > 0) {
          h += '<li class="troncon" aria-hidden="true"><div></div><div class="arret-rail"></div><span>' +
            km(a.dist) + ', environ ' + (a.trajet !== undefined ? a.trajet : Math.round(a.dist * REGLAGES_MOTEUR.minutesParKm)) + ' min</span></li>';
        }
        h += rendreArret(a);
      });
      h += '</ol>';
    });
    h += '<p class="discret aide" style="text-align:center">Pour changer les médecins de ce jour : <button type="button" class="bouton-texte" data-a="nav" data-tab="semaine">Planifier</button></p>';
    return h;
  };

  // Planifier : réglages, proposition, ajustements, confirmation et partage, communes visitées
  VUES.semaine = function () {
    var h = '<h2 class="titre-vue">Planifier</h2><p class="sous-titre">Préparez votre tournée, ajustez-la, puis confirmez-la pour l\'équipe.</p>';
    if (S.ui.voirParams || !S.plan.length) h += rendreParams();
    else h += rendreResume();
    if (!S.plan.length) return h;
    var dates = datesPlan(); choisirJour(dates);
    h += rendreProgramme();
    h += barreJours(dates);
    var duJour = S.plan.filter(function (a) { return a.date === S.ui.jour; });
    var n3 = duJour.filter(function (a) { return +a.note === 3; }).length;
    var totalKm = duJour.reduce(function (s, a) { return s + (a.dist || 0); }, 0);
    h += '<p class="bilan-jour"><b>' + majuscule(dateLongue(S.ui.jour)) + '</b> : ' + duJour.length + ' visite' + (duJour.length > 1 ? 's' : '') +
      ', environ ' + km(totalKm) + ' de trajet' + (n3 ? ', dont ' + n3 + ' ★★★' : '') + '.</p>';
    h += '<ul class="plan-jour">' + duJour.map(rendreLignePlan).join('') + '</ul>';
    h += '<div class="rangee rangee-tirage"><button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + 'Recalculer ce jour</button>' +
      (S.params.mode === 'semaine' && dates.length > 1 ? '<button class="bouton" type="button" data-a="tirage" data-v="semaine">' + icone('relancer') + 'Recalculer la semaine</button>' : '') +
      '</div><p class="discret aide">Les médecins gardés, les RDV et les visites déjà faites sont conservés ; les autres sont remplacés.</p>';
    h += rendreCouverture(dates);
    return h;
  };

  // Ligne compacte de la tournée (Planifier) : garder, retirer, ouvrir la visite
  function rendreLignePlan(a) {
    var verrou = a.etat === 'valide', e = '';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? 'RDV (prochaine étape)' : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(a.statut) + '</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici</span>';
    e += etiquetteCollegues(a.code, a.date);
    return '<li class="ligne-plan' + (a.garde ? ' gardee' : '') + (verrou ? ' faite' : '') + '">' +
      '<span class="lp-heure">' + esc(a.heure) + '</span>' +
      '<button type="button" class="lp-corps" data-a="voirVisite" data-uid="' + a.uid + '"><b>' + esc(a.nom) + '</b> ' + etoiles(a.note) +
        '<span class="discret bloc-texte">' + esc(a.specialite) + ', ' + esc(a.quartier) + '</span>' + (e ? '<span class="etiquettes">' + e + '</span>' : '') + '</button>' +
      (verrou ? '<span class="lp-fait" title="Compte rendu enregistré">' + icone('valider') + '</span>' :
        '<span class="lp-actions"><button type="button" class="lp-garder" data-a="garder" data-uid="' + a.uid + '" aria-pressed="' + !!a.garde + '" aria-label="' +
          (a.garde ? 'Ne plus garder' : 'Garder au prochain calcul') + '">' + icone('epingle') + '<small>' + (a.garde ? 'Gardé' : 'Garder') + '</small></button>' +
        '<button type="button" class="lp-retirer" data-a="retirer" data-uid="' + a.uid + '" aria-label="Retirer de la tournée">' + icone('fermer') + '</button></span>') +
      '</li>';
  }

  function rendreResume() {
    var p = S.params, dates = datesAffichees();
    var com = p.mode === 'semaine' && p.parJour ? 'Communes différentes selon le jour' : libelleCommunes(p.communes);
    return '<section class="bloc resume-params"><p><b>' +
      (p.mode === 'jour' ? 'Journée du ' + dateCourte(p.dateRef) : 'Semaine du ' + dateCourte(dates[0])) +
      '</b><span class="discret">' + esc(com) + ', ' + p.maxJour + ' visites par jour' + (libelleCibles() ? ', ' + esc(libelleCibles()) : '') +
      (S.imposes.length ? ', ' + S.imposes.length + ' RDV ou prioritaire' + (S.imposes.length > 1 ? 's' : '') : '') + '</span></p>' +
      '<button class="bouton" data-a="voirParams" type="button">Réglages</button></section>';
  }

  function rendreParams() {
    var p = S.params;
    var h = '<section class="bloc"><h3 style="margin-top:0">Réglages de la tournée</h3>' +
      '<div class="segment" role="group" aria-label="Durée">' +
        '<button type="button" data-a="param" data-k="mode" data-v="jour" aria-pressed="' + (p.mode === 'jour') + '">Une journée</button>' +
        '<button type="button" data-a="param" data-k="mode" data-v="semaine" aria-pressed="' + (p.mode === 'semaine') + '">Une semaine</button>' +
      '</div>' +
      '<label class="champ"><span>' + (p.mode === 'jour' ? 'Date' : 'Semaine du') + '</span>' +
        '<input type="date" data-f="param" data-k="dateRef" value="' + esc(p.dateRef) + '"></label>' + bandeauFeries(datesAffichees()) +
      '<div class="champ"><span>Communes</span>' +
        '<button type="button" class="selecteur" data-a="choisirCommunes" data-v="tout">' + esc(libelleCommunes(p.communes)) + '<b>▾</b></button></div>';
    if (p.mode === 'semaine') {
      h += '<label class="interrupteur"><span>Communes différentes selon le jour</span>' +
        '<input type="checkbox" data-f="param" data-k="parJour"' + (p.parJour ? ' checked' : '') + '></label>';
      if (p.parJour) {
        h += '<div class="secteurs">' + JOURS.map(function (j, i) {
          var l = p.communesJour[i];
          return '<div class="secteur"><span>' + j + '</span><button type="button" class="selecteur" data-a="choisirCommunes" data-v="' + i + '">' +
            esc(l && l.length ? libelleCommunes(l) : 'Comme ci-dessus') + '<b>▾</b></button></div>';
        }).join('') + '</div>';
      }
    }
    h += '<div class="sous-bloc"><b>Praticiens à visiter</b>' +
      segment('Type de praticien', 'param" data-k="typeCibles', [['tous', 'Tout'], ['medecins', 'Médecins'], ['pharmacies', 'Pharmacies']], p.typeCibles || 'tous', 'margin:8px 0 12px') +
      (p.typeCibles !== 'pharmacies' ? '<div class="champ"><span>Spécialités (médecins)</span><button type="button" class="selecteur" data-a="choisirSpecialites">' +
        esc(libelleListe(p.specialites, 'Toutes les spécialités')) + '<b>▾</b></button></div>' : '') +
      '<div class="champ"><span>Potentiel de prescription</span><div class="puces">' + ['A', 'B', 'C'].map(function (l) {
        return '<button type="button" class="puce" data-a="paramPotentiel" data-v="' + l + '" aria-pressed="' + (p.potentiels.indexOf(l) >= 0) + '">' + ETOILES[l] + '<small>' + LIB_POTENTIEL[l] + '</small></button>';
      }).join('') + '</div><span class="aide-champ">Aucun choix : tous les potentiels.</span></div></div>';
    h += '<div class="grille-2">' +
        '<label class="champ"><span>Visites par jour</span><input type="number" min="1" max="20" inputmode="numeric" data-f="param" data-k="maxJour" value="' + p.maxJour + '"></label>' +
        '<label class="champ"><span>Ne pas revoir avant (jours)</span><input type="number" min="0" max="365" inputmode="numeric" data-f="param" data-k="delai" value="' + p.delai + '"></label>' +
      '</div>' +
      (S.config.demo ? '' : '<label class="interrupteur"><span>Éviter les médecins déjà prévus par un collègue</span>' +
        '<input type="checkbox" data-f="param" data-k="eviterCollegues"' + (p.eviterCollegues !== false ? ' checked' : '') + '></label>');
    h += '<div class="imposes"><div class="imposes-tete"><b>RDV et médecins prioritaires</b>' +
      '<button type="button" class="bouton petit" data-a="ouvrirRecherche">' + icone('plus') + 'Ajouter</button></div>';
    if (!S.imposes.length) {
      h += '<p class="discret" style="margin:6px 0 0">Ils sont placés d\'office dans la tournée, qui se construit autour d\'eux.</p>';
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
    h += '</div><button class="bouton bouton-plein bouton-large" data-a="generer" type="button">' + icone('relancer') + (S.plan.length ? 'Proposer une nouvelle tournée' : 'Proposer ma tournée') + '</button>' +
      (S.plan.length ? '<p class="discret" style="margin:10px 0 0">Les visites déjà faites, les médecins gardés et les RDV sont conservés.</p>' +
        '<button class="bouton-texte" type="button" data-a="fermerParams" style="margin-top:6px">Fermer les réglages</button>' : '') +
      '</section>';
    return h;
  }

  function rendreProgramme() {
    var dates = datesAffichees();
    if (S.programme.etat === 'valide') {
      return '<section class="bandeau-prog valide"><div><b>Tournée confirmée</b><span>' +
        (S.programme.valideLe ? 'Le ' + esc(S.programme.valideLe) : '') + (S.programme.modifieLe ? ', modifiée le ' + esc(S.programme.modifieLe) : '') +
        '. Visible par l\'équipe ; vos changements sont publiés automatiquement.</span></div>' +
        '<div class="rangee"><button class="bouton bouton-plein wa" type="button" data-a="ouvrirExport">' + icone('whatsapp') + 'Envoyer sur WhatsApp</button></div></section>';
    }
    return '<section class="bandeau-prog"><div><b>Brouillon</b><span>' +
      (S.params.mode === 'semaine' ? 'Semaine du ' + dateCourte(dates[0]) : 'Journée du ' + dateCourte(dates[0])) +
      ' : gardez ou retirez des médecins, puis confirmez. L\'équipe verra votre tournée.</span></div>' +
      '<div class="rangee"><button class="bouton bouton-plein" type="button" data-a="validerProgramme">' + icone('valider') + 'Confirmer la tournée</button></div></section>';
  }

  // Carte d'une visite (Aujourd'hui) : contact d'abord, puis compte rendu en deux temps
  function rendreArret(a) {
    var ouvert = S.ui.ouvert === a.uid, verrou = a.etat === 'valide';
    var cls = 'arret' + (ouvert ? ' ouvert' : '') + (verrou ? ' verrouille' : '') + (a.garde ? ' garde' : '') +
      (a.statut ? (estKo(a.statut) ? ' absent' : ' fait') : '');
    var e = '';
    e += badgeConv(a.conventionne);
    var pv = praticien(a.code) || {}, der = pv.derniere && (!a.derniere || pv.derniere > a.derniere) ? pv.derniere : a.derniere;
    e += '<span class="etiquette">' + esc(vuDepuis(der, a.etat !== 'valide' && a.date > aujourdhui() ? a.date : aujourdhui())) + '</span>';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? 'RDV (prochaine étape)' : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(a.statut) + (verrou ? ', enregistré' : '') + '</span>';
    if (a.etat === 'ajoute') e += '<span class="etiquette">Ajouté</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.prochaine && a.prochaine <= a.date && !a.statut && !a.etape) e += '<span class="etiquette p1">RDV prévu le ' + dateCourte(a.prochaine) + '</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici (présent ' + esc(a.fiabTexte) + ')</span>';
    e += etiquetteCollegues(a.code, a.date);

    var h = '<li class="' + cls + '" data-p="' + (+a.note === 3 ? 1 : 3) + '">' +
      '<div class="arret-heure"><b>' + esc(a.heure) + '</b><small>' + esc(a.debut) + '-' + esc(a.fin) + '</small></div>' +
      '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
      '<div><div class="arret-carte">' +
        '<button type="button" class="carte-bouton" data-a="ouvrir" data-uid="' + a.uid + '" aria-expanded="' + ouvert + '">' +
          '<span class="arret-nom">' + esc(a.nom) + ' ' + etoiles(a.note) + '</span>' +
          '<span class="arret-lieu">' + esc(a.specialite) + ', ' + esc(a.lieu) + '</span>' +
          '<span class="arret-lieu">' + esc(a.quartier) + ', ' + esc(a.commune) + '</span>' +
          '<span class="etiquettes">' + e + '</span>' +
          (!ouvert && !verrou ? '<span class="arret-invite">' + (a.statut ? 'Compte rendu à enregistrer' : 'Toucher pour le compte rendu') + '</span>' : '') +
        '</button>';
    if (ouvert) {
      var pa = praticien(a.code) || {};
      h += '<div class="arret-detail">' +
        actionsRapides({ telephone: pa.telephone, lat: a.lat, lon: a.lon, lieu: a.lieu, quartier: a.quartier, commune: a.commune });
      if (!verrou) {
        var ok = statuts().filter(function (s) { return s.visite; }), ko = statuts().filter(function (s) { return !s.visite; });
        var bouton = function (s) {
          return '<button type="button" class="statut' + (s.visite ? '' : ' ko') + '" data-a="statut" data-uid="' + a.uid +
            '" data-v="' + esc(s.nom) + '" aria-pressed="' + (a.statut === s.nom) + '">' + esc(s.nom) + '</button>';
        };
        h += '<div class="etape-cr"><span class="etape-titre">Le médecin a-t-il été vu ?</span>' +
          '<span class="groupe-statuts">Visite faite</span><div class="statuts" role="group" aria-label="Visite faite">' + ok.map(bouton).join('') + '</div>' +
          '<span class="groupe-statuts">Visite non faite</span><div class="statuts" role="group" aria-label="Visite non faite">' + ko.map(bouton).join('') + '</div></div>';
        // Le compte rendu se déploie dès que le résultat est choisi (visite faite ou non) :
        // type de visite, produits, ce qui est ressorti, prochaine étape ; « remplaçant » en plus si non faite
        var faite = a.statut && !estKo(a.statut);
        if (!a.statut) {
          h += '<p class="aide-champ" style="text-align:center;margin:4px 0 12px">Touchez le résultat pour remplir le compte rendu.</p>';
        } else {
        if (!faite) {
          h += '<div class="bandeau"><p>Visite non faite. ' +
            '<button type="button" class="bouton-texte" data-a="rattraper" data-uid="' + a.uid + '">Trouver un remplaçant à proximité</button></p></div>';
        }
        h += '<div class="champ"><span>Type de visite</span><div class="puces">' + activites().map(function (x) {
            return '<button type="button" class="puce" data-a="activite" data-uid="' + a.uid + '" data-v="' + esc(x) + '" aria-pressed="' + (listeActivites(a.activite).indexOf(x) >= 0) + '">' + esc(x) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="champ"><span>Produits présentés</span><div class="puces">' + produitsRef().map(function (x) {
            return '<button type="button" class="puce" data-a="produit" data-uid="' + a.uid + '" data-v="' + esc(x) + '" aria-pressed="' + (listeProduits(a.produits).indexOf(x) >= 0) + '">' + esc(x) + '</button>';
          }).join('') + '</div><input type="text" list="listeProduits" data-f="produits" data-uid="' + a.uid +
            '" value="' + esc(autresProduits(a.produits).join(', ')) + '" placeholder="Autres produits, séparés par une virgule" aria-label="Autres produits" style="margin-top:8px">' + datalistProduits() + '</div>' +
          '<label class="champ"><span>Ce qui est ressorti de la discussion</span><textarea data-f="commentaire" data-uid="' + a.uid +
            '" placeholder="Besoins, objections, échantillons remis, engagement du médecin, motif d\'absence…">' + esc(a.commentaire) + '</textarea></label>' +
          '<div class="champ"><span>Prochaine étape le</span><div class="rangee-prochaine">' +
            [7, 14, 30].map(function (n) {
              var d = ajouterJours(a.date, n);
              return '<button type="button" class="puce" data-a="prochaine" data-uid="' + a.uid + '" data-v="' + d + '" aria-pressed="' + (a.prochaine === d) + '">+' + n + ' j</button>';
            }).join('') +
            '<input type="date" data-f="prochaine" data-uid="' + a.uid + '" value="' + esc(a.prochaine || '') + '" aria-label="Date de la prochaine étape"></div>' +
            '<span class="aide-champ">Comme un RDV pris : le praticien est placé d\'office ce jour-là dans vos tournées.</span></div>' +
          '<div class="actions-cr">' + (a.statut ?
            '<button class="bouton bouton-plein bouton-large" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + (a.corrige ? 'Enregistrer la modification' : 'Enregistrer le compte rendu') + '</button>' :
            '') + '</div>';
        }
        h += '<button class="bouton-texte" type="button" data-a="retirer" data-uid="' + a.uid + '">Retirer de la tournée</button>';
      } else {
        h += '<div class="resume-cr">';
        if (a.activite) h += '<p class="discret">Type de visite : ' + esc(listeActivites(a.activite).join(', ')) + '</p>';
        if (a.produits) h += '<p class="discret">Produits : ' + esc(a.produits) + '</p>';
        if (a.commentaire) h += '<p class="discret">' + esc(a.commentaire) + '</p>';
        if (a.prochaine) h += '<p class="discret">Prochaine étape le ' + dateCourte(a.prochaine) + '</p>';
        h += '</div><button class="bouton bouton-large" type="button" data-a="corriger" data-uid="' + a.uid + '" style="margin-bottom:6px">' + icone('crayon') + 'Modifier le compte rendu</button>';
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
        '<button type="button" data-a="couvPortee" data-v="semaine" aria-pressed="' + (portee === 'semaine') + '">Semaine</button></div></div>' +
      '<p class="discret" style="margin:0 0 8px">' + (portee === 'jour' ? majuscule(dateLongue(S.ui.jour)) : 'Semaine du ' + dateCourte(dates[0])) +
      ' : ' + couv.length + ' commune' + (couv.length > 1 ? 's' : '') + ' visitée' + (couv.length > 1 ? 's' : '') + ' sur ' + cv.length + '.</p>';
    if (!ouverte) return h + '<button type="button" class="bouton petit bouton-large" data-a="couvOuvrir">Voir la carte et les communes</button></section>';
    h += '<div class="carte-l" id="carteCouv">' + carteCouverture(dates, mes, eq) + '</div>' +
      '<div class="legende"><span><i class="q-moi"></i>Mes visites' + (portee === 'jour' ? ' (dans l\'ordre)' : '') + '</span><span><i class="q-equipe"></i>Équipe</span><span><i class="q-vide"></i>Commune non visitée</span></div>';
    cartesAFaire.push({ id: 'carteCouv', route: portee === 'jour' ? mes : [], points: portee === 'jour' ? [] : mes, equipe: eq,
      nonCouvertes: non.map(function (c) { return c.commune; }) });
    h += segment('Filtre', 'couvFiltre', [['toutes', 'Toutes'], ['couvertes', 'Visitées · ' + couv.length], ['non', 'Non visitées · ' + non.length]], S.ui.couvFiltre);
    var liste = S.ui.couvFiltre === 'couvertes' ? couv : (S.ui.couvFiltre === 'non' ? non : cv);
    var zone = '';
    h += '<ul class="liste-couv">' + liste.map(function (c) {
      var t = '';
      if (c.zone !== zone) { zone = c.zone; t += '<li class="couv-zone">' + esc(zone) + '</li>'; }
      var eqNoms = Object.keys(c.equipe);
      return t + '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
        '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
        (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non visitée') +
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
        .bindTooltip((a.heure ? a.heure + ' · ' : '') + esc(a.nom) + (a.lieu ? '<br>' + esc(a.lieu) : ''));
    });
    if (trace.length > 1) L.polyline(trace, { color: prim, weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(carte);
    if (limites.length) carte.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
    else carte.setView([5.345, -4.01], 11);
  }
  function coordArret(a) {
    if (a.lat && a.lon) return { lat: +a.lat, lon: +a.lon };
    var cr = a.idPresence && ctx().parCode[a.code] ? ctx().parCode[a.code].filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0] : null;
    if (cr && cr.coord) return cr.coord;
    var q = quartiers().filter(function (x) { return x.quartier === a.quartier; })[0];
    return q ? { lat: +q.lat, lon: +q.lon } : null;
  }

  // ------------------------------------------------------------------ Vue : autour de moi
  VUES.autour = function () {
    var A = S.ui.autour, h = '<button type="button" class="retour" data-a="nav" data-tab="jour">' + icone('chevron') + 'Aujourd\'hui</button>' +
      '<h2 class="titre-vue">Autour de moi</h2>' +
      '<p class="sous-titre">Médecin absent, trou dans la journée : trouvez qui est présent près de vous.</p>';
    if (A.ref) {
      h += '<div class="bandeau"><p>Remplacement de <b>' + esc(A.ref.nom) + '</b> (' + esc(A.ref.heure) + ', ' + esc(A.ref.quartier) +
        '), marqué « Absent ». <button type="button" class="bouton-texte" data-a="finRef">Terminer</button></p></div>';
    }
    var parCommune = {};
    quartiers().forEach(function (q) { (parCommune[q.commune] = parCommune[q.commune] || []).push(q.quartier); });
    h += '<section class="bloc">' +
      '<div class="segment" role="group" aria-label="Moment">' +
        '<button type="button" data-a="autourMoment" data-v="maintenant" aria-pressed="' + (A.moment === 'maintenant') + '">Maintenant</button>' +
        '<button type="button" data-a="autourMoment" data-v="choisir" aria-pressed="' + (A.moment === 'choisir') + '">Autre moment</button></div>' +
      (A.moment === 'choisir' ? '<div class="grille-2"><label class="champ"><span>Date</span><input type="date" data-f="autour" data-k="date" value="' + esc(A.date || prochainJourOuvre(aujourdhui())) + '"></label>' +
        '<label class="champ"><span>Heure (vide : toute la journée)</span><input type="time" data-f="autour" data-k="heure" value="' + esc(A.heure) + '"></label></div>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="localiser" style="margin-bottom:10px">' + icone('cible') + 'Utiliser ma position</button>' +
      '<label class="champ"><span>Ou choisir un quartier</span><select data-f="autourQuartier">' +
        '<option value="">' + (A.label ? esc(A.label) : 'Choisir un quartier') + '</option>' +
        Object.keys(parCommune).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (c) {
          return '<optgroup label="' + esc(c) + '">' + parCommune[c].map(function (q) { return '<option>' + esc(q) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + '</select></label>';
    h += '<div class="champ" style="margin:0"><span>Rayon</span>' + segment('Rayon', 'autourRayon', [2, 5, 10, 20].map(function (r) { return [String(r), r + ' km']; }), String(A.rayon), 'margin:0') + '</div></section>';
    h += barreFiltres(S.ui.filtresAutour, S.ui.rechercheAutour);

    if (A.lat === null) return h + '<div class="vide"><strong>Où êtes-vous ?</strong>Utilisez votre position ou choisissez un quartier.</div>';
    var date, minute;
    if (A.moment === 'maintenant') { date = aujourdhui(); minute = minutesMaintenant(); }
    else { date = A.date || prochainJourOuvre(aujourdhui()); minute = heureVersMinutes(A.heure); }
    if (jourSemaineIndex(date) > 4) {
      return h + '<div class="vide"><strong>Pas de présences le week-end</strong>Médecins et pharmacies sont affichés du lundi au vendredi. Choisissez « Autre moment » et un jour de semaine.</div>';
    }
    h += bandeauFeries([date]);
    var fa = S.ui.filtresAutour, filtre = criteresActifs(fa).length || S.ui.rechercheAutour ? ensemble(filtrerPraticiens(fa, S.ui.rechercheAutour).map(function (p) { return p.code; })) : null;
    var res = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, A.rayon)
      .filter(function (x) { return (!A.ref || x.c.code !== A.ref.code) && (!filtre || filtre[x.c.code]); });
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
        '<button class="bouton bouton-plein" type="button" data-a="ajouterAutour" data-i="' + i + '" data-d="' + date + '">' + icone('plus') + (date === aujourdhui() ? 'Ajouter aujourd\'hui' : 'Ajouter au ' + dateCourte(date)) + '</button></div>') +
      '</li>';
  }

  // ------------------------------------------------------------------ Vue : équipe
  VUES.equipe = function () {
    var h = '<h2 class="titre-vue">Équipe</h2>';
    if (S.config.demo) return h + '<div class="vide"><strong>Disponible avec le Google Sheet</strong>Les tournées de vos collègues s\'affichent ici une fois l\'application connectée.</div>';
    var depuis = lundiDe(aujourdhui());
    var arrets = arretsCollegues().filter(function (p) { return p.date >= depuis; });
    var noms = Array.from(new Set(arrets.map(function (p) { return p.delegue; }))).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    h += '<p class="sous-titre">Les tournées de vos collègues, pour coordonner les visites et éviter les doublons. Mise à jour chaque minute.</p>';
    if (!noms.length) return h + '<div class="vide"><strong>Aucune tournée publiée</strong>Les tournées apparaissent ici dès qu\'un collègue prépare la sienne.</div>';
    h += '<ul class="liste resume-equipe">' + noms.map(function (n) {
      var l = arrets.filter(function (p) { return p.delegue === n; });
      var valide = l.some(function (p) { return p.programme === 'Validé'; });
      var com = Array.from(new Set(l.map(function (p) { return p.commune; })));
      return '<li><button type="button" data-a="collegue" data-v="' + esc(n) + '" aria-pressed="' + (n === S.ui.collegue) + '">' +
        '<b>' + esc(n) + '</b><span class="etiquette ' + (valide ? 'ok' : '') + '">' + (valide ? 'Tournée confirmée' : 'Brouillon') + '</span>' +
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
    var pos = duJour.map(function (p) {
      var pr = (ctx().presencesParCode[p.code] || []).filter(function (x) { return String(x.id) === String(p.idPresence); })[0];
      var c = pr && ctx().parCode[p.code] ? ctx().parCode[p.code].filter(function (x) { return String(x.idPresence) === String(p.idPresence); })[0] : null;
      return c && c.coord ? { lat: c.coord.lat, lon: c.coord.lon, nom: p.nom, lieu: p.lieu, heure: p.heure } : null;
    }).filter(Boolean);
    if (pos.length) { h += '<div class="carte-l" id="carteEquipe"></div>'; cartesAFaire.push({ id: 'carteEquipe', route: pos }); }
    h += '<p class="bilan-jour"><b>' + esc(S.ui.collegue) + '</b>, ' + dateLongue(S.ui.jourEquipe) + ' : ' + duJour.length +
      ' visite' + (duJour.length > 1 ? 's' : '') + (maj ? '. Mise à jour le ' + esc(maj.slice(8, 10) + '/' + maj.slice(5, 7) + ' à ' + maj.slice(11, 16)) : '') + '.</p>';
    ['Matin', 'Soir'].forEach(function (cren) {
      var liste = duJour.filter(function (p) { return p.creneau === cren; });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (p0) {
        var p = Object.assign({}, p0); if (p.statut === 'À faire') p.statut = '';   // visite pas encore faite
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
      if (f.communes.length && !lieux.some(function (x) { return co[x.commune]; })) return false;
      if (f.visite !== 'tous') {
        var j = p.derniere ? joursEcoules(p.derniere, t) : Infinity;
        if (f.visite === '30' && j <= 30) return false;
        if (f.visite === 'recent' && j > 30) return false;
        if (f.visite === 'jamais' && p.derniere) return false;
        if (f.visite === 'retard' && j < REGLAGES_MOTEUR.cadence[p.note]) return false;
        if (f.visite === 'revoir' && !aRevoir(p)) return false;
      }
      if (f.equipe !== 'tous' && (f.equipe === 'oui') !== (cibleParCollegues(p.code, t).length > 0)) return false;
      if (!q) return true;
      var l = lieux.map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
      return normaliser(p.nom + ' ' + p.specialite + ' ' + p.code + ' ' + l).indexOf(q) >= 0;
    });
  }
  var LIB_VISITE = { '30': 'Non visité depuis +30 j', recent: 'Visité il y a moins de 30 j', jamais: 'Jamais visité',
                     retard: 'En retard sur la cadence', revoir: 'À revoir' };
  // Liste des critères actifs : [clé, valeur, libellé]
  function criteresActifs(f) {
    var l = [];
    if (f.type !== 'tous') l.push(['type', f.type, f.type === 'Pharmacie' ? 'Pharmacies' : 'Médecins']);
    f.potentiels.forEach(function (x) { l.push(['potentiels', x, ETOILES[x]]); });
    if (f.type !== 'Pharmacie') f.specialites.forEach(function (x) { l.push(['specialites', x, x]); });
    f.communes.forEach(function (x) { l.push(['communes', x, x]); });
    if (f.visite !== 'tous') l.push(['visite', f.visite, LIB_VISITE[f.visite]]);
    if (f.conv !== 'tous') l.push(['conv', f.conv, f.conv === 'oui' ? 'Conventionnés' : 'Non conventionnés']);
    if (f.equipe !== 'tous') l.push(['equipe', f.equipe, f.equipe === 'oui' ? 'Ciblés par l\'équipe' : 'Non ciblés par l\'équipe']);
    return l;
  }
  var FILTRES_RAPIDES = [['potentiels', 'A', '★★★'], ['visite', '30', 'Non visité +30 j'], ['visite', 'revoir', 'À revoir'],
                         ['visite', 'jamais', 'Jamais visité'], ['conv', 'oui', 'Conventionnés']];
  function estRapide(k, v) { return FILTRES_RAPIDES.some(function (x) { return x[0] === k && x[1] === v; }); }
  function filtreRapideActif(f, k, v) { return Array.isArray(f[k]) ? f[k].indexOf(v) >= 0 : f[k] === v; }
  function trierPraticiens(liste, tri) {
    var t = aujourdhui();
    return liste.sort(function (a, b) {
      if (tri === 'nom') return a.nom.localeCompare(b.nom, 'fr');
      if (tri === 'retard') return joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t) || b.note - a.note;
      if (tri === 'score') return calcScore(b.note, joursEcoules(b.derniere, t), b.statut) - calcScore(a.note, joursEcoules(a.derniere, t), a.statut);
      return b.note - a.note || joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t);
    });
  }

  // Barre de recherche et de filtres commune aux onglets Contacts et Autour
  function barreFiltres(f, q) {
    var actifs = criteresActifs(f), autres = actifs.filter(function (x) { return !estRapide(x[0], x[1]) && x[0] !== 'type'; });
    var h = '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="recherche" placeholder="Nom, spécialité, établissement, quartier…" value="' +
        esc(q) + '" aria-label="Rechercher un praticien"></div>' +
      '<button class="bouton bouton-filtres' + (actifs.length ? ' actif' : '') + '" type="button" data-a="ouvrirFiltres" aria-label="Filtres avancés">' + icone('filtre') +
        '<span>Filtres</span>' + (actifs.length ? '<span class="compteur">' + actifs.length + '</span>' : '') + '</button></div>';
    h += segment('Type de praticien', 'filtreType', [['tous', 'Tout'], ['Médecin', 'Médecins'], ['Pharmacie', 'Pharmacies']], f.type, 'margin-bottom:10px');
    h += '<div class="defile" role="group" aria-label="Filtres rapides">' + FILTRES_RAPIDES.map(function (x) {
      return '<button type="button" class="puce" data-a="filtreRapide" data-k="' + x[0] + '" data-v="' + x[1] + '" aria-pressed="' + filtreRapideActif(f, x[0], x[1]) + '">' + esc(x[2]) + '</button>';
    }).join('') + (actifs.length ? '<button type="button" class="puce puce-effacer" data-a="effacerFiltres">' + icone('fermer') + 'Tout effacer</button>' : '') + '</div>';
    if (autres.length) {
      h += '<div class="filtres-actifs">' + autres.map(function (x) {
        return '<button type="button" class="filtre-actif" data-a="retirerFiltre" data-k="' + x[0] + '" data-v="' + esc(x[1]) + '" aria-label="Retirer le filtre ' +
          esc(x[2]) + '">' + esc(x[2]) + icone('fermer') + '</button>';
      }).join('') + '</div>';
    }
    return h;
  }

  VUES.praticiens = function () {
    var f = S.ui.filtres, t = aujourdhui(), c = ctx();
    var liste = trierPraticiens(filtrerPraticiens(f, S.ui.recherche), S.ui.tri);
    // la fiche ouverte (par exemple juste créée) reste en tête de liste
    var io = liste.map(function (p) { return p.code; }).indexOf(S.ui.contactOuvert);
    if (io > 0) liste.unshift(liste.splice(io, 1)[0]);
    var h = '<div class="tete-vue"><h2 class="titre-vue">Praticiens</h2>' +
      '<button class="bouton petit bouton-plein" type="button" data-a="nouvelleFiche">' + icone('plus') + 'Nouveau</button></div>' +
      '<p class="sous-titre">Médecins et pharmacies : recherche, fiche, jours de présence et contact.</p>' + barreFiltres(f, S.ui.recherche);
    h += '<div class="tri"><span class="discret">' + liste.length + ' praticien' + (liste.length > 1 ? 's' : '') +
'</span>' +
      '<label class="discret">Trier par <select data-f="tri">' +
      [['priorite', 'Potentiel'], ['score', 'Priorité de visite'], ['retard', 'Plus longtemps sans visite'], ['nom', 'Nom']].map(function (x) {
        return '<option value="' + x[0] + '"' + (S.ui.tri === x[0] ? ' selected' : '') + '>' + x[1] + '</option>';
      }).join('') + '</select></label></div>';
    if (!liste.length) return h + '<div class="vide"><strong>Aucun praticien</strong>Aucun praticien ne correspond à tous ces critères. Retirez un filtre.</div>';
    h += '<ul class="liste">';
    liste.slice(0, S.ui.limite).forEach(function (p) {
      var ouvert = S.ui.contactOuvert === p.code, lieux = c.presencesParCode[p.code] || [];
      h += '<li class="element"><button type="button" class="carte-bouton" data-a="contact" data-v="' + esc(p.code) + '" aria-expanded="' + ouvert + '">' +
        '<span class="element-titre">' + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
        '<span class="discret bloc-texte">' + esc(p.specialite) + ', ' + lieux.length + ' lieu' + (lieux.length > 1 ? 'x' : '') + ' : ' +
          esc(Array.from(new Set(lieux.map(function (x) { return x.commune; }))).join(', ')) + '</span>' +
        '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere)) + '</span>' +
        (p.statut ? '<span class="etiquette ' + (estKo(p.statut) ? 'ko' : 'ok') + '">' + esc(p.statut) + '</span>' : '') +
        (/^TMP-/.test(p.code) || ficheEnAttente(p.code) ? '<span class="etiquette p1">Fiche en attente d\'envoi</span>' : '') +
        etiquetteCollegues(p.code, t) + '</span></button>';
      if (ouvert) {
        var cr = (c.parCode[p.code] || [])[0], pres = lieux[0] || {};
        h += actionsRapides({ telephone: p.telephone, lat: cr && cr.coord && cr.coord.lat, lon: cr && cr.coord && cr.coord.lon,
                              lieu: pres.lieu, quartier: pres.quartier, commune: pres.commune });
        if (p.telephone) h += '<p class="discret" style="margin:8px 0 0">Téléphone : ' + esc(p.telephone) + '</p>';
        if (p.commentaire) h += '<p class="discret" style="margin:8px 0 0">Dernier commentaire : ' + esc(p.commentaire) + '</p>';
        if (p.prochaine) h += '<p class="discret" style="margin:4px 0 0">Prochain RDV le ' + dateCourte(p.prochaine) + '</p>';
        if (p.absentDu) h += '<p class="discret erreur-texte" style="margin:4px 0 0">Absent du ' + dateCourte(p.absentDu) + (p.absentAu ? ' au ' + dateCourte(p.absentAu) : '') + '</p>';
        h += grillePresences(p.code);
        var impose = S.imposes.some(function (im) { return im.code === p.code; });
        h += '<div class="rangee" style="margin-top:10px">' +
          (impose ? '<span class="etiquette p1">Prioritaire dans ma tournée</span>' :
            '<button class="bouton bouton-plein" type="button" data-a="imposerDirect" data-v="' + esc(p.code) + '">' + icone('plus') + 'Ajouter à ma tournée</button>') +
          '<button class="bouton" type="button" data-a="modifierFiche" data-v="' + esc(p.code) + '">' + icone('crayon') + 'Modifier la fiche</button>' +
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

  // ------------------------------------------------------------------ Vue : statistiques
  function bornesStats() {
    var st = S.ui.stats, t = aujourdhui();
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
    var st = S.ui.stats, eq = st.portee === 'equipe' && !S.config.demo, b = bornesStats(), t = aujourdhui();
    var dans = function (d) { return d && d >= b[0] && d <= b[1]; };
    var visites = visitesConnues().filter(function (v) { return dans(String(v.date).slice(0, 10)) && (eq || !v.delegue || estMoi(v.delegue)); });
    var effectives = visites.filter(function (v) { return Moteur.estVisite(v.statut, statuts()); });
    var plan = arretsPlanifies(eq).filter(function (a) { return dans(a.date); });
    var echus = plan.filter(function (a) { return a.date <= t; });
    var faits = echus.filter(function (a) { return a.etat === 'valide' && Moteur.estVisite(a.statut, statuts()); });
    var delegues = {};
    if (eq) { plan.forEach(function (a) { if (a.delegue) delegues[a.delegue] = true; }); visites.forEach(function (v) { if (v.delegue) delegues[v.delegue] = true; }); }
    var nbDel = eq ? Math.max(1, Object.keys(delegues).length) : 1;
    var ouvres = joursEntre(b[0], b[1]).filter(function (d) { return jourSemaineIndex(d) < 5; }).length;
    var objectif = Math.round((+st.objectif || 0) / 5 * ouvres * nbDel);
    var prat = ctx().prat, nA = 0, nAok = 0;
    Object.keys(prat).forEach(function (k) {
      var p = prat[k]; if (p.note !== 3) return;
      nA++; if (joursEcoules(p.derniere, t) <= REGLAGES_MOTEUR.cadence[3]) nAok++;
    });
    return { bornes: b, equipe: eq, visites: visites, effectives: effectives, plan: plan, echus: echus, faits: faits,
             nbDel: nbDel, delegues: Object.keys(delegues).sort(), ouvres: ouvres, objectif: objectif, nA: nA, nAok: nAok };
  }
  function taux(a, b) { return b ? Math.round(100 * a / b) : null; }
  function txt(n) { return n === null || n === undefined ? 'n.d.' : n + ' %'; }

  VUES.bilan = function () {
    var vueH = S.ui.statsVue === 'historique';
    var tete = '<h2 class="titre-vue">Bilan</h2>' +
      '<p class="sous-titre">' + (vueH ? 'Toutes les visites enregistrées, les vôtres ou celles de l\'équipe.' : 'Vos résultats : visites réalisées, objectif, communes et activités.') + '</p>' +
      segment('Affichage', 'statsVue', [['tableau', 'Tableau de bord'], ['historique', 'Historique']], vueH ? 'historique' : 'tableau');
    if (vueH) return tete + VUES.historique(true);
    var st = S.ui.stats, r = calculerStats(), b = r.bornes;
    var h = tete;
    h += '<div class="filtres-stats">' + segment('Période', 'statsPeriode', [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['perso', 'Période']], st.periode) +
      (S.config.demo ? '' : segment('Portée', 'statsPortee', [['moi', 'Mes visites'], ['equipe', 'Toute l\'équipe']], st.portee)) + '</div>';
    if (st.periode === 'perso') {
      h += '<div class="periode-perso"><label class="champ"><span>Du</span><input type="date" data-f="stats" data-k="debut" value="' + esc(b[0]) + '"></label>' +
        '<label class="champ"><span>Au</span><input type="date" data-f="stats" data-k="fin" value="' + esc(b[1]) + '"></label></div>';
    }
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
    var hist = tout.filter(function (v) { return !v.delegue || estMoi(v.delegue); });
    var t = aujourdhui(), lundi = lundiDe(t), mois = t.slice(0, 7), il30 = ajouterJours(t, -30);
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
    if (!S.config.demo) {
      h += segment('Visites affichées', 'histFiltre', [['moi', 'Mes visites'], ['equipe', 'Toute l\'équipe']], S.ui.histFiltre === 'equipe' ? 'equipe' : 'moi');
    }
    var liste = S.ui.histFiltre === 'equipe' ? tout : hist;
    if (!liste.length) return h + '<div class="vide"><strong>Aucune visite enregistrée</strong>Les comptes rendus enregistrés dans « Aujourd\'hui » apparaîtront ici.</div>';
    return h + '<ul class="liste">' + liste.slice(0, 150).map(function (v) {
      return '<li class="element"><div class="element-tete"><div>' +
        '<span class="element-titre">' + esc(v.nom) + '</span>' +
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
      '<label class="interrupteur"><span>Toujours ouvrir WhatsApp Web</span><input type="checkbox" id="cfgWaWeb"' + (c.waWeb ? ' checked' : '') + '></label>' +
      '<label class="champ"><span>Point de départ de mes tournées</span><select id="cfgDepart">' + qOpts + '</select></label>' +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="enregistrerMoi">Enregistrer</button></section>';
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
    h += '<section class="bloc"><h3 style="margin-top:0">Installer sur le téléphone</h3>' +
      (S.ui.installEvt ? '<button class="bouton bouton-plein bouton-large" type="button" data-a="installer">Installer l\'application</button>' :
        '<p class="discret" style="margin:0">Android (Chrome) : menu ⋮ puis « Installer l\'application ». iPhone (Safari) : bouton Partager puis « Sur l\'écran d\'accueil ».</p>') +
      '</section>';
    h += '<section class="bloc"><h3>MediPlanner</h3><p class="discret" style="margin-top:0">Version ' + APP_VERSION + ' ' + EDITION +
      '. Les mises à jour sont signalées par un bandeau en haut de l\'écran ; vos données restent sur le téléphone.</p>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="verifierMaj">Rechercher une mise à jour</button>' +
      '<button class="bouton" type="button" data-a="ouvrirLancement">Écran d\'accueil</button></div></section>';
    // Avancé : connexion à la base, synchronisation, démonstration, effacement
    h += '<details class="bloc avance"' + (!c.url || S.ui.erreur ? ' open' : '') + '><summary><b>Avancé</b><span class="discret">Connexion à la base et données du téléphone</span></summary>' +
      '<h3>Connexion au Google Sheet</h3>' +
      '<label class="champ"><span>URL de l\'application Web</span><input type="url" id="cfgUrl" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>' +
      '<label class="champ"><span>Jeton d\'accès</span><input type="text" id="cfgToken" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(c.token) + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="tester">Tester</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="enregistrerConnexion">Enregistrer</button></div>' +
      (S.ui.erreur ? '<p class="discret" style="color:var(--rouge);margin-bottom:0">' + esc(S.ui.erreur) + '</p>' : '') +
      '<h3>Données</h3><p class="discret" style="margin-top:0">' +
      (S.config.demo ? 'Mode démonstration : les données restent sur ce téléphone.' :
        (S.data && S.data.syncedAt ? 'Dernière synchronisation : ' + new Date(S.data.syncedAt).toLocaleString('fr-FR') + '.' : 'Pas encore synchronisé.')) +
      (pret() ? ' ' + S.data.praticiens.length + ' praticiens, ' + S.data.presences.length + ' lieux de présence.' : '') +
      (S.queue.length ? ' ' + S.queue.length + ' compte(s) rendu(s) en attente.' : '') +
      (S.fiches.length ? ' ' + S.fiches.length + ' fiche(s) praticien en attente' + (S.ui.serveurAncien ? ' : le serveur Apps Script doit être mis à jour pour les recevoir.' : '.') : '') + '</p>' +
      (connecte() ? '<button class="bouton bouton-large" type="button" data-a="sync" style="margin-bottom:10px">Synchroniser maintenant</button>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="demo" style="margin-bottom:10px">Charger les données de démonstration</button>' +
      '<button class="bouton bouton-large bouton-danger" type="button" data-a="reinitialiser">Effacer les données de ce téléphone</button></details>';
    return h;
  };

  // ------------------------------------------------------------------ Feuilles (fenêtres du bas)
  function rendreFeuille() {
    var f = S.ui.feuille, el = $('feuille');
    if (!f) { el.hidden = true; el.innerHTML = ''; el.dataset.ouverte = ''; document.body.classList.remove('feuille-ouverte'); return; }
    el.hidden = false; document.body.classList.add('feuille-ouverte');
    var contenu = FEUILLES[f.type](f), pied = '';
    if (typeof contenu === 'object') { pied = contenu.pied; contenu = contenu.corps; }
    var defil = el.querySelector('.feuille-corps'), haut = defil && el.dataset.type === f.type + (f.etape || '') ? defil.scrollTop : 0;
    var nouvelle = !defil || el.dataset.ouverte !== f.type;
    el.dataset.type = f.type + (f.etape || ''); el.dataset.ouverte = f.type;
    el.innerHTML = '<div class="voile" data-a="fermerFeuille"></div><div class="feuille' + (f.pleine ? ' pleine' : '') + (nouvelle ? ' anim' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(f.titre || '') + '">' +
      '<div class="poignee" aria-hidden="true"></div><div class="feuille-tete"><b>' + esc(f.titre || '') + '</b><button type="button" class="bouton-icone sombre" data-a="fermerFeuille" aria-label="Fermer">' + icone('fermer') + '</button></div>' +
      '<div class="feuille-corps">' + contenu + '</div>' + (pied ? '<div class="feuille-pied">' + pied + '</div>' : '') + '</div>';
    if (haut) el.querySelector('.feuille-corps').scrollTop = haut;
  }
  var FEUILLES = {};

  FEUILLES.communes = function (f) {
    var h = groupeChoix(f, { id: 'communes', titre: 'Communes', chemin: 'sel', multiple: true, sections: sectionsCommunes(), recherche: true,
      aide: f.cle === 'tout' ? 'Aucune sélection = toutes les communes.' : 'Aucune sélection = les communes choisies pour la semaine.' });
    return { corps: h, pied: '<button class="bouton" type="button" data-a="communesAucune">Effacer</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="communesOk">' + (f.sel.length ? 'Valider · ' + f.sel.length + ' commune' + (f.sel.length > 1 ? 's' : '') : 'Valider · toutes') + '</button>' };
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
      '<button type="button" data-a="exportPortee" data-v="semaine" aria-pressed="' + (f.portee !== 'jour') + '">Toute la tournée</button></div>' +
      '<pre class="apercu">' + esc(texte) + '</pre>' +
      (texte.length > 3500 ? '<p class="discret">Message long : si WhatsApp le coupe, envoyez jour par jour.</p>' : '') +
      (num ? '<p class="discret">Envoi vers votre numéro +' + esc(num) + (S.config.waWeb || !estMobile() ? ', avec WhatsApp Web.' : ', avec l\'application WhatsApp.') + '</p>' :
        '<p class="discret">Renseignez votre numéro dans les Réglages pour l\'envoyer directement dans votre conversation.</p>') +
      '<button class="bouton bouton-plein bouton-large wa" type="button" data-a="envoyerWhatsapp">' + icone('whatsapp') + 'Envoyer sur WhatsApp</button>' +
      '<div class="rangee" style="margin-top:10px"><button class="bouton" type="button" data-a="copierTexte">Copier le texte</button>' +
      (navigator.share ? '<button class="bouton" type="button" data-a="partagerTexte">Partager…</button>' : '') + '</div>';
  };

  FEUILLES.valide = function () {
    return { corps: '<p style="margin-top:0">Votre tournée est confirmée et visible par l\'équipe. Vous pouvez toujours la modifier.</p><p class="discret">Voulez-vous l\'envoyer sur WhatsApp ?</p>',
      pied: '<button class="bouton" type="button" data-a="fermerFeuille">Non, merci</button>' +
        '<button class="bouton bouton-plein wa" type="button" data-a="ouvrirExport">' + icone('whatsapp') + 'Envoyer</button>' };
  };

  // Choix multiple générique (spécialités ciblées par la tournée)
  FEUILLES.multi = function (f) {
    var h = groupeChoix(f, { id: 'multi', titre: f.titreGroupe || 'Choix', chemin: 'sel', multiple: true, recherche: f.options.length > 8, aide: f.aide,
      options: f.options.map(function (o) { return { v: o.nom, lib: o.nom, n: o.n }; }) });
    var total = f.sel.reduce(function (s2, v) { var o = f.options.filter(function (x) { return x.nom === v; })[0]; return s2 + (o && o.n ? o.n : 0); }, 0);
    return { corps: h, pied: '<button class="bouton" type="button" data-a="multiAucun">Effacer</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="multiOk">' + (f.sel.length ? 'Valider · ' + total + ' médecin' + (total > 1 ? 's' : '') : 'Valider · toutes') + '</button>' };
  };

  // Filtres avancés de la liste des praticiens (cumulables)
  FEUILLES.filtres = function (f) {
    var b = f.brouillon, n = filtrerPraticiens(b, rechercheCour()).length;
    function opt(l) { return l.map(function (x) { return { v: x[0], lib: x[1], n: x[2] }; }); }
    var h = groupeChoix(f, { id: 'type', titre: 'Type', chemin: 'brouillon.type', options: opt([['tous', 'Tous'], ['Médecin', 'Médecins'], ['Pharmacie', 'Pharmacies']]) }) +
      groupeChoix(f, { id: 'pot', titre: 'Potentiel de prescription', chemin: 'brouillon.potentiels', multiple: true,
        options: opt([['A', '★★★', 'fort'], ['B', '★★', 'moyen'], ['C', '★', 'faible']]) }) +
      groupeChoix(f, { id: 'visite', titre: 'Dernière visite', chemin: 'brouillon.visite', options: opt([['tous', 'Toutes'], ['30', 'Non visité +30 j'], ['revoir', 'À revoir'],
        ['jamais', 'Jamais visité'], ['retard', 'En retard sur la cadence'], ['recent', 'Vu il y a moins de 30 j']]) }) +
      groupeChoix(f, { id: 'conv', titre: 'Conventionné', chemin: 'brouillon.conv', options: opt([['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']]) }) +
      (S.config.demo ? '' : groupeChoix(f, { id: 'equipe', titre: 'Ciblé par un collègue cette semaine', chemin: 'brouillon.equipe', options: opt([['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']]) })) +
      groupeChoix(f, { id: 'spec', titre: 'Spécialités', chemin: 'brouillon.specialites', multiple: true, repliable: true, recherche: true, resume: 'Toutes',
        options: specialitesListe().map(function (x) { return { v: x.nom, lib: x.nom, n: x.n }; }),
        aide: b.type === 'Pharmacie' ? 'Ignorées pour les pharmacies ; elles restent mémorisées et s\'appliquent de nouveau en choisissant Médecins ou Tout.' : 'S\'appliquent aux médecins seulement ; les pharmacies ne sont pas concernées.' }) +
      groupeChoix(f, { id: 'com', titre: 'Communes', chemin: 'brouillon.communes', multiple: true, repliable: true, recherche: true, resume: 'Toutes', sections: sectionsCommunes(),
        aide: 'Lieux d\'exercice du praticien. Pour un établissement ou un quartier, utilisez la recherche de la liste.' });
    return { corps: h, pied: '<button class="bouton" type="button" data-a="filtresReinit">Réinitialiser</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="filtresOk">' + (S.ui.tab === 'autour' ? 'Appliquer les filtres' : 'Afficher ' + n + ' praticien' + (n > 1 ? 's' : '')) + '</button>' };
  };

  // ------------------------------------------------------------------ Fiche praticien : assistant en 4 étapes
  var ETAPES_FICHE = ['Informations', 'Spécialité', 'Disponibilités', 'Localisation'];
  function lieuVide() {
    return { id: '', lieu: '', quartier: '', jours: [0, 1, 2, 3, 4].map(function () { return { matin: false, soir: false }; }),
             horaireMatin: REGLAGES_MOTEUR.horaireMatinDefaut, horaireSoir: REGLAGES_MOTEUR.horaireSoirDefaut, lat: '', lon: '' };
  }
  function brouillonFiche(code) {
    if (!code) return { code: '', type: 'Médecin', nom: '', telephone: '', specialite: '', autreSpec: '', note: 2, conventionne: 'Non', actif: 'Oui', lieux: [lieuVide()] };
    var p = (S.data.praticiens || []).filter(function (x) { return x.code === code; })[0] || {};
    var lieux = (S.data.presences || []).filter(function (x) { return x.code === code; }).map(function (x) {
      return { id: x.id, lieu: x.lieu || '', quartier: x.quartier || '', jours: JOURS_CLES.map(function (j) { return lireDispo(x[j]); }),
               horaireMatin: x.horaireMatin || REGLAGES_MOTEUR.horaireMatinDefaut, horaireSoir: x.horaireSoir || REGLAGES_MOTEUR.horaireSoirDefaut,
               lat: x.lat || '', lon: x.lon || '' };
    });
    return { code: code, type: p.type === 'Pharmacie' ? 'Pharmacie' : 'Médecin', nom: p.nom || '', telephone: String(p.telephone || ''),
             specialite: p.specialite || '', autreSpec: '', note: lireNote(p.note), conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non',
             actif: 'Oui', absentDu: p.absentDu || '', absentAu: p.absentAu || '', lieux: lieux.length ? lieux : [lieuVide()] };
  }
  function horaireValide(t) {
    var m = String(t || '').match(/^\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*-\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*$/);
    if (!m) return false;
    var a = +m[1] * 60 + +(m[2] || 0), b = +m[3] * 60 + +(m[4] || 0);
    return +m[1] < 24 && +m[3] < 24 && a < b;
  }
  // Erreurs d'une étape : { champ: message }
  function erreursEtape(d, etape) {
    var e = {};
    if (etape === 0) {
      if (String(d.nom).trim().length < 3) e.nom = 'Indiquez le nom complet (3 caractères minimum).';
      if (String(d.telephone).trim() && !normaliserNumero(d.telephone)) e.telephone = 'Numéro non reconnu : 10 chiffres, par exemple 07 07 07 07 07.';
    }
    if (etape === 1 && d.type === 'Médecin') {
      if (!d.specialite) e.specialite = 'Choisissez une spécialité.';
      else if (d.specialite === '__autre' && String(d.autreSpec).trim().length < 3) e.autreSpec = 'Précisez la spécialité.';
    }
    if (etape === 2) {
      if (!d.lieux.length) e.lieux = 'Ajoutez au moins un lieu d\'exercice.';
      if (d.absentAu && !d.absentDu) e.absentDu = 'Indiquez le début de l\'absence.';
      if (d.absentDu && d.absentAu && d.absentAu < d.absentDu) e.absentAu = 'La fin doit suivre le début.';
      d.lieux.forEach(function (l, i) {
        if (String(l.lieu).trim().length < 2) e['lieu' + i] = 'Nom de l\'établissement ou du cabinet requis.';
        var m = l.jours.some(function (j) { return j.matin; }), so = l.jours.some(function (j) { return j.soir; });
        if (!m && !so) e['jours' + i] = 'Cochez au moins une demi-journée de présence.';
        if (m && !horaireValide(l.horaireMatin)) e['hm' + i] = 'Format attendu : 08:00-12:00 (début avant fin).';
        if (so && !horaireValide(l.horaireSoir)) e['hs' + i] = 'Format attendu : 15:00-19:00 (début avant fin).';
      });
    }
    if (etape === 3) {
      var connus = {}; quartiers().forEach(function (q) { connus[q.quartier] = true; });
      d.lieux.forEach(function (l, i) { if (!connus[l.quartier]) e['quartier' + i] = 'Choisissez le quartier de « ' + (l.lieu || 'ce lieu') + ' ».'; });
    }
    return e;
  }
  function champFiche(cle, libelle, contenu, f, requis, aide) {
    var err = f.err[cle] || '';
    return '<div class="champ"><span class="' + (requis ? 'requis' : '') + '">' + libelle + '</span>' + contenu +
      (aide ? '<span class="aide-champ">' + aide + '</span>' : '') + '<span class="erreur" data-err="' + cle + '" id="err-' + cle + '">' + esc(err) + '</span></div>';
  }
  function attrInvalide(f, cle) { return (f.err[cle] ? ' aria-invalid="true"' : '') + ' aria-describedby="err-' + cle + '"'; }

  FEUILLES.fiche = function (f) {
    var d = f.d, e = f.etape, h = '<ol class="etapes">' + ETAPES_FICHE.map(function (t, i) {
      return '<li class="' + (i < e ? 'faite' : (i === e ? 'active' : '')) + '"' + (i === e ? ' aria-current="step"' : '') + '>' + (i + 1) + '. ' + t + '</li>';
    }).join('') + '</ol>';
    if (e === 0) {
      h += '<p class="etape-titre">Informations personnelles</p><p class="discret" style="margin-top:0">Les champs marqués * sont obligatoires.</p>' +
        '<div class="segment" role="group" aria-label="Type">' + ['Médecin', 'Pharmacie'].map(function (t) {
          return '<button type="button" data-a="ficheVal" data-k="type" data-v="' + t + '" aria-pressed="' + (d.type === t) + '">' + t + '</button>';
        }).join('') + '</div>' +
        champFiche('nom', d.type === 'Pharmacie' ? 'Nom de la pharmacie' : 'Nom du médecin',
          '<input type="text" data-f="fiche" data-k="nom" autocomplete="off" value="' + esc(d.nom) + '" placeholder="' + (d.type === 'Pharmacie' ? 'Ex. Pharmacie des Lagunes' : 'Ex. Dr Kouassi Aya') + '"' + attrInvalide(f, 'nom') + '>', f, true) +
        champFiche('telephone', 'Téléphone', '<input type="tel" inputmode="tel" data-f="fiche" data-k="telephone" value="' + esc(d.telephone) + '" placeholder="07 07 07 07 07"' + attrInvalide(f, 'telephone') + '>', f, false,
          'Facultatif. Sert aux boutons Appeler et SMS.');
      var homonyme = !d.code && String(d.nom).trim().length >= 3 && (S.data.praticiens || []).filter(function (p) { return normaliser(p.nom) === normaliser(d.nom); })[0];
      if (homonyme) h += '<div class="bandeau"><p>Un praticien porte déjà ce nom (' + esc(homonyme.code) + '). Vérifiez qu\'il ne s\'agit pas d\'un doublon.</p></div>';
      if (d.code) h += '<label class="interrupteur"><span>Praticien actif (sinon retiré des tournées, historique conservé)</span><input type="checkbox" data-f="fiche" data-k="actif"' + (d.actif !== 'Non' ? ' checked' : '') + '></label>';
    }
    if (e === 1) {
      h += '<p class="etape-titre">Spécialité et potentiel</p>';
      if (d.type === 'Pharmacie') h += '<p class="discret">Spécialité enregistrée : Pharmacien.</p>';
      else {
        var specs = specialitesListe().map(function (x) { return x.nom; });
        SPECIALITES_DEFAUT.forEach(function (x) { if (x !== 'Pharmacien' && specs.indexOf(x) < 0) specs.push(x); });
        specs.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
        if (d.specialite && d.specialite !== '__autre' && specs.indexOf(d.specialite) < 0) specs.unshift(d.specialite);
        h += champFiche('specialite', 'Spécialité', '<select data-f="fiche" data-k="specialite"' + attrInvalide(f, 'specialite') + '><option value="">Choisir…</option>' +
          specs.map(function (x) { return '<option' + (d.specialite === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
          '<option value="__autre"' + (d.specialite === '__autre' ? ' selected' : '') + '>Autre spécialité…</option></select>', f, true);
        if (d.specialite === '__autre') h += champFiche('autreSpec', 'Autre spécialité', '<input type="text" data-f="fiche" data-k="autreSpec" value="' + esc(d.autreSpec) + '"' + attrInvalide(f, 'autreSpec') + '>', f, true);
      }
      h += '<div class="champ"><span class="requis">Potentiel de prescription</span><div class="segment" role="group" aria-label="Potentiel" style="margin:0">' +
        [3, 2, 1].map(function (n) {
          var l = lettrePotentiel(n);
          return '<button type="button" data-a="ficheVal" data-k="note" data-v="' + n + '" aria-pressed="' + (+d.note === n) + '">' + ETOILES[l] + ' ' + LIB_POTENTIEL[l] + '</button>';
        }).join('') + '</div><span class="aide-champ">★★★ : à voir tous les ' + REGLAGES_MOTEUR.cadence[3] + ' jours, ★★ : ' + REGLAGES_MOTEUR.cadence[2] + ' jours, ★ : ' + REGLAGES_MOTEUR.cadence[1] + ' jours.</span></div>' +
        '<label class="interrupteur"><span>Conventionné</span><input type="checkbox" data-f="fiche" data-k="conventionne"' + (d.conventionne === 'Oui' ? ' checked' : '') + '></label>';
    }
    if (e === 2) {
      h += '<p class="etape-titre">Disponibilités</p><p class="discret" style="margin-top:0">Pour chaque lieu d\'exercice : les demi-journées de présence et leurs horaires.</p>';
      if (f.err.lieux) h += '<p class="erreur-texte">' + esc(f.err.lieux) + '</p>';
      d.lieux.forEach(function (l, i) {
        var m = l.jours.some(function (j) { return j.matin; }), so = l.jours.some(function (j) { return j.soir; });
        h += '<div class="lieu-bloc"><div class="lieu-tete"><b>Lieu ' + (i + 1) + '</b>' +
          (d.lieux.length > 1 ? '<button type="button" class="bouton-texte" data-a="ficheRetirerLieu" data-i="' + i + '">Supprimer</button>' : '') + '</div>' +
          champFiche('lieu' + i, 'Établissement ou cabinet', '<input type="text" data-f="fiche" data-k="lieu" data-i="' + i + '" value="' + esc(l.lieu) + '" placeholder="Ex. CHU de Cocody"' + attrInvalide(f, 'lieu' + i) + '>', f, true) +
          '<div class="grille-dispo" role="group" aria-label="Présences du lieu ' + (i + 1) + '"><span></span><span class="entete-col">Matin</span><span class="entete-col">Soir</span>' +
          JOURS.map(function (j, k) {
            return '<span class="jour-nom">' + j + '</span>' +
              '<button type="button" data-a="ficheJour" data-i="' + i + '" data-j="' + k + '" data-c="matin" aria-pressed="' + l.jours[k].matin + '" aria-label="' + j + ' matin">' + (l.jours[k].matin ? 'Présent' : '–') + '</button>' +
              '<button type="button" data-a="ficheJour" data-i="' + i + '" data-j="' + k + '" data-c="soir" aria-pressed="' + l.jours[k].soir + '" aria-label="' + j + ' soir">' + (l.jours[k].soir ? 'Présent' : '–') + '</button>';
          }).join('') + '</div>' +
          '<span class="erreur" data-err="jours' + i + '">' + esc(f.err['jours' + i] || '') + '</span>' +
          '<div class="grille-2">' +
          champFiche('hm' + i, 'Horaires du matin', '<input type="text" data-f="fiche" data-k="horaireMatin" data-i="' + i + '" value="' + esc(l.horaireMatin) + '"' + (m ? '' : ' disabled') + attrInvalide(f, 'hm' + i) + '>', f, m) +
          champFiche('hs' + i, 'Horaires du soir', '<input type="text" data-f="fiche" data-k="horaireSoir" data-i="' + i + '" value="' + esc(l.horaireSoir) + '"' + (so ? '' : ' disabled') + attrInvalide(f, 'hs' + i) + '>', f, so) +
          '</div></div>';
      });
      h += '<button class="bouton bouton-large" type="button" data-a="ficheAjouterLieu">' + icone('plus') + 'Ajouter un lieu d\'exercice</button>';
      h += '<div class="lieu-bloc" style="margin-top:12px"><div class="lieu-tete"><b>Absence (congés, formation…)</b></div>' +
        '<div class="grille-2">' +
        champFiche('absentDu', 'Absent du', '<input type="date" data-f="fiche" data-k="absentDu" value="' + esc(d.absentDu || '') + '"' + attrInvalide(f, 'absentDu') + '>', f, false) +
        champFiche('absentAu', 'Au', '<input type="date" data-f="fiche" data-k="absentAu" value="' + esc(d.absentAu || '') + '"' + attrInvalide(f, 'absentAu') + '>', f, false) +
        '</div><span class="aide-champ">Facultatif. Le praticien n\'est pas proposé dans les tournées pendant cette période.</span></div>';
    }
    if (e === 3) {
      var parCommune = {};
      quartiers().forEach(function (q) { (parCommune[q.commune] = parCommune[q.commune] || []).push(q.quartier); });
      h += '<p class="etape-titre">Localisation</p><p class="discret" style="margin-top:0">Le quartier place le lieu sur la carte et dans les tournées. La position GPS, facultative, rend les trajets plus précis.</p>';
      d.lieux.forEach(function (l, i) {
        var q = quartiers().filter(function (x) { return x.quartier === l.quartier; })[0];
        h += '<div class="lieu-bloc"><div class="lieu-tete"><b>' + esc(l.lieu || 'Lieu ' + (i + 1)) + '</b></div>' +
          champFiche('quartier' + i, 'Quartier', '<select data-f="fiche" data-k="quartier" data-i="' + i + '"' + attrInvalide(f, 'quartier' + i) + '><option value="">Choisir un quartier…</option>' +
            Object.keys(parCommune).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (c) {
              return '<optgroup label="' + esc(c) + '">' + parCommune[c].map(function (x) { return '<option' + (x === l.quartier ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</optgroup>';
            }).join('') + '</select>', f, true, q ? 'Commune : ' + esc(q.commune) + ', ' + esc(q.zone) : '') +
          '<div class="gps-ligne">' + (l.lat && l.lon ? 'GPS : ' + (+l.lat).toFixed(5) + ', ' + (+l.lon).toFixed(5) +
            ' <button type="button" class="bouton-texte" data-a="ficheGpsEffacer" data-i="' + i + '">Effacer</button>' : 'Pas de position GPS') +
            ' <button type="button" class="bouton petit" data-a="ficheGps" data-i="' + i + '">' + icone('cible') + 'Je suis sur place</button></div></div>';
      });
      h += '<dl class="recap bloc"><dt>Praticien</dt><dd>' + esc(d.nom) + ' ' + etoiles(d.note) + '</dd><dt>Spécialité</dt><dd>' +
        esc(d.type === 'Pharmacie' ? 'Pharmacien' : (d.specialite === '__autre' ? d.autreSpec : d.specialite)) + (d.conventionne === 'Oui' ? ', conventionné' : '') + '</dd>' +
        '<dt>Présences</dt><dd>' + d.lieux.map(function (l) {
          var j = JOURS.map(function (n, k) { var x = l.jours[k]; return x.matin || x.soir ? n.slice(0, 3) + ' ' + (x.matin && x.soir ? 'M+S' : (x.matin ? 'M' : 'S')) : ''; }).filter(Boolean).join(', ');
          return esc(l.lieu) + ' : ' + esc(j);
        }).join('<br>') + '</dd></dl>';
    }
    var pied = (e > 0 ? '<button class="bouton" type="button" data-a="ficheEtape" data-v="-1">Précédent</button>' : '<button class="bouton" type="button" data-a="fermerFeuille">Annuler</button>') +
      (e < 3 ? '<button class="bouton bouton-plein" type="button" data-a="ficheEtape" data-v="1">Suivant</button>'
             : '<button class="bouton bouton-plein" type="button" data-a="ficheEnregistrer">' + icone('valider') + 'Enregistrer</button>');
    return { corps: h, pied: pied };
  };

  // Applique une fiche aux données locales (affichage immédiat, même hors ligne)
  function appliquerFiche(pr, pres) {
    if (!S.data) return;
    var ex = S.data.praticiens.filter(function (x) { return x.code === pr.code; })[0];
    if (ex) Object.keys(pr).forEach(function (k) { ex[k] = pr[k]; });
    else S.data.praticiens.push(Object.assign({ derniere: '', statut: '', commentaire: '', nbVisites: 0 }, pr));
    S.data.presences = S.data.presences.filter(function (x) { return x.code !== pr.code; }).concat(pres.map(function (x) { return Object.assign({}, x); }));
    ctxCache.data = null;
  }
  function enregistrerFiche(d) {
    var code = d.code || 'TMP-' + Date.now().toString(36).toUpperCase();
    var pr = { code: code, type: d.type, nom: String(d.nom).trim(), telephone: String(d.telephone || '').trim(),
               specialite: d.type === 'Pharmacie' ? 'Pharmacien' : (d.specialite === '__autre' ? String(d.autreSpec).trim() : d.specialite),
               note: +d.note, conventionne: d.conventionne, actif: d.actif === 'Non' ? 'Non' : 'Oui',
               absentDu: d.absentDu || '', absentAu: d.absentAu || '' };
    var pres = d.lieux.map(function (l) {
      var q = quartiers().filter(function (x) { return x.quartier === l.quartier; })[0] || {};
      var o = { id: l.id || 'TMP' + Math.random().toString(36).slice(2, 8), code: code, nom: pr.nom, lieu: String(l.lieu).trim(), quartier: l.quartier,
                commune: q.commune || '', zone: q.zone || '', horaireMatin: String(l.horaireMatin || '').trim(), horaireSoir: String(l.horaireSoir || '').trim(),
                lat: l.lat || '', lon: l.lon || '' };
      JOURS_CLES.forEach(function (j, k) { o[j] = ecrireDispo(l.jours[k]); });
      return o;
    });
    appliquerFiche(pr, pres);
    if (!S.config.demo) {
      S.fiches = S.fiches.filter(function (f) { return f.praticien.code !== code; }).concat([{ praticien: pr, presences: pres }]);
    }
    sauver();
    return code;
  }

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
  // Message WhatsApp : pour chaque jour, un titre puis les établissements dans l'ordre de passage,
  // chacun suivi de ses médecins
  //   Planning du vendredi 23/10/2026 (Serge Alain)
  //
  //   HMA
  //   Dr Assie Augustin
  //   ...
  function texteProgramme(dates) {
    var blocs = [];
    dates.forEach(function (d) {
      var l = S.plan.filter(function (a) { return a.date === d; });
      if (!l.length) return;
      var p = d.split('-');
      var lignes = ['Planning du ' + nomJour(d).toLowerCase() + ' ' + p[2] + '/' + p[1] + '/' + p[0] + (moi() ? ' (' + moi() + ')' : '')];
      var ordre = [], parLieu = {};
      l.forEach(function (a) {
        var k = String(a.lieu || a.quartier || '').trim() || 'Autre lieu';
        if (!parLieu[k]) { parLieu[k] = []; ordre.push(k); }
        if (parLieu[k].indexOf(a.nom) < 0) parLieu[k].push(a.nom);
      });
      ordre.forEach(function (k) { lignes.push(''); lignes.push('*' + k + '*'); parLieu[k].forEach(function (n) { lignes.push('• ' + n); }); });
      blocs.push(lignes.join('\n'));
    });
    return blocs.join('\n\n');
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
      rejetes: S.rejetes, conserves: reste.filter(function (a) { return d.indexOf(a.date) >= 0; }), imposes: [], depart: departCoord(),
      accepte: filtreCibles()
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
    if (p.mode === 'jour' && estFerie(p.dateRef)) { toast('Ce jour est férié. Choisissez un autre jour.'); return; }
    var feriesSemaine = p.mode === 'semaine' ? joursOuvres(lundiDe(p.dateRef)).filter(estFerie) : [];
    if (feriesSemaine.length) toast('Jour férié exclu de la semaine : ' + feriesSemaine.map(dateCourte).join(', ') + '.', 4000);
    var renseignees = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide' && !a.corrige; }).length;
    if (renseignees && !confirm(renseignees + ' compte(s) rendu(s) non enregistré(s) seront perdus. Continuer ?')) return;
    avantTirage().then(function () {
      var periode = datesPeriode();
      var cible = portee === 'jour' ? [S.ui.jour] : (portee === 'semaine' ? Array.from(new Set(S.plan.map(function (a) { return a.date; }))).sort() : periode);
      if (portee === 'nouveau') S.rejetes = {};
      // Médecins écartés au nouveau tirage : ceux qui étaient proposés et non conservés
      if (portee === 'jour' || portee === 'semaine') {
        S.plan.forEach(function (a) {
          if (cible.indexOf(a.date) >= 0 && !a.garde && !a.impose && a.etat !== 'valide' && !a.corrige) S.rejetes[a.code] = true;
        });
      }
      var conserves = S.plan.filter(function (a) { return cible.indexOf(a.date) >= 0 && (a.etat === 'valide' || a.corrige || a.garde); });
      var horsCible = portee === 'nouveau' ? [] : S.plan.filter(function (a) { return cible.indexOf(a.date) < 0; });
      var exclus = p.eviterCollegues !== false ? exclusCollegues(cible) : exclusValides(cible);
      horsCible.forEach(function (a) { exclus[a.code] = true; });
      var r = Moteur.genererPlanning(ctx(), {
        dates: cible, communesPour: communesPour, maxJour: +p.maxJour || 8, delai: +p.delai || 0,
        exclus: exclus, rejetes: S.rejetes, conserves: conserves, imposes: S.imposes.concat(rdvProchaines(cible)), depart: departCoord(), accepte: filtreCibles()
      });
      S.plan = horsCible.concat(r.arrets);
      trierPlan();
      if (S.programme.etat === 'valide' && portee !== 'nouveau') marquerModifie();
      else S.programme = { etat: 'proposition', valideLe: '' };
      S.ui.voirParams = false; S.ui.ouvert = null;
      if (portee === 'nouveau') { S.ui.jour = null; S.ui.tab = 'semaine'; window.scrollTo(0, 0); }
      sauver(); rendre(); publierPlan();
      var msg = r.arrets.length ? r.arrets.length + ' visites proposées' + (portee === 'jour' ? ' pour ce jour' : '') + '.' : 'Aucun praticien ne correspond à ces critères.';
      var np = r.nonPlaces.filter(function (x) { return !x.etape; });
      if (np.length) msg += ' ' + np.length + ' médecin(s) prioritaire(s) absent(s) sur la période.';
      var attendu = (+p.maxJour || 8) * cible.filter(function (d) { return jourSemaineIndex(d) < 5; }).length;
      if (r.arrets.length && r.arrets.length < attendu * 0.75) {
        msg += ' Moins de visites que prévu : les praticiens présents sont déjà ciblés par l\'équipe, vus récemment ou hors des critères choisis. Élargissez les communes ou les spécialités.';
      }
      toast(msg, 4500);
    });
  }

  function horodatageCourt() { var d = new Date(); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' à ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  // Programme validé puis modifié : il reste validé pour l'équipe, avec la date de modification
  function marquerModifie() { if (S.programme.etat === 'valide') S.programme.modifieLe = horodatageCourt(); }
  function validerVisites(uid) {
    var aValider = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide' && (!uid || a.uid === uid); });
    if (!aValider.length) return;
    var t = aujourdhui(), ko = 0, etapes = [];
    aValider.forEach(function (a) {
      var v = { uid: a.uid, date: a.date > t ? t : a.date, idPresence: a.idPresence, code: a.code, nom: a.nom, type: a.type,
                specialite: a.specialite, note: a.note, commune: a.commune, quartier: a.quartier, lieu: a.lieu,
                creneau: a.creneau, statut: a.statut, commentaire: a.commentaire || '', delegue: moi(),
                produits: a.produits || '', prochaine: a.prochaine || '', activite: a.activite || '' };
      if (a.corrige) v.correction = true;
      memoriserProduits(a.produits);
      Moteur.appliquerVisite(S.data.praticiens, v, statuts());
      if (S.config.demo) { v.horodatage = new Date().toISOString(); S.data.historique = [v].concat((S.data.historique || []).filter(function (x) { return x.uid !== v.uid; })); }
      else {
        var enFile = S.queue.filter(function (x) { return x.uid === v.uid; })[0];
        if (enFile) { if (enFile.correction === undefined) delete v.correction; S.queue[S.queue.indexOf(enFile)] = v; } else S.queue.push(v);
        // affichage immédiat de la correction dans l'historique local
        if (a.corrige && S.data.historique) S.data.historique.forEach(function (x, i) { if (x.uid === v.uid) S.data.historique[i] = Object.assign({}, x, v); });
      }
      if (estKo(a.statut)) ko++;
      a.etat = 'valide'; delete a.corrige;
      if (a.prochaine && a.prochaine > a.date) etapes.push({ code: a.code, apres: a.prochaine, etape: true });
    });
    // prochaine étape tombant dans la tournée en cours : le praticien y est ajouté comme un RDV
    var placees = 0;
    etapes.forEach(function (im) {
      var deja = S.plan.filter(function (x) { return x.code === im.code && x.date >= im.apres && !x.statut; })[0];
      if (deja) { deja.impose = true; deja.garde = true; deja.etape = true; placees++; return; }
      if (placerImpose(im)) placees++;
    });
    if (placees) marquerModifie();
    ctxCache.data = null;
    S.ui.ouvert = null;
    sauver(); rendre();
    toast(aValider.length + ' compte(s) rendu(s) enregistré(s)' + (ko ? '. ' + ko + ' visite(s) non réalisée(s) : utilisez « Remplacer ».' : '.') +
      (placees ? ' Prochaine étape ajoutée à votre tournée.' : ''), 4500);
    publierPlan(!placees);
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
  // Prochaines étapes fixées (comme un RDV pris) : placées d'office ce jour-là si le praticien y est présent,
  // sinon au premier jour de présence suivant ; une étape en retard (14 jours au plus) est placée dès que possible.
  // Une étape fixée par un collègue reste la sienne.
  function rdvProchaines(dates) {
    if (!dates.length) return [];
    var c = ctx(), t = aujourdhui(), debut = ajouterJours(t, -14), fin = dates[dates.length - 1], auteur = {};
    ((S.data && S.data.historique) || []).forEach(function (v) {
      var pv = String(v.prochaine || '').slice(0, 10);
      if (pv && !auteur[v.code + '|' + pv]) auteur[v.code + '|' + pv] = v.delegue || '';
    });
    var dejaImposes = ensemble(S.imposes.map(function (x) { return x.code; }));
    return Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
      if (!p.prochaine || p.prochaine < debut || p.prochaine > fin || dejaImposes[p.code]) return false;
      var qui = auteur[p.code + '|' + p.prochaine];
      return !qui || estMoi(qui);
    }).map(function (p) { return { code: p.code, apres: p.prochaine < dates[0] ? dates[0] : p.prochaine, etape: true }; });
  }
  function placerImpose(im) {
    var c = ctx(), dates = datesPeriode(), best = null;
    (c.parCode[im.code] || []).forEach(function (cr) {
      dates.forEach(function (d) {
        if (jourSemaineIndex(d) !== cr.jourIdx || (im.date && im.date !== d) || (im.apres && d < im.apres) || (im.cle && im.cle !== cr.cle) || estFerie(d)) return;
        if (S.plan.some(function (a) { return a.date === d && a.code === im.code; })) return;
        var a = Moteur.arretDepuisCreneau(cr, d);
        a.impose = true; a.garde = true; if (im.rdv) a.rdv = im.rdv; if (im.etape) a.etape = true;
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
    if (!im.etape) S.ui.jour = best.d;
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
    S.ui.tab = 'semaine'; S.ui.voirParams = false;
    sauver(); rendre();
    toast('Démonstration : ' + b.praticiens.length + ' praticiens, ' + b.presences.length + ' lieux de présence.');
  }

  function copier(texte) {
    if (navigator.clipboard) return navigator.clipboard.writeText(texte).then(function () { toast('Texte copié.'); }, function () { prompt('Copiez ce texte :', texte); });
    prompt('Copiez ce texte :', texte);
  }

  var ACTIONS = {
    nav: function (el) {
      S.ui.tab = el.dataset.tab;
      if (S.ui.tab === 'historique') { S.ui.tab = 'bilan'; S.ui.statsVue = 'historique'; } S.ui.feuille = null;
      rendre(); window.scrollTo(0, 0);
      if (S.ui.tab === 'equipe') rafraichirEquipe().then(function (ok) { if (ok && S.ui.tab === 'equipe') rendreSiPossible(); });
    },
    param: function (el) { S.params[el.dataset.k] = el.dataset.v; LS.set('params', S.params); rendre(); },
    voirParams: function () { S.ui.voirParams = true; rendre(); window.scrollTo(0, 0); },
    fermerParams: function () { S.ui.voirParams = false; rendre(); window.scrollTo(0, 0); },
    voirVisite: function (el) { S.ui.tab = 'jour'; S.ui.ouvert = el.dataset.uid; rendre(); var c = document.querySelector('.arret.ouvert'); if (c) c.scrollIntoView({ block: 'start' }); },
    ouvrirAutour: function () { S.ui.tab = 'autour'; rendre(); window.scrollTo(0, 0); },
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
      sauver(); publierPlan(true);
      S.ui.feuille = { type: 'valide', titre: 'Tournée confirmée' };
      rendre();
    },
    corriger: function (el) { var a = arret(el.dataset.uid); if (!a) return; a.etat = 'correction'; a.corrige = true; S.ui.ouvert = a.uid; LS.set('plan', S.plan); rendre(); },
    ouvrirExport: function () { S.ui.feuille = { type: 'exporter', titre: 'Envoyer la tournée', portee: S.params.mode === 'jour' ? 'jour' : 'semaine' }; rendre(); },
    exportPortee: function (el) { S.ui.feuille.portee = el.dataset.v; rendre(); },
    envoyerWhatsapp: function () { window.open(urlWhatsapp(S.ui.feuille.texte), '_blank', 'noopener'); },
    copierTexte: function () { copier(S.ui.feuille.texte); },
    partagerTexte: function () { navigator.share({ title: 'Programme de tournée', text: S.ui.feuille.texte }).catch(function () {}); },
    fermerFeuille: function () { S.ui.feuille = null; rendre(); },
    couvPortee: function (el) { S.ui.couvPortee = el.dataset.v; LS.set('couvPortee', S.ui.couvPortee); rendre(); },
    couvOuvrir: function () { S.ui.couvOuverte = !S.ui.couvOuverte; LS.set('couvOuverte', S.ui.couvOuverte); rendre(); },
    couvFiltre: function (el) { S.ui.couvFiltre = el.dataset.v; LS.set('couvFiltre', S.ui.couvFiltre); rendre(); },
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
    ouvrirRecherche: function () { S.ui.feuille = { type: 'recherche', titre: 'RDV ou médecin prioritaire', q: '' }; rendre(); var i = $('rechercheImpose'); if (i) i.focus(); },
    choisirImpose: function (el) { S.ui.feuille.code = el.dataset.v; S.ui.feuille.cle = ''; rendre(); },
    retourRecherche: function () { S.ui.feuille.code = null; rendre(); },
    ajouterImpose: function () {
      var f = S.ui.feuille, choix = document.querySelector('input[name=impCle]:checked'), rdv = ($('impRdv').value || '').trim();
      var im = { code: f.code };
      if (choix && choix.value) { var p = choix.value.split('|'); im.date = p[0]; im.cle = p.slice(1).join('|'); }
      if (rdv) im.rdv = rdv;
      S.imposes = S.imposes.filter(function (x) { return x.code !== im.code; }).concat([im]);
      var place = S.plan.length ? placerImpose(im) : false;
      S.ui.feuille = null; sauver(); rendre();
      if (place) publierPlan();
      toast(place ? 'Ajouté à la tournée du ' + dateCourte(S.ui.jour) + '.' : 'Ajouté. Il sera placé à la prochaine proposition de tournée.');
    },
    retirerImpose: function (el) { S.imposes.splice(+el.dataset.i, 1); LS.set('imposes', S.imposes); rendre(); },
    imposerDirect: function (el) { S.ui.feuille = { type: 'recherche', titre: 'Ajouter à ma tournée', code: el.dataset.v, cle: '' }; rendre(); },
    planifierCle: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v); if (!c) return;
      var d = el.dataset.d || prochaineOccurrence(c.jourIdx, prochainJourOuvre(aujourdhui()), true);
      if (ajouterArret(c, d)) { S.ui.tab = 'jour'; rendre(); window.scrollTo(0, 0); }
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
    histFiltre: function (el) { S.ui.histFiltre = el.dataset.v; LS.set('histFiltre', S.ui.histFiltre); rendre(); },
    valider: function () { validerVisites(); },
    validerUn: function (el) { validerVisites(el.dataset.uid); },
    sync: function () {
      if (S.config.demo) { toast('Mode démonstration : aucune synchronisation.'); return; }
      if (!S.config.url) { S.ui.tab = 'reglages'; rendre(); return; }
      synchroniser(false);
    },
    enregistrerNom: function () {
      var n = lireNom('nomDelegue');
      if (n.length < 2) { toast('Indiquez votre nom.'); return; }
      S.config.delegue = n; S.config.whatsapp = normaliserNumero($('numWhatsapp').value) || '';
      LS.set('config', S.config); S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); publierPlan();
      toast('Bienvenue ' + n + '.');
    },
    enregistrerMoi: function () {
      var n = lireNom('cfgNom'), w = ($('cfgWhatsapp').value || '').trim();
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
      synchroniser(false).then(function () { if (pret()) { S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); } });
    },
    demo: chargerDemo,
    reinitialiser: function () {
      var msg = enAttente() ? enAttente() + ' élément(s) non envoyé(s) (comptes rendus, fiches) seront perdus. ' : '';
      if (!confirm(msg + 'Effacer toutes les données de l\'application sur ce téléphone ?')) return;
      LS.vider(); location.reload();
    },
    installer: function () {
      var evt = S.ui.installEvt; if (!evt) return;
      evt.prompt(); evt.userChoice.then(function () { S.ui.installEvt = null; rendre(); });
    },
    // Ciblage de la tournée
    paramPotentiel: function (el) {
      var l = S.params.potentiels, i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      LS.set('params', S.params); rendre();
    },
    choisirSpecialites: function () {
      S.ui.feuille = { type: 'multi', titre: 'Spécialités ciblées', titreGroupe: 'Spécialités', cle: 'specialites', options: specialitesListe(), sel: S.params.specialites.slice(),
                       aide: 'Aucune sélection = toutes les spécialités. Les pharmacies dépendent du choix « Avec / Sans pharmacies ».' };
      rendre();
    },
    produit: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var l = listeProduits(a.produits), i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      a.produits = l.join(', '); LS.set('plan', S.plan); rendre();
    },
    activite: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var l = listeActivites(a.activite), i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      a.activite = l.join(' ; '); LS.set('plan', S.plan); rendre();
    },
    prochaine: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.prochaine = a.prochaine === el.dataset.v ? '' : el.dataset.v;
      LS.set('plan', S.plan); rendre();
    },
    choix: function (el) {
      var c = cheminObjet(el.dataset.chemin), v = el.dataset.v;
      if (el.dataset.m === '1') { var l = c.o[c.k], i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); }
      else c.o[c.k] = v;
      rendre();
    },
    groupeTout: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k];
      el.closest('.groupe-filtre').querySelectorAll('.puce:not([hidden])').forEach(function (b) { if (l.indexOf(b.dataset.v) < 0) l.push(b.dataset.v); });
      rendre();
    },
    groupeAucun: function (el) { var c = cheminObjet(el.dataset.chemin); c.o[c.k] = []; rendre(); },
    sectionToute: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k], vs = [];
      el.closest('.section-choix').querySelectorAll('.puce').forEach(function (b) { vs.push(b.dataset.v); });
      var tous = vs.every(function (v) { return l.indexOf(v) >= 0; });
      vs.forEach(function (v) { var i = l.indexOf(v); if (tous && i >= 0) l.splice(i, 1); if (!tous && i < 0) l.push(v); });
      rendre();
    },
    basculeGroupe: function (el) { var f = S.ui.feuille; f.ouverts = f.ouverts || {}; f.ouverts[el.dataset.v] = !f.ouverts[el.dataset.v]; rendre(); },
    filtreRapide: function (el) {
      var f = filtresCour(), k = el.dataset.k, v = el.dataset.v;
      if (Array.isArray(f[k])) { var i = f[k].indexOf(v); if (i >= 0) f[k].splice(i, 1); else f[k].push(v); }
      else f[k] = f[k] === v ? 'tous' : v;
      majFiltres(f); rendre();
    },
    filtreType: function (el) { var f = filtresCour(); f.type = el.dataset.v; majFiltres(f); rendre(); },
    multiToggle: function (el) { var f = S.ui.feuille, i = f.sel.indexOf(el.dataset.v); if (i >= 0) f.sel.splice(i, 1); else f.sel.push(el.dataset.v); rendre(); },
    multiAucun: function () { S.ui.feuille.sel = []; rendre(); },
    multiOk: function () { var f = S.ui.feuille; S.params[f.cle] = f.sel.slice(); LS.set('params', S.params); S.ui.feuille = null; rendre(); },
    // Filtres avancés
    ouvrirFiltres: function () {
      var b = JSON.parse(JSON.stringify(filtresCour()));
      S.ui.feuille = { type: 'filtres', titre: 'Filtres', pleine: true, brouillon: b, ouverts: { spec: b.specialites.length > 0, com: b.communes.length > 0 } };
      rendre();
    },
    filtreBrouillon: function (el) {
      var b = S.ui.feuille.brouillon, k = el.dataset.k, v = el.dataset.v;
      if (el.dataset.m === '1') { var i = b[k].indexOf(v); if (i >= 0) b[k].splice(i, 1); else b[k].push(v); }
      else b[k] = v;
      rendre();
    },
    filtresReinit: function () { S.ui.feuille.brouillon = JSON.parse(JSON.stringify(FILTRES_VIDES)); rendre(); },
    filtresOk: function () { majFiltres(S.ui.feuille.brouillon); S.ui.feuille = null; rendre(); },
    retirerFiltre: function (el) {
      var f = filtresCour(), k = el.dataset.k;
      if (Array.isArray(f[k])) f[k] = f[k].filter(function (x) { return x !== el.dataset.v; }); else f[k] = 'tous';
      majFiltres(f); rendre();
    },
    effacerFiltres: function () { majFiltres(JSON.parse(JSON.stringify(FILTRES_VIDES))); rendre(); },
    // Fiche praticien
    nouvelleFiche: function () { S.ui.feuille = { type: 'fiche', titre: 'Nouveau praticien', pleine: true, etape: 0, d: brouillonFiche(''), err: {} }; rendre(); },
    modifierFiche: function (el) { S.ui.feuille = { type: 'fiche', titre: 'Modifier la fiche', pleine: true, etape: 0, d: brouillonFiche(el.dataset.v), err: {} }; rendre(); },
    ficheVal: function (el) {
      var d = S.ui.feuille.d, k = el.dataset.k;
      d[k] = k === 'note' ? +el.dataset.v : el.dataset.v;
      rendre();
    },
    ficheJour: function (el) {
      var l = S.ui.feuille.d.lieux[+el.dataset.i], j = l.jours[+el.dataset.j];
      j[el.dataset.c] = !j[el.dataset.c];
      if (S.ui.feuille.err['jours' + el.dataset.i]) S.ui.feuille.err = erreursEtape(S.ui.feuille.d, 2);
      rendre();
    },
    ficheAjouterLieu: function () { S.ui.feuille.d.lieux.push(lieuVide()); rendre(); },
    ficheRetirerLieu: function (el) { S.ui.feuille.d.lieux.splice(+el.dataset.i, 1); S.ui.feuille.err = {}; rendre(); },
    ficheGps: function (el) {
      var l = S.ui.feuille.d.lieux[+el.dataset.i];
      if (!navigator.geolocation) { toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
      toast('Recherche de votre position…');
      navigator.geolocation.getCurrentPosition(function (pos) {
        l.lat = +pos.coords.latitude.toFixed(6); l.lon = +pos.coords.longitude.toFixed(6);
        var r = Moteur.quartierLePlusProche(l.lat, l.lon, quartiers());
        if (r && !l.quartier) l.quartier = r.quartier.quartier;
        rendre(); toast('Position enregistrée' + (r ? ', près de ' + r.quartier.quartier : '') + '.');
      }, function () { toast('Position indisponible. Autorisez la localisation.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    },
    ficheGpsEffacer: function (el) { var l = S.ui.feuille.d.lieux[+el.dataset.i]; l.lat = ''; l.lon = ''; rendre(); },
    ficheEtape: function (el) {
      var f = S.ui.feuille, sens = +el.dataset.v;
      if (sens > 0) {
        f.err = erreursEtape(f.d, f.etape);
        if (Object.keys(f.err).length) { rendre(); focusErreur(); toast('Corrigez les champs signalés.'); return; }
      } else f.err = {};
      f.etape = Math.max(0, Math.min(3, f.etape + sens));
      rendre();
      var c = document.querySelector('.feuille-corps'); if (c) c.scrollTop = 0;
    },
    ficheEnregistrer: function () {
      var f = S.ui.feuille;
      for (var i = 0; i < 4; i++) {
        var e = erreursEtape(f.d, i);
        if (Object.keys(e).length) { f.etape = i; f.err = e; rendre(); focusErreur(); toast('Étape ' + (i + 1) + ' à compléter.'); return; }
      }
      var nouveau = !f.d.code, code = enregistrerFiche(f.d);
      S.ui.feuille = null; S.ui.contactOuvert = code; S.ui.tab = 'praticiens'; S.ui.recherche = ''; rendre();
      toast((nouveau ? 'Praticien ajouté' : 'Fiche mise à jour') + (S.config.demo ? '.' : (navigator.onLine ? ', envoi au Google Sheet…' : ', envoyée dès le retour du réseau.')));
      if (!S.config.demo) synchroniser(true);
    },
    // Statistiques
    statsPeriode: function (el) { S.ui.stats.periode = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    statsPortee: function (el) { S.ui.stats.portee = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    statsVue: function (el) { S.ui.statsVue = el.dataset.v; LS.set('statsVue', S.ui.statsVue); rendre(); },
    statsSpec: function (el) { S.ui.stats.vueSpec = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    // Apparence, lancement, mises à jour
    theme: function (el) { appliquerTheme(el.dataset.v); rendre(); },
    fermerLancement: function (el) {
      S.ui.lancement = false; S.ui.lancementAuto = false;
      if (el.dataset.tab && pret()) S.ui.tab = el.dataset.tab;
      rendre(); window.scrollTo(0, 0);
      if (S.ui.tab === 'equipe') rafraichirEquipe().then(function (ok) { if (ok) rendreSiPossible(); });
    },
    ouvrirLancement: function () { S.ui.lancement = true; S.ui.lancementAuto = false; rendre(); },
    appliquerMaj: appliquerMaj,
    plusTardMaj: function () { $('bandeauMaj').hidden = true; },
    verifierMaj: function () {
      if (!swReg) { toast('Mises à jour indisponibles dans ce navigateur.'); return; }
      toast('Recherche d\'une mise à jour…');
      swReg.update().then(function () {
        setTimeout(function () { if (!swReg.waiting && !swReg.installing) toast('MediPlanner est à jour (version ' + APP_VERSION + ').'); }, 2500);
      }, function () { toast('Vérification impossible hors ligne.'); });
    },
    partager: function () {
      var lien = lienInstallation(), texte = 'MediPlanner : ouvrez ce lien sur votre téléphone, puis installez l\'application.';
      if (navigator.share) navigator.share({ title: 'MediPlanner', text: texte, url: lien }).catch(function () {});
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
    if (f === 'fiche') majChampFiche(el, false);
    if (f === 'produits') {
      var ap = arret(el.dataset.uid), ref = produitsRef();
      if (ap) { ap.produits = listeProduits(ap.produits).filter(function (x) { return ref.indexOf(x) >= 0; }).concat(listeProduits(el.value)).join(', '); LS.set('plan', S.plan); }
    }
    if (f === 'chercheOption') {
      var fe = S.ui.feuille; fe.q = fe.q || {}; fe.q[el.dataset.g] = el.value;
      var q = normaliser(el.value), g = el.closest('.groupe-filtre');
      g.querySelectorAll('.puce').forEach(function (b) { b.hidden = !!q && b.dataset.lib.indexOf(q) < 0; });
      g.querySelectorAll('.section-choix').forEach(function (sec) { sec.hidden = !sec.querySelector('.puce:not([hidden])'); });
    }
    if (f === 'recherche' || f === 'rechercheImpose') {
      if (f === 'recherche') { if (S.ui.tab === 'autour') S.ui.rechercheAutour = el.value; else S.ui.recherche = el.value; S.ui.limite = 40; } else S.ui.feuille.q = el.value;
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
    if (f === 'fiche') majChampFiche(el, true);
    if (f === 'prochaine') { var ax = arret(el.dataset.uid); if (ax) { ax.prochaine = el.value; LS.set('plan', S.plan); rendre(); } }
    if (f === 'choixNom') { var bloc = $(el.id + 'Bloc'); if (bloc) bloc.hidden = el.value !== '__autre'; }
    if (f === 'tri') { S.ui.tri = el.value; LS.set('tri', S.ui.tri); rendre(); }
    if (f === 'stats') {
      var k2 = el.dataset.k;
      S.ui.stats[k2] = k2 === 'objectif' ? Math.max(1, Math.min(200, +el.value || 40)) : el.value;
      LS.set('stats', S.ui.stats); rendre();
    }
    if (f === 'autourQuartier' && el.value) {
      var q = quartiers().filter(function (x) { return x.quartier === el.value; })[0];
      if (q) { S.ui.autour.lat = q.lat; S.ui.autour.lon = q.lon; S.ui.autour.label = q.quartier; LS.set('autour', S.ui.autour); rendre(); }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.ui.feuille) { S.ui.feuille = null; rendre(); }
    else if (S.ui.lancement) { S.ui.lancement = false; S.ui.lancementAuto = false; rendre(); }
  });

  // Saisie dans l'assistant : mise à jour du brouillon, validation dynamique au changement de champ
  function majChampFiche(el, change) {
    var f = S.ui.feuille; if (!f || f.type !== 'fiche') return;
    var d = f.d, k = el.dataset.k, i = el.dataset.i;
    var v = el.type === 'checkbox' ? (el.checked ? 'Oui' : 'Non') : el.value;
    if (i !== undefined) d.lieux[+i][k] = v; else d[k] = v;
    if (!change) return;
    if (k === 'specialite' || k === 'quartier') {
      // liste déroulante : nouvel affichage (champ « Autre », commune), en gardant les erreurs déjà signalées
      var tous = erreursEtape(d, f.etape), cleS = k === 'quartier' ? 'quartier' + i : 'specialite', garde = {};
      Object.keys(f.err).forEach(function (x) { if (tous[x]) garde[x] = tous[x]; });
      if (tous[cleS]) garde[cleS] = tous[cleS];
      f.err = garde; rendre(); return;
    }
    var cle = { lieu: 'lieu', horaireMatin: 'hm', horaireSoir: 'hs' }[k];
    cle = cle ? cle + i : k;
    var err = erreursEtape(d, f.etape)[cle] || '';
    if (err) f.err[cle] = err; else delete f.err[cle];
    var span = document.getElementById('err-' + cle);
    if (span) span.textContent = err;
    if (err) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  function focusErreur() {
    var el = document.querySelector('.feuille [aria-invalid="true"]');
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
    else { var s = document.querySelector('.feuille .erreur:not(:empty), .feuille .erreur-texte'); if (s) s.scrollIntoView({ block: 'center' }); }
  }

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
      whatsapp: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 19L4 20Z"/><path d="M9.2 8.6c.2 2.6 2.4 5 5.2 5.4l1.1-1.3-1.8-.9-.8.8c-1-.4-1.9-1.3-2.3-2.3l.8-.8-.9-1.8-1.3.9Z"/>',
      tel: '<path d="M5 4h3.5l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L15 13l4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
      sms: '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9.5h8M8 12.5h5"/>',
      waze: '<path d="M12 3 20 20l-8-4-8 4 8-17Z"/>',
      route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6"/>',
      filtre: '<path d="M4 6h16M7 12h10M10 18h4"/>',
      chevron: '<path d="m6 9 6 6 6-6"/>',
      calendrier: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
      crayon: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'
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
    if (enAttente() || age > 10 * 60 * 1000) synchroniser(true);
    else rafraichirEquipe().then(function (ok) { if (ok) rendreSiPossible(); });
  });
  // Tournées de l'équipe rafraîchies chaque minute quand l'application est ouverte
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    if (enAttente() || S.ui.aPublier) { synchroniser(true); return; }
    rafraichirEquipe().then(function (ok) { if (ok && !S.ui.feuille) rendreSiPossible(); });
  }, 60000);

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
    var h = '<div class="lancement" role="dialog" aria-modal="true" aria-labelledby="titreLancement">' +
      '<div class="lancement-tete"><img src="icon-192.png" alt=""><h1 id="titreLancement">MediPlanner</h1>' +
      '<p>Tournées de visites médicales, planning des praticiens et suivi d\'équipe</p>' +
      '<span class="version">v' + APP_VERSION + ' ' + EDITION + '</span></div><div class="lancement-corps">' +
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
    if (pret() && S.ui.lancementAuto) {
      h += '<div class="decompte"><span id="decompteTexte">Lancement automatique dans ' + Math.max(0, Math.ceil((S.ui.lancementFin - Date.now()) / 1000)) + ' s</span>' +
        '<div class="jauge"><i id="decompteBarre" style="width:0%"></i></div></div>';
    }
    h += pret() ? '<button class="bouton bouton-plein" type="button" data-a="fermerLancement" data-tab="bilan">Voir mon bilan</button>' +
        '<button class="bouton" type="button" data-a="fermerLancement" style="margin-top:10px">Lancer l\'application</button>'
      : '<button class="bouton bouton-plein" type="button" data-a="fermerLancement">Lancer l\'application</button>';
    el.innerHTML = h + '</div></div>';
    el.hidden = false;
    if (pret() && S.ui.lancementAuto) demarrerDecompte();
  }
  // Lancement automatique : l'écran d'accueil se ferme seul et ouvre la tournée.
  // Un toucher sur l'écran d'accueil arrête le décompte.
  var minuteurLancement = null;
  function demarrerDecompte() {
    if (minuteurLancement) return;
    var total = S.ui.lancementFin - Date.now();
    minuteurLancement = setInterval(function () {
      if (!S.ui.lancement || !S.ui.lancementAuto) { clearInterval(minuteurLancement); minuteurLancement = null; return; }
      var reste = S.ui.lancementFin - Date.now(), t = $('decompteTexte'), b = $('decompteBarre');
      if (t) t.textContent = 'Lancement automatique dans ' + Math.max(0, Math.ceil(reste / 1000)) + ' s';
      if (b) b.style.width = Math.min(100, 100 * (1 - reste / total)) + '%';
      if (reste <= 0) {
        clearInterval(minuteurLancement); minuteurLancement = null;
        S.ui.lancement = false; S.ui.lancementAuto = false;
        if (S.ui.tab === 'accueil' || !VUES[S.ui.tab]) S.ui.tab = 'jour';
        rendre(); window.scrollTo(0, 0);
      }
    }, 200);
  }
  function arreterDecompte() {
    if (!S.ui.lancementAuto) return;
    S.ui.lancementAuto = false;
    var d = document.querySelector('#lancement .decompte'); if (d) d.remove();
  }
  document.addEventListener('pointerdown', function (e) {
    if (S.ui.lancementAuto && e.target.closest && e.target.closest('.lancement') && !e.target.closest('[data-a]')) arreterDecompte();
  }, true);

  // ------------------------------------------------------------------ Mises à jour (service worker)
  // Une nouvelle version s'installe en arrière-plan puis attend : le bandeau propose « Mise à jour ».
  // Accepter : le nouveau service worker prend la main, la page se recharge, les données locales restent.
  var swReg = null, majDemandee = false;
  function proposerMaj() {
    if (!swReg || !swReg.waiting) return;
    fetch('version.json?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (v) {
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
    if (swReg && swReg.waiting) swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    else location.reload();
    setTimeout(function () { location.reload(); }, 5000);
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
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
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
  chargerFeriesCalendrier();
  try { if (!sessionStorage.getItem('mediplanner.lancement')) { S.ui.lancement = true; sessionStorage.setItem('mediplanner.lancement', '1'); } }
  catch (e) { S.ui.lancement = true; }
  // Nouveautés : celles des versions publiées depuis la dernière ouverture, affichées une seule fois
  (function () {
    var vue = LS.get('versionVue', '');
    if (vue === APP_VERSION) return;
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
  rendre();
  if (configureParLien) toast('Application configurée. Synchronisation…');
  if (connecte()) synchroniser(!configureParLien).then(function () {
    if (configureParLien && pret()) { S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); }
  });

  // Accès pour les tests automatisés
  window.__tournees = { S: S, ctx: ctx, texteProgramme: texteProgramme, urlWhatsapp: urlWhatsapp, normaliserNumero: normaliserNumero,
                        version: APP_VERSION, calculerStats: calculerStats, filtrerPraticiens: filtrerPraticiens, erreursEtape: erreursEtape };
})();
