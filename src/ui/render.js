  // ------------------------------------------------------------------ En-tête, barre, navigation
  // 3.26.93 : l'en-tête (MediPlanner, date, nom, synchro, roue crantée) reste visible au-dessus de toutes les fenêtres
  function majHauteurEntete() { var e = document.querySelector('.entete'); if (e) document.documentElement.style.setProperty('--h-entete', e.offsetHeight + 'px'); }
  window.addEventListener('resize', majHauteurEntete);
  function afficherEntete() {
    setTimeout(majHauteurEntete, 0);
    var t = aujourdhui();
    var moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    var ed = $('enteteDate'); if (ed) ed.textContent = majuscule(JOURS_COURTS[jourSemaineIndex(t)]) + ' ' + (+t.slice(8)) + ' ' + moisCourts[+t.slice(5, 7) - 1] + (moi() ? ' · ' + moi() : '');
    var p = $('pastilleSync'), etat, texte; if (!p) return;
    if (S.config.demo) { etat = 'demo'; texte = 'Démo'; }
    else if (!S.config.url) { etat = 'erreur'; texte = 'Non connecté'; }
    else if (S.ui.sync === 'encours') { etat = 'encours'; texte = 'Synchro…'; }
    else if (!navigator.onLine || S.ui.sync === 'horsligne') { etat = 'horsligne'; texte = enAttente() ? enAttente() + ' en attente' : 'Hors ligne'; }
    else if (S.ui.sync === 'erreur') { etat = 'erreur'; texte = 'Erreur synchro'; }
    else if (enAttente()) { etat = 'attente'; texte = enAttente() + ' en attente'; }
    else { etat = 'ok'; texte = S.data && S.data.syncedAt ? 'À jour ' + new Date(S.data.syncedAt).toTimeString().slice(0, 5) : 'À jour'; }
    p.dataset.etat = etat; p.innerHTML = '<span>' + esc(texte) + '</span>' + (etat === 'demo' ? '' : icone('relancer'));
    p.setAttribute('aria-label', 'Synchronisation : ' + texte + (S.ui.erreur ? '. ' + S.ui.erreur : ''));
  }
  function afficherBarre() {
    var att = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; }), n = att.length;
    // inutile si le seul compte rendu en attente est celui de la carte ouverte (qui a son propre bouton)
    var visible = S.ui.tab === 'jour' && n > 0 && !S.ui.feuille && !(n === 1 && S.ui.ouvert === att[0].uid);
    var bv = $('barreValider'); if (bv) bv.hidden = !visible;
    document.body.classList.toggle('avec-barre', visible);
    var btv = $('boutonValider'); if (btv) btv.textContent = n > 1 ? 'Enregistrer les ' + n + ' comptes rendus' : 'Enregistrer le compte rendu';
  }
  function afficherNav() {
    document.querySelectorAll('.navigation button').forEach(function (b) {
      var actif = S.ui.tab === 'autour' || S.ui.tab === 'rapport' || S.ui.tab === 'bilanjour' ? 'jour' : (S.ui.tab === 'recherche' || S.ui.tab === 'contacts' ? 'praticiens' : (S.ui.tab === 'suivi' ? (S.ui.suiviVue || 'bilan') : (S.ui.tab === 'audit' ? 'bilan' : S.ui.tab)));
      if (b.dataset.tab === actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  // ------------------------------------------------------------------ Rendu
  // 3.27.26 : écran gardé au rafraîchissement (onglet, carte ouverte, position) pendant la session
  var UI_SESSION = 'mediplanner.ui';
  function memoriserEcran() {
    try { sessionStorage.setItem(UI_SESSION, JSON.stringify({ tab: S.ui.tab, ouvert: S.ui.ouvert || null, contact: S.ui.contactOuvert || null, hop: S.ui.hopOuvert || null, y: Math.round(window.scrollY), t: Date.now() })); } catch (e) {}
  }
  function rendre() {
    var tab = S.ui.tab;
    // onglet mémorisé : l'application rouvre là où l'on était (rafraîchissement, mise à jour, relance)
    if (VUES[tab] && tab !== 'accueil' && tab !== 'identite' && LS.get('onglet', '') !== tab) LS.set('onglet', tab);
    // jour affiché mémorisé : un rafraîchissement ne ramène plus au lundi (valable jusqu'à minuit)
    if (S.ui.jour || S.ui.jourVue) LS.set('jourVu', { j: S.ui.jour, v: S.ui.jourVue || null, le: aujourdhui() });
    LS.set('proches', S.ui.pharmaciesProches || false);
    // 3.28.36 : premier lancement par le lien d'un collègue : le profil se remplit pendant que la base se télécharge
    if (connecte() && !moi() && tab !== 'reglages' && !S.ui.restauration) tab = 'identite';
    else if (!pret() && tab !== 'reglages') tab = connecte() ? 'chargement' : 'accueil';   // 3.26.73 : téléphone relié mais base pas encore reçue
    cacherInfobulle();
    cartesAFaire = [];
    // 3.24.14 : un rafraîchissement du même écran (synchronisation, minuterie) ne rejoue aucune animation
    // et garde la position de lecture : l'écran ne bouge plus
    var vue = $('vue'), y = window.scrollY;
    var aActif = document.activeElement;
    var infoFocus = null;
    if (aActif && (aActif.tagName === 'INPUT' || aActif.tagName === 'TEXTAREA')) {
      infoFocus = {
        id: aActif.id,
        f: aActif.dataset ? aActif.dataset.f : null,
        val: aActif.value,
        selStart: aActif.selectionStart,
        selEnd: aActif.selectionEnd
      };
    }
    var bjAvant = vue.querySelector('.bj-jours'), actAvant = bjAvant && bjAvant.querySelector('.bj-jour[aria-pressed="true"]');
    var dateAvant = actAvant && actAvant.dataset ? actAvant.dataset.v : null;
    if (bjAvant && S.ui.bjDepart === undefined && actAvant) {
      S.ui.bjAvantDate = dateAvant;
      S.ui.bjAvantLeft = actAvant.getBoundingClientRect().left - bjAvant.getBoundingClientRect().left;
    }
    vue.classList.remove('vue-entre', 'jour-glisse-d', 'jour-glisse-g');
    try {
      vue.innerHTML = (VUES[tab] || VUES.jour)();
      if (infoFocus) {
        var champCible = infoFocus.id ? $(infoFocus.id) : (infoFocus.f ? vue.querySelector('[data-f="' + infoFocus.f + '"]') : null);
        if (champCible) {
          champCible.focus();
          if (infoFocus.selStart !== null && infoFocus.selEnd !== null) {
            try { champCible.setSelectionRange(infoFocus.selStart, infoFocus.selEnd); } catch (eF) {}
          }
        }
      }
    } catch (errVue) {
      console.error('Erreur rendu vue ' + tab + ':', errVue);
      S.ui.tab = 'jour';
      S.ui.rechOuverte = false;
      LS.set('rechOuverte', false);
      LS.set('onglet', 'jour');
      try {
        vue.innerHTML = (VUES.jour || function () { return '<div class="vide">Erreur d\'affichage. Rechargement sur la journée...</div>'; })();
      } catch (e2) {
        // 3.27.21 : le détail technique est affiché pour pouvoir corriger (capture d'écran)
        var det = function (e) { return String((e && e.message) || e) + ' | ' + String((e && e.stack) || '').split('\n').slice(1, 3).map(function (l) { return l.replace(/^\s*at\s*/, '').replace(/https?:\/\/[^\s)]*\//g, ''); }).join(' < '); };
        try { LS.set('derniereErreur', { le: new Date().toISOString(), v: APP_VERSION, vue: tab, e1: det(errVue), e2: det(e2) }); } catch (e3) {}
        vue.innerHTML = '<div class="vide"><strong>Erreur d\'affichage</strong>Touchez un onglet ci-dessous ou rechargez la page.' +
          '<small style="display:block;margin-top:14px;font-size:11px;line-height:1.35;word-break:break-word;opacity:.75">v' + APP_VERSION + ' · ' + esc(det(e2)) + '</small></div>';
      }
    }
    memoriserEcran();
    animerRendu(tab, dateAvant); annoncer(tab === 'jour' ? 'Affichage de la journée' : (tab === 'semaine' ? 'Planifier' : tab));
    if (!vue.classList.contains('vue-entre') && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
    centrerBandeJours();
    dessinerCartes();
    rendreFeuille();
    rendreLancement();
    afficherEntete(); afficherBarre(); afficherNav();
    datesEnFrancais();
    initGlisseHorizontale();
    attacherInfiniteScroll();
  }

  // 3.27.47 : Infinite Scroll fluide pour le Répertoire (anti DOM bloat)
  var repObserver = null;
  function attacherInfiniteScroll() {
    if (repObserver) {
      try { repObserver.disconnect(); } catch (e) {}
      repObserver = null;
    }
    if (!('IntersectionObserver' in window)) return;
    var sentinellePrat = document.getElementById('sentinelleScrollRep');
    if (!sentinellePrat) return;

    var throttleTimer = null;
    repObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (throttleTimer) return;
        throttleTimer = setTimeout(function () { throttleTimer = null; }, 150);
        if (typeof window.chargerSuitePraticiens === 'function') {
          window.chargerSuitePraticiens();
        }
      });
    }, { rootMargin: '300px 0px 300px 0px', threshold: 0.01 });

    repObserver.observe(sentinellePrat);
  }
  // 3.19.0 : animations discrètes, seulement quand quelque chose change vraiment
  // (nouvel écran, nouvelle question d'un parcours, carte qu'on vient d'ouvrir, compte rendu qu'on vient d'enregistrer)
  function animerRendu(tab, dateAvant) {
    var dCour = S.ui.jourVue || S.ui.jour || '';
    var v = $('vue'), cle = tab + '|' + (S.ui.rechOuverte ? 1 : 0) + '|' + (S.ui.voirParams ? 1 : 0) + '|' + dCour;
    var nouvelEcran = cle !== S.ui.cleVue;
    if (nouvelEcran) {
      void v.offsetWidth; v.classList.add('vue-entre');
      if (dateAvant && dCour && dateAvant !== dCour && (tab === 'jour' || tab === 'semaine')) {
        v.classList.add(dCour > dateAvant ? 'jour-glisse-d' : 'jour-glisse-g');
      }
      S.ui.cleVue = cle;
      // 3.24.0 : les cartes, lignes et indicateurs arrivent l'un après l'autre (cascade)
      v.querySelectorAll('.arret, .ligne-plan, .liste > .element, .kpi, .ligne-gamme, .tuile, .bj-jour').forEach(function (el, i) { el.style.setProperty('--i', Math.min(i, 14)); });
      if (!reduireAnimations()) compterChiffres(v);
    }
    // la prochaine visite du jour respire (anneau qui pulse sur la ligne du temps)
    var t = aujourdhui(), now = minutesMaintenant(), proch = S.plan.filter(function (x) { return x.date === t && !x.statut && (heureVersMinutes(x.heure) === null || heureVersMinutes(x.heure) >= now - 20); })[0];
    if (proch && tab === 'jour') { var bp = v.querySelector('.arret .carte-bouton[data-uid="' + proch.uid + '"]'); if (bp) bp.closest('.arret').classList.add('prochaine'); }
    if (tab !== S.ui.ongletAnime) {
      var nb = document.querySelector('.navigation button[aria-current="page"]');
      if (nb) { nb.classList.remove('rebond'); void nb.offsetWidth; nb.classList.add('rebond'); }
      S.ui.ongletAnime = tab;
    }
    var bpx = v.querySelector('.bandeau-proche'), kp = bpx ? bpx.textContent : '';
    if (bpx && kp !== S.ui.cleProche) bpx.classList.add('nouveau');
    S.ui.cleProche = kp;
    var q = v.querySelector('.cr-question .etape-titre'), kq = q ? q.textContent : '';
    if (q && kq !== S.ui.cleQuestion) q.parentNode.classList.add('nouvelle');
    S.ui.cleQuestion = kq;
    var o = v.querySelector('.arret.ouvert');
    if (o && S.ui.ouvert !== S.ui.dernierOuvert) o.classList.add('vient-ouvrir');
    S.ui.dernierOuvert = S.ui.ouvert;
    if (S.ui.flashOk) { var f = S.ui.flashOk; setTimeout(function () { if (S.ui.flashOk === f) S.ui.flashOk = null; }, 900); }
  }
  // chiffres des indicateurs qui défilent de 0 à leur valeur
  function compterChiffres(v) {
    v.querySelectorAll('.kpi > b, .chiffre > b, .sj-taux > b').forEach(function (b) {
      var txt = b.textContent, m = txt.match(/^(\d+)(.*)$/); if (!m || +m[1] < 2) return;
      var fin = +m[1], suite = m[2], debut = performance.now();
      (function pas(t) {
        var p = Math.min(1, (t - debut) / 700), e = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(fin * e) + suite;
        if (p < 1) requestAnimationFrame(pas);
      })(debut);
    });
  }
  // onde au toucher des boutons
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.bouton, .puce, .tuile, .bj-jour, .pastille-produit');
    if (!b || reduireAnimations()) return;
    var r = b.getBoundingClientRect(), o = document.createElement('span'), s = Math.max(r.width, r.height);
    o.className = 'onde'; o.style.width = o.style.height = s + 'px';
    o.style.left = (e.clientX - r.left - s / 2) + 'px'; o.style.top = (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(o); setTimeout(function () { o.remove(); }, 600);
  }, { passive: true });
  // 3.28.6 : appui tactile long epure avec confirmation immediate (sans animation circulaire)
  (function () {
    var timer = null, startX = 0, startY = 0, cibleDate = null, cibleEl = null, longPressFired = false;
    var dernierAppuiLongFired = 0;
    var dernierTouchTime = 0;
    var DUREE_APPUI_LONG = 550;
    var DUREE_SUPPR_JOUR = 1500;   // 3.28.42 : suppression d'une journée : appui plus long, par sécurité
    function annulerAppuiLong() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (cibleEl) { cibleEl.classList.remove('appui-long-actif', 'appui-suppr-jour'); cibleEl = null; }
      cibleDate = null;
      longPressFired = false;
    }

    function demarrerAppuiLong(e) {
      annulerAppuiLong();

      // 1. Bouton de date (frise semaine ou bande-jours accueil/journée) OU titre/en-tête de la journée
      var bjBtn = e.target && e.target.closest && e.target.closest('.bj-jour[data-v]');
      var tetePlan = e.target && e.target.closest && e.target.closest('.tete-jour-plan, .tete-jour');
      if (bjBtn || tetePlan) {
        var date = bjBtn ? bjBtn.dataset.v : (S.ui.jour || (typeof jourAffiche === 'function' ? jourAffiche() : aujourdhui()));
        if (!date) return;
        var pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        cibleDate = date;
        cibleEl = bjBtn || (tetePlan.querySelector('.bilan-jour') || tetePlan);
        if (cibleEl) cibleEl.classList.add('appui-long-actif', 'appui-suppr-jour');

        timer = setTimeout(function () {
          timer = null;
          longPressFired = true;
          dernierAppuiLongFired = Date.now();
          if (cibleEl) {
            cibleEl.classList.remove('appui-long-actif', 'appui-suppr-jour');
            cibleEl = null;
          }
          try {
            if (navigator.vibrate) navigator.vibrate(50);
          } catch (err) {}

          // 3.28.57 : on compte tout ce que Journée affiche pour ce jour (tournée du téléphone, tournée publiée, archive,
          // visites saisies), une fois par praticien ; les visites déjà renseignées restent toujours
          var cpt = comptesJour(date);
          if (cpt.aFaire > 0) {
            demanderSuppressionJour(date, cpt.aFaire, cpt.faites);
          } else if (cpt.faites > 0) {
            toast('Toutes les visites du ' + dateLongue(date) + ' (' + cpt.faites + ') sont déjà renseignées : elles restent. Pour en retirer une, ouvrez son compte rendu dans Journée.', 6000);
          } else if ((S.jours && S.jours[date]) || (typeof datesPlan === 'function' && datesPlan().indexOf(date) >= 0)) {
            demanderSuppressionJour(date, 0, 0);
          } else {
            toast('Journée vide (' + majuscule(dateLongue(date)) + ') : aucune visite à supprimer');
          }
        }, DUREE_SUPPR_JOUR);
        return;
      }

      // 2. Visites dans la Journee : appui 650 ms sur un arret = effacer le compte rendu ou retirer la visite
      var li = e.target && e.target.closest && e.target.closest('li.arret[data-uid-arret]');
      if (li && !(e.target.closest && e.target.closest('input, textarea, select, button, a'))) {
        var av = typeof arret === 'function' ? arret(li.dataset.uidArret) : null;
        if (!av) return;
        var ptj = e.touches ? e.touches[0] : e;
        startX = ptj.clientX;
        startY = ptj.clientY;
        cibleEl = li.querySelector('.arret-carte') || li;
        if (cibleEl) cibleEl.classList.add('appui-long-actif');
        timer = setTimeout(function () {
          timer = null;
          longPressFired = true;
          dernierAppuiLongFired = Date.now();
          if (cibleEl) { cibleEl.classList.remove('appui-long-actif'); cibleEl = null; }
          try { if (navigator.vibrate) navigator.vibrate(50); } catch (err) {}
          if (av.statut) { S.ui.feuille = { type: 'effacerVisite', titre: 'Effacer le compte rendu', uid: av.uid }; rendre(); }
          else confirmerPuis('Supprimer la visite', 'Retirer <b>' + esc(av.nom) + '</b> de la journee ?', 'Supprimer', function () { supprimerVisiteJour(av); });
        }, DUREE_APPUI_LONG);
        return;
      }

      // 3. RDV ou element retirable de l'etape 7 : retrait apres confirmation
      var liR = e.target && e.target.closest && e.target.closest('li.li-retirable[data-retirer]');
      if (liR && !(e.target.closest('button'))) {
        var ptr = e.touches ? e.touches[0] : e;
        startX = ptr.clientX;
        startY = ptr.clientY;
        cibleEl = liR;
        if (cibleEl) cibleEl.classList.add('appui-long-actif');
        timer = setTimeout(function () {
          timer = null;
          longPressFired = true;
          dernierAppuiLongFired = Date.now();
          if (cibleEl) { cibleEl.classList.remove('appui-long-actif'); cibleEl = null; }
          try { if (navigator.vibrate) navigator.vibrate(50); } catch (err) {}
          if (liR.dataset.retirer === 'imp') ACTIONS.retirerImposeDemande({ dataset: { i: liR.dataset.v } });
          else ACTIONS.retirerRdvDemande({ dataset: { v: liR.dataset.v } });
        }, DUREE_APPUI_LONG);
        return;
      }
    }

    function bougerAppuiLong(e) {
      if (!timer) return;
      var pt = e.touches ? e.touches[0] : e;
      var dx = Math.abs(pt.clientX - startX), dy = Math.abs(pt.clientY - startY);
      if (dx > 24 || dy > 24) annulerAppuiLong();
    }

    function terminerAppuiLong(e) {
      if (longPressFired) {
        dernierAppuiLongFired = Date.now();
        if (e && e.cancelable) e.preventDefault();
      }
      annulerAppuiLong();
    }

    // Touch events (mobiles & tablettes)
    document.addEventListener('touchstart', function (e) {
      dernierTouchTime = Date.now();
      if (e.touches && e.touches.length > 1) { annulerAppuiLong(); return; }
      demarrerAppuiLong(e);
    }, { passive: true });
    document.addEventListener('touchmove', bougerAppuiLong, { passive: true });
    document.addEventListener('touchend', terminerAppuiLong, { passive: false });
    document.addEventListener('touchcancel', function () {
      if (!longPressFired) annulerAppuiLong();
    }, { passive: true });

    // Pointer/Mouse events (ordinateurs & souris)
    document.addEventListener('mousedown', function (e) {
      if (Date.now() - dernierTouchTime < 1000) return;
      if (e.button !== 0) return;
      demarrerAppuiLong(e);
    });
    document.addEventListener('mousemove', bougerAppuiLong);
    document.addEventListener('mouseup', terminerAppuiLong);

    // Empêcher l'ouverture du menu contextuel Android / iOS lors de l'appui long
    // Crucial : ne pas appeler annulerAppuiLong() ici car contextmenu se déclenche vers ~500ms sur mobile !
    window.addEventListener('contextmenu', function (e) {
      if (cibleEl || longPressFired || (Date.now() - dernierAppuiLongFired < 1200)) {
        e.preventDefault();
      }
    }, true);

    // Bloquer impérativement tout clic parasite synthétisé lors du relâchement du doigt après un appui long
    // (évite notamment la fermeture immédiate de la feuille de confirmation par clic sur le voile,
    //  ou le basculement accidentel vers une autre date sur la frise sous-jacente)
    window.addEventListener('click', function (e) {
      if (Date.now() - dernierAppuiLongFired < 800) {
        // Laisser impérativement passer les clics sur les boutons de la boîte de dialogue modale
        if (e.target && e.target.closest && e.target.closest('.feuille-pied, .feuille-corps, .feuille-tete')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    }, true);
  })();
  // 3.25.24 : glissement fluide (courbe cubic-bezier) et cliqué-glissé avec inertie sur les bandeaux horizontaux
  function glisserHorizontal(el, depart, cible, duree) {
    if (!el) return;
    if (reduireAnimations() || Math.abs(cible - depart) < 2) { el.scrollLeft = cible; return; }
    if (el.__animId) cancelAnimationFrame(el.__animId);
    el.classList.add('anim-scroll');
    el.scrollLeft = depart;
    var t0 = performance.now(), d = duree || 360;
    function pas(t) {
      var p = Math.min(1, (t - t0) / d);
      var ease = 1 - Math.pow(1 - p, 3);
      el.scrollLeft = depart + (cible - depart) * ease;
      if (p < 1) el.__animId = requestAnimationFrame(pas);
      else { el.__animId = null; el.classList.remove('anim-scroll'); }
    }
    el.__animId = requestAnimationFrame(pas);
  }
  // bande des jours : le jour choisi glisse au centre (depuis la position précédente, pour garder le mouvement)
  function centrerBandeJours() {
    var b = document.querySelector('.bj-jours'), s = b && b.querySelector('.bj-jour[aria-pressed="true"]');
    if (!s) { S.ui.bjDepart = null; S.ui.bjAvantDate = null; return; }
    // 3.28.31 : centré sur la largeur de l'écran (et non de la bande, raccourcie par le bouton calendrier)
    var bR = b.getBoundingClientRect(), posS = s.getBoundingClientRect().left - bR.left + b.scrollLeft;
    var milieu = (window.innerWidth || document.documentElement.clientWidth) / 2 - bR.left;
    // marges pour que chaque jour, même le premier ou le dernier, puisse venir au centre de l'écran,
    // et repère d'aimantation (scroll-snap) placé au centre de l'écran
    var demi = s.offsetWidth / 2;
    b.style.paddingLeft = Math.max(2, milieu - demi) + 'px';
    b.style.paddingRight = Math.max(2, bR.width - milieu - demi) + 'px';
    b.style.scrollPaddingLeft = Math.max(0, 2 * milieu - bR.width) + 'px';
    b.style.scrollPaddingRight = Math.max(0, bR.width - 2 * milieu) + 'px';
    posS = s.getBoundingClientRect().left - bR.left + b.scrollLeft;
    var cible = posS + s.offsetWidth / 2 - milieu;
    if (S.ui.bjDepart !== undefined && S.ui.bjDepart !== null) {
      var dep = posS - S.ui.bjDepart;
      S.ui.bjDepart = null; S.ui.bjAvantDate = null;
      glisserHorizontal(b, dep, cible, 360);
    } else if (S.ui.bjAvantDate && S.ui.bjAvantDate !== s.dataset.v) {
      var ancien = b.querySelector('.bj-jour[data-v="' + S.ui.bjAvantDate + '"]');
      var dep2 = ancien ? (ancien.getBoundingClientRect().left - bR.left + b.scrollLeft) - (S.ui.bjAvantLeft || milieu - ancien.offsetWidth / 2) : b.scrollLeft;
      S.ui.bjAvantDate = null;
      glisserHorizontal(b, dep2, cible, 380);
    } else {
      S.ui.bjAvantDate = null;
      b.scrollLeft = cible;
    }
  }
  function initGlisseHorizontale() {
    document.querySelectorAll('.bj-jours, .defile, .jours').forEach(function (el) {
      if (el.__glisseInit) return;
      el.__glisseInit = true;
      var actif = false, bouge = false, startX = 0, startScroll = 0, lastX = 0, lastT = 0, vx = 0;
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || e.button > 0) return;
        if (el.__animId) { cancelAnimationFrame(el.__animId); el.__animId = null; }
        actif = true; bouge = false; startX = lastX = e.clientX; startScroll = el.scrollLeft; lastT = performance.now(); vx = 0;
      });
      el.addEventListener('pointermove', function (e) {
        if (!actif) return;
        var dx = e.clientX - startX;
        if (!bouge && Math.abs(dx) > 5) { bouge = true; el.classList.add('en-glisse', 'anim-scroll'); }
        if (!bouge) return;
        var now = performance.now(), dt = Math.max(1, now - lastT);
        vx = (lastX - e.clientX) / dt;
        lastX = e.clientX; lastT = now;
        el.scrollLeft = startScroll - dx;
      });
      function fin() {
        if (!actif) return;
        actif = false;
        el.classList.remove('en-glisse');
        if (!bouge) { el.classList.remove('anim-scroll'); return; }
        el.__bloqueClic = Date.now() + 180;
        var cible = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + vx * 220));
        glisserHorizontal(el, el.scrollLeft, cible, 340);
      }
      el.addEventListener('pointerup', fin);
      el.addEventListener('pointercancel', fin);
      el.addEventListener('pointerleave', fin);
      el.addEventListener('click', function (e) {
        if (el.__bloqueClic && Date.now() < el.__bloqueClic) { e.stopPropagation(); e.preventDefault(); }
      }, true);
    });
  }
  function reduireAnimations() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  // Calendriers : affichage français JJ-Mmm-AAAA (ex. 26-Oct-2026), quel que soit le réglage du téléphone.
  // Le sélecteur natif reste dessous (transparent) : toucher la date ouvre le calendrier du téléphone.
  var MOIS_ABREGES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  function dateFr(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '-' + MOIS_ABREGES[+p[1] - 1] + '-' + p[0] : ''; }
  function datesEnFrancais() {
    document.querySelectorAll('input[type="date"]:not([data-fr])').forEach(function (inp) {
      inp.setAttribute('data-fr', '1'); inp.setAttribute('lang', 'fr');
      var cadre = document.createElement('span'), texte = document.createElement('span');
      cadre.className = 'date-fr'; texte.className = 'date-fr-texte';
      inp.parentNode.insertBefore(cadre, inp); cadre.appendChild(texte); cadre.appendChild(inp);
      var maj = function () { texte.textContent = inp.value ? dateFr(inp.value) : 'JJ-Mmm-AAAA'; texte.classList.toggle('vide', !inp.value); };
      maj();
      inp.addEventListener('input', maj); inp.addEventListener('change', maj);
      inp.addEventListener('click', function () { try { inp.showPicker(); } catch (e) {} });
    });
  }
  function rendreSiPossible() {
    var a = document.activeElement;
    if (a && (($('vue').contains(a)) || $('feuille').contains(a)) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { afficherEntete(); afficherBarre(); return; }
    rendre();
  }
  var VUES = {};

