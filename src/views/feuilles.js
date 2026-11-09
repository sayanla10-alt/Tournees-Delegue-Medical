  // ------------------------------------------------------------------ Feuilles (fenêtres du bas)
  function rendreFeuille() {
    var f = S.ui.feuille, el = $('feuille'); if (!el) return;
    if (!f) { el.hidden = true; el.innerHTML = ''; el.dataset.ouverte = ''; document.body.classList.remove('feuille-ouverte'); return; }
    el.hidden = false; document.body.classList.add('feuille-ouverte');
    var contenu = FEUILLES[f.type](f), pied = '', tete = '';
    if (typeof contenu === 'object') { pied = contenu.pied; tete = contenu.tete || ''; contenu = contenu.corps; }
    var sousType = f.type + (f.etape || '') + (f.cherche ? '|cherche' : '') + (f.choix ? '|choix' : '');
    var defil = el.querySelector('.feuille-corps'), haut = defil && el.dataset.type === sousType ? defil.scrollTop : 0;
    var nouvelle = !defil || el.dataset.ouverte !== f.type;
    el.dataset.type = sousType; el.dataset.ouverte = f.type;
    el.innerHTML = '<div class="voile" data-a="fermerFeuille"></div><div class="feuille' + (f.pleine ? ' pleine' : '') + (nouvelle ? ' anim' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(f.titre || '') + '">' +
      '<div class="poignee" aria-hidden="true"></div><div class="feuille-tete"><button type="button" class="retour-feuille" data-a="' + (f.retourAction || 'fermerFeuille') + '" aria-label="Retour">' + icone('chevron') + '</button><b>' + esc(f.titre || '') + '</b>' + tete + '</div>' +
      '<div class="feuille-corps">' + contenu + '</div>' + (pied ? '<div class="feuille-pied">' + pied + '</div>' : '') + '</div>';
    if (haut) el.querySelector('.feuille-corps').scrollTop = haut;
    // 3.25.49 : Bande des produits fluide : centrage doux du produit sélectionné sans saut ni boucle
    var bp = el.querySelector('.bande-produits'), sel = bp && bp.querySelector('.bp-produit[aria-pressed="true"]');
    if (sel) {
      setTimeout(function () {
        var cible = sel.offsetLeft - (bp.clientWidth - sel.offsetWidth) / 2;
        if (nouvelle) {
          bp.scrollLeft = Math.max(0, cible);
        } else {
          bp.scrollTo({ left: Math.max(0, cible), behavior: 'smooth' });
        }
      }, 40);
    }
    initGlisseHorizontale();
    // 3.25.42 : Gestuelle swipe-down sur poignée/en-tête pour fermer au pouce
    var fEl = el.querySelector('.feuille');
    var poigneeEl = el.querySelector('.poignee');
    var teteEl = el.querySelector('.feuille-tete');
    if (fEl && (poigneeEl || teteEl)) {
      var yDep = 0, glisseY = 0, enGlisseFeuille = false;
      function debutGlisseF(e) {
        if (e.target.closest('button')) return;
        var pt = e.touches ? e.touches[0] : e;
        yDep = pt.clientY;
        glisseY = 0;
        enGlisseFeuille = true;
        fEl.classList.add('en-glisse-bas');
      }
      function bougeGlisseF(e) {
        if (!enGlisseFeuille) return;
        var pt = e.touches ? e.touches[0] : e;
        var dy = pt.clientY - yDep;
        if (dy > 0) {
          glisseY = dy;
          fEl.style.transform = 'translateY(' + dy + 'px)';
          if (e.cancelable) e.preventDefault();
        }
      }
      function finGlisseF() {
        if (!enGlisseFeuille) return;
        enGlisseFeuille = false;
        fEl.classList.remove('en-glisse-bas');
        if (glisseY > 75) {
          fEl.style.transform = '';
          ACTIONS.fermerFeuille();
        } else {
          fEl.style.transition = 'transform .2s ease';
          fEl.style.transform = 'translateY(0)';
          setTimeout(function () { if (fEl) fEl.style.transition = ''; }, 200);
        }
      }
      if (poigneeEl) {
        poigneeEl.addEventListener('touchstart', debutGlisseF, { passive: true });
        poigneeEl.addEventListener('touchmove', bougeGlisseF, { passive: false });
        poigneeEl.addEventListener('touchend', finGlisseF, { passive: true });
      }
      if (teteEl) {
        teteEl.addEventListener('touchstart', debutGlisseF, { passive: true });
        teteEl.addEventListener('touchmove', bougeGlisseF, { passive: false });
        teteEl.addEventListener('touchend', finGlisseF, { passive: true });
      }
    }
    gererHistoriqueModal(true);
  }
  // fiche d'un produit : l'essentiel ouvert (indications, contre-indications, arguments), le reste à déplier
  FEUILLES.ficheProduit = function (fe) {
    var f = fichesProduits().filter(function (x) { return x.produit === fe.produit; })[0]; if (!f) return '';
    var ouvertes = fe.ouvertes || {};
    var h = '<p class="fp-dci"><b>' + esc(f.dci) + '</b></p><p class="fiche-classe" style="margin-top:2px">' + esc(f.classe || '') + '</p>';
    SECTIONS_FICHE.forEach(function (sec) {
      var it = lignesFiche(f[sec[0]]);
      // 3.25.45 : Arguments clés — ajout en 1er point de la mention Prix indicatif (FCFA) et prise en charge CNAM / MUGEF-CI
      if (sec[0] === 'arguments') {
        var tarifStr = f.prix ? f.prix + ' FCFA' : (f.tarif || 'Tarif indicatif conventionné (FCFA)');
        var cnamStr = f.cnam || 'remboursable CNAM (70%)';
        var mugefStr = f.mugef || 'prise en charge MUGEF-CI';
        var ligneCI = 'Prix indicatif (' + tarifStr + ') et prise en charge ' + cnamStr + ' / ' + mugefStr;
        if (!it.some(function (x) { return x.indexOf('CNAM') >= 0 || x.indexOf('MUGEF') >= 0; })) {
          it = [ligneCI].concat(it);
        }
      }
      if (!it.length) return;
      var essentiel = sec[2] === 'ind' || sec[2] === 'ci' || sec[2] === 'arg', ouvert = essentiel || ouvertes[sec[0]];
      h += '<div class="fiche-section ' + sec[2] + (essentiel ? '' : ' repliable') + '">' +
        (essentiel ? '<h4>' + sec[1] + '</h4>' : '<button type="button" class="fp-bascule" data-a="ficheSection" data-v="' + sec[0] + '" aria-expanded="' + !!ouvert + '"><h4>' + sec[1] + '</h4>' + icone('chevron') + '</button>') +
        (ouvert ? '<ul>' + it.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    });
    h += '<p class="discret fiche-pied">' + esc(f.laboratoire || '') + (f.sources ? ' · Sources : ' + esc(f.sources) : '') + '</p>';
    // 3.24.15 : en bas, tous les produits de la liste (même ordre que l'onglet), à faire glisser comme les dates de Journée ;
    // le produit affiché est au centre, en couleur ; on ferme avec la croix en haut
    var ordre = [];
    gammesProduits(fichesProduits()).forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '');
      g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).forEach(function (x) { ordre.push(x.produit); });
    });
    // 3.25.49 : Bande des produits fluide au pouce (liste directe, sans saut ni duplication en boucle)
    var pied = '<div class="bande-produits" role="group" aria-label="Produits">' +
      ordre.map(function (n) {
        return '<button type="button" class="bp-produit" data-a="produitOuvrir" data-v="' + esc(n) + '" aria-pressed="' + (n === f.produit) + '">' + esc(n) + '</button>';
      }).join('') + '</div>';
    return { corps: h, pied: pied };
  };


  FEUILLES.communes = function (f) {
    var h = groupeChoix(f, { id: 'communes', titre: 'Communes & Secteurs', chemin: 'sel', multiple: true, sections: sectionsCommunes(), recherche: true, accordeon: 'communes',
      aide: f.cle === 'tout' ? 'Sélectionnez des communes entières ou des sous-secteurs précis (Abobo, Cocody, Yopougon). Aucune sélection = toutes les communes.' : 'Aucune sélection = les communes choisies pour la semaine.' });
    return { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="communesToutes">Toutes</button><button class="bouton btn-secondaire" type="button" data-a="communesAucune">Effacer</button>' +
      '<button class="bouton bouton-plein btn-valider" type="button" data-a="communesOk">' + (f.sel.length ? 'Valider (' + f.sel.length + ')' : 'Valider toutes') + '</button>' };
  };

  FEUILLES.recherche = function (f) {
    var c = ctx(), q = normaliser(f.q || ''), h = '';
    if (!f.code) {
      h += '<div class="recherche">' + icone('loupe') + '<input type="search" id="rechercheImpose" data-f="rechercheImpose" placeholder="Nom, spécialité, lieu…" value="' + esc(f.q || '') + '" autofocus></div>';
      if (q.length < 2) return h + '<p class="discret">Tapez au moins 2 lettres.</p>';
      var res = Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
        var lieux = (c.presencesParCode[p.code] || []).map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
        return normaliser(p.nom + ' ' + p.specialite + ' ' + lieux).indexOf(q) >= 0;
      }).slice(0, 30);
      if (!res.length) return h + '<p class="discret">Aucun praticien trouvé.</p>';
      return h + '<ul class="liste">' + res.map(function (p) {
        return '<li><button type="button" class="element carte-bouton" data-a="choisirImpose" data-v="' + esc(p.code) + '">' +
          '<span class="element-titre">' + lienFiche(p.code, esc(p.nom)) + ' ' + etoiles(p.note) + '</span><span class="discret bloc-texte">' + esc(abrSpec(p.specialite)) + ', ' +
          esc(Array.from(new Set((c.presencesParCode[p.code] || []).map(function (x) { return x.commune; }))).join(', ')) + '</span></button></li>';
      }).join('') + '</ul>';
    }
    var p = c.prat[f.code], dates = datesPeriode(), tAuj = aujourdhui();
    var options = [];
    dates.forEach(function (d) {
      var j = jourSemaineIndex(d);
      (c.parCode[f.code] || []).forEach(function (cr) { if (cr.jourIdx === j) options.push({ d: d, c: cr }); });
    });
    var defAuj = f.cle === '__aujourdhui' || !f.cle;
    h += '<p>' + lienFiche(p.code, '<b>' + esc(p.nom) + '</b>') + ' ' + etoiles(p.note) + '<span class="discret bloc-texte">' + esc(abrSpec(p.specialite)) + '</span></p>';
    h += '<p class="discret">Quand planifier cette visite ?</p>';
    h += '<div class="choix-creneaux">' +
      '<label class="choix choix-aujourdhui"><input type="radio" name="impCle" value="__aujourdhui"' + (defAuj ? ' checked' : '') + '><span><b>Ajouter à aujourd\'hui (' + dateCourte(tAuj) + ')</b><small>Forcer dans la journée d\'aujourd\'hui, en dépit du programme</small></span></label>' +
      (options.length ? '<label class="choix"><input type="radio" name="impCle" value=""' + (!f.cle && !defAuj ? ' checked' : '') + '><span><b>Au meilleur moment</b><small>L\'application choisit le jour le plus pratique</small></span></label>' : '') +
      options.map(function (o) {
        var v = o.d + '|' + o.c.cle;
        return '<label class="choix"><input type="radio" name="impCle" value="' + esc(v) + '"' + (f.cle === v ? ' checked' : '') + '><span><b>' +
          majuscule(dateCourte(o.d)) + ', ' + o.c.creneau.toLowerCase() + ' ' + minutesVersHeure(o.c.debut) + '-' + minutesVersHeure(o.c.fin) + '</b><small>' +
          esc(o.c.lieu) + ', ' + esc(o.c.quartier) + '</small></span></label>';
      }).join('') + '</div>';
    if (!options.length) h += '<p class="discret">Aucune présence sur la période : vous pouvez néanmoins forcer l\'ajout à aujourd\'hui.</p>';
    h += '<label class="champ"><span>Heure de RDV (facultatif)</span><input type="time" id="impRdv" value="' + esc(f.rdv || '') + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="retourRecherche">Retour</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="ajouterImpose">Ajouter</button></div>';
    return h;
  };

  FEUILLES.exporter = function (f) {
    var t = aujourdhui(), confirmes = datesPlan().filter(function (d) { return d >= t && jourConfirme(d); });
    if (confirmes.length <= 1) f.portee = 'jour';
    var dates = f.portee === 'jour' ? [S.ui.jour] : confirmes;
    var texte = texteProgramme(dates);
    f.texte = texte;
    var num = normaliserNumero(S.config.whatsapp);
    var corps = (confirmes.length > 1 ? '<div class="segment" role="group" aria-label="Contenu"><button type="button" data-a="exportPortee" data-v="jour" aria-pressed="' + (f.portee === 'jour') + '">Ce jour (' + dateCourte(S.ui.jour) + ')</button>' +
      '<button type="button" data-a="exportPortee" data-v="semaine" aria-pressed="' + (f.portee !== 'jour') + '">Tous (' + confirmes.length + ')</button></div>' : '') +
      '<pre class="apercu">' + esc(texte) + '</pre>' +
      (texte.length > 3500 ? '<p class="discret">Message long : préférez l\'envoi jour par jour.</p>' : '') +
      '<div class="rangee" style="margin-top:8px"><button class="bouton petit" type="button" data-a="copierTexte">Copier</button>' +
      (navigator.share ? '<button class="bouton petit" type="button" data-a="partagerTexte">Partager…</button>' : '') + '</div>' +
      (num ? '<p class="discret" style="margin-bottom:0">Vers +' + esc(num) + '</p>' : '');
    return {
      corps: corps,
      pied: '<button class="bouton-texte sortir-question" type="button" data-a="retourExport">← Retour</button>' +
        '<button class="bouton" type="button" data-a="fermerFeuille">Fermer</button>' +
        '<button class="bouton bouton-plein wa" type="button" data-a="envoyerWhatsapp">' + icone('whatsapp') + 'Envoyer</button>'
    };
  };

  FEUILLES.contactFiche = function (f) {
    var p = praticien(f.code);
    if (!p) return '<p class="discret">Fiche introuvable.</p>';
    return '<ul class="liste fiche-contact">' + cartePraticienHtml(p, ctx(), aujourdhui(), true) + '</ul>';
  };
  FEUILLES.anciens = function (f) {
    if (f.source) {
      var sem = f.source.type === 'semaine', c = f.cible, existants = S.plan.filter(function (a) { return sem ? lundiDe(a.date) === lundiDe(c) : a.date === c; });
      var weekend = !sem && jourSemaineIndex(c) > 4;
      return { corps: '<p style="margin-top:0"><b>À reprendre :</b> ' + (sem ? 'semaine du ' + dateCourte(f.source.valeur) : majuscule(dateLongue(f.source.valeur))) + '.</p>' +
        '<label class="champ"><span>' + (sem ? 'Sur quelle semaine ? (choisissez un jour de la semaine)' : 'Sur quel jour ?') + '</span><input type="date" data-f="repriseCible" min="' + aujourdhui() + '" value="' + esc(c) + '"></label>' +
        '<p class="discret">' + (sem ? 'Semaine du ' + dateCourte(lundiDe(c)) + ' au ' + dateCourte(joursOuvres(lundiDe(c))[4]) + ', chaque jour sur le même jour de la semaine.' : majuscule(dateLongue(c)) + '.') + '</p>' +
        (weekend ? '<p class="discret" style="color:var(--rouge)">Choisissez un jour de semaine.</p>' : '') +
        (existants.length ? '<div class="bandeau"><p>' + existants.length + ' visite' + (existants.length > 1 ? 's' : '') + ' déjà prévue' + (existants.length > 1 ? 's' : '') +
          ' sur ' + (sem ? 'cette semaine' : 'ce jour') + ' seront remplacées (les comptes rendus enregistrés sont conservés). Vous pourrez revenir à l\'ancienne planification.</p></div>' : ''),
        pied: '<button class="bouton" type="button" data-a="repriseRetour">Retour</button>' +
          '<button class="bouton bouton-plein" type="button" data-a="repriseConfirmer"' + (weekend ? ' disabled' : '') + '>Reprendre</button>' };
    }
    var l = anciensProgrammes(), p = S.params;
    if (!l.length) return '<p class="discret" style="margin-top:0">Aucun ancien programme pour l\'instant. Vos tournées sont mémorisées au fil de l\'eau : elles apparaîtront ici dès la semaine prochaine (8 dernières semaines).</p>';
    var semCible = joursOuvres(lundiDe(p.dateRef))[0];
    var h = '<p class="discret" style="margin-top:0">Choisissez la semaine ou le jour à reprendre, puis le jour ou la semaine sur lesquels le copier. Il est copié en <b>brouillon</b> ; vous pourrez le conserver ou revenir à l\'ancienne planification.</p>';
    h += l.map(function (s2) {
      var jours = Object.keys(s2.jours).sort(), n = jours.reduce(function (t, d) { return t + s2.jours[d].length; }, 0);
      var com = []; jours.forEach(function (d) { s2.jours[d].forEach(function (x) { if (x.commune && com.indexOf(x.commune) < 0) com.push(x.commune); }); });
      return '<section class="bloc ancien"><div class="ancien-tete"><div><b>Semaine du ' + dateCourte(s2.lundi) + '</b><span class="discret bloc-texte">' + n + ' visite' + (n > 1 ? 's' : '') + ', ' + esc(libelleCommunes(com)) + '</span></div>' +
        '<button class="bouton petit bouton-plein" type="button" data-a="reprendre" data-t="semaine" data-v="' + s2.lundi + '">Reprendre la semaine</button></div>' +
        '<div class="puces">' + jours.map(function (d) {
          return '<button type="button" class="puce" data-a="reprendre" data-t="jour" data-v="' + d + '">' + majuscule(dateCourte(d)) + ' · ' + s2.jours[d].length + '</button>';
        }).join('') + '</div></section>';
    }).join('');
    return h + '<p class="discret">Touchez un jour pour ne reprendre que celui-ci.</p>';
  };

  FEUILLES.visitePlan = function (f) {
    var a = arret(f.uid);
    if (!a) return '<p class="discret">Visite introuvable.</p>';
    var sousTitre = estPharmacie(a) ? infosPharmaciePlan(a) : infosMedecinPlan(a);
    // 3.28.52 : visite déjà renseignée (faite ou non faite) : elle ne bouge plus dans la tournée ;
    // Changer de jour, Remplacer, Épingler et Retirer sont grisés, avec le motif ; Modifier la fiche et Voir dans Journée restent
    var st = vraiStatut(a.statut), ko = st && estKo(st), motif = st ? (ko ? 'Visite non faite : ' + String(statutLibelle(a)).toLowerCase() : 'Visite faite') : '';
    var hFaite = (a.valideA || a.heure || '').slice(0, 5);
    var tuile = function (action, ic, titre, sous, bloque) {
      return bloque ? '<button type="button" class="tuile tuile-grisee" disabled aria-disabled="true"><b>' + icone(ic) + titre + '</b><small>' + esc(motif) + '</small></button>'
        : '<button type="button" class="tuile" data-a="' + action + '" data-uid="' + a.uid + '"><b>' + icone(ic) + titre + '</b><small>' + sous + '</small></button>';
    };
    return '<div class="fiche-entete" style="margin-bottom:12px">' +
      '<span class="element-titre" style="font-size:1.15rem;display:flex;align-items:center;gap:6px">' + pastilleType(a) + lienFiche(a.code, nomPrat(a)) + ' ' + etoiles(a.note) + '</span>' +
      (sousTitre ? '<p class="discret" style="margin:4px 0 8px">' + specGras(a, sousTitre) + '</p>' : '') +
      '<p style="margin:0"><b>' + majuscule(dateLongue(a.date)) + '</b> · Passage vers <b>' + esc(a.heure || '--:--') + '</b> (' + esc(a.creneau || '') + ')</p>' +
      (st ? '<span class="etiquette ' + (ko ? 'p1' : 'ok') + '" style="margin-top:6px;display:inline-block">' + (ko ? 'Non faite : ' + esc(String(statutLibelle(a)).toLowerCase()) : 'Faite' + (hFaite ? ' à ' + esc(hFaite) : '')) + '</span>' : '') +
      '</div>' +
      '<div class="choix-ajout">' +
        tuile('planChangerJour', 'calendrier', 'Changer de jour', 'Déplacer vers un autre jour ouvré', !!st) +
        tuile('completerJour', 'relancer', 'Remplacer', 'Choisir un autre praticien pour ce créneau', !!st) +
        tuile('garderPlan', 'epingle', a.garde ? 'Ne plus garder' : 'Épingler / Garder', a.garde ? 'Actuellement protégé du recalcul' : 'Protéger cette visite du recalcul', !!st) +
        tuile('retirerPlan', 'fermer', 'Retirer', 'Enlever de la tournée du ' + dateCourte(a.date), !!st) +
        '<button type="button" class="tuile" data-a="modifierFiche" data-v="' + esc(a.code) + '"><b>' + icone('crayon') + 'Modifier</b><small>Modifier la fiche de ' + (estPharmacie(a) ? 'la pharmacie' : 'ce médecin') + '</small></button>' +
        '<button type="button" class="tuile" data-a="voirDansJournee" data-uid="' + a.uid + '"><b>' + icone('chevron') + 'Voir dans Journée</b><small>' + (st ? 'Consulter ou corriger le compte rendu' : 'Basculer vers la vue détaillée du jour') + '</small></button>' +
      '</div>';
  };

  function listeCandidatsRemplacementHtml(f, candidats, q) {
    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    var l = candidats;
    if (mots.length) {
      l = l.filter(function (x) {
        var p = x.cr.prat;
        var txt = normaliser([p.nom, p.specialite, x.cr.lieu, x.cr.quartier, x.cr.commune].join(' '));
        return mots.every(function (m) { return txt.indexOf(m) >= 0; });
      });
    }
    var a = arret(f.uid), phA = a && estPharmacie(a);
    if (!l.length) {
      return '<p class="discret" style="margin:12px 0">' + (mots.length ? 'Aucun ' + (phA ? 'établissement' : 'praticien') + ' ne correspond à « ' + esc(q) + ' ».' : 'Aucun' + (phA ? 'e autre pharmacie' : ' autre médecin') + ' disponible.') + '</p>';
    }
    return '<ul class="liste">' + l.map(function (x) {
      var p = x.cr.prat, ph = estPharmacie(p);
      return '<li><button type="button" class="element carte-bouton" data-a="remplacerChoisir" data-v="' + esc(x.cr.cle) + '" data-h="' + esc(x.heure) + '" data-dist="' + (x.dist !== undefined ? x.dist : '') + '" data-memelieu="' + (x.memeLieu ? '1' : '0') + '">' +
        '<span class="element-titre">' + pastilleType(p) + lienFiche(p.code, esc(p.nom)) + (ph ? '' : ' ' + etoiles(p.note)) + '</span>' +
        '<span class="discret bloc-texte">' + esc(ph ? lieuPharmacieListe(p, x.cr) : infosSansDoublon(p, [p.specialite, x.cr.lieu, x.cr.quartier])) + '</span>' +
        '<span class="discret bloc-texte">' + x.cr.creneau + ' ' + minutesVersHeure(x.cr.debut) + '-' + minutesVersHeure(x.cr.fin) + ' · passage vers ' + esc(x.heure) +
          (x.dist < 99 ? ' · ' + km(x.dist) + ' du lieu remplacé' : '') + '</span>' +
        '<span class="etiquettes">' + (x.memeLieu ? '<span class="etiquette ok">Même établissement</span>' : '') + (ph ? '' : badgeConv(p.conventionne)) + '<span class="etiquette">' + esc(vuDepuis(p.derniere, (a ? a.date : ''))) + '</span>' +
          (x.ok ? '' : '<span class="etiquette alerte">Horaire difficile à tenir</span>') + '</span></button></li>';
    }).join('') + '</ul>';
  }

  // 3.26.46 : Refonte visuelle de l'écran de confirmation de remplacement en cartes comparatives hiérarchisées
  function renduConfirmationRemplacement(f, a, x) {
    var phA = estPharmacie(a);
    var cr = Moteur.creneauParCle(ctx(), x.cle);
    var p = cr ? cr.prat : null;
    var phN = p ? estPharmacie(p) : phA;

    // 1. Visite initiale à remplacer
    var lieuInit = abregerHopital(a.lieu || lieuAffiche(a) || '');
    var secInit = nomSecteur(a.quartier, a.commune, a.coord);
    var specInit = (!phA && a.specialite) ? abrSpec(a.specialite) : '';
    var statutInit = statutLibelle(a) || (a.etat === 'brouillon' ? 'Brouillon' : 'Planifiée');
    var heureInit = a.heure || '--:--';

    var pObjInit = (typeof praticien === 'function' && praticien(a.code)) || {};
    var lieuMatchInit = (pObjInit.lieux || []).filter(function (l) { return l.lieu === a.lieu; })[0] || (pObjInit.lieux && pObjInit.lieux[0]) || {};
    var repereInit = String(lieuMatchInit.adresse || lieuMatchInit.repere || pObjInit.adresse || pObjInit.repere || '').replace(/\bBoulevard\b/gi, 'Blvd.').trim();

    // 2. Nouveau praticien proposé
    var nomN = p ? p.nom : x.nom;
    var noteN = p ? p.note : x.note;
    var specN = (p && !phN && p.specialite) ? abrSpec(p.specialite) : '';
    var convN = (p && !phN) ? p.conventionne : '';
    var lieuN = abregerHopital((cr && cr.lieu) || x.lieu || '');
    var secN = cr ? nomSecteur(cr.quartier, cr.commune, cr.coord) : (x.quartier || '');
    var lieuMatchN = (p && p.lieux || []).filter(function (l) { return l.lieu === (cr && cr.lieu); })[0] || (p && p.lieux && p.lieux[0]) || {};
    var repereN = String(lieuMatchN.adresse || lieuMatchN.repere || (p && (p.adresse || p.repere)) || '').replace(/\bBoulevard\b/gi, 'Blvd.').trim();
    var distN = (x.dist !== null && x.dist !== undefined && x.dist < 99) ? x.dist : null;
    var memeLieu = !!x.memeLieu || (cr && memeEtablissement(a.lieu || '', cr.lieu || ''));
    var heureN = x.heure || '--:--';
    var creneauN = cr ? cr.creneau : '';
    var horaireN = (cr && cr.debut && cr.fin) ? (minutesVersHeure(cr.debut) + '-' + minutesVersHeure(cr.fin)) : '';

    var h = '<div class="rc-comparatif">';

    // CARTE 1 : VISITE INITIALE
    h += '<div class="rc-carte rc-carte-initiale">';
    h += '  <div class="rc-entete-carte">';
    h += '    <span class="rc-tag rc-tag-initiale">Visite initiale</span>';
    h += '    <span class="rc-badge-statut">' + esc(statutInit) + '</span>';
    h += '  </div>';
    h += '  <div class="rc-prat-ligne">';
    h += '    ' + pastilleType(a) + ' <strong class="rc-prat-nom">' + lienFiche(a.code, esc(a.nom)) + '</strong>' + (!phA ? ' ' + etoiles(a.note) : '');
    h += '  </div>';
    if (specInit) {
      h += '  <div class="rc-spec-ligne"><span class="rc-spec-texte">' + esc(specInit) + '</span></div>';
    }
    h += '  <div class="rc-lieu-cadre">';
    h += '    <div class="rc-lieu-item rc-etablissement">🏥 <strong>' + esc(lieuInit || 'Établissement non précisé') + '</strong></div>';
    var secAffInit = [repereInit, (secInit && (!repereInit || repereInit.toLowerCase().indexOf(secInit.toLowerCase()) < 0) ? secInit : '')].filter(Boolean).join(' · ');
    if (secAffInit) {
      h += '    <div class="rc-lieu-item rc-secteur">📍 ' + esc(secAffInit) + '</div>';
    }
    h += '  </div>';
    h += '  <div class="rc-bas-carte">';
    h += '    <div class="rc-heure-initiale">⏰ Prévu vers <strong>' + esc(heureInit) + '</strong></div>';
    if (f.garder) {
      h += '    <div class="rc-note-cr rc-cr-conserve"><span class="rc-coche">✓</span> Compte rendu conservé dans l\'historique</div>';
    } else {
      h += '    <div class="rc-note-cr rc-cr-retire"><span class="rc-croix">✕</span> Retiré de la tournée du ' + dateCourte(a.date) + '</div>';
    }
    h += '  </div>';
    h += '</div>';

    // TRANSITION
    h += '<div class="rc-transition">';
    h += '  <div class="rc-transition-trait"></div>';
    h += '  <div class="rc-transition-pilule">';
    h += '    <span class="rc-transition-fleche">↓</span> <span class="rc-transition-texte">Remplacée par</span>';
    h += '  </div>';
    h += '  <div class="rc-transition-trait"></div>';
    h += '</div>';

    // CARTE 2 : NOUVEAU RENDEZ-VOUS
    h += '<div class="rc-carte rc-carte-nouveau">';
    h += '  <div class="rc-entete-carte">';
    h += '    <span class="rc-tag rc-tag-nouveau">Nouveau rendez-vous</span>';
    h += '    <span class="rc-badge-heure-nouveau">⏰ <strong>Passage vers ' + esc(heureN) + '</strong></span>';
    h += '  </div>';
    h += '  <div class="rc-prat-ligne">';
    h += '    ' + pastilleType(p || a) + ' <strong class="rc-prat-nom rc-nom-cible">' + esc(nomN) + '</strong>' + (!phN ? ' ' + etoiles(noteN) : '');
    h += '  </div>';
    if (specN || convN) {
      h += '  <div class="rc-spec-ligne">';
      if (specN) h += '<span class="rc-spec-texte">' + esc(specN) + '</span>';
      if (!phN && convN) h += ' ' + badgeConv(convN);
      h += '  </div>';
    }
    h += '  <div class="rc-lieu-cadre rc-cadre-cible">';
    h += '    <div class="rc-lieu-item rc-etablissement">🏥 <strong>' + esc(lieuN || 'Établissement non précisé') + '</strong></div>';
    var secAffN = [repereN, (secN && (!repereN || repereN.toLowerCase().indexOf(secN.toLowerCase()) < 0) ? secN : '')].filter(Boolean).join(' · ');
    if (secAffN) {
      h += '    <div class="rc-lieu-item rc-secteur">📍 ' + esc(secAffN) + '</div>';
    }
    if (creneauN || horaireN) {
      h += '    <div class="rc-lieu-item rc-creneau-texte">🕐 Présent ' + esc(creneauN) + (horaireN ? ' (' + esc(horaireN) + ')' : '') + '</div>';
    }
    if (memeLieu) {
      h += '    <div class="rc-proximite-box"><span class="etiquette ok">✓ Même établissement</span></div>';
    } else if (distN !== null) {
      h += '    <div class="rc-proximite-box"><span class="etiquette">🧭 ' + km(distN) + ' du lieu remplacé</span></div>';
    }
    h += '  </div>';
    h += '</div>';

    // ENCART REASSURANCE
    h += '<div class="rc-encart-info">';
    h += '  <span class="rc-info-icone">ℹ️</span>';
    h += '  <span class="rc-info-texte">L\'ordre de votre journée sera automatiquement réorganisé et optimisé pour intégrer ce rendez-vous sans détours.</span>';
    h += '</div>';

    h += '</div>';

    var pied = '<button type="button" class="bouton rc-btn-autre" data-a="remplacerNon">' +
      '<svg class="rc-chevron-gauche" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 19-7-7 7-7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span>Changer</span>' +
      '</button>' +
      '<button type="button" class="bouton bouton-plein rc-btn-valider" data-a="remplacerOui">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span>Remplacer</span>' +
      '</button>';

    return { corps: h, pied: pied };
  }

  FEUILLES.remplacer = function (f) {
    var a = arret(f.uid);
    if (!a) return '<p class="discret">Visite introuvable.</p>';
    var ph = estPharmacie(a);
    var libType = ph ? 'une pharmacie' : 'un médecin';
    if (f.choix) {
      f.retourAction = 'remplacerNon';
      return renduConfirmationRemplacement(f, a, f.choix);
    }
    f.retourAction = null;
    var l = candidatsRemplacement(a);
    if (!l.length) return '<p class="sous-titre" style="margin-top:0">Choisissez ' + libType + ' disponible pour rattraper et remplacer cette visite.</p>' +
      '<p class="discret">Aucun' + (ph ? 'e autre pharmacie' : ' autre médecin') + ' disponible ce jour-là selon vos critères (communes, collègues). Vous pouvez garder ' + esc(a.nom) + ' ou le retirer.</p>' +
      '<div class="rangee-actions" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="bouton bouton-plein" data-a="feuilleFermer" style="flex:1;min-width:140px">' + icone('epingle') + 'Garder ' + esc(a.nom) + '</button>' +
        '<button type="button" class="bouton danger-doux" data-a="retirerPlan" data-uid="' + a.uid + '" style="flex:1;min-width:140px">' + icone('fermer') + 'Retirer de la tournée</button>' +
      '</div>';
    var q = f.q || '';
    return '<p class="sous-titre" style="margin-top:0">Choisissez ' + libType + ' disponible pour rattraper et remplacer <b>' + esc(a.nom) + '</b> dans votre tournée du ' + dateFr(a.date) + ' :</p>' +
      champRechercheLibre('rechRemplacer', q) +
      '<div id="resRemplacer" style="margin-top:8px">' + listeCandidatsRemplacementHtml(f, l, q) + '</div>';
  };
  FEUILLES.ajouterJour = function (f) {
    var q = (f && f.q) || '';
    return champRechercheLibre('rechAjout', q) +
      '<div id="resAjout">' + resultatsAjout(q) + '</div>' +
      '<p class="discret" style="margin-top:0">Ou complétez votre journée avec un praticien présent près de vous.</p><div class="choix-ajout">' +
      [['Médecin', 'plus', 'Médecin', 'Présents près de vous, selon vos spécialités'], ['Pharmacie', 'plus', 'Pharmacie', 'Ouvertes près de vous'], ['autour', 'cible', 'Autour de moi', 'Tous les praticiens, avec filtres']].map(function (x) {
        return '<button type="button" class="tuile" data-a="ajouterJourChoix" data-v="' + x[0] + '"><b>' + icone(x[1]) + esc(x[2]) + '</b><small>' + esc(x[3]) + '</small></button>';
      }).join('') + '</div>';
  };
  // 3.25.0 : recherche libre (nom, spécialité, établissement, quartier, commune) parmi les praticiens présents ce jour-là,
  // selon les filtres de la tournée, dès les premières lettres
  function resultatsAjout(q) {
    var d = S.ui.dateAjout || S.ui.jour, j = jourSemaineIndex(d), mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    if (!mots.length) return '';
    if (j > 4) return '<p class="discret">Aucun praticien présent le week-end.</p>';
    var filtre = filtreAjout(), dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; })), vus = {};
    (ctx().parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      if (dans[cr.code] || absentLe(p, d) || (filtre && !filtre(p))) return;
      if (S.ui.typeAjout && (S.ui.typeAjout === 'Pharmacie') !== (p.type === 'Pharmacie')) return;
      var txt = normaliser([p.nom, p.specialite, cr.lieu, cr.quartier, cr.commune].join(' '));
      if (!mots.every(function (m) { return txt.indexOf(m) >= 0; })) return;
      var x = { cr: cr, score: Moteur.scoreDe(p, d) };
      if (!vus[cr.code] || x.score > vus[cr.code].score) vus[cr.code] = x;
    });
    var l = Object.keys(vus).map(function (k) { return vus[k]; }).sort(function (x, y) { return y.score - x.score; }).slice(0, 30);
    if (!l.length) return '<p class="discret">Aucun praticien présent le ' + dateFr(d) + ' ne correspond, selon vos filtres.</p>';
    return '<ul class="liste">' + l.map(function (x) {
      var cr = x.cr, p = cr.prat, st = '';
      if (p.type === 'Pharmacie') {
        st = lieuPharmacieListe(p, cr);
      } else {
        var hopital = abregerHopital(cr.lieu || (p.lieux && p.lieux[0] && p.lieux[0].lieu) || '');
        var secteur = cr.commune || p.commune || '';
        var m = [];
        if (p.specialite) m.push(p.specialite);
        if (hopital) m.push(hopital);
        if (secteur && (!hopital || hopital.toLowerCase().indexOf(secteur.toLowerCase()) < 0)) m.push(secteur);
        st = m.join(' · ');
      }
      return '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="ajouterCandidat" data-r="recherche" data-v="' + esc(cr.cle) + '">' +
        '<span class="element-titre">' + pastilleType(p) + lienFiche(p.code, esc(p.nom)) + ' ' + etoiles(p.note) + '</span>' +
        (st ? '<span class="discret bloc-texte">' + esc(st) + '</span>' : '') +
        '<span class="discret bloc-texte">' + cr.creneau + ' ' + minutesVersHeure(cr.debut) + '-' + minutesVersHeure(cr.fin) + ' · ' + esc(vuDepuis(p.derniere, d)) + '</span></button></li>';
    }).join('') + '</ul>';
  }
  FEUILLES.ajouterTournee = function (f) {
    var rech = '';   // 3.25.3 : la recherche se fait dans la liste « Selon mes filtres »
    var t = S.ui.typeAjout, qui = t === 'Médecin' ? 'Médecins' : t === 'Pharmacie' ? 'Pharmacies' : 'Praticiens';
    var filtres = libelleFiltresJour(t, S.ui.dateAjout || S.ui.jour);
    // 3.26.86 : 3e choix : médecins présents dans les hôpitaux choisis, à un moment de la journée
    var hS = LS.get('rechHop', null), resHop = hS && hS.lieux && hS.lieux.length ? hS.lieux.length + ' hôpita' + (hS.lieux.length > 1 ? 'ux' : 'l') + (hS.specs && hS.specs.length ? ' · ' + hS.specs.map(abrSpec).join(', ') : '') : 'Médecins présents dans un ou plusieurs hôpitaux, à un moment donné';
    var tuiles = [['position', 'cible', 'Par ma position', qui + ' présents près de vous'], ['communes', 'filtre', 'Selon mes filtres', filtres]];
    if (t !== 'Pharmacie') tuiles.push(['hopitaux', 'loupe', 'Dans des hôpitaux', resHop]);
    // 3.26.87 : + Pharmacie : 3e choix : toutes les pharmacies ouvertes dans une zone choisie (communes ou secteurs)
    var zS = LS.get('rechZonePh', null), resZone = zS && zS.communes && zS.communes.length ? libelleCommunes(zS.communes) : 'Pharmacies ouvertes dans les communes ou secteurs choisis';
    if (t !== 'Médecin') tuiles.push(['zone', 'loupe', 'Pharmacies dans une zone', resZone]);   // 3.26.89 : aussi dans « Autour de moi »
    // 3.27.42 : 4e choix : Tout le répertoire sans aucun filtre ni restriction
    var toutDesc = t === 'Pharmacie' ? 'Toutes les pharmacies de la base, sans filtre ni restriction' : (t === 'Médecin' ? 'Tous les médecins de la base, sans filtre ni restriction' : 'Tous les praticiens de la base, sans filtre');
    tuiles.push(['tout', 'repertoire', 'Tout le répertoire', toutDesc]);
    return rech + '<div class="choix-ajout">' + tuiles.map(function (x) {
      return '<button type="button" class="tuile" data-a="ajouterTourneeChoix" data-v="' + x[0] + '"><b>' + icone(x[1]) + esc(x[2]) + '</b><small>' + esc(x[3]) + '</small></button>';
    }).join('') + '</div>';
  };
  // 3.25.16 : + Médecin / + Pharmacie : « Selon mes filtres » = exactement les filtres de l'onglet Rechercher (communes comprises)
  function libelleFiltresRecherche(t) {
    var f = t ? filtresRechercheType(t) : S.ui.filtres, g = {};
    criteresActifs(f).forEach(function (x) { if (!t || x[0] !== 'type') (g[x[0]] = g[x[0]] || []).push(x[2]); });
    var l = ['type', 'communes', 'specialites', 'potentiels', 'visite', 'conv', 'equipe'].filter(function (k) { return g[k]; }).map(function (k) { return libelleListe(g[k], ''); });
    return l.length ? l.join(' · ') : 'Aucun filtre dans Répertoire : tous';
  }
  function communesAjout(d) { return communesDuJour(d).slice(); }
  function libelleFiltresJour(t, d) {
    var p = S.params || {}, l = [], com = communesDuJour(d);
    l.push(com.length ? libelleCommunes(com) : 'toutes les communes');
    if (t !== 'Pharmacie' && (p.specialites || []).length) l.push(libelleListe(p.specialites, ''));
    if ((p.potentiels || []).length) l.push('potentiel ' + p.potentiels.join(', '));
    return 'Critères de la journée : ' + l.join(' · ');
  }
  // communes du jour : celles de la planification (par jour si réglé), sinon celles des visites déjà prévues
  // 3.28.37 : communes choisies dans Planifier pour ce jour, plus celles des visites de la journée qui n'y sont pas
    var l = communesPour(d) || [];
    if (!l.length) l = Array.from(new Set(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.commune; }).filter(Boolean)));
    return l;
  }
  // 3.25.2 : champ de recherche en tête, pour chercher parmi les praticiens déjà filtrés (communes du jour, critères)
  FEUILLES.ajouterCommunes = function (f) {
    var d = S.ui.dateAjout || S.ui.jour, com = Object.keys(ensemble(communesAjout(d))), q = (f && f.q) || '';
    return '<div class="sj-ligne" style="margin-bottom:8px"><span class="discret" style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Présents le ' + esc(dateCourte(d)) + (com.length ? ' · ' + esc(libelleCommunes(com)) : '') + '</span>' +
      '<button type="button" class="bouton petit" data-a="ajouterTourneeChoix" data-v="position" style="flex:none;white-space:nowrap">' + icone('cible') + 'Près de moi</button></div>' +
      champRechercheLibre('rechCommunes', q) + '<div id="resCommunes">' + resultatsCommunes(q) + '</div>';
  };
  function resultatsCommunes(q) {
    var d = S.ui.dateAjout || S.ui.jour, j = jourSemaineIndex(d), com = ensemble(communesAjout(d)), filtre = filtreAjout(), ex = exclusCollegues([d]);
    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    var dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; })), vus = {};
    (ctx().parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      if (dans[cr.code] || ex[cr.code] || (Object.keys(com).length && !(typeof communeCorrespondante === 'function' ? communeCorrespondante(cr, com) : com[cr.commune])) || (filtre && !filtre(p)) || absentLe(p, d)) return;
      if (S.ui.typeAjout && (S.ui.typeAjout === 'Pharmacie') !== (p.type === 'Pharmacie')) return;
      if (mots.length) {
        var txt = normaliser([p.nom, p.specialite, cr.lieu, cr.quartier, cr.commune].join(' '));
        if (!mots.every(function (m) { return txt.indexOf(m) >= 0; })) return;
      }
      var x = { cr: cr, score: Moteur.scoreDe(p, d) };
      if (!vus[cr.code] || x.score > vus[cr.code].score) vus[cr.code] = x;
    });
    // 3.25.8 : position connue (GPS récent ou Autour de moi) : du plus proche au plus loin
    var pos = positionActuelle();
    Object.keys(vus).forEach(function (k) { vus[k].dist = pos && vus[k].cr.coord ? distanceVol(pos, vus[k].cr.coord) : null; vus[k].approx = !!(vus[k].cr.coord && vus[k].cr.coord.approx); });
    // 3.28.38 : depuis Planifier (+ Ajouter), liste complète par ordre alphabétique ; dans Journée, du plus proche au plus loin
    var alpha = S.ui.tab === 'semaine', nomTri = function (x) { return sansAccents(nomSansType(x.cr.prat.nom || '')).toLowerCase().replace(/^(dr|pr|ide|sage[- ]femme|mme|mlle|m)\.?\s+/, ''); };
    var tous = Object.keys(vus).map(function (k) { return vus[k]; }).sort(function (x, y) {
      if (alpha) return nomTri(x).localeCompare(nomTri(y), 'fr');
    }), l = tous.slice(0, mots.length ? 60 : 30);
    if (!l.length) return '<p class="discret">' + (mots.length ? 'Aucun résultat pour « ' + esc(q) + ' » parmi ces praticiens.' : 'Aucun autre praticien présent ce jour-là' + (Object.keys(com).length ? ' dans ' + esc(libelleCommunes(Object.keys(com))) : '') + ', selon vos critères.') + '</p>';
    return (mots.length ? '<p class="discret">' + tous.length + ' résultat' + (tous.length > 1 ? 's' : '') + '.</p>' : '') +
      '<ul class="liste">' + l.map(function (x) {
        var cr = x.cr, p = cr.prat, st = '', details = cr.creneau + ' ' + minutesVersHeure(cr.debut) + '-' + minutesVersHeure(cr.fin) + ' · ' + esc(vuDepuis(p.derniere, d));
        if (p.type === 'Pharmacie') {
          st = lieuPharmacieListe(p, cr);
          if (x.dist !== null && x.dist !== undefined) {
            details += ' · <b>' + distMoi(x.dist, x.approx) + '</b>' + (x.approx ? ' <small>(position du quartier)</small>' : '');
          }
        } else {
          var hopital = abregerHopital(cr.lieu || (p.lieux && p.lieux[0] && p.lieux[0].lieu) || '');
          var secteur = cr.commune || p.commune || '';
          var m = [];
          if (p.specialite) m.push(p.specialite);
          if (hopital) m.push(hopital);
          if (secteur && (!hopital || hopital.toLowerCase().indexOf(secteur.toLowerCase()) < 0)) m.push(secteur);
          st = m.join(' · ');
        }
        return '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="ajouterCandidat" data-r="recherche" data-v="' + esc(cr.cle) + '">' +
          '<span class="element-titre">' + pastilleType(p) + lienFiche(p.code, esc(p.nom)) + ' ' + etoiles(p.note) + '</span>' +
          (st ? '<span class="discret bloc-texte">' + esc(st) + '</span>' : '') +
          '<span class="discret bloc-texte">' + details + '</span></button></li>';
      }).join('') + '</ul>' + (tous.length > l.length ? '<p class="discret">' + (tous.length - l.length) + ' autres : précisez la recherche.</p>' : '');
  }
  // 3.27.42 : « Tout le répertoire » (+ Médecin / + Pharmacie) : tous les médecins ou pharmacies de la BDD,
  // affichés indépendamment des autres filtres appliqués au moment de la recherche
  FEUILLES.ajouterTout = function (f) {
    var d = S.ui.dateAjout || S.ui.jour || aujourdhui(), q = (f && f.q) || '';
    var t = S.ui.typeAjout;
    var sousTitre = t === 'Médecin' ? 'Tous les médecins au répertoire' : (t === 'Pharmacie' ? 'Toutes les pharmacies au répertoire' : 'Tout le répertoire');
    return '<div class="sj-ligne" style="margin-bottom:8px"><span class="discret" style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(sousTitre) + ' · ' + esc(dateCourte(d)) + '</span>' +
      '<button type="button" class="bouton petit" data-a="ajouterTourneeChoix" data-v="position" style="flex:none;white-space:nowrap">' + icone('cible') + 'Près de moi</button></div>' +
      champRechercheLibre('rechTout', q) + '<div id="resTout">' + resultatsTout(q) + '</div>';
  };

  function resultatsTout(q) {
    var d = S.ui.dateAjout || S.ui.jour || aujourdhui(), j = jourSemaineIndex(d);
    var t = S.ui.typeAjout;
    var tousPrat = (S.data && S.data.praticiens) || [];
    if (t === 'Médecin') tousPrat = tousPrat.filter(function (p) { return p.type !== 'Pharmacie'; });
    else if (t === 'Pharmacie') tousPrat = tousPrat.filter(function (p) { return p.type === 'Pharmacie'; });

    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    var dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; }));
    var pos = positionActuelle();
    var cCtx = ctx();

    var filtres = tousPrat.filter(function (p) {
      if (!mots.length) return true;
      var pres = cCtx.presencesParCode[p.code] || [];
      var lieux = pres.map(function (x) { return [x.lieu, x.quartier, x.commune, x.zone].join(' '); }).join(' ');
      var txt = normaliser([p.nom, p.specialite, p.titulaire, lieux].join(' '));
      return mots.every(function (m) { return txt.indexOf(m) >= 0; });
    });

    // Distance par rapport à la position actuelle (GPS)
    var avecDist = filtres.map(function (p) {
      var pres = cCtx.presencesParCode[p.code] || [];
      var minD = null, approx = false;
      if (pos && pres.length) {
        pres.forEach(function (pr) {
          var coord = (pr.lat && pr.lon) ? { lat: +pr.lat, lon: +pr.lon } : null;
          if (!coord && pr.quartier) {
            var qO = quartiers().filter(function (x) { return x.quartier === pr.quartier; })[0];
            if (qO) coord = { lat: +qO.lat, lon: +qO.lon, approx: true };
          }
          if (coord) {
            var dst = distanceVol(pos, coord);
            if (minD === null || dst < minD) { minD = dst; approx = !!coord.approx; }
          }
        });
      }
      return { p: p, dist: minD, approx: approx };
    });

    avecDist.sort(function (x, y) {
      if (pos) {
        var dDiff = (x.dist === null) - (y.dist === null) || (x.dist || 0) - (y.dist || 0);
        if (dDiff !== 0) return dDiff;
      }
      return String(x.p.nom || '').localeCompare(String(y.p.nom || ''), 'fr');
    });

    var limite = mots.length ? 100 : 50;
    var l = avecDist.slice(0, limite);
    if (!l.length) {
      return '<p class="discret">' + (mots.length ? 'Aucun résultat pour « ' + esc(q) + ' » parmi tous les praticiens.' : 'Aucun praticien au répertoire.') + '</p>';
    }

    var html = (mots.length ? '<p class="discret">' + avecDist.length + ' résultat' + (avecDist.length > 1 ? 's' : '') + '.</p>' : '<p class="discret">' + avecDist.length + ' praticien' + (avecDist.length > 1 ? 's' : '') + ' au répertoire.</p>') +
      '<ul class="liste">' + l.map(function (item) {
        var p = item.p;
        var pres = cCtx.presencesParCode[p.code] || [];
        var fusion = fusionnerLieux(pres);
        var lieuxNoms = fusion.map(function (x) { return abregerHopital(x.lieu || x.quartier || ''); }).filter(Boolean);
        var comNoms = Array.from(new Set(fusion.map(function (x) { return x.commune; }).filter(Boolean)));
        var crJour = (cCtx.parCode[p.code] || []).filter(function (x) { return x.jourIdx === j; });
        var dejaPlan = !!dans[p.code];
        var cib = cibleParCollegues(p.code, d);

        var st = '';
        if (p.type === 'Pharmacie') {
          var qCom = Array.from(new Set(pres.map(function (x) { return [x.quartier, x.commune].filter(Boolean).join(', '); }).filter(Boolean))).join(' · ');
          st = qCom || p.commune || '';
        } else {
          var m = [];
          if (p.specialite) m.push(p.specialite);
          if (lieuxNoms.length) m.push(lieuxNoms.slice(0, 2).join(' / '));
          if (comNoms.length && (!lieuxNoms.length || lieuxNoms.join(' ').toLowerCase().indexOf(comNoms[0].toLowerCase()) < 0)) m.push(comNoms[0]);
          st = m.join(' · ');
        }

        var details = '';
        if (crJour.length) {
          details = '<span class="etiquette ok">Présent ce jour</span> ' + crJour[0].creneau + ' ' + minutesVersHeure(crJour[0].debut) + '-' + minutesVersHeure(crJour[0].fin);
        } else if (pres.length) {
          var jrs = Array.from(new Set((cCtx.parCode[p.code] || []).map(function (x) { return JOURS_COURTS[x.jourIdx].replace('.', ''); }))).join(', ');
          details = '<span class="etiquette">Présences : ' + (jrs || 'habituelles') + '</span>';
        } else {
          details = '<span class="etiquette">Sans planning fixe</span>';
        }

        if (item.dist !== null && item.dist !== undefined) {
          details += ' · <b>' + distMoi(item.dist, item.approx) + '</b>' + (item.approx ? ' <small>(position du quartier)</small>' : '');
        }
        if (p.derniere) {
          details += ' · <small>' + esc(vuDepuis(p.derniere, d)) + '</small>';
        }
        if (dejaPlan) {
          details += ' · <span class="etiquette" style="background:#e0f2fe;color:#0369a1;font-weight:bold">Déjà dans la tournée</span>';
        }
        if (cib.length) {
          details += ' · <span class="conflit-planif">Prévu par ' + esc(cib[0].delegue) + '</span>';
        }

        return '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="ajouterToutPrat" data-code="' + esc(p.code) + '">' +
          '<span class="element-titre">' + pastilleType(p) + lienFiche(p.code, esc(p.nom)) + ' ' + etoiles(p.note) + '</span>' +
          (st ? '<span class="discret bloc-texte">' + esc(st) + '</span>' : '') +
          '<span class="discret bloc-texte">' + details + '</span></button></li>';
      }).join('') + '</ul>' +
      (avecDist.length > l.length ? '<p class="discret" style="text-align:center;padding:12px 0">' + (avecDist.length - l.length) + ' autres praticiens. Tapez un nom ou un lieu dans la recherche ci-dessus pour affiner.</p>' : '');

    return html;
  }
  // 3.26.86 : « Dans des hôpitaux » : qui est présent dans les hôpitaux choisis, ce jour-là, au moment choisi
  // (spécialités et moment facultatifs : sans choix, tous). Même présentation que « Selon mes filtres ».
  function hopitauxConnus() {
    var par = {};
    (S.data && S.data.presences || []).forEach(function (pr) {
      var p = ctx().prat[pr.code]; if (!p || p.type === 'Pharmacie') return;
      var nom = String(pr.lieu || '').trim(), k = normaliser(nom); if (!k) return;
      var e = par[k] || (par[k] = { v: k, lib: abregerHopital(nom), commune: communeParente(pr.commune || '') || 'Autres', codes: {} });
      e.codes[pr.code] = true;
    });
    var secs = {};
    Object.keys(par).forEach(function (k) { var e = par[k]; e.n = Object.keys(e.codes).length; (secs[e.commune] = secs[e.commune] || []).push({ v: e.v, lib: e.lib, n: e.n }); });
    return Object.keys(secs).sort(function (x, y) { return x.localeCompare(y, 'fr'); }).map(function (c) {
      return { titre: c, options: secs[c].sort(function (x, y) { return x.lib.localeCompare(y.lib, 'fr'); }) };
    });
  }
  FEUILLES.ajouterHopitaux = function (f) {
    var h = f.h, d = S.ui.dateAjout || S.ui.jour; LS.set('rechHop', h);
    var moments = [['tout', 'Journée'], ['Matin', 'Matin'], ['Soir', 'Soir']];
    if (d === aujourdhui()) moments.push(['maintenant', 'Maintenant']);
    var corps = groupeChoix(f, { id: 'hop', titre: 'Hôpitaux', chemin: 'h.lieux', multiple: true, repliable: true, recherche: true, rechercheVisible: true, resume: 'Choisir', resumeComplet: true, sections: hopitauxConnus(), accordeon: 'hop' }) +
      groupeChoix(f, { id: 'hspec', titre: 'Spécialités', chemin: 'h.specs', multiple: true, repliable: true, recherche: true, rechercheVisible: true, resume: 'Toutes',
        options: specialitesListe().filter(function (x) { return x.nom !== 'Pharmacien'; }).map(function (x) { return { v: x.nom, lib: abrSpec(x.nom), n: x.n }; }) }) +
      '<section class="groupe-filtre ouvert" data-groupe="hmom"><div class="groupe-tete"><div class="groupe-bascule"><b>Moment</b></div></div>' + segment('Moment', 'hopMoment', moments, h.moment, 'margin:0 0 4px') + '</section>';
    return corps + '<div id="resHopitaux">' + resultatsHopitaux(h, d) + '</div>';
  };
  // 3.26.87 : « Dans une zone » (+ Pharmacie) : pharmacies ouvertes ce jour-là, au moment choisi, dans les communes ou secteurs choisis.
  // Même présentation que « Dans des hôpitaux » : regroupées par quartier, du plus proche au plus loin si la position est connue.
  FEUILLES.ajouterZonePharma = function (f) {
    var z = f.z, d = S.ui.dateAjout || S.ui.jour; LS.set('rechZonePh', z);
    var moments = [['tout', 'Journée'], ['Matin', 'Matin'], ['Soir', 'Soir']];
    if (d === aujourdhui()) moments.push(['maintenant', 'Maintenant']);
    return groupeChoix(f, { id: 'com', titre: 'Zone', chemin: 'z.communes', multiple: true, repliable: true, recherche: true, rechercheVisible: true, resume: 'Choisir', resumeComplet: true, sections: sectionsCommunes(), accordeon: 'com' }) +
      '<section class="groupe-filtre ouvert" data-groupe="hmom"><div class="groupe-tete"><div class="groupe-bascule"><b>Moment</b></div></div>' + segment('Moment', 'hopMoment', moments, z.moment, 'margin:0 0 4px') + '</section>' +
      '<div id="resZonePharma">' + resultatsZonePharma(z, d) + '</div>';
  };
  function resultatsZonePharma(z, d) {
    if (!z.communes.length) return '<p class="discret">Choisissez au moins une commune ou un secteur pour voir les pharmacies ouvertes le ' + esc(dateCourte(d)) + '.</p>';
    if (jourSemaineIndex(d) > 4 || estFerie(d)) return '<p class="discret">Jour non ouvré : aucune présence connue.</p>';
    var j = jourSemaineIndex(d), now = minutesMaintenant(), com = ensemble(z.communes), pos = positionActuelle();
    var dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; })), ex = exclusCollegues([d]);
    var groupes = {}, ordre = [];
    (ctx().parJour[j] || []).forEach(function (cr) {
      var p = cr.prat; if (!p || p.type !== 'Pharmacie' || absentLe(p, d)) return;
      if (!communeCorrespondante(cr, com)) return;
      if (z.moment === 'Matin' || z.moment === 'Soir') { if (cr.creneau !== z.moment) return; }
      else if (z.moment === 'maintenant' && (now < cr.debut || now > cr.fin)) return;
      var k = (cr.quartier || cr.commune || 'Autres') + ' · ' + (cr.commune || '');
      var g = groupes[k] || (groupes[k] = { titre: [cr.quartier, cr.commune].filter(Boolean).join(', '), parCode: {} }); if (ordre.indexOf(k) < 0) ordre.push(k);
      var x = g.parCode[cr.code] || (g.parCode[cr.code] = { p: p, crs: [], score: Moteur.scoreDe(p, d), dist: pos && cr.coord ? distanceVol(pos, cr.coord) : null, approx: !!(cr.coord && cr.coord.approx) });
      x.crs.push(cr);
    });
    if (!ordre.length) return '<p class="discret">Aucune pharmacie ouverte dans cette zone le ' + esc(dateCourte(d)) + (z.moment !== 'tout' ? ' (' + esc(z.moment === 'maintenant' ? 'maintenant' : z.moment.toLowerCase()) + ')' : '') + '.</p>';
    // 3.26.90 : une seule liste, de la plus proche à la plus lointaine ; en tête, quelques repères ; la localisation et le Tél dans la carte
    var tous = [];
    ordre.forEach(function (k) { var g = groupes[k]; Object.keys(g.parCode).forEach(function (c) { tous.push(g.parCode[c]); }); });
    tous.sort(function (x, y) { return pos ? (x.dist === null) - (y.dist === null) || (x.dist || 0) - (y.dist || 0) || y.score - x.score : y.score - x.score; });
    var nJamais = tous.filter(function (x) { return !x.p.derniere; }).length, nPrevu = tous.filter(function (x) { return dans[x.p.code]; }).length;
    var plusProche = pos ? tous.filter(function (x) { return x.dist !== null; })[0] : null;
    var insights = [tous.length + ' pharmacie' + (tous.length > 1 ? 's' : '') + ' ouverte' + (tous.length > 1 ? 's' : '') + ' à ' + libelleCommunes(z.communes) + ({ tout: '', Matin: ' le matin', Soir: ' le soir', maintenant: ' maintenant' }[z.moment] || '')];
    if (nJamais) insights.push(nJamais + ' jamais visitée' + (nJamais > 1 ? 's' : ''));
    if (plusProche) insights.push('la plus proche à ' + distMoi(plusProche.dist, plusProche.approx));
    if (nPrevu) insights.push(nPrevu + ' déjà dans la tournée');
    return '<p class="insights-zone"><b>' + esc(insights[0]) + '</b>' + (insights.length > 1 ? ' · ' + esc(insights.slice(1).join(' · ')) : '') + (pos ? '<br><small>' + esc(texteReferenceDistance()) + '</small>' : '<br><small>Position inconnue : touchez « Par ma position » pour classer par distance.</small>') + '</p>' +
      '<ul class="liste">' + tous.map(function (x) {
        var p = x.p, crs = x.crs.slice().sort(function (u, v) { return u.debut - v.debut; }), cr = crs[0];
        var plages = crs.map(function (c) { return c.creneau + ' ' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin); }).join(' · ');
        var deja = dans[p.code], etat = '';
        var dist = x.dist !== null ? ' · <b>' + distMoi(x.dist, x.approx) + '</b>' : '';
        var etiqPlus = (deja ? '<span class="etiquette ok">' + icone('valider') + 'Dans la tournée du jour</span>' : '') + etiquetteCollegues(p.code, d);
        var loc = esc([cr.quartier, cr.commune].filter(Boolean).join(', ')) + (p.telephone ? ' · <span style="white-space:nowrap">Tél : ' + esc(p.telephone) + '</span>' : '');
        return '<li class="element' + classeType(p) + (deja ? ' deja-tournee' : '') + '"><button type="button" class="carte-bouton" data-a="ajouterCandidat" data-r="recherche" data-v="' + esc(cr.cle) + '"' + (deja ? ' disabled' : '') + '>' +
          '<span class="element-titre">' + pastilleType(p) + lienFiche(p.code, esc(p.nom)) + ' ' + etoiles(p.note) + '</span>' +
          '<span class="discret bloc-texte">' + loc + '</span>' +
          '<span class="discret bloc-texte">' + esc(plages) + dist + etat + '</span>' +
          '<span class="etiquettes"><span class="etiquette">' + esc(vuDepuis(p.derniere, d)) + '</span>' + etiqPlus + '</span></button></li>';
      }).join('') + '</ul>';
  }
  function resultatsHopitaux(h, d) {
    if (!h.lieux.length) return '<p class="discret">Choisissez au moins un hôpital pour voir qui y est présent le ' + esc(dateCourte(d)) + '.</p>';
    if (jourSemaineIndex(d) > 4 || estFerie(d)) return '<p class="discret">Jour non ouvré : aucune présence connue.</p>';
    var j = jourSemaineIndex(d), now = minutesMaintenant(), lieux = ensemble(h.lieux), specs = ensemble(h.specs);
    var dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; })), ex = exclusCollegues([d]);
    var groupes = {}, ordre = [];
    (ctx().parJour[j] || []).forEach(function (cr) {
      var p = cr.prat, k = normaliser(cr.lieu || '');
      if (!p || p.type === 'Pharmacie' || !lieux[k] || absentLe(p, d)) return;
      if (h.specs.length && !specs[p.specialite]) return;
      if (h.moment === 'Matin' || h.moment === 'Soir') { if (cr.creneau !== h.moment) return; }
      else if (h.moment === 'maintenant' && (now < cr.debut || now > cr.fin)) return;
      var g = groupes[k] || (groupes[k] = { lieu: abregerHopital(cr.lieu), parCode: {} }); if (ordre.indexOf(k) < 0) ordre.push(k);
      var x = g.parCode[cr.code] || (g.parCode[cr.code] = { p: p, crs: [], score: Moteur.scoreDe(p, d) });
      x.crs.push(cr);
    });
    if (!ordre.length) return '<p class="discret">Personne de présent dans ces hôpitaux le ' + esc(dateCourte(d)) + (h.moment !== 'tout' ? ' (' + esc(h.moment === 'maintenant' ? 'maintenant' : h.moment.toLowerCase()) + ')' : '') + ', selon ces critères.</p>';
    // 3.26.91 : même présentation que « Pharmacies dans une zone » : repères en tête, une seule liste du plus proche au plus lointain
    var pos = positionActuelle(), tous = [];
    ordre.forEach(function (k) { var g = groupes[k]; Object.keys(g.parCode).forEach(function (c) { var x = g.parCode[c]; var co = x.crs[0].coord; x.dist = pos && co ? distanceVol(pos, co) : null; x.approx = !!(co && co.approx); x.lieu = g.lieu; tous.push(x); }); });
    tous.sort(function (x, y) { return pos ? (x.dist === null) - (y.dist === null) || (x.dist || 0) - (y.dist || 0) || y.score - x.score : y.score - x.score; });
    var nJamais = tous.filter(function (x) { return !x.p.derniere; }).length, nVus = tous.length - nJamais, nPrevu = tous.filter(function (x) { return dans[x.p.code]; }).length;
    var plusProche = pos ? tous.filter(function (x) { return x.dist !== null; })[0] : null;
    // 3.26.95 : on rappelle aussi les spécialités et le moment retenus
    var momTxt = { tout: '', Matin: ' le matin', Soir: ' le soir', maintenant: ' maintenant' }[h.moment] || '';
    var ins = [tous.length + ' médecin' + (tous.length > 1 ? 's' : '') + ' ' + (h.specs.length ? h.specs.map(abrSpec).join(', ') : 'toutes spécialités') + ' présent' + (tous.length > 1 ? 's' : '') + ' à ' + ordre.map(function (k) { return groupes[k].lieu; }).join(', ') + momTxt];
    if (nVus) ins.push(nVus + ' déjà visité' + (nVus > 1 ? 's' : ''));
    if (nJamais) ins.push(nJamais + ' jamais visité' + (nJamais > 1 ? 's' : ''));
    if (plusProche) ins.push('le plus proche à ' + distMoi(plusProche.dist, plusProche.approx));
    if (nPrevu) ins.push(nPrevu + ' déjà dans la tournée');
    return '<p class="insights-zone"><b>' + esc(ins[0]) + '</b>' + (ins.length > 1 ? ' · ' + esc(ins.slice(1).join(' · ')) : '') + (pos ? '<br><small>' + esc(texteReferenceDistance()) + '</small>' : '<br><small>Position inconnue : touchez « Par ma position » pour classer par distance.</small>') + '</p>' +
      '<ul class="liste">' + tous.map(function (x) {
        var p = x.p, crs = x.crs.slice().sort(function (u, v) { return u.debut - v.debut; }), cr = crs[0];
        var plages = crs.map(function (c) { return c.creneau + ' ' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin); }).join(' · ');
        var deja = dans[p.code], etat = '';
        var dist = x.dist !== null ? ' · <b>' + distMoi(x.dist, x.approx) + '</b>' : '';
        var etiqPlus = (deja ? '<span class="etiquette ok">' + icone('valider') + 'Dans la tournée du jour</span>' : '') + etiquetteCollegues(p.code, d);
        var ligne1 = '<b>' + esc(abrSpec(p.specialite)) + '</b> · ' + esc(x.lieu) + (p.telephone ? ' · <span style="white-space:nowrap">Tél : ' + esc(p.telephone) + '</span>' : '');
        return '<li class="element' + classeType(p) + (deja ? ' deja-tournee' : '') + '"><button type="button" class="carte-bouton" data-a="ajouterCandidat" data-r="recherche" data-v="' + esc(cr.cle) + '"' + (deja ? ' disabled' : '') + '>' +
          '<span class="element-titre">' + pastilleType(p) + lienFiche(p.code, esc(p.nom)) + ' ' + etoiles(p.note) + '</span>' +
          '<span class="discret bloc-texte">' + ligne1 + '</span>' +
          '<span class="discret bloc-texte">' + esc(plages) + dist + etat + '</span>' +
          '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere, d)) + '</span>' + etiqPlus + '</span></button></li>';
      }).join('') + '</ul>';
  }
  // 3.26.50 : instructions selon le navigateur ; un lien ouvert dans WhatsApp, Facebook ou Instagram s'ouvre dans un
  // navigateur intégré qui ne peut pas installer l'application (et n'a pas la même mémoire) : il faut l'ouvrir dans Chrome / Safari
  FEUILLES.installer = function (f) {
    // 3.28.36 : juste après l'accueil d'un collègue : un bouton quand le téléphone le permet (Android), sinon le geste
    if (f && f.bienvenue && S.ui.installEvt) return {
      corps: '<p style="margin-top:0"><b>Dernière étape :</b> installez MediPlanner sur votre écran d\'accueil pour l\'ouvrir comme une application, même sans réseau.</p>',
      pied: '<button class="bouton" type="button" data-a="fermerFeuille">Plus tard</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="installerBienvenue">' + icone('telecharger') + 'Installer</button>' };
    var ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua), integre = /FBAN|FBAV|Instagram|WhatsApp|; wv\)|Line\//i.test(ua);
    var samsung = /SamsungBrowser/i.test(ua), firefox = /Firefox|FxiOS/i.test(ua), iosAutre = ios && /CriOS|FxiOS|EdgiOS/i.test(ua);
    var t;
    if (integre) t = 'Vous êtes dans le navigateur de WhatsApp (ou d\'une autre application), qui ne peut pas installer MediPlanner. Touchez ⋮ (ou ⋯) puis « Ouvrir dans Chrome »' + (ios ? ' / « Ouvrir dans Safari »' : '') + ', puis installez depuis ce navigateur.';
    else if (iosAutre) t = 'Sur iPhone, l\'installation se fait depuis Safari : copiez le lien, ouvrez-le dans Safari, puis ' + icone('partager') + ' Partager › « Sur l\'écran d\'accueil ».';
    else if (ios) t = 'Dans Safari : ' + icone('partager') + ' Partager, puis « Sur l\'écran d\'accueil ».';
    else if (samsung) t = 'Dans Samsung Internet : menu ≡, puis « Ajouter page à » › « Écran d\'accueil ».';
    else if (firefox) t = 'Dans Firefox : menu ⋮, puis « Installer ». Si l\'option manque, ouvrez le lien dans Chrome.';
    else t = 'Dans Chrome : menu ⋮, puis « Installer l\'application » (ou « Ajouter à l\'écran d\'accueil »). Si rien n\'apparaît, attendez quelques secondes sur la page puis réessayez.';
    var corps = (f && f.bienvenue ? '<p style="margin-top:0"><b>Dernière étape :</b> installez MediPlanner sur votre écran d\'accueil.</p>' : '') +
      '<p style="margin-top:0">' + t + '</p><p class="discret">Votre accès est conservé : l\'application installée garde la connexion à la base.</p>';
    return f && f.bienvenue ? { corps: corps, pied: '<button class="bouton bouton-plein bouton-large" type="button" data-a="fermerFeuille">Compris</button>' } : corps;
  };
  function estInstallee() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  // 3.28.42 : toute suppression (supprimer, effacer, retirer, remplacer, abandonner) : « Non » à droite, en bouton principal et choisi par défaut ;
  // « Oui » à gauche, discret, pour ne pas supprimer par réflexe
  function estSuppression(f) { return f.destructif || /supprim|effac|retir|remplac|abandon|vider|quitter/i.test((f.oui || '') + ' ' + (f.titre || '')); }
  FEUILLES.confirmer = function (f) {
    if (estSuppression(f)) return { corps: '<p style="margin-top:0">' + f.message + '</p>',
      pied: piedQuestion('data-a="confirmerOui"', esc(f.oui), 'confirmerNon', f.ouiClasse) };
  };

  FEUILLES.choixAccepter = function (f) {
    var d = f.jour || S.ui.jour, b = f.jours || joursBrouillon();
    return {
      corps: '<p style="margin:0">Confirmer uniquement le <b>' + esc(dateCourte(d)) + '</b> ou les <b>' + b.length + ' jours</b> en brouillon ?</p>',
      pied: '<button class="bouton-texte sortir-question" type="button" data-a="fermerFeuille">← Retour</button>' +
        '<button class="bouton" type="button" data-a="accepterPortee" data-v="jour">Ce jour</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="accepterPortee" data-v="tous">' + icone('valider') + 'Les ' + b.length + ' jours</button>'
    };
  };

  FEUILLES.refusProgramme = function () {
    var d = S.ui.aAccepter || S.ui.jour, aSauve = S.ui.avantTirage && S.ui.avantTirage.date === d;
    return {
      corps: '<p style="margin:0">Que faire pour le <b>' + esc(dateCourte(d)) + '</b> ?</p>',
      pied: '<button class="bouton-texte sortir-question" type="button" data-a="fermerFeuille">← Retour</button>' +
        '<button class="bouton" type="button" data-a="recalculerEncore">' + icone('relancer') + 'Recalculer</button>' +
        (aSauve ? '<button class="bouton bouton-plein" type="button" data-a="restaurerAvantTirage">↩ Liste précédente</button>' :
          '<button class="bouton bouton-plein" type="button" data-a="continuerModifier">' + icone('crayon') + 'Modifier</button>')
    };
  };
  FEUILLES.valide = function (f) {
    var l = f.dates || [];
    return {
      corps: '<p style="margin:0"><b>' + (l.length === 1 ? majuscule(dateCourte(l[0])) + ' confirmé' : l.length + ' jours confirmés') +
        '</b> (visible par l\'équipe). Partager sur WhatsApp ?</p>',
      pied: '<button class="bouton-texte sortir-question" type="button" data-a="annulerConfirmation">← Retour</button>' +
        '<button class="bouton" type="button" data-a="fermerFeuille">Non</button>' +
        '<button class="bouton bouton-plein wa" type="button" data-a="ouvrirExport">' + icone('whatsapp') + 'Envoyer</button>'
    };
  };

  // 3.26.19 : Sélecteur sécurisé de l'établissement pour la capture GPS d'un praticien multi-sites
  FEUILLES.choixLieuGps = function (f) {
    var code = f.code, d = f.d || brouillonFiche(code);
    var p = praticien(code) || {};
    var lieux = Array.isArray(d.lieux) ? d.lieux : [];
    var h = '<div class="boite-contenu pad">' +
      '<div class="alerte info" style="margin-bottom:14px;border-left:4px solid var(--primaire,#0A6C74);background:rgba(10,108,116,0.08);padding:12px;border-radius:8px;font-size:13.5px;line-height:1.45">' +
        '<div style="font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:6px">' + icone('cible') + ' Praticien multi-sites</div>' +
        'Le Dr <b>' + esc(p.nom || d.nom) + '</b> consulte dans plusieurs établissements. ' +
        'Touchez l\'établissement où <b>vous êtes physiquement présent</b> pour enregistrer son GPS sans écraser les autres :' +
      '</div>' +
      '<div class="liste-choix-lieux-gps" style="display:flex;flex-direction:column;gap:10px">';

    lieux.forEach(function (l, idx) {
      var cl = lireCoord(l), aGps = !!cl;
      var coordStr = cl ? cl.lat.toFixed(5) + ', ' + cl.lon.toFixed(5) : '';
      h += '<div class="carte-choix-gps" style="border:1.5px solid ' + (aGps ? 'var(--trait,#d0d7de)' : 'rgba(230,126,34,0.5)') + ';border-radius:10px;padding:12px;background:var(--fond-carte,#fff);box-shadow:0 1px 3px rgba(0,0,0,0.05)">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">' +
          '<div style="flex:1">' +
            '<div style="font-weight:700;font-size:15px;color:var(--encre,#1c2833)">' + esc(l.lieu || ('Établissement ' + (idx + 1))) + '</div>' +
            '<div style="font-size:13px;color:var(--gris,#566573);margin-top:2px">' +
              esc(l.quartier || 'Quartier non renseigné') + (l.commune ? ' · ' + esc(l.commune) : '') +
            '</div>' +
          '</div>' +
          '<span class="gps-ici-badge ' + (aGps ? 'fixe' : 'manquant') + '" style="font-size:11.5px;padding:3px 8px;border-radius:8px;white-space:nowrap">' +
            (aGps ? '✓ Fixé' : 'Non fixé') +
          '</span>' +
        '</div>' +
        (aGps ? '<div style="font-size:11.5px;color:var(--gris,#7f8c8d);margin-bottom:10px">Coordonnées actuelles : ' + esc(coordStr) + '</div>' : '<div style="height:6px"></div>') +
        '<button type="button" class="bouton bouton-plein bouton-large" data-a="capterGpsLieu" data-v="' + esc(code) + '" data-i="' + idx + '" style="width:100%;display:flex;justify-content:center;align-items:center;gap:6px">' +
          icone('cible') + '<span>Capter le GPS de ce lieu</span>' +
        '</button>' +
      '</div>';
    });

    h += '</div>' +
      '<div style="margin-top:14px;text-align:center">' +
        '<button type="button" class="bouton" data-a="fermerFeuille">Annuler</button>' +
      '</div>' +
    '</div>';
    return h;
  };

  // Choix multiple générique (spécialités ciblées par la tournée)
  FEUILLES.multi = function (f) {
    if (f.cle === 'specialites') {
      var coeur = coeurDeCible(), sel = f.sel || [], q = normaliser((f.q && f.q.multi) || '');
      var coeurMap = {}, coeurOpts = [], autresOpts = [];
      coeur.forEach(function (nom) { coeurMap[nom] = true; });
      sel.forEach(function (nom) { coeurMap[nom] = true; });
      f.options.forEach(function (o) {
        if (coeurMap[o.nom]) coeurOpts.push(o);
        else autresOpts.push(o);
      });
      function puceM(o) {
        var actif = sel.indexOf(o.nom) >= 0;
        return '<button type="button" class="puce" data-a="multiToggle" data-v="' + esc(o.nom) +
          '" data-lib="' + esc(normaliser(o.nom)) + '" aria-pressed="' + actif + '"' + (q && normaliser(o.nom).indexOf(q) < 0 ? ' hidden' : '') + '>' +
          esc(o.nom) + (o.n !== undefined ? '<small>' + o.n + '</small>' : '') + '</button>';
      }
      var total = sel.reduce(function (s2, v) { var o = f.options.filter(function (x) { return x.nom === v; })[0]; return s2 + (o && o.n ? o.n : 0); }, 0);
      var h = '<div class="groupe-filtre ouvert" data-groupe="multi">';
      if (f.aide) h += '<p class="discret groupe-aide" style="margin-top:0">' + esc(f.aide) + '</p>';
      h += '<div class="recherche recherche-large">' + icone('loupe') + '<input type="search" data-f="chercheOption" data-g="multi" placeholder="Rechercher une spécialité…" value="' +
        esc((f.q && f.q.multi) || '') + '" aria-label="Rechercher une spécialité"></div>';
      h += '<div class="sous-titre-zone" style="margin:10px 0 6px"><span>Cœur de cible & sélectionnées (' + coeurOpts.length + ')</span></div>' +
        '<div class="puces">' + coeurOpts.map(puceM).join('') + '</div>';
      if (autresOpts.length) {
        var ouv = !!(f.autresOuvert || q);
        h += '<div class="section-choix" style="margin-top:14px">' +
          '<button type="button" class="aire-titre aire-bascule" data-a="multiToggleAutres" aria-expanded="' + ouv + '"><span>Autres spécialités</span><small>' + autresOpts.length + '</small>' + icone('chevron') + '</button>' +
          '<div class="puces" id="autresSpecs" data-ferme="1"' + (!ouv ? ' hidden' : '') + '>' + autresOpts.map(puceM).join('') + '</div></div>';
      }
      h += '</div>';
      return { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="multiTous">Tous</button><button class="bouton btn-secondaire" type="button" data-a="multiAucun">Effacer</button>' +
        '<button class="bouton bouton-plein btn-valider" type="button" data-a="multiOk">' + (sel.length ? 'Valider · ' + total + ' médecin' + (total > 1 ? 's' : '') : 'Valider · toutes') + '</button>' };
    }
    var h = groupeChoix(f, { id: 'multi', titre: f.titreGroupe || 'Choix', chemin: 'sel', multiple: true, recherche: f.options.length > 8, aide: f.aide,
      options: f.options.map(function (o) { return { v: o.nom, lib: f.cle === 'specialites' ? abrSpec(o.nom) : o.nom, n: o.n }; }) });
    var total = f.sel.reduce(function (s2, v) { var o = f.options.filter(function (x) { return x.nom === v; })[0]; return s2 + (o && o.n ? o.n : 0); }, 0);
    return { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="multiTous">Tous</button><button class="bouton btn-secondaire" type="button" data-a="multiAucun">Effacer</button>' +
      '<button class="bouton bouton-plein btn-valider" type="button" data-a="multiOk">' + (f.sel.length ? 'Valider · ' + total + ' médecin' + (total > 1 ? 's' : '') : 'Valider · toutes') + '</button>' };
  };

  // Filtres avancés de la liste des praticiens (cumulables)
  var TRIS = [['nom', 'Nom (A à Z)'], ['priorite', 'Potentiel'], ['score', 'Priorité de visite'], ['retard', 'Plus longtemps sans visite']];
  // Planifier un praticien depuis sa fiche : prochaine présence, ou +7, +14, +21, +28 jours, puis Oui / Non
  FEUILLES.planifierDate = function (f) {
    var c = Moteur.creneauParCle(ctx(), f.cle); if (!c) return '';
    var p = praticien(c.code) || {};
    var dates = [0, 7, 14, 21, 28].map(function (n) { return ajouterJours(f.d0, n); });
    var dejaLa = function (d) { return S.plan.some(function (a) { return a.code === c.code && a.date === d; }); };
    var absent = function (d) { return p.absentDu && d >= p.absentDu && (!p.absentAu || d <= p.absentAu); };
    var h = '<div class="cr-pas etapes-filtres"><div class="cr-question"><span class="etape-titre">Quelle date ?</span>' +
      '<p class="discret" style="margin:4px 0 0">' + esc(c.prat.nom) + ' : ' + esc(c.lieu) + ', ' + JOURS[c.jourIdx].toLowerCase() + ' ' + c.creneau.toLowerCase() +
      ' (' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + ')</p><div class="puces">' +
      dates.map(function (d, i) {
        var bloque = estFerie(d) || absent(d) || dejaLa(d);
        return '<button type="button" class="puce" data-a="planifierDateChoix" data-v="' + d + '" aria-pressed="' + (f.d === d) + '"' + (bloque ? ' disabled' : '') + '>' +
          dateFr(d) + '<small>' + (i ? '+' + (i * 7) + ' j' : 'prochaine') + (estFerie(d) ? ', férié' : absent(d) ? ', absent' : dejaLa(d) ? ', déjà prévu' : '') + '</small></button>';
      }).join('') + '</div></div>' +
      '<p style="margin:14px 0 0">Ajouter <b>' + esc(c.prat.nom) + '</b> à votre tournée du <b>' + dateFr(f.d) + '</b> ?</p></div>';
    return { corps: h, pied: piedQuestion('data-a="planifierDateOui"', 'Ajouter') };
  };
  // 3.27.23 : Planifier depuis le Répertoire : aujourd'hui, demain ou les présences suivantes, conflits signalés
  FEUILLES.planifierProchaines = function (f) {
    var p = praticien(f.code) || {}, l = prochainesPresences(p, 8), t = aujourdhui();
    if (!l.length) return { corps: '<p class="discret">Aucune présence connue dans les 3 prochaines semaines.</p>', pied: '<button class="bouton" type="button" data-a="fermerFeuille">Fermer</button>' };
    if (!f.sel) { var libre = l.filter(function (x) { return !conflitsPlanif(x.c, x.d).bloque; })[0]; f.sel = libre ? libre.c.cle + '@' + libre.d : ''; }
    var h = '<div class="cr-pas etapes-filtres"><div class="cr-question"><span class="etape-titre">Quand ?</span>' +
      '<p class="discret" style="margin:4px 0 0">' + esc(p.nom) + '</p><div class="choix-planif">' +
      l.map(function (x) {
        var k = x.c.cle + '@' + x.d, cf = conflitsPlanif(x.c, x.d);
        var quand = x.d === t ? 'Aujourd\'hui' : (x.d === ajouterJours(t, 1) ? 'Demain' : JOURS[jourSemaineIndex(x.d)] + ' ' + (+x.d.slice(8)));
        return '<button type="button" class="puce choix-planif-l" data-a="planifierProchainesChoix" data-v="' + esc(k) + '" aria-pressed="' + (f.sel === k) + '"' + (cf.bloque ? ' disabled' : '') + '>' +
          '<b>' + esc(quand) + ', ' + x.c.creneau.toLowerCase() + '</b> ' + minutesVersHeure(x.c.debut) + '-' + minutesVersHeure(x.c.fin) +
          (estPharmacie(p) ? '' : '<small>' + esc(abregerHopital(x.c.lieu)) + '</small>') +
          (cf.l.length ? '<small class="conflit-planif">' + esc(cf.l.join(' · ')) + '</small>' : '') + '</button>';
      }).join('') + '</div></div></div>';
    return { corps: h, pied: piedQuestion('data-a="planifierProchainesOui"' + (f.sel ? '' : ' disabled'), 'Ajouter') };
  };
  FEUILLES.listeChoix = function (f) {
    var cfg = S.ui.listes[f.id] || {}, n = 0;
    var map = function (l) { return l.map(function (o) { if (o[2] === 'entete') return { entete: true, v: '', lib: o[1] }; n++; return { v: o[0], lib: o[1] }; }); };
    var o = { id: 'l', titre: 'Un seul choix', chemin: 'sel', recherche: true, accordeon: String(f.id).replace(/\d+$/, '') };
    if (cfg.sections) o.sections = cfg.sections.map(function (x) { return { titre: x.titre, options: map(x.options), fermeeParDefaut: !!x.fermeeParDefaut }; }); else o.options = map(cfg.options || []);
    if (n <= 8) o.recherche = false;
    return groupeChoix(f, o);
  };
  FEUILLES.crListe = function (f) {
    var estProd = f.cle === 'produits' || f.cle === 'besoin' || f.cle === 'actionProduits';
    var o = { id: 'l', titre: f.multi ? 'Plusieurs choix possibles' : 'Un seul choix', chemin: 'sel', multiple: f.multi, recherche: f.options.length > 8 };
    if (estProd) {
      var g = produitsParGamme();
      o.sections = [
        { titre: 'Gamme Aura 2 (Zyltan, Lesstrol, Eurythmic, Tensicard)', options: g.gammeA.map(function (p) { return { v: p, lib: p }; }) },
        { titre: 'Gamme Aura 1 (autres produits)', options: g.gammeB.map(function (p) { return { v: p, lib: p }; }) }
      ];
    } else {
      o.options = f.options.map(function (op) { return { v: op[0], lib: op[1] }; });
    }
    var h = groupeChoix(f, o);
    return f.multi ? { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="crListeTous">Tous</button><button class="bouton btn-secondaire" type="button" data-a="crListeAucun">Effacer</button>' +
      '<button class="bouton bouton-plein btn-valider" type="button" data-a="crListeOk">Valider' + (f.sel.length ? ' · ' + f.sel.length : '') + '</button>' } : h;
  };
  FEUILLES.filtres = function (f) {
    var b = f.brouillon, n = filtrerPraticiens(b, rechercheCour()).length, seule = f.question;
    function opt(l) { return l.map(function (x) { return { v: x[0], lib: x[1], n: x[2] }; }); }
    var blocs = {
      qui: groupeChoix(f, { id: 'type', titre: 'Type de praticien', chemin: 'brouillon.type', options: opt([['Médecin', 'Médecins'], ['Pharmacie', 'Pharmacies'], ['tous', 'Tous']]) }),
      spec: b.type === 'Pharmacie' ? '<p class="discret groupe-aide">Les spécialités ne concernent pas les pharmacies. Celles choisies restent mémorisées pour les médecins' +
          (b.specialites.length ? ' (' + esc(b.specialites.map(abrSpec).join(', ')) + ')' : '') + '.</p>' :
        groupeChoix(f, { id: 'spec', titre: 'Spécialités', chemin: 'brouillon.specialites', multiple: true, repliable: !seule, recherche: true, resume: 'Toutes',
          options: specialitesListe().map(function (x) { return { v: x.nom, lib: abrSpec(x.nom), n: x.n }; }),
          aide: b.type === 'tous' ? 'S\'appliquent aux médecins seulement ; les pharmacies restent affichées.' : '' }),
      com: groupeChoix(f, { id: 'com', titre: 'Communes', chemin: 'brouillon.communes', multiple: true, repliable: !seule, recherche: true, resume: 'Toutes', sections: sectionsCommunes(), accordeon: 'com',
        aide: 'Lieux d\'exercice du praticien. Pour un établissement ou un quartier, utilisez la recherche de la liste.' }),
      valeur: groupeChoix(f, { id: 'pot', titre: 'Potentiel de prescription', chemin: 'brouillon.potentiels', multiple: true, tousVide: true,
          options: opt([['A', '★★★'], ['B', '★★'], ['C', '★']]) }) +
        groupeChoix(f, { id: 'conv', titre: 'Engagé', chemin: 'brouillon.conv', options: opt([['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']]) }),
      suivi: groupeChoix(f, { id: 'visite', titre: 'Dernière visite (un seul choix)', chemin: 'brouillon.visite', options: opt([['tous', 'Toutes'], ['recent', 'Visité -30 j'],
          ['30', 'Non visité +30 j'], ['jamais', 'Jamais visité'], ['retard', 'En retard'], ['revoir', 'À revoir']]) }) +
        (S.config.demo ? '' : groupeChoix(f, { id: 'equipe', titre: 'Prévu par un collègue cette semaine', chemin: 'brouillon.equipe', options: opt([['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']]) })),
      ordre: S.ui.tab === 'praticiens' ? groupeChoix(f, { id: 'tri', titre: 'Trier la liste par', chemin: 'tri', options: opt(TRIS) }) : ''
    };
    var ordre = seule ? [seule] : ['qui', 'spec', 'com', 'valeur', 'suivi', 'ordre'], num = 0;
    var h = ordre.map(function (k) {
      if (!blocs[k]) return '';
      num++;
      return '<div class="question-filtre">' + (seule ? '' : '<h3><span class="num">' + num + '</span>' + QUESTIONS_FILTRES[k].titre + '</h3>') + blocs[k] + '</div>';
    }).join('');
    var libOk = S.ui.tab === 'autour' ? 'Appliquer' : 'Afficher ' + n + ' praticien' + (n > 1 ? 's' : '');
    return { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="filtresReinit">' + (seule ? 'Effacer' : 'Tout effacer') + '</button>' +
      '<button class="bouton bouton-plein btn-valider" type="button" data-a="filtresOk">' + libOk + '</button>' };
  };

  // ------------------------------------------------------------------ Fiche praticien : parcours 2 étapes (Profil & GPS / Jours & horaires)
  var ETAPES_FICHE = ['1. Profil & GPS', '2. Jours & horaires'];
  // 3.25.23 : détection anti-doublon intelligente (ignore Dr/Pr/Pharmacie/Officine, vérifie mots-clés et téléphone)
  function nomCleDoublon(s) {
    return normaliser(s || '').replace(/\b(dr|docteur|pr|prof|professeur|mr|mme|mlle|pharmacie|grande|nouvelle|officine|clinique|cabinet|centre|medical|hopital|chu|chr|pmi|de|du|des|la|le|les|d|l)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // 3.27.28 : mots du nom (accents, titres et mots génériques retirés), espaces conservés
  var MOTS_VIDES_NOM = { dr: 1, docteur: 1, pr: 1, prof: 1, professeur: 1, mr: 1, mme: 1, mlle: 1, pharmacie: 1, phcie: 1, grande: 1, nouvelle: 1, officine: 1, clinique: 1,
    cabinet: 1, centre: 1, medical: 1, hopital: 1, chu: 1, chr: 1, pmi: 1, de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, d: 1, l: 1, epse: 1, nee: 1, ide: 1, sag: 1 };
  function motsNom(s) { return sansAccents(String(s || '')).toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w && !MOTS_VIDES_NOM[w]; }); }
  function chercherDoublonsFiche(d) {
    if (!d) return [];
    var mots = motsNom(d.nom), cle = mots.slice().sort().join(' '), tape = mots.join('');
    var tel = normaliserNumero(d.telephone || '');
    if (tape.length < 3 && !tel) return [];
    var c = ctx(), res = [], estPh = d.type === 'Pharmacie';
    var lieuxD = (d.lieux || []).map(function (l) { return String(l.lieu || '').trim(); }).filter(function (x) { return x.length >= 2; });
    var posD = estPh && d.lieux && d.lieux[0] && aCoord(d.lieux[0]) ? lireCoord(d.lieux[0]) : (estPh ? gpsFrais() : null);
    ((S.data && S.data.praticiens) || []).forEach(function (p) {
      if (d.code && p.code === d.code) return;
      var pMots = motsNom(p.nom), pTel = normaliserNumero(p.telephone || '');
      var memeTel = !!(tel && pTel && tel === pTel);
      var exact = !!cle && pMots.slice().sort().join(' ') === cle;
      // dès 3 lettres : chaque mot tapé est le début d'un mot du nom (le dernier peut être incomplet)
      var debut = mots.length > 0 && mots.every(function (w, i) { return pMots.some(function (pw) { return i === mots.length - 1 ? pw.indexOf(w) === 0 : pw === w || pw.indexOf(w) === 0; }); });
      var communs = mots.filter(function (w) { return w.length >= 3 && pMots.indexOf(w) >= 0; }).length;
      var proche = !exact && (debut || communs >= 2 || (tape.length >= 4 && pMots.join('').indexOf(tape) >= 0));
      if (!exact && !memeTel && !proche) return;
      var pres = c.presencesParCode[p.code] || [];
      var memeLieu = !estPh && lieuxD.length ? pres.filter(function (x) { return lieuxD.some(function (l) { return memeEtablissement(l, x.lieu); }); })[0] : null;
      var prPh = pres[0], dist = null;
      if (estPh && p.type === 'Pharmacie' && posD && prPh && aCoord(prPh)) dist = distanceKm(posD, lireCoord(prPh)) * 1000;
      var proximite = dist !== null && dist <= 150;
      var lieux = pres.map(function (x) { return [x.lieu, x.quartier, x.commune].filter(Boolean).join(', '); }).filter(Boolean);
      res.push({ p: p, exact: exact || memeTel, memeTel: memeTel, debut: debut, memeType: (p.type === 'Pharmacie') === estPh,
        memeLieu: memeLieu ? memeLieu.lieu : '', proximite: proximite, dist: dist,
        bloquant: exact || memeTel || (proche && (!!memeLieu || proximite)),
        lieu: memeLieu ? [memeLieu.lieu, memeLieu.quartier].filter(Boolean).join(', ') : (lieux[0] || '') });
    });
    var score = function (x) { return (x.exact ? 8 : 0) + (x.memeLieu || x.proximite ? 4 : 0) + (x.memeType ? 2 : 0) + (x.debut ? 1 : 0); };
    res.sort(function (a, b) { return score(b) - score(a) || String(a.p.nom).localeCompare(String(b.p.nom), 'fr'); });
    return res.slice(0, 5);
  }
  function rendrePresentsIci(d) {
    var l = chercherDoublonsFiche(d).filter(function (x) { return x.memeLieu || x.proximite; });
    if (!l.length) return '';
    return '<div class="fx-carte fx-presents-ici"><p class="fx-sec">' + (d.type === 'Pharmacie' ? 'Pharmacie au nom proche tout près' : 'Nom proche déjà présent dans cet établissement') + '</p>' + l.map(function (x) {
      return '<button type="button" class="fx-res" data-a="ouvrirDoublon" data-v="' + esc(x.p.code) + '"><span>' + nomPrat(x.p) + '<small>' + esc(x.lieu) + (x.proximite ? ' · à ' + Math.round(x.dist) + ' m' : '') + '</small></span><span class="fx-ouvrir">Ouvrir</span></button>';
    }).join('') + '</div>';
  }
  function rendreDoublonsFiche(d) {
    var l = chercherDoublonsFiche(d);
    if (!l.length) return '';
    // 3.27.1 : cartes « Déjà dans vos contacts » avec Ouvrir
    return '<p class="fx-sec">Déjà dans vos contacts</p>' + l.map(function (x) {
      var p = x.p;
      return '<button type="button" class="fx-res" data-a="ouvrirDoublon" data-v="' + esc(p.code) + '"><span>' + nomPrat(p) + '<small>' +
        esc([p.type === 'Pharmacie' ? '' : abrSpec(p.specialite), x.lieu, p.telephone].filter(Boolean).join(', ')) + (x.memeTel ? ', même téléphone' : '') + '</small>' +
        (x.memeLieu ? '<small class="fx-alerte">Déjà présent dans cet établissement</small>' : '') + (x.proximite ? '<small class="fx-alerte">À ' + Math.round(x.dist) + ' m d\'ici</small>' : '') + '<small>' + esc(vuDepuis(p.derniere, aujourdhui())) + '</small></span><span class="fx-ouvrir">Ouvrir</span></button>';
    }).join('');
  }
  // 3.25.5 : saisie assistée de l'établissement : dès quelques lettres, les établissements déjà connus de la base
  // (lieu, quartier, commune), pour reprendre exactement le même nom et éviter les doublons mal orthographiés
  // 3.25.33 : Hôpitaux et cliniques connus (les pharmacies sont formellement exclues)
  var HOPITAUX_DEFAUT = [
    { lieu: 'CHU de Cocody', quartier: 'Cocody Centre', commune: 'Cocody', lat: 5.344603, lon: -3.994502 },
    { lieu: 'CHU de Treichville', quartier: 'Zone 3 (CHU)', commune: 'Treichville', lat: 5.293486, lon: -4.003767 },
    { lieu: 'CHU d\'Angré', quartier: 'Angré', commune: 'Cocody', lat: 5.405000, lon: -3.978000 },
    { lieu: 'PISAM (Polyclinique Sainte Anne-Marie)', quartier: 'Vieux Cocody', commune: 'Cocody', lat: 5.336512, lon: -4.013281 },
    { lieu: 'Clinique Farah', quartier: 'Marcory Residentiel', commune: 'Marcory', lat: 5.304000, lon: -3.987000 },
    { lieu: 'Polyclinique des Deux Plateaux', quartier: 'Deux Plateaux', commune: 'Cocody', lat: 5.362868, lon: -3.997261 },
    { lieu: 'Hôpital Militaire d\'Abidjan (HMA)', quartier: 'Paillet', commune: 'Adjamé', lat: 5.381168, lon: -4.007937 },
    { lieu: 'Hôpital Général de Yopougon-Attié', quartier: 'Attié', commune: 'Yopougon', lat: 5.342066, lon: -4.080122 },
    { lieu: 'Hôpital Général de Marcory', quartier: 'Marcory Centre', commune: 'Marcory', lat: 5.301297, lon: -3.983410 },
    { lieu: 'CHR d\'Abobo', quartier: 'Abobo Nord', commune: 'Abobo', lat: 5.433023, lon: -4.038858 },
    { lieu: 'Institut de Cardiologie d\'Abidjan (ICA)', quartier: 'Zone 3 (CHU)', commune: 'Treichville', lat: 5.293007, lon: -4.005949 }
  ];

  // 3.25.34 : Dictionnaire canonique pour corriger automatiquement les fautes, abréviations et éviter les doublons en BDD
  var CANONICAL_HOPITAUX = [
    { re: /^(chu\b.*cocody|centre.*hospitalier.*universitaire.*cocody|cocody\s*chip)/i, nom: 'CHU de Cocody', quartier: 'Cocody Centre', commune: 'Cocody', lat: 5.344603, lon: -3.994502 },
    { re: /^(chu\b.*treichville|centre.*hospitalier.*universitaire.*treichville)/i, nom: 'CHU de Treichville', quartier: 'Zone 3 (CHU)', commune: 'Treichville', lat: 5.293486, lon: -4.003767 },
    { re: /^(chu\b.*angr[eé]|centre.*hospitalier.*universitaire.*angr[eé])/i, nom: 'CHU d\'Angré', quartier: 'Angré', commune: 'Cocody', lat: 5.405000, lon: -3.978000 },
    { re: /^(pisam\b|p\.i\.s\.a\.m|polyclinique.*sainte.*anne.*marie|poly.*ste.*anne.*marie)/i, nom: 'PISAM (Polyclinique Sainte Anne-Marie)', quartier: 'Vieux Cocody', commune: 'Cocody', lat: 5.336512, lon: -4.013281 },
    { re: /^(farah\b|clinique.*farah)/i, nom: 'Clinique Farah', quartier: 'Marcory Residentiel', commune: 'Marcory', lat: 5.304000, lon: -3.987000 },
    { re: /^(hma\b|h\.m\.a|h[oô]pital.*militaire.*abidjan|h[oô]pital.*militaire)/i, nom: 'Hôpital Militaire d\'Abidjan (HMA)', quartier: 'Paillet', commune: 'Adjamé', lat: 5.381168, lon: -4.007937 },
    { re: /^(ica\b|i\.c\.a|institut.*de.*cardiologie)/i, nom: 'Institut de Cardiologie d\'Abidjan (ICA)', quartier: 'Zone 3 (CHU)', commune: 'Treichville', lat: 5.293007, lon: -4.005949 },
    { re: /^(hg\b.*yopougon|h[oô]pital.*g[eé]n[eé]ral.*yopougon|h[oô]pital.*g[eé]n[eé]ral.*atti[eé]|hg.*atti[eé])/i, nom: 'Hôpital Général de Yopougon-Attié', quartier: 'Attié', commune: 'Yopougon', lat: 5.342066, lon: -4.080122 },
    { re: /^(hg\b.*marcory|h[oô]pital.*g[eé]n[eé]ral.*marcory)/i, nom: 'Hôpital Général de Marcory', quartier: 'Marcory Centre', commune: 'Marcory', lat: 5.301297, lon: -3.983410 },
    { re: /^(chr\b.*abobo|h[oô]pital.*abobo|h[oô]pital.*g[eé]n[eé]ral.*abobo)/i, nom: 'CHR d\'Abobo', quartier: 'Abobo Nord', commune: 'Abobo', lat: 5.433023, lon: -4.038858 },
    { re: /^(hg\b.*koumassi|h[oô]pital.*g[eé]n[eé]ral.*koumassi)/i, nom: 'Hôpital Général de Koumassi', quartier: 'Koumassi Centre', commune: 'Koumassi', lat: 5.305600, lon: -3.953400 },
    { re: /^(hg\b.*port.*bou[eë]t|h[oô]pital.*g[eé]n[eé]ral.*port.*bou[eë]t)/i, nom: 'Hôpital Général de Port-Bouët', quartier: 'Port-Bouët Centre', commune: 'Port-Bouët', lat: 5.261200, lon: -3.948000 },
    { re: /^(hg\b.*adjam[eé]|h[oô]pital.*g[eé]n[eé]ral.*adjam[eé])/i, nom: 'Hôpital Général d\'Adjamé', quartier: 'Adjamé 220 Logements', commune: 'Adjamé', lat: 5.356200, lon: -4.026800 },
    { re: /^(hg\b.*bingerville|h[oô]pital.*g[eé]n[eé]ral.*bingerville)/i, nom: 'Hôpital Général de Bingerville', quartier: 'Bingerville', commune: 'Bingerville', lat: 5.358000, lon: -3.889000 },
    { re: /^(poly.*deux.*plateaux|poly.*2.*plateaux|polyclinique.*deux.*plateaux|polyclinique.*2.*plateaux)/i, nom: 'Polyclinique des Deux Plateaux', quartier: 'Deux Plateaux', commune: 'Cocody', lat: 5.362868, lon: -3.997261 },
    { re: /^(poly.*plateau\b|polyclinique.*plateau)/i, nom: 'Polyclinique du Plateau', quartier: 'Plateau', commune: 'Plateau', lat: 5.327500, lon: -4.021000 },
    { re: /^(clinique.*saint.*viateur|clinique.*st.*viateur)/i, nom: 'Clinique Saint Viateur', quartier: 'Palmeraie', commune: 'Cocody', lat: 5.372500, lon: -3.958000 },
    { re: /^(clinique.*les.*rosiers|clinique.*rosiers)/i, nom: 'Clinique Les Rosiers', quartier: 'Zone 4', commune: 'Marcory', lat: 5.292000, lon: -3.985000 },
    { re: /^(clinique.*danga|clinique.*m[eé]dicale.*danga)/i, nom: 'Clinique Médicale Danga', quartier: 'Danga', commune: 'Cocody', lat: 5.341200, lon: -4.008900 }
  ];

  function canonicaliserEtablissement(nomSaisi, quartierSaisi, communeSaisie) {
    var raw = String(nomSaisi || '').trim();
    if (!raw) return null;
    var norm = normaliser(raw);

    // 1. Dictionnaire canonique des grands centres de santé
    for (var i = 0; i < CANONICAL_HOPITAUX.length; i++) {
      var h = CANONICAL_HOPITAUX[i];
      if (h.re.test(raw) || h.re.test(norm)) {
        return { lieu: h.nom, quartier: h.quartier, commune: h.commune, lat: h.lat, lon: h.lon };
      }
    }

    // 2. Table de référence officielle des établissements de Côte d'Ivoire (175 établissements)
    if (typeof TABLE_REFERENCE_ETABLISSEMENTS_CI !== 'undefined') {
      if (TABLE_REFERENCE_ETABLISSEMENTS_CI[norm]) {
        var tr = TABLE_REFERENCE_ETABLISSEMENTS_CI[norm];
        return {
          lieu: tr.titre || raw,
          quartier: tr.quartier || quartierSaisi || '',
          commune: tr.commune || communeSaisie || '',
          lat: tr.lat || '',
          lon: tr.lon || ''
        };
      }
      var tKeys = Object.keys(TABLE_REFERENCE_ETABLISSEMENTS_CI);
      for (var k = 0; k < tKeys.length; k++) {
        var tk = tKeys[k];
        if (norm.length >= 4 && (tk === norm || (contientMot(tk, norm) && tk.length >= 5) || (contientMot(norm, tk) && tk.length >= 5))) {
          var trk = TABLE_REFERENCE_ETABLISSEMENTS_CI[tk];
          return {
            lieu: trk.titre || raw,
            quartier: trk.quartier || quartierSaisi || '',
            commune: trk.commune || communeSaisie || '',
            lat: trk.lat || '',
            lon: trk.lon || ''
          };
        }
      }
    }

    // 3. Établissements connus de la BDD (mutualisation pour éviter fautes & doublons)
    var connus = etablissementsConnus(), cleS = cleEtablissement(raw);   // 3.27.18 : « 2 Pltx » = « Deux-Plateaux »
    for (var j = 0; j < connus.length; j++) {
      var e = connus[j];
      var ne = normaliser(e.lieu);
      if (ne && (norm === ne || (cleS.length >= 5 && cleEtablissement(e.lieu) === cleS) || (norm.length >= 4 && (contientMot(norm, ne) || contientMot(ne, norm))))) {
        return {
          lieu: e.lieu,
          quartier: e.quartier || quartierSaisi || '',
          commune: e.commune || communeSaisie || '',
          lat: e.lat || '',
          lon: e.lon || ''
        };
      }
    }
    return null;
  }

  // 3.26.60 : « b » contenu dans « a » seulement si « b » fait au moins 6 lettres (évite « ica » trouvé dans « médical »)
  function contientMot(a, b) { a = String(a || ''); b = String(b || ''); return b.length >= 6 && a.indexOf(b) >= 0; }
  function trouverEtablissementBDD(nomSaisi, quartierSaisi, communeSaisie) {
    var raw = String(nomSaisi || '').trim();
    if (!raw || raw.length < 2) return null;
    var norm = normaliser(raw);

    // 1. Dictionnaire canonique et table de référence
    var can = canonicaliserEtablissement(raw, quartierSaisi, communeSaisie);
    if (can && can.quartier && !/^NL$/i.test(can.quartier)) return can;

    // 2. Établissements connus en BDD
    var connus = etablissementsConnus();
    for (var j = 0; j < connus.length; j++) {
      var e = connus[j];
      var ne = normaliser(e.lieu || '');
      if (ne && (ne === norm || (norm.length >= 4 && ne.length >= 4 && (contientMot(ne, norm) || contientMot(norm, ne))))) {
        if (e.quartier && !/^NL$/i.test(e.quartier)) {
          return {
            lieu: e.lieu,
            quartier: e.quartier,
            commune: e.commune || communeSaisie || '',
            lat: e.lat || '',
            lon: e.lon || ''
          };
        }
      }
    }

    // 3. Lieux réels de présence
    var pres = (S.data && S.data.presences) || [];
    for (var p = 0; p < pres.length; p++) {
      var pr = pres[p];
      var np = normaliser(pr.lieu || '');
      if (np && (np === norm || (norm.length >= 4 && np.length >= 4 && (contientMot(np, norm) || contientMot(norm, np))))) {
        if (pr.quartier && !/^NL$/i.test(pr.quartier)) {
          return {
            lieu: pr.lieu,
            quartier: pr.quartier,
            commune: pr.commune || communeSaisie || '',
            lat: pr.lat || '',
            lon: pr.lon || ''
          };
        }
      }
    }
    return null;
  }

  function etablissementsConnus() {
    var vus = {}, l = [];
    var pharCodes = {};
    ((S.data && S.data.praticiens) || []).forEach(function (p) {
      if (p.type === 'Pharmacie' || /^PHA-/i.test(p.code)) pharCodes[p.code] = true;
    });

    // 1. Établissements centralisés de la BDD (onglet Etablissements)
    ((S.data && S.data.etablissements) || []).forEach(function (et) {
      var nom = String(et.nom || '').trim(); if (!nom) return;
      var k = normaliser(nom);
      var la = parseFloat(String(et.lat || '').replace(',', '.')), lo = parseFloat(String(et.lon || '').replace(',', '.'));
      vus[k] = {
        code: et.code || '',
        lieu: nom,
        categorie: et.categorie || '',
        quartier: et.quartier || '',
        commune: et.commune || '',
        zone: et.zone || '',
        lat: isFinite(la) ? la : '',
        lon: isFinite(lo) ? lo : '',
        telephone: et.telephone || '',
        reperes: et.reperes || '',
        n: 0,
        txt: normaliser(nom + ' ' + (et.quartier || '') + ' ' + (et.commune || '') + ' ' + (et.categorie || ''))
      };
      l.push(vus[k]);
    });

    // 2. Pré-remplir avec les hôpitaux de référence si non déjà présents
    HOPITAUX_DEFAUT.forEach(function (h) {
      var k = normaliser(h.lieu);
      if (!vus[k]) {
        vus[k] = { code: '', lieu: h.lieu, categorie: 'Hôpital', quartier: h.quartier, commune: h.commune, lat: h.lat, lon: h.lon, n: 1, txt: normaliser(h.lieu + ' ' + h.quartier + ' ' + h.commune) };
        l.push(vus[k]);
      }
    });

    // 3. Compléter avec les présences réelles et compter le nombre de praticiens
    ((S.data && S.data.presences) || []).forEach(function (x) {
      var nom = String(x.lieu || '').trim(); if (!nom || /^NL$/i.test(nom)) return;
      if (pharCodes[x.code] || /^PHA-/i.test(x.code) || /^(pharmacie|phcie|grande pharmacie|nouvelle pharmacie)\b/i.test(nom)) return;
      var k = normaliser(nom), e = vus[k];
      if (!e) { e = vus[k] = { code: '', lieu: nom, categorie: '', quartier: '', commune: '', lat: '', lon: '', n: 0, txt: k }; l.push(e); }
      e.n++;
      if (!e.quartier && x.quartier && !/^NL$/i.test(x.quartier)) e.quartier = x.quartier;
      if (!e.commune && x.commune) e.commune = x.commune;
      var cx = lireCoord(x); if (!e.lat && cx) { e.lat = cx.lat; e.lon = cx.lon; }
    });
    l.forEach(function (e) { e.txt = normaliser(e.lieu + ' ' + (e.quartier || '') + ' ' + (e.commune || '') + ' ' + (e.categorie || '')); });
    return l;
  }
  function suggestionsLieu(q, i) {
    var t = normaliser(q || ''), mots = t ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    S.ui.sugLieux = S.ui.sugLieux || {}; S.ui.sugLieux[i] = [];
    var tous = etablissementsConnus();

    // 3.25.32 : Tri intelligent par proximité géographique (position GPS du délégué en priorité, sinon son quartier/secteur)
    var posRef = null;
    if (S.ui.posGps && isFinite(S.ui.posGps.lat) && S.ui.posGps.lat) {
      posRef = { lat: S.ui.posGps.lat, lon: S.ui.posGps.lon };
    } else if (S.user && S.user.quartier) {
      var rqU = quartiers().filter(function (x) { return x.quartier === S.user.quartier; })[0];
      if (rqU && isFinite(rqU.lat)) posRef = { lat: rqU.lat, lon: rqU.lon };
    }

    tous.forEach(function (e) {
      var coord = (isFinite(e.lat) && isFinite(e.lon) && e.lat) ? { lat: e.lat, lon: e.lon } : null;
      if (!coord && e.quartier) {
        var rq = quartiers().filter(function (x) { return x.quartier === e.quartier; })[0];
        if (rq && isFinite(rq.lat)) coord = { lat: rq.lat, lon: rq.lon };
      }
      e.dist = posRef && coord ? distanceKm(posRef, coord) : 999;
      var memeQuart = S.user && S.user.quartier && e.quartier === S.user.quartier;
      var memeCom = S.user && S.user.commune && e.commune === S.user.commune;
      e.scoreLoc = memeQuart ? 0 : (memeCom ? 1 : 2);
    });

    if (!mots.length) {
      var tri = tous.slice().sort(function (a, b) {
        if (posRef) return (a.dist - b.dist) || (b.n - a.n) || a.lieu.localeCompare(b.lieu, 'fr');
        return (a.scoreLoc - b.scoreLoc) || (b.n - a.n) || a.lieu.localeCompare(b.lieu, 'fr');
      }).slice(0, 5);
      S.ui.sugLieux[i] = tri;
      if (!tri.length) return '';
      var libTitre = posRef && S.ui.posGps ? '📍 Hôpitaux proches de votre position :' : (S.user && S.user.quartier ? 'Hôpitaux de votre secteur (' + esc(S.user.quartier) + ') :' : 'Hôpitaux fréquents :');
      return '<div class="discret" style="font-size:12px;margin:6px 0 4px;font-weight:700;color:var(--primaire)">' + libTitre + '</div>' +
        '<ul class="sug-liste">' + tri.map(function (e, k) {
          var distTxt = e.dist < 50 ? (e.dist < 1 ? Math.round(e.dist * 1000) + ' m' : km(e.dist)) : '';
          return '<li><button type="button" data-a="ficheChoixLieu" data-i="' + i + '" data-v="' + k + '"><b>' + esc(e.lieu) + '</b><small>' +
            esc([e.quartier, e.commune].filter(Boolean).join(', ') || 'Quartier non renseigné') + (distTxt ? ' · ' + distTxt : '') + ' · ' + (e.n ? e.n + ' praticien' + (e.n > 1 ? 's' : '') : 'Hôpital') + '</small></button></li>';
        }).join('') + '</ul>';
    }
    // Dès la 1re lettre tapée : suggestions interactives
    if (!t.length) return '';
    var l = tous.filter(function (e) { return mots.every(function (m) { return e.txt.indexOf(m) >= 0; }); });
    if (l.some(function (e) { return normaliser(e.lieu) === t; })) return '';
    var rang = function (e) {
      var n = normaliser(e.lieu);
      var r = (mots.every(function (m) { return n.indexOf(m) >= 0; }) ? 0 : 2) + (n.indexOf(mots[0]) === 0 ? 0 : 1);
      return r * 100 + (posRef && e.dist < 100 ? e.dist : e.scoreLoc * 10);
    };
    l.sort(function (a, b) { return rang(a) - rang(b) || (a.dist - b.dist) || (b.n - a.n) || a.lieu.localeCompare(b.lieu, 'fr'); });
    l = l.slice(0, 5); S.ui.sugLieux[i] = l;
    // 3.26.51 : quartiers dont le nom correspond aux lettres tapées, à choisir d'une touche (évite les fautes de frappe)
    var qs = mots.filter(function (m) { return m.length >= 3; }).length ? quartiers().filter(function (x) {
      var nq = normaliser(x.quartier + ' ' + x.commune); return mots.some(function (m) { return m.length >= 3 && nq.indexOf(m) >= 0; });
    }).slice(0, 6) : [];
    var puQ = qs.length ? '<div class="discret" style="font-size:12px;margin:6px 0 4px">Quartiers correspondants :</div><div class="puces">' + qs.map(function (x) {
      return '<button type="button" class="puce petite" data-a="ficheChoixQuartier" data-i="' + i + '" data-v="' + esc(x.quartier) + '">' + esc(x.quartier) + ' <small>' + esc(x.commune) + '</small></button>';
    }).join('') + '</div>' : '';
    if (!l.length) return '';
    return '<ul class="sug-liste">' + l.map(function (e, k) {
      var distTxt = e.dist < 50 ? (e.dist < 1 ? Math.round(e.dist * 1000) + ' m' : km(e.dist)) : '';
      return '<li><button type="button" data-a="ficheChoixLieu" data-i="' + i + '" data-v="' + k + '"><b>' + esc(e.lieu) + '</b><small>' +
        esc([e.quartier, e.commune].filter(Boolean).join(', ') || 'Quartier non renseigné') + (distTxt ? ' · ' + distTxt : '') + ' · ' + (e.n ? e.n + ' praticien' + (e.n > 1 ? 's' : '') : 'Hôpital') + '</small></button></li>';
    }).join('') + '</ul>';
  }
  function lieuVide(estPharma) {
    return { id: '', lieu: '', quartier: '', jours: [0, 1, 2, 3, 4].map(function () { return { matin: true, soir: true }; }),
             horaireMatin: REGLAGES_MOTEUR.horaireMatinDefaut, horaireSoir: REGLAGES_MOTEUR.horaireSoirDefaut, lat: '', lon: '' };
  }
  // 3.27.33 : origine d'une position relevée avec le téléphone (colonne OrigineGPS)
  function origineTerrain(prec) {
    var d = new Date();
    return 'Terrain' + (isFinite(prec) ? ' ± ' + Math.round(prec) + ' m' : '') + ', ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function brouillonFiche(code) {
    if (!code) {
      var l0 = lieuVide(false);
      if (S.ui.posGps && isFinite(S.ui.posGps.lat)) {
        var rq = Moteur.quartierLePlusProche(S.ui.posGps.lat, S.ui.posGps.lon, quartiers());
        if (rq && rq.quartier) {
          l0.quartier = rq.quartier.quartier;
          l0.commune = rq.quartier.commune;
          l0.lat = S.ui.posGps.lat;
          l0.lon = S.ui.posGps.lon;
          l0.prec = S.ui.posGps.prec;
          l0.origineGps = origineTerrain(S.ui.posGps.prec);
        }
      }
      return { code: '', type: 'Médecin', nom: '', telephone: '', specialite: '', autreSpec: '', note: 1, conventionne: 'Non', actif: 'Oui', lieux: [l0] };
    }
    var p = (S.data.praticiens || []).filter(function (x) { return x.code === code; })[0] || {};
    var estPh = p.type === 'Pharmacie' || /^PHA-/i.test(code);
    var lieux = fusionnerLieux((S.data.presences || []).filter(function (x) { return x.code === code; })).map(function (x) {
      var lieuVal = x.lieu || (estPh ? p.nom || '' : '');
      if (!estPh && lieuVal && normaliser(lieuVal) === normaliser(p.nom)) lieuVal = '';
      return { id: x.id, lieu: lieuVal, quartier: x.quartier || p.quartier || '', jours: JOURS_CLES.map(function (j) { return lireDispo(x[j]); }),
               horaireMatin: horaireNormalise(x.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut),
               horaireSoir: horaireNormalise(x.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut),
               lat: x.lat || p.lat || '', lon: x.lon || p.lon || '', commune: x.commune || p.commune || '', zone: x.zone || p.zone || '', reperes: x.reperes || '', origineGps: x.origineGps || '' };
    });
    if (!lieux.length) {
      var lDef = lieuVide(estPh);
      lDef.lieu = estPh ? (p.nom || '') : '';
      lDef.quartier = p.quartier || '';
      lDef.commune = p.commune || '';
      lDef.lat = p.lat || '';
      lDef.lon = p.lon || '';
      lDef.horaireMatin = horaireNormalise(p.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut);
      lDef.horaireSoir = horaireNormalise(p.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      lieux = [lDef];
    }
    return { code: code, type: estPh ? 'Pharmacie' : 'Médecin', nom: p.nom || '', telephone: String(p.telephone || ''),
             specialite: estPh ? 'Pharmacien' : (p.specialite || ''), autreSpec: '', note: lireNote(p.note), conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non',
             actif: p.actif === 'Non' ? 'Non' : 'Oui', absentDu: p.absentDu || '', absentAu: p.absentAu || '', lieux: lieux };
  }
  function horaireValide(t) {
    var m = String(t || '').match(/^\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*-\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*$/);
    if (!m) return false;
    var a = +m[1] * 60 + +(m[2] || 0), b = +m[3] * 60 + +(m[4] || 0);
    return +m[1] < 24 && +m[3] < 24 && a < b;
  }
  function synchroniserDefautsFiche(d) {
    if (!d.lieux || !d.lieux.length) d.lieux = [lieuVide(d.type === 'Pharmacie')];
    if (d.type === 'Pharmacie') {
      d.specialite = 'Pharmacien';
      if (String(d.nom || '').trim()) d.lieux[0].lieu = String(d.nom).trim();
      if (!d.lieux[0].jours.some(function (j) { return j.matin || j.soir; })) {
        d.lieux[0].jours = [0, 1, 2, 3, 4].map(function () { return { matin: true, soir: true }; });
      }
    } else {
      if (d.specialite === 'Pharmacien') d.specialite = '';
    }
    // Auto-récupération immédiate du quartier pour tout établissement déjà dans la BDD
    (d.lieux || []).forEach(function (l, idx) {
      if (d.type !== 'Pharmacie' && l && l.lieu && String(l.lieu).trim().length >= 2) {
        if (!l.quartier || /^NL$/i.test(l.quartier) || String(l.quartier).trim() === '') {
          var can = trouverEtablissementBDD(l.lieu, l.quartier, l.commune);
          if (can && can.quartier && !/^NL$/i.test(can.quartier)) {
            l.quartier = can.quartier;
            if (can.commune && !l.commune) l.commune = can.commune;
            if (can.lat && can.lon && !l.lat) { l.lat = can.lat; l.lon = can.lon; }
            if (S.ui && S.ui.feuille && S.ui.feuille.err) {
              delete S.ui.feuille.err['quartier' + idx];
              delete S.ui.feuille.err['lieu' + idx];
            }
          }
        }
      }
    });
  }
  // Erreurs d'une étape : { champ: message }
  function erreursEtape(d, etape) {
    synchroniserDefautsFiche(d);
    var e = {};
    if (etape === 0) {
      if (String(d.nom).trim().length < 2) e.nom = 'Indiquez le nom (2 caractères min.).';
      if (String(d.telephone).trim() && !normaliserNumero(d.telephone)) e.telephone = 'Numéro invalide (ex. 07 07 07 07 07).';
      if (d.type === 'Médecin') {
        if (!d.specialite) e.specialite = 'Choisissez une spécialité.';
        else if (d.specialite === '__autre' && String(d.autreSpec).trim().length < 2) e.autreSpec = 'Précisez la spécialité.';
      }
    }
    if (etape === 1) {
      if (!d.lieux || !d.lieux.length) e.lieux = 'Ajoutez au moins un lieu.';
      if (d.absentAu && !d.absentDu) e.absentDu = 'Indiquez le début de l\'absence.';
      if (d.absentDu && d.absentAu && d.absentAu < d.absentDu) e.absentAu = 'La fin doit suivre le début.';
      (d.lieux || []).forEach(function (l, i) {
        if (d.type === 'Pharmacie' && i === 0) l.lieu = String(d.nom).trim();
        if (String(l.lieu || '').trim().length < 2) e['lieu' + i] = 'Nom de l\'établissement requis.';
        if (!l.quartier || /^NL$/i.test(l.quartier) || String(l.quartier).trim() === '') e['quartier' + i] = 'Choisissez le quartier.';
        var m = l.jours && l.jours.some(function (j) { return j.matin; });
        var so = l.jours && l.jours.some(function (j) { return j.soir; });
        if (!m && !so) e['jours' + i] = 'Cochez au moins une demi-journée.';
        if (m) l.horaireMatin = horaireNormalise(l.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut);
        if (so) l.horaireSoir = horaireNormalise(l.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      });
    }
    return e;
  }
  function champFiche(cle, libelle, contenu, f, requis, aide) {
    var err = f.err[cle] || '';
    return '<div class="champ"><span class="' + (requis ? 'requis' : '') + '">' + (requis ? String(libelle).replace(/\s*\*\s*$/, '') : libelle) + '</span>' + contenu +
      (aide ? '<span class="aide-champ">' + aide + '</span>' : '') + '<span class="erreur" data-err="' + cle + '" id="err-' + cle + '">' + esc(err) + '</span></div>';
  }
  function attrInvalide(f, cle) { return (f.err[cle] ? ' aria-invalid="true"' : '') + ' aria-describedby="err-' + cle + '"'; }

  // 3.26.52 : deux choix : remettre la visite « à faire », ou la supprimer complètement de la journée
  FEUILLES.effacerVisite = function (f) {
    var a = arret(f.uid) || {};
    return { corps: '<p style="margin-top:0">Compte rendu de <b>' + esc(a.nom || '') + '</b> : que voulez-vous faire ?</p>',
      pied: '<button class="bouton" type="button" data-a="effacerVisiteChoix" data-v="refaire">Remettre « à faire »</button>' +
        '<button class="bouton" type="button" data-a="effacerVisiteChoix" data-v="supprimer">Supprimer</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="fermerFeuille" data-defaut="1">Non</button>' };   // 3.28.42 : Non à droite, par défaut
  };
  // 3.27.1 : fiche repensée. Ajout : on cherche d'abord la personne rencontrée (doublons), puis
  // 1. Où et quand (semaine type : tous les lieux sur une seule semaine) et 2. Qui (carte de visite).
  var COULEURS_LIEUX = ['#1B7448', '#1E5AA8', '#6A3FA0', '#B4580A', '#B03A7A', '#0A6C74', '#7A5230', '#3B4BA8', '#5E6B1F', '#4A5A66'];   // 3.27.16 : mêmes couleurs que le Répertoire
  function etablissementsConnusProches(pos, rayonKm) {
    var vus = {}, res = [];
    function ajouter(nom, quartier, commune, lat, lon) {
      var k = normaliser(nom || ''); if (!k || vus[k]) return;
      var c = lireCoord({ lat: lat, lon: lon }); if (!c) return;
      var dKm = distanceKm(pos, c) / REGLAGES_MOTEUR.detourRoutier;
      if (dKm > rayonKm) return;
      vus[k] = true; res.push({ lieu: nom, quartier: quartier || '', commune: commune || '', lat: c.lat, lon: c.lon, m: Math.round(dKm * 1000) });
    }
    var pr = (S.data && S.data.praticiens) || [], estPhC = {};
    pr.forEach(function (p) { if (p.type === 'Pharmacie') estPhC[p.code] = true; });
    ((S.data && S.data.presences) || []).forEach(function (x) { if (!estPhC[x.code]) ajouter(x.lieu, x.quartier, x.commune, x.lat, x.lon); });
    if (typeof TABLE_REFERENCE_ETABLISSEMENTS_CI !== 'undefined') Object.keys(TABLE_REFERENCE_ETABLISSEMENTS_CI).forEach(function (k) {
      var t = TABLE_REFERENCE_ETABLISSEMENTS_CI[k]; ajouter(t.titre, t.quartier, t.commune, t.lat, t.lon);
    });
    return res.sort(function (a, b) { return a.m - b.m; });
  }
  function pharmaciesConnuesProches(pos, rayonKm) {
    var res = [], c = ctx();
    ((S.data && S.data.praticiens) || []).forEach(function (p) {
      if (p.type !== 'Pharmacie') return;
      var pr = (c.presencesParCode[p.code] || [])[0], co = pr && lireCoord(pr); if (!co) return;
      var dKm = distanceKm(pos, co) / REGLAGES_MOTEUR.detourRoutier;
      if (dKm <= rayonKm) res.push({ p: p, pr: pr, m: Math.round(dKm * 1000) });
    });
    return res.sort(function (a, b) { return a.m - b.m; }).slice(0, 4);
  }
  // créneaux cochés dans plusieurs lieux : { 'j|matin': [i, k] }
  function conflitsLieux(d) {
    var par = {}, conf = {};
    (d.lieux || []).forEach(function (l, i) { (l.jours || []).forEach(function (j, k) { ['matin', 'soir'].forEach(function (c) { if (j[c]) (par[k + '|' + c] = par[k + '|' + c] || []).push(i); }); }); });
    Object.keys(par).forEach(function (x) { if (par[x].length > 1) conf[x] = par[x]; });
    return conf;
  }
  // 3.27.4 : « Dr » ajouté si le nom du médecin n'a pas de titre ; « Pharmacie » si le nom de l'officine ne le dit pas
  function nomAvecTitre(nom, type) {
    var n = String(nom || '').trim().replace(/\s+/g, ' '); if (n.length < 2) return n;
    if (type === 'Pharmacie') {
      if (/^(pharmacie|phcie|pharma)\b\.?\s*/i.test(n)) return n.replace(/^(pharmacie|phcie|pharma)\b\.?\s*/i, 'Pharmacie ').trim();
      return 'Pharmacie ' + n;
    }
    if (/^(ide|sag|sf|inf)\b/i.test(n)) return n;   // 3.27.19 : infirmiers (IDE) et sages-femmes (SAG) gardent leur titre
    var m = n.match(/^(docteur|dr|pr|professeur|prof)\b\.?\s*/i);
    if (m) { var t = /^d/i.test(m[1]) ? 'Dr' : 'Pr'; return (t + ' ' + n.slice(m[0].length)).trim(); }
    return 'Dr ' + n;
  }
  // repères et GPS déjà connus pour un établissement (autres praticiens du même lieu)
  function infosLieuBase(nom) {
    var k = normaliser(nom || ''), r = { reperes: '', lat: '', lon: '' }; if (!k) return r;
    ((S.data && S.data.presences) || []).forEach(function (x) {
      if (normaliser(x.lieu || '') !== k) return;
      if (!r.reperes && x.reperes) r.reperes = x.reperes;
      if (!r.lat && aCoord(x)) { var c = lireCoord(x); r.lat = c.lat; r.lon = c.lon; }
    });
    return r;
  }
  function nomCreer(d) { var n = nomAvecTitre(d.nom, d.type); return n ? '« ' + n + ' »' : (d.type === 'Pharmacie' ? 'cette pharmacie' : 'ce médecin'); }

  FEUILLES.fiche = function (f) {
    var d = f.d, seulPlanning = !!f.planningSeul;
    synchroniserDefautsFiche(d);
    var estPh = d.type === 'Pharmacie', existante = d.code && !/^TMP-/.test(d.code);
    if (!seulPlanning) f.titre = f.cherche ? 'Nouveau contact' : (String(d.nom || '').trim() || (estPh ? 'Nouvelle pharmacie' : 'Nouveau médecin'));
    var h = '';

    // ---- Ajout : chercher avant de créer
    if (f.cherche) {
      h += '<div class="segment" role="group" aria-label="Type">' + ['Médecin', 'Pharmacie'].map(function (t) {
        return '<button type="button" data-a="ficheVal" data-k="type" data-v="' + t + '" aria-pressed="' + (d.type === t) + '">' + t + '</button>';
      }).join('') + '</div>';
      var g = gpsFrais();
      if (estPh && g) {
        var proches = pharmaciesConnuesProches(g, 0.5);
        h += '<div class="fx-radar"><div class="fx-radar-t"><span>Pharmacies connues autour de vous</span><span>± ' + g.prec + ' m</span></div>' +
          (proches.length ? proches.map(function (x) {
            return '<button type="button" class="fx-ph" data-a="ouvrirDoublon" data-v="' + esc(x.p.code) + '"><span>' + nomPrat(x.p) + '<small>' + esc([x.pr.quartier, x.pr.reperes].filter(Boolean).join(', ')) + '</small></span>' +
              '<span class="fx-ph-d">' + distMoi(x.m / 1000 * REGLAGES_MOTEUR.detourRoutier).replace(/^≈ /, '≈ ') + '<small>Ouvrir</small></span></button>';
          }).join('') : '<p class="discret" style="margin:0">Aucune pharmacie connue à moins de 500 m.</p>') + '</div>';
      }
      h += '<p class="fx-question">' + (estPh ? 'Quelle pharmacie ?' : 'Qui avez-vous rencontré ?') + '</p>' +
        champFiche('nom', estPh ? 'Nom de la pharmacie' : 'Nom du médecin', '<input type="text" class="fx-champ-g" data-f="fiche" data-k="nom" autocomplete="off" value="' + esc(d.nom) + '" placeholder="' + (estPh ? 'Ex. Pharmacie des Lagunes' : 'Ex. Dr Kouassi Aya') + '"' + attrInvalide(f, 'nom') + '>', f, false) +
        '<div id="doublonsFiche">' + rendreDoublonsFiche(d) + '</div>' +
        '<button type="button" class="fx-creer" data-a="ficheCreer"><span class="fx-plus">' + icone('plus') + '</span><span><b>Créer <span id="ficheCreerNom">' + esc(nomCreer(d)) + '</span></b><small>' +
          (estPh ? 'Position et horaires ensuite' : 'Vous compléterez le lieu et les jours ensuite') + '</small></span></button>';
      return { corps: h };
    }

    // 3.27.4 : ajout : 1. Qui (ouvert d'abord), 2. Où et quand ; modification : 1. Où et quand, 2. Qui
    var libQui = estPh ? 'Pharmacie' : 'Qui', etQui = { v: 0, lib: libQui }, etOu = { v: 1, lib: 'Où et quand' };
    var ordre = f.nouveau ? [etQui, etOu] : [etOu, etQui];
    if (!seulPlanning) h += '<div class="segment" role="group" aria-label="Étapes">' + ordre.map(function (x, n) {
      return '<button type="button" data-a="ficheAller" data-v="' + x.v + '" aria-pressed="' + (f.etape === x.v) + '">' + (n + 1) + '. ' + x.lib + '</button>';
    }).join('') + '</div>';
    if (seulPlanning) f.etape = 1;

    if (f.etape === 1) h += ficheOuEtQuand(f, d, estPh);
    else h += ficheQui(f, d, estPh, existante);
    var pos = ordre[0].v === f.etape ? 0 : 1, autre = ordre[1 - pos];
    var pied = '<button class="bouton-texte sortir-question" type="button" data-a="fermerFeuille">Annuler</button>';
    if (seulPlanning) pied += '<button class="bouton bouton-plein" type="button" data-a="ficheEnregistrer">' + icone('valider') + 'Enregistrer</button>';
    else if (f.nouveau && pos === 0) pied += '<button class="bouton bouton-plein" type="button" data-a="ficheSuivant" data-v="' + autre.v + '">Suivant : ' + autre.lib + '</button>';
    else pied += '<button class="bouton" type="button" data-a="ficheAller" data-v="' + autre.v + '">' + (pos === 0 ? autre.lib + ' →' : '← ' + autre.lib) + '</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="ficheEnregistrer">' + icone('valider') + 'Enregistrer</button>';
    return { corps: h, pied: pied };
  };

  function grilleSemaine(f, d, idx, couleur, conf) {
    var l = d.lieux[idx];
    var tousM = l.jours.every(function (j) { return j.matin; }), tousS = l.jours.every(function (j) { return j.soir; });
    return '<div class="fx-sem" role="group" aria-label="Présences du lieu ' + (idx + 1) + '"><button type="button" class="fx-ms" data-a="ficheJoursTous" data-i="' + idx + '" data-c="matin" aria-pressed="' + tousM + '" title="Tous les matins">M</button>' +
      JOURS.map(function (j, k) {
        var on = l.jours[k].matin, cf = conf[k + '|matin'] && on;
        return '<button type="button" class="fx-c' + (on ? ' on' : '') + (cf ? ' conf' : '') + '" style="' + (on ? '--c:' + couleur : '') + '" data-a="ficheJour" data-i="' + idx + '" data-j="' + k + '" data-c="matin" aria-pressed="' + on + '" aria-label="' + j + ' matin">' + (on ? 'Oui' : '') + '</button>';
      }).join('') + '<button type="button" class="fx-ms" data-a="ficheJoursTous" data-i="' + idx + '" data-c="soir" aria-pressed="' + tousS + '" title="Tous les soirs">S</button>' +
      JOURS.map(function (j, k) {
        var on = l.jours[k].soir, cf = conf[k + '|soir'] && on;
        return '<button type="button" class="fx-c' + (on ? ' on' : '') + (cf ? ' conf' : '') + '" style="' + (on ? '--c:' + couleur : '') + '" data-a="ficheJour" data-i="' + idx + '" data-j="' + k + '" data-c="soir" aria-pressed="' + on + '" aria-label="' + j + ' soir">' + (on ? 'Oui' : '') + '</button>';
      }).join('') + '</div>' +
      '<span class="erreur" data-err="jours' + idx + '">' + esc(f.err['jours' + idx] || '') + '</span>';
  }
  function horairesLieu(f, l, i) {
    var m = l.jours.some(function (j) { return j.matin; }), so = l.jours.some(function (j) { return j.soir; });
    return '<div class="grille-2 serre fx-hor">' +
      champFiche('hm' + i, 'Horaire du matin', '<input type="text" data-f="fiche" data-k="horaireMatin" data-i="' + i + '" value="' + esc(l.horaireMatin) + '"' + (m ? '' : ' disabled') + attrInvalide(f, 'hm' + i) + '>', f, false) +
      champFiche('hs' + i, 'Horaire du soir', '<input type="text" data-f="fiche" data-k="horaireSoir" data-i="' + i + '" value="' + esc(l.horaireSoir) + '"' + (so ? '' : ' disabled') + attrInvalide(f, 'hs' + i) + '>', f, false) + '</div>';
  }
  function champsLieu(f, d, l, i) {
    return champFiche('lieu' + i, (i === 0 ? 'Nom de l\'hôpital ou clinique *' : 'Établissement ou cabinet *'), '<div class="champ-avec-gps"><input type="text" data-f="fiche" data-k="lieu" data-i="' + i + '" value="' + esc(normaliser(l.lieu) === normaliser(d.nom) ? '' : (l.lieu || '')) + '" placeholder="Tapez les premières lettres de l\'hôpital…"' + attrInvalide(f, 'lieu' + i) + ' autocomplete="off">' +
        '<button type="button" class="btn-gps-champ ' + (aCoord(l) ? 'gps-ok' : 'gps-non') + '" data-a="ficheGps" data-i="' + i + '" title="' + (aCoord(l) ? 'GPS enregistré : toucher pour reprendre la position ici' : 'Pas de GPS : toucher pour prendre la position ici') + '" aria-label="GPS du lieu">' + icone('cible') + '</button></div>', f, true) +
      '<div class="sug-lieux" id="sugLieu' + i + '">' + suggestionsLieu(l.lieu, i) + '</div>' +
      '<div class="grille-2 serre">' + champQuartier(f, l, i) +
      champFiche('rep' + i, 'Repères', '<input type="text" data-f="fiche" data-k="reperes" data-i="' + i + '" placeholder="Rue, carrefour…" value="' + esc(l.reperes || '') + '">', f, false) + '</div>';
  }
  function champQuartier(f, l, i, avecCommune) {
    var q = avecCommune ? quartiers().filter(function (x) { return x.quartier === l.quartier; })[0] : null;
    return champFiche('quartier' + i, 'Quartier *', selecteurListe('ficheQuartier' + i, { titre: 'Quartier', valeur: l.quartier, vide: 'Choisir…', invalide: !!f.err['quartier' + i], sections: sectionsQuartiers(),
      appliquer: function (v) { var fe = S.ui.feuille; if (fe && fe.type === 'fiche') { fe.d.lieux[i].quartier = v; delete fe.err['quartier' + i]; } } }), f, true, q ? 'Commune : ' + esc(q.commune) : '');
  }
  function ficheOuEtQuand(f, d, estPh) {
    var h = '', g = gpsFrais(), l0 = d.lieux[0];
    if (f.err.lieux) h += '<p class="erreur-texte">' + esc(f.err.lieux) + '</p>';
    if (!d.code) h += '<div id="presentsIci">' + rendrePresentsIci(d) + '</div>';   // 3.27.28
    if (estPh) {
      h += '<div class="fx-carte"><div class="fx-carte-t"><b>Localisation de l\'officine</b>' +
          (aCoord(l0) ? '<span class="fx-tag ok">' + icone('cible') + 'GPS' + (l0.prec ? ' ± ' + l0.prec + ' m' : '') + '</span>' : '<span class="fx-tag">Pas de GPS</span>') + '</div>' +
        '<button type="button" class="bouton petit fx-gps" data-a="ficheGps" data-i="0">' + icone('cible') + (aCoord(l0) ? 'Reprendre la position ici' : 'Je suis devant : prendre la position') + '</button>' +
        (aCoord(l0) ? '<p class="discret" style="margin:0 0 6px">GPS : <b>' + lireCoord(l0).lat.toFixed(6) + ', ' + lireCoord(l0).lon.toFixed(6) + '</b>' + (l0.origineGps ? ' <span class="discret">(' + esc(/^terrain/i.test(l0.origineGps) ? 'relevé terrain' : l0.origineGps) + ')</span>' : '') + ' <button type="button" class="bouton-texte" data-a="ficheGpsEffacer" data-i="0" aria-label="Effacer le GPS">✕</button></p>' : '') +
        champQuartier(f, l0, 0, true) +
        champFiche('rep0', 'Repères', '<input type="text" data-f="fiche" data-k="reperes" data-i="0" placeholder="Immeuble, carrefour…" value="' + esc(l0.reperes || '') + '">', f, false) + '</div>' +
        '<div class="fx-carte"><div class="fx-carte-t"><b>Reçoit les délégués</b><small>Touchez une case</small></div>' +
        '<div class="fx-jours"><span></span>' + JOURS.map(function (j) { return '<span>' + j.slice(0, 3) + '</span>'; }).join('') + '</div>' +
        grilleSemaine(f, d, 0, COULEURS_LIEUX[0], {}) + horairesLieu(f, l0, 0) + '</div>';
      return h;
    }
    // Suggestion « C'est ici » : établissement connu à moins de 150 m d'une position fiable
    var lieuVideIdx = d.lieux.map(function (l) { return String(l.lieu || '').trim().length < 2; }).indexOf(true);
    if (g && g.prec <= 100 && lieuVideIdx >= 0) {
      var deja = ensemble(d.lieux.map(function (l) { return normaliser(l.lieu || ''); }));
      var sug = etablissementsConnusProches(g, 0.15).filter(function (e) { return !deja[normaliser(e.lieu)] && normaliser(e.lieu) !== f.iciRefuse; })[0];
      if (sug) { f.ici = sug; h += '<div class="fx-ici"><p>Vous êtes à ' + (sug.m < 30 ? 'quelques mètres' : sug.m + ' m') + ' de<b>' + esc(sug.lieu) + '</b></p><div class="fx-ici-r">' +
        '<button type="button" class="bouton fx-ici-oui" data-a="ficheIci">C\'est ici</button><button type="button" class="bouton fx-ici-non" data-a="ficheIciNon">Autre lieu</button></div></div>'; }
      else f.ici = null;
    }
    var conf = conflitsLieux(d), ouvert = typeof f.lieuOuvert === 'number' ? f.lieuOuvert : -1;
    if (ouvert >= d.lieux.length) ouvert = -1;
    h += '<div class="fx-carte"><div class="fx-carte-t"><b>Semaine type</b><small>Touchez une case pour Oui</small></div>' +
      '<div class="fx-jours"><span></span>' + JOURS.map(function (j) { return '<span>' + j.slice(0, 3) + '</span>'; }).join('') + '</div>';
    d.lieux.forEach(function (l, i) {
      var coul = COULEURS_LIEUX[i % COULEURS_LIEUX.length], vide = String(l.lieu || '').trim().length < 2, estOuvert = i === ouvert || (vide && ouvert < 0) || !!(f.err['lieu' + i] || f.err['quartier' + i] || f.err['hm' + i] || f.err['hs' + i]);
      h += '<div class="fx-lieu">' +
        '<button type="button" class="fx-lieu-n" data-a="' + (estOuvert ? 'ficheReplierLieu' : 'ficheOuvrirLieu') + '" data-i="' + i + '" aria-expanded="' + estOuvert + '">' +
          '<span class="fx-pt" style="background:' + coul + '"></span><b>' + esc(vide ? 'Lieu ' + (i + 1) + ' à renseigner' : abregerHopital(l.lieu)) + '</b><small>' + esc(l.quartier || '') + '</small>' + icone('chevron') + '</button>' +
        grilleSemaine(f, d, i, coul, conf);
      var resume = f.planningSeul && !vide && l.quartier && !f.err['lieu' + i] && !f.err['quartier' + i];
      if (estOuvert) h += '<div class="fx-detail">' + (resume ? '<p class="discret" style="margin:0 0 4px"><b>' + esc(l.lieu) + '</b> · ' + esc([l.quartier, l.commune].filter(Boolean).join(', ')) + '</p>' : champsLieu(f, d, l, i)) + horairesLieu(f, l, i) +
        (d.lieux.length > 1 ? '<button type="button" class="bouton-texte" data-a="ficheRetirerLieu" data-i="' + i + '">Retirer ce lieu</button>' : '') + '</div>';
      else h += '<p class="fx-hor-r">Matin ' + esc(l.horaireMatin) + ', soir ' + esc(l.horaireSoir) + '</p>';
      h += '</div>';
    });
    var nc = Object.keys(conf);
    if (nc.length) h += '<p class="fx-alerte">' + esc(nc.map(function (x) { var p = x.split('|'); return JOURS[+p[0]] + ' ' + p[1]; }).join(', ')) + ' : plusieurs lieux cochés. Gardez-en un.</p>';
    h += '</div>';
    var absOuv = f.voirAbsence || d.absentDu || d.absentAu;
    h += '<div class="rangee rangee-2-fiche"><button class="bouton petit fx-ajl" type="button" data-a="ficheAjouterLieu">' + icone('plus') + 'Ajouter un lieu</button>' +
      '<button class="bouton petit" type="button" data-a="ficheAbsence" aria-pressed="' + !!absOuv + '">' + icone('calendrier') + 'Absence' + (d.absentDu ? ' ✓' : '') + '</button></div>';
    if (absOuv) h += '<div class="fx-carte" style="margin-top:8px"><div class="grille-2 serre">' +
      champFiche('absentDu', 'Absent du', '<input type="date" data-f="fiche" data-k="absentDu" value="' + esc(d.absentDu || '') + '"' + attrInvalide(f, 'absentDu') + '>', f, false) +
      champFiche('absentAu', 'Au', '<input type="date" data-f="fiche" data-k="absentAu" value="' + esc(d.absentAu || '') + '"' + attrInvalide(f, 'absentAu') + '>', f, false) + '</div></div>';
    return h;
  }
  function ficheQui(f, d, estPh, existante) {
    var h = champFiche('nom', estPh ? 'Nom de la pharmacie *' : 'Nom du médecin *', '<input type="text" class="fx-nom" data-f="fiche" data-k="nom" autocomplete="off" value="' + esc(d.nom) + '"' + attrInvalide(f, 'nom') + '>', f, true) +
      '<div id="doublonsFiche">' + rendreDoublonsFiche(d) + '</div>';
    if (!estPh) {
      var coeur = coeurDeCible(), specs = specialitesListe().map(function (x) { return x.nom; }).filter(function (x) { return x !== 'Pharmacien'; });
      SPECIALITES_DEFAUT.forEach(function (x) { if (x !== 'Pharmacien' && specs.indexOf(x) < 0) specs.push(x); });
      specs.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
      if (d.specialite && d.specialite !== '__autre' && specs.indexOf(d.specialite) < 0) specs.unshift(d.specialite);
      var CHIR = ['Chirurgien', 'Urologue', 'ORL'], horsCoeur = d.specialite && coeur.indexOf(d.specialite) < 0;
      var specMed = specs.filter(function (s) { return coeur.indexOf(s) < 0 && CHIR.indexOf(s) < 0; }), specChir = specs.filter(function (s) { return CHIR.indexOf(s) >= 0; });
      var tuiles = function (l, court) { return '<div class="fx-specs">' + l.map(function (s) {
          return '<button type="button" data-a="ficheSpecRapide" data-v="' + esc(s) + '" aria-pressed="' + (d.specialite === s) + '">' + esc(court ? abrSpec(s) : s) + '</button>';
        }).join('') + '</div>'; };
      var deplie = !!f.voirSpecs;   // 3.27.5 : jamais déplié d'office
      h += '<div class="champ"><span class="requis">Spécialité</span>' + tuiles(coeur, true) +
        '<button type="button" class="fx-plus-specs" data-a="ficheVoirSpecs" aria-expanded="' + !!deplie + '"><span>Autres spécialités' + (horsCoeur && d.specialite !== '__autre' ? ' : <b>' + esc(abrSpec(d.specialite)) + '</b>' : '') + '</span>' + icone('chevron') + '</button>' +
        (deplie ? '<div class="fx-specs-plus"><p class="fx-sous">Spécialités médicales</p>' + tuiles(specMed, true) +
          '<p class="fx-sous">Chirurgie & autres</p>' + tuiles(specChir.concat(['__autre']), false).replace('>__autre<', '>Autre…<') + '</div>' : '') +
        '<span class="erreur" data-err="specialite" id="err-specialite">' + esc(f.err.specialite || '') + '</span></div>';
      if (d.specialite === '__autre') h += champFiche('autreSpec', 'Autre spécialité *', '<input type="text" data-f="fiche" data-k="autreSpec" value="' + esc(d.autreSpec) + '"' + attrInvalide(f, 'autreSpec') + '>', f, true);
    }
    h += '<div class="champ"><span class="requis">Potentiel</span><div class="fx-pot">' + [3, 2, 1].map(function (n) {
        var l = lettrePotentiel(n);
        return '<button type="button" data-a="ficheVal" data-k="note" data-v="' + n + '" aria-pressed="' + (+d.note === n) + '"><b>' + ETOILES[l] + '</b><small>' + esc(LIB_POTENTIEL[l].charAt(0).toUpperCase() + LIB_POTENTIEL[l].slice(1)) + '</small></button>';
      }).join('') + '</div></div>' +
      '<div class="champ"><span>' + (estPh ? 'Partenariat / commande engagée' : 'Prescription engagée') + '</span><div class="fx-duo">' + ['Oui', 'Non'].map(function (v) {
        return '<button type="button" data-a="ficheVal" data-k="conventionne" data-v="' + v + '" aria-pressed="' + ((d.conventionne === 'Oui') === (v === 'Oui')) + '">' + v + '</button>';
      }).join('') + '</div></div>';
    var telOk = normaliserNumero(d.telephone);
    h += champFiche('telephone', 'Téléphone', '<div class="fx-tel"><input type="tel" inputmode="tel" data-f="fiche" data-k="telephone" value="' + esc(d.telephone) + '" placeholder="07 07 07 07 07"' + attrInvalide(f, 'telephone') + '>' +
      (telOk ? '<a class="fx-appel" href="tel:+' + esc(telOk) + '" aria-label="Appeler">' + icone('tel') + '</a>' : '') + '</div>', f, false);
    if (d.code) h += '<label class="interrupteur fx-actif"><span>Actif dans le répertoire</span><input type="checkbox" data-f="fiche" data-k="actif"' + (d.actif !== 'Non' ? ' checked' : '') + '></label>';
    return h;
  }

  // Applique une fiche aux données locales (affichage immédiat, même hors ligne)
  function appliquerFiche(pr, pres) {
    if (!S.data) return;
    var ex = S.data.praticiens.filter(function (x) { return x.code === pr.code; })[0];
    if (ex) Object.keys(pr).forEach(function (k) { ex[k] = pr[k]; });
    else S.data.praticiens.push(Object.assign({ derniere: '', statut: '', commentaire: '', nbVisites: 0 }, pr));
    S.data.presences = S.data.presences.filter(function (x) { return x.code !== pr.code; }).concat(pres.map(function (x) { return Object.assign({}, x); }));
    ctxCache.data = null;
  }
  function enregistrerFiche(d) {
    synchroniserDefautsFiche(d);
    // 3.25.34 : Vérification et normalisation officielle des hôpitaux pour éviter fautes et doublons en BDD
    if (d.type !== 'Pharmacie' && Array.isArray(d.lieux)) {
      d.lieux.forEach(function (l) {
        var can = canonicaliserEtablissement(l.lieu, l.quartier, l.commune);
        if (can) {
          l.lieu = can.lieu;
          if (!l.quartier || /^NL$/i.test(l.quartier)) l.quartier = can.quartier;
          if (!l.commune || /^NL$/i.test(l.commune)) l.commune = can.commune;
          if ((!l.lat || /^NL$/i.test(l.lat)) && can.lat) { l.lat = can.lat; l.lon = can.lon; l.origineGps = ''; }
        }
      });
    }
    // 3.27.28 : le même établissement saisi deux fois sur la fiche devient un seul lieu (jours cumulés)
    if (d.type !== 'Pharmacie' && Array.isArray(d.lieux) && d.lieux.length > 1) {
      var memeLieuFiche = function (a, b) { var na = normaliser(a), nb = normaliser(b); if (!na || !nb) return false; if (na === nb) return true; var ca = cleEtablissement(a); return ca.length >= 5 && ca === cleEtablissement(b); };
      var garde = [];
      d.lieux.forEach(function (l) {
        var g = garde.filter(function (x) { return memeLieuFiche(x.lieu, l.lieu); })[0];
        if (!g) { garde.push(l); return; }
        (l.jours || []).forEach(function (j, k) { if (!g.jours[k]) g.jours[k] = { matin: false, soir: false }; g.jours[k].matin = g.jours[k].matin || j.matin; g.jours[k].soir = g.jours[k].soir || j.soir; });
        if ((!g.id || /^TMP/.test(String(g.id))) && l.id && !/^TMP/.test(String(l.id))) g.id = l.id;
        ['quartier', 'commune', 'reperes', 'lat', 'lon', 'origineGps', 'horaireMatin', 'horaireSoir'].forEach(function (k) { if (!g[k] && l[k]) g[k] = l[k]; });
      });
      if (garde.length < d.lieux.length) { d.lieux = garde; toast('Établissement saisi deux fois : regroupé en un seul lieu.'); }
    }
    // 3.25.23 : évite de recréer un 2e code TMP si la même fiche locale est déjà en file d'attente
    var code = d.code;
    if (!code && S.data && S.data.praticiens) {
      var existTmp = S.data.praticiens.filter(function (x) { return /^TMP-/.test(x.code) && x.type === d.type && nomCleDoublon(x.nom) === nomCleDoublon(d.nom); })[0];
      if (existTmp) code = existTmp.code;
    }
    if (!code) code = 'TMP-' + Date.now().toString(36).toUpperCase();
    var telFmt = formaterTelephoneCI(d.telephone);
    if (telFmt) d.telephone = telFmt;
    var pr = { code: code, type: d.type, nom: String(d.nom).trim(), telephone: telFmt || String(d.telephone || '').trim(),
               specialite: d.type === 'Pharmacie' ? 'Pharmacien' : (d.specialite === '__autre' ? String(d.autreSpec).trim() : d.specialite),
               note: +d.note, conventionne: d.conventionne, actif: d.actif === 'Non' ? 'Non' : 'Oui',
               absentDu: d.absentDu || '', absentAu: d.absentAu || '' };
    var idsVus = {};   // 3.26.50 : deux lieux ne partagent jamais le même identifiant
    var pres = d.lieux.map(function (l) {
      var q = quartiers().filter(function (x) { return x.quartier === l.quartier; })[0] || {};
      if (l.id && idsVus[String(l.id)]) l.id = ''; if (l.id) idsVus[String(l.id)] = true;
      var o = { id: l.id || 'TMP' + Math.random().toString(36).slice(2, 8), code: code, nom: pr.nom, lieu: String(l.lieu).trim(), quartier: l.quartier,
                commune: q.commune || l.commune || '', zone: q.zone || l.zone || '', horaireMatin: String(l.horaireMatin || '').trim(), horaireSoir: String(l.horaireSoir || '').trim(),
                lat: l.lat || '', lon: l.lon || '', reperes: String(l.reperes || '').trim(), origineGps: l.lat ? String(l.origineGps || '') : '' };
      JOURS_CLES.forEach(function (j, k) { o[j] = ecrireDispo(l.jours[k]); });
      return o;
    });
    appliquerFiche(pr, pres);
    if (!S.config.demo) {
      S.fiches = S.fiches.filter(function (f) { return f.praticien.code !== code; }).concat([{ praticien: pr, presences: pres }]);
    }
    sauver();
    return code;
  }

