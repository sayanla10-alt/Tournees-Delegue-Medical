/* =============================================================================
   commun.js : référentiel, modèle de données et fonctions partagées (version 3)
   Source unique : apps-script/Commun.gs en est la copie exacte, produite par
   « node scripts/commun.js » (contrôle : « node scripts/commun.js --verifier »).
   Ne jamais modifier Commun.gs à la main.

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
  ['territoire', 'Territoire'], ['subdivision', 'Subdivision'], ['secteur', 'Secteur'],
  ['lundi', 'Lundi'], ['mardi', 'Mardi'], ['mercredi', 'Mercredi'], ['jeudi', 'Jeudi'], ['vendredi', 'Vendredi'],
  ['horaireMatin', 'HoraireMatin'], ['horaireSoir', 'HoraireSoir'], ['lat', 'Latitude'], ['lon', 'Longitude'], ['reperes', 'Repères'], ['origineGps', 'OrigineGPS']
];

var CHAMPS_QUARTIERS = [
  ['territoire', 'Territoire'], ['zone', 'Zone'], ['commune', 'Commune'], ['subdivision', 'Subdivision'],
  ['quartier', 'Quartier'], ['secteur', 'Secteur'], ['variantes', 'Variantes'], ['lat', 'Latitude'], ['lon', 'Longitude']
];

// 3.26.54 : règle unique de position d'un lieu. Latitude / longitude lues avec virgule ou point ;
// 0, vide ou hors de la Côte d'Ivoire = pas de position. Renvoie { lat, lon } ou null.
function lireCoord(o) {
  if (!o) return null;
  var la = parseFloat(String(o.lat === undefined || o.lat === null ? '' : o.lat).replace(',', '.')),
      lo = parseFloat(String(o.lon === undefined || o.lon === null ? '' : o.lon).replace(',', '.'));
  if (!isFinite(la) || !isFinite(lo) || la === 0 || lo === 0) return null;
  if (la < 4 || la > 11 || lo < -9 || lo > -2) return null;
  return { lat: la, lon: lo };
}
function aCoord(o) { return !!lireCoord(o); }

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
  ['zone', 'Zone'], ['territoire', 'Territoire'], ['subdivision', 'Subdivision'], ['secteur', 'Secteur'],
  ['lat', 'Latitude'], ['lon', 'Longitude'], ['telephone', 'Téléphone'], ['horaireMatin', 'HoraireMatin'],
  ['horaireSoir', 'HoraireSoir'], ['note', 'Note'], ['conventionne', 'Engagé'], ['derniere', 'DateDerniereVisite'],
  ['statut', 'DernierStatut'], ['commentaire', 'DernierCommentaire'], ['nbVisites', 'NbVisites'], ['actif', 'Actif'],
  ['prochaine', 'ProchaineEtape'], ['source', 'Source'], ['origineGps', 'OrigineGPS']
];

// Répertoire des hôpitaux et établissements de santé (CHU, Cliniques, FSU COM, Centres Médicaux, etc.)
var CHAMPS_ETABLISSEMENTS = [
  ['code', 'CodeEtab'], ['nom', 'Nom'], ['categorie', 'Categorie'], ['commune', 'Commune'],
  ['quartier', 'Quartier'], ['zone', 'Zone'], ['territoire', 'Territoire'], ['subdivision', 'Subdivision'], ['secteur', 'Secteur'],
  ['lat', 'Latitude'], ['lon', 'Longitude'], ['telephone', 'Téléphone'], ['reperes', 'Repères']
];
var HORAIRES_PHARMACIE = ['08:00-12:30', '15:00-20:00'];
var ACTIVITES_DEFAUT = ['Routine', 'Présentation', 'Échantillons', 'Cadeaux', 'EPU', 'Staff', 'Réunion', 'Déjeuner', 'Garde', 'Dépistage', 'Autre'];
var ACTIVITES_PHARMACIE_DEFAUT = ['Routine', 'Présentation', 'Échantillons', 'Cadeaux', 'Stocks', 'Commande', 'MEP', 'Formation', 'Animation', 'Autre'];
// anciens libellés, remplacés automatiquement (base et historique)
var ACTIVITES_RENOMMEES = { 'Visite de routine (rappel)': 'Routine', 'Réunion / staff': 'Réunion', 'Remise d\'échantillons': 'Échantillons',
  'Autre activité': 'Autre', 'Vérification des stocks': 'Stocks', 'Prise de commande': 'Commande', 'Mise en avant / PLV': 'MEP', 'PLV': 'MEP',
  'Formation de l\'équipe officinale': 'Formation', 'Animation promotionnelle': 'Animation', 'Retour ou échange de produits': 'Retour', 'Retour ou échange': 'Retour', 'Présentation produit': 'Présentation' };
var PRODUITS_DEFAUT = [   // 3.26.72 : alignée sur les produits actifs de la base (Fiches produits, Actif = vrai)
  'Zyltan H', 'Zyltan AM', 'Lesstrol 20', 'Lesstrol AM', 'Eurythmic', 'Tensicard',
  'Telmikaa', 'Rozukaa 10', 'Rozukaa 20', 'Antiplatt', 'Myonit SR'
];

// Tournées publiées par les délégués (visibles par toute l'équipe)
var CHAMPS_PLAN = [
  ['delegue', 'Délégué'], ['date', 'Date'], ['heure', 'HeurePrevue'], ['creneau', 'Créneau'],
  ['debut', 'Debut'], ['fin', 'Fin'], ['idPresence', 'IdPresence'], ['code', 'CodeContact'], ['nom', 'Nom'],
  ['specialite', 'Spécialité'], ['note', 'Note'], ['quartier', 'Quartier'], ['commune', 'Commune'],
  ['lieu', 'Lieu/Etablissement'], ['statut', 'Statut'], ['etat', 'Etat'], ['programme', 'Programme'],
  ['maj', 'MiseAJour'], ['uid', 'IdArret'], ['depuis', 'CibleDepuis']
];

// Territoire, Zone, Commune, Subdivision, Quartier, Secteur, Variantes, Latitude, Longitude
// Hiérarchie spatiale complète du Grand Abidjan (subdivisions pour Abobo, Cocody, Yopougon)
var QUARTIERS_DEFAUT = [
  // Abobo (Zone Nord) - 4 subdivisions
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Nord & PK18', 'PK 18', '', 'PK18, Abobo PK18, Abobo Nord', 5.455, -4.050],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Nord & PK18', 'N\'Dotré', '', 'Ndotre, Ndotré', 5.475, -4.045],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Nord & PK18', 'Anonkoua Kouté', '', 'Anonkoua, Anokoi', 5.435, -4.047],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Nord & PK18', 'Belle Ville', '', 'Belleville', 5.460, -4.040],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Nord & PK18', 'Biabou', '', '', 5.435, -4.005],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Nord & PK18', 'Akeikoi', '', 'Akekoi', 5.450, -4.015],

  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Centre & Mairie', 'Samaké', '', 'Samake', 5.4155, -4.0072],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Centre & Mairie', 'Gare', '', 'Abobo Gare', 5.418, -4.020],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Centre & Mairie', 'Mairie', '', 'Abobo Mairie, Abobo Centre', 5.4162, -4.0159],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Centre & Mairie', 'Derrière rails', '', 'Derriere rails, Derriere rail', 5.416, -4.017],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Centre & Mairie', 'Habitat', '', 'Abobo Habitat', 5.422, -4.022],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Centre & Mairie', 'Banco', '', '', 5.410, -4.028],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Centre & Mairie', 'Marché', '', 'Abobo Marche, Grand Marché Abobo', 5.417, -4.021],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Centre & Mairie', 'Gendarmerie', '', 'Abobo Gendarmerie', 5.414, -4.015],

  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Baoulé & Avocatier', 'Abobo Baoulé', '', 'Baoule, Abobo Baoule', 5.431, -3.996],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Baoulé & Avocatier', 'Avocatier', '', '', 5.439, -4.024],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Baoulé & Avocatier', 'Clouetcha', '', '', 5.425, -4.025],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Baoulé & Avocatier', 'Dépôt SOTRA', '', 'Depot SOTRA, SOTRA Abobo', 5.430, -4.030],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Baoulé & Avocatier', 'Abobo-Té', '', 'Abobo Te, Abobote', 5.438, -4.012],

  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Sud & Plaque', 'Plaque 1 & 2', '', 'Plaque, Plaque 1, Plaque 2', 5.405, -4.018],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Sud & Plaque', 'Anador', '', '', 5.410, -4.022],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Sud & Plaque', 'Sagbé', '', 'Sagbe, Abobo Sagbe', 5.408, -4.010],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Sud & Plaque', 'Houphouët-Boigny', '', 'Houphouet Boigny, Abobo Sud', 5.412, -4.015],
  ['Abidjan', 'Zone Nord', 'Abobo', 'Abobo – Sud & Plaque', 'Dokui', '', 'Plateau Dokui', 5.395, -4.010],

  // Cocody (Zone Est) - 4 subdivisions enrichies
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', '', 'Angre', 5.398, -3.985],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', '7e Tranche', '7eme tranche, 7ème tranche, Angré 7e Tranche, 7e & 8e Tranche, 7e et 8e Tranche', 5.388, -3.990],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', '8e Tranche', '8eme tranche, 8ème tranche, Angré 8e Tranche', 5.385, -3.992],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', '9e Tranche', '9eme tranche, 9ème tranche, Angré 9e Tranche', 5.392, -3.986],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', '22e Arrondissement', '22eme arrondissement, 22ème arrondissement, 22e, Angré 22e', 5.394, -3.988],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'CHU Angré', 'CHU d\'Angré, CHU d Angre, Angré CHU, Centre Hospitalier Universitaire d\'Angré', 5.4010, -3.9574],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Djorobité', 'Djorobite, Djorogobité, Djorogobite, Angré Djorobité', 5.415, -3.965],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Djibi', 'Angré Djibi, Djibi 1, Djibi 2', 5.404, -3.968],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Mahou', 'Angré Mahou', 5.390, -3.995],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Château', 'Chateau, Château d\'Eau, Chateau d\'Eau, Angré Château', 5.395, -3.982],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Besakoi', 'Bessakoi, Angré Besakoi', 5.410, -3.970],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'CNPS', 'Angré CNPS, Carrefour CNPS', 5.397, -3.984],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Arcades', 'Les Arcades, Angré Arcades', 5.391, -3.989],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Caféier', 'Cafeier, Caféiers, Les Caféiers, Angré Caféier', 5.396, -3.983],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Petro Ivoire', 'Pétro Ivoire, PetroIvoire, Angré Petro Ivoire', 5.393, -3.987],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Soleil', 'Cité Soleil, Angré Soleil', 5.402, -3.980],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Star', 'Cité Star, Star 1, Star 2, Star 8, Star 9, Angré Star', 5.399, -3.978],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Nouveau Horizon', 'Nouvel Horizon, Angré Nouveau Horizon', 5.400, -3.981],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Angré', 'Angré', 'Oscar', 'Les Oscars, Les Oscards, Angré Oscar', 5.394, -3.985],

  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', '', '2 Plateaux, II Plateaux, 2Pltx', 5.366, -3.998],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', 'Vallons', 'Les Vallons, Deux Plateaux Vallons, 2 Plateaux Vallons', 5.370, -3.990],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', 'Aghien', 'Deux Plateaux Aghien, 2 Plateaux Aghien', 5.375, -3.985],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', 'ENA', 'Deux Plateaux ENA, Carrefour ENA', 5.360, -4.005],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', 'Attoban', 'Deux Plateaux Attoban, 2 Plateaux Attoban', 5.370, -3.965],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', 'Sainte-Cécile', 'Sainte Cécile, Ste Cécile, Ste-Cécile, Deux Plateaux Sainte-Cécile', 5.362, -3.992],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', 'Latrille', 'Boulevard Latrille, Bd Latrille, Deux Plateaux Latrille', 5.368, -4.002],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', 'Palmas', 'Las Palmas, Deux Plateaux Las Palmas', 5.364, -3.996],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Deux Plateaux', 'Deux Plateaux', 'SOCOCE', 'Deux Plateaux SOCOCE, Sococe 2 Plateaux', 5.365, -3.999],

  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', '', 'La Riviera, Riviera 1', 5.355, -3.960],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Riviera 2', 'Riviera II, R2', 5.355, -3.965],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Riviera 3', 'Riviera III, R3, Riviera 4, Riviera IV, CIAD', 5.362, -3.952],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Riviera Golf', 'Golf, Le Golf', 5.336, -3.962],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Palmeraie', 'Riviera Palmeraie, La Palmeraie', 5.373, -3.948],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Faya', 'Riviera Faya, Carrefour Faya', 5.386, -3.925],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Anono', 'Riviera Anono', 5.335, -3.955],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'M\'Badon', 'Mbadon, M\'badon, Riviera M\'Badon', 5.340, -3.935],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Akouédo', 'Akouedo, Riviera Akouédo', 5.365, -3.920],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Abatta', 'Riviera Abatta', 5.370, -3.910],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Bonoumin', 'Riviera Bonoumin', 5.360, -3.960],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Riviera', 'Riviera', 'Cité Marina', 'Cite Marina, Marina, Riviera Cité Marina', 5.358, -3.958],

  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Centre', 'Cocody Centre', '', 'Centre Cocody', 5.342, -3.995],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Centre', 'Cocody Centre', 'Saint-Jean', 'Saint Jean, St Jean, St-Jean', 5.3373, -4.0035],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Centre', 'Cocody Centre', 'Danga', 'Cocody Danga', 5.341, -4.009],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Centre', 'Cocody Centre', 'CHU Cocody', 'CHU de Cocody, Centre Hospitalier Universitaire de Cocody', 5.3444, -3.9939],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Centre', 'Cocody Centre', 'Mermoz', 'Jean Mermoz, Cocody Mermoz', 5.338, -4.005],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Centre', 'Cocody Centre', 'Blockhauss', 'Blokhauss, Blockhaus, Cocody Blockhauss', 5.328, -4.000],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Centre', 'Cocody Centre', 'Ambassades', 'Quartier des Ambassades, Cocody Ambassades', 5.332, -4.010],
  ['Abidjan', 'Zone Est', 'Cocody', 'Cocody – Centre', 'Cocody Centre', 'Vieux Cocody', 'Lycée Technique, Cannebière, Université Cocody', 5.340, -3.998],

  // Yopougon (Zone Ouest) - 4 subdivisions
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Niangon', 'Niangon Nord', '', 'Niangon', 5.335, -4.105],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Niangon', 'Niangon Sud', '', '', 5.325, -4.100],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Niangon', 'Académie', '', 'Academie', 5.320, -4.095],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Niangon', 'Lokoua', '', '', 5.328, -4.090],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Niangon', 'Cité Verte', '', 'Cite Verte', 5.324, -4.090],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Niangon', 'Lubafrique', '', '', 5.322, -4.092],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Niangon', 'Texaco', '', '', 5.326, -4.098],

  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Maroc & Toits Rouges', 'Maroc', '', 'Yopougon Maroc', 5.344, -4.092],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Maroc & Toits Rouges', 'Toits Rouges', '', 'Toit Rouge', 5.351, -4.086],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Maroc & Toits Rouges', 'Bel Air', '', 'Yopougon Bel Air', 5.348, -4.080],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Maroc & Toits Rouges', 'Sideci', '', '', 5.342, -4.082],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Maroc & Toits Rouges', 'Ananeraie', '', '', 5.350, -4.095],

  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Centre & Mairie', 'Siporex', '', '', 5.3556, -4.0792],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Centre & Mairie', 'Mairie', '', 'Yopougon Mairie, Yopougon Centre', 5.3435, -4.0718],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Centre & Mairie', 'CHU Yopougon', '', 'CHU de Yopougon, Quartier Hôpital', 5.3584, -4.0897],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Centre & Mairie', 'Saint-André', '', 'Saint Andre, St André', 5.340, -4.070],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Centre & Mairie', 'Keneya', '', '', 5.343, -4.065],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Centre & Mairie', 'Wassakara', '', '', 5.345, -4.075],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Centre & Mairie', 'Ficgayo', '', '', 5.339, -4.065],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Centre & Mairie', 'Nouveau Bureau', '', '', 5.346, -4.072],

  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Sud & Gesco', 'Port-Bouët 2', '', 'Port Bouet 2', 5.338, -4.062],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Sud & Gesco', 'Selmer', '', '', 5.346, -4.068],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Sud & Gesco', 'Sicogi', '', 'Yopougon Sicogi', 5.336, -4.076],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Sud & Gesco', 'Kouté', '', 'Koute, Yopougon Kouté', 5.330, -4.065],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Sud & Gesco', 'Gesco', '', '', 5.370, -4.110],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Sud & Gesco', 'Zone Industrielle', '', 'Zone Industrielle Yopougon, ZI Yopougon', 5.360, -4.090],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Sud & Gesco', 'Millionnaire', '', '', 5.340, -4.080],
  ['Abidjan', 'Zone Ouest', 'Yopougon', 'Yopougon – Sud & Gesco', 'Sable', '', 'Yopougon Sable', 5.335, -4.075],

  // Autres communes d'Abidjan
  ['Abidjan', 'Zone Centre', 'Plateau', '', 'Plateau Centre', '', '', 5.322, -4.018],
  ['Abidjan', 'Zone Centre', 'Plateau', '', 'Indénié', '', 'Indenie', 5.340, -4.014],

  ['Abidjan', 'Zone Centre', 'Adjamé', '', 'Adjamé Liberté', '', 'Adjame Liberte', 5.357, -4.022],
  ['Abidjan', 'Zone Centre', 'Adjamé', '', 'Williamsville', '', '', 5.374, -4.013],
  ['Abidjan', 'Zone Centre', 'Adjamé', '', '220 Logements', '', '220 Lgtts', 5.363, -4.030],
  ['Abidjan', 'Zone Centre', 'Adjamé', '', 'Paillet', '', '', 5.378, -4.015],
  ['Abidjan', 'Zone Centre', 'Adjamé', '', 'Mirador', '', '', 5.360, -4.025],

  ['Abidjan', 'Zone Centre', 'Attécoubé', '', 'Santé', '', 'Attecoube Sante', 5.338, -4.042],
  ['Abidjan', 'Zone Centre', 'Attécoubé', '', 'Locodjro', '', '', 5.342, -4.058],

  ['Abidjan', 'Zone Sud', 'Treichville', '', 'Arras', '', '', 5.302, -4.011],
  ['Abidjan', 'Zone Sud', 'Treichville', '', 'Avenue 8', '', '', 5.305, -4.008],
  ['Abidjan', 'Zone Sud', 'Treichville', '', 'Biafra', '', '', 5.296, -4.001],

  ['Abidjan', 'Zone Sud', 'Marcory', '', 'Zone 4', '', 'Zone 4C, Marcory Zone 4', 5.289, -3.985],
  ['Abidjan', 'Zone Sud', 'Marcory', '', 'Biétry', '', 'Bietry', 5.278, -3.973],
  ['Abidjan', 'Zone Sud', 'Marcory', '', 'Marcory Résidentiel', '', 'Marcory Residentiel', 5.298, -3.991],
  ['Abidjan', 'Zone Sud', 'Marcory', '', 'Anoumabo', '', '', 5.304, -3.978],

  ['Abidjan', 'Zone Sud', 'Koumassi', '', 'Remblais', '', 'Koumassi Remblais', 5.300, -3.955],
  ['Abidjan', 'Zone Sud', 'Koumassi', '', 'Koumassi Sicogi', '', '', 5.292, -3.944],
  ['Abidjan', 'Zone Sud', 'Koumassi', '', 'Grand Campement', '', '', 5.286, -3.934],

  ['Abidjan', 'Zone Sud', 'Port-Bouët', '', 'Port-Bouët Centre', '', 'Port Bouet Centre', 5.255, -3.930],
  ['Abidjan', 'Zone Sud', 'Port-Bouët', '', 'Vridi', '', 'Vridi Cité', 5.258, -4.002],
  ['Abidjan', 'Zone Sud', 'Port-Bouët', '', 'Gonzagueville', '', '', 5.246, -3.882],

  ['Abidjan', 'Zone Est', 'Bingerville', '', 'Bingerville Centre', '', '', 5.355, -3.886],
  ['Abidjan', 'Zone Est', 'Bingerville', '', 'Akandjé', '', 'Akandje', 5.372, -3.905],

  ['Abidjan', 'Zone Nord', 'Anyama', '', 'Anyama Centre', '', '', 5.495, -4.052],
  ['Abidjan', 'Zone Nord', 'Anyama', '', 'Ebimpé', '', 'Ebimpe', 5.470, -4.075],

  ['Abidjan', 'Zone Ouest', 'Songon', '', 'Songon Agban', '', '', 5.312, -4.255],
  ['Abidjan', 'Zone Ouest', 'Songon', '', "Songon M'Bratté", '', 'Songon Mbratte', 5.330, -4.230]
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
  'cat adjame': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre Antituberculeux d\'Adjamé (CAT)', cat: 'CSU / Dispensaire' },
  'centre antituberculeux': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre Antituberculeux d\'Adjamé (CAT)', cat: 'CSU / Dispensaire' },
  'centre antituberculeux adjame': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre Antituberculeux d\'Adjamé (CAT)', cat: 'CSU / Dispensaire' },
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
  'centre dialyse adjame': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre d\'Hémodialyse HLG Adjamé', cat: 'Centre Médical' },
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
  'hemodialyse adjame': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre d\'Hémodialyse HLG Adjamé', cat: 'Centre Médical' },
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
  'hlg adjame centre d hemodialyse': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Centre d\'Hémodialyse HLG Adjamé', cat: 'Centre Médical' },
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
  'xmed bingerville': { lat: 5.361285, lon: -3.894236, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Centre d\'Excellence Médicale Xmed (Bingerville)', cat: 'Centre Médical' },

  // =============================================================================
  // ÉTABLISSEMENTS DE RÉFÉRENCE DE L'INTÉRIEUR DU PAYS (HORS GRAND ABIDJAN)
  // CHU, CHR, Hôpitaux Généraux et Cliniques des grandes villes et chefs-lieux
  // =============================================================================
  // Bouaké (District de la Vallée du Bandama / Gbêkê)
  'chu de bouake': { lat: 7.698333, lon: -5.035000, commune: 'Bouaké', quartier: 'Kennedy', titre: 'CHU de Bouaké', cat: 'CHU' },
  'chu bouake': { lat: 7.698333, lon: -5.035000, commune: 'Bouaké', quartier: 'Kennedy', titre: 'CHU de Bouaké', cat: 'CHU' },
  'chu de bouake campus 1': { lat: 7.698333, lon: -5.035000, commune: 'Bouaké', quartier: 'Kennedy', titre: 'CHU de Bouaké (Campus 1)', cat: 'CHU' },
  'chu bouake campus 1': { lat: 7.698333, lon: -5.035000, commune: 'Bouaké', quartier: 'Kennedy', titre: 'CHU de Bouaké (Campus 1)', cat: 'CHU' },
  'chu de bouake campus 2': { lat: 7.691667, lon: -5.023333, commune: 'Bouaké', quartier: 'Commerce', titre: 'CHU de Bouaké (Campus 2)', cat: 'CHU' },
  'chu bouake campus 2': { lat: 7.691667, lon: -5.023333, commune: 'Bouaké', quartier: 'Commerce', titre: 'CHU de Bouaké (Campus 2)', cat: 'CHU' },
  'chr de bouake': { lat: 7.688889, lon: -5.025000, commune: 'Bouaké', quartier: 'Commerce', titre: 'CHR de Bouaké', cat: 'CHR' },
  'chr bouake': { lat: 7.688889, lon: -5.025000, commune: 'Bouaké', quartier: 'Commerce', titre: 'CHR de Bouaké', cat: 'CHR' },
  'hopital general de bouake': { lat: 7.688889, lon: -5.025000, commune: 'Bouaké', quartier: 'Commerce', titre: 'Hôpital Général de Bouaké', cat: 'Hôpital Public' },
  'clinique de la paix bouake': { lat: 7.695000, lon: -5.032000, commune: 'Bouaké', quartier: 'Air France', titre: 'Clinique de la Paix (Bouaké)', cat: 'Clinique Privée' },
  'clinique sainte marie bouake': { lat: 7.692000, lon: -5.028000, commune: 'Bouaké', quartier: 'Commerce', titre: 'Clinique Sainte-Marie (Bouaké)', cat: 'Clinique Privée' },

  // Yamoussoukro (District Autonome de Yamoussoukro)
  'chr de yamoussoukro': { lat: 6.818889, lon: -5.275000, commune: 'Yamoussoukro', quartier: 'Habitat', titre: 'CHR de Yamoussoukro', cat: 'CHR' },
  'chr yamoussoukro': { lat: 6.818889, lon: -5.275000, commune: 'Yamoussoukro', quartier: 'Habitat', titre: 'CHR de Yamoussoukro', cat: 'CHR' },
  'hopital saint joseph moscati': { lat: 6.861700, lon: -5.244300, commune: 'Yamoussoukro', quartier: 'Basilique', titre: 'Hôpital Catholique Saint Joseph Moscati', cat: 'Hôpital Public' },
  'hopital moscati': { lat: 6.861700, lon: -5.244300, commune: 'Yamoussoukro', quartier: 'Basilique', titre: 'Hôpital Catholique Saint Joseph Moscati', cat: 'Hôpital Public' },
  'hopital saint joseph moscati yamoussoukro': { lat: 6.861700, lon: -5.244300, commune: 'Yamoussoukro', quartier: 'Basilique', titre: 'Hôpital Catholique Saint Joseph Moscati', cat: 'Hôpital Public' },
  'clinique saint roch yamoussoukro': { lat: 6.815000, lon: -5.279000, commune: 'Yamoussoukro', quartier: 'Centre', titre: 'Clinique Saint-Roch (Yamoussoukro)', cat: 'Clinique Privée' },

  // Daloa (District du Sassandra-Marahoué / Haut-Sassandra)
  'chr de daloa': { lat: 6.883333, lon: -6.450000, commune: 'Daloa', quartier: 'Centre', titre: 'CHR de Daloa', cat: 'CHR' },
  'chr daloa': { lat: 6.883333, lon: -6.450000, commune: 'Daloa', quartier: 'Centre', titre: 'CHR de Daloa', cat: 'CHR' },
  'hopital general de daloa': { lat: 6.883333, lon: -6.450000, commune: 'Daloa', quartier: 'Centre', titre: 'CHR de Daloa', cat: 'CHR' },

  // San-Pédro (District du Bas-Sassandra / San-Pédro)
  'chr de san pedro': { lat: 4.755000, lon: -6.640000, commune: 'San-Pédro', quartier: 'Bardot', titre: 'CHR de San-Pédro', cat: 'CHR' },
  'chr san pedro': { lat: 4.755000, lon: -6.640000, commune: 'San-Pédro', quartier: 'Bardot', titre: 'CHR de San-Pédro', cat: 'CHR' },
  'polyclinique de san pedro': { lat: 4.748000, lon: -6.636000, commune: 'San-Pédro', quartier: 'Cité', titre: 'Polyclinique de San-Pédro', cat: 'Polyclinique' },
  'polyclinique san pedro': { lat: 4.748000, lon: -6.636000, commune: 'San-Pédro', quartier: 'Cité', titre: 'Polyclinique de San-Pédro', cat: 'Polyclinique' },

  // Korhogo (District des Savanes / Poro)
  'chr de korhogo': { lat: 9.458000, lon: -5.629600, commune: 'Korhogo', quartier: 'Centre', titre: 'CHR de Korhogo', cat: 'CHR' },
  'chr korhogo': { lat: 9.458000, lon: -5.629600, commune: 'Korhogo', quartier: 'Centre', titre: 'CHR de Korhogo', cat: 'CHR' },
  'chu de korhogo': { lat: 9.458000, lon: -5.629600, commune: 'Korhogo', quartier: 'Centre', titre: 'CHU de Korhogo', cat: 'CHU' },
  'chu korhogo': { lat: 9.458000, lon: -5.629600, commune: 'Korhogo', quartier: 'Centre', titre: 'CHU de Korhogo', cat: 'CHU' },

  // Man (District des Montagnes / Tonkpi)
  'chr de man': { lat: 7.412500, lon: -7.553800, commune: 'Man', quartier: 'Centre', titre: 'CHR de Man', cat: 'CHR' },
  'chr man': { lat: 7.412500, lon: -7.553800, commune: 'Man', quartier: 'Centre', titre: 'CHR de Man', cat: 'CHR' },
  'chu de man': { lat: 7.412500, lon: -7.553800, commune: 'Man', quartier: 'Centre', titre: 'CHR / CHU de Man', cat: 'CHU' },

  // Gagnoa (District du Gôh-Djiboua / Gôh)
  'chr de gagnoa': { lat: 6.131900, lon: -5.950600, commune: 'Gagnoa', quartier: 'Centre', titre: 'CHR de Gagnoa', cat: 'CHR' },
  'chr gagnoa': { lat: 6.131900, lon: -5.950600, commune: 'Gagnoa', quartier: 'Centre', titre: 'CHR de Gagnoa', cat: 'CHR' },

  // Soubré (District du Bas-Sassandra / Nawa)
  'chr de soubre': { lat: 5.785600, lon: -6.608300, commune: 'Soubré', quartier: 'Centre', titre: 'CHR de Soubré', cat: 'CHR' },
  'chr soubre': { lat: 5.785600, lon: -6.608300, commune: 'Soubré', quartier: 'Centre', titre: 'CHR de Soubré', cat: 'CHR' },

  // Abengourou (District de la Comoé / Indénié-Djuablin)
  'chr d abengourou': { lat: 6.729700, lon: -3.496400, commune: 'Abengourou', quartier: 'Centre', titre: 'CHR d\'Abengourou', cat: 'CHR' },
  'chr abengourou': { lat: 6.729700, lon: -3.496400, commune: 'Abengourou', quartier: 'Centre', titre: 'CHR d\'Abengourou', cat: 'CHR' },

  // Agboville (District des Lagunes / Agnéby-Tiassa)
  'chr d agboville': { lat: 5.928100, lon: -4.213300, commune: 'Agboville', quartier: 'Centre', titre: 'CHR d\'Agboville', cat: 'CHR' },
  'chr agboville': { lat: 5.928100, lon: -4.213300, commune: 'Agboville', quartier: 'Centre', titre: 'CHR d\'Agboville', cat: 'CHR' },

  // Grand-Bassam (District de la Comoé / Sud-Comoé)
  'hopital general de grand bassam': { lat: 5.211800, lon: -3.738800, commune: 'Grand-Bassam', quartier: 'France', titre: 'Hôpital Général de Grand-Bassam', cat: 'Hôpital Public' },
  'hopital general grand bassam': { lat: 5.211800, lon: -3.738800, commune: 'Grand-Bassam', quartier: 'France', titre: 'Hôpital Général de Grand-Bassam', cat: 'Hôpital Public' },

  // Dabou (District des Lagunes / Grands-Ponts)
  'hopital general de dabou': { lat: 5.325600, lon: -4.376700, commune: 'Dabou', quartier: 'Centre', titre: 'Hôpital Général de Dabou', cat: 'Hôpital Public' },
  'hopital general dabou': { lat: 5.325600, lon: -4.376700, commune: 'Dabou', quartier: 'Centre', titre: 'Hôpital Général de Dabou', cat: 'Hôpital Public' },
  'hopital methodiste de dabou': { lat: 5.328000, lon: -4.380000, commune: 'Dabou', quartier: 'Centre', titre: 'Hôpital Protestant Méthodiste de Dabou', cat: 'Hôpital Public' },

  // Divo (District du Gôh-Djiboua / Lôh-Djiboua)
  'chr de divo': { lat: 5.837200, lon: -5.357200, commune: 'Divo', quartier: 'Centre', titre: 'CHR de Divo', cat: 'CHR' },
  'chr divo': { lat: 5.837200, lon: -5.357200, commune: 'Divo', quartier: 'Centre', titre: 'CHR de Divo', cat: 'CHR' },

  // Bondoukou (District du Zanzan / Gontougo)
  'chr de bondoukou': { lat: 8.033300, lon: -2.800000, commune: 'Bondoukou', quartier: 'Centre', titre: 'CHR de Bondoukou', cat: 'CHR' },
  'chr bondoukou': { lat: 8.033300, lon: -2.800000, commune: 'Bondoukou', quartier: 'Centre', titre: 'CHR de Bondoukou', cat: 'CHR' },

  // Ferkessédougou (District des Savanes / Tchologo)
  'hopital general de ferkessedougou': { lat: 9.600000, lon: -5.200000, commune: 'Ferkessédougou', quartier: 'Centre', titre: 'Hôpital Général de Ferkessédougou', cat: 'Hôpital Public' },
  'hopital general ferkessedougou': { lat: 9.600000, lon: -5.200000, commune: 'Ferkessédougou', quartier: 'Centre', titre: 'Hôpital Général de Ferkessédougou', cat: 'Hôpital Public' },
  'hopital baptiste de ferkessedougou': { lat: 9.600000, lon: -5.200000, commune: 'Ferkessédougou', quartier: 'Centre', titre: 'Hôpital Protestant Baptiste de Ferké', cat: 'Hôpital Public' },

  // Odienné (District du Denguélé / Kabadougou)
  'chr d odienne': { lat: 9.505100, lon: -7.564300, commune: 'Odienné', quartier: 'Centre', titre: 'CHR d\'Odienné', cat: 'CHR' },
  'chr odienne': { lat: 9.505100, lon: -7.564300, commune: 'Odienné', quartier: 'Centre', titre: 'CHR d\'Odienné', cat: 'CHR' },

  // Séguéla (District du Woroba / Worodougou)
  'chr de seguela': { lat: 7.961100, lon: -6.673100, commune: 'Séguéla', quartier: 'Centre', titre: 'CHR de Séguéla', cat: 'CHR' },
  'chr seguela': { lat: 7.961100, lon: -6.673100, commune: 'Séguéla', quartier: 'Centre', titre: 'CHR de Séguéla', cat: 'CHR' },

  // Daoukro (District des Lacs / Iffou)
  'hopital general de daoukro': { lat: 7.059200, lon: -3.963100, commune: 'Daoukro', quartier: 'Centre', titre: 'Hôpital Général de Daoukro', cat: 'Hôpital Public' },
  'hopital general daoukro': { lat: 7.059200, lon: -3.963100, commune: 'Daoukro', quartier: 'Centre', titre: 'Hôpital Général de Daoukro', cat: 'Hôpital Public' },

  // Aboisso (District de la Comoé / Sud-Comoé)
  'chr d aboisso': { lat: 5.467800, lon: -3.207200, commune: 'Aboisso', quartier: 'Centre', titre: 'CHR d\'Aboisso', cat: 'CHR' },
  'chr aboisso': { lat: 5.467800, lon: -3.207200, commune: 'Aboisso', quartier: 'Centre', titre: 'CHR d\'Aboisso', cat: 'CHR' },

  // Adzopé (District des Lagunes / La Mé)
  'chr d adzope': { lat: 6.106900, lon: -3.861900, commune: 'Adzopé', quartier: 'Centre', titre: 'CHR d\'Adzopé', cat: 'CHR' },
  'chr adzope': { lat: 6.106900, lon: -3.861900, commune: 'Adzopé', quartier: 'Centre', titre: 'CHR d\'Adzopé', cat: 'CHR' },

  // Guiglo (District des Montagnes / Cavally)
  'chr de guiglo': { lat: 6.543600, lon: -7.493100, commune: 'Guiglo', quartier: 'Centre', titre: 'CHR de Guiglo', cat: 'CHR' },
  'chr guiglo': { lat: 6.543600, lon: -7.493100, commune: 'Guiglo', quartier: 'Centre', titre: 'CHR de Guiglo', cat: 'CHR' },

  // Katiola (District de la Vallée du Bandama / Hambol)
  'hopital general de katiola': { lat: 8.137200, lon: -5.100800, commune: 'Katiola', quartier: 'Centre', titre: 'Hôpital Général de Katiola', cat: 'Hôpital Public' },

  // Dimbokro (District des Lacs / N'Zi)
  'hopital general de dimbokro': { lat: 6.646700, lon: -4.705300, commune: 'Dimbokro', quartier: 'Centre', titre: 'Hôpital Général de Dimbokro', cat: 'Hôpital Public' },

  // Bouaflé (District du Sassandra-Marahoué / Marahoué)
  'chr de bouafle': { lat: 6.990300, lon: -5.744200, commune: 'Bouaflé', quartier: 'Centre', titre: 'CHR de Bouaflé', cat: 'CHR' },
  'chr bouafle': { lat: 6.990300, lon: -5.744200, commune: 'Bouaflé', quartier: 'Centre', titre: 'CHR de Bouaflé', cat: 'CHR' },

  // Tiassalé (District des Lagunes / Agnéby-Tiassa)
  'hopital general de tiassale': { lat: 5.898300, lon: -4.822800, commune: 'Tiassalé', quartier: 'Centre', titre: 'Hôpital Général de Tiassalé', cat: 'Hôpital Public' }
};

}

// ---------------------------------------------------------------- Villes et Communes de l'Intérieur de Côte d'Ivoire (Hors Grand Abidjan)
// 3.31.18 : Référentiel des centroïdes géographiques précis pour les villes et chefs-lieux de l'intérieur
var COMMUNES_GRAND_ABIDJAN = [
  'Abobo', 'Adjamé', 'Attécoubé', 'Cocody', 'Koumassi', 'Marcory',
  'Plateau', 'Port-Bouët', 'Treichville', 'Yopougon', 'Bingerville', 'Anyama', 'Songon'
];

var VILLES_INTERIEUR_CI = {
  'bouake': { nom: 'Bouaké', lat: 7.69385, lon: -5.03031, zone: 'Zone Intérieur' },
  'yamoussoukro': { nom: 'Yamoussoukro', lat: 6.82055, lon: -5.27674, zone: 'Zone Intérieur' },
  'daloa': { nom: 'Daloa', lat: 6.87735, lon: -6.45022, zone: 'Zone Intérieur' },
  'san-pedro': { nom: 'San-Pédro', lat: 4.74851, lon: -6.63630, zone: 'Zone Intérieur' },
  'san pedro': { nom: 'San-Pédro', lat: 4.74851, lon: -6.63630, zone: 'Zone Intérieur' },
  'korhogo': { nom: 'Korhogo', lat: 9.45803, lon: -5.62961, zone: 'Zone Intérieur' },
  'man': { nom: 'Man', lat: 7.41251, lon: -7.55383, zone: 'Zone Intérieur' },
  'gagnoa': { nom: 'Gagnoa', lat: 6.13193, lon: -5.95060, zone: 'Zone Intérieur' },
  'soubre': { nom: 'Soubré', lat: 5.78556, lon: -6.60833, zone: 'Zone Intérieur' },
  'abengourou': { nom: 'Abengourou', lat: 6.72972, lon: -3.49639, zone: 'Zone Intérieur' },
  'agboville': { nom: 'Agboville', lat: 5.92806, lon: -4.21333, zone: 'Zone Intérieur' },
  'grand-bassam': { nom: 'Grand-Bassam', lat: 5.21180, lon: -3.73884, zone: 'Zone Intérieur' },
  'grand bassam': { nom: 'Grand-Bassam', lat: 5.21180, lon: -3.73884, zone: 'Zone Intérieur' },
  'dabou': { nom: 'Dabou', lat: 5.32556, lon: -4.37667, zone: 'Zone Intérieur' },
  'divo': { nom: 'Divo', lat: 5.83722, lon: -5.35722, zone: 'Zone Intérieur' },
  'bondoukou': { nom: 'Bondoukou', lat: 8.03333, lon: -2.80000, zone: 'Zone Intérieur' },
  'ferkessedougou': { nom: 'Ferkessédougou', lat: 9.60000, lon: -5.20000, zone: 'Zone Intérieur' },
  'ferke': { nom: 'Ferkessédougou', lat: 9.60000, lon: -5.20000, zone: 'Zone Intérieur' },
  'odienne': { nom: 'Odienné', lat: 9.50511, lon: -7.56433, zone: 'Zone Intérieur' },
  'seguela': { nom: 'Séguéla', lat: 7.96111, lon: -6.67306, zone: 'Zone Intérieur' },
  'daoukro': { nom: 'Daoukro', lat: 7.05917, lon: -3.96306, zone: 'Zone Intérieur' },
  'aboisso': { nom: 'Aboisso', lat: 5.46778, lon: -3.20722, zone: 'Zone Intérieur' },
  'adzope': { nom: 'Adzopé', lat: 6.10694, lon: -3.86194, zone: 'Zone Intérieur' },
  'guiglo': { nom: 'Guiglo', lat: 6.54361, lon: -7.49306, zone: 'Zone Intérieur' },
  'touba': { nom: 'Touba', lat: 8.28333, lon: -7.68333, zone: 'Zone Intérieur' },
  'boundiali': { nom: 'Boundiali', lat: 9.52167, lon: -6.48694, zone: 'Zone Intérieur' },
  'katiola': { nom: 'Katiola', lat: 8.13722, lon: -5.10083, zone: 'Zone Intérieur' },
  'duekoue': { nom: 'Duékoué', lat: 6.74194, lon: -7.34972, zone: 'Zone Intérieur' },
  'dimbokro': { nom: 'Dimbokro', lat: 6.64667, lon: -4.70528, zone: 'Zone Intérieur' },
  'issia': { nom: 'Issia', lat: 6.49222, lon: -6.58556, zone: 'Zone Intérieur' },
  'sinfra': { nom: 'Sinfra', lat: 6.62111, lon: -5.91139, zone: 'Zone Intérieur' },
  'bouafle': { nom: 'Bouaflé', lat: 6.99028, lon: -5.74417, zone: 'Zone Intérieur' },
  'tiassale': { nom: 'Tiassalé', lat: 5.89833, lon: -4.82278, zone: 'Zone Intérieur' },
  'oume': { nom: 'Oumé', lat: 6.53306, lon: -5.51694, zone: 'Zone Intérieur' },
  'bonoua': { nom: 'Bonoua', lat: 5.27000, lon: -3.59500, zone: 'Zone Intérieur' },
  'bouna': { nom: 'Bouna', lat: 9.26667, lon: -2.99972, zone: 'Zone Intérieur' },
  'tingrela': { nom: 'Tengréla', lat: 10.48333, lon: -6.41667, zone: 'Zone Intérieur' },
  'tengrela': { nom: 'Tengréla', lat: 10.48333, lon: -6.41667, zone: 'Zone Intérieur' },
  'mankono': { nom: 'Mankono', lat: 8.05861, lon: -6.18972, zone: 'Zone Intérieur' },
  'vavoua': { nom: 'Vavoua', lat: 7.38194, lon: -6.47778, zone: 'Zone Intérieur' },
  'sassandra': { nom: 'Sassandra', lat: 4.95389, lon: -6.08444, zone: 'Zone Intérieur' },
  'tabou': { nom: 'Tabou', lat: 4.42278, lon: -7.35278, zone: 'Zone Intérieur' },
  'akoupe': { nom: 'Akoupé', lat: 6.38417, lon: -3.89556, zone: 'Zone Intérieur' },
  'arrah': { nom: 'Arrah', lat: 6.67361, lon: -3.96944, zone: 'Zone Intérieur' },
  'bongouanou': { nom: 'Bongouanou', lat: 6.65167, lon: -4.19972, zone: 'Zone Intérieur' },
  'tanda': { nom: 'Tanda', lat: 7.80333, lon: -3.16833, zone: 'Zone Intérieur' },
  'agnibilekrou': { nom: 'Agnibilékrou', lat: 7.13111, lon: -3.20417, zone: 'Zone Intérieur' },
  'beoumi': { nom: 'Béoumi', lat: 7.67389, lon: -5.58083, zone: 'Zone Intérieur' },
  'sakassou': { nom: 'Sakassou', lat: 7.45472, lon: -5.29278, zone: 'Zone Intérieur' }
};

var ZONE_COMMUNE_ABIDJAN = {
  abobo: 'Zone Nord', anyama: 'Zone Nord',
  adjame: 'Zone Centre', attecoube: 'Zone Centre', plateau: 'Zone Centre',
  cocody: 'Zone Est', bingerville: 'Zone Est', brofodoume: 'Zone Est',
  koumassi: 'Zone Sud', marcory: 'Zone Sud', portbouet: 'Zone Sud', treichville: 'Zone Sud',
  yopougon: 'Zone Ouest', songon: 'Zone Ouest'
};

function estCommuneGrandAbidjan(c) {
  if (!c) return false;
  var s = sansAccents(String(c)).toLowerCase().trim();
  return /^(abobo|adjame|attecoube|cocody|koumassi|marcory|plateau|port[- ]bouet|treichville|yopougon|bingerville|anyama|songon|brofodoume)\b/i.test(s);
}

function estCommuneInterieur(c) {
  if (!c) return false;
  var s = sansAccents(String(c)).toLowerCase().trim();
  if (!s || s === 'abidjan' || estCommuneGrandAbidjan(s)) return false;
  return true;
}

function estTerritoireInterieur(v) {
  if (!v) return false;
  if (typeof v === 'string') {
    var sn = normaliser(v);
    if (!sn) return false;
    if (sn === 'interieur' || sn === 'zoneinterieur' || sn.indexOf('interieur') >= 0) return true;
    if (sn === 'abidjan' || estCommuneGrandAbidjan(v)) return false;
    return !!centroideVilleInterieur(v);
  }
  if (typeof v === 'object') {
    var t = v.territoire ? normaliser(v.territoire) : '';
    if (t === 'interieur' || t === 'zoneinterieur' || t.indexOf('interieur') >= 0) return true;
    if (t === 'abidjan') return false;
    var z = v.zone ? normaliser(v.zone) : '';
    if (z && (z === 'interieur' || z === 'zoneinterieur' || z.indexOf('interieur') >= 0)) return true;
    if (v.commune) {
      if (estCommuneGrandAbidjan(v.commune)) return false;
      if (estCommuneInterieur(v.commune)) return true;
    }
  }
  return false;
}

function estCoordonneeAbidjan(c) {
  if (!c || !isFinite(c.lat) || !isFinite(c.lon)) return false;
  return c.lat >= 5.15 && c.lat <= 5.58 && c.lon >= -4.35 && c.lon <= -3.75;
}

function centroideVilleInterieur(nom) {
  if (!nom) return null;
  var k = sansAccents(String(nom)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!k) return null;
  if (VILLES_INTERIEUR_CI[k]) return VILLES_INTERIEUR_CI[k];
  var mots = k.split(/\s+/);
  for (var i = 0; i < mots.length; i++) {
    var m = mots[i];
    if (m.length >= 3 && VILLES_INTERIEUR_CI[m]) return VILLES_INTERIEUR_CI[m];
  }
  return null;
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
  detourRoutier: 1.6,          // coefficient fixe vol d'oiseau -> distance réelle estimée (x 1,6)
  minutesParKm: 3,             // vitesse moyenne en ville (~20 km/h, trafic d'Abidjan)
  facteurPointe: 1.6,          // trajets plus lents aux heures de pointe
  heuresPointe: [[420, 570], [990, 1170]],   // 7:00-9:30 et 16:30-19:30
  minutesPont: 20,             // traversée de la lagune hors pointe (Plateau / Treichville / Marcory)
  minutesPontPointe: 45,       // 3.27.47 : traversée de la lagune aux heures de pointe (7h30-9h30 et 16h30-19h30)
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
// 3.29.0 : numéro d'un code (MED-007, MED-1000) : 3 chiffres au moins, jamais tronqué au-delà de 999
function numeroCode(n) { n = Math.max(0, Math.floor(+n || 0)); return n < 1000 ? ('00' + n).slice(-3) : String(n); }


// 3.27.26 : spécialité canonique (« Médecine générale », « Médecin généraliste », « MG » -> « Généraliste »)
// 3.29.0 : une seule écriture par spécialité : discipline (« Cardiologie »), abréviation (« Cardio ») ou autre casse ramenées
// au nom du praticien de la liste de référence (« Cardiologue ») ; une spécialité inconnue est gardée telle quelle
var SPECIALITES_SYNONYMES = {
  cardio: 'Cardiologue', cardiologie: 'Cardiologue', neuro: 'Neurologue', neurologie: 'Neurologue', pneumo: 'Pneumologue', pneumologie: 'Pneumologue',
  nephro: 'Néphrologue', nephrologie: 'Néphrologue', endocrino: 'Endocrinologue', endocrinologie: 'Endocrinologue', diabeto: 'Diabétologue', diabetologie: 'Diabétologue',
  gyneco: 'Gynécologue', gynecologie: 'Gynécologue', gynecologueobstetricien: 'Gynécologue', dermato: 'Dermatologue', dermatologie: 'Dermatologue',
  rhumato: 'Rhumatologue', rhumatologie: 'Rhumatologue', gastro: 'Gastro-entérologue', gastroenterologie: 'Gastro-entérologue', gastroenterologue: 'Gastro-entérologue',
  infectio: 'Infectiologue', infectiologie: 'Infectiologue', ophtalmo: 'Ophtalmologue', ophtalmologie: 'Ophtalmologue', pedia: 'Pédiatre', pediatrie: 'Pédiatre',
  medecineinterne: 'Interniste', interne: 'Interniste', psychiatrie: 'Psychiatre', urologie: 'Urologue', chirurgie: 'Chirurgien',
  // 3.29.0 : infirmier ou sage-femme sans service précis : classé avec les généralistes (MG)
  infirmier: 'Généraliste', infirmiere: 'Généraliste', ide: 'Généraliste', sagefemme: 'Généraliste'
};
function specialiteCanonique(s) {
  var t = String(s || '').trim().replace(/\s+/g, ' '), k = normaliser(t);
  if (!k) return t;
  if (/^(medecinegenerale|medecingeneraliste|generaliste|mg|medecingeneral)$/.test(k)) return 'Généraliste';
  if (SPECIALITES_SYNONYMES[k]) return SPECIALITES_SYNONYMES[k];
  for (var i = 0; i < SPECIALITES_DEFAUT.length; i++) if (normaliser(SPECIALITES_DEFAUT[i]) === k) return SPECIALITES_DEFAUT[i];
  return t;
}

// 3.27.18 : abréviations courantes des noms d'établissements (2 Pltx = Deux Plateaux, St = Saint, CSU-COM = CSU Com)
function abregesEtab(s) {
  return (' ' + String(s || '').replace(/[-\/'’().,]/g, ' ') + ' ')
    .replace(/\s+/g, ' ')
    .replace(/ 2 /g, ' deux ')
    .replace(/ (pltx|plts|plx|plat|plateau) /g, ' plateaux ')
    .replace(/ ste /g, ' sainte ').replace(/ st /g, ' saint ')
    .replace(/ (csu ?com|csucom) /g, ' csucom ').replace(/ (fsu ?com|fsucom) /g, ' fsucom ')
    .replace(/\s+/g, ' ').trim();
}
// Clé d'un établissement : sans accents, sans abréviations, sans mots génériques ni espaces
function cleEtablissement(s) {
  var t = abregesEtab(sansAccents(String(s || '')).toLowerCase());
  return (' ' + t + ' ').replace(/ (de|du|des|d|l|le|la|les|et|au|aux|centre|medical|medicale|polyclinique|clinique|hopital|cabinet|sante|urbain|communautaire) /g, ' ')
    .replace(/ (de|du|des|d|l|le|la|les|et|au|aux) /g, ' ').replace(/[^a-z0-9]/g, '');
}

// 3.26.9 : Détection intelligente d'un même établissement (CHU, cliniques, hôpitaux avec variantes d'écriture)
function memeEtablissement(a, b) {
  if (!a || !b) return false;
  var sa = sansAccents(String(a)).toLowerCase().trim();
  var sb = sansAccents(String(b)).toLowerCase().trim();
  if (sa === sb) return true;

  function nettoyerEtab(s) {
    return abregesEtab(s)
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
  var m = typeof iso === 'string' ? iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) return NaN;
  var y = +m[1], mo = +m[2], da = +m[3];
  var t = Date.UTC(y, mo - 1, da);
  var d = new Date(t);
  if (d.getUTCFullYear() !== y || d.getUTCMonth() + 1 !== mo || d.getUTCDate() !== da) return NaN;
  return Math.round(t / 86400000);
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
  return !isFinite(n) ? 365 : (n < 0 ? 0 : n);
}

// ---------------------------------------------------------------- Heures
// "08:30", "8h30", "8" -> minutes depuis minuit (null si vide ou illisible)
function heureVersMinutes(h) {
  if (h === null || h === undefined || h === '') return null;
  var s = String(h).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}[Tt]/.test(s)) s = s.slice(s.search(/[Tt]/) + 1);
  else if (/^[Tt]\d{1,2}:/.test(s)) s = s.slice(1);
  var m = s.match(/^\s*(\d{1,2})(?:\s*(?:[:hH]\s*(\d{2})|[hH]))?(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:?\d{2})?\s*$/);
  if (!m) return null;
  var hh = +m[1], mm = m[2] !== undefined ? +m[2] : 0;
  if (hh < 0 || hh >= 24 || mm < 0 || mm >= 60) return null;
  return hh * 60 + mm;
}
function minutesVersHeure(m) {
  if (m === null || m === undefined || m === '' || typeof m === 'boolean') return '';
  m = Math.round(Number(m));
  if (!isFinite(m) || m < 0) return '';
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
  var raw = sansAccents(String(v === undefined || v === null ? '' : v)).toLowerCase().trim();
  var t = normaliser(raw);
  if (!t || t === 'non' || t === 'absent' || t === '0') return { matin: false, soir: false };
  if (t === 'x' || t === 'oui' || t === 'journee' || t === 'tous' || t === 'ms' || t === 'sm' || t === 'mets' || t === 'setm') return { matin: true, soir: true };
  var toks = raw.split(/[^a-z0-9]+/).filter(Boolean);
  var matin = t.indexOf('matin') >= 0 || t === 'm' || (t.charAt(0) === 'm' && t.length <= 2) || toks.indexOf('m') >= 0;
  var soir = t.indexOf('soir') >= 0 || t.indexOf('apres') >= 0 || t === 's' || /^m.?s$/.test(t) || toks.indexOf('s') >= 0;
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
  var pointe = R.heuresPointe.some(function (p) { return minuteDepart !== null && minuteDepart >= p[0] && minuteDepart <= p[1]; });
  if (pointe) t *= R.facteurPointe;
  var sudA = R.communesSud.indexOf(communeA) >= 0, sudB = R.communesSud.indexOf(communeB) >= 0;
  if (communeA && communeB && sudA !== sudB) {
    t += pointe ? (R.minutesPontPointe || 45) : (R.minutesPont || 20);
  }
  return Math.round(t);
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

// 3.31.18 : distance à vol d'oiseau en km (Haversine, sans coefficient de détour routier)
// Plus aucun plafonnement artificiel à 99 km : les distances réelles de l'intérieur (ex: Abidjan - Bouaké ~348 km)
// sont fidèlement calculées et affichées. Renvoie null si une coordonnée est absente ou invalide.
function distanceVol(a, b) {
  if (!a || !b ||
      a.lat === null || a.lat === undefined || a.lat === '' || typeof a.lat === 'boolean' ||
      b.lat === null || b.lat === undefined || b.lat === '' || typeof b.lat === 'boolean' ||
      a.lon === null || a.lon === undefined || a.lon === '' || typeof a.lon === 'boolean' ||
      b.lon === null || b.lon === undefined || b.lon === '' || typeof b.lon === 'boolean' ||
      !isFinite(a.lat) || !isFinite(b.lat) || !isFinite(a.lon) || !isFinite(b.lon)) return null;
  var la1 = +a.lat, lo1 = +a.lon, la2 = +b.lat, lo2 = +b.lon;
  if (la1 === la2 && lo1 === lo2) return 0;
  var R = 6371, rad = Math.PI / 180;
  var dLat = (la2 - la1) * rad, dLon = (lo2 - lo1) * rad;
  var h = Math.pow(Math.sin(dLat / 2), 2) +
          Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.pow(Math.sin(dLon / 2), 2);
  h = Math.min(1, Math.max(0, h));
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
// a, b : objets { lat, lon }. Distance routière estimée en km (vol d'oiseau x coefficient détour routier).
function distanceKm(a, b) {
  var vol = distanceVol(a, b);
  if (vol === null) return null;
  var detour = (typeof REGLAGES_MOTEUR !== 'undefined' && REGLAGES_MOTEUR && REGLAGES_MOTEUR.detourRoutier) ? REGLAGES_MOTEUR.detourRoutier : 1.6;
  return vol * detour;
}

function normaliserLigneQuartier(q) {
  var territoire = '', zone = '', commune = '', subdivision = '', quartier = '', secteur = '', variantes = '', lat = null, lon = null;
  if (Array.isArray(q)) {
    if (q.length >= 8) {
      territoire = String(q[0] || '').trim();
      zone = String(q[1] || '').trim();
      commune = String(q[2] || '').trim();
      subdivision = String(q[3] || '').trim();
      quartier = String(q[4] || '').trim();
      secteur = String(q[5] || '').trim();
      variantes = String(q[6] || '').trim();
      lat = (q[7] !== '' && q[7] !== null && q[7] !== undefined && isFinite(+q[7])) ? +q[7] : null;
      lon = (q[8] !== '' && q[8] !== null && q[8] !== undefined && isFinite(+q[8])) ? +q[8] : null;
    } else {
      var rawCom = String(q[0] || '').trim();
      quartier = String(q[1] || '').trim();
      zone = String(q[2] || '').trim();
      lat = (q[3] !== '' && q[3] !== null && q[3] !== undefined && isFinite(+q[3])) ? +q[3] : null;
      lon = (q[4] !== '' && q[4] !== null && q[4] !== undefined && isFinite(+q[4])) ? +q[4] : null;
      secteur = q[5] ? String(q[5]).trim() : '';
      var parArr = communeParente(rawCom);
      if (parArr && parArr !== rawCom && /^(abobo|cocody|yopougon)$/i.test(parArr)) {
        commune = parArr;
        subdivision = rawCom;
      } else {
        commune = rawCom;
      }
    }
  } else if (q && typeof q === 'object') {
    territoire = String(q.territoire || '').trim();
    zone = String(q.zone || '').trim();
    commune = String(q.commune || '').trim();
    subdivision = String(q.subdivision || '').trim();
    quartier = String(q.quartier || '').trim();
    secteur = String(q.secteur || '').trim();
    variantes = String(q.variantes || '').trim();
    lat = (q.lat !== '' && q.lat !== null && q.lat !== undefined && isFinite(+q.lat)) ? +q.lat : null;
    lon = (q.lon !== '' && q.lon !== null && q.lon !== undefined && isFinite(+q.lon)) ? +q.lon : null;
    var parObj = communeParente(commune);
    if (parObj && parObj !== commune && /^(abobo|cocody|yopougon)$/i.test(parObj)) {
      if (!subdivision) subdivision = commune;
      commune = parObj;
    }
  }
  if (!territoire) {
    territoire = estTerritoireInterieur({ zone: zone, commune: commune }) ? 'Intérieur' : 'Abidjan';
  } else if (normaliser(territoire).indexOf('interieur') >= 0) {
    territoire = 'Intérieur';
  } else if (normaliser(territoire) === 'abidjan') {
    territoire = 'Abidjan';
  }
  if (territoire === 'Intérieur') {
    if (!zone || normaliser(zone) === 'zoneinterieur' || normaliser(zone) === 'interieur') zone = '';
  } else if (!zone && commune) {
    zone = ZONE_COMMUNE_ABIDJAN[normaliser(commune)] || '';
  }
  return {
    territoire: territoire,
    zone: zone,
    commune: commune,
    subdivision: subdivision,
    quartier: quartier,
    secteur: secteur,
    variantes: variantes,
    lat: lat,
    lon: lon
  };
}

function quartiersDefautObjets() {
  return QUARTIERS_DEFAUT.map(normaliserLigneQuartier);
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
  Q.forEach(function (q, i) { if (parNom[q.quartier] === undefined || !q.secteur) parNom[q.quartier] = i; });
  var pool = [];
  Q.forEach(function (q, i) {
    if (q.territoire === 'Intérieur') return;
    var w = (q.commune === 'Cocody' || q.commune === 'Plateau') ? 3 :
            (['Marcory', 'Yopougon', 'Treichville', 'Adjamé', 'Koumassi'].indexOf(q.commune) >= 0 ? 2 : 1);
    for (var k = 0; k < w; k++) pool.push(i);
  });

  var hopitaux = [
    ['CHU de Cocody', 'Cocody Centre'], ['CHU de Treichville', 'Arras'],
    ['CHU de Yopougon', 'Sicogi'], ["CHU d'Angré", 'Angré'], ["Institut de Cardiologie d'Abidjan", 'Arras'],
    ["Hôpital Général d'Abobo", 'Gare'], ['Hôpital Général de Port-Bouët', 'Port-Bouët Centre'],
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
    var idx = isFinite(qi) ? ((Math.floor(qi) % Q.length) + Q.length) % Q.length : 0;
    var q = Q[idx] || Q[0];   // 3.26.50 : index hors liste (démo) ramené dans la liste
    var p = { id: presences.length + 1, code: code, nom: nom, lieu: lieu, quartier: q.quartier,
              commune: q.commune, zone: q.zone, territoire: q.territoire || 'Abidjan',
              subdivision: q.subdivision || '', secteur: q.secteur || '',
              horaireMatin: hM, horaireSoir: hS, lat: '', lon: '' };
    JOURS_CLES.forEach(function (j, i) { p[j] = ecrireDispo(grille[i]); });
    presences.push(p);
  }

  var m, code, nom, spec;
  // Médecins
  for (m = 1; m <= nbMed; m++) {
    code = 'MED-' + numeroCode(m);
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
    code = 'PHA-' + numeroCode(m);
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
  ['actif', 'Actif'], ['gamme', 'Gamme'], ['aire', 'Aire thérapeutique'], ['produit', 'Produit'], ['dci', 'DCI et dosage'], ['classe', 'Classe'],
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
// 3.26.79 : fiches intégrées hors de la liste active (ex. Losartan AM) marquées inactives : jamais proposées, même hors connexion
FICHES_PRODUITS_DEFAUT.forEach(function (f) { if (PRODUITS_DEFAUT.map(normaliser).indexOf(normaliser(f.produit)) < 0) f.actif = 'Non'; });



// ---------------------------------------------------------------- Comptes rendus de la journée (3.13.0)
// Feuille « Rapports du jour » : une ligne par délégué et par jour (synthèse automatique + saisie du délégué)
var CHAMPS_RAPPORTS = [
  ['delegue', 'Délégué'], ['date', 'Date'], ['valideLe', 'Validé le'], ['prevues', 'Visites prévues'], ['faites', 'Visites faites'],
  ['nonFaites', 'Non faites'], ['sansCr', 'Sans compte rendu'], ['synthese', 'Synthèse'], ['faits', 'Faits marquants'],
  ['concurrence', 'Concurrence'], ['besoins', 'Besoins'], ['km', 'Kilomètres'], ['maj', 'Mise à jour']
];

// Découpage des grandes communes d'Abidjan en 4 grands sous-secteurs pour les tournées délégués
var ZONES_GRANDES_COMMUNES = {
  'Cocody': [
    { nom: 'Cocody – Angré', lib: 'Cocody – Angré (7e/8e tranche, CHU Angré, Djorobité)', mots: ['angre', 'tranche', 'chu angre', 'djorobite', 'djorogobite', 'chateau', 'mahou', 'petroivoire', 'besakoi'] },
    { nom: 'Cocody – Deux Plateaux', lib: 'Cocody – Deux Plateaux (Vallons, Aghien, ENA, Attoban)', mots: ['plateaux', 'plateau', 'vallon', 'aghien', 'ena', 'attoban', 'palmas', 'latrille', 'socece', 'sococe'] },
    { nom: 'Cocody – Riviera', lib: 'Cocody – Riviera (Riviera 1-4, Palmeraie, Faya, M\'Badon, Anono)', mots: ['riviera', 'palmeraie', 'faya', 'mbadon', 'm\'badon', 'anono', 'bonoumin', 'abatta', 'akouedo', 'golf', 'ciad'] },
    { nom: 'Cocody – Centre', lib: 'Cocody – Centre (Saint-Jean, Danga, CHU Cocody, Mermoz)', mots: ['saint-jean', 'st jean', 'danga', 'chu cocody', 'mermoz', 'blockhauss', 'ambassade', 'lycee technique', 'arts', 'universite', 'centre', 'cannebiere', 'nestle'] }
  ],
  'Yopougon': [
    { nom: 'Yopougon – Niangon', lib: 'Yopougon – Niangon (Nord, Sud, Académie, Lokoua, Cité Verte)', mots: ['niangon', 'academie', 'lokoua', 'verte', 'texaco', 'lubafrique'] },
    { nom: 'Yopougon – Maroc & Toits Rouges', lib: 'Yopougon – Maroc & Toits Rouges (Bel Air, Sideci, Selmer)', mots: ['maroc', 'toits rouges', 'bel air', 'sideci', 'selmer', 'cie', 'nouveau bureau', 'carrefour'] },
    { nom: 'Yopougon – Centre & Mairie', lib: 'Yopougon – Centre & Mairie (CHU Yop., Saint-André, Siporex, Keneya)', mots: ['chu yop', 'saint-andre', 'st andre', 'siporex', 'mairie', 'keneya', 'pompiers', 'wassakara', 'justice', 'ficgayo'] },
    { nom: 'Yopougon – Sud & Gesco', lib: 'Yopougon – Sud & Gesco (Port-Bouët 2, Kouté, Zone Industrielle, Sable)', mots: ['port-bouet 2', 'port bouet 2', 'koute', 'gesco', 'industrielle', 'sable', 'millionnaire', 'nouveau quartier', 'acadie'] }
  ],
  'Abobo': [
    { nom: 'Abobo – Nord & PK18', lib: 'Abobo – Nord & PK18 (PK18, N\'Dotré, Anonkoua Kouté, Belle Ville, Biabou)', mots: ['nord', 'abobo nord', 'pk18', 'pk 18', 'ndotre', 'n\'dotre', 'anonkoua', 'koute', 'belle ville', 'biabou', 'akeikoi', 'agneby'] },
    { nom: 'Abobo – Centre & Mairie', lib: 'Abobo – Centre & Mairie (Samaké, Gare, Derrière rails, Mairie, Habitat)', mots: ['centre', 'abobo centre', 'samake', 'mairie', 'gendarmerie', 'gare', 'habitat', 'banco', 'marche', 'sogefiha', 'rail', 'rails', 'derriere rail', 'derriere rails'] },
    { nom: 'Abobo – Baoulé & Avocatier', lib: 'Abobo – Baoulé & Avocatier (Abobo Baoulé, Avocatier, Clouetcha, Dépôt SOTRA, Abobo-Té)', mots: ['baoule', 'avocatier', 'clouetcha', 'sotra', 'abobo te', 'abobote'] },
    { nom: 'Abobo – Sud & Plaque', lib: 'Abobo – Sud & Plaque (Sagbé, Plaque 1 & 2, Anador, Houphouët-Boigny, Dokui)', mots: ['sud', 'abobo sud', 'sagbe', 'plaque', 'anador', 'houphouet', 'agbekoi', 'dokui', 'colatier'] }
  ]
};

function resoudreTerritoire(input, listeQuartiers) {
  if (input === null || input === undefined) return null;
  var estChaine = typeof input === 'string';
  var rawStr = estChaine ? input.trim() : '';
  if (estChaine && !rawStr) return null;

  var inSecteur = estChaine ? rawStr : String(input.secteur || '').trim();
  var inQuartier = estChaine ? rawStr : String(input.quartier || '').trim();
  if (/^(nl|non localise|non localisé)$/i.test(inQuartier)) inQuartier = '';
  var inLieu = estChaine ? rawStr : String(input.lieu || '').trim();
  var rawCom = estChaine ? '' : String(input.commune || '').trim();
  var inSubdiv = estChaine ? '' : String(input.subdivision || '').trim();
  var inZone = estChaine ? '' : String(input.zone || '').trim();
  var inTerr = estChaine ? '' : String(input.territoire || '').trim();

  var inCom = rawCom;
  if (rawCom) {
    var parRaw = communeParente(rawCom);
    if (parRaw && parRaw !== rawCom && /^(abobo|cocody|yopougon)$/i.test(parRaw)) {
      if (!inSubdiv) inSubdiv = rawCom;
      inCom = parRaw;
    }
  }
  if (!inSecteur && !inQuartier && !inLieu && !inCom && !inSubdiv && !inZone && !inTerr) return null;

  var qs = _obtenirQuartiersIndexes(listeQuartiers).qs;

  var inComNorm = normaliser(inCom);
  if (inComNorm === 'abidjan') inComNorm = '';
  var inSubNorm = normaliser(inSubdiv);
  var inLieuNorm = normaliser(inLieu);
  var comExplicite = !!inComNorm;
  var comEstInterieur = comExplicite && !estCommuneGrandAbidjan(inCom);

  function normEspaces(s) {
    return sansAccents(String(s || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function listeVariantes(v) {
    if (!v) return [];
    return String(v).split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function compatibleCommune(q) {
    if (!comExplicite) return true;
    return normaliser(q.commune) === inComNorm;
  }
  function construireResultat(q, matched, qOverride, secOverride) {
    var terr = q.territoire || (estTerritoireInterieur(q) ? 'Intérieur' : 'Abidjan');
    return {
      territoire: terr,
      zone: terr === 'Intérieur' ? '' : (q.zone || ''),
      commune: q.commune || '',
      subdivision: q.subdivision || '',
      quartier: qOverride !== undefined ? qOverride : (q.quartier || ''),
      secteur: secOverride !== undefined ? secOverride : (q.secteur || ''),
      lat: q.lat !== undefined ? q.lat : null,
      lon: q.lon !== undefined ? q.lon : null,
      matched: !!matched
    };
  }

  // 1) Match exact normalisé sur secteur ou sur n'importe quel élément de variantes
  var essaisStep1 = [];
  var nInSec = normaliser(inSecteur);
  var nInQua = normaliser(inQuartier);
  if (nInSec) essaisStep1.push({ norm: nInSec, depuisSecteur: true });
  if (nInQua && nInQua !== nInSec) essaisStep1.push({ norm: nInQua, depuisSecteur: false });

  if (essaisStep1.length) {
    var best1 = null, best1Score = -1, best1Global = null, best1GlobalScore = -1;
    for (var i1 = 0; i1 < qs.length; i1++) {
      var q1 = qs[i1];
      var okCom1 = compatibleCommune(q1);
      var q1SecNorm = normaliser(q1.secteur);
      var q1ComNorm = normaliser(q1.commune);
      var q1SubNorm = normaliser(q1.subdivision);
      var vars1 = listeVariantes(q1.variantes).map(normaliser);

      for (var e1 = 0; e1 < essaisStep1.length; e1++) {
        var ess = essaisStep1[e1];
        var matchSec = !!(q1SecNorm && q1SecNorm === ess.norm);
        var matchVar = !matchSec && vars1.indexOf(ess.norm) >= 0;
        if (!matchSec && !matchVar) continue;

        var sc1 = 0;
        if (inSubNorm && q1SubNorm === inSubNorm) sc1 += 100;
        if (inComNorm && q1ComNorm === inComNorm) sc1 += 50;
        if (inLieuNorm && q1ComNorm && q1ComNorm.length >= 4 && inLieuNorm.indexOf(q1ComNorm) >= 0) sc1 += 20;
        if (matchSec) sc1 += 10;
        if (ess.depuisSecteur) sc1 += 5;
        if (!q1.secteur) sc1 += 2;
        if (okCom1 && sc1 > best1Score) {
          best1Score = sc1;
          best1 = q1;
        }
        if (sc1 > best1GlobalScore) {
          best1GlobalScore = sc1;
          best1Global = q1;
        }
      }
    }
    if (best1 || best1Global) return construireResultat(best1 || best1Global, true);
  }

  // 2) Match exact normalisé sur quartier
  if (nInQua) {
    var best2 = null, best2Score = -1, best2Global = null, best2GlobalScore = -1;
    for (var i2 = 0; i2 < qs.length; i2++) {
      var q2 = qs[i2];
      var okCom2 = compatibleCommune(q2);
      if (normaliser(q2.quartier) !== nInQua) continue;

      var q2ComNorm = normaliser(q2.commune);
      var q2SubNorm = normaliser(q2.subdivision);
      var sc2 = 0;
      if (inSubNorm && q2SubNorm === inSubNorm) sc2 += 100;
      if (inComNorm && q2ComNorm === inComNorm) sc2 += 50;
      if (inLieuNorm && q2ComNorm && q2ComNorm.length >= 4 && inLieuNorm.indexOf(q2ComNorm) >= 0) sc2 += 20;
      if (inLieuNorm && q2SubNorm && q2SubNorm.length >= 4 && inLieuNorm.indexOf(q2SubNorm) >= 0) sc2 += 15;
      if (!q2.secteur) sc2 += 10;
      if (okCom2 && sc2 > best2Score) {
        best2Score = sc2;
        best2 = q2;
      }
      if (sc2 > best2GlobalScore) {
        best2GlobalScore = sc2;
        best2Global = q2;
      }
    }
    if (best2 || best2Global) return construireResultat(best2 || best2Global, true);
  }

  // 3) Match partiel >= 4 caractères dans lieu (trié par longueur décroissante, priorisant commune)
  if (inLieuNorm) {
    var lieuPad = ' ' + normEspaces(inLieu) + ' ';
    var candidats3 = [];
    for (var i3 = 0; i3 < qs.length; i3++) {
      var q3 = qs[i3];
      if (!compatibleCommune(q3)) continue;
      var termes3 = [];
      if (q3.secteur) termes3.push({ txt: q3.secteur, prio: 3 });
      listeVariantes(q3.variantes).forEach(function (v) { termes3.push({ txt: v, prio: 2 }); });
      if (q3.quartier) termes3.push({ txt: q3.quartier, prio: 1 });

      for (var t3 = 0; t3 < termes3.length; t3++) {
        var tm = termes3[t3];
        var tmNorm = normaliser(tm.txt);
        if (tmNorm.length < 4) continue;
        var tmEsp = normEspaces(tm.txt);
        var matchMot = !!(tmEsp && lieuPad.indexOf(' ' + tmEsp + ' ') >= 0);
        var matchColle = !matchMot && tmNorm.length >= 5 && inLieuNorm.indexOf(tmNorm) >= 0;
        if (!matchMot && !matchColle) continue;

        var q3ComNorm = normaliser(q3.commune);
        var q3SubNorm = normaliser(q3.subdivision);
        var sc3 = 0;
        if (inSubNorm && q3SubNorm === inSubNorm) sc3 += 1000;
        if (inComNorm && q3ComNorm === inComNorm) sc3 += 500;
        if (matchMot) sc3 += 100;
        candidats3.push({
          q: q3,
          len: tmNorm.length,
          score: sc3,
          prio: tm.prio,
          sansSec: !q3.secteur ? 1 : 0,
          idx: i3
        });
      }
    }
    if (candidats3.length) {
      candidats3.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if (b.len !== a.len) return b.len - a.len;
        if (b.prio !== a.prio) return b.prio - a.prio;
        if (b.sansSec !== a.sansSec) return b.sansSec - a.sansSec;
        return a.idx - b.idx;
      });
      return construireResultat(candidats3[0].q, true);
    }
  }

  // 4) Repli commune via COMMUNES_GRAND_ABIDJAN / VILLES_INTERIEUR_CI
  if (inSubNorm) {
    for (var i4s = 0; i4s < qs.length; i4s++) {
      if (normaliser(qs[i4s].subdivision) === inSubNorm) {
        return construireResultat(qs[i4s], true, inQuartier || '', inSecteur && inSecteur !== inQuartier ? inSecteur : '');
      }
    }
  }

  var comMatchAbj = '';
  for (var ca = 0; ca < COMMUNES_GRAND_ABIDJAN.length; ca++) {
    var nomC = COMMUNES_GRAND_ABIDJAN[ca];
    if (inComNorm && inComNorm === normaliser(nomC)) { comMatchAbj = nomC; break; }
  }
  var cibleCom = inCom || (estChaine ? rawStr : '') || inLieu;
  if (!comMatchAbj && !comExplicite && cibleCom) {
    var ciblePad = ' ' + normEspaces(cibleCom) + ' ';
    for (var cb = 0; cb < COMMUNES_GRAND_ABIDJAN.length; cb++) {
      var nomC2 = COMMUNES_GRAND_ABIDJAN[cb];
      if (ciblePad.indexOf(' ' + normEspaces(nomC2) + ' ') >= 0) { comMatchAbj = nomC2; break; }
    }
  }
  if (comMatchAbj) {
    var zoneAbj = ZONE_COMMUNE_ABIDJAN[normaliser(comMatchAbj)] || inZone || '';
    var sumLat = 0, sumLon = 0, cntCoord = 0;
    for (var qa = 0; qa < qs.length; qa++) {
      if (normaliser(qs[qa].commune) === normaliser(comMatchAbj)) {
        if (!zoneAbj && qs[qa].zone) zoneAbj = qs[qa].zone;
        if (isFinite(qs[qa].lat) && qs[qa].lat !== null && isFinite(qs[qa].lon) && qs[qa].lon !== null) {
          sumLat += qs[qa].lat; sumLon += qs[qa].lon; cntCoord++;
        }
      }
    }
    return {
      territoire: 'Abidjan',
      zone: zoneAbj,
      commune: comMatchAbj,
      subdivision: inSubdiv || '',
      quartier: (estChaine && normaliser(rawStr) === normaliser(comMatchAbj)) ? '' : (inQuartier || ''),
      secteur: (inSecteur && inSecteur !== inQuartier) ? inSecteur : '',
      lat: cntCoord ? Math.round((sumLat / cntCoord) * 1e5) / 1e5 : null,
      lon: cntCoord ? Math.round((sumLon / cntCoord) * 1e5) / 1e5 : null,
      matched: true
    };
  }

  var vInt = centroideVilleInterieur(inCom || (estChaine ? rawStr : '') || inLieu);
  if (vInt) {
    return {
      territoire: 'Intérieur',
      zone: '',
      commune: vInt.nom,
      subdivision: '',
      quartier: (estChaine && normaliser(rawStr) === normaliser(vInt.nom)) ? '' : (inQuartier || ''),
      secteur: (inSecteur && inSecteur !== inQuartier) ? inSecteur : '',
      lat: vInt.lat,
      lon: vInt.lon,
      matched: true
    };
  }

  if (comEstInterieur || estTerritoireInterieur({ territoire: inTerr, zone: inZone, commune: inCom })) {
    return {
      territoire: 'Intérieur',
      zone: '',
      commune: inCom || '',
      subdivision: '',
      quartier: inQuartier || '',
      secteur: (inSecteur && inSecteur !== inQuartier) ? inSecteur : '',
      lat: null,
      lon: null,
      matched: false
    };
  }

  if (estTerritoireInterieur(rawStr) || normaliser(inTerr) === 'interieur') {
    return {
      territoire: 'Intérieur',
      zone: '',
      commune: '',
      subdivision: '',
      quartier: '',
      secteur: '',
      lat: null,
      lon: null,
      matched: true
    };
  }

  if (normaliser(rawStr) === 'abidjan' || normaliser(inTerr) === 'abidjan') {
    return {
      territoire: 'Abidjan',
      zone: inZone || '',
      commune: '',
      subdivision: '',
      quartier: inQuartier || '',
      secteur: '',
      lat: null,
      lon: null,
      matched: true
    };
  }

  return null;
}

function zoneDeQuartier(commune, quartier, lieu, listeQuartiers) {
  var r = resoudreTerritoire({ commune: commune, quartier: quartier, secteur: quartier, lieu: lieu }, listeQuartiers);
  if (r && r.subdivision) return r.subdivision;

  var comNorm = normaliser(commune || '');
  var comCle = (comNorm.indexOf('cocody') >= 0 ? 'Cocody' : (comNorm.indexOf('yopougon') >= 0 ? 'Yopougon' : (comNorm.indexOf('abobo') >= 0 ? 'Abobo' : '')));
  if (!comCle || !ZONES_GRANDES_COMMUNES[comCle]) return '';

  // Ne retombe sur ZONES_GRANDES_COMMUNES que si listeQuartiers ne contient aucune subdivision pour cette commune
  var src = (listeQuartiers && listeQuartiers.length) ? listeQuartiers : quartiersDefautObjets();
  var cleNorm = normaliser(comCle);
  for (var idxQ = 0; idxQ < src.length; idxQ++) {
    var qn = normaliserLigneQuartier(src[idxQ]);
    if (normaliser(qn.commune) === cleNorm && qn.subdivision) return '';
  }

  // 3.28.23 : mots entiers, le quartier d'abord, puis le nom du lieu (« Pharmacie » ne contient plus « cie »,
  // « Plateau Dokui » ne passe plus pour Abobo-Té à cause de « te »)
  var zones = ZONES_GRANDES_COMMUNES[comCle];
  var mots = function (x) { return ' ' + String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' '; };
  var colle = function (x) { return mots(x).replace(/ /g, ''); };
  var essais = [[mots(quartier), false], [mots(lieu), false], [colle(quartier), true], [colle(lieu), true]];
  var motsGeneriques = { carrefour: true };
  for (var passe = 0; passe < 2; passe++) {
    for (var e = 0; e < essais.length; e++) {
      var texte = essais[e][0], partiel = essais[e][1];
      if (!texte.trim()) continue;
      for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        for (var j = 0; j < z.mots.length; j++) {
          var estGen = !!motsGeneriques[z.mots[j]];
          if ((passe === 0 && estGen) || (passe === 1 && !estGen)) continue;
          var m = mots(z.mots[j]);
          if (!partiel ? texte.indexOf(m) >= 0 : (m.replace(/ /g, '').length >= 5 && texte.indexOf(m.replace(/ /g, '')) >= 0)) return z.nom;
        }
      }
    }
  }
  return zones[zones.length - 1].nom;
}

var _geoCacheQ = { src: null, len: -1, qs: null, subToCom: null };
function _obtenirQuartiersIndexes(listeQuartiers) {
  var src = (listeQuartiers && listeQuartiers.length) ? listeQuartiers : quartiersDefautObjets();
  if (_geoCacheQ.src === src && _geoCacheQ.len === src.length && _geoCacheQ.qs) {
    return _geoCacheQ;
  }
  var qs = [];
  var subToCom = {};
  for (var i = 0; i < src.length; i++) {
    var row = src[i];
    if (!row) continue;
    var qn = normaliserLigneQuartier(row);
    qs.push(qn);
    if (qn.subdivision && qn.commune) {
      var nsub = normaliser(qn.subdivision);
      if (nsub && !subToCom[nsub]) subToCom[nsub] = communeParente(qn.commune);
    }
  }
  _geoCacheQ = { src: src, len: src.length, qs: qs, subToCom: subToCom };
  return _geoCacheQ;
}

function communeParente(nom, listeQuartiers) {
  if (!nom) return '';
  var s = String(nom).trim();
  // Seules les 3 grandes communes sont segmentées en sous-secteurs
  var m = s.match(/^(Abobo|Cocody|Yopougon)\b/i);
  if (m) {
    var p = m[1].toLowerCase();
    if (p === 'abobo') return 'Abobo';
    if (p === 'cocody') return 'Cocody';
    if (p === 'yopougon') return 'Yopougon';
  }
  if (listeQuartiers && listeQuartiers.length) {
    var idx = _obtenirQuartiersIndexes(listeQuartiers);
    var hit = idx.subToCom[normaliser(s)];
    if (hit) return hit;
  }
  return s;
}

function secteurDeQuartier(quartier, lieu, commune, listeQuartiers) {
  var r = resoudreTerritoire({ quartier: quartier, secteur: quartier, lieu: lieu, commune: commune }, listeQuartiers);
  if (r) {
    if (r.subdivision) return r.subdivision;
    if (r.commune) return r.commune;
    if (r.secteur) return r.secteur;
    if (r.quartier) return r.quartier;
  }
  return commune || '';
}

function communeCorrespondante(c, dans, listeQuartiers) {
  if (!dans) return true;
  if (!c) return false;
  var com = c.commune || '';
  var sub = c.subdivision || '';
  var sec = c.secteur || '';
  var qua = c.quartier || '';
  var subNormTiret = function (v) { return String(v || '').trim().replace(/\s+-\s+/g, ' – '); };
  var dansKeys = Object.keys(dans);
  var dansNorm = {};
  for (var di = 0; di < dansKeys.length; di++) {
    var dk = dansKeys[di];
    if (dans[dk]) {
      var ndk = normaliser(dk);
      if (ndk) dansNorm[ndk] = true;
    }
  }
  var matchDans = function (v) {
    if (!v) return false;
    var t = subNormTiret(v);
    if (dans[v] || dans[t]) return true;
    var nv = normaliser(v);
    return !!(nv && dansNorm[nv]);
  };
  if (matchDans(sub)) return true;
  if (com && (dans[com] || dans[com + ' (Toute la commune)'])) return true;
  var par = communeParente(com, listeQuartiers);
  if (par && (dans[par] || dans[par + ' (Toute la commune)'])) return true;
  if (qua && dans[qua]) return true;
  if (sec && dans[sec]) return true;
  if (c.zone && dans[c.zone]) return true;
  if (c.territoire && dans[c.territoire]) return true;

  var r = resoudreTerritoire(c, listeQuartiers);
  if (r) {
    if (r.matched && r.subdivision && matchDans(r.subdivision)) return true;
    if (!com || normaliser(com) === 'abidjan') {
      if (r.subdivision && matchDans(r.subdivision)) return true;
      if (r.commune && (dans[r.commune] || dans[r.commune + ' (Toute la commune)'])) return true;
      var rPar = communeParente(r.commune, listeQuartiers);
      if (rPar && (dans[rPar] || dans[rPar + ' (Toute la commune)'])) return true;
      if (r.quartier && dans[r.quartier]) return true;
      if (r.secteur && dans[r.secteur]) return true;
      if (r.zone && dans[r.zone]) return true;
      if (r.territoire && dans[r.territoire]) return true;
    } else {
      var rComNorm = normaliser(communeParente(r.commune, listeQuartiers));
      if (!rComNorm || rComNorm === normaliser(par)) {
        if (r.subdivision && matchDans(r.subdivision)) return true;
        if (r.quartier && dans[r.quartier]) return true;
        if (r.secteur && dans[r.secteur]) return true;
        if (r.zone && dans[r.zone]) return true;
        if (r.territoire && dans[r.territoire]) return true;
      }
    }
  }

  if (com) {
    var z = zoneDeQuartier(com, qua, c.lieu || '', listeQuartiers);
    if (z && dans[z]) return true;
  }
  if ((dans['Intérieur'] || dans['Zone Intérieur']) && estTerritoireInterieur(r || c)) return true;
  return false;
}

// 3.27.44 / 3.31.53 : Formatage strict du numéro de téléphone en Côte d'Ivoire (+225 07 07 76 85 93)
function formaterTelephoneCI(n) {
  if (!n) return '';
  var s = String(n).replace(/^'+/, '').trim();
  if (!s) return '';
  // 3.28.15 : plusieurs numéros (« a / b », « a ; b », « a, b ») : chacun mis en forme, l'ordre est conservé
  var parts = s.split(/\s*[\/;,|]\s*|\s+(?:ou|et)\s+/i).filter(function (x) { return /\d/.test(x); });
  if (parts.length > 1) return parts.map(formaterTelephoneCI).join(' / ');
  if (/^\+/.test(s) && !/^\+\s*225/.test(s)) return s;
  var d = s.replace(/\D/g, '');
  if (d.indexOf('00225') === 0 && (d.length === 13 || d.length === 15 || (d.length === 14 && /^[0157]/.test(d.slice(5))))) {
    d = d.slice(5);
  } else if (d.indexOf('225') === 0 && (d.length === 11 || d.length === 13 || (d.length === 12 && /^[0157]/.test(d.slice(3))))) {
    d = d.slice(3);
  }
  if (d.length === 9 && /^[0157]/.test(d)) d = '0' + d;
  if (d.length === 10) {
    return '+225 ' + d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, 6) + ' ' + d.slice(6, 8) + ' ' + d.slice(8, 10);
  }
  if (d.length === 8) {
    return '+225 ' + d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, 6) + ' ' + d.slice(6, 8);
  }
  return s;   // format inconnu (numéro étranger, extension…) : laissé tel que saisi
}

// 3.31.54 : Détection fiable d'un nom d'officine de pharmacie (évite qu'une pharmacie soit classée en Médecin ou Établissement/Hôpital)
function estNomPharmacie(nom) {
  var s = sansAccents(String(nom || '').replace(/^'+/, '').trim()).toLowerCase();
  s = s.replace(/^(?:dr|docteur|pr|prof|professeur|ide|sag|sf|m\.|mme|mlle)\b\.?\s*/i, '');
  return /^(?:grande\s+|nouvelle\s+)?(?:pharmacie|phcie|pharma|officine)\b/.test(s);
}

// 3.31.53 / 3.31.54 : Normalisation des titres de praticiens : Infirmier -> IDE, Sage-femme -> SAG, Pharmacie -> Pharmacie (sans Dr)
function normaliserTitrePraticien(nom, type) {
  var n = String(nom || '').trim().replace(/\s+/g, ' ');
  if (n.length < 2) return n;
  if (type === 'Pharmacie' || estNomPharmacie(n)) {
    n = n.replace(/^(?:dr|docteur|pr|prof|professeur|ide|infirmi[eè]re?|inf|sage[\s\-]*femme|sag|sf|m\.|mme|mlle)\b\.?\s*/i, '').trim();
    if (/^(?:grande\s+|nouvelle\s+)pharmacie\b/i.test(n)) {
      return n.replace(/^(grande|nouvelle)\s+pharmacie\b\s*/i, function (_, adj) {
        return adj.charAt(0).toUpperCase() + adj.slice(1).toLowerCase() + ' Pharmacie ';
      }).trim();
    }
    if (/^(pharmacie|phcie|pharma|officine)\b\.?\s*/i.test(n)) return n.replace(/^(pharmacie|phcie|pharma|officine)\b\.?\s*/i, 'Pharmacie ').trim();
    return 'Pharmacie ' + n;
  }
  var mIde = n.match(/^(?:ide|infirmi[eè]re?|inf)\b\.?\s*/i);
  if (mIde) return ('IDE ' + n.slice(mIde[0].length)).trim();
  var mSag = n.match(/^(?:sage[\s\-]*femme|sag|sf)\b\.?\s*/i);
  if (mSag) return ('SAG ' + n.slice(mSag[0].length)).trim();
  var mDr = n.match(/^(docteur|dr|pr|professeur|prof)\b\.?\s*/i);
  if (mDr) {
    var t = /^d/i.test(mDr[1]) ? 'Dr' : 'Pr';
    return (t + ' ' + n.slice(mDr[0].length)).trim();
  }
  return 'Dr ' + n;
}

/* =============================================================================
   MOTEUR DE RAPPROCHEMENT FLOU (FUZZY LOOKUP & MATCHING)
   Conçu pour le répertoire médical et pharmaceutique ivoirien :
   - Distance d'édition Levenshtein normalisée
   - Similarité par n-grammes de caractères (Sørensen-Dice)
   - Normalisation phonétique et orthographique Côte d'Ivoire (k/c/q, ou/w, ph/f, voyelles doublées)
   - Token-based matching insensible à l'inversion Nom / Prénom et aux particules
   ============================================================================= */

// Distance de Levenshtein (allocation 1D pour haute performance)
function distanceLevenshtein(a, b) {
  a = String(a || '');
  b = String(b || '');
  var la = a.length, lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  var v0 = new Array(lb + 1), v1 = new Array(lb + 1);
  for (var j = 0; j <= lb; j++) v0[j] = j;
  for (var i = 0; i < la; i++) {
    v1[0] = i + 1;
    var ca = a.charCodeAt(i);
    for (var k = 0; k < lb; k++) {
      var cout = (ca === b.charCodeAt(k)) ? 0 : 1;
      var cSub = v0[k] + cout;
      var cIns = v0[k + 1] + 1;
      var cDel = v1[k] + 1;
      var min = cSub < cIns ? cSub : cIns;
      v1[k + 1] = min < cDel ? min : cDel;
    }
    for (var m = 0; m <= lb; m++) v0[m] = v1[m];
  }
  return v1[lb];
}

// Similarité de Levenshtein normalisée entre 0.0 et 1.0
function similariteLevenshtein(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a === b) return 1.0;
  var maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1.0;
  var dist = distanceLevenshtein(a, b);
  return Math.max(0, 1.0 - (dist / maxLen));
}

// Similarité par bigrammes et trigrammes (Dice coefficient)
function similariteTrigrammes(a, b) {
  a = String(a || '').trim();
  b = String(b || '').trim();
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return similariteLevenshtein(a, b);

  var nGramsA = {}, countA = 0;
  for (var i = 0; i < a.length - 1; i++) {
    var g = a.slice(i, i + 2);
    nGramsA[g] = (nGramsA[g] || 0) + 1;
    countA++;
  }

  var intersection = 0, countB = 0;
  for (var j = 0; j < b.length - 1; j++) {
    var bg = b.slice(j, j + 2);
    countB++;
    if (nGramsA[bg] && nGramsA[bg] > 0) {
      intersection++;
      nGramsA[bg]--;
    }
  }

  var total = countA + countB;
  return total ? (2.0 * intersection) / total : 0;
}

// Normalisation phonétique et orthographique des patronymes ivoiriens
function normaliserPhonetiqueCI(s) {
  var t = sansAccents(String(s || '')).toLowerCase();
  // Retrait des civilités, titres médicaux et statuts matrimoniaux usuels
  t = t.replace(/\b(docteur|professeur|prof|dr|pr|mme|madame|monsieur|mr|m|sf|sag|sage\s*femme|ide|infirmier|infirmiere|inf|pharmacien|epse|epouse|nee)\b\.?/gi, ' ');
  // Caractères alphanumériques uniquement
  t = t.replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, ' ');
  // Équivalences phonétiques courantes en Côte d'Ivoire
  t = t.replace(/ph/g, 'f');
  t = t.replace(/qu/g, 'k');
  t = t.replace(/q/g, 'k');
  t = t.replace(/c([aou])/g, 'k$1');
  t = t.replace(/c([ei])/g, 's$1');
  t = t.replace(/c(?=[^aoueiy]|$)/g, 'k');
  // Diphtongues ivoiriennes (Kouadio/Koadio, Kouabenan/Koabenan, Doumbia/Dombia)
  t = t.replace(/\b(k|g|d|b|t)o([aeu])/g, '$1w$2');
  t = t.replace(/ou/g, 'w');
  t = t.replace(/oa/g, 'wa');
  t = t.replace(/oe/g, 'we');
  t = t.replace(/gn/g, 'n');
  t = t.replace(/tch/g, 'ch');
  t = t.replace(/dj/g, 'j');
  // Réduction des consonnes doublées fréquentes (ex: kouassi -> kouasi, coulibaly -> koulibaly)
  t = t.replace(/([bdfgklmnprstvwz])\1+/g, '$1');
  return t.replace(/\s+/g, ' ').trim();
}

// Extraction des tokens signifiants d'un nom
function tokensNomCI(s) {
  var norm = normaliserPhonetiqueCI(s);
  return norm.split(/\s+/).filter(function (w) { return w.length >= 2; });
}

// Algorithme hybride complet de Fuzzy Matching pour les noms
// Retourne un score de 0.0 (totalement différent) à 1.0 (identique ou équivalent)
function scoreFuzzyNom(nomA, nomB) {
  nomA = String(nomA || '').trim();
  nomB = String(nomB || '').trim();
  if (!nomA || !nomB) return 0;
  if (nomA === nomB) return 1.0;

  var normA = normaliser(nomA);
  var normB = normaliser(nomB);
  if (normA === normB) return 1.0;

  var phonA = normaliserPhonetiqueCI(nomA);
  var phonB = normaliserPhonetiqueCI(nomB);
  if (phonA === phonB) return 0.97;

  var tokA = tokensNomCI(nomA);
  var tokB = tokensNomCI(nomB);
  if (!tokA.length || !tokB.length) return 0;

  // Inversion exacte des tokens (ex: "KOUAME JEAN" vs "JEAN KOUAME")
  var triA = tokA.slice().sort().join(' ');
  var triB = tokB.slice().sort().join(' ');
  if (triA === triB) return 0.98;

  // Sous-ensemble exact de tokens (ex: "KOUABENAN ROSINE" vs "DR KOUABENAN AFFOUA ROSINE")
  // En Côte d'Ivoire, les prénoms multiples / traditionnels sont très souvent omis sur les cachets ou fiches.
  // Si TOUS les tokens du nom court sont présents dans le nom long (avec au moins 2 tokens), match quasi-certain !
  var tousA_dans_B = tokA.length >= 2 && tokA.every(function (ta) { return tokB.indexOf(ta) >= 0; });
  var tousB_dans_A = tokB.length >= 2 && tokB.every(function (tb) { return tokA.indexOf(tb) >= 0; });
  if (tousA_dans_B || tousB_dans_A) {
    return 0.96;
  }

  // Sous-ensemble flou (Fuzzy Subset avec tolérance fautes d'encre / OCR ex: "Koabenan Rosine" ou "Kouabenan Prosine")
  var court = tokA.length <= tokB.length ? tokA : tokB;
  var longToks = tokA.length <= tokB.length ? tokB : tokA;
  if (court.length >= 2) {
    var matchCourt = court.every(function (ca) {
      return longToks.some(function (lb) { return similariteLevenshtein(ca, lb) >= 0.78; });
    });
    var auMoinsUnExact = court.some(function (ca) {
      return longToks.some(function (lb) { return ca === lb || similariteLevenshtein(ca, lb) >= 0.90; });
    });
    if (matchCourt && auMoinsUnExact) {
      return 0.93;
    }
  }

  // Similarité floue token par token (meilleur appariement)
  var scoreCumulA = 0;
  tokA.forEach(function (ta) {
    var best = 0;
    tokB.forEach(function (tb) {
      var s = similariteLevenshtein(ta, tb);
      if (s > best) best = s;
    });
    scoreCumulA += best;
  });
  var moyenneA = scoreCumulA / tokA.length;

  var scoreCumulB = 0;
  tokB.forEach(function (tb) {
    var best = 0;
    tokA.forEach(function (ta) {
      var s = similariteLevenshtein(tb, ta);
      if (s > best) best = s;
    });
    scoreCumulB += best;
  });
  var moyenneB = scoreCumulB / tokB.length;

  var scoreTokens = (moyenneA + moyenneB) / 2.0;
  var scoreChaine = Math.max(similariteLevenshtein(phonA, phonB), similariteTrigrammes(phonA, phonB));

  // Score combiné pondéré (65% tokens, 35% chaîne phonétique)
  var scoreFinal = (0.65 * scoreTokens) + (0.35 * scoreChaine);
  return Math.round(scoreFinal * 100) / 100;
}

// Vérifie si deux noms matchent de façon floue
function estNomFuzzyMatch(nomA, nomB, seuil) {
  seuil = seuil || 0.72;
  return scoreFuzzyNom(nomA, nomB) >= seuil;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSION_DONNEES: VERSION_DONNEES, JOURS: JOURS, JOURS_CLES: JOURS_CLES, CRENEAUX: CRENEAUX, DISPOS: DISPOS,
    STATUTS_DEFAUT: STATUTS_DEFAUT, CHAMPS_PRATICIENS: CHAMPS_PRATICIENS, CHAMPS_PRESENCES: CHAMPS_PRESENCES,
    CHAMPS_QUARTIERS: CHAMPS_QUARTIERS, CHAMPS_HIST: CHAMPS_HIST, CHAMPS_PLAN: CHAMPS_PLAN, QUARTIERS_DEFAUT: QUARTIERS_DEFAUT,
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
    estConventionne: estConventionne, calcScore: calcScore, distanceKm: distanceKm, distanceVol: distanceVol,
    quartiersDefautObjets: quartiersDefautObjets, creerAlea: creerAlea, genererBaseFictive: genererBaseFictive,
    ZONES_GRANDES_COMMUNES: ZONES_GRANDES_COMMUNES, resoudreTerritoire: resoudreTerritoire, zoneDeQuartier: zoneDeQuartier, communeParente: communeParente, secteurDeQuartier: secteurDeQuartier, communeCorrespondante: communeCorrespondante,
    COMMUNES_GRAND_ABIDJAN: COMMUNES_GRAND_ABIDJAN, VILLES_INTERIEUR_CI: VILLES_INTERIEUR_CI,
    estCommuneGrandAbidjan: estCommuneGrandAbidjan, estCommuneInterieur: estCommuneInterieur, estTerritoireInterieur: estTerritoireInterieur,
    estCoordonneeAbidjan: estCoordonneeAbidjan, centroideVilleInterieur: centroideVilleInterieur, trouverEtablissementRef: trouverEtablissementRef,
    formaterTelephoneCI: formaterTelephoneCI, estNomPharmacie: estNomPharmacie, normaliserTitrePraticien: normaliserTitrePraticien,
    distanceLevenshtein: distanceLevenshtein, similariteLevenshtein: similariteLevenshtein,
    similariteTrigrammes: similariteTrigrammes, normaliserPhonetiqueCI: normaliserPhonetiqueCI,
    tokensNomCI: tokensNomCI, scoreFuzzyNom: scoreFuzzyNom, estNomFuzzyMatch: estNomFuzzyMatch
  };
}
