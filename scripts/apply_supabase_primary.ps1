# scripts/apply_supabase_primary.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== CONFIGURATION DE SUPABASE COMME BASE PRINCIPALE ==="

# -----------------------------------------------------------------------------
# 1. Mise à jour de src/api/api.js
# -----------------------------------------------------------------------------
$apiPath = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\src\api\api.js"
$apiContent = [System.IO.File]::ReadAllText($apiPath, [System.Text.Encoding]::UTF8)

# Remplacement de SUPABASE_CONFIG et fonctions miroir
$targetApiStart = "  // ------------------------------------------------------------------ Double"
$targetApiEnd = "  function connecte() { return !S.config.demo && !!S.config.url; }"

$newApiBlock = @"
  // ------------------------------------------------------------------ Configuration Supabase & Dual-Write
  var SUPABASE_CONFIG = {
    url: 'https://nldyinokqgshnzvdsxgr.supabase.co',
    key: 'sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL'
  };

  function basePrimaireActive() {
    return (S.config && S.config.basePrimaire) || 'supabase';
  }

  function postSupabaseRest_(table, rows) {
    if (!rows || !rows.length || !navigator.onLine) return Promise.resolve(false);
    return fetch(SUPABASE_CONFIG.url + '/rest/v1/' + table, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.key,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.key,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(rows)
    }).then(function (r) {
      return r.ok;
    }).catch(function (e) {
      console.warn('Erreur appel Supabase (' + table + '):', e);
      return false;
    });
  }

  function miroirSupabaseClient(action, payload) {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) return Promise.resolve(false);
    try {
      if (action === 'valider' && payload.visites) {
        var rows = payload.visites.map(function (v) {
          return {
            uid: String(v.uid || ('V_' + v.code + '_' + v.date)),
            date: String(v.date || '').slice(0, 10),
            delegue: String(v.delegue || moi() || 'Délégué'),
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
        if (rows.length) return postSupabaseRest_('visites', rows);
      } else if (action === 'fiche') {
        var p = payload.praticien || {};
        var lieux = payload.presences || [];
        if (p.code && p.nom) {
          var prat = {
            code: String(p.code),
            type: String(p.type || 'Médecin'),
            nom: String(p.nom),
            specialite: String(p.specialite || 'Généraliste'),
            note: Math.max(1, Math.min(3, parseInt(p.note) || 2)),
            conventionne: p.conventionne === 'Oui' || p.conventionne === true,
            telephone: String(p.telephone || ''),
            actif: p.actif !== 'Non' && p.actif !== false,
            updated_at: new Date().toISOString()
          };
          if (prat.type === 'Pharmacie') {
            return postSupabaseRest_('pharmacies', [prat]);
          } else {
            return postSupabaseRest_('praticiens', [prat]).then(function () {
              if (!lieux.length) return true;
              var pres = lieux.map(function (x, idx) {
                return {
                  id: String(x.id || (prat.code + '_' + idx)),
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
              });
              return postSupabaseRest_('presences', pres);
            });
          }
        }
      } else if (action === 'rapport' && payload.rapport) {
        var r = payload.rapport;
        return postSupabaseRest_('rapports', [{
          delegue: String(r.delegue || moi() || 'Délégué'),
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
        }]);
      } else if (action === 'planning' && payload.arrets) {
        var del = String(payload.delegue || moi() || 'Délégué');
        var plans = payload.arrets.map(function (a) {
          return {
            delegue: del,
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
        if (plans.length) return postSupabaseRest_('plannings', plans);
      } else if (action === 'etablissement' && payload) {
        var etab = payload.etablissement || payload;
        if (etab.code && etab.nom) {
          return postSupabaseRest_('etablissements', [{
            code: String(etab.code),
            nom: String(etab.nom),
            categorie: String(etab.categorie || ''),
            commune: String(etab.commune || ''),
            quartier: String(etab.quartier || ''),
            zone: String(etab.zone || ''),
            lat: isFinite(etab.lat) ? Number(etab.lat) : null,
            lon: isFinite(etab.lon) ? Number(etab.lon) : null,
            telephone: String(etab.telephone || ''),
            reperes: String(etab.reperes || '')
          }]);
        }
      }
    } catch (eSup) {
      console.warn('Miroir Supabase client ignoré (erreur passive):', eSup);
    }
    return Promise.resolve(false);
  }

  // Chargement ultra-rapide directement depuis Supabase (PostgREST HTTP/2)
  function chargerDepuisSupabase_(force) {
    var headers = {
      'apikey': SUPABASE_CONFIG.key,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.key
    };
    var base = SUPABASE_CONFIG.url + '/rest/v1/';

    return Promise.all([
      fetch(base + 'praticiens?select=*&order=nom', { headers: headers }).then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); }),
      fetch(base + 'presences?select=*', { headers: headers }).then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); }),
      fetch(base + 'pharmacies?select=*&order=nom', { headers: headers }).then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); }),
      fetch(base + 'etablissements?select=*&order=nom', { headers: headers }).then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); }),
      fetch(base + 'visites?select=*&order=date.desc&limit=1500', { headers: headers }).then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); }),
      fetch(base + 'plannings?select=*', { headers: headers }).then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); }),
      fetch(base + 'rapports?select=*', { headers: headers }).then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); return r.json(); })
    ]).then(function (res) {
      var rawPrats = res[0] || [];
      var rawPres = res[1] || [];
      var rawPhar = res[2] || [];
      var rawEtab = res[3] || [];
      var rawVis = res[4] || [];
      var rawPlan = res[5] || [];
      var rawRap = res[6] || [];

      // Mapper Praticiens
      var praticiens = rawPrats.map(function (p) {
        return {
          code: p.code,
          type: p.type || 'Médecin',
          nom: p.nom,
          specialite: p.specialite || 'Généraliste',
          note: p.note || 2,
          conventionne: p.conventionne ? 'Oui' : 'Non',
          telephone: p.telephone || '',
          derniere: p.derniere || '',
          statut: p.statut || '',
          commentaire: p.commentaire || '',
          nbVisites: p.nb_visites || 0,
          actif: p.actif !== false ? 'Oui' : 'Non'
        };
      });

      // Ajouter Pharmacies
      rawPhar.forEach(function (ph) {
        praticiens.push({
          code: ph.code,
          type: 'Pharmacie',
          nom: ph.nom,
          specialite: 'Pharmacie',
          titulaire: ph.titulaire || '',
          note: ph.note || 2,
          conventionne: ph.conventionne ? 'Oui' : 'Non',
          telephone: ph.telephone || '',
          derniere: ph.derniere || '',
          statut: ph.statut || '',
          commentaire: ph.commentaire || '',
          nbVisites: ph.nb_visites || 0,
          actif: ph.actif !== false ? 'Oui' : 'Non',
          commune: ph.commune || '',
          quartier: ph.quartier || '',
          zone: ph.zone || '',
          lat: ph.lat,
          lon: ph.lon
        });
      });

      // Mapper Présences
      var presences = rawPres.map(function (pr) {
        return {
          id: pr.id,
          code: pr.code,
          nom: pr.nom,
          lieu: pr.lieu,
          quartier: pr.quartier || '',
          commune: pr.commune || 'Abidjan',
          zone: pr.zone || '',
          lundi: pr.lundi || '',
          mardi: pr.mardi || '',
          mercredi: pr.mercredi || '',
          jeudi: pr.jeudi || '',
          vendredi: pr.vendredi || '',
          horaireMatin: pr.horaire_matin || '',
          horaireSoir: pr.horaire_soir || '',
          lat: pr.lat,
          lon: pr.lon,
          reperes: pr.reperes || ''
        };
      });

      // Mapper Établissements
      var etablissements = rawEtab.map(function (e) {
        return {
          code: e.code,
          nom: e.nom,
          categorie: e.categorie || '',
          commune: e.commune || '',
          quartier: e.quartier || '',
          zone: e.zone || '',
          lat: e.lat,
          lon: e.lon,
          telephone: e.telephone || '',
          reperes: e.reperes || ''
        };
      });

      // Mapper Visites (Historique)
      var historique = rawVis.map(function (v) {
        return {
          uid: v.uid,
          date: v.date,
          horodatage: v.horodatage || (v.date + 'T12:00:00Z'),
          delegue: v.delegue,
          code: v.code,
          idPresence: v.id_presence,
          nom: v.nom,
          type: v.type || 'Médecin',
          specialite: v.specialite || '',
          note: v.note || 2,
          commune: v.commune || '',
          quartier: v.quartier || '',
          lieu: v.lieu || '',
          creneau: v.creneau || '',
          statut: v.statut || 'Visite faite',
          typeEchange: v.type_echange || '',
          produits: v.produits_presentes || [],
          echantillons: v.echantillons || [],
          prochaine: v.prochaine_visite || '',
          commentaire: v.commentaire || ''
        };
      });

      // Mapper Plannings
      var plannings = rawPlan.map(function (pl) {
        return {
          id: pl.id,
          delegue: pl.delegue,
          date: pl.date,
          heure: pl.heure || '',
          creneau: pl.creneau || '',
          debut: pl.debut,
          fin: pl.fin,
          idPresence: pl.id_presence,
          code: pl.code,
          nom: pl.nom,
          specialite: pl.specialite || '',
          note: pl.note || 2,
          quartier: pl.quartier || '',
          commune: pl.commune || '',
          lieu: pl.lieu || '',
          statut: pl.statut || 'À faire',
          etat: pl.etat || 'planifie',
          programme: pl.programme || 'Proposition'
        };
      });

      // Mapper Rapports
      var rapports = rawRap.map(function (rp) {
        return {
          delegue: rp.delegue,
          date: rp.date,
          prevues: rp.prevues || 0,
          faites: rp.faites || 0,
          nonFaites: rp.non_faites || 0,
          sansCr: rp.sans_cr || 0,
          synthese: rp.synthese || '',
          faits: rp.faits || '',
          concurrence: rp.concurrence || '',
          besoins: rp.besoins || '',
          km: rp.km || 0
        };
      });

      var statuts = (S.data && S.data.statuts && S.data.statuts.length) ? S.data.statuts : (typeof STATUTS_DEFAUT !== 'undefined' ? STATUTS_DEFAUT : []);
      var produits = (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : [];
      var quartiers = (S.data && S.data.quartiers && S.data.quartiers.length) ? S.data.quartiers : [];
      var delegues = (S.data && S.data.delegues && S.data.delegues.length) ? S.data.delegues : [];
      if (!delegues.length) {
        var setD = {};
        rawPlan.forEach(function (pl) { if (pl.delegue) setD[pl.delegue] = true; });
        rawVis.forEach(function (v) { if (v.delegue) setD[v.delegue] = true; });
        delegues = Object.keys(setD);
      }

      return {
        ok: true,
        source: 'supabase',
        praticiens: praticiens,
        presences: presences,
        etablissements: etablissements,
        historique: historique,
        plannings: plannings,
        rapports: rapports,
        statuts: statuts,
        produits: produits,
        quartiers: quartiers,
        delegues: delegues,
        syncedAt: new Date().toISOString()
      };
    });
  }

  function apiPost(action, payload) {
    var prim = basePrimaireActive();
    var body = { token: S.config.token, action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });

    if (prim === 'supabase') {
      // 1. Écriture principale dans Supabase
      var promSup = miroirSupabaseClient(action, payload);
      // 2. Écriture miroir secondaire dans Google Sheets en tâche de fond
      if (connecte()) {
        appel(S.config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).catch(function (e) {
          console.warn('Miroir secondaire Google Sheets:', e);
        });
      }
      return promSup.then(function () {
        return { ok: true, recus: (payload.visites || []).map(function(v){ return v.uid; }), ajoutes: (payload.visites || []).length };
      });
    } else {
      // 1. Écriture principale dans Google Sheets
      miroirSupabaseClient(action, payload);
      return appel(S.config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    }
  }
"@

# Replace block in api.js
$idxStart = $apiContent.IndexOf($targetApiStart)
$idxEnd = $apiContent.IndexOf($targetApiEnd)

if ($idxStart -ge 0 -and $idxEnd -gt $idxStart) {
    $apiContent = $apiContent.Substring(0, $idxStart) + $newApiBlock + "`r`n" + $apiContent.Substring($idxEnd)
    Write-Host "api.js: Bloc Dual-Write et Loader Supabase integre avec succes."
} else {
    Write-Error "Impossible de localiser le bloc cible dans api.js."
}

# Remplacement de l'appel synchroniser() dans api.js pour intégrer le switch de lecture
$syncTarget = @"
      return apiGet('data' + ref + sAt + fParam + (hd ? '&hdepuis=' + encodeURIComponent(hd) : ''));
    }).then(function (d) {
"@

$syncRepl = @"
      var prim = basePrimaireActive();
      var chargement;
      if (prim === 'supabase') {
        var t0 = Date.now();
        chargement = chargerDepuisSupabase_(force).then(function (dSup) {
          var ms = Date.now() - t0;
          dSup.dureeMs = ms;
          console.log('⚡ Données chargées depuis Supabase en ' + ms + ' ms !');
          return dSup;
        }).catch(function (errSup) {
          console.warn('Échec Supabase, repli automatique sur Google Sheets:', errSup);
          return apiGet('data' + ref + sAt + fParam + (hd ? '&hdepuis=' + encodeURIComponent(hd) : ''));
        });
      } else {
        chargement = apiGet('data' + ref + sAt + fParam + (hd ? '&hdepuis=' + encodeURIComponent(hd) : ''));
      }
      return chargement;
    }).then(function (d) {
"@

$normApi = $apiContent.Replace("`r`n", "`n")
$normSyncTarget = $syncTarget.Replace("`r`n", "`n")
$normSyncRepl = $syncRepl.Replace("`r`n", "`n")

if ($normApi.Contains($normSyncTarget)) {
    $normApi = $normApi.Replace($normSyncTarget, $normSyncRepl)
    $apiContent = $normApi.Replace("`n", "`r`n")
    Write-Host "api.js: Branchement du flux de synchronisation Supabase primaire effectue."
} else {
    Write-Error "Target synchroniser non trouve dans api.js."
}

[System.IO.File]::WriteAllText($apiPath, $apiContent, [System.Text.Encoding]::UTF8)

# -----------------------------------------------------------------------------
# 2. Mise à jour de src/ui/render.js
# -----------------------------------------------------------------------------
$renderPath = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\src\ui\render.js"
$renderContent = [System.IO.File]::ReadAllText($renderPath, [System.Text.Encoding]::UTF8)

$badgeFunc = @"
  function actualiserBadgeSourceBdd() {
    var b = $('badgeSourceBdd');
    if (!b) return;
    var prim = (S.config && S.config.basePrimaire) || 'supabase';
    if (prim === 'supabase') {
      b.className = 'badge-source badge-supabase';
      b.innerHTML = '⚡ Supabase';
      b.title = 'Base active : Supabase Cloud (Google Sheets en miroir secondaire). Cliquez pour basculer.';
    } else {
      b.className = 'badge-source badge-sheets';
      b.innerHTML = '📊 Sheets';
      b.title = 'Base active : Google Sheets (Supabase en miroir secondaire). Cliquez pour basculer.';
    }
  }

"@

$normRender = $renderContent.Replace("`r`n", "`n")
if (-not $normRender.Contains("function actualiserBadgeSourceBdd()")) {
    $idxAff = $normRender.IndexOf("function afficherEntete() {")
    if ($idxAff -ge 0) {
        $normRender = $normRender.Substring(0, $idxAff) + $badgeFunc.Replace("`r`n", "`n") + $normRender.Substring($idxAff)
        $normRender = $normRender.Replace("function afficherEntete() {`n    setTimeout(majHauteurEntete, 0);", "function afficherEntete() {`n    setTimeout(majHauteurEntete, 0);`n    try { actualiserBadgeSourceBdd(); } catch (e) {}")
        [System.IO.File]::WriteAllText($renderPath, $normRender.Replace("`n", "`r`n"), [System.Text.Encoding]::UTF8)
        Write-Host "render.js: actualiserBadgeSourceBdd integre."
    }
}

# -----------------------------------------------------------------------------
# 3. Mise à jour de src/engine/actions.js
# -----------------------------------------------------------------------------
$actPath = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\src\engine\actions.js"
$actContent = [System.IO.File]::ReadAllText($actPath, [System.Text.Encoding]::UTF8)

$actHook = @"
    basculerSourceBdd: function () {
      var act = (S.config && S.config.basePrimaire) || 'supabase';
      var nouv = act === 'supabase' ? 'sheets' : 'supabase';
      S.config.basePrimaire = nouv;
      LS.set('config', S.config);
      var libelle = nouv === 'supabase' ? '⚡ Supabase Cloud (Sheets en miroir)' : '📊 Google Sheets (Supabase en miroir)';
      toast('Base active : ' + libelle + '. Rechargement immédiat...', 3000);
      try { actualiserBadgeSourceBdd(); } catch (e) {}
      setTimeout(function () { synchroniser(false, false, true); }, 200);
    },
    choisirBase: function (v) {
      if (!v) return;
      S.config.basePrimaire = v;
      LS.set('config', S.config);
      var libelle = v === 'supabase' ? '⚡ Supabase Cloud' : '📊 Google Sheets';
      toast('Base active : ' + libelle + '. Rechargement...', 3000);
      try { actualiserBadgeSourceBdd(); } catch (e) {}
      setTimeout(function () { synchroniser(false, false, true); }, 200);
    },
"@

$normAct = $actContent.Replace("`r`n", "`n")
if (-not $normAct.Contains("basculerSourceBdd:")) {
    $idxRecharge = $normAct.IndexOf("rechargerBase: function () {")
    if ($idxRecharge -ge 0) {
        $normAct = $normAct.Substring(0, $idxRecharge) + $actHook.Replace("`r`n", "`n") + "`n    " + $normAct.Substring($idxRecharge)
        [System.IO.File]::WriteAllText($actPath, $normAct.Replace("`n", "`r`n"), [System.Text.Encoding]::UTF8)
        Write-Host "actions.js: basculerSourceBdd et choisirBase integres."
    }
}

# -----------------------------------------------------------------------------
# 4. Mise à jour de src/views/reglages.js
# -----------------------------------------------------------------------------
$regPath = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\src\views\reglages.js"
$regContent = [System.IO.File]::ReadAllText($regPath, [System.Text.Encoding]::UTF8)

$regSnippet = @"
      '<h3>Base de données active</h3>' +
      '<p class="discret" style="margin-top:0">Basculez entre Supabase (ultra-rapide) et Google Sheets. L\'autre base reste synchronisée en miroir.</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:14px">' +
        '<button class="bouton ' + (((S.config && S.config.basePrimaire) || 'supabase') === 'supabase' ? 'bouton-plein' : '') + '" type="button" data-a="choisirBase" data-v="supabase" style="flex:1">⚡ Supabase Cloud (Actif)</button>' +
        '<button class="bouton ' + ((S.config && S.config.basePrimaire) === 'sheets' ? 'bouton-plein' : '') + '" type="button" data-a="choisirBase" data-v="sheets" style="flex:1">📊 Google Sheets</button>' +
      '</div>' +
"@

$normReg = $regContent.Replace("`r`n", "`n")
if (-not $normReg.Contains("Base de données active")) {
    $targetReg = "'<h3>Sauvegarde</h3>"
    $idxReg = $normReg.IndexOf($targetReg)
    if ($idxReg -ge 0) {
        $normReg = $normReg.Substring(0, $idxReg) + $regSnippet.Replace("`r`n", "`n") + "`n      " + $normReg.Substring($idxReg)
        [System.IO.File]::WriteAllText($regPath, $normReg.Replace("`n", "`r`n"), [System.Text.Encoding]::UTF8)
        Write-Host "reglages.js: Selecteur de base de donnees integre."
    }
}

# -----------------------------------------------------------------------------
# 5. Mise à jour de index.html
# -----------------------------------------------------------------------------
$htmlPath = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\index.html"
$htmlContent = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

$badgeHtml = '<button id="badgeSourceBdd" class="badge-source badge-supabase" data-a="basculerSourceBdd" type="button" title="Base active : Supabase Cloud (Google Sheets en miroir). Cliquez pour basculer.">⚡ Supabase</button>'
$targetHtml = '<span class="badge-version">v3.28.0</span>'

if (-not $htmlContent.Contains("id=""badgeSourceBdd""")) {
    $htmlContent = $htmlContent.Replace($targetHtml, "$targetHtml $badgeHtml")
    [System.IO.File]::WriteAllText($htmlPath, $htmlContent, [System.Text.Encoding]::UTF8)
    Write-Host "index.html: Badge interactif integre dans le header."
}

# -----------------------------------------------------------------------------
# 6. Mise à jour de app.css
# -----------------------------------------------------------------------------
$cssPath = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\app.css"
$cssContent = [System.IO.File]::ReadAllText($cssPath, [System.Text.Encoding]::UTF8)

$cssBadge = @"

/* Badge Source Base de données (Bascule Supabase / Sheets) */
.badge-source {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
  user-select: none;
  line-height: 1.2;
}
.badge-source:active {
  transform: scale(0.94);
}
.badge-source.badge-supabase {
  background: #10b981;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.35);
}
.badge-source.badge-sheets {
  background: #0284c7;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(2, 132, 199, 0.35);
}
"@

if (-not $cssContent.Contains(".badge-source {")) {
    $cssContent = $cssContent + $cssBadge
    [System.IO.File]::WriteAllText($cssPath, $cssContent, [System.Text.Encoding]::UTF8)
    Write-Host "app.css: Styles du badge de base de donnees ajoutes."
}

# -----------------------------------------------------------------------------
# 7. Recompilation du bundle app.js
# -----------------------------------------------------------------------------
Set-Location "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner"
& ".\scripts\build.ps1"

Write-Host "`n=== CONFIGURATION TERMINEE AVEC SUCCES ! ==="
