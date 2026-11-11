/* Lecture.gs : données lues par l'application (base complète, listes, pharmacies, équipe, statuts). (découpé de Code.gs, 3.27.14 ; tous les fichiers .gs partagent le même espace) */
// ---------------------------------------------------------------- Lecture
// sig : empreinte des données de référence déjà présentes sur le téléphone ; si rien n'a changé,
// seules les nouveautés (visites depuis hdepuis, tournées) sont renvoyées : moins de données mobiles.
function lireTout(sig, hdepuis) {
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  assurerStructure(ss);
  var praticiens = lireObjets(ss.getSheetByName(FEUILLES.praticiens), CHAMPS_PRATICIENS, tz).filter(function (p) {
    return p.code !== '' && p.nom !== '';
  });
  praticiens.forEach(function (p) { p.nbVisites = +p.nbVisites || 0; p.note = lireNote(p.note); });
  var presences = lireObjets(ss.getSheetByName(FEUILLES.presences), CHAMPS_PRESENCES, tz).filter(function (p) {
    return p.code !== '';
  });
  var idsLus = {};   // 3.26.50 : identifiant vide ou en double -> identifiant de ligne unique (évite les lieux qui s'échangent sur le téléphone)
  presences.forEach(function (p, i) { if (p.id === '' || idsLus[String(p.id)]) p.id = 'L' + (i + 2); idsLus[String(p.id)] = true; });

  var quartiers = [];
  var shQ = ss.getSheetByName(FEUILLES.quartiers);
  if (shQ && shQ.getLastRow() > 1) {
    var nbColsQ = Math.max(5, shQ.getLastColumn());
    shQ.getRange(2, 1, shQ.getLastRow() - 1, nbColsQ).getValues().forEach(function (v) {
      if (v[1] !== '') quartiers.push({ commune: v[0], quartier: v[1], zone: v[2], lat: +v[3], lon: +v[4], secteur: v[5] ? String(v[5]).trim() : '' });
    });
  }
  var historique = [];
  var shH = ss.getSheetByName(FEUILLES.hist);
  if (shH && shH.getLastRow() > 1) {
    var limH = ajouterJours(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), -JOURS_HISTORIQUE_RENVOYE);
    historique = lireObjets(shH, CHAMPS_HIST, tz, Math.max(2, shH.getLastRow() - NB_HISTORIQUE_RENVOYE + 1)).reverse()
      .filter(function (v) { return !v.date || String(v.date).slice(0, 10) >= limH; });
  }
  lirePharmacies(ss, tz).forEach(function (ph) {
    praticiens.push({ code: ph.code, type: 'Pharmacie', nom: ph.nom, specialite: 'Pharmacien', note: lireNote(ph.note),
      conventionne: ph.conventionne, telephone: ph.telephone, derniere: ph.derniere, statut: ph.statut, commentaire: ph.commentaire,
      nbVisites: +ph.nbVisites || 0, actif: ph.actif, prochaine: ph.prochaine, titulaire: ph.titulaire });
    var pr = { id: 'P-' + ph.code, code: ph.code, nom: ph.nom, lieu: ph.nom, quartier: ph.quartier, commune: ph.commune, zone: ph.zone,
      horaireMatin: ph.horaireMatin || HORAIRES_PHARMACIE[0], horaireSoir: ph.horaireSoir || HORAIRES_PHARMACIE[1], lat: ph.lat, lon: ph.lon, origineGps: ph.origineGps || '' };
    JOURS_CLES.forEach(function (j) { pr[j] = 'Matin et soir'; });
    presences.push(pr);
  });
  if (hdepuis) historique = historique.filter(function (v) { return String(v.horodatage) > hdepuis; });
  var listes = lireListes(ss, tz), statuts = lireStatuts(ss);
  // 3.26.53 : contrôle automatique des doublons (codes contacts et numéros de lieu)
  var vusC = {}, doublons = [];
  praticiens.forEach(function (p) { var c = String(p.code); if (vusC[c] && doublons.indexOf(c) < 0) doublons.push(c); vusC[c] = true; });
  if (doublons.length) console.warn('Codes en double : ' + doublons.join(', '));
  var ref = { praticiens: praticiens, presences: presences, doublons: doublons, quartiers: quartiers, statuts: statuts, delegues: listes.delegues, feries: listes.feries };
  var empreinte = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(ref), Utilities.Charset.UTF_8));
  var shEtab = ss.getSheetByName(FEUILLES.etablissements);
  if (shEtab && shEtab.getLastRow() >= 1 && shEtab.getLastColumn() >= 1) {
    var entEtab = shEtab.getRange(1, 1, 1, shEtab.getLastColumn()).getValues()[0].map(normaliser);
    var champsEtab = CHAMPS_ETABLISSEMENTS.slice();
    if (entEtab.indexOf(normaliser('Position')) >= 0) champsEtab.push(['position', 'Position']);
    if (entEtab.indexOf(normaliser('OrigineGPS')) >= 0) champsEtab.push(['origineGps', 'OrigineGPS']);
    ref.etablissements = lireObjets(shEtab, champsEtab, tz).filter(function (e) { return String(e.nom || '').trim() !== ''; });
  } else {
    ref.etablissements = [];
  }
  ref.activites = listes.activites; ref.produits = listes.produits; ref.activitesPharmacie = listes.activitesPharmacie;
  var inactifs = {};
  var toutesFiches = lireObjets(ss.getSheetByName(FEUILLES.fiches), CHAMPS_FICHES, tz);
  toutesFiches.forEach(function (f) {
    if (!String(f.produit || '').trim()) return;
    if (f.actif !== undefined && f.actif !== null && f.actif !== '') {
      var a = String(f.actif).trim().toLowerCase();
      if (a === 'false' || a === 'faux' || a === '0' || a === 'non') inactifs[normaliser(f.produit)] = true;
    }
  });
  ref.fiches = toutesFiches.filter(function (f) {
    return String(f.produit || '').trim() !== '' && !inactifs[normaliser(f.produit)];
  });
  if (ref.produits && ref.produits.length) {
    ref.produits = ref.produits.filter(function (p) { return !inactifs[normaliser(p)]; });
  }
  empreinte = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(ref), Utilities.Charset.UTF_8));
  var limiteR = ajouterJours(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), -JOURS_HISTORIQUE_RENVOYE);   // 3.29.0 : rapports sur 120 jours, comme les visites
  var rapports = lireObjets(ss.getSheetByName(FEUILLES.rapports), CHAMPS_RAPPORTS, tz).filter(function (x) { return x.delegue !== '' && x.date >= limiteR; });
  var r = { ok: true, version: VERSION_DONNEES, sig: empreinte, historique: historique, partiel: !!hdepuis, alias: aliasDelegues(), rapports: rapports,
            plannings: lirePlannings(ss, tz, JOURS_PLANNINGS_DATA), serveur: new Date().toISOString(),
            sauvegarde: PropertiesService.getScriptProperties().getProperty('DERNIERE_SAUVEGARDE') || '' };
  if (sig && sig === empreinte) { r.inchange = true; return r; }
  Object.keys(ref).forEach(function (k) { r[k] = ref[k]; });
  return r;
}

// Feuille Listes : colonnes Délégués (liste de choix des noms) et JoursFériés, créées si absentes
function assurerListes(ss) {
  var sh = ss.getSheetByName(FEUILLES.listes);
  if (!sh) return;
  migrer350(ss, sh);
  var ent = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 2)).getValues()[0].map(normaliser);
  if (ent.indexOf(normaliser('Délégués')) < 0) {
    var noms = {}, tz = ss.getSpreadsheetTimeZone();
    [FEUILLES.plannings, FEUILLES.hist].forEach(function (f) {
      var champs = f === FEUILLES.plannings ? CHAMPS_PLAN : CHAMPS_HIST;
      lireObjets(ss.getSheetByName(f), champs, tz).forEach(function (o) { var n = String(o.delegue || '').trim(); if (n) noms[n] = true; });
    });
    var l = Object.keys(noms).sort();
    var c = Math.max(sh.getLastColumn(), 2) + 2;
    sh.getRange(1, c).setValue('Délégués').setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
    if (l.length) sh.getRange(2, c, l.length, 1).setValues(l.map(function (n) { return [n]; }));
    ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  }
  if (ent.indexOf(normaliser('Activités')) < 0) {
    var cA = sh.getLastColumn() + 2;
    sh.getRange(1, cA).setValue('Activités').setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
    sh.getRange(2, cA, ACTIVITES_DEFAUT.length, 1).setValues(ACTIVITES_DEFAUT.map(function (a) { return [a]; }));
    ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  } else if (sh.getLastRow() > 1) {
    // 2.2.0 : « Routine » remplace « Visite de routine (rappel) », Réunion et Staff séparés, Déjeuner et Garde ajoutés
    var cX = ent.indexOf(normaliser('Activités')) + 1, rX = sh.getRange(2, cX, sh.getLastRow() - 1, 1);
    var act = rX.getValues().map(function (v) { return String(v[0]).trim(); }).filter(Boolean);
    if (act.some(function (a) { return ACTIVITES_RENOMMEES[a]; })) {
      var perso = act.filter(function (a) { return !ACTIVITES_RENOMMEES[a] && ACTIVITES_DEFAUT.indexOf(a) < 0; });
      var neuf = ACTIVITES_DEFAUT.slice(0, -1).concat(perso).concat([ACTIVITES_DEFAUT[ACTIVITES_DEFAUT.length - 1]]);
      rX.clearContent();
      sh.getRange(2, cX, neuf.length, 1).setValues(neuf.map(function (a) { return [a]; }));
    }
  }
  if (ent.indexOf(normaliser('Produits')) < 0) {
    var cP = sh.getLastColumn() + 2;
    sh.getRange(1, cP).setValue('Produits').setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
    sh.getRange(2, cP, PRODUITS_DEFAUT.length, 1).setValues(PRODUITS_DEFAUT.map(function (a) { return [a]; }));
    ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  }
  if (ent.indexOf(normaliser('JoursFériés')) < 0) {
    var c2 = sh.getLastColumn() + 2;
    sh.getRange(1, c2).setValue('JoursFériés').setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
    sh.getRange(2, c2, FERIES_DEFAUT.length, 1).setNumberFormat('dd/mm/yyyy')
      .setValues(FERIES_DEFAUT.map(function (d) { return [Utilities.parseDate(d, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd')]; }));
    sh.getRange(1, c2 + 1).setValue('Ajoutez les fêtes musulmanes (fin du Ramadan, Tabaski, Maouloud) chaque année').setFontStyle('italic');
  }
}
// ---------------------------------------------------------------- Délégués : fusion de deux noms (ex. une adresse e-mail saisie comme nom)
// L'ancien nom est remplacé partout (Plannings, Historique, Listes) et reste un alias : un téléphone qui l'utilise encore
// est renommé automatiquement à la synchronisation, et ses envois sont enregistrés sous le bon nom.
function aliasDelegues() {
  try {
    var a = JSON.parse(PropertiesService.getScriptProperties().getProperty('DELEGUES_ALIAS') || '{}');
    return a && typeof a === 'object' && !Array.isArray(a) ? a : {};
  } catch (e) { return {}; }
}
function nomDelegue(n) {
  n = String(n || '').trim();
  var a = aliasDelegues(), k = Object.keys(a).filter(function (x) { return x.toLowerCase() === n.toLowerCase(); })[0];
  return k ? a[k] : n;
}
function fusionnerDelegue(ancien, nouveau) {
  var ss = SpreadsheetApp.getActive(), n = 0;
  [FEUILLES.plannings, FEUILLES.hist, FEUILLES.listes].forEach(function (f) {
    var sh = ss.getSheetByName(f); if (!sh || sh.getLastRow() < 2) return;
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser), c = ent.indexOf(normaliser('Délégué')) >= 0 ? ent.indexOf(normaliser('Délégué')) : ent.indexOf(normaliser('Délégués'));
    if (c < 0) return;
    var r = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1), v = r.getValues(), vus = {};
    v.forEach(function (l) {
      if (String(l[0]).trim().toLowerCase() === ancien.toLowerCase()) { l[0] = nouveau; n++; }
      if (f === FEUILLES.listes) { var k = String(l[0]).trim(); if (k && vus[k]) l[0] = ''; vus[k] = true; }
    });
    if (f === FEUILLES.listes) { var noms = v.map(function (l) { return l[0]; }).filter(function (x) { return x !== ''; }); v = v.map(function (l, i) { return [noms[i] || '']; }); }
    r.setValues(v);
  });
  var a = aliasDelegues(); a[ancien] = nouveau;
  PropertiesService.getScriptProperties().setProperty('DELEGUES_ALIAS', JSON.stringify(a));
  return n;
}

function lirePharmacies(ss, tz) {
  return lireObjets(ss.getSheetByName(FEUILLES.pharmacies), CHAMPS_PHARMACIES, tz).filter(function (p) { return p.code !== '' && p.nom !== ''; });
}
function lireListes(ss, tz) {
  var sh = ss.getSheetByName(FEUILLES.listes), r = { delegues: [], feries: [], activites: [], activitesPharmacie: [], produits: [] };
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return r;
  var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var cD = ent.indexOf(normaliser('Délégués')), cF = ent.indexOf(normaliser('JoursFériés')), cA = ent.indexOf(normaliser('Activités')), cP = ent.indexOf(normaliser('Produits')), cAP = ent.indexOf(normaliser('ActivitésPharmacie'));
  vals.forEach(function (v) {
    if (cAP >= 0 && String(v[cAP]).trim()) r.activitesPharmacie.push(String(v[cAP]).trim());
    if (cP >= 0 && String(v[cP]).trim()) r.produits.push(String(v[cP]).trim());
    if (cA >= 0 && String(v[cA]).trim()) r.activites.push(String(v[cA]).trim());
    if (cD >= 0 && String(v[cD]).trim()) r.delegues.push(String(v[cD]).trim());
    if (cF >= 0 && v[cF] !== '') { var d = versIso(v[cF], tz); if (d) r.feries.push(d); }
  });
  return r;
}

function lireEquipe() {
  var ss = SpreadsheetApp.getActive();
  assurerStructure(ss);
  // listes de référence renvoyées aussi : produits, activités, statuts et délégués suivent la base en temps réel
  var listes = lireListes(ss, ss.getSpreadsheetTimeZone());
  return { ok: true, plannings: lirePlannings(ss, ss.getSpreadsheetTimeZone(), JOURS_PLANNINGS_EQUIPE),
           listes: { produits: listes.produits, activites: listes.activites, activitesPharmacie: listes.activitesPharmacie, delegues: listes.delegues, statuts: lireStatuts(ss) },
           depuis: ajouterJours(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'), -JOURS_PLANNINGS_EQUIPE),
           serveur: new Date().toISOString() };
}

function lirePlannings(ss, tz, jours) {
  var depuis = ajouterJours(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), -(jours || JOURS_PLANNINGS_EQUIPE));
  return lireObjets(ss.getSheetByName(FEUILLES.plannings), CHAMPS_PLAN, tz).filter(function (p) {
    return p.delegue !== '' && p.date >= depuis;
  });
}

function lireStatuts(ss) {
  var statuts = [], sh = ss.getSheetByName(FEUILLES.listes);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (v) {
      if (v[0] !== '') statuts.push({ nom: String(v[0]), visite: normaliser(v[1]) === 'oui' });
    });
  }
  return statuts.length ? statuts : STATUTS_DEFAUT;
}

// Lit une feuille en objets selon les en-têtes (l'ordre des colonnes peut changer)
function lireObjets(sh, champs, tz, premiereLigne) {
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return [];
  premiereLigne = premiereLigne || 2;
  if (premiereLigne > sh.getLastRow()) return [];
  var nbCol = sh.getLastColumn();
  var entetes = sh.getRange(1, 1, 1, nbCol).getValues()[0].map(normaliser);
  var pos = champs.map(function (c) { return entetes.indexOf(normaliser(c[1])); });
  var rng = sh.getRange(premiereLigne, 1, sh.getLastRow() - premiereLigne + 1, nbCol);
  var vals = rng.getValues(), aff = rng.getDisplayValues();
  return vals.map(function (ligne, i) {
    var o = {};
    champs.forEach(function (c, k) {
      var j = pos[k];
      if (j < 0) { o[c[0]] = ''; return; }
      var v = ligne[j];
      if (['derniere', 'date', 'prochaine', 'absentDu', 'absentAu'].indexOf(c[0]) >= 0) o[c[0]] = versIso(v, tz);
      else if (c[0] === 'horodatage') o[c[0]] = (v instanceof Date && !isNaN(v.getTime())) ? v.toISOString() : String(v === undefined || v === null ? '' : v);
      else if (v instanceof Date) o[c[0]] = aff[i][j];
      else o[c[0]] = v;
    });
    return o;
  });
}

function versIso(v, tz) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = String(v || '').match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}


// ---------------------------------------------------------------- 3.27.25 : lecture rapide
// REV change à chaque écriture (application ou saisie dans le classeur) et au plus tard toutes les heures.
// Même REV que le téléphone : réponse « inchangé » sans lire le classeur (environ 1 s au lieu de 10 à 16 s).
// REV différente : la base complète est servie depuis le cache (calculée une seule fois par révision).
var REV_DUREE_MAX = 60 * 60 * 1000, CACHE_MORCEAU = 45000;   // 100 Ko maximum par valeur (accents sur 2 octets)
function marquerModif() { PropertiesService.getScriptProperties().setProperty('REV', Date.now() + '-' + Math.floor(Math.random() * 1e6)); }
function revDonnees() {
  var pr = PropertiesService.getScriptProperties(), r = pr.getProperty('REV');
  if (!r || Date.now() - (parseInt(r, 10) || 0) > REV_DUREE_MAX) { r = Date.now() + '-' + Math.floor(Math.random() * 1e6); pr.setProperty('REV', r); }
  return r;
}
function lireCacheGros(cache, cle) {
  try {
    var n = parseInt(cache.get(cle + '_n'), 10);
    if (!isFinite(n) || n <= 0) return null;
    var cles = []; for (var i = 0; i < n; i++) cles.push(cle + '_' + i);
    var m = cache.getAll(cles), t = '';
    for (var j = 0; j < cles.length; j++) { if (m[cles[j]] === undefined || m[cles[j]] === null) return null; t += m[cles[j]]; }
    return t;
  } catch (e) { return null; }
}
function ecrireCacheGros(cache, cle, txt) {
  try {
    if (!txt) return;
    var o = {}, n = Math.ceil(txt.length / CACHE_MORCEAU);
    for (var i = 0; i < n; i++) o[cle + '_' + i] = txt.substr(i * CACHE_MORCEAU, CACHE_MORCEAU);
    cache.putAll(o, 21600); cache.put(cle + '_n', String(n), 21600);
  } catch (e) { console.warn('Cache trop gros : ' + e); }
}
function lireToutRapide(rev) {
  var cur = revDonnees();
  if (rev && rev === cur) {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
    return JSON.stringify({ ok: true, rev: cur, inchange: true, plannings: lirePlannings(ss, tz, JOURS_PLANNINGS_DATA), version: VERSION_DONNEES, serveur: new Date().toISOString(),
      sauvegarde: PropertiesService.getScriptProperties().getProperty('DERNIERE_SAUVEGARDE') || '' });
  }
  var cache = null, cle = 'D' + cur, txt = null;
  try { cache = CacheService.getScriptCache(); txt = lireCacheGros(cache, cle); } catch (eC) { txt = null; }
  if (txt) return txt;
  var r = lireTout('', ''); r.rev = cur;
  txt = JSON.stringify(r);
  if (cache && revDonnees() === cur) ecrireCacheGros(cache, cle, txt);
  return txt;
}
