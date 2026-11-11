/* Administration.gs : menu du classeur, mise en forme, migrations, structure, base de test, import, saisie à la main, sauvegardes. (découpé de Code.gs, 3.27.14 ; tous les fichiers .gs partagent le même espace) */
// ---------------------------------------------------------------- Menu
function onOpen() {
  SpreadsheetApp.getUi().createMenu('MediPlanner')
    .addItem('Initialiser le classeur (structure + base fictive)', 'initialiser')
    .addItem('Régénérer la base fictive', 'regenererBaseFictive')
    .addItem('Mettre à jour la feuille Quartiers (secteurs détaillés)', 'mettreAJourQuartiersSecteurs')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Territoires & Quartiers')
      .addItem('Appliquer le découpage Quartiers à toutes les fiches', 'propagerQuartiersManuellement')
      .addItem('Organiser l\'onglet Quartiers (Territoire / Zone / Subdivision / Secteur)', 'menuMigrerQuartiersHierarchie'))
    .addItem('Convertir l\'ancienne feuille BaseDonnees', 'convertirAncienneBase')
    .addItem('Compléter les données manquantes (base de test)', 'completerBaseTest')
    .addItem('Importer les pharmacies réelles (OpenStreetMap)', 'importerPharmacies')
    .addItem('Tester la géolocalisation précise (5 pharmacies max)', 'testerGeocodage5Pharmacies')
    .addItem('Compléter la géolocalisation des pharmacies (par lot de 25)', 'completerGeolocPharmacies')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Géolocalisation & Audit GPS')
      .addItem('🔍 Lancer l\'Audit Qualité GPS (Rapport complet)', 'auditerGeolocBase')
      .addItem('Compléter la géolocalisation des présences (médecins & cliniques)', 'completerGeolocToutesPresences')
      .addItem('Compléter la géolocalisation des pharmacies (par lot de 30)', 'completerGeolocPharmacies')
      .addItem('Tester le géocodage sur 5 fiches', 'testerGeocodage5Presences'))
    .addSeparator()
    .addItem('Lecture des fiches photographiées (clé Gemini)', 'configurerLectureFiches')
    .addItem('Lecture des fiches photographiées (clé Claude, secours)', 'configurerLectureFichesClaude')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Sauvegardes')
      .addItem('Installer la sauvegarde quotidienne', 'installerSauvegardeQuotidienne')
      .addItem('Sauvegarder maintenant', 'sauvegarderMaintenant')
      .addItem('Ouvrir le dossier des sauvegardes', 'ouvrirDossierSauvegardes'))
    .addSeparator()
    // 3.28.15 : Supabase est la base principale ; Jumelage.gs garde les deux bases identiques
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Doublons (hôpitaux, pharmacies)')
      .addItem('Détecter les doublons probables', 'menuDetecterDoublons')
      .addItem('Appliquer les décisions', 'menuAppliquerDecisions')
      .addItem('Fusionner les deux lignes sélectionnées', 'menuFusionnerSelection')
      .addItem('Annuler une fusion', 'menuAnnulerFusion'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Supabase (base principale)')
      .addItem('Synchroniser maintenant (recopie complète)', 'synchroniserSupabaseComplet')
      .addItem('Installer ou réparer la synchronisation automatique', 'installerJumelage')
      .addItem('Contrôler qu\'aucune donnée ne manque dans Supabase', 'jumVerifierCouverture')
      .addSeparator()
      .addItem('Ouvrir la console Supabase', 'ouvrirBddSupabase'))
    .addSeparator()
    .addItem('Afficher le jeton d\'accès', 'afficherJeton')
    .addItem('Changer le jeton d\'accès', 'changerJeton')
    .addToUi();
}

function initialiser() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Initialiser le classeur',
      'Toutes les feuilles de l\'application seront recréées et remplies avec une base fictive. ' +
      'L\'historique et les tournées publiées seront effacés. Continuer ?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var r = reinitialiserTout();
  ui.alert('Classeur prêt', r + '\n\nJeton d\'accès : ' + obtenirJeton(), ui.ButtonSet.OK);
}

// Version sans fenêtre de dialogue, exécutable depuis l'éditeur Apps Script
function reinitialiserTout() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone('Africa/Abidjan');
  ecrireQuartiers(ss);
  ecrireListes(ss);
  preparerFeuille(ss, FEUILLES.hist, CHAMPS_HIST.map(function (c) { return c[1]; }));
  formaterHistorique(ss.getSheetByName(FEUILLES.hist));
  preparerFeuille(ss, FEUILLES.plannings, CHAMPS_PLAN.map(function (c) { return c[1]; }))
    .getRange(1, 1, 1000, CHAMPS_PLAN.length).setNumberFormat('@');
  var r = ecrireBaseFictive(ss);
  var ancienne = ss.getSheetByName(FEUILLES.ancienneBase);
  if (ancienne) ss.deleteSheet(ancienne);
  ['Feuille 1', 'Sheet1'].forEach(function (n) {
    var f = ss.getSheetByName(n);
    if (f && f.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(f);
  });
  ordonnerFeuilles(ss);
  obtenirJeton();
  return r;
}

function regenererBaseFictive() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Régénérer la base fictive', 'Les feuilles Praticiens et Presences seront remplacées. Continuer ?',
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  ui.alert(ecrireBaseFictive(SpreadsheetApp.getActive()));
}

function ecrireBaseFictive(ss) {
  var tz = ss.getSpreadsheetTimeZone();
  // les pharmacies réelles sont dans leur propre feuille : la base fictive ne contient que des médecins
  var base = genererBaseFictive(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), { nbPharmacies: 0 });
  var shP = preparerFeuille(ss, FEUILLES.praticiens, CHAMPS_PRATICIENS.map(function (c) { return c[1]; }));
  shP.getRange(2, 1, base.praticiens.length, CHAMPS_PRATICIENS.length).setValues(base.praticiens.map(function (p) {
    return CHAMPS_PRATICIENS.map(function (c) {
      if (c[0] === 'derniere') return p.derniere ? Utilities.parseDate(p.derniere, tz, 'yyyy-MM-dd') : '';
      return p[c[0]] === undefined ? '' : p[c[0]];
    });
  }));
  var shR = preparerFeuille(ss, FEUILLES.presences, CHAMPS_PRESENCES.map(function (c) { return c[1]; }));
  shR.getRange(2, colonne(CHAMPS_PRESENCES, 'horaireMatin'), 2000, 2).setNumberFormat('@');
  shR.getRange(2, 1, base.presences.length, CHAMPS_PRESENCES.length).setValues(base.presences.map(function (p) {
    return CHAMPS_PRESENCES.map(function (c) { return p[c[0]] === undefined ? '' : p[c[0]]; });
  }));
  formaterPraticiens(ss);
  formaterPresences(ss);
  return base.praticiens.length + ' praticiens et ' + base.presences.length + ' lieux de présence générés.';
}

var ENTETES_QUARTIERS = ['Territoire', 'Zone', 'Commune', 'Subdivision', 'Quartier', 'Secteur', 'Variantes', 'Latitude', 'Longitude'];

function mettreAJourQuartiersSecteurs() {
  var ss = SpreadsheetApp.getActive();
  var res = migrerQuartiersHierarchie();
  SpreadsheetApp.getUi().alert('Quartiers et secteurs', 'La feuille "' + FEUILLES.quartiers + '" a été organisée (' + res.lignes + ' ligne(s)) avec la hiérarchie Territoire / Zone / Commune / Subdivision / Quartier / Secteur.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuMigrerQuartiersHierarchie() {
  var res = migrerQuartiersHierarchie();
  SpreadsheetApp.getUi().alert('Territoires & Quartiers',
    'Onglet "' + FEUILLES.quartiers + '" organisé avec succès.\n\n' +
    'Lignes conservées/reclassées : ' + res.lignes + '\n' +
    'Listes déroulantes mises à jour sur Quartiers, Presences, Pharmacies et Etablissements.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function propagerQuartiersSilencieux() {
  var ss = SpreadsheetApp.getActive();
  var bilan = propagerQuartiersSurFiches_(ss);
  var tables = bilan.tablesModifiees || [];
  if (tables.length && typeof jumPousserApresEcriture_ === 'function') {
    try { jumPousserApresEcriture_(tables); } catch (eJ) {}
  }
  Logger.log('Propagation Quartiers : ' + JSON.stringify(bilan));
  return bilan;
}

function propagerQuartiersManuellement() {
  var ss = SpreadsheetApp.getActive();
  var bilan = propagerQuartiersSurFiches_(ss);
  var tables = bilan.tablesModifiees || [];
  if (tables.length && typeof jumPousserApresEcriture_ === 'function') {
    try { jumPousserApresEcriture_(tables); } catch (eJ) {}
  }
  try {
    SpreadsheetApp.getUi().alert('Propagation Territoires & Quartiers',
      'Découpage Quartiers appliqué aux fiches :\n' +
      '- Presences : ' + bilan.presences + ' ligne(s)\n' +
      '- Pharmacies : ' + bilan.pharmacies + ' ligne(s)\n' +
      '- Etablissements : ' + bilan.etablissements + ' ligne(s)\n' +
      '- Plannings à venir : ' + bilan.plannings + ' ligne(s)',
      SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (eU) {}
}

// Convertit un index de colonne 1-based (1 -> A, 5 -> E, 27 -> AA) en lettre(s) A1
function lettreColonne_(colIndex) {
  var n = Math.max(1, Math.floor(+colIndex || 1)), s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Normalise et classe une ligne Quartier dans la hiérarchie Territoire | Zone | Commune | Subdivision | Quartier | Secteur | Variantes | Lat | Lon
function classifierLigneQuartier_(raw) {
  raw = raw || {};
  var comRaw = String(raw.commune || '').trim();
  var comPar = typeof communeParente === 'function' ? communeParente(comRaw) : comRaw;
  var tzInfo = typeof territoireEtZoneDeCommune_ === 'function' ? territoireEtZoneDeCommune_(comPar) : { territoire: '', zone: '', commune: comPar };
  var com = tzInfo.commune || comPar;

  var sub = String(raw.subdivision || '').trim();
  if (!sub && comRaw && com && normaliser(comRaw) !== normaliser(com)) sub = comRaw;
  var q = String(raw.quartier || '').trim();
  var sec = String(raw.secteur || '').trim();
  var varsArr = String(raw.variantes || '').split(/[,;|\/]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  var addVariante = function (v) {
    v = String(v || '').trim();
    if (!v) return;
    if (!varsArr.some(function (x) { return normaliser(x) === normaliser(v); })) varsArr.push(v);
  };

  var estAbidjan = typeof estCommuneGrandAbidjan === 'function' ? estCommuneGrandAbidjan(com) : (tzInfo.territoire === 'Abidjan');
  var ter = String(raw.territoire || '').trim();
  var z = String(raw.zone || '').trim();
  if (estAbidjan) {
    ter = 'Abidjan';
    if (!z || /interieur/i.test(normaliser(z))) z = tzInfo.zone || z;
    else if (tzInfo.zone) z = tzInfo.zone;
  } else if (com || /interieur/i.test(normaliser(ter)) || /interieur/i.test(normaliser(z))) {
    ter = 'Intérieur';
    z = 'Intérieur';
  }

  // Regroupement hiérarchique Cocody (Angré, Deux Plateaux, Riviera) + subdivisions initiales Abobo/Yopougon
  if (normaliser(com) === 'cocody') {
    var mAngre = q.match(/^angr[eé]\s+(.+)$/i);
    var mDeuxP = q.match(/^(?:deux|2)\s*plateaux?\s+(.+)$/i);
    var mRiv = q.match(/^rivi[eè]ra\s+(.+)$/i);
    if (mAngre) {
      addVariante(q);
      q = 'Angré';
      if (!sec) sec = mAngre[1].trim();
      sub = 'Cocody – Angré';
    } else if (/^(?:7e|8e|9e|7[eè]me|8[eè]me|9[eè]me)(?:\s*&\s*(?:7e|8e|9e))?\s*tranche$/i.test(q)) {
      addVariante(q);
      if (!sec) sec = q;
      q = 'Angré';
      sub = 'Cocody – Angré';
    } else if (/^(?:angr[eé]|chu\s*angr[eé]|djorobit[eé]|mahou|ch[aâ]teau(?:\s*d['’]?eau)?|besakoi|djibi|gestoci)$/i.test(q)) {
      if (!sub) sub = 'Cocody – Angré';
    } else if (mDeuxP) {
      addVariante(q);
      q = 'Deux Plateaux';
      if (!sec) sec = mDeuxP[1].trim();
      sub = 'Cocody – Deux Plateaux';
    } else if (/^(?:deux|2)\s*plateaux?$/i.test(q)) {
      if (normaliser(q) !== 'deuxplateaux') addVariante(q);
      q = 'Deux Plateaux';
      if (!sub) sub = 'Cocody – Deux Plateaux';
    } else if (mRiv) {
      addVariante(q);
      var secRiv = mRiv[1].trim();
      if (/^(?:2|3|4|ii|iii|iv|golf)$/i.test(secRiv)) secRiv = 'Riviera ' + secRiv;
      q = 'Riviera';
      if (!sec) sec = secRiv;
      sub = 'Cocody – Riviera';
    } else if (/^rivi[eè]ra$/i.test(q)) {
      if (!sub) sub = 'Cocody – Riviera';
    } else if (!sub && typeof zoneDeQuartier === 'function') {
      sub = zoneDeQuartier('Cocody', q, sec) || 'Cocody – Centre';
    }
  } else if ((normaliser(com) === 'abobo' || normaliser(com) === 'yopougon') && !sub && typeof zoneDeQuartier === 'function') {
    sub = zoneDeQuartier(com, q, sec) || '';
  }

  var lat = (raw.lat !== '' && raw.lat !== undefined && raw.lat !== null) ? parseFloat(String(raw.lat).replace(',', '.')) : NaN;
  var lon = (raw.lon !== '' && raw.lon !== undefined && raw.lon !== null) ? parseFloat(String(raw.lon).replace(',', '.')) : NaN;
  return {
    territoire: ter,
    zone: z,
    commune: com,
    subdivision: sub,
    quartier: q,
    secteur: sec,
    variantes: varsArr.join(', '),
    lat: isFinite(lat) ? lat : '',
    lon: isFinite(lon) ? lon : ''
  };
}

function construireLignesQuartiersOrganisees_(existantes) {
  var parCle = {}, ordre = [];
  var fusionnerLigne = function (item, estDefaut) {
    var c = classifierLigneQuartier_(item);
    if (!c.quartier && !c.commune) return;
    var cle = normaliser(c.commune) + '|' + normaliser(c.quartier) + '|' + normaliser(c.secteur);
    if (!parCle[cle]) {
      parCle[cle] = c;
      ordre.push(cle);
      return;
    }
    var ex = parCle[cle];
    if (!estDefaut) {
      if (!ex.territoire && c.territoire) ex.territoire = c.territoire;
      if (!ex.zone && c.zone) ex.zone = c.zone;
      if (!ex.subdivision && c.subdivision) ex.subdivision = c.subdivision;
      if (isFinite(parseFloat(c.lat)) && isFinite(parseFloat(c.lon)) && (!isFinite(parseFloat(ex.lat)) || !isFinite(parseFloat(ex.lon)))) {
        ex.lat = c.lat; ex.lon = c.lon;
      }
    } else {
      if (!ex.territoire && c.territoire) ex.territoire = c.territoire;
      if (!ex.zone && c.zone) ex.zone = c.zone;
      if (!ex.subdivision && c.subdivision) ex.subdivision = c.subdivision;
      if ((!isFinite(parseFloat(ex.lat)) || !isFinite(parseFloat(ex.lon))) && isFinite(parseFloat(c.lat)) && isFinite(parseFloat(c.lon))) {
        ex.lat = c.lat; ex.lon = c.lon;
      }
    }
    if (c.variantes) {
      var vEx = String(ex.variantes || '').split(/[,;|\/]+/).map(function (x) { return x.trim(); }).filter(Boolean);
      c.variantes.split(/[,;|\/]+/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (v) {
        if (!vEx.some(function (x) { return normaliser(x) === normaliser(v); })) vEx.push(v);
      });
      ex.variantes = vEx.join(', ');
    }
  };
  (existantes || []).forEach(function (item) { fusionnerLigne(item, false); });
  if (typeof quartiersDefautObjets === 'function') {
    quartiersDefautObjets().forEach(function (q) { fusionnerLigne(q, true); });
  } else {
    (typeof QUARTIERS_DEFAUT !== 'undefined' ? QUARTIERS_DEFAUT : []).forEach(function (q) {
      if (q.length >= 9) {
        fusionnerLigne({ territoire: q[0], zone: q[1], commune: q[2], subdivision: q[3], quartier: q[4], secteur: q[5], variantes: q[6], lat: q[7], lon: q[8] }, true);
      } else {
        fusionnerLigne({ commune: q[0], quartier: q[1], zone: q[2], lat: q[3], lon: q[4], secteur: q[5] || '' }, true);
      }
    });
  }
  var res = ordre.map(function (k) { return parCle[k]; });
  res.sort(function (a, b) {
    var tA = a.territoire === 'Intérieur' ? 1 : 0, tB = b.territoire === 'Intérieur' ? 1 : 0;
    if (tA !== tB) return tA - tB;
    return String(a.zone).localeCompare(String(b.zone)) ||
      String(a.commune).localeCompare(String(b.commune)) ||
      String(a.subdivision).localeCompare(String(b.subdivision)) ||
      String(a.quartier).localeCompare(String(b.quartier)) ||
      String(a.secteur).localeCompare(String(b.secteur));
  });
  return res;
}

// Migre/organise l'onglet Quartiers de façon idempotente en préservant toutes les lignes et coordonnées personnalisées
function migrerQuartiersHierarchie() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(FEUILLES.quartiers);
  var existantes = [];
  if (sh && sh.getLastRow() > 1 && sh.getLastColumn() >= 1) {
    var nc = sh.getLastColumn();
    var ent = sh.getRange(1, 1, 1, nc).getValues()[0].map(normaliser);
    var col = function (noms) {
      for (var i = 0; i < noms.length; i++) { var k = ent.indexOf(normaliser(noms[i])); if (k >= 0) return k; }
      return -1;
    };
    var cTer = col(['Territoire']), cZ = col(['Zone']), cCom = col(['Commune']),
        cSub = col(['Subdivision']), cQ = col(['Quartier']), cSec = col(['Secteur']),
        cVar = col(['Variantes']), cLat = col(['Latitude', 'Lat']), cLon = col(['Longitude', 'Lon']);
    if (cQ < 0) { cCom = 0; cQ = 1; cZ = 2; cLat = 3; cLon = 4; cSec = nc >= 6 ? 5 : -1; }
    var txt = function (r, i) { return (i >= 0 && r[i] !== undefined && r[i] !== null) ? String(r[i]).trim() : ''; };
    sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues().forEach(function (r) {
      var q = txt(r, cQ), com = txt(r, cCom);
      if (!q && !com) return;
      existantes.push({
        territoire: txt(r, cTer), zone: txt(r, cZ), commune: com, subdivision: txt(r, cSub),
        quartier: q, secteur: txt(r, cSec), variantes: txt(r, cVar),
        lat: cLat >= 0 ? r[cLat] : '', lon: cLon >= 0 ? r[cLon] : ''
      });
    });
  }
  var lignes = construireLignesQuartiersOrganisees_(existantes);
  if (!sh) {
    sh = preparerFeuille(ss, FEUILLES.quartiers, ENTETES_QUARTIERS);
  } else {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), ENTETES_QUARTIERS.length)).clearContent();
    if (sh.getLastColumn() > ENTETES_QUARTIERS.length) {
      sh.getRange(1, ENTETES_QUARTIERS.length + 1, 1, sh.getLastColumn() - ENTETES_QUARTIERS.length).clearContent();
    }
    sh.getRange(1, 1, 1, ENTETES_QUARTIERS.length).setValues([ENTETES_QUARTIERS])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
    sh.setFrozenRows(1);
  }
  if (lignes.length) {
    var matrice = lignes.map(function (o) {
      return [o.territoire, o.zone, o.commune, o.subdivision, o.quartier, o.secteur, o.variantes, o.lat, o.lon];
    });
    sh.getRange(2, 1, matrice.length, ENTETES_QUARTIERS.length).setValues(matrice);
  }
  sh.autoResizeColumns(1, ENTETES_QUARTIERS.length);
  assurerColonnesTerritoire_(ss);
  deployerListesValidationTerritoire_(ss);
  try { marquerModif(); } catch (eM) {}
  return { ok: true, lignes: lignes.length };
}

function ecrireQuartiers(ss) {
  var sh = preparerFeuille(ss, FEUILLES.quartiers, ENTETES_QUARTIERS);
  var lignes = construireLignesQuartiersOrganisees_([]);
  if (lignes.length) {
    var matrice = lignes.map(function (o) {
      return [o.territoire, o.zone, o.commune, o.subdivision, o.quartier, o.secteur, o.variantes, o.lat, o.lon];
    });
    sh.getRange(2, 1, matrice.length, ENTETES_QUARTIERS.length).setValues(matrice);
  }
  sh.autoResizeColumns(1, ENTETES_QUARTIERS.length);
  deployerListesValidationTerritoire_(ss);
}

// Ajoute Territoire, Subdivision, Secteur sur Presences, Pharmacies, Etablissements si manquantes
function assurerColonnesTerritoire_(ss) {
  var extra = [['territoire', 'Territoire'], ['subdivision', 'Subdivision'], ['secteur', 'Secteur']];
  [FEUILLES.presences, FEUILLES.pharmacies, FEUILLES.etablissements].forEach(function (nom) {
    var sh = ss.getSheetByName(nom);
    if (sh) completerEntetes(sh, extra);
  });
}

// Déploie les listes déroulantes sur Quartiers, Presences, Pharmacies, Etablissements avec lettres de colonnes dynamiques
function deployerListesValidationTerritoire_(ss) {
  var shQ = ss.getSheetByName(FEUILLES.quartiers);
  if (!shQ || shQ.getLastColumn() < 1) return;
  var entQ = shQ.getRange(1, 1, 1, shQ.getLastColumn()).getValues()[0].map(normaliser);
  var colQ = function (nom) { var i = entQ.indexOf(normaliser(nom)); return i >= 0 ? i + 1 : 0; };
  var maxRowQ = Math.max(shQ.getLastRow() + 50, 600);

  var cTerQ = colQ('Territoire'), cZQ = colQ('Zone');
  if (cTerQ) {
    shQ.getRange(2, cTerQ, maxRowQ, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Abidjan', 'Intérieur'], true).setAllowInvalid(true).build()
    );
  }
  if (cZQ) {
    shQ.getRange(2, cZQ, maxRowQ, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Zone Nord', 'Zone Est', 'Zone Ouest', 'Zone Centre', 'Zone Sud', 'Intérieur'], true).setAllowInvalid(true).build()
    );
  }

  var champsGeo = ['Territoire', 'Zone', 'Commune', 'Subdivision', 'Quartier', 'Secteur'];
  [FEUILLES.presences, FEUILLES.pharmacies, FEUILLES.etablissements].forEach(function (nomF) {
    var sh = ss.getSheetByName(nomF);
    if (!sh || sh.getLastColumn() < 1) return;
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
    var nRows = Math.max(sh.getLastRow() + 200, nomF === FEUILLES.presences ? 3000 : 1000);
    champsGeo.forEach(function (lib) {
      var cDest = ent.indexOf(normaliser(lib)) + 1;
      var cSrc = colQ(lib);
      if (cDest > 0 && cSrc > 0) {
        var lettre = lettreColonne_(cSrc);
        var plageSrc = shQ.getRange(lettre + '2:' + lettre + maxRowQ);
        sh.getRange(2, cDest, nRows, 1).setDataValidation(
          SpreadsheetApp.newDataValidation().requireValueInRange(plageSrc, true).setAllowInvalid(true).build()
        );
      }
    });
  });
}

function ecrireListes(ss) {
  var sh = preparerFeuille(ss, FEUILLES.listes, ['Statut', 'CompteCommeVisite']);
  sh.getRange(2, 1, STATUTS_DEFAUT.length, 2)
    .setValues(STATUTS_DEFAUT.map(function (s) { return [s.nom, s.visite ? 'Oui' : 'Non']; }));
  sh.getRange(2, 2, 50, 1).setDataValidation(liste(['Oui', 'Non']));
  sh.autoResizeColumns(1, 2);
}

// ---------------------------------------------------------------- Mise en forme et listes déroulantes
function liste(valeurs) {
  return SpreadsheetApp.newDataValidation().requireValueInList(valeurs, true).setAllowInvalid(false).build();
}

function formaterPraticiens(ss) {
  var sh = ss.getSheetByName(FEUILLES.praticiens), n = 2000;
  sh.getRange(2, colonne(CHAMPS_PRATICIENS, 'type'), n, 1).setDataValidation(liste(['Médecin', 'Pharmacie']));
  sh.getRange(2, colonne(CHAMPS_PRATICIENS, 'note'), n, 1).setDataValidation(liste(['1', '2', '3']));
  sh.getRange(2, colonne(CHAMPS_PRATICIENS, 'conventionne'), n, 1).setDataValidation(liste(['Oui', 'Non']));
  sh.getRange(2, colonne(CHAMPS_PRATICIENS, 'actif'), n, 1).setDataValidation(liste(['Oui', 'Non']));
  sh.getRange(2, colonne(CHAMPS_PRATICIENS, 'derniere'), n, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, colonne(CHAMPS_PRATICIENS, 'telephone'), n, 1).setNumberFormat('@');
  sh.setFrozenColumns(3);
  sh.autoResizeColumns(1, CHAMPS_PRATICIENS.length);
  sh.setColumnWidth(colonne(CHAMPS_PRATICIENS, 'commentaire'), 260);
}

function formaterPresences(ss) {
  var sh = ss.getSheetByName(FEUILLES.presences), n = 3000;
  var c1 = colonne(CHAMPS_PRESENCES, 'lundi');
  var jours = sh.getRange(2, c1, n, 5);
  jours.setDataValidation(liste(DISPOS)).setHorizontalAlignment('center');
  var shQ = ss.getSheetByName(FEUILLES.quartiers);
  if (shQ && shQ.getLastColumn() >= 1) {
    var entQ = shQ.getRange(1, 1, 1, shQ.getLastColumn()).getValues()[0].map(normaliser);
    var idxQ = entQ.indexOf(normaliser('Quartier'));
    var colQ = idxQ >= 0 ? idxQ + 1 : 2;
    var letQ = lettreColonne_(colQ);
    var maxQ = Math.max(shQ.getLastRow() + 50, 600);
    sh.getRange(2, colonne(CHAMPS_PRESENCES, 'quartier'), n, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInRange(shQ.getRange(letQ + '2:' + letQ + maxQ), true)
        .setAllowInvalid(true).build());
  }
  var shP = ss.getSheetByName(FEUILLES.praticiens);
  if (shP && shP.getLastColumn() >= 1) {
    var entP = shP.getRange(1, 1, 1, shP.getLastColumn()).getValues()[0].map(normaliser);
    var idxCodeP = entP.indexOf(normaliser('CodeContact'));
    var letCodeP = lettreColonne_(idxCodeP >= 0 ? idxCodeP + 1 : 1);
    sh.getRange(2, colonne(CHAMPS_PRESENCES, 'code'), n, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInRange(shP.getRange(letCodeP + '2:' + letCodeP + '3000'), true)
        .setAllowInvalid(false).build());
  }
  sh.getRange(2, colonne(CHAMPS_PRESENCES, 'horaireMatin'), n, 2).setNumberFormat('@');
  var couleurs = [['Matin et soir', '#CDE8D6'], ['Matin', '#FDF1D6'], ['Soir', '#DDEBF0']];
  sh.setConditionalFormatRules(couleurs.map(function (c) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(c[0]).setBackground(c[1]).setRanges([jours]).build();
  }));
  sh.setFrozenColumns(3);
  sh.autoResizeColumns(1, sh.getLastColumn() || CHAMPS_PRESENCES.length);
  for (var j = 0; j < 5; j++) sh.setColumnWidth(c1 + j, 105);
  deployerListesValidationTerritoire_(ss);
}

function formaterHistorique(sh) {
  sh.getRange('A:A').setNumberFormat('dd/mm/yyyy');
  sh.getRange('B:B').setNumberFormat('dd/mm/yyyy hh:mm');
  sh.setColumnWidth(5, 200); sh.setColumnWidth(11, 230); sh.setColumnWidth(14, 280);
}

// Recrée la feuille à neuf (supprime aussi un éventuel « tableau » Google Sheets à colonnes typées,
// qui empêcherait d'écrire les formats et les listes déroulantes)
function preparerFeuille(ss, nom, entetes) {
  var sh = ss.getSheetByName(nom), tmp = null;
  if (sh) {
    if (ss.getSheets().length === 1) tmp = ss.insertSheet('_tmp_tournees');
    ss.deleteSheet(sh);
  }
  sh = ss.insertSheet(nom);
  if (tmp) ss.deleteSheet(tmp);
  sh.getRange(1, 1, 1, entetes.length).setValues([entetes])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
  sh.setFrozenRows(1);
  return sh;
}

function ordonnerFeuilles(ss) {
  [FEUILLES.praticiens, FEUILLES.presences, FEUILLES.etablissements, FEUILLES.pharmacies, FEUILLES.plannings, FEUILLES.hist, FEUILLES.quartiers, FEUILLES.listes]
    .forEach(function (n, i) {
      var sh = ss.getSheetByName(n);
      if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
    });
  ss.setActiveSheet(ss.getSheetByName(FEUILLES.praticiens));
}

function colonne(champs, cle) { return indexChamp(champs, cle) + 1; }
function indexChamp(champs, cle) {
  for (var i = 0; i < champs.length; i++) if (champs[i][0] === cle) return i;
  return -1;
}

// ---------------------------------------------------------------- Conversion de l'ancienne base (v1/v2)
// BaseDonnees : une ligne par lieu x jour x créneau -> Praticiens + Presences
function convertirAncienneBase() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  var sh = ss.getSheetByName(FEUILLES.ancienneBase);
  if (!sh || sh.getLastRow() < 2) { ui.alert('Aucune feuille BaseDonnees à convertir.'); return; }
  if (ui.alert('Convertir BaseDonnees', 'Les feuilles Praticiens et Presences seront remplacées par la conversion. Continuer ?',
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var anciens = [['id', 'ID'], ['code', 'CodeContact'], ['type', 'Type'], ['nom', 'Nom'], ['specialite', 'Spécialité'],
    ['priorite', 'Priorité'], ['zone', 'Zone'], ['commune', 'Commune'], ['quartier', 'Quartier'], ['lieu', 'Lieu/Etablissement'],
    ['jour', 'Jour'], ['creneau', 'Créneau'], ['heure', 'Heure'], ['derniere', 'DateDerniereVisite'],
    ['statut', 'DernierStatut'], ['commentaire', 'DernierCommentaire'], ['nbVisites', 'NbVisites']];
  var lignes = lireObjets(sh, anciens, tz);
  var prat = {}, ordre = [], pres = {}, ordreP = [];
  lignes.forEach(function (l) {
    if (!l.code) return;
    if (!prat[l.code]) {
      prat[l.code] = { code: l.code, type: l.type, nom: l.nom, specialite: l.specialite,
        note: Math.min(3, Math.max(1, 4 - (+l.priorite || 2))), conventionne: '', telephone: '', derniere: l.derniere,
        statut: l.statut, commentaire: l.commentaire, nbVisites: l.nbVisites || 0, actif: 'Oui' };
      ordre.push(l.code);
    }
    var k = l.code + '|' + l.lieu + '|' + l.quartier;
    if (!pres[k]) {
      pres[k] = { code: l.code, nom: l.nom, lieu: l.lieu, quartier: l.quartier, commune: l.commune, zone: l.zone,
                  horaireMatin: '', horaireSoir: '', lat: '', lon: '', grille: JOURS.map(function () { return { matin: false, soir: false }; }) };
      ordreP.push(k);
    }
    var j = JOURS.map(normaliser).indexOf(normaliser(l.jour));
    if (j < 0) return;
    var soir = normaliser(l.creneau).indexOf('matin') < 0;
    if (soir) pres[k].grille[j].soir = true; else pres[k].grille[j].matin = true;
    var h = heureVersMinutes(l.heure);
    if (h !== null) {
      var plage = minutesVersHeure(h) + '-' + minutesVersHeure(Math.min(h + 240, 23 * 60));
      if (soir) pres[k].horaireSoir = pres[k].horaireSoir || plage; else pres[k].horaireMatin = pres[k].horaireMatin || plage;
    }
  });
  var shP = preparerFeuille(ss, FEUILLES.praticiens, CHAMPS_PRATICIENS.map(function (c) { return c[1]; }));
  if (ordre.length) shP.getRange(2, 1, ordre.length, CHAMPS_PRATICIENS.length).setValues(ordre.map(function (c) {
    var p = prat[c];
    return CHAMPS_PRATICIENS.map(function (f) {
      if (f[0] === 'derniere') return p.derniere ? Utilities.parseDate(p.derniere, tz, 'yyyy-MM-dd') : '';
      return p[f[0]] === undefined ? '' : p[f[0]];
    });
  }));
  var shR = preparerFeuille(ss, FEUILLES.presences, CHAMPS_PRESENCES.map(function (c) { return c[1]; }));
  shR.getRange(2, colonne(CHAMPS_PRESENCES, 'horaireMatin'), 3000, 2).setNumberFormat('@');
  if (ordreP.length) shR.getRange(2, 1, ordreP.length, CHAMPS_PRESENCES.length).setValues(ordreP.map(function (k, i) {
    var p = pres[k]; p.id = i + 1;
    JOURS_CLES.forEach(function (j, n) { p[j] = ecrireDispo(p.grille[n]); });
    return CHAMPS_PRESENCES.map(function (f) { return p[f[0]] === undefined ? '' : p[f[0]]; });
  }));
  formaterPraticiens(ss);
  formaterPresences(ss);
  ordonnerFeuilles(ss);
  ui.alert('Conversion terminée : ' + ordre.length + ' praticiens, ' + ordreP.length + ' lieux. ' +
           'Complétez les colonnes Engagé et les horaires si nécessaire, puis supprimez BaseDonnees.');
}

// ---------------------------------------------------------------- Migration 3.5.0 (une seule fois)
// Listes : statuts et CompteCommeVisite, activités médecins et pharmacies, produits, délégués.
// Données : anciens statuts et anciennes activités convertis (Historique, Praticiens, Pharmacies, Plannings).
function migrer350(ss, sh) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIGRATION_350')) return;
  var tz = ss.getSpreadsheetTimeZone();
  function colonne(nom) {
    var ent = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(normaliser), i = ent.indexOf(normaliser(nom));
    if (i >= 0) return i + 1;
    var c = sh.getLastColumn() + 2;
    sh.getRange(1, c).setValue(nom).setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
    return c;
  }
  function ecrireColonne(c, valeurs) {
    if (sh.getLastRow() > 1) sh.getRange(2, c, sh.getLastRow() - 1, 1).clearContent();
    if (valeurs.length) sh.getRange(2, c, valeurs.length, 1).setValues(valeurs.map(function (v) { return [v]; }));
  }
  // statuts (colonnes A et B)
  sh.getRange(1, 1, 1, 2).setValues([['Statut', 'CompteCommeVisite']]);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  sh.getRange(2, 1, STATUTS_DEFAUT.length, 2).setValues(STATUTS_DEFAUT.map(function (x) { return [x.nom, x.visite ? 'Oui' : 'Non']; }));
  sh.getRange(2, 2, STATUTS_DEFAUT.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Oui', 'Non'], true).build());
  ecrireColonne(colonne('Activités'), ACTIVITES_DEFAUT);
  ecrireColonne(colonne('ActivitésPharmacie'), ACTIVITES_PHARMACIE_DEFAUT);
  // produits : catalogue de référence, les produits ajoutés à la main sont conservés
  var cP = colonne('Produits'), anciens = sh.getLastRow() > 1 ? sh.getRange(2, cP, sh.getLastRow() - 1, 1).getValues().map(function (v) { return String(v[0]).trim(); }).filter(Boolean) : [];
  ecrireColonne(cP, PRODUITS_DEFAUT.concat(anciens.filter(function (x) { return PRODUITS_DEFAUT.indexOf(x) < 0; })));
  // délégués : liste actuelle + noms trouvés dans les tournées et l'historique
  var cD = colonne('Délégués'), noms = {};
  if (sh.getLastRow() > 1) sh.getRange(2, cD, sh.getLastRow() - 1, 1).getValues().forEach(function (v) { var n = String(v[0]).trim(); if (n) noms[n] = true; });
  [[FEUILLES.plannings, CHAMPS_PLAN], [FEUILLES.hist, CHAMPS_HIST]].forEach(function (x) {
    lireObjets(ss.getSheetByName(x[0]), x[1], tz).forEach(function (o) { var n = String(o.delegue || '').trim(); if (n) noms[n] = true; });
  });
  ecrireColonne(cD, Object.keys(noms).sort());
  // conversion des valeurs dans les feuilles de données
  function convertir(nomFeuille, entete, table, multiple) {
    var f = ss.getSheetByName(nomFeuille);
    if (!f || f.getLastRow() < 2) return;
    var ent = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0].map(normaliser), c = ent.indexOf(normaliser(entete));
    if (c < 0) return;
    var r = f.getRange(2, c + 1, f.getLastRow() - 1, 1), vals = r.getValues(), modif = false;
    vals.forEach(function (l) {
      var v = String(l[0]);
      var n = multiple ? v.split(/\s*;\s*/).map(function (x) { return table[x] || x; }).join(' ; ') : (table[v] || v);
      if (n !== v) { l[0] = n; modif = true; }
    });
    if (modif) r.setValues(vals);
  }
  convertir(FEUILLES.hist, 'Statut', STATUTS_RENOMMES);
  convertir(FEUILLES.hist, 'Activité', ACTIVITES_RENOMMEES, true);
  convertir(FEUILLES.praticiens, 'DernierStatut', STATUTS_RENOMMES);
  convertir(FEUILLES.pharmacies, 'DernierStatut', STATUTS_RENOMMES);
  convertir(FEUILLES.plannings, 'Statut', STATUTS_RENOMMES);
  props.setProperty('MIGRATION_350', new Date().toISOString());
}

// ---------------------------------------------------------------- Structure (migration automatique)
// 3.7.0 : feuille « Fiches produits » (aide-mémoire du délégué), créée une seule fois avec les fiches de référence,
// ensuite modifiable librement dans le classeur : l'application affiche ce qu'elle contient
function assurerFichesProduits(ss) {
  var sh = ss.getSheetByName(FEUILLES.fiches);
  if (sh) { completerEntetes(sh, CHAMPS_FICHES); synchroniserFichesAvecListes(ss, sh); return sh; }
  sh = ss.insertSheet(FEUILLES.fiches);
  var ent = CHAMPS_FICHES.map(function (c) { return c[1]; });
  sh.getRange(1, 1, 1, ent.length).setValues([ent]).setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
  var lignes = FICHES_PRODUITS_DEFAUT.map(function (f) { return CHAMPS_FICHES.map(function (c) { return f[c[0]] || ''; }); });
  sh.getRange(2, 1, lignes.length, ent.length).setValues(lignes).setWrap(true).setVerticalAlignment('top');
  sh.setFrozenRows(1); sh.setFrozenColumns(3);
  [150, 150, 110, 200, 180, 280, 300, 230, 280, 220, 300, 160, 240].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 3, lignes.length, 1).setFontWeight('bold');
  synchroniserFichesAvecListes(ss, sh);
  return sh;
}

// 3.25.40 : Synchronisation avec Listes!K : tout produit ajouté dans Listes!K absent de Fiches produits est créé avec ses infos
// Les produits retirés de Listes!K ne sont JAMAIS supprimés de Fiches produits
function synchroniserFichesAvecListes(ss, sh) {
  if (!sh) return;
  var tz = ss.getSpreadsheetTimeZone();
  var listes = lireListes(ss, tz);
  var prodsListe = listes.produits || [];
  if (!prodsListe.length) return;

  var existants = lireObjets(sh, CHAMPS_FICHES, tz);
  var vus = {};
  existants.forEach(function (f) { vus[normaliser(f.produit)] = true; });

  var aAjouter = [];
  prodsListe.forEach(function (nom) {
    nom = String(nom || '').trim();
    if (!nom || vus[normaliser(nom)]) return;
    vus[normaliser(nom)] = true;

    // Chercher modèle de la même gamme
    var kn = normaliser(nom);
    var model = existants.filter(function (f) {
      var kf = normaliser(f.produit);
      return kn.indexOf(kf) === 0 || kf.indexOf(kn) === 0 || normaliser(f.gamme).indexOf(kn.split(' ')[0]) >= 0;
    })[0];

    var gamme = nom, aire = 'Cardiologie & Métabolisme', classe = '';
    if (model) {
      gamme = model.gamme; aire = model.aire; classe = model.classe;
    } else {
      if (/zyltan|losartan/i.test(nom)) { gamme = 'Zyltan (losartan)'; aire = 'Hypertension artérielle'; classe = 'ARA II'; }
      else if (/lesstrol|lestrol/i.test(nom)) { gamme = 'Lesstrol (atorvastatine)'; aire = 'Cholestérol et risque cardiovasculaire'; classe = 'Statine'; }
      else if (/tensicard/i.test(nom)) { gamme = 'Tensicard (aténolol)'; aire = 'Hypertension artérielle'; classe = 'Bêtabloquant'; }
      else if (/eurythmic/i.test(nom)) { gamme = 'Eurythmic (amiodarone)'; aire = 'Troubles du rythme cardiaque'; classe = 'Antiarythmique'; }
      else if (/telmikaa/i.test(nom)) { gamme = 'Telmikaa (telmisartan)'; aire = 'Hypertension artérielle'; classe = 'ARA II'; }
      else if (/rozukaa/i.test(nom)) { gamme = 'Rozukaa (rosuvastatine)'; aire = 'Cholestérol et risque cardiovasculaire'; classe = 'Statine'; }
      else if (/antiplatt/i.test(nom)) { gamme = 'Antiplatt (clopidogrel)'; aire = 'Prévention de la thrombose'; classe = 'Antiagrégant plaquettaire'; }
      else if (/myonit/i.test(nom)) { gamme = 'Myonit (trinitrine)'; aire = 'Angine de poitrine'; classe = 'Dérivé nitré'; }
    }

    var obj = {
      gamme: gamme,
      aire: aire,
      produit: nom,
      dci: model ? model.dci : nom,
      classe: classe,
      indications: model ? model.indications : 'Indication officielle selon notice du produit',
      contreIndications: model ? model.contreIndications : '',
      posologie: model ? model.posologie : 'Selon prescription médicale',
      precautions: model ? model.precautions : '',
      effetsIndesirables: model ? model.effetsIndesirables : '',
      arguments: model ? model.arguments : ''
    };
    var row = CHAMPS_FICHES.map(function (c) { return obj[c[0]] || ''; });
    aAjouter.push(row);
  });

  if (aAjouter.length > 0) {
    var startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, aAjouter.length, aAjouter[0].length).setValues(aAjouter).setWrap(true).setVerticalAlignment('top');
    sh.getRange(startRow, 3, aAjouter.length, 1).setFontWeight('bold');
  }
}

// 3.8.0 : comptes rendus de la journée, une ligne par délégué et par jour (remplacée à chaque nouvelle validation)
function assurerRapports(ss) {
  var sh = ss.getSheetByName(FEUILLES.rapports);
  if (sh) { completerEntetes(sh, CHAMPS_RAPPORTS); return sh; }
  sh = preparerFeuille(ss, FEUILLES.rapports, CHAMPS_RAPPORTS.map(function (c) { return c[1]; }));
  sh.getRange(1, 1, 1000, CHAMPS_RAPPORTS.length).setNumberFormat('@');
  [130, 100, 130, 70, 70, 200, 70, 360, 260, 220, 220, 80, 150].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 1, 999, CHAMPS_RAPPORTS.length).setWrap(true).setVerticalAlignment('top');
  return sh;
}
function assurerStructure(ss) {
  assurerFichesProduits(ss);
  assurerRapports(ss);
  // 3.5.0 : la colonne « Conventionné » devient « Engagé » (données conservées)
  [FEUILLES.praticiens, FEUILLES.pharmacies].forEach(function (f) { renommerEntete(ss.getSheetByName(f), 'Conventionné', 'Engagé'); });
  if (!ss.getSheetByName(FEUILLES.plannings)) {
    preparerFeuille(ss, FEUILLES.plannings, CHAMPS_PLAN.map(function (c) { return c[1]; }))
      .getRange(1, 1, 1000, CHAMPS_PLAN.length).setNumberFormat('@');
  } else {
    completerEntetes(ss.getSheetByName(FEUILLES.plannings), CHAMPS_PLAN);
  }
  if (!ss.getSheetByName(FEUILLES.hist)) {
    formaterHistorique(preparerFeuille(ss, FEUILLES.hist, CHAMPS_HIST.map(function (c) { return c[1]; })));
  } else {
    completerEntetes(ss.getSheetByName(FEUILLES.hist), CHAMPS_HIST);
  }
  if (!ss.getSheetByName(FEUILLES.praticiens)) preparerFeuille(ss, FEUILLES.praticiens, CHAMPS_PRATICIENS.map(function (c) { return c[1]; }));
  else completerEntetes(ss.getSheetByName(FEUILLES.praticiens), CHAMPS_PRATICIENS);
  assurerListes(ss);
  if (!ss.getSheetByName(FEUILLES.presences)) preparerFeuille(ss, FEUILLES.presences, CHAMPS_PRESENCES.map(function (c) { return c[1]; }));
  else completerEntetes(ss.getSheetByName(FEUILLES.presences), CHAMPS_PRESENCES);
  if (!ss.getSheetByName(FEUILLES.etablissements)) preparerFeuille(ss, FEUILLES.etablissements, CHAMPS_ETABLISSEMENTS.map(function (c) { return c[1]; }));
  else completerEntetes(ss.getSheetByName(FEUILLES.etablissements), CHAMPS_ETABLISSEMENTS);
  assurerColonnesTerritoire_(ss);
  if (FEUILLES.audit && !ss.getSheetByName(FEUILLES.audit)) {
    var shA = preparerFeuille(ss, FEUILLES.audit, ['Horodatage', 'Auteur', 'Action', 'Entite', 'Code', 'Details']);
    shA.setFrozenRows(1);
  }
}

function renommerEntete(sh, ancien, nouveau) {
  if (!sh || sh.getLastColumn() < 1) return;
  var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  var i = ent.indexOf(normaliser(ancien));
  if (i >= 0 && ent.indexOf(normaliser(nouveau)) < 0) sh.getRange(1, i + 1).setValue(nouveau);
}

// Ajoute en fin de ligne d'en-tête les colonnes attendues qui manquent
function completerEntetes(sh, champs) {
  var nb = Math.max(sh.getLastColumn(), 1);
  var ent = sh.getRange(1, 1, 1, nb).getValues()[0].map(normaliser);
  champs.forEach(function (c) {
    if (ent.indexOf(normaliser(c[1])) < 0) {
      sh.getRange(1, ent.length + 1).setValue(c[1]).setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
      ent.push(normaliser(c[1]));
    }
  });
}

// ---------------------------------------------------------------- Données manquantes de la base de TEST
// Comble les trous sans rien effacer ni renuméroter (voir completerDonneesFictives dans Commun.gs) :
// téléphones fictifs (+225 00 …), dernier statut / commentaire / nombre de visites des praticiens déjà visités,
// coordonnées GPS des établissements, et colonnes manquantes des tournées publiées par une ancienne version.
// À NE PAS utiliser sur une vraie base (les téléphones et commentaires seraient inventés).
function completerBaseTest() {
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
    var r = { praticiens: completerFeuille(ss, FEUILLES.praticiens, CHAMPS_PRATICIENS, ['telephone', 'statut', 'commentaire', 'nbVisites'], tz),
              plannings: completerPlannings(ss) };
    var quartiers = referentielQuartiers_(ss).filter(function (q) {
      return isFinite(parseFloat(q.lat)) && isFinite(parseFloat(q.lon));
    });
    r.presences = completerFeuille(ss, FEUILLES.presences, CHAMPS_PRESENCES, ['lat', 'lon'], tz, quartiers);
    var msg = 'Praticiens : ' + JSON.stringify(r.praticiens) + '\nPresences : ' + JSON.stringify(r.presences) + '\nPlannings : ' + r.plannings + ' ligne(s) complétée(s)';
    Logger.log(msg);
    return msg;
  } finally {
    lock.releaseLock();
  }
}
function completerFeuille(ss, nom, champs, cles, tz, quartiers) {
  var sh = ss.getSheetByName(nom), n = sh.getLastRow() - 1;
  if (n < 1) return {};
  var objets = lireObjets(sh, champs, tz);
  var res = nom === FEUILLES.praticiens ? completerDonneesFictives(objets, [], []) : completerDonneesFictives([], objets, quartiers);
  var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  cles.forEach(function (k) {
    var c = ent.indexOf(normaliser(champs[indexChamp(champs, k)][1]));
    if (c < 0) return;
    var rng = sh.getRange(2, c + 1, n, 1);
    if (k === 'telephone') rng.setNumberFormat('@');
    rng.setValues(objets.map(function (o) { return [o[k] === undefined ? '' : o[k]]; }));
  });
  return res;
}
// Tournées publiées par une ancienne version : IdPresence, Debut, Fin, Note et Programme retrouvés
function completerPlannings(ss) {
  var sh = ss.getSheetByName(FEUILLES.plannings), n = sh ? sh.getLastRow() - 1 : 0;
  if (n < 1) return 0;
  var tz = ss.getSpreadsheetTimeZone();
  var notes = {}, specs = {}, noms = {};
  lireObjets(ss.getSheetByName(FEUILLES.praticiens), CHAMPS_PRATICIENS, tz).forEach(function (p) { notes[p.code] = lireNote(p.note); specs[p.code] = p.specialite; noms[p.code] = p.nom; });
  var parCode = {};
  lireObjets(ss.getSheetByName(FEUILLES.presences), CHAMPS_PRESENCES, tz).forEach(function (p) { (parCode[p.code] = parCode[p.code] || []).push(p); });
  var data = sh.getRange(2, 1, n, CHAMPS_PLAN.length).getDisplayValues(), modif = 0;
  function i(k) { return indexChamp(CHAMPS_PLAN, k); }
  data.forEach(function (l) {
    if (!l[i('delegue')]) return;
    if (!l[i('etat')]) { l[i('etat')] = 'Prévu'; modif++; }
    if (!l[i('statut')]) { l[i('statut')] = 'À faire'; modif++; }
    // ancienne version : date de ciblage reprise de la date de mise à jour (priorité au premier arrivé)
    if (!l[i('depuis')] && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(l[i('maj')])) { l[i('depuis')] = l[i('maj')].replace(' ', 'T') + ':00.000Z'; modif++; }
    ['specialite', 'nom'].forEach(function (k) {
      var src = k === 'nom' ? noms : specs;
      if (!l[i(k)] && src[l[i('code')]]) { l[i(k)] = src[l[i('code')]]; modif++; }
    });
    if (l[i('idPresence')] && l[i('debut')] && l[i('note')] && l[i('programme')] && l[i('quartier')] && l[i('lieu')]) return;
    var j = jourSemaineIndex(versIso(l[i('date')], tz)), cren = l[i('creneau')] || 'Matin';
    if (j > 4) return;
    var lieux = parCode[l[i('code')]] || [];
    // lieu où le praticien est présent ce jour-là à ce créneau ; à défaut, son premier lieu connu
    var pres = lieux.filter(function (p) { var d = lireDispo(p[JOURS_CLES[j]]); return cren === 'Soir' ? d.soir : d.matin; })[0] || lieux[0];
    if (pres) {
      var h = lireHoraire(cren === 'Soir' ? pres.horaireSoir : pres.horaireMatin, cren === 'Soir' ? REGLAGES_MOTEUR.horaireSoirDefaut : REGLAGES_MOTEUR.horaireMatinDefaut);
      if (!l[i('idPresence')]) { l[i('idPresence')] = String(pres.id); l[i('debut')] = minutesVersHeure(h[0]); l[i('fin')] = minutesVersHeure(h[1]); }
      if (!l[i('lieu')]) l[i('lieu')] = pres.lieu;
      if (!l[i('quartier')]) l[i('quartier')] = pres.quartier;
      if (!l[i('heure')]) l[i('heure')] = l[i('debut')];
      if (!l[i('commune')]) l[i('commune')] = pres.commune;
    }
    if (!l[i('note')]) l[i('note')] = String(notes[l[i('code')]] || 2);
    if (!l[i('programme')]) l[i('programme')] = 'Proposition';
    modif++;
  });
  if (modif) sh.getRange(2, 1, n, CHAMPS_PLAN.length).setNumberFormat('@').setValues(data);
  return modif;
}

// ---------------------------------------------------------------- Pharmacies réelles (OpenStreetMap)
// Les données brutes (PHARMACIES_OSM : [nom, lat, lon, téléphone, quartier OSM, commune OSM]) sont dans le fichier
// DonneesPharmacies.gs. Le quartier, la commune et la zone manquants sont déduits du quartier de référence le plus proche.
// Les pharmacies fictives (PHA-001 à PHA-100) sont retirées des feuilles Praticiens et Presences.
function importerPharmacies() {
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  var Q = referentielQuartiers_(ss).filter(function (q) {
    return isFinite(parseFloat(q.lat)) && isFinite(parseFloat(q.lon));
  });
  var communes = {}; Q.forEach(function (q) { communes[normaliser(q.commune)] = q; });
  var anciennes = {};
  if (ss.getSheetByName(FEUILLES.pharmacies)) lirePharmacies(ss, tz).forEach(function (p) { anciennes[normaliser(p.nom) + '|' + p.lat] = p; });
  var vus = {}, lignes = [], k = 1000;
  (typeof PHARMACIES_OSM !== 'undefined' ? PHARMACIES_OSM : []).forEach(function (x) {
    var nom = String(x[0] || '').trim(); if (!nom) return;
    if (!/pharm/i.test(nom)) nom = 'Pharmacie ' + nom;
    var cle = normaliser(nom) + '|' + Math.round(x[1] * 1000) + '|' + Math.round(x[2] * 1000);
    if (vus[cle]) return; vus[cle] = true;
    var best = null, bd = Infinity;
    Q.forEach(function (q) { var d = distanceKm({ lat: x[1], lon: x[2] }, { lat: +q.lat, lon: +q.lon }); if (d < bd) { bd = d; best = q; } });
    if (!best || bd > 12) return;                                  // hors du district d'Abidjan
    var com = x[5] && communes[normaliser(x[5])] ? communes[normaliser(x[5])] : best;
    var resT = resoudreTerritoireEcriture_({ commune: com.commune, quartier: x[4] || best.quartier, lieu: nom }, Q);
    var ex = anciennes[normaliser(nom) + '|' + x[1]] || {};
    lignes.push({ code: ex.code || 'PHA-' + (++k), nom: nom, titulaire: ex.titulaire || '',
      territoire: resT.territoire || best.territoire || 'Abidjan',
      zone: resT.zone || com.zone || '',
      commune: resT.commune || com.commune || '',
      subdivision: resT.subdivision || '',
      quartier: resT.quartier || x[4] || best.quartier,
      secteur: resT.secteur || '',
      lat: x[1], lon: x[2], telephone: x[3] || ex.telephone || '', horaireMatin: HORAIRES_PHARMACIE[0], horaireSoir: HORAIRES_PHARMACIE[1],
      note: ex.note || 2, conventionne: ex.conventionne || '', derniere: ex.derniere || '', statut: ex.statut || '', commentaire: ex.commentaire || '',
      nbVisites: ex.nbVisites || 0, actif: ex.actif || 'Oui', prochaine: ex.prochaine || '', source: 'OpenStreetMap' });
  });
  lignes.sort(function (a, b) { return a.commune.localeCompare(b.commune) || a.nom.localeCompare(b.nom); });
  var champsPh = typeof champsEcrAvecTerritoire_ === 'function' ? champsEcrAvecTerritoire_(CHAMPS_PHARMACIES) : CHAMPS_PHARMACIES;
  var sh = preparerFeuille(ss, FEUILLES.pharmacies, champsPh.map(function (c) { return c[1]; }));
  if (lignes.length) {
    sh.getRange(2, colonne(champsPh, 'telephone'), lignes.length, 1).setNumberFormat('@');
    sh.getRange(2, colonne(champsPh, 'horaireMatin'), lignes.length, 2).setNumberFormat('@');
    sh.getRange(2, 1, lignes.length, champsPh.length).setValues(lignes.map(function (o) {
      return champsPh.map(function (c) {
        var val = o[c[0]];
        if ((c[0] === 'derniere' || c[0] === 'prochaine') && val) return Utilities.parseDate(val, tz, 'yyyy-MM-dd');
        return val === undefined ? '' : val;
      });
    }));
    sh.getRange(2, colonne(champsPh, 'note'), lignes.length, 1).setDataValidation(liste(['1', '2', '3']));
    sh.getRange(2, colonne(champsPh, 'derniere'), lignes.length, 1).setNumberFormat('dd/mm/yyyy');
    sh.setFrozenColumns(2);
    sh.autoResizeColumns(1, champsPh.length);
  }
  deployerListesValidationTerritoire_(ss);
  // retrait des pharmacies fictives des feuilles des médecins
  [[FEUILLES.praticiens, 'CodeContact'], [FEUILLES.presences, 'CodeContact']].forEach(function (f) {
    var s2 = ss.getSheetByName(f[0]); if (!s2 || s2.getLastRow() < 2) return;
    var c = s2.getRange(1, 1, 1, s2.getLastColumn()).getValues()[0].map(normaliser).indexOf(normaliser(f[1]));
    var vals = s2.getRange(2, c + 1, s2.getLastRow() - 1, 1).getValues();
    for (var i = vals.length - 1; i >= 0; i--) if (/^PHA-0\d\d$|^PHA-100$/.test(String(vals[i][0]))) s2.deleteRow(i + 2);
  });
  ordonnerFeuilles(ss);
  var msg = lignes.length + ' pharmacies importées dans la feuille Pharmacies (source OpenStreetMap).';
  Logger.log(msg);
  return msg;
}

// Propage les définitions de l'onglet Quartiers vers Presences, Pharmacies, Etablissements et Plannings à venir (jamais le passé historique)
function propagerQuartiersSurFiches_(ss, lignesEditees, opts) {
  ss = ss || SpreadsheetApp.getActive();
  opts = opts || {};
  var tz = ss.getSpreadsheetTimeZone();
  var aujourdhui = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  assurerColonnesTerritoire_(ss);
  var refQ = referentielQuartiers_(ss);

  var cibles = null;
  if (Array.isArray(lignesEditees) && lignesEditees.length) {
    cibles = [];
    var shQ = ss.getSheetByName(FEUILLES.quartiers);
    var sontNombres = typeof lignesEditees[0] === 'number';
    if (sontNombres && shQ && shQ.getLastRow() > 1 && shQ.getLastColumn() >= 1) {
      var ncQ = shQ.getLastColumn();
      var entQ = shQ.getRange(1, 1, 1, ncQ).getValues()[0].map(normaliser);
      var colQ = function (noms) {
        for (var i = 0; i < noms.length; i++) { var k = entQ.indexOf(normaliser(noms[i])); if (k >= 0) return k; }
        return -1;
      };
      var cTerQ = colQ(['Territoire']), cZQ = colQ(['Zone']), cComQ = colQ(['Commune']),
          cSubQ = colQ(['Subdivision']), cQQ = colQ(['Quartier']), cSecQ = colQ(['Secteur']),
          cVarQ = colQ(['Variantes']);
      if (cQQ < 0) { cComQ = 0; cQQ = 1; cZQ = 2; cSecQ = ncQ >= 6 ? 5 : -1; }
      var txtQ = function (r, i) { return (i >= 0 && r[i] !== undefined && r[i] !== null) ? String(r[i]).trim() : ''; };
      lignesEditees.forEach(function (numLigne) {
        if (numLigne < 2 || numLigne > shQ.getLastRow()) return;
        var r = shQ.getRange(numLigne, 1, 1, ncQ).getValues()[0];
        var q = txtQ(r, cQQ), s = txtQ(r, cSecQ), com = txtQ(r, cComQ);
        if (!q && !s && !com) return;
        cibles.push({
          territoire: txtQ(r, cTerQ), zone: txtQ(r, cZQ),
          commune: typeof communeParente === 'function' ? communeParente(com) : com,
          subdivision: txtQ(r, cSubQ), quartier: q, secteur: s, variantes: txtQ(r, cVarQ)
        });
      });
    } else if (!sontNombres) {
      cibles = lignesEditees.filter(Boolean);
    }
    if (!cibles.length) return { presences: 0, pharmacies: 0, etablissements: 0, plannings: 0, total: 0, tablesModifiees: [] };
  }

  var ancienNorm = opts.ancienLibelle ? normaliser(opts.ancienLibelle) : '';
  var correspondCible = function (fiche, resT) {
    if (!cibles) return true;
    var rCom = normaliser(resT.commune), rQ = normaliser(resT.quartier), rS = normaliser(resT.secteur);
    for (var i = 0; i < cibles.length; i++) {
      var c = cibles[i];
      var cCom = normaliser(c.commune), cQ = normaliser(c.quartier), cS = normaliser(c.secteur);
      if (cQ && rQ === cQ && (!cCom || !rCom || rCom === cCom) && (!cS || rS === cS)) return true;
      if (cS && rS === cS && (!cCom || !rCom || rCom === cCom)) return true;
    }
    if (ancienNorm && (normaliser(fiche.quartier) === ancienNorm || normaliser(fiche.secteur) === ancienNorm)) return true;
    return false;
  };

  var bilan = { presences: 0, pharmacies: 0, etablissements: 0, plannings: 0, total: 0, tablesModifiees: [] };
  var configs = [
    { key: 'presences', feuille: FEUILLES.presences, table: 'presences', lieuCol: 'Lieu/Etablissement', futurSeulement: false },
    { key: 'pharmacies', feuille: FEUILLES.pharmacies, table: 'pharmacies', lieuCol: 'Nom', futurSeulement: false },
    { key: 'etablissements', feuille: FEUILLES.etablissements, table: 'etablissements', lieuCol: 'Nom', futurSeulement: false },
    { key: 'plannings', feuille: FEUILLES.plannings, table: 'plannings', lieuCol: 'Lieu/Etablissement', futurSeulement: true }
  ];

  configs.forEach(function (cfg) {
    var sh = ss.getSheetByName(cfg.feuille);
    if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return;
    var nc = sh.getLastColumn(), n = sh.getLastRow() - 1;
    var ent = sh.getRange(1, 1, 1, nc).getValues()[0].map(normaliser);
    var cTer = ent.indexOf(normaliser('Territoire')), cZ = ent.indexOf(normaliser('Zone')),
        cCom = ent.indexOf(normaliser('Commune')), cSub = ent.indexOf(normaliser('Subdivision')),
        cQ = ent.indexOf(normaliser('Quartier')), cSec = ent.indexOf(normaliser('Secteur')),
        cLieu = ent.indexOf(normaliser(cfg.lieuCol)), cDate = cfg.futurSeulement ? ent.indexOf(normaliser('Date')) : -1;
    if (cQ < 0 && cCom < 0 && cSec < 0) return;
    if (cfg.futurSeulement && cDate < 0) return;

    var data = sh.getRange(2, 1, n, nc).getValues();
    var modifie = false;
    data.forEach(function (row) {
      if (cfg.futurSeulement) {
        var dIso = typeof versIso === 'function' ? versIso(row[cDate], tz) : '';
        if (!dIso || dIso < aujourdhui) return;   // Ne jamais modifier les tournées passées historiques
      }
      var com = cCom >= 0 ? String(row[cCom] || '').trim() : '';
      var q = cQ >= 0 ? String(row[cQ] || '').trim() : '';
      var sec = cSec >= 0 ? String(row[cSec] || '').trim() : '';
      var lieu = cLieu >= 0 ? String(row[cLieu] || '').trim() : '';
      if (!com && !q && !sec) return;

      var resT = resoudreTerritoireEcriture_({ commune: com, quartier: q, secteur: sec, lieu: lieu }, refQ);
      if (!correspondCible({ commune: com, quartier: q, secteur: sec }, resT)) return;
      if (ancienNorm && cibles && cibles.length === 1 && (normaliser(q) === ancienNorm || normaliser(sec) === ancienNorm)) {
        resT = {
          territoire: cibles[0].territoire || resT.territoire,
          zone: cibles[0].zone || resT.zone,
          commune: cibles[0].commune || resT.commune,
          subdivision: cibles[0].subdivision || resT.subdivision,
          quartier: cibles[0].quartier || resT.quartier,
          secteur: cibles[0].secteur || resT.secteur
        };
      }
      if (!resT.commune && !resT.quartier && !resT.territoire && !resT.zone) return;

      var maj = false;
      var majChamp = function (idx, val) {
        if (idx >= 0 && val && String(row[idx] || '').trim() !== String(val).trim()) {
          row[idx] = val; maj = true;
        }
      };
      majChamp(cTer, resT.territoire);
      majChamp(cZ, resT.zone);
      majChamp(cCom, resT.commune);
      majChamp(cSub, resT.subdivision);
      majChamp(cQ, resT.quartier);
      majChamp(cSec, resT.secteur);
      if (maj) {
        modifie = true;
        bilan[cfg.key]++;
        bilan.total++;
      }
    });
    if (modifie) {
      sh.getRange(2, 1, n, nc).setValues(data);
      bilan.tablesModifiees.push(cfg.table);
    }
  });

  if (bilan.total > 0) {
    try { marquerModif(); } catch (eM) {}
  }
  return bilan;
}

// ---------------------------------------------------------------- Saisie sur ordinateur
// Praticiens : un nom saisi sur une nouvelle ligne reçoit un CodeContact (MED-xxx ou PHA-xxx).
// Presences / Pharmacies / Etablissements : Secteur, Quartier ou Commune complète Territoire / Zone / Subdivision / Quartier / Secteur.
// Quartiers : propage les modifications vers Presences, Pharmacies, Etablissements et Plannings à venir puis pousse vers Supabase.
function onEdit(e) {
  try { marquerModif(); } catch (eM) {}   // 3.27.25 : toute saisie dans le classeur invalide le cache de lecture
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet(), nom = sh.getName(), ss = e.source || SpreadsheetApp.getActive();
    var r0 = e.range.getRow(), nb = e.range.getNumRows(), rEnd = r0 + nb - 1;
    if (rEnd < 2) return;
    var rStart = Math.max(2, r0);
    var c0 = e.range.getColumn(), cEnd = c0 + e.range.getNumColumns() - 1;
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);

    if (nom === FEUILLES.praticiens) {
      var cCode = ent.indexOf(normaliser('CodeContact')) + 1, cNom = ent.indexOf(normaliser('Nom')) + 1;
      var cType = ent.indexOf(normaliser('Type')) + 1, cActif = ent.indexOf(normaliser('Actif')) + 1;
      var max = { MED: 0, PHA: 0 };
      sh.getRange(2, cCode, Math.max(sh.getLastRow() - 1, 1), 1).getValues().forEach(function (v) {
        var m = String(v[0]).match(/^(MED|PHA)-(\d+)$/);
        if (m && +m[2] > max[m[1]]) max[m[1]] = +m[2];
      });
      for (var r = rStart; r <= rEnd; r++) {
        if (sh.getRange(r, cNom).getValue() === '' || sh.getRange(r, cCode).getValue() !== '') continue;
        var pre = sh.getRange(r, cType).getValue() === 'Pharmacie' ? 'PHA' : 'MED';
        max[pre]++;
        sh.getRange(r, cCode).setValue(pre + '-' + numeroCode(max[pre]));
        if (cActif && sh.getRange(r, cActif).getValue() === '') sh.getRange(r, cActif).setValue('Oui');
      }
    } else if (nom === FEUILLES.presences || nom === FEUILLES.pharmacies || nom === FEUILLES.etablissements) {
      var cTer = ent.indexOf(normaliser('Territoire')) + 1, cZ = ent.indexOf(normaliser('Zone')) + 1;
      var cCom = ent.indexOf(normaliser('Commune')) + 1, cSub = ent.indexOf(normaliser('Subdivision')) + 1;
      var cQ = ent.indexOf(normaliser('Quartier')) + 1, cSec = ent.indexOf(normaliser('Secteur')) + 1;
      var lieuCol = nom === FEUILLES.presences ? 'Lieu/Etablissement' : 'Nom';
      var cLieu = ent.indexOf(normaliser(lieuCol)) + 1;

      var noms = {}, maxId = 0, cId = 0, cC = 0, cN = 0;
      if (nom === FEUILLES.presences) {
        cId = ent.indexOf(normaliser('IdPresence')) + 1;
        cC = ent.indexOf(normaliser('CodeContact')) + 1;
        cN = ent.indexOf(normaliser('Nom')) + 1;
        var shP = ss.getSheetByName(FEUILLES.praticiens);
        if (shP && shP.getLastRow() > 1 && shP.getLastColumn() >= 1) {
          var entP = shP.getRange(1, 1, 1, shP.getLastColumn()).getValues()[0].map(normaliser);
          var pCode = entP.indexOf(normaliser('CodeContact')), pNom = entP.indexOf(normaliser('Nom'));
          if (pCode >= 0 && pNom >= 0) {
            shP.getRange(2, 1, shP.getLastRow() - 1, shP.getLastColumn()).getValues().forEach(function (v) { noms[v[pCode]] = v[pNom]; });
          }
        }
        if (cId > 0) {
          sh.getRange(2, cId, Math.max(sh.getLastRow() - 1, 1), 1).getValues().forEach(function (v) { if (+v[0] > maxId) maxId = +v[0]; });
        }
      }

      var toucheGeo = (cSec > 0 && c0 <= cSec && cSec <= cEnd) ||
                      (cQ > 0 && c0 <= cQ && cQ <= cEnd) ||
                      (cCom > 0 && c0 <= cCom && cCom <= cEnd);
      var refQ = toucheGeo ? referentielQuartiers_(ss) : null;

      for (var r2 = rStart; r2 <= rEnd; r2++) {
        if (nom === FEUILLES.presences && cC > 0) {
          var code = sh.getRange(r2, cC).getValue();
          if (code !== '') {
            if (cN > 0 && noms[code] && sh.getRange(r2, cN).getValue() !== noms[code]) sh.getRange(r2, cN).setValue(noms[code]);
            if (cId > 0 && sh.getRange(r2, cId).getValue() === '') sh.getRange(r2, cId).setValue(++maxId);
          }
        }
        if (!toucheGeo) continue;
        var valCom = cCom > 0 ? String(sh.getRange(r2, cCom).getValue() || '').trim() : '';
        var valQ = cQ > 0 ? String(sh.getRange(r2, cQ).getValue() || '').trim() : '';
        var valSec = cSec > 0 ? String(sh.getRange(r2, cSec).getValue() || '').trim() : '';
        var valLieu = cLieu > 0 ? String(sh.getRange(r2, cLieu).getValue() || '').trim() : '';
        if (!valCom && !valQ && !valSec) continue;

        var resT = resoudreTerritoireEcriture_({ commune: valCom, quartier: valQ, secteur: valSec, lieu: valLieu }, refQ);
        var ecrireSi = function (col, val) {
          if (col > 0 && val && String(sh.getRange(r2, col).getValue() || '').trim() !== String(val).trim()) {
            sh.getRange(r2, col).setValue(val);
          }
        };
        ecrireSi(cTer, resT.territoire);
        ecrireSi(cZ, resT.zone);
        ecrireSi(cCom, resT.commune);
        ecrireSi(cSub, resT.subdivision);
        ecrireSi(cQ, resT.quartier);
        ecrireSi(cSec, resT.secteur);
      }
    } else if (nom === FEUILLES.quartiers) {
      var lignesEditees = [];
      for (var rq = rStart; rq <= rEnd; rq++) lignesEditees.push(rq);
      var opts = (nb === 1 && e.range.getNumColumns() === 1 && e.oldValue) ? { ancienLibelle: e.oldValue } : null;
      var bilan = propagerQuartiersSurFiches_(ss, lignesEditees, opts);
      var tables = ['quartiers'];
      (bilan.tablesModifiees || []).forEach(function (t) { if (tables.indexOf(t) < 0) tables.push(t); });
      try {
        if (typeof jumPousserApresEcriture_ === 'function') jumPousserApresEcriture_(tables);
      } catch (eJ) {}
    }
  } catch (err) {
    // Une erreur de saisie ne doit jamais bloquer le Sheet
  }
}

// ---------------------------------------------------------------- 3.25.26 : géolocalisation précise
// geocoderLieu, testerGeocodage5Pharmacies, completerGeolocPharmacies et les formules GEOCODE_GOOGLE / GET_LAT_LONG / PLACE
// sont dans le fichier Geolocalisation.gs (à coller à côté de Code.gs et Commun.gs).

// ---------------------------------------------------------------- 3.9.0 : sauvegarde quotidienne du classeur
// Chaque nuit (vers 2 h), une copie complète du classeur est rangée dans le dossier Drive « Sauvegardes MediPlanner ».
// Les 7 dernières copies sont gardées (les plus anciennes vont à la corbeille Drive, récupérables 30 jours).
// Reprise après incident : ouvrir la copie du jour voulu, puis copier la ou les feuilles nécessaires dans le classeur
// (clic droit sur l'onglet > Copier vers), ou faire de la copie le nouveau classeur (voir LISEZMOI).
var DOSSIER_SAUVEGARDES = 'Sauvegardes MediPlanner', NB_SAUVEGARDES = 7;
function dossierSauvegardes() {
  var it = DriveApp.getFoldersByName(DOSSIER_SAUVEGARDES);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DOSSIER_SAUVEGARDES);
}
function sauvegarderClasseur() {
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone(), dossier = dossierSauvegardes();
  var prefixe = ss.getName() + ' - sauvegarde ';
  DriveApp.getFileById(ss.getId()).makeCopy(prefixe + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'), dossier);
  var l = [], f = dossier.getFiles();
  while (f.hasNext()) { var x = f.next(); if (x.getName().indexOf(prefixe) === 0) l.push(x); }
  l.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  l.slice(NB_SAUVEGARDES).forEach(function (x) { x.setTrashed(true); });
  PropertiesService.getScriptProperties().setProperty('DERNIERE_SAUVEGARDE', new Date().toISOString());
  return l.length;
}
function installerSauvegardeQuotidienne() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sauvegarderClasseur') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sauvegarderClasseur').timeBased().everyDays(1).atHour(2).create();
  sauvegarderClasseur();
  try { SpreadsheetApp.getUi().alert('Sauvegarde quotidienne installée : une copie chaque nuit vers 2 h dans le dossier Drive « ' + DOSSIER_SAUVEGARDES + ' » (7 copies gardées). Une première copie vient d\'être faite.'); } catch (e) {}
}
function sauvegarderMaintenant() {
  sauvegarderClasseur();
  try { SpreadsheetApp.getUi().alert('Sauvegarde faite dans le dossier Drive « ' + DOSSIER_SAUVEGARDES + ' ».'); } catch (e) {}
}
function ouvrirDossierSauvegardes() {
  var url = dossierSauvegardes().getUrl();
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Dossier des sauvegardes : <a href="' + url + '" target="_blank">ouvrir dans Drive</a></p>').setWidth(360).setHeight(90), 'Sauvegardes');
}

function ouvrirBddSupabase() {
  var url = 'https://supabase.com/dashboard/project/nldyinokqgshnzvdsxgr/editor/18012?schema=public';
  var html = '<!DOCTYPE html><html><head><base target="_blank">' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 20px 10px; margin: 0; }' +
    'p { color: #333; font-size: 14px; margin-bottom: 16px; }' +
    '.btn { display: inline-block; background-color: #0B4F6C; color: white !important; padding: 10px 20px; font-weight: bold; border-radius: 6px; text-decoration: none; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }' +
    '</style>' +
    '</head><body>' +
    '<p>Ouverture de votre base Supabase dans un nouvel onglet...</p>' +
    '<a id="lienSupabase" class="btn" href="' + url + '">Ouvrir Supabase ↗</a>' +
    '<script>' +
    '  window.open("' + url + '", "_blank");' +
    '  setTimeout(function() { google.script.host.close(); }, 1200);' +
    '</script>' +
    '</body></html>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(400).setHeight(150), 'BDD Supabase');
}

