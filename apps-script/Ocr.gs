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
  'Tu agis en tant que superviseur d\'un collège d\'agents d\'intelligence artificielle médicale hautement spécialisés, collaborant en pipeline strict pour extraire et vérifier les fiches manuscrites et tamponnées de rapport journalier en Côte d\'Ivoire.',
  '',
  'PIPELINE MULTI-AGENTS HIÉRARCHISÉ :',
  '',
  '--- ÉTAPE 1 : EXTRACTION SPATIALE & MANUSCRITE (DEUX AGENTS DÉDIÉS) ---',
  '1. AGENT 1A (Cartographe Spatial & En-tête) :',
  '   - Détecte l\'en-tête : date (AAAA-MM-JJ), nom du délégué, commune et quartier prospectés.',
  '   - Balaye la feuille de haut en bas et compte avec exactitude chaque arrêt ou ligne de visite ("nb_lignes").',
  '2. AGENT 1B (Extracteur de l\'Écriture Manuscrite) :',
  '   - Lit spécifiquement les écritures à la main portées par le délégué sur chaque ligne : nom noté, spécialité, téléphone, et surtout le LIEU RÉEL EFFECTIF où la visite s\'est tenue (clinique, hôpital, cabinet).',
  '',
  '--- ÉTAPE 2 : EXTRACTION DES CACHETS & ENCRE DIFFICILE (DEUX AGENTS DÉDIÉS) ---',
  '3. AGENT 2A (Détecteur & Isoleur de Tampons Encreurs) :',
  '   - Repère chaque empreinte de cachet médical (ronde, rectangulaire, ovale, même inclinée, en marge ou en bas de page).',
  '   - Isole les mentions gravées : titre, nom, spécialité, numéros d\'ordre ONMCI, téléphone, établissement d\'attache.',
  '4. AGENT 2B (Spécialiste Encre Baveuse & Caractères Estompés) :',
  '   - Analyse les encrages baveux, faibles ou partiellement effacés.',
  '   - Décrypte fidèlement les bribes alphabétiques réelles sans extrapolation fantaisiste (ex: identifie les lettres "K...BENAN" et "R...SINE").',
  '',
  '--- ÉTAPE 3 : ARBITRAGE DES EXTRACTIONS (AGENT ARBITRE CENTRAL) ---',
  '5. AGENT 3 (Arbitre Confronteur des Extractions 1 et 2) :',
  '   - Confronte pour chaque ligne ce qu\'ont extrait les Agents 1 (manuscrit) et les Agents 2 (cachet).',
  '   - DISSOCIATION CRUCIALE DU LIEU : Si le cachet indique un hôpital d\'attache A (ex: CHU Treichville) mais que le délégué a noté à la main une clinique B (ex: Clinique Sainte Marie), l\'arbitre retient la CLINIQUE B comme lieu effectif de la visite ("etablissement"). Le CHU reste consigné dans "transcription".',
  '   - ÉLIMINATION DES FAUX POSITIFS : Élimine formellement les mentions de visa ("Vu", "Visa", "R.A.S", "Reçu", "Bon", signatures seules) : NE JAMAIS créer de contact pour ces lignes parasites.',
  '',
  '--- ÉTAPE 4 & 5 : CONTRÔLE ONOMASTIQUE, OFFICINES & SUPERVISION ---',
  '6. AGENT 4 (Normalisateur Onomastique & Téléphonique CI) :',
  '   - ZÉRO DÉDOUBLEMENT DE TITRE : "titre" contient Dr, Pr, SF ou IDE. Le titre est STRICTEMENT RETIRÉ du champ "nom" et du champ "prenoms" (jamais "Dr Dr Kouassi").',
  '   - Format téléphone CI : strict 10 chiffres (mobiles 07, 05, 01 ; fixes 27, 25, 21).',
  '7. AGENT 5 (Ségrégation Officines & Contrôle d\'Exhaustivité) :',
  '   - Sépare clairement les pharmacies d\'officine (dans "pharmacies") des praticiens (dans "medecins").',
  '   - Recopie l\'intégralité brute dans "transcription" (séparée par " | "). Attribue une note de confiance objective.'
].join('\n');

function schemaLectureFiche_() {
  var S = function (d) { return { type: 'STRING', description: d }; };
  var pro = { type: 'OBJECT', propertyOrdering: ['ligne', 'transcription', 'titre', 'nom', 'prenoms', 'specialite', 'etablissement', 'telephone', 'adresse', 'quartier', 'commune', 'source', 'confiance'], properties: {
    ligne: { type: 'INTEGER', description: 'Numéro de la ligne sur la fiche' }, transcription: S('Recopie intégrale de TOUT le texte de la ligne et de son cachet : nom, spécialité, établissement, téléphones, adresse, numéro d\'ordre, séparés par | '), titre: S('Dr, Pr, Prof, M., Mme, SF, IDE'), nom: S('Nom de famille'), prenoms: S('Prénoms'), specialite: S('Spécialité telle qu\'écrite'),
    etablissement: S('Hôpital, clinique, cabinet ou centre de santé'), telephone: S('10 chiffres'), adresse: S('Adresse ou repères'),
    quartier: S('Quartier'), commune: S('Commune'), source: S('cachet, manuscrit ou imprime'), confiance: { type: 'NUMBER' } },
    required: ['ligne', 'transcription', 'titre', 'nom', 'prenoms', 'specialite', 'etablissement', 'telephone', 'adresse', 'quartier', 'commune', 'source', 'confiance'] };
  var pha = { type: 'OBJECT', propertyOrdering: ['ligne', 'transcription', 'nom', 'adresse', 'quartier', 'commune', 'telephone', 'source', 'confiance'], properties: {
    ligne: { type: 'INTEGER', description: 'Numéro de la ligne sur la fiche' }, transcription: S('Recopie intégrale de TOUT le texte de la ligne et de son cachet : nom, spécialité, établissement, téléphones, adresse, numéro d\'ordre, séparés par | '), nom: S('Nom de l\'officine'), adresse: S('Adresse ou repères'), quartier: S('Quartier'), commune: S('Commune'), telephone: S('10 chiffres'),
    source: S('cachet, manuscrit ou imprime'), confiance: { type: 'NUMBER' } }, required: ['ligne', 'transcription', 'nom', 'adresse', 'quartier', 'commune', 'telephone', 'source', 'confiance'] };
  return { type: 'OBJECT', propertyOrdering: ['nb_lignes', 'date_visite', 'ville', 'commune', 'quartier', 'medecins', 'pharmacies', 'remarques'], properties: {
    nb_lignes: { type: 'INTEGER', description: 'Nombre de lignes ou de cachets de visite comptés sur la fiche' },
    date_visite: S('AAAA-MM-JJ'), ville: S('Ville'), commune: S('Commune prospectée'), quartier: S('Quartier prospecté'),
    medecins: { type: 'ARRAY', items: pro }, pharmacies: { type: 'ARRAY', items: pha }, remarques: S('Autres informations utiles') },
    required: ['nb_lignes', 'medecins', 'pharmacies'] };
}

// Action « lireFiche » : { image (base64 JPEG), mime, auteur, uid }
function lireFichePhoto(body) {
  // 3.30.2 : Gemini d'abord ; Claude (API Anthropic) en secours si Gemini manque ou échoue
  var props = PropertiesService.getScriptProperties(), cle = props.getProperty('CLE_GEMINI'), cleClaude = props.getProperty('CLE_ANTHROPIC');
  if (!cle && !cleClaude) return { ok: false, refus: true, erreur: 'Lecture des fiches non configurée : ajoutez une clé (menu MediPlanner › Lecture des fiches photographiées).' };
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
  var moteurs = [];
  if (cle) moteurs.push(['Gemini', function () { return appelerGemini_(cle, b64, mime); }]);
  if (cleClaude) moteurs.push(['Claude', function () { return appelerClaude_(cleClaude, b64, mime); }]);
  var erreurs = [];
  for (var i = 0; i < moteurs.length && !lecture; i++) {
    try { lecture = moteurs[i][1](); lecture.moteur = moteurs[i][0]; }
    catch (e) { erreurs.push(moteurs[i][0] + ' : ' + String(e.message || e)); }
  }
  if (!lecture) erreur = erreurs.join(' ; ');
  else lecture = agentReconciliationBdd_(lecture);
  journaliserFicheScannee_(auteur, photo, lecture, erreur);
  enregistrerAudit(SpreadsheetApp.getActive(), auteur, 'LECTURE_FICHE', 'Fiche', photo.id, erreur ? 'Erreur : ' + erreur : resumeLecture_(lecture));
  if (erreur) return { ok: false, erreur: 'Lecture impossible : ' + erreur, refus: /clé|key|API_KEY|PERMISSION|403|400/i.test(erreur), photo: photo };
  var r = { ok: true, lecture: lecture, photo: photo };
  if (cache) { try { cache.put(cleC, JSON.stringify(r), 21600); } catch (eC) {} }
  return r;
}

function agentReconciliationBdd_(lecture) {
  if (!lecture || !lecture.medecins || !lecture.medecins.length) return lecture;
  try {
    var ss = SpreadsheetApp.getActive(), shP = ss && ss.getSheetByName(FEUILLES.praticiens);
    if (!shP || shP.getLastRow() <= 1) return lecture;
    var raw = shP.getRange(2, 1, Math.min(600, shP.getLastRow() - 1), 6).getValues();
    var basePrats = raw.map(function (r) {
      return { code: String(r[0] || '').trim(), type: String(r[1] || '').trim(), nom: String(r[2] || '').trim(), specialite: String(r[3] || '').trim(), telephone: String(r[5] || '').trim() };
    }).filter(function (p) { return p.nom && p.type !== 'Pharmacie'; });

    lecture.medecins.forEach(function (med) {
      var nomLu = String(med.nom || '').trim(), prenomsLus = String(med.prenoms || '').trim();
      var texteComplet = (nomLu + ' ' + prenomsLus).toLowerCase();
      var motsLus = sansAccents(texteComplet).split(/[^a-z]+/).filter(function (w) { return w.length >= 3; });
      var speLue = specialiteCanonique(med.specialite || '');
      var telLu = String(med.telephone || '').replace(/\D/g, '');

      var meilleurPrat = null, meilleurScore = 0, meilleureRaison = '';

      basePrats.forEach(function (p) {
        var pNomSansAcc = sansAccents(p.nom).toLowerCase();
        var pMots = pNomSansAcc.split(/[^a-z]+/).filter(function (w) { return w.length >= 3; });
        var pSpe = specialiteCanonique(p.specialite || '');
        var pTel = String(p.telephone || '').replace(/\D/g, '');

        var memeSpe = !!(speLue && pSpe && speLue === pSpe);
        var memeTel = !!(telLu && pTel && (telLu === pTel || (telLu.length >= 8 && pTel.length >= 8 && telLu.slice(-8) === pTel.slice(-8))));

        // Score de fuzzy matching hybride (inversion, phonétique CI, sous-ensembles de prénoms multiples)
        var fuzzy = scoreFuzzyNom(texteComplet, p.nom);

        // Recherche des mots très proches (ex: "Koabenan" vs "Kouabenan", "Prosine" vs "Rosine")
        var maxSim = 0, motMatch = '', nbMotsMatchs = 0;
        motsLus.forEach(function (w) {
          var bestW = 0, bestPW = '';
          pMots.forEach(function (pw) {
            var sim = similariteLevenshtein(w, pw);
            if (sim > bestW) { bestW = sim; bestPW = pw; }
          });
          if (bestW > maxSim) { maxSim = bestW; motMatch = bestPW; }
          if (bestW >= 0.80) nbMotsMatchs++;
        });

        var score = 0;
        if (memeTel) score += 50;
        if (fuzzy >= 0.90) score += 65;
        else if (fuzzy >= 0.80) score += 45;
        else if (fuzzy >= 0.65) score += 25;
        if (nbMotsMatchs >= 2) score += 35; // Patronyme + Prénom reconnus même si le prénom traditionnel intermédiaire n'était pas sur le cachet
        if (memeSpe) score += 30;

        if (score > meilleurScore && score >= 45) {
          meilleurScore = score;
          meilleurPrat = p;
          var details = [];
          if (fuzzy >= 0.90 || nbMotsMatchs >= 2) details.push('nom/prénom identifié en base (' + p.nom + ')');
          else if (maxSim >= 0.75) details.push('nom approchant (' + motMatch + ')');
          if (memeSpe) details.push('même spécialité (' + p.specialite + ')');
          if (memeTel) details.push('même tél');
          meilleureRaison = details.join(' · ') || 'concordance base';
        }
      });

      if (meilleurPrat) {
        med.reconciliation = {
          code: meilleurPrat.code,
          nom: meilleurPrat.nom,
          specialite: meilleurPrat.specialite,
          telephone: meilleurPrat.telephone,
          raison: meilleureRaison,
          certitude: meilleurScore >= 60 ? 'haute' : 'probable'
        };
        // Si certitude haute, on propose le nom exact de la BDD
        if (meilleurScore >= 55) {
          med.nom_bdd_suggere = meilleurPrat.nom;
        }
      }
    });
  } catch (e) {
    console.warn('Erreur réconciliation BDD OCR : ' + e);
  }
  return lecture;
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

function referentielPraticiensPourOcr_() {
  try {
    var ss = SpreadsheetApp.getActive(), sh = ss && ss.getSheetByName(FEUILLES.praticiens);
    if (!sh || sh.getLastRow() <= 1) return '';
    var vals = sh.getRange(2, 1, Math.min(400, sh.getLastRow() - 1), 6).getValues();
    var liste = vals.map(function (r) {
      var nom = String(r[2] || '').trim();
      var spe = String(r[3] || '').trim();
      var tel = String(r[5] || '').trim();
      return nom ? (nom + (spe ? ' [' + spe + ']' : '') + (tel ? ' ' + tel : '')) : '';
    }).filter(Boolean);
    if (!liste.length) return '';
    return '\n\nRÉFÉRENTIEL DES MÉDECINS ET PHARMACIENS ENREGISTRÉS DANS LA BASE (AIDE INDISPENSABLE AUX CACHETS IMPARFAITS/BAVEUX) :\n' +
      liste.slice(0, 250).join(' ; ') +
      '\nCONSIGNE D\'AIDE : Si un cachet est baveux, mal tamponné ou à moitié lisible (ex: lettres estompées dans le patronyme), utilise cette liste de praticiens enregistrés pour identifier le médecin réel (croisement nom, prénom, spécialité, téléphone) au lieu d\'extrapoler un nom erroné.';
  } catch (e) {
    return '';
  }
}

function appelerGemini_(cle, b64, mime) {
  var prop = PropertiesService.getScriptProperties().getProperty('MODELE_GEMINI');
  var modeles = prop ? [prop].concat(MODELES_GEMINI_DEFAUT.filter(function (m) { return m !== prop; })) : MODELES_GEMINI_DEFAUT, derniere = '';
  var consigneComplete = CONSIGNE_LECTURE_FICHE + referentielPraticiensPourOcr_();
  var envoyer = function (modele, parts) {
    return UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modele) + ':generateContent', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': cle }, muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ role: 'user', parts: parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 16384, responseMimeType: 'application/json', responseSchema: schemaLectureFiche_() } }) });
  };
  var lire = function (rep) {
    var o = JSON.parse(rep.getContentText()), cand = o.candidates && o.candidates[0];
    var t = cand && cand.content && cand.content.parts && cand.content.parts.map(function (p) { return p.text || ''; }).join('');
    if (!t) throw new Error('réponse vide' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
    return JSON.parse(t.replace(/^```(json)?\s*|\s*```$/g, ''));
  };
  var image = { inline_data: { mime_type: mime, data: b64 } };
  for (var i = 0; i < modeles.length; i++) {
    for (var essai = 0; essai < 2; essai++) {
      var rep = envoyer(modeles[i], [{ text: consigneComplete }, image]), code = rep.getResponseCode();
      if (code === 200) {
        var l = lire(rep), n = ((l.medecins || []).length + (l.pharmacies || []).length);
        // 3.31.1 : moins d'entrées que de lignes comptées : seconde lecture ciblée, on garde la plus complète
        if (+l.nb_lignes > n) {
          try {
            var rep2 = envoyer(modeles[i], [{ text: consigneComplete + '\nATTENTION : tu as compté ' + l.nb_lignes + ' lignes mais rendu seulement ' + n + ' entrée(s). Relis toute la fiche ligne par ligne, de haut en bas, et rends une entrée pour CHACUNE des ' + l.nb_lignes + ' lignes.' }, image]);
            if (rep2.getResponseCode() === 200) { var l2 = lire(rep2); if ((l2.medecins || []).length + (l2.pharmacies || []).length > n) l = l2; }
          } catch (e2) {}
        }
        return nettoyerLecture_(l);
      }
      var txt = rep.getContentText(), msg = txt; try { msg = JSON.parse(txt).error.message; } catch (e) {}
      derniere = 'Gemini ' + code + ' : ' + String(msg).slice(0, 300);
      if (code === 404) break;                                                          // modèle retiré : suivant
      if (code === 429 || code >= 500) { if (essai === 0) { Utilities.sleep(2500); continue; } break; }   // surcharge : on réessaie, puis modèle suivant
      throw new Error(derniere);                                                        // clé, crédit, requête : inutile d'insister
    }
  }
  throw new Error(derniere || 'aucun modèle disponible');
}

// 3.30.2 : lecture par Claude (API Anthropic) : même consigne, sortie imposée par un outil au schéma JSON
var MODELES_CLAUDE_DEFAUT = ['claude-sonnet-5-5', 'claude-haiku-5-5'];
function schemaJson_(o) {
  var r = {};
  Object.keys(o).forEach(function (k) {
    var v = o[k];
    if (k === 'type') r.type = String(v).toLowerCase();
    else if (k === 'properties') { r.properties = {}; Object.keys(v).forEach(function (p) { r.properties[p] = schemaJson_(v[p]); }); }
    else if (k === 'items') r.items = schemaJson_(v);
    else if (k === 'propertyOrdering') return;   // propre à Gemini
    else r[k] = v;
  });
  return r;
}
function appelerClaude_(cle, b64, mime) {
  var prop = PropertiesService.getScriptProperties().getProperty('MODELE_CLAUDE');
  var modeles = prop ? [prop] : MODELES_CLAUDE_DEFAUT, derniere = '';
  var consigneComplete = CONSIGNE_LECTURE_FICHE + referentielPraticiensPourOcr_();
  for (var i = 0; i < modeles.length; i++) {
    var corps = {
      model: modeles[i], max_tokens: 8192, temperature: 0,
      tools: [{ name: 'lecture_fiche', description: 'Enregistre ce qui est lu sur la fiche de visite.', input_schema: schemaJson_(schemaLectureFiche_()) }],
      tool_choice: { type: 'tool', name: 'lecture_fiche' },
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } }, { type: 'text', text: consigneComplete }] }]
    };
    var rep = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(corps), muteHttpExceptions: true,
      headers: { 'x-api-key': cle, 'anthropic-version': '2023-06-01' } });
    var code = rep.getResponseCode(), txt = rep.getContentText();
    if (code === 404) { derniere = 'modèle ' + modeles[i] + ' indisponible'; continue; }
    if (code !== 200) {
      var msg = txt; try { msg = JSON.parse(txt).error.message; } catch (e) {}
      throw new Error('Claude ' + code + ' : ' + String(msg).slice(0, 300));
    }
    var o = JSON.parse(txt), bloc = (o.content || []).filter(function (c) { return c.type === 'tool_use'; })[0];
    if (!bloc || !bloc.input) throw new Error('réponse vide' + (o.stop_reason ? ' (' + o.stop_reason + ')' : ''));
    return nettoyerLecture_(bloc.input);
  }
  throw new Error(derniere || 'aucun modèle disponible');
}

// Garde-fous sur ce que rend le modèle : types, longueurs, date au bon format, téléphones en chiffres
// 3.31.1 : champs laissés vides par le modèle mais présents dans la transcription de la ligne : téléphone, spécialité, établissement
var MOTS_ETAB_ = /\b(CHU|CHR|H[ôo]pital|HG|Clinique|Polyclinique|Centre|Cabinet|CSU|FSU|PMI|Maternit[ée]|Institut|Infirmerie|Dispensaire)\b[^|;\n]*/i;
function completerDepuisTranscription_(x) {
  var t = String(x.transcription || ''); if (!t) return x;
  if (!x.telephone) { var m = t.replace(/[.\-]/g, ' ').match(/(?:\+?225\s*)?((?:0\d|\d{2})(?:\s?\d{2}){4})/); if (m) x.telephone = m[1].replace(/\s/g, ''); }
  if (x.specialite === '' && x.nom !== undefined && x.prenoms !== undefined) {
    var mots = sansAccents(t).toLowerCase().split(/[^a-z]+/).filter(Boolean), trouve = '';
    for (var i = 0; i < mots.length && !trouve; i++) {
      var deux = i + 1 < mots.length ? mots[i] + mots[i + 1] : '';
      if (deux && (SPECIALITES_SYNONYMES[deux] || /^(medecinegenerale|medecingeneraliste)$/.test(deux))) trouve = specialiteCanonique(deux);
      else if (SPECIALITES_SYNONYMES[mots[i]] && mots[i].length > 3) trouve = SPECIALITES_SYNONYMES[mots[i]];
      else if (/^(generaliste|pediatre|cardiologue|neurologue|gynecologue|dermatologue|rhumatologue|ophtalmologue|urologue|psychiatre|chirurgien|interniste|pneumologue|nephrologue|endocrinologue|diabetologue|infectiologue)$/.test(mots[i])) trouve = specialiteCanonique(mots[i]);
    }
    if (trouve) x.specialite = trouve;
  }
  if (x.etablissement === '') { var e = t.match(MOTS_ETAB_); if (e) x.etablissement = e[0].replace(/\s+/g, ' ').trim().slice(0, 120); }
  return x;
}
function titreCourt_(v) {
  var k = sansAccents(String(v || '')).toLowerCase().replace(/[^a-z]/g, '');
  return /^(dr|docteur)/.test(k) ? 'Dr' : /^(pr|prof|professeur)/.test(k) ? 'Pr' : /^(mme|madame)$/.test(k) ? 'Mme' : /^(m|mr|monsieur)$/.test(k) ? 'M.' : /^(sf|sagefemme)$/.test(k) ? 'SF' : /^(ide|infirmier|infirmiere)$/.test(k) ? 'IDE' : '';
}
var MOTS_PARASITES_OCR_ = /^(?:vu|visa|ras|r\.a\.s|signature|signe|conge|absent|annule|rapport|delegue|graabel|pharma|echantillon|bon)\b/i;
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
    nb_lignes: Math.max(0, Math.min(60, Math.round(+(l && l.nb_lignes) || 0))),
    date_visite: date, ville: s(l && l.ville, 60), commune: s(l && l.commune, 60), quartier: s(l && l.quartier, 80),
    medecins: ((l && l.medecins) || []).slice(0, 40).sort(function (a, b) { return (+a.ligne || 99) - (+b.ligne || 99); }).map(function (x) {
      x = completerDepuisTranscription_({ transcription: s(x.transcription, 600), titre: x.titre, nom: x.nom, prenoms: x.prenoms, specialite: s(x.specialite, 80), etablissement: s(x.etablissement, 120),
        telephone: tel(x.telephone), adresse: x.adresse, quartier: x.quartier, commune: x.commune, source: x.source, confiance: x.confiance });
      var netNom = s(x.nom, 80).replace(/^(?:dr|docteur|pr|prof|professeur|m\.|mme|mlle)\b\.?\s*/i, '').trim();
      var netPrenoms = s(x.prenoms, 80).replace(/^(?:dr|docteur|pr|prof|professeur|m\.|mme|mlle)\b\.?\s*/i, '').trim();
      if (netNom && netPrenoms && netNom.toLowerCase() === netPrenoms.toLowerCase()) netPrenoms = '';
      return { transcription: x.transcription, titre: titreCourt_(x.titre), nom: netNom, prenoms: netPrenoms, specialite: s(x.specialite, 80), etablissement: s(x.etablissement, 120),
               telephone: tel(x.telephone), adresse: s(x.adresse, 160), quartier: s(x.quartier, 80), commune: s(x.commune, 60), source: s(x.source, 12), confiance: conf(x.confiance) };
    }).filter(function (x) { return x.nom && !MOTS_PARASITES_OCR_.test(x.nom); }),
    pharmacies: ((l && l.pharmacies) || []).slice(0, 40).sort(function (a, b) { return (+a.ligne || 99) - (+b.ligne || 99); }).map(function (x) {
      var tP = completerDepuisTranscription_({ transcription: s(x.transcription, 600), telephone: tel(x.telephone) });
      var netNomPh = s(x.nom, 120);
      return { transcription: tP.transcription, nom: netNomPh, adresse: s(x.adresse, 160), quartier: s(x.quartier, 80), commune: s(x.commune, 60), telephone: tP.telephone, source: s(x.source, 12), confiance: conf(x.confiance) };
    }).filter(function (x) { return x.nom && !MOTS_PARASITES_OCR_.test(x.nom); }),
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

// Menu : enregistrer ou changer les clés (gardées dans les propriétés du script, jamais dans le code)
function configurerLectureFichesClaude() {
  var ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties();
  var r = ui.prompt('Lecture des fiches photographiées (secours)', 'Collez la clé de l\'API Anthropic (console.anthropic.com › API Keys). Elle sert si Gemini manque ou échoue.' +
    (props.getProperty('CLE_ANTHROPIC') ? '\nUne clé est déjà enregistrée : la nouvelle la remplacera.' : ''), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var cle = String(r.getResponseText() || '').trim();
  if (!cle) { ui.alert('Aucune clé saisie : rien n\'a changé.'); return; }
  props.setProperty('CLE_ANTHROPIC', cle);
  ui.alert('Clé de secours enregistrée.');
}
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
