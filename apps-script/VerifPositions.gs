function verifierPositions() {
  var t0 = Date.now(), ss = SpreadsheetApp.getActive(), cle = recupererCleGoogleMaps_();
  var VIDES = { pharmacie: 1, phcie: 1, grande: 1, nouvelle: 1, clinique: 1, polyclinique: 1, centre: 1, medical: 1, medicale: 1, hopital: 1, general: 1, de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, d: 1, l: 1, et: 1, sante: 1, urbain: 1, communautaire: 1, cabinet: 1, abidjan: 1, sainte: 0 };
  var mots = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w && w.length > 1 && !VIDES[w]; }); };
  var ressemblance = function (a, b) {
    var A = mots(a), B = mots(b); if (!A.length || !B.length) return 0;
    var n = A.filter(function (w) { return B.some(function (x) { return x === w || (w.length >= 4 && (x.indexOf(w) === 0 || w.indexOf(x) === 0)); }); }).length;
    return n / Math.max(A.length, 1);
  };
  var dist = function (a, b, c, d) { var R = 6371000, r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.round(Math.sqrt(x * x + y * y) * R); };
  var num = function (v) { var x = parseFloat(String(v === undefined ? '' : v).replace(',', '.')); return isFinite(x) ? x : null; };
  var items = [];
  [['Pharmacies', ['codecontact', 'nom', 'commune', 'quartier', 'latitude', 'longitude', 'originegps']], ['Etablissements', ['codeetab', 'nom', 'commune', 'quartier', 'latitude', 'longitude', 'originegps']]].forEach(function (cfg) {
    var sh = ss.getSheetByName(cfg[0]); if (!sh || sh.getLastRow() < 2) return;
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
    var pos = cfg[1].map(function (k) { return ent.indexOf(k); });
    sh.getRange(2, 1, sh.getLastRow() - 1, ent.length).getValues().forEach(function (l, i) {
      var nom = String(l[pos[1]] || '').trim(); if (!nom) return;
      items.push({ onglet: cfg[0], ligne: i + 2, code: l[pos[0]], nom: nom, commune: String(l[pos[2]] || ''), quartier: String(l[pos[3]] || ''),
        lat: num(l[pos[4]]), lon: num(l[pos[5]]), origine: pos[6] >= 0 ? String(l[pos[6]] || '') : '' });
    });
  });
  var aChercher = items.filter(function (it) { return !/^terrain/i.test(it.origine); });
  var LOT = 50;
  for (var i = 0; i < aChercher.length; i += LOT) {
    var lot = aChercher.slice(i, i + LOT);
    var reqs = lot.map(function (it) {
      var corps = { textQuery: [it.nom, it.commune, 'Côte d\'Ivoire'].filter(Boolean).join(', '), languageCode: 'fr', regionCode: 'ci', maxResultCount: 3 };
      if (it.lat !== null && it.lon !== null) corps.locationBias = { circle: { center: { latitude: it.lat, longitude: it.lon }, radius: 5000 } };
      return { url: 'https://places.googleapis.com/v1/places:searchText', method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'X-Goog-Api-Key': cle, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.googleMapsUri' },
        payload: JSON.stringify(corps) };
    });
    var reps = UrlFetchApp.fetchAll(reqs);
    reps.forEach(function (r, k) {
      var it = lot[k];
      try {
        var js = JSON.parse(r.getContentText());
        if (js.error) { it.erreur = js.error.message; return; }
        var best = null;
        (js.places || []).forEach(function (p) {
          if (!p.location) return;
          var s = ressemblance(it.nom, (p.displayName && p.displayName.text) || '');
          var d = it.lat !== null ? dist(it.lat, it.lon, p.location.latitude, p.location.longitude) : null;
          var score = s - (d !== null && d > 5000 ? 0.3 : 0);
          if (!best || score > best.score) best = { score: score, s: s, d: d, p: p };
        });
        it.g = best;
      } catch (e) { it.erreur = String(e); }
    });
  }
  var r6 = function (x) { return x === null ? '' : Math.round(x * 1e6) / 1e6; };
  var lignes = items.map(function (it) {
    var g = it.g, dec;
    if (/^terrain/i.test(it.origine)) dec = 'Terrain : inchangé';
    else if (it.erreur) dec = 'Erreur : ' + it.erreur;
    else if (!g) dec = 'Introuvable sur Google';
    else if (g.s < 0.6) dec = 'À vérifier (nom différent)';
    else if (g.d !== null && g.d <= 30) dec = 'OK (écart < 30 m)';
    else dec = 'Remplacer par Google';
    var p = g && g.p;
    return [it.onglet, it.ligne, it.code, it.nom, it.commune, r6(it.lat), r6(it.lon), it.origine,
      p ? (p.displayName && p.displayName.text) || '' : '', p ? p.formattedAddress || '' : '', p ? p.nationalPhoneNumber || '' : '',
      p ? r6(p.location.latitude) : '', p ? r6(p.location.longitude) : '', g && g.d !== null ? g.d : '', g ? Math.round(g.s * 100) + ' %' : '', dec, p ? p.googleMapsUri || '' : ''];
  });
  var sh = ss.getSheetByName('Vérification positions') || ss.insertSheet('Vérification positions');
  sh.clear();
  var ent = ['Onglet', 'Ligne', 'Code', 'Nom', 'Commune', 'Lat actuelle', 'Lon actuelle', 'OrigineGPS', 'Nom Google', 'Adresse Google', 'Tél Google', 'Lat Google', 'Lon Google', 'Écart (m)', 'Ressemblance', 'Décision', 'Lien Google Maps'];
  sh.getRange(1, 1, 1, ent.length).setValues([ent]).setFontWeight('bold');
  if (lignes.length) sh.getRange(2, 1, lignes.length, ent.length).setValues(lignes);
  sh.setFrozenRows(1);
  var stats = {}; lignes.forEach(function (l) { var k = String(l[15]).replace(/ :.*/, ''); stats[k] = (stats[k] || 0) + 1; });
  Logger.log('VERIF ' + items.length + ' lignes en ' + Math.round((Date.now() - t0) / 1000) + ' s ' + JSON.stringify(stats));
}
