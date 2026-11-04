/* Ecriture.gs : enregistrements venant de l'application (visites, comptes rendus, tournées, fiches, délégués). (découpé de Code.gs, 3.27.14 ; tous les fichiers .gs partagent le même espace) */
function enregistrerRapport(r) {
  var delegue = nomDelegue(r.delegue);
  if (!delegue || !r.date) return { ok: false, erreur: 'Rapport incomplet (délégué ou date).' };
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone(), sh = assurerRapports(ss);
    r.delegue = delegue; r.maj = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
    var ligne = CHAMPS_RAPPORTS.map(function (c) { return r[c[0]] === undefined ? '' : String(r[c[0]]); });
    var iDel = indexChamp(CHAMPS_RAPPORTS, 'delegue'), iDate = indexChamp(CHAMPS_RAPPORTS, 'date'), n = sh.getLastRow() - 1, rang = -1;
    if (n > 0) sh.getRange(2, 1, n, CHAMPS_RAPPORTS.length).getDisplayValues().forEach(function (l, i) {
      if (String(l[iDel]).trim().toLowerCase() === delegue.toLowerCase() && versIso(l[iDate], tz) === r.date) rang = i + 2;
    });
    if (rang > 0) sh.getRange(rang, 1, 1, ligne.length).setValues([ligne]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, ligne.length).setValues([ligne]);
    return { ok: true, date: r.date };
  } finally { lock.releaseLock(); }
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
    CHAMPS_PRATICIENS.forEach(function (c, k) { if (posP[k] >= 0 && modif[c[0]] !== undefined && !(rattache && (modif[c[0]] === '' || c[0] === 'note' || c[0] === 'conventionne') && valeurs[posP[k]] !== '')) valeurs[posP[k]] = modif[c[0]]; });
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
        ['quartier', 'reperes', 'lat', 'lon', 'horaireMatin', 'horaireSoir'].forEach(function (k) { if ((x[k] === undefined || x[k] === '') && e[k] !== '') x[k] = e[k]; });
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
      var id = x.id && !/^TMP/.test(String(x.id)) && !idsPris[String(x.id)] ? x.id : ++maxId;
      idsPris[String(id)] = true;
      lignesId.push(String(id));
      if (x.id && /^TMP/.test(String(x.id))) ids[x.id] = id;
      var q = refQ[normaliser(x.quartier)] || ['', '', ''];
      var o = { id: id, code: code, nom: nom, lieu: String(x.lieu || ''), quartier: String(x.quartier || ''),
                commune: q[0] || String(x.commune || ''), zone: q[2] || String(x.zone || ''),
                horaireMatin: String(x.horaireMatin || ''), horaireSoir: String(x.horaireSoir || ''),
                lat: x.lat === undefined ? '' : x.lat, lon: x.lon === undefined ? '' : x.lon, reperes: String(x.reperes || '') };
      // 3.9.0 : pas de position prise sur place ? on cherche l'établissement sur Google Maps (Abidjan)
      if (o.lat === '' || o.lon === '') { var g = geocoderLieu(o.lieu, o.quartier, o.commune); if (g) { o.lat = g.lat; o.lon = g.lon; coords[id] = g; } }
      JOURS_CLES.forEach(function (j) { o[j] = String(x[j] || ''); });
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
    libres.sort(function (a, b) { return b - a; }).forEach(function (i) { shR.deleteRow(i + 2); });
    return { ok: true, code: code, ancien: String(p.code || ''), ids: ids, coords: coords };
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
  var modif = { code: code, nom: String(p.nom || '').trim(), quartier: lieu.quartier || '', commune: q.commune || lieu.commune || '', zone: q.zone || lieu.zone || '',
    telephone: String(p.telephone || ''), note: lireNote(p.note), conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non',
    actif: normaliser(p.actif) === 'non' ? 'Non' : 'Oui', horaireMatin: lieu.horaireMatin || HORAIRES_PHARMACIE[0], horaireSoir: lieu.horaireSoir || HORAIRES_PHARMACIE[1] };
  if (lieu.lat && lieu.lon && lieu.lat !== 'NL' && lieu.lon !== 'NL') { modif.lat = +lieu.lat; modif.lon = +lieu.lon; }
  else {
    var g = geocoderLieu(p.nom, lieu.quartier, modif.commune, p.telephone, p.titulaire);
    if (g) {
      modif.lat = g.lat; modif.lon = g.lon;
      if ((!modif.quartier || modif.quartier === 'NL') && g.quartier) modif.quartier = g.quartier;
    }
  }
  if (ligne < 0) { modif.nbVisites = 0; modif.source = 'Application'; }
  CHAMPS_PHARMACIES.forEach(function (c, k) { if (pos[k] >= 0 && modif[c[0]] !== undefined) v[pos[k]] = modif[c[0]]; });
  if (ligne >= 0) sh.getRange(ligne + 2, 1, 1, ent.length).setValues([v]); else sh.getRange(sh.getLastRow() + 1, 1, 1, ent.length).setValues([v]);
  var ids = {}; if (lieu.id) ids[lieu.id] = 'P-' + code;
  return { ok: true, code: code, ancien: String(p.code || ''), ids: ids };
}

// Établissement (hôpital, clinique, FSU COM, dispensaire...) créé ou modifié depuis l'application
function enregistrerEtablissement(b) {
  var nom = String(b.nom || '').trim();
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
      code = 'ETAB-' + ('00' + (max + 1)).slice(-3);
    }
    var v = ligne >= 0 ? data[ligne].slice() : ent.map(function () { return ''; });
    var modif = {
      code: code,
      nom: nom,
      categorie: String(b.categorie || ''),
      commune: String(b.commune || ''),
      quartier: String(b.quartier || ''),
      zone: String(b.zone || ''),
      telephone: String(b.telephone || ''),
      reperes: String(b.reperes || '')
    };
    if (b.lat !== undefined && b.lon !== undefined && b.lat !== '' && b.lon !== '') {
      modif.lat = +String(b.lat).replace(',', '.');
      modif.lon = +String(b.lon).replace(',', '.');
    }
    CHAMPS_ETABLISSEMENTS.forEach(function (c, k) { if (pos[k] >= 0 && modif[c[0]] !== undefined) v[pos[k]] = modif[c[0]]; });
    if (ligne >= 0) sh.getRange(ligne + 2, 1, 1, ent.length).setValues([v]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, ent.length).setValues([v]);

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
    sh.getRange(ligne, c + 1).setValue(nom);
    return { ok: true, ajoute: true };
  } finally {
    lock.releaseLock();
  }
}

