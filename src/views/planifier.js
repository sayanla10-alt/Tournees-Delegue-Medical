  VUES.semaine = function () {
    if (!S.ui.voirParams) importerAgenda();
    if (S.ui.voirParams) {
      return '<div class="page-entree"><button type="button" class="retour" data-a="fermerParams">' + icone('chevron') + 'Planifier</button>' +
        '<h2 class="titre-vue">Planification</h2><p class="sous-titre">Une question à la fois ; touchez un critère pour l\'ajuster ou proposez directement votre tournée.</p>' + rendreParams() + '</div>';
    }
    var h = '<div class="tete-vue"><h2 class="titre-vue">Planifier</h2>' +
      '<button class="bouton petit bouton-plein" type="button" data-a="voirParams">' + icone('filtre') + 'Critères</button></div>' +
      '<p class="sous-titre">Préparez votre tournée selon vos priorités : ajustez vos critères par secteur et validez votre planning.</p>' +
      barreCriteresPlanifier();
    var datesF = datesPlanAvenir();
    // 3.28.31 : journée supprimée par appui long : l'écran reste sur ce jour, vide, au lieu de sauter
    // sur la journée suivante (qui laissait croire que le programme supprimé était toujours là)
    var jSup = S.ui.jourSupprime, jVide = S.ui.planVide;
    if (jSup && (jSup < aujourdhui() || S.plan.some(function (a) { return a.date === jSup; }))) jSup = S.ui.jourSupprime = null;
    if (jVide && (jVide < aujourdhui() || S.plan.some(function (a) { return a.date === jVide; }))) jVide = S.ui.planVide = null;
      return h + (datesF.length ? frisePlanifier(datesF, null) : friseVierge()) +
        '<div class="vide"><strong>' + majuscule(dateLongue(jSup)) + ' supprimé</strong>Plus aucune visite prévue ce jour. Proposez une nouvelle tournée pour ce jour, ou touchez un autre jour ci-dessus.</div>' +
        '<div class="rangee"><button class="bouton bouton-plein bouton-large" type="button" data-a="planifierJourSupprime" data-v="' + jSup + '">' + icone('relancer') + 'Proposer pour le ' + dateCourte(jSup) + '</button></div>' +
        boutonAnciens('margin-top:10px');
    }
    if (!datesF.length) {
      return h + frisePlanifier([], null) + '<div class="vide"><strong>Aucun jour planifié</strong>Touchez « Proposer ma tournée » ou ajustez vos critères ci-dessus.</div>' +
        '<div class="rangee"><button class="bouton bouton-plein bouton-large" type="button" data-a="generer">' + icone('relancer') + 'Proposer ma tournée</button></div>' +
        '<button class="bouton bouton-large" type="button" data-a="voirParams" style="margin-top:8px">' + icone('filtre') + 'Choisir mes critères pas à pas</button>' +
        boutonAnciens('margin-top:10px');
    }
    var dates = datesF;
    // 3.25.0 : à l'ouverture (et après rafraîchissement), demain est sélectionné par défaut
    if (!S.ui.planInit) { S.ui.planInit = true; var j1 = prochainJourOuvre(ajouterJours(aujourdhui(), 1)); S.ui.jour = dates.filter(function (x) { return x >= j1; })[0] || dates[dates.length - 1]; }
    choisirJour(dates);
    var d = S.ui.jour, enAttente = S.ui.aAccepter === d;
    if (S.ui.annulReprise) {
      h += '<section class="bandeau-prog reprise"><div><b>Programme repris</b><span>' + esc(S.ui.annulReprise.libelle) +
        '. Conservez-le, ou revenez à l\'ancienne planification.</span></div><div class="rangee">' +
        '<button class="bouton bouton-plein" type="button" data-a="repriseConserver">' + icone('valider') + 'Conserver</button>' +
        '<button class="bouton" type="button" data-a="repriseAnnuler">Revenir à l\'ancienne</button></div></section>';
    } else if (!enAttente) h += rendreProgramme();
    h += frisePlanifier(dates, d);
    var duJour = S.plan.filter(function (a) { return a.date === d; });
    var n3 = duJour.filter(function (a) { return +a.note === 3; }).length;
    var nMatin = duJour.filter(function (a) { return a.creneau === 'Matin'; }).length;
    var nSoir = duJour.length - nMatin;
    var nPhar = duJour.filter(function (a) { return estPharmacie(a); }).length;
    var nMed = duJour.length - nPhar;
    // 3.26.68 : distance du parcours estimée d'une visite à la suivante (ordre des heures), coefficient routier inclus
    var totalKm = (function () { var l = duJour.slice().sort(function (x, y) { return String(x.heure || '').localeCompare(String(y.heure || '')); }), t = 0, prec = null;
      l.forEach(function (a) { var c = coordArret(a); if (c && prec) { var dk = distanceKm(prec, c); if (dk < 99) t += dk; } if (c) prec = c; }); return t; })();
    var comJour = Array.from(new Set(duJour.map(function (a) { return a.commune; }).filter(Boolean)));
    var etat = jourConfirme(d) ? '<span class="etiquette ok">Confirmé' + (S.jours[d] && S.jours[d].modifieLe ? ', modifié' : '') + '</span>' : '<span class="etiquette alerte">Brouillon</span>';
    var details = [
      nMatin + ' matin' + (nSoir ? ', ' + nSoir + ' soir' : ''),
      (function () { var cc = coeurDeCible(), nC = duJour.filter(function (a) { return !estPharmacie(a) && cc.indexOf(a.specialite) >= 0; }).length;
        return [nMed ? 'Cœur ' + nC + ' · Autres ' + (nMed - nC) : '', nPhar ? nPhar + ' phcie' + (nPhar > 1 ? 's' : '') : ''].filter(Boolean).join(' · '); })(),
      n3 ? n3 + ' ★★★' : '',
      totalKm ? km(totalKm) + ' estimés' : ''
    ].filter(Boolean).join(' · ');
    h += '<div class="tete-jour-plan"><div class="bilan-jour">' +
      '<div class="bj-ligne1"><b>' + majuscule(JOURS_COURTS[jourSemaineIndex(d)]) + ' ' + d.slice(8) + ' ' + MOIS_ABREGES[+d.slice(5, 7) - 1] + '.</b> · ' + duJour.length + ' visite' + (duJour.length > 1 ? 's' : '') +
      (comJour.length ? ' · <span class="bj-communes">' + esc(comJour.join(', ')) + '</span>' : '') + '</div>' +
      '<div class="discret details-plan">' + details + '</div></div>' +
      '<div class="tete-jour-droite">' + etat + '</div></div>';
    h += '<ul class="plan-jour">' + rendreGroupesPlan(duJour) + '</ul>';
    var actionsPlan = '';
    if (enAttente) {
      actionsPlan = '<section class="bandeau-prog accepter"><div><b>Nouvelle sélection</b><span>Conserver ce tirage ?</span></div>' +
        '<div class="rangee"><button class="bouton" type="button" data-a="refuserProgramme" data-v="jour">Refuser</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="accepterJour">' + icone('valider') + 'Accepter</button></div></section>';
    } else if (!jourConfirme(d)) {
      // État B : Jour en brouillon -> Ajouter & Recalculer côte à côte, Accepter centré en bas
      actionsPlan = '<div class="rangee-tirage"><button class="bouton" type="button" data-a="ajouterTournee">' + icone('plus') + '<span>Ajouter</span></button>' +
        '<button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + '<span>Recalculer</span></button>' +
        '<button class="bouton bouton-plein bouton-accepter-plan" type="button" data-a="accepterJour">' + icone('valider') + '<span>Accepter</span></button></div>';
    } else {
      // État C : Jour déjà confirmé -> Ajouter & Recalculer côte à côte, WhatsApp centré en bas
      actionsPlan = '<div class="rangee-tirage"><button class="bouton" type="button" data-a="ajouterTournee">' + icone('plus') + '<span>Ajouter</span></button>' +
        '<button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + '<span>Recalculer</span></button>' +
        '<button class="bouton bouton-plein bouton-accepter-plan wa" type="button" data-a="partagerJourWhatsapp">' + icone('whatsapp') + '<span>WhatsApp</span></button></div>';
    }
    h += '<div class="barre-plan-actions-flottante">' + actionsPlan + '</div>';
    h += rendreCouverture(dates);
    h += boutonAnciens('margin-top:14px');
    return h;
  };
  // frise de l'agenda : tous les jours qui ont au moins une visite, dans l'ordre ; le jour choisi au centre
  // 3.28.56 : frise de Planifier comme celle de Journée : tous les jours, 6 semaines avant et après le jour choisi ;
  // jours planifiés avec leur marque (✓ confirmé, • brouillon) et leur nombre de visites ; jours à venir non planifiés en blanc,
  // à toucher pour les planifier ; jours passés, week-ends et fériés grisés
  function frisePlanifier(dates, d) {
    var t = aujourdhui(), centre = d || S.ui.planVide || S.ui.jourSupprime || t, sel = d || S.ui.planVide || S.ui.jourSupprime;
    return '<div class="bande-jours frise-plan"><div class="bj-jours" role="group" aria-label="Jours">' + jours.map(function (x) {
      var n = S.plan.filter(function (a) { return a.date === x; }).length, ok = jourConfirme(x);
      var nonOuvre = jourSemaineIndex(x) > 4 || estFerie(x), passe = x < t, actif = !passe && !nonOuvre;
      var marque = n ? '<i class="etat-jour ' + (ok ? 'ok' : 'brouillon') + '">' + (ok ? '✓ ' : '• ') + n + '</i>' : '<i></i>';
      return '<button type="button" class="bj-jour' + (x === t ? ' aujourdhui' : '') + (jourSemaineIndex(x) === 0 ? ' lundi' : '') +
        (nonOuvre ? ' non-ouvre grise' : (passe ? ' passe grise' : '')) + (!n && actif ? ' bj-vierge' : '') + '"' +
        (actif ? ' data-a="' + (n ? 'jour' : 'planVierge') + '" data-v="' + x + '" aria-pressed="' + (x === sel) + '"' : ' disabled aria-disabled="true"' + (x === sel ? ' aria-pressed="true"' : '')) + '><small>' +
        JOURS_COURTS[jourSemaineIndex(x)].replace('.', '') + '</small><b>' + (+x.slice(8)) + '</b><em>' + MOIS_ABREGES[+x.slice(5, 7) - 1] + '</em>' + marque + '</button>';
    }).join('') + '</div>' +
      '<button type="button" class="bj-cal" data-a="calOuvrir" data-ctx="plan" aria-label="Choisir une date à planifier">' + icone('calendrier') + '</button></div>';
      '<button type="button" class="bj-cal" data-a="calOuvrir" data-ctx="plan" aria-label="Choisir une date à planifier">' + icone('calendrier') + '</button></div>';
  }

  // ------------------------------------------------------------------ Reprendre un ancien programme
  function boutonAnciens(style) {
    return '<button class="bouton bouton-large" type="button" data-a="ouvrirAnciens" style="' + style + '">' + icone('relancer') + 'Reprendre un ancien programme</button>';
  }
  // Sources : mes tournées publiées (feuille Plannings, 62 jours) et l'archive du téléphone, hors jours de la tournée en cours
  function anciensProgrammes() {
    var t0 = aujourdhui(), parDate = {}, enCours = ensemble(datesPlanAvenir());
    // 3.24.23 : jours passés de la tournée du téléphone (toujours mémorisés)
    S.plan.forEach(function (a) { if (a.date < t0) (parDate[a.date] = parDate[a.date] || []).push(a); });
    var arch = LS.get('archives', {}), srv = {};
    Object.keys(arch).forEach(function (d) { if (!enCours[d] && !parDate[d]) parDate[d] = arch[d]; });
    // la version publiée (feuille Plannings) complète les jours absents de l'archive du téléphone
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (p.delegue && estMoi(p.delegue) && !enCours[p.date] && !arch[p.date] && !parDate[p.date]) (srv[p.date] = srv[p.date] || []).push(p);
    });
    Object.keys(srv).forEach(function (d) { parDate[d] = srv[d]; });
    var semaines = {};
    Object.keys(parDate).forEach(function (d) {
      if (!parDate[d].length) return;
      var l = lundiDe(d); (semaines[l] = semaines[l] || {})[d] = parDate[d];
    });
    return Object.keys(semaines).sort().reverse().slice(0, 8).map(function (l) { return { lundi: l, jours: semaines[l] }; });
  }
  // Dates cibles : semaine (même jour de la semaine) ou journée choisie dans les réglages
  // Dates cibles : la semaine choisie (même jour de la semaine) ou le jour choisi
  function ciblesReprise(type, source, cible) {
    var m = {};
    if (type === 'semaine') {
      var jours = joursOuvres(lundiDe(cible));
      Object.keys(source).forEach(function (d) { m[d] = jours[jourSemaineIndex(d)]; });
    } else m[Object.keys(source)[0]] = cible;
    return m;
  }
  function cibleParDefaut(type, valeur) {
    var t = prochainJourOuvre(aujourdhui());
    var av = datesPlanAvenir();
    if (type === 'semaine') return lundiDe(av.length ? av[0] : (jourSemaineIndex(aujourdhui()) > 3 ? ajouterJours(aujourdhui(), 7) : aujourdhui()));
    // même jour de la semaine, à partir d'aujourd'hui
    return prochaineOccurrence(jourSemaineIndex(valeur), t, true);
  }
  function reprendreProgramme(type, valeur, cibleChoisie, force) {
    var semaine = anciensProgrammes().filter(function (x) { return x.lundi === (type === 'semaine' ? valeur : lundiDe(valeur)); })[0];
    if (!semaine) return;
    var source = {};
    if (type === 'semaine') source = semaine.jours; else source[valeur] = semaine.jours[valeur];
    var vers = ciblesReprise(type, source, cibleChoisie || cibleParDefaut(type, valeur)), c = ctx(), nouveaux = [], manques = [];
    Object.keys(source).forEach(function (d) {
      var cible = vers[d];
      if (!cible || cible < aujourdhui() || jourSemaineIndex(cible) > 4 || estFerie(cible)) { manques = manques.concat(source[d].map(function (x) { return x.nom; })); return; }
      var j = jourSemaineIndex(cible), vus = {};
      source[d].slice().sort(function (a, b) { return String(a.heure).localeCompare(String(b.heure)); }).forEach(function (x) {
        if (vus[x.code]) return; vus[x.code] = true;
        var pr = c.prat[x.code], crs = (c.parCode[x.code] || []).filter(function (cr) { return cr.jourIdx === j; });
        var cr = crs.filter(function (k) { return String(k.idPresence) === String(x.idPresence) && k.creneau === x.creneau; })[0] ||
                 crs.filter(function (k) { return String(k.idPresence) === String(x.idPresence); })[0] || crs[0];
        if (!pr || !cr || absentLe(pr, cible)) { manques.push(x.nom); return; }
        var a = Moteur.arretDepuisCreneau(cr, cible);
        a.garde = true; a.etat = 'repris';
        nouveaux.push(a);
      });
    });
    var cibles = ensemble(Object.keys(vers).map(function (k) { return vers[k]; }));
    var aRemplacer = S.plan.filter(function (a) { return cibles[a.date] && a.etat !== 'valide' && !a.corrige; });
    if (aRemplacer.some(function (a) { return a.statut; }) && !force) {
      confirmerPuis('Comptes rendus non enregistrés', 'Des comptes rendus non enregistrés sur ces jours seront perdus. Continuer ?', 'Continuer',
        function () { reprendreProgramme(type, valeur, cibleChoisie, true); });
      return;
    }
    // sauvegarde : « Revenir à l'ancienne planification » reste possible tant que la reprise n'est pas conservée
    S.ui.annulReprise = { plan: JSON.parse(JSON.stringify(S.plan)), jours: JSON.parse(JSON.stringify(S.jours)),
      libelle: (type === 'semaine' ? 'Semaine du ' + dateCourte(valeur) + ' reprise sur ' : 'Programme du ' + dateCourte(valeur) + ' repris sur ') +
        (type === 'semaine' ? 'la semaine du ' + dateCourte(lundiDe(vers[Object.keys(vers)[0]])) : 'le ' + dateCourte(vers[valeur])) };
    LS.set('annulReprise', S.ui.annulReprise);
    var gardes = S.plan.filter(function (a) { return !cibles[a.date] || a.etat === 'valide' || a.corrige; });
    var deja = {}; gardes.forEach(function (a) { deja[a.date + '|' + a.code] = true; });
    S.plan = gardes.concat(nouveaux.filter(function (a) { return !deja[a.date + '|' + a.code]; }));
    Object.keys(cibles).forEach(function (d) { if (S.plan.some(function (a) { return a.date === d; })) reordonner(d); });
    // les RDV confirmés tombant sur ces jours sont aussi placés
    rdvProchaines(Object.keys(cibles).sort()).forEach(function (im) {
      if (!S.plan.some(function (x) { return x.code === im.code && x.date >= im.apres; })) placerImpose(im);
    });
    mettreBrouillon(Object.keys(cibles).filter(function (d) { return S.plan.some(function (a) { return a.date === d; }); }));
    S.ui.jour = Object.keys(cibles).sort()[0]; S.ui.feuille = null; S.ui.voirParams = false; S.ui.tab = 'semaine';
    if (type === 'semaine') { S.params.mode = 'semaine'; S.params.dateRef = lundiDe(S.ui.jour); } else if (S.params.mode === 'jour') S.params.dateRef = S.ui.jour;
    sauver(); rendre(); publierPlan(true); window.scrollTo(0, 0);
    toast(nouveaux.length + ' visite' + (nouveaux.length > 1 ? 's' : '') + ' reprise' + (nouveaux.length > 1 ? 's' : '') + ' en brouillon' +
      (manques.length ? ' ; ' + manques.length + ' praticien' + (manques.length > 1 ? 's' : '') + ' absent' + (manques.length > 1 ? 's' : '') + ' ce jour-là (non repris)' : '') + '.', 5000);
  }

  // Médecin déjà prévu par un collègue la même semaine : question « Le remplacer ? » (Oui : un autre praticien ; Non : je le garde)
  function conflitArret(a) {
    if (a.etat === 'valide' || a.statut || a.conflitOk || S.config.demo) return null;
    var l = cibleParCollegues(a.code, a.date);
    return l.length ? l[0] : null;
  }
  function questionConflit(a, cf) {
    return '<div class="conflit"><p>Aussi prévu par <b>' + esc(cf.delegue) + '</b> le ' + dateFr(cf.date) + '. Le remplacer par un autre praticien ?</p>' +
      '<div class="rangee"><button class="bouton petit bouton-plein" type="button" data-a="conflitRemplacer" data-uid="' + a.uid + '">Remplacer</button>' +
      '<button class="bouton petit" type="button" data-a="conflitGarder" data-uid="' + a.uid + '">Non</button></div></div>';
  }
  // Candidats pour remplacer une visite : présents ce jour-là, hors tournée, non prévus par un collègue, selon les critères de la tournée ;
  // ceux du même établissement d'abord (+ bonus), ceux qui s'insèrent sans retard, puis par priorité et proximité du lieu remplacé
  function candidatsRemplacement(a) {
    var d = a.date, j = jourSemaineIndex(d), c = ctx(), filtre = filtreCibles(), ex = exclusCollegues([d]);
    Object.keys(refusesActuels().codes).forEach(function (cR) { ex[cR] = true; });   // 3.26.94 : retirés à la main : pas reproposés en remplacement
    var dansPlan = ensemble(S.plan.filter(function (x) { return x.date === d; }).map(function (x) { return x.code; }));
    var origine = coordArret(a), vus = {}, l = [];
    var lieuA = a.lieu || '';
    var cibleEstPh = estPharmacie(a);
    (c.parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      var pEstPh = estPharmacie(p);
      if (pEstPh !== cibleEstPh) return;   // Remplacement strict : médecins par médecins, pharmacies par pharmacies
      if (dansPlan[cr.code] || cr.code === a.code || ex[cr.code] || absentLe(p, d)) return;
      if (!cibleEstPh && filtre && !filtre(p)) return;
      if (d === aujourdhui() && cr.fin <= minutesMaintenant()) return;   // aujourd'hui : seulement ceux encore présents
      if (joursEcoules(p.derniere, d) < (+S.params.delai || 0)) return;
      var dist = origine && cr.coord ? distanceKm(origine, cr.coord) : 99;
      var memeLieu = memeEtablissement(lieuA, cr.lieu);
      var x = { cr: cr, dist: dist, score: Moteur.scoreDe(p, d) + (memeLieu ? 50 : 0), memeLieu: memeLieu };
      var existant = vus[cr.code];
      // 3.26.9 : priorité absolue au créneau du même établissement (CHU, même clinique) si le praticien y exerce aussi
      if (!existant || (x.memeLieu && !existant.memeLieu) || (!existant.memeLieu && x.dist < existant.dist) || (x.memeLieu && existant.memeLieu && x.dist < existant.dist)) {
        vus[cr.code] = x;
      }
    });
    Object.keys(vus).forEach(function (k) { l.push(vus[k]); });
    l.sort(function (x, y) {
      if (y.memeLieu !== x.memeLieu) return y.memeLieu ? 1 : -1;
      return (y.score - 20 * y.dist) - (x.score - 20 * x.dist);
    });
    var jour = S.plan.filter(function (x) { return x.date === d && x.uid !== a.uid; });
    return l.slice(0, 25).map(function (x) {
      var n = Moteur.arretDepuisCreneau(x.cr, d);
      var essai = Moteur.ordonnerJour(jour.map(function (y) { return Object.assign({}, y); }).concat([n]), departCoord());
      var place = essai.filter(function (y) { return y.uid === n.uid; })[0];
      x.heure = place ? place.heure : n.heure; x.ok = !essai.some(function (y) { return y.retard; });
      if (d === aujourdhui() && heureVersMinutes(x.heure) !== null && heureVersMinutes(x.heure) < minutesMaintenant()) x.heure = minutesVersHeure(Math.ceil(minutesMaintenant() / 5) * 5);   // aujourd'hui : au plus tôt maintenant
      return x;
    }).sort(function (x, y) {
      if (y.memeLieu !== x.memeLieu) return y.memeLieu ? 1 : -1;
      return (y.ok ? 1 : 0) - (x.ok ? 1 : 0);
    }).slice(0, 12);
  }
  function remplacerArret(uid) {
    var a = arret(uid); if (!a) return;
    S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: uid, choix: null, lieuRef: a.lieu };
    rendre();
  }
  function appliquerRemplacement(uid, cle, garder) {
    var a = arret(uid), cr = Moteur.creneauParCle(ctx(), cle); if (!a || !cr) return;
    if (!garder) { S.rejetes[a.code] = true; refuser(a.code); S.plan = S.plan.filter(function (x) { return x.uid !== uid; }); }
    var n = Moteur.arretDepuisCreneau(cr, a.date); n.etat = 'ajoute'; n.garde = true;
    S.plan.push(n); reordonner(a.date);
    if (S.ui.tab === 'semaine') mettreBrouillon([a.date]);
    S.ui.feuille = null; S.ui.ouvert = null; marquerModifie(); sauver(); rendre(); publierPlan();
    var placé = arret(n.uid);
    toast((garder ? n.nom + ' ajouté en remplacement de ' + a.nom : a.nom + ' remplacé par ' + n.nom) + (placé ? ' (' + placé.heure + ', ' + n.quartier + ')' : '') + '.', 5000);
  }
  // 3.26.94 : praticiens retirés à la main d'une liste proposée : ils ne reviennent plus dans les propositions (recalcul,
  // nouveau tirage, complément) tant que les critères de planification restent les mêmes ; un changement de critère les libère
  function signatureCriteres() {
    // 3.28.18 : tous les filtres comptent, ceux de Planifier comme ceux du Répertoire (communes, spécialités)
    var p = S.params || {}, tri = function (l) { return (l || []).slice().sort(); };
    return JSON.stringify([tri(p.communes), p.parJour ? p.communesJour || {} : {}, tri(p.specialites), tri(p.potentiels), p.typeCibles || '', +p.delai || 0, +p.maxJour || 0, p.eviterCollegues !== false]);
  }
  function refusesActuels() {
    var r = LS.get('refuses', null), s = signatureCriteres();
    if (!r || r.crit !== s) { r = { crit: s, codes: {} }; LS.set('refuses', r); }
    return r;
  }
  function refuser(code) { var r = refusesActuels(); r.codes[code] = true; LS.set('refuses', r); }
  function retirerArret(uid) {
    var a = arret(uid); if (!a) return;
    S.plan = S.plan.filter(function (x) { return x.uid !== a.uid; });
    if (!S.plan.some(function (x) { return x.date === a.date; })) { var rt = LS.get('joursRetires', {}); rt[a.date] = true; LS.set('joursRetires', rt); }
    S.rejetes[a.code] = true; refuser(a.code);
    S.imposes = S.imposes.filter(function (im) { return im.code !== a.code; });
    reordonner(a.date);
    if (S.ui.tab === 'semaine' && S.plan.some(function (x) { return x.date === a.date; })) mettreBrouillon([a.date]);
    S.ui.ouvert = null; sauver(); rendre(); publierPlan();
    toast(a.nom + ' retiré de la tournée.');
  }
  // 3.26.31 : suppression d'une journée planifiée après confirmation (appui très long sur la date)
  function supprimerJourPlanifie(date) {
    // 3.28.28 : les visites déjà faites (compte rendu) restent ; tout le reste de la journée est effacé,
    // y compris l'ancienne tournée gardée du serveur, qui ne revient plus
    S.plan = S.plan.filter(function (x) { return x.date !== date || x.statut; });
    if (S.data && S.data.plannings) S.data.plannings = S.data.plannings.filter(function (x) { return !(x.date === date && x.delegue && estMoi(x.delegue) && !vraiStatut(x.statut)); });
    var arch = LS.get('archives', {}); if (arch[date]) { delete arch[date]; LS.set('archives', arch); }
    var resteFaites = S.plan.some(function (x) { return x.date === date; });
    if (!resteFaites) delete S.jours[date];
    var rt = LS.get('joursRetires', {});
    rt[date] = true;
    LS.set('joursRetires', rt);
    S.imposes = S.imposes.filter(function (im) { return im.date !== date; });
    if (S.ui.avantJJ && S.ui.avantJJ.date === date) S.ui.avantJJ = null;
    var restantes = datesPlanAvenir();
    if (S.ui.jour === date) S.ui.jour = restantes[0] || prochainJourOuvre(ajouterJours(aujourdhui(), 1));
    // 3.28.29 : l'écran reste sur la journée supprimée (vide, avec « Planifier le … » pour la refaire)
    if (S.ui.tab === 'jour' && date >= aujourdhui() && !resteFaites) S.ui.jourVue = date;
    else if (S.ui.jourVue === date) S.ui.jourVue = null;
    // 3.28.31 : dans Planifier, l'écran reste sur le jour supprimé (vide) et la date des critères aussi
    if (S.ui.tab === 'semaine' && date >= aujourdhui() && !resteFaites) {
      S.ui.jourSupprime = date;
      if (S.params.mode === 'jour') { S.params.dateRef = date; LS.set('params', S.params); }
    }
    S.ui.ouvert = null;
    marquerModifie();
    sauver();
    rendre();
    publierPlan(true);
    toast('Journée du ' + dateFr(date) + ' supprimée.');
  }
  // 3.26.51 : compte rendu effacé (appui très long) : la visite redevient à faire ; si déjà envoyé, la correction partira à la prochaine validation
  // 3.26.62 : suppression complète d'une visite de la journée (appui très long)
  function supprimerVisiteJour(a) {
    S.queue = S.queue.filter(function (v) { return v.uid !== a.uid; });
    S.plan = S.plan.filter(function (x) { return x.uid !== a.uid; }); S.horsPlan = (S.horsPlan || []).filter(function (x) { return x.uid !== a.uid; });
    // 3.26.64 : mémorisée comme supprimée : elle ne revient plus par le programme publié ni par l'historique
    var sup = LS.get('visitesSupprimees', {}); (sup[a.date] = sup[a.date] || {})[a.code] = true; LS.set('visitesSupprimees', sup);
    if (!S.plan.some(function (x) { return x.date === a.date; })) { var rt = LS.get('joursRetires', {}); rt[a.date] = true; LS.set('joursRetires', rt); }
    S.ui.ouvert = null; LS.set('horsPlan', S.horsPlan); S.ui.aPublier = true; LS.set('aPublier', true); sauver(); rendre(); publierPlan(); toast('Visite supprimée de la journée.');
  }
  function effacerCr(a) {
    delete a.cr; a.statut = ''; delete a.valideA; a.activite = ''; a.produits = ''; a.commentaire = ''; a.prochaine = ''; a.rdvConfirme = false;
    if (a.etat === 'valide') { a.etat = 'ajoute'; a.corrige = true; }
    S.queue = S.queue.filter(function (v) { return v.uid !== a.uid; });
    sauver(); rendre(); toast('Compte rendu effacé.');
  }
  // 3.28.57 : visites d'un jour telles que Journée les montre : à faire (supprimables) et déjà renseignées (gardées)
  function comptesJour(date) {
    var vus = {}, aFaire = 0, faites = 0;
    S.plan.filter(function (a) { return a.date === date; }).concat(donneesJour(date, true), arretsHorsJour(date), programmeDuJour(date)).forEach(function (a) {
      var k = a.code || a.uid; if (!k) return;
      var f = !!(vraiStatut(a.statut) || a.etat === 'valide' || a.corrige);
      if (vus[k] === undefined) { vus[k] = f; if (f) faites++; else aFaire++; }
      else if (f && !vus[k]) { vus[k] = true; aFaire--; faites++; }
    });
    return { aFaire: aFaire, faites: faites };
  }
  function demanderSuppressionJour(date, nb, nbFaites) {
    if (nb === undefined || nb === null) { var cj = comptesJour(date); nb = cj.aFaire; nbFaites = cj.faites; }
    var dLong = majuscule(dateLongue(date));
    var nStr = nb > 0 ? (nb + ' visite' + (nb > 1 ? 's' : '')) : 'aucune visite';
    confirmerPuis(
      'Supprimer la journée',
      'Voulez-vous supprimer ' + (nb > 0 ? 'les visites à faire du ' : 'la journée du ') + '<b>' + dLong + '</b> (' + nStr + ') ?<br><span class="discret">' +
        (nbFaites ? nbFaites + ' visite' + (nbFaites > 1 ? 's' : '') + ' déjà renseignée' + (nbFaites > 1 ? 's restent' : ' reste') + ', avec ' + (nbFaites > 1 ? 'leurs comptes rendus' : 'son compte rendu') + '. ' : 'Les visites déjà faites et leurs comptes rendus restent. ') +
        'Vous pourrez replanifier ce jour dans Planifier.</span>',
      'Supprimer la journée',
      function () { supprimerJourPlanifie(date); }
    );
  }
  // Confirmation avant tout changement de la tournée
  // confirme les jours donnés (par défaut le jour affiché), puis propose l'envoi par WhatsApp (Oui / Non / Retour)
  // ------------------------------------------------------------------ 3.28.35 : planifier le jour même
  function estFaiteArret(a) { return !!(a && (vraiStatut(a.statut) || a.etat === 'valide' || a.corrige)); }
  // visites prévues (pas encore faites) que Journée montre pour ce jour : tournée du téléphone et tournée publiée
  function prevuesJournee(d) {
    var vus = {}, l = [];
    donneesJour(d, true).concat(arretsHorsJour(d)).forEach(function (a) {
      if (!a || !a.code || estFaiteArret(a) || vus[a.code]) return;
      vus[a.code] = true; l.push(a);
    });
    return l;
  }
  function memoriserJourMeme(cible) {
    var t = aujourdhui();
    if (cible.indexOf(t) < 0) return;
    if (S.ui.avantJJ && S.ui.avantJJ.date === t) return;   // déjà mémorisé au premier tirage (les recalculs suivants ne comptent pas)
    var l = prevuesJournee(t);
    S.ui.avantJJ = l.length ? {
      date: t,
      arrets: JSON.parse(JSON.stringify(l)),
      planJour: JSON.parse(JSON.stringify(S.plan.filter(function (a) { return a.date === t && !estFaiteArret(a); }))),
      jourEtat: S.jours[t] ? JSON.parse(JSON.stringify(S.jours[t])) : null
    } : null;
  }
  // Oui : la nouvelle sélection remplace la journée déjà planifiée (les visites faites restent)
  function remplacerJourMeme(av) {
    var t = av.date, anciens = {};
    av.arrets.forEach(function (a) { anciens[a.code] = true; });
    // l'ancienne tournée publiée ne revient plus dans Journée
    if (S.data && S.data.plannings) S.data.plannings = S.data.plannings.filter(function (x) { return !(x.date === t && x.delegue && estMoi(x.delegue) && !vraiStatut(x.statut)); });
    var duJour = S.plan.filter(function (a) { return a.date === t; });
    var gardes = duJour.filter(function (a) { return estFaiteArret(a) || !anciens[a.code]; });
    // des visites de l'ancienne journée étaient restées dans la sélection (Proposer complète les jours déjà planifiés) :
    // on refait la journée sans elles, les nouvelles et les visites faites restent à leur heure
    if (gardes.length < duJour.length) {
      var p = S.params, horsCible = S.plan.filter(function (a) { return a.date !== t; });
      var exclus = p.eviterCollegues !== false ? exclusCollegues([t]) : exclusValides([t]), ecart = Math.max(+p.delai || 0, 5);
      horsCible.forEach(function (a) { if (Math.abs(joursEcoules(a.date, t)) < ecart) exclus[a.code] = true; });
      Object.keys(refusesActuels().codes).forEach(function (c) { exclus[c] = true; });
      var heures = {}; gardes.forEach(function (a) { heures[a.uid] = a.heure; });
      var r = Moteur.genererPlanning(ctx(), {
        dates: [t], communesPour: communesPour, maxJour: +p.maxJour || 8, delai: +p.delai || 0, exclus: exclus, rejetes: anciens,
        conserves: gardes, imposes: S.imposes.filter(function (im) { return im.date === t; }).concat(rdvProchaines([t])), depart: departCoord(), accepte: filtreCibles()
      });
      r.arrets.forEach(function (a) { if (heures[a.uid]) a.heure = heures[a.uid]; });
      S.plan = horsCible.concat(r.arrets); trierPlan();
    }
    var rt = LS.get('joursRetires', {}); if (rt[t]) { delete rt[t]; LS.set('joursRetires', rt); }
  }
  // Non : la journée déjà planifiée reste telle qu'elle était ; la nouvelle sélection est abandonnée
  function garderJourMeme(av) {
    var t = av.date;
    S.plan = S.plan.filter(function (a) { return a.date !== t || estFaiteArret(a); });
    var deja = {}; S.plan.forEach(function (a) { if (a.date === t) deja[a.code] = true; });
    S.plan = S.plan.concat((av.planJour || []).filter(function (a) { return !deja[a.code]; }));
    trierPlan();
    if (av.jourEtat) S.jours[t] = av.jourEtat; else delete S.jours[t];
  }
  function confirmerProgramme(dates, depuisChoix, jjDecide) {
    dates = dates && dates.length ? dates : [S.ui.jour];
    var t0 = aujourdhui(), av = S.ui.avantJJ;
    dates.forEach(function (d) { avantJours[d] = S.jours[d] ? JSON.parse(JSON.stringify(S.jours[d])) : { etat: 'proposition', valideLe: '', modifieLe: '' }; });
    var avantAAccepter = S.ui.aAccepter;
    confirmerJours(dates); S.ui.aAccepter = null; S.ui.avantTirage = null;
    S.ui.flashTexte = dates.length === 1 ? majuscule(dateLongue(dates[0])) + ' confirmé' : dates.length + ' jours confirmés';
    sauver(); publierPlan(true);
    S.ui.feuille = { type: 'valide', titre: 'Tournée confirmée ✓', dates: dates, avantJours: avantJours, avantAAccepter: avantAAccepter, depuisChoix: !!depuisChoix, retourAction: 'annulerConfirmation' };
    S.ui.flashValide = Date.now() + 6000; setTimeout(function () { S.ui.flashValide = 0; rendreSiPossible(); }, 6100);   // 3.28.33 : 2 s de plus pour lire
    rendre();
  }
  // 3.19.0 : toute question se pose en trois boutons : Oui (appliquer), Non (refuser ; action propre à la question,
  // sinon retour à l'écran), Sortir (fermer sans rien changer et quitter le parcours en cours)
  function confirmerPuis(titre, message, libelleOui, action, siNon, ouiClasse) {
    S.ui.feuille = { type: 'confirmer', titre: titre, message: message, oui: libelleOui || 'Oui', action: action, non: siNon || null, ouiClasse: ouiClasse || null };
    rendre();
    setTimeout(function () { var b = document.querySelector('#feuille [data-defaut]'); if (b) try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); } }, 60);
  }
  function piedQuestion(ouiAttrs, ouiLib, nonAction, ouiClasse) {
    return '<button class="bouton-texte sortir-question" type="button" data-a="sortirQuestion">Sortir</button>' +
      '<button class="bouton" type="button" data-a="' + (nonAction || 'fermerFeuille') + '">Non</button>' +
      '<button class="bouton ' + (ouiClasse || 'bouton-plein') + '" type="button" ' + ouiAttrs + '>' + ouiLib + '</button>';
  }

  // 3.26.43 : Abréviations conventionnelles et usuelles du secteur médical en Côte d'Ivoire
  // (CHU, CHR, HG, CSU, CSU COM, CMS, CM, GM, Poly., FSU COM, PISAM, SAMU, HMA, ICA).
  // Les noms propres de lieux ou quartiers (ex. Deux Plateaux) et l'identité des cliniques restent strictement intacts.
  function abregerHopital(nom) {
    if (!nom) return '';
    var s = String(nom).trim();

    // 1. Sigles majeurs conventionnels
    s = s.replace(/^Polyclinique\s+Internationale\s+Sainte\s+Anne[- ]Marie\b/i, 'PISAM');
    s = s.replace(/^Polyclinique\s+Sainte\s+Anne[- ]Marie\b/i, 'PISAM');
    s = s.replace(/^PISAM\s*\(.*?\)/i, 'PISAM');
    s = s.replace(/^H[ôo]pital\s+Militaire\s+d['’]Abidjan\s*\(HMA\)/i, 'HMA');
    s = s.replace(/^H[ôo]pital\s+Militaire\s+d['’]Abidjan\b/i, 'HMA');
    s = s.replace(/^Institut\s+de\s+Cardiologie\s+d['’]Abidjan\s*\(ICA\)/i, 'ICA');
    s = s.replace(/^Institut\s+de\s+Cardiologie\s+d['’]Abidjan\b/i, 'ICA');
    s = s.replace(/^Service\s+d['’]Aide\s+M[ée]dicale\s+Urgente\b/i, 'SAMU');

    // 2. Établissements publics & communautaires
    s = s.replace(/^Centre\s+Hospitalier\s+Universitaire\s+(?:de\s+|d['’])?/i, 'CHU ');
    s = s.replace(/^Centre\s+Hospitalier\s+R[ée]gional\s+(?:de\s+|d['’])?/i, 'CHR ');
    s = s.replace(/^H[ôo]pital\s+G[ée]n[ée]ral\s+(?:de\s+|d['’])?/i, 'HG ');
    s = s.replace(/^(?:Formation\s+Sanitaire\s+Urbaine\s+(?:[àa]\s+base\s+)?Communautaire|FSU[- ]COM)\s+(?:de\s+|d['’])?/i, 'FSU COM ');
    s = s.replace(/^(?:CSU\s+Communautaire|Centre\s+de\s+Sant[ée]\s+Urbain(?:\s+[àa]\s+base)?\s+Communautaire|CSU[- ]COM)\s*(?:de\s+|d['’])?/i, 'CSU COM ');
    s = s.replace(/\bCSU\s+Communautaire\b/gi, 'CSU COM');
    s = s.replace(/\bCSU-COM\b/gi, 'CSU COM');
    s = s.replace(/^Centre\s+de\s+Sant[ée]\s+Urbain\s+(?:de\s+|d['’])?/i, 'CSU ');

    // 3. Établissements privés, cliniques et centres
    s = s.replace(/^Centre\s+M[ée]dico[- ]Social\s+(?:de\s+|d['’])?/i, 'CMS ');
    s = s.replace(/^Centre\s+M[ée]dical\s+(?:de\s+|d['’])?/i, 'CM ');
    s = s.replace(/^Groupe\s+M[ée]dical\s+(?:de\s+|d['’]|du\s+)?/i, 'GM ');
    s = s.replace(/^Polyclinique\s+(?:des\s+|du\s+|de\s+la\s+|de\s+|d['’])?/i, 'Poly. ');
    s = s.replace(/^Clinique\s+M[ée]dicale\s+(?:de\s+|d['’])?/i, 'Clinique ');

    // 4. Voirie et voiries usuelles (Boulevard -> Blvd.)
    s = s.replace(/\bBoulevard\b/gi, 'Blvd.');

    // 5. Préservation et normalisation des quartiers (ex. "2 pltx" -> "Deux Plateaux")
    s = s.replace(/\b2\s*pltx\b/gi, 'Deux Plateaux');
    s = s.replace(/\b2\s*plateaux\b/gi, 'Deux Plateaux');

    return s.replace(/\s{2,}/g, ' ').trim();
  }

  // 3.27.22 : repères du lieu (colonne Repères de Presences), retrouvés par le n° de présence pour les visites déjà planifiées
  function reperesDe(a) {
    if (a.reperes) return a.reperes;
    var id = String(a.idPresence || ''), l = (S.data && S.data.presences) || [];
    var pr = id ? l.filter(function (x) { return String(x.id) === id; })[0] : null;
    if (!pr && a.code && a.lieu) pr = l.filter(function (x) { return x.code === a.code && normaliser(x.lieu) === normaliser(a.lieu); })[0];
    var r = pr && pr.reperes ? String(pr.reperes).trim() : '';
    // anciennes visites : repères déjà écrits dans le quartier, pas de redite
    return r && normaliser(a.quartier || '').indexOf(normaliser(r)) < 0 ? r : '';
  }
  // 3.25.36 : Médecin dans Planifier -> Spécialité, Hôpital où on le voit ce jour (abrégé), Secteur réel et distance
  function infosMedecinPlan(a) {
    var pObj = (typeof praticien === 'function' && praticien(a.code)) || {};
    var lieuBrut = a.lieu || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lieu) || '';
    var hopital = abregerHopital(lieuBrut);
    var qBrut = a.quartier || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].quartier) || '';
    var comBrut = a.commune || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].commune) || '';
    var coord = a.coord || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lat ? { lat: +pObj.lieux[0].lat, lon: +pObj.lieux[0].lon } : null);
    var secteur = nomSecteur(qBrut, comBrut, coord);
    var morceaux = [];
    if (a.specialite) morceaux.push(abrSpec(a.specialite));
    if (hopital) morceaux.push(hopital);
    if (secteur && (!hopital || hopital.toLowerCase().indexOf(secteur.toLowerCase()) < 0)) morceaux.push(secteur);
    var rep = reperesDe(a); if (rep) morceaux.push(rep);
    var pos = gpsFrais(), c = pos ? (coordPrecise(a) || coordArret(a) || coord) : null;
    if (c && pos) {
      var d = distanceVol(pos, c);
      morceaux.push(distMoi(d));
    }
    return morceaux.join(' · ');
  }

  // 3.26.35 : Pharmacie dans Planifier -> Localisation sans doublon + distance GPS en km (identique aux médecins)
  function infosPharmaciePlan(a) {
    var pObj = (typeof praticien === 'function' && praticien(a.code)) || {};
    var pCoord = (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lat) ? { lat: +pObj.lieux[0].lat, lon: +pObj.lieux[0].lon } : (pObj.lat && pObj.lon ? { lat: +pObj.lat, lon: +pObj.lon } : null);
    var pos = gpsFrais(), c = pos ? (coordPrecise(a) || coordArret(a) || a.coord || pCoord) : null;
    var base = infosSansDoublon(a, [a.lieu, a.quartier, reperesDe(a), a.commune]);
    if (c && pos) {
      var d = distanceVol(pos, c);
      return (base ? base + ' · ' : '') + distMoi(d);
    }
    return base;
  }

  // 3.28.23 : liste regroupée par secteur (« Abobo – Nord & PK18 », ou la commune) : tous les médecins proposés dans un secteur
  // sont sous le même titre, dans l'ordre de leur heure ; les médecins d'un même hôpital se suivent, sans titre
  function rendreGroupesPlan(l) {
    var blocs = [], par = {};
    l.forEach(function (a) {
      var nom = Moteur.nomSecteurTournee(a), k = normaliser(nom) || ('u|' + a.uid);
      if (!par[k]) { par[k] = { nom: nom, l: [] }; blocs.push(par[k]); }
      par[k].l.push(a);
    });
    var titres = blocs.length > 1;
    // 3.28.34 : dans chaque secteur, les médecins d'un même hôpital à la suite (dans l'ordre où l'hôpital apparaît),
    // et dans un même hôpital, une même spécialité à la suite ; rien n'est déplacé dans la journée, seul l'ordre de la liste change
    blocs.forEach(function (b) {
      var rangLieu = {}, rangSpec = {};
      b.l.forEach(function (a, i) {
        var kl = normaliser(a.lieu || '') || ('u|' + a.uid), ks = kl + '|' + normaliser(a.specialite || '');
        if (rangLieu[kl] === undefined) rangLieu[kl] = i;
        if (rangSpec[ks] === undefined) rangSpec[ks] = i;
        a.__tri = [rangLieu[kl], rangSpec[ks], i];
      });
      b.l.sort(function (x, y) { return x.__tri[0] - y.__tri[0] || x.__tri[1] - y.__tri[1] || x.__tri[2] - y.__tri[2]; });
      b.l.forEach(function (a) { delete a.__tri; });
    });
    return blocs.map(function (b) {
      return (titres ? '<li class="lp-groupe lp-groupe-q" aria-hidden="true">' + icone('localisation') + '<span>' + esc(b.nom || 'Autre secteur') + '</span><small>' + b.l.length + ' visite' + (b.l.length > 1 ? 's' : '') + '</small></li>' : '') +
        b.l.map(function (a) { return rendreLignePlan(a); }).join('');
    }).join('');
  }

  // Ligne compacte de la tournée (Planifier) : garder, retirer, ouvrir la visite
  function rendreLignePlan(a) {
    var verrou = a.etat === 'valide', e = '';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? esc(libelleRdv(a)) : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(a)) + '</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici</span>';
    e += etiquetteCollegues(a.code, a.date);

    // Titre/Nom, Spécialité, Hôpital où on le voit ce jour et Secteur de l'hôpital
    // Pas de localisation précise (quartier précis, distance GPS) : réservée aux pharmacies qui ne bougent pas
    var sousTitre = estPharmacie(a)
      ? infosPharmaciePlan(a)
      : infosMedecinPlan(a);

    return '<li class="ligne-plan' + classeType(a) + (a.garde ? ' gardee' : '') + (verrou ? ' faite' : '') + '">' +
      '<div class="lp-gauche" data-a="voirVisite" data-uid="' + a.uid + '">' +
        '<span class="lp-pastille-col">' + pastilleType(a) + '</span>' +
        '<span class="lp-heure">' + esc(heureVisite(a)) + '</span>' +
      '</div>' +
      '<div class="lp-droite">' +
        '<button type="button" class="lp-corps lp-nom-btn" data-a="voirVisite" data-uid="' + a.uid + '">' +
          lienFiche(a.code, '<b>' + esc(a.nom) + '</b>') + ' ' + etoiles(a.note) +
        '</button>' +
        '<div class="lp-bas">' +
          '<button type="button" class="lp-details-btn" data-a="voirVisite" data-uid="' + a.uid + '">' +
            (sousTitre ? '<span class="discret bloc-texte">' + specGras(a, sousTitre) + '</span>' : '') +
            (e ? '<span class="etiquettes">' + e + '</span>' : '') +
          '</button>' +
          (verrou ? '<span class="lp-fait" title="Compte Rendu enregistré">' + icone('valider') + '</span>' :
            '<span class="lp-actions"><button type="button" class="lp-garder" data-a="garder" data-uid="' + a.uid + '" aria-pressed="' + !!a.garde + '" aria-label="' +
              (a.garde ? 'Ne plus garder' : 'Garder au prochain calcul') + '">' + icone('epingle') + '<small>' + (a.garde ? 'Gardé' : 'Garder') + '</small></button>' +
            '<button type="button" class="lp-retirer" data-a="retirer" data-uid="' + a.uid + '" aria-label="Retirer de la tournée">' + icone('fermer') + '</button></span>') +
        '</div>' +
      '</div>' +
      (conflitArret(a) ? questionConflit(a, conflitArret(a)) : '') +
      '</li>';
  }

  // Résumé de la planification : le titre (période), puis une tuile par option ; touchez une tuile pour la modifier
  function rendreResume() {
    var et = etapesParams(), quand = et.filter(function (e) { return e.id === 'quand'; })[0];
    return '<section class="bloc resume-plan"><div class="tete-bloc"><button type="button" class="titre-tuile" data-a="resumeEditer" data-v="quand"><h3>' + esc(quand.resume()) + '</h3>' + icone('crayon') + '</button>' +
      '<button class="bouton petit" data-a="voirParams" type="button">' + icone('calendrier') + 'Planifier</button></div>' +
      '<div class="tuiles-resume">' + et.filter(function (e) { return e.id !== 'quand'; }).map(function (e) {
        return '<button type="button" class="tuile" data-a="resumeEditer" data-v="' + e.id + '"><small>' + esc({ ou: 'Communes', qui: 'Praticiens', spec: 'Spécialités', valeur: 'Potentiel', rythme: 'Rythme', rdv: 'RDV et prioritaires' }[e.id] || e.titre) + '</small><b>' + esc(e.resume()) + '</b></button>';
      }).join('') + '</div></section>';
  }

  // Planification de la tournée posée une question à la fois, comme le compte rendu et la recherche :
  // Quand ? > Où ? > Qui ? > Quelle spécialité ? > Quel potentiel ? > Quel rythme ? > RDV et prioritaires ? puis « Proposer ma tournée ».
  S.ui.etapesP = LS.get('etapesParams', null) || { ok: {} };
  if (!LS.get('etapesParams', null) && S.plan.length) ['quand', 'ou', 'qui', 'spec', 'valeur', 'rythme', 'rdv'].forEach(function (k) { S.ui.etapesP.ok[k] = true; });
  function sauverEtapesP() { LS.set('etapesParams', S.ui.etapesP); }
  // 3.17.0 : ouvrir Planifier reprend toujours le parcours à l'étape 1 (réponses précédentes conservées)
  function etapesPDepuisDebut() { S.ui.etapesP = { ok: {} }; sauverEtapesP(); }
  function pucesSpecialitesCible(sel, actToggle, actToutes, actCoeur, actPlus) {
    var coeur = coeurDeCible(), s = sel || [];
    var estCoeur = s.length > 0 && s.length === coeur.length && coeur.every(function (x) { return s.indexOf(x) >= 0; });
    var liste = [], vus = {};
    // 3.25.27 : n'affiche sur la page que le cœur de cible (+ sélectionnées) ; les autres sont dans « Liste complète… »
    coeur.concat(s).forEach(function (nom) {
      if (nom && nom !== 'Pharmacien' && !vus[nom]) { vus[nom] = true; liste.push(nom); }
    });
    return '<div class="puces" style="margin:6px 0 8px">' +
      '<button type="button" class="puce puce-tous" data-a="' + actToutes + '" aria-pressed="' + (!s.length) + '">Toutes</button>' +
      '<button type="button" class="puce" data-a="' + actCoeur + '" aria-pressed="' + estCoeur + '">Cœur de cible (' + coeur.length + ')</button>' +
      '</div>' +
      '<div class="bloc-liste-complete">' +
        '<button type="button" class="bouton bouton-liste-complete" data-a="' + actPlus + '">' + icone('loupe') + 'Liste complète…</button>' +
      '</div>' +
      '<span class="sous-etape" style="margin:6px 0 4px">Spécialités du cœur de cible (pré-sélectionnées, touchez pour modifier)</span>' +
      '<div class="puces">' + liste.map(function (nom) {
        return '<button type="button" class="puce" data-a="' + actToggle + '" data-v="' + esc(nom) + '" aria-pressed="' + (s.indexOf(nom) >= 0) + '">' + esc(nom) + '</button>';
      }).join('') + '</div>';
  }
  function etapesParams() {
    var p = S.params, dates = datesAffichees();
    var demainIso = prochainJourOuvre(ajouterJours(aujourdhui(), 1));
    var l = [
      { id: 'quand', titre: 'Période', resume: function () {
          if (p.mode === 'jour') {
            if (p.dateRef === demainIso || p.dateRef === ajouterJours(aujourdhui(), 1)) return 'Demain';
            if (p.dateRef === aujourdhui()) return 'Aujourd\'hui';
            return 'Journée du ' + dateCourte(p.dateRef);
          }
          return dates.length && dates[0] !== lundiDe(dates[0]) ? 'Du ' + dateCourte(dates[0]) + ' au ' + dateCourte(dates[dates.length - 1]) : 'Semaine du ' + dateCourte(dates[0]);
        },
        rendu: function () {
          var t0 = prochainJourOuvre(aujourdhui()), j1 = prochainJourOuvre(ajouterJours(aujourdhui(), 1));
          var sem0 = lundiDe(t0), sem1 = ajouterJours(lundiDe(aujourdhui()), 7);
          return '<div class="segment" role="group" aria-label="Durée" style="margin-top:8px">' +
              '<button type="button" data-a="param" data-k="mode" data-v="jour" aria-pressed="' + (p.mode === 'jour') + '">Une journée</button>' +
              '<button type="button" data-a="param" data-k="mode" data-v="semaine" aria-pressed="' + (p.mode === 'semaine') + '">Une semaine</button></div>' +
            '<div class="grille-options-2" style="margin-bottom:8px">' +
              (p.mode === 'jour'
                ? '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="jour" data-d="' + t0 + '" aria-pressed="' + (p.dateRef === t0) + '">' + (t0 === aujourdhui() ? 'Aujourd\'hui' : 'Prochain jour ouvré') + '</button>' +
                  '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="jour" data-d="' + j1 + '" aria-pressed="' + (p.dateRef === j1) + '">Demain</button>'
                : '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="semaine" data-d="' + sem0 + '" aria-pressed="' + (lundiDe(p.dateRef) === sem0) + '">Cette semaine</button>' +
                  '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="semaine" data-d="' + sem1 + '" aria-pressed="' + (lundiDe(p.dateRef) === sem1) + '">Semaine prochaine</button>') +
            '</div>' +
            '<label class="champ" style="margin-bottom:0"><span>' + (p.mode === 'jour' ? 'Date' : 'Semaine du') + '</span>' +
              '<input type="date" data-f="param" data-k="dateRef" min="' + aujourdhui() + '" value="' + esc(p.dateRef) + '"></label>' +
              (p.mode === 'semaine' && lundiDe(p.dateRef) < aujourdhui() ? '<p class="discret" style="margin:6px 0 0">Semaine entamée : seuls les jours à venir seront planifiés.</p>' : '') + bandeauFeries(dates) + bandeauDejaPlanifie(datesPeriode());
        } },
      { id: 'ou', titre: 'Communes ciblées', resume: function () { return p.mode === 'semaine' && p.parJour ? 'Communes différentes selon le jour' : libelleCommunes(p.communes); },
        rendu: function () {
          var h = '<div class="champ" style="margin:8px 0 0"><span>Communes</span>' +
            '<button type="button" class="selecteur" data-a="choisirCommunes" data-v="tout"><span>' + esc(libelleCommunes(p.communes)) + '</span><b>▾</b></button></div>';
          if (p.mode === 'semaine') {
            h += '<label class="interrupteur"><span>Communes différentes selon le jour</span>' +
              '<input type="checkbox" data-f="param" data-k="parJour"' + (p.parJour ? ' checked' : '') + '></label>';
            if (p.parJour) {
              h += '<div class="secteurs">' + JOURS.map(function (j, i) {
                var c = p.communesJour[i];
                return '<div class="secteur"><span>' + j + '</span><button type="button" class="selecteur" data-a="choisirCommunes" data-v="' + i + '"><span>' +
                  esc(c && c.length ? libelleCommunes(c) : 'Comme ci-dessus') + '</span><b>▾</b></button></div>';
              }).join('') + '</div>';
            }
          }
          return h;
        } },
      { id: 'qui', titre: 'Praticiens à visiter', auto: true, resume: function () { return { tous: 'Médecins et pharmacies', medecins: 'Médecins', pharmacies: 'Pharmacies' }[p.typeCibles || 'tous']; },
        rendu: function () {
          return '<div class="grille-options-3" style="margin-top:8px">' + [['medecins', 'Médecins'], ['pharmacies', 'Pharmacies'], ['tous', 'Tous']].map(function (x) {
            return '<button type="button" class="puce" data-a="param" data-k="typeCibles" data-v="' + x[0] + '" data-auto="qui" aria-pressed="' + ((p.typeCibles || 'tous') === x[0]) + '">' + x[1] + '</button>';
          }).join('') + '</div>';
        } },
      { id: 'spec', titre: 'Spécialités', si: p.typeCibles !== 'pharmacies', facultatif: true, resume: function () { return libelleListe(p.specialites, 'Toutes'); },
        rendu: function () {
          return pucesSpecialitesCible(p.specialites, 'paramSpecToggle', 'paramSpecToutes', 'paramSpecDefaut', 'choisirSpecialites') +
            '<p class="discret" style="margin:6px 0 0">' + esc(libelleListe(p.specialites, 'Toutes les spécialités')) + (p.typeCibles === 'tous' ? ' (les pharmacies restent incluses)' : '') + '</p>';
        } },
      { id: 'valeur', titre: 'Potentiel', facultatif: true, resume: function () { return p.potentiels.length ? p.potentiels.map(function (x) { return ETOILES[x]; }).join(' · ') : 'Tous'; },
        rendu: function () {
          var tousP = !p.potentiels.length || p.potentiels.length === 3;
          return '<div class="grille-options-4" style="margin-top:8px">' +
            '<button type="button" class="puce puce-tous" data-a="paramPotentiel" data-v="tous" aria-pressed="' + tousP + '">Tous</button>' +
            ['A', 'B', 'C'].map(function (x) {
              return '<button type="button" class="puce" data-a="paramPotentiel" data-v="' + x + '" aria-pressed="' + (p.potentiels.indexOf(x) >= 0) + '">' + ETOILES[x] + '</button>';
            }).join('') + '</div>';
        } },
      { id: 'rythme', titre: 'Rythme de visite', resume: function () {
          return p.maxJour + '/jour · ' + p.delai + ' j mini' + (!S.config.demo && p.eviterCollegues !== false ? ' · hors collègues' : ''); },
        rendu: function () {
          return '<div class="grille-2 grille-rythme" style="margin-top:8px">' +
              '<div class="champ champ-rythme"><span>Visites par jour</span>' +
                '<div class="champ-compteur">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="maxJour" data-pas="-1" aria-label="Moins">−</button>' +
                  '<input type="number" min="1" max="20" inputmode="numeric" data-f="param" data-k="maxJour" value="' + p.maxJour + '">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="maxJour" data-pas="1" aria-label="Plus">+</button>' +
                '</div><small class="rythme-unite">visites / jour</small></div>' +
              '<div class="champ champ-rythme"><span>Ne pas revoir avant</span>' +
                '<div class="champ-compteur">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="delai" data-pas="-1" aria-label="Moins">−</button>' +
                  '<input type="number" min="0" max="365" inputmode="numeric" data-f="param" data-k="delai" value="' + p.delai + '">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="delai" data-pas="1" aria-label="Plus">+</button>' +
                '</div><small class="rythme-unite">jours minimum</small></div></div>' +
            (S.config.demo ? '' : '<label class="interrupteur" style="margin-bottom:0"><span>Éviter les médecins déjà prévus par un collègue</span>' +
              '<input type="checkbox" data-f="param" data-k="eviterCollegues"' + (p.eviterCollegues !== false ? ' checked' : '') + '></label>');
        } },
      { id: 'rdv', titre: 'RDV et prioritaires', resume: function () {
          var n = rdvProchaines(dates).length, m = S.imposes.length, r = [];
          if (n) r.push(n + ' RDV déjà pris'); if (m) r.push(m + ' prioritaire' + (m > 1 ? 's' : ''));
          return r.length ? r.join(' · ') : 'Aucun'; },
        rendu: function () {
          // RDV confirmés dans les comptes rendus (placés d'office automatiquement) + prioritaires ajoutés à la main
          var rdv = rdvProchaines(dates), h = '<p class="discret" style="margin:4px 0 8px">Placés d\'office : la tournée se construit autour d\'eux.</p>';
          h += '<span class="sous-etape">RDV déjà pris</span>';
          h += rdv.length ? '<ul class="liste-imposes">' + rdv.map(function (im) {
            var pr = praticien(im.code), passe = im.dateRdv < dates[0];
            return '<li class="li-retirable" data-retirer="rdv" data-v="' + esc(im.code + '|' + im.dateRdv) + '"><div><b>' + esc(pr ? pr.nom : im.code) + '</b> ' + (pr ? etoiles(pr.note) : '') +
              '<span class="discret bloc-texte">RDV du ' + dateFr(im.dateRdv).slice(0, -5) +
              (passe ? ', date passée : au plus tôt' : '') + (function () {
                // RDV un jour sans présence connue : placé à la prochaine présence connue, et on le dit
                var crs = ctx().parCode[im.code] || [], jour = jourSemaineIndex(im.dateRdv);
                if (passe || crs.some(function (cr) { return cr.jourIdx === jour; })) return '';
                var suiv = dates.filter(function (d) { return d >= im.dateRdv && !estFerie(d) && crs.some(function (cr) { return cr.jourIdx === jourSemaineIndex(d); }); })[0];
                return suiv ? ' reporté au ' + dateFr(suiv).slice(0, -5) + ' pour absence' : ', absent sur la période';
              })() + '</span></div><button type="button" class="bouton petit bouton-retirer-imp" data-a="retirerRdvDemande" data-v="' + esc(im.code + '|' + im.dateRdv) + '">' + icone('fermer') + 'Retirer</button></li>';
          }).join('') + '</ul>' : '<p class="discret" style="margin:4px 0 0">Aucun RDV pris sur cette période.</p>';
          h += '<div class="imposes-tete" style="margin-top:12px"><span class="sous-etape" style="margin:0">Prioritaires ajoutés</span></div>';
          h += S.imposes.length ? '<ul class="liste-imposes">' + S.imposes.map(function (im, i) {
            var pr = praticien(im.code);
            var c = im.cle ? Moteur.creneauParCle(ctx(), im.cle) : null;
            var quand = im.force && im.date === aujourdhui()
              ? 'Aujourd\'hui (' + dateCourte(im.date) + ') · visite inopinée'
              : (im.date ? dateFr(im.date) + (c ? ', ' + c.creneau.toLowerCase() + ', ' + esc(c.lieu) : '') : 'Au meilleur moment de la période');
            return '<li class="li-retirable" data-retirer="imp" data-v="' + i + '"><div><b>' + esc(pr ? pr.nom : im.code) + '</b> ' + (pr ? etoiles(pr.note) : '') +
              '<span class="discret bloc-texte">' + quand + (im.rdv ? ', RDV ' + esc(im.rdv) : '') + '</span></div>' +
              '<button type="button" class="bouton petit bouton-retirer-imp" data-a="retirerImposeDemande" data-i="' + i + '">' + icone('fermer') + 'Retirer</button></li>';
          }).join('') + '</ul>' : '<p class="discret" style="margin:4px 0 0">Aucun.</p>';
          // 3.26.77 : « Ajouter » en dernière ligne, sous les « Retirer », même taille, en vert
          h += '<div class="ligne-ajouter-imp"><button type="button" class="bouton petit bouton-retirer-imp bouton-ajouter-imp" data-a="ouvrirRecherche">' + icone('plus') + 'Ajouter</button></div>';
          return h;
        } }
    ];
    return l.filter(function (e) { return e.si !== false; });
  }
  // navigation d'une étape, commune à Planifier et à la Recherche : Précédent (sauf la 1re), Passer (si la question s'y prête),
  // Suivant (Terminer à la dernière)
  function boutonsEtape(aPrec, idPrec, aPasser, aOk, id, dernier) {
    return '<div class="rangee cr-boutons nav-etapes">' +
      (aPrec ? '<button class="bouton nav-prec" type="button" data-a="' + aPrec + '" data-v="' + idPrec + '">' + icone('chevron') + 'Précédent</button>' : '') +
      (aPasser ? '<button class="bouton" type="button" data-a="' + aPasser + '" data-v="' + id + '">Passer</button>' : '') +
      '<button class="bouton bouton-plein nav-suiv" type="button" data-a="' + aOk + '" data-v="' + id + '">' + (dernier ? 'Terminer' : 'Suivant' + icone('chevron')) + '</button></div>';
  }
  function rendreParams() {
    var ok = S.ui.etapesP.ok, etapes = etapesParams(), n = etapes.length;
    var enCours = etapes.filter(function (e) { return !ok[e.id]; })[0];
    var h = '<section class="bloc"><div class="cr-pas etapes-filtres">';
    etapes.forEach(function (e, i) {
      if (ok[e.id]) {
        h += '<button type="button" class="cr-fait" data-a="pEtapeEditer" data-v="' + e.id + '"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b>' + icone('crayon') + '</button>';
        return;
      }
      if (e !== enCours) return;
      h += '<div class="cr-question"><span class="etape-titre">' + e.titre + ' <small>étape ' + (i + 1) + '/' + n + (e.facultatif ? ', facultatif' : '') + '</small></span>' + e.rendu();
      h += boutonsEtape(i > 0 ? 'pEtapePrec' : '', i > 0 ? etapes[i - 1].id : '', e.facultatif ? 'pEtapePasser' : '', 'pEtapeOk', e.id, i === n - 1);
      h += '</div>';
    });
    h += '</div>';
    if (enCours) {
      h += '<div style="margin-top:10px;text-align:center"><button type="button" class="bouton-texte" data-a="generer">' + icone('relancer') + 'Proposer directement avec ces critères</button></div>';
      return h + '</section>';
    }
    // toutes les questions sont répondues : on peut proposer
    h += bandeauDejaPlanifie(datesPeriode()) + '<button class="bouton bouton-plein bouton-large" data-a="generer" type="button" style="margin-top:10px">' + icone('relancer') + 'Proposer ma tournée</button>' +
      '</section>';
    return h;
  }

  function rendreProgramme() {
    var h = '';
    // 3.19.0 : le bandeau vert ne s'affiche que quelques secondes après la confirmation
    // 3.25.22 : suppression du bandeau Brouillon en haut d'écran (gain de place mobile ; le badge et les boutons du bas suffisent)
    if (S.ui.flashValide && Date.now() < S.ui.flashValide) {
      h += '<section class="bandeau-prog valide flash"><div><b>Tournée confirmée</b><span>' + esc(S.ui.flashTexte || '') + '. Visible par l\'équipe.</span></div></section>';
    }
    return h;
  }

  // ------------------------------------------------------------------ Compte Rendu de visite (arbre de décision, 3.5.0)
  // Médecin : faite ? → types → produits présentés → réactions → échantillons → bilan → suite (rappel ou RDV confirmé + date)
  // Pharmacie : faite ? → interlocuteur → types → stocks → commande → compléments → suite
  // Non faite : motif → précision → remplaçant → suite. Seul un RDV confirmé place la visite dans la tournée.
  var REACTIONS = ['Intéressé', 'Indécis', 'Non intéressé', 'Non évalué', 'Demande d\'informations'];
  var ETATS_STOCK = ['Disponible', 'Stock faible', 'Rupture', 'Non vérifié'];
  var ANOMALIES = ['Proche péremption', 'Périmé'];
  var INTERLOCUTEURS = ['Pharmacien', 'Vendeurs', 'Chargé Commande', 'Autre'];
  var SUITES = {
    medecin: [['aucune', 'Aucune'], ['visite', 'Nouvelle visite'], ['appeler', 'Appeler'], ['informations', 'Envoyer infos']],
    pharmacie: [['aucune', 'Aucune'], ['visite', 'Nouvelle visite'], ['appeler', 'Appeler'], ['commande', 'Suivi'], ['informations', 'Informations']],
    nonFaite: [['aucune', 'Aucune'], ['reprogrammer', 'Reprogrammer'], ['appeler', 'Appeler']]
  };
  function activitesPharmacie() { return (S.data && S.data.activitesPharmacie && S.data.activitesPharmacie.length) ? S.data.activitesPharmacie : ACTIVITES_PHARMACIE_DEFAUT; }
  function statutFaite() { var l = statuts().filter(function (s) { return s.visite; }); return (l.filter(function (s) { return s.nom === 'Visite faite'; })[0] || l[0] || { nom: 'Visite faite' }).nom; }
  function motifsPour(a) {
    var base = estPharmacie(a) ? MOTIFS_PHARMACIE : MOTIFS_MEDECIN, connus = statuts().filter(function (s) { return !s.visite; }).map(function (s) { return s.nom; });
    var l = base.filter(function (m) { return !connus.length || connus.indexOf(m) >= 0; });
    return l.length ? l : base;
  }
  // compte rendu structuré de l'arrêt (reconstruit depuis les anciens champs si besoin)
  function crDe(a) {
    var ph = estPharmacie(a);
    if (!a.cr) {
      var c = { types: listeActivites(a.activite), produits: [], produitsStock: [], reactions: {}, echQ: {}, stocks: {}, cmdQ: {}, besoin: [], retourQ: {}, actionProduits: [], suite: 'aucune' };
      if (a.statut) { if (estKo(a.statut)) { c.faite = 'non'; c.motif = a.statut; c.precision = a.commentaire || ''; } else { c.faite = 'oui'; c.bilan = a.commentaire || ''; c.commentaire = a.commentaire || ''; } }
      if (!c.types.length && !a.statut) c.types = derniersTypesCr(ph).slice();
      var lp = listeProduits(a.produits), ref = produitsRef();
      c.produits = lp.filter(function (x) { return ref.indexOf(x) >= 0; }); c.autres = lp.filter(function (x) { return ref.indexOf(x) < 0; }).join(', ');
      if (c.produits.length || c.autres) c.presentes = 'oui';
      else if (!a.statut && !ph) c.produits = derniersProduitsCr().slice();
      if (ph && !a.statut) c.produitsStock = [];
      if (a.statut && a.prochaine) { c.suite = c.faite === 'non' ? 'reprogrammer' : 'visite'; c.suiteType = 'rdv'; c.date = a.prochaine; }
      else c.suite = 'aucune';
      a.cr = c;
    } else {
      if (!a.cr.suite && a.etat !== 'valide') a.cr.suite = 'aucune';
      if ((!a.cr.types || !a.cr.types.length) && !a.statut && !(a.cr.ok && a.cr.ok.types)) a.cr.types = derniersTypesCr(ph).slice();
      if (ph && !a.cr.produitsStock) a.cr.produitsStock = [];
    }
    return a.cr;
  }
  function implicite(a, c) {
    var t = c.types || [];
    return estPharmacie(a) ? { stocks: t.indexOf('Stocks') >= 0, commande: t.indexOf('Commande') >= 0 }
      : { presentes: (t.indexOf('Présentation') >= 0 || t.indexOf('Présentation produit') >= 0), echant: t.indexOf('Échantillons') >= 0 };
  }
  function produitsPresentes(c) { return (c.produits || []).concat(listeProduits(c.autres)); }
  // 3.28.45 : formulaire express : le statut choisi règle « visite faite » et le motif ; une visite non faite n'a ni produits, ni échantillons, ni réactions
  function appliquerStatutExpress(c) {
    if (!c || !c.statut) return;
    if (Moteur.estVisite(c.statut, statuts())) { c.faite = 'oui'; c.motif = ''; }
    else { c.faite = 'non'; c.motif = c.statut; viderVisiteFaite(c); }
  }
  function viderVisiteFaite(c) { c.produits = []; c.autres = ''; c.reactions = {}; c.echant = 'non'; c.echQ = {}; c.types = []; }
  function listeQ(o) { return Object.keys(o || {}).filter(function (p) { return +o[p] > 0; }).map(function (p) { return p + ' × ' + (+o[p]); }).join(' ; '); }
  // champs envoyés à l'historique (colonnes de la feuille Historique)
  function champsCr(a) {
    var c = crDe(a), ph = estPharmacie(a), im = implicite(a, c), r = { interlocuteur: '', reactions: '', echantillons: '', stocks: '', commande: '', complements: '', suite: '' };
    if (c.faite === 'oui') {
      r.statut = statutFaite(); r.activite = (c.types || []).join(' ; ');
      if (!ph) {
        r.produits = ''; r.reactions = '';   // 3.28.45 : tous les produits sont présentés, rien à noter
        if (c.echant === 'oui' || im.echant) r.echantillons = listeQ(c.echQ);
        r.commentaire = c.bilan || '';
      } else {
        r.interlocuteur = c.interlocuteur || '';
        if (c.stocksVerif === 'oui' || im.stocks) {
          var prodsK = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : Object.keys(c.stocks || {});
          r.stocks = prodsK.filter(function (p) { return c.stocks[p] && c.stocks[p].etat; }).map(function (p) {
            var s = c.stocks[p]; return p + ' : ' + s.etat.toLowerCase() + (s.qte ? ' (' + s.qte + ')' : '') + (s.anomalie ? ', ' + s.anomalie.toLowerCase() + (s.lot ? ' lot ' + s.lot : '') : '');
          }).concat(c.autresStock ? ['Autres : ' + c.autresStock] : []).join(' ; ');
          r.produits = prodsK.filter(function (p) { return c.stocks[p] && (c.stocks[p].etat === 'Disponible' || c.stocks[p].etat === 'En stock' || c.stocks[p].etat === 'Stock faible'); }).join(', ');
          if (!r.produits && c.produitsStock && c.produitsStock.length) r.produits = c.produitsStock.join(', ');
        }
        var besoinL = (c.besoin || []).concat(c.besoinTexte ? [c.besoinTexte] : []);
        if (c.commande === 'oui' || im.commande) r.commande = listeQ(c.cmdQ) || (besoinL.length ? 'Oui, ' + besoinL.join(', ') : 'Oui');
        var t = c.types || [], comp = [];
        if (t.indexOf('Échantillons') >= 0 && listeQ(c.echQ)) { comp.push('Échantillons : ' + listeQ(c.echQ)); r.echantillons = listeQ(c.echQ); }
        if ((t.indexOf('Retour ou échange') >= 0 || t.indexOf('Retour') >= 0) && (listeQ(c.retourQ) || c.retourMotif)) comp.push('Retour : ' + listeQ(c.retourQ) + (c.retourMotif ? ' (' + c.retourMotif + ')' : ''));
        var act = t.filter(function (x) { return ['MEP', 'PLV', 'Formation', 'Animation'].indexOf(x) >= 0; });
        if (act.length && (c.action || (c.actionProduits || []).length)) comp.push(act.join(', ') + ' : ' + (c.action || '') + ((c.actionProduits || []).length ? ' (' + c.actionProduits.join(', ') + ')' : ''));
        r.complements = comp.join(' ; ');
        r.commentaire = c.commentaire || '';
      }
    } else if (c.faite === 'non') {
      r.statut = c.motif || ''; r.activite = ''; r.produits = ''; r.commentaire = c.precision || '';
    }
    var lib = (SUITES[c.faite === 'non' ? 'nonFaite' : (ph ? 'pharmacie' : 'medecin')].filter(function (x) { return x[0] === c.suite; })[0] || [])[1];
    if (c.suite && c.suite !== 'aucune' && c.suiteType && c.date) {
      r.suite = (c.suiteType === 'rdv' ? 'RDV confirmé : ' : 'Rappel : ') + (lib || '').toLowerCase();
      r.prochaine = c.date; r.rdv = c.suiteType === 'rdv';
    } else { r.prochaine = ''; r.rdv = false; }
    return r;
  }
  // garde les champs habituels de l'arrêt à jour (statut, activité, produits, commentaire, prochaine étape)
  function syncCr(a) {
    var r = champsCr(a);
    a.statut = r.statut || ''; a.activite = r.activite || ''; a.produits = r.produits || ''; a.commentaire = r.commentaire || '';
    a.prochaine = r.prochaine || ''; a.rdvConfirme = !!r.rdv;
    horodater(a);
  }
  // 3.25.9 : heure d'enregistrement de la visite (horodatage), affichée dans Journée à la place de l'heure planifiée
  function horodater(a) {
    if (!a.statut) { delete a.valideA; return; }
    if (!a.valideA && a.date === aujourdhui()) a.valideA = minutesVersHeure(minutesMaintenant());
  }
  function manquesCr(a) {
    var c = crDe(a), m = [];
    if (!c.faite) m.push('indiquez si la visite a été faite');
    else if (c.faite === 'non' && !c.motif) m.push('choisissez le motif');
    if (c.suite && c.suite !== 'aucune' && (!c.suiteType || !c.date)) m.push('précisez rappel ou RDV confirmé et la date');
    return m;
  }

  // petits éléments de formulaire
  function puceCr(a, cle, v, lib, actif, multi) {
    return '<button type="button" class="puce" data-a="' + (multi ? 'crMulti' : 'crChoix') + '" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + esc(v) +
      '" aria-pressed="' + !!actif + '">' + esc(lib || v) + '</button>';
  }
  // Composants du compte rendu, alignés sur Planifier : 2 choix = segment (comme « Une journée | Une semaine »),
  // jusqu'à 5 = puces, au-delà = sélecteur qui ouvre la liste (comme « Communes » ou « Spécialités »).
  S.ui.crOptions = {};
  function optionsNorm(options) { return options.map(function (o) { return Array.isArray(o) ? o : [o, o]; }); }
  function selecteurCr(a, cle, options, vals, multi, vide) {
    S.ui.crOptions[a.uid + '|' + cle] = optionsNorm(options);
    var libs = optionsNorm(options).filter(function (o) { return vals.indexOf(o[0]) >= 0; }).map(function (o) { return o[1]; });
    return '<div class="champ" style="margin:8px 0 0"><button type="button" class="selecteur" data-a="crListe" data-uid="' + a.uid + '" data-k="' + cle + '" data-m="' + (multi ? 1 : 0) + '">' +
      esc(libs.length ? libs.join(', ') : vide) + '<b>▾</b></button></div>';
  }
  function choixCr(a, cle, options, val, classePuces) {
    var o = optionsNorm(options);
    if (o.length === 2) return '<div class="segment" role="group" style="margin:8px 0 0">' + o.map(function (x) {
      return '<button type="button" data-a="crChoix" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + esc(x[0]) + '" aria-pressed="' + (val === x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    if (o.length > 5 && cle !== 'motif') return selecteurCr(a, cle, o, val ? [val] : [], false, 'Choisir…');
    return '<div class="puces' + (classePuces ? ' ' + classePuces : '') + '">' + o.map(function (x) { return puceCr(a, cle, x[0], x[1], val === x[0]); }).join('') + '</div>';
  }
  function multiCr(a, cle, options, vals) {
    if (options.length > 4) return selecteurCr(a, cle, options, vals || [], true, 'Choisir');
    var v = vals || [], tous = options.length > 1 && v.length === options.length;
    return '<div class="puces">' +
      (options.length > 1 ? '<button type="button" class="puce puce-tous" data-a="crMultiTous" data-uid="' + a.uid + '" data-k="' + cle + '" aria-pressed="' + tous + '">Tous</button>' : '') +
      options.map(function (o) { return puceCr(a, cle, o, o, v.indexOf(o) >= 0, true); }).join('') + '</div>';
  }
  // 3.25.27 : Parcours et types de visite strictement différenciés Médecin vs Pharmacie (sans mention croisée)
  // 3.27.17 : activités en pharmacie rangées pour tenir sur le moins de lignes (courtes ensemble, « Autre » en dernier)
  function ordrePastillesPh(l) {
    var pref = ['Routine', 'Stocks', 'MEP', 'Commande', 'Formation', 'Échantillons', 'Animation'];
    return l.slice().sort(function (x, y) { var a = pref.indexOf(x), b = pref.indexOf(y); if (x === 'Autre') return 1; if (y === 'Autre') return -1; return (a < 0 ? 99 : a) - (b < 0 ? 99 : b); });
  }
  function rendreChoixTypesCr(a, vals) {
    var ph = estPharmacie(a), sel = vals || [];
    var list = ph ? activitesPharmacie() : activites();
    S.ui.crOptions[a.uid + '|types'] = optionsNorm(list);
    var toutCoche = list.length > 0 && list.every(function (t) { return sel.indexOf(t) >= 0; });
    var h = '<div class="gammes-cr">';
    h += '<div class="gamme-cr-actions"><span class="discret">' + (sel.length ? sel.length + ' sélectionné' + (sel.length > 1 ? 's' : '') + ' : ' + esc(sel.join(', ')) : (ph ? 'Choisissez au moins une activité' : 'Choisissez au moins un type')) + '</span>' +
      '<span><button type="button" class="lien-action" data-a="crMultiTous" data-uid="' + a.uid + '" data-k="types">' + (toutCoche ? 'Tout décocher' : 'Tous') + '</button>' +
      (sel.length ? ' · <button type="button" class="lien-action" data-a="crTypesAucun" data-uid="' + a.uid + '">Effacer</button>' : '') + '</span></div>';
    h += '<div class="gamme-cr-bloc"><div class="gamme-cr-titre"><span><b>' + (ph ? 'Activités en pharmacie' : 'Types de visite médicale') + '</b></span></div>' +
      '<div class="puces puces-types-cr' + (ph ? ' puces-types-ph' : '') + '">' + (ph ? ordrePastillesPh(list.filter(function (t) { return !/^Retour/.test(t); })) : list).map(function (t) {
        var libT = (t === 'Présentation produit' || t === 'Présentation') ? 'Présentation'
                 : (t === 'Retour ou échange' || t === 'Retour') ? 'Retour'
                 : t;
        return puceCr(a, 'types', t, libT, sel.indexOf(t) >= 0, true);
      }).join('') + '</div></div>';
    h += '</div>';
    return h;
  }
  // 3.25.36 : Présentation 2x2 harmonieuse des produits par gamme selon la taille
  function libellePastilleCr(nomGamme, prod, totalFiches) {
    var nom = String(nomGamme || '').replace(/\s*\(.*\)$/, '').trim();
    var p = String(prod || '').trim();
    if (p === nom) return nom;
    if (p.indexOf(nom + ' ') === 0) {
      var court = p.slice(nom.length + 1);
      if (/^\d+$/.test(court)) court += ' mg';
      return court;
    }
    if (totalFiches === 1) return p;
    return p;
  }
  function taillePastille(court) {
    var len = (court || '').length;
    if (len <= 4) return 'court';
    if (len <= 7) return 'moyen';
    return 'long';
  }
  function rangDeclinaisonProduit(prod, nomGamme) {
    var p = normaliser(prod);
    if (p === 'zyltan' || p === 'zyltan 50' || p === 'zyltan 50 mg') return 0;
    if (p === 'zyltan am' || p === 'zyltan am 50') return 1;
    if (p === 'zyltan h' || p === 'zyltan h 50') return 2;
    if (p === 'losartan am') return 3;
    if (p === 'lesstrol 10' || p === 'lestrol 10' || p === 'lesstrol 10 mg') return 0;
    if (p === 'lesstrol' || p === 'lesstrol 20' || p === 'lestrol 20' || p === 'lesstrol 20 mg') return 1;
    if (p === 'lesstrol am' || p === 'lestrol am') return 2;
    if (p === 'lesstrol ez' || p === 'lestrol ez') return 3;
    if (p === 'tensicard' || p === 'tensicard 50' || p === 'tensicard 50 mg') return 0;
    if (p === 'tensicard am' || p === 'tensicard am 50') return 1;
    if (/eurithmic|eurythmic/.test(p)) return 0;
    return 10;
  }
  function harmoniserDeclinaisons(fiches, nomGamme) {
    if (!fiches || !fiches.length) return [];
    var nom = String(nomGamme || '').replace(/\s*\(.*\)$/, '').trim();
    return fiches.slice().sort(function (a, b) {
      var rA = rangDeclinaisonProduit(a.produit, nom);
      var rB = rangDeclinaisonProduit(b.produit, nom);
      if (rA !== rB) return rA - rB;
      var cA = libellePastilleCr(nom, a.produit, fiches.length);
      var cB = libellePastilleCr(nom, b.produit, fiches.length);
      return (cA.length - cB.length) || String(a.produit || '').localeCompare(String(b.produit || ''), 'fr');
    });
  }
  function harmoniserDeclinaisonsAncien(fiches, nomGamme) {
    if (!fiches || fiches.length <= 2) return fiches || [];
    var nom = String(nomGamme || '').replace(/\s*\(.*\)$/, '').trim();
    var items = fiches.map(function (f) {
      var c = libellePastilleCr(nom, f.produit, fiches.length);
      var estBase = (f.produit === nom);
      return { f: f, court: c, len: c.length, estBase: estBase };
    });
    // Pour 4 déclinaisons (ex: Zyltan : Zyltan, H, AM, Losartan AM)
    if (items.length === 4) {
      var baseIdx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].estBase) { baseIdx = i; break; }
      }
      if (baseIdx >= 0) {
        var baseItem = items.splice(baseIdx, 1)[0];
        items.sort(function (a, b) { return a.len - b.len; });
        return [baseItem.f, items[0].f, items[1].f, items[2].f];
      }
      items.sort(function (a, b) { return a.len - b.len; });
      return [items[0].f, items[1].f, items[2].f, items[3].f];
    }
    items.sort(function (a, b) {
      if (a.estBase !== b.estBase) return a.estBase ? -1 : 1;
      return a.len - b.len;
    });
    return items.map(function (x) { return x.f; });
  }

  function rendreChoixProduitsCr(a, cle, vals) {
    var inactifs = {};
    var lFiches = (S.data && S.data.fiches) || [];
    lFiches.forEach(function (f) {
      if (!estProduitActif(f)) inactifs[normaliser(f.produit)] = true;
    });

    var brut = (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT;
    brut = brut.filter(function (p) { return !inactifs[normaliser(p)]; });
    var autorises = {};
    brut.forEach(function (p) { autorises[normaliser(p)] = true; });

    var fichesToutes = (typeof fichesProduits === 'function' ? fichesProduits() : FICHES_PRODUITS_DEFAUT) || [];
    // 3.25.40 : Seuls les produits listés dans Listes!K sont affichés dans le CR visite
    var fiches = fichesToutes.filter(function (f) { return autorises[normaliser(f.produit)] && !inactifs[normaliser(f.produit)]; });
    if (!fiches.length) fiches = fichesToutes.filter(function (f) { return !inactifs[normaliser(f.produit)]; });
    var gammes = typeof gammesProduits === 'function' ? gammesProduits(fiches) : [];
    var sel = vals || [];

    // Séparation stricte Gamme A vs Gamme B
    var famsA = gammes.filter(function (g) { return estGammeA('', g.nom); }).sort(function (a, b) { return rangFamilleGammeA('', a.nom) - rangFamilleGammeA('', b.nom); });
    var famsB = gammes.filter(function (g) { return !estGammeA('', g.nom); });

    var prodsA = [], prodsB = [];
    famsA.forEach(function (g) { g.fiches.forEach(function (f) { prodsA.push(f.produit); }); });
    famsB.forEach(function (g) { g.fiches.forEach(function (f) { prodsB.push(f.produit); }); });

    var nbSelA = prodsA.filter(function (p) { return sel.indexOf(p) >= 0; }).length;
    var nbSelB = prodsB.filter(function (p) { return sel.indexOf(p) >= 0; }).length;

    // 3.25.37 : Gamme A toujours visible directement ; seule la Gamme B est repliée par défaut sur une seule ligne
    var bOuvert = !!S.ui.gammeBOuverte;
    var tousA = prodsA.length > 0 && prodsA.every(function (p) { return sel.indexOf(p) >= 0; });
    var tousB = prodsB.length > 0 && prodsB.every(function (p) { return sel.indexOf(p) >= 0; });

    var h = '<div class="choix-produits-cr">';
    h += '<div class="gamme-cr-actions" style="margin-bottom:8px">' +
      '<span class="discret">' + (sel.length ? '<b>' + sel.length + ' sélectionné' + (sel.length > 1 ? 's' : '') + '</b> : ' + esc(sel.join(', ')) : 'Touchez un produit pour le sélectionner') + '</span>' +
      (sel.length ? '<span><button type="button" class="lien-action" data-a="crProduitsAucun" data-uid="' + a.uid + '" data-k="' + cle + '">Tout effacer</button></span>' : '') +
      '</div>';

    // 1) Gamme A : directement affichée, entête compacte sans repli
    h += '<div class="gamme-cr-bloc ouverte" style="margin-bottom:6px">' +
      '<div class="gamme-cr-entete gamme-compacte">' +
        '<span><b>Gamme Aura 2</b>' + (nbSelA ? ' <i class="compteur">' + nbSelA + '</i>' : '') + '</span>' +
        (prodsA.length > 1 ? '<button type="button" class="lien-action" data-a="crGammeTous" data-uid="' + a.uid + '" data-k="' + cle + '" data-g="A">' + (tousA ? 'Tout décocher' : 'Tous') + '</button>' : '') +
      '</div>' +
      '<div class="liste-gammes-cr">';
    famsA.forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '').trim();
      var mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
      var fichesTriees = harmoniserDeclinaisons(g.fiches, nom);
      var seul = fichesTriees.length === 1;

      h += '<div class="ligne-gamme">' +
        '<div class="lg-tete">' +
          '<b>' + esc(nom) + '</b>' +
        '</div>' +
        '<div class="lg-produits' + (seul ? ' seul' : '') + '">' +
        fichesTriees.map(function (f) {
          var court = libellePastilleCr(nom, f.produit, g.fiches.length);
          var estSel = sel.indexOf(f.produit) >= 0;
          var tClass = taillePastille(court);
          return '<button type="button" class="pastille-produit ' + tClass + '" data-a="crMulti" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(f.produit) + '" aria-pressed="' + estSel + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
        }).join('') +
        '</div></div>';
    });
    h += '</div></div>';

    // 2) Gamme B : seule à être fermée par défaut, compacte sur la même ligne (gain d'espace)
    h += '<div class="gamme-cr-bloc' + (bOuvert ? ' ouverte' : ' repliee') + '" style="margin-bottom:8px">' +
      '<div class="gamme-cr-entete gamme-compacte">' +
        '<button type="button" class="gamme-cr-bascule" data-a="crGammeBascule" data-g="B" aria-expanded="' + bOuvert + '">' +
          '<span><b>Gamme Aura 1</b></span>' +
          '<span class="gamme-cr-meta">' + (nbSelB ? '<i class="compteur">' + nbSelB + '</i>' : '<small>' + famsB.length + ' fam.</small>') + icone('chevron') + '</span>' +
        '</button>' +
        (bOuvert && prodsB.length > 1 ? '<button type="button" class="lien-action" data-a="crGammeTous" data-uid="' + a.uid + '" data-k="' + cle + '" data-g="B">' + (tousB ? 'Décocher B' : 'Tous') + '</button>' : '') +
      '</div>';

    if (bOuvert) {
      h += '<div class="liste-gammes-cr">';
      famsB.forEach(function (g) {
        var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '').trim();
        var mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
        var fichesTriees = harmoniserDeclinaisons(g.fiches, nom);
        var seul = fichesTriees.length === 1;

        h += '<div class="ligne-gamme">' +
          '<div class="lg-tete">' +
            '<b>' + esc(nom) + '</b>' +
          '</div>' +
          '<div class="lg-produits' + (seul ? ' seul' : '') + '">' +
          fichesTriees.map(function (f) {
            var court = libellePastilleCr(nom, f.produit, g.fiches.length);
            var estSel = sel.indexOf(f.produit) >= 0;
            var tClass = taillePastille(court);
            return '<button type="button" class="pastille-produit ' + tClass + '" data-a="crMulti" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(f.produit) + '" aria-pressed="' + estSel + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
          }).join('') +
          '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';

    h += '</div>';
    return h;
  }
  function ouiNonCr(a, cle, val) { return choixCr(a, cle, [['oui', 'Oui'], ['non', 'Non']], val); }
  function ouiNonCrAncien(a, cle, val) { return '<div class="statuts deux">' + [['oui', 'Oui'], ['non', 'Non']].map(function (o) {
    return '<button type="button" class="statut' + (o[0] === 'non' ? ' ko' : '') + '" data-a="crChoix" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + o[0] + '" aria-pressed="' + (val === o[0]) + '">' + o[1] + '</button>';
  }).join('') + '</div>'; }
  function texteCr(a, cle, val, ph, zone) {
    return zone ? '<textarea data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" placeholder="' + esc(ph) + '">' + esc(val || '') + '</textarea>'
      : '<input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" value="' + esc(val || '') + '" placeholder="' + esc(ph) + '">';
  }
  function qteCr(a, cle, val) { return '<input type="number" min="0" inputmode="numeric" class="qte" data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" value="' + esc(val || '') + '" placeholder="0" aria-label="Quantité">'; }
  // choix unique en puces (remplace les listes déroulantes du compte rendu) : touchez de nouveau pour annuler
  function pucesValCr(a, cle, options, val, libs, classe) {
    return '<div class="puces' + (classe ? ' ' + classe : '') + '">' + options.map(function (o) {
      return '<button type="button" class="puce" data-a="crVal" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(o) + '" aria-pressed="' + ((val || '') === o) + '">' + esc((libs && libs[o]) || o) + '</button>';
    }).join('') + '</div>';
  }
  function selectCr(a, cle, options, val, vide) {
    return '<select data-f="crSelect" data-uid="' + a.uid + '" data-k="' + cle + '">' + (vide !== undefined ? '<option value="">' + esc(vide) + '</option>' : '') +
      options.map(function (o) { return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
  }
  function etapeCr(titre, contenu, aide) { return '<div class="champ etape-cr-bloc"><span>' + titre + '</span>' + contenu + (aide ? '<span class="aide-champ">' + aide + '</span>' : '') + '</div>'; }
  function tableQ(a, prefixe, produits, valeurs) {
    return '<div class="grille-2 champs-cr">' + produits.map(function (p) {
      return '<label class="champ"><span>' + esc(p) + '</span>' + qteCr(a, prefixe + '.' + p, (valeurs || {})[p]) + '</label>';
    }).join('') + '</div>';
  }

  // ------------------------------------------------------------------ Compte Rendu pas à pas (3.6.0)
  // Une question à la fois : la suivante apparaît selon la réponse. Les réponses données restent en lignes courtes
  // (touchez pour modifier : les questions suivantes sont reposées). Étapes facultatives : Continuer ou Passer.
  function etapesCr(a) {
    var c = crDe(a), ph = estPharmacie(a), im = implicite(a, c), cat = produitsRef(), l = [];
    function e(id, titre, type, rendu, resume, ok) { l.push({ id: id, titre: titre, type: type, rendu: rendu, resume: resume, valide: ok }); }
    var oui = function (v) { return v === 'oui' ? 'Oui' : (v === 'non' ? 'Non' : ''); };
    e('faite', 'La visite a-t-elle été faite ?', 'auto', function () { return ouiNonCr(a, 'faite', c.faite || 'oui'); }, function () { return oui(c.faite); });
    if (!c.faite) return l;
    if (c.faite === 'non') {
      e('motif', 'Motif', 'auto', function () { return choixCr(a, 'motif', motifsPour(a), c.motif); }, function () { return c.motif; });
      e('precision', 'Précision', 'facultatif', function () { return texteCr(a, 'precision', c.precision, ph ? 'Ex. pharmacien en congé' : 'Ex. en bloc opératoire', true); },
        function () { return c.precision || 'aucune'; });
      e('remplacant', 'Remplacer à proximité ?', 'auto', function () {
        return '<div class="segment" role="group" style="margin:8px 0 0">' +
          '<button type="button" data-a="crActionRemplacer" data-uid="' + a.uid + '">' + icone('carte') + ' Remplacer</button>' +
          '<button type="button" data-a="crChoix" data-uid="' + a.uid + '" data-k="remplacant" data-v="non" aria-pressed="' + (c.remplacant === 'non') + '">Non</button>' +
          '</div>';
      }, function () { return c.remplacant === 'oui' ? 'Remplacer' : (c.remplacant === 'non' ? 'Non' : ''); });
      if (c.remplacant === 'oui') { l.push({ id: '__remplacer', fin: 'remplacer' }); return l; }
      etapesSuite(a, c, SUITES.nonFaite, e);
      return l;
    }
    if (!ph) {
      e('types', 'Type(s) de visite médicale', 'continuer', function () { return rendreChoixTypesCr(a, c.types); }, function () { return (c.types || []).join(', '); },
        function () { return (c.types || []).length ? '' : 'choisissez au moins un type de visite médicale'; });
      // 3.28.45 : tous les produits sont présentés à chaque visite : ni question, ni choix, ni réaction par produit ;
      // seuls les échantillons remis se renseignent (quantités parmi tous les produits)
      c.presentes = ''; c.produits = []; c.reactions = {};
      if (!im.echant && !c.echant) c.echant = 'non';
      if (!im.echant) e('echant', 'Échantillons remis ?', 'auto', function () { return choixCr(a, 'echant', [['oui', 'Oui'], ['non', 'Non']], c.echant || 'non'); }, function () { return oui(c.echant); });
      if (c.echant === 'oui' || im.echant) e('echQ', 'Échantillons remis (quantités)', 'continuer', function () { return tableQ(a, 'echQ', cat, c.echQ); }, function () { return listeQ(c.echQ) || 'aucune quantité'; });
      e('bilan', 'Bilan', 'facultatif', function () { return texteCr(a, 'bilan', c.bilan, 'Besoins, objections, engagements, autres activités…', true); }, function () { return c.bilan || 'aucun'; });
      etapesSuite(a, c, SUITES.medecin, e);
      return l;
    }
    e('interlocuteur', 'Interlocuteur', 'auto', function () { return choixCr(a, 'interlocuteur', INTERLOCUTEURS, c.interlocuteur); }, function () { return c.interlocuteur; });
    e('types', 'Activité(s) en pharmacie', 'continuer', function () { return rendreChoixTypesCr(a, c.types); }, function () { return (c.types || []).join(', '); },
      function () { return (c.types || []).length ? '' : 'choisissez au moins une activité en pharmacie'; });
    if (!im.stocks) e('stocksVerif', 'Stocks vérifiés ?', 'auto', function () { return choixCr(a, 'stocksVerif', [['oui', 'Oui'], ['non', 'Non']], c.stocksVerif); }, function () { return oui(c.stocksVerif); });
    if (c.stocksVerif === 'oui' || im.stocks) {
      e('produitsStock', 'Produits vérifiés en stock', 'continuer', function () {
        return rendreChoixProduitsCr(a, 'produitsStock', c.produitsStock || []);
      }, function () {
        var prods = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : [];
        return prods.join(', ') || 'aucun';
      }, function () {
        var prods = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : [];
        return prods.length ? '' : 'sélectionnez au moins un produit à vérifier';
      });
      e('stocks', 'Stock par produit', 'continuer', function () {
        var prods = (c.produitsStock && Array.isArray(c.produitsStock)) ? c.produitsStock.slice() : [];
        if (c.stocks) {
          Object.keys(c.stocks).forEach(function (k) {
            if (prods.indexOf(k) < 0) delete c.stocks[k];
          });
        }
        if (!prods.length) return '<p class="discret">Aucun produit sélectionné à l\'étape 4.</p>';
        return '<div class="champs-cr">' + prods.map(function (p) {
          var s = c.stocks[p] || (c.stocks[p] = { etat: 'Disponible' });
          return '<div class="ligne-stock"><b>' + esc(p) + '</b><div class="champ"><span>État</span>' + pucesValCr(a, 'stocks.' + p + '.etat', ETATS_STOCK, s.etat, null, 'puces-etats-stock') + '</div>' +
            (s.etat === 'Disponible' || s.etat === 'En stock' || s.etat === 'Stock faible' ? '<div class="champ"><span>Anomalie</span>' + pucesValCr(a, 'stocks.' + p + '.anomalie', ['', 'Périmé', 'Proche péremption'], s.anomalie || '', { '': 'Aucune' }) + '</div>' +
              (s.anomalie ? '<label class="champ"><span>N° de lot</span><input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="stocks.' + p + '.lot" value="' + esc(s.lot || '') + '" placeholder="N° de lot"></label>' : '') : '') + '</div>';
        }).join('') + '</div>';
      }, function () { var r = champsCr(a).stocks; return r || 'aucun produit renseigné'; });
    }
    // 3.27.15 : « Non » par défaut ; « Oui » ouvre le choix des produits (facultatif)
    if (!im.commande && !c.commande) c.commande = 'non';
    if (!im.commande) e('commande', 'Commande passée ?', 'auto', function () { return choixCr(a, 'commande', [['oui', 'Oui'], ['non', 'Non']], c.commande); }, function () { return oui(c.commande); });
    if (c.commande === 'oui' || im.commande) e('besoin', 'Besoin de réapprovisionnement', 'facultatif', function () { return rendreChoixProduitsCr(a, 'besoin', c.besoin) + texteCr(a, 'besoinTexte', c.besoinTexte, 'Autres besoins'); },
      function () { var b = (c.besoin || []).concat(c.besoinTexte ? [c.besoinTexte] : []); return b.length ? b.join(', ') : 'aucun'; });
    var t = c.types || [];
    // 3.26.51 : seuls les produits cochés plus tôt (vérifiés en stock) sont proposés ensuite, sinon tout le catalogue
    var catCoches = (c.produitsStock && c.produitsStock.length) ? c.produitsStock.slice() : cat;
    if (t.indexOf('Échantillons') >= 0) e('echQ', 'Échantillons (quantités)', 'continuer', function () { return tableQ(a, 'echQ', catCoches, c.echQ); }, function () { return listeQ(c.echQ) || 'aucune quantité'; });
    if (t.indexOf('Retour') >= 0 || t.indexOf('Retour ou échange') >= 0) e('retour', 'Retour', 'continuer', function () { return tableQ(a, 'retourQ', catCoches, c.retourQ) + texteCr(a, 'retourMotif', c.retourMotif, 'Motif du retour'); },
      function () { return (listeQ(c.retourQ) || 'aucune quantité') + (c.retourMotif ? ' (' + c.retourMotif + ')' : ''); });
    var act = t.filter(function (x) { return ['MEP', 'PLV', 'Formation', 'Animation'].indexOf(x) >= 0; });
    if (act.length) e('action', act.join(', ') + ' : action et produits', 'continuer', function () { return texteCr(a, 'action', c.action, 'Ex. présentoir installé, équipe formée sur Rozukaa') + rendreChoixProduitsCr(a, 'actionProduits', c.actionProduits); },
      function () { return [c.action].concat(c.actionProduits || []).filter(Boolean).join(', ') || 'non précisé'; });
    e('commentaire', 'Commentaire', 'facultatif', function () { return texteCr(a, 'commentaire', c.commentaire, 'Demande du pharmacien, concurrence, prix…', true); }, function () { return c.commentaire || 'aucun'; });
    etapesSuite(a, c, SUITES.pharmacie, e);
    return l;
  }
  function etapesSuite(a, c, options, e) {
    var valSuite = c.suite || 'aucune';
    var lib = function (v) { return ((options.filter(function (o) { return o[0] === v; })[0]) || [])[1] || 'Aucune'; };
    e('suite', 'Étape suivante', 'auto', function () {
      return choixCr(a, 'suite', options, valSuite, 'puces-suite-cr') +
        (valSuite === 'aucune' ? '<div class="rangee cr-boutons" style="margin-top:10px"><button class="bouton bouton-plein" type="button" data-a="crOk" data-uid="' + a.uid + '" data-v="suite">Terminer</button></div>' : '');
    }, function () { return lib(valSuite); });
    if (!c.suite || c.suite === 'aucune') return;
    e('suiteType', 'Rappel ou RDV confirmé ?', 'auto', function () { return choixCr(a, 'suiteType', [['rappel', 'Rappel'], ['rdv', 'RDV confirmé']], c.suiteType); },
      function () { return c.suiteType === 'rdv' ? 'RDV confirmé' : 'Rappel'; });
    e('date', 'Prochaine étape le', 'auto', function () {
      return '<div class="rangee-prochaine">' + [1, 7, 14, 30].map(function (n) {
        var d = ajouterJours(a.date, n);
        var lib = n === 1 ? '+1 j' : '+' + n + ' j';
        var sous = n === 1 ? 'Demain' : (n === 7 ? '1 sem.' : (n === 14 ? '2 sem.' : '1 mois'));
        return '<button type="button" class="puce puce-prochaine" data-a="crDate" data-uid="' + a.uid + '" data-v="' + d + '" aria-pressed="' + (c.date === d) + '">' +
          '<b>' + lib + '</b><small>' + sous + '</small></button>';
      }).join('') + '</div><label class="champ" style="margin:10px 0 0"><span>Ou une date précise</span><input type="date" data-f="crSelect" data-uid="' + a.uid + '" data-k="date" value="' + esc(c.date || '') + '" aria-label="Date de la prochaine étape"></label>' +
        '<span class="aide-champ">' + (c.suiteType === 'rappel' ? 'Rappel : il s\'affiche ce jour-là dans « Journée », sans modifier la tournée.' :
          'RDV confirmé : ' + (estPharmacie(a) ? 'la pharmacie est placée' : 'le praticien est placé') + ' d\'office ce jour-là dans vos tournées.') + '</span>';
    }, function () { return c.date ? majuscule(dateLongue(c.date)) : ''; });
  }
  // libellés courts des réponses repliées (comme Planifier : « Période  Journée du… »)
  var TITRES_COURTS = { 'Type(s) de visite médicale': 'Types', 'Activité(s) en pharmacie': 'Activités', 'La visite a-t-elle été faite ?': 'Visite faite', 'Trouver un remplaçant à proximité ?': 'Remplaçant', 'Type(s) de visite': 'Types',
    'Activité(s)': 'Types', 'Produits présentés ?': 'Présentés', 'Produits présentés': 'Produits', 'Réaction du médecin': 'Réaction',
    'Échantillons remis ?': 'Échantillons', 'Échantillons remis (quantités)': 'Échantillons', 'Échantillons (quantités)': 'Échantillons',
    'Étape suivante': 'Suite', 'Rappel ou RDV confirmé ?': 'Rappel / RDV', 'Prochaine étape le': 'Date', 'Stocks vérifiés ?': 'Stocks', 'Stock par produit': 'Détails stock',
    'Produits vérifiés en stock': 'Produits', 'Retour': 'Retour', 'Retour ou échange': 'Retour',
    'Commande passée ?': 'Commande', 'Commande (quantités)': 'Quantités', 'Besoin de réapprovisionnement': 'Besoin' };
  function titreCourt(t) { return TITRES_COURTS[t] || t; }
  // 3.25.43 : Formulaire Express en un seul écran pour les visites rapides
  function rendreCompteRenduExpress(a) {
    var c = crDe(a);
    if (!c.statut) c.statut = c.faite === 'non' && c.motif ? c.motif : 'Visite faite';
    appliquerStatutExpress(c); syncCr(a);
    var estFait = Moteur.estVisite(c.statut, statuts());
    var ph = estPharmacie(a);

    var h = '<div class="cr-express-bloc">' +
      '<div class="tete-bloc tete-cr" style="display:flex;justify-content:space-between;align-items:center">' +
      '<div><h3 style="margin:0;display:inline-block">Compte Rendu Express</h3> <span class="pastille-version" style="font-size:11px;background:var(--bleu-pale);color:var(--primaire);padding:2px 6px;border-radius:4px;font-weight:700">1 écran</span></div>' +
      '<button type="button" class="bouton-texte" data-a="basculerModeComplet" data-uid="' + a.uid + '" style="font-size:12px;padding:2px 0">Formulaire complet →</button>' +
      '</div>';

    // 1. Statut
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Statut de la visite</span>' +
      '<div class="puces" style="margin-top:4px">' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Visite faite" aria-pressed="' + (c.statut === 'Visite faite') + '">✓ Visite faite</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Absent" aria-pressed="' + (c.statut === 'Absent') + '">Absent</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Indisponible" aria-pressed="' + (c.statut === 'Indisponible') + '">Indisponible</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="RDV reporté" aria-pressed="' + (c.statut === 'RDV reporté') + '">Reporté</button>' +
      '</div></div>';

    if (!estFait) {
      h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
        '<span>Préciser le motif</span>' +
        '<select data-f="crSelect" data-uid="' + a.uid + '" data-k="statut">' +
        statuts().filter(function (s) { return !s.visite; }).map(function (s) {
          return '<option' + (s.nom === c.statut ? ' selected' : '') + '>' + esc(s.nom) + '</option>';
        }).join('') + '</select></div>';
      h += '<div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer la visite non réalisée</button>' +
        (a.hors ? '' : '<button class="bouton bouton-large" type="button" data-a="crRemplacer" data-uid="' + a.uid + '">' + icone('cible') + 'Enregistrer et remplacer dans la tournée</button>') +
        '</div>';
      return h + '</div>';
    }

    // 2. Types de visite / Activités
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      rendreChoixTypesCr(a, c.types) +
      '</div>';

    // 3.28.45 : plus de choix des produits présentés : tous les produits sont présentés à chaque visite

    // 4. Prochaine étape
    var optProchaine = [
      ['', 'Aucune'],
      ['+1', 'Demain'],
      ['+7', '+7 j'],
      ['+14', '+14 j'],
      ['+30', '+30 j']
    ];
    var valP = c.prochaine;

    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Prochain contact / RDV</span>' +
      '<div class="puces" style="margin-top:4px">' +
      optProchaine.map(function (op) {
        var d = op[0] ? ajouterJours(aujourdhui(), parseInt(op[0], 10)) : '';
        var actif = (op[0] === '' && !valP) || (op[0] && valP === d);
        return '<button type="button" class="puce" data-a="crEtapeRapide" data-uid="' + a.uid + '" data-v="' + d + '" aria-pressed="' + actif + '">' + op[1] + '</button>';
      }).join('') +
      '</div></div>';

    // 5. Bilan / Note rapide facultative
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Observation rapide <small class="discret">(facultatif)</small></span>' +
      '<input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="bilan" value="' + esc(c.bilan || '') + '" placeholder="Objections, engagements, besoins…">' +
      '</div>';

    // 6. Bouton de validation sous le pouce
    h += '<div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">' +
      '<button class="bouton bouton-plein" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer</button>' +
      '<div style="text-align:center"><button type="button" class="bouton-texte" data-a="basculerModeComplet" data-uid="' + a.uid + '">Formulaire complet</button></div>' +
      '</div>';

    return h + '</div>';
  }

  function rendreCompteRendu(a) {
    if (S.config.crExpress && !a.modeComplet) {
      return rendreCompteRenduExpress(a);
    }
    var c = crDe(a), ok = c.ok || (c.ok = {}), h = '<div class="cr-pas etapes-filtres"><div class="tete-bloc tete-cr" style="display:flex;justify-content:space-between;align-items:center"><h3>Compte Rendu</h3>' +
      (S.config.crExpress ? '<button type="button" class="bouton-texte" data-a="basculerModeExpress" data-uid="' + a.uid + '" style="font-size:12px">⚡ Mode express</button>' : '') +
      '</div>';
    var etapes = etapesCr(a);
    for (var i = 0; i < etapes.length; i++) {
      var s = etapes[i];
      if (s.fin === 'remplacer') {
        return h + '<div class="actions-cr" style="display:flex;flex-direction:column;gap:8px">' +
          '<button class="bouton bouton-plein" type="button" data-a="crRemplacer" data-uid="' + a.uid + '">' +
          icone('cible') + 'Remplacer dans la tournée</button>' +
          '<button class="bouton" type="button" data-a="validerUn" data-uid="' + a.uid + '">' +
          icone('valider') + 'Enregistrer sans remplacer</button>' +
          '</div></div>';
      }
      if (ok[s.id]) {
        h += '<button type="button" class="cr-fait" data-a="crEditer" data-uid="' + a.uid + '" data-v="' + s.id + '"><span>' + esc(titreCourt(s.titre)) + '</span><b>' + esc(s.resume()) + '</b>' + icone('crayon') + '</button>';
        continue;
      }
      // question en cours : la seule affichée
      var err = s.valide ? s.valide() : '';
      h += '<div class="cr-question"><span class="etape-titre">' + esc(s.titre) + ' <small>étape ' + (i + 1) + (s.type === 'facultatif' ? ', facultatif' : '') + '</small></span>' + s.rendu();
      if (s.type !== 'auto') {
        h += '<div class="rangee cr-boutons">' + (s.type === 'facultatif' ? '<button class="bouton" type="button" data-a="crPasser" data-uid="' + a.uid + '" data-v="' + s.id + '">Passer</button>' : '') +
          '<button class="bouton bouton-plein" type="button" data-a="crOk" data-uid="' + a.uid + '" data-v="' + s.id + '"' + (err ? ' disabled' : '') + '>Continuer</button></div>' +
          (err ? '<span class="aide-champ">Pour continuer : ' + esc(err) + '.</span>' : '');
      }
      return h + '</div></div>';
    }
    // toutes les questions sont répondues
    return h + '</div>' + boutonEnregistrer(a);
  }
  // réouvre une étape : elle et les suivantes sont reposées (les réponses restent pré-remplies)
  function editerEtape(a, id) {
    var c = crDe(a), l = etapesCr(a), i = l.map(function (s) { return s.id; }).indexOf(id);
    c.ok = c.ok || {};
    l.slice(Math.max(i, 0)).forEach(function (s) { delete c.ok[s.id]; });
    LS.set('plan', S.plan);
  }
  function validerEtape(a, id) { var c = crDe(a); c.ok = c.ok || {}; c.ok[id] = true; LS.set('plan', S.plan); }

  // 3.26.48 / 3.27.9 : compte rendu : les options se calent sous le dernier point touché (sans exception pour l'intitulé)
  function centrerQuestion(uid, pouceY) {
    setTimeout(function () {
      var c = document.querySelector('.arret.ouvert .cr-question') ||
              document.querySelector('.arret.ouvert .cr-express-bloc') ||
              document.querySelector('.arret.ouvert .actions-cr') ||
              document.querySelector('.arret.ouvert .rangee-actions-cr-valide') ||
              document.querySelector('.arret.ouvert');
      if (c) centrerElement(c, true, pouceY);
    }, 40);
  }
  function centrerQuestionRapport() {
    setTimeout(function () {
      var q = document.querySelector('.rapport-jour .cr-question') ||
              document.querySelector('.rapport-jour [data-a="rapValider"]') ||
              document.querySelector('.rapport-jour .rangee-actions-cr-valide') ||
              document.querySelector('.rapport-jour');
      if (q) centrerElement(q, false, S.ui.dernierClicY);
    }, 50);
  }
  function centrerChoix(el) {
    setTimeout(function () {
      var sel = '[data-a="' + el.dataset.a + '"][data-uid="' + el.dataset.uid + '"][data-k="' + (el.dataset.k || '') + '"][data-v="' + (el.dataset.v || '') + '"]';
      var b = null; try { b = document.querySelector(sel); } catch (e) {}
      var c = b || document.querySelector('.arret.ouvert .cr-question') || document.querySelector('.arret.ouvert');
      if (c) centrerElement(c, true, S.ui.dernierClicY);
    }, 40);
  }
  function boutonEnregistrer(a) {
    var m = manquesCr(a);
    return '<div class="actions-cr">' + (m.length ?
      '<button class="bouton" type="button" disabled>' + icone('valider') + 'Enregistrer</button><span class="aide-champ">Pour enregistrer : ' + esc(m.join(', ')) + '.</span>' :
      '<button class="bouton bouton-plein" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer</button>') + '</div>';
  }
  // une valeur par ligne : « Routine, Présentation produit » ou « A ; B » s'affichent l'un sous l'autre
  function parLigne(v) { return String(v || '').split(/\s*;\s*|\n+/).filter(Boolean).map(esc).join('<br>'); }
  function resumeCompteRendu(a, tuiles) {
    var r = champsCr(a), l = [];
    if (r.interlocuteur) l.push('Interlocuteur : ' + r.interlocuteur);
    if (r.activite) l.push('Type de visite : ' + listeActivites(r.activite).join(', '));
    if (r.produits && !estPharmacie(a)) l.push('Produits présentés : ' + r.produits);
    if (r.reactions) l.push('Réactions : ' + r.reactions);
    if (r.echantillons) l.push('Échantillons : ' + r.echantillons);
    if (r.stocks) l.push('Stocks : ' + r.stocks);
    if (r.commande) l.push('Commande : ' + r.commande);
    if (r.complements && !/^Échantillons/.test(r.complements)) l.push(r.complements);
    if (r.commentaire) l.push((crDe(a).faite === 'non' ? 'Précision : ' : 'Bilan : ') + r.commentaire);
    if (r.suite) l.push(r.suite + ' le ' + dateCourte(r.prochaine));
    // 3.25.10 : pharmacie : un produit par carte (état, quantité, anomalie), les uns après les autres
    var cartesStock = '';
    if (tuiles && estPharmacie(a) && r.stocks) {
      var cs = crDe(a), st = cs.stocks || {};
      l = l.map(function (x) { return x.indexOf('Stocks : ') === 0 ? '\u0000stocks' : x; });
      var prodsK = (cs.produitsStock && cs.produitsStock.length) ? cs.produitsStock : Object.keys(st);
      cartesStock = prodsK.filter(function (p) { return st[p] && st[p].etat; }).map(function (p) {
        var x = st[p];
        return '<div class="tuile statique"><small>' + esc(p) + '</small><b>' + esc(x.etat) + '</b>' +
          (x.qte ? '<span class="discret bloc-texte">Quantité : ' + esc(x.qte) + '</span>' : '') +
          (x.anomalie ? '<span class="discret bloc-texte">' + esc(x.anomalie) + (x.lot ? ', lot ' + esc(x.lot) : '') + '</span>' : '') + '</div>';
      }).join('') + (cs.autresStock ? '<div class="tuile statique large"><small>Autres produits</small><b>' + esc(cs.autresStock) + '</b></div>' : '');
    }
    if (tuiles) return '<div class="tuile statique"><small>Résultat</small><b>' + esc(a.statut || '') + '</b></div>' + l.map(function (x) {
      if (x === '\u0000stocks') return cartesStock;
      var i = x.indexOf(' : '), lab = i > 0 ? x.slice(0, i) : (r.suite && x.indexOf(r.suite) === 0 ? 'Suite' : 'Note'), val = i > 0 ? x.slice(i + 3) : x;
      return '<div class="tuile statique' + (val.length > 40 ? ' large' : '') + '"><small>' + esc(lab) + '</small><b>' + parLigne(val) + '</b></div>';
    }).join('');
    return l.map(function (x) { return '<p class="discret">' + esc(x) + '</p>'; }).join('');
  }
  // valeur d'un chemin « a.b.c » dans le compte rendu
  function majCr(a, cle, valeur, multi) {
    var c = crDe(a), p = cle.split('.'), o = c;
    // nom de produit pouvant contenir un point : le 2e élément est le produit, le reste le champ
    if (p.length > 2) p = [p[0], p.slice(1, p.length - 1).join('.'), p[p.length - 1]];
    else if (p.length === 2) p = [p[0], p[1]];
    for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== 'object') o[p[i]] = {}; o = o[p[i]]; }
    var k = p[p.length - 1];
    if (multi) { var l = Array.isArray(o[k]) ? o[k] : [], j = l.indexOf(valeur); if (j >= 0) l.splice(j, 1); else l.push(valeur); o[k] = l; }
    else o[k] = valeur;
    if (cle === 'faite' && valeur === 'oui') { c.motif = ''; c.remplacant = ''; }
    if (cle === 'presentes' && valeur === 'non') { c.produits = []; c.reactions = {}; c.echant = 'non'; c.echQ = {}; }
    if (cle === 'suite' && valeur === 'aucune') { c.suiteType = ''; c.date = ''; }
    if (cle === 'types') memoriserDerniersTypesCr(estPharmacie(a), c.types);
    if (cle === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
    if (cle === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
    syncCr(a); LS.set('plan', S.plan);
  }

  // Rappels du jour (et en retard) : suites « Rappel » de mes comptes rendus, sans visite depuis
  function rappelsDuJour() {
    var t = aujourdhui(), dernier = {}, l = [];
    (S.queue || []).concat((S.data && S.data.historique) || []).forEach(function (v) {
      if (v.delegue && !estMoi(v.delegue)) return;
      var d = String(v.date || '').slice(0, 10);
      if (!dernier[v.code] || d > dernier[v.code].d) dernier[v.code] = { d: d, v: v };
    });
    Object.keys(dernier).forEach(function (k) {
      var v = dernier[k].v, p = String(v.prochaine || '').slice(0, 10);
      if (/^Rappel/.test(v.suite || '') && p && p <= t) {
        // 3.27.14 : rappel traité (« Fait ») ou reporté depuis la carte : masqué
        var st = LS.get('rappelsTraites', {})[v.code + '|' + p];
        if (st && (st.fait || (st.jusqua && st.jusqua > t))) return;
        l.push({ v: v, date: p });
      }
    });
    return l.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  }
  function rendreRappels() {
    var l = rappelsDuJour();
    if (!l.length) return '';
    // 3.27.14 : une seule carte (même gabarit que « Compte Rendu ») ; un appui ouvre les actions : Appeler, Ajouter au jour, Demain, Fait
    var noms = l.map(function (x) { return x.v.nom; }), x0 = l[0];
    return '<button type="button" class="acces-rapport rappel-carte" data-a="ouvrirRappels"><span>' + icone('calendrier') +
      '<b>' + (l.length > 1 ? 'Rappels (' + l.length + ')' : 'Rappel · ' + esc(x0.v.nom)) + '</b><small>' +
      esc(l.length > 1 ? noms.join(', ') : String(x0.v.suite).replace(/^Rappel : /, '') + (x0.date < aujourdhui() ? ', prévu le ' + dateCourte(x0.date) : '')) +
      '</small></span>' + icone('chevron') + '</button>';
  }
  function feuilleRappels() {   // enregistrée dans FEUILLES plus bas (FEUILLES n'existe pas encore ici)
    var l = rappelsDuJour(), t = aujourdhui();
    if (!l.length) return '<p class="discret">Aucun rappel en attente.</p>';
    return '<ul class="liste-rappels-f">' + l.map(function (x) {
      var p = praticien(x.v.code) || {}, k = esc(x.v.code + '|' + x.date), num = normaliserNumero(p.telephone);
      var deja = S.plan.some(function (a) { return a.date === t && a.code === x.v.code; });
      return '<li><b>' + esc(x.v.nom) + '</b><span class="discret bloc-texte">' + esc(String(x.v.suite).replace(/^Rappel : /, '')) +
        (x.date < t ? ', prévu le ' + dateCourte(x.date) : '') + (p.telephone ? ' · ' + esc(p.telephone) : '') + '</span>' +
        '<div class="rappel-actions">' +
          (num ? '<a class="bouton petit rappel-appel" href="tel:+' + esc(num) + '" aria-label="Appeler" title="Appeler">' + icone('tel') + '</a>' : '') +
          (deja ? '<span class="etiquette ok">' + icone('valider') + 'Dans la journée</span>' : '<button type="button" class="bouton petit" data-a="rappelAjouter" data-v="' + esc(x.v.code) + '">' + icone('plus') + 'Ajouter au jour</button>') +
          '<button type="button" class="bouton petit" data-a="rappelTraiter" data-k="' + k + '" data-v="demain">Demain</button>' +
          '<button type="button" class="bouton petit bouton-plein" data-a="rappelTraiter" data-k="' + k + '" data-v="fait">' + icone('valider') + 'Fait</button>' +
        '</div></li>';
    }).join('') + '</ul><p class="discret" style="margin:8px 0 0">« Fait » retire le rappel ; « Demain » le reporte au jour ouvré suivant.</p>';
  }



  // jours passés : modifiables seulement si l'option cachée « Modifier les jours passés » (Réglages › Avancé) est activée
  function passeVerrouille(d) { return d < aujourdhui() && !S.config.modifPasse; }
  // jours à venir : aperçu seul, sauf option cachée Réglages › Avancé › « Saisir les jours à venir » (3.16.0)
  function futurVerrouille(d) { return d > aujourdhui() && !S.config.saisieFutur; }
  // état d'une visite en une ligne (carte fermée) : faite + produits, non faite + motif, à saisir, à venir
  function ligneEtat(a) {
    var t = aujourdhui(), now = minutesMaintenant(), hm = heureVersMinutes(a.heure);
    if (a.statut) {
      var ko = estKo(a.statut), pr = !ko && a.produits ? ' · ' + a.produits : '';
      return '<span class="ligne-etat ' + (ko ? 'ko' : 'ok') + '">' + (ko ? '✗ ' : '✓ ') + esc(statutLibelle(a)) + esc(pr) + (a.etat !== 'valide' ? ' · à enregistrer' : '') + '</span>';
    }
    if (a.date < t) return '<span class="ligne-etat alerte">! Compte Rendu à saisir</span>';
    if (a.date === t && hm !== null && hm < now) return '<span class="ligne-etat alerte">! Compte Rendu à saisir' + distanceMoi(a) + '</span>';
    var tag = a.impose ? (a.etape ? libelleRdv(a) : (a.rdv ? 'RDV ' + a.rdv : 'Prioritaire')) : '';
    return '<span class="ligne-etat">○ À venir' + (tag ? ' · ' + esc(tag) : '') + (a.date === t ? distanceMoi(a) : '') + '</span>';
  }
  // 3.23.2 : distance entre moi (GPS) et une visite du jour pas encore faite, pour choisir qui voir en priorité
  // 3.25.36 : distance entre moi (GPS) et une visite du jour pas encore faite avec durées à pied et en voiture
  function distanceMoi(a) {
    var pos = gpsFrais(), cp = pos ? coordPrecise(a) : null, c = cp || (pos ? coordArret(a) : null);
    if (!c || !pos) return '';
    var route = distanceVol(pos, c);
    var d = distMoi(route, !cp);
    var minPied = Math.max(1, Math.round(route * 15));
    var minVoit = Math.max(1, minutesTrajet(route * REGLAGES_MOTEUR.detourRoutier, '', a.commune || '', minutesMaintenant()));
    return '<span class="dist-moi' + (route < 0.5 ? ' tout-pres' : '') + '" role="img" aria-label="À ' + d + ' de vous, ' + formaterDureeTrajet(minPied) + ' à pied, ' + formaterDureeTrajet(minVoit) + ' en voiture">' +
      '<span class="dist-val" title="Distance">' + icone('cible') + d + '</span>' +
      '<span class="trajet-mode" title="À pied">' + icone('pieton') + formaterDureeTrajet(minPied) + '</span>' +
      '<span class="trajet-mode" title="En voiture">' + icone('voiture') + formaterDureeTrajet(minVoit) + '</span>' +
      '</span>';
  }
  // Carte d'une visite (Aujourd'hui) : contact d'abord, puis compte rendu en deux temps
  function rendreArret(a) {
    var ouvert = S.ui.ouvert === a.uid, verrou = a.etat === 'valide';
    var cls = 'arret' + (ouvert ? ' ouvert' : '') + (verrou ? ' verrouille' : '') + (a.garde ? ' garde' : '') +
      (a.statut ? (estKo(a.statut) ? (verrou ? ' absent' : ' absent-attente') : (verrou ? ' fait' : ' fait-attente')) : '') +   // plein = enregistré, vide de couleur = à enregistrer
      (S.ui.flashOk && S.ui.flashOk[a.uid] ? ' vient-enregistrer' : '');
    var e = '';
    e += badgeConv(a.conventionne);
    var pv = praticien(a.code) || {}, der = pv.derniere && (!a.derniere || pv.derniere > a.derniere) ? pv.derniere : a.derniere;
    var vu = vuDepuis(der, a.etat !== 'valide' && a.date > aujourdhui() ? a.date : aujourdhui());
    if (estPharmacie(a)) vu = vu.replace(/^Vu /, 'Visitée ').replace('Jamais visité', 'Jamais visitée');
    e += '<span class="etiquette">' + esc(vu) + '</span>';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? esc(libelleRdv(a)) : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut && !verrou) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(a)) + ', à enregistrer</span>';
    if (a.etat === 'ajoute') e += '<span class="etiquette">Ajouté</span>';
    if (a.etat === 'repris') e += '<span class="etiquette">Repris d\'un ancien programme</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.prochaine && a.prochaine <= a.date && !a.statut && !a.etape) e += '<span class="etiquette p1">RDV prévu le ' + dateCourte(a.prochaine) + '</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici (présent ' + esc(a.fiabTexte) + ')</span>';
    e += etiquetteCollegues(a.code, a.date);

    var h = '<li class="' + cls + '" data-p="' + (+a.note === 3 ? 1 : 3) + '" data-uid-arret="' + esc(a.uid) + '">' +
      '<div class="arret-heure"><b>' + esc((a.statut && a.valideA) || a.heure || (a.creneau ? a.creneau.slice(0, 5) : '--:--')) + '</b>' + (a.debut || a.fin ? '<small>' + esc(a.debut) + '-' + esc(a.fin) + '</small>' : '') + '</div>' +
      '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
      '<div><div class="arret-carte' + classeType(a) + '">' +
        '<button type="button" class="carte-bouton" data-a="ouvrir" data-uid="' + a.uid + '" aria-expanded="' + ouvert + '">' +
          '<span class="arret-nom">' + pastilleType(a) + lienFiche(a.code, esc(a.nom)) + ' ' + etoiles(a.note) + '</span>' +
          (ouvert ? (lieuEtSpec(a) ? '<span class="arret-lieu">' + specGras(a, lieuEtSpec(a)) + '</span>' : '') +
            '<span class="arret-lieu">' + esc([a.quartier, reperesDe(a), a.commune].filter(Boolean).join(', ')) + '</span>' +
            '<span class="etiquettes">' + e + '</span>' : (lieuQuartier(a) ? '<span class="arret-lieu">' + specGras(a, lieuQuartier(a)) + '</span>' : '') + ligneEtat(a)) +
        '</button>' +
        (!ouvert && !a.hors && !passeVerrouille(a.date) && a.statut && estKo(a.statut) && !futurVerrouille(a.date) ? '<button class="bouton petit remplacer-ligne" type="button" data-a="completerJour" data-uid="' + a.uid + '">' + icone('relancer') + 'Remplacer</button>' : '');
    if (ouvert) {
      var pa = praticien(a.code) || {};
      h += '<div class="arret-detail">' +
        actionsRapides({ telephone: pa.telephone, lat: a.lat, lon: a.lon, lieu: a.lieu, quartier: a.quartier, commune: a.commune });
      if (futurVerrouille(a.date) && !(a.statut && verrou)) {
        // 3.25.0 : jour à venir sans « Saisie avancée » : pas de compte rendu, la planification reste possible
        h += '<div class="bandeau" style="margin-top:10px"><p><b>Visite à venir.</b> Le compte rendu ne se saisit pas à l\'avance.</p></div>' +
          '<div class="rangee-actions bas-carte"><button class="bouton petit danger-doux" type="button" data-a="retirer" data-uid="' + a.uid + '">' + icone('fermer') + 'Retirer de la tournée</button>' +
          '<button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else if (passeVerrouille(a.date) && !(a.statut && verrou)) {
        h += '<div class="bandeau" style="margin-top:10px"><p><b>Jour passé.</b> La saisie des comptes rendus des jours passés est désactivée. ' +
          'Pour l\'activer : roue crantée › Avancé › « Saisie avancée ».</p></div>' +
          '<div class="rangee-actions bas-carte"><button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else if (!verrou) {
        h += rendreCompteRendu(a);
        var cf = conflitArret(a);
        h += a.hors ? '<div class="rangee-actions bas-carte"><button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>' :
          cf ? questionConflit(a, cf) : '<div class="rangee-actions bas-carte"><button class="bouton petit danger-doux" type="button" data-a="retirer" data-uid="' + a.uid + '">' + icone('fermer') + 'Retirer de la tournée</button>' +
          '<button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else {
        h += '<div class="cr-enregistre">' +
          '<div class="tuiles-resume">' + resumeCompteRendu(a, true) + '</div>' +
          '<div class="rangee-actions-cr-valide">' +
          '<button class="bouton bouton-plein" type="button" data-a="quitterCarte">' + icone('fermer') + '<span>Sortir</span></button>' +
          (passeVerrouille(a.date) ? '' : '<button class="bouton" type="button" data-a="corriger" data-uid="' + a.uid + '">' + icone('crayon') + 'Modifier</button>') +
          '</div></div>';
      }
      h += '</div>';
    }
    return h + '</div></div></li>';
  }

  // ------------------------------------------------------------------ Couverture géographique
  function rendreCouverture(datesPlan) {
    var portee = S.ui.couvPortee, dates = portee === 'jour' ? [S.ui.jour] : joursOuvres(lundiDe(S.ui.jour));
    var mes = S.plan.filter(function (a) { return dates.indexOf(a.date) >= 0; });
    var eq = arretsCollegues().filter(function (a) { return dates.indexOf(a.date) >= 0; });
    var cv = Moteur.couverture(ctx(), dates, mes, eq);
    var couv = cv.filter(function (c) { return c.moi > 0; }), non = cv.filter(function (c) { return c.moi === 0; });
    var ouverte = S.ui.couvOuverte;
    var h = '<section class="bloc couverture"><div class="couv-tete"><button type="button" class="groupe-bascule" data-a="couvOuvrir" aria-expanded="' + ouverte + '">' +
      '<b>Communes visitées</b><small>' + couv.length + '/' + cv.length + '</small>' + icone('chevron') + '</button>' +
      '<div class="segment petit" role="group" aria-label="Période">' +
        '<button type="button" data-a="couvPortee" data-v="jour" aria-pressed="' + (portee === 'jour') + '">Jour</button>' +
        '<button type="button" data-a="couvPortee" data-v="semaine" aria-pressed="' + (portee === 'semaine') + '" title="Semaine">Sem.</button></div></div>';
    if (!ouverte) return h + '</section>';
    h += '<div class="carte-l" id="carteCouv">' + carteCouverture(dates, mes, eq) + '</div>' +
      '<div class="legende"><span><i class="q-moi"></i>Mes visites' + (portee === 'jour' ? ' (dans l\'ordre)' : '') + '</span><span><i class="q-equipe"></i>Équipe</span><span><i class="q-vide"></i>Commune non visitée</span></div>';
    cartesAFaire.push({ id: 'carteCouv', route: portee === 'jour' ? mes : [], points: portee === 'jour' ? [] : mes, equipe: eq,
      nonCouvertes: non.map(function (c) { return c.commune; }) });
    h += segment('Filtre', 'couvFiltre', [['toutes', 'Toutes'], ['couvertes', 'Visitées · ' + couv.length], ['non', 'Non visitées · ' + non.length]], S.ui.couvFiltre);
    var liste = S.ui.couvFiltre === 'couvertes' ? couv : (S.ui.couvFiltre === 'non' ? non : cv);
    var autresCommunes = [], interieurCommunes = [];
    liste.forEach(function (c) {
      if (c.zone === 'Zone Intérieur' || (c.zone && c.zone.toLowerCase().indexOf('intérieur') >= 0)) {
        interieurCommunes.push(c);
      } else {
        autresCommunes.push(c);
      }
    });

    var zone = '';
    h += '<ul class="liste-couv">';
    autresCommunes.forEach(function (c) {
      if (c.zone !== zone) { zone = c.zone; h += '<li class="couv-zone">' + esc(zone) + '</li>'; }
      var eqNoms = Object.keys(c.equipe);
      h += '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
        '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
        (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non visitée') +
        (eqNoms.length ? ' ; équipe : ' + eqNoms.map(function (n) { return esc(n) + ' (' + c.equipe[n] + ')'; }).join(', ') : '') +
        '</span></div><span class="couv-dispo">' + c.dispo + ' dispo.' + (c.prioritaires ? '<small>' + c.prioritaires + ' ★★★ en retard</small>' : '') + '</span></li>';
    });

    if (interieurCommunes.length > 0) {
      var ouvInt = !!S.ui.couvInterieurOuverte;
      var nbVisInt = interieurCommunes.filter(function (x) { return x.moi > 0; }).length;
      h += '<li class="couv-zone couv-zone-interieur">' +
        '<button type="button" class="couv-zone-btn" data-a="couvInterieurToggle" aria-expanded="' + ouvInt + '">' +
        '<span>Zone Intérieur <small>(' + interieurCommunes.length + ' commune' + (interieurCommunes.length > 1 ? 's' : '') +
        (nbVisInt ? ' · ' + nbVisInt + ' visitée' + (nbVisInt > 1 ? 's' : '') : '') + ')</small></span>' +
        icone('chevron') +
        '</button></li>';
      if (ouvInt) {
        interieurCommunes.forEach(function (c) {
          var eqNoms = Object.keys(c.equipe);
          h += '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
            '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
            (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non visitée') +
            (eqNoms.length ? ' ; équipe : ' + eqNoms.map(function (n) { return esc(n) + ' (' + c.equipe[n] + ')'; }).join(', ') : '') +
            '</span></div><span class="couv-dispo">' + c.dispo + ' dispo.' + (c.prioritaires ? '<small>' + c.prioritaires + ' ★★★ en retard</small>' : '') + '</span></li>';
        });
      }
    }
    h += '</ul></section>';
    return h;
  }

  function carteCouverture(dates, mes, eq) {
    var qs = quartiers();
    if (!qs.length) return '';
    var minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    qs.forEach(function (q) { minLat = Math.min(minLat, q.lat); maxLat = Math.max(maxLat, q.lat); minLon = Math.min(minLon, q.lon); maxLon = Math.max(maxLon, q.lon); });
    var W = 360, H = Math.round(W * (maxLat - minLat) / (maxLon - minLon)) + 30, m = 18;
    function x(lon) { return m + (lon - minLon) / (maxLon - minLon) * (W - 2 * m); }
    function y(lat) { return m + (maxLat - lat) / (maxLat - minLat) * (H - 2 * m); }
    var parQ = {}, parQe = {};
    mes.forEach(function (a) { parQ[a.quartier] = (parQ[a.quartier] || 0) + 1; });
    eq.forEach(function (a) { parQe[a.quartier] = (parQe[a.quartier] || 0) + 1; });
    var centres = {};
    qs.forEach(function (q) { var c = centres[q.commune] = centres[q.commune] || { x: 0, y: 0, n: 0 }; c.x += x(q.lon); c.y += y(q.lat); c.n++; });
    var s = '<svg class="carte" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Carte de couverture des quartiers">';
    qs.forEach(function (q) {
      var n = parQ[q.quartier] || 0, ne = parQe[q.quartier] || 0;
      var cls = n ? 'q-moi' : (ne ? 'q-equipe' : 'q-vide');
      var r = n ? Math.min(4 + n * 1.6, 11) : (ne ? 4.5 : 3);
      s += '<circle class="' + cls + '" cx="' + x(q.lon).toFixed(1) + '" cy="' + y(q.lat).toFixed(1) + '" r="' + r.toFixed(1) + '"><title>' +
        esc(q.quartier + ', ' + q.commune + (n ? ' : ' + n + ' visite(s)' : '') + (ne ? ' ; équipe : ' + ne : '')) + '</title></circle>';
    });
    Object.keys(centres).forEach(function (k) {
      var c = centres[k];
      s += '<text x="' + (c.x / c.n).toFixed(1) + '" y="' + (c.y / c.n + 3).toFixed(1) + '">' + esc(k) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  // ------------------------------------------------------------------ Cartes (Leaflet, fond OpenStreetMap épuré)
  // Chargée à la demande ; sans réseau, le schéma simplifié reste affiché.
  var cartesAFaire = [], promesseLeaflet = null;
  function chargerLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (promesseLeaflet) return promesseLeaflet;
    promesseLeaflet = new Promise(function (ok, ko) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = LEAFLET_JS; js.onload = function () { ok(window.L); };
      js.onerror = function () { promesseLeaflet = null; ko(); }; document.head.appendChild(js);
    });
    return promesseLeaflet;
  }
  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  function couleur(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function themeSombre() { return document.documentElement.dataset.theme === 'sombre' || (!document.documentElement.dataset.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  function dessinerCartes() {
    var l = cartesAFaire.slice();
    if (!l.length || !navigator.onLine) return;
    chargerLeaflet().then(function (L) { l.forEach(function (c) { dessinerCarte(L, c); }); }, function () {});
  }
  function dessinerCarte(L, c) {
    var el = $(c.id); if (!el) return;
    el.innerHTML = ''; el.classList.add('active');
    var carte = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    // fond OpenStreetMap (sans clé), adouci en CSS pour un rendu épuré (inversé en thème sombre)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© contributeurs OpenStreetMap' }).addTo(carte);
    el.classList.toggle('sombre', themeSombre());
    var prim = couleur('--primaire'), bleu = couleur('--bleu'), gris = couleur('--gris-2'), limites = [];
    // communes non couvertes : repère discret au centre de la commune
    var centres = {};
    quartiers().forEach(function (q) { var x = centres[q.commune] = centres[q.commune] || { lat: 0, lon: 0, n: 0 }; x.lat += +q.lat; x.lon += +q.lon; x.n++; });
    (c.nonCouvertes || []).forEach(function (k) {
      var x = centres[k]; if (!x) return;
      L.circle([x.lat / x.n, x.lon / x.n], { radius: 900, color: gris, weight: 1, dashArray: '4 4', fillOpacity: 0.06 }).addTo(carte).bindTooltip(k + ' : non visitée');
    });
    (c.equipe || []).forEach(function (a) {
      var p = coordArret(a); if (!p) return;
      L.circleMarker([p.lat, p.lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: bleu, fillOpacity: 0.9 }).addTo(carte)
        .bindTooltip(esc(a.delegue || 'Équipe') + ' : ' + esc(a.nom));
      limites.push([p.lat, p.lon]);
    });
    var parQ = {};
    (c.points || []).forEach(function (a) {
      var p = coordArret(a); if (!p) return;
      var k = a.quartier || (p.lat + ',' + p.lon), x = parQ[k] = parQ[k] || { lat: p.lat, lon: p.lon, n: 0, lib: a.quartier };
      x.n++;
    });
    Object.keys(parQ).forEach(function (k) {
      var x = parQ[k];
      L.circleMarker([x.lat, x.lon], { radius: Math.min(6 + x.n * 2, 18), color: '#fff', weight: 2, fillColor: prim, fillOpacity: 0.85 }).addTo(carte)
        .bindTooltip(esc(x.lib) + ' : ' + x.n + ' visite' + (x.n > 1 ? 's' : ''));
      limites.push([x.lat, x.lon]);
    });
    var trace = [];
    (c.route || []).forEach(function (a, i) {
      var p = a.lat !== undefined && a.lat !== null && a.lat !== '' ? { lat: +a.lat, lon: +a.lon } : coordArret(a); if (!p) return;
      trace.push([p.lat, p.lon]); limites.push([p.lat, p.lon]);
      L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'pin', html: '<span>' + (i + 1) + '</span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(carte)
        .bindTooltip((heureVisite(a) ? heureVisite(a) + ' · ' : '') + esc(a.nom) + (a.lieu ? '<br>' + esc(a.lieu) : ''));
    });
    if (trace.length > 1) L.polyline(trace, { color: prim, weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(carte);
    if (limites.length) carte.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
    else carte.setView([5.345, -4.01], 11);
  }
  function coordArret(a) {
    var c0 = lireCoord(a); if (c0) return c0;
    var cr = a.idPresence && ctx().parCode[a.code] ? ctx().parCode[a.code].filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0] : null;
    if (cr && cr.coord) return cr.coord;
    var q = quartiers().filter(function (x) { return x.quartier === a.quartier; })[0];
    return q ? { lat: +q.lat, lon: +q.lon } : null;
  }

  // ------------------------------------------------------------------ Vue : produits (aide-mémoire du délégué)
  // Fiches de la feuille « Fiches produits » du Google Sheet (repli : fiches intégrées), regroupées par gamme.
  var ORDRE_AIRES = ['Hypertension artérielle', 'Hypertension et cœur', 'Cholestérol et risque cardiovasculaire', 'Troubles du rythme cardiaque', 'Angine de poitrine', 'Prévention de la thrombose', 'Métabolisme et neuropathie'];
  var SECTIONS_FICHE = [['indications', 'Indications', 'ind'], ['contreIndications', 'Contre-indications', 'ci'], ['posologie', 'Posologie', 'pos'],
    ['precautions', 'Précautions et interactions', 'pre'], ['effets', 'Effets indésirables', 'ei'], ['arguments', 'Arguments clés pour la visite', 'arg']];
  function deduireFicheProduit(nom, existantes) {
    nom = String(nom || '').trim();
    var kn = normaliser(nom);
    var parent = (existantes || []).filter(function (f) {
      var kf = normaliser(f.produit);
      return kn.indexOf(kf) === 0 || kf.indexOf(kn) === 0 || normaliser(f.gamme).indexOf(kn.split(' ')[0]) >= 0;
    })[0];

    if (parent) {
      return {
        gamme: parent.gamme,
        aire: parent.aire,
        produit: nom,
        dci: parent.dci || nom,
        classe: parent.classe || '',
        indications: parent.indications || '',
        contreIndications: parent.contreIndications || '',
        posologie: parent.posologie || '',
        precautions: parent.precautions || '',
        effetsIndesirables: parent.effetsIndesirables || '',
        arguments: parent.arguments || ''
      };
    }
    var gamme = nom, aire = 'Cardiologie & Métabolisme', classe = '';
    if (/zyltan|losartan/i.test(nom)) { gamme = 'Zyltan (losartan)'; aire = 'Hypertension artérielle'; classe = 'ARA II'; }
    else if (/lesstrol|lestrol/i.test(nom)) { gamme = 'Lesstrol (atorvastatine)'; aire = 'Cholestérol et risque cardiovasculaire'; classe = 'Statine'; }
    else if (/tensicard/i.test(nom)) { gamme = 'Tensicard (aténolol)'; aire = 'Hypertension artérielle'; classe = 'Bêtabloquant'; }
    else if (/eurythmic/i.test(nom)) { gamme = 'Eurythmic (amiodarone)'; aire = 'Troubles du rythme cardiaque'; classe = 'Antiarythmique'; }
    else if (/telmikaa/i.test(nom)) { gamme = 'Telmikaa (telmisartan)'; aire = 'Hypertension artérielle'; classe = 'ARA II'; }
    else if (/rozukaa/i.test(nom)) { gamme = 'Rozukaa (rosuvastatine)'; aire = 'Cholestérol et risque cardiovasculaire'; classe = 'Statine'; }
    else if (/antiplatt/i.test(nom)) { gamme = 'Antiplatt (clopidogrel)'; aire = 'Prévention de la thrombose'; classe = 'Antiagrégant plaquettaire'; }
    else if (/myonit/i.test(nom)) { gamme = 'Myonit (trinitrine)'; aire = 'Angine de poitrine'; classe = 'Dérivé nitré'; }

    return {
      gamme: gamme,
      aire: aire,
      produit: nom,
      dci: nom,
      classe: classe,
      indications: 'Indication officielle selon notice du produit',
      contreIndications: '',
      posologie: 'Selon prescription médicale',
      precautions: '',
      effetsIndesirables: '',
      arguments: ''
    };
  }
  function fichesProduits() {
    var l = (S.data && S.data.fiches) || [];
    var fichesToutes = (l.length ? l : FICHES_PRODUITS_DEFAUT).slice();
    var inactifs = {};
    fichesToutes.forEach(function (f) {
      if (!estProduitActif(f)) inactifs[normaliser(f.produit)] = true;
    });
    var fiches = fichesToutes.filter(function (f) {
      return !inactifs[normaliser(f.produit)];
    });
    var prodsListes = (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT;
    var vus = {};
    fiches.forEach(function (f) { vus[normaliser(f.produit)] = true; });
    prodsListes.forEach(function (p) {
      var kp = normaliser(p);
      if (l.length && !vus[kp]) return;   // 3.26.79 : base connectée : un produit sans fiche active n'est pas proposé
      if (!vus[kp] && !inactifs[kp]) {
        var nouv = deduireFicheProduit(p, fiches);
        fiches.push(nouv);
        vus[kp] = true;
      }
    });
    return fiches;
  }
  function lignesFiche(t) { return String(t || '').split(/\n|;\s*(?=[A-ZÉÈÀÂÎÔ])/).map(function (x) { return x.replace(/^[•\-\s]+/, '').trim(); }).filter(Boolean); }
  // Disposition compacte : une ligne par gamme (nom, molécule) avec ses produits en pastilles ; un filtre par aire thérapeutique.
  // La fiche ne s'ouvre qu'au toucher d'un produit, dans une fenêtre ; ses rubriques secondaires se déplient à la demande.
  var AIRES_COURTES = { 'Hypertension artérielle': 'Hypertension', 'Cholestérol et risque cardiovasculaire': 'Cholestérol', 'Troubles du rythme cardiaque': 'Rythme', 'Prévention de la thrombose': 'Antiagrégant', 'Angine de poitrine': 'Angor', 'Métabolisme et neuropathie': 'Métabolisme' };
  function gammesProduits(l) {
    var g = [];
    l.forEach(function (f) { var x = g.filter(function (y) { return y.nom === f.gamme; })[0]; if (!x) g.push(x = { nom: f.gamme, aire: f.aire, fiches: [] }); x.fiches.push(f); });
    return g.sort(function (a, b) { var i = ORDRE_AIRES.indexOf(a.aire), j = ORDRE_AIRES.indexOf(b.aire); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
  }
