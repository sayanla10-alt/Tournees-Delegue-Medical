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
