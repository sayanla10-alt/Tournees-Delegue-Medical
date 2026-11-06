  // ------------------------------------------------------------------ Équipe
  function moi() { return String(S.config.delegue || '').trim(); }
  function estMoi(nom) { return String(nom || '').trim().toLowerCase() === moi().toLowerCase(); }
  function arretsCollegues() {
    return ((S.data && S.data.plannings) || []).filter(function (p) { return p.delegue && !estMoi(p.delegue); });
  }
  // Collègues ayant prévu ce praticien la même semaine que la date donnée
  function cibleParCollegues(code, date) {
    var l = lundiDe(date);
    return arretsCollegues().filter(function (p) { return p.code === code && lundiDe(p.date) === l; });
  }
  function etiquetteCollegues(code, date) {
    var l = cibleParCollegues(code, date);
    if (!l.length) return '';
    var v = l.some(function (p) { return p.programme === 'Validé'; });
    return '<span class="etiquette equipe">' + (v ? 'Prévu par ' : 'Envisagé par ') + esc(l[0].delegue) + ', ' + dateCourte(l[0].date) +
      (l.length > 1 ? ' (+' + (l.length - 1) + ')' : '') + '</span>';
  }
  function exclusCollegues(dates) {
    var semaines = {}, ex = {};
    dates.forEach(function (d) { semaines[lundiDe(d)] = true; });
    arretsCollegues().forEach(function (p) { if (semaines[lundiDe(p.date)]) ex[p.code] = true; });
    return ex;
  }
  // Praticiens d'un programme validé par un collègue : jamais proposés, même si l'option « éviter » est désactivée
  function exclusValides(dates) {
    var semaines = {}, ex = {};
    dates.forEach(function (d) { semaines[lundiDe(d)] = true; });
    arretsCollegues().forEach(function (p) { if (p.programme === 'Validé' && semaines[lundiDe(p.date)]) ex[p.code] = true; });
    return ex;
  }

  // ------------------------------------------------------------------ API Google Apps Script
  // Erreur « réessayable » : réseau, délai, serveur occupé ou réponse non JSON (page d'erreur Google)
  function erreur(msg, reessai) { var e = new Error(msg); e.reessai = !!reessai; return e; }
  function appelUnique(url, options) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var minuteur = ctrl ? setTimeout(function () { ctrl.abort(); }, pret() ? 45000 : 120000) : null;   // 3.26.73 : 2 min au premier chargement (réseau lent)
    var o = Object.assign({}, options); if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).then(function (r) {
      if (!r.ok) throw erreur('Le serveur a répondu ' + r.status + '.', r.status >= 500 || r.status === 429);
      return r.text().then(function (t) {
        try { return JSON.parse(t); } catch (x) { throw erreur('Le serveur est momentanément indisponible.', true); }
      });
    }, function (e) {
      throw erreur(e && e.name === 'AbortError' ? 'Le serveur ne répond pas (délai dépassé).' :
        'Connexion impossible. Vérifiez le réseau.', true);
    }).then(function (j) {
      if (minuteur) clearTimeout(minuteur);
      if (!j || !j.ok) { var ex = erreur((j && j.erreur) || 'Réponse inattendue du serveur.', !!(j && j.reessai)); ex.refus = !!j && !j.reessai; throw ex; }
      return j;
    }, function (e) { if (minuteur) clearTimeout(minuteur); throw e; });
  }
  // Jusqu'à 3 tentatives espacées (1,5 s puis 4 s) pour les erreurs passagères
  function appel(url, options, essai) {
    essai = essai || 0;
    return appelUnique(url, options).catch(function (e) {
      if (!e.reessai || essai >= 2 || !navigator.onLine) throw e;
      return new Promise(function (ok) { setTimeout(ok, essai ? 4000 : 1500); }).then(function () { return appel(url, options, essai + 1); });
    });
  }
  function apiGet(action, cfg) {
    cfg = cfg || S.config;
    return appel(cfg.url + (cfg.url.indexOf('?') < 0 ? '?' : '&') + 'action=' + action +
                 '&token=' + encodeURIComponent(cfg.token) + '&_=' + Date.now(), { method: 'GET' });
  }
  // 3.26.83 : un téléphone relié à un ancien déploiement du serveur bascule tout seul sur le déploiement à jour,
  // si celui-ci répond avec le même classeur et le même jeton (aucune action du délégué)
  var URL_SERVEUR_ACTUEL = 'https://script.google.com/macros/s/AKfycbz3KAK4O5-muaKVjh13OyBUrlt0824XAwSGHWZVu89Od8ZvHd7Y0b5lOp7mRRNTi7Lt/exec';
  function basculerServeurActuel() {
    if (!connecte() || S.config.url.split('?')[0] === URL_SERVEUR_ACTUEL) return Promise.resolve(false);
    var neuf = { url: URL_SERVEUR_ACTUEL, token: S.config.token };
    return Promise.all([apiGet('ping'), apiGet('ping', neuf)]).then(function (r) {
      if (!r[0] || !r[1] || !r[1].ok || r[0].classeur !== r[1].classeur) return false;
      S.config.url = URL_SERVEUR_ACTUEL; LS.set('config', S.config);
      if (S.data) S.data.serveurRecent = false;
      toast('Connexion mise à jour vers le serveur actuel. Rechargement des données…', 4000);
      return true;
    }).catch(function () { return false; });
  }
  // ------------------------------------------------------------------ Double Ã‰criture Miroir Supabase (Temps RÃ©el)
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
            delegue: String(v.delegue || moi() || 'DÃ©lÃ©guÃ©'),
            code: String(v.code || ''),
            id_presence: v.idPresence ? String(v.idPresence) : null,
            nom: String(v.nom || ''),
            type: String(v.type || 'MÃ©decin'),
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
            type: String(p.type || 'MÃ©decin'),
            nom: String(p.nom),
            specialite: String(p.specialite || 'GÃ©nÃ©raliste'),
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
          delegue: String(r.delegue || moi() || 'DÃ©lÃ©guÃ©'),
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
        var del = String(payload.delegue || moi() || 'DÃ©lÃ©guÃ©');
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
            statut: String(a.statut || 'Ã€ faire'),
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
      console.warn('Miroir Supabase client ignorÃ© (erreur passive):', eSup);
    }
  }

  function apiPost(action, payload) {
    var body = { token: S.config.token, action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    // Double Ã©criture miroir Supabase automatique et non-bloquante
    miroirSupabaseClient(action, payload);
    return appel(S.config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  }
  function connecte() { return !S.config.demo && !!S.config.url; }

  // Tournée publiée : remplace la précédente sur toute la période concernée
  function porteePlan() {
    var d = S.plan.map(function (a) { return a.date; }).sort();
    return d.length ? { debut: d[0], fin: d[d.length - 1] } : null;
  }
  function chargePlan() {
    // 3.24.9 : avant toute publication, les jours connus (archives, base, comptes rendus) sont repris :
    // la base n'efface plus un jour simplement absent du téléphone
    importerAgenda();
    var p = porteePlan() || { debut: aujourdhui(), fin: aujourdhui() }, ancien = S.ui.portee;
    if (ancien) { if (ancien.debut < p.debut) p.debut = ancien.debut; if (ancien.fin > p.fin) p.fin = ancien.fin; }
    // agenda importé : la base reflète exactement mes 7 derniers jours et tout l'à venir
    if (LS.get('agendaImporte', false)) { var lim = ajouterJours(aujourdhui(), -7); if (lim < p.debut) p.debut = lim; }
    return { delegue: moi(), debut: p.debut, fin: p.fin, arrets: S.plan.map(function (a) {
      var prog = jourConfirme(a.date) ? 'Validé' : 'Proposition';
      return { date: a.date, heure: a.heure, creneau: a.creneau, debut: a.debut, fin: a.fin, idPresence: a.idPresence,
               code: a.code, nom: a.nom, specialite: a.specialite, note: a.note, quartier: a.quartier, commune: a.commune,
               lieu: a.lieu, statut: a.statut, etat: a.etat, programme: prog, uid: a.uid };
    }) };
  }
  function publierPlan(sansModif) {
    marquerModifie(sansModif);
    if (!connecte()) return;
    S.ui.aPublier = true; LS.set('aPublier', true);
    synchroniser(true);
  }

  // 3.26.82 : les visites à venir (sans compte rendu) reprennent les données actuelles de la base à chaque synchronisation :
  // nom, spécialité, potentiel, engagé, hôpital, quartier, commune, GPS et plage horaire. La tournée n'est pas recalculée.
  function actualiserVisitesPlanifiees() {
    if (!pret()) return;
    ctxCache.data = null;
    var c = ctx(), t = aujourdhui(), n = 0;
    S.plan.forEach(function (a) {
      var p = c.prat[a.code]; if (!p) return;
      // 3.27.10 : nom, spécialité, potentiel et engagement corrigés dans la base : repris sur toutes les visites
      if (a.date < t || a.statut || a.etat === 'valide') {
        var av = JSON.stringify([a.nom, a.specialite, a.note]);
        a.nom = p.nom; a.specialite = p.specialite; a.note = p.note; a.conventionne = p.conv ? 'Oui' : 'Non';
        if (JSON.stringify([a.nom, a.specialite, a.note]) !== av) n++;
        return;
      }
      var avant = JSON.stringify([a.nom, a.specialite, a.note, a.conventionne, a.lieu, a.quartier, a.reperes, a.commune, a.lat, a.lon, a.debut, a.fin]);
      a.nom = p.nom; a.specialite = p.specialite; a.note = p.note; a.conventionne = p.conv ? 'Oui' : 'Non';
      var cr = creneauDe(a.code, a.date, a.idPresence, a.creneau);
      if (cr && (!a.idPresence || String(cr.idPresence) === String(a.idPresence))) {
        a.lieu = cr.lieu; a.quartier = cr.quartier; a.commune = cr.commune; a.zone = cr.zone; a.reperes = cr.reperes || '';
        if (cr.coord && !cr.coord.approx) { a.lat = cr.coord.lat; a.lon = cr.coord.lon; }
        a.debut = minutesVersHeure(cr.debut); a.fin = minutesVersHeure(cr.fin);
      }
      if (JSON.stringify([a.nom, a.specialite, a.note, a.conventionne, a.lieu, a.quartier, a.reperes, a.commune, a.lat, a.lon, a.debut, a.fin]) !== avant) n++;
    });
    if (n) { LS.set('plan', S.plan); }
    return n;
  }
  var minuteurReprise;
  function synchroniser(silencieux, sansGps, force) {
    if (!connecte()) return Promise.resolve();
    if (S.ui.enCours) return Promise.resolve();
    if (!navigator.onLine) { S.ui.sync = 'horsligne'; afficherEntete(); return Promise.resolve(); }
    S.ui.enCours = true; S.ui.sync = 'encours'; afficherEntete(); if (!pret()) rendreSiPossible();
    if (!sansGps) localiser(true, 'sync');   // 3.27.47 : localisation passive régulée (cache 3 min)
    var tentePub = false, aChange = true;
    // 1. fiches praticiens (codes définitifs), 2. comptes rendus, 3. tournée, 4. données à jour
    var envoi = envoyerFiches().catch(function (errF) {
      console.warn('Erreur envoi fiches, poursuite des comptes rendus:', errF);
      return null;
    }).then(function () {
      return traiterQueueVisites();
    });
    return envoi.then(function () { return envoyerRapportsEnAttente(); }).then(function () {
      if (!S.ui.aPublier || !moi()) return;
      tentePub = true;
      return apiPost('planning', chargePlan()).then(function (r) {
        S.ui.aPublier = false; LS.set('aPublier', false);
        S.ui.portee = porteePlan(); LS.set('portee', S.ui.portee);
        S.ui.conflits = r.conflits || [];
      });
    }).then(function () {
      // synchro allégée : empreinte des données de référence et date de la dernière visite connue
      // 3.26.81 : données reçues d'un ancien serveur (sans contrôle des doublons ni filtre des produits inactifs) : rechargement complet
      var ref = S.data && S.data.sig && S.data.praticiens && !force ? '&sig=' + encodeURIComponent(S.data.sig) : '';
      var hd = S.data && S.data.historique && S.data.historique.length ? S.data.historique.reduce(function (m, v) { return v.horodatage > m ? v.horodatage : m; }, '') : '';
      var sAt = S.data && S.data.syncedAt && !force ? '&syncedAt=' + encodeURIComponent(S.data.syncedAt) : '';
      var fParam = force ? '&force=1' : '';

      return apiGet('data' + ref + sAt + fParam + (hd ? '&hdepuis=' + encodeURIComponent(hd) : ''));
    }).then(function (d) {
      var ancien = S.data || { praticiens: [], presences: [], quartiers: [], statuts: [], delegues: [], feries: [], activites: [], activitesPharmacie: [], produits: [], fiches: [], historique: [], plannings: [], rapports: [] };
      var hist = d.historique || [];
      if (d.partiel) {
        var vus = {}; hist.forEach(function (v) { vus[v.uid] = true; });
        hist = hist.concat((ancien.historique || []).filter(function (v) { return !v.uid || !vus[v.uid]; }));
        hist.sort(function (a, b) { return String(b.horodatage || b.date) < String(a.horodatage || a.date) ? -1 : 1; });
        hist = hist.slice(0, 1500);
      }
      var praticiens = ancien.praticiens || [];
      var presences = ancien.presences || [];

      // 3.27.46 : Intégration de la synchronisation incrémentale Delta
      if (d.delta) {
        var modifsPrat = {};
        (d.delta.praticiens || []).forEach(function (np) {
          modifsPrat[np.code] = true;
          var idx = -1;
          for (var i = 0; i < praticiens.length; i++) {
            if (praticiens[i].code === np.code) { idx = i; break; }
          }
          if (idx >= 0) praticiens[idx] = np;
          else praticiens.push(np);
        });
        if (d.delta.presences && d.delta.presences.length) {
          presences = presences.filter(function (pr) { return !modifsPrat[pr.code]; }).concat(d.delta.presences);
        }
      } else if (!d.inchange) {
        praticiens = d.praticiens || [];
        presences = d.presences || [];
      }

      var base = d.inchange ? ancien : (d.delta ? ancien : d);
      // nom de délégué fusionné dans la base (ex. adresse e-mail saisie comme nom) : ce téléphone prend le bon nom
      if (d.alias && moi()) Object.keys(d.alias).forEach(function (k) {
        if (k.toLowerCase() === moi().toLowerCase()) { S.config.delegue = d.alias[k]; LS.set('config', S.config); S.ui.aPublier = true; LS.set('aPublier', true); }
      });
      S.data = { version: d.version || ancien.version, sig: d.sig || ancien.sig, praticiens: praticiens, presences: presences, quartiers: base.quartiers || ancien.quartiers || [],
                 statuts: base.statuts || ancien.statuts || [], etablissements: base.etablissements || ancien.etablissements || [], delegues: base.delegues || ancien.delegues || [], feries: base.feries || ancien.feries || [], activites: base.activites || ancien.activites || [], activitesPharmacie: base.activitesPharmacie || ancien.activitesPharmacie || [], produits: base.produits || ancien.produits || [], fiches: base.fiches || ancien.fiches || [],
                 historique: hist, plannings: d.plannings || ancien.plannings || [], rapports: d.rapports || ancien.rapports || [], syncedAt: d.syncedAt || new Date().toISOString(),
                 sauvegarde: d.sauvegarde || ancien.sauvegarde || '', serveurRecent: true, rev: d.rev || '' };
      if (!d.inchange && d.doublons && d.doublons.length) toast('Base : code en double à corriger : ' + d.doublons.slice(0, 3).join(', '));
      S.queue.forEach(function (v) { Moteur.appliquerVisite(S.data.praticiens, v, S.data.statuts); });
      S.fiches.forEach(function (f) { appliquerFiche(f.praticien, f.presences); });
      LS.set('data', S.data); ctxCache.data = null;
      var nVis = 0; try { nVis = actualiserVisitesPlanifiees() || 0; } catch (eA) { console.warn(eA); }
      var planChange = false; try { planChange = actualiserPlanDepuisServeur(); } catch (eP) { console.warn(eP); }
      aChange = !d.inchange || !!d.delta || nVis > 0 || planChange || hist.length !== (ancien.historique || []).length || JSON.stringify(d.plannings || []) !== JSON.stringify(ancien.plannings || []);
      if (!d.inchange && !d.delta && d.doublons === undefined) basculerServeurActuel().then(function (ok) { if (ok) setTimeout(function () { synchroniser(false); }, 300); });
      S.ui.sync = 'ok'; S.ui.erreur = ''; clearTimeout(minuteurReprise);
      // 3.23.3 : plus d'alerte « prévus par un collègue » ; l'étiquette « Prévu par … » de chaque ligne de Planifier suffit
      S.ui.conflits = []; setTimeout(notifierConflits, 1500);
      if (!silencieux) {
        if (d.delta && d.delta.praticiens && d.delta.praticiens.length) {
          toast('Données à jour (delta : ' + d.delta.praticiens.length + ' praticien(s) actualisé(s)).');
        } else if (d.inchange) {
          toast('Données à jour (aucun changement).');
        } else {
          toast('Données à jour : ' + S.data.praticiens.length + ' praticiens.');
        }
      }
    }).catch(function (e) {
      S.ui.sync = 'erreur'; S.ui.erreur = e.message;
      if (!silencieux) toast(e.message + (enAttente() ? ' Vos saisies sont conservées et seront renvoyées automatiquement.' : ''), 5000);
      // nouvelle tentative discrète 30 s plus tard
      clearTimeout(minuteurReprise);
      minuteurReprise = setTimeout(function () { if (navigator.onLine) synchroniser(true); }, 30000);
    }).then(function () {
      S.ui.enCours = false;
      importerAgenda();
      if (!sansGps || aChange || !S.ui.feuille) rendreSiPossible(); else afficherEntete();
      // 3.27.47 : Second appel redondant localiser supprimé pour économiser la batterie
      if (S.ui.aPublier && !tentePub && navigator.onLine) setTimeout(function () { synchroniser(true); }, 400);
    });
  }

  // 3.27.47 : Fiches praticiens envoyées avec traçabilité auteur et Dead-Letter Queue (anti-bloquant)
  function envoyerFiches() {
    if (!S.fiches.length) return Promise.resolve();
    var f = S.fiches[0];
    if (!f.uid) { f.uid = 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); LS.set('fiches', S.fiches); }
    return apiPost('fiche', { uid: f.uid, praticien: f.praticien, presences: f.presences, auteur: moi() }).then(function (r) {
      S.fiches.shift();
      if (r.ancien && r.code && r.ancien !== r.code) remplacerCode(r.ancien, r.code);
      if (r.ids) remplacerIds(r.ids);
      LS.set('fiches', S.fiches); LS.set('plan', S.plan); LS.set('imposes', S.imposes); LS.set('queue', S.queue);
      return envoyerFiches();
    }, function (e) {
      if (/Action inconnue/i.test(e.message)) { S.ui.serveurAncien = true; return; }

      f.tentatives = (f.tentatives || 0) + 1;
      f.derniereErreur = e.message || String(e);
      f.dernierEssai = new Date().toISOString();

      if (e.refus || f.tentatives >= 3) {
        var rejete = S.fiches.shift();
        S.deadLetter = S.deadLetter || { visites: [], fiches: [] };
        S.deadLetter.fiches = S.deadLetter.fiches || [];
        S.deadLetter.fiches.push(rejete);
        LS.set('fiches', S.fiches);
        LS.set('deadLetter', S.deadLetter);
        console.warn('Fiche mise en Dead-Letter Queue après ' + f.tentatives + ' échecs:', rejete, e);
        toast('Fiche « ' + (rejete.praticien && rejete.praticien.nom || '') + ' » mise de côté suite à des erreurs répétées. Les autres envois continuent.', 6000);
        return envoyerFiches();
      }

      if (S.fiches.length > 1) {
        S.fiches.push(S.fiches.shift());
        LS.set('fiches', S.fiches);
      }
      console.warn('Échec temporaire envoi fiche (tentative ' + f.tentatives + '/3):', e.message);
      return null;
    });
  }

  // 3.27.47 : Traitement résilient de la file de visites avec Dead-Letter Queue (anti-bloquant)
  function traiterQueueVisites() {
    if (!S.queue || !S.queue.length) return Promise.resolve();

    S.queue.forEach(function (v) {
      if (!v.uid) v.uid = 'V' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    });

    return apiPost('valider', { visites: S.queue }).then(function (r) {
      var recus = {};
      (r.recus || []).forEach(function (u) { recus[u] = true; });
      S.queue = S.queue.filter(function (v) { return !recus[v.uid]; });
      LS.set('queue', S.queue);
    }).catch(function (errBatch) {
      console.warn('Erreur envoi groupé de la file de visites, basculement en mode unitaire résilient:', errBatch);
      return viderQueueVisitesUnitaire(0);
    });
  }

  function viderQueueVisitesUnitaire(index) {
    if (!S.queue || index >= S.queue.length) return Promise.resolve();
    var v = S.queue[index];
    return apiPost('valider', { visites: [v] }).then(function (r) {
      if (r.recus && r.recus.indexOf(v.uid) >= 0) {
        S.queue.splice(index, 1);
        LS.set('queue', S.queue);
        return viderQueueVisitesUnitaire(index);
      } else {
        return viderQueueVisitesUnitaire(index + 1);
      }
    }).catch(function (errU) {
      v.tentatives = (v.tentatives || 0) + 1;
      v.derniereErreur = errU.message || String(errU);
      v.dernierEssai = new Date().toISOString();
      if (v.tentatives >= 3) {
        console.warn('Visite mise en Dead-Letter Queue après 3 échecs:', v);
        S.deadLetter = S.deadLetter || { visites: [], fiches: [] };
        S.deadLetter.visites = S.deadLetter.visites || [];
        S.deadLetter.visites.push(v);
        S.queue.splice(index, 1);
        LS.set('queue', S.queue);
        LS.set('deadLetter', S.deadLetter);
        toast('Un compte rendu a été mis de côté suite à des erreurs répétées (' + (v.nom || 'visite') + '). Les autres envois continuent.', 5000);
        return viderQueueVisitesUnitaire(index);
      }
      return viderQueueVisitesUnitaire(index + 1);
    });
  }
  function remplacerCode(ancien, code) {
    S.plan.forEach(function (a) { if (a.code === ancien) a.code = code; });
    S.imposes.forEach(function (a) { if (a.code === ancien) a.code = code; });
    if (S.ui.contactOuvert === ancien) S.ui.contactOuvert = code;
    S.queue.forEach(function (a) { if (a.code === ancien) a.code = code; });
    S.fiches.forEach(function (f) {
      if (f.praticien.code === ancien) f.praticien.code = code;
      f.presences.forEach(function (x) { if (x.code === ancien) x.code = code; });
    });
    if (S.data) {
      S.data.praticiens.forEach(function (x) { if (x.code === ancien) x.code = code; });
      S.data.presences.forEach(function (x) { if (x.code === ancien) x.code = code; });
    }
    ctxCache.data = null;
  }
  function remplacerIds(ids) {
    Object.keys(ids).forEach(function (ancien) {
      var nouveau = String(ids[ancien]);
      if (ancien === nouveau) return;
      S.plan.forEach(function (a) {
        if (String(a.idPresence) !== ancien) return;
        a.idPresence = nouveau;
        if (a.cle) a.cle = nouveau + a.cle.slice(a.cle.indexOf('|'));
      });
      S.imposes.forEach(function (im) { if (im.cle && im.cle.split('|')[0] === ancien) im.cle = nouveau + im.cle.slice(im.cle.indexOf('|')); });
      S.queue.forEach(function (v) { if (String(v.idPresence) === ancien) v.idPresence = nouveau; });
      S.fiches.forEach(function (f) { f.presences.forEach(function (x) { if (String(x.id) === ancien) x.id = nouveau; }); });
    });
  }

  // Mise à jour légère : tournées des collègues seulement
  function rafraichirEquipe() {
    if (!connecte() || !navigator.onLine || !S.data || S.ui.enCours) return Promise.resolve(false);
    return apiGet('equipe').then(function (r) {
      // les tournées plus anciennes (statistiques du mois) sont conservées
      var depuis = r.depuis || ajouterJours(aujourdhui(), -14);
      S.data.plannings = (S.data.plannings || []).filter(function (p) { return p.date < depuis; }).concat(r.plannings || []);
      // listes de la base (produits retirés ou ajoutés, activités, statuts, délégués) prises en compte sans attendre la synchronisation complète
      if (r.listes) ['produits', 'activites', 'activitesPharmacie', 'delegues', 'statuts'].forEach(function (k) { if (r.listes[k] && r.listes[k].length) S.data[k] = r.listes[k]; });
      LS.set('data', S.data); ctxCache.data = null;
      return true;
    }).catch(function () { return false; });
  }

