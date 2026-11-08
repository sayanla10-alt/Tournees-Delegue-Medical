/* =============================================================================
   supabase.js : Connecteur direct Supabase (PostgREST) pour MediPlanner
   - Lecture ultra-rapide (< 400 ms) des 10 tables en parallèle
   - Double écriture miroir (Visites, Fiches, Plannings, Rapports)
   - Repli transparent sur Google Sheets si hors-ligne ou erreur
   ============================================================================= */

  // 3.28.10 : Supabase est tenu à jour par le serveur (Jumelage.gs, toutes les 5 min, ajouts, modifications et suppressions).
  // Le téléphone n'écrit plus directement dans Supabase (évitait les fiches TMP orphelines et les écritures perdues).
  var MIROIR_CLIENT = false;
  var SUPABASE_CONFIG = {
    url: 'https://nldyinokqgshnzvdsxgr.supabase.co',
    key: 'sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL',
    delaiMs: 15000
  };

  function supabaseHeaders_(avecType) {
    var h = {
      'apikey': SUPABASE_CONFIG.key,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.key,
      'Accept': 'application/json'
    };
    if (avecType) h['Content-Type'] = 'application/json; charset=utf-8';
    return h;
  }

  // 3.28.13 : empreinte légère de Supabase (nombre de lignes et dernière modification de chaque table).
  // Toutes les 15 s, le téléphone la compare : la base n'est rechargée que si un délégué (ou le Sheet) a changé quelque chose.
  var MARQUEUR_TABLES = ['praticiens', 'presences', 'pharmacies', 'etablissements', 'visites', 'plannings', 'rapports', 'quartiers', 'fiches_produits', 'listes_reference'];
  function marqueurSupabase_() {
    return Promise.all(MARQUEUR_TABLES.map(function (t) {
      var h = supabaseHeaders_(false); h.Prefer = 'count=exact';
      return fetch(SUPABASE_CONFIG.url + '/rest/v1/' + t + '?select=updated_at&order=updated_at.desc&limit=1', { headers: h, cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('Supabase HTTP ' + r.status);
        return r.json().then(function (j) { return String((r.headers.get('content-range') || '').split('/')[1] || '') + '@' + ((j && j[0] && j[0].updated_at) || ''); });
      });
    })).then(function (l) { return l.join('|'); });
  }
  function supabaseGet_(endpoint) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, SUPABASE_CONFIG.delaiMs) : null;
    var opts = {
      method: 'GET',
      headers: supabaseHeaders_(false)
    };
    if (ctrl) opts.signal = ctrl.signal;

    return fetch(SUPABASE_CONFIG.url + '/rest/v1/' + endpoint, opts).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('Supabase ' + r.status);
      return r.json();
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function supabaseUpsert_(table, payload, onConflict) {
    if (!payload || (Array.isArray(payload) && !payload.length)) return Promise.resolve(true);
    var url = SUPABASE_CONFIG.url + '/rest/v1/' + table +
      (onConflict ? '?on_conflict=' + encodeURIComponent(onConflict) : '');
    var headers = supabaseHeaders_(true);
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';

    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('Supabase ' + table + ' ' + r.status + ': ' + t);
        });
      }
      return true;
    });
  }

  function supabasePing_() {
    return supabaseGet_('praticiens?select=code&limit=1');
  }

  // 3.28.10 : état de la synchronisation Sheets -> Supabase (renvoyé par le serveur, action « jumelage »)
  var NOMS_TABLES = { praticiens: 'Médecins', pharmacies: 'Pharmacies', presences: 'Présences', etablissements: 'Hôpitaux', visites: 'Visites', plannings: 'Tournées', rapports: 'Rapports du jour', quartiers: 'Quartiers', fiches_produits: 'Fiches produits', listes_reference: 'Listes' };
  function etatJumelageHtml() {
    var e = S.ui.etatJumelage;
    if (!e) return '<p class="discret" style="margin:0 0 10px">Touchez « Vérifier la synchronisation » pour voir la date de la dernière recopie et le nombre de lignes de chaque base.</p>';
    if (e.erreur) return '<p class="discret" style="margin:0 0 10px">' + esc(e.erreur) + '</p>';
    var t = e.tables || {}, d = e.derniere ? new Date(e.derniere) : null;
    var h = '<p style="margin:0 0 6px;font-size:13px"><b>Dernière synchronisation :</b> ' + (d ? esc(d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) : 'jamais') +
      (e.ok === false ? ' · <b>à reprendre</b>' : (d ? ' · à jour' : '')) + '</p>';
    h += '<table class="tableau-jumelage" style="width:100%;border-collapse:collapse;font-size:12.5px;margin:0 0 10px"><thead><tr><th style="text-align:left;padding:4px 0">Table</th><th style="text-align:right">Sheets</th><th style="text-align:right">Supabase</th></tr></thead><tbody>' +
      Object.keys(NOMS_TABLES).map(function (k) {
        var x = t[k] || {}, egal = x.sheets !== undefined && x.sheets === x.supabase;
        return '<tr style="border-top:1px solid var(--trait)"><td style="padding:4px 0">' + NOMS_TABLES[k] + '</td><td style="text-align:right">' + (x.sheets !== undefined ? x.sheets : '–') + '</td><td style="text-align:right' + (x.erreur ? '' : (egal ? ';color:var(--vert)' : '')) + '">' +
          (x.erreur ? esc(x.erreur.slice(0, 40)) : (x.supabase !== undefined ? x.supabase : '–')) + '</td></tr>';
      }).join('') + '</tbody></table>';
    return h;
  }
  // 3.28.11 : Supabase renvoie au plus 1000 lignes par appel : lecture par pages
  function supabaseGetTout_(endpoint, max) {
    var pas = 1000, tout = [];
    function page(off) {
      return supabaseGet_(endpoint + (endpoint.indexOf('?') < 0 ? '?' : '&') + 'limit=' + pas + '&offset=' + off).then(function (l) {
        tout = tout.concat(l || []);
        return (l && l.length === pas && (!max || tout.length < max)) ? page(off + pas) : tout;
      });
    }
    return page(0);
  }
  function chargerToutSupabase() {
    return Promise.all([
      supabaseGetTout_('praticiens?select=*&order=code'),
      supabaseGetTout_('presences?select=*&order=id'),
      supabaseGetTout_('pharmacies?select=*&order=code'),
      supabaseGet_('etablissements?select=*&order=nom'),
      supabaseGet_('fiches_produits?select=*&order=produit'),
      supabaseGetTout_('quartiers?select=*&order=quartier'),
      supabaseGet_('listes_reference?select=*&order=ordre'),
      supabaseGetTout_('plannings?select=*&order=id'),
      supabaseGet_('visites?select=*&order=date.desc&limit=1500'),
      supabaseGet_('rapports?select=*&order=date.desc&limit=100')
    ]).then(function (res) {
      var rawPrats = res[0] || [];
      var rawPres = res[1] || [];
      var rawPharm = res[2] || [];
      var rawEtab = res[3] || [];
      var rawFiches = res[4] || [];
      var rawQuartiers = res[5] || [];
      var rawListes = res[6] || [];
      var rawPlannings = res[7] || [];
      var rawVisites = res[8] || [];
      var rawRapports = res[9] || [];

      // 1. Praticiens (Médecins)
      var praticiens = rawPrats.map(function (p) {
        return {
          code: String(p.code),
          type: p.type || 'Médecin',
          nom: p.nom,
          specialite: p.specialite || 'Généraliste',
          note: +p.note || 2,
          conventionne: (p.conventionne === true || p.conventionne === 'Oui') ? 'Oui' : 'Non',
          telephone: p.telephone || '',
          derniere: p.derniere ? String(p.derniere).slice(0, 10) : '',
          statut: p.statut || '',
          commentaire: p.commentaire || '',
          nbVisites: +p.nb_visites || 0,
          actif: (p.actif === false || p.actif === 'Non' || p.actif === '0') ? 'Non' : 'Oui',
          prochaine: p.prochaine || '', absentDu: p.absent_du || '', absentAu: p.absent_au || ''
        };
      });

      // 2. Présences (Médecins)
      var presences = rawPres.map(function (pr) {
        return {
          id: String(pr.id),
          code: String(pr.code),
          nom: pr.nom || '',
          lieu: pr.lieu || '',
          quartier: pr.quartier || '',
          commune: pr.commune || '',
          zone: pr.zone || '',
          lundi: pr.lundi || '',
          mardi: pr.mardi || '',
          mercredi: pr.mercredi || '',
          jeudi: pr.jeudi || '',
          vendredi: pr.vendredi || '',
          horaireMatin: pr.horaire_matin || '',
          horaireSoir: pr.horaire_soir || '',
          lat: isFinite(pr.lat) && pr.lat !== null ? +pr.lat : null,
          lon: isFinite(pr.lon) && pr.lon !== null ? +pr.lon : null,
          reperes: pr.reperes || '',
          secteur: pr.secteur || '', origineGps: pr.origine_gps || ''
        };
      });

      // 3. Pharmacies (Ajoutées aux Praticiens + Synthèse des Présences)
      rawPharm.forEach(function (ph) {
        praticiens.push({
          code: String(ph.code),
          type: 'Pharmacie',
          nom: ph.nom,
          specialite: 'Pharmacien',
          note: +ph.note || 2,
          conventionne: (ph.conventionne === true || ph.conventionne === 'Oui') ? 'Oui' : 'Non',
          telephone: ph.telephone || '',
          derniere: ph.derniere ? String(ph.derniere).slice(0, 10) : '',
          statut: ph.statut || '',
          commentaire: ph.commentaire || '',
          nbVisites: +ph.nb_visites || 0,
          actif: (ph.actif === false || ph.actif === 'Non' || ph.actif === '0') ? 'Non' : 'Oui',
          prochaine: ph.prochaine || '',
          titulaire: ph.titulaire || ''
        });

        presences.push({
          id: 'P-' + ph.code,
          code: String(ph.code),
          nom: ph.nom,
          lieu: ph.nom,
          quartier: ph.quartier || '',
          commune: ph.commune || 'Abidjan',
          zone: ph.zone || '',
          horaireMatin: ph.horaire_matin || '08:00 - 12:30',
          horaireSoir: ph.horaire_soir || '15:00 - 19:30',
          lat: isFinite(ph.lat) && ph.lat !== null ? +ph.lat : null,
          lon: isFinite(ph.lon) && ph.lon !== null ? +ph.lon : null,
          reperes: ph.reperes || '', origineGps: ph.origine_gps || '',
          lundi: 'Matin et soir',
          mardi: 'Matin et soir',
          mercredi: 'Matin et soir',
          jeudi: 'Matin et soir',
          vendredi: 'Matin et soir'
        });
      });

      // 4. Établissements
      var etablissements = rawEtab.map(function (e) {
        return {
          code: String(e.code || e.id || ''),
          nom: e.nom || '',
          categorie: e.categorie || '',
          commune: e.commune || '',
          quartier: e.quartier || '',
          zone: e.zone || '',
          lat: isFinite(e.lat) && e.lat !== null ? +e.lat : null,
          lon: isFinite(e.lon) && e.lon !== null ? +e.lon : null,
          telephone: e.telephone || '',
          reperes: e.reperes || ''
        };
      });

      // 5. Quartiers
      var quartiers = rawQuartiers.map(function (q) {
        return {
          commune: q.commune || '',
          quartier: q.quartier || '',
          zone: q.zone || '',
          lat: isFinite(q.lat) && q.lat !== null ? +q.lat : null,
          lon: isFinite(q.lon) && q.lon !== null ? +q.lon : null,
          secteur: q.secteur || ''
        };
      });

      // 6. Fiches Produits
      var fiches = rawFiches.map(function (f) {
        return {
          produit: f.produit || '',
          gamme: f.gamme || '',
          aire: f.aire || '',
          dci: f.dci || '',
          classe: f.classe || '',
          indications: f.indications || '',
          contreIndications: f.contre_indications || '',
          posologie: f.posologie || '',
          precautions: f.precautions || '',
          effets: f.effets || '',
          arguments: f.arguments || '',
          laboratoire: f.laboratoire || '',
          sources: f.sources || '',
          actif: f.actif !== false && f.actif !== 'Non' && f.actif !== '0'
        };
      });

      // 7. Listes de Référence
      var produits = [];
      var delegues = [];
      var statuts = [];
      var feries = [];
      var activites = [];
      var activitesPharmacie = [];

      rawListes.forEach(function (item) {
        var cat = item.categorie;
        var val = item.valeur;
        if (!val) return;
        if (cat === 'produit') produits.push(val);
        else if (cat === 'delegue') delegues.push(val);
        else if (cat === 'ferie') feries.push(val);
        else if (cat === 'activite') activites.push(val);
        else if (cat === 'activite_pharmacie') activitesPharmacie.push(val);
        else if (cat === 'statut') {
          statuts.push({
            statut: val,
            compteCommeVisite: (item.metadata && item.metadata.compte_comme_visite) ? 'Oui' : 'Non'
          });
        }
      });

      // 8. Plannings
      var plannings = rawPlannings.map(function (p) {
        return {
          id: p.id,
          delegue: p.delegue || '',
          date: p.date ? String(p.date).slice(0, 10) : '',
          heure: p.heure || '',
          debut: p.debut || '',
          fin: p.fin || '',
          creneau: p.creneau || '',
          code: p.code || '',
          nom: p.nom || '',
          specialite: p.specialite || '',
          note: +p.note || 2,
          quartier: p.quartier || '',
          commune: p.commune || '',
          lieu: p.lieu || '',
          statut: p.statut || '',
          etat: p.etat || 'planifie',
          programme: p.programme || '',
          idPresence: p.id_presence || '',
          maj: p.maj || '', uid: p.id_arret || '', depuis: p.cible_depuis || ''
        };
      });

      // 9. Visites (Historique)
      var historique = rawVisites.map(function (v) {
        return {
          uid: v.uid,
          date: v.date ? String(v.date).slice(0, 10) : '',
          horodatage: v.horodatage || v.created_at || (v.date + 'T12:00:00Z'),
          delegue: v.delegue || '',
          code: v.code || '',
          idPresence: v.id_presence || null,
          nom: v.nom || '',
          type: v.type || 'Médecin',
          specialite: v.specialite || '',
          note: +v.note || 2,
          commune: v.commune || '',
          quartier: v.quartier || '',
          lieu: v.lieu || '',
          creneau: v.creneau || '',
          statut: v.statut || 'Visite faite',
          activite: v.type_echange || '',
          produits: v.produits_presentes || '',
          echantillons: v.echantillons || '',
          prochaine: v.prochaine_etape || (v.prochaine_visite ? String(v.prochaine_visite).slice(0, 10) : ''),
          commentaire: v.commentaire || '',
          interlocuteur: v.interlocuteur || '', reactions: v.reactions || '', stocks: v.stocks || '',
          commande: v.commande || '', complements: v.complements || '', suite: v.suite || ''
        };
      });

      // 10. Rapports
      var rapports = rawRapports.map(function (r) {
        return {
          date: r.date ? String(r.date).slice(0, 10) : '',
          delegue: r.delegue || '',
          valideLe: r.valide_le || r.created_at || '',
          prevues: +r.prevues || 0, faites: +r.faites || 0, nonFaites: r.non_faites || '', sansCr: +r.sans_cr || 0,
          synthese: r.synthese || '', faits: r.faits || '', concurrence: r.concurrence || '', besoins: r.besoins || '',
          km: +r.km || 0, maj: r.maj || ''
        };
      });

      // comme la lecture du Sheet : fiches et produits inactifs écartés
      var inactifs = {};
      fiches.forEach(function (f) { if (!f.actif) inactifs[normaliser(f.produit)] = true; });
      fiches = fiches.filter(function (f) { return f.produit && f.actif; });
      produits = produits.filter(function (p) { return !inactifs[normaliser(p)]; });

      var sig = 'SB-' + praticiens.length + '-' + presences.length + '-' + fiches.length + '-' + Date.now();

      return {
        ok: true,
        version: 1,
        source: 'supabase',
        sig: sig,
        praticiens: praticiens,
        presences: presences,
        quartiers: quartiers,
        statuts: statuts,
        etablissements: etablissements,
        delegues: delegues,
        feries: feries,
        activites: activites,
        activitesPharmacie: activitesPharmacie,
        produits: produits,
        fiches: fiches,
        historique: historique,
        plannings: plannings,
        rapports: rapports,
        syncedAt: new Date().toISOString(),
        serveurRecent: true
      };
    });
  }

  // Double écriture : Visites
  function supabaseMiroirVisites(visites) {
    if (!visites || !visites.length) return Promise.resolve(true);
    var lignes = visites.map(function (v) {
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
        produits_presentes: v.produits || v.produitsPresentes || null,
        echantillons: v.echantillons || null,
        prochaine_visite: v.prochaine ? String(v.prochaine).slice(0, 10) : null,
        commentaire: String(v.commentaire || '')
      };
    }).filter(function (r) { return r.uid && r.code; });

    if (!lignes.length) return Promise.resolve(true);
    return supabaseUpsert_('visites', lignes, 'uid');
  }

  // Double écriture : Fiche Praticien / Pharmacie + Présences
  function supabaseMiroirFiche(praticien, presences) {
    if (!praticien || !praticien.code) return Promise.resolve(true);
    var table = praticien.type === 'Pharmacie' ? 'pharmacies' : 'praticiens';
    var pRow;
    if (table === 'pharmacies') {
      pRow = {
        code: praticien.code,
        nom: praticien.nom,
        titulaire: praticien.titulaire || '',
        quartier: praticien.quartier || '',
        commune: praticien.commune || 'Abidjan',
        zone: praticien.zone || '',
        telephone: praticien.telephone || '',
        note: +praticien.note || 2,
        conventionne: praticien.conventionne === 'Oui' || praticien.conventionne === true,
        actif: praticien.actif !== 'Non' && praticien.actif !== false,
        updated_at: new Date().toISOString()
      };
    } else {
      pRow = {
        code: praticien.code,
        type: praticien.type || 'Médecin',
        nom: praticien.nom,
        specialite: praticien.specialite || 'Généraliste',
        note: +praticien.note || 2,
        conventionne: praticien.conventionne === 'Oui' || praticien.conventionne === true,
        telephone: praticien.telephone || '',
        actif: praticien.actif !== 'Non' && praticien.actif !== false,
        updated_at: new Date().toISOString()
      };
    }

    return supabaseUpsert_(table, [pRow], 'code').then(function () {
      if (!presences || !presences.length) return true;
      var presRows = presences.map(function (l, idx) {
        return {
          id: String(l.id || (praticien.code + '_' + idx)),
          code: praticien.code,
          nom: praticien.nom,
          lieu: l.lieu,
          quartier: l.quartier || '',
          commune: l.commune || 'Abidjan',
          zone: l.zone || '',
          lundi: l.lundi || '',
          mardi: l.mardi || '',
          mercredi: l.mercredi || '',
          jeudi: l.jeudi || '',
          vendredi: l.vendredi || '',
          horaire_matin: l.horaireMatin || '',
          horaire_soir: l.horaireSoir || '',
          lat: isFinite(l.lat) && l.lat !== null ? +l.lat : null,
          lon: isFinite(l.lon) && l.lon !== null ? +l.lon : null,
          reperes: l.reperes || ''
        };
      });
      return supabaseUpsert_('presences', presRows, 'id');
    });
  }

  // Double écriture : Planning Tournée
  function supabaseMiroirPlanning(payload) {
    if (!payload || !payload.arrets || !payload.arrets.length) return Promise.resolve(true);
    var lignes = payload.arrets.map(function (a) {
      return {
        delegue: payload.delegue || 'Délégué',
        date: String(a.date).slice(0, 10),
        heure: a.heure || '',
        debut: a.debut || null,
        fin: a.fin || null,
        creneau: a.creneau || '',
        id_presence: a.idPresence ? String(a.idPresence) : null,
        code: String(a.code || ''),
        nom: String(a.nom || ''),
        specialite: String(a.specialite || ''),
        note: +a.note || 2,
        quartier: a.quartier || '',
        commune: a.commune || '',
        lieu: a.lieu || '',
        statut: a.statut || '',
        etat: a.etat || 'planifie',
        programme: a.programme || 'Proposition'
      };
    });
    return supabaseUpsert_('plannings', lignes);
  }

  // Double écriture : Rapport
  function supabaseMiroirRapport(payload) {
    if (!payload || !payload.date || !payload.delegue) return Promise.resolve(true);
    var rRow = {
      delegue: payload.delegue,
      date: String(payload.date).slice(0, 10),
      valide_le: payload.valideLe || new Date().toISOString(),
      prevues: +payload.medecins || 0,
      faites: +payload.visites || 0,
      non_faites: +payload.pharmacies || 0,
      sans_cr: 0,
      synthese: payload.commentaire || ''
    };
    return supabaseUpsert_('rapports', [rRow], 'delegue,date');
  }
