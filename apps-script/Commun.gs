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

// Statuts (feuille Listes) : « Visite faite » compte comme visite ; les autres sont les motifs de visite non faite
var STATUTS_DEFAUT = [
  { nom: 'Visite faite', visite: true },
  { nom: 'Absent', visite: false },
  { nom: 'Indisponible', visite: false },
  { nom: 'Refus de recevoir', visite: false },
  { nom: 'RDV reporté', visite: false },
  { nom: 'Établissement fermé', visite: false },
  { nom: 'Pharmacie fermée', visite: false },
  { nom: 'Interlocuteur absent', visite: false },
  { nom: 'Autre motif', visite: false }
];
// anciens statuts (avant 3.5.0) : convertis dans la base, encore reconnus dans l'historique
var STATUTS_RENOMMES = { 'Présent': 'Visite faite', 'Intéressé': 'Visite faite', 'À rappeler': 'Visite faite', 'Refus': 'Refus de recevoir' };
var MOTIFS_MEDECIN = ['Absent', 'Indisponible', 'Refus de recevoir', 'RDV reporté', 'Établissement fermé', 'Autre motif'];
var MOTIFS_PHARMACIE = ['Pharmacie fermée', 'Interlocuteur absent', 'Indisponible', 'Refus de recevoir', 'RDV reporté', 'Autre motif'];

// Clé interne -> en-tête de colonne dans le Google Sheet
var CHAMPS_PRATICIENS = [
  ['code', 'CodeContact'], ['type', 'Type'], ['nom', 'Nom'], ['specialite', 'Spécialité'],
  ['note', 'Note'], ['conventionne', 'Engagé'], ['telephone', 'Téléphone'],
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
  ['produits', 'Produits'], ['prochaine', 'ProchaineEtape'], ['activite', 'Activité'],
  // compte rendu détaillé (3.5.0)
  ['interlocuteur', 'Interlocuteur'], ['reactions', 'Réactions'], ['echantillons', 'Échantillons'], ['stocks', 'Stocks'],
  ['commande', 'Commande'], ['complements', 'Compléments'], ['suite', 'Suite']
];

// Pharmacies (feuille séparée, données réelles issues d'OpenStreetMap) : ouvertes du lundi au samedi,
// matin et soir ; les colonnes de suivi portent les mêmes noms que dans Praticiens.
var CHAMPS_PHARMACIES = [
  ['code', 'CodeContact'], ['nom', 'Nom'], ['titulaire', 'Titulaire'], ['quartier', 'Quartier'], ['commune', 'Commune'],
  ['zone', 'Zone'], ['lat', 'Latitude'], ['lon', 'Longitude'], ['telephone', 'Téléphone'], ['horaireMatin', 'HoraireMatin'],
  ['horaireSoir', 'HoraireSoir'], ['note', 'Note'], ['conventionne', 'Engagé'], ['derniere', 'DateDerniereVisite'],
  ['statut', 'DernierStatut'], ['commentaire', 'DernierCommentaire'], ['nbVisites', 'NbVisites'], ['actif', 'Actif'],
  ['prochaine', 'ProchaineEtape'], ['source', 'Source']
];

// Répertoire des hôpitaux et établissements de santé (CHU, Cliniques, FSU COM, Centres Médicaux, etc.)
var CHAMPS_ETABLISSEMENTS = [
  ['code', 'CodeEtab'], ['nom', 'Nom'], ['categorie', 'Categorie'], ['commune', 'Commune'],
  ['quartier', 'Quartier'], ['zone', 'Zone'], ['lat', 'Latitude'], ['lon', 'Longitude'],
  ['telephone', 'Téléphone'], ['reperes', 'Repères']
];
var HORAIRES_PHARMACIE = ['08:00-12:30', '15:00-20:00'];
var ACTIVITES_DEFAUT = ['Routine', 'Présentation produit', 'Échantillons', 'Cadeaux', 'EPU', 'Staff', 'Réunion', 'Déjeuner', 'Garde', 'Dépistage', 'Autre'];
var ACTIVITES_PHARMACIE_DEFAUT = ['Routine', 'Présentation produit', 'Échantillons', 'Cadeaux', 'Stocks', 'Commande', 'PLV', 'Formation', 'Animation', 'Retour ou échange', 'Autre'];
// anciens libellés, remplacés automatiquement (base et historique)
var ACTIVITES_RENOMMEES = { 'Visite de routine (rappel)': 'Routine', 'Réunion / staff': 'Réunion', 'Remise d\'échantillons': 'Échantillons',
  'Autre activité': 'Autre', 'Vérification des stocks': 'Stocks', 'Prise de commande': 'Commande', 'Mise en avant / PLV': 'PLV',
  'Formation de l\'équipe officinale': 'Formation', 'Animation promotionnelle': 'Animation', 'Retour ou échange de produits': 'Retour ou échange' };
var PRODUITS_DEFAUT = [
  'Zyltan', 'Zyltan H', 'Zyltan AM', 'Losartan AM',
  'Lesstrol 20', 'Lesstrol AM', 'Lesstrol EZ',
  'Eurythmic', 'Tensicard',
  'Telmikaa', 'Telmikaa AM', 'Telmikaa H', 'Telmikaa AMH', 'Telmikaa CT',
  'Rozukaa 10', 'Rozukaa 20', 'Rozukaa F', 'Rozukaa A', 'Rozukaa Gold',
  'Lesskaa', 'Myonit SR', 'Antiplatt', 'Antiplatt Plus', 'Orlitroy', 'Troynuron'
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
// Découpage en 4 secteurs pour les grandes communes (Abobo, Cocody, Yopougon) et communes du Grand Abidjan
var QUARTIERS_DEFAUT = [
  // Abobo (Zone Nord) - 4 secteurs
  ['Abobo – Nord & PK18', 'PK 18', 'Zone Nord', 5.455, -4.050],
  ['Abobo – Nord & PK18', 'N\'Dotré', 'Zone Nord', 5.475, -4.045],
  ['Abobo – Nord & PK18', 'Anonkoua Kouté', 'Zone Nord', 5.445, -4.048],
  ['Abobo – Nord & PK18', 'Belle Ville', 'Zone Nord', 5.460, -4.040],
  ['Abobo – Nord & PK18', 'Biabou', 'Zone Nord', 5.435, -4.005],
  ['Abobo – Nord & PK18', 'Akeikoi', 'Zone Nord', 5.450, -4.015],

  ['Abobo – Centre & Mairie', 'Samaké', 'Zone Nord', 5.4155, -4.0072],
  ['Abobo – Centre & Mairie', 'Gare', 'Zone Nord', 5.418, -4.020],
  ['Abobo – Centre & Mairie', 'Mairie', 'Zone Nord', 5.4162, -4.0159],
  ['Abobo – Centre & Mairie', 'Derrière rails', 'Zone Nord', 5.416, -4.017],
  ['Abobo – Centre & Mairie', 'Habitat', 'Zone Nord', 5.422, -4.022],
  ['Abobo – Centre & Mairie', 'Banco', 'Zone Nord', 5.410, -4.028],
  ['Abobo – Centre & Mairie', 'Marché', 'Zone Nord', 5.417, -4.021],
  ['Abobo – Centre & Mairie', 'Gendarmerie', 'Zone Nord', 5.414, -4.015],

  ['Abobo – Baoulé & Avocatier', 'Abobo Baoulé', 'Zone Nord', 5.440, -4.008],
  ['Abobo – Baoulé & Avocatier', 'Avocatier', 'Zone Nord', 5.432, -4.035],
  ['Abobo – Baoulé & Avocatier', 'Clouetcha', 'Zone Nord', 5.425, -4.025],
  ['Abobo – Baoulé & Avocatier', 'Dépôt SOTRA', 'Zone Nord', 5.430, -4.030],
  ['Abobo – Baoulé & Avocatier', 'Abobo-Té', 'Zone Nord', 5.438, -4.012],

  ['Abobo – Sud & Plaque', 'Plaque 1 & 2', 'Zone Nord', 5.405, -4.018],
  ['Abobo – Sud & Plaque', 'Anador', 'Zone Nord', 5.410, -4.022],
  ['Abobo – Sud & Plaque', 'Sagbé', 'Zone Nord', 5.408, -4.010],
  ['Abobo – Sud & Plaque', 'Houphouët-Boigny', 'Zone Nord', 5.412, -4.015],
  ['Abobo – Sud & Plaque', 'Dokui', 'Zone Nord', 5.395, -4.010],

  // Cocody (Zone Est) - 4 secteurs
  ['Cocody – Angré', 'Angré', 'Zone Est', 5.398, -3.985],
  ['Cocody – Angré', '7e & 8e Tranche', 'Zone Est', 5.385, -3.992],
  ['Cocody – Angré', 'CHU Angré', 'Zone Est', 5.4010, -3.9574],
  ['Cocody – Angré', 'Djorobité', 'Zone Est', 5.415, -3.965],
  ['Cocody – Angré', 'Mahou', 'Zone Est', 5.390, -3.995],
  ['Cocody – Angré', 'Château d\'Eau', 'Zone Est', 5.395, -3.982],
  ['Cocody – Angré', 'Besakoi', 'Zone Est', 5.410, -3.970],

  ['Cocody – Deux Plateaux', 'Deux Plateaux', 'Zone Est', 5.366, -3.998],
  ['Cocody – Deux Plateaux', 'Vallons', 'Zone Est', 5.370, -3.990],
  ['Cocody – Deux Plateaux', 'Aghien', 'Zone Est', 5.375, -3.985],
  ['Cocody – Deux Plateaux', 'ENA', 'Zone Est', 5.360, -4.005],
  ['Cocody – Deux Plateaux', 'Attoban', 'Zone Est', 5.370, -3.965],
  ['Cocody – Deux Plateaux', 'Sainte-Cécile', 'Zone Est', 5.362, -3.992],
  ['Cocody – Deux Plateaux', 'Latrille', 'Zone Est', 5.368, -4.002],

  ['Cocody – Riviera', 'Riviera 2', 'Zone Est', 5.355, -3.965],
  ['Cocody – Riviera', 'Riviera 3', 'Zone Est', 5.362, -3.952],
  ['Cocody – Riviera', 'Riviera Golf', 'Zone Est', 5.336, -3.962],
  ['Cocody – Riviera', 'Palmeraie', 'Zone Est', 5.373, -3.948],
  ['Cocody – Riviera', 'Faya', 'Zone Est', 5.386, -3.925],
  ['Cocody – Riviera', 'Anono', 'Zone Est', 5.335, -3.955],
  ['Cocody – Riviera', 'M\'badon', 'Zone Est', 5.340, -3.935],
  ['Cocody – Riviera', 'Akouédo', 'Zone Est', 5.365, -3.920],
  ['Cocody – Riviera', 'Abatta', 'Zone Est', 5.370, -3.910],
  ['Cocody – Riviera', 'Bonoumin', 'Zone Est', 5.360, -3.960],

  ['Cocody – Centre', 'Cocody Centre', 'Zone Est', 5.342, -3.995],
  ['Cocody – Centre', 'Saint-Jean', 'Zone Est', 5.3373, -4.0035],
  ['Cocody – Centre', 'Danga', 'Zone Est', 5.341, -4.009],
  ['Cocody – Centre', 'CHU Cocody', 'Zone Est', 5.3444, -3.9939],
  ['Cocody – Centre', 'Mermoz', 'Zone Est', 5.338, -4.005],
  ['Cocody – Centre', 'Blockhauss', 'Zone Est', 5.328, -4.000],
  ['Cocody – Centre', 'Ambassades', 'Zone Est', 5.332, -4.010],

  // Yopougon (Zone Ouest) - 4 secteurs
  ['Yopougon – Niangon', 'Niangon Nord', 'Zone Ouest', 5.335, -4.105],
  ['Yopougon – Niangon', 'Niangon Sud', 'Zone Ouest', 5.325, -4.100],
  ['Yopougon – Niangon', 'Académie', 'Zone Ouest', 5.320, -4.095],
  ['Yopougon – Niangon', 'Lokoua', 'Zone Ouest', 5.328, -4.090],
  ['Yopougon – Niangon', 'Cité Verte', 'Zone Ouest', 5.324, -4.090],
  ['Yopougon – Niangon', 'Lubafrique', 'Zone Ouest', 5.322, -4.092],
  ['Yopougon – Niangon', 'Texaco', 'Zone Ouest', 5.326, -4.098],

  ['Yopougon – Maroc & Toits Rouges', 'Maroc', 'Zone Ouest', 5.344, -4.092],
  ['Yopougon – Maroc & Toits Rouges', 'Toits Rouges', 'Zone Ouest', 5.351, -4.086],
  ['Yopougon – Maroc & Toits Rouges', 'Bel Air', 'Zone Ouest', 5.348, -4.080],
  ['Yopougon – Maroc & Toits Rouges', 'Sideci', 'Zone Ouest', 5.342, -4.082],
  ['Yopougon – Maroc & Toits Rouges', 'Ananeraie', 'Zone Ouest', 5.350, -4.095],

  ['Yopougon – Centre & Mairie', 'Siporex', 'Zone Ouest', 5.3556, -4.0792],
  ['Yopougon – Centre & Mairie', 'Mairie', 'Zone Ouest', 5.3435, -4.0718],
  ['Yopougon – Centre & Mairie', 'CHU Yopougon', 'Zone Ouest', 5.3584, -4.0897],
  ['Yopougon – Centre & Mairie', 'Saint-André', 'Zone Ouest', 5.340, -4.070],
  ['Yopougon – Centre & Mairie', 'Keneya', 'Zone Ouest', 5.343, -4.065],
  ['Yopougon – Centre & Mairie', 'Wassakara', 'Zone Ouest', 5.345, -4.075],
  ['Yopougon – Centre & Mairie', 'Ficgayo', 'Zone Ouest', 5.339, -4.065],
  ['Yopougon – Centre & Mairie', 'Nouveau Bureau', 'Zone Ouest', 5.346, -4.072],

  ['Yopougon – Sud & Gesco', 'Port-Bouët 2', 'Zone Ouest', 5.338, -4.062],
  ['Yopougon – Sud & Gesco', 'Selmer', 'Zone Ouest', 5.346, -4.068],
  ['Yopougon – Sud & Gesco', 'Sicogi', 'Zone Ouest', 5.336, -4.076],
  ['Yopougon – Sud & Gesco', 'Kouté', 'Zone Ouest', 5.330, -4.065],
  ['Yopougon – Sud & Gesco', 'Gesco', 'Zone Ouest', 5.370, -4.110],
  ['Yopougon – Sud & Gesco', 'Zone Industrielle', 'Zone Ouest', 5.360, -4.090],
  ['Yopougon – Sud & Gesco', 'Millionnaire', 'Zone Ouest', 5.340, -4.080],
  ['Yopougon – Sud & Gesco', 'Sable', 'Zone Ouest', 5.335, -4.075],

  // Autres communes d'Abidjan
  ['Plateau', 'Plateau Centre', 'Zone Centre', 5.322, -4.018],
  ['Plateau', 'Indénié', 'Zone Centre', 5.340, -4.014],

  ['Adjamé', 'Adjamé Liberté', 'Zone Centre', 5.357, -4.022],
  ['Adjamé', 'Williamsville', 'Zone Centre', 5.374, -4.013],
  ['Adjamé', '220 Logements', 'Zone Centre', 5.363, -4.030],
  ['Adjamé', 'Paillet', 'Zone Centre', 5.378, -4.015],
  ['Adjamé', 'Mirador', 'Zone Centre', 5.360, -4.025],

  ['Attécoubé', 'Santé', 'Zone Centre', 5.338, -4.042],
  ['Attécoubé', 'Locodjro', 'Zone Centre', 5.342, -4.058],

  ['Treichville', 'Arras', 'Zone Sud', 5.302, -4.011],
  ['Treichville', 'Avenue 8', 'Zone Sud', 5.305, -4.008],
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

  ['Bingerville', 'Bingerville Centre', 'Zone Est', 5.355, -3.886],
  ['Bingerville', 'Akandjé', 'Zone Est', 5.372, -3.905],

  ['Anyama', 'Anyama Centre', 'Zone Nord', 5.495, -4.052],
  ['Anyama', 'Ebimpé', 'Zone Nord', 5.470, -4.075],

  ['Songon', 'Songon Agban', 'Zone Ouest', 5.312, -4.255],
  ['Songon', "Songon M'Bratté", 'Zone Ouest', 5.330, -4.230]
];

// Paramètres du moteur (ajustables)

// ---------------------------------------------------------------- TABLE DE REFERENCE OFFICIELLE DES ETABLISSEMENTS (PWA Offline & Apps Script)
if (typeof TABLE_REFERENCE_ETABLISSEMENTS_CI === 'undefined') {
// =============================================================================
// TABLE DE REFERENCE OFFICIELLE DES ETABLISSEMENTS DE SANTE DU GRAND ABIDJAN
// 175 etablissements verifies, 534 cles et variantes normalisees
// Couverture complete des 13 communes (CHU, CHR, HG, FSU COM, CSU, Cliniques, Instituts)
// =============================================================================
var TABLE_REFERENCE_ETABLISSEMENTS_CI = {
  'adjame liberte clinique': { lat: 5.350574, lon: -4.017188, commune: 'Adjamé', quartier: 'Adjamé Liberté', titre: 'Clinique Médicale Adjamé Liberté', cat: 'Clinique Privée' },
  'agefosyn': { lat: 5.324550, lon: -4.090250, commune: 'Yopougon', quartier: 'Niangon', titre: 'AGEFOSYN (Niangon Cité Verte)', cat: 'Clinique Privée' },
  'agefosyn niangon': { lat: 5.324550, lon: -4.090250, commune: 'Yopougon', quartier: 'Niangon', titre: 'AGEFOSYN (Niangon Cité Verte)', cat: 'Clinique Privée' },
  'andre dupuy bel air': { lat: 5.332116, lon: -4.073825, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Médicale André Dupuy', cat: 'Clinique Privée' },
  'ane helene plateau': { lat: 5.323180, lon: -4.017200, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Ané Hélène (Plateau)', cat: 'Centre Médical' },
  'anokoi': { lat: 5.435020, lon: -4.046782, commune: 'Abobo', quartier: 'Anonkoua Kouté', titre: 'FSU COM Anonkoua Kouté (Abobo)', cat: 'FSU COM' },
  'anonkoua koute': { lat: 5.435020, lon: -4.046782, commune: 'Abobo', quartier: 'Anonkoua Kouté', titre: 'FSU COM Anonkoua Kouté (Abobo)', cat: 'FSU COM' },
  'assemblee nationale service medical': { lat: 5.329108, lon: -4.020814, commune: 'Plateau', quartier: 'Plateau', titre: 'Service Médical Assemblée Nationale', cat: 'Centre Médical' },
  'avicennes marcory': { lat: 5.316221, lon: -3.996662, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Avicennes (Marcory)', cat: 'Polyclinique' },
  'banque de sang cnts': { lat: 5.291530, lon: -4.004015, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Centre National de Transfusion Sanguine (CNTS)', cat: 'Institut Spécialisé' },
  'bceao abidjan': { lat: 5.321627, lon: -4.015161, commune: 'Plateau', quartier: 'Plateau', titre: 'Cabinet Médical BCEAO (Plateau)', cat: 'Centre Médical' },
  'bellevue cocody': { lat: 5.355208, lon: -3.960366, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Clinique Bellevue (Cocody)', cat: 'Clinique Privée' },
  'cabinet medical bceao': { lat: 5.321627, lon: -4.015161, commune: 'Plateau', quartier: 'Plateau', titre: 'Cabinet Médical BCEAO (Plateau)', cat: 'Centre Médical' },
  'cabinet medical de l ordre': { lat: 5.398000, lon: -3.985000, commune: 'Cocody', quartier: 'Angré', titre: 'Cabinet Médical de l\'Ordre (Angré)', cat: 'Centre Médical' },
  'cabinet medical la rotonde': { lat: 5.321750, lon: -4.017212, commune: 'Plateau', quartier: 'Plateau', titre: 'Cabinet Médical La Rotonde (Plateau)', cat: 'Centre Médical' },
  'cabinet medical nadine': { lat: 5.345109, lon: -4.010959, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Cabinet Médical Nadine (Cocody Centre)', cat: 'Centre Médical' },
  'cabinet prive palmeraie': { lat: 5.367891, lon: -3.960245, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Cabinet Privé Palmeraie', cat: 'Centre Médical' },
  'cardiologie edlona': { lat: 5.393780, lon: -3.987800, commune: 'Cocody', quartier: 'Angré', titre: 'Centre Médical de Cardiologie Edlona (Angré)', cat: 'Centre Médical' },
  'cardiologie mavor': { lat: 5.339928, lon: -4.026184, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médico-Cardiologique Mavor (Plateau)', cat: 'Centre Médical' },
  'caritas cote d ivoire': { lat: 5.300618, lon: -4.005288, commune: 'Treichville', quartier: 'Arras', titre: 'Centre Médical Caritas Côte d\'Ivoire', cat: 'Centre Médical' },
  'caritas saint etienne koumassi': { lat: 5.292185, lon: -3.962653, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'Centre Médical Paroisse Saint Étienne (Koumassi)', cat: 'Centre Médical' },
  'caritas treichville': { lat: 5.300618, lon: -4.005288, commune: 'Treichville', quartier: 'Arras', titre: 'Centre Médical Caritas Côte d\'Ivoire', cat: 'Centre Médical' },
  'cat adjame': { lat: 5.348801, lon: -4.024653, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre Antituberculeux d\'Adjamé (CAT)', cat: 'CSU / Dispensaire' },
  'centre antituberculeux': { lat: 5.348801, lon: -4.024653, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre Antituberculeux d\'Adjamé (CAT)', cat: 'CSU / Dispensaire' },
  'centre antituberculeux adjame': { lat: 5.348801, lon: -4.024653, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre Antituberculeux d\'Adjamé (CAT)', cat: 'CSU / Dispensaire' },
  'centre d assistance socio medical treichville hope ci': { lat: 5.300618, lon: -4.005288, commune: 'Treichville', quartier: 'Arras', titre: 'Centre Socio-Médical HOPE-CI (Treichville)', cat: 'Centre Médical' },
  'centre d excellence medicale xmed': { lat: 5.361285, lon: -3.894236, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Centre d\'Excellence Médicale Xmed (Bingerville)', cat: 'Centre Médical' },
  'centre de radiotherapie alassane ouattara': { lat: 5.344200, lon: -3.992800, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CNRAO (Centre Radiothérapie Alassane Ouattara)', cat: 'Institut Spécialisé' },
  'centre de sante abobo baoule': { lat: 5.430561, lon: -3.995497, commune: 'Abobo', quartier: 'Abobo Baoulé', titre: 'FSU COM Abobo Baoulé (Abobo)', cat: 'FSU COM' },
  'centre de sante abobodoume': { lat: 5.323500, lon: -4.045600, commune: 'Yopougon', quartier: 'Locodjro', titre: 'FSU d\'Abobodoumé / Locodjro (Yopougon)', cat: 'FSU COM' },
  'centre de sante adjame bingerville': { lat: 5.351016, lon: -3.874594, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'CSU Adjamé-Bingerville', cat: 'CSU / Dispensaire' },
  'centre de sante aklomiabla': { lat: 5.314414, lon: -3.942635, commune: 'Koumassi', quartier: 'Aklomiabla', titre: 'CSU-COM Aklomiabla (Koumassi)', cat: 'FSU COM' },
  'centre de sante akouedo': { lat: 5.360216, lon: -3.967437, commune: 'Cocody', quartier: 'Akouédo', titre: 'CSU Communautaire d\'Akouédo (Cocody)', cat: 'CSU / Dispensaire' },
  'centre de sante anono': { lat: 5.345840, lon: -3.973720, commune: 'Cocody', quartier: 'Anono', titre: 'CSU Communautaire d\'Anono (Cocody)', cat: 'CSU / Dispensaire' },
  'centre de sante anoumabo': { lat: 5.304100, lon: -3.978200, commune: 'Marcory', quartier: 'Anoumabo', titre: 'FSU COM Anoumabo (Marcory)', cat: 'FSU COM' },
  'centre de sante anyama adjame': { lat: 5.492000, lon: -4.053000, commune: 'Anyama', quartier: 'Anyama Centre', titre: 'CSU d\'Anyama Adjamé', cat: 'CSU / Dispensaire' },
  'centre de sante anyama zossonkoi': { lat: 5.495000, lon: -4.051000, commune: 'Anyama', quartier: 'Zossonkoi', titre: 'FSU COM Anyama Zossonkoi', cat: 'FSU COM' },
  'centre de sante arras 3': { lat: 5.302080, lon: -3.999650, commune: 'Treichville', quartier: 'Arras', titre: 'CSU Communautaire Arras 3 (Treichville)', cat: 'CSU / Dispensaire' },
  'centre de sante blockhauss': { lat: 5.324470, lon: -4.001380, commune: 'Cocody', quartier: 'Blockhauss', titre: 'Complexe Sanitaire de Blockhauss (Cocody)', cat: 'CSU / Dispensaire' },
  'centre de sante boribana': { lat: 5.338500, lon: -4.042000, commune: 'Attécoubé', quartier: 'Boribana', titre: 'CSU de Boribana (Attécoubé)', cat: 'CSU / Dispensaire' },
  'centre de sante communautaire sagbe': { lat: 5.424500, lon: -4.018000, commune: 'Abobo', quartier: 'Sagbé', titre: 'FSU COM Sagbé (Abobo)', cat: 'FSU COM' },
  'centre de sante d abobo te': { lat: 5.405770, lon: -4.001070, commune: 'Abobo', quartier: 'Abobo-Té', titre: 'Centre de Santé d\'Abobo-Té', cat: 'CSU / Dispensaire' },
  'centre de sante d aliodan': { lat: 5.298000, lon: -3.987000, commune: 'Marcory', quartier: 'Aliodan', titre: 'CSU d\'Aliodan (Marcory)', cat: 'CSU / Dispensaire' },
  'centre de sante gbagba': { lat: 5.349640, lon: -3.887730, commune: 'Bingerville', quartier: 'Gbagba', titre: 'CSU de Gbagba (Bingerville)', cat: 'CSU / Dispensaire' },
  'centre de sante gonzagueville': { lat: 5.246200, lon: -3.882100, commune: 'Port-Bouët', quartier: 'Gonzagueville', titre: 'FSU COM Gonzagueville (Port-Bouët)', cat: 'FSU COM' },
  'centre de sante grand campement': { lat: 5.286200, lon: -3.934100, commune: 'Koumassi', quartier: 'Grand Campement', titre: 'FSU COM Grand Campement (Koumassi)', cat: 'FSU COM' },
  'centre de sante niangon sud': { lat: 5.328000, lon: -4.105000, commune: 'Yopougon', quartier: 'Niangon', titre: 'FSU COM Niangon Sud (Yopougon)', cat: 'FSU COM' },
  'centre de sante palmeraie': { lat: 5.363386, lon: -3.962535, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'CSU COM Palmeraie (Cocody)', cat: 'CSU / Dispensaire' },
  'centre de sante pangolin': { lat: 5.300247, lon: -3.946385, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'FSU COM Koumassi (Pangolin)', cat: 'FSU COM' },
  'centre de sante plateau': { lat: 5.328040, lon: -4.026680, commune: 'Plateau', quartier: 'Plateau', titre: 'FSU du Plateau', cat: 'FSU COM' },
  'centre de sante port bouet 2 yopougon': { lat: 5.347124, lon: -4.093089, commune: 'Yopougon', quartier: 'Port-Bouët 2', titre: 'FSU COM Port-Bouët 2 (Yopougon)', cat: 'FSU COM' },
  'centre de sante songon agban': { lat: 5.312000, lon: -4.255000, commune: 'Songon', quartier: 'Songon Agban', titre: 'CSU de Songon Agban', cat: 'CSU / Dispensaire' },
  'centre de sante songon mbratte': { lat: 5.330000, lon: -4.230000, commune: 'Songon', quartier: 'Songon M\'Bratté', titre: 'CSU de Songon M\'Bratté', cat: 'CSU / Dispensaire' },
  'centre de sante toits rouges': { lat: 5.331500, lon: -4.056160, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'FSU COM de Toits Rouges (Yopougon)', cat: 'FSU COM' },
  'centre de sante urbain communautaire arras 3': { lat: 5.302080, lon: -3.999650, commune: 'Treichville', quartier: 'Arras', titre: 'CSU Communautaire Arras 3 (Treichville)', cat: 'CSU / Dispensaire' },
  'centre de sante urbain communautaire d anono': { lat: 5.345840, lon: -3.973720, commune: 'Cocody', quartier: 'Anono', titre: 'CSU Communautaire d\'Anono (Cocody)', cat: 'CSU / Dispensaire' },
  'centre de sante urbain d angre': { lat: 5.405200, lon: -3.984630, commune: 'Cocody', quartier: 'Angré', titre: 'CSU d\'Angré (Cocody)', cat: 'CSU / Dispensaire' },
  'centre de sante urbain de gbagba': { lat: 5.349640, lon: -3.887730, commune: 'Bingerville', quartier: 'Gbagba', titre: 'CSU de Gbagba (Bingerville)', cat: 'CSU / Dispensaire' },
  'centre de sante urbain de port bouet centre': { lat: 5.255400, lon: -3.930200, commune: 'Port-Bouët', quartier: 'Port-Bouët Centre', titre: 'CSU Port-Bouët Centre', cat: 'CSU / Dispensaire' },
  'centre de sante vridi cite': { lat: 5.258100, lon: -4.002400, commune: 'Port-Bouët', quartier: 'Vridi', titre: 'FSU COM Vridi Cité (Port-Bouët)', cat: 'FSU COM' },
  'centre de sante wassakara': { lat: 5.353300, lon: -4.067760, commune: 'Yopougon', quartier: 'Wassakara', titre: 'FSU COM de Wassakara (Yopougon)', cat: 'FSU COM' },
  'centre de sante yopougon sante': { lat: 5.310381, lon: -4.044301, commune: 'Yopougon', quartier: 'Santé', titre: 'CSU Yopougon Santé', cat: 'CSU / Dispensaire' },
  'centre de soins inchallah': { lat: 5.365073, lon: -4.023572, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre de Soins Inchallah (Adjamé)', cat: 'CSU / Dispensaire' },
  'centre de soins inchallah gare de divo': { lat: 5.365073, lon: -4.023572, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre de Soins Inchallah (Adjamé)', cat: 'CSU / Dispensaire' },
  'centre dialyse adjame': { lat: 5.348801, lon: -4.024653, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre d\'Hémodialyse HLG Adjamé', cat: 'Centre Médical' },
  'centre dialyse cocody': { lat: 5.341970, lon: -3.994485, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CNPTIR (Centre Insuffisance Rénale Cocody)', cat: 'Institut Spécialisé' },
  'centre hemodialyse cnptir': { lat: 5.341970, lon: -3.994485, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CNPTIR (Centre Insuffisance Rénale Cocody)', cat: 'Institut Spécialisé' },
  'centre hospitalier universitaire d angre': { lat: 5.401021, lon: -3.957441, commune: 'Cocody', quartier: 'Angré Djibi', titre: 'CHU d\'Angré', cat: 'CHU' },
  'centre hospitalier universitaire de cocody': { lat: 5.343512, lon: -3.993045, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CHU de Cocody', cat: 'CHU' },
  'centre hospitalier universitaire de treichville': { lat: 5.291248, lon: -4.003582, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'CHU de Treichville', cat: 'CHU' },
  'centre hospitalier universitaire de yopougon': { lat: 5.358419, lon: -4.089692, commune: 'Yopougon', quartier: 'Quartier Hôpital', titre: 'CHU de Yopougon', cat: 'CHU' },
  'centre mavor': { lat: 5.339928, lon: -4.026184, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médico-Cardiologique Mavor (Plateau)', cat: 'Centre Médical' },
  'centre medical ane helene': { lat: 5.323180, lon: -4.017200, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Ané Hélène (Plateau)', cat: 'Centre Médical' },
  'centre medical bceao': { lat: 5.321627, lon: -4.015161, commune: 'Plateau', quartier: 'Plateau', titre: 'Cabinet Médical BCEAO (Plateau)', cat: 'Centre Médical' },
  'centre medical caritas arras': { lat: 5.300618, lon: -4.005288, commune: 'Treichville', quartier: 'Arras', titre: 'Centre Médical Caritas Côte d\'Ivoire', cat: 'Centre Médical' },
  'centre medical croix du secours citelecom': { lat: 5.331282, lon: -4.092996, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical CITELECOM (Yopougon)', cat: 'Centre Médical' },
  'centre medical de cardiologie edlona': { lat: 5.393780, lon: -3.987800, commune: 'Cocody', quartier: 'Angré', titre: 'Centre Médical de Cardiologie Edlona (Angré)', cat: 'Centre Médical' },
  'centre medical de la poste ci': { lat: 5.325722, lon: -4.017429, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical de la Poste-CI (Plateau)', cat: 'Centre Médical' },
  'centre medical de la republique': { lat: 5.317438, lon: -4.017967, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Centre Médical de la République', cat: 'Centre Médical' },
  'centre medical del pierro': { lat: 5.258563, lon: -3.959438, commune: 'Port-Bouët', quartier: 'Port-Bouët Centre', titre: 'Centre Médical Del-Pierro (Port-Bouët)', cat: 'Centre Médical' },
  'centre medical des douanes': { lat: 5.330956, lon: -4.008356, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical des Douanes (Plateau)', cat: 'Centre Médical' },
  'centre medical des enseignants': { lat: 5.339459, lon: -4.092969, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical des Enseignants (Yopougon)', cat: 'Centre Médical' },
  'centre medical des finances generales': { lat: 5.326944, lon: -4.020972, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Centre Médical des Finances Générales', cat: 'Centre Médical' },
  'centre medical des fonctionnaires': { lat: 5.324020, lon: -4.021930, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical des Fonctionnaires (Plateau)', cat: 'Centre Médical' },
  'centre medical du quartier latin': { lat: 5.358701, lon: -4.020002, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre Médical du Quartier Latin (Adjamé)', cat: 'Centre Médical' },
  'centre medical du tresor': { lat: 5.326041, lon: -4.018832, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical du Trésor (Plateau)', cat: 'Centre Médical' },
  'centre medical elnasr': { lat: 5.357067, lon: -4.046969, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'FSU d\'Attécoubé / Centre Médical ELNASR', cat: 'FSU COM' },
  'centre medical exauce': { lat: 5.323799, lon: -4.106269, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Médicale Exaucé (Yopougon)', cat: 'Clinique Privée' },
  'centre medical hoffmann': { lat: 5.394521, lon: -3.991020, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Centre Médical Hoffmann', cat: 'Centre Médical' },
  'centre medical hope ci': { lat: 5.300618, lon: -4.005288, commune: 'Treichville', quartier: 'Arras', titre: 'Centre Socio-Médical HOPE-CI (Treichville)', cat: 'Centre Médical' },
  'centre medical la misericorde': { lat: 5.288448, lon: -3.964515, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Centre Médical La Miséricorde (Koumassi Sicogi)', cat: 'Centre Médical' },
  'centre medical la misericorde koumassi sicogi gelti': { lat: 5.288448, lon: -3.964515, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Centre Médical La Miséricorde (Koumassi Sicogi)', cat: 'Centre Médical' },
  'centre medical les abes': { lat: 5.369369, lon: -3.963337, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Centre Médical Les Abes (Palmeraie)', cat: 'Centre Médical' },
  'centre medical longchamp': { lat: 5.326234, lon: -4.018393, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Longchamp (Plateau)', cat: 'Centre Médical' },
  'centre medical mere maria elisa andreoli': { lat: 5.364785, lon: -3.959053, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Centre Médical Mère Maria Elisa Andreoli', cat: 'Centre Médical' },
  'centre medical mere maria elisa andreoli soeurs': { lat: 5.364785, lon: -3.959053, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Centre Médical Mère Maria Elisa Andreoli', cat: 'Centre Médical' },
  'centre medical pabb du tresor': { lat: 5.326041, lon: -4.018832, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical du Trésor (Plateau)', cat: 'Centre Médical' },
  'centre medical paroisse saint etienne caritas': { lat: 5.292185, lon: -3.962653, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'Centre Médical Paroisse Saint Étienne (Koumassi)', cat: 'Centre Médical' },
  'centre medical patrice kouame': { lat: 5.328220, lon: -4.021388, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Patrice Kouamé', cat: 'Centre Médical' },
  'centre medical patrice kouame min fonction pub': { lat: 5.328220, lon: -4.021388, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Patrice Kouamé', cat: 'Centre Médical' },
  'centre medical police nationale': { lat: 5.336290, lon: -4.023090, commune: 'Plateau', quartier: 'Indénié', titre: 'Hôpital de la Police Nationale', cat: 'Hôpital Public' },
  'centre medical presidence de la republique': { lat: 5.323671, lon: -4.016944, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Présidence de la République', cat: 'Centre Médical' },
  'centre medical prima': { lat: 5.295488, lon: -3.984003, commune: 'Marcory', quartier: 'Zone 4', titre: 'Centre Médical Prima (Marcory Zone 4)', cat: 'Centre Médical' },
  'centre medical saint etienne': { lat: 5.292185, lon: -3.962653, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'Centre Médical Paroisse Saint Étienne (Koumassi)', cat: 'Centre Médical' },
  'centre medical saint laurent': { lat: 5.325199, lon: -4.069776, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical St Laurent (Yopougon)', cat: 'Centre Médical' },
  'centre medical sauveur misericordieux': { lat: 5.347749, lon: -4.058179, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical Sauveur Miséricordieux', cat: 'Centre Médical' },
  'centre medical social la victoire': { lat: 5.361526, lon: -4.069458, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'CMS La Victoire (Yopougon Charly)', cat: 'Centre Médical' },
  'centre medical st laurent': { lat: 5.325199, lon: -4.069776, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical St Laurent (Yopougon)', cat: 'Centre Médical' },
  'centre medico cardiologique mavor': { lat: 5.339928, lon: -4.026184, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médico-Cardiologique Mavor (Plateau)', cat: 'Centre Médical' },
  'centre medico social el rapha': { lat: 5.404260, lon: -4.019850, commune: 'Abobo', quartier: 'Anador', titre: 'Centre Médico-Social El Rapha (Abobo Anador)', cat: 'Centre Médical' },
  'centre medico social nazareen': { lat: 5.340056, lon: -4.080513, commune: 'Yopougon', quartier: 'Siporex', titre: 'CMS Nazaréen (Yopougon Siporex)', cat: 'Centre Médical' },
  'centre national d oncologie et de radiotherapie': { lat: 5.344200, lon: -3.992800, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CNRAO (Centre Radiothérapie Alassane Ouattara)', cat: 'Institut Spécialisé' },
  'centre national de prevention et de traitement de l insuffisance renale': { lat: 5.341970, lon: -3.994485, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CNPTIR (Centre Insuffisance Rénale Cocody)', cat: 'Institut Spécialisé' },
  'centre national de transfusion sanguine': { lat: 5.291530, lon: -4.004015, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Centre National de Transfusion Sanguine (CNTS)', cat: 'Institut Spécialisé' },
  'centre pmi treichville': { lat: 5.305000, lon: -4.008000, commune: 'Treichville', quartier: 'Avenue 8', titre: 'PMI de Treichville', cat: 'Maternité / PMI' },
  'centre psychiatrique bingerville': { lat: 5.356200, lon: -3.892100, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Psychiatrique de Bingerville', cat: 'Hôpital Spécialisé' },
  'chr abobo': { lat: 5.443152, lon: -4.007874, commune: 'Abobo', quartier: 'Abobo Nord', titre: 'CHR d\'Abobo (Hôpital Houphouët-Boigny)', cat: 'CHR' },
  'chr abobo nord': { lat: 5.443152, lon: -4.007874, commune: 'Abobo', quartier: 'Abobo Nord', titre: 'CHR d\'Abobo (Hôpital Houphouët-Boigny)', cat: 'CHR' },
  'chr d abobo': { lat: 5.443152, lon: -4.007874, commune: 'Abobo', quartier: 'Abobo Nord', titre: 'CHR d\'Abobo (Hôpital Houphouët-Boigny)', cat: 'CHR' },
  'chu angre': { lat: 5.401021, lon: -3.957441, commune: 'Cocody', quartier: 'Angré Djibi', titre: 'CHU d\'Angré', cat: 'CHU' },
  'chu cocody': { lat: 5.343512, lon: -3.993045, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CHU de Cocody', cat: 'CHU' },
  'chu d angre': { lat: 5.401021, lon: -3.957441, commune: 'Cocody', quartier: 'Angré Djibi', titre: 'CHU d\'Angré', cat: 'CHU' },
  'chu de cocody': { lat: 5.343512, lon: -3.993045, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CHU de Cocody', cat: 'CHU' },
  'chu de treichville': { lat: 5.291248, lon: -4.003582, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'CHU de Treichville', cat: 'CHU' },
  'chu de yopougon': { lat: 5.358419, lon: -4.089692, commune: 'Yopougon', quartier: 'Quartier Hôpital', titre: 'CHU de Yopougon', cat: 'CHU' },
  'chu treichville': { lat: 5.291248, lon: -4.003582, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'CHU de Treichville', cat: 'CHU' },
  'chu yopougon': { lat: 5.358419, lon: -4.089692, commune: 'Yopougon', quartier: 'Quartier Hôpital', titre: 'CHU de Yopougon', cat: 'CHU' },
  'cimedic': { lat: 5.295430, lon: -3.988690, commune: 'Marcory', quartier: 'Zone 4', titre: 'Cimedic (Marcory Zone 4)', cat: 'Clinique Privée' },
  'cimedic zone 4': { lat: 5.295430, lon: -3.988690, commune: 'Marcory', quartier: 'Zone 4', titre: 'Cimedic (Marcory Zone 4)', cat: 'Clinique Privée' },
  'citelecom medical': { lat: 5.331282, lon: -4.092996, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical CITELECOM (Yopougon)', cat: 'Centre Médical' },
  'clinique agefosyn': { lat: 5.324550, lon: -4.090250, commune: 'Yopougon', quartier: 'Niangon', titre: 'AGEFOSYN (Niangon Cité Verte)', cat: 'Clinique Privée' },
  'clinique avicennes': { lat: 5.316221, lon: -3.996662, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Avicennes (Marcory)', cat: 'Polyclinique' },
  'clinique bellevue': { lat: 5.355208, lon: -3.960366, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Clinique Bellevue (Cocody)', cat: 'Clinique Privée' },
  'clinique chrysalide': { lat: 5.331746, lon: -4.055406, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'Clinique Médicale La Chrysalide (Toits Rouges)', cat: 'Clinique Privée' },
  'clinique cimedic': { lat: 5.295430, lon: -3.988690, commune: 'Marcory', quartier: 'Zone 4', titre: 'Cimedic (Marcory Zone 4)', cat: 'Clinique Privée' },
  'clinique coeur sacre': { lat: 5.378780, lon: -3.988470, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Clinique Medicale Coeur Sacre', cat: 'Clinique Privee' },
  'clinique danga': { lat: 5.340141, lon: -4.008922, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique Médicale Danga', cat: 'Clinique Privée' },
  'clinique de l indenie': { lat: 5.338381, lon: -4.019072, commune: 'Plateau', quartier: 'Indénié', titre: 'Polyclinique Internationale de l\'Indénié (Plateau)', cat: 'Polyclinique' },
  'clinique faculte de paris marine nationale': { lat: 5.315492, lon: -4.034112, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Marine Nationale (Yopougon)', cat: 'Clinique Privée' },
  'clinique farah': { lat: 5.310672, lon: -3.986451, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Farah (Marcory)', cat: 'Polyclinique' },
  'clinique gospa': { lat: 5.342900, lon: -4.004610, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Clinique Gospa', cat: 'Clinique Privée' },
  'clinique grand centre yopougon': { lat: 5.336990, lon: -4.087630, commune: 'Yopougon', quartier: 'Niangon', titre: 'Clinique Médicale Le Grand Centre (Yopougon)', cat: 'Clinique Privée' },
  'clinique koumassi grand marche': { lat: 5.288285, lon: -3.968856, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'Clinique Médicale de Koumassi', cat: 'Clinique Privée' },
  'clinique la providence': { lat: 5.347312, lon: -4.009571, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique La Providence', cat: 'Clinique Privée' },
  'clinique la rosette': { lat: 5.301870, lon: -4.003280, commune: 'Treichville', quartier: 'Arras', titre: 'Clinique La Rosette (Treichville)', cat: 'Clinique Privée' },
  'clinique les myriades': { lat: 5.310740, lon: -3.990990, commune: 'Marcory', quartier: 'Zone 4', titre: 'Clinique Les Myriades (Marcory Zone 4)', cat: 'Polyclinique' },
  'clinique liberte': { lat: 5.350574, lon: -4.017188, commune: 'Adjamé', quartier: 'Adjamé Liberté', titre: 'Clinique Médicale Adjamé Liberté', cat: 'Clinique Privée' },
  'clinique medicale adjame liberte': { lat: 5.350574, lon: -4.017188, commune: 'Adjamé', quartier: 'Adjamé Liberté', titre: 'Clinique Médicale Adjamé Liberté', cat: 'Clinique Privée' },
  'clinique medicale andre dupuy': { lat: 5.332116, lon: -4.073825, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Médicale André Dupuy', cat: 'Clinique Privée' },
  'clinique medicale coeur sacre': { lat: 5.378780, lon: -3.988470, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Clinique Medicale Coeur Sacre', cat: 'Clinique Privee' },
  'clinique medicale danga': { lat: 5.340141, lon: -4.008922, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique Médicale Danga', cat: 'Clinique Privée' },
  'clinique medicale de koumassi': { lat: 5.288285, lon: -3.968856, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'Clinique Médicale de Koumassi', cat: 'Clinique Privée' },
  'clinique medicale exauce': { lat: 5.323799, lon: -4.106269, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Médicale Exaucé (Yopougon)', cat: 'Clinique Privée' },
  'clinique medicale la chrysalide': { lat: 5.331746, lon: -4.055406, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'Clinique Médicale La Chrysalide (Toits Rouges)', cat: 'Clinique Privée' },
  'clinique medicale le grand centre': { lat: 5.336990, lon: -4.087630, commune: 'Yopougon', quartier: 'Niangon', titre: 'Clinique Médicale Le Grand Centre (Yopougon)', cat: 'Clinique Privée' },
  'clinique medicale les oliviers': { lat: 5.333100, lon: -4.062070, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'Clinique Médicale Les Oliviers (Toits Rouges)', cat: 'Clinique Privée' },
  'clinique medicale mutrep ci': { lat: 5.396780, lon: -3.991240, commune: 'Cocody', quartier: 'Angré', titre: 'Clinique Médicale Mutrepci', cat: 'Clinique Privée' },
  'clinique medicale mutrepci': { lat: 5.396780, lon: -3.991240, commune: 'Cocody', quartier: 'Angré', titre: 'Clinique Médicale Mutrepci', cat: 'Clinique Privée' },
  'clinique medicale notre dame du puy': { lat: 5.344873, lon: -4.107109, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Médicale Notre Dame Du Puy', cat: 'Clinique Privée' },
  'clinique medicale oasis sante': { lat: 5.347750, lon: -4.073080, commune: 'Yopougon', quartier: 'Kenya', titre: 'Clinique Médicale Oasis Santé (Yopougon)', cat: 'Clinique Privée' },
  'clinique medicale saint mathieu': { lat: 5.331030, lon: -4.110560, commune: 'Yopougon', quartier: 'Niangon', titre: 'Clinique Médicale Saint Mathieu (Niangon)', cat: 'Clinique Privée' },
  'clinique medicale sainte philomene': { lat: 5.356970, lon: -3.979540, commune: 'Cocody', quartier: 'Riviera Bonoumin', titre: 'Clinique Médicale Sainte-Philomène', cat: 'Clinique Privée' },
  'clinique medicale sainte rita de cascia': { lat: 5.340860, lon: -4.087600, commune: 'Yopougon', quartier: 'Attié', titre: 'Clinique Médicale Sainte Rita de Cascia', cat: 'Clinique Privée' },
  'clinique medicale sainte trinite de la vie': { lat: 5.397699, lon: -3.992401, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Clinique Médicale Sainte Trinité de la Vie', cat: 'Clinique Privée' },
  'clinique medicale sanitas pma': { lat: 5.301540, lon: -4.003280, commune: 'Treichville', quartier: 'Arras', titre: 'Clinique Médicale Sanitas (Treichville)', cat: 'Clinique Privée' },
  'clinique medicale specialisee': { lat: 5.363230, lon: -4.000970, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Clinique Médicale Spécialisée (Deux Plateaux)', cat: 'Clinique Privée' },
  'clinique medicale trade center': { lat: 5.318560, lon: -4.015810, commune: 'Plateau', quartier: 'Plateau', titre: 'Clinique Médicale Trade Center (Plateau)', cat: 'Clinique Privée' },
  'clinique moderne la prevoyance': { lat: 5.362720, lon: -4.067798, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Moderne la Prévoyance (Yopougon)', cat: 'Clinique Privée' },
  'clinique notre dame de l incarnation': { lat: 5.364400, lon: -3.959090, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Clinique Notre Dame de l\'Incarnation', cat: 'Clinique Privée' },
  'clinique pediatrique de cocody': { lat: 5.366000, lon: -3.998000, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Clinique Pédiatrique de Cocody', cat: 'Clinique Privée' },
  'clinique pediatrique deux plateaux': { lat: 5.366000, lon: -3.998000, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Clinique Pédiatrique de Cocody', cat: 'Clinique Privée' },
  'clinique pisam': { lat: 5.336904, lon: -4.013442, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Polyclinique Internationale Sainte Anne-Marie (PISAM)', cat: 'Polyclinique' },
  'clinique providence': { lat: 5.347312, lon: -4.009571, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique La Providence', cat: 'Clinique Privée' },
  'clinique rosette': { lat: 5.301870, lon: -4.003280, commune: 'Treichville', quartier: 'Arras', titre: 'Clinique La Rosette (Treichville)', cat: 'Clinique Privée' },
  'clinique sacre coeur': { lat: 5.364631, lon: -3.979812, commune: 'Cocody', quartier: 'Riviera Attoban', titre: 'Polyclinique Sacre-Coeur (Riviera Attoban)', cat: 'Polyclinique' },
  'clinique saint sauveur ananeraie': { lat: 5.349770, lon: -4.100230, commune: 'Yopougon', quartier: 'Ananeraie', titre: 'Nouvelle Clinique Saint-Sauveur (Yopougon)', cat: 'Clinique Privée' },
  'clinique sainte anne marie': { lat: 5.336904, lon: -4.013442, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Polyclinique Internationale Sainte Anne-Marie (PISAM)', cat: 'Polyclinique' },
  'clinique sainte famille': { lat: 5.331343, lon: -4.076174, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Sainte Famille (Yopougon)', cat: 'Clinique Privée' },
  'clinique sainte henriette': { lat: 5.399240, lon: -3.973820, commune: 'Cocody', quartier: 'Angré', titre: 'Clinique Sainte Henriette', cat: 'Clinique Privée' },
  'clinique sainte rita yopougon': { lat: 5.340860, lon: -4.087600, commune: 'Yopougon', quartier: 'Attié', titre: 'Clinique Médicale Sainte Rita de Cascia', cat: 'Clinique Privée' },
  'clinique sainte therese marcory': { lat: 5.304021, lon: -3.984032, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Polyclinique Sainte-Thérèse (Marcory)', cat: 'Polyclinique' },
  'clinique sanitas': { lat: 5.301540, lon: -4.003280, commune: 'Treichville', quartier: 'Arras', titre: 'Clinique Médicale Sanitas (Treichville)', cat: 'Clinique Privée' },
  'clinique specialisee rue des jardins': { lat: 5.363230, lon: -4.000970, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Clinique Médicale Spécialisée (Deux Plateaux)', cat: 'Clinique Privée' },
  'clinique trade center': { lat: 5.318560, lon: -4.015810, commune: 'Plateau', quartier: 'Plateau', titre: 'Clinique Médicale Trade Center (Plateau)', cat: 'Clinique Privée' },
  'clinique xmed': { lat: 5.361285, lon: -3.894236, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Centre d\'Excellence Médicale Xmed (Bingerville)', cat: 'Centre Médical' },
  'cmed': { lat: 5.342491, lon: -4.080389, commune: 'Yopougon', quartier: 'Siporex', titre: 'CMED Yopougon Siporex', cat: 'Centre Médical' },
  'cmed yopougon': { lat: 5.342491, lon: -4.080389, commune: 'Yopougon', quartier: 'Siporex', titre: 'CMED Yopougon Siporex', cat: 'Centre Médical' },
  'cms el rapha': { lat: 5.404260, lon: -4.019850, commune: 'Abobo', quartier: 'Anador', titre: 'Centre Médico-Social El Rapha (Abobo Anador)', cat: 'Centre Médical' },
  'cms la victoire': { lat: 5.361526, lon: -4.069458, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'CMS La Victoire (Yopougon Charly)', cat: 'Centre Médical' },
  'cms nazareen': { lat: 5.340056, lon: -4.080513, commune: 'Yopougon', quartier: 'Siporex', titre: 'CMS Nazaréen (Yopougon Siporex)', cat: 'Centre Médical' },
  'cnmci abobo': { lat: 5.422323, lon: -4.016575, commune: 'Abobo', quartier: 'Abobo Gare', titre: 'CNMCI Abobo (Centre National Médical)', cat: 'Centre Médical' },
  'cnmci abobo gare': { lat: 5.422323, lon: -4.016575, commune: 'Abobo', quartier: 'Abobo Gare', titre: 'CNMCI Abobo (Centre National Médical)', cat: 'Centre Médical' },
  'cnptir': { lat: 5.341970, lon: -3.994485, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CNPTIR (Centre Insuffisance Rénale Cocody)', cat: 'Institut Spécialisé' },
  'cnrao': { lat: 5.344200, lon: -3.992800, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CNRAO (Centre Radiothérapie Alassane Ouattara)', cat: 'Institut Spécialisé' },
  'cnts': { lat: 5.291530, lon: -4.004015, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Centre National de Transfusion Sanguine (CNTS)', cat: 'Institut Spécialisé' },
  'cnts treichville': { lat: 5.291530, lon: -4.004015, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Centre National de Transfusion Sanguine (CNTS)', cat: 'Institut Spécialisé' },
  'coeur sacre 2 plateaux': { lat: 5.378780, lon: -3.988470, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Clinique Medicale Coeur Sacre', cat: 'Clinique Privee' },
  'complexe sanitaire blockhauss': { lat: 5.324470, lon: -4.001380, commune: 'Cocody', quartier: 'Blockhauss', titre: 'Complexe Sanitaire de Blockhauss (Cocody)', cat: 'CSU / Dispensaire' },
  'complexe sanitaire henriette konan bedie de blockhauss': { lat: 5.324470, lon: -4.001380, commune: 'Cocody', quartier: 'Blockhauss', titre: 'Complexe Sanitaire de Blockhauss (Cocody)', cat: 'CSU / Dispensaire' },
  'consultation abobo mairie': { lat: 5.443028, lon: -4.008025, commune: 'Abobo', quartier: 'Abobo Nord', titre: 'Centre de Consultation Médicale d\'Abobo', cat: 'Centre Médical' },
  'cpn attecoube': { lat: 5.349742, lon: -4.033022, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'PMI d\'Attécoubé (CPN)', cat: 'Maternité / PMI' },
  'croix du secours citelecom': { lat: 5.331282, lon: -4.092996, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical CITELECOM (Yopougon)', cat: 'Centre Médical' },
  'csa gmmg': { lat: 5.337821, lon: -4.024030, commune: 'Plateau', quartier: 'Plateau', titre: 'CSA-GMMG (Plateau)', cat: 'Centre Médical' },
  'csu abobo te': { lat: 5.405770, lon: -4.001070, commune: 'Abobo', quartier: 'Abobo-Té', titre: 'Centre de Santé d\'Abobo-Té', cat: 'CSU / Dispensaire' },
  'csu adjame bingerville': { lat: 5.351016, lon: -3.874594, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'CSU Adjamé-Bingerville', cat: 'CSU / Dispensaire' },
  'csu akouedo': { lat: 5.360216, lon: -3.967437, commune: 'Cocody', quartier: 'Akouédo', titre: 'CSU Communautaire d\'Akouédo (Cocody)', cat: 'CSU / Dispensaire' },
  'csu aliodan': { lat: 5.298000, lon: -3.987000, commune: 'Marcory', quartier: 'Aliodan', titre: 'CSU d\'Aliodan (Marcory)', cat: 'CSU / Dispensaire' },
  'csu angre': { lat: 5.405200, lon: -3.984630, commune: 'Cocody', quartier: 'Angré', titre: 'CSU d\'Angré (Cocody)', cat: 'CSU / Dispensaire' },
  'csu anono': { lat: 5.345840, lon: -3.973720, commune: 'Cocody', quartier: 'Anono', titre: 'CSU Communautaire d\'Anono (Cocody)', cat: 'CSU / Dispensaire' },
  'csu anyama adjame': { lat: 5.492000, lon: -4.053000, commune: 'Anyama', quartier: 'Anyama Centre', titre: 'CSU d\'Anyama Adjamé', cat: 'CSU / Dispensaire' },
  'csu arras 3': { lat: 5.302080, lon: -3.999650, commune: 'Treichville', quartier: 'Arras', titre: 'CSU Communautaire Arras 3 (Treichville)', cat: 'CSU / Dispensaire' },
  'csu boribana': { lat: 5.338500, lon: -4.042000, commune: 'Attécoubé', quartier: 'Boribana', titre: 'CSU de Boribana (Attécoubé)', cat: 'CSU / Dispensaire' },
  'csu com aklomiabla': { lat: 5.314414, lon: -3.942635, commune: 'Koumassi', quartier: 'Aklomiabla', titre: 'CSU-COM Aklomiabla (Koumassi)', cat: 'FSU COM' },
  'csu com aklomiabla s': { lat: 5.314414, lon: -3.942635, commune: 'Koumassi', quartier: 'Aklomiabla', titre: 'CSU-COM Aklomiabla (Koumassi)', cat: 'FSU COM' },
  'csu com palmeraie': { lat: 5.363386, lon: -3.962535, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'CSU COM Palmeraie (Cocody)', cat: 'CSU / Dispensaire' },
  'csu com pangolin': { lat: 5.300247, lon: -3.946385, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'FSU COM Koumassi (Pangolin)', cat: 'FSU COM' },
  'csu communautaire d abobo baoule': { lat: 5.430561, lon: -3.995497, commune: 'Abobo', quartier: 'Abobo Baoulé', titre: 'FSU COM Abobo Baoulé (Abobo)', cat: 'FSU COM' },
  'csu communautaire d abobo baule': { lat: 5.430561, lon: -3.995497, commune: 'Abobo', quartier: 'Abobo Baoulé', titre: 'FSU COM Abobo Baoulé (Abobo)', cat: 'FSU COM' },
  'csu communautaire d akouedo': { lat: 5.360216, lon: -3.967437, commune: 'Cocody', quartier: 'Akouédo', titre: 'CSU Communautaire d\'Akouédo (Cocody)', cat: 'CSU / Dispensaire' },
  'csu communautaire d angre': { lat: 5.405200, lon: -3.984630, commune: 'Cocody', quartier: 'Angré', titre: 'CSU d\'Angré (Cocody)', cat: 'CSU / Dispensaire' },
  'csu communautaire d anono': { lat: 5.345840, lon: -3.973720, commune: 'Cocody', quartier: 'Anono', titre: 'CSU Communautaire d\'Anono (Cocody)', cat: 'CSU / Dispensaire' },
  'csu d angre': { lat: 5.405200, lon: -3.984630, commune: 'Cocody', quartier: 'Angré', titre: 'CSU d\'Angré (Cocody)', cat: 'CSU / Dispensaire' },
  'csu gbagba': { lat: 5.349640, lon: -3.887730, commune: 'Bingerville', quartier: 'Gbagba', titre: 'CSU de Gbagba (Bingerville)', cat: 'CSU / Dispensaire' },
  'csu gonzagueville': { lat: 5.246200, lon: -3.882100, commune: 'Port-Bouët', quartier: 'Gonzagueville', titre: 'FSU COM Gonzagueville (Port-Bouët)', cat: 'FSU COM' },
  'csu palmeraie': { lat: 5.363386, lon: -3.962535, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'CSU COM Palmeraie (Cocody)', cat: 'CSU / Dispensaire' },
  'csu port bouet centre': { lat: 5.255400, lon: -3.930200, commune: 'Port-Bouët', quartier: 'Port-Bouët Centre', titre: 'CSU Port-Bouët Centre', cat: 'CSU / Dispensaire' },
  'csu songon agban': { lat: 5.312000, lon: -4.255000, commune: 'Songon', quartier: 'Songon Agban', titre: 'CSU de Songon Agban', cat: 'CSU / Dispensaire' },
  'csu songon mbratte': { lat: 5.330000, lon: -4.230000, commune: 'Songon', quartier: 'Songon M\'Bratté', titre: 'CSU de Songon M\'Bratté', cat: 'CSU / Dispensaire' },
  'csu yopougon sante': { lat: 5.310381, lon: -4.044301, commune: 'Yopougon', quartier: 'Santé', titre: 'CSU Yopougon Santé', cat: 'CSU / Dispensaire' },
  'csucom anonkoua koute': { lat: 5.435020, lon: -4.046782, commune: 'Abobo', quartier: 'Anonkoua Kouté', titre: 'FSU COM Anonkoua Kouté (Abobo)', cat: 'FSU COM' },
  'danga cocody': { lat: 5.340141, lon: -4.008922, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique Médicale Danga', cat: 'Clinique Privée' },
  'del pierro port bouet': { lat: 5.258563, lon: -3.959438, commune: 'Port-Bouët', quartier: 'Port-Bouët Centre', titre: 'Centre Médical Del-Pierro (Port-Bouët)', cat: 'Centre Médical' },
  'dispensaire abobo te': { lat: 5.405770, lon: -4.001070, commune: 'Abobo', quartier: 'Abobo-Té', titre: 'Centre de Santé d\'Abobo-Té', cat: 'CSU / Dispensaire' },
  'dispensaire aliodan': { lat: 5.298000, lon: -3.987000, commune: 'Marcory', quartier: 'Aliodan', titre: 'CSU d\'Aliodan (Marcory)', cat: 'CSU / Dispensaire' },
  'dispensaire boribana': { lat: 5.338500, lon: -4.042000, commune: 'Attécoubé', quartier: 'Boribana', titre: 'CSU de Boribana (Attécoubé)', cat: 'CSU / Dispensaire' },
  'dispensaire cocody': { lat: 5.338732, lon: -4.004638, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'FSU Cocody (Dispensaire Urbain)', cat: 'FSU COM' },
  'dispensaire inchallah adjame': { lat: 5.365073, lon: -4.023572, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre de Soins Inchallah (Adjamé)', cat: 'CSU / Dispensaire' },
  'dispensaire municipal mairie de treichville district d abidjan': { lat: 5.310129, lon: -4.013051, commune: 'Treichville', quartier: 'Arras', titre: 'Dispensaire Municipal de Treichville', cat: 'CSU / Dispensaire' },
  'dispensaire municipal treichville': { lat: 5.310129, lon: -4.013051, commune: 'Treichville', quartier: 'Arras', titre: 'Dispensaire Municipal de Treichville', cat: 'CSU / Dispensaire' },
  'dispensaire port bouet centre': { lat: 5.255400, lon: -3.930200, commune: 'Port-Bouët', quartier: 'Port-Bouët Centre', titre: 'CSU Port-Bouët Centre', cat: 'CSU / Dispensaire' },
  'dispensaire treichville': { lat: 5.310129, lon: -4.013051, commune: 'Treichville', quartier: 'Arras', titre: 'Dispensaire Municipal de Treichville', cat: 'CSU / Dispensaire' },
  'dispensaire urbain de cocody': { lat: 5.338732, lon: -4.004638, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'FSU Cocody (Dispensaire Urbain)', cat: 'FSU COM' },
  'dispensaire yopougon sante': { lat: 5.310381, lon: -4.044301, commune: 'Yopougon', quartier: 'Santé', titre: 'CSU Yopougon Santé', cat: 'CSU / Dispensaire' },
  'douanes medical plateau': { lat: 5.330956, lon: -4.008356, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical des Douanes (Plateau)', cat: 'Centre Médical' },
  'edlona angre': { lat: 5.393780, lon: -3.987800, commune: 'Cocody', quartier: 'Angré', titre: 'Centre Médical de Cardiologie Edlona (Angré)', cat: 'Centre Médical' },
  'el rapha anador': { lat: 5.404260, lon: -4.019850, commune: 'Abobo', quartier: 'Anador', titre: 'Centre Médico-Social El Rapha (Abobo Anador)', cat: 'Centre Médical' },
  'elisa andreoli palmeraie': { lat: 5.364785, lon: -3.959053, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Centre Médical Mère Maria Elisa Andreoli', cat: 'Centre Médical' },
  'enseignants medical yopougon': { lat: 5.339459, lon: -4.092969, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical des Enseignants (Yopougon)', cat: 'Centre Médical' },
  'espace medical saint paul': { lat: 5.326060, lon: -4.021640, commune: 'Plateau', quartier: 'Plateau', titre: 'Espace Médical Saint-Paul (Plateau)', cat: 'Centre Médical' },
  'exauce nouveau bureau': { lat: 5.323799, lon: -4.106269, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Médicale Exaucé (Yopougon)', cat: 'Clinique Privée' },
  'f s u 220 logements': { lat: 5.347864, lon: -4.016677, commune: 'Adjamé', quartier: '220 Lglts', titre: 'FSU des 220 Logements (Adjamé)', cat: 'FSU COM' },
  'farah marcory': { lat: 5.310672, lon: -3.986451, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Farah (Marcory)', cat: 'Polyclinique' },
  'finances generales medical': { lat: 5.326944, lon: -4.020972, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Centre Médical des Finances Générales', cat: 'Centre Médical' },
  'formation sanitaire 220 logements': { lat: 5.347864, lon: -4.016677, commune: 'Adjamé', quartier: '220 Lglts', titre: 'FSU des 220 Logements (Adjamé)', cat: 'FSU COM' },
  'formation sanitaire andokoi': { lat: 5.362701, lon: -4.068892, commune: 'Yopougon', quartier: 'Andokoi', titre: 'FSU COM Andokoi (Yopougon)', cat: 'FSU COM' },
  'formation sanitaire azito': { lat: 5.304133, lon: -4.083109, commune: 'Yopougon', quartier: 'Azito', titre: 'FSU COM Azito (Yopougon)', cat: 'FSU COM' },
  'formation sanitaire port bouet 2': { lat: 5.347124, lon: -4.093089, commune: 'Yopougon', quartier: 'Port-Bouët 2', titre: 'FSU COM Port-Bouët 2 (Yopougon)', cat: 'FSU COM' },
  'formation sanitaire urbaine': { lat: 5.328040, lon: -4.026680, commune: 'Plateau', quartier: 'Plateau', titre: 'FSU du Plateau', cat: 'FSU COM' },
  'formation sanitaire urbaine communautaire de toits rouges': { lat: 5.331500, lon: -4.056160, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'FSU COM de Toits Rouges (Yopougon)', cat: 'FSU COM' },
  'formation sanitaire urbaine communautaire de wassakara': { lat: 5.353300, lon: -4.067760, commune: 'Yopougon', quartier: 'Wassakara', titre: 'FSU COM de Wassakara (Yopougon)', cat: 'FSU COM' },
  'formation sanitaire urbaine d abobodoume locodjoro': { lat: 5.323500, lon: -4.045600, commune: 'Yopougon', quartier: 'Locodjro', titre: 'FSU d\'Abobodoumé / Locodjro (Yopougon)', cat: 'FSU COM' },
  'formation sanitaire urbaine d attecoube centre medical elnasr': { lat: 5.357067, lon: -4.046969, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'FSU d\'Attécoubé / Centre Médical ELNASR', cat: 'FSU COM' },
  'formation sanitaire urbaine du plateau': { lat: 5.328040, lon: -4.026680, commune: 'Plateau', quartier: 'Plateau', titre: 'FSU du Plateau', cat: 'FSU COM' },
  'formation sanitaire williamsville': { lat: 5.373256, lon: -4.024692, commune: 'Adjamé', quartier: 'Williamsville', titre: 'FSU COM Williamsville (Adjamé)', cat: 'FSU COM' },
  'fsu 220 logements': { lat: 5.347864, lon: -4.016677, commune: 'Adjamé', quartier: '220 Lglts', titre: 'FSU des 220 Logements (Adjamé)', cat: 'FSU COM' },
  'fsu abobo baoule': { lat: 5.430561, lon: -3.995497, commune: 'Abobo', quartier: 'Abobo Baoulé', titre: 'FSU COM Abobo Baoulé (Abobo)', cat: 'FSU COM' },
  'fsu abobodoume': { lat: 5.323500, lon: -4.045600, commune: 'Yopougon', quartier: 'Locodjro', titre: 'FSU d\'Abobodoumé / Locodjro (Yopougon)', cat: 'FSU COM' },
  'fsu aklomiabla': { lat: 5.314414, lon: -3.942635, commune: 'Koumassi', quartier: 'Aklomiabla', titre: 'CSU-COM Aklomiabla (Koumassi)', cat: 'FSU COM' },
  'fsu andokoi': { lat: 5.362701, lon: -4.068892, commune: 'Yopougon', quartier: 'Andokoi', titre: 'FSU COM Andokoi (Yopougon)', cat: 'FSU COM' },
  'fsu anonkoua koute': { lat: 5.435020, lon: -4.046782, commune: 'Abobo', quartier: 'Anonkoua Kouté', titre: 'FSU COM Anonkoua Kouté (Abobo)', cat: 'FSU COM' },
  'fsu anoumabo': { lat: 5.304100, lon: -3.978200, commune: 'Marcory', quartier: 'Anoumabo', titre: 'FSU COM Anoumabo (Marcory)', cat: 'FSU COM' },
  'fsu anyama zossonkoi': { lat: 5.495000, lon: -4.051000, commune: 'Anyama', quartier: 'Zossonkoi', titre: 'FSU COM Anyama Zossonkoi', cat: 'FSU COM' },
  'fsu attecoube': { lat: 5.357067, lon: -4.046969, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'FSU d\'Attécoubé / Centre Médical ELNASR', cat: 'FSU COM' },
  'fsu azito': { lat: 5.304133, lon: -4.083109, commune: 'Yopougon', quartier: 'Azito', titre: 'FSU COM Azito (Yopougon)', cat: 'FSU COM' },
  'fsu clouetcha': { lat: 5.424500, lon: -4.018000, commune: 'Abobo', quartier: 'Sagbé', titre: 'FSU COM Sagbé (Abobo)', cat: 'FSU COM' },
  'fsu cocody': { lat: 5.338732, lon: -4.004638, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'FSU Cocody (Dispensaire Urbain)', cat: 'FSU COM' },
  'fsu cocody dispensaire': { lat: 5.338732, lon: -4.004638, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'FSU Cocody (Dispensaire Urbain)', cat: 'FSU COM' },
  'fsu cocody dispensaire urbain': { lat: 5.338732, lon: -4.004638, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'FSU Cocody (Dispensaire Urbain)', cat: 'FSU COM' },
  'fsu com 220 logements': { lat: 5.347864, lon: -4.016677, commune: 'Adjamé', quartier: '220 Lglts', titre: 'FSU des 220 Logements (Adjamé)', cat: 'FSU COM' },
  'fsu com abobo baoule': { lat: 5.430561, lon: -3.995497, commune: 'Abobo', quartier: 'Abobo Baoulé', titre: 'FSU COM Abobo Baoulé (Abobo)', cat: 'FSU COM' },
  'fsu com ak': { lat: 5.435020, lon: -4.046782, commune: 'Abobo', quartier: 'Anonkoua Kouté', titre: 'FSU COM Anonkoua Kouté (Abobo)', cat: 'FSU COM' },
  'fsu com andokoi': { lat: 5.362701, lon: -4.068892, commune: 'Yopougon', quartier: 'Andokoi', titre: 'FSU COM Andokoi (Yopougon)', cat: 'FSU COM' },
  'fsu com anoumabo': { lat: 5.304100, lon: -3.978200, commune: 'Marcory', quartier: 'Anoumabo', titre: 'FSU COM Anoumabo (Marcory)', cat: 'FSU COM' },
  'fsu com anyama': { lat: 5.495000, lon: -4.051000, commune: 'Anyama', quartier: 'Zossonkoi', titre: 'FSU COM Anyama Zossonkoi', cat: 'FSU COM' },
  'fsu com attecoube': { lat: 5.357067, lon: -4.046969, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'FSU d\'Attécoubé / Centre Médical ELNASR', cat: 'FSU COM' },
  'fsu com azito': { lat: 5.304133, lon: -4.083109, commune: 'Yopougon', quartier: 'Azito', titre: 'FSU COM Azito (Yopougon)', cat: 'FSU COM' },
  'fsu com gonzagueville': { lat: 5.246200, lon: -3.882100, commune: 'Port-Bouët', quartier: 'Gonzagueville', titre: 'FSU COM Gonzagueville (Port-Bouët)', cat: 'FSU COM' },
  'fsu com grand campement': { lat: 5.286200, lon: -3.934100, commune: 'Koumassi', quartier: 'Grand Campement', titre: 'FSU COM Grand Campement (Koumassi)', cat: 'FSU COM' },
  'fsu com koumassi': { lat: 5.300247, lon: -3.946385, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'FSU COM Koumassi (Pangolin)', cat: 'FSU COM' },
  'fsu com marcory anoumabo': { lat: 5.304100, lon: -3.978200, commune: 'Marcory', quartier: 'Anoumabo', titre: 'FSU COM Anoumabo (Marcory)', cat: 'FSU COM' },
  'fsu com niangon sud': { lat: 5.328000, lon: -4.105000, commune: 'Yopougon', quartier: 'Niangon', titre: 'FSU COM Niangon Sud (Yopougon)', cat: 'FSU COM' },
  'fsu com port bouet 2': { lat: 5.347124, lon: -4.093089, commune: 'Yopougon', quartier: 'Port-Bouët 2', titre: 'FSU COM Port-Bouët 2 (Yopougon)', cat: 'FSU COM' },
  'fsu com sagbe': { lat: 5.424500, lon: -4.018000, commune: 'Abobo', quartier: 'Sagbé', titre: 'FSU COM Sagbé (Abobo)', cat: 'FSU COM' },
  'fsu com toits rouges': { lat: 5.331500, lon: -4.056160, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'FSU COM de Toits Rouges (Yopougon)', cat: 'FSU COM' },
  'fsu com vridi cite': { lat: 5.258100, lon: -4.002400, commune: 'Port-Bouët', quartier: 'Vridi', titre: 'FSU COM Vridi Cité (Port-Bouët)', cat: 'FSU COM' },
  'fsu com wassakara': { lat: 5.353300, lon: -4.067760, commune: 'Yopougon', quartier: 'Wassakara', titre: 'FSU COM de Wassakara (Yopougon)', cat: 'FSU COM' },
  'fsu com williamsville': { lat: 5.373256, lon: -4.024692, commune: 'Adjamé', quartier: 'Williamsville', titre: 'FSU COM Williamsville (Adjamé)', cat: 'FSU COM' },
  'fsu gonzagueville': { lat: 5.246200, lon: -3.882100, commune: 'Port-Bouët', quartier: 'Gonzagueville', titre: 'FSU COM Gonzagueville (Port-Bouët)', cat: 'FSU COM' },
  'fsu grand campement': { lat: 5.286200, lon: -3.934100, commune: 'Koumassi', quartier: 'Grand Campement', titre: 'FSU COM Grand Campement (Koumassi)', cat: 'FSU COM' },
  'fsu koumassi pangolin': { lat: 5.300247, lon: -3.946385, commune: 'Koumassi', quartier: 'Koumassi Centre', titre: 'FSU COM Koumassi (Pangolin)', cat: 'FSU COM' },
  'fsu locodjro': { lat: 5.323500, lon: -4.045600, commune: 'Yopougon', quartier: 'Locodjro', titre: 'FSU d\'Abobodoumé / Locodjro (Yopougon)', cat: 'FSU COM' },
  'fsu niangon lokoa': { lat: 5.328000, lon: -4.105000, commune: 'Yopougon', quartier: 'Niangon', titre: 'FSU COM Niangon Sud (Yopougon)', cat: 'FSU COM' },
  'fsu niangon sud': { lat: 5.328000, lon: -4.105000, commune: 'Yopougon', quartier: 'Niangon', titre: 'FSU COM Niangon Sud (Yopougon)', cat: 'FSU COM' },
  'fsu plateau': { lat: 5.328040, lon: -4.026680, commune: 'Plateau', quartier: 'Plateau', titre: 'FSU du Plateau', cat: 'FSU COM' },
  'fsu port bouet 2': { lat: 5.347124, lon: -4.093089, commune: 'Yopougon', quartier: 'Port-Bouët 2', titre: 'FSU COM Port-Bouët 2 (Yopougon)', cat: 'FSU COM' },
  'fsu sagbe': { lat: 5.424500, lon: -4.018000, commune: 'Abobo', quartier: 'Sagbé', titre: 'FSU COM Sagbé (Abobo)', cat: 'FSU COM' },
  'fsu toits rouges': { lat: 5.331500, lon: -4.056160, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'FSU COM de Toits Rouges (Yopougon)', cat: 'FSU COM' },
  'fsu vridi': { lat: 5.258100, lon: -4.002400, commune: 'Port-Bouët', quartier: 'Vridi', titre: 'FSU COM Vridi Cité (Port-Bouët)', cat: 'FSU COM' },
  'fsu vridi cite': { lat: 5.258100, lon: -4.002400, commune: 'Port-Bouët', quartier: 'Vridi', titre: 'FSU COM Vridi Cité (Port-Bouët)', cat: 'FSU COM' },
  'fsu wassakara': { lat: 5.353300, lon: -4.067760, commune: 'Yopougon', quartier: 'Wassakara', titre: 'FSU COM de Wassakara (Yopougon)', cat: 'FSU COM' },
  'fsu williamsville': { lat: 5.373256, lon: -4.024692, commune: 'Adjamé', quartier: 'Williamsville', titre: 'FSU COM Williamsville (Adjamé)', cat: 'FSU COM' },
  'fsucom andokoi': { lat: 5.362701, lon: -4.068892, commune: 'Yopougon', quartier: 'Andokoi', titre: 'FSU COM Andokoi (Yopougon)', cat: 'FSU COM' },
  'fsucom anonkoua koute': { lat: 5.435020, lon: -4.046782, commune: 'Abobo', quartier: 'Anonkoua Kouté', titre: 'FSU COM Anonkoua Kouté (Abobo)', cat: 'FSU COM' },
  'fsucom azito': { lat: 5.304133, lon: -4.083109, commune: 'Yopougon', quartier: 'Azito', titre: 'FSU COM Azito (Yopougon)', cat: 'FSU COM' },
  'fsucom niangon sud': { lat: 5.328000, lon: -4.105000, commune: 'Yopougon', quartier: 'Niangon', titre: 'FSU COM Niangon Sud (Yopougon)', cat: 'FSU COM' },
  'fsucom port bouet 2': { lat: 5.347124, lon: -4.093089, commune: 'Yopougon', quartier: 'Port-Bouët 2', titre: 'FSU COM Port-Bouët 2 (Yopougon)', cat: 'FSU COM' },
  'fsucom toits rouges': { lat: 5.331500, lon: -4.056160, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'FSU COM de Toits Rouges (Yopougon)', cat: 'FSU COM' },
  'fsucom wassakara': { lat: 5.353300, lon: -4.067760, commune: 'Yopougon', quartier: 'Wassakara', titre: 'FSU COM de Wassakara (Yopougon)', cat: 'FSU COM' },
  'fsucom williamsville': { lat: 5.373256, lon: -4.024692, commune: 'Adjamé', quartier: 'Williamsville', titre: 'FSU COM Williamsville (Adjamé)', cat: 'FSU COM' },
  'gmp': { lat: 5.320703, lon: -4.014141, commune: 'Plateau', quartier: 'Plateau', titre: 'Polyclinique Groupe Médical du Plateau (GMP)', cat: 'Polyclinique' },
  'gmp plateau': { lat: 5.320703, lon: -4.014141, commune: 'Plateau', quartier: 'Plateau', titre: 'Polyclinique Groupe Médical du Plateau (GMP)', cat: 'Polyclinique' },
  'gospa cocody': { lat: 5.342900, lon: -4.004610, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Clinique Gospa', cat: 'Clinique Privée' },
  'groupe medical du plateau': { lat: 5.320703, lon: -4.014141, commune: 'Plateau', quartier: 'Plateau', titre: 'Polyclinique Groupe Médical du Plateau (GMP)', cat: 'Polyclinique' },
  'groupe medical zoe': { lat: 5.328830, lon: -3.950375, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Groupe Médical Zoé', cat: 'Centre Médical' },
  'groupe soins de vie': { lat: 5.348421, lon: -3.943141, commune: 'Cocody', quartier: 'M\'Badon', titre: 'Groupe Soins de Vie (M\'Badon)', cat: 'Centre Médical' },
  'groupe soins de vie riviera m badon': { lat: 5.348421, lon: -3.943141, commune: 'Cocody', quartier: 'M\'Badon', titre: 'Groupe Soins de Vie (M\'Badon)', cat: 'Centre Médical' },
  'hemodialyse adjame': { lat: 5.348801, lon: -4.024653, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre d\'Hémodialyse HLG Adjamé', cat: 'Centre Médical' },
  'hg abobo': { lat: 5.423721, lon: -4.016362, commune: 'Abobo', quartier: 'Sagbé', titre: 'Hôpital Général d\'Abobo (Sagbé)', cat: 'Hôpital Général' },
  'hg adjame': { lat: 5.348821, lon: -4.024671, commune: 'Adjamé', quartier: 'Williamsville', titre: 'Hôpital Général d\'Adjamé', cat: 'Hôpital Général' },
  'hg anyama': { lat: 5.501021, lon: -4.045752, commune: 'Anyama', quartier: 'Anyama Centre', titre: 'Hôpital Général d\'Anyama', cat: 'Hôpital Général' },
  'hg avocatier': { lat: 5.438752, lon: -4.024201, commune: 'Abobo', quartier: 'Avocatier', titre: 'Hôpital Henriette Bédié d\'Avocatier', cat: 'Hôpital Général' },
  'hg bingerville': { lat: 5.360062, lon: -3.885311, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Général de Bingerville', cat: 'Hôpital Général' },
  'hg koumassi': { lat: 5.287321, lon: -3.969532, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Hôpital Général de Koumassi', cat: 'Hôpital Général' },
  'hg marcory': { lat: 5.300681, lon: -3.983292, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Hôpital Général de Marcory', cat: 'Hôpital Général' },
  'hg port bouet': { lat: 5.262612, lon: -3.962174, commune: 'Port-Bouët', quartier: 'Petit Bassam', titre: 'Hôpital Général de Port-Bouët', cat: 'Hôpital Général' },
  'hg sagbe': { lat: 5.423721, lon: -4.016362, commune: 'Abobo', quartier: 'Sagbé', titre: 'Hôpital Général d\'Abobo (Sagbé)', cat: 'Hôpital Général' },
  'hg songon': { lat: 5.318200, lon: -4.245000, commune: 'Songon', quartier: 'Songon Kassemblé', titre: 'Hôpital Général de Songon', cat: 'Hôpital Général' },
  'hg treichville': { lat: 5.311102, lon: -4.007991, commune: 'Treichville', quartier: 'Nanan Yamousso', titre: 'Hôpital Général de Treichville', cat: 'Hôpital Général' },
  'hg yopougon attie': { lat: 5.341431, lon: -4.080032, commune: 'Yopougon', quartier: 'Attié', titre: 'Hôpital Général de Yopougon-Attié', cat: 'Hôpital Général' },
  'hlg adjame centre d hemodialyse': { lat: 5.348801, lon: -4.024653, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre d\'Hémodialyse HLG Adjamé', cat: 'Centre Médical' },
  'hma': { lat: 5.381682, lon: -4.007251, commune: 'Adjamé', quartier: 'Paillet', titre: 'Hôpital Militaire d\'Abidjan (HMA)', cat: 'Hôpital Militaire' },
  'hma paillet': { lat: 5.381682, lon: -4.007251, commune: 'Adjamé', quartier: 'Paillet', titre: 'Hôpital Militaire d\'Abidjan (HMA)', cat: 'Hôpital Militaire' },
  'hme bingerville': { lat: 5.361792, lon: -3.883904, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Mère-Enfant Dominique Ouattara (Bingerville)', cat: 'Hôpital Spécialisé' },
  'hme dominique ouattara': { lat: 5.361792, lon: -3.883904, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Mère-Enfant Dominique Ouattara (Bingerville)', cat: 'Hôpital Spécialisé' },
  'hoffmann cocody': { lat: 5.394521, lon: -3.991020, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Centre Médical Hoffmann', cat: 'Centre Médical' },
  'hope ci treichville': { lat: 5.300618, lon: -4.005288, commune: 'Treichville', quartier: 'Arras', titre: 'Centre Socio-Médical HOPE-CI (Treichville)', cat: 'Centre Médical' },
  'hopital adjame': { lat: 5.348821, lon: -4.024671, commune: 'Adjamé', quartier: 'Williamsville', titre: 'Hôpital Général d\'Adjamé', cat: 'Hôpital Général' },
  'hopital anyama': { lat: 5.501021, lon: -4.045752, commune: 'Anyama', quartier: 'Anyama Centre', titre: 'Hôpital Général d\'Anyama', cat: 'Hôpital Général' },
  'hopital attie': { lat: 5.341431, lon: -4.080032, commune: 'Yopougon', quartier: 'Attié', titre: 'Hôpital Général de Yopougon-Attié', cat: 'Hôpital Général' },
  'hopital avocatier': { lat: 5.438752, lon: -4.024201, commune: 'Abobo', quartier: 'Avocatier', titre: 'Hôpital Henriette Bédié d\'Avocatier', cat: 'Hôpital Général' },
  'hopital chu angre': { lat: 5.401021, lon: -3.957441, commune: 'Cocody', quartier: 'Angré Djibi', titre: 'CHU d\'Angré', cat: 'CHU' },
  'hopital chu cocody': { lat: 5.343512, lon: -3.993045, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CHU de Cocody', cat: 'CHU' },
  'hopital chu treichville': { lat: 5.291248, lon: -4.003582, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'CHU de Treichville', cat: 'CHU' },
  'hopital chu yopougon': { lat: 5.358419, lon: -4.089692, commune: 'Yopougon', quartier: 'Quartier Hôpital', titre: 'CHU de Yopougon', cat: 'CHU' },
  'hopital d avocatier': { lat: 5.438752, lon: -4.024201, commune: 'Abobo', quartier: 'Avocatier', titre: 'Hôpital Henriette Bédié d\'Avocatier', cat: 'Hôpital Général' },
  'hopital de la police': { lat: 5.336290, lon: -4.023090, commune: 'Plateau', quartier: 'Indénié', titre: 'Hôpital de la Police Nationale', cat: 'Hôpital Public' },
  'hopital de la police nationale': { lat: 5.336290, lon: -4.023090, commune: 'Plateau', quartier: 'Indénié', titre: 'Hôpital de la Police Nationale', cat: 'Hôpital Public' },
  'hopital general abobo': { lat: 5.423721, lon: -4.016362, commune: 'Abobo', quartier: 'Sagbé', titre: 'Hôpital Général d\'Abobo (Sagbé)', cat: 'Hôpital Général' },
  'hopital general adjame': { lat: 5.348821, lon: -4.024671, commune: 'Adjamé', quartier: 'Williamsville', titre: 'Hôpital Général d\'Adjamé', cat: 'Hôpital Général' },
  'hopital general anyama': { lat: 5.501021, lon: -4.045752, commune: 'Anyama', quartier: 'Anyama Centre', titre: 'Hôpital Général d\'Anyama', cat: 'Hôpital Général' },
  'hopital general bingerville': { lat: 5.360062, lon: -3.885311, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Général de Bingerville', cat: 'Hôpital Général' },
  'hopital general cabinet prive': { lat: 5.360062, lon: -3.885311, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Général de Bingerville', cat: 'Hôpital Général' },
  'hopital general d abobo': { lat: 5.423721, lon: -4.016362, commune: 'Abobo', quartier: 'Sagbé', titre: 'Hôpital Général d\'Abobo (Sagbé)', cat: 'Hôpital Général' },
  'hopital general d adjame': { lat: 5.348821, lon: -4.024671, commune: 'Adjamé', quartier: 'Williamsville', titre: 'Hôpital Général d\'Adjamé', cat: 'Hôpital Général' },
  'hopital general d anyama': { lat: 5.501021, lon: -4.045752, commune: 'Anyama', quartier: 'Anyama Centre', titre: 'Hôpital Général d\'Anyama', cat: 'Hôpital Général' },
  'hopital general de bingerville': { lat: 5.360062, lon: -3.885311, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Général de Bingerville', cat: 'Hôpital Général' },
  'hopital general de koumassi': { lat: 5.287321, lon: -3.969532, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Hôpital Général de Koumassi', cat: 'Hôpital Général' },
  'hopital general de marcory': { lat: 5.300681, lon: -3.983292, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Hôpital Général de Marcory', cat: 'Hôpital Général' },
  'hopital general de port bouet': { lat: 5.262612, lon: -3.962174, commune: 'Port-Bouët', quartier: 'Petit Bassam', titre: 'Hôpital Général de Port-Bouët', cat: 'Hôpital Général' },
  'hopital general de songon': { lat: 5.318200, lon: -4.245000, commune: 'Songon', quartier: 'Songon Kassemblé', titre: 'Hôpital Général de Songon', cat: 'Hôpital Général' },
  'hopital general de treichville': { lat: 5.311102, lon: -4.007991, commune: 'Treichville', quartier: 'Nanan Yamousso', titre: 'Hôpital Général de Treichville', cat: 'Hôpital Général' },
  'hopital general de yopougon': { lat: 5.341431, lon: -4.080032, commune: 'Yopougon', quartier: 'Attié', titre: 'Hôpital Général de Yopougon-Attié', cat: 'Hôpital Général' },
  'hopital general de yopougon attie': { lat: 5.341431, lon: -4.080032, commune: 'Yopougon', quartier: 'Attié', titre: 'Hôpital Général de Yopougon-Attié', cat: 'Hôpital Général' },
  'hopital general houphouet boigny abobo': { lat: 5.443152, lon: -4.007874, commune: 'Abobo', quartier: 'Abobo Nord', titre: 'CHR d\'Abobo (Hôpital Houphouët-Boigny)', cat: 'CHR' },
  'hopital general koumassi': { lat: 5.287321, lon: -3.969532, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Hôpital Général de Koumassi', cat: 'Hôpital Général' },
  'hopital general marcory': { lat: 5.300681, lon: -3.983292, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Hôpital Général de Marcory', cat: 'Hôpital Général' },
  'hopital general port bouet': { lat: 5.262612, lon: -3.962174, commune: 'Port-Bouët', quartier: 'Petit Bassam', titre: 'Hôpital Général de Port-Bouët', cat: 'Hôpital Général' },
  'hopital general service de cardiologie': { lat: 5.262612, lon: -3.962174, commune: 'Port-Bouët', quartier: 'Petit Bassam', titre: 'Hôpital Général de Port-Bouët', cat: 'Hôpital Général' },
  'hopital general songon': { lat: 5.318200, lon: -4.245000, commune: 'Songon', quartier: 'Songon Kassemblé', titre: 'Hôpital Général de Songon', cat: 'Hôpital Général' },
  'hopital general treichville': { lat: 5.311102, lon: -4.007991, commune: 'Treichville', quartier: 'Nanan Yamousso', titre: 'Hôpital Général de Treichville', cat: 'Hôpital Général' },
  'hopital general yopougon': { lat: 5.341431, lon: -4.080032, commune: 'Yopougon', quartier: 'Attié', titre: 'Hôpital Général de Yopougon-Attié', cat: 'Hôpital Général' },
  'hopital henriette bedie d avocatier': { lat: 5.438752, lon: -4.024201, commune: 'Abobo', quartier: 'Avocatier', titre: 'Hôpital Henriette Bédié d\'Avocatier', cat: 'Hôpital Général' },
  'hopital henriette bedie de l avocatier': { lat: 5.438752, lon: -4.024201, commune: 'Abobo', quartier: 'Avocatier', titre: 'Hôpital Henriette Bédié d\'Avocatier', cat: 'Hôpital Général' },
  'hopital houphouet boigny d abobo': { lat: 5.443152, lon: -4.007874, commune: 'Abobo', quartier: 'Abobo Nord', titre: 'CHR d\'Abobo (Hôpital Houphouët-Boigny)', cat: 'CHR' },
  'hopital koumassi': { lat: 5.287321, lon: -3.969532, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Hôpital Général de Koumassi', cat: 'Hôpital Général' },
  'hopital marcory': { lat: 5.300681, lon: -3.983292, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Hôpital Général de Marcory', cat: 'Hôpital Général' },
  'hopital mere enfant': { lat: 5.361792, lon: -3.883904, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Mère-Enfant Dominique Ouattara (Bingerville)', cat: 'Hôpital Spécialisé' },
  'hopital mere enfant dominique ouattara': { lat: 5.361792, lon: -3.883904, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Mère-Enfant Dominique Ouattara (Bingerville)', cat: 'Hôpital Spécialisé' },
  'hopital militaire': { lat: 5.381682, lon: -4.007251, commune: 'Adjamé', quartier: 'Paillet', titre: 'Hôpital Militaire d\'Abidjan (HMA)', cat: 'Hôpital Militaire' },
  'hopital militaire d abidjan': { lat: 5.381682, lon: -4.007251, commune: 'Adjamé', quartier: 'Paillet', titre: 'Hôpital Militaire d\'Abidjan (HMA)', cat: 'Hôpital Militaire' },
  'hopital nanan yamousso': { lat: 5.311102, lon: -4.007991, commune: 'Treichville', quartier: 'Nanan Yamousso', titre: 'Hôpital Général de Treichville', cat: 'Hôpital Général' },
  'hopital port bouet': { lat: 5.262612, lon: -3.962174, commune: 'Port-Bouët', quartier: 'Petit Bassam', titre: 'Hôpital Général de Port-Bouët', cat: 'Hôpital Général' },
  'hopital psychiatrique bingerville': { lat: 5.356200, lon: -3.892100, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Psychiatrique de Bingerville', cat: 'Hôpital Spécialisé' },
  'hopital psychiatrique de bingerville': { lat: 5.356200, lon: -3.892100, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Psychiatrique de Bingerville', cat: 'Hôpital Spécialisé' },
  'hopital sagbe': { lat: 5.423721, lon: -4.016362, commune: 'Abobo', quartier: 'Sagbé', titre: 'Hôpital Général d\'Abobo (Sagbé)', cat: 'Hôpital Général' },
  'hopital sicogi koumassi': { lat: 5.287321, lon: -3.969532, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Hôpital Général de Koumassi', cat: 'Hôpital Général' },
  'hopital songon': { lat: 5.318200, lon: -4.245000, commune: 'Songon', quartier: 'Songon Kassemblé', titre: 'Hôpital Général de Songon', cat: 'Hôpital Général' },
  'hopital treichville nanan yamousso': { lat: 5.311102, lon: -4.007991, commune: 'Treichville', quartier: 'Nanan Yamousso', titre: 'Hôpital Général de Treichville', cat: 'Hôpital Général' },
  'hopital williamsville': { lat: 5.348821, lon: -4.024671, commune: 'Adjamé', quartier: 'Williamsville', titre: 'Hôpital Général d\'Adjamé', cat: 'Hôpital Général' },
  'hotel medical des impots': { lat: 5.366014, lon: -4.007653, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Hôtel Médical des Impôts (Cocody)', cat: 'Centre Médical' },
  'hotel medical des impots bingerville': { lat: 5.361520, lon: -3.912040, commune: 'Bingerville', quartier: 'Feh Kessé', titre: 'Hôtel Médical des Impôts (Bingerville Feh Kessé)', cat: 'Centre Médical' },
  'hotel medical des impots cocody': { lat: 5.366014, lon: -4.007653, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Hôtel Médical des Impôts (Cocody)', cat: 'Centre Médical' },
  'hotel medical des impots kesse fe': { lat: 5.361520, lon: -3.912040, commune: 'Bingerville', quartier: 'Feh Kessé', titre: 'Hôtel Médical des Impôts (Bingerville Feh Kessé)', cat: 'Centre Médical' },
  'ica': { lat: 5.291192, lon: -4.003561, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Institut de Cardiologie d\'Abidjan (ICA)', cat: 'Institut Spécialisé' },
  'ica abidjan': { lat: 5.291192, lon: -4.003561, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Institut de Cardiologie d\'Abidjan (ICA)', cat: 'Institut Spécialisé' },
  'immeuble gmmg medical': { lat: 5.337821, lon: -4.024030, commune: 'Plateau', quartier: 'Plateau', titre: 'CSA-GMMG (Plateau)', cat: 'Centre Médical' },
  'impots feh kesse': { lat: 5.361520, lon: -3.912040, commune: 'Bingerville', quartier: 'Feh Kessé', titre: 'Hôtel Médical des Impôts (Bingerville Feh Kessé)', cat: 'Centre Médical' },
  'impots medical cocody': { lat: 5.366014, lon: -4.007653, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Hôtel Médical des Impôts (Cocody)', cat: 'Centre Médical' },
  'indenie plateau': { lat: 5.338381, lon: -4.019072, commune: 'Plateau', quartier: 'Indénié', titre: 'Polyclinique Internationale de l\'Indénié (Plateau)', cat: 'Polyclinique' },
  'infirmerie ste therese': { lat: 5.348369, lon: -4.018126, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Infirmerie Sainte-Thérèse (Adjamé)', cat: 'Centre Médical' },
  'infirmerie ste therese adjame quartier latin': { lat: 5.348369, lon: -4.018126, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Infirmerie Sainte-Thérèse (Adjamé)', cat: 'Centre Médical' },
  'insp': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Institut National de Santé Publique (INSP Adjamé)', cat: 'Institut Spécialisé' },
  'insp adjame': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Institut National de Santé Publique (INSP Adjamé)', cat: 'Institut Spécialisé' },
  'insp treichville': { lat: 5.298500, lon: -4.004000, commune: 'Treichville', quartier: 'Arras', titre: 'Institut National de Santé Publique (INSP Treichville)', cat: 'Institut Spécialisé' },
  'institut de cardiologie': { lat: 5.291192, lon: -4.003561, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Institut de Cardiologie d\'Abidjan (ICA)', cat: 'Institut Spécialisé' },
  'institut de cardiologie d abidjan': { lat: 5.291192, lon: -4.003561, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Institut de Cardiologie d\'Abidjan (ICA)', cat: 'Institut Spécialisé' },
  'institut national de sante publique': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Institut National de Santé Publique (INSP Adjamé)', cat: 'Institut Spécialisé' },
  'institut national de sante publique adjame': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Institut National de Santé Publique (INSP Adjamé)', cat: 'Institut Spécialisé' },
  'institut national de sante publique treichville': { lat: 5.298500, lon: -4.004000, commune: 'Treichville', quartier: 'Arras', titre: 'Institut National de Santé Publique (INSP Treichville)', cat: 'Institut Spécialisé' },
  'institut pasteur': { lat: 5.344015, lon: -3.993021, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Institut Pasteur de Côte d\'Ivoire (IPCI)', cat: 'Institut Spécialisé' },
  'institut pasteur adiopodoume': { lat: 5.334000, lon: -4.131000, commune: 'Yopougon', quartier: 'Adiopodoumé', titre: 'Institut Pasteur de Côte d\'Ivoire (Site Adiopodoumé)', cat: 'Institut Spécialisé' },
  'institut pasteur de cote d ivoire': { lat: 5.344015, lon: -3.993021, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Institut Pasteur de Côte d\'Ivoire (IPCI)', cat: 'Institut Spécialisé' },
  'ipci': { lat: 5.344015, lon: -3.993021, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Institut Pasteur de Côte d\'Ivoire (IPCI)', cat: 'Institut Spécialisé' },
  'ipci adiopodoume': { lat: 5.334000, lon: -4.131000, commune: 'Yopougon', quartier: 'Adiopodoumé', titre: 'Institut Pasteur de Côte d\'Ivoire (Site Adiopodoumé)', cat: 'Institut Spécialisé' },
  'ipci cocody': { lat: 5.344015, lon: -3.993021, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Institut Pasteur de Côte d\'Ivoire (IPCI)', cat: 'Institut Spécialisé' },
  'la chrysalide toits rouges': { lat: 5.331746, lon: -4.055406, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'Clinique Médicale La Chrysalide (Toits Rouges)', cat: 'Clinique Privée' },
  'la prevoyance saint andre': { lat: 5.362720, lon: -4.067798, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Moderne la Prévoyance (Yopougon)', cat: 'Clinique Privée' },
  'la providence danga': { lat: 5.347312, lon: -4.009571, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique La Providence', cat: 'Clinique Privée' },
  'la rosette treichville': { lat: 5.301870, lon: -4.003280, commune: 'Treichville', quartier: 'Arras', titre: 'Clinique La Rosette (Treichville)', cat: 'Clinique Privée' },
  'la rotonde plateau': { lat: 5.321750, lon: -4.017212, commune: 'Plateau', quartier: 'Plateau', titre: 'Cabinet Médical La Rotonde (Plateau)', cat: 'Centre Médical' },
  'la victoire charly': { lat: 5.361526, lon: -4.069458, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'CMS La Victoire (Yopougon Charly)', cat: 'Centre Médical' },
  'le grand centre niangon': { lat: 5.336990, lon: -4.087630, commune: 'Yopougon', quartier: 'Niangon', titre: 'Clinique Médicale Le Grand Centre (Yopougon)', cat: 'Clinique Privée' },
  'les abes palmeraie': { lat: 5.369369, lon: -3.963337, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Centre Médical Les Abes (Palmeraie)', cat: 'Centre Médical' },
  'les myriades zone 4': { lat: 5.310740, lon: -3.990990, commune: 'Marcory', quartier: 'Zone 4', titre: 'Clinique Les Myriades (Marcory Zone 4)', cat: 'Polyclinique' },
  'les oliviers toits rouges': { lat: 5.333100, lon: -4.062070, commune: 'Yopougon', quartier: 'Toits Rouges', titre: 'Clinique Médicale Les Oliviers (Toits Rouges)', cat: 'Clinique Privée' },
  'les perles bingerville': { lat: 5.368560, lon: -3.909580, commune: 'Bingerville', quartier: 'Cité Marina', titre: 'Société Médicale Les Perles (Bingerville)', cat: 'Centre Médical' },
  'longchamp plateau': { lat: 5.326234, lon: -4.018393, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Longchamp (Plateau)', cat: 'Centre Médical' },
  'marine nationale clinique': { lat: 5.315492, lon: -4.034112, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Marine Nationale (Yopougon)', cat: 'Clinique Privée' },
  'maternite 220 lgts': { lat: 5.348369, lon: -4.018126, commune: 'Adjamé', quartier: '220 Lglts', titre: 'Maternité des 220 Logements (Adjamé)', cat: 'Maternité / PMI' },
  'maternite 220 logements': { lat: 5.348369, lon: -4.018126, commune: 'Adjamé', quartier: '220 Lglts', titre: 'Maternité des 220 Logements (Adjamé)', cat: 'Maternité / PMI' },
  'maternite abobo baoule': { lat: 5.432000, lon: -3.996000, commune: 'Abobo', quartier: 'Abobo Baoulé', titre: 'PMI d\'Abobo Baoulé', cat: 'Maternité / PMI' },
  'maternite abobo te': { lat: 5.407000, lon: -4.002000, commune: 'Abobo', quartier: 'Abobo-Té', titre: 'PMI d\'Abobo Té', cat: 'Maternité / PMI' },
  'maternite attecoube': { lat: 5.353029, lon: -4.034843, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'Maternité d\'Attécoubé', cat: 'Maternité / PMI' },
  'maternite avocatier': { lat: 5.439000, lon: -4.025000, commune: 'Abobo', quartier: 'Avocatier', titre: 'Maternité d\'Avocatier (Abobo)', cat: 'Maternité / PMI' },
  'maternite d attecoube': { lat: 5.353029, lon: -4.034843, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'Maternité d\'Attécoubé', cat: 'Maternité / PMI' },
  'maternite d attecoube salle d accouchement': { lat: 5.353029, lon: -4.034843, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'Maternité d\'Attécoubé', cat: 'Maternité / PMI' },
  'maternite des 220 logements': { lat: 5.348369, lon: -4.018126, commune: 'Adjamé', quartier: '220 Lglts', titre: 'Maternité des 220 Logements (Adjamé)', cat: 'Maternité / PMI' },
  'maternite koumassi': { lat: 5.295000, lon: -3.948000, commune: 'Koumassi', quartier: 'Koumassi Nord-Est', titre: 'Maternité de Koumassi Nord-Est', cat: 'Maternité / PMI' },
  'maternite marcory': { lat: 5.301500, lon: -3.981000, commune: 'Marcory', quartier: 'Remblais', titre: 'Maternité de Marcory Remblais', cat: 'Maternité / PMI' },
  'maternite marcory remblais': { lat: 5.301500, lon: -3.981000, commune: 'Marcory', quartier: 'Remblais', titre: 'Maternité de Marcory Remblais', cat: 'Maternité / PMI' },
  'maternite siporex': { lat: 5.342000, lon: -4.061000, commune: 'Yopougon', quartier: 'Siporex', titre: 'Maternité de Siporex', cat: 'Maternité / PMI' },
  'mavor plateau': { lat: 5.339928, lon: -4.026184, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médico-Cardiologique Mavor (Plateau)', cat: 'Centre Médical' },
  'medical des sportifs bingerville': { lat: 5.360562, lon: -3.895000, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Société Médicale des Sportifs (Bingerville)', cat: 'Centre Médical' },
  'medical fonctionnaires plateau': { lat: 5.324020, lon: -4.021930, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical des Fonctionnaires (Plateau)', cat: 'Centre Médical' },
  'medical zoe cocody': { lat: 5.328830, lon: -3.950375, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Groupe Médical Zoé', cat: 'Centre Médical' },
  'ministere de la fonction publique mfpma': { lat: 5.328220, lon: -4.021388, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Patrice Kouamé', cat: 'Centre Médical' },
  'misericorde koumassi': { lat: 5.288448, lon: -3.964515, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Centre Médical La Miséricorde (Koumassi Sicogi)', cat: 'Centre Médical' },
  'mutrepci angre': { lat: 5.396780, lon: -3.991240, commune: 'Cocody', quartier: 'Angré', titre: 'Clinique Médicale Mutrepci', cat: 'Clinique Privée' },
  'nadine cocody': { lat: 5.345109, lon: -4.010959, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Cabinet Médical Nadine (Cocody Centre)', cat: 'Centre Médical' },
  'notre dame de l incarnation palmeraie': { lat: 5.364400, lon: -3.959090, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Clinique Notre Dame de l\'Incarnation', cat: 'Clinique Privée' },
  'notre dame des victoires': { lat: 5.369369, lon: -3.963337, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Notre Dame Des Victoires (Palmeraie)', cat: 'Centre Médical' },
  'notre dame des victoires palmeraie': { lat: 5.369369, lon: -3.963337, commune: 'Cocody', quartier: 'Riviera Palmeraie', titre: 'Notre Dame Des Victoires (Palmeraie)', cat: 'Centre Médical' },
  'notre dame du puy yopougon': { lat: 5.344873, lon: -4.107109, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Médicale Notre Dame Du Puy', cat: 'Clinique Privée' },
  'nouvelle clinique saint sauveur': { lat: 5.349770, lon: -4.100230, commune: 'Yopougon', quartier: 'Ananeraie', titre: 'Nouvelle Clinique Saint-Sauveur (Yopougon)', cat: 'Clinique Privée' },
  'nutrition diabete port bouet': { lat: 5.258500, lon: -3.959400, commune: 'Port-Bouët', quartier: 'Port-Bouët Centre', titre: 'Centre Nutrition Diabète et Plaies (Port-Bouët)', cat: 'Centre Médical' },
  'oasis sante kenya': { lat: 5.347750, lon: -4.073080, commune: 'Yopougon', quartier: 'Kenya', titre: 'Clinique Médicale Oasis Santé (Yopougon)', cat: 'Clinique Privée' },
  'pisam': { lat: 5.336904, lon: -4.013442, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Polyclinique Internationale Sainte Anne-Marie (PISAM)', cat: 'Polyclinique' },
  'pmi abobo baoule': { lat: 5.432000, lon: -3.996000, commune: 'Abobo', quartier: 'Abobo Baoulé', titre: 'PMI d\'Abobo Baoulé', cat: 'Maternité / PMI' },
  'pmi abobo te': { lat: 5.407000, lon: -4.002000, commune: 'Abobo', quartier: 'Abobo-Té', titre: 'PMI d\'Abobo Té', cat: 'Maternité / PMI' },
  'pmi attecoube': { lat: 5.349742, lon: -4.033022, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'PMI d\'Attécoubé (CPN)', cat: 'Maternité / PMI' },
  'pmi attecoube cpn': { lat: 5.349742, lon: -4.033022, commune: 'Attécoubé', quartier: 'Attécoubé Centre', titre: 'PMI d\'Attécoubé (CPN)', cat: 'Maternité / PMI' },
  'pmi avenue 8': { lat: 5.305000, lon: -4.008000, commune: 'Treichville', quartier: 'Avenue 8', titre: 'PMI de Treichville', cat: 'Maternité / PMI' },
  'pmi avocatier': { lat: 5.439000, lon: -4.025000, commune: 'Abobo', quartier: 'Avocatier', titre: 'Maternité d\'Avocatier (Abobo)', cat: 'Maternité / PMI' },
  'pmi koumassi': { lat: 5.295000, lon: -3.948000, commune: 'Koumassi', quartier: 'Koumassi Nord-Est', titre: 'Maternité de Koumassi Nord-Est', cat: 'Maternité / PMI' },
  'pmi marcory': { lat: 5.301500, lon: -3.981000, commune: 'Marcory', quartier: 'Remblais', titre: 'Maternité de Marcory Remblais', cat: 'Maternité / PMI' },
  'pmi treichville': { lat: 5.305000, lon: -4.008000, commune: 'Treichville', quartier: 'Avenue 8', titre: 'PMI de Treichville', cat: 'Maternité / PMI' },
  'pmi yopougon siporex': { lat: 5.342000, lon: -4.061000, commune: 'Yopougon', quartier: 'Siporex', titre: 'Maternité de Siporex', cat: 'Maternité / PMI' },
  'police nationale hopital': { lat: 5.336290, lon: -4.023090, commune: 'Plateau', quartier: 'Indénié', titre: 'Hôpital de la Police Nationale', cat: 'Hôpital Public' },
  'polyclinique avicennes': { lat: 5.316221, lon: -3.996662, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Avicennes (Marcory)', cat: 'Polyclinique' },
  'polyclinique des 2 pltx': { lat: 5.363242, lon: -3.999112, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Polyclinique des Deux Plateaux (Novamed)', cat: 'Polyclinique' },
  'polyclinique des 2 pltx groupe novamed': { lat: 5.363242, lon: -3.999112, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Polyclinique des Deux Plateaux (Novamed)', cat: 'Polyclinique' },
  'polyclinique des deux plateaux': { lat: 5.363242, lon: -3.999112, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Polyclinique des Deux Plateaux (Novamed)', cat: 'Polyclinique' },
  'polyclinique des deux plateaux groupe novamed': { lat: 5.363242, lon: -3.999112, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Polyclinique des Deux Plateaux (Novamed)', cat: 'Polyclinique' },
  'polyclinique farah': { lat: 5.310672, lon: -3.986451, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Farah (Marcory)', cat: 'Polyclinique' },
  'polyclinique groupe medical du plateau': { lat: 5.320703, lon: -4.014141, commune: 'Plateau', quartier: 'Plateau', titre: 'Polyclinique Groupe Médical du Plateau (GMP)', cat: 'Polyclinique' },
  'polyclinique groupe medical du plateau gmp': { lat: 5.320703, lon: -4.014141, commune: 'Plateau', quartier: 'Plateau', titre: 'Polyclinique Groupe Médical du Plateau (GMP)', cat: 'Polyclinique' },
  'polyclinique indenie': { lat: 5.338381, lon: -4.019072, commune: 'Plateau', quartier: 'Indénié', titre: 'Polyclinique Internationale de l\'Indénié (Plateau)', cat: 'Polyclinique' },
  'polyclinique internationale de l indenie': { lat: 5.338381, lon: -4.019072, commune: 'Plateau', quartier: 'Indénié', titre: 'Polyclinique Internationale de l\'Indénié (Plateau)', cat: 'Polyclinique' },
  'polyclinique internationale sainte anne marie': { lat: 5.336904, lon: -4.013442, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Polyclinique Internationale Sainte Anne-Marie (PISAM)', cat: 'Polyclinique' },
  'polyclinique les myriades': { lat: 5.310740, lon: -3.990990, commune: 'Marcory', quartier: 'Zone 4', titre: 'Clinique Les Myriades (Marcory Zone 4)', cat: 'Polyclinique' },
  'polyclinique novamed 2 plateaux': { lat: 5.363242, lon: -3.999112, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Polyclinique des Deux Plateaux (Novamed)', cat: 'Polyclinique' },
  'polyclinique pisam': { lat: 5.336904, lon: -4.013442, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Polyclinique Internationale Sainte Anne-Marie (PISAM)', cat: 'Polyclinique' },
  'polyclinique sacre coeur': { lat: 5.364631, lon: -3.979812, commune: 'Cocody', quartier: 'Riviera Attoban', titre: 'Polyclinique Sacre-Coeur (Riviera Attoban)', cat: 'Polyclinique' },
  'polyclinique sainte therese': { lat: 5.304021, lon: -3.984032, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Polyclinique Sainte-Thérèse (Marcory)', cat: 'Polyclinique' },
  'port bouet 2': { lat: 5.347124, lon: -4.093089, commune: 'Yopougon', quartier: 'Port-Bouët 2', titre: 'FSU COM Port-Bouët 2 (Yopougon)', cat: 'FSU COM' },
  'poste ci centre medical': { lat: 5.325722, lon: -4.017429, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical de la Poste-CI (Plateau)', cat: 'Centre Médical' },
  'presidence medical plateau': { lat: 5.323671, lon: -4.016944, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical Présidence de la République', cat: 'Centre Médical' },
  'prima center medical': { lat: 5.295488, lon: -3.984003, commune: 'Marcory', quartier: 'Zone 4', titre: 'Centre Médical Prima (Marcory Zone 4)', cat: 'Centre Médical' },
  'prima medical zone 4': { lat: 5.295488, lon: -3.984003, commune: 'Marcory', quartier: 'Zone 4', titre: 'Centre Médical Prima (Marcory Zone 4)', cat: 'Centre Médical' },
  'quartier latin medical adjame': { lat: 5.358701, lon: -4.020002, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre Médical du Quartier Latin (Adjamé)', cat: 'Centre Médical' },
  'radiotherapie cocody': { lat: 5.344200, lon: -3.992800, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CNRAO (Centre Radiothérapie Alassane Ouattara)', cat: 'Institut Spécialisé' },
  'rti medical': { lat: 5.339907, lon: -4.008629, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Service Médical RTI (Cocody)', cat: 'Centre Médical' },
  'sacre coeur attoban': { lat: 5.364631, lon: -3.979812, commune: 'Cocody', quartier: 'Riviera Attoban', titre: 'Polyclinique Sacre-Coeur (Riviera Attoban)', cat: 'Polyclinique' },
  'saint laurent gabriel gare': { lat: 5.325199, lon: -4.069776, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical St Laurent (Yopougon)', cat: 'Centre Médical' },
  'saint mathieu niangon cite verte': { lat: 5.331030, lon: -4.110560, commune: 'Yopougon', quartier: 'Niangon', titre: 'Clinique Médicale Saint Mathieu (Niangon)', cat: 'Clinique Privée' },
  'saint paul plateau': { lat: 5.326060, lon: -4.021640, commune: 'Plateau', quartier: 'Plateau', titre: 'Espace Médical Saint-Paul (Plateau)', cat: 'Centre Médical' },
  'saint sauveur yopougon': { lat: 5.349770, lon: -4.100230, commune: 'Yopougon', quartier: 'Ananeraie', titre: 'Nouvelle Clinique Saint-Sauveur (Yopougon)', cat: 'Clinique Privée' },
  'sainte famille yopougon': { lat: 5.331343, lon: -4.076174, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Clinique Sainte Famille (Yopougon)', cat: 'Clinique Privée' },
  'sainte henriette angre': { lat: 5.399240, lon: -3.973820, commune: 'Cocody', quartier: 'Angré', titre: 'Clinique Sainte Henriette', cat: 'Clinique Privée' },
  'sainte philomene bonoumin': { lat: 5.356970, lon: -3.979540, commune: 'Cocody', quartier: 'Riviera Bonoumin', titre: 'Clinique Médicale Sainte-Philomène', cat: 'Clinique Privée' },
  'sainte rita attie': { lat: 5.340860, lon: -4.087600, commune: 'Yopougon', quartier: 'Attié', titre: 'Clinique Médicale Sainte Rita de Cascia', cat: 'Clinique Privée' },
  'sainte therese marcory': { lat: 5.304021, lon: -3.984032, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Polyclinique Sainte-Thérèse (Marcory)', cat: 'Polyclinique' },
  'sainte trinite de la vie': { lat: 5.397699, lon: -3.992401, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Clinique Médicale Sainte Trinité de la Vie', cat: 'Clinique Privée' },
  'samu': { lat: 5.343000, lon: -3.993500, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'SAMU de Côte d\'Ivoire', cat: 'Institut Spécialisé' },
  'samu abidjan': { lat: 5.343000, lon: -3.993500, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'SAMU de Côte d\'Ivoire', cat: 'Institut Spécialisé' },
  'samu chu cocody': { lat: 5.343000, lon: -3.993500, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'SAMU de Côte d\'Ivoire', cat: 'Institut Spécialisé' },
  'samu cote d ivoire': { lat: 5.343000, lon: -3.993500, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'SAMU de Côte d\'Ivoire', cat: 'Institut Spécialisé' },
  'sanitas treichville': { lat: 5.301540, lon: -4.003280, commune: 'Treichville', quartier: 'Arras', titre: 'Clinique Médicale Sanitas (Treichville)', cat: 'Clinique Privée' },
  'sante scolaire et universitaire adjame': { lat: 5.355954, lon: -4.017690, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'SSSU Adjamé - Est', cat: 'CSU / Dispensaire' },
  'sauveur misericordieux saguidiba': { lat: 5.347749, lon: -4.058179, commune: 'Yopougon', quartier: 'Yopougon Centre', titre: 'Centre Médical Sauveur Miséricordieux', cat: 'Centre Médical' },
  'service medecine consultation abobo': { lat: 5.443028, lon: -4.008025, commune: 'Abobo', quartier: 'Abobo Nord', titre: 'Centre de Consultation Médicale d\'Abobo', cat: 'Centre Médical' },
  'service medical de l assemblee nationale': { lat: 5.329108, lon: -4.020814, commune: 'Plateau', quartier: 'Plateau', titre: 'Service Médical Assemblée Nationale', cat: 'Centre Médical' },
  'service medical rti': { lat: 5.339907, lon: -4.008629, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Service Médical RTI (Cocody)', cat: 'Centre Médical' },
  'service nutrition diabete et plaies': { lat: 5.258500, lon: -3.959400, commune: 'Port-Bouët', quartier: 'Port-Bouët Centre', titre: 'Centre Nutrition Diabète et Plaies (Port-Bouët)', cat: 'Centre Médical' },
  'sitara centre medical': { lat: 5.336347, lon: -4.026125, commune: 'Plateau', quartier: 'Plateau', titre: 'SITARA Centre Médical', cat: 'Centre Médical' },
  'sitarail centre medical': { lat: 5.336347, lon: -4.026125, commune: 'Plateau', quartier: 'Plateau', titre: 'SITARA Centre Médical', cat: 'Centre Médical' },
  'societe medicale des sportifs': { lat: 5.360562, lon: -3.895000, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Société Médicale des Sportifs (Bingerville)', cat: 'Centre Médical' },
  'societe medicale les perles': { lat: 5.368560, lon: -3.909580, commune: 'Bingerville', quartier: 'Cité Marina', titre: 'Société Médicale Les Perles (Bingerville)', cat: 'Centre Médical' },
  'soins de vie mbadon': { lat: 5.348421, lon: -3.943141, commune: 'Cocody', quartier: 'M\'Badon', titre: 'Groupe Soins de Vie (M\'Badon)', cat: 'Centre Médical' },
  'sssu adjame': { lat: 5.355954, lon: -4.017690, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'SSSU Adjamé - Est', cat: 'CSU / Dispensaire' },
  'sssu adjame est': { lat: 5.355954, lon: -4.017690, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'SSSU Adjamé - Est', cat: 'CSU / Dispensaire' },
  'trade center plateau': { lat: 5.318560, lon: -4.015810, commune: 'Plateau', quartier: 'Plateau', titre: 'Clinique Médicale Trade Center (Plateau)', cat: 'Clinique Privée' },
  'tresor medical plateau': { lat: 5.326041, lon: -4.018832, commune: 'Plateau', quartier: 'Plateau', titre: 'Centre Médical du Trésor (Plateau)', cat: 'Centre Médical' },
  'xmed bingerville': { lat: 5.361285, lon: -3.894236, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Centre d\'Excellence Médicale Xmed (Bingerville)', cat: 'Centre Médical' }
};

}

function trouverEtablissementRef(nom) {
  if (!nom || typeof TABLE_REFERENCE_ETABLISSEMENTS_CI === 'undefined') return null;
  var k = sansAccents(nom).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return TABLE_REFERENCE_ETABLISSEMENTS_CI[k] || null;
}

var REGLAGES_MOTEUR = {
  penaliteKm: 25,              // points de score retirés par km de détour ajouté à la tournée
  rayonAutourKm: 5,            // rayon par défaut de « Autour de moi »
  nbPropositions: 15,
  detourRoutier: 1.5,          // coefficient fixe vol d'oiseau -> distance réelle estimée (x 1,5)
  minutesParKm: 3,             // vitesse moyenne en ville (~20 km/h, trafic d'Abidjan)
  facteurPointe: 1.6,          // trajets plus lents aux heures de pointe
  heuresPointe: [[420, 570], [990, 1170]],   // 7:00-9:30 et 16:30-19:30
  minutesPont: 10,             // traversée de la lagune (Plateau / Treichville : ponts souvent saturés)
  communesSud: ['Treichville', 'Marcory', 'Koumassi', 'Port-Bouët'],
  dureeVisite: 20,             // minutes passées par visite
  debutTravail: 450,           // 07:30 : aucune visite proposée avant
  finTravail: 1140,            // 19:00 : toutes les visites proposées sont finies
  toleranceRdv: 10,            // minutes de retard tolérées sur un RDV fixé
  horaireMatinDefaut: '08:00-12:00',
  horaireSoirDefaut: '15:00-19:00',
  cadence: { 3: 14, 2: 30, 1: 60 }   // jours visés entre deux visites selon la note (3 = fort potentiel)
};

// ---------------------------------------------------------------- Texte
function sansAccents(s) {
  return String(s === undefined || s === null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normaliser(s) { return sansAccents(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

// 3.26.9 : Détection intelligente d'un même établissement (CHU, cliniques, hôpitaux avec variantes d'écriture)
function memeEtablissement(a, b) {
  if (!a || !b) return false;
  var sa = sansAccents(String(a)).toLowerCase().trim();
  var sb = sansAccents(String(b)).toLowerCase().trim();
  if (sa === sb) return true;

  function nettoyerEtab(s) {
    return s
      .replace(/\b(centre hospitalier universitaire|centre hospitalier et universitaire|centre hosp univ)\b/g, 'chu')
      .replace(/\b(hopital militaire d abidjan|hopital militaire abidjan)\b/g, 'hma')
      .replace(/\b(institut de cardiologie d abidjan|institut cardiologie abidjan|institut de cardiologie)\b/g, 'ica')
      .replace(/\b(polyclinique internationale sainte anne marie|polyclinique sainte anne marie|clinique sainte anne marie)\b/g, 'pisam')
      .replace(/\b(hopital general|hop general)\b/g, 'hg')
      .replace(/\b(polyclinique|clinique|hopital|centre medical|cabinet medical|cabinet)\b/g, '')
      .replace(/\b(de|du|des|d|l|le|la|les|et|au|aux)\b/g, ' ')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var c1 = nettoyerEtab(sa);
  var c2 = nettoyerEtab(sb);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  var sansEsp1 = c1.replace(/\s+/g, '');
  var sansEsp2 = c2.replace(/\s+/g, '');
  if (sansEsp1 === sansEsp2) return true;

  // Inclusion de libellé (ex: "chu cocody" dans "service cardiologie chu cocody")
  if (c1.length >= 4 && c2.length >= 4) {
    if (c1.indexOf(c2) >= 0 || c2.indexOf(c1) >= 0) return true;
    if (sansEsp1.indexOf(sansEsp2) >= 0 || sansEsp2.indexOf(sansEsp1) >= 0) return true;
  }

  // Mots significatifs
  var w1 = c1.split(' ').filter(function (w) { return w.length >= 3; });
  var w2 = c2.split(' ').filter(function (w) { return w.length >= 3; });
  if (w1.length >= 1 && w2.length >= 1) {
    if (w1.indexOf('chu') >= 0 && w2.indexOf('chu') >= 0) {
      var sitesChu = ['cocody', 'treichville', 'angre', 'yopougon', 'bouake'];
      for (var k = 0; k < sitesChu.length; k++) {
        var site = sitesChu[k];
        if (w1.indexOf(site) >= 0 && w2.indexOf(site) >= 0) return true;
      }
    }
    var communs = w1.filter(function (w) { return w2.indexOf(w) >= 0; });
    if (communs.length >= 2 && (communs.length === w1.length || communs.length === w2.length)) return true;
  }
  return false;
}

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

// Normalisation tolérante d'une plage horaire (ex: "8h-12h", "08:00 - 12:00", "15:00 à 19:00" -> "08:00-12:00")
function horaireNormalise(t, defaut) {
  if (!t || !String(t).trim()) return defaut || '08:00-12:00';
  var s = String(t).trim().replace(/\s*[–—à]\s*/, '-');
  var m = s.match(/^(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*-\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?$/);
  if (m) {
    var h1 = pad2(+m[1]), min1 = pad2(+(m[2] || 0));
    var h2 = pad2(+m[3]), min2 = pad2(+(m[4] || 0));
    return h1 + ':' + min1 + '-' + h2 + ':' + min2;
  }
  return defaut || '08:00-12:00';
}

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
  var bonus = dernierStatut === 'RDV reporté' || dernierStatut === 'À rappeler' ? 50 : (dernierStatut === 'Intéressé' ? 30 : 0);
  return Math.round((note * 100 + retard * 100 + bonus) * 10) / 10;
}

// 3.25.40 : distance routière réelle estimée en km avec coefficient fixe x 1,5 demandé
function distanceVol(a, b) { var d = distanceKm(a, b); return d >= 99 ? 99 : d; }
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
// ---------------------------------------------------------------- Fiches produits (aide-mémoire du délégué, 3.10.0)
// Feuille « Fiches produits » du Google Sheet : une ligne par produit. Elle est créée avec ces fiches si elle n'existe pas ;
// ensuite c'est la feuille qui fait foi (modifiable par le responsable). Plusieurs éléments par case : un par ligne.
// Contenu de référence résumé des RCP (ANSM / VIDAL) des molécules ; à confronter à la notice de la boîte locale.
var CHAMPS_FICHES = [
  ['gamme', 'Gamme'], ['aire', 'Aire thérapeutique'], ['produit', 'Produit'], ['dci', 'DCI et dosage'], ['classe', 'Classe'],
  ['indications', 'Indications'], ['contreIndications', 'Contre-indications'], ['posologie', 'Posologie'],
  ['precautions', 'Précautions et interactions'], ['effets', 'Effets indésirables'], ['arguments', 'Arguments clés'],
  ['laboratoire', 'Laboratoire'], ['sources', 'Sources']
];
var LABO_TROIKAA = 'Troikaa Pharmaceuticals (Inde)';
var FICHES_PRODUITS_DEFAUT = [
  { gamme: "Zyltan (losartan)", aire: "Hypertension artérielle", produit: "Zyltan", dci: "Losartan 25 ou 50 mg, comprimé", classe: "Antagoniste de l'angiotensine II (ARA II)", indications: "Hypertension artérielle essentielle\nNéphropathie du diabétique de type 2 hypertendu avec protéinurie\nInsuffisance cardiaque quand un IEC n'est pas toléré", contreIndications: "Allergie au losartan\nInsuffisance hépatique sévère\nGrossesse (2e et 3e trimestres)\nAssociation à l'aliskiren chez le diabétique ou l'insuffisant rénal", posologie: "50 mg par jour en une prise, pendant ou en dehors des repas\nJusqu'à 100 mg par jour si besoin\nDébuter à 25 mg si déshydratation ou insuffisance hépatique", precautions: "Contrôler kaliémie et créatinine\nPas de double blocage (IEC + ARA II)\nAINS, lithium, sels de potassium : surveiller\nSténose des artères rénales", effets: "Vertiges, hypotension\nHyperkaliémie\nFatigue", arguments: "Une prise par jour, très bien toléré (pas de toux comme les IEC)\nProtège le rein du diabétique de type 2\nBaisse l'acide urique : intéressant chez l'hypertendu goutteux", laboratoire: LABO_TROIKAA, sources: "RCP losartan / Cozaar (ANSM, VIDAL) ; truemeds.in, netmeds.com (Zyltan 25 et 50)" },
  { gamme: 'Zyltan (losartan)', aire: 'Hypertension artérielle', produit: 'Zyltan H', dci: 'Losartan 50 mg + hydrochlorothiazide 12,5 mg, comprimé',
    classe: 'Antagoniste de l\'angiotensine II (ARA II) + diurétique thiazidique',
    indications: 'Hypertension artérielle essentielle non contrôlée par le losartan ou l\'hydrochlorothiazide seuls',
    contreIndications: 'Allergie au losartan, à l\'hydrochlorothiazide ou aux sulfamides\nGrossesse (2e et 3e trimestres)\nInsuffisance rénale sévère (clairance < 30 ml/min) ou anurie\nInsuffisance hépatique sévère, cholestase\nHypokaliémie, hyponatrémie ou hypercalcémie réfractaires ; goutte symptomatique\nAssociation à l\'aliskiren chez le diabétique ou l\'insuffisant rénal',
    posologie: '1 comprimé par jour, pendant ou en dehors des repas\nEffet maximal en 3 à 4 semaines',
    precautions: 'Contrôler kaliémie, natrémie et créatinine\nHypotension si déshydratation ou régime sans sel strict\nAINS, lithium, autres hypotenseurs : surveiller\nPhotosensibilisation (thiazide)',
    effets: 'Vertiges, hypotension\nTroubles électrolytiques (potassium, sodium)\nHausse de l\'acide urique et de la glycémie',
    arguments: 'Une seule prise par jour, deux mécanismes complémentaires\nLe losartan protège le rein (néphropathie du diabétique de type 2)\nLe losartan limite la hausse d\'acide urique due au diurétique',
    laboratoire: LABO_TROIKAA, sources: 'RCP losartan/hydrochlorothiazide (ANSM, VIDAL) ; 1mg.com, pharmeasy.in (composition)' },
  { gamme: 'Zyltan (losartan)', aire: 'Hypertension artérielle', produit: 'Zyltan AM', dci: 'Losartan 50 mg + amlodipine 5 mg, comprimé',
    classe: 'Antagoniste de l\'angiotensine II (ARA II) + inhibiteur calcique (dihydropyridine)',
    indications: 'Hypertension artérielle essentielle non contrôlée par une monothérapie',
    contreIndications: 'Allergie au losartan ou aux dihydropyridines\nGrossesse (2e et 3e trimestres)\nInsuffisance hépatique sévère\nHypotension sévère, choc (dont cardiogénique)\nRétrécissement aortique serré ; insuffisance cardiaque instable après infarctus\nAssociation à l\'aliskiren chez le diabétique ou l\'insuffisant rénal',
    posologie: '1 comprimé par jour, à heure fixe',
    precautions: 'Contrôler kaliémie et créatinine\nPrudence chez l\'insuffisant hépatique et le sujet âgé\nInhibiteurs du CYP3A4 (clarithromycine, itraconazole) : hausse de l\'amlodipine',
    effets: 'Œdèmes des chevilles, bouffées de chaleur\nMaux de tête, vertiges\nPalpitations',
    arguments: 'Deux mécanismes complémentaires en une seule prise\nL\'ARA II atténue les œdèmes de l\'amlodipine\nObservance facilitée',
    laboratoire: LABO_TROIKAA, sources: 'RCP losartan et amlodipine (ANSM, VIDAL) ; 1mg.com (composition Zyltan AM 50/5)' },
  { gamme: 'Zyltan (losartan)', aire: 'Hypertension artérielle', produit: 'Losartan AM', dci: 'Losartan 50 mg + amlodipine 5 mg, comprimé (dosage à confirmer sur la boîte)',
    classe: 'Antagoniste de l\'angiotensine II (ARA II) + inhibiteur calcique (dihydropyridine)',
    indications: 'Hypertension artérielle essentielle non contrôlée par une monothérapie',
    contreIndications: 'Allergie au losartan ou aux dihydropyridines\nGrossesse (2e et 3e trimestres)\nInsuffisance hépatique sévère\nHypotension sévère, choc (dont cardiogénique)\nRétrécissement aortique serré ; insuffisance cardiaque instable après infarctus\nAssociation à l\'aliskiren chez le diabétique ou l\'insuffisant rénal',
    posologie: '1 comprimé par jour, à heure fixe',
    precautions: 'Contrôler kaliémie et créatinine\nPrudence chez l\'insuffisant hépatique et le sujet âgé\nInhibiteurs du CYP3A4 : hausse de l\'amlodipine',
    effets: 'Œdèmes des chevilles, bouffées de chaleur\nMaux de tête, vertiges',
    arguments: 'Même association que Zyltan AM : losartan + amlodipine\nUne seule prise par jour',
    laboratoire: LABO_TROIKAA, sources: 'RCP losartan et amlodipine (ANSM, VIDAL)' },
  { gamme: 'Lesstrol (atorvastatine)', aire: 'Cholestérol et risque cardiovasculaire', produit: 'Lesstrol 20', dci: 'Atorvastatine 20 mg, comprimé',
    classe: 'Hypolipémiant, statine (inhibiteur de l\'HMG-CoA réductase)',
    indications: 'Hypercholestérolémie et dyslipidémie mixte, en complément du régime\nPrévention des événements cardiovasculaires chez le patient à risque',
    contreIndications: 'Allergie à l\'atorvastatine\nMaladie du foie évolutive, transaminases > 3 fois la normale\nGrossesse, allaitement, femme sans contraception efficace\nAssociation au glécaprévir/pibrentasvir (hépatite C)',
    posologie: '10 à 80 mg par jour en une prise, à tout moment de la journée\nAdapter après 4 semaines',
    precautions: 'Inhibiteurs puissants du CYP3A4 (clarithromycine, itraconazole, inhibiteurs de protéase) : éviter ou réduire la dose\nJus de pamplemousse en grande quantité\nDouleurs musculaires : doser les CPK',
    effets: 'Douleurs musculaires\nTroubles digestifs, maux de tête\nHausse des transaminases',
    arguments: 'Statine de référence, très documentée en prévention cardiovasculaire\nDose flexible de 10 à 80 mg\nUne prise par jour, à tout moment',
    laboratoire: LABO_TROIKAA, sources: 'RCP atorvastatine / Tahor (ANSM, VIDAL) ; myupchar.com (composition Lesstrol 20)' },
  { gamme: "Lesstrol (atorvastatine)", aire: "Cholestérol et risque cardiovasculaire", produit: "Lesstrol AM", dci: "Atorvastatine + amlodipine, comprimé (dosage à confirmer sur la boîte, par exemple 10/5 mg)", classe: "Hypolipémiant, statine (inhibiteur de l'HMG-CoA réductase) + inhibiteur calcique (dihydropyridine)", indications: "Patient hypertendu (ou angineux) ayant aussi un cholestérol élevé ou un risque cardiovasculaire, déjà équilibré par les deux molécules", contreIndications: "Allergie à l'atorvastatine ou aux dihydropyridines\nMaladie du foie évolutive, transaminases > 3 fois la normale\nGrossesse, allaitement, femme sans contraception efficace\nHypotension sévère, choc (dont cardiogénique)\nRétrécissement aortique serré ; insuffisance cardiaque instable après infarctus", posologie: "1 comprimé par jour, à heure fixe", precautions: "Inhibiteurs du CYP3A4 : hausse des deux molécules\nDouleurs musculaires inexpliquées : doser les CPK\nBilan hépatique avant et pendant le traitement\nPrudence chez le sujet âgé et l'insuffisant hépatique", effets: "Œdèmes des chevilles, bouffées de chaleur\nDouleurs musculaires\nMaux de tête", arguments: "Tension et cholestérol traités en un seul comprimé\nMoins de comprimés : meilleure observance\nPour le patient à double risque, fréquent en consultation", laboratoire: LABO_TROIKAA, sources: "RCP amlodipine/atorvastatine / Caduet (ANSM, VIDAL) ; pharmeasy.in (Lesstrol AM)" },
  { gamme: "Lesstrol (atorvastatine)", aire: "Cholestérol et risque cardiovasculaire", produit: "Lesstrol EZ", dci: "Atorvastatine 10 mg + ézétimibe 10 mg, comprimé", classe: "Hypolipémiant, statine (inhibiteur de l'HMG-CoA réductase) + inhibiteur de l'absorption intestinale du cholestérol", indications: "Hypercholestérolémie non contrôlée par une statine seule\nPatient déjà traité par atorvastatine et ézétimibe séparément", contreIndications: "Allergie à l'atorvastatine ou à l'ézétimibe\nMaladie du foie évolutive, transaminases > 3 fois la normale\nGrossesse, allaitement, femme sans contraception efficace", posologie: "1 comprimé par jour, à tout moment de la journée", precautions: "Douleurs musculaires inexpliquées : doser les CPK\nBilan hépatique avant et pendant le traitement\nCiclosporine, fibrates : prudence\nInhibiteurs puissants du CYP3A4 : éviter", effets: "Douleurs musculaires\nTroubles digestifs (diarrhée, ballonnements)\nHausse des transaminases", arguments: "Double action : la statine freine la fabrication du cholestérol, l'ézétimibe son absorption\nBaisse du LDL plus forte qu'en doublant la dose de statine\nUn seul comprimé par jour", laboratoire: LABO_TROIKAA, sources: "RCP ézétimibe/atorvastatine (ANSM, VIDAL) ; zeelabpharmacy.com (Lesstrol EZ 10/10)" },
  { gamme: 'Eurythmic (amiodarone)', aire: 'Troubles du rythme cardiaque', produit: 'Eurythmic', dci: 'Amiodarone 100 ou 200 mg, comprimé',
    classe: 'Antiarythmique de classe III',
    indications: 'Troubles du rythme graves : prévention des récidives de tachycardie ou fibrillation ventriculaire\nTachycardies supraventriculaires, fibrillation et flutter auriculaires, en particulier sur cardiopathie',
    contreIndications: 'Bradycardie sinusale, bloc auriculo-ventriculaire de haut degré ou maladie du sinus sans stimulateur\nTrouble de la thyroïde\nAllergie à l\'iode ou à l\'amiodarone\nGrossesse et allaitement\nAssociation aux médicaments donnant des torsades de pointes',
    posologie: 'Charge : 600 à 800 mg par jour pendant 8 à 10 jours\nEntretien : 100 à 400 mg par jour (souvent 200 mg, 5 jours sur 7)',
    precautions: 'Surveiller ECG, thyroïde (TSH), foie, poumons, yeux\nÉviter le soleil (photosensibilisation)\nAnticoagulants (AVK), digoxine, statines, bêtabloquants : doses et surveillance à adapter',
    effets: 'Photosensibilisation, dépôts cornéens\nHypo ou hyperthyroïdie\nBradycardie ; rare : atteinte pulmonaire ou hépatique',
    arguments: 'Antiarythmique de référence, efficace sur les troubles du rythme auriculaires et ventriculaires\nUtilisable en cas d\'insuffisance cardiaque\nLongue durée d\'action',
    laboratoire: LABO_TROIKAA, sources: 'RCP amiodarone / Cordarone (ANSM, VIDAL) ; 1mg.com (composition Eurythmic)' },
  { gamme: 'Tensicard (aténolol)', aire: 'Hypertension artérielle', produit: 'Tensicard', dci: 'Aténolol 25, 50 ou 100 mg, comprimé',
    classe: 'Bêtabloquant cardiosélectif (β1)',
    indications: 'Hypertension artérielle\nAngor d\'effort\nPrévention secondaire après infarctus\nTroubles du rythme supraventriculaires',
    contreIndications: 'Asthme et bronchopneumopathie obstructive sévère\nInsuffisance cardiaque non contrôlée, choc cardiogénique\nBloc auriculo-ventriculaire 2e et 3e degré non appareillé, maladie du sinus\nBradycardie importante (< 45 à 50/min)\nPhéochromocytome non traité ; hypotension ; maladie de Raynaud ou artériopathie sévère',
    posologie: 'HTA : 50 à 100 mg par jour en une prise\nInsuffisance rénale : réduire la dose (élimination par le rein)',
    precautions: 'Ne jamais arrêter brutalement (risque d\'angor ou d\'infarctus)\nDiabétique : masque les signes d\'hypoglycémie\nVérapamil, diltiazem, amiodarone : risque de bradycardie',
    effets: 'Fatigue, extrémités froides\nBradycardie\nTroubles digestifs, troubles du sommeil (rares)',
    arguments: 'Cardiosélectif, une prise par jour\nPeu de passage dans le cerveau : moins de troubles du sommeil\nRalentit le cœur : utile en HTA avec palpitations ou angor',
    laboratoire: LABO_TROIKAA, sources: 'RCP aténolol / Ténormine (ANSM, VIDAL) ; pharmeasy.in (composition Tensicard)' },
  { gamme: 'Telmikaa (telmisartan)', aire: 'Hypertension artérielle', produit: 'Telmikaa', dci: 'Telmisartan 20, 40 ou 80 mg, comprimé',
    classe: 'Antagoniste de l\'angiotensine II (ARA II)',
    indications: 'Hypertension artérielle essentielle\nPrévention cardiovasculaire (80 mg) : maladie athérothrombotique avérée ou diabète de type 2 avec atteinte d\'organe',
    contreIndications: 'Allergie au telmisartan\nGrossesse (2e et 3e trimestres)\nObstruction des voies biliaires, insuffisance hépatique sévère\nAssociation à l\'aliskiren chez le diabétique ou l\'insuffisant rénal',
    posologie: 'HTA : 40 mg par jour (20 à 80 mg)\nPrévention cardiovasculaire : 80 mg par jour\nInsuffisance hépatique légère à modérée : 40 mg maximum',
    precautions: 'Contrôler kaliémie et créatinine\nSténose des artères rénales\nPas de double blocage (IEC + ARA II)',
    effets: 'Vertiges, hypotension\nHyperkaliémie\nDouleurs dorsales, infections ORL',
    arguments: 'Longue durée d\'action : contrôle sur 24 h, pic tensionnel du matin couvert\nÉlimination biliaire : pas d\'adaptation en insuffisance rénale légère à modérée\nSeul ARA II avec une indication de prévention cardiovasculaire',
    laboratoire: LABO_TROIKAA, sources: 'RCP telmisartan (ANSM, sante.fr) ; 1mg.com (composition Telmikaa)' },
  { gamme: "Telmikaa (telmisartan)", aire: "Hypertension artérielle", produit: "Telmikaa AM", dci: "Telmisartan 40 mg + amlodipine 5 mg, comprimé", classe: "Antagoniste de l'angiotensine II (ARA II) + inhibiteur calcique (dihydropyridine)", indications: "Hypertension artérielle essentielle non contrôlée par le telmisartan ou l'amlodipine seuls", contreIndications: "Allergie au telmisartan ou aux dihydropyridines\nObstruction biliaire, insuffisance hépatique sévère\nHypotension sévère, choc (dont cardiogénique)\nRétrécissement aortique serré ; insuffisance cardiaque instable après infarctus\nGrossesse (2e et 3e trimestres)\nAssociation à l'aliskiren chez le diabétique ou l'insuffisant rénal", posologie: "1 comprimé par jour, à heure fixe", precautions: "Contrôler kaliémie et créatinine\nPas de double blocage (IEC + ARA II)\nAINS, lithium, sels de potassium : surveiller\nInhibiteurs du CYP3A4 : hausse de l'amlodipine", effets: "Œdèmes des chevilles\nVertiges, maux de tête\nBouffées de chaleur", arguments: "Deux mécanismes complémentaires, contrôle sur 24 h\nL'ARA II réduit les œdèmes de l'amlodipine\nUne seule prise par jour", laboratoire: LABO_TROIKAA, sources: "RCP telmisartan/amlodipine / Twynsta (ANSM, VIDAL) ; truemeds.in (Telmikaa AM 40/5)" },
  { gamme: "Telmikaa (telmisartan)", aire: "Hypertension artérielle", produit: "Telmikaa H", dci: "Telmisartan 40 mg + hydrochlorothiazide 12,5 mg, comprimé", classe: "Antagoniste de l'angiotensine II (ARA II) + diurétique thiazidique", indications: "Hypertension artérielle essentielle non contrôlée par le telmisartan seul", contreIndications: "Allergie au telmisartan ou à l'hydrochlorothiazide\nAllergie aux sulfamides\nInsuffisance rénale sévère (clairance < 30 ml/min) ou anurie\nHypokaliémie, hyponatrémie ou hypercalcémie réfractaires ; goutte symptomatique\nObstruction biliaire, insuffisance hépatique sévère\nGrossesse (2e et 3e trimestres)\nAssociation à l'aliskiren chez le diabétique ou l'insuffisant rénal", posologie: "1 comprimé par jour", precautions: "Contrôler kaliémie, natrémie et créatinine\nHypotension si déshydratation\nLithium, AINS : surveiller\nPhotosensibilisation (thiazide)", effets: "Vertiges, hypotension\nTroubles électrolytiques\nHausse de l'acide urique et de la glycémie", arguments: "Association de référence de l'hypertension non contrôlée\nLe telmisartan compense la perte de potassium du diurétique\nUne prise par jour", laboratoire: LABO_TROIKAA, sources: "RCP telmisartan/hydrochlorothiazide / Micardisplus (ANSM, VIDAL) ; pharmeasy.in (Telmikaa H 40/12,5)" },
  { gamme: "Telmikaa (telmisartan)", aire: "Hypertension artérielle", produit: "Telmikaa AMH", dci: "Telmisartan 40 mg + amlodipine 5 mg + hydrochlorothiazide 12,5 mg, comprimé", classe: "Antagoniste de l'angiotensine II (ARA II) + inhibiteur calcique + diurétique thiazidique", indications: "Hypertension artérielle non contrôlée par une bithérapie, ou patient déjà équilibré par les trois molécules", contreIndications: "Allergie à l'un des composants ou aux sulfamides\nInsuffisance rénale sévère (clairance < 30 ml/min) ou anurie\nHypokaliémie, hyponatrémie ou hypercalcémie réfractaires ; goutte symptomatique\nInsuffisance hépatique sévère\nHypotension sévère, choc (dont cardiogénique)\nRétrécissement aortique serré ; insuffisance cardiaque instable après infarctus\nGrossesse (2e et 3e trimestres)\nAssociation à l'aliskiren chez le diabétique ou l'insuffisant rénal", posologie: "1 comprimé par jour, à heure fixe\nÀ réserver au patient déjà traité par bithérapie", precautions: "Contrôler kaliémie, natrémie et créatinine\nRisque d'hypotension chez le sujet âgé ou déshydraté\nInhibiteurs du CYP3A4, lithium, AINS : surveiller", effets: "Vertiges, hypotension\nŒdèmes des chevilles\nTroubles électrolytiques", arguments: "Trithérapie recommandée par les sociétés savantes en un seul comprimé\nPour l'hypertension sévère, fréquente en Afrique de l'Ouest\nUne prise par jour : observance nettement meilleure", laboratoire: LABO_TROIKAA, sources: "RCP telmisartan, amlodipine, hydrochlorothiazide (ANSM, VIDAL) ; pharmeasy.in (Telmikaa AMH 40/5/12,5)" },
  { gamme: "Telmikaa (telmisartan)", aire: "Hypertension artérielle", produit: "Telmikaa CT", dci: "Telmisartan 40 mg + chlortalidone 12,5 mg, comprimé", classe: "Antagoniste de l'angiotensine II (ARA II) + diurétique apparenté aux thiazidiques", indications: "Hypertension artérielle essentielle non contrôlée par une monothérapie", contreIndications: "Allergie au telmisartan, à la chlortalidone ou aux sulfamides\nInsuffisance rénale sévère (clairance < 30 ml/min) ou anurie\nHypokaliémie, hyponatrémie ou hypercalcémie réfractaires ; goutte symptomatique\nObstruction biliaire, insuffisance hépatique sévère\nGrossesse (2e et 3e trimestres)\nAssociation à l'aliskiren chez le diabétique ou l'insuffisant rénal", posologie: "1 comprimé par jour, le matin de préférence", precautions: "Contrôler kaliémie, natrémie et créatinine\nHypotension si déshydratation\nLithium, AINS : surveiller", effets: "Vertiges, hypotension\nTroubles électrolytiques (potassium, sodium)\nHausse de l'acide urique", arguments: "La chlortalidone agit plus longtemps que l'hydrochlorothiazide : couverture sur 24 h et au-delà\nDiurétique le mieux documenté sur la prévention des accidents cardiovasculaires\nUne prise par jour", laboratoire: LABO_TROIKAA, sources: "RCP telmisartan et chlortalidone (ANSM, VIDAL) ; pharmeasy.in (Telmikaa CT 40/12,5)" },
  { gamme: 'Rozukaa (rosuvastatine)', aire: 'Cholestérol et risque cardiovasculaire', produit: 'Rozukaa 10', dci: 'Rosuvastatine 10 mg, comprimé',
    classe: 'Hypolipémiant, statine (inhibiteur de l\'HMG-CoA réductase)',
    indications: 'Hypercholestérolémie et dyslipidémie mixte, en complément du régime\nPrévention des événements cardiovasculaires majeurs chez le patient à risque élevé',
    contreIndications: 'Allergie à la rosuvastatine\nMaladie du foie évolutive, transaminases > 3 fois la normale\nInsuffisance rénale sévère (clairance < 30 ml/min)\nMyopathie ; association à la ciclosporine\nGrossesse, allaitement, femme sans contraception efficace',
    posologie: 'Début : 5 à 10 mg par jour, à tout moment de la journée\nAdapter après 4 semaines\nPatient d\'origine asiatique : débuter à 5 mg',
    precautions: 'Douleurs musculaires inexpliquées : doser les CPK\nBilan hépatique avant et pendant le traitement\nGemfibrozil, inhibiteurs de protéase : à éviter ou dose réduite',
    effets: 'Douleurs musculaires\nMaux de tête, douleurs abdominales, constipation\nRare : atteinte musculaire grave (rhabdomyolyse)',
    arguments: 'Statine puissante : baisse importante du LDL-cholestérol dès 10 mg\nPrise à tout moment, 1 fois par jour\nPeu d\'interactions par le CYP3A4',
    laboratoire: LABO_TROIKAA, sources: 'RCP rosuvastatine / Crestor (ANSM, VIDAL) ; 1mg.com (composition Rosukaa)' },
  { gamme: 'Rozukaa (rosuvastatine)', aire: 'Cholestérol et risque cardiovasculaire', produit: 'Rozukaa 20', dci: 'Rosuvastatine 20 mg, comprimé',
    classe: 'Hypolipémiant, statine (inhibiteur de l\'HMG-CoA réductase)',
    indications: 'Hypercholestérolémie et dyslipidémie mixte insuffisamment contrôlées à 10 mg\nPrévention des événements cardiovasculaires majeurs chez le patient à risque élevé',
    contreIndications: 'Allergie à la rosuvastatine\nMaladie du foie évolutive, transaminases > 3 fois la normale\nInsuffisance rénale sévère (clairance < 30 ml/min)\nMyopathie ; association à la ciclosporine\nGrossesse, allaitement, femme sans contraception efficace',
    posologie: '20 mg par jour, après un palier à 10 mg si nécessaire\nPatient d\'origine asiatique : prudence au-delà de 10 mg',
    precautions: 'Douleurs musculaires inexpliquées : doser les CPK\nBilan hépatique\nSujet âgé, insuffisance rénale modérée : prudence',
    effets: 'Douleurs musculaires\nMaux de tête, troubles digestifs\nRare : rhabdomyolyse',
    arguments: 'Statine de haute intensité pour les patients à haut risque\nObjectif de LDL atteint plus souvent\nUne prise par jour, à tout moment',
    laboratoire: LABO_TROIKAA, sources: 'RCP rosuvastatine / Crestor (ANSM, VIDAL) ; 1mg.com (Rosukaa 20)' },
  { gamme: "Rozukaa (rosuvastatine)", aire: "Cholestérol et risque cardiovasculaire", produit: "Rozukaa F", dci: "Rosuvastatine 10 mg + fénofibrate 145 mg, comprimé", classe: "Hypolipémiant, statine (inhibiteur de l'HMG-CoA réductase) + fibrate", indications: "Dyslipidémie mixte (LDL et triglycérides élevés, HDL bas) chez le patient à risque cardiovasculaire, quand la statine seule ne suffit pas", contreIndications: "Allergie à la rosuvastatine ou au fénofibrate\nMaladie du foie évolutive, transaminases > 3 fois la normale\nGrossesse, allaitement, femme sans contraception efficace\nInsuffisance rénale sévère\nMaladie de la vésicule biliaire ; pancréatite\nPhotosensibilisation connue aux fibrates", posologie: "1 comprimé par jour, de préférence au cours d'un repas", precautions: "Douleurs musculaires inexpliquées : doser les CPK\nBilan hépatique avant et pendant le traitement\nAssociation statine + fibrate : surveillance musculaire renforcée, surtout chez le sujet âgé ou l'insuffisant rénal\nAnticoagulants (AVK) : contrôler l'INR", effets: "Douleurs musculaires\nTroubles digestifs\nHausse des transaminases et de la créatinine", arguments: "Traite à la fois le LDL et les triglycérides\nAdapté au diabétique avec triglycérides élevés\nUn seul comprimé par jour", laboratoire: LABO_TROIKAA, sources: "RCP rosuvastatine et fénofibrate (ANSM, VIDAL) ; apollopharmacy.in (Rosukaa F 10/145)" },
  { gamme: "Rozukaa (rosuvastatine)", aire: "Cholestérol et risque cardiovasculaire", produit: "Rozukaa A", dci: "Rosuvastatine 10 ou 20 mg + aspirine 150 mg, gélule", classe: "Hypolipémiant, statine (inhibiteur de l'HMG-CoA réductase) + antiagrégant plaquettaire (aspirine)", indications: "Prévention secondaire chez le patient coronarien ou après AVC ischémique, ayant besoin d'une statine et d'aspirine", contreIndications: "Allergie à la rosuvastatine\nUlcère gastroduodénal évolutif, saignement en cours\nAllergie à l'aspirine ou aux AINS (asthme induit)\nMaladie du foie évolutive, transaminases > 3 fois la normale\nGrossesse, allaitement, femme sans contraception efficace\nInsuffisance rénale sévère", posologie: "1 gélule par jour, après un repas", precautions: "Douleurs musculaires inexpliquées : doser les CPK\nBilan hépatique avant et pendant le traitement\nAnticoagulants, AINS, corticoïdes : risque de saignement\nArrêt avant chirurgie : avis du médecin", effets: "Douleurs musculaires\nBrûlures d'estomac, saignements\nMaux de tête", arguments: "Les deux piliers de la prévention secondaire en une gélule\nMoins de comprimés pour le patient coronarien\nRosuvastatine puissante", laboratoire: LABO_TROIKAA, sources: "RCP rosuvastatine et aspirine (ANSM, VIDAL) ; apollopharmacy.in, netmeds.com (Rosukaa A 10/150 et 20/150)" },
  { gamme: "Rozukaa (rosuvastatine)", aire: "Cholestérol et risque cardiovasculaire", produit: "Rozukaa Gold", dci: "Rosuvastatine 10 mg + aspirine 75 mg + clopidogrel 75 mg, gélule (existe aussi en 20 mg)", classe: "Hypolipémiant, statine (inhibiteur de l'HMG-CoA réductase) + double antiagrégation (aspirine, clopidogrel)", indications: "Patient coronarien ayant besoin d'une double antiagrégation et d'une statine : après syndrome coronarien aigu ou pose de stent", contreIndications: "Allergie à l'un des composants\nUlcère gastroduodénal évolutif, saignement en cours\nAllergie à l'aspirine ou aux AINS (asthme induit)\nMaladie du foie évolutive, transaminases > 3 fois la normale\nGrossesse, allaitement, femme sans contraception efficace\nInsuffisance hépatique sévère", posologie: "1 gélule par jour\nDurée de la double antiagrégation fixée par le cardiologue", precautions: "Douleurs musculaires inexpliquées : doser les CPK\nBilan hépatique avant et pendant le traitement\nÉviter oméprazole et ésoméprazole : préférer un autre IPP\nArrêt 5 à 7 jours avant une chirurgie programmée (avis du cardiologue)\nAnticoagulants, AINS : risque de saignement", effets: "Saignements, hématomes\nTroubles digestifs\nDouleurs musculaires", arguments: "Trois traitements de l'après-stent en une seule gélule\nObservance : l'arrêt prématuré de l'antiagrégation est la première cause de thrombose de stent\nUne prise par jour", laboratoire: LABO_TROIKAA, sources: "RCP rosuvastatine, aspirine, clopidogrel (ANSM, VIDAL) ; netmeds.com, medkart.in (Rosukaa Gold 75/75/10)" },
  { gamme: "Lesskaa (atorvastatine)", aire: "Cholestérol et risque cardiovasculaire", produit: "Lesskaa", dci: "Atorvastatine 10 ou 20 mg, comprimé", classe: "Hypolipémiant, statine (inhibiteur de l'HMG-CoA réductase)", indications: "Hypercholestérolémie et dyslipidémie mixte, en complément du régime\nPrévention des événements cardiovasculaires chez le patient à risque", contreIndications: "Allergie à l'atorvastatine\nMaladie du foie évolutive, transaminases > 3 fois la normale\nGrossesse, allaitement, femme sans contraception efficace", posologie: "10 à 20 mg par jour en une prise, à tout moment de la journée\nAdapter après 4 semaines", precautions: "Inhibiteurs puissants du CYP3A4 : éviter ou réduire la dose\nJus de pamplemousse en grande quantité\nDouleurs musculaires inexpliquées : doser les CPK\nBilan hépatique avant et pendant le traitement", effets: "Douleurs musculaires\nTroubles digestifs, maux de tête\nHausse des transaminases", arguments: "Même molécule que Lesstrol : atorvastatine, statine de référence\nUne prise par jour, à tout moment\nBien toléré aux doses de 10 et 20 mg", laboratoire: LABO_TROIKAA, sources: "RCP atorvastatine / Tahor (ANSM, VIDAL) ; truemeds.in (Lesskaa 10 et 20)" },
  { gamme: "Myonit (trinitrine)", aire: "Angine de poitrine", produit: "Myonit SR", dci: "Trinitrine (nitroglycérine) 2,6 ou 6,4 mg, comprimé à libération prolongée", classe: "Dérivé nitré, vasodilatateur anti-angineux", indications: "Traitement préventif des crises d'angor (angine de poitrine)\nNe traite pas une crise en cours : utiliser un nitré d'action rapide", contreIndications: "Allergie aux dérivés nitrés\nAssociation au sildénafil, tadalafil ou vardénafil (chute de tension grave)\nHypotension sévère, choc\nCardiomyopathie obstructive, rétrécissement aortique serré\nHypertension intracrânienne", posologie: "1 comprimé 2 fois par jour, à avaler sans croquer\nGarder un intervalle libre la nuit pour éviter l'accoutumance", precautions: "Lever progressif : risque d'hypotension orthostatique\nAlcool et autres hypotenseurs : majorent la baisse de tension\nNe pas arrêter brutalement", effets: "Maux de tête (fréquents en début de traitement)\nVertiges, hypotension\nRougeur du visage", arguments: "Forme à libération prolongée : protection sur plusieurs heures avec 2 prises\nComplète le bêtabloquant chez l'angineux encore symptomatique\nAction directe sur la cause de la douleur : dilatation des coronaires", laboratoire: LABO_TROIKAA, sources: "RCP trinitrine LP (ANSM, VIDAL) ; truemeds.in, netmeds.com (Myonit SR 2,6 et 6,4)" },
  { gamme: 'Antiplatt (clopidogrel)', aire: 'Prévention de la thrombose', produit: 'Antiplatt', dci: 'Clopidogrel 75 mg, comprimé',
    classe: 'Antiagrégant plaquettaire (inhibiteur du récepteur P2Y12)',
    indications: 'Prévention des accidents athérothrombotiques après infarctus récent, AVC ischémique récent ou artériopathie des membres inférieurs\nSyndrome coronarien aigu, en association à l\'aspirine (dont pose de stent)',
    contreIndications: 'Allergie au clopidogrel\nSaignement évolutif (ulcère gastroduodénal, hémorragie cérébrale)\nInsuffisance hépatique sévère\nAllaitement',
    posologie: '75 mg par jour en une prise\nSyndrome coronarien aigu : dose de charge de 300 mg puis 75 mg par jour',
    precautions: 'Arrêter 5 à 7 jours avant une chirurgie programmée (avis du cardiologue)\nÉviter oméprazole et ésoméprazole : préférer un autre IPP\nAINS, anticoagulants, antidépresseurs ISRS : risque de saignement',
    effets: 'Saignements, hématomes\nTroubles digestifs\nRare : purpura thrombotique',
    arguments: 'Une prise par jour\nRéférence de la double antiagrégation après stent\nAlternative en cas d\'intolérance à l\'aspirine',
    laboratoire: LABO_TROIKAA, sources: 'RCP clopidogrel / Plavix (ANSM, VIDAL) ; pharmeasy.in (composition Antiplatt)' },
  { gamme: "Antiplatt (clopidogrel)", aire: "Prévention de la thrombose", produit: "Antiplatt Plus", dci: "Clopidogrel 75 mg + aspirine 75 mg, comprimé", classe: "Double antiagrégation plaquettaire (inhibiteur P2Y12 + aspirine)", indications: "Syndrome coronarien aigu, en particulier après pose de stent, quand la double antiagrégation est indiquée\nPatient déjà traité par clopidogrel et aspirine séparément", contreIndications: "Allergie au clopidogrel, à l'aspirine ou aux AINS\nSaignement évolutif (ulcère gastroduodénal, hémorragie cérébrale)\nInsuffisance hépatique ou rénale sévère\nGrossesse à partir du 6e mois ; allaitement", posologie: "1 comprimé par jour\nDébut : dose de charge par clopidogrel et aspirine séparés, puis Antiplatt Plus\nDurée fixée par le cardiologue (souvent 6 à 12 mois)", precautions: "Arrêter 5 à 7 jours avant une chirurgie programmée (avis du cardiologue)\nÉviter oméprazole et ésoméprazole : préférer un autre IPP\nAINS, anticoagulants, antidépresseurs ISRS : risque de saignement", effets: "Saignements, hématomes\nTroubles digestifs\nRare : purpura thrombotique", arguments: "La double antiagrégation de l'après-stent en un seul comprimé\nObservance : l'arrêt prématuré est la première cause de thrombose de stent\nUne prise par jour", laboratoire: LABO_TROIKAA, sources: "RCP clopidogrel/aspirine / DuoPlavin (ANSM, VIDAL) ; truemeds.in (Antiplatt Plus 75/75)" },
  { gamme: "Orlitroy (orlistat)", aire: "Métabolisme et neuropathie", produit: "Orlitroy", dci: "Orlistat 60 ou 120 mg, gélule", classe: "Inhibiteur des lipases digestives (anti-obésité)", indications: "Obésité (IMC ≥ 30) ou surpoids (IMC ≥ 28) avec facteurs de risque (diabète, hypertension, cholestérol), en association à un régime modérément hypocalorique", contreIndications: "Allergie à l'orlistat\nSyndrome de malabsorption chronique\nCholestase\nGrossesse et allaitement", posologie: "1 gélule à chacun des 3 repas principaux contenant des graisses\nSauter la prise si le repas est sauté ou sans graisses\nArrêter si perte de poids < 5 % après 12 semaines", precautions: "Prendre une multivitamine le soir (vitamines A, D, E, K)\nCiclosporine, lévothyroxine, antiépileptiques, anticoagulants : espacer ou surveiller\nRepas trop gras : troubles digestifs", effets: "Selles grasses, urgences pour aller à la selle\nGaz, douleurs abdominales\nBaisse des vitamines liposolubles", arguments: "Agit dans l'intestin, sans effet sur le cerveau ni le cœur\nBloque environ 30 % des graisses du repas\nAide l'hypertendu ou le diabétique en surpoids à atteindre ses objectifs", laboratoire: LABO_TROIKAA, sources: "RCP orlistat / Xenical (ANSM, VIDAL) ; truemeds.in, netmeds.com (Orlitroy 60 et 120)" },
  { gamme: "Troynuron (prégabaline)", aire: "Métabolisme et neuropathie", produit: "Troynuron", dci: "Troynuron (NT) : prégabaline 75 mg + nortriptyline 10 mg + méthylcobalamine 1500 µg, comprimé\nTroynuron SR : complément (méthylcobalamine, acide folique, pyridoxine)", classe: "Traitement de la douleur neuropathique (antiépileptique + antidépresseur tricyclique + vitamine B12) ; SR : complément vitaminique", indications: "Douleurs neuropathiques : neuropathie du diabétique, névralgies, sciatique\nTroynuron SR : carences en vitamines B, anémie, fatigue", contreIndications: "Allergie à l'un des composants\nInfarctus récent, troubles du rythme ou bloc cardiaque (nortriptyline)\nAssociation aux IMAO\nGlaucome à angle fermé, adénome de la prostate avec rétention urinaire", posologie: "1 comprimé le soir au coucher\nAugmentation progressive selon le médecin\nNe pas arrêter brutalement", precautions: "Somnolence, vertiges : prudence pour la conduite\nAlcool, sédatifs, opioïdes : majorent la somnolence\nSujet âgé, insuffisant rénal : adapter (prégabaline éliminée par le rein)\nRisque de mésusage de la prégabaline", effets: "Somnolence, vertiges\nBouche sèche, constipation\nPrise de poids, œdèmes", arguments: "Trois actions complémentaires sur la douleur nerveuse en un comprimé\nPrise le soir : améliore aussi le sommeil\nLa vitamine B12 aide à réparer le nerf", laboratoire: LABO_TROIKAA, sources: "RCP prégabaline / Lyrica et nortriptyline (ANSM, VIDAL) ; 1mg.com (Troynuron 75/10/1500 µg, Troynuron SR)" }
];

// ---------------------------------------------------------------- Comptes rendus de la journée (3.13.0)
// Feuille « Rapports du jour » : une ligne par délégué et par jour (synthèse automatique + saisie du délégué)
var CHAMPS_RAPPORTS = [
  ['delegue', 'Délégué'], ['date', 'Date'], ['valideLe', 'Validé le'], ['prevues', 'Visites prévues'], ['faites', 'Visites faites'],
  ['nonFaites', 'Non faites'], ['sansCr', 'Sans compte rendu'], ['synthese', 'Synthèse'], ['faits', 'Faits marquants'],
  ['concurrence', 'Concurrence'], ['besoins', 'Besoins'], ['km', 'Kilomètres'], ['maj', 'Mise à jour']
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSION_DONNEES: VERSION_DONNEES, JOURS: JOURS, JOURS_CLES: JOURS_CLES, CRENEAUX: CRENEAUX, DISPOS: DISPOS,
    STATUTS_DEFAUT: STATUTS_DEFAUT, CHAMPS_PRATICIENS: CHAMPS_PRATICIENS, CHAMPS_PRESENCES: CHAMPS_PRESENCES,
    CHAMPS_HIST: CHAMPS_HIST, CHAMPS_PLAN: CHAMPS_PLAN, QUARTIERS_DEFAUT: QUARTIERS_DEFAUT,
    REGLAGES_MOTEUR: REGLAGES_MOTEUR, sansAccents: sansAccents, normaliser: normaliser, pad2: pad2,
    isoVersJours: isoVersJours, joursVersIso: joursVersIso, ajouterJours: ajouterJours,
    jourSemaineIndex: jourSemaineIndex, lundiDe: lundiDe, nomJour: nomJour, joursOuvres: joursOuvres,
    joursEcoules: joursEcoules, heureVersMinutes: heureVersMinutes, minutesVersHeure: minutesVersHeure,
    lireHoraire: lireHoraire, horaireNormalise: horaireNormalise, lireDispo: lireDispo, ecrireDispo: ecrireDispo, lireNote: lireNote,
    lettrePotentiel: lettrePotentiel, SPECIALITES_DEFAUT: SPECIALITES_DEFAUT,
    completerDonneesFictives: completerDonneesFictives, hachage: hachage,
    minutesTrajet: minutesTrajet, FERIES_DEFAUT: FERIES_DEFAUT, absentLe: absentLe,
    CHAMPS_PHARMACIES: CHAMPS_PHARMACIES, CHAMPS_ETABLISSEMENTS: CHAMPS_ETABLISSEMENTS, HORAIRES_PHARMACIE: HORAIRES_PHARMACIE, ACTIVITES_DEFAUT: ACTIVITES_DEFAUT, ACTIVITES_RENOMMEES: ACTIVITES_RENOMMEES,
    ACTIVITES_PHARMACIE_DEFAUT: ACTIVITES_PHARMACIE_DEFAUT, STATUTS_RENOMMES: STATUTS_RENOMMES, MOTIFS_MEDECIN: MOTIFS_MEDECIN, MOTIFS_PHARMACIE: MOTIFS_PHARMACIE, PRODUITS_DEFAUT: PRODUITS_DEFAUT, FICHES_PRODUITS_DEFAUT: FICHES_PRODUITS_DEFAUT, CHAMPS_FICHES: CHAMPS_FICHES, CHAMPS_RAPPORTS: CHAMPS_RAPPORTS,
    estConventionne: estConventionne, calcScore: calcScore, distanceKm: distanceKm,
    quartiersDefautObjets: quartiersDefautObjets, creerAlea: creerAlea, genererBaseFictive: genererBaseFictive
  };
}
