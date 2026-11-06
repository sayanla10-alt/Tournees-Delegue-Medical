  VUES.praticiens = function () {
    var f = S.ui.filtres, t = aujourdhui(), c = ctx();
    var liste = trierPraticiens(filtrerPraticiens(f, S.ui.recherche), S.ui.tri);
    // la fiche ouverte (par exemple juste créée) reste en tête de liste
    var io = liste.map(function (p) { return p.code; }).indexOf(S.ui.contactOuvert);
    if (io > 0 && S.ui.contactEnTete === S.ui.contactOuvert) liste.unshift(liste.splice(io, 1)[0]);
    // 3.19.0 : les critères s'ouvrent sur une page à part (même onglet) ; dès les résultats affichés, ils disparaissent
    // au profit d'une phrase (nombre de praticiens et critères appliqués) et de « Tout effacer »
    if (S.ui.rechOuverte) {
      return '<div class="page-entree"><button type="button" class="retour" data-a="rechFermer">' + icone('chevron') + 'Répertoire</button>' +
        '<h2 class="titre-vue">Critères de recherche</h2><p class="sous-titre">Une question à la fois ; les résultats s\'affichent à la fin.</p>' +
        '<section class="bloc">' + barreFiltres(f, S.ui.recherche, true) + '</section>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="rechFermer">' + icone('loupe') + 'Voir ' + (liste.length ? 'les ' + liste.length + ' résultat' + (liste.length > 1 ? 's' : '') : 'les résultats') + '</button></div>';
    }
    var h = '<div class="tete-vue"><h2 class="titre-vue">Répertoire</h2></div>' +
      '<p class="sous-titre">Médecins, pharmacies et hôpitaux : recherchez, filtrez, mettez à jour leurs fiches.</p>';
    h += selecteurAnnuaire(f);
    if (S.ui.annuaire === 'hop') {
      if (!gpsFrais()) relocaliserSiBesoin('repertoireHop');
      return h + vueHopitaux(f);
    }
    h += '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="recherche" placeholder="Nom, spécialité, établissement, quartier…" value="' +
        esc(S.ui.recherche) + '" aria-label="Rechercher un praticien"></div></div>';
    h += '<div class="rangee-actions-rep">' +
      '<button class="bouton bouton-criteres" type="button" data-a="rechOuvrir">' + icone('filtre') + '<span>Recherche</span></button>' +
      '<button class="bouton bouton-plein bouton-ajouter-rep" type="button" data-a="nouvelleFiche">' + icone('plus') + '<span>Ajouter</span></button>' +
      (S.ui.contactOuvert
        ? '<button class="bouton bouton-modifier-rep" type="button" data-a="modifierActif">' + icone('crayon') + '<span>Modifier</span></button>'
        : '<button class="bouton bouton-modifier-rep desactive" type="button" data-a="modifierActif" style="opacity:.45" title="Touchez d\'abord un contact dans la liste">' + icone('crayon') + '<span>Modifier</span></button>') +
      '</div>';
    var aFiltres = criteresActifs(f).length > 0 || !!(S.ui.recherche && String(S.ui.recherche).trim());
    var phrase = phraseCriteres(f, S.ui.recherche, liste.length, S.ui.tri);
    h += '<div class="bandeau-criteres-rep">' +
      '<p class="phrase-criteres">' + esc(phrase) + '</p>' +
      '<div class="centre-reinit-rep">' +
        (aFiltres
          ? '<button type="button" class="bouton-reinit-rep" data-a="effacerFiltres" title="Réinitialiser les filtres et recommencer">' +
              icone('relancer') + '<span>Réinitialiser les filtres</span>' +
            '</button>'
          : '<button type="button" class="bouton-reinit-rep desactive" disabled title="Aucun filtre actif">' +
              icone('relancer') + '<span>Réinitialiser les filtres</span>' +
            '</button>') +
      '</div>' +
      '</div>';
    if (!liste.length) return h + '<div class="vide"><strong>Aucun praticien</strong>Aucun praticien ne correspond à tous ces critères.<div style="margin-top:14px"><button class="bouton bouton-plein" type="button" data-a="effacerFiltres">' + icone('relancer') + 'Réinitialiser les filtres et recommencer</button></div></div>';
  // 3.27.47 : Rendu unitaire d'une carte praticien pour Infinite Scroll et affichage progressif sans DOM bloat
  function cartePraticienHtml(p, c, t, ouvert) {
    if (!p) return '';
    c = c || ctx();
    t = t || aujourdhui();
    if (ouvert === undefined) ouvert = S.ui.contactOuvert === p.code;
    var lieux = fusionnerLieux(c.presencesParCode[p.code] || []);
    var h = '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="contact" data-v="' + esc(p.code) + '" aria-expanded="' + ouvert + '">' +
      '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
      '<span class="discret bloc-texte">' + (estPharmacie(p) ? '' : '<b class="spec-gras">' + esc(abrSpec(p.specialite)) + '</b>, ') + lieux.length + ' lieu' + (lieux.length > 1 ? 'x' : '') + ' : ' +
        (function () { var coF = ensemble(S.ui.filtres && S.ui.filtres.communes || []), aF = Object.keys(coF).length;
          var ok = function (x) { return aF && communeCorrespondante(x, coF); };
          var tri = lieux.slice().sort(function (x, y) { return (ok(y) ? 1 : 0) - (ok(x) ? 1 : 0); }), vus = {};
          return tri.filter(function (x) { if (vus[x.commune]) return false; vus[x.commune] = 1; return true; })
            .map(function (x) { return ok(x) ? '<b>' + esc(x.commune) + '</b>' : esc(x.commune); }).join(', '); })() + '</span>' +
      '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere)) + '</span>' +
        (function () { var nG = lieux.filter(aCoord).length, cl = !lieux.length || nG === 0 ? 'gps-non' : (nG === lieux.length ? 'gps-ok' : 'gps-partiel');
          return '<span class="etiquette etiquette-gps ' + cl + '">' + icone('carte') + 'GPS ' + nG + '/' + (lieux.length || 1) + '</span>'; })() +
      (estPharmacie(p) ? (p.statut ? '<span class="etiquette ' + (estKo(p.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(p)) + '</span>' : '') : badgePresenceMedecin(p.code, p)) +
      (/^TMP-/.test(p.code) || ficheEnAttente(p.code) ? '<span class="etiquette p1">Fiche en attente d\'envoi</span>' : '') +
      etiquetteCollegues(p.code, t) + '</span></button>';
    if (ouvert) {
      var cr = (c.parCode[p.code] || [])[0], pres = lieux[0] || {};
      h += prochainePresenceHtml(p) + actionsRapides({ telephone: p.telephone, lat: cr && cr.coord && cr.coord.lat, lon: cr && cr.coord && cr.coord.lon,
                            lieu: pres.lieu, quartier: pres.quartier, commune: pres.commune });
      if (p.telephone) h += '<p class="discret" style="margin:6px 0 0">Tél : ' + esc(p.telephone) + '</p>';
      if (p.commentaire) h += '<p class="discret" style="margin:0">Dernier commentaire : ' + esc(p.commentaire) + '</p>';
      if (p.prochaine) h += '<p class="discret" style="margin:4px 0 0">Prochain RDV le ' + dateCourte(p.prochaine) + '</p>';
      if (p.absentDu) h += '<p class="discret erreur-texte" style="margin:4px 0 0">Absent du ' + dateCourte(p.absentDu) + (p.absentAu ? ' au ' + dateCourte(p.absentAu) : '') + '</p>';
      h += grillePresences(p.code);
      var impose = S.imposes.some(function (im) { return im.code === p.code; });
      var dejaAuj = S.plan.some(function (a) { return a.code === p.code && a.date === t; });

      h += '<div class="bloc-actions-contact">' +
        '<div class="rangee rangee-actions-contact">' +
          (dejaAuj
            ? '<span class="badge-deja-prevu">' + icone('valider') + 'Prévu ce jour</span>'
            : '<button class="bouton bouton-inopinee" type="button" data-a="visiteInopineeDirect" data-v="' + esc(p.code) + '" title="Ajouter immédiatement à la tournée d\'aujourd\'hui">' +
                icone('eclair') + '<span>Ajouter au jour</span></button>') +
          '<button class="bouton" type="button" data-a="imposerDirect" data-v="' + esc(p.code) + '">' + icone('calendrier') + '<span>' + (impose ? 'Re-planifier' : 'Planifier') + '</span></button>' +
          '<button class="bouton" type="button" data-a="modifierFiche" data-v="' + esc(p.code) + '">' + icone('crayon') + '<span>Modifier</span></button>' +
        '</div></div>';
    }
    h += '</li>';
    return h;
  }

  function chargerSuitePraticiens() {
    var ul = document.getElementById('listePraticiens');
    if (!ul || !S.ui._pratListe) return;
    var liste = S.ui._pratListe;
    var debut = S.ui._pratAffiches || 0;
    if (debut >= liste.length) return;
    var fin = Math.min(debut + 30, liste.length);
    var c = ctx(), t = aujourdhui();
    var chunks = [];
    for (var i = debut; i < fin; i++) {
      chunks.push(cartePraticienHtml(liste[i], c, t, S.ui.contactOuvert === liste[i].code));
    }
    ul.insertAdjacentHTML('beforeend', chunks.join(''));
    S.ui._pratAffiches = fin;
    var reste = liste.length - fin;
    var zone = document.getElementById('zonePlusPrat');
    var sentinelle = document.getElementById('sentinelleScrollRep');
    if (reste > 0) {
      if (zone) {
        var btn = zone.querySelector('button');
        if (btn) btn.textContent = 'Afficher plus (' + reste + ' restant' + (reste > 1 ? 's' : '') + ')';
      }
    } else {
      if (zone) zone.remove();
      if (sentinelle) sentinelle.remove();
    }
  }
  window.chargerSuitePraticiens = chargerSuitePraticiens;

    var TAILLE_PAGE_PRAT = 30;
    S.ui._pratListe = liste;
    var nbInitial = Math.min(liste.length, Math.max(TAILLE_PAGE_PRAT, S.ui._pratAffiches || 0, (io >= 0 ? io + 1 : 0)));
    S.ui._pratAffiches = nbInitial;

    h += '<ul id="listePraticiens" class="liste">';
    for (var i = 0; i < nbInitial; i++) {
      h += cartePraticienHtml(liste[i], c, t, S.ui.contactOuvert === liste[i].code);
    }
    h += '</ul>';

    var reste = liste.length - nbInitial;
    if (reste > 0) {
      h += '<div id="sentinelleScrollRep" class="sentinelle-scroll" style="height:24px;margin:8px 0;"></div>' +
           '<div id="zonePlusPrat" class="rangee" style="margin:12px 0 24px"><button class="bouton bouton-large" type="button" data-a="plusPrat">Afficher plus (' + reste + ' restant' + (reste > 1 ? 's' : '') + ')</button></div>';
    }
    return h;
  };

  // Planning hebdomadaire d'un praticien (lieux x jours)
  // 3.26.73 : un même lieu saisi sur plusieurs lignes n'apparaît qu'une fois (jours réunis)
  function fusionnerLieux(l) {
    var out = [], par = {};
    (l || []).forEach(function (pr) {
      var k = normaliser(pr.lieu || '') + '|' + normaliser(pr.commune || '');
      if (!normaliser(pr.lieu || '') || !par[k]) {
        var c = Object.assign({}, pr); c._ids = {};
        JOURS_CLES.forEach(function (j, i) { var d = lireDispo(pr[j]); c._ids[i + '|Matin'] = d.matin ? pr.id : null; c._ids[i + '|Soir'] = d.soir ? pr.id : null; });
        out.push(c); if (normaliser(pr.lieu || '')) par[k] = c; return;
      }
      var m = par[k];
      JOURS_CLES.forEach(function (j, i) {
        var a1 = lireDispo(m[j]), b1 = lireDispo(pr[j]);
        if (b1.matin && !a1.matin) m._ids[i + '|Matin'] = pr.id;
        if (b1.soir && !a1.soir) m._ids[i + '|Soir'] = pr.id;
        m[j] = ecrireDispo({ matin: a1.matin || b1.matin, soir: a1.soir || b1.soir });
      });
      if (!aCoord(m) && aCoord(pr)) { m.lat = pr.lat; m.lon = pr.lon; }
      if (!m.reperes && pr.reperes) m.reperes = pr.reperes;
    });
    return out;
  }
  // 3.27.6 : une seule semaine pour tous les lieux (couleur du lieu), légende dessous ; prochaine présence en tête
  function prochainePresence(p) {
    var crs = (ctx().parCode[p.code] || []).slice().sort(function (x, y) { return x.debut - y.debut; });
    if (!crs.length) return null;
    var t = aujourdhui(), now = minutesMaintenant();
    for (var k = 0; k < 28; k++) {
      var d = ajouterJours(t, k), j = jourSemaineIndex(d);
      if (j > 4 || estFerie(d) || absentLe(p, d)) continue;
      for (var n = 0; n < crs.length; n++) { var c = crs[n]; if (c.jourIdx === j && (k > 0 || now <= c.fin)) return { d: d, c: c }; }
    }
    return null;
  }
  // 3.27.23 : prochaines présences (aujourd'hui jusqu'à la fermeture incluse, puis les jours suivants), pour choisir la date
  function prochainesPresences(p, max) {
    var crs = (ctx().parCode[p.code] || []).slice().sort(function (x, y) { return x.debut - y.debut; }), res = [];
    var t = aujourdhui(), now = minutesMaintenant();
    for (var k = 0; k < 21 && res.length < max; k++) {
      var d = ajouterJours(t, k), j = jourSemaineIndex(d);
      if (j > 4 || estFerie(d) || absentLe(p, d)) continue;
      crs.forEach(function (c) { if (res.length < max && c.jourIdx === j && (k > 0 || now <= c.fin)) res.push({ d: d, c: c }); });
    }
    return res;
  }
  // conflits d'une date : déjà prévu, prévu par un collègue, autre lieu dans votre tournée sur ce créneau
  function conflitsPlanif(c, d) {
    var l = [];
    if (S.plan.some(function (a) { return a.date === d && a.code === c.code; })) return { bloque: true, l: ['déjà dans votre tournée'] };
    arretsCollegues().filter(function (x) { return x.code === c.code && x.date === d; }).forEach(function (x) { l.push('prévu par ' + x.delegue); });
    var ailleurs = S.plan.filter(function (a) { return a.date === d && a.creneau === c.creneau && a.lieu && !memeEtablissement(a.lieu, c.lieu); });
    if (ailleurs.length) l.push(ailleurs.length + ' visite' + (ailleurs.length > 1 ? 's' : '') + ' ailleurs ce ' + c.creneau.toLowerCase() + ' (' + abregerHopital(ailleurs[0].lieu) + ')');
    return { bloque: false, l: l };
  }
  function prochainePresenceHtml(p) {
    var x = prochainePresence(p); if (!x) return '';
    var t = aujourdhui(), d = x.d, c = x.c, quand = d === t ? 'Aujourd\'hui' : (d === ajouterJours(t, 1) ? 'Demain' : JOURS[jourSemaineIndex(d)] + ' ' + (+d.slice(8)));
    var abs = p.absentDu && p.absentDu <= t && (!p.absentAu || p.absentAu >= t) ? 'Absent' + (p.absentAu ? ' jusqu\'au ' + dateCourte(p.absentAu) : '') + ' · ' : '';
    var mois = new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short' });
    return '<div class="proch-pres"><span class="pp-d"><small>' + JOURS[jourSemaineIndex(d)].slice(0, 3) + '</small><b>' + (+d.slice(8)) + '</b><small>' + esc(mois) + '</small></span>' +
      '<p><b>' + esc(quand) + ', ' + c.creneau.toLowerCase() + (estPharmacie(p) ? '' : ' à ' + esc(abregerHopital(c.lieu))) + '</b>' + esc(abs) + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '</p>' +
      '<button type="button" class="bouton bouton-plein petit" data-a="planifierProchaines" data-v="' + esc(p.code) + '">Planifier</button></div>';
  }
  // 3.27.16 : couleur fixe par établissement (ordre de la base, identique chez tous les délégués) : 1 vert, 2 bleu, puis 8 autres
  var COULEURS_GRILLE = ['#1B7448', '#1E5AA8', '#6A3FA0', '#B4580A', '#B03A7A', '#0A6C74', '#7A5230', '#3B4BA8', '#5E6B1F', '#4A5A66'];
  function grillePresences(code) {
    var c = ctx(), p = praticien(code) || {}, estPh = p.type === 'Pharmacie', lieux = fusionnerLieux(c.presencesParCode[code] || []);
    var rangBase = new Map(); lieux.forEach(function (pr, i) { rangBase.set(pr, i); });   // couleur selon l'ordre de la base, pas selon le tri
    // 3.26.63 : avec un filtre de communes, le lieu de la commune choisie apparaît en premier
    var coG = ensemble(S.ui.filtres && S.ui.filtres.communes || []);
    if (Object.keys(coG).length) lieux = lieux.slice().sort(function (x, y) { return (communeCorrespondante(y, coG) ? 1 : 0) - (communeCorrespondante(x, coG) ? 1 : 0); });
    var couleurLieu = function (pr) { return COULEURS_GRILLE[(rangBase.get(pr) || 0) % COULEURS_GRILLE.length]; };
    if (!lieux.length) {
      return '<div class="bloc-presences" style="margin:8px 0;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
        '<p class="discret" style="margin:0 0 6px;text-align:center">Aucune présence ou horaire renseigné.</p>' +
        '<button class="bouton petit" type="button" data-a="modifierPlanning" data-v="' + esc(code) + '" style="margin:0 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px">' +
        icone('crayon') + (estPh ? ' Renseigner les horaires' : ' Renseigner le planning') + '</button></div>';
    }
    var hor = function (pr) { var hM = lireHoraire(pr.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      return 'Matin ' + minutesVersHeure(hM[0]) + '-' + minutesVersHeure(hM[1]) + ', soir ' + minutesVersHeure(hS[0]) + '-' + minutesVersHeure(hS[1]); };
    var jAuj = jourSemaineIndex(aujourdhui());
    var h = '<div class="sem-rep"><div class="sr-tete"><div><b>' + (estPh ? 'Reçoit les délégués' : 'Semaine type') + '</b><small>' + (estPh ? esc(hor(lieux[0])) : 'Touchez un créneau pour planifier') + '</small></div>' +
      '</div>' +
      '<div class="sr-grille"><span></span>' + JOURS.map(function (j, i) { return '<span class="sr-j' + (i === jAuj ? ' auj' : '') + '">' + j.slice(0, 3) + '</span>'; }).join('');
    [['Matin', 'M', 'matin'], ['Soir', 'S', 'soir']].forEach(function (cr) {
      h += '<span class="sr-ms">' + cr[1] + '</span>';
      JOURS_CLES.forEach(function (j, i) {
        var la = [];
        lieux.forEach(function (pr, idx) { if (lireDispo(pr[j])[cr[2]]) la.push({ pr: pr, idx: idx }); });
        if (!la.length) { h += '<span class="sr-c"></span>'; return; }
        h += '<span class="sr-cel">' + la.map(function (x) {
          var cle = ((x.pr._ids && x.pr._ids[i + '|' + cr[0]]) || x.pr.id) + '|' + i + '|' + cr[0];
          return '<button type="button" class="sr-c on" style="--k:' + couleurLieu(x.pr) + '" data-a="planifierCle" data-v="' + esc(cle) + '" title="Planifier ' + JOURS[i] + ' ' + cr[0].toLowerCase() + ', ' + esc(abregerHopital(x.pr.lieu || p.nom)) + '">' + cr[1] + '</button>';
        }).join('') + '</span>';
      });
    });
    h += '</div><ul class="sr-lieux">' + lieux.map(function (pr, idx) {
      var quartierNet = String(pr.quartier || '').replace(/\bBoulevard\b/gi, 'Blvd.');
      var adr = [quartierNet, pr.commune].filter(Boolean).join(', ') + (pr.reperes ? ' · ' + pr.reperes : '');
      return '<li>' + (estPh ? '' : '<span class="sr-pt" style="background:' + couleurLieu(pr) + '"></span>') + '<div>' +
        (estPh ? '' : '<b class="lieu-nom-plein">' + esc(abregerHopital(pr.lieu || 'Établissement')) + '</b>') +
        (adr ? '<small>' + esc(adr) + '</small>' : '') + (estPh ? '' : '<small>' + esc(hor(pr)) + '</small>') + '</div></li>';
    }).join('') + '</ul></div>' +
      '<div class="pres-actions">' +
        '<button type="button" class="bouton petit bouton-planning" data-a="modifierPlanning" data-v="' + esc(code) + '">' +
        icone('crayon') + (estPh ? ' Modifier les horaires' : ' Modifier le planning hebdomadaire') + '</button>' +
      '</div>';
    return h;
  }

  // ------------------------------------------------------------------ Vue : statistiques
  // 3.21.0 : un seul filtre « Qui / Quand » pour le Bilan (tableau de bord et historique) et l'Équipe :
  // moi, toute l'équipe ou plusieurs délégués choisis ; jour, semaine, mois ou période, avec ‹ › pour avancer ou reculer
  var FEUILLES = {};   // feuilles (fenêtres) : déclarées ici car certaines sont définies plus haut que leur section
  FEUILLES.rappels = feuilleRappels;
  S.ui.fq = LS.get('filtreQui', { qui: 'moi', liste: [] });
  function nomsDelegues() {
    var n = {}; ((S.data && S.data.delegues) || []).forEach(function (x) { n[x] = true; });
    ((S.data && S.data.plannings) || []).concat((S.data && S.data.historique) || []).forEach(function (x) { if (x.delegue) n[String(x.delegue).trim()] = true; });
    if (moi()) n[moi()] = true;
    return Object.keys(n).filter(Boolean).sort(function (a, b) { return estMoi(a) ? -1 : estMoi(b) ? 1 : a.localeCompare(b, 'fr'); });
  }
  function quiCorrespond(nom) {
    var f = S.ui.fq;
    if (f.qui === 'tous') return true;
    if (f.qui === 'liste') return f.liste.some(function (x) { return nom ? String(nom).trim().toLowerCase() === x.toLowerCase() : estMoi(x); });
    return !nom || estMoi(nom);
  }
  function formatQui() {
    var f = S.ui.fq;
    if (f.qui === 'tous') return { plein: 'Toute l\'équipe', court: 'Équipe' };
    if (f.qui === 'liste') {
      var t = f.liste.length > 2 ? f.liste.length + ' délégués' : f.liste.map(function (x) { return estMoi(x) ? 'Moi' : x.split(' ')[0]; }).join(', ');
      return { plein: t, court: t };
    }
    return { plein: 'Moi', court: 'Moi' };
  }
  function libelleQui() {
    return formatQui().plein;
  }
  function formatQuand(onglet) {
    var MOIS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    if (onglet === 'equipe') {
      if (S.ui.eqPortee === 'jour') {
        var d = S.ui.eqDate || aujourdhui();
        return { plein: majuscule(dateCourte(d)), court: majuscule(dateCourte(d)) };
      }
      var l = lundiDe(S.ui.eqDate || aujourdhui());
      return { plein: 'Semaine du ' + dateCourte(l), court: 'Sem. ' + dateCourte(l) };
    }
    var b = bornesStats(), st = S.ui.stats;
    if (b[0] === b[1]) {
      var d = majuscule(dateCourte(b[0]));
      return { plein: d, court: d };
    }
    if (st.periode === 'semaine') {
      return { plein: 'Semaine du ' + dateCourte(b[0]), court: 'Sem. ' + dateCourte(b[0]) };
    }
    if (st.periode === 'mois') {
      var mIdx = +b[0].slice(5, 7) - 1, annee = b[0].slice(0, 4);
      var mLong = majuscule(MOIS[mIdx]) + ' ' + annee;
      var mCourt = MOIS_COURTS[mIdx] + ' ' + annee;
      return { plein: mLong, court: mCourt };
    }
    return { plein: 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1]), court: dateCourte(b[0]) + ' - ' + dateCourte(b[1]) };
  }
  function libelleBornes(b) {
    var st = S.ui.stats;
    if (b[0] === b[1]) return majuscule(dateCourte(b[0]));
    if (st.periode === 'semaine') return 'Semaine du ' + dateCourte(b[0]);
    if (st.periode === 'mois') return majuscule(MOIS[+b[0].slice(5, 7) - 1]) + ' ' + b[0].slice(0, 4);
    return 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1]);
  }
  function barreQuiQuand(onglet) {
    var quiObj = formatQui();
    var qObj = formatQuand(onglet);
    var nav = onglet === 'equipe' || S.ui.stats.periode !== 'perso';
    return '<div class="barre-qq">' +
      (S.config.demo ? '' : '<button type="button" class="puce-filtre" data-a="quiOuvrir">' + icone('equipe') + '<span><span class="txt-plein">' + esc(quiObj.plein) + '</span><span class="txt-court">' + esc(quiObj.court) + '</span></span><b>▾</b></button>') +
      '<div class="qq-quand">' + (nav ? '<button type="button" class="bouton-icone sombre" data-a="quandDecaler" data-o="' + onglet + '" data-v="-1" aria-label="Période précédente">' + icone('chevron') + '</button>' : '') +
      '<button type="button" class="puce-filtre" data-a="quandOuvrir" data-o="' + onglet + '">' + icone('calendrier') + '<span><span class="txt-plein">' + esc(qObj.plein) + '</span><span class="txt-court">' + esc(qObj.court) + '</span></span><b>▾</b></button>' +
      (nav ? '<button type="button" class="bouton-icone sombre suivant" data-a="quandDecaler" data-o="' + onglet + '" data-v="1" aria-label="Période suivante">' + icone('chevron') + '</button>' : '') + '</div></div>';
  }
  FEUILLES.calendrierJour = function (f) {
    var curMois = f.mois || f.date.slice(0, 7), t = aujourdhui();
    var parts = curMois.split('-'), y = +parts[0], m = +parts[1];
    var nomMois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][m - 1];
    var rDemain = ajouterJours(t, 1), rSem = ajouterJours(t, 7), r2Sem = ajouterJours(t, 14);
    var raccourcis = '<div class="cal-raccourcis">' +
      '<button type="button" class="puce' + (f.date === t ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + t + '">Aujourd\'hui</button>' +
      '<button type="button" class="puce' + (f.date === rDemain ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + rDemain + '">Demain</button>' +
      '<button type="button" class="puce' + (f.date === rSem ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + rSem + '">+7 jours</button>' +
      '<button type="button" class="puce' + (f.date === r2Sem ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + r2Sem + '">+14 jours</button>' +
      '</div>';
    var chevronG = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var chevronD = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var barreMois = '<div class="cal-barre-mois">' +
      '<div class="cal-titre-mois"><b>' + nomMois + '</b><span class="cal-an-badge">' + y + '</span></div>' +
      '<div class="cal-navs">' +
        '<button type="button" class="cal-nav-btn" data-a="calChangerMois" data-v="-1" aria-label="Mois précédent">' + chevronG + '</button>' +
        '<button type="button" class="cal-nav-btn" data-a="calChangerMois" data-v="1" aria-label="Mois suivant">' + chevronD + '</button>' +
      '</div>' +
      '</div>';
    var entetes = '<div class="cal-grille-semaine">' +
      ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(function (j) { return '<span>' + j + '</span>'; }).join('') +
      '</div>';
    var premierJour = new Date(y, m - 1, 1);
    var dec = (premierJour.getDay() + 6) % 7;
    var nbJoursMois = new Date(y, m, 0).getDate();
    var nbJoursPrec = new Date(y, m - 1, 0).getDate();
    var cellules = [];
    for (var i = dec - 1; i >= 0; i--) {
      var jPrec = nbJoursPrec - i, mPrec = m === 1 ? 12 : m - 1, yPrec = m === 1 ? y - 1 : y;
      cellules.push({ num: jPrec, iso: yPrec + '-' + pad2(mPrec) + '-' + pad2(jPrec), horsMois: true });
    }
    for (var j = 1; j <= nbJoursMois; j++) {
      cellules.push({ num: j, iso: y + '-' + pad2(m) + '-' + pad2(j), horsMois: false });
    }
    // Strictement 42 cases (6 semaines complètes) : hauteur 100% stable sans aucun saut
    var reste = 42 - cellules.length;
    for (var k = 1; k <= reste; k++) {
      var mSuiv = m === 12 ? 1 : m + 1, ySuiv = m === 12 ? y + 1 : y;
      cellules.push({ num: k, iso: ySuiv + '-' + pad2(mSuiv) + '-' + pad2(k), horsMois: true });
    }
    var grille = '<div class="cal-grille-jours">' + cellules.map(function (c) {
      var nVisites = nbVisitesJour(c.iso), estAuj = c.iso === t, estChoisi = c.iso === f.date;
      var classes = ['cal-jour-btn'];
      if (c.horsMois) classes.push('hors-mois');
      if (estAuj) classes.push('aujourdhui');
      if (estChoisi) classes.push('choisi');
      if (nVisites > 0) classes.push('avec-visites');
      return '<button type="button" class="' + classes.join(' ') + '" data-a="calChoisirJour" data-v="' + c.iso + '">' +
        '<span>' + c.num + '</span>' +
        (nVisites > 0 ? '<span class="cal-point-visite"></span>' : '') +
        '</button>';
    }).join('') + '</div>';
    return '<div class="cal-boite">' + raccourcis + barreMois + entetes + grille + '</div>';
  };
  FEUILLES.qui = function (f) {
    var noms = nomsDelegues(), tousChoisis = noms.length > 0 && noms.every(function (n) { return f.liste.indexOf(n) >= 0; });
    return '<div class="segment" role="group" aria-label="Qui" style="margin-top:0">' + [['moi', 'Moi'], ['tous', 'Toute l\'équipe'], ['liste', 'Choisir']].map(function (x) {
        return '<button type="button" data-a="quiMode" data-v="' + x[0] + '" aria-pressed="' + (f.qui === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      (f.qui === 'liste' ? '<p class="discret" style="margin:4px 0 8px">Touchez les délégués à réunir dans le bilan.</p><div class="puces">' +
        (noms.length > 1 ? '<button type="button" class="puce puce-tous" data-a="quiTous" aria-pressed="' + tousChoisis + '">Tous</button>' : '') +
        noms.map(function (n) {
          return '<button type="button" class="puce" data-a="quiToggle" data-v="' + esc(n) + '" aria-pressed="' + (f.liste.indexOf(n) >= 0) + '">' + esc(n) + (estMoi(n) ? ' (moi)' : '') + '</button>';
        }).join('') + '</div>' : '') +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="quiAppliquer" style="margin-top:14px">Appliquer</button>';
  };
  FEUILLES.quand = function (f) {
    var opts = f.onglet === 'equipe' ? [['jour', 'Jour'], ['semaine', 'Semaine']] : [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['perso', 'Période']];
    return '<div class="segment" role="group" aria-label="Période" style="margin-top:0">' + opts.map(function (x) {
        return '<button type="button" data-a="quandMode" data-v="' + x[0] + '" aria-pressed="' + (f.periode === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      (f.periode === 'perso' ? '<div class="grille-2"><label class="champ"><span>Du</span><input type="date" id="quandDebut" value="' + esc(f.debut) + '"></label>' +
        '<label class="champ"><span>Au</span><input type="date" id="quandFin" value="' + esc(f.fin) + '"></label></div>' :
        '<label class="champ"><span>' + (f.periode === 'mois' ? 'Un jour du mois' : f.periode === 'semaine' ? 'Un jour de la semaine' : 'Date') + '</span><input type="date" id="quandRef" value="' + esc(f.ref) + '"></label>') +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="quandAppliquer">Appliquer</button>';
  };
  function bornesStats() {
    var st = S.ui.stats, t = st.ref || aujourdhui();
    if (st.periode === 'jour') return [t, t];
    if (st.periode === 'semaine') { var l = lundiDe(t); return [l, ajouterJours(l, 6)]; }
    if (st.periode === 'mois') { var d = t.slice(0, 8) + '01'; return [d, ajouterJours(ajouterJours(d, 32).slice(0, 8) + '01', -1)]; }
    var a = st.debut || ajouterJours(t, -29), b = st.fin || t;
    return a <= b ? [a, b] : [b, a];
  }
  function joursEntre(a, b) { var l = []; for (var d = a; d <= b && l.length < 400; d = ajouterJours(d, 1)) l.push(d); return l; }
  // Comptes rendus connus (envoyés et en attente), sans doublon
  function visitesConnues() {
    var vus = {}, l = [];
    S.queue.concat((S.data && S.data.historique) || []).forEach(function (v) {
      if (v.uid) { if (vus[v.uid]) return; vus[v.uid] = true; }
      l.push(v);
    });
    return l;
  }
  // Visites planifiées : ma tournée en cours + tournées publiées (les miennes ou celles de toute l'équipe)
  function arretsPlanifies(equipe) {
    var vus = {}, l = [];
    S.plan.forEach(function (a) {
      vus[a.uid] = true;
      l.push({ date: a.date, code: a.code, commune: a.commune, specialite: a.specialite, statut: a.statut, etat: a.etat, delegue: moi() || 'Moi' });
    });
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (vus[p.uid] || (!equipe && !estMoi(p.delegue))) return;
      vus[p.uid] = true; l.push(p);
    });
    return l;
  }
  function calculerStats() {
    var st = S.ui.stats, eq = S.ui.fq.qui !== 'moi' && !S.config.demo, b = bornesStats(), t = aujourdhui();
    var dans = function (d) { return d && d >= b[0] && d <= b[1]; };
    var visites = visitesConnues().filter(function (v) { return dans(String(v.date).slice(0, 10)) && (S.config.demo || quiCorrespond(v.delegue)); });
    var effectives = visites.filter(function (v) { return Moteur.estVisite(v.statut, statuts()); });
    var plan = arretsPlanifies(eq).filter(function (a) { return dans(a.date) && (S.config.demo || quiCorrespond(a.delegue)); });
    var echus = plan.filter(function (a) { return a.date <= t; });
    var faits = echus.filter(function (a) { return a.etat === 'valide' && Moteur.estVisite(a.statut, statuts()); });
    var delegues = {};
    if (eq) { plan.forEach(function (a) { if (a.delegue) delegues[a.delegue] = true; }); visites.forEach(function (v) { if (v.delegue) delegues[v.delegue] = true; }); }
    var nbDel = eq ? Math.max(1, Object.keys(delegues).length) : 1;
    var ouvres = joursEntre(b[0], b[1]).filter(function (d) { return jourSemaineIndex(d) < 5; }).length;
    var objectif = Math.round((+st.objectif || 0) / 5 * ouvres * nbDel);
    var prat = ctx().prat, nA = 0, nAok = 0;
    var filtre = !eq ? filtreCibles() : null;
    Object.keys(prat).forEach(function (k) {
      var p = prat[k]; if (p.note !== 3) return;
      if (filtre && !filtre(p)) return;
      nA++; if (joursEcoules(p.derniere, t) <= REGLAGES_MOTEUR.cadence[3]) nAok++;
    });
    return { bornes: b, equipe: eq, visites: visites, effectives: effectives, plan: plan, echus: echus, faits: faits,
             nbDel: nbDel, delegues: Object.keys(delegues).sort(), ouvres: ouvres, objectif: objectif, nA: nA, nAok: nAok };
  }
  function taux(a, b) { return b ? Math.round(100 * a / b) : null; }
  function txt(n) { return n === null || n === undefined ? 'n.d.' : n + ' %'; }

  VUES.recherche = VUES.praticiens;
  VUES.contacts = VUES.praticiens;

  // 3.26.0 : Onglet Suivi unifié regroupant Bilan, Tournées Équipe et Audit Données/GPS
