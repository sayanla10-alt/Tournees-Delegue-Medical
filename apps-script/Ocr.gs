/**
 * 3.30.0 : lecture des fiches de visite photographiées (Répertoire › + Ajouter › Fiche)
 *
 * Le téléphone envoie la photo compressée (JPEG en base64). Le serveur :
 *   1. range la photo dans le dossier Drive « MediPlanner - Fiches scannées » (privé, propriétaire du script) ;
 *   2. la fait lire par Gemini (manuscrit, imprimé, cachets), qui rend un JSON structuré ;
 *   3. note la lecture dans l'onglet « Fiches scannées » (journal) ;
 *   4. renvoie la lecture au téléphone.
 * Rien n'est écrit dans Praticiens ni Présences ici : le délégué vérifie et valide sur son téléphone,
 * puis l'application envoie des fiches ordinaires (action « fiche »), avec les mêmes contrôles que la saisie à la main.
 *
 * Clé : propriété du script CLE_GEMINI (menu MediPlanner › Lecture des fiches photographiées), jamais dans le code
 * (le dépôt est public). Modèle : propriété MODELE_GEMINI, sinon MODELES_GEMINI_DEFAUT dans l'ordre.
 */

var DOSSIER_FICHES_SCANNEES = 'MediPlanner - Fiches scannées';
var ONGLET_FICHES_SCANNEES = 'Fiches scannées';
var MODELES_GEMINI_DEFAUT = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
var TAILLE_MAX_PHOTO = 8 * 1024 * 1024;   // octets, après décodage

var CONSIGNE_LECTURE_FICHE = [
  'Tu lis la photo d\'une fiche de visite ou d\'un rapport journalier d\'un délégué médical à Abidjan (Côte d\'Ivoire).',
  'La fiche peut mêler texte imprimé, écriture manuscrite et cachets (tampons) de médecins, de cliniques ou de pharmacies.',
  'Extrais uniquement ce qui est réellement écrit ou tamponné. N\'invente rien : un champ illisible ou absent vaut "".',
  'Pour chaque professionnel de santé visité (souvent identifié par son cachet) : titre (Dr, Pr, Prof, M., Mme), nom de famille, prénoms,',
  'spécialité médicale telle qu\'écrite, établissement de rattachement (hôpital, clinique, cabinet, centre de santé), téléphone, adresse.',
  'Pour chaque pharmacie : nom de l\'officine, adresse ou quartier, téléphone.',
  'Date de la visite au format AAAA-MM-JJ (les dates de la fiche sont écrites jour/mois/année). Ville, commune et quartier prospectés si indiqués.',
  'Téléphones ivoiriens : 10 chiffres (ex. 07 07 12 34 56) ; recopie les chiffres sans espaces ni indicatif.',
  'source = "cachet", "manuscrit" ou "imprime" selon d\'où vient surtout l\'information ; confiance entre 0 et 1.',
  'Mets dans remarques ce qui est utile mais ne rentre dans aucun champ (ex. commande, rupture, absence du médecin).'
].join('\n');

function schemaLectureFiche_() {
  var S = function (d) { return { type: 'STRING', description: d }; };
  var pro = { type: 'OBJECT', properties: {
    titre: S('Dr, Pr, Prof, M., Mme'), nom: S('Nom de famille'), prenoms: S('Prénoms'), specialite: S('Spécialité telle qu\'écrite'),
    etablissement: S('Hôpital, clinique, cabinet ou centre de santé'), telephone: S('10 chiffres'), adresse: S('Adresse ou repères'),
    quartier: S('Quartier'), commune: S('Commune'), source: S('cachet, manuscrit ou imprime'), confiance: { type: 'NUMBER' } },
    required: ['nom'] };
  var pha = { type: 'OBJECT', properties: {
    nom: S('Nom de l\'officine'), adresse: S('Adresse ou repères'), quartier: S('Quartier'), commune: S('Commune'), telephone: S('10 chiffres'),
    source: S('cachet, manuscrit ou imprime'), confiance: { type: 'NUMBER' } }, required: ['nom'] };
  return { type: 'OBJECT', properties: {
    date_visite: S('AAAA-MM-JJ'), ville: S('Ville'), commune: S('Commune prospectée'), quartier: S('Quartier prospecté'),
    medecins: { type: 'ARRAY', items: pro }, pharmacies: { type: 'ARRAY', items: pha }, remarques: S('Autres informations utiles') },
    required: ['medecins', 'pharmacies'] };
}

// Action « lireFiche » : { image (base64 JPEG), mime, auteur, uid }
function lireFichePhoto(body) {
  var cle = PropertiesService.getScriptProperties().getProperty('CLE_GEMINI');
  if (!cle) return { ok: false, refus: true, erreur: 'Lecture des fiches non configurée : ajoutez la clé Gemini (menu MediPlanner › Lecture des fiches photographiées).' };
  var b64 = String(body.image || '').replace(/^data:[^,]+,/, '');
  if (!b64) return { ok: false, refus: true, erreur: 'Aucune photo reçue.' };
  var mime = /^image\/(jpeg|png|webp)$/.test(body.mime || '') ? body.mime : 'image/jpeg';
  var octets = Utilities.base64Decode(b64);
  if (octets.length > TAILLE_MAX_PHOTO) return { ok: false, refus: true, erreur: 'Photo trop lourde.' };

  // anti-doublon : une photo renvoyée après une coupure n'est ni rangée ni lue deux fois (6 h)
  var cache = body.uid ? CacheService.getScriptCache() : null, cleC = body.uid ? 'lect_' + body.uid : '';
  var connu = cache ? cache.get(cleC) : null;
  if (connu) return JSON.parse(connu);

  var auteur = String(body.auteur || '').trim() || 'inconnu';
  var photo = rangerPhotoFiche_(octets, mime, auteur);
  var lecture, erreur = '';
  try { lecture = appelerGemini_(cle, b64, mime); }
  catch (e) { erreur = String(e.message || e); }
  journaliserFicheScannee_(auteur, photo, lecture, erreur);
  enregistrerAudit(SpreadsheetApp.getActive(), auteur, 'LECTURE_FICHE', 'Fiche', photo.id, erreur ? 'Erreur : ' + erreur : resumeLecture_(lecture));
  if (erreur) return { ok: false, erreur: 'Lecture impossible : ' + erreur, refus: /clé|key|API_KEY|PERMISSION|403|400/i.test(erreur), photo: photo };
  var r = { ok: true, lecture: lecture, photo: photo };
  if (cache) { try { cache.put(cleC, JSON.stringify(r), 21600); } catch (eC) {} }
  return r;
}

function resumeLecture_(l) {
  if (!l) return '';
  return (l.date_visite || 'sans date') + ' · ' + (l.medecins || []).length + ' médecin(s) · ' + (l.pharmacies || []).length + ' pharmacie(s)';
}

function dossierFichesScannees_() {
  var it = DriveApp.getFoldersByName(DOSSIER_FICHES_SCANNEES);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DOSSIER_FICHES_SCANNEES);
}

function rangerPhotoFiche_(octets, mime, auteur) {
  var nom = Utilities.formatDate(new Date(), 'Africa/Abidjan', 'yyyy-MM-dd_HH-mm-ss') + '_' + auteur.replace(/[^\wÀ-ÿ -]+/g, '').trim().replace(/\s+/g, '-') + '.' + (mime === 'image/png' ? 'png' : 'jpg');
  var f = dossierFichesScannees_().createFile(Utilities.newBlob(octets, mime, nom));
  return { id: f.getId(), url: f.getUrl(), nom: nom };
}

function appelerGemini_(cle, b64, mime) {
  var prop = PropertiesService.getScriptProperties().getProperty('MODELE_GEMINI');
  var modeles = prop ? [prop] : MODELES_GEMINI_DEFAUT, derniere = '';
  var corps = {
    contents: [{ role: 'user', parts: [{ text: CONSIGNE_LECTURE_FICHE }, { inline_data: { mime_type: mime, data: b64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schemaLectureFiche_() }
  };
  for (var i = 0; i < modeles.length; i++) {
    var rep = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modeles[i]) + ':generateContent', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': cle }, payload: JSON.stringify(corps), muteHttpExceptions: true });
    var code = rep.getResponseCode(), txt = rep.getContentText();
    if (code === 404) { derniere = 'modèle ' + modeles[i] + ' indisponible'; continue; }   // modèle retiré : on essaie le suivant
    if (code !== 200) {
      var msg = txt; try { msg = JSON.parse(txt).error.message; } catch (e) {}
      throw new Error('Gemini ' + code + ' : ' + String(msg).slice(0, 300));
    }
    var o = JSON.parse(txt), cand = o.candidates && o.candidates[0];
    var t = cand && cand.content && cand.content.parts && cand.content.parts.map(function (p) { return p.text || ''; }).join('');
    if (!t) throw new Error('réponse vide' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
    return nettoyerLecture_(JSON.parse(t.replace(/^```(json)?\s*|\s*```$/g, '')));
  }
  throw new Error(derniere || 'aucun modèle disponible');
}

// Garde-fous sur ce que rend le modèle : types, longueurs, date au bon format, téléphones en chiffres
function nettoyerLecture_(l) {
  var s = function (v, n) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 120); };
  var tel = function (v) { var d = String(v || '').replace(/\D/g, ''); if (d.indexOf('225') === 0 && d.length === 13) d = d.slice(3); return d.length >= 8 && d.length <= 13 ? d : ''; };
  var conf = function (v) { var x = +v; return isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5; };
  var date = s(l && l.date_visite, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    var m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s(l && l.date_visite, 12));
    date = m ? (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
  }
  return {
    date_visite: date, ville: s(l && l.ville, 60), commune: s(l && l.commune, 60), quartier: s(l && l.quartier, 80),
    medecins: ((l && l.medecins) || []).slice(0, 30).map(function (x) {
      return { titre: s(x.titre, 12), nom: s(x.nom, 80), prenoms: s(x.prenoms, 80), specialite: s(x.specialite, 80), etablissement: s(x.etablissement, 120),
               telephone: tel(x.telephone), adresse: s(x.adresse, 160), quartier: s(x.quartier, 80), commune: s(x.commune, 60), source: s(x.source, 12), confiance: conf(x.confiance) };
    }).filter(function (x) { return x.nom; }),
    pharmacies: ((l && l.pharmacies) || []).slice(0, 30).map(function (x) {
      return { nom: s(x.nom, 120), adresse: s(x.adresse, 160), quartier: s(x.quartier, 80), commune: s(x.commune, 60), telephone: tel(x.telephone), source: s(x.source, 12), confiance: conf(x.confiance) };
    }).filter(function (x) { return x.nom; }),
    remarques: s(l && l.remarques, 600)
  };
}

function journaliserFicheScannee_(auteur, photo, lecture, erreur) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(ONGLET_FICHES_SCANNEES);
  if (!sh) {
    sh = ss.insertSheet(ONGLET_FICHES_SCANNEES);
    sh.getRange(1, 1, 1, 7).setValues([['Horodatage', 'Délégué', 'Photo', 'DateFiche', 'Résumé', 'Lecture', 'Erreur']]).setFontWeight('bold');
  }
  sh.appendRow([Utilities.formatDate(new Date(), 'Africa/Abidjan', 'yyyy-MM-dd HH:mm'), auteur, photo ? photo.url : '', lecture ? lecture.date_visite : '',
                lecture ? resumeLecture_(lecture) : '', lecture ? JSON.stringify(lecture).slice(0, 45000) : '', erreur || '']);
}

// Menu : enregistrer ou changer la clé Gemini (gardée dans les propriétés du script, jamais dans le code)
function configurerLectureFiches() {
  var ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties();
  var r = ui.prompt('Lecture des fiches photographiées', 'Collez la clé Gemini (aistudio.google.com › Get API key).' +
    (props.getProperty('CLE_GEMINI') ? '\nUne clé est déjà enregistrée : la nouvelle la remplacera.' : ''), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var cle = String(r.getResponseText() || '').trim();
  if (!cle) { ui.alert('Aucune clé saisie : rien n\'a changé.'); return; }
  props.setProperty('CLE_GEMINI', cle);
  ui.alert('Clé enregistrée. Les délégués peuvent photographier leurs fiches (Répertoire › + Ajouter › Fiche).');
}
