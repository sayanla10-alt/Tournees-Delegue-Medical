  // ------------------------------------------------------------------ Mise en forme
  var JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var ZONES = ['Zone Nord', 'Zone Centre', 'Zone Est', 'Zone Sud', 'Zone Ouest', 'Zone Intérieur'];
  // 3.24.22 : villes de l'intérieur (zone « Zone Intérieur ») : la recherche Google Maps vise la ville, pas Abidjan
  function villeCarte(o) { return o.zone === 'Zone Intérieur' ? 'Côte d\'Ivoire' : 'Abidjan'; }

  function esc(s) {
    var t = String(s === undefined || s === null ? '' : s).replace(/\s{2,}/g, ' ');
    return t.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateCourte(iso) { var p = iso.split('-'); return JOURS_COURTS[jourSemaineIndex(iso)] + ' ' + p[2] + '/' + p[1]; }
  function dateLongue(iso) { var p = iso.split('-'); return nomJour(iso).toLowerCase() + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1]; }
  function majuscule(s) { return s.replace(/^./, function (c) { return c.toUpperCase(); }); }
  var MOIS_COURTS_CAP = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  function datePlanLibelle(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return iso;
    var jCourt = majuscule(JOURS_COURTS[jourSemaineIndex(iso)] || '');
    if (!jCourt.endsWith('.')) jCourt += '.';
    return jCourt + ' ' + (+p[2]) + ' ' + (MOIS_COURTS_CAP[+p[1] - 1] || '');
  }
  // 3.24.1 : part du planning du jour réalisée (visites faites / visites prévues), barre et pourcentage
  // 3.24.12 : la ligne du dessous donne la part des visites renseignées (compte rendu saisi, faite ou non)
  function barreRealise(faites, prevues, renseignees) {
    var p = prevues ? Math.round(100 * faites / prevues) : 0, pr = prevues ? Math.round(100 * (renseignees || 0) / prevues) : 0;
    return '<div class="sj-taux"><div class="progression" role="progressbar" aria-label="Réalisé" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '"><i style="width:' + p + '%"></i></div>' +
      '<b class="' + (p >= 100 ? 'complet' : '') + '">' + p + ' %</b><small>' + faites + '/' + prevues + ' réalisée' + (faites > 1 ? 's' : '') + ' · ' + pr + ' % renseignée' + (pr > 1 ? 's' : '') + '</small></div>';
  }
  // 3.23.2 : trajet en symboles : distance, minutes à pied, minutes en voiture (vol d'oiseau x détour routier)
  function trajetMini(kmVol, minVoiture) {
    var route = kmVol * REGLAGES_MOTEUR.detourRoutier, pied = Math.max(1, Math.round(route / 4.8 * 60));
    var dist = route < 1 ? Math.max(10, Math.round(route * 100) * 10) + ' m' : (Math.round(route * 10) / 10).toLocaleString('fr-FR') + ' km';
    var duree = function (m) { return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad2(m % 60); };
    return '<span class="trajet-mini" role="img" aria-label="' + dist + ', ' + duree(pied) + ' à pied, ' + duree(Math.max(1, minVoiture)) + ' en voiture">' +
      '<span>' + icone('route') + dist + '</span><span>' + icone('pieton') + duree(pied) + '</span><span>' + icone('voiture') + duree(Math.max(1, minVoiture)) + '</span></span>';
  }
  function km(n) { return (Math.round(n * 10) / 10).toLocaleString('fr-FR') + ' km'; }
  function pct(n) { return (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1 }) + ' %'; }
  function vuDepuis(derniere, ref) {
    if (!derniere) return 'Jamais visité';
    var j = joursEcoules(derniere, ref || aujourdhui());
    return j <= 0 ? 'Vu aujourd\'hui' : 'Vu il y a ' + j + ' j';
  }
  // Potentiel de prescription affiché en étoiles : 3 = ★★★ (fort), 2 = ★★ (moyen), 1 = ★ (faible)
  var LIB_POTENTIEL = { A: 'fort', B: 'moyen', C: 'faible' };
  var ETOILES = { A: '★★★', B: '★★', C: '★' };
  function etoiles(n) {
    var k = lireNote(n), l = lettrePotentiel(n);
    return '<span class="note" title="Potentiel de prescription ' + k + ' sur 3 (' + LIB_POTENTIEL[l] + ')" aria-label="Potentiel ' + k + ' sur 3">' +
      '★★★'.slice(0, k) + '<i>' + '★★★'.slice(0, 3 - k) + '</i></span>';
  }
  function badgeConv(v) { return estConventionne(v) ? '<span class="etiquette conv">Engagé</span>' : '<span class="etiquette">Non engagé</span>'; }
  function lienCarte(o) {
    if (o.lat && o.lon) return 'https://www.google.com/maps/search/?api=1&query=' + (+o.lat).toFixed(5) + ',' + (+o.lon).toFixed(5);
    var q = [o.lieu, o.quartier === 'NL' ? '' : o.quartier, o.commune, villeCarte(o)].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }
  function estKo(statut) { return statut && !Moteur.estVisite(statut, statuts()); }
  function estGrandeCommune(nom) {
    if (!nom) return false;
    var s = normaliser(nom);
    return s.indexOf('abobo') === 0 || s.indexOf('cocody') === 0 || s.indexOf('yopougon') === 0;
  }
  function communeParente(nom) {
    if (!nom) return '';
    var s = String(nom).trim();
    var m = s.match(/^(Abobo|Cocody|Yopougon)\b/i);
    if (m) {
      var p = m[1].toLowerCase();
      if (p === 'abobo') return 'Abobo';
      if (p === 'cocody') return 'Cocody';
      if (p === 'yopougon') return 'Yopougon';
    }
    return s;
  }
  var ORDRE_SECTEURS = [
    // 1. Cocody
    'Cocody – Angré',
    'Cocody – Deux Plateaux',
    'Cocody – Riviera',
    'Cocody – Centre',
    // 2. Yopougon
    'Yopougon – Niangon',
    'Yopougon – Maroc & Toits Rouges',
    'Yopougon – Centre & Mairie',
    'Yopougon – Sud & Gesco',
    // 3. Abobo
    'Abobo – Nord & PK18',
    'Abobo – Centre & Mairie',
    'Abobo – Baoulé & Avocatier',
    'Abobo – Sud & Plaque'
  ];
  function secteursDeGrandeCommune(par) {
    if (par === 'Cocody') return ['Cocody – Angré', 'Cocody – Deux Plateaux', 'Cocody – Riviera', 'Cocody – Centre'];
    if (par === 'Yopougon') return ['Yopougon – Niangon', 'Yopougon – Maroc & Toits Rouges', 'Yopougon – Centre & Mairie', 'Yopougon – Sud & Gesco'];
    if (par === 'Abobo') return ['Abobo – Nord & PK18', 'Abobo – Centre & Mairie', 'Abobo – Baoulé & Avocatier', 'Abobo – Sud & Plaque'];
    var qs = (typeof quartiers === 'function') ? quartiers() : [];
    var set = {};
    qs.forEach(function (q) {
      if (communeParente(q.commune) === par && q.commune !== par) {
        set[q.commune] = true;
      }
    });
    return Object.keys(set).sort(function (a, b) {
      var ia = ORDRE_SECTEURS.indexOf(a), ib = ORDRE_SECTEURS.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      return a.localeCompare(b, 'fr');
    });
  }
  function communesListe() {
    var vus = {}, l = [];
    quartiers().forEach(function (q) {
      var com = communeParente(q.commune);
      if (!vus[com]) { vus[com] = true; l.push({ commune: com, zone: q.zone }); }
    });
    return l.sort(function (a, b) { return ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone) || a.commune.localeCompare(b.commune, 'fr'); });
  }
  // Condensation intelligente des communes et secteurs :
  // 1. Si tous les secteurs d'une grande commune sont sélectionnés -> affiche uniquement le nom de la commune (ex: Cocody)
  // 2. Si seuls certains secteurs sont sélectionnés -> affiche uniquement le nom du secteur sans répéter la commune (ex: Deux Plateaux, Riviera)
  function condenserCommunesEtSecteurs(liste) {
    if (!liste || !liste.length) return '';
    var grandes = ['Abobo', 'Cocody', 'Yopougon'];
    var secsParGrande = {};
    grandes.forEach(function (g) {
      secsParGrande[g] = (typeof secteursDeGrandeCommune === 'function') ? secteursDeGrandeCommune(g) : [];
    });

    var compteParGrande = {};
    grandes.forEach(function (g) { compteParGrande[g] = 0; });

    liste.forEach(function (x) {
      if (!x) return;
      var str = String(x).trim();
      var par = (typeof communeParente === 'function') ? communeParente(str) : '';
      if (grandes.indexOf(par) >= 0) {
        if (secsParGrande[par] && secsParGrande[par].indexOf(str) >= 0) {
          compteParGrande[par]++;
        } else if (str === par || str === par + ' (Toute la commune)') {
          compteParGrande[par] = (secsParGrande[par] || []).length;
        }
      }
    });

    var resultats = [];
    var grandesTraitees = {};

    // 1. Pour les grandes communes dont TOUS les secteurs sont sélectionnés -> juste le nom de la commune (ex: Cocody)
    grandes.forEach(function (g) {
      var nbTot = (secsParGrande[g] || []).length;
      if (nbTot > 0 && compteParGrande[g] >= nbTot) {
        resultats.push(g);
        grandesTraitees[g] = true;
      }
    });

    // 2. Pour les autres éléments :
    liste.forEach(function (x) {
      if (!x) return;
      var str = String(x).trim();
      var par = (typeof communeParente === 'function') ? communeParente(str) : '';
      if (grandesTraitees[par]) return;

      // Si c'est un sous-secteur individuel d'une grande commune, on retire le préfixe redondant
      var nomAffiche = str.replace(/^(Abobo|Cocody|Yopougon)\s*[-–—]\s*/i, '')
                          .replace(/\s*\(Toute la commune\)$/i, '');
      // Exception Cocody Centre : "souvent Cocody Centre est seulement écrit Centre, ça prête à confusion, garder exceptionnellement Cocody Centre"
      if (par === 'Cocody' && nomAffiche.toLowerCase() === 'centre') {
        nomAffiche = 'Cocody Centre';
      }
      if (resultats.indexOf(nomAffiche) < 0) {
        resultats.push(nomAffiche);
      }
    });

    return resultats.join(', ');
  }

  function libelleCommunes(l) {
    if (!l || !l.length) return 'Toutes les communes';
    var r = condenserCommunesEtSecteurs(l);
    var parts = r ? r.split(', ') : [];
    if (!parts.length) return 'Toutes les communes';
    return parts.length <= 3 ? parts.join(', ') : parts.slice(0, 2).join(', ') + ' et ' + (parts.length - 2) + ' autres';
  }

  function libelleListe(l, tous) {
    if (!l || !l.length) return tous;
    return l.length <= 3 ? l.join(', ') : l.slice(0, 2).join(', ') + ' et ' + (l.length - 2) + ' autres';
  }
  function duree(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' h' + (m ? ' ' + pad2(m) : '') : m + ' min';
  }
  // Filtre du tirage : types de praticiens, spécialités et potentiels ciblés
  // 3.25.15 : + Médecin / + Pharmacie (Journée) : toujours les filtres de l'onglet Recherche, type imposé
  function filtresRechercheType(type) { return Object.assign(JSON.parse(JSON.stringify(S.ui.filtres)), { type: type }); }
  function filtreAjout() {
    var f = S.ui.typeAjout ? filtresRechercheType(S.ui.typeAjout) : S.ui.filtres;
    var ok = ensemble(filtrerPraticiens(f, '').map(function (p) { return p.code; }));
    return function (p) { return !!ok[p.code]; };
  }
  function filtreCibles() {
    var p = S.params, t = p.typeCibles || 'tous', sp = {}, po = {};
    (p.specialites || []).forEach(function (x) { sp[x] = true; });
    (p.potentiels || []).forEach(function (x) { po[x] = true; });
    var avecSpec = t !== 'pharmacies' && p.specialites && p.specialites.length, avecPot = p.potentiels && p.potentiels.length;
    if (t === 'tous' && !avecSpec && !avecPot) return null;
    return function (pr) {
      var pharma = pr.type === 'Pharmacie';
      if (t === 'medecins' && pharma) return false;
      if (t === 'pharmacies' && !pharma) return false;
      if (avecSpec && !pharma && !sp[pr.specialite]) return false;
      if (avecPot && !po[lettrePotentiel(pr.note)]) return false;
      return true;
    };
  }
  function libelleCibles() {
    var p = S.params, l = [];
    if (p.typeCibles === 'medecins') l.push('sans pharmacies');
    if (p.typeCibles === 'pharmacies') l.push('pharmacies seules');
    if (p.typeCibles !== 'pharmacies' && p.specialites.length) l.push(libelleListe(p.specialites, ''));
    if (p.potentiels.length) l.push(p.potentiels.slice().sort().map(function (x) { return ETOILES[x]; }).join(' / '));
    return l.join(', ');
  }
  // 3.26.58 : spécialités abrégées à l'affichage (la valeur enregistrée reste complète)
  function abrSpec(s) {
    var t = String(s || '').trim(), k = normaliser(t);
    if (/generalist|medecinegenerale|medecingeneraliste|^mg$/.test(k)) return 'MG';   // 3.27.26 : normaliser retire les espaces
    if (/pneumo/.test(k)) return 'Pneumo';
    if (/infectio/.test(k)) return 'Infectio';
    if (/neurolog/.test(k)) return 'Neuro';
    if (/pediatr/.test(k)) return 'Pédia';
    if (/diabeto/.test(k)) return 'Diabéto';
    if (/endocrino/.test(k)) return 'Endocrino';
    if (/gyneco/.test(k)) return 'Gynéco';
    if (/cardio/.test(k)) return 'Cardio';
    if (/dermato/.test(k)) return 'Dermato';
    if (/nephro/.test(k)) return 'Néphro';
    if (/ophtalmo|ophthalmo/.test(k)) return 'Ophtalmo';
    if (/rhumato/.test(k)) return 'Rhumato';
    if (/gastro/.test(k)) return 'Gastro';
    return t;
  }
  function specialitesListe() {
    var n = {}, prat = ctx().prat;
    Object.keys(prat).forEach(function (k) { var p = prat[k]; if (p.type !== 'Pharmacie' && p.specialite) n[p.specialite] = (n[p.specialite] || 0) + 1; });
    return Object.keys(n).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (k) { return { nom: k, n: n[k] }; });
  }
  // Détermine si toutes les spécialités cibles (ou toutes les spécialités médicales) sont sélectionnées
  function sontToutesSpecialites(specs) {
    if (!specs || !specs.length) return true;
    if (typeof memeEnsembleSpecs === 'function' && typeof coeurDeCible === 'function' && memeEnsembleSpecs(specs, coeurDeCible())) return true;
    var tot = specialitesListe();
    if (tot.length > 0 && specs.length >= tot.length) return true;
    if (specs.length >= 4) return true;
    return false;
  }
  // Durée estimée d'une journée : du premier RDV à la fin de la dernière visite
  function estimationJour(l) {
    var R = REGLAGES_MOTEUR, deb = null, fin = null, dist = 0;
    l.forEach(function (a) {
      var h = heureVersMinutes(a.heure);
      if (h !== null) { if (deb === null || h < deb) deb = h; if (fin === null || h + R.dureeVisite > fin) fin = h + R.dureeVisite; }
      dist += a.trajet !== undefined ? a.trajet : (a.dist || 0) * R.minutesParKm;
    });
    if (deb === null) return null;
    return { debut: deb, fin: fin, trajet: Math.round(dist) };
  }
  // Appeler, SMS, Waze, Google Maps
  function actionsRapides(o) {
    var num = normaliserNumero(o.telephone), tel = num ? '+' + num : '';
    var pos = o.lat && o.lon && isFinite(+o.lat) && isFinite(+o.lon) ? (+o.lat).toFixed(5) + ',' + (+o.lon).toFixed(5) : '';
    var q = [o.lieu, o.quartier === 'NL' ? '' : o.quartier, o.commune, villeCarte(o)].filter(Boolean).join(', ');
    var gmaps = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + (pos || encodeURIComponent(q));
    function lien(href, ic, lib, actif, externe) {
      return actif ? '<a class="action-rapide" href="' + esc(href) + '"' + (externe ? ' target="_blank" rel="noopener"' : '') + '>' + icone(ic) + lib + '</a>'
        : '<a class="action-rapide" aria-disabled="true" title="Numéro de téléphone non renseigné">' + icone(ic) + lib + '</a>';
    }
    var waHref = (estMobile() && !S.config.waWeb) ? 'whatsapp://send?phone=' + num : 'https://wa.me/' + num;
    // 3.27.6 : Répertoire : numéro et 4 icônes sur une seule ligne
    if (o.compact) {
      var ic = function (href, n, lib, actif, externe) {
        return actif ? '<a class="cb-b" href="' + esc(href) + '" aria-label="' + lib + '" title="' + lib + '"' + (externe ? ' target="_blank" rel="noopener"' : '') + '>' + icone(n) + '</a>'
          : '<a class="cb-b" aria-disabled="true" aria-label="' + lib + '" title="Numéro non renseigné">' + icone(n) + '</a>';
      };
      return '<div class="contact-barre" role="group" aria-label="Contact"><span class="cb-n">' + (o.telephone ? esc(o.telephone) : '<span class="discret">Pas de numéro</span>') + '</span>' +
        ic('tel:' + tel, 'tel', 'Appeler', !!tel) + ic('sms:' + tel, 'sms', 'SMS', !!tel) + ic(waHref, 'whatsapp', 'WhatsApp', !!num, !estMobile() || S.config.waWeb) + ic(gmaps, 'carte', 'Maps', true, true) + '</div>';
    }
    return '<div class="actions-rapides" role="group" aria-label="Actions rapides">' +
      lien('tel:' + tel, 'tel', 'Appeler', !!tel) + lien('sms:' + tel, 'sms', 'SMS', !!tel) +
      lien(waHref, 'whatsapp', 'WhatsApp', !!num, !estMobile() || S.config.waWeb) + lien(gmaps, 'carte', 'Maps', true, true) + '</div>';
  }
  // Contrôle segmenté (un seul choix) : [[valeur, libellé], ...]
  function segment(titre, action, options, valeur, style) {
    return '<div class="segment" role="group" aria-label="' + esc(titre) + '"' + (style ? ' style="' + style + '"' : '') + '>' + options.map(function (o) {
      return '<button type="button" data-a="' + action + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(valeur) === String(o[0])) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  // Groupe de puces dans une fenêtre de filtres.
  // o : { id, titre, chemin (ex. 'brouillon.specialites' ou 'sel'), multiple, options: [{v, lib, n}],
  //       sections: [{titre, options}], recherche, repliable, resume, aide }
  function groupeChoix(f, o) {
    var val = valeurChemin(o.chemin), sel = o.multiple ? ensemble(val) : null;
    var ouvert = !o.repliable || !!(f.ouverts && f.ouverts[o.id]);
    var q = normaliser((f.q && f.q[o.id]) || '');
    function puce(op) {
      var actif = o.multiple ? !!sel[op.v] : val === op.v;
      var matchQ = !q || normaliser(op.lib + ' ' + (op.nomCourt || '') + ' ' + (op.sousTitre || '')).indexOf(q) >= 0;
      var dataLib = esc(normaliser(op.lib + ' ' + (op.nomCourt || '') + ' ' + (op.sousTitre || '')));

      if (op.parent) {
        var secsDuPar = (typeof secteursDeGrandeCommune === 'function') ? secteursDeGrandeCommune(op.commune) : [];
        var toutCoche = secsDuPar.length > 0 && secsDuPar.every(function (s) { return sel && sel[s]; });
        var nbCoches = secsDuPar.filter(function (s) { return sel && sel[s]; }).length;
        var sousLib = toutCoche ? 'Tous les secteurs cochés' : (nbCoches > 0 ? nbCoches + '/' + secsDuPar.length + ' secteur' + (nbCoches > 1 ? 's' : '') : 'Toute la commune');
        return '<div class="commune-parent-ligne"' + (!matchQ ? ' hidden' : '') + '>' +
          '<button type="button" class="puce puce-parente" data-a="choix" data-chemin="' + o.chemin + '" data-m="' + (o.multiple ? 1 : 0) + '" data-v="' + esc(op.v) +
          '" data-parent="1" data-lib="' + dataLib + '" aria-pressed="' + toutCoche + '">' +
          '<span class="parente-gauche">' + icone('localisation') + '<b>' + esc(op.commune) + '</b></span>' +
          '<span class="parente-badge">' + esc(sousLib) + '</span></button></div>';
      }
      if (op.estSecteur) {
        var iconeCoche = actif ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>' : '';
        return '<button type="button" class="puce puce-secteur" data-a="choix" data-chemin="' + o.chemin + '" data-m="' + (o.multiple ? 1 : 0) + '" data-v="' + esc(op.v) +
          '" data-lib="' + dataLib + '" aria-pressed="' + actif + '"' + (!matchQ ? ' hidden' : '') + '>' +
          '<span class="sec-nom">' + iconeCoche + esc(op.nomCourt || op.lib) + '</span>' +
          (op.sousTitre ? '<small class="sec-reperes">' + esc(op.sousTitre) + '</small>' : '') +
          '</button>';
      }
      return '<button type="button" class="puce" data-a="choix" data-chemin="' + o.chemin + '" data-m="' + (o.multiple ? 1 : 0) + '" data-v="' + esc(op.v) +
        '" data-lib="' + dataLib + '" aria-pressed="' + actif + '"' + (!matchQ ? ' hidden' : '') + '>' +
        esc(op.lib) + (op.n !== undefined ? '<small>' + op.n + '</small>' : '') + '</button>';
    }
    var nb = o.multiple ? val.length : 0;
    var totalOpts = o.sections ? o.sections.reduce(function (s, sec) { return s + sec.options.length; }, 0) : (o.options ? o.options.length : 0);
    // 3.26.86 : le résumé affiche les libellés (et non les valeurs techniques)
    var libDe = {}; (o.sections ? [].concat.apply([], o.sections.map(function (s) { return s.options; })) : (o.options || [])).forEach(function (op) { if (op && op.v !== undefined) libDe[op.v] = op.lib; });
    var resume = o.multiple ? (nb ? (nb <= 2 || o.resumeComplet ? val.map(function (v) { return libDe[v] || v; }).join(', ') : nb + ' choisis') : (o.resume || 'Tous')) : '';
    var h = '<section class="groupe-filtre' + (ouvert ? ' ouvert' : '') + '" data-groupe="' + o.id + '">' +
      '<div class="groupe-tete">' + (o.repliable ? '<button type="button" class="groupe-bascule" data-a="basculeGroupe" data-v="' + o.id + '" aria-expanded="' + ouvert + '">' : '<div class="groupe-bascule">') +
      '<b>' + esc(o.titre) + '</b>' + (nb ? '<span class="compteur">' + nb + '</span>' : '') + (o.repliable ? '<small>' + esc(resume) + '</small>' + icone('chevron') + '</button>' : '</div>') +
      (o.multiple && ouvert ? '<span class="groupe-actions"><button type="button" class="lien-action" data-a="groupeTout" data-chemin="' + o.chemin + '">Tous</button>' +
        (nb ? '<button type="button" class="lien-action" data-a="groupeAucun" data-chemin="' + o.chemin + '">Effacer</button>' : '') + '</span>' : '') + '</div>';
    // 3.27.27 : barre de recherche visible même groupe replié (Hôpitaux, Spécialités, Zone) ; taper ouvre le groupe
    var barreRech = o.recherche ? '<div class="recherche petite">' + icone('loupe') + '<input type="search" data-f="chercheOption" data-g="' + o.id + '" placeholder="Rechercher…" value="' +
      esc((f.q && f.q[o.id]) || '') + '" aria-label="Rechercher dans ' + esc(o.titre) + '"></div>' : '';
    if (!ouvert) return h + (o.rechercheVisible ? barreRech : '') + '</section>';
    if (o.aide) h += '<p class="discret groupe-aide">' + esc(o.aide) + '</p>';
    if (o.recherche) h += '<div class="recherche petite">' + icone('loupe') + '<input type="search" data-f="chercheOption" data-g="' + o.id + '" placeholder="Rechercher…" value="' +
      esc((f.q && f.q[o.id]) || '') + '" aria-label="Rechercher dans ' + esc(o.titre) + '"></div>';
    if (o.sections) {
      // 3.25.31 : sections repliables en accordéon (zones géographiques, quartiers…)
      var accCle = o.accordeon || o.id || 'sections';
      var memo = LS.get('secOuverte', {});
      var ouv = (f.secOuvertes && f.secOuvertes[accCle] !== undefined)
        ? f.secOuvertes[accCle]
        : (f.secOuverte !== undefined && accCle === 'l' ? f.secOuverte : undefined);
      if (ouv === undefined || ouv === null) {
        if (o.multiple) {
          var secAvecSel = o.sections.filter(function (sec) {
            return !sec.fermeeParDefaut && sec.options.some(function (op) { return sel && sel[op.v]; });
          })[0];
          var premiereSecDispo = o.sections.filter(function (sec) { return !sec.fermeeParDefaut; })[0] || o.sections[0];
          ouv = secAvecSel ? secAvecSel.titre : (memo[accCle] !== undefined ? memo[accCle] : (premiereSecDispo ? premiereSecDispo.titre : ''));
        } else {
          var secAvecVal = o.sections.filter(function (sec) {
            return !sec.fermeeParDefaut && sec.options.some(function (op) { return op.v === val; });
          })[0];
          var premiereSecDispo = o.sections.filter(function (sec) { return !sec.fermeeParDefaut; })[0] || o.sections[0];
          ouv = secAvecVal ? secAvecVal.titre : (memo[accCle] !== undefined ? memo[accCle] : (premiereSecDispo ? premiereSecDispo.titre : ''));
        }
        f.secOuvertes = f.secOuvertes || {};
        f.secOuvertes[accCle] = ouv;
      }
      o.sections.forEach(function (sec) {
        var nbSel = o.multiple ? sec.options.filter(function (op) { return sel && sel[op.v]; }).length : (sec.options.some(function (op) { return op.v === val; }) ? 1 : 0);
        var nbTot = sec.options.filter(function (op) { return !op.entete; }).length;
        var aMatch = !q || sec.options.some(function (op) { return normaliser(op.lib + ' ' + (op.nomCourt || '') + ' ' + (op.sousTitre || '')).indexOf(q) >= 0; });
        var ferme = q ? !aMatch : (ouv !== sec.titre);
        var ariaExp = q ? aMatch : !ferme;

        var corpsSec = '';
        var aDesSecteurs = sec.options.some(function (op) { return op.estSecteur || op.parent; });
        var estGroupeCommunes = aDesSecteurs || o.id === 'communes' || o.id === 'com';
        if (estGroupeCommunes) {
          var bufferSimples = [];
          var bufferSecteurs = [];
          function flushSimples() {
            if (bufferSimples.length) {
              corpsSec += '<div class="grille-communes-simples">' + bufferSimples.map(puce).join('') + '</div>';
              bufferSimples = [];
            }
          }
          function flushSecteurs() {
            if (bufferSecteurs.length) {
              corpsSec += '<div class="grille-secteurs">' + bufferSecteurs.map(puce).join('') + '</div>';
              bufferSecteurs = [];
            }
          }
          sec.options.forEach(function (op) {
            if (op.parent) {
              flushSimples();
              flushSecteurs();
              corpsSec += puce(op);
            } else if (op.estSecteur) {
              flushSimples();
              bufferSecteurs.push(op);
            } else {
              flushSecteurs();
              bufferSimples.push(op);
            }
          });
          flushSimples();
          flushSecteurs();
        } else {
                    if (q) {
            var htmlSec = '', enteteEnCours = '';
            sec.options.forEach(function (op) {
              if (op.entete) {
                enteteEnCours = op.lib;
              } else {
                var m = !q || normaliser(op.lib + ' ' + (op.nomCourt || '') + ' ' + (op.sousTitre || '')).indexOf(q) >= 0;
                if (m) {
                  if (enteteEnCours) {
                    htmlSec += '<div class="sous-entete-choix">' + esc(enteteEnCours) + '</div>';
                    enteteEnCours = '';
                  }
                  htmlSec += puce(op);
                }
              }
            });
            corpsSec = htmlSec;
          } else {
            corpsSec = sec.options.map(function (op) { return op.entete ? '<div class="sous-entete-choix">' + esc(op.lib) + '</div>' : puce(op); }).join('');
          }
        }

        h += '<div class="section-choix' + (ariaExp ? ' ouverte' : '') + (nbSel ? ' a-selection' : '') + '"' + (q && !aMatch ? ' hidden' : '') + '>' +
          '<div class="section-choix-tete">' +
          '<button type="button" class="aire-titre aire-bascule" data-a="sectionBascule" data-acc="' + esc(accCle) + '" data-v="' + esc(sec.titre) + '" aria-expanded="' + ariaExp + '">' +
          '<span class="sec-titre">' + esc(sec.titre) + '</span>' +
          (nbSel ? '<span class="compteur">' + nbSel + '</span>' : '') +
          '<small>' + nbTot + '</small>' + icone('chevron') + '</button>' +
          (o.multiple ? '<button type="button" class="lien-action section-tous" data-a="sectionToute" data-chemin="' + o.chemin + '" title="Tout sélectionner ou effacer dans ' + esc(sec.titre) + '">Tous</button>' : '') +
          '</div>' +
          '<div class="puces" data-ferme="' + (ferme ? 1 : 0) + '"' + (ferme && !q ? ' hidden' : '') + '>' + corpsSec + '</div></div>';
      });
    } else {
      var puceTous = o.multiple && totalOpts > 1 && !q
        ? '<button type="button" class="puce puce-tous" data-a="' + (o.tousVide ? 'groupeAucun' : 'groupeToutToggle') + '" data-chemin="' + o.chemin + '" aria-pressed="' + (o.tousVide ? (!nb || nb === totalOpts) : nb === totalOpts) + '">Tous</button>'
        : '';
      h += '<div class="puces">' + puceTous + o.options.map(puce).join('') + '</div>';
    }
    return h + '</section>';
  }
  function cheminObjet(chemin) {
    var o = S.ui.feuille, k = chemin.split('.');
    for (var i = 0; i < k.length - 1; i++) o = o[k[i]];
    return { o: o, k: k[k.length - 1] };
  }
  function valeurChemin(chemin) { var c = cheminObjet(chemin); return c.o[c.k]; }
  function sectionsCommunes() {
    var secs = [];
    var qs = (typeof quartiers === 'function') ? quartiers() : [];
    var groupes = {};
    var quartiersParSecteur = {};

    qs.forEach(function (q) {
      var sec = q.commune;
      quartiersParSecteur[sec] = quartiersParSecteur[sec] || [];
      if (quartiersParSecteur[sec].indexOf(q.quartier) < 0) {
        quartiersParSecteur[sec].push(q.quartier);
      }
      var z = q.zone || 'Zone Autre';
      groupes[z] = groupes[z] || {};
      var par = communeParente(sec);
      groupes[z][par] = groupes[z][par] || [];
      if (groupes[z][par].indexOf(sec) < 0) {
        groupes[z][par].push(sec);
      }
    });

    // 3.26.7 : Garantir systématiquement la présence des 3 grandes communes et de leurs 4 secteurs
    groupes['Zone Nord'] = groupes['Zone Nord'] || {};
    groupes['Zone Nord']['Abobo'] = secteursDeGrandeCommune('Abobo');
    groupes['Zone Est'] = groupes['Zone Est'] || {};
    groupes['Zone Est']['Cocody'] = secteursDeGrandeCommune('Cocody');
    groupes['Zone Ouest'] = groupes['Zone Ouest'] || {};
    groupes['Zone Ouest']['Yopougon'] = secteursDeGrandeCommune('Yopougon');

    var zonesOrdonnees = ZONES.slice();
    Object.keys(groupes).forEach(function (z) { if (zonesOrdonnees.indexOf(z) < 0) zonesOrdonnees.push(z); });

    var reperesOfficiels = {
      'Cocody – Angré': 'Angré · 7e/8e tranche · CHU',
      'Cocody – Deux Plateaux': 'Vallons · Aghien · Attoban',
      'Cocody – Riviera': 'Riviera 2-4 · Palmeraie · Faya',
      'Cocody – Centre': 'Saint-Jean · Danga · CHU · Mermoz',
      'Yopougon – Niangon': 'Nord · Sud · Académie · Cité Verte',
      'Yopougon – Maroc & Toits Rouges': 'Maroc · Toits Rouges · Sideci',
      'Yopougon – Centre & Mairie': 'CHU · Saint-André · Siporex',
      'Yopougon – Sud & Gesco': 'Port-Bouët 2 · Selmer · Gesco',
      'Abobo – Nord & PK18': 'PK 18 · N\'Dotré · Belle Ville',
      'Abobo – Centre & Mairie': 'Samaké · Gare · Mairie · Habitat',
      'Abobo – Baoulé & Avocatier': 'Abobo Baoulé · Avocatier · SOTRA',
      'Abobo – Sud & Plaque': 'Sagbé · Plaque 1-2 · Anador'
    };

    zonesOrdonnees.forEach(function (z) {
      if (!groupes[z]) return;
      var opts = [];
      var parents = Object.keys(groupes[z]).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
      parents.forEach(function (par) {
        var estGrande = estGrandeCommune(par);
        var secteurs = estGrande ? secteursDeGrandeCommune(par) : (groupes[z][par] || []);
        if (!estGrande) {
          // Commune standard non segmentée (Plateau, Adjamé, Marcory, Port-Bouët, Bingerville...)
          opts.push({ v: par, lib: par, commune: par });
        } else {
          // Seules les 3 grandes communes (Abobo, Cocody, Yopougon) sont segmentées en 4 sous-secteurs
          opts.push({ v: par, lib: par + ' (Toute la commune)', parent: true, commune: par });
          secteurs.sort(function (a, b) {
            var ia = ORDRE_SECTEURS.indexOf(a), ib = ORDRE_SECTEURS.indexOf(b);
            if (ia >= 0 && ib >= 0) return ia - ib;
            return a.localeCompare(b, 'fr');
          }).forEach(function (sec) {
            var nomCourt = sec.replace(/^(Abobo|Cocody|Yopougon)\s*[-–—]\s*/i, '');
            // Exception Cocody Centre : garder exceptionnellement Cocody Centre
            if (par === 'Cocody' && nomCourt.toLowerCase() === 'centre') {
              nomCourt = 'Cocody Centre';
            }
            var rep = reperesOfficiels[sec] || (quartiersParSecteur[sec] || []).slice(0, 3).join(' · ');
            opts.push({
              v: sec,
              lib: sec,
              nomCourt: nomCourt,
              sousTitre: rep,
              estSecteur: true,
              commune: par
            });
          });
        }
      });
      if (opts.length) secs.push({ titre: z, options: opts });
    });

    return secs;
  }
  // Sélecteur moderne (remplace les listes déroulantes) : bouton « valeur ▾ » qui ouvre une liste à puces avec recherche,
  // comme « Communes » dans Planifier. cfg : { titre, options: [[v, lib]] ou sections: [{ titre, options }], valeur, vide, appliquer(v), dom }
  // dom : formulaire non enregistré (Réglages, identité) : la valeur va dans un champ caché, sans redessiner l'écran.
  S.ui.listes = {};
  function selecteurListe(id, cfg) {
    S.ui.listes[id] = cfg;
    var tout = cfg.sections ? [].concat.apply([], cfg.sections.map(function (x) { return x.options; })) : cfg.options;
    var lib = (tout.filter(function (o) { return o[0] === cfg.valeur; })[0] || [])[1];
    return (cfg.dom ? '<input type="hidden" id="' + id + '" value="' + esc(cfg.valeur || '') + '">' : '') +
      '<button type="button" class="selecteur" data-a="listeOuvrir" data-liste="' + esc(id) + '" id="' + esc(id) + 'Btn"' + (cfg.invalide ? ' aria-invalid="true"' : '') + '>' +
      '<span>' + esc(lib || cfg.vide || 'Choisir…') + '</span><b>▾</b></button>';
  }
  function sectionsQuartiers() {
    var qs = quartiers();
    var grandAbidjanComs = [
      'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville',
      'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët',
      'Songon', 'Treichville', 'Yopougon'
    ];
    var grandAbidjanNorm = grandAbidjanComs.map(normaliser);

    var par = {};
    var interieur = [];

    qs.forEach(function (q) {
      var nomQ = (q.quartier || '').trim();
      if (!nomQ || /^NL$/i.test(nomQ)) return;
      var com = (q.commune || '').trim().replace(/\s*-\s*/g, ' – ');
      var zone = (q.zone || '').trim();
      var secBdd = (q.secteur || '').trim();
      var estInt = zone === 'Zone Intérieur' || zone === 'Zone Interieur' ||
                   (zone && zone.toLowerCase().indexOf('intérieur') >= 0) ||
                   (zone && zone.toLowerCase().indexOf('interieur') >= 0) ||
                   (com && com.toLowerCase().indexOf('intérieur') >= 0) ||
                   (com && com.toLowerCase().indexOf('interieur') >= 0);

      var parent = (typeof communeParente === 'function') ? communeParente(com) : com;
      var normParent = normaliser(parent || '');
      if (!estInt && grandAbidjanNorm.indexOf(normParent) < 0) {
        estInt = true;
      }

      if (estInt) {
        interieur.push({ v: nomQ, lib: nomQ + (com && com !== nomQ && !estInt ? ' (' + com + ')' : '') });
        return;
      }

      // Grand Abidjan : rattachement par commune et secteur
      var groupeTitre = com;
      if (normParent === 'cocody') {
        if (nomQ.toLowerCase() === 'centre' || nomQ.toLowerCase() === 'cocody centre') nomQ = 'Cocody Centre';
        var secTitre = '';
        if (secBdd) {
          var sN = normaliser(secBdd);
          if (sN.indexOf('angre') >= 0 || sN.indexOf('tranche') >= 0) secTitre = 'Cocody – Angré';
          else if (sN.indexOf('plateau') >= 0 || sN.indexOf('vallon') >= 0 || sN.indexOf('aghien') >= 0 || sN.indexOf('attoban') >= 0) secTitre = 'Cocody – Deux Plateaux';
          else if (sN.indexOf('riviera') >= 0 || sN.indexOf('palmeraie') >= 0 || sN.indexOf('faya') >= 0 || sN.indexOf('abatta') >= 0) secTitre = 'Cocody – Riviera';
          else if (sN.indexOf('centre') >= 0 || sN.indexOf('jean') >= 0 || sN.indexOf('danga') >= 0 || sN.indexOf('mermoz') >= 0) secTitre = 'Cocody – Centre';
        }
        if (!secTitre) secTitre = (typeof zoneDeQuartier === 'function') ? zoneDeQuartier('Cocody', nomQ, '') : 'Cocody – Centre';
        groupeTitre = secTitre || 'Cocody – Centre';
      } else if (normParent === 'yopougon') {
        var secTitreY = '';
        if (secBdd) {
          var sNy = normaliser(secBdd);
          if (sNy.indexOf('niangon') >= 0 || sNy.indexOf('verte') >= 0 || sNy.indexOf('academie') >= 0) secTitreY = 'Yopougon – Niangon';
          else if (sNy.indexOf('maroc') >= 0 || sNy.indexOf('toit') >= 0 || sNy.indexOf('bel air') >= 0 || sNy.indexOf('sideci') >= 0) secTitreY = 'Yopougon – Maroc & Toits Rouges';
          else if (sNy.indexOf('gesco') >= 0 || sNy.indexOf('koute') >= 0 || sNy.indexOf('port-bouet 2') >= 0 || sNy.indexOf('sable') >= 0 || sNy.indexOf('industrielle') >= 0) secTitreY = 'Yopougon – Sud & Gesco';
          else if (sNy.indexOf('centre') >= 0 || sNy.indexOf('mairie') >= 0 || sNy.indexOf('siporex') >= 0 || sNy.indexOf('ficgayo') >= 0) secTitreY = 'Yopougon – Centre & Mairie';
        }
        if (!secTitreY) secTitreY = (typeof zoneDeQuartier === 'function') ? zoneDeQuartier('Yopougon', nomQ, '') : 'Yopougon – Centre & Mairie';
        groupeTitre = secTitreY || 'Yopougon – Centre & Mairie';
      } else if (normParent === 'abobo') {
        var secTitreA = '';
        if (secBdd) {
          var sNa = normaliser(secBdd);
          if (sNa.indexOf('pk18') >= 0 || sNa.indexOf('pk 18') >= 0 || sNa.indexOf('ndotre') >= 0 || sNa.indexOf('anonkoua') >= 0 || sNa.indexOf('belle ville') >= 0) secTitreA = 'Abobo – Nord & PK18';
          else if (sNa.indexOf('baoule') >= 0 || sNa.indexOf('avocatier') >= 0 || sNa.indexOf('clouetcha') >= 0 || sNa.indexOf('sotra') >= 0 || sNa.indexOf('abobo-te') >= 0 || sNa.indexOf('abobote') >= 0) secTitreA = 'Abobo – Baoulé & Avocatier';
          else if (sNa.indexOf('plaque') >= 0 || sNa.indexOf('sagbe') >= 0 || sNa.indexOf('anador') >= 0 || sNa.indexOf('dokui') >= 0) secTitreA = 'Abobo – Sud & Plaque';
          else if (sNa.indexOf('centre') >= 0 || sNa.indexOf('mairie') >= 0 || sNa.indexOf('gare') >= 0 || sNa.indexOf('samake') >= 0 || sNa.indexOf('rail') >= 0) secTitreA = 'Abobo – Centre & Mairie';
        }
        if (!secTitreA) secTitreA = (typeof zoneDeQuartier === 'function') ? zoneDeQuartier('Abobo', nomQ, '') : 'Abobo – Centre & Mairie';
        groupeTitre = secTitreA || 'Abobo – Centre & Mairie';
      } else {
        groupeTitre = parent || com;
      }

      groupeTitre = groupeTitre.replace(/\s*-\s*/g, ' – ');
      par[groupeTitre] = par[groupeTitre] || [];
      if (!par[groupeTitre].some(function (x) { return x[0] === nomQ; })) {
        par[groupeTitre].push([nomQ, nomQ]);
      }
    });

    var secteursOrdreParCom = {
      'Cocody': ['Cocody – Angré', 'Cocody – Deux Plateaux', 'Cocody – Riviera', 'Cocody – Centre'],
      'Yopougon': ['Yopougon – Centre & Mairie', 'Yopougon – Maroc & Toits Rouges', 'Yopougon – Niangon', 'Yopougon – Sud & Gesco'],
      'Abobo': ['Abobo – Centre & Mairie', 'Abobo – Baoulé & Avocatier', 'Abobo – Nord & PK18', 'Abobo – Sud & Plaque']
    };

    // 3.27.33 : Regrouper Cocody, Yopougon et Abobo sous leur commune, secteurs en sous-titres
    ['Abobo', 'Cocody', 'Yopougon'].forEach(function (com) {
      var opts = [];
      var ordre = secteursOrdreParCom[com] || [];
      ordre.forEach(function (t) {
        if (!par[t] || !par[t].length) return;
        par[t].sort(function (a, b) { return a[1].localeCompare(b[1], 'fr'); });
        var nomCourt = t.replace(com + ' – ', '');
        opts.push(['', nomCourt, 'entete']);
        opts = opts.concat(par[t]);
        delete par[t];
      });
      if (par[com] && par[com].length) {
        par[com].sort(function (a, b) { return a[1].localeCompare(b[1], 'fr'); });
        opts = opts.concat(par[com]);
        delete par[com];
      }
      if (opts.length) par[com] = opts;
    });

    // 3.27.33 : Toutes les communes du Grand Abidjan classées par ordre alphabétique strict A à Z !
    var clesAbidjan = Object.keys(par).sort(function (a, b) { return a.localeCompare(b, 'fr'); });

    var sections = [];
    clesAbidjan.forEach(function (titre) {
      if (par[titre] && par[titre].length) {
        if (!/^(Abobo|Cocody|Yopougon)$/.test(titre)) {
          par[titre].sort(function (a, b) { return a[1].localeCompare(b[1], 'fr'); });
        }
        sections.push({ titre: titre, options: par[titre] });
      }
    });

    // Villes de l'intérieur toujours en dernier et repliées par défaut
    if (interieur.length) {
      var vuInt = {};
      var optsInt = [];
      interieur.forEach(function (it) {
        if (!vuInt[it.v]) {
          vuInt[it.v] = true;
          optsInt.push([it.v, it.lib]);
        }
      });
      optsInt.sort(function (a, b) { return a[1].localeCompare(b[1], 'fr'); });
      sections.push({
        titre: 'Villes de l\'intérieur',
        options: optsInt,
        fermeeParDefaut: true
      });
    }

    return sections;
  }
  // Nom du délégué : choisi dans la liste de la feuille Listes (évite les fautes de frappe entre collègues)
  function champNom(id, valeur, libelle) {
    var l = (S.data && S.data.delegues) || [];
    if (!l.length) return '<label class="champ"><span>' + libelle + '</span><input type="text" id="' + id + '" autocomplete="name" placeholder="Ex. Koffi Yao" value="' + esc(valeur) + '"></label>';
    var autre = valeur && l.indexOf(valeur) < 0;
    return '<div class="champ"><span>' + libelle + '</span>' + selecteurListe(id, { titre: 'Votre nom', dom: true, valeur: autre ? '__autre' : valeur, vide: 'Choisir mon nom…',
        options: l.map(function (n) { return [n, n]; }).concat([['__autre', 'Mon nom n\'est pas dans la liste']]),
        appliquer: function (v) { var b = $(id + 'Bloc'); if (b) b.hidden = v !== '__autre'; } }) + '</div>' +
      '<label class="champ" id="' + id + 'Bloc"' + (autre ? '' : ' hidden') + '><span>Nom complet</span><input type="text" id="' + id + 'Autre" autocomplete="name" value="' + esc(autre ? valeur : '') + '">' +
      '<span class="aide-champ">Votre prénom et nom seront ajoutés à la liste des délégués.</span></label>';
  }
  // 3.22.0 : un nom absent de la liste des délégués y est ajouté dans la base
  function inscrireDelegue(n) {
    var l = (S.data && S.data.delegues) || [];
    if (!n || !connecte() || l.some(function (x) { return x.toLowerCase() === n.toLowerCase(); })) return;
    apiPost('delegue', { nom: n }).then(function (r) {
      if (r && r.ok) { l.push(n); if (S.data) S.data.delegues = l; LS.set('data', S.data); if (r.ajoute) toast(n + ' ajouté à la liste des délégués.'); }
    }).catch(function () { /* nouvelle tentative au prochain enregistrement */ });
  }
  function lireNom(id) {
    var el = $(id); if (!el) return '';
    if (el.tagName === 'SELECT' || el.type === 'hidden') return (el.value === '__autre' ? (($(id + 'Autre') || {}).value || '') : el.value).trim();
    return (el.value || '').trim();
  }
  // Produits déjà saisis : proposés à la saisie suivante
  function datalistProduits() {
    var l = LS.get('produits', []);
    return '<datalist id="listeProduits">' + l.map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist>';
  }
  function memoriserProduits(t) {
    var ref = produitsRef(), l = LS.get('produits', []);
    listeProduits(t).filter(function (n) { return ref.indexOf(n) < 0; }).forEach(function (n) {
      l = [n].concat(l.filter(function (x) { return x !== n; })).slice(0, 30);
    });
    LS.set('produits', l);
  }
  // 3.25.24 : Produits ordonnés comme dans l'onglet Produits et séparés en 2 gammes :
  // Gamme A (tous les Zyltan / Losartan AM, Lesstrol, Eurythmic, Tensicard) et Gamme B (les autres)
  function estGammeA(prod, gamme) {
    var k = normaliser(String(prod || '') + ' ' + String(gamme || ''));
    if (k.indexOf('lesskaa') >= 0) return false;
    return /zyltan|losartanam|lesstrol|lestrol|eurithmic|eurythmic|tensicard/.test(k);
  }
  function rangFamilleGammeA(prod, gamme) {
    var k = normaliser(String(prod || '') + ' ' + String(gamme || ''));
    if (/zyltan|losartanam/.test(k)) return 0;
    if (/lesstrol|lestrol/.test(k)) return 1;
    if (/tensicard/.test(k)) return 2;
    if (/eurithmic|eurythmic/.test(k)) return 3;
    return 9;
  }
  function estProduitActif(f) {
    if (!f) return false;
    if (f.actif !== undefined && f.actif !== null && f.actif !== '') {
      var a = String(f.actif).trim().toLowerCase();
      if (a === 'false' || a === 'faux' || a === '0' || a === 'non') return false;
    }
    return true;
  }
  function produitsParGamme() {
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
    // 3.25.40 : Le catalogue actif du CR correspond strictement aux produits de Listes!K
    var fiches = fichesToutes.filter(function (f) { return autorises[normaliser(f.produit)] && !inactifs[normaliser(f.produit)]; });
    if (!fiches.length) fiches = fichesToutes.filter(function (f) { return !inactifs[normaliser(f.produit)]; });
    var gammes = typeof gammesProduits === 'function' ? gammesProduits(fiches) : [];
    var gA = [], gB = [], vus = {};
    var famA = gammes.filter(function (g) { return estGammeA('', g.nom); }).slice().sort(function (a, b) {
      return rangFamilleGammeA('', a.nom) - rangFamilleGammeA('', b.nom);
    });
    var famB = gammes.filter(function (g) { return !estGammeA('', g.nom); });
    famA.forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '');
      g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).forEach(function (f) {
        if (!vus[f.produit]) { vus[f.produit] = true; gA.push(f.produit); }
      });
    });
    famB.forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '');
      g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).forEach(function (f) {
        if (!vus[f.produit]) { vus[f.produit] = true; gB.push(f.produit); }
      });
    });
    brut.forEach(function (p) {
      if (!p || vus[p] || inactifs[normaliser(p)] || (p === 'Lestrol 20' && vus['Lesstrol 20'])) return;
      vus[p] = true;
      if (estGammeA(p, '')) gA.push(p); else gB.push(p);
    });
    return { gammeA: gA, gammeB: gB, tous: gA.concat(gB) };
  }
  function famillesProduitsParGamme() {
    var pg = produitsParGamme();
    function filtrer(liste, re) { return liste.filter(function (p) { return re.test(normaliser(p)); }); }
    var zyltan = filtrer(pg.gammeA, /zyltan|losartanam/);
    var lesstrol = filtrer(pg.gammeA, /lesstrol|lestrol/);
    var tensicard = filtrer(pg.gammeA, /tensicard/);
    var eurythmic = filtrer(pg.gammeA, /eurithmic|eurythmic/);
    var autresA = pg.gammeA.filter(function (p) { return zyltan.indexOf(p) < 0 && lesstrol.indexOf(p) < 0 && tensicard.indexOf(p) < 0 && eurythmic.indexOf(p) < 0; });
    var telmikaa = filtrer(pg.gammeB, /telmikaa/);
    var rozukaa = filtrer(pg.gammeB, /rozukaa/);
    var antiplatt = filtrer(pg.gammeB, /antiplatt/);
    var autresB = pg.gammeB.filter(function (p) { return telmikaa.indexOf(p) < 0 && rozukaa.indexOf(p) < 0 && antiplatt.indexOf(p) < 0; });
    return {
      A: [
        { id: 'Zyltan', titre: 'Zyltan', sous: '50, AM, H', produits: zyltan },
        { id: 'Lesstrol', titre: 'Lesstrol', sous: '10, 20', produits: lesstrol },
        { id: 'Tensicard', titre: 'Tensicard', sous: '50, AM', produits: tensicard },
        { id: 'Eurythmic', titre: 'Eurythmic', sous: 'Amiodarone', produits: eurythmic },
        { id: 'AutresA', titre: 'Autres Aura 2', sous: autresA.length + ' produits', produits: autresA }
      ].filter(function (f) { return f.produits.length > 0; }),
      B: [
        { id: 'Telmikaa', titre: 'Telmikaa', sous: 'Telmikaa, AM, H, AMH, CT', produits: telmikaa },
        { id: 'Rozukaa', titre: 'Rozukaa', sous: '10, 20, F, A, Gold', produits: rozukaa },
        { id: 'Antiplatt', titre: 'Antiplatt', sous: 'Antiplatt, Plus', produits: antiplatt },
        { id: 'AutresB', titre: 'Autres (Lesskaa, Myonit, Orlitroy, Troynuron)', sous: autresB.length + ' produits', produits: autresB }
      ].filter(function (f) { return f.produits.length > 0; })
    };
  }
  function produitsRef() { return produitsParGamme().tous; }
  function derniersProduitsCr() {
    var ref = produitsRef(), mem = LS.get('derniersProduitsCr', null);
    if (Array.isArray(mem)) return mem.filter(function (p) { return ref.indexOf(p) >= 0; });
    var l = S.plan.filter(function (a) { return a.statut && !estPharmacie(a) && a.produits; }).slice(-1)[0]
      || (S.queue || []).filter(function (v) { return v.type !== 'Pharmacie' && v.produits; }).slice(-1)[0]
      || ((S.data && S.data.historique) || []).filter(function (v) { return (!v.delegue || estMoi(v.delegue)) && v.type !== 'Pharmacie' && v.produits; })[0];
    return l ? listeProduits(l.produits).filter(function (p) { return ref.indexOf(p) >= 0; }) : [];
  }
  function memoriserDerniersProduitsCr(prods) {
    if (Array.isArray(prods)) LS.set('derniersProduitsCr', prods.slice());
  }
  function derniersProduitsStockCr() {
    var ref = produitsRef(), mem = LS.get('derniersProduitsStockCr', null);
    if (Array.isArray(mem)) return mem.filter(function (p) { return ref.indexOf(p) >= 0; });
    return [];
  }
  function memoriserDerniersProduitsStockCr(prods) {
    if (Array.isArray(prods)) LS.set('derniersProduitsStockCr', prods.slice());
  }
  var TYPES_COMMUNS_CR = ['Routine', 'Présentation', 'Échantillons', 'Cadeaux'];
  function groupesTypesCr(ph) {
    var base = ph ? activitesPharmacie().slice() : activites().slice();
    TYPES_COMMUNS_CR.forEach(function (t) { if (base.indexOf(t) < 0) base.unshift(t); });
    var communs = TYPES_COMMUNS_CR.filter(function (t) { return base.indexOf(t) >= 0; });
    var spec = base.filter(function (t) { return communs.indexOf(t) < 0; });
    return { communs: communs, specifiques: spec, tous: communs.concat(spec) };
  }
  function derniersTypesCr(ph) {
    var g = groupesTypesCr(ph), ref = g.tous, cle = ph ? 'derniersTypesPharma' : 'derniersTypesMed';
    var mem = LS.get(cle, null);
    if (Array.isArray(mem) && mem.length) {
      var f = mem.filter(function (x) { return ref.indexOf(x) >= 0; });
      if (f.length) return f;
    }
    var der = S.plan.filter(function (a) { return a.statut && estPharmacie(a) === !!ph && a.activite; }).slice(-1)[0]
      || (S.queue || []).filter(function (v) { return (v.type === 'Pharmacie') === !!ph && v.activite; }).slice(-1)[0]
      || ((S.data && S.data.historique) || []).filter(function (v) { return (!v.delegue || estMoi(v.delegue)) && (v.type === 'Pharmacie') === !!ph && v.activite; })[0];
    if (der) {
      var l = listeActivites(der.activite).filter(function (x) { return ref.indexOf(x) >= 0; });
      if (l.length) return l;
    }
    return ph ? ['Routine', 'Stocks'] : ['Routine', 'Présentation produit'];
  }
  function memoriserDerniersTypesCr(ph, types) {
    if (Array.isArray(types) && types.length) LS.set(ph ? 'derniersTypesPharma' : 'derniersTypesMed', types.slice());
  }
  function listeProduits(t) { return String(t || '').split(/\s*[,;]\s*/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function autresProduits(t, ref) { ref = ref || produitsRef(); return listeProduits(t).filter(function (x) { return ref.indexOf(x) < 0; }); }
  function estPharmacie(a) { return (a.type || (praticien(a.code) || {}).type) === 'Pharmacie'; }
  function produitsPour(a) {
    var l = produitsRef().slice();
    return l;
  }
  // « RDV pris le 26-Oct-2026 » ; si le praticien n'était pas présent le jour convenu : « prévu le …, décalé au premier jour de présence »
  function libelleRdv(a) {
    // 3.19.0 : libellé court (« RDV du 05-Nov reporté au 07-Nov pour absence »)
    var jm = function (d) { return dateFr(d).slice(0, -5); };
    if (a.rdvDate && a.rdvDate !== a.date) return 'RDV du ' + jm(a.rdvDate) + ' reporté au ' + jm(a.date) + ' pour absence';
    return 'RDV du ' + jm(a.rdvDate || a.date);
  }
  function statutLibelle(a) { return estPharmacie(a) && a.statut && !estKo(a.statut) ? 'Visitée' : a.statut; }
  function activites() { return (S.data && S.data.activites && S.data.activites.length) ? S.data.activites : ACTIVITES_DEFAUT; }
  function listeActivites(t) { return String(t || '').split(/\s*;\s*/).filter(Boolean).map(function (x) { return ACTIVITES_RENOMMEES[x] || x; }); }
  function ficheEnAttente(code) { return S.fiches.some(function (f) { return f.praticien.code === code; }); }

  var $ = function (id) { return document.getElementById(id); };
  var toastTimer;
  function toast(msg, duree) {
    var t = $('toast'); t.textContent = msg; t.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('visible'); }, duree || 3400);
  }

