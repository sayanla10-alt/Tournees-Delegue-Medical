/* =============================================================================
   Code.gs : serveur de MediPlanner
   À coller dans Extensions > Apps Script du Google Sheet, avec Commun.gs.

   Feuilles
   - Praticiens  : une ligne par médecin / pharmacie (potentiel 3/2/1 = A/B/C, engagé)
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
  listes: 'Listes', plannings: 'Plannings', ancienneBase: 'BaseDonnees', pharmacies: 'Pharmacies',
  fiches: 'Fiches produits'
};
var VERSION_SERVEUR = '3.7.0';
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
    .addItem('Importer les pharmacies réelles (OpenStreetMap)', 'importerPharmacies')
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
  [FEUILLES.praticiens, FEUILLES.presences, FEUILLES.pharmacies, FEUILLES.plannings, FEUILLES.hist, FEUILLES.quartiers, FEUILLES.listes]
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
    if (p.action === 'data') return json(lireTout(p.sig || '', p.hdepuis || ''));
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
    if (body.action === 'fiche') return json(ficheUnique(body));
    return json({ ok: false, erreur: 'Action inconnue.' });
  } catch (err) {
    var m = String(err.message || err);
    return json({ ok: false, erreur: m, reessai: /occupé|timed out|Service|Lock|délai/i.test(m) });
  }
}

// Verrou d'écriture : si plusieurs délégués écrivent en même temps, l'appel attend jusqu'à 20 s,
// puis renvoie une erreur « réessayable » (l'application renvoie automatiquement)
function verrouiller() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Serveur occupé, nouvel essai automatique.');
  return lock;
}

// Une fiche renvoyée après une coupure réseau n'est pas créée deux fois (mémoire 6 h par identifiant)
function ficheUnique(body) {
  var cache = body.uid ? CacheService.getScriptCache() : null, cle = body.uid ? 'fiche_' + body.uid : '';
  var connu = cache ? cache.get(cle) : null;
  if (connu) return JSON.parse(connu);
  var r = enregistrerFiche(body);
  if (cache && r && r.ok) cache.put(cle, JSON.stringify(r), 21600);
  return r;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

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
  lirePharmacies(ss, tz).forEach(function (ph) {
    praticiens.push({ code: ph.code, type: 'Pharmacie', nom: ph.nom, specialite: 'Pharmacien', note: lireNote(ph.note),
      conventionne: ph.conventionne, telephone: ph.telephone, derniere: ph.derniere, statut: ph.statut, commentaire: ph.commentaire,
      nbVisites: +ph.nbVisites || 0, actif: ph.actif, prochaine: ph.prochaine, titulaire: ph.titulaire });
    var pr = { id: 'P-' + ph.code, code: ph.code, nom: ph.nom, lieu: ph.nom, quartier: ph.quartier, commune: ph.commune, zone: ph.zone,
      horaireMatin: ph.horaireMatin || HORAIRES_PHARMACIE[0], horaireSoir: ph.horaireSoir || HORAIRES_PHARMACIE[1], lat: ph.lat, lon: ph.lon };
    JOURS_CLES.forEach(function (j) { pr[j] = 'Matin et soir'; });
    presences.push(pr);
  });
  if (hdepuis) historique = historique.filter(function (v) { return String(v.horodatage) > hdepuis; });
  var listes = lireListes(ss, tz), statuts = lireStatuts(ss);
  var ref = { praticiens: praticiens, presences: presences, quartiers: quartiers, statuts: statuts, delegues: listes.delegues, feries: listes.feries };
  var empreinte = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(ref), Utilities.Charset.UTF_8));
  ref.activites = listes.activites; ref.produits = listes.produits; ref.activitesPharmacie = listes.activitesPharmacie;
  ref.fiches = lireObjets(ss.getSheetByName(FEUILLES.fiches), CHAMPS_FICHES, tz).filter(function (f) { return String(f.produit).trim() !== ''; });
  empreinte = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(ref), Utilities.Charset.UTF_8));
  var r = { ok: true, version: VERSION_DONNEES, sig: empreinte, historique: historique, partiel: !!hdepuis, alias: aliasDelegues(),
            plannings: lirePlannings(ss, tz, JOURS_PLANNINGS_DATA), serveur: new Date().toISOString() };
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
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DELEGUES_ALIAS') || '{}'); } catch (e) { return {}; }
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

function lirePharmacies(ss, tz) {
  return lireObjets(ss.getSheetByName(FEUILLES.pharmacies), CHAMPS_PHARMACIES, tz).filter(function (p) { return p.code !== '' && p.nom !== ''; });
}
function lireListes(ss, tz) {
  var sh = ss.getSheetByName(FEUILLES.listes), r = { delegues: [], feries: [], activites: [], activitesPharmacie: [], produits: [] };
  if (!sh || sh.getLastRow() < 2) return r;
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
      if (['derniere', 'date', 'prochaine', 'absentDu', 'absentAu'].indexOf(c[0]) >= 0) o[c[0]] = versIso(v, tz);
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
// 3.7.0 : feuille « Fiches produits » (aide-mémoire du délégué), créée une seule fois avec les fiches de référence,
// ensuite modifiable librement dans le classeur : l'application affiche ce qu'elle contient
function assurerFichesProduits(ss) {
  var sh = ss.getSheetByName(FEUILLES.fiches);
  if (sh) { completerEntetes(sh, CHAMPS_FICHES); return sh; }
  sh = ss.insertSheet(FEUILLES.fiches);
  var ent = CHAMPS_FICHES.map(function (c) { return c[1]; });
  sh.getRange(1, 1, 1, ent.length).setValues([ent]).setFontWeight('bold').setFontColor('#ffffff').setBackground(COULEUR_ENTETE);
  var lignes = FICHES_PRODUITS_DEFAUT.map(function (f) { return CHAMPS_FICHES.map(function (c) { return f[c[0]] || ''; }); });
  sh.getRange(2, 1, lignes.length, ent.length).setValues(lignes).setWrap(true).setVerticalAlignment('top');
  sh.setFrozenRows(1); sh.setFrozenColumns(3);
  [150, 150, 110, 200, 180, 280, 300, 230, 280, 220, 300, 160, 240].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 3, lignes.length, 1).setFontWeight('bold');
  return sh;
}

function assurerStructure(ss) {
  assurerFichesProduits(ss);
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

// ---------------------------------------------------------------- Visites validées
function enregistrerVisites(visites) {
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
    assurerStructure(ss);
    var shP = ss.getSheetByName(FEUILLES.praticiens), shH = ss.getSheetByName(FEUILLES.hist);
    var statuts = {};
    lireStatuts(ss).forEach(function (s) { statuts[s.nom] = s.visite; });

    // Visites déjà reçues (un renvoi après coupure réseau n'est pas dupliqué)
    var entH = shH.getRange(1, 1, 1, shH.getLastColumn()).getValues()[0].map(normaliser);
    var colUid = entH.indexOf(normaliser('IdSync')), colStatut = entH.indexOf(normaliser('Statut')), deja = {}, ancienStatut = {};
    if (colUid >= 0 && shH.getLastRow() > 1) {
      var nH = shH.getLastRow() - 1, uids = shH.getRange(2, colUid + 1, nH, 1).getValues();
      var sts = colStatut >= 0 ? shH.getRange(2, colStatut + 1, nH, 1).getValues() : [];
      uids.forEach(function (v, i) { if (v[0]) { deja[v[0]] = i + 2; ancienStatut[v[0]] = sts[i] ? sts[i][0] : ''; } });
    }
    var corrections = [];

    var suivis = [shP, ss.getSheetByName(FEUILLES.pharmacies)].filter(Boolean).map(function (sh) { return suiviFeuille(sh); });
    var nouvelles = [], recus = [];
    var ordreH = entH.map(function (e) {
      for (var k = 0; k < CHAMPS_HIST.length; k++) if (normaliser(CHAMPS_HIST[k][1]) === e) return CHAMPS_HIST[k][0];
      return null;
    });
    visites.forEach(function (v) {
      if (!v || !v.uid) return;
      v.delegue = nomDelegue(v.delegue);
      recus.push(v.uid);
      // compte rendu corrigé après enregistrement : la ligne existante est mise à jour
      var correction = !!(v.correction && deja[v.uid] && deja[v.uid] !== true);
      if (deja[v.uid] && !correction) return;
      var dateVisite = Utilities.parseDate(v.date, tz, 'yyyy-MM-dd');
      var ligne = ordreH.map(function (cle) {
        if (cle === 'date') return dateVisite;
        if (cle === 'prochaine') return v.prochaine ? Utilities.parseDate(v.prochaine, tz, 'yyyy-MM-dd') : '';
        if (cle === 'horodatage') return new Date();
        return cle && v[cle] !== undefined ? v[cle] : '';
      });
      var avant = correction ? !!statuts[ancienStatut[v.uid]] : false;
      if (correction) corrections.push({ ligne: deja[v.uid], valeurs: ligne }); else { nouvelles.push(ligne); deja[v.uid] = true; }
      suivis.forEach(function (f) {
        var i = f.ligneDe[String(v.code)], data = f.data, c = f.c;
        if (i === undefined) return;
        f.modif = true;
        if (statuts[v.statut]) {
          var actuelle = data[i][c.derniere];
          if (!(actuelle instanceof Date) || dateVisite > actuelle) data[i][c.derniere] = dateVisite;
          if (!avant) data[i][c.nbVisites] = (+data[i][c.nbVisites] || 0) + 1;
        } else if (avant) data[i][c.nbVisites] = Math.max((+data[i][c.nbVisites] || 0) - 1, 0);
        data[i][c.statut] = v.statut;
        data[i][c.commentaire] = v.commentaire || '';
        // seul un RDV confirmé devient la prochaine étape du praticien (un rappel reste dans l'historique)
        var prochaine = v.rdv === false ? '' : v.prochaine;
        if (c.prochaine >= 0) data[i][c.prochaine] = prochaine ? Utilities.parseDate(prochaine, tz, 'yyyy-MM-dd') : '';
      });
    });
    suivis.forEach(function (f) {
      if (!f.modif) return;
      ['derniere', 'statut', 'commentaire', 'nbVisites', 'prochaine'].forEach(function (k) {
        var c = f.c[k];
        if (c >= 0) f.sh.getRange(2, c + 1, f.n, 1).setValues(f.data.map(function (l) { return [l[c]]; }));
      });
    });
    if (nouvelles.length) shH.getRange(shH.getLastRow() + 1, 1, nouvelles.length, ordreH.length).setValues(nouvelles);
    corrections.forEach(function (x) { shH.getRange(x.ligne, 1, 1, ordreH.length).setValues([x.valeurs]); });
    marquerArretsValides(ss, visites);
    return { ok: true, recus: recus, ajoutes: nouvelles.length, corriges: corrections.length };
  } finally {
    lock.releaseLock();
  }
}

// Colonnes de suivi d'une feuille de praticiens ou de pharmacies (repérées par leur en-tête)
function suiviFeuille(sh) {
  var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  var c = {};
  [['code', 'CodeContact'], ['derniere', 'DateDerniereVisite'], ['statut', 'DernierStatut'], ['commentaire', 'DernierCommentaire'],
   ['nbVisites', 'NbVisites'], ['prochaine', 'ProchaineEtape']].forEach(function (x) { c[x[0]] = ent.indexOf(normaliser(x[1])); });
  var n = Math.max(sh.getLastRow() - 1, 0), data = n ? sh.getRange(2, 1, n, sh.getLastColumn()).getValues() : [], ligneDe = {};
  data.forEach(function (l, i) { ligneDe[String(l[c.code])] = i; });
  return { sh: sh, c: c, n: n, data: data, ligneDe: ligneDe, modif: false };
}

// ---------------------------------------------------------------- Tournées de l'équipe
// Remplace la tournée publiée d'un délégué sur la période [debut, fin] et signale
// les praticiens que d'autres délégués ont déjà prévus la même semaine.
function publierPlanning(b) {
  var delegue = nomDelegue(b.delegue);
  if (!delegue) return { ok: false, erreur: 'Indiquez votre nom dans les réglages de l\'application.' };
  var lock = verrouiller();
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
        if (c[0] === 'etat' && !a.etat) return 'Prévu';          // visite pas encore faite
        if (c[0] === 'statut' && !a.statut) return 'À faire';
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
      // un programme validé l'emporte sur une proposition ; à statut égal, le premier arrivé garde le praticien
      var monV = a.programme === 'Validé';
      var l = (autres[a.code + '|' + lundiDe(a.date)] || []).filter(function (o) {
        var sonV = o.programme === 'Validé';
        if (sonV !== monV) return sonV;
        return !o.depuis || o.depuis < a.depuis;
      });
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
  var lock = verrouiller();
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

// ---------------------------------------------------------------- Fiche praticien saisie dans l'application
// b.praticien : { code ('' ou 'TMP-…' pour une création), type, nom, specialite, note, conventionne, telephone, actif }
// b.presences : [{ id ('' ou 'TMP…' pour un nouveau lieu), lieu, quartier, lundi..vendredi, horaireMatin, horaireSoir, lat, lon }]
// Les lieux du praticien absents de la liste sont supprimés. Renvoie le code définitif et les identifiants des lieux.
function enregistrerFiche(b) {
  var p = b.praticien || {}, lieux = b.presences || [];
  var nom = String(p.nom || '').trim();
  if (nom.length < 3) return { ok: false, erreur: 'Nom du praticien manquant.' };
  var type = p.type === 'Pharmacie' ? 'Pharmacie' : 'Médecin';
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive();
    assurerStructure(ss);
    if (type === 'Pharmacie' && ss.getSheetByName(FEUILLES.pharmacies)) return enregistrerPharmacie(ss, p, lieux[0] || {});
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
    var tzF = ss.getSpreadsheetTimeZone();
    modif.absentDu = p.absentDu ? Utilities.parseDate(p.absentDu, tzF, 'yyyy-MM-dd') : '';
    modif.absentAu = p.absentAu ? Utilities.parseDate(p.absentAu, tzF, 'yyyy-MM-dd') : '';
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

// Pharmacie créée ou modifiée depuis l'application (feuille Pharmacies)
function enregistrerPharmacie(ss, p, lieu) {
  var sh = ss.getSheetByName(FEUILLES.pharmacies), tz = ss.getSpreadsheetTimeZone();
  var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  var pos = CHAMPS_PHARMACIES.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var n = Math.max(sh.getLastRow() - 1, 0), data = n ? sh.getRange(2, 1, n, ent.length).getValues() : [];
  var cCode = pos[indexChamp(CHAMPS_PHARMACIES, 'code')], code = String(p.code || ''), ligne = -1, max = 1000;
  data.forEach(function (l, i) {
    var m = String(l[cCode]).match(/^PHA-(\d+)$/); if (m && +m[1] > max) max = +m[1];
    if (code && String(l[cCode]) === code) ligne = i;
  });
  if (ligne < 0) code = 'PHA-' + (max + 1);
  var q = {};
  var shQ = ss.getSheetByName(FEUILLES.quartiers);
  if (shQ && shQ.getLastRow() > 1) shQ.getRange(2, 1, shQ.getLastRow() - 1, 3).getValues().forEach(function (v) { if (normaliser(v[1]) === normaliser(lieu.quartier)) q = { commune: v[0], zone: v[2] }; });
  var v = ligne >= 0 ? data[ligne].slice() : ent.map(function () { return ''; });
  var modif = { code: code, nom: String(p.nom || '').trim(), quartier: lieu.quartier || '', commune: q.commune || lieu.commune || '', zone: q.zone || lieu.zone || '',
    telephone: String(p.telephone || ''), note: lireNote(p.note), conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non',
    actif: normaliser(p.actif) === 'non' ? 'Non' : 'Oui', horaireMatin: lieu.horaireMatin || HORAIRES_PHARMACIE[0], horaireSoir: lieu.horaireSoir || HORAIRES_PHARMACIE[1] };
  if (lieu.lat && lieu.lon) { modif.lat = +lieu.lat; modif.lon = +lieu.lon; }
  if (ligne < 0) { modif.nbVisites = 0; modif.source = 'Application'; }
  CHAMPS_PHARMACIES.forEach(function (c, k) { if (pos[k] >= 0 && modif[c[0]] !== undefined) v[pos[k]] = modif[c[0]]; });
  if (ligne >= 0) sh.getRange(ligne + 2, 1, 1, ent.length).setValues([v]); else sh.getRange(sh.getLastRow() + 1, 1, 1, ent.length).setValues([v]);
  var ids = {}; if (lieu.id) ids[lieu.id] = 'P-' + code;
  return { ok: true, code: code, ancien: String(p.code || ''), ids: ids };
}

// ---------------------------------------------------------------- Pharmacies réelles (OpenStreetMap)
// Les données brutes (PHARMACIES_OSM : [nom, lat, lon, téléphone, quartier OSM, commune OSM]) sont dans le fichier
// DonneesPharmacies.gs. Le quartier, la commune et la zone manquants sont déduits du quartier de référence le plus proche.
// Les pharmacies fictives (PHA-001 à PHA-100) sont retirées des feuilles Praticiens et Presences.
function importerPharmacies() {
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  var Q = [];
  var shQ = ss.getSheetByName(FEUILLES.quartiers);
  shQ.getRange(2, 1, shQ.getLastRow() - 1, 5).getValues().forEach(function (v) { if (v[1] !== '') Q.push({ commune: v[0], quartier: v[1], zone: v[2], lat: +v[3], lon: +v[4] }); });
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
    Q.forEach(function (q) { var d = distanceKm({ lat: x[1], lon: x[2] }, q); if (d < bd) { bd = d; best = q; } });
    if (!best || bd > 12) return;                                  // hors du district d'Abidjan
    var com = x[5] && communes[normaliser(x[5])] ? communes[normaliser(x[5])] : best;
    var ex = anciennes[normaliser(nom) + '|' + x[1]] || {};
    lignes.push({ code: ex.code || 'PHA-' + (++k), nom: nom, titulaire: ex.titulaire || '', quartier: x[4] || best.quartier, commune: com.commune, zone: com.zone,
      lat: x[1], lon: x[2], telephone: x[3] || ex.telephone || '', horaireMatin: HORAIRES_PHARMACIE[0], horaireSoir: HORAIRES_PHARMACIE[1],
      note: ex.note || 2, conventionne: ex.conventionne || '', derniere: ex.derniere || '', statut: ex.statut || '', commentaire: ex.commentaire || '',
      nbVisites: ex.nbVisites || 0, actif: ex.actif || 'Oui', prochaine: ex.prochaine || '', source: 'OpenStreetMap' });
  });
  lignes.sort(function (a, b) { return a.commune.localeCompare(b.commune) || a.nom.localeCompare(b.nom); });
  var sh = preparerFeuille(ss, FEUILLES.pharmacies, CHAMPS_PHARMACIES.map(function (c) { return c[1]; }));
  if (lignes.length) {
    sh.getRange(2, colonne(CHAMPS_PHARMACIES, 'telephone'), lignes.length, 1).setNumberFormat('@');
    sh.getRange(2, colonne(CHAMPS_PHARMACIES, 'horaireMatin'), lignes.length, 2).setNumberFormat('@');
    sh.getRange(2, 1, lignes.length, CHAMPS_PHARMACIES.length).setValues(lignes.map(function (o) {
      return CHAMPS_PHARMACIES.map(function (c) {
        var val = o[c[0]];
        if ((c[0] === 'derniere' || c[0] === 'prochaine') && val) return Utilities.parseDate(val, tz, 'yyyy-MM-dd');
        return val === undefined ? '' : val;
      });
    }));
    sh.getRange(2, colonne(CHAMPS_PHARMACIES, 'note'), lignes.length, 1).setDataValidation(liste(['1', '2', '3']));
    sh.getRange(2, colonne(CHAMPS_PHARMACIES, 'derniere'), lignes.length, 1).setNumberFormat('dd/mm/yyyy');
    sh.setFrozenColumns(2);
    sh.autoResizeColumns(1, CHAMPS_PHARMACIES.length);
  }
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
