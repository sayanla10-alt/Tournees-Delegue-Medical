  VUES.produits = function () {
    var q = normaliser(S.ui.rechProduit || ''), aire = S.ui.aireProduit || '', toutes = fichesProduits();
    var aires = []; toutes.forEach(function (f) { if (f.aire && aires.indexOf(f.aire) < 0) aires.push(f.aire); });
    aires.sort(function (a, b) { return ORDRE_AIRES.indexOf(a) - ORDRE_AIRES.indexOf(b); });
    var l = toutes.filter(function (f) { return (!aire || f.aire === aire) && (!q || normaliser([f.produit, f.dci, f.gamme, f.classe, f.indications, f.aire].join(' ')).indexOf(q) >= 0); });
    var h = '<h2 class="titre-vue">Produits</h2><p class="sous-titre">Votre aide-mémoire de visite : produits, arguments clés et échantillons.</p>' +
      '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="rechProduit" placeholder="Produit, molécule, indication…" value="' + esc(S.ui.rechProduit || '') + '" aria-label="Rechercher un produit"></div></div>' +
      '<div class="defile" role="group" aria-label="Aire thérapeutique"><button type="button" class="puce" data-a="aireProduit" data-v="" aria-pressed="' + !aire + '">Tous</button>' +
      aires.map(function (x) { return '<button type="button" class="puce" data-a="aireProduit" data-v="' + esc(x) + '" aria-pressed="' + (aire === x) + '">' + esc(AIRES_COURTES[x] || x) + '</button>'; }).join('') + '</div>';
    if (!l.length) return h + '<div class="vide"><strong>Aucun produit</strong>Aucune fiche ne correspond.<div style="margin-top:14px"><button class="bouton bouton-plein" type="button" data-a="reinitFiltresProduits">' + icone('fermer') + 'Réinitialiser la recherche et les filtres</button></div></div>';
    // 3.19.0 : une section repliable par aire thérapeutique (ouverte d'office si un filtre ou une recherche est actif)
    // 3.22.3 : par défaut, seule la première aire est dépliée (le reste se déplie au toucher)
    if (!S.ui.airesOuvertes) { S.ui.airesOuvertes = {}; if (aires[0]) S.ui.airesOuvertes[aires[0]] = true; }
    var aireCourante = null, ouvertes = S.ui.airesOuvertes, toutOuvert = !!(aire || q);
    var parAire = {}; l.forEach(function (f) { parAire[f.aire] = (parAire[f.aire] || 0) + 1; });
    h += '<div class="liste-gammes">';
    gammesProduits(l).forEach(function (g) {
      if (g.aire !== aireCourante) {
        aireCourante = g.aire;
        var ouv = toutOuvert || ouvertes[g.aire];
        h += '<button type="button" class="aire-titre aire-bascule" data-a="aireBascule" data-v="' + esc(g.aire || '') + '" aria-expanded="' + !!ouv + '"><span>' + esc(g.aire || '') +
          '</span><small>' + parAire[g.aire] + ' produit' + (parAire[g.aire] > 1 ? 's' : '') + '</small>' + icone('chevron') + '</button>';
      }
      if (!(toutOuvert || ouvertes[g.aire])) return;
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, ''), mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
      h += '<div class="ligne-gamme"><div class="lg-tete"><b>' + esc(nom) + '</b>' + (mol ? '<small>' + esc(mol) + '</small>' : '') + '</div><div class="lg-produits">' +
        g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).map(function (f) {
          // dans la ligne de la gamme, le nom de gamme n'est pas répété : « Rozukaa 10 » devient « 10 mg », « Zyltan AM » devient « AM »
          var court = f.produit.indexOf(nom + ' ') === 0 ? f.produit.slice(nom.length + 1) : f.produit;
          if (/^\d+$/.test(court)) court += ' mg';
          if (g.fiches.length === 1) court = f.produit;   // gamme d'un seul produit : nom complet (« Myonit SR » plutôt que « SR »)
          return '<button type="button" class="pastille-produit" data-a="produitOuvrir" data-v="' + esc(f.produit) + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
        }).join('') + '</div></div>';
    });
    return h + '</div><p class="discret" style="margin-top:12px;font-size:12.5px">Résumé des notices officielles des molécules ; la notice de la boîte fait foi. Fiches modifiables dans l\'onglet « Fiches produits » de la BDD.</p>';
  };
  // champ de recherche libre, identique à celui de l'onglet Recherche (loupe, sans critère à choisir)
  function champRechercheLibre(f, q) {
    return '<div class="recherche recherche-libre">' + icone('loupe') + '<input type="search" data-f="' + f + '" placeholder="Nom, spécialité, établissement, commune…" value="' +
      esc(q || '') + '" aria-label="Rechercher un praticien" autocomplete="off"></div>';
  }
  // 3.25.1 : résultats de la recherche libre d'« Autour de moi » : praticiens présents ce jour-là, tous rayons confondus,
  // selon les filtres appliqués, du plus proche au plus loin
  function momentAutour() {
    var A = S.ui.autour;
    if (A.moment === 'maintenant') return { date: aujourdhui(), minute: minutesMaintenant() };
    return { date: A.date || prochainJourOuvre(aujourdhui()), minute: heureVersMinutes(A.heure) };
  }
  function resultatsAutourLibre(q) {
    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    S.ui.resAutourLibre = [];
    if (!mots.length) return '';
    var A = S.ui.autour, m = momentAutour(), date = m.date;
    if (jourSemaineIndex(date) > 4) return '<p class="discret">Aucun praticien présent le week-end.</p>';
    var fa = S.ui.pharmaciesProches ? S.ui.filtresAutour : S.ui.filtres, filtre = criteresActifs(fa).length ? ensemble(filtrerPraticiens(fa, '').map(function (p) { return p.code; })) : null;
    var avecPos = A.lat !== null, pos = avecPos ? { lat: A.lat, lon: A.lon } : { lat: 5.345, lon: -4.02 };
    var dansT = ensemble(S.plan.filter(function (a) { return a.date === date; }).map(function (a) { return a.code; }));
    var l = Moteur.autourDe(ctx(), pos, date, m.minute, Infinity).filter(function (x) {
      var c = x.c, p = c.prat;
      if ((A.ref && c.code === A.ref.code) || (filtre && !filtre[c.code]) || absentLe(p, date) || dansT[c.code]) return false;
      var txt = normaliser([p.nom, p.specialite, c.lieu, c.quartier, c.commune].join(' '));
      return mots.every(function (w) { return txt.indexOf(w) >= 0; });
    });
    if (!avecPos) l.sort(function (a, b) { return b.score - a.score; });
    l = l.slice(0, 30); S.ui.resAutourLibre = l;
    if (!l.length) return '<p class="discret">Aucun praticien présent le ' + dateFr(date) + ' ne correspond, selon vos filtres.</p>';
    return '<p class="discret">' + l.length + (l.length === 30 ? '+' : '') + ' résultat' + (l.length > 1 ? 's' : '') + ', ' + dateLongue(date) + (avecPos ? ', du plus proche au plus loin' : '') + '.</p>' +
      '<ul class="liste">' + l.map(function (x, i) { return rendreProposition(x, i, date, 'libre', avecPos); }).join('') + '</ul>';
  }

  // ------------------------------------------------------------------ Vue : autour de moi
