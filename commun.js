/* =============================================================================
   commun.js : référentiel, modèle de données et fonctions partagées (version 3)
   Ce fichier est IDENTIQUE dans l'application (commun.js) et dans Google Apps
   Script (Commun.gs). Toute modification doit être reportée dans les deux.

   Modèle de données
   - Praticiens : une ligne par médecin ou pharmacie (note de potentiel 1 à 3,
     3 = fort potentiel ; conventionné Oui/Non ; suivi des visites).
   - Présences  : une ligne par lieu d'exercice d'un praticien, avec une colonne
     par jour (Lundi à Vendredi) contenant « Matin », « Soir » ou « Matin et soir »,
     et les horaires du matin et du soir propres à ce lieu.
   ============================================================================= */

var VERSION_DONNEES = 3;
var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
var JOURS_CLES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
var CRENEAUX = ['Matin', 'Soir'];
var DISPOS = ['Matin', 'Soir', 'Matin et soir'];

var STATUTS_DEFAUT = [
  { nom: 'Présent', visite: true },
  { nom: 'Absent', visite: false },
  { nom: 'Intéressé', visite: true },
  { nom: 'À rappeler', visite: true },
  { nom: 'Refus', visite: true },
  { nom: 'RDV reporté', visite: false }
];

// Clé interne -> en-tête de colonne dans le Google Sheet
var CHAMPS_PRATICIENS = [
  ['code', 'CodeContact'], ['type', 'Type'], ['nom', 'Nom'], ['specialite', 'Spécialité'],
  ['note', 'Note'], ['conventionne', 'Conventionné'], ['telephone', 'Téléphone'],
  ['derniere', 'DateDerniereVisite'], ['statut', 'DernierStatut'], ['commentaire', 'DernierCommentaire'],
  ['nbVisites', 'NbVisites'], ['actif', 'Actif'],
  ['prochaine', 'ProchaineEtape'], ['absentDu', 'AbsentDu'], ['absentAu', 'AbsentAu']
];

var CHAMPS_PRESENCES = [
  ['id', 'IdPresence'], ['code', 'CodeContact'], ['nom', 'Nom'], ['lieu', 'Lieu/Etablissement'],
  ['quartier', 'Quartier'], ['commune', 'Commune'], ['zone', 'Zone'],
  ['lundi', 'Lundi'], ['mardi', 'Mardi'], ['mercredi', 'Mercredi'], ['jeudi', 'Jeudi'], ['vendredi', 'Vendredi'],
  ['horaireMatin', 'HoraireMatin'], ['horaireSoir', 'HoraireSoir'], ['lat', 'Latitude'], ['lon', 'Longitude']
];

var CHAMPS_HIST = [
  ['date', 'DateVisite'], ['horodatage', 'Horodatage'], ['idPresence', 'IdPresence'], ['code', 'CodeContact'],
  ['nom', 'Nom'], ['type', 'Type'], ['specialite', 'Spécialité'], ['note', 'Note'],
  ['commune', 'Commune'], ['quartier', 'Quartier'], ['lieu', 'Lieu/Etablissement'], ['creneau', 'Créneau'],
  ['statut', 'Statut'], ['commentaire', 'Commentaire'], ['uid', 'IdSync'], ['delegue', 'Délégué'],
  ['produits', 'Produits'], ['prochaine', 'ProchaineEtape']
];

// Tournées publiées par les délégués (visibles par toute l'équipe)
var CHAMPS_PLAN = [
  ['delegue', 'Délégué'], ['date', 'Date'], ['heure', 'HeurePrevue'], ['creneau', 'Créneau'],
  ['debut', 'Debut'], ['fin', 'Fin'], ['idPresence', 'IdPresence'], ['code', 'CodeContact'], ['nom', 'Nom'],
  ['specialite', 'Spécialité'], ['note', 'Note'], ['quartier', 'Quartier'], ['commune', 'Commune'],
  ['lieu', 'Lieu/Etablissement'], ['statut', 'Statut'], ['etat', 'Etat'], ['programme', 'Programme'],
  ['maj', 'MiseAJour'], ['uid', 'IdArret'], ['depuis', 'CibleDepuis']
];

// Commune, Quartier, Zone, Latitude, Longitude (coordonnées approximatives)
var QUARTIERS_DEFAUT = [
  ['Abobo', 'Abobo Gare', 'Zone Nord', 5.418, -4.020],
  ['Abobo', 'Abobo Baoulé', 'Zone Nord', 5.440, -4.008],
  ['Abobo', 'Avocatier', 'Zone Nord', 5.432, -4.035],
  ['Abobo', 'PK 18', 'Zone Nord', 5.455, -4.050],
  ['Anyama', 'Anyama Centre', 'Zone Nord', 5.495, -4.052],
  ['Anyama', 'Ebimpé', 'Zone Nord', 5.470, -4.075],
  ['Adjamé', 'Adjamé Liberté', 'Zone Centre', 5.357, -4.022],
  ['Adjamé', 'Williamsville', 'Zone Centre', 5.374, -4.013],
  ['Adjamé', '220 Logements', 'Zone Centre', 5.363, -4.030],
  ['Plateau', 'Plateau Centre', 'Zone Centre', 5.322, -4.018],
  ['Plateau', 'Indénié', 'Zone Centre', 5.340, -4.014],
  ['Attécoubé', 'Santé', 'Zone Centre', 5.338, -4.042],
  ['Attécoubé', 'Locodjro', 'Zone Centre', 5.342, -4.058],
  ['Cocody', 'Cocody Centre', 'Zone Est', 5.342, -3.995],
  ['Cocody', 'Deux Plateaux', 'Zone Est', 5.366, -3.998],
  ['Cocody', 'Vallon', 'Zone Est', 5.370, -3.990],
  ['Cocody', 'Angré', 'Zone Est', 5.398, -3.985],
  ['Cocody', 'Riviera 2', 'Zone Est', 5.355, -3.965],
  ['Cocody', 'Riviera 3', 'Zone Est', 5.362, -3.952],
  ['Cocody', 'Riviera Golf', 'Zone Est', 5.336, -3.962],
  ['Cocody', 'Palmeraie', 'Zone Est', 5.373, -3.948],
  ['Cocody', 'Faya', 'Zone Est', 5.386, -3.925],
  ['Bingerville', 'Bingerville Centre', 'Zone Est', 5.355, -3.886],
  ['Bingerville', 'Akandjé', 'Zone Est', 5.372, -3.905],
  ['Treichville', 'Treichville Arras', 'Zone Sud', 5.302, -4.011],
  ['Treichville', 'Biafra', 'Zone Sud', 5.296, -4.001],
  ['Marcory', 'Zone 4', 'Zone Sud', 5.289, -3.985],
  ['Marcory', 'Biétry', 'Zone Sud', 5.278, -3.973],
  ['Marcory', 'Marcory Résidentiel', 'Zone Sud', 5.298, -3.991],
  ['Marcory', 'Anoumabo', 'Zone Sud', 5.304, -3.978],
  ['Koumassi', 'Remblais', 'Zone Sud', 5.300, -3.955],
  ['Koumassi', 'Koumassi Sicogi', 'Zone Sud', 5.292, -3.944],
  ['Koumassi', 'Grand Campement', 'Zone Sud', 5.286, -3.934],
  ['Port-Bouët', 'Port-Bouët Centre', 'Zone Sud', 5.255, -3.930],
  ['Port-Bouët', 'Vridi', 'Zone Sud', 5.258, -4.002],
  ['Port-Bouët', 'Gonzagueville', 'Zone Sud', 5.246, -3.882],
  ['Yopougon', 'Selmer', 'Zone Ouest', 5.346, -4.068],
  ['Yopougon', 'Sicogi', 'Zone Ouest', 5.336, -4.076],
  ['Yopougon', 'Toits Rouges', 'Zone Ouest', 5.351, -4.086],
  ['Yopougon', 'Niangon', 'Zone Ouest', 5.329, -4.102],
  ['Yopougon', 'Maroc', 'Zone Ouest', 5.344, -4.092],
  ['Songon', 'Songon Agban', 'Zone Ouest', 5.312, -4.255],
  ['Songon', "Songon M'Bratté", 'Zone Ouest', 5.330, -4.230]
];

// Paramètres du moteur (ajustables)
var REGLAGES_MOTEUR = {
  penaliteKm: 25,              // points de score retirés par km de détour ajouté à la tournée
  rayonAutourKm: 5,            // rayon par défaut de « Autour de moi »
  nbPropositions: 15,
  detourRoutier: 1.3,          // coefficient vol d'oiseau -> distance routière
  minutesParKm: 3,             // vitesse moyenne en ville (~20 km/h, trafic d'Abidjan)
  facteurPointe: 1.6,          // trajets plus lents aux heures de pointe
  heuresPointe: [[420, 570], [990, 1170]],   // 7:00-9:30 et 16:30-19:30
  minutesPont: 10,             // traversée de la lagune (Plateau / Treichville : ponts souvent saturés)
  communesSud: ['Treichville', 'Marcory', 'Koumassi', 'Port-Bouët'],
  dureeVisite: 20,             // minutes passées par visite
  toleranceRdv: 10,            // minutes de retard tolérées sur un RDV fixé
  horaireMatinDefaut: '08:00-12:00',
  horaireSoirDefaut: '15:00-19:00',
  cadence: { 3: 14, 2: 30, 1: 60 }   // jours visés entre deux visites selon la note (3 = fort potentiel)
};

// ---------------------------------------------------------------- Texte
function sansAccents(s) {
  return String(s === undefined || s === null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function normaliser(s) { return sansAccents(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

// ---------------------------------------------------------------- Dates (AAAA-MM-JJ, sans fuseau)
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function isoVersJours(iso) {
  var p = String(iso).split('-');
  return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
}
function joursVersIso(n) {
  var d = new Date(n * 86400000);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
function ajouterJours(iso, n) { return joursVersIso(isoVersJours(iso) + n); }
// 0 = lundi ... 6 = dimanche
function jourSemaineIndex(iso) { return (new Date(isoVersJours(iso) * 86400000).getUTCDay() + 6) % 7; }
function lundiDe(iso) { return ajouterJours(iso, -jourSemaineIndex(iso)); }
function nomJour(iso) {
  var i = jourSemaineIndex(iso);
  return i < 5 ? JOURS[i] : (i === 5 ? 'Samedi' : 'Dimanche');
}
function joursOuvres(lundi) { var r = []; for (var i = 0; i < 5; i++) r.push(ajouterJours(lundi, i)); return r; }
function joursEcoules(derniereIso, refIso) {
  if (!derniereIso) return 365;
  var n = isoVersJours(refIso) - isoVersJours(derniereIso);
  return n < 0 ? 0 : n;
}

// ---------------------------------------------------------------- Heures
// "08:30", "8h30", "8" -> minutes depuis minuit (null si vide ou illisible)
function heureVersMinutes(h) {
  if (h === null || h === undefined || h === '') return null;
  var m = String(h).match(/(\d{1,2})\s*(?:[:hH]\s*(\d{2}))?/);
  if (!m) return null;
  var v = (+m[1]) * 60 + (+(m[2] || 0));
  return v >= 0 && v < 24 * 60 ? v : null;
}
function minutesVersHeure(m) {
  m = Math.round(m);
  return pad2(Math.floor(m / 60) % 24) + ':' + pad2(m % 60);
}
// "08:00-12:00" -> [480, 720] ; valeur par défaut si illisible
function lireHoraire(texte, defaut) {
  var t = String(texte || '');
  var m = t.match(/(\d{1,2}\s*(?:[:hH]\s*(?:\d{2})?)?)\s*(?:-|–|à|a|\/)\s*(\d{1,2}\s*(?:[:hH]\s*(?:\d{2})?)?)/);
  if (m) {
    var a = heureVersMinutes(m[1]), b = heureVersMinutes(m[2]);
    if (a !== null && b !== null && b > a) return [a, b];
  }
  return defaut ? lireHoraire(defaut) : null;
}

// Contenu d'une case jour -> { matin, soir }. Accepte « Matin », « Soir », « Matin et soir »,
// ainsi que les saisies rapides M, S, MS, M+S, M/S, X (journée entière).
function lireDispo(v) {
  var t = normaliser(v);
  if (!t || t === 'non' || t === 'absent' || t === '0') return { matin: false, soir: false };
  if (t === 'x' || t === 'oui' || t === 'journee' || t === 'tous' || t === 'ms' || t === 'sm') return { matin: true, soir: true };
  var matin = t.indexOf('matin') >= 0 || t === 'm' || t.charAt(0) === 'm' && t.length <= 2;
  var soir = t.indexOf('soir') >= 0 || t.indexOf('apres') >= 0 || t === 's' || /^m.?s$/.test(t);
  return { matin: matin, soir: soir };
}
function ecrireDispo(d) { return d.matin && d.soir ? 'Matin et soir' : (d.matin ? 'Matin' : (d.soir ? 'Soir' : '')); }

// ---------------------------------------------------------------- Score et distances
// Potentiel de prescription : A (fort) = 3, B (moyen) = 2, C (faible) = 1. Accepte A/B/C ou 3/2/1.
function lireNote(n) {
  var t = String(n === undefined || n === null ? '' : n).trim().toUpperCase();
  if (t === 'A') return 3;
  if (t === 'B') return 2;
  if (t === 'C') return 1;
  n = Math.round(+t);
  return n >= 1 && n <= 3 ? n : 2;
}
function lettrePotentiel(n) { return ['C', 'B', 'A'][lireNote(n) - 1]; }

var SPECIALITES_DEFAUT = ['Généraliste', 'Cardiologue', 'Diabétologue', 'Endocrinologue', 'Pédiatre', 'Gynécologue',
  'Interniste', 'Néphrologue', 'Pneumologue', 'Dermatologue', 'Gastro-entérologue', 'Neurologue', 'Rhumatologue',
  'Ophtalmologue', 'ORL', 'Psychiatre', 'Urologue', 'Chirurgien', 'Pharmacien'];
function estConventionne(v) { var t = normaliser(v); return t === 'oui' || t === 'o' || t === 'x' || t === 'true' || t === '1' || t === 'yes'; }

// Score = potentiel (note x 100) + retard sur la cadence (plafonné à 3x) + bonus de suivi
// Durée de trajet en minutes entre deux points, selon l'heure de départ et la traversée de la lagune
function minutesTrajet(km, communeA, communeB, minuteDepart) {
  var R = REGLAGES_MOTEUR, t = km * R.minutesParKm;
  var sudA = R.communesSud.indexOf(communeA) >= 0, sudB = R.communesSud.indexOf(communeB) >= 0;
  if (communeA && communeB && sudA !== sudB) t += R.minutesPont;
  var pointe = R.heuresPointe.some(function (p) { return minuteDepart !== null && minuteDepart >= p[0] && minuteDepart <= p[1]; });
  return Math.round(pointe ? t * R.facteurPointe : t);
}
// Jours fériés (feuille Listes, colonne JoursFériés) ; valeurs par défaut pour la Côte d'Ivoire.
// Les fêtes musulmanes (fin du Ramadan, Tabaski, Maouloud) changent chaque année : à ajouter dans le Sheet.
var FERIES_DEFAUT = ['2026-11-01', '2026-11-15', '2026-12-25', '2027-01-01', '2027-03-29', '2027-05-01',
  '2027-05-06', '2027-05-17', '2027-08-07', '2027-08-15', '2027-11-01', '2027-11-15', '2027-12-25'];
function absentLe(p, iso) { return !!(p.absentDu && p.absentDu <= iso && (!p.absentAu || iso <= p.absentAu)); }

function calcScore(note, jours, dernierStatut) {
  note = lireNote(note);
  var retard = jours / REGLAGES_MOTEUR.cadence[note];
  if (retard > 3) retard = 3;
  var bonus = dernierStatut === 'À rappeler' ? 50 : (dernierStatut === 'Intéressé' ? 30 : 0);
  return Math.round((note * 100 + retard * 100 + bonus) * 10) / 10;
}

// a, b : objets { lat, lon }. Distance routière estimée en km.
function distanceKm(a, b) {
  if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return 99;
  if (a.lat === b.lat && a.lon === b.lon) return 0;
  var R = 6371, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  var h = Math.pow(Math.sin(dLat / 2), 2) +
          Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.pow(Math.sin(dLon / 2), 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * REGLAGES_MOTEUR.detourRoutier;
}

function quartiersDefautObjets() {
  return QUARTIERS_DEFAUT.map(function (q) {
    return { commune: q[0], quartier: q[1], zone: q[2], lat: q[3], lon: q[4] };
  });
}

// ---------------------------------------------------------------- Générateur pseudo-aléatoire
function creerAlea(graine) {
  var s = graine >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- Base fictive (environ 600 praticiens)
// Chaque médecin exerce dans 1 à 3 lieux répartis dans toute la ville (hôpital public le
// matin, clinique ou cabinet privé le soir le plus souvent), certains jours seulement.
function genererBaseFictive(dateRefIso, options) {
  options = options || {};
  var nbMed = options.nbMedecins || 500;     // dimensionné pour une équipe d'une dizaine de délégués
  var nbPha = options.nbPharmacies || 100;
  var rnd = creerAlea(options.graine || 2026);
  function pioche(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function melange(arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  var Q = quartiersDefautObjets();
  var parNom = {};
  Q.forEach(function (q, i) { parNom[q.quartier] = i; });
  var pool = [];
  Q.forEach(function (q, i) {
    var w = (q.commune === 'Cocody' || q.commune === 'Plateau') ? 3 :
            (['Marcory', 'Yopougon', 'Treichville', 'Adjamé', 'Koumassi'].indexOf(q.commune) >= 0 ? 2 : 1);
    for (var k = 0; k < w; k++) pool.push(i);
  });

  var hopitaux = [
    ['CHU de Cocody', 'Cocody Centre'], ['CHU de Treichville', 'Treichville Arras'],
    ['CHU de Yopougon', 'Sicogi'], ["CHU d'Angré", 'Angré'], ["Institut de Cardiologie d'Abidjan", 'Treichville Arras'],
    ["Hôpital Général d'Abobo", 'Abobo Gare'], ['Hôpital Général de Port-Bouët', 'Port-Bouët Centre'],
    ["Hôpital Général d'Anyama", 'Anyama Centre'], ['Hôpital Général de Bingerville', 'Bingerville Centre'],
    ['Hôpital Général de Koumassi', 'Remblais'], ['Hôpital Général de Marcory', 'Anoumabo']
  ];
  var noms = ('Kouassi,Koné,Traoré,Yao,Kouadio,Konan,N\'Guessan,Ouattara,Bamba,Coulibaly,Diabaté,' +
    'Touré,Kouamé,Aka,Assi,Brou,Djédjé,Gnagne,Séka,Tanoh,Ehui,Amon,Dosso,Fofana,Cissé,Soro,Silué,' +
    'Yéo,Tuo,Zadi,Gnahoré,Dago,Kacou,Koffi,Adou,Atta,Loukou,Méité,Kra,Ahoussou,Boni,Anoh,' +
    'Diomandé,Sangaré,Yapi,Tapé,Lohoues,Bédi,Okou,Gbané').split(',');
  var prenoms = ('Aya,Adjoua,Akissi,Amenan,Affoué,Ahou,Mariam,Fatoumata,Awa,Aminata,Kadidja,' +
    'Christelle,Esther,Grâce,Nadège,Patricia,Rachelle,Odile,Koffi,Kouakou,Yao,Kouamé,Konan,' +
    'Moussa,Ibrahim,Seydou,Lassina,Drissa,Jean-Marc,Serge,Hervé,Didier,Arnaud,Franck,Thierry,' +
    'Ange,Hermann,Rodrigue,Wilfried,Sylvain').split(',');
  var specs = ('Généraliste,Généraliste,Généraliste,Généraliste,Cardiologue,Cardiologue,' +
    'Diabétologue,Diabétologue,Pédiatre,Pédiatre,Gynécologue,Interniste,Néphrologue,' +
    'Pneumologue,Endocrinologue,Dermatologue').split(',');
  var etabs = ('Les Oliviers,La Providence,Sainte Marie,Les Palmiers,Espérance,Le Bon Samaritain,' +
    'La Colombe,Les Grâces,Horizon,Les Flamboyants,La Source,Saint Luc,Les Rosiers,Bethesda,' +
    'La Lagune,Saint Gabriel,Les Cocotiers,Notre Dame,Le Phare,Les Acacias').split(',');
  var pharmas = ('des Lagunes,Sainte Famille,du Bonheur,de l\'Espoir,Les Palmiers,Saint Joseph,' +
    'Bel Air,de la Paix,Les Rosiers,Notre Dame,du Carrefour,Les Cocotiers,de la Gare,Emmanuel,' +
    'Grâce Divine,Belle Vue,du Rond-Point,Saint Michel,Les Flamboyants,de la Cité,Siloé,' +
    'Le Jourdain,de l\'Avenir,Les Acacias,Sainte Rita').split(',');
  var fortPotentiel = ['Cardiologue', 'Diabétologue', 'Endocrinologue', 'Interniste', 'Néphrologue'];
  var horairesMatin = ['08:00-12:00', '08:30-12:30', '09:00-13:00', '07:30-11:30'];
  var horairesSoir = ['15:00-18:00', '16:00-19:00', '17:00-20:00', '15:30-19:00'];

  function tirerNote(fort) {
    var r = rnd();
    if (fort) return r < 0.45 ? 3 : (r < 0.85 ? 2 : 1);
    return r < 0.2 ? 3 : (r < 0.6 ? 2 : 1);
  }
  function tirerDerniere() {
    if (rnd() < 0.1) return '';
    return ajouterJours(dateRefIso, -(1 + Math.floor(rnd() * 120)));
  }

  var praticiens = [], presences = [];
  function ajouterPresence(code, nom, lieu, qi, grille, hM, hS) {
    var q = Q[qi];
    var p = { id: presences.length + 1, code: code, nom: nom, lieu: lieu, quartier: q.quartier,
              commune: q.commune, zone: q.zone, horaireMatin: hM, horaireSoir: hS, lat: '', lon: '' };
    JOURS_CLES.forEach(function (j, i) { p[j] = ecrireDispo(grille[i]); });
    presences.push(p);
  }

  var m, code, nom, spec;
  // Médecins
  for (m = 1; m <= nbMed; m++) {
    code = 'MED-' + ('00' + m).slice(-3);
    nom = 'Dr ' + pioche(noms) + ' ' + pioche(prenoms);
    spec = pioche(specs);
    praticiens.push({ code: code, type: 'Médecin', nom: nom, specialite: spec,
      note: tirerNote(fortPotentiel.indexOf(spec) >= 0), conventionne: rnd() < 0.55 ? 'Oui' : 'Non', telephone: '',
      derniere: tirerDerniere(), statut: '', commentaire: '', nbVisites: 0, actif: 'Oui' });

    var r = rnd(), nbLieux = r < 0.3 ? 1 : (r < 0.75 ? 2 : 3);
    var occ = JOURS.map(function () { return { matin: false, soir: false }; });
    var dejaLieux = {};
    for (var l = 0; l < nbLieux; l++) {
      var hopital = (l === 0 && rnd() < 0.45) || (l > 0 && rnd() < 0.2);
      var lieu, qi, motif;
      if (hopital) {
        var hsp = spec === 'Cardiologue' && rnd() < 0.5 ? hopitaux[4] : pioche(hopitaux);
        lieu = hsp[0]; qi = parNom[hsp[1]];
        motif = rnd() < 0.8 ? 'Matin' : 'Matin et soir';
      } else {
        var t = rnd();
        lieu = t < 0.45 ? 'Cabinet médical ' + nom : (t < 0.8 ? 'Clinique ' : 'Polyclinique ') + pioche(etabs);
        if (t < 0.45) lieu = 'Cabinet médical ' + nom.replace('Dr ', 'du Dr ');
        qi = pool[Math.floor(rnd() * pool.length)];
        var s = rnd();
        motif = s < 0.55 ? 'Soir' : (s < 0.8 ? 'Matin' : 'Matin et soir');
      }
      if (dejaLieux[lieu]) continue;
      dejaLieux[lieu] = true;
      var nbJours = nbLieux === 1 ? 3 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 3);
      var grille = JOURS.map(function () { return { matin: false, soir: false }; });
      var veut = lireDispo(motif), poses = 0;
      melange([0, 1, 2, 3, 4]).forEach(function (j) {
        if (poses >= nbJours) return;
        var d = { matin: veut.matin && !occ[j].matin, soir: veut.soir && !occ[j].soir };
        if (!d.matin && !d.soir) return;
        grille[j] = d; occ[j].matin = occ[j].matin || d.matin; occ[j].soir = occ[j].soir || d.soir; poses++;
      });
      if (!poses) continue;
      ajouterPresence(code, nom, lieu, qi, grille, pioche(horairesMatin), pioche(horairesSoir));
    }
    if (!presences.length || presences[presences.length - 1].code !== code) {
      // garantit au moins une présence
      var g = JOURS.map(function () { return { matin: false, soir: false }; });
      g[Math.floor(rnd() * 5)] = { matin: true, soir: false };
      ajouterPresence(code, nom, 'Clinique ' + pioche(etabs), pool[Math.floor(rnd() * pool.length)], g, '08:00-12:00', '15:00-19:00');
    }
  }
  // Pharmacies : le titulaire est disponible certains jours, matin et/ou soir
  for (m = 1; m <= nbPha; m++) {
    code = 'PHA-' + ('00' + m).slice(-3);
    var qp = pool[Math.floor(rnd() * pool.length)];
    nom = 'Dr ' + pioche(noms) + ' ' + pioche(prenoms);
    praticiens.push({ code: code, type: 'Pharmacie', nom: nom, specialite: 'Pharmacien',
      note: tirerNote(rnd() < 0.4), conventionne: rnd() < 0.7 ? 'Oui' : 'Non', telephone: '',
      derniere: tirerDerniere(), statut: '', commentaire: '', nbVisites: 0, actif: 'Oui' });
    var gp = JOURS.map(function () { return { matin: false, soir: false }; });
    var nj = 2 + Math.floor(rnd() * 4);
    melange([0, 1, 2, 3, 4]).slice(0, nj).forEach(function (j) {
      var x = rnd(); gp[j] = x < 0.5 ? { matin: true, soir: true } : (x < 0.75 ? { matin: true, soir: false } : { matin: false, soir: true });
    });
    ajouterPresence(code, nom, 'Pharmacie ' + pharmas[(m - 1) % pharmas.length] + ' ' + Q[qp].quartier, qp, gp,
                    '08:00-12:30', '15:00-19:30');
  }
  var res = { praticiens: praticiens, presences: presences };
  completerDonneesFictives(res.praticiens, res.presences, Q);
  return res;
}

// ---------------------------------------------------------------- Compléments de la base de test
// Comble les données manquantes d'une base FICTIVE (ne jamais l'appliquer à une vraie base) :
// - téléphone : numéro fictif au format +225 00 .. .. .. .. (préfixe 00 non attribué en Côte d'Ivoire,
//   aucun vrai numéro ne peut être composé par erreur) ;
// - dernier statut, commentaire et nombre de visites, cohérents avec la date de dernière visite ;
// - latitude et longitude de chaque établissement : coordonnées du quartier, décalées de quelques
//   centaines de mètres (le même établissement garde toujours le même point).
function hachage(t) {
  var h = 2166136261;
  t = String(t);
  for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
var COMMENTAIRES_FICTIFS = {
  'Présent': ['Présentation du produit faite, échantillons remis', 'Bon accueil, rappel des indications', 'Échantillons remis, à revoir dans un mois',
              'Discussion sur les cas cliniques, documentation remise', 'Visite courte, entre deux consultations'],
  'Intéressé': ['Intéressé par la nouvelle forme, demande une étude', 'Souhaite recevoir la documentation scientifique', 'Prêt à essayer sur quelques patients'],
  'À rappeler': ['Très occupé, rappeler pour fixer un RDV', 'Demande à être revu après ses congés', 'Rappeler en début de semaine prochaine'],
  'Refus': ['Fidèle à un produit concurrent', 'Ne reçoit pas les délégués pour le moment']
};
function completerDonneesFictives(praticiens, presences, quartiers) {
  var n = { telephone: 0, statut: 0, commentaire: 0, nbVisites: 0, gps: 0 };
  praticiens.forEach(function (p) {
    var h = hachage(p.code);
    if (!String(p.telephone || '').trim()) {
      var ch = ('00000000' + (h % 100000000)).slice(-8);
      p.telephone = '+225 00 ' + ch.slice(0, 2) + ' ' + ch.slice(2, 4) + ' ' + ch.slice(4, 6) + ' ' + ch.slice(6, 8);
      n.telephone++;
    }
    if (!p.derniere) return;                         // jamais visité : pas de statut ni de commentaire
    var r = (h >>> 8) % 100;
    if (!String(p.statut || '').trim()) {
      p.statut = r < 70 ? 'Présent' : (r < 85 ? 'Intéressé' : (r < 95 ? 'À rappeler' : 'Refus'));
      n.statut++;
    }
    if (!String(p.commentaire || '').trim()) {
      var l = COMMENTAIRES_FICTIFS[p.statut] || COMMENTAIRES_FICTIFS['Présent'];
      p.commentaire = l[(h >>> 4) % l.length];
      n.commentaire++;
    }
    if (!(+p.nbVisites > 0)) { p.nbVisites = 1 + (h >>> 12) % 8; n.nbVisites++; }
  });
  var idx = {};
  (quartiers || []).forEach(function (q) { idx[normaliser(q.quartier)] = q; });
  presences.forEach(function (x) {
    if (String(x.lat || '').trim() && String(x.lon || '').trim()) return;
    var q = idx[normaliser(x.quartier)];
    if (!q) return;
    var h = hachage(normaliser(x.lieu) + '|' + normaliser(x.quartier));
    var dLat = ((h % 1000) / 1000 - 0.5) * 0.008, dLon = (((h >>> 10) % 1000) / 1000 - 0.5) * 0.008;   // ± 450 m environ
    x.lat = Math.round((+q.lat + dLat) * 1e5) / 1e5;
    x.lon = Math.round((+q.lon + dLon) * 1e5) / 1e5;
    n.gps++;
  });
  return n;
}

// Export pour les tests sous Node (sans effet dans le navigateur et dans Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSION_DONNEES: VERSION_DONNEES, JOURS: JOURS, JOURS_CLES: JOURS_CLES, CRENEAUX: CRENEAUX, DISPOS: DISPOS,
    STATUTS_DEFAUT: STATUTS_DEFAUT, CHAMPS_PRATICIENS: CHAMPS_PRATICIENS, CHAMPS_PRESENCES: CHAMPS_PRESENCES,
    CHAMPS_HIST: CHAMPS_HIST, CHAMPS_PLAN: CHAMPS_PLAN, QUARTIERS_DEFAUT: QUARTIERS_DEFAUT,
    REGLAGES_MOTEUR: REGLAGES_MOTEUR, sansAccents: sansAccents, normaliser: normaliser, pad2: pad2,
    isoVersJours: isoVersJours, joursVersIso: joursVersIso, ajouterJours: ajouterJours,
    jourSemaineIndex: jourSemaineIndex, lundiDe: lundiDe, nomJour: nomJour, joursOuvres: joursOuvres,
    joursEcoules: joursEcoules, heureVersMinutes: heureVersMinutes, minutesVersHeure: minutesVersHeure,
    lireHoraire: lireHoraire, lireDispo: lireDispo, ecrireDispo: ecrireDispo, lireNote: lireNote,
    lettrePotentiel: lettrePotentiel, SPECIALITES_DEFAUT: SPECIALITES_DEFAUT,
    completerDonneesFictives: completerDonneesFictives, hachage: hachage,
    minutesTrajet: minutesTrajet, FERIES_DEFAUT: FERIES_DEFAUT, absentLe: absentLe,
    estConventionne: estConventionne, calcScore: calcScore, distanceKm: distanceKm,
    quartiersDefautObjets: quartiersDefautObjets, creerAlea: creerAlea, genererBaseFictive: genererBaseFictive
  };
}
