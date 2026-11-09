  VUES.suivi = function () {
    var sousVue = S.ui.suiviVue || 'bilan';
    var tete = '<div class="tete-vue"><h2 class="titre-vue">Suivi & Contrôle</h2></div>' +
      '<p class="sous-titre">Pilotez votre activité : réalisations, tournées de l\'équipe et qualité des données.</p>' +
      '<div class="segment-suivi" style="margin:4px 0 10px">' +
      segment('Sous-onglet Suivi', 'suiviVue', [['bilan', 'Bilan'], ['equipe', 'Équipe'], ['audit', 'Audit']], sousVue) +
      '</div>';
    return tete + (sousVue === 'equipe' ? VUES.equipe(true) : (sousVue === 'audit' ? VUES.audit(true) : VUES.bilan(true)));
  };

  VUES.audit = function (integre) {
    if (!S.data || !S.data.praticiens || !S.data.praticiens.length) {
      return (integre ? '' : '<div class="tete-vue"><h2 class="titre-vue">Audit Données & GPS</h2></div>') +
        '<div class="vide"><strong>Aucune donnée</strong>Connectez la BDD ou chargez les données de démonstration pour auditer la base.</div>';
    }

    var prats = S.data.praticiens, pres = S.data.presences || [], qList = quartiers();
    var qMap = {}; qList.forEach(function (q) { qMap[(q.quartier || '').trim().toLowerCase()] = q; });
    var presParCode = {}; pres.forEach(function (p) { (presParCode[p.code] = presParCode[p.code] || []).push(p); });

    var filtreAnomalie = S.ui.auditFiltre || 'tous';

    var total = prats.length;
    var sansGps = [], horsCi = [], ecartGeo = [], sansPresence = [], conformes = 0;
    var coordGroupes = {};

    prats.forEach(function (p) {
      var sesPres = presParCode[p.code] || [];
      var estPh = p.type === 'Pharmacie' || /^PHA-/i.test(p.code);
      var p0 = sesPres[0] || {};
      var lat = parseFloat(String(p0.lat || p.lat || '').replace(',', '.'));
      var lon = parseFloat(String(p0.lon || p.lon || '').replace(',', '.'));
      var aGps = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0);
      var dansCi = aGps && (lat >= 4.3 && lat <= 10.8) && (lon >= -8.6 && lon <= -2.4);

      var anomalie = null;

      if (!sesPres.length && !estPh) {
        sansPresence.push({ p: p, pres: p0, motif: 'Aucun créneau ni établissement renseigné' });
        anomalie = 'sansPresence';
      } else if (!aGps) {
        sansGps.push({ p: p, pres: p0, motif: 'Coordonnées GPS manquantes ou à zéro' });
        anomalie = 'sansGps';
      } else if (!dansCi) {
        horsCi.push({ p: p, pres: p0, motif: 'Coordonnées hors Côte d\'Ivoire (' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ')' });
        anomalie = 'horsCi';
      } else {
        var cleCoord = lat.toFixed(3) + '|' + lon.toFixed(3);
        coordGroupes[cleCoord] = coordGroupes[cleCoord] || [];
        coordGroupes[cleCoord].push({ p: p, pres: p0, lat: lat, lon: lon });

        var quartNom = (p0.quartier || p.quartier || '').trim().toLowerCase();
        var qRef = qMap[quartNom];
        if (!quartNom || quartNom === 'nl') {
          ecartGeo.push({ p: p, pres: p0, motif: 'Quartier non renseigné ou non localisé (NL)' });
          anomalie = 'ecartGeo';
        } else if (qRef && isFinite(qRef.lat)) {
          var dist = distanceVol({ lat: lat, lon: lon }, { lat: qRef.lat, lon: qRef.lon });
          if (dist > 8) {
            ecartGeo.push({ p: p, pres: p0, motif: 'Écart de ' + Math.round(dist) + ' km avec le quartier ' + qRef.quartier + ' (' + qRef.commune + ')' });
            anomalie = 'ecartGeo';
          }
        }
      }

      if (!anomalie) conformes++;
    });

    var centroides = [];
    Object.keys(coordGroupes).forEach(function (k) {
      var grp = coordGroupes[k];
      if (grp.length >= 3) {
        var lieuxUniques = {};
        grp.forEach(function (item) {
          var nLieu = normaliser((item.pres && item.pres.lieu) || item.p.nom || '');
          lieuxUniques[nLieu] = (lieuxUniques[nLieu] || 0) + 1;
        });
        var nbLieuxDistincts = Object.keys(lieuxUniques).length;
        if (nbLieuxDistincts >= 2) {
          grp.forEach(function (item) {
            centroides.push({ p: item.p, pres: item.pres, motif: 'Centroïde suspect : ' + nbLieuxDistincts + ' établissements distincts au même point (' + item.lat.toFixed(4) + ', ' + item.lon.toFixed(4) + ')' });
          });
        }
      }
    });

    var scoreSante = Math.round((conformes / total) * 100);

    var h = (integre ? '' : '<div class="tete-vue"><h2 class="titre-vue">Audit Qualité BDD & GPS</h2></div>');

    var coulScore = scoreSante >= 85 ? 'var(--vert,#1e7e34)' : (scoreSante >= 65 ? 'var(--ambre,#d97706)' : 'var(--rouge,#dc2626)');
    h += '<div class="bloc" style="margin-bottom:12px;padding:14px;background:var(--papier,#fff);border:1px solid var(--trait,#e2e8f0);border-radius:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<b>Santé globale de la base</b>' +
        '<b style="font-size:1.3rem;color:' + coulScore + '">' + scoreSante + ' %</b>' +
      '</div>' +
      '<div style="width:100%;height:10px;background:var(--trait,#e2e8f0);border-radius:5px;overflow:hidden">' +
        '<div style="width:' + scoreSante + '%;height:100%;background:' + coulScore + ';transition:width .3s"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.8rem;color:var(--gris,#64748b)">' +
        '<span>' + conformes + ' conformes sur ' + total + '</span>' +
        '<span>' + (total - conformes) + ' point(s) à optimiser</span>' +
      '</div>' +
    '</div>';

    h += '<div class="kpis" style="margin-bottom:14px">' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="sansGps" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'sansGps' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (sansGps.length ? 'var(--rouge,#dc2626)' : 'inherit') + '">' + sansGps.length + '</b>' +
        '<span>Sans GPS</span><small>Coordonnées vides ou 0</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="centroide" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'centroide' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (centroides.length ? 'var(--ambre,#d97706)' : 'inherit') + '">' + centroides.length + '</b>' +
        '<span>Centroïdes piégés</span><small>≥ 3 POI au même point</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="ecartGeo" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'ecartGeo' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (ecartGeo.length ? 'var(--ambre,#d97706)' : 'inherit') + '">' + ecartGeo.length + '</b>' +
        '<span>Écarts Quartier</span><small>> 8 km ou quartier NL</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="horsCi" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'horsCi' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (horsCi.length ? 'var(--rouge,#dc2626)' : 'inherit') + '">' + horsCi.length + '</b>' +
        '<span>Hors Côte d\'Ivoire</span><small>Hors limites nationales</small></button>' +
    '</div>';

    var listeAffichable = [];
    if (filtreAnomalie === 'sansGps') listeAffichable = sansGps;
    else if (filtreAnomalie === 'centroide') listeAffichable = centroides;
    else if (filtreAnomalie === 'ecartGeo') listeAffichable = ecartGeo;
    else if (filtreAnomalie === 'horsCi') listeAffichable = horsCi;
    else if (filtreAnomalie === 'sansPresence') listeAffichable = sansPresence;
    else {
      listeAffichable = sansGps.concat(centroides).concat(ecartGeo).concat(horsCi).concat(sansPresence);
    }

    var titreFiltre = {
      tous: 'Toutes les anomalies détectées (' + listeAffichable.length + ')',
      sansGps: 'Établissements sans GPS (' + sansGps.length + ')',
      centroide: 'Pièges de centroïde (' + centroides.length + ')',
      ecartGeo: 'Incohérences de quartier / distance (' + ecartGeo.length + ')',
      horsCi: 'Coordonnées hors limites CI (' + horsCi.length + ')',
      sansPresence: 'Sans créneaux de visite (' + sansPresence.length + ')'
    }[filtreAnomalie] || 'Anomalies';

    h += '<div class="tete-bloc" style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 8px">' +
      '<h3 style="margin:0;font-size:1rem">' + titreFiltre + '</h3>' +
      (filtreAnomalie !== 'tous' ? '<button type="button" class="bouton-texte" data-a="auditFiltrer" data-v="tous">Tout réafficher</button>' : '') +
      '</div>';

    if (!listeAffichable.length) {
      h += '<div class="vide" style="padding:20px 10px;text-align:center"><strong>✓ Aucune anomalie dans cette catégorie</strong>Toutes les fiches de ce groupe sont conformes.</div>';
    } else {
      h += '<ul class="liste liste-audit" style="display:flex;flex-direction:column;gap:8px;padding:0;margin:0;list-style:none">';
      listeAffichable.slice(0, 30).forEach(function (item) {
        var p = item.p, pr = item.pres || {};
        var estPh = p.type === 'Pharmacie' || /^PHA-/i.test(p.code);
        var nomLieu = pr.lieu || p.nom || '';
        var quartierNom = pr.quartier || p.quartier || 'Quartier non renseigné';
        var communeNom = pr.commune || p.commune || '';
        h += '<li style="background:var(--papier,#fff);border:1px solid var(--trait,#e2e8f0);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
              nomPrat(p) +
              '<span class="etiquette ' + (estPh ? '' : 'ok') + '" style="font-size:0.75rem">' + (estPh ? 'Pharmacie' : esc(abrSpec(p.specialite) || 'Médecin')) + '</span>' +
            '</div>' +
            '<div class="discret" style="font-size:0.8rem;margin-top:2px">' + esc(nomLieu) + (quartierNom ? ' · ' + esc(quartierNom) : '') + (communeNom ? ' (' + esc(communeNom) + ')' : '') + '</div>' +
            '<div style="color:var(--rouge,#dc2626);font-size:0.75rem;margin-top:4px;font-weight:600">⚠ ' + esc(item.motif) + '</div>' +
          '</div>' +
          '<button type="button" class="bouton petit bouton-plein" data-a="modifierFiche" data-v="' + esc(p.code) + '" style="white-space:nowrap">Corriger</button>' +
        '</li>';
      });
      h += '</ul>';
      if (listeAffichable.length > 30) {
        h += '<p class="discret" style="text-align:center;margin-top:10px">Affichage des 30 premières anomalies sur ' + listeAffichable.length + ' au total.</p>';
      }
    }

    return h;
  };

  VUES.bilan = function (integre) {
    var vueH = S.ui.statsVue === 'historique';
    var tete = (integre ? '' : '<h2 class="titre-vue">Bilan</h2>') +
      segment('Affichage', 'statsVue', [['tableau', 'Indicateurs'], ['historique', 'Historique']], vueH ? 'historique' : 'tableau') + barreQuiQuand('bilan');
    if (vueH) return tete + VUES.historique(true);
    var st = S.ui.stats, r = calculerStats(), b = r.bornes;
    var h = tete;
    h += '<p class="discret" style="margin:0 0 10px">' + (b[0] === b[1] ? majuscule(dateLongue(b[0])) : 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1])) +
      (r.equipe ? ', ' + r.nbDel + ' délégué' + (r.nbDel > 1 ? 's' : '') : ', mes visites') + '.</p>';

    var couv = taux(r.faits.length, r.echus.length), pres = taux(r.effectives.length, r.visites.length), att = taux(r.effectives.length, r.objectif);
    var aVenir = r.plan.length - r.echus.length;
    h += '<div class="kpis">' +
      kpi(txt(couv), 'Taux de réalisation', r.faits.length + ' faites sur ' + r.echus.length + ' prévues' + (aVenir > 0 ? ', ' + aVenir + ' à venir' : ''), couv) +
      kpi(String(r.effectives.length), 'Visites réalisées', r.visites.length + ' compte' + (r.visites.length > 1 ? 's' : '') + ' rendu' + (r.visites.length > 1 ? 's' : '') + ', présence ' + txt(pres)) +
      kpi(txt(att), 'Objectif atteint', r.effectives.length + ' / ' + r.objectif + ' visites (' + st.objectif + ' par semaine' + (r.equipe ? ' et par délégué' : '') + ')', att) +
      kpi(txt(taux(r.nAok, r.nA)), 'Praticiens ★★★ à jour', r.nAok + ' sur ' + r.nA + ' vus depuis moins de ' + REGLAGES_MOTEUR.cadence[3] + ' j', taux(r.nAok, r.nA)) +
      '</div>';

    // Activité dans le temps
    var jours = joursEntre(b[0], b[1]);
    if (jours.length > 1) {
      var parSemaine = jours.length > 35, groupes = [], idx = {};
      jours.forEach(function (d) {
        if (!parSemaine && jourSemaineIndex(d) > 4) return;
        var k = parSemaine ? lundiDe(d) : d;
        if (idx[k] === undefined) { idx[k] = groupes.length; groupes.push({ k: k, prevu: 0, fait: 0 }); }
      });
      r.plan.forEach(function (a) { var g = groupes[idx[parSemaine ? lundiDe(a.date) : a.date]]; if (g) g.prevu++; });
      r.effectives.forEach(function (v) { var d = String(v.date).slice(0, 10), g = groupes[idx[parSemaine ? lundiDe(d) : d]]; if (g) g.fait++; });
      var obj = (+st.objectif || 0) / 5 * r.nbDel * (parSemaine ? 5 : 1);
      h += '<section class="bloc"><h3>Activité ' + (parSemaine ? 'par semaine' : 'par jour') + '</h3>' + legende(true) +
        colonnes(groupes.map(function (g) {
          var lib = parSemaine ? 'Sem. ' + dateCourte(g.k).slice(5) : JOURS_COURTS[jourSemaineIndex(g.k)].charAt(0).toUpperCase() + (+g.k.slice(8));
          return { lib: lib, prevu: g.prevu, fait: g.fait, tip: (parSemaine ? 'Semaine du ' + dateCourte(g.k) : majuscule(dateLongue(g.k))) + ' : ' + g.fait + ' réalisée' + (g.fait > 1 ? 's' : '') + ', ' + g.prevu + ' planifiée' + (g.prevu > 1 ? 's' : '') };
        }), obj) +
        tableDonnees(['Période', 'Planifiées', 'Réalisées'], groupes.map(function (g) { return [parSemaine ? 'Sem. du ' + dateCourte(g.k) : dateCourte(g.k), g.prevu, g.fait]; })) +
        '</section>';
    }

    // Activité par commune
    var parCom = {};
    r.plan.forEach(function (a) { var c = a.commune || 'Non renseignée'; (parCom[c] = parCom[c] || { prevu: 0, fait: 0 }).prevu++; });
    r.effectives.forEach(function (v) { var c = v.commune || 'Non renseignée'; (parCom[c] = parCom[c] || { prevu: 0, fait: 0 }).fait++; });
    var coms = Object.keys(parCom).map(function (k) { return { lib: k, prevu: parCom[k].prevu, fait: parCom[k].fait }; })
      .sort(function (x, y) { return (y.prevu + y.fait) - (x.prevu + x.fait) || x.lib.localeCompare(y.lib, 'fr'); });
    h += '<section class="bloc"><h3>Activité par commune</h3>';
    if (!coms.length) h += '<p class="discret">Aucune visite planifiée ni réalisée sur la période.</p>';
    else {
      h += legende(false) + barres(coms.slice(0, 12).map(function (c) {
        return { lib: c.lib, piste: c.prevu, val: c.fait, etiquette: c.fait + ' / ' + c.prevu, tip: c.lib + ' : ' + c.fait + ' réalisée' + (c.fait > 1 ? 's' : '') + ' sur ' + c.prevu + ' planifiée' + (c.prevu > 1 ? 's' : '') };
      })) + (coms.length > 12 ? '<p class="discret">' + (coms.length - 12) + ' autre(s) commune(s) dans le tableau.</p>' : '') +
      tableDonnees(['Commune', 'Planifiées', 'Réalisées'], coms.map(function (c) { return [c.lib, c.prevu, c.fait]; }));
    }
    h += '</section>';

    // Répartition par spécialité
    var parSpec = {}, base = st.vueSpec !== 'visites';
    if (base) Object.keys(ctx().prat).forEach(function (k) { var p = ctx().prat[k]; if (p.type !== 'Pharmacie') parSpec[p.specialite || 'Autre'] = (parSpec[p.specialite || 'Autre'] || 0) + 1; });
    else r.effectives.forEach(function (v) { var k = v.specialite || 'Autre'; parSpec[k] = (parSpec[k] || 0) + 1; });
    var specs = Object.keys(parSpec).map(function (k) { return { lib: k, n: parSpec[k] }; }).sort(function (x, y) { return y.n - x.n; });
    if (specs.length > 9) { var autres = specs.slice(8).reduce(function (s2, x) { return s2 + x.n; }, 0); specs = specs.slice(0, 8).concat([{ lib: 'Autres', n: autres }]); }
    var totalSpec = specs.reduce(function (s2, x) { return s2 + x.n; }, 0);
    h += '<section class="bloc"><div class="couv-tete"><h3>Par spécialité</h3><div class="segment petit" role="group" aria-label="Données">' +
      '<button type="button" data-a="statsSpec" data-v="base" aria-pressed="' + base + '">Base</button>' +
      '<button type="button" data-a="statsSpec" data-v="visites" aria-pressed="' + !base + '">Visites</button></div></div>' +
      '<p class="discret" style="margin:4px 0 8px">' + (base ? 'Médecins actifs de la base, par spécialité.' : 'Visites réalisées sur la période, par spécialité.') + '</p>';
    h += totalSpec ? barres(specs.map(function (x) {
      return { lib: x.lib, val: x.n, etiquette: x.n + ' (' + Math.round(100 * x.n / totalSpec) + ' %)', tip: x.lib + ' : ' + x.n + ' (' + Math.round(100 * x.n / totalSpec) + ' %)' };
    })) + tableDonnees(['Spécialité', base ? 'Médecins' : 'Visites', 'Part'], specs.map(function (x) { return [x.lib, x.n, Math.round(100 * x.n / totalSpec) + ' %']; }))
      : '<p class="discret">Aucune visite réalisée sur la période.</p>';
    h += '</section>';

    // Par type de visite
    var parAct = {};
    r.effectives.forEach(function (v) { listeActivites(v.activite).forEach(function (x) { parAct[x] = (parAct[x] || 0) + 1; }); });
    var acts = Object.keys(parAct).map(function (k) { return { lib: k, n: parAct[k] }; }).sort(function (x, y) { return y.n - x.n; });
    if (acts.length) {
      h += '<section class="bloc"><h3>Par type de visite</h3>' + barres(acts.map(function (x) { return { lib: x.lib, val: x.n, etiquette: String(x.n), tip: x.lib + ' : ' + x.n }; })) +
        tableDonnees(['Type de visite', 'Visites'], acts.map(function (x) { return [x.lib, x.n]; })) + '</section>';
    }

    // Par délégué (équipe)
    if (r.equipe && r.delegues.length) {
      h += '<section class="bloc"><h3>Par délégué</h3>' + tableDonnees(['Délégué', 'Planifiées', 'Réalisées', 'Réalisation'], r.delegues.map(function (d) {
        var ech = r.echus.filter(function (a) { return a.delegue === d; }), ok = r.faits.filter(function (a) { return a.delegue === d; }).length;
        return [d, r.plan.filter(function (a) { return a.delegue === d; }).length, r.effectives.filter(function (v) { return v.delegue === d; }).length, txt(taux(ok, ech.length))];
      }), true) + '</section>';
    }
    h += '<section class="bloc"><h3>Objectif</h3><label class="champ" style="margin:0"><span>Visites par semaine' + (r.equipe ? ' et par délégué' : '') + '</span>' +
      '<input type="number" min="1" max="200" inputmode="numeric" data-f="stats" data-k="objectif" value="' + esc(st.objectif) + '"></label></section>';
    return h;
  };

  function kpi(valeur, titre, detail, jauge) {
    return '<div class="kpi"><b>' + esc(valeur) + '</b><span>' + esc(titre) + '</span><small>' + esc(detail) + '</small>' +
      (jauge !== undefined && jauge !== null ? '<div class="jauge' + (jauge >= 100 ? ' depasse' : '') + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        Math.min(jauge, 100) + '" aria-label="' + esc(titre) + '"><i style="width:' + Math.min(jauge, 100) + '%"></i></div>' : '') + '</div>';
  }
  function legende(avecObjectif) {
    return '<div class="graph-legende"><span><i class="l-serie"></i>Réalisées</span><span><i class="l-piste"></i>Planifiées</span>' +
      (avecObjectif ? '<span><i class="l-objectif"></i>Objectif</span>' : '') + '</div>';
  }
  function tableDonnees(entetes, lignes, ouvert) {
    return '<details class="voir-table"' + (ouvert ? ' open' : '') + '><summary>' + (ouvert ? 'Détail' : 'Voir les données') + '</summary><table class="table-donnees"><thead><tr>' +
      entetes.map(function (e, i) { return '<th' + (i ? ' class="n"' : '') + '>' + esc(e) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      lignes.map(function (l) { return '<tr>' + l.map(function (v, i) { return '<td' + (i ? ' class="n"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></details>';
  }
  // Barre à extrémité arrondie (4 px) côté donnée, base plate
  function barreV(x, y, w, h) {
    if (h <= 0) return '';
    var r = Math.min(4, w / 2, h);
    return 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function barreH(x, y, w, h) {
    if (w <= 0) return '';
    var r = Math.min(4, h / 2, w);
    return 'M' + x + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + x + 'Z';
  }
  function graduation(max) {
    if (max <= 5) return Math.max(1, Math.ceil(max));
    var p = Math.pow(10, Math.floor(Math.log10(max))), n = max / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  // Colonnes : planifiées (piste) et réalisées (série), ligne d'objectif en pointillé
  function colonnes(donnees, objectif) {
    var W = 340, H = 180, g = 28, bas = 22, haut = 10, n = donnees.length;
    var max = graduation(Math.max(1, objectif || 0, Math.max.apply(null, donnees.map(function (d) { return Math.max(d.prevu, d.fait); }))));
    var bande = (W - g) / n, lw = Math.max(4, Math.min(26, bande * 0.62));
    var y = function (v) { return haut + (H - haut - bas) * (1 - v / max); };
    var s = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visites planifiées et réalisées">';
    [0, max / 2, max].forEach(function (v) {
      s += '<line class="grille" x1="' + g + '" x2="' + W + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text x="' + (g - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>';
    });
    var pas = Math.ceil(n / 12);
    donnees.forEach(function (d, i) {
      var x = g + i * bande + (bande - lw) / 2, base = y(0);
      var hp = base - y(Math.max(d.prevu, d.fait)), hf = base - y(d.fait);
      s += '<g data-tip="' + esc(d.tip) + '"><rect x="' + (g + i * bande).toFixed(1) + '" y="' + haut + '" width="' + bande.toFixed(1) + '" height="' + (H - haut - bas) + '" fill="transparent"/>' +
        '<path class="piste" d="' + barreV(+x.toFixed(1), +(base - hp).toFixed(1), +lw.toFixed(1), +hp.toFixed(1)) + '"/>' +
        '<path class="serie" d="' + barreV(+x.toFixed(1), +(base - hf).toFixed(1), +lw.toFixed(1), +hf.toFixed(1)) + '"/></g>';
      if (i % pas === 0) s += '<text x="' + (x + lw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(d.lib) + '</text>';
    });
    if (objectif) s += '<line class="objectif" x1="' + g + '" x2="' + W + '" y1="' + y(objectif).toFixed(1) + '" y2="' + y(objectif).toFixed(1) + '"/>';
    return s + '</svg>';
  }
  // Barres horizontales : libellé à gauche, valeur en bout de barre ; piste facultative (planifiées)
  function barres(donnees) {
    var W = 340, lh = 26, gl = 104, dr = 58, H = donnees.length * lh + 4;
    var max = Math.max(1, Math.max.apply(null, donnees.map(function (d) { return Math.max(d.val, d.piste || 0); })));
    var larg = W - gl - dr, s = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Graphique en barres">';
    donnees.forEach(function (d, i) {
      var y0 = i * lh + 4, bh = 14, yb = y0 + (lh - bh) / 2 - 2;
      var wp = larg * (d.piste || 0) / max, wv = larg * d.val / max;
      var lib = d.lib.length > 16 ? d.lib.slice(0, 15) + '…' : d.lib;
      s += '<g data-tip="' + esc(d.tip) + '"><rect x="0" y="' + y0 + '" width="' + W + '" height="' + lh + '" fill="transparent"/>' +
        '<text class="lib" x="' + (gl - 8) + '" y="' + (yb + 11) + '" text-anchor="end">' + esc(lib) + '</text>' +
        (d.piste !== undefined ? '<path class="piste" d="' + barreH(gl, +yb.toFixed(1), +Math.max(wp, wv).toFixed(1), bh) + '"/>' : '') +
        '<path class="serie" d="' + barreH(gl, +yb.toFixed(1), +wv.toFixed(1), bh) + '"/>' +
        '<text class="val" x="' + (gl + Math.max(wp, wv) + 6).toFixed(1) + '" y="' + (yb + 11) + '">' + esc(d.etiquette) + '</text></g>';
    });
    return s + '</svg>';
  }

  // Infobulle des graphiques (survol à la souris, toucher sur téléphone)
  function montrerInfobulle(el, x, y) {
    var b = $('infobulle'); if (!b) return;
    b.textContent = el.getAttribute('data-tip'); b.hidden = false;
    var w = b.offsetWidth, hgt = b.offsetHeight;
    b.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
    b.style.top = Math.max(8, y - hgt - 14) + 'px';
  }
  function cacherInfobulle() { var b = $('infobulle'); if (b) b.hidden = true; }
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest('.graph [data-tip]');
    if (el) montrerInfobulle(el, e.clientX, e.clientY); else if (e.pointerType === 'mouse') cacherInfobulle();
  });
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest('.graph [data-tip]');
    if (el) montrerInfobulle(el, e.clientX, e.clientY); else cacherInfobulle();
  });
  window.addEventListener('scroll', cacherInfobulle, { passive: true });

  // ------------------------------------------------------------------ Vue : historique
  VUES.historique = function (integre) {
    var enAttente = S.queue.slice().reverse().map(function (v) { v = Object.assign({}, v); v.attente = true; return v; });
    var tout = enAttente.concat((S.data.historique || []).filter(function (v) { return !S.queue.some(function (q) { return q.uid === v.uid; }); }));
    var hist = tout.filter(function (v) { return S.config.demo || quiCorrespond(v.delegue); });
    var t = aujourdhui(), lundi = lundiDe(t), mois = t.slice(0, 7), il30 = ajouterJours(t, -30), bh = bornesStats();
    var compte = function (v) { return Moteur.estVisite(v.statut, statuts()); };
    var sem = hist.filter(function (v) { return v.date >= lundi && compte(v); }).length;
    var moisN = hist.filter(function (v) { return String(v.date).slice(0, 7) === mois && compte(v); }).length;
    var derniers = hist.filter(function (v) { return v.date >= il30; });
    var taux = derniers.length ? 100 * derniers.filter(compte).length / derniers.length : null;
    var h = (integre ? '' : '<h2 class="titre-vue">Historique</h2>') + '<div class="chiffres">' +
      '<div class="chiffre"><b>' + sem + '</b><span>visites cette semaine</span></div>' +
      '<div class="chiffre"><b>' + moisN + '</b><span>visites ce mois-ci</span></div>' +
      '<div class="chiffre"><b>' + (taux === null ? 'n.d.' : pct(taux)) + '</b><span>présence sur 30 jours</span></div></div>';
    if (S.queue.length) h += '<div class="bandeau"><p>' + S.queue.length + ' compte(s) rendu(s) en attente d\'envoi. Ils partiront dès que le réseau revient.</p></div>';
    var liste = hist.filter(function (v) { var d = String(v.date || '').slice(0, 10); return v.attente || (d >= bh[0] && d <= bh[1]); });
    h += '<p class="discret" style="margin:12px 0 8px">' + liste.length + ' visite' + (liste.length > 1 ? 's' : '') + ' · ' + esc(libelleQui()) + ' · ' + esc(libelleBornes(bh)) + '</p>';
    if (!liste.length) return h + '<div class="vide"><strong>Aucune visite sur cette période</strong>Changez de période ou de délégués.</div>';
    return h + '<ul class="liste">' + liste.slice(0, 150).map(function (v) {
      return '<li class="element' + classeType(v) + '"><div class="element-tete"><div>' +
        '<span class="element-titre">' + pastilleType(v) + lienFiche(v.code, esc(v.nom)) + '</span>' +
        '<span class="discret bloc-texte">' + esc(v.lieu) + ', ' + esc(v.quartier) + '</span>' +
        (v.activite ? '<span class="bloc-texte discret" style="margin-top:4px">' + esc(v.activite) + '</span>' : '') +
        (v.produits ? '<span class="bloc-texte discret" style="margin-top:4px">Produits : ' + esc(v.produits) + '</span>' : '') +
        (v.commentaire ? '<span class="bloc-texte" style="margin-top:4px">' + esc(v.commentaire) + '</span>' : '') +
        (v.prochaine ? '<span class="bloc-texte discret">Prochain RDV le ' + dateCourte(String(v.prochaine).slice(0, 10)) + '</span>' : '') +
        '<span class="etiquettes"><span class="etiquette ' + (compte(v) ? 'ok' : 'ko') + '">' + esc(v.statut) + '</span>' +
        (v.attente ? '<span class="etiquette p1">En attente d\'envoi</span>' : '') +
        (v.delegue && !estMoi(v.delegue) ? '<span class="etiquette equipe">' + esc(v.delegue) + '</span>' : '') + '</span></div>' +
        '<div class="element-mesure">' + (v.date ? dateCourte(v.date) : '') + '<small>' + esc(v.creneau) + '</small></div></div></li>';
    }).join('') + '</ul>';
  };

  // ------------------------------------------------------------------ Vue : réglages
