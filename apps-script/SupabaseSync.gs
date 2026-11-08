// =============================================================================
// SupabaseSync.gs : Passerelle et Double Écriture Temps Réel (Google Sheets <-> Supabase)
// Permet à MediPlanner d'écrire simultanément dans Google Sheets et Supabase.
// =============================================================================

function obtenirConfigSupabase_() {
  var props = PropertiesService.getScriptProperties();
  return {
    url: props.getProperty('SUPABASE_URL') || 'https://nldyinokqgshnzvdsxgr.supabase.co',
    key: props.getProperty('SUPABASE_KEY') || 'sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL',
    actif: props.getProperty('SUPABASE_DOUBLE_ECRITURE') !== 'non' // Actif par défaut
  };
}

function enregistrerConfigSupabase(url, key, doubleEcriture) {
  var props = PropertiesService.getScriptProperties();
  if (url) props.setProperty('SUPABASE_URL', url.replace(/\/+$/, ''));
  if (key) props.setProperty('SUPABASE_KEY', key);
  if (doubleEcriture !== undefined) props.setProperty('SUPABASE_DOUBLE_ECRITURE', doubleEcriture ? 'oui' : 'non');
  return 'Configuration Supabase enregistrée avec succès.';
}

function dialogConfigSupabase() {
  var ui = SpreadsheetApp.getUi();
  var cfg = obtenirConfigSupabase_();
  var resUrl = ui.prompt('Configuration Supabase', 'URL Supabase (ex: https://xyz.supabase.co) :', ui.ButtonSet.OK_CANCEL);
  if (resUrl.getSelectedButton() !== ui.Button.OK) return;
  var resKey = ui.prompt('Configuration Supabase', 'Clé publique anon (sb_publishable_...) :', ui.ButtonSet.OK_CANCEL);
  if (resKey.getSelectedButton() !== ui.Button.OK) return;
  
  enregistrerConfigSupabase(resUrl.getResponseText().trim(), resKey.getResponseText().trim(), true);
  ui.alert('Succès', 'Paramètres Supabase enregistrés et double écriture activée.', ui.ButtonSet.OK);
}

function appelSupabase_(table, methode, payload, optionsUrl) {
  var cfg = obtenirConfigSupabase_();
  if (!cfg.url || !cfg.key) return false;
  
  var url = cfg.url + '/rest/v1/' + table + (optionsUrl ? '?' + optionsUrl : '');
  var params = {
    method: methode || 'post',
    contentType: 'application/json; charset=utf-8',
    headers: {
      'apikey': cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    muteHttpExceptions: true
  };
  if (payload) params.payload = JSON.stringify(payload);
  
  try {
    var resp = UrlFetchApp.fetch(url, params);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) return true;
    console.warn('Supabase (' + table + ') retour ' + code + ': ' + resp.getContentText());
    return false;
  } catch (err) {
    console.warn('Erreur appel Supabase (' + table + '): ' + err.message);
    return false;
  }
}

// =============================================================================
// MODULE DOUBLE ÉCRITURE TEMPS RÉEL (APPELÉ PAR ECRITURE.GS)
// =============================================================================

function miroirSupabaseVisites_(visites) {
  if (!visites || !visites.length) return;
  var cfg = obtenirConfigSupabase_();
  if (!cfg.actif) return;

  try {
    var rows = visites.map(function (v) {
      return {
        uid: String(v.uid || ''),
        date: String(v.date || '').slice(0, 10),
        delegue: String(v.delegue || 'Délégué'),
        code: String(v.code || ''),
        id_presence: v.idPresence ? String(v.idPresence) : null,
        nom: String(v.nom || ''),
        type: String(v.type || 'Médecin'),
        specialite: String(v.specialite || ''),
        note: Math.max(1, Math.min(3, parseInt(v.note) || 2)),
        commune: String(v.commune || ''),
        quartier: String(v.quartier || ''),
        lieu: String(v.lieu || ''),
        creneau: String(v.creneau || ''),
        statut: String(v.statut || 'Visite faite'),
        type_echange: String(v.typeEchange || ''),
        produits_presentes: v.produitsPresentes || null,
        echantillons: v.echantillons || null,
        prochaine_visite: v.prochaine ? String(v.prochaine).slice(0, 10) : null,
        commentaire: String(v.commentaire || '')
      };
    }).filter(function (r) { return r.uid && r.code; });

    if (rows.length) {
      appelSupabase_('visites', 'post', rows);
    }
  } catch (e) {
    console.warn('Échec miroir visites Supabase:', e);
  }
}

function miroirSupabasePraticien_(modif, lieux, ids) {
  if (!modif || !modif.code) return;
  var cfg = obtenirConfigSupabase_();
  if (!cfg.actif) return;

  try {
    var prat = {
      code: String(modif.code),
      type: String(modif.type || 'Médecin'),
      nom: String(modif.nom || ''),
      specialite: String(modif.specialite || 'Généraliste'),
      note: Math.max(1, Math.min(3, parseInt(modif.note) || 2)),
      conventionne: modif.conventionne === 'Oui' || modif.conventionne === true,
      telephone: String(modif.telephone || ''),
      derniere: modif.derniere ? String(modif.derniere).slice(0, 10) : null,
      statut: modif.statut || null,
      commentaire: modif.commentaire || null,
      nb_visites: parseInt(modif.nbVisites) || 0,
      actif: modif.actif !== 'Non' && modif.actif !== false,
      updated_at: new Date().toISOString()
    };
    appelSupabase_('praticiens', 'post', [prat]);

    if (lieux && lieux.length) {
      var presRows = lieux.map(function (x) {
        var id = String((ids && ids[x.id]) || x.id || (prat.code + '_' + (x.lieu || 'lieu')));
        return {
          id: id,
          code: prat.code,
          nom: prat.nom,
          lieu: String(x.lieu || ''),
          quartier: String(x.quartier || ''),
          commune: String(x.commune || 'Abidjan'),
          zone: String(x.zone || ''),
          lundi: String(x.lundi || ''),
          mardi: String(x.mardi || ''),
          mercredi: String(x.mercredi || ''),
          jeudi: String(x.jeudi || ''),
          vendredi: String(x.vendredi || ''),
          horaire_matin: String(x.horaireMatin || ''),
          horaire_soir: String(x.horaireSoir || ''),
          lat: isFinite(x.lat) ? Number(x.lat) : null,
          lon: isFinite(x.lon) ? Number(x.lon) : null,
          reperes: String(x.reperes || ''),
          updated_at: new Date().toISOString()
        };
      }).filter(function (r) { return r.id && r.lieu; });

      if (presRows.length) {
        appelSupabase_('presences', 'post', presRows);
      }
    }
  } catch (e) {
    console.warn('Échec miroir praticien Supabase:', e);
  }
}

function miroirSupabasePharmacie_(modif, lieu) {
  if (!modif || !modif.code) return;
  var cfg = obtenirConfigSupabase_();
  if (!cfg.actif) return;

  try {
    var phar = {
      code: String(modif.code),
      nom: String(modif.nom || ''),
      titulaire: String(modif.titulaire || (lieu && lieu.titulaire) || ''),
      quartier: String(modif.quartier || ''),
      commune: String(modif.commune || 'Abidjan'),
      zone: String(modif.zone || ''),
      lat: isFinite(modif.lat) ? Number(modif.lat) : null,
      lon: isFinite(modif.lon) ? Number(modif.lon) : null,
      telephone: String(modif.telephone || ''),
      horaire_matin: String(modif.horaireMatin || ''),
      horaire_soir: String(modif.horaireSoir || ''),
      note: Math.max(1, Math.min(3, parseInt(modif.note) || 2)),
      conventionne: modif.conventionne === 'Oui' || modif.conventionne === true,
      derniere: modif.derniere ? String(modif.derniere).slice(0, 10) : null,
      statut: modif.statut || null,
      commentaire: modif.commentaire || null,
      nb_visites: parseInt(modif.nbVisites) || 0,
      actif: modif.actif !== 'Non' && modif.actif !== false,
      updated_at: new Date().toISOString()
    };
    appelSupabase_('pharmacies', 'post', [phar]);
  } catch (e) {
    console.warn('Échec miroir pharmacie Supabase:', e);
  }
}

function miroirSupabaseRapport_(r) {
  if (!r || !r.date || !r.delegue) return;
  var cfg = obtenirConfigSupabase_();
  if (!cfg.actif) return;

  try {
    var rap = {
      delegue: String(r.delegue),
      date: String(r.date).slice(0, 10),
      prevues: parseInt(r.prevues) || 0,
      faites: parseInt(r.faites) || 0,
      non_faites: parseInt(r.nonFaites) || 0,
      sans_cr: parseInt(r.sansCr) || 0,
      synthese: String(r.synthese || ''),
      faits: String(r.faits || ''),
      concurrence: String(r.concurrence || ''),
      besoins: String(r.besoins || ''),
      km: Number(r.km) || 0
    };
    appelSupabase_('rapports', 'post', [rap]);
  } catch (e) {
    console.warn('Échec miroir rapport Supabase:', e);
  }
}

function miroirSupabasePlanning_(b) {
  if (!b || !b.arrets || !b.arrets.length) return;
  var cfg = obtenirConfigSupabase_();
  if (!cfg.actif) return;

  try {
    var delegue = String(b.delegue || 'Délégué');
    var plans = b.arrets.map(function (a) {
      return {
        delegue: delegue,
        date: String(a.date).slice(0, 10),
        heure: String(a.heure || ''),
        creneau: String(a.creneau || ''),
        debut: parseInt(a.debut) || null,
        fin: parseInt(a.fin) || null,
        id_presence: a.idPresence ? String(a.idPresence) : null,
        code: String(a.code || ''),
        nom: String(a.nom || ''),
        specialite: String(a.specialite || ''),
        note: parseInt(a.note) || 2,
        quartier: String(a.quartier || ''),
        commune: String(a.commune || ''),
        lieu: String(a.lieu || ''),
        statut: String(a.statut || 'À faire'),
        etat: String(a.etat || 'planifie'),
        programme: String(a.programme || 'Proposition')
      };
    }).filter(function (p) { return p.code && p.date; });

    if (plans.length) {
      appelSupabase_('plannings', 'post', plans);
    }
  } catch (e) {
    console.warn('Échec miroir planning Supabase:', e);
  }
}

function miroirSupabaseEtablissement_(modif) {
  if (!modif || !modif.code) return;
  var cfg = obtenirConfigSupabase_();
  if (!cfg.actif) return;

  try {
    var etab = {
      code: String(modif.code),
      nom: String(modif.nom || ''),
      categorie: String(modif.categorie || ''),
      commune: String(modif.commune || ''),
      quartier: String(modif.quartier || ''),
      zone: String(modif.zone || ''),
      lat: isFinite(modif.lat) ? Number(modif.lat) : null,
      lon: isFinite(modif.lon) ? Number(modif.lon) : null,
      telephone: String(modif.telephone || ''),
      reperes: String(modif.reperes || '')
    };
    appelSupabase_('etablissements', 'post', [etab]);
  } catch (e) {
    console.warn('Échec miroir etablissement Supabase:', e);
  }
}

// -------------------------------------------------------------
// Cloner Google Sheets vers Supabase (Action Manuelle ou Périodique)
// -------------------------------------------------------------
function exporterToutVersSupabase() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive();
  var cfg = obtenirConfigSupabase_();
  
  if (!cfg.url || !cfg.key) {
    dialogConfigSupabase();
    cfg = obtenirConfigSupabase_();
    if (!cfg.url || !cfg.key) return;
  }
  
  var totalPrats = 0, totalPres = 0;
  
  try {
    // 1. Export Praticiens
    var shP = ss.getSheetByName(FEUILLES.praticiens);
    if (shP && shP.getLastRow() > 1) {
      var dataP = shP.getRange(2, 1, shP.getLastRow() - 1, shP.getLastColumn()).getValues();
      var entP = shP.getRange(1, 1, 1, shP.getLastColumn()).getValues()[0].map(normaliser);
      var posP = CHAMPS_PRATICIENS.map(function (c) { return entP.indexOf(normaliser(c[1])); });
      
      var lots = [];
      dataP.forEach(function (r) {
        var code = String(r[posP[0]] || '').trim();
        var nom = String(r[posP[2]] || '').trim();
        if (!code || !nom) return;
        
        lots.push({
          code: code,
          type: String(r[posP[1]] || 'Médecin').trim(),
          nom: nom,
          specialite: String(r[posP[3]] || 'Généraliste').trim(),
          note: Math.max(1, Math.min(3, parseInt(r[posP[4]]) || 2)),
          conventionne: estConventionne(r[posP[5]]),
          telephone: String(r[posP[6]] || '').trim(),
          derniere: r[posP[7]] instanceof Date ? Utilities.formatDate(r[posP[7]], 'GMT', 'yyyy-MM-dd') : (r[posP[7]] || null),
          statut: String(r[posP[8]] || ''),
          commentaire: String(r[posP[9]] || ''),
          nb_visites: parseInt(r[posP[10]]) || 0,
          actif: String(r[posP[11]]).toLowerCase() !== 'non'
        });
      });
      
      for (var i = 0; i < lots.length; i += 100) {
        appelSupabase_('praticiens', 'post', lots.slice(i, i + 100));
      }
      totalPrats = lots.length;
    }
    
    // 2. Export Présences
    var shR = ss.getSheetByName(FEUILLES.presences);
    if (shR && shR.getLastRow() > 1) {
      var dataR = shR.getRange(2, 1, shR.getLastRow() - 1, shR.getLastColumn()).getValues();
      var entR = shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0].map(normaliser);
      var posR = CHAMPS_PRESENCES.map(function (c) { return entR.indexOf(normaliser(c[1])); });
      
      var lotsR = [];
      dataR.forEach(function (r) {
        var id = String(r[posR[0]] || '').trim();
        var code = String(r[posR[1]] || '').trim();
        var lieu = String(r[posR[3]] || '').trim();
        if (!code || !lieu) return;
        if (!id) id = code + '_' + normaliser(lieu);
        
        var lat = parseFloat(r[posR[13]]), lon = parseFloat(r[posR[14]]);
        lotsR.push({
          id: id,
          code: code,
          nom: String(r[posR[2]] || ''),
          lieu: lieu,
          quartier: String(r[posR[4]] || ''),
          commune: String(r[posR[5]] || 'Abidjan'),
          zone: String(r[posR[6]] || ''),
          lundi: String(r[posR[7]] || ''),
          mardi: String(r[posR[8]] || ''),
          mercredi: String(r[posR[9]] || ''),
          jeudi: String(r[posR[10]] || ''),
          vendredi: String(r[posR[11]] || ''),
          horaire_matin: String(r[posR[12]] || ''),
          horaire_soir: String(r[posR[13]] || ''),
          lat: isFinite(lat) ? lat : null,
          lon: isFinite(lon) ? lon : null,
          reperes: String(r[posR[15]] || '')
        });
      });
      
      for (var j = 0; j < lotsR.length; j += 100) {
        appelSupabase_('presences', 'post', lotsR.slice(j, j + 100));
      }
      totalPres = lotsR.length;
    }
    
    ui.alert('Synchronisation Réussie !', 
      'Toutes les données ont été clonées dans Supabase sans modifier votre Google Sheet :\n\n' +
      '• ' + totalPrats + ' praticiens copiés\n' +
      '• ' + totalPres + ' présences copiées\n\n' +
      'Votre Google Sheet continue de fonctionner normalement.',
      ui.ButtonSet.OK);
      
  } catch (err) {
    ui.alert('Erreur de synchronisation', err.message, ui.ButtonSet.OK);
  }
}

// =============================================================================
// SYNCHRONISATION EN TEMPS RÉEL SUR SAISIE DANS LE GOOGLE SHEET (DÉCLENCHEUR INSTALLABLE)
// =============================================================================

/**
 * Fonction appelée automatiquement à chaque modification saisie dans le classeur Google Sheets
 * lorsqu'un déclencheur installable "onEdit" est actif.
 */
function syncOnEditInstallable(e) {
  if (!e || !e.range) return;
  var cfg = obtenirConfigSupabase_();
  if (!cfg.actif || !cfg.url || !cfg.key) return;

  try {
    var sh = e.range.getSheet();
    var nomFeuille = sh.getName();
    var r0 = e.range.getRow();
    var nb = e.range.getNumRows();
    if (r0 < 2) {
      if (r0 + nb - 1 < 2) return; // Seulement la ligne d'en-tête
      nb = nb - (2 - r0);
      r0 = 2;
    }

    // Petit délai pour laisser onEdit simple auto-compléter CodeContact ou IdPresence si nouvelle ligne
    Utilities.sleep(150);

    var ent = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normaliser);
    var data = sh.getRange(r0, 1, nb, sh.getLastColumn()).getValues();

    if (nomFeuille === FEUILLES.praticiens) {
      syncLignesPraticiensVersSupabase_(ent, data);
    } else if (nomFeuille === FEUILLES.pharmacies) {
      syncLignesPharmaciesVersSupabase_(ent, data);
    } else if (nomFeuille === FEUILLES.presences) {
      syncLignesPresencesVersSupabase_(ent, data);
    } else if (nomFeuille === FEUILLES.etablissements) {
      syncLignesEtablissementsVersSupabase_(ent, data);
    } else if (nomFeuille === FEUILLES.hist) {
      syncLignesHistoriqueVersSupabase_(ent, data);
    } else if (nomFeuille === FEUILLES.plannings) {
      syncLignesPlanningsVersSupabase_(ent, data);
    } else if (nomFeuille === FEUILLES.rapports) {
      syncLignesRapportsVersSupabase_(ent, data);
    }
  } catch (err) {
    console.warn('Erreur syncOnEditInstallable:', err.message);
  }
}

function syncLignesPraticiensVersSupabase_(ent, data) {
  var pos = CHAMPS_PRATICIENS.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var lots = [];
  data.forEach(function (r) {
    var code = String(r[pos[0]] || '').trim();
    var nom = String(r[pos[2]] || '').trim();
    if (!code || !nom) return;
    var dStr = r[pos[7]] instanceof Date ? Utilities.formatDate(r[pos[7]], 'GMT', 'yyyy-MM-dd') : (r[pos[7]] ? String(r[pos[7]]).slice(0, 10) : null);
    lots.push({
      code: code,
      type: String(r[pos[1]] || 'Médecin').trim(),
      nom: nom,
      specialite: String(r[pos[3]] || 'Généraliste').trim(),
      note: Math.max(1, Math.min(3, parseInt(r[pos[4]]) || 2)),
      conventionne: estConventionne(r[pos[5]]),
      telephone: String(r[pos[6]] || '').trim(),
      derniere: dStr,
      statut: String(r[pos[8]] || ''),
      commentaire: String(r[pos[9]] || ''),
      nb_visites: parseInt(r[pos[10]]) || 0,
      actif: String(r[pos[11]]).toLowerCase() !== 'non',
      updated_at: new Date().toISOString()
    });
  });
  if (lots.length) appelSupabase_('praticiens', 'post', lots);
}

function syncLignesPharmaciesVersSupabase_(ent, data) {
  var pos = CHAMPS_PHARMACIES.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var lots = [];
  data.forEach(function (r) {
    var code = String(r[pos[0]] || '').trim();
    var nom = String(r[pos[1]] || '').trim();
    if (!code || !nom) return;
    var lat = parseFloat(r[pos[6]]), lon = parseFloat(r[pos[7]]);
    var dStr = r[pos[13]] instanceof Date ? Utilities.formatDate(r[pos[13]], 'GMT', 'yyyy-MM-dd') : (r[pos[13]] ? String(r[pos[13]]).slice(0, 10) : null);
    lots.push({
      code: code,
      nom: nom,
      titulaire: String(r[pos[2]] || '').trim(),
      quartier: String(r[pos[3]] || '').trim(),
      commune: String(r[pos[4]] || 'Abidjan').trim(),
      zone: String(r[pos[5]] || '').trim(),
      lat: isFinite(lat) ? lat : null,
      lon: isFinite(lon) ? lon : null,
      telephone: String(r[pos[8]] || '').trim(),
      horaire_matin: String(r[pos[9]] || '').trim(),
      horaire_soir: String(r[pos[10]] || '').trim(),
      note: Math.max(1, Math.min(3, parseInt(r[pos[11]]) || 2)),
      conventionne: estConventionne(r[pos[12]]),
      derniere: dStr,
      statut: String(r[pos[14]] || ''),
      commentaire: String(r[pos[15]] || ''),
      nb_visites: parseInt(r[pos[16]]) || 0,
      actif: String(r[pos[17]]).toLowerCase() !== 'non',
      updated_at: new Date().toISOString()
    });
  });
  if (lots.length) appelSupabase_('pharmacies', 'post', lots);
}

function syncLignesPresencesVersSupabase_(ent, data) {
  var pos = CHAMPS_PRESENCES.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var lots = [];
  data.forEach(function (r) {
    var id = String(r[pos[0]] || '').trim();
    var code = String(r[pos[1]] || '').trim();
    var lieu = String(r[pos[3]] || '').trim();
    if (!code || !lieu) return;
    if (!id) id = code + '_' + normaliser(lieu);
    var lat = parseFloat(r[pos[14]]), lon = parseFloat(r[pos[15]]);
    lots.push({
      id: id,
      code: code,
      nom: String(r[pos[2]] || '').trim(),
      lieu: lieu,
      quartier: String(r[pos[4]] || '').trim(),
      commune: String(r[pos[5]] || 'Abidjan').trim(),
      zone: String(r[pos[6]] || '').trim(),
      lundi: String(r[pos[7]] || '').trim(),
      mardi: String(r[pos[8]] || '').trim(),
      mercredi: String(r[pos[9]] || '').trim(),
      jeudi: String(r[pos[10]] || '').trim(),
      vendredi: String(r[pos[11]] || '').trim(),
      horaire_matin: String(r[pos[12]] || '').trim(),
      horaire_soir: String(r[pos[13]] || '').trim(),
      lat: isFinite(lat) ? lat : null,
      lon: isFinite(lon) ? lon : null,
      reperes: String(r[pos[16]] || '').trim(),
      updated_at: new Date().toISOString()
    });
  });
  if (lots.length) appelSupabase_('presences', 'post', lots);
}

function syncLignesEtablissementsVersSupabase_(ent, data) {
  var pos = CHAMPS_ETABLISSEMENTS.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var lots = [];
  data.forEach(function (r) {
    var code = String(r[pos[0]] || '').trim();
    var nom = String(r[pos[1]] || '').trim();
    if (!code || !nom) return;
    var lat = parseFloat(r[pos[6]]), lon = parseFloat(r[pos[7]]);
    lots.push({
      code: code,
      nom: nom,
      categorie: String(r[pos[2]] || '').trim(),
      commune: String(r[pos[3]] || '').trim(),
      quartier: String(r[pos[4]] || '').trim(),
      zone: String(r[pos[5]] || '').trim(),
      lat: isFinite(lat) ? lat : null,
      lon: isFinite(lon) ? lon : null,
      telephone: String(r[pos[8]] || '').trim(),
      reperes: String(r[pos[9]] || '').trim()
    });
  });
  if (lots.length) appelSupabase_('etablissements', 'post', lots);
}

function syncLignesHistoriqueVersSupabase_(ent, data) {
  var pos = CHAMPS_HIST.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var lots = [];
  data.forEach(function (r) {
    var uid = String(r[pos[14]] || '').trim();
    var code = String(r[pos[3]] || '').trim();
    if (!uid || !code) return;
    var dStr = r[pos[0]] instanceof Date ? Utilities.formatDate(r[pos[0]], 'GMT', 'yyyy-MM-dd') : (r[pos[0]] ? String(r[pos[0]]).slice(0, 10) : null);
    var pStr = r[pos[17]] instanceof Date ? Utilities.formatDate(r[pos[17]], 'GMT', 'yyyy-MM-dd') : (r[pos[17]] ? String(r[pos[17]]).slice(0, 10) : null);
    lots.push({
      uid: uid,
      date: dStr,
      delegue: String(r[pos[15]] || 'Délégué').trim(),
      code: code,
      id_presence: r[pos[2]] ? String(r[pos[2]]) : null,
      nom: String(r[pos[4]] || '').trim(),
      type: String(r[pos[5]] || 'Médecin').trim(),
      specialite: String(r[pos[6]] || '').trim(),
      note: Math.max(1, Math.min(3, parseInt(r[pos[7]]) || 2)),
      commune: String(r[pos[8]] || '').trim(),
      quartier: String(r[pos[9]] || '').trim(),
      lieu: String(r[pos[10]] || '').trim(),
      creneau: String(r[pos[11]] || '').trim(),
      statut: String(r[pos[12]] || 'Visite faite').trim(),
      type_echange: String(r[pos[18]] || '').trim(),
      produits_presentes: r[pos[16]] ? String(r[pos[16]]) : null,
      echantillons: r[pos[21]] ? String(r[pos[21]]) : null,
      prochaine_visite: pStr,
      commentaire: String(r[pos[13]] || '').trim()
    });
  });
  if (lots.length) appelSupabase_('visites', 'post', lots);
}

function syncLignesPlanningsVersSupabase_(ent, data) {
  var pos = CHAMPS_PLAN.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var lots = [];
  data.forEach(function (r) {
    var code = String(r[pos[7]] || '').trim();
    var dateStr = r[pos[1]] instanceof Date ? Utilities.formatDate(r[pos[1]], 'GMT', 'yyyy-MM-dd') : (r[pos[1]] ? String(r[pos[1]]).slice(0, 10) : null);
    if (!code || !dateStr) return;
    lots.push({
      delegue: String(r[pos[0]] || 'Délégué').trim(),
      date: dateStr,
      heure: String(r[pos[2]] || '').trim(),
      creneau: String(r[pos[3]] || '').trim(),
      debut: parseInt(r[pos[4]]) || null,
      fin: parseInt(r[pos[5]]) || null,
      id_presence: r[pos[6]] ? String(r[pos[6]]) : null,
      code: code,
      nom: String(r[pos[8]] || '').trim(),
      specialite: String(r[pos[9]] || '').trim(),
      note: Math.max(1, Math.min(3, parseInt(r[pos[10]]) || 2)),
      quartier: String(r[pos[11]] || '').trim(),
      commune: String(r[pos[12]] || '').trim(),
      lieu: String(r[pos[13]] || '').trim(),
      statut: String(r[pos[14]] || 'À faire').trim(),
      etat: String(r[pos[15]] || 'planifie').trim(),
      programme: String(r[pos[16]] || 'Proposition').trim()
    });
  });
  if (lots.length) appelSupabase_('plannings', 'post', lots);
}

function syncLignesRapportsVersSupabase_(ent, data) {
  var pos = CHAMPS_RAPPORTS.map(function (c) { return ent.indexOf(normaliser(c[1])); });
  var lots = [];
  data.forEach(function (r) {
    var del = String(r[pos[0]] || '').trim();
    var dateStr = r[pos[1]] instanceof Date ? Utilities.formatDate(r[pos[1]], 'GMT', 'yyyy-MM-dd') : (r[pos[1]] ? String(r[pos[1]]).slice(0, 10) : null);
    if (!del || !dateStr) return;
    lots.push({
      delegue: del,
      date: dateStr,
      prevues: parseInt(r[pos[3]]) || 0,
      faites: parseInt(r[pos[4]]) || 0,
      non_faites: parseInt(r[pos[5]]) || 0,
      sans_cr: parseInt(r[pos[6]]) || 0,
      synthese: String(r[pos[7]] || '').trim(),
      faits: String(r[pos[8]] || '').trim(),
      concurrence: String(r[pos[9]] || '').trim(),
      besoins: String(r[pos[10]] || '').trim(),
      km: parseFloat(r[pos[11]]) || 0
    });
  });
  if (lots.length) appelSupabase_('rapports', 'post', lots);
}

// =============================================================================
// GESTION DU DÉCLENCHEUR INSTALLABLE (MENU DU CLASSEUR)
// =============================================================================

function installerSyncAutomatiqueSupabase() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive();
  var cfg = obtenirConfigSupabase_();

  if (!cfg.url || !cfg.key) {
    dialogConfigSupabase();
    cfg = obtenirConfigSupabase_();
    if (!cfg.url || !cfg.key) return;
  }

  // Nettoyer les anciens triggers syncOnEditInstallable pour éviter les doublons
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncOnEditInstallable') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Créer le déclencheur installable relié aux modifications du classeur
  ScriptApp.newTrigger('syncOnEditInstallable')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ui.alert('Synchronisation Activée ! ⚡',
    'La synchronisation automatique en temps réel est activée avec succès !\n\n' +
    'Désormais, toute modification saisie directement dans Google Sheets\n' +
    '(Praticiens, Présences, Pharmacies, Établissements, etc.)\n' +
    'sera immédiatement répercutée dans votre base Supabase.',
    ui.ButtonSet.OK);
}

function desactiverSyncAutomatiqueSupabase() {
  var ui = SpreadsheetApp.getUi();
  var triggers = ScriptApp.getProjectTriggers();
  var suppr = 0;

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncOnEditInstallable') {
      ScriptApp.deleteTrigger(triggers[i]);
      suppr++;
    }
  }

  ui.alert('Synchronisation Désactivée',
    suppr > 0 ? 'La synchronisation automatique Google Sheets -> Supabase a été désactivée.'
              : 'Aucun déclencheur automatique n\'était actif.',
    ui.ButtonSet.OK);
}
