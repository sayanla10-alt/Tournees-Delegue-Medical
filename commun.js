/* =============================================================================
   commun.js : référentiel et fonctions partagées
   Ce fichier est IDENTIQUE dans l'application (pwa/js/commun.js)
   et dans Google Apps Script (Commun.gs). Toute modification doit être
   reportée dans les deux.
   ============================================================================= */

var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
var CRENEAUX = ['Matin', 'Après-midi'];

// Statuts proposés et indication "compte comme visite effective"
// (modifiables dans la feuille Listes du Google Sheet)
var STATUTS_DEFAUT = [
  { nom: 'Présent', visite: true },
  { nom: 'Absent', visite: false },
  { nom: 'Intéressé', visite: true },
  { nom: 'À rappeler', visite: true },
  { nom: 'Refus', visite: true },
  { nom: 'RDV reporté', visite: false }
];

// Clé interne -> en-tête de colonne dans le Google Sheet
var CHAMPS_BASE = [
  ['id', 'ID'], ['code', 'CodeContact'], ['type', 'Type'], ['nom', 'Nom'],
  ['specialite', 'Spécialité'], ['priorite', 'Priorité'], ['zone', 'Zone'],
  ['commune', 'Commune'], ['quartier', 'Quartier'], ['lieu', 'Lieu/Etablissement'],
  ['jour', 'Jour'], ['creneau', 'Créneau'], ['heure', 'Heure'],
  ['derniere', 'DateDerniereVisite'], ['statut', 'DernierStatut'],
  ['commentaire', 'DernierCommentaire'], ['nbVisites', 'NbVisites']
];

var CHAMPS_HIST = [
  ['date', 'DateVisite'], ['horodatage', 'Horodatage'], ['id', 'ID'], ['code', 'CodeContact'],
  ['nom', 'Nom'], ['type', 'Type'], ['specialite', 'Spécialité'], ['priorite', 'Priorité'],
  ['commune', 'Commune'], ['quartier', 'Quartier'], ['lieu', 'Lieu/Etablissement'],
  ['creneau', 'Créneau'], ['statut', 'Statut'], ['commentaire', 'Commentaire'], ['uid', 'IdSync']
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
  penaliteKm: 25,          // points de score retirés par km d'écart à la cible "ancre"
  rayonRattrapageKm: 6,    // rayon de recherche des cibles de remplacement
  nbPropositions: 10,
  detourRoutier: 1.3,      // coefficient vol d'oiseau -> distance routière
  minutesParKm: 3,         // vitesse moyenne en ville (~20 km/h, trafic d'Abidjan)
  dureeVisite: 20,         // minutes passées par visite
  finMatin: 13 * 60,       // fin du créneau du matin
  finApresMidi: 18 * 60 + 30,
  cadence: { 1: 14, 2: 30, 3: 60 }   // jours entre deux visites selon la priorité
};

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
function jourSemaineIndex(iso) {
  var d = new Date(isoVersJours(iso) * 86400000).getUTCDay();
  return (d + 6) % 7;
}

function lundiDe(iso) { return ajouterJours(iso, -jourSemaineIndex(iso)); }

function nomJour(iso) {
  var i = jourSemaineIndex(iso);
  return i < 5 ? JOURS[i] : (i === 5 ? 'Samedi' : 'Dimanche');
}

// Prochaine date tombant sur "jour" (strict : exclut la date de départ)
function prochaineDate(depuisIso, jour, strict) {
  var delta = JOURS.indexOf(jour) - jourSemaineIndex(depuisIso);
  if (delta < 0 || (delta === 0 && strict)) delta += 7;
  return ajouterJours(depuisIso, delta);
}

function joursEcoules(derniereIso, refIso) {
  if (!derniereIso) return 365;
  var n = isoVersJours(refIso) - isoVersJours(derniereIso);
  return n < 0 ? 0 : n;
}

// "08:30", "8h30", "8:00" -> minutes depuis minuit (null si vide)
function heureVersMinutes(h) {
  if (h === null || h === undefined || h === '') return null;
  var m = String(h).match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/);
  if (!m) return null;
  return (+m[1]) * 60 + (+(m[2] || 0));
}

// ---------------------------------------------------------------- Score et distances
// Score = poids de priorité + retard sur la cadence (plafonné à 3x) + bonus de statut
function calcScore(prio, jours, dernierStatut) {
  prio = +prio;
  if (!(prio >= 1 && prio <= 3)) prio = 3;
  var retard = jours / REGLAGES_MOTEUR.cadence[prio];
  if (retard > 3) retard = 3;
  var bonus = dernierStatut === 'À rappeler' ? 50 : (dernierStatut === 'Intéressé' ? 30 : 0);
  return Math.round(((4 - prio) * 100 + retard * 100 + bonus) * 10) / 10;
}

// a, b : objets { lat, lon }. Distance routière estimée en km.
function distanceKm(a, b) {
  if (!a || !b) return 99;
  if (a === b) return 0;
  var R = 6371, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  var h = Math.pow(Math.sin(dLat / 2), 2) +
          Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.pow(Math.sin(dLon / 2), 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * REGLAGES_MOTEUR.detourRoutier;
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

// ---------------------------------------------------------------- Base fictive (~245 lignes)
function genererBaseFictive(dateRefIso, options) {
  options = options || {};
  var nbMed = options.nbMedecins || 140;
  var nbPha = options.nbPharmacies || 45;
  var rnd = creerAlea(options.graine || 2026);
  function pioche(arr) { return arr[Math.floor(rnd() * arr.length)]; }

  var Q = QUARTIERS_DEFAUT.map(function (q) {
    return { commune: q[0], quartier: q[1], zone: q[2], lat: q[3], lon: q[4] };
  });
  // Pondération : plus de structures de santé à Cocody et au Plateau
  var pool = [];
  Q.forEach(function (q, i) {
    var w = (q.commune === 'Cocody' || q.commune === 'Plateau') ? 3 :
            (['Marcory', 'Yopougon', 'Treichville', 'Adjamé'].indexOf(q.commune) >= 0 ? 2 : 1);
    for (var k = 0; k < w; k++) pool.push(i);
  });

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
  var fortPotentiel = ['Cardiologue', 'Diabétologue', 'Endocrinologue', 'Interniste'];

  function tirerPriorite(fort) {
    var r = rnd();
    if (fort) return r < 0.45 ? 1 : (r < 0.85 ? 2 : 3);
    return r < 0.2 ? 1 : (r < 0.6 ? 2 : 3);
  }
  function tirerTypeLieu() { var r = rnd(); return r < 0.45 ? 'Cabinet' : (r < 0.8 ? 'Clinique' : 'Polyclinique'); }
  function nomLieu(type, nom) {
    if (type === 'Cabinet') return 'Cabinet médical ' + nom;
    return type + ' ' + pioche(etabs);
  }
  function tirerHeure(cren) {
    var h = (cren === 'Matin' ? 8 : 14) + Math.floor(rnd() * 4);
    return pad2(h) + ':' + (rnd() < 0.5 ? '00' : '30');
  }
  function tirerDerniere() {
    if (rnd() < 0.1) return '';
    return ajouterJours(dateRefIso, -(1 + Math.floor(rnd() * 120)));
  }
  function autreJour(j) { var r; do { r = pioche(JOURS); } while (r === j); return r; }
  function voisin(qi, rayon) {
    for (var t = 0; t < 30; t++) {
      var k = Math.floor(rnd() * Q.length);
      if (distanceKm(Q[qi], Q[k]) <= rayon) return k;
    }
    return qi;
  }

  var lignes = [];
  function ajouter(code, type, nom, spec, prio, qi, lieu, jour, cren, derniere) {
    var q = Q[qi];
    lignes.push({
      id: lignes.length + 1, code: code, type: type, nom: nom, specialite: spec, priorite: prio,
      zone: q.zone, commune: q.commune, quartier: q.quartier, lieu: lieu, jour: jour,
      creneau: cren, heure: tirerHeure(cren), derniere: derniere, statut: '', commentaire: '',
      nbVisites: 0
    });
  }

  var m, code, nom, spec, prio, qi, type, jour, cren, derniere;
  // Médecins : 35 % exercent aussi dans un second lieu, proche du premier
  for (m = 1; m <= nbMed; m++) {
    code = 'MED-' + ('00' + m).slice(-3);
    nom = 'Dr ' + pioche(noms) + ' ' + pioche(prenoms);
    spec = pioche(specs);
    prio = tirerPriorite(fortPotentiel.indexOf(spec) >= 0);
    derniere = tirerDerniere();
    qi = pool[Math.floor(rnd() * pool.length)];
    type = tirerTypeLieu();
    jour = pioche(JOURS);
    cren = rnd() < 0.55 ? 'Matin' : 'Après-midi';
    ajouter(code, 'Médecin', nom, spec, prio, qi, nomLieu(type, nom), jour, cren, derniere);
    if (rnd() < 0.35) {
      var qi2 = voisin(qi, 6);
      type = type === 'Cabinet' ? (rnd() < 0.6 ? 'Clinique' : 'Polyclinique') : 'Cabinet';
      var jour2, cren2;
      if (rnd() < 0.5) { jour2 = jour; cren2 = cren === 'Matin' ? 'Après-midi' : 'Matin'; }
      else { jour2 = autreJour(jour); cren2 = rnd() < 0.5 ? 'Matin' : 'Après-midi'; }
      ajouter(code, 'Médecin', nom, spec, prio, qi2, nomLieu(type, nom), jour2, cren2, derniere);
    }
  }
  // Pharmacies : 25 % ont un second créneau de disponibilité du titulaire
  for (m = 1; m <= nbPha; m++) {
    code = 'PHA-' + ('00' + m).slice(-3);
    qi = pool[Math.floor(rnd() * pool.length)];
    nom = 'Dr ' + pioche(noms) + ' ' + pioche(prenoms);
    var lieu = 'Pharmacie ' + pharmas[(m - 1) % pharmas.length] + ' ' + Q[qi].quartier;
    prio = tirerPriorite(rnd() < 0.4);
    derniere = tirerDerniere();
    jour = pioche(JOURS);
    cren = rnd() < 0.5 ? 'Matin' : 'Après-midi';
    ajouter(code, 'Pharmacie', nom, 'Pharmacien', prio, qi, lieu, jour, cren, derniere);
    if (rnd() < 0.25) {
      ajouter(code, 'Pharmacie', nom, 'Pharmacien', prio, qi, lieu, autreJour(jour),
              cren === 'Matin' ? 'Après-midi' : 'Matin', derniere);
    }
  }
  return lignes;
}

function quartiersDefautObjets() {
  return QUARTIERS_DEFAUT.map(function (q) {
    return { commune: q[0], quartier: q[1], zone: q[2], lat: q[3], lon: q[4] };
  });
}

// Export pour les tests sous Node (sans effet dans le navigateur et dans Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JOURS: JOURS, CRENEAUX: CRENEAUX, STATUTS_DEFAUT: STATUTS_DEFAUT, CHAMPS_BASE: CHAMPS_BASE,
    CHAMPS_HIST: CHAMPS_HIST, QUARTIERS_DEFAUT: QUARTIERS_DEFAUT, REGLAGES_MOTEUR: REGLAGES_MOTEUR,
    isoVersJours: isoVersJours, joursVersIso: joursVersIso, ajouterJours: ajouterJours,
    jourSemaineIndex: jourSemaineIndex, lundiDe: lundiDe, nomJour: nomJour, prochaineDate: prochaineDate,
    joursEcoules: joursEcoules, heureVersMinutes: heureVersMinutes, calcScore: calcScore,
    distanceKm: distanceKm, creerAlea: creerAlea, genererBaseFictive: genererBaseFictive,
    quartiersDefautObjets: quartiersDefautObjets, pad2: pad2
  };
}
