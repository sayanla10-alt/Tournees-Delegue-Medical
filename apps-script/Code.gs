/* =============================================================================
   Code.gs : serveur de l'application MediPlanner (v2.0.0, anciennement « Tournées »)
   À coller dans Extensions > Apps Script du Google Sheet, avec Commun.gs.

   Feuilles
   - Praticiens  : une ligne par médecin / pharmacie (potentiel 3/2/1 = A/B/C, conventionné)
   - Presences   : une ligne par lieu d'exercice, colonnes Lundi..Vendredi
                   (Matin / Soir / Matin et soir) et horaires propres au lieu
   - Quartiers, Listes, Historique, Plannings (tournées publiées par l'équipe)

   API (application Web, protégée par jeton)
   - GET  action=ping | data | equipe
   - POST action=valider (visites) | planning (publication d'une tournée)
          | fiche (création ou modification d'un praticien et de ses lieux depuis l'application)
   ============================================================================= */

var FEUILLES = {
  praticiens: 'Praticiens', presences: 'Presences', hist: 'Historique', quartiers: 'Quartiers',
  listes: 'Listes', plannings: 'Plannings', ancienneBase: 'BaseDonnees'
};
var VERSION_SERVEUR = '2.0.0';
var NB_HISTORIQUE_RENVOYE = 1500;      // visites renvoyées à l'application (statistiques sur un mois d'équipe)
var JOURS_PLANNINGS_DATA = 62;         // historique des tournées publiées (statistiques mensuelles)
var JOURS_PLANNINGS_EQUIPE = 14;       // rafraîchissement léger toutes les 2 minutes
var COULEUR_ENTETE = '#0B4F6C';

// ---------------------------------------------------------------- Menu
function onOpen() {
  SpreadsheetApp.getUi().createMenu('MediPlanner')
    .addItem('Initialiser le classeur (structure + base fictive)', 'initialiser')
    .addItem('Régénérer la base fictive', 'regenererBaseFictive')
    .addItem('Convertir l\'ancienne feuille BaseDonnees', 'convertirAncienneBase')
    .addItem('Compléter les données manquantes (base de test)', 'completerBaseTest')
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
  var base = genererBaseFictive(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'));
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

function ecrireQuartiers(ss) {
  var sh = preparerFeuille(ss, FEUILLES.quartiers, ['Commune', 'Quartier', 'Zone', 'Latitude', 'Longitude']);
  sh.getRange(2, 1, QUARTIERS_DEFAUT.length, 5).setValues(QUARTIERS_DEFAUT);
  sh.autoResizeColumns(1, 5);
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
  sh.getRange(2, colonne(CHAMPS_PRESENCES, 'quartier'), n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(ss.getSheetByName(FEUILLES.quartiers).getRange('B2:B500'), true)
      .setAllowInvalid(false).build());
  sh.getRange(2, colonne(CHAMPS_PRESENCES, 'code'), n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(ss.getSheetByName(FEUILLES.praticiens).getRange('A2:A3000'), true)
      .setAllowInvalid(false).build());
  sh.getRange(2, colonne(CHAMPS_PRESENCES, 'horaireMatin'), n, 2).setNumberFormat('@');
  var couleurs = [['Matin et soir', '#CDE8D6'], ['Matin', '#FDF1D6'], ['Soir', '#DDEBF0']];
  sh.setConditionalFormatRules(couleurs.map(function (c) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(c[0]).setBackground(c[1]).setRanges([jours]).build();
  }));
  sh.setFrozenColumns(3);
  sh.autoResizeColumns(1, CHAMPS_PRESENCES.length);
  for (var j = 0; j < 5; j++) sh.setColumnWidth(c1 + j, 105);
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
  [FEUILLES.praticiens, FEUILLES.presences, FEUILLES.plannings, FEUILLES.hist, FEUILLES.quartiers, FEUILLES.listes]
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
           'Complétez les colonnes Conventionné et les horaires si nécessaire, puis supprimez BaseDonnees.');
}

// ---------------------------------------------------------------- Jeton d'accès
function obtenirJeton() {
  var props = PropertiesService.getScriptProperties();
  var j = props.getProperty('JETON');
  if (!j) { j = Utilities.getUuid().replace(/-/g, '').slice(0, 20); props.setProperty('JETON', j); }
  return j;
}
function afficherJeton() {
  SpreadsheetApp.getUi().alert('Jeton d\'accès', obtenirJeton(), SpreadsheetApp.getUi().ButtonSet.OK);
}
function changerJeton() {
  PropertiesService.getScriptProperties().deleteProperty('JETON');
  SpreadsheetApp.getUi().alert('Nouveau jeton', obtenirJeton() +
    '\n\nRenvoyez le lien d\'installation à chaque délégué (Réglages > Partager l\'application).',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
function jetonValide(j) { return !!j && j === obtenirJeton(); }

// ---------------------------------------------------------------- API web
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (!jetonValide(p.token)) return json({ ok: false, erreur: 'Jeton d\'accès invalide.' });
    if (p.action === 'ping') return json({ ok: true, classeur: SpreadsheetApp.getActive().getName(), version: VERSION_DONNEES, serveur: VERSION_SERVEUR });
    if (p.action === 'data') return json(lireTout());
    if (p.action === 'equipe') return json(lireEquipe());
    return json({ ok: false, erreur: 'Action inconnue.' });
  } catch (err) {
    return json({ ok: false, erreur: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!jetonValide(body.token)) return json({ ok: false, erreur: 'Jeton d\'accès invalide.' });
    if (body.action === 'valider') return json(enregistrerVisites(body.visites || []));
    if (body.action === 'planning') return json(publierPlanning(body));
    if (body.action === 'fiche') return json(enregistrerFiche(body));
    return json({ ok: false, erreur: 'Action inconnue.' });
  } catch (err) {
    return json({ ok: false, erreur: String(err.message || err) });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- Lecture
function lireTout() {
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  assurerStructure(ss);
  var praticiens = lireObjets(ss.getSheetByName(FEUILLES.praticiens), CHAMPS_PRATICIENS, tz).filter(function (p) {
    return p.code !== '' && p.nom !== '';
  });
  praticiens.forEach(function (p) { p.nbVisites = +p.nbVisites || 0; p.note = lireNote(p.note); });
  var presences = lireObjets(ss.getSheetByName(FEUILLES.presences), CHAMPS_PRESENCES, tz).filter(function (p) {
    return p.code !== '';
  });
  presences.forEach(function (p, i) { if (p.id === '') p.id = 'L' + (i + 2); });

  var quartiers = [];
  var shQ = ss.getSheetByName(FEUILLES.quartiers);
  if (shQ && shQ.getLastRow() > 1) {
    shQ.getRange(2, 1, shQ.getLastRow() - 1, 5).getValues().forEach(function (v) {
      if (v[1] !== '') quartiers.push({ commune: v[0], quartier: v[1], zone: v[2], lat: +v[3], lon: +v[4] });
    });
  }
  var historique = [];
  var shH = ss.getSheetByName(FEUILLES.hist);
  if (shH && shH.getLastRow() > 1) {
    historique = lireObjets(shH, CHAMPS_HIST, tz, Math.max(2, shH.getLastRow() - NB_HISTORIQUE_RENVOYE + 1)).reverse();
  }
  return { ok: true, version: VERSION_DONNEES, praticiens: praticiens, presences: presences, quartiers: quartiers,
           statuts: lireStatuts(ss), historique: historique, plannings: lirePlannings(ss, tz, JOURS_PLANNINGS_DATA),
           serveur: new Date().toISOString() };
}

function lireEquipe() {
  var ss = SpreadsheetApp.getActive();
  assurerStructure(ss);
  return { ok: true, plannings: lirePlannings(ss, ss.getSpreadsheetTimeZone(), JOURS_PLANNINGS_EQUIPE),
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
  if (!sh || sh.getLastRow() < 2) return [];
  premiereLigne = premiereLigne || 2;
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
      if (c[0] === 'derniere' || c[0] === 'date') o[c[0]] = versIso(v, tz);
      else if (c[0] === 'horodatage') o[c[0]] = v instanceof Date ? v.toISOString() : String(v);
      else if (v instanceof Date) o[c[0]] = aff[i][j];
      else o[c[0]] = v;
    });
    return o;
  });
}

function versIso(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = String(v || '').match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

// ---------------------------------------------------------------- Structure (migration automatique)
function assurerStructure(ss) {
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
  if (!ss.getSheetByName(FEUILLES.presences)) preparerFeuille(ss, FEUILLES.presences, CHAMPS_PRESENCES.map(function (c) { return c[1]; }));
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

// ---------------------------------------------------------------- Visites validées
function enregistrerVisites(visites) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
    assurerStructure(ss);
    var shP = ss.getSheetByName(FEUILLES.praticiens), shH = ss.getSheetByName(FEUILLES.hist);
    var statuts = {};
    lireStatuts(ss).forEach(function (s) { statuts[s.nom] = s.visite; });

    // Visites déjà reçues (un renvoi après coupure réseau n'est pas dupliqué)
    var entH = shH.getRange(1, 1, 1, shH.getLastColumn()).getValues()[0].map(normaliser);
    var colUid = entH.indexOf(normaliser('IdSync')), deja = {};
    if (colUid >= 0 && shH.getLastRow() > 1) {
      shH.getRange(2, colUid + 1, shH.getLastRow() - 1, 1).getValues().forEach(function (v) { deja[v[0]] = true; });
    }

    var entP = shP.getRange(1, 1, 1, shP.getLastColumn()).getValues()[0].map(normaliser);
    function col(cle) { return entP.indexOf(normaliser(CHAMPS_PRATICIENS[indexChamp(CHAMPS_PRATICIENS, cle)][1])); }
    var cCode = col('code'), cDer = col('derniere'), cSt = col('statut'), cCom = col('commentaire'), cNb = col('nbVisites');
    var n = Math.max(shP.getLastRow() - 1, 0);
    var data = n ? shP.getRange(2, 1, n, shP.getLastColumn()).getValues() : [];
    var ligneDe = {};
    data.forEach(function (l, i) { ligneDe[String(l[cCode])] = i; });

    var nouvelles = [], recus = [];
    var ordreH = entH.map(function (e) {
      for (var k = 0; k < CHAMPS_HIST.length; k++) if (normaliser(CHAMPS_HIST[k][1]) === e) return CHAMPS_HIST[k][0];
      return null;
    });
    visites.forEach(function (v) {
      if (!v || !v.uid) return;
      recus.push(v.uid);
      if (deja[v.uid]) return;
      deja[v.uid] = true;
      var dateVisite = Utilities.parseDate(v.date, tz, 'yyyy-MM-dd');
      nouvelles.push(ordreH.map(function (cle) {
        if (cle === 'date') return dateVisite;
        if (cle === 'horodatage') return new Date();
        return cle && v[cle] !== undefined ? v[cle] : '';
      }));
      var i = ligneDe[String(v.code)];
      if (i === undefined) return;
      if (statuts[v.statut]) {
        var actuelle = data[i][cDer];
        if (!(actuelle instanceof Date) || dateVisite > actuelle) data[i][cDer] = dateVisite;
        data[i][cNb] = (+data[i][cNb] || 0) + 1;
      }
      data[i][cSt] = v.statut;
      data[i][cCom] = v.commentaire || '';
    });
    if (n) {
      [cDer, cSt, cCom, cNb].forEach(function (c) {
        if (c >= 0) shP.getRange(2, c + 1, n, 1).setValues(data.map(function (l) { return [l[c]]; }));
      });
    }
    if (nouvelles.length) shH.getRange(shH.getLastRow() + 1, 1, nouvelles.length, ordreH.length).setValues(nouvelles);
    marquerArretsValides(ss, visites);
    return { ok: true, recus: recus, ajoutes: nouvelles.length };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Tournées de l'équipe
// Remplace la tournée publiée d'un délégué sur la période [debut, fin] et signale
// les praticiens que d'autres délégués ont déjà prévus la même semaine.
function publierPlanning(b) {
  var delegue = String(b.delegue || '').trim();
  if (!delegue) return { ok: false, erreur: 'Indiquez votre nom dans les réglages de l\'application.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
    assurerStructure(ss);
    var sh = ss.getSheetByName(FEUILLES.plannings);
    var nbCol = CHAMPS_PLAN.length, n = Math.max(sh.getLastRow() - 1, 0);
    var limite = ajouterJours(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), -(JOURS_PLANNINGS_DATA + 8));
    var iDel = indexChamp(CHAMPS_PLAN, 'delegue'), iDate = indexChamp(CHAMPS_PLAN, 'date'), iCode = indexChamp(CHAMPS_PLAN, 'code');
    var iProg = indexChamp(CHAMPS_PLAN, 'programme'), iDepuis = indexChamp(CHAMPS_PLAN, 'depuis');
    var garde = [], moi = delegue.toLowerCase(), mesDepuis = {};
    if (n) {
      sh.getRange(2, 1, n, nbCol).getDisplayValues().forEach(function (l) {
        var d = versIso(l[iDate], tz), qui = String(l[iDel]).trim().toLowerCase();
        if (!qui || d < limite) return;
        if (qui === moi && d >= b.debut && d <= b.fin) {
          // on retient depuis quand ce délégué cible ce praticien (priorité au premier arrivé)
          var k = l[iCode] + '|' + lundiDe(d);
          if (l[iDepuis] && (!mesDepuis[k] || l[iDepuis] < mesDepuis[k])) mesDepuis[k] = l[iDepuis];
          return;
        }
        garde.push(l);
      });
    }
    var maintenant = new Date().toISOString();
    var maj = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
    var nouvelles = (b.arrets || []).map(function (a) {
      var depuis = mesDepuis[a.code + '|' + lundiDe(a.date)] || maintenant;
      a.depuis = depuis;
      return CHAMPS_PLAN.map(function (c) {
        if (c[0] === 'delegue') return delegue;
        if (c[0] === 'maj') return maj;
        if (c[0] === 'depuis') return depuis;
        var v = a[c[0]];
        return v === undefined || v === null ? '' : String(v);
      });
    });
    // Conflits : même praticien ciblé plus tôt par un autre délégué la même semaine
    var autres = {};
    garde.forEach(function (l) {
      if (String(l[iDel]).trim().toLowerCase() === moi) return;
      var k = l[iCode] + '|' + lundiDe(versIso(l[iDate], tz));
      (autres[k] = autres[k] || []).push({ delegue: l[iDel], date: versIso(l[iDate], tz), programme: l[iProg], depuis: l[iDepuis] || '' });
    });
    var conflits = [];
    (b.arrets || []).forEach(function (a) {
      var l = (autres[a.code + '|' + lundiDe(a.date)] || []).filter(function (o) { return !o.depuis || o.depuis < a.depuis; });
      if (l.length) conflits.push({ code: a.code, nom: a.nom, date: a.date, autres: l });
    });
    var tout = garde.concat(nouvelles);
    if (n) sh.getRange(2, 1, n, nbCol).clearContent();
    if (tout.length) sh.getRange(2, 1, tout.length, nbCol).setNumberFormat('@').setValues(tout);
    return { ok: true, publies: nouvelles.length, conflits: conflits };
  } finally {
    lock.releaseLock();
  }
}

function marquerArretsValides(ss, visites) {
  var sh = ss.getSheetByName(FEUILLES.plannings);
  var n = sh ? sh.getLastRow() - 1 : 0;
  if (n < 1) return;
  var nbCol = CHAMPS_PLAN.length;
  var cSt = indexChamp(CHAMPS_PLAN, 'statut'), cEt = indexChamp(CHAMPS_PLAN, 'etat'), cUid = indexChamp(CHAMPS_PLAN, 'uid');
  var data = sh.getRange(2, 1, n, nbCol).getDisplayValues(), parUid = {}, change = false;
  visites.forEach(function (v) { if (v && v.uid) parUid[v.uid] = v; });
  data.forEach(function (l) {
    var v = parUid[l[cUid]];
    if (v) { l[cSt] = v.statut; l[cEt] = 'valide'; change = true; }
  });
  if (change) sh.getRange(2, 1, n, nbCol).setNumberFormat('@').setValues(data);
}

// ---------------------------------------------------------------- Données manquantes de la base de TEST
// Comble les trous sans rien effacer ni renuméroter (voir completerDonneesFictives dans Commun.gs) :
// téléphones fictifs (+225 00 …), dernier statut / commentaire / nombre de visites des praticiens déjà visités,
// coordonnées GPS des établissements, et colonnes manquantes des tournées publiées par une ancienne version.
// À NE PAS utiliser sur une vraie base (les téléphones et commentaires seraient inventés).
function completerBaseTest() {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
    var r = { praticiens: completerFeuille(ss, FEUILLES.praticiens, CHAMPS_PRATICIENS, ['telephone', 'statut', 'commentaire', 'nbVisites'], tz),
              plannings: completerPlannings(ss) };
    var quartiers = [];
    var shQ = ss.getSheetByName(FEUILLES.quartiers);
    shQ.getRange(2, 1, shQ.getLastRow() - 1, 5).getValues().forEach(function (v) { quartiers.push({ commune: v[0], quartier: v[1], zone: v[2], lat: +v[3], lon: +v[4] }); });
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
  var notes = {};
  lireObjets(ss.getSheetByName(FEUILLES.praticiens), CHAMPS_PRATICIENS, tz).forEach(function (p) { notes[p.code] = lireNote(p.note); });
  var parCode = {};
  lireObjets(ss.getSheetByName(FEUILLES.presences), CHAMPS_PRESENCES, tz).forEach(function (p) { (parCode[p.code] = parCode[p.code] || []).push(p); });
  var data = sh.getRange(2, 1, n, CHAMPS_PLAN.length).getDisplayValues(), modif = 0;
  function i(k) { return indexChamp(CHAMPS_PLAN, k); }
  data.forEach(function (l) {
    if (!l[i('delegue')] || l[i('idPresence')]) return;
    var j = jourSemaineIndex(versIso(l[i('date')], tz)), cren = l[i('creneau')] || 'Matin';
    if (j > 4) return;
    var pres = (parCode[l[i('code')]] || []).filter(function (p) { var d = lireDispo(p[JOURS_CLES[j]]); return cren === 'Soir' ? d.soir : d.matin; })[0];
    if (pres) {
      var h = lireHoraire(cren === 'Soir' ? pres.horaireSoir : pres.horaireMatin, cren === 'Soir' ? REGLAGES_MOTEUR.horaireSoirDefaut : REGLAGES_MOTEUR.horaireMatinDefaut);
      l[i('idPresence')] = String(pres.id); l[i('debut')] = minutesVersHeure(h[0]); l[i('fin')] = minutesVersHeure(h[1]);
      if (!l[i('lieu')]) l[i('lieu')] = pres.lieu;
    }
    if (!l[i('note')]) l[i('note')] = String(notes[l[i('code')]] || 2);
    if (!l[i('programme')]) l[i('programme')] = 'Proposition';
    modif++;
  });
  if (modif) sh.getRange(2, 1, n, CHAMPS_PLAN.length).setNumberFormat('@').setValues(data);
  return modif;
}

// ---------------------------------------------------------------- Fiche praticien saisie dans l'application
// b.praticien : { code ('' ou 'TMP-…' pour une création), type, nom, specialite, note, conventionne, telephone, actif }
// b.presences : [{ id ('' ou 'TMP…' pour un nouveau lieu), lieu, quartier, lundi..vendredi, horaireMatin, horaireSoir, lat, lon }]
// Les lieux du praticien absents de la liste sont supprimés. Renvoie le code définitif et les identifiants des lieux.
function enregistrerFiche(b) {
  var p = b.praticien || {}, lieux = b.presences || [];
  var nom = String(p.nom || '').trim();
  if (nom.length < 3) return { ok: false, erreur: 'Nom du praticien manquant.' };
  var type = p.type === 'Pharmacie' ? 'Pharmacie' : 'Médecin';
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var ss = SpreadsheetApp.getActive();
    assurerStructure(ss);
    var shP = ss.getSheetByName(FEUILLES.praticiens), shR = ss.getSheetByName(FEUILLES.presences);

    // --- Praticiens : mise à jour de la ligne existante ou ajout avec un nouveau code
    var entP = shP.getRange(1, 1, 1, shP.getLastColumn()).getValues()[0].map(normaliser);
    var posP = CHAMPS_PRATICIENS.map(function (c) { return entP.indexOf(normaliser(c[1])); });
    var cCode = posP[indexChamp(CHAMPS_PRATICIENS, 'code')];
    var nP = Math.max(shP.getLastRow() - 1, 0);
    var dataP = nP ? shP.getRange(2, 1, nP, entP.length).getValues() : [];
    var code = String(p.code || ''), ligne = -1, max = { MED: 0, PHA: 0 };
    dataP.forEach(function (l, i) {
      var c = String(l[cCode]), m = c.match(/^(MED|PHA)-(\d+)$/);
      if (m && +m[2] > max[m[1]]) max[m[1]] = +m[2];
      if (code && c === code) ligne = i;
    });
    if (ligne < 0) {
      var pre = type === 'Pharmacie' ? 'PHA' : 'MED';
      code = pre + '-' + ('00' + (max[pre] + 1)).slice(-3);
    }
    var valeurs = ligne >= 0 ? dataP[ligne].slice() : entP.map(function () { return ''; });
    var modif = { code: code, type: type, nom: nom, specialite: String(p.specialite || ''), note: lireNote(p.note),
                  conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non', telephone: String(p.telephone || ''),
                  actif: normaliser(p.actif) === 'non' ? 'Non' : 'Oui' };
    if (ligne < 0) modif.nbVisites = 0;
    CHAMPS_PRATICIENS.forEach(function (c, k) { if (posP[k] >= 0 && modif[c[0]] !== undefined) valeurs[posP[k]] = modif[c[0]]; });
    if (ligne >= 0) shP.getRange(ligne + 2, 1, 1, entP.length).setValues([valeurs]);
    else shP.getRange(shP.getLastRow() + 1, 1, 1, entP.length).setValues([valeurs]);

    // --- Presences : lieux du praticien remplacés (mêmes lignes réutilisées, identifiants conservés)
    var refQ = {};
    var shQ = ss.getSheetByName(FEUILLES.quartiers);
    if (shQ && shQ.getLastRow() > 1) {
      shQ.getRange(2, 1, shQ.getLastRow() - 1, 3).getValues().forEach(function (v) { refQ[normaliser(v[1])] = v; });
    }
    var entR = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0].map(normaliser);
    var posR = CHAMPS_PRESENCES.map(function (c) { return entR.indexOf(normaliser(c[1])); });
    var rCode = posR[indexChamp(CHAMPS_PRESENCES, 'code')], rId = posR[indexChamp(CHAMPS_PRESENCES, 'id')];
    var nR = Math.max(shR.getLastRow() - 1, 0);
    var dataR = nR ? shR.getRange(2, 1, nR, entR.length).getValues() : [];
    var mesLignes = [], maxId = 0, anciensCode = String(p.code || '');
    dataR.forEach(function (l, i) {
      if (+l[rId] > maxId) maxId = +l[rId];
      if (anciensCode && String(l[rCode]) === anciensCode) mesLignes.push(i);
    });
    var ids = {};
    var lignesR = lieux.map(function (x) {
      var id = x.id && !/^TMP/.test(String(x.id)) ? x.id : ++maxId;
      if (x.id) ids[x.id] = id;
      var q = refQ[normaliser(x.quartier)] || ['', '', ''];
      var o = { id: id, code: code, nom: nom, lieu: String(x.lieu || ''), quartier: String(x.quartier || ''),
                commune: q[0] || String(x.commune || ''), zone: q[2] || String(x.zone || ''),
                horaireMatin: String(x.horaireMatin || ''), horaireSoir: String(x.horaireSoir || ''),
                lat: x.lat === undefined ? '' : x.lat, lon: x.lon === undefined ? '' : x.lon };
      JOURS_CLES.forEach(function (j) { o[j] = String(x[j] || ''); });
      var v = entR.map(function () { return ''; });
      CHAMPS_PRESENCES.forEach(function (c, k) { if (posR[k] >= 0) v[posR[k]] = o[c[0]] === undefined ? '' : o[c[0]]; });
      return v;
    });
    var k = 0;
    for (; k < Math.min(mesLignes.length, lignesR.length); k++) {
      shR.getRange(mesLignes[k] + 2, 1, 1, entR.length).setValues([lignesR[k]]);
    }
    if (k < lignesR.length) {
      shR.getRange(shR.getLastRow() + 1, 1, lignesR.length - k, entR.length).setValues(lignesR.slice(k));
    }
    for (var s = mesLignes.length - 1; s >= k; s--) shR.deleteRow(mesLignes[s] + 2);
    return { ok: true, code: code, ancien: String(p.code || ''), ids: ids };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Saisie sur ordinateur
// Praticiens : un nom saisi sur une nouvelle ligne reçoit un CodeContact (MED-xxx ou PHA-xxx).
// Presences  : le quartier complète Commune et Zone ; le CodeContact complète le Nom ; IdPresence auto.
function onEdit(e) {
  try {
    var sh = e.range.getSheet(), nom = sh.getName();
    if (e.range.getRow() < 2) return;
    var r0 = e.range.getRow(), nb = e.range.getNumRows();
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
    if (nom === FEUILLES.praticiens) {
      var cCode = ent.indexOf(normaliser('CodeContact')) + 1, cNom = ent.indexOf(normaliser('Nom')) + 1;
      var cType = ent.indexOf(normaliser('Type')) + 1, cActif = ent.indexOf(normaliser('Actif')) + 1;
      var max = { MED: 0, PHA: 0 };
      sh.getRange(2, cCode, Math.max(sh.getLastRow() - 1, 1), 1).getValues().forEach(function (v) {
        var m = String(v[0]).match(/^(MED|PHA)-(\d+)$/);
        if (m && +m[2] > max[m[1]]) max[m[1]] = +m[2];
      });
      for (var r = r0; r < r0 + nb; r++) {
        if (sh.getRange(r, cNom).getValue() === '' || sh.getRange(r, cCode).getValue() !== '') continue;
        var pre = sh.getRange(r, cType).getValue() === 'Pharmacie' ? 'PHA' : 'MED';
        max[pre]++;
        sh.getRange(r, cCode).setValue(pre + '-' + ('00' + max[pre]).slice(-3));
        if (cActif && sh.getRange(r, cActif).getValue() === '') sh.getRange(r, cActif).setValue('Oui');
      }
    } else if (nom === FEUILLES.presences) {
      var cId = ent.indexOf(normaliser('IdPresence')) + 1, cC = ent.indexOf(normaliser('CodeContact')) + 1;
      var cN = ent.indexOf(normaliser('Nom')) + 1, cQ = ent.indexOf(normaliser('Quartier')) + 1;
      var cCom = ent.indexOf(normaliser('Commune')) + 1, cZ = ent.indexOf(normaliser('Zone')) + 1;
      var ss = e.source, shQ = ss.getSheetByName(FEUILLES.quartiers), shP = ss.getSheetByName(FEUILLES.praticiens);
      var refQ = {};
      shQ.getRange(2, 1, Math.max(shQ.getLastRow() - 1, 1), 3).getValues().forEach(function (v) { refQ[normaliser(v[1])] = v; });
      var noms = {};
      shP.getRange(2, 1, Math.max(shP.getLastRow() - 1, 1), 3).getValues().forEach(function (v) { noms[v[0]] = v[2]; });
      var maxId = 0;
      sh.getRange(2, cId, Math.max(sh.getLastRow() - 1, 1), 1).getValues().forEach(function (v) { if (+v[0] > maxId) maxId = +v[0]; });
      for (var r2 = r0; r2 < r0 + nb; r2++) {
        var code = sh.getRange(r2, cC).getValue();
        if (code === '') continue;
        if (noms[code] && sh.getRange(r2, cN).getValue() !== noms[code]) sh.getRange(r2, cN).setValue(noms[code]);
        var q = refQ[normaliser(sh.getRange(r2, cQ).getValue())];
        if (q) { sh.getRange(r2, cCom).setValue(q[0]); sh.getRange(r2, cZ).setValue(q[2]); }
        if (sh.getRange(r2, cId).getValue() === '') sh.getRange(r2, cId).setValue(++maxId);
      }
    }
  } catch (err) {
    // Une erreur de saisie ne doit jamais bloquer le Sheet
  }
}
