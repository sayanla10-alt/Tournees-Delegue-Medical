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
    var h = tr.getHandlerFunction();
    if (h === 'jumelageAuto' || h === 'jumSurEdition' || h === 'jumSurChangement') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('jumelageAuto').timeBased().everyMinutes(JUMELAGE_MINUTES).create();
  // saisie à la main dans le Sheet : envoyée à Supabase dans les secondes qui suivent
  ScriptApp.newTrigger('jumSurEdition').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger('jumSurChangement').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
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

// 3.29.0 : signal temps réel (Supabase Realtime, canal « mediplanner ») : les téléphones ouverts relisent la base aussitôt,
// sans attendre leur vérification de 15 s. Aucune donnée dans le message, seulement le nom des tables modifiées.
function jumDiffuser_(tables) {
  if (!tables || !tables.length) return;
  try {
    var c = jumCfg_();
    UrlFetchApp.fetch(c.url + '/realtime/v1/api/broadcast', { method: 'post', muteHttpExceptions: true, contentType: 'application/json',
      headers: { apikey: c.key, Authorization: 'Bearer ' + c.key },
      payload: JSON.stringify({ messages: [{ topic: 'mediplanner', event: 'maj', payload: { tables: tables, le: new Date().toISOString() } }] }) });
  } catch (e) { console.warn('Diffusion temps réel : ' + e); }
}

function jumOk_(r, quoi) {
  if (r.code >= 200 && r.code < 300) return;
  throw new Error(quoi + ' : HTTP ' + r.code + ' ' + String(r.texte).slice(0, 300));
}

function jumPostLots_(chemin, lot, prefer) {
  var r = jumReq_('post', chemin, lot, prefer);
  if (r.code === 400 && /autres/i.test(String(r.texte || '')) && lot.some(function (o) { return o && o.hasOwnProperty('autres'); })) {
    var sansAutres = lot.map(function (o) {
      var c = {};
      Object.keys(o).forEach(function (k) { if (k !== 'autres') c[k] = o[k]; });
      return c;
    });
    return jumReq_('post', chemin, sansAutres, prefer);
  }
  return r;
}

// Lecture paginée de toute une table Supabase (colonnes choisies)
function jumLireSupabase_(table, cols, orderCol) {
  var tout = [], pas = 1000;
  var ordre = orderCol || (typeof JUM_TABLES !== 'undefined' && JUM_TABLES[table] && JUM_TABLES[table].pk) || 'id';
  for (var off = 0; off < 100000; off += pas) {
    var r = jumReq_('get', table + '?select=' + encodeURIComponent(cols) + '&order=' + encodeURIComponent(ordre) + '.asc&limit=' + pas + '&offset=' + off);
    jumOk_(r, 'Lecture ' + table);
    var l = JSON.parse(r.texte);
    tout = tout.concat(l);
    if (l.length < pas) break;
  }
  return tout;
}

var JUM_TZ_ = null;
function jumTz_(ss) {
  if (ss) {
    try { JUM_TZ_ = ss.getSpreadsheetTimeZone(); return JUM_TZ_; } catch (e) {}
  }
  if (!JUM_TZ_) {
    try { JUM_TZ_ = SpreadsheetApp.getActive().getSpreadsheetTimeZone(); } catch (e2) { JUM_TZ_ = Session.getScriptTimeZone(); }
  }
  return JUM_TZ_;
}

// ---------------------------------------------------------------- Lecture du Sheet
function jumFeuille_(nom) {
  var ss = SpreadsheetApp.getActive(), tz = jumTz_(ss);
  var sh = ss.getSheetByName(nom);
  if (!sh || sh.getLastColumn() < 1) return null;
  var nc = sh.getLastColumn();
  var brut = sh.getRange(1, 1, 1, nc).getValues()[0], ent = brut.map(normaliser), utilisees = {};
  var vals = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues() : [];
  return {
    tz: tz,
    lignes: vals,
    // 3.28.12 : toute colonne du Sheet sans colonne Supabase dédiée part dans « autres » (jsonb) : aucune information perdue
    autres: function (l) {
      var o = null;
      for (var j = 0; j < nc; j++) {
        if (utilisees[j] || !String(brut[j] || '').trim()) continue;
        var v = l[j]; if (v === '' || v === null || v === undefined) continue;
        (o = o || {})[String(brut[j]).trim()] = v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm') : v;
      }
      return o;
    },
    col: function (noms) {   // index de la première en-tête trouvée parmi plusieurs libellés
      for (var i = 0; i < noms.length; i++) { var k = ent.indexOf(normaliser(noms[i])); if (k >= 0) { utilisees[k] = 1; return k; } }
      return -1;
    }
  };
}
function jumTxt_(v, tz) { if (v === null || v === undefined) return ''; if (v instanceof Date) return Utilities.formatDate(v, tz || jumTz_(), v.getFullYear() < 1901 ? 'HH:mm' : 'yyyy-MM-dd');   // heure seule (Sheets : 30/12/1899)
 return String(v); }   // texte tel quel, comme la lecture du Sheet
function jumNum_(v) { var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; }
function jumInt_(v, def) { var n = parseInt(v, 10); return isFinite(n) ? n : (def === undefined ? null : def); }
function jumNote_(v) { var n = jumInt_(v, 2); return Math.max(1, Math.min(3, n)); }
function jumOui_(v) { return estConventionne(v); }
function jumActif_(v) { return ['non', 'false', 'faux', '0'].indexOf(normaliser(v)) < 0; }
function jumDate_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz || jumTz_(), 'yyyy-MM-dd');
  var s = String(v || '').trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return null;
}
function jumHoro_(v, tz) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  var s = String(v || '').trim();
  if (!s) return null;
  tz = tz || jumTz_();
  var m;
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  try {
    if ((m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)/))) {
      return Utilities.parseDate(m[1] + 'T' + m[2], tz, m[2].length === 8 ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd'T'HH:mm").toISOString();
    }
    if ((m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/))) {
      return Utilities.parseDate(m[1] + ' ' + m[2], tz, m[2].length === 8 ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm').toISOString();
    }
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/))) {
      var isoD = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
      return Utilities.parseDate(isoD + ' ' + m[4], tz, m[4].length === 8 ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm').toISOString();
    }
  } catch (e) {}
  return null;
}
// 3.31.53 : téléphone normalisé au format '+225 XX XX XX XX XX'
function jumTel_(v, tz) {
  var s = jumTxt_(v, tz);
  if (!s) return '';
  return (typeof formaterTelephoneCI === 'function' ? formaterTelephoneCI(s) : s) || s;
}
function jumVide_(v, tz) { var s = jumTxt_(v, tz); return s === '' ? null : s; }

// Chaque table : lignes du Sheet converties au format Supabase
function jumLignes_(table) {
  var f, c, out = [], tz = jumTz_();
  var get = function (l, k) { return k >= 0 ? l[k] : ''; };
  var pousser = function (l, o) { o.autres = f.autres(l); out.push(o); };
  switch (table) {
    case 'praticiens':
      f = jumFeuille_(FEUILLES.praticiens); if (!f) return null;
      tz = f.tz;
      c = { code: f.col(['CodeContact']), type: f.col(['Type']), nom: f.col(['Nom']), spec: f.col(['Spécialité']), note: f.col(['Note']), conv: f.col(['Engagé', 'Conventionné']),
        tel: f.col(['Téléphone']), der: f.col(['DateDerniereVisite']), st: f.col(['DernierStatut']), com: f.col(['DernierCommentaire']), nb: f.col(['NbVisites']), act: f.col(['Actif']),
        pro: f.col(['ProchaineEtape']), adu: f.col(['AbsentDu']), aau: f.col(['AbsentAu']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code), tz), nom = jumTxt_(get(l, c.nom), tz); if (!code || !nom) return;
        var proVal = get(l, c.pro);
        pousser(l, { prochaine: jumDate_(proVal, tz) || jumTxt_(proVal, tz), absent_du: jumDate_(get(l, c.adu), tz), absent_au: jumDate_(get(l, c.aau), tz), code: code, type: jumTxt_(get(l, c.type), tz) || 'Médecin', nom: nom, specialite: jumTxt_(get(l, c.spec), tz), note: jumNote_(get(l, c.note)),
          conventionne: jumOui_(get(l, c.conv)), telephone: jumTel_(get(l, c.tel), tz), derniere: jumDate_(get(l, c.der), tz), statut: jumVide_(get(l, c.st), tz),
          commentaire: jumVide_(get(l, c.com), tz), nb_visites: jumInt_(get(l, c.nb), 0), actif: jumActif_(get(l, c.act)) });
      });
      return out;
    case 'presences':
      f = jumFeuille_(FEUILLES.presences); if (!f) return null;
      tz = f.tz;
      c = { id: f.col(['IdPresence']), code: f.col(['CodeContact']), nom: f.col(['Nom']), lieu: f.col(['Lieu/Etablissement']), q: f.col(['Quartier']), co: f.col(['Commune']), z: f.col(['Zone']),
        ter: f.col(['Territoire']), sub: f.col(['Subdivision']),
        j: JOURS_CLES.map(function (j) { return f.col([j]); }), hm: f.col(['HoraireMatin']), hs: f.col(['HoraireSoir']), la: f.col(['Latitude']), lo: f.col(['Longitude']), rep: f.col(['Repères']), se: f.col(['Secteur']), og: f.col(['OrigineGPS']) };
      f.lignes.forEach(function (l) {
        var id = jumTxt_(get(l, c.id), tz), code = jumTxt_(get(l, c.code), tz); if (!id || !code) return;
        var o = { id: id, code: code, nom: jumTxt_(get(l, c.nom), tz), lieu: jumTxt_(get(l, c.lieu), tz), quartier: jumTxt_(get(l, c.q), tz), commune: jumTxt_(get(l, c.co), tz), zone: jumTxt_(get(l, c.z), tz),
          territoire: jumTxt_(get(l, c.ter), tz), subdivision: jumTxt_(get(l, c.sub), tz),
          horaire_matin: jumTxt_(get(l, c.hm), tz), horaire_soir: jumTxt_(get(l, c.hs), tz), lat: jumNum_(get(l, c.la)), lon: jumNum_(get(l, c.lo)), reperes: jumTxt_(get(l, c.rep), tz), secteur: jumTxt_(get(l, c.se), tz), origine_gps: jumTxt_(get(l, c.og), tz) };
        JOURS_CLES.forEach(function (j, k) { o[j] = jumTxt_(get(l, c.j[k]), tz); });
        o.autres = f.autres(l); out.push(o);
      });
      return out;
    case 'pharmacies':
      f = jumFeuille_(FEUILLES.pharmacies); if (!f) return null;
      tz = f.tz;
      c = { code: f.col(['CodeContact']), nom: f.col(['Nom']), tit: f.col(['Titulaire']), q: f.col(['Quartier']), co: f.col(['Commune']), z: f.col(['Zone']),
        ter: f.col(['Territoire']), sub: f.col(['Subdivision']), se: f.col(['Secteur']),
        la: f.col(['Latitude']), lo: f.col(['Longitude']),
        tel: f.col(['Téléphone']), hm: f.col(['HoraireMatin']), hs: f.col(['HoraireSoir']), note: f.col(['Note']), conv: f.col(['Engagé']), der: f.col(['DateDerniereVisite']), st: f.col(['DernierStatut']),
        com: f.col(['DernierCommentaire']), nb: f.col(['NbVisites']), act: f.col(['Actif']),
        rep: f.col(['Repères']), pro: f.col(['ProchaineEtape']), src: f.col(['Source']), og: f.col(['OrigineGPS']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code), tz), nom = jumTxt_(get(l, c.nom), tz); if (!code || !nom) return;
        var proVal = get(l, c.pro);
        pousser(l, { reperes: jumTxt_(get(l, c.rep), tz), prochaine: jumDate_(proVal, tz) || jumTxt_(proVal, tz), source: jumTxt_(get(l, c.src), tz), origine_gps: jumTxt_(get(l, c.og), tz), code: code, nom: nom, titulaire: jumTxt_(get(l, c.tit), tz), quartier: jumTxt_(get(l, c.q), tz), commune: jumTxt_(get(l, c.co), tz), zone: jumTxt_(get(l, c.z), tz),
          territoire: jumTxt_(get(l, c.ter), tz), subdivision: jumTxt_(get(l, c.sub), tz), secteur: jumTxt_(get(l, c.se), tz),
          lat: jumNum_(get(l, c.la)), lon: jumNum_(get(l, c.lo)), telephone: jumTel_(get(l, c.tel), tz), horaire_matin: jumTxt_(get(l, c.hm), tz), horaire_soir: jumTxt_(get(l, c.hs), tz),
          note: jumNote_(get(l, c.note)), conventionne: jumOui_(get(l, c.conv)), derniere: jumDate_(get(l, c.der), tz), statut: jumVide_(get(l, c.st), tz), commentaire: jumVide_(get(l, c.com), tz),
          nb_visites: jumInt_(get(l, c.nb), 0), actif: jumActif_(get(l, c.act)) });
      });
      return out;
    case 'etablissements':
      f = jumFeuille_(FEUILLES.etablissements); if (!f) return null;
      tz = f.tz;
      c = { code: f.col(['CodeEtab']), nom: f.col(['Nom']), cat: f.col(['Categorie']), co: f.col(['Commune']), q: f.col(['Quartier']), z: f.col(['Zone']),
        ter: f.col(['Territoire']), sub: f.col(['Subdivision']), se: f.col(['Secteur']),
        la: f.col(['Latitude']), lo: f.col(['Longitude']),
        tel: f.col(['Telephone', 'Téléphone']), rep: f.col(['Reperes', 'Repères']), pos: f.col(['Position']), og: f.col(['OrigineGPS']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code), tz), nom = jumTxt_(get(l, c.nom), tz); if (!code || !nom) return;
        pousser(l, { code: code, nom: nom, categorie: jumTxt_(get(l, c.cat), tz), commune: jumTxt_(get(l, c.co), tz), quartier: jumTxt_(get(l, c.q), tz), zone: jumTxt_(get(l, c.z), tz),
          territoire: jumTxt_(get(l, c.ter), tz), subdivision: jumTxt_(get(l, c.sub), tz), secteur: jumTxt_(get(l, c.se), tz),
          lat: jumNum_(get(l, c.la)), lon: jumNum_(get(l, c.lo)), telephone: jumTel_(get(l, c.tel), tz), reperes: jumTxt_(get(l, c.rep), tz), position: jumTxt_(get(l, c.pos), tz), origine_gps: jumTxt_(get(l, c.og), tz) });
      });
      return out;
    case 'visites':
      f = jumFeuille_(FEUILLES.hist); if (!f) return null;
      tz = f.tz;
      c = { date: f.col(['DateVisite']), horo: f.col(['Horodatage']), idp: f.col(['IdPresence']), code: f.col(['CodeContact']), nom: f.col(['Nom']), type: f.col(['Type']), spec: f.col(['Spécialité']),
        note: f.col(['Note']), co: f.col(['Commune']), q: f.col(['Quartier']), lieu: f.col(['Lieu/Etablissement']), cr: f.col(['Créneau']), st: f.col(['Statut']), com: f.col(['Commentaire']),
        uid: f.col(['IdSync']), del: f.col(['Délégué']), prod: f.col(['Produits']), act: f.col(['Activité']), ech: f.col(['Échantillons']), pro: f.col(['ProchaineEtape']), itl: f.col(['Interlocuteur']), rea: f.col(['Réactions']), sto: f.col(['Stocks']),
        cmd: f.col(['Commande']), cpl: f.col(['Compléments']), sui: f.col(['Suite']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code), tz), date = jumDate_(get(l, c.date), tz); if (!code || !date) return;
        var uid = jumTxt_(get(l, c.uid), tz) || ('H-' + date + '-' + code);
        pousser(l, { uid: uid, date: date, horodatage: jumHoro_(get(l, c.horo), tz), delegue: jumTxt_(get(l, c.del), tz), code: code, id_presence: jumVide_(get(l, c.idp), tz),
          nom: jumTxt_(get(l, c.nom), tz), type: jumTxt_(get(l, c.type), tz) || 'Médecin', specialite: jumTxt_(get(l, c.spec), tz), note: jumNote_(get(l, c.note)),
          commune: jumTxt_(get(l, c.co), tz), quartier: jumTxt_(get(l, c.q), tz), lieu: jumTxt_(get(l, c.lieu), tz), creneau: jumTxt_(get(l, c.cr), tz), statut: jumTxt_(get(l, c.st), tz) || 'Visite faite',
          type_echange: jumTxt_(get(l, c.act), tz), produits_presentes: jumVide_(get(l, c.prod), tz), echantillons: jumVide_(get(l, c.ech), tz),
          prochaine_visite: jumDate_(get(l, c.pro), tz), prochaine_etape: jumTxt_(get(l, c.pro), tz), commentaire: jumTxt_(get(l, c.com), tz),
          interlocuteur: jumTxt_(get(l, c.itl), tz), reactions: jumTxt_(get(l, c.rea), tz), stocks: jumTxt_(get(l, c.sto), tz), commande: jumTxt_(get(l, c.cmd), tz),
          complements: jumTxt_(get(l, c.cpl), tz), suite: jumTxt_(get(l, c.sui), tz) });
      });
      return out;
    case 'plannings':
      f = jumFeuille_(FEUILLES.plannings); if (!f) return null;
      tz = f.tz;
      c = { del: f.col(['Délégué']), date: f.col(['Date']), h: f.col(['HeurePrevue']), cr: f.col(['Créneau']), d: f.col(['Debut']), fi: f.col(['Fin']), idp: f.col(['IdPresence']), code: f.col(['CodeContact']),
        nom: f.col(['Nom']), spec: f.col(['Spécialité']), note: f.col(['Note']), q: f.col(['Quartier']), co: f.col(['Commune']), lieu: f.col(['Lieu/Etablissement']), st: f.col(['Statut']), et: f.col(['Etat']), pr: f.col(['Programme']), maj: f.col(['MiseAJour']), ida: f.col(['IdArret']), dep: f.col(['CibleDepuis']) };
      f.lignes.forEach(function (l) {
        var code = jumTxt_(get(l, c.code), tz), date = jumDate_(get(l, c.date), tz); if (!code || !date) return;
        var hv = get(l, c.h), heure = hv instanceof Date ? Utilities.formatDate(hv, tz, 'HH:mm') : jumTxt_(hv, tz);
        var majVal = get(l, c.maj);
        pousser(l, { delegue: jumTxt_(get(l, c.del), tz), date: date, heure: heure, creneau: jumTxt_(get(l, c.cr), tz), debut: jumTxt_(get(l, c.d), tz), fin: jumTxt_(get(l, c.fi), tz),
          id_presence: jumVide_(get(l, c.idp), tz), code: code, nom: jumTxt_(get(l, c.nom), tz), specialite: jumTxt_(get(l, c.spec), tz), note: jumNote_(get(l, c.note)),
          quartier: jumTxt_(get(l, c.q), tz), commune: jumTxt_(get(l, c.co), tz), lieu: jumTxt_(get(l, c.lieu), tz), statut: jumTxt_(get(l, c.st), tz), etat: jumTxt_(get(l, c.et), tz) || 'planifie', programme: jumTxt_(get(l, c.pr), tz),
          maj: jumHoro_(majVal, tz) || jumTxt_(majVal, tz), id_arret: jumTxt_(get(l, c.ida), tz), cible_depuis: jumTxt_(get(l, c.dep), tz) });
      });
      return out;
    case 'rapports':
      f = jumFeuille_(FEUILLES.rapports); if (!f) return null;
      tz = f.tz;
      c = { del: f.col(['Délégué']), date: f.col(['Date']), pv: f.col(['Visites prévues']), fa: f.col(['Visites faites']), nf: f.col(['Non faites']), sc: f.col(['Sans compte rendu']),
        sy: f.col(['Synthèse']), fm: f.col(['Faits marquants']), cc: f.col(['Concurrence']), be: f.col(['Besoins']), km: f.col(['Kilomètres']), vl: f.col(['Validé le']), maj: f.col(['Mise à jour']) };
      f.lignes.forEach(function (l) {
        var del = jumTxt_(get(l, c.del), tz), date = jumDate_(get(l, c.date), tz); if (!del || !date) return;
        var vlVal = get(l, c.vl), majVal = get(l, c.maj);
        pousser(l, { delegue: del, date: date, prevues: jumInt_(get(l, c.pv), 0), faites: jumInt_(get(l, c.fa), 0), non_faites: jumTxt_(get(l, c.nf), tz), sans_cr: jumInt_(get(l, c.sc), 0),
          synthese: jumTxt_(get(l, c.sy), tz), faits: jumTxt_(get(l, c.fm), tz), concurrence: jumTxt_(get(l, c.cc), tz), besoins: jumTxt_(get(l, c.be), tz), km: jumNum_(get(l, c.km)) || 0,
          valide_le: jumHoro_(vlVal, tz) || jumTxt_(vlVal, tz), maj: jumHoro_(majVal, tz) || jumTxt_(majVal, tz) });
      });
      return out;
    case 'quartiers':
      f = jumFeuille_(FEUILLES.quartiers); if (!f) return null;
      tz = f.tz;
      c = { ter: f.col(['Territoire']), z: f.col(['Zone']), co: f.col(['Commune']), sub: f.col(['Subdivision']),
        q: f.col(['Quartier']), se: f.col(['Secteur']), va: f.col(['Variantes']), la: f.col(['Latitude', 'Lat']), lo: f.col(['Longitude', 'Lon']) };
      if (c.q < 0) {
        c = { ter: -1, co: 0, q: 1, z: 2, la: 3, lo: 4, se: 5, sub: -1, va: -1 };
      }
      f.lignes.forEach(function (l) {
        var q = jumTxt_(get(l, c.q), tz); if (!q) return;
        pousser(l, { territoire: jumTxt_(get(l, c.ter), tz), zone: jumTxt_(get(l, c.z), tz), commune: jumTxt_(get(l, c.co), tz),
          subdivision: jumTxt_(get(l, c.sub), tz), quartier: q, secteur: jumTxt_(get(l, c.se), tz),
          variantes: jumTxt_(get(l, c.va), tz), lat: jumNum_(get(l, c.la)), lon: jumNum_(get(l, c.lo)) });
      });
      return out;
    case 'fiches_produits':
      f = jumFeuille_(FEUILLES.fiches); if (!f) return null;
      tz = f.tz;
      c = {}; CHAMPS_FICHES.forEach(function (x) { c[x[0]] = f.col([x[1]]); });
      f.lignes.forEach(function (l) {
        var p = jumTxt_(get(l, c.produit), tz); if (!p) return;
        pousser(l, { produit: p, gamme: jumTxt_(get(l, c.gamme), tz), aire: jumTxt_(get(l, c.aire), tz), dci: jumTxt_(get(l, c.dci), tz), classe: jumTxt_(get(l, c.classe), tz),
          indications: jumTxt_(get(l, c.indications), tz), contre_indications: jumTxt_(get(l, c.contreIndications), tz), posologie: jumTxt_(get(l, c.posologie), tz),
          precautions: jumTxt_(get(l, c.precautions), tz), effets: jumTxt_(get(l, c.effets), tz), arguments: jumTxt_(get(l, c.arguments), tz), laboratoire: jumTxt_(get(l, c.laboratoire), tz),
          sources: jumTxt_(get(l, c.sources), tz), actif: jumActif_(get(l, c.actif)) });
      });
      return out;
    case 'audit_logs':   // journal d'audit (Ecriture.gs, enregistrerAudit) : validations, corrections, lieux supprimés
      f = jumFeuille_(FEUILLES.audit || 'Audit_Logs'); if (!f) return null;
      tz = f.tz;
      c = { h: f.col(['Horodatage']), a: f.col(['Auteur']), ac: f.col(['Action']), e: f.col(['Entite']), co: f.col(['Code']), d: f.col(['Details']) };
      f.lignes.forEach(function (l) {
        var h = get(l, c.h); if (h === '' || h === null) return;
        pousser(l, { horodatage: jumHoro_(h, tz) || jumTxt_(h, tz), auteur: jumTxt_(get(l, c.a), tz), action: jumTxt_(get(l, c.ac), tz), entite: jumTxt_(get(l, c.e), tz), code: jumTxt_(get(l, c.co), tz), details: jumTxt_(get(l, c.d), tz) });
      });
      return out;
    case 'listes_reference':
      f = jumFeuille_(FEUILLES.listes); if (!f) return null;
      tz = f.tz;
      var cats = [['delegue', ['Délégués']], ['ferie', ['JoursFériés']], ['activite', ['Activités']], ['activite_pharmacie', ['ActivitésPharmacie']], ['produit', ['Produits']]];
      cats.forEach(function (ct) {
        var k = f.col(ct[1]); if (k < 0) return;
        var n = 0;
        f.lignes.forEach(function (l) {
          var v = ct[0] === 'ferie' ? jumDate_(l[k], tz) : jumTxt_(l[k], tz).trim(); if (!v) return;
          out.push({ categorie: ct[0], valeur: v, metadata: null, ordre: ++n, actif: true });
        });
      });
      // statuts : colonnes A (nom) et B (compte comme visite), comme lireStatuts
      var ns = 0;
      f.lignes.forEach(function (l) {
        var v = jumTxt_(l[0], tz).trim(); if (!v) return;
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
  quartiers: { cle: ['commune', 'quartier', 'secteur'] }, fiches_produits: { cle: ['produit'] }, listes_reference: { cle: ['categorie', 'valeur'] },
  audit_logs: { cle: ['horodatage', 'auteur', 'action', 'code', 'details'] }
};

function jumCle_(o, cols) { return cols.map(function (k) { return o[k] === null || o[k] === undefined ? '' : String(o[k]); }).join('|'); }
function jumDedoublonner_(rows, cols) { var vu = {}, out = []; for (var i = rows.length - 1; i >= 0; i--) { var k = jumCle_(rows[i], cols); if (!vu[k]) { vu[k] = 1; out.unshift(rows[i]); } } return out; }
function jumParLots_(l, n, fn) { for (var i = 0; i < l.length; i += n) fn(l.slice(i, i + n)); }
function jumIn_(vals) { return 'in.(' + vals.map(function (v) { return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }).join(',') + ')'; }

// Recopie d'une table : ajouts et modifications, puis suppression de ce qui n'existe plus dans le Sheet
function jumSyncTable_(table, rows, tout) {   // tout = true : toutes les lignes renvoyées (recopie forcée, écriture hors serveur détectée)
  var t = JUM_TABLES[table], n = { envoyees: 0, supprimees: 0 };
  if (t.pk) {
    rows = jumDedoublonner_(rows, [t.pk]);
    // lignes inchangées depuis le dernier envoi (empreinte par ligne en cache) : pas renvoyées, Supabase garde leur date de modification
    var connues = null; if (!tout) try { var tx = CacheService.getScriptCache().get('JRH_' + table); connues = tx ? JSON.parse(tx) : null; } catch (eC) {}
    var aEnvoyer = connues ? rows.filter(function (r) { return connues[String(r[t.pk])] !== jumEmpLigne_(r); }) : rows;
    jumParLots_(aEnvoyer, 400, function (lot) {
      jumOk_(jumPostLots_(table + '?on_conflict=' + t.pk, lot, 'resolution=merge-duplicates,return=minimal'), 'Envoi ' + table);
    });
    n.envoyees = aEnvoyer.length;
    var garder = {}; rows.forEach(function (r) { garder[String(r[t.pk])] = 1; });
    var exist = jumLireSupabase_(table, t.pk, t.pk);
    var aSuppr = exist.map(function (e) { return String(e[t.pk]); }).filter(function (k) { return !garder[k]; });
    jumParLots_(aSuppr, 80, function (lot) { jumOk_(jumReq_('delete', table + '?' + t.pk + '=' + encodeURIComponent(jumIn_(lot))), 'Suppression ' + table); });
    n.supprimees = aSuppr.length;
    n.total = rows.length;
    return n;
  }
  // tables à identifiant technique (uuid) : rapprochement par la clé naturelle
  rows = jumDedoublonner_(rows, t.cle);
  var existants = jumLireSupabase_(table, 'id,' + t.cle.join(','), 'id');
  var parCle = {}, doublons = [];
  existants.forEach(function (e) { var k = jumCle_(e, t.cle); if (parCle[k]) doublons.push(e.id); else parCle[k] = e.id; });
  var avecId = [], sansId = [], garde = {};
  rows.forEach(function (r) {
    var id = parCle[jumCle_(r, t.cle)];
    if (id) { var o = { id: id }; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); avecId.push(o); garde[id] = 1; }
    else sansId.push(r);
  });
  jumParLots_(avecId, 400, function (lot) { jumOk_(jumPostLots_(table + '?on_conflict=id', lot, 'resolution=merge-duplicates,return=minimal'), 'Mise à jour ' + table); });
  jumParLots_(sansId, 400, function (lot) { jumOk_(jumPostLots_(table, lot, 'return=minimal'), 'Ajout ' + table); });
  var aSuppr2 = existants.map(function (e) { return e.id; }).filter(function (id) { return !garde[id]; });
  jumParLots_(aSuppr2, 25, function (lot) { jumOk_(jumReq_('delete', table + '?id=' + encodeURIComponent(jumIn_(lot))), 'Suppression ' + table); });
  n.envoyees = rows.length; n.supprimees = aSuppr2.length; n.total = rows.length;
  return n;
}

// Synchronisation : force = true recopie toutes les tables, sinon seulement celles dont l'empreinte a changé
function jumEmpTable_(rows) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(rows), Utilities.Charset.UTF_8)); }
function jumNoterEmpreinte_(table, rows) {
  try { var p = PropertiesService.getScriptProperties(), e = JSON.parse(p.getProperty('SUPA_EMPREINTES') || '{}'); e[table] = jumEmpTable_(rows); p.setProperty('SUPA_EMPREINTES', JSON.stringify(e)); } catch (x) {}
}
function synchroniserSupabase(force) {
  var verrou = LockService.getScriptLock(), dejaVerrou = false;
  try { dejaVerrou = verrou.hasLock(); } catch (eH) {}
  if (!dejaVerrou && !verrou.tryLock(force === true ? 15000 : 5000)) return { ok: false, erreur: 'Synchronisation déjà en cours.' };
  var t0 = Date.now(), props = PropertiesService.getScriptProperties();
  var emp = JSON.parse(props.getProperty('SUPA_EMPREINTES') || '{}');
  var etat = JSON.parse(props.getProperty('SUPA_ETAT') || '{}'); etat.tables = etat.tables || {};
  var erreurs = 0, codesMed = null, praticiensOk = false, modifiees = [];
  try {
    // 1) d'abord ce qui a été modifié directement dans Supabase (Table Editor, SQL) : reporté dans le Sheet
    try { etat.retour = jumAppliquerSupabase_(); } catch (eR) { erreurs++; etat.retour = { erreur: String(eR.message || eR).slice(0, 300) }; }
    // 2) puis le Sheet vers Supabase (recalculer les formules dynamiques avant lecture)
    try { SpreadsheetApp.flush(); } catch (eFl) {}
    Object.keys(JUM_TABLES).forEach(function (table) {
      try {
        var rows = jumLignes_(table), ignorees = 0;
        if (rows === null) { etat.tables[table] = { sheets: 0, erreur: 'onglet absent (non recopié)' }; return; }
        if (table === 'presences') {
          // si praticiens a échoué (ou est absent/vide), on ne retient que les codes existant réellement dans Supabase pour éviter une 409 FK
          if (!codesMed) {
            var existMed = jumLireSupabase_('praticiens', 'code', 'code');
            codesMed = {};
            existMed.forEach(function (r) { codesMed[r.code] = 1; });
          }
          var av = rows.length;
          rows = rows.filter(function (r) { return codesMed[r.code]; });
          ignorees = av - rows.length;
        }
        // sécurité : un onglet de base vide ne vide jamais Supabase
        if (!rows.length && ['praticiens', 'presences', 'pharmacies', 'etablissements'].indexOf(table) >= 0) { etat.tables[table] = { sheets: 0, erreur: 'onglet vide (non recopié par sécurité)' }; return; }
        var h = jumEmpTable_(rows);
        // une écriture d'API hors serveur (ancienne version de l'appli) a pu modifier Supabase : la table est recopiée depuis le Sheet
        var horsServeur = false;
        try { var rq = jumReq_('get', table + '?select=' + (JUM_TABLES[table].pk || 'id') + '&maj_source=eq.api&limit=1'); horsServeur = rq.code === 200 && JSON.parse(rq.texte).length > 0; } catch (eA) {}
        if (force !== true && emp[table] === h && !horsServeur) {
          if (table === 'praticiens') { praticiensOk = true; codesMed = {}; rows.forEach(function (r) { codesMed[r.code] = 1; }); }
          return;
        }
        var n = jumSyncTable_(table, rows, force === true || horsServeur);
        modifiees.push(table);
        if (table === 'praticiens') { praticiensOk = true; codesMed = {}; rows.forEach(function (r) { codesMed[r.code] = 1; }); }
        if (table === 'presences' && !praticiensOk && ignorees > 0) delete emp[table];
        else emp[table] = h;
        jumMemoriserLignes_(table, rows);
        etat.tables[table] = { sheets: rows.length + ignorees, supabase: n.total, supprimees: n.supprimees, le: new Date().toISOString() };
        if (ignorees) etat.tables[table].ignorees = ignorees;
      } catch (e) {
        if (table === 'praticiens') { praticiensOk = false; codesMed = null; }
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
    jumDiffuser_(modifiees);
    Logger.log('JUMELAGE ' + (etat.ok ? 'OK' : erreurs + ' erreur(s)') + ' en ' + etat.duree + ' s ' + JSON.stringify(etat.tables));
    return { ok: etat.ok, etat: etat };
  } finally {
    if (!dejaVerrou) { try { verrou.releaseLock(); } catch (eR) {} }
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
  // 3.29.0 : le journal d'audit suit avec le jumelage de 5 minutes (il ne ralentit plus chaque enregistrement)
  valider: ['visites', 'praticiens', 'pharmacies', 'plannings'], fiche: ['praticiens', 'presences', 'pharmacies'], planning: ['plannings'],
  rapport: ['rapports'], delegue: ['listes_reference'], etablissement: ['etablissements', 'presences'],
  quartiers: ['quartiers', 'presences', 'pharmacies', 'etablissements', 'plannings'],
  fusion: ['etablissements', 'pharmacies', 'presences', 'visites', 'plannings', 'audit_logs']
};
// Appelée par doPost juste après l'écriture dans le Sheet : Supabase est à jour quand le téléphone reçoit la réponse
function jumPousserApresEcriture_(action) {
  var tables = Array.isArray(action) ? action : JUM_APRES_ACTION[action];
  if (!tables || !tables.length) return;
  var verrou = LockService.getScriptLock(), dejaVerrou = false;
  try { dejaVerrou = verrou.hasLock(); } catch (eH) {}
  if (!dejaVerrou && !verrou.tryLock(20000)) {
    console.warn('Jumelage différé (verrou occupé) pour ' + tables.join(','));
    return;
  }
  try {
    SpreadsheetApp.flush();
    var cache = CacheService.getScriptCache(), codesMed = null;
    jumPousserTables_(tables, cache, codesMed);
  } finally {
    if (!dejaVerrou) { try { verrou.releaseLock(); } catch (eR) {} }
    jumDiffuser_(tables);
  }
}
function jumPousserTables_(tables, cache, codesMed) {
  var praticiensDansLot = tables.indexOf('praticiens') >= 0, praticiensOk = !praticiensDansLot;
  tables.forEach(function (table) {
    try {
      var t = JUM_TABLES[table], rows = jumLignes_(table); if (!rows) return;
      var ignorees = 0;
      if (table === 'presences') {
        if (!codesMed) {
          if (praticiensOk) {
            var pr = jumLignes_('praticiens') || [];
            codesMed = {};
            pr.forEach(function (r) { codesMed[r.code] = 1; });
          } else {
            // Praticiens a échoué (ou est vide) dans ce lot : on vérifie les codes réellement en base pour éviter une 409 FK
            var existMed = jumLireSupabase_('praticiens', 'code', 'code');
            codesMed = {};
            existMed.forEach(function (r) { codesMed[r.code] = 1; });
          }
        }
        var av = rows.length;
        rows = rows.filter(function (r) { return codesMed[r.code]; });
        ignorees = av - rows.length;
      }
      if (!rows.length && ['praticiens', 'presences', 'pharmacies', 'etablissements'].indexOf(table) >= 0) return;
      var txt = t.pk ? cache.get('JRH_' + table) : null;
      if (!txt) {
        jumSyncTable_(table, rows);
        jumMemoriserLignes_(table, rows);
        if (praticiensOk || ignorees === 0) jumNoterEmpreinte_(table, rows);
        if (table === 'praticiens') { codesMed = {}; rows.forEach(function (r) { codesMed[r.code] = 1; }); praticiensOk = true; }
        return;
      }
      var m = JSON.parse(txt), aEnvoyer = [], presents = {};
      jumDedoublonner_(rows, [t.pk]).forEach(function (r) { var k = String(r[t.pk]), e = jumEmpLigne_(r); presents[k] = 1; if (m[k] !== e) { aEnvoyer.push(r); m[k] = e; } });
      jumParLots_(aEnvoyer, 400, function (lot) {
        jumOk_(jumPostLots_(table + '?on_conflict=' + t.pk, lot, 'resolution=merge-duplicates,return=minimal'), 'Envoi ' + table);
      });
      // lignes retirées du Sheet (ex. un lieu supprimé d'une fiche) : retirées de Supabase
      var retirees = Object.keys(m).filter(function (k) { return !presents[k]; });
      jumParLots_(retirees, 80, function (lot) { jumOk_(jumReq_('delete', table + '?' + t.pk + '=' + encodeURIComponent(jumIn_(lot))), 'Suppression ' + table); });
      retirees.forEach(function (k) { delete m[k]; });
      txt = JSON.stringify(m); if (txt.length < 95000) cache.put('JRH_' + table, txt, 21600);
      if (praticiensOk || ignorees === 0) jumNoterEmpreinte_(table, rows);
      if (table === 'praticiens') { codesMed = {}; rows.forEach(function (r) { codesMed[r.code] = 1; }); praticiensOk = true; }
    } catch (e) {
      if (table === 'praticiens') { praticiensOk = false; codesMed = null; }
      console.warn('Jumelage immédiat ' + table + ' : ' + e);
    }   // rattrapé par le tour de 5 minutes
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
    var verrou = LockService.getScriptLock(), dejaVerrou = false;
    try { dejaVerrou = verrou.hasLock(); } catch (eH) {}
    if (!dejaVerrou && !verrou.tryLock(20000)) {
      console.warn('jumSurEdition différé (verrou occupé) pour ' + table);
      return;
    }
    try {
      if (table === 'quartiers') {
        // 3.31.52 : 1) Pousser et diffuser immédiatement la table quartiers pour mise à jour temps réel dans l'app (< 2 s)
        SpreadsheetApp.flush();
        jumPousserApresEcriture_(['quartiers']);
        // 2) Répercuter rapidement les valeurs sur les fiches et plannings futurs (sans redéployer les 1800 formules)
        var tablesLiees = ['presences', 'pharmacies', 'etablissements', 'plannings'];
        try {
          var shAct = e.range.getSheet();
          if (shAct && shAct.getName() === FEUILLES.quartiers && typeof propagerQuartiersSurFiches_ === 'function') {
            var r0q = Math.max(2, e.range.getRow()), r1q = r0q + e.range.getNumRows() - 1;
            var lq = []; for (var iq = r0q; iq <= r1q; iq++) lq.push(iq);
            var optsQ = (e.range.getNumRows() === 1 && e.range.getNumColumns() === 1 && e.oldValue)
              ? { ancienLibelle: e.oldValue, seulementPlanningsFuturs: true }
              : { seulementPlanningsFuturs: true };
            var bilanQ = propagerQuartiersSurFiches_(SpreadsheetApp.getActive(), lq, optsQ);
            if (bilanQ && Array.isArray(bilanQ.tablesModifiees)) {
              tablesLiees = bilanQ.tablesModifiees.slice();
              if (bilanQ.plannings > 0 && tablesLiees.indexOf('plannings') < 0) tablesLiees.push('plannings');
            }
          }
        } catch (ePr) {}
        SpreadsheetApp.flush();
        if (tablesLiees.length) jumPousserApresEcriture_(tablesLiees);
      } else {
        SpreadsheetApp.flush();
        jumPousserApresEcriture_([table]);
      }
    } finally {
      if (!dejaVerrou) { try { verrou.releaseLock(); } catch (eR) {} }
    }
  } catch (err) { console.warn('jumSurEdition : ' + err); }
}

// Déclencheur installable onChange : capture insertions/suppressions de lignes ou collages (ex. onglet Quartiers) et resynchronise formules + Supabase
function jumSurChangement(e) {
  try {
    var type = e && e.changeType ? String(e.changeType) : '';
    if (type !== 'INSERT_ROW' && type !== 'REMOVE_ROW' && type !== 'EDIT' && type !== 'OTHER') return;
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getActiveSheet();
    SpreadsheetApp.flush();
    if (sh && sh.getName() === FEUILLES.quartiers) {
      jumPousserApresEcriture_(JUM_APRES_ACTION.quartiers);
    } else {
      synchroniserSupabase(false);
    }
  } catch (err) { console.warn('jumSurChangement : ' + err); }
}

// ---------------------------------------------------------------- Supabase -> Sheet (modifications faites directement dans Supabase)
// Chaque ligne modifiée hors serveur porte maj_source = 'supabase' (déclencheur SQL) ; chaque suppression est notée dans jumelage_suppressions.
// Colonnes : [colonne Supabase, libellés possibles de l'en-tête du Sheet, type]
var JUM_RETOUR = {
  praticiens: { feuille: 'praticiens', cle: [['code', ['CodeContact']]], cols: [['type', ['Type']], ['nom', ['Nom']], ['specialite', ['Spécialité']], ['note', ['Note'], 'n'], ['conventionne', ['Engagé'], 'b'],
    ['telephone', ['Téléphone']], ['derniere', ['DateDerniereVisite'], 'd'], ['statut', ['DernierStatut']], ['commentaire', ['DernierCommentaire']], ['nb_visites', ['NbVisites'], 'n'], ['actif', ['Actif'], 'b'],
    ['prochaine', ['ProchaineEtape'], 'd'], ['absent_du', ['AbsentDu'], 'd'], ['absent_au', ['AbsentAu'], 'd']] },
  presences: { feuille: 'presences', cle: [['id', ['IdPresence']]], cols: [['code', ['CodeContact']], ['nom', ['Nom']], ['lieu', ['Lieu/Etablissement']], ['quartier', ['Quartier']], ['commune', ['Commune']], ['zone', ['Zone']],
    ['territoire', ['Territoire']], ['subdivision', ['Subdivision']],
    ['lundi', ['Lundi']], ['mardi', ['Mardi']], ['mercredi', ['Mercredi']], ['jeudi', ['Jeudi']], ['vendredi', ['Vendredi']], ['horaire_matin', ['HoraireMatin']], ['horaire_soir', ['HoraireSoir']],
    ['lat', ['Latitude'], 'n'], ['lon', ['Longitude'], 'n'], ['secteur', ['Secteur']], ['reperes', ['Repères']], ['origine_gps', ['OrigineGPS']]] },
  pharmacies: { feuille: 'pharmacies', cle: [['code', ['CodeContact']]], cols: [['nom', ['Nom']], ['titulaire', ['Titulaire']], ['quartier', ['Quartier']], ['commune', ['Commune']], ['zone', ['Zone']],
    ['territoire', ['Territoire']], ['subdivision', ['Subdivision']], ['secteur', ['Secteur']],
    ['lat', ['Latitude'], 'n'], ['lon', ['Longitude'], 'n'], ['telephone', ['Téléphone']], ['horaire_matin', ['HoraireMatin']], ['horaire_soir', ['HoraireSoir']], ['note', ['Note'], 'n'], ['conventionne', ['Engagé'], 'b'],
    ['derniere', ['DateDerniereVisite'], 'd'], ['statut', ['DernierStatut']], ['commentaire', ['DernierCommentaire']], ['nb_visites', ['NbVisites'], 'n'], ['actif', ['Actif'], 'b'], ['reperes', ['Repères']],
    ['prochaine', ['ProchaineEtape'], 'd'], ['source', ['Source']], ['origine_gps', ['OrigineGPS']]] },
  etablissements: { feuille: 'etablissements', cle: [['code', ['CodeEtab']]], cols: [['nom', ['Nom']], ['categorie', ['Categorie']], ['commune', ['Commune']], ['quartier', ['Quartier']], ['zone', ['Zone']],
    ['territoire', ['Territoire']], ['subdivision', ['Subdivision']], ['secteur', ['Secteur']],
    ['lat', ['Latitude'], 'n'], ['lon', ['Longitude'], 'n'], ['telephone', ['Telephone', 'Téléphone']], ['reperes', ['Reperes', 'Repères']], ['position', ['Position']], ['origine_gps', ['OrigineGPS']]] },
  visites: { feuille: 'hist', cle: [['uid', ['IdSync']]], cols: [['date', ['DateVisite'], 'd'], ['delegue', ['Délégué']], ['code', ['CodeContact']], ['id_presence', ['IdPresence']], ['nom', ['Nom']], ['type', ['Type']],
    ['specialite', ['Spécialité']], ['note', ['Note'], 'n'], ['commune', ['Commune']], ['quartier', ['Quartier']], ['lieu', ['Lieu/Etablissement']], ['creneau', ['Créneau']], ['statut', ['Statut']],
    ['type_echange', ['Activité']], ['produits_presentes', ['Produits']], ['echantillons', ['Échantillons']], ['prochaine_etape', ['ProchaineEtape']], ['commentaire', ['Commentaire']],
    ['interlocuteur', ['Interlocuteur']], ['reactions', ['Réactions']], ['stocks', ['Stocks']], ['commande', ['Commande']], ['complements', ['Compléments']], ['suite', ['Suite']]] },
  rapports: { feuille: 'rapports', cle: [['delegue', ['Délégué']], ['date', ['Date'], 'd']], cols: [['prevues', ['Visites prévues'], 'n'], ['faites', ['Visites faites'], 'n'], ['non_faites', ['Non faites']],
    ['sans_cr', ['Sans compte rendu'], 'n'], ['synthese', ['Synthèse']], ['faits', ['Faits marquants']], ['concurrence', ['Concurrence']], ['besoins', ['Besoins']], ['km', ['Kilomètres'], 'n']] },
  quartiers: { feuille: 'quartiers', cle: [['commune', ['Commune']], ['quartier', ['Quartier']], ['secteur', ['Secteur']]], cols: [['territoire', ['Territoire']], ['zone', ['Zone']], ['subdivision', ['Subdivision']], ['variantes', ['Variantes']], ['lat', ['Latitude', 'Lat'], 'n'], ['lon', ['Longitude', 'Lon'], 'n']] },
  fiches_produits: { feuille: 'fiches', cle: [['produit', ['Produit']]], cols: [['gamme', ['Gamme']], ['aire', ['Aire thérapeutique']], ['dci', ['DCI et dosage']], ['classe', ['Classe']], ['indications', ['Indications']],
    ['contre_indications', ['Contre-indications']], ['posologie', ['Posologie']], ['precautions', ['Précautions et interactions']], ['effets', ['Effets indésirables']], ['arguments', ['Arguments clés']],
    ['laboratoire', ['Laboratoire']], ['sources', ['Sources']], ['actif', ['Actif'], 'b']] }
};
function jumVersSheet_(v, type) {
  if (v === null || v === undefined) return '';
  if (type === 'b') return v === true || v === 'true' ? 'Oui' : 'Non';
  if (type === 'n') { var n = Number(v); return isFinite(n) ? n : ''; }
  if (type === 'd') { var iso = jumDate_(v); return iso ? Utilities.parseDate(iso, jumTz_(), 'yyyy-MM-dd') : ''; }
  var s = String(v);
  if (/^\+/.test(s)) return "'" + s;
  return s;
}
function jumCleSheet_(v, type) { return type === 'd' ? (jumDate_(v) || '') : jumTxt_(v); }

function jumAppliquerSupabase_() {
  var verrou = LockService.getScriptLock(), dejaVerrou = false;
  try { dejaVerrou = verrou.hasLock(); } catch (eH) {}
  if (!dejaVerrou) verrou.waitLock(20000);
  try { return jumAppliquerSupabaseSousVerrou_(); } finally {
    if (!dejaVerrou) { try { verrou.releaseLock(); } catch (eR) {} }
  }
}
function jumAppliquerSupabaseSousVerrou_() {
  var ss = SpreadsheetApp.getActive(), tz = jumTz_(ss), bilan = { modifiees: 0, ajoutees: 0, supprimees: 0, erreurs: 0 };
  Object.keys(JUM_RETOUR).forEach(function (table) {
    var R = JUM_RETOUR[table], pk = JUM_TABLES[table].pk || 'id';
    var lignes = [], pas = 1000;
    for (var off = 0; off < 100000; off += pas) {
      var res = jumReq_('get', table + '?select=*&maj_source=eq.supabase&order=' + encodeURIComponent(pk) + '.asc&limit=' + pas + '&offset=' + off);
      jumOk_(res, 'Lecture des modifications ' + table);
      var page = JSON.parse(res.texte);
      lignes = lignes.concat(page);
      if (page.length < pas) break;
    }
    if (!lignes.length) return;
    var sh = ss.getSheetByName(FEUILLES[R.feuille]); if (!sh) return;
    var nc = sh.getLastColumn(), ent = sh.getRange(1, 1, 1, nc).getValues()[0].map(normaliser);
    var colDe = function (noms) { for (var i = 0; i < noms.length; i++) { var k = ent.indexOf(normaliser(noms[i])); if (k >= 0) return k; } return -1; };
    var kCle = R.cle.map(function (c) { return colDe(c[1]); });
    if (kCle.some(function (k) { return k < 0; })) return;
    var data = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues() : [];
    var kDate = table === 'visites' ? colDe(['DateVisite']) : -1, kCode = table === 'visites' ? colDe(['CodeContact']) : -1;
    var cleLigne = function (l) {
      var k = R.cle.map(function (c, j) { return jumCleSheet_(l[kCle[j]], c[2]); }).join('|');
      if (!k && table === 'visites') k = 'H-' + (jumDate_(l[kDate], tz) || '') + '-' + jumTxt_(l[kCode], tz);   // même identifiant que jumLignes_
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
        if (o.autres && typeof o.autres === 'object') Object.keys(o.autres).forEach(function (h) { var k = colDe([h]); if (k >= 0) ligne[k] = o.autres[h]; });
        if (i !== undefined) { sh.getRange(i + 2, 1, 1, nc).setValues([ligne]); data[i] = ligne; bilan.modifiees++; }
        else { sh.getRange(sh.getLastRow() + 1, 1, 1, nc).setValues([ligne]); data.push(ligne); index[cle] = data.length - 1; bilan.ajoutees++; }
        faites.push(o);
      } catch (e) { bilan.erreurs++; console.warn('Retour ' + table + ' : ' + e); }
    });
    // les lignes reportées repassent en maj_source = 'sheets'
    jumParLots_(faites.map(function (o) { return o[pk]; }), 80, function (lot) {
      jumOk_(jumReq_('patch', table + '?' + pk + '=' + encodeURIComponent(jumIn_(lot)), { maj_source: 'sheets' }, 'return=minimal'), 'Marquage ' + table);
    });
  });
  // suppressions faites dans Supabase
  var sup = [], pasSup = 500;
  for (var offSup = 0; offSup < 100000; offSup += pasSup) {
    var rs = jumReq_('get', 'jumelage_suppressions?select=*&order=id.asc&limit=' + pasSup + '&offset=' + offSup);
    jumOk_(rs, 'Lecture des suppressions');
    var pageSup = JSON.parse(rs.texte);
    sup = sup.concat(pageSup);
    if (pageSup.length < pasSup) break;
  }
  var traitees = [];
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

// ---------------------------------------------------------------- Contrôle : aucune information du Sheet absente de Supabase
// Lecture seule. Pour chaque onglet : lignes écartées (sans identifiant) et cellules dont la valeur ne se retrouve pas dans les lignes envoyées.
function jumVerifierCouverture() {
  var tz = jumTz_();
  var nv = function (v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.getFullYear() < 1901 ? jumTxt_(v, tz) : (v.getHours() || v.getMinutes() ? v.toISOString() : Utilities.formatDate(v, tz, 'yyyy-MM-dd'));
    if (typeof v === 'boolean') return String(v);
    var s = String(v).trim(), t = normaliser(s);
    if (t === 'oui' || t === 'true') return 'true';
    if (t === 'non' || t === 'false') return 'false';
    var n = parseFloat(s.replace(',', '.'));
    if (isFinite(n) && /^-?[\d\s.,]+$/.test(s)) return String(n);
    return s;
  };
  var feuilles = { praticiens: 'praticiens', presences: 'presences', pharmacies: 'pharmacies', etablissements: 'etablissements', visites: 'hist', plannings: 'plannings',
    rapports: 'rapports', quartiers: 'quartiers', fiches_produits: 'fiches', audit_logs: 'audit' };
  var bilan = {};
  Object.keys(feuilles).forEach(function (table) {
    var f = jumFeuille_(FEUILLES[feuilles[table]]); if (!f) return;
    var rows = jumLignes_(table) || [], vus = {};
    var ajouter = function (v) { if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { ajouter(v[k]); }); return; } vus[nv(v)] = 1; if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) vus[v.slice(0, 10)] = 1; };
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { ajouter(r[k]); }); });
    var manque = 0, ex = [];
    f.lignes.forEach(function (l) {
      l.forEach(function (v) {
        var x = nv(v); if (x === '' || vus[x]) return;
        if (v instanceof Date && vus[Utilities.formatDate(v, tz, 'yyyy-MM-dd')]) return;
        manque++; if (ex.length < 5) ex.push(String(v).slice(0, 40));
      });
    });
    var nonVides = f.lignes.filter(function (l) { return l.some(function (v) { return v !== '' && v !== null; }); }).length;
    bilan[table] = { lignesSheet: nonVides, lignesEnvoyees: rows.length, cellulesNonRetrouvees: manque, exemples: ex };
  });
  Logger.log('COUVERTURE ' + JSON.stringify(bilan));
  return bilan;
}
