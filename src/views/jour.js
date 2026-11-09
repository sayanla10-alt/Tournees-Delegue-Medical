  VUES.jour = function () {
    var d = jourAffiche(), t = aujourdhui(), h = enteteJour(d);
    if (S.ui.jourVue) {
      h += d === t ? rendreRappels() : '';
      if (!futurVerrouille(d)) { var lh = arretsHorsJour(d); if (lh.length && (rapportDe(d) || !passeVerrouille(d) || d < t)) h += tuileRapport(d, lh); }
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
    if (!futurVerrouille(d) && duJour.length && (rapportDe(d) || !passeVerrouille(d) || d < t)) h += tuileRapport(d, duJour);
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
    // 3.28.47 : compte rendu validé, ou jour passé : l'encart devient « Bilan du Jour » (même place, même geste)
    if ((R && R.valideLe && !R.edition) || d < aujourdhui()) {
      var fa = liste.filter(function (a) { return a.statut && !estKo(a.statut); }).length;
      return '<button type="button" class="acces-rapport acces-bilan" data-a="ouvrirBilan"><span>' + icone('valider') + '<b>Bilan du Jour</b><small>' + fa + '/' + n + ' visite' + (n > 1 ? 's' : '') + ' faite' + (fa > 1 ? 's' : '') +
        ' · RDV, faits marquants, détail des visites</small></span>' +
        (R && R.valideLe ? '<span class="etiquette ok">CR validé</span>' : '<span class="etiquette p1">CR non fait</span>') + icone('chevron') + '</button>';
    }
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

  // ------------------------------------------------------------------ 3.28.47 : Bilan du Jour
  // Pour se souvenir d'une journée : ce qu'il ne faut pas oublier et le terrain d'abord (ouverts), puis la journée en chiffres,
  // le détail de chaque visite et le message envoyé au superviseur (repliés). Lecture seule ; « Modifier CR » rouvre le compte rendu.
  function histoVisite(d, code) {
    return ((S.data && S.data.historique) || []).filter(function (v) { return String(v.date).slice(0, 10) === d && v.code === code && (!v.delegue || estMoi(v.delegue)); })[0] || null;
  }
  // détail d'une visite : compte rendu du téléphone s'il existe, sinon celui enregistré dans la BDD
  function detailBilan(a) {
    var r = a.cr ? champsCr(a) : (histoVisite(a.date, a.code) || {}), ph = estPharmacie(a), ko = estKo(a.statut), l = [];
    var c = a.cr ? crDe(a) : {};
    if (!a.statut) return [['Compte rendu', 'non saisi']];
    if (ko) {
      l.push(['Motif', statutLibelle(a)]);
      if (c.precision || (!a.cr && r.commentaire)) l.push(['Précision', c.precision || r.commentaire]);
    } else {
      if (ph && r.interlocuteur) l.push(['Interlocuteur', r.interlocuteur]);
      if (r.activite || a.activite) l.push([ph ? 'Activités' : 'Type', listeActivites(r.activite || a.activite).join(', ')]);
      if (r.stocks) l.push(['Stocks', r.stocks]);
      if (r.commande) l.push(['Commande', r.commande]);
      if (r.echantillons) l.push(['Échantillons', r.echantillons]);
      if (r.complements) l.push(['Compléments', r.complements]);
      if (r.commentaire || a.commentaire) l.push([ph ? 'Observation' : 'Bilan', r.commentaire || a.commentaire]);
    }
    if (a.prochaine && a.prochaine > a.date) l.push(['Suite', (a.rdvConfirme ? 'RDV confirmé ' : 'Rappel ') + dateCourte(a.prochaine)]);
    return l;
  }
  // suite d'un RDV ou rappel : à venir, fait, ou pas encore fait
  function etatSuite(a) {
    var t = aujourdhui();
    if (a.prochaine >= t) return ['à venir', 'av'];
    var fait = S.plan.concat((S.data && S.data.historique) || []).some(function (v) {
      return v.code === a.code && String(v.date).slice(0, 10) >= a.prochaine && vraiStatut(v.statut) && !estKo(v.statut) && (!v.delegue || estMoi(v.delegue));
    });
    return fait ? ['fait', 'ok'] : ['non fait', 'af'];
  }
  function voletBilan(id, titre, resume, corps, parDefaut) {
    var o = S.ui.bilOuverts || (S.ui.bilOuverts = {}), ouvert = o[id] === undefined ? parDefaut : o[id];
    return '<details class="bloc avance bil-volet" data-bil="' + id + '"' + (ouvert ? ' open' : '') + '><summary><b>' + titre + '</b>' + (resume ? '<span class="discret">' + resume + '</span>' : '') + '</summary>' + corps + '</details>';
  }
  VUES.bilanjour = function () {
    var d = jourAffiche(), t = aujourdhui(), R = rapportDe(d), valide = !!(R && R.valideLe);
    var duJour = visitesDuJourRapport(d);
    if (!duJour.length) duJour = ((S.data && S.data.historique) || []).filter(function (v) { return String(v.date).slice(0, 10) === d && (!v.delegue || estMoi(v.delegue)); })
      .map(function (v) { return versPlan(null, v, d); });
    var s = syntheseJour(duJour), nF = s.faites.length, n = s.prevues;
    var ordre = duJour.slice().sort(function (x, y) { return String(heureVisite(x)).localeCompare(String(heureVisite(y))); });
    var comm = []; s.communes.forEach(function (c) { var p = communeParente(c) || c; if (comm.indexOf(p) < 0) comm.push(p); });
    var heures = ordre.filter(function (a) { return a.statut; }).map(function (a) { return String(heureVisite(a)).slice(0, 5); }).filter(Boolean);
    var kmJ = R && R.km ? R.km + ' km' : (s.km ? km(s.km) : '');
    var pct = n ? (Math.round(nF / n * 1000) / 10).toString().replace('.', ',') + ' %' : '0 %';
    var h = '<button type="button" class="retour" data-a="nav" data-tab="jour">' + icone('chevron') + 'Journée</button>' +
      '<h2 class="titre-vue">Bilan du Jour</h2><p class="sous-titre">' + majuscule(dateLongue(d)) + (moi() ? ' · ' + esc(moi()) : '') + '</p>' +
      (valide ? '<span class="etiquette ok bil-etat">CR validé le ' + esc(R.valideLe) + '</span>' :
        '<div class="bil-bandeau"><span><b>CR non validé</b>' + (s.sansCr.length ? ' · ' + s.sansCr.length + ' visite' + (s.sansCr.length > 1 ? 's' : '') + ' sans CR' : '') + '</span>' +
        (futurVerrouille(d) || passeVerrouille(d) ? '' : '<button class="bouton petit bouton-plein" type="button" data-a="ouvrirRapport">Faire le CR</button>') + '</div>');
    // 1. La journée (3.28.48 : en tête, ouverte par défaut)
    h += voletBilan('journee', 'La journée', nF + '/' + n + ' visites' + (kmJ ? ' · ' + esc(kmJ) : ''),
      '<div class="bil-chiffres"><div><b>' + nF + '/' + n + '</b><small>visites faites</small></div>' +
      '<div><b>' + ([[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return x[1] + ' ' + s.pot[x[0]]; })[0] || '-') + '</b><small>potentiel vu</small></div>' +
      '<div><b>' + (kmJ ? esc(kmJ) : '-') + '</b><small>trajet</small></div></div>' +
      '<div class="bil-barre"><i style="width:' + (n ? Math.round(nF / n * 100) : 0) + '%"></i></div>' +
      '<div class="bil-meta"><span>' + pct + ' réalisé</span><span>' + (heures.length ? heures[0] + ' → ' + heures[heures.length - 1] : '') + (comm.length ? ' · ' + esc(comm.join(', ')) : '') + '</span></div>', true);
    // 1. À ne pas oublier
    var ret = [], ligneR = function (ic, cls, titre, txt, tag) {
      ret.push('<div class="bil-ligne"><span class="bil-ic ' + cls + '">' + icone(ic) + '</span><div><b>' + titre + '</b>' + (txt ? '<span>' + txt + '</span>' : '') + '</div>' + (tag ? '<span class="etiquette bil-tag ' + tag[1] + '">' + tag[0] + '</span>' : '') + '</div>');
    };
    ordre.slice().sort(function (x, y) { return String(x.prochaine || '').localeCompare(String(y.prochaine || '')); }).forEach(function (a) {
      if (a.prochaine && a.prochaine > a.date) ligneR(a.rdvConfirme ? 'calendrier' : 'tel', a.rdvConfirme ? 'rdv' : 'rap', (a.rdvConfirme ? 'RDV ' : 'Rappel ') + esc(dateCourte(a.prochaine)) + ' · ' + pastilleType(a) + lienFiche(a.code, esc(a.nom)),
        esc([estPharmacie(a) ? a.quartier : abrSpec(a.specialite), abregerHopital(a.lieu || '')].filter(Boolean).join(', ')) + (estKo(a.statut) ? ' · ' + esc(String(statutLibelle(a)).toLowerCase()) + ' ce jour-là' : ''), etatSuite(a));
    });
    s.commandes.forEach(function (x) { ligneR('valider', 'cmd', 'Commande', esc(x)); });
    s.ruptures.forEach(function (x) { ligneR('eclair', 'rup', 'Rupture', esc(x), ['à suivre', 'af']); });
    ordre.forEach(function (a) {
      if (!a.statut || estKo(a.statut)) return;
      var r = a.cr ? champsCr(a) : (histoVisite(d, a.code) || {}), note = r.commentaire || a.commentaire;
      if (note) ligneR('crayon', 'eng', pastilleType(a) + lienFiche(a.code, esc(a.nom)), esc(note));
    });
    var bes = R ? (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []) : [];
    if (bes.length) ligneR('plus', 'bes', 'Besoins', esc(bes.join(', ')));
    h += voletBilan('retenir', 'À ne pas oublier', ret.length ? String(ret.length) : 'R.A.S', ret.length ? ret.join('') : '<p class="bil-ras">R.A.S</p>', true);
    // 2. Le terrain
    var txt = function (v) { v = String(v || '').trim(); return v ? '<p class="bil-txt">' + parLigne(v) + '</p>' : '<p class="bil-ras">' + (valide ? 'R.A.S' : 'Non renseigné') + '</p>'; };
    h += voletBilan('terrain', 'Le terrain', '',
      '<div class="bil-sec">Faits marquants</div>' + txt(R && R.faits) +
      '<div class="bil-sec">Concurrence</div>' + txt(R && R.concurrence) +
      '<div class="bil-sec">Produits présentés</div><p class="bil-txt">' + (nF ? 'Toute la gamme, à chaque visite faite.' : '<span class="bil-ras">R.A.S</span>') + '</p>' +
      (s.echantillons.length ? '<div class="bil-sec">Échantillons remis</div><p class="bil-txt">' + s.echantillons.map(esc).join('<br>') + '</p>' : ''), true);
    // 4. Visites
    var vis = ordre.map(function (a) {
      var det = detailBilan(a), ko = estKo(a.statut), suivi = (a.prochaine && a.prochaine > a.date) || ko || det.some(function (x) { return x[0] === 'Commande' || (x[0] === 'Stocks' && /rupture/i.test(x[1])); });
      var sous = estPharmacie(a) ? infosSansDoublon(a, [a.lieu, a.quartier]) : infosSansDoublon(a, [abrSpec(a.specialite), abregerHopital(a.lieu || '')]);
      if (ko) sous = String(statutLibelle(a)) + (sous ? ' · ' + sous : '');
      return '<details class="bil-visite"><summary><span class="bil-h">' + esc(String(heureVisite(a) || '').slice(0, 5)) + '</span>' +
        '<span class="bil-pt ' + (!a.statut ? 'vide' : (ko ? 'ko' : 'ok')) + '" aria-hidden="true"></span><span class="bil-nom">' + pastilleType(a) + lienFiche(a.code, esc(a.nom)) + '<small>' + esc(sous) + (!a.statut ? ' · <span class="bil-sans">sans CR</span>' : '') + '</small></span></summary>' +
        '<div class="bil-detail">' + det.map(function (x) { return '<div><i>' + esc(x[0]) + '</i><span' + (/rupture/i.test(x[1]) ? ' class="bil-rup"' : '') + '>' + esc(x[1]) + '</span></div>'; }).join('') + '</div></details>';
    }).join('');
    h += voletBilan('visites', 'Visites', n + ' · ' + nF + ' faite' + (nF > 1 ? 's' : '') + (s.nonFaites.length ? ', ' + s.nonFaites.length + ' non faite' + (s.nonFaites.length > 1 ? 's' : '') : '') + (s.sansCr.length ? ', ' + s.sansCr.length + ' sans CR' : ''), vis || '<p class="bil-ras">Aucune visite</p>', false);
    // 5. Envoyé au superviseur
    h += voletBilan('envoi', 'Au superviseur', R && R.waLe ? 'envoyé le ' + esc(R.waLe) : 'non envoyé',
      '<div class="apercu bil-apercu">' + texteRapport(d).split('\n').map(function (x) { return x ? esc(x) : '&nbsp;'; }).join('<br>') + '</div>' +
      '<div class="bil-actions"><button class="bouton petit" type="button" data-a="rapCopier" data-v="' + d + '">Copier</button>' +
      '<button class="bouton petit wa" type="button" data-a="rapWhatsapp" data-v="' + d + '">' + icone('whatsapp') + (R && R.waLe ? 'Renvoyer' : 'Envoyer') + '</button></div>', false);
    if (!futurVerrouille(d) && !passeVerrouille(d) && valide) h += '<div class="bil-actions"><button class="bouton petit bouton-plein" type="button" data-a="bilanModifier" data-v="' + d + '">' + icone('crayon') + 'Modifier CR</button></div>';
    return h;
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
    var l = [['Visites', s.faites.length + ' faite' + (s.faites.length > 1 ? 's' : '') + ' sur ' + s.prevues + (s.sansCr.length ? ' · ' + s.sansCr.length + ' sans compte rendu' : '')]];
    if (s.faites.length) l.push(['Potentiel vu', [[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return s.pot[x[0]] + ' ' + x[1]; }).join(' · ')]);
    if (s.nonFaites.length) l.push(['Non faites', s.nonFaites.map(function (a) { return a.nom + ' (' + statutLibelle(a).toLowerCase() + ')'; }).join(', ')]);
    if (s.echantillons.length) l.push(['Échantillons', s.echantillons.join(' ; ')]);
    if (s.commandes.length) l.push(['Commandes', s.commandes.join(' ; ')]);
    if (s.ruptures.length) l.push(['Ruptures', s.ruptures.join(', ')]);
    if (s.suites.length) l.push(['RDV et rappels', s.suites.join(' ; ')]);
    l.push(['Trajet', km(s.km) + (s.est ? ' (' + minutesVersHeure(s.est.debut) + '–' + minutesVersHeure(s.est.fin) + ')' : '') + (s.communes.length ? ' · ' + s.communes.map(function (c) { return communeParente(c) || c; }).filter(function (c, i, t) { return t.indexOf(c) === i; }).join(', ') : '')]);
    return l;
  }
  function etapesRapport(R, s) {
    var resumeTxt = function (v, vide) { return String(v || '').trim() || vide; };
    return [
      { id: 'faits', titre: 'Faits marquants', resume: function () { return resumeTxt(R.faits, 'R.A.S'); },
        rendu: function () { return '<textarea data-f="rapport" data-k="faits" placeholder="Ex. le Dr X demande une étude sur Rozukaa ; nouvelle pharmacie ouverte à Angré">' + esc(R.faits || '') + '</textarea>'; } },
      { id: 'concurrence', titre: 'Concurrence observée', resume: function () { return resumeTxt(R.concurrence, 'R.A.S'); },
        rendu: function () { return '<textarea data-f="rapport" data-k="concurrence" placeholder="Produit, prix, action du concurrent…">' + esc(R.concurrence || '') + '</textarea>'; } },
      { id: 'besoins', titre: 'Besoins', resume: function () { var b = (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []); return b.length ? b.join(', ') : 'R.A.S'; },
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
  // 3.28.44 : compte rendu au superviseur, pensé pour être lu en 10 secondes (rubriques fixes depuis la 3.28.46) :
  // 1. en-tête et bilan chiffré sur deux lignes ; 2. « À retenir » (ce qui demande une suite : besoins, ruptures, commandes,
  // RDV, faits marquants, concurrence) ; 3. les visites, une ligne chacune avec l'heure ; 4. les visites non faites et leur motif
  function texteRapport(d) {
    var R = rapportDe(d) || {}, duJour = visitesDuJourRapport(d), s = syntheseJour(duJour);
    var dateCourteCr = majuscule(JOURS_COURTS[jourSemaineIndex(d)]) + ' ' + d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
    var nF = s.faites.length, taux = s.prevues ? (Math.round(nF / s.prevues * 1000) / 10).toString().replace('.', ',') + ' %' : '';
    var pot = [[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return x[1] + ' ' + s.pot[x[0]]; }).join(', ');
    var kmJ = R.km ? R.km + ' km' : (s.km ? km(s.km) : '');
    var comm = []; s.communes.forEach(function (c) { var p = communeParente(c) || c; if (comm.indexOf(p) < 0) comm.push(p); });
    var l = ['*CR du ' + dateCourteCr + '* · ' + (moi() || 'Délégué'),
      '✅ *' + nF + '/' + s.prevues + ' visites*' + (taux ? ' (' + taux + ')' : '') + (pot ? ' · ' + pot : '') + (kmJ ? ' · ' + kmJ : '') + (comm.length ? ' · ' + comm.join(', ') : '')];
    if (s.sansCr.length) l.push('⚠️ ' + s.sansCr.length + ' visite' + (s.sansCr.length > 1 ? 's' : '') + ' sans compte rendu : ' + s.sansCr.map(function (a) { return a.nom; }).join(', '));
    // 3.28.46 : rubriques fixes, toujours présentes (vides : « R.A.S »), dans l'ordre où le superviseur les lit
    var nettoie = function (t) { return String(t || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); };
    var besoins = (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []);
    // produits présentés : toute la gamme, une seule fois (tous les produits sont présentés à chaque visite)
    var gammes = []; if (nF) produitsRef().forEach(function (p) { var g = String(p).split(/\s+/)[0]; if (g && gammes.indexOf(g) < 0) gammes.push(g); });
    var rdv = [];
    s.faites.concat(s.nonFaites).forEach(function (a) {
      if (a.prochaine && a.prochaine > a.date) rdv.push((a.rdvConfirme ? 'RDV ' : 'Rappel ') + JOURS_COURTS[jourSemaineIndex(a.prochaine)] + ' ' + a.prochaine.slice(8) + '/' + a.prochaine.slice(5, 7) + ' : ' + a.nom);
    });
    l = l.concat(sectionWa('Produits présentés', nF ? ['Toute la gamme' + (gammes.length ? ' : ' + gammes.join(', ') : '')] : [], 'R.A.S'));
    l = l.concat(sectionWa('Commandes', s.commandes, 'R.A.S'));
    l = l.concat(sectionWa('Faits marquants', nettoie(R.faits), 'R.A.S'));
    l = l.concat(sectionWa('Concurrence', nettoie(R.concurrence), 'R.A.S'));
    l = l.concat(sectionWa('Besoins', besoins, 'R.A.S'));
    l = l.concat(sectionWa('Ruptures signalées', s.ruptures));
    l = l.concat(sectionWa('Échantillons remis', s.echantillons));
    l = l.concat(sectionWa('RDV et rappels', rdv));
    // visites faites, dans l'ordre de la journée ; pas les produits présentés (tous sont présentés), pas de nom répété
    var faites = s.faites.slice().sort(function (a, b) { return String(heureVisite(a)).localeCompare(String(heureVisite(b))); });
    l = l.concat(sectionWa('Visites faites', faites.map(function (a) {
      var det = estPharmacie(a) ? infosSansDoublon(a, [a.lieu, a.quartier]) : infosSansDoublon(a, [abrSpec(a.specialite), abregerHopital(a.lieu || '')]);
      var h = String(heureVisite(a) || '').slice(0, 5);
      return (h ? h + ' ' : '') + '*' + a.nom + '*' + (det ? ' (' + det + ')' : '');
    })));
    l = l.concat(sectionWa('Non faites', s.nonFaites.map(function (a) { return a.nom + ' : ' + String(statutLibelle(a) || '').toLowerCase(); })));
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
