/* =============================================================================
   Jumelage.gs : Google Sheets (base principale) -> Supabase (base jumelle)
   - Une seule règle : Supabase reçoit exactement le contenu du Sheet.
   - Toutes les 5 minutes, chaque onglet modifié est recopié (ajouts, modifications
     et suppressions). Un onglet inchangé n'est pas renvoyé (empreinte MD5).
   - Couvre tout : saisies de l'application, modifications à la main dans le Sheet,
     corrections faites par le serveur ou par script.
   - En cas d'échec (réseau, Supabase indisponible), l'onglet est retenté au tour suivant.
   - État consultable : propriété SUPA_ETAT, renvoyée par l'action « jumelage ».
   Mise en route : exécuter une fois installerJumelage() depuis l'éditeur.
   ============================================================================= */

// À lancer une fois depuis l'éditeur : installe le déclencheur et fait la première recopie complète
function installerJumelage() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'jumelageAuto') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'jumSurEdition') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('jumelageAuto').timeBased().everyMinutes(JUMELAGE_MINUTES).create();
  // saisie à la main dans le Sheet : envoyée à Supabase dans les secondes qui suivent
  ScriptApp.newTrigger('jumSurEdition').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  return synchroniserSupabase(true);
}

var JUMELAGE_MINUTES = 5;

function jumCfg_() {
  var p = PropertiesService.getScriptProperties();
  return {
    url: (p.getProperty('SUPABASE_URL') || 'https://nldyinokqgshnzvdsxgr.supabase.co').replace(/\/+$/, ''),
    key: p.getProperty('SUPABASE_KEY') || 'sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL'
  };
}

function jumReq_(methode, chemin, payload, prefer) {
  var c = jumCfg_();
  var o = { method: methode, muteHttpExceptions: true, headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'x-mediplanner': 'sheets' } };
  if (prefer) o.headers.Prefer = prefer;
  if (payload !== undefined) { o.contentType = 'application/json; charset=utf-8'; o.payload = JSON.stringify(payload); }
  var r = UrlFetchApp.fetch(c.url + '/rest/v1/' + chemin, o);
  return { code: r.getResponseCode(), texte: r.getContentText() };
}

function jumOk_(r, quoi) {
  if (r.code >= 200 && r.code < 300) return;
  throw new Error(quoi + ' : HTTP ' + r.code + ' ' + String(r.texte).slice(0, 300));
}

// Lecture paginée de toute une table Supabase (colonnes choisies)
function jumLireSupabase_(table, cols) {
  var tout = [], pas = 1000;
  for (var off = 0; off < 100000; off += pas) {
    var r = jumReq_('get', table + '?select=' + encodeURIComponent(cols) + '&limit=' + pas + '&offset=' + off);
    jumOk_(r, 'Lecture ' + table);
    var l = JSON.parse(r.texte);
    tout = tout.concat(l);
    if (l.length < pas) break;
  }
  return tout;
}

// ---------------------------------------------------------------- Lecture du Sheet
function jumFeuille_(nom) {
  var sh = SpreadsheetApp.getActive().getSheetByName(nom);
  if (!sh || sh.getLastColumn() < 1) return null;
  var nc = sh.getLastColumn();
  var ent = sh.getRange(1, 1, 1, nc).getValues()[0].map(normaliser);
  var vals = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues() : [];
  return {
    lignes: vals,
    col: function (noms) {   // index de la première en-tête trouvée parmi plusieurs libellés
      for (var i = 0; i < noms.length; i++) { var k = ent.indexOf(normaliser(noms[i])); if (k >= 0) return k; }
      return -1;
    }
  };
}
function jumTxt_(v) { if (v === null || v === undefined) return ''; if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'); return String(v).trim(); }
function jumNum_(v) { var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; }
function jumInt_(v, def) { var n = parseInt(v, 10); return isFinite(n) ? n : (def === undefined ? null : def); }
function jumNote_(v) { var n = jumInt_(v, 2); return Math.max(1, Math.min(3, n)); }
function jumOui_(v) { return estConventionne(v); }
function jumActif_(v) { return normaliser(v) !== 'non'; }
function jumDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var s = String(v || '').trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return null;
}
function jumHoro_(v) { if (v instanceof Date) return v.toISOString(); var s = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s : null; }
// téléphone tel quel (colonnes Supabase en texte libre depuis 3.28.11)
function jumTel_(v) { return jumTxt_(v); }
function jumVide_(v) { var s = jumTxt_(v); return s === '' ? null : s; }

// Chaque table : lignes du Sheet converties au format Supabase
function jumLignes_(table) {
  var f, c, out = [];
  var get = function (l, k) { return k >= 0 ? l[k] : ''; };
  switch (table) {
    case 'praticiens':
      f = jumFeuille_(FEUILLES.praticiens); if (!f) return null;
      c = { code: f.col(['CodeContact']), type: f.col(['Type']), nom: f.col(['Nom']), spec: f.col(['Spécialité']), note: f.col(['Note']), conv: f.col(['Engagé', 'Conventionné']),
        tel: f.col(['Téléphone']), der: f.col(['DateDerniereVisite']), st: f.col(['DernierStatut']), com: f.col(['DernierCommentaire']), nb: f.col(['NbVisites']), act: f.col(['Actif']),
        pro: f.col(['ProchaineEtape']), adu: f.col(['AbsentDu']), aau: f.col(['AbsentAu']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code)), nom = jumTxt_(get(l, c.nom)); if (!code || !nom) return;
        out.push({ prochaine: jumTxt_(get(l, c.pro)), absent_du: jumDate_(get(l, c.adu)), absent_au: jumDate_(get(l, c.aau)), code: code, type: jumTxt_(get(l, c.type)) || 'Médecin', nom: nom, specialite: jumTxt_(get(l, c.spec)), note: jumNote_(get(l, c.note)),
          conventionne: jumOui_(get(l, c.conv)), telephone: jumTel_(get(l, c.tel)), derniere: jumDate_(get(l, c.der)), statut: jumVide_(get(l, c.st)),
          commentaire: jumVide_(get(l, c.com)), nb_visites: jumInt_(get(l, c.nb), 0), actif: jumActif_(get(l, c.act)) });
      });
      return out;
    case 'presences':
      f = jumFeuille_(FEUILLES.presences); if (!f) return null;
      c = { id: f.col(['IdPresence']), code: f.col(['CodeContact']), nom: f.col(['Nom']), lieu: f.col(['Lieu/Etablissement']), q: f.col(['Quartier']), co: f.col(['Commune']), z: f.col(['Zone']),
        j: JOURS_CLES.map(function (j) { return f.col([j]); }), hm: f.col(['HoraireMatin']), hs: f.col(['HoraireSoir']), la: f.col(['Latitude']), lo: f.col(['Longitude']), rep: f.col(['Repères']), se: f.col(['Secteur']), og: f.col(['OrigineGPS']) };
      f.lignes.forEach(function (l) {
        var id = jumTxt_(get(l, c.id)), code = jumTxt_(get(l, c.code)); if (!id || !code) return;
        var o = { id: id, code: code, nom: jumTxt_(get(l, c.nom)), lieu: jumTxt_(get(l, c.lieu)), quartier: jumTxt_(get(l, c.q)), commune: jumTxt_(get(l, c.co)), zone: jumTxt_(get(l, c.z)),
          horaire_matin: jumTxt_(get(l, c.hm)), horaire_soir: jumTxt_(get(l, c.hs)), lat: jumNum_(get(l, c.la)), lon: jumNum_(get(l, c.lo)), reperes: jumTxt_(get(l, c.rep)), secteur: jumTxt_(get(l, c.se)), origine_gps: jumTxt_(get(l, c.og)) };
        JOURS_CLES.forEach(function (j, k) { o[j] = jumTxt_(get(l, c.j[k])); });
        out.push(o);
      });
      return out;
    case 'pharmacies':
      f = jumFeuille_(FEUILLES.pharmacies); if (!f) return null;
      c = { code: f.col(['CodeContact']), nom: f.col(['Nom']), tit: f.col(['Titulaire']), q: f.col(['Quartier']), co: f.col(['Commune']), z: f.col(['Zone']), la: f.col(['Latitude']), lo: f.col(['Longitude']),
        tel: f.col(['Téléphone']), hm: f.col(['HoraireMatin']), hs: f.col(['HoraireSoir']), note: f.col(['Note']), conv: f.col(['Engagé']), der: f.col(['DateDerniereVisite']), st: f.col(['DernierStatut']),
        com: f.col(['DernierCommentaire']), nb: f.col(['NbVisites']), act: f.col(['Actif']),
        rep: f.col(['Repères']), pro: f.col(['ProchaineEtape']), src: f.col(['Source']), og: f.col(['OrigineGPS']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code)), nom = jumTxt_(get(l, c.nom)); if (!code || !nom) return;
        out.push({ reperes: jumTxt_(get(l, c.rep)), prochaine: jumTxt_(get(l, c.pro)), source: jumTxt_(get(l, c.src)), origine_gps: jumTxt_(get(l, c.og)), code: code, nom: nom, titulaire: jumTxt_(get(l, c.tit)), quartier: jumTxt_(get(l, c.q)), commune: jumTxt_(get(l, c.co)), zone: jumTxt_(get(l, c.z)),
          lat: jumNum_(get(l, c.la)), lon: jumNum_(get(l, c.lo)), telephone: jumTel_(get(l, c.tel)), horaire_matin: jumTxt_(get(l, c.hm)), horaire_soir: jumTxt_(get(l, c.hs)),
          note: jumNote_(get(l, c.note)), conventionne: jumOui_(get(l, c.conv)), derniere: jumDate_(get(l, c.der)), statut: jumVide_(get(l, c.st)), commentaire: jumVide_(get(l, c.com)),
          nb_visites: jumInt_(get(l, c.nb), 0), actif: jumActif_(get(l, c.act)) });
      });
      return out;
    case 'etablissements':
      f = jumFeuille_(FEUILLES.etablissements); if (!f) return null;
      c = { code: f.col(['CodeEtab']), nom: f.col(['Nom']), cat: f.col(['Categorie']), co: f.col(['Commune']), q: f.col(['Quartier']), z: f.col(['Zone']), la: f.col(['Latitude']), lo: f.col(['Longitude']),
        tel: f.col(['Telephone', 'Téléphone']), rep: f.col(['Reperes', 'Repères']), pos: f.col(['Position']), og: f.col(['OrigineGPS']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code)), nom = jumTxt_(get(l, c.nom)); if (!code || !nom) return;
        out.push({ code: code, nom: nom, categorie: jumTxt_(get(l, c.cat)), commune: jumTxt_(get(l, c.co)), quartier: jumTxt_(get(l, c.q)), zone: jumTxt_(get(l, c.z)),
          lat: jumNum_(get(l, c.la)), lon: jumNum_(get(l, c.lo)), telephone: jumTel_(get(l, c.tel)), reperes: jumTxt_(get(l, c.rep)), position: jumTxt_(get(l, c.pos)), origine_gps: jumTxt_(get(l, c.og)) });
      });
      return out;
    case 'visites':
      f = jumFeuille_(FEUILLES.hist); if (!f) return null;
      c = { date: f.col(['DateVisite']), horo: f.col(['Horodatage']), idp: f.col(['IdPresence']), code: f.col(['CodeContact']), nom: f.col(['Nom']), type: f.col(['Type']), spec: f.col(['Spécialité']),
        note: f.col(['Note']), co: f.col(['Commune']), q: f.col(['Quartier']), lieu: f.col(['Lieu/Etablissement']), cr: f.col(['Créneau']), st: f.col(['Statut']), com: f.col(['Commentaire']),
        uid: f.col(['IdSync']), del: f.col(['Délégué']), prod: f.col(['Produits']), act: f.col(['Activité']), ech: f.col(['Échantillons']), pro: f.col(['ProchaineEtape']), itl: f.col(['Interlocuteur']), rea: f.col(['Réactions']), sto: f.col(['Stocks']),
        cmd: f.col(['Commande']), cpl: f.col(['Compléments']), sui: f.col(['Suite']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code)), date = jumDate_(get(l, c.date)); if (!code || !date) return;
        var uid = jumTxt_(get(l, c.uid)) || ('H-' + date + '-' + code);
        out.push({ uid: uid, date: date, horodatage: jumHoro_(get(l, c.horo)), delegue: jumTxt_(get(l, c.del)), code: code, id_presence: jumVide_(get(l, c.idp)),
          nom: jumTxt_(get(l, c.nom)), type: jumTxt_(get(l, c.type)) || 'Médecin', specialite: jumTxt_(get(l, c.spec)), note: jumNote_(get(l, c.note)),
          commune: jumTxt_(get(l, c.co)), quartier: jumTxt_(get(l, c.q)), lieu: jumTxt_(get(l, c.lieu)), creneau: jumTxt_(get(l, c.cr)), statut: jumTxt_(get(l, c.st)) || 'Visite faite',
          type_echange: jumTxt_(get(l, c.act)), produits_presentes: jumVide_(get(l, c.prod)), echantillons: jumVide_(get(l, c.ech)),
          prochaine_visite: jumDate_(get(l, c.pro)), prochaine_etape: jumTxt_(get(l, c.pro)), commentaire: jumTxt_(get(l, c.com)),
          interlocuteur: jumTxt_(get(l, c.itl)), reactions: jumTxt_(get(l, c.rea)), stocks: jumTxt_(get(l, c.sto)), commande: jumTxt_(get(l, c.cmd)),
          complements: jumTxt_(get(l, c.cpl)), suite: jumTxt_(get(l, c.sui)) });
      });
      return out;
    case 'plannings':
      f = jumFeuille_(FEUILLES.plannings); if (!f) return null;
      c = { del: f.col(['Délégué']), date: f.col(['Date']), h: f.col(['HeurePrevue']), cr: f.col(['Créneau']), d: f.col(['Debut']), fi: f.col(['Fin']), idp: f.col(['IdPresence']), code: f.col(['CodeContact']),
        nom: f.col(['Nom']), spec: f.col(['Spécialité']), note: f.col(['Note']), q: f.col(['Quartier']), co: f.col(['Commune']), lieu: f.col(['Lieu/Etablissement']), st: f.col(['Statut']), et: f.col(['Etat']), pr: f.col(['Programme']), maj: f.col(['MiseAJour']), ida: f.col(['IdArret']), dep: f.col(['CibleDepuis']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code)), date = jumDate_(get(l, c.date)); if (!code || !date) return;
        var hv = get(l, c.h), heure = hv instanceof Date ? Utilities.formatDate(hv, Session.getScriptTimeZone(), 'HH:mm') : jumTxt_(hv);
        out.push({ delegue: jumTxt_(get(l, c.del)), date: date, heure: heure, creneau: jumTxt_(get(l, c.cr)), debut: jumInt_(get(l, c.d)), fin: jumInt_(get(l, c.fi)),
          id_presence: jumVide_(get(l, c.idp)), code: code, nom: jumTxt_(get(l, c.nom)), specialite: jumTxt_(get(l, c.spec)), note: jumNote_(get(l, c.note)),
          quartier: jumTxt_(get(l, c.q)), commune: jumTxt_(get(l, c.co)), lieu: jumTxt_(get(l, c.lieu)), statut: jumTxt_(get(l, c.st)), etat: jumTxt_(get(l, c.et)) || 'planifie', programme: jumTxt_(get(l, c.pr)),
          maj: jumHoro_(get(l, c.maj)) || jumTxt_(get(l, c.maj)), id_arret: jumTxt_(get(l, c.ida)), cible_depuis: jumTxt_(get(l, c.dep)) });
      });
      return out;
    case 'rapports':
      f = jumFeuille_(FEUILLES.rapports); if (!f) return null;
      c = { del: f.col(['Délégué']), date: f.col(['Date']), pv: f.col(['Visites prévues']), fa: f.col(['Visites faites']), nf: f.col(['Non faites']), sc: f.col(['Sans compte rendu']),
        sy: f.col(['Synthèse']), fm: f.col(['Faits marquants']), cc: f.col(['Concurrence']), be: f.col(['Besoins']), km: f.col(['Kilomètres']), vl: f.col(['Validé le']), maj: f.col(['Mise à jour']) };
      f.lignes.forEach(function (l) {
        var del = jumTxt_(get(l, c.del)), date = jumDate_(get(l, c.date)); if (!del || !date) return;
        out.push({ delegue: del, date: date, prevues: jumInt_(get(l, c.pv), 0), faites: jumInt_(get(l, c.fa), 0), non_faites: jumInt_(get(l, c.nf), 0), sans_cr: jumInt_(get(l, c.sc), 0),
          synthese: jumTxt_(get(l, c.sy)), faits: jumTxt_(get(l, c.fm)), concurrence: jumTxt_(get(l, c.cc)), besoins: jumTxt_(get(l, c.be)), km: jumNum_(get(l, c.km)) || 0,
          valide_le: jumHoro_(get(l, c.vl)) || jumTxt_(get(l, c.vl)), maj: jumHoro_(get(l, c.maj)) || jumTxt_(get(l, c.maj)) });
      });
      return out;
    case 'quartiers':
      f = jumFeuille_(FEUILLES.quartiers); if (!f) return null;
      c = { co: f.col(['Commune']), q: f.col(['Quartier']), z: f.col(['Zone']), la: f.col(['Latitude', 'Lat']), lo: f.col(['Longitude', 'Lon']), se: f.col(['Secteur']) };
      f.lignes.forEach(function (l) {
        var q = jumTxt_(get(l, c.q)); if (!q) return;
        out.push({ commune: jumTxt_(get(l, c.co)), quartier: q, zone: jumTxt_(get(l, c.z)), lat: jumNum_(get(l, c.la)), lon: jumNum_(get(l, c.lo)), secteur: jumTxt_(get(l, c.se)) });
      });
      return out;
    case 'fiches_produits':
      f = jumFeuille_(FEUILLES.fiches); if (!f) return null;
      c = {}; CHAMPS_FICHES.forEach(function (x) { c[x[0]] = f.col([x[1]]); });
      f.lignes.forEach(function (l) {
        var p = jumTxt_(get(l, c.produit)); if (!p) return;
        out.push({ produit: p, gamme: jumTxt_(get(l, c.gamme)), aire: jumTxt_(get(l, c.aire)), dci: jumTxt_(get(l, c.dci)), classe: jumTxt_(get(l, c.classe)),
          indications: jumTxt_(get(l, c.indications)), contre_indications: jumTxt_(get(l, c.contreIndications)), posologie: jumTxt_(get(l, c.posologie)),
          precautions: jumTxt_(get(l, c.precautions)), effets: jumTxt_(get(l, c.effets)), arguments: jumTxt_(get(l, c.arguments)), laboratoire: jumTxt_(get(l, c.laboratoire)),
          sources: jumTxt_(get(l, c.sources)), actif: jumActif_(get(l, c.actif)) });
      });
      return out;
    case 'listes_reference':
      f = jumFeuille_(FEUILLES.listes); if (!f) return null;
      var cats = [['delegue', ['Délégués']], ['ferie', ['JoursFériés']], ['activite', ['Activités']], ['activite_pharmacie', ['ActivitésPharmacie']], ['produit', ['Produits']]];
      cats.forEach(function (ct) {
        var k = f.col(ct[1]); if (k < 0) return;
        var n = 0;
        f.lignes.forEach(function (l) {
          var v = ct[0] === 'ferie' ? jumDate_(l[k]) : jumTxt_(l[k]); if (!v) return;
          out.push({ categorie: ct[0], valeur: v, metadata: null, ordre: ++n, actif: true });
        });
      });
      // statuts : colonnes A (nom) et B (compte comme visite), comme lireStatuts
      var ns = 0;
      f.lignes.forEach(function (l) {
        var v = jumTxt_(l[0]); if (!v) return;
        out.push({ categorie: 'statut', valeur: v, metadata: { compte_comme_visite: normaliser(l[1]) === 'oui' }, ordre: ++ns, actif: true });
      });
      return out;
  }
  return null;
}

// Clé naturelle de chaque table (unicité), et clé primaire quand elle est naturelle
var JUM_TABLES = {
  praticiens: { pk: 'code' }, presences: { pk: 'id' }, pharmacies: { pk: 'code' }, etablissements: { pk: 'code' }, visites: { pk: 'uid' },
  plannings: { cle: ['delegue', 'date', 'heure', 'code', 'id_presence'] }, rapports: { cle: ['delegue', 'date'] },
  quartiers: { cle: ['commune', 'quartier'] }, fiches_produits: { cle: ['produit'] }, listes_reference: { cle: ['categorie', 'valeur'] }
};

function jumCle_(o, cols) { return cols.map(function (k) { return o[k] === null || o[k] === undefined ? '' : String(o[k]); }).join('|'); }
function jumDedoublonner_(rows, cols) { var vu = {}, out = []; for (var i = rows.length - 1; i >= 0; i--) { var k = jumCle_(rows[i], cols); if (!vu[k]) { vu[k] = 1; out.unshift(rows[i]); } } return out; }
function jumParLots_(l, n, fn) { for (var i = 0; i < l.length; i += n) fn(l.slice(i, i + n)); }
function jumIn_(vals) { return 'in.(' + vals.map(function (v) { return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }).join(',') + ')'; }

// Recopie d'une table : ajouts et modifications, puis suppression de ce qui n'existe plus dans le Sheet
function jumSyncTable_(table, rows) {
  var t = JUM_TABLES[table], n = { envoyees: 0, supprimees: 0 };
  if (t.pk) {
    rows = jumDedoublonner_(rows, [t.pk]);
    jumParLots_(rows, 400, function (lot) {
      jumOk_(jumReq_('post', table + '?on_conflict=' + t.pk, lot, 'resolution=merge-duplicates,return=minimal'), 'Envoi ' + table);
    });
    n.envoyees = rows.length;
    var garder = {}; rows.forEach(function (r) { garder[String(r[t.pk])] = 1; });
    var exist = jumLireSupabase_(table, t.pk);
    var aSuppr = exist.map(function (e) { return String(e[t.pk]); }).filter(function (k) { return !garder[k]; });
    jumParLots_(aSuppr, 80, function (lot) { jumOk_(jumReq_('delete', table + '?' + t.pk + '=' + encodeURIComponent(jumIn_(lot))), 'Suppression ' + table); });
    n.supprimees = aSuppr.length;
    n.total = rows.length;
    return n;
  }
  // tables à identifiant technique (uuid) : rapprochement par la clé naturelle
  rows = jumDedoublonner_(rows, t.cle);
  var existants = jumLireSupabase_(table, 'id,' + t.cle.join(','));
  var parCle = {}, doublons = [];
  existants.forEach(function (e) { var k = jumCle_(e, t.cle); if (parCle[k]) doublons.push(e.id); else parCle[k] = e.id; });
  var avecId = [], sansId = [], garde = {};
  rows.forEach(function (r) {
    var id = parCle[jumCle_(r, t.cle)];
    if (id) { var o = { id: id }; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); avecId.push(o); garde[id] = 1; }
    else sansId.push(r);
  });
  jumParLots_(avecId, 400, function (lot) { jumOk_(jumReq_('post', table + '?on_conflict=id', lot, 'resolution=merge-duplicates,return=minimal'), 'Mise à jour ' + table); });
  jumParLots_(sansId, 400, function (lot) { jumOk_(jumReq_('post', table, lot, 'return=minimal'), 'Ajout ' + table); });
  var aSuppr2 = existants.map(function (e) { return e.id; }).filter(function (id) { return !garde[id]; });
  jumParLots_(aSuppr2, 80, function (lot) { jumOk_(jumReq_('delete', table + '?id=' + encodeURIComponent(jumIn_(lot))), 'Suppression ' + table); });
  n.envoyees = rows.length; n.supprimees = aSuppr2.length; n.total = rows.length;
  return n;
}

// Synchronisation : force = true recopie toutes les tables, sinon seulement celles dont l'empreinte a changé
function synchroniserSupabase(force) {
  var verrou = LockService.getDocumentLock();
  if (!verrou.tryLock(2000)) return { ok: false, erreur: 'Synchronisation déjà en cours.' };
  var t0 = Date.now(), props = PropertiesService.getScriptProperties();
  var emp = JSON.parse(props.getProperty('SUPA_EMPREINTES') || '{}');
  var etat = JSON.parse(props.getProperty('SUPA_ETAT') || '{}'); etat.tables = etat.tables || {};
  var erreurs = 0, codesMed = null;
  try {
    // 1) d'abord ce qui a été modifié directement dans Supabase (Table Editor, SQL) : reporté dans le Sheet
    try { etat.retour = jumAppliquerSupabase_(); } catch (eR) { erreurs++; etat.retour = { erreur: String(eR.message || eR).slice(0, 300) }; }
    // 2) puis le Sheet vers Supabase
    Object.keys(JUM_TABLES).forEach(function (table) {
      try {
        var rows = jumLignes_(table), ignorees = 0;
        // une présence dont le médecin n'existe pas dans Praticiens est refusée par Supabase (clé étrangère) : écartée et comptée
        if (table === 'praticiens' && rows) { codesMed = {}; rows.forEach(function (r) { codesMed[r.code] = 1; }); }
        if (table === 'presences' && rows && codesMed) { var av = rows.length; rows = rows.filter(function (r) { return codesMed[r.code]; }); ignorees = av - rows.length; }
        if (rows === null) { etat.tables[table] = { sheets: 0, erreur: 'onglet absent (non recopié)' }; return; }
        // sécurité : un onglet de base vide ne vide jamais Supabase
        if (!rows.length && ['praticiens', 'presences', 'pharmacies', 'etablissements'].indexOf(table) >= 0) { etat.tables[table] = { sheets: 0, erreur: 'onglet vide (non recopié par sécurité)' }; return; }
        var h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(rows), Utilities.Charset.UTF_8));
        if (force !== true && emp[table] === h) return;
        var n = jumSyncTable_(table, rows);
        emp[table] = h;
        jumMemoriserLignes_(table, rows);
        etat.tables[table] = { sheets: rows.length + ignorees, supabase: n.total, supprimees: n.supprimees, le: new Date().toISOString() };
        if (ignorees) etat.tables[table].ignorees = ignorees;
      } catch (e) {
        erreurs++;
        delete emp[table];   // retenté au prochain tour
        etat.tables[table] = { erreur: String(e.message || e).slice(0, 300), le: new Date().toISOString() };
      }
    });
    etat.derniere = new Date().toISOString();
    etat.ok = erreurs === 0;
    etat.duree = Math.round((Date.now() - t0) / 1000);
    props.setProperty('SUPA_EMPREINTES', JSON.stringify(emp));
    props.setProperty('SUPA_ETAT', JSON.stringify(etat));
    Logger.log('JUMELAGE ' + (etat.ok ? 'OK' : erreurs + ' erreur(s)') + ' en ' + etat.duree + ' s ' + JSON.stringify(etat.tables));
    return { ok: etat.ok, etat: etat };
  } finally {
    verrou.releaseLock();
  }
}

// Déclencheur toutes les 5 minutes
function jumelageAuto() { synchroniserSupabase(false); }
function synchroniserSupabaseComplet() { return synchroniserSupabase(true); }

// ---------------------------------------------------------------- Envoi immédiat après une écriture de l'application
// Empreinte courte de chaque ligne envoyée (cache 6 h) : seules les lignes modifiées repartent.
function jumEmpLigne_(r) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(r), Utilities.Charset.UTF_8)).slice(0, 10); }
function jumMemoriserLignes_(table, rows) {
  var t = JUM_TABLES[table]; if (!t.pk) return;
  var m = {}; rows.forEach(function (r) { m[String(r[t.pk])] = jumEmpLigne_(r); });
  var txt = JSON.stringify(m);
  if (txt.length < 95000) CacheService.getScriptCache().put('JRH_' + table, txt, 21600);
}
var JUM_APRES_ACTION = {
  valider: ['visites', 'praticiens', 'pharmacies'], fiche: ['praticiens', 'presences', 'pharmacies'], planning: ['plannings'],
  rapport: ['rapports'], delegue: ['listes_reference'], etablissement: ['etablissements', 'presences']
};
// Appelée par doPost juste après l'écriture dans le Sheet : Supabase est à jour quand le téléphone reçoit la réponse
function jumPousserApresEcriture_(action) {
  var tables = JUM_APRES_ACTION[action]; if (!tables) return;
  var cache = CacheService.getScriptCache(), codesMed = null;
  tables.forEach(function (table) {
    try {
      var t = JUM_TABLES[table], rows = jumLignes_(table); if (!rows || !rows.length) return;
      if (table === 'presences') {
        var pr = jumLignes_('praticiens') || []; codesMed = {}; pr.forEach(function (r) { codesMed[r.code] = 1; });
        rows = rows.filter(function (r) { return codesMed[r.code]; });
      }
      var txt = t.pk ? cache.get('JRH_' + table) : null;
      if (!txt) { jumSyncTable_(table, rows); jumMemoriserLignes_(table, rows); return; }
      var m = JSON.parse(txt), aEnvoyer = [];
      jumDedoublonner_(rows, [t.pk]).forEach(function (r) { var k = String(r[t.pk]), e = jumEmpLigne_(r); if (m[k] !== e) { aEnvoyer.push(r); m[k] = e; } });
      jumParLots_(aEnvoyer, 400, function (lot) {
        jumOk_(jumReq_('post', table + '?on_conflict=' + t.pk, lot, 'resolution=merge-duplicates,return=minimal'), 'Envoi ' + table);
      });
      txt = JSON.stringify(m); if (txt.length < 95000) cache.put('JRH_' + table, txt, 21600);
    } catch (e) { console.warn('Jumelage immédiat ' + table + ' : ' + e); }   // rattrapé par le tour de 5 minutes
  });
}

// Déclencheur installable onEdit : la table de l'onglet modifié part tout de suite vers Supabase
function jumSurEdition(e) {
  try {
    var nom = e && e.range ? e.range.getSheet().getName() : '';
    var parFeuille = {}; parFeuille[FEUILLES.praticiens] = 'praticiens'; parFeuille[FEUILLES.presences] = 'presences'; parFeuille[FEUILLES.pharmacies] = 'pharmacies';
    parFeuille[FEUILLES.etablissements] = 'etablissements'; parFeuille[FEUILLES.hist] = 'visites'; parFeuille[FEUILLES.plannings] = 'plannings'; parFeuille[FEUILLES.rapports] = 'rapports';
    parFeuille[FEUILLES.quartiers] = 'quartiers'; parFeuille[FEUILLES.fiches] = 'fiches_produits'; parFeuille[FEUILLES.listes] = 'listes_reference';
    var table = parFeuille[nom]; if (!table) return;
    JUM_APRES_ACTION['_edition'] = [table];
    jumPousserApresEcriture_('_edition');
  } catch (err) { console.warn('jumSurEdition : ' + err); }
}

// ---------------------------------------------------------------- Supabase -> Sheet (modifications faites directement dans Supabase)
// Chaque ligne modifiée hors serveur porte maj_source = 'supabase' (déclencheur SQL) ; chaque suppression est notée dans jumelage_suppressions.
// Colonnes : [colonne Supabase, libellés possibles de l'en-tête du Sheet, type]
var JUM_RETOUR = {
  praticiens: { feuille: 'praticiens', cle: [['code', ['CodeContact']]], cols: [['type', ['Type']], ['nom', ['Nom']], ['specialite', ['Spécialité']], ['note', ['Note'], 'n'], ['conventionne', ['Engagé'], 'b'],
    ['telephone', ['Téléphone']], ['derniere', ['DateDerniereVisite'], 'd'], ['statut', ['DernierStatut']], ['commentaire', ['DernierCommentaire']], ['nb_visites', ['NbVisites'], 'n'], ['actif', ['Actif'], 'b'],
    ['prochaine', ['ProchaineEtape']], ['absent_du', ['AbsentDu'], 'd'], ['absent_au', ['AbsentAu'], 'd']] },
  presences: { feuille: 'presences', cle: [['id', ['IdPresence']]], cols: [['code', ['CodeContact']], ['nom', ['Nom']], ['lieu', ['Lieu/Etablissement']], ['quartier', ['Quartier']], ['commune', ['Commune']], ['zone', ['Zone']],
    ['lundi', ['Lundi']], ['mardi', ['Mardi']], ['mercredi', ['Mercredi']], ['jeudi', ['Jeudi']], ['vendredi', ['Vendredi']], ['horaire_matin', ['HoraireMatin']], ['horaire_soir', ['HoraireSoir']],
    ['lat', ['Latitude'], 'n'], ['lon', ['Longitude'], 'n'], ['secteur', ['Secteur']], ['reperes', ['Repères']], ['origine_gps', ['OrigineGPS']]] },
  pharmacies: { feuille: 'pharmacies', cle: [['code', ['CodeContact']]], cols: [['nom', ['Nom']], ['titulaire', ['Titulaire']], ['quartier', ['Quartier']], ['commune', ['Commune']], ['zone', ['Zone']],
    ['lat', ['Latitude'], 'n'], ['lon', ['Longitude'], 'n'], ['telephone', ['Téléphone']], ['horaire_matin', ['HoraireMatin']], ['horaire_soir', ['HoraireSoir']], ['note', ['Note'], 'n'], ['conventionne', ['Engagé'], 'b'],
    ['derniere', ['DateDerniereVisite'], 'd'], ['statut', ['DernierStatut']], ['commentaire', ['DernierCommentaire']], ['nb_visites', ['NbVisites'], 'n'], ['actif', ['Actif'], 'b'], ['reperes', ['Repères']],
    ['prochaine', ['ProchaineEtape']], ['source', ['Source']], ['origine_gps', ['OrigineGPS']]] },
  etablissements: { feuille: 'etablissements', cle: [['code', ['CodeEtab']]], cols: [['nom', ['Nom']], ['categorie', ['Categorie']], ['commune', ['Commune']], ['quartier', ['Quartier']], ['zone', ['Zone']],
    ['lat', ['Latitude'], 'n'], ['lon', ['Longitude'], 'n'], ['telephone', ['Telephone', 'Téléphone']], ['reperes', ['Reperes', 'Repères']], ['position', ['Position']], ['origine_gps', ['OrigineGPS']]] },
  visites: { feuille: 'hist', cle: [['uid', ['IdSync']]], cols: [['date', ['DateVisite'], 'd'], ['delegue', ['Délégué']], ['code', ['CodeContact']], ['id_presence', ['IdPresence']], ['nom', ['Nom']], ['type', ['Type']],
    ['specialite', ['Spécialité']], ['note', ['Note'], 'n'], ['commune', ['Commune']], ['quartier', ['Quartier']], ['lieu', ['Lieu/Etablissement']], ['creneau', ['Créneau']], ['statut', ['Statut']],
    ['type_echange', ['Activité']], ['produits_presentes', ['Produits']], ['echantillons', ['Échantillons']], ['prochaine_etape', ['ProchaineEtape']], ['commentaire', ['Commentaire']],
    ['interlocuteur', ['Interlocuteur']], ['reactions', ['Réactions']], ['stocks', ['Stocks']], ['commande', ['Commande']], ['complements', ['Compléments']], ['suite', ['Suite']]] },
  rapports: { feuille: 'rapports', cle: [['delegue', ['Délégué']], ['date', ['Date'], 'd']], cols: [['prevues', ['Visites prévues'], 'n'], ['faites', ['Visites faites'], 'n'], ['non_faites', ['Non faites'], 'n'],
    ['sans_cr', ['Sans compte rendu'], 'n'], ['synthese', ['Synthèse']], ['faits', ['Faits marquants']], ['concurrence', ['Concurrence']], ['besoins', ['Besoins']], ['km', ['Kilomètres'], 'n']] },
  quartiers: { feuille: 'quartiers', cle: [['commune', ['Commune']], ['quartier', ['Quartier']]], cols: [['zone', ['Zone']], ['lat', ['Latitude', 'Lat'], 'n'], ['lon', ['Longitude', 'Lon'], 'n'], ['secteur', ['Secteur']]] },
  fiches_produits: { feuille: 'fiches', cle: [['produit', ['Produit']]], cols: [['gamme', ['Gamme']], ['aire', ['Aire thérapeutique']], ['dci', ['DCI et dosage']], ['classe', ['Classe']], ['indications', ['Indications']],
    ['contre_indications', ['Contre-indications']], ['posologie', ['Posologie']], ['precautions', ['Précautions et interactions']], ['effets', ['Effets indésirables']], ['arguments', ['Arguments clés']],
    ['laboratoire', ['Laboratoire']], ['sources', ['Sources']], ['actif', ['Actif'], 'b']] }
};
function jumVersSheet_(v, type) {
  if (v === null || v === undefined) return '';
  if (type === 'b') return v === true || v === 'true' ? 'Oui' : 'Non';
  if (type === 'n') { var n = Number(v); return isFinite(n) ? n : ''; }
  if (type === 'd') { var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : ''; }
  return String(v);
}
function jumCleSheet_(v, type) { return type === 'd' ? (jumDate_(v) || '') : jumTxt_(v); }

function jumAppliquerSupabase_() {
  var ss = SpreadsheetApp.getActive(), bilan = { modifiees: 0, ajoutees: 0, supprimees: 0, erreurs: 0 };
  Object.keys(JUM_RETOUR).forEach(function (table) {
    var R = JUM_RETOUR[table];
    var res = jumReq_('get', table + '?select=*&maj_source=eq.supabase&limit=1000');
    jumOk_(res, 'Lecture des modifications ' + table);
    var lignes = JSON.parse(res.texte); if (!lignes.length) return;
    var sh = ss.getSheetByName(FEUILLES[R.feuille]); if (!sh) return;
    var nc = sh.getLastColumn(), ent = sh.getRange(1, 1, 1, nc).getValues()[0].map(normaliser);
    var colDe = function (noms) { for (var i = 0; i < noms.length; i++) { var k = ent.indexOf(normaliser(noms[i])); if (k >= 0) return k; } return -1; };
    var kCle = R.cle.map(function (c) { return colDe(c[1]); });
    if (kCle.some(function (k) { return k < 0; })) return;
    var data = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues() : [];
    var kDate = table === 'visites' ? colDe(['DateVisite']) : -1, kCode = table === 'visites' ? colDe(['CodeContact']) : -1;
    var cleLigne = function (l) {
      var k = R.cle.map(function (c, j) { return jumCleSheet_(l[kCle[j]], c[2]); }).join('|');
      if (!k && table === 'visites') k = 'H-' + (jumDate_(l[kDate]) || '') + '-' + jumTxt_(l[kCode]);   // même identifiant que jumLignes_
      return k;
    };
    var index = {}; data.forEach(function (l, i) { index[cleLigne(l)] = i; });
    var faites = [];
    lignes.forEach(function (o) {
      try {
        var cle = R.cle.map(function (c) { return jumCleSheet_(o[c[0]], c[2]); }).join('|');
        var i = index[cle], ligne = i !== undefined ? data[i].slice() : ent.map(function () { return ''; });
        if (i === undefined) R.cle.forEach(function (c, j) { ligne[kCle[j]] = jumVersSheet_(o[c[0]], c[2]); });
        R.cols.forEach(function (c) { var k = colDe(c[1]); if (k >= 0 && o.hasOwnProperty(c[0])) ligne[k] = jumVersSheet_(o[c[0]], c[2]); });
        if (i !== undefined) { sh.getRange(i + 2, 1, 1, nc).setValues([ligne]); data[i] = ligne; bilan.modifiees++; }
        else { sh.getRange(sh.getLastRow() + 1, 1, 1, nc).setValues([ligne]); data.push(ligne); index[cle] = data.length - 1; bilan.ajoutees++; }
        faites.push(o);
      } catch (e) { bilan.erreurs++; console.warn('Retour ' + table + ' : ' + e); }
    });
    // les lignes reportées repassent en maj_source = 'sheets'
    var pk = JUM_TABLES[table].pk || 'id';
    jumParLots_(faites.map(function (o) { return o[pk]; }), 80, function (lot) {
      jumOk_(jumReq_('patch', table + '?' + pk + '=' + encodeURIComponent(jumIn_(lot)), { maj_source: 'sheets' }, 'return=minimal'), 'Marquage ' + table);
    });
  });
  // suppressions faites dans Supabase
  var rs = jumReq_('get', 'jumelage_suppressions?select=*&order=id&limit=500');
  jumOk_(rs, 'Lecture des suppressions');
  var sup = JSON.parse(rs.texte), traitees = [];
  sup.forEach(function (x) {
    var R = JUM_RETOUR[x.table_name], o = x.cle || {};
    traitees.push(x.id);
    if (!R) return;
    var sh = ss.getSheetByName(FEUILLES[R.feuille]); if (!sh || sh.getLastRow() < 2) return;
    var nc = sh.getLastColumn(), ent = sh.getRange(1, 1, 1, nc).getValues()[0].map(normaliser);
    var kCle = R.cle.map(function (c) { for (var i = 0; i < c[1].length; i++) { var k = ent.indexOf(normaliser(c[1][i])); if (k >= 0) return k; } return -1; });
    if (kCle.some(function (k) { return k < 0; })) return;
    var cle = R.cle.map(function (c) { return jumCleSheet_(o[c[0]], c[2]); }).join('|');
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues();
    for (var i = data.length - 1; i >= 0; i--) {
      if (R.cle.map(function (c, j) { return jumCleSheet_(data[i][kCle[j]], c[2]); }).join('|') === cle) { sh.deleteRow(i + 2); bilan.supprimees++; }
    }
  });
  jumParLots_(traitees, 80, function (lot) { jumOk_(jumReq_('delete', 'jumelage_suppressions?id=in.(' + lot.join(',') + ')'), 'Purge des suppressions'); });
  if (bilan.modifiees || bilan.ajoutees || bilan.supprimees) { try { marquerModif(); } catch (e) {} }
  return bilan;
}

function lireEtatJumelage_() {
  var etat = JSON.parse(PropertiesService.getScriptProperties().getProperty('SUPA_ETAT') || '{}');
  etat.frequenceMinutes = JUMELAGE_MINUTES;
  return etat;
}
