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
var TABLE_REFERENCE_ETABLISSEMENTS_CI = {
  // CHU (Centres Hospitaliers Universitaires)
  'chu de cocody': { lat: 5.343512, lon: -3.993045, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CHU de Cocody' },
  'chu cocody': { lat: 5.343512, lon: -3.993045, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'CHU de Cocody' },
  'chu de treichville': { lat: 5.291248, lon: -4.003582, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'CHU de Treichville' },
  'chu treichville': { lat: 5.291248, lon: -4.003582, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'CHU de Treichville' },
  'chu de yopougon': { lat: 5.358419, lon: -4.089692, commune: 'Yopougon', quartier: 'Quartier Hôpital', titre: 'CHU de Yopougon' },
  'chu yopougon': { lat: 5.358419, lon: -4.089692, commune: 'Yopougon', quartier: 'Quartier Hôpital', titre: 'CHU de Yopougon' },
  'chu d angre': { lat: 5.401021, lon: -3.957441, commune: 'Cocody', quartier: 'Angré Djibi', titre: 'CHU d\'Angré' },
  'chu angre': { lat: 5.401021, lon: -3.957441, commune: 'Cocody', quartier: 'Angré Djibi', titre: 'CHU d\'Angré' },

  // Instituts Spécialisés Nationaux
  'institut de cardiologie d abidjan': { lat: 5.291192, lon: -4.003561, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Institut de Cardiologie d\'Abidjan (ICA)' },
  'institut de cardiologie': { lat: 5.291192, lon: -4.003561, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Institut de Cardiologie d\'Abidjan (ICA)' },
  'ica': { lat: 5.291192, lon: -4.003561, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Institut de Cardiologie d\'Abidjan (ICA)' },
  'hopital militaire d abidjan': { lat: 5.381682, lon: -4.007251, commune: 'Adjamé', quartier: 'Paillet', titre: 'Hôpital Militaire d\'Abidjan (HMA)' },
  'hma': { lat: 5.381682, lon: -4.007251, commune: 'Adjamé', quartier: 'Paillet', titre: 'Hôpital Militaire d\'Abidjan (HMA)' },
  'institut pasteur de cote d ivoire': { lat: 5.344015, lon: -3.993021, commune: 'Cocody', quartier: 'Cocody Centre', titre: 'Institut Pasteur de Côte d\'Ivoire (IPCI - CHU Cocody)' },
  'centre national de transfusion sanguine': { lat: 5.291530, lon: -4.004015, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Centre National de Transfusion Sanguine (CNTS)' },
  'cnts': { lat: 5.291530, lon: -4.004015, commune: 'Treichville', quartier: 'Zone 3 (CHU)', titre: 'Centre National de Transfusion Sanguine (CNTS)' },
  'institut national de sante publique': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Institut National de Santé Publique (INSP - Adjamé)' },
  'insp': { lat: 5.337829, lon: -4.026298, commune: 'Adjamé', quartier: 'Adjamé Centre', titre: 'Institut National de Santé Publique (INSP)' },

  // CHR & Hôpitaux Généraux
  'chr d abobo': { lat: 5.443152, lon: -4.007874, commune: 'Abobo', quartier: 'Abobo Nord', titre: 'CHR d\'Abobo (Hôpital Houphouët-Boigny)' },
  'hopital general d abobo': { lat: 5.423721, lon: -4.016362, commune: 'Abobo', quartier: 'Sagbé', titre: 'Hôpital Général d\'Abobo (Sagbé)' },
  'hopital henriette bedie d avocatier': { lat: 5.438752, lon: -4.024201, commune: 'Abobo', quartier: 'Avocatier', titre: 'Hôpital Henriette Bédié d\'Avocatier' },
  'hopital henriette bedie de l avocatier': { lat: 5.438752, lon: -4.024201, commune: 'Abobo', quartier: 'Avocatier', titre: 'Hôpital Henriette Bédié d\'Avocatier' },
  'hopital general de port bouet': { lat: 5.262612, lon: -3.962174, commune: 'Port-Bouët', quartier: 'Petit Bassam', titre: 'Hôpital Général de Port-Bouët' },
  'hopital general de koumassi': { lat: 5.287321, lon: -3.969532, commune: 'Koumassi', quartier: 'Koumassi Sicogi', titre: 'Hôpital Général de Koumassi' },
  'hopital general de marcory': { lat: 5.300681, lon: -3.983292, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Hôpital Général de Marcory' },
  'hopital general d adjame': { lat: 5.348821, lon: -4.024671, commune: 'Adjamé', quartier: 'Williamsville', titre: 'Hôpital Général d\'Adjamé' },
  'hopital general de treichville': { lat: 5.311102, lon: -4.007991, commune: 'Treichville', quartier: 'Nanan Yamousso', titre: 'Hôpital Général de Treichville' },
  'hopital general de yopougon attie': { lat: 5.341431, lon: -4.080032, commune: 'Yopougon', quartier: 'Attié', titre: 'Hôpital Général de Yopougon-Attié' },
  'hopital general de bingerville': { lat: 5.360062, lon: -3.885311, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Général de Bingerville' },
  'hopital mere enfant dominique ouattara': { lat: 5.361792, lon: -3.883904, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Mère-Enfant Dominique Ouattara' },
  'hopital mere enfant': { lat: 5.361792, lon: -3.883904, commune: 'Bingerville', quartier: 'Bingerville Centre', titre: 'Hôpital Mère-Enfant Dominique Ouattara' },
  'hopital general d anyama': { lat: 5.501021, lon: -4.045752, commune: 'Anyama', quartier: 'Anyama Centre', titre: 'Hôpital Général d\'Anyama' },

  // Grandes Polycliniques Privées de Référence
  'polyclinique internationale sainte anne marie': { lat: 5.336904, lon: -4.013442, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Polyclinique Internationale Sainte Anne-Marie (PISAM)' },
  'pisam': { lat: 5.336904, lon: -4.013442, commune: 'Cocody', quartier: 'Vieux Cocody', titre: 'Polyclinique Internationale Sainte Anne-Marie (PISAM)' },
  'polyclinique farah': { lat: 5.310672, lon: -3.986451, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Farah' },
  'clinique farah': { lat: 5.310672, lon: -3.986451, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Farah' },
  'polyclinique des deux plateaux': { lat: 5.363242, lon: -3.999112, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Polyclinique des Deux Plateaux (Novamed)' },
  'polyclinique des 2 pltx': { lat: 5.363242, lon: -3.999112, commune: 'Cocody', quartier: 'Deux Plateaux', titre: 'Polyclinique des Deux Plateaux (Novamed)' },
  'polyclinique internationale de l indenie': { lat: 5.338381, lon: -4.019072, commune: 'Plateau', quartier: 'Indénié', titre: 'Polyclinique Internationale de l\'Indénié' },
  'clinique de l indenie': { lat: 5.338381, lon: -4.019072, commune: 'Plateau', quartier: 'Indénié', titre: 'Polyclinique Internationale de l\'Indénié' },
  'polyclinique avicennes': { lat: 5.316221, lon: -3.996662, commune: 'Marcory', quartier: 'Marcory Résidentiel', titre: 'Polyclinique Avicennes' },
  'polyclinique groupe medical du plateau': { lat: 5.320703, lon: -4.014141, commune: 'Plateau', quartier: 'Plateau', titre: 'Polyclinique Groupe Médical du Plateau (GMP)' },
  'gmp': { lat: 5.320703, lon: -4.014141, commune: 'Plateau', quartier: 'Plateau', titre: 'Polyclinique Groupe Médical du Plateau (GMP)' },
  'polyclinique sacre coeur': { lat: 5.364631, lon: -3.979812, commune: 'Cocody', quartier: 'Riviera Attoban', titre: 'Polyclinique Sacré-Cœur' },
  'polyclinique sainte therese': { lat: 5.304021, lon: -3.984032, commune: 'Marcory', quartier: 'Marcory Centre', titre: 'Polyclinique Sainte-Thérèse' },

  // Cliniques Réputées & FSU Stratégiques
  'clinique medicale danga': { lat: 5.340141, lon: -4.008922, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique Médicale Danga' },
  'clinique danga': { lat: 5.340141, lon: -4.008922, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique Médicale Danga' },
  'clinique la providence': { lat: 5.347312, lon: -4.009571, commune: 'Cocody', quartier: 'Danga', titre: 'Clinique La Providence' },
  'clinique medicale le grand centre': { lat: 5.334051, lon: -4.093562, commune: 'Yopougon', quartier: 'Niangon', titre: 'Clinique Médicale Le Grand Centre' },
  'fsu com port bouet 2': { lat: 5.347124, lon: -4.093089, commune: 'Yopougon', quartier: 'Port-Bouët 2', titre: 'FSU COM Port-Bouët 2 (Yopougon)' }
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
