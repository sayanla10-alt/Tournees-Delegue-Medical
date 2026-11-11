/* Ecriture.gs : enregistrements venant de l'application (visites, comptes rendus, tournées, fiches, délégués). (découpé de Code.gs, 3.27.14 ; tous les fichiers .gs partagent le même espace) */

// Borne un texte à la limite Google Sheets (50 000 caractères max, marge à 45 000)
function borneTexte_(val, max) {
  var s = String(val === undefined || val === null ? '' : val);
  var lim = max || 45000;
  return s.length > lim ? s.slice(0, lim) : s;
}

// Neutralise les injections de formules Google Sheets / CSV (=, +, -, @, \t, \r),
// y compris après espaces initiaux, sans altérer les nombres purs (ex. "-3.98").
function neutraliserFormule_(val) {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return val;
  if (!val) return '';
  if (/^\s*-?\d+(?:[.,]\d+)?\s*$/.test(val)) return val;
  if (/^[\t\r]|^\s*[=+\-@]/.test(val)) return "'" + val;
  return val;
}

function texteCellule_(val, max) {
  return neutraliserFormule_(borneTexte_(val, max));
}

// Formate un numéro CI (+225 ...) et neutralise toute valeur non téléphonique suspecte
function preparerTelephone_(tel) {
  var f = formaterTelephoneCI(tel || '');
  if (!f) return '';
  if (/^\+\d{2,3}(?:[\s\-\/]?\d{2,}){2,}(?:\s*\/\s*\+\d{2,3}(?:[\s\-\/]?\d{2,}){2,})*$/.test(f)) return borneTexte_(f, 500);
  return texteCellule_(f, 500);
}

// Valide strictement une date ISO YYYY-MM-DD (calendrier réel)
function estDateIso_(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var p = s.split('-'), a = +p[0], m = +p[1], j = +p[2];
  var d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

function enregistrerRapport(r) {
  r = r || {};
  var delegue = nomDelegue(r.delegue);
  if (!delegue || !estDateIso_(r.date)) return { ok: false, erreur: 'Rapport incomplet ou date invalide (délégué ou date).' };
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone(), sh = assurerRapports(ss);
    r.delegue = delegue; r.maj = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
    var ligne = CHAMPS_RAPPORTS.map(function (c) {
      var v = r[c[0]];
      if (v === undefined || v === null) return '';
      if (c[0] === 'date' || c[0] === 'maj') return String(v);
      return texteCellule_(v);
    });
    var iDel = indexChamp(CHAMPS_RAPPORTS, 'delegue'), iDate = indexChamp(CHAMPS_RAPPORTS, 'date'), n = sh.getLastRow() - 1, rang = -1;
    if (n > 0) sh.getRange(2, 1, n, CHAMPS_RAPPORTS.length).getDisplayValues().forEach(function (l, i) {
      if (String(l[iDel]).trim().toLowerCase() === delegue.toLowerCase() && versIso(l[iDate], tz) === r.date) rang = i + 2;
    });
    if (rang > 0) sh.getRange(rang, 1, 1, ligne.length).setValues([ligne]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, ligne.length).setValues([ligne]);
    enregistrerAudit(ss, delegue, rang > 0 ? 'MODIFICATION_RAPPORT' : 'VALIDATION_RAPPORT', 'Rapport du jour', r.date, '');
    return { ok: true, date: r.date };
  } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- Visites validées
function enregistrerVisites(visites) {
  if (!Array.isArray(visites)) return { ok: false, erreur: 'Liste de visites invalide.' };
  visites.forEach(fusRediriger_);   // 3.28.16 : référence d'une fiche fusionnée -> fiche gardée
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
      if (!estDateIso_(v.date)) return;
      v.delegue = nomDelegue(v.delegue);
      recus.push(v.uid);
      // compte rendu corrigé après enregistrement : la ligne existante est mise à jour
      var correction = !!(v.correction && deja[v.uid] && deja[v.uid] !== true);
      if (deja[v.uid] && !correction) return;
      var dateVisite = Utilities.parseDate(v.date, tz, 'yyyy-MM-dd');
      var ligne = ordreH.map(function (cle) {
        if (cle === 'date') return dateVisite;
        if (cle === 'prochaine') return estDateIso_(v.prochaine) ? Utilities.parseDate(v.prochaine, tz, 'yyyy-MM-dd') : '';
        if (cle === 'horodatage') return new Date();
        if (!cle || v[cle] === undefined || v[cle] === null) return '';
        if (cle === 'note' && isFinite(+v.note) && String(v.note).trim() !== '') return +v.note;
        return texteCellule_(v[cle]);
      });
      var avant = correction ? !!statuts[ancienStatut[v.uid]] : false;
      if (correction) {
        corrections.push({ ligne: deja[v.uid], valeurs: ligne });
        enregistrerAudit(ss, v.delegue, 'CORRECTION_VISITE', v.type || 'Visite', v.code || v.uid, (v.nom || '') + ' (' + v.date + ') - Statut: ' + (v.statut || ''));
      } else {
        nouvelles.push(ligne);
        deja[v.uid] = true;
        enregistrerAudit(ss, v.delegue, 'VALIDATION_VISITE', v.type || 'Visite', v.code || v.uid, (v.nom || '') + ' (' + v.date + ') - Statut: ' + (v.statut || ''));
      }
      suivis.forEach(function (f) {
        var i = f.ligneDe[String(v.code)], data = f.data, c = f.c;
        if (i === undefined) return;
        f.modif = true;
        if (statuts[v.statut]) {
          if (c.derniere >= 0) {
            var actuelle = data[i][c.derniere];
            if (!(actuelle instanceof Date) || dateVisite > actuelle) data[i][c.derniere] = dateVisite;
          }
          if (!avant && c.nbVisites >= 0) data[i][c.nbVisites] = (+data[i][c.nbVisites] || 0) + 1;
        } else if (avant && c.nbVisites >= 0) data[i][c.nbVisites] = Math.max((+data[i][c.nbVisites] || 0) - 1, 0);
        if (c.statut >= 0) data[i][c.statut] = texteCellule_(v.statut || '');
        if (c.commentaire >= 0) data[i][c.commentaire] = texteCellule_(v.commentaire || '');
        // seul un RDV confirmé devient la prochaine étape du praticien (un rappel reste dans l'historique)
        var prochaine = v.rdv === false ? '' : v.prochaine;
        if (c.prochaine >= 0) data[i][c.prochaine] = estDateIso_(prochaine) ? Utilities.parseDate(prochaine, tz, 'yyyy-MM-dd') : '';
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
  b = b || {};
  var delegue = nomDelegue(b.delegue);
  if (!delegue) return { ok: false, erreur: 'Indiquez votre nom dans les réglages de l\'application.' };
  if (!estDateIso_(b.debut) || !estDateIso_(b.fin) || b.debut > b.fin || !Array.isArray(b.arrets)) {
    return { ok: false, erreur: 'Période invalide.' };
  }
  var arretsValides = b.arrets.filter(function (a) { return a && estDateIso_(a.date); });
  arretsValides.forEach(fusRediriger_);
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
    assurerStructure(ss);
    var sh = ss.getSheetByName(FEUILLES.plannings);
    var nbCol = CHAMPS_PLAN.length, n = Math.max(sh.getLastRow() - 1, 0);
    var iDel = indexChamp(CHAMPS_PLAN, 'delegue'), iDate = indexChamp(CHAMPS_PLAN, 'date'), iCode = indexChamp(CHAMPS_PLAN, 'code');
    var iProg = indexChamp(CHAMPS_PLAN, 'programme'), iDepuis = indexChamp(CHAMPS_PLAN, 'depuis');
    var garde = [], moi = delegue.toLowerCase(), mesDepuis = {};
    if (n) {
      sh.getRange(2, 1, n, nbCol).getDisplayValues().forEach(function (l) {
        var d = versIso(l[iDate], tz), qui = String(l[iDel]).trim().toLowerCase();
        if (!qui) return;
        // Conserve l'historique complet de toute l'équipe ; seule la période [debut, fin] du délégué courant est remplacée
        if (qui === moi && d && d >= b.debut && d <= b.fin) {
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
    var nouvelles = arretsValides.map(function (a) {
      var depuis = mesDepuis[a.code + '|' + lundiDe(a.date)] || maintenant;
      a.depuis = depuis;
      return CHAMPS_PLAN.map(function (c) {
        if (c[0] === 'delegue') return texteCellule_(delegue);
        if (c[0] === 'maj') return maj;
        if (c[0] === 'depuis') return depuis;
        if (c[0] === 'etat' && !a.etat) return 'Prévu';          // visite pas encore faite
        if (c[0] === 'statut' && !a.statut) return 'À faire';
        var v = a[c[0]];
        if (v === undefined || v === null) return '';
        // Ne jamais altérer CODE_JOUR_SUPPRIME ('-') ni la date/note
        if (c[0] === 'code' || c[0] === 'date' || c[0] === 'note' || c[0] === 'idPresence') return String(v);
        return texteCellule_(v);
      });
    });
    // Conflits : même praticien ciblé plus tôt par un autre délégué la même semaine
    var autres = {};
    garde.forEach(function (l) {
      if (String(l[iDel]).trim().toLowerCase() === moi) return;
      if (l[iProg] === 'Supprimé') return;   // 3.29.0 : journée ou visite supprimée par un collègue : pas un conflit
      var d = versIso(l[iDate], tz);
      if (!d) return;
      var k = l[iCode] + '|' + lundiDe(d);
      (autres[k] = autres[k] || []).push({ delegue: l[iDel], date: d, programme: l[iProg], depuis: l[iDepuis] || '' });
    });
    var conflits = [];
    arretsValides.forEach(function (a) {
      if (a.programme === 'Supprimé') return;
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
    // Écriture non destructive : écrit d'abord le planning complet, puis efface uniquement les lignes excédentaires
    if (tout.length) sh.getRange(2, 1, tout.length, nbCol).setNumberFormat('@').setValues(tout);
    if (n > tout.length) sh.getRange(2 + tout.length, 1, n - tout.length, nbCol).clearContent();
    var nbJours = {}; arretsValides.forEach(function (a) { if (a.programme !== 'Supprimé') nbJours[a.date] = 1; });
    enregistrerAudit(ss, delegue, 'PUBLICATION_TOURNEE', 'Planning', b.debut + ' > ' + b.fin, nouvelles.length + ' visite(s) sur ' + Object.keys(nbJours).length + ' jour(s)' + (b.supprimes && b.supprimes.length ? ', jour(s) supprimé(s) : ' + b.supprimes.join(', ') : ''));
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
    if (v) { l[cSt] = texteCellule_(v.statut || ''); l[cEt] = 'valide'; change = true; }
  });
  if (change) sh.getRange(2, 1, n, nbCol).setNumberFormat('@').setValues(data);
}

// ---------------------------------------------------------------- Fiche praticien saisie dans l'application
// b.praticien : { code ('' ou 'TMP-…' pour une création), type, nom, specialite, note, conventionne, telephone, actif }
// b.presences : [{ id ('' ou 'TMP…' pour un nouveau lieu), lieu, quartier, lundi..vendredi, horaireMatin, horaireSoir, lat, lon }]
// Les lieux du praticien absents de la liste sont supprimés. Renvoie le code définitif et les identifiants des lieux.
// ---------------------------------------------------------------- Traçabilité (Audit Trail)
// 3.29.0 : pendant un appel de l'application, les lignes d'audit sont regroupées et écrites en une fois à la fin (doPost)
var AUDIT_TAMPON_ = null;
function enregistrerAudit(ss, auteur, action, entite, code, details) {
  var detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
  var ligne = [
    new Date().toISOString(),
    texteCellule_(auteur || 'Inconnu', 200),
    texteCellule_(action || '', 200),
    texteCellule_(entite || '', 200),
    texteCellule_(code || '', 200),
    texteCellule_(detailsStr, 2000)
  ];
  if (AUDIT_TAMPON_) { AUDIT_TAMPON_.push(ligne); return; }
  ecrireAudit_(ss, [ligne]);
}
function ecrireAudit_(ss, lignes) {
  if (!lignes || !lignes.length) return;
  try {
    var nomF = (typeof FEUILLES !== 'undefined' && FEUILLES.audit) ? FEUILLES.audit : 'Audit_Logs';
    var sh = ss.getSheetByName(nomF);
    if (!sh) {
      sh = ss.insertSheet(nomF);
      sh.getRange(1, 1, 1, 6).setValues([['Horodatage', 'Auteur', 'Action', 'Entite', 'Code', 'Details']]).setFontWeight('bold');
      sh.setFrozenRows(1); sh.hideSheet();
    }
    sh.getRange(sh.getLastRow() + 1, 1, lignes.length, 6).setNumberFormat('@').setValues(lignes);
  } catch (e) {
    console.warn('Erreur enregistrement audit: ' + e);
  }
}
function viderAudit_() {
  var l = AUDIT_TAMPON_; AUDIT_TAMPON_ = null;
  if (!l || !l.length) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { console.warn('Audit non écrit (serveur occupé) : ' + l.length + ' ligne(s)'); return; }
  try { ecrireAudit_(SpreadsheetApp.getActive(), l); } finally { lock.releaseLock(); }
}
// 3.29.0 : erreurs survenues sur les téléphones (version, écran, message), notées dans le journal d'audit (Action = ERREUR_APP)
function enregistrerErreursApp(b) {
  var auteur = nomDelegue(b.delegue) || String(b.delegue || 'Inconnu');
  (b.erreurs || []).slice(0, 20).forEach(function (x) {
    if (!x || !x.message) return;
    enregistrerAudit(SpreadsheetApp.getActive(), auteur, 'ERREUR_APP', String(x.ecran || 'Application').slice(0, 60), String(x.version || ''),
      { message: String(x.message).slice(0, 500), lieu: String(x.lieu || '').slice(0, 300), contexte: x.contexte || '', le: x.le || '', appareil: String(b.appareil || '').slice(0, 120) });
  });
  return { ok: true };
}

function enregistrerFiche(b, dejaVerrouille) {
  b = b || {};
  var p = b.praticien || {}, lieux = fusRedirigerFiche_(b.praticien || {}, Array.isArray(b.presences) ? b.presences : []);
  var auteur = String(b.auteur || p.auteur || 'Délégué');
  var nom = String(p.nom || '').trim();
  if (nom.length < 3) return { ok: false, erreur: 'Nom du praticien manquant.' };
  var type = p.type === 'Pharmacie' ? 'Pharmacie' : 'Médecin';
  var lock = dejaVerrouille ? null : verrouiller();
  try {
    var ss = SpreadsheetApp.getActive();
    assurerStructure(ss);
    if (type === 'Pharmacie' && ss.getSheetByName(FEUILLES.pharmacies)) return enregistrerPharmacie(ss, p, lieux[0] || {}, auteur);
    var shP = ss.getSheetByName(FEUILLES.praticiens), shR = ss.getSheetByName(FEUILLES.presences);

    // --- Praticiens : mise à jour de la ligne existante ou ajout avec un nouveau code
    var entP = shP.getRange(1, 1, 1, shP.getLastColumn()).getValues()[0].map(normaliser);
    var posP = CHAMPS_PRATICIENS.map(function (c) { return entP.indexOf(normaliser(c[1])); });
    var cCode = posP[indexChamp(CHAMPS_PRATICIENS, 'code')], cNom = posP[indexChamp(CHAMPS_PRATICIENS, 'nom')];
    var nP = Math.max(shP.getLastRow() - 1, 0);
    var dataP = nP ? shP.getRange(2, 1, nP, entP.length).getValues() : [];
    var code = String(p.code || ''), ligne = -1, max = { MED: 0, PHA: 0 }, nomNorm = normaliser(nom);
    dataP.forEach(function (l, i) {
      var c = String(l[cCode]), m = c.match(/^(MED|PHA)-(\d+)$/);
      if (m && +m[2] > max[m[1]]) max[m[1]] = +m[2];
      if (code && c === code) ligne = i;
      else if (ligne < 0 && (!code || /^TMP-/.test(code)) && cNom >= 0 && normaliser(l[cNom]) === nomNorm) { ligne = i; code = c; }
    });
    // 3.27.28 : fiche nouvelle rattachée par son nom à une fiche existante : on complète, on n'efface rien
    var rattache = ligne >= 0 && (!p.code || /^TMP-/.test(String(p.code)));
    if (ligne < 0) {
      var pre = type === 'Pharmacie' ? 'PHA' : 'MED';
      code = pre + '-' + numeroCode(max[pre] + 1);
    }
    var valeurs = ligne >= 0 ? dataP[ligne].slice() : entP.map(function () { return ''; });
    var modif = {
      code: code,
      type: type,
      nom: texteCellule_(nom),
      specialite: texteCellule_(specialiteCanonique(String(p.specialite || ''))),
      note: lireNote(p.note),
      conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non',
      telephone: preparerTelephone_(p.telephone || ''),
      actif: normaliser(p.actif) === 'non' ? 'Non' : 'Oui'
    };
    var tzF = ss.getSpreadsheetTimeZone();
    modif.absentDu = estDateIso_(p.absentDu) ? Utilities.parseDate(p.absentDu, tzF, 'yyyy-MM-dd') : '';
    modif.absentAu = estDateIso_(p.absentAu) ? Utilities.parseDate(p.absentAu, tzF, 'yyyy-MM-dd') : '';
    if (ligne < 0) modif.nbVisites = 0;
    CHAMPS_PRATICIENS.forEach(function (c, k) { if (posP[k] >= 0 && modif[c[0]] !== undefined && !(rattache && (modif[c[0]] === '' || c[0] === 'note' || c[0] === 'conventionne') && valeurs[posP[k]] !== '')) valeurs[posP[k]] = modif[c[0]]; });
    var rangP = ligne >= 0 ? ligne + 2 : shP.getLastRow() + 1;
    var cTelP = posP[indexChamp(CHAMPS_PRATICIENS, 'telephone')];
    if (cTelP >= 0) shP.getRange(rangP, cTelP + 1).setNumberFormat('@');
    shP.getRange(rangP, 1, 1, entP.length).setValues([valeurs]);

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
      var nId = +l[rId];
      if (!isFinite(nId)) {
        var mId = String(l[rId] || '').match(/(\d+)$/);
        nId = mId ? +mId[1] : NaN;
      }
      if (isFinite(nId) && nId > maxId) maxId = nId;
      if ((anciensCode && String(l[rCode]) === anciensCode) || (code && String(l[rCode]) === code)) mesLignes.push(i);
    });
    if (rattache) {
      // lieux déjà connus conservés ; même établissement : jours cumulés sur la ligne existante
      var fusionDispo = function (a, b) { var t = String(a || '') + ' ' + String(b || ''), m = /matin/i.test(t), so = /soir/i.test(t); return m && so ? 'Matin et soir' : (m ? 'Matin' : (so ? 'Soir' : '')); };
      var exist = mesLignes.map(function (i) { var l = dataR[i], o = {}; CHAMPS_PRESENCES.forEach(function (c, k) { if (posR[k] >= 0) o[c[0]] = l[posR[k]]; }); return o; });
      lieux = lieux.slice();
      lieux.forEach(function (x) {
        var e = exist.filter(function (o) { return !o._pris && normaliser(o.lieu) === normaliser(x.lieu); })[0];
        if (!e) return;
        e._pris = true; x.id = e.id;
        JOURS_CLES.forEach(function (j) { x[j] = fusionDispo(e[j], x[j]); });
        ['quartier', 'reperes', 'lat', 'lon', 'origineGps', 'horaireMatin', 'horaireSoir'].forEach(function (k) { if ((x[k] === undefined || x[k] === '') && e[k] !== '') x[k] = e[k]; });
      });
      exist.forEach(function (o) { if (!o._pris) lieux.push(o); });
    }
    var ids = {}, coords = {};
    // 3.26.50 : une correction écrase la ligne existante du lieu (même identifiant) ; une nouvelle ligne seulement pour un nouveau lieu.
    // Identifiants dédoublonnés : un même IdPresence ne peut plus être donné à deux lieux.
    var ligneParId = {}, idsPris = {};
    mesLignes.forEach(function (i) { var idL = String(dataR[i][rId]); if (idL && ligneParId[idL] === undefined) ligneParId[idL] = i; });
    var lignesId = [];
    var lignesR = lieux.map(function (x) {
      var idBrut = x.id === undefined || x.id === null ? '' : String(x.id).trim();
      var id = idBrut && !/^TMP/i.test(idBrut) && !idsPris[idBrut] ? x.id : ++maxId;
      while (idsPris[String(id)]) id = ++maxId;
      idsPris[String(id)] = true;
      lignesId.push(String(id));
      if (idBrut && /^TMP/i.test(idBrut)) ids[idBrut] = id;
      var q = refQ[normaliser(x.quartier)] || ['', '', ''];
      var o = {
        id: id,
        code: code,
        nom: texteCellule_(nom),
        lieu: texteCellule_(x.lieu || ''),
        quartier: texteCellule_(x.quartier || ''),
        commune: texteCellule_(q[0] || x.commune || ''),
        zone: texteCellule_(q[2] || x.zone || ''),
        horaireMatin: texteCellule_(x.horaireMatin || ''),
        horaireSoir: texteCellule_(x.horaireSoir || ''),
        lat: x.lat === undefined ? '' : x.lat,
        lon: x.lon === undefined ? '' : x.lon,
        reperes: texteCellule_(x.reperes || ''),
        origineGps: texteCellule_(x.origineGps || '')
      };
      // 3.9.0 : pas de position prise sur place ? on cherche l'établissement sur Google Maps (Abidjan)
      var latTest = nombre6(o.lat), lonTest = nombre6(o.lon);
      if (!isFinite(latTest) || !isFinite(lonTest) || latTest === 0 || lonTest === 0) {
        var g = geocoderLieu(String(x.lieu || ''), String(x.quartier || ''), String(q[0] || x.commune || ''));
        if (g && isFinite(nombre6(g.lat)) && isFinite(nombre6(g.lon))) {
          o.lat = g.lat; o.lon = g.lon; o.origineGps = 'Google Maps'; coords[id] = g;
        }
      }
      // 3.27.33 : positions à 6 décimales ; origine conservée si la position n'a pas bougé (valide lat & lon avec isFinite)
      var lat6 = nombre6(o.lat), lon6 = nombre6(o.lon);
      if (isFinite(lat6) && isFinite(lon6)) { o.lat = lat6; o.lon = lon6; }
      else { o.lat = ''; o.lon = ''; }
      var iEx = ligneParId[String(id)], kO = posR[indexChamp(CHAMPS_PRESENCES, 'origineGps')];
      if (!o.origineGps && iEx !== undefined && kO >= 0 && o.lat !== '' && o.lon !== '' &&
          Math.abs(nombre6(dataR[iEx][posR[indexChamp(CHAMPS_PRESENCES, 'lat')]]) - o.lat) < 0.00001 &&
          Math.abs(nombre6(dataR[iEx][posR[indexChamp(CHAMPS_PRESENCES, 'lon')]]) - o.lon) < 0.00001) {
        o.origineGps = texteCellule_(dataR[iEx][kO] || '');
      }
      JOURS_CLES.forEach(function (j) { o[j] = texteCellule_(x[j] || ''); });
      var v = entR.map(function () { return ''; });
      CHAMPS_PRESENCES.forEach(function (c, k) { if (posR[k] >= 0) v[posR[k]] = o[c[0]] === undefined ? '' : o[c[0]]; });
      return v;
    });
    // 1) lieux déjà en base : réécrits sur leur propre ligne ; 2) lieux nouveaux : sur les lignes libérées, sinon ajoutés ;
    // 3) lignes restantes du praticien (lieux supprimés ou doublons) : effacées
    var utilisees = {}, nouveaux = [];
    lignesR.forEach(function (v, n) {
      var i = ligneParId[lignesId[n]];
      if (i !== undefined && !utilisees[i]) { utilisees[i] = true; shR.getRange(i + 2, 1, 1, entR.length).setValues([v]); }
      else nouveaux.push(v);
    });
    var libres = mesLignes.filter(function (i) { return !utilisees[i]; });
    while (nouveaux.length && libres.length) { var li = libres.shift(); utilisees[li] = true; shR.getRange(li + 2, 1, 1, entR.length).setValues([nouveaux.shift()]); }
    if (nouveaux.length) shR.getRange(shR.getLastRow() + 1, 1, nouveaux.length, entR.length).setValues(nouveaux);
    // L'application cliente envoie la liste complète des lieux du praticien dans b.presences lors d'une modification :
    // les lieux absents sont retirés, sauf si b.presences est vide (évite une suppression accidentelle)
    // ou si b.supprimerPresences === false. Pour supprimer tous les lieux, passer b.supprimerPresences === true.
    var autoriserSuppression = b.supprimerPresences === true ||
      (b.supprimerPresences !== false && Array.isArray(b.presences) && b.presences.length > 0);
    if (libres.length && autoriserSuppression) {
      libres.sort(function (a, b) { return b - a; }).forEach(function (i) {
        var ancLieu = dataR[i] ? dataR[i][posR[indexChamp(CHAMPS_PRESENCES, 'lieu')]] : 'Lieu';
        enregistrerAudit(ss, auteur, 'SUPPRESSION_PRESENCE', 'Presence', code, 'Suppression lieu: ' + ancLieu);
        shR.deleteRow(i + 2);
      });
    }
    enregistrerAudit(ss, auteur, ligne >= 0 ? (rattache ? 'RATTACHEMENT_FICHE' : 'MODIFICATION_FICHE') : 'CREATION_FICHE', type, code, nom + ' (' + lieux.length + ' lieu(x))');
    return { ok: true, code: code, ancien: String(p.code || ''), ids: ids, coords: coords };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// 3.27.33 : nombre (virgule ou point) arrondi à 6 décimales ; NaN si vide
function nombre6(x) { var n = parseFloat(String(x === undefined || x === null ? '' : x).replace(',', '.')); return isFinite(n) ? Math.round(n * 1e6) / 1e6 : NaN; }

// Pharmacie créée ou modifiée depuis l'application (feuille Pharmacies)
function enregistrerPharmacie(ss, p, lieu, auteur) {
  var sh = ss.getSheetByName(FEUILLES.pharmacies), tz = ss.getSpreadsheetTimeZone();
  var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  var pos = CHAMPS_PHARMACIES.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var n = Math.max(sh.getLastRow() - 1, 0), data = n ? sh.getRange(2, 1, n, ent.length).getValues() : [];
  var cCode = pos[indexChamp(CHAMPS_PHARMACIES, 'code')], cNom = pos[indexChamp(CHAMPS_PHARMACIES, 'nom')], cQuart = pos[indexChamp(CHAMPS_PHARMACIES, 'quartier')];
  var code = String(p.code || ''), ligne = -1, max = 1000, nomNorm = normaliser(p.nom), quartNorm = normaliser(lieu.quartier);
  data.forEach(function (l, i) {
    var m = String(l[cCode]).match(/^PHA-(\d+)$/); if (m && +m[1] > max) max = +m[1];
    if (code && String(l[cCode]) === code) ligne = i;
    else if (ligne < 0 && (!code || /^TMP-/.test(code)) && cNom >= 0 && normaliser(l[cNom]) === nomNorm && (!quartNorm || cQuart < 0 || !l[cQuart] || normaliser(l[cQuart]) === quartNorm)) {
      ligne = i; code = String(l[cCode]);
    }
  });
  if (ligne < 0) code = 'PHA-' + (max + 1);
  var q = {};
  var shQ = ss.getSheetByName(FEUILLES.quartiers);
  if (shQ && shQ.getLastRow() > 1) shQ.getRange(2, 1, shQ.getLastRow() - 1, 3).getValues().forEach(function (v) { if (normaliser(v[1]) === normaliser(lieu.quartier)) q = { commune: v[0], zone: v[2] }; });
  var v = ligne >= 0 ? data[ligne].slice() : ent.map(function () { return ''; });
  var kQuart = pos[indexChamp(CHAMPS_PHARMACIES, 'quartier')];
  var kCom = pos[indexChamp(CHAMPS_PHARMACIES, 'commune')];
  var kHM = pos[indexChamp(CHAMPS_PHARMACIES, 'horaireMatin')];
  var kHS = pos[indexChamp(CHAMPS_PHARMACIES, 'horaireSoir')];
  var kTel = pos[indexChamp(CHAMPS_PHARMACIES, 'telephone')];
  var kLaP = pos[indexChamp(CHAMPS_PHARMACIES, 'lat')], kLoP = pos[indexChamp(CHAMPS_PHARMACIES, 'lon')];

  var quartIn = String(lieu.quartier || '').trim();
  var comIn = String(q.commune || lieu.commune || '').trim();
  var zoneIn = String(q.zone || lieu.zone || '').trim();
  var hmIn = String(lieu.horaireMatin || '').trim();
  var hsIn = String(lieu.horaireSoir || '').trim();

  var modif = {
    code: code,
    nom: texteCellule_(String(p.nom || '').trim()),
    telephone: preparerTelephone_(p.telephone || ''),
    note: lireNote(p.note),
    conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non',
    actif: normaliser(p.actif) === 'non' ? 'Non' : 'Oui'
  };
  if (quartIn) modif.quartier = texteCellule_(quartIn);
  else if (ligne < 0) modif.quartier = '';
  if (comIn) modif.commune = texteCellule_(comIn);
  else if (ligne < 0) modif.commune = '';
  if (zoneIn) modif.zone = texteCellule_(zoneIn);
  else if (ligne < 0) modif.zone = '';
  if (hmIn) modif.horaireMatin = texteCellule_(hmIn);
  else if (ligne < 0 || kHM < 0 || !String(v[kHM] || '').trim()) modif.horaireMatin = HORAIRES_PHARMACIE[0];
  if (hsIn) modif.horaireSoir = texteCellule_(hsIn);
  else if (ligne < 0 || kHS < 0 || !String(v[kHS] || '').trim()) modif.horaireSoir = HORAIRES_PHARMACIE[1];

  var latIn = lieu.lat !== 'NL' ? nombre6(lieu.lat) : NaN;
  var lonIn = lieu.lon !== 'NL' ? nombre6(lieu.lon) : NaN;
  var latEx = kLaP >= 0 ? nombre6(v[kLaP]) : NaN;
  var lonEx = kLoP >= 0 ? nombre6(v[kLoP]) : NaN;
  var gpsExValide = isFinite(latEx) && isFinite(lonEx) && latEx !== 0 && lonEx !== 0;

  if (isFinite(latIn) && isFinite(lonIn) && latIn !== 0 && lonIn !== 0) {
    modif.lat = latIn; modif.lon = lonIn;
    // 3.27.33 : relevé terrain transmis tel quel ; position inchangée = origine conservée ; sinon origine effacée
    var bouge = !(gpsExValide && Math.abs(latEx - modif.lat) < 0.00001 && Math.abs(lonEx - modif.lon) < 0.00001);
    if (lieu.origineGps) modif.origineGps = texteCellule_(String(lieu.origineGps)); else if (bouge) modif.origineGps = '';
  }
  else if (!gpsExValide) {
    var comGeo = comIn || (kCom >= 0 ? String(v[kCom] || '') : '');
    var g = geocoderLieu(p.nom, quartIn || (kQuart >= 0 ? String(v[kQuart] || '') : ''), comGeo, p.telephone, p.titulaire);
    if (g && isFinite(nombre6(g.lat)) && isFinite(nombre6(g.lon))) {
      modif.lat = nombre6(g.lat); modif.lon = nombre6(g.lon); modif.origineGps = 'Google Maps';
      var quartActuel = modif.quartier !== undefined ? modif.quartier : (kQuart >= 0 ? String(v[kQuart] || '') : '');
      if ((!quartActuel || quartActuel === 'NL') && g.quartier) modif.quartier = texteCellule_(g.quartier);
    }
  }
  if (ligne < 0) { modif.nbVisites = 0; modif.source = 'Application'; }
  CHAMPS_PHARMACIES.forEach(function (c, k) { if (pos[k] >= 0 && modif[c[0]] !== undefined) v[pos[k]] = modif[c[0]]; });
  var rangPh = ligne >= 0 ? ligne + 2 : sh.getLastRow() + 1;
  if (kTel >= 0) sh.getRange(rangPh, kTel + 1).setNumberFormat('@');
  sh.getRange(rangPh, 1, 1, ent.length).setValues([v]);
  var ids = {}; if (lieu.id) ids[lieu.id] = 'P-' + code;
  enregistrerAudit(ss, auteur, ligne >= 0 ? 'MODIFICATION_FICHE' : 'CREATION_FICHE', 'Pharmacie', code, modif.nom);
  return { ok: true, code: code, ancien: String(p.code || ''), ids: ids };
}

// Établissement (hôpital, clinique, FSU COM, dispensaire...) créé ou modifié depuis l'application
function enregistrerEtablissement(b) {
  b = b || {};
  var R = fusRedirections_();
  if (b.code) b.code = fusSuivre_(R.codes, b.code);
  var nom = fusNomLieu_(R, String(b.nom || '').trim(), b.commune);
  if (nom.length < 2) return { ok: false, erreur: 'Nom de l\'établissement manquant.' };
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive();
    assurerStructure(ss);
    var sh = ss.getSheetByName(FEUILLES.etablissements);
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
    var pos = CHAMPS_ETABLISSEMENTS.map(function (c) { return ent.indexOf(normaliser(c[1])); });
    var n = Math.max(sh.getLastRow() - 1, 0), data = n ? sh.getRange(2, 1, n, ent.length).getValues() : [];
    var cCode = pos[indexChamp(CHAMPS_ETABLISSEMENTS, 'code')], cNom = pos[indexChamp(CHAMPS_ETABLISSEMENTS, 'nom')];
    var code = String(b.code || ''), ligne = -1, max = 0, nomNorm = normaliser(nom);
    data.forEach(function (l, i) {
      var c = String(l[cCode]);
      var m = c.match(/^ETAB-(\d+)$/i);
      if (m && +m[1] > max) max = +m[1];
      if (code && c === code) ligne = i;
      else if (ligne < 0 && (!code || /^TMP-/i.test(code)) && cNom >= 0 && normaliser(l[cNom]) === nomNorm) {
        ligne = i; code = c;
      }
    });
    if (ligne < 0 && (!code || /^TMP-/i.test(code))) {
      code = 'ETAB-' + numeroCode(max + 1);
    }
    var v = ligne >= 0 ? data[ligne].slice() : ent.map(function () { return ''; });
    var modif = {
      code: code,
      nom: texteCellule_(nom),
      categorie: texteCellule_(b.categorie || ''),
      commune: texteCellule_(b.commune || ''),
      quartier: texteCellule_(b.quartier || ''),
      zone: texteCellule_(b.zone || ''),
      telephone: preparerTelephone_(b.telephone || ''),
      reperes: texteCellule_(b.reperes || '')
    };
    if (b.lat !== undefined && b.lon !== undefined && b.lat !== '' && b.lon !== '') {
      var latE = nombre6(b.lat), lonE = nombre6(b.lon);
      if (isFinite(latE) && isFinite(lonE)) {
        modif.lat = latE;
        modif.lon = lonE;
      }
    }
    CHAMPS_ETABLISSEMENTS.forEach(function (c, k) { if (pos[k] >= 0 && modif[c[0]] !== undefined) v[pos[k]] = modif[c[0]]; });
    var rangE = ligne >= 0 ? ligne + 2 : sh.getLastRow() + 1;
    var cTelE = pos[indexChamp(CHAMPS_ETABLISSEMENTS, 'telephone')];
    if (cTelE >= 0) sh.getRange(rangE, cTelE + 1).setNumberFormat('@');
    sh.getRange(rangE, 1, 1, ent.length).setValues([v]);

    // Cascade GPS et quartier vers la feuille Presences si lat/lon modifiés
    var cascades = 0;
    if (isFinite(modif.lat) && isFinite(modif.lon) && modif.lat) {
      var shR = ss.getSheetByName(FEUILLES.presences);
      if (shR && shR.getLastRow() > 1) {
        var entR = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0].map(normaliser);
        var cLieu = entR.indexOf(normaliser('Lieu/Etablissement'));
        var cLatR = entR.indexOf(normaliser('Latitude'));
        var cLonR = entR.indexOf(normaliser('Longitude'));
        var cQuartR = entR.indexOf(normaliser('Quartier'));
        var cComR = entR.indexOf(normaliser('Commune'));
        if (cLieu >= 0 && cLatR >= 0 && cLonR >= 0) {
          var nR = shR.getLastRow() - 1;
          var valR = shR.getRange(2, 1, nR, entR.length).getValues();
          var modifR = false;
          valR.forEach(function (row) {
            if (normaliser(row[cLieu]) === nomNorm) {
              row[cLatR] = modif.lat;
              row[cLonR] = modif.lon;
              if (modif.quartier && cQuartR >= 0 && (!row[cQuartR] || normaliser(row[cQuartR]) === 'nl')) row[cQuartR] = modif.quartier;
              if (modif.commune && cComR >= 0 && (!row[cComR] || normaliser(row[cComR]) === 'nl')) row[cComR] = modif.commune;
              cascades++;
              modifR = true;
            }
          });
          if (modifR) shR.getRange(2, 1, nR, entR.length).setValues(valR);
        }
      }
    }

    enregistrerAudit(ss, String(b.auteur || 'Délégué'), ligne >= 0 ? 'MODIFICATION_ETABLISSEMENT' : 'CREATION_ETABLISSEMENT', 'Etablissement', code,
      nom + (isFinite(modif.lat) && isFinite(modif.lon) && modif.lat ? ' (GPS ' + modif.lat + ', ' + modif.lon + ', ' + cascades + ' lieu(x) mis à jour)' : ''));
    return { ok: true, code: code, nom: nom, lat: modif.lat, lon: modif.lon, cascades: cascades };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ---------------------------------------------------------------- 3.9.0 : délégué ajouté depuis l'application
// Un prénom absent de la liste est ajouté à la colonne « Délégués » de la feuille Listes (sans doublon).
function ajouterDelegue(nom) {
  nom = String(nom || '').trim().replace(/\s+/g, ' ');
  if (nom.length < 2 || nom.length > 60 || /@/.test(nom)) return { ok: false, erreur: 'Nom invalide.' };
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive(); assurerStructure(ss);
    var sh = ss.getSheetByName(FEUILLES.listes); if (!sh) return { ok: false, erreur: 'Feuille Listes absente.' };
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser), c = ent.indexOf(normaliser('Délégués'));
    if (c < 0) return { ok: false, erreur: 'Colonne Délégués absente.' };
    var n = Math.max(sh.getLastRow() - 1, 0), v = n ? sh.getRange(2, c + 1, n, 1).getValues().map(function (l) { return String(l[0]).trim(); }) : [];
    if (v.some(function (x) { return x.toLowerCase() === nom.toLowerCase(); })) return { ok: true, ajoute: false };
    var libre = v.indexOf(''); var ligne = libre >= 0 ? libre + 2 : v.length + 2;
    sh.getRange(ligne, c + 1).setValue(texteCellule_(nom, 60));
    enregistrerAudit(ss, nom, 'AJOUT_DELEGUE', 'Délégué', '', nom);
    return { ok: true, ajoute: true };
  } finally {
    lock.releaseLock();
  }
}

