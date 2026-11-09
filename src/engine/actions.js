  var ACTIONS = {
    nav: function (el) {
      if (S.ui.feuille && el && el.closest && el.closest('.entete')) S.ui.feuille = null;   // 3.26.93 : la roue crantée referme la fenêtre ouverte
      var dest = el.dataset.tab;
      if (dest === 'semaine' && S.ui.tab !== 'semaine' && (!S.plan.length || S.ui.voirParams)) etapesPDepuisDebut();
      // 3.25.42 : Gestion de l'onglet Suivi unifié et compatibilité avec equipe/bilan
      if (dest === 'suivi' || dest === 'bilan' || dest === 'equipe') {
        if (dest === 'bilan' || dest === 'equipe') {
          S.ui.suiviVue = dest;
          LS.set('suiviVue', dest);
        } else if (!S.ui.suiviVue) {
          S.ui.suiviVue = 'bilan';
        }
        if (dest === 'bilan' || (dest === 'suivi' && S.ui.suiviVue === 'bilan')) {
          S.ui.statsVue = 'tableau'; LS.set('statsVue', 'tableau');
        }
        dest = 'suivi';
      }
      if (S.ui.tab === 'semaine' && dest !== 'semaine') { S.ui.jourPlan = S.ui.jour; S.ui.jour = S.ui.jourJournee || aujourdhui(); }
      else if (S.ui.tab !== 'semaine' && dest === 'semaine') { S.ui.jourJournee = S.ui.jour; if (S.ui.jourPlan) S.ui.jour = S.ui.jourPlan; else S.ui.planInit = false; }
      S.ui.tab = dest; S.ui.pharmaciesProches = false;
      // 3.26.50 : Journée s'ouvre toujours sur aujourd'hui (centré dans la frise, grisé si non ouvré)
      if (dest === 'jour') { var tj = aujourdhui(); if (datesPlan().indexOf(tj) >= 0) { S.ui.jour = tj; S.ui.jourVue = null; } else S.ui.jourVue = tj; S.ui.ouvert = null; }
      if (S.ui.tab === 'historique') { S.ui.tab = 'suivi'; S.ui.suiviVue = 'bilan'; S.ui.statsVue = 'historique'; }
      S.ui.feuille = null;
      rendre(); window.scrollTo(0, 0);
      if (S.ui.tab === 'suivi' && S.ui.suiviVue === 'equipe') rafraichirEquipe().then(function (ok) { if (ok && S.ui.tab === 'suivi' && S.ui.suiviVue === 'equipe') rendreSiPossible(); });
    },
    suiviVue: function (el) {
      S.ui.suiviVue = el.dataset.v;
      LS.set('suiviVue', S.ui.suiviVue);
      rendre();
      if (S.ui.suiviVue === 'equipe') rafraichirEquipe().then(function (ok) { if (ok && (S.ui.tab === 'suivi' || S.ui.tab === 'equipe')) rendreSiPossible(); });
    },
    auditFiltrer: function (el) {
      S.ui.auditFiltre = el.dataset.v;
      rendre();
    },
    reinitFiltresProduits: function () {
      S.ui.rechProduit = '';
      S.ui.aireProduit = '';
      rendre();
    },
    crAucunProduit: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = a.cr;
      c.presentes = 'non';
      c.produits = [];
      c.autres = '';
      majCr(a);
      rendre();
    },
    crStatutExpress: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      c.statut = el.dataset.v; appliquerStatutExpress(c);
      syncCr(a);
      LS.set('plan', S.plan);
      rendre();
      centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crEtapeRapide: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      c.prochaine = el.dataset.v || '';
      syncCr(a);
      LS.set('plan', S.plan);
      rendre();
    },
    basculerModeComplet: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      a.modeComplet = true; delete crDe(a).statut;
      rendre();
      centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    basculerModeExpress: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      a.modeComplet = false;
      rendre();
      centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    param: function (el) {
      S.params[el.dataset.k] = el.dataset.v; LS.set('params', S.params);
      if (el.dataset.auto) { S.ui.etapesP.ok[el.dataset.auto] = true; sauverEtapesP(); }
      rendre();
    },
    pEtapePrec: function (el) { S.ui.etapesP.ok[el.dataset.v] = false; sauverEtapesP(); rendre(); },
    pEtapeOk: function (el) { S.ui.etapesP.ok[el.dataset.v] = true; sauverEtapesP(); rendre(); },
    pEtapePasser: function (el) {
      var k = el.dataset.v;
      if (k === 'spec') S.params.specialites = []; if (k === 'valeur') S.params.potentiels = [];
      LS.set('params', S.params); S.ui.etapesP.ok[k] = true; sauverEtapesP(); rendre();
    },
    resumeEditer: function (el) {
      // la tuile touchée ouvre exactement cette option (les autres, déjà répondues, restent repliées)
      var ok = S.ui.etapesP.ok;
      etapesParams().forEach(function (e) { ok[e.id] = e.id !== el.dataset.v; });
      sauverEtapesP(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0);
    },
    pEtapeEditer: function (el) { S.ui.etapesP.ok[el.dataset.v] = false; sauverEtapesP(); rendre(); },
    voirParams: function () { etapesPDepuisDebut(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0); },
    planifierDate: function (el) {
      // Journée vide → Planifier, période réglée sur ce jour (les autres réponses déjà données sont reprises)
      S.params.mode = 'jour'; S.params.dateRef = el.dataset.v; LS.set('params', S.params);
      // période déjà connue (ce jour) : le parcours reprend à l'étape 2, la période reste modifiable
      etapesPDepuisDebut(); S.ui.etapesP.ok.quand = true; sauverEtapesP();
      S.ui.tab = 'semaine'; S.ui.voirParams = true; S.ui.feuille = null; rendre(); window.scrollTo(0, 0);
    },
    ouvrirAnciens: function () { S.ui.feuille = { type: 'anciens', titre: 'Reprendre un ancien programme', pleine: true }; rendre(); },
    reprendre: function (el) { var f = S.ui.feuille; f.source = { type: el.dataset.t, valeur: el.dataset.v }; f.cible = cibleParDefaut(el.dataset.t, el.dataset.v); rendre(); },
    repriseRetour: function () { S.ui.feuille.source = null; rendre(); },
    repriseConfirmer: function () { var f = S.ui.feuille; reprendreProgramme(f.source.type, f.source.valeur, f.cible); },
    repriseConserver: function () { S.ui.annulReprise = null; LS.set('annulReprise', null); rendre(); toast('Programme repris conservé.'); },
    repriseAnnuler: function () {
      var r = S.ui.annulReprise; if (!r) return;
      S.plan = r.plan; if (r.jours) S.jours = r.jours; S.ui.annulReprise = null; LS.set('annulReprise', null);
      S.ui.jour = null; sauver(); rendre(); publierPlan(true); toast('Retour à l\'ancienne planification.');
    },
    fermerParams: function () { S.ui.voirParams = false; rendre(); window.scrollTo(0, 0); },
    voirVisite: function (el) {
      if (S.ui.tab === 'semaine') {
        var a = arret(el.dataset.uid);
        if (a) {
          S.ui.feuille = { type: 'visitePlan', titre: a.nom, uid: a.uid };
          rendre();
          return;
        }
      }
      S.ui.tab = 'jour'; S.ui.ouvert = el.dataset.uid; rendre(); var c = document.querySelector('.arret.ouvert'); if (c) c.scrollIntoView({ block: 'start' });
    },
    planChangerJour: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = (ctx().parCode[a.code] || []).filter(function (cr) { return String(cr.idPresence) === String(a.idPresence); })[0] || (ctx().parCode[a.code] || [])[0];
      if (c) {
        S.ui.feuille = { type: 'planifierDate', cle: c.cle, d: a.date, d0: prochainJourOuvre(a.date), uidDeplacer: a.uid, titre: 'Déplacer ' + a.nom };
      } else {
        S.ui.feuille = null;
        toast('Créneau de présence introuvable.');
      }
      rendre();
    },
    garderPlan: function (el) { ACTIONS.garder(el); if (S.ui.feuille && S.ui.feuille.type === 'visitePlan') S.ui.feuille = null; rendre(); },
    retirerPlan: function (el) { ACTIONS.retirer(el); if (S.ui.feuille && (S.ui.feuille.type === 'visitePlan' || S.ui.feuille.type === 'remplacer')) S.ui.feuille = null; rendre(); },
    voirDansJournee: function (el) { S.ui.feuille = null; S.ui.tab = 'jour'; S.ui.ouvert = el.dataset.uid; rendre(); },
    ouvrirAutour: function () { S.ui.pharmaciesProches = false; S.ui.rechAutourLibre = ''; S.ui.tab = 'autour'; positionConnue(); rendre(); window.scrollTo(0, 0); localiser(true, 'position', true); },
    generer: function () { lancerTirage('nouveau'); },
    tirage: function (el) { lancerTirage(el.dataset.v); },
    jour: function (el) {
      if (el && el.__bloqueClic && Date.now() < el.__bloqueClic) return;
      var b = el.parentNode; if (b && b.classList.contains('bj-jours')) S.ui.bjDepart = el.getBoundingClientRect().left - b.getBoundingClientRect().left;
      S.ui.jour = el.dataset.v; S.ui.jourVue = null; S.ui.ouvert = null; S.ui.jourSupprime = null; rendre();
    },
    planifierJourSupprime: function (el) { S.ui.jourSupprime = null; S.ui.jour = el.dataset.v; lancerTirage('jour'); },
    supprimerJour: function (el) {
      var d = el.dataset.v || S.ui.jour;
      demanderSuppressionJour(d);
    },
    jourDecaler: function (el) {
      var d = jourAffiche(), sens = +el.dataset.v;
      do { d = ajouterJours(d, sens); } while (jourSemaineIndex(d) > 4);
      allerAuJour(d);
    },
    jourAujourdhui: function () { allerAuJour(aujourdhui()); },
    jourAller: function (el) {
      var b = el.parentNode; if (b) S.ui.bjDepart = el.getBoundingClientRect().left - b.getBoundingClientRect().left;
      allerAuJour(el.dataset.v);
    },
    jourSemaine: function (el) { allerAuJour(ajouterJours(lundiDe(jourAffiche()), 7 * +el.dataset.v)); },
    ouvrirVisite: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      if (a.date !== jourAffiche() && !a.hors) { S.ui.jour = a.date; S.ui.jourVue = null; }
      S.ui.tab = 'jour'; S.ui.ouvert = a.uid; rendre(); centrerCarte(a.uid, S.ui.dernierClicY);
    },
    ajouterJour: function () { S.ui.dateAjout = jourAffiche(); S.ui.typeAjout = null; S.ui.feuille = { type: 'ajouterJour', titre: 'Ajouter à la journée' }; rendre(); },
    ajouterJourChoix: function (el) {
      S.ui.feuille = null; var v = el.dataset.v;
      if (v === 'autour') ACTIONS.ouvrirAutour(); else ACTIONS.ajouterProches({ dataset: { v: v } });
    },
    allerRapport: function () { S.ui.tab = 'rapport'; rendre(); centrerQuestionRapport(); },
    ouvrirRapport: function () { S.ui.tab = 'rapport'; rendre(); centrerQuestionRapport(); },
    ouvrirBilan: function () { S.ui.tab = 'bilanjour'; rendre(); window.scrollTo(0, 0); },
    bilanModifier: function (el) { var R = rapportOuCree(el.dataset.v); R.edition = true; R.ok = {}; sauverRapports(); S.ui.tab = 'rapport'; rendre(); centrerQuestionRapport(); },
    rapOk: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = true; sauverRapports(); rendre(); centrerQuestionRapport(); },
    rapPrec: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = false; sauverRapports(); rendre(); centrerQuestionRapport(); },
    rapPasser: function (el) {
      var R = rapportOuCree(jourAffiche()), k = el.dataset.v;
      if (k === 'besoins') { R.besoins = []; R.besoinsTexte = ''; } else R[k] = '';
      R.ok[k] = true; sauverRapports(); rendre(); centrerQuestionRapport();
    },
    rapEditer: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = false; sauverRapports(); rendre(); centrerQuestionRapport(); },
    sortirRapport: function () { S.ui.tab = 'jour'; rendre(); window.scrollTo(0, 0); },
    calOuvrir: function (el) {
      var plan = el && el.dataset && el.dataset.ctx === 'plan', d = plan ? (S.ui.jour || aujourdhui()) : jourAffiche();
      S.ui.feuille = { type: 'calendrierJour', titre: plan ? 'Date à planifier' : 'Choisir une date', date: d, mois: d.slice(0, 7), ctx: plan ? 'plan' : '' };
      rendre();
    },
    calChangerMois: function (el) {
      var f = S.ui.feuille;
      if (!f || f.type !== 'calendrierJour') return;
      var parts = f.mois.split('-'), y = +parts[0], m = +parts[1] + (+el.dataset.v);
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      f.mois = y + '-' + pad2(m);
      rendreFeuille();
    },
    calChoisirJour: function (el) {
      var d = el.dataset.v, f = S.ui.feuille;
      S.ui.feuille = null;
      if (f && f.ctx === 'plan') {
        // Planifier : jour déjà planifié -> sélectionné ; sinon la planification s'ouvre sur cette date
        if (d < aujourdhui()) { toast('On ne planifie pas un jour passé.'); rendre(); return; }
        if (datesPlan().indexOf(d) >= 0) { S.ui.jour = d; rendre(); return; }
        S.params.dateRef = d; S.params.mode = 'jour'; LS.set('params', S.params); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0); return;
      }
      allerAuJour(d);
    },
    calAllerAujourdhui: function () {
      S.ui.feuille = null;
      allerAuJour(aujourdhui());
    },
    rapBesoin: function (el) {
      var R = rapportOuCree(jourAffiche()), l = R.besoins || (R.besoins = []), v = el.dataset.v;
      if (v === '__tous') {
        var tous = BESOINS_JOUR.every(function (b) { return l.indexOf(b) >= 0; });
        R.besoins = tous ? [] : BESOINS_JOUR.slice();
      } else {
        var i = l.indexOf(v);
        if (i >= 0) l.splice(i, 1); else l.push(v);
      }
      sauverRapports(); rendre();
    },
    rapValider: function (el) {
      var d = el.dataset.v, R = rapportOuCree(d);
      if (R.valideLe && R.empreinte === empreinteRapport(R)) { R.edition = false; sauverRapports(); rendre(); toast('Aucune modification : le compte rendu est inchangé.'); return; }
      confirmerPuis('Valider le compte rendu', 'Valider le compte rendu du <b>' + dateFr(d) + '</b> ? Il sera enregistré dans la BDD.', 'Valider', function () {
        var n = new Date(); R.valideLe = dateFr(d) === dateFr(aujourdhui()) ? pad2(n.getHours()) + ':' + pad2(n.getMinutes()) : dateFr(aujourdhui());
        R.edition = false; R.envoye = false; R.empreinte = empreinteRapport(R); sauverRapports(); rendre();
        if (connecte()) envoyerRapport(d).then(function () { toast('Compte Rendu enregistré. Vous pouvez l\'envoyer sur WhatsApp.'); }, function () { toast('Enregistré sur le téléphone ; envoi à la BDD dès le retour du réseau.'); });
        else toast('Compte Rendu validé.');
      });
    },
    rapModifier: function (el) { var R = rapportOuCree(el.dataset.v); R.edition = true; R.ok = {}; sauverRapports(); rendre(); },
    rapWhatsapp: function (el) { var Rw = rapportDe(el.dataset.v); if (Rw) { Rw.waLe = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(' ', ' à '); sauverRapports(); } ouvrirWhatsapp(texteRapport(el.dataset.v), S.config.waResp); },
    rapCopier: function (el) { copier(texteRapport(el.dataset.v)); },
    jourReprendre: function (el) {
      var d = el.dataset.v;
      confirmerPuis('Reprendre ce programme', 'Remplacer votre tournée en cours par le programme du <b>' + dateFr(d) + '</b> ?<br><span class="discret">Vous pourrez revenir à l\'ancienne planification.</span>',
        'Reprendre', function () { S.ui.jourVue = null; reprendreProgramme('jour', d, d); });
    },
    quitterCarte: function () { S.ui.ouvert = null; rendre(); },
    ouvrir: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      S.ui.ouvert = S.ui.ouvert === el.dataset.uid ? null : el.dataset.uid; rendre();
      if (S.ui.ouvert) centrerCarte(S.ui.ouvert, S.ui.dernierClicY);
    },
    garder: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.garde = !a.garde; if (a.garde) delete S.rejetes[a.code];
      LS.set('plan', S.plan); rendre();
    },
    statut: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.statut = a.statut === el.dataset.v ? '' : el.dataset.v; horodater(a);
      LS.set('plan', S.plan); rendre();
    },
    retirer: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      confirmerPuis('Retirer de la tournée', 'Retirer <b>' + esc(a.nom) + '</b> de votre tournée du ' + dateFr(a.date) + ' ?', 'Retirer', function () { retirerArret(a.uid); });
    },
    retirerConfirme: function (el) { retirerArret(el.dataset.uid); },

    rattraper: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      if (!a.statut) { a.statut = 'Absent'; horodater(a); }
      LS.set('plan', S.plan);
      S.ui.autour = Object.assign(S.ui.autour, { lat: a.lat, lon: a.lon, label: a.quartier, moment: a.date === aujourdhui() ? 'maintenant' : 'choisir',
        date: a.date, heure: a.heure, ref: { nom: a.nom, code: a.code, cle: a.cle, date: a.date, heure: a.heure, quartier: a.quartier, creneau: a.creneau } });
      LS.set('autour', S.ui.autour);
      S.ui.tab = 'autour'; S.ui.pharmaciesProches = false; rendre(); window.scrollTo(0, 0);
    },
    validerProgramme: function () {
      var dates = joursBrouillon();
      confirmerPuis('Confirmer la tournée', 'Confirmer ' + (dates.length > 1 ? 'les ' + dates.length + ' jours en brouillon (' + dates.map(dateCourte).join(', ') + ')' : 'le ' + dateFr(dates[0])) +
        ' ? Ils seront visibles par l\'équipe.<br><span class="discret">Non : vous reprenez le parcours de planification. Sortir : rien ne change.</span>', 'Confirmer', function () { confirmerProgramme(dates); },
        function () { etapesPDepuisDebut(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0); });
    },
    // après « Recalculer ce jour » : la sélection convient (le jour est confirmé) ou on recalcule encore
    procheOui: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var now = minutesMaintenant(), jour = S.plan.filter(function (x) { return x.date === a.date; });
      // les visites déjà renseignées restent à leur heure ; celle-ci est placée maintenant, les suivantes sont recalculées
      jour.forEach(function (x) { if (x.statut) x.fixe = x.heure; });
      a.avance = minutesVersHeure(Math.ceil(now / 5) * 5);
      reordonner(a.date);
      jour.forEach(function (x) { delete x.fixe; });
      sauver(); rendre(); publierPlan();
      var n = arret(a.uid); toast(a.nom + (el.dataset.ajout ? ' ajouté' : ' ramené') + ' maintenant (' + (n ? n.heure : a.avance) + ') ; les visites suivantes sont recalculées.', 4500);
    },
    pharmaOui: function (el) {
      if ($('alerteProche')) $('alerteProche').hidden = true;
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), t = aujourdhui(); if (!c) return;
      if (!ajouterArret(c, t)) { rendre(); return; }
      var a = S.plan.filter(function (x) { return x.date === t && x.code === c.code; })[0];
      ACTIONS.procheOui({ dataset: { uid: a.uid, ajout: '1' } });
    },
    pharmaNon: function (el) {
      if ($('alerteProche')) $('alerteProche').hidden = true;
      var r = LS.get('refusPharmacies', {}); if (r.d !== aujourdhui()) r = { d: aujourdhui(), codes: {} };
      r.codes[el.dataset.v] = true; LS.set('refusPharmacies', r); rendre();
    },
    procheNon: function (el) {
      var r = LS.get('refusProches', {}); if (r.d !== aujourdhui()) r = { d: aujourdhui(), uids: {} };
      r.uids[el.dataset.uid] = true; LS.set('refusProches', r); rendre();
    },
    accepterJour: function () {
      var d = S.ui.aAccepter || S.ui.jour, b = joursBrouillon();
      if (b.indexOf(d) < 0 && !jourConfirme(d)) b.push(d);
      var autres = b.filter(function (x) { return x !== d; });
      if (autres.length > 0) {
        S.ui.feuille = { type: 'choixAccepter', titre: 'Confirmer la tournée', jour: d, jours: b.slice().sort() };
        rendre();
        return;
      }
      confirmerProgramme([d], false);
    },
    accepterPortee: function (el) {
      var f = S.ui.feuille || {}, d = f.jour || S.ui.jour, b = f.jours || joursBrouillon();
      confirmerProgramme(el.dataset.v === 'jour' ? [d] : b, true);
    },
    annulerConfirmation: function () {
      var f = S.ui.feuille || {}, l = f.dates || [];
      if (f.avantJours) {
        Object.keys(f.avantJours).forEach(function (d) { S.jours[d] = f.avantJours[d]; });
      } else {
        mettreBrouillon(l);
      }
      if (f.avantAAccepter) S.ui.aAccepter = f.avantAAccepter;
      S.ui.flashValide = 0;
      sauver(); publierPlan(true);
      var b = joursBrouillon();
      if (f.depuisChoix && b.length > 1) {
        S.ui.feuille = { type: 'choixAccepter', titre: 'Confirmer la tournée', jour: S.ui.jour, jours: b };
      } else {
        S.ui.feuille = null;
        toast('Confirmation annulée : retour au brouillon.');
      }
      rendre();
    },
    // 3.25.22 : Accepter valide puis propose WhatsApp (Oui/Non/Retour) ; Ne pas accepter : revenir à la liste précédente ou relancer un tirage
    accepterProgramme: function () { confirmerProgramme(joursBrouillon(), false); },
    refuserProgramme: function (el) { S.ui.feuille = { type: 'refusProgramme', titre: 'Refuser cette sélection ?', jour: el.dataset.v === 'jour' }; rendre(); },
    continuerModifier: function () {
      var j = S.ui.feuille && S.ui.feuille.jour; S.ui.feuille = null;
      if (j) { S.ui.aAccepter = null; rendre(); toast('Ajoutez, retirez ou épinglez des médecins, puis recalculez.'); return; }
      etapesPDepuisDebut(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0);
    },
    quitterSansValider: function () { S.ui.feuille = null; S.ui.aAccepter = null; S.ui.tab = 'jour'; rendre(); window.scrollTo(0, 0); toast('Tournée laissée en brouillon, non envoyée à l\'équipe.'); },
    recalculerEncore: function () { S.ui.feuille = null; lancerTirage('jour'); },
    restaurerAvantTirage: function () {
      var av = S.ui.avantTirage;
      S.ui.feuille = null; S.ui.aAccepter = null;
      if (av && av.date) {
        S.plan = S.plan.filter(function (a) { return a.date !== av.date; }).concat(av.arrets || []);
        trierPlan();
        if (av.jourEtat) S.jours[av.date] = av.jourEtat;
        if (av.rejetes) S.rejetes = av.rejetes;
        S.ui.avantTirage = null; S.ui.avantJJ = null;
        sauver(); rendre(); publierPlan(true);
        toast('Liste précédente restaurée.');
        return;
      }
      rendre();
    },
    confirmerProgrammeDirect: function () { confirmerProgramme(); },

    corriger: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return; a.etat = 'correction'; a.corrige = true; a.empreinte = empreinteCr(a);
      var c = crDe(a); c.ok = c.ok || {}; etapesCr(a).forEach(function (x) { if (x.id && x.id.indexOf('__') !== 0) c.ok[x.id] = true; }); S.ui.ouvert = a.uid; LS.set('plan', S.plan); rendre();
      centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    ouvrirExport: function () {
      var f = S.ui.feuille, l = f && f.type === 'valide' ? f.dates || [] : [S.ui.jour];
      if (l.length === 1) S.ui.jour = l[0];
      S.ui.feuille = { type: 'exporter', titre: 'Aperçu du message WhatsApp', portee: l.length > 1 ? 'semaine' : 'jour', retourValide: f && f.type === 'valide' ? f : null, retourAction: 'retourExport' };
      rendre();
    },
    partagerJourWhatsapp: function () {
      S.ui.feuille = { type: 'exporter', titre: 'Aperçu du message WhatsApp', portee: 'jour', retourValide: null, retourAction: 'fermerFeuille' };
      rendre();
    },
    retourExport: function () {
      var f = S.ui.feuille;
      if (f && f.retourValide) { S.ui.feuille = f.retourValide; rendre(); return; }
      S.ui.feuille = null; rendre();
    },
    ajouterTournee: function (el) {
      S.ui.filtresAutour = JSON.parse(JSON.stringify(S.ui.filtres));
      LS.set('filtresAutour', S.ui.filtresAutour);
      S.ui.dateAjout = (el && el.dataset && el.dataset.d) || S.ui.jour; S.ui.typeAjout = null;
      if (S.ui.tab === 'semaine') {
        S.ui.feuille = { type: 'ajouterCommunes', titre: 'Ajouter au ' + dateCourte(S.ui.dateAjout), pleine: true };
        rendre();
        return;
      }
      S.ui.feuille = { type: 'ajouterTournee', titre: 'Autour de moi, ' + dateCourte(S.ui.dateAjout) }; rendre();
    },
    ajouterTourneeChoix: function (el) {
      var j = S.ui.dateAjout || S.ui.jour;
      if (el.dataset.v === 'position' && S.ui.typeAjout) { S.ui.feuille = null; ACTIONS.ajouterProches({ dataset: { v: S.ui.typeAjout, d: j, src: 'position' } }); return; }
      if (el.dataset.v === 'position') {
        S.ui.feuille = null;
        S.ui.filtresAutour = JSON.parse(JSON.stringify(S.ui.filtres));
        LS.set('filtresAutour', S.ui.filtresAutour);
        Object.assign(S.ui.autour, j === aujourdhui() ? { moment: 'maintenant', ref: null } : { moment: 'choisir', date: j, heure: '', ref: null }); LS.set('autour', S.ui.autour);
        S.ui.pharmaciesProches = false; S.ui.rechAutourLibre = ''; S.ui.tab = 'autour'; positionConnue(); rendre(); window.scrollTo(0, 0); localiser(true, 'position', true);
        return;
      }
      if (el.dataset.v === 'zone') {
        var zR = LS.get('rechZonePh', null) || {};
        S.ui.feuille = { type: 'ajouterZonePharma', titre: 'Pharmacies dans une zone, ' + dateCourte(j), pleine: true,
          z: { communes: (zR.communes || []).slice(), moment: zR.moment && (zR.moment !== 'maintenant' || j === aujourdhui()) ? zR.moment : (j === aujourdhui() ? 'maintenant' : 'tout') } };
        rendre(); localiser(true, 'position', true); return;
      }
      if (el.dataset.v === 'hopitaux') {
        var hR = LS.get('rechHop', null) || {}; 
        S.ui.feuille = { type: 'ajouterHopitaux', titre: 'Dans des hôpitaux, ' + dateCourte(j), pleine: true,
          h: { lieux: (hR.lieux || []).slice(), specs: (hR.specs || []).slice(), moment: hR.moment && (hR.moment !== 'maintenant' || j === aujourdhui()) ? hR.moment : 'tout' } };
        rendre(); localiser(true, 'position', true); return;
      }
      if (el.dataset.v === 'tout') {
        var tNom = S.ui.typeAjout === 'Médecin' ? 'Tous les médecins' : (S.ui.typeAjout === 'Pharmacie' ? 'Toutes les pharmacies' : 'Tout le répertoire');
        S.ui.feuille = { type: 'ajouterTout', titre: tNom + ', ' + dateCourte(j), pleine: true, q: '' };
        rendre(); localiser(true, 'position', true); return;
      }
      S.ui.feuille = { type: 'ajouterCommunes', titre: (S.ui.typeAjout ? 'Selon mes filtres, ' : 'Communes du ') + dateCourte(j), pleine: true }; rendre();
    },
    hopMoment: function (el) { var f = S.ui.feuille; if (!f) return; (f.h || f.z).moment = el.dataset.v; rendre(); },
    ajouterCandidat: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), d = S.ui.dateAjout || S.ui.jour; if (!c) return;
      var fAvant = S.ui.feuille && JSON.parse(JSON.stringify(S.ui.feuille));
      var retourAjout = function () { S.ui.feuille = el.dataset.r === 'recherche' && fAvant ? fAvant : { type: 'ajouterCommunes', titre: (S.ui.typeAjout ? 'Selon mes filtres, ' : 'Communes du ') + dateCourte(d), pleine: true }; rendre(); };
      confirmerPuis('Ajouter à la tournée', 'Ajouter <b>' + esc(c.prat.nom) + '</b> (' + esc(c.lieu) + ', ' + c.creneau.toLowerCase() + ') au ' + dateFr(d) + ' ?', 'Ajouter',
        function () { ajouterArret(c, d); rendre(); }, retourAjout);
    },
    ajouterToutPrat: function (el) {
      var code = el.dataset.code, d = S.ui.dateAjout || S.ui.jour || aujourdhui(), p = ctx().prat[code];
      if (!p) return;
      var deja = S.plan.filter(function (a) { return a.date === d && a.code === code; })[0];
      if (deja) {
        toast(esc(p.nom) + ' est déjà dans la tournée du ' + dateCourte(d) + '.');
        return;
      }
      var fAvant = S.ui.feuille && JSON.parse(JSON.stringify(S.ui.feuille));
      var retourAjout = function () { S.ui.feuille = fAvant || { type: 'ajouterTout', titre: 'Tout le répertoire, ' + dateCourte(d), pleine: true, q: '' }; rendre(); };
      confirmerPuis('Ajouter à la tournée', 'Ajouter <b>' + esc(p.nom) + '</b> à la tournée du ' + dateFr(d) + ' ?', 'Ajouter', function () {
        var jIdx = jourSemaineIndex(d);
        var crJour = (ctx().parCode[code] || []).filter(function (x) { return x.jourIdx === jIdx; });
        var ok = false;
        if (crJour.length) {
          ok = ajouterArret(crJour[0], d);
        } else {
          ok = forcerArretJour(code, d);
          if (ok) {
            sauver();
            publierPlan();
            var cib = cibleParCollegues(code, d);
            toast('Ajouté au ' + dateCourte(d) + (cib.length ? ', attention : aussi prévu par ' + cib[0].delegue : '') + '.');
          }
        }
        if (ok) {
          S.ui.feuille = null;
          S.ui.tab = 'jour';
          S.ui.jour = d;
          S.ui.jourVue = null;
          window.scrollTo(0, 0);
          rendre();
        }
      }, retourAjout);
    },
    exportPortee: function (el) { S.ui.feuille.portee = el.dataset.v; rendre(); },
    envoyerWhatsapp: function () {
      var txt = S.ui.feuille && S.ui.feuille.texte;
      if (!txt) return;
      ouvrirWhatsapp(txt, S.config.whatsapp);
      S.ui.feuille = null; rendre();
    },
    copierTexte: function () { copier(S.ui.feuille.texte); },
    partagerTexte: function () { navigator.share({ title: 'Programme de tournée', text: S.ui.feuille.texte }).catch(function () {}); },
    fermerFeuille: function (el, force) {
      var f = S.ui.feuille;
      if (f && f.type === 'fiche' && !force && f.donnees && (f.donnees.nom || (f.donnees.lieux && f.donnees.lieux.some(function (l) { return l.lieu || l.commune; })))) {
        confirmerPuis('Abandonner les modifications ?', 'Vous avez des données non enregistrées sur cette fiche. Quitter sans enregistrer ?', 'Quitter', function () {
          ACTIONS.fermerFeuille(null, true);
        });
        return;
      }
      if (f && f.type === 'listeChoix') { S.ui.feuille = f.retour || null; if (f.dom) rendreFeuille(); else rendre(); return; }
      if (f && f.type === 'contactFiche') { S.ui.feuille = f.retour || null; rendre(); return; }
      S.ui.feuille = null; rendre();
    },
    couvPortee: function (el) { S.ui.couvPortee = el.dataset.v; LS.set('couvPortee', S.ui.couvPortee); rendre(); },
    couvOuvrir: function () { S.ui.couvOuverte = !S.ui.couvOuverte; rendre(); },
    couvInterieurToggle: function () { S.ui.couvInterieurOuverte = !S.ui.couvInterieurOuverte; rendre(); },
    couvFiltre: function (el) { S.ui.couvFiltre = el.dataset.v; LS.set('couvFiltre', S.ui.couvFiltre); rendre(); },
    // Communes
    choisirCommunes: function (el) {
      var cle = el.dataset.v, sel = cle === 'tout' ? S.params.communes : (S.params.communesJour[cle] || []);
      S.ui.feuille = { type: 'communes', titre: cle === 'tout' ? 'Communes ciblées' : 'Communes du ' + JOURS[+cle].toLowerCase(), cle: cle, sel: sel.slice() };
      rendre();
    },
    communeToggle: function (el) {
      var f = S.ui.feuille, c = el.dataset.v, i = f.sel.indexOf(c);
      if (i >= 0) f.sel.splice(i, 1); else f.sel.push(c);
      rendre();
    },
    zoneToggle: function (el) {
      var f = S.ui.feuille, l = communesListe().filter(function (c) { return c.zone === el.dataset.v; }).map(function (c) { return c.commune; });
      var tous = l.every(function (c) { return f.sel.indexOf(c) >= 0; });
      l.forEach(function (c) { var i = f.sel.indexOf(c); if (tous && i >= 0) f.sel.splice(i, 1); if (!tous && i < 0) f.sel.push(c); });
      rendre();
    },
    communesToutes: function () {
      var f = S.ui.feuille;
      var tout = [];
      sectionsCommunes().forEach(function (sec) {
        sec.options.forEach(function (op) {
          if (op.estSecteur || !op.parent) tout.push(op.v);
        });
      });
      f.sel = tout;
      rendre();
    },
    communesAucune: function () { S.ui.feuille.sel = []; rendre(); },
    communesOk: function () {
      var f = S.ui.feuille;
      if (f.cle === 'tout') {
        S.params.communes = f.sel.slice();
        // 3.25.35 : Harmonisation avec le filtre maître (Répertoire / Recherche)
        if (S.ui.filtres) { S.ui.filtres.communes = f.sel.slice(); LS.set('filtres', S.ui.filtres); }
        if (S.ui.filtresAutour) { S.ui.filtresAutour.communes = f.sel.slice(); LS.set('filtresAutour', S.ui.filtresAutour); }
      } else {
        S.params.communesJour[f.cle] = f.sel.slice();
      }
      if (f.cle === 'tout' && !(S.params.mode === 'semaine' && S.params.parJour)) { S.ui.etapesP.ok.ou = true; sauverEtapesP(); }
      LS.set('params', S.params); S.ui.feuille = null; rendre();
    },
    // À voir absolument
    ouvrirRecherche: function () { S.ui.feuille = { type: 'recherche', titre: 'RDV ou médecin prioritaire', q: '' }; rendre(); var i = $('rechercheImpose'); if (i) i.focus(); },
    choisirImpose: function (el) { S.ui.feuille.code = el.dataset.v; S.ui.feuille.cle = ''; rendre(); },
    retourRecherche: function () { S.ui.feuille.code = null; rendre(); },
    ajouterImpose: function () {
      var f = S.ui.feuille, choix = document.querySelector('input[name=impCle]:checked'), rdv = ($('impRdv').value || '').trim();
      var val = choix ? choix.value : '';
      if (val === '__aujourdhui') {
        var tAuj = aujourdhui(), imAuj = { code: f.code, date: tAuj, force: true };
        if (rdv) imAuj.rdv = rdv;
        S.imposes = S.imposes.filter(function (x) { return x.code !== imAuj.code; }).concat([imAuj]);
        forcerArretJour(f.code, tAuj, rdv, f.lieuRef);
        S.ui.jour = tAuj; S.ui.jourVue = null;
        if (!S.ui.voirParams) S.ui.tab = 'jour';
        S.ui.feuille = null; sauver(); rendre(); publierPlan();
        toast('Ajouté à la tournée d\'aujourd\'hui (' + dateCourte(tAuj) + ').');
        return;
      }
      var im = { code: f.code };
      if (val) { var p = val.split('|'); im.date = p[0]; im.cle = p.slice(1).join('|'); }
      if (rdv) im.rdv = rdv;
      S.imposes = S.imposes.filter(function (x) { return x.code !== im.code; }).concat([im]);
      var place = S.plan.length ? placerImpose(im) : false;
      S.ui.feuille = null; sauver(); rendre();
      if (place) publierPlan();
      toast(place ? 'Ajouté à la tournée du ' + dateCourte(S.ui.jour) + '.' : 'Ajouté. Il sera placé à la prochaine proposition de tournée.');
    },
    retirerImpose: function (el) { S.imposes.splice(+el.dataset.i, 1); LS.set('imposes', S.imposes); rendre(); },
    // 3.26.75 : retrait d'un prioritaire ou d'un RDV de l'étape 7, après confirmation (bouton ou appui long)
    retirerImposeDemande: function (el) {
      var i = +el.dataset.i, im = S.imposes[i]; if (!im) return; var pr = praticien(im.code);
      confirmerPuis('Retirer le prioritaire', 'Retirer <b>' + esc(pr ? pr.nom : im.code) + '</b> des prioritaires ?', 'Retirer', function () { S.imposes.splice(i, 1); LS.set('imposes', S.imposes); rendre(); toast('Prioritaire retiré.'); });
    },
    retirerRdvDemande: function (el) {
      var v = el.dataset.v, code = v.split('|')[0], pr = praticien(code);
      confirmerPuis('Retirer le RDV', 'Ne plus placer d\'office le RDV de <b>' + esc(pr ? pr.nom : code) + '</b> dans la tournée ?', 'Retirer', function () { var ig = LS.get('rdvIgnores', {}); ig[v] = true; LS.set('rdvIgnores', ig); rendre(); toast('RDV retiré de la tournée.'); });
    },
    imposerDirect: function (el) { S.ui.feuille = { type: 'recherche', titre: 'Ajouter à ma tournée', code: el.dataset.v, cle: '' }; rendre(); },
    // 3.26.78 : « Ajouter au jour » demande d'abord confirmation
    visiteInopineeDirect: function (el) {
      var code0 = el.dataset.v, p0 = ctx().prat[code0]; if (!p0) return;
      if (!el.dataset.ok) {
        confirmerPuis('Ajouter au jour', 'Ajouter <b>' + esc(p0.nom) + '</b> à votre tournée d\'aujourd\'hui (' + esc(dateCourte(aujourdhui())) + ') ?', 'Ajouter', function () { ACTIONS.visiteInopineeDirect({ dataset: { v: code0, ok: '1' } }); });
        return;
      }
      var code = el.dataset.v, tAuj = aujourdhui();
      var c = ctx(), p = c.prat[code];
      if (!p) return;
      var imAuj = { code: code, date: tAuj, force: true };
      S.imposes = S.imposes.filter(function (x) { return x.code !== code; }).concat([imAuj]);
      forcerArretJour(code, tAuj);
      S.ui.jour = tAuj; S.ui.jourVue = null;
      if (!S.ui.voirParams) S.ui.tab = 'jour';
      sauver(); rendre(); publierPlan();
      toast(p.nom + ' ajouté(e) à la tournée d\'aujourd\'hui (' + dateCourte(tAuj) + ').');
    },
    planifierCle: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v); if (!c) return;
      var d = el.dataset.d || prochaineOccurrence(c.jourIdx, prochainJourOuvre(aujourdhui()), true);
      if (!el.dataset.d) {   // depuis la fiche : choix parmi les prochaines présences (+7, +14…) puis Oui / Non
        S.ui.feuille = { type: 'planifierDate', titre: 'Planifier une visite', cle: el.dataset.v, d: d, d0: d }; rendre(); return;
      }
      confirmerPuis('Planifier une visite', 'Ajouter <b>' + esc(c.prat.nom) + '</b> (' + esc(c.lieu) + ', ' + c.creneau.toLowerCase() + ') à votre tournée du ' + dateFr(d) + ' ?', 'Ajouter',
        function () { if (ajouterArret(c, d)) { S.ui.tab = 'jour'; window.scrollTo(0, 0); } rendre(); });
    },
    planifierDateChoix: function (el) { S.ui.feuille.d = el.dataset.v; rendre(); },
    planifierProchaines: function (el) { S.ui.feuille = { type: 'planifierProchaines', titre: 'Planifier une visite', code: el.dataset.v, sel: '' }; rendre(); },
    planifierProchainesChoix: function (el) { S.ui.feuille.sel = el.dataset.v; rendre(); },
    planifierProchainesOui: function () {
      var f = S.ui.feuille; if (!f || !f.sel) return;
      var i = f.sel.lastIndexOf('@'), c = Moteur.creneauParCle(ctx(), f.sel.slice(0, i)), d = f.sel.slice(i + 1);
      S.ui.feuille = null;
      if (c && ajouterArret(c, d)) { S.ui.tab = 'jour'; S.ui.jour = d; S.ui.jourVue = null; window.scrollTo(0, 0); }
      rendre();
    },
    planifierDateOui: function () {
      var f = S.ui.feuille, c = Moteur.creneauParCle(ctx(), f.cle); S.ui.feuille = null;
      if (f && f.uidDeplacer) {
        var aOld = arret(f.uidDeplacer);
        if (aOld) {
          S.plan = S.plan.filter(function (x) { return x.uid !== aOld.uid; });
          reordonner(aOld.date);
        }
      }
      if (c && ajouterArret(c, f.d)) {
        if (f && f.uidDeplacer) {
          S.ui.jour = f.d;
          toast(c.prat.nom + ' déplacé au ' + dateFr(f.d) + '.');
        } else {
          S.ui.tab = 'jour'; S.ui.jour = f.d; window.scrollTo(0, 0);
        }
      }
      rendre();
    },
    // Autour de moi
    localiser: function () {
      var g = S.ui.posGps, A = S.ui.autour;
      A.src = 'gps';
      if (g && isFinite(g.lat)) {
        var r = Moteur.quartierLePlusProche(g.lat, g.lon, quartiers());
        A.lat = g.lat; A.lon = g.lon; A.prec = g.prec;
        A.quartier = r && r.quartier ? r.quartier.quartier : '';
        A.commune = r && r.quartier ? r.quartier.commune : '';
        A.label = A.quartier ? A.quartier + ' (ma position)' : 'ma position';
        LS.set('autour', A);
        rendre();
      }
      localiser(false, 'position', true);
    },
    // 3.25.9 : enregistre la position GPS du téléphone comme position du lieu (feuille Praticiens/Pharmacies)
    posLieuIci: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), g = S.ui.posGps; if (!c || !g) return;
      confirmerPuis('Position du lieu', 'Enregistrer votre position actuelle (± ' + g.prec + ' m) comme position de <b>' + esc(c.prat.nom) + '</b>, ' + esc(c.lieu || c.quartier) + ' ?', 'Enregistrer', function () {
        var d = brouillonFiche(c.code), l = d.lieux.filter(function (x) { return String(x.id) === String(c.idPresence); })[0];
        if (!l) { toast('Lieu introuvable.'); return; }
        l.lat = +g.lat.toFixed(6); l.lon = +g.lon.toFixed(6); l.origineGps = origineTerrain(g.prec);
        enregistrerFiche(d); rendre(); toast('Position enregistrée' + (S.config.demo ? '.' : ', envoi à la BDD…'));
        if (!S.config.demo) synchroniser(true);
      });
    },
    autourMoment: function (el) { S.ui.autour.moment = el.dataset.v; LS.set('autour', S.ui.autour); rendre(); },
    autourRayon: function (el) { S.ui.autour.rayon = +el.dataset.v; LS.set('autour', S.ui.autour); rendre(); },
    ajouterAutour: function (el) {
      var x = (el.dataset.s === 'libre' ? S.ui.resAutourLibre : S.ui.resAutour)[+el.dataset.i]; if (!x) return;
      var d = el.dataset.d, c = x.c;
      confirmerPuis('Ajouter à la tournée', 'Ajouter <b>' + esc(c.prat.nom) + '</b> (' + esc(c.lieu) + ', ' + c.creneau.toLowerCase() + ' ' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) +
        ') à votre tournée du ' + dateFr(d) + ' ?', 'Ajouter', function () { if (ajouterArret(c, d)) rendre(); else rendre(); });
    },
    finRef: function () { S.ui.autour.ref = null; LS.set('autour', S.ui.autour); rendre(); },
    // Divers
    contact: function (el) {
      // 3.25.34 : au clic dans le Répertoire, centrage et défilement fluide sur le praticien
      var code = el.dataset.v;
      if (S.ui.feuille && S.ui.feuille.type === 'contactFiche') return;   // 3.28.19 : dans la fenêtre « fiche », la carte reste ouverte
      S.ui.contactEnTete = null;
      var ouvrant = S.ui.contactOuvert !== code;
      S.ui.contactOuvert = ouvrant ? code : null;
      rendre();
      if (ouvrant) {
        var sel = '[data-a="contact"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(code) : code) + '"]';
        var b = document.querySelector(sel);
        var cible = b ? (b.closest('li.element') || b) : null;
        if (cible && cible.scrollIntoView) {
          cible.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    },
    filtre: function (el) { S.ui.filtre = el.dataset.v; S.ui.limite = 40; rendre(); },
    annuaire: function (el) {
      var v = el.dataset.v, f = filtresCour();
      S.ui.limite = 40; S.ui.contactOuvert = null; S.ui.hopOuvert = null;
      if (v === 'hop') { S.ui.annuaire = 'hop'; LS.set('annuaire', 'hop'); rendre(); window.scrollTo(0, 0); return; }
      S.ui.annuaire = ''; LS.set('annuaire', '');
      f.type = v === 'ph' ? 'Pharmacie' : 'Médecin'; majFiltres(f); rendre(); window.scrollTo(0, 0);
    },
    hopital: function (el) {
      var k = el.dataset.v, ouvrant = S.ui.hopOuvert !== k; S.ui.hopOuvert = ouvrant ? k : null; rendre();
      if (ouvrant) { var b = document.querySelector('[data-a="hopital"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]'); if (b && b.scrollIntoView) b.closest('li').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    },
    capterGpsHopital: function (el, ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var k = el.dataset.v;
      var h = hopitauxRepertoire().filter(function (x) { return x.cle === k; })[0];
      if (!h) { toast('Établissement introuvable.'); return; }
      majGpsPourHopital(h);
    },
    voirContact: function (el) {
      var p = praticien(el.dataset.v); if (!p) return;
      var f0 = S.ui.feuille;
      // une fiche ouverte depuis une fenêtre y revient en la fermant
      S.ui.feuille = { type: 'contactFiche', code: p.code, titre: estPharmacie(p) ? 'Fiche de la pharmacie' : 'Fiche du médecin', pleine: true, retour: f0 && f0.type !== 'contactFiche' ? f0 : (f0 && f0.retour) || null };
      rendre();
    },
    hopVoirMedecin: function (el) {
      var code = el.dataset.v, f = filtresCour();
      S.ui.annuaire = ''; LS.set('annuaire', ''); f.type = 'Médecin'; majFiltres(f);
      S.ui.recherche = ''; S.ui.contactOuvert = code; S.ui.contactEnTete = code; S.ui.tab = 'praticiens'; rendre(); window.scrollTo(0, 0);
    },
    plusPrat: function () {
      if (typeof window.chargerSuitePraticiens === 'function') window.chargerSuitePraticiens();
      else { S.ui.limite += 40; rendre(); }
    },
    plus: function () {
      if (typeof window.chargerSuitePraticiens === 'function' && S.ui.tab === 'praticiens') window.chargerSuitePraticiens();
      else { S.ui.limite += 40; rendre(); }
    },
    collegue: function (el) {
      // 3.25.45 : toucher le collègue sélectionné réinitialise à Toute l'équipe
      var v = el.dataset.v;
      if (S.ui.fq && S.ui.fq.qui === 'liste' && S.ui.fq.liste.length === 1 && S.ui.fq.liste[0] === v) {
        S.ui.fq = { qui: 'tous', liste: [] };
      } else {
        S.ui.fq = { qui: 'liste', liste: [v] };
      }
      LS.set('filtreQui', S.ui.fq); S.ui.eqOuverts = {}; S.ui.jourEquipe = null; rendre();
    },
    collegueTous: function () {
      S.ui.fq = { qui: 'tous', liste: [] };
      LS.set('filtreQui', S.ui.fq); S.ui.eqOuverts = {}; S.ui.jourEquipe = null; rendre();
    },
    quiOuvrir: function () { S.ui.feuille = { type: 'qui', titre: 'Délégués', qui: S.ui.fq.qui, liste: S.ui.fq.liste.slice() }; rendre(); },
    quiMode: function (el) { var f = S.ui.feuille; f.qui = el.dataset.v; if (f.qui === 'liste' && !f.liste.length && moi()) f.liste = [moi()]; rendre(); },
    quiToggle: function (el) { var f = S.ui.feuille, i = f.liste.indexOf(el.dataset.v); if (i >= 0) f.liste.splice(i, 1); else f.liste.push(el.dataset.v); rendre(); },
    quiTous: function () {
      var f = S.ui.feuille, noms = nomsDelegues();
      var tous = noms.every(function (n) { return f.liste.indexOf(n) >= 0; });
      f.liste = tous ? [] : noms.slice();
      rendre();
    },
    quiAppliquer: function () {
      var f = S.ui.feuille; S.ui.fq = { qui: f.qui === 'liste' && !f.liste.length ? 'moi' : f.qui, liste: f.qui === 'liste' ? f.liste : [] };
      LS.set('filtreQui', S.ui.fq); S.ui.feuille = null; S.ui.eqOuverts = {}; S.ui.jourEquipe = null; rendre();
    },
    quandOuvrir: function (el) {
      var o = el.dataset.o, st = S.ui.stats;
      S.ui.feuille = o === 'equipe' ? { type: 'quand', titre: 'Période', onglet: o, periode: S.ui.eqPortee || 'semaine', ref: S.ui.eqDate || aujourdhui() }
        : { type: 'quand', titre: 'Période', onglet: o, periode: st.periode, ref: st.ref || aujourdhui(), debut: bornesStats()[0], fin: bornesStats()[1] };
      rendre();
    },
    quandMode: function (el) { S.ui.feuille.periode = el.dataset.v; rendre(); },
    quandAppliquer: function () {
      var f = S.ui.feuille, ref = (($('quandRef') || {}).value) || f.ref;
      if (f.onglet === 'equipe') { S.ui.eqPortee = f.periode; LS.set('eqPortee', f.periode); S.ui.eqDate = ref; LS.set('eqDate', ref); S.ui.jourEquipe = null; }
      else {
        var st = S.ui.stats; st.periode = f.periode; st.ref = ref;
        if (f.periode === 'perso') { st.debut = ($('quandDebut') || {}).value || f.debut; st.fin = ($('quandFin') || {}).value || f.fin; }
        LS.set('stats', st);
      }
      S.ui.feuille = null; rendre();
    },
    quandDecaler: function (el) {
      var s = +el.dataset.v;
      if (el.dataset.o === 'equipe') { decalerEquipe(s); return; }
      var st = S.ui.stats, t = st.ref || aujourdhui();
      if (st.periode === 'jour') { do { t = ajouterJours(t, s); } while (jourSemaineIndex(t) > 4); }
      else if (st.periode === 'semaine') t = ajouterJours(t, 7 * s);
      else if (st.periode === 'mois') { var m = +t.slice(5, 7) - 1 + s, y = +t.slice(0, 4) + Math.floor(m / 12); m = ((m % 12) + 12) % 12; t = y + '-' + pad2(m + 1) + '-01'; }
      st.ref = t; LS.set('stats', st); rendre();
    },
    eqBascule: function (el) {
      var o = S.ui.eqOuverts || (S.ui.eqOuverts = {}), b = el.getAttribute('aria-expanded') === 'true';
      o[el.dataset.v] = !b; rendre();
    },
    jourEquipe: function (el) { S.ui.jourEquipe = el.dataset.v; rendre(); },
    eqPortee: function (el) { S.ui.eqPortee = el.dataset.v; LS.set('eqPortee', S.ui.eqPortee); S.ui.jourEquipe = null; rendre(); },
    eqDecaler: function (el) { decalerEquipe(+el.dataset.v); },
    eqAujourdhui: function () { S.ui.eqDate = aujourdhui(); LS.set('eqDate', S.ui.eqDate); S.ui.jourEquipe = null; rendre(); },
    histFiltre: function (el) { S.ui.histFiltre = el.dataset.v; LS.set('histFiltre', S.ui.histFiltre); rendre(); },
    valider: function () {
      var n = S.plan.concat(S.horsPlan || []).filter(function (a) { return a.statut && a.etat !== 'valide'; }).length;
      confirmerPuis('Enregistrer les comptes rendus', 'Enregistrer ' + (n > 1 ? 'les ' + n + ' comptes rendus' : 'le compte rendu') + ' en attente ?', 'Enregistrer', function () { validerVisites(); });
    },
    validerUn: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      confirmerPuis(a.corrige ? 'Enregistrer la modification' : 'Enregistrer le compte rendu',
        (a.corrige ? 'Enregistrer la modification du compte rendu de <b>' : 'Enregistrer le compte rendu de <b>') + esc(a.nom) + '</b> (' + dateFr(a.date) + ') ?',
        'Enregistrer', function () { validerVisites(a.uid); });
    },
    notifBascule: function () {
      if (LS.get('notifs', false) && Notification.permission === 'granted') { LS.set('notifs', false); rendre(); toast('Notifications désactivées.'); return; }
      Notification.requestPermission().then(function (p) {
        LS.set('notifs', p === 'granted'); rendre();
        toast(p === 'granted' ? 'Notifications activées.' : 'Notifications refusées par le téléphone.');
      });
    },
    notifTest: function () { notifier('essai', 'MediPlanner', 'Les notifications fonctionnent sur ce téléphone.', true); },
    // 3.26.85 : oublie la copie de la base gardée sur le téléphone et la retélécharge entièrement (tournée et saisies conservées)
    rechargerBase: function () {
      confirmerPuis('Recharger toute la base', 'Retélécharger toute la base (environ 1,4 Mo) ? Votre tournée et vos saisies en attente sont conservées.', 'Recharger', function () {
        if (S.data) { S.data.sig = ''; S.data.syncedAt = ''; S.data.serveurRecent = false; }
        try { localStorage.removeItem(PREFIXE + 'data'); } catch (e) {}
        IDB.del('data');
        synchroniser(false, false, true);
      });
    },
    sync: function () {
      if (S.ui.feuille && S.ui.feuille.type !== 'fiche') { /* la fenêtre reste ouverte : la synchro se fait en arrière-plan */ }
      if (S.config.demo) { toast('Mode démonstration : aucune synchronisation.'); return; }
      if (!S.config.url) { S.ui.tab = 'reglages'; rendre(); return; }
      synchroniser(false);
    },
    enregistrerNom: function () {
      var n = lireNom('nomDelegue').replace(/\s+/g, ' ');
      if (n.length < 2 || n.indexOf(' ') < 0) { toast('Indiquez votre prénom et votre nom.'); var e1 = $('nomDelegue'); if (e1) e1.focus(); return; }
      // même orthographe qu'un nom déjà connu de l'équipe ; sinon chaque mot avec une majuscule
      var connu = ((S.data && S.data.delegues) || []).filter(function (x) { return normaliser(x) === normaliser(n); })[0];
      n = connu || n.split(' ').map(function (m) { return m === m.toLowerCase() || m === m.toUpperCase() ? m.toLowerCase().replace(/(^|[-'’])(\S)/g, function (x, sep, c) { return sep + c.toUpperCase(); }) : m; }).join(' ');
      var w = (($('numWhatsapp') || {}).value || '').trim(), wr = (($('cfgWaResp') || {}).value || '').trim();
      if (w && !normaliserNumero(w)) { toast('Numéro WhatsApp non reconnu. Exemple : 07 07 07 07 07.'); return; }
      if (wr && !normaliserNumero(wr)) { toast('Numéro du superviseur non reconnu. Exemple : 07 07 07 07 07.'); return; }
      var dep = ($('cfgDepart') || {}).value || (S.ui.identBrouillon || {}).depart || '';
      S.config.delegue = n; S.config.whatsapp = normaliserNumero(w) || ''; S.config.waResp = normaliserNumero(wr) || '';
      if (dep) S.config.depart = dep;
      S.ui.identBrouillon = null;
      LS.set('config', S.config); S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); publierPlan();
      toast('Bienvenue ' + n + '.'); inscrireDelegue(n);
      // 3.28.36 : pas encore installée : on la propose tout de suite (un bouton sur Android, le geste sur iPhone)
      if (!estInstallee()) setTimeout(function () { if (!S.ui.feuille) { S.ui.feuille = { type: 'installer', titre: 'Installer l\'application', bienvenue: true }; rendre(); } }, 600);
    },
    enregistrerMoi: function () {
      var n = lireNom('cfgNom'), w = ($('cfgWhatsapp').value || '').trim();
      if (w && !normaliserNumero(w)) { toast('Numéro WhatsApp non reconnu. Exemple : 07 07 07 07 07.'); return; }
      var wr = (($('cfgWaResp') || {}).value || '').trim();
      if (wr && !normaliserNumero(wr)) { toast('Numéro du responsable non reconnu. Exemple : 07 07 07 07 07.'); return; }
      var ancien = moi(), avant = JSON.stringify([S.config.delegue || '', S.config.whatsapp || '', !!S.config.waWeb, S.config.depart || '', S.config.waResp || '']);
      S.config.delegue = n; S.config.whatsapp = normaliserNumero(w); if ($('cfgWaWeb')) S.config.waWeb = $('cfgWaWeb').checked; S.config.depart = $('cfgDepart').value; S.config.waResp = normaliserNumero(wr);
      var apres = JSON.stringify([S.config.delegue || '', S.config.whatsapp || '', !!S.config.waWeb, S.config.depart || '', S.config.waResp || '']);
      LS.set('config', S.config); rendre(); toast(avant === apres ? 'Aucune modification : vos réglages sont inchangés.' : 'Réglages enregistrés.');
      inscrireDelegue(n);
      if (n && n !== ancien) publierPlan();
    },
    basculerSourceBdd: function (el) {
      var source = el.dataset.v || 'supabase';
      S.config.bddSource = source;
      LS.set('config', S.config);
      rendre();
      toast('BDD : ' + (source === 'supabase' ? 'base principale' : 'base de secours') + '. Synchronisation…');
      synchroniser(false);
    },
    testerSupabase: function () {
      toast('Vérification de la synchronisation…');
      if (connecte() && !S.config.demo) {
        apiGet('jumelage').then(function (r) { S.ui.etatJumelage = r.etat || { erreur: 'Pas encore de synchronisation.' }; rendre(); },
          function (e) { S.ui.etatJumelage = { erreur: 'Serveur injoignable : ' + e.message }; rendre(); });
      }
      if (typeof supabasePing_ !== 'function') {
        toast('Connexion à la BDD non disponible.');
        return;
      }
      var t0 = Date.now();
      supabasePing_().then(function () {
        var ms = Date.now() - t0;
        toast('BDD connectée (' + ms + ' ms).');
      }).catch(function (err) {
        toast('Erreur de connexion à la BDD : ' + err.message, 5000);
      });
    },
    tester: function () {
      var cfg = { url: ($('cfgUrl').value || '').trim(), token: ($('cfgToken').value || '').trim() };
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url)) { toast('L\'URL doit commencer par https://script.google.com/'); return; }
      toast('Test en cours…');
      apiGet('ping', cfg).then(function (r) { toast('Connexion réussie au classeur « ' + r.classeur + ' ».'); }, function (e) { toast(e.message); });
    },
    enregistrerConnexion: function () {
      var url = ($('cfgUrl').value || '').trim(), token = ($('cfgToken').value || '').trim();
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url) || !token) { toast('Renseignez l\'URL (https://script.google.com/…) et le jeton.'); return; }
      if (S.config.demo) { S.plan = []; S.jours = {}; S.queue = []; S.data = null; S.imposes = []; S.rejetes = {}; }
      S.config.url = url; S.config.token = token; S.config.demo = false; S.ui.erreur = ''; sauver();
      toast('Réglages enregistrés. Synchronisation…');
      synchroniser(false).then(function () { if (pret()) { S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); } });
    },
    demo: function () { chargerDemo(); },
    reinitialiser: function () {
      var msg = enAttente() ? enAttente() + ' élément(s) non envoyé(s) (comptes rendus, fiches) seront perdus. ' : '';
      confirmerPuis('Effacer les données', msg + 'Effacer toutes les données de l\'application sur ce téléphone ?', 'Effacer', function () { LS.vider(); location.reload(); });
    },
    exporterSecours: function () {
      copieSecours();
      var contenu = JSON.stringify({ application: 'MediPlanner', version: APP_VERSION, exporteLe: new Date().toISOString(), delegue: moi(), secours: LS.get('secours', {}) });
      var lien = document.createElement('a'); lien.href = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
      lien.download = 'mediplanner-sauvegarde-' + aujourdhui() + '.json'; document.body.appendChild(lien); lien.click();
      setTimeout(function () { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
      toast('Sauvegarde exportée : gardez le fichier en lieu sûr (Drive, e-mail).');
    },
    nomAutre: function (el) {
      var id = el.dataset.v, h = $(id), b = $(id + 'Bloc');
      if (h) h.value = '__autre';
      var bt = $(id + 'Btn'); if (bt) { var sp = bt.querySelector('span'); if (sp) sp.textContent = 'Mon nom n\'est pas dans la liste'; }
      if (b) { b.hidden = false; var i = $(id + 'Autre'); if (i) i.focus(); }
      el.hidden = true;
    },
    installerBienvenue: function () { S.ui.feuille = null; rendre(); ACTIONS.installer(); },
    installer: function () {
      var evt = S.ui.installEvt;
      if (evt) { evt.prompt(); evt.userChoice.then(function () { S.ui.installEvt = null; rendre(); }); return; }
      // iPhone : Apple n'autorise pas l'installation par un bouton ; on montre le geste en une ligne
      S.ui.feuille = { type: 'installer', titre: 'Installer l\'application' }; rendre();
    },
    // Ciblage de la tournée
    paramPeriodeRapide: function (el) {
      S.params.mode = el.dataset.m || 'semaine';
      if (el.dataset.d) S.params.dateRef = el.dataset.d;
      S.ui.etapesP.ok.quand = true; sauverEtapesP();
      LS.set('params', S.params); rendre();
    },
    paramPotentiel: function (el) {
      if (el.dataset.v === 'tous') { S.params.potentiels = []; LS.set('params', S.params); rendre(); return; }
      var l = S.params.potentiels, i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      LS.set('params', S.params); rendre();
    },
    paramSpecToggle: function (el) {
      var v = el.dataset.v, l = S.params.specialites;
      var i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v);
      if (l.length) {
        sauverCoeurDeCible(l);
        if (S.ui.filtres) { S.ui.filtres.specialites = l.slice(); LS.set('filtres', S.ui.filtres); }
        if (S.ui.filtresAutour) { S.ui.filtresAutour.specialites = l.slice(); LS.set('filtresAutour', S.ui.filtresAutour); }
      }
      LS.set('params', S.params); rendre();
    },
    paramSpecToutes: function () { S.params.specialites = []; LS.set('params', S.params); rendre(); },
    paramSpecDefaut: function () { S.params.specialites = coeurDeCible(); LS.set('params', S.params); rendre(); },
    paramPas: function (el) {
      var k = el.dataset.k, pas = +(el.dataset.pas || el.dataset.v) || 0;
      if (k === 'maxJour') S.params.maxJour = Math.max(1, Math.min(20, (+S.params.maxJour || 8) + pas));
      else if (k === 'delai') S.params.delai = Math.max(0, Math.min(90, (S.params.delai !== undefined ? +S.params.delai : 7) + pas));
      LS.set('params', S.params); rendre();
    },
    choisirSpecialites: function () {
      S.ui.feuille = { type: 'multi', titre: 'Spécialités ciblées (Cœur de cible)', titreGroupe: 'Spécialités', cle: 'specialites', options: specialitesListe(), sel: S.params.specialites.slice(),
                       aide: 'Modifier ces spécialités met automatiquement à jour votre cœur de cible. Aucune sélection = toutes les spécialités.' };
      rendre();
    },
    filtreSpecToggle: function (el) {
      var f = filtresCour(), v = el.dataset.v, l = f.specialites;
      var i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v);
      // 3.28.26 : filtre du Répertoire seulement : les spécialités de Planifier ne changent pas
      majFiltres(f); rendre();
    },
    filtreSpecToutes: function () { var f = filtresCour(); f.specialites = []; majFiltres(f); rendre(); },
    filtreSpecCoeur: function () { var f = filtresCour(); f.specialites = coeurDeCible(); majFiltres(f); rendre(); },
    filtreSpecChoisir: function () { ACTIONS.filtreQuestion({ dataset: { v: 'spec' } }); },
    crChoix: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      majCr(a, el.dataset.k, el.dataset.v); validerEtape(a, el.dataset.k); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crOk: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      if (el.dataset.v === 'types') {
        memoriserDerniersTypesCr(estPharmacie(a), c.types);
      }
      if (el.dataset.v === 'reactions') { var memR = LS.get('dernieresReactionsCr', {}); Object.keys(c.reactions || {}).forEach(function (p) { memR[p] = c.reactions[p]; }); LS.set('dernieresReactionsCr', memR); }
      if (el.dataset.v === 'produits') {
        c.reactions = c.reactions || {};
        if (!estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
        produitsPresentes(c).forEach(function (p) {
          if (!Object.prototype.hasOwnProperty.call(c.reactions, p)) c.reactions[p] = 'Intéressé';
        });
      }
      if (el.dataset.v === 'produitsStock') {
        c.stocks = c.stocks || {};
        var selProds = Array.isArray(c.produitsStock) ? c.produitsStock : [];
        Object.keys(c.stocks).forEach(function (p) {
          if (selProds.indexOf(p) < 0) delete c.stocks[p];
        });
        selProds.forEach(function (p) {
          if (!c.stocks[p] || !c.stocks[p].etat) c.stocks[p] = Object.assign(c.stocks[p] || {}, { etat: 'Disponible' });
        });
        memoriserDerniersProduitsStockCr(selProds);
      }
      validerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crPasser: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      var champs = { precision: ['precision'], bilan: ['bilan'], commentaire: ['commentaire'], besoin: ['besoinTexte'] }[el.dataset.v] || [];
      champs.forEach(function (k) { majCr(a, k, ''); });
      if (el.dataset.v === 'besoin') crDe(a).besoin = [];
      syncCr(a); validerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crEditer: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return; editerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crDate: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      majCr(a, 'date', el.dataset.v); validerEtape(a, 'date'); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    conflitRemplacer: function (el) { remplacerArret(el.dataset.uid); },
    remplacerChoisir: function (el) {
      var cr = Moteur.creneauParCle(ctx(), el.dataset.v); if (!cr) return;
      S.ui.feuille.choix = {
        cle: el.dataset.v,
        nom: cr.prat.nom,
        note: cr.prat.note,
        heure: el.dataset.h,
        lieu: cr.lieu,
        quartier: cr.quartier,
        commune: cr.commune,
        dist: (el.dataset.dist && el.dataset.dist !== '') ? parseFloat(el.dataset.dist) : null,
        memeLieu: el.dataset.memelieu === '1'
      };
      S.ui.feuille.retourAction = 'remplacerNon';
      rendre();
    },
    remplacerNon: function () {
      if (S.ui.feuille) {
        S.ui.feuille.choix = null;
        S.ui.feuille.retourAction = null;
      }
      rendre();
    },
    remplacerOui: function () {
      var f = S.ui.feuille;
      if (f && f.choix) appliquerRemplacement(f.uid, f.choix.cle, f.garder);
    },
    completerJour: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: a.uid, choix: null, garder: true, lieuRef: a.lieu }; rendre();
    },
    confirmerOui: function () { var f = S.ui.feuille; S.ui.feuille = null; if (f && f.action) f.action(); else rendre(); },
    confirmerNon: function () { var f = S.ui.feuille; S.ui.feuille = null; if (f && f.non) f.non(); else rendre(); },
    sortirQuestion: function () {
      // quitter sans rien changer : la question se ferme, le parcours en cours aussi (carte ouverte, page de planification ou de recherche)
      S.ui.feuille = null; S.ui.ouvert = null; S.ui.voirParams = false; S.ui.aAccepter = null; S.ui.rechOuverte = false; LS.set('rechOuverte', false); rendre();
    },
    conflitGarder: function (el) { var a = arret(el.dataset.uid); if (!a) return; a.conflitOk = true; LS.set('plan', S.plan); rendre(); },
    ajouterProches: function (el) {
      // 3.22.2 : on choisit d'abord la source : ma position, ou les filtres déjà réglés (communes du jour, spécialités)
      if (!el.dataset.src) {
        S.ui.dateAjout = el.dataset.d || S.ui.jour || aujourdhui(); S.ui.typeAjout = el.dataset.v === 'Médecin' ? 'Médecin' : 'Pharmacie';
        S.ui.feuille = { type: 'ajouterTournee', titre: (S.ui.typeAjout === 'Médecin' ? '+ Médecin' : '+ Pharmacie') + ', ' + dateCourte(S.ui.dateAjout) }; rendre(); return;
      }
      // médecins (selon les spécialités de la tournée) ou pharmacies près de ma position, pour le jour affiché dans « Aujourd'hui »
      var j = el.dataset.d || S.ui.jour || aujourdhui(), type = el.dataset.v === 'Médecin' ? 'Médecin' : 'Pharmacie';
      S.ui.filtresAutour = filtresRechercheType(type); LS.set('filtresAutour', S.ui.filtresAutour);
      S.ui.rechercheAutour = ''; S.ui.rechAutourLibre = '';
      Object.assign(S.ui.autour, j === aujourdhui() ? { moment: 'maintenant', ref: null } : { moment: 'choisir', date: j, heure: '', ref: null });
      LS.set('autour', S.ui.autour);
      S.ui.tab = 'autour'; S.ui.pharmaciesProches = type; positionConnue(); rendre(); window.scrollTo(0, 0);
      localiser(true, 'position', true);
    },
    crMulti: function (el) { var a = arret(el.dataset.uid); if (!a) return; majCr(a, el.dataset.k, el.dataset.v, true); rendre(); centrerChoix(el); },
    crMultiTous: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k, c = crDe(a), opts = (S.ui.crOptions[a.uid + '|' + k] || []).map(function (o) { return o[0]; });
      var l = Array.isArray(c[k]) ? c[k] : [];
      var tous = opts.length > 0 && opts.every(function (v) { return l.indexOf(v) >= 0; });
      c[k] = tous ? [] : opts.slice();
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
      if (k === 'types') memoriserDerniersTypesCr(estPharmacie(a), c.types);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crTypesAucun: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a); c.types = [];
      memoriserDerniersTypesCr(estPharmacie(a), []);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crGammeFiltre: function (el) {
      S.ui.filtreGammeCr = el.dataset.v || 'tous';
      rendre();
    },
    crGammeBascule: function (el) {
      var g = el.dataset.g;
      if (g === 'B') {
        S.ui.gammeBOuverte = !S.ui.gammeBOuverte;
      } else {
        S.ui.gammeCrOuverte = S.ui.gammeCrOuverte === g ? '' : g;
      }
      rendre();
    },
    crFamilleBascule: function (el) {
      var g = el.dataset.g, f = el.dataset.f;
      S.ui.familleCrOuverte = S.ui.familleCrOuverte || {};
      S.ui.familleCrOuverte[g] = S.ui.familleCrOuverte[g] === f ? '' : f;
      rendre();
    },
    crFamilleTous: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k || 'produits', g = el.dataset.g, fNom = el.dataset.f;
      var fams = famillesProduitsParGamme(), listeF = (g === 'A' ? fams.gammeA : fams.gammeB).filter(function (x) { return x.nom === fNom; })[0];
      if (!listeF) return;
      var c = crDe(a), l = Array.isArray(c[k]) ? c[k].slice() : [];
      var tous = listeF.produits.length > 0 && listeF.produits.every(function (p) { return l.indexOf(p) >= 0; });
      listeF.produits.forEach(function (p) {
        var i = l.indexOf(p);
        if (tous && i >= 0) l.splice(i, 1);
        else if (!tous && i < 0) l.push(p);
      });
      c[k] = l;
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crProduitsTous: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k || 'produits', c = crDe(a), tous = produitsRef();
      var l = Array.isArray(c[k]) ? c[k] : [];
      var toutCoche = tous.length > 0 && tous.every(function (p) { return l.indexOf(p) >= 0; });
      c[k] = toutCoche ? [] : tous.slice();
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crProduitsAucun: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k || 'produits', c = crDe(a);
      c[k] = [];
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr([]);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr([]);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crGammeTous: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k || 'produits', g = produitsParGamme(), cible = el.dataset.g === 'A' ? g.gammeA : g.gammeB;
      var c = crDe(a), l = Array.isArray(c[k]) ? c[k].slice() : [];
      var tous = cible.length > 0 && cible.every(function (p) { return l.indexOf(p) >= 0; });
      cible.forEach(function (p) {
        var i = l.indexOf(p);
        if (tous && i >= 0) l.splice(i, 1);
        else if (!tous && i < 0) l.push(p);
      });
      c[k] = l;
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crActionRemplacer: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a); c.remplacant = 'oui'; validerEtape(a, 'remplacant');
      ACTIONS.crRemplacer(el);
    },
    crRemplacer: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      syncCr(a); validerVisites(a.uid);
      if (a.hors) return;   // jour passé hors tournée : pas de remplacement après coup
      S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: a.uid, choix: null, garder: true, lieuRef: a.lieu }; rendre();
    },
    produit: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var l = listeProduits(a.produits), i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      a.produits = l.join(', '); LS.set('plan', S.plan); rendre();
    },
    activite: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var l = listeActivites(a.activite), i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      a.activite = l.join(' ; '); LS.set('plan', S.plan); rendre();
    },
    prochaine: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.prochaine = a.prochaine === el.dataset.v ? '' : el.dataset.v;
      LS.set('plan', S.plan); rendre();
    },
    crVal: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k, actuel = k.split('.').reduce(function (o, x) { return o && o[x]; }, crDe(a));
      majCr(a, k, actuel === el.dataset.v && el.dataset.v ? '' : el.dataset.v); rendre(); centrerChoix(el);
    },
    listeOuvrir: function (el) {
      var id = el.dataset.liste, cfg = S.ui.listes[id]; if (!cfg) return;
      var val = cfg.dom ? ($(id) || {}).value : cfg.valeur;
      S.ui.feuille = { type: 'listeChoix', titre: cfg.titre, id: id, sel: val || '', retour: S.ui.feuille, dom: cfg.dom };
      if (cfg.dom) rendreFeuille(); else rendre();
    },
    choix: function (el) {
      var c = cheminObjet(el.dataset.chemin), v = el.dataset.v;
      if (el.dataset.m === '1') {
        var l = c.o[c.k];
        if (el.dataset.parent === '1' || (typeof estGrandeCommune === 'function' && estGrandeCommune(v) && v === communeParente(v))) {
          // Clic sur "Toute la commune" (ex: Cocody) -> coche ou décoche TOUS les sous-secteurs de cette commune
          var par = (typeof communeParente === 'function') ? communeParente(v) : v;
          var secs = (typeof secteursDeGrandeCommune === 'function') ? secteursDeGrandeCommune(par) : [];
          var toutCoche = secs.length > 0 && secs.every(function (s) { return l.indexOf(s) >= 0; });
          if (toutCoche) {
            // Décocher tous les sous-secteurs de cette commune
            secs.forEach(function (s) {
              var idx = l.indexOf(s);
              if (idx >= 0) l.splice(idx, 1);
            });
            var idxP = l.indexOf(par);
            if (idxP >= 0) l.splice(idxP, 1);
          } else {
            // Cocher TOUS les sous-secteurs de cette commune
            secs.forEach(function (s) {
              if (l.indexOf(s) < 0) l.push(s);
            });
            var idxP = l.indexOf(par);
            if (idxP >= 0) l.splice(idxP, 1);
          }
        } else {
          // Clic sur un sous-secteur individuel (ex: Cocody – Angré) ou une commune non sectorisée
          var i = l.indexOf(v);
          if (i >= 0) l.splice(i, 1);
          else l.push(v);
        }
      }
      else c.o[c.k] = v;
      var f = S.ui.feuille;
      if (f && f.type === 'listeChoix') {   // sélecteur : la valeur est appliquée et la liste se referme
        var cfg = S.ui.listes[f.id] || {}; S.ui.feuille = f.retour || null;
        if (cfg.dom) {
          var h = $(f.id); if (h) h.value = v;
          var tout = cfg.sections ? [].concat.apply([], cfg.sections.map(function (x) { return x.options; })) : cfg.options;
          var b = $(f.id + 'Btn'); if (b) b.querySelector('span').textContent = (tout.filter(function (o) { return o[0] === v; })[0] || [])[1] || v;
          if (cfg.appliquer) cfg.appliquer(v);
          rendreFeuille(); return;
        }
        if (cfg.appliquer) cfg.appliquer(v);
        rendre(); return;
      }
      if (f && f.type === 'crListe' && !f.multi) {   // choix unique : appliqué tout de suite, question suivante
        var a = arret(f.uid); S.ui.feuille = null;
        if (a) { majCr(a, f.cle, v); validerEtape(a, f.cle); }
        rendre();
        if (a) centrerQuestion(a.uid, S.ui.dernierClicY);
        return;
      }
      rendre();
    },
    crListe: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var cle = el.dataset.k, multi = el.dataset.m === '1', c = crDe(a), opts = S.ui.crOptions[a.uid + '|' + cle] || [];
      var titres = { types: estPharmacie(a) ? 'Activités' : 'Types de visite', produits: 'Produits présentés', motif: 'Motif', besoin: 'Besoin de réapprovisionnement', actionProduits: 'Produits concernés' };
      S.ui.feuille = { type: 'crListe', titre: titres[cle] || 'Choisir', uid: a.uid, cle: cle, multi: multi, options: opts,
        sel: multi ? (c[cle] || []).slice() : (c[cle] || '') };
      rendre();
    },
    crListeTous: function () {
      var f = S.ui.feuille;
      f.sel = f.options.map(function (o) { return o[0]; });
      rendre();
    },
    crListeAucun: function () { S.ui.feuille.sel = []; rendre(); },
    crListeOk: function () {
      var f = S.ui.feuille, a = arret(f.uid); S.ui.feuille = null;
      if (a) {
        crDe(a)[f.cle] = f.sel.slice();
        if (f.cle === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(f.sel);
        if (f.cle === 'produitsStock') memoriserDerniersProduitsStockCr(f.sel);
        syncCr(a); LS.set('plan', S.plan);
        // comme Planifier : la liste validée passe à la question suivante (sauf s'il reste un champ à remplir dans la question)
        if (f.sel.length && (f.cle === 'types')) validerEtape(a, f.cle);
      }
      rendre();
    },
    groupeTout: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k];
      el.closest('.groupe-filtre').querySelectorAll('.puce:not(.puce-tous):not([hidden])').forEach(function (b) { if (b.dataset.v && l.indexOf(b.dataset.v) < 0) l.push(b.dataset.v); });
      rendre();
    },
    groupeToutToggle: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k];
      if (el.dataset.vide === '1') { c.o[c.k] = []; rendre(); return; }
      var vs = [];
      el.closest('.groupe-filtre').querySelectorAll('.puce:not(.puce-tous):not([hidden])').forEach(function (b) { if (b.dataset.v) vs.push(b.dataset.v); });
      var tous = vs.length > 0 && vs.every(function (v) { return l.indexOf(v) >= 0; });
      if (tous) c.o[c.k] = [];
      else vs.forEach(function (v) { if (l.indexOf(v) < 0) l.push(v); });
      rendre();
    },
    groupeAucun: function (el) { var c = cheminObjet(el.dataset.chemin); c.o[c.k] = []; rendre(); },
    sectionToute: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k];
      if (!l) l = c.o[c.k] = [];
      var secEl = el.closest('.section-choix');
      var cibles = secEl.querySelectorAll('.puce-secteur, .puce:not(.puce-secteur):not(.puce-parente):not(.puce-tous)');
      var vs = [];
      cibles.forEach(function (b) { if (b.dataset.v) vs.push(b.dataset.v); });
      var tous = vs.length > 0 && vs.every(function (v) { return l.indexOf(v) >= 0; });
      if (tous) {
        vs.forEach(function (v) { var i = l.indexOf(v); if (i >= 0) l.splice(i, 1); });
      } else {
        vs.forEach(function (v) { if (l.indexOf(v) < 0) l.push(v); });
      }
      rendre();
    },
    sectionBascule: function (el) {
      var f = S.ui.feuille, cle = el.dataset.acc || 'defaut', v = el.dataset.v, memo = LS.get('secOuverte', {});
      f.secOuvertes = f.secOuvertes || {};
      var actuel = f.secOuvertes[cle] !== undefined ? f.secOuvertes[cle] : (f.secOuverte !== undefined ? f.secOuverte : memo[cle]);
      var nouveau = actuel === v && el.getAttribute('aria-expanded') === 'true' ? '' : v;
      f.secOuvertes[cle] = nouveau;
      f.secOuverte = nouveau;
      memo[cle] = nouveau;
      LS.set('secOuverte', memo);
      rendreFeuille();
      var b = document.querySelector('.feuille [data-a="sectionBascule"][data-acc="' + (window.CSS && CSS.escape ? CSS.escape(cle) : cle) + '"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(v) : v) + '"]') ||
              document.querySelector('.feuille [data-a="sectionBascule"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(v) : v) + '"]');
      if (b) b.scrollIntoView({ block: 'nearest' });
    },
    basculeGroupe: function (el) { var f = S.ui.feuille; f.ouverts = f.ouverts || {}; f.ouverts[el.dataset.v] = !f.ouverts[el.dataset.v]; rendre(); },
    filtreRapide: function (el) {
      var f = filtresCour(), k = el.dataset.k, v = el.dataset.v;
      if (Array.isArray(f[k])) { var i = f[k].indexOf(v); if (i >= 0) f[k].splice(i, 1); else f[k].push(v); }
      else f[k] = f[k] === v ? 'tous' : v;
      if (el.dataset.fin) { var et = etatEtapes(); Object.keys(QUESTIONS_FILTRES).forEach(function (q) { et.ok[q] = true; }); et.ouvert = false; sauverEtapes(); }
      majFiltres(f); if (!finRecherche()) rendre();
    },
    filtreType: function (el) { var f = filtresCour(); f.type = el.dataset.v; majFiltres(f); rendre(); },
    multiToggle: function (el) { var f = S.ui.feuille, i = f.sel.indexOf(el.dataset.v); if (i >= 0) f.sel.splice(i, 1); else f.sel.push(el.dataset.v); rendre(); },
    multiToggleAutres: function () { var f = S.ui.feuille; if (f) { f.autresOuvert = !f.autresOuvert; rendreFeuille(); } },
    multiTous: function () {
      var f = S.ui.feuille;
      f.sel = f.options.map(function (o) { return o.nom; });
      rendre();
    },
    multiAucun: function () { S.ui.feuille.sel = []; rendre(); },
    multiOk: function () {
      var f = S.ui.feuille; S.params[f.cle] = f.sel.slice(); LS.set('params', S.params);
      if (f.cle === 'specialites') {
        if (f.sel.length) {
          sauverCoeurDeCible(f.sel);
          if (S.ui.filtres) { S.ui.filtres.specialites = f.sel.slice(); LS.set('filtres', S.ui.filtres); }
          if (S.ui.filtresAutour) { S.ui.filtresAutour.specialites = f.sel.slice(); LS.set('filtresAutour', S.ui.filtresAutour); }
        }
        S.ui.etapesP.ok.spec = true; sauverEtapesP();
      }
      S.ui.feuille = null; rendre();
    },
    // Filtres avancés
    ouvrirFiltres: function () {
      var b = JSON.parse(JSON.stringify(filtresCour()));
      S.ui.feuille = { type: 'filtres', titre: 'Tous les filtres', pleine: true, brouillon: b, tri: S.ui.tri, ouverts: { spec: b.specialites.length > 0, com: b.communes.length > 0 } };
      rendre();
    },
    etapeFiltre: function (el) {
      var f = filtresCour(), k = el.dataset.k, v = el.dataset.v;
      if (k === 'tri') { S.ui.tri = v; LS.set('tri', v); }
      else if (k === 'potentiels' && v === 'tous') { f.potentiels = []; majFiltres(f); }
      else { if (el.dataset.m === '1') { var i = f[k].indexOf(v); if (i >= 0) f[k].splice(i, 1); else f[k].push(v); } else f[k] = v; majFiltres(f); }
      if (el.dataset.auto) { etatEtapes().ok[el.dataset.auto] = true; sauverEtapes(); }
      if (!finRecherche()) rendre();
    },
    rechTuile: function (el) {
      var et = etatEtapes(); et.ouvert = false;
      etapesFiltres(S.ui.filtres).forEach(function (e) { et.ok[e.id] = e.id !== el.dataset.v; });
      sauverEtapes(); S.ui.rechOuverte = true; LS.set('rechOuverte', true); rendre();
    },
    produitOuvrir: function (el) { S.ui.feuille = { type: 'ficheProduit', titre: el.dataset.v, produit: el.dataset.v, pleine: true, ouvertes: {} }; rendre(); var c = document.querySelector('.feuille-corps'); if (c) c.scrollTop = 0; },
    ficheSection: function (el) { var f = S.ui.feuille; f.ouvertes[el.dataset.v] = !f.ouvertes[el.dataset.v]; rendre(); },
    aireBascule: function (el) { var o = S.ui.airesOuvertes = S.ui.airesOuvertes || {}; o[el.dataset.v] = !o[el.dataset.v]; rendre(); },
    aireProduit: function (el) { S.ui.aireProduit = el.dataset.v; rendre(); },
    rechOuvrir: function () {
      var et = etatEtapes(); et.ok = {}; et.ouvert = false; sauverEtapes(); S.ui.rechOuverte = true; LS.set('rechOuverte', true); rendre(); window.scrollTo(0, 0); },
    rechFermer: function () { S.ui.rechOuverte = false; LS.set('rechOuverte', false); rendre(); window.scrollTo(0, 0); },
    etapePrec: function (el) { etatEtapes().ok[el.dataset.v] = false; sauverEtapes(); rendre(); },
    etapeOk: function (el) { etatEtapes().ok[el.dataset.v] = true; sauverEtapes(); if (!finRecherche()) rendre(); },
    etapePasser: function (el) {
      var f = filtresCour(), vide = JSON.parse(JSON.stringify(FILTRES_VIDES));
      QUESTIONS_FILTRES[el.dataset.v].cles.forEach(function (k) { f[k] = vide[k]; }); majFiltres(f);
      etatEtapes().ok[el.dataset.v] = true; sauverEtapes(); rendre();
    },
    etapeEditer: function (el) { var et = etatEtapes(); et.ok[el.dataset.v] = false; et.ouvert = false; sauverEtapes(); rendre(); },
    etapesBascule: function () { var et = etatEtapes(); et.ouvert = !et.ouvert; sauverEtapes(); rendre(); },
    filtreQuestion: function (el) {
      var b = JSON.parse(JSON.stringify(filtresCour())), k = el.dataset.v;
      S.ui.feuille = { type: 'filtres', titre: QUESTIONS_FILTRES[k].titre, pleine: k === 'spec' || k === 'com', question: k, brouillon: b, tri: S.ui.tri, ouverts: {} };
      rendre();
    },
    filtreBrouillon: function (el) {
      var b = S.ui.feuille.brouillon, k = el.dataset.k, v = el.dataset.v;
      if (el.dataset.m === '1') { var i = b[k].indexOf(v); if (i >= 0) b[k].splice(i, 1); else b[k].push(v); }
      else b[k] = v;
      rendre();
    },
    filtresReinit: function () {
      var f = S.ui.feuille, vide = JSON.parse(JSON.stringify(FILTRES_VIDES));
      if (f.question) QUESTIONS_FILTRES[f.question].cles.forEach(function (k) { f.brouillon[k] = vide[k]; });
      else { f.brouillon = vide; f.tri = 'priorite'; }
      rendre();
    },
    filtresOk: function () {
      var f = S.ui.feuille;
      if (f.brouillon && Array.isArray(f.brouillon.specialites) && f.brouillon.specialites.length) {
        sauverCoeurDeCible(f.brouillon.specialites);
        S.params.specialites = f.brouillon.specialites.slice(); LS.set('params', S.params);
      }
      majFiltres(f.brouillon);
      if (f.tri && f.tri !== S.ui.tri) { S.ui.tri = f.tri; LS.set('tri', S.ui.tri); }
      if (f.question) { etatEtapes().ok[f.question] = true; sauverEtapes(); }
      S.ui.feuille = null; rendre();
    },
    retirerFiltre: function (el) {
      var f = filtresCour(), k = el.dataset.k;
      if (Array.isArray(f[k])) f[k] = f[k].filter(function (x) { return x !== el.dataset.v; }); else f[k] = 'tous';
      majFiltres(f); rendre();
    },
    effacerFiltres: function () {
      majFiltres(JSON.parse(JSON.stringify(FILTRES_VIDES)));
      if (S.ui.tab === 'autour') S.ui.rechercheAutour = ''; else S.ui.recherche = '';
      S.ui.etapesF[cleFiltres()] = { ok: {} }; sauverEtapes(); rendre();
    },
    // Fiche praticien
    ficheSpecRapide: function (el) {
      var fe = S.ui.feuille;
      if (fe && fe.type === 'fiche') {
        fe.d.specialite = el.dataset.v;
        delete fe.err.specialite;
        rendre();
      }
    },
    nouvelleFiche: function () { S.ui.feuille = { type: 'fiche', titre: 'Nouveau contact', pleine: true, etape: 0, cherche: true, nouveau: true, d: brouillonFiche(''), err: {} }; rendre(); setTimeout(function () { var i = document.querySelector('.fx-champ-g'); if (i) i.focus(); }, 250); },
    // 3.27.1 : personne introuvable dans la base : on passe à la fiche (1. Où et quand)
    ficheCreer: function () {
      var f = S.ui.feuille; if (!f) return;
      if (String(f.d.nom || '').trim().length < 2) { f.err = { nom: 'Indiquez le nom (2 caractères min.).' }; rendre(); focusErreur(); return; }
      f.d.nom = nomAvecTitre(f.d.nom, f.d.type); if (f.d.type === 'Pharmacie') f.d.lieux[0].lieu = f.d.nom;
      f.cherche = false; f.err = {}; f.etape = 0; f.lieuOuvert = 0; synchroniserDefautsFiche(f.d); rendre();
    },
    ficheIci: function () {
      var f = S.ui.feuille, e = f && f.ici; if (!e) return;
      var d = f.d, i = d.lieux.map(function (l) { return String(l.lieu || '').trim().length < 2; }).indexOf(true);
      if (i < 0) { var nl = lieuVide(false); nl.jours.forEach(function (j) { j.matin = false; j.soir = false; }); d.lieux.push(nl); i = d.lieux.length - 1; }
      var l = d.lieux[i]; l.lieu = e.lieu; l.quartier = e.quartier || l.quartier; l.commune = e.commune || l.commune; l.lat = e.lat; l.lon = e.lon;
      ['lieu', 'quartier'].forEach(function (k) { delete f.err[k + i]; });
      f.lieuOuvert = i; f.ici = null; rendre(); toast('Lieu : ' + e.lieu + '.');
    },
    // 3.27.4 : « Suivant » vérifie d'abord l'étape en cours
    ficheSuivant: function (el) {
      var f = S.ui.feuille; if (!f) return;
      if (f.etape === 0 && String(f.d.nom || '').trim().length >= 2) { f.d.nom = nomAvecTitre(f.d.nom, f.d.type); if (f.d.type === 'Pharmacie') f.d.lieux[0].lieu = f.d.nom; }
      var e = erreursEtape(f.d, f.etape);
      if (Object.keys(e).length) { f.err = e; rendre(); focusErreur(); toast('Complétez les champs signalés.'); return; }
      ACTIONS.ficheAller(el);
    },
    ouvrirRappels: function () { S.ui.feuille = { type: 'rappels', titre: 'Rappels du jour' }; rendre(); },
    rappelAjouter: function (el) { S.ui.feuille = null; ACTIONS.visiteInopineeDirect({ dataset: { v: el.dataset.v } }); },
    rappelTraiter: function (el) {
      var m = LS.get('rappelsTraites', {}), k = el.dataset.k;
      m[k] = el.dataset.v === 'fait' ? { fait: true, le: aujourdhui() } : { jusqua: prochainJourOuvre(ajouterJours(aujourdhui(), 1)) };
      LS.set('rappelsTraites', m);
      toast(el.dataset.v === 'fait' ? 'Rappel retiré.' : 'Rappel reporté au ' + dateCourte(m[k].jusqua) + '.');
      if (!rappelsDuJour().length) S.ui.feuille = null;
      rendre();
    },
    ficheVoirSpecs: function () { var f = S.ui.feuille; if (f) { f.voirSpecs = !f.voirSpecs; rendre(); } },
    ficheIciNon: function () { var f = S.ui.feuille; if (f && f.ici) { f.iciRefuse = normaliser(f.ici.lieu); f.ici = null; rendre(); } },
    modifierFiche: function (el) {
      var code = el.dataset.v || S.ui.contactOuvert;
      if (!code) return;
      var d = brouillonFiche(code);
      S.ui.feuille = { type: 'fiche', titre: (d.type === 'Pharmacie' ? 'Modifier la pharmacie' : 'Modifier le médecin'), pleine: true, etape: 1, d: d, err: {}, initial: JSON.stringify(d) };
      rendre();
    },
    modifierActif: function () {
      var code = S.ui.contactOuvert;
      if (!code) {
        toast('Touchez d\'abord un médecin ou une pharmacie dans la liste.');
        return;
      }
      var d = brouillonFiche(code);
      S.ui.feuille = { type: 'fiche', titre: d.nom || 'Modifier', pleine: true, etape: 1, d: d, err: {}, initial: JSON.stringify(d) };
      rendre();
    },
    modifierPlanning: function (el) {
      var code = el.dataset.v || S.ui.contactOuvert;
      if (!code) return;
      var d = brouillonFiche(code);
      S.ui.feuille = {
        type: 'fiche',
        titre: d.type === 'Pharmacie' ? 'Horaires de réception' : 'Planning hebdomadaire',
        pleine: true,
        etape: 0, planningSeul: true,
        d: d,
        err: {},
        initial: JSON.stringify(d)
      };
      rendre();
    },
    ouvrirDoublon: function (el) {
      var d = brouillonFiche(el.dataset.v);
      S.ui.feuille = { type: 'fiche', titre: (d.type === 'Pharmacie' ? 'Modifier la pharmacie' : 'Modifier le médecin'), pleine: true, etape: 1, d: d, err: {}, initial: JSON.stringify(d) };
      rendre();
      toast('Fiche existante ouverte : ' + d.nom);
    },
    majGpsDirect: function (el) {
      var code = el.dataset.v, d = brouillonFiche(code);
      if (!d || !d.code) return;
      var lieux = Array.isArray(d.lieux) ? d.lieux : [];
      if (lieux.length > 1) {
        S.ui.feuille = {
          type: 'choixLieuGps',
          titre: 'Capter position GPS',
          code: code,
          d: d
        };
        rendre();
        return;
      }
      majGpsPourLieu(code, 0);
    },
    majGpsLieuDirect: function (el) {
      var code = el.dataset.v, idx = parseInt(el.dataset.i, 10);
      majGpsPourLieu(code, isNaN(idx) ? 0 : idx);
    },
    capterGpsLieu: function (el) {
      var code = el.dataset.v, idx = parseInt(el.dataset.i, 10);
      S.ui.feuille = null;
      majGpsPourLieu(code, isNaN(idx) ? 0 : idx);
    },
    ficheVal: function (el) {
      var d = S.ui.feuille.d, k = el.dataset.k;
      d[k] = k === 'note' ? +el.dataset.v : el.dataset.v;
      if (k === 'type') {
        synchroniserDefautsFiche(d);
        S.ui.feuille.err = {};
      }
      rendre();
    },
    ficheJour: function (el) {
      var l = S.ui.feuille.d.lieux[+el.dataset.i], j = l.jours[+el.dataset.j];
      j[el.dataset.c] = !j[el.dataset.c];
      if (S.ui.feuille.err['jours' + el.dataset.i]) S.ui.feuille.err = erreursEtape(S.ui.feuille.d, 1);
      rendre();
    },
    ficheAbsence: function () { var f = S.ui.feuille; if (!f) return; f.voirAbsence = !f.voirAbsence; rendre(); },
    ficheJoursTous: function (el) {
      var l = S.ui.feuille.d.lieux[+el.dataset.i], c = el.dataset.c;
      if (c === 'tout') {
        var tout = l.jours.every(function (j) { return j.matin && j.soir; });
        l.jours.forEach(function (j) { j.matin = !tout; j.soir = !tout; });
      } else {
        var tous = l.jours.every(function (j) { return j[c]; });
        l.jours.forEach(function (j) { j[c] = !tous; });
      }
      if (S.ui.feuille.err['jours' + el.dataset.i]) S.ui.feuille.err = erreursEtape(S.ui.feuille.d, 1);
      rendre();
    },
    ficheOuvrirLieu: function (el) {
      var f = S.ui.feuille;
      if (f) { f.lieuOuvert = +el.dataset.i; rendre(); }
    },
    ficheReplierLieu: function () {
      var f = S.ui.feuille;
      if (f) { f.lieuOuvert = -1; rendre(); }
    },
    ficheEditerLieu0: function () {
      var f = S.ui.feuille;
      if (f) { f.editerLieu0 = !f.editerLieu0; rendre(); }
    },
    effacerVisiteChoix: function (el) {
      if (el.dataset.v === 'supprimer') { var f0 = S.ui.feuille, a0 = f0 && arret(f0.uid); S.ui.feuille = null; if (a0) supprimerVisiteJour(a0); else rendre(); return; }
      var f = S.ui.feuille, a = f && arret(f.uid); S.ui.feuille = null; if (!a) { rendre(); return; }
      if (el.dataset.v === 'supprimer') {
        S.queue = S.queue.filter(function (v) { return v.uid !== a.uid; });
        S.plan = S.plan.filter(function (x) { return x.uid !== a.uid; }); S.horsPlan = (S.horsPlan || []).filter(function (x) { return x.uid !== a.uid; });
        LS.set('horsPlan', S.horsPlan); S.ui.aPublier = true; LS.set('aPublier', true); sauver(); rendre(); toast('Visite supprimée de la journée.');
        if (connecte()) synchroniser(true);
      } else effacerCr(a);
    },
    ficheChoixQuartier: function (el) {
      var f = S.ui.feuille, i = +el.dataset.i; if (!f || f.type !== 'fiche' || !f.d.lieux[i]) return;
      var q = quartiers().filter(function (x) { return x.quartier === el.dataset.v; })[0];
      f.d.lieux[i].quartier = el.dataset.v; if (q) f.d.lieux[i].commune = q.commune; delete f.err['quartier' + i];
      rendre(); toast('Quartier : ' + el.dataset.v + (q ? ', ' + q.commune : '') + '.');
    },
    ficheAjouterLieu: function () {
      var f = S.ui.feuille;
      if (f && f.d && f.d.lieux) {
        var nl = lieuVide(false); if (f.d.type !== 'Pharmacie') nl.jours.forEach(function (j) { j.matin = false; j.soir = false; });
        f.d.lieux.push(nl);
        f.lieuOuvert = f.d.lieux.length - 1;
        rendre();
      }
    },
    ficheRetirerLieu: function (el) {
      var f = S.ui.feuille;
      if (f && f.d && f.d.lieux) {
        f.d.lieux.splice(+el.dataset.i, 1);
        if (f.lieuOuvert >= f.d.lieux.length) f.lieuOuvert = Math.max(0, f.d.lieux.length - 1);
        S.ui.feuille.err = {};
        rendre();
      }
    },
    ficheChoixLieu: function (el) {
      var f = S.ui.feuille, i = +el.dataset.i, e = ((S.ui.sugLieux || {})[i] || [])[+el.dataset.v]; if (!f || !e) return;
      var l = f.d.lieux[i]; l.lieu = e.lieu; delete f.err['lieu' + i];
      // 3.26.59 : établissement connu : repères repris de la base
      if (!l.reperes) { var pR = (S.data.presences || []).filter(function (x) { return x.reperes && normaliser(x.lieu) === normaliser(e.lieu); })[0]; if (pR) l.reperes = pR.reperes; }
      var qVal = e.quartier, cVal = e.commune, latVal = e.lat, lonVal = e.lon;
      if (!qVal || /^NL$/i.test(qVal)) {
        var can = trouverEtablissementBDD(e.lieu, '', cVal);
        if (can && can.quartier && !/^NL$/i.test(can.quartier)) {
          qVal = can.quartier;
          if (can.commune && !cVal) cVal = can.commune;
          if (can.lat && !latVal) { latVal = can.lat; lonVal = can.lon; }
        }
      }
      if (qVal && !/^NL$/i.test(qVal)) {
        l.quartier = qVal;
        delete f.err['quartier' + i];
      }
      if (cVal) l.commune = cVal;
      if (!l.commune && l.quartier) {
        var qObj = quartiers().filter(function (q) { return normaliser(q.quartier) === normaliser(l.quartier); })[0];
        if (qObj && qObj.commune) l.commune = qObj.commune;
      }
      if (latVal && lonVal) { l.lat = latVal; l.lon = lonVal; }
      rendre(); toast('Établissement repris : ' + e.lieu + (l.quartier ? ' (' + l.quartier + ')' : '') + '.');
    },
    ficheGps: function (el) {
      var idx = +el.dataset.i;
      var f = S.ui.feuille;
      if (!f || !f.d || !f.d.lieux || !f.d.lieux[idx]) return;
      var l = f.d.lieux[idx];
      if (!navigator.geolocation) { toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
      toast('Recherche de votre position précise…');
      mesurePrecise(function (p) {
        var avant = lireCoord(l);
        var pCapt = { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), prec: p.prec };

        // Référence géographique : quartier sélectionné ou position existante
        var qDecl = l.quartier ? quartiers().filter(function (q) { return q.quartier === l.quartier; })[0] : null;
        var refGeo = qDecl && isFinite(qDecl.lat) ? { lat: qDecl.lat, lon: qDecl.lon } : avant;
        var nomLieuRef = l.quartier || l.commune || (f.d.nom ? f.d.nom : 'l\'établissement');
        var distanceKmEcart = refGeo && isFinite(refGeo.lat) ? distanceVol(pCapt, refGeo) : 0;

        function appliquerGps() {
          l.lat = pCapt.lat; l.lon = pCapt.lon; l.prec = pCapt.prec; l.origineGps = origineTerrain(pCapt.prec);
          var r = Moteur.quartierLePlusProche(l.lat, l.lon, quartiers());
          if (r && r.quartier) {
            l.quartier = r.quartier.quartier;
            l.commune = r.quartier.commune;
            if (S.ui.feuille && S.ui.feuille.err) delete S.ui.feuille.err['quartier' + idx];
          }
          rendre();
          toast('GPS capté : ' + (l.quartier ? l.quartier + ' (± ' + p.prec + ' m)' : '± ' + p.prec + ' m') + '.');
        }

        if (refGeo && distanceKmEcart > 3) {
          var distArr = Math.round(distanceKmEcart);
          var fSauve = JSON.parse(JSON.stringify(f));
          confirmerPuis('Écart de position important',
            '<div style="color:var(--primaire,#0A6C74);font-weight:700;margin-bottom:8px">Attention : vous êtes à ' + distArr + ' km de ' + esc(nomLieuRef) + ' !</div>' +
            '<p style="margin:0 0 8px">Ce bouton sert uniquement lorsque vous êtes <b>physiquement devant l\'officine ou l\'établissement</b>.</p>' +
            '<p style="margin:0">Voulez-vous vraiment écraser la position ?</p>',
            'Écraser la position',
            function () {
              S.ui.feuille = fSauve;
              var lSauve = S.ui.feuille.d.lieux[idx];
              lSauve.lat = pCapt.lat; lSauve.lon = pCapt.lon; lSauve.prec = pCapt.prec; lSauve.origineGps = origineTerrain(pCapt.prec);
              var r = Moteur.quartierLePlusProche(lSauve.lat, lSauve.lon, quartiers());
              if (r && r.quartier) {
                lSauve.quartier = r.quartier.quartier;
                lSauve.commune = r.quartier.commune;
                if (S.ui.feuille.err) delete S.ui.feuille.err['quartier' + idx];
              }
              rendre();
              toast('Position GPS mise à jour (' + distArr + ' km).');
            },
            function () {
              S.ui.feuille = fSauve;
              rendre();
              toast('Position inchangée.');
            }
          );
          return;
        }

        appliquerGps();
      }, function () { toast('Position indisponible. Autorisez la localisation.'); });
    },
    ficheGpsEffacer: function (el) { var l = S.ui.feuille.d.lieux[+el.dataset.i]; l.lat = ''; l.lon = ''; l.origineGps = ''; rendre(); },
    ficheAller: function (el) {
      var f = S.ui.feuille, cible = +el.dataset.v;
      f.err = {};
      f.etape = Math.max(0, Math.min(1, cible));
      rendre();
      var c = document.querySelector('.feuille-corps'); if (c) c.scrollTop = 0;
    },
    ficheEtape: function (el) {
      var f = S.ui.feuille, sens = +el.dataset.v;
      f.err = {};
      f.etape = Math.max(0, Math.min(1, f.etape + sens));
      rendre();
      var c = document.querySelector('.feuille-corps'); if (c) c.scrollTop = 0;
    },
    ficheEnregistrer: function () {
      var f = S.ui.feuille;
      var nomInit = f.initial ? JSON.parse(f.initial).nom : null;
      if (String(f.d.nom || '').trim().length >= 2 && f.d.nom !== nomInit) { f.d.nom = nomAvecTitre(f.d.nom, f.d.type); if (f.d.type === 'Pharmacie') f.d.lieux[0].lieu = f.d.nom; }
      synchroniserDefautsFiche(f.d);
      for (var i = 0; i < 2; i++) {
        var e = erreursEtape(f.d, i);
        if (Object.keys(e).length) { f.err = e; var kL = Object.keys(e).map(function (x) { var m2 = x.match(/^(?:lieu|quartier|jours|hm|hs)(\d+)$/); return m2 ? +m2[1] : -1; }).filter(function (x) { return x >= 0; })[0]; f.etape = i; if (kL !== undefined) { f.lieuOuvert = kL; if (i === 1) f.etape = 1; } rendre(); focusErreur(); toast('Complétez les champs signalés.'); return; }
      }
      if (!f.d.code && !f.doublonConfirme) {
        var doublons = chercherDoublonsFiche(f.d).filter(function (x) { return x.bloquant; });   // 3.27.28 : même nom, même téléphone, ou nom proche au même endroit
        if (doublons.length) {
          var ex = doublons[0].p, fSauve = JSON.parse(JSON.stringify(f));
          confirmerPuis('Doublon potentiel',
            '<b>' + esc(ex.nom) + '</b> (' + esc(doublons[0].lieu || ex.specialite) + ') existe déjà sous le code <b>' + esc(ex.code) + '</b>.<br>Voulez-vous compléter sa fiche au lieu de créer un doublon ?',
            'Compléter sa fiche',
            function () {
              var dEx = brouillonFiche(ex.code);
              S.ui.feuille = { type: 'fiche', titre: (dEx.type === 'Pharmacie' ? 'Modifier la pharmacie' : 'Modifier le médecin'), pleine: true, etape: 1, d: dEx, err: {}, initial: JSON.stringify(dEx) };
              rendre();
            },
            function () {
              fSauve.doublonConfirme = true;
              S.ui.feuille = fSauve;
              ACTIONS.ficheEnregistrer();
            });
          return;
        }
      }
      if (f.initial && f.initial === JSON.stringify(f.d)) { S.ui.feuille = null; rendre(); toast('Aucune modification.'); return; }
      var nouveau = !f.d.code, code = enregistrerFiche(f.d);
      S.ui.feuille = null; S.ui.contactOuvert = code; S.ui.contactEnTete = code; S.ui.tab = 'praticiens'; S.ui.recherche = ''; rendre();
      toast((nouveau ? 'Praticien ajouté' : 'Fiche mise à jour') + (S.config.demo ? '.' : (navigator.onLine ? ', envoi à la BDD…' : ', envoi dès le retour du réseau.')));
      if (!S.config.demo) synchroniser(true);
    },
    // Statistiques
    statsPeriode: function (el) { S.ui.stats.periode = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    statsPortee: function (el) { S.ui.stats.portee = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    statsVue: function (el) { S.ui.statsVue = el.dataset.v; LS.set('statsVue', S.ui.statsVue); rendre(); },
    statsSpec: function (el) { S.ui.stats.vueSpec = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    // Apparence, lancement, mises à jour
    theme: function (el) { appliquerTheme(el.dataset.v); rendre(); },
    fermerLancement: function (el) {
      S.ui.lancement = false; S.ui.lancementAuto = false;
      if (el.dataset.tab && pret()) S.ui.tab = el.dataset.tab;
      rendre(); window.scrollTo(0, 0);
      if (S.ui.tab === 'equipe') rafraichirEquipe().then(function (ok) { if (ok) rendreSiPossible(); });
    },
    ouvrirLancement: function () { S.ui.lancement = true; S.ui.lancementAuto = false; rendre(); },
    appliquerMaj: appliquerMaj,
    plusTardMaj: function () {
      var b = $('bandeauMaj');
      if (b) b.hidden = true;
      try { sessionStorage.setItem('mediplanner_maj_reportee', S.ui.majVersion || '1'); } catch (e) {}
    },
    verifierMaj: function () {
      if (!swReg) { toast('Mises à jour indisponibles dans ce navigateur.'); return; }
      toast('Recherche d\'une mise à jour…');
      swReg.update().then(function () {
        setTimeout(function () { if (!swReg.waiting && !swReg.installing) toast('MediPlanner est à jour (version ' + APP_VERSION + ').'); }, 2500);
      }, function () { toast('Vérification impossible hors ligne.'); });
    },
    partager: function () {
      var lien = lienInstallation(), texte = 'MediPlanner : ouvrez ce lien sur votre téléphone, puis installez l\'application.';
      if (navigator.share) navigator.share({ title: 'MediPlanner', text: texte, url: lien }).catch(function () {});
      else copier(lien);
    }
  };

  function memoriserPouceY(e) {
    if (!e) return;
    var y = null;
    if (typeof e.clientY === 'number' && e.clientY > 0) {
      y = e.clientY;
    } else if (e.touches && e.touches[0] && typeof e.touches[0].clientY === 'number') {
      y = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches[0] && typeof e.changedTouches[0].clientY === 'number') {
      y = e.changedTouches[0].clientY;
    }
    if (y && y > 0) {
      S.ui.dernierClicY = Math.round(y);
    }
  }

  document.addEventListener('click', function (e) {
    memoriserPouceY(e);
    var el = e.target.closest('[data-a]');
    if (!el || !ACTIONS[el.dataset.a] || el.disabled) return;
    if (el.__bloqueClic && Date.now() < el.__bloqueClic) {
      e.preventDefault();
      return;
    }
    if (el.tagName === 'A') return;
    e.preventDefault();
    ACTIONS[el.dataset.a](el, e);
  });
  window.addEventListener('pointerdown', memoriserPouceY, { passive: true, capture: true });
  window.addEventListener('touchstart', memoriserPouceY, { passive: true, capture: true });
  // 3.28.39 : Réglages, volets ouverts ou fermés gardés pendant la session
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d || !d.dataset || !d.dataset.reg) return;
    (S.ui.regOuverts = S.ui.regOuverts || {})[d.dataset.reg] = d.open;
  }, true);
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d || !d.dataset || !d.dataset.bil) return;
    (S.ui.bilOuverts = S.ui.bilOuverts || {})[d.dataset.bil] = d.open;
  }, true);
  document.addEventListener('input', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f, pos;
    if (f === 'ident') { (S.ui.identBrouillon = S.ui.identBrouillon || {})[el.dataset.k] = el.value; return; }
    if (f === 'commentaire') { var a = arret(el.dataset.uid); if (a) { a.commentaire = el.value; LS.set('plan', S.plan); } }
    if (f === 'cr') { var ac = arret(el.dataset.uid); if (ac) majCr(ac, el.dataset.k, el.value); }
    if (f === 'fiche') {
      majChampFiche(el, false);
      if (el.dataset.k === 'lieu') {
        var zpL = document.getElementById('presentsIci'); if (zpL && S.ui.feuille && S.ui.feuille.d) zpL.innerHTML = rendrePresentsIci(S.ui.feuille.d);
        var idxL = +el.dataset.i, valL = el.value.trim();
        var zs = document.getElementById('sugLieu' + idxL);
        if (zs) zs.innerHTML = suggestionsLieu(valL, idxL);
        if (valL.length >= 2 && S.ui.feuille && S.ui.feuille.d && S.ui.feuille.d.lieux[idxL]) {
          var lObj = S.ui.feuille.d.lieux[idxL];
          var bddMatch = trouverEtablissementBDD(valL, lObj.quartier, lObj.commune);
          if (bddMatch && bddMatch.quartier && !/^NL$/i.test(bddMatch.quartier)) {
            lObj.quartier = bddMatch.quartier;
            if (bddMatch.commune && !lObj.commune) lObj.commune = bddMatch.commune;
            if (bddMatch.lat && !lObj.lat) { lObj.lat = bddMatch.lat; lObj.lon = bddMatch.lon; }
            delete S.ui.feuille.err['quartier' + idxL];
            delete S.ui.feuille.err['lieu' + idxL];
            var qBtn = document.getElementById('ficheQuartier' + idxL + 'Btn');
            if (qBtn) {
              var sp = qBtn.querySelector('span');
              if (sp) sp.textContent = bddMatch.quartier + (lObj.commune ? ' (' + lObj.commune + ')' : '');
              qBtn.removeAttribute('aria-invalid');
            }
            if (S.ui.listes && S.ui.listes['ficheQuartier' + idxL]) {
              S.ui.listes['ficheQuartier' + idxL].valeur = bddMatch.quartier;
            }
            var errQ = document.getElementById('err-quartier' + idxL);
            if (errQ) errQ.textContent = '';
          }
        }
      }
      if (el.dataset.k === 'nom' || el.dataset.k === 'telephone') {
        if (S.ui.feuille && S.ui.feuille.d && S.ui.feuille.d.type === 'Pharmacie' && el.dataset.k === 'nom') S.ui.feuille.d.lieux[0].lieu = el.value;
        var zd = document.getElementById('doublonsFiche'); if (zd && S.ui.feuille) zd.innerHTML = rendreDoublonsFiche(S.ui.feuille.d);
        var zp = document.getElementById('presentsIci'); if (zp && S.ui.feuille) zp.innerHTML = rendrePresentsIci(S.ui.feuille.d);
        var zc = document.getElementById('ficheCreerNom'); if (zc && S.ui.feuille) zc.textContent = nomCreer(S.ui.feuille.d);
      }
    }
    if (f === 'produits') {
      var ap = arret(el.dataset.uid), ref = ap ? produitsPour(ap) : produitsRef();
      if (ap) { ap.produits = listeProduits(ap.produits).filter(function (x) { return ref.indexOf(x) >= 0; }).concat(listeProduits(el.value)).join(', '); LS.set('plan', S.plan); }
    }
    if (f === 'rechCommunes' && S.ui.feuille) {
      S.ui.feuille.q = el.value; var zc = document.getElementById('resCommunes'); if (zc) zc.innerHTML = resultatsCommunes(el.value);
    }
    if (f === 'rechTout' && S.ui.feuille) {
      S.ui.feuille.q = el.value; var zt = document.getElementById('resTout'); if (zt) zt.innerHTML = resultatsTout(el.value);
    }
    if (f === 'rechAutourLibre') {
      S.ui.rechAutourLibre = el.value; var za = document.getElementById('resAutourLibre'), zl = document.getElementById('autourListe');
      if (za) za.innerHTML = resultatsAutourLibre(el.value); if (zl) zl.hidden = !!normaliser(el.value);
    }
    if (f === 'rechAjout' && S.ui.feuille) {
      S.ui.feuille.q = el.value; var zr = document.getElementById('resAjout'); if (zr) zr.innerHTML = resultatsAjout(el.value);
    }
    if (f === 'rechRemplacer' && S.ui.feuille) {
      S.ui.feuille.q = el.value;
      var aR = arret(S.ui.feuille.uid);
      var cands = aR ? candidatsRemplacement(aR) : [];
      var zrR = document.getElementById('resRemplacer');
      if (zrR) zrR.innerHTML = listeCandidatsRemplacementHtml(S.ui.feuille, cands, el.value);
    }
    if (f === 'chercheOption') {
      var fe = S.ui.feuille; fe.q = fe.q || {}; fe.q[el.dataset.g] = el.value;
      var grp = el.closest('.groupe-filtre');
      if (grp && !grp.classList.contains('ouvert') && el.value) {   // 3.27.27 : recherche tapée dans un groupe replié : il s'ouvre
        var gId = el.dataset.g, pos = el.selectionStart;
        fe.ouverts = fe.ouverts || {}; fe.ouverts[gId] = true; rendreFeuille();
        var ch = document.querySelector('.groupe-filtre[data-groupe="' + gId + '"] input[data-f="chercheOption"]');
        if (ch) { ch.focus(); try { ch.setSelectionRange(pos, pos); } catch (eS) {} ch.dispatchEvent(new Event('input', { bubbles: true })); }
        return;
      }
      var q = normaliser(el.value), g = el.closest('.groupe-filtre') || el.closest('.feuille-corps');
      if (g) {
        g.querySelectorAll('.puce').forEach(function (b) { b.hidden = !!q && b.dataset.lib && b.dataset.lib.indexOf(q) < 0; });
        g.querySelectorAll('.commune-parent-ligne').forEach(function (l) { var p = l.querySelector('.puce'); if (p) l.hidden = p.hidden; });
        g.querySelectorAll('.puces[data-ferme]').forEach(function (p) { p.hidden = !q && p.dataset.ferme === '1'; });
        var zAutres = g.querySelector('#autresSpecs'); if (zAutres && fe) zAutres.hidden = !q && !fe.autresOuvert;
        g.querySelectorAll('.section-choix').forEach(function (sec) {
          var puces = sec.querySelector('.puces');
          var aPuce = !q || !!sec.querySelector('.puce:not([hidden])');
          sec.hidden = !!q && !aPuce;
          var btn = sec.querySelector('.aire-bascule');
          if (btn) {
            var exp = q ? aPuce : (puces ? puces.dataset.ferme !== '1' : true);
            btn.setAttribute('aria-expanded', String(exp));
          }
          if (q) {
            sec.classList.toggle('ouverte', aPuce);
          } else if (puces) {
            sec.classList.toggle('ouverte', puces.dataset.ferme !== '1');
          }
        });
      }
    }
    if (f === 'jourDate' && el.value) { allerAuJour(el.value); return; }
    if (f === 'rapport') { var Rr = rapportOuCree(jourAffiche()); Rr[el.dataset.k] = el.value; sauverRapports(); return; }
    if (f === 'rechProduit') {
      S.ui.rechProduit = el.value; var pp = el.selectionStart; rendre();
      var cp = document.querySelector('[data-f="rechProduit"]'); if (cp) { cp.focus(); try { cp.setSelectionRange(pp, pp); } catch (x) {} }
    }
    if (f === 'rechHop') {   // 3.27.30 : recherche dans l'annuaire des hôpitaux
      S.ui.rechHop = el.value; S.ui.limite = 40; pos = el.selectionStart; rendre();
      var chH = document.querySelector('[data-f="rechHop"]'); if (chH) { chH.focus(); try { chH.setSelectionRange(pos, pos); } catch (x) {} }
    }
    if (f === 'recherche' || f === 'rechercheImpose') {
      if (f === 'recherche') { if (S.ui.tab === 'autour') S.ui.rechercheAutour = el.value; else S.ui.recherche = el.value; S.ui.limite = 40; } else S.ui.feuille.q = el.value;
      pos = el.selectionStart; rendre();
      var champ = document.querySelector('[data-f="' + f + '"]');
      if (champ) { champ.focus(); try { champ.setSelectionRange(pos, pos); } catch (x) {} }
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f;
    if (f === 'param') {
      var k = el.dataset.k;
      S.params[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? +el.value : el.value);
      if (k === 'dateRef' && S.params.dateRef && S.params.dateRef < aujourdhui() && (S.params.mode === 'jour' || joursOuvres(lundiDe(S.params.dateRef))[4] < aujourdhui())) {
        S.params.dateRef = aujourdhui(); toast('Impossible de planifier un jour passé : la date revient à aujourd\'hui.', 4000);
      }
      LS.set('params', S.params);
      if (k === 'dateRef' || k === 'parJour') rendre();
    }
    if (f === 'autour') { S.ui.autour[el.dataset.k] = el.value; LS.set('autour', S.ui.autour); rendre(); }
    if (f === 'crSelect') {
      var as = arret(el.dataset.uid);
      if (as) { majCr(as, el.dataset.k, el.value); if (el.dataset.k === 'statut') { appliquerStatutExpress(crDe(as)); syncCr(as); } if (el.dataset.k === 'date' && el.value) validerEtape(as, 'date'); rendre(); }
    }
    if (f === 'cr' && /^(autres)$/.test(el.dataset.k)) rendre();
    if (f === 'repriseCible' && el.value && S.ui.feuille) {
      S.ui.feuille.cible = el.value < aujourdhui() && (S.ui.feuille.source.type !== 'semaine' || joursOuvres(lundiDe(el.value))[4] < aujourdhui()) ? aujourdhui() : el.value;
      if (S.ui.feuille.cible !== el.value) toast('Impossible de reprendre sur un jour passé.', 3500);
      rendre();
    }
    if (f === 'eqDate' && el.value) { S.ui.eqDate = el.value; S.ui.jourEquipe = null; rendre(); }
    if (f === 'fiche') majChampFiche(el, true);
    if (f === 'prochaine') { var ax = arret(el.dataset.uid); if (ax) { ax.prochaine = el.value; LS.set('plan', S.plan); rendre(); } }
    if (f === 'importSecours' && el.files && el.files[0]) { importerSecours(el.files[0]); el.value = ''; }
    if (f === 'saisieAvancee') { S.config.modifPasse = S.config.saisieFutur = el.checked; LS.set('config', S.config); toast(el.checked ? 'Saisie avancée activée : jours passés et à venir modifiables.' : 'Saisie avancée désactivée : seul le jour même se saisit.'); rendre(); }
    if (f === 'waWeb') { S.config.waWeb = el.checked; LS.set('config', S.config); toast(el.checked ? 'WhatsApp Web sera toujours ouvert.' : 'WhatsApp s\'ouvrira dans l\'application du téléphone.'); }
    if (f === 'crExpress') { S.config.crExpress = el.checked; LS.set('config', S.config); toast(el.checked ? 'Compte rendu express activé : saisie rapide en 1 écran.' : 'Compte rendu express désactivé : saisie complète par étapes.'); rendre(); }
    if (f === 'saisieFutur') { S.config.saisieFutur = el.checked; LS.set('config', S.config); toast(el.checked ? 'Saisie des jours à venir activée.' : 'Jours à venir en aperçu seul.'); }
    if (f === 'modifPasse') { S.config.modifPasse = el.checked; LS.set('config', S.config); toast(el.checked ? 'Modification des jours passés activée.' : 'Jours passés en lecture seule.'); }
    if (f === 'choixNom') { var bloc = $(el.id + 'Bloc'); if (bloc) bloc.hidden = el.value !== '__autre'; }
    if (f === 'tri') { S.ui.tri = el.value; LS.set('tri', S.ui.tri); rendre(); }
    if (f === 'stats') {
      var k2 = el.dataset.k;
      S.ui.stats[k2] = k2 === 'objectif' ? Math.max(1, Math.min(200, +el.value || 40)) : el.value;
      LS.set('stats', S.ui.stats); rendre();
    }
    if (f === 'autourQuartier' && el.value) {
      var q = quartiers().filter(function (x) { return x.quartier === el.value; })[0];
      if (q) { S.ui.autour.lat = q.lat; S.ui.autour.lon = q.lon; S.ui.autour.label = q.quartier; S.ui.autour.src = 'quartier'; LS.set('autour', S.ui.autour); rendre(); }
    }
  });
  document.addEventListener('keydown', function (e) {
    // 3.28.19 : nom cliquable au clavier (Entrée ou Espace)
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('nom-lien')) { e.preventDefault(); e.stopPropagation(); ACTIONS.voirContact(e.target); return; }
    if (e.key !== 'Escape') return;
    if (S.ui.feuille) { S.ui.feuille = null; rendre(); }
    else if (S.ui.lancement) { S.ui.lancement = false; S.ui.lancementAuto = false; rendre(); }
  });

  // Saisie dans l'assistant : mise à jour du brouillon, validation dynamique au changement de champ
  function majChampFiche(el, change) {
    var f = S.ui.feuille; if (!f || f.type !== 'fiche') return;
    var d = f.d, k = el.dataset.k, i = el.dataset.i;
    var v = el.type === 'checkbox' ? (el.checked ? 'Oui' : 'Non') : el.value;
    if (k === 'telephone' && change) {
      var telFmt = formaterTelephoneCI(v);
      if (telFmt) { v = telFmt; el.value = telFmt; }
    }
    if (i !== undefined) d.lieux[+i][k] = v; else d[k] = v;
    if (!change) return;
    if (k === 'lieu' && d.type !== 'Pharmacie' && i !== undefined) {
      // Auto-correction vers l'écriture officielle et récupération automatique du quartier / GPS depuis la BDD
      var can = trouverEtablissementBDD(v, d.lieux[+i].quartier, d.lieux[+i].commune);
      if (can) {
        d.lieux[+i].lieu = can.lieu;
        if (can.quartier && !/^NL$/i.test(can.quartier)) {
          d.lieux[+i].quartier = can.quartier;
          delete f.err['quartier' + i];
        }
        if (can.commune && !/^NL$/i.test(can.commune)) d.lieux[+i].commune = can.commune;
        if (can.lat && can.lon) { d.lieux[+i].lat = can.lat; d.lieux[+i].lon = can.lon; }
        // 3.27.4 : repères et GPS des autres praticiens du même établissement
        var ib = infosLieuBase(can.lieu);
        if (!d.lieux[+i].reperes && ib.reperes) d.lieux[+i].reperes = ib.reperes;
        if (ib.lat && !(can.lat && can.lon)) { d.lieux[+i].lat = ib.lat; d.lieux[+i].lon = ib.lon; }
        delete f.err['lieu' + i];
        rendre();
        return;
      }
    }
    if (k === 'specialite' || k === 'quartier') {
      // liste déroulante : nouvel affichage (champ « Autre », commune), en gardant les erreurs déjà signalées
      var tous = Object.assign(erreursEtape(d, 0), erreursEtape(d, 1)), cleS = k === 'quartier' ? 'quartier' + i : 'specialite', garde = {};
      Object.keys(f.err).forEach(function (x) { if (tous[x]) garde[x] = tous[x]; });
      if (tous[cleS]) garde[cleS] = tous[cleS];
      f.err = garde; rendre(); return;
    }
    var cle = { lieu: 'lieu', horaireMatin: 'hm', horaireSoir: 'hs' }[k];
    cle = cle ? cle + i : k;
    var err = Object.assign(erreursEtape(d, 0), erreursEtape(d, 1))[cle] || '';
    if (err) f.err[cle] = err; else delete f.err[cle];
    var span = document.getElementById('err-' + cle);
    if (span) span.textContent = err;
    if (err) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  function focusErreur() {
    var el = document.querySelector('.feuille [aria-invalid="true"]');
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
    else { var s = document.querySelector('.feuille .erreur:not(:empty), .feuille .erreur-texte'); if (s) s.scrollIntoView({ block: 'center' }); }
  }

