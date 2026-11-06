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
          | rapport (compte rendu de la journée) | delegue (ajout d'un délégué à la liste)
   Sauvegarde : une copie complète du classeur chaque nuit dans le dossier Drive « Sauvegardes MediPlanner »
   (7 copies tournantes), à installer une fois avec le menu MediPlanner > Sauvegardes.
   ============================================================================= */

var FEUILLES = {
  praticiens: 'Praticiens', presences: 'Presences', etablissements: 'Etablissements', hist: 'Historique', quartiers: 'Quartiers',
  listes: 'Listes', plannings: 'Plannings', ancienneBase: 'BaseDonnees', pharmacies: 'Pharmacies',
  fiches: 'Fiches produits', rapports: 'Rapports du jour', audit: 'Audit_Logs'
};
var VERSION_SERVEUR = '3.27.48';
var NB_HISTORIQUE_RENVOYE = 1500;      // visites renvoyées à l'application (statistiques sur un mois d'équipe)
var JOURS_PLANNINGS_DATA = 62;         // historique des tournées publiées (statistiques mensuelles)
var JOURS_PLANNINGS_EQUIPE = 14;       // rafraîchissement léger toutes les 2 minutes
var COULEUR_ENTETE = '#0B4F6C';

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
    if (p.action === 'ping') return json({ ok: true, classeur: SpreadsheetApp.getActive().getName(), version: VERSION_DONNEES, serveur: VERSION_SERVEUR,
      sauvegarde: PropertiesService.getScriptProperties().getProperty('DERNIERE_SAUVEGARDE') || '' });

    // 3.27.46 : Synchronisation incrémentale Delta (syncedAt) : transmission ultra-légère des seules nouveautés
    if (p.action === 'data') {
      if (p.force !== '1' && p.syncedAt && p.sig) {
        return json(lireToutDelta(p.sig, p.syncedAt, p.hdepuis || ''));
      }
      return json(lireTout(p.sig || '', p.hdepuis || ''));
    }

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
    var actions = { valider: function () { return enregistrerVisites(body.visites || []); }, planning: function () { return publierPlanning(body); },
      fiche: function () { return ficheUnique(body); }, etablissement: function () { return enregistrerEtablissement(body.etablissement || body); },
      rapport: function () { return enregistrerRapport(body.rapport || {}); }, delegue: function () { return ajouterDelegue(body.nom); } };
    if (!actions[body.action]) return json({ ok: false, erreur: 'Action inconnue.' });
    // 3.27.25 : toute écriture invalide le cache de lecture (avant et après, pour qu'aucune lecture en cours ne fige l'ancien état)
    marquerModif();
    try { return json(actions[body.action]()); } finally { marquerModif(); }
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

function jsonTexte(t) {
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.JSON);
}
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

