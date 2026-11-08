/* =============================================================================
   Fusion.gs (3.28.16) : fusion des doublons, sans perte de données
   Un même hôpital ou une même pharmacie saisi sous deux noms : la fiche absorbée
   est fondue dans la fiche gardée, puis toutes les références suivent
   (lieux d'exercice, visites, tournées). Rien n'est perdu :
   - champs vides de la fiche gardée complétés, téléphones et repères cumulés,
     ancien nom conservé dans la colonne « Alias » ;
   - chaque cellule modifiée et chaque ligne retirée est notée dans
     « Fusions_Journal » : toute fusion peut être annulée ;
   - les anciens codes, identifiants et noms restent reconnus (onglet « Fusions ») :
     une visite ou une fiche envoyée plus tard par un téléphone hors ligne
     est rattachée à la fiche gardée.
   Menu MediPlanner > Doublons. Supabase suit immédiatement (Jumelage.gs).
   ============================================================================= */

var FUSION_FEUILLE = 'Fusions';
var FUSION_JOURNAL = 'Fusions_Journal';
var FUSION_PROPOSITIONS = 'Doublons à fusionner';
var FUSION_ENTETES = ['Date', 'IdFusion', 'Type', 'CodeGarde', 'NomGarde', 'CodeAbsorbe', 'NomAbsorbe', 'Commune', 'Auteur', 'Resume', 'Etat', 'Redirections'];
var FUSION_DECISIONS = ['Garder A', 'Garder B', 'Différents'];

// ---------------------------------------------------------------- Lecture d'un onglet par en-têtes
// t.col('Repères', 'Reperes') : index de la première colonne trouvée (-1 sinon)
function fusTable_(ss, nom) {
  var sh = ss.getSheetByName(nom);
  if (!sh || sh.getLastColumn() < 1) return null;
  var brut = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var ent = brut.map(normaliser), n = Math.max(sh.getLastRow() - 1, 0);
  return { sh: sh, nom: nom, brut: brut, ent: ent, n: n, data: n ? sh.getRange(2, 1, n, brut.length).getValues() : [],
    col: function () { for (var i = 0; i < arguments.length; i++) { var k = ent.indexOf(normaliser(arguments[i])); if (k >= 0) return k; } return -1; } };
}
function fusVide_(v) { return v === '' || v === null || v === undefined || (typeof v === 'string' && !v.trim()); }
function fusTxt_(v) { return v instanceof Date ? Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd') : String(v === undefined || v === null ? '' : v).trim(); }
function fusEnc_(v) { return v instanceof Date ? 'D:' + v.getTime() : (typeof v === 'number' ? 'N:' + v : (typeof v === 'boolean' ? 'B:' + v : 'S:' + String(v === undefined || v === null ? '' : v))); }
function fusDec_(s) {
  s = String(s); var t = s.slice(0, 2), r = s.slice(2);
  return t === 'D:' ? new Date(+r) : (t === 'N:' ? +r : (t === 'B:' ? r === 'true' : r));
}
// valeurs texte cumulées sans doublon (« a ; b »)
function fusCumul_(a, b, sep) {
  sep = sep || ' ; ';
  var vus = {}, out = [];
  [a, b].forEach(function (v) {
    String(fusTxt_(v)).split(/\s*;\s*/).forEach(function (x) { x = x.trim(); var k = normaliser(x); if (x && !vus[k]) { vus[k] = 1; out.push(x); } });
  });
  return out.join(sep);
}
// téléphones cumulés sans doublon (comparés sur les chiffres)
function fusTel_(a, b) {
  var vus = {}, out = [];
  [a, b].forEach(function (v) {
    var f = formaterTelephoneCI(fusTxt_(v)); if (!f) return;
    f.split(/\s*\/\s*/).forEach(function (x) { var d = x.replace(/\D/g, '').slice(-8); if (x && !vus[d]) { vus[d] = 1; out.push(x); } });
  });
  return out.join(' / ');
}
function fusOui_(v) { return /^(oui|true|vrai|1|x)$/i.test(fusTxt_(v)); }
function fusCommunesCompatibles_(a, b) { a = normaliser(a); b = normaliser(b); return !a || !b || a === b; }
function fusDispo_(a, b) { var t = fusTxt_(a) + ' ' + fusTxt_(b), m = /matin/i.test(t), s = /soir/i.test(t); return m && s ? 'Matin et soir' : (m ? 'Matin' : (s ? 'Soir' : '')); }

// ---------------------------------------------------------------- Journal (annulation)
function fusJournalFeuille_(ss) {
  var sh = ss.getSheetByName(FUSION_JOURNAL);
  if (!sh) { sh = preparerFeuille(ss, FUSION_JOURNAL, ['IdFusion', 'Feuille', 'Genre', 'Cle', 'ValeurCle', 'Rang', 'Donnees']); sh.setFrozenRows(1); try { sh.hideSheet(); } catch (e) {} }
  return sh;
}
function fusFusionsFeuille_(ss) {
  var sh = ss.getSheetByName(FUSION_FEUILLE);
  if (!sh) { sh = preparerFeuille(ss, FUSION_FEUILLE, FUSION_ENTETES); sh.setFrozenRows(1); }
  return sh;
}

// Modifications préparées sur un onglet : cellules changées par ligne, lignes retirées
function fusChantier_(t, cleEntete) {
  return { t: t, cle: cleEntete ? t.col(cleEntete) : -1, cleEntete: cleEntete || '', cellules: {}, retirees: [], colsTouchees: {},
    poser: function (i, c, v) {
      if (c < 0) return false;
      var avant = this.t.data[i][c];
      if (fusEnc_(avant) === fusEnc_(v)) return false;
      var l = this.cellules[i] = this.cellules[i] || {};
      if (!(c in l)) l[c] = avant;          // première valeur d'origine retenue
      this.t.data[i][c] = v; this.colsTouchees[c] = 1;
      return true;
    },
    retirer: function (i) { if (this.retirees.indexOf(i) < 0) this.retirees.push(i); },
    nbLignes: function () { return Object.keys(this.cellules).filter(function (i) { return this.retirees.indexOf(+i) < 0; }, this).length; } };
}
// Écrit le chantier (colonnes touchées seulement, puis lignes retirées du bas vers le haut) et le note au journal
function fusAppliquer_(ch, idF, journal) {
  var t = ch.t, cles = Object.keys(ch.cellules);
  cles.forEach(function (i) {
    i = +i; if (ch.retirees.indexOf(i) >= 0) return;
    var cells = [];
    Object.keys(ch.cellules[i]).forEach(function (c) { cells.push([t.brut[c], fusEnc_(ch.cellules[i][c]), fusEnc_(t.data[i][c])]); });
    journal.push([idF, t.nom, 'cellules', ch.cleEntete, ch.cle >= 0 ? fusTxt_(t.data[i][ch.cle]) : '', i + 2, JSON.stringify(cells)]);
  });
  Object.keys(ch.colsTouchees).forEach(function (c) {
    c = +c;
    t.sh.getRange(2, c + 1, t.n, 1).setValues(t.data.map(function (l) { return [l[c]]; }));
  });
  ch.retirees.slice().sort(function (a, b) { return b - a; }).forEach(function (i) {
    var o = {}, src = ch.cellules[i] || {};
    t.brut.forEach(function (h, c) { o[h] = fusEnc_(c in src ? src[c] : t.data[i][c]); });   // ligne telle qu'avant la fusion
    var kv = ch.cle >= 0 ? fusTxt_(ch.cle in src ? src[ch.cle] : t.data[i][ch.cle]) : '';
    journal.push([idF, t.nom, 'ligne', ch.cleEntete, kv, i + 2, JSON.stringify(o)]);
    t.sh.deleteRow(i + 2);
  });
}

// ---------------------------------------------------------------- Redirections (anciens codes, identifiants et noms)
function fusRedirections_() {
  var cache = CacheService.getScriptCache(), txt = cache.get('FUS_REDIR');
  if (txt) return JSON.parse(txt);
  var R = { codes: {}, ids: {}, lieux: {}, distincts: {} };
  var t = fusTable_(SpreadsheetApp.getActive(), FUSION_FEUILLE);
  if (t) {
    var cE = t.col('Etat'), cR = t.col('Redirections'), cA = t.col('CodeGarde'), cB = t.col('CodeAbsorbe');
    t.data.forEach(function (l) {
      var etat = normaliser(l[cE]);
      if (etat === 'distincts') { R.distincts[fusTxt_(l[cA]) + '|' + fusTxt_(l[cB])] = 1; R.distincts[fusTxt_(l[cB]) + '|' + fusTxt_(l[cA])] = 1; return; }
      if (etat !== 'active') return;
      try {
        var r = JSON.parse(l[cR] || '{}');
        ['codes', 'ids', 'lieux'].forEach(function (k) { Object.keys(r[k] || {}).forEach(function (x) { R[k][x] = r[k][x]; }); });
      } catch (e) {}
    });
  }
  cache.put('FUS_REDIR', JSON.stringify(R), 600);
  return R;
}
function fusOublierRedirections_() { try { CacheService.getScriptCache().remove('FUS_REDIR'); } catch (e) {} }
function fusSuivre_(map, v) { var n = 0; v = String(v === undefined || v === null ? '' : v); while (map[v] && n++ < 10) v = map[v]; return v; }
function fusNomLieu_(R, lieu, commune) {
  var k = normaliser(lieu); if (!k) return lieu;
  var n = 0, nom = lieu, cm = normaliser(commune);
  while (n++ < 10) {
    var r = R.lieux[k + '|' + cm] || R.lieux[k + '|'];
    if (!r && !cm) { var seuls = Object.keys(R.lieux).filter(function (x) { return x.split('|')[0] === k; }); if (seuls.length === 1) r = R.lieux[seuls[0]]; }
    if (!r || normaliser(r) === k) break;
    nom = r; k = normaliser(r);
  }
  return nom;
}
// Une visite ou un arrêt de tournée envoyé avec une référence fusionnée est rattaché à la fiche gardée
function fusRediriger_(o) {
  if (!o) return o;
  var R = fusRedirections_();
  if (!Object.keys(R.codes).length && !Object.keys(R.ids).length && !Object.keys(R.lieux).length) return o;
  if (o.code) o.code = fusSuivre_(R.codes, o.code);
  if (o.idPresence) o.idPresence = fusSuivre_(R.ids, o.idPresence);
  if (o.lieu) o.lieu = fusNomLieu_(R, o.lieu, o.commune);
  return o;
}
// Fiche envoyée par un téléphone : code, lieux et identifiants redirigés ; deux lieux devenus identiques réunis
function fusRedirigerFiche_(p, lieux) {
  var R = fusRedirections_();
  if (p && p.code) p.code = fusSuivre_(R.codes, p.code);
  var parId = {}, out = [];
  (lieux || []).forEach(function (x) {
    if (x.id && !/^TMP/.test(String(x.id))) x.id = fusSuivre_(R.ids, x.id);
    if (x.lieu) x.lieu = fusNomLieu_(R, x.lieu, x.commune);
    var k = x.id && !/^TMP/.test(String(x.id)) ? String(x.id) : '';
    if (k && parId[k]) {
      var e = parId[k];
      JOURS_CLES.forEach(function (j) { e[j] = fusDispo_(e[j], x[j]); });
      Object.keys(x).forEach(function (c) { if (fusVide_(e[c]) && !fusVide_(x[c])) e[c] = x[c]; });
      return;
    }
    if (k) parId[k] = x;
    out.push(x);
  });
  return out;
}

// ---------------------------------------------------------------- Fusion
// o = { type: 'etablissement' | 'pharmacie', garder: code (ou { nom, commune } pour un nom de lieu sans fiche),
//       absorber: idem, auteur, simulation (true : rien n'est écrit, renvoie le bilan), forcerCommune, sansJumelage }
function fusionner(o) {
  o = o || {};
  var lock = o.sansVerrou ? null : verrouiller();
  try {
    var ss = SpreadsheetApp.getActive();
    var r = o.type === 'pharmacie' ? fusionnerPharmacies_(ss, o) : fusionnerEtablissements_(ss, o);
    if (r.ok && !o.simulation) {
      fusOublierRedirections_();
      marquerModif();
      if (!o.sansJumelage) { try { jumPousserApresEcriture_('fusion'); } catch (e) { console.warn('Jumelage après fusion : ' + e); } }
    }
    return r;
  } finally { if (lock) lock.releaseLock(); }
}

function fusRef_(t, v, cCode, cNom, cCom) {
  if (v && typeof v === 'object' && !v.code) {
    var i = -1;
    t.data.forEach(function (l, k) { if (i < 0 && normaliser(l[cNom]) === normaliser(v.nom) && fusCommunesCompatibles_(l[cCom], v.commune)) i = k; });
    return i >= 0 ? { i: i, code: fusTxt_(t.data[i][cCode]), nom: fusTxt_(t.data[i][cNom]), commune: fusTxt_(t.data[i][cCom]) }
                  : { i: -1, code: '', nom: String(v.nom || '').trim(), commune: String(v.commune || '').trim() };
  }
  var code = String(v && v.code ? v.code : v || '').trim();
  for (var k = 0; k < t.data.length; k++) if (fusTxt_(t.data[k][cCode]) === code) return { i: k, code: code, nom: fusTxt_(t.data[k][cNom]), commune: fusTxt_(t.data[k][cCom]) };
  return null;
}
function fusNouvelId_() { return 'F-' + Utilities.formatDate(new Date(), 'UTC', 'yyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000); }

function fusionnerEtablissements_(ss, o) {
  var tE = fusTable_(ss, FEUILLES.etablissements);
  if (!tE) return { ok: false, erreur: 'Onglet Etablissements introuvable.' };
  var c = { code: tE.col('CodeEtab'), nom: tE.col('Nom'), com: tE.col('Commune'), quart: tE.col('Quartier'), zone: tE.col('Zone'),
            lat: tE.col('Latitude'), lon: tE.col('Longitude'), pos: tE.col('Position'), ori: tE.col('OrigineGPS'),
            tel: tE.col('Téléphone', 'Telephone'), rep: tE.col('Repères', 'Reperes'), alias: tE.col('Alias') };
  var A = fusRef_(tE, o.garder, c.code, c.nom, c.com), B = fusRef_(tE, o.absorber, c.code, c.nom, c.com);
  if (!A || !B || !A.nom || !B.nom) return { ok: false, erreur: 'Établissement introuvable (' + JSON.stringify(!A || !A.nom ? o.garder : o.absorber) + ').' };
  if ((A.i >= 0 && A.i === B.i) || (A.i < 0 && B.i < 0 && normaliser(A.nom) === normaliser(B.nom) && normaliser(A.commune) === normaliser(B.commune)))
    return { ok: false, erreur: 'Les deux fiches sont la même.' };
  if (A.i < 0 && B.i >= 0) return { ok: false, erreur: 'La fiche à garder doit être une ligne de l\'onglet Etablissements (« ' + A.nom + ' » n\'en a pas) : gardez plutôt « ' + B.nom + ' ».' };
  if (!fusCommunesCompatibles_(A.commune, B.commune) && !o.forcerCommune)
    return { ok: false, communesDifferentes: true, erreur: 'Communes différentes : ' + A.commune + ' / ' + B.commune + '. Le même nom peut désigner deux lieux distincts.' };

  var idF = fusNouvelId_(), journal = [], bilan = { etablissements: 0, presences: 0, presencesReunies: 0, visites: 0, tournees: 0 };
  var chE = fusChantier_(tE, 'CodeEtab'), lA = A.i >= 0 ? tE.data[A.i] : null, lB = B.i >= 0 ? tE.data[B.i] : null;
  var aliasB = lB && c.alias >= 0 ? fusTxt_(lB[c.alias]) : '';
  var nomsB = {}; nomsB[normaliser(B.nom)] = 1; aliasB.split(/\s*;\s*/).forEach(function (x) { if (x) nomsB[normaliser(x)] = 1; });
  delete nomsB[normaliser(A.nom)];
  var communeB = B.commune || (lB ? fusTxt_(lB[c.com]) : '');

  // 1. Fiche gardée complétée ; ancien nom gardé en alias ; fiche absorbée retirée
  if (lA) {
    if (lB) {
      var posB = c.lat >= 0 && !fusVide_(lB[c.lat]) && (fusVide_(lA[c.lat]) || (/terrain/i.test(fusTxt_(lB[c.ori])) && !/terrain/i.test(fusTxt_(lA[c.ori]))));
      tE.brut.forEach(function (h, k) {
        if (k === c.code || k === c.nom || k === c.alias) return;
        if ([c.lat, c.lon, c.pos, c.ori].indexOf(k) >= 0) { if (posB) chE.poser(A.i, k, lB[k]); return; }
        if (k === c.tel) { chE.poser(A.i, k, fusTel_(lA[k], lB[k])); return; }
        if (k === c.rep) { chE.poser(A.i, k, fusCumul_(lA[k], lB[k])); return; }
        if (fusVide_(lA[k]) && !fusVide_(lB[k])) chE.poser(A.i, k, lB[k]);
      });
    }
    if (c.alias < 0 && !o.simulation) {   // colonne Alias créée à la première fusion
      c.alias = tE.brut.length;
      tE.sh.getRange(1, c.alias + 1).setValue('Alias').setFontWeight('bold');
      tE.brut.push('Alias'); tE.ent.push(normaliser('Alias')); tE.data.forEach(function (l) { l.push(''); });
    }
    if (c.alias >= 0) chE.poser(A.i, c.alias, fusCumul_(fusCumul_(lA[c.alias], B.nom), aliasB));
    bilan.etablissements++;
  }
  if (lB) { chE.retirer(B.i); bilan.etablissements++; }
  // référence de la fiche gardée après complétion
  var ref = { nom: A.nom, commune: lA ? fusTxt_(lA[c.com]) : A.commune || communeB, quartier: lA ? fusTxt_(lA[c.quart]) : '', zone: lA && c.zone >= 0 ? fusTxt_(lA[c.zone]) : '',
              lat: lA && c.lat >= 0 ? lA[c.lat] : '', lon: lA && c.lon >= 0 ? lA[c.lon] : '', ori: lA && c.ori >= 0 ? fusTxt_(lA[c.ori]) : '', rep: lA && c.rep >= 0 ? fusTxt_(lA[c.rep]) : '' };
  if (!ref.commune) ref.commune = communeB;
  var estB = function (lieu, commune) { return !!nomsB[normaliser(lieu)] && fusCommunesCompatibles_(commune, communeB); };
  var estA = function (lieu, commune) { return normaliser(lieu) === normaliser(A.nom) && fusCommunesCompatibles_(commune, ref.commune); };

  // 2. Lieux d'exercice : renommés, puis un même médecin présent dans les deux réuni sur une seule ligne
  var tP = fusTable_(ss, FEUILLES.presences), idMap = {};
  if (tP) {
    var chP = fusChantier_(tP, 'IdPresence');
    var p = { id: tP.col('IdPresence'), code: tP.col('CodeContact'), lieu: tP.col('Lieu/Etablissement'), quart: tP.col('Quartier'), com: tP.col('Commune'), zone: tP.col('Zone'),
              lat: tP.col('Latitude'), lon: tP.col('Longitude'), ori: tP.col('OrigineGPS'), rep: tP.col('Repères', 'Reperes'), hm: tP.col('HoraireMatin'), hs: tP.col('HoraireSoir') };
    var renommees = {}, groupes = {};
    tP.data.forEach(function (l, i) {
      if (estB(l[p.lieu], l[p.com])) {
        renommees[i] = 1; bilan.presences++;
        chP.poser(i, p.lieu, A.nom);
        if (ref.commune && fusVide_(l[p.com])) chP.poser(i, p.com, ref.commune);
        if (ref.quartier && fusVide_(l[p.quart])) chP.poser(i, p.quart, ref.quartier);
        if (ref.zone && p.zone >= 0 && fusVide_(l[p.zone])) chP.poser(i, p.zone, ref.zone);
        if (p.rep >= 0 && ref.rep && fusVide_(l[p.rep])) chP.poser(i, p.rep, ref.rep);
        // relevé fait sur place conservé ; sinon position de l'établissement gardé
        if (!fusVide_(ref.lat) && p.lat >= 0 && !/terrain/i.test(fusTxt_(l[p.ori]))) { chP.poser(i, p.lat, ref.lat); chP.poser(i, p.lon, ref.lon); if (p.ori >= 0) chP.poser(i, p.ori, ref.ori); }
      }
      if (renommees[i] || estA(l[p.lieu], l[p.com])) { var g = fusTxt_(l[p.code]); (groupes[g] = groupes[g] || []).push(i); }
    });
    Object.keys(groupes).forEach(function (g) {
      var lignes = groupes[g]; if (lignes.length < 2 || !lignes.some(function (k) { return renommees[k]; })) return;
      lignes.sort(function (x, y) { return (renommees[x] ? 1 : 0) - (renommees[y] ? 1 : 0) || x - y; });   // ligne déjà sur le lieu gardé en premier
      var k0 = lignes[0], l0 = tP.data[k0];
      lignes.slice(1).forEach(function (k) {
        var l = tP.data[k];
        JOURS_CLES.forEach(function (j) { var cj = tP.col(j); if (cj >= 0) chP.poser(k0, cj, fusDispo_(l0[cj], l[cj])); });
        tP.brut.forEach(function (h, cc) { if (cc !== p.id && fusVide_(l0[cc]) && !fusVide_(l[cc])) chP.poser(k0, cc, l[cc]); });
        if (p.rep >= 0) chP.poser(k0, p.rep, fusCumul_(l0[p.rep], l[p.rep]));
        idMap[fusTxt_(l[p.id])] = fusTxt_(l0[p.id]);
        chP.retirer(k); bilan.presencesReunies++;
      });
    });
  }

  // 3. Visites et 4. tournées : nom du lieu et identifiant de lieu suivis
  var majRefs = function (nomF, cleEntete, champ) {
    var t = fusTable_(ss, nomF); if (!t) return null;
    var ch = fusChantier_(t, cleEntete), cl = t.col('Lieu/Etablissement'), cc = t.col('Commune'), ci = t.col('IdPresence'), cq = t.col('Quartier');
    t.data.forEach(function (l, i) {
      var touche = false;
      if (cl >= 0 && estB(l[cl], cc >= 0 ? l[cc] : '')) {
        touche = ch.poser(i, cl, A.nom) || touche;
        if (cc >= 0 && ref.commune && fusVide_(l[cc])) ch.poser(i, cc, ref.commune);
        if (cq >= 0 && ref.quartier && fusVide_(l[cq])) ch.poser(i, cq, ref.quartier);
      }
      if (ci >= 0 && idMap[fusTxt_(l[ci])]) touche = ch.poser(i, ci, idMap[fusTxt_(l[ci])]) || touche;
      if (touche) bilan[champ]++;
    });
    return ch;
  };
  var chH = majRefs(FEUILLES.hist, 'IdSync', 'visites'), chT = majRefs(FEUILLES.plannings, 'IdArret', 'tournees');

  var redir = { codes: {}, ids: idMap, lieux: {} };
  Object.keys(nomsB).forEach(function (k) { redir.lieux[k + '|' + normaliser(communeB)] = A.nom; });
  if (B.code && A.code) redir.codes[B.code] = A.code;
  var resume = bilan.presences + ' lieu(x) d\'exercice, ' + bilan.presencesReunies + ' doublon(s) de lieu réuni(s), ' + bilan.visites + ' visite(s), ' + bilan.tournees + ' arrêt(s) de tournée';
  if (o.simulation) return { ok: true, simulation: true, garder: A, absorber: B, bilan: bilan, resume: resume };

  // Écritures : Présences et Établissements (lignes retirées) en dernier
  [chH, chT].forEach(function (ch) { if (ch) fusAppliquer_(ch, idF, journal); });
  if (tP) fusAppliquer_(chP, idF, journal);
  fusAppliquer_(chE, idF, journal);
  fusTerminer_(ss, idF, journal, 'Établissement', A, B, communeB || ref.commune, o.auteur, resume, redir);
  return { ok: true, id: idF, garder: A, absorber: B, bilan: bilan, resume: resume };
}

function fusionnerPharmacies_(ss, o) {
  var tF = fusTable_(ss, FEUILLES.pharmacies);
  if (!tF) return { ok: false, erreur: 'Onglet Pharmacies introuvable.' };
  var c = { code: tF.col('CodeContact'), nom: tF.col('Nom'), com: tF.col('Commune'), lat: tF.col('Latitude'), lon: tF.col('Longitude'), ori: tF.col('OrigineGPS'),
            tel: tF.col('Téléphone', 'Telephone'), rep: tF.col('Repères', 'Reperes'), tit: tF.col('Titulaire'), note: tF.col('Note'), eng: tF.col('Engagé', 'Conventionné'),
            der: tF.col('DateDerniereVisite'), st: tF.col('DernierStatut'), com2: tF.col('DernierCommentaire'), pro: tF.col('ProchaineEtape'),
            nb: tF.col('NbVisites'), act: tF.col('Actif'), src: tF.col('Source'), alias: tF.col('Alias') };
  var A = fusRef_(tF, o.garder, c.code, c.nom, c.com), B = fusRef_(tF, o.absorber, c.code, c.nom, c.com);
  if (!A || !B || A.i < 0 || B.i < 0) return { ok: false, erreur: 'Pharmacie introuvable (' + (!A || A.i < 0 ? JSON.stringify(o.garder) : JSON.stringify(o.absorber)) + ').' };
  if (A.i === B.i) return { ok: false, erreur: 'Les deux fiches sont la même.' };
  if (!fusCommunesCompatibles_(A.commune, B.commune) && !o.forcerCommune)
    return { ok: false, communesDifferentes: true, erreur: 'Communes différentes : ' + A.commune + ' / ' + B.commune + '. Le même nom peut désigner deux pharmacies distinctes.' };

  var idF = fusNouvelId_(), journal = [], bilan = { pharmacies: 2, visites: 0, tournees: 0, presences: 0 };
  var ch = fusChantier_(tF, 'CodeContact'), lA = tF.data[A.i], lB = tF.data[B.i];
  var dA = lA[c.der] instanceof Date ? lA[c.der].getTime() : 0, dB = lB[c.der] instanceof Date ? lB[c.der].getTime() : 0, bPlusRecent = dB > dA;
  var posB = c.lat >= 0 && !fusVide_(lB[c.lat]) && (fusVide_(lA[c.lat]) || (/terrain/i.test(fusTxt_(lB[c.ori])) && !/terrain/i.test(fusTxt_(lA[c.ori]))));
  tF.brut.forEach(function (h, k) {
    if (k === c.code || k === c.nom || k === c.alias) return;
    if ([c.lat, c.lon, c.ori].indexOf(k) >= 0) { if (posB) ch.poser(A.i, k, lB[k]); return; }
    if (k === c.tel) return ch.poser(A.i, k, fusTel_(lA[k], lB[k]));
    if (k === c.rep || k === c.src) return ch.poser(A.i, k, fusCumul_(lA[k], lB[k]));
    if (k === c.tit) return ch.poser(A.i, k, fusCumul_(lA[k], lB[k], ' / '));
    if (k === c.note) { var na = +lA[k] || 0, nb = +lB[k] || 0; if (nb > na) ch.poser(A.i, k, lB[k]); return; }
    if (k === c.eng || k === c.act) { if (!fusOui_(lA[k]) && fusOui_(lB[k])) ch.poser(A.i, k, lB[k]); return; }
    if (k === c.nb) return ch.poser(A.i, k, (+lA[k] || 0) + (+lB[k] || 0));
    if (k === c.der) { if (bPlusRecent) ch.poser(A.i, k, lB[k]); return; }
    if ((k === c.st || k === c.com2 || k === c.pro) && bPlusRecent) return ch.poser(A.i, k, lB[k]);
    if (fusVide_(lA[k]) && !fusVide_(lB[k])) ch.poser(A.i, k, lB[k]);
  });
  if (c.alias < 0 && !o.simulation) {
    c.alias = tF.brut.length;
    tF.sh.getRange(1, c.alias + 1).setValue('Alias').setFontWeight('bold');
    tF.brut.push('Alias'); tF.ent.push(normaliser('Alias')); tF.data.forEach(function (l) { l.push(''); });
  }
  if (c.alias >= 0) ch.poser(A.i, c.alias, fusCumul_(fusCumul_(lA[c.alias], B.nom + ' [' + B.code + ']'), lB[c.alias]));
  ch.retirer(B.i);

  // visites, tournées (et lieux d'exercice éventuels) : code, identifiant de lieu « P-code » et nom suivis
  var idB = 'P-' + B.code, idA = 'P-' + A.code;
  var majRefs = function (nomF, cleEntete, champ) {
    var t = fusTable_(ss, nomF); if (!t) return null;
    var chR = fusChantier_(t, cleEntete), cc = t.col('CodeContact'), ci = t.col('IdPresence'), cn = t.col('Nom'), cl = t.col('Lieu/Etablissement');
    t.data.forEach(function (l, i) {
      var toucheCode = fusTxt_(l[cc]) === B.code, touche = false;
      if (toucheCode) touche = chR.poser(i, cc, A.code) || touche;
      if (ci >= 0 && fusTxt_(l[ci]) === idB) touche = chR.poser(i, ci, idA) || touche;
      if (toucheCode && cn >= 0 && normaliser(l[cn]) === normaliser(B.nom)) chR.poser(i, cn, A.nom);
      if (toucheCode && cl >= 0 && normaliser(l[cl]) === normaliser(B.nom)) chR.poser(i, cl, A.nom);
      if (touche || toucheCode) bilan[champ]++;
    });
    return chR;
  };
  var chH = majRefs(FEUILLES.hist, 'IdSync', 'visites'), chT = majRefs(FEUILLES.plannings, 'IdArret', 'tournees'), chP = majRefs(FEUILLES.presences, 'IdPresence', 'presences');
  var redir = { codes: {}, ids: {}, lieux: {} };
  redir.codes[B.code] = A.code; redir.ids[idB] = idA;
  var resume = bilan.visites + ' visite(s), ' + bilan.tournees + ' arrêt(s) de tournée' + (bilan.presences ? ', ' + bilan.presences + ' lieu(x)' : '');
  if (o.simulation) return { ok: true, simulation: true, garder: A, absorber: B, bilan: bilan, resume: resume };
  [chH, chT, chP].forEach(function (x) { if (x) fusAppliquer_(x, idF, journal); });
  fusAppliquer_(ch, idF, journal);
  fusTerminer_(ss, idF, journal, 'Pharmacie', A, B, A.commune || B.commune, o.auteur, resume, redir);
  return { ok: true, id: idF, garder: A, absorber: B, bilan: bilan, resume: resume };
}

function fusTerminer_(ss, idF, journal, type, A, B, commune, auteur, resume, redir) {
  var shJ = fusJournalFeuille_(ss);
  if (journal.length) shJ.getRange(shJ.getLastRow() + 1, 1, journal.length, 7).setNumberFormat('@').setValues(journal.map(function (l) { return l.map(String); }));
  var shF = fusFusionsFeuille_(ss);
  shF.getRange(shF.getLastRow() + 1, 1, 1, FUSION_ENTETES.length).setValues([[new Date(), idF, type, A.code, A.nom, B.code, B.nom, commune || '', auteur || fusAuteur_(), resume, 'Active', JSON.stringify(redir)]]);
  enregistrerAudit(ss, auteur || fusAuteur_(), 'FUSION_' + (type === 'Pharmacie' ? 'PHARMACIE' : 'ETABLISSEMENT'), type, A.code || A.nom,
    '« ' + B.nom + ' »' + (B.code ? ' [' + B.code + ']' : '') + ' fusionné dans « ' + A.nom + ' » : ' + resume + ' (' + idF + ')');
}
function fusAuteur_() { try { return Session.getActiveUser().getEmail() || 'Administrateur'; } catch (e) { return 'Administrateur'; } }

// ---------------------------------------------------------------- Annulation
function annulerFusion_(idF, auteur) {
  var lock = verrouiller();
  try {
    var ss = SpreadsheetApp.getActive(), tF = fusTable_(ss, FUSION_FEUILLE), tJ = fusTable_(ss, FUSION_JOURNAL);
    if (!tF) return { ok: false, erreur: 'Aucune fusion enregistrée.' };
    var cId = tF.col('IdFusion'), cE = tF.col('Etat'), iF = -1;
    tF.data.forEach(function (l, i) { if (fusTxt_(l[cId]) === idF) iF = i; });
    if (iF < 0) return { ok: false, erreur: 'Fusion ' + idF + ' introuvable.' };
    if (normaliser(tF.data[iF][cE]) !== 'active') return { ok: false, erreur: 'Fusion ' + idF + ' déjà annulée.' };
    var lignes = tJ ? tJ.data.filter(function (l) { return fusTxt_(l[0]) === idF; }) : [];
    var bilan = { cellules: 0, lignes: 0, conflits: 0 }, tables = {};
    var table = function (nom) { return tables[nom] || (tables[nom] = fusTable_(ss, nom)); };
    // lignes retirées d'abord (remises à la fin de leur onglet), puis cellules restaurées
    lignes.filter(function (l) { return l[2] === 'ligne'; }).forEach(function (l) {
      var t = table(l[1]); if (!t) return;
      var o = JSON.parse(l[6]), cle = l[3] ? t.col(l[3]) : -1;
      if (cle >= 0 && l[4] && t.data.some(function (x) { return fusTxt_(x[cle]) === String(l[4]); })) { bilan.conflits++; return; }
      Object.keys(o).forEach(function (h) {   // colonne absente depuis : recréée
        if (t.brut.indexOf(h) < 0) { t.sh.getRange(1, t.brut.length + 1).setValue(h).setFontWeight('bold'); t.brut.push(h); t.ent.push(normaliser(h)); t.data.forEach(function (x) { x.push(''); }); }
      });
      var v = t.brut.map(function (h) { return h in o ? fusDec_(o[h]) : ''; });
      t.sh.getRange(t.sh.getLastRow() + 1, 1, 1, v.length).setValues([v]);
      t.data.push(v); t.n++;
      bilan.lignes++;
    });
    var parTable = {};
    lignes.filter(function (l) { return l[2] === 'cellules'; }).forEach(function (l) {
      var t = table(l[1]); if (!t) return;
      var cle = l[3] ? t.col(l[3]) : -1, i = -1;
      if (cle >= 0 && l[4]) t.data.forEach(function (x, k) { if (i < 0 && fusTxt_(x[cle]) === String(l[4])) i = k; });
      if (i < 0 && !(cle >= 0 && l[4])) i = +l[5] - 2;
      if (i < 0 || i >= t.data.length) { bilan.conflits++; return; }
      JSON.parse(l[6]).forEach(function (x) {
        var cc = t.brut.indexOf(x[0]); if (cc < 0) { bilan.conflits++; return; }
        // une cellule modifiée depuis la fusion (ex. nouvelle visite) n'est pas écrasée
        if (fusEnc_(t.data[i][cc]) !== x[2]) { bilan.conflits++; return; }
        t.data[i][cc] = fusDec_(x[1]); bilan.cellules++;
        (parTable[l[1]] = parTable[l[1]] || {})[cc] = 1;
      });
    });
    Object.keys(parTable).forEach(function (nom) {
      var t = tables[nom];
      Object.keys(parTable[nom]).forEach(function (cc) { cc = +cc; t.sh.getRange(2, cc + 1, t.data.length, 1).setValues(t.data.map(function (x) { return [x[cc]]; })); });
    });
    tF.sh.getRange(iF + 2, cE + 1).setValue('Annulée');
    enregistrerAudit(ss, auteur || fusAuteur_(), 'ANNULATION_FUSION', fusTxt_(tF.data[iF][tF.col('Type')]), fusTxt_(tF.data[iF][tF.col('CodeGarde')]),
      idF + ' annulée : ' + bilan.lignes + ' ligne(s) remise(s), ' + bilan.cellules + ' cellule(s) restaurée(s)' + (bilan.conflits ? ', ' + bilan.conflits + ' modifiée(s) depuis, laissée(s) telle(s) quelle(s)' : ''));
    fusOublierRedirections_();
    marquerModif();
    try { jumPousserApresEcriture_('fusion'); } catch (e) { console.warn('Jumelage après annulation : ' + e); }
    return { ok: true, id: idF, bilan: bilan };
  } finally { lock.releaseLock(); }
}

// ---------------------------------------------------------------- Détection des doublons probables
// Nom réduit à ses mots distinctifs : sans accents, sans mots génériques (clinique, pharmacie, centre…)
// et sans noms de communes (sinon « INSP Adjamé » et « CAT Adjamé » se ressembleraient)
var FUS_MOTS_VIDES = { pharmacie: 1, pharma: 1, officine: 1, depot: 1, pharmaceutique: 1, clinique: 1, polyclinique: 1, centre: 1, medical: 1, medicale: 1, medicaux: 1,
  cabinet: 1, hopital: 1, sante: 1, service: 1, consultation: 1, nouvelle: 1, nouveau: 1, grande: 1, petite: 1, saint: 1, sainte: 1,
  les: 1, des: 1, del: 1, dela: 1, aux: 1, sur: 1, abidjan: 1, cote: 1, ivoire: 1, groupe: 1, espace: 1, the: 1, and: 1 };
function fusMots_(s, vides) {
  var t = sansAccents(String(s || '').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae')).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  var vus = {};
  return t.split(' ').filter(function (w) { if (w.length < 3 || vides[w] || FUS_MOTS_VIDES[w] || vus[w]) return false; vus[w] = 1; return true; });
}
// Ressemblance de deux noms : '' (aucune), ou la raison
function fusRessemblance_(na, nb, d, vides, rayonInclus, rayonProche) {
  var wa = fusMots_(na, vides), wb = fusMots_(nb, vides);
  if (!wa.length || !wb.length) return '';
  var ka = wa.slice().sort().join(' '), kb = wb.slice().sort().join(' ');
  if (ka === kb) return 'Mêmes mots distinctifs';
  var communs = wa.filter(function (w) { return wb.indexOf(w) >= 0; });
  var petit = wa.length <= wb.length ? wa : wb;
  var proche = function (r) { return d === null || d <= r; };
  if (communs.length === petit.length && petit.some(function (w) { return w.length >= 4; }) && proche(rayonInclus)) return 'Nom inclus dans l\'autre' + (d !== null ? ' (' + d + ' m)' : '');
  var jac = communs.length / (wa.length + wb.length - communs.length);
  if (jac >= 0.6 && communs.some(function (w) { return w.length >= 4; }) && proche(rayonProche)) return 'Noms proches' + (d !== null ? ' (' + d + ' m)' : '');
  return '';
}
function fusDist_(a, b) {
  var la = nombre6(a.lat), lo = nombre6(a.lon), lb = nombre6(b.lat), lob = nombre6(b.lon);
  if (!isFinite(la) || !isFinite(lo) || !isFinite(lb) || !isFinite(lob) || !la || !lb) return null;
  var rad = Math.PI / 180, h = Math.pow(Math.sin((lb - la) * rad / 2), 2) + Math.cos(la * rad) * Math.cos(lb * rad) * Math.pow(Math.sin((lob - lo) * rad / 2), 2);
  return Math.round(2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));   // vol d'oiseau, en mètres
}

// Liste les doublons probables dans l'onglet « Doublons à fusionner » ; la colonne Décision dit quoi faire
function detecterDoublons() {
  var ss = SpreadsheetApp.getActive(), R = fusRedirections_(), paires = [];
  // mots des noms de communes et de quartiers : jamais distinctifs
  var vides = {};
  var ajouterVides = function (v) { fusMots_(v, {}).forEach(function (w) { vides[w] = 1; }); };
  var tQ = fusTable_(ss, FEUILLES.quartiers);
  if (tQ) tQ.data.forEach(function (l) { ajouterVides(l[0]); });
  // usage : lieux d'exercice par nom de lieu (établissements), visites par code (pharmacies)
  var usageLieu = {}, usageCode = {}, lieuxPres = {};
  var tP = fusTable_(ss, FEUILLES.presences);
  if (tP) {
    var pl = tP.col('Lieu/Etablissement'), pc = tP.col('Commune'), pla = tP.col('Latitude'), plo = tP.col('Longitude');
    tP.data.forEach(function (l) {
      ajouterVides(l[pc]);
      var k = normaliser(l[pl]); if (!k) return;
      usageLieu[k] = (usageLieu[k] || 0) + 1;
      var kc = k + '|' + normaliser(l[pc]);
      if (!lieuxPres[kc]) lieuxPres[kc] = { code: '', nom: fusTxt_(l[pl]), commune: fusTxt_(l[pc]), lat: l[pla], lon: l[plo], usage: 0 };
      lieuxPres[kc].usage++;
    });
  }
  var tH = fusTable_(ss, FEUILLES.hist);
  if (tH) { var hc = tH.col('CodeContact'); tH.data.forEach(function (l) { var k = fusTxt_(l[hc]); usageCode[k] = (usageCode[k] || 0) + 1; }); }

  // Établissements (fiches + noms de lieux sans fiche)
  var tE = fusTable_(ss, FEUILLES.etablissements), etabs = [];
  if (tE) {
    var e = { code: tE.col('CodeEtab'), nom: tE.col('Nom'), com: tE.col('Commune'), lat: tE.col('Latitude'), lon: tE.col('Longitude'), alias: tE.col('Alias') };
    tE.data.forEach(function (l) { ajouterVides(l[e.com]); });
    tE.data.forEach(function (l) {
      var x = { code: fusTxt_(l[e.code]), nom: fusTxt_(l[e.nom]), commune: fusTxt_(l[e.com]), lat: l[e.lat], lon: l[e.lon], usage: usageLieu[normaliser(l[e.nom])] || 0 };
      if (!x.nom) return;
      etabs.push(x);
      [x.nom].concat(e.alias >= 0 ? fusTxt_(l[e.alias]).split(/\s*;\s*/) : []).forEach(function (n) {
        Object.keys(lieuxPres).forEach(function (kc) { if (kc.split('|')[0] === normaliser(n) && fusCommunesCompatibles_(lieuxPres[kc].commune, x.commune)) delete lieuxPres[kc]; });
      });
    });
    Object.keys(lieuxPres).forEach(function (kc) { if (!R.lieux[kc] && !R.lieux[kc.split('|')[0] + '|']) etabs.push(lieuxPres[kc]); });
    for (var i = 0; i < etabs.length; i++) for (var j = i + 1; j < etabs.length; j++) {
      var a = etabs[i], b = etabs[j];
      if (!a.code && !b.code) continue;                                   // deux noms sans fiche : rattachés chacun à une fiche
      if (normaliser(a.commune) !== normaliser(b.commune)) continue;      // autre commune (ou commune inconnue) : jamais proposé
      if (R.distincts[(a.code || a.nom) + '|' + (b.code || b.nom)]) continue;
      var d = fusDist_(a, b), raison = fusRessemblance_(a.nom, b.nom, d, vides, 1000, 300);
      if (raison) paires.push(['Établissement', a, b, d, raison]);
    }
  }

  // Pharmacies
  var tF = fusTable_(ss, FEUILLES.pharmacies);
  if (tF) {
    var f = { code: tF.col('CodeContact'), nom: tF.col('Nom'), com: tF.col('Commune'), lat: tF.col('Latitude'), lon: tF.col('Longitude'), tel: tF.col('Téléphone', 'Telephone') };
    tF.data.forEach(function (l) { ajouterVides(l[f.com]); });
    var phs = tF.data.map(function (l) {
      return { code: fusTxt_(l[f.code]), nom: fusTxt_(l[f.nom]), commune: fusTxt_(l[f.com]), lat: l[f.lat], lon: l[f.lon], usage: usageCode[fusTxt_(l[f.code])] || 0,
               tels: (formaterTelephoneCI(fusTxt_(l[f.tel])) || '').split(/\s*\/\s*/).map(function (t) { return t.replace(/\D/g, '').slice(-8); }).filter(function (t) { return t.length === 8; }) };
    }).filter(function (x) { return x.code && x.nom; });
    // un numéro partagé par plus de deux pharmacies (standard, ordre…) ne prouve rien
    var freq = {};
    phs.forEach(function (x) { x.tels.forEach(function (t) { freq[t] = (freq[t] || 0) + 1; }); });
    var parCommune = {};
    phs.forEach(function (x) { var k = normaliser(x.commune); if (k) (parCommune[k] = parCommune[k] || []).push(x); });
    Object.keys(parCommune).forEach(function (k) {
      var L = parCommune[k];
      for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
        var a = L[i], b = L[j];
        if (R.distincts[a.code + '|' + b.code]) continue;
        var d = fusDist_(a, b), raison = fusRessemblance_(a.nom, b.nom, d, vides, 500, 200);
        if (!raison && a.tels.some(function (t) { return freq[t] === 2 && b.tels.indexOf(t) >= 0; }) && (d === null || d <= 1500)) raison = 'Même téléphone' + (d !== null ? ' (' + d + ' m)' : '');
        if (raison) paires.push(['Pharmacie', a, b, d, raison]);
      }
    });
  }

  // fiche la plus utilisée proposée en A (à garder)
  var lignes = paires.map(function (p) {
    var a = p[1], b = p[2];
    if ((b.code && !a.code) || ((!!a.code === !!b.code) && b.usage > a.usage)) { var t = a; a = b; b = t; }
    return ['', p[0], a.code, a.nom, a.commune, a.usage, b.code, b.nom, b.commune, b.usage, p[3] === null ? '' : p[3], p[4]];
  });
  var sh = ss.getSheetByName(FUSION_PROPOSITIONS);
  if (sh) sh.clear(); else sh = ss.insertSheet(FUSION_PROPOSITIONS);
  var ent = ['Décision', 'Type', 'A Code', 'A Nom (à garder)', 'A Commune', 'A Usage', 'B Code', 'B Nom (à fondre)', 'B Commune', 'B Usage', 'Distance (m)', 'Raison'];
  sh.getRange(1, 1, 1, ent.length).setValues([ent]).setFontWeight('bold').setBackground(COULEUR_ENTETE).setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  if (lignes.length) {
    sh.getRange(2, 1, lignes.length, ent.length).setValues(lignes);
    sh.getRange(2, 1, lignes.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(FUSION_DECISIONS, true).setAllowInvalid(true).build());
  }
  try { sh.autoResizeColumns(1, ent.length); } catch (e) {}
  return { ok: true, paires: lignes.length };
}

// Applique les décisions de l'onglet « Doublons à fusionner » (Garder A, Garder B, Différents)
function appliquerDecisionsDoublons_(auteur) {
  var ss = SpreadsheetApp.getActive(), t = fusTable_(ss, FUSION_PROPOSITIONS);
  if (!t) return { ok: false, erreur: 'Lancez d\'abord la détection des doublons.' };
  var cD = t.col('Décision'), cT = t.col('Type'), cAc = t.col('A Code'), cAn = t.col('A Nom (à garder)'), cAm = t.col('A Commune'),
      cBc = t.col('B Code'), cBn = t.col('B Nom (à fondre)'), cBm = t.col('B Commune');
  var faites = 0, distincts = 0, erreurs = [], debut = Date.now();
  t.data.forEach(function (l, i) {
    var dec = normaliser(l[cD]);
    if (!dec || /^fait|^erreur|^note/.test(dec)) return;
    if (Date.now() - debut > 280000) return;                    // limite de 6 min d'Apps Script : relancer pour la suite
    var a = { code: fusTxt_(l[cAc]), nom: fusTxt_(l[cAn]), commune: fusTxt_(l[cAm]) }, b = { code: fusTxt_(l[cBc]), nom: fusTxt_(l[cBn]), commune: fusTxt_(l[cBm]) };
    var Rd = fusRedirections_(), ref = function (x) { return x.code ? fusSuivre_(Rd.codes, x.code) : { nom: x.nom, commune: x.commune }; };
    var res;
    if (dec === normaliser('Différents')) {
      var shF = fusFusionsFeuille_(ss);
      shF.getRange(shF.getLastRow() + 1, 1, 1, FUSION_ENTETES.length).setValues([[new Date(), fusNouvelId_(), fusTxt_(l[cT]), a.code || a.nom, a.nom, b.code || b.nom, b.nom, a.commune, auteur || fusAuteur_(), 'Fiches distinctes (ne plus proposer)', 'Distincts', '']]);
      fusOublierRedirections_();
      t.sh.getRange(i + 2, cD + 1).setValue('Noté : différents'); distincts++; return;
    }
    var garderB = dec === normaliser('Garder B');
    res = fusionner({ type: normaliser(l[cT]) === 'pharmacie' ? 'pharmacie' : 'etablissement', garder: ref(garderB ? b : a), absorber: ref(garderB ? a : b),
      auteur: auteur, sansJumelage: true });
    if (res.ok) { faites++; t.sh.getRange(i + 2, cD + 1).setValue('Fait (' + res.id + ')'); }
    else if (/la même/.test(res.erreur || '')) t.sh.getRange(i + 2, cD + 1).setValue('Fait (déjà réunies)');
    else { erreurs.push((a.nom || a.code) + ' / ' + (b.nom || b.code) + ' : ' + res.erreur); t.sh.getRange(i + 2, cD + 1).setValue('Erreur : ' + res.erreur); }
  });
  if (faites) { try { jumPousserApresEcriture_('fusion'); } catch (e) { console.warn('Jumelage après fusions : ' + e); } }
  return { ok: true, faites: faites, distincts: distincts, erreurs: erreurs };
}

// ---------------------------------------------------------------- Menu
function menuDetecterDoublons() {
  var ui = SpreadsheetApp.getUi(), r = detecterDoublons();
  SpreadsheetApp.getActive().setActiveSheet(SpreadsheetApp.getActive().getSheetByName(FUSION_PROPOSITIONS));
  ui.alert('Doublons probables', r.paires + ' paire(s) trouvée(s).\n\nDans la colonne « Décision », choisissez :\n• Garder A : B est fondu dans A\n• Garder B : A est fondu dans B\n• Différents : ne plus proposer cette paire\n\nPuis MediPlanner > Doublons > Appliquer les décisions.\nLe même nom dans deux communes n\'est jamais proposé.', ui.ButtonSet.OK);
}
function menuAppliquerDecisions() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Appliquer les décisions', 'Les fusions choisies vont être faites. Chacune reste annulable (MediPlanner > Doublons > Annuler une fusion). Continuer ?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var r = appliquerDecisionsDoublons_();
  ui.alert('Fusions', r.ok ? (r.faites + ' fusion(s) faite(s), ' + r.distincts + ' paire(s) notée(s) différente(s).' + (r.erreurs.length ? '\n\nNon faites :\n' + r.erreurs.slice(0, 10).join('\n') : '')) : r.erreur, ui.ButtonSet.OK);
}
// Deux lignes sélectionnées dans Etablissements ou Pharmacies (Ctrl + clic sur les numéros de ligne)
function menuFusionnerSelection() {
  var ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet(), nomF = sh.getName();
  var type = nomF === FEUILLES.pharmacies ? 'pharmacie' : (nomF === FEUILLES.etablissements ? 'etablissement' : '');
  if (!type) return ui.alert('Fusionner', 'Ouvrez l\'onglet Etablissements ou Pharmacies et sélectionnez les deux lignes à fusionner (Ctrl + clic).', ui.ButtonSet.OK);
  var rangs = [];
  (ss.getActiveRangeList() ? ss.getActiveRangeList().getRanges() : [sh.getActiveRange()]).forEach(function (r) {
    for (var k = 0; k < r.getNumRows(); k++) { var n = r.getRow() + k; if (n > 1 && rangs.indexOf(n) < 0) rangs.push(n); }
  });
  if (rangs.length !== 2) return ui.alert('Fusionner', 'Sélectionnez exactement deux lignes (' + rangs.length + ' sélectionnée(s)).', ui.ButtonSet.OK);
  var t = fusTable_(ss, nomF), cC = t.col(type === 'pharmacie' ? 'CodeContact' : 'CodeEtab'), cN = t.col('Nom'), cM = t.col('Commune');
  var x = rangs.map(function (n) { var l = t.data[n - 2]; return { code: fusTxt_(l[cC]), nom: fusTxt_(l[cN]), commune: fusTxt_(l[cM]) }; });
  var rep = ui.alert('Quelle fiche garder ?', 'Oui : garder « ' + x[0].nom + ' » (' + x[0].commune + ')\nNon : garder « ' + x[1].nom + ' » (' + x[1].commune + ')\n\nL\'autre fiche y sera fondue, sans perte.', ui.ButtonSet.YES_NO_CANCEL);
  if (rep !== ui.Button.YES && rep !== ui.Button.NO) return;
  var A = rep === ui.Button.YES ? x[0] : x[1], B = rep === ui.Button.YES ? x[1] : x[0];
  var o = { type: type, garder: A.code, absorber: B.code, simulation: true };
  var s = fusionner(o);
  if (!s.ok && s.communesDifferentes) {
    if (ui.alert('Communes différentes', s.erreur + '\n\nFusionner quand même ?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    o.forcerCommune = true; s = fusionner(o);
  }
  if (!s.ok) return ui.alert('Fusion impossible', s.erreur, ui.ButtonSet.OK);
  if (ui.alert('Confirmer la fusion', '« ' + B.nom + ' » sera fondu dans « ' + A.nom + ' ».\n\nÀ mettre à jour : ' + s.resume + '.\n\nAnnulable ensuite. Continuer ?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  o.simulation = false;
  var r = fusionner(o);
  ui.alert('Fusion', r.ok ? 'Fusion faite (' + r.id + ') : ' + r.resume + '.' : r.erreur, ui.ButtonSet.OK);
}
function menuAnnulerFusion() {
  var ui = SpreadsheetApp.getUi(), t = fusTable_(SpreadsheetApp.getActive(), FUSION_FEUILLE);
  var actives = t ? t.data.filter(function (l) { return normaliser(l[t.col('Etat')]) === 'active'; }) : [];
  if (!actives.length) return ui.alert('Annuler une fusion', 'Aucune fusion active.', ui.ButtonSet.OK);
  var liste = actives.slice(-8).reverse().map(function (l) { return fusTxt_(l[t.col('IdFusion')]) + ' : « ' + fusTxt_(l[t.col('NomAbsorbe')]) + ' » dans « ' + fusTxt_(l[t.col('NomGarde')]) + ' »'; }).join('\n');
  var rep = ui.prompt('Annuler une fusion', 'Identifiant de la fusion à annuler (onglet « Fusions ») :\n\n' + liste, ui.ButtonSet.OK_CANCEL);
  if (rep.getSelectedButton() !== ui.Button.OK) return;
  var r = annulerFusion_(String(rep.getResponseText()).trim());
  ui.alert('Annulation', r.ok ? 'Fusion annulée : ' + r.bilan.lignes + ' ligne(s) remise(s), ' + r.bilan.cellules + ' cellule(s) restaurée(s)' + (r.bilan.conflits ? ', ' + r.bilan.conflits + ' modifiée(s) depuis la fusion, laissée(s) telle(s) quelle(s).' : '.') : r.erreur, ui.ButtonSet.OK);
}
