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

// Ajoute Territoire, Subdivision, Secteur si absents de CHAMPS_* (compatibilité avant/après mise à jour Commun.gs)
function champsEcrAvecTerritoire_(baseChamps) {
  var res = baseChamps.slice(), vus = {};
  res.forEach(function (c) { vus[normaliser(c[1])] = true; });
  [['territoire', 'Territoire'], ['subdivision', 'Subdivision'], ['secteur', 'Secteur']].forEach(function (x) {
    if (!vus[normaliser(x[1])]) { res.push(x); vus[normaliser(x[1])] = true; }
  });
  return res;
}

// Déduit Territoire et Zone d'une commune quand une ligne n'est pas trouvée dans Quartiers
function territoireEtZoneDeCommune_(commune) {
  var c = String(commune || '').trim();
  if (!c) return { territoire: '', zone: '', commune: '' };
  var comPar = typeof communeParente === 'function' ? communeParente(c) : c;
  var k = normaliser(comPar);
  var zonesAbj = {
    abobo: 'Zone Nord', anyama: 'Zone Nord',
    cocody: 'Zone Est', bingerville: 'Zone Est', brofodoume: 'Zone Est',
    yopougon: 'Zone Ouest', songon: 'Zone Ouest',
    plateau: 'Zone Centre', adjame: 'Zone Centre', attecoube: 'Zone Centre',
    treichville: 'Zone Sud', marcory: 'Zone Sud', koumassi: 'Zone Sud', portbouet: 'Zone Sud'
  };
  var nomsAbj = {
    abobo: 'Abobo', anyama: 'Anyama', cocody: 'Cocody', bingerville: 'Bingerville', brofodoume: 'Brofodoumé',
    yopougon: 'Yopougon', songon: 'Songon', plateau: 'Plateau', adjame: 'Adjamé',
    attecoube: 'Attécoubé', treichville: 'Treichville', marcory: 'Marcory',
    koumassi: 'Koumassi', portbouet: 'Port-Bouët'
  };
  if (zonesAbj[k]) return { territoire: 'Abidjan', zone: zonesAbj[k], commune: nomsAbj[k] || comPar };
  if (typeof estCommuneGrandAbidjan === 'function' && estCommuneGrandAbidjan(comPar)) {
    return { territoire: 'Abidjan', zone: '', commune: comPar };
  }
  if (typeof estCommuneInterieur === 'function' && estCommuneInterieur(comPar)) {
    return { territoire: 'Intérieur', zone: 'Intérieur', commune: comPar };
  }
  return { territoire: '', zone: '', commune: comPar };
}

// Lit toutes les lignes de la feuille Quartiers par noms d'en-têtes (tolérant 5, 6 ou 9 colonnes)
function referentielQuartiers_(ss) {
  ss = ss || SpreadsheetApp.getActive();
  var out = [];
  var shQ = ss ? ss.getSheetByName(FEUILLES.quartiers) : null;
  if (shQ && shQ.getLastRow() > 1 && shQ.getLastColumn() >= 1) {
    var nc = shQ.getLastColumn();
    var ent = shQ.getRange(1, 1, 1, nc).getValues()[0].map(normaliser);
    var col = function (noms) {
      for (var i = 0; i < noms.length; i++) {
        var k = ent.indexOf(normaliser(noms[i]));
        if (k >= 0) return k;
      }
      return -1;
    };
    var cTer = col(['Territoire']), cZ = col(['Zone']), cCom = col(['Commune']),
        cSub = col(['Subdivision']), cQ = col(['Quartier']), cSec = col(['Secteur']),
        cVar = col(['Variantes']), cLat = col(['Latitude', 'Lat']), cLon = col(['Longitude', 'Lon']);
    if (cQ < 0) {
      cCom = 0; cQ = 1; cZ = 2; cLat = 3; cLon = 4; cSec = nc >= 6 ? 5 : -1;
    }
    var txt = function (r, i) { return (i >= 0 && r[i] !== undefined && r[i] !== null) ? String(r[i]).trim() : ''; };
    var num = function (r, i) {
      if (i < 0 || r[i] === undefined || r[i] === null || r[i] === '') return '';
      var n = parseFloat(String(r[i]).replace(',', '.'));
      return isFinite(n) ? n : '';
    };
    shQ.getRange(2, 1, shQ.getLastRow() - 1, nc).getValues().forEach(function (r) {
      var q = txt(r, cQ), s = txt(r, cSec), comRaw = txt(r, cCom);
      if (!q && !s && !comRaw) return;
      var com = typeof communeParente === 'function' ? communeParente(comRaw) : comRaw;
      var sub = txt(r, cSub);
      if (!sub && comRaw && com && normaliser(comRaw) !== normaliser(com)) sub = comRaw;
      var tzInfo = territoireEtZoneDeCommune_(com);
      var ter = txt(r, cTer) || tzInfo.territoire;
      var z = txt(r, cZ) || tzInfo.zone;
      if (ter === 'Intérieur' && (!z || normaliser(z) === 'zoneinterieur')) z = 'Intérieur';
      out.push({
        territoire: ter,
        zone: z,
        commune: tzInfo.commune || com,
        subdivision: sub,
        quartier: q,
        secteur: s,
        variantes: txt(r, cVar),
        lat: num(r, cLat),
        lon: num(r, cLon)
      });
    });
  }
  if (!out.length && typeof quartiersDefautObjets === 'function') {
    out = quartiersDefautObjets().map(function (q) {
      var comPar = typeof communeParente === 'function' ? communeParente(q.commune) : q.commune;
      var sub = (q.commune && normaliser(q.commune) !== normaliser(comPar)) ? q.commune : '';
      var tzInfo = territoireEtZoneDeCommune_(comPar);
      return {
        territoire: tzInfo.territoire || 'Abidjan',
        zone: q.zone || tzInfo.zone,
        commune: tzInfo.commune || comPar,
        subdivision: sub,
        quartier: q.quartier || '',
        secteur: q.secteur || '',
        variantes: '',
        lat: q.lat,
        lon: q.lon
      };
    });
  }
  return out;
}

// Résolution territoriale unifiée avec délégation vers resoudreTerritoire (Commun.gs) et secours local
function resoudreTerritoireFallback_(entree, refQ) {
  entree = entree || {};
  var inTer = String(entree.territoire || '').trim();
  var inZ = String(entree.zone || '').trim();
  var inComRaw = String(entree.commune || '').trim();
  var inCom = typeof communeParente === 'function' ? communeParente(inComRaw) : inComRaw;
  var inSub = String(entree.subdivision || '').trim();
  if (!inSub && inComRaw && inCom && normaliser(inComRaw) !== normaliser(inCom)) inSub = inComRaw;
  var inQ = String(entree.quartier || '').trim();
  var inSec = String(entree.secteur || '').trim();
  var inLieu = String(entree.lieu || '').trim();
  var comNorm = normaliser(inCom), qNorm = normaliser(inQ), secNorm = normaliser(inSec), lieuNorm = normaliser(inLieu);

  var meilleurs = [], candidats = refQ || [];
  var correspondCom = function (q) { return !comNorm || normaliser(q.commune) === comNorm; };
  var variantesDe = function (q) {
    return String(q.variantes || '').split(/[,;|\/]+/).map(function (x) { return normaliser(x); }).filter(Boolean);
  };

  if (qNorm && secNorm) {
    meilleurs = candidats.filter(function (q) { return correspondCom(q) && normaliser(q.quartier) === qNorm && normaliser(q.secteur) === secNorm; });
    if (!meilleurs.length && comNorm) {
      meilleurs = candidats.filter(function (q) { return normaliser(q.quartier) === qNorm && normaliser(q.secteur) === secNorm; });
    }
  }
  if (!meilleurs.length && secNorm) {
    meilleurs = candidats.filter(function (q) { return correspondCom(q) && normaliser(q.secteur) === secNorm; });
    if (!meilleurs.length && comNorm) {
      meilleurs = candidats.filter(function (q) { return normaliser(q.secteur) === secNorm; });
    }
  }
  if (!meilleurs.length && qNorm) {
    meilleurs = candidats.filter(function (q) { return correspondCom(q) && normaliser(q.quartier) === qNorm && !q.secteur; });
    if (!meilleurs.length) {
      meilleurs = candidats.filter(function (q) { return correspondCom(q) && normaliser(q.quartier) === qNorm; });
    }
    if (!meilleurs.length) {
      meilleurs = candidats.filter(function (q) {
        return correspondCom(q) && (normaliser(q.secteur) === qNorm || normaliser(q.quartier + ' ' + q.secteur) === qNorm || variantesDe(q).indexOf(qNorm) >= 0);
      });
    }
    if (!meilleurs.length && comNorm) {
      meilleurs = candidats.filter(function (q) {
        return normaliser(q.quartier) === qNorm || normaliser(q.secteur) === qNorm ||
          normaliser(q.quartier + ' ' + q.secteur) === qNorm || variantesDe(q).indexOf(qNorm) >= 0;
      });
    }
  }
  if (!meilleurs.length && lieuNorm) {
    var trouves = [];
    candidats.forEach(function (q) {
      if (!correspondCom(q)) return;
      var cleSec = normaliser(q.secteur), cleQ = normaliser(q.quartier), vars = variantesDe(q);
      if (cleSec && cleSec.length >= 4 && lieuNorm.indexOf(cleSec) >= 0) trouves.push({ q: q, len: cleSec.length + 20 });
      else if (vars.some(function (v) { return v.length >= 4 && lieuNorm.indexOf(v) >= 0; })) trouves.push({ q: q, len: 30 });
      else if (cleQ && cleQ.length >= 4 && lieuNorm.indexOf(cleQ) >= 0) trouves.push({ q: q, len: cleQ.length });
    });
    if (trouves.length) {
      trouves.sort(function (a, b) { return b.len - a.len; });
      meilleurs = [trouves[0].q];
    }
  }

  if (meilleurs.length) {
    var m = meilleurs[0];
    var tzM = territoireEtZoneDeCommune_(m.commune);
    return {
      territoire: m.territoire || tzM.territoire || inTer,
      zone: m.zone || tzM.zone || inZ,
      commune: m.commune || inCom,
      subdivision: m.subdivision || inSub,
      quartier: m.quartier || inQ,
      secteur: m.secteur || inSec,
      lat: m.lat,
      lon: m.lon
    };
  }
  var tzDef = territoireEtZoneDeCommune_(inCom);
  var subDef = inSub;
  if (!subDef && tzDef.commune && typeof zoneDeQuartier === 'function') {
    subDef = zoneDeQuartier(tzDef.commune, inQ, inLieu);
  }
  var cenInt = (tzDef.territoire === 'Intérieur' && typeof centroideVilleInterieur === 'function') ? centroideVilleInterieur(tzDef.commune || inQ) : null;
  return {
    territoire: inTer || tzDef.territoire,
    zone: inZ || tzDef.zone,
    commune: tzDef.commune || inCom,
    subdivision: subDef,
    quartier: inQ,
    secteur: inSec,
    lat: cenInt ? cenInt.lat : '',
    lon: cenInt ? cenInt.lon : ''
  };
}

function resoudreTerritoireEcriture_(entree, refQ) {
  if (!refQ || !refQ.length) refQ = referentielQuartiers_(null);
  var res = (typeof resoudreTerritoire === 'function')
    ? resoudreTerritoire(entree, refQ)
    : resoudreTerritoireFallback_(entree, refQ);
  res = res || {};
  var out = {
    territoire: String(res.territoire || entree.territoire || '').trim(),
    zone: String(res.zone || entree.zone || '').trim(),
    commune: String(res.commune || (typeof communeParente === 'function' ? communeParente(entree.commune || '') : entree.commune || '')).trim(),
    subdivision: String(res.subdivision || entree.subdivision || '').trim(),
    quartier: String(res.quartier || entree.quartier || '').trim(),
    secteur: String(res.secteur || entree.secteur || '').trim(),
    lat: res.lat,
    lon: res.lon
  };
  if (out.territoire === 'Intérieur' && !out.zone) out.zone = 'Intérieur';
  if ((!isFinite(nombre6(out.lat)) || !isFinite(nombre6(out.lon))) && refQ && refQ.length) {
    var cN = normaliser(out.commune), qN = normaliser(out.quartier), sN = normaliser(out.secteur);
    var match = refQ.filter(function (q) {
      return (!cN || normaliser(q.commune) === cN) && (!qN || normaliser(q.quartier) === qN) && (!sN || normaliser(q.secteur) === sN);
    })[0] || refQ.filter(function (q) {
      return (!cN || normaliser(q.commune) === cN) && qN && normaliser(q.quartier) === qN;
    })[0];
    if (match && isFinite(nombre6(match.lat)) && isFinite(nombre6(match.lon))) {
      out.lat = match.lat; out.lon = match.lon;
    } else if (out.territoire === 'Intérieur' && typeof centroideVilleInterieur === 'function') {
      var ci = centroideVilleInterieur(out.commune || out.quartier);
      if (ci) { out.lat = ci.lat; out.lon = ci.lon; }
    }
  }
  return out;
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
    var refQ = referentielQuartiers_(ss);
    var champsR = champsEcrAvecTerritoire_(CHAMPS_PRESENCES);
    var entR = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0].map(normaliser);
    var posR = champsR.map(function (c) { return entR.indexOf(normaliser(c[1])); });
    var rCode = posR[indexChamp(champsR, 'code')], rId = posR[indexChamp(champsR, 'id')];
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
      var exist = mesLignes.map(function (i) { var l = dataR[i], o = {}; champsR.forEach(function (c, k) { if (posR[k] >= 0) o[c[0]] = l[posR[k]]; }); return o; });
      lieux = lieux.slice();
      lieux.forEach(function (x) {
        var e = exist.filter(function (o) { return !o._pris && normaliser(o.lieu) === normaliser(x.lieu); })[0];
        if (!e) return;
        e._pris = true; x.id = e.id;
        JOURS_CLES.forEach(function (j) { x[j] = fusionDispo(e[j], x[j]); });
        ['territoire', 'zone', 'commune', 'subdivision', 'quartier', 'secteur', 'reperes', 'lat', 'lon', 'origineGps', 'horaireMatin', 'horaireSoir'].forEach(function (k) {
          if ((x[k] === undefined || x[k] === '') && e[k] !== '') x[k] = e[k];
        });
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
      var resT = resoudreTerritoireEcriture_({
        territoire: x.territoire || '',
        zone: x.zone || '',
        commune: x.commune || '',
        subdivision: x.subdivision || '',
        quartier: x.quartier || '',
        secteur: x.secteur || '',
        lieu: x.lieu || ''
      }, refQ);
      var o = {
        id: id,
        code: code,
        nom: texteCellule_(nom),
        lieu: texteCellule_(x.lieu || ''),
        territoire: texteCellule_(resT.territoire || x.territoire || ''),
        zone: texteCellule_(resT.zone || x.zone || ''),
        commune: texteCellule_(resT.commune || x.commune || ''),
        subdivision: texteCellule_(resT.subdivision || x.subdivision || ''),
        quartier: texteCellule_(resT.quartier || x.quartier || ''),
        secteur: texteCellule_(resT.secteur || x.secteur || ''),
        horaireMatin: texteCellule_(x.horaireMatin || ''),
        horaireSoir: texteCellule_(x.horaireSoir || ''),
        lat: x.lat === undefined ? '' : x.lat,
        lon: x.lon === undefined ? '' : x.lon,
        reperes: texteCellule_(x.reperes || ''),
        origineGps: texteCellule_(x.origineGps || '')
      };
      // 3.9.0 : pas de position prise sur place ? on cherche l'établissement sur Google Maps (Abidjan), sinon centroïde quartier
      var latTest = nombre6(o.lat), lonTest = nombre6(o.lon);
      if (!isFinite(latTest) || !isFinite(lonTest) || latTest === 0 || lonTest === 0) {
        var g = geocoderLieu(String(x.lieu || ''), String(o.quartier || ''), String(o.commune || ''));
        if (g && isFinite(nombre6(g.lat)) && isFinite(nombre6(g.lon))) {
          o.lat = g.lat; o.lon = g.lon; o.origineGps = 'Google Maps'; coords[id] = g;
        } else if (isFinite(nombre6(resT.lat)) && isFinite(nombre6(resT.lon)) && nombre6(resT.lat) !== 0 && nombre6(resT.lon) !== 0) {
          o.lat = nombre6(resT.lat); o.lon = nombre6(resT.lon); o.origineGps = o.origineGps || 'Centroïde quartier'; coords[id] = { lat: o.lat, lon: o.lon };
        }
      }
      // 3.27.33 : positions à 6 décimales ; origine conservée si la position n'a pas bougé (valide lat & lon avec isFinite)
      var lat6 = nombre6(o.lat), lon6 = nombre6(o.lon);
      if (isFinite(lat6) && isFinite(lon6)) { o.lat = lat6; o.lon = lon6; }
      else { o.lat = ''; o.lon = ''; }
      var iEx = ligneParId[String(id)], kO = posR[indexChamp(champsR, 'origineGps')];
      if (!o.origineGps && iEx !== undefined && kO >= 0 && o.lat !== '' && o.lon !== '' &&
          Math.abs(nombre6(dataR[iEx][posR[indexChamp(champsR, 'lat')]]) - o.lat) < 0.00001 &&
          Math.abs(nombre6(dataR[iEx][posR[indexChamp(champsR, 'lon')]]) - o.lon) < 0.00001) {
        o.origineGps = texteCellule_(dataR[iEx][kO] || '');
      }
      JOURS_CLES.forEach(function (j) { o[j] = texteCellule_(x[j] || ''); });
      var v = entR.map(function () { return ''; });
      champsR.forEach(function (c, k) { if (posR[k] >= 0) v[posR[k]] = o[c[0]] === undefined ? '' : o[c[0]]; });
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
        var ancLieu = dataR[i] ? dataR[i][posR[indexChamp(champsR, 'lieu')]] : 'Lieu';
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
  var champsPh = champsEcrAvecTerritoire_(CHAMPS_PHARMACIES);
  var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
  var pos = champsPh.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var n = Math.max(sh.getLastRow() - 1, 0), data = n ? sh.getRange(2, 1, n, ent.length).getValues() : [];
  var cCode = pos[indexChamp(champsPh, 'code')], cNom = pos[indexChamp(champsPh, 'nom')], cQuart = pos[indexChamp(champsPh, 'quartier')];
  var code = String(p.code || ''), ligne = -1, max = 1000, nomNorm = normaliser(p.nom), quartNorm = normaliser(lieu.quartier || lieu.secteur);
  data.forEach(function (l, i) {
    var m = String(l[cCode]).match(/^PHA-(\d+)$/); if (m && +m[1] > max) max = +m[1];
    if (code && String(l[cCode]) === code) ligne = i;
    else if (ligne < 0 && (!code || /^TMP-/.test(code)) && cNom >= 0 && normaliser(l[cNom]) === nomNorm && (!quartNorm || cQuart < 0 || !l[cQuart] || normaliser(l[cQuart]) === quartNorm)) {
      ligne = i; code = String(l[cCode]);
    }
  });
  if (ligne < 0) code = 'PHA-' + (max + 1);
  var refQ = referentielQuartiers_(ss);
  var v = ligne >= 0 ? data[ligne].slice() : ent.map(function () { return ''; });
  var kTer = pos[indexChamp(champsPh, 'territoire')];
  var kZ = pos[indexChamp(champsPh, 'zone')];
  var kCom = pos[indexChamp(champsPh, 'commune')];
  var kSub = pos[indexChamp(champsPh, 'subdivision')];
  var kQuart = pos[indexChamp(champsPh, 'quartier')];
  var kSec = pos[indexChamp(champsPh, 'secteur')];
  var kHM = pos[indexChamp(champsPh, 'horaireMatin')];
  var kHS = pos[indexChamp(champsPh, 'horaireSoir')];
  var kTel = pos[indexChamp(champsPh, 'telephone')];
  var kLaP = pos[indexChamp(champsPh, 'lat')], kLoP = pos[indexChamp(champsPh, 'lon')];

  var aEntreeGeo = !!(lieu.territoire || lieu.zone || lieu.commune || lieu.subdivision || lieu.quartier || lieu.secteur ||
    p.territoire || p.zone || p.commune || p.subdivision || p.quartier || p.secteur);
  var srcGeo = aEntreeGeo ? {
    territoire: lieu.territoire || p.territoire || '',
    zone: lieu.zone || p.zone || '',
    commune: lieu.commune || p.commune || '',
    subdivision: lieu.subdivision || p.subdivision || '',
    quartier: lieu.quartier || p.quartier || '',
    secteur: lieu.secteur || p.secteur || '',
    lieu: p.nom || ''
  } : (ligne >= 0 ? {
    territoire: kTer >= 0 ? String(v[kTer] || '') : '',
    zone: kZ >= 0 ? String(v[kZ] || '') : '',
    commune: kCom >= 0 ? String(v[kCom] || '') : '',
    subdivision: kSub >= 0 ? String(v[kSub] || '') : '',
    quartier: kQuart >= 0 ? String(v[kQuart] || '') : '',
    secteur: kSec >= 0 ? String(v[kSec] || '') : '',
    lieu: p.nom || ''
  } : { lieu: p.nom || '' });
  var resT = resoudreTerritoireEcriture_(srcGeo, refQ);

  var terIn = String(resT.territoire || '').trim();
  var zoneIn = String(resT.zone || '').trim();
  var comIn = String(resT.commune || '').trim();
  var subIn = String(resT.subdivision || '').trim();
  var quartIn = String(resT.quartier || '').trim();
  var secIn = String(resT.secteur || '').trim();
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
  if (terIn) modif.territoire = texteCellule_(terIn); else if (ligne < 0) modif.territoire = '';
  if (zoneIn) modif.zone = texteCellule_(zoneIn); else if (ligne < 0) modif.zone = '';
  if (comIn) modif.commune = texteCellule_(comIn); else if (ligne < 0) modif.commune = '';
  if (subIn) modif.subdivision = texteCellule_(subIn); else if (ligne < 0) modif.subdivision = '';
  if (quartIn) modif.quartier = texteCellule_(quartIn); else if (ligne < 0) modif.quartier = '';
  if (secIn) modif.secteur = texteCellule_(secIn); else if (ligne < 0) modif.secteur = '';
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
      if ((!quartActuel || quartActuel === 'NL') && g.quartier) {
        var resG = resoudreTerritoireEcriture_({ commune: comGeo, quartier: g.quartier, lieu: p.nom || '' }, refQ);
        modif.quartier = texteCellule_(resG.quartier || g.quartier);
        if (!modif.secteur && resG.secteur) modif.secteur = texteCellule_(resG.secteur);
        if (!modif.subdivision && resG.subdivision) modif.subdivision = texteCellule_(resG.subdivision);
        if (!modif.commune && resG.commune) modif.commune = texteCellule_(resG.commune);
        if (!modif.zone && resG.zone) modif.zone = texteCellule_(resG.zone);
        if (!modif.territoire && resG.territoire) modif.territoire = texteCellule_(resG.territoire);
      }
    } else if (isFinite(nombre6(resT.lat)) && isFinite(nombre6(resT.lon)) && nombre6(resT.lat) !== 0 && nombre6(resT.lon) !== 0) {
      modif.lat = nombre6(resT.lat); modif.lon = nombre6(resT.lon); modif.origineGps = 'Centroïde quartier';
    }
  }
  if (ligne < 0) { modif.nbVisites = 0; modif.source = 'Application'; }
  champsPh.forEach(function (c, k) { if (pos[k] >= 0 && modif[c[0]] !== undefined) v[pos[k]] = modif[c[0]]; });
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
    var champsE = champsEcrAvecTerritoire_(CHAMPS_ETABLISSEMENTS);
    if (!champsE.some(function (c) { return c[0] === 'origineGps'; })) champsE.push(['origineGps', 'OrigineGPS']);
    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
    var pos = champsE.map(function (c) { return ent.indexOf(normaliser(c[1])); });
    var n = Math.max(sh.getLastRow() - 1, 0), data = n ? sh.getRange(2, 1, n, ent.length).getValues() : [];
    var cCode = pos[indexChamp(champsE, 'code')], cNom = pos[indexChamp(champsE, 'nom')];
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
    var refQ = referentielQuartiers_(ss);
    var v = ligne >= 0 ? data[ligne].slice() : ent.map(function () { return ''; });
    var resT = resoudreTerritoireEcriture_({
      territoire: b.territoire || '',
      zone: b.zone || '',
      commune: b.commune || '',
      subdivision: b.subdivision || '',
      quartier: b.quartier || '',
      secteur: b.secteur || '',
      lieu: nom
    }, refQ);
    var modif = {
      code: code,
      nom: texteCellule_(nom),
      categorie: texteCellule_(b.categorie || ''),
      territoire: texteCellule_(resT.territoire || b.territoire || ''),
      zone: texteCellule_(resT.zone || b.zone || ''),
      commune: texteCellule_(resT.commune || b.commune || ''),
      subdivision: texteCellule_(resT.subdivision || b.subdivision || ''),
      quartier: texteCellule_(resT.quartier || b.quartier || ''),
      secteur: texteCellule_(resT.secteur || b.secteur || ''),
      telephone: preparerTelephone_(b.telephone || ''),
      reperes: texteCellule_(b.reperes || '')
    };
    var kLaE = pos[indexChamp(champsE, 'lat')], kLoE = pos[indexChamp(champsE, 'lon')];
    var latExE = (ligne >= 0 && kLaE >= 0) ? nombre6(v[kLaE]) : NaN;
    var lonExE = (ligne >= 0 && kLoE >= 0) ? nombre6(v[kLoE]) : NaN;
    var gpsExEValide = isFinite(latExE) && isFinite(lonExE) && latExE !== 0 && lonExE !== 0;

    if (b.lat !== undefined && b.lon !== undefined && b.lat !== '' && b.lon !== '') {
      var latE = nombre6(b.lat), lonE = nombre6(b.lon);
      if (isFinite(latE) && isFinite(lonE) && latE !== 0 && lonE !== 0) {
        modif.lat = latE;
        modif.lon = lonE;
      }
    }
    if ((modif.lat === undefined || modif.lon === undefined) && !gpsExEValide) {
      var gE = typeof geocoderLieu === 'function' ? geocoderLieu(nom, modif.quartier, modif.commune) : null;
      if (gE && isFinite(nombre6(gE.lat)) && isFinite(nombre6(gE.lon))) {
        modif.lat = nombre6(gE.lat);
        modif.lon = nombre6(gE.lon);
        modif.origineGps = 'Google Maps';
      } else if (isFinite(nombre6(resT.lat)) && isFinite(nombre6(resT.lon)) && nombre6(resT.lat) !== 0 && nombre6(resT.lon) !== 0) {
        modif.lat = nombre6(resT.lat);
        modif.lon = nombre6(resT.lon);
        modif.origineGps = 'Centroïde quartier';
      }
    }
    champsE.forEach(function (c, k) { if (pos[k] >= 0 && modif[c[0]] !== undefined) v[pos[k]] = modif[c[0]]; });
    var rangE = ligne >= 0 ? ligne + 2 : sh.getLastRow() + 1;
    var cTelE = pos[indexChamp(champsE, 'telephone')];
    if (cTelE >= 0) sh.getRange(rangE, cTelE + 1).setNumberFormat('@');
    sh.getRange(rangE, 1, 1, ent.length).setValues([v]);

    // Cascade GPS et territoire/quartier vers la feuille Presences si lat/lon modifiés
    var cascades = 0;
    if (isFinite(modif.lat) && isFinite(modif.lon) && modif.lat) {
      var shR = ss.getSheetByName(FEUILLES.presences);
      if (shR && shR.getLastRow() > 1) {
        var entR = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0].map(normaliser);
        var cLieu = entR.indexOf(normaliser('Lieu/Etablissement'));
        var cLatR = entR.indexOf(normaliser('Latitude'));
        var cLonR = entR.indexOf(normaliser('Longitude'));
        var cTerR = entR.indexOf(normaliser('Territoire'));
        var cZonR = entR.indexOf(normaliser('Zone'));
        var cComR = entR.indexOf(normaliser('Commune'));
        var cSubR = entR.indexOf(normaliser('Subdivision'));
        var cQuartR = entR.indexOf(normaliser('Quartier'));
        var cSecR = entR.indexOf(normaliser('Secteur'));
        if (cLieu >= 0 && cLatR >= 0 && cLonR >= 0) {
          var nR = shR.getLastRow() - 1;
          var valR = shR.getRange(2, 1, nR, entR.length).getValues();
          var modifR = false;
          valR.forEach(function (row) {
            if (normaliser(row[cLieu]) === nomNorm) {
              row[cLatR] = modif.lat;
              row[cLonR] = modif.lon;
              if (modif.territoire && cTerR >= 0 && !row[cTerR]) row[cTerR] = modif.territoire;
              if (modif.zone && cZonR >= 0 && !row[cZonR]) row[cZonR] = modif.zone;
              if (modif.commune && cComR >= 0 && (!row[cComR] || normaliser(row[cComR]) === 'nl')) row[cComR] = modif.commune;
              if (modif.subdivision && cSubR >= 0 && !row[cSubR]) row[cSubR] = modif.subdivision;
              if (modif.quartier && cQuartR >= 0 && (!row[cQuartR] || normaliser(row[cQuartR]) === 'nl')) row[cQuartR] = modif.quartier;
              if (modif.secteur && cSecR >= 0 && !row[cSecR]) row[cSecR] = modif.secteur;
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

