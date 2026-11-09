  VUES.autour = function () {
    var A = S.ui.autour, h = '<button type="button" class="retour" data-a="nav" data-tab="jour">' + icone('chevron') + 'Journée</button>' +
      '<h2 class="titre-vue">' + (A.ref ? 'Rattraper une visite' : S.ui.pharmaciesProches ? (S.ui.pharmaciesProches === 'Médecin' ? 'Médecins' : 'Pharmacies') + ' à proximité' : 'Autour de moi') + '</h2>' +
      '<p class="sous-titre">' + (A.ref ? 'Trouvez un praticien présent à proximité pour remplacer la visite annulée ou compléter votre journée.' : S.ui.pharmaciesProches === 'Médecin' ? 'Les médecins présents près de votre position, selon vos spécialités, à ajouter à votre tournée du jour.' : S.ui.pharmaciesProches ? 'Les pharmacies ouvertes près de votre position, à ajouter à votre tournée du jour.' : 'Médecin absent, trou dans la journée : trouvez qui est présent près de vous.') + '</p>';
    if (A.ref) {
      h += '<div class="bandeau"><p>Remplacement de <b>' + esc(A.ref.nom) + '</b> (' + esc(A.ref.heure) + ', ' + esc(A.ref.quartier) +
        '), marqué « Absent ». <button type="button" class="bouton-texte" data-a="finRef">Terminer</button></p></div>';
    }
    // 3.25.1 : recherche libre en tête, sans critère à choisir (nom, spécialité, établissement, quartier, commune), dès les premières lettres
    var qL = S.ui.rechAutourLibre || '';
    var haut = h + champRechercheLibre('rechAutourLibre', qL) +
      '<div id="resAutourLibre">' + resultatsAutourLibre(qL) + '</div>';
    h = '';
    var fin = function (x) { return haut + '<div id="autourListe"' + (normaliser(qL) ? ' hidden' : '') + '>' + x + '</div>'; };
    // 3.27.38 : Récupération automatique de la position GPS par défaut et déduction du quartier
    if (A.lat === null || !A.src) {
      var g0 = S.ui.posGps || LS.get('derniereGps', null);
      if (g0 && isFinite(g0.lat) && isFinite(g0.lon)) {
        S.ui.posGps = g0;
        var r0 = Moteur.quartierLePlusProche(g0.lat, g0.lon, quartiers());
        A.lat = g0.lat; A.lon = g0.lon; A.src = 'gps'; A.prec = g0.prec;
        A.quartier = r0 && r0.quartier ? r0.quartier.quartier : '';
        A.commune = r0 && r0.quartier ? r0.quartier.commune : '';
        A.label = A.quartier ? A.quartier + ' (ma position)' : 'Ma position';
        LS.set('autour', A);
      } else if (S.config && S.config.depart) {
        var qDef = quartiers().filter(function (x) { return x.quartier === S.config.depart; })[0];
        if (qDef) {
          A.lat = qDef.lat; A.lon = qDef.lon; A.quartier = qDef.quartier; A.commune = qDef.commune;
          A.label = qDef.quartier; A.src = 'gps_init';
          LS.set('autour', A);
        }
      }
      if (!S.ui.localisation) localiser(true, 'autour', true);
    }

    var estGps = A.src === 'gps' || A.src === 'gps_init';
    var txtGps = 'Utiliser ma position';
    if (estGps && A.quartier) {
      txtGps = 'Ma position : ' + A.quartier + (A.prec ? ' (± ' + A.prec + ' m)' : '');
    } else if (S.ui.posGps) {
      var qGps = Moteur.quartierLePlusProche(S.ui.posGps.lat, S.ui.posGps.lon, quartiers());
      if (qGps && qGps.quartier) txtGps = 'Utiliser ma position (' + qGps.quartier.quartier + ')';
    }
    var styleGps = 'margin-bottom:10px;' + (estGps ? ' border-color: var(--primaire); background: rgba(16,185,129,0.08); font-weight: 600;' : '');
    var blocBoutonGps = '<button class="bouton bouton-large' + (estGps ? ' actif' : '') + '" type="button" data-a="localiser" style="' + styleGps + '">' +
      icone('cible') + '<span>' + esc(txtGps) + '</span></button>';

    var valQuartier = (A.src === 'quartier' && A.quartier) ? A.quartier : '';
    var libelleQuartier = valQuartier || 'Choisir un autre quartier…';
    var blocSelecteurQuartier = '<div class="champ"><span>Ou choisir un quartier</span>' + selecteurListe('autourQuartier', {
      titre: 'Choisir un quartier',
      valeur: valQuartier,
      vide: libelleQuartier,
      sections: sectionsQuartiers(),
      appliquer: function (v) {
        var q = quartiers().filter(function (x) { return x.quartier === v; })[0];
        if (q) {
          S.ui.autour.lat = q.lat;
          S.ui.autour.lon = q.lon;
          S.ui.autour.label = q.quartier;
          S.ui.autour.quartier = q.quartier;
          S.ui.autour.commune = q.commune;
          S.ui.autour.src = 'quartier';
          S.ui.autour.prec = null;
          LS.set('autour', S.ui.autour);
          rendre();
        }
      }
    }) + '</div>';

    var blocRayon = '<div class="champ" style="margin:0"><span>Rayon</span>' + segment('Rayon', 'autourRayon', RAYONS.map(function (r) { return [String(r), String(r).replace('.', ',') + ' km']; }), String(A.rayon), 'margin:0') + '</div>';

    if (S.ui.pharmaciesProches) {
      // raccourci « Pharmacie » : juste la position et le rayon, les résultats tout de suite
      h += '<section class="bloc compact">' + blocBoutonGps + blocSelecteurQuartier + blocRayon + '</section>'; // 3.27.38


    } else {
    h += '<section class="bloc">' +
      '<div class="segment" role="group" aria-label="Moment">' +
        '<button type="button" data-a="autourMoment" data-v="maintenant" aria-pressed="' + (A.moment === 'maintenant') + '">Maintenant</button>' +
        '<button type="button" data-a="autourMoment" data-v="choisir" aria-pressed="' + (A.moment === 'choisir') + '">Autre moment</button></div>' +
      (A.moment === 'choisir' ? '<div class="grille-2"><label class="champ"><span>Date</span><input type="date" data-f="autour" data-k="date" value="' + esc(A.date || prochainJourOuvre(aujourdhui())) + '"></label>' +
        '<label class="champ"><span>Heure (vide : toute la journée)</span><input type="time" data-f="autour" data-k="heure" value="' + esc(A.heure) + '"></label></div>' : '') +
      blocBoutonGps + blocSelecteurQuartier + blocRayon + '</section>';



    h += barreFiltres(S.ui.filtres, '', true);
    }

    if (S.ui.localisation && A.lat === null) return fin(h + '<div class="vide"><strong>Recherche de votre position…</strong>Les résultats s\'affichent dès qu\'elle est trouvée.</div>');
    if (A.lat === null) return fin(h + '<div class="vide"><strong>Où êtes-vous ?</strong>Utilisez votre position ou choisissez un quartier.</div>');
    var date, minute;
    if (A.moment === 'maintenant') { date = aujourdhui(); minute = minutesMaintenant(); }
    else { date = A.date || prochainJourOuvre(aujourdhui()); minute = heureVersMinutes(A.heure); }
    if (jourSemaineIndex(date) > 4) {
      return fin(h + '<div class="vide"><strong>Pas de présences le week-end</strong>Médecins et pharmacies sont affichés du lundi au vendredi. Choisissez « Autre moment » et un jour de semaine.</div>');
    }
    h += bandeauFeries([date]);
    var fa = S.ui.pharmaciesProches ? S.ui.filtresAutour : S.ui.filtres, filtre = criteresActifs(fa).length ? ensemble(filtrerPraticiens(fa, '').map(function (p) { return p.code; })) : null;
    // 3.25.8 : ceux déjà dans ma tournée ce jour-là sont omis
    var dansTournee = ensemble(S.plan.filter(function (a) { return a.date === date; }).map(function (a) { return a.code; }));
    var res = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, A.rayon)
      .filter(function (x) { return (!A.ref || x.c.code !== A.ref.code) && (!filtre || filtre[x.c.code]) && !dansTournee[x.c.code]; });
    S.ui.resAutour = res;
    // 3.25.15 : à 0,5 km (proximité immédiate), seulement ceux présents maintenant
    var immediat = +A.rayon === 0.5 && minute !== null;
    if (immediat) res = res.filter(function (x) { return x.etat === 'present'; }), S.ui.resAutour = res;
    var groupes = minute === null ? [['matin', 'Le matin'], ['soir', 'Le soir']] :
      (immediat ? [['present', 'Présents maintenant']] : [['present', 'Présents maintenant'], ['plustard', 'Plus tard dans la journée']]);
    h += '<p class="discret">' + majuscule(dateLongue(date)) + (minute !== null ? ', ' + minutesVersHeure(minute) : '') +
      ', autour de ' + esc(A.src === 'quartier' ? (A.quartier || A.label) : (A.quartier ? A.quartier + ' (ma position)' : (A.label || 'votre position'))) + (A.src === 'gps' && A.prec ? ' (précision ± ' + A.prec + ' m)' : '') + ' : ' + res.length + (fa.type === 'Pharmacie' ? ' pharmacie' : (fa.type === 'Médecin' ? ' médecin' : ' praticien')) + (res.length > 1 ? 's' : '') + '.</p>';
    groupes.forEach(function (g) {
      var l = res.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.etat === g[0]; });
      h += '<h3>' + g[1] + ' (' + l.length + ')</h3>';
      if (!l.length) { h += '<p class="discret">Aucun ' + (S.ui.pharmaciesProches === 'Pharmacie' ? 'pharmacie' : 'praticien') + ' dans ce rayon.</p>'; return; }
      h += '<ul class="liste">' + l.slice(0, 25).map(function (o) { return rendreProposition(o.x, o.i, date); }).join('') + '</ul>';
    });
    // 3.25.10 : rien dans le rayon : les plus proches au-delà, pour ne jamais laisser la page vide
    if (!res.length) {
      var plus = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, Infinity)
        .filter(function (x) { return (!A.ref || x.c.code !== A.ref.code) && (!filtre || filtre[x.c.code]) && !dansTournee[x.c.code]; }).slice(0, 5);
      var base = S.ui.resAutour.length;
      S.ui.resAutour = S.ui.resAutour.concat(plus);
      if (plus.length) h += '<h3>Les plus proches, au-delà de ' + String(A.rayon).replace('.', ',') + ' km</h3><ul class="liste">' + plus.map(function (x, k) { return rendreProposition(x, base + k, date); }).join('') + '</ul>';
    }
    if (A.ref) {
      var autres = (ctx().parCode[A.ref.code] || []).filter(function (c) { return c.cle !== A.ref.cle; });
      h += '<h3>Autres présences de ' + esc(A.ref.nom) + '</h3>';
      h += autres.length ? '<ul class="liste">' + autres.map(function (c) {
        var d = prochaineOccurrence(c.jourIdx, A.ref.date, c.creneau === 'Soir' && A.ref.creneau === 'Matin');
        return '<li class="element"><div class="element-tete"><div><b>' + esc(c.jour) + ' ' + c.creneau.toLowerCase() + '</b>, ' +
          minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '<span class="discret bloc-texte">' + esc(c.lieu) + ', ' + esc(c.quartier) + '</span></div></div>' +
          '<button class="bouton bouton-large" type="button" data-a="planifierCle" data-v="' + esc(c.cle) + '" data-d="' + d + '">Planifier le ' + dateCourte(d) + '</button></li>';
      }).join('') + '</ul>' : '<p class="discret">Pas d\'autre présence connue.</p>';
    }
    return fin(h);
  };

  function prochaineOccurrence(jourIdx, depuis, memeJourPossible) {
    var delta = jourIdx - jourSemaineIndex(depuis);
    if (delta < 0 || (delta === 0 && !memeJourPossible)) delta += 7;
    return ajouterJours(depuis, delta);
  }

  // 3.18.0 : type de praticien en couleur (médecin bleu, pharmacie violet), avec le mot pour ne pas dépendre de la couleur
  function estPharmacie(o) { var t = o && (o.type || (praticien(o.code) || {}).type); return t === 'Pharmacie'; }
  // 3.23.1 : le type se lit par un symbole et une couleur : caducée du médecin (bâton d'Asclépios, bleu),
  // coupe d'Hygie de la pharmacie (violet) ; le mot reste lu par les lecteurs d'écran
  function pastilleType(o, grand) {
    var ph = estPharmacie(o), lib = ph ? 'Pharmacie' : 'Médecin';
    return '<i class="type-pastille ' + (ph ? 't-pharma' : 't-med') + (grand ? ' grand' : '') + '" role="img" aria-label="' + lib + '" title="' + lib + '">' + icone(ph ? 'pharmacie' : 'medecin') + '</i>';
  }
  // 3.23.4 : pas de doublon sous le titre : le lieu n'est pas répété quand c'est le nom (pharmacies),
  // et « Pharmacien » n'est pas écrit (le symbole de la pharmacie le dit)
  function lieuAffiche(a) {
    var l = normaliser(nomSansType(a.lieu)), n = normaliser(nomSansType(a.nom));
    return !l || l === n || n.indexOf(l) >= 0 || l.indexOf(n) >= 0 ? '' : a.lieu;
  }
  // sous-titre sans redite : pas de spécialité pour une pharmacie, rien de ce que le nom dit déjà
  // 3.28.38 : pharmacie dans les listes d'ajout : quartier toujours affiché (même s'il figure dans le nom), puis la commune
  function lieuPharmacieListe(p, cr) {
    cr = cr || {};
    var l0 = (p.lieux && p.lieux[0]) || {}, q = cr.quartier || p.quartier || l0.quartier || '', c = cr.commune || p.commune || l0.commune || '';
    var lieu = infosSansDoublon(p, [cr.lieu]), l = [], vus = {};
    [lieu, q, q && normaliser(q).indexOf(normaliser(c)) >= 0 ? '' : c].forEach(function (x) { var k = normaliser(x || ''); if (k && !vus[k]) { vus[k] = true; l.push(x); } });
    return l.join(', ');
  }
  function infosSansDoublon(o, l) {
    var n = normaliser(nomSansType(o.nom)), ph = estPharmacie(o), vus = {};
    return l.filter(function (x, i) {
      if (!x || (i === 0 && ph && x === o.specialite)) return false;
      var k = normaliser(nomSansType(x));
      if (!k || vus[k] || n.indexOf(k) >= 0 || k.indexOf(n) >= 0) return false;
      vus[k] = true; return true;
    }).join(', ');
  }
  // 3.25.37 : Carte médecin dans Journée -> Spécialité en premier, avant l'hôpital, puis secteur sans double espace
  function lieuQuartier(a) {
    if (!estPharmacie(a)) {
      var parts = [];
      if (a.specialite) parts.push(abrSpec(a.specialite));
      var hop = abregerHopital(a.lieu || lieuAffiche(a));
      if (hop) parts.push(hop);
      var q = (typeof nomSecteur === 'function' ? nomSecteur(a.quartier, a.commune, a.coord) : a.quartier) || a.quartier;
      if (q && (!hop || hop.toLowerCase().indexOf(q.toLowerCase()) < 0)) parts.push(q);
      return parts.join(' · ').replace(/\s{2,}/g, ' ').trim();
    }
    var n = normaliser(a.nom), q = a.quartier && n.indexOf(normaliser(a.quartier)) >= 0 ? '' : a.quartier;
    return [lieuAffiche(a), q].filter(Boolean).join(', ').replace(/\s{2,}/g, ' ').trim();
  }
  function specGras(a, txt) {
    var s = !estPharmacie(a) && a.specialite ? abrSpec(a.specialite) : '';
    return s && txt.indexOf(s) === 0 ? '<b>' + esc(s) + '</b>' + esc(txt.slice(s.length)) : esc(txt);
  }
  function lieuEtSpec(a) {
    if (!estPharmacie(a)) {
      var parts = [];
      if (a.specialite) parts.push(abrSpec(a.specialite));
      var hop = abregerHopital(a.lieu || lieuAffiche(a));
      if (hop) parts.push(hop);
      return parts.join(' · ').replace(/\s{2,}/g, ' ').trim();
    }
    return String(lieuAffiche(a) || '').replace(/\s{2,}/g, ' ').trim();
  }
  function nomSansType(nom) { return String(nom || '').replace(/^\s*pharmacie\s+/i, ''); }
  function metres(km) {
    if (km <= 0.035) return 'sur place (< 35 m)';
    var m = Math.max(10, Math.round(km * 100) * 10);
    return m <= 30 ? 'sur place (< 30 m)' : m + ' mètres';
  }
  // 3.28.19 : le nom d'un médecin ou d'une pharmacie ouvre sa fiche ; le reste de la carte garde ses options
  function lienFiche(code, html) {
    if (!code) return html;
    return '<span class="nom-lien" data-a="voirContact" data-v="' + esc(code) + '" role="link" tabindex="0" title="Ouvrir la fiche">' + html + '</span>';
  }
  // 3.28.9 : nom d'un médecin engagé en ambre, partout où un nom est affiché
  function nomPrat(p) {
    var eng = p && !estPharmacie(p) && estConventionne(p.conventionne !== undefined ? p.conventionne : ((praticien(p.code) || {}).conventionne));
    return '<b' + (eng ? ' class="nom-engage"' : '') + '>' + esc(p ? p.nom : '') + '</b>';
  }
  function classeType(o) {
    var c = estPharmacie(o) ? ' t-pharma' : ' t-med';
    if (!o) return c;
    var conv = o.conventionne !== undefined ? o.conventionne : ((praticien(o.code) || {}).conventionne);
    if (!estPharmacie(o) && estConventionne(conv)) c += ' med-engage';
    return c;
  }
  function rendreProposition(x, i, date, src, avecDist) {
    var c = x.c, p = c.prat;
    var deja = S.plan.some(function (a) { return a.date === date && a.code === p.code; });
    return '<li class="element' + classeType(p) + '"><div class="element-tete"><div>' +
      '<span class="element-titre">' + pastilleType(p) + lienFiche(p.code, esc(p.nom)) + ' ' + etoiles(p.note) + '</span>' +
      '<span class="discret bloc-texte">' + esc(infosSansDoublon(p, [p.specialite, c.lieu])) + '</span>' +
      '<span class="discret bloc-texte">' + esc(c.quartier) + ', ' + c.creneau.toLowerCase() + ' ' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '</span>' +
      '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere, date)) + '</span>' +
      etiquetteCollegues(p.code, date) + '</span></div>' +
      '<div class="element-mesure">' + (avecDist === false ? '' : distMoi(x.dist, c.coord && c.coord.approx)) +
        (avecDist !== false && c.coord && c.coord.approx ? '<small>quartier</small>' : '') + '<small>score ' + Math.round(x.score) + '</small></div></div>' +
      (avecDist !== false && c.coord && gpsPrecis() && (c.coord.approx || x.dist <= 2.5) ? '<p class="discret pos-approx">' + (c.coord.approx ? 'Position du lieu non enregistrée (centre du quartier). ' : 'Vous êtes devant mais la distance est fausse ? ') +
        '<button type="button" class="bouton-texte" data-a="posLieuIci" data-v="' + esc(c.cle) + '">' + icone('cible') + 'Je suis devant : enregistrer sa position</button></p>' : '') +
      (deja ? '<p class="discret" style="margin:8px 0 0">Déjà dans votre tournée ce jour-là.</p>' :
        '<div class="rangee" style="margin-top:10px"><a class="bouton" href="' + lienCarte({ lat: c.coord && c.coord.lat, lon: c.coord && c.coord.lon }) + '" target="_blank" rel="noopener">' + icone('carte') + 'Y aller</a>' +
        '<button class="bouton bouton-plein" type="button" data-a="ajouterAutour" data-i="' + i + '"' + (src ? ' data-s="' + src + '"' : '') + ' data-d="' + date + '">' + icone('plus') + (date === aujourdhui() ? 'Aujourd\'hui' : dateCourte(date)) + '</button></div>') +
      '</li>';
  }

  // ------------------------------------------------------------------ Vue : équipe (moi et mes collègues, jour ou semaine au choix)
  // Planifié : tournées (téléphone pour moi, feuille Plannings pour tous) ; fait : comptes rendus (Historique et file d'envoi)
  function donneesEquipe(dates) {
    var dd = ensemble(dates), nomMoi = moi() || 'Moi', l = [], cles = {};
    var hist = (S.queue || []).concat((S.data && S.data.historique) || []), parUid = {};
    hist.forEach(function (v) { if (v.uid && !parUid[v.uid]) parUid[v.uid] = v; });
    var miennesLocales = ensemble(S.plan.map(function (a) { return a.date; }));
    function ajouter(x) {
      var k = (x.delegue || '') + '|' + x.date + '|' + x.code;
      if (cles[k]) return; cles[k] = true; l.push(x);
    }
    S.plan.forEach(function (a) {
      if (!dd[a.date]) return;
      var v = parUid[a.uid];
      ajouter(Object.assign({}, a, { delegue: nomMoi, programme: jourConfirme(a.date) ? 'Validé' : 'Proposition',
        statut: v ? v.statut : (a.etat === 'valide' ? a.statut : ''), compte: v ? v : (a.etat === 'valide' ? a : null) }));
    });
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (!dd[p.date] || !p.delegue) return;
      if (estMoi(p.delegue) && miennesLocales[p.date]) return;   // ma version du téléphone est la plus récente
      var v = p.uid ? parUid[p.uid] : null, st = v ? v.statut : (p.statut === 'À faire' ? '' : p.statut);
      ajouter(Object.assign({}, p, { delegue: estMoi(p.delegue) ? nomMoi : p.delegue, statut: st || '', compte: v || null }));
    });
    // visites faites hors tournée publiée (ajouts, anciennes tournées)
    hist.forEach(function (v) {
      var d = String(v.date || '').slice(0, 10);
      if (!dd[d] || !v.delegue) return;
      var x = Object.assign({}, v, { date: d, delegue: estMoi(v.delegue) ? nomMoi : v.delegue, heure: '', programme: '', compte: v, horsTournee: true });
      ajouter(x);
    });
    return l;
  }
  function decalerEquipe(sens) {
    var p = S.ui.eqPortee, d = S.ui.eqDate || aujourdhui();
    S.ui.eqDate = ajouterJours(d, (p === 'semaine' ? 7 : 1) * sens);
    if (p === 'jour') { while (jourSemaineIndex(S.ui.eqDate) > 4) S.ui.eqDate = ajouterJours(S.ui.eqDate, sens); }
    S.ui.jourEquipe = null; LS.set('eqDate', S.ui.eqDate); rendre();
  }

