  VUES.jour = function () {
    var d = jourAffiche(), t = aujourdhui(), h = enteteJour(d);
    if (S.ui.jourVue) {
      h += d === t ? rendreRappels() : '';
      if (!futurVerrouille(d)) { var lh = arretsHorsJour(d); if (lh.length && (rapportDe(d) || !passeVerrouille(d))) h += tuileRapport(d, lh); }
      h += rendreJourHors(d);
      return h;
    }
    if (!S.plan.length) {
      return h + rendreRappels() + '<div class="vide"><strong>Aucune visite prévue</strong>Préparez d\'abord votre tournée dans « Planifier ».</div>' +
        (boutonPlanifierJour(d) || '<button class="bouton bouton-plein bouton-large" type="button" data-a="nav" data-tab="semaine" style="margin-top:12px">' + icone('calendrier') + 'Planifier ma tournée</button>');
    }
    var duJour = S.plan.filter(function (a) { return a.date === d; });
    var renseignees = duJour.filter(function (a) { return a.statut; }).length;
    var com = Array.from(new Set(duJour.map(function (a) { return a.commune; }).filter(Boolean)));
    var est = estimationJour(duJour), liens = lienItineraire(duJour);
    var infos = [est ? minutesVersHeure(est.debut) + ' → ' + minutesVersHeure(est.fin) : '', com.length ? esc(libelleCommunes(com)) : ''].filter(Boolean).join(' · ');
    h += '<section class="synthese-jour"><div class="sj-ligne"><span>' + compteursJour(d, duJour) + (infos ? '<small class="discret bloc-texte">' + infos + '</small>' : '') + '</span>' +
        (liens.length ? '<a class="bouton petit" href="' + esc(liens[0]) + '" target="_blank" rel="noopener">' + icone('route') + 'Itinéraire</a>' : '') + '</div>' +
      barreRealise(duJour.filter(function (a) { return a.statut && !estKo(a.statut); }).length, duJour.length, duJour.filter(function (a) { return a.statut; }).length) +
      '</section>';
    if (!futurVerrouille(d) && (rapportDe(d) || !passeVerrouille(d))) h += tuileRapport(d, duJour);
    if (d === t) h += rendreRappels() + rendreMaintenant(duJour, liens);
    // 3.24.23 : les visites renseignées passent en bas (« Effectuées », dans l'ordre des heures) ;
    // en haut restent les visites à faire, les plus proches d'abord
    var hv = function (x) { return heureVersMinutes((x.statut && x.valideA) || x.heure) || 0; };
    var parHeure = function (x, y) { return hv(x) - hv(y); };
    var aFaire = duJour.filter(function (a) { return !a.statut; }), faites = duJour.filter(function (a) { return a.statut; }).sort(parHeure);
    // 3.25.15 : aujourd'hui, avec ma position : les visites pas encore vues du plus proche au plus loin
    var gp = d === t && S.ui.posGps && Date.now() - S.ui.posGps.t < 15 * 60000 ? S.ui.posGps : null, parProximite = false;
    if (gp) {
      var dm = {}; aFaire.forEach(function (a) { var c = coordPrecise(a) || coordArret(a); dm[a.uid] = c ? distanceVol(gp, c) : 99; });
      aFaire.sort(function (x, y) { return dm[x.uid] - dm[y.uid]; }); parProximite = true;
    }
    ['Matin', 'Soir'].forEach(function (cren) {
      var liste = aFaire.filter(function (a) { return a.creneau === cren; });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (a, i) {
        if (i > 0 && a.dist > 0 && !parProximite) {
          h += '<li class="troncon"><div></div><div class="arret-rail"></div>' +
            trajetMini(a.dist, a.trajet !== undefined ? a.trajet : Math.round(a.dist * REGLAGES_MOTEUR.minutesParKm)) + '</li>';
        }
        h += rendreArret(a);
      });
      h += '</ol>';
    });
    // fin de journée (tout est renseigné) : le parcours réel, dans l'ordre des heures de validation
    if (faites.length) h += '<div class="creneau-titre">' + (aFaire.length ? 'Effectuées · ' + faites.length : 'Parcours de la journée · ' + faites.length + ' visite' + (faites.length > 1 ? 's' : '')) + '</div><ol class="ligne faites">' + faites.map(rendreArret).join('') + '</ol>';
    h += blocRemplacant(d);
    return h;
  };
  // accès au compte rendu (page à part, dans le même onglet)
  function tuileRapport(d, liste) {
    var R = rapportDe(d), n = liste.length, r = liste.filter(function (a) { return a.statut; }).length;
    var etat = R && R.valideLe ? '<span class="etiquette ok">Validé</span>' : (R && Object.keys(R.ok || {}).length ? '<span class="etiquette p1">En cours</span>' : '<span class="etiquette">À faire</span>');
    return '<button type="button" class="acces-rapport" data-a="ouvrirRapport"><span>' + icone('crayon') + '<b>Compte Rendu</b><small>' + r + '/' + n + ' visite' + (n > 1 ? 's' : '') + ' renseignée' + (r > 1 ? 's' : '') +
      ' · faits marquants, concurrence, besoins</small></span>' + etat + icone('chevron') + '</button>';
  }
  VUES.rapport = function () {
    var d = jourAffiche(), t = aujourdhui();
    var liste = S.ui.jourVue ? arretsHorsJour(d) : S.plan.filter(function (a) { return a.date === d; });
    return '<button type="button" class="retour" data-a="nav" data-tab="jour">' + icone('chevron') + 'Journée</button>' +
      '<h2 class="titre-vue">Compte Rendu</h2><p class="sous-titre">' + majuscule(dateLongue(d)) + ' : rempli à partir de vos visites, à compléter puis à valider.</p>' +
      (futurVerrouille(d) ? '<div class="vide"><strong>Journée à venir</strong>Le compte rendu se fait le jour même ou après (ou activez « Saisie avancée » dans Réglages › Avancé).</div>' : rendreRapportJour(d, liste, passeVerrouille(d), true));
  };

  // « Maintenant » : ce qu'il y a à faire tout de suite, selon l'heure
  function rendreMaintenant(duJour, liens) {
    var now = minutesMaintenant(), sans = duJour.filter(function (a) { return !a.statut; });
    var aSaisir = sans.filter(function (a) { return heureVersMinutes(a.heure) !== null && heureVersMinutes(a.heure) < now; });
    var suivante = sans.filter(function (a) { return heureVersMinutes(a.heure) === null || heureVersMinutes(a.heure) >= now; })[0];
    var R = rapportDe(aujourdhui()), crValide = !!(R && R.valideLe), finJournee = now >= 18 * 60 + 30;
    var corps = '';
    suivrePosition();
    var proche = visiteProche(sans, suivante);
    if (proche) {
      corps += '<div class="bandeau-proche' + classeType(proche.a) + '">' + pastilleType(proche.a, true) + '<p>Vous êtes à <b>' + metres(proche.d) + '</b> de <b>' + esc(nomSansType(proche.a.nom)) + '</b> (prévu à ' + esc(proche.a.heure) + '). Le voir maintenant ?</p>' +
        '<div class="rangee"><button class="bouton" type="button" data-a="procheNon" data-uid="' + proche.a.uid + '">Non</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="procheOui" data-uid="' + proche.a.uid + '">Maintenant</button></div></div>';
    } else {
      var ph = pharmacieProche(duJour);
      if (ph) {
        corps += '<div class="bandeau-proche t-pharma">' + pastilleType(ph.c.prat, true) + '<p><b>' + esc(nomSansType(ph.c.prat.nom)) + '</b> est à <b>' + metres(ph.d) + '</b>' +
          ', ouverte jusqu\'à ' + minutesVersHeure(ph.c.fin) + ' (' + esc(vuDepuis(ph.c.prat.derniere)) + '). Y aller ?</p>' +
          '<div class="rangee"><button class="bouton" type="button" data-a="pharmaNon" data-v="' + esc(ph.c.code) + '">Non</button>' +
          '<button class="bouton bouton-plein" type="button" data-a="pharmaOui" data-v="' + esc(ph.c.cle) + '">Y aller</button></div></div>';
      }
    }
    if (!sans.length) {
      if (!crValide) {
        var msgCloture = finJournee
          ? 'Fin de journée : toutes vos visites sont renseignées. Pensez à finaliser votre compte rendu de la journée.'
          : 'Toutes les visites prévues sont renseignées. Vous pouvez dès maintenant finaliser et envoyer votre compte rendu de la journée.';
        corps += '<p>' + msgCloture + '</p>' +
          '<div class="rangee-wa"><button class="bouton bouton-plein" type="button" data-a="ouvrirRapport">' + icone('valider') + 'Finaliser le compte rendu</button></div>';
      }
      return corps ? '<section class="maintenant"><h3>Maintenant</h3>' + corps + '</section>' : '';
    }
    if (aSaisir.length) {
      corps += '<div class="a-saisir"><b>' + icone('crayon') + aSaisir.length + ' compte' + (aSaisir.length > 1 ? 's' : '') + ' rendu' + (aSaisir.length > 1 ? 's' : '') + ' à saisir</b>' +
        aSaisir.slice(0, 3).map(function (a) { return '<button type="button" class="bouton-texte" data-a="ouvrirVisite" data-uid="' + a.uid + '">' + esc(a.heure) + ' ' + esc(a.nom) + '</button>'; }).join('') + '</div>';
    }
    if (suivante) {
      var pa = praticien(suivante.code) || {}, premiere = suivante === duJour[0] && !duJour.some(function (a) { return a.statut; });
      var cS = coordPrecise(suivante) || coordArret(suivante), pos = S.ui.posGps && Date.now() - S.ui.posGps.t < 5 * 60000 ? S.ui.posGps : null, tr = '';
      if (cS && pos) {
        var qp = Moteur.quartierLePlusProche(pos.lat, pos.lon, quartiers()), dk = distanceVol(pos, cS);
        tr = trajetMini(dk, minutesTrajet(dk, qp ? qp.quartier.commune : '', suivante.commune, now));
      } else if (suivante.dist > 0) tr = trajetMini(suivante.dist, suivante.trajet !== undefined ? suivante.trajet : Math.round(suivante.dist * REGLAGES_MOTEUR.minutesParKm));
      corps += '<div class="suivante"><small>' + (premiere ? 'Première visite' : 'Visite suivante') + '</small><b>' + esc(suivante.heure) + ' · ' + pastilleType(suivante) + esc(suivante.nom) + '</b> ' + etoiles(suivante.note) +
        (lieuQuartier(suivante) ? '<span class="discret bloc-texte">' + esc(lieuQuartier(suivante)) + '</span>' : '') + tr +
        actionsRapides({ telephone: pa.telephone, lat: suivante.lat, lon: suivante.lon, lieu: suivante.lieu, quartier: suivante.quartier, commune: suivante.commune }) +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="ouvrirVisite" data-uid="' + suivante.uid + '">' + icone('crayon') + 'Compte Rendu de cette visite</button></div>';
    }
    var notifsOn = LS.get('notifs', false) && typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (finJournee && duJour.length > 0) {
      var real = duJour.filter(function (a) { return a.statut; }).length;
      var attSync = enAttente();
      var msgSynthese = real + ' visite' + (real > 1 ? 's' : '') + ' sur ' + duJour.length + ' réalisée' + (real > 1 ? 's' : '') +
        (attSync ? ', ' + attSync + ' compte' + (attSync > 1 ? 's' : '') + ' rendu' + (attSync > 1 ? 's' : '') + ' à synchroniser' : '') +
        ' — Bravo pour votre journée !';
      corps = '<div class="cloture-journee"><div class="cj-tete">' + icone('valider') + '<b>Clôture de la journée (après 18h30)</b></div>' +
        '<p class="cj-texte">« ' + esc(msgSynthese) + ' »</p>' +
        (!crValide ? '<div class="rangee-wa"><button class="bouton bouton-plein" type="button" data-a="ouvrirRapport">' + icone('valider') + 'Finaliser le compte rendu</button></div>' : '<span class="etiquette ok">Rapport du jour validé</span>') +
        '</div>' + corps;
    } else if (finJournee && !crValide && !notifsOn) {
      corps += '<div class="rappel-cr-soir"><p>Rappel 18 h 30 : pensez à finaliser votre compte rendu de la journée.</p>' +
        '<div class="rangee-wa"><button class="bouton bouton-plein" type="button" data-a="ouvrirRapport">' + icone('valider') + 'Finaliser le compte rendu</button></div></div>';
    }
    return corps ? '<section class="maintenant"><h3>Maintenant</h3>' + corps + '</section>' : '';
  }

  // 3.23.0 : position suivie toutes les 2 minutes pendant que Journée montre aujourd'hui ;
  // une visite prévue plus tard, à moins de 500 m et dont le praticien est présent à cette heure, est proposée « maintenant »
  var RAYON_PROCHE_KM = 0.5, MARGE_PRESENCE_MIN = 10;   // 3.24.20 : 500 m, au moins 10 min de présence restantes
  function suivrePosition() {}   // 3.25.14 : remplacé par le recalcul global (localiser)
  // 3.26.54 : règle unique d'âge de la position du téléphone (10 min) pour toute l'application
  var AGE_GPS_MIN = 10;
  function gpsFrais() { var g = S.ui.posGps; return g && Date.now() - g.t < AGE_GPS_MIN * 60000 ? g : null; }
  function coordPrecise(a) {
    var c0 = lireCoord(a); if (c0) return c0;
    var cr = a.idPresence && ctx().parCode[a.code] ? ctx().parCode[a.code].filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0] : null;
    return cr && cr.coord ? cr.coord : null;
  }
  // pharmacie ouverte à moins de 500 m, hors de ma journée, non prévue par un collègue cette semaine, pas vue récemment
  var RAYON_PHARMACIE_KM = 0.5;
  function pharmacieProche(duJour) {
    var pos = gpsFrais(), t = aujourdhui(); if (!pos || jourSemaineIndex(t) > 4) return null;
    var now = minutesMaintenant(), refus = LS.get('refusPharmacies', {}), dans = ensemble(duJour.map(function (a) { return a.code; })), ex = exclusCollegues([t]), best = null;
    if (refus.d !== t) refus = { codes: {} };
    (ctx().parJour[jourSemaineIndex(t)] || []).forEach(function (c) {
      var p = c.prat;
      if (!p || p.type !== 'Pharmacie' || !c.coord || dans[c.code] || ex[c.code] || refus.codes[c.code] || absentLe(p, t)) return;
      if (now < c.debut || now > c.fin - 10) return;
      if (p.derniere && joursEcoules(p.derniere, t) < (+S.params.delai || 7)) return;
      var d = distanceVol(pos, c.coord);
      if (d <= RAYON_PHARMACIE_KM && (!best || d < best.d)) best = { c: c, d: d };
    });
    return best;
  }
  function visiteProche(sans, suivante) {
    var pos = gpsFrais(); if (!pos) return null;
    var now = minutesMaintenant(), refus = LS.get('refusProches', {}), best = null;
    sans.forEach(function (a) {
      if (a === suivante || (refus.d === aujourdhui() && refus.uids && refus.uids[a.uid])) return;
      var c = coordPrecise(a), deb = heureVersMinutes(a.debut), fin = heureVersMinutes(a.fin);
      if (!c || deb === null || fin === null || now < deb || now > fin - MARGE_PRESENCE_MIN) return;
      if (heureVersMinutes(a.heure) !== null && heureVersMinutes(a.heure) <= now + 15) return;   // déjà imminente
      var d = distanceVol(pos, c);
      if (d <= RAYON_PROCHE_KM && (!best || d < best.d)) best = { a: a, d: d };
    });
    return best;
  }
  // ------------------------------------------------------------------ Compte Rendu de la journée
  S.rapports = LS.get('rapports', {});
  function rapportDe(d) {
    var srv = ((S.data && S.data.rapports) || []).filter(function (r) { return String(r.date).slice(0, 10) === d && estMoi(r.delegue); })[0];
    // 3.27.24 : un compte rendu local vide (ouvert puis laissé) ne masque plus celui validé dans la base (autre téléphone, réinstallation)
    if (S.rapports[d]) {
      var L = S.rapports[d];
      if (!L.valideLe && srv && srv.valideLe && !L.edition) { L.valideLe = srv.valideLe; L.envoye = true; L.faits = L.faits || srv.faits || ''; L.concurrence = L.concurrence || srv.concurrence || ''; L.besoinsTexte = L.besoinsTexte || srv.besoins || ''; L.km = L.km || srv.km || ''; }
      return L;
    }
    if (srv) { S.rapports[d] = { faits: srv.faits || '', concurrence: srv.concurrence || '', besoins: [], besoinsTexte: srv.besoins || '', km: srv.km || '', valideLe: srv.valideLe || '', envoye: true, ok: { faits: 1, concurrence: 1, besoins: 1, km: 1 } }; return S.rapports[d]; }
    return null;
  }
  function rapportOuCree(d) { return rapportDe(d) || (S.rapports[d] = { faits: '', concurrence: '', besoins: [], besoinsTexte: '', km: '', ok: {} }); }
  function sauverRapports() { LS.set('rapports', S.rapports); }
  var BESOINS_JOUR = ['Supports promotionnels', 'Échantillons', 'Appui du responsable', 'Formation', 'Autre'];
  // synthèse automatique à partir des comptes rendus de visite de la journée
  function syntheseJour(duJour) {
    var s = { prevues: duJour.length, faites: [], nonFaites: [], sansCr: [], pot: { 3: 0, 2: 0, 1: 0 }, produits: {}, echantillons: [], commandes: [], ruptures: [], suites: [], km: 0, communes: [] };
    duJour.forEach(function (a) {
      if (a.commune && s.communes.indexOf(a.commune) < 0) s.communes.push(a.commune);
      if (!a.statut) { s.sansCr.push(a); return; }
      if (estKo(a.statut)) { s.nonFaites.push(a); return; }
      s.faites.push(a); s.pot[+a.note || 1] = (s.pot[+a.note || 1] || 0) + 1;
      var r = a.cr ? champsCr(a) : { produits: a.produits || '' };
      if (!estPharmacie(a)) listeProduits(r.produits || '').forEach(function (x) { s.produits[x] = (s.produits[x] || 0) + 1; });
      if (r.echantillons) s.echantillons.push(a.nom + ' : ' + r.echantillons);
      if (r.commande) s.commandes.push(a.nom + ' : ' + r.commande);
      var st = (a.cr && crDe(a).stocks) || {};
      Object.keys(st).forEach(function (x) { if (st[x] && st[x].etat === 'Rupture') s.ruptures.push(x + ' (' + a.nom + ')'); });
      if (a.prochaine && a.prochaine > a.date) s.suites.push(a.nom + ' : ' + (a.rdvConfirme ? 'RDV' : 'rappel') + ' le ' + dateFr(a.prochaine));
    });
    // 3.26.10 : la distance se calcule sur toutes les visites où le délégué s'est déplacé (faites ou absent/ko)
    var visitees = duJour.filter(function (a) { return !!a.statut; });
    if (visitees.length) {
      var ordVis = visitees.slice().sort(function (x, y) { return String(heureVisite(x)).localeCompare(String(heureVisite(y))); });
      var tot = 0, prec = departCoord();
      for (var iv = 0; iv < ordVis.length; iv++) {
        var cG = coordPrecise(ordVis[iv]);
        if (cG && prec && typeof distanceVol === 'function') {
          tot += distanceVol(prec, cG);
          prec = cG;
        } else {
          tot += (ordVis[iv].dist || 0);
        }
      }
      s.km = tot > 0 ? (Math.round(tot * 10) / 10) : ordVis.reduce(function (totK, a) { return totK + (a.dist || 0); }, 0);
    } else {
      s.km = duJour.reduce(function (totK, a) { return totK + (a.dist || 0); }, 0);
    }
    s.est = estimationJour(duJour);
    return s;
  }
  function lignesSynthese(s) {
    var prod = Object.keys(s.produits).sort(function (a, b) { return s.produits[b] - s.produits[a]; }).map(function (x) { return x + (s.produits[x] > 1 ? ' (' + s.produits[x] + ')' : ''); });
    var l = [['Visites', s.faites.length + ' faite' + (s.faites.length > 1 ? 's' : '') + ' sur ' + s.prevues + (s.sansCr.length ? ' · ' + s.sansCr.length + ' sans compte rendu' : '')]];
    if (s.faites.length) l.push(['Potentiel vu', [[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return s.pot[x[0]] + ' ' + x[1]; }).join(' · ')]);
    if (s.nonFaites.length) l.push(['Non faites', s.nonFaites.map(function (a) { return a.nom + ' (' + statutLibelle(a).toLowerCase() + ')'; }).join(', ')]);
    if (prod.length) l.push(['Produits présentés', prod.join(', ')]);
    if (s.echantillons.length) l.push(['Échantillons', s.echantillons.join(' ; ')]);
    if (s.commandes.length) l.push(['Commandes', s.commandes.join(' ; ')]);
    if (s.ruptures.length) l.push(['Ruptures', s.ruptures.join(', ')]);
    if (s.suites.length) l.push(['RDV et rappels', s.suites.join(' ; ')]);
    l.push(['Trajet', km(s.km) + (s.est ? ' (' + minutesVersHeure(s.est.debut) + '–' + minutesVersHeure(s.est.fin) + ')' : '') + (s.communes.length ? ' · ' + s.communes.join(', ') : '')]);
    return l;
  }
  function etapesRapport(R, s) {
    var resumeTxt = function (v, vide) { return String(v || '').trim() || vide; };
    return [
      { id: 'faits', titre: 'Faits marquants', resume: function () { return resumeTxt(R.faits, 'Rien à signaler'); },
        rendu: function () { return '<textarea data-f="rapport" data-k="faits" placeholder="Ex. le Dr X demande une étude sur Rozukaa ; nouvelle pharmacie ouverte à Angré">' + esc(R.faits || '') + '</textarea>'; } },
      { id: 'concurrence', titre: 'Concurrence observée', resume: function () { return resumeTxt(R.concurrence, 'Rien observé'); },
        rendu: function () { return '<textarea data-f="rapport" data-k="concurrence" placeholder="Produit, prix, action du concurrent…">' + esc(R.concurrence || '') + '</textarea>'; } },
      { id: 'besoins', titre: 'Besoins', resume: function () { var b = (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []); return b.length ? b.join(', ') : 'Aucun'; },
        rendu: function () {
          var tousB = (R.besoins || []).length === BESOINS_JOUR.length;
          return '<div class="grille-besoins-cr"><button type="button" class="puce puce-tous" data-a="rapBesoin" data-v="__tous" aria-pressed="' + tousB + '">Tous les besoins</button>' +
            BESOINS_JOUR.map(function (x) { return '<button type="button" class="puce" data-a="rapBesoin" data-v="' + esc(x) + '" aria-pressed="' + ((R.besoins || []).indexOf(x) >= 0) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
            '<textarea data-f="rapport" data-k="besoinsTexte" placeholder="Précisez si besoin" style="margin-top:8px;min-height:55px">' + esc(R.besoinsTexte || '') + '</textarea>';
        } }
    ];
  }
  function rendreRapportJour(d, duJour, lecture, page) {
    var R = lecture ? rapportDe(d) : rapportOuCree(d), s = syntheseJour(duJour.length ? duJour : []);
    var etat = R && R.valideLe ? '<span class="etiquette ok">Validé le ' + esc(R.valideLe) + '</span>' : (R && Object.keys(R.ok || {}).length ? '<span class="etiquette p1">En cours</span>' : '<span class="etiquette">À faire</span>');
    var h = '<section class="bloc rapport-jour" id="rapportJour"><div class="tete-bloc"><h3>' + (page ? 'Synthèse de la journée' : 'Compte Rendu') + '</h3>' + etat + '</div>';
    if (duJour.length) h += '<div class="tuiles-resume">' + lignesSynthese(s).map(function (x) {
      return '<div class="tuile statique' + (String(x[1]).length > 38 ? ' large' : '') + '"><small>' + esc(x[0]) + '</small><b>' + parLigne(x[1]) + '</b></div>';
    }).join('') + '</div>';
    // 3.24.16 : dans la page Compte Rendu, un bouton pour envoyer le CR de la journée au superviseur (numéro des Réglages)
    var waSup = page ? '<div class="rangee-wa"><button class="bouton wa" type="button" data-a="rapWhatsapp" data-v="' + d + '">' + icone('whatsapp') + (S.config.waResp ? 'Envoyer au superviseur' : 'Envoyer par WhatsApp') + '</button></div>' +
      (S.config.waResp ? '' : '<p class="discret" style="text-align:center;margin-top:-6px">Numéro du superviseur : Réglages (roue crantée).</p>') : '';
    if (!R) return h + '<p class="discret">Pas de compte rendu de journée enregistré.</p>' + waSup + '</section>';
    var etapes = etapesRapport(R, s), ok = R.ok || (R.ok = {}), edition = !lecture && (!R.valideLe || R.edition);
    var enCours = edition ? etapes.filter(function (e) { return !ok[e.id]; })[0] : null;
    h += '<div class="cr-pas etapes-filtres" style="margin-top:12px">';
    etapes.forEach(function (e, i) {
      if (!enCours || ok[e.id]) {
        h += edition ? '<button type="button" class="cr-fait" data-a="rapEditer" data-v="' + e.id + '"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b>' + icone('crayon') + '</button>'
          : '<div class="cr-fait"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b></div>';
        return;
      }
      if (e !== enCours) return;
      h += '<div class="cr-question"><span class="etape-titre">' + e.titre + ' <small>étape ' + (i + 1) + '/' + etapes.length + ', facultatif</small></span>' + e.rendu() +
        boutonsEtape(i > 0 ? 'rapPrec' : '', i > 0 ? etapes[i - 1].id : '', 'rapPasser', 'rapOk', e.id, i === etapes.length - 1) + '</div>';
    });
    h += '</div>';
    if (lecture) return h + waSup + '</section>';
    if (edition && !enCours) {
      if (s.sansCr.length) h += '<div class="bandeau"><p><b>' + s.sansCr.length + ' visite' + (s.sansCr.length > 1 ? 's' : '') + ' sans compte rendu :</b> ' +
        s.sansCr.map(function (a) { return '<button type="button" class="bouton-texte" data-a="ouvrirVisite" data-uid="' + a.uid + '">' + esc(a.nom) + '</button>'; }).join(', ') +
        '. Complétez-les, ou validez la journée telle quelle.</p></div>';
      h += '<button class="bouton bouton-plein bouton-large" type="button" data-a="rapValider" data-v="' + d + '">' + icone('valider') + 'Valider le compte rendu</button>';
    } else if (!edition) {
      h += '<div class="rangee-actions rangee-actions-cr-valide" style="margin-top:10px">' +
        '<button class="bouton bouton-plein" type="button" data-a="sortirRapport">' + icone('fermer') + '<span>Sortir</span></button>' +
        (page ? '' : '<button class="bouton petit wa" type="button" data-a="rapWhatsapp" data-v="' + d + '">' + icone('whatsapp') + 'Envoyer</button>') +
        '<button class="bouton petit" type="button" data-a="rapCopier" data-v="' + d + '">Copier</button>' +
        '<button class="bouton petit" type="button" data-a="rapModifier" data-v="' + d + '">' + icone('crayon') + 'Modifier</button></div>';
    }
    return h + (page ? '<div style="margin-top:12px">' + waSup + '</div>' : '') + '</section>';
  }
  function visitesDuJourRapport(d) { var l = S.plan.filter(function (a) { return a.date === d; }); return l.length ? l : arretsHorsJour(d); }
  // 3.25.4 : mise en forme WhatsApp (*gras*, _italique_, puces •, une ligne vide entre les sections)
  function sectionWa(titre, items, vide) {
    var l = (items || []).filter(function (x) { return String(x || '').trim(); });
    if (!l.length && vide === undefined) return [];
    return ['', '*' + titre.toUpperCase() + '*' + (l.length > 1 ? ' (' + l.length + ')' : '')].concat(l.length ? l.map(function (x) {
      return (x.indexOf('• ') === 0 ? x : '• ' + x);
    }) : ['_' + vide + '_']);
  }
  function heureVisite(a) { return (a.statut && a.valideA) || a.heure || ''; }
  // 3.26.70 : message WhatsApp aéré et lisible : pas d'heures ni de pastilles de position
  function texteRapport(d) {
    var R = rapportDe(d) || {}, duJour = visitesDuJourRapport(d), s = syntheseJour(duJour);
    var dateCourteCr = majuscule(JOURS_COURTS[jourSemaineIndex(d)]) + ' ' + d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
    var pot = [[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return s.pot[x[0]] + ' ' + x[1]; }).join(', ');
    var faites = s.faites.slice().sort(function (a, b) { return String(heureVisite(a)).localeCompare(String(heureVisite(b))); });
    var l = ['*CR du ' + dateCourteCr + '*', moi() || 'Délégué', '',
      '*Bilan*',
      'Visites faites : *' + s.faites.length + ' / ' + s.prevues + '*' + (s.sansCr.length ? ' (' + s.sansCr.length + ' sans CR)' : '')];
    if (pot) l.push('Potentiel vu : ' + pot);
    var kmJ = R.km ? R.km + ' km' : (s.km ? km(s.km) + ' estimés' : '');
    if (kmJ) l.push('Trajet : ' + kmJ);
    if (s.communes.length) l.push('Communes : ' + s.communes.join(', '));
    // 3.28.43 : compte rendu plus court : une ligne par visite, sans les produits présentés (tous sont présentés) ;
    // pharmacie : le quartier plutôt que le nom de l'officine, déjà dans le nom
    var lignesFaites = faites.map(function (a) {
      var det = estPharmacie(a) ? infosSansDoublon(a, [a.lieu, a.quartier]) : infosSansDoublon(a, [abrSpec(a.specialite), abregerHopital(a.lieu || '')]);
      return '*' + a.nom + '*' + (det ? '\n   ' + det : '') + (a.produits ? '\n   Produits : ' + a.produits : '');
    });
    l = l.concat(sectionWa('Visites faites', lignesFaites));
    l = l.concat(sectionWa('Visites non faites', s.nonFaites.map(function (a) { return a.nom + ' : ' + String(statutLibelle(a) || '').toLowerCase(); })));
    l = l.concat(sectionWa('Échantillons remis', s.echantillons));
    l = l.concat(sectionWa('Commandes', s.commandes));
    l = l.concat(sectionWa('Ruptures signalées', s.ruptures));
    l = l.concat(sectionWa('RDV et rappels', s.suites));
    var faitsL = String(R.faits || '').split(/\n+/), concL = String(R.concurrence || '').split(/\n+/), besL = (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []);
    l = l.concat(sectionWa('Faits marquants', faitsL)).concat(sectionWa('Concurrence', concL)).concat(sectionWa('Besoins', besL));
    var vides = [[faitsL, 'faits marquants'], [concL, 'concurrence'], [besL, 'besoins']].filter(function (x) { return !x[0].some(function (y) { return String(y || '').trim(); }); }).map(function (x) { return x[1]; });
    if (vides.length) l.push('', '_' + majuscule(vides.join(', ')) + ' : rien à signaler_');
    return l.join('\n');
  }
  function empreinteRapport(R) { return JSON.stringify([R.faits || '', R.concurrence || '', R.besoins || [], R.besoinsTexte || '', R.km || '']); }
  function envoyerRapport(d) {
    var R = rapportDe(d); if (!R || !R.valideLe || !connecte() || !moi()) return Promise.resolve();
    var s = syntheseJour(visitesDuJourRapport(d));
    var payload = { delegue: moi(), date: d, valideLe: R.valideLe, prevues: s.prevues, faites: s.faites.length,
      nonFaites: s.nonFaites.map(function (a) { return a.nom + ' (' + statutLibelle(a) + ')'; }).join(', '), sansCr: s.sansCr.length,
      synthese: lignesSynthese(s).map(function (x) { return x[0] + ' : ' + x[1]; }).join('\n'), faits: R.faits || '', concurrence: R.concurrence || '',
      besoins: (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []).join(', '), km: R.km || (Math.round(s.km * 10) / 10) };
    if (MIROIR_CLIENT && typeof supabaseMiroirRapport === 'function') { supabaseMiroirRapport(payload).catch(function (eSb) { console.warn('Miroir Supabase rapport:', eSb); }); }
    return apiPost('rapport', { rapport: payload }).then(function () { R.envoye = true; sauverRapports(); });
  }
  function envoyerRapportsEnAttente() {
    var l = Object.keys(S.rapports).filter(function (d) { return S.rapports[d].valideLe && !S.rapports[d].envoye; });
    return l.reduce(function (p, d) { return p.then(function () { return envoyerRapport(d).catch(function () {}); }); }, Promise.resolve());
  }

  // Planifier : réglages, proposition, ajustements, confirmation et partage, communes visitées
  // 3.20.0 : Planifier = l'agenda (frise chronologique de tous les jours planifiés, brouillon ou confirmés).
  // Le parcours de planification s'ouvre sur une page à part, dans le même onglet ; dès les résultats, il disparaît.
  // N'apparaît que ce qui sert sur le moment : « Confirmer » s'il y a des brouillons, « Accepter / Recalculer encore »
  // juste après un recalcul, « Envoyer par WhatsApp » une fois le jour confirmé.
  function barreCriteresPlanifier() {
    var p = S.params, dates = datesAffichees();
    var per;
    if (p.mode === 'jour') {
      per = datePlanLibelle(p.dateRef);
    } else {
      per = 'Sem. ' + datePlanLibelle(dates[0] || p.dateRef);
    }
    var com = p.mode === 'semaine' && p.parJour ? 'Par jour' : libelleCommunes(p.communes);
    var spec = p.typeCibles === 'pharmacies' ? 'Pharmacies' : (p.specialites && p.specialites.length ? (p.specialites.length === coeurDeCible().length && coeurDeCible().every(function (s) { return p.specialites.indexOf(s) >= 0; }) ? 'Cœur (' + p.specialites.length + ')' : p.specialites.length + ' spéc.') : 'Toutes spéc.');
    var rdvN = rdvProchaines(dates).length + S.imposes.length;
    return '<div class="barre-criteres-plan" role="group" aria-label="Critères de la tournée">' +
      '<div class="rangee-criteres rangee-criteres-1">' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="quand">' + icone('calendrier') + '<span>' + esc(per) + '</span></button>' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="ou">' + icone('carte') + '<span>' + esc(com) + '</span></button>' +
      '</div>' +
      '<div class="rangee-criteres rangee-criteres-2">' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="spec">' + icone('filtre') + '<span>' + esc(spec) + '</span></button>' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="rythme"><span>' + p.maxJour + '/j · ' + p.delai + 'j</span></button>' +
        '<button type="button" class="puce petite" data-a="ouvrirRecherche">' + icone('plus') + '<span>' + (rdvN ? rdvN + ' RDV/Prio' : 'RDV / Prio') + '</span></button>' +
      '</div>' +
    '</div>';
  }
