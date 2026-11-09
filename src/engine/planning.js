  // ------------------------------------------------------------------ Actions sur la tournée
  function arret(uid) { return S.plan.filter(function (a) { return a.uid === uid; })[0] || (S.horsPlan || []).filter(function (a) { return a.uid === uid; })[0]; }

  function reordonner(date) {
    var autres = S.plan.filter(function (a) { return a.date !== date; }), duJour = S.plan.filter(function (a) { return a.date === date; });
    var g = S.ui.posGps && Date.now() - S.ui.posGps.t < 15 * 60000 ? S.ui.posGps : null, jour;
    // 3.25.8 : aujourd'hui, avec une position GPS récente : les visites faites restent, les autres s'enchaînent depuis ma position
    var apres = date === aujourdhui() ? minutesMaintenant() : 0;   // 3.27.13 : pas d'heure déjà passée pour une visite à faire
    if (date === aujourdhui() && g && duJour.some(function (a) { return !a.statut; })) {
      jour = duJour.filter(function (a) { return a.statut; }).concat(Moteur.ordonnerJour(duJour.filter(function (a) { return !a.statut; }), { lat: g.lat, lon: g.lon }, apres));
    } else jour = Moteur.ordonnerJour(duJour, departCoord(), apres);
    S.plan = autres.concat(jour).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    trierPlan();
  }
  function trierPlan() {
    var ordre = {};
    S.plan.forEach(function (a, i) { ordre[a.uid] = i; });
    S.plan.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return ordre[a.uid] - ordre[b.uid];
    });
  }

  // Premier arrivé, premier servi : les médecins qu'un collègue avait ciblés avant nous sont
  // remplacés automatiquement, sauf ceux épinglés, imposés ou déjà visités (simplement signalés).
  function resoudreConflits(conflits) {
    var touches = {}, dates = {}, codes = {};
    conflits.forEach(function (c) {
      codes[c.code] = true;
      S.plan.forEach(function (a) {
        if (a.code === c.code && a.date === c.date && !a.garde && !a.impose && a.etat !== 'valide' && !a.statut) {
          touches[a.uid] = true; dates[a.date] = true; S.rejetes[a.code] = true;
        }
      });
    });
    var d = Object.keys(dates).sort();
    if (!d.length) return 0;
    var p = S.params, reste = S.plan.filter(function (a) { return !touches[a.uid]; });
    var exclus = exclusCollegues(d);
    Object.keys(codes).forEach(function (c) { exclus[c] = true; });
    reste.forEach(function (a) { if (d.indexOf(a.date) < 0) exclus[a.code] = true; });
    var r = Moteur.genererPlanning(ctx(), {
      dates: d, communesPour: communesPour, maxJour: +p.maxJour || 8, delai: +p.delai || 0, exclus: exclus,
      rejetes: S.rejetes, conserves: reste.filter(function (a) { return d.indexOf(a.date) >= 0; }), imposes: [], depart: departCoord(),
      accepte: filtreCibles()
    });
    S.plan = reste.filter(function (a) { return d.indexOf(a.date) < 0; }).concat(r.arrets);
    trierPlan(); sauver();
    return Object.keys(touches).length;
  }

  function avantTirage() {
    if (!connecte() || !navigator.onLine) return Promise.resolve();
    toast('Vérification des tournées de l\'équipe…', 2000);
    return Promise.race([rafraichirEquipe(), new Promise(function (r) { setTimeout(r, 8000); })]);
  }

  // horsZone : réponse à la question sur les visites déjà prévues hors des communes choisies ('garder' | 'retirer')
  // 3.28.33 : moins de visites que demandé : on dit précisément pourquoi (praticiens présents ce jour dans les critères)
  function raisonsManque(d, n, maxJ, exclus) {
    var acc = filtreCibles(), ref = refusesActuels().codes, delai = +S.params.delai || 0, vus = {}, nb = { tous: 0, ref: 0, autres: 0, delai: 0 };
    (ctx().parJour[jourSemaineIndex(d)] || []).forEach(function (c) {
      if (vus[c.code] || !dansCommunesDu(c, d) || (acc && !acc(c.prat))) return;
      vus[c.code] = true; nb.tous++;
      if (ref[c.code]) nb.ref++;
      else if (exclus[c.code]) nb.autres++;
      else if (delai && joursEcoules(c.prat.derniere, d) < delai) nb.delai++;
    });
    var libre = nb.tous - nb.ref - nb.autres - nb.delai;
    var l = [nb.ref ? nb.ref + ' retiré' + (nb.ref > 1 ? 's' : '') + ' par la croix' : '', nb.autres ? nb.autres + ' déjà prévu' + (nb.autres > 1 ? 's' : '') + ' un autre jour ou par un collègue' : '', nb.delai ? nb.delai + ' vu' + (nb.delai > 1 ? 's' : '') + ' il y a moins de ' + delai + ' jours' : ''].filter(Boolean);
    return n + ' sur ' + maxJ + ' : ' + nb.tous + ' praticien' + (nb.tous > 1 ? 's' : '') + ' présent' + (nb.tous > 1 ? 's' : '') + ' ce jour dans vos critères' + (l.length ? ', dont ' + l.join(', ') : '') +
      (libre > n ? ' ; les autres ont des heures de présence qui ne s\'enchaînent pas sans retard.' : '.') + ' Élargissez les communes ou les spécialités pour en avoir ' + maxJ + '.';
  }
  function lancerTirage(portee, force, horsZone) {
    var p = S.params;
    if (p.mode === 'jour' && jourSemaineIndex(p.dateRef) > 4) { toast('Choisissez un jour de semaine.'); return; }
    if (p.mode === 'jour' && estFerie(p.dateRef)) { toast('Ce jour est férié. Choisissez un autre jour.'); return; }
    var feriesSemaine = p.mode === 'semaine' ? joursOuvres(lundiDe(p.dateRef)).filter(estFerie) : [];
    if (feriesSemaine.length) toast('Jour férié exclu de la semaine : ' + feriesSemaine.map(dateCourte).join(', ') + '.', 4000);
    var renseignees = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide' && !a.corrige; }).length;
    if (renseignees && !force) {
      confirmerPuis('Comptes rendus non enregistrés', renseignees + ' compte' + (renseignees > 1 ? 's' : '') + ' rendu' + (renseignees > 1 ? 's' : '') + ' non enregistré' + (renseignees > 1 ? 's' : '') + ' seront perdus. Continuer ?',
        'Continuer', function () { lancerTirage(portee, true); });
      return;
    }
    (horsZone ? Promise.resolve() : avantTirage()).then(function () {
      var periode = datesPeriode();
      var cible = portee === 'jour' ? [S.ui.jour] : periode;
      // 3.28.18 : visites déjà prévues hors des communes choisies pour leur jour : on demande avant de les garder
      if (!horsZone) {
        var dejaPrevues = portee === 'nouveau'
          ? cible.reduce(function (l, d) { return l.concat(donneesJour(d)); }, [])
          : S.plan.filter(function (a) { return cible.indexOf(a.date) >= 0 && (a.etat === 'valide' || a.corrige || a.garde); });
        var hors = dejaPrevues.filter(function (a) { return !(a.etat === 'valide' || a.corrige || a.statut) && !dansCommunesDu(a, a.date); });
        if (hors.length) {
          var noms = hors.slice(0, 6).map(function (a) { return a.nom + ' (' + (a.commune || a.lieu || '?') + ', ' + dateCourte(a.date) + ')'; }).join(', ') + (hors.length > 6 ? ' et ' + (hors.length - 6) + ' autre' + (hors.length > 7 ? 's' : '') : '');
          confirmerPuis('Visites hors des communes choisies',
            hors.length + ' visite' + (hors.length > 1 ? 's' : '') + ' déjà prévue' + (hors.length > 1 ? 's sont' : ' est') + ' hors des communes choisies : ' + noms + '. Les garder quand même dans la tournée ?',
            'Les garder', function () { lancerTirage(portee, true, 'garder'); }, function () { lancerTirage(portee, true, 'retirer'); });
          return;
        }
      }
      if (portee === 'jour') {
        var dTir = S.ui.jour;
        if (!S.ui.avantTirage || S.ui.avantTirage.date !== dTir || S.ui.aAccepter !== dTir) {
          S.ui.avantTirage = {
            date: dTir,
            arrets: JSON.parse(JSON.stringify(S.plan.filter(function (a) { return a.date === dTir; }))),
            jourEtat: S.jours[dTir] ? JSON.parse(JSON.stringify(S.jours[dTir])) : null,
            rejetes: JSON.parse(JSON.stringify(S.rejetes || {}))
          };
        }
      } else {
        S.ui.avantTirage = null;
      }
      // 3.28.18 : punaise décochée = simple proposition : écartée du tirage qui suit seulement (pour varier la liste),
      // elle peut revenir ensuite. La croix (refuser) l'écarte tant que les critères et filtres restent les mêmes.
      S.rejetes = {};
      if (portee === 'jour' || portee === 'semaine') {
        S.plan.forEach(function (a) {
          if (cible.indexOf(a.date) >= 0 && !a.garde && !a.impose && a.etat !== 'valide' && !a.corrige) S.rejetes[a.code] = true;
        });
      }
      var conserves = S.plan.filter(function (a) { return cible.indexOf(a.date) >= 0 && (a.etat === 'valide' || a.corrige || a.garde); });
      var heuresGardees = {};
      if (portee === 'nouveau') {
        // jours déjà planifiés : leurs visites restent (à leur heure), seuls les créneaux libres sont complétés
        conserves = [];
        cible.forEach(function (d) { conserves = conserves.concat(donneesJour(d)); });
        conserves.forEach(function (a) { heuresGardees[a.uid] = a.heure; });
      }
      // 3.28.18 : une visite hors des communes choisies pour son jour : gardée si elle est faite ou renseignée, sinon selon votre réponse
      if (horsZone === 'retirer') conserves = conserves.filter(function (a) { return a.etat === 'valide' || a.corrige || a.statut || dansCommunesDu(a, a.date); });
      // agenda : les autres jours restent ; un praticien déjà prévu à quelques jours d'écart n'est pas repris
      var horsCible = S.plan.filter(function (a) { return cible.indexOf(a.date) < 0; });
      var exclus = p.eviterCollegues !== false ? exclusCollegues(cible) : exclusValides(cible), ecart = Math.max(+p.delai || 0, 5);
      horsCible.forEach(function (a) { if (cible.some(function (d) { return Math.abs(joursEcoules(a.date, d)) < ecart; })) exclus[a.code] = true; });
      Object.keys(refusesActuels().codes).forEach(function (c) { exclus[c] = true; });   // 3.26.94 : retirés à la main : jamais reproposés
      var optsTirage = {
        dates: cible, communesPour: communesPour, maxJour: +p.maxJour || 8, delai: +p.delai || 0,
        exclus: exclus, rejetes: S.rejetes, conserves: conserves, imposes: S.imposes.concat(rdvProchaines(cible)), depart: departCoord(), accepte: filtreCibles()
      };
      var r = Moteur.genererPlanning(ctx(), optsTirage);
      // 3.28.31 : un recalcul ne propose jamais moins de visites que demandé quand c'est possible :
      // si les nouveaux venus ne laissent pas la place, on refait le tirage en reprenant aussi
      // les médecins de la liste précédente (jamais ceux retirés par la croix)
      var maxJ = +p.maxJour || 8, manque = function (res) { return cible.some(function (d) { return res.arrets.filter(function (a) { return a.date === d; }).length < maxJ; }); };
      if (Object.keys(S.rejetes).length && manque(r)) {
        var r2 = Moteur.genererPlanning(ctx(), Object.assign({}, optsTirage, { rejetes: {} }));
        if (r2.arrets.length > r.arrets.length) r = r2;
        // 3.28.33 : sinon, on garde les médecins restés dans la liste (à leur heure) et on comble les places libérées
        if (manque(r) && (portee === 'jour' || portee === 'semaine')) {
          var restes = S.plan.filter(function (a) { return cible.indexOf(a.date) >= 0 && conserves.indexOf(a) < 0 && !refusesActuels().codes[a.code]; })
            .map(function (a) { var x = JSON.parse(JSON.stringify(a)); x.garde = true; return x; });
          if (restes.length) {
            var r3 = Moteur.genererPlanning(ctx(), Object.assign({}, optsTirage, { rejetes: {}, conserves: conserves.concat(restes) }));
            r3.arrets.forEach(function (a) { var o = restes.filter(function (x) { return x.uid === a.uid; })[0]; if (o) { var src = S.plan.filter(function (y) { return y.uid === o.uid; })[0]; a.garde = !!(src && src.garde); } });
            if (r3.arrets.length > r.arrets.length) r = r3;
          }
        }
      }
      r.arrets.forEach(function (a) { if (heuresGardees[a.uid]) a.heure = heuresGardees[a.uid]; });
      S.plan = horsCible.concat(r.arrets);
      trierPlan();
      // nouvelle tournée : seule sa période est remplacée dans la base, les autres jours publiés restent
      if (portee === 'nouveau') { S.ui.portee = null; LS.set('portee', null); }
      // jours touchés : en brouillon s'ils ont reçu de nouvelles visites ; un recalcul attend « Accepter » ou « Recalculer encore »
      var touches = {}; r.arrets.forEach(function (a) { if (!heuresGardees[a.uid] && !(a.etat === 'valide' || a.corrige)) touches[a.date] = true; });
      if (portee === 'jour') { mettreBrouillon(cible); S.ui.aAccepter = cible[0]; }
      else mettreBrouillon(Object.keys(touches));
      S.ui.voirParams = false; S.ui.ouvert = null;
      if (portee === 'nouveau') { S.ui.jour = cible.filter(function (d) { return S.plan.some(function (a) { return a.date === d; }); })[0] || null; S.ui.aAccepter = null; S.ui.tab = 'semaine'; window.scrollTo(0, 0); }
      sauver(); rendre(); publierPlan(true);
      if (portee === 'jour') setTimeout(function () { centrerElement(document.querySelector('.bandeau-prog.accepter')); }, 60);
      var nG = Object.keys(heuresGardees).length, nN = r.arrets.length - nG;
      var msg = r.arrets.length ? (nG ? (!nN ? 'Aucun créneau libre : les ' + nG + ' visites déjà prévues sont conservées.' : nN + ' visite' + (nN > 1 ? 's' : '') + ' ajoutée' + (nN > 1 ? 's' : '') + ', ' + nG + ' déjà prévue' + (nG > 1 ? 's' : '') + ' conservée' + (nG > 1 ? 's' : '') + '.') : r.arrets.length + ' visites proposées' + (portee === 'jour' ? ' pour ce jour' : '') + '.') : 'Aucun praticien ne correspond à ces critères.';
      if (portee === 'jour' && r.arrets.length < maxJ) msg += ' ' + raisonsManque(cible[0], r.arrets.length, maxJ, exclus);
      var np = r.nonPlaces.filter(function (x) { return !x.etape; });
      if (np.length) msg += ' ' + np.length + ' médecin(s) prioritaire(s) absent(s) sur la période.';
      var hz = r.nonPlaces.filter(function (x) { return x.etape && x.horsCommunes; });
      if (hz.length) msg += ' ' + hz.length + ' RDV hors des communes choisies, non placé' + (hz.length > 1 ? 's' : '') + ' : ' + hz.map(function (x) { var pr = praticien(x.code); return pr ? pr.nom : x.code; }).join(', ') + '.';
      var attendu = (+p.maxJour || 8) * cible.filter(function (d) { return jourSemaineIndex(d) < 5; }).length;
      if (portee !== 'jour' && r.arrets.length && r.arrets.length < attendu * 0.75) {
        msg += ' Moins de visites que prévu : les praticiens présents sont déjà ciblés par l\'équipe, vus récemment ou hors des critères choisis. Élargissez les communes ou les spécialités.';
      }
      toast(msg, portee === 'jour' && r.arrets.length < maxJ ? 9000 : 4500);
    });
  }

  function horodatageCourt() { var d = new Date(); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' à ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  // Programme validé puis modifié : il reste validé pour l'équipe, avec la date de modification
  // 3.28.8 : Défilement automatique ergonomique :
  // - Plus d'exception d'en-tête en haut : le titre n'est plus forcé en haut de l'écran.
  // - Le principal bouton de validation (Continuer, Valider, Enregistrer) est TOUJOURS calé à hauteur de pouce (~70% de l'écran).
  // - S'il y a des options / cases à cocher, elles sont centrées au milieu de l'écran (ou au-dessus du bouton de validation).
  function centrerCarte(uid, pouceY) { centrerQuestion(uid, pouceY); }
  function centrerElement(c, forceQuestion, pouceY) {
    if (!c) return;
    var card = (c.closest && c.closest('.arret.ouvert')) ||
               (document.querySelector && document.querySelector('.arret.ouvert')) ||
               (document.querySelector && document.querySelector('.rapport-jour')) ||
               null;
    var cibleEl = (forceQuestion !== false && c.querySelector) ? (
      c.querySelector('.cr-question') ||
      c.querySelector('.actions-cr') ||
      c.querySelector('.rangee-actions-cr-valide') ||
      c.querySelector('.cr-express-bloc') ||
      c
    ) : c;
    if (!cibleEl) cibleEl = c;

    requestAnimationFrame(function () {
      setTimeout(function () {
        var ent = (document.querySelector('.entete') || { offsetHeight: 0 }).offsetHeight;
        var nav = (document.querySelector('.navigation') || { offsetHeight: 0 }).offsetHeight;
        var dispo = window.innerHeight - ent - nav;
        if (dispo <= 0) return;

        // 1. Détection du bouton principal de validation (Continuer, Valider, Enregistrer)
        var btnValider = (card && card.querySelector(
          'button[data-a="validerUn"], button[data-a="crOk"], button[data-a="rapValider"], button[data-a="crValider"], button[data-a="crRemplacer"], .actions-cr .bouton-plein, .rangee-actions-cr-valide .bouton-plein, .actions-cr button:not([disabled])'
        )) || (cibleEl && cibleEl.querySelector && cibleEl.querySelector(
          'button[data-a="validerUn"], button[data-a="crOk"], button[data-a="rapValider"], button[data-a="crValider"], button[data-a="crRemplacer"], .actions-cr .bouton-plein, .rangee-actions-cr-valide .bouton-plein, .actions-cr button:not([disabled])'
        ));

        // Recherche par libellé si nécessaire
        if (!btnValider && card) {
          var btns = card.querySelectorAll('button:not([disabled])');
          for (var ib = 0; ib < btns.length; ib++) {
            var txt = (btns[ib].textContent || '').trim().toLowerCase();
            if (/^(continuer|valider|enregistrer|terminer|suivant)/i.test(txt)) {
              btnValider = btns[ib];
              break;
            }
          }
        }

        // 2. Détection des éléments à cocher / options (puces, boutons choix, tuiles)
        var optionsEl = (card && card.querySelector('.cr-boutons, .puces, .tuiles-choix, .segment, .grille-choix, .cases-a-cocher, .selecteur-cr')) ||
                        (cibleEl && cibleEl.querySelector && cibleEl.querySelector('.cr-boutons, .puces, .tuiles-choix, .segment, .grille-choix, .cases-a-cocher, .selecteur-cr')) ||
                        null;

        // 3. Hauteur de pouce ergonomique fixe (~70% de la hauteur visible entre entête et barre de navigation)
        var yPouce = ent + Math.round(dispo * 0.70);

        var delta = 0;

        if (btnValider) {
          // RÈGLE : Le bouton principal de validation TOUJOURS à hauteur de pouce
          var rBtn = btnValider.getBoundingClientRect();
          var cibleBtnY = yPouce - Math.round(rBtn.height * 0.5);
          delta = rBtn.top - cibleBtnY;

          // Si options / cases à cocher au-dessus, s'assurer que leur haut reste lisible (garde-fou haut)
          if (optionsEl) {
            var rOpt = optionsEl.getBoundingClientRect();
            if (rOpt.top - delta < ent + 12) {
              delta = rOpt.top - (ent + 12);
            }
          }
        } else if (optionsEl) {
          // RÈGLE : S'il y a des choses à cocher (sans bouton de validation séparé), tout centrer au milieu de l'écran
          var rOpt = optionsEl.getBoundingClientRect();
          var yCentre = ent + Math.round(dispo * 0.50);
          var cibleOptY = yCentre - Math.round(rOpt.height * 0.5);
          delta = rOpt.top - cibleOptY;
        } else {
          // Par défaut : centrer l'élément actif au milieu de la hauteur visible
          var rCible = cibleEl.getBoundingClientRect();
          var yCentre = ent + Math.round(dispo * 0.50);
          delta = rCible.top - (yCentre - Math.round(rCible.height * 0.5));
        }

        // 4. Garde-fou bas : Ne jamais masquer le bas sous la barre de navigation
        var elConteneur = btnValider || optionsEl || cibleEl;
        if (elConteneur && elConteneur.getBoundingClientRect) {
          var rBas = elConteneur.getBoundingClientRect();
          var maxBas = window.innerHeight - nav - 8;
          var minDelta = rBas.bottom - maxBas;
          if (delta < minDelta) {
            delta = minDelta;
          }
        }

        var cibleScrollY = Math.max(0, Math.round(window.scrollY + delta));
        window.scrollTo({ top: cibleScrollY, behavior: 'smooth' });
      }, 35);
    });
  }
  // empreinte d'un compte rendu : sert à dire « aucune modification » plutôt que « enregistré »
  function empreinteCr(a) {
    var c = JSON.parse(JSON.stringify(a.cr || {})); delete c.ok;
    return JSON.stringify([c, a.statut || '', a.commentaire || '', a.produits || '', a.prochaine || '', a.activite || '']);
  }
  function validerVisites(uid) {
    var aValider = S.plan.concat(S.horsPlan || []).filter(function (a) { return a.statut && a.etat !== 'valide' && (!uid || a.uid === uid); });
    // modification ouverte puis enregistrée sans rien changer : on le dit, rien n'est renvoyé
    var inchanges = aValider.filter(function (a) { if (a.cr) syncCr(a); return a.corrige && a.empreinte && a.empreinte === empreinteCr(a); });
    inchanges.forEach(function (a) { a.etat = 'valide'; delete a.corrige; delete a.empreinte; });
    if (inchanges.length) {
      aValider = aValider.filter(function (a) { return inchanges.indexOf(a) < 0; });
      if (!aValider.length) { S.ui.ouvert = null; sauver(); rendre(); toast('Aucune modification : le compte rendu est inchangé.'); return; }
    }
    if (!aValider.length) return;
    var t = aujourdhui(), ko = 0, etapes = [];
    aValider.forEach(function (a) {
      var v = { uid: a.uid, date: a.date > t && !S.config.saisieFutur ? t : a.date, idPresence: a.idPresence, code: a.code, nom: a.nom, type: a.type,
                specialite: a.specialite, note: a.note, commune: a.commune, quartier: a.quartier, lieu: a.lieu,
                creneau: a.creneau, statut: a.statut, commentaire: a.commentaire || '', delegue: moi(),
                produits: a.produits || '', prochaine: a.prochaine || '', activite: a.activite || '' };
      if (a.cr) { syncCr(a); Object.assign(v, champsCr(a)); v.statut = a.statut; v.prochaine = a.prochaine || ''; v.produits = a.produits || ''; }
      if (a.corrige) v.correction = true;
      memoriserProduits(a.produits);
      Moteur.appliquerVisite(S.data.praticiens, v, statuts());
      if (S.config.demo) { v.horodatage = new Date().toISOString(); S.data.historique = [v].concat((S.data.historique || []).filter(function (x) { return x.uid !== v.uid; })); }
      else {
        var enFile = S.queue.filter(function (x) { return x.uid === v.uid; })[0];
        if (enFile) { if (enFile.correction === undefined) delete v.correction; S.queue[S.queue.indexOf(enFile)] = v; } else S.queue.push(v);
        // affichage immédiat de la correction dans l'historique local
        if (a.corrige && S.data.historique) S.data.historique.forEach(function (x, i) { if (x.uid === v.uid) S.data.historique[i] = Object.assign({}, x, v); });
      }
      if (estKo(a.statut)) ko++;
      // 3.25.0 : heure de validation (première saisie le jour même) : elle fait foi pour l'ordre de la journée
      if (!a.valideA && a.date === t) a.valideA = minutesVersHeure(minutesMaintenant());
      a.etat = 'valide'; delete a.corrige; delete a.empreinte;
      (S.ui.flashOk = S.ui.flashOk || {})[a.uid] = true;
      // seul un RDV confirmé est placé d'office dans la tournée
      if (a.prochaine && a.prochaine > a.date && (a.cr ? a.rdvConfirme : true)) etapes.push({ code: a.code, apres: a.prochaine, etape: true, dateRdv: a.prochaine, prisLe: v.date });
    });
    // prochaine étape tombant dans la tournée en cours : le praticien y est ajouté comme un RDV
    var placees = 0;
    etapes.forEach(function (im) {
      var deja = S.plan.filter(function (x) { return x.code === im.code && x.date >= im.apres && !x.statut; })[0];
      if (deja) { deja.impose = true; deja.garde = true; deja.etape = true; deja.rdvDate = im.dateRdv; deja.rdvPrisLe = im.prisLe; placees++; return; }
      if (placerImpose(im)) placees++;
    });
    if (placees) marquerModifie();
    ctxCache.data = null;
    S.ui.ouvert = null;
    // 3.25.44 : si la visite est enregistrée comme absente/non réalisée aujourd'hui et remplacement demandé, proposer directement le remplacement sous le pouce
    var cr0 = crDe(aValider[0]);
    var aKoSeul = aValider.length === 1 && estKo(aValider[0].statut) && !aValider[0].hors && aValider[0].date === t && cr0 && cr0.remplacant === 'oui';
    if (aKoSeul) {
      var cands = candidatsRemplacement(aValider[0]);
      if (cands && cands.length) {
        S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + aValider[0].nom, pleine: true, uid: aValider[0].uid, choix: null, garder: true, lieuRef: aValider[0].lieu };
      }
    }
    sauver(); rendre();
    var nCorr = aValider.filter(function (a) { return a.uid && S.queue.some(function (q) { return q.uid === a.uid && q.correction; }); }).length;
    toast((nCorr === aValider.length ? (nCorr > 1 ? nCorr + ' comptes rendus modifiés' : 'Compte Rendu modifié') : aValider.length + ' compte(s) rendu(s) enregistré(s)') + (ko ? '. ' + ko + ' visite(s) non réalisée(s).' : '.') +
      (placees ? ' Prochaine étape ajoutée à votre tournée.' : ''), 4500);
    publierPlan(!placees);
  }

  function ajouterArret(c, date) {
    if (S.plan.some(function (a) { return a.date === date && a.code === c.code; })) { toast('Ce praticien est déjà prévu ce jour-là.'); return false; }
    // 3.27.13 : aujourd'hui, créneau déjà terminé : on prend le créneau suivant du même lieu (ex. le soir)
    if (date === aujourdhui() && c.fin <= minutesMaintenant()) {
      var suite = (ctx().parCode[c.code] || []).filter(function (x) { return x.jourIdx === c.jourIdx && String(x.idPresence) === String(c.idPresence) && x.fin > minutesMaintenant(); })
        .sort(function (x, y) { return x.debut - y.debut; })[0];
      if (suite) c = suite;
    }
    var a = Moteur.arretDepuisCreneau(c, date);
    a.etat = 'ajoute'; a.garde = true;
    // 3.28.18 : ajouté à la main : la croix d'avant est levée
    var rf = refusesActuels(); if (rf.codes[c.code]) { delete rf.codes[c.code]; LS.set('refuses', rf); }
    S.plan.push(a);
    reordonner(date);
    if (S.ui.tab === 'semaine') mettreBrouillon([date]);
    S.ui.jour = date;
    sauver(); publierPlan();
    var cib = cibleParCollegues(c.code, date);
    toast('Ajouté au ' + dateCourte(date) + (cib.length ? ', attention : aussi prévu par ' + cib[0].delegue : '') + '.');
    return true;
  }

  // Place un médecin « à voir absolument » au meilleur endroit de la tournée existante
  // Prochaines étapes fixées (comme un RDV pris) : placées d'office ce jour-là si le praticien y est présent,
  // sinon au premier jour de présence suivant ; une étape en retard (14 jours au plus) est placée dès que possible.
  // Une étape fixée par un collègue reste la sienne.
  function rdvProchaines(dates) {
    if (!dates.length) return [];
    var c = ctx(), t = aujourdhui(), debut = ajouterJours(t, -14), fin = dates[dates.length - 1], auteur = {}, prisLe = {};
    ((S.data && S.data.historique) || []).forEach(function (v) {
      var pv = String(v.prochaine || '').slice(0, 10);
      if (pv && !auteur[v.code + '|' + pv]) auteur[v.code + '|' + pv] = v.delegue || '';
      if (pv && !prisLe[v.code + '|' + pv]) prisLe[v.code + '|' + pv] = String(v.date || '').slice(0, 10);
    });
    var dejaImposes = ensemble(S.imposes.map(function (x) { return x.code; }));
    return Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
      if (!p.prochaine || p.prochaine < debut || p.prochaine > fin || dejaImposes[p.code] || LS.get('rdvIgnores', {})[p.code + '|' + p.prochaine]) return false;   // 3.26.75 : RDV retiré par le délégué
      var qui = auteur[p.code + '|' + p.prochaine];
      return !qui || estMoi(qui);
    }).map(function (p) { return { code: p.code, apres: p.prochaine < dates[0] ? dates[0] : p.prochaine, etape: true, dateRdv: p.prochaine, prisLe: prisLe[p.code + '|' + p.prochaine] || '' }; });
  }
  function forcerArretJour(code, d, rdv, lieuPrefere) {
    var c = ctx(), p = c.prat[code];
    if (!p) return false;
    var ex = S.plan.filter(function (a) { return a.date === d && a.code === code; })[0];
    if (ex) {
      ex.impose = true; ex.garde = true; ex.inopinee = true;
      if (rdv) ex.rdv = rdv;
      reordonner(d);
      return true;
    }
    var jIdx = jourSemaineIndex(d), now = minutesMaintenant(), estSoir = d === aujourdhui() && now >= 13 * 60;
    var tousCr = c.parCode[code] || [];
    // 3.26.9 : si le délégué remplace ou ajoute au CHU / même établissement, sélectionner d'office ce lieu
    var refLieu = lieuPrefere || (S.ui.feuille && S.ui.feuille.lieuRef) || '';
    if (!refLieu && d === aujourdhui()) {
      var duJour = S.plan.filter(function (x) { return x.date === d; });
      var absente = duJour.filter(function (x) { return x.statut && estKo(x.statut); }).slice(-1)[0];
      if (absente && absente.lieu) refLieu = absente.lieu;
      else if (duJour.length) {
        var courante = duJour.filter(function (x) { return !x.statut; })[0] || duJour.slice(-1)[0];
        if (courante && courante.lieu) refLieu = courante.lieu;
      }
    }
    var cr = null;
    if (refLieu) {
      cr = tousCr.filter(function (x) { return x.jourIdx === jIdx && x.creneau === (estSoir ? 'Soir' : 'Matin') && memeEtablissement(refLieu, x.lieu); })[0] ||
           tousCr.filter(function (x) { return x.jourIdx === jIdx && memeEtablissement(refLieu, x.lieu); })[0] ||
           tousCr.filter(function (x) { return memeEtablissement(refLieu, x.lieu); })[0];
    }
    if (!cr) {
      cr = tousCr.filter(function (x) { return x.jourIdx === jIdx && x.creneau === (estSoir ? 'Soir' : 'Matin'); })[0] ||
           tousCr.filter(function (x) { return x.jourIdx === jIdx; })[0] ||
           tousCr[0];
    }
    if (!cr) {
      var presences = c.presencesParCode[code] || [];
      var pr = (refLieu ? presences.filter(function (x) { return memeEtablissement(refLieu, x.lieu); })[0] : null) ||
               presences[0] ||
               { id: 'IMP-' + code, lieu: p.type === 'Pharmacie' ? p.nom : 'Cabinet', quartier: '', commune: '', zone: '' };
      var qObj = quartiers().filter(function (q) { return q.quartier === pr.quartier; })[0];
      var coord = (pr.lat && pr.lon) ? { lat: +pr.lat, lon: +pr.lon } : (qObj ? { lat: +qObj.lat, lon: +qObj.lon, approx: true } : null);
      cr = {
        cle: (pr.id || code) + '|' + Math.min(jIdx, 4) + '|' + (estSoir ? 'Soir' : 'Matin'),
        idPresence: pr.id || '', code: code, prat: p,
        lieu: pr.lieu || (p.type === 'Pharmacie' ? p.nom : 'Cabinet'),
        quartier: pr.quartier || '', commune: pr.commune || (qObj ? qObj.commune : ''), zone: pr.zone || (qObj ? qObj.zone : ''),
        jourIdx: Math.min(jIdx, 4), jour: JOURS[Math.min(jIdx, 4)] || 'Aujourd\'hui',
        creneau: estSoir ? 'Soir' : 'Matin',
        debut: estSoir ? 15 * 60 : 8 * 60,
        fin: estSoir ? 18 * 60 + 30 : 12 * 60 + 30,
        coord: coord
      };
    }
    var a = Moteur.arretDepuisCreneau(cr, d);
    a.jour = JOURS[Math.min(jIdx, 4)] || a.jour;
    if (cr.jourIdx !== jIdx) {
      a.creneau = estSoir ? 'Soir' : 'Matin';
      a.debut = estSoir ? '15:00' : '08:00';
      a.fin = estSoir ? '18:30' : '12:30';
    }
    a.impose = true; a.garde = true; a.etat = 'ajoute'; a.inopinee = true;
    if (rdv) a.rdv = rdv;
    S.plan.push(a);
    reordonner(d);
    if (!S.jours[d]) mettreBrouillon([d]);
    return true;
  }
  function placerImpose(im) {
    if (im.force && im.date) return forcerArretJour(im.code, im.date, im.rdv);
    var c = ctx(), dates = datesPeriode(), best = null;
    (c.parCode[im.code] || []).forEach(function (cr) {
      dates.forEach(function (d) {
        if (jourSemaineIndex(d) !== cr.jourIdx || (im.date && im.date !== d) || (im.apres && d < im.apres) || (im.cle && im.cle !== cr.cle) || estFerie(d)) return;
        if (S.plan.some(function (a) { return a.date === d && a.code === im.code; })) return;
        var a = Moteur.arretDepuisCreneau(cr, d);
        a.impose = true; a.garde = true; if (im.rdv) a.rdv = im.rdv; if (im.etape) { a.etape = true; a.rdvDate = im.dateRdv || im.apres; a.rdvPrisLe = im.prisLe || ''; }
        var jour = S.plan.filter(function (x) { return x.date === d; });
        var avant = jour.reduce(function (s, x) { return s + (x.dist || 0); }, 0);
        var essai = Moteur.ordonnerJour(jour.map(function (x) { return Object.assign({}, x); }).concat([a]), departCoord());
        var cout = essai.filter(function (x) { return x.retard; }).length * 1000 + essai.reduce(function (s, x) { return s + x.dist; }, 0) - avant + jour.length * 0.5;
        if (!best || cout < best.cout) best = { cout: cout, a: a, d: d };
      });
    });
    if (!best) return false;
    S.plan.push(best.a);
    reordonner(best.d);
    if (!im.etape) S.ui.jour = best.d;
    return true;
  }

  // 3.25.28 : rafraîchissement toutes les 5 minutes, à la réouverture et au rafraîchissement
  // discret : sans message ; sinon (bouton « Actualiser ») : message et position GPS imposée même si un quartier était choisi
  var PERIODE_GPS_MIN = 5;
  var DUREE_CACHE_GPS_MS = 180000; // 3.27.47 : 3 minutes de validité de cache GPS (anti-surchauffe / batterie)
  function localiser(discret, declencheur, forcerGps) {
    if (!navigator.geolocation) { if (!discret) toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
    if (S.ui.localisation) {
      if (S.ui.localisationT && Date.now() - S.ui.localisationT > 10000) S.ui.localisation = false;
      else return;
    }

    var estActionExplicite = !discret || declencheur === 'position' || declencheur === 'capter' || declencheur === 'ici' || forcerGps;

    // 3.27.47 : Régulation batterie : si tâche de fond passive et que le GPS en cache a moins de 3 minutes, réutilisation immédiate
    if (!estActionExplicite && S.ui.posGps && (Date.now() - S.ui.posGps.t < DUREE_CACHE_GPS_MS)) {
      var pCache = S.ui.posGps;
      var A = S.ui.autour, r = Moteur.quartierLePlusProche(pCache.lat, pCache.lon, quartiers());
      if (positionGps()) {
        A.lat = pCache.lat; A.lon = pCache.lon; A.src = 'gps'; A.prec = pCache.prec; A.t = pCache.t;
        A.quartier = r && r.quartier ? r.quartier.quartier : ''; A.commune = r && r.quartier ? r.quartier.commune : '';
        A.label = A.quartier ? A.quartier + ' (ma position)' : 'ma position';
        LS.set('autour', A);
      }
      alerteProximite(declencheur === 'ouverture');
      return;
    }

    S.ui.localisation = discret ? 'discret' : true;
    S.ui.localisationT = Date.now();
    if (!discret) { toast('Recherche de votre position…'); if (S.ui.tab === 'autour') rendre(); }

    function traiterResultatGps(p) {
      S.ui.localisation = false;
      var g0 = gpsFrais();
      if (g0 && g0.prec && p.prec > g0.prec) {
        var ecartM = distanceKm(g0, p) / REGLAGES_MOTEUR.detourRoutier * 1000;
        if (ecartM <= p.prec + g0.prec) p = { lat: g0.lat, lon: g0.lon, prec: g0.prec, garde: true };
      }
      if (!p.garde) { S.ui.posGps = { lat: p.lat, lon: p.lon, t: Date.now(), prec: p.prec }; LS.set('derniereGps', S.ui.posGps); }
      var A = S.ui.autour, r = Moteur.quartierLePlusProche(p.lat, p.lon, quartiers());
      if (!discret || forcerGps || positionGps()) {
        A.lat = p.lat; A.lon = p.lon; A.src = 'gps'; A.prec = p.prec; A.t = Date.now();
        A.quartier = r && r.quartier ? r.quartier.quartier : ''; A.commune = r && r.quartier ? r.quartier.commune : '';
        A.label = A.quartier ? A.quartier + ' (ma position)' : 'ma position';
        LS.set('autour', A);
      }
      rendreSiPossible();
      alerteProximite(declencheur === 'ouverture' || !discret); notifierProximite();
      var demande = !discret || declencheur === 'position', dernAl = +LS.get('alerteImprecisT', 0);
      if (demande && p.prec > 150 && !p.garde && Date.now() - dernAl > 3600000) { LS.set('alerteImprecisT', Date.now()); toast('Position imprécise (± ' + p.prec + ' m). Activez la « localisation précise » du téléphone ou approchez-vous d\'une fenêtre.', 5000); }
      else if (!discret && r && r.km > 8) toast('Vous semblez hors d\'Abidjan. Quartier le plus proche : ' + r.quartier.quartier + '.');
    }

    function traiterErreurGps() {
      S.ui.localisation = false; if (S.ui.tab === 'autour') rendreSiPossible();
      if (!discret) toast('Position indisponible. Autorisez la localisation ou choisissez un quartier.');
    }

    if (!estActionExplicite) {
      try {
        navigator.geolocation.getCurrentPosition(function (pos) {
          traiterResultatGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, prec: Math.round(pos.coords.accuracy || 0) });
        }, function () {
          traiterErreurGps();
        }, { enableHighAccuracy: false, maximumAge: DUREE_CACHE_GPS_MS, timeout: 8000 });
      } catch (eLow) {
        traiterErreurGps();
      }
    } else {
      mesurePrecise(traiterResultatGps, traiterErreurGps);
    }
  }
  // « Par ma position » : la dernière position connue du téléphone sert tout de suite (résultats immédiats)
  function positionConnue() {
    var g = S.ui.posGps, A = S.ui.autour; if (!g) return;
    var r = Moteur.quartierLePlusProche(g.lat, g.lon, quartiers());
    A.lat = g.lat; A.lon = g.lon; A.src = 'gps'; A.prec = g.prec;
    A.quartier = r && r.quartier ? r.quartier.quartier : ''; A.commune = r && r.quartier ? r.quartier.commune : '';
    A.label = A.quartier ? A.quartier + ' (ma position)' : 'ma position';
    LS.set('autour', A);
  }
  // recalcul périodique, quel que soit l'onglet (application au premier plan)
  setInterval(function () { if (!document.hidden) localiser(true, 'periodique'); }, PERIODE_GPS_MIN * 60000);
  // 3.25.40 & 3.25.42 : notification de pharmacie proche déplaçable au pouce en direct (prise sur la poignée, sans bloquer le scroll)
  function attacherGlissementPouce(el) {
    if (!el || el._dragAttache) return;
    el._dragAttache = true;
    var startX = 0, startY = 0, curX = 0, curY = 0, enGlisse = false;

    function onDebut(e) {
      if (e.target.closest('button')) return;
      if (!e.target.closest('.drag-poignee')) return;
      var pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX - curX;
      startY = pt.clientY - curY;
      enGlisse = true;
      el.classList.add('en-glisse');
    }

    function onBouge(e) {
      if (!enGlisse) return;
      var pt = e.touches ? e.touches[0] : e;
      var nx = pt.clientX - startX;
      var ny = pt.clientY - startY;
      if (e.cancelable) e.preventDefault();
      var rect = el.getBoundingClientRect();
      var maxDx = (window.innerWidth - 60) - (rect.left - curX);
      var minDx = 60 - (rect.right - curX);
      var maxDy = (window.innerHeight - 80) - (rect.top - curY);
      var minDy = 60 - (rect.bottom - curY);
      curX = Math.max(minDx, Math.min(maxDx, nx));
      curY = Math.max(minDy, Math.min(maxDy, ny));
      el.style.transform = 'translate3d(' + curX + 'px, ' + curY + 'px, 0)';
    }

    function onFin() {
      if (!enGlisse) return;
      enGlisse = false;
      el.classList.remove('en-glisse');
    }

    el.addEventListener('touchstart', onDebut, { passive: true });
    window.addEventListener('touchmove', onBouge, { passive: false });
    window.addEventListener('touchend', onFin, { passive: true });
    window.addEventListener('touchcancel', onFin, { passive: true });
  }

  // 3.25.14 : pharmacie ouverte à proximité signalée à chaque rafraîchissement ou réouverture (et dès qu'une nouvelle apparaît),
  // utile dans un quartier mal connu ; « Non » la masque pour la journée
  // 3.26.73 : notification du téléphone (une seule fois par sujet et par jour)
  function notifier(cle, titre, corps, forcer) {
    try {
      if (!LS.get('notifs', false) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      var deja = LS.get('notifsVues', {}); if (deja.d !== aujourdhui()) deja = { d: aujourdhui(), k: {} };
      if (deja.k[cle] && !forcer) return; deja.k[cle] = true; LS.set('notifsVues', deja);
      var opts = { body: corps, tag: cle, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [80, 40, 80], data: { url: location.href.split('#')[0] } };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (r) { r.showNotification(titre, opts); }).catch(function () { new Notification(titre, opts); });
      else new Notification(titre, opts);
    } catch (e) {}
  }
  function notifierProximite() {
    if (!pret()) return;
    var plan = S.plan.filter(function (a) { return a.date === aujourdhui(); });
    var sans = plan.filter(function (a) { return !a.statut; }), now = minutesMaintenant();
    var suivante = sans.filter(function (a) { return heureVersMinutes(a.heure) === null || heureVersMinutes(a.heure) >= now; })[0];
    var pv = visiteProche(sans, suivante);
    if (pv) notifier('proche-' + pv.a.uid, (estPharmacie(pv.a) ? 'Pharmacie' : 'Médecin') + ' à ' + metres(pv.d), nomSansType(pv.a.nom) + (pv.a.lieu ? ', ' + abregerHopital(pv.a.lieu) : '') + '. Prévu à ' + (pv.a.heure || '') + ' : le voir maintenant ?');
    var ph = pharmacieProche(plan);
    if (ph) notifier('pharma-' + ph.c.code, 'Pharmacie à ' + metres(ph.d), nomSansType(ph.c.prat.nom) + ', ouverte jusqu\'à ' + minutesVersHeure(ph.c.fin) + ' (' + vuDepuis(ph.c.prat.derniere) + ').');
  }
  function notifierConflits() {
    if (!pret()) return;
    var t = aujourdhui(), dem = ajouterJours(t, 1);
    S.plan.filter(function (a) { return a.date === t || a.date === dem; }).forEach(function (a) {
      var cf = conflitArret(a); if (cf) notifier('conflit-' + a.uid, 'Conflit de programme', a.nom + ' est aussi prévu par ' + cf.delegue + ' le ' + dateFr(cf.date) + '.');
    });
  }
  function alerteProximite(forcer) {
    var el = $('alerteProche');
    var plan = S.plan.filter(function (a) { return a.date === aujourdhui(); }), ph = pret() ? pharmacieProche(plan) : null;
    if (!ph) { if (el) el.hidden = true; return; }
    if (!forcer && S.ui.derniereAlerte === ph.c.code) return;
    S.ui.derniereAlerte = ph.c.code;
    if (S.ui.tab === 'jour' && jourAffiche() === aujourdhui()) return;   // Journée l'affiche déjà en tête
    if (!el) {
      el = document.createElement('div');
      el.id = 'alerteProche';
      el.className = 'alerte-proche';
      document.body.appendChild(el);
      attacherGlissementPouce(el);
    }
    el.innerHTML = '<div class="drag-poignee" title="Glisser au pouce pour déplacer"><span class="drag-barre"></span></div>' +
      '<div class="bandeau-proche t-pharma">' + pastilleType(ph.c.prat, true) + '<p><b>' + esc(nomSansType(ph.c.prat.nom)) + '</b> est à <b>' + metres(ph.d) + '</b>' +
      ', ouverte jusqu\'à ' + minutesVersHeure(ph.c.fin) + ' (' + esc(vuDepuis(ph.c.prat.derniere)) + '). Y aller ?</p>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="pharmaNon" data-v="' + esc(ph.c.code) + '">Non</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="pharmaOui" data-v="' + esc(ph.c.cle) + '">Y aller</button></div></div>';
    el.hidden = false;
  }
  // 3.25.36 : mesure GPS haute précision (arrêt immédiat <= 35 m, filtrage des faux relais > 500 m, sans cache obsolète)
  // 3.26.97 : mesure GPS haute précision : on écoute le GPS jusqu'à obtenir ± 20 m (au plus 25 s). Une mesure
  // grossière (Wi-Fi, antenne) n'est retenue qu'à défaut, et signalée comme imprécise.
  function mesurePrecise(ok, ko) {
    if (!navigator.geolocation) { if (ko) ko(); return; }
    var best = null, fini = false, id = null, t = null, t2 = null, debut = Date.now();
    function terminer() {
      if (fini) return; fini = true;
      if (id !== null) navigator.geolocation.clearWatch(id); clearTimeout(t); clearTimeout(t2);
      if (best) ok({ lat: best.coords.latitude, lon: best.coords.longitude, prec: Math.round(best.coords.accuracy || 0) });
      else if (ko) ko();
    }
    function recevoir(p) {
      if (fini) return;
      if (!best || precisionDe(p) < precisionDe(best)) best = p;
      var pr = precisionDe(best);
      if (pr <= 20) terminer();
      else if (pr <= 50 && Date.now() - debut > 8000) terminer();   // bonne précision et déjà 8 s d'écoute : suffisant
    }
    try { navigator.geolocation.getCurrentPosition(recevoir, function () {}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }); } catch (e) {}
    id = navigator.geolocation.watchPosition(recevoir, function (e) { if (e && e.code === 1) terminer(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    t2 = setTimeout(function () { if (best && precisionDe(best) <= 50) terminer(); }, 4000);
    t = setTimeout(terminer, 12000); // 3.27.47 : plafond à 12 s au lieu de 25 s
  }
  function precisionDe(p) { var a = p && p.coords && p.coords.accuracy; return a === null || a === undefined || isNaN(a) ? 9999 : a; }
  function distanceCourte(k) {
    if (k <= 0.035) return 'Sur place';
    if (k < 1) {
      var m = Math.max(10, Math.round(k * 100) * 10);
      return m <= 30 ? 'Sur place (< 30 m)' : m + ' m';
    }
    return km(k);
  }
  // 3.26.99 : distance depuis ma position. Position à plus de ± 50 m : « ≈ » et arrondi à 50 m (pas de fausse précision au mètre)
  var PREC_DISTANCE_M = 50;
  function positionImprecise() { var g = gpsFrais(); return !!(g && g.prec && g.prec > PREC_DISTANCE_M); }
  function distMoi(k, approx) {
    if (k === null || k === undefined) return '';
    if (k <= 0.035) return 'Sur place';
    var imp = positionImprecise();
    if (!imp) return (approx ? '≈ ' : '') + distanceCourte(k);
    return '≈ ' + (k < 1 ? Math.max(50, Math.round(k * 20) * 50) + ' m' : km(k));
  }
  function gpsPrecis() { var g = gpsFrais(); return !!(g && g.prec && g.prec <= 60); }
  // 3.25.8 : position actuelle connue : GPS de moins de 15 min, sinon le point choisi dans « Autour de moi »
  // 3.26.96 : d'où partent les distances affichées (et avec quelle précision), pour que le délégué puisse en juger
  function texteReferenceDistance() {
    // 3.26.98 : juste la précision, sans avertissement (l'alerte reste dans le message qui s'efface)
    var g = gpsFrais();
    if (g) return 'Distances depuis votre position' + (g.prec ? ' (± ' + g.prec + ' m)' : '') + '.';
    var A = S.ui.autour;
    if (A && A.lat !== null && A.lat !== undefined) return 'Distances depuis ' + (A.src === 'gps' ? 'votre dernière position connue' : (A.label || 'le point choisi')) + '.';
    return '';
  }
  function positionActuelle() {
    var g = gpsFrais(); if (g) return { lat: g.lat, lon: g.lon };
    var A = S.ui.autour; return A && A.lat !== null && A.lat !== undefined ? { lat: A.lat, lon: A.lon } : null;
  }
  // position issue du GPS (et non d'un quartier choisi) : à recalculer à chaque ouverture
  // 3.25.9 : rayons proposés autour de moi
  var RAYONS = [0.5, 2, 5, 10];
  // 3.25.14 : 0,5 km par défaut (une fois pour tous)
  if (!LS.get('rayon05', false) || RAYONS.indexOf(+S.ui.autour.rayon) < 0) { S.ui.autour.rayon = 0.5; LS.set('autour', S.ui.autour); LS.set('rayon05', true); }
  // dernière position connue du téléphone (mémoire), utilisée tout de suite au démarrage
  if (!S.ui.posGps) { var dg = LS.get('derniereGps', null); if (dg && isFinite(dg.lat)) S.ui.posGps = dg; }
  function positionGps() { var A = S.ui.autour; return A.src === 'gps' || A.src === 'gps_init' || (!A.src && /^ma position/i.test(A.label || '')) || A.lat === null; }
  function relocaliserSiBesoin(declencheur) { if (!S.ui.localisation) localiser(true, declencheur); }

  function chargerDemo(force) {
    if (pret() && !S.config.demo && force !== true) {
      confirmerPuis('Démonstration', 'Remplacer les données synchronisées par des données de démonstration ?', 'Remplacer', function () { chargerDemo(true); });
      return;
    }
    S.config.demo = true;
    var b = genererBaseFictive(aujourdhui());
    S.data = { version: VERSION_DONNEES, praticiens: b.praticiens, presences: b.presences, quartiers: quartiersDefautObjets(),
               statuts: STATUTS_DEFAUT, historique: [], plannings: [], syncedAt: null };
    S.plan = []; S.queue = []; S.imposes = []; S.rejetes = {}; S.jours = {};
    S.ui.tab = 'semaine'; S.ui.voirParams = false;
    sauver(); rendre();
    toast('Démonstration : ' + b.praticiens.length + ' praticiens, ' + b.presences.length + ' lieux de présence.');
  }

  function copier(texte) {
    if (navigator.clipboard) return navigator.clipboard.writeText(texte).then(function () { toast('Texte copié.'); }, function () { prompt('Copiez ce texte :', texte); });
    prompt('Copiez ce texte :', texte);
  }

  // 3.26.19 : Actualisation GPS sécurisée pour un lieu spécifique d'un praticien (mono ou multi-sites)
  function majGpsPourLieu(code, idxLieu) {
    var d = brouillonFiche(code);
    if (!d || !d.code) return;
    idxLieu = typeof idxLieu === 'number' ? idxLieu : parseInt(idxLieu, 10) || 0;
    var l = (d.lieux && d.lieux[idxLieu]) || (d.lieux && d.lieux[0]);
    if (!l) return;
    if (!navigator.geolocation) { toast('Localisation indisponible.'); return; }
    toast('Recherche de votre position précise…');
    mesurePrecise(function (p) {
      var pCapt = { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) };
      var qDecl = l.quartier ? quartiers().filter(function (q) { return q.quartier === l.quartier; })[0] : null;
      var refGeo = qDecl && isFinite(qDecl.lat) ? { lat: qDecl.lat, lon: qDecl.lon } : lireCoord(l);
      var distKm = refGeo && isFinite(refGeo.lat) ? distanceVol(pCapt, refGeo) : 0;
      var nomLieu = l.lieu ? (l.lieu + (l.quartier ? ' (' + l.quartier + ')' : '')) : (l.quartier || l.commune || d.nom);

      function sauverDirect() {
        S.ui.posGps = { lat: pCapt.lat, lon: pCapt.lon, t: Date.now(), prec: p.prec };
        LS.set('derniereGps', S.ui.posGps);
        l.lat = pCapt.lat; l.lon = pCapt.lon; l.origineGps = origineTerrain(p.prec);
        var r = Moteur.quartierLePlusProche(l.lat, l.lon, quartiers());
        if (r && r.quartier) {
          l.quartier = r.quartier.quartier;
          l.commune = r.quartier.commune;
        }
        enregistrerFiche(d); rendre();
        var labelLieu = l.lieu || l.quartier || 'Lieu';
        toast('GPS fixé pour ' + labelLieu + ' : ' + (l.quartier || 'coordonnées enregistrées') + ' (± ' + p.prec + ' m)' + (S.config.demo ? '.' : ', envoyé au Google Sheet.'));
        if (!S.config.demo) synchroniser(true);
      }

      if (refGeo && distKm > 3) {
        var distArr = Math.round(distKm);
        confirmerPuis('Écart de position important',
          '<div style="color:var(--primaire,#0A6C74);font-weight:700;margin-bottom:8px">Attention : vous êtes à ' + distArr + ' km de ' + esc(nomLieu) + ' !</div>' +
          '<p style="margin:0 0 8px">Ce bouton sert uniquement lorsque vous êtes <b>physiquement devant cet établissement</b>.</p>' +
          '<p style="margin:0">Voulez-vous vraiment fixer cette position pour <b>' + esc(nomLieu) + '</b> ?</p>',
          'Écraser la position',
          sauverDirect,
          function () { toast('Position inchangée.'); }
        );
        return;
      }

      sauverDirect();
    }, function () { toast('Position indisponible. Autorisez la localisation.'); });
  }

  // 3.27.34 : Actualisation GPS directe pour un établissement / hôpital depuis le Répertoire
  function majGpsPourHopital(e) {
    if (!navigator.geolocation) { toast('Localisation indisponible.'); return; }
    toast('Recherche de votre position précise…');
    mesurePrecise(function (p) {
      var pCapt = { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) };
      var qDecl = e.quartier ? quartiers().filter(function (q) { return q.quartier === e.quartier; })[0] : null;
      var refGeo = (isFinite(e.lat) && isFinite(e.lon) && e.lat !== 0)
        ? { lat: e.lat, lon: e.lon }
        : (qDecl && isFinite(qDecl.lat) ? { lat: qDecl.lat, lon: qDecl.lon } : null);
      var distKm = refGeo ? distanceVol(pCapt, refGeo) : 0;
      var nomEtab = e.nom;

      function sauverHopital() {
        S.ui.posGps = { lat: pCapt.lat, lon: pCapt.lon, t: Date.now(), prec: p.prec };
        LS.set('derniereGps', S.ui.posGps);
        e.lat = pCapt.lat;
        e.lon = pCapt.lon;
        var r = Moteur.quartierLePlusProche(pCapt.lat, pCapt.lon, quartiers());
        if (r && r.quartier) {
          if (!e.quartier || /^NL$/i.test(e.quartier)) e.quartier = r.quartier.quartier;
          if (!e.commune || /^NL$/i.test(e.commune)) e.commune = r.quartier.commune;
        }

        // 1. Mettre à jour dans S.data.etablissements
        S.data = S.data || {};
        S.data.etablissements = S.data.etablissements || [];
        var etabTrouve = S.data.etablissements.filter(function (x) { return normaliser(x.nom) === normaliser(nomEtab) || (typeof memeEtablissement === 'function' && memeEtablissement(x.nom, nomEtab)); })[0];
        if (etabTrouve) {
          etabTrouve.lat = pCapt.lat;
          etabTrouve.lon = pCapt.lon;
          if (e.quartier) etabTrouve.quartier = e.quartier;
          if (e.commune) etabTrouve.commune = e.commune;
        } else {
          S.data.etablissements.push({
            code: e.code || ('ETAB-' + ('00' + (S.data.etablissements.length + 1)).slice(-3)),
            nom: nomEtab,
            commune: e.commune || '',
            quartier: e.quartier || '',
            lat: pCapt.lat,
            lon: pCapt.lon,
            telephone: e.telephone || '',
            reperes: e.reperes || ''
          });
        }

        // 2. Répercuter sur toutes les présences de cet établissement
        ((S.data && S.data.presences) || []).forEach(function (x) {
          if (normaliser(x.lieu || '') === normaliser(nomEtab) || (typeof memeEtablissement === 'function' && memeEtablissement(x.lieu, nomEtab))) {
            x.lat = pCapt.lat;
            x.lon = pCapt.lon;
            if (e.quartier) x.quartier = e.quartier;
            if (e.commune) x.commune = e.commune;
          }
        });

        // 3. Répercuter sur l'objet en mémoire
        (e.pres || []).forEach(function (x) {
          x.lat = pCapt.lat;
          x.lon = pCapt.lon;
          if (e.quartier) x.quartier = e.quartier;
          if (e.commune) x.commune = e.commune;
        });

        // 4. Enregistrer dans le cache local et re-rendre
        LS.set('data', S.data);
        ctxCache.data = null;
        rendre();

        // 5. Envoyer au serveur (action: 'etablissement')
        var payload = {
          nom: nomEtab,
          quartier: e.quartier || '',
          commune: e.commune || '',
          lat: pCapt.lat,
          lon: pCapt.lon,
          originegps: 'Repertoire Hopital (±' + p.prec + 'm)'
        };
        if (e.code) payload.code = e.code;
        apiPost('etablissement', payload).then(function () {
          if (!S.config.demo && connecte()) synchroniser(true);
        }).catch(function (err) {
          console.warn('Erreur envoi etablissement:', err);
        });

        toast('GPS fixé pour ' + nomEtab + ' (± ' + p.prec + ' m)' + (S.config.demo ? '.' : ', envoyé au Google Sheet.'));
      }

      if (refGeo && distKm > 3) {
        var distArr = Math.round(distKm);
        confirmerPuis('Écart de position important',
          '<div style="color:var(--primaire,#0A6C74);font-weight:700;margin-bottom:8px">Attention : vous êtes à ' + distArr + ' km de ' + esc(nomEtab) + ' !</div>' +
          '<p style="margin:0 0 8px">Ce bouton sert uniquement lorsque vous êtes <b>physiquement devant cet établissement</b>.</p>' +
          '<p style="margin:0">Voulez-vous vraiment fixer cette position pour <b>' + esc(nomEtab) + '</b> ?</p>',
          'Fixer la position',
          sauverHopital,
          function () { toast('Position inchangée.'); }
        );
        return;
      }

      sauverHopital();
    }, function () { toast('Position indisponible. Autorisez la localisation.'); });
  }

