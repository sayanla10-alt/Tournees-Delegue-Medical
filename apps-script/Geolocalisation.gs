/* =============================================================================
   Geolocalisation.gs : géolocalisation haute précision MediPlanner (v3.25.37 / v3.25.38)
   Fichier AUTONOME pour Google Apps Script (Extensions > Apps Script).

   NOUVEAUTES v3.25.37 / v3.25.38 :
   - Table de référence intégrée des grands établissements de santé (CHU, CHR, HG, Polycliniques, Instituts)
   - Correction automatique des communes erronées / OCR (Adzopé <-> Adjamé, Dabou <-> Treichville, etc.)
   - Correction de la discrimination "Pharmacie" vs "Établissement de Santé" (évite d'injecter "Pharmacie" dans les requêtes CHU/Cliniques)
   - Garde-fou strict sur les latitudes ivoiriennes (rejet des coordonnées maritimes/aberrantes < 4.30 ou > 10.80)
   - Détection et résolution prioritaire des sous-quartiers du Grand Abidjan (13 communes, 278 quartiers)
   - Résolution de l'homonymie Port-Bouët 2 (Yopougon) vs Port-Bouët (Commune Sud)
   ============================================================================= */

var GEO_FEUILLE_PHARMACIES = 'Pharmacies';
var GEO_FEUILLE_PRESENCES = 'Presences';
var GEO_FEUILLE_QUARTIERS = 'Quartiers';
var CLE_GOOGLE_MAPS_DEFAUT = 'AIzaSyC63aSjjzFZMJsWdoYPjVJV9TB08P53_nk';

// ---------------------------------------------------------------- TABLE DE REFERENCE OFFICIELLE DES ETABLISSEMENTS MAJEURS
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

// ---------------------------------------------------------------- CORRECTIONS D'ERREURS OCR ET COORDONNEES CONNUES
var CORRECTIONS_OCR_PHARMACIES = {
  'grande pharmacie du semeur': 'Grande Pharmacie du Sanwi',
  'nouvelle pharmacie adiam': 'Nouvelle Pharmacie du Marché d\'Adjamé',
  'nouvelle pharmacie de la rive': 'Pharmacie de la Mé',
  'nouvelle pharmacie des operas': 'Pharmacie Les Harmonies',
  'nouvelle pharmacie elic': 'Pharmacie Eliel',
  'pharmacie adya': 'Pharmacie Abya',
  'nouvelle pharmacie fraternite': 'Nouvelle Pharmacie Fraternité',
  'pharmacie emily dante': 'Pharmacie Emily-Dante',
  'pharmacie el amine': 'Pharmacie El Amine',
  'pharmacie rehoboth': 'Pharmacie Rehoboth',
  'pharmacie de la mairie de treichville': 'Pharmacie de la Mairie de Treichville'
};

// Dictionnaire de rattrapage des erreurs de commune saisies (OCR ou confusion)
var CORRECTIONS_COMMUNES_EXPLICITES = {
  'nouvelle pharmacie fraternite': { commune: 'Adjamé', quartier: 'Quartier Ebrié' },
  'pharmacie de l entente': { commune: 'Treichville', quartier: 'Quartier Entente' },
  'pharmacie eliashil': { commune: 'Cocody', quartier: 'Riviera 2' },
  'pharmacie saint paul': { commune: 'Koumassi', quartier: 'Sopim' },
  'pharmacie sainte marie de la celle': { commune: 'Bingerville', quartier: 'Bingerville Centre' },
  'fsu com port bouet 2': { commune: 'Yopougon', quartier: 'Port-Bouët 2' }
};

// Coordonnées forcées validées pour pharmacies introuvables ou ayant une coordonnée aberrante
var COORDONNEES_FORCEES_PHARMACIES = {
  'pharmacie rehoboth': { lat: 5.339240, lon: -4.035817, commune: 'Attécoubé', quartier: 'Saint Joseph', titre: 'Pharmacie Rehoboth' },
  'pharmacie el amine': { lat: 5.355812, lon: -4.022541, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Pharmacie El Amine' },
  'pharmacie emily dante': { lat: 5.438510, lon: -4.026520, commune: 'Abobo', quartier: 'Akéikoi', titre: 'Pharmacie Emily-Dante' },
  'pharmacie de la mairie de treichville': { lat: 5.311100, lon: -4.008000, commune: 'Treichville', quartier: 'Nanan Yamousso', titre: 'Pharmacie de la Mairie de Treichville' }
};

var MOTS_VIDES_GEO = {
  grande: 1, nouvelle: 1, pharmacie: 1, phcie: 1, de: 1, du: 1, des: 1, la: 1, le: 1, les: 1,
  d: 1, l: 1, et: 1, a: 1, au: 1, aux: 1, en: 1, sur: 1, cote: 1, ivoire: 1, abidjan: 1,
  principale: 1, ste: 1, st: 1, saint: 1, sainte: 1, nlle: 1, gde: 1,
  chu: 1, chr: 1, hopital: 1, clinique: 1, polyclinique: 1, centre: 1, medical: 1, fsu: 1, csu: 1, cabinet: 1
};

var MOTS_LIEUX_GEO = {
  riviera: 1, cocody: 1, yopougon: 1, abobo: 1, adjame: 1, koumassi: 1, marcory: 1, treichville: 1,
  port: 1, bouet: 1, plateau: 1, attiekoube: 1, anyama: 1, bingerville: 1, songon: 1, angre: 1,
  palmeraie: 1, ii: 1, '2': 1, plateaux: 1, zone: 1, '4': 1, niangon: 1, toits: 1, rouges: 1,
  dokui: 1, pk18: 1, gonzagueville: 1, remblais: 1, bietry: 1, vridi: 1, wassakara: 1, sogefiha: 1,
  kenya: 1, maroc: 1, anono: 1, abatta: 1, mbadon: 1, bonoumin: 1, faya: 1, akouedo: 1
};

// ---------------------------------------------------------------- Outils
function recupererCleGoogleMaps_() {
  try {
    var p = PropertiesService.getScriptProperties().getProperty('MAPS_API_KEY');
    if (p && p.trim()) return p.trim();
  } catch (e) {}
  return CLE_GOOGLE_MAPS_DEFAUT || '';
}

function normGeo_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function distGeoKm_(a, b) {
  if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return 999;
  var R = 6371, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function distanceEditionGeo_(a, b) {
  var n = a.length, m = b.length;
  if (!n) return m;
  if (!m) return n;
  var prev = [], curr = [], i, j;
  for (j = 0; j <= m; j++) prev[j] = j;
  for (i = 1; i <= n; i++) {
    curr[0] = i;
    for (j = 1; j <= m; j++) {
      var cout = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cout);
    }
    for (j = 0; j <= m; j++) prev[j] = curr[j];
  }
  return prev[m];
}

function motsClesGeo_(s, sansLieux) {
  var w = normGeo_(s).split(/\s+/).filter(function (x) {
    return x && x.length >= 2 && !MOTS_VIDES_GEO[x];
  });
  if (sansLieux) {
    var w2 = w.filter(function (x) { return !MOTS_LIEUX_GEO[x]; });
    if (w2.length) return w2;
  }
  return w;
}

function scoreCandidatGeo_(nomCible, nomCand, telCible, htmlCand, titulaireCible) {
  if (telCible && htmlCand) {
    var ch = String(telCible).replace(/\D/g, '');
    if (ch.length >= 8) {
      var reTel = new RegExp(ch.slice(-8).split('').join('\\s*'));
      if (reTel.test(htmlCand)) return 1.0;
    }
  }
  if (titulaireCible && htmlCand) {
    var tParts = normGeo_(String(titulaireCible).replace(/^dr\.?\s*/i, '')).split(/\s+/)
      .filter(function (x) { return x.length >= 4; });
    var hNorm = normGeo_(htmlCand), hits = 0;
    tParts.forEach(function (tp) { if (hNorm.indexOf(tp) >= 0) hits++; });
    if (hits >= 2) return 0.98;
  }
  var best = 0;
  [false, true].forEach(function (strip) {
    var tList = motsClesGeo_(nomCible, strip), cList = motsClesGeo_(nomCand, strip);
    if (!tList.length || !cList.length) return;
    var total = 0;
    tList.forEach(function (t) {
      var wBest = 0;
      cList.forEach(function (c) {
        if (t === c) { wBest = 1.0; return; }
        if (t.length >= 4 && c.length >= 4 && (t.indexOf(c) >= 0 || c.indexOf(t) >= 0)) wBest = Math.max(wBest, 0.85);
        var ed = distanceEditionGeo_(t, c), mx = Math.max(t.length, c.length);
        if (mx >= 4 && ed <= 1) wBest = Math.max(wBest, 0.80);
        else if (mx >= 5 && ed <= 2 && t.charAt(0) === c.charAt(0)) wBest = Math.max(wBest, 0.70);
      });
      total += wBest;
    });
    var sc = total / Math.max(tList.length, cList.length);
    if (sc > best) best = sc;
  });
  return Math.round(best * 100) / 100;
}

// Quartiers de référence (feuille Quartiers : Commune | Quartier | Zone | Latitude | Longitude)
function chargerRefQuartiersGeo_() {
  var parCommune = {}, centres = {};
  try {
    var shQ = SpreadsheetApp.getActive().getSheetByName(GEO_FEUILLE_QUARTIERS);
    if (shQ && shQ.getLastRow() > 1) {
      shQ.getRange(2, 1, shQ.getLastRow() - 1, 5).getValues().forEach(function (v) {
        var lat = parseFloat(String(v[3]).replace(',', '.')), lon = parseFloat(String(v[4]).replace(',', '.'));
        if (isNaN(lat) || isNaN(lon)) return;
        var q = { commune: String(v[0]).trim(), quartier: String(v[1]).trim(), lat: lat, lon: lon };
        var ck = normGeo_(q.commune);
        (parCommune[ck] = parCommune[ck] || []).push(q);
      });
    }
    Object.keys(parCommune).forEach(function (ck) {
      var l = parCommune[ck], sLat = 0, sLon = 0;
      l.forEach(function (x) { sLat += x.lat; sLon += x.lon; });
      centres[ck] = { lat: sLat / l.length, lon: sLon / l.length };
    });
  } catch (e) {}
  return { parCommune: parCommune, centres: centres };
}

function resoudreQuartierGeoloc_(lat, lon, commune, addrText, origQuartier, ref) {
  var ck = normGeo_(commune), addrNorm = ' ' + normGeo_(addrText) + ' ';
  var listeQ = (ref && ref.parCommune[ck]) || [];
  for (var i = 0; i < listeQ.length; i++) {
    var qn = normGeo_(listeQ[i].quartier);
    if (qn.length >= 3 && addrNorm.indexOf(' ' + qn + ' ') >= 0) return listeQ[i].quartier;
  }
  var cleanAddr = String(addrText || '')
    .replace(/^[^,]+,\s*/, '')
    .replace(/,?\s*Abidjan.*$/i, '')
    .replace(/,?\s*C[oô]te d'Ivoire.*$/i, '')
    .replace(/\b\d{2}\s*BP\s*\d+[^,]*,?\s*/gi, '')
    .replace(/^[A-Z0-9]{4}\+[A-Z0-9]{2,3}\s*[^,]*,?\s*/, '')
    .replace(/^[,\s]+|[,\s]+$/g, '');
  var orig = (origQuartier && String(origQuartier).trim() !== 'NL') ? String(origQuartier).trim() : '';
  var utile = cleanAddr.length >= 4 && normGeo_(cleanAddr) !== ck && !/unnamed road/i.test(cleanAddr);
  if (orig && normGeo_(orig) !== ck) {
    return utile && normGeo_(cleanAddr) !== normGeo_(orig) ? orig + ' (' + cleanAddr + ')' : orig;
  }
  var proche = null, minD = 999;
  listeQ.forEach(function (q) { var d = distGeoKm_({ lat: lat, lon: lon }, q); if (d < minD) { minD = d; proche = q; } });
  if (proche && minD <= 4.5) {
    return utile && normGeo_(cleanAddr) !== normGeo_(proche.quartier) ? proche.quartier + ' (' + cleanAddr + ')' : proche.quartier;
  }
  if (utile) return cleanAddr;
  return orig || commune || '';
}

// ---------------------------------------------------------------- Fonction principale de géolocalisation
function geocoderLieu(lieu, quartier, commune, telephone, titulaire, refOpt) {
  var nom = String(lieu || '').trim();
  if (!nom) return null;

  var cleNorm = normGeo_(nom);

  // 1. Consultation prioritaire de la table de référence officielle des établissements de santé
  if (TABLE_REFERENCE_ETABLISSEMENTS_CI[cleNorm]) {
    var etabRef = TABLE_REFERENCE_ETABLISSEMENTS_CI[cleNorm];
    return {
      lat: etabRef.lat,
      lon: etabRef.lon,
      quartier: etabRef.quartier,
      commune: etabRef.commune,
      adresse: etabRef.titre + ', ' + etabRef.quartier + ', ' + etabRef.commune + ', Côte d\'Ivoire',
      titre: etabRef.titre,
      categorie: etabRef.cat || '',
      source: 'Ref-Officielle-CI',
      score: 1.0,
      distKm: 0.1
    };
  }

  // 2. Consultation des coordonnées forcées pharmacies
  if (COORDONNEES_FORCEES_PHARMACIES[cleNorm]) {
    var phForcee = COORDONNEES_FORCEES_PHARMACIES[cleNorm];
    return {
      lat: phForcee.lat,
      lon: phForcee.lon,
      quartier: phForcee.quartier,
      commune: phForcee.commune,
      adresse: phForcee.titre + ', ' + phForcee.quartier + ', ' + phForcee.commune + ', Côte d\'Ivoire',
      titre: phForcee.titre,
      source: 'Ref-Pharmacie-CI',
      score: 1.0,
      distKm: 0.1
    };
  }

  // 3. Correction automatique des communes mal affectées (OCR ou erreur de saisie)
  var comPropre = (commune && String(commune).trim() !== 'NL') ? String(commune).trim() : '';
  if (CORRECTIONS_COMMUNES_EXPLICITES[cleNorm]) {
    comPropre = CORRECTIONS_COMMUNES_EXPLICITES[cleNorm].commune;
    if (!quartier || String(quartier).trim() === 'NL') {
      quartier = CORRECTIONS_COMMUNES_EXPLICITES[cleNorm].quartier;
    }
  }

  var qPropre = (quartier && String(quartier).trim() !== 'NL') ? String(quartier).trim() : '';

  // Cache
  var cache = null, cleCache = 'geo4:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, [nom, qPropre, comPropre, telephone || ''].join('|')));
  try {
    cache = CacheService.getScriptCache();
    var c = cache.get(cleCache);
    if (c) return c === 'x' ? null : JSON.parse(c);
  } catch (e) {}

  var ref = refOpt || chargerRefQuartiersGeo_();
  var ck = normGeo_(comPropre), comRef = ref.centres[ck] || null;

  var nomRecherche = CORRECTIONS_OCR_PHARMACIES[cleNorm] || nom;
  var estEtablissementSante = /^(chu|chr|hopital|clinique|polyclinique|centre medical|fsu|csu|institut|dispensaire)/i.test(nomRecherche);

  var sansPrefixe = estEtablissementSante ? nomRecherche :
    nomRecherche.replace(/^(Nouvelle\s+Pharmacie\s+Principale\s+de\s+|Pharmacie\s+Principale\s+de\s+|Pharmacie\s+Principale\s+d'|Grande\s+|Nouvelle\s+)/i, 'Pharmacie ')
                .replace(/^Pharmacie\s+Pharmacie\s+/i, 'Pharmacie ');

  var nomCoeur = estEtablissementSante ? motsClesGeo_(nomRecherche, true).join(' ')
                                       : 'Pharmacie ' + motsClesGeo_(nomRecherche, true).join(' ');

  var qPart = (qPropre && normGeo_(qPropre) !== ck) ? qPropre + ', ' : '';
  var comPart = comPropre ? comPropre + ', ' : '';

  var requetes = [
    nomRecherche + ', ' + qPart + comPart + 'Côte d\'Ivoire',
    sansPrefixe + ', ' + qPart + comPart + 'Côte d\'Ivoire',
    nomCoeur + ', ' + comPart + 'Côte d\'Ivoire',
    sansPrefixe + ', Côte d\'Ivoire',
    nomCoeur + ', Abidjan, Côte d\'Ivoire'
  ].filter(function (q, i, a) { return a.indexOf(q) === i; });

  var meilleur = null, vusCid = {};
  var reSpot = /\["0x[0-9a-f]+:0x[0-9a-f]+","([^"]+)",\[(-?\d+\.\d+),(-?\d+\.\d+)\],"(\d+)"\],"([^"]+)"/;
  var reCids = /\["[^"]+","(\d{10,22})"\],"\/g\/[^"]+",null,\[(-?\d+),(-?\d+)\]/g;
  var optsHttp = { muteHttpExceptions: true, headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' } };

  function evaluer_(titre, adr, lat, lon, htmlSrc, source) {
    // Garde-fou strict sur la Côte d'Ivoire (lat entre 4.30 et 10.80, lon entre -8.60 et -2.40)
    if (isNaN(lat) || isNaN(lon) || lat <= 4.30 || lat >= 10.80 || lon <= -8.60 || lon >= -2.40) return null;
    var sc = scoreCandidatGeo_(nomRecherche, titre, telephone, htmlSrc, titulaire);
    var d = comRef ? distGeoKm_({ lat: lat, lon: lon }, comRef) : 0;
    if (!((sc >= 0.55 && d <= 22) || sc >= 0.85)) return null;
    var cand = { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6,
                 quartier: resoudreQuartierGeoloc_(lat, lon, comPropre, adr, qPropre, ref),
                 adresse: adr, titre: titre, source: source, score: sc, distKm: Math.round(d * 10) / 10 };
    if (!meilleur || sc > meilleur.score) meilleur = cand;
    return cand;
  }
  function sur_(c) { return c && c.score >= 0.85 && c.distKm <= 22; }

  // 4. Google Maps Platform API officielle
  var cleApi = recupererCleGoogleMaps_();
  if (cleApi && !sur_(meilleur)) {
    for (var iq0 = 0; iq0 < requetes.length && !sur_(meilleur); iq0++) {
      try {
        var urlGeo = 'https://maps.googleapis.com/maps/api/geocode/json?address=' +
                     encodeURIComponent(requetes[iq0]) + '&components=country:CI&language=fr&key=' + cleApi;
        var rGeo = JSON.parse(UrlFetchApp.fetch(urlGeo, optsHttp).getContentText());
        if (rGeo && rGeo.status === 'OK' && rGeo.results && rGeo.results.length) {
          for (var ir = 0; ir < rGeo.results.length; ir++) {
            var item = rGeo.results[ir];
            var g = item.geometry && item.geometry.location;
            var locType = (item.geometry && item.geometry.location_type) || '';
            var types = item.types || [];
            if (!g || isNaN(g.lat) || isNaN(g.lng)) continue;
            var estCentroide = types.indexOf('locality') >= 0 || types.indexOf('administrative_area_level_1') >= 0;
            if (estCentroide && locType === 'APPROXIMATE') continue;
            var nomTrouve = item.formatted_address ? item.formatted_address.split(',')[0] : nomRecherche;
            if (sur_(evaluer_(nomTrouve, item.formatted_address || '', g.lat, g.lng, '', 'GMaps-API'))) break;
          }
        }
      } catch (e) {}
    }
    if (!meilleur || meilleur.score < 0.75) {
      try {
        var qPlaces = [nomRecherche, qPropre, comPropre, 'Côte d\'Ivoire'].filter(Boolean).join(' ');
        var resPlaces = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'X-Goog-Api-Key': cleApi,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types'
          },
          payload: JSON.stringify({ textQuery: qPlaces, languageCode: 'fr', regionCode: 'ci' }),
          muteHttpExceptions: true
        });
        var jsPlaces = JSON.parse(resPlaces.getContentText());
        if (jsPlaces && jsPlaces.places && jsPlaces.places.length) {
          var p0 = jsPlaces.places[0];
          if (p0.location && !isNaN(p0.location.latitude) && !isNaN(p0.location.longitude)) {
            var t0 = (p0.displayName && p0.displayName.text) || nomRecherche;
            evaluer_(t0, p0.formattedAddress || '', p0.location.latitude, p0.location.longitude, '', 'Places-API-New');
          }
        }
      } catch (e) {}
    }
  }

  // 5. Google Maps Embed (Direct + CID)
  for (var iq = 0; iq < requetes.length && !sur_(meilleur); iq++) {
    try {
      var html = UrlFetchApp.fetch('https://www.google.com/maps?q=' + encodeURIComponent(requetes[iq]) + '&output=embed&hl=fr', optsHttp).getContentText();
      var m1 = reSpot.exec(html);
      if (m1) { vusCid[m1[4]] = true; if (sur_(evaluer_(m1[5], m1[1], +m1[2], +m1[3], html, 'GMaps-Direct'))) break; }
      var mc, nb = 0;
      reCids.lastIndex = 0;
      while ((mc = reCids.exec(html)) !== null && nb < 6) {
        if (vusCid[mc[1]]) continue;
        vusCid[mc[1]] = true; nb++;
        var h2 = UrlFetchApp.fetch('https://www.google.com/maps?cid=' + mc[1] + '&output=embed&hl=fr', optsHttp).getContentText();
        var m2 = reSpot.exec(h2);
        if (m2 && sur_(evaluer_(m2[5], m2[1], +m2[2], +m2[3], h2, 'GMaps-CID'))) break;
      }
      if (meilleur && meilleur.score >= 0.75) break;
    } catch (e) {}
  }

  // 6. ArcGIS POI
  if (!meilleur || meilleur.score < 0.75) {
    [nomRecherche + ', ' + qPart + comPropre, sansPrefixe + ', ' + qPart + comPropre, nomCoeur + ', ' + comPart + 'Côte d\'Ivoire'].some(function (q) {
      try {
        var url = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=' +
                  encodeURIComponent(q) + '&countryCode=CIV&maxLocations=5&outFields=PlaceName,Place_addr,Type&f=json';
        var js = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
        (js.candidates || []).forEach(function (c) {
          var tp = (c.attributes && c.attributes.Type) || '';
          if (/^(City|Locality|Neighborhood|Administrative|Postal)$/i.test(tp)) return;
          evaluer_(c.attributes.PlaceName || '', c.attributes.Place_addr || '', +c.location.y, +c.location.x, '', 'ArcGIS-POI');
        });
      } catch (e) {}
      return meilleur && meilleur.score >= 0.75;
    });
  }

  // 7. Apps Script Maps Geocoder
  if (!meilleur && typeof Maps !== 'undefined') {
    try {
      var r = Maps.newGeocoder().setRegion('ci').setLanguage('fr').geocode([sansPrefixe, qPropre, comPropre, 'Côte d\'Ivoire'].filter(Boolean).join(', '));
      var r0 = r && r.status === 'OK' && r.results && r.results[0], types = (r0 && r0.types) || [];
      var g = r0 && r0.geometry && r0.geometry.location;
      var precis = types.indexOf('pharmacy') >= 0 || types.indexOf('establishment') >= 0 || types.indexOf('point_of_interest') >= 0 ||
                   types.indexOf('hospital') >= 0 || types.indexOf('health') >= 0 || (r0 && r0.geometry.location_type === 'ROOFTOP');
      if (precis && g && g.lat > 4.30 && g.lat < 10.80 && g.lng > -8.60 && g.lng < -2.40) {
        meilleur = { lat: Math.round(g.lat * 1e6) / 1e6, lon: Math.round(g.lng * 1e6) / 1e6,
                     quartier: resoudreQuartierGeoloc_(g.lat, g.lng, comPropre, r0.formatted_address || '', qPropre, ref),
                     adresse: r0.formatted_address || '', titre: nom, source: 'Maps-Service', score: 0.75 };
      }
    } catch (e) {}
  }

  try { if (cache) cache.put(cleCache, meilleur ? JSON.stringify(meilleur) : 'x', meilleur ? 21600 : 3600); } catch (e) {}
  return meilleur;
}

// ---------------------------------------------------------------- Fonctions d'exécution de lot
function testerGeocodage5Pharmacies() { return executerLotGeocodagePharmacies_(5); }
function completerGeolocPharmacies() { return executerLotGeocodagePharmacies_(30); }
function testerGeocodage5Presences() { return executerLotGeocodagePresences_(5); }
function completerGeolocPresences() { return executerLotGeocodagePresences_(40); }
function completerGeolocToutesPresences() { return executerLotGeocodagePresences_(300); }

function executerLotGeocodagePharmacies_(limiteMax) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(GEO_FEUILLE_PHARMACIES);
    if (!sh || sh.getLastRow() < 2) return 'Feuille Pharmacies absente ou vide.';
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normGeo_);
    function col(nomCol) { return ent.indexOf(normGeo_(nomCol)); }
    var cCode = col('CodeContact'), cNom = col('Nom'), cTit = col('Titulaire'), cQuart = col('Quartier'),
        cCom = col('Commune'), cTel = col('Téléphone'), cLat = col('Latitude'), cLon = col('Longitude');
    if (cNom < 0 || cLat < 0 || cLon < 0 || cQuart < 0) return 'Colonnes Nom / Quartier / Latitude / Longitude introuvables.';

    var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    var ref = chargerRefQuartiersGeo_(), traites = 0, trouves = 0, details = [];

    for (var i = 0; i < data.length && traites < limiteMax; i++) {
      var r = data[i];
      var lat = String(r[cLat]).trim(), lon = String(r[cLon]).trim(), q = String(r[cQuart]).trim();
      var latNum = parseFloat(lat.replace(',', '.'));
      var manqueGps = !lat || lat === 'NL' || !lon || lon === 'NL' || isNaN(latNum) || latNum < 4.30 || latNum > 10.80;
      var manqueQ = !q || q === 'NL';
      if (!manqueGps && !manqueQ) continue;
      traites++;
      var g = geocoderLieu(r[cNom], q, cCom >= 0 ? r[cCom] : '', cTel >= 0 ? r[cTel] : '', cTit >= 0 ? r[cTit] : '', ref);
      var ident = (cCode >= 0 ? r[cCode] + ' ' : '') + r[cNom];
      if (g) {
        trouves++;
        if (manqueGps) { sh.getRange(i + 2, cLat + 1).setValue(g.lat); sh.getRange(i + 2, cLon + 1).setValue(g.lon); }
        if (manqueQ && g.quartier) sh.getRange(i + 2, cQuart + 1).setValue(g.quartier);
        details.push('✓ ' + ident + ' → ' + g.titre + ' | ' + (g.quartier || q) + ' | ' + g.lat + ', ' + g.lon);
      } else {
        details.push('✗ ' + ident + ' → non trouvée');
      }
    }
    var msg = traites ? (trouves + ' / ' + traites + ' pharmacies géolocalisées :\n\n' + details.join('\n'))
                      : 'Toutes les pharmacies sont déjà géolocalisées avec un GPS valide.';
    Logger.log(msg);
    try { SpreadsheetApp.getUi().alert('Géolocalisation des pharmacies', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
    return msg;
  } finally {
    lock.releaseLock();
  }
}

function executerLotGeocodagePresences_(limiteMax) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(GEO_FEUILLE_PRESENCES) || ss.getSheetByName('Présences');
    if (!sh || sh.getLastRow() < 2) return 'Feuille Presences absente ou vide.';

    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normGeo_);
    function col(nomCol) { return ent.indexOf(normGeo_(nomCol)); }

    var cLieu = col('Lieu/Etablissement');
    if (cLieu < 0) cLieu = col('Lieu');
    if (cLieu < 0) cLieu = col('Etablissement');
    if (cLieu < 0) cLieu = 3;

    var cQuart = col('Quartier'), cCom = col('Commune'), cNom = col('Nom'), cCode = col('CodeContact');
    var cLat = col('Latitude'); if (cLat < 0) cLat = col('Lattitude');
    var cLon = col('Longitude');

    if (cLat < 0 || cLon < 0) {
      var derniereCol = sh.getLastColumn();
      if (cLat < 0) { cLat = derniereCol; sh.getRange(1, cLat + 1).setValue('Latitude'); derniereCol++; }
      if (cLon < 0) { cLon = derniereCol; sh.getRange(1, cLon + 1).setValue('Longitude'); }
    }

    var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    var ref = chargerRefQuartiersGeo_();
    var cacheEtab = {};

    // Pré-remplir le cache avec la table de référence officielle en priorité absolue
    Object.keys(TABLE_REFERENCE_ETABLISSEMENTS_CI).forEach(function (k) {
      cacheEtab[k] = TABLE_REFERENCE_ETABLISSEMENTS_CI[k];
    });

    for (var k = 0; k < data.length; k++) {
      var lk = data[k];
      var nomEtab = String(lk[cLieu] || '').trim();
      var latVal = parseFloat(String(lk[cLat] || '').replace(',', '.'));
      var lonVal = parseFloat(String(lk[cLon] || '').replace(',', '.'));
      if (nomEtab && !isNaN(latVal) && !isNaN(lonVal) && latVal >= 4.30 && latVal <= 10.80) {
        var cle = normGeo_(nomEtab);
        if (!cacheEtab[cle]) {
          cacheEtab[cle] = {
            lat: latVal,
            lon: lonVal,
            quartier: cQuart >= 0 ? String(lk[cQuart] || '').trim() : '',
            commune: cCom >= 0 ? String(lk[cCom] || '').trim() : '',
            titre: nomEtab
          };
        }
      }
    }

    var traites = 0, trouves = 0, details = [];

    for (var i = 0; i < data.length && traites < limiteMax; i++) {
      var r = data[i];
      var etab = String(r[cLieu] || '').trim();
      if (!etab) continue;

      var latStr = String(r[cLat] || '').trim();
      var lonStr = String(r[cLon] || '').trim();
      var latN = parseFloat(latStr.replace(',', '.'));
      var manqueGps = !latStr || latStr === 'NL' || !lonStr || lonStr === 'NL' || isNaN(latN) || latN < 4.30 || latN > 10.80;

      if (!manqueGps) continue;

      traites++;
      var cleEtab = normGeo_(etab);
      var q = cQuart >= 0 ? String(r[cQuart] || '').trim() : '';
      var com = cCom >= 0 ? String(r[cCom] || '').trim() : '';
      var g = cacheEtab[cleEtab];
      var provenance = 'Cache établissement';

      if (!g) {
        g = geocoderLieu(etab, q, com, '', '', ref);
        provenance = g ? g.source : 'Google Maps API';
        if (g) cacheEtab[cleEtab] = g;
      }

      var ident = etab + (q ? ' (' + q + ')' : '');
      if (g) {
        trouves++;
        sh.getRange(i + 2, cLat + 1).setValue(g.lat);
        sh.getRange(i + 2, cLon + 1).setValue(g.lon);
        if ((!q || q === 'NL') && g.quartier && cQuart >= 0) {
          sh.getRange(i + 2, cQuart + 1).setValue(g.quartier);
        }
        details.push('✓ ' + ident + ' → ' + g.titre + ' | ' + g.lat + ', ' + g.lon + ' [' + provenance + ']');
      } else {
        details.push('✗ ' + ident + ' → non trouvé');
      }
    }

    var msg = traites ? (trouves + ' / ' + traites + ' lieux de présence géolocalisés :\n\n' + details.join('\n'))
                      : 'Tous les lieux de présence ont déjà leurs coordonnées GPS valides.';
    Logger.log(msg);
    try { SpreadsheetApp.getUi().alert('Géolocalisation des lieux de présence', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
    return msg;
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Formules de cellule
function GEOCODE_GOOGLE(texte) {
  var p = String(texte || '').split(',').map(function (x) { return x.trim(); });
  var g = geocoderLieu(p[0], p.length > 2 ? p[1] : '', p[p.length > 2 ? 2 : 1] || '');
  return g ? g.lat + ', ' + g.lon : 'Introuvable';
}
function GET_LAT_LONG(texte) { return GEOCODE_GOOGLE(texte); }
function PLACE(texte) {
  var p = String(texte || '').split(',').map(function (x) { return x.trim(); });
  var g = geocoderLieu(p[0], p.length > 2 ? p[1] : '', p[p.length > 2 ? 2 : 1] || '');
  return g ? g.titre + ' — ' + g.quartier + ' (' + g.lat + ', ' + g.lon + ')' : 'Introuvable';
}

// ---------------------------------------------------------------- Audit complet automatisé de la base
function auditerGeolocBase() {
  var ss = SpreadsheetApp.getActive();
  var shPres = ss.getSheetByName(GEO_FEUILLE_PRESENCES) || ss.getSheetByName('Présences');
  var shPha = ss.getSheetByName(GEO_FEUILLE_PHARMACIES);
  var shQ = ss.getSheetByName(GEO_FEUILLE_QUARTIERS);

  var centresQuartiers = {};
  if (shQ && shQ.getLastRow() >= 2) {
    var vQ = shQ.getRange(2, 1, shQ.getLastRow() - 1, 5).getValues();
    vQ.forEach(function (r) {
      var nQ = normGeo_(r[1]);
      if (nQ) centresQuartiers[nQ] = { lat: parseFloat(String(r[3]).replace(',', '.')), lon: parseFloat(String(r[4]).replace(',', '.')) };
    });
  }

  var lignesAudit = [];
  var stats = { total: 0, precis: 0, centroides: 0, manquants: 0 };
  var clusters = {};

  function analyserLigne(type, code, nom, lieu, commune, quartier, latStr, lonStr) {
    stats.total++;
    var lat = parseFloat(String(latStr || '').replace(',', '.'));
    var lon = parseFloat(String(lonStr || '').replace(',', '.'));
    var valide = isFinite(lat) && isFinite(lon) && lat >= 4.30 && lat <= 10.80 && lon >= -8.60 && lon <= -2.40;

    var cleNorm = normGeo_(lieu || nom);
    var etabRef = TABLE_REFERENCE_ETABLISSEMENTS_CI[cleNorm] || COORDONNEES_FORCEES_PHARMACIES[cleNorm];

    var statut = '', diag = '', action = '';

    if (!valide) {
      statut = '🔴 MANQUANT';
      diag = 'Coordonnées absentes ou hors Côte d\'Ivoire';
      action = 'À géolocaliser d\'urgence (Places API ou relever au GPS terrain)';
      stats.manquants++;
    } else {
      var qCle = normGeo_(quartier);
      var cQ = centresQuartiers[qCle];
      var estCentroideQuartier = cQ && Math.abs(lat - cQ.lat) < 0.0005 && Math.abs(lon - cQ.lon) < 0.0005;

      var kCoord = lat.toFixed(4) + '|' + lon.toFixed(4);
      clusters[kCoord] = clusters[kCoord] || [];
      clusters[kCoord].push({ nom: nom, lieu: lieu });

      if (etabRef) {
        statut = '🟢 EXACT (RÉFÉRENCE)';
        diag = 'Établissement officiel certifié : ' + etabRef.titre;
        action = 'Position vérifiée et conforme';
        stats.precis++;
      } else if (estCentroideQuartier) {
        statut = '🟡 CENTROÏDE QUARTIER';
        diag = 'Position calée sur le centre géométrique de ' + quartier;
        action = 'Remplacer par la position exacte du bâtiment (Places API ou bouton GPS ici)';
        stats.centroides++;
      } else {
        statut = '🟢 GPS SPÉCIFIQUE';
        diag = 'Coordonnées individualisées distinctes du centre de quartier';
        action = 'Conforme';
        stats.precis++;
      }
    }

    lignesAudit.push([
      statut,
      type,
      code || '',
      nom || '',
      lieu || '',
      commune || '',
      quartier || '',
      valide ? lat : '',
      valide ? lon : '',
      diag,
      etabRef ? etabRef.titre : '',
      action
    ]);
  }

  // 1. Analyser Presences
  if (shPres && shPres.getLastRow() >= 2) {
    var entP = shPres.getRange(1, 1, 1, shPres.getLastColumn()).getValues()[0].map(normGeo_);
    function colP(nom) { return entP.indexOf(normGeo_(nom)); }
    var cCode = colP('CodeContact'), cNom = colP('Nom'), cLieu = colP('Lieu/Etablissement');
    if (cLieu < 0) cLieu = colP('Lieu');
    var cCom = colP('Commune'), cQuart = colP('Quartier');
    var cLat = colP('Latitude'); if (cLat < 0) cLat = colP('Lattitude');
    var cLon = colP('Longitude');

    var dP = shPres.getRange(2, 1, shPres.getLastRow() - 1, shPres.getLastColumn()).getValues();
    dP.forEach(function (r) {
      analyserLigne('Médecin / Établissement', r[cCode], r[cNom], r[cLieu], r[cCom], r[cQuart], r[cLat], r[cLon]);
    });
  }

  // 2. Analyser Pharmacies
  if (shPha && shPha.getLastRow() >= 2) {
    var entPh = shPha.getRange(1, 1, 1, shPha.getLastColumn()).getValues()[0].map(normGeo_);
    function colPh(nom) { return entPh.indexOf(normGeo_(nom)); }
    var cCodePh = colPh('CodeContact'), cNomPh = colPh('Nom'), cComPh = colPh('Commune'), cQuartPh = colPh('Quartier');
    var cLatPh = colPh('Latitude'), cLonPh = colPh('Longitude');

    var dPh = shPha.getRange(2, 1, shPha.getLastRow() - 1, shPha.getLastColumn()).getValues();
    dPh.forEach(function (r) {
      analyserLigne('Pharmacie', r[cCodePh], r[cNomPh], r[cNomPh], r[cComPh], r[cQuartPh], r[cLatPh], r[cLonPh]);
    });
  }

  // Créer ou remplacer la feuille Rapport_Audit_GPS
  var nomFeuilleAudit = 'Rapport_Audit_GPS';
  var shAudit = ss.getSheetByName(nomFeuilleAudit);
  if (shAudit) ss.deleteSheet(shAudit);
  shAudit = ss.insertSheet(nomFeuilleAudit);

  var scoreSante = stats.total > 0 ? Math.round((stats.precis / stats.total) * 100) : 0;
  shAudit.getRange('A1:L1').merge().setValue('AUDIT QUALITÉ DE GÉOLOCALISATION GPS — MEDIPLANNER')
    .setFontWeight('bold').setFontSize(14).setBackground('#0B4F6C').setFontColor('#ffffff').setHorizontalAlignment('center');

  shAudit.getRange('A2:L2').merge().setValue(
    'Total analysé : ' + stats.total + ' fiches  |  ' +
    '🟢 Précis & Certifiés : ' + stats.precis + '  |  ' +
    '🟡 Centroïdes de quartier à affiner : ' + stats.centroides + '  |  ' +
    '🔴 Coordonnées manquantes : ' + stats.manquants + '  |  ' +
    'Taux de santé GPS : ' + scoreSante + ' %'
  ).setFontWeight('bold').setFontSize(11).setBackground('#e2e8f0').setHorizontalAlignment('center');

  var enTetes = ['Statut GPS', 'Type', 'Code', 'Nom Praticien', 'Établissement / Lieu', 'Commune', 'Quartier', 'Latitude', 'Longitude', 'Diagnostic', 'Référence officielle', 'Action recommandée'];
  shAudit.getRange(4, 1, 1, enTetes.length).setValues([enTetes])
    .setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');

  if (lignesAudit.length > 0) {
    shAudit.getRange(5, 1, lignesAudit.length, enTetes.length).setValues(lignesAudit);
    shAudit.setFrozenRows(4);
    shAudit.autoResizeColumns(1, enTetes.length);
  }

  var msgUi = 'Audit Qualité GPS terminé !\n\n' +
    'Total fiches : ' + stats.total + '\n' +
    '🟢 Précis / Certifiés : ' + stats.precis + '\n' +
    '🟡 Centroïdes quartier : ' + stats.centroides + '\n' +
    '🔴 Manquants / Hors CI : ' + stats.manquants + '\n' +
    'Score global : ' + scoreSante + ' %\n\n' +
    'L\'onglet « ' + nomFeuilleAudit + ' » a été créé dans votre Google Sheet avec le diagnostic ligne par ligne.';
  try { SpreadsheetApp.getUi().alert('Rapport d\'Audit GPS', msgUi, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return msgUi;
}
