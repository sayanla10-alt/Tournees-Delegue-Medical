# scripts/patch_client_dual_write.ps1
$path = "C:\Users\YBS106386\.gemini\antigravity\scratch\mediplanner\src\api\api.js"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$target = @"
  function apiPost(action, payload) {
    var body = { token: S.config.token, action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    return appel(S.config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  }
"@

$replacement = @"
  // ------------------------------------------------------------------ Double Écriture Miroir Supabase (Temps Réel)
  var SUPABASE_CONFIG = {
    url: 'https://nldyinokqgshnzvdsxgr.supabase.co',
    key: 'sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL'
  };

  function postSupabaseRest_(table, rows) {
    if (!rows || !rows.length || !navigator.onLine) return;
    try {
      fetch(SUPABASE_CONFIG.url + '/rest/v1/' + table, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': 'Bearer ' + SUPABASE_CONFIG.key,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(rows)
      }).catch(function (e) {
        console.warn('Erreur miroir Supabase (' + table + '):', e);
      });
    } catch (e) {
      console.warn('Miroir Supabase non bloquant:', e);
    }
  }

  function miroirSupabaseClient(action, payload) {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) return;
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
        if (rows.length) postSupabaseRest_('visites', rows);
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
            postSupabaseRest_('pharmacies', [prat]);
          } else {
            postSupabaseRest_('praticiens', [prat]);
            if (lieux.length) {
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
              postSupabaseRest_('presences', pres);
            }
          }
        }
      } else if (action === 'rapport' && payload.rapport) {
        var r = payload.rapport;
        postSupabaseRest_('rapports', [{
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
        if (plans.length) postSupabaseRest_('plannings', plans);
      } else if (action === 'etablissement' && payload) {
        var etab = payload.etablissement || payload;
        if (etab.code && etab.nom) {
          postSupabaseRest_('etablissements', [{
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
  }

  function apiPost(action, payload) {
    var body = { token: S.config.token, action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    // Double écriture miroir Supabase automatique et non-bloquante
    miroirSupabaseClient(action, payload);
    return appel(S.config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  }
"@

# Normalize newlines for matching
$normContent = $content.Replace("`r`n", "`n")
$normTarget = $target.Replace("`r`n", "`n")
$normRepl = $replacement.Replace("`r`n", "`n")

if ($normContent.Contains($normTarget)) {
    $normContent = $normContent.Replace($normTarget, $normRepl)
    [System.IO.File]::WriteAllText($path, $normContent.Replace("`n", "`r`n"), [System.Text.Encoding]::UTF8)
    Write-Host "Patch src/api/api.js : SUCCES !"
} else {
    Write-Host "Target non trouve dans src/api/api.js"
}
