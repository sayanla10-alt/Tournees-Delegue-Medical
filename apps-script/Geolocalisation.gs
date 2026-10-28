/* =============================================================================
   Geolocalisation.gs : géolocalisation précise des pharmacies (MediPlanner v3.25.26)
   Fichier AUTONOME : à coller dans Extensions > Apps Script, comme nouveau fichier.

   Ce qu'il fait :
   - Cherche chaque pharmacie dans TOUTE la Côte d'Ivoire (pas seulement Abidjan)
   - Ignore les valeurs "NL", corrige les erreurs de lecture connues (Semeur -> Sanwi, ...)
   - Essaie plusieurs variantes du nom (sans "Grande", "Nouvelle", "Principale", sans mot de quartier)
   - Sources : Google Maps (fiche directe + liste de résultats) -> ArcGIS -> service Maps d'Apps Script
   - Vérifie le résultat (nom proche, téléphone ou titulaire identique, distance <= 22 km de la commune)
   - Refuse le "centre-ville" renvoyé quand la pharmacie n'est pas trouvée
   - Renvoie { lat, lon, quartier, adresse, titre, source, score }

   Fonctions à lancer :
   - testerGeocodage5Pharmacies()  : traite 5 pharmacies maximum (GPS ou quartier = NL / vide)
   - completerGeolocPharmacies()   : traite 25 pharmacies maximum par exécution
   Formules de cellule : =GEOCODE_GOOGLE("nom, commune")  =GET_LAT_LONG(...)  =PLACE(...)
   ============================================================================= */

var GEO_FEUILLE_PHARMACIES = 'Pharmacies';
var GEO_FEUILLE_QUARTIERS = 'Quartiers';
var CLE_GOOGLE_MAPS_DEFAUT = ''; // Laisser vide si stocké dans Propriétés du script sous le nom 'MAPS_API_KEY'

// Erreurs de lecture de la "Liste terrain (photos)" vérifiées (téléphone / titulaire)
var CORRECTIONS_OCR_PHARMACIES = {
  'grande pharmacie du semeur': 'Grande Pharmacie du Sanwi',
  'nouvelle pharmacie adiam': 'Nouvelle Pharmacie du Marché d\'Adjamé',
  'nouvelle pharmacie de la rive': 'Pharmacie de la Mé',
  'nouvelle pharmacie des operas': 'Pharmacie Les Harmonies',
  'nouvelle pharmacie elic': 'Pharmacie Eliel',
  'pharmacie adya': 'Pharmacie Abya'
};

var MOTS_VIDES_GEO = {
  grande: 1, nouvelle: 1, pharmacie: 1, phcie: 1, de: 1, du: 1, des: 1, la: 1, le: 1, les: 1,
  d: 1, l: 1, et: 1, a: 1, au: 1, aux: 1, en: 1, sur: 1, cote: 1, ivoire: 1, abidjan: 1,
  principale: 1, ste: 1, st: 1, saint: 1, sainte: 1, nlle: 1, gde: 1
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

// Score 0..1 : 1.0 si le téléphone correspond, 0.98 si le titulaire correspond, sinon ressemblance des noms
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

// Quartier = quartier de référence cité dans l'adresse, sinon le plus proche (<= 4,5 km), enrichi de la rue / du repère
function resoudreQuartierGeoloc_(lat, lon, commune, addrText, origQuartier, ref) {
  var ck = normGeo_(commune), addrNorm = ' ' + normGeo_(addrText) + ' ';
  var listeQ = (ref && ref.parCommune[ck]) || [];
  for (var i = 0; i < listeQ.length; i++) {
    var qn = normGeo_(listeQ[i].quartier);
    if (qn.length >= 3 && addrNorm.indexOf(' ' + qn + ' ') >= 0) return listeQ[i].quartier;
  }
  var cleanAddr = String(addrText || '')
    .replace(/^[^,]+,\s*/, '')                              // retire le nom de la pharmacie
    .replace(/,?\s*Abidjan.*$/i, '')
    .replace(/,?\s*C[oô]te d'Ivoire.*$/i, '')
    .replace(/\b\d{2}\s*BP\s*\d+[^,]*,?\s*/gi, '')          // boîtes postales
    .replace(/^[A-Z0-9]{4}\+[A-Z0-9]{2,3}\s*[^,]*,?\s*/, '') // codes Plus Codes
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

// ---------------------------------------------------------------- Fonction principale
// lieu : nom de la pharmacie ; quartier / commune : peuvent valoir "NL" ou être vides
// telephone / titulaire : facultatifs, servent à confirmer la bonne pharmacie
function geocoderLieu(lieu, quartier, commune, telephone, titulaire, refOpt) {
  var nom = String(lieu || '').trim();
  if (!nom) return null;
  var qPropre = (quartier && String(quartier).trim() !== 'NL') ? String(quartier).trim() : '';
  var comPropre = (commune && String(commune).trim() !== 'NL') ? String(commune).trim() : '';

  var cache = null, cleCache = 'geo3:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, [nom, qPropre, comPropre, telephone || ''].join('|')));
  try {
    cache = CacheService.getScriptCache();
    var c = cache.get(cleCache);
    if (c) return c === 'x' ? null : JSON.parse(c);
  } catch (e) {}

  var ref = refOpt || chargerRefQuartiersGeo_();
  var ck = normGeo_(comPropre), comRef = ref.centres[ck] || null;

  var nomRecherche = CORRECTIONS_OCR_PHARMACIES[normGeo_(nom)] || nom;
  var sansPrefixe = nomRecherche.replace(/^(Nouvelle\s+Pharmacie\s+Principale\s+de\s+|Pharmacie\s+Principale\s+de\s+|Pharmacie\s+Principale\s+d'|Grande\s+|Nouvelle\s+)/i, 'Pharmacie ')
    .replace(/^Pharmacie\s+Pharmacie\s+/i, 'Pharmacie ');
  var nomCoeur = 'Pharmacie ' + motsClesGeo_(nomRecherche, true).join(' ');
  var qPart = (qPropre && normGeo_(qPropre) !== ck) ? qPropre + ', ' : '';
  var comPart = comPropre ? comPropre + ', ' : '';

  var requetes = [
    nomRecherche + ', ' + qPart + comPart + 'Côte d\'Ivoire',
    sansPrefixe + ', ' + qPart + comPart + 'Côte d\'Ivoire',
    nomCoeur + ', ' + comPart + 'Côte d\'Ivoire',
    sansPrefixe + ', Côte d\'Ivoire',             // rattrape une commune mal lue (ex. Adzopé au lieu d'Adjamé)
    nomCoeur + ', Abidjan, Côte d\'Ivoire'
  ].filter(function (q, i, a) { return a.indexOf(q) === i; });

  var meilleur = null, vusCid = {};
  var reSpot = /\["0x[0-9a-f]+:0x[0-9a-f]+","([^"]+)",\[(-?\d+\.\d+),(-?\d+\.\d+)\],"(\d+)"\],"([^"]+)"/;
  var reCids = /\["[^"]+","(\d{10,22})"\],"\/g\/[^"]+",null,\[(-?\d+),(-?\d+)\]/g;
  var optsHttp = { muteHttpExceptions: true, headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' } };

  function evaluer_(titre, adr, lat, lon, htmlSrc, source) {
    if (isNaN(lat) || isNaN(lon) || lat <= 4.3 || lat >= 10.8 || lon <= -8.6 || lon >= -2.4) return null; // hors CI
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

  // 0. Google Maps Platform API officielle (Geocoding API & Places API New avec MAPS_API_KEY)
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
    // Si non trouvé via Geocoding, interroger Places API (New) Text Search
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

  // 1. Google Maps : fiche directe, sinon liste de résultats (chaque CID est ouvert pour lire nom, adresse, GPS)
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

  // 2. ArcGIS (lieux précis uniquement, jamais une ville ou un quartier entier)
  if (!meilleur || meilleur.score < 0.75) {
    [nomRecherche + ', ' + qPart + comPropre, sansPrefixe + ', ' + qPart + comPropre, nomCoeur + ', ' + comPropre].some(function (q) {
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

  // 3. Service Maps d'Apps Script (uniquement un établissement précis, pas un centre-ville)
  if (!meilleur && typeof Maps !== 'undefined') {
    try {
      var r = Maps.newGeocoder().setRegion('ci').setLanguage('fr').geocode([sansPrefixe, qPropre, comPropre, 'Côte d\'Ivoire'].filter(Boolean).join(', '));
      var r0 = r && r.status === 'OK' && r.results && r.results[0], types = (r0 && r0.types) || [];
      var g = r0 && r0.geometry && r0.geometry.location;
      var precis = types.indexOf('pharmacy') >= 0 || types.indexOf('establishment') >= 0 || types.indexOf('point_of_interest') >= 0 ||
                   (r0 && r0.geometry.location_type === 'ROOFTOP');
      if (precis && g && g.lat > 4.3 && g.lat < 10.8 && g.lng > -8.6 && g.lng < -2.4) {
        meilleur = { lat: Math.round(g.lat * 1e6) / 1e6, lon: Math.round(g.lng * 1e6) / 1e6,
                     quartier: resoudreQuartierGeoloc_(g.lat, g.lng, comPropre, r0.formatted_address || '', qPropre, ref),
                     adresse: r0.formatted_address || '', titre: nom, source: 'Maps-Service', score: 0.75 };
      }
    } catch (e) {}
  }

  try { if (cache) cache.put(cleCache, meilleur ? JSON.stringify(meilleur) : 'x', meilleur ? 21600 : 3600); } catch (e) {}
  return meilleur;
}

// ---------------------------------------------------------------- Traitement de la feuille Pharmacies
function testerGeocodage5Pharmacies() { return executerLotGeocodagePharmacies_(5); }
function completerGeolocPharmacies() { return executerLotGeocodagePharmacies_(25); }

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
      var manqueGps = !lat || lat === 'NL' || !lon || lon === 'NL' || isNaN(parseFloat(lat.replace(',', '.')));
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
                      : 'Aucune pharmacie à compléter : toutes ont un GPS et un quartier.';
    Logger.log(msg);
    try { SpreadsheetApp.getUi().alert('Géolocalisation des pharmacies', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
    return msg;
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Formules de cellule
// =GEOCODE_GOOGLE("Grande Pharmacie du Sanwi, Aboisso")  -> "5.469188, -3.207253"
function GEOCODE_GOOGLE(texte) {
  var p = String(texte || '').split(',').map(function (x) { return x.trim(); });
  var g = geocoderLieu(p[0], p.length > 2 ? p[1] : '', p[p.length > 2 ? 2 : 1] || '');
  return g ? g.lat + ', ' + g.lon : 'Introuvable';
}
function GET_LAT_LONG(texte) { return GEOCODE_GOOGLE(texte); }
// =PLACE("Pharmacie Abya, Koumassi") -> "Pharmacie Abya — Remblais (5.301519, -3.969371)"
function PLACE(texte) {
  var p = String(texte || '').split(',').map(function (x) { return x.trim(); });
  var g = geocoderLieu(p[0], p.length > 2 ? p[1] : '', p[p.length > 2 ? 2 : 1] || '');
  return g ? g.titre + ' — ' + g.quartier + ' (' + g.lat + ', ' + g.lon + ')' : 'Introuvable';
}
